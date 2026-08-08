import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { DEFAULT_INFLUENCE_FIT_LIMITS, InfluenceFitError, buildInfluenceLine } from './influence';

const continuousBeam = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'influence-fit',
  name: 'Viga continua para influencia',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 14, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [
    { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
    { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
  ],
  loadCases: [{ id: 'Q', name: 'Q', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

describe('validación del ajuste de líneas de influencia', () => {
  it('acepta el ajuste exacto sin subdividir y publica el diagnóstico', () => {
    const line = buildInfluenceLine(continuousBeam(), ['AB', 'BC'], { memberId: 'AB', x: 4, quantity: 'M' });
    expect(line.fit.accepted).toBe(true);
    expect(line.fit.subdivisions).toBe(0);
    expect(line.fit.maxSubdivisionDepth).toBe(0);
    expect(line.fit.toleranceRelative).toBe(DEFAULT_INFLUENCE_FIT_LIMITS.maxRelativeError);
    expect(line.fit.toleranceAbsolute).toBe(DEFAULT_INFLUENCE_FIT_LIMITS.maxAbsoluteError);
    expect(line.fit.maxRelativeError).toBeLessThanOrEqual(line.fit.toleranceRelative);
    // Three intervals (AB up to the cut, the rest of AB, and BC).
    expect(line.segments).toHaveLength(3);
    expect(line.solver.analyses).toBe(18);
  });

  it('subdivide el intervalo cuando el ajuste no cumple y vuelve a comprobar', () => {
    // A tolerance below the arithmetic floor forces the subdivision path
    // without changing the physics of the model.
    let caught: InfluenceFitError | null = null;
    try {
      buildInfluenceLine(
        continuousBeam(),
        ['AB', 'BC'],
        { memberId: 'AB', x: 4, quantity: 'M' },
        undefined,
        { maxRelativeError: 1e-18, maxAbsoluteError: 1e-18, maxSubdivisions: 2 },
      );
    } catch (error) {
      caught = error as InfluenceFitError;
    }
    expect(caught).toBeInstanceOf(InfluenceFitError);
    expect(caught!.fit.subdivisions).toBeGreaterThan(0);
    expect(caught!.fit.maxSubdivisionDepth).toBe(2);
    // Each of the three base intervals is halved twice before being rejected.
    expect(caught!.fit.rejectedIntervals).toHaveLength(12);
    expect(caught!.fit.accepted).toBe(false);
  });

  it('rechaza la línea cuando el ajuste no cumple tras el límite de subdivisión', () => {
    let caught: InfluenceFitError | null = null;
    try {
      buildInfluenceLine(
        continuousBeam(),
        ['AB', 'BC'],
        { memberId: 'AB', x: 4, quantity: 'M' },
        undefined,
        { maxRelativeError: 1e-18, maxAbsoluteError: 1e-18, maxSubdivisions: 0 },
      );
    } catch (error) {
      caught = error as InfluenceFitError;
    }
    expect(caught).toBeInstanceOf(InfluenceFitError);
    expect(caught!.fit.subdivisions).toBe(0);
    expect(caught!.message).toMatch(/ajuste/i);
  });

  it('no entrega una línea rechazada al resto de la aplicación', () => {
    let line = null;
    try {
      line = buildInfluenceLine(
        continuousBeam(),
        ['AB', 'BC'],
        { memberId: 'AB', x: 4, quantity: 'V', side: 'left' },
        undefined,
        { maxRelativeError: 1e-18, maxAbsoluteError: 1e-18, maxSubdivisions: 1 },
      );
    } catch (error) {
      expect((error as Error).message).toMatch(/ajuste|tolerancia/i);
    }
    expect(line).toBeNull();
  });

  it('rechaza límites de ajuste no utilizables', () => {
    const project = continuousBeam();
    const target = { memberId: 'AB', x: 4, quantity: 'M' } as const;
    expect(() => buildInfluenceLine(project, ['AB'], target, undefined, { maxRelativeError: -1 })).toThrow();
    expect(() => buildInfluenceLine(project, ['AB'], target, undefined, { maxSubdivisions: -1 })).toThrow();
  });
});
