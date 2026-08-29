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
import type { FaceName, LineCap, LineJoin, PathOp, Rect, SceneMark, Tone } from './reportDocument';
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
  cap?: LineCap;
}

export interface TextOptions {
  x: number;
  y: number;
  size: number;
  font?: ReportFont;
  color: Tone;
  align?: 'left' | 'right';
  /** Knock the glyphs out of what they sit on, so a value over its own curve stays readable. */
  halo?: Tone;
}

export interface PolylineOptions {
  points: readonly Point[];
  thickness?: number;
  color: Tone;
  dashArray?: readonly number[];
  opacity?: number;
  cap?: LineCap;
  join?: LineJoin;
}

export interface PathOptions {
  fill?: Tone;
  stroke?: Tone;
  thickness?: number;
  dashArray?: readonly number[];
  opacity?: number;
  cap?: LineCap;
  join?: LineJoin;
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
  dashArray?: readonly number[];
  opacity?: number;
}

/**
 * Builds one path, in figure-local points.
 *
 * Cubic segments only: a caller with a quadratic raises it first, and a circular arc arrives as
 * the Béziers `arcOps` derives. Keeping the curve maths on this side is deliberate — the
 * renderer strokes and fills what it is given and decides no geometry of its own.
 */
export class PathBuilder {
  readonly ops: PathOp[] = [];

  moveTo(x: number, y: number): this {
    this.ops.push({ o: 'm', x, y });
    return this;
  }

  lineTo(x: number, y: number): this {
    this.ops.push({ o: 'l', x, y });
    return this;
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): this {
    this.ops.push({ o: 'c', x1, y1, x2, y2, x, y });
    return this;
  }

  /** A run of points as straight segments, continuing the current subpath if one is open. */
  polyline(points: readonly Point[]): this {
    points.forEach((point, index) => {
      if (index === 0 && !this.ops.length) this.moveTo(point.x, point.y);
      else this.lineTo(point.x, point.y);
    });
    return this;
  }

  close(): this {
    this.ops.push({ o: 'z' });
    return this;
  }
}

/**
 * A circular arc as cubic Béziers: centre, radius, and the angles it runs between, in radians.
 *
 * Split so no segment exceeds a quarter turn, where the standard `k = 4/3·tan(Δ/4)` control
 * offset is accurate to about one part in ten thousand of the radius — far below a hairline at
 * any size this document draws. The previous renderer had no arc at all and approximated one
 * with twenty-four straight segments, which faceted visibly on the larger moment symbols.
 */
export const arcOps = (centre: Point, radius: number, from: number, to: number): PathOp[] => {
  const sweep = to - from;
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
  const step = sweep / steps;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (angle: number): Point => ({
    x: centre.x + radius * Math.cos(angle),
    y: centre.y + radius * Math.sin(angle),
  });
  const ops: PathOp[] = [];
  let angle = from;
  let point = at(angle);
  ops.push({ o: 'm', x: point.x, y: point.y });
  for (let index = 0; index < steps; index += 1) {
    const next = angle + step;
    const end = at(next);
    ops.push({
      o: 'c',
      x1: point.x - k * radius * Math.sin(angle),
      y1: point.y + k * radius * Math.cos(angle),
      x2: end.x + k * radius * Math.sin(next),
      y2: end.y - k * radius * Math.cos(next),
      x: end.x,
      y: end.y,
    });
    angle = next;
    point = end;
  }
  return ops;
};

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
      cap: options.cap,
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
      align: options.align,
      halo: options.halo,
    });
  }

  /** A run of segments as one stroke, so its corners join instead of butting against each other. */
  drawPolyline(options: PolylineOptions): void {
    if (options.points.length < 2) return;
    this.marks.push({
      t: 'polyline',
      points: options.points.map((point) => ({ x: point.x, y: point.y })),
      tone: options.color,
      width: options.thickness,
      dash: dashOf(options.dashArray),
      opacity: options.opacity,
      cap: options.cap,
      join: options.join,
    });
  }

  /** An arbitrary path — the only mark that can be *filled*. */
  drawPath(path: PathBuilder, options: PathOptions): void {
    if (!path.ops.length || (options.fill === undefined && options.stroke === undefined)) return;
    this.marks.push({
      t: 'path',
      d: path.ops,
      fill: options.fill,
      stroke: options.stroke,
      width: options.thickness,
      dash: dashOf(options.dashArray),
      opacity: options.opacity,
      cap: options.cap,
      join: options.join,
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
      dash: dashOf(options.dashArray),
      opacity: options.opacity,
    });
  }

  /** Marks composed elsewhere — a typeset formula, a nested component — dropped in as they are. */
  push(marks: readonly SceneMark[]): void {
    this.marks.push(...marks);
  }
}
