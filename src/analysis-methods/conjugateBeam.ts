/**
 * The Conjugate Beam method, solved for real.
 *
 * The two theorems behind it are a direct reading of `EI y″(x) = M(x)`: integrated once it
 * gives `EI θ(x)`, integrated twice `EI y(x)`. A reader taught this method never writes those
 * integrals directly — instead they build a second, fictitious beam carrying `w*(x) = M(x)/EI`
 * as a distributed load, with every support converted by a fixed table (a real pin stays a pin,
 * a real fixed end becomes free, a real free end becomes fixed), and reads the slope and the
 * deflection of the real beam off the *shear* and the *moment* of that conjugate beam — exactly
 * the statics a reader already knows how to do on an ordinary loaded beam.
 *
 * The conversion table only closes cleanly when the real beam has nothing happening between its
 * two ends: an interior support or an interior hinge would need its own conjugate counterpart
 * (an internal hinge, or an extra support) that this delivery does not build. So this module
 * narrates the classical case the method is normally taught on — a single isostatic span, with
 * as many members as the model likes between its two ends, but no support and no hinge in
 * between — and declines anything that needs more than that.
 *
 * `M(x)` comes straight from `analyzeProject`, the same axis `doubleIntegration.ts` builds; this
 * module does not re-derive the bending moment, only the elastic curve on top of it. The result
 * is then checked against the solver's own slope and deflection at every point it reports, and
 * `conjugateBeam.test.ts` fails the moment that check opens a gap.
 */
import { solveLinearSystem } from '../engine/math';
import type { AnalysisResult, LoadCombination, ProjectModel, SupportDefinition } from '../types';
import { evaluate, integrate, scale, type Polynomial } from './polynomialAlgebra';
import { buildBeamAxis, type BeamAxis } from './beamAxis';
import { classifyStructure, type StructureClassification } from './structureClassification';

export interface NarratedSegment {
  x0: number;
  x1: number;
  EI: number;
  /** The real bending moment, in the global coordinate — same signal Double Integration reads. */
  moment: number[];
  /** `w*(x) = M(x)/EI(x)`, the fictitious load carried by the conjugate beam on this stretch. */
  fictitiousLoad: number[];
  /** `EI θ(x)` when the beam has uniform EI, otherwise `θ(x)` — the conjugate beam's shear. */
  conjugateShear: number[];
  /** `EI y(x)` when the beam has uniform EI, otherwise `y(x)` — the conjugate beam's moment. */
  conjugateMoment: number[];
  constantSymbols: [string, string];
}

export type ConjugateSupportKind = 'fixed' | 'simple' | 'guided' | 'free';

export interface ConjugateEnd {
  nodeId: string;
  x: number;
  realKind: ConjugateSupportKind;
  conjugateKind: ConjugateSupportKind;
  /** The conjugate beam's reaction force at this end, present only when `conjugateKind` carries
   *  one (`fixed` or `simple`). Equal to `θ` of the real beam there. */
  reactionForce?: number;
  /** The conjugate beam's reaction moment at this end, present only when `conjugateKind` carries
   *  one (`fixed` or `guided`). Equal to `y` of the real beam there. */
  reactionMoment?: number;
}

export interface BoundaryCondition {
  statement: string;
  kind: 'deflection' | 'slope' | 'continuity';
  x: number;
}

export interface ConjugateBeamResult {
  applicable: true;
  classification: StructureClassification;
  axis: BeamAxis;
  uniformEI: boolean;
  EI: number;
  ends: [ConjugateEnd, ConjugateEnd];
  segments: NarratedSegment[];
  conditions: BoundaryCondition[];
  constants: { symbol: string; value: number }[];
  /** Largest gap between the narrated deflection and the solver's, in metres. */
  deflectionResidual: number;
  /** Largest gap between the narrated slope and the solver's, in radians. */
  slopeResidual: number;
  maxDeflection: { x: number; value: number };
}

export interface ConjugateBeamRejection {
  applicable: false;
  reasonKey: string;
}

export type ConjugateBeamOutcome = ConjugateBeamResult | ConjugateBeamRejection;

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

/** The support-conversion table: swap-and-negate, `T' = ¬R` and `R' = ¬T`. */
const kindOf = (transverse: boolean, rotation: boolean): ConjugateSupportKind => (
  transverse && rotation ? 'fixed' : transverse ? 'simple' : rotation ? 'guided' : 'free'
);

const SUBSCRIPTS = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const subscript = (index: number): string => {
  const number = index + 1;
  return number <= 9 ? SUBSCRIPTS[number - 1] : String(number).split('').map((digit) => SUBSCRIPTS[Number(digit) - 1] ?? '₀').join('');
};

export const solveConjugateBeam = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): ConjugateBeamOutcome => {
  void combination;
  const classification = classifyStructure(project);
  if (classification.kind !== 'simple-beam' && classification.kind !== 'continuous-beam') {
    return { applicable: false, reasonKey: 'method.rejectedNotBeamConjugate' };
  }
  if (classification.indeterminacy < 0) return { applicable: false, reasonKey: 'method.rejectedMechanism' };
  if (classification.indeterminacy > 0) return { applicable: false, reasonKey: 'method.rejectedIndeterminateConjugate' };

  const axis = buildBeamAxis(project, analysis, classification.axisNodeIds);
  if (!axis) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  const axisNodeIds = classification.axisNodeIds;
  const interior = new Set(axisNodeIds.slice(1, -1));
  for (const nodeId of interior) {
    const node = byId.get(nodeId);
    if (node && (restrainsTransverse(node.support) || restrainsRotation(node.support) || node.internalHinge)) {
      return { applicable: false, reasonKey: 'method.rejectedInteriorSupportConjugate' };
    }
  }
  for (const member of project.members) {
    if (member.type === 'rigid') continue;
    if (member.releases?.iMoment && interior.has(member.i)) return { applicable: false, reasonKey: 'method.rejectedInteriorSupportConjugate' };
    if (member.releases?.jMoment && interior.has(member.j)) return { applicable: false, reasonKey: 'method.rejectedInteriorSupportConjugate' };
  }

  const leftNode = byId.get(axisNodeIds[0]);
  const rightNode = byId.get(axisNodeIds[axisNodeIds.length - 1]);
  if (!leftNode || !rightNode) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

  const stretches = [...axis.segments].sort((a, b) => a.x0 - b.x0);
  if (stretches.length < 1) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

  const unknownCount = 2 * stretches.length;
  const slopeConstant = (k: number) => 2 * k;
  const deflectionConstant = (k: number) => 2 * k + 1;

  const baseSlope = stretches.map((stretch) => integrate(scale(stretch.moment, 1 / stretch.EI)));
  const baseDeflection = baseSlope.map((slope) => integrate(slope));

  const slopeRow = (k: number, x: number): { row: number[]; rhs: number } => {
    const row = new Array<number>(unknownCount).fill(0);
    row[slopeConstant(k)] = 1;
    return { row, rhs: -evaluate(baseSlope[k], x) };
  };
  const deflectionRow = (k: number, x: number): { row: number[]; rhs: number } => {
    const row = new Array<number>(unknownCount).fill(0);
    row[slopeConstant(k)] = x;
    row[deflectionConstant(k)] = 1;
    return { row, rhs: -evaluate(baseDeflection[k], x) };
  };
  const difference = (a: { row: number[]; rhs: number }, b: { row: number[]; rhs: number }) => ({
    row: a.row.map((value, index) => value - b.row[index]),
    rhs: a.rhs - b.rhs,
  });

  const matrix: number[][] = [];
  const vector: number[] = [];
  const conditions: BoundaryCondition[] = [];
  const push = (a: { row: number[]; rhs: number }, condition: BoundaryCondition) => {
    matrix.push(a.row);
    vector.push(a.rhs);
    conditions.push(condition);
  };

  for (let k = 0; k + 1 < stretches.length; k += 1) {
    const x = stretches[k].x1;
    push(difference(slopeRow(k, x), slopeRow(k + 1, x)), { statement: `θ(${x}) continua`, kind: 'continuity', x });
    push(difference(deflectionRow(k, x), deflectionRow(k + 1, x)), { statement: `y(${x}) continua`, kind: 'continuity', x });
  }

  const xLeft = axis.stations[0].x;
  const xRight = axis.stations[axis.stations.length - 1].x;
  const kLeft = 0;
  const kRight = stretches.length - 1;

  if (restrainsTransverse(leftNode.support)) push(deflectionRow(kLeft, xLeft), { statement: `y(${xLeft}) = 0 en ${leftNode.id}`, kind: 'deflection', x: xLeft });
  if (restrainsRotation(leftNode.support)) push(slopeRow(kLeft, xLeft), { statement: `θ(${xLeft}) = 0 en ${leftNode.id}`, kind: 'slope', x: xLeft });
  if (restrainsTransverse(rightNode.support)) push(deflectionRow(kRight, xRight), { statement: `y(${xRight}) = 0 en ${rightNode.id}`, kind: 'deflection', x: xRight });
  if (restrainsRotation(rightNode.support)) push(slopeRow(kRight, xRight), { statement: `θ(${xRight}) = 0 en ${rightNode.id}`, kind: 'slope', x: xRight });

  if (matrix.length !== unknownCount) return { applicable: false, reasonKey: 'method.rejectedConditions' };

  let solution: number[];
  try {
    solution = solveLinearSystem(matrix, vector).x;
  } catch {
    return { applicable: false, reasonKey: 'method.rejectedSingular' };
  }

  const uniformEI = axis.uniformEI;
  const EI = axis.EI;
  const presentation = uniformEI ? EI : 1;

  const segments: NarratedSegment[] = stretches.map((stretch, k) => {
    const fictitiousLoad = scale(stretch.moment, 1 / stretch.EI);
    const theta = [...baseSlope[k]];
    theta[0] = (theta[0] ?? 0) + solution[slopeConstant(k)];
    const y = [...baseDeflection[k]];
    y[1] = (y[1] ?? 0) + solution[slopeConstant(k)];
    y[0] = (y[0] ?? 0) + solution[deflectionConstant(k)];
    return {
      x0: stretch.x0,
      x1: stretch.x1,
      EI: stretch.EI,
      moment: [...stretch.moment],
      fictitiousLoad,
      conjugateShear: scale(theta, presentation),
      conjugateMoment: scale(y, presentation),
      constantSymbols: [`C${subscript(2 * k)}`, `C${subscript(2 * k + 1)}`],
    };
  });

  const thetaAt = (k: number, x: number): number => evaluate(segments[k].conjugateShear, x) / presentation;
  const yAt = (k: number, x: number): number => evaluate(segments[k].conjugateMoment, x) / presentation;

  const buildEnd = (node: typeof leftNode, x: number, k: number): ConjugateEnd => {
    const T = restrainsTransverse(node.support);
    const R = restrainsRotation(node.support);
    const conjugateT = !R;
    const conjugateR = !T;
    return {
      nodeId: node.id,
      x,
      realKind: kindOf(T, R),
      conjugateKind: kindOf(conjugateT, conjugateR),
      reactionForce: conjugateT ? thetaAt(k, x) : undefined,
      reactionMoment: conjugateR ? yAt(k, x) : undefined,
    };
  };
  const ends: [ConjugateEnd, ConjugateEnd] = [
    buildEnd(leftNode, xLeft, kLeft),
    buildEnd(rightNode, xRight, kRight),
  ];

  const stretchAt = (x: number): number => {
    const index = stretches.findIndex((stretch) => x >= stretch.x0 - 1e-9 && x <= stretch.x1 + 1e-9);
    return index < 0 ? stretches.length - 1 : index;
  };

  let deflectionResidual = 0;
  let slopeResidual = 0;
  const positionOf = new Map(axis.stations.map((station) => [station.nodeId, station.x]));
  for (const result of analysis.memberResults) {
    const member = project.members.find((entry) => entry.id === result.memberId);
    if (!member) continue;
    const start = positionOf.get(member.i);
    const end = positionOf.get(member.j);
    if (start === undefined || end === undefined) continue;
    const forward = end > start;
    for (const point of result.deformation) {
      const x = forward ? start + point.x : start - point.x;
      const expectedV = forward ? point.v : -point.v;
      const expectedTheta = forward ? point.theta : -point.theta;
      const k = stretchAt(x);
      deflectionResidual = Math.max(deflectionResidual, Math.abs(yAt(k, x) - expectedV));
      slopeResidual = Math.max(slopeResidual, Math.abs(thetaAt(k, x) - expectedTheta));
    }
  }

  let maxDeflection = { x: 0, value: 0 };
  for (const [k, segment] of segments.entries()) {
    const steps = 40;
    for (let step = 0; step <= steps; step += 1) {
      const x = segment.x0 + ((segment.x1 - segment.x0) * step) / steps;
      const value = yAt(k, x);
      if (Math.abs(value) > Math.abs(maxDeflection.value)) maxDeflection = { x, value };
    }
  }

  return {
    applicable: true,
    classification,
    axis,
    uniformEI,
    EI,
    ends,
    segments,
    conditions,
    constants: segments.flatMap((segment, k) => [
      { symbol: segment.constantSymbols[0], value: solution[slopeConstant(k)] },
      { symbol: segment.constantSymbols[1], value: solution[deflectionConstant(k)] },
    ]),
    deflectionResidual,
    slopeResidual,
    maxDeflection,
  };
};

export type { Polynomial };
