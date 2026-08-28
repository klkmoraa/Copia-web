/**
 * The Three-Moment Theorem (Clapeyron's Equation), solved for real.
 *
 * Double Integration picks *reactions* as its redundants and finds them from boundary and
 * continuity conditions on the elastic curve. The Three-Moment Theorem picks the bending
 * *moment at each interior support* as the redundant instead, and finds them from a different
 * compatibility statement: the slope each span's simply-supported moment diagram would produce
 * at a shared support, corrected by the (still unknown) support moments on either side of it,
 * has to agree from both spans. Written out per span in terms of the "free" moment area —
 *
 *     (Lₙ/EIₙ)·Mₙ₋₁ + 2(Lₙ/EIₙ + Lₙ₊₁/EIₙ₊₁)·Mₙ + (Lₙ₊₁/EIₙ₊₁)·Mₙ₊₁
 *       = −6·[Aₙaₙ/(EIₙLₙ) + Aₙ₊₁bₙ₊₁/(EIₙ₊₁Lₙ₊₁)]
 *
 * — one equation per interior support, and as many equations as unknowns, because a continuous
 * beam over simple supports has exactly one interior-support moment per interior support.
 *
 * `Aₙaₙ` and `Aₙ₊₁bₙ₊₁` are the first moment (about the left end, and about the right end
 * respectively) of span n's *simple-span* bending moment diagram — the moment that span would
 * carry if it were its own simply supported beam under its own loads, nothing else. That diagram
 * comes from `analyzeProject` on an isolated one-span model, exactly the way Double Integration's
 * `M₀` comes from a released model: nothing here re-derives the statics of a single span, it
 * reads the polynomial the solver already produced and integrates it.
 *
 * The final moment at any point is that same simple-span diagram plus the linear interpolation
 * between the two support moments the theorem found — `M(x) = M_simple(x) + Mₗ(1 − x/L) + Mᵣ(x/L)`
 * — and *that* is checked against the solver's own diagram for the original, unreleased beam.
 * A method that disagreed with the solver would not be a second opinion, it would be a bug, and
 * `threeMoment.test.ts` fails when the gap opens.
 */
import { analyzeProject } from '../engine/solver';
import { solveLinearSystem } from '../engine/math';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel, SupportDefinition } from '../types';
import { add, evaluate, integrate, shift, trim, type Polynomial } from './polynomialAlgebra';
import { buildBeamAxis, type BeamAxis } from './beamAxis';
import { classifyStructure, type StructureClassification } from './structureClassification';

export interface ThreeMomentSpan {
  spanIndex: number;
  leftNodeId: string;
  rightNodeId: string;
  length: number;
  EI: number;
  /** `Aₙ·aₙ`: first moment of the simple-span moment diagram about the left end. */
  firstMomentLeft: number;
  /** `Aₙ·bₙ`: first moment about the right end. */
  firstMomentRight: number;
}

export interface SupportMomentSolution {
  nodeId: string;
  symbol: string;
  /** Value this method arrives at, kN·m. */
  value: number;
  /** What the solver reports at the same station, for the reader to compare. */
  solverMoment: number;
}

export interface ThreeMomentNarratedSegment {
  x0: number;
  x1: number;
  EI: number;
  /** Final moment, `M_simple(x) + Mₗ(1 − x/L) + Mᵣ(x/L)`, in the global coordinate. */
  moment: number[];
}

export interface ThreeMomentResult {
  applicable: true;
  classification: StructureClassification;
  axis: BeamAxis;
  spans: ThreeMomentSpan[];
  supportMoments: SupportMomentSolution[];
  segments: ThreeMomentNarratedSegment[];
  /** Largest gap between a solved support moment and the solver's moment there, kN·m. */
  momentResidual: number;
}

export interface ThreeMomentRejection {
  applicable: false;
  reasonKey: string;
}

export type ThreeMomentOutcome = ThreeMomentResult | ThreeMomentRejection;

const restrainsTransverse = (support: SupportDefinition): boolean => {
  switch (support.type) {
    case 'fixed':
    case 'pin':
      return true;
    case 'roller': {
      const angle = ((support.angleDeg ?? 90) % 180 + 180) % 180;
      return Math.abs(Math.sin((angle * Math.PI) / 180)) > 0.5;
    }
    case 'custom':
      return Boolean(support.restrainY);
    default:
      return false;
  }
};

const restrainsRotation = (support: SupportDefinition): boolean =>
  support.type === 'fixed' || (support.type === 'custom' && Boolean(support.restrainR));

const SUBSCRIPTS = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const subscript = (index: number): string => {
  const number1 = index + 1;
  return number1 <= 9 ? SUBSCRIPTS[number1 - 1] : String(number1).split('').map((digit) => SUBSCRIPTS[Number(digit) - 1] ?? '₀').join('');
};

/** `x · p(x)`: shifts every power up by one, which is all multiplying by the variable does. */
const timesX = (polynomial: Polynomial): number[] => trim([0, ...polynomial]);

/** Definite integral of `polynomial` over `[x0, x1]`. */
const definiteIntegral = (polynomial: Polynomial, x0: number, x1: number): number => {
  const antiderivative = integrate(polynomial);
  return evaluate(antiderivative, x1) - evaluate(antiderivative, x0);
};

/**
 * An isolated, simply-supported sub-beam covering just this span: the nodes, members and loads
 * strictly between (and including) the two support nodes, with every other support released and
 * a nodal load exactly at either end excluded — a load landing on a support goes straight into
 * the reaction there, contributing nothing to that span's own bending.
 */
const buildSpanProject = (project: ProjectModel, axisNodeIds: readonly string[], leftIndex: number, rightIndex: number): ProjectModel => {
  const leftId = axisNodeIds[leftIndex];
  const rightId = axisNodeIds[rightIndex];
  const spanNodeIds = new Set(axisNodeIds.slice(leftIndex, rightIndex + 1));
  const nodes: NodeModel[] = project.nodes
    .filter((node) => spanNodeIds.has(node.id))
    .map((node) => ({
      ...node,
      support: node.id === leftId ? { type: 'pin' } : node.id === rightId ? { type: 'roller', angleDeg: 90 } : { type: 'none' },
    }));
  const members = project.members.filter((member) => spanNodeIds.has(member.i) && spanNodeIds.has(member.j));
  const memberIds = new Set(members.map((member) => member.id));
  return {
    ...project,
    nodes,
    members,
    memberLoads: project.memberLoads.filter((load) => memberIds.has(load.memberId)),
    nodalLoads: project.nodalLoads.filter((load) => spanNodeIds.has(load.nodeId) && load.nodeId !== leftId && load.nodeId !== rightId),
    prescribedDisplacements: [],
  };
};

export const solveThreeMoment = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): ThreeMomentOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'simple-beam' && classification.kind !== 'continuous-beam') {
    return { applicable: false, reasonKey: 'method.rejectedNotBeam' };
  }
  if (classification.indeterminacy < 1) return { applicable: false, reasonKey: 'method.rejectedNoInteriorSupport' };

  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  const axisNodeIds = classification.axisNodeIds;
  if (project.nodes.some((node) => node.internalHinge) || project.members.some((member) => member.releases?.iMoment || member.releases?.jMoment)) {
    return { applicable: false, reasonKey: 'method.rejectedContinuityRequired' };
  }

  const supportIndices = axisNodeIds
    .map((nodeId, index) => ({ nodeId, index }))
    .filter(({ nodeId }) => {
      const node = byId.get(nodeId);
      return node ? restrainsTransverse(node.support) : false;
    });
  if (supportIndices.length < 3) return { applicable: false, reasonKey: 'method.rejectedNoInteriorSupport' };
  if (supportIndices.some(({ nodeId }) => restrainsRotation(byId.get(nodeId)!.support))) {
    return { applicable: false, reasonKey: 'method.rejectedFixedEnd' };
  }

  const referenceAxis = buildBeamAxis(project, analysis, axisNodeIds);
  if (!referenceAxis) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

  const spans: ThreeMomentSpan[] = [];
  const spanAxes: BeamAxis[] = [];
  for (let i = 0; i + 1 < supportIndices.length; i += 1) {
    const leftIndex = supportIndices[i].index;
    const rightIndex = supportIndices[i + 1].index;
    const members = project.members.filter((member) => {
      const iIndex = axisNodeIds.indexOf(member.i);
      const jIndex = axisNodeIds.indexOf(member.j);
      return iIndex >= leftIndex && iIndex <= rightIndex && jIndex >= leftIndex && jIndex <= rightIndex;
    });
    if (!members.length) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const EI = members[0].E * members[0].I;
    if (!(EI > 0) || members.some((member) => Math.abs(member.E * member.I - EI) > Math.max(1, Math.abs(EI)) * 1e-6)) {
      return { applicable: false, reasonKey: 'method.rejectedNonUniformSpanEI' };
    }

    const spanProject = buildSpanProject(project, axisNodeIds, leftIndex, rightIndex);
    const spanAnalysis = analyzeProject(spanProject, combination, { includeEducationTrace: false });
    if (!spanAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const spanAxisNodeIds = axisNodeIds.slice(leftIndex, rightIndex + 1);
    const spanAxis = buildBeamAxis(spanProject, spanAnalysis, spanAxisNodeIds);
    if (!spanAxis) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    spanAxes.push(spanAxis);

    let area = 0;
    let firstMomentLeft = 0;
    for (const segment of spanAxis.segments) {
      area += definiteIntegral(segment.moment, segment.x0, segment.x1);
      firstMomentLeft += definiteIntegral(timesX(segment.moment), segment.x0, segment.x1);
    }
    const length = spanAxis.length;
    spans.push({
      spanIndex: i,
      leftNodeId: supportIndices[i].nodeId,
      rightNodeId: supportIndices[i + 1].nodeId,
      length,
      EI,
      firstMomentLeft,
      firstMomentRight: length * area - firstMomentLeft,
    });
  }

  const interior = supportIndices.length - 2;
  const matrix: number[][] = [];
  const vector: number[] = [];
  for (let k = 0; k < interior; k += 1) {
    const left = spans[k];
    const right = spans[k + 1];
    const row = new Array<number>(interior).fill(0);
    if (k - 1 >= 0) row[k - 1] = left.length / left.EI;
    row[k] = 2 * (left.length / left.EI + right.length / right.EI);
    if (k + 1 < interior) row[k + 1] = right.length / right.EI;
    matrix.push(row);
    vector.push(-6 * (left.firstMomentLeft / (left.EI * left.length) + right.firstMomentRight / (right.EI * right.length)));
  }

  let solution: number[];
  try {
    solution = interior > 0 ? solveLinearSystem(matrix, vector).x : [];
  } catch {
    return { applicable: false, reasonKey: 'method.rejectedSingular' };
  }

  const momentAt = new Map<string, number>();
  momentAt.set(supportIndices[0].nodeId, 0);
  momentAt.set(supportIndices[supportIndices.length - 1].nodeId, 0);
  solution.forEach((value, index) => momentAt.set(supportIndices[index + 1].nodeId, value));

  const supportMoments: SupportMomentSolution[] = supportIndices.map(({ nodeId }, index) => ({
    nodeId,
    symbol: `M${subscript(index)}`,
    value: momentAt.get(nodeId) ?? 0,
    solverMoment: Number.NaN,
  }));

  // The solver moment at a support is read off the reference axis at that support's global
  // station — the same station-lookup pattern `doubleIntegration.ts` uses for its own residual.
  const positionOf = new Map(referenceAxis.stations.map((station) => [station.nodeId, station.x]));
  const momentOnAxis = (axis: BeamAxis, x: number): number => {
    const segment = axis.segments.find((entry) => x >= entry.x0 - 1e-9 && x <= entry.x1 + 1e-9) ?? axis.segments[axis.segments.length - 1];
    return evaluate(segment.moment, x);
  };
  for (const entry of supportMoments) {
    const x = positionOf.get(entry.nodeId);
    entry.solverMoment = x === undefined ? Number.NaN : momentOnAxis(referenceAxis, x);
  }

  const momentResidual = supportMoments.reduce(
    (largest, entry) => Math.max(largest, Math.abs(entry.value - entry.solverMoment)),
    0,
  );

  const segments: ThreeMomentNarratedSegment[] = spans.flatMap((span, index) => {
    const spanAxis = spanAxes[index];
    const mLeft = momentAt.get(span.leftNodeId) ?? 0;
    const mRight = momentAt.get(span.rightNodeId) ?? 0;
    const correction: number[] = [mLeft, (mRight - mLeft) / span.length];
    const origin = positionOf.get(span.leftNodeId) ?? 0;
    return spanAxis.segments.map((segment) => ({
      x0: origin + segment.x0,
      x1: origin + segment.x1,
      EI: span.EI,
      // `segment.moment` is expressed in the span's own local coordinate (0 at its left end);
      // the reader-facing segment needs it in the reference axis's global coordinate, the same
      // shift `beamAxis.ts`'s own `toGlobal` applies to a forward-running member.
      moment: shift(add(segment.moment, correction), -origin),
    }));
  });

  return {
    applicable: true,
    classification,
    axis: referenceAxis,
    spans,
    supportMoments,
    segments,
    momentResidual,
  };
};

export type { Polynomial };
