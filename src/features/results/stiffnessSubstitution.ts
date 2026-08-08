/**
 * Numeric substitution of the local stiffness terms, for the Classroom stiffness explorer.
 *
 * The explorer already shows kˡ as a grid of finished numbers. A student reading it can see
 * *that* the entry is 3.61e4 but not *why*, which is the whole point of the exercise. This
 * module rebuilds each entry from the member's own E, A, I and the element's flexible length,
 * exposing the intermediate step between the symbolic formula and the assembled matrix.
 *
 * It mirrors `frameLocalStiffness` in `engine/solver.ts` — the protected boundary is read,
 * never imported at runtime, so the duplication is deliberate and pinned by
 * `stiffnessSubstitution.test.ts`, which compares every term against the engine's own output.
 * If the engine's formulation ever changes, that test fails before this panel can lie.
 *
 * Everything here stays in the engine's base units (kN, m). The matrix beside it is not
 * converted either, so a converted substitution would not add up to the number on screen.
 */
import type { MemberModel } from '../../types';
import { formatSignificant } from '../../utils/numberFormat';

export type SubstitutionTermId = 'axial' | 'shearFlexural' | 'coupling' | 'flexuralNear' | 'flexuralFar';

export interface SubstitutionInput {
  id: 'E' | 'A' | 'I' | 'L' | 'G' | 'As';
  /** Symbol as it appears inside the formulas. */
  symbol: string;
  value: number;
  unit: string;
}

export interface SubstitutionTerm {
  id: SubstitutionTermId;
  /** Position in the 6×6 local matrix, 1-based, as the reader sees it in `MatrixView`. */
  entry: string;
  /** Symbolic form actually in force: the Φ factors collapse when there is no shear flexibility. */
  formula: string;
  /** The same expression with the member's numbers already in place. */
  substitution: string;
  value: number;
  unit: string;
}

export interface StiffnessSubstitution {
  theory: 'euler-bernoulli' | 'timoshenko';
  /** Shear flexibility factor Φ; zero whenever the element has no finite shear rigidity. */
  phi: number;
  inputs: readonly SubstitutionInput[];
  terms: readonly SubstitutionTerm[];
}

type Formatter = (value: number) => string;

const defaultFormat: Formatter = (value) => formatSignificant(value, 4, 'inspector');

export const buildStiffnessSubstitution = (
  member: MemberModel,
  length: number,
  format: Formatter = defaultFormat,
): StiffnessSubstitution => {
  const shearRigidity = member.beamTheory === 'timoshenko' ? (member.G ?? 0) * (member.shearArea ?? 0) : Number.POSITIVE_INFINITY;
  const usesShear = Number.isFinite(shearRigidity) && shearRigidity > 0;
  const EI = member.E * member.I;
  const phi = usesShear && length > 0 ? 12 * EI / (shearRigidity * length ** 2) : 0;
  const theory = phi > 0 ? 'timoshenko' : 'euler-bernoulli';

  const inputs: SubstitutionInput[] = [
    { id: 'E', symbol: 'E', value: member.E, unit: 'kN/m²' },
    { id: 'A', symbol: 'A', value: member.A, unit: 'm²' },
    { id: 'I', symbol: 'I', value: member.I, unit: 'm⁴' },
    { id: 'L', symbol: 'L', value: length, unit: 'm' },
  ];
  if (phi > 0) {
    inputs.push(
      { id: 'G', symbol: 'G', value: member.G ?? 0, unit: 'kN/m²' },
      { id: 'As', symbol: 'As', value: member.shearArea ?? 0, unit: 'm²' },
    );
  }

  // A zero-length element cannot exist in a solved model — the engine rejects it before the
  // trace is built — but the panel renders from state that can lag one analysis behind.
  if (!(length > 0)) return { theory, phi, inputs, terms: [] };

  const E = format(member.E);
  const A = format(member.A);
  const I = format(member.I);
  const L = format(length);
  const axial: SubstitutionTerm = {
    id: 'axial',
    entry: 'k₁₁',
    formula: 'E·A / L',
    substitution: `(${E} · ${A}) / ${L}`,
    value: member.E * member.A / length,
    unit: 'kN/m',
  };
  if (member.type === 'truss') return { theory, phi, inputs, terms: [axial] };

  // Carrying `(1 + Φ)` through a Euler–Bernoulli member would print `/(1 + 0)` on every row
  // and bury the formula the student is actually learning. The Φ form appears only when Φ
  // does — which is exactly when the two formulations disagree.
  const damped = phi > 0;
  const P = format(phi);
  const denominator = damped ? ` · (1 + ${P})` : '';
  const denominatorSymbol = damped ? '·(1+Φ)' : '';
  const terms: SubstitutionTerm[] = [
    axial,
    {
      id: 'shearFlexural',
      entry: 'k₂₂',
      formula: `12·E·I / (L³${denominatorSymbol})`,
      substitution: `(12 · ${E} · ${I}) / (${L}³${denominator})`,
      value: 12 * EI / (length ** 3 * (1 + phi)),
      unit: 'kN/m',
    },
    {
      id: 'coupling',
      entry: 'k₂₃',
      formula: `6·E·I / (L²${denominatorSymbol})`,
      substitution: `(6 · ${E} · ${I}) / (${L}²${denominator})`,
      value: 6 * EI / (length ** 2 * (1 + phi)),
      unit: 'kN/rad',
    },
    {
      id: 'flexuralNear',
      entry: 'k₃₃',
      formula: damped ? '(4 + Φ)·E·I / (L·(1+Φ))' : '4·E·I / L',
      substitution: damped
        ? `((4 + ${P}) · ${E} · ${I}) / (${L} · (1 + ${P}))`
        : `(4 · ${E} · ${I}) / ${L}`,
      value: (4 + phi) * EI / (length * (1 + phi)),
      unit: 'kN·m/rad',
    },
    {
      id: 'flexuralFar',
      entry: 'k₃₆',
      formula: damped ? '(2 − Φ)·E·I / (L·(1+Φ))' : '2·E·I / L',
      substitution: damped
        ? `((2 − ${P}) · ${E} · ${I}) / (${L} · (1 + ${P}))`
        : `(2 · ${E} · ${I}) / ${L}`,
      value: (2 - phi) * EI / (length * (1 + phi)),
      unit: 'kN·m/rad',
    },
  ];
  return { theory, phi, inputs, terms };
};
