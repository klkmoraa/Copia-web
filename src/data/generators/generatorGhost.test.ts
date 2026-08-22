import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../defaultProject';
import { createStructureGenerationGhost } from './generatorGhost';
import { findGeneratorFixture } from './generatorFixtures';
import { generateStructure } from './structureGenerators';

const ghostOf = (fixtureId: string) => createStructureGenerationGhost(findGeneratorFixture(fixtureId).params);

describe('createStructureGenerationGhost', () => {
  it('draws exactly the geometry the core would generate', () => {
    const fixture = findGeneratorFixture('truss-warren-four-panels');
    const structure = generateStructure(fixture.params);
    const ghost = createStructureGenerationGhost(fixture.params);

    expect(ghost.nodes.map((node) => [node.x, node.y]))
      .toEqual(structure.nodes.map((node) => [node.x, node.y]));
    expect(ghost.members).toHaveLength(structure.members.length);
    expect(ghost.summary).toEqual(structure.summary);
    expect(ghost.warnings).toEqual(structure.warnings);
  });

  it('connects every member to two ghost nodes of the same preview', () => {
    const ghost = ghostOf('multi-story-frame-two-levels');
    const keys = new Set(ghost.nodes.map((node) => node.key));
    for (const member of ghost.members) {
      expect(keys.has(member.iKey)).toBe(true);
      expect(keys.has(member.jKey)).toBe(true);
      expect(member.iKey).not.toBe(member.jKey);
    }
  });

  it('carries no entity IDs, so nothing can persist a ghost as model geometry', () => {
    const ghost = ghostOf('grid-two-by-two');
    const serialized = JSON.stringify(ghost);

    for (const node of ghost.nodes) expect(node).not.toHaveProperty('id');
    for (const member of ghost.members) expect(member).not.toHaveProperty('id');
    expect(serialized).not.toMatch(/"id"/);
    // A key is deliberately not a usable node ID in any project.
    const projectNodeIds = new Set(createDefaultProject().nodes.map((node) => node.id));
    for (const node of ghost.nodes) expect(projectNodeIds.has(node.key)).toBe(false);
  });

  it('reports which ghost nodes would receive the chosen support', () => {
    const supported = ghostOf('continuous-beam-uniform-pinned');
    expect(supported.nodes.every((node) => node.supported)).toBe(true);

    const unsupported = ghostOf('continuous-beam-non-uniform');
    expect(unsupported.nodes.some((node) => node.supported)).toBe(false);
  });

  it('keeps node and member roles so the preview can style what it draws', () => {
    const ghost = ghostOf('truss-pratt-four-panels');
    expect(new Set(ghost.nodes.map((node) => node.role))).toEqual(new Set(['bottom-chord', 'top-chord']));
    expect(new Set(ghost.members.map((member) => member.role)))
      .toEqual(new Set(['bottom-chord', 'top-chord', 'vertical', 'diagonal']));
  });

  it('is deterministic and independent of any project', () => {
    const fixture = findGeneratorFixture('grid-vertical-only');
    expect(JSON.stringify(createStructureGenerationGhost(fixture.params)))
      .toBe(JSON.stringify(createStructureGenerationGhost(fixture.params)));
  });

  it('is frozen, so a preview cannot be edited into a different intention', () => {
    const ghost = ghostOf('continuous-beam-non-uniform');
    expect(Object.isFrozen(ghost)).toBe(true);
    expect(Object.isFrozen(ghost.nodes)).toBe(true);
    expect(() => { (ghost.nodes[0] as unknown as { x: number }).x = 99; }).toThrow();
  });

  it('rejects invalid parameters instead of drawing a geometry that could not be confirmed', () => {
    expect(() => createStructureGenerationGhost({
      kind: 'continuous-beam',
      spans: { kind: 'list', values: [0] },
      properties: { kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5 },
    })).toThrow(/separación/i);
  });
});
