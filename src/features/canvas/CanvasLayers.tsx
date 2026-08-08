import {
  Box,
  ChartNoAxesCombined,
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
import type { EditorLayerAction, EditorLayerId, EditorLayerState } from './editorLayers';

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
    ><Layers3 size={19} /></button>
    {open ? <section
      ref={panelRef}
      id={panelId}
      className="canvas-layer-panel"
      aria-label={t('canvas.layers')}
      data-canvas-chrome="layers-panel"
    >
      <header>
        <div><strong>{t('canvas.layers')}</strong><span>{t('canvas.layersDescription')}</span></div>
        <button type="button" aria-label={t('canvas.layersClose')} onClick={() => close()}><X size={17} /></button>
      </header>
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
