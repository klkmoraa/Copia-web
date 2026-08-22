import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../../types';
import { resolveExplanationAnchor, type ResultRef } from './provenance';

const analysis = {
  nodeResults: [{ nodeId: 'N1', ux: 0, uy: -0.002, rz: 0, rx: 0, ry: 12.5, rm: 0 }],
  memberResults: [{
    memberId: 'M1',
    diagram: [
      { x: 0, axial: 0, shear: 12.5, moment: 0, side: 'continuous' },
      { x: 2, axial: 0, shear: 0, moment: 8.75, side: 'continuous' },
    ],
    criticalPoints: [{ x: 2, quantity: 'moment', value: 8.75, kind: 'maximum', side: 'continuous' }],
  }],
  explanation: [
    { id: 'eq-node', relatedNodeIds: ['N1'] },
    { id: 'eq-member', relatedMemberIds: ['M1'] },
  ],
} as unknown as AnalysisResult;

const base = {
  caseOrCombinationId: 'COMB1',
  signConvention: 'global +Y',
} as const;

describe('resolveExplanationAnchor', () => {
  it('anchors reactions directly to a stored node result', () => {
    const ref: ResultRef = { ...base, quantity: 'R', entity: { kind: 'node', id: 'N1' }, component: 'y' };
    expect(resolveExplanationAnchor(analysis, ref)).toMatchObject({
      status: 'resolved',
      value: 12.5,
      unit: 'kN',
      source: 'AnalysisResult.nodeResults[N1].ry',
      explanationStepIds: ['eq-node'],
    });
  });

  it('anchors N, V and M only at stored runtime positions', () => {
    const ref: ResultRef = { ...base, quantity: 'M', entity: { kind: 'member', id: 'M1' }, position: { x: 2, side: 'continuous' } };
    expect(resolveExplanationAnchor(analysis, ref)).toMatchObject({ status: 'resolved', value: 8.75, unit: 'kN·m', source: 'AnalysisResult.memberResults[M1].diagram[x=2].moment' });
  });

  it('reports insufficient evidence instead of evaluating a diagram', () => {
    const ref: ResultRef = { ...base, quantity: 'V', entity: { kind: 'member', id: 'M1' }, position: { x: 1.25 } };
    expect(resolveExplanationAnchor(analysis, ref)).toMatchObject({ status: 'insufficient-evidence', value: null, source: null });
  });

  it('reports insufficient evidence for a missing relationship', () => {
    const ref: ResultRef = { ...base, quantity: 'U', entity: { kind: 'node', id: 'N404' }, component: 'x' };
    expect(resolveExplanationAnchor(analysis, ref).status).toBe('insufficient-evidence');
  });
});
