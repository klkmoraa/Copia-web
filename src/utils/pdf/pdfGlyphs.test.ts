/**
 * The text sanitiser should not eat glyphs WinAnsi carries (Latin-1 accents, etc).
 * For formulas, `pdfMath` uses the Symbol face and translates remaining glyphs.
 */
import { describe, expect, it } from 'vitest';
import { pdfText } from './pdfGlyphs';

describe('pdfText', () => {
  it('conserva intactas las tildes, la eñe y los signos de Latin-1', () => {
    // The middle dot is WinAnsi, so it survives as itself: it used to be rewritten to ` x `,
    // which turned `kN·m` into `kN x m` on every unit label in the document.
    expect(pdfText('Análisis · cálculo pequeñas ¿qué? ¡90° máximo! ünïcode'))
      .toBe('Análisis · cálculo pequeñas ¿qué? ¡90° máximo! ünïcode');
  });

  it('pliega el punto medio matemático sobre el de Latin-1 en vez de perderlo', () => {
    expect(pdfText('a ⋅ b')).toBe('a · b');
  });

  it('deletrea los símbolos que las caras WinAnsi no pueden dibujar', () => {
    expect(pdfText('L = √(ΔX² + ΔY²)')).toBe('L = sqrt(DeltaX^2 + DeltaY^2)');
  });
});
