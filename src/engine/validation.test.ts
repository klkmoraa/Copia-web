import { describe, expect, it } from 'vitest';
import { validateProject } from './solver';
import type { ProjectModel } from '../types';

const empty = (): ProjectModel => ({
  schemaVersion: 2, id: 'v', name: 'v', nodes: [], members: [],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'other', active: true }], combinations: [], nodalLoads: [], memberLoads: [],
  settings: { units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true, showNodeLabels: true, showMemberLabels: true, showLocalAxes: false, showLoads: true, showDimensions: true, showResultValues: true, diagramScale: 1, deformedScale: 50, diagramSide: 'positive' },
});

describe('validación física del modelo', () => {
  it('detecta proyección horizontal nula en miembro vertical', () => {
    const model = empty();
    model.nodes = [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 0, y: 4, support: { type: 'roller', angleDeg: 0 } }];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    model.memberLoads = [{ id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'horizontal', start: 0, end: 1, qyStart: -10, qyEnd: -10 }];
    const issues = validateProject(model);
    expect(issues.some((issue) => issue.id === 'horizontal-basis-w' && issue.severity === 'error')).toBe(true);
  });

  it('rechaza cargas intermedias en barras de armadura', () => {
    const model = empty();
    model.nodes = [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 2, y: 0, support: { type: 'roller', angleDeg: 90 } }];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.01, I: 0 }];
    model.memberLoads = [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, py: -10 }];
    const issues = validateProject(model);
    expect(issues.some((issue) => issue.id === 'truss-member-load-P')).toBe(true);
  });

  it('detecta nodos casi coincidentes y carga huérfana', () => {
    const model = empty();
    model.nodes = [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 1e-12, y: 0, support: { type: 'none' } }, { id: 'C', x: 2, y: 0, support: { type: 'roller', angleDeg: 90 } }];
    model.members = [{ id: 'AC', i: 'A', j: 'C', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    model.nodalLoads = [{ id: 'P', nodeId: 'X', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const issues = validateProject(model);
    expect(issues.some((issue) => issue.id.startsWith('near-node-'))).toBe(true);
    expect(issues.some((issue) => issue.id === 'nodal-node-P')).toBe(true);
  });

  it('no confunde cargas puntuales nulas con acciones físicas y reconoce peso propio', () => {
    const model = empty();
    model.nodes = [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } }];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, density: 7850 }];
    model.memberLoads = [{ id: 'P0', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: 0 }];
    expect(validateProject(model).some((issue) => issue.id === 'no-loads')).toBe(true);

    model.loadCases[0].selfWeightFactor = 1;
    expect(validateProject(model).some((issue) => issue.id === 'no-loads')).toBe(false);
  });

  it('rechaza propiedades de peso propio no finitas e identificadores repetidos', () => {
    const model = empty();
    model.nodes = [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } }];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, density: Number.NaN }];
    model.loadCases[0].selfWeightFactor = Number.POSITIVE_INFINITY;
    model.nodalLoads = [
      { id: 'P', nodeId: 'A', caseId: 'LC1', fx: 1, fy: 0, mz: 0 },
      { id: 'P', nodeId: 'B', caseId: 'LC1', fx: -1, fy: 0, mz: 0 },
    ];
    const issues = validateProject(model);
    expect(issues.some((issue) => issue.id === 'density-AB')).toBe(true);
    expect(issues.some((issue) => issue.id === 'self-weight-LC1')).toBe(true);
    expect(issues.some((issue) => issue.id === 'duplicate-nodal-load-id-P')).toBe(true);
  });

  it('explica cuando un apoyo está dibujado sobre un miembro pero no conectado', () => {
    const model = empty();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'C', x: 8, y: 0, support: { type: 'none' } },
      { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ id: 'AC', i: 'A', j: 'C', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    const issues = validateProject(model);
    expect(issues).toContainEqual(expect.objectContaining({
      id: 'node-on-member-B-AC', severity: 'error', title: 'Apoyo dibujado sin conexión estructural', objectId: 'B',
    }));
  });

  it('valida la dirección del resorte normal y efectos sobre vínculos rígidos', () => {
    const model = empty();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed', spring: { kNormal: 100, angleDeg: Number.NaN } } },
      { id: 'B', x: 2, y: 0, support: { type: 'none' } },
    ];
    model.members = [{ id: 'R', i: 'A', j: 'B', type: 'rigid', E: 0, A: 0, I: 0 }];
    model.memberInitialEffects = [{ id: 'T', memberId: 'R', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 20, gradient: 0 }];
    const issues = validateProject(model);
    expect(issues.some((issue) => issue.id === 'spring-angle-A' && issue.severity === 'error')).toBe(true);
    expect(issues.some((issue) => issue.id === 'initial-effect-rigid-T' && issue.severity === 'error')).toBe(true);
  });

  it('rechaza momentos sobre rotaciones contables y liberaciones sin significado físico', () => {
    const model = empty();
    model.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 2, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    model.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.01, I: 0, releases: { jMoment: true } }];
    model.nodalLoads = [{ id: 'M', nodeId: 'B', caseId: 'LC1', fx: 0, fy: 0, mz: 10 }];
    const issues = validateProject(model);
    expect(issues.some((issue) => issue.id === 'free-rotation-moment-M' && issue.severity === 'error')).toBe(true);
    expect(issues.some((issue) => issue.id === 'release-type-AB' && issue.severity === 'error')).toBe(true);
  });
});
