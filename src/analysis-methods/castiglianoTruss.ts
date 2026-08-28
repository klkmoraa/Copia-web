/**
 * Castigliano's Theorem of Least Work, solved for real — redundant reactions of a statically
 * indeterminate truss.
 *
 * `virtualWork.ts` answers "how far does this joint move" for a truss whose member forces are
 * already known. This module answers a different question the same theorem also answers: when
 * the truss has *more* reactions than the three equilibrium equations can place, which values do
 * those extra reactions take? Castigliano's statement is that the strain energy is stationary
 * with respect to each redundant, `∂U/∂Xₖ = 0` — and for a pin-jointed truss, with
 * `U = Σ Nᵢ²Lᵢ/(2AᵢEᵢ)`, that derivative is exactly the virtual-work compatibility statement:
 * the released (primary) structure's displacement in the direction of each redundant, under the
 * real loads *and* every other redundant, has to be zero — because in the real, unreleased
 * structure that support does not move.
 *
 * The primary structure's member forces under the real loads (`N₀`) and under a unit value of
 * each redundant (`n`) both come from `analyzeProject` on a released model — precisely the
 * pattern `doubleIntegration.ts` uses for beam redundants, reused here for a truss's. Nothing
 * here re-derives the truss's statics; the compatibility system is built from forces the solver
 * already produced, and the result is checked against the solver's own answer for the *original*
 * (unreleased) structure. A method that disagreed with the solver would not be a second opinion,
 * it would be a bug, and `castiglianoTruss.test.ts` fails when the gap opens.
 */
import { analyzeProject } from '../engine/solver';
import { solveLinearSystem } from '../engine/math';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel, SupportDefinition } from '../types';
import { classifyStructure, type StructureClassification } from './structureClassification';
import { axialForceOf, freeComponents, memberLength, type DisplacementComponent } from './virtualWork';

export interface RedundantReactionSolution {
  nodeId: string;
  component: DisplacementComponent;
  symbol: string;
  /** Value this method arrives at, kN. */
  value: number;
  /** What the solver reports at the same node and component, for the reader to compare. */
  solverReaction: number;
}

export interface CastiglianoMemberForce {
  memberId: string;
  length: number;
  /** Force in the released (primary) structure under the real loads alone, kN. */
  primaryForce: number;
  /** Final force, `N₀ + Σ Xₖnₖ`, kN. */
  force: number;
  /** What the solver reports for this member on the original, unreleased structure. */
  solverForce: number;
}

export interface CastiglianoTrussResult {
  applicable: true;
  classification: StructureClassification;
  redundants: RedundantReactionSolution[];
  members: CastiglianoMemberForce[];
  /** Largest gap between a redundant and the solver's reaction there, kN. */
  reactionResidual: number;
  /** Largest gap between a final member force and the solver's, kN. */
  forceResidual: number;
}

export interface CastiglianoTrussRejection {
  applicable: false;
  reasonKey: string;
}

export type CastiglianoTrussOutcome = CastiglianoTrussResult | CastiglianoTrussRejection;

const SUBSCRIPTS = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const subscript = (index: number): string => {
  const number1 = index + 1;
  return number1 <= 9 ? SUBSCRIPTS[number1 - 1] : String(number1).split('').map((digit) => SUBSCRIPTS[Number(digit) - 1] ?? '₀').join('');
};

const isObliqueRoller = (support: SupportDefinition): boolean => {
  if (support.type !== 'roller') return false;
  const angle = ((support.angleDeg ?? 90) % 180 + 180) % 180;
  const nx = Math.cos((angle * Math.PI) / 180);
  const ny = Math.sin((angle * Math.PI) / 180);
  return Math.abs(nx) >= 1e-6 && Math.abs(ny) >= 1e-6;
};

type Candidate = { nodeId: string; component: DisplacementComponent };

/** The project with every listed (node, component) restraint replaced by a free one. */
const releasedProject = (project: ProjectModel, releases: readonly Candidate[]): ProjectModel => {
  const released = new Set(releases.map((entry) => `${entry.nodeId}-${entry.component}`));
  return {
    ...project,
    nodes: project.nodes.map((node): NodeModel => {
      const releaseUx = released.has(`${node.id}-ux`);
      const releaseUy = released.has(`${node.id}-uy`);
      if (!releaseUx && !releaseUy) return node;
      const free = freeComponents(node.support);
      return { ...node, support: { type: 'custom', restrainX: !free.ux && !releaseUx, restrainY: !free.uy && !releaseUy } };
    }),
  };
};

/** The released structure carrying nothing but a unit force at `target`, in its own direction. */
const unitRedundantProject = (releasedProj: ProjectModel, target: Candidate): ProjectModel => ({
  ...releasedProj,
  loadCases: [{ id: 'UNIT', name: 'unit', category: 'other', active: true }],
  combinations: [],
  memberLoads: [],
  nodalLoads: [{
    id: 'UNIT-LOAD', nodeId: target.nodeId, caseId: 'UNIT',
    fx: target.component === 'ux' ? 1 : 0, fy: target.component === 'uy' ? 1 : 0, mz: 0,
  }],
});

/**
 * Chooses which reaction components to treat as redundant, exactly the way
 * `doubleIntegration.ts` chooses beam redundants: every candidate window is put to the solver
 * before being adopted, so a selection that would leave the primary truss a mechanism is
 * discarded rather than narrated.
 */
const chooseRedundants = (
  project: ProjectModel,
  candidates: readonly Candidate[],
  degree: number,
  combination: LoadCombination | null,
): Candidate[] | undefined => {
  if (candidates.length < degree) return undefined;
  for (let start = 0; start + degree <= candidates.length; start += 1) {
    const attempt = candidates.slice(start, start + degree);
    const probe = analyzeProject(releasedProject(project, attempt), combination, { includeEducationTrace: false });
    if (probe.success) return attempt;
  }
  return undefined;
};

export const solveCastiglianoTruss = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): CastiglianoTrussOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'truss') return { applicable: false, reasonKey: 'method.rejectedNotTruss' };

  const degree = classification.indeterminacy;
  if (degree < 1) return { applicable: false, reasonKey: 'method.rejectedDeterminateTruss' };

  // The just-rigid truss formula, m = 2n − 3: any surplus of members over that means some of the
  // indeterminacy is *internal* (a redundant bar, not a redundant reaction), and choosing a bar
  // to cut is a different — and different-to-implement — procedure this delivery does not cover.
  const internalRedundancy = project.members.length - 2 * project.nodes.length + 3;
  if (internalRedundancy !== 0) return { applicable: false, reasonKey: 'method.rejectedInternalRedundancy' };

  if (project.nodes.some((node) => isObliqueRoller(node.support))) {
    return { applicable: false, reasonKey: 'method.rejectedObliqueSupport' };
  }

  const candidates: Candidate[] = [];
  for (const node of project.nodes) {
    const free = freeComponents(node.support);
    if (!free.ux) candidates.push({ nodeId: node.id, component: 'ux' });
    if (!free.uy) candidates.push({ nodeId: node.id, component: 'uy' });
  }

  const chosen = chooseRedundants(project, candidates, degree, combination);
  if (!chosen) return { applicable: false, reasonKey: 'method.rejectedRedundants' };

  const primaryProject = releasedProject(project, chosen);
  const primaryAnalysis = analyzeProject(primaryProject, combination, { includeEducationTrace: false });
  if (!primaryAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedRedundants' };

  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  const primaryForce = new Map(project.members.map((member) => [
    member.id,
    axialForceOf(primaryAnalysis.memberResults.find((result) => result.memberId === member.id)),
  ]));

  const unitForces: Map<string, number>[] = [];
  for (const target of chosen) {
    const unitProject = unitRedundantProject(primaryProject, target);
    const unitAnalysis = analyzeProject(unitProject, null, { includeEducationTrace: false });
    if (!unitAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedRedundants' };
    unitForces.push(new Map(project.members.map((member) => [
      member.id,
      axialForceOf(unitAnalysis.memberResults.find((result) => result.memberId === member.id)),
    ])));
  }

  if (project.members.some((member) => {
    const length = memberLength(member, byId);
    return !(length > 0) || !(member.A * member.E > 0);
  })) {
    return { applicable: false, reasonKey: 'method.rejectedGeometry' };
  }

  // Compatibility: the primary structure's displacement in the direction of each redundant, under
  // the real loads plus every other redundant, is zero — the virtual-work statement of
  // `∂U/∂Xₖ = 0`. `flexibility[m][k] = Σ nₖnₘL/(AE)`, `load[m] = -Σ N₀nₘL/(AE)`.
  const flexibility: number[][] = chosen.map(() => new Array<number>(chosen.length).fill(0));
  const load: number[] = new Array<number>(chosen.length).fill(0);
  for (const member of project.members) {
    const length = memberLength(member, byId);
    const denominator = member.A * member.E;
    const n0 = primaryForce.get(member.id)!;
    for (let m = 0; m < chosen.length; m += 1) {
      const nm = unitForces[m].get(member.id)!;
      load[m] -= (n0 * nm * length) / denominator;
      for (let k = 0; k < chosen.length; k += 1) {
        flexibility[m][k] += (unitForces[k].get(member.id)! * nm * length) / denominator;
      }
    }
  }

  let solution: number[];
  try {
    solution = solveLinearSystem(flexibility, load).x;
  } catch {
    return { applicable: false, reasonKey: 'method.rejectedSingular' };
  }

  const solverByNode = new Map(analysis.nodeResults.map((entry) => [entry.nodeId, entry]));
  const redundants: RedundantReactionSolution[] = chosen.map((target, index) => ({
    nodeId: target.nodeId,
    component: target.component,
    symbol: `X${subscript(index)}`,
    value: solution[index],
    solverReaction: solverByNode.get(target.nodeId)?.[target.component === 'ux' ? 'rx' : 'ry'] ?? Number.NaN,
  }));
  const reactionResidual = redundants.reduce(
    (largest, entry) => Math.max(largest, Math.abs(entry.value - entry.solverReaction)),
    0,
  );

  const solverForceByMember = new Map(project.members.map((member) => [
    member.id,
    axialForceOf(analysis.memberResults.find((result) => result.memberId === member.id)),
  ]));
  const members: CastiglianoMemberForce[] = project.members.map((member) => {
    const n0 = primaryForce.get(member.id)!;
    const force = solution.reduce((sum, x, k) => sum + x * unitForces[k].get(member.id)!, n0);
    return {
      memberId: member.id,
      length: memberLength(member, byId),
      primaryForce: n0,
      force,
      solverForce: solverForceByMember.get(member.id) ?? Number.NaN,
    };
  });
  const forceResidual = members.reduce(
    (largest, entry) => Math.max(largest, Math.abs(entry.force - entry.solverForce)),
    0,
  );

  return { applicable: true, classification, redundants, members, reactionResidual, forceResidual };
};
