import type {
  AnalysisResult,
  DeformationSegment,
  DiagramQuantity,
  DiagramSegment,
  ResponseQuantity,
} from '../types';
import { evaluatePolynomial, rootsInInterval } from './diagram';
import { selectEnvelopeScenarios, type AnalysisScenario, type EnvelopeCoverage } from './envelope';
import { worstLevel } from './reliability';

export interface ExactExtremum<Q extends string> {
  quantity: Q;
  kind: 'minimum' | 'maximum';
  memberId: string;
  x: number;
  value: number;
  /** Which lateral limit the extremum belongs to at a discontinuity. */
  side: 'left' | 'right' | 'continuous';
}

export interface ExactExtrema<Q extends string> {
  minimum: ExactExtremum<Q>;
  maximum: ExactExtremum<Q>;
  absolute: ExactExtremum<Q>;
}

export interface MemberResultSummary {
  memberId: string;
  diagrams: Record<DiagramQuantity, ExactExtrema<DiagramQuantity>>;
  deformations: Partial<Record<ResponseQuantity, ExactExtrema<ResponseQuantity>>>;
}

export interface GlobalResultSummary {
  members: MemberResultSummary[];
  diagrams: Partial<Record<DiagramQuantity, ExactExtrema<DiagramQuantity>>>;
  deformations: Partial<Record<ResponseQuantity, ExactExtrema<ResponseQuantity>>>;
}

export interface ScenarioValue {
  value: number;
  scenarioId: string;
  scenarioName: string;
}

export interface ScalarEnvelope {
  minimum: ScenarioValue;
  maximum: ScenarioValue;
}

export type ReactionComponent = 'rx' | 'ry' | 'rm' | 'supportNormalReaction' | 'supportTangentialReaction';

export interface NodeReactionEnvelope {
  nodeId: string;
  components: Partial<Record<ReactionComponent, ScalarEnvelope>>;
  /** True only if every contributing scenario reported this node. */
  complete: boolean;
}

export interface ReactionEnvelope extends EnvelopeCoverage {
  nodes: NodeReactionEnvelope[];
}

export interface ResponseEnvelopeBranch {
  scenarioId: string;
  scenarioName: string;
  /** Coefficients use the local coordinate xi = x - segment.x0. */
  coefficients: number[];
}

export interface ResponseEnvelopeSegment {
  x0: number;
  x1: number;
  minimum: ResponseEnvelopeBranch;
  maximum: ResponseEnvelopeBranch;
}

export interface DeformationEnvelope extends EnvelopeCoverage {
  memberId: string;
  quantity: ResponseQuantity;
  segments: ResponseEnvelopeSegment[];
  minimum: ExactExtremum<ResponseQuantity> & Pick<ScenarioValue, 'scenarioId' | 'scenarioName'>;
  maximum: ExactExtremum<ResponseQuantity> & Pick<ScenarioValue, 'scenarioId' | 'scenarioName'>;
}

const DIAGRAM_QUANTITIES: DiagramQuantity[] = ['axial', 'shear', 'moment'];
const RESPONSE_QUANTITIES: ResponseQuantity[] = ['u', 'v', 'theta'];
const REACTION_COMPONENTS: ReactionComponent[] = ['rx', 'ry', 'rm', 'supportNormalReaction', 'supportTangentialReaction'];

const derivative = (coefficients: readonly number[]): number[] => coefficients.slice(1).map((value, index) => value * (index + 1));

/**
 * Marks a station that sits on a discontinuity with the side it belongs to.
 * Both limits of a point load or a concentrated moment are real states of the
 * member, so both take part in the extrema; the label says which one governs.
 */
const stationSide = (
  segments: Array<{ x0: number; x1: number; coefficients: readonly number[] }>,
  index: number,
  xi: number,
  length: number,
  value: number,
): 'left' | 'right' | 'continuous' => {
  const differs = (neighbour: number) =>
    Math.abs(neighbour - value) > 1e-9 * Math.max(1, Math.abs(neighbour), Math.abs(value));
  if (xi <= 0 && index > 0) {
    const previous = segments[index - 1];
    return differs(evaluatePolynomial(previous.coefficients, previous.x1 - previous.x0)) ? 'right' : 'continuous';
  }
  if (xi >= length && index < segments.length - 1) {
    return differs(evaluatePolynomial(segments[index + 1].coefficients, 0)) ? 'left' : 'continuous';
  }
  return 'continuous';
};

const extremaFromSegments = <Q extends string>(
  memberId: string,
  quantity: Q,
  segments: Array<{ x0: number; x1: number; coefficients: readonly number[] }>,
): ExactExtrema<Q> | null => {
  const candidates = segments.flatMap((segment, index) => {
    const length = segment.x1 - segment.x0;
    if (!(length >= 0) || segment.coefficients.some((value) => !Number.isFinite(value))) return [];
    const stations = length > 0 ? [0, length, ...rootsInInterval(derivative(segment.coefficients), length)] : [0];
    return stations.map((xi) => {
      const value = evaluatePolynomial(segment.coefficients, xi);
      return {
        memberId,
        quantity,
        x: segment.x0 + xi,
        value,
        side: stationSide(segments, index, xi, length, value),
      };
    });
  });
  if (!candidates.length) return null;
  const minimumPoint = candidates.reduce((best, point) => point.value < best.value ? point : best);
  const maximumPoint = candidates.reduce((best, point) => point.value > best.value ? point : best);
  const minimum: ExactExtremum<Q> = { ...minimumPoint, kind: 'minimum' };
  const maximum: ExactExtremum<Q> = { ...maximumPoint, kind: 'maximum' };
  return {
    minimum,
    maximum,
    absolute: Math.abs(minimum.value) > Math.abs(maximum.value) ? minimum : maximum,
  };
};

const diagramCoefficients = (segment: DiagramSegment, quantity: DiagramQuantity): readonly number[] => segment[quantity];
const deformationCoefficients = (segment: DeformationSegment, quantity: ResponseQuantity): readonly number[] => segment[quantity];

const summarizeMember = (result: AnalysisResult['memberResults'][number]): MemberResultSummary => {
  const diagrams = Object.fromEntries(DIAGRAM_QUANTITIES.map((quantity) => {
    const extrema = extremaFromSegments(result.memberId, quantity, result.diagramSegments.map((segment) => ({
      x0: segment.x0,
      x1: segment.x1,
      coefficients: diagramCoefficients(segment, quantity),
    })));
    // Successful analysis members always own at least one diagram segment.
    if (!extrema) throw new Error(`El miembro ${result.memberId} no contiene segmentos de ${quantity}.`);
    return [quantity, extrema];
  })) as Record<DiagramQuantity, ExactExtrema<DiagramQuantity>>;
  const deformations = Object.fromEntries(RESPONSE_QUANTITIES.flatMap((quantity) => {
    const extrema = extremaFromSegments(result.memberId, quantity, result.deformationSegments.map((segment) => ({
      x0: segment.x0,
      x1: segment.x1,
      coefficients: deformationCoefficients(segment, quantity),
    })));
    return extrema ? [[quantity, extrema]] : [];
  })) as Partial<Record<ResponseQuantity, ExactExtrema<ResponseQuantity>>>;
  return { memberId: result.memberId, diagrams, deformations };
};

const globalExtrema = <Q extends string>(items: ExactExtrema<Q>[]): ExactExtrema<Q> | undefined => {
  if (!items.length) return undefined;
  const minimum = items.reduce((best, item) => item.minimum.value < best.minimum.value ? item : best).minimum;
  const maximum = items.reduce((best, item) => item.maximum.value > best.maximum.value ? item : best).maximum;
  return { minimum, maximum, absolute: Math.abs(minimum.value) > Math.abs(maximum.value) ? minimum : maximum };
};

/** Builds exact member and model extrema directly from the stored polynomial fields. */
export const summarizeAnalysisResults = (analysis: AnalysisResult): GlobalResultSummary => {
  const members = analysis.memberResults.filter((result) => result.diagramSegments.length > 0).map(summarizeMember);
  const diagrams = Object.fromEntries(DIAGRAM_QUANTITIES.flatMap((quantity) => {
    const extrema = globalExtrema(members.map((member) => member.diagrams[quantity]));
    return extrema ? [[quantity, extrema]] : [];
  })) as Partial<Record<DiagramQuantity, ExactExtrema<DiagramQuantity>>>;
  const deformations = Object.fromEntries(RESPONSE_QUANTITIES.flatMap((quantity) => {
    const extrema = globalExtrema(members.flatMap((member) => member.deformations[quantity] ? [member.deformations[quantity]!] : []));
    return extrema ? [[quantity, extrema]] : [];
  })) as Partial<Record<ResponseQuantity, ExactExtrema<ResponseQuantity>>>;
  return { members, diagrams, deformations };
};

/**
 * Reduces every available nodal reaction component and preserves governing
 * scenario identity. Only trusted scenarios contribute, and the coverage fields
 * state which requested scenarios were left out and why.
 */
export const buildReactionEnvelope = (scenarios: AnalysisScenario[]): ReactionEnvelope => {
  const selection = selectEnvelopeScenarios(scenarios);
  const contributing = selection.included;
  const nodeIds: string[] = [];
  const seen = new Set<string>();
  for (const scenario of contributing) for (const node of scenario.result.nodeResults) {
    if (!seen.has(node.nodeId)) { seen.add(node.nodeId); nodeIds.push(node.nodeId); }
  }
  // Every scenario of one project reports every project node, so this gap
  // cannot occur through analyzeProjectScenarios. It guards a caller that
  // assembles AnalysisScenario[] by hand from mismatched projects: without it,
  // a node missing from one included scenario would silently reduce that node's
  // envelope to whichever scenarios happened to report it, while `complete`
  // stayed true because scenario selection itself was complete.
  const nodes = nodeIds.map((nodeId) => {
    const reportingScenarios = contributing.filter((scenario) =>
      scenario.result.nodeResults.some((node) => node.nodeId === nodeId));
    const components = Object.fromEntries(REACTION_COMPONENTS.flatMap((component) => {
      const values = reportingScenarios.flatMap((scenario) => {
        const node = scenario.result.nodeResults.find((item) => item.nodeId === nodeId);
        const value = node?.[component];
        return typeof value === 'number' && Number.isFinite(value)
          ? [{ value, scenarioId: scenario.id, scenarioName: scenario.name }]
          : [];
      });
      if (!values.length) return [];
      return [[component, {
        minimum: values.reduce((best, item) => item.value < best.value ? item : best),
        maximum: values.reduce((best, item) => item.value > best.value ? item : best),
      } satisfies ScalarEnvelope]];
    })) as Partial<Record<ReactionComponent, ScalarEnvelope>>;
    return { nodeId, components, complete: reportingScenarios.length === contributing.length };
  });
  const coverage: EnvelopeCoverage = {
    complete: selection.excluded.length === 0 && nodes.every((node) => node.complete),
    includedScenarioIds: contributing.map((scenario) => scenario.id),
    excludedScenarios: selection.excluded,
    level: contributing.length ? worstLevel(...contributing.map((scenario) => scenario.status)) : 'failed',
  };
  return { ...coverage, nodes };
};

const binomial = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  let value = 1;
  for (let index = 1; index <= Math.min(k, n - k); index += 1) value = value * (n - index + 1) / index;
  return value;
};

/** Re-expands p(x) as p(x + distance), preserving arbitrary practical degree. */
const shiftPolynomial = (coefficients: readonly number[], distance: number): number[] => coefficients.map((_, outputDegree) =>
  coefficients.slice(outputDegree).reduce((sum, coefficient, sourceOffset) => {
    const sourceDegree = sourceOffset + outputDegree;
    return sum + coefficient * binomial(sourceDegree, outputDegree) * distance ** (sourceDegree - outputDegree);
  }, 0));

const uniqueSorted = (values: number[], tolerance: number): number[] => [...values]
  .sort((a, b) => a - b)
  .filter((value, index, sorted) => index === 0 || Math.abs(value - sorted[index - 1]) > tolerance);

/** Builds an exact piecewise envelope of u, v or theta across all successful scenarios. */
export const buildDeformationEnvelope = (
  scenarios: AnalysisScenario[],
  memberId: string,
  quantity: ResponseQuantity,
): DeformationEnvelope | null => {
  const selection = selectEnvelopeScenarios(scenarios);
  const coverage: EnvelopeCoverage = {
    complete: selection.excluded.length === 0,
    includedScenarioIds: selection.included.map((scenario) => scenario.id),
    excludedScenarios: selection.excluded,
    level: selection.included.length ? worstLevel(...selection.included.map((scenario) => scenario.status)) : 'failed',
  };
  const source = selection.included.flatMap((scenario) => {
    const member = scenario.result.memberResults.find((result) => result.memberId === memberId);
    return member?.deformationSegments.length ? [{ scenario, member }] : [];
  });
  if (!source.length) return null;
  const length = source[0].member.length;
  const tolerance = Math.max(1, length) * 1e-10;
  const breakpoints = uniqueSorted(source.flatMap(({ member }) => member.deformationSegments.flatMap((segment) => [segment.x0, segment.x1])), tolerance);
  const segments: ResponseEnvelopeSegment[] = [];

  for (let interval = 0; interval < breakpoints.length - 1; interval += 1) {
    const x0 = breakpoints[interval];
    const x1 = breakpoints[interval + 1];
    const lengthOfInterval = x1 - x0;
    if (lengthOfInterval <= tolerance) continue;
    const probe = 0.5 * (x0 + x1);
    const candidates = source.flatMap(({ scenario, member }) => {
      const segment = member.deformationSegments.find((item) => probe >= item.x0 - tolerance && probe <= item.x1 + tolerance);
      return segment ? [{ scenario, coefficients: shiftPolynomial(deformationCoefficients(segment, quantity), x0 - segment.x0) }] : [];
    });
    const crossings: number[] = [];
    for (let a = 0; a < candidates.length; a += 1) for (let b = a + 1; b < candidates.length; b += 1) {
      const degree = Math.max(candidates[a].coefficients.length, candidates[b].coefficients.length);
      const difference = Array.from({ length: degree }, (_, index) => (candidates[a].coefficients[index] ?? 0) - (candidates[b].coefficients[index] ?? 0));
      crossings.push(...rootsInInterval(difference, lengthOfInterval));
    }
    const localBreaks = uniqueSorted([0, ...crossings, lengthOfInterval], tolerance);
    for (let part = 0; part < localBreaks.length - 1; part += 1) {
      const local0 = localBreaks[part];
      const local1 = localBreaks[part + 1];
      if (local1 - local0 <= tolerance || !candidates.length) continue;
      const sample = 0.5 * (local0 + local1);
      const ranked = candidates
        .map((candidate) => ({ candidate, value: evaluatePolynomial(candidate.coefficients, sample) }))
        .sort((a, b) => a.value - b.value);
      const minimum = ranked[0].candidate;
      const maximum = ranked.at(-1)!.candidate;
      segments.push({
        x0: x0 + local0,
        x1: x0 + local1,
        minimum: { scenarioId: minimum.scenario.id, scenarioName: minimum.scenario.name, coefficients: shiftPolynomial(minimum.coefficients, local0) },
        maximum: { scenarioId: maximum.scenario.id, scenarioName: maximum.scenario.name, coefficients: shiftPolynomial(maximum.coefficients, local0) },
      });
    }
  }

  const extrema = segments.flatMap((segment, index) => (['minimum', 'maximum'] as const).flatMap((branch) => {
    const item = segment[branch];
    const lengthOfSegment = segment.x1 - segment.x0;
    return [0, lengthOfSegment, ...rootsInInterval(derivative(item.coefficients), lengthOfSegment)].map((xi) => ({
      memberId,
      quantity,
      x: segment.x0 + xi,
      value: evaluatePolynomial(item.coefficients, xi),
      scenarioId: item.scenarioId,
      scenarioName: item.scenarioName,
      side: xi <= 0 && index > 0
        ? 'right' as const
        : xi >= lengthOfSegment && index < segments.length - 1 ? 'left' as const : 'continuous' as const,
    }));
  }));
  if (!extrema.length) return null;
  const minimumPoint = extrema.reduce((best, point) => point.value < best.value ? point : best);
  const maximumPoint = extrema.reduce((best, point) => point.value > best.value ? point : best);
  return {
    ...coverage,
    memberId,
    quantity,
    segments,
    minimum: { ...minimumPoint, kind: 'minimum' },
    maximum: { ...maximumPoint, kind: 'maximum' },
  };
};

export const evaluateDeformationEnvelopeAt = (
  envelope: DeformationEnvelope,
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
