import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { analyzeProject, frameLocalStiffness, rigidOffsetTransform, validateProject } from './solver';
import { multiply, multiplyMatrixVector, transpose } from './math';

const baseProject = (): ProjectModel => ({
  schemaVersion: 3,
  id: 'connections',
  name: 'Connections',
  nodes: [],
  members: [],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
    showNodeLabels: true, showMemberLabels: true, showLocalAxes: false, showLoads: true,
    showDimensions: true, showResultValues: true, diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
  },
});

const expectClose = (actual: number, expected: number, rtol = 1e-8) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rtol * Math.max(1, Math.abs(expected)));
};

describe('articulaciones internas y zonas rígidas', () => {
  it('preserva simetría y energía de deformación bajo la transformación de offsets', () => {
    const member = { id: 'M', i: 'A', j: 'B', type: 'frame' as const, E: 200e6, A: 0.02, I: 8e-5 };
    const geometry = { L: 4.2, c: 0.8, s: 0.6, dx: 4.8, dy: 3.6 };
    const transform = rigidOffsetTransform(geometry, 0.4, 0.7);
    const localK = frameLocalStiffness(member, geometry.L);
    const globalK = multiply(multiply(transpose(transform), localK), transform);
    const d = [0.002, -0.001, 0.003, -0.0005, 0.0015, -0.002];
    const faceD = multiplyMatrixVector(transform, d);
    const energyGlobal = d.reduce((sum, value, index) => sum + value * multiplyMatrixVector(globalK, d)[index], 0);
    const energyFace = faceD.reduce((sum, value, index) => sum + value * multiplyMatrixVector(localK, faceD)[index], 0);
    expectClose(energyGlobal, energyFace, 2e-10);
    globalK.forEach((row, i) => row.forEach((value, j) => expectClose(value, globalK[j][i], 2e-10)));
  });

  it('convierte una articulación nodal en liberaciones exactas para todos los extremos incidentes', () => {
    const hinged = baseProject();
    hinged.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'H', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 }, internalHinge: true },
      { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    hinged.members = [
      { id: 'AH', i: 'A', j: 'H', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
      { id: 'HB', i: 'H', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
    ];
    hinged.memberLoads = [
      { id: 'w1', memberId: 'AH', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -10, qyEnd: -10 },
      { id: 'w2', memberId: 'HB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -6, qyEnd: -6 },
    ];

    const explicit = structuredClone(hinged);
    explicit.nodes.find((node) => node.id === 'H')!.internalHinge = false;
    explicit.members[0].releases = { jMoment: true };
    explicit.members[1].releases = { iMoment: true };

    const nodeHinge = analyzeProject(hinged);
    const endReleases = analyzeProject(explicit);
    expect(nodeHinge.success).toBe(true);
    expect(endReleases.success).toBe(true);
    expectClose(nodeHinge.memberResults[0].localEndForces[5], 0);
    expectClose(nodeHinge.memberResults[1].localEndForces[2], 0);
    nodeHinge.nodeResults.forEach((node, index) => {
      expectClose(node.uy, endReleases.nodeResults[index].uy, 1e-7);
      expectClose(node.ry, endReleases.nodeResults[index].ry, 1e-7);
    });
  });

  it('rechaza un momento nodal aplicado a la rotación libre de una articulación', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'H', x: 3, y: 0, support: { type: 'roller', angleDeg: 90 }, internalHinge: true },
      { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [
      { id: 'AH', i: 'A', j: 'H', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
      { id: 'HB', i: 'H', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 },
    ];
    project.nodalLoads = [{ id: 'M', nodeId: 'H', caseId: 'LC1', fx: 0, fy: 0, mz: 12 }];
    expect(validateProject(project).some((issue) => issue.id === 'hinge-moment-M' && issue.severity === 'error')).toBe(true);
  });

  it('trata ktheta=0 como una liberacion estable y como rotacion nodal contable', () => {
    const project = baseProject();
    const L = 4;
    const P = 10;
    const E = 200e6;
    const I = 8e-5;
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    project.members = [{
      id: 'AB', i: 'A', j: 'B', type: 'frame', E, A: 0.02, I, rotationalSpringJ: 0,
    }];
    project.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -P, mz: 0 }];

    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    expectClose(result.nodeResults[0].ry, P);
    expectClose(result.nodeResults[0].rm, P * L);
    expectClose(result.nodeResults[1].uy, -P * L ** 3 / (3 * E * I));
    expectClose(result.memberResults[0].localEndForces[5], 0);

    project.nodalLoads = [{ id: 'M', nodeId: 'B', caseId: 'LC1', fx: 0, fy: 0, mz: 5 }];
    expect(validateProject(project).some((issue) => issue.id === 'free-rotation-moment-M')).toBe(true);
  });

  it('conserva Rz cuando un resorte nodal kr es su unica rigidez', () => {
    const project = baseProject();
    const moment = 10;
    const kr = 1_000;
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90, spring: { kr } } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.02, I: 0 }];
    project.nodalLoads = [{ id: 'M', nodeId: 'B', caseId: 'LC1', fx: 0, fy: 0, mz: moment }];

    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    expectClose(result.nodeResults[1].rz, moment / kr);
    expectClose(result.nodeResults[1].rm, -moment);
    expectClose(result.educationTrace!.assembly.strainEnergy, moment ** 2 / (2 * kr));
    expect(result.equilibrium.normalizedResidual).toBeLessThan(1e-12);
  });

  it('usa la longitud flexible y compatibilidad cinemática exacta en una zona rígida de extremo', () => {
    const project = baseProject();
    const E = 200e6;
    const I = 8e-5;
    const force = 20;
    const flexibleLength = 4;
    const tipOffset = 1;
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 5, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A: 0.02, I, rigidOffsetJ: tipOffset }];
    project.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -force, mz: 0 }];

    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    // The joint force is transferred to the flexible face as P plus the exact
    // rigid-arm moment P*a. The joint translation also includes a*theta.
    const expectedRotation = -(force * flexibleLength ** 2 / 2 + force * tipOffset * flexibleLength) / (E * I);
    const expectedFaceV = -(force * flexibleLength ** 3 / 3 + force * tipOffset * flexibleLength ** 2 / 2) / (E * I);
    const expectedFaceDeflection = expectedFaceV + expectedRotation * tipOffset;
    expectClose(result.nodeResults[1].rz, expectedRotation, 1e-7);
    expectClose(result.nodeResults[1].uy, expectedFaceDeflection, 1e-7);
    expectClose(result.nodeResults[0].rm, force * 5, 1e-7);
    expect(result.memberResults[0].length).toBe(4);
    expect(result.memberResults[0].totalLength).toBe(5);
    expect(result.memberResults[0].startOffset).toBe(0);
    expect(result.memberResults[0].endOffset).toBe(1);
  });

  it('rechaza offsets que consumen el tramo flexible o que se aplican a una armadura', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 5, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.02, I: 0, rigidOffsetI: 3, rigidOffsetJ: 2 }];
    const issues = validateProject(project);
    expect(issues.some((issue) => issue.id === 'rigid-offset-length-AB')).toBe(true);
    expect(issues.some((issue) => issue.id === 'rigid-offset-type-AB')).toBe(true);
  });

  it('integra la deformada con precisión analítica en puntos interiores', () => {
    const project = baseProject();
    const L = 4;
    const P = 25;
    const E = 210e6;
    const I = 7.5e-5;
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: L, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A: 0.02, I }];
    project.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -P, mz: 0 }];
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    const midpoint = result.memberResults[0].deformation.find((point) => Math.abs(point.x - L / 2) < 1e-12)!;
    const expectedV = -(P * midpoint.x ** 2 * (3 * L - midpoint.x)) / (6 * E * I);
    const expectedTheta = -(P * midpoint.x * (2 * L - midpoint.x)) / (2 * E * I);
    expectClose(midpoint.v, expectedV, 2e-8);
    expectClose(midpoint.theta, expectedTheta, 2e-8);
    expect(result.memberResults[0].compatibilityError).toBeLessThan(1e-11);
    expect(result.memberResults[0].compatibilityComponents).toBeDefined();
  });
});
