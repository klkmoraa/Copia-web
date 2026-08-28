/**
 * The Method of Joints, solved for real — the classical complement to `methodOfSections.ts`:
 * local equilibrium at one pin at a time instead of global equilibrium of a cut portion.
 *
 * Every joint of a truss has exactly two equilibrium equations, `ΣFx = 0` and `ΣFy = 0`, so a
 * joint can only be solved outright when at most two of its member forces are still unknown.
 * This module finds, at every pass, whichever joints have reached that point — starting wherever
 * the geometry happens to leave a joint with one or two members, typically a support or a free
 * end — solves their few unknown forces from the reactions, loads and *already solved* member
 * forces meeting there, and repeats until every member is accounted for. That sequential
 * dependency is the method's own defining trait, and it is why the result is reported as an
 * ordered sequence of joints, not a flat table: which joint could be solved *next* is itself part
 * of what the procedure demonstrates.
 *
 * The known reactions and loads at each joint come straight from `analyzeProject`'s own results
 * for the whole structure — nothing here re-derives them — and every solved member force is
 * checked against that same analysis's own axial force for that member. A method that disagreed
 * with the solver would not be a second opinion, it would be a bug, and
 * `methodOfJoints.test.ts` fails when the gap opens.
 */
import { selectedFactors } from '../engine/solver';
import { solveLinearSystem } from '../engine/math';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel } from '../types';
import { classifyStructure, type StructureClassification } from './structureClassification';
import { axialForceOf, memberLength } from './virtualWork';

export interface JointStepMember {
  memberId: string;
  /** Value this method arrives at, kN, tension positive. */
  value: number;
  /** What the solver reports for this member, for the reader to compare. */
  solverValue: number;
}

export interface JointStep {
  nodeId: string;
  members: JointStepMember[];
}

export interface MethodOfJointsResult {
  applicable: true;
  classification: StructureClassification;
  /** One entry per joint solved, in the order the method could actually solve them. */
  steps: JointStep[];
  /** Members no joint ever reached with two or fewer unknowns — reported, not hidden. */
  unresolvedMemberIds: string[];
  /** Largest gap between a solved member force and the solver's, kN. */
  residual: number;
}

export interface MethodOfJointsRejection {
  applicable: false;
  reasonKey: string;
}

export type MethodOfJointsOutcome = MethodOfJointsResult | MethodOfJointsRejection;

type Member = ProjectModel['members'][number];

export const solveMethodOfJoints = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): MethodOfJointsOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'truss') return { applicable: false, reasonKey: 'method.rejectedNotTruss' };
  if (classification.indeterminacy !== 0) return { applicable: false, reasonKey: 'method.rejectedIndeterminateTruss' };

  const factors = selectedFactors(project, combination);
  if (project.memberLoads.some((load) => (factors[load.caseId] ?? 0) !== 0)) {
    return { applicable: false, reasonKey: 'method.rejectedMemberLoadOnTruss' };
  }

  const byId = new Map<string, NodeModel>(project.nodes.map((node) => [node.id, node]));
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

  const incidentAt = new Map<string, Member[]>();
  for (const node of project.nodes) incidentAt.set(node.id, []);
  for (const member of project.members) {
    incidentAt.get(member.i)?.push(member);
    incidentAt.get(member.j)?.push(member);
  }

  /** Unit vector, from `nodeId`, towards the far end of `member` — the direction a tensile force pulls that joint. */
  const towardsFarEnd = (member: Member, nodeId: string): { ux: number; uy: number } => {
    const nearIsI = member.i === nodeId;
    const near = byId.get(nearIsI ? member.i : member.j)!;
    const far = byId.get(nearIsI ? member.j : member.i)!;
    const length = memberLength(member, byId);
    return { ux: (far.x - near.x) / length, uy: (far.y - near.y) / length };
  };

  const solved = new Map<string, number>();
  const processed = new Set<string>();
  const steps: JointStep[] = [];

  for (let guard = 0; guard < project.nodes.length + 1; guard += 1) {
    let progressed = false;
    for (const node of project.nodes) {
      if (processed.has(node.id)) continue;
      const unresolved = (incidentAt.get(node.id) ?? []).filter((member) => !solved.has(member.id));
      if (unresolved.length > 2) continue;

      // Known part of this joint's equilibrium: its reaction, its applied load, and every
      // already-solved member meeting here.
      let knownX = 0;
      let knownY = 0;
      const reaction = solverByNode.get(node.id);
      if (reaction) { knownX += reaction.rx; knownY += reaction.ry; }
      const load = combinedLoad.get(node.id);
      if (load) { knownX += load.fx; knownY += load.fy; }
      for (const member of incidentAt.get(node.id) ?? []) {
        const value = solved.get(member.id);
        if (value === undefined) continue;
        const { ux, uy } = towardsFarEnd(member, node.id);
        knownX += value * ux;
        knownY += value * uy;
      }

      const columns = unresolved.map((member) => towardsFarEnd(member, node.id));
      const rows = [columns.map((c) => c.ux), columns.map((c) => c.uy)];
      const rhs = [-knownX, -knownY];

      let values: number[] | undefined;
      if (unresolved.length === 2) {
        try {
          values = solveLinearSystem(rows, rhs).x;
        } catch {
          values = undefined;
        }
      } else if (unresolved.length === 1) {
        for (const rowIndex of [0, 1]) {
          try {
            values = solveLinearSystem([rows[rowIndex]], [rhs[rowIndex]]).x;
            break;
          } catch {
            values = undefined;
          }
        }
      } else {
        values = [];
      }
      if (!values) continue;

      const members: JointStepMember[] = unresolved.map((member, index) => {
        solved.set(member.id, values![index]);
        return { memberId: member.id, value: values![index], solverValue: realForce.get(member.id)! };
      });
      processed.add(node.id);
      progressed = true;
      if (members.length) steps.push({ nodeId: node.id, members });
    }
    if (!progressed) break;
  }

  const unresolvedMemberIds = project.members.filter((member) => !solved.has(member.id)).map((member) => member.id);
  const residual = steps.reduce(
    (largest, step) => step.members.reduce((inner, member) => Math.max(inner, Math.abs(member.value - member.solverValue)), largest),
    0,
  );

  return { applicable: true, classification, steps, unresolvedMemberIds, residual };
};
