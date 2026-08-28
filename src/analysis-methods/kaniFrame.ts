/**
 * Kani's Method (rotation contribution), solved for real — the first narrator here to iterate a
 * genuine frame joint graph, where a node can have more than the two members a beam's interior
 * support ever has, instead of a beam's linear chain of spans.
 *
 * Like Hardy Cross, every member's fixed-end moment (`FEM`) comes from `analyzeProject` on a
 * fixed–fixed isolation of that one member — nothing here re-derives its statics. But rather than
 * Hardy Cross's distribute-then-carry-over bookkeeping, Kani tracks one running "rotation
 * moment" `M'ᵢⱼ` per member end, updated every sweep from the *current* rotation moments at the
 * far ends of every member meeting at that joint:
 *
 *     M'ᵢⱼ = μᵢⱼ · (ΣFEMᵢ + Σ M'ⱼᵢ),   μᵢⱼ = −½ · (Kᵢⱼ / ΣKᵢ)
 *
 * This is not a recollected formula taken on faith: it is exactly what joint moment equilibrium,
 * `Σⱼ Mᵢⱼ = 0` at every rotating joint, forces once every member's final moment is written as
 * `Mᵢⱼ = FEMᵢⱼ + 2M'ᵢⱼ + M'ⱼᵢ` and `Σⱼ μᵢⱼ = −½` by construction — the derivation is in
 * `kaniFrame.test.ts`'s own comments, and the test checks the formula against the solver on a
 * hand-verified frame, not the other way around.
 *
 * The formula above has no "sway" term, which makes it exact only when the frame genuinely does
 * not translate sideways under this load. Whether that holds is not assumed from the geometry —
 * a frame that merely *looks* symmetric can still carry a tiny, genuine sideways give from a
 * member's own finite axial stiffness (`kaniFrame.test.ts` catches exactly this case), and
 * guessing a displacement tolerance to tell that apart from real sidesway would be exactly that,
 * a guess. Instead this module computes the answer regardless and checks it against the solver's
 * own moments for the real structure: a genuinely sway-free frame lands within numerical noise,
 * and the method declares itself inapplicable rather than narrate anything less exact than that.
 */
import { analyzeProject } from '../engine/solver';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel, SupportDefinition } from '../types';
import { evaluate } from './polynomialAlgebra';
import { buildBeamAxis } from './beamAxis';
import { classifyStructure, type StructureClassification } from './structureClassification';

export interface KaniMember {
  memberId: string;
  nodeI: string;
  nodeJ: string;
  length: number;
  EI: number;
  /** Fixed-end moment under the real loads alone, physical value at each end. */
  fixedEndMomentI: number;
  fixedEndMomentJ: number;
  /** Converged final moment, physical value at each end. */
  finalMomentI: number;
  finalMomentJ: number;
  /** What the solver's own diagram reports at each end, for the reader to compare. */
  solverMomentI: number;
  solverMomentJ: number;
}

export interface KaniResult {
  applicable: true;
  classification: StructureClassification;
  members: KaniMember[];
  /** How many balancing sweeps it took to bring every joint below the convergence tolerance. */
  iterationCount: number;
  /** Largest gap between a final member-end moment and the solver's, kN·m. */
  momentResidual: number;
}

export interface KaniRejection {
  applicable: false;
  reasonKey: string;
}

export type KaniOutcome = KaniResult | KaniRejection;

const restrainsRotation = (support: SupportDefinition): boolean =>
  support.type === 'fixed' || (support.type === 'custom' && Boolean(support.restrainR));

const TOLERANCE = 1e-10;
const MAX_ITERATIONS = 5000;

export const solveKaniFrame = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): KaniOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'frame') return { applicable: false, reasonKey: 'method.rejectedNotFrame' };

  if (project.nodes.some((node) => node.internalHinge) || project.members.some((member) => member.releases?.iMoment || member.releases?.jMoment)) {
    return { applicable: false, reasonKey: 'method.rejectedContinuityRequired' };
  }
  if (project.members.some((member) => member.type !== 'frame')) {
    return { applicable: false, reasonKey: 'method.rejectedContinuityRequired' };
  }

  const byId = new Map(project.nodes.map((node) => [node.id, node]));

  const members: KaniMember[] = [];
  for (const member of project.members) {
    const i = byId.get(member.i);
    const j = byId.get(member.j);
    if (!i || !j) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const EI = member.E * member.I;
    if (!(EI > 0)) return { applicable: false, reasonKey: 'method.rejectedGeometry' };

    // Fixed-end moment: the same member, isolated, with both its own ends genuinely fixed.
    const isolated: ProjectModel = {
      ...project,
      nodes: [{ ...i, support: { type: 'fixed' } } as NodeModel, { ...j, support: { type: 'fixed' } } as NodeModel],
      members: [member],
      memberLoads: project.memberLoads.filter((load) => load.memberId === member.id),
      nodalLoads: [],
      prescribedDisplacements: [],
    };
    const isolatedAnalysis = analyzeProject(isolated, combination, { includeEducationTrace: false });
    if (!isolatedAnalysis.success) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const axis = buildBeamAxis(isolated, isolatedAnalysis, [member.i, member.j]);
    if (!axis || !axis.segments.length) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const first = axis.segments[0];
    const last = axis.segments[axis.segments.length - 1];

    const solverResult = analysis.memberResults.find((entry) => entry.memberId === member.id);
    if (!solverResult || !solverResult.diagramSegments.length) return { applicable: false, reasonKey: 'method.rejectedGeometry' };
    const solverFirst = solverResult.diagramSegments[0];
    const solverLast = solverResult.diagramSegments[solverResult.diagramSegments.length - 1];

    members.push({
      memberId: member.id,
      nodeI: member.i,
      nodeJ: member.j,
      length: axis.length,
      EI,
      fixedEndMomentI: evaluate(first.moment, first.x0),
      fixedEndMomentJ: evaluate(last.moment, last.x1),
      finalMomentI: 0,
      finalMomentJ: 0,
      solverMomentI: evaluate(solverFirst.moment, solverFirst.x0),
      solverMomentJ: evaluate(solverLast.moment, solverLast.x1),
    });
  }

  const atNode = new Map<string, { member: KaniMember; here: 'I' | 'J' }[]>();
  for (const node of project.nodes) atNode.set(node.id, []);
  for (const member of members) {
    atNode.get(member.nodeI)?.push({ member, here: 'I' });
    atNode.get(member.nodeJ)?.push({ member, here: 'J' });
  }

  const rotating = project.nodes.filter((node) => !restrainsRotation(node.support) && (atNode.get(node.id)?.length ?? 0) > 0);

  // Rotation factor μ, fixed once from each joint's relative member stiffness.
  const mu = new Map<string, number>();
  const rotationMoment = new Map<string, number>();
  const key = (nodeId: string, memberId: string) => `${nodeId}-${memberId}`;
  for (const node of rotating) {
    const entries = atNode.get(node.id) ?? [];
    const totalK = entries.reduce((sum, entry) => sum + entry.member.EI / entry.member.length, 0);
    for (const entry of entries) {
      const k = entry.member.EI / entry.member.length;
      mu.set(key(node.id, entry.member.memberId), totalK > 0 ? (-0.5 * k) / totalK : 0);
      rotationMoment.set(key(node.id, entry.member.memberId), 0);
    }
  }

  // ΣFEM at each joint — a constant, the load this joint starts out unbalanced by.
  const femAtNode = new Map<string, number>();
  for (const member of members) {
    femAtNode.set(member.nodeI, (femAtNode.get(member.nodeI) ?? 0) + member.fixedEndMomentI);
    femAtNode.set(member.nodeJ, (femAtNode.get(member.nodeJ) ?? 0) - member.fixedEndMomentJ);
  }

  let iterationCount = 0;
  for (; iterationCount < MAX_ITERATIONS; iterationCount += 1) {
    let maxChange = 0;
    for (const node of rotating) {
      const entries = atNode.get(node.id) ?? [];
      const farSum = entries.reduce((sum, entry) => {
        const farNodeId = entry.here === 'I' ? entry.member.nodeJ : entry.member.nodeI;
        return sum + (rotationMoment.get(key(farNodeId, entry.member.memberId)) ?? 0);
      }, 0);
      const r = (femAtNode.get(node.id) ?? 0) + farSum;
      for (const entry of entries) {
        const entryKey = key(node.id, entry.member.memberId);
        const value = (mu.get(entryKey) ?? 0) * r;
        maxChange = Math.max(maxChange, Math.abs(value - (rotationMoment.get(entryKey) ?? 0)));
        rotationMoment.set(entryKey, value);
      }
    }
    if (maxChange <= TOLERANCE) break;
  }
  if (iterationCount >= MAX_ITERATIONS) return { applicable: false, reasonKey: 'method.rejectedNotConverged' };

  let momentResidual = 0;
  let referenceMoment = 0;
  for (const member of members) {
    const mIJ = rotationMoment.get(key(member.nodeI, member.memberId)) ?? 0;
    const mJI = rotationMoment.get(key(member.nodeJ, member.memberId)) ?? 0;
    // At the i end, "exerts on the joint" and "physical" are the same thing, so the equilibrium
    // formula's result is already the physical value. At the j end they differ by a sign — the
    // same asymmetry `femAtNode` above already accounts for — so the formula is evaluated in the
    // "exerts on the joint" sense (negating the stored physical FEM to match) and only negated
    // back to physical at the very end.
    member.finalMomentI = member.fixedEndMomentI + 2 * mIJ + mJI;
    const exertsOnJointJ = -member.fixedEndMomentJ + 2 * mJI + mIJ;
    member.finalMomentJ = -exertsOnJointJ;
    momentResidual = Math.max(
      momentResidual,
      Math.abs(member.finalMomentI - member.solverMomentI),
      Math.abs(member.finalMomentJ - member.solverMomentJ),
    );
    referenceMoment = Math.max(referenceMoment, Math.abs(member.solverMomentI), Math.abs(member.solverMomentJ));
  }

  // The formula above carries no sway term, so it is only exact when the frame genuinely does not
  // translate sideways under this load. Rather than guessing that from the geometry — a member's
  // own finite axial stiffness gives every joint a little lateral give even in a perfectly
  // symmetric frame under a symmetric load, which is not sidesway in the sense that matters here —
  // this checks the one thing that actually matters: did the answer come out right. A real sway
  // opens a gap orders of magnitude past ordinary numerical noise.
  if (momentResidual > Math.max(1e-6, referenceMoment * 1e-4)) {
    return { applicable: false, reasonKey: 'method.rejectedSidesway' };
  }

  return { applicable: true, classification, members, iterationCount, momentResidual };
};
