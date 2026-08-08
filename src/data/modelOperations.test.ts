import { describe, expect, it } from 'vitest';
import { createDefaultProject } from './defaultProject';
import {
  copyModelSelection,
  duplicateModelSelection,
  ensureNodeAtPoint,
  pasteModelClipboard,
  repairProjectTopology,
  structuralSelectionFromIds,
  toggleStructuralSelection,
} from './modelOperations';

describe('model clipboard operations', () => {
  it('duplicates a node and remaps its nodal loads without sharing references', () => {
    const project = createDefaultProject();
    const source = project.nodes[0];
    project.nodalLoads.push({ id: 'NL-copy', nodeId: source.id, caseId: project.loadCases[0].id, fx: 5, fy: -3, mz: 2 });

    const selection = duplicateModelSelection(project, { kind: 'node', id: source.id }, { x: 2, y: 1 });

    expect(selection?.kind).toBe('node');
    if (!selection || selection.kind !== 'node') throw new Error('Se esperaba una selección de nodo.');
    const copy = project.nodes.find((node) => node.id === selection.id)!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.x).toBe(source.x + 2);
    expect(copy.y).toBe(source.y + 1);
    const copiedLoad = project.nodalLoads.find((load) => load.nodeId === copy.id)!;
    expect(copiedLoad.id).not.toBe('NL-copy');
    expect(copiedLoad).toMatchObject({ fx: 5, fy: -3, mz: 2 });
    copy.support.type = 'none';
    expect(source.support.type).not.toBe(copy.support.type);
  });

  it('copies a member as a detached snapshot and safely remaps endpoints and loads on paste', () => {
    const project = createDefaultProject();
    const source = project.members[0];
    project.memberLoads.push({
      id: 'ML-copy', memberId: source.id, caseId: project.loadCases[0].id,
      type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
      px: 4, py: -9, position: 0.35,
    });
    const clipboard = copyModelSelection(project, { kind: 'member', id: source.id });
    expect(clipboard?.kind).toBe('member');
    source.E *= 2;

    const selection = pasteModelClipboard(project, clipboard!, { x: 1.25, y: -0.5 });
    expect(selection.kind).toBe('member');
    if (selection.kind !== 'member') throw new Error('Se esperaba una selección de miembro.');
    const copy = project.members.find((member) => member.id === selection.id)!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.i).not.toBe(source.i);
    expect(copy.j).not.toBe(source.j);
    expect(copy.E).not.toBe(source.E);
    const copiedLoad = project.memberLoads.find((load) => load.memberId === copy.id)!;
    expect(copiedLoad).toMatchObject({ type: 'point', px: 4, py: -9, position: 0.35 });
    expect(copiedLoad.id).not.toBe('ML-copy');
    const copiedI = project.nodes.find((node) => node.id === copy.i)!;
    const sourceI = project.nodes.find((node) => node.id === source.i)!;
    expect(copiedI.x).toBe(sourceI.x + 1.25);
    expect(copiedI.y).toBe(sourceI.y - 0.5);
  });

  it('ignores unsupported load selections instead of creating corrupt clipboard data', () => {
    const project = createDefaultProject();
    expect(copyModelSelection(project, { kind: 'nodalLoad', id: 'missing' })).toBeNull();
  });

  it('construye y alterna una selección múltiple sin duplicar identificadores', () => {
    let selection = structuralSelectionFromIds(['N1', 'N1'], ['M1']);
    expect(selection).toEqual({ kind: 'multi', nodeIds: ['N1'], memberIds: ['M1'] });
    selection = toggleStructuralSelection(selection, { kind: 'node', id: 'N2' });
    expect(selection).toEqual({ kind: 'multi', nodeIds: ['N1', 'N2'], memberIds: ['M1'] });
    selection = toggleStructuralSelection(selection, { kind: 'member', id: 'M1' });
    expect(selection).toEqual({ kind: 'multi', nodeIds: ['N1', 'N2'], memberIds: [] });
  });

  it('duplica una selección múltiple remapeando una sola vez los nodos compartidos', () => {
    const project = createDefaultProject();
    const selectedMembers = project.members.slice(0, 2);
    const selectedNodeIds = [...new Set(selectedMembers.flatMap((member) => [member.i, member.j]))];
    const beforeNodes = project.nodes.length;
    const beforeMembers = project.members.length;
    const duplicated = duplicateModelSelection(project, { kind: 'multi', nodeIds: selectedNodeIds, memberIds: selectedMembers.map((member) => member.id) }, { x: 1, y: 1 });
    expect(duplicated?.kind).toBe('multi');
    if (!duplicated || duplicated.kind !== 'multi') throw new Error('Se esperaba una selección múltiple.');
    expect(project.nodes).toHaveLength(beforeNodes + selectedNodeIds.length);
    expect(project.members).toHaveLength(beforeMembers + selectedMembers.length);
    expect(new Set(duplicated.nodeIds).size).toBe(duplicated.nodeIds.length);
    for (const memberId of duplicated.memberIds) {
      const member = project.members.find((item) => item.id === memberId)!;
      expect(duplicated.nodeIds).toContain(member.i);
      expect(duplicated.nodeIds).toContain(member.j);
    }
  });

  it('reuses a coincident node instead of creating duplicate topology', () => {
    const project = createDefaultProject();
    const existing = project.nodes[0];
    const before = project.nodes.length;
    const result = ensureNodeAtPoint(project, { x: existing.x, y: existing.y });
    expect(result).toEqual({ nodeId: existing.id, created: false });
    expect(project.nodes).toHaveLength(before);
  });

  it('repairs an interior support while preserving loads and exterior connections', () => {
    const project = createDefaultProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 8, y: 0, support: { type: 'none' } },
      { id: 'N3', x: 0, y: 0, support: { type: 'none' } },
      { id: 'N4', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{
      id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5,
      releases: { iMoment: true, jMoment: true }, rotationalSpringI: 1200, rotationalSpringJ: 2400,
    }];
    project.memberLoads = [
      { id: 'ML1', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -40, position: 0.5 },
      { id: 'ML2', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -10, position: 0.875 },
    ];

    const report = repairProjectTopology(project);

    expect(report.mergedNodes).toEqual([{ keptNodeId: 'N1', removedNodeId: 'N3' }]);
    expect(report.splitMembers).toHaveLength(1);
    expect(project.nodes.map((node) => node.id)).toEqual(['N1', 'N2', 'N4']);
    expect(project.members).toHaveLength(2);
    const first = project.members.find((member) => member.id === 'M1')!;
    const second = project.members.find((member) => member.id !== 'M1')!;
    expect(first).toMatchObject({ i: 'N1', j: 'N4', releases: { iMoment: true }, rotationalSpringI: 1200 });
    expect(first.rotationalSpringJ).toBeUndefined();
    expect(second).toMatchObject({ i: 'N4', j: 'N2', releases: { jMoment: true }, rotationalSpringJ: 2400 });
    expect(second.rotationalSpringI).toBeUndefined();
    expect(project.memberLoads.find((load) => load.id === 'ML1')).toMatchObject({ memberId: 'M1', position: 2 / 3 });
    expect(project.memberLoads.find((load) => load.id === 'ML2')).toMatchObject({ memberId: second.id, position: 0.5 });
  });

  it('connects multiple interior nodes and every member at a crossing', () => {
    const project = createDefaultProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'none' } },
      { id: 'D', x: 9, y: 0, support: { type: 'none' } },
      { id: 'B', x: 3, y: 0, support: { type: 'pin' } },
      { id: 'C', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{ id: 'AD', i: 'A', j: 'D', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    project.memberLoads = [];
    const repaired = repairProjectTopology(project);
    expect(repaired.splitMembers).toHaveLength(2);
    expect(project.members).toHaveLength(3);
    expect(project.members.filter((member) => member.i === 'B' || member.j === 'B')).toHaveLength(2);
    expect(project.members.filter((member) => member.i === 'C' || member.j === 'C')).toHaveLength(2);

    project.nodes = [
      { id: 'L', x: -2, y: 0, support: { type: 'none' } },
      { id: 'R', x: 2, y: 0, support: { type: 'none' } },
      { id: 'T', x: 0, y: 2, support: { type: 'none' } },
      { id: 'B', x: 0, y: -2, support: { type: 'none' } },
    ];
    project.members = [
      { id: 'H', i: 'L', j: 'R', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 },
      { id: 'V', i: 'T', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 },
    ];
    const crossing = ensureNodeAtPoint(project, { x: 0, y: 0 });
    expect(project.members).toHaveLength(4);
    expect(project.members.filter((member) => member.i === crossing.nodeId || member.j === crossing.nodeId)).toHaveLength(4);
  });
});
