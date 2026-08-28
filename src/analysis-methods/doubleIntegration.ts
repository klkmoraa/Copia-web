/**
 * The Double Integration method, solved for real.
 *
 * `EI y''(x) = M(x)` integrated twice gives the slope and the deflection, with one constant
 * per integration and per stretch. On a hyperstatic beam the moment is not known in advance
 * either, so the redundant reactions join the constants as unknowns and the boundary and
 * continuity conditions determine them all at once — which is exactly the procedure a reader
 * is taught, and the one this module reproduces.
 *
 * The moment is built by superposition on the released structure:
 *
 *     M(x) = M₀(x) + Σ Xᵢ mᵢ(x)
 *
 * where `M₀` is the released beam under the real loads and `mᵢ` the same beam under a unit
 * force at redundant *i*. Both come from `analyzeProject`, so nothing here re-derives the
 * solver's statics — it composes results the solver already produced.
 *
 * The result is then checked against the solver's own answer for the *original* structure.
 * That check is the point: a method that disagreed with the solver would not be a second
 * opinion, it would be a bug, and `doubleIntegration.test.ts` fails when the gap opens.
 */
import { analyzeProject } from '../engine/solver';
import { solveLinearSystem } from '../engine/math';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel, SupportDefinition } from '../types';
import { add, evaluate, integrate, scale, type Polynomial } from './polynomialAlgebra';
import { buildBeamAxis, type BeamAxis } from './beamAxis';
import { classifyStructure, type StructureClassification } from './structureClassification';

/** One stretch of the beam between two consecutive discontinuities. */
export interface NarratedSegment {
  x0: number;
  x1: number;
  EI: number;
  /** Moment with the redundants already solved, in the global coordinate. */
  moment: number[];
  /** `EI θ(x)` when the beam has uniform EI, otherwise `θ(x)`. */
  slope: number[];
  /** `EI y(x)` when the beam has uniform EI, otherwise `y(x)`. */
  deflection: number[];
  /** Symbols of the two integration constants of this stretch, e.g. `C₁`, `C₂`. */
  constantSymbols: [string, string];
}

export interface RedundantSolution {
  nodeId: string;
  symbol: string;
  /** Value the method arrives at, in kN. */
  value: number;
  /** What the solver reports at the same support, for the reader to compare. */
  solverReaction: number;
}

export interface BoundaryCondition {
  /** Human-readable statement, e.g. `y(4) = 0 — apoyo B`. */
  statement: string;
  kind: 'deflection' | 'slope' | 'continuity';
  x: number;
}

export interface DoubleIntegrationResult {
  applicable: true;
  classification: StructureClassification;
  axis: BeamAxis;
  /** True when EI is the same everywhere, so the report can factor it out as DELx does. */
  uniformEI: boolean;
  EI: number;
  redundants: RedundantSolution[];
  segments: NarratedSegment[];
  conditions: BoundaryCondition[];
  constants: { symbol: string; value: number }[];
  /** Largest gap between a redundant and the solver's reaction there, in kN. */
  reactionResidual: number;
  /** Largest gap between the narrated deflection and the solver's, in metres. */
  deflectionResidual: number;
  maxDeflection: { x: number; value: number };
}

export interface DoubleIntegrationRejection {
  applicable: false;
  /** Translation key explaining why, so the interface never invents a reason. */
  reasonKey: string;
}

export type DoubleIntegrationOutcome = DoubleIntegrationResult | DoubleIntegrationRejection;

/** Transverse restraint of a support, in the sense the bending problem cares about. */
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

/** The same support with its transverse restraint removed, keeping the rest. */
const releaseTransverse = (support: SupportDefinition): SupportDefinition => {
  if (support.type === 'roller') return { type: 'none' };
  // A pin keeps its axial restraint: releasing that too would let the released beam drift
  // horizontally and the solver would rightly refuse it.
  if (support.type === 'pin') return { type: 'custom', restrainX: true, restrainY: false, restrainR: false };
  if (support.type === 'fixed') return { type: 'custom', restrainX: true, restrainY: false, restrainR: true };
  return { ...support, restrainY: false };
};

const SUBSCRIPTS = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const subscript = (index: number): string => {
  const number = index + 1;
  return number <= 9 ? SUBSCRIPTS[number - 1] : String(number).split('').map((digit) => SUBSCRIPTS[Number(digit) - 1] ?? '₀').join('');
};

/** A project with the chosen supports released. */
const releasedProject = (project: ProjectModel, releasedNodeIds: readonly string[]): ProjectModel => {
  const released = new Set(releasedNodeIds);
  return {
    ...project,
    nodes: project.nodes.map((node): NodeModel => (
      released.has(node.id) ? { ...node, support: releaseTransverse(node.support) } : node
    )),
  };
};

/** The released beam carrying nothing but an upward unit force at `nodeId`. */
const unitLoadProject = (project: ProjectModel, releasedNodeIds: readonly string[], nodeId: string): ProjectModel => ({
  ...releasedProject(project, releasedNodeIds),
  loadCases: [{ id: 'UNIT', name: 'unit', category: 'other', active: true }],
  combinations: [],
  memberLoads: [],
  nodalLoads: [{ id: 'UNIT-LOAD', nodeId, caseId: 'UNIT', fx: 0, fy: 1, mz: 0 }],
});

/**
 * Chooses which reactions to treat as unknown.
 *
 * Interior supports first, then from the far end: that is the choice a textbook makes, and it
 * usually leaves a cantilever or a simply supported beam — shapes whose released moment
 * diagram a reader can follow. Every candidate set is put to the solver before being adopted,
 * so a selection that would leave a mechanism is discarded rather than narrated.
 */
const chooseRedundants = (
  project: ProjectModel,
  classification: StructureClassification,
  combination: LoadCombination | null,
): string[] | undefined => {
  const degree = classification.indeterminacy;
  if (degree <= 0) return [];
  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  const ordered = classification.axisNodeIds
    .map((nodeId, index) => ({ nodeId, index }))
    .filter(({ nodeId }) => {
      const node = byId.get(nodeId);
      return node ? restrainsTransverse(node.support) : false;
    });
  const interior = ordered.filter(({ index }) => index > 0 && index < classification.axisNodeIds.length - 1);
  const ends = ordered.filter(({ index }) => index === 0 || index === classification.axisNodeIds.length - 1).reverse();
  const candidates = [...interior, ...ends].map((entry) => entry.nodeId);
  if (candidates.length < degree) return undefined;

  // Sliding window over the preference order: the first stable set wins.
  for (let start = 0; start + degree <= candidates.length; start += 1) {
    const attempt = candidates.slice(start, start + degree);
    const probe = analyzeProject(releasedProject(project, attempt), combination, { includeEducationTrace: false });
    if (probe.success) return attempt;
  }
  return undefined;
};

/** Breakpoints shared by every contributing axis, so all polynomials can be superposed. */
const mergedBreakpoints = (axes: readonly BeamAxis[]): number[] => {
  const tolerance = 1e-9;
  const points: number[] = [];
  for (const axis of axes) {
    for (const segment of axis.segments) points.push(segment.x0, segment.x1);
  }
  points.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const point of points) {
    if (!unique.length || point - unique[unique.length - 1] > tolerance) unique.push(point);
  }
  return unique;
};

/** Polynomial covering `[x0, x1]` in `axis`; a polynomial is valid on any sub-interval. */
const momentOn = (axis: BeamAxis, x0: number, x1: number): { moment: number[]; EI: number } => {
  const middle = (x0 + x1) / 2;
  const segment = axis.segments.find((entry) => middle >= entry.x0 - 1e-9 && middle <= entry.x1 + 1e-9)
    ?? axis.segments[axis.segments.length - 1];
  return { moment: [...segment.moment], EI: segment.EI };
};

export const solveDoubleIntegration = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): DoubleIntegrationOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'simple-beam' && classification.kind !== 'continuous-beam') {
    return { applicable: false, reasonKey: 'method.rejectedNotBeam' };
  }
  if (classification.indeterminacy < 0) {
    return { applicable: false, reasonKey: 'method.rejectedMechanism' };
  }

  const referenceAxis = buildBeamAxis(project, analysis, classification.axisNodeIds);
  if (!referenceAxis) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

  const redundantNodes = chooseRedundants(project, classification, combination);
  if (!redundantNodes) return { applicable: false, reasonKey: 'method.rejectedRedundants' };

  // `M₀`: the released beam under the real loads. With no redundants the released beam is the
  // original one, so this is just the reference axis and no extra analysis is needed.
  let baseAxis = referenceAxis;
  const unitAxes: BeamAxis[] = [];
  if (redundantNodes.length) {
    const releasedAnalysis = analyzeProject(releasedProject(project, redundantNodes), combination, { includeEducationTrace: false });
    if (!releasedAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedRedundants' };
    const released = buildBeamAxis(releasedProject(project, redundantNodes), releasedAnalysis, classification.axisNodeIds);
    if (!released) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    baseAxis = released;

    for (const nodeId of redundantNodes) {
      const unitProject = unitLoadProject(project, redundantNodes, nodeId);
      const unitAnalysis = analyzeProject(unitProject, null, { includeEducationTrace: false });
      if (!unitAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedRedundants' };
      const unitAxis = buildBeamAxis(unitProject, unitAnalysis, classification.axisNodeIds);
      if (!unitAxis) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
      unitAxes.push(unitAxis);
    }
  }

  const breakpoints = mergedBreakpoints([baseAxis, ...unitAxes]);
  if (breakpoints.length < 2) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

  const degree = redundantNodes.length;
  const stretches = breakpoints.slice(0, -1).map((x0, index) => {
    const x1 = breakpoints[index + 1];
    const base = momentOn(baseAxis, x0, x1);
    return {
      x0,
      x1,
      EI: base.EI,
      base: base.moment,
      unit: unitAxes.map((axis) => momentOn(axis, x0, x1).moment),
    };
  });

  // Unknown vector: [X₁ … X_g, A₁, B₁, A₂, B₂ …] where Aₖ and Bₖ are the two integration
  // constants of stretch k. Slope carries Aₖ, deflection carries Aₖ·x + Bₖ.
  const unknownCount = degree + 2 * stretches.length;
  const slopeConstant = (k: number) => degree + 2 * k;
  const deflectionConstant = (k: number) => degree + 2 * k + 1;

  /** θ and y at `x` on stretch `k`, as a row of coefficients over the unknowns plus a constant. */
  const slopeRow = (k: number, x: number): { row: number[]; rhs: number } => {
    const stretch = stretches[k];
    const row = new Array<number>(unknownCount).fill(0);
    const baseSlope = integrate(scale(stretch.base, 1 / stretch.EI));
    for (const [i, unit] of stretch.unit.entries()) row[i] = evaluate(integrate(scale(unit, 1 / stretch.EI)), x);
    row[slopeConstant(k)] = 1;
    return { row, rhs: -evaluate(baseSlope, x) };
  };

  const deflectionRow = (k: number, x: number): { row: number[]; rhs: number } => {
    const stretch = stretches[k];
    const row = new Array<number>(unknownCount).fill(0);
    const baseDeflection = integrate(integrate(scale(stretch.base, 1 / stretch.EI)));
    for (const [i, unit] of stretch.unit.entries()) {
      row[i] = evaluate(integrate(integrate(scale(unit, 1 / stretch.EI))), x);
    }
    row[slopeConstant(k)] = x;
    row[deflectionConstant(k)] = 1;
    return { row, rhs: -evaluate(baseDeflection, x) };
  };

  const matrix: number[][] = [];
  const vector: number[] = [];
  const conditions: BoundaryCondition[] = [];
  const push = (a: { row: number[]; rhs: number }, condition: BoundaryCondition) => {
    matrix.push(a.row);
    vector.push(a.rhs);
    conditions.push(condition);
  };
  const difference = (a: { row: number[]; rhs: number }, b: { row: number[]; rhs: number }) => ({
    row: a.row.map((value, index) => value - b.row[index]),
    rhs: a.rhs - b.rhs,
  });

  // Continuity: both stretches meeting at an interior breakpoint agree on slope and deflection.
  for (let k = 0; k + 1 < stretches.length; k += 1) {
    const x = stretches[k].x1;
    push(difference(slopeRow(k, x), slopeRow(k + 1, x)), { statement: `θ(${x}) continua`, kind: 'continuity', x });
    push(difference(deflectionRow(k, x), deflectionRow(k + 1, x)), { statement: `y(${x}) continua`, kind: 'continuity', x });
  }

  const stretchAt = (x: number): number => {
    const index = stretches.findIndex((stretch) => x >= stretch.x0 - 1e-9 && x <= stretch.x1 + 1e-9);
    return index < 0 ? stretches.length - 1 : index;
  };
  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  for (const station of referenceAxis.stations) {
    const node = byId.get(station.nodeId);
    if (!node) continue;
    const k = stretchAt(station.x);
    // The released supports are included on purpose: their `y = 0` is precisely the
    // compatibility condition that determines the redundant that replaced them.
    if (restrainsTransverse(node.support)) {
      push(deflectionRow(k, station.x), { statement: `y(${station.x}) = 0 en ${station.nodeId}`, kind: 'deflection', x: station.x });
    }
    if (restrainsRotation(node.support)) {
      push(slopeRow(k, station.x), { statement: `θ(${station.x}) = 0 en ${station.nodeId}`, kind: 'slope', x: station.x });
    }
  }

  if (matrix.length !== unknownCount) return { applicable: false, reasonKey: 'method.rejectedConditions' };

  let solution: number[];
  try {
    solution = solveLinearSystem(matrix, vector).x;
  } catch {
    return { applicable: false, reasonKey: 'method.rejectedSingular' };
  }

  const uniformEI = referenceAxis.uniformEI;
  const EI = referenceAxis.EI;
  const presentation = uniformEI ? EI : 1;

  const segments: NarratedSegment[] = stretches.map((stretch, k) => {
    const moment = stretch.unit.reduce<number[]>(
      (total, unit, i) => add(total, scale(unit, solution[i])),
      [...stretch.base],
    );
    const curvature = scale(moment, 1 / stretch.EI);
    const slope = add(integrate(curvature), [solution[slopeConstant(k)]]);
    const deflection = add(integrate(slope), [solution[deflectionConstant(k)]]);
    return {
      x0: stretch.x0,
      x1: stretch.x1,
      EI: stretch.EI,
      moment,
      slope: scale(slope, presentation),
      deflection: scale(deflection, presentation),
      constantSymbols: [`C${subscript(2 * k)}`, `C${subscript(2 * k + 1)}`],
    };
  });

  const redundants: RedundantSolution[] = redundantNodes.map((nodeId, index) => ({
    nodeId,
    symbol: `X${subscript(index)}`,
    value: solution[index],
    solverReaction: analysis.nodeResults.find((entry) => entry.nodeId === nodeId)?.ry ?? Number.NaN,
  }));

  const reactionResidual = redundants.reduce(
    (largest, redundant) => Math.max(largest, Math.abs(redundant.value - redundant.solverReaction)),
    0,
  );

  // Deflection cross-check against the solver's own sampled deformation, mapped onto the axis
  // with the same sign rule the moment uses.
  let deflectionResidual = 0;
  const positionOf = new Map(referenceAxis.stations.map((station) => [station.nodeId, station.x]));
  for (const result of analysis.memberResults) {
    const member = project.members.find((entry) => entry.id === result.memberId);
    if (!member) continue;
    const start = positionOf.get(member.i);
    const end = positionOf.get(member.j);
    if (start === undefined || end === undefined) continue;
    const forward = end > start;
    for (const point of result.deformation) {
      const x = forward ? start + point.x : start - point.x;
      const expected = forward ? point.v : -point.v;
      const segment = segments[stretchAt(x)];
      const actual = evaluate(segment.deflection, x) / presentation;
      deflectionResidual = Math.max(deflectionResidual, Math.abs(actual - expected));
    }
  }

  let maxDeflection = { x: 0, value: 0 };
  for (const segment of segments) {
    const steps = 40;
    for (let step = 0; step <= steps; step += 1) {
      const x = segment.x0 + ((segment.x1 - segment.x0) * step) / steps;
      const value = evaluate(segment.deflection, x) / presentation;
      if (Math.abs(value) > Math.abs(maxDeflection.value)) maxDeflection = { x, value };
    }
  }

  return {
    applicable: true,
    classification,
    axis: referenceAxis,
    uniformEI,
    EI,
    redundants,
    segments,
    conditions,
    constants: segments.flatMap((segment, k) => [
      { symbol: segment.constantSymbols[0], value: solution[slopeConstant(k)] },
      { symbol: segment.constantSymbols[1], value: solution[deflectionConstant(k)] },
    ]),
    reactionResidual,
    deflectionResidual,
    maxDeflection,
  };
};

export type { Polynomial };
