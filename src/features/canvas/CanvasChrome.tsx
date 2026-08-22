import { Crosshair, LocateFixed, Minus, Plus, X } from 'lucide-react';
import { useEffect, type Dispatch, type RefObject } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { IconButton } from '../../design-system/components/controls';
import type { ResultTab } from '../../store/ProjectContext';
import { CanvasLayers } from './CanvasLayers';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';
import { formatFixed } from '../../utils/numberFormat';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';

export interface CanvasChromeProps {
  modeLabel: string;
  placementInstruction: string | null;
  showHelp: boolean;
  layers: EditorLayerState;
  dispatchLayers: Dispatch<EditorLayerAction>;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  snapEnabled: boolean;
  gridEnabled: boolean;
  coordinateReadoutRef: RefObject<HTMLOutputElement | null>;
  lengthLabel: string;
  scale: number;
  onCancelPlacement: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

/** Presentation-only canvas controls. Camera and model mutations stay upstream. */
export const CanvasChrome = ({
  modeLabel,
  placementInstruction,
  showHelp,
  layers,
  dispatchLayers,
  resultTab,
  setResultTab,
  snapEnabled,
  gridEnabled,
  coordinateReadoutRef,
  lengthLabel,
  scale,
  onCancelPlacement,
  onZoomIn,
  onZoomOut,
  onFit,
}: CanvasChromeProps) => {
  const { t } = useI18n();

  useEffect(() => {
    return onWorkspaceCommand('fit-canvas', () => onFit());
  }, [onFit]);

  return <>
    <div className={`canvas-mode-badge${placementInstruction ? ' placing-load' : ''}`} role="status" aria-live="polite" data-canvas-chrome="mode">
      <strong>{modeLabel}</strong>
      {placementInstruction ? <span className="canvas-action-instruction">{placementInstruction}</span> : showHelp ? <>
        <span className="desktop-gesture-hint">{t('canvas.gestureDesktop')}</span>
        <span className="touch-gesture-hint">{t('canvas.gestureTouch')}</span>
      </> : null}
      {placementInstruction ? <IconButton size="sm" label={t('canvas.cancelPlacement')} onClick={onCancelPlacement}><X size={14} /></IconButton> : null}
    </div>
    <CanvasLayers layers={layers} dispatch={dispatchLayers} resultTab={resultTab} setResultTab={setResultTab} />
    {/* Estado de la vista. El acento está reservado a la acción (decisión 2 del
        sistema) y snap/rejilla no accionan nada: son dos indicadores. Pintarlos
        de azul los ponía al mismo nivel que «Analizar». Ahora son un grupo
        segmentado monocromo —relleno para el activo, gris para el inactivo—,
        con la misma materia que los controles de cámara de al lado.

        Lo que se ve es el rótulo corto; lo que se anuncia sigue siendo el
        estado completo («SNAP activo» / «SNAP inactivo»), que es lo que este
        `role="status"` existe para decir. El indicador se acorta, la
        información no. */}
    <div className="canvas-view-chips" role="status" aria-label={t('canvas.viewStatus')} data-canvas-chrome="view-status">
      <span data-active={snapEnabled || undefined}>
        <span aria-hidden="true">{t('canvas.snapShort')}</span>
        <span className="sr-only">{snapEnabled ? t('canvas.snapOn') : t('canvas.snapOff')}</span>
      </span>
      <span data-active={gridEnabled || undefined}>
        <span aria-hidden="true">{t('canvas.gridShort')}</span>
        <span className="sr-only">{gridEnabled ? t('canvas.gridOn') : t('canvas.gridOff')}</span>
      </span>
    </div>
    <div className="canvas-controls" role="group" aria-label={t('canvas.viewControls')} data-canvas-chrome="camera">
      <IconButton label={t('canvas.zoomIn')} title={t('canvas.zoomIn')} onClick={onZoomIn}><Plus size={18} /></IconButton>
      <IconButton label={t('canvas.zoomOut')} title={t('canvas.zoomOut')} onClick={onZoomOut}><Minus size={18} /></IconButton>
      <IconButton label={t('canvas.fit')} title={t('canvas.fit')} onClick={onFit}><LocateFixed size={18} /></IconButton>
    </div>
    <div className="canvas-status" data-canvas-chrome="coordinates">
      <Crosshair size={14} aria-hidden="true" />
      <output ref={coordinateReadoutRef} className="canvas-coordinate-output" aria-label={t('canvas.coordinates')}>X — · Y — {lengthLabel}</output>
      <span className="canvas-status-divider" aria-hidden="true">·</span>
      <span className="canvas-scale-output">{t('canvas.scale')} {formatFixed((scale / 85), 2)}×</span>
    </div>
  </>;
};
