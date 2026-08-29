// src/utils/pdf/pdfMath.test.ts
import { describe, expect, it, vi } from 'vitest';
import { PdfLayout } from './pdfBuilder';
import { REPORT_FONTS, Surface } from './pdfSurface';
import { translateExpression } from './mathLatex';
import { MathTypesetError, typesetLatex } from './mathTypeset';
import { measureFormula } from './mathVector';
import { drawMathBlock, drawMathFormula, hasFraction, mathWidth, needsMath, packMathLines } from './pdfMath';

const INK = 'ink';

/** The measuring half — the layout — and the recording half, which the renderer replays. */
const layout = () => new PdfLayout();
const surface = () => new Surface();

describe('needsMath', () => {
  it('is true for an expression carrying Greek or operators', () => {
    expect(needsMath('ΔX = Xⱼ − Xᵢ')).toBe(true);
  });
  it('is false for plain prose', () => {
    expect(needsMath('Resultado del paso 3')).toBe(false);
  });
});

describe('hasFraction', () => {
  it('is true for an implicit-slash word', () => {
    expect(hasFraction('dθ/dx = M/EI')).toBe(true);
  });
  it('is false when the slash sits inside a bracketed expression', () => {
    expect(hasFraction('||r|| / max(1, ||F||)')).toBe(false);
  });
});

describe('mathWidth / drawMathFormula', () => {
  it('grows with font size and matches what gets drawn', () => {
    const page = layout();
    const small = mathWidth(page, 'M(x) = 12.5x^2', 8);
    const large = mathWidth(page, 'M(x) = 12.5x^2', 16);
    expect(large).toBeGreaterThan(small);
    const drawn = drawMathFormula(surface(), 'M(x) = 12.5x^2', 40, 100, 11, INK);
    expect(drawn).toBeCloseTo(mathWidth(page, 'M(x) = 12.5x^2', 11), 3);
  });

  it('shrinks to fit a maxFormulaWidth rather than overflowing it', () => {
    // MathJax's real glyph metrics run wider than the old hand-rolled ones did, so the target
    // here sits above the shrink loop's readability floor (~7.5pt) — this exercises the loop
    // actually converging on the requested width, not just bottoming out at the floor.
    const drawn = drawMathFormula(surface(), 'M(x) = 12.5x^2 - 3.2x + 1', 40, 100, 20, INK, 140);
    expect(drawn).toBeLessThanOrEqual(140.01);
  });
});

describe('drawMathBlock', () => {
  it('does not throw on Greek, radicals and operators, radical argument included', () => {
    const page = layout();
    expect(() => drawMathBlock(surface(), page, 'L = √(ΔX² + ΔY²) ≤ Σ λ ± ∂ω', 50, 700, 400, 9, INK)).not.toThrow();
  });

  it('wraps a long relation onto more than one line inside a narrow column', () => {
    const page = layout();
    const consumed = drawMathBlock(
      surface(),
      page,
      'M(x) = 12.5x^2 - 3.2x + 1 + Σ F_x - Δθ/dx + κ_1 λ_2 ± ε',
      50, 700, 120, 9, INK,
    );
    // One line at this size/width would be far shorter than two lines' worth of height.
    expect(consumed).toBeGreaterThan(9 * 1.45 * 1.5);
  });

  it('keeps every packed line inside the column, measured the way it is drawn', () => {
    const page = layout();
    // The exact reported overflow: the old packer summed per-atom widths plus a fixed 0.175 em
    // inter-atom guess, so this whole relation "fit" on one line at width 150 and then drew
    // 163.31pt wide. Assert the drawn geometry, not merely that nothing threw.
    const expression = 'P transversal en ξ → P[0, N₁, N₂, 0, N₃, N₄]ᵀ';
    const width = 150;
    const size = 9;
    const indent = size * 1.6;
    const packed = packMathLines(expression, width, size, indent);
    expect(packed.length).toBeGreaterThan(1);
    for (const [index, line] of packed.entries()) {
      const drawn = measureFormula(typesetLatex(translateExpression(line)), size).widthPt;
      expect(drawn).toBeLessThanOrEqual(width - (index === 0 ? 0 : indent) + 0.001);
    }
    expect(() => drawMathBlock(surface(), page, expression, 50, 700, width, size, INK)).not.toThrow();
  });

  it('keeps a radical argument that spans a space on one line, unsplit', () => {
    const page = layout();
    // A width that comfortably fits "L = √(ΔX² + ΔY²)" as one atom but would have split
    // a naive space-based packer between "√(ΔX²" and "+".
    expect(() => drawMathBlock(surface(), page, 'L = √(ΔX² + ΔY²)', 50, 700, 200, 9, INK)).not.toThrow();
  });
});

describe('unparseable expressions degrade instead of aborting the export', () => {
  // `mathTypeset.ts` throws on LaTeX MathJax cannot parse, which is right — but that error must
  // not escape this module: `createCalculationReport` has no handler, so one bad string would
  // abort the whole PDF. A user-entered label really can reach here through `needsMath`:
  // 'A_1_2' translates to 'A_{1}_{2}', a "Double subscripts" error.
  const unparseable = 'A_1_2';

  it('confirms the fixture really is unparseable', () => {
    expect(translateExpression(unparseable)).toBe('A_{1}_{2}');
    expect(() => typesetLatex(translateExpression(unparseable))).toThrow(MathTypesetError);
  });

  it('mathWidth returns a usable plain-text width instead of throwing', () => {
    const width = mathWidth(layout(), unparseable, 9);
    expect(width).toBeGreaterThan(0);
    expect(Number.isFinite(width)).toBe(true);
  });

  it('drawMathFormula draws plain prose and returns the width it consumed', () => {
    let drawn = 0;
    expect(() => { drawn = drawMathFormula(surface(), unparseable, 40, 100, 11, INK); }).not.toThrow();
    expect(drawn).toBeGreaterThan(0);
    expect(Number.isFinite(drawn)).toBe(true);
    expect(drawn).toBeCloseTo(REPORT_FONTS.mathRegular.widthOfTextAtSize('A_1_2', 11), 3);
  });

  it('drawMathBlock consumes real height for a block it cannot typeset', () => {
    const page = layout();
    let consumed = 0;
    expect(() => { consumed = drawMathBlock(surface(), page, unparseable, 50, 700, 200, 9, INK); }).not.toThrow();
    expect(consumed).toBeGreaterThan(0);
    expect(Number.isFinite(consumed)).toBe(true);
  });

  it('degrades only the offending line of an otherwise valid relation', () => {
    const page = layout();
    const good = drawMathBlock(surface(), page, 'M(x) = 12.5x^2', 50, 700, 200, 9, INK);
    const mixed = drawMathBlock(surface(), page, `M(x) = 12.5x^2 + ${unparseable}`, 50, 600, 200, 9, INK);
    expect(mixed).toBeGreaterThanOrEqual(good);
    expect(Number.isFinite(mixed)).toBe(true);
  });

  it('warns once per offending expression rather than swallowing the failure', () => {
    const page = layout();
    // A fixture unique to this test, so the module-level "already warned" set starts empty for it.
    const fresh = 'Z_9_9';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mathWidth(page, fresh, 9);
      mathWidth(page, fresh, 9);
      drawMathFormula(surface(), fresh, 40, 100, 9, INK);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain(fresh);
    } finally {
      warn.mockRestore();
    }
  });
});
