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
 * `FreeBodyScene`, with no `pdf-lib` page anywhere near them.
 *
 * Nothing in this file computes structural results. Every force it draws was solved by
 * `src/analysis-methods/`, checked against the matrix analysis there, and handed over as a
 * number with a label.
 */
import { memberAxis } from '../../graphics/structureGeometry';
import { pdfText, wrapText } from './pdfGlyphs';
import { TYPE } from './pdfTheme';
import {
  createFocusProjection,
  createProjection,
  drawArrow,
  drawDashedLine,
  drawGhostModel,
  drawMemberLoads,
  drawMomentArc,
  drawNodeDot,
  drawSupportGlyph,
  type Point,
  type Projection,
  type Rect,
} from './pdfScene';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor, ReportContext } from './reportContext';

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
  /** Longer arrows for the governing action of the scene. */
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
 * A member the cut passes *through*, rather than between: the part beyond `ratio` is greyed
 * out so the free body is the portion actually retained.
 *
 * Without this a beam cut mid-span drew the whole beam in ink, which says the free body is the
 * entire member — the opposite of what the section is about.
 */
export interface ScenePartialMember {
  readonly memberId: string;
  /** Station of the cut along the member, 0 at node i and 1 at node j. */
  readonly ratio: number;
  /** Which side of the cut stays in ink. */
  readonly keep: 'start' | 'end';
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
  readonly partialMember?: ScenePartialMember;
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
  /** Legend line under the drawing, naming what the marks mean. */
  readonly legend?: string;
}

const toneColor = (context: ReportContext, tone: SceneTone): PdfColor => {
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

const LABEL_SIZE = 5.9;

/**
 * Writes a mark's label beside it without letting it run out of the frame.
 *
 * The offset is perpendicular to the mark's own direction — an arrow's shaft, a cut's line —
 * because a label placed along that direction lands on top of the member the mark springs
 * from, which is exactly where a reader is looking. The clamp is what keeps a long value on a
 * bar near the right edge from being sliced off by the figure border.
 */
const placeLabel = (
  layout: PdfLayout,
  text: string,
  at: Point,
  direction: Point,
  frame: Rect,
  color: PdfColor,
  font = layout.fonts.bold,
): void => {
  const label = pdfText(text);
  const width = font.widthOfTextAtSize(label, LABEL_SIZE);
  const normal = { x: -direction.y, y: direction.x };
  const x = at.x + direction.x * 6 + normal.x * 5 - (direction.x < -0.4 ? width : 0);
  const y = at.y + direction.y * 6 + normal.y * 5 - LABEL_SIZE * 0.35;
  layout.page.drawText(label, {
    x: Math.min(Math.max(x, frame.x + 4), frame.x + frame.width - width - 4),
    y: Math.min(Math.max(y, frame.y + 4), frame.y + frame.height - LABEL_SIZE - 4),
    size: LABEL_SIZE,
    font,
    color,
  });
};

export const drawFreeBodyScene = (
  context: ReportContext,
  rect: Rect,
  scene: FreeBodyScene,
): void => {
  const { layout, project } = context;
  const { palette, fonts } = layout;
  if (!project.nodes.length) return;
  const page = layout.page;
  page.drawRectangle({
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    borderWidth: 0.5, borderColor: palette.rule, color: palette.paper,
  });

  // A support glyph hangs ~19pt below its node and an arrow label another ~8pt, so the plot
  // floor sits well clear of the legend band rather than writing into it.
  const legendHeight = scene.legend ? TYPE.micro * 2.4 + 6 : 0;
  const plot = {
    left: rect.x + 58,
    right: rect.x + rect.width - 58,
    bottom: rect.y + 44 + legendHeight,
    top: rect.y + rect.height - 30,
  };
  const focusNode = scene.focus ? context.index.node(scene.focus.nodeId) : undefined;
  const projection = focusNode && scene.focus
    ? createFocusProjection({ x: focusNode.x, y: focusNode.y }, scene.focus.radius, plot)
    : createProjection(project.nodes, plot);

  if (scene.title) {
    page.drawText(pdfText(scene.title.toUpperCase()), {
      x: rect.x + 10, y: rect.y + rect.height - 14, size: TYPE.micro, font: fonts.bold, color: palette.inkSoft,
    });
  }

  drawGhostModel(context, projection, {
    solidMemberIds: scene.keptMemberIds ? new Set(scene.keptMemberIds) : undefined,
    solidNodeIds: scene.keptNodeIds ? new Set(scene.keptNodeIds) : undefined,
    hideGhost: scene.hideGhost,
  });

  // A focused scene draws the joint itself on top of the ghost, so it never disappears under
  // the bars that meet there.
  if (focusNode) {
    const at = projection.at(focusNode.x, focusNode.y);
    drawNodeDot(layout, at, focusNode.id, palette.ink, 3.6, 7);
    drawSupportGlyph(layout, at, focusNode.support, palette.inkSoft);
  }

  // The severed member's discarded half: painted out and redrawn in the ghost style, so what
  // is left in ink is exactly the free body the equations below belong to.
  if (scene.partialMember) {
    const member = context.index.member(scene.partialMember.memberId);
    const ni = member ? context.index.node(member.i) : undefined;
    const nj = member ? context.index.node(member.j) : undefined;
    if (member && ni && nj) {
      const ratio = Math.min(1, Math.max(0, scene.partialMember.ratio));
      const start = projection.at(ni.x, ni.y);
      const end = projection.at(nj.x, nj.y);
      const at = { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
      const discarded = scene.partialMember.keep === 'start' ? end : start;
      page.drawLine({ start: at, end: discarded, thickness: 4, color: palette.paper });
      page.drawLine({ start: at, end: discarded, thickness: 0.8, color: palette.inkFaint, opacity: 0.5, dashArray: [2.4, 2.4] });
    }
  }

  if (scene.includeMemberLoads) {
    const partial = scene.partialMember;
    drawMemberLoads(context, projection, {
      onlyMemberIds: scene.keptMemberIds
        ? new Set([...scene.keptMemberIds, ...(partial ? [partial.memberId] : [])])
        : undefined,
      // On the severed member the load stops at the cut, because past the cut it acts on the
      // portion that was removed.
      upTo: (memberId) => partial && memberId === partial.memberId
        ? (partial.keep === 'start' ? partial.ratio : 1)
        : 1,
    });
  }

  if (scene.cut) {
    const from = projection.at(scene.cut.from.x, scene.cut.from.y);
    const to = projection.at(scene.cut.to.x, scene.cut.to.y);
    drawDashedLine(layout, from, to, palette.ink, 1.1);
    if (scene.cut.label) {
      const along = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const where = scene.cut.labelAt ?? 'end';
      const anchor = where === 'middle'
        ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
        : where === 'start' ? from : to;
      const direction = where === 'start'
        ? { x: (from.x - to.x) / along, y: (from.y - to.y) / along }
        : { x: (to.x - from.x) / along, y: (to.y - from.y) / along };
      placeLabel(layout, scene.cut.label, anchor, direction, rect, palette.ink);
    }
  }

  for (const force of scene.forces ?? []) {
    const anchored = resolvePlace(context, force.place, projection);
    if (!anchored) continue;
    const color = toneColor(context, force.tone);
    const length = force.length ?? 22;
    const magnitude = Math.hypot(force.fx, force.fy);
    if (!(magnitude > 1e-12)) continue;
    // A tail-anchored arrow starts where it was placed and grows outward, so the head lands a
    // full arrow-length beyond the anchor in the force's own direction.
    const head = force.anchor === 'tail'
      ? { x: anchored.x + force.fx / magnitude * length, y: anchored.y + force.fy / magnitude * length }
      : anchored;
    const tail = drawArrow(layout, head, force.fx, force.fy, color, length);
    if (!tail || !force.label) continue;
    // The label goes at the far end of the arrow from the body it belongs to — the head for a
    // force leaving, the tail for one arriving — nudged perpendicular to the shaft so it never
    // lies along the member the arrow springs from.
    // Both ends push the label *away* from the body: at the head an arrow leaving continues in
    // its own direction, at the tail an arrow arriving continues backwards along it. Without
    // the flip a vertical reaction wrote its value straight over its own support glyph.
    const outward = force.anchor === 'tail' ? 1 : -1;
    placeLabel(
      layout, force.label,
      force.anchor === 'tail' ? head : tail,
      { x: force.fx / magnitude * outward, y: force.fy / magnitude * outward },
      rect, color,
    );
  }

  for (const moment of scene.moments ?? []) {
    const at = resolvePlace(context, moment.place, projection);
    if (!at) continue;
    const color = toneColor(context, moment.tone);
    const radius = 9.5;
    const head = drawMomentArc(layout, at, moment.sign, radius, color);
    // Clear of the arc it names: the label hangs a full radius out along the head's own
    // outward direction, not on the circle where the stroke already is.
    const out = Math.hypot(head.x - at.x, head.y - at.y) || 1;
    if (moment.label) {
      placeLabel(
        layout, moment.label,
        { x: at.x + (head.x - at.x) / out * (radius + 4), y: at.y + (head.y - at.y) / out * (radius + 4) },
        { x: (head.x - at.x) / out, y: (head.y - at.y) / out },
        rect, color,
      );
    }
  }

  for (const note of scene.notes ?? []) {
    const at = resolvePlace(context, note.place, projection);
    if (!at) continue;
    placeLabel(layout, note.text, at, { x: 0.6, y: -1 }, rect, toneColor(context, note.tone ?? 'faint'), fonts.regular);
  }

  if (scene.legend) {
    const lines = wrapText(scene.legend, fonts.regular, TYPE.micro, rect.width - 20);
    const shown = lines.slice(0, 3);
    const top = rect.y + 8 + shown.length * TYPE.micro * 1.35;
    // A hairline separates the reading of the drawing from the drawing itself, so the legend
    // never looks like another annotation floating in the frame.
    page.drawLine({
      start: { x: rect.x + 10, y: top + 4 }, end: { x: rect.x + rect.width - 10, y: top + 4 },
      thickness: 0.4, color: palette.rule,
    });
    shown.forEach((line, index) => {
      page.drawText(line, {
        x: rect.x + 10, y: top - (index + 1) * TYPE.micro * 1.35 + TYPE.micro * 0.35,
        size: TYPE.micro, font: fonts.regular, color: palette.inkSoft,
      });
    });
  }
};
