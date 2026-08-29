/**
 * The one piece of furniture a figure still owns: its frame and its inside tag.
 *
 * The running head, the footer, the cover ground, the wordmark and the cover's fact column
 * used to live here too. All five are page furniture — they need to know how many pages exist,
 * or which part a sheet belongs to — and page furniture belongs to the renderer now
 * (`python/structureco_report/doc.py` and `cover.py`). What is left is what a *drawing* needs,
 * composed inside the figure's own rectangle and carried with it.
 */
import { pdfText } from './pdfGlyphs';
import { MARGIN } from './pdfBuilder';
import { TYPE } from './pdfTheme';
import type { PdfLayout } from './pdfBuilder';
import type { Rect, Tone } from './reportDocument';

/**
 * Hairline frame for artwork.
 *
 * Figures used to sit in a filled, bordered panel with their own title inside. A single
 * hairline on a white ground keeps the drawing the darkest thing in its own rectangle, which
 * is the only reason the frame is there.
 */
export const drawFigureFrame = (layout: PdfLayout, rect: Rect): void => {
  layout.surface.drawRectangle({
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
  color: Tone,
): void => {
  layout.surface.drawText(pdfText(text.toUpperCase()), {
    x, y, size: TYPE.micro, font: layout.fonts.bold, color,
  });
};

export { MARGIN };
