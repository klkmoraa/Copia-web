import type { Dispatch } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { ResultTab } from '../../store/ProjectContext';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';

/**
 * N / V / M / deformada / mapa as canvas evidence layers (CRI-100): picking one
 * lights up a layer on the drawing, it never opens a panel. Built entirely on top
 * of the existing `resultTab` (which quantity) and `editorLayers` (`results` /
 * `heatmap`, whether the overlay paints) machinery — no parallel system.
 */
export type EvidenceLayerId = 'axial' | 'shear' | 'moment' | 'deformed' | 'heatmap';

export interface EvidenceLayerDefinition {
  id: EvidenceLayerId;
  labelKey: TranslationKey;
  /** The `resultTab` this evidence renders, or `null` for the demand map (its own boolean layer). */
  resultTab: ResultTab | null;
}

export const EVIDENCE_LAYERS: readonly EvidenceLayerDefinition[] = [
  { id: 'axial', labelKey: 'results.axial', resultTab: 'axial' },
  { id: 'shear', labelKey: 'results.shear', resultTab: 'shear' },
  { id: 'moment', labelKey: 'results.moment', resultTab: 'moment' },
  { id: 'deformed', labelKey: 'results.deformed', resultTab: 'deformed' },
  { id: 'heatmap', labelKey: 'canvas.layerHeatmap', resultTab: null },
];

/** Whether an evidence layer is currently lit on the canvas. */
export const isEvidenceLayerActive = (
  id: EvidenceLayerId,
  resultTab: ResultTab,
  layers: EditorLayerState,
): boolean => {
  if (id === 'heatmap') return layers.heatmap;
  const definition = EVIDENCE_LAYERS.find((item) => item.id === id);
  return Boolean(layers.results && definition?.resultTab === resultTab);
};

/**
 * Picking evidence only flips presentation state — `resultTab` and the
 * `results`/`heatmap` editor layers — never the project model, and never
 * triggers `analyze()`. Picking the already-active layer turns it off, same as
 * any other layer toggle.
 */
export const applyEvidenceLayerChoice = (
  id: EvidenceLayerId,
  current: { resultTab: ResultTab; layers: EditorLayerState },
  actions: { setResultTab: (tab: ResultTab) => void; dispatchLayers: Dispatch<EditorLayerAction> },
): void => {
  if (id === 'heatmap') {
    actions.dispatchLayers({ type: 'toggle', layer: 'heatmap' });
    return;
  }
  const definition = EVIDENCE_LAYERS.find((item) => item.id === id);
  const tab = definition?.resultTab;
  if (!tab) return;
  if (isEvidenceLayerActive(id, current.resultTab, current.layers)) {
    actions.dispatchLayers({ type: 'set', layer: 'results', visible: false });
    return;
  }
  actions.setResultTab(tab);
  if (!current.layers.results) actions.dispatchLayers({ type: 'set', layer: 'results', visible: true });
};

/**
 * Unconditionally lights an evidence layer on, without reading current layer
 * state first — for callers like the Command Palette that don't hold a live
 * `EditorLayerState` and whose intent ("go to N") is never a toggle.
 */
export const activateEvidenceLayer = (
  id: EvidenceLayerId,
  actions: { setResultTab: (tab: ResultTab) => void; dispatchLayers: Dispatch<EditorLayerAction> },
): void => {
  if (id === 'heatmap') {
    actions.dispatchLayers({ type: 'set', layer: 'heatmap', visible: true });
    return;
  }
  const definition = EVIDENCE_LAYERS.find((item) => item.id === id);
  if (!definition?.resultTab) return;
  actions.setResultTab(definition.resultTab);
  actions.dispatchLayers({ type: 'set', layer: 'results', visible: true });
};
