import { describe, expect, it } from 'vitest';
import { buildExactDiagrams, evaluateDiagramAt, evaluatePolynomial, rootsInInterval, segmentBezierControls } from './diagram';

const close = (actual: number, expected: number, tolerance = 1e-9) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));

describe('motor exacto de diagramas', () => {
  it('cumple dN/dx=-px, dV/dx=py y dM/dx=V por coeficientes', () => {
    const result = buildExactDiagrams([0, 15, 0, 0, 0, 0], [{ kind: 'distributed', a: 0, b: 3, qxA: 2, qxB: 8, qyA: -4, qyB: -10 }], 3);
    const segment = result.segments[0];
    close(segment.axial[1], -segment.distributedAxial[0]);
    close(2 * segment.axial[2], -segment.distributedAxial[1]);
    close(segment.shear[1], segment.distributedTransverse[0]);
    close(2 * segment.shear[2], segment.distributedTransverse[1]);
    close(segment.moment[1], segment.shear[0]);
    close(2 * segment.moment[2], segment.shear[1]);
    close(3 * segment.moment[3], segment.shear[2]);
  });

  it('dibuja exactamente un polinomio cúbico mediante Bézier', () => {
    const segment = {
      x0: 2, x1: 7,
      axial: [1, 2, 3] as [number, number, number],
      shear: [-2, 4, -1] as [number, number, number],
      moment: [3, -2, 5, -0.75] as [number, number, number, number],
      distributedAxial: [0, 0] as [number, number],
      distributedTransverse: [0, 0] as [number, number],
    };
    const control = segmentBezierControls(segment, 'moment');
    close(control.y0, evaluatePolynomial(segment.moment, 0));
    close(control.y1, evaluatePolynomial(segment.moment, 5));
    // Cubic Bézier at t=0.5 must equal the polynomial at ξ=2.5.
    const t = 0.5;
    const y = (1 - t) ** 3 * control.y0 + 3 * (1 - t) ** 2 * t * control.c1y + 3 * (1 - t) * t ** 2 * control.c2y + t ** 3 * control.y1;
    close(y, evaluatePolynomial(segment.moment, 2.5));
  });

  it('la Bézier coincide con N, V y M en toda la parametrización del tramo', () => {
    const segment = {
      x0: -1.25, x1: 4.75,
      axial: [-7.2, 3.1, -0.42] as [number, number, number],
      shear: [5.5, -8.4, 1.33] as [number, number, number],
      moment: [-2.1, 5.5, -4.2, 0.443333333333] as [number, number, number, number],
      distributedAxial: [0, 0] as [number, number],
      distributedTransverse: [0, 0] as [number, number],
    };
    for (const quantity of ['axial', 'shear', 'moment'] as const) {
      const control = segmentBezierControls(segment, quantity);
      const coefficients = quantity === 'axial' ? segment.axial : quantity === 'shear' ? segment.shear : segment.moment;
      for (const t of [0, 0.01, 0.1, 0.25, 0.5, 0.73, 0.9, 0.99, 1]) {
        const bezier = (1 - t) ** 3 * control.y0
          + 3 * (1 - t) ** 2 * t * control.c1y
          + 3 * (1 - t) * t ** 2 * control.c2y
          + t ** 3 * control.y1;
        close(bezier, evaluatePolynomial(coefficients, t * (segment.x1 - segment.x0)), 2e-10);
      }
    }
  });

  it('conserva ambos lados de saltos puntuales', () => {
    const result = buildExactDiagrams([0, 10, 0, 0, 10, 0], [
      { kind: 'point', x: 2, px: 3, py: -7 },
      { kind: 'moment', x: 2, moment: 5 },
    ], 4);
    const left = evaluateDiagramAt(result.segments, result.jumps, 2, 'left')!;
    const right = evaluateDiagramAt(result.segments, result.jumps, 2, 'right')!;
    close(right.axial - left.axial, -3);
    close(right.shear - left.shear, -7);
    close(right.moment - left.moment, -5);
  });

  it('encuentra raíces internas de polinomios hasta grado tres', () => {
    const roots = rootsInInterval([-6, 11, -6, 1], 5); // (x-1)(x-2)(x-3)
    expect(roots).toHaveLength(3);
    close(roots[0], 1);
    close(roots[1], 2);
    close(roots[2], 3);
  });

  it('encuentra las mismas raíces al cambiar longitud y escala de coeficientes', () => {
    // p(t)=(t-.2)(t-.5)(t-.8), with t=x/L.
    const inT = [-0.08, 0.66, -1.5, 1];
    for (const length of [1e-6, 1, 1e6]) {
      const inX = inT.map((coefficient, degree) => (coefficient * 1e-12) / length ** degree);
      const roots = rootsInInterval(inX, length);
      expect(roots).toHaveLength(3);
      close(roots[0] / length, 0.2, 1e-8);
      close(roots[1] / length, 0.5, 1e-8);
      close(roots[2] / length, 0.8, 1e-8);
    }
  });

  it('no clasifica una inflexión estacionaria como máximo o mínimo', () => {
    // V=(x-1)^2 and therefore M'=V. At x=1 the tangent is horizontal,
    // but M remains increasing and has no extremum.
    const result = buildExactDiagrams(
      [0, 1, 0, 0, 0, 0],
      [{ kind: 'distributed', a: 0, b: 2, qxA: 0, qxB: 0, qyA: -2, qyB: 2 }],
      2,
    );
    const falseExtrema = result.criticalPoints.filter((point) =>
      point.quantity === 'moment'
      && Math.abs(point.x - 1) < 1e-8
      && (point.kind === 'maximum' || point.kind === 'minimum'));
    expect(falseExtrema).toEqual([]);
  });

  it('incluye un breakpoint continuo como candidato exacto de extremo', () => {
    // The load is split in two equal pieces solely to create a continuous
    // breakpoint at x=1. V changes sign there, so M has its exact maximum there.
    const result = buildExactDiagrams(
      [0, 1, 0, 0, 1, 0],
      [
        { kind: 'distributed', a: 0, b: 1, qxA: 0, qxB: 0, qyA: -1, qyB: -1 },
        { kind: 'distributed', a: 1, b: 2, qxA: 0, qxB: 0, qyA: -1, qyB: -1 },
      ],
      2,
    );
    const maximum = result.criticalPoints.find((point) => point.quantity === 'moment' && point.kind === 'maximum');
    expect(maximum).toBeDefined();
    close(maximum!.x, 1);
    close(maximum!.value, 0.5);
  });

  it('conserva un extremo local en breakpoint aunque no sea el extremo global', () => {
    const result = buildExactDiagrams(
      [0, 1, 0, 0, 0, 0],
      [
        { kind: 'distributed', a: 0, b: 1, qxA: 0, qxB: 0, qyA: -1, qyB: -1 },
        { kind: 'distributed', a: 1, b: 4, qxA: 0, qxB: 0, qyA: -1, qyB: -1 },
        { kind: 'point', x: 2, px: 0, py: 3 },
      ],
      4,
    );
    const localMaximum = result.criticalPoints.find((point) =>
      point.quantity === 'moment' && point.kind === 'maximum' && Math.abs(point.x - 1) < 1e-8);
    expect(localMaximum).toBeDefined();
    close(localMaximum!.value, 0.5);
    expect(result.criticalPoints.some((point) =>
      point.quantity === 'moment' && point.kind === 'maximum' && point.value > localMaximum!.value + 1)).toBe(true);
  });

  it('agrupa cargas concentradas casi coincidentes con la tolerancia geométrica', () => {
    const result = buildExactDiagrams(
      [0, 0, 0, 0, 0, 0],
      [
        { kind: 'point', x: 2, px: 1, py: -2 },
        { kind: 'point', x: 2 + 5e-10, px: 3, py: -5 },
        { kind: 'moment', x: 2 + 8e-10, moment: 11 },
      ],
      10,
    );
    expect(result.jumps).toHaveLength(1);
    close(result.jumps[0].axialDelta, -4);
    close(result.jumps[0].shearDelta, -7);
    close(result.jumps[0].momentDelta, -11);
  });

  it('devuelve correctamente los límites exteriores e interiores en x=0 y x=L', () => {
    const start = buildExactDiagrams(
      [0, 0, 0, 0, 0, 0],
      [{ kind: 'point', x: 0, px: 0, py: 9 }],
      3,
    );
    close(evaluateDiagramAt(start.segments, start.jumps, 0, 'left')!.shear, 0);
    close(evaluateDiagramAt(start.segments, start.jumps, 0, 'right')!.shear, 9);

    const end = buildExactDiagrams(
      [0, 0, 0, 0, 0, 0],
      [{ kind: 'point', x: 3, px: 0, py: 9 }],
      3,
    );
    close(evaluateDiagramAt(end.segments, end.jumps, 3, 'left')!.shear, 0);
    close(evaluateDiagramAt(end.segments, end.jumps, 3, 'right')!.shear, 9);
  });

  it('excluye los estados exteriores de los extremos globales del miembro', () => {
    const result = buildExactDiagrams(
      [0, 0, 0, 0, 0, 0],
      [{ kind: 'point', x: 4, px: 0, py: 100 }],
      4,
    );
    const maxima = result.criticalPoints.filter((point) => point.quantity === 'shear' && point.kind === 'maximum');
    const minima = result.criticalPoints.filter((point) => point.quantity === 'shear' && point.kind === 'minimum');
    expect(maxima.some((point) => Math.abs(point.value - 100) < 1e-8)).toBe(false);
    expect(minima.some((point) => Math.abs(point.value - 100) < 1e-8)).toBe(false);
    close(Math.max(...maxima.map((point) => point.value)), 0);
    close(Math.min(...minima.map((point) => point.value)), 0);
  });

  it('mantiene un orden estable left-continuous-right sin duplicar breakpoints', () => {
    const result = buildExactDiagrams(
      [0, 0, 0, 0, 0, 0],
      [
        { kind: 'distributed', a: 0, b: 1, qxA: 0, qxB: 0, qyA: -1, qyB: -1 },
        { kind: 'distributed', a: 1, b: 3, qxA: 0, qxB: 0, qyA: 0, qyB: 0 },
        { kind: 'point', x: 2, px: 0, py: -3 },
      ],
      3,
    );
    expect(result.points.filter((point) => Math.abs(point.x - 1) < 1e-9).map((point) => point.side)).toEqual(['continuous']);
    expect(result.points.filter((point) => Math.abs(point.x - 2) < 1e-9).map((point) => point.side)).toEqual(['left', 'right']);
    for (let index = 1; index < result.points.length; index += 1) {
      expect(result.points[index].x).toBeGreaterThanOrEqual(result.points[index - 1].x);
    }
  });

  it('superpone exactamente cargas parciales solapadas, saltos y factores negativos', () => {
    const length = 7;
    const loadsA = [
      { kind: 'distributed' as const, a: 0.4, b: 5.2, qxA: 2, qxB: -1, qyA: -3, qyB: -9 },
      { kind: 'point' as const, x: 2.3, px: 4, py: -6 },
    ];
    const loadsB = [
      { kind: 'distributed' as const, a: 1.1, b: 6.7, qxA: -5, qxB: 3, qyA: 7, qyB: -2 },
      { kind: 'moment' as const, x: 4.4, moment: 11 },
    ];
    const endA = [3, 8, -2, -1, 5, 4];
    const endB = [-2, 1, 6, 4, -3, -5];
    const a = buildExactDiagrams(endA, loadsA, length);
    const b = buildExactDiagrams(endB, loadsB, length);
    const combined = buildExactDiagrams(endA.map((value, index) => value + endB[index]), [...loadsA, ...loadsB], length);
    for (const x of [0.2, 0.7, 1.7, 3.3, 5.8, 6.9]) {
      const pa = evaluateDiagramAt(a.segments, a.jumps, x)!;
      const pb = evaluateDiagramAt(b.segments, b.jumps, x)!;
      const pc = evaluateDiagramAt(combined.segments, combined.jumps, x)!;
      close(pc.axial, pa.axial + pb.axial, 2e-8);
      close(pc.shear, pa.shear + pb.shear, 2e-8);
      close(pc.moment, pa.moment + pb.moment, 2e-8);
    }
  });
});
