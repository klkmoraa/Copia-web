/**
 * Fórmula typesetting over MathJax's SVG output.
 *
 * The solver's math DSL (`mathLatex.ts`) becomes LaTeX, MathJax lays it out headlessly
 * (`mathTypeset.ts`), and the result is drawn as real vector paths (`mathVector.ts`). This
 * module is now just the seam: it turns a DSL expression and a font size into a width or a
 * drawn box, exactly as it always has, so none of its nine call sites needed to change.
 */
import { atomize, translateExpression } from './mathLatex';
import { typesetLatex } from './mathTypeset';
import { drawFormula, measureFormula } from './mathVector';
import { pdfText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';

/** True when the text carries something plain WinAnsi prose can't spell out: Greek, operators, scripts. */
export const needsMath = (value: string): boolean => translateExpression(value) !== pdfText(value);

/** True when the expression will stack something above and below its baseline. */
export const hasFraction = (expression: string): boolean => /\\frac\{/.test(translateExpression(expression));

export const mathWidth = (_layout: PdfLayout, expression: string, size: number): number => {
  const parsed = typesetLatex(translateExpression(expression));
  return measureFormula(parsed, size).widthPt;
};

/** Draws the expression on one line at `x`/`baseline` and returns the width it consumed. */
export const drawMathFormula = (
  layout: PdfLayout,
  expression: string,
  x: number,
  baseline: number,
  requestedSize: number,
  color: PdfColor,
  maxFormulaWidth = Number.POSITIVE_INFINITY,
): number => {
  const parsed = typesetLatex(translateExpression(expression));
  let size = requestedSize;
  while (size > 7.5 && measureFormula(parsed, size).widthPt > maxFormulaWidth) size -= 0.4;
  return drawFormula(layout.page, parsed, x, baseline, size, color);
};

export interface MathBlockOptions {
  /** Extra left offset applied to every line after the first. */
  continuationIndent?: number;
  /** Right-aligned tag, typically an equation number such as `(4)`. */
  tag?: string;
}

const atomWidth = (size: number, atom: string): number => measureFormula(typesetLatex(translateExpression(atom)), size).widthPt;

/**
 * Draws a relation across as many lines as it needs, starting at `top` and growing downward.
 * Returns the height consumed so the caller can advance its own cursor.
 *
 * Packs at atom boundaries (`mathLatex.ts`'s `atomize`, not a bare space split) so a `√(...)`
 * whose argument spans a space never gets its radical bar cut across a line break. Each packed
 * line is re-typeset as one LaTeX string at draw time, so inter-symbol spacing within a line
 * comes from MathJax's own spacing rules rather than a fixed-width space glyph.
 */
export const drawMathBlock = (
  layout: PdfLayout,
  expression: string,
  x: number,
  top: number,
  width: number,
  size: number,
  color: PdfColor,
  options: MathBlockOptions = {},
): number => {
  const atoms = atomize(expression);
  if (!atoms.length) return 0;
  const indent = options.continuationIndent ?? size * 1.6;
  const spaceWidth = atomWidth(size, 'x') * 0.35;

  const lines: string[][] = [];
  let current: string[] = [];
  let currentWidth = 0;
  for (const atom of atoms) {
    const available = width - (lines.length === 0 ? 0 : indent);
    const advance = (current.length ? spaceWidth : 0) + atomWidth(size, atom);
    if (current.length && currentWidth + advance > available) {
      lines.push(current);
      current = [atom];
      currentWidth = atomWidth(size, atom);
      continue;
    }
    current.push(atom);
    currentWidth += advance;
  }
  if (current.length) lines.push(current);

  let consumed = 0;
  for (const [index, line] of lines.entries()) {
    const lineExpression = line.join(' ');
    const parsed = typesetLatex(translateExpression(lineExpression));
    const box = measureFormula(parsed, size);
    const stacked = hasFraction(lineExpression);
    const lineHeight = size * (stacked ? 2.05 : 1.45);
    const baseline = top - consumed - Math.max(size, box.heightPt);
    const cursor = x + (index === 0 ? 0 : indent);
    drawFormula(layout.page, parsed, cursor, baseline, size, color);
    if (options.tag && index === lines.length - 1) {
      const tag = pdfText(options.tag);
      const tagWidth = layout.fonts.mathRegular.widthOfTextAtSize(tag, size * 0.9);
      layout.page.drawText(tag, {
        x: x + width - tagWidth,
        y: baseline,
        size: size * 0.9,
        font: layout.fonts.mathRegular,
        color,
      });
    }
    consumed += lineHeight;
  }
  return consumed;
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
