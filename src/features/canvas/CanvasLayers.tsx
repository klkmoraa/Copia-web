import {
  Box,
  ChartNoAxesCombined,
  HelpCircle,
  Layers3,
  Ruler,
  SlidersHorizontal,
  Sparkles,
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
import type { EditorLayerAction, EditorLayerId, EditorLayerState } from './editorLayers';

interface LayerDefinition {
  id: EditorLayerId;
  labelKey: TranslationKey;
  detailKey: TranslationKey;
  icon: LucideIcon;
  shortcut: string;
  tone: 'model' | 'loads' | 'dimensions' | 'ids' | 'results' | 'labels' | 'help' | 'diagnostics';
}

const layerDefinitions: readonly LayerDefinition[] = [
  { id: 'model', labelKey: 'canvas.layerModel', detailKey: 'canvas.layerModelDetail', icon: Box, shortcut: '1', tone: 'model' },
  { id: 'loads', labelKey: 'canvas.layerLoads', detailKey: 'canvas.layerLoadsDetail', icon: Zap, shortcut: '2', tone: 'loads' },
  { id: 'dimensions', labelKey: 'canvas.layerDimensions', detailKey: 'canvas.layerDimensionsDetail', icon: Ruler, shortcut: '3', tone: 'dimensions' },
  { id: 'ids', labelKey: 'canvas.layerIds', detailKey: 'canvas.layerIdsDetail', icon: Tags, shortcut: '4', tone: 'ids' },
  { id: 'results', labelKey: 'canvas.layerResults', detailKey: 'canvas.layerResultsDetail', icon: ChartNoAxesCombined, shortcut: '5', tone: 'results' },
  { id: 'labels', labelKey: 'canvas.layerLabels', detailKey: 'canvas.layerLabelsDetail', icon: Tags, shortcut: '6', tone: 'labels' },
  { id: 'help', labelKey: 'canvas.layerHelp', detailKey: 'canvas.layerHelpDetail', icon: HelpCircle, shortcut: '7', tone: 'help' },
  { id: 'diagnostics', labelKey: 'canvas.layerDiagnostics', detailKey: 'canvas.layerDiagnosticsDetail', icon: TriangleAlert, shortcut: '8', tone: 'diagnostics' },
] as const;

export const CanvasLayers = ({
  layers,
  dispatch,
}: {
  layers: EditorLayerState;
  dispatch: Dispatch<EditorLayerAction>;
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();
  const { t } = useI18n();

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const applyPreset = (preset: 'all' | 'model' | 'loads' | 'results' | 'clean') => {
    switch (preset) {
      case 'all':
        dispatch({ type: 'reset' });
        break;
      case 'model':
        layerDefinitions.forEach(({ id }) => {
          dispatch({ type: 'set', layer: id, visible: id === 'model' || id === 'ids' });
        });
        break;
      case 'loads':
        layerDefinitions.forEach(({ id }) => {
          dispatch({ type: 'set', layer: id, visible: id === 'model' || id === 'loads' || id === 'dimensions' });
        });
        break;
      case 'results':
        layerDefinitions.forEach(({ id }) => {
          dispatch({ type: 'set', layer: id, visible: id === 'model' || id === 'results' || id === 'diagnostics' });
        });
        break;
      case 'clean':
        layerDefinitions.forEach(({ id }) => {
          dispatch({ type: 'set', layer: id, visible: id === 'model' || id === 'dimensions' });
        });
        break;
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      // Atajos numéricos 1-8 para conmutar capas
      const num = parseInt(event.key, 10);
      if (num >= 1 && num <= layerDefinitions.length) {
        const targetLayer = layerDefinitions[num - 1];
        if (targetLayer && targetLayer.id !== 'model') {
          event.preventDefault();
          dispatch({ type: 'toggle', layer: targetLayer.id });
        }
      }
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
    ><Layers3 size={19} /></button>
    {open ? <section
      ref={panelRef}
      id={panelId}
      className="canvas-layer-panel"
      aria-label={t('canvas.layers')}
      data-canvas-chrome="layers-panel"
    >
      <header className="canvas-layer-panel-header">
        <div>
          <strong>{t('canvas.layers')}</strong>
          <span>{t('canvas.layersDescription')}</span>
        </div>
        <button type="button" aria-label={t('canvas.layersClose')} onClick={() => close()} className="canvas-layer-close-btn">
          <X size={17} />
        </button>
      </header>

      {/* Presets Rápidos de Visualización */}
      <div className="canvas-layer-presets-bar">
        <span className="presets-label"><Sparkles size={13} /> Presets:</span>
        <div className="presets-pill-group">
          <button type="button" onClick={() => applyPreset('all')} title="Activar todas las capas">Todas</button>
          <button type="button" onClick={() => applyPreset('model')} title="Solo Geometría y Nodos">Modelo</button>
          <button type="button" onClick={() => applyPreset('loads')} title="Geometría, Cargas y Cotas">Cargas</button>
          <button type="button" onClick={() => applyPreset('results')} title="Geometría, Diagramas y Diagnóstico">Resultados</button>
          <button type="button" onClick={() => applyPreset('clean')} title="Presentación Limpia">Limpio</button>
        </div>
      </div>

      <div className="canvas-layer-list">
        {layerDefinitions.map(({ id, labelKey, detailKey, icon: Icon, shortcut, tone }) => {
          const fixed = id === 'model';
          return (
            <div key={id} className={`canvas-layer-row-wrap layer-tone--${tone}`}>
              <LayerToggle
                className="canvas-layer-row"
                label={t(labelKey)}
                description={t(detailKey)}
                icon={<Icon size={18} />}
                checked={layers[id]}
                disabled={fixed}
                onCheckedChange={() => dispatch({ type: 'toggle', layer: id })}
                data-layer-id={id}
              />
              <kbd className="layer-keycap-hint" title={`Atajo de teclado: ${shortcut}`}>{shortcut}</kbd>
            </div>
          );
        })}
      </div>

      <div className="canvas-layer-footer">
        <button type="button" className="canvas-layer-reset" onClick={() => dispatch({ type: 'reset' })}>
          <SlidersHorizontal size={13} /> {t('canvas.layersReset')}
        </button>
      </div>
    </section> : null}
  </>;
};
