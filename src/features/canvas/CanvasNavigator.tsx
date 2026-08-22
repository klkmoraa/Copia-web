import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useEffect, type RefObject } from 'react';
import { IconButton } from '../../design-system/components/controls';
import type { MemberModel, NodeModel } from '../../types';
import { CANVAS_REFERENCE_SCALE } from './canvasChromeGeometry';
import { CanvasMiniMap } from './CanvasMiniMap';
import { formatFixed } from '../../utils/numberFormat';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';

export interface CanvasNavigatorProps {
  nodes: readonly NodeModel[];
  members: readonly MemberModel[];
  viewport: { minX: number; minY: number; maxX: number; maxY: number } | null;
  minimapLabel: string;
  coordinateReadoutRef: RefObject<HTMLOutputElement | null>;
  coordinatesLabel: string;
  lengthLabel: string;
  scale: number;
  scaleLabel: string;
  viewControlsLabel: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  fitLabel: string;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onNavigate: (point: { x: number; y: number }) => void;
}

/**
 * Dónde estoy: una sola pastilla en la esquina inferior-derecha que funde el
 * minimapa, los controles de cámara y el lector de coordenadas+escala —
 * antes cuatro superficies flotantes independientes compitiendo por el mismo
 * borde del lienzo. En reposo muestra sólo la miniatura y la escala; al
 * apuntar o enfocar revela los controles y las coordenadas (opacity, nunca
 * display — regla 5 del sistema de diseño). En puntero grueso (táctil) los
 * controles quedan siempre visibles: ahí no hay hover que los revele.
 */
export const CanvasNavigator = ({
  nodes,
  members,
  viewport,
  minimapLabel,
  coordinateReadoutRef,
  coordinatesLabel,
  lengthLabel,
  scale,
  scaleLabel,
  viewControlsLabel,
  zoomInLabel,
  zoomOutLabel,
  fitLabel,
  onFit,
  onZoomIn,
  onZoomOut,
  onNavigate,
}: CanvasNavigatorProps) => {
  useEffect(() => onWorkspaceCommand('fit-canvas', () => onFit()), [onFit]);

  return <div className="canvas-navigator" data-canvas-chrome="navigator">
    <CanvasMiniMap nodes={nodes} members={members} viewport={viewport} label={minimapLabel} onFit={onFit} onNavigate={onNavigate} />
    <span className="canvas-navigator__scale" aria-label={`${scaleLabel} ${formatFixed(scale / CANVAS_REFERENCE_SCALE, 2)}×`}>{formatFixed(scale / CANVAS_REFERENCE_SCALE, 2)}×</span>
    <div className="canvas-navigator__reveal">
      <div className="canvas-navigator__controls" role="group" aria-label={viewControlsLabel}>
        <IconButton size="sm" label={zoomInLabel} title={zoomInLabel} onClick={onZoomIn}><Plus size={16} /></IconButton>
        <IconButton size="sm" label={zoomOutLabel} title={zoomOutLabel} onClick={onZoomOut}><Minus size={16} /></IconButton>
        <IconButton size="sm" label={fitLabel} title={fitLabel} onClick={onFit}><LocateFixed size={16} /></IconButton>
      </div>
      <output ref={coordinateReadoutRef} className="canvas-navigator__coordinates" aria-label={coordinatesLabel}>X — · Y — {lengthLabel}</output>
    </div>
  </div>;
};
