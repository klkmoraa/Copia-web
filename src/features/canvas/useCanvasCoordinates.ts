import { useCallback, type RefObject } from 'react';
import type { NodeModel, UnitSystemId } from '../../types';
import { toDisplay } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import { canvasPointerProfile, screenToModelPoint, type ScreenPoint } from './canvasInteraction';
import { cameraToFitBounds, canvasSafeInsetsFor } from './canvasChromeGeometry';
import { modelBounds } from '../../graphics/structureGeometry';
import type { Camera, Size } from './canvasVocabulary';

export interface UseCanvasCoordinatesArgs {
  camera: Camera;
  cameraRef: RefObject<Camera>;
  svgRef: RefObject<SVGSVGElement | null>;
  coordinateReadoutRef: RefObject<HTMLOutputElement | null>;
  size: Size;
  nodes: NodeModel[];
  units: UnitSystemId;
  lengthLabel: string;
  updateCamera: (next: Camera | ((current: Camera) => Camera)) => void;
}

/**
 * Transformación de coordenadas cámara↔pantalla↔modelo del canvas y las
 * acciones que la usan para encuadrar el modelo (ajustar a la ventana,
 * navegar desde el minimapa). `toScreen`/`toModel` dependen de `camera`
 * (state, dispara re-render); `fitModel`/`navigateMinimapTo` mutan la
 * cámara a través de `updateCamera`, inyectado desde fuera porque su
 * batching de rAF vive en la infraestructura de interacción.
 */
export const useCanvasCoordinates = ({
  camera,
  cameraRef,
  svgRef,
  coordinateReadoutRef,
  size,
  nodes,
  units,
  lengthLabel,
  updateCamera,
}: UseCanvasCoordinatesArgs) => {
  const toScreen = useCallback((x: number, y: number) => ({ x: camera.x + x * camera.scale, y: camera.y - y * camera.scale }), [camera]);
  const toModel = useCallback((screenX: number, screenY: number) => ({ x: (screenX - camera.x) / camera.scale, y: (camera.y - screenY) / camera.scale }), [camera]);
  const localScreenPoint = useCallback((clientX: number, clientY: number): ScreenPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, [svgRef]);

  const updateCoordinateReadout = useCallback((clientX: number, clientY: number, pointerType: string) => {
    if (!canvasPointerProfile(pointerType).showsCoordinates || !coordinateReadoutRef.current) return;
    const point = screenToModelPoint(localScreenPoint(clientX, clientY), cameraRef.current);
    coordinateReadoutRef.current.textContent = `X ${formatFixed(toDisplay(point.x, units, 'length'), 3)} · Y ${formatFixed(toDisplay(point.y, units, 'length'), 3)} ${lengthLabel}`;
  }, [cameraRef, coordinateReadoutRef, lengthLabel, localScreenPoint, units]);

  const fitModel = useCallback(() => {
    if (!nodes.length || !size.width || !size.height) return;
    const viewport = { width: size.width, height: size.height };
    updateCamera(cameraToFitBounds(
      modelBounds(nodes),
      viewport,
      canvasSafeInsetsFor(viewport),
    ));
  }, [nodes, size, updateCamera]);

  const navigateMinimapTo = useCallback((point: { x: number; y: number }) => {
    updateCamera((current) => ({
      scale: current.scale,
      x: size.width / 2 - point.x * current.scale,
      y: size.height / 2 + point.y * current.scale,
    }));
  }, [size.width, size.height, updateCamera]);

  return { toScreen, toModel, localScreenPoint, updateCoordinateReadout, fitModel, navigateMinimapTo };
};
