import { describe, expect, it } from 'vitest';
import { MathTypesetError, typesetLatex } from './mathTypeset';

describe('typesetLatex', () => {
  it('throws on an undefined control sequence instead of drawing MathJax\'s error bar', () => {
    // MathJax does not throw on bad LaTeX: it substitutes an `merror` node whose background
    // <rect> the walker used to pick up as ordinary ink — a ~201pt solid black bar, silently.
    expect(() => typesetLatex('\\badcommand')).toThrow(MathTypesetError);
    expect(() => typesetLatex('\\badcommand')).toThrow(/Undefined control sequence/);
  });

  it('throws on a malformed expression that parses to a "Double exponent" error', () => {
    // Two adjacent Unicode superscripts used to translate to `^{-}^{1}`; see mathLatex.ts.
    expect(() => typesetLatex('Kbb^{-}^{1}')).toThrow(MathTypesetError);
  });

  it('names the offending LaTeX in the error message', () => {
    expect(() => typesetLatex('\\notarealmacro')).toThrow(/notarealmacro/);
  });

  it('skips, rather than rejects, the <text> node MathJax emits for a glyph its fonts lack', () => {
    // `walk` now throws on any node kind it can neither draw nor recurse into, but `<text>` is
    // deliberately exempt: it is MathJax's fallback for characters outside its TeX fonts, and
    // the concrete producer here is accented Spanish prose reaching the math renderer through
    // `needsMath`. Turning a dropped accent into a failed PDF export would be strictly worse.
    // The other `<text>` producer — an `merror` message — never reaches `walk`; `compute`
    // rejects error trees first, which is what the cases above pin down.
    expect(() => typesetLatex('deformaci\u00f3n')).not.toThrow();
    const formula = typesetLatex('a\u00f1o');
    expect(formula.ops.length).toBeGreaterThan(0);
    expect(formula.widthUnits).toBeGreaterThan(0);
  });


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

  it('offsets a second digit that carries its own transform, not just its parent group', () => {
    // Regression test: MathJax's multi-digit-number optimization puts a translate() directly
    // on the second <use> element instead of wrapping it in its own <g>. The old `walk`
    // ignored a use/rect element's own transform and used only the inherited parentMatrix,
    // so both digits were pushed with the identical matrix and drew on top of each other.
    const formula = typesetLatex('12');
    const pathOps = formula.ops.filter((op) => op.kind === 'path');
    expect(pathOps.length).toBe(2);
    expect(pathOps[0].matrix.e).not.toBe(pathOps[1].matrix.e);
    // Digit advance widths are on the order of 500 TeX units; a NaN-vs-number bug would
    // satisfy a bare `.not.toBe` check, so assert a concrete separation instead.
    expect(Math.abs(pathOps[1].matrix.e - pathOps[0].matrix.e)).toBeGreaterThan(100);
  });

  it('fixes the exact reported case: adjacent digits inside a fraction denominator no longer overlap', () => {
    // Regression test for the real translated equation at src/engine/solver.ts:1147
    // ('qL²/12'), whose SVG output contains:
    //   <use xlink:href="#...-31"></use><use xlink:href="#...-32" transform="translate(500,0)"></use>
    const formula = typesetLatex('\\frac{qL^{2}}{12,}');
    const pathOps = formula.ops.filter((op) => op.kind === 'path');
    // Find the two adjacent-digit ops (the "1" and "2" of "12") by their distinct e values.
    const eValues = pathOps.map((op) => op.matrix.e);
    const uniqueEValues = new Set(eValues);
    // Every glyph must land at a distinct x position — none should overlap another.
    expect(uniqueEValues.size).toBe(pathOps.length);
  });
});
