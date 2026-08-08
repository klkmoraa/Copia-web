import type { Selection } from '../../types';

export interface CanvasSelectionVisualState {
  kind: 'none' | 'node' | 'member' | 'multi' | 'nodalLoad' | 'memberLoad';
  nodeIds: string[];
  memberIds: string[];
  nodalLoadId: string | null;
  memberLoadId: string | null;
  count: number;
}

export interface SelectionEnvelope {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionEnvelopeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const buildCanvasSelectionVisualState = (selection: Selection): CanvasSelectionVisualState => {
  if (!selection) return { kind: 'none', nodeIds: [], memberIds: [], nodalLoadId: null, memberLoadId: null, count: 0 };
  if (selection.kind === 'node') return { kind: 'node', nodeIds: [selection.id], memberIds: [], nodalLoadId: null, memberLoadId: null, count: 1 };
  if (selection.kind === 'member') return { kind: 'member', nodeIds: [], memberIds: [selection.id], nodalLoadId: null, memberLoadId: null, count: 1 };
  if (selection.kind === 'nodalLoad') return { kind: 'nodalLoad', nodeIds: [], memberIds: [], nodalLoadId: selection.id, memberLoadId: null, count: 1 };
  if (selection.kind === 'memberLoad') return { kind: 'memberLoad', nodeIds: [], memberIds: [], nodalLoadId: null, memberLoadId: selection.id, count: 1 };
  return {
    kind: 'multi',
    nodeIds: [...selection.nodeIds],
    memberIds: [...selection.memberIds],
    nodalLoadId: null,
    memberLoadId: null,
    count: selection.nodeIds.length + selection.memberIds.length,
  };
};

export const selectionEnvelopeForPoints = (
  points: Array<{ x: number; y: number }>,
  bounds: SelectionEnvelopeBounds,
  padding = 18,
): SelectionEnvelope | null => {
  if (!points.length || bounds.width <= 0 || bounds.height <= 0) return null;
  const minX = Math.min(...points.map((point) => point.x)) - padding;
  const maxX = Math.max(...points.map((point) => point.x)) + padding;
  const minY = Math.min(...points.map((point) => point.y)) - padding;
  const maxY = Math.max(...points.map((point) => point.y)) + padding;
  const x = clamp(minX, bounds.x, bounds.x + bounds.width);
  const y = clamp(minY, bounds.y, bounds.y + bounds.height);
  const right = clamp(maxX, bounds.x, bounds.x + bounds.width);
  const bottom = clamp(maxY, bounds.y, bounds.y + bounds.height);
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
};

export const selectionEnvelopeHandles = (envelope: SelectionEnvelope): Array<{ x: number; y: number }> => [
  { x: envelope.x, y: envelope.y },
  { x: envelope.x + envelope.width, y: envelope.y },
  { x: envelope.x + envelope.width, y: envelope.y + envelope.height },
  { x: envelope.x, y: envelope.y + envelope.height },
];
