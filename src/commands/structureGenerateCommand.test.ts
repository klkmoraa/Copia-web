import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { findGeneratorFixture } from '../data/generators/generatorFixtures';
import { placeGeneratedStructure } from '../data/generators/generatorPlacement';
import { generateStructure } from '../data/generators/structureGenerators';
import type { GeneratorParams } from '../data/generators/generatorTypes';
import { validateStructuralEditBoundary } from '../data/structuralEditing';
import type { ProjectModel } from '../types';
import { applyProjectPatch, compileProjectCommand, projectCommandSnapshot, type ProjectCommand } from './projectCommand';

const generatedSnapshotFor = (project: ProjectModel, params: GeneratorParams): string => {
  const placed = placeGeneratedStructure(project, generateStructure(params));
  return projectCommandSnapshot({ nodes: placed.nodes, members: placed.members });
};

const commandFor = (
  project: ProjectModel,
  fixtureId = 'multi-story-frame-two-levels',
): Extract<ProjectCommand, { kind: 'structure.generate' }> => {
  const { params } = findGeneratorFixture(fixtureId);
  return {
    kind: 'structure.generate',
    description: 'Generar estructura',
    params,
    sourceSnapshot: projectCommandSnapshot(project),
    generatedSnapshot: generatedSnapshotFor(project, params),
  };
};

describe('ProjectCommand structure.generate', () => {
  it('adds the whole geometry in a single reversible patch', () => {
    const project = createDefaultProject();
    const command = commandFor(project);
    const structure = generateStructure(command.params);

    const compiled = compileProjectCommand(project, command);
    const next = applyProjectPatch(project, compiled.forward);

    expect(next.nodes).toHaveLength(project.nodes.length + structure.nodes.length);
    expect(next.members).toHaveLength(project.members.length + structure.members.length);
    // One batch: every operation of the patch creates, none rewrites what existed.
    expect(compiled.forward.operations.every((operation) => operation.before === null)).toBe(true);
    expect(compiled.forward.operations).toHaveLength(structure.nodes.length + structure.members.length);
    expect(() => validateStructuralEditBoundary(next)).not.toThrow();
  });

  it('restores the exact source project through its inverse patch', () => {
    const project = createDefaultProject();
    const command = commandFor(project);
    const compiled = compileProjectCommand(project, command);

    const next = applyProjectPatch(project, compiled.forward);
    const restored = applyProjectPatch(next, compiled.inverse);

    expect(projectCommandSnapshot(restored)).toBe(projectCommandSnapshot(project));
  });

  it('leaves every pre-existing entity untouched', () => {
    const project = createDefaultProject();
    const compiled = compileProjectCommand(project, commandFor(project));
    const next = applyProjectPatch(project, compiled.forward);

    expect(next.nodes.slice(0, project.nodes.length)).toEqual(project.nodes);
    expect(next.members.slice(0, project.members.length)).toEqual(project.members);
    expect(next.nodalLoads).toEqual(project.nodalLoads);
    expect(next.memberLoads).toEqual(project.memberLoads);
  });

  it('reports the created IDs so the caller can select what it generated', () => {
    const project = createDefaultProject();
    const compiled = compileProjectCommand(project, commandFor(project));
    const next = applyProjectPatch(project, compiled.forward);

    expect(compiled.result).toMatchObject({ kind: 'structure.generate' });
    const result = compiled.result as { nodeIds: string[]; memberIds: string[] };
    const nextNodeIds = new Set(next.nodes.map((node) => node.id));
    expect(result.nodeIds.every((id) => nextNodeIds.has(id))).toBe(true);
    expect(result.nodeIds.some((id) => project.nodes.some((node) => node.id === id))).toBe(false);
    expect(result.memberIds).toHaveLength(generateStructure(commandFor(project).params).members.length);
  });

  it('rejects a command prepared against a different project state', () => {
    const project = createDefaultProject();
    const command = commandFor(project);
    const moved = structuredClone(project);
    moved.nodes[0].x += 1;

    expect(() => compileProjectCommand(moved, command)).toThrow(/obsolet/i);
  });

  it('rejects a geometry that no longer matches the reviewed preview', () => {
    const project = createDefaultProject();
    const command = commandFor(project);
    const tampered: typeof command = {
      ...command,
      params: findGeneratorFixture('continuous-beam-non-uniform').params,
    };

    expect(() => compileProjectCommand(project, tampered)).toThrow(/vista previa/i);
  });

  it('regenerates the geometry instead of trusting geometry carried by the command', () => {
    const project = createDefaultProject();
    const command = commandFor(project);

    // The command holds parameters only: there is no node or member payload a
    // caller could smuggle arbitrary geometry through.
    expect(Object.keys(command)).toEqual(
      expect.arrayContaining(['kind', 'description', 'params', 'sourceSnapshot', 'generatedSnapshot']),
    );
    expect(command).not.toHaveProperty('nodes');
    expect(command).not.toHaveProperty('members');
  });

  it('fails without mutating anything when the parameters are invalid', () => {
    const project = createDefaultProject();
    const before = projectCommandSnapshot(project);
    const command: ProjectCommand = {
      kind: 'structure.generate',
      description: 'Generar estructura',
      params: {
        kind: 'continuous-beam',
        spans: { kind: 'list', values: [0] },
        properties: { kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5 },
      },
      sourceSnapshot: before,
      generatedSnapshot: 'irrelevante',
    };

    expect(() => compileProjectCommand(project, command)).toThrow(/separación/i);
    expect(projectCommandSnapshot(project)).toBe(before);
  });

  it('assigns IDs that do not collide with an existing project even after previous edits', () => {
    const project = createDefaultProject();
    const first = compileProjectCommand(project, commandFor(project, 'continuous-beam-non-uniform'));
    const afterFirst = applyProjectPatch(project, first.forward);

    const second = compileProjectCommand(afterFirst, commandFor(afterFirst, 'continuous-beam-non-uniform'));
    const afterSecond = applyProjectPatch(afterFirst, second.forward);

    expect(new Set(afterSecond.nodes.map((node) => node.id)).size).toBe(afterSecond.nodes.length);
    expect(new Set(afterSecond.members.map((member) => member.id)).size).toBe(afterSecond.members.length);
    expect(() => validateStructuralEditBoundary(afterSecond)).not.toThrow();
  });
});
