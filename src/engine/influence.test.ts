import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import {
  analyzeAxleTrain,
  buildInfluenceLine,
  evaluateAxleTrain,
  evaluateInfluenceLine,
  orderInfluencePath,
} from './influence';

const close = (actual: number, expected: number, rtol = 2e-7, atol = 2e-9) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + rtol * Math.max(1, Math.abs(actual), Math.abs(expected)));
};

const simplySupportedBeam = (): ProjectModel => ({
  schemaVersion: 5,
  id: 'influence-simple-beam',
  name: 'Viga simple para influencia',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }],
  loadCases: [{ id: 'STATIC', name: 'Cargas que deben ignorarse', category: 'other', active: true, selfWeightFactor: 1 }],
  combinations: [],
  nodalLoads: [{ id: 'OLD-P', nodeId: 'A', caseId: 'STATIC', fx: 123, fy: -456, mz: 78 }],
  prescribedDisplacements: [],
  memberLoads: [{
    id: 'OLD-W', memberId: 'AB', caseId: 'STATIC', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
    start: 0, end: 1, qxStart: 9, qxEnd: 11, qyStart: -77, qyEnd: -88,
  }],
  memberInitialEffects: [{ id: 'OLD-T', memberId: 'AB', caseId: 'STATIC', type: 'temperature', alpha: 1.2e-5, deltaT: 100 }],
  settings: createDefaultSettings(),
});

describe('líneas de influencia exactas por tramos', () => {
  it('recupera la triangular analítica de M en el centro de una viga simple', () => {
    const line = buildInfluenceLine(simplySupportedBeam(), ['AB'], { memberId: 'AB', x: 4, quantity: 'M' });

    expect(line.segments).toHaveLength(2);
    close(evaluateInfluenceLine(line, 0)!, 0);
    close(evaluateInfluenceLine(line, 2)!, 1);
    close(evaluateInfluenceLine(line, 4, 'left')!, 2);
    close(evaluateInfluenceLine(line, 4, 'right')!, 2);
    close(evaluateInfluenceLine(line, 6)!, 1);
    close(evaluateInfluenceLine(line, 8)!, 0);
    close(line.maximum.value, 2);
    close(line.maximum.position, 4);
    expect(line.jumps).toHaveLength(0);
    expect(line.fit.maxAbsoluteError).toBeLessThan(2e-8);
    expect(line.fit.interpolationRelativeResidual).toBeLessThan(1e-12);
    expect(line.solver.maxEquilibriumResidual).toBeLessThan(1e-9);
    expect(line.solver.maxLinearResidual).toBeLessThan(1e-12);
    expect(line.solver.analyses).toBe(12);
  });

  it('conserva el salto +1 y ambas ramas analíticas de V en el corte', () => {
    const line = buildInfluenceLine(simplySupportedBeam(), ['AB'], { memberId: 'AB', x: 4, quantity: 'V' });

    close(evaluateInfluenceLine(line, 2)!, -2 / 8);
    close(evaluateInfluenceLine(line, 3.75)!, -3.75 / 8);
    close(evaluateInfluenceLine(line, 4, 'left')!, -0.5);
    close(evaluateInfluenceLine(line, 4, 'right')!, 0.5);
    close(evaluateInfluenceLine(line, 4.25)!, (8 - 4.25) / 8);
    close(evaluateInfluenceLine(line, 6)!, (8 - 6) / 8);
    expect(line.jumps).toHaveLength(1);
    close(line.jumps[0].position, 4);
    close(line.jumps[0].delta, 1);
    close(line.minimum.value, -0.5);
    close(line.maximum.value, 0.5);
  });

  it('superpone un eje P=10 y obtiene Mmax=20 por derivadas, sin malla', () => {
    const line = buildInfluenceLine(simplySupportedBeam(), ['AB'], { memberId: 'AB', x: 4, quantity: 'M' });
    const envelope = analyzeAxleTrain(line, { axles: [{ id: 'A1', P: 10, offset: 0 }], impactFactor: 1 });

    close(envelope.maximum.value, 20);
    close(envelope.maximum.referencePosition, 4);
    close(evaluateAxleTrain(envelope, 2), 10);
    close(evaluateAxleTrain(envelope, 4), 20);
    close(evaluateAxleTrain(envelope, -1), 0);
    expect(envelope.segments).toHaveLength(2);

    // At reference x=4 the two axles occupy x=4 and x=2:
    // 1.2 * [10 * IL(4) + 5 * IL(2)] = 1.2 * (20 + 5) = 30.
    const tandem = analyzeAxleTrain(line, {
      axles: [{ id: 'front', P: 10, offset: 0 }, { id: 'rear', P: 5, offset: -2 }],
      impactFactor: 1.2,
    });
    close(tandem.maximum.value, 30);
    close(tandem.maximum.referencePosition, 4);
    close(evaluateAxleTrain(tandem, 4), 30);
  });

  it('ordena una cadena invertida y certifica un caso continuo Timoshenko', () => {
    const model: ProjectModel = {
      schemaVersion: 5,
      id: 'continuous-timoshenko',
      name: 'Dos vanos Timoshenko',
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 9, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      members: [
        { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 210e6, A: 0.018, I: 7e-5, beamTheory: 'timoshenko', G: 80e6, shearArea: 0.009 },
        { id: 'BC', i: 'C', j: 'B', type: 'frame', E: 210e6, A: 0.018, I: 7e-5, beamTheory: 'timoshenko', G: 80e6, shearArea: 0.009 },
      ],
      loadCases: [{ id: 'LC', name: 'Vacío', category: 'other', active: true }],
      combinations: [],
      nodalLoads: [],
      prescribedDisplacements: [],
      memberLoads: [],
      memberInitialEffects: [],
      settings: createDefaultSettings(),
    };
    const path = orderInfluencePath(model, ['BC', 'AB'], 'A');
    expect(path.members.map((member) => member.memberId)).toEqual(['AB', 'BC']);
    expect(path.members.map((member) => member.reversed)).toEqual([false, true]);
    close(path.length, 9);

    const line = buildInfluenceLine(model, ['BC', 'AB'], { memberId: 'BC', x: 1.3, quantity: 'M' }, 'A');
    expect(line.segments).toHaveLength(3);
    expect(line.fit.validations).toHaveLength(6);
    expect(line.fit.maxAbsoluteError).toBeLessThan(2e-7);
    expect(line.fit.maxRelativeError).toBeLessThan(2e-6);
    expect(line.solver.maxEquilibriumResidual).toBeLessThan(2e-9);
    expect(line.solver.maxLinearResidual).toBeLessThan(2e-12);
    expect(line.solver.minReliableDigits).toBeGreaterThan(4);
  });

  it('rechaza ramificaciones, miembros no-frame y factores de impacto inválidos', () => {
    const model = simplySupportedBeam();
    model.nodes.push(
      { id: 'C', x: 4, y: 4, support: { type: 'none' } },
      { id: 'D', x: 4, y: -4, support: { type: 'none' } },
    );
    model.members.push(
      { ...model.members[0], id: 'AC', i: 'A', j: 'C' },
      { ...model.members[0], id: 'AD', i: 'A', j: 'D' },
      { ...model.members[0], id: 'TR', i: 'C', j: 'D', type: 'truss' },
    );
    expect(() => orderInfluencePath(model, ['AB', 'AC', 'AD'])).toThrow(/ramifica/);
    expect(() => orderInfluencePath(model, ['TR'])).toThrow(/no es frame/);

    const line = buildInfluenceLine(simplySupportedBeam(), ['AB'], { memberId: 'AB', x: 4, quantity: 'M' });
    expect(() => analyzeAxleTrain(line, { axles: [{ P: 10, offset: 0 }], impactFactor: 0.99 })).toThrow(/impactFactor/);
    expect(() => analyzeAxleTrain(line, { axles: [{ P: -10, offset: 0 }] })).toThrow(/positiva/);
  });
});
