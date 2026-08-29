/**
 * Drawing primitives shared by every piece of artwork in the report.
 *
 * `pdfDiagrams.ts` grew these one at a time and kept them private, so the free-body scenes of
 * the method sections could not reach the projection, the arrow or the support glyph without
 * either importing a diagram or drawing a second, subtly different version of each. They live
 * here now, unchanged in behaviour, plus the three the scenes needed and nobody had written:
 * a moment arc, a dashed line, and the ghosted whole model a free body is cut out of.
 *
 * Everything here draws into `layout.surface` — the figure being composed, in its own local
 * coordinates — and takes its colours from the palette, never from a literal. Nothing reaches
 * for a page: since the ReportLab migration a drawing does not know where it will land, which
 * is what lets the same marks be correct on whichever sheet the renderer puts them.
 */
import type { MemberLoad, NodeModel, SupportDefinition } from '../../types';
import type { SectionGeometry } from '../../features/inspector/sectionGeometry';
import {
  distributedIntensityAt,
  grossRatioFromFlexible,
  lerpPoint,
  memberAxis,
  modelBounds,
  toGlobalVector,
} from '../../graphics/structureGeometry';
import { number } from './pdfFormat';
import { pdfText } from './pdfGlyphs';
import { TYPE } from './pdfTheme';
import type { PdfLayout } from './pdfBuilder';
import type { ReportContext } from './reportContext';
import type { Tone } from './reportDocument';

export interface Point {
  x: number;
  y: number;
}

/**
 * Line weights of the technical drawings, in one place.
 *
 * The discarded portion used to be a dashed grey at half opacity, which reads as noise rather
 * than as context — the eye spends effort deciding whether the dashes mean something. It is a
 * continuous hairline now: present, obviously secondary, and quiet.
 */
export const GHOST_WEIGHT = 0.5;
export const GHOST_OPACITY = 0.55;
/** Dimension lines, witness lines and leaders: the quietest ink on the drawing. */
export const HAIRLINE = 0.4;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlotBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface Projection {
  at(x: number, y: number): Point;
  /** Model units per PDF point, so a scene can size a stub or a radius in real terms. */
  readonly scale: number;
}

/** Uniform model -> page transform that centres the structure inside `plot`. */
export const createProjection = (nodes: readonly NodeModel[], plot: PlotBox): Projection => {
  const { minX, maxX, minY, maxY } = modelBounds(nodes);
  const scale = Math.min(
    (plot.right - plot.left) / Math.max(maxX - minX, 1),
    (plot.top - plot.bottom) / Math.max(maxY - minY, 1),
  );
  const offsetX = (plot.left + plot.right - (maxX - minX) * scale) / 2;
  const offsetY = (plot.bottom + plot.top - (maxY - minY) * scale) / 2;
  return {
    at: (x, y) => ({ x: offsetX + (x - minX) * scale, y: offsetY + (y - minY) * scale }),
    scale,
  };
};

/**
 * Projection centred on one point rather than on the whole model.
 *
 * The Method of Joints draws one pin at a time: fitting the whole truss in the frame would
 * leave the joint a three-point dot with three arrows on top of each other.
 *
 * The two spans are separate on purpose. Fitting a single radius to both axes is right for a
 * truss joint, whose bars leave in every direction, and wrong for a joint on a continuous beam,
 * whose two stubs are collinear: there the vertical span is zero, and scaling by it shrank the
 * drawing to a quarter of the frame it had just been given.
 */
export const createFocusProjection = (
  centre: Point,
  extent: { spanX: number; spanY: number },
  plot: PlotBox,
): Projection => {
  const spanX = Math.max(extent.spanX, 1e-9);
  const scale = Math.min(
    (plot.right - plot.left) / spanX,
    extent.spanY > 1e-9 ? (plot.top - plot.bottom) / extent.spanY : Number.POSITIVE_INFINITY,
  );
  const midX = (plot.left + plot.right) / 2;
  const midY = (plot.bottom + plot.top) / 2;
  return {
    at: (x, y) => ({ x: midX + (x - centre.x) * scale, y: midY + (y - centre.y) * scale }),
    scale,
  };
};

/** Arrow head-first at `location`; returns the tail, where labels are anchored. */
export const drawArrow = (
  layout: PdfLayout,
  location: Point,
  fx: number,
  fy: number,
  color: Tone,
  length: number,
  thickness = 1.15,
): Point | undefined => {
  const magnitude = Math.hypot(fx, fy);
  if (!(magnitude > 1e-12)) return undefined;
  const dx = fx / magnitude * length;
  const dy = fy / magnitude * length;
  const tail = { x: location.x - dx, y: location.y - dy };
  const page = layout.surface;
  page.drawLine({ start: tail, end: location, thickness, color });
  page.drawLine({ start: location, end: { x: location.x - dx * 0.30 - dy * 0.15, y: location.y - dy * 0.30 + dx * 0.15 }, thickness: thickness * 0.87, color });
  page.drawLine({ start: location, end: { x: location.x - dx * 0.30 + dy * 0.15, y: location.y - dy * 0.30 - dx * 0.15 }, thickness: thickness * 0.87, color });
  return tail;
};

/** Dashed segment, in the document's one dash pattern. */
export const drawDashedLine = (
  layout: PdfLayout,
  from: Point,
  to: Point,
  color: Tone,
  thickness = 0.9,
): void => {
  layout.surface.drawLine({ start: from, end: to, thickness, color, dashArray: [3.2, 2.4] });
};

/**
 * Circular arc with an arrowhead at its leading end: a moment, drawn the way one is drawn on
 * paper. `sign > 0` turns counter-clockwise, which is the positive sense of the model's own
 * `Mz`, so the drawing and the number never disagree.
 *
 * The mark vocabulary carries no arc, so the arc is a polyline — at this radius and this
 * segment count the facets are well under the line width.
 */
export const drawMomentArc = (
  layout: PdfLayout,
  centre: Point,
  sign: number,
  radius: number,
  color: Tone,
  thickness = 1.1,
): Point => {
  const page = layout.surface;
  const direction = sign >= 0 ? 1 : -1;
  const from = Math.PI * 0.25;
  const sweep = Math.PI * 1.35;
  const steps = 24;
  const at = (angle: number): Point => ({
    x: centre.x + radius * Math.cos(angle),
    y: centre.y + radius * Math.sin(angle),
  });
  let previous = at(from);
  let last = previous;
  for (let step = 1; step <= steps; step += 1) {
    const angle = from + direction * sweep * (step / steps);
    const point = at(angle);
    page.drawLine({ start: previous, end: point, thickness, color });
    previous = point;
    last = point;
  }
  // Head tangent to the arc at its leading end: rotating the radius by a quarter turn in the
  // direction of travel is the tangent, which is what makes the arrow read as a rotation.
  const endAngle = from + direction * sweep;
  const tangent = { x: -Math.sin(endAngle) * direction, y: Math.cos(endAngle) * direction };
  const head = 4.6;
  const normal = { x: -tangent.y, y: tangent.x };
  page.drawLine({
    start: last,
    end: { x: last.x - tangent.x * head + normal.x * head * 0.5, y: last.y - tangent.y * head + normal.y * head * 0.5 },
    thickness,
    color,
  });
  page.drawLine({
    start: last,
    end: { x: last.x - tangent.x * head - normal.x * head * 0.5, y: last.y - tangent.y * head - normal.y * head * 0.5 },
    thickness,
    color,
  });
  return last;
};

/**
 * Vertical room a support glyph occupies below its node, so a reaction arrow can start clear of
 * it instead of being drawn straight through the triangle.
 */
export const SUPPORT_DEPTH = 20;

/**
 * The support symbol under `location`: the triangle every support shares, plus the rollers and
 * the ground line that tell a pin from a roller from a fixed end.
 *
 * Lifted verbatim out of `drawGlobalDcl`'s node loop — same geometry, same sizes — so the free
 * body of a cut portion draws its supports exactly as the global diagram draws them.
 */
export const drawSupportGlyph = (
  layout: PdfLayout,
  location: Point,
  support: SupportDefinition,
  color: Tone,
): void => {
  if (support.type === 'none') return;
  const page = layout.surface;
  page.drawLine({ start: { x: location.x, y: location.y - 3 }, end: { x: location.x - 7, y: location.y - 13 }, thickness: 1, color });
  page.drawLine({ start: { x: location.x, y: location.y - 3 }, end: { x: location.x + 7, y: location.y - 13 }, thickness: 1, color });
  if (support.type === 'roller') {
    page.drawCircle({ x: location.x - 4, y: location.y - 15.5, size: 1.8, borderColor: color, borderWidth: 0.8 });
    page.drawCircle({ x: location.x + 4, y: location.y - 15.5, size: 1.8, borderColor: color, borderWidth: 0.8 });
    page.drawLine({ start: { x: location.x - 10, y: location.y - 19 }, end: { x: location.x + 10, y: location.y - 19 }, thickness: 1, color });
    return;
  }
  page.drawLine({ start: { x: location.x - 9, y: location.y - 13 }, end: { x: location.x + 9, y: location.y - 13 }, thickness: 1, color });
  if (support.type === 'fixed' || (support.type === 'custom' && support.restrainR === true)) {
    // Hatching under the ground line: the one mark that separates a fixed end from a pin
    // without reading the label.
    for (let index = -2; index <= 2; index += 1) {
      const x = location.x + index * 4.5;
      page.drawLine({ start: { x, y: location.y - 13 }, end: { x: x - 3.5, y: location.y - 18 }, thickness: 0.6, color });
    }
  }
};

/** A node dot with its id beside it, the way every diagram in the report draws one. */
export const drawNodeDot = (
  layout: PdfLayout,
  location: Point,
  id: string,
  color: Tone,
  size = 3,
  labelSize = 6.5,
): void => {
  const page = layout.surface;
  page.drawCircle({ x: location.x, y: location.y, size, color: layout.palette.paper, borderColor: color, borderWidth: 1.1 });
  if (id) page.drawText(pdfText(id), { x: location.x + size + 2, y: location.y + size + 1, size: labelSize, font: layout.fonts.bold, color });
};

export interface GhostOptions {
  /** Members drawn at full strength; everything else is ghosted. Absent means ghost all. */
  readonly solidMemberIds?: ReadonlySet<string>;
  /** Nodes drawn at full strength. Absent means ghost all. */
  readonly solidNodeIds?: ReadonlySet<string>;
  /** Ghosted geometry is dropped entirely rather than drawn faint. */
  readonly hideGhost?: boolean;
  /** Members this pass must not draw at all, because the caller draws them in two halves. */
  readonly skipMemberIds?: ReadonlySet<string>;
  /** Stroke of a retained member, scaled to the plot by `sceneMetrics`. */
  readonly weight?: number;
  readonly nodeSize?: number;
  readonly labelSize?: number;
}

/**
 * The whole structure under a free body: the retained part in ink, the rest a faint outline.
 *
 * A cut portion drawn on its own tells the reader what was kept but not what it was cut from,
 * which is the one thing a section drawing exists to say.
 */
export const drawGhostModel = (
  context: ReportContext,
  projection: Projection,
  options: GhostOptions = {},
): void => {
  const { layout, project, index } = context;
  const { palette } = layout;
  const page = layout.surface;
  const solidMembers = options.solidMemberIds;
  const solidNodes = options.solidNodeIds;
  for (const member of project.members) {
    const ni = index.node(member.i);
    const nj = index.node(member.j);
    if (!ni || !nj) continue;
    if (options.skipMemberIds?.has(member.id)) continue;
    const solid = solidMembers === undefined || solidMembers.has(member.id);
    if (!solid && options.hideGhost) continue;
    const weight = options.weight ?? 2;
    page.drawLine({
      start: projection.at(ni.x, ni.y),
      end: projection.at(nj.x, nj.y),
      thickness: solid ? (member.type === 'rigid' ? weight * 1.5 : weight) : GHOST_WEIGHT,
      color: solid ? palette.ink : palette.inkFaint,
      opacity: solid ? 1 : GHOST_OPACITY,
    });
  }
  for (const node of project.nodes) {
    const solid = solidNodes === undefined || solidNodes.has(node.id);
    if (!solid && options.hideGhost) continue;
    const location = projection.at(node.x, node.y);
    if (!solid) {
      page.drawCircle({ x: location.x, y: location.y, size: 1.5, color: palette.inkFaint, opacity: GHOST_OPACITY });
      continue;
    }
    drawNodeDot(layout, location, node.id, palette.ink, options.nodeSize, options.labelSize);
    drawSupportGlyph(layout, location, node.support, palette.inkSoft);
  }
};

/**
 * The outline of a cross-section, to scale, inside `rect`.
 *
 * The shape comes from `resolveSectionGeometry`, which is the product's own rule: a real
 * profile is only drawn when the member declares an explicit catalogue identity; anything else
 * resolves to the equivalent rectangle `h = √(12·I/A)` and is labelled as such by the caller.
 * Nothing here infers a commercial profile from `A` and `I`.
 */
export const drawSectionShape = (
  layout: PdfLayout,
  rect: Rect,
  geometry: SectionGeometry,
  color: Tone,
): void => {
  const page = layout.surface;
  const scale = Math.min(
    rect.width / Math.max(geometry.width, 1e-6),
    rect.height / Math.max(geometry.depth, 1e-6),
  ) * 0.82;
  const w = geometry.width * scale;
  const h = geometry.depth * scale;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const left = cx - w / 2;
  const bottom = cy - h / 2;
  const flange = Math.max(geometry.flange * scale, 1.4);
  const web = Math.max(geometry.web * scale, 1.4);
  const fill = (x: number, y: number, width: number, height: number) =>
    page.drawRectangle({ x, y, width, height, color });

  switch (geometry.shapeType) {
    case 'I':
      fill(left, bottom, w, flange);
      fill(left, bottom + h - flange, w, flange);
      fill(cx - web / 2, bottom + flange, web, h - flange * 2);
      break;
    case 'C':
      fill(left, bottom, w, flange);
      fill(left, bottom + h - flange, w, flange);
      fill(left, bottom + flange, web, h - flange * 2);
      break;
    case 'L':
      fill(left, bottom, w, flange);
      fill(left, bottom + flange, web, h - flange);
      break;
    case 'HSS_RECT':
      fill(left, bottom, w, h);
      page.drawRectangle({
        x: left + web, y: bottom + flange, width: Math.max(w - web * 2, 0), height: Math.max(h - flange * 2, 0),
        color: layout.palette.paper,
      });
      break;
    case 'HSS_ROUND': {
      const radius = Math.min(w, h) / 2;
      page.drawCircle({ x: cx, y: cy, size: radius, color });
      page.drawCircle({ x: cx, y: cy, size: Math.max(radius - web, 0.5), color: layout.palette.paper });
      break;
    }
    default:
      fill(left, bottom, w, h);
      break;
  }
  // The neutral axis is the reference every section property in the table beside this drawing
  // is measured about, so it is drawn rather than assumed.
  page.drawLine({
    start: { x: left - 8, y: cy },
    end: { x: left + w + 8, y: cy },
    thickness: 0.5,
    color: layout.palette.inkFaint,
    dashArray: [3, 2],
  });
};

/** Geometry of the drawn shape, so a caller can hang its dimension lines off the same box. */
export const sectionShapeBox = (rect: Rect, geometry: SectionGeometry): Rect => {
  const scale = Math.min(
    rect.width / Math.max(geometry.width, 1e-6),
    rect.height / Math.max(geometry.depth, 1e-6),
  ) * 0.82;
  const width = geometry.width * scale;
  const height = geometry.depth * scale;
  return {
    x: rect.x + rect.width / 2 - width / 2,
    y: rect.y + rect.height / 2 - height / 2,
    width,
    height,
  };
};

export interface MemberLoadOptions {
  /**
   * Members whose loads are drawn. Absent draws every member's.
   *
   * A free body only carries the actions that act *on it*: drawing the load of a member the
   * cut discarded would put a force on the drawing that appears in none of the equations
   * underneath it.
   */
  readonly onlyMemberIds?: ReadonlySet<string>;
  /** Station, 0..1 along the member, past which a load is not drawn. */
  readonly upTo?: (memberId: string) => number;
  /** Arrow length of a distributed run, scaled to the plot. */
  readonly arrow?: number;
}

/**
 * Applied member loads — distributed runs, point loads and applied moments — projected onto
 * the page.
 *
 * Lifted out of `drawGlobalDcl` so the free-body scenes draw the applied actions exactly as
 * the report's other diagrams draw them, arrow for arrow. Applied actions keep the one indigo
 * of `--sc-color-load-point`; a response quantity never borrows it, and it never borrows
 * theirs — on a free-body diagram a cause must not be mistakable for an effect.
 */
export const drawMemberLoads = (
  context: ReportContext,
  projection: Projection,
  options: MemberLoadOptions = {},
): Rect[] => {
  const { layout, project, index, scenarioFactors } = context;
  const { palette, fonts } = layout;
  const page = layout.surface;
  // The boxes these labels occupy, so a scene's own label placer can keep clear of them: a
  // load's name is drawn here, not by the placer, and values kept landing on top of it.
  const boxes: Rect[] = [];
  for (const load of project.memberLoads) {
    if (options.onlyMemberIds && !options.onlyMemberIds.has(load.memberId)) continue;
    const factor = scenarioFactors[load.caseId] ?? 0;
    if (factor === 0) continue;
    const member = index.member(load.memberId);
    if (!member) continue;
    const startNode = index.node(member.i);
    const endNode = index.node(member.j);
    if (!startNode || !endNode) continue;
    const screenStart = projection.at(startNode.x, startNode.y);
    const screenEnd = projection.at(endNode.x, endNode.y);
    const axis = memberAxis(member, startNode, endNode);
    if (!(axis.length > 0) || !(axis.flexibleLength > 0)) continue;
    const limit = options.upTo?.(load.memberId) ?? 1;
    const atFlexibleRatio = (ratio: number) => lerpPoint(screenStart, screenEnd, grossRatioFromFlexible(axis, ratio));
    const globalVector = (x: number, y: number): [number, number] =>
      toGlobalVector(axis, load.coordinateSystem, x, y);
    const actionColor = palette.load;
    if (load.type === 'distributed') {
      const startRatio = Math.min(load.start, load.end);
      const endRatio = Math.min(Math.max(load.start, load.end), limit);
      if (!(endRatio > startRatio)) continue;
      const arrowTails: Point[] = [];
      const count = 7;
      for (let arrowIndex = 0; arrowIndex < count; arrowIndex += 1) {
        const t = arrowIndex / (count - 1);
        const ratio = startRatio + (endRatio - startRatio) * t;
        const intensity = distributedIntensityAt(load, t);
        const [gx, gy] = globalVector(intensity.qx * factor, intensity.qy * factor);
        const tail = drawArrow(layout, atFlexibleRatio(ratio), gx, gy, actionColor, options.arrow ?? 16);
        if (tail) arrowTails.push(tail);
      }
      if (arrowTails.length > 1) page.drawLine({ start: arrowTails[0], end: arrowTails.at(-1)!, thickness: 0.9, color: actionColor });
      const label = atFlexibleRatio((startRatio + endRatio) / 2);
      const text = pdfText(`${load.id} [${number(startRatio)}-${number(endRatio)}]`);
      page.drawText(text, { x: label.x + 3, y: label.y + 20, size: 6, font: fonts.bold, color: actionColor });
      boxes.push({ x: label.x + 3, y: label.y + 20, width: fonts.bold.widthOfTextAtSize(text, 6), height: 6 });
    } else if (load.type === 'point') {
      const position = Math.min(1, Math.max(0, load.position ?? 0.5));
      if (position > limit) continue;
      const [gx, gy] = globalVector((load.px ?? 0) * factor, (load.py ?? 0) * factor);
      const location = atFlexibleRatio(position);
      const tail = drawArrow(layout, location, gx, gy, actionColor, (options.arrow ?? 16) * 1.35) ?? location;
      page.drawText(pdfText(load.id), { x: tail.x + 2, y: tail.y + 5, size: 6, font: fonts.bold, color: actionColor });
      boxes.push({ x: tail.x + 2, y: tail.y + 5, width: fonts.bold.widthOfTextAtSize(pdfText(load.id), 6), height: 6 });
    } else {
      const position = Math.min(1, Math.max(0, load.position ?? 0.5));
      if (position > limit) continue;
      const location = atFlexibleRatio(position);
      const text = pdfText(`${load.id}: M x ${number(factor)}`);
      page.drawText(text, { x: location.x + 4, y: location.y + 8, size: 6, font: fonts.bold, color: actionColor });
      boxes.push({ x: location.x + 4, y: location.y + 8, width: fonts.bold.widthOfTextAtSize(text, 6), height: 6 });
    }
  }
  return boxes;
};

/** A `MemberLoad`'s own type, re-exported so callers need not reach into `types.ts`. */
export type { MemberLoad };

// ---------------------------------------------------------------------------------------
// Technical drawing vocabulary
// ---------------------------------------------------------------------------------------

/**
 * A dimension, drawn the way a technical drawing draws one: witness lines out to the measured
 * points, a dimension line between them offset clear of the geometry, ticks at 45° on both
 * ends, and the value centred on it.
 *
 * Returns the box the text occupies so the caller can keep other labels out of it — a dimension
 * is the quietest ink on the drawing and must not be what a value gets written over.
 */
export const drawDimension = (
  layout: PdfLayout,
  from: Point,
  to: Point,
  offset: number,
  text: string,
  color: Tone,
): Rect | undefined => {
  const page = layout.surface;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 1e-6)) return undefined;
  // Offset perpendicular to the measured direction; the sign of `offset` picks the side.
  const normal = { x: -dy / length * offset, y: dx / length * offset };
  const a = { x: from.x + normal.x, y: from.y + normal.y };
  const b = { x: to.x + normal.x, y: to.y + normal.y };
  const witness = 3;
  const overshoot = { x: normal.x === 0 && normal.y === 0 ? 0 : normal.x / offset * witness, y: normal.x === 0 && normal.y === 0 ? 0 : normal.y / offset * witness };

  // Witness lines run from just clear of the geometry to just past the dimension line.
  page.drawLine({ start: from, end: { x: a.x + overshoot.x, y: a.y + overshoot.y }, thickness: HAIRLINE, color });
  page.drawLine({ start: to, end: { x: b.x + overshoot.x, y: b.y + overshoot.y }, thickness: HAIRLINE, color });
  page.drawLine({ start: a, end: b, thickness: HAIRLINE, color });

  // Ticks at 45° to the dimension line — the ISO alternative to arrowheads, and the one that
  // stays legible at this size.
  const unit = { x: dx / length, y: dy / length };
  const tick = 2.6;
  for (const end of [a, b]) {
    page.drawLine({
      start: { x: end.x - (unit.x + unit.y) * tick, y: end.y - (unit.y - unit.x) * tick },
      end: { x: end.x + (unit.x + unit.y) * tick, y: end.y + (unit.y - unit.x) * tick },
      thickness: HAIRLINE,
      color,
    });
  }

  const label = pdfText(text);
  const size = TYPE.micro;
  const width = layout.fonts.regular.widthOfTextAtSize(label, size);
  const box: Rect = {
    x: (a.x + b.x) / 2 - width / 2,
    y: (a.y + b.y) / 2 + 2,
    width,
    height: size,
  };
  page.drawText(label, { x: box.x, y: box.y, size, font: layout.fonts.regular, color });
  return box;
};

/** Thin guide from a label to the thing it names, when the label could not sit beside it. */
export const drawLeader = (layout: PdfLayout, from: Point, to: Point, color: Tone): void => {
  layout.surface.drawLine({ start: from, end: to, thickness: HAIRLINE, color, opacity: 0.8 });
  layout.surface.drawCircle({ x: to.x, y: to.y, size: 0.9, color });
};

/**
 * An open circle: the hinge at a point of inflection, and the internal hinge of a model.
 *
 * The approximate frame methods put the moment at zero at a definite height of every column and
 * then reason about the piece below it as a free body. Drawing that assumption is the difference
 * between a diagram a reader can check and one they have to take on trust.
 */
export const drawHinge = (layout: PdfLayout, at: Point, size: number, color: Tone): void => {
  layout.surface.drawCircle({ x: at.x, y: at.y, size, color: layout.palette.paper, borderColor: color, borderWidth: 0.9 });
};

/** The cut itself: a bolder dash than the geometry, with a tick closing each end. */
export const drawCutLine = (layout: PdfLayout, from: Point, to: Point, color: Tone): void => {
  const page = layout.surface;
  page.drawLine({ start: from, end: to, thickness: 1.2, color, dashArray: [4.2, 2.6] });
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length * 3, y: dx / length * 3 };
  for (const end of [from, to]) {
    page.drawLine({
      start: { x: end.x - normal.x, y: end.y - normal.y },
      end: { x: end.x + normal.x, y: end.y + normal.y },
      thickness: 1.2,
      color,
    });
  }
};

/**
 * The global axes, in a corner.
 *
 * Every arrow on these drawings carries a sign that only means something against a stated pair
 * of axes. Naming them costs a corner and makes the whole drawing checkable.
 */
export const drawAxesIndicator = (layout: PdfLayout, at: Point, size: number, color: Tone): void => {
  const page = layout.surface;
  drawArrow(layout, { x: at.x + size, y: at.y }, 1, 0, color, size, 0.6);
  drawArrow(layout, { x: at.x, y: at.y + size }, 0, 1, color, size, 0.6);
  page.drawText(pdfText('x'), { x: at.x + size + 1.5, y: at.y - 2, size: TYPE.micro, font: layout.fonts.regular, color });
  page.drawText(pdfText('y'), { x: at.x - 4.5, y: at.y + size + 0.5, size: TYPE.micro, font: layout.fonts.regular, color });
};

/** Evaluates a polynomial given lowest-power-first coefficients, by Horner's rule. */
export const evaluatePolynomial = (coefficients: readonly number[], x: number): number => {
  let value = 0;
  for (let power = coefficients.length - 1; power >= 0; power -= 1) value = value * x + coefficients[power];
  return value;
};

export interface PolynomialCurveOptions {
  /** Samples across the interval. */
  readonly steps?: number;
  /** Fills the area between the curve and the baseline, which is what an area diagram wants. */
  readonly fill?: boolean;
  readonly thickness?: number;
}

/**
 * A polynomial of the analysis, drawn over a straight baseline.
 *
 * The free-moment diagram of a span and the fictitious `M/EI` load of a conjugate beam are both
 * polynomials the method already solved; this draws them where the beam is, at a stated
 * amplitude, so a reader sees the shape the arithmetic beside it integrates. It is deliberately
 * shape-only — the vertical scale is chosen to fill the space given and is never claimed to be
 * to scale, exactly as `drawElasticCurve` says of the elastic curve.
 *
 * Returns the peak value and where it fell, which is what a caller needs to hang a label on.
 */
export const drawPolynomialCurve = (
  layout: PdfLayout,
  coefficients: readonly number[],
  domain: { x0: number; x1: number },
  baseline: { from: Point; to: Point },
  amplitude: number,
  color: Tone,
  options: PolynomialCurveOptions = {},
): { peak: number; peakAt: number } => {
  const page = layout.surface;
  const steps = options.steps ?? 48;
  const span = domain.x1 - domain.x0;
  if (!(span > 0)) return { peak: 0, peakAt: domain.x0 };
  const dx = baseline.to.x - baseline.from.x;
  const dy = baseline.to.y - baseline.from.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };

  const samples: { x: number; value: number }[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const x = domain.x0 + (span * step) / steps;
    samples.push({ x, value: evaluatePolynomial(coefficients, x) });
  }
  const peakSample = samples.reduce((best, sample) => Math.abs(sample.value) > Math.abs(best.value) ? sample : best, samples[0]);
  const peak = Math.abs(peakSample.value) || 1;

  const pointAt = (sample: { x: number; value: number }) => {
    const ratio = (sample.x - domain.x0) / span;
    const base = { x: baseline.from.x + dx * ratio, y: baseline.from.y + dy * ratio };
    const rise = (sample.value / peak) * amplitude;
    return { base, curve: { x: base.x + normal.x * rise, y: base.y + normal.y * rise } };
  };

  let previous = pointAt(samples[0]);
  for (const sample of samples.slice(1)) {
    const point = pointAt(sample);
    if (options.fill) {
      // Vertical hatch to the baseline: the area is what the method integrates, so it is shown
      // as an area rather than as an outline.
      page.drawLine({ start: point.base, end: point.curve, thickness: HAIRLINE, color, opacity: 0.28 });
    }
    page.drawLine({ start: previous.curve, end: point.curve, thickness: options.thickness ?? 1.3, color });
    previous = point;
  }
  return { peak: peakSample.value, peakAt: peakSample.x };
};

/**
 * The boundary of what has been isolated: a dashed circle around a joint.
 *
 * The Method of Joints cuts one pin free of the truss. Without the boundary drawn, the figure
 * shows some bars in ink and leaves the reader to work out where the free body ends — which is
 * the one thing the drawing exists to state.
 */
export const drawIsolationBoundary = (
  layout: PdfLayout,
  centre: Point,
  radius: number,
  color: Tone,
): void => {
  // There is no dashed-circle mark, so the circle is a dashed polygon; at this radius the
  // facets are well under the line width.
  const steps = 40;
  const dash = 2;
  for (let step = 0; step < steps; step += 1) {
    if (step % dash === 1) continue;
    const from = (step / steps) * Math.PI * 2;
    const to = ((step + 1) / steps) * Math.PI * 2;
    layout.surface.drawLine({
      start: { x: centre.x + radius * Math.cos(from), y: centre.y + radius * Math.sin(from) },
      end: { x: centre.x + radius * Math.cos(to), y: centre.y + radius * Math.sin(to) },
      thickness: HAIRLINE + 0.2,
      color,
    });
  }
};
