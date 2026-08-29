/**
 * The document's fixed furniture: the cover ground and the summary rails.
 *
 * The running head and the footer are not here — they belong to `PdfLayout.stampChrome`,
 * which is the only thing that can know how many pages exist and which part each one sits in.
 * What is left is the artwork the cover needs, drawn at absolute coordinates on a page the
 * caller supplies, and the one shared frame the figures sit inside.
 *
 * The masthead, the numbered colour band, the bordered panels and the KPI cards that used to
 * live here are gone: three of them existed only to say "these things belong together", which
 * on a page with a grid is already said by alignment.
 */
import { pdfText } from './pdfGlyphs';
import { MARGIN } from './pdfBuilder';
import { TYPE } from './pdfTheme';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';
import type { PDFPage } from 'pdf-lib';

/** The wordmark, set in the two weights the document owns. */
export const drawWordmark = (
  layout: PdfLayout,
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  color: PdfColor,
): number => {
  page.drawText('structure', { x, y, size, font: layout.fonts.regular, color });
  const offset = layout.fonts.regular.widthOfTextAtSize('structure', size);
  page.drawText('Co', { x: x + offset, y, size, font: layout.fonts.bold, color });
  return offset + layout.fonts.bold.widthOfTextAtSize('Co', size);
};

/**
 * Hairline frame for artwork.
 *
 * Figures used to sit in a filled, bordered panel with their own title inside. A single
 * hairline on a white ground keeps the drawing the darkest thing in its own rectangle, which
 * is the only reason the frame is there.
 */
export const drawFigureFrame = (
  layout: PdfLayout,
  rect: { x: number; y: number; width: number; height: number },
): void => {
  layout.page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: layout.palette.paper,
    borderColor: layout.palette.rule,
    borderWidth: 0.5,
  });
};

/** Small caps label anchored inside a figure, where a caption would be too far away. */
export const drawFigureTag = (
  layout: PdfLayout,
  x: number,
  y: number,
  text: string,
  color: PdfColor,
): void => {
  layout.page.drawText(pdfText(text.toUpperCase()), {
    x, y, size: TYPE.micro, font: layout.fonts.bold, color,
  });
};

/** Left-aligned column of `label / value` pairs, used by the cover's identity block. */
export const drawFactColumn = (
  layout: PdfLayout,
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  facts: readonly (readonly [string, string])[],
  labelColor: PdfColor,
  valueColor: PdfColor,
): number => {
  let y = top;
  for (const [label, value] of facts) {
    page.drawText(pdfText(label.toUpperCase()), {
      x, y: y - TYPE.micro, size: TYPE.micro, font: layout.fonts.bold, color: labelColor,
    });
    y -= TYPE.micro * 2.1;
    // A 64-character checksum needs the full measure; anything else reads at the body size.
    const size = value.length > 44 ? TYPE.micro : TYPE.small + 0.6;
    // The checksum is one unbroken token, so wrapping it needs a character-level break; every
    // other fact wraps on its spaces like ordinary prose.
    const tokens = value.includes(' ') ? pdfText(value).split(' ') : (pdfText(value).match(/.{1,48}/g) ?? []);
    const separator = value.includes(' ') ? ' ' : '';
    const lines: string[] = [];
    let line = '';
    for (const token of tokens) {
      const candidate = line ? line + separator + token : token;
      if (layout.fonts.regular.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) lines.push(line);
        line = token;
      }
    }
    if (line) lines.push(line);
    for (const entry of lines.slice(0, 2)) {
      page.drawText(entry, { x, y: y - size, size, font: layout.fonts.regular, color: valueColor });
      y -= size * 1.35;
    }
    y -= TYPE.micro * 1.4;
  }
  return y;
};

export { MARGIN };
