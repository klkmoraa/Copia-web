import { describe, expect, it } from 'vitest';
import { analyzeProject } from './solver';
import { createDefaultProject } from '../data/defaultProject';
import { repairProjectTopology } from '../data/modelOperations';
import type { ProjectModel } from '../types';

const baseProject = (): ProjectModel => ({
  schemaVersion: 1,
  id: 'test',
  name: 'test',
  nodes: [],
  members: [],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
    showNodeLabels: true, showMemberLabels: false, showLocalAxes: false, showLoads: true,
    showDimensions: true, showResultValues: true, diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
  },
});

const close = (actual: number, expected: number, tolerance = 1e-6) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));
};

describe('motor estructural structureCo', () => {
  it('resuelve una viga simple con carga puntual central', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, releases: { iMoment: true, jMoment: true } }];
    project.memberLoads = [{ id: 'P', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -40, position: 0.5 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, 20);
    close(result.nodeResults[1].ry, 20);
    close(result.memberResults[0].maxMoment, 80, 1e-5);
    close(result.memberResults[0].localEndForces[2], 0);
    close(result.memberResults[0].localEndForces[5], 0);
  });

  it('resuelve una viga simple con carga uniforme', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, releases: { iMoment: true, jMoment: true } }];
    project.memberLoads = [{ id: 'W', memberId: 'M1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, 30);
    close(result.nodeResults[1].ry, 30);
    close(result.memberResults[0].maxMoment, 45, 2e-4);
  });

  it('clasifica correctamente las fuerzas de una armadura triangular', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
      { id: 'N3', x: 3, y: 4, support: { type: 'none' } },
    ];
    project.members = [
      { id: 'M1', i: 'N1', j: 'N2', type: 'truss', E: 200e6, A: 0.003, I: 0 },
      { id: 'M2', i: 'N1', j: 'N3', type: 'truss', E: 200e6, A: 0.003, I: 0 },
      { id: 'M3', i: 'N2', j: 'N3', type: 'truss', E: 200e6, A: 0.003, I: 0 },
    ];
    project.nodalLoads = [{ id: 'P', nodeId: 'N3', caseId: 'LC1', fx: 0, fy: -60, mz: 0 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, 30);
    close(result.nodeResults[1].ry, 30);
    const forces = Object.fromEntries(result.memberResults.map((member) => [member.memberId, member.diagram[0].axial]));
    close(forces.M1, 22.5, 1e-5);
    close(forces.M2, -37.5, 1e-5);
    close(forces.M3, -37.5, 1e-5);
  });

  it('convierte una carga por proyección horizontal usando la geometría real', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 3, y: 4, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, releases: { iMoment: true, jMoment: true } }];
    project.memberLoads = [{ id: 'W', memberId: 'M1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'horizontal', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry + result.nodeResults[1].ry, 30, 1e-5);
    close(result.nodeResults[0].ry, 15, 1e-5);
    close(result.nodeResults[1].ry, 15, 1e-5);
  });


  it('resuelve el pórtico inicial y conserva el equilibrio vertical', () => {
    const result = analyzeProject(createDefaultProject());
    expect(result.success).toBe(true);
    const totalRy = result.nodeResults.reduce((sum, node) => sum + node.ry, 0);
    close(totalRy, 130, 1e-6);
    expect(result.residualNorm).toBeLessThan(1e-8);
  });

  it('rechaza una estructura sin restricciones suficientes', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'none' } },
      { id: 'N2', x: 4, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    project.nodalLoads = [{ id: 'P', nodeId: 'N2', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(true);
  });

  it('identifica los nodos dominantes de un mecanismo de cuerpo rígido', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 4, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    project.nodalLoads = [{ id: 'P', nodeId: 'N2', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(false);
    expect(result.mechanism).toBeDefined();
    expect(result.mechanism!.nullity).toBeGreaterThanOrEqual(1);
    expect(result.mechanism!.residual).toBeLessThan(1e-8);
    expect(result.mechanism!.nodes.some((node) => node.nodeId === 'N2')).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('modo nulo'))).toBe(true);
  });

  it('repara y resuelve la topología exacta de una viga con voladizo', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 8, y: 0, support: { type: 'none' } },
      { id: 'N3', x: 0, y: 0, support: { type: 'none' } },
      { id: 'N4', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, releases: { iMoment: true, jMoment: true } }];
    project.memberLoads = [
      { id: 'P1', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -90, position: 0.2 },
      { id: 'P2', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -40, position: 0.5 },
    ];

    const repair = repairProjectTopology(project);
    const result = analyzeProject(project);

    expect(repair.mergedNodes).toHaveLength(1);
    expect(repair.splitMembers).toHaveLength(1);
    expect(result.success).toBe(true);
    close(result.nodeResults.find((node) => node.nodeId === 'N1')!.ry, 79.3333333333, 1e-8);
    close(result.nodeResults.find((node) => node.nodeId === 'N4')!.ry, 50.6666666667, 1e-8);
    expect(result.equilibrium.normalizedResidual).toBeLessThan(1e-10);
  });

  it('ignora nodos de dibujo aislados e inactivos sin ocultar la advertencia', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
      { id: 'draft', x: 9, y: 3, support: { type: 'none' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, releases: { iMoment: true, jMoment: true } }];
    project.memberLoads = [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -20, position: 0.5 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'isolated-draft' && issue.severity === 'warning')).toBe(true);
    expect(result.nodeResults.find((node) => node.nodeId === 'draft')).toMatchObject({ ux: 0, uy: 0, rz: 0 });
  });

  it('acepta una estructura estabilizada exclusivamente por resortes', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'none', spring: { kx: 1e6, ky: 1e6, kr: 1e6 } } },
      { id: 'B', x: 3, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    project.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults.find((node) => node.nodeId === 'A')!.ry, 10, 1e-8);
  });

  it('reduce lazos redundantes de vínculos rígidos sin inventar un mecanismo', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 2, y: 0, support: { type: 'none' } },
      { id: 'C', x: 1, y: 1, support: { type: 'none' } },
    ];
    project.members = [
      { id: 'AB', i: 'A', j: 'B', type: 'rigid', E: 0, A: 0, I: 0 },
      { id: 'BC', i: 'B', j: 'C', type: 'rigid', E: 0, A: 0, I: 0 },
      { id: 'AC', i: 'A', j: 'C', type: 'rigid', E: 0, A: 0, I: 0 },
    ];
    project.nodalLoads = [{ id: 'P', nodeId: 'C', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults.find((node) => node.nodeId === 'A')!.ry, 10, 1e-8);
    close(result.nodeResults.find((node) => node.nodeId === 'A')!.rm, 10, 1e-8);
  });

  it('no fija rotaciones físicas cuando EA y EI difieren muchos órdenes de magnitud', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 1, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 1, A: 1e15, I: 1 }];
    project.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -1, mz: 0 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults.find((node) => node.nodeId === 'B')!.uy, -1 / 3, 1e-9);
    close(result.nodeResults.find((node) => node.nodeId === 'B')!.rz, -1 / 2, 1e-9);
  });
});
