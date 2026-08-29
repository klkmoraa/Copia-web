/**
 * One free-body scene per step of the chosen method.
 *
 * Every builder here is a pure function from what `src/analysis-methods/` already solved to a
 * list of `FreeBodyScene` objects. Nothing is recomputed: a bar force, a storey shear, a
 * support moment or a distribution factor arrives as a number that module already checked
 * against the matrix analysis, and this file only decides where on the drawing it goes.
 *
 * Being pure is what makes the drawings testable. "The cut keeps these nodes", "this bar's
 * arrow points away from the retained side", "the storey cut sits at mid-height" are assertions
 * about the returned objects, with no PDF page in sight.
 *
 * A builder returns `[]` rather than a half-true picture whenever the method's own result does
 * not support one — the same rule `freeBodyEquations` follows for the arithmetic.
 */
import type { CantileverMethodResult } from '../../analysis-methods/cantileverMethod';
import type { CastiglianoTrussResult } from '../../analysis-methods/castiglianoTruss';
import type { ConjugateBeamResult } from '../../analysis-methods/conjugateBeam';
import type { DoubleIntegrationResult } from '../../analysis-methods/doubleIntegration';
import type { HardyCrossResult } from '../../analysis-methods/hardyCross';
import type { KaniResult } from '../../analysis-methods/kaniFrame';
import type { MethodOfJointsResult } from '../../analysis-methods/methodOfJoints';
import type { MethodOfSectionsResult } from '../../analysis-methods/methodOfSections';
import type { PortalMethodResult } from '../../analysis-methods/portalMethod';
import type { ThreeMomentResult } from '../../analysis-methods/threeMoment';
import type { VirtualWorkResult } from '../../analysis-methods/virtualWork';
import { clearCell, displayCell, number, unitFor } from './pdfFormat';
import { axialDirection, memberMidpoint, type FreeBodyScene, type SceneForce } from './pdfFreeBody';
import { evaluatePolynomial, type Point } from './pdfScene';
import type { ReportContext } from './reportContext';

/** `N(AB) = 12.4 kN (T)` — the one label format every bar force in these scenes carries. */
/** Support kinds, in the words the conversion table of the method uses. */
const CONJUGATE_KIND_LABEL: Record<ConjugateBeamResult['ends'][number]['realKind'], string> = {
  fixed: 'empotramiento',
  simple: 'apoyo simple',
  guided: 'deslizante',
  free: 'extremo libre',
};

const barLabel = (
  context: ReportContext,
  symbol: string,
  memberId: string,
  value: number,
  scale: number,
): string => {
  const { project } = context;
  const magnitude = clearCell(project, Math.abs(value), 'force', scale);
  const sense = Math.abs(value) <= scale * 1e-9 ? '' : value > 0 ? ' (T)' : ' (C)';
  return `${symbol}(${memberId}) = ${magnitude} ${unitFor(project, 'force')}${sense}`;
};

const momentLabel = (context: ReportContext, symbol: string, value: number): string =>
  `${symbol} = ${displayCell(context.project, value, 'moment')} ${unitFor(context.project, 'moment')}`;

const forceLabel = (context: ReportContext, symbol: string, value: number, scale: number): string =>
  `${symbol} = ${clearCell(context.project, value, 'force', scale)} ${unitFor(context.project, 'force')}`;

/**
 * The external actions on a retained portion: the reaction of every support it keeps and every
 * nodal load applied on it.
 *
 * A free body drawn with only its internal unknowns is not a free body — the equilibrium sums
 * printed under these figures carry a reaction term for each of these, and a reader has to be
 * able to point at it on the drawing.
 */
const externalActionsOn = (
  context: ReportContext,
  nodeIds: readonly string[],
): SceneForce[] => {
  const { project, analysis, scenarioFactors } = context;
  const kept = new Set(nodeIds);
  const reactionScale = Math.max(
    1e-12,
    ...analysis.nodeResults.flatMap((entry) => [Math.abs(entry.rx), Math.abs(entry.ry)]),
  );
  const forces: SceneForce[] = [];
  for (const nodeId of nodeIds) {
    const reaction = analysis.nodeResults.find((entry) => entry.nodeId === nodeId);
    if (reaction && Math.abs(reaction.rx) > reactionScale * 1e-9) {
      forces.push({
        place: { nodeId }, fx: reaction.rx, fy: 0, tone: 'reaction', length: 1.0,
        label: forceLabel(context, `Rx(${nodeId})`, reaction.rx, reactionScale),
      });
    }
    if (reaction && Math.abs(reaction.ry) > reactionScale * 1e-9) {
      forces.push({
        place: { nodeId }, fx: 0, fy: reaction.ry, tone: 'reaction', length: 1.0,
        label: forceLabel(context, `Ry(${nodeId})`, reaction.ry, reactionScale),
      });
    }
  }
  for (const load of project.nodalLoads) {
    if (!kept.has(load.nodeId)) continue;
    const factor = scenarioFactors[load.caseId] ?? 0;
    if (factor === 0 || (load.fx === 0 && load.fy === 0)) continue;
    forces.push({
      place: { nodeId: load.nodeId }, fx: load.fx * factor, fy: load.fy * factor, tone: 'load',
      length: 1.0, label: load.id,
    });
  }
  return forces;
};

/**
 * The straight cut through a set of severed members.
 *
 * The line is drawn through the midpoints of the bars it severs, which is where a reader would
 * put it: with two or three bars the two extreme midpoints define it and it is extended past
 * both; with a single bar there is no direction to fit, so the cut is a short stroke across it.
 */
export const cutLineThrough = (
  context: ReportContext,
  severedMemberIds: readonly string[],
): { from: Point; to: Point } | undefined => {
  const midpoints = severedMemberIds
    .map((memberId) => memberMidpoint(context, memberId))
    .filter((point): point is Point => point !== undefined);
  if (!midpoints.length) return undefined;

  if (midpoints.length === 1) {
    const member = context.index.member(severedMemberIds[0]);
    const ni = member ? context.index.node(member.i) : undefined;
    const nj = member ? context.index.node(member.j) : undefined;
    if (!ni || !nj) return undefined;
    const dx = nj.x - ni.x;
    const dy = nj.y - ni.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) return undefined;
    // Perpendicular to the bar, a third of its length to each side.
    const half = length / 3;
    const nx = -dy / length * half;
    const ny = dx / length * half;
    const [centre] = midpoints;
    return { from: { x: centre.x - nx, y: centre.y - ny }, to: { x: centre.x + nx, y: centre.y + ny } };
  }

  let from = midpoints[0];
  let to = midpoints[0];
  let widest = 0;
  for (const a of midpoints) {
    for (const b of midpoints) {
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (distance > widest) {
        widest = distance;
        from = a;
        to = b;
      }
    }
  }
  if (!(widest > 0)) return undefined;
  // Just enough overrun that the cut visibly crosses the outermost bars instead of stopping on
  // their axes. It was a quarter of the span, which on a full-size drawing shot far outside the
  // structure and made the cut look like a stray line.
  const overrun = 0.12;
  const dx = (to.x - from.x) * overrun;
  const dy = (to.y - from.y) * overrun;
  return { from: { x: from.x - dx, y: from.y - dy }, to: { x: to.x + dx, y: to.y + dy } };
};

// ---------------------------------------------------------------------------------------
// Trusses
// ---------------------------------------------------------------------------------------

/** One scene per cut: the retained portion, the cut, and the bar forces the cut exposes. */
export const sectionCutScenes = (
  context: ReportContext,
  solution: MethodOfSectionsResult,
): FreeBodyScene[] => {
  const { project } = context;
  const scale = Math.max(1e-12, ...solution.cuts.flatMap((cut) => cut.members.map((member) => Math.abs(member.value))));
  return solution.cuts.flatMap((cut) => {
    const kept = new Set(cut.keptNodeIds);
    const severed = new Set(cut.members.map((member) => member.memberId));
    const keptMemberIds = project.members
      .filter((member) => kept.has(member.i) && kept.has(member.j) && !severed.has(member.id))
      .map((member) => member.id);
    const line = cutLineThrough(context, [...severed]);

    const forces: SceneForce[] = [];
    for (const bar of cut.members) {
      const model = context.index.member(bar.memberId);
      if (!model) continue;
      const retained = kept.has(model.i) ? model.i : kept.has(model.j) ? model.j : undefined;
      const midpoint = memberMidpoint(context, bar.memberId);
      if (!retained || !midpoint) continue;
      const direction = axialDirection(context, bar.memberId, retained, bar.value);
      if (!direction) continue;
      forces.push({
        place: { at: midpoint },
        fx: direction.fx,
        fy: direction.fy,
        label: barLabel(context, 'N', bar.memberId, bar.value, scale),
        tone: 'axial',
        anchor: 'tail',
        length: 1.08,
      });
    }
    if (!forces.length) return [];
    forces.push(...externalActionsOn(context, cut.keptNodeIds));

    // The stub of each severed bar, from the node the cut kept out to the cut face, is part of
    // the free body: it is where the bar's own force acts. Ghosting the whole bar left a truss
    // cut at two members with nothing in ink but a single node.
    const severedStubs = cut.members.flatMap((bar) => {
      const model = context.index.member(bar.memberId);
      if (!model) return [];
      const keep = kept.has(model.i) ? 'start' as const : kept.has(model.j) ? 'end' as const : undefined;
      return keep ? [{ memberId: bar.memberId, ratio: 0.5, keep }] : [];
    });

    // `freeBodyEquations` reduces its moment sum about the first retained node, so the drawing
    // names that point: a `ΣM(O)` under a figure with no O on it is a sum about nowhere.
    const origin = cut.keptNodeIds[0];
    return [{
      title: `corte ${cut.cutIndex + 1}`,
      keptNodeIds: cut.keptNodeIds,
      keptMemberIds,
      notes: origin ? [{ place: { nodeId: origin }, text: `O · punto de reducción de ΣM`, tone: 'ink' as const }] : undefined,
      cut: line ? { ...line, label: 'corte' } : undefined,
      severed: severedStubs,
      forces,
      legend: 'Trazo discontinuo: el corte imaginario. En azul, la fuerza axial que cada barra seccionada '
        + 'ejerce sobre la porción conservada — hacia fuera en tracción (T), hacia dentro en compresión (C). '
        + 'La porción retirada queda en gris.',
    }];
  });
};

/** One scene per joint: the pin, its bars in their real directions, and the forces on it. */
export const jointScenes = (
  context: ReportContext,
  solution: MethodOfJointsResult,
): FreeBodyScene[] => {
  const { project } = context;
  const solved = new Map<string, number>();
  for (const step of solution.steps) {
    for (const member of step.members) solved.set(member.memberId, member.value);
  }
  const scale = Math.max(1e-12, ...[...solved.values()].map((value) => Math.abs(value)));

  return solution.steps.flatMap((step) => {
    const node = context.index.node(step.nodeId);
    if (!node) return [];
    const meeting = project.members.filter((member) => member.i === step.nodeId || member.j === step.nodeId);
    if (!meeting.length) return [];

    const forces: SceneForce[] = [];
    for (const member of meeting) {
      const value = solved.get(member.id);
      if (value === undefined) continue;
      const direction = axialDirection(context, member.id, step.nodeId, value);
      if (!direction) continue;
      // The bar's force on the *joint*: tension pulls the joint along the bar, towards the far
      // end. Anchored at the joint itself, growing outward.
      const justSolved = step.members.some((entry) => entry.memberId === member.id);
      forces.push({
        place: { nodeId: step.nodeId },
        fx: direction.fx,
        fy: direction.fy,
        label: barLabel(context, justSolved ? 'N' : 'N ya conocida', member.id, value, scale),
        tone: 'axial',
        anchor: 'tail',
        length: justSolved ? 1.25 : 1,
      });
    }

    forces.push(...externalActionsOn(context, [step.nodeId]));
    if (!forces.length) return [];

    // The free body of the Method of Joints is the pin, not the truss. Every concurrent bar is
    // therefore drawn as a *stub* running out of the joint and cut short, with the rest of it
    // ghosted — which is what "isolate the joint" means, and what showing whole bars in ink did
    // not say.
    const reach = Math.max(
      ...meeting.map((member) => {
        const far = context.index.node(member.i === step.nodeId ? member.j : member.i);
        return far ? Math.hypot(far.x - node.x, far.y - node.y) : 0;
      }),
      1e-6,
    );
    const stubs = meeting.flatMap((member) => {
      const far = context.index.node(member.i === step.nodeId ? member.j : member.i);
      if (!far) return [];
      const length = Math.hypot(far.x - node.x, far.y - node.y);
      if (!(length > 0)) return [];
      // Every stub reaches the same distance from the joint, whatever the bar's own length, so
      // the drawing reads as a star of directions rather than as a fragment of the truss.
      const fraction = Math.min(0.9, (reach * 0.42) / length);
      const fromStart = member.i === step.nodeId;
      return [{
        memberId: member.id,
        ratio: fromStart ? fraction : 1 - fraction,
        keep: fromStart ? 'start' as const : 'end' as const,
      }];
    });

    return [{
      title: `nudo ${step.nodeId}`,
      focus: { nodeId: step.nodeId, radius: reach * 0.62 },
      keptNodeIds: [step.nodeId],
      keptMemberIds: [],
      severed: stubs,
      isolation: { nodeId: step.nodeId, radius: reach * 0.16 },
      forces,
      legend: 'El nudo aislado: el círculo de trazos es el corte que lo separa de la armadura, y cada '
        + 'muñón es una barra que concurre en él, con la fuerza que ejerce sobre el nudo — hacia fuera en '
        + 'tracción, hacia dentro en compresión. Las dos sumas de abajo son exactamente este dibujo.',
    }];
  });
};

/** The real system and the unit-load system, side by side in the reading order. */
export const virtualWorkScenes = (
  context: ReportContext,
  solution: VirtualWorkResult,
): FreeBodyScene[] => {
  const { narrated } = solution;
  const contributions = narrated.contributions;
  if (!contributions.length) return [];
  const realScale = Math.max(1e-12, ...contributions.map((entry) => Math.abs(entry.axialForce)));
  const virtualScale = Math.max(1e-12, ...contributions.map((entry) => Math.abs(entry.virtualForce)));

  const barForces = (pick: (entry: typeof contributions[number]) => number, symbol: string, scale: number): SceneForce[] =>
    contributions.flatMap((entry) => {
      const member = context.index.member(entry.memberId);
      const midpoint = memberMidpoint(context, entry.memberId);
      if (!member || !midpoint) return [];
      const value = pick(entry);
      if (Math.abs(value) <= scale * 1e-9) return [];
      const direction = axialDirection(context, entry.memberId, member.i, value);
      if (!direction) return [];
      return [{
        place: { at: midpoint }, fx: direction.fx, fy: direction.fy, tone: 'axial' as const, anchor: 'tail' as const,
        label: symbol === 'n'
          ? `n(${entry.memberId}) = ${value.toFixed(3)}`
          : barLabel(context, 'N', entry.memberId, value, scale),
        length: 0.83,
      }];
    });

  const direction = narrated.component === 'ux' ? { fx: 1, fy: 0 } : { fx: 0, fy: 1 };
  return [
    {
      title: 'sistema real',
      forces: [
        ...externalActionsOn(context, context.project.nodes.map((node) => node.id)),
        ...barForces((entry) => entry.axialForce, 'N', realScale),
      ],
      legend: 'Armadura bajo las cargas reales: N es la fuerza axial de cada barra en este estado. '
        + 'Las cargas aplicadas y las reacciones son las del modelo.',
    },
    {
      title: 'sistema virtual (carga unitaria)',
      forces: [
        {
          place: { nodeId: narrated.nodeId }, ...direction, tone: 'load', length: 1.25,
          label: `1 (${narrated.component === 'ux' ? 'horizontal' : 'vertical'}) en ${narrated.nodeId}`,
        },
        ...barForces((entry) => entry.virtualForce, 'n', virtualScale),
      ],
      legend: 'La misma armadura sin las cargas reales y con una sola carga unitaria en el nudo y la '
        + 'dirección de interés: n es la fuerza que esa carga produce en cada barra.',
    },
  ];
};

/** The released primary structure, then one scene per redundant reaction. */
export const castiglianoScenes = (
  context: ReportContext,
  solution: CastiglianoTrussResult,
): FreeBodyScene[] => {
  if (!solution.members.length) return [];
  const primaryScale = Math.max(1e-12, ...solution.members.map((member) => Math.abs(member.primaryForce)));
  const releasedNodes = new Set(solution.redundants.map((redundant) => redundant.nodeId));

  const primary: FreeBodyScene = {
    title: 'estructura primaria',
    forces: solution.members.flatMap<SceneForce>((entry) => {
      const member = context.index.member(entry.memberId);
      const midpoint = memberMidpoint(context, entry.memberId);
      if (!member || !midpoint) return [];
      if (Math.abs(entry.primaryForce) <= primaryScale * 1e-9) return [];
      const direction = axialDirection(context, entry.memberId, member.i, entry.primaryForce);
      if (!direction) return [];
      return [{
        place: { at: midpoint }, fx: direction.fx, fy: direction.fy, tone: 'axial' as const, anchor: 'tail' as const,
        label: barLabel(context, 'N₀', entry.memberId, entry.primaryForce, primaryScale), length: 0.83,
      }];
    }),
    notes: [...releasedNodes].map((nodeId) => ({ place: { nodeId }, text: 'apoyo liberado' })),
    legend: 'La armadura con las reacciones redundantes liberadas, bajo las cargas reales: N₀ es la fuerza '
      + 'de barra de ese estado isostático, la primera mitad de la suma que resuelve cada redundante.',
  };

  const redundantScenes = solution.redundants.map<FreeBodyScene>((redundant) => ({
    title: `redundante ${redundant.symbol}`,
    forces: [{
      place: { nodeId: redundant.nodeId },
      fx: redundant.component === 'ux' ? 1 : 0,
      fy: redundant.component === 'uy' ? 1 : 0,
      tone: 'reaction',
      anchor: 'tail',
      length: 1.25,
      label: `${redundant.symbol} = ${displayCell(context.project, redundant.value, 'force')} ${unitFor(context.project, 'force')}`,
    }],
    notes: [{ place: { nodeId: redundant.nodeId }, text: 'desplazamiento impuesto nulo' }],
    legend: `En la estructura real ${redundant.nodeId} no se mueve en esa dirección: esa condición es la que `
      + `fija ${redundant.symbol}, y la última columna de la tabla es lo que el análisis matricial obtiene ahí.`,
  }));

  return [primary, ...redundantScenes];
};

// ---------------------------------------------------------------------------------------
// Beams
// ---------------------------------------------------------------------------------------

interface BeamSegment {
  readonly x0: number;
  readonly x1: number;
}

/**
 * One scene per stretch of a beam: the beam cut at an interior station of that stretch, with
 * `V(x)` and `M(x)` on the exposed face.
 *
 * This is the drawing Double Integration and Conjugate Beam are *about* — the free body whose
 * moment equation the whole method integrates — and neither section had it.
 */
export const beamSegmentScenes = (
  context: ReportContext,
  axisNodeIds: readonly string[],
  segments: readonly BeamSegment[],
  span: number,
  title: (index: number) => string,
  legend: string,
): FreeBodyScene[] => {
  const start = context.index.node(axisNodeIds[0]);
  const end = context.index.node(axisNodeIds[axisNodeIds.length - 1]);
  if (!start || !end || !(span > 0)) return [];
  const along = (distance: number): Point => {
    const ratio = Math.min(1, Math.max(0, distance / span));
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
  };
  // Distance of every axis node from the left end, so a station can be told which member it
  // falls inside and how far along that member it lands.
  const stations = axisNodeIds.map((nodeId) => {
    const node = context.index.node(nodeId);
    return node ? Math.hypot(node.x - start.x, node.y - start.y) : 0;
  });

  return segments.flatMap((segment, index) => {
    const station = (segment.x0 + segment.x1) / 2;
    const at = along(station);
    const spanIndex = stations.findIndex((distance, position) => position > 0 && station <= distance + 1e-9);
    if (spanIndex <= 0) return [];
    const leftId = axisNodeIds[spanIndex - 1];
    const rightId = axisNodeIds[spanIndex];
    const member = context.project.members.find(
      (entry) => (entry.i === leftId && entry.j === rightId) || (entry.i === rightId && entry.j === leftId),
    );
    if (!member) return [];
    const memberSpan = stations[spanIndex] - stations[spanIndex - 1];
    const withinMember = memberSpan > 0 ? (station - stations[spanIndex - 1]) / memberSpan : 0;
    // The member may be declared right-to-left, in which case "keep the left portion" is "keep
    // the end", and the ratio runs the other way.
    const declaredLeftToRight = member.i === leftId;
    const ratio = declaredLeftToRight ? withinMember : 1 - withinMember;

    // Members entirely to the left of the station stay in ink; the severed one is handled by
    // `partialMember`, and everything to its right is ghosted.
    const keptMemberIds = axisNodeIds.slice(0, spanIndex).flatMap((_nodeId, position) => {
      if (position === 0 && spanIndex === 1) return [];
      const previous = axisNodeIds[position];
      const next = axisNodeIds[position + 1];
      const entry = context.project.members.find(
        (candidate) => (candidate.i === previous && candidate.j === next) || (candidate.i === next && candidate.j === previous),
      );
      return entry && entry.id !== member.id ? [entry.id] : [];
    });

    // Perpendicular to the beam axis, long enough to read as a cut across it.
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const half = span * 0.09;
    const normal = { x: -dy / length * half, y: dx / length * half };
    // V and M act on the retained face, so they are drawn just inside the cut rather than on
    // top of it, where the station label lives.
    const face = along(Math.max(0, station - span * 0.035));

    return [{
      title: title(index),
      keptNodeIds: axisNodeIds.slice(0, spanIndex),
      keptMemberIds: [...keptMemberIds, member.id],
      severed: [{ memberId: member.id, ratio, keep: declaredLeftToRight ? 'start' : 'end' }],
      includeMemberLoads: true,
      // The station is what `x` means in every expression below the figure, so it is measured
      // on the drawing rather than only named in the cut's own label.
      dimensions: [{
        from: { x: start.x, y: start.y },
        to: at,
        offset: -26,
        text: `x = ${displayCell(context.project, station, 'length')} ${unitFor(context.project, 'length')}`,
      }],
      cut: {
        from: { x: at.x - normal.x, y: at.y - normal.y },
        to: { x: at.x + normal.x, y: at.y + normal.y },
        label: `x = ${displayCell(context.project, station, 'length')} ${unitFor(context.project, 'length')}`,
        labelAt: 'end',
      },
      forces: [
        ...externalActionsOn(context, axisNodeIds.slice(0, spanIndex)),
        { place: { at: face }, fx: 0, fy: -1, tone: 'shear', anchor: 'tail', length: 0.83, label: 'V(x)' },
      ],
      moments: [{ place: { at: face }, sign: 1, label: 'M(x)', tone: 'moment' }],
      legend,
    }];
  });
};

export const doubleIntegrationScenes = (
  context: ReportContext,
  solution: DoubleIntegrationResult,
): FreeBodyScene[] => beamSegmentScenes(
  context,
  solution.axis.stations.map((station) => station.nodeId),
  solution.segments,
  solution.axis.length,
  (index) => `tramo ${index + 1}`,
  'La viga cortada dentro del tramo: sobre la porción izquierda actúan las cargas y reacciones ya conocidas, '
  + 'y en la cara del corte aparecen V(x) y M(x). Igualar el momento de esa porción a M(x) es la ecuación que '
  + 'las dos integraciones resuelven, con los coeficientes que se listan al lado.',
);

/**
 * The two beams the method is about.
 *
 * The cut this replaces was a copy of Double Integration's, which showed where `M(x)` comes
 * from and nothing of the conjugate beam — the whole point of the method. What a reader needs
 * to see is the pair: the real beam with its supports, and beneath it the fictitious beam
 * carrying `w* = M/EI` with every support already converted.
 */
export const conjugateBeamScenes = (
  context: ReportContext,
  solution: ConjugateBeamResult,
): FreeBodyScene[] => {
  const stations = solution.axis.stations;
  const first = context.index.node(stations[0]?.nodeId ?? '');
  const last = context.index.node(stations[stations.length - 1]?.nodeId ?? '');
  if (!first || !last || !(solution.axis.length > 0)) return [];
  const axisNodeIds = stations.map((station) => station.nodeId);
  const members = context.project.members
    .filter((member) => axisNodeIds.includes(member.i) && axisNodeIds.includes(member.j))
    .map((member) => member.id);

  const real: FreeBodyScene = {
    title: 'viga real',
    keptNodeIds: axisNodeIds,
    keptMemberIds: members,
    includeMemberLoads: true,
    hideGhost: true,
    notes: solution.ends.map((end) => ({
      place: { nodeId: end.nodeId },
      text: CONJUGATE_KIND_LABEL[end.realKind],
      tone: 'ink' as const,
    })),
    legend: 'La viga real con sus cargas y sus apoyos: de ella sale el diagrama de momentos M(x) que la '
      + 'viga conjugada va a cargar.',
  };

  // The fictitious load is a polynomial per stretch, so each stretch draws its own piece of the
  // curve over the same baseline.
  const curves = solution.segments.flatMap((segment) => {
    const peak = Math.max(...[0, 0.5, 1].map((t) =>
      Math.abs(evaluatePolynomial(segment.fictitiousLoad, segment.x0 + (segment.x1 - segment.x0) * t))));
    if (!(peak > 1e-12)) return [];
    return [{
      coefficients: segment.fictitiousLoad,
      domain: { x0: segment.x0, x1: segment.x1 },
      from: { x: first.x, y: first.y },
      to: { x: last.x, y: last.y },
      tone: 'moment' as const,
      fill: true,
    }];
  });

  const conjugate: FreeBodyScene = {
    title: 'viga conjugada',
    keptNodeIds: axisNodeIds,
    keptMemberIds: members,
    hideGhost: true,
    curves: curves.length ? [{ ...curves[0], label: 'w*(x) = M(x)/EI' }, ...curves.slice(1)] : undefined,
    notes: solution.ends.map((end) => ({
      place: { nodeId: end.nodeId },
      text: `${CONJUGATE_KIND_LABEL[end.realKind]} → ${CONJUGATE_KIND_LABEL[end.conjugateKind]}`,
      tone: 'ink' as const,
    })),
    legend: 'La misma luz, cargada con w* = M/EI y con cada apoyo ya convertido por la tabla fija. El '
      + 'cortante de esta viga ficticia es el giro de la real, y su momento es la flecha: por eso el '
      + 'problema se cierra con pura estática, sin integrar la ecuación de la elástica.',
  };

  return [real, conjugate];
};

interface SpanEnds {
  readonly leftNodeId: string;
  readonly rightNodeId: string;
  readonly momentLeft: number;
  readonly momentRight: number;
  readonly extra?: string;
}

/** One scene per span: the span isolated, with its end moments drawn as arcs. */
export const spanMomentScenes = (
  context: ReportContext,
  spans: readonly SpanEnds[],
  title: (index: number) => string,
  legend: string,
): FreeBodyScene[] => spans.flatMap((span, index) => {
  const member = context.project.members.find(
    (entry) => (entry.i === span.leftNodeId && entry.j === span.rightNodeId)
      || (entry.i === span.rightNodeId && entry.j === span.leftNodeId),
  );
  if (!member) return [];
  return [{
    title: title(index),
    keptNodeIds: [span.leftNodeId, span.rightNodeId],
    keptMemberIds: [member.id],
    includeMemberLoads: true,
    hideGhost: true,
    moments: [
      { place: { nodeId: span.leftNodeId }, sign: span.momentLeft, label: momentLabel(context, 'M', span.momentLeft), tone: 'moment' },
      { place: { nodeId: span.rightNodeId }, sign: span.momentRight, label: momentLabel(context, 'M', span.momentRight), tone: 'moment' },
    ],
    notes: span.extra ? [{ place: { nodeId: span.leftNodeId }, text: span.extra }] : undefined,
    legend,
  }];
});

/**
 * Coefficients of a span's *free* moment: what it would carry as a simply supported beam under
 * its own loads, with the support moments taken back out.
 *
 * The final moment of a span is the free moment plus a straight line between the two solved
 * support moments. Subtracting that line is therefore how the free diagram is recovered from
 * what `threeMoment.ts` publishes — no re-integration, and nothing this module decides.
 */
export const freeMomentCoefficients = (
  moment: readonly number[],
  x0: number,
  x1: number,
  momentLeft: number,
  momentRight: number,
): number[] => {
  const span = x1 - x0;
  if (!(span > 0)) return [...moment];
  // The correction line, written in the same global x the polynomial uses:
  //   c(x) = mL + (mR − mL)(x − x0)/L  =  [mL − (mR − mL)x0/L]  +  [(mR − mL)/L] x
  const slope = (momentRight - momentLeft) / span;
  const free = [...moment];
  while (free.length < 2) free.push(0);
  free[0] -= momentLeft - slope * x0;
  free[1] -= slope;
  return free;
};

/**
 * The drawing the Three Moments equation is about.
 *
 * Clapeyron's equation carries `Aₙaₙ` and `Aₙbₙ` — the first moments of each span's *free*
 * moment diagram about its two ends. The table beside this figure states those two numbers; the
 * figure is where they come from. Drawing the span with two end-moment arcs, as this used to,
 * showed the answer and hid the thing being integrated.
 */
export const threeMomentScenes = (
  context: ReportContext,
  solution: ThreeMomentResult,
): FreeBodyScene[] => {
  const moments = new Map(solution.supportMoments.map((entry) => [entry.nodeId, entry.value]));
  const stations = solution.axis.stations;

  return solution.spans.flatMap((span, index) => {
    const member = context.project.members.find(
      (entry) => (entry.i === span.leftNodeId && entry.j === span.rightNodeId)
        || (entry.i === span.rightNodeId && entry.j === span.leftNodeId),
    );
    const left = context.index.node(span.leftNodeId);
    const right = context.index.node(span.rightNodeId);
    if (!member || !left || !right) return [];
    const x0 = stations.find((station) => station.nodeId === span.leftNodeId)?.x;
    const x1 = stations.find((station) => station.nodeId === span.rightNodeId)?.x;
    // The narrated segments are per stretch, not per span; the one that opens this span is the
    // one whose own domain starts where the span does.
    const segment = x0 === undefined ? undefined : solution.segments.find((entry) => Math.abs(entry.x0 - x0) < 1e-9);
    if (x0 === undefined || x1 === undefined || !segment) return [];

    const free = freeMomentCoefficients(
      segment.moment, x0, x1,
      moments.get(span.leftNodeId) ?? 0,
      moments.get(span.rightNodeId) ?? 0,
    );
    // A span whose free moment is identically zero — no load on it — has nothing to draw and no
    // first moment to explain, so it is skipped rather than given a flat line labelled as a
    // diagram.
    const peak = Math.max(...[0, 0.25, 0.5, 0.75, 1].map((t) => Math.abs(evaluatePolynomial(free, x0 + (x1 - x0) * t))));
    if (!(peak > 1e-9)) return [];

    // `Aₙaₙ = A·a` and `Aₙbₙ = A·b` with `a + b = L`, so the two published first moments locate
    // the centroid without this module integrating anything itself.
    const total = span.firstMomentLeft + span.firstMomentRight;
    const a = Math.abs(total) > 1e-12 ? (span.firstMomentLeft / total) * span.length : span.length / 2;

    const along = (distance: number): Point => ({
      x: left.x + (right.x - left.x) * (distance / Math.max(span.length, 1e-9)),
      y: left.y + (right.y - left.y) * (distance / Math.max(span.length, 1e-9)),
    });

    return [{
      title: `vano ${index + 1}: momento libre`,
      keptNodeIds: [span.leftNodeId, span.rightNodeId],
      keptMemberIds: [member.id],
      includeMemberLoads: true,
      hideGhost: true,
      curves: [{
        coefficients: free,
        domain: { x0, x1 },
        from: { x: left.x, y: left.y },
        to: { x: right.x, y: right.y },
        tone: 'moment',
        fill: true,
        label: 'A = área del momento libre',
      }],
      dimensions: [
        {
          from: { x: left.x, y: left.y }, to: along(a), offset: -22,
          text: `a = ${displayCell(context.project, a, 'length')} ${unitFor(context.project, 'length')}`,
        },
        {
          from: along(a), to: { x: right.x, y: right.y }, offset: -22,
          text: `b = ${displayCell(context.project, span.length - a, 'length')} ${unitFor(context.project, 'length')}`,
        },
      ],
      notes: [{ place: { at: along(a) }, text: 'centroide de A', tone: 'moment' }],
      legend: 'El vano resuelto como viga simplemente apoyada bajo sus propias cargas: el área sombreada '
        + 'es su diagrama de momento libre, y a y b son las distancias de su centroide a cada apoyo. '
        + `Aₙaₙ y Aₙbₙ de la tabla son el primer momento de esa área respecto de cada extremo — lo único `
        + 'que la ecuación de Clapeyron necesita de este vano.',
    }];
  });
};

/**
 * Hardy Cross balances a joint, so its drawing is a joint.
 *
 * The span-with-two-arcs this replaces showed the converged answer and left the method — the
 * fixed-end moments meeting at a support, the share each span takes of the imbalance, and the
 * half that is carried to the far end — entirely to the table.
 */
export const hardyCrossScenes = (
  context: ReportContext,
  solution: HardyCrossResult,
): FreeBodyScene[] => {
  const momentUnit = unitFor(context.project, 'moment');
  return solution.spans.slice(0, -1).flatMap((span, index) => {
    const right = solution.spans[index + 1];
    const nodeId = span.rightNodeId;
    const joint = context.index.node(nodeId);
    if (!joint) return [];
    const leftMember = context.project.members.find(
      (entry) => (entry.i === span.leftNodeId && entry.j === nodeId) || (entry.i === nodeId && entry.j === span.leftNodeId),
    );
    const rightMember = context.project.members.find(
      (entry) => (entry.i === nodeId && entry.j === right.rightNodeId) || (entry.i === right.rightNodeId && entry.j === nodeId),
    );
    if (!leftMember || !rightMember) return [];
    const total = span.stiffnessRight + right.stiffnessLeft;
    if (!(total > 0)) return [];

    const reach = Math.min(span.length, right.length);
    const stub = (member: typeof leftMember, farNodeId: string) => {
      const far = context.index.node(farNodeId);
      if (!far) return [];
      const length = Math.hypot(far.x - joint.x, far.y - joint.y);
      if (!(length > 0)) return [];
      const fraction = Math.min(0.9, (reach * 0.45) / length);
      const fromStart = member.i === nodeId;
      return [{
        memberId: member.id,
        ratio: fromStart ? fraction : 1 - fraction,
        keep: fromStart ? 'start' as const : 'end' as const,
      }];
    };

    const share = (stiffness: number) => (stiffness / total);
    return [{
      title: `nudo ${nodeId}: reparto`,
      focus: { nodeId, radius: reach * 0.58 },
      keptNodeIds: [nodeId],
      keptMemberIds: [],
      severed: [...stub(leftMember, span.leftNodeId), ...stub(rightMember, right.rightNodeId)],
      isolation: { nodeId, radius: reach * 0.14 },
      moments: [
        {
          place: { nodeId }, sign: span.fixedEndMomentRight, tone: 'moment',
          label: `FEM ${displayCell(context.project, span.fixedEndMomentRight, 'moment')} / `
            + `${displayCell(context.project, right.fixedEndMomentLeft, 'moment')} ${momentUnit}`,
        },
      ],
      notes: [
        {
          place: { nodeId },
          text: `D(${leftMember.id}) = ${number(share(span.stiffnessRight), 4)}  ·  `
            + `D(${rightMember.id}) = ${number(share(right.stiffnessLeft), 4)}`,
          tone: 'ink' as const,
        },
        {
          place: { nodeId },
          text: `M(${nodeId}) = ${displayCell(context.project, solution.joints.find((entry) => entry.nodeId === nodeId)?.value ?? 0, 'moment')} ${momentUnit}`,
          tone: 'moment' as const,
        },
      ],
      legend: 'El nudo interior con el momento de empotramiento perfecto que le llega por cada vano y el '
        + 'factor de reparto D con que se lleva su parte del desequilibrio — proporcional a la rigidez '
        + 'relativa de cada vano. La mitad de lo repartido se transmite al extremo lejano, y el ciclo se '
        + 'repite hasta que no queda desequilibrio medible.',
    }];
  });
};

/**
 * Kani rotates joints, so its drawing is a joint.
 *
 * The bar-with-two-arcs this replaces is the answer, not the method: what Kani does is give
 * every bar meeting a joint a rotation moment, recomputed pass after pass from the ones at the
 * far ends. The drawing that explains it is the joint with all its bars at once — which is also
 * the difference between Kani and Hardy Cross, and why Kani handles a frame joint with three or
 * four bars in a single step.
 */
export const kaniScenes = (context: ReportContext, solution: KaniResult): FreeBodyScene[] => {
  const momentUnit = unitFor(context.project, 'moment');
  const byJoint = new Map<string, { memberId: string; moment: number; farId: string }[]>();
  for (const member of solution.members) {
    for (const [nodeId, moment, farId] of [
      [member.nodeI, member.finalMomentI, member.nodeJ],
      [member.nodeJ, member.finalMomentJ, member.nodeI],
    ] as const) {
      byJoint.set(nodeId, [...(byJoint.get(nodeId) ?? []), { memberId: member.memberId, moment, farId }]);
    }
  }

  return [...byJoint.entries()]
    // A joint with one bar is an end, not a joint: it has no distribution to show.
    .filter(([, bars]) => bars.length > 1)
    .flatMap(([nodeId, bars]) => {
      const joint = context.index.node(nodeId);
      if (!joint) return [];
      const reach = Math.max(...bars.map((bar) => {
        const far = context.index.node(bar.farId);
        return far ? Math.hypot(far.x - joint.x, far.y - joint.y) : 0;
      }), 1e-6);

      const severed = bars.flatMap((bar) => {
        const member = context.index.member(bar.memberId);
        const far = context.index.node(bar.farId);
        if (!member || !far) return [];
        const length = Math.hypot(far.x - joint.x, far.y - joint.y);
        if (!(length > 0)) return [];
        const fraction = Math.min(0.9, (reach * 0.44) / length);
        const fromStart = member.i === nodeId;
        return [{
          memberId: member.id,
          ratio: fromStart ? fraction : 1 - fraction,
          keep: fromStart ? 'start' as const : 'end' as const,
        }];
      });
      if (!severed.length) return [];

      return [{
        title: `nudo ${nodeId}`,
        focus: { nodeId, radius: reach * 0.6 },
        keptNodeIds: [nodeId],
        keptMemberIds: [],
        severed,
        isolation: { nodeId, radius: reach * 0.15 },
        moments: bars.map((bar) => ({
          place: { nodeId },
          sign: bar.moment,
          tone: 'moment' as const,
          label: `M(${bar.memberId}) = ${displayCell(context.project, bar.moment, 'moment')} ${momentUnit}`,
        })),
        legend: 'El nudo con el momento final de cada barra que concurre en él. Kani no reparte y acarrea: '
          + 'cada barra lleva un momento de rotación que se recalcula en cada pasada a partir de los del '
          + 'otro extremo, y por eso resuelve de una vez un nudo con más de dos barras.',
      }];
    });
};

interface ApproximateColumn {
  readonly columnIndex: number;
  readonly story: number;
  readonly memberId: string;
  readonly bottomNodeId: string;
  readonly topNodeId: string;
  readonly height: number;
  readonly inflectionFraction: number;
  readonly shear: number;
  readonly axial: number;
  readonly bottomMoment: number;
  readonly topMoment: number;
}

/**
 * The storey cut of an approximate frame method: a horizontal cut through the inflection point
 * of every column of that storey, with the storey shear above it and each column's own shear
 * and axial on the cut face.
 */
export const storeyCutScenes = (
  context: ReportContext,
  columns: readonly ApproximateColumn[],
  storyShear: readonly number[],
): FreeBodyScene[] => {
  const shearScale = Math.max(1e-12, ...columns.map((column) => Math.abs(column.shear)));
  const axialScale = Math.max(1e-12, ...columns.map((column) => Math.abs(column.axial)));
  const stories = [...new Set(columns.map((column) => column.story))].sort((a, b) => a - b);

  return stories.flatMap((story) => {
    const storyColumns = columns.filter((column) => column.story === story);
    if (!storyColumns.length) return [];
    const cutPoints: Point[] = [];
    const forces: SceneForce[] = [];
    for (const column of storyColumns) {
      const bottom = context.index.node(column.bottomNodeId);
      const top = context.index.node(column.topNodeId);
      if (!bottom || !top) continue;
      const ratio = Math.min(1, Math.max(0, column.inflectionFraction));
      const at = { x: bottom.x + (top.x - bottom.x) * ratio, y: bottom.y + (top.y - bottom.y) * ratio };
      cutPoints.push(at);
      forces.push({
        place: { at }, fx: column.shear >= 0 ? 1 : -1, fy: 0, tone: 'shear', anchor: 'tail', length: 0.92,
        label: forceLabel(context, `V${column.columnIndex + 1}`, column.shear, shearScale),
      });
      if (Math.abs(column.axial) > axialScale * 1e-9) {
        forces.push({
          place: { at }, fx: 0, fy: column.axial >= 0 ? 1 : -1, tone: 'axial', anchor: 'tail', length: 0.83,
          label: forceLabel(context, `N${column.columnIndex + 1}`, column.axial, axialScale),
        });
      }
    }
    if (cutPoints.length < 1) return [];
    const xs = cutPoints.map((point) => point.x);
    const y = cutPoints.reduce((sum, point) => sum + point.y, 0) / cutPoints.length;
    const width = Math.max(...xs) - Math.min(...xs);
    const overrun = Math.max(width * 0.18, 0.4);
    const shear = storyShear[story - 1];

    const keptNodeIds = context.project.nodes
      .filter((node) => node.y >= y - 1e-9)
      .map((node) => node.id);
    const keptSet = new Set(keptNodeIds);
    // Windward top corner of the retained portion: where the storey resultant is drawn from.
    const topLeftNodeId = context.project.nodes
      .filter((node) => keptSet.has(node.id))
      .sort((left, right) => (right.y - left.y) || (left.x - right.x))[0]?.id;

    return [{
      title: `planta ${story}`,
      keptNodeIds,
      keptMemberIds: context.project.members
        .filter((member) => keptSet.has(member.i) && keptSet.has(member.j))
        .map((member) => member.id),
      cut: {
        from: { x: Math.min(...xs) - overrun, y },
        to: { x: Math.max(...xs) + overrun, y },
        label: 'corte',
        labelAt: 'middle',
      },
      // The method *assumes* the moment vanishes here. Drawing the hinge is what turns that
      // assumption from something the prose claims into something the figure states.
      hinges: cutPoints.map((at) => ({ place: { at } })),
      dimensions: storyColumns.length > 1
        ? [{
          from: cutPoints[0],
          to: cutPoints[cutPoints.length - 1],
          offset: -24,
          text: `${displayCell(context.project, Math.abs(cutPoints[cutPoints.length - 1].x - cutPoints[0].x), 'length')} ${unitFor(context.project, 'length')}`,
        }]
        : undefined,
      forces: [
        // The storey resultant is applied at storey level and pushes the body sideways, so it
        // starts at the windward top node and grows along the beam. Anchoring it outside the
        // model's own bounds put it beyond the frame the drawing is now sized to.
        ...(shear === undefined || !topLeftNodeId ? [] : [{
          place: { nodeId: topLeftNodeId },
          fx: shear >= 0 ? 1 : -1, fy: 0, tone: 'load' as const, length: 1.3, anchor: 'tail' as const,
          label: forceLabel(context, 'V planta', shear, Math.max(1e-12, Math.abs(shear))),
        }]),
        ...forces,
      ],
      legend: 'Corte horizontal por el punto de inflexión de cada columna de la planta. Sobre la porción '
        + 'superior actúan el cortante de planta acumulado y, en la cara del corte, el cortante y la axial de '
        + 'cada columna: el equilibrio de este cuerpo libre es el reparto que la tabla de arriba tabula.',
    }];
  });
};

/** One scene per column: the segment between inflection points, with its end moments. */
export const columnFreeBodyScenes = (
  context: ReportContext,
  columns: readonly ApproximateColumn[],
): FreeBodyScene[] => {
  const shearScale = Math.max(1e-12, ...columns.map((column) => Math.abs(column.shear)));
  return columns.flatMap((column) => {
    if (!context.index.member(column.memberId)) return [];
    return [{
      title: `columna ${column.columnIndex + 1}, planta ${column.story}`,
      keptNodeIds: [column.bottomNodeId, column.topNodeId],
      keptMemberIds: [column.memberId],
      forces: [{
        place: { nodeId: column.topNodeId }, fx: column.shear >= 0 ? 1 : -1, fy: 0, tone: 'shear',
        anchor: 'tail', length: 1.0, label: forceLabel(context, 'V', column.shear, shearScale),
      }],
      moments: [
        { place: { nodeId: column.bottomNodeId }, sign: column.bottomMoment, label: momentLabel(context, 'M base', column.bottomMoment), tone: 'moment' },
        { place: { nodeId: column.topNodeId }, sign: column.topMoment, label: momentLabel(context, 'M cabeza', column.topMoment), tone: 'moment' },
      ],
      hinges: (() => {
        const bottom = context.index.node(column.bottomNodeId);
        const top = context.index.node(column.topNodeId);
        if (!bottom || !top) return undefined;
        const ratio = Math.min(1, Math.max(0, column.inflectionFraction));
        return [{ place: { at: { x: bottom.x + (top.x - bottom.x) * ratio, y: bottom.y + (top.y - bottom.y) * ratio } } }];
      })(),
      notes: [{
        place: { nodeId: column.bottomNodeId },
        text: `punto de inflexión a ${(column.inflectionFraction * 100).toFixed(0)} % de la altura`,
      }],
      legend: 'La columna aislada con el cortante que le tocó y los momentos que ese cortante produce en sus '
        + 'dos extremos, medidos desde el punto de inflexión donde el método supone el momento nulo.',
    }];
  });
};

export const portalScenes = (context: ReportContext, solution: PortalMethodResult): FreeBodyScene[] => [
  ...storeyCutScenes(context, solution.columns, solution.storyShear),
  ...columnFreeBodyScenes(context, solution.columns),
];

export const cantileverScenes = (context: ReportContext, solution: CantileverMethodResult): FreeBodyScene[] => {
  // The Cantilever Method distributes column axial force by the flexure formula rather than by
  // an explicit storey shear, so the storey resultant is the sum of what its columns carry.
  const stories = [...new Set(solution.columns.map((column) => column.story))].sort((a, b) => a - b);
  const storyShear = stories.map((story) => solution.columns
    .filter((column) => column.story === story)
    .reduce((sum, column) => sum + column.shear, 0));
  return [
    ...storeyCutScenes(context, solution.columns, storyShear),
    ...columnFreeBodyScenes(context, solution.columns),
  ];
};
