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
 * How a stroke ends and how two of them meet.
 *
 * `0` butt / mitre, `1` round, `2` square / bevel — ReportLab's own numbering, and the PDF
 * specification's. The drawings default to round on both, which is what stops a load arrow's
 * shaft from ending in a visible square nib and a diagram's peak from growing a mitre spike.
 */
export type LineCap = 0 | 1 | 2;
export type LineJoin = 0 | 1 | 2;

/** One step of a path, in figure-local points. Cubic only: a quadratic is raised before it gets here. */
export type PathOp =
  | { readonly o: 'm'; readonly x: number; readonly y: number }
  | { readonly o: 'l'; readonly x: number; readonly y: number }
  | { readonly o: 'c'; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly x: number; readonly y: number }
  | { readonly o: 'z' };

/**
 * One mark of a drawing, in figure-local points.
 *
 * These are the primitives the technical drawings are built from, and they are intentionally
 * few: a scene that needs a support glyph asks for `support`, not for the seven lines a
 * support happens to be made of, so the glyph is defined once — in `marks.py` — and every
 * drawing in the report spells it the same way.
 *
 * `path` is the one that earns its place by what it can *fill*. A shear diagram is an area, not
 * a fringe of hatch lines; an arrowhead is a solid triangle, not two barbs meeting at a point.
 * Both were approximations the previous renderer's drawing API forced, and both are now what
 * they should be.
 */
export type SceneMark =
  | { readonly t: 'line'; readonly from: Point; readonly to: Point; readonly tone: Tone; readonly width?: number; readonly dash?: readonly [number, number]; readonly opacity?: number; readonly cap?: LineCap }
  | { readonly t: 'polyline'; readonly points: readonly Point[]; readonly tone: Tone; readonly width?: number; readonly dash?: readonly [number, number]; readonly opacity?: number; readonly cap?: LineCap; readonly join?: LineJoin }
  | {
    readonly t: 'path';
    readonly d: readonly PathOp[];
    readonly fill?: Tone;
    readonly stroke?: Tone;
    readonly width?: number;
    readonly dash?: readonly [number, number];
    readonly opacity?: number;
    readonly cap?: LineCap;
    readonly join?: LineJoin;
  }
  | { readonly t: 'rect'; readonly rect: Rect; readonly fill?: Tone; readonly stroke?: Tone; readonly width?: number; readonly opacity?: number }
  | { readonly t: 'circle'; readonly at: Point; readonly radius: number; readonly fill?: Tone; readonly stroke?: Tone; readonly width?: number; readonly dash?: readonly [number, number]; readonly opacity?: number }
  | {
    readonly t: 'text';
    readonly at: Point;
    readonly text: string;
    readonly size: number;
    readonly tone: Tone;
    readonly face?: FaceName;
    readonly align?: Align;
    /**
     * Knock the glyphs out of whatever they sit on, in this tone.
     *
     * A value written over its own curve used to be a choice between illegible and displaced.
     * A halo is what a technical drawing does instead: the label stays where it belongs and the
     * line underneath gives way to it.
     */
    readonly halo?: Tone;
  }
  /** A glyph outline from the math typesetter, already placed and scaled. */
  | { readonly t: 'glyph'; readonly path: string; readonly matrix: readonly [number, number, number, number, number, number]; readonly tone: Tone }
  /**
   * Marks drawn together, optionally inside a boundary they cannot cross.
   *
   * The clip is what lets a detail view be sized to its subject and still show what the subject
   * was cut out of: the surrounding structure is drawn at the subject's own scale and runs to
   * the frame, where it stops — instead of either being left out, or sprawling across the
   * caption because the drawing was sized to it rather than to what it surrounds.
   */
  | { readonly t: 'group'; readonly clip?: Rect; readonly marks: readonly SceneMark[] };

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

const translateOp = (op: PathOp, dx: number, dy: number): PathOp => {
  switch (op.o) {
    case 'z': return op;
    case 'c': return { ...op, x1: op.x1 + dx, y1: op.y1 + dy, x2: op.x2 + dx, y2: op.y2 + dy, x: op.x + dx, y: op.y + dy };
    default: return { ...op, x: op.x + dx, y: op.y + dy };
  }
};

/** Shifts a set of marks, so a block composed at the origin can be placed anywhere. */
export const translateMarks = (marks: readonly SceneMark[], dx: number, dy: number): SceneMark[] =>
  marks.map((mark) => {
    switch (mark.t) {
      case 'line':
        return { ...mark, from: { x: mark.from.x + dx, y: mark.from.y + dy }, to: { x: mark.to.x + dx, y: mark.to.y + dy } };
      case 'polyline':
        return { ...mark, points: mark.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
      case 'path':
        return { ...mark, d: mark.d.map((op) => translateOp(op, dx, dy)) };
      case 'group':
        return {
          ...mark,
          clip: mark.clip ? { ...mark.clip, x: mark.clip.x + dx, y: mark.clip.y + dy } : undefined,
          marks: translateMarks(mark.marks, dx, dy),
        };
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
