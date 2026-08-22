import { beforeEach, describe, expect, it } from 'vitest';
import { standardSections } from '../../data/standardSections';
import { aggregateBulkSelection, editableBulkProperties, findBulkProperty } from './bulkEditAggregation';
import { createBulkMember, createBulkNode, resetBulkFixtureIds } from './bulkEditFixtures';

beforeEach(resetBulkFixtureIds);

const property = (selection: Parameters<typeof aggregateBulkSelection>[0], id: Parameters<typeof findBulkProperty>[1]) =>
  findBulkProperty(aggregateBulkSelection(selection), id);

describe('bulk selection aggregation', () => {
  it('counts the selection by entity and by member type', () => {
    const aggregate = aggregateBulkSelection({
      members: [
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'truss' }),
        createBulkMember({ type: 'rigid' }),
      ],
      nodes: [createBulkNode(), createBulkNode()],
    });

    expect(aggregate.total).toBe(6);
    expect(aggregate.counts).toEqual({ member: 4, node: 2, nodalLoad: 0, memberLoad: 0 });
    expect(aggregate.memberTypeCounts).toEqual({ frame: 2, truss: 1, rigid: 1 });
  });

  it('reports a shared value as `same`', () => {
    const state = property(
      { members: [createBulkMember(), createBulkMember()], nodes: [] },
      'member.sectionId',
    );

    expect(state.value).toEqual({ state: 'same', value: 'w12x26' });
    expect(state.compatibility.compatible).toHaveLength(2);
    expect(state.compatibility.incompatible).toEqual([]);
  });

  it('reports diverging values as `mixed` without picking a representative', () => {
    const state = property({
      members: [
        createBulkMember({ sectionId: 'w12x26' }),
        createBulkMember({ sectionId: 'ipe-300' }),
        createBulkMember({ sectionId: 'w12x26' }),
      ],
      nodes: [],
    }, 'member.sectionId');

    expect(state.value.state).toBe('mixed');
    expect(state.value).not.toHaveProperty('value');
    if (state.value.state !== 'mixed') throw new Error('unreachable');
    expect([...state.value.values].sort()).toEqual(['ipe-300', 'w12x26']);
  });

  it('treats a diverging materialId as mixed even when E is identical', () => {
    // A992 y A36 comparten E: la identidad no puede colapsarse por el número.
    const state = property({
      members: [
        createBulkMember({ materialId: 'steel-a992', E: 200000000 }),
        createBulkMember({ materialId: 'steel-a36', E: 200000000 }),
      ],
      nodes: [],
    }, 'member.materialId');

    expect(state.value.state).toBe('mixed');
    expect(property({
      members: [
        createBulkMember({ materialId: 'steel-a992', E: 200000000 }),
        createBulkMember({ materialId: 'steel-a36', E: 200000000 }),
      ],
      nodes: [],
    }, 'member.E').value).toEqual({ state: 'same', value: 200000000 });
  });

  it('never infers a catalog identity from matching A and I', () => {
    const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;
    const state = property({
      members: [
        createBulkMember({ sectionId: undefined, sectionOrigin: undefined, A: ipe300.area, I: ipe300.inertiaX }),
        createBulkMember({ sectionId: undefined, sectionOrigin: undefined, A: ipe300.area, I: ipe300.inertiaX }),
      ],
      nodes: [],
    }, 'member.sectionId');

    expect(state.value).toEqual({ state: 'same', value: undefined });
  });

  it('keeps a legitimately absent optional value distinguishable from a mixed one', () => {
    // `member.G` no tiene equivalencia canónica —su ausencia sólo significa algo
    // bajo Timoshenko—, así que sigue agregándose por valor almacenado y prueba
    // que «ausente» es un valor propio y no «mezclado».
    const absent = property({
      members: [createBulkMember({ G: undefined }), createBulkMember({ G: undefined })],
      nodes: [],
    }, 'member.G');
    expect(absent.value).toEqual({ state: 'same', value: undefined });

    const partial = property({
      members: [createBulkMember({ G: undefined }), createBulkMember({ G: 77000000 })],
      nodes: [],
    }, 'member.G');
    expect(partial.value.state).toBe('mixed');
  });

  it('returns every property as incompatible for an empty selection', () => {
    const aggregate = aggregateBulkSelection({ members: [], nodes: [] });

    expect(aggregate.total).toBe(0);
    expect(aggregate.properties.length).toBeGreaterThan(0);
    for (const state of aggregate.properties) {
      expect(state.value).toEqual({ state: 'incompatible' });
      expect(state.compatibility).toEqual({ selected: 0, compatible: [], incompatible: [] });
    }
  });

  it('splits partially compatible properties into compatible and incompatible targets', () => {
    const state = property({
      members: [
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'truss' }),
      ],
      nodes: [],
    }, 'member.releases.iMoment');

    expect(state.compatibility.selected).toBe(3);
    expect(state.compatibility.compatible.map((target) => target.id)).toEqual(['M1', 'M2']);
    expect(state.compatibility.incompatible).toEqual([
      { target: { kind: 'member', id: 'M3' }, reason: 'member-type' },
    ]);
  });

  it('aggregates only over the compatible targets', () => {
    const state = property({
      members: [
        createBulkMember({ type: 'frame', releases: { iMoment: true } }),
        createBulkMember({ type: 'frame', releases: { iMoment: true } }),
        createBulkMember({ type: 'truss' }),
      ],
      nodes: [],
    }, 'member.releases.iMoment');

    expect(state.value).toEqual({ state: 'same', value: true });
  });

  it('marks a property incompatible when no selected entity is eligible', () => {
    const state = property({
      members: [createBulkMember({ type: 'rigid' }), createBulkMember({ type: 'rigid' })],
      nodes: [],
    }, 'member.E');

    expect(state.value).toEqual({ state: 'incompatible' });
    expect(state.compatibility.compatible).toEqual([]);
    expect(state.compatibility.incompatible).toHaveLength(2);
  });

  it('marks member properties incompatible for a node-only selection', () => {
    const aggregate = aggregateBulkSelection({ members: [], nodes: [createBulkNode(), createBulkNode()] });
    const state = findBulkProperty(aggregate, 'member.type');

    expect(state.value).toEqual({ state: 'incompatible' });
    // Los nudos no «rechazan» la propiedad de un miembro: no son su familia, así
    // que el denominador es cero y la propiedad no se ofrece.
    expect(state.compatibility).toEqual({ selected: 0, compatible: [], incompatible: [] });
    expect(editableBulkProperties(aggregate).map((item) => item.id)).not.toContain('member.type');
    // Y aun así los nudos siguen enumerados en el alcance.
    expect(aggregate.targets.map((target) => target.kind)).toEqual(['node', 'node']);
  });

  it('aggregates node support type and configuration', () => {
    const selection = {
      members: [],
      nodes: [
        createBulkNode({ support: { type: 'custom', restrainX: true, restrainY: false } }),
        createBulkNode({ support: { type: 'custom', restrainX: true, restrainY: true } }),
      ],
    };

    expect(property(selection, 'node.support.type')).toMatchObject({ value: { state: 'same', value: 'custom' } });
    expect(property(selection, 'node.support.restrainX').value).toEqual({ state: 'same', value: true });
    expect(property(selection, 'node.support.restrainY').value.state).toBe('mixed');
  });

  it('restricts the restraint flags to custom supports', () => {
    const state = property({
      members: [],
      nodes: [
        createBulkNode({ support: { type: 'custom', restrainX: true } }),
        createBulkNode({ support: { type: 'pin' } }),
      ],
    }, 'node.support.restrainX');

    expect(state.compatibility.compatible).toHaveLength(1);
    expect(state.compatibility.incompatible).toEqual([
      { target: { kind: 'node', id: 'N2' }, reason: 'support-type' },
    ]);
  });

  it('exposes the origins as derived, non-editable properties', () => {
    const state = property({ members: [createBulkMember()], nodes: [] }, 'member.sectionOrigin');

    expect(state.editable).toBe(false);
    expect(state.value).toEqual({ state: 'same', value: 'catalog' });
  });

  it('is deterministic for the same selection', () => {
    const build = () => ({
      members: [createBulkMember({ id: 'M9', sectionId: 'ipe-300' }), createBulkMember({ id: 'M4' })],
      nodes: [createBulkNode({ id: 'N7' })],
    });

    expect(aggregateBulkSelection(build())).toEqual(aggregateBulkSelection(build()));
  });
});
