/**
 * Triada local de un miembro espacial.
 *
 * El eje local `x` va del nudo `i` al `j`. El eje `y` es la referencia global
 * proyectada sobre el plano perpendicular a `x` y luego girada `rollRadians`
 * alrededor de `x`; `z` cierra la terna diestra (`z = x × y`).
 *
 * No hay `up` alternativo automático: si la referencia es paralela al miembro
 * el resultado sería arbitrario y silencioso, así que se falla cerrado y el
 * usuario elige una referencia válida.
 */
import { SPACE3D_LIMITS, Space3DGeometryError, type Space3DMemberOrientation, type Space3DOrientationBasis, type Space3DVector } from '../model/types';

export const dot = (a: Space3DVector, b: Space3DVector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Space3DVector, b: Space3DVector): Space3DVector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const norm = (a: Space3DVector): number => Math.hypot(a[0], a[1], a[2]);

export const subtract = (a: Space3DVector, b: Space3DVector): Space3DVector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const add = (a: Space3DVector, b: Space3DVector): Space3DVector => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const scale = (a: Space3DVector, factor: number): Space3DVector => [a[0] * factor, a[1] * factor, a[2] * factor];

export const normalize = (a: Space3DVector, failureCode: string): Space3DVector => {
  const length = norm(a);
  if (!Number.isFinite(length) || length <= SPACE3D_LIMITS.minMemberLength) {
    throw new Space3DGeometryError(failureCode);
  }
  return [a[0] / length, a[1] / length, a[2] / length];
};

const freezeVector = (a: Space3DVector): Space3DVector => Object.freeze([a[0], a[1], a[2]] as const);

export const buildMemberOrientation = (
  start: Space3DVector,
  end: Space3DVector,
  orientation: Space3DMemberOrientation,
): Space3DOrientationBasis => {
  const { localYReferenceGlobal, rollRadians } = orientation;
  if (!Number.isFinite(rollRadians)) throw new Space3DGeometryError('orientation-roll-not-finite');

  const x = normalize(subtract(end, start), 'zero-length-member');
  const referenceNorm = norm(localYReferenceGlobal);
  if (!Number.isFinite(referenceNorm) || referenceNorm <= SPACE3D_LIMITS.minReferenceNorm) {
    throw new Space3DGeometryError('orientation-reference-zero');
  }
  const projected = subtract(localYReferenceGlobal, scale(x, dot(localYReferenceGlobal, x)));
  if (norm(projected) / referenceNorm <= SPACE3D_LIMITS.minPerpendicularRatio) {
    throw new Space3DGeometryError('orientation-reference-parallel');
  }
  const y0 = normalize(projected, 'orientation-reference-parallel');
  const z0 = normalize(cross(x, y0), 'orientation-reference-parallel');
  const cosRoll = Math.cos(rollRadians);
  const sinRoll = Math.sin(rollRadians);
  const y = add(scale(y0, cosRoll), scale(z0, sinRoll));
  const z = add(scale(y0, -sinRoll), scale(z0, cosRoll));
  return Object.freeze({ x: freezeVector(x), y: freezeVector(y), z: freezeVector(z) });
};

/** Longitud del miembro; expuesta aparte porque el ensamblaje la necesita sin construir la triada. */
export const memberLength = (start: Space3DVector, end: Space3DVector): number => norm(subtract(end, start));
