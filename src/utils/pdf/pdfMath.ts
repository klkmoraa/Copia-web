/**
 * Fórmula typesetter over the Times family plus the Adobe Symbol face.
 *
 * `pdf-lib` has no notion of maths, so this module is the whole of it. Three things happen
 * here that plain `layout.text()` cannot do:
 *
 * - **Real symbols.** `mathText` keeps the solver's `Δ`, `√`, `∑` and `≤` instead of spelling
 *   them out, and every character picks its own face at draw time: Symbol for those, italic
 *   Times for latin variables, roman Times for the rest. Symbol is a standard PDF font, so it
 *   costs neither bundle nor document bytes.
 * - **Stacked fractions.** `M/EI` and `dθ/dx` are drawn as a numerator over a denominator,
 *   which is how the reader expects to meet a derivative.
 * - **Wrapping.** `drawMathBlock` breaks a long relation across lines at its operators. The
 *   procedure page used to cut the key equation at 92 characters and append an ellipsis,
 *   sometimes mid-symbol.
 *
 * `^` and `_` raise and lower the glyph that follows, and the size shrinks until the
 * expression fits its box rather than overflowing it.
 */
import { SYMBOL_GLYPHS, mathText, pdfText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';

const normalize = (expression: string): string => mathText(expression).replace(/\*/g, ' × ');

/** Roman for digits and operators, italic for variables, Symbol for Greek and maths. */
const faceFor = (layout: PdfLayout, character: string) => {
  if (SYMBOL_GLYPHS.has(character)) return layout.fonts.mathSymbol;
  return /[A-Za-z]/.test(character) ? layout.fonts.mathItalic : layout.fonts.mathRegular;
};

/**
 * A word is a fraction when it holds exactly one slash between two non-empty operands and
 * neither side carries a bracket. That is deliberately narrow: it catches the solver's
 * `dθ/dx`, `M/EI` and `ΔX/L` and leaves a spaced `||r|| / max(1, ||F||)` inline, where
 * stacking would have to guess at the operands.
 */
const asFraction = (word: string): { numerator: string; denominator: string } | undefined => {
  const parts = word.split('/');
  if (parts.length !== 2) return undefined;
  const [numerator, denominator] = parts;
  if (!numerator || !denominator) return undefined;
  if (/[()[\]]/.test(word)) return undefined;
  return { numerator, denominator };
};

type Segment = { text: string; level: 'base' | 'super' | 'sub' };

/**
 * Splits a run into baseline text and its scripts.
 *
 * A marker claims the whole alphanumeric run that follows it, not a single glyph: the solver
 * writes `d_local`, `f_source`, `U_x` and `N_theta^T`, and lowering only the first letter
 * printed `d` with a subscript `l` followed by a full-size `ocal`. A marker with nothing
 * alphanumeric after it — `10^(-3)` — stays a literal caret.
 */
const segments = (source: string): Segment[] => {
  const parts: Segment[] = [];
  let base = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '^' || character === '_') {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9]/.test(source[end])) end += 1;
      if (end > index + 1) {
        if (base) parts.push({ text: base, level: 'base' });
        base = '';
        parts.push({ text: source.slice(index + 1, end), level: character === '^' ? 'super' : 'sub' });
        index = end - 1;
        continue;
      }
    }
    base += character;
  }
  if (base) parts.push({ text: base, level: 'base' });
  return parts;
};

const SCRIPT_SCALE = 0.64;

const textWidth = (layout: PdfLayout, text: string, size: number): number =>
  Array.from(text).reduce((width, character) => width + faceFor(layout, character).widthOfTextAtSize(character, size), 0);

/** Width of a run, honouring the `^`/`_` markers. */
const runWidth = (layout: PdfLayout, source: string, size: number): number =>
  segments(source).reduce((width, segment) => segment.level === 'base'
    ? width + textWidth(layout, segment.text, size)
    : width + textWidth(layout, segment.text, size * SCRIPT_SCALE) + size * 0.04, 0);

/** Draws a run at `x`/`baseline` and returns the width it consumed. */
const drawRun = (
  layout: PdfLayout,
  source: string,
  x: number,
  baseline: number,
  size: number,
  color: PdfColor,
): number => {
  let cursor = x;
  for (const segment of segments(source)) {
    const scripted = segment.level !== 'base';
    const glyphSize = scripted ? size * SCRIPT_SCALE : size;
    const offset = segment.level === 'super' ? size * 0.43 : segment.level === 'sub' ? -size * 0.25 : 0;
    for (const glyph of segment.text) {
      const face = faceFor(layout, glyph);
      try {
        layout.page.drawText(glyph, { x: cursor, y: baseline + offset, size: glyphSize, font: face, color });
        cursor += face.widthOfTextAtSize(glyph, glyphSize);
      } catch {
        // A glyph the chosen face cannot encode falls back to its spelled-out form rather
        // than aborting the export. `pdfGlyphs.test.ts` keeps this branch unreachable.
        const spelled = pdfText(glyph);
        layout.page.drawText(spelled, { x: cursor, y: baseline + offset, size: glyphSize, font: layout.fonts.mathRegular, color });
        cursor += layout.fonts.mathRegular.widthOfTextAtSize(spelled, glyphSize);
      }
    }
    if (scripted) cursor += size * 0.04;
  }
  return cursor - x;
};

const FRACTION_SCALE = 0.86;

const wordWidth = (layout: PdfLayout, word: string, size: number): number => {
  const fraction = asFraction(word);
  if (!fraction) return runWidth(layout, word, size);
  const scaled = size * FRACTION_SCALE;
  return Math.max(
    runWidth(layout, fraction.numerator, scaled),
    runWidth(layout, fraction.denominator, scaled),
  ) + size * 0.24;
};

const drawWord = (
  layout: PdfLayout,
  word: string,
  x: number,
  baseline: number,
  size: number,
  color: PdfColor,
): number => {
  const fraction = asFraction(word);
  if (!fraction) return drawRun(layout, word, x, baseline, size, color);
  const scaled = size * FRACTION_SCALE;
  const numeratorWidth = runWidth(layout, fraction.numerator, scaled);
  const denominatorWidth = runWidth(layout, fraction.denominator, scaled);
  const inner = Math.max(numeratorWidth, denominatorWidth);
  const total = inner + size * 0.24;
  const left = x + size * 0.12;
  drawRun(layout, fraction.numerator, left + (inner - numeratorWidth) / 2, baseline + size * 0.42, scaled, color);
  layout.page.drawLine({
    start: { x: left, y: baseline + size * 0.30 },
    end: { x: left + inner, y: baseline + size * 0.30 },
    thickness: 0.55,
    color,
  });
  drawRun(layout, fraction.denominator, left + (inner - denominatorWidth) / 2, baseline - size * 0.52, scaled, color);
  return total;
};

const words = (source: string): string[] => source.split(' ').filter((word) => word.length > 0);

export const mathWidth = (layout: PdfLayout, expression: string, size: number): number => {
  const parts = words(normalize(expression));
  if (!parts.length) return 0;
  const spacing = layout.fonts.mathRegular.widthOfTextAtSize(' ', size);
  return parts.reduce((width, word) => width + wordWidth(layout, word, size), 0) + spacing * (parts.length - 1);
};

/**
 * True when the text carries something the prose faces would have to spell out — a Symbol
 * glyph or a Unicode script. Prose without any of that is better left to `wrapText`, which
 * wraps properly and keeps the roman face; only `ΣFx` and `κ₁` need the typesetter.
 */
export const needsMath = (value: string): boolean => mathText(value) !== pdfText(value);

/** True when the expression will stack something above and below its baseline. */
export const hasFraction = (expression: string): boolean => words(normalize(expression)).some((word) => asFraction(word) !== undefined);

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
  const source = normalize(expression);
  let size = requestedSize;
  while (size > 7.5 && mathWidth(layout, source, size) > maxFormulaWidth) size -= 0.4;
  const spacing = layout.fonts.mathRegular.widthOfTextAtSize(' ', size);
  let cursor = x;
  for (const [index, word] of words(source).entries()) {
    if (index > 0) cursor += spacing;
    cursor += drawWord(layout, word, cursor, baseline, size, color);
  }
  return cursor - x;
};

export interface MathBlockOptions {
  /** Extra left offset applied to every line after the first. */
  continuationIndent?: number;
  /** Right-aligned tag, typically an equation number such as `(4)`. */
  tag?: string;
}

/**
 * Draws a relation across as many lines as it needs, starting at `top` and growing downward.
 * Returns the height consumed so the caller can advance its own cursor.
 *
 * Breaks happen between words, so the operators the solver already spaces out — `=`, `+`,
 * `−` — become the fold points without any parsing of precedence.
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
  const source = normalize(expression);
  const parts = words(source);
  if (!parts.length) return 0;
  const indent = options.continuationIndent ?? size * 1.6;
  const spacing = layout.fonts.mathRegular.widthOfTextAtSize(' ', size);

  const lines: string[][] = [];
  let current: string[] = [];
  let currentWidth = 0;
  for (const word of parts) {
    const available = width - (lines.length === 0 ? 0 : indent);
    const advance = (current.length ? spacing : 0) + wordWidth(layout, word, size);
    if (current.length && currentWidth + advance > available) {
      lines.push(current);
      current = [word];
      currentWidth = wordWidth(layout, word, size);
      continue;
    }
    current.push(word);
    currentWidth += advance;
  }
  if (current.length) lines.push(current);

  let consumed = 0;
  for (const [index, line] of lines.entries()) {
    const stacked = line.some((word) => asFraction(word) !== undefined);
    const lineHeight = size * (stacked ? 2.05 : 1.45);
    const baseline = top - consumed - size * (stacked ? 1.15 : 1);
    let cursor = x + (index === 0 ? 0 : indent);
    for (const [wordIndex, word] of line.entries()) {
      if (wordIndex > 0) cursor += spacing;
      cursor += drawWord(layout, word, cursor, baseline, size, color);
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
