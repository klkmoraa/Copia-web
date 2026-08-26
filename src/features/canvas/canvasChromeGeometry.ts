import type { CanvasCamera, ViewportSize } from './canvasInteraction';

/**
 * Píxeles por metro de modelo a "1.00×". Es la escala inicial de cámara, el
 * piso del zoom al encuadrar, y el divisor del lector de escala del chrome —
 * un solo número con nombre en vez de un `85` repetido en tres archivos sin
 * decir qué significa.
 */
export const CANVAS_REFERENCE_SCALE = 85;

export interface CanvasSafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CanvasSafeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const canvasSafeInsetsFor = (viewport: ViewportSize): CanvasSafeInsets => {
  if (viewport.width <= 480) return { top: 104, right: 58, bottom: 58, left: 58 };
  if (viewport.width <= 1023) return { top: 116, right: 64, bottom: 62, left: 64 };
  return { top: 116, right: 68, bottom: 62, left: 68 };
};

export const canvasSafeRect = (
  viewport: ViewportSize,
  insets: CanvasSafeInsets = canvasSafeInsetsFor(viewport),
): CanvasSafeRect => ({
  x: insets.left,
  y: insets.top,
  width: Math.max(1, viewport.width - insets.left - insets.right),
  height: Math.max(1, viewport.height - insets.top - insets.bottom),
});

/** Fits model bounds inside the chrome-free rectangle without changing model data. */
export const cameraToFitBounds = (
  bounds: ModelBounds,
  viewport: ViewportSize,
  insets: CanvasSafeInsets = canvasSafeInsetsFor(viewport),
  minScale = 24,
  maxScale = 150,
  /**
   * Franja de píxeles que hay que dejar libre BAJO el modelo. La pide el
   * despliegue ACM, que cuelga del borde inferior del dibujo y mide siempre lo
   * mismo en pantalla: sin reservarla, encuadrar deja el modelo centrado y los
   * carriles fuera de la vista.
   */
  reservedBottom = 0,
): CanvasCamera => {
  const safe = canvasSafeRect(viewport, insets);
  const usableHeight = Math.max(1, safe.height - Math.max(0, reservedBottom));
  const spanX = Math.max(2, bounds.maxX - bounds.minX);
  const spanY = Math.max(2, bounds.maxY - bounds.minY);
  const scale = clamp(Math.min(safe.width / spanX, usableHeight / spanY), minScale, maxScale);
  const modelCenterX = (bounds.minX + bounds.maxX) / 2;
  const modelCenterY = (bounds.minY + bounds.maxY) / 2;
  const screenCenterX = safe.x + safe.width / 2;
  const screenCenterY = safe.y + usableHeight / 2;
  return {
    scale,
    x: screenCenterX - modelCenterX * scale,
    y: screenCenterY + modelCenterY * scale,
  };
};
