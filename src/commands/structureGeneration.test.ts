import { describe, expect, it } from 'vitest';
import { compileProjectCommand, applyProjectPatch, projectCommandSnapshot } from './projectCommand';
import { createBlankProject, createDefaultProject } from '../data/defaultProject';
import { findGeneratorFixture } from '../data/generators/generatorFixtures';
import type { GeneratorParams } from '../data/generators/generatorTypes';
import { validateStructuralEditBoundary } from '../data/structuralEditing';
import type { ProjectModel } from '../types';
import {
  applyPreparedStructureGeneration,
  prepareStructureGeneration,
  type PreparedStructureGeneration,
} from './structureGeneration';

const paramsOf = (fixtureId: string): GeneratorParams => findGeneratorFixture(fixtureId).params;

const prepared = (
  project: ProjectModel = createDefaultProject(),
  fixtureId = 'multi-story-frame-two-levels',
) => ({ project, prepared: prepareStructureGeneration(project, paramsOf(fixtureId)) });

/** Clona un preparado para poder alterarlo: el original está congelado. */
const tamper = (
  source: PreparedStructureGeneration,
  change: (draft: PreparedStructureGeneration) => void,
): PreparedStructureGeneration => {
  const draft = structuredClone(source) as PreparedStructureGeneration;
  change(draft);
  return draft;
};

describe('prepareStructureGeneration', () => {
  it('does not mutate the project, so cancelling is simply not confirming', () => {
    const project = createDefaultProject();
    const before = projectCommandSnapshot(project);

    prepareStructureGeneration(project, paramsOf('truss-pratt-four-panels'));
    prepareStructureGeneration(project, paramsOf('grid-two-by-two'));

    expect(projectCommandSnapshot(project)).toBe(before);
  });

  it('leaves no trace when the preview is discarded: identity is only spent on confirm', () => {
    const project = createDefaultProject();
    const first = prepareStructureGeneration(project, paramsOf('continuous-beam-non-uniform'));
    // Discarded. A second preview must be able to claim the very same IDs.
    const second = prepareStructureGeneration(project, paramsOf('continuous-beam-non-uniform'));

    expect(second.createdNodeIds).toEqual(first.createdNodeIds);
    expect(second.createdMemberIds).toEqual(first.createdMemberIds);
    expect(second.previewSnapshot).toBe(first.previewSnapshot);
  });

  it('describes exactly what would be created', () => {
    const { prepared: preview } = prepared();
    expect(preview.summary.nodeCount).toBe(preview.createdNodeIds.length);
    expect(preview.summary.memberCount).toBe(preview.createdMemberIds.length);
    expect(preview.description).toBe('Generar marco de varios niveles');
  });

  it('draws a ghost with the same geometry it would commit, without IDs', () => {
    const { prepared: preview } = prepared();
    const previewNodes = preview.previewProject.nodes
      .filter((node) => preview.createdNodeIds.includes(node.id));

    expect(preview.ghost.nodes.map((node) => [node.x, node.y]))
      .toEqual(previewNodes.map((node) => [node.x, node.y]));
    expect(preview.ghost.members).toHaveLength(preview.createdMemberIds.length);
    expect(JSON.stringify(preview.ghost)).not.toMatch(/"id"/);
  });

  it('adds the coincidence warning that only exists inside a real project', () => {
    const project = createBlankProject();
    project.nodes.push({ id: 'N9', x: 0, y: 0, support: { type: 'none' } });

    const preview = prepareStructureGeneration(project, paramsOf('continuous-beam-non-uniform'));

    expect(preview.warnings.map((warning) => warning.code)).toContain('coincident-with-existing');
    expect(preview.warnings.map((warning) => warning.code)).toContain('no-supports');
  });

  it('is frozen so a reviewed intention cannot be edited after the fact', () => {
    const { prepared: preview } = prepared();
    expect(Object.isFrozen(preview)).toBe(true);
    expect(() => { (preview as { description: string }).description = 'otra'; }).toThrow();
  });

  it('rejects invalid parameters before producing any preview', () => {
    expect(() => prepareStructureGeneration(createDefaultProject(), {
      kind: 'truss',
      topology: 'pratt',
      panels: { kind: 'uniform', count: 4, spacing: 2 },
      depth: 0,
      properties: { kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5 },
    })).toThrow(/peralte/i);
  });
});

describe('applyPreparedStructureGeneration', () => {
  it('publishes exactly the reviewed preview', () => {
    const { project, prepared: preview } = prepared();
    const applied = applyPreparedStructureGeneration(project, preview);
    expect(projectCommandSnapshot(applied)).toBe(preview.previewSnapshot);
  });

  it('produces a valid, fully referenced project', () => {
    const { project, prepared: preview } = prepared();
    const applied = applyPreparedStructureGeneration(project, preview);

    expect(() => validateStructuralEditBoundary(applied)).not.toThrow();
    const nodeIds = new Set(applied.nodes.map((node) => node.id));
    for (const memberId of preview.createdMemberIds) {
      const member = applied.members.find((item) => item.id === memberId)!;
      expect(nodeIds.has(member.i)).toBe(true);
      expect(nodeIds.has(member.j)).toBe(true);
      expect(preview.createdNodeIds).toContain(member.i);
      expect(preview.createdNodeIds).toContain(member.j);
    }
    expect(new Set(applied.nodes.map((node) => node.id)).size).toBe(applied.nodes.length);
    expect(new Set(applied.members.map((member) => member.id)).size).toBe(applied.members.length);
  });

  it('rejects a stale preview without mutating the project', () => {
    const { project, prepared: preview } = prepared();
    const moved = structuredClone(project);
    moved.nodes[0].x += 0.5;
    const before = projectCommandSnapshot(moved);

    expect(() => applyPreparedStructureGeneration(moved, preview)).toThrow(/obsolet/i);
    expect(projectCommandSnapshot(moved)).toBe(before);
  });

  it('rejects a preview whose project was altered after review', () => {
    const { project, prepared: preview } = prepared();
    const altered = tamper(preview, (draft) => {
      draft.previewProject.nodes.push({ id: 'INJECTED', x: 99, y: 99, support: { type: 'fixed' } });
    });

    expect(() => applyPreparedStructureGeneration(project, altered)).toThrow(/alterada/i);
  });

  it('rejects a preview whose parameters were swapped after review', () => {
    const { project, prepared: preview } = prepared();
    const altered = tamper(preview, (draft) => {
      (draft.command as { params: GeneratorParams }).params = paramsOf('grid-two-by-two');
    });

    expect(() => applyPreparedStructureGeneration(project, altered)).toThrow(/vista previa/i);
  });

  it('rejects patches that do not match the authoritative operation', () => {
    const { project, prepared: preview } = prepared();
    const altered = tamper(preview, (draft) => {
      draft.forward.operations = draft.forward.operations.slice(0, 2);
    });

    expect(() => applyPreparedStructureGeneration(project, altered)).toThrow(/autoritativa/i);
  });

  it('applies twice in a row without colliding IDs', () => {
    const project = createDefaultProject();
    const first = prepareStructureGeneration(project, paramsOf('continuous-beam-non-uniform'));
    const afterFirst = applyPreparedStructureGeneration(project, first);
    const second = prepareStructureGeneration(afterFirst, paramsOf('continuous-beam-non-uniform'));
    const afterSecond = applyPreparedStructureGeneration(afterFirst, second);

    expect(new Set(afterSecond.nodes.map((node) => node.id)).size).toBe(afterSecond.nodes.length);
    expect(first.createdNodeIds).not.toEqual(second.createdNodeIds);
    expect(() => validateStructuralEditBoundary(afterSecond)).not.toThrow();
  });
});

describe('generated output is an ordinary editable project', () => {
  it('keeps no parametric association to the generator', () => {
    const { project, prepared: preview } = prepared();
    const applied = applyPreparedStructureGeneration(project, preview);
    const serialized = JSON.stringify(applied);

    expect(serialized).not.toMatch(/generator/i);
    expect(serialized).not.toMatch(/multi-story-frame/);
    const created = applied.nodes.find((node) => node.id === preview.createdNodeIds[0])!;
    expect(Object.keys(created).sort()).toEqual(['id', 'support', 'x', 'y']);
  });

  it('lets a generated member be edited and deleted by ordinary commands', () => {
    const { project, prepared: preview } = prepared();
    const applied = applyPreparedStructureGeneration(project, preview);
    const memberId = preview.createdMemberIds[0];

    const edited = applyProjectPatch(applied, compileProjectCommand(applied, {
      kind: 'member.update', description: 'Editar miembro generado', memberId, changes: { A: 0.02 },
    }).forward);
    expect(edited.members.find((member) => member.id === memberId)!.A).toBe(0.02);

    const deleted = applyProjectPatch(edited, compileProjectCommand(edited, {
      kind: 'member.delete', description: 'Borrar miembro generado', memberId,
    }).forward);
    expect(deleted.members.some((member) => member.id === memberId)).toBe(false);
    expect(() => validateStructuralEditBoundary(deleted)).not.toThrow();
  });

  it('creates no loads of any kind', () => {
    const { project, prepared: preview } = prepared();
    const applied = applyPreparedStructureGeneration(project, preview);

    expect(applied.nodalLoads).toEqual(project.nodalLoads);
    expect(applied.memberLoads).toEqual(project.memberLoads);
    expect(applied.memberInitialEffects).toEqual(project.memberInitialEffects);
    expect(applied.prescribedDisplacements).toEqual(project.prescribedDisplacements);
  });

  it('creates no supports unless the user chose one', () => {
    const project = createBlankProject();
    const withoutSupport = applyPreparedStructureGeneration(
      project,
      prepareStructureGeneration(project, paramsOf('continuous-beam-non-uniform')),
    );
    expect(withoutSupport.nodes.every((node) => node.support.type === 'none')).toBe(true);

    const withSupport = applyPreparedStructureGeneration(
      project,
      prepareStructureGeneration(project, paramsOf('continuous-beam-uniform-pinned')),
    );
    expect(withSupport.nodes.every((node) => node.support.type === 'pin')).toBe(true);
  });
});
