/**
 * What the formula typesetter promises: a fraction is stacked, a long relation folds instead
 * of being clipped, and the Symbol face is actually reached for the glyphs that need it.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PdfLayout } from './pdfBuilder';
import { drawMathBlock, drawMathFormula, hasFraction, mathWidth } from './pdfMath';
import type { ReportFonts, ReportPalette } from './reportContext';

const layout = async (): Promise<PdfLayout> => {
  const doc = await PDFDocument.create();
  const fonts: ReportFonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mathRegular: await doc.embedFont(StandardFonts.TimesRoman),
    mathItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    mathSymbol: await doc.embedFont(StandardFonts.Symbol),
  };
  const palette: ReportPalette = {
    forest: rgb(0.07, 0.38, 0.21),
    forestDeep: rgb(0.04, 0.24, 0.14),
    forestSoft: rgb(0.86, 0.95, 0.89),
    ink: rgb(0.12, 0.16, 0.22),
    rule: rgb(0.73, 0.78, 0.84),
    white: rgb(1, 1, 1),
    quantity: { axial: rgb(0, 0, 1), shear: rgb(0, 1, 0), moment: rgb(1, 0, 0) },
  };
  return new PdfLayout(doc, fonts, palette, rgb);
};

const INK = rgb(0, 0, 0);

describe('fracciones', () => {
  it('apila una razón simple y una derivada', async () => {
    expect(hasFraction('dθ/dx = M/EI')).toBe(true);
    expect(hasFraction('c = ΔX/L')).toBe(true);
  });

  it('deja en línea lo que no puede resolver sin adivinar los operandos', async () => {
    // Espaciada y con paréntesis: apilarla exigiría decidir dónde acaba el numerador.
    expect(hasFraction('||r||inf / max(1, ||F||inf)')).toBe(false);
    expect(hasFraction('a/b/c')).toBe(false);
  });

  it('reserva el ancho del operando mayor, no la suma de los dos', async () => {
    const page = await layout();
    const stacked = mathWidth(page, 'ΔXX/L', 10);
    const inline = mathWidth(page, 'ΔXX L', 10);
    expect(stacked).toBeLessThan(inline);
  });
});

describe('drawMathBlock', () => {
  it('envuelve una relación larga en varias líneas en vez de recortarla', async () => {
    const page = await layout();
    const long = 'f_source = integral(N^T q dx) + sum(N^T P) + sum(N_theta^T M) + Delta f_member';
    const narrow = drawMathBlock(page, long, 50, 700, 120, 9, INK);
    const wide = drawMathBlock(page, long, 50, 700, 460, 9, INK);
    expect(narrow).toBeGreaterThan(wide);
    expect(wide).toBeGreaterThan(0);
  });

  it('reserva más alto cuando la línea apila una fracción', async () => {
    const page = await layout();
    const plain = drawMathBlock(page, 'V = 32.5 - 5 s', 50, 700, 400, 9, INK);
    const stacked = drawMathBlock(page, 'dV = 32.5 - 5 s', 50, 700, 400, 9, INK);
    const fraction = drawMathBlock(page, 'dV/dx = q', 50, 700, 400, 9, INK);
    expect(stacked).toBe(plain);
    expect(fraction).toBeGreaterThan(plain);
  });

  it('no lanza al dibujar griego, radicales y operadores', async () => {
    const page = await layout();
    expect(() => drawMathBlock(page, 'L = √(ΔX² + ΔY²) ≤ Σ λ ± ∂ω', 50, 700, 400, 9, INK)).not.toThrow();
  });
});

describe('drawMathFormula', () => {
  it('encoge la expresión hasta que cabe en su caja', async () => {
    const page = await layout();
    const width = drawMathFormula(page, 'M_max = w L^2 / 8 + P a b / L', 50, 700, 14, INK, 90);
    expect(width).toBeLessThanOrEqual(90);
  });
});
