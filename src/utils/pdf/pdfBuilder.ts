/**
 * Vertical-flow layout engine for the calculation report.
 *
 * `PdfLayout` owns the only mutable state of the document: the current page and the vertical
 * cursor. Sections declare *what* to write (`heading`, `text`, `row`) and the layout decides
 * where it lands, breaking the page when the block no longer fits. Absolute-positioned
 * artwork still draws through `layout.page`, which must always be read at the moment of use —
 * a page break replaces it.
 */
import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import { pdfText, wrapText } from './pdfGlyphs';
import type { PdfColor, ReportFonts, ReportPalette, RgbFactory } from './reportContext';

export const PAGE_SIZE: [number, number] = [595.28, 841.89];
export const MARGIN = 48;
export const CONTENT_BOTTOM = 52;

export type HeadingLevel = 1 | 2;

export interface PdfTableColumn {
  header: string;
  /** Fixed width in points. Wins over `flex`. */
  width?: number;
  /** Share of the width left over by the fixed columns. Defaults to 1. */
  flex?: number;
  /** Numbers belong on the right, so a column of them can be compared by eye. */
  align?: 'left' | 'right';
}

export interface PdfTableOptions {
  size?: number;
  indent?: number;
  /** Alternating row tint. On by default; turn it off for two- or three-row tables. */
  zebra?: boolean;
}

const CELL_PAD_X = 5;
const CELL_PAD_Y = 3.4;

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

export class PdfLayout {
  readonly doc: PDFDocument;
  readonly fonts: ReportFonts;
  readonly palette: ReportPalette;
  readonly rgb: RgbFactory;
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

  constructor(doc: PDFDocument, fonts: ReportFonts, palette: ReportPalette, rgb: RgbFactory) {
    this.doc = doc;
    this.fonts = fonts;
    this.palette = palette;
    this.rgb = rgb;
    this.newPage();
  }

  newPage(): void {
    this.page = this.doc.addPage(PAGE_SIZE);
    this.pages.push(this.page);
    this.y = this.height - MARGIN;
  }

  /** Break the page when `height` no longer fits above the footer. */
  ensure(height: number): void {
    if (this.y - height < CONTENT_BOTTOM) this.newPage();
  }

  rule(): void {
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: this.width - MARGIN, y: this.y },
      thickness: 0.7,
      color: this.palette.rule,
    });
    this.y -= 10;
  }

  text(content: string, size = 9, font: PDFFont = this.fonts.regular, color: PdfColor = this.palette.ink, indent = 0): void {
    const lines = wrapText(content, font, size, this.contentWidth - indent);
    const lineHeight = size * 1.35;
    for (const line of lines) {
      this.ensure(lineHeight);
      if (line) this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color });
      this.y -= lineHeight;
    }
  }

  heading(content: string, level: HeadingLevel = 1): void {
    const size = level === 1 ? 16 : 11.5;
    this.ensure(size * 2.1);
    this.y -= level === 1 ? 8 : 4;
    this.text(content, size, this.fonts.bold, level === 1 ? this.palette.forest : this.palette.forestDeep);
    if (level === 1) this.rule();
  }

  /**
   * Ruled table with a repeating header.
   *
   * The annex used to print every list as `label: value` prose, which reads acceptably for a
   * two-line summary and very badly for forty nodes: the reader cannot compare a column that
   * does not exist. Cells wrap inside their own column, rows keep their cells on one baseline
   * grid, and a row that no longer fits starts a fresh page under a repeated header rather
   * than being split across the fold.
   */
  table(columns: readonly PdfTableColumn[], rows: readonly (readonly string[])[], options: PdfTableOptions = {}): void {
    if (!columns.length) return;
    const size = options.size ?? 7.6;
    const indent = options.indent ?? 0;
    const zebra = options.zebra ?? true;
    const left = MARGIN + indent;
    const widths = resolveColumnWidths(columns, this.contentWidth - indent);
    const offsets = widths.reduce<number[]>((positions, width, index) => [...positions, positions[index] + width], [left]);
    const lineHeight = size * 1.32;
    const headerHeight = lineHeight + CELL_PAD_Y * 2;

    const drawHeader = () => {
      this.page.drawRectangle({
        x: left,
        y: this.y - headerHeight,
        width: widths.reduce((sum, width) => sum + width, 0),
        height: headerHeight,
        color: this.palette.forestSoft,
      });
      columns.forEach((column, index) => {
        const text = pdfText(column.header);
        const width = this.fonts.bold.widthOfTextAtSize(text, size);
        const x = column.align === 'right'
          ? offsets[index] + widths[index] - CELL_PAD_X - width
          : offsets[index] + CELL_PAD_X;
        this.page.drawText(text, { x, y: this.y - CELL_PAD_Y - size, size, font: this.fonts.bold, color: this.palette.forestDeep });
      });
      this.y -= headerHeight;
    };

    this.ensure(headerHeight + lineHeight + CELL_PAD_Y * 2);
    drawHeader();

    rows.forEach((row, rowIndex) => {
      const cells = columns.map((_, index) => wrapText(String(row[index] ?? ''), this.fonts.regular, size, Math.max(1, widths[index] - CELL_PAD_X * 2)));
      const height = Math.max(1, ...cells.map((lines) => lines.length)) * lineHeight + CELL_PAD_Y * 2;
      // `ensure` alone would break the page and leave the continuation rows headerless.
      if (this.y - height < CONTENT_BOTTOM) {
        this.newPage();
        drawHeader();
      }
      if (zebra && rowIndex % 2 === 1) {
        this.page.drawRectangle({
          x: left,
          y: this.y - height,
          width: widths.reduce((sum, width) => sum + width, 0),
          height,
          color: this.rgb(0.965, 0.972, 0.978),
        });
      }
      cells.forEach((lines, index) => {
        const column = columns[index];
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
        end: { x: left + widths.reduce((sum, width) => sum + width, 0), y: this.y },
        thickness: 0.4,
        color: this.palette.rule,
      });
    });
    this.y -= 9;
  }

  /** `label: value` entry of the technical annex. */
  row(label: string, value: string): void {
    this.ensure(15);
    this.text(`${label}: ${value}`, 8.7, this.fonts.regular, this.rgb(0.15, 0.18, 0.22), 8);
  }

  /** Running footer with the page count, stamped once every page exists. */
  stampFooters(): void {
    for (const [index, reportPage] of this.pages.entries()) {
      reportPage.drawLine({
        start: { x: MARGIN, y: 36 },
        end: { x: this.width - MARGIN, y: 36 },
        thickness: 0.5,
        color: this.rgb(0.78, 0.81, 0.85),
      });
      reportPage.drawText(`structureCo - memoria de calculo | pagina ${index + 1} de ${this.pages.length}`, {
        x: MARGIN,
        y: 20,
        size: 7.5,
        font: this.fonts.regular,
        color: this.rgb(0.36, 0.40, 0.45),
      });
    }
  }
}
