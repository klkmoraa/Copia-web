import { beforeEach, describe, expect, it } from 'vitest';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { createBulkMember, createBulkNode, resetBulkFixtureIds } from './bulkEditFixtures';
import { bulkScopeBreakdown } from './bulkEditPresentation';
import type { BulkSelectionInput } from './bulkEditTypes';

beforeEach(resetBulkFixtureIds);

const load = (id: string, nodeId: string) => ({ id, nodeId, caseId: 'dead', fx: 0, fy: -10, mz: 0 });

/**
 * Compatibilidad exacta.
 *
 * El reparto se calcula por propiedad y por objetivo real. Un nudo no es
 * «incompatible con la sección»: sencillamente no es un miembro, y contarlo como
 * rechazo infla el denominador hasta que «2 de 7 compatibles» deja de significar
 * nada. El denominador de una propiedad es su propia familia.
 */
describe('per-property compatibility', () => {
  it('counts only the family of the property, not the whole selection', () => {
    const aggregate = aggregateBulkSelection({
      members: [createBulkMember(), createBulkMember()],
      nodes: [createBulkNode(), createBulkNode(), createBulkNode()],
    });

    const section = findBulkProperty(aggregate, 'member.sectionId');
    expect(section.compatibility.selected).toBe(2);
    expect(section.compatibility.compatible).toHaveLength(2);
    expect(section.compatibility.incompatible).toEqual([]);

    const support = findBulkProperty(aggregate, 'node.support.type');
    expect(support.compatibility.selected).toBe(3);
    expect(support.compatibility.compatible).toHaveLength(3);
    expect(support.compatibility.incompatible).toEqual([]);
  });

  it('reports an in-family rejection with its real reason', () => {
    const aggregate = aggregateBulkSelection({
      members: [
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'truss' }),
        createBulkMember({ type: 'rigid' }),
      ],
      nodes: [createBulkNode()],
    });

    const releases = findBulkProperty(aggregate, 'member.releases.iMoment');
    expect(releases.compatibility.selected).toBe(3);
    expect(releases.compatibility.compatible.map((target) => target.id)).toEqual(['M1']);
    expect(releases.compatibility.incompatible).toEqual([
      { target: { kind: 'member', id: 'M2' }, reason: 'member-type' },
      { target: { kind: 'member', id: 'M3' }, reason: 'member-type' },
    ]);
  });

  it('does not count loads against a node property', () => {
    const aggregate = aggregateBulkSelection({
      members: [],
      nodes: [createBulkNode(), createBulkNode()],
      nodalLoads: [load('L1', 'N1'), load('L2', 'N2')],
    });

    const support = findBulkProperty(aggregate, 'node.support.type');
    expect(support.compatibility.selected).toBe(2);
    expect(support.compatibility.incompatible).toEqual([]);

    const fy = findBulkProperty(aggregate, 'nodalLoad.fy');
    expect(fy.compatibility.selected).toBe(2);
    expect(fy.compatibility.compatible.map((target) => target.id)).toEqual(['L1', 'L2']);
    expect(fy.compatibility.incompatible).toEqual([]);
  });

  it('exposes the whole scope so a target never has to be inferred from a rejection', () => {
    const aggregate = aggregateBulkSelection({
      members: [createBulkMember()],
      nodes: [createBulkNode()],
      nodalLoads: [load('L1', 'N1')],
    });

    expect(aggregate.targets).toEqual([
      { kind: 'member', id: 'M1' },
      { kind: 'node', id: 'N1' },
      { kind: 'nodalLoad', id: 'L1' },
    ]);
  });
});

describe('scope breakdown', () => {
  const scope = (selection: BulkSelectionInput) => bulkScopeBreakdown(aggregateBulkSelection(selection));

  it('never reports a negative incompatible count when loads hang from the selection', () => {
    const breakdown = scope({
      members: [],
      nodes: [createBulkNode(), createBulkNode()],
      nodalLoads: [load('L1', 'N1'), load('L2', 'N2')],
    });

    for (const row of breakdown) expect(row.incompatible).toBeGreaterThanOrEqual(0);
    expect(breakdown.find((row) => row.kind === 'node')).toMatchObject({ selected: 2, compatible: 2, incompatible: 0 });
    expect(breakdown.find((row) => row.kind === 'nodalLoad')).toMatchObject({ selected: 2, compatible: 2, incompatible: 0 });
  });

  it('counts a member that no editable property accepts as incompatible, not as missing', () => {
    const breakdown = scope({ members: [createBulkMember({ type: 'rigid' })], nodes: [] });
    const members = breakdown.find((row) => row.kind === 'member');

    // Un rígido sigue admitiendo `member.type`, así que es compatible; lo que no
    // puede pasar es que desaparezca del recuento.
    expect(members?.selected).toBe(1);
    expect((members?.compatible ?? 0) + (members?.incompatible ?? 0)).toBe(1);
  });

  it('omits a family that is not in scope', () => {
    const breakdown = scope({ members: [createBulkMember()], nodes: [] });
    expect(breakdown.map((row) => row.kind)).toEqual(['member']);
  });
});
