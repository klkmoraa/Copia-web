/**
 * The Cantilever Method, solved for real — and, like the Portal Method, disclosed as an
 * approximation.
 *
 * It shares the Portal Method's first assumption — a point of inflection at the midpoint of
 * every column and every beam, except a first-storey column on a support that carries no moment,
 * whose inflection point is the support itself — but replaces the *second* assumption entirely.
 * Where Portal splits each storey's shear among its columns by tributary width, Cantilever treats
 * the row of columns at a storey as the cross-section of a vertical cantilever resisting the
 * overturning moment of every lateral load above it: axial force in each column is taken
 * proportional to its own area times its distance from that storey's area-weighted centroid —
 * the flexure formula, applied to discrete columns instead of a continuous section.
 *
 * That single substitution reverses the order the rest of the procedure has to run in. Portal
 * knows column shear first and works moments outward from it; Cantilever knows column *axial
 * force* first, so it has to reach column shear the long way round:
 *
 *   1. Column axial force, from the flexure analogy above.
 *   2. Beam moment, from the *same* joint vertical-equilibrium equation Portal uses to find
 *      column axial force — solved for the opposite unknown, swept left to right across each
 *      storey exactly the way Portal sweeps beam moment.
 *   3. Beam shear, from the beam moment (`V = -2m/L`, identical relation to Portal's).
 *   4. Column shear and both its end moments, from the *same* joint moment-equilibrium equation
 *      Portal uses to find beam moment — solved for the opposite unknown, swept from the roof
 *      down one storey at a time.
 *
 * None of this re-derives statics from `src/engine/**`, and neither did the sign of a single
 * quantity above come from memory: every relation was fixed by checking it against
 * `analyzeProject` on the same hand-verified single-bay portal frame `portalMethod.test.ts`
 * checks against (`cantileverMethod.test.ts` reproduces that check for this method). The
 * flexure-formula step in particular got its sign wrong on the first attempt — a plain
 * magnitude-times-arm computation, missing the actual signed torque of a horizontal force about
 * a point — and the fix is what the comment on `overturningMoment` below explains.
 */
import { analyzeProject, selectedFactors } from '../engine/solver';
import type { LoadCombination, ProjectModel } from '../types';
import { buildFrameGrid, restrainsRotation, type FrameGrid } from './frameGeometry';
import { classifyStructure } from './structureClassification';

export interface CantileverColumn {
  columnIndex: number;
  story: number;
  memberId: string;
  bottomNodeId: string;
  topNodeId: string;
  height: number;
  /** Distance from this storey's area-weighted centroid, metres — signed. */
  centroidDistance: number;
  /** Axial force, kN, tension positive — the quantity this method solves for first. */
  axial: number;
  inflectionFraction: number;
  shear: number;
  bottomMoment: number;
  topMoment: number;
}

export interface CantileverBeam {
  bayIndex: number;
  story: number;
  memberId: string;
  leftNodeId: string;
  rightNodeId: string;
  span: number;
  moment: number;
  shear: number;
}

export interface CantileverBaseCheck {
  columnIndex: number;
  nodeId: string;
  approxRx: number;
  approxRy: number;
  approxRm: number;
  solverRx: number;
  solverRy: number;
  solverRm: number;
}

export interface CantileverMethodResult {
  applicable: true;
  grid: FrameGrid;
  columns: CantileverColumn[];
  beams: CantileverBeam[];
  baseChecks: CantileverBaseCheck[];
  reactionGap: { force: number; moment: number };
}

export interface CantileverMethodRejection {
  applicable: false;
  reasonKey: string;
}

export type CantileverMethodOutcome = CantileverMethodResult | CantileverMethodRejection;

const NEAR_ZERO = 1e-9;

export const solveCantileverMethod = (
  project: ProjectModel,
  combination: LoadCombination | null = null,
): CantileverMethodOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'frame') return { applicable: false, reasonKey: 'method.rejectedNotFrame' };

  const grid = buildFrameGrid(project);
  if (!grid) return { applicable: false, reasonKey: 'method.rejectedGrid' };

  const factors = selectedFactors(project, combination);
  const memberLoadActive = project.memberLoads.some((load) => (factors[load.caseId] ?? 0) !== 0);
  if (memberLoadActive) return { applicable: false, reasonKey: 'method.rejectedMemberLateralLoad' };

  const lines = grid.columnLines.length;
  const stories = grid.storyLevels.length - 1;
  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  const membersById = new Map(project.members.map((member) => [member.id, member]));

  // The flexure analogy needs one shared cut height per storey; a first storey with some
  // columns pinned at the base and others fixed would need a different cut for each, which is
  // not a single free body any more. Every other method here withdraws rather than guess at an
  // irregular case, and this is that same rule.
  const baseFixities = new Set(
    Array.from({ length: lines }, (_unused, c) => {
      const node = byId.get(grid.nodeGrid[c][0]);
      return node ? restrainsRotation(node.support) : true;
    }),
  );
  if (baseFixities.size > 1) return { applicable: false, reasonKey: 'method.rejectedMixedBase' };
  const groundPinned = baseFixities.has(false);

  const combinedFx = new Map<string, number>();
  for (const load of project.nodalLoads) {
    const factor = factors[load.caseId] ?? 0;
    if (factor === 0 || load.fx === 0) continue;
    combinedFx.set(load.nodeId, (combinedFx.get(load.nodeId) ?? 0) + factor * load.fx);
  }
  const loadAtLevel = (level: number): number => {
    let sum = 0;
    for (let c = 0; c < lines; c += 1) sum += combinedFx.get(grid.nodeGrid[c][level]) ?? 0;
    return sum;
  };
  const anyLateralLoad = Array.from({ length: stories + 1 }, (_unused, level) => loadAtLevel(level))
    .some((load) => Math.abs(load) > NEAR_ZERO);
  if (!anyLateralLoad) return { applicable: false, reasonKey: 'method.rejectedNoLateralLoad' };

  const lateralOnlyProject: ProjectModel = {
    ...project,
    loadCases: [{ id: 'LATERAL', name: 'lateral', category: 'other', active: true }],
    combinations: [],
    memberLoads: [],
    nodalLoads: Array.from(combinedFx, ([nodeId, fx]) => ({
      id: `LATERAL-${nodeId}`, nodeId, caseId: 'LATERAL', fx, fy: 0, mz: 0,
    })),
  };
  const lateralAnalysis = analyzeProject(lateralOnlyProject, null, { includeEducationTrace: false });
  if (!lateralAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

  const inflectionFractionOf = (story: number): number => (story === 1 && groundPinned ? 0 : 0.5);
  const cutHeight = (story: number): number => grid.storyLevels[story - 1] + inflectionFractionOf(story) * (grid.storyLevels[story] - grid.storyLevels[story - 1]);

  // Column axial force: the flexure analogy, one storey at a time. `overturningMoment` is the
  // *signed* Z-torque of every lateral load above this storey's cut about a point on the cut
  // line — not a magnitude-times-arm figure. A horizontal force's torque about a point does not
  // depend on the point's x-coordinate (only its height), so the torque is well defined without
  // yet knowing the centroid; getting this sign right (via r×F, not "shear times height") is what
  // makes the axial force land on the correct side in tension, checked in
  // `cantileverMethod.test.ts` against `analyzeProject` on a hand-verified frame.
  const overturningMoment = (story: number): number => {
    const cut = cutHeight(story);
    let torque = 0;
    for (let level = story; level <= stories; level += 1) {
      torque += -(grid.storyLevels[level] - cut) * loadAtLevel(level);
    }
    return torque;
  };

  const columnAt = new Map<string, CantileverColumn>();
  const columns: CantileverColumn[] = [];
  for (let s = 1; s <= stories; s += 1) {
    const areas = Array.from({ length: lines }, (_unused, c) => {
      const segment = grid.columns[c][s];
      return segment ? membersById.get(segment.memberId)?.A ?? 0 : 0;
    });
    const totalArea = areas.reduce((sum, area) => sum + area, 0);
    const centroidX = totalArea > 0
      ? areas.reduce((sum, area, c) => sum + area * grid.columnLines[c], 0) / totalArea
      : grid.columnLines.reduce((sum, x) => sum + x, 0) / lines;
    const distances = grid.columnLines.map((x) => x - centroidX);
    const secondMoment = areas.reduce((sum, area, c) => sum + area * distances[c] * distances[c], 0);
    const moment = overturningMoment(s);

    for (let c = 0; c < lines; c += 1) {
      const segment = grid.columns[c][s];
      if (!segment) return { applicable: false, reasonKey: 'method.rejectedGrid' };
      const axial = secondMoment > 0 ? (moment * areas[c] * distances[c]) / secondMoment : 0;
      const column: CantileverColumn = {
        columnIndex: c,
        story: s,
        memberId: segment.memberId,
        bottomNodeId: segment.bottomNodeId,
        topNodeId: segment.topNodeId,
        height: segment.height,
        centroidDistance: distances[c],
        axial,
        inflectionFraction: inflectionFractionOf(s),
        shear: 0,
        bottomMoment: 0,
        topMoment: 0,
      };
      columns.push(column);
      columnAt.set(`${c}-${s}`, column);
    }
  }

  // Beam moment: the same joint vertical-equilibrium equation Portal solves for column axial
  // force, here solved for beam moment instead — swept left to right across each storey, one
  // new unknown per joint, because the beam to the left is already known by the time its joint
  // is reached.
  const bayWidths = grid.columnLines.slice(1).map((x, index) => x - grid.columnLines[index]);
  const beams: CantileverBeam[] = [];
  const beamMoment = new Map<string, number>();
  for (let s = 1; s <= stories; s += 1) {
    // Carries `2·m⁄L` — the vertical force the previous bay's beam exerts on the shared joint —
    // not the raw moment: that is what this joint's own vertical equilibrium needs, and it is a
    // different quantity from the raw moment the column *moment*-balance equation below sweeps.
    let leftShear = 0;
    for (let c = 0; c < lines - 1; c += 1) {
      const below = columnAt.get(`${c}-${s}`)!;
      const above = columnAt.get(`${c}-${s + 1}`);
      const axialAbove = above ? above.axial : 0;
      const moment = (bayWidths[c] / 2) * (below.axial - axialAbove + leftShear);
      const segment = grid.beams[c][s]!;
      beamMoment.set(`${c}-${s}`, moment);
      beams.push({
        bayIndex: c,
        story: s,
        memberId: segment.memberId,
        leftNodeId: segment.leftNodeId,
        rightNodeId: segment.rightNodeId,
        span: segment.span,
        moment,
        shear: (-2 * moment) / segment.span,
      });
      leftShear = (2 * moment) / bayWidths[c];
    }
  }

  // Column shear and end moments: the same joint moment-equilibrium equation Portal solves for
  // beam moment, here solved for column top moment instead — swept from the roof down, one
  // storey at a time, independently per column line, because every beam moment is already known.
  for (let c = 0; c < lines; c += 1) {
    for (let s = stories; s >= 1; s -= 1) {
      const column = columnAt.get(`${c}-${s}`)!;
      const above = columnAt.get(`${c}-${s + 1}`);
      const leftM = c > 0 ? beamMoment.get(`${c - 1}-${s}`) : undefined;
      const rightM = c < lines - 1 ? beamMoment.get(`${c}-${s}`) : undefined;
      const beamSum = (leftM ?? 0) + (rightM ?? 0);
      const topMoment = -(above ? above.bottomMoment : 0) - beamSum;
      const clearance = column.height - column.inflectionFraction * column.height;
      const shear = clearance > 0 ? -topMoment / clearance : 0;
      column.topMoment = topMoment;
      column.shear = shear;
      column.bottomMoment = -shear * column.inflectionFraction * column.height;
    }
  }

  const solverByNode = new Map(lateralAnalysis.nodeResults.map((entry) => [entry.nodeId, entry]));
  const baseChecks: CantileverBaseCheck[] = [];
  let forceGap = 0;
  let momentGap = 0;
  for (let c = 0; c < lines; c += 1) {
    const nodeId = grid.nodeGrid[c][0];
    const first = columnAt.get(`${c}-1`)!;
    const solver = solverByNode.get(nodeId);
    if (!solver) continue;
    const approxRx = -first.shear;
    const approxRy = -first.axial;
    const approxRm = -first.bottomMoment;
    baseChecks.push({
      columnIndex: c,
      nodeId,
      approxRx,
      approxRy,
      approxRm,
      solverRx: solver.rx,
      solverRy: solver.ry,
      solverRm: solver.rm,
    });
    forceGap = Math.max(forceGap, Math.abs(approxRx - solver.rx), Math.abs(approxRy - solver.ry));
    momentGap = Math.max(momentGap, Math.abs(approxRm - solver.rm));
  }

  return {
    applicable: true,
    grid,
    columns,
    beams,
    baseChecks,
    reactionGap: { force: forceGap, moment: momentGap },
  };
};
