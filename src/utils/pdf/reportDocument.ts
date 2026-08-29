/**
 * The normalized report document: what TypeScript hands to ReportLab.
 *
 * The split this file defines is the whole point of the 0.8.4 migration. Everything that
 * *decides* — which parts the document has, what each table says, where a load arrow points,
 * how a formula is typeset — stays in TypeScript, beside the solver whose numbers it reports.
 * Everything that *draws* — pagination, the running head, a table's column widths, a glyph on
 * a page — moved to `python/structureco_report/`, which reads this structure and nothing else.
 *
 * Two properties make that seam hold:
 *
 * - **It is plain JSON.** No functions, no colours as objects, no font handles. A tone is a
 *   token name (`'accent'`), a face is a name (`'bold'`), a length is a number in PDF points.
 *   `JSON.stringify` on a `ReportDocument` is exactly what the renderer parses.
 * - **It is pagination-independent.** Nothing here mentions a page. Blocks flow, and the
 *   renderer breaks them; a figure's marks are in *figure-local* coordinates — origin at the
 *   bottom-left of the reserved rectangle — so a drawing composed here is unaffected by where
 *   the renderer eventually lands it.
 *
 * The IR is deliberately semantic where a component can own the decision (a table is columns
 * and rows, never lines and glyphs) and vector where the drawing is the decision (a free-body
 * scene is marks, because *which* marks and *where* is structural reasoning, not layout).
 */

import type { FormulaOp } from './mathTypeset';
import type { ReportTokenName } from './pdfTheme';

/** A colour, named by its role in `pdfTheme.REPORT_TOKENS`. Never a literal. */
export type Tone = ReportTokenName;

/** The three faces the document owns, named rather than embedded. */
export type FaceName = 'regular' | 'bold' | 'mathRegular';

export type HeadingLevel = 1 | 2 | 3;
export type CalloutTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
export type Align = 'left' | 'right';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------------------
// Vector marks — the vocabulary of a figure
// ---------------------------------------------------------------------------------------

/**
 * One mark of a drawing, in figure-local points.
 *
 * These are the primitives the technical drawings are built from, and they are intentionally
 * few: a scene that needs a support glyph asks for `support`, not for the seven lines a
 * support happens to be made of, so the glyph is defined once — in `scene.py` — and every
 * drawing in the report spells it the same way.
 */
export type SceneMark =
  | { readonly t: 'line'; readonly from: Point; readonly to: Point; readonly tone: Tone; readonly width?: number; readonly dash?: readonly [number, number]; readonly opacity?: number }
  | { readonly t: 'polyline'; readonly points: readonly Point[]; readonly tone: Tone; readonly width?: number; readonly dash?: readonly [number, number]; readonly opacity?: number }
  | { readonly t: 'rect'; readonly rect: Rect; readonly fill?: Tone; readonly stroke?: Tone; readonly width?: number; readonly opacity?: number }
  | { readonly t: 'circle'; readonly at: Point; readonly radius: number; readonly fill?: Tone; readonly stroke?: Tone; readonly width?: number; readonly opacity?: number }
  | { readonly t: 'text'; readonly at: Point; readonly text: string; readonly size: number; readonly tone: Tone; readonly face?: FaceName; readonly align?: Align }
  /** A glyph outline from the math typesetter, already placed and scaled. */
  | { readonly t: 'glyph'; readonly path: string; readonly matrix: readonly [number, number, number, number, number, number]; readonly tone: Tone };

// ---------------------------------------------------------------------------------------
// Blocks — the flow of a part
// ---------------------------------------------------------------------------------------

export interface TableColumn {
  readonly header: string;
  /** Fixed width in points. Wins over `flex`. */
  readonly width?: number;
  /** Share of the width left over by the fixed columns. Defaults to 1. */
  readonly flex?: number;
  readonly align?: Align;
  /** Render this column's cells through the math typesetter when they need it. */
  readonly math?: boolean;
}

/** A cell the typesetter claimed: pre-laid glyphs plus the box they occupy. */
export interface TypesetCell {
  readonly marks: readonly SceneMark[];
  readonly width: number;
  readonly height: number;
}

export interface Metric {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly tone?: Tone;
}

/**
 * A typeset relation: the glyph outlines, the box, and the tag that numbers it.
 *
 * The marks are already folded into as many lines as the measure needed and placed relative to
 * the block's own top-left, so the renderer never re-typesets — it has no TeX engine, and the
 * report's math must read identically whether it was composed in a test or in the browser.
 */
export interface EquationBlock {
  readonly kind: 'equation';
  readonly marks: readonly SceneMark[];
  readonly height: number;
  readonly indent: number;
  readonly tag?: string;
  readonly tagTone: Tone;
  readonly tagSize: number;
}

export type Block =
  | { readonly kind: 'heading'; readonly text: string; readonly level: HeadingLevel }
  | { readonly kind: 'text'; readonly text: string; readonly size: number; readonly face: FaceName; readonly tone: Tone; readonly indent: number }
  | { readonly kind: 'label'; readonly text: string; readonly tone: Tone }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  | { readonly kind: 'keyValues'; readonly entries: readonly (readonly [string, string])[]; readonly labelWidth: number }
  | { readonly kind: 'metrics'; readonly items: readonly Metric[] }
  | { readonly kind: 'callout'; readonly tone: CalloutTone; readonly title: string; readonly body: string }
  | { readonly kind: 'rule'; readonly tone: Tone; readonly width: number }
  | { readonly kind: 'gap'; readonly units: number }
  | {
    readonly kind: 'table';
    readonly columns: readonly TableColumn[];
    readonly rows: readonly (readonly string[])[];
    /** `rowIndex -> columnIndex -> cell`, for the columns the typesetter claimed. */
    readonly typeset: Readonly<Record<string, TypesetCell>>;
    readonly size: number;
    readonly indent: number;
    readonly zebra: boolean;
  }
  | {
    readonly kind: 'figure';
    readonly number: number;
    readonly height: number;
    readonly caption?: string;
    readonly marks: readonly SceneMark[];
  }
  | EquationBlock;

// ---------------------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------------------

/** A numbered part, or the front matter that is listed but not numbered. */
export interface DocumentPart {
  readonly title: string;
  /** `1`, `2`… in reading order. */
  readonly number: number;
  readonly standfirst?: string;
  readonly blocks: readonly Block[];
}

/** The cover's identity block: what this document is, and of what. */
export interface CoverPage {
  readonly documentTitle: string;
  readonly projectName: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly noticeTitle: string;
  readonly notice: string;
}

export interface DocumentMetadata {
  readonly title: string;
  readonly author: string;
  readonly subject: string;
  readonly keywords: readonly string[];
  readonly producer: string;
  readonly creator: string;
  readonly language: string;
  /** ISO instant every date in the file is stamped with, so an export is reproducible. */
  readonly stampedAt: string;
}

/** The portable payload, attached so the report can be re-imported without OCR. */
export interface DocumentAttachment {
  readonly filename: string;
  readonly mimeType: string;
  readonly description: string;
  readonly text: string;
}

export interface ReportDocument {
  readonly version: 1;
  readonly page: { readonly width: number; readonly height: number; readonly margin: number };
  readonly cover: CoverPage;
  readonly contentsTitle: string;
  readonly runningTitle: string;
  readonly documentTitle: string;
  readonly parts: readonly DocumentPart[];
  readonly metadata: DocumentMetadata;
  readonly attachment?: DocumentAttachment;
}

/** Turns a typeset formula's ops into placed marks. Shared by equations and math table cells. */
export const formulaMarks = (
  ops: readonly FormulaOp[],
  x: number,
  baseline: number,
  fontSizePt: number,
  tone: Tone,
): SceneMark[] => {
  const unitScale = fontSizePt / 1000;
  const marks: SceneMark[] = [];
  for (const op of ops) {
    if (op.kind === 'path') {
      marks.push({
        t: 'glyph',
        path: op.path,
        /*
         * The vertical scale is negated, and that is not a sign slip.
         *
         * MathJax lays a formula out in an SVG whose root carries `scale(1, -1)`, so the `d`
         * that arrives here is already negative — and the glyph outlines inside it are authored
         * y-down, which flips it back. Two flips: the composed matrix expresses one of them, and
         * the second is the outline's own convention, which nothing in the tree states. The
         * previous renderer got it from `pdf-lib`'s `drawSvgPath`, which hard-codes an internal
         * `scale(s, -s)`; with the drawing moved to ReportLab, which applies no convention of
         * its own, the flip has to be written down. Drop it and every digit prints upside down.
         */
        matrix: [
          op.matrix.a * unitScale,
          0,
          0,
          -op.matrix.d * unitScale,
          x + op.matrix.e * unitScale,
          baseline - op.matrix.f * unitScale,
        ],
        tone,
      });
      continue;
    }
    const x1 = x + unitScale * (op.matrix.a * op.x + op.matrix.e);
    const y1 = baseline + unitScale * (-op.matrix.d * op.y - op.matrix.f);
    const x2 = x + unitScale * (op.matrix.a * (op.x + op.width) + op.matrix.e);
    const y2 = baseline + unitScale * (-op.matrix.d * (op.y + op.height) - op.matrix.f);
    marks.push({
      t: 'rect',
      rect: {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      },
      fill: tone,
    });
  }
  return marks;
};

/** Shifts a set of marks, so a block composed at the origin can be placed anywhere. */
export const translateMarks = (marks: readonly SceneMark[], dx: number, dy: number): SceneMark[] =>
  marks.map((mark) => {
    switch (mark.t) {
      case 'line':
        return { ...mark, from: { x: mark.from.x + dx, y: mark.from.y + dy }, to: { x: mark.to.x + dx, y: mark.to.y + dy } };
      case 'polyline':
        return { ...mark, points: mark.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
      case 'rect':
        return { ...mark, rect: { ...mark.rect, x: mark.rect.x + dx, y: mark.rect.y + dy } };
      case 'circle':
      case 'text':
        return { ...mark, at: { x: mark.at.x + dx, y: mark.at.y + dy } };
      case 'glyph':
        return {
          ...mark,
          matrix: [mark.matrix[0], mark.matrix[1], mark.matrix[2], mark.matrix[3], mark.matrix[4] + dx, mark.matrix[5] + dy],
        };
    }
  });
