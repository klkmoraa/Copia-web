import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../defaultProject';
import { structuralEditSnapshot, validateStructuralEditBoundary } from '../structuralEditing';
import { generatorFixtures } from './generatorFixtures';
import { roundGeneratedCoordinate } from './generatorSpacing';
import { generateStructure } from './structureGenerators';
import type { GeneratorParams } from './generatorTypes';

/**
 * Invariantes que ninguna familia puede romper: identidad densa y ordenada,
 * clausura de referencias, independencia del punto de inserción y ausencia de
 * estado compartido entre generaciones.
 */

const each = generatorFixtures.map((fixture) => [fixture.id, fixture.params] as const);

const shift = (params: GeneratorParams, delta: number): GeneratorParams => ({
  ...params,
  origin: { x: (params.origin?.x ?? 0) + delta, y: (params.origin?.y ?? 0) + delta },
});

describe('núcleo de generación · determinismo', () => {
  it.each(each)('%s produce el mismo snapshot en ejecuciones sucesivas', (_id, params) => {
    const runs = [0, 1, 2].map(() => JSON.stringify(generateStructure(structuredClone(params))));
    expect(new Set(runs).size).toBe(1);
  });

  it.each(each)('%s reparte IDs densos y ordenados', (_id, params) => {
    const structure = generateStructure(params);
    expect(structure.nodes.map((node) => node.id)).toEqual(structure.nodes.map((_, index) => `N${index + 1}`));
    expect(structure.members.map((member) => member.id)).toEqual(structure.members.map((_, index) => `M${index + 1}`));
  });

  it.each(each)('%s no comparte estado entre generaciones', (_id, params) => {
    const first = generateStructure(params);
    first.nodes[0].x = 9999;
    first.members[0].E = 1;
    const second = generateStructure(params);
    expect(second.nodes[0].x).not.toBe(9999);
    expect(second.members[0].E).not.toBe(1);
  });

  it.each(each)('%s no comparte las propiedades entre miembros', (_id, params) => {
    const structure = generateStructure(params);
    if (structure.members.length < 2) return;
    structure.members[0].A = 12345;
    expect(structure.members[1].A).not.toBe(12345);
  });

  it.each(each)('%s da a cada nodo apoyado su propia definición de apoyo', (_id, params) => {
    const structure = generateStructure(params);
    if (structure.supportedNodeIds.length < 2) return;
    const [first, second] = structure.supportedNodeIds
      .map((id) => structure.nodes.find((node) => node.id === id)!);
    first.support.type = 'custom';
    expect(second.support.type).not.toBe('custom');
  });
});

describe('núcleo de generación · topología', () => {
  it.each(each)('%s conserva la topología al mover el punto de inserción', (_id, params) => {
    const base = generateStructure(params);
    const moved = generateStructure(shift(params, 7.5));

    expect(moved.members.map((member) => [member.id, member.i, member.j]))
      .toEqual(base.members.map((member) => [member.id, member.i, member.j]));
    // El desplazamiento se deshace con la misma regla de redondeo del núcleo:
    // la resta en punto flotante es del test, no de la geometría generada.
    expect(moved.nodes.map((node) => [
      node.id,
      roundGeneratedCoordinate(node.x - 7.5),
      roundGeneratedCoordinate(node.y - 7.5),
    ])).toEqual(base.nodes.map((node) => [node.id, node.x, node.y]));
    expect(moved.summary.memberCountsByRole).toEqual(base.summary.memberCountsByRole);
  });

  it.each(each)('%s cierra sus referencias sobre nodos generados', (_id, params) => {
    const structure = generateStructure(params);
    const nodeIds = new Set(structure.nodes.map((node) => node.id));
    expect(nodeIds.size).toBe(structure.nodes.length);
    for (const member of structure.members) {
      expect(nodeIds.has(member.i)).toBe(true);
      expect(nodeIds.has(member.j)).toBe(true);
      expect(member.i).not.toBe(member.j);
    }
  });

  it.each(each)('%s no genera miembros de longitud nula', (_id, params) => {
    const structure = generateStructure(params);
    const nodeById = new Map(structure.nodes.map((node) => [node.id, node]));
    for (const member of structure.members) {
      const start = nodeById.get(member.i)!;
      const end = nodeById.get(member.j)!;
      expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(0);
    }
  });

  it.each(each)('%s es aceptado por la frontera de edición estructural vigente', (_id, params) => {
    const structure = generateStructure(params);
    const project = createBlankProject();
    project.nodes = structuredClone(structure.nodes) as typeof project.nodes;
    project.members = structuredClone(structure.members) as typeof project.members;
    expect(() => validateStructuralEditBoundary(project)).not.toThrow();
  });

  it.each(each)('%s no crea cargas ni casos nuevos al proyectarse', (_id, params) => {
    const structure = generateStructure(params);
    const project = createBlankProject();
    const before = structuralEditSnapshot(project);
    project.nodes = structuredClone(structure.nodes) as typeof project.nodes;
    project.members = structuredClone(structure.members) as typeof project.members;

    const after = JSON.parse(structuralEditSnapshot(project)) as Record<string, unknown>;
    expect(after.nodalLoads).toEqual([]);
    expect(after.memberLoads).toEqual([]);
    expect(after.loadCases).toEqual((JSON.parse(before) as Record<string, unknown>).loadCases);
  });
});
