/**
 * Minimal formula typesetter over the Times family.
 *
 * `pdf-lib` has no notion of maths, so superscripts and subscripts are written character by
 * character: `^` and `_` raise or lower the next glyph, letters go italic, everything else
 * roman. The size shrinks until the expression fits the box instead of overflowing it.
 */
import { pdfText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';

const normalize = (expression: string): string => pdfText(expression).replace(/\*/g, ' x ');

export const mathWidth = (layout: PdfLayout, expression: string, size: number): number => {
  const { mathRegular, mathItalic } = layout.fonts;
  const source = normalize(expression);
  let width = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if ((character === '^' || character === '_') && source[index + 1]) {
      const script = source[index + 1];
      const scriptFont = /[A-Za-z]/.test(script) ? mathItalic : mathRegular;
      width += scriptFont.widthOfTextAtSize(script, size * 0.64) + size * 0.04;
      index += 1;
    } else {
      const characterFont = /[A-Za-z]/.test(character) ? mathItalic : mathRegular;
      width += characterFont.widthOfTextAtSize(character, size);
    }
  }
  return width;
};

/** Draws the expression at `x`/`baseline` and returns the width it consumed. */
export const drawMathFormula = (
  layout: PdfLayout,
  expression: string,
  x: number,
  baseline: number,
  requestedSize: number,
  color: PdfColor,
  maxFormulaWidth = Number.POSITIVE_INFINITY,
): number => {
  const { mathRegular, mathItalic } = layout.fonts;
  const source = normalize(expression);
  let size = requestedSize;
  while (size > 7.5 && mathWidth(layout, source, size) > maxFormulaWidth) size -= 0.4;
  let cursor = x;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if ((character === '^' || character === '_') && source[index + 1]) {
      const script = source[index + 1];
      const scriptSize = size * 0.64;
      const scriptFont = /[A-Za-z]/.test(script) ? mathItalic : mathRegular;
      layout.page.drawText(script, {
        x: cursor,
        y: baseline + (character === '^' ? size * 0.43 : -size * 0.25),
        size: scriptSize,
        font: scriptFont,
        color,
      });
      cursor += scriptFont.widthOfTextAtSize(script, scriptSize) + size * 0.04;
      index += 1;
      continue;
    }
    const characterFont = /[A-Za-z]/.test(character) ? mathItalic : mathRegular;
    layout.page.drawText(character, { x: cursor, y: baseline, size, font: characterFont, color });
    cursor += characterFont.widthOfTextAtSize(character, size);
  }
  return cursor - x;
};

/** Titled card holding one governing relation and its plain-language reading. */
export const drawFormulaCard = (
  layout: PdfLayout,
  label: string,
  expression: string,
  explanation: string,
  x: number,
  bottom: number,
  width: number,
  color: PdfColor,
): void => {
  const { page, rgb, fonts } = layout;
  page.drawRectangle({ x, y: bottom, width, height: 54, color: rgb(0.975, 0.985, 0.98), borderColor: color, borderWidth: 0.65 });
  page.drawText(pdfText(label.toUpperCase()), { x: x + 10, y: bottom + 39, size: 6.3, font: fonts.bold, color });
  drawMathFormula(layout, expression, x + 10, bottom + 21, 11.2, rgb(0.10, 0.15, 0.12), width - 20);
  page.drawText(pdfText(explanation), { x: x + 10, y: bottom + 7, size: 6.2, font: fonts.regular, color: rgb(0.37, 0.43, 0.39) });
};
