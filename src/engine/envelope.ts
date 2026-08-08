import type { AnalysisResult, DiagramQuantity, DiagramSegment, LoadCombination, ProjectModel, ReliabilityLevel } from '../types';
import { evaluatePolynomial, rootsInInterval } from './diagram';
import { isTrustedForCombination, resolveReliability, worstLevel } from './reliability';
import { analyzeProject } from './solver';

export interface AnalysisScenario {
  id: string;
  name: string;
  kind: 'case' | 'combination';
  result: AnalysisResult;
  /** Reliability level of `result`; `failed` means there is nothing to read. */
  status: ReliabilityLevel;
  usable: boolean;
  /** Why the scenario cannot feed an envelope; absent when it can. */
  failureReason?: string;
}

export interface ScenarioExclusion {
  scenarioId: string;
  scenarioName: string;
  status: ReliabilityLevel;
  reason: string;
}

export interface ScenarioSelection {
  included: AnalysisScenario[];
  excluded: ScenarioExclusion[];
}

/** Fields every envelope publishes so a missing scenario can never pass unnoticed. */
export interface EnvelopeCoverage {
  /** True only when every requested scenario contributed. */
  complete: boolean;
  includedScenarioIds: string[];
  excludedScenarios: ScenarioExclusion[];
  /** Worst reliability level among the contributing scenarios. */
  level: ReliabilityLevel;
}

export interface EnvelopeBranch {
  scenarioId: string;
  scenarioName: string;
  coefficients: [number, number, number, number];
}

export interface EnvelopeSegment {
  x0: number;
  x1: number;
  minimum: EnvelopeBranch;
  maximum: EnvelopeBranch;
}

export interface EnvelopeExtreme {
  x: number;
  value: number;
  scenarioId: string;
  scenarioName: string;
  /** Which lateral limit governs when the extremum sits on a discontinuity. */
  side: 'left' | 'right' | 'continuous';
}

export interface DiagramEnvelope extends EnvelopeCoverage {
  memberId: string;
  quantity: DiagramQuantity;
  segments: EnvelopeSegment[];
  minimum: EnvelopeExtreme;
  maximum: EnvelopeExtreme;
}

/**
 * Splits the requested scenarios into the ones that may build an envelope and
 * the ones that may not, keeping the cause of every exclusion.
 */
export const selectEnvelopeScenarios = (scenarios: readonly AnalysisScenario[]): ScenarioSelection => {
  const included: AnalysisScenario[] = [];
  const excluded: ScenarioExclusion[] = [];
  for (const scenario of scenarios) {
    if (scenario.usable && isTrustedForCombination(scenario.status)) {
      included.push(scenario);
      continue;
    }
    excluded.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: scenario.status,
      reason: scenario.failureReason ?? 'El escenario no produjo un resultado confiable.',
    });
  }
  return { included, excluded };
};

const coverageOf = (selection: ScenarioSelection): EnvelopeCoverage => ({
  complete: selection.excluded.length === 0,
  includedScenarioIds: selection.included.map((scenario) => scenario.id),
  excludedScenarios: selection.excluded,
  level: selection.included.length
    ? worstLevel(...selection.included.map((scenario) => scenario.status))
    : 'failed',
});

export const envelopeCoverage = coverageOf;

const coefficientsOf = (segment: DiagramSegment, quantity: DiagramQuantity): [number, number, number, number] => {
  const source = segment[quantity];
  return [source[0], source[1], source[2], source[3] ?? 0];
};

const shiftPolynomial = (coefficients: readonly number[], distance: number): [number, number, number, number] => {
  const [c0 = 0, c1 = 0, c2 = 0, c3 = 0] = coefficients;
  return [
    c0 + c1 * distance + c2 * distance ** 2 + c3 * distance ** 3,
    c1 + 2 * c2 * distance + 3 * c3 * distance ** 2,
    c2 + 3 * c3 * distance,
    c3,
  ];
};

const uniqueSorted = (values: number[], tolerance: number) => values.sort((a, b) => a - b).filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]) > tolerance);

/**
 * Analyses every requested load case and combination.
 *
 * All of them are returned, including the ones that failed or came out
 * unreliable: dropping a scenario here would silently narrow the set the user
 * asked for, and an envelope built on the survivors would look complete.
 */
export const analyzeProjectScenarios = (project: ProjectModel): AnalysisScenario[] => {
  const requested = [
    ...project.loadCases.map((loadCase) => ({
      id: `case:${loadCase.id}`,
      name: loadCase.name,
      kind: 'case' as const,
      combination: { id: `case:${loadCase.id}`, name: loadCase.name, factors: { [loadCase.id]: 1 } } satisfies LoadCombination,
    })),
    ...project.combinations.map((combination) => ({
      id: `combination:${combination.id}`,
      name: combination.name,
      kind: 'combination' as const,
      combination,
    })),
  ];
  return requested.map(({ combination, ...scenario }) => {
    // No scenario/envelope consumer ever reads `.educationTrace` — only the
    // single "Aprender" tab on the primary analysis does, and it fetches its
    // own trace on demand (see ProjectContext.ensureEducationTrace).
    const result = analyzeProject(project, combination, { includeEducationTrace: false });
    const reliability = resolveReliability(result);
    const trusted = reliability.usable && isTrustedForCombination(reliability.level);
    return {
      ...scenario,
      result,
      status: reliability.level,
      usable: reliability.usable,
      failureReason: trusted
        ? undefined
        : reliability.reasons[0] ?? 'El escenario no produjo un resultado confiable.',
    };
  });
};

export const buildDiagramEnvelope = (
  scenarios: AnalysisScenario[],
  memberId: string,
  quantity: DiagramQuantity,
): DiagramEnvelope | null => {
  const selection = selectEnvelopeScenarios(scenarios);
  const coverage = coverageOf(selection);
  const source = selection.included.flatMap((scenario) => {
    const member = scenario.result.memberResults.find((result) => result.memberId === memberId);
    return member ? [{ scenario, member }] : [];
  });
  if (!source.length) return null;
  const length = source[0].member.length;
  const tolerance = Math.max(1, length) * 1e-10;
  const breakpoints = uniqueSorted(source.flatMap(({ member }) => member.diagramSegments.flatMap((segment) => [segment.x0, segment.x1])), tolerance);
  const output: EnvelopeSegment[] = [];

  for (let interval = 0; interval < breakpoints.length - 1; interval += 1) {
    const x0 = breakpoints[interval];
    const x1 = breakpoints[interval + 1];
    const h = x1 - x0;
    if (h <= tolerance) continue;
    const midpoint = (x0 + x1) / 2;
    const candidates = source.flatMap(({ scenario, member }) => {
      const segment = member.diagramSegments.find((item) => midpoint >= item.x0 - tolerance && midpoint <= item.x1 + tolerance);
      return segment ? [{ scenario, coefficients: shiftPolynomial(coefficientsOf(segment, quantity), x0 - segment.x0) }] : [];
    });
    const crossings: number[] = [];
    for (let a = 0; a < candidates.length; a += 1) {
      for (let b = a + 1; b < candidates.length; b += 1) {
        const difference = candidates[a].coefficients.map((value, index) => value - candidates[b].coefficients[index]);
        crossings.push(...rootsInInterval(difference, h));
      }
    }
    const localBreaks = uniqueSorted([0, ...crossings, h], tolerance);
    for (let part = 0; part < localBreaks.length - 1; part += 1) {
      const local0 = localBreaks[part];
      const local1 = localBreaks[part + 1];
      if (local1 - local0 <= tolerance) continue;
      const probe = (local0 + local1) / 2;
      const ranked = candidates.map((candidate) => ({ candidate, value: evaluatePolynomial(candidate.coefficients, probe) })).sort((a, b) => a.value - b.value);
      const minimum = ranked[0].candidate;
      const maximum = ranked.at(-1)!.candidate;
      output.push({
        x0: x0 + local0,
        x1: x0 + local1,
        minimum: { scenarioId: minimum.scenario.id, scenarioName: minimum.scenario.name, coefficients: shiftPolynomial(minimum.coefficients, local0) },
        maximum: { scenarioId: maximum.scenario.id, scenarioName: maximum.scenario.name, coefficients: shiftPolynomial(maximum.coefficients, local0) },
      });
    }
  }

  // Each envelope segment is evaluated at both of its own ends, so a point load
  // or a concentrated moment contributes its left and its right limit; neither
  // side can be lost when the governing scenario is chosen.
  const extrema = output.flatMap((segment, index) => {
    const h = segment.x1 - segment.x0;
    return (['minimum', 'maximum'] as const).flatMap((branch) => {
      const item = segment[branch];
      const derivative = item.coefficients.slice(1).map((coefficient, degree) => coefficient * (degree + 1));
      return [0, h, ...rootsInInterval(derivative, h)].map((x): EnvelopeExtreme => ({
        x: segment.x0 + x,
        value: evaluatePolynomial(item.coefficients, x),
        scenarioId: item.scenarioId,
        scenarioName: item.scenarioName,
        side: x <= 0 && index > 0 ? 'right' : x >= h && index < output.length - 1 ? 'left' : 'continuous',
      }));
    });
  });
  if (!extrema.length) return null;
  return {
    ...coverage,
    memberId,
    quantity,
    segments: output,
    minimum: extrema.reduce((best, point) => point.value < best.value ? point : best),
    maximum: extrema.reduce((best, point) => point.value > best.value ? point : best),
  };
};

/**
 * Evaluates one lateral limit of the envelope. At a discontinuity the two sides
 * are different numbers, so the caller must be able to ask for either.
 */
export const evaluateEnvelopeAt = (
  envelope: DiagramEnvelope,
  x: number,
  side: 'left' | 'right' = 'right',
) => {
  if (!envelope.segments.length) return null;
  const span = envelope.segments.at(-1)!.x1 - envelope.segments[0].x0;
  const tolerance = Math.max(1, span) * 1e-10;
  let segment = envelope.segments.find((item) => x > item.x0 + tolerance && x < item.x1 - tolerance);
  if (!segment) {
    segment = side === 'left'
      ? [...envelope.segments].reverse().find((item) => Math.abs(item.x1 - x) <= tolerance) ?? envelope.segments[0]
      : envelope.segments.find((item) => Math.abs(item.x0 - x) <= tolerance) ?? envelope.segments.at(-1)!;
  }
  const xi = Math.max(0, Math.min(segment.x1 - segment.x0, x - segment.x0));
  return {
    x: segment.x0 + xi,
    side,
    minimum: evaluatePolynomial(segment.minimum.coefficients, xi),
    maximum: evaluatePolynomial(segment.maximum.coefficients, xi),
    minimumScenarioId: segment.minimum.scenarioId,
    minimumScenario: segment.minimum.scenarioName,
    maximumScenarioId: segment.maximum.scenarioId,
    maximumScenario: segment.maximum.scenarioName,
  };
};
