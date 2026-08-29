/**
 * Free-body diagrams of the solution methods.
 *
 * Part 6 of the report develops the chosen method with this structure's own numbers — the
 * Method of Sections cut by cut, the Method of Joints joint by joint, the Portal Method storey
 * by storey — and until now it drew none of it. A reader saw the table of a cut and the three
 * equilibrium sums beneath it, but never the cut: the one drawing the whole method is *about*.
 *
 * A scene is a plain object, built by `pdfMethodScenes.ts` from what the method already solved
 * and drawn here. Keeping the two apart is what makes the geometry testable: which nodes a cut
 * keeps, where the cut line lands and which way an axial arrow points are assertions about a
 * `FreeBodyScene`, with no page or renderer anywhere near them.
 *
 * Nothing in this file computes structural results. Every force it draws was solved by
 * `src/analysis-methods/`, checked against the matrix analysis there, and handed over as a
 * number with a label.
 */
import { memberAxis } from '../../graphics/structureGeometry';
import { pdfText } from './pdfGlyphs';
import {
  placeLabelBox,
  sceneFrame,
  sceneMetrics,
  scenePlot,
  type LabelBox,
  type SceneExtent,
  type SceneMetrics,
} from './pdfSceneLayout';
import { TYPE } from './pdfTheme';
import {
  GHOST_OPACITY,
  GHOST_WEIGHT,
  createFocusProjection,
  createProjection,
  drawArrow,
  drawAxesIndicator,
  drawCutLine,
  drawDimension,
  drawGhostModel,
  drawHinge,
  drawIsolationBoundary,
  drawLeader,
  drawMemberLoads,
  drawMomentArc,
  drawNodeDot,
  drawPolynomialCurve,
  drawSupportGlyph,
  SUPPORT_DEPTH,
  type Point,
  type Projection,
  type Rect,
} from './pdfScene';
import type { PdfLayout } from './pdfBuilder';
import type { NodeModel } from '../../types';
import type { ReportContext } from './reportContext';
import type { Tone } from './reportDocument';

/** Where a scene mark is anchored: a node of the model, or a point in model coordinates. */
export type ScenePlace = { readonly nodeId: string } | { readonly at: Point };

/**
 * Which of the report's hues a mark carries.
 *
 * Named by role rather than by colour so a scene never reaches for a literal, and so the rule
 * the document already lives by holds here too: an applied action and a response can never be
 * mistaken for one another.
 */
export type SceneTone = 'load' | 'reaction' | 'axial' | 'shear' | 'moment' | 'ink' | 'faint';

export interface SceneForce {
  readonly place: ScenePlace;
  /** Direction in model axes. Magnitude is ignored: every arrow is drawn one length. */
  readonly fx: number;
  readonly fy: number;
  readonly label: string;
  readonly tone: SceneTone;
  /**
   * Arrow length as a multiple of the scene's own scaled arrow. Absent is 1.
   *
   * It used to be an absolute point value, which is why the marks looked like toys on a large
   * drawing and buried a small one: `sceneMetrics` sizes the base arrow to the plot now.
   */
  readonly length?: number;
  /**
   * Which end of the arrow `place` names.
   *
   * `'head'` is a force arriving at a point — a load or a reaction on a node — and is the
   * default. `'tail'` is a force leaving one: the axial force a severed bar exerts on the free
   * body starts at the cut face and points away from it, which is the only way a reader can
   * tell tension from compression at a glance.
   */
  readonly anchor?: 'head' | 'tail';
}

export interface SceneMoment {
  readonly place: ScenePlace;
  /** Counter-clockwise positive, the model's own sense for `Mz`. */
  readonly sign: number;
  readonly label: string;
  readonly tone: SceneTone;
}

export interface SceneNote {
  readonly place: ScenePlace;
  readonly text: string;
  readonly tone?: SceneTone;
}

/** A straight cut drawn across the body, in model coordinates. */
export interface SceneCut {
  readonly from: Point;
  readonly to: Point;
  readonly label?: string;
  /**
   * Where the label hangs off the line. A storey cut wants the middle, because both its ends
   * are exactly where the outermost column's own force label goes; a cut across a beam wants
   * an end, because its middle is the beam axis where V and M are already drawn.
   */
  readonly labelAt?: 'start' | 'middle' | 'end';
}

/**
 * A member the cut passes *through*, rather than between.
 *
 * Both halves are drawn: the retained one in ink, because the stub from the body out to the cut
 * face is *part of the free body* and is where the bar's own force acts; the discarded one as a
 * ghost. Getting this wrong in either direction misdraws the body — leaving the whole member in
 * ink says the free body is the entire bar, and ghosting the whole member leaves a truss cut at
 * two bars with nothing in ink but a single node, which is what the first version did.
 */
export interface ScenePartialMember {
  readonly memberId: string;
  /** Station of the cut along the member, 0 at node i and 1 at node j. */
  readonly ratio: number;
  /** Which side of the cut stays in ink. */
  readonly keep: 'start' | 'end';
}

/** A measured distance drawn on the scene, in model coordinates. */
export interface SceneDimension {
  readonly from: Point;
  readonly to: Point;
  /** Perpendicular offset in points; the sign picks the side of the measured line. */
  readonly offset: number;
  readonly text: string;
}

/**
 * A polynomial of the analysis drawn over a straight baseline: the free moment of a span, the
 * fictitious `M/EI` load of a conjugate beam.
 *
 * The coefficients come from what the method already solved, and the vertical scale is chosen to
 * fill the room available — the shape and its area are what the arithmetic beside the figure
 * integrates, and the caption says as much rather than claiming a scale.
 */
export interface SceneCurve {
  readonly coefficients: readonly number[];
  readonly domain: { readonly x0: number; readonly x1: number };
  /** Baseline ends, in model coordinates. */
  readonly from: Point;
  readonly to: Point;
  readonly tone: SceneTone;
  /** Hatch the area between the curve and the baseline. */
  readonly fill?: boolean;
  readonly label?: string;
}

/** A hinge symbol: a point of inflection, or an internal hinge of the model. */
export interface SceneHinge {
  readonly place: ScenePlace;
}

export interface FreeBodyScene {
  /** Small-caps tag inside the frame; the numbered caption is `layout.figure`'s job. */
  readonly title?: string;
  /** Members drawn in ink. Absent keeps every member solid. */
  readonly keptMemberIds?: readonly string[];
  /** Nodes drawn in ink, with their supports. Absent keeps every node solid. */
  readonly keptNodeIds?: readonly string[];
  /** Discarded geometry is dropped rather than ghosted. */
  readonly hideGhost?: boolean;
  readonly cut?: SceneCut;
  /** Members the cut passes through, each drawn half in ink and half as a ghost. */
  readonly severed?: readonly ScenePartialMember[];
  readonly dimensions?: readonly SceneDimension[];
  readonly curves?: readonly SceneCurve[];
  readonly hinges?: readonly SceneHinge[];
  /** The corner axes indicator. On by default; a close-up of one joint may not need it. */
  readonly axes?: boolean;
  /**
   * A dashed circle marking what has been isolated, drawn around the focus node.
   *
   * The Method of Joints cuts a pin free of the truss; without the boundary the drawing shows
   * bars in ink and leaves the reader to infer where the body ends.
   */
  readonly isolation?: { readonly nodeId: string; readonly radius: number };
  /**
   * Draw the applied member loads of the retained portion.
   *
   * Off by default because most method scenes carry the *response* the method solved for; a
   * scene that claims in its legend that the loads act on this free body has to show them.
   */
  readonly includeMemberLoads?: boolean;
  readonly forces?: readonly SceneForce[];
  readonly moments?: readonly SceneMoment[];
  readonly notes?: readonly SceneNote[];
  /** Frame the drawing on one node instead of the whole model. */
  readonly focus?: { readonly nodeId: string; readonly radius: number };
  /**
   * Reading of the drawing.
   *
   * It is printed by `layout.figure` as part of the numbered caption, not inside the frame: the
   * grey block it used to occupy cost ~21 pt of drawing height and competed with the marks it
   * was explaining.
   */
  readonly legend?: string;
  /**
   * Model extent this scene needs to frame. Absent means "the nodes it keeps", which is what a
   * cut wants — sizing a two-node free body to the whole truss is one of the reasons these
   * drawings came out small.
   */
  readonly extent?: SceneExtent;
}

/**
 * Extent a scene needs, in model units.
 *
 * Falls back through: what the scene declared, the box of the nodes it keeps, and finally the
 * whole model. A degenerate span (a straight beam has zero depth) stays zero, which is exactly
 * what `sceneFigureHeight` wants in order to ask for a short, wide figure.
 */
/**
 * Nodes the scene is framed around: what it keeps, whenever that is a body at all.
 *
 * It used to be the whole model unless the scene hid its ghost, and that inverted the emphasis
 * of every detail view. One column isolated from a portal is two nodes out of four; framing on
 * all four drew the subject as a vertical sliver down one side of a box that was three quarters
 * the *rest* of the structure. The ghost is context, and context is not what a drawing should be
 * sized to.
 *
 * What makes that safe is the clip: `drawFreeBodyScene` draws the ghost inside the frame's own
 * boundary, so the members leaving the subject run to the edge and are cut there — which is how
 * a detail view is drawn — instead of sprawling across the caption.
 *
 * `sceneExtentOf` and the projection both read this, because sizing the figure to one span
 * while projecting the whole model into it is what drew a span in half its own frame.
 */
const framedNodes = (context: ReportContext, scene: FreeBodyScene): readonly NodeModel[] => {
  const kept = scene.keptNodeIds?.length
    ? context.project.nodes.filter((node) => scene.keptNodeIds!.includes(node.id))
    : [];
  return kept.length > 1 ? kept : context.project.nodes;
};

/**
 * Model-space box a focused scene actually draws: the joint, the isolation boundary around it,
 * and the far end of every stub leaving it.
 *
 * It is the plain bounding box, and it carries its own centre. Both matter. Measuring it
 * symmetrically about the joint — which is what this did while the projection centred the joint
 * — reserved as much room on the empty side as on the drawn one, so a truss joint whose two
 * bars both leave up and to the left got a frame with a quarter of its area used and the rest
 * white. Assuming a square of `radius x radius` was wrong in the other direction: a joint on a
 * continuous beam, whose stubs are collinear, came out as a line across the middle of a square.
 * A box with independent spans and a real centre handles both without a special case.
 */
interface FocusBox {
  readonly centre: Point;
  readonly spanX: number;
  readonly spanY: number;
}

const focusBox = (context: ReportContext, scene: FreeBodyScene): FocusBox | undefined => {
  const node = scene.focus ? context.index.node(scene.focus.nodeId) : undefined;
  if (!node) return undefined;
  const xs = [node.x];
  const ys = [node.y];

  // The dashed boundary is the subject of an isolated-joint drawing, not decoration on it, so
  // it sets the floor on the box: a joint whose stubs are all short still gets a frame its own
  // circle fits inside.
  const radius = scene.isolation?.radius ?? 0;
  if (radius > 0) {
    xs.push(node.x - radius, node.x + radius);
    ys.push(node.y - radius, node.y + radius);
  }

  for (const entry of scene.severed ?? []) {
    const member = context.index.member(entry.memberId);
    const ni = member ? context.index.node(member.i) : undefined;
    const nj = member ? context.index.node(member.j) : undefined;
    if (!ni || !nj) continue;
    const ratio = Math.min(1, Math.max(0, entry.ratio));
    xs.push(ni.x + (nj.x - ni.x) * ratio);
    ys.push(ni.y + (nj.y - ni.y) * ratio);
  }

  // Anything the scene anchors at an explicit model point — a hinge, a note, a force applied
  // away from the joint — is drawn too, so it belongs in the box the frame is sized to.
  const places = [
    ...(scene.forces ?? []).map((force) => force.place),
    ...(scene.moments ?? []).map((moment) => moment.place),
    ...(scene.hinges ?? []).map((hinge) => hinge.place),
  ];
  for (const place of places) {
    if (!('at' in place)) continue;
    xs.push(place.at.x);
    ys.push(place.at.y);
  }

  if (xs.length < 2) return undefined;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    centre: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    spanX: maxX - minX,
    spanY: maxY - minY,
  };
};

export const sceneExtentOf = (context: ReportContext, scene: FreeBodyScene): SceneExtent => {
  if (scene.extent) return scene.extent;
  if (scene.focus) {
    const box = focusBox(context, scene);
    if (box && box.spanX > 1e-9) return { spanX: box.spanX, spanY: box.spanY };
    const radius = Math.max(scene.focus.radius, 1e-6);
    return { spanX: radius * 2, spanY: radius * 2 };
  }
  const nodes = framedNodes(context, scene);
  if (!nodes.length) return { spanX: 1, spanY: 0 };
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  return {
    spanX: Math.max(...xs) - Math.min(...xs),
    spanY: Math.max(...ys) - Math.min(...ys),
  };
};

const toneColor = (context: ReportContext, tone: SceneTone): Tone => {
  const { palette } = context.layout;
  switch (tone) {
    case 'load': return palette.load;
    case 'reaction': return palette.reaction;
    case 'axial': return palette.quantity.axial;
    case 'shear': return palette.quantity.shear;
    case 'moment': return palette.quantity.moment;
    case 'faint': return palette.inkFaint;
    default: return palette.ink;
  }
};

const resolvePlace = (context: ReportContext, place: ScenePlace, projection: Projection): Point | undefined => {
  if ('at' in place) return projection.at(place.at.x, place.at.y);
  const node = context.index.node(place.nodeId);
  return node ? projection.at(node.x, node.y) : undefined;
};

/**
 * Midpoint of a member in model coordinates — where a cut crosses it and where a bar's own
 * label sits.
 */
export const memberMidpoint = (context: ReportContext, memberId: string): Point | undefined => {
  const member = context.index.member(memberId);
  if (!member) return undefined;
  const ni = context.index.node(member.i);
  const nj = context.index.node(member.j);
  if (!ni || !nj) return undefined;
  return { x: (ni.x + nj.x) / 2, y: (ni.y + nj.y) / 2 };
};

/**
 * Unit vector along a member, pointing away from `fromNodeId`.
 *
 * This is what turns a signed axial force into an arrow: a bar in tension pulls the free body
 * *towards* the cut, so its arrow leaves the retained node along the bar; a bar in compression
 * pushes, so it points back. Getting this backwards would draw a truss that reads as its own
 * mirror image, which is why it is one function with one test rather than a sign written out
 * at each of the eleven call sites.
 */
export const axialDirection = (
  context: ReportContext,
  memberId: string,
  fromNodeId: string,
  force: number,
): { fx: number; fy: number } | undefined => {
  const member = context.index.member(memberId);
  if (!member) return undefined;
  const here = context.index.node(fromNodeId);
  const farId = member.i === fromNodeId ? member.j : member.i;
  const far = context.index.node(farId);
  if (!here || !far) return undefined;
  const axis = memberAxis(member, here, far);
  if (!(axis.length > 0)) return undefined;
  // `memberAxis` measures i -> j; `here` is always the i of this call, so `c`/`s` already point
  // away from the retained node. Tension (positive) pulls that way; compression reverses it.
  const sign = force >= 0 ? 1 : -1;
  return { fx: axis.c * sign, fy: axis.s * sign };
};

/**
 * A drawn segment as obstacles the label placer must clear.
 *
 * Sampled into small boxes along its length rather than reserved as one bounding box: a
 * diagonal bar's bounding box covers the whole triangle it spans, which would reject nearly
 * every candidate position and push every label out to a leader. What has to stay clear is the
 * stroke itself, and that is what these cover.
 */
const segmentBoxes = (from: Point, to: Point): LabelBox[] => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.round(length / 7));
  const half = 2.2;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;
    return {
      x: from.x + (to.x - from.x) * ratio - half,
      y: from.y + (to.y - from.y) * ratio - half,
      width: half * 2,
      height: half * 2,
    };
  });
};

/**
 * Draws one label where it fits, and a leader back to what it names when nothing was free.
 *
 * The placement itself is `pdfSceneLayout.placeLabelBox`, which is pure geometry and tested as
 * such; this only turns its answer into ink. `taken` is the running list of boxes already on the
 * drawing, so it stays local to one scene rather than global state.
 */
const drawLabel = (
  layout: PdfLayout,
  text: string,
  anchor: Point,
  direction: Point,
  frame: Rect,
  color: Tone,
  metrics: SceneMetrics,
  taken: LabelBox[],
  bold = true,
): void => {
  const label = pdfText(text);
  const font = bold ? layout.fonts.bold : layout.fonts.regular;
  const size = metrics.label;
  const placed = placeLabelBox(
    {
      text: label,
      width: font.widthOfTextAtSize(label, size),
      height: size,
      anchor,
      direction,
      gap: metrics.arrow * 0.28,
    },
    taken,
    frame,
  );
  taken.push(placed.box);
  if (placed.leader) {
    drawLeader(layout, { x: placed.box.x + placed.box.width / 2, y: placed.box.y + placed.box.height / 2 }, placed.leader, color);
  }
  // Knocked out of whatever it lands on. A scene's marks, its ghost, its dimension lines and
  // its title tag are all placed by different rules, so two of them meeting is a matter of
  // which structure is being drawn — and a value that has to stay beside the arrow it names is
  // better read over a small plate than moved somewhere emptier.
  layout.surface.drawText(label, { x: placed.box.x, y: placed.box.y, size, font, color, halo: layout.palette.paper });
};

export const drawFreeBodyScene = (
  context: ReportContext,
  rect: Rect,
  scene: FreeBodyScene,
): void => {
  const { layout, project } = context;
  const { palette, fonts } = layout;
  if (!project.nodes.length) return;
  const page = layout.surface;

  // The border hugs the drawing, centred in the slot it was given, rather than boxing the whole
  // slot: a joint close-up or a narrow model used to float inside a 495 pt-wide rectangle.
  const frame = sceneFrame(rect, sceneExtentOf(context, scene));
  page.drawRectangle({
    x: frame.x, y: frame.y, width: frame.width, height: frame.height,
    borderWidth: 0.5, borderColor: palette.rule, color: palette.paper,
  });

  const plot = scenePlot(frame);
  const metrics = sceneMetrics(plot.right - plot.left, plot.top - plot.bottom);
  const taken: LabelBox[] = [];
  // Labels are placed inside the frame, but a box clamped flush to it puts a baseline on the
  // border and hangs the descenders through it. The placer gets a slightly smaller box so a
  // value that ends up against the edge still sits clear of the line.
  const labelFrame: Rect = { x: frame.x + 3, y: frame.y + 4, width: frame.width - 6, height: frame.height - 8 };

  const focusNode = scene.focus ? context.index.node(scene.focus.nodeId) : undefined;
  // The projection frames exactly the box the figure was sized for, and centres *that box* —
  // not the joint. Sizing to one thing and projecting another is what drew a span in half its
  // own frame; centring the joint inside a box it does not sit in the middle of is what left
  // the other half white.
  const box = focusBox(context, scene)
    ?? (focusNode && scene.focus
      ? { centre: { x: focusNode.x, y: focusNode.y }, spanX: scene.focus.radius * 2, spanY: scene.focus.radius * 2 }
      : undefined);
  const projection = focusNode && box
    ? createFocusProjection(
      box.centre,
      // A little air around the stubs, so an arrow leaving one does not start on the frame.
      { spanX: box.spanX * 1.14, spanY: box.spanY * 1.14 },
      plot,
    )
    : createProjection(framedNodes(context, scene), plot);

  if (scene.title) {
    const tag = pdfText(scene.title.toUpperCase());
    page.drawText(tag, {
      x: frame.x + 8, y: frame.y + frame.height - 12, size: TYPE.micro, font: fonts.bold, color: palette.inkSoft,
    });
    taken.push({
      x: frame.x + 8, y: frame.y + frame.height - 13,
      width: fonts.bold.widthOfTextAtSize(tag, TYPE.micro), height: TYPE.micro + 2,
    });
  }

  // The axes indicator is drawn last but reserved first: it sits in a fixed corner, so a label
  // that the placer sends there lands on it. Reserving the corner is what keeps the two apart.
  const axesOrigin = { x: frame.x + frame.width - 26, y: frame.y + 12 };
  if (scene.axes !== false) {
    taken.push({ x: axesOrigin.x - 7, y: axesOrigin.y - 7, width: 26, height: 26 });
  }

  const severed = scene.severed ?? [];
  // The model itself is drawn inside the frame's own boundary. That is what lets the figure be
  // sized to its subject: the structure around it is drawn at the subject's scale and is cut at
  // the frame — how a detail view is drawn — instead of sprawling over the caption.
  layout.clipped(frame, () => {
    drawGhostModel(context, projection, {
      solidMemberIds: scene.keptMemberIds ? new Set(scene.keptMemberIds) : undefined,
      solidNodeIds: scene.keptNodeIds ? new Set(scene.keptNodeIds) : undefined,
      // A close-up on a joint is the one case where the ghost is still dropped: scaled to the
      // stubs, the far side of the model is a couple of lines crossing the frame at random,
      // and the severed stubs already say what the joint was cut out of.
      hideGhost: scene.hideGhost || scene.focus !== undefined,
      // A severed member is neither wholly kept nor wholly discarded, so the ghost pass leaves
      // it alone and the block below draws its two halves.
      skipMemberIds: new Set(severed.map((entry) => entry.memberId)),
      weight: metrics.memberWeight,
      nodeSize: metrics.nodeDot,
      labelSize: metrics.label,
    });
    for (const entry of severed) {
      const member = context.index.member(entry.memberId);
      const ni = member ? context.index.node(member.i) : undefined;
      const nj = member ? context.index.node(member.j) : undefined;
      if (!member || !ni || !nj || scene.hideGhost) continue;
      const ratio = Math.min(1, Math.max(0, entry.ratio));
      const start = projection.at(ni.x, ni.y);
      const end = projection.at(nj.x, nj.y);
      const at = { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
      // The discarded half, which the clip now makes safe to draw on a close-up too: a bar that
      // simply stopped at the cut left the reader to guess whether it ended there.
      page.drawLine({
        start: at,
        end: entry.keep === 'start' ? end : start,
        thickness: GHOST_WEIGHT,
        color: palette.inkFaint,
        opacity: GHOST_OPACITY,
      });
    }
  });

  if (scene.isolation) {
    const node = context.index.node(scene.isolation.nodeId);
    if (node) {
      const centre = projection.at(node.x, node.y);
      const edge = projection.at(node.x + scene.isolation.radius, node.y);
      // Clamped in points, not left in model units: on a joint whose stubs are collinear the
      // horizontal scale is large and the same model radius drew a circle taller than the frame.
      const radius = Math.min(Math.max(Math.abs(edge.x - centre.x), 9), (plot.top - plot.bottom) * 0.34);
      drawIsolationBoundary(layout, centre, radius, palette.inkFaint);
    }
  }

  // A focused scene draws the joint itself on top of the ghost, so it never disappears under
  // the bars that meet there.
  if (focusNode) {
    const at = projection.at(focusNode.x, focusNode.y);
    drawNodeDot(layout, at, focusNode.id, palette.ink, metrics.nodeDot * 1.15, metrics.label);
    drawSupportGlyph(layout, at, focusNode.support, palette.inkSoft);
  }

  // Each severed member, in two halves: the stub the body keeps, in ink, and the rest as a
  // ghost. The ink strokes double as obstacles for the label placer, so a value never lands on
  // the bar it belongs to.
  const strokes: LabelBox[] = [];
  for (const entry of severed) {
    const member = context.index.member(entry.memberId);
    const ni = member ? context.index.node(member.i) : undefined;
    const nj = member ? context.index.node(member.j) : undefined;
    if (!member || !ni || !nj) continue;
    const ratio = Math.min(1, Math.max(0, entry.ratio));
    const start = projection.at(ni.x, ni.y);
    const end = projection.at(nj.x, nj.y);
    const at = { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
    const kept = entry.keep === 'start' ? start : end;
    page.drawLine({ start: kept, end: at, thickness: metrics.memberWeight, color: palette.ink });
    strokes.push(...segmentBoxes(kept, at));
  }
  for (const memberId of scene.keptMemberIds ?? []) {
    const member = context.index.member(memberId);
    const ni = member ? context.index.node(member.i) : undefined;
    const nj = member ? context.index.node(member.j) : undefined;
    if (member && ni && nj) strokes.push(...segmentBoxes(projection.at(ni.x, ni.y), projection.at(nj.x, nj.y)));
  }
  taken.push(...strokes);

  if (scene.includeMemberLoads) {
    const partial = severed[0];
    taken.push(...drawMemberLoads(context, projection, {
      onlyMemberIds: scene.keptMemberIds
        ? new Set([...scene.keptMemberIds, ...severed.map((entry) => entry.memberId)])
        : undefined,
      // On the severed member the load stops at the cut, because past the cut it acts on the
      // portion that was removed.
      upTo: (memberId) => partial && memberId === partial.memberId
        ? (partial.keep === 'start' ? partial.ratio : 1)
        : 1,
      arrow: metrics.arrow * 0.62,
    }));
  }

  if (scene.cut) {
    const from = projection.at(scene.cut.from.x, scene.cut.from.y);
    const to = projection.at(scene.cut.to.x, scene.cut.to.y);
    drawCutLine(layout, from, to, palette.ink);
    if (scene.cut.label) {
      const along = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const where = scene.cut.labelAt ?? 'end';
      const anchor = where === 'middle'
        ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
        : where === 'start' ? from : to;
      const direction = where === 'start'
        ? { x: (from.x - to.x) / along, y: (from.y - to.y) / along }
        : { x: (to.x - from.x) / along, y: (to.y - from.y) / along };
      drawLabel(layout, scene.cut.label, anchor, direction, labelFrame, palette.ink, metrics, taken);
    }
  }

  // Dimensions before the arrows: they are the quietest ink on the drawing and must not be the
  // thing a label gets pushed off to make room for.
  for (const dimension of scene.dimensions ?? []) {
    const from = projection.at(dimension.from.x, dimension.from.y);
    const to = projection.at(dimension.to.x, dimension.to.y);
    const box = drawDimension(layout, from, to, dimension.offset, dimension.text, palette.inkFaint);
    if (box) taken.push(box);
  }

  // Curves before the arrows and after the geometry: they are the subject of the figures that
  // carry them, and the labels must be free to move around them.
  for (const curve of scene.curves ?? []) {
    const from = projection.at(curve.from.x, curve.from.y);
    const to = projection.at(curve.to.x, curve.to.y);
    const color = toneColor(context, curve.tone);
    // Half the room above the baseline, so the curve never climbs out of its own frame.
    const amplitude = Math.min((plot.top - plot.bottom) * 0.42, frame.y + frame.height - Math.max(from.y, to.y) - 14);
    const peak = drawPolynomialCurve(
      layout, curve.coefficients, curve.domain, { from, to }, Math.max(amplitude, 12), color,
      { fill: curve.fill },
    );
    if (curve.label) {
      const span = curve.domain.x1 - curve.domain.x0;
      const ratio = span > 0 ? (peak.peakAt - curve.domain.x0) / span : 0.5;
      const at = {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio + Math.max(amplitude, 12) * 0.55,
      };
      drawLabel(layout, curve.label, at, { x: 0, y: 1 }, labelFrame, color, metrics, taken, false);
    }
  }

  for (const marker of scene.hinges ?? []) {
    const at = resolvePlace(context, marker.place, projection);
    if (at) drawHinge(layout, at, metrics.nodeDot * 1.1, palette.ink);
  }

  for (const force of scene.forces ?? []) {
    const anchored = resolvePlace(context, force.place, projection);
    if (!anchored) continue;
    const color = toneColor(context, force.tone);
    const length = force.length === undefined ? metrics.arrow : metrics.arrow * force.length;
    const magnitude = Math.hypot(force.fx, force.fy);
    if (!(magnitude > 1e-12)) continue;
    // A tail-anchored arrow starts where it was placed and grows outward, so the head lands a
    // full arrow-length beyond the anchor in the force's own direction.
    // A reaction pointing up at a supported node would otherwise be drawn straight through its
    // own support glyph; it starts below the glyph instead.
    const clearance = force.tone === 'reaction' && force.fy > 0 && 'nodeId' in force.place
      && (context.index.node(force.place.nodeId)?.support.type ?? 'none') !== 'none'
      ? SUPPORT_DEPTH
      : 0;
    const base = { x: anchored.x, y: anchored.y - clearance };
    const head = force.anchor === 'tail'
      ? { x: base.x + force.fx / magnitude * length, y: base.y + force.fy / magnitude * length }
      : base;
    const tail = drawArrow(layout, head, force.fx, force.fy, color, length, metrics.memberWeight * 0.7);
    if (!tail || !force.label) continue;
    // Both ends push the label *away* from the body: at the head an arrow leaving continues in
    // its own direction, at the tail an arrow arriving continues backwards along it.
    const outward = force.anchor === 'tail' ? 1 : -1;
    drawLabel(
      layout, force.label,
      force.anchor === 'tail' ? head : tail,
      { x: force.fx / magnitude * outward, y: force.fy / magnitude * outward },
      labelFrame, color, metrics, taken,
    );
  }

  for (const moment of scene.moments ?? []) {
    const at = resolvePlace(context, moment.place, projection);
    if (!at) continue;
    const color = toneColor(context, moment.tone);
    const radius = metrics.momentRadius;
    const head = drawMomentArc(layout, at, moment.sign, radius, color, metrics.memberWeight * 0.65);
    const out = Math.hypot(head.x - at.x, head.y - at.y) || 1;
    if (moment.label) {
      drawLabel(
        layout, moment.label,
        { x: at.x + (head.x - at.x) / out * (radius + 3), y: at.y + (head.y - at.y) / out * (radius + 3) },
        { x: (head.x - at.x) / out, y: (head.y - at.y) / out },
        labelFrame, color, metrics, taken,
      );
    }
  }

  for (const note of scene.notes ?? []) {
    const at = resolvePlace(context, note.place, projection);
    if (!at) continue;
    drawLabel(layout, note.text, at, { x: 0.6, y: -1 }, labelFrame, toneColor(context, note.tone ?? 'faint'), metrics, taken, false);
  }

  if (scene.axes !== false) {
    drawAxesIndicator(layout, axesOrigin, 11, palette.inkFaint);
  }
};
