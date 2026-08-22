/**
 * Encuadre de la cámara sobre la caja 3D del modelo.
 *
 * La distancia se calcula con la diagonal completa —no con el mayor lado— para
 * que un modelo con mucha profundidad en Z no se salga del encuadre en
 * isométrico, que es exactamente el caso que un visor plano nunca tiene.
 *
 * `up` es parte de la colocación y no una constante: mirando desde arriba, `+Y`
 * es la dirección de vista y usarlo como «arriba de la pantalla» degenera la
 * matriz de la cámara.
 */
import type { Space3DVector } from '../model/types';
import type { Space3DSceneBounds } from './sceneModel';

export const SPACE3D_VIEW_PRESETS = Object.freeze(['front', 'top', 'side', 'isometric'] as const);
export type Space3DViewPreset = (typeof SPACE3D_VIEW_PRESETS)[number];

export interface Space3DCameraPlacement {
  readonly position: Space3DVector;
  readonly target: Space3DVector;
  readonly up: Space3DVector;
  readonly near: number;
  readonly far: number;
  readonly fovDegrees: number;
}

const FOV_DEGREES = 45;
const MARGIN = 1.35;

/** Direcciones unitarias de cada preset, en la convención global Y-arriba. */
const DIRECTIONS: Record<Space3DViewPreset, { readonly offset: Space3DVector; readonly up: Space3DVector }> = {
  front: { offset: [0, 0, 1], up: [0, 1, 0] },
  top: { offset: [0, 1, 0], up: [0, 0, 1] },
  side: { offset: [1, 0, 0], up: [0, 1, 0] },
  isometric: { offset: [1, 0.72, 1], up: [0, 1, 0] },
};

export const computeSpace3DCameraPlacement = (
  bounds: Space3DSceneBounds,
  preset: Space3DViewPreset,
): Space3DCameraPlacement => {
  const extents = [
    Math.abs(bounds.max[0] - bounds.min[0]),
    Math.abs(bounds.max[1] - bounds.min[1]),
    Math.abs(bounds.max[2] - bounds.min[2]),
  ];
  const diagonal = Math.hypot(...extents);
  const radius = Math.max(diagonal / 2, Number.isFinite(bounds.span) && bounds.span > 0 ? bounds.span / 2 : 3, 1);

  const halfFov = (FOV_DEGREES * Math.PI / 180) / 2;
  const distance = Math.max(radius / Math.sin(halfFov) * MARGIN, 2);

  const { offset, up } = DIRECTIONS[preset];
  const offsetLength = Math.hypot(...offset);
  const position: Space3DVector = Object.freeze([
    bounds.center[0] + (offset[0] / offsetLength) * distance,
    bounds.center[1] + (offset[1] / offsetLength) * distance,
    bounds.center[2] + (offset[2] / offsetLength) * distance,
  ] as const);

  return Object.freeze({
    position,
    target: bounds.center,
    up: Object.freeze([up[0], up[1], up[2]] as const),
    near: Math.max(distance / 5_000, 1e-3),
    far: Math.max(distance * 40, 200),
    fovDegrees: FOV_DEGREES,
  });
};
