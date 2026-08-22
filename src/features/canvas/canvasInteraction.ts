export interface CanvasCamera {
  scale: number;
  x: number;
  y: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ModelPoint {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CanvasPointerProfile {
  kind: 'mouse' | 'touch' | 'pen';
  dragThreshold: number;
  canDragNode: boolean;
  usesLongPress: boolean;
  showsCoordinates: boolean;
  minimumHitTarget: number;
}

export const MIN_CAMERA_SCALE = 15;
export const MAX_CAMERA_SCALE = 260;
export const LONG_PRESS_MS = 480;
/** Smaller than the 9 px touch-pan threshold: any deliberate slow pan cancels long press. */
export const LONG_PRESS_JITTER_PX = 3;

export const clampCameraScale = (scale: number): number =>
  Math.min(MAX_CAMERA_SCALE, Math.max(MIN_CAMERA_SCALE, scale));

export const screenToModelPoint = (point: ScreenPoint, camera: CanvasCamera): ModelPoint => ({
  x: (point.x - camera.x) / camera.scale,
  y: (camera.y - point.y) / camera.scale,
});

export const cameraFromAnchor = (
  modelAnchor: ModelPoint,
  screenAnchor: ScreenPoint,
  scale: number,
): CanvasCamera => {
  const nextScale = clampCameraScale(scale);
  return {
    scale: nextScale,
    x: screenAnchor.x - modelAnchor.x * nextScale,
    y: screenAnchor.y + modelAnchor.y * nextScale,
  };
};

/** Zooms without allowing the model point under the cursor to drift. */
export const zoomCameraAt = (
  camera: CanvasCamera,
  screenAnchor: ScreenPoint,
  scaleFactor: number,
): CanvasCamera => cameraFromAnchor(
  screenToModelPoint(screenAnchor, camera),
  screenAnchor,
  camera.scale * scaleFactor,
);

export const panCameraFrom = (
  camera: CanvasCamera,
  start: ScreenPoint,
  current: ScreenPoint,
): CanvasCamera => ({
  ...camera,
  x: camera.x + current.x - start.x,
  y: camera.y + current.y - start.y,
});

/** Keeps the same model point at the visual center while the canvas resizes. */
export const cameraForViewportResize = (
  camera: CanvasCamera,
  previous: ViewportSize,
  current: ViewportSize,
): CanvasCamera => ({
  ...camera,
  x: camera.x + (current.width - previous.width) / 2,
  y: camera.y + (current.height - previous.height) / 2,
});

export const canvasPointerProfile = (pointerType: string): CanvasPointerProfile => {
  if (pointerType === 'touch') return { kind: 'touch', dragThreshold: 9, canDragNode: false, usesLongPress: true, showsCoordinates: false, minimumHitTarget: 44 };
  if (pointerType === 'pen') return { kind: 'pen', dragThreshold: 5, canDragNode: true, usesLongPress: false, showsCoordinates: true, minimumHitTarget: 32 };
  return { kind: 'mouse', dragThreshold: 3, canDragNode: true, usesLongPress: false, showsCoordinates: true, minimumHitTarget: 24 };
};

/**
 * Touch selection reserves one-finger drags for panning. Moving model geometry
 * on a touch screen must happen through an explicit editing control.
 */
export const pendingDragIntent = (
  pointerType: string,
  tool: string,
  targetKind: string,
): 'pan' | 'node-drag' =>
  !canvasPointerProfile(pointerType).canDragNode || tool !== 'select' || targetKind !== 'node' ? 'pan' : 'node-drag';

/** Long-press is reserved for touch selection: targets open the picker and background starts marquee. */
export const shouldArmLongPress = (
  pointerType: string,
  tool: string,
  targetKind: string,
): boolean => canvasPointerProfile(pointerType).usesLongPress && tool === 'select'
  && ['node', 'member', 'nodalLoad', 'memberLoad', 'background'].includes(targetKind);

/** A slow pan must cancel long press before it can open marquee or a picker. */
export const shouldTriggerLongPress = (
  pointerType: string,
  tool: string,
  targetKind: string,
  elapsedMs: number,
  movedPx: number,
): boolean => shouldArmLongPress(pointerType, tool, targetKind)
  && elapsedMs >= LONG_PRESS_MS
  && movedPx <= LONG_PRESS_JITTER_PX;

export const midpoint = (first: ScreenPoint, second: ScreenPoint): ScreenPoint => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

export const pointDistance = (first: ScreenPoint, second: ScreenPoint): number =>
  Math.hypot(second.x - first.x, second.y - first.y);

/**
 * Keeps the model point at the original midpoint under the moving midpoint,
 * so a pinch can zoom and pan at the same time without jumping.
 */
export const cameraForPinch = (
  startCamera: CanvasCamera,
  modelAnchor: ModelPoint,
  startDistance: number,
  currentDistance: number,
  currentMidpoint: ScreenPoint,
): CanvasCamera => {
  const safeStartDistance = Math.max(startDistance, 1e-6);
  return cameraFromAnchor(
    modelAnchor,
    currentMidpoint,
    startCamera.scale * (currentDistance / safeStartDistance),
  );
};

export const dragThreshold = (pointerType: string): number => {
  return canvasPointerProfile(pointerType).dragThreshold;
};

export const movedPastThreshold = (
  start: ScreenPoint,
  current: ScreenPoint,
  pointerType: string,
): boolean => pointDistance(start, current) >= dragThreshold(pointerType);
