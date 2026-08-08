import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { evaluateDeformationAt } from './diagram';
import { analyzeProject } from './solver';

const close = (actual: number, expected: number, rtol = 1e-8, atol = 1e-10) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + rtol * Math.max(1, Math.abs(actual), Math.abs(expected)));
};

const project = (): ProjectModel => ({
  schemaVersion: 4,
  id: 'advanced',
  name: 'advanced',
  nodes: [],
  members: [],
  loadCases: [{ id: 'LC1', name: 'Caso', category: 'other', active: true }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings: createDefaultSettings(),
});

describe('acciones impuestas, Timoshenko y deformada exacta', () => {
  it('resuelve un asentamiento axial y conserva las reacciones opuestas', () => {
    const model = project();
    const L = 4;
    const E = 200e6;
    const A = 0.02;
    const delta = 0.003;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'fixed' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A, I: 8e-5 }];
    model.prescribedDisplacements = [{ id: 'PD1', nodeId: 'B', caseId: 'LC1', component: 'ux', value: delta }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const force = E * A * delta / L;
    close(result.memberResults[0].maxAxial, force);
    close(result.nodeResults[0].rx, -force);
    close(result.nodeResults[1].rx, force);
    close(result.nodeResults[1].ux, delta);
    expect(result.constraintResidual).toBeLessThan(1e-12);
  });

  it('una traslación prescrita común es un modo rígido sin fuerza axial', () => {
    const model = project();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 3, y: 0, support: { type: 'fixed' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }];
    model.prescribedDisplacements = [
      { id: 'PA', nodeId: 'A', caseId: 'LC1', component: 'ux', value: 1 },
      { id: 'PB', nodeId: 'B', caseId: 'LC1', component: 'ux', value: 1 },
    ];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.memberResults[0].maxAxial, 0, 1e-7, 1e-7);
    expect(result.issues.some((issue) => issue.id === 'small-displacement-assumption')).toBe(false);
  });

  it('reproduce expansión térmica libre y compresión térmica impedida', () => {
    const L = 5;
    const E = 210e6;
    const A = 0.015;
    const alpha = 1.2e-5;
    const deltaT = 35;
    const free = project();
    free.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    free.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A, I: 7e-5 }];
    free.memberInitialEffects = [{ id: 'T', memberId: 'AB', caseId: 'LC1', type: 'temperature', alpha, deltaT }];
    const freeResult = analyzeProject(free);
    expect(freeResult.success).toBe(true);
    close(freeResult.nodeResults[1].ux, alpha * deltaT * L);
    close(freeResult.memberResults[0].maxAxial, 0, 1e-7, 1e-7);

    const restrained = structuredClone(free);
    restrained.nodes[1].support = { type: 'fixed' };
    const restrainedResult = analyzeProject(restrained);
    expect(restrainedResult.success).toBe(true);
    close(restrainedResult.memberResults[0].minAxial, -E * A * alpha * deltaT);
  });

  it('integra una curvatura inicial libre sin crear momento espurio', () => {
    const model = project();
    const L = 3;
    const curvature = 0.002;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }];
    model.memberInitialEffects = [{ id: 'K', memberId: 'AB', caseId: 'LC1', type: 'initial-strain', curvature }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[1].rz, curvature * L);
    close(result.nodeResults[1].uy, curvature * L ** 2 / 2);
    close(result.memberResults[0].maxMoment, 0, 1e-7, 1e-7);
    expect(result.memberResults[0].compatibilityError).toBeLessThan(1e-10);
  });

  it('Timoshenko añade exactamente la flecha por cortante de un voladizo', () => {
    const model = project();
    const L = 2.4;
    const P = 50;
    const E = 210e6;
    const I = 5e-5;
    const G = 80e6;
    const shearArea = 0.008;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A: 0.012, I, beamTheory: 'timoshenko', G, shearArea }];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -P, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const tip = result.nodeResults[1];
    close(tip.uy, -P * (L ** 3 / (3 * E * I) + L / (G * shearArea)), 2e-8);
    close(tip.rz, -P * L ** 2 / (2 * E * I), 2e-8);
    expect(result.memberResults[0].compatibilityError).toBeLessThan(1e-9);
  });

  it('una conexión semirrígida reproduce la flexibilidad rotacional de base', () => {
    const model = project();
    const L = 3;
    const moment = 18;
    const E = 200e6;
    const I = 8e-5;
    const spring = 24_000;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A: 0.02, I, rotationalSpringI: spring }];
    model.nodalLoads = [{ id: 'M', nodeId: 'B', caseId: 'LC1', fx: 0, fy: 0, mz: moment }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.nodeResults[1].rz, moment * L / (E * I) + moment / spring, 2e-8);
    close(result.nodeResults[1].uy, moment * L ** 2 / (2 * E * I) + moment * L / spring, 2e-8);
    close(Math.abs(result.memberResults[0].maxMoment), moment, 2e-8);
  });

  it('detecta el máximo interior exacto de la deformada de una viga simple', () => {
    const model = project();
    const L = 6;
    const w = 12;
    const E = 200e6;
    const I = 9e-5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A: 0.02, I, releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const critical = result.memberResults[0].deformationCriticalPoints.filter((point) => point.quantity === 'v' && point.kind === 'minimum').reduce((best, point) => point.value < best.value ? point : best);
    close(critical.x, L / 2, 1e-8);
    close(critical.value, -5 * w * L ** 4 / (384 * E * I), 2e-7);
  });

  it('advierte una flecha interior grande aunque ambos nodos estén inmóviles', () => {
    const model = project();
    const L = 10;
    const w = 100;
    const E = 200e6;
    const I = 8.333e-6;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'fixed' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A: 0.02, I }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    result.nodeResults.forEach((node) => {
      close(node.ux, 0);
      close(node.uy, 0);
      close(node.rz, 0);
    });
    const minimum = result.memberResults[0].deformationCriticalPoints
      .filter((point) => point.quantity === 'v' && point.kind === 'minimum')
      .reduce((best, point) => point.value < best.value ? point : best);
    close(minimum.x, L / 2, 1e-8);
    close(minimum.value, -w * L ** 4 / (384 * E * I), 2e-7);
    expect(Math.abs(minimum.value) / L).toBeGreaterThan(0.05);
    expect(result.issues.some((issue) => issue.id === 'small-displacement-assumption')).toBe(true);
  });

  it('integra N/EA en una armadura vertical sometida a peso propio axial', () => {
    const model = project();
    const L = 10;
    const E = 200e6;
    const A = 0.01;
    const density = 7_850;
    const weight = density * 9.80665 * A / 1_000;
    model.loadCases = [{ id: 'LC1', name: 'Peso propio', category: 'permanent', active: true, selfWeightFactor: 1 }];
    model.nodes = [
      { id: 'A', x: 0, y: L, support: { type: 'pin' } },
      { id: 'B', x: 0, y: 0, support: { type: 'roller', angleDeg: 0 } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E, A, I: 0, density }];

    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const member = result.memberResults[0];
    const midpoint = evaluateDeformationAt(member.deformationSegments, L / 2)!;
    close(result.nodeResults[0].ry, weight * L);
    close(midpoint.u, 3 * weight * L ** 2 / (8 * E * A), 2e-8, 1e-12);
    close(member.localDisplacements[3], weight * L ** 2 / (2 * E * A), 2e-8, 1e-12);
    expect(member.compatibilityError).toBeLessThan(1e-11);
  });

  it('calcula energia elastica no nula para una viga empotrada con carga de miembro', () => {
    const model = project();
    const L = 6;
    const w = 10;
    const E = 200e6;
    const I = 8e-5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'fixed' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A: 0.02, I }];
    model.memberLoads = [{
      id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real',
      start: 0, end: 1, qyStart: -w, qyEnd: -w,
    }];

    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(result.educationTrace!.assembly.strainEnergy, w ** 2 * L ** 5 / (1_440 * E * I), 2e-8, 1e-12);
  });

  it('acota los digitos confiables por kappa y la precision de double', () => {
    const model = project();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 1, y: 0, support: { type: 'none' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 1_000, A: 1, I: 1 }];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 1, fy: 0, mz: 0 }];

    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    expect(result.linearResidual).toBe(0);
    expect(result.forwardErrorBound).toBeGreaterThanOrEqual(result.conditionEstimate * Number.EPSILON);
    expect(result.reliableDigits).toBeLessThanOrEqual(-Math.log10(Number.EPSILON));
    expect(result.reliableDigits).toBeLessThan(16);
  });

  it('expone la misma matriz y vectores usados por el solver educativo', () => {
    const model = project();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 2, y: 0, support: { type: 'none' } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    expect(result.educationTrace?.assembly.stiffness.rows).toBe(6);
    expect(result.educationTrace?.elements[0].localEndForces).toEqual(result.memberResults[0].localEndForces);
    expect(result.educationTrace?.dofs.map((dof) => dof.displacement)).toEqual(result.displacements);
  });
});
