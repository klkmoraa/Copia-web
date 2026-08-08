import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { analyzeProject } from './solver';
import { compareGeneralizedLoads, integrateIndependentMemberSourceLoads } from './loadAudit';

const settings: ProjectModel['settings'] = {
  units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
  showNodeLabels: true, showMemberLabels: true, showLocalAxes: false,
  showLoads: true, showDimensions: true, showResultValues: true,
  diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
};

const close = (actual: number, expected: number, tolerance = 1e-10) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(actual), Math.abs(expected)));
};

const beam = (originX = 0, originY = 0): ProjectModel => ({
  schemaVersion: 5,
  id: 'audit-beam',
  name: 'audit-beam',
  nodes: [
    { id: 'A', x: originX, y: originY, support: { type: 'fixed' } },
    { id: 'B', x: originX + 6, y: originY, support: { type: 'none' } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5, rigidOffsetI: 0.123456789, rigidOffsetJ: 0.234567891 }],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.37, px: 3, py: -10 }],
  memberInitialEffects: [],
  prescribedDisplacements: [],
  settings: { ...settings },
});

describe('auditoria independiente de cargas generalizadas', () => {
  it('reproduce el vector consistente cerrado de una carga uniforme', () => {
    const length = 8;
    const w = 12;
    const model = beam();
    model.nodes[1].x = length;
    model.members[0].rigidOffsetI = 0;
    model.members[0].rigidOffsetJ = 0;
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -w, qyEnd: -w }];
    const integrated = integrateIndependentMemberSourceLoads(model, model.members[0], { LC1: 1 })!;
    const expected = [0, -w * length / 2, -w * length ** 2 / 12, 0, -w * length / 2, w * length ** 2 / 12];
    integrated.mechanical.forEach((value, index) => close(value, expected[index]));
  });

  it('coincide con el ensamblaje Timoshenko para acciones parciales mixtas', () => {
    const model = beam();
    model.members[0] = { ...model.members[0], beamTheory: 'timoshenko', G: 80e6, shearArea: 0.008 };
    model.memberLoads = [
      { id: 'q', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'real', start: 0.17, end: 0.83, qxStart: 4, qxEnd: -2, qyStart: -7, qyEnd: -19 },
      { id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.41, px: 3, py: -11 },
      { id: 'M', memberId: 'AB', caseId: 'LC1', type: 'moment', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, position: 0.62, moment: 8 },
    ];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    const audit = result.loadAudit!.memberAudits[0];
    expect(audit.mechanical.normalizedResidual).toBeLessThan(2e-12);
    expect(audit.normalizedResidual).toBeLessThan(2e-12);
  });

  it('no produce falsos avisos para una carga puntual en el extremo del miembro', () => {
    const model = beam();
    model.members[0].rigidOffsetI = 0;
    model.members[0].rigidOffsetJ = 0;
    model.memberLoads = [{ id: 'P-end', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 1, px: 0, py: -40 }];
    const result = analyzeProject(model);
    expect(result.success).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'load-assembly-audit')).toBe(false);
    expect(result.loadAudit!.normalizedResidual).toBeLessThan(1e-10);

    model.memberLoads[0].position = 0.999999;
    const nearEnd = analyzeProject(model);
    expect(nearEnd.success).toBe(true);
    expect(nearEnd.issues.some((issue) => issue.id === 'load-assembly-audit')).toBe(false);
    expect(nearEnd.loadAudit!.normalizedResidual).toBeLessThan(1e-10);
  });

  it('detecta una mutacion autoequilibrada invisible para Fx, Fy y M globales', () => {
    const source = [0, -40, -20, 0, -40, 20];
    const delta = [0, 0, 5, 0, 0, -5];
    expect(delta[0] + delta[3]).toBe(0);
    expect(delta[1] + delta[4]).toBe(0);
    expect(delta[2] + delta[5]).toBe(0);
    const mutated = source.map((value, index) => value + delta[index]);
    const comparison = compareGeneralizedLoads(source, mutated, source.map(Math.abs));
    expect(comparison.normalizedResidual).toBeGreaterThan(0.1);
  });

  it('es invariante al trasladar el modelo a coordenadas globales enormes', () => {
    const base = analyzeProject(beam());
    const shifted = analyzeProject(beam(1e12, -3e11));
    expect(base.success).toBe(true);
    expect(shifted.success).toBe(true);
    expect(base.loadAudit!.normalizedResidual).toBeLessThan(1e-10);
    expect(shifted.loadAudit!.normalizedResidual).toBeLessThan(1e-10);
    expect(shifted.equilibrium.normalizedResidual).toBeLessThan(1e-10);
    for (const nodeId of ['A', 'B']) {
      const a = base.nodeResults.find((node) => node.nodeId === nodeId)!;
      const b = shifted.nodeResults.find((node) => node.nodeId === nodeId)!;
      [a.ux - b.ux, a.uy - b.uy, a.rz - b.rz, a.rx - b.rx, a.ry - b.ry, a.rm - b.rm]
        .forEach((difference) => close(difference, 0, 2e-9));
    }
  });

  it('no depende del orden de nodos, miembros ni cargas', () => {
    const original = beam();
    const permuted = structuredClone(original);
    permuted.nodes.reverse();
    permuted.members.reverse();
    permuted.memberLoads.reverse();
    const first = analyzeProject(original);
    const second = analyzeProject(permuted);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.loadAudit!.referencePoint).toEqual(first.loadAudit!.referencePoint);
    close(second.loadAudit!.normalizedResidual, first.loadAudit!.normalizedResidual, 1e-8);
    for (const nodeId of ['A', 'B']) {
      const a = first.nodeResults.find((node) => node.nodeId === nodeId)!;
      const b = second.nodeResults.find((node) => node.nodeId === nodeId)!;
      [a.ux - b.ux, a.uy - b.uy, a.rz - b.rz, a.rx - b.rx, a.ry - b.ry, a.rm - b.rm]
        .forEach((difference) => close(difference, 0, 2e-9));
    }
  });

  it('rechaza peso propio transversal silencioso en una barra de armadura', () => {
    const model = beam();
    model.nodes[0].support = { type: 'pin' };
    model.nodes[1].support = { type: 'roller', angleDeg: 90 };
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.01, I: 0, density: 7850 }];
    model.loadCases[0].selfWeightFactor = 1;
    model.memberLoads = [];
    const result = analyzeProject(model);
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'truss-self-weight-AB' && issue.severity === 'error')).toBe(true);
  });
});
