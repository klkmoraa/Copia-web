import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { NodeModel } from '../../types';
import {
  cameraForViewportResize,
  screenToModelPoint,
  zoomCameraAt,
  type ModelPoint,
  type ScreenPoint,
} from './canvasInteraction';
import { CANVAS_REFERENCE_SCALE, cameraToFitBounds, canvasSafeInsetsFor } from './canvasChromeGeometry';
import { modelBounds } from '../../graphics/structureGeometry';
import { formatFixed } from '../../utils/numberFormat';
import { toDisplay } from '../../engine/units';
import { canvasPointerProfile } from './canvasInteraction';
import { clamp, type Camera, type Size } from './canvasVocabulary';
import type { UnitSystemId } from '../../types';

/**
 * Cámara, tamaño medido y las conversiones pantalla↔modelo que dependen de
 * ellas: extraído de `StructuralCanvas.tsx` como un bloque cohesivo — nada
 * aquí conoce herramientas, selección ni el resto de la máquina de gestos, y
 * todo lo que sí la conoce (la propia cámara, `toScreen`/`toModel`) sale por
 * el valor de retorno tal cual se usaba antes.
 */
export interface UseCanvasCameraParams {
  hostRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  coordinateReadoutRef: RefObject<HTMLOutputElement | null>;
  projectNodes: readonly NodeModel[];
  projectId: string;
  units: UnitSystemId;
  lengthLabel: string;
}

export const useCanvasCamera = ({
  hostRef,
  svgRef,
  coordinateReadoutRef,
  projectNodes,
  projectId,
  units,
  lengthLabel,
}: UseCanvasCameraParams) => {
  const [size, setSize] = useState<Size>({ width: 1000, height: 640 });
  const [canvasMeasured, setCanvasMeasured] = useState(false);
  const [camera, setCamera] = useState<Camera>({ scale: CANVAS_REFERENCE_SCALE, x: 260, y: 500 });
  const cameraRef = useRef(camera);
  const cameraFrameRef = useRef<number | null>(null);
  const previousSizeRef = useRef<Size | null>(null);
  const fittedProjectRef = useRef<string | null>(null);

  const updateCamera = useCallback((next: Camera | ((current: Camera) => Camera)) => {
    const resolved = typeof next === 'function' ? next(cameraRef.current) : next;
    cameraRef.current = resolved;
    if (cameraFrameRef.current !== null) return;
    cameraFrameRef.current = window.requestAnimationFrame(() => {
      cameraFrameRef.current = null;
      setCamera(cameraRef.current);
    });
  }, []);

  useEffect(() => () => {
    if (cameraFrameRef.current !== null) window.cancelAnimationFrame(cameraFrameRef.current);
    cameraFrameRef.current = null;
  }, []);

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
  }, [coordinateReadoutRef, lengthLabel, localScreenPoint, units]);

  const fitModel = useCallback(() => {
    if (!projectNodes.length || !size.width || !size.height) return;
    const viewport = { width: size.width, height: size.height };
    updateCamera(cameraToFitBounds(
      modelBounds(projectNodes),
      viewport,
      canvasSafeInsetsFor(viewport),
    ));
  }, [projectNodes, size, updateCamera]);

  const navigateMinimapTo = useCallback((point: ModelPoint) => {
    updateCamera((current) => ({
      scale: current.scale,
      x: size.width / 2 - point.x * current.scale,
      y: size.height / 2 + point.y * current.scale,
    }));
  }, [size.width, size.height, updateCamera]);

  useEffect(() => {
    if (!hostRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
      setCanvasMeasured(true);
    });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [hostRef]);

  useEffect(() => {
    if (!canvasMeasured || !size.width || !size.height) return;
    const previousSize = previousSizeRef.current;
    const currentSize = { width: size.width, height: size.height };
    previousSizeRef.current = currentSize;

    if (!projectNodes.length) return;
    if (fittedProjectRef.current !== projectId) {
      fittedProjectRef.current = projectId;
      fitModel();
      return;
    }
    if (previousSize && (previousSize.width !== currentSize.width || previousSize.height !== currentSize.height)) {
      updateCamera((current) => cameraForViewportResize(current, previousSize, currentSize));
    }
  }, [canvasMeasured, fitModel, projectId, projectNodes.length, size.height, size.width, updateCamera]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const local = localScreenPoint(event.clientX, event.clientY);
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * size.height : event.deltaY;
      const factor = Math.exp(-clamp(delta, -400, 400) * 0.0012);
      updateCamera(zoomCameraAt(cameraRef.current, local, factor));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [localScreenPoint, size.height, svgRef, updateCamera]);

  return {
    size,
    canvasMeasured,
    camera,
    cameraRef,
    updateCamera,
    toScreen,
    toModel,
    localScreenPoint,
    updateCoordinateReadout,
    fitModel,
    navigateMinimapTo,
  };
};
