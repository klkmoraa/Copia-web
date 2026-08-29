/**
 * Fórmula typesetting over MathJax's SVG output.
 *
 * The solver's math DSL (`mathLatex.ts`) becomes LaTeX, MathJax lays it out headlessly
 * (`mathTypeset.ts`), and the result is drawn as real vector paths (`mathVector.ts`). This
 * module is now just the seam: it turns a DSL expression and a font size into a width or a
 * drawn box, exactly as it always has, so none of its nine call sites needed to change.
 */
import { atomize, translateExpression } from './mathLatex';
import { MathTypesetError, typesetLatex } from './mathTypeset';
import type { ParsedFormula } from './mathTypeset';
import { drawFormula, measureFormula } from './mathVector';
import { pdfText, wrapText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';

/** Expressions already reported by `safeTypeset`, so one bad string warns once, not per page. */
const warnedExpressions = new Set<string>();

/**
 * Typesets an expression, or returns `null` when MathJax cannot parse it.
 *
 * `mathTypeset.ts` deliberately throws on an unparseable expression rather than letting a
 * corrupt tree reach the page — but a thrown error here would propagate all the way out of
 * `createCalculationReport` and abort the whole document. That is a strictly worse outcome for
 * the reader than one imperfectly-rendered label: everything the engine emits is covered by
 * tests, yet a user-entered member or load-case name can still reach this module through
 * `needsMath` and translate to invalid LaTeX (`A_1_2` becomes `A_{1}_{2}`, a "Double subscripts"
 * error). Every public function in this file therefore degrades to plain `pdfText` prose when
 * this returns `null`.
 *
 * The failure is *not* swallowed: each distinct offending expression is warned about once, so a
 * genuine regression in the engine's own equations still shows up in a dev console and a CI log
 * instead of hiding behind the fallback.
 */
const safeTypeset = (expression: string, display = false): ParsedFormula | null => {
  try {
    return typesetLatex(translateExpression(expression), display);
  } catch (error) {
    if (!(error instanceof MathTypesetError)) throw error;
    if (!warnedExpressions.has(expression)) {
      warnedExpressions.add(expression);
      console.warn(`[pdfMath] «${expression}» no se pudo tipografiar; se dibuja como texto plano. ${error.message}`);
    }
    return null;
  }
};

/**
 * True when the text carries something plain WinAnsi prose can't spell out: Greek, operators,
 * scripts. `translateExpression` joins every word with an explicit `\ ` (TeX ignores bare
 * whitespace between atoms), which by itself makes any multi-word string differ from
 * `pdfText`'s plain spaces — undo just that escaping before comparing, so this only flags text
 * that needed a *substantive* translation (a symbol, script, or fraction), not merely having
 * more than one word.
 */
export const needsMath = (value: string): boolean => translateExpression(value).split('\\ ').join(' ') !== pdfText(value);

/**
 * True when the expression will stack something above and below its baseline.
 *
 * Matches `\dfrac` as well as `\frac`: quotients are set in display style now, and a block
 * measured as a single-height line would have its next neighbour drawn over its denominator.
 */
export const hasFraction = (expression: string): boolean => /\\d?frac\{/.test(translateExpression(expression));

export const mathWidth = (layout: PdfLayout, expression: string, size: number): number => {
  const parsed = safeTypeset(expression);
  if (!parsed) return layout.fonts.mathRegular.widthOfTextAtSize(pdfText(expression), size);
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
  const parsed = safeTypeset(expression);
  if (!parsed) {
    // Plain-prose fallback, shrinking on the same schedule the vector path uses.
    const text = pdfText(expression);
    const font = layout.fonts.mathRegular;
    let plainSize = requestedSize;
    while (plainSize > 7.5 && font.widthOfTextAtSize(text, plainSize) > maxFormulaWidth) plainSize -= 0.4;
    layout.page.drawText(text, { x, y: baseline, size: plainSize, font, color });
    return font.widthOfTextAtSize(text, plainSize);
  }
  let size = requestedSize;
  while (size > 7.5 && measureFormula(parsed, size).widthPt > maxFormulaWidth) size -= 0.4;
  return drawFormula(layout.page, layout.vectorOps, parsed, x, baseline, size, color);
};

export interface MathBlockOptions {
  /** Extra left offset applied to every line after the first. */
  continuationIndent?: number;
  /** Right-aligned tag, typically an equation number such as `(4)`. */
  tag?: string;
}

/**
 * Packs `expression` into as many lines as `width` needs, returning each line as its own
 * expression string (exported so the geometry can be asserted directly in tests).
 *
 * Breaks at atom boundaries (`mathLatex.ts`'s `atomize`, not a bare space split) so a `√(...)`
 * whose argument spans a space never gets its radical bar cut across a line break.
 *
 * Each *candidate* line is measured exactly the way `drawMathBlock` will render it — by
 * typesetting the joined LaTeX — rather than by summing per-atom widths plus a guessed
 * inter-atom space. Summing underestimated the drawn width by 8-16%: TeX's `\ ` (≈0.333 em,
 * what `translateExpression` joins words with) is roughly double the 0.175 em the old heuristic
 * assumed, and TeX's own spacing around relations and operators only exists once the whole line
 * is typeset together, never when atoms are measured one at a time. Real solver equations
 * therefore overflowed their column. Re-measuring the growing candidate on every atom is O(n²)
 * in atoms per line, but `typesetLatex` is memoised by LaTeX string and equations run ~10-20
 * atoms, so the cost is negligible.
 *
 * An unparseable candidate falls back to a crude character-count estimate rather than failing:
 * `drawMathBlock` draws such an expression as plain prose anyway (see `safeTypeset`), so the
 * packing only has to stay finite and roughly sane.
 */
export const packMathLines = (expression: string, width: number, size: number, indent: number): string[] => {
  const atoms = atomize(expression);
  if (!atoms.length) return [];

  const lineWidth = (line: readonly string[]): number => {
    const joined = line.join(' ');
    const parsed = safeTypeset(joined);
    if (!parsed) return pdfText(joined).length * size * 0.5;
    return measureFormula(parsed, size).widthPt;
  };

  const lines: string[][] = [];
  let current: string[] = [];
  for (const atom of atoms) {
    const available = width - (lines.length === 0 ? 0 : indent);
    const candidate = [...current, atom];
    if (current.length && lineWidth(candidate) > available) {
      lines.push(current);
      current = [atom];
      continue;
    }
    current = candidate;
  }
  if (current.length) lines.push(current);
  return lines.map((line) => line.join(' '));
};

/**
 * Draws a relation across as many lines as it needs, starting at `top` and growing downward.
 * Returns the height consumed so the caller can advance its own cursor.
 *
 * Each packed line is re-typeset as one LaTeX string at draw time, so inter-symbol spacing
 * within a line comes from MathJax's own spacing rules rather than a fixed-width space glyph —
 * and, since `packMathLines` measured that very same joined string, what fits is what is drawn.
 *
 * A line MathJax cannot parse is drawn as plain prose instead of aborting the document (see
 * `safeTypeset`). The fallback is per line, not per block, so one unparseable fragment of a long
 * relation costs only its own line.
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
  const indent = options.continuationIndent ?? size * 1.6;
  const lines = packMathLines(expression, width, size, indent);
  if (!lines.length) return 0;

  let consumed = 0;
  for (const [index, lineExpression] of lines.entries()) {
    const cursor = x + (index === 0 ? 0 : indent);
    const parsed = safeTypeset(lineExpression);
    let baseline: number;
    if (parsed) {
      const box = measureFormula(parsed, size);
      baseline = top - consumed - Math.max(size, box.heightPt);
      drawFormula(layout.page, layout.vectorOps, parsed, cursor, baseline, size, color);
      consumed += size * (hasFraction(lineExpression) ? 2.05 : 1.45);
    } else {
      // The packer only had a character-count estimate for this line, so re-wrap it against the
      // real font rather than trusting that estimate to have kept it inside the column.
      const wrapped = wrapText(lineExpression, layout.fonts.regular, size, width - (index === 0 ? 0 : indent));
      baseline = top - consumed - size;
      for (const text of wrapped.length ? wrapped : [pdfText(lineExpression)]) {
        baseline = top - consumed - size;
        layout.page.drawText(text, { x: cursor, y: baseline, size, font: layout.fonts.regular, color });
        consumed += size * 1.45;
      }
    }
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

/**
 * The same seam, for LaTeX that a caller has already assembled.
 *
 * `pdfEquation.ts` builds an `aligned` environment out of several translated relations, which
 * is LaTeX structure rather than solver notation — running it back through
 * `translateExpression` would escape its own backslashes. These two functions are that path,
 * and they typeset in display style, which is what a numbered relation on its own line is.
 */
const safeTypesetLatex = (latex: string): ParsedFormula | null => {
  try {
    return typesetLatex(latex, true);
  } catch (error) {
    if (!(error instanceof MathTypesetError)) throw error;
    if (!warnedExpressions.has(latex)) {
      warnedExpressions.add(latex);
      console.warn(`[pdfMath] el bloque «${latex}» no se pudo tipografiar; se dibuja en una sola línea. ${error.message}`);
    }
    return null;
  }
};

/** Drawn width of already-built LaTeX, or `Infinity` when it cannot be typeset at all. */
export const rawMathWidth = (latex: string, size: number): number => {
  const parsed = safeTypesetLatex(latex);
  return parsed ? measureFormula(parsed, size).widthPt : Number.POSITIVE_INFINITY;
};

/**
 * Draws already-built LaTeX as one indivisible box, and returns the height it consumed.
 *
 * Unlike `drawMathBlock` this never wraps: an `aligned` environment is a single box whose whole
 * point is that its rows line up, so a caller that does not have room for it falls back to the
 * one-line form rather than asking for it to be broken.
 */
export const drawRawMath = (
  layout: PdfLayout,
  latex: string,
  x: number,
  top: number,
  width: number,
  size: number,
  color: PdfColor,
  tag?: string,
): number => {
  const parsed = safeTypesetLatex(latex);
  if (!parsed) return 0;
  const box = measureFormula(parsed, size);
  const baseline = top - box.heightPt;
  drawFormula(layout.page, layout.vectorOps, parsed, x, baseline, size, color);
  if (tag) {
    const text = pdfText(tag);
    const tagWidth = layout.fonts.mathRegular.widthOfTextAtSize(text, size * 0.9);
    // Beside the vertical centre of the block, not its last row: the number tags the whole
    // relation, and hanging it off the bottom row reads as numbering that row alone.
    layout.page.drawText(text, {
      x: x + width - tagWidth,
      y: baseline + box.heightPt / 2 - size * 0.35,
      size: size * 0.9,
      font: layout.fonts.mathRegular,
      color,
    });
  }
  return box.heightPt + box.depthPt + size * 0.45;
};
