import type { GeneralizedLoadComparison, MemberModel, ProjectModel } from '../types';

type Polynomial = number[];

export interface IndependentMemberSourceLoads {
  geometry: {
    grossLength: number;
    length: number;
    c: number;
    s: number;
    startOffset: number;
    endOffset: number;
  };
  mechanical: number[];
  mechanicalActivity: number[];
  initial: number[];
  initialActivity: number[];
  total: number[];
  totalActivity: number[];
}

const evaluate = (coefficients: Polynomial, x: number): number => coefficients
  .reduceRight((value, coefficient) => value * x + coefficient, 0);

const binomial = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let value = 1;
  for (let index = 1; index <= k; index += 1) value = value * (n - index + 1) / index;
  return value;
};

/** Compose p(ξ) with ξ=eta+span*t, returning coefficients in t. */
const composeAffine = (polynomial: Polynomial, eta: number, span: number): Polynomial => {
  const result = Array(polynomial.length).fill(0);
  polynomial.forEach((coefficient, degree) => {
    for (let power = 0; power <= degree; power += 1) {
      result[power] += coefficient * binomial(degree, power) * eta ** (degree - power) * span ** power;
    }
  });
  return result;
};

/** Exact and stable integral in t∈[0,1] of p(ξ(t)) q(t) dx. */
const integratePolynomialTimesLinear = (
  polynomial: Polynomial,
  qStart: number,
  qEnd: number,
  eta: number,
  zeta: number,
  length: number,
): number => {
  const span = zeta - eta;
  if (!(span > 0)) return 0;
  const composed = composeAffine(polynomial, eta, span);
  const deltaQ = qEnd - qStart;
  return length * span * composed.reduce((sum, coefficient, degree) => sum + coefficient * (
    qStart / (degree + 1) + deltaQ / (degree + 2)
  ), 0);
};

/** Closed-form Euler–Bernoulli/Timoshenko virtual fields in ξ=x/L. */
const virtualFields = (member: MemberModel, length: number): { transverse: Polynomial[]; rotation: Polynomial[] } => {
  if (member.type !== 'frame') return { transverse: [], rotation: [] };
  const shearRigidity = member.beamTheory === 'timoshenko' ? (member.G ?? 0) * (member.shearArea ?? 0) : Number.POSITIVE_INFINITY;
  const phi = Number.isFinite(shearRigidity) && shearRigidity > 0
    ? 12 * member.E * member.I / (shearRigidity * length ** 2)
    : 0;
  const denominator = 1 + phi;
  return {
    transverse: [
      [1, -phi / denominator, -3 / denominator, 2 / denominator],
      [0, length * (2 + phi) / (2 * denominator), -length * (4 + phi) / (2 * denominator), length / denominator],
      [0, phi / denominator, 3 / denominator, -2 / denominator],
      [0, -length * phi / (2 * denominator), length * (phi - 2) / (2 * denominator), length / denominator],
    ],
    rotation: [
      [0, -6 / (length * denominator), 6 / (length * denominator)],
      [1, -(4 + phi) / denominator, 3 / denominator],
      [0, 6 / (length * denominator), -6 / (length * denominator)],
      [0, (phi - 2) / denominator, 3 / denominator],
    ],
  };
};

const addContribution = (target: number[], activity: number[], contribution: number[]): void => {
  contribution.forEach((value, index) => {
    target[index] += value;
    activity[index] += Math.abs(value);
  });
};

export const compareGeneralizedLoads = (
  source: number[],
  assembled: number[],
  activity: number[],
): GeneralizedLoadComparison => {
  const difference = assembled.map((value, index) => value - source[index]);
  const forceIndices = [0, 1, 3, 4];
  const momentIndices = [2, 5];
  const forceFamilyScale = Math.max(1e-12, ...forceIndices.flatMap((index) => [activity[index] ?? 0, Math.abs(source[index]), Math.abs(assembled[index])]));
  const momentFamilyScale = Math.max(1e-12, ...momentIndices.flatMap((index) => [activity[index] ?? 0, Math.abs(source[index]), Math.abs(assembled[index])]));
  const globalRoundoffScale = Math.max(1, ...activity.map(Math.abs), ...source.map(Math.abs), ...assembled.map(Math.abs));
  const roundoffTolerance = Number.EPSILON * 1024 * globalRoundoffScale;
  const normalizedResidual = Math.max(...difference.map((value, index) => {
    if (Math.abs(value) <= roundoffTolerance) return 0;
    const familyFloor = 1e-6 * (momentIndices.includes(index) ? momentFamilyScale : forceFamilyScale);
    const scale = Math.max(1e-12, activity[index] ?? 0, Math.abs(source[index]), Math.abs(assembled[index]), familyFloor);
    return Math.abs(value) / scale;
  }));
  return { source, assembled, difference, normalizedResidual };
};

/**
 * Independent source-load integration for one member. This module deliberately
 * does not import solver geometry, interpolation, quadrature, or assembly code.
 */
export const integrateIndependentMemberSourceLoads = (
  project: ProjectModel,
  member: MemberModel,
  factors: Record<string, number>,
): IndependentMemberSourceLoads | null => {
  const nodeI = project.nodes.find((node) => node.id === member.i);
  const nodeJ = project.nodes.find((node) => node.id === member.j);
  if (!nodeI || !nodeJ || member.type === 'rigid') return null;
  const dx = nodeJ.x - nodeI.x;
  const dy = nodeJ.y - nodeI.y;
  const grossLength = Math.hypot(dx, dy);
  const startOffset = member.rigidOffsetI ?? 0;
  const endOffset = member.rigidOffsetJ ?? 0;
  const length = grossLength - startOffset - endOffset;
  if (!(grossLength > 0) || !(length > 0)) return null;
  const c = dx / grossLength;
  const s = dy / grossLength;
  const fields = virtualFields(member, length);
  const bendingDofs = [1, 2, 4, 5];
  const axialFields: [Polynomial, Polynomial] = [[1, -1], [0, 1]];
  const mechanical = Array(6).fill(0);
  const mechanicalActivity = Array(6).fill(0);
  const initial = Array(6).fill(0);
  const initialActivity = Array(6).fill(0);
  const toLocal = (x: number, y: number, axes: 'global' | 'local'): [number, number] => axes === 'local'
    ? [x, y]
    : [c * x + s * y, -s * x + c * y];
  const addPoint = (xi: number, px: number, py: number): void => {
    const contribution = Array(6).fill(0);
    contribution[0] = (1 - xi) * px;
    contribution[3] = xi * px;
    fields.transverse.forEach((polynomial, index) => { contribution[bendingDofs[index]] = evaluate(polynomial, xi) * py; });
    addContribution(mechanical, mechanicalActivity, contribution);
  };
  const addMoment = (xi: number, moment: number): void => {
    const contribution = Array(6).fill(0);
    fields.rotation.forEach((polynomial, index) => { contribution[bendingDofs[index]] = evaluate(polynomial, xi) * moment; });
    addContribution(mechanical, mechanicalActivity, contribution);
  };
  const addDistributed = (eta: number, zeta: number, qxA: number, qxB: number, qyA: number, qyB: number): void => {
    const contribution = Array(6).fill(0);
    contribution[0] = integratePolynomialTimesLinear(axialFields[0], qxA, qxB, eta, zeta, length);
    contribution[3] = integratePolynomialTimesLinear(axialFields[1], qxA, qxB, eta, zeta, length);
    fields.transverse.forEach((polynomial, index) => {
      contribution[bendingDofs[index]] = integratePolynomialTimesLinear(polynomial, qyA, qyB, eta, zeta, length);
    });
    addContribution(mechanical, mechanicalActivity, contribution);
  };

  for (const load of project.memberLoads) {
    if (load.memberId !== member.id) continue;
    const factor = factors[load.caseId] ?? 0;
    if (factor === 0) continue;
    if (load.type === 'point') {
      const [px, py] = toLocal(load.px ?? 0, load.py ?? 0, load.coordinateSystem);
      addPoint(Math.min(1, Math.max(0, load.position ?? 0.5)), px * factor, py * factor);
      continue;
    }
    if (load.type === 'moment') {
      addMoment(Math.min(1, Math.max(0, load.position ?? 0.5)), (load.moment ?? 0) * factor);
      continue;
    }
    const basisScale = (load.lengthBasis === 'horizontal' ? Math.abs(c) : load.lengthBasis === 'vertical' ? Math.abs(s) : 1) * factor;
    const [qxA, qyA] = toLocal(load.qxStart ?? 0, load.qyStart ?? 0, load.coordinateSystem);
    const [qxB, qyB] = toLocal(load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0, load.coordinateSystem);
    addDistributed(load.start, load.end, qxA * basisScale, qxB * basisScale, qyA * basisScale, qyB * basisScale);
  }

  const selfWeightFactor = project.loadCases.reduce(
    (sum, loadCase) => sum + (factors[loadCase.id] ?? 0) * (loadCase.selfWeightFactor ?? 0),
    0,
  );
  if (selfWeightFactor !== 0 && member.density && member.A > 0) {
    const weight = (member.density * 9.80665 * member.A) / 1000 * selfWeightFactor;
    const [qx, qy] = toLocal(0, -weight, 'global');
    addDistributed(0, 1, qx, qx, qy, qy);
  }

  let axialStrain = 0;
  let curvature = 0;
  for (const effect of project.memberInitialEffects ?? []) {
    if (effect.memberId !== member.id) continue;
    const factor = factors[effect.caseId] ?? 0;
    if (factor === 0) continue;
    if (effect.type === 'temperature') {
      const alpha = effect.alpha ?? 1.2e-5;
      axialStrain += factor * alpha * (effect.deltaT ?? 0);
      curvature -= factor * alpha * (effect.gradient ?? 0);
    } else {
      axialStrain += factor * (effect.axialStrain ?? 0);
      curvature += factor * (effect.curvature ?? 0);
    }
  }
  const axial = member.E * member.A * axialStrain;
  const moment = member.type === 'frame' ? member.E * member.I * curvature : 0;
  addContribution(initial, initialActivity, [-axial, 0, -moment, axial, 0, moment]);
  const total = mechanical.map((value, index) => value + initial[index]);
  const totalActivity = mechanicalActivity.map((value, index) => value + initialActivity[index]);
  return {
    geometry: { grossLength, length, c, s, startOffset, endOffset },
    mechanical,
    mechanicalActivity,
    initial,
    initialActivity,
    total,
    totalActivity,
  };
};
