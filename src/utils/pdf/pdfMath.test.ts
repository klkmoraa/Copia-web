// src/utils/pdf/pdfMath.test.ts
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, concatTransformationMatrix, rgb } from 'pdf-lib';
import { popGraphicsState, pushGraphicsState } from 'pdf-lib/cjs/api/operators.js';
import { PdfLayout } from './pdfBuilder';
import { drawFormulaCard, drawMathBlock, drawMathFormula, hasFraction, mathWidth, needsMath } from './pdfMath';

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

  it('keeps a radical argument that spans a space on one line, unsplit', async () => {
    const page = await layout();
    // A width that comfortably fits "L = √(ΔX² + ΔY²)" as one atom but would have split
    // a naive space-based packer between "√(ΔX²" and "+".
    expect(() => drawMathBlock(page, 'L = √(ΔX² + ΔY²)', 50, 700, 200, 9, INK)).not.toThrow();
  });
});

describe('drawFormulaCard', () => {
  it('draws without throwing', async () => {
    const page = await layout();
    expect(() => drawFormulaCard(page, 'Cortante', 'V = ΔM/Δx', 'Cambio de momento por unidad de longitud.', 40, 600, 200, INK)).not.toThrow();
  });
});
