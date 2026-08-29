/**
 * How a worked relation is split, stacked and set.
 *
 * Two rules here are load-bearing and easy to break silently. A relation is split at the `=`
 * that is *its own* — not one inside a bracketed argument — and a symbolic row is never drawn
 * without the substitution that gives it this project's numbers, which is the whole reason the
 * identities were removed from the report in the first place.
 */
import { describe, expect, it } from 'vitest';
import { asWorkedEquation, buildAlignedLatex, romanUnit } from './pdfEquation';

describe('asWorkedEquation', () => {
  it('parte por el = de la relación, no por uno de dentro de un paréntesis', () => {
    // `dθ/dx (x = 0)` names a derivative *at* x = 0: that `=` belongs to the argument. Splitting
    // there left an lhs of `dθ/dx (x` and a substituted side opening with a stray `)`, which
    // then defeated every later reading of the row.
    const equation = asWorkedEquation('dθ/dx (x = 0) = M/EI = 0/16000 = 0 rad/m');
    expect(equation.lhs).toBe('dθ/dx (x = 0)');
    expect(equation.substituted).toBe('M/EI = 0/16000 = 0 rad/m');
  });

  it('separa la unidad final para poder grabarla en redonda', () => {
    const equation = asWorkedEquation('V(3) = 17.5 kN');
    expect(equation.substituted).toBe('17.5');
    expect(equation.unit).toBe('kN');
  });

  it('no confunde con una unidad la palabra que no lo es', () => {
    // `A` is the node this condition is imposed at, not an ampere.
    const equation = asWorkedEquation('y(0) = 0 en A');
    expect(equation.unit).toBeUndefined();
    expect(equation.substituted).toBe('0 en A');
  });

  it('deja intacta una expresión sin = de primer nivel', () => {
    expect(asWorkedEquation('f(a = b)')).toEqual({ lhs: 'f(a = b)' });
  });
});

describe('buildAlignedLatex', () => {
  it('apila regla, sustitución y resultado sobre el mismo =', () => {
    const latex = buildAlignedLatex({
      lhs: 'k_axial', symbolic: 'EA/L', substituted: '(2e+8)(0.01)/(8)', result: '250000', unit: 'kN/m',
    })!;
    expect(latex.startsWith('\\begin{aligned}')).toBe(true);
    // One `&=` per row: the first carries the left-hand side, the rest hang off the same rule.
    expect(latex.match(/&=/g)).toHaveLength(3);
    expect(latex).toContain('\\dfrac{EA}{L}');
    expect(latex).toContain('\\mathrm{kN/m}');
  });

  it('nunca imprime la identidad sola: sin sustitución, la fila simbólica no se dibuja', () => {
    // This is the constraint the whole redesign rests on. A symbolic row with nothing to
    // substitute into it is exactly the empty identity the report removed.
    const latex = buildAlignedLatex({ lhs: 'Δ', symbolic: 'Σ nNL/AE' });
    expect(latex).toBeUndefined();
  });

  it('deja la unidad en la fila de la sustitución cuando no hay fila de resultado', () => {
    const latex = buildAlignedLatex({ lhs: 'V(3)', substituted: '17.5', unit: 'kN' })!;
    expect(latex).toContain('17.5\\,\\mathrm{kN}');
  });
});

describe('romanUnit', () => {
  it('graba la unidad en redonda y conserva el punto medio y los exponentes', () => {
    // `kN·m` set as maths is a product of a k, an N and an m, in italic — which is what it is not.
    expect(romanUnit('kN·m')).toBe('\\,\\mathrm{kN{\\cdot}m}');
    expect(romanUnit('m⁴')).toBe('\\,\\mathrm{m^{4}}');
  });
});
