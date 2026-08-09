import { describe, expect, it } from 'vitest';
import { createEditorLayerState, editorLayerReducer, parseEditorLayerState } from './editorLayers';

describe('editor layer state', () => {
  it('starts with every presentation layer visible', () => {
    expect(createEditorLayerState()).toEqual({
      model: true,
      loads: true,
      dimensions: true,
      ids: true,
      results: true,
      labels: true,
      help: true,
      diagnostics: true,
      heatmap: false,
    });
  });

  it('toggles presentation layers without allowing the model to disappear', () => {
    const initial = createEditorLayerState();
    const withoutLoads = editorLayerReducer(initial, { type: 'toggle', layer: 'loads' });
    expect(withoutLoads.loads).toBe(false);
    expect(withoutLoads.model).toBe(true);
    expect(editorLayerReducer(withoutLoads, { type: 'toggle', layer: 'model' })).toBe(withoutLoads);
    expect(editorLayerReducer(withoutLoads, { type: 'set', layer: 'model', visible: false })).toBe(withoutLoads);
  });

  it('resets all ephemeral choices to the documented defaults', () => {
    const changed = editorLayerReducer(
      editorLayerReducer(createEditorLayerState(), { type: 'toggle', layer: 'labels' }),
      { type: 'toggle', layer: 'results' },
    );
    expect(editorLayerReducer(changed, { type: 'reset' })).toEqual(createEditorLayerState());
  });

  it('restores only validated presentation values and always protects the model', () => {
    expect(parseEditorLayerState('{invalid')).toEqual(createEditorLayerState());
    expect(parseEditorLayerState(JSON.stringify({ model: false, loads: false, labels: true }))).toMatchObject({
      model: true,
      loads: false,
      labels: true,
      results: true,
    });
  });
});
