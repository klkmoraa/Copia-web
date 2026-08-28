/**
 * The Portal Method, solved for real — and disclosed as an approximation.
 *
 * Unlike Double Integration, this method does not converge to the solver's own answer: it is a
 * deliberate simplification, built on three assumptions a reader is taught to make about a
 * rectangular building frame under lateral load —
 *
 *   1. Every column and every beam has a point of inflection (zero moment) at its own midpoint,
 *      except a first-storey column on a support that carries no moment, whose inflection point
 *      is the support itself — because a pin or a roller cannot carry a moment, not because the
 *      method assumes it.
 *   2. Each storey's shear splits among that storey's columns in proportion to the width of
 *      floor each one carries — half of every bay it touches.
 *   3. Once every column's shear is known, the frame is *statically determinate*: joint moment
 *      equilibrium gives every beam moment, beam equilibrium gives every beam shear, and joint
 *      vertical equilibrium — worked from the roof down — gives every column's axial force.
 *
 * None of this is re-derived statics from `src/engine/**`: it is the classical hand procedure,
 * and every sign below was fixed by checking it against `analyzeProject` on a hand-verified
 * portal frame, not by convention alone (see `portalMethod.test.ts`).
 *
 * Because the assumptions are approximate, the result does *not* have to match the matrix
 * method — and printing it as if it did would misrepresent the method. So this module instead
 * builds the honest comparison: a lateral-load-only variant of the project, solved exactly by
 * `analyzeProject`, alongside the Portal Method's own base reactions. The gap between them is
 * the point, not a defect — it is what tells a reader how good the approximation is here.
 */
import { analyzeProject, selectedFactors } from '../engine/solver';
import type { LoadCombination, ProjectModel } from '../types';
import { buildFrameGrid, restrainsRotation, type FrameGrid } from './frameGeometry';
import { classifyStructure } from './structureClassification';

export interface PortalColumn {
  columnIndex: number;
  /** Storey the column segment sits in, 1 = the storey above the foundation. */
  story: number;
  memberId: string;
  bottomNodeId: string;
  topNodeId: string;
  height: number;
  /** Share of the storey's shear this column line carries, in metres of tributary width. */
  tributaryWidth: number;
  /** This column's share of the storey shear, kN. */
  shear: number;
  /** Fraction of the height, from the bottom, where the moment is zero. */
  inflectionFraction: number;
  /** Moment the column exerts on its bottom joint, kN·m, CCW positive. */
  bottomMoment: number;
  /** Moment the column exerts on its top joint, kN·m, CCW positive. */
  topMoment: number;
  /** Axial force, kN, tension positive. */
  axial: number;
}

export interface PortalBeam {
  bayIndex: number;
  story: number;
  memberId: string;
  leftNodeId: string;
  rightNodeId: string;
  span: number;
  /** Moment the beam exerts on each of its two joints, kN·m — equal at both by the midspan-inflection assumption. */
  moment: number;
  /** Constant internal shear along the beam, kN. */
  shear: number;
}

export interface PortalBaseCheck {
  columnIndex: number;
  nodeId: string;
  approxRx: number;
  approxRy: number;
  approxRm: number;
  solverRx: number;
  solverRy: number;
  solverRm: number;
}

export interface PortalMethodResult {
  applicable: true;
  grid: FrameGrid;
  /** Shear carried by each storey's columns together, index 0 = storey 1 (kN). */
  storyShear: number[];
  columns: PortalColumn[];
  beams: PortalBeam[];
  baseChecks: PortalBaseCheck[];
  /** Largest gap between the method's own base reactions and the lateral-only solve, disclosed rather than hidden. */
  reactionGap: { force: number; moment: number };
}

export interface PortalMethodRejection {
  applicable: false;
  reasonKey: string;
}

export type PortalMethodOutcome = PortalMethodResult | PortalMethodRejection;

const NEAR_ZERO = 1e-9;

export const solvePortalMethod = (
  project: ProjectModel,
  combination: LoadCombination | null = null,
): PortalMethodOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'frame') return { applicable: false, reasonKey: 'method.rejectedNotFrame' };

  const grid = buildFrameGrid(project);
  if (!grid) return { applicable: false, reasonKey: 'method.rejectedGrid' };

  const factors = selectedFactors(project, combination);
  const memberLoadActive = project.memberLoads.some((load) => (factors[load.caseId] ?? 0) !== 0);
  if (memberLoadActive) return { applicable: false, reasonKey: 'method.rejectedMemberLateralLoad' };

  const combinedFx = new Map<string, number>();
  for (const load of project.nodalLoads) {
    const factor = factors[load.caseId] ?? 0;
    if (factor === 0 || load.fx === 0) continue;
    combinedFx.set(load.nodeId, (combinedFx.get(load.nodeId) ?? 0) + factor * load.fx);
  }

  const lines = grid.columnLines.length;
  const stories = grid.storyLevels.length - 1;
  const loadAtLevel = (level: number): number => {
    let sum = 0;
    for (let c = 0; c < lines; c += 1) sum += combinedFx.get(grid.nodeGrid[c][level]) ?? 0;
    return sum;
  };
  const storyShear: number[] = [];
  for (let s = 1; s <= stories; s += 1) {
    let shear = 0;
    for (let level = s; level <= stories; level += 1) shear += loadAtLevel(level);
    storyShear.push(shear);
  }
  if (storyShear.every((shear) => Math.abs(shear) <= NEAR_ZERO)) {
    return { applicable: false, reasonKey: 'method.rejectedNoLateralLoad' };
  }

  const bayWidths = grid.columnLines.slice(1).map((x, index) => x - grid.columnLines[index]);
  const tributaryWidth = (c: number): number => (
    (c > 0 ? bayWidths[c - 1] / 2 : 0) + (c < lines - 1 ? bayWidths[c] / 2 : 0)
  );
  const widths = Array.from({ length: lines }, (_unused, c) => tributaryWidth(c));
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);

  const byId = new Map(project.nodes.map((node) => [node.id, node]));

  // Lateral-only variant of the model: the honest oracle to disclose the gap against, isolating
  // exactly the load this method reasons about so the comparison is not muddied by gravity loads
  // the Portal Method never claimed to carry.
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

  // Column shear, and the moment each column exerts on its two joints — both fixed by the
  // tributary shear alone, so this pass needs no other column's result.
  const columns: PortalColumn[] = [];
  const columnAt = new Map<string, PortalColumn>();
  for (let c = 0; c < lines; c += 1) {
    const baseNode = byId.get(grid.nodeGrid[c][0]);
    for (let s = 1; s <= stories; s += 1) {
      const segment = grid.columns[c][s];
      if (!segment) return { applicable: false, reasonKey: 'method.rejectedGrid' };
      const shear = totalWidth > 0 ? (storyShear[s - 1] * widths[c]) / totalWidth : 0;
      const pinnedBase = s === 1 && baseNode !== undefined && !restrainsRotation(baseNode.support);
      const inflectionFraction = pinnedBase ? 0 : 0.5;
      const y0 = inflectionFraction * segment.height;
      const column: PortalColumn = {
        columnIndex: c,
        story: s,
        memberId: segment.memberId,
        bottomNodeId: segment.bottomNodeId,
        topNodeId: segment.topNodeId,
        height: segment.height,
        tributaryWidth: widths[c],
        shear,
        inflectionFraction,
        bottomMoment: -shear * y0,
        topMoment: -shear * (segment.height - y0),
        axial: 0,
      };
      columns.push(column);
      columnAt.set(`${c}-${s}`, column);
    }
  }

  // Beam moments: joint moment equilibrium, solved left to right across each storey. Every
  // interior joint has exactly one new unknown once the beam to its left is already known,
  // which is why this can be a single sweep rather than a linear system.
  const beams: PortalBeam[] = [];
  const beamMoment = new Map<string, number>(); // `${bay}-${story}`
  for (let s = 1; s <= stories; s += 1) {
    let leftMoment = 0;
    for (let c = 0; c < lines - 1; c += 1) {
      const below = columnAt.get(`${c}-${s}`)!;
      const above = columnAt.get(`${c}-${s + 1}`);
      const jointMomentFromColumns = below.topMoment + (above ? above.bottomMoment : 0);
      const moment = -jointMomentFromColumns - leftMoment;
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
      leftMoment = moment;
    }
  }

  // Column axial force: joint vertical equilibrium, worked from the roof down. Above the roof
  // there is no column, so that contribution starts at zero and accumulates one storey at a time.
  for (let c = 0; c < lines; c += 1) {
    let axialAbove = 0;
    for (let s = stories; s >= 1; s -= 1) {
      const leftM = c > 0 ? beamMoment.get(`${c - 1}-${s}`) : undefined;
      const rightM = c < lines - 1 ? beamMoment.get(`${c}-${s}`) : undefined;
      const leftTerm = leftM !== undefined ? (2 * leftM) / bayWidths[c - 1] : 0;
      const rightTerm = rightM !== undefined ? (2 * rightM) / bayWidths[c] : 0;
      const axial = axialAbove - leftTerm + rightTerm;
      columnAt.get(`${c}-${s}`)!.axial = axial;
      axialAbove = axial;
    }
  }

  const solverByNode = new Map(lateralAnalysis.nodeResults.map((entry) => [entry.nodeId, entry]));
  const baseChecks: PortalBaseCheck[] = [];
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
    storyShear,
    columns,
    beams,
    baseChecks,
    reactionGap: { force: forceGap, moment: momentGap },
  };
};
