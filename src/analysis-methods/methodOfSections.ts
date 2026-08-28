/**
 * The Method of Sections, solved for real — global equilibrium of a cut portion of a
 * statically determinate truss, the classical alternative to going joint by joint.
 *
 * Where `virtualWork.ts` finds a joint's *displacement* and `castiglianoTruss.ts` finds a
 * *redundant reaction*, this module finds a member's *axial force* directly: cut the truss with
 * an imaginary line through at most three members, keep one of the two resulting free bodies,
 * and solve `ΣFx = 0`, `ΣFy = 0`, `ΣM = 0` for the (at most three) unknown member forces the cut
 * exposed. No joint is ever balanced and no energy is ever computed — this is the one narrator
 * here built entirely on whole-body statics.
 *
 * The cut itself is not hand-picked from a drawing: for each member this searches — first alone,
 * then together with one more member, then two more — for a set of severed members whose removal
 * splits the truss into exactly two connected pieces, each severed member crossing from one piece
 * to the other. That is precisely what "an imaginary cut through the truss" means, expressed as a
 * graph property instead of a sketch. The known external forces on the kept side (support
 * reactions and applied loads) come straight from `analyzeProject`'s own results for the *whole*
 * structure — nothing here re-derives them — and the solved member forces are checked against
 * that same analysis's own axial forces for those members. A method that disagreed with the
 * solver would not be a second opinion, it would be a bug, and `methodOfSections.test.ts` fails
 * when the gap opens.
 */
import { selectedFactors } from '../engine/solver';
import { solveLinearSystem } from '../engine/math';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel } from '../types';
import { classifyStructure, type StructureClassification } from './structureClassification';
import { axialForceOf, memberLength } from './virtualWork';

export interface SectionCutMember {
  memberId: string;
  length: number;
  /** Value this method arrives at, kN, tension positive. */
  value: number;
  /** What the solver reports for this member, for the reader to compare. */
  solverValue: number;
}

export interface SectionCut {
  cutIndex: number;
  /** Node ids of the free body this cut's equilibrium was written for. */
  keptNodeIds: string[];
  members: SectionCutMember[];
}

export interface MethodOfSectionsResult {
  applicable: true;
  classification: StructureClassification;
  cuts: SectionCut[];
  /** Members no cut of three or fewer could isolate — reported, not hidden. */
  unresolvedMemberIds: string[];
  /** Largest gap between a solved member force and the solver's, kN. */
  residual: number;
}

export interface MethodOfSectionsRejection {
  applicable: false;
  reasonKey: string;
}

export type MethodOfSectionsOutcome = MethodOfSectionsResult | MethodOfSectionsRejection;

type Member = ProjectModel['members'][number];

const MAX_CUT_SIZE = 3;

/** Connected components of the graph (`nodeIds`, `edges`), by simple BFS. */
const connectedComponents = (nodeIds: readonly string[], edges: readonly { i: string; j: string }[]): string[][] => {
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) {
    adjacency.get(edge.i)?.push(edge.j);
    adjacency.get(edge.j)?.push(edge.i);
  }
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const start of nodeIds) {
    if (visited.has(start)) continue;
    const stack = [start];
    const component: string[] = [];
    visited.add(start);
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
};

/** Every `size`-member subset of `members` that includes `targetId`. */
const combinationsIncluding = (targetId: string, members: readonly Member[], size: number): string[][] => {
  const others = members.map((member) => member.id).filter((id) => id !== targetId);
  const results: string[][] = [];
  const build = (start: number, chosen: string[]) => {
    if (chosen.length === size - 1) {
      results.push([targetId, ...chosen]);
      return;
    }
    for (let index = start; index < others.length; index += 1) build(index + 1, [...chosen, others[index]]);
  };
  build(0, []);
  return results;
};

interface FoundCut {
  memberIds: string[];
  keptSide: string[];
}

/**
 * Searches for a valid section through `targetId`: a set of at most `MAX_CUT_SIZE` members whose
 * removal splits the truss into exactly two pieces, with every one of those members genuinely
 * crossing from one piece to the other — not merely counted as "cut" while both its ends sit on
 * the same side, which would misrepresent an internal member as an external unknown.
 */
const findCut = (members: readonly Member[], nodeIds: readonly string[], targetId: string): FoundCut | undefined => {
  for (let size = 1; size <= MAX_CUT_SIZE; size += 1) {
    for (const cutIds of combinationsIncluding(targetId, members, size)) {
      const cutSet = new Set(cutIds);
      const remainingEdges = members.filter((member) => !cutSet.has(member.id)).map((member) => ({ i: member.i, j: member.j }));
      const components = connectedComponents(nodeIds, remainingEdges);
      if (components.length !== 2) continue;
      const sideOf = new Map<string, number>();
      components.forEach((component, index) => component.forEach((nodeId) => sideOf.set(nodeId, index)));
      const cutMembers = members.filter((member) => cutSet.has(member.id));
      if (!cutMembers.every((member) => sideOf.get(member.i) !== sideOf.get(member.j))) continue;
      const keptSide = components[0].length <= components[1].length ? components[0] : components[1];
      return { memberIds: cutIds, keptSide };
    }
  }
  return undefined;
};

export const solveMethodOfSections = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): MethodOfSectionsOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'truss') return { applicable: false, reasonKey: 'method.rejectedNotTruss' };
  if (classification.indeterminacy !== 0) return { applicable: false, reasonKey: 'method.rejectedIndeterminateTruss' };

  const factors = selectedFactors(project, combination);
  if (project.memberLoads.some((load) => (factors[load.caseId] ?? 0) !== 0)) {
    return { applicable: false, reasonKey: 'method.rejectedMemberLoadOnTruss' };
  }

  const byId = new Map<string, NodeModel>(project.nodes.map((node) => [node.id, node]));
  const nodeIds = project.nodes.map((node) => node.id);
  const realForce = new Map(project.members.map((member) => [
    member.id,
    axialForceOf(analysis.memberResults.find((result) => result.memberId === member.id)),
  ]));
  if (project.members.some((member) => {
    const length = memberLength(member, byId);
    return !(length > 0) || !(member.A * member.E > 0) || !Number.isFinite(realForce.get(member.id));
  })) {
    return { applicable: false, reasonKey: 'method.rejectedGeometry' };
  }

  const solverByNode = new Map(analysis.nodeResults.map((entry) => [entry.nodeId, entry]));
  const combinedLoad = new Map<string, { fx: number; fy: number }>();
  for (const load of project.nodalLoads) {
    const factor = factors[load.caseId] ?? 0;
    if (factor === 0) continue;
    const current = combinedLoad.get(load.nodeId) ?? { fx: 0, fy: 0 };
    combinedLoad.set(load.nodeId, { fx: current.fx + factor * load.fx, fy: current.fy + factor * load.fy });
  }

  const resolved = new Set<string>();
  const cuts: SectionCut[] = [];
  const unresolvedMemberIds: string[] = [];
  let residual = 0;

  for (const target of project.members) {
    if (resolved.has(target.id)) continue;
    const found = findCut(project.members, nodeIds, target.id);
    if (!found) {
      unresolvedMemberIds.push(target.id);
      continue;
    }

    const keptSet = new Set(found.keptSide);
    // The known resultant of every reaction and applied load on the kept side, about the origin.
    let rx = 0;
    let ry = 0;
    let rm = 0;
    for (const nodeId of found.keptSide) {
      const node = byId.get(nodeId)!;
      const reaction = solverByNode.get(nodeId);
      if (reaction) {
        rx += reaction.rx;
        ry += reaction.ry;
        rm += node.x * reaction.ry - node.y * reaction.rx;
      }
      const load = combinedLoad.get(nodeId);
      if (load) {
        rx += load.fx;
        ry += load.fy;
        rm += node.x * load.fy - node.y * load.fx;
      }
    }

    // Each cut member contributes a unit-tension force pulling its kept-side node towards the
    // far side; the three rows are ΣFx, ΣFy and ΣM about the origin, in that order.
    const cutMembers = found.memberIds.map((memberId) => project.members.find((member) => member.id === memberId)!);
    const columns = cutMembers.map((member) => {
      const keptIsI = keptSet.has(member.i);
      const nearId = keptIsI ? member.i : member.j;
      const farId = keptIsI ? member.j : member.i;
      const near = byId.get(nearId)!;
      const far = byId.get(farId)!;
      const length = memberLength(member, byId);
      const ux = (far.x - near.x) / length;
      const uy = (far.y - near.y) / length;
      return { ux, uy, momentArm: near.x * uy - near.y * ux };
    });
    const rows = [
      columns.map((column) => column.ux),
      columns.map((column) => column.uy),
      columns.map((column) => column.momentArm),
    ];
    const rhs = [-rx, -ry, -rm];

    const k = cutMembers.length;
    let solution: number[] | undefined;
    if (k === 3) {
      try {
        solution = solveLinearSystem(rows, rhs).x;
      } catch {
        solution = undefined;
      }
    } else {
      // Fewer unknowns than equations: the remaining equation is automatically satisfied by a
      // statically determinate truss, so any well-conditioned k-row subset gives the same answer.
      const rowIndexSets = k === 1 ? [[0], [1], [2]] : [[0, 1], [0, 2], [1, 2]];
      for (const rowIndexes of rowIndexSets) {
        try {
          solution = solveLinearSystem(rowIndexes.map((r) => rows[r]), rowIndexes.map((r) => rhs[r])).x;
          break;
        } catch {
          solution = undefined;
        }
      }
    }
    if (!solution) {
      unresolvedMemberIds.push(target.id);
      continue;
    }

    const members: SectionCutMember[] = cutMembers.map((member, index) => {
      resolved.add(member.id);
      const value = solution![index];
      const solverValue = realForce.get(member.id)!;
      residual = Math.max(residual, Math.abs(value - solverValue));
      return { memberId: member.id, length: memberLength(member, byId), value, solverValue };
    });
    cuts.push({ cutIndex: cuts.length, keptNodeIds: found.keptSide, members });
  }

  return { applicable: true, classification, cuts, unresolvedMemberIds, residual };
};
