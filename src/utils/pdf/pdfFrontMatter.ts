/**
 * Cover and table of contents.
 *
 * A twelve-page report that opened straight onto its executive summary gave the reader no
 * front door: no statement of what this copy is, and no way to reach section six without
 * scrolling for it. The cover carries the identity a signed document needs — project,
 * scenario, date, version, checksum, and the professional notice — and the contents list is
 * stamped last, once every section knows the page it landed on, the same way the footers are.
 */
import { pdfText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const formatStamp = (value: string): string => {
  const stamp = new Date(value);
  if (Number.isNaN(stamp.valueOf())) return value;
  return stamp.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
};

/**
 * Draws the cover on `pageIndex`, which the caller reserved before anything else was drawn.
 * `layout.page` is left where it was: this runs after the document is complete.
 */
export const drawCoverPage = (context: ReportContext, pageIndex: number, professionalNote: string): void => {
  const { layout, project, payload, options } = context;
  const { fonts, palette, rgb, margin, width, height } = layout;
  const page = layout.pages[pageIndex];
  if (!page) return;

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.965, 0.975, 0.968) });
  page.drawRectangle({ x: 0, y: height - 210, width, height: 210, color: palette.forest });
  page.drawText('structureCo', { x: margin, y: height - 78, size: 13, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText('MEMORIA DE CÁLCULO ESTRUCTURAL', { x: margin, y: height - 132, size: 22, font: fonts.bold, color: rgb(1, 1, 1) });

  const name = pdfText(project.name);
  const nameSize = name.length > 48 ? 12 : 15;
  page.drawText(name, { x: margin, y: height - 166, size: nameSize, font: fonts.regular, color: palette.forestSoft });

  const facts: [string, string][] = [
    ['Escenario', pdfText(options.scenarioName ?? 'Análisis activo')],
    ['Generado', formatStamp(payload.provenance.generatedAt)],
    ['Versión', payload.provenance.appVersion],
    ['Integridad SHA-256', payload.checksum.value],
  ];
  let y = height - 258;
  for (const [label, value] of facts) {
    page.drawText(pdfText(label.toUpperCase()), { x: margin, y, size: 6.4, font: fonts.bold, color: rgb(0.40, 0.47, 0.42) });
    // The checksum is a 64-character hash: at 8.6 pt it needs the full content width, so it
    // gets the monospace-ish treatment of a smaller size rather than running past the margin.
    const size = value.length > 60 ? 6.8 : 9.4;
    page.drawText(pdfText(value), { x: margin, y: y - 14, size, font: fonts.regular, color: rgb(0.14, 0.19, 0.16) });
    y -= 42;
  }

  page.drawLine({ start: { x: margin, y: 142 }, end: { x: width - margin, y: 142 }, thickness: 0.7, color: palette.rule });
  const note = pdfText(professionalNote);
  const lines: string[] = [];
  let line = '';
  for (const word of note.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (fonts.regular.widthOfTextAtSize(candidate, 7.6) <= layout.contentWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((entry, index) => page.drawText(entry, {
    x: margin, y: 124 - index * 11, size: 7.6, font: fonts.regular, color: rgb(0.34, 0.40, 0.36),
  }));
};

/** Contents list, drawn under the cover facts once every section knows its page. */
export const drawTableOfContents = (layout: PdfLayout, pageIndex: number): void => {
  const page = layout.pages[pageIndex];
  if (!page || !layout.sections.length) return;
  const { fonts, palette, rgb, margin, width } = layout;

  page.drawText('CONTENIDO', { x: margin, y: 404, size: 7.2, font: fonts.bold, color: palette.forestDeep });
  let y = 384;
  // Four entries deep is where the cover runs into the professional notice; a longer document
  // is served by the outline, which has no such ceiling.
  for (const section of layout.sections.slice(0, 9)) {
    const title = pdfText(section.title);
    const number = String(section.pageIndex + 1);
    const numberWidth = fonts.regular.widthOfTextAtSize(number, 8.6);
    page.drawText(title, { x: margin, y, size: 8.6, font: fonts.regular, color: rgb(0.16, 0.21, 0.18) });
    page.drawText(number, { x: width - margin - numberWidth, y, size: 8.6, font: fonts.regular, color: rgb(0.16, 0.21, 0.18) });
    const from = margin + fonts.regular.widthOfTextAtSize(title, 8.6) + 6;
    const to = width - margin - numberWidth - 6;
    if (to > from) {
      page.drawLine({ start: { x: from, y: y + 2.4 }, end: { x: to, y: y + 2.4 }, thickness: 0.4, color: palette.rule });
    }
    y -= 19;
  }
};
