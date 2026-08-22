import { beforeEach, describe, expect, it } from 'vitest';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { createBulkMember, createBulkNode, resetBulkFixtureIds } from './bulkEditFixtures';
import {
  EMPTY_BULK_DRAFT,
  buildBulkChangeSummary,
  buildBulkEditIntent,
  resolveBulkChange,
  stageBulkChange,
  untouchBulkChange,
} from './bulkEditIntent';

beforeEach(resetBulkFixtureIds);

/** Diez miembros con material y sección mezclados y un único tipo. */
const mixedSelection = () => ({
  members: Array.from({ length: 10 }, (_unused, index) => createBulkMember({
    materialId: index % 2 === 0 ? 'steel-a992' : 'steel-a36',
    sectionId: index % 3 === 0 ? 'ipe-300' : 'w12x26',
  })),
  nodes: [],
});

const stage = (aggregate: ReturnType<typeof aggregateBulkSelection>, id: Parameters<typeof findBulkProperty>[1], change: Parameters<typeof stageBulkChange>[2]) =>
  stageBulkChange(EMPTY_BULK_DRAFT, findBulkProperty(aggregate, id), change);

describe('bulk edit intent', () => {
  it('produces no change at all from an untouched draft', () => {
    const aggregate = aggregateBulkSelection(mixedSelection());
    const intent = buildBulkEditIntent(aggregate, EMPTY_BULK_DRAFT);

    expect(intent.entries).toEqual([]);
    expect(intent.affected).toEqual([]);
    expect(intent.hasIncompatibleTargets).toBe(false);
  });

  it('leaves a mixed value the user never touched as untouched', () => {
    const aggregate = aggregateBulkSelection(mixedSelection());
    const draft = stage(aggregate, 'member.sectionId', { kind: 'set', value: 'w12x53' });
    const intent = buildBulkEditIntent(aggregate, draft);

    expect(intent.entries.map((entry) => entry.property)).toEqual(['member.sectionId']);
    expect(resolveBulkChange(draft, 'member.materialId')).toEqual({ kind: 'untouched' });
    expect(resolveBulkChange(draft, 'member.type')).toEqual({ kind: 'untouched' });
    expect(findBulkProperty(aggregate, 'member.materialId').value.state).toBe('mixed');
  });

  it('carries the previous aggregated value inside the entry', () => {
    const aggregate = aggregateBulkSelection(mixedSelection());
    const intent = buildBulkEditIntent(aggregate, stage(aggregate, 'member.sectionId', { kind: 'set', value: 'w12x53' }));

    expect(intent.entries[0]).toMatchObject({
      property: 'member.sectionId',
      change: { kind: 'set', value: 'w12x53' },
      previous: { state: 'mixed' },
    });
    expect(intent.affected).toHaveLength(10);
  });

  it('stages an explicit clear on an optional property', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember({ density: 7850 })], nodes: [] });
    const intent = buildBulkEditIntent(aggregate, stage(aggregate, 'member.density', { kind: 'clear' }));

    expect(intent.entries).toHaveLength(1);
    expect(intent.entries[0].change).toEqual({ kind: 'clear' });
    expect(intent.entries[0].previous).toEqual({ state: 'same', value: 7850 });
  });

  it('refuses to clear a property the schema always requires', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember()], nodes: [] });

    expect(stage(aggregate, 'member.E', { kind: 'clear' })).toEqual(EMPTY_BULK_DRAFT);
  });

  it('refuses to stage a derived property', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember()], nodes: [] });

    expect(stage(aggregate, 'member.sectionOrigin', { kind: 'set', value: 'custom' })).toEqual(EMPTY_BULK_DRAFT);
  });

  it('refuses a value that does not match the property kind', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember()], nodes: [] });

    expect(stage(aggregate, 'member.A', { kind: 'set', value: 'wide' })).toEqual(EMPTY_BULK_DRAFT);
    expect(stage(aggregate, 'member.A', { kind: 'set', value: Number.NaN })).toEqual(EMPTY_BULK_DRAFT);
    expect(stage(aggregate, 'member.type', { kind: 'set', value: 'beam' })).toEqual(EMPTY_BULK_DRAFT);
    expect(stage(aggregate, 'member.releases.iMoment', { kind: 'set', value: 'true' })).toEqual(EMPTY_BULK_DRAFT);
  });

  it('refuses to stage a property no selected entity admits', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember({ type: 'rigid' })], nodes: [] });

    expect(stage(aggregate, 'member.E', { kind: 'set', value: 1000 })).toEqual(EMPTY_BULK_DRAFT);
  });

  it('returns to untouched when a staged change is withdrawn', () => {
    const aggregate = aggregateBulkSelection(mixedSelection());
    const draft = stage(aggregate, 'member.sectionId', { kind: 'set', value: 'w12x53' });
    const withdrawn = untouchBulkChange(draft, 'member.sectionId');

    expect(resolveBulkChange(withdrawn, 'member.sectionId')).toEqual({ kind: 'untouched' });
    expect(buildBulkEditIntent(aggregate, withdrawn).entries).toEqual([]);
  });

  it('keeps false apart from untouched for a boolean property', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember({ releases: { iMoment: true } })], nodes: [] });
    const draft = stage(aggregate, 'member.releases.iMoment', { kind: 'set', value: false });

    expect(resolveBulkChange(draft, 'member.releases.iMoment')).toEqual({ kind: 'set', value: false });
    expect(buildBulkEditIntent(aggregate, draft).entries).toHaveLength(1);
    expect(resolveBulkChange(EMPTY_BULK_DRAFT, 'member.releases.iMoment')).toEqual({ kind: 'untouched' });
  });

  it('reports the compatible and the skipped targets of a partial change', () => {
    const aggregate = aggregateBulkSelection({
      members: [
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'truss' }),
      ],
      nodes: [],
    });
    const intent = buildBulkEditIntent(aggregate, stage(aggregate, 'member.releases.iMoment', { kind: 'set', value: true }));

    expect(intent.entries[0].compatible.map((target) => target.id)).toEqual(['M1', 'M2']);
    expect(intent.entries[0].incompatible).toEqual([{ target: { kind: 'member', id: 'M3' }, reason: 'member-type' }]);
    expect(intent.hasIncompatibleTargets).toBe(true);
  });

  it('does not double count an entity two changes share', () => {
    const aggregate = aggregateBulkSelection(mixedSelection());
    let draft = stage(aggregate, 'member.sectionId', { kind: 'set', value: 'w12x53' });
    draft = stageBulkChange(draft, findBulkProperty(aggregate, 'member.materialId'), { kind: 'set', value: 'steel-a36' });

    expect(buildBulkEditIntent(aggregate, draft).affected).toHaveLength(10);
  });

  it('stages node support changes the same way', () => {
    const aggregate = aggregateBulkSelection({
      members: [],
      nodes: [createBulkNode({ support: { type: 'pin' } }), createBulkNode({ support: { type: 'fixed' } })],
    });
    const intent = buildBulkEditIntent(aggregate, stage(aggregate, 'node.support.type', { kind: 'set', value: 'roller' }));

    expect(intent.entries[0]).toMatchObject({ property: 'node.support.type', previous: { state: 'mixed' } });
    expect(intent.affected).toEqual([{ kind: 'node', id: 'N1' }, { kind: 'node', id: 'N2' }]);
  });
});

describe('bulk change summary', () => {
  it('derives the summary from the intent, not from the whole form', () => {
    const aggregate = aggregateBulkSelection(mixedSelection());
    const rows = buildBulkChangeSummary(aggregate, stage(aggregate, 'member.sectionId', { kind: 'set', value: 'w12x53' }));

    const section = rows.find((row) => row.property === 'member.sectionId')!;
    expect(section).toEqual({
      property: 'member.sectionId',
      status: 'set',
      current: { state: 'mixed', values: ['ipe-300', 'w12x26'] },
      next: 'w12x53',
      affected: 10,
      skipped: 0,
      reasons: [],
    });

    for (const row of rows.filter((candidate) => candidate.property !== 'member.sectionId')) {
      expect(row.status).toBe('unchanged');
      expect(row.affected).toBe(0);
      expect(row.next).toBeUndefined();
    }
  });

  it('counts the skipped entities of a partially compatible change', () => {
    const aggregate = aggregateBulkSelection({
      members: [createBulkMember({ type: 'frame' }), createBulkMember({ type: 'truss' })],
      nodes: [],
    });
    const rows = buildBulkChangeSummary(aggregate, stage(aggregate, 'member.releases.jMoment', { kind: 'set', value: true }));

    expect(rows.find((row) => row.property === 'member.releases.jMoment')).toMatchObject({
      status: 'set', affected: 1, skipped: 1,
    });
  });

  it('marks an explicit clear apart from an unchanged property', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember({ density: 7850 })], nodes: [] });
    const rows = buildBulkChangeSummary(aggregate, stage(aggregate, 'member.density', { kind: 'clear' }));

    expect(rows.find((row) => row.property === 'member.density')).toMatchObject({ status: 'clear', affected: 1 });
    expect(rows.find((row) => row.property === 'member.A')).toMatchObject({ status: 'unchanged' });
  });

  it('only summarises properties the panel can offer', () => {
    const aggregate = aggregateBulkSelection({ members: [createBulkMember({ type: 'truss' })], nodes: [] });
    const properties = buildBulkChangeSummary(aggregate, EMPTY_BULK_DRAFT).map((row) => row.property);

    expect(properties).toContain('member.A');
    // Ni derivadas ni incompatibles con la selección.
    expect(properties).not.toContain('member.sectionOrigin');
    expect(properties).not.toContain('member.releases.iMoment');
    expect(properties).not.toContain('node.support.type');
  });
});
