/**
 * Places a `ParsedFormula` (see `mathTypeset.ts`) as real vector marks.
 *
 * MathJax hands over a size-independent tree of glyph outlines and fraction-bar rects in TeX
 * design units; this turns that tree into `SceneMark`s at a chosen size and baseline, which is
 * what both a displayed equation and a typeset table cell are made of.
 *
 * Doing the placement here — rather than handing the renderer a formula and a font size — is
 * what keeps the two sides honest: there is no TeX engine in `python/structureco_report/`, and
 * there must not be, or the same expression could be laid out one way in a Vitest run and
 * another in the browser. The renderer strokes outlines; it never decides where a symbol goes.
 */
import { formulaMarks } from './reportDocument';
import type { ParsedFormula } from './mathTypeset';
import type { SceneMark, Tone } from './reportDocument';
import type { Surface } from './pdfSurface';

export interface FormulaBox {
  widthPt: number;
  heightPt: number;
  depthPt: number;
}

export const measureFormula = (parsed: ParsedFormula, fontSizePt: number): FormulaBox => {
  const unitScale = fontSizePt / 1000;
  return {
    widthPt: parsed.widthUnits * unitScale,
    heightPt: parsed.heightUnits * unitScale,
    depthPt: parsed.depthUnits * unitScale,
  };
};

/** The marks `parsed` occupies with its baseline at `(x, baseline)`. */
export const formulaToMarks = (
  parsed: ParsedFormula,
  x: number,
  baseline: number,
  fontSizePt: number,
  tone: Tone,
): SceneMark[] => formulaMarks(parsed.ops, x, baseline, fontSizePt, tone);

/** Draws `parsed` onto `surface` and returns the width consumed, in points. */
export const drawFormula = (
  surface: Surface,
  parsed: ParsedFormula,
  x: number,
  baseline: number,
  fontSizePt: number,
  tone: Tone,
): number => {
  surface.push(formulaToMarks(parsed, x, baseline, fontSizePt, tone));
  return parsed.widthUnits * (fontSizePt / 1000);
};
