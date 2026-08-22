import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import {
  applyProjectPatch,
  compileProjectCommand,
  invertProjectPatch,
  type ProjectCommand,
} from './projectCommand';

describe('ProjectCommand', () => {
  it('applies catalog material and section identity atomically with their numeric properties', () => {
    const project = createDefaultProject();
    const member = project.members[0];
    const material = compileProjectCommand(project, {
      kind: 'member.material.apply',
      description: `Aplicar material a ${member.id}`,
      memberId: member.id,
      materialId: 'steel-a992',
      properties: { E: 200e6, G: 76_923_076.9231, density: 7850 },
    });
    const withMaterial = applyProjectPatch(project, material.forward);
    expect(withMaterial.members[0]).toMatchObject({
      materialId: 'steel-a992', materialOrigin: 'catalog',
      E: 200e6, G: 76_923_076.9231, density: 7850,
    });

    const section = compileProjectCommand(withMaterial, {
      kind: 'member.section.apply',
      description: `Aplicar sección a ${member.id}`,
      memberId: member.id,
      sectionId: 'ipe-300',
      properties: { A: 0.00538, I: 0.0000836 },
    });
    const applied = applyProjectPatch(withMaterial, section.forward);
    expect(applied.members[0]).toMatchObject({
      sectionId: 'ipe-300', sectionOrigin: 'catalog', A: 0.00538, I: 0.0000836,
    });
  });

  it('invalidates catalog identity in the same patch as a manual numeric edit and restores it through undo/redo', () => {
    const project = createDefaultProject();
    const member = project.members[0] as typeof project.members[number] & Record<string, unknown>;
    Object.assign(member, {
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
    });
    const before = structuredClone(project);
    const compiled = compileProjectCommand(project, {
      kind: 'member.update', description: `Editar ${member.id}`, memberId: member.id,
      changes: { E: member.E * 1.01, A: member.A * 1.01 },
    });

    const edited = applyProjectPatch(project, compiled.forward);
    expect(edited.members[0]).toMatchObject({ materialOrigin: 'custom', sectionOrigin: 'custom' });
    expect(edited.members[0]).not.toHaveProperty('materialId');
    expect(edited.members[0]).not.toHaveProperty('sectionId');

    const undone = applyProjectPatch(edited, compiled.inverse);
    expect(undone).toEqual(before);
    const redone = applyProjectPatch(undone, compiled.forward);
    expect(redone).toEqual(edited);
  });

  it('does not recover a catalog identity when preset floats are typed back manually', () => {
    const project = createDefaultProject();
    const member = project.members[0] as typeof project.members[number] & Record<string, unknown>;
    Object.assign(member, { materialId: 'steel-a992', materialOrigin: 'catalog' });
    const invalidated = applyProjectPatch(project, compileProjectCommand(project, {
      kind: 'member.update', description: 'Editar E', memberId: member.id, changes: { E: 210e6 },
    }).forward);
    const restoredFloats = applyProjectPatch(invalidated, compileProjectCommand(invalidated, {
      kind: 'member.update', description: 'Reescribir E', memberId: member.id, changes: { E: 200e6 },
    }).forward);

    expect(restoredFloats.members[0]).toMatchObject({ E: 200e6, materialOrigin: 'custom' });
    expect(restoredFloats.members[0]).not.toHaveProperty('materialId');
  });

  it('applies and exactly reverses a member creation with a new endpoint', () => {
    const project = createDefaultProject();
    const before = structuredClone(project);
    const source = project.members[0];
    const command: ProjectCommand = {
      kind: 'member.create',
      description: 'Crear miembro M-new',
      nodes: [{ id: 'N-new', x: 10, y: 3, support: { type: 'none' } }],
      member: { ...structuredClone(source), id: 'M-new', i: source.j, j: 'N-new' },
    };

    const compiled = compileProjectCommand(project, command);
    const applied = applyProjectPatch(project, compiled.forward);
    expect(applied.nodes.at(-1)?.id).toBe('N-new');
    expect(applied.members.at(-1)?.id).toBe('M-new');
    expect(applyProjectPatch(applied, compiled.inverse)).toEqual(before);
    expect(project).toEqual(before);
  });

  it('creates a member between existing nodes with an exact inverse and explicit result', () => {
    const project = createDefaultProject();
    const before = structuredClone(project);
    const member = { ...structuredClone(project.members[0]), id: 'M-between', i: project.nodes[0].id, j: project.nodes[2].id };

    const compiled = compileProjectCommand(project, {
      kind: 'member.create', description: 'Crear entre nodos existentes', nodes: [], member,
    });
    const applied = applyProjectPatch(project, compiled.forward);

    expect(compiled.result).toEqual({ kind: 'member.create', memberId: 'M-between', nodeId: member.j, created: true });
    expect(applied.members.at(-1)).toEqual(member);
    expect(applyProjectPatch(applied, compiled.inverse)).toEqual(before);
  });

  it('creates a new endpoint and reverses the complete topology exactly', () => {
    const project = createDefaultProject();
    const before = structuredClone(project);
    const startNodeId = project.nodes[0].id;

    const compiled = compileProjectCommand(project, {
      kind: 'member.createAtPoint',
      description: 'Crear miembro con endpoint nuevo',
      startNodeId,
      point: { x: 12, y: 4 },
      template: { type: 'frame', materialOrigin: 'custom', sectionOrigin: 'custom', E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 },
    });
    const applied = applyProjectPatch(project, compiled.forward);

    const result = compiled.result;
    expect(result?.kind).toBe('member.createAtPoint');
    if (result?.kind !== 'member.createAtPoint') throw new Error('Se esperaba el resultado de creación topológica.');
    expect(applied.members.find((member) => member.id === result.memberId)).toMatchObject({ i: startNodeId, j: result.nodeId });
    expect(applied.nodes.find((node) => node.id === result.nodeId)).toMatchObject({ x: 12, y: 4 });
    expect(applyProjectPatch(applied, compiled.inverse)).toEqual(before);
  });

  it('creates an endpoint on one existing member as one exact reversible command', () => {
    const project = createDefaultProject();
    const target = project.members[0];
    const ni = project.nodes.find((node) => node.id === target.i)!;
    const nj = project.nodes.find((node) => node.id === target.j)!;
    const startNodeId = project.nodes.find((node) => node.id !== target.i && node.id !== target.j)!.id;
    project.memberLoads.push({ id: 'ML-on-member', memberId: target.id, caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -10, position: 0.75 });
    project.memberInitialEffects = [{ id: 'IE-on-member', memberId: target.id, caseId: 'LC1', type: 'initial-strain', axialStrain: 0.001, curvature: 0.002 }];
    const before = structuredClone(project);

    const compiled = compileProjectCommand(project, {
      kind: 'member.createAtPoint',
      description: 'Crear endpoint sobre miembro',
      startNodeId,
      point: { x: (ni.x + nj.x) / 2, y: (ni.y + nj.y) / 2 },
      template: { type: 'frame', materialOrigin: 'custom', sectionOrigin: 'custom', E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 },
    });
    const applied = applyProjectPatch(project, compiled.forward);

    const result = compiled.result;
    expect(result?.kind).toBe('member.createAtPoint');
    if (result?.kind !== 'member.createAtPoint') throw new Error('Se esperaba el resultado de creación topológica.');
    expect(applied.members.filter((member) => member.i === result.nodeId || member.j === result.nodeId)).toHaveLength(3);
    expect(applied.memberLoads.every((load) => applied.members.some((member) => member.id === load.memberId))).toBe(true);
    expect(applied.memberInitialEffects).toHaveLength(2);
    expect(applyProjectPatch(applied, compiled.inverse)).toEqual(before);
  });

  it('reuses an existing connection without emitting a second mutation', () => {
    const project = createDefaultProject();
    const existing = project.members[0];
    const endpoint = project.nodes.find((node) => node.id === existing.j)!;

    const compiled = compileProjectCommand(project, {
      kind: 'member.createAtPoint',
      description: 'Reutilizar conexión',
      startNodeId: existing.i,
      point: { x: endpoint.x, y: endpoint.y },
      template: { type: 'frame', materialOrigin: 'custom', sectionOrigin: 'custom', E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 },
    });

    expect(compiled.result).toEqual({ kind: 'member.createAtPoint', memberId: existing.id, nodeId: endpoint.id, created: false });
    expect(compiled.forward.operations).toEqual([]);
    expect(applyProjectPatch(project, compiled.forward)).toEqual(project);
  });

  it('creates through a crossing as one reversible command and preserves every dependent reference', () => {
    const project = createDefaultProject();
    const template = { type: 'frame' as const, materialOrigin: 'custom' as const, sectionOrigin: 'custom' as const, E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 };
    project.nodes = [
      { id: 'S', x: -3, y: -3, support: { type: 'none' } },
      { id: 'L', x: -2, y: 0, support: { type: 'none' } },
      { id: 'R', x: 2, y: 0, support: { type: 'none' } },
      { id: 'T', x: 0, y: 2, support: { type: 'none' } },
      { id: 'B', x: 0, y: -2, support: { type: 'none' } },
    ];
    project.members = [
      { id: 'H', i: 'L', j: 'R', ...template },
      { id: 'V', i: 'T', j: 'B', ...template },
    ];
    project.memberLoads = [{ id: 'ML', memberId: 'H', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -10, position: 0.75 }];
    project.memberInitialEffects = [{ id: 'IE', memberId: 'H', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 20, gradient: 0 }];
    const before = structuredClone(project);

    const compiled = compileProjectCommand(project, {
      kind: 'member.createAtPoint', description: 'Conectar cruce', startNodeId: 'S', point: { x: 0, y: 0 }, template,
    });
    const applied = applyProjectPatch(project, compiled.forward);

    const result = compiled.result;
    expect(result?.kind).toBe('member.createAtPoint');
    if (result?.kind !== 'member.createAtPoint') throw new Error('Se esperaba el resultado de creación topológica.');
    expect(applied.members.filter((member) => member.i === result.nodeId || member.j === result.nodeId)).toHaveLength(5);
    expect(applied.memberLoads.every((load) => applied.members.some((member) => member.id === load.memberId))).toBe(true);
    expect((applied.memberInitialEffects ?? []).every((effect) => applied.members.some((member) => member.id === effect.memberId))).toBe(true);
    expect(applyProjectPatch(applied, compiled.inverse)).toEqual(before);
    expect(project).toEqual(before);
  });

  it('splits a member with one exact forward/inverse pair and returns the created node', () => {
    const project = createDefaultProject();
    const member = project.members[0];
    project.memberInitialEffects = [{ id: 'IE-split', memberId: member.id, caseId: 'LC1', type: 'initial-strain', axialStrain: 0.001, curvature: 0.002 }];
    const before = structuredClone(project);

    const compiled = compileProjectCommand(project, {
      kind: 'member.split', description: `Dividir ${member.id}`, memberId: member.id, ratio: 0.4, nodeSupport: { type: 'pin' },
    });
    const applied = applyProjectPatch(project, compiled.forward);

    const result = compiled.result;
    expect(result?.kind).toBe('member.split');
    if (result?.kind !== 'member.split') throw new Error('Se esperaba el resultado de split.');
    expect(applied.nodes.find((node) => node.id === result.nodeId)?.support).toEqual({ type: 'pin' });
    expect(applied.members).toHaveLength(project.members.length + 1);
    expect(applied.memberInitialEffects).toHaveLength(2);
    expect(applyProjectPatch(applied, compiled.inverse)).toEqual(before);
  });

  it('rejects rigid or stale splits atomically', () => {
    const rigidProject = createDefaultProject();
    rigidProject.members[0].type = 'rigid';
    const rigidBefore = structuredClone(rigidProject);
    expect(() => compileProjectCommand(rigidProject, {
      kind: 'member.split', description: 'Split rígido inválido', memberId: rigidProject.members[0].id, ratio: 0.5,
    })).toThrow(/rígidos/i);
    expect(rigidProject).toEqual(rigidBefore);

    const offsetProject = createDefaultProject();
    offsetProject.members[0].rigidOffsetI = 0.9 * Math.hypot(
      offsetProject.nodes.find((node) => node.id === offsetProject.members[0].j)!.x - offsetProject.nodes.find((node) => node.id === offsetProject.members[0].i)!.x,
      offsetProject.nodes.find((node) => node.id === offsetProject.members[0].j)!.y - offsetProject.nodes.find((node) => node.id === offsetProject.members[0].i)!.y,
    );
    const offsetBefore = structuredClone(offsetProject);
    expect(() => compileProjectCommand(offsetProject, {
      kind: 'member.split', description: 'Split dentro de offset rígido', memberId: offsetProject.members[0].id, ratio: 0.5,
    })).toThrow(/zona rígida/i);
    expect(offsetProject).toEqual(offsetBefore);

    const project = createDefaultProject();
    const member = project.members[0];
    const compiled = compileProjectCommand(project, {
      kind: 'member.split', description: 'Split válido', memberId: member.id, ratio: 0.5,
    });
    const stale = structuredClone(project);
    stale.members[0].A *= 2;
    const staleBefore = structuredClone(stale);
    expect(() => applyProjectPatch(stale, compiled.forward)).toThrow(/precondici/i);
    expect(stale).toEqual(staleBefore);
  });

  it('fails atomically when an update precondition no longer matches', () => {
    const project = createDefaultProject();
    const member = project.members[0];
    const compiled = compileProjectCommand(project, {
      kind: 'member.update',
      description: `Editar ${member.id}`,
      memberId: member.id,
      changes: { A: member.A * 2 },
    });
    const stale = structuredClone(project);
    stale.members[0].A *= 3;
    const staleBefore = structuredClone(stale);

    expect(() => applyProjectPatch(stale, compiled.forward)).toThrow(/precondici/i);
    expect(stale).toEqual(staleBefore);
  });

  it('removes dependent member data and restores its canonical order', () => {
    const project = createDefaultProject();
    const member = project.members[0];
    project.memberLoads.push({
      id: 'ML-delete', memberId: member.id, caseId: project.loadCases[0].id,
      type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
      px: 0, py: -1, position: 0.5,
    });
    project.memberInitialEffects ??= [];
    project.memberInitialEffects.push({
      id: 'IE-delete', memberId: member.id, caseId: project.loadCases[0].id,
      type: 'temperature', alpha: 1.2e-5, deltaT: 20, gradient: 0,
    });
    const before = structuredClone(project);

    const compiled = compileProjectCommand(project, {
      kind: 'member.delete', description: `Eliminar ${member.id}`, memberId: member.id,
    });
    const removed = applyProjectPatch(project, compiled.forward);
    expect(removed.nodes).toEqual(before.nodes);
    expect(removed.members.some((item) => item.id === member.id)).toBe(false);
    expect(removed.memberLoads.some((item) => item.memberId === member.id)).toBe(false);
    expect((removed.memberInitialEffects ?? []).some((item) => item.memberId === member.id)).toBe(false);
    expect(applyProjectPatch(removed, invertProjectPatch(compiled.forward))).toEqual(before);
  });

  it('deletes a node cascade as one exact reversible command', () => {
    const project = createDefaultProject();
    project.memberInitialEffects = [{ id: 'IE-delete-node', memberId: 'M2', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 20, gradient: 0 }];
    project.prescribedDisplacements = [{ id: 'PD-delete-node', nodeId: 'N3', caseId: 'LC1', component: 'ux', value: 0 }];
    const before = structuredClone(project);

    const compiled = compileProjectCommand(project, {
      kind: 'node.delete', description: 'Eliminar nodo N3', nodeId: 'N3',
    });
    const removed = applyProjectPatch(project, compiled.forward);

    expect(removed.nodes.map((node) => node.id)).toEqual(['N1', 'N2', 'N4']);
    expect(removed.members.map((member) => member.id)).toEqual(['M3']);
    expect(removed.nodalLoads.map((load) => load.id)).toEqual(['NL2']);
    expect(removed.memberLoads).toEqual([]);
    expect(removed.memberInitialEffects).toEqual([]);
    expect(removed.prescribedDisplacements).toEqual([]);
    expect(removed.memberLoads.every((load) => removed.members.some((member) => member.id === load.memberId))).toBe(true);
    expect((removed.memberInitialEffects ?? []).every((effect) => removed.members.some((member) => member.id === effect.memberId))).toBe(true);
    const restored = applyProjectPatch(removed, compiled.inverse);
    expect(restored.members.map((member) => member.id)).toEqual(before.members.map((member) => member.id));
    expect(restored).toEqual(before);
    expect(applyProjectPatch(restored, compiled.forward)).toEqual(removed);
    expect(applyProjectPatch(removed, invertProjectPatch(compiled.forward))).toEqual(before);
  });

  it('deletes a multi-selection cascade atomically and restores it in canonical order', () => {
    const project = createDefaultProject();
    project.nodes.push({ id: 'N5', x: 10, y: 0, support: { type: 'none' } });
    project.members.push({ id: 'M4', i: 'N2', j: 'N5', type: 'frame', materialOrigin: 'custom', sectionOrigin: 'custom', E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 });
    project.memberLoads.push({ id: 'ML-M4', memberId: 'M4', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 3, py: 0, position: 0.5 });
    project.memberInitialEffects = [{ id: 'IE-M4', memberId: 'M4', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 30, gradient: 0 }];
    const before = structuredClone(project);

    const compiled = compileProjectCommand(project, {
      kind: 'selection.delete', description: 'Eliminar selección estructural', selection: { kind: 'multi', nodeIds: ['N3'], memberIds: ['M3'] },
    });
    const removed = applyProjectPatch(project, compiled.forward);

    expect(removed.members.map((member) => member.id)).toEqual(['M4']);
    expect(removed.memberLoads.map((load) => load.id)).toEqual(['ML-M4']);
    expect(removed.memberInitialEffects).toEqual([{ id: 'IE-M4', memberId: 'M4', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 30, gradient: 0 }]);
    expect(applyProjectPatch(removed, compiled.inverse)).toEqual(before);

    const stale = structuredClone(project);
    stale.memberLoads[0].qyEnd = -22;
    const staleBefore = structuredClone(stale);
    expect(() => applyProjectPatch(stale, compiled.forward)).toThrow(/precondici/i);
    expect(stale).toEqual(staleBefore);
  });

  it('prepares duplication with fresh ids and an exact inverse', () => {
    const project = createDefaultProject();
    const selection = { kind: 'member' as const, id: project.members[0].id };
    const compiled = compileProjectCommand(project, {
      kind: 'selection.duplicate', description: 'Duplicar selección', selection, offset: { x: 2, y: -1 },
    });
    const duplicated = applyProjectPatch(project, compiled.forward);
    expect(duplicated.members).toHaveLength(project.members.length + 1);
    expect(new Set(duplicated.members.map((member) => member.id)).size).toBe(duplicated.members.length);
    expect(applyProjectPatch(duplicated, compiled.inverse)).toEqual(project);
  });
});
