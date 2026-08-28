/**
 * Draws a `ParsedFormula` (see `mathTypeset.ts`) into a `pdf-lib` page as real vector paths.
 *
 * `pdf-lib`'s `drawSvgPath(d, {x,y,scale})` hard-codes an internal `scale(s,-s)`, so it cannot
 * take an independent transform per axis on its own. Every glyph here is drawn by concatenating
 * the formula's own composed matrix as an *outer* transform (via `pushOperators` +
 * `concatTransformationMatrix`) and then calling `drawSvgPath` with the identity — the outer
 * concat supplies the real placement, and `drawSvgPath`'s own flip is folded into that
 * derivation rather than fought after the fact. See the plan this module was built from
 * (`docs/superpowers/plans/2026-08-28-pdf-formulas-mathjax-vector.md`) for the worked-through
 * derivation and the rendered proof it was checked against.
 */
import type { PDFPage } from 'pdf-lib';
import type { AffineMatrix, FormulaOp, ParsedFormula } from './mathTypeset';
import type { PdfColor, PdfVectorOps } from './reportContext';

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

const pdfPoint = (matrix: AffineMatrix, localX: number, localY: number, unitScale: number, baselineX: number, baselineY: number) => ({
  x: baselineX + unitScale * (matrix.a * localX + matrix.e),
  y: baselineY + unitScale * (-matrix.d * localY - matrix.f),
});

const drawPathOp = (
  page: PDFPage,
  ops: PdfVectorOps,
  op: Extract<FormulaOp, { kind: 'path' }>,
  unitScale: number,
  baselineX: number,
  baselineY: number,
  color: PdfColor,
): void => {
  const sx = op.matrix.a * unitScale;
  const sy = op.matrix.d * unitScale;
  const tx = baselineX + op.matrix.e * unitScale;
  const ty = baselineY - op.matrix.f * unitScale;
  page.pushOperators(ops.pushGraphicsState(), ops.concatTransformationMatrix(sx, 0, 0, sy, tx, ty));
  page.drawSvgPath(op.path, { x: 0, y: 0, scale: 1, color });
  page.pushOperators(ops.popGraphicsState());
};

const drawRectOp = (
  page: PDFPage,
  op: Extract<FormulaOp, { kind: 'rect' }>,
  unitScale: number,
  baselineX: number,
  baselineY: number,
  color: PdfColor,
): void => {
  const corner1 = pdfPoint(op.matrix, op.x, op.y, unitScale, baselineX, baselineY);
  const corner2 = pdfPoint(op.matrix, op.x + op.width, op.y + op.height, unitScale, baselineX, baselineY);
  page.drawRectangle({
    x: Math.min(corner1.x, corner2.x),
    y: Math.min(corner1.y, corner2.y),
    width: Math.abs(corner2.x - corner1.x),
    height: Math.abs(corner2.y - corner1.y),
    color,
  });
};

/** Draws `parsed` with its baseline at `(x, baseline)` and returns the width consumed, in points. */
export const drawFormula = (
  page: PDFPage,
  ops: PdfVectorOps,
  parsed: ParsedFormula,
  x: number,
  baseline: number,
  fontSizePt: number,
  color: PdfColor,
): number => {
  const unitScale = fontSizePt / 1000;
  for (const op of parsed.ops) {
    if (op.kind === 'path') drawPathOp(page, ops, op, unitScale, x, baseline, color);
    else drawRectOp(page, op, unitScale, x, baseline, color);
  }
  return parsed.widthUnits * unitScale;
};
