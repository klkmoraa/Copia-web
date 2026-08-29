/**
 * The drawing surface a figure is composed on.
 *
 * Before the ReportLab migration every diagram in the report drew straight onto a `pdf-lib`
 * page, which tied artwork that is pure geometry — a projection, an arrow, a support glyph — to
 * one particular PDF library *and* to the page it happened to land on. `Surface` is the same
 * drawing vocabulary with the page taken out: calls in, `SceneMark`s out, in figure-local
 * coordinates. The renderer replays them; the geometry never knows which renderer that is.
 *
 * The method names and argument shapes deliberately mirror the ones the scenes already used,
 * because the point of this seam is that `pdfScene.ts` and its callers kept their geometry
 * unchanged through the migration — only where the marks land changed.
 */
import type { FaceName, Rect, SceneMark, Tone } from './reportDocument';
import { widthOfTextAtSize, type StandardFontName } from './standardFontWidths';

export interface Point {
  x: number;
  y: number;
}

/**
 * One of the document's faces, as the geometry sees it: a name to draw with and a ruler.
 *
 * Nothing embeds a font any more — ReportLab holds the three standard faces — but a drawing
 * still has to measure a label before it can decide where to put it, so the metrics travel
 * with the name.
 */
export interface ReportFont {
  readonly face: FaceName;
  readonly standardName: StandardFontName;
  widthOfTextAtSize(text: string, size: number): number;
}

const createFont = (face: FaceName, standardName: StandardFontName): ReportFont => ({
  face,
  standardName,
  widthOfTextAtSize: (text, size) => widthOfTextAtSize(standardName, text, size),
});

export interface ReportFonts {
  readonly regular: ReportFont;
  readonly bold: ReportFont;
  /** Times: the plain-prose fallback when the typesetter cannot parse an expression. */
  readonly mathRegular: ReportFont;
}

export const REPORT_FONTS: ReportFonts = {
  regular: createFont('regular', 'Helvetica'),
  bold: createFont('bold', 'Helvetica-Bold'),
  mathRegular: createFont('mathRegular', 'Times-Roman'),
};

export interface LineOptions {
  start: Point;
  end: Point;
  thickness?: number;
  color: Tone;
  dashArray?: readonly number[];
  opacity?: number;
}

export interface TextOptions {
  x: number;
  y: number;
  size: number;
  font?: ReportFont;
  color: Tone;
}

export interface RectangleOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: Tone;
  borderColor?: Tone;
  borderWidth?: number;
  opacity?: number;
}

export interface CircleOptions {
  x: number;
  y: number;
  /** Radius. Named `size` because that is what the scenes have always called it. */
  size: number;
  color?: Tone;
  borderColor?: Tone;
  borderWidth?: number;
  opacity?: number;
}

const dashOf = (dashArray?: readonly number[]): readonly [number, number] | undefined =>
  dashArray && dashArray.length >= 2 ? [dashArray[0], dashArray[1]] : undefined;

/**
 * Records marks in figure-local points, with `(0, 0)` at the bottom-left of the figure.
 *
 * Local coordinates are what makes a figure pagination-independent: the composer knows the
 * rectangle's size, never its position, so the same marks are correct wherever the renderer
 * decides the figure fits.
 */
export class Surface {
  readonly marks: SceneMark[] = [];

  drawLine(options: LineOptions): void {
    this.marks.push({
      t: 'line',
      from: { x: options.start.x, y: options.start.y },
      to: { x: options.end.x, y: options.end.y },
      tone: options.color,
      width: options.thickness,
      dash: dashOf(options.dashArray),
      opacity: options.opacity,
    });
  }

  drawText(text: string, options: TextOptions): void {
    if (!text) return;
    this.marks.push({
      t: 'text',
      at: { x: options.x, y: options.y },
      text,
      size: options.size,
      tone: options.color,
      face: options.font?.face ?? 'regular',
    });
  }

  drawRectangle(options: RectangleOptions): void {
    const rect: Rect = { x: options.x, y: options.y, width: options.width, height: options.height };
    this.marks.push({
      t: 'rect',
      rect,
      fill: options.color,
      stroke: options.borderColor,
      width: options.borderWidth,
      opacity: options.opacity,
    });
  }

  drawCircle(options: CircleOptions): void {
    this.marks.push({
      t: 'circle',
      at: { x: options.x, y: options.y },
      radius: options.size,
      fill: options.color,
      stroke: options.borderColor,
      width: options.borderWidth,
      opacity: options.opacity,
    });
  }

  /** Marks composed elsewhere — a typeset formula, a nested component — dropped in as they are. */
  push(marks: readonly SceneMark[]): void {
    this.marks.push(...marks);
  }
}
