#!/usr/bin/env node
/**
 * Editorial inspection of a generated PDF, without a rendering toolchain.
 *
 * Extracts per-page text with the PDF.js build the app already ships, then reports the
 * checks §20 of the 0.8.1 program asks for: page count, running header and footer,
 * blank pages, orphan headings, glyph loss, and text that spills past the margins.
 *
 * Usage: node scripts/inspect-pdf.mjs <file.pdf> [--text]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const [, , target, ...flags] = process.argv;
if (!target) {
  console.error('Uso: node scripts/inspect-pdf.mjs <archivo.pdf> [--text]');
  process.exit(2);
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 48;

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const bytes = new Uint8Array(await readFile(path.resolve(target)));
const byteLength = bytes.byteLength;
const document_ = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;

const pages = [];
for (let number = 1; number <= document_.numPages; number += 1) {
  const page = await document_.getPage(number);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items
    .filter((item) => 'str' in item)
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width ?? 0,
      height: item.height ?? 0,
    }));
  pages.push({ number, viewport, items, text: items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim() });
  page.cleanup();
}
await document_.cleanup();

const problems = [];
const note = (page, kind, detail) => problems.push({ page, kind, detail });

for (const page of pages) {
  const { width, height } = page.viewport;
  if (Math.abs(width - A4_WIDTH) > 1 || Math.abs(height - A4_HEIGHT) > 1) {
    note(page.number, 'tamano', `${width.toFixed(2)} x ${height.toFixed(2)} no es A4`);
  }
  if (page.text === '') note(page.number, 'pagina-vacia', 'sin texto extraible');

  for (const item of page.items) {
    if (item.text.trim() === '') continue;
    const right = item.x + item.width;
    if (item.x < MARGIN - 12) note(page.number, 'margen-izquierdo', `x=${item.x.toFixed(1)} "${item.text.slice(0, 40)}"`);
    if (right > width - MARGIN + 12) note(page.number, 'margen-derecho', `fin=${right.toFixed(1)} "${item.text.slice(0, 40)}"`);
    if (item.y < 14) note(page.number, 'pie', `y=${item.y.toFixed(1)} "${item.text.slice(0, 40)}"`);
    if (item.y > height - 18) note(page.number, 'cabecera', `y=${item.y.toFixed(1)} "${item.text.slice(0, 40)}"`);
  }

  // A heading is orphaned when it is the last thing on a page.
  const lowest = page.items.filter((item) => item.text.trim() !== '').sort((a, b) => a.y - b.y)[0];
  if (lowest && lowest.height >= 10 && lowest.y < 120 && lowest.text.length < 60) {
    note(page.number, 'posible-titulo-huerfano', `"${lowest.text.slice(0, 50)}" a y=${lowest.y.toFixed(0)}`);
  }
}

const allText = pages.map((page) => page.text).join('\n');
const lostGlyphs = allText.match(/[�]/g) ?? [];
if (lostGlyphs.length > 0) note(0, 'glifos-perdidos', `${lostGlyphs.length} caracteres de reemplazo`);

const withoutHeader = pages.filter((page) => page.number > 1 && !/structureCo/i.test(page.text));
const withoutPageNumber = pages.filter((page) => !new RegExp(`\\b${page.number}\\b`).test(page.text));

const metadata = await document_.getMetadata?.().catch(() => null) ?? null;

console.log(`Archivo:   ${path.basename(target)}`);
console.log(`Bytes:     ${byteLength.toLocaleString('es-ES')}`);
console.log(`Paginas:   ${pages.length}`);
console.log(`Texto:     ${allText.length.toLocaleString('es-ES')} caracteres extraibles`);
console.log(`Metadata:  ${metadata?.info ? JSON.stringify({ Title: metadata.info.Title, Author: metadata.info.Author, Subject: metadata.info.Subject, Creator: metadata.info.Creator }) : 'no disponible'}`);
console.log(`Sin cabecera "structureCo": ${withoutHeader.length ? withoutHeader.map((p) => p.number).join(', ') : 'ninguna'}`);
console.log(`Sin numero de pagina visible: ${withoutPageNumber.length ? withoutPageNumber.map((p) => p.number).join(', ') : 'ninguna'}`);

if (flags.includes('--text')) {
  for (const page of pages) {
    console.log(`\n--- pagina ${page.number} (${page.items.length} fragmentos) ---`);
    console.log(page.text.slice(0, 1400));
  }
}

const grouped = new Map();
for (const problem of problems) {
  const list = grouped.get(problem.kind) ?? [];
  list.push(problem);
  grouped.set(problem.kind, list);
}

console.log(`\nHallazgos: ${problems.length}`);
for (const [kind, list] of grouped) {
  console.log(`  ${kind}: ${list.length}`);
  for (const problem of list.slice(0, 6)) console.log(`    p.${problem.page} ${problem.detail}`);
  if (list.length > 6) console.log(`    ... y ${list.length - 6} mas`);
}
