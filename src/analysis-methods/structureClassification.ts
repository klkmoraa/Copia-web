/**
 * What kind of structure this is, and how indeterminate.
 *
 * A solution method is not a preference: the Method of Joints only means something on a
 * truss, and Double Integration only on a straight beam. Nothing in the product answered
 * "what am I looking at?" before this module, so every method had to be offered blindly or
 * not at all. The registry asks here, and offers only what genuinely applies.
 *
 * The classification is deliberately conservative. When the geometry does not clearly match a
 * family, `kind` is `'other'` and the specialised methods withdraw — a selector that offers a
 * method which then cannot honour the structure is worse than one that stays quiet.
 */
import type { NodeModel, ProjectModel, SupportDefinition } from '../types';

export type StructureKind = 'simple-beam' | 'continuous-beam' | 'truss' | 'frame' | 'other';

export interface StructureClassification {
  kind: StructureKind;
  /** Restrained global degrees of freedom across every support. */
  reactionCount: number;
  /**
   * Static indeterminacy: restrained DOFs minus available equilibrium equations, discounting
   * the extra equations that internal hinges and moment releases contribute. Negative means
   * the model is a mechanism; the solver refuses those, so it is reported, never assumed away.
   */
  indeterminacy: number;
  /** Nodes lie on one straight line, in ascending order along it. */
  collinear: boolean;
  /** Node ids ordered along the beam axis. Empty unless `collinear`. */
  axisNodeIds: string[];
  /** Every member is a truss bar and every joint is a pin. */
  pinJointed: boolean;
}

/** Restrained global DOFs contributed by one support. */
export const supportRestraintCount = (support: SupportDefinition): number => {
  switch (support.type) {
    case 'fixed': return 3;
    case 'pin': return 2;
    case 'roller': return 1;
    case 'custom': return Number(Boolean(support.restrainX)) + Number(Boolean(support.restrainY)) + Number(Boolean(support.restrainR));
    default: return 0;
  }
};

/** Tolerance for "on the same line", scaled by the model's own span. */
const collinearTolerance = (nodes: readonly NodeModel[]): number => {
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.max(1e-9, span * 1e-9);
};

/**
 * Orders the nodes along their common line, or returns `undefined` when they do not share one.
 *
 * The projection onto the axis direction is what orders them, so a beam declared right to
 * left, or one sloping, is recognised the same as the textbook left-to-right horizontal case.
 */
const axisOrder = (nodes: readonly NodeModel[]): string[] | undefined => {
  if (nodes.length < 2) return undefined;
  const [first] = nodes;
  const last = nodes.reduce((farthest, node) => (
    Math.hypot(node.x - first.x, node.y - first.y) > Math.hypot(farthest.x - first.x, farthest.y - first.y) ? node : farthest
  ), first);
  let dx = last.x - first.x;
  let dy = last.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return undefined;
  // Orient the axis towards +X (or +Y when vertical) so the order is a property of the
  // geometry, not of which node happened to be declared first: a beam entered right to left
  // must still read A, B, C.
  if (dx < 0 || (dx === 0 && dy < 0)) {
    dx = -dx;
    dy = -dy;
  }
  const tolerance = collinearTolerance(nodes);
  const projections: { id: string; t: number }[] = [];
  for (const node of nodes) {
    // Distance from the line, by the 2D cross product; zero means the node sits on it.
    const offset = Math.abs((node.x - first.x) * dy - (node.y - first.y) * dx) / length;
    if (offset > tolerance) return undefined;
    projections.push({ id: node.id, t: ((node.x - first.x) * dx + (node.y - first.y) * dy) / length });
  }
  return projections.sort((a, b) => a.t - b.t).map((entry) => entry.id);
};

/** Restraints a support contributes to *bending*: transverse translation and rotation. */
const beamRestraintCount = (support: SupportDefinition): number => {
  switch (support.type) {
    // Only the moment and the transverse force matter; a pin's horizontal reaction does no
    // work against bending and does not belong in the count the reader sees.
    case 'fixed': return 2;
    case 'pin': return 1;
    case 'roller': {
      // The roller restrains along its normal. A normal along the beam axis restrains the
      // structure axially and leaves bending free, so it contributes nothing here.
      const angle = ((support.angleDeg ?? 90) % 180 + 180) % 180;
      return Math.abs(Math.sin((angle * Math.PI) / 180)) > 0.5 ? 1 : 0;
    }
    case 'custom': return Number(Boolean(support.restrainY)) + Number(Boolean(support.restrainR));
    default: return 0;
  }
};

/**
 * Classical planar-beam count: g = (transverse and moment restraints) − 2, less one equation
 * for every internal hinge. This is the number the reader expects to recognise — DELx's beam,
 * fixed plus two rollers, reads `g = 4 − 2 = 2`.
 *
 * Moment releases at the two *outer* ends of the beam are pinned-connection modelling, not
 * conditions: counting them would make a simply supported beam read as a mechanism. A release
 * at an interior node is a genuine hinge and does count.
 */
const beamIndeterminacy = (project: ProjectModel, axisNodeIds: readonly string[]): number => {
  const restraints = project.nodes.reduce((total, node) => total + beamRestraintCount(node.support), 0);
  const interior = new Set(axisNodeIds.slice(1, -1));
  let conditions = project.nodes.reduce((total, node) => total + Number(Boolean(node.internalHinge)), 0);
  for (const member of project.members) {
    if (member.type === 'rigid') continue;
    if (member.releases?.iMoment && interior.has(member.i)) conditions += 1;
    if (member.releases?.jMoment && interior.has(member.j)) conditions += 1;
  }
  return restraints - 2 - conditions;
};

export const classifyStructure = (project: ProjectModel): StructureClassification => {
  const nodes = project.nodes;
  const members = project.members.filter((member) => member.type !== 'rigid');
  const reactionCount = nodes.reduce((total, node) => total + supportRestraintCount(node.support), 0);

  const axisNodeIds = axisOrder(nodes) ?? [];
  const collinear = axisNodeIds.length === nodes.length && nodes.length >= 2;
  const pinJointed = members.length > 0
    && members.every((member) => member.type === 'truss')
    && nodes.every((node) => node.support.type !== 'fixed');

  const kind: StructureKind = pinJointed
    ? 'truss'
    : collinear && members.length > 0
      ? (members.length === 1 ? 'simple-beam' : 'continuous-beam')
      : members.length > 0 ? 'frame' : 'other';

  const releases = members.reduce((total, member) => (
    total + Number(Boolean(member.releases?.iMoment)) + Number(Boolean(member.releases?.jMoment))
  ), 0);
  const internalHinges = nodes.reduce((total, node) => total + Number(Boolean(node.internalHinge)), 0);

  const indeterminacy = kind === 'simple-beam' || kind === 'continuous-beam'
    ? beamIndeterminacy(project, axisNodeIds)
    : kind === 'truss'
      ? members.length + reactionCount - 2 * nodes.length
      : reactionCount + 3 * members.length - 3 * nodes.length - releases - internalHinges;

  return { kind, reactionCount, indeterminacy, collinear, axisNodeIds: collinear ? axisNodeIds : [], pinJointed };
};
