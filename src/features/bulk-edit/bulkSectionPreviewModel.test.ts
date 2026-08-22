import { beforeEach, describe, expect, it } from 'vitest';
import { standardSections } from '../../data/standardSections';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { createBulkMember, resetBulkFixtureIds } from './bulkEditFixtures';
import { EMPTY_BULK_DRAFT, stageBulkChange } from './bulkEditIntent';
import { buildBulkSectionPreview } from './bulkSectionPreviewModel';

beforeEach(resetBulkFixtureIds);

const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;

const previewOf = (members: Parameters<typeof aggregateBulkSelection>[0]['members'], targetSectionId?: string) => {
  const aggregate = aggregateBulkSelection({ members, nodes: [] });
  const draft = targetSectionId
    ? stageBulkChange(EMPTY_BULK_DRAFT, findBulkProperty(aggregate, 'member.sectionId'), { kind: 'set', value: targetSectionId })
    : EMPTY_BULK_DRAFT;
  return buildBulkSectionPreview(aggregate, draft);
};

describe('bulk section preview model', () => {
  it('keeps the catalog identity when every member shares it', () => {
    const preview = previewOf([createBulkMember(), createBulkMember()]);

    expect(preview.current).toEqual({ kind: 'catalog', sectionId: 'w12x26' });
    expect(preview.changed).toBe(false);
    expect(preview.target).toEqual(preview.current);
  });

  it('reports diverging sections as mixed instead of choosing one', () => {
    const preview = previewOf([
      createBulkMember({ sectionId: 'w12x26' }),
      createBulkMember({ sectionId: 'ipe-300' }),
    ]);

    expect(preview.current).toEqual({ kind: 'mixed' });
  });

  it('reacts to the staged target section', () => {
    const preview = previewOf([createBulkMember(), createBulkMember()], 'w12x53');

    expect(preview.current).toEqual({ kind: 'catalog', sectionId: 'w12x26' });
    expect(preview.target).toEqual({ kind: 'catalog', sectionId: 'w12x53' });
    expect(preview.changed).toBe(true);
  });

  it('goes from mixed to a known catalog target', () => {
    const preview = previewOf([
      createBulkMember({ sectionId: 'w12x26' }),
      createBulkMember({ sectionId: 'ipe-300' }),
    ], 'w12x53');

    expect(preview.current).toEqual({ kind: 'mixed' });
    expect(preview.target).toEqual({ kind: 'catalog', sectionId: 'w12x53' });
    expect(preview.changed).toBe(true);
  });

  it('never turns matching A and I into a catalog identity', () => {
    const preview = previewOf([
      createBulkMember({ sectionId: undefined, sectionOrigin: undefined, A: ipe300.area, I: ipe300.inertiaX }),
      createBulkMember({ sectionId: undefined, sectionOrigin: undefined, A: ipe300.area, I: ipe300.inertiaX }),
    ]);

    expect(preview.current).toEqual({ kind: 'equivalent', area: ipe300.area, inertia: ipe300.inertiaX });
  });

  it('treats a non-catalog origin as an equivalent section even with a stored id', () => {
    const preview = previewOf([
      createBulkMember({ sectionId: 'w12x26', sectionOrigin: 'imported', A: 0.01, I: 0.0002 }),
      createBulkMember({ sectionId: 'w12x26', sectionOrigin: 'imported', A: 0.01, I: 0.0002 }),
    ]);

    expect(preview.current).toEqual({ kind: 'equivalent', area: 0.01, inertia: 0.0002 });
  });

  it('falls back to equivalent when the stored catalog id is unknown', () => {
    const preview = previewOf([
      createBulkMember({ sectionId: 'w99x999', sectionOrigin: 'catalog', A: 0.01, I: 0.0002 }),
    ]);

    expect(preview.current).toEqual({ kind: 'equivalent', area: 0.01, inertia: 0.0002 });
  });

  it('does not claim a catalog identity when the origin diverges, even if the id matches', () => {
    const w12x26 = standardSections.find((section) => section.id === 'w12x26')!;
    const preview = previewOf([
      createBulkMember({ sectionId: 'w12x26', sectionOrigin: 'catalog' }),
      createBulkMember({ sectionId: 'w12x26', sectionOrigin: 'imported' }),
    ]);

    // A e I sí son comunes, así que la equivalente es honesta; el perfil no.
    expect(preview.current).toEqual({ kind: 'equivalent', area: w12x26.area, inertia: w12x26.inertiaX });
  });

  it('is mixed when there is no identity and A or I diverge', () => {
    const preview = previewOf([
      createBulkMember({ sectionId: undefined, sectionOrigin: undefined, A: 0.01, I: 0.0002 }),
      createBulkMember({ sectionId: undefined, sectionOrigin: undefined, A: 0.02, I: 0.0002 }),
    ]);

    expect(preview.current).toEqual({ kind: 'mixed' });
  });

  it('has nothing to show when no selected member admits a section', () => {
    const preview = previewOf([createBulkMember({ type: 'rigid' })]);

    expect(preview.current).toEqual({ kind: 'none' });
    expect(preview.target).toEqual({ kind: 'none' });
    expect(preview.changed).toBe(false);
  });
});

