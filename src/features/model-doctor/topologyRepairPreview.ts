import {
  prepareTopologyRepairCommand,
  type PreparedTopologyRepair,
  type ProjectPatchOperation,
} from '../../commands/projectCommand';
import type {
  MemberInitialEffect,
  MemberLoad,
  MemberModel,
  NodalLoad,
  NodeModel,
  PrescribedDisplacement,
  ProjectModel,
} from '../../types';
import { buildModelDoctorReport, type ModelDoctorFinding } from './modelDoctorDiagnostics';

export interface TopologyRepairChange<T> {
  id: string;
  before: T | null;
  after: T | null;
  disposition?: 'preserved' | 'remapped' | 'created' | 'removed';
}

export interface TopologyNodeMergePreview {
  keptNodeId: string;
  removedNodeId: string;
  keptBefore: NodeModel;
  keptAfter: NodeModel;
  removed: NodeModel;
}

export interface TopologyMemberSplitPreview {
  originalMember: MemberModel;
  splitNodeIds: string[];
  resultingMembers: MemberModel[];
}

export interface TopologyRepairPreview {
  prepared: PreparedTopologyRepair;
  hasChanges: boolean;
  changes: {
    mergedNodes: TopologyNodeMergePreview[];
    splitMembers: TopologyMemberSplitPreview[];
    nodes: Array<TopologyRepairChange<NodeModel>>;
    members: Array<TopologyRepairChange<MemberModel>>;
    nodalLoads: Array<TopologyRepairChange<NodalLoad>>;
    memberLoads: Array<TopologyRepairChange<MemberLoad>>;
    prescribedDisplacements: Array<TopologyRepairChange<PrescribedDisplacement>>;
    memberInitialEffects: Array<TopologyRepairChange<MemberInitialEffect>>;
    skippedCoincidentPairs: Array<{ firstNodeId: string; secondNodeId: string }>;
    /** Existing node/member coincidences that the domain repair deliberately leaves untouched. */
    unresolvedTopology: ModelDoctorFinding[];
  };
}

const operationsFor = <T,>(
  operations: ProjectPatchOperation[],
  collection: ProjectPatchOperation['collection'],
): Array<TopologyRepairChange<T>> => operations
  .filter((operation) => operation.collection === collection)
  .map((operation) => ({
    id: operation.id,
    before: operation.before as T | null,
    after: operation.after as T | null,
    disposition: operation.before === null
      ? 'created'
      : operation.after === null
        ? 'removed'
        : 'remapped',
  }));

const buildSplitPreviews = (
  project: ProjectModel,
  prepared: PreparedTopologyRepair,
): TopologyMemberSplitPreview[] => {
  const lineage = new Map(project.members.map((member) => [member.id, member.id]));
  const splitNodesByRoot = new Map<string, string[]>();

  for (const split of prepared.report.splitMembers) {
    const root = lineage.get(split.originalMemberId) ?? split.originalMemberId;
    lineage.set(split.firstMemberId, root);
    lineage.set(split.secondMemberId, root);
    const splitNodes = splitNodesByRoot.get(root) ?? [];
    if (!splitNodes.includes(split.nodeId)) splitNodes.push(split.nodeId);
    splitNodesByRoot.set(root, splitNodes);
  }

  return [...splitNodesByRoot].flatMap(([root, splitNodeIds]) => {
    const originalMember = project.members.find((member) => member.id === root);
    if (!originalMember) return [];
    return [{
      originalMember: structuredClone(originalMember),
      splitNodeIds,
      resultingMembers: prepared.repairedProject.members
        .filter((member) => lineage.get(member.id) === root)
        .map((member) => structuredClone(member)),
    }];
  });
};

const buildInitialEffectChanges = (
  project: ProjectModel,
  prepared: PreparedTopologyRepair,
  splitMembers: TopologyMemberSplitPreview[],
): Array<TopologyRepairChange<MemberInitialEffect>> => {
  const patched = operationsFor<MemberInitialEffect>(prepared.forward.operations, 'memberInitialEffects');
  const patchedIds = new Set(patched.map((change) => change.id));
  const splitSourceIds = new Set(splitMembers.map((split) => split.originalMember.id));
  const preserved = (project.memberInitialEffects ?? [])
    .filter((effect) => splitSourceIds.has(effect.memberId) && !patchedIds.has(effect.id))
    .flatMap((effect): Array<TopologyRepairChange<MemberInitialEffect>> => {
      const after = prepared.repairedProject.memberInitialEffects?.find((candidate) => candidate.id === effect.id);
      if (!after) return [];
      return [{
        id: effect.id,
        before: structuredClone(effect),
        after: structuredClone(after),
        disposition: 'preserved',
      }];
    });
  return [...preserved, ...patched];
};

/**
 * Adapts the exact prepared patch into a human-readable topology preview. The
 * domain operation itself remains repairProjectTopology, called by the command
 * preparation boundary on a private clone.
 */
export const prepareTopologyRepair = (project: ProjectModel): TopologyRepairPreview => {
  const prepared = prepareTopologyRepairCommand(project);
  const splitMembers = buildSplitPreviews(project, prepared);
  const unresolvedTopology = buildModelDoctorReport(prepared.repairedProject).findings
    .filter((finding) => finding.sourceIssueId.startsWith('node-on-member-'));
  const mergedNodes = prepared.report.mergedNodes.flatMap((merge): TopologyNodeMergePreview[] => {
    const keptBefore = project.nodes.find((node) => node.id === merge.keptNodeId);
    const keptAfter = prepared.repairedProject.nodes.find((node) => node.id === merge.keptNodeId);
    const removed = project.nodes.find((node) => node.id === merge.removedNodeId);
    if (!keptBefore || !keptAfter || !removed) return [];
    return [{
      ...merge,
      keptBefore: structuredClone(keptBefore),
      keptAfter: structuredClone(keptAfter),
      removed: structuredClone(removed),
    }];
  });
  const seenSkippedPairs = new Set<string>();
  const skippedCoincidentPairs = prepared.report.skippedCoincidentPairs.filter((pair) => {
    const key = JSON.stringify([pair.firstNodeId, pair.secondNodeId]);
    if (seenSkippedPairs.has(key)) return false;
    seenSkippedPairs.add(key);
    return true;
  });

  return {
    prepared,
    hasChanges: prepared.forward.operations.length > 0,
    changes: {
      mergedNodes,
      splitMembers,
      nodes: operationsFor<NodeModel>(prepared.forward.operations, 'nodes'),
      members: operationsFor<MemberModel>(prepared.forward.operations, 'members'),
      nodalLoads: operationsFor<NodalLoad>(prepared.forward.operations, 'nodalLoads'),
      memberLoads: operationsFor<MemberLoad>(prepared.forward.operations, 'memberLoads'),
      prescribedDisplacements: operationsFor<PrescribedDisplacement>(prepared.forward.operations, 'prescribedDisplacements'),
      memberInitialEffects: buildInitialEffectChanges(project, prepared, splitMembers),
      skippedCoincidentPairs: structuredClone(skippedCoincidentPairs),
      unresolvedTopology,
    },
  };
};
