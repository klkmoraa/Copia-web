// src/utils/pdf/pdfMath.test.ts
import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb } from 'pdf-lib';
import { PdfLayout } from './pdfBuilder';
import { translateExpression } from './mathLatex';
import { MathTypesetError, typesetLatex } from './mathTypeset';
import { measureFormula } from './mathVector';
import { drawFormulaCard, drawMathBlock, drawMathFormula, hasFraction, mathWidth, needsMath, packMathLines } from './pdfMath';

const INK = rgb(0.1, 0.1, 0.1);
const vectorOps = { concatTransformationMatrix, pushGraphicsState, popGraphicsState };

const layout = async () => {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mathRegular: await pdf.embedFont(StandardFonts.TimesRoman),
    mathItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    mathSymbol: await pdf.embedFont(StandardFonts.Symbol),
  };
  return new PdfLayout(pdf, fonts, { forest: rgb(0, 0, 0) } as never, rgb, vectorOps);
};

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
  it('grows with font size and matches what gets drawn', async () => {
    const page = await layout();
    const small = mathWidth(page, 'M(x) = 12.5x^2', 8);
    const large = mathWidth(page, 'M(x) = 12.5x^2', 16);
    expect(large).toBeGreaterThan(small);
    const drawn = drawMathFormula(page, 'M(x) = 12.5x^2', 40, 100, 11, INK);
    expect(drawn).toBeCloseTo(mathWidth(page, 'M(x) = 12.5x^2', 11), 3);
  });

  it('shrinks to fit a maxFormulaWidth rather than overflowing it', async () => {
    const page = await layout();
    // MathJax's real glyph metrics run wider than the old hand-rolled ones did, so the target
    // here sits above the shrink loop's readability floor (~7.5pt) — this exercises the loop
    // actually converging on the requested width, not just bottoming out at the floor.
    const drawn = drawMathFormula(page, 'M(x) = 12.5x^2 - 3.2x + 1', 40, 100, 20, INK, 140);
    expect(drawn).toBeLessThanOrEqual(140.01);
  });
});

describe('drawMathBlock', () => {
  it('does not throw on Greek, radicals and operators, radical argument included', async () => {
    const page = await layout();
    expect(() => drawMathBlock(page, 'L = √(ΔX² + ΔY²) ≤ Σ λ ± ∂ω', 50, 700, 400, 9, INK)).not.toThrow();
  });

  it('wraps a long relation onto more than one line inside a narrow column', async () => {
    const page = await layout();
    const consumed = drawMathBlock(
      page,
      'M(x) = 12.5x^2 - 3.2x + 1 + Σ F_x - Δθ/dx + κ_1 λ_2 ± ε',
      50, 700, 120, 9, INK,
    );
    // One line at this size/width would be far shorter than two lines' worth of height.
    expect(consumed).toBeGreaterThan(9 * 1.45 * 1.5);
  });

  it('keeps every packed line inside the column, measured the way it is drawn', async () => {
    const page = await layout();
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
    expect(() => drawMathBlock(page, expression, 50, 700, width, size, INK)).not.toThrow();
  });

  it('keeps a radical argument that spans a space on one line, unsplit', async () => {
    const page = await layout();
    // A width that comfortably fits "L = √(ΔX² + ΔY²)" as one atom but would have split
    // a naive space-based packer between "√(ΔX²" and "+".
    expect(() => drawMathBlock(page, 'L = √(ΔX² + ΔY²)', 50, 700, 200, 9, INK)).not.toThrow();
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

  it('mathWidth returns a usable plain-text width instead of throwing', async () => {
    const page = await layout();
    const width = mathWidth(page, unparseable, 9);
    expect(width).toBeGreaterThan(0);
    expect(Number.isFinite(width)).toBe(true);
  });

  it('drawMathFormula draws plain prose and returns the width it consumed', async () => {
    const page = await layout();
    let drawn = 0;
    expect(() => { drawn = drawMathFormula(page, unparseable, 40, 100, 11, INK); }).not.toThrow();
    expect(drawn).toBeGreaterThan(0);
    expect(Number.isFinite(drawn)).toBe(true);
    expect(drawn).toBeCloseTo(page.fonts.mathRegular.widthOfTextAtSize('A_1_2', 11), 3);
  });

  it('drawMathBlock consumes real height for a block it cannot typeset', async () => {
    const page = await layout();
    let consumed = 0;
    expect(() => { consumed = drawMathBlock(page, unparseable, 50, 700, 200, 9, INK); }).not.toThrow();
    expect(consumed).toBeGreaterThan(0);
    expect(Number.isFinite(consumed)).toBe(true);
  });

  it('degrades only the offending line of an otherwise valid relation', async () => {
    const page = await layout();
    const good = drawMathBlock(page, 'M(x) = 12.5x^2', 50, 700, 200, 9, INK);
    const mixed = drawMathBlock(page, `M(x) = 12.5x^2 + ${unparseable}`, 50, 600, 200, 9, INK);
    expect(mixed).toBeGreaterThanOrEqual(good);
    expect(Number.isFinite(mixed)).toBe(true);
  });

  it('warns once per offending expression rather than swallowing the failure', async () => {
    const page = await layout();
    // A fixture unique to this test, so the module-level "already warned" set starts empty for it.
    const fresh = 'Z_9_9';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mathWidth(page, fresh, 9);
      mathWidth(page, fresh, 9);
      drawMathFormula(page, fresh, 40, 100, 9, INK);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain(fresh);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('drawFormulaCard', () => {
  it('draws without throwing', async () => {
    const page = await layout();
    expect(() => drawFormulaCard(page, 'Cortante', 'V = ΔM/Δx', 'Cambio de momento por unidad de longitud.', 40, 600, 200, INK)).not.toThrow();
  });
});
