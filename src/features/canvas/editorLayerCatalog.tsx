import {
  Box,
  ChartNoAxesCombined,
  Flame,
  HelpCircle,
  Ruler,
  Tags,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { EditorLayerId, EditorLayerPresetId } from './editorLayers';

/**
 * Qué capa es qué: rótulo, explicación e icono.
 *
 * Vivía dentro de `CanvasLayers`, el panel flotante que colgaba del lienzo. Ese
 * panel se borró —controlaba casi lo mismo que la pestaña «Vista», con su
 * propio almacén, y era el segundo destino de una decisión que sólo debería
 * tener uno—, pero el catálogo no era suyo: describe las capas, no su
 * presentación. Vive aquí, junto al reducer que las guarda, y lo consume la
 * única superficie de visualización que queda.
 */
export interface EditorLayerDefinition {
  id: EditorLayerId;
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  icon: LucideIcon;
}

export const EDITOR_LAYER_DEFINITIONS: readonly EditorLayerDefinition[] = [
  { id: 'model', labelKey: 'canvas.layerModel', detailKey: 'canvas.layerModelDetail', icon: Box },
  { id: 'loads', labelKey: 'canvas.layerLoads', detailKey: 'canvas.layerLoadsDetail', icon: Zap },
  { id: 'dimensions', labelKey: 'canvas.layerDimensions', detailKey: 'canvas.layerDimensionsDetail', icon: Ruler },
  { id: 'ids', labelKey: 'canvas.layerIds', detailKey: 'canvas.layerIdsDetail', icon: Tags },
  { id: 'results', labelKey: 'canvas.layerResults', detailKey: 'canvas.layerResultsDetail', icon: ChartNoAxesCombined },
  { id: 'labels', labelKey: 'canvas.layerLabels', detailKey: 'canvas.layerLabelsDetail', icon: Tags },
  { id: 'help', labelKey: 'canvas.layerHelp', detailKey: 'canvas.layerHelpDetail', icon: HelpCircle },
  { id: 'diagnostics', labelKey: 'canvas.layerDiagnostics', detailKey: 'canvas.layerDiagnosticsDetail', icon: TriangleAlert },
  { id: 'heatmap', labelKey: 'canvas.layerHeatmap', detailKey: 'canvas.layerHeatmapDetail', icon: Flame },
] as const;

export const EDITOR_LAYER_PRESET_DEFINITIONS: ReadonlyArray<{ id: EditorLayerPresetId; labelKey: TranslationKey }> = [
  { id: 'all', labelKey: 'canvas.layerPresetAll' },
  { id: 'model', labelKey: 'canvas.layerPresetModel' },
  { id: 'loads', labelKey: 'canvas.layerPresetLoads' },
  { id: 'results', labelKey: 'canvas.layerPresetResults' },
  { id: 'clean', labelKey: 'canvas.layerPresetClean' },
] as const;
