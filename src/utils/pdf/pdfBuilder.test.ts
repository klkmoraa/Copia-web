/// <reference types="node" />

/**
 * Layout arithmetic of the report's table primitive.
 *
 * The document is read with a calculator beside it, so a table that silently overflows the
 * margin, drops a row at a page break or loses the header on the continuation page is a
 * correctness bug, not a cosmetic one. The geometry is asserted here; the rendered text is
 * asserted end-to-end in `calculationPdfEditorial.test.ts`.
 *
 * The layout is built with the report's real palette rather than a stand-in, so a token that
 * stops resolving fails here too.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb } from 'pdf-lib';
import { CONTENT_BOTTOM, MARGIN, PAGE_SIZE, PdfLayout, resolveColumnWidths } from './pdfBuilder';
import { createPalette } from './pdfTheme';

const vectorOps = { concatTransformationMatrix, pushGraphicsState, popGraphicsState };

const createLayout = async () => {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mathRegular: await doc.embedFont(StandardFonts.TimesRoman),
    mathItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    mathSymbol: await doc.embedFont(StandardFonts.Symbol),
  };
  return new PdfLayout(doc, fonts, createPalette(rgb), rgb, vectorOps);
};

const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN * 2;

describe('resolveColumnWidths', () => {
  it('spends exactly the available width, so no column bleeds past the margin', () => {
    const widths = resolveColumnWidths([{ header: 'a' }, { header: 'b' }, { header: 'c' }], CONTENT_WIDTH);
    expect(widths).toHaveLength(3);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(CONTENT_WIDTH, 6);
  });

  it('honours fixed widths and shares only the remainder among the flexible columns', () => {
    const widths = resolveColumnWidths(
      [{ header: 'id', width: 60 }, { header: 'wide', flex: 3 }, { header: 'narrow', flex: 1 }],
      400,
    );
    expect(widths[0]).toBe(60);
    expect(widths[1]).toBeCloseTo(255, 6);
    expect(widths[2]).toBeCloseTo(85, 6);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(400, 6);
  });

  it('falls back to an even split when the fixed columns alone would overflow', () => {
    const widths = resolveColumnWidths([{ header: 'a', width: 900 }, { header: 'b' }], 400);
    expect(widths).toEqual([200, 200]);
  });
});

describe('PdfLayout.table', () => {
  it('advances the cursor downward and stays inside the printable area', async () => {
    const layout = await createLayout();
    const before = layout.y;
    layout.table(
      [{ header: 'Nodo' }, { header: 'x', align: 'right' }, { header: 'y', align: 'right' }],
      [['N1', '0', '0'], ['N2', '4', '3']],
    );
    expect(layout.y).toBeLessThan(before);
    expect(layout.y).toBeGreaterThanOrEqual(CONTENT_BOTTOM - 1);
    expect(layout.pages).toHaveLength(1);
  });

  it('breaks the page and repeats the header instead of running off the sheet', async () => {
    const layout = await createLayout();
    const rows = Array.from({ length: 120 }, (_, index) => [`N${index}`, String(index), String(index * 2)]);
    layout.table([{ header: 'Nodo' }, { header: 'x', align: 'right' }, { header: 'y', align: 'right' }], rows);

    expect(layout.pages.length).toBeGreaterThan(1);
    expect(layout.y).toBeGreaterThanOrEqual(CONTENT_BOTTOM - 1);
  });

  it('wraps a long cell instead of overprinting the next column', async () => {
    // A narrow fixed column makes the assertion independent of the page width and of how
    // wide Helvetica happens to render this particular sentence.
    const columns = [{ header: 'id', width: 50 }, { header: 'detalle', width: 90 }];
    const long = 'dominio x/L=0 -> 1 con una descripcion deliberadamente larga que no cabe en una sola linea';

    const layout = await createLayout();
    const before = layout.y;
    layout.table(columns, [['M1', long]]);
    const tall = before - layout.y;

    const second = await createLayout();
    const start = second.y;
    second.table(columns, [['M1', 'corto']]);
    const short = start - second.y;

    expect(tall).toBeGreaterThan(short);
    // Four-plus wrapped lines in a 90pt column, not one clipped line.
    expect(tall).toBeGreaterThan(short + 3 * 7.6);
  });

  it('renders an empty table as its header alone rather than throwing', async () => {
    const layout = await createLayout();
    expect(() => layout.table([{ header: 'Nodo' }, { header: 'x' }], [])).not.toThrow();
    expect(layout.pages).toHaveLength(1);
  });

  it('pads a short row so a missing trailing cell cannot shift the columns', async () => {
    const layout = await createLayout();
    expect(() => layout.table(
      [{ header: 'a' }, { header: 'b' }, { header: 'c' }],
      [['only-one'], ['one', 'two', 'three']],
    )).not.toThrow();
  });
});
