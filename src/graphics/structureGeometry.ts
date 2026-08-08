/**
 * Model-space geometry shared by every renderer of the structure.
 *
 * The web canvas (React/SVG) and the calculation report (`pdf-lib`) draw the same structure
 * with different vocabularies — SVG markers, Bézier segments and a pan/zoom camera on one
 * side; hand-built arrow barbs, sampled polylines and a fit-to-box transform on the other.
 * What they genuinely share is the geometry underneath: where a member points, where a load
 * sits along it, how a local vector becomes a global one, and how far the model reaches.
 *
 * That math used to be written out at ~20 call sites across `features/canvas/**` and the PDF
 * renderer, each with its own spelling. It lives here now, framework-agnostic and free of
 * presentation policy: no pixels, no colours, no page units. Renderers keep their own
 * projections and their own visual language — this module only answers questions about the
 * model.
 *
 * Expressions are kept exactly as the call sites wrote them, including the order of
 * operations, so results stay bit-for-bit identical to the code they replace.
 */
import type { LoadCoordinateSystem, MemberLoad, MemberModel, NodeModel } from '../types';

export interface Vec2 {
  x: number;
  y: number;
}

export interface ModelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * A member resolved against its end nodes.
 *
 * `length` is the gross node-to-node distance; `flexibleLength` discounts the rigid offsets
 * and is *not* floored — callers guard it with the tolerance their drawing needs, because a
 * degenerate member is a different problem for the canvas (skip the glyph) than for the
 * report (skip the whole block).
 */
export interface MemberAxis {
  readonly start: Vec2;
  readonly end: Vec2;
  readonly dx: number;
  readonly dy: number;
  /** Gross node-to-node length. */
  readonly length: number;
  /** Direction cosine along x (`dx / length`). */
  readonly c: number;
  /** Direction cosine along y (`dy / length`). */
  readonly s: number;
  /** Unit normal `(-s, c)`: the local +y axis, 90° counter-clockwise from the member. */
  readonly normal: Vec2;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly flexibleLength: number;
}

export const memberAxis = (member: MemberModel, i: NodeModel, j: NodeModel): MemberAxis => {
  const dx = j.x - i.x;
  const dy = j.y - i.y;
  const length = Math.hypot(dx, dy);
  const c = dx / length;
  const s = dy / length;
  const startOffset = member.rigidOffsetI ?? 0;
  const endOffset = member.rigidOffsetJ ?? 0;
  return {
    start: { x: i.x, y: i.y },
    end: { x: j.x, y: j.y },
    dx,
    dy,
    length,
    c,
    s,
    normal: { x: -s, y: c },
    startOffset,
    endOffset,
    flexibleLength: length - startOffset - endOffset,
  };
};

/**
 * Position along the whole member (0 at node i, 1 at node j) of a station expressed against
 * the flexible span, which is what `MemberLoad.position`, `.start` and `.end` measure.
 */
export const grossRatioFromFlexible = (axis: MemberAxis, flexibleRatio: number): number => {
  const flexibleLength = Math.max(axis.flexibleLength, 0);
  return axis.length > 0 ? (axis.startOffset + flexibleRatio * flexibleLength) / axis.length : flexibleRatio;
};

/** Inverse of {@link grossRatioFromFlexible}, clamped to the flexible span. */
export const flexibleRatioFromGross = (axis: MemberAxis, grossRatio: number): number => {
  const flexibleLength = Math.max(axis.flexibleLength, 1e-12);
  return Math.min(1, Math.max(0, (grossRatio * axis.length - axis.startOffset) / flexibleLength));
};

/** Where a pointer landed along the member, as a gross ratio clamped to its ends. */
export const grossRatioAtPoint = (axis: MemberAxis, point: Vec2): number => {
  const projected = ((point.x - axis.start.x) * axis.dx + (point.y - axis.start.y) * axis.dy)
    / (axis.dx * axis.dx + axis.dy * axis.dy);
  return Math.min(1, Math.max(0, projected));
};

/** Model point at a gross ratio along the member. */
export const pointAtGrossRatio = (axis: MemberAxis, ratio: number): Vec2 => ({
  x: axis.start.x + axis.dx * ratio,
  y: axis.start.y + axis.dy * ratio,
});

/**
 * Straight interpolation between two already-transformed points.
 *
 * Renderers that project the member ends first (the report) interpolate in their own space;
 * this keeps that arithmetic in one place without imposing a coordinate system.
 */
export const lerpPoint = (from: Vec2, to: Vec2, ratio: number): Vec2 => ({
  x: from.x + (to.x - from.x) * ratio,
  y: from.y + (to.y - from.y) * ratio,
});

/** Rotates a local-axes vector into global axes; a global vector passes through untouched. */
export const toGlobalVector = (
  axis: MemberAxis,
  system: LoadCoordinateSystem,
  x: number,
  y: number,
): [number, number] => system === 'local'
  ? [axis.c * x - axis.s * y, axis.s * x + axis.c * y]
  : [x, y];

/** Linearly interpolated intensity of a distributed load, `t` running 0 → 1 start to end. */
export const distributedIntensityAt = (load: MemberLoad, t: number): { qx: number; qy: number } => ({
  qx: (load.qxStart ?? 0) + ((load.qxEnd ?? load.qxStart ?? 0) - (load.qxStart ?? 0)) * t,
  qy: (load.qyStart ?? 0) + ((load.qyEnd ?? load.qyStart ?? 0) - (load.qyStart ?? 0)) * t,
});

/** Bounding box of the model, the input of every fit-to-view transform. */
export const modelBounds = (nodes: readonly NodeModel[]): ModelBounds => {
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};
