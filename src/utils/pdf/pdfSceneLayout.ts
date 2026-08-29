/**
 * Geometry of a free-body figure: how tall it should be, where its frame goes, and where each
 * label lands.
 *
 * All of it is arithmetic on rectangles, deliberately kept out of `pdfFreeBody.ts` so it can be
 * asserted directly rather than inferred from a rendered page. The numbers here are the ones
 * that made the first version of these drawings look wrong: every scene was handed the same
 * 495×186 frame with fixed padding, which left a plot box of 379×91 — an aspect ratio of 4.2:1
 * that almost no structure has. A 6×4 m truss filled 27.5 % of its own figure's width; a beam
 * filled 0.5 % of its height. The rest was white.
 */
import type { Point, Rect } from './pdfScene';

/** Extent, in model units, that a scene needs to frame. */
export interface SceneExtent {
  readonly spanX: number;
  readonly spanY: number;
}

/** Space reserved inside the frame for what hangs off the drawing rather than being part of it. */
export const SCENE_PADDING = {
  /** Support glyphs hang ~19 pt below their node, and a dimension line another ~16 pt. */
  bottom: 40,
  /** The title tag sits here. */
  top: 22,
  side: 26,
} as const;

/**
 * Vertical room the plot always keeps, even when the model has no depth at all.
 *
 * A straight beam spans zero in `y`, so matching the plot's aspect ratio to the model's would
 * ask for a plot of zero height — and every projection into it collapses the structure onto a
 * point. The floor is what the marks hanging off a beam need: load arrows above it, the shear
 * and moment on the cut face below, and a dimension line under that.
 */
export const MIN_PLOT_HEIGHT = 62;

export const MIN_SCENE_HEIGHT = MIN_PLOT_HEIGHT + 40 + 22;
export const MAX_SCENE_HEIGHT = 268;

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/**
 * Figure height that makes the plot's aspect ratio match the model's.
 *
 * When the two agree the drawing fills the box in *both* directions, because
 * `min(width/spanX, height/spanY)` no longer has a slack dimension to leave empty. A beam of
 * zero depth asks for the floor — a wide, short figure with no dead band — and a tall frame asks
 * for the ceiling.
 */
export const sceneFigureHeight = (extent: SceneExtent, frameWidth: number): number => {
  const plotWidth = Math.max(frameWidth - SCENE_PADDING.side * 2, 1);
  const ratio = extent.spanY / Math.max(extent.spanX, 1e-9);
  const chrome = SCENE_PADDING.top + SCENE_PADDING.bottom;
  return clamp(plotWidth * ratio + chrome, MIN_SCENE_HEIGHT, MAX_SCENE_HEIGHT);
};

/**
 * The frame drawn around a scene: the box the drawing actually occupies, centred in `rect`.
 *
 * Bordering the whole `rect` is what made a joint close-up or a narrow model look like a small
 * object floating in a wide box. The border is the drawing's own now, which is also how a
 * technical drawing is framed.
 */
export const sceneFrame = (rect: Rect, extent: SceneExtent): Rect => {
  const availableWidth = rect.width - SCENE_PADDING.side * 2;
  const availableHeight = rect.height - SCENE_PADDING.top - SCENE_PADDING.bottom;
  const ratio = extent.spanY / Math.max(extent.spanX, 1e-9);
  // Fit the model's shape into what is available, then let the frame hug it.
  let drawWidth = availableWidth;
  let drawHeight = availableWidth * ratio;
  if (drawHeight > availableHeight) {
    drawHeight = availableHeight;
    drawWidth = ratio > 0 ? availableHeight / ratio : availableWidth;
  }
  drawWidth = Math.min(drawWidth, availableWidth);
  // Never a degenerate plot: a model with no depth still needs room above and below its axis.
  drawHeight = Math.min(Math.max(drawHeight, MIN_PLOT_HEIGHT), availableHeight);
  const width = drawWidth + SCENE_PADDING.side * 2;
  const height = drawHeight + SCENE_PADDING.top + SCENE_PADDING.bottom;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
};

/** The plot box inside a frame: where the model itself is projected. */
export const scenePlot = (frame: Rect): { left: number; right: number; bottom: number; top: number } => ({
  left: frame.x + SCENE_PADDING.side,
  right: frame.x + frame.width - SCENE_PADDING.side,
  bottom: frame.y + SCENE_PADDING.bottom,
  top: frame.y + frame.height - SCENE_PADDING.top,
});

/**
 * Mark sizes scaled to the plot they sit in.
 *
 * These were constants — a 22 pt arrow, a 3 pt node dot, a 5.9 pt label — tuned for one frame
 * size. On a large drawing they read as toys; on a small one they bury it.
 */
export interface SceneMetrics {
  readonly arrow: number;
  readonly momentRadius: number;
  readonly nodeDot: number;
  readonly label: number;
  readonly memberWeight: number;
}

export const sceneMetrics = (plotWidth: number, plotHeight: number): SceneMetrics => {
  const reference = Math.max(Math.min(plotWidth, plotHeight), 60);
  const scaled = (fraction: number, low: number, high: number) => clamp(reference * fraction, low, high);
  return {
    arrow: scaled(0.16, 18, 34),
    momentRadius: scaled(0.055, 8, 15),
    nodeDot: scaled(0.018, 2.6, 4.4),
    label: scaled(0.032, 5.6, 7.4),
    memberWeight: scaled(0.011, 1.4, 2.4),
  };
};

// ---------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------

export interface LabelBox extends Rect {}

export interface PlacedLabel {
  readonly box: LabelBox;
  /** Set when the label could not sit beside its anchor and needs a leader drawn to it. */
  readonly leader?: Point;
}

const overlaps = (a: LabelBox, b: LabelBox): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Grows a box by `margin` on every side, so labels keep air between them. */
const inflate = (box: LabelBox, margin: number): LabelBox => ({
  x: box.x - margin, y: box.y - margin, width: box.width + margin * 2, height: box.height + margin * 2,
});

/**
 * Candidate offsets around an anchor, in the order they are tried.
 *
 * The first two are the perpendiculars to the mark's own direction, which is where a label reads
 * best; then the along-direction, then the diagonals, then the same ring further out. The mark's
 * own direction comes first among the perpendiculars so an arrow's value still lands on the side
 * the arrow points.
 */
const CANDIDATE_ANGLES = [90, -90, 0, 45, -45, 135, -135, 180];

export interface LabelRequest {
  readonly text: string;
  readonly width: number;
  readonly height: number;
  /** Point the label names, in page coordinates. */
  readonly anchor: Point;
  /** Unit vector of the mark the label belongs to; the ring is measured from it. */
  readonly direction: Point;
  /** Distance from the anchor to the near edge of the label. */
  readonly gap: number;
}

/**
 * Finds a spot for one label that clears everything already placed and the frame's edges.
 *
 * Returns a leader point when no candidate is free: the caller draws a thin line from the label
 * back to its anchor, which is what a technical drawing does when a value cannot sit beside the
 * thing it measures.
 */
export const placeLabelBox = (
  request: LabelRequest,
  taken: readonly LabelBox[],
  frame: Rect,
): PlacedLabel => {
  const base = Math.atan2(request.direction.y, request.direction.x);
  const clampToFrame = (box: LabelBox): LabelBox => ({
    ...box,
    x: clamp(box.x, frame.x + 2, frame.x + frame.width - box.width - 2),
    y: clamp(box.y, frame.y + 2, frame.y + frame.height - box.height - 2),
  });

  for (const ring of [1, 1.85]) {
    for (const degrees of CANDIDATE_ANGLES) {
      const angle = base + (degrees * Math.PI) / 180;
      const distance = request.gap * ring + Math.max(request.width, request.height) / 2;
      const centre = {
        x: request.anchor.x + Math.cos(angle) * distance,
        y: request.anchor.y + Math.sin(angle) * distance,
      };
      const box = clampToFrame({
        x: centre.x - request.width / 2,
        y: centre.y - request.height / 2,
        width: request.width,
        height: request.height,
      });
      const padded = inflate(box, 1.5);
      if (taken.some((other) => overlaps(padded, other))) continue;
      // A label that had to travel to find room no longer sits *beside* what it names, so it
      // gets a leader back to it. Without this the second ring reads as a caption floating
      // near the drawing rather than as the value of one particular arrow.
      return ring > 1 ? { box, leader: request.anchor } : { box };
    }
  }

  // Nothing was free. Park the label clear of the pile and lead a line back to what it names.
  const highest = taken.reduce((top, box) => Math.max(top, box.y + box.height), frame.y);
  const parked = clampToFrame({
    x: request.anchor.x - request.width / 2,
    y: Math.min(highest + 3, frame.y + frame.height - request.height - 2),
    width: request.width,
    height: request.height,
  });
  return { box: parked, leader: request.anchor };
};
