/// <reference types="node" />

/**
 * The table primitive, on both sides of the seam.
 *
 * The document is read with a calculator beside it, so a table that silently overflows the
 * margin, drops a row at a page break or loses the header on the continuation page is a
 * correctness bug, not a cosmetic one.
 *
 * Since the ReportLab migration those three properties are no longer decided here: the composer
 * states columns and rows, and `python/structureco_report/tables.py` breaks and draws them. So
 * this file asserts the two halves separately — the column arithmetic the two sides *share*
 * (both run `resolveColumnWidths`, and they must agree or a typeset cell laid out against one
 * width prints over a gridline drawn at another), and then the layout itself on a real rendered
 * PDF, which is the only place the break behaviour actually exists.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MARGIN, PAGE_SIZE, PdfLayout, resolveColumnWidths } from './pdfBuilder';
import { renderReportDocument } from './reportlabRenderer';
import type { Block, ReportDocument } from './reportDocument';

const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN * 2;

const columns = [
  { header: 'Nodo' },
  { header: 'x', align: 'right' as const },
  { header: 'y', align: 'right' as const },
];

/** The blocks one part's worth of calls produced. */
const compose = (write: (layout: PdfLayout) => void): readonly Block[] => {
  const layout = new PdfLayout();
  layout.part('Prueba');
  write(layout);
  return layout.build().parts[0].blocks;
};

/** A one-part document around `blocks`, rendered for real. */
const renderBlocks = async (blocks: readonly Block[]): Promise<PlacedText[]> => {
  const document: ReportDocument = {
    version: 1,
    page: { width: PAGE_SIZE[0], height: PAGE_SIZE[1], margin: MARGIN },
    cover: { documentTitle: 'Memoria', projectName: 'Prueba', facts: [], noticeTitle: 'Aviso', notice: 'Aviso.' },
    contentsTitle: 'Contenido',
    runningTitle: 'Prueba',
    documentTitle: 'Memoria',
    parts: [{ title: 'Prueba', number: 1, blocks }],
    metadata: {
      title: 'Prueba', author: 'structureCo', subject: '', keywords: [],
      producer: 'structureCo', creator: 'structureCo', language: 'es',
      stampedAt: '2026-08-29T12:00:00.000Z',
    },
  };
  return pageItems(await renderReportDocument(document));
};

interface PlacedText {
  page: number;
  text: string;
  x: number;
  y: number;
  width: number;
}

/** Every drawn string with the box it occupies, so geometry can be asserted, not guessed. */
const pageItems = async (bytes: Uint8Array): Promise<PlacedText[]> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes.slice(), useWorkerFetch: false }).promise;
  const placed: PlacedText[] = [];
  for (let page = 1; page <= document.numPages; page += 1) {
    const content = await (await document.getPage(page)).getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      placed.push({ page, text: item.str, x: item.transform[4], y: item.transform[5], width: item.width });
    }
  }
  return placed;
};

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

  it('lo resuelve igual en Python, o una celda tipografiada se saldría de su columna', () => {
    // `pdfBuilder.table` typesets a math cell against the width computed here, and
    // `tables.py` draws the gridline at the width computed there. The rule is duplicated
    // because neither side can import the other; this is what keeps the duplicate honest.
    const source = readFileSync(fileURLToPath(new URL('../../../python/structureco_report/tables.py', import.meta.url)), 'utf8');
    const body = source.slice(source.indexOf('def resolve_column_widths'), source.indexOf('class Table'));
    expect(body).toContain('remaining = available - fixed');
    expect(body).toContain('remaining * column.get("flex", 1) / flex_total');
    expect(body).toContain('[available / len(columns)] * len(columns)');
  });
});

describe('PdfLayout.table', () => {
  it('declara columnas y filas, y deja la paginación al renderizador', () => {
    const blocks = compose((layout) => layout.table(columns, [['N1', '0', '0'], ['N2', '4', '3']]));
    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    if (block.kind !== 'table') throw new Error('expected a table block');
    expect(block.columns.map((column) => column.header)).toEqual(['Nodo', 'x', 'y']);
    expect(block.rows).toEqual([['N1', '0', '0'], ['N2', '4', '3']]);
    // Nothing about a page: a block that mentioned one could not be re-flowed.
    expect(JSON.stringify(block)).not.toMatch(/page/i);
  });

  it('rellena una fila corta para que una celda ausente no desplace las columnas', () => {
    const blocks = compose((layout) => layout.table(columns, [['solo-una'], ['una', 'dos', 'tres']]));
    const [block] = blocks;
    if (block.kind !== 'table') throw new Error('expected a table block');
    expect(block.rows[0]).toEqual(['solo-una', '', '']);
  });

  it('una tabla vacía es su encabezado, no una excepción', async () => {
    const blocks = compose((layout) => layout.table([{ header: 'Nodo' }, { header: 'x' }], []));
    const items = await renderBlocks(blocks);
    expect(items.some((item) => item.text.includes('Nodo'))).toBe(true);
  }, 120_000);

  it('rompe la página y repite el encabezado en vez de salirse de la hoja', async () => {
    const rows = Array.from({ length: 120 }, (_, index) => [`N${index}`, String(index), String(index * 2)]);
    const items = await renderBlocks(compose((layout) => layout.table(columns, rows)));

    // Every row printed, none dropped at a fold.
    for (const index of [0, 60, 119]) {
      expect(items.some((item) => item.text === `N${index}`)).toBe(true);
    }
    // The header travels with the continuation: the pages carrying rows each carry a 'Nodo'.
    const rowPages = new Set(items.filter((item) => /^N\d+$/.test(item.text)).map((item) => item.page));
    expect(rowPages.size).toBeGreaterThan(1);
    for (const page of rowPages) {
      expect(items.some((item) => item.page === page && item.text === 'Nodo')).toBe(true);
    }
    // And nothing was pushed past the printable floor or the right margin.
    for (const item of items) {
      expect(item.y).toBeGreaterThan(20);
      expect(item.x + item.width).toBeLessThanOrEqual(PAGE_SIZE[0] - MARGIN + 1);
    }
  }, 120_000);

  it('envuelve una celda larga en vez de sobreimprimir la columna siguiente', async () => {
    // A narrow fixed column makes the assertion independent of the page width and of how
    // wide Helvetica happens to render this particular sentence.
    const narrow = [{ header: 'id', width: 50 }, { header: 'detalle', width: 90 }];
    const long = 'dominio x/L=0 -> 1 con una descripcion deliberadamente larga que no cabe en una sola linea';
    const items = await renderBlocks(compose((layout) => layout.table(narrow, [['M1', long]])));

    const fragments = items.filter((item) => long.includes(item.text.trim()) && item.text.trim().length > 3);
    // Four-plus wrapped lines in a 90 pt column, not one clipped line.
    expect(new Set(fragments.map((item) => Math.round(item.y))).size).toBeGreaterThanOrEqual(4);
    for (const fragment of fragments) {
      expect(fragment.width).toBeLessThanOrEqual(90);
    }
  }, 120_000);
});
