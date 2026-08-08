import { describe, expect, it } from 'vitest';
import type { AnalysisResult, EducationalAssertion, MemberResult, NodeResult } from '../types';
import { evaluateEducationalAssertions } from './educationalAssertions';

const node: NodeResult = { nodeId: 'A', ux: 0.001, uy: -0.002, rz: 0.003, rx: 4, ry: 5, rm: 6 };
const member: MemberResult = {
  memberId: 'AB', length: 2, localDisplacements: [], localEndForces: [1, 2, 3, 4, 5, 6],
  diagramSegments: [], diagramJumps: [], criticalPoints: [], diagram: [], deformation: [], deformationSegments: [], deformationCriticalPoints: [],
  maxAxial: 10, minAxial: -12, maxShear: 8, minShear: -7, maxMoment: 20, minMoment: -5,
};
const result: AnalysisResult = {
  success: true, issues: [], nodeResults: [node], memberResults: [member], displacements: [],
  residualNorm: 0, conditionEstimate: 1, equilibrium: { sumFx: 0, sumFy: 0, sumM: 0, normalizedComponents: { fx: 0, fy: 0, mz: 0 }, normalizedResidual: 0 }, explanation: [],
};

describe('educational assertions', () => {
  it('compares reactions, displacements, member extrema and local end forces', () => {
    const assertions: EducationalAssertion[] = [
      { id: 'r', label: 'RAy', target: { kind: 'node-result', nodeId: 'A', component: 'ry' }, expected: 5 },
      { id: 'd', label: 'uAy', target: { kind: 'node-result', nodeId: 'A', component: 'uy' }, expected: -0.002 },
      { id: 'e', label: '|N|max', target: { kind: 'member-extreme', memberId: 'AB', quantity: 'axial', extreme: 'absolute-maximum' }, expected: 12 },
      { id: 'f', label: 'Mj', target: { kind: 'member-end-force', memberId: 'AB', end: 'j', quantity: 'moment' }, expected: 6 },
    ];
    const evaluated = evaluateEducationalAssertions(assertions, result);
    expect(evaluated).toHaveLength(4);
    expect(evaluated.every((entry) => entry.passed)).toBe(true);
  });

  it('uses combined absolute and relative tolerance and reports both errors', () => {
    const [evaluation] = evaluateEducationalAssertions([{
      id: 'near', label: 'RAy', target: { kind: 'node-result', nodeId: 'A', component: 'ry' },
      expected: 5.001, atol: 0.0005, rtol: 0.0001,
    }], result);
    expect(evaluation.tolerance).toBeCloseTo(0.0010001);
    expect(evaluation.absoluteError).toBeCloseTo(0.001);
    expect(evaluation.relativeError).toBeCloseTo(0.001 / 5.001);
    expect(evaluation.passed).toBe(true);
  });

  it('fails safely when a referenced result is unavailable', () => {
    const [evaluation] = evaluateEducationalAssertions([{
      id: 'missing', label: 'Nodo ausente', target: { kind: 'node-result', nodeId: 'Z', component: 'rx' }, expected: 0,
    }], result);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.actual).toBeNaN();
    expect(evaluation.unavailableReason).toMatch(/nodo Z/i);
  });
});
