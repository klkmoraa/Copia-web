import { describe, expect, it } from 'vitest';
import { buildCanvasSelectionVisualState, selectionEnvelopeForPoints, selectionEnvelopeHandles } from './selectionVisuals';

describe('canvas selection visuals', () => {
  it('normalizes every selectable kind without changing the domain selection', () => {
    expect(buildCanvasSelectionVisualState(null)).toMatchObject({ kind: 'none', count: 0 });
    expect(buildCanvasSelectionVisualState({ kind: 'node', id: 'N2' })).toMatchObject({ kind: 'node', nodeIds: ['N2'], count: 1 });
    expect(buildCanvasSelectionVisualState({ kind: 'member', id: 'M4' })).toMatchObject({ kind: 'member', memberIds: ['M4'], count: 1 });
    expect(buildCanvasSelectionVisualState({ kind: 'nodalLoad', id: 'NL1' })).toMatchObject({ kind: 'nodalLoad', nodalLoadId: 'NL1', count: 1 });
    expect(buildCanvasSelectionVisualState({ kind: 'memberLoad', id: 'ML1' })).toMatchObject({ kind: 'memberLoad', memberLoadId: 'ML1', count: 1 });
  });

  it('preserves all node/member ids and count for a multi selection', () => {
    expect(buildCanvasSelectionVisualState({ kind: 'multi', nodeIds: ['N2', 'N1'], memberIds: ['M3'] })).toEqual({
      kind: 'multi',
      nodeIds: ['N2', 'N1'],
      memberIds: ['M3'],
      nodalLoadId: null,
      memberLoadId: null,
      count: 3,
    });
  });

  it('builds a padded envelope and four geometric handles', () => {
    const envelope = selectionEnvelopeForPoints([{ x: 80, y: 60 }, { x: 240, y: 180 }], { x: 0, y: 0, width: 400, height: 300 }, 20);
    expect(envelope).toEqual({ x: 60, y: 40, width: 200, height: 160 });
    expect(selectionEnvelopeHandles(envelope!)).toEqual([
      { x: 60, y: 40 },
      { x: 260, y: 40 },
      { x: 260, y: 200 },
      { x: 60, y: 200 },
    ]);
  });

  it('clips the envelope to the visible canvas bounds', () => {
    expect(selectionEnvelopeForPoints([{ x: -10, y: 10 }, { x: 390, y: 310 }], { x: 0, y: 0, width: 360, height: 280 }, 24)).toEqual({
      x: 0,
      y: 0,
      width: 360,
      height: 280,
    });
    expect(selectionEnvelopeForPoints([], { x: 0, y: 0, width: 360, height: 280 })).toBeNull();
  });
});
