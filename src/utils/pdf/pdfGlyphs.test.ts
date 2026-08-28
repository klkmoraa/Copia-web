/**
 * The two sanitisers have opposite jobs, and both have been silently wrong before.
 *
 * `pdfText` must not eat a Spanish accent: WinAnsi carries all of Latin-1, so the report
 * writing «Analisis» and «pagina» was an authoring habit, never a limitation. `mathText`
 * must not spell out a symbol the Symbol face can draw, which is what turned the solver's
 * `L = √(ΔX² + ΔY²)` into `L = sqrt(DeltaX^2 + DeltaY^2)`.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { SYMBOL_GLYPHS, mathText, pdfText } from './pdfGlyphs';

describe('pdfText', () => {
  it('conserva intactas las tildes, la eñe y los signos de Latin-1', () => {
    expect(pdfText('Análisis · cálculo pequeñas ¿qué? ¡90° máximo! ünïcode'))
      .toBe('Análisis  x  cálculo pequeñas ¿qué? ¡90° máximo! ünïcode');
  });

  it('deletrea los símbolos que las caras WinAnsi no pueden dibujar', () => {
    expect(pdfText('L = √(ΔX² + ΔY²)')).toBe('L = sqrt(DeltaX^2 + DeltaY^2)');
  });
});

describe('mathText', () => {
  it('preserva el griego y los operadores para la cara Symbol', () => {
    expect(mathText('L = √(ΔX² + ΔY²)')).toBe('L = √(ΔX^2 + ΔY^2)');
    expect(mathText('dθ/dx = M/EI')).toBe('dθ/dx = M/EI');
    expect(mathText('r ≤ 1 ± ε')).toBe('r ≤ 1 ± ε');
  });

  it('baja los subíndices Unicode del motor en vez de elevarlos', () => {
    // `ᵢ` y `ⱼ` son subíndices Unicode; se mapeaban a `^i`/`^j`, así que los índices de
    // nodo de `ΔX = Xⱼ − Xᵢ` salían impresos como exponentes.
    expect(mathText('ΔX = Xⱼ − Xᵢ')).toBe('ΔX = X_j − X_i');
  });

  it('deletrea lo que Symbol tampoco tiene', () => {
    expect(mathText('⟨a∥b⟩')).toBe('<a||b>');
  });
});

describe('cobertura de la cara Symbol', () => {
  it('codifica cada glifo que mathText le confía', async () => {
    const pdf = await PDFDocument.create();
    const symbol = await pdf.embedFont(StandardFonts.Symbol);
    const unsupported = [...SYMBOL_GLYPHS].filter((glyph) => {
      try {
        symbol.encodeText(glyph);
        return false;
      } catch {
        return true;
      }
    });
    expect(unsupported).toEqual([]);
  });
});
