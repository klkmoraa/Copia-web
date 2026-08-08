import { describe, expect, it } from 'vitest';
import { screenToModelPoint } from './canvasInteraction';
import { cameraToFitBounds, canvasSafeInsetsFor, canvasSafeRect } from './canvasChromeGeometry';

describe('canvas chrome safe zones', () => {
  it('reserves compact edge zones without collapsing narrow canvases', () => {
    expect(canvasSafeInsetsFor({ width: 390, height: 844 })).toEqual({ top: 104, right: 58, bottom: 58, left: 58 });
    expect(canvasSafeRect({ width: 390, height: 844 })).toEqual({ x: 58, y: 104, width: 274, height: 682 });
  });

  it('uses larger desktop zones for chrome while preserving a useful center', () => {
    const safe = canvasSafeRect({ width: 1000, height: 640 });
    expect(safe).toEqual({ x: 64, y: 116, width: 872, height: 462 });
  });

  it('fits and centers model bounds inside the safe rectangle', () => {
    const viewport = { width: 1000, height: 640 };
    const safe = canvasSafeRect(viewport);
    const camera = cameraToFitBounds({ minX: 0, maxX: 6, minY: 0, maxY: 4 }, viewport);
    const safeCenter = { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };

    expect(screenToModelPoint(safeCenter, camera)).toEqual({ x: 3, y: 2 });
    expect(camera.scale).toBeCloseTo(115.5, 10);
  });

  it('clamps tiny and huge models to the established camera range', () => {
    expect(cameraToFitBounds({ minX: 0, maxX: 0.1, minY: 0, maxY: 0.1 }, { width: 1536, height: 960 }).scale).toBe(150);
    expect(cameraToFitBounds({ minX: 0, maxX: 1000, minY: 0, maxY: 1000 }, { width: 390, height: 844 }).scale).toBe(24);
  });
});
