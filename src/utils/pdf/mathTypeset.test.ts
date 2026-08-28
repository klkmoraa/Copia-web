import { describe, expect, it } from 'vitest';
import { typesetLatex } from './mathTypeset';

describe('typesetLatex', () => {
  it('parses a simple relation into glyph paths with a positive natural width', () => {
    const formula = typesetLatex('M(x) = 12.5x^{2}');
    expect(formula.ops.length).toBeGreaterThan(0);
    expect(formula.ops.every((op) => op.kind === 'path')).toBe(true);
    expect(formula.widthUnits).toBeGreaterThan(0);
    expect(formula.heightUnits).toBeGreaterThan(0);
  });

  it('emits a rect op for a fraction bar', () => {
    const formula = typesetLatex('\\frac{d\\theta}{dx}');
    expect(formula.ops.some((op) => op.kind === 'rect')).toBe(true);
  });

  it('caches by latex string: same input returns the same parsed object', () => {
    const first = typesetLatex('\\Sigma F_{x}');
    const second = typesetLatex('\\Sigma F_{x}');
    expect(first).toBe(second);
  });

  it('every path op carries a d attribute and a matrix with no rotation/skew', () => {
    const formula = typesetLatex('\\le \\Sigma \\sqrt{2}');
    for (const op of formula.ops) {
      expect(op.matrix.b).toBe(0);
      expect(op.matrix.c).toBe(0);
      if (op.kind === 'path') expect(op.path.length).toBeGreaterThan(0);
    }
  });
});
