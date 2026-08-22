import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { applyProjectPatch } from '../../commands/projectCommand';
import { prepareDuplicatePreview } from './duplicatePreview';

describe('duplicate preview', () => {
  it('prepares immutable ghost entities that match the confirmed patch', () => {
    const project = createDefaultProject();
    const before = structuredClone(project);
    const prepared = prepareDuplicatePreview(project, { kind: 'member', id: project.members[0].id }, { x: 2, y: 1 });

    expect(project).toEqual(before);
    expect(prepared.addedNodes).toHaveLength(2);
    expect(prepared.addedMembers).toHaveLength(1);
    const confirmed = applyProjectPatch(project, prepared.compiled.forward);
    expect(confirmed.nodes.filter((node) => prepared.addedNodes.some((added) => added.id === node.id))).toEqual(prepared.addedNodes);
    expect(confirmed.members.filter((member) => prepared.addedMembers.some((added) => added.id === member.id))).toEqual(prepared.addedMembers);
  });

  it('rejects a non-finite displacement before producing a preview', () => {
    const project = createDefaultProject();
    expect(() => prepareDuplicatePreview(project, { kind: 'member', id: project.members[0].id }, { x: Number.NaN, y: 0 })).toThrow(/finito/i);
  });

  it('duplicates catalog identity explicitly without matching material floats', () => {
    const project = createDefaultProject();
    const source = project.members[0];
    source.materialId = 'steel-a36';
    source.materialOrigin = 'catalog';
    source.sectionId = 'w310x39';
    source.sectionOrigin = 'catalog';

    const prepared = prepareDuplicatePreview(project, { kind: 'member', id: source.id }, { x: 2, y: 1 });
    const confirmed = applyProjectPatch(project, prepared.compiled.forward);
    const duplicate = confirmed.members.find((member) => member.id === prepared.addedMembers[0].id);

    expect(duplicate).toMatchObject({
      materialId: 'steel-a36',
      materialOrigin: 'catalog',
      sectionId: 'w310x39',
      sectionOrigin: 'catalog',
    });
  });
});
