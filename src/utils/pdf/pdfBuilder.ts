/**
 * Vertical-flow layout engine for the calculation report.
 *
 * `PdfLayout` owns the only mutable state of the document: the current page and the vertical
 * cursor. Sections declare *what* to write (`part`, `heading`, `text`, `table`, `figure`) and
 * the layout decides where it lands, breaking the page when the block no longer fits.
 *
 * Before 0.8.3 half the document did not go through here at all: the executive, quantity and
 * procedure pages positioned every element at a hard-coded `y`, which is why they silently
 * dropped content — "se muestran los primeros 2" was a layout limitation wearing the costume
 * of an editorial decision. Everything flows now, so a model with forty members prints forty
 * members, and the primitives below exist so a section never has to reach for `page.drawText`
 * to build a heading, a caption or a figure frame by hand.
 *
 * Absolute-positioned artwork still draws through `layout.page`, which must always be read at
 * the moment of use — a page break replaces it.
 */
import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import { pdfText, wrapText } from './pdfGlyphs';
import { drawMathBlock, drawRawMath, mathWidth, rawMathWidth, hasFraction, needsMath } from './pdfMath';
import { SPACE, TYPE, type ReportPalette } from './pdfTheme';
import type { PdfColor, PdfVectorOps, ReportFonts, RgbFactory } from './reportContext';

export const PAGE_SIZE: [number, number] = [595.28, 841.89];
export const MARGIN = 50;
/** Baseline of the last line that may be printed before the footer rule. */
export const CONTENT_BOTTOM = 58;
/** Height reserved at the top of every ordinary page for the running head. */
export const HEAD_SPACE = 74;

export type HeadingLevel = 1 | 2 | 3;
export type CalloutTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

export interface PdfTableColumn {
  header: string;
  /** Fixed width in points. Wins over `flex`. */
  width?: number;
  /** Share of the width left over by the fixed columns. Defaults to 1. */
  flex?: number;
  /** Numbers belong on the right, so a column of them can be compared by eye. */
  align?: 'left' | 'right';
  /**
   * Allow the typesetter to take over a cell that actually needs it. The solver labels some
   * results with symbols — `ΣFx`, `κ₁` — which drawn as prose came out `SumFx` and `kappa_1`;
   * a cell without any such glyph stays prose, where it wraps better and reads upright.
   */
  math?: boolean;
}

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
  color?: PdfColor;
}

const CELL_PAD_X = 5;
const CELL_PAD_Y = 3.6;

/**
 * Distributes `available` across the columns.
 *
 * Fixed columns are served first and the rest share the remainder by weight. A table whose
 * fixed columns alone exceed the page was mis-declared; an even split keeps it readable
 * instead of printing negative widths that overlap into the margin.
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
  pageIndex: number;
  /** `1`, `2`… for a part; `undefined` for front matter that is listed but not numbered. */
  number?: number;
  level: 1 | 2;
}

export class PdfLayout {
  readonly doc: PDFDocument;
  readonly fonts: ReportFonts;
  readonly palette: ReportPalette;
  readonly rgb: RgbFactory;
  /** The `pdf-lib` operator functions `pdfMath.ts`/`mathVector.ts` need but never import directly. */
  readonly vectorOps: PdfVectorOps;
  readonly pages: PDFPage[] = [];
  readonly width = PAGE_SIZE[0];
  readonly height = PAGE_SIZE[1];
  readonly margin = MARGIN;
  /** Usable width between margins. */
  readonly contentWidth = PAGE_SIZE[0] - MARGIN * 2;
  /** Current page. Never cache this across a call that may break the page. */
  page!: PDFPage;
  /** Vertical cursor, in PDF units from the bottom of the page. */
  y = 0;
  private equationCount = 0;
  private figureCount = 0;
  private partCount = 0;
  /** Part title carried by the running head of each page, filled as pages are created. */
  private readonly pageParts: string[] = [];
  /** Pages that carry no running head or footer — the cover. */
  private readonly bare = new Set<number>();
  private currentPart = '';

  /**
   * Parts in reading order, each with the page it opens on. Filled as the document is drawn
   * and read afterwards by the contents page and the outline, the same way `stampChrome`
   * waits until every page exists before numbering them.
   */
  readonly sections: PdfSection[] = [];

  constructor(doc: PDFDocument, fonts: ReportFonts, palette: ReportPalette, rgb: RgbFactory, vectorOps: PdfVectorOps) {
    this.doc = doc;
    this.fonts = fonts;
    this.palette = palette;
    this.rgb = rgb;
    this.vectorOps = vectorOps;
    this.newPage();
  }

  newPage(): void {
    this.page = this.doc.addPage(PAGE_SIZE);
    this.pages.push(this.page);
    this.pageParts.push(this.currentPart);
    this.y = this.height - HEAD_SPACE;
  }

  /** Marks a page as front matter: no running head, no footer, no page number. */
  markBare(pageIndex: number): void {
    this.bare.add(pageIndex);
  }

  /** Break the page when `height` no longer fits above the footer. */
  ensure(height: number): void {
    if (this.y - height < CONTENT_BOTTOM) this.newPage();
  }

  /**
   * Vertical air, in multiples of the document's spacing unit.
   *
   * Whitespace never pushes the cursor below the printable floor: trailing space after the
   * last block on a page is space nobody sees, and letting it run past the footer would break
   * the invariant every other primitive relies on when it asks `ensure` whether it fits.
   */
  gap(units = 1): void {
    this.y = Math.max(CONTENT_BOTTOM, this.y - SPACE * units);
  }

  rule(color: PdfColor = this.palette.rule, thickness = 0.5): void {
    this.ensure(SPACE * 2);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: this.width - MARGIN, y: this.y },
      thickness,
      color,
    });
    this.y -= SPACE * 2;
  }

  text(content: string, size: number = TYPE.body, font: PDFFont = this.fonts.regular, color: PdfColor = this.palette.ink, indent = 0): void {
    const lines = wrapText(content, font, size, this.contentWidth - indent);
    const lineHeight = size * 1.42;
    for (const line of lines) {
      this.ensure(lineHeight);
      if (line) this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color });
      this.y -= lineHeight;
    }
  }

  /** Small print: a clarification that must be on the page but must not compete with it. */
  note(content: string, indent = 0): void {
    this.text(content, TYPE.small, this.fonts.regular, this.palette.inkSoft, indent);
  }

  /** Uppercase micro label, the document's one piece of typographic furniture. */
  label(content: string, color: PdfColor = this.palette.inkFaint): void {
    this.ensure(TYPE.micro * 2);
    this.page.drawText(pdfText(content.toUpperCase()), {
      x: MARGIN, y: this.y - TYPE.micro, size: TYPE.micro, font: this.fonts.bold, color,
    });
    this.y -= TYPE.micro * 1.9;
  }

  /**
   * Opens a numbered part on a fresh page.
   *
   * The old design had two numbering systems running at once — coloured bands `01`…`06` on the
   * visual pages and a separate `1.`…`6.` inside the annex — so "section 5" meant two different
   * things depending on which half of the document you were holding. There is one sequence now,
   * and this is the only place that advances it.
   */
  part(title: string, standfirst?: string): number {
    this.newPage();
    this.partCount += 1;
    this.currentPart = title;
    this.pageParts[this.pages.length - 1] = title;
    this.sections.push({ title, pageIndex: this.pages.indexOf(this.page), number: this.partCount, level: 1 });

    const numeral = String(this.partCount).padStart(2, '0');
    const top = this.y;
    this.page.drawText(numeral, {
      x: MARGIN, y: top - TYPE.display, size: TYPE.display, font: this.fonts.bold, color: this.palette.tintDeep,
    });
    const numeralWidth = this.fonts.bold.widthOfTextAtSize(numeral, TYPE.display) + SPACE * 4;
    this.page.drawText(pdfText(title), {
      x: MARGIN + numeralWidth, y: top - TYPE.title - 2, size: TYPE.title, font: this.fonts.bold, color: this.palette.ink,
    });
    this.y = top - TYPE.title - SPACE * 3;
    if (standfirst) {
      const lines = wrapText(standfirst, this.fonts.regular, TYPE.small, this.contentWidth - numeralWidth);
      for (const line of lines.slice(0, 2)) {
        this.page.drawText(line, {
          x: MARGIN + numeralWidth, y: this.y - TYPE.small, size: TYPE.small, font: this.fonts.regular, color: this.palette.inkSoft,
        });
        this.y -= TYPE.small * 1.4;
      }
    }
    this.y -= SPACE;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: this.width - MARGIN, y: this.y },
      thickness: 1.1,
      color: this.palette.ink,
    });
    this.y -= SPACE * 5;
    return this.partCount;
  }

  heading(content: string, level: HeadingLevel = 1): void {
    const size = level === 1 ? TYPE.section : level === 2 ? TYPE.sub : TYPE.small;
    this.ensure(size * 3.2);
    this.y -= SPACE * (level === 1 ? 3 : 2);
    this.page.drawText(pdfText(content), {
      x: MARGIN,
      y: this.y - size,
      size,
      font: this.fonts.bold,
      color: level === 3 ? this.palette.inkSoft : this.palette.ink,
    });
    this.y -= size * 1.35;
    if (level === 1) {
      // A first-level heading is a landmark, so it earns a contents entry and a bookmark.
      this.sections.push({ title: content, pageIndex: this.pages.indexOf(this.page), level: 2 });
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + SPACE * 0.5 },
        end: { x: this.width - MARGIN, y: this.y + SPACE * 0.5 },
        thickness: 0.5,
        color: this.palette.rule,
      });
      this.y -= SPACE * 1.5;
    } else {
      this.y -= SPACE;
    }
  }

  /**
   * Headline figures across the measure, separated by hairlines rather than boxed.
   *
   * The KPI cards this replaces were four bordered rectangles with a coloured rail each: a lot
   * of ink spent saying "these four numbers are a group", which their alignment already says.
   */
  metrics(items: readonly PdfMetric[]): void {
    if (!items.length) return;
    const height = 46;
    this.ensure(height + SPACE * 2);
    const cell = this.contentWidth / items.length;
    const top = this.y;
    items.forEach((item, index) => {
      const x = MARGIN + cell * index;
      if (index > 0) {
        this.page.drawLine({
          start: { x: x - SPACE * 2, y: top - height + 4 },
          end: { x: x - SPACE * 2, y: top - 2 },
          thickness: 0.5,
          color: this.palette.rule,
        });
      }
      this.page.drawText(pdfText(item.label.toUpperCase()), {
        x, y: top - TYPE.micro - 2, size: TYPE.micro, font: this.fonts.bold, color: this.palette.inkFaint,
      });
      this.page.drawText(pdfText(item.value), {
        x, y: top - 30, size: 13.5, font: this.fonts.bold, color: item.color ?? this.palette.ink,
      });
      if (item.detail) {
        const detail = wrapText(item.detail, this.fonts.regular, TYPE.micro, cell - SPACE * 3)[0] ?? '';
        this.page.drawText(detail, {
          x, y: top - 42, size: TYPE.micro, font: this.fonts.regular, color: this.palette.inkSoft,
        });
      }
    });
    this.y = top - height - SPACE * 2;
  }

  /**
   * `label | value` rows on a hairline grid.
   *
   * Replaces the old `row()`, which printed `label: value` as prose and so lost the column a
   * reader scans down.
   */
  keyValues(entries: readonly (readonly [string, string])[], labelWidth = 150): void {
    if (!entries.length) return;
    const size = TYPE.small;
    for (const [label, value] of entries) {
      const valueLines = wrapText(value, this.fonts.regular, size, this.contentWidth - labelWidth - SPACE * 2);
      const labelLines = wrapText(label, this.fonts.bold, size, labelWidth - SPACE * 2);
      const height = Math.max(labelLines.length, valueLines.length) * size * 1.4 + SPACE * 1.5;
      this.ensure(height);
      const top = this.y;
      labelLines.forEach((line, index) => this.page.drawText(line, {
        x: MARGIN, y: top - size - index * size * 1.4, size, font: this.fonts.bold, color: this.palette.inkSoft,
      }));
      valueLines.forEach((line, index) => this.page.drawText(line, {
        x: MARGIN + labelWidth, y: top - size - index * size * 1.4, size, font: this.fonts.regular, color: this.palette.ink,
      }));
      this.y = top - height;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + SPACE * 0.5 },
        end: { x: this.width - MARGIN, y: this.y + SPACE * 0.5 },
        thickness: 0.4,
        color: this.palette.rule,
      });
    }
    this.y -= SPACE;
  }

  bullets(items: readonly string[]): void {
    for (const item of items) {
      const lines = wrapText(item, this.fonts.regular, TYPE.body, this.contentWidth - 14);
      const lineHeight = TYPE.body * 1.42;
      this.ensure(lines.length * lineHeight);
      const top = this.y;
      this.page.drawCircle({ x: MARGIN + 3, y: top - TYPE.body * 0.62, size: 1.3, color: this.palette.inkFaint });
      lines.forEach((line, index) => this.page.drawText(line, {
        x: MARGIN + 14, y: top - TYPE.body - index * lineHeight, size: TYPE.body, font: this.fonts.regular, color: this.palette.ink,
      }));
      this.y = top - lines.length * lineHeight - SPACE * 0.5;
    }
    this.y -= SPACE;
  }

  /**
   * A block the reader must not skim past: the professional notice, a solver warning, the
   * statement that a method is an approximation. A left rail in the tone's own colour and a
   * quiet ground — no border, which is what made the old panels shout.
   */
  callout(tone: CalloutTone, title: string, body: string): void {
    const color = tone === 'accent' ? this.palette.accent
      : tone === 'ok' ? this.palette.ok
        : tone === 'warn' ? this.palette.warn
          : tone === 'danger' ? this.palette.danger
            : this.palette.inkSoft;
    const inner = this.contentWidth - 18;
    const titleHeight = title ? TYPE.micro * 1.9 : 0;
    const lines = wrapText(body, this.fonts.regular, TYPE.small, inner);
    const height = titleHeight + lines.length * TYPE.small * 1.42 + SPACE * 3;
    this.ensure(height + SPACE);
    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - height, width: this.contentWidth, height, color: this.palette.tint });
    this.page.drawRectangle({ x: MARGIN, y: top - height, width: 2.2, height, color });
    let cursor = top - SPACE * 1.5;
    if (title) {
      this.page.drawText(pdfText(title.toUpperCase()), {
        x: MARGIN + 12, y: cursor - TYPE.micro, size: TYPE.micro, font: this.fonts.bold, color,
      });
      cursor -= titleHeight;
    }
    lines.forEach((line, index) => this.page.drawText(line, {
      x: MARGIN + 12, y: cursor - TYPE.small - index * TYPE.small * 1.42, size: TYPE.small, font: this.fonts.regular, color: this.palette.ink,
    }));
    this.y = top - height - SPACE * 2;
  }

  /**
   * Reserves `height` for artwork, hands the caller the rectangle it may draw in, then writes
   * the numbered caption underneath.
   *
   * Figures used to be drawn straight onto absolute coordinates with their title inside the
   * frame, which meant no figure could be referred to from the prose. They are numbered now,
   * in one sequence, the same way displayed equations are.
   */
  figure(height: number, draw: (rect: { x: number; y: number; width: number; height: number }) => void, caption?: string): number {
    const captionHeight = caption ? TYPE.small * 1.5 : 0;
    this.ensure(height + captionHeight + SPACE * 3);
    const top = this.y;
    const bottom = top - height;
    draw({ x: MARGIN, y: bottom, width: this.contentWidth, height });
    this.figureCount += 1;
    this.y = bottom - SPACE;
    if (caption) {
      const text = pdfText(`Figura ${this.figureCount} — ${caption}`);
      this.page.drawText(text, {
        x: MARGIN, y: this.y - TYPE.small, size: TYPE.small, font: this.fonts.regular, color: this.palette.inkSoft,
      });
      this.y -= captionHeight;
    }
    this.y -= SPACE * 2;
    return this.figureCount;
  }

  /**
   * Ruled table with a repeating header.
   *
   * Cells wrap inside their own column, rows keep their cells on one baseline grid, and a row
   * that no longer fits starts a fresh page under a repeated header rather than being split
   * across the fold. The header is set in small caps over a rule instead of a filled band:
   * forty rows under a coloured header read as a screenshot, not as a document.
   */
  table(columns: readonly PdfTableColumn[], rows: readonly (readonly string[])[], options: PdfTableOptions = {}): void {
    if (!columns.length) return;
    const size = options.size ?? TYPE.small;
    const indent = options.indent ?? 0;
    const zebra = options.zebra ?? false;
    const left = MARGIN + indent;
    const widths = resolveColumnWidths(columns, this.contentWidth - indent);
    const offsets = widths.reduce<number[]>((positions, width, index) => [...positions, positions[index] + width], [left]);
    const total = widths.reduce((sum, width) => sum + width, 0);
    const lineHeight = size * 1.34;
    const headerHeight = lineHeight + CELL_PAD_Y * 2;

    const drawHeader = () => {
      const headerSize = Math.min(size, TYPE.micro + 0.4);
      columns.forEach((column, index) => {
        const text = pdfText(column.header);
        const lines = wrapText(text, this.fonts.bold, headerSize, Math.max(1, widths[index] - CELL_PAD_X * 2));
        const shown = lines[0] ?? text;
        const width = this.fonts.bold.widthOfTextAtSize(shown, headerSize);
        const x = column.align === 'right'
          ? offsets[index] + widths[index] - CELL_PAD_X - width
          : offsets[index] + CELL_PAD_X;
        this.page.drawText(shown, { x, y: this.y - CELL_PAD_Y - headerSize, size: headerSize, font: this.fonts.bold, color: this.palette.inkSoft });
      });
      this.y -= headerHeight;
      this.page.drawLine({
        start: { x: left, y: this.y + SPACE * 0.4 },
        end: { x: left + total, y: this.y + SPACE * 0.4 },
        thickness: 0.8,
        color: this.palette.ink,
      });
    };

    this.ensure(headerHeight + lineHeight + CELL_PAD_Y * 2);
    drawHeader();

    rows.forEach((row, rowIndex) => {
      const typeset = columns.map((column, index) => column.math === true && needsMath(String(row[index] ?? '')));
      const cells = columns.map((_, index) => typeset[index]
        ? []
        : wrapText(String(row[index] ?? ''), this.fonts.regular, size, Math.max(1, widths[index] - CELL_PAD_X * 2)));
      const mathHeights = columns.map((_, index) => typeset[index]
        ? this.measureMathBlock(String(row[index] ?? ''), size, this.contentWidth - (widths[index] - CELL_PAD_X * 2))
        : 0);
      const height = Math.max(
        Math.max(1, ...cells.map((lines) => lines.length)) * lineHeight,
        ...mathHeights,
      ) + CELL_PAD_Y * 2;
      // `ensure` alone would break the page and leave the continuation rows headerless.
      if (this.y - height < CONTENT_BOTTOM) {
        this.newPage();
        drawHeader();
      }
      if (zebra && rowIndex % 2 === 1) {
        this.page.drawRectangle({ x: left, y: this.y - height, width: total, height, color: this.palette.tint });
      }
      cells.forEach((lines, index) => {
        const column = columns[index];
        if (typeset[index]) {
          drawMathBlock(
            this,
            String(row[index] ?? ''),
            offsets[index] + CELL_PAD_X,
            this.y - CELL_PAD_Y,
            Math.max(1, widths[index] - CELL_PAD_X * 2),
            size,
            this.palette.ink,
          );
          return;
        }
        lines.forEach((line, lineIndex) => {
          const width = this.fonts.regular.widthOfTextAtSize(line, size);
          const x = column.align === 'right'
            ? offsets[index] + widths[index] - CELL_PAD_X - width
            : offsets[index] + CELL_PAD_X;
          this.page.drawText(line, { x, y: this.y - CELL_PAD_Y - size - lineIndex * lineHeight, size, font: this.fonts.regular, color: this.palette.ink });
        });
      });
      this.y -= height;
      this.page.drawLine({
        start: { x: left, y: this.y },
        end: { x: left + total, y: this.y },
        thickness: 0.4,
        color: this.palette.rule,
      });
    });
    this.gap(2.5);
  }

  /** Records a second-level entry for the contents page, without opening a page. */
  markSection(title: string): void {
    this.sections.push({ title, pageIndex: this.pages.indexOf(this.page), level: 2 });
  }

  /** Next display-equation number, consumed as the `(n)` tag of a math block. */
  nextEquationNumber(): number {
    this.equationCount += 1;
    return this.equationCount;
  }

  /** Height `drawMathBlockAt` will consume, so the caller can break the page first. */
  measureMathBlock(expression: string, size: number, indent = 0): number {
    const available = this.contentWidth - indent;
    // One line is the floor; anything wider folds, and a stacked fraction is taller.
    const lines = Math.max(1, Math.ceil(mathWidth(this, expression, size) / Math.max(1, available)));
    return lines * size * (hasFraction(expression) ? 2.05 : 1.45);
  }

  /** Displayed equation at the current cursor. Returns the height it consumed. */
  drawMathBlockAt(expression: string, size: number, indent: number, color: PdfColor, tag?: string): number {
    return drawMathBlock(this, expression, MARGIN + indent, this.y, this.contentWidth - indent, size, color, { tag });
  }

  /** Drawn width of LaTeX a caller assembled itself (`pdfEquation.ts`'s aligned blocks). */
  rawMathWidth(latex: string, size: number): number {
    return rawMathWidth(latex, size);
  }

  /** That same LaTeX, drawn at the current cursor as one box. Returns the height consumed. */
  drawRawMathAt(latex: string, size: number, indent: number, color: PdfColor, tag?: string): number {
    return drawRawMath(this, latex, MARGIN + indent, this.y, this.contentWidth - indent, size, color, tag);
  }

  /**
   * Running head and footer on every page that is not front matter, stamped once the last page
   * exists so the count is real and each page knows the part it belongs to.
   */
  stampChrome(projectName: string, documentTitle: string): void {
    for (const [index, page] of this.pages.entries()) {
      if (this.bare.has(index)) continue;
      const part = this.pageParts[index] || documentTitle;
      const headY = this.height - 44;
      page.drawText(pdfText(projectName), {
        x: MARGIN, y: headY, size: TYPE.micro, font: this.fonts.bold, color: this.palette.ink,
      });
      const right = pdfText(part);
      const rightWidth = this.fonts.regular.widthOfTextAtSize(right, TYPE.micro);
      page.drawText(right, {
        x: this.width - MARGIN - rightWidth, y: headY, size: TYPE.micro, font: this.fonts.regular, color: this.palette.inkSoft,
      });
      page.drawLine({
        start: { x: MARGIN, y: headY - 7 },
        end: { x: this.width - MARGIN, y: headY - 7 },
        thickness: 0.5,
        color: this.palette.rule,
      });

      page.drawLine({
        start: { x: MARGIN, y: 42 },
        end: { x: this.width - MARGIN, y: 42 },
        thickness: 0.5,
        color: this.palette.rule,
      });
      page.drawText(pdfText(documentTitle), {
        x: MARGIN, y: 30, size: TYPE.micro, font: this.fonts.regular, color: this.palette.inkFaint,
      });
      const folio = pdfText(`página ${index + 1} de ${this.pages.length}`);
      const folioWidth = this.fonts.regular.widthOfTextAtSize(folio, TYPE.micro);
      page.drawText(folio, {
        x: this.width - MARGIN - folioWidth, y: 30, size: TYPE.micro, font: this.fonts.regular, color: this.palette.inkFaint,
      });
    }
  }
}
