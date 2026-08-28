/**
 * The Hardy Cross Method (moment distribution), solved for real — the same continuous-beam
 * answer `threeMoment.ts` reaches by solving a system of equations directly, reached instead by
 * the iterative, hand-executable process a reader is actually taught: no simultaneous equations,
 * only local joint balancing repeated until it converges.
 *
 * 1. Lock every joint against rotation and find the *fixed-end moment* each span develops under
 *    its own real loads — read straight off `analyzeProject` on a fixed–fixed isolation of that
 *    span, not from memorised formulas for each load type.
 * 2. At the beam's two outer (simple) ends, pre-release that fixed-end moment: carry half of it
 *    into the neighbouring joint once, and use a *reduced* stiffness (3EI/L rather than 4EI/L)
 *    for that span from then on — the standard modification that means an end span never needs
 *    to be revisited, because its far end can never truly resist a moment anyway.
 * 3. At every interior joint, distribute the unbalanced moment among its spans in proportion to
 *    their relative stiffness, and carry half of what each span received to its far end — *if*
 *    that far end is itself an interior joint still to be balanced. Repeat, sweeping joint to
 *    joint, until no joint has anything left to balance.
 *
 * The final moment at any point is the same construction `threeMoment.ts` uses — a span's own
 * simply-supported "free" moment, corrected by the two converged joint moments at its ends — and
 * *that* is checked against the solver's own diagram for the original, unreleased beam. A method
 * that disagreed with the solver would not be a second opinion, it would be a bug, and
 * `hardyCross.test.ts` fails when the gap opens. It is also checked against `threeMoment.ts`
 * itself on the same beam: two different procedures for the same exact answer have to agree.
 */
import { analyzeProject } from '../engine/solver';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel, SupportDefinition } from '../types';
import { add, evaluate, shift, type Polynomial } from './polynomialAlgebra';
import { buildBeamAxis, type BeamAxis } from './beamAxis';
import { classifyStructure, type StructureClassification } from './structureClassification';

export interface HardyCrossSpan {
  spanIndex: number;
  leftNodeId: string;
  rightNodeId: string;
  length: number;
  EI: number;
  /** Fixed-end moment the span exerts on its left/right joint, under the real loads alone. */
  fixedEndMomentLeft: number;
  fixedEndMomentRight: number;
  /** Relative stiffness used when distributing at each end; 0 where that end is never balanced. */
  stiffnessLeft: number;
  stiffnessRight: number;
  /** Converged physical moment at each end — 0 at a beam's own outer (simple) end. */
  finalMomentLeft: number;
  finalMomentRight: number;
}

export interface HardyCrossJointMoment {
  nodeId: string;
  value: number;
  solverMoment: number;
}

export interface HardyCrossNarratedSegment {
  x0: number;
  x1: number;
  EI: number;
  moment: number[];
}

export interface HardyCrossResult {
  applicable: true;
  classification: StructureClassification;
  axis: BeamAxis;
  spans: HardyCrossSpan[];
  joints: HardyCrossJointMoment[];
  /** How many balancing sweeps it took to bring every joint below the convergence tolerance. */
  iterationCount: number;
  segments: HardyCrossNarratedSegment[];
  momentResidual: number;
}

export interface HardyCrossRejection {
  applicable: false;
  reasonKey: string;
}

export type HardyCrossOutcome = HardyCrossResult | HardyCrossRejection;

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

/**
 * An isolated sub-beam covering just this span: the nodes, members and loads strictly between
 * (and including) the two support nodes, with every other support released and a nodal load
 * exactly at either end excluded — the same isolation `threeMoment.ts` builds, parameterised by
 * which idealised end condition this particular sub-analysis needs.
 */
const buildSpanProject = (
  project: ProjectModel,
  axisNodeIds: readonly string[],
  leftIndex: number,
  rightIndex: number,
  ends: 'simple' | 'fixed',
): ProjectModel => {
  const leftId = axisNodeIds[leftIndex];
  const rightId = axisNodeIds[rightIndex];
  const spanNodeIds = new Set(axisNodeIds.slice(leftIndex, rightIndex + 1));
  const endSupport: SupportDefinition = ends === 'fixed' ? { type: 'fixed' } : { type: 'pin' };
  const rightEndSupport: SupportDefinition = ends === 'fixed' ? { type: 'fixed' } : { type: 'roller', angleDeg: 90 };
  const nodes: NodeModel[] = project.nodes
    .filter((node) => spanNodeIds.has(node.id))
    .map((node) => ({
      ...node,
      support: node.id === leftId ? endSupport : node.id === rightId ? rightEndSupport : { type: 'none' },
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

/** Moment the span exerts on its left (i) and right (j) joint, from its own isolated diagram. */
const jointMomentsOf = (axis: BeamAxis): { left: number; right: number } => {
  const first = axis.segments[0];
  const last = axis.segments[axis.segments.length - 1];
  return { left: evaluate(first.moment, first.x0), right: -evaluate(last.moment, last.x1) };
};

const TOLERANCE = 1e-9;
const MAX_ITERATIONS = 2000;

export const solveHardyCross = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): HardyCrossOutcome => {
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

  const spanCount = supportIndices.length - 1;
  const interiorCount = spanCount - 1;

  const spans: HardyCrossSpan[] = [];
  const simpleAxes: BeamAxis[] = [];
  for (let s = 0; s < spanCount; s += 1) {
    const leftIndex = supportIndices[s].index;
    const rightIndex = supportIndices[s + 1].index;
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

    const spanAxisNodeIds = axisNodeIds.slice(leftIndex, rightIndex + 1);
    const simpleProject = buildSpanProject(project, axisNodeIds, leftIndex, rightIndex, 'simple');
    const simpleAnalysis = analyzeProject(simpleProject, combination, { includeEducationTrace: false });
    if (!simpleAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const simpleAxis = buildBeamAxis(simpleProject, simpleAnalysis, spanAxisNodeIds);
    if (!simpleAxis) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    simpleAxes.push(simpleAxis);

    const fixedProject = buildSpanProject(project, axisNodeIds, leftIndex, rightIndex, 'fixed');
    const fixedAnalysis = analyzeProject(fixedProject, combination, { includeEducationTrace: false });
    if (!fixedAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const fixedAxis = buildBeamAxis(fixedProject, fixedAnalysis, spanAxisNodeIds);
    if (!fixedAxis) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const fem = jointMomentsOf(fixedAxis);

    const length = simpleAxis.length;
    // A span touching the beam's own outer (simple) end uses the *reduced* stiffness, 3EI/L
    // instead of 4EI/L, at its other (interior) end — that outer end is never balanced, so a
    // full 4EI/L would overstate how much of the unbalanced moment this span can honestly absorb
    // there. A span with an outer end on *both* sides (a lone, already-determinate span) never
    // has an interior end to apply this to at all.
    const leftIsOuter = s === 0;
    const rightIsOuter = s === spanCount - 1;
    spans.push({
      spanIndex: s,
      leftNodeId: supportIndices[s].nodeId,
      rightNodeId: supportIndices[s + 1].nodeId,
      length,
      EI,
      fixedEndMomentLeft: fem.left,
      fixedEndMomentRight: fem.right,
      stiffnessLeft: leftIsOuter ? 0 : (rightIsOuter ? 3 : 4) * (EI / length),
      stiffnessRight: rightIsOuter ? 0 : (leftIsOuter ? 3 : 4) * (EI / length),
      finalMomentLeft: 0,
      finalMomentRight: 0,
    });
  }

  if (interiorCount < 1) return { applicable: false, reasonKey: 'method.rejectedNoInteriorSupport' };

  // Running "moment this span currently exerts on its own end", the state the balancing sweep
  // updates. Only tracked where that end is an interior joint; an outer end's fixed-end moment is
  // pre-released once, carried half into its one neighbour, and never revisited. Releasing a
  // joint means fully cancelling its unbalanced moment — the *distributed* correction is the
  // negative of that moment — and it is the correction that gets carried over, not the moment
  // itself; the carryover into the neighbour is therefore `-0.5 ×` the outer fixed-end moment.
  const trackedLeft = spans.map((span) => span.spanIndex > 0);
  const trackedRight = spans.map((span) => span.spanIndex < spanCount - 1);
  const currentLeft = spans.map((span) => (span.spanIndex > 0 ? span.fixedEndMomentLeft : 0));
  const currentRight = spans.map((span) => (span.spanIndex < spanCount - 1 ? span.fixedEndMomentRight : 0));
  if (trackedRight[0]) currentRight[0] -= 0.5 * spans[0].fixedEndMomentLeft;
  if (trackedLeft[spanCount - 1]) currentLeft[spanCount - 1] -= 0.5 * spans[spanCount - 1].fixedEndMomentRight;

  let iterationCount = 0;
  for (; iterationCount < MAX_ITERATIONS; iterationCount += 1) {
    let maxUnbalanced = 0;
    for (let j = 1; j <= interiorCount; j += 1) {
      const leftSpan = j - 1;
      const rightSpan = j;
      const unbalanced = currentRight[leftSpan] + currentLeft[rightSpan];
      maxUnbalanced = Math.max(maxUnbalanced, Math.abs(unbalanced));
      if (Math.abs(unbalanced) <= TOLERANCE) continue;
      const kLeft = spans[leftSpan].stiffnessRight;
      const kRight = spans[rightSpan].stiffnessLeft;
      const total = kLeft + kRight;
      if (!(total > 0)) continue;
      const distributedLeft = (-unbalanced * kLeft) / total;
      const distributedRight = (-unbalanced * kRight) / total;
      currentRight[leftSpan] += distributedLeft;
      currentLeft[rightSpan] += distributedRight;
      if (trackedLeft[leftSpan]) currentLeft[leftSpan] += 0.5 * distributedLeft;
      if (trackedRight[rightSpan]) currentRight[rightSpan] += 0.5 * distributedRight;
    }
    if (maxUnbalanced <= TOLERANCE) break;
  }
  if (iterationCount >= MAX_ITERATIONS) return { applicable: false, reasonKey: 'method.rejectedNotConverged' };

  spans.forEach((span, index) => {
    // `currentLeft`/`currentRight` track "moment the span exerts on that joint" throughout the
    // sweep — the convention the balance-to-zero arithmetic above needs. The *physical* bending
    // moment at a span's right end is the negative of that (the same i-end/j-end asymmetry
    // `beamAxis.ts` and every other narrator here already relies on), so it is negated only now,
    // for the public, reader-facing value.
    span.finalMomentLeft = trackedLeft[index] ? currentLeft[index] : 0;
    span.finalMomentRight = trackedRight[index] ? -currentRight[index] : 0;
  });

  const positionOf = new Map(referenceAxis.stations.map((station) => [station.nodeId, station.x]));
  const momentOnAxis = (axis: BeamAxis, x: number): number => {
    const segment = axis.segments.find((entry) => x >= entry.x0 - 1e-9 && x <= entry.x1 + 1e-9) ?? axis.segments[axis.segments.length - 1];
    return evaluate(segment.moment, x);
  };
  const joints: HardyCrossJointMoment[] = supportIndices.slice(1, -1).map((entry, index) => {
    const value = spans[index].finalMomentRight;
    const x = positionOf.get(entry.nodeId);
    return { nodeId: entry.nodeId, value, solverMoment: x === undefined ? Number.NaN : momentOnAxis(referenceAxis, x) };
  });
  const momentResidual = joints.reduce((largest, entry) => Math.max(largest, Math.abs(entry.value - entry.solverMoment)), 0);

  const segments: HardyCrossNarratedSegment[] = spans.flatMap((span, index) => {
    const spanAxis = simpleAxes[index];
    const correction: number[] = [span.finalMomentLeft, (span.finalMomentRight - span.finalMomentLeft) / span.length];
    const origin = positionOf.get(span.leftNodeId) ?? 0;
    return spanAxis.segments.map((segment) => ({
      x0: origin + segment.x0,
      x1: origin + segment.x1,
      EI: span.EI,
      moment: shift(add(segment.moment, correction), -origin),
    }));
  });

  return {
    applicable: true,
    classification,
    axis: referenceAxis,
    spans,
    joints,
    iterationCount,
    segments,
    momentResidual,
  };
};

export type { Polynomial };
