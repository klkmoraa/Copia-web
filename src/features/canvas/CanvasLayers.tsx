import {
  Box,
  ChartNoAxesCombined,
  Flame,
  Grid3x3,
  HelpCircle,
  Layers3,
  Magnet,
  Ruler,
  Tags,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState, type Dispatch } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import { LayerToggle } from '../../design-system/components/editor';
import { Popover } from '../../design-system/components/overlays';
import type { ResultTab } from '../../store/ProjectContext';
import { activeEditorLayerPreset, type EditorLayerAction, type EditorLayerId, type EditorLayerPresetId, type EditorLayerState } from './editorLayers';
import { applyEvidenceLayerChoice, isEvidenceLayerActive, EVIDENCE_LAYERS } from './evidenceLayers';

interface LayerDefinition {
  id: EditorLayerId;
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  icon: LucideIcon;
}

const layerDefinitions: readonly LayerDefinition[] = [
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

const presetDefinitions: ReadonlyArray<{ id: EditorLayerPresetId; labelKey: TranslationKey }> = [
  { id: 'all', labelKey: 'canvas.layerPresetAll' },
  { id: 'model', labelKey: 'canvas.layerPresetModel' },
  { id: 'loads', labelKey: 'canvas.layerPresetLoads' },
  { id: 'results', labelKey: 'canvas.layerPresetResults' },
  { id: 'clean', labelKey: 'canvas.layerPresetClean' },
] as const;

export interface CanvasLayersProps {
  layers: EditorLayerState;
  dispatch: Dispatch<EditorLayerAction>;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  snapEnabled: boolean;
  gridEnabled: boolean;
  onSnapChange: (snap: boolean) => void;
  onGridChange: (grid: boolean) => void;
}

/**
 * Qué estoy viendo: capas del modelo y snap/rejilla en un mismo popover del
 * sistema (`Popover`, el mismo que funde las cuatro decisiones de análisis en
 * la barra superior desde la fase 2) — antes snap/rejilla eran dos chips
 * inertes aparte (`pointer-events:none`, invisibles a ≤460px) que ni
 * conmutaban nada ni pertenecían a ningún grupo; el único sitio donde sí se
 * podían cambiar era una casilla duplicada en Inspector › Vista.
 */
export const CanvasLayers = ({
  layers,
  dispatch,
  resultTab,
  setResultTab,
  snapEnabled,
  gridEnabled,
  onSnapChange,
  onGridChange,
}: CanvasLayersProps) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const currentPreset = activeEditorLayerPreset(layers);

  return <Popover
    label={t('canvas.layers')}
    trigger={<Layers3 size={18} />}
    open={open}
    onOpenChange={setOpen}
    align="end"
    className="canvas-layer-popover"
  >
    <div className="canvas-layer-view-toggles" role="group" aria-label={t('canvas.viewStatus')}>
      <LayerToggle
        className="canvas-layer-row"
        label={t('canvas.snapShort')}
        description={snapEnabled ? t('canvas.snapOn') : t('canvas.snapOff')}
        icon={<Magnet size={18} />}
        checked={snapEnabled}
        onCheckedChange={onSnapChange}
      />
      <LayerToggle
        className="canvas-layer-row"
        label={t('canvas.gridShort')}
        description={gridEnabled ? t('canvas.gridOn') : t('canvas.gridOff')}
        icon={<Grid3x3 size={18} />}
        checked={gridEnabled}
        onCheckedChange={onGridChange}
      />
    </div>
    <div className="canvas-layer-presets" role="group" aria-label={t('canvas.layerPresets')}>
      {presetDefinitions.map(({ id, labelKey }) => <button
        key={id}
        type="button"
        className={`canvas-layer-preset${currentPreset === id ? ' active' : ''}`}
        aria-pressed={currentPreset === id}
        data-layer-preset={id}
        onClick={() => dispatch({ type: 'preset', preset: id })}
      >{t(labelKey)}</button>)}
    </div>
    {/* N / V / M / deformada / mapa se eligen aquí como capa (CRI-100): elegir
        una enciende el escalón sobre el dibujo, nunca abre una pestaña ni un
        panel de resultados. */}
    <div className="canvas-evidence-layers" role="group" aria-label={t('canvas.evidenceLayers')}>
      <span className="canvas-evidence-layers__label">{t('canvas.evidenceLayers')}</span>
      <div className="canvas-evidence-layers__options">
        {EVIDENCE_LAYERS.map(({ id, labelKey }) => <button
          key={id}
          type="button"
          className={`canvas-evidence-layer canvas-evidence-layer--${id}`}
          aria-pressed={isEvidenceLayerActive(id, resultTab, layers)}
          data-evidence-layer={id}
          onClick={() => applyEvidenceLayerChoice(id, { resultTab, layers }, { setResultTab, dispatchLayers: dispatch })}
        >{t(labelKey)}</button>)}
      </div>
    </div>
    <div className="canvas-layer-list">
      {layerDefinitions.map(({ id, labelKey, detailKey, icon: Icon }) => {
        const fixed = id === 'model';
        return <LayerToggle
          key={id}
          className="canvas-layer-row"
          label={t(labelKey)}
          description={t(detailKey)}
          icon={<Icon size={18} />}
          checked={layers[id]}
          disabled={fixed}
          onCheckedChange={() => dispatch({ type: 'toggle', layer: id })}
          data-layer-id={id}
        />;
      })}
    </div>
    <button type="button" className="canvas-layer-reset" onClick={() => dispatch({ type: 'reset' })}>{t('canvas.layersReset')}</button>
  </Popover>;
};
