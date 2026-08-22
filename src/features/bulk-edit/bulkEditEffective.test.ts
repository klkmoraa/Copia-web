import { beforeEach, describe, expect, it } from 'vitest';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { BULK_CANONICAL_DEFAULTS, canonicalBulkValue } from './bulkEditEffective';
import { createBulkMember, createBulkNode, resetBulkFixtureIds } from './bulkEditFixtures';
import type { BulkPropertyId, BulkSelectionInput } from './bulkEditTypes';

beforeEach(resetBulkFixtureIds);

const property = (selection: BulkSelectionInput, id: BulkPropertyId) =>
  findBulkProperty(aggregateBulkSelection(selection), id);

/**
 * Valores almacenados frente a valores efectivos.
 *
 * El solver es la única autoridad: cada normalización de aquí cita el `??` o la
 * comprobación de veracidad con la que `src/engine/solver.ts` resuelve la
 * ausencia. No hay heurísticas ni comparación de flotantes con tolerancia: se
 * sustituye la ausencia por la constante exacta que el solver ya usa.
 */
describe('canonical effective values', () => {
  it('resolves the roller normal that the solver defaults to 90°', () => {
    // solver.ts: `support.angleDeg ?? 90` (líneas 518, 1428, 1667).
    expect(canonicalBulkValue('node.support.angleDeg', undefined)).toBe(90);
    expect(canonicalBulkValue('node.support.angleDeg', 0)).toBe(0);
  });

  it('resolves an absent release as not released', () => {
    // solver.ts: `!explicitlyReleased` (línea 114).
    expect(canonicalBulkValue('member.releases.iMoment', undefined)).toBe(false);
    expect(canonicalBulkValue('member.releases.jMoment', undefined)).toBe(false);
  });

  it('resolves absent custom restraints and internal hinge as false', () => {
    // solver.ts: `Boolean(support.restrainX || …)` (452), `node.internalHinge` (675).
    expect(canonicalBulkValue('node.support.restrainX', undefined)).toBe(false);
    expect(canonicalBulkValue('node.support.restrainY', undefined)).toBe(false);
    expect(canonicalBulkValue('node.support.restrainR', undefined)).toBe(false);
    expect(canonicalBulkValue('node.internalHinge', undefined)).toBe(false);
  });

  it('resolves an absent beam theory as Euler-Bernoulli', () => {
    // solver.ts: `member.beamTheory === 'timoshenko'` — todo lo demás es Euler-Bernoulli.
    expect(canonicalBulkValue('member.beamTheory', undefined)).toBe('euler-bernoulli');
  });

  it('resolves absent density and rigid offsets as zero', () => {
    // solver.ts: `member.density ?? 0` (745), `member.rigidOffsetI ?? 0` (136, 594).
    expect(canonicalBulkValue('member.density', undefined)).toBe(0);
    expect(canonicalBulkValue('member.rigidOffsetI', undefined)).toBe(0);
    expect(canonicalBulkValue('member.rigidOffsetJ', undefined)).toBe(0);
  });

  it('leaves a semi-rigid spring alone: undefined is rigid and zero is a release', () => {
    // solver.ts línea 115 documenta que 0 NO equivale a ausente. Normalizarlo
    // convertiría una conexión rígida en una liberación.
    expect(canonicalBulkValue('member.rotationalSpringI', undefined)).toBeUndefined();
    expect(canonicalBulkValue('member.rotationalSpringJ', undefined)).toBeUndefined();
  });

  it('leaves shear properties alone: their default depends on the beam theory', () => {
    // `(member.G ?? 0) * (member.shearArea ?? 0)` sólo se lee bajo Timoshenko,
    // así que la equivalencia es condicional y no canónica.
    expect(canonicalBulkValue('member.G', undefined)).toBeUndefined();
    expect(canonicalBulkValue('member.shearArea', undefined)).toBeUndefined();
  });

  it('never rewrites a value that the model actually stores', () => {
    for (const id of Object.keys(BULK_CANONICAL_DEFAULTS) as BulkPropertyId[]) {
      expect(canonicalBulkValue(id, false)).toBe(false);
      expect(canonicalBulkValue(id, 0)).toBe(0);
    }
  });
});

describe('aggregation over effective values', () => {
  it('reads two equivalent rollers as `same`, not `mixed`', () => {
    const state = property({
      members: [],
      nodes: [
        createBulkNode({ support: { type: 'roller' } }),
        createBulkNode({ support: { type: 'roller', angleDeg: 90 } }),
      ],
    }, 'node.support.angleDeg');

    expect(state.value).toEqual({ state: 'same', value: 90 });
  });

  it('still reads two genuinely different rollers as `mixed`', () => {
    const state = property({
      members: [],
      nodes: [
        createBulkNode({ support: { type: 'roller' } }),
        createBulkNode({ support: { type: 'roller', angleDeg: 30 } }),
      ],
    }, 'node.support.angleDeg');

    expect(state.value.state).toBe('mixed');
  });

  it('reads an absent release and an explicit `false` as the same state', () => {
    const state = property({
      members: [
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'frame', releases: { iMoment: false } }),
      ],
      nodes: [],
    }, 'member.releases.iMoment');

    expect(state.value).toEqual({ state: 'same', value: false });
  });

  it('reads an absent internal hinge and an explicit `false` as the same state', () => {
    const state = property({
      members: [],
      nodes: [createBulkNode(), createBulkNode({ internalHinge: false })],
    }, 'node.internalHinge');

    expect(state.value).toEqual({ state: 'same', value: false });
  });

  it('reads an absent beam theory and an explicit Euler-Bernoulli as the same state', () => {
    const state = property({
      members: [
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'frame', beamTheory: 'euler-bernoulli' }),
      ],
      nodes: [],
    }, 'member.beamTheory');

    expect(state.value).toEqual({ state: 'same', value: 'euler-bernoulli' });
  });

  it('keeps a rigid connection distinct from a zero-stiffness release', () => {
    const state = property({
      members: [
        createBulkMember({ type: 'frame' }),
        createBulkMember({ type: 'frame', rotationalSpringI: 0 }),
      ],
      nodes: [],
    }, 'member.rotationalSpringI');

    expect(state.value.state).toBe('mixed');
  });

  it('does not turn a normalized reading into a write', () => {
    // Un rodillo sin `angleDeg` se lee como 90°, pero nadie lo tocó: la
    // propiedad no puede aparecer en ninguna intención preparada.
    const aggregate = aggregateBulkSelection({
      members: [],
      nodes: [createBulkNode({ support: { type: 'roller' } })],
    });
    const state = findBulkProperty(aggregate, 'node.support.angleDeg');

    expect(state.value).toEqual({ state: 'same', value: 90 });
    expect(state.compatibility.compatible).toHaveLength(1);
  });
});
