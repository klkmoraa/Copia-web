/**
 * The rectangular grid — stories × column lines — a multi-bay, multi-story building frame is
 * built from.
 *
 * `structureClassification` only answers "is this a frame?"; the Portal Method needs to know
 * *which* member is which column line's segment at *which* story, and which bay's beam sits at
 * which floor. That is what this module extracts, and it extracts it conservatively: a frame
 * with a setback, a sloped column, a brace, a moment release, or any member that is not exactly
 * vertical or exactly horizontal does not read back as a grid, and the method withdraws rather
 * than narrate a structure it cannot honestly reduce to one.
 */
import type { ProjectModel, SupportDefinition } from '../types';

export interface FrameColumn {
  memberId: string;
  bottomNodeId: string;
  topNodeId: string;
  /** Storey height, in metres. */
  height: number;
}

export interface FrameBeam {
  memberId: string;
  leftNodeId: string;
  rightNodeId: string;
  /** Bay width, in metres. */
  span: number;
}

export interface FrameGrid {
  /** Y of every storey level, ascending; index 0 is the foundation level. */
  storyLevels: number[];
  /** X of every column line, ascending. */
  columnLines: number[];
  /** `nodeGrid[line][story]` is the node id at that intersection. */
  nodeGrid: string[][];
  /** `columns[line][story]` is the column segment below storey `story` (story = 1..stories-1). */
  columns: (FrameColumn | undefined)[][];
  /** `beams[bay][story]` is the beam between column lines `bay` and `bay+1` at storey `story`. */
  beams: (FrameBeam | undefined)[][];
}

/** Groups sorted coordinates into clusters no farther apart than `tolerance`, one point each. */
const cluster = (values: readonly number[], tolerance: number): number[] => {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[] = [];
  for (const value of sorted) {
    if (!groups.length || value - groups[groups.length - 1] > tolerance) groups.push(value);
  }
  return groups;
};

const nearestIndex = (value: number, levels: readonly number[], tolerance: number): number | undefined => {
  const index = levels.findIndex((level) => Math.abs(level - value) <= tolerance);
  return index < 0 ? undefined : index;
};

export const restrainsRotation = (support: SupportDefinition): boolean =>
  support.type === 'fixed' || (support.type === 'custom' && Boolean(support.restrainR));

/**
 * Reduces a frame to its storey/column-line grid, or returns `undefined` when the geometry does
 * not honestly reduce to one.
 *
 * Every column line is required to run the full height of the building and every bay the full
 * width — a setback or an irregular plan is exactly the case a reader would need to reason about
 * by hand differently than this module does, so it withdraws instead of guessing.
 */
export const buildFrameGrid = (project: ProjectModel): FrameGrid | undefined => {
  const nodes = project.nodes;
  if (nodes.length < 4) return undefined;
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const tolerance = Math.max(1e-9, span * 1e-9);

  const columnLines = cluster(xs, tolerance);
  const storyLevels = cluster(ys, tolerance);
  if (columnLines.length < 2 || storyLevels.length < 2) return undefined;

  const nodeGrid: (string | undefined)[][] = columnLines.map(() => storyLevels.map(() => undefined));
  for (const node of nodes) {
    const c = nearestIndex(node.x, columnLines, tolerance);
    const s = nearestIndex(node.y, storyLevels, tolerance);
    if (c === undefined || s === undefined) return undefined;
    // Two nodes landing in the same cell means the grid is not orthogonal after all.
    if (nodeGrid[c][s] !== undefined) return undefined;
    nodeGrid[c][s] = node.id;
  }
  // Every intersection of the grid must be occupied: a building with a setback or a missing
  // corner is real, but the Portal Method's tributary-width shortcut assumes it is not.
  if (nodeGrid.some((column) => column.some((cell) => cell === undefined))) return undefined;
  const grid = nodeGrid as string[][];

  // No internal hinge anywhere in the grid: the Portal Method assumes fully rigid joints.
  if (nodes.some((node) => node.internalHinge)) return undefined;

  const columns: (FrameColumn | undefined)[][] = columnLines.map(() => new Array(storyLevels.length).fill(undefined));
  const beams: (FrameBeam | undefined)[][] = columnLines.slice(0, -1).map(() => new Array(storyLevels.length).fill(undefined));

  // Locate, for an ordered pair of adjacent grid cells, the single member connecting them —
  // in either declared direction — rejecting when more than one member claims the same edge.
  const findMember = (aId: string, bId: string): ProjectModel['members'][number] | undefined => {
    const candidates = project.members.filter((member) => (
      (member.i === aId && member.j === bId) || (member.i === bId && member.j === aId)
    ));
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  const rigidOrReleased = (member: ProjectModel['members'][number]): boolean => (
    member.type !== 'frame' || Boolean(member.releases?.iMoment) || Boolean(member.releases?.jMoment)
  );

  for (let c = 0; c < columnLines.length; c += 1) {
    for (let s = 1; s < storyLevels.length; s += 1) {
      const bottomId = grid[c][s - 1];
      const topId = grid[c][s];
      const member = findMember(bottomId, topId);
      if (!member || rigidOrReleased(member)) return undefined;
      columns[c][s] = {
        memberId: member.id,
        bottomNodeId: bottomId,
        topNodeId: topId,
        height: storyLevels[s] - storyLevels[s - 1],
      };
    }
  }

  for (let c = 0; c < columnLines.length - 1; c += 1) {
    for (let s = 1; s < storyLevels.length; s += 1) {
      const leftId = grid[c][s];
      const rightId = grid[c + 1][s];
      const member = findMember(leftId, rightId);
      if (!member || rigidOrReleased(member)) return undefined;
      beams[c][s] = {
        memberId: member.id,
        leftNodeId: leftId,
        rightNodeId: rightId,
        span: columnLines[c + 1] - columnLines[c],
      };
    }
  }

  // Every declared member must be accounted for by the grid: a diagonal brace or any member
  // outside the orthogonal columns-and-beams reading is exactly what disqualifies the method.
  const gridMemberIds = new Set([
    ...columns.flat().filter((entry): entry is FrameColumn => Boolean(entry)).map((entry) => entry.memberId),
    ...beams.flat().filter((entry): entry is FrameBeam => Boolean(entry)).map((entry) => entry.memberId),
  ]);
  if (project.members.some((member) => !gridMemberIds.has(member.id))) return undefined;

  return { storyLevels, columnLines, nodeGrid: grid, columns, beams };
};
