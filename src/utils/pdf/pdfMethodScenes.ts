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
import { clearCell, displayCell, unitFor } from './pdfFormat';
import { axialDirection, memberMidpoint, type FreeBodyScene, type SceneForce } from './pdfFreeBody';
import type { Point } from './pdfScene';
import type { ReportContext } from './reportContext';

/** `N(AB) = 12.4 kN (T)` — the one label format every bar force in these scenes carries. */
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
        place: { nodeId }, fx: reaction.rx, fy: 0, tone: 'reaction', length: 24,
        label: forceLabel(context, `Rx(${nodeId})`, reaction.rx, reactionScale),
      });
    }
    if (reaction && Math.abs(reaction.ry) > reactionScale * 1e-9) {
      forces.push({
        place: { nodeId }, fx: 0, fy: reaction.ry, tone: 'reaction', length: 24,
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
      length: 24, label: load.id,
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
  // Overrun past the outermost bars, so the cut visibly crosses them instead of stopping on
  // their axes.
  const overrun = 0.25;
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
        length: 26,
      });
    }
    if (!forces.length) return [];
    forces.push(...externalActionsOn(context, cut.keptNodeIds));

    return [{
      title: `corte ${cut.cutIndex + 1}`,
      keptNodeIds: cut.keptNodeIds,
      keptMemberIds,
      cut: line ? { ...line, label: 'corte' } : undefined,
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
        length: justSolved ? 30 : 24,
      });
    }

    forces.push(...externalActionsOn(context, [step.nodeId]));
    if (!forces.length) return [];

    // A frame wide enough to hold the longest bar stub without the far joints crowding in.
    const radius = Math.max(
      ...meeting.map((member) => {
        const far = context.index.node(member.i === step.nodeId ? member.j : member.i);
        return far ? Math.hypot(far.x - node.x, far.y - node.y) : 0;
      }),
      1e-6,
    ) * 0.86;

    return [{
      title: `nudo ${step.nodeId}`,
      focus: { nodeId: step.nodeId, radius },
      keptNodeIds: [step.nodeId],
      keptMemberIds: meeting.map((member) => member.id),
      forces,
      legend: 'Cuerpo libre del nudo: cada barra que concurre, con la fuerza que ejerce sobre él '
        + '—hacia fuera en tracción, hacia dentro en compresión—, más la reacción y la carga aplicadas ahí. '
        + 'Las dos sumas de fuerzas de abajo son exactamente este dibujo.',
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
        length: 20,
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
          place: { nodeId: narrated.nodeId }, ...direction, tone: 'load', length: 30,
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
        label: barLabel(context, 'N₀', entry.memberId, entry.primaryForce, primaryScale), length: 20,
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
      length: 30,
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
      partialMember: { memberId: member.id, ratio, keep: declaredLeftToRight ? 'start' : 'end' },
      includeMemberLoads: true,
      cut: {
        from: { x: at.x - normal.x, y: at.y - normal.y },
        to: { x: at.x + normal.x, y: at.y + normal.y },
        label: `x = ${displayCell(context.project, station, 'length')} ${unitFor(context.project, 'length')}`,
        labelAt: 'end',
      },
      forces: [
        ...externalActionsOn(context, axisNodeIds.slice(0, spanIndex)),
        { place: { at: face }, fx: 0, fy: -1, tone: 'shear', anchor: 'tail', length: 20, label: 'V(x)' },
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

export const conjugateBeamScenes = (
  context: ReportContext,
  solution: ConjugateBeamResult,
): FreeBodyScene[] => beamSegmentScenes(
  context,
  solution.axis.stations.map((station) => station.nodeId),
  solution.segments,
  solution.axis.length,
  (index) => `tramo ${index + 1}`,
  'El corte del que sale M(x), la carga ficticia w* = M/EI de la viga conjugada. El giro y la flecha reales '
  + 'son el cortante y el momento de esa viga ficticia en este mismo punto.',
);

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
    moments: [
      { place: { nodeId: span.leftNodeId }, sign: span.momentLeft, label: momentLabel(context, 'M', span.momentLeft), tone: 'moment' },
      { place: { nodeId: span.rightNodeId }, sign: span.momentRight, label: momentLabel(context, 'M', span.momentRight), tone: 'moment' },
    ],
    notes: span.extra ? [{ place: { nodeId: span.leftNodeId }, text: span.extra }] : undefined,
    legend,
  }];
});

export const threeMomentScenes = (
  context: ReportContext,
  solution: ThreeMomentResult,
): FreeBodyScene[] => {
  const moments = new Map(solution.supportMoments.map((entry) => [entry.nodeId, entry.value]));
  return spanMomentScenes(
    context,
    solution.spans.map((span) => ({
      leftNodeId: span.leftNodeId,
      rightNodeId: span.rightNodeId,
      momentLeft: moments.get(span.leftNodeId) ?? 0,
      momentRight: moments.get(span.rightNodeId) ?? 0,
    })),
    (index) => `vano ${index + 1}`,
    'El vano aislado bajo sus propias cargas, con los momentos de apoyo que la ecuación de Clapeyron '
    + 'resolvió aplicados en sus extremos. El sentido del arco es el signo del momento: antihorario positivo.',
  );
};

export const hardyCrossScenes = (
  context: ReportContext,
  solution: HardyCrossResult,
): FreeBodyScene[] => {
  const moments = new Map(solution.joints.map((entry) => [entry.nodeId, entry.value]));
  return spanMomentScenes(
    context,
    solution.spans.map((span) => ({
      leftNodeId: span.leftNodeId,
      rightNodeId: span.rightNodeId,
      momentLeft: moments.get(span.leftNodeId) ?? span.finalMomentLeft,
      momentRight: moments.get(span.rightNodeId) ?? span.finalMomentRight,
      extra: `FEM ${displayCell(context.project, span.fixedEndMomentLeft, 'moment')} / `
        + `${displayCell(context.project, span.fixedEndMomentRight, 'moment')} ${unitFor(context.project, 'moment')}`,
    })),
    (index) => `vano ${index + 1}`,
    'El vano con los momentos ya convergidos en sus extremos. La nota recuerda el momento de empotramiento '
    + 'perfecto del que partió el reparto, antes de distribuir y transmitir.',
  );
};

/** One scene per bar: the two end moments Kani converged on. */
export const kaniScenes = (context: ReportContext, solution: KaniResult): FreeBodyScene[] =>
  solution.members.flatMap((member) => {
    if (!context.index.member(member.memberId)) return [];
    return [{
      title: `barra ${member.memberId}`,
      keptNodeIds: [member.nodeI, member.nodeJ],
      keptMemberIds: [member.memberId],
      moments: [
        { place: { nodeId: member.nodeI }, sign: member.finalMomentI, label: momentLabel(context, 'Mᵢ', member.finalMomentI), tone: 'moment' },
        { place: { nodeId: member.nodeJ }, sign: member.finalMomentJ, label: momentLabel(context, 'Mⱼ', member.finalMomentJ), tone: 'moment' },
      ],
      notes: [{
        place: { nodeId: member.nodeI },
        text: `FEM ${displayCell(context.project, member.fixedEndMomentI, 'moment')} / `
          + `${displayCell(context.project, member.fixedEndMomentJ, 'moment')} ${unitFor(context.project, 'moment')}`,
      }],
      legend: 'La barra con los momentos de extremo que el reparto de Kani dejó, junto al momento de '
        + 'empotramiento perfecto del que partió. Las dos últimas columnas de la tabla son lo que el análisis '
        + 'matricial obtiene en esos mismos extremos.',
    }];
  });

// ---------------------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------------------

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
        place: { at }, fx: column.shear >= 0 ? 1 : -1, fy: 0, tone: 'shear', anchor: 'tail', length: 22,
        label: forceLabel(context, `V${column.columnIndex + 1}`, column.shear, shearScale),
      });
      if (Math.abs(column.axial) > axialScale * 1e-9) {
        forces.push({
          place: { at }, fx: 0, fy: column.axial >= 0 ? 1 : -1, tone: 'axial', anchor: 'tail', length: 20,
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
      },
      forces: [
        ...(shear === undefined ? [] : [{
          place: { at: { x: Math.min(...xs) - overrun, y: y + Math.max(width * 0.12, 0.3) } },
          fx: shear >= 0 ? 1 : -1, fy: 0, tone: 'load' as const, length: 30,
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
        anchor: 'tail', length: 24, label: forceLabel(context, 'V', column.shear, shearScale),
      }],
      moments: [
        { place: { nodeId: column.bottomNodeId }, sign: column.bottomMoment, label: momentLabel(context, 'M base', column.bottomMoment), tone: 'moment' },
        { place: { nodeId: column.topNodeId }, sign: column.topMoment, label: momentLabel(context, 'M cabeza', column.topMoment), tone: 'moment' },
      ],
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
