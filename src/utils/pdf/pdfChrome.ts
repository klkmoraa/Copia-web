/**
 * Editorial chrome shared by the visual pages: masthead, section band, panels and KPI cards.
 *
 * These draw at absolute coordinates on the page the caller has just created, so they never
 * touch the vertical cursor.
 */
import { pdfText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';

/** Dark masthead with the brand mark, the section name and its subtitle. */
export const drawVisualHeader = (layout: PdfLayout, section: string, subtitle: string): void => {
  const { page, rgb, fonts, palette, width, height, margin } = layout;
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: palette.forestDeep });
  page.drawRectangle({ x: margin, y: height - 52, width: 30, height: 30, color: palette.forest });
  page.drawText('S', { x: margin + 9, y: height - 44, size: 17, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText('structureCo', { x: margin + 42, y: height - 38, size: 17, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText('MEMORIA DE CALCULO ESTRUCTURAL', { x: margin + 42, y: height - 52, size: 6.5, font: fonts.bold, color: palette.forestSoft });
  page.drawText(pdfText(section), { x: width - margin - fonts.bold.widthOfTextAtSize(pdfText(section), 12), y: height - 37, size: 12, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText(pdfText(subtitle), { x: width - margin - fonts.regular.widthOfTextAtSize(pdfText(subtitle), 7), y: height - 52, size: 7, font: fonts.regular, color: palette.forestSoft });
};

/** Numbered band that opens every visual section. */
export const drawSectionBand = (layout: PdfLayout, index: string, title: string, subtitle: string): void => {
  const { page, rgb, fonts, palette, margin } = layout;
  page.drawRectangle({ x: margin, y: 724, width: 31, height: 22, color: palette.forest });
  page.drawText(index, { x: margin + 9, y: 731, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText(pdfText(title), { x: margin + 42, y: 732, size: 15, font: fonts.bold, color: palette.forestDeep });
  page.drawText(pdfText(subtitle), { x: margin + 42, y: 719, size: 7.5, font: fonts.regular, color: rgb(0.38, 0.44, 0.40) });
};

/** Bordered container used to group content on the visual pages. */
export const drawPanel = (
  layout: PdfLayout,
  x: number,
  bottom: number,
  width: number,
  height: number,
  color: PdfColor = layout.palette.white,
): void => {
  layout.page.drawRectangle({
    x,
    y: bottom,
    width,
    height,
    color,
    borderColor: layout.rgb(0.78, 0.84, 0.80),
    borderWidth: 0.7,
  });
};

/** Headline figure of the executive page, with its accent rail. */
export const drawKpi = (layout: PdfLayout, x: number, label: string, value: string, color: PdfColor): void => {
  const { page, rgb, fonts } = layout;
  drawPanel(layout, x, 653, 118, 50);
  page.drawRectangle({ x, y: 653, width: 4, height: 50, color });
  page.drawText(pdfText(label.toUpperCase()), { x: x + 12, y: 683, size: 6.5, font: fonts.bold, color: rgb(0.38, 0.44, 0.40) });
  page.drawText(pdfText(value), { x: x + 12, y: 663, size: 11.5, font: fonts.bold, color });
};
