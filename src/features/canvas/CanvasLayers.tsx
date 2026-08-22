import {
  Box,
  ChartNoAxesCombined,
  Flame,
  HelpCircle,
  Layers3,
  Ruler,
  Tags,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type Dispatch } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import { LayerToggle } from '../../design-system/components/editor';
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

export const CanvasLayers = ({
  layers,
  dispatch,
  resultTab,
  setResultTab,
}: {
  layers: EditorLayerState;
  dispatch: Dispatch<EditorLayerAction>;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();
  const { t } = useI18n();
  const currentPreset = activeEditorLayerPreset(layers);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // close intentionally captures the open panel and trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`canvas-layer-trigger${open ? ' active' : ''}`}
      aria-label={t('canvas.layers')}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen((current) => !current)}
      data-canvas-chrome="layers-trigger"
    ><Layers3 size={18} /></button>
    {open ? <section
      ref={panelRef}
      id={panelId}
      className="canvas-layer-panel"
      aria-label={t('canvas.layers')}
      data-canvas-chrome="layers-panel"
    >
      <header>
        <div><strong>{t('canvas.layers')}</strong><span>{t('canvas.layersDescription')}</span></div>
        <button type="button" aria-label={t('canvas.layersClose')} onClick={() => close()}><X size={16} /></button>
      </header>
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
    </section> : null}
  </>;
};
