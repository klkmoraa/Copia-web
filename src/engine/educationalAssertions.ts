import type {
  AnalysisResult,
  DiagramQuantity,
  EducationalAssertion,
  EducationalAssertionTarget,
  MemberResult,
} from '../types';

export interface EducationalAssertionEvaluation {
  assertion: EducationalAssertion;
  actual: number;
  expected: number;
  absoluteError: number;
  relativeError: number;
  tolerance: number;
  passed: boolean;
  unavailableReason?: string;
}

const memberExtreme = (member: MemberResult, quantity: DiagramQuantity, extreme: 'maximum' | 'minimum' | 'absolute-maximum'): number => {
  const maximum = quantity === 'axial' ? member.maxAxial : quantity === 'shear' ? member.maxShear : member.maxMoment;
  const minimum = quantity === 'axial' ? member.minAxial : quantity === 'shear' ? member.minShear : member.minMoment;
  if (extreme === 'maximum') return maximum;
  if (extreme === 'minimum') return minimum;
  return Math.max(Math.abs(maximum), Math.abs(minimum));
};

const endForce = (member: MemberResult, end: 'i' | 'j', quantity: DiagramQuantity): number | undefined => {
  const component = quantity === 'axial' ? 0 : quantity === 'shear' ? 1 : 2;
  return member.localEndForces[(end === 'i' ? 0 : 3) + component];
};

const actualForTarget = (result: AnalysisResult, target: EducationalAssertionTarget): { value?: number; reason?: string } => {
  if (target.kind === 'node-result') {
    const node = result.nodeResults.find((candidate) => candidate.nodeId === target.nodeId);
    return node ? { value: node[target.component] } : { reason: `No existe resultado para el nodo ${target.nodeId}.` };
  }
  const member = result.memberResults.find((candidate) => candidate.memberId === target.memberId);
  if (!member) return { reason: `No existe resultado para el miembro ${target.memberId}.` };
  if (target.kind === 'member-extreme') return { value: memberExtreme(member, target.quantity, target.extreme) };
  const value = endForce(member, target.end, target.quantity);
  return value === undefined
    ? { reason: `No existe la fuerza de extremo solicitada para el miembro ${target.memberId}.` }
    : { value };
};

/** Evaluates educational expectations against one solver result without mutating either input. */
export const evaluateEducationalAssertions = (
  assertions: readonly EducationalAssertion[],
  result: AnalysisResult,
): EducationalAssertionEvaluation[] => assertions.map((assertion) => {
  const resolved = actualForTarget(result, assertion.target);
  const actual = resolved.value ?? Number.NaN;
  const absoluteError = Math.abs(actual - assertion.expected);
  const scale = Math.max(Math.abs(actual), Math.abs(assertion.expected));
  const relativeError = absoluteError === 0 ? 0 : scale > 0 ? absoluteError / scale : Number.POSITIVE_INFINITY;
  const tolerance = (assertion.atol ?? 1e-9) + (assertion.rtol ?? 1e-7) * scale;
  return {
    assertion,
    actual,
    expected: assertion.expected,
    absoluteError,
    relativeError,
    tolerance,
    passed: result.success && Number.isFinite(actual) && absoluteError <= tolerance,
    unavailableReason: resolved.reason,
  };
});
