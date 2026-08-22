import { describe, expect, it } from 'vitest';
import {
  activeEditorLayerPreset,
  createEditorLayerState,
  editorLayerReducer,
  parseEditorLayerState,
} from './editorLayers';

describe('editor layer state', () => {
  it('starts with every presentation layer visible except the heatmap', () => {
    expect(createEditorLayerState()).toEqual({
      model: true,
      loads: true,
      dimensions: true,
      ids: true,
      results: true,
      labels: true,
      help: true,
      diagnostics: true,
      // El mapa de calor reinterpreta el color del dibujo técnico: se pide, no se hereda.
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

  it('applies a preset as a whole view instead of toggling one entry', () => {
    const results = editorLayerReducer(createEditorLayerState(), { type: 'preset', preset: 'results' });
    expect(results).toMatchObject({ model: true, results: true, heatmap: true, loads: false, help: false });

    const clean = editorLayerReducer(results, { type: 'preset', preset: 'clean' });
    expect(clean).toMatchObject({ model: true, ids: false, labels: false, diagnostics: false, heatmap: false });
  });

  it('reports the preset that matches the current view, and none once the user diverges', () => {
    const state = createEditorLayerState();
    expect(activeEditorLayerPreset(state)).toBe('all');
    expect(activeEditorLayerPreset(editorLayerReducer(state, { type: 'preset', preset: 'loads' }))).toBe('loads');
    expect(activeEditorLayerPreset(editorLayerReducer(state, { type: 'toggle', layer: 'ids' }))).toBeNull();
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
