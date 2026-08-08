import type { DiagramPoint } from '../types';
import type { LocalMemberLoad } from './diagram';

const EPS = 1e-10;

export interface CutLoadResultant {
  kind: 'distributed' | 'point' | 'moment';
  sourceX: number;
  forceX: number;
  forceY: number;
  appliedMoment: number;
  momentAboutCut: number;
  interval?: [number, number];
  centroidX?: number;
}

export interface LeftCutEquilibrium {
  x: number;
  internal: DiagramPoint;
  start: { axial: number; shear: number; moment: number };
  resultants: CutLoadResultant[];
  totals: {
    forceX: number;
    forceY: number;
    momentAboutCut: number;
  };
  residuals: {
    forceX: number;
    forceY: number;
    moment: number;
  };
  symbolicEquations: [string, string, string];
}

const linearIntegral = (
  valueAtA: number,
  slope: number,
  a: number,
  left: number,
  right: number,
): { force: number; firstMoment: number } => {
  if (right - left <= EPS) return { force: 0, firstMoment: 0 };
  const primitiveForce = (s: number) => {
    const t = s - a;
    return valueAtA * t + 0.5 * slope * t ** 2;
  };
  const primitiveFirstMoment = (s: number) => {
    const t = s - a;
    return a * valueAtA * t
      + 0.5 * (a * slope + valueAtA) * t ** 2
      + (slope * t ** 3) / 3;
  };
  return {
    force: primitiveForce(right) - primitiveForce(left),
    firstMoment: primitiveFirstMoment(right) - primitiveFirstMoment(left),
  };
};

/**
 * Builds the free-body equilibrium of the member portion from local x=0 to the cut.
 *
 * Sign convention matches diagram.ts:
 *   dN/dx = -p_x, dV/dx = p_y, dM/dx = V.
 * The point is evaluated on the right side of a discontinuity, therefore a load placed
 * exactly at the cut is included in the left free body.
 */
export const buildLeftCutEquilibrium = (
  endForces: readonly number[],
  loads: readonly LocalMemberLoad[],
  cutPoint: DiagramPoint,
): LeftCutEquilibrium => {
  const x = cutPoint.x;
  const start = {
    axial: -(endForces[0] ?? 0),
    shear: endForces[1] ?? 0,
    moment: -(endForces[2] ?? 0),
  };
  const resultants: CutLoadResultant[] = [];

  for (const load of loads) {
    if (load.kind === 'point') {
      if (load.x > x + EPS) continue;
      resultants.push({
        kind: 'point',
        sourceX: load.x,
        forceX: load.px,
        forceY: load.py,
        appliedMoment: 0,
        momentAboutCut: load.py * (load.x - x),
      });
      continue;
    }
    if (load.kind === 'moment') {
      if (load.x > x + EPS) continue;
      resultants.push({
        kind: 'moment',
        sourceX: load.x,
        forceX: 0,
        forceY: 0,
        appliedMoment: load.moment,
        momentAboutCut: load.moment,
      });
      continue;
    }

    const left = Math.max(0, load.a);
    const right = Math.min(x, load.b);
    if (right - left <= EPS || load.b - load.a <= EPS) continue;
    const span = load.b - load.a;
    const slopeX = (load.qxB - load.qxA) / span;
    const slopeY = (load.qyB - load.qyA) / span;
    const axial = linearIntegral(load.qxA, slopeX, load.a, left, right);
    const transverse = linearIntegral(load.qyA, slopeY, load.a, left, right);
    const forceMagnitude = transverse.force;
    const centroidX = Math.abs(forceMagnitude) > EPS
      ? transverse.firstMoment / forceMagnitude
      : 0.5 * (left + right);
    resultants.push({
      kind: 'distributed',
      sourceX: centroidX,
      forceX: axial.force,
      forceY: transverse.force,
      appliedMoment: 0,
      momentAboutCut: transverse.firstMoment - x * transverse.force,
      interval: [left, right],
      centroidX,
    });
  }

  const totals = resultants.reduce((sum, load) => ({
    forceX: sum.forceX + load.forceX,
    forceY: sum.forceY + load.forceY,
    momentAboutCut: sum.momentAboutCut + load.momentAboutCut,
  }), { forceX: 0, forceY: 0, momentAboutCut: 0 });

  const residuals = {
    forceX: -start.axial + totals.forceX + cutPoint.axial,
    forceY: start.shear + totals.forceY - cutPoint.shear,
    moment: -start.moment - start.shear * x + totals.momentAboutCut + cutPoint.moment,
  };

  return {
    x,
    internal: cutPoint,
    start,
    resultants,
    totals,
    residuals,
    symbolicEquations: [
      'ΣFₓ = −N₀ + ΣPₓ + N(x) = 0',
      'ΣFᵧ = V₀ + ΣPᵧ − V(x) = 0',
      'ΣM_corte = −M₀ − V₀x + ΣM_ext,corte + M(x) = 0',
    ],
  };
};
