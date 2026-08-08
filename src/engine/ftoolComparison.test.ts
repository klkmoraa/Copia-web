import { describe, expect, it } from 'vitest';
import type { MemberModel, ProjectModel } from '../types';
import { analyzeProject } from './solver';

const settings: ProjectModel['settings'] = {
  units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
  showNodeLabels: true, showMemberLabels: true, showLocalAxes: false,
  showLoads: true, showDimensions: true, showResultValues: true,
  diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
};

const blank = (): ProjectModel => ({
  schemaVersion: 3,
  id: 'ftool-comparison',
  name: 'FTool comparison fixture',
  nodes: [],
  members: [],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: { ...settings },
});

const frame = (id: string, i: string, j: string, E = 200e6, A = 0.02, I = 8e-5): MemberModel => ({
  id, i, j, type: 'frame', E, A, I,
});

const close = (actual: number, expected: number, rtol = 3e-7, atol = 1e-9) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + rtol * Math.max(Math.abs(actual), Math.abs(expected), 1));
};

const node = (result: ReturnType<typeof analyzeProject>, id: string) =>
  result.nodeResults.find((item) => item.nodeId === id)!;

const member = (result: ReturnType<typeof analyzeProject>, id: string) =>
  result.memberResults.find((item) => item.memberId === id)!;

const maximumMoment = (result: ReturnType<typeof analyzeProject>, id: string) =>
  Math.max(...member(result, id).criticalPoints
    .filter((point) => point.quantity === 'moment')
    .map((point) => point.value));

/**
 * Regression half of the FTool comparison matrix. Every expected value below is
 * closed analytically. The FTool column remains external and pending until an
 * official installation is run and its output is archived with version/date.
 */
describe('matriz reproducible para comparación externa con FTool', () => {
  it('SC-FT-01 viga simple con carga puntual central', () => {
    const model = blank();
    const L = 8;
    const P = 24;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.5, py: -P }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').ry, P / 2);
    close(node(result, 'B').ry, P / 2);
    close(maximumMoment(result, 'AB'), P * L / 4);
  });

  it('SC-FT-02 viga simple con carga uniforme', () => {
    const model = blank();
    const L = 10;
    const w = 6;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').ry, w * L / 2);
    close(node(result, 'B').ry, w * L / 2);
    close(maximumMoment(result, 'AB'), w * L ** 2 / 8);
  });

  it('SC-FT-03 viga simple con carga triangular creciente', () => {
    const model = blank();
    const L = 9;
    const w = 12;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: 0, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').ry, w * L / 6);
    close(node(result, 'B').ry, w * L / 3);
    close(maximumMoment(result, 'AB'), w * L ** 2 / (9 * Math.sqrt(3)));
  });

  it('SC-FT-04 voladizo con carga puntual', () => {
    const model = blank();
    const L = 4;
    const P = 25;
    const E = 210e6;
    const I = 7.5e-5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    model.members = [frame('AB', 'A', 'B', E, 0.02, I)];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -P, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').ry, P);
    close(node(result, 'A').rm, P * L);
    close(node(result, 'B').uy, -P * L ** 3 / (3 * E * I));
  });

  it('SC-FT-05 voladizo con carga uniforme', () => {
    const model = blank();
    const L = 5;
    const w = 8;
    const E = 200e6;
    const I = 9e-5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    model.members = [frame('AB', 'A', 'B', E, 0.02, I)];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').ry, w * L);
    close(node(result, 'A').rm, w * L ** 2 / 2);
    close(node(result, 'B').uy, -w * L ** 4 / (8 * E * I));
  });

  it('SC-FT-06 viga empotrada-empotrada con carga uniforme', () => {
    const model = blank();
    const L = 6;
    const w = 10;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'fixed' } },
    ];
    model.members = [frame('AB', 'A', 'B')];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').ry, w * L / 2);
    close(node(result, 'B').ry, w * L / 2);
    close(Math.abs(node(result, 'A').rm), w * L ** 2 / 12);
    close(Math.abs(node(result, 'B').rm), w * L ** 2 / 12);
    close(maximumMoment(result, 'AB'), w * L ** 2 / 24);
  });

  it('SC-FT-07 pórtico desplazable simétrico con dintel rígido', () => {
    const model = blank();
    const H = 4;
    const bay = 6;
    const P = 40;
    const E = 200e6;
    const A = 0.02;
    const I = 8e-5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 0, y: H, support: { type: 'none' } },
      { id: 'C', x: bay, y: H, support: { type: 'none' } },
      { id: 'D', x: bay, y: 0, support: { type: 'fixed' } },
    ];
    model.members = [frame('AB', 'A', 'B', E, A, I), { id: 'BC', i: 'B', j: 'C', type: 'rigid', E: 0, A: 0, I: 0 }, frame('DC', 'D', 'C', E, A, I)];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: P, fy: 0, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    // Derivación cerrada de dos columnas idénticas y un diafragma rígido.
    // Se conserva la flexibilidad axial de las columnas: vC=vB+bay·theta.
    const kU = 24 * E * I / H ** 3;
    const kUTheta = 12 * E * I / H ** 2;
    const kTheta = 8 * E * I / H + E * A * bay ** 2 / (2 * H);
    const expectedU = P / (kU - kUTheta ** 2 / kTheta);
    const expectedTheta = -kUTheta * expectedU / kTheta;
    const expectedBaseMoment = 6 * E * I * expectedU / H ** 2 + 2 * E * I * expectedTheta / H;
    close(node(result, 'A').rx, -P / 2);
    close(node(result, 'D').rx, -P / 2);
    close(Math.abs(node(result, 'A').rm), expectedBaseMoment);
    close(Math.abs(node(result, 'D').rm), expectedBaseMoment);
    close(node(result, 'B').ux, expectedU);
    close(node(result, 'C').ux, expectedU);
  });

  it('SC-FT-08 miembro inclinado con carga vertical global', () => {
    const model = blank();
    const w = 10;
    const L = 5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 3, y: 4, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { iMoment: true, jMoment: true } }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').ry, w * L / 2);
    close(node(result, 'B').ry, w * L / 2);
    close(result.equilibrium.sumFx, 0, 1e-8);
    close(result.equilibrium.sumFy, 0, 1e-8);
  });

  it('SC-FT-09 miembro inclinado con carga transversal local', () => {
    const model = blank();
    const w = 10;
    const L = 5;
    const c = 3 / 5;
    const s = 4 / 5;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 3, y: 4, support: { type: 'none' } },
    ];
    model.members = [frame('AB', 'A', 'B')];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').rx, -w * L * s);
    close(node(result, 'A').ry, w * L * c);
    close(node(result, 'A').rm, w * L ** 2 / 2);
  });

  it('SC-FT-10 barra axial con resorte paralelo', () => {
    const model = blank();
    const L = 2;
    const E = 200e6;
    const A = 0.005;
    const k = 10000;
    const P = 50;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90, spring: { kx: k } } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E, A, I: 0 }];
    model.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: P, fy: 0, mz: 0 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const displacement = P / (E * A / L + k);
    close(node(result, 'B').ux, displacement);
    close(node(result, 'B').rx, -k * displacement);
  });

  it('SC-FT-11 viga empotrada-articulada con carga uniforme y liberación', () => {
    const model = blank();
    const L = 8;
    const w = 9;
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ ...frame('AB', 'A', 'B'), releases: { jMoment: true } }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qyStart: -w, qyEnd: -w }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    close(node(result, 'A').ry, 5 * w * L / 8);
    close(node(result, 'B').ry, 3 * w * L / 8);
    close(Math.abs(node(result, 'A').rm), w * L ** 2 / 8);
    close(member(result, 'AB').localEndForces[5], 0, 1e-9);
  });
});
