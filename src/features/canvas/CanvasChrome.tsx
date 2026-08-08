import { Crosshair, LocateFixed, Minus, Plus, X } from 'lucide-react';
import { useEffect, type Dispatch, type RefObject } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { IconButton } from '../../design-system/components/controls';
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
    <CanvasLayers layers={layers} dispatch={dispatchLayers} />
    <div className="canvas-view-chips" role="status" aria-label={t('canvas.viewStatus')} data-canvas-chrome="view-status">
      <span className={snapEnabled ? 'active' : ''}>{snapEnabled ? t('canvas.snapOn') : t('canvas.snapOff')}</span>
      <span className={gridEnabled ? 'active' : ''}>{gridEnabled ? t('canvas.gridOn') : t('canvas.gridOff')}</span>
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
