import type { AnalysisResult, DiagramQuantity } from '../../types';

export type ProvenanceStatus = 'resolved' | 'insufficient-evidence';
export type ResultQuantity = 'R' | 'U' | 'N' | 'V' | 'M';

export interface ResultRef {
  quantity: ResultQuantity;
  entity: { kind: 'node' | 'member'; id: string };
  component?: 'x' | 'y' | 'rotation';
  caseOrCombinationId: string;
  signConvention: string;
  position?: { x: number; side?: 'left' | 'right' | 'continuous' };
}

export interface ExplanationAnchor {
  status: ProvenanceStatus;
  ref: ResultRef;
  value: number | null;
  unit: 'm' | 'rad' | 'kN' | 'kN·m';
  source: string | null;
  explanationStepIds: string[];
  reason?: string;
}

const nodeUnit = (ref: ResultRef): ExplanationAnchor['unit'] => {
  if (ref.component === 'rotation') return ref.quantity === 'U' ? 'rad' : 'kN·m';
  return ref.quantity === 'U' ? 'm' : 'kN';
};

const memberField = (quantity: ResultQuantity): DiagramQuantity | null => (
  quantity === 'N' ? 'axial' : quantity === 'V' ? 'shear' : quantity === 'M' ? 'moment' : null
);

const insufficient = (ref: ResultRef, unit: ExplanationAnchor['unit'], reason: string): ExplanationAnchor => ({
  status: 'insufficient-evidence',
  ref,
  value: null,
  unit,
  source: null,
  explanationStepIds: [],
  reason,
});

export const resolveExplanationAnchor = (analysis: AnalysisResult | null | undefined, ref: ResultRef): ExplanationAnchor => {
  if (ref.entity.kind === 'node') {
    const unit = nodeUnit(ref);
    if (!analysis || (ref.quantity !== 'R' && ref.quantity !== 'U') || !ref.component) return insufficient(ref, unit, 'missing-node-relationship');
    const result = analysis.nodeResults.find((candidate) => candidate.nodeId === ref.entity.id);
    if (!result) return insufficient(ref, unit, 'missing-node-result');
    const field = ref.quantity === 'U'
      ? ref.component === 'x' ? 'ux' : ref.component === 'y' ? 'uy' : 'rz'
      : ref.component === 'x' ? 'rx' : ref.component === 'y' ? 'ry' : 'rm';
    return {
      status: 'resolved',
      ref,
      value: result[field],
      unit,
      source: `AnalysisResult.nodeResults[${ref.entity.id}].${field}`,
      explanationStepIds: analysis.explanation.filter((step) => step.relatedNodeIds?.includes(ref.entity.id)).map((step) => step.id),
    };
  }

  const field = memberField(ref.quantity);
  const unit = ref.quantity === 'M' ? 'kN·m' : 'kN';
  if (!analysis || !field || !ref.position) return insufficient(ref, unit, 'missing-member-relationship');
  const result = analysis.memberResults.find((candidate) => candidate.memberId === ref.entity.id);
  if (!result) return insufficient(ref, unit, 'missing-member-result');
  const sideMatches = (side?: 'left' | 'right' | 'continuous') => !ref.position?.side || !side || side === ref.position.side;
  const storedPoint = result.diagram.find((point) => point.x === ref.position?.x && sideMatches(point.side));
  if (storedPoint) return {
    status: 'resolved',
    ref,
    value: storedPoint[field],
    unit,
    source: `AnalysisResult.memberResults[${ref.entity.id}].diagram[x=${ref.position.x}].${field}`,
    explanationStepIds: analysis.explanation.filter((step) => step.relatedMemberIds?.includes(ref.entity.id)).map((step) => step.id),
  };
  const criticalIndex = result.criticalPoints.findIndex((point) => point.quantity === field && point.x === ref.position?.x && sideMatches(point.side));
  if (criticalIndex >= 0) return {
    status: 'resolved',
    ref,
    value: result.criticalPoints[criticalIndex].value,
    unit,
    source: `AnalysisResult.memberResults[${ref.entity.id}].criticalPoints[${criticalIndex}].value`,
    explanationStepIds: analysis.explanation.filter((step) => step.relatedMemberIds?.includes(ref.entity.id)).map((step) => step.id),
  };
  return insufficient(ref, unit, 'position-not-stored');
};
