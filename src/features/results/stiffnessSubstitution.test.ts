/**
 * The substitution block exists to answer "where does this number come from?", so its
 * only real acceptance criterion is that the number it derives is the number the solver
 * assembled. Every term is checked against `frameLocalStiffness` itself rather than
 * against a hand-copied constant — a formula drifting away from the engine has to fail
 * here, not in a student's notebook.
 */
import { describe, expect, it } from 'vitest';
import { frameLocalStiffness } from '../../engine/solver';
import type { MemberModel } from '../../types';
import { buildStiffnessSubstitution } from './stiffnessSubstitution';

const member = (overrides: Partial<MemberModel> = {}): MemberModel => ({
  id: 'M1',
  i: 'N1',
  j: 'N2',
  type: 'frame',
  E: 2.1e8,
  A: 9.3e-3,
  I: 8.49e-5,
  ...overrides,
});

const termValue = (terms: readonly { id: string; value: number }[], id: string): number => {
  const term = terms.find((entry) => entry.id === id);
  if (!term) throw new Error(`Falta el término ${id}`);
  return term.value;
};

describe('buildStiffnessSubstitution', () => {
  it('reproduces every Euler-Bernoulli entry of the local stiffness matrix', () => {
    const L = 5.4;
    const subject = member();
    const k = frameLocalStiffness(subject, L);
    const { terms } = buildStiffnessSubstitution(subject, L);

    expect(termValue(terms, 'axial')).toBeCloseTo(k[0][0], 12);
    expect(termValue(terms, 'shearFlexural')).toBeCloseTo(k[1][1], 12);
    expect(termValue(terms, 'coupling')).toBeCloseTo(k[1][2], 12);
    expect(termValue(terms, 'flexuralNear')).toBeCloseTo(k[2][2], 12);
    expect(termValue(terms, 'flexuralFar')).toBeCloseTo(k[2][5], 12);
  });

  it('reproduces the Timoshenko entries, where the shear factor stops being zero', () => {
    const L = 3.2;
    const subject = member({ beamTheory: 'timoshenko', G: 8.1e7, shearArea: 3.4e-3 });
    const k = frameLocalStiffness(subject, L);
    const { terms, phi } = buildStiffnessSubstitution(subject, L);

    expect(phi).toBeGreaterThan(0);
    expect(termValue(terms, 'axial')).toBeCloseTo(k[0][0], 12);
    expect(termValue(terms, 'shearFlexural')).toBeCloseTo(k[1][1], 12);
    expect(termValue(terms, 'coupling')).toBeCloseTo(k[1][2], 12);
    expect(termValue(terms, 'flexuralNear')).toBeCloseTo(k[2][2], 12);
    expect(termValue(terms, 'flexuralFar')).toBeCloseTo(k[2][5], 12);
  });

  it('treats a Timoshenko member with no shear rigidity as Euler-Bernoulli, exactly as the engine does', () => {
    const L = 4;
    const subject = member({ beamTheory: 'timoshenko', G: 0, shearArea: 0 });
    const { phi, theory } = buildStiffnessSubstitution(subject, L);

    expect(phi).toBe(0);
    expect(theory).toBe('euler-bernoulli');
  });

  it('reduces a truss to its single axial term, because it carries no bending', () => {
    const subject = member({ type: 'truss' });
    const { terms } = buildStiffnessSubstitution(subject, 6);

    expect(terms.map((term) => term.id)).toEqual(['axial']);
    expect(termValue(terms, 'axial')).toBeCloseTo(2.1e8 * 9.3e-3 / 6, 9);
  });

  it('reports the inputs that feed the substitution, so the reader can audit them', () => {
    const { inputs } = buildStiffnessSubstitution(member(), 5);
    const byId = Object.fromEntries(inputs.map((input) => [input.id, input]));

    expect(byId.E.value).toBe(2.1e8);
    expect(byId.A.value).toBe(9.3e-3);
    expect(byId.I.value).toBe(8.49e-5);
    expect(byId.L.value).toBe(5);
    expect(byId.L.unit).toBe('m');
  });

  it('never divides by a zero length', () => {
    const { terms } = buildStiffnessSubstitution(member(), 0);
    expect(terms).toEqual([]);
  });
});
