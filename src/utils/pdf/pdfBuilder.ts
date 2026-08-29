/**
 * The document recorder for the calculation report.
 *
 * `PdfLayout` used to be a vertical-flow layout engine: it owned the current page and a `y`
 * cursor, and every primitive decided where a block landed before drawing it. Since the
 * ReportLab migration it owns neither. Sections still declare *what* to write — `part`,
 * `heading`, `text`, `table`, `figure`, `equation` — with the same call surface they always
 * used, but the result is now a `ReportDocument`: an ordered, pagination-free tree of blocks
 * that `python/structureco_report/` breaks across pages and draws.
 *
 * Dropping the cursor removes a whole class of defect this file used to carry. Nothing here can
 * run off the bottom of a page, split a table row across the fold, or leave a continuation
 * headerless, because nothing here knows where a page ends: those are the renderer's
 * invariants now, asserted by its own tests, and they hold for a two-page report and a
 * hundred-page one alike.
 *
 * What did *not* change is figures. A figure reserves a height and hands the caller a
 * rectangle to draw in, exactly as before — only the rectangle is figure-local, with its origin
 * at its own bottom-left, and the drawing goes to a `Surface` instead of a page. That is what
 * keeps `pdfScene.ts` and its callers pagination-independent: a drawing composed here is
 * correct wherever the renderer lands it.
 */
import { pdfText } from './pdfGlyphs';
import { drawMathBlock, drawRawMath, mathWidth, hasFraction, needsMath, rawMathWidth as rawMathWidthOf } from './pdfMath';
import { TYPE, PALETTE, type ReportPalette } from './pdfTheme';
import { REPORT_FONTS, Surface, type ReportFont, type ReportFonts } from './pdfSurface';
import type {
  Block,
  CalloutTone,
  DocumentPart,
  HeadingLevel,
  Metric,
  Rect,
  SceneMark,
  TableColumn,
  Tone,
  TypesetCell,
} from './reportDocument';

export const PAGE_SIZE: [number, number] = [595.28, 841.89];
export const MARGIN = 50;
/** Baseline of the last line that may be printed before the footer rule. */
export const CONTENT_BOTTOM = 58;
/** Height reserved at the top of every ordinary page for the running head. */
export const HEAD_SPACE = 74;

export type { HeadingLevel, CalloutTone } from './reportDocument';

/** A table column, as a section declares it. Mirrors the IR's own shape. */
export interface PdfTableColumn extends TableColumn {}

export interface PdfTableOptions {
  size?: number;
  indent?: number;
  /** Alternating row tint. Off by default: hairlines separate rows without striping the page. */
  zebra?: boolean;
}

/** One headline figure of the summary strip. */
export interface PdfMetric {
  label: string;
  value: string;
  /** Optional second line, for the station or member a governing value belongs to. */
  detail?: string;
  color?: Tone;
}

/**
 * Distributes `available` across the columns.
 *
 * Fixed columns are served first and the rest share the remainder by weight. A table whose
 * fixed columns alone exceed the page was mis-declared; an even split keeps it readable
 * instead of printing negative widths that overlap into the margin.
 *
 * The renderer runs this same rule — `tables.py` mirrors it — because a math cell has to be
 * typeset against its final column width here, before the document is handed over.
 */
export const resolveColumnWidths = (columns: readonly PdfTableColumn[], available: number): number[] => {
  if (!columns.length) return [];
  const fixed = columns.reduce((sum, column) => sum + (column.width ?? 0), 0);
  const remaining = available - fixed;
  const flexTotal = columns.reduce((sum, column) => column.width === undefined ? sum + (column.flex ?? 1) : sum, 0);
  if (remaining < 0 || (flexTotal === 0 && fixed > available)) {
    return columns.map(() => available / columns.length);
  }
  return columns.map((column) => column.width !== undefined
    ? column.width
    : flexTotal === 0 ? 0 : remaining * (column.flex ?? 1) / flexTotal);
};

/** A part of the document, as the contents page and the bookmark pane see it. */
export interface PdfSection {
  title: string;
  /** `1`, `2`… for a part; `undefined` for a section inside one. */
  number?: number;
  level: 1 | 2;
}

export class PdfLayout {
  readonly fonts: ReportFonts = REPORT_FONTS;
  readonly palette: ReportPalette = PALETTE;
  readonly width = PAGE_SIZE[0];
  readonly height = PAGE_SIZE[1];
  readonly margin = MARGIN;
  /** Usable width between margins. */
  readonly contentWidth = PAGE_SIZE[0] - MARGIN * 2;

  private equationCount = 0;
  private figureCount = 0;
  private partCount = 0;
  private readonly parts: DocumentPart[] = [];
  private blocks: Block[] = [];
  /**
   * The figure currently being composed.
   *
   * `pdfScene.ts` and every drawing that leans on it read `layout.surface` the way they used to
   * read `layout.page`. It exists only inside a `figure()` callback; drawing outside one is a
   * bug the empty default surface swallows rather than one that corrupts a page.
   */
  surface = new Surface();

  /**
   * Parts and the sections inside them, in reading order. The contents page and the outline are
   * built from this by the renderer, which is the only side that knows what page each landed on.
   */
  readonly sections: PdfSection[] = [];

  /** No-op kept so a caller that opens the document before its first part reads unchanged. */
  newPage(): void {}

  /** The flow has no page to be bare, so this is the renderer's business now. */
  markBare(_pageIndex?: number): void {}

  /**
   * The renderer breaks pages, so a section no longer has to ask whether a block fits.
   *
   * The signature is kept — callers still pass the height they were about to write — because
   * every one of those call sites is a place where a section *believed* it had to reserve
   * room, and reading `ensure(height)` beside the block it guards still says what the block is.
   */
  ensure(_height?: number): void {}

  /**
   * Vertical air, in multiples of the document's spacing unit.
   *
   * Still meaningful — the rhythm between two blocks is editorial — but it can no longer push a
   * cursor past the printable floor, because there is no cursor: a gap that lands on a page
   * break is simply dropped by the renderer.
   */
  gap(units = 1): void {
    this.blocks.push({ kind: 'gap', units });
  }

  rule(color: Tone = this.palette.rule, thickness = 0.5): void {
    this.blocks.push({ kind: 'rule', tone: color, width: thickness });
  }

  text(content: string, size: number = TYPE.body, font: ReportFont = this.fonts.regular, color: Tone = this.palette.ink, indent = 0): void {
    this.blocks.push({ kind: 'text', text: pdfText(content), size, face: font.face, tone: color, indent });
  }

  /** Small print: a clarification that must be on the page but must not compete with it. */
  note(content: string, indent = 0): void {
    this.text(content, TYPE.small, this.fonts.regular, this.palette.inkSoft, indent);
  }

  /** Uppercase micro label, the document's one piece of typographic furniture. */
  label(content: string, color: Tone = this.palette.inkFaint): void {
    this.blocks.push({ kind: 'label', text: pdfText(content.toUpperCase()), tone: color });
  }

  /**
   * Opens a numbered part.
   *
   * The old design had two numbering systems running at once — coloured bands `01`…`06` on the
   * visual pages and a separate `1.`…`6.` inside the annex — so "section 5" meant two different
   * things depending on which half of the document you were holding. There is one sequence now,
   * and this is the only place that advances it.
   */
  part(title: string, standfirst?: string): number {
    this.partCount += 1;
    this.blocks = [];
    this.parts.push({ title: pdfText(title), number: this.partCount, standfirst: standfirst ? pdfText(standfirst) : undefined, blocks: this.blocks });
    this.sections.push({ title: pdfText(title), number: this.partCount, level: 1 });
    return this.partCount;
  }

  heading(content: string, level: HeadingLevel = 1): void {
    this.blocks.push({ kind: 'heading', text: pdfText(content), level });
    // A first-level heading is a landmark, so it earns a contents entry and a bookmark.
    if (level === 1) this.sections.push({ title: pdfText(content), level: 2 });
  }

  /**
   * Headline figures across the measure, separated by hairlines rather than boxed.
   *
   * The KPI cards this replaces were four bordered rectangles with a coloured rail each: a lot
   * of ink spent saying "these four numbers are a group", which their alignment already says.
   */
  metrics(items: readonly PdfMetric[]): void {
    if (!items.length) return;
    const mapped: Metric[] = items.map((item) => ({
      label: pdfText(item.label.toUpperCase()),
      value: pdfText(item.value),
      detail: item.detail ? pdfText(item.detail) : undefined,
      tone: item.color,
    }));
    this.blocks.push({ kind: 'metrics', items: mapped });
  }

  /**
   * `label | value` rows on a hairline grid.
   *
   * Replaces the old `row()`, which printed `label: value` as prose and so lost the column a
   * reader scans down.
   */
  keyValues(entries: readonly (readonly [string, string])[], labelWidth = 150): void {
    if (!entries.length) return;
    this.blocks.push({
      kind: 'keyValues',
      entries: entries.map(([label, value]) => [pdfText(label), pdfText(value)] as const),
      labelWidth,
    });
  }

  bullets(items: readonly string[]): void {
    if (!items.length) return;
    this.blocks.push({ kind: 'bullets', items: items.map((item) => pdfText(item)) });
  }

  /**
   * A block the reader must not skim past: the professional notice, a solver warning, the
   * statement that a method is an approximation. A left rail in the tone's own colour and a
   * quiet ground — no border, which is what made the old panels shout.
   */
  callout(tone: CalloutTone, title: string, body: string): void {
    this.blocks.push({ kind: 'callout', tone, title: pdfText(title.toUpperCase()), body: pdfText(body) });
  }

  /**
   * Reserves `height` for artwork, hands the caller the rectangle it may draw in, then writes
   * the numbered caption underneath.
   *
   * The rectangle is figure-local: `x` and `y` are zero, and the drawing that comes back is
   * correct wherever the renderer places the block. That is the one difference from the
   * cursor-based version, and the reason a figure composed in a unit test is the same figure
   * the browser prints.
   */
  figure(height: number, draw: (rect: Rect) => void, caption?: string): number {
    const previous = this.surface;
    const surface = new Surface();
    this.surface = surface;
    try {
      draw({ x: 0, y: 0, width: this.contentWidth, height });
    } finally {
      this.surface = previous;
    }
    this.figureCount += 1;
    this.blocks.push({
      kind: 'figure',
      number: this.figureCount,
      height,
      caption: caption ? pdfText(`Figura ${this.figureCount} — ${caption}`) : undefined,
      marks: surface.marks,
    });
    return this.figureCount;
  }

  /**
   * Artwork with no caption and no number.
   *
   * Two drawings in the report are plates rather than figures — the elastic curve that closes a
   * deflection method, and the conjugate beam beside it. They were absolutely positioned before
   * the migration and were never numbered, so numbering them here would renumber every figure
   * after them. Same reservation, same local rectangle, no caption.
   */
  plate(height: number, draw: (rect: Rect) => void): void {
    const previous = this.surface;
    const surface = new Surface();
    this.surface = surface;
    try {
      draw({ x: 0, y: 0, width: this.contentWidth, height });
    } finally {
      this.surface = previous;
    }
    this.blocks.push({ kind: 'figure', number: 0, height, marks: surface.marks });
  }

  /**
   * Ruled table with a repeating header.
   *
   * Column widths, wrapping, the repeated header and the page break between two rows all belong
   * to `tables.py` now. What stays here is the one thing the renderer cannot do: a cell the
   * solver labelled with symbols — `ΣFx`, `κ₁` — is typeset by MathJax against the width its
   * column will actually get, and travels as placed glyph outlines.
   */
  table(columns: readonly PdfTableColumn[], rows: readonly (readonly string[])[], options: PdfTableOptions = {}): void {
    if (!columns.length) return;
    const size = options.size ?? TYPE.small;
    const indent = options.indent ?? 0;
    const widths = resolveColumnWidths(columns, this.contentWidth - indent);
    const typeset: Record<string, TypesetCell> = {};
    const plain = rows.map((row) => columns.map((_, index) => pdfText(String(row[index] ?? ''))));

    columns.forEach((column, index) => {
      if (column.math !== true) return;
      const available = Math.max(1, widths[index] - CELL_PAD_X * 2);
      rows.forEach((row, rowIndex) => {
        const value = String(row[index] ?? '');
        if (!needsMath(value)) return;
        const cell = this.typesetCell(value, available, size);
        if (cell) typeset[`${rowIndex}:${index}`] = cell;
      });
    });

    this.blocks.push({
      kind: 'table',
      columns: columns.map((column) => ({ ...column, header: pdfText(column.header) })),
      rows: plain,
      typeset,
      size,
      indent,
      zebra: options.zebra ?? false,
    });
  }

  /** Records a second-level entry for the contents page, without opening a part. */
  markSection(title: string): void {
    this.sections.push({ title: pdfText(title), level: 2 });
  }

  /** Next display-equation number, consumed as the `(n)` tag of a math block. */
  nextEquationNumber(): number {
    this.equationCount += 1;
    return this.equationCount;
  }

  /**
   * Height a displayed equation will consume.
   *
   * Kept because several sections still budget with it when they decide *which* form of a
   * relation to print — the one-line version or the aligned block — a content decision that is
   * legitimately theirs. It no longer decides page breaks.
   */
  measureMathBlock(expression: string, size: number, indent = 0): number {
    const available = this.contentWidth - indent;
    // One line is the floor; anything wider folds, and a stacked fraction is taller.
    const lines = Math.max(1, Math.ceil(mathWidth(this, expression, size) / Math.max(1, available)));
    return lines * size * (hasFraction(expression) ? 2.05 : 1.45);
  }

  /** Displayed equation, typeset here and emitted as placed outlines. */
  drawMathBlockAt(expression: string, size: number, indent: number, color: Tone, tag?: string): number {
    const surface = new Surface();
    const height = drawMathBlock(surface, this, expression, 0, 0, this.contentWidth - indent, size, color, { tag });
    if (!height) return 0;
    this.pushEquation(surface.marks, height, indent, color, size, tag);
    return height;
  }

  /** Drawn width of LaTeX a caller assembled itself (`pdfEquation.ts`'s aligned blocks). */
  rawMathWidth(latex: string, size: number): number {
    return rawMathWidthOf(latex, size);
  }

  /** That same LaTeX, typeset as one indivisible box. Returns the height consumed. */
  drawRawMathAt(latex: string, size: number, indent: number, color: Tone, tag?: string): number {
    const surface = new Surface();
    const height = drawRawMath(surface, latex, 0, 0, this.contentWidth - indent, size, color, tag);
    if (!height) return 0;
    this.pushEquation(surface.marks, height, indent, color, size, tag);
    return height;
  }

  /** The running head and the folio are the renderer's; nothing here can know the page count. */
  stampChrome(): void {}

  /** The finished document, ready to be serialised and handed to the renderer. */
  build(): { parts: readonly DocumentPart[]; sections: readonly PdfSection[] } {
    return { parts: this.parts, sections: this.sections };
  }

  /**
   * A math block composed at the origin, hung on the flow.
   *
   * `drawMathBlock` grows downward from `y = 0`, so its marks sit in negative `y`; they are
   * lifted by the block's own height here, which leaves the renderer a box whose origin is its
   * bottom-left like every other block's.
   */
  private pushEquation(marks: readonly SceneMark[], height: number, indent: number, tone: Tone, size: number, tag?: string): void {
    this.blocks.push({
      kind: 'equation',
      marks: liftMarks(marks, height),
      height,
      indent,
      tag: tag ? pdfText(tag) : undefined,
      tagTone: tone,
      tagSize: size * 0.9,
    });
  }

  /** One table cell, typeset against the column width it will be drawn in. */
  private typesetCell(value: string, available: number, size: number): TypesetCell | undefined {
    const surface = new Surface();
    const height = drawMathBlock(surface, this, value, 0, 0, available, size, this.palette.ink);
    if (!height) return undefined;
    return { marks: liftMarks(surface.marks, height), width: available, height };
  }
}

const CELL_PAD_X = 5;

const liftMarks = (marks: readonly SceneMark[], height: number): SceneMark[] => {
  const lifted: SceneMark[] = [];
  for (const mark of marks) lifted.push(shift(mark, height));
  return lifted;
};

const shift = (mark: SceneMark, dy: number): SceneMark => {
  switch (mark.t) {
    case 'line':
      return { ...mark, from: { x: mark.from.x, y: mark.from.y + dy }, to: { x: mark.to.x, y: mark.to.y + dy } };
    case 'polyline':
      return { ...mark, points: mark.points.map((point) => ({ x: point.x, y: point.y + dy })) };
    case 'path':
      return {
        ...mark,
        d: mark.d.map((op) => op.o === 'z'
          ? op
          : op.o === 'c'
            ? { ...op, y1: op.y1 + dy, y2: op.y2 + dy, y: op.y + dy }
            : { ...op, y: op.y + dy }),
      };
    case 'rect':
      return { ...mark, rect: { ...mark.rect, y: mark.rect.y + dy } };
    case 'circle':
    case 'text':
      return { ...mark, at: { x: mark.at.x, y: mark.at.y + dy } };
    case 'glyph':
      return { ...mark, matrix: [mark.matrix[0], mark.matrix[1], mark.matrix[2], mark.matrix[3], mark.matrix[4], mark.matrix[5] + dy] };
  }
};
