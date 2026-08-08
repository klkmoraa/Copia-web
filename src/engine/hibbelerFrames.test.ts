import { describe, expect, it } from 'vitest';
import type { MemberModel, ProjectModel } from '../types';
import { evaluateDiagramAt } from './diagram';
import { analyzeProject } from './solver';
import { fromDisplay, toDisplay } from './units';

const settings: ProjectModel['settings'] = {
  units: 'kip-ft', language: 'es', gridSize: 1, snap: true, showGrid: true,
  showNodeLabels: true, showMemberLabels: true, showLocalAxes: true,
  showLoads: true, showDimensions: true, showResultValues: true,
  diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
};

const base = (id: string): ProjectModel => ({
  schemaVersion: 5,
  id,
  name: id,
  nodes: [],
  members: [],
  loadCases: [{ id: 'LC1', name: 'Cargas del ejercicio', category: 'other', active: true }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings,
});

const ft = (value: number) => fromDisplay(value, 'kip-ft', 'length');
const kip = (value: number) => fromDisplay(value, 'kip-ft', 'force');
const kipPerFt = (value: number) => fromDisplay(value, 'kip-ft', 'distributedForce');
const asKip = (value: number) => toDisplay(value, 'kip-ft', 'force');
const asKipFt = (value: number) => toDisplay(value, 'kip-ft', 'moment');

// The examples are statically determinate, so these arbitrary common stiffnesses
// affect only displacements, not reactions or N-V-M diagrams.
const frame = (id: string, i: string, j: string): MemberModel => ({
  id, i, j, type: 'frame',
  E: fromDisplay(29_000, 'kip-ft', 'elasticModulus'),
  A: fromDisplay(10, 'kip-ft', 'area'),
  I: fromDisplay(1_000, 'kip-ft', 'inertia'),
});

export const hibbeler440 = (): ProjectModel => {
  const model = base('Hibbeler 4-40');
  model.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'B', x: 0, y: ft(15), support: { type: 'none' } },
    { id: 'C', x: ft(12), y: ft(15), support: { type: 'none' } },
    { id: 'D', x: ft(12), y: 0, support: { type: 'pin' } },
  ];
  model.members = [frame('AB', 'A', 'B'), frame('BC', 'B', 'C'), frame('DC', 'D', 'C')];
  model.nodalLoads = [{ id: 'C', nodeId: 'C', caseId: 'LC1', fx: kip(-3), fy: kip(-4), mz: 0 }];
  model.memberLoads = [{
    id: 'w', memberId: 'BC', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
    lengthBasis: 'real', start: 0, end: 8 / 12, qxStart: 0, qxEnd: 0, qyStart: kipPerFt(-2), qyEnd: kipPerFt(-2),
  }];
  return model;
};

export const hibbeler439 = (): ProjectModel => {
  const model = base('Hibbeler 4-39');
  model.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 0, y: ft(16), support: { type: 'none' } },
    { id: 'C', x: ft(20), y: ft(16), support: { type: 'none' } },
    { id: 'D', x: ft(20), y: 0, support: { type: 'roller', angleDeg: 90 } },
  ];
  model.members = [frame('AB', 'A', 'B'), frame('BC', 'B', 'C'), frame('DC', 'D', 'C')];
  model.memberLoads = [
    { id: 'wx', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: kipPerFt(0.6), qxEnd: kipPerFt(0.6), qyStart: 0, qyEnd: 0 },
    { id: 'wy', memberId: 'BC', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: kipPerFt(-0.8), qyEnd: kipPerFt(-0.8) },
  ];
  return model;
};

export const hibbeler441 = (): ProjectModel => {
  const model = base('Hibbeler 4-41');
  model.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 0, y: ft(15), support: { type: 'none' }, internalHinge: true },
    { id: 'E', x: ft(8), y: ft(15), support: { type: 'none' } },
    { id: 'F', x: ft(16), y: ft(15), support: { type: 'none' } },
    { id: 'C', x: ft(24), y: ft(15), support: { type: 'none' }, internalHinge: true },
    { id: 'D', x: ft(24), y: 0, support: { type: 'pin' }, internalHinge: true },
  ];
  model.members = [
    frame('AB', 'A', 'B'), frame('BE', 'B', 'E'), frame('EF', 'E', 'F'),
    frame('FC', 'F', 'C'), frame('DC', 'D', 'C'),
  ];
  model.nodalLoads = [
    { id: 'PB', nodeId: 'B', caseId: 'LC1', fx: 0, fy: kip(-3), mz: 0 },
    { id: 'PE', nodeId: 'E', caseId: 'LC1', fx: 0, fy: kip(-6), mz: 0 },
    { id: 'PF', nodeId: 'F', caseId: 'LC1', fx: 0, fy: kip(-6), mz: 0 },
    { id: 'PC', nodeId: 'C', caseId: 'LC1', fx: 0, fy: kip(-3), mz: 0 },
  ];
  model.memberLoads = [{
    id: 'wx', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
    lengthBasis: 'real', start: 0, end: 1, qxStart: kipPerFt(0.8), qxEnd: kipPerFt(0.8), qyStart: 0, qyEnd: 0,
  }];
  return model;
};

export const hibbeler442 = (): ProjectModel => {
  const model = base('Hibbeler 4-42');
  model.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 0, y: ft(8), support: { type: 'none' }, internalHinge: true },
    { id: 'C', x: ft(12), y: ft(8), support: { type: 'roller', angleDeg: 90 } },
  ];
  model.members = [frame('AB', 'A', 'B'), frame('BC', 'B', 'C')];
  model.memberLoads = [
    { id: 'wx', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: kipPerFt(0.5), qxEnd: kipPerFt(0.5), qyStart: 0, qyEnd: 0 },
    { id: 'P', memberId: 'BC', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: kip(16), py: kip(-12) },
  ];
  return model;
};

const close = (actual: number, expected: number, tolerance = 1e-7) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));
};

const byNode = (model: ReturnType<typeof analyzeProject>, id: string) => model.nodeResults.find((node) => node.nodeId === id)!;
const byMember = (model: ReturnType<typeof analyzeProject>, id: string) => model.memberResults.find((member) => member.memberId === id)!;
const diagramAt = (
  model: ReturnType<typeof analyzeProject>, memberId: string, xFt: number, side: 'left' | 'right' = 'right',
) => {
  const member = byMember(model, memberId);
  return evaluateDiagramAt(member.diagramSegments, member.diagramJumps, ft(xFt), side)!;
};

describe('Hibbeler 4-39 a 4-42: marcos isostaticos', () => {
  it('4-40 coincide con equilibrio manual', () => {
    const result = analyzeProject(hibbeler440());
    expect(result.success).toBe(true);
    close(asKip(byNode(result, 'A').ry), 173 / 12);
    close(asKip(byNode(result, 'D').rx), 3);
    close(asKip(byNode(result, 'D').ry), 67 / 12);
    close(asKipFt(byMember(result, 'BC').maxMoment), (173 / 12) ** 2 / 4);
    close(asKip(diagramAt(result, 'BC', 8).shear), -19 / 12);
    close(asKipFt(diagramAt(result, 'BC', 8).moment), 154 / 3);
    close(asKipFt(diagramAt(result, 'BC', 12).moment), 45);
    close(asKip(diagramAt(result, 'DC', 7.5).shear), -3);
    close(asKipFt(diagramAt(result, 'DC', 15).moment), -45);
    close(result.equilibrium.normalizedResidual, 0, 1e-10);
  });

  it('4-39 coincide con equilibrio manual', () => {
    const result = analyzeProject(hibbeler439());
    expect(result.success).toBe(true);
    close(asKip(byNode(result, 'A').rx), -9.6);
    close(asKip(byNode(result, 'A').ry), 4.16);
    close(asKip(byNode(result, 'D').ry), 11.84);
    close(asKipFt(byMember(result, 'AB').maxMoment), 76.8);
    close(asKip(diagramAt(result, 'AB', 16).shear), 0);
    close(asKipFt(diagramAt(result, 'AB', 16).moment), 76.8);
    close(asKip(diagramAt(result, 'BC', 5.2).shear), 0);
    close(asKipFt(byMember(result, 'BC').maxMoment), 87.616);
    close(asKipFt(diagramAt(result, 'BC', 20).moment), 0);
    close(result.equilibrium.normalizedResidual, 0, 1e-10);
  });

  it('4-41 coincide con equilibrio manual', () => {
    const result = analyzeProject(hibbeler441());
    expect(result.success).toBe(true);
    close(asKip(byNode(result, 'A').rx), -12);
    close(asKip(byNode(result, 'A').ry), 9);
    close(asKipFt(byNode(result, 'A').rm), 90);
    close(asKip(byNode(result, 'D').ry), 9);
    close(asKipFt(byMember(result, 'AB').minMoment), -90);
    close(asKip(diagramAt(result, 'AB', 15).shear), 0);
    close(asKipFt(diagramAt(result, 'BE', 8).moment), 48);
    close(asKip(diagramAt(result, 'EF', 4).shear), 0);
    close(asKipFt(diagramAt(result, 'EF', 4).moment), 48);
    close(asKip(diagramAt(result, 'FC', 0).shear), -6);
    close(asKipFt(diagramAt(result, 'FC', 8).moment), 0);
    close(result.equilibrium.normalizedResidual, 0, 1e-10);
  });

  it('4-42 coincide con equilibrio manual', () => {
    const result = analyzeProject(hibbeler442());
    expect(result.success).toBe(true);
    close(asKip(byNode(result, 'A').rx), -20);
    close(asKip(byNode(result, 'A').ry), 6);
    close(asKipFt(byNode(result, 'A').rm), 144);
    close(asKip(byNode(result, 'C').ry), 6);
    close(asKipFt(byMember(result, 'AB').minMoment), -144);
    close(asKipFt(byMember(result, 'BC').maxMoment), 36);
    close(asKip(diagramAt(result, 'AB', 8).shear), 16);
    close(asKipFt(diagramAt(result, 'AB', 8).moment), 0);
    close(asKip(diagramAt(result, 'BC', 6, 'left').shear), 6);
    close(asKip(diagramAt(result, 'BC', 6, 'right').shear), -6);
    close(asKip(diagramAt(result, 'BC', 6, 'left').axial), 16);
    close(asKip(diagramAt(result, 'BC', 6, 'right').axial), 0);
    close(result.equilibrium.normalizedResidual, 0, 1e-10);
  });
});
