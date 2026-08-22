import { describe, expect, it } from 'vitest';
import { createBlankProject, createDefaultProject } from '../defaultProject';
import { validateStructuralEditBoundary } from '../structuralEditing';
import { findGeneratorFixture } from './generatorFixtures';
import { placeGeneratedStructure } from './generatorPlacement';
import { generateStructure } from './structureGenerators';
import type { GeneratorParams } from './generatorTypes';

const place = (project = createDefaultProject(), fixtureId = 'grid-two-by-two') => {
  const structure = generateStructure(findGeneratorFixture(fixtureId).params);
  return { project, structure, placed: placeGeneratedStructure(project, structure) };
};

describe('placeGeneratedStructure', () => {
  it('assigns IDs that no existing entity already uses', () => {
    const { project, placed } = place();
    const existingNodeIds = new Set(project.nodes.map((node) => node.id));
    const existingMemberIds = new Set(project.members.map((member) => member.id));

    for (const node of placed.nodes) expect(existingNodeIds.has(node.id)).toBe(false);
    for (const member of placed.members) expect(existingMemberIds.has(member.id)).toBe(false);
    expect(new Set(placed.nodes.map((node) => node.id)).size).toBe(placed.nodes.length);
    expect(new Set(placed.members.map((member) => member.id)).size).toBe(placed.members.length);
  });

  it('keeps every member endpoint pointing at a node of the same batch', () => {
    const { placed } = place();
    const placedNodeIds = new Set(placed.nodes.map((node) => node.id));
    for (const member of placed.members) {
      expect(placedNodeIds.has(member.i)).toBe(true);
      expect(placedNodeIds.has(member.j)).toBe(true);
    }
  });

  it('produces a project that passes the structural edit boundary once appended', () => {
    const { project, placed } = place();
    const merged = structuredClone(project);
    merged.nodes.push(...structuredClone(placed.nodes) as typeof merged.nodes);
    merged.members.push(...structuredClone(placed.members) as typeof merged.members);
    expect(() => validateStructuralEditBoundary(merged)).not.toThrow();
  });

  it('never mutates the target project nor the generated structure', () => {
    const project = createDefaultProject();
    const structure = generateStructure(findGeneratorFixture('truss-pratt-four-panels').params);
    const projectBefore = JSON.stringify(project);
    const structureBefore = JSON.stringify(structure);

    placeGeneratedStructure(project, structure);

    expect(JSON.stringify(project)).toBe(projectBefore);
    expect(JSON.stringify(structure)).toBe(structureBefore);
  });

  it('is deterministic: the same project and parameters place the same IDs and coordinates', () => {
    const params = findGeneratorFixture('multi-story-frame-two-levels').params;
    const first = placeGeneratedStructure(createDefaultProject(), generateStructure(params));
    const second = placeGeneratedStructure(createDefaultProject(), generateStructure(params));
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('preserves coordinates, supports and member properties from the generated geometry', () => {
    const params = findGeneratorFixture('continuous-beam-uniform-pinned').params;
    const structure = generateStructure(params);
    const placed = placeGeneratedStructure(createDefaultProject(), structure);

    placed.nodes.forEach((node, index) => {
      const source = structure.nodes[index];
      expect([node.x, node.y]).toEqual([source.x, source.y]);
      expect(node.support).toEqual(source.support);
    });
    placed.members.forEach((member, index) => {
      const source = structure.members[index];
      expect(member.E).toBe(source.E);
      expect(member.A).toBe(source.A);
      expect(member.I).toBe(source.I);
      expect(member.type).toBe(source.type);
      expect(member.materialOrigin).toBe(source.materialOrigin);
    });
  });

  it('maps every local generator ID exactly once', () => {
    const { structure, placed } = place();
    expect(Object.keys(placed.nodeIdByLocalId).sort()).toEqual(structure.nodes.map((node) => node.id).sort());
    expect(Object.keys(placed.memberIdByLocalId).sort()).toEqual(structure.members.map((member) => member.id).sort());
    expect(placed.nodes.map((node) => node.id))
      .toEqual(structure.nodes.map((node) => placed.nodeIdByLocalId[node.id]));
  });

  it('does not reuse an ID the project already holds even when it looks free by count', () => {
    const project = createBlankProject();
    project.nodes.push({ id: 'N1', x: 40, y: 40, support: { type: 'none' } });
    const structure = generateStructure(findGeneratorFixture('continuous-beam-non-uniform').params);

    const placed = placeGeneratedStructure(project, structure);

    expect(placed.nodes.map((node) => node.id)).toEqual(['N2', 'N3', 'N4', 'N5']);
  });

  it('warns when a generated node lands on an existing node instead of merging it silently', () => {
    const project = createBlankProject();
    project.nodes.push({ id: 'N1', x: 0, y: 0, support: { type: 'none' } });
    const structure = generateStructure(findGeneratorFixture('continuous-beam-non-uniform').params);

    const placed = placeGeneratedStructure(project, structure);

    expect(placed.warnings.map((warning) => warning.code)).toContain('coincident-with-existing');
    // Coincidence is reported, never resolved: no generated node is dropped.
    expect(placed.nodes).toHaveLength(structure.nodes.length);
  });

  it('reports no coincidence warning when the geometry lands on free space', () => {
    const params: GeneratorParams = {
      ...findGeneratorFixture('continuous-beam-non-uniform').params,
      origin: { x: 500, y: 500 },
    } as GeneratorParams;
    const placed = placeGeneratedStructure(createDefaultProject(), generateStructure(params));
    expect(placed.warnings).toEqual([]);
  });
});
