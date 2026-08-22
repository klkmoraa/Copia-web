import { beforeEach, describe, expect, it } from 'vitest';
import { applyProjectPatch, compileProjectCommand, projectCommandSnapshot } from '../../commands/projectCommand';
import { findStandardSection, standardSections } from '../../data/standardSections';
import type { MemberModel, ProjectModel } from '../../types';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { prepareBulkEdit } from './bulkEditCommand';
import { createBulkMember, resetBulkFixtureIds } from './bulkEditFixtures';
import { EMPTY_BULK_DRAFT, stageBulkChange } from './bulkEditIntent';
import type { BulkEditDraft, BulkPropertyId, BulkStagedChange } from './bulkEditTypes';

beforeEach(resetBulkFixtureIds);

const w12x53 = findStandardSection('w12x53')!;

const projectOf = (members: MemberModel[]): ProjectModel => ({
  schemaVersion: 1,
  id: 'P1',
  name: 'Bulk',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members,
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'permanent', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
    showNodeLabels: true, showMemberLabels: true, showLocalAxes: false, showLoads: true,
    showDimensions: false, showResultValues: true, diagramScale: 1, deformedScale: 1,
    diagramSide: 'positive',
  },
});

const stage = (project: ProjectModel, entries: [BulkPropertyId, BulkStagedChange][]) => {
  const aggregate = aggregateBulkSelection({ members: project.members, nodes: [] });
  let draft: BulkEditDraft = EMPTY_BULK_DRAFT;
  for (const [id, change] of entries) draft = stageBulkChange(draft, findBulkProperty(aggregate, id), change);
  return { aggregate, draft };
};

const apply = (project: ProjectModel, entries: [BulkPropertyId, BulkStagedChange][]) => {
  const { aggregate, draft } = stage(project, entries);
  const prepared = prepareBulkEdit(project, aggregate, draft, 'Editar selección');
  const compiled = compileProjectCommand(project, prepared.command);
  return { prepared, compiled, next: applyProjectPatch(project, compiled.forward) };
};

describe('prepared bulk member edit', () => {
  it('writes only the property the user changed and leaves the rest untouched', () => {
    const project = projectOf([
      createBulkMember({ materialId: 'steel-a992', sectionId: 'ipe-300' }),
      createBulkMember({ materialId: 'steel-a36', sectionId: 'w12x26' }),
    ]);
    const before = project.members.map((member) => ({ ...member }));

    const { next } = apply(project, [['member.sectionId', { kind: 'set', value: 'w12x53' }]]);

    for (const [index, member] of next.members.entries()) {
      expect(member.sectionId).toBe('w12x53');
      expect(member.sectionOrigin).toBe('catalog');
      expect(member.A).toBe(w12x53.area);
      expect(member.I).toBe(w12x53.inertiaX);
      // Material mixto que nadie tocó: intacto, incluida su identidad.
      expect(member.materialId).toBe(before[index].materialId);
      expect(member.materialOrigin).toBe(before[index].materialOrigin);
      expect(member.E).toBe(before[index].E);
      expect(member.type).toBe(before[index].type);
    }
  });

  it('preserves the catalog identity when a section is applied', () => {
    const project = projectOf([createBulkMember({ sectionId: undefined, sectionOrigin: undefined })]);

    const { next } = apply(project, [['member.sectionId', { kind: 'set', value: 'w12x53' }]]);

    expect(next.members[0]).toMatchObject({ sectionId: 'w12x53', sectionOrigin: 'catalog' });
  });

  it('demotes the section identity when A is written on its own', () => {
    const project = projectOf([createBulkMember({ sectionId: 'w12x26', sectionOrigin: 'catalog' })]);

    const { next } = apply(project, [['member.A', { kind: 'set', value: 0.02 }]]);

    expect(next.members[0].A).toBe(0.02);
    expect(next.members[0].sectionId).toBeUndefined();
    expect(next.members[0].sectionOrigin).toBe('custom');
    // El material no se toca al degradar la sección.
    expect(next.members[0].materialId).toBe('steel-a992');
  });

  it('never infers an identity from floats that match a catalog entry', () => {
    const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;
    const project = projectOf([createBulkMember({ sectionId: undefined, sectionOrigin: undefined })]);

    const { next } = apply(project, [
      ['member.A', { kind: 'set', value: ipe300.area }],
      ['member.I', { kind: 'set', value: ipe300.inertiaX }],
    ]);

    expect(next.members[0].sectionId).toBeUndefined();
    expect(next.members[0].sectionOrigin).toBe('custom');
  });

  it('clears an optional property explicitly', () => {
    const project = projectOf([createBulkMember({ density: 7850 })]);

    const { next } = apply(project, [['member.density', { kind: 'clear' }]]);

    expect('density' in next.members[0]).toBe(false);
  });

  it('applies a frame-only property only to the frames and reports the rest as skipped', () => {
    const project = projectOf([
      createBulkMember({ type: 'frame' }),
      createBulkMember({ type: 'frame' }),
      createBulkMember({ type: 'truss' }),
    ]);

    const { prepared, next } = apply(project, [['member.releases.iMoment', { kind: 'set', value: true }]]);

    expect(prepared.affected.map((target) => target.id)).toEqual(['M1', 'M2']);
    expect(prepared.skipped.map((target) => target.id)).toEqual(['M3']);
    expect(next.members[0].releases).toEqual({ iMoment: true });
    expect(next.members[1].releases).toEqual({ iMoment: true });
    expect(next.members[2].releases).toBeUndefined();
  });

  it('groups members by the exact change set they receive', () => {
    const project = projectOf([
      createBulkMember({ type: 'frame' }),
      createBulkMember({ type: 'truss' }),
    ]);

    const { prepared } = apply(project, [
      ['member.sectionId', { kind: 'set', value: 'w12x53' }],
      ['member.releases.jMoment', { kind: 'set', value: true }],
    ]);

    // El pórtico recibe sección y liberación; la armadura sólo sección.
    expect(prepared.command.entries).toHaveLength(2);
    const byMember = new Map(prepared.command.entries.flatMap((entry) => entry.memberIds.map((id) => [id, entry.changes])));
    expect(byMember.get('M1')).toMatchObject({ section: { sectionId: 'w12x53' }, jMoment: true });
    expect(byMember.get('M2')).toMatchObject({ section: { sectionId: 'w12x53' } });
    expect(byMember.get('M2')).not.toHaveProperty('jMoment');
  });

  it('drops what the new member type cannot hold instead of leaving an invalid model', () => {
    const project = projectOf([
      createBulkMember({ type: 'frame', releases: { iMoment: true }, rigidOffsetI: 0.2, beamTheory: 'timoshenko', G: 1, shearArea: 1 }),
    ]);

    const { next } = apply(project, [['member.type', { kind: 'set', value: 'truss' }]]);

    expect(next.members[0].type).toBe('truss');
    expect(next.members[0].releases).toBeUndefined();
    expect(next.members[0].rigidOffsetI).toBeUndefined();
    expect(next.members[0].beamTheory).toBeUndefined();
    expect(next.members[0].shearArea).toBeUndefined();
  });

  it('is a single reversible patch over every affected member', () => {
    const project = projectOf([createBulkMember(), createBulkMember(), createBulkMember()]);

    const { compiled, next } = apply(project, [['member.sectionId', { kind: 'set', value: 'w12x53' }]]);

    expect(compiled.forward.operations).toHaveLength(3);
    // Un solo parche inverso reconstruye exactamente el estado anterior.
    const restored = applyProjectPatch(next, compiled.inverse);
    expect(projectCommandSnapshot(restored)).toBe(projectCommandSnapshot(project));
  });

  it('rejects a prepared edit once the model moved underneath it', () => {
    const project = projectOf([createBulkMember(), createBulkMember()]);
    const { aggregate, draft } = stage(project, [['member.sectionId', { kind: 'set', value: 'w12x53' }]]);
    const prepared = prepareBulkEdit(project, aggregate, draft, 'Editar selección');

    const moved: ProjectModel = structuredClone(project);
    moved.members[0].E = 123456;

    expect(() => compileProjectCommand(moved, prepared.command)).toThrow(/obsoleta/i);
  });

  it('refuses the whole operation when one target disappeared', () => {
    const project = projectOf([createBulkMember(), createBulkMember()]);
    const { aggregate, draft } = stage(project, [['member.sectionId', { kind: 'set', value: 'w12x53' }]]);
    const prepared = prepareBulkEdit(project, aggregate, draft, 'Editar selección');

    const reduced: ProjectModel = structuredClone(project);
    reduced.members.splice(1, 1);
    const stale = { ...prepared.command, sourceSnapshot: projectCommandSnapshot(reduced) };

    // Cero mutación parcial: el comando entero falla.
    expect(() => compileProjectCommand(reduced, stale)).toThrow(/No existe el miembro/);
    expect(reduced.members[0].sectionId).toBe('w12x26');
  });

  it('produces no command entries when nothing was staged', () => {
    const project = projectOf([createBulkMember()]);
    const { prepared, compiled } = apply(project, []);

    expect(prepared.command.entries).toEqual([]);
    expect(compiled.forward.operations).toEqual([]);
  });
});
