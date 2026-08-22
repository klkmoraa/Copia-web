import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberLoad, NodalLoad } from '../../types';
import { aggregateBulkSelection, editableBulkProperties } from './bulkEditAggregation';
import { createBulkMember, createBulkNode, resetBulkFixtureIds } from './bulkEditFixtures';
import { BULK_DISCLOSED_GROUPS, bulkPropertyGroups, bulkScopeOptions, propertiesInScope } from './bulkEditScope';
import type { BulkSelectionInput } from './bulkEditTypes';

beforeEach(resetBulkFixtureIds);

const nodalLoad = (id: string): NodalLoad => ({ id, nodeId: 'N1', caseId: 'dead', fx: 0, fy: -10, mz: 0 });

const memberLoad = (id: string, type: MemberLoad['type'], overrides: Partial<MemberLoad> = {}): MemberLoad => ({
  id, memberId: 'M1', caseId: 'dead', type,
  coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
  ...overrides,
});

const editable = (selection: BulkSelectionInput) =>
  editableBulkProperties(aggregateBulkSelection(selection));

/**
 * Filtros de alcance.
 *
 * El filtro es una lente del Inspector: decide qué se muestra y qué se edita, y
 * no toca la selección del lienzo. Por eso se deriva de la agregación y no del
 * store: cambiarlo no puede publicar nada ni mover la selección global.
 */
describe('scope filters', () => {
  it('offers only the families actually present, plus «all» when there is more than one', () => {
    expect(bulkScopeOptions(aggregateBulkSelection({ members: [createBulkMember()], nodes: [] })))
      .toEqual(['member']);

    expect(bulkScopeOptions(aggregateBulkSelection({
      members: [createBulkMember()],
      nodes: [createBulkNode()],
    }))).toEqual(['all', 'member', 'node']);

    expect(bulkScopeOptions(aggregateBulkSelection({
      members: [],
      nodes: [createBulkNode()],
      nodalLoads: [nodalLoad('L1')],
    }))).toEqual(['all', 'node', 'load']);
  });

  it('offers no filter at all for a single family', () => {
    const options = bulkScopeOptions(aggregateBulkSelection({ members: [], nodes: [createBulkNode()] }));
    expect(options).toEqual(['node']);
  });

  it('narrows what the inspector shows without touching anything else', () => {
    const selection: BulkSelectionInput = {
      members: [createBulkMember()],
      nodes: [createBulkNode()],
      nodalLoads: [nodalLoad('L1')],
    };
    const properties = editable(selection);

    expect(propertiesInScope(properties, 'member').every((item) => item.entity === 'member')).toBe(true);
    expect(propertiesInScope(properties, 'node').every((item) => item.entity === 'node')).toBe(true);
    expect(propertiesInScope(properties, 'load').every(
      (item) => item.entity === 'nodalLoad' || item.entity === 'memberLoad',
    )).toBe(true);
    expect(propertiesInScope(properties, 'all')).toEqual(properties);
  });
});

/**
 * Agrupación por familia real.
 *
 * Una lista plana con `q`, `p`, `posición` y `momento` juntos obliga a leer
 * cuarenta filas para encontrar la que aplica. Cada propiedad declara su grupo;
 * no se deduce del nombre ni del orden.
 */
describe('property groups', () => {
  it('groups member-load properties by the load families that own them', () => {
    const groups = bulkPropertyGroups(editable({
      members: [],
      nodes: [],
      memberLoads: [memberLoad('ML1', 'distributed', { qyStart: -5, qyEnd: -5 })],
    }));

    expect(groups.map((group) => group.id)).toEqual(['load.member', 'load.distributedPoint', 'load.distributed']);
    // Ninguna propiedad de otra familia se cuela en el grupo de las repartidas.
    const distributed = groups.find((group) => group.id === 'load.distributed');
    expect(distributed?.properties.map((item) => item.id)).toEqual([
      'memberLoad.lengthBasis', 'memberLoad.start', 'memberLoad.end',
      'memberLoad.qxStart', 'memberLoad.qxEnd', 'memberLoad.qyStart', 'memberLoad.qyEnd',
    ]);
  });

  it('never shows a property that has no meaning for the active families', () => {
    const groups = bulkPropertyGroups(editable({
      members: [],
      nodes: [],
      memberLoads: [memberLoad('ML1', 'moment', { moment: 12, position: 0.5 })],
    }));
    const ids = groups.flatMap((group) => group.properties.map((item) => item.id));

    expect(ids).toContain('memberLoad.moment');
    expect(ids).toContain('memberLoad.position');
    // Ni la carga repartida ni la puntual existen en una familia de momento.
    expect(ids).not.toContain('memberLoad.qyStart');
    expect(ids).not.toContain('memberLoad.px');
    expect(ids).not.toContain('memberLoad.lengthBasis');
  });

  it('keeps nodal and member load families in separate groups', () => {
    const groups = bulkPropertyGroups(editable({
      members: [],
      nodes: [],
      nodalLoads: [nodalLoad('L1')],
      memberLoads: [memberLoad('ML1', 'point', { px: 0, py: -8, position: 0.5 })],
    }));

    const nodal = groups.find((group) => group.id === 'load.nodal');
    expect(nodal?.properties.map((item) => item.id)).toEqual([
      'nodalLoad.caseId', 'nodalLoad.fx', 'nodalLoad.fy', 'nodalLoad.mz',
    ]);
    expect(nodal?.properties.some((item) => item.entity === 'memberLoad')).toBe(false);
  });

  it('puts members and nodes in their own groups, in reading order', () => {
    const groups = bulkPropertyGroups(editable({
      members: [createBulkMember()],
      nodes: [createBulkNode()],
    }));

    expect(groups.map((group) => group.id)).toEqual(['member', 'node']);
  });

  it('drops an empty group instead of rendering a heading with nothing under it', () => {
    const groups = bulkPropertyGroups(editable({ members: [createBulkMember()], nodes: [] }));
    expect(groups.every((group) => group.properties.length > 0)).toBe(true);
  });
});

/**
 * Revelación progresiva sólo donde hace falta.
 *
 * Un miembro tiene dieciocho propiedades y un nudo seis, así que esconder las
 * menos frecuentes ayuda. Una familia de carga tiene cuatro o menos, y son
 * exactamente lo que el usuario vino a cambiar: plegarlas convertía editar una
 * carga en una búsqueda dentro de un desplegable.
 */
describe('progressive disclosure', () => {
  it('discloses members and nodes, and shows every load property directly', () => {
    expect(BULK_DISCLOSED_GROUPS).toEqual(['member', 'node']);
  });

  it('never hides the magnitude of a load behind a disclosure', () => {
    const groups = bulkPropertyGroups(editable({
      members: [],
      nodes: [],
      nodalLoads: [nodalLoad('L1')],
    }));

    for (const group of groups) expect(BULK_DISCLOSED_GROUPS).not.toContain(group.id);
  });
});
