import type {
  AnalysisResult,
  LoadCombination,
  PDeltaConfig,
  PDeltaDiagnostics,
  PDeltaStepIteration,
  ProjectModel,
} from '../types';
import { analyzeProjectWithActiveSet, conditionalMembers } from './activeSet';
import { abortedAnalysis } from './analysisFailure';
import { classifyAnalysisReliability } from './reliability';
import { analyzeProject, selectedFactors } from './solver';

export const DEFAULT_PDELTA_CONFIG: PDeltaConfig = {
  maxLoadSteps: 12,
  maxIterationsPerStep: 30,
  equilibriumTolerance: 1e-6,
  displacementTolerance: 1e-6,
  stepReductionFactor: 0.5,
  minimumStep: 1 / 64,
};

export const resolvePDeltaConfig = (project: ProjectModel): PDeltaConfig => ({
  ...DEFAULT_PDELTA_CONFIG,
  ...project.settings.pDeltaConfig,
});

/** Hard caps: a configuration past these cannot finish in interactive time, and
 *  an unbounded one (`Infinity`) would spin the iteration loop forever. */
const CONFIG_LIMITS = { maxLoadSteps: 200, maxIterationsPerStep: 500, totalSolves: 10000 } as const;

/**
 * Warn from this estimated critical load factor down. 1/0.8 = 1.25 means the
 * applied load has reached 80 % of the estimated elastic critical load, where
 * a one-element-per-member model already carries ~1 % discretisation error on
 * the deflection and the amplification starts running away.
 */
const CRITICAL_FACTOR_WARNING = 1.25;

/**
 * Validates the configuration inside the engine, not only at the UI inputs:
 * `analyzeProjectPDelta` is reachable from the worker, the fallback path and
 * imported projects, none of which pass through the TopBar number fields.
 * Returns the offending descriptions, empty when the configuration is usable.
 */
export const validatePDeltaConfig = (config: PDeltaConfig): string[] => {
  const problems: string[] = [];
  const positiveInteger = (value: number, label: string, max: number) => {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > max) {
      problems.push(`${label} debe ser un entero entre 1 y ${max} (valor recibido: ${value}).`);
    }
  };
  const positiveFinite = (value: number, label: string) => {
    if (!Number.isFinite(value) || value <= 0) problems.push(`${label} debe ser un número positivo y finito (valor recibido: ${value}).`);
  };
  positiveInteger(config.maxLoadSteps, 'El máximo de pasos de carga', CONFIG_LIMITS.maxLoadSteps);
  positiveInteger(config.maxIterationsPerStep, 'El máximo de iteraciones por paso', CONFIG_LIMITS.maxIterationsPerStep);
  positiveFinite(config.equilibriumTolerance, 'La tolerancia de equilibrio');
  positiveFinite(config.displacementTolerance, 'La tolerancia de desplazamiento');
  if (!Number.isFinite(config.stepReductionFactor) || config.stepReductionFactor <= 0 || config.stepReductionFactor >= 1) {
    problems.push(`El factor de reducción de paso debe cumplir 0 < factor < 1 (valor recibido: ${config.stepReductionFactor}).`);
  }
  if (!Number.isFinite(config.minimumStep) || config.minimumStep <= 0 || config.minimumStep > 1) {
    problems.push(`El paso mínimo debe cumplir 0 < paso ≤ 1 (valor recibido: ${config.minimumStep}).`);
  }
  // Per-field caps are not enough: 200 pasos × 500 iteraciones son 100 000
  // resoluciones lineales, unas 6 h en un pórtico de 77 nodos — válido campo a
  // campo y aun así inutilizable. El techo deja holgura para configuraciones
  // legítimas de alta precisión (p. ej. 12 × 200 para un benchmark) y corta las
  // patológicas.
  const budget = config.maxLoadSteps * config.maxIterationsPerStep;
  if (Number.isFinite(budget) && budget > CONFIG_LIMITS.totalSolves) {
    problems.push(`El producto de pasos por iteraciones (${budget}) supera el presupuesto de ${CONFIG_LIMITS.totalSolves} resoluciones lineales; reduce alguno de los dos.`);
  }
  return problems;
};

/**
 * A combination scaled to `lambda` of its own intensity. Every quantity that
 * already flows through `factors` — nodal/member loads, self-weight, initial
 * effects, and case-linked prescribed displacements — scales proportionally;
 * an absolute `support.prescribed` settlement is a fixed boundary condition
 * and is untouched, exactly as it already is for an ordinary combination.
 */
const scaleCombination = (project: ProjectModel, combination: LoadCombination | null | undefined, lambda: number): LoadCombination => {
  const resolved = selectedFactors(project, combination);
  const factors: Record<string, number> = {};
  for (const id of Object.keys(resolved)) factors[id] = resolved[id] * lambda;
  return { id: combination?.id ?? 'p-delta-step', name: combination?.name ?? 'P-Delta', factors };
};

/**
 * Axial force per frame member (tension positive, this engine's convention),
 * averaged across the member's two ends. The classic geometric-stiffness
 * matrix assumes a constant axial force along the element; averaging is the
 * standard, documented simplification for a member that also carries a
 * distributed axial load (e.g. self-weight along an inclined member), where
 * the two ends would otherwise disagree.
 */
const extractAxialForces = (result: AnalysisResult, frameMemberIds: readonly string[]): Map<string, number> => {
  const forces = new Map<string, number>();
  for (const id of frameMemberIds) {
    const member = result.memberResults.find((candidate) => candidate.memberId === id);
    if (!member) { forces.set(id, 0); continue; }
    const nEnd = -member.localEndForces[0];
    const nOther = member.localEndForces[3];
    forces.set(id, (nEnd + nOther) / 2);
  }
  return forces;
};

/**
 * Relative change between two iterates, normalised by the model's own
 * displacement scale.
 *
 * The reference must come from the model, never from a fixed constant: an
 * absolute floor expressed in base units (`Math.max(1, ‖u‖)` with metres)
 * silently degrades this from a relative criterion to an absolute one for every
 * model whose displacements are below that floor. Measured: a stiff model with
 * ‖u‖ ≈ 1e-6 m reports 2.3e-8 for a *1 % real change*, passing a 1e-6
 * tolerance — a false convergence. Bathe (Finite Element Procedures, §8.4.4)
 * normalises by the accumulated solution of the current step for exactly this
 * reason. `reference` is that step's first-order response, which is always
 * available here and always has the model's own physical scale.
 */
const relativeVectorChange = (next: readonly number[], previous: readonly number[], reference: number): number => {
  let diffSquared = 0;
  let scaleSquared = 0;
  for (let i = 0; i < next.length; i += 1) {
    const diff = next[i] - (previous[i] ?? 0);
    diffSquared += diff * diff;
    scaleSquared += next[i] * next[i];
  }
  const scale = Math.max(Math.sqrt(scaleSquared), reference);
  // A model that genuinely does not move (fully restrained, unloaded) has no
  // scale to be relative to; reporting 0 is honest, inventing a floor is not.
  if (!(scale > 0)) return 0;
  return Math.sqrt(diffSquared) / scale;
};

/** Euclidean norm, used to derive the per-step displacement reference. */
const vectorNorm = (values: readonly number[]): number =>
  Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));

/**
 * Fraction of the largest first-order displacement below which a DOF is
 * treated as not participating in the amplification. Low enough to keep a
 * stocky column's bending response (~1e-3 of its axial shortening), high
 * enough to keep DOFs that are numerically zero from contributing a huge
 * meaningless ratio.
 */
const SIGNIFICANT_DOF_FRACTION = 1e-6;

/**
 * True when a converged state cannot be a stable equilibrium.
 *
 * The test is applied to the single DOF that second-order effects changed the
 * most, `argmax |u₂ᵢ − u₁ᵢ|`. That DOF is by construction the one the
 * geometric stiffness actually acts on, which is what makes the test robust:
 *
 * - Any whole-vector measure (dot product, norm ratio) is dominated by
 *   whichever DOF family is largest, and that is routinely *not* the one that
 *   buckles. In a stocky column (L/r ≈ 22) the axial shortening dwarfs the
 *   sway, so the projection onto the first-order response stayed at 0.9999996
 *   while the sway was genuinely reversed, and the engine returned that
 *   post-critical state as a success.
 * - Flagging *any* reversed DOF is too strict: second-order effects legitimately
 *   redistribute a multi-element or multi-storey model, and small DOFs can
 *   change sign while the structure is perfectly stable.
 *
 * A reversal of the most-affected DOF is unambiguous: compression can amplify
 * a response without bound, but it cannot turn the governing one around while
 * the tangent is still positive definite. No tension/compression gate is
 * needed — pure tension never reverses anything — which also removes a gate
 * measured mis-firing in both directions on mixed models, where a tie carrying
 * the largest |N| both hid real buckling and aborted valid runs.
 */
const isPostCriticalState = (
  displacements: readonly number[],
  firstOrderDisplacements: readonly number[],
): boolean => {
  if (firstOrderDisplacements.length !== displacements.length) return false;
  let governing = -1;
  let largestChange = 0;
  for (let i = 0; i < displacements.length; i += 1) {
    const change = Math.abs(displacements[i] - firstOrderDisplacements[i]);
    if (change > largestChange) { largestChange = change; governing = i; }
  }
  if (governing < 0) return false;
  const first = firstOrderDisplacements[governing];
  const second = displacements[governing];
  // Only a reversal that is itself a real motion counts, never a value
  // crossing zero inside its own rounding error.
  return second * first < 0 && Math.abs(second) > Math.abs(first) * 1e-6;
};

/**
 * Largest relative change in member axial force, normalised by the largest
 * axial force actually present. Same reasoning as `relativeVectorChange`: the
 * previous `Math.max(1, …)` floor was one kilonewton of absolute slack, which
 * is a different criterion for a footbridge tie than for a transfer column.
 */
const relativeAxialChange = (next: Map<string, number>, previous: Map<string, number>): number => {
  let maxDiff = 0;
  let maxScale = 0;
  for (const [id, value] of next) {
    const before = previous.get(id) ?? 0;
    maxDiff = Math.max(maxDiff, Math.abs(value - before));
    maxScale = Math.max(maxScale, Math.abs(value));
  }
  // No axial force anywhere means the geometric stiffness is identically zero:
  // there is nothing left to iterate on, so the criterion is trivially met.
  if (!(maxScale > 0)) return 0;
  return maxDiff / maxScale;
};

interface StepOutcome {
  converged: boolean;
  analysisResult: AnalysisResult;
  axialForces: Map<string, number>;
  iterations: number;
  history: PDeltaStepIteration[];
  reason: string;
}

/** Fixed-point (successive-approximation) P-Delta iteration at one fixed load fraction `lambda`. */
const solveLoadStep = (
  project: ProjectModel,
  combination: LoadCombination | null | undefined,
  lambda: number,
  step: number,
  startingAxialForces: Map<string, number>,
  frameMemberIds: readonly string[],
  config: PDeltaConfig,
  includeEducationTrace: boolean,
): StepOutcome => {
  const scaled = scaleCombination(project, combination, lambda);
  // The direction reference is this *step's own* first-order response, not a
  // single lambda=1 baseline: an absolute `support.prescribed` settlement
  // does not scale with lambda, so the first-order direction at a partial
  // load level is not simply a shrunk copy of the full-combination one.
  // Purely a reference vector for `relativeVectorChange`/amplification below —
  // never published — so it never needs the education trace.
  const stepFirstOrder = analyzeProject(project, scaled, { includeEducationTrace: false, linearBackend: 'dense' });
  const firstOrderDisplacements = stepFirstOrder.success ? stepFirstOrder.displacements : [];
  // Physical scale this step's convergence is measured against; see
  // `relativeVectorChange`.
  const displacementReference = vectorNorm(firstOrderDisplacements);
  let axialForces = new Map(startingAxialForces);
  let previousDisplacements: number[] | null = null;
  let previousIncrement = Number.POSITIVE_INFINITY;
  const history: PDeltaStepIteration[] = [];
  let lastResult: AnalysisResult | null = null;

  for (let iteration = 1; iteration <= config.maxIterationsPerStep; iteration += 1) {
    // Every iteration but the converged one is thrown away, so the caller's
    // `includeEducationTrace` intent is honored on all of them alike — building
    // it only on a guessed-final iteration would risk publishing a stale trace
    // if that guess were wrong.
    const result = analyzeProject(project, scaled, {
      pDeltaAxialForces: axialForces,
      includeEducationTrace,
      linearBackend: 'dense',
    });
    lastResult = result;
    if (!result.success) {
      return {
        converged: false, analysisResult: result, axialForces, iterations: iteration, history,
        reason: 'El sistema resultó inestable durante la iteración P-Delta (posible pandeo o mecanismo).',
      };
    }
    const nextAxialForces = extractAxialForces(result, frameMemberIds);
    if (isPostCriticalState(result.displacements, firstOrderDisplacements)) {
      return {
        converged: false, analysisResult: result, axialForces, iterations: iteration, history,
        reason: 'La respuesta dejó de amplificarse respecto al primer orden bajo compresión gobernante: la estructura superó una carga crítica de pandeo y la solución encontrada no es un equilibrio estable.',
      };
    }
    const axialChange = relativeAxialChange(nextAxialForces, axialForces);
    const displacementIncrement = previousDisplacements
      ? relativeVectorChange(result.displacements, previousDisplacements, displacementReference)
      : Number.POSITIVE_INFINITY;
    // Reported for traceability, NOT used as a convergence criterion: this is
    // the algebraic residual of the *frozen* linear system K(N_prev)·U = F
    // after iterative refinement, not the nonlinear unbalance. Measured across
    // P/Pcr = 0.1…0.99 it sits at 1e-18…1e-16, nine or more orders below any
    // useful threshold, so gating on it would be vacuous — and worse, it would
    // make an ill-conditioned model that merely earns a warning in first order
    // unable to converge at all in P-Delta.
    const equilibriumResidual = result.residualNorm;
    history.push({ step, iteration, lambda, residual: axialChange, displacementIncrement, equilibriumResidual, conditionEstimate: result.conditionEstimate });

    const converged = iteration > 1
      && axialChange <= config.equilibriumTolerance
      && displacementIncrement <= config.displacementTolerance
      && Number.isFinite(equilibriumResidual);
    if (converged) {
      return { converged: true, analysisResult: result, axialForces: nextAxialForces, iterations: iteration, history, reason: 'Se cumplieron las tolerancias de cambio axial y de incremento de desplazamiento.' };
    }
    // Growth instead of shrinkage between successive iterations is the
    // signature of a fixed-point iteration diverging (e.g. near/above the
    // critical load) — fail fast instead of burning the full iteration budget.
    if (iteration > 2 && displacementIncrement > previousIncrement * 1.5 && displacementIncrement > config.displacementTolerance) {
      return {
        converged: false, analysisResult: result, axialForces: nextAxialForces, iterations: iteration, history,
        reason: 'El incremento de desplazamiento crece entre iteraciones en vez de reducirse: la iteración diverge, posiblemente cerca de la carga crítica.',
      };
    }
    previousDisplacements = result.displacements;
    previousIncrement = displacementIncrement;
    axialForces = nextAxialForces;
  }
  return {
    converged: false, analysisResult: lastResult!, axialForces, iterations: config.maxIterationsPerStep, history,
    reason: `Se agotaron ${config.maxIterationsPerStep} iteraciones sin cumplir la tolerancia.`,
  };
};

/**
 * Worst second-order amplification across the degrees of freedom that actually
 * move under first order.
 *
 * A single `max|u₂| / max|u₁|` ratio is misleading whenever one DOF family
 * dominates the vector: for a stiff column the axial shortening (unchanged by
 * P-Delta) is orders of magnitude larger than the sway, so that ratio reports
 * ×1.000 while the sway genuinely doubles — measured 1.0000 reported against a
 * true 1.9794. Taking the largest per-DOF ratio instead reports the governing
 * amplification, which is the quantity design codes call B₂.
 *
 * DOFs that barely move under first order are excluded: their ratio is
 * numerically meaningless, not physically large.
 */
const amplificationOf = (second: readonly number[], first: readonly number[]): number | undefined => {
  if (second.length !== first.length) return undefined;
  let reference = 0;
  for (const value of first) reference = Math.max(reference, Math.abs(value));
  if (!(reference > 0)) return undefined;
  const floor = reference * SIGNIFICANT_DOF_FRACTION;
  let worst = 0;
  let counted = false;
  for (let i = 0; i < first.length; i += 1) {
    if (Math.abs(first[i]) <= floor) continue;
    worst = Math.max(worst, Math.abs(second[i]) / Math.abs(first[i]));
    counted = true;
  }
  return counted ? worst : undefined;
};

/**
 * Estimated elastic critical load factor for the current load pattern, from
 * the standard design relation `B₂ = 1/(1 − 1/λ_cr)` applied to the computed
 * amplification.
 *
 * A bisection on the axial-force scale was implemented and then removed: the
 * stability predicate is NOT monotone in that scale — past the first critical
 * point there are windows that look stable again (measured projections at
 * s = 1.5 … 2.5: 90.2, −25.3, −0.48, +1.50, +33.9, −8.6). A doubling scan
 * lands in such a window and brackets the *second* critical point, so a frame
 * at 91 % of its buckling load was reported at λ_cr = 2.01 with no warning,
 * while this analytic relation gave the correct 1.10. It is also free, where
 * the bisection cost up to 19 extra linear solves — 40× the first-order
 * runtime on a 77-node frame.
 *
 * It is an estimate and is labelled as one wherever it is surfaced: the
 * relation assumes a single dominant buckling mode, and it inherits the
 * model's discretisation error (one element per member over-predicts a
 * member's own critical load by ~0.75 %).
 */
const estimateCriticalLoadFactor = (amplification: number | undefined): number | undefined => {
  if (amplification === undefined || !Number.isFinite(amplification) || amplification <= 1) return undefined;
  return amplification / (amplification - 1);
};

/**
 * Second-order (P-Delta) elastic analysis: an outer load-stepping loop around
 * repeated calls to the existing `analyzeProject`, each rebuilding every frame
 * member's local stiffness as elastic + geometric(N) — the geometric term
 * uses the axial force the *previous* iteration converged to, so the loop is a
 * fixed-point ("successive approximation") iteration on N, not a from-scratch
 * solver. This reuses every existing piece of the linear machinery (KKT
 * constraints, equilibration, factorization, refinement, reliability
 * classification) unchanged; only the per-member local stiffness changes.
 *
 * Load-stepping is adaptive, not fixed: every attempt first tries to reach
 * the full combination (`lambda = 1`) in one step, and only subdivides when
 * that fails to converge — so a well-behaved model still does one load step.
 */
export const analyzeProjectPDelta = (
  project: ProjectModel,
  combination?: LoadCombination | null,
  configOverride?: Partial<PDeltaConfig>,
  options?: { includeEducationTrace?: boolean },
): AnalysisResult => {
  const includeEducationTrace = options?.includeEducationTrace ?? true;
  const config: PDeltaConfig = { ...resolvePDeltaConfig(project), ...configOverride };
  // Validated before any solving: an unbounded `maxIterationsPerStep` would
  // spin the inner loop forever, and a non-finite tolerance can never be met,
  // so both must be rejected with a message rather than hang the worker.
  const configProblems = validatePDeltaConfig(config);
  if (configProblems.length) {
    return abortedAnalysis([{
      id: 'pdelta-invalid-config',
      severity: 'error',
      title: 'Configuración P-Delta inválida',
      message: configProblems.join(' '),
      suggestedFix: 'Corrige los valores en la configuración avanzada P-Delta, o bórralos para volver a los valores por defecto.',
    }], {
      pDelta: {
        enabled: true, experimental: true, converged: false, loadStepsUsed: 0, totalIterations: 0,
        initialResidual: Number.NaN, finalResidual: Number.NaN, finalDisplacementIncrement: Number.NaN,
        finalAxialChange: Number.NaN, finalEquilibriumResidual: Number.NaN,
        convergenceReason: '', failureReason: configProblems.join(' '),
        history: [], memberAxialForces: {},
      },
    });
  }
  const frameMemberIds = project.members.filter((member) => member.type === 'frame').map((member) => member.id);

  const firstOrder = analyzeProject(project, combination, { includeEducationTrace, linearBackend: 'dense' });
  if (!firstOrder.success) {
    return {
      ...firstOrder,
      pDelta: {
        enabled: true, experimental: true, converged: false, loadStepsUsed: 0, totalIterations: 0,
        initialResidual: Number.NaN, finalResidual: Number.NaN, finalDisplacementIncrement: Number.NaN,
        finalAxialChange: Number.NaN, finalEquilibriumResidual: Number.NaN,
        convergenceReason: '',
        failureReason: 'El análisis de primer orden ya no es válido para este modelo; corrígelo antes de aplicar P-Delta.',
        history: [], memberAxialForces: {},
      },
    };
  }

  let lambdaAchieved = 0;
  let stepSize = 1;
  let axialForces = new Map<string, number>(frameMemberIds.map((id) => [id, 0]));
  let lastConverged: StepOutcome | null = null;
  const history: PDeltaStepIteration[] = [];
  let totalIterations = 0;
  let loadStepsUsed = 0;
  let attempts = 0;

  while (lambdaAchieved < 1 - 1e-9) {
    if (attempts >= config.maxLoadSteps) {
      return buildFailureResult(firstOrder, config, history, totalIterations, loadStepsUsed,
        `Se alcanzó el máximo de ${config.maxLoadSteps} pasos de carga sin llegar a la combinación completa (fracción alcanzada: ${(lambdaAchieved * 100).toFixed(1)}%).`);
    }
    attempts += 1;
    const target = Math.min(1, lambdaAchieved + stepSize);
    const outcome = solveLoadStep(project, combination, target, loadStepsUsed + 1, axialForces, frameMemberIds, config, includeEducationTrace);
    history.push(...outcome.history);
    totalIterations += outcome.iterations;
    if (outcome.converged) {
      lambdaAchieved = target;
      axialForces = outcome.axialForces;
      lastConverged = outcome;
      loadStepsUsed += 1;
      stepSize = 1 - lambdaAchieved || 1;
      continue;
    }
    stepSize *= config.stepReductionFactor;
    if (stepSize < config.minimumStep) {
      return buildFailureResult(firstOrder, config, history, totalIterations, loadStepsUsed, outcome.reason, outcome.analysisResult);
    }
  }

  if (!lastConverged) {
    // lambdaAchieved reached 1 without a successful step only when the total
    // load was already ~0; fall back to the (already successful) first-order run.
    lastConverged = { converged: true, analysisResult: firstOrder, axialForces, iterations: 0, history: [], reason: 'Sin carga axial: el resultado coincide con el de primer orden.' };
  }

  const finalResult = lastConverged.analysisResult;
  const amplificationFactor = amplificationOf(finalResult.displacements, firstOrder.displacements);
  const lastIteration = history.at(-1);
  // The condition-number ratio previously used here was measured failing in
  // both directions — it misses 0.90·Pcr (ratio 9.7) and 0.95·Pcr (19.3, under
  // its own threshold of 20), and it is *blind* above the critical load, where
  // the ratio falls back below 1 (0.43 at 3·Pcr) because κ recovers on the far
  // side of the singularity. A computed load factor is monotone, scale-free
  // and directly comparable across models, so the warning is derived from it.
  const criticalLoadFactor = estimateCriticalLoadFactor(amplificationFactor);
  const stabilityWarning = criticalLoadFactor !== undefined && criticalLoadFactor <= CRITICAL_FACTOR_WARNING
    ? `Factor de carga crítica elástica estimado ≈ ${criticalLoadFactor.toFixed(2)}: la carga aplicada está al ${(100 / criticalLoadFactor).toFixed(0)} % de la crítica estimada. Estimación a partir de la amplificación mediante B₂ = 1/(1 − 1/λ), no un análisis de valores propios; supone un modo de pandeo dominante y con un elemento por miembro sobrestima la crítica ≈0.75 %.`
    : undefined;

  const memberAxialForces: Record<string, number> = {};
  axialForces.forEach((value, id) => { memberAxialForces[id] = value; });

  const pDelta: PDeltaDiagnostics = {
    enabled: true,
    experimental: true,
    converged: true,
    loadStepsUsed,
    totalIterations,
    initialResidual: history[0]?.residual ?? 0,
    finalResidual: lastIteration?.residual ?? 0,
    finalDisplacementIncrement: lastIteration?.displacementIncrement ?? 0,
    finalAxialChange: lastIteration?.residual ?? 0,
    finalEquilibriumResidual: lastIteration?.equilibriumResidual ?? finalResult.residualNorm,
    criticalLoadFactor,
    convergenceReason: lastConverged.reason,
    stabilityWarning,
    amplificationFactor,
    history,
    memberAxialForces,
  };

  const issues = stabilityWarning
    ? [{ id: 'pdelta-near-critical', severity: 'warning' as const, title: 'Proximidad a la carga crítica', message: stabilityWarning }, ...finalResult.issues]
    : finalResult.issues;

  // `finalResult.reliability` was stamped by `analyzeProject` before `pDelta`
  // existed on the object, so it still judges this run by first-order
  // equilibrium bookkeeping — recompute now that `result.pDelta.enabled` is
  // visible to `classifyAnalysisReliability`, or every real P-Delta result
  // reads as "unreliable" for the exact P·Δ moment it was asked to capture.
  const withPDelta: AnalysisResult = { ...finalResult, issues, pDelta };
  return { ...withPDelta, reliability: classifyAnalysisReliability(withPDelta) };
};

const buildFailureResult = (
  firstOrder: AnalysisResult,
  config: PDeltaConfig,
  history: PDeltaStepIteration[],
  totalIterations: number,
  loadStepsUsed: number,
  failureReason: string,
  lastAttempt?: AnalysisResult,
): AnalysisResult => {
  const lastIteration = history.at(-1);
  const pDelta: PDeltaDiagnostics = {
    enabled: true,
    experimental: true,
    converged: false,
    loadStepsUsed,
    totalIterations,
    initialResidual: history[0]?.residual ?? Number.NaN,
    finalResidual: lastIteration?.residual ?? Number.NaN,
    finalDisplacementIncrement: lastIteration?.displacementIncrement ?? Number.NaN,
    finalAxialChange: lastIteration?.residual ?? Number.NaN,
    finalEquilibriumResidual: lastIteration?.equilibriumResidual ?? Number.NaN,
    convergenceReason: '',
    failureReason,
    history,
    memberAxialForces: {},
  };
  return abortedAnalysis([
    ...firstOrder.issues,
    {
      id: 'pdelta-not-converged',
      severity: 'error',
      title: 'El análisis P-Delta no convergió',
      message: failureReason,
      suggestedFix: `Aumenta el número máximo de pasos/iteraciones en la configuración P-Delta, reduce la carga, o revisa si la estructura está cerca de una carga crítica de pandeo (paso mínimo configurado: ${(config.minimumStep * 100).toFixed(2)}% de la carga total).`,
    },
  ], { pDelta, mechanism: lastAttempt?.mechanism });
};

/**
 * Punto único de despacho de la aplicación: lo llaman `ProjectContext` y el
 * worker de análisis. Cualquier otro llamador sigue usando `analyzeProject`
 * directamente.
 *
 * La rama de primer orden pasa por `analyzeProjectWithActiveSet` **sin
 * condicional**: esa función delega en `analyzeProject` sin tocar nada cuando
 * ningún miembro declara `axialBehavior`, y hay pruebas que lo afirman
 * desplazamiento a desplazamiento. Poner aquí un `if` sería repetir una
 * decisión que ya está tomada un nivel más abajo, y darle dos sitios donde
 * discrepar.
 *
 * ## P-Delta y las barras de signo restringido no componen todavía
 *
 * La iteración de segundo orden es un punto fijo sobre la fuerza axial con el
 * conjunto de barras **fijo**; el conjunto activo es otra iteración, sobre qué
 * barras trabajan. Anidarlas exige decidir cuál manda en cada paso y demostrar
 * que la combinación converge, y eso es un trabajo con su propia validación.
 *
 * Mientras tanto, un modelo con las dos cosas no se resuelve a medias en
 * silencio: se resuelve con P-Delta y **se dice** que la restricción de signo
 * no se aplicó. Callarlo devolvería un resultado con barras trabajando a
 * compresión que el usuario declaró incapaces de hacerlo, con toda la pinta de
 * ser correcto.
 */
export const analyzeProjectAuto = (
  project: ProjectModel,
  combination?: LoadCombination | null,
  options?: { includeEducationTrace?: boolean },
): AnalysisResult => {
  if (project.settings.analysisMode !== 'p-delta') {
    return analyzeProjectWithActiveSet(project, combination, options);
  }
  const result = analyzeProjectPDelta(project, combination, undefined, options);
  const conditional = conditionalMembers(project);
  if (!conditional.length) return result;
  return {
    ...result,
    issues: [...result.issues, {
      id: 'pdelta-ignores-axial-behavior',
      severity: 'warning',
      title: 'P-Delta no aplica la restricción de signo de las barras',
      message: `${conditional.length} barra(s) declaran sólo tracción o sólo compresión, pero el análisis de segundo orden las ha resuelto como barras ordinarias.`,
      suggestedFix: 'Vuelve al análisis de primer orden para que la restricción de signo se aplique, o retírala de esas barras si el modelo no la necesita.',
    }],
  };
};
