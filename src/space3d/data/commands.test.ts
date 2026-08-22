import { describe, expect, it } from 'vitest';
import { Space3DCommandError, applySpace3DCommand } from './commands';
import { createBlankSpace3DProject, createSpace3DPortalExample } from '../model/defaultProject';
import { fixedSpace3DRestraints, freeSpace3DRestraints, type Space3DFrameMember, type Space3DNode } from '../model/types';

const example = createSpace3DPortalExample();

const newNode = (id: string): Space3DNode => ({ id, x: 1, y: 2, z: 3, restraints: freeSpace3DRestraints() });
const newMember = (id: string, i: string, j: string): Space3DFrameMember => ({
  ...example.members[0], id, i, j,
});

describe('Space3D reversible commands', () => {
  it('añade un nudo sin mutar la entrada', () => {
    const before = structuredClone(example);
    const next = applySpace3DCommand(example, { kind: 'add-node', node: newNode('N9') });
    expect(next).not.toBe(example);
    expect(example).toEqual(before);
    expect(next.nodes.map((node) => node.id)).toEqual(['N1', 'N2', 'N3', 'N4', 'N9']);
  });

  it('rechaza un nudo con id duplicado o vacío', () => {
    expect(() => applySpace3DCommand(example, { kind: 'add-node', node: newNode('N1') })).toThrow(Space3DCommandError);
    expect(() => applySpace3DCommand(example, { kind: 'add-node', node: newNode(' ') })).toThrow(/empty-id/);
  });

  it('actualiza un nudo respetando el id y rechazando cambios inválidos', () => {
    const next = applySpace3DCommand(example, { kind: 'update-node', nodeId: 'N4', changes: { x: 9.5 } });
    expect(next.nodes.find((node) => node.id === 'N4')!.x).toBe(9.5);
    expect(next.nodes.find((node) => node.id === 'N4')!.y).toBe(example.nodes[3].y);
    expect(() => applySpace3DCommand(example, { kind: 'update-node', nodeId: 'N4', changes: { x: Number.NaN } }))
      .toThrow(/invalid-value/);
    expect(() => applySpace3DCommand(example, { kind: 'update-node', nodeId: 'ghost', changes: { x: 1 } }))
      .toThrow(/missing-entity/);
  });

  it('rechaza borrar un nudo con consumidores y lo permite cuando queda libre', () => {
    expect(() => applySpace3DCommand(example, { kind: 'delete-node', nodeId: 'N1' })).toThrow(/node-in-use/);
    const withNode = applySpace3DCommand(example, { kind: 'add-node', node: newNode('N9') });
    const cleaned = applySpace3DCommand(withNode, { kind: 'delete-node', nodeId: 'N9' });
    expect(cleaned.nodes.map((node) => node.id)).toEqual(['N1', 'N2', 'N3', 'N4']);
  });

  it('rechaza borrar un nudo citado por una carga', () => {
    expect(() => applySpace3DCommand(example, { kind: 'delete-node', nodeId: 'N4' })).toThrow(/node-in-use/);
  });

  it('añade un miembro sólo con extremos existentes y distintos', () => {
    const withNode = applySpace3DCommand(example, { kind: 'add-node', node: newNode('N9') });
    const next = applySpace3DCommand(withNode, { kind: 'add-member', member: newMember('M9', 'N1', 'N9') });
    expect(next.members).toHaveLength(4);
    expect(() => applySpace3DCommand(example, { kind: 'add-member', member: newMember('M9', 'N1', 'ghost') }))
      .toThrow(/missing-entity/);
    expect(() => applySpace3DCommand(example, { kind: 'add-member', member: newMember('M9', 'N1', 'N1') }))
      .toThrow(/self-referential/);
    expect(() => applySpace3DCommand(example, { kind: 'add-member', member: newMember('M1', 'N1', 'N2') }))
      .toThrow(/duplicate-id/);
  });

  it('actualiza un miembro rechazando propiedades no positivas', () => {
    const next = applySpace3DCommand(example, { kind: 'update-member', memberId: 'M2', changes: { A: 0.02 } });
    expect(next.members.find((member) => member.id === 'M2')!.A).toBe(0.02);
    expect(() => applySpace3DCommand(example, { kind: 'update-member', memberId: 'M2', changes: { A: 0 } }))
      .toThrow(/invalid-value/);
    expect(() => applySpace3DCommand(example, { kind: 'update-member', memberId: 'M2', changes: { j: 'ghost' } }))
      .toThrow(/missing-entity/);
  });

  it('borra un miembro sin tocar nudos ni cargas', () => {
    const next = applySpace3DCommand(example, { kind: 'delete-member', memberId: 'M2' });
    expect(next.members.map((member) => member.id)).toEqual(['M1', 'M3']);
    expect(next.nodes).toEqual(example.nodes);
    expect(next.nodalLoads).toEqual(example.nodalLoads);
    expect(() => applySpace3DCommand(example, { kind: 'delete-member', memberId: 'ghost' })).toThrow(/missing-entity/);
  });

  it('fija y libera los seis apoyos de un nudo', () => {
    const fixed = applySpace3DCommand(example, { kind: 'set-restraints', nodeId: 'N4', restraints: fixedSpace3DRestraints() });
    expect(fixed.nodes.find((node) => node.id === 'N4')!.restraints).toEqual(fixedSpace3DRestraints());
    const free = applySpace3DCommand(fixed, { kind: 'set-restraints', nodeId: 'N1', restraints: freeSpace3DRestraints() });
    expect(free.nodes.find((node) => node.id === 'N1')!.restraints.ux).toBe(false);
  });

  it('gestiona el ciclo completo de una carga nodal', () => {
    const added = applySpace3DCommand(example, {
      kind: 'add-nodal-load',
      load: { id: 'L2', caseId: 'LC1', nodeId: 'N4', fx: 5, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
    });
    expect(added.nodalLoads).toHaveLength(2);
    const updated = applySpace3DCommand(added, { kind: 'update-nodal-load', loadId: 'L2', changes: { fx: -7 } });
    expect(updated.nodalLoads.find((load) => load.id === 'L2')!.fx).toBe(-7);
    const deleted = applySpace3DCommand(updated, { kind: 'delete-nodal-load', loadId: 'L2' });
    expect(deleted.nodalLoads.map((load) => load.id)).toEqual(['L1']);

    expect(() => applySpace3DCommand(example, {
      kind: 'add-nodal-load',
      load: { id: 'L2', caseId: 'ghost', nodeId: 'N4', fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
    })).toThrow(/missing-entity/);
    expect(() => applySpace3DCommand(example, { kind: 'update-nodal-load', loadId: 'L1', changes: { fy: Number.POSITIVE_INFINITY } }))
      .toThrow(/invalid-value/);
  });

  it('rechaza superar los límites de capacidad', () => {
    let project = createBlankSpace3DProject();
    for (let index = 0; index < 150; index += 1) {
      project = applySpace3DCommand(project, { kind: 'add-node', node: { ...newNode(`N${index}`), x: index } });
    }
    expect(project.nodes).toHaveLength(150);
    expect(() => applySpace3DCommand(project, { kind: 'add-node', node: newNode('N150') })).toThrow(/limit-exceeded/);
  });

  it('deja el proyecto en un estado válido tras cualquier comando aceptado', () => {
    const next = applySpace3DCommand(example, { kind: 'update-node', nodeId: 'N4', changes: { z: 4.75 } });
    expect(next.nodes.find((node) => node.id === 'N4')!.z).toBe(4.75);
    expect(() => applySpace3DCommand(next, {
      kind: 'update-node', nodeId: 'N4', changes: { x: example.nodes[0].x, y: example.nodes[0].y, z: example.nodes[0].z },
    })).toThrow(/invalid-result/);
  });
});
