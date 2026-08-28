/**
 * The text sanitiser should not eat glyphs WinAnsi carries (Latin-1 accents, etc).
 * For formulas, `pdfMath` uses the Symbol face and translates remaining glyphs.
 */
import { describe, expect, it } from 'vitest';
import { pdfText } from './pdfGlyphs';

describe('pdfText', () => {
  it('conserva intactas las tildes, la eñe y los signos de Latin-1', () => {
    expect(pdfText('Análisis · cálculo pequeñas ¿qué? ¡90° máximo! ünïcode'))
      .toBe('Análisis  x  cálculo pequeñas ¿qué? ¡90° máximo! ünïcode');
  });

  it('deletrea los símbolos que las caras WinAnsi no pueden dibujar', () => {
    expect(pdfText('L = √(ΔX² + ΔY²)')).toBe('L = sqrt(DeltaX^2 + DeltaY^2)');
  });
});
