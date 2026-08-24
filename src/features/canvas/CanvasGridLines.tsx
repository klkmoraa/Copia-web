import { useMemo } from 'react';
import type { Camera, Size } from './canvasVocabulary';

/**
 * Rejilla de fondo, extraída tal cual de `StructuralCanvas.tsx`: el mismo
 * `useMemo` con las mismas dependencias, sólo que ahora vive en su propio
 * componente. `qa.mjs` mide `.grid-lines line` en varias comprobaciones de
 * pan/zoom — la estructura y las clases se conservan byte a byte.
 */
export interface CanvasGridLinesProps {
  camera: Camera;
  size: Size;
  showGrid: boolean;
  gridSize: number;
}

export const CanvasGridLines = ({ camera, size, showGrid, gridSize }: CanvasGridLinesProps) => useMemo(() => {
  if (!showGrid) return null;
  const step = gridSize * camera.scale;
  if (step < 8) return null;
  const lines = [];
  const startX = ((camera.x % step) + step) % step;
  const startY = ((camera.y % step) + step) % step;
  for (let x = startX; x < size.width; x += step) lines.push(<line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={size.height} />);
  for (let y = startY; y < size.height; y += step) lines.push(<line key={`gy-${y}`} x1={0} y1={y} x2={size.width} y2={y} />);
  return <g className="grid-lines">{lines}</g>;
}, [camera, size, gridSize, showGrid]);
