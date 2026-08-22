import type {
  AnalysisResult,
  NumericQualityState,
  ReliabilityCheck,
  ReliabilityCheckId,
  ReliabilityLevel,
  ResultReliability,
} from '../types';

export type { NumericQualityState, ReliabilityCheck, ReliabilityCheckId, ReliabilityLevel, ResultReliability };

const LEVEL_ORDER: Record<ReliabilityLevel, number> = {
  reliable: 0,
  limited: 1,
  unreliable: 2,
  failed: 3,
};

export const worstLevel = (...levels: ReliabilityLevel[]): ReliabilityLevel =>
  levels.reduce<ReliabilityLevel>((worst, level) => LEVEL_ORDER[level] > LEVEL_ORDER[worst] ? level : worst, 'reliable');

/**
 * A result that may take part in envelopes, governing-case selection and
 * exports. `unreliable` and `failed` are deliberately excluded: they can be
 * shown with their cause, but never consumed as an ordinary result.
 */
export const isTrustedForCombination = (level: ReliabilityLevel): boolean =>
  level === 'reliable' || level === 'limited';

interface CheckDefinition {
  id: ReliabilityCheckId;
  label: string;
  limitedAbove: number;
  unreliableAbove: number;
  value: number | undefined;
  /**
   * A required check must carry a finite value on any completed run: without it
   * the size of the error cannot be bounded at all, so the result is unreliable.
   * An optional check simply does not apply to every model — a project without
   * deformable members has no diagram closure — and its absence is not evidence
   * of a defect.
   */
  required: boolean;
  /** Overrides the generic threshold prose for checks that are not a magnitude. */
  describe?: (level: ReliabilityLevel) => string;
}

const classifyValue = (definition: CheckDefinition): ReliabilityCheck => {
  const { id, label, limitedAbove, unreliableAbove, value, required, describe } = definition;
  if (value === undefined || !Number.isFinite(value)) {
    return {
      id,
      label,
      value: Number.NaN,
      limitedAbove,
      unreliableAbove,
      level: required ? 'unreliable' : 'reliable',
      message: required
        ? `${label}: el solver no reportó un valor finito, la magnitud del error no puede acotarse.`
        : `${label}: no aplicable a este resultado.`,
    };
  }
  const level: ReliabilityLevel = value > unreliableAbove
    ? 'unreliable'
    : value > limitedAbove ? 'limited' : 'reliable';
  const message = describe
    ? describe(level)
    : level === 'reliable'
      ? `${label}: ${value.toExponential(3)} dentro del margen aceptable (≤ ${limitedAbove.toExponential(0)}).`
      : `${label}: ${value.toExponential(3)} supera ${(level === 'unreliable' ? unreliableAbove : limitedAbove).toExponential(0)}.`;
  return { id, label, value, limitedAbove, unreliableAbove, level, message };
};

/** Largest relative N-V-M closure error across the members of one result. */
const maxDiagramClosure = (result: AnalysisResult): number | undefined => {
  const values = result.memberResults
    .map((member) => member.endCompatibilityError)
    .filter((value): value is number => typeof value === 'number');
  return values.length ? Math.max(...values) : undefined;
};

const maxCompatibility = (result: AnalysisResult): number | undefined => {
  const values = result.memberResults
    .map((member) => member.compatibilityError)
    .filter((value): value is number => typeof value === 'number');
  return values.length ? Math.max(...values) : undefined;
};

/**
 * Thresholds mirror the warning and error limits already applied by the solver,
 * so a classification never contradicts the issue list it is derived from.
 */
const buildChecks = (result: AnalysisResult): ReliabilityCheck[] => {
  const refinementExhausted = (result.refinementIterations ?? 0) >= 3
    && (result.linearResidual ?? 0) > 5e-15;
  // A P-Delta run correctly carries a first-order-undeformed-geometry
  // "equilibrium residual" proportional to its own P·Δ moment — the
  // first-order 'equilibrium' check below would punish exactly the effect
  // the analysis was asked to compute, so it is skipped in favor of the
  // P-Delta-specific convergence check that follows it.
  const pDelta = result.pDelta;
  const definitions: CheckDefinition[] = [
    {
      id: 'condition', label: 'Condición κ₁ del sistema equilibrado',
      limitedAbove: 1e10, unreliableAbove: 1e12, value: result.conditionEstimate, required: true,
    },
    {
      id: 'backward-error', label: 'Residuo relativo del sistema lineal',
      limitedAbove: 1e-12, unreliableAbove: 1e-8, value: result.linearResidual, required: true,
    },
    {
      id: 'forward-error', label: 'Cota de error hacia adelante',
      limitedAbove: 1e-9, unreliableAbove: 1e-4, value: result.forwardErrorBound, required: true,
    },
    {
      // A boolean condition mapped onto the same scale: 1 means the refinement
      // budget was exhausted without reaching its own residual target.
      id: 'refinement', label: 'Refinamiento iterativo',
      limitedAbove: 0, unreliableAbove: Number.POSITIVE_INFINITY,
      value: refinementExhausted ? 1 : 0, required: false,
      describe: (level) => level === 'reliable'
        ? 'Refinamiento iterativo: alcanzó su residuo objetivo.'
        : 'Refinamiento iterativo: agotó sus iteraciones sin alcanzar el residuo objetivo 5e-15.',
    },
    {
      id: 'structural-residual', label: 'Residuo de equilibrio algebraico',
      limitedAbove: 1e-9, unreliableAbove: 1e-7, value: result.residualNorm, required: true,
    },
    {
      id: 'constraints', label: 'Compatibilidad de restricciones C·U−g',
      limitedAbove: 1e-9, unreliableAbove: 1e-6, value: result.constraintResidual, required: false,
    },
    {
      id: 'equilibrium', label: 'Equilibrio físico global',
      limitedAbove: 1e-8, unreliableAbove: 1e-6,
      value: pDelta?.enabled ? undefined : result.equilibrium?.normalizedResidual,
      required: !pDelta?.enabled,
    },
    {
      id: 'load-audit', label: 'Auditoría independiente de cargas',
      limitedAbove: 1e-10, unreliableAbove: 1e-8,
      value: pDelta?.enabled ? undefined : result.loadAudit?.normalizedResidual, required: false,
    },
    {
      id: 'diagram-closure', label: 'Cierre N–V–M de los diagramas',
      limitedAbove: 1e-9, unreliableAbove: 1e-7,
      value: pDelta?.enabled ? undefined : maxDiagramClosure(result), required: false,
    },
    {
      // Value 1 flags that the converged P-Delta state is already close to a
      // critical (buckling) load; the 'condition' check above independently
      // catches the resulting ill-conditioning, so this only needs to reach
      // 'limited', never re-derive 'unreliable' on its own.
      id: 'p-delta-convergence', label: 'Proximidad a la carga crítica (P-Delta)',
      limitedAbove: 0, unreliableAbove: Number.POSITIVE_INFINITY,
      value: pDelta?.enabled ? (pDelta.stabilityWarning ? 1 : 0) : undefined, required: false,
      describe: (level) => level === 'reliable'
        ? 'Convergencia P-Delta: sin proximidad detectada a una carga crítica.'
        : `Convergencia P-Delta: ${pDelta?.stabilityWarning ?? 'cerca de una carga crítica de pandeo.'}`,
    },
    {
      id: 'compatibility', label: 'Compatibilidad de la deformada',
      limitedAbove: 1e-9, unreliableAbove: 1e-7,
      value: pDelta?.enabled ? undefined : maxCompatibility(result), required: false,
    },
  ];
  return definitions.map(classifyValue);
};

/**
 * Classifies one analysis.
 *
 * `success === true` is a necessary condition, never a sufficient one: every
 * numeric check must also stay inside its own limit. The three questions the
 * caller may need are answered separately — did the computation finish, are
 * there results to read, and how much of them may be trusted.
 */
export const classifyAnalysisReliability = (result: AnalysisResult): ResultReliability => {
  const completed = result.displacements.length > 0;
  const usable = completed && result.nodeResults.length > 0;
  if (!usable) {
    const errors = result.issues.filter((issue) => issue.severity === 'error');
    return {
      completed,
      usable: false,
      level: 'failed',
      checks: [],
      reasons: errors.length
        ? errors.map((issue) => `${issue.title}: ${issue.message}`)
        : ['El análisis no produjo resultados nodales.'],
    };
  }

  const checks = buildChecks(result);
  const numericLevel = worstLevel(...checks.map((check) => check.level));
  // An error-severity issue on a run that still produced numbers means the
  // numbers exist but must never be consumed as an ordinary result.
  const level = result.success ? numericLevel : worstLevel(numericLevel, 'unreliable');
  const offending = checks
    .filter((check) => check.level !== 'reliable')
    .sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]);
  return {
    completed,
    usable: true,
    level,
    checks,
    governing: offending[0],
    reasons: [
      ...result.issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.title}: ${issue.message}`),
      ...offending.map((check) => check.message),
    ],
  };
};

/** Returns the stored classification, or derives it for results built elsewhere. */
export const resolveReliability = (result: AnalysisResult): ResultReliability =>
  result.reliability ?? classifyAnalysisReliability(result);

/**
 * Maps the engine contract to the five presentation states used by results and
 * exports. This is deliberately a numerical-quality state, never a structural
 * safety or probabilistic reliability classification.
 */
export const resolveNumericQualityState = (
  result?: AnalysisResult | null,
): NumericQualityState => {
  if (!result) return 'unavailable';
  const reliability = resolveReliability(result);
  if (reliability.level === 'failed' || !reliability.usable) return 'failed';
  if (reliability.level === 'reliable') return 'stable';
  if (reliability.level === 'limited') return 'limited';
  return 'unreliable';
};
