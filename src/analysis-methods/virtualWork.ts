/**
 * The Method of Virtual Work (unit-load method), solved for real — and the first method here
 * that narrates a truss instead of a beam or a frame.
 *
 * To find the displacement of a joint in a determinate truss, remove the real load, apply a
 * single *virtual* unit load at that joint in the direction of interest, and find the member
 * forces that unit load alone produces. The displacement is then
 *
 *     Δ = Σ (nᵢ Nᵢ Lᵢ) / (Aᵢ Eᵢ)
 *
 * summed over every member — `Nᵢ` its real axial force under the actual loads, `nᵢ` its axial
 * force under the lone unit load, `Lᵢ` its length. Both `Nᵢ` and `nᵢ` come straight from
 * `analyzeProject` — the real forces from the analysis already computed for the rest of the
 * report, the virtual ones from a one-load model exactly like the unit-load projects
 * `doubleIntegration.ts` builds for its own redundants. Nothing here re-derives a truss's
 * statics; it reads the axial force the solver already produced and sums.
 *
 * The result is then checked against the solver's own displacement at that joint. A method that
 * disagreed with the solver would not be a second opinion, it would be a bug, and
 * `virtualWork.test.ts` fails when the gap opens.
 */
import { analyzeProject, selectedFactors } from '../engine/solver';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel, SupportDefinition } from '../types';
import { classifyStructure, type StructureClassification } from './structureClassification';

export type DisplacementComponent = 'ux' | 'uy';

export interface VirtualWorkMemberContribution {
  memberId: string;
  length: number;
  A: number;
  E: number;
  /** Real axial force under the actual loads, kN, tension positive. */
  axialForce: number;
  /** Axial force under the lone unit load, kN per kN. */
  virtualForce: number;
  /** `nᵢ Nᵢ Lᵢ / (Aᵢ Eᵢ)`, this member's own share of the displacement. */
  contribution: number;
}

export interface VirtualWorkDisplacement {
  nodeId: string;
  component: DisplacementComponent;
  /** Value this method arrives at, metres. */
  value: number;
  /** What the solver reports at the same joint and component. */
  solverValue: number;
}

export interface VirtualWorkNarratedJoint {
  nodeId: string;
  component: DisplacementComponent;
  contributions: VirtualWorkMemberContribution[];
  total: number;
}

export interface VirtualWorkResult {
  applicable: true;
  classification: StructureClassification;
  displacements: VirtualWorkDisplacement[];
  /** Full member-by-member breakdown for the single largest displacement — the worked example. */
  narrated: VirtualWorkNarratedJoint;
  /** Largest gap between a solved displacement and the solver's, metres. */
  residual: number;
}

export interface VirtualWorkRejection {
  applicable: false;
  reasonKey: string;
}

export type VirtualWorkOutcome = VirtualWorkResult | VirtualWorkRejection;

/** Which translational components of a joint are free to displace, given its support. */
export const freeComponents = (support: SupportDefinition): { ux: boolean; uy: boolean } => {
  switch (support.type) {
    case 'fixed':
    case 'pin':
      return { ux: false, uy: false };
    case 'roller': {
      const angle = ((support.angleDeg ?? 90) % 180 + 180) % 180;
      const nx = Math.cos((angle * Math.PI) / 180);
      const ny = Math.sin((angle * Math.PI) / 180);
      // An oblique roller restrains neither pure ux nor pure uy: reporting either as "free" would
      // silently claim a displacement this support does not actually allow unopposed.
      const axisAligned = Math.abs(nx) < 1e-6 || Math.abs(ny) < 1e-6;
      if (!axisAligned) return { ux: false, uy: false };
      const restrainsX = Math.abs(nx) > 0.5;
      return { ux: !restrainsX, uy: restrainsX };
    }
    case 'custom':
      return { ux: !support.restrainX, uy: !support.restrainY };
    default:
      return { ux: true, uy: true };
  }
};

export const memberLength = (member: ProjectModel['members'][number], byId: Map<string, NodeModel>): number => {
  const i = byId.get(member.i);
  const j = byId.get(member.j);
  if (!i || !j) return Number.NaN;
  return Math.hypot(j.x - i.x, j.y - i.y);
};

/** This member's constant axial force, tension positive — a truss member carries no bending. */
export const axialForceOf = (result: AnalysisResult['memberResults'][number] | undefined): number =>
  result?.diagramSegments[0]?.axial[0] ?? Number.NaN;

export const solveVirtualWork = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): VirtualWorkOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'truss') return { applicable: false, reasonKey: 'method.rejectedNotTruss' };

  const factors = selectedFactors(project, combination);
  // A distributed load along a member (self-weight, most plausibly) breaks the "constant N per
  // member" assumption the Σ nNL/AE sum relies on; this delivery narrates joint loads only.
  if (project.memberLoads.some((load) => (factors[load.caseId] ?? 0) !== 0)) {
    return { applicable: false, reasonKey: 'method.rejectedMemberLoadOnTruss' };
  }

  const byId = new Map(project.nodes.map((node) => [node.id, node]));
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

  const targets: { nodeId: string; component: DisplacementComponent }[] = [];
  for (const node of project.nodes) {
    const free = freeComponents(node.support);
    if (free.ux) targets.push({ nodeId: node.id, component: 'ux' });
    if (free.uy) targets.push({ nodeId: node.id, component: 'uy' });
  }
  if (!targets.length) return { applicable: false, reasonKey: 'method.rejectedNoFreeJoint' };

  const solverByNode = new Map(analysis.nodeResults.map((entry) => [entry.nodeId, entry]));
  const displacements: VirtualWorkDisplacement[] = [];
  let narrated: VirtualWorkNarratedJoint | undefined;
  let narratedAbsSolver = -1;
  let residual = 0;

  for (const target of targets) {
    const unitProject: ProjectModel = {
      ...project,
      loadCases: [{ id: 'UNIT', name: 'unit', category: 'other', active: true }],
      combinations: [],
      memberLoads: [],
      nodalLoads: [{
        id: 'UNIT-LOAD',
        nodeId: target.nodeId,
        caseId: 'UNIT',
        fx: target.component === 'ux' ? 1 : 0,
        fy: target.component === 'uy' ? 1 : 0,
        mz: 0,
      }],
    };
    const unitAnalysis = analyzeProject(unitProject, null, { includeEducationTrace: false });
    if (!unitAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

    const contributions: VirtualWorkMemberContribution[] = project.members.map((member) => {
      const length = memberLength(member, byId);
      const virtualForce = axialForceOf(unitAnalysis.memberResults.find((result) => result.memberId === member.id));
      const axialForce = realForce.get(member.id)!;
      return {
        memberId: member.id,
        length,
        A: member.A,
        E: member.E,
        axialForce,
        virtualForce,
        contribution: (virtualForce * axialForce * length) / (member.A * member.E),
      };
    });
    const value = contributions.reduce((sum, entry) => sum + entry.contribution, 0);
    const solver = solverByNode.get(target.nodeId);
    const solverValue = solver ? solver[target.component] : Number.NaN;
    displacements.push({ nodeId: target.nodeId, component: target.component, value, solverValue });
    residual = Math.max(residual, Math.abs(value - solverValue));

    if (Math.abs(solverValue) > narratedAbsSolver) {
      narrated = { nodeId: target.nodeId, component: target.component, contributions, total: value };
      narratedAbsSolver = Math.abs(solverValue);
    }
  }

  return {
    applicable: true,
    classification,
    displacements,
    narrated: narrated!,
    residual,
  };
};
