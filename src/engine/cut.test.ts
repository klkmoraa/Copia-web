import { describe, expect, it } from 'vitest';
import { buildExactDiagrams, evaluateDiagramAt, type LocalMemberLoad } from './diagram';
import { buildLeftCutEquilibrium } from './cut';

const close = (value: number, expected = 0, tolerance = 1e-9) => {
  expect(Math.abs(value - expected)).toBeLessThanOrEqual(tolerance);
};

describe('DCL de corte generado desde el mismo modelo de cargas', () => {
  it('cierra equilibrio para carga uniforme', () => {
    const L = 8;
    const w = 10;
    const endForces = [0, 40, 0, 0, 40, 0];
    const loads: LocalMemberLoad[] = [{ kind: 'distributed', a: 0, b: L, qxA: 0, qxB: 0, qyA: -w, qyB: -w }];
    const diagrams = buildExactDiagrams(endForces, loads, L);
    const point = evaluateDiagramAt(diagrams.segments, diagrams.jumps, 3, 'right')!;
    const cut = buildLeftCutEquilibrium(endForces, loads, point);
    close(point.shear, 10);
    close(point.moment, 75);
    close(cut.totals.forceY, -30);
    close(cut.residuals.forceX);
    close(cut.residuals.forceY);
    close(cut.residuals.moment);
  });

  it('incluye fuerza y momento puntuales situados exactamente en el corte', () => {
    const L = 6;
    const loads: LocalMemberLoad[] = [
      { kind: 'point', x: 2, px: 5, py: -12 },
      { kind: 'moment', x: 2, moment: 9 },
    ];
    const endForces = [-5, 12, -24, 0, 0, 0];
    const diagrams = buildExactDiagrams(endForces, loads, L);
    const point = evaluateDiagramAt(diagrams.segments, diagrams.jumps, 2, 'right')!;
    const cut = buildLeftCutEquilibrium(endForces, loads, point);
    close(cut.totals.forceX, 5);
    close(cut.totals.forceY, -12);
    close(cut.totals.momentAboutCut, 9);
    close(cut.residuals.forceX);
    close(cut.residuals.forceY);
    close(cut.residuals.moment);
  });

  it('calcula resultante y centroide exactos de una carga triangular parcial', () => {
    const loads: LocalMemberLoad[] = [{ kind: 'distributed', a: 1, b: 5, qxA: 0, qxB: 0, qyA: 0, qyB: -12 }];
    const endForces = [0, 16, -16, 0, 8, 0];
    const diagrams = buildExactDiagrams(endForces, loads, 6);
    const point = evaluateDiagramAt(diagrams.segments, diagrams.jumps, 5, 'right')!;
    const cut = buildLeftCutEquilibrium(endForces, loads, point);
    const distributed = cut.resultants[0];
    close(distributed.forceY, -24);
    close(distributed.centroidX ?? 0, 1 + (2 / 3) * 4);
    close(cut.residuals.forceX);
    close(cut.residuals.forceY);
    close(cut.residuals.moment);
  });
});
