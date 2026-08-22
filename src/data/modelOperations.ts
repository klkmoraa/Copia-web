import type { MemberInitialEffect, MemberLoad, MemberModel, NodalLoad, NodeModel, PrescribedDisplacement, ProjectModel, Selection } from '../types';

/**
 * Primer ID libre de una familia. Se exporta para que toda ruta que cree
 * entidades —pegar, dividir, duplicar o insertar una geometría generada—
 * reparta identidad con exactamente la misma regla.
 */
export const nextEntityId = (prefix: string, ids: Iterable<string>): string => {
  const used = new Set(ids);
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
};

const nextId = nextEntityId;

const interpolate = (start: number, end: number, ratio: number) => start + (end - start) * ratio;

export const projectTopologyTolerance = (project: ProjectModel): number => {
  const finiteNodes = project.nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
  if (!finiteNodes.length) return 1e-9;
  const xs = finiteNodes.map((node) => node.x);
  const ys = finiteNodes.map((node) => node.y);
  const referenceLength = Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return referenceLength * 1e-9;
};

export const memberInteriorRatioAtPoint = (
  project: ProjectModel,
  member: MemberModel,
  point: { x: number; y: number },
  tolerance = projectTopologyTolerance(project),
): number | null => {
  const nodeI = project.nodes.find((node) => node.id === member.i);
  const nodeJ = project.nodes.find((node) => node.id === member.j);
  if (!nodeI || !nodeJ) return null;
  const dx = nodeJ.x - nodeI.x;
  const dy = nodeJ.y - nodeI.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!(lengthSquared > tolerance * tolerance)) return null;
  const ratio = ((point.x - nodeI.x) * dx + (point.y - nodeI.y) * dy) / lengthSquared;
  const length = Math.sqrt(lengthSquared);
  const endTolerance = Math.max(1e-8, tolerance / length);
  if (ratio <= endTolerance || ratio >= 1 - endTolerance) return null;
  const projectedX = nodeI.x + ratio * dx;
  const projectedY = nodeI.y + ratio * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY) <= tolerance ? ratio : null;
};

const supportHasStiffness = (node: NodeModel): boolean => {
  const spring = node.support.spring;
  return Boolean(spring && [spring.kx, spring.ky, spring.kr, spring.kNormal]
    .some((value) => Number.isFinite(value) && Math.abs(value ?? 0) > 0));
};

export const nodeHasStructuralActivity = (project: ProjectModel, node: NodeModel): boolean =>
  node.support.type !== 'none'
  || supportHasStiffness(node)
  || Boolean(node.internalHinge)
  || project.members.some((member) => member.i === node.id || member.j === node.id)
  || project.nodalLoads.some((load) => load.nodeId === node.id)
  || (project.prescribedDisplacements ?? []).some((item) => item.nodeId === node.id);

const distributedSlice = (
  load: MemberLoad,
  memberId: string,
  originalStart: number,
  originalEnd: number,
  childStart: number,
  childLength: number,
  id: string,
): MemberLoad => {
  const span = load.end - load.start;
  const at = (fieldStart = 0, fieldEnd = fieldStart, position: number) =>
    interpolate(fieldStart, fieldEnd, (position - load.start) / span);
  return {
    ...load,
    id,
    memberId,
    start: (originalStart - childStart) / childLength,
    end: (originalEnd - childStart) / childLength,
    qxStart: at(load.qxStart, load.qxEnd ?? load.qxStart, originalStart),
    qxEnd: at(load.qxStart, load.qxEnd ?? load.qxStart, originalEnd),
    qyStart: at(load.qyStart, load.qyEnd ?? load.qyStart, originalStart),
    qyEnd: at(load.qyStart, load.qyEnd ?? load.qyStart, originalEnd),
  };
};

export interface SplitMemberResult {
  nodeId: string;
  firstMemberId: string;
  secondMemberId: string;
}

export type ModelClipboard =
  | { kind: 'node'; node: NodeModel; nodalLoads: NodalLoad[]; prescribedDisplacements: PrescribedDisplacement[] }
  | { kind: 'member'; member: MemberModel; nodes: [NodeModel, NodeModel]; memberLoads: MemberLoad[]; initialEffects: MemberInitialEffect[] }
  | { kind: 'multi'; nodes: NodeModel[]; members: MemberModel[]; nodalLoads: NodalLoad[]; memberLoads: MemberLoad[]; prescribedDisplacements: PrescribedDisplacement[]; initialEffects: MemberInitialEffect[] };

type ModelSelection = Exclude<Selection, null>;
export type StructuralSelection = Exclude<ModelSelection, { kind: 'nodalLoad' } | { kind: 'memberLoad' }>;

export const structuralSelectionFromIds = (nodeIds: Iterable<string>, memberIds: Iterable<string>): Selection => {
  const nodes = [...new Set(nodeIds)];
  const members = [...new Set(memberIds)];
  if (nodes.length + members.length === 0) return null;
  if (nodes.length === 1 && members.length === 0) return { kind: 'node', id: nodes[0] };
  if (members.length === 1 && nodes.length === 0) return { kind: 'member', id: members[0] };
  return { kind: 'multi', nodeIds: nodes, memberIds: members };
};

export const toggleStructuralSelection = (selection: Selection, target: { kind: 'node' | 'member'; id: string }): Selection => {
  const nodeIds = new Set(selection?.kind === 'multi' ? selection.nodeIds : selection?.kind === 'node' ? [selection.id] : []);
  const memberIds = new Set(selection?.kind === 'multi' ? selection.memberIds : selection?.kind === 'member' ? [selection.id] : []);
  const set = target.kind === 'node' ? nodeIds : memberIds;
  if (set.has(target.id)) set.delete(target.id);
  else set.add(target.id);
  return structuralSelectionFromIds(nodeIds, memberIds);
};

/** Removes a structural selection and every dependent load, effect, and prescribed displacement. */
export const deleteStructuralSelection = (project: ProjectModel, selection: StructuralSelection): void => {
  const nodeIds = new Set(selection.kind === 'node' ? [selection.id] : selection.kind === 'multi' ? selection.nodeIds : []);
  const memberIds = new Set(selection.kind === 'member' ? [selection.id] : selection.kind === 'multi' ? selection.memberIds : []);
  for (const member of project.members) if (nodeIds.has(member.i) || nodeIds.has(member.j)) memberIds.add(member.id);

  project.nodes = project.nodes.filter((node) => !nodeIds.has(node.id));
  project.members = project.members.filter((member) => !memberIds.has(member.id));
  project.nodalLoads = project.nodalLoads.filter((load) => !nodeIds.has(load.nodeId));
  project.memberLoads = project.memberLoads.filter((load) => !memberIds.has(load.memberId));
  project.prescribedDisplacements = (project.prescribedDisplacements ?? []).filter((item) => !nodeIds.has(item.nodeId));
  project.memberInitialEffects = (project.memberInitialEffects ?? []).filter((effect) => !memberIds.has(effect.memberId));
};

/** Creates a detached, serializable snapshot of the selected structural object. */
export const copyModelSelection = (project: ProjectModel, selection: Selection): ModelClipboard | null => {
  if (!selection) return null;
  if (selection.kind === 'node') {
    const node = project.nodes.find((item) => item.id === selection.id);
    if (!node) return null;
    return structuredClone({
      kind: 'node' as const,
      node,
      nodalLoads: project.nodalLoads.filter((load) => load.nodeId === node.id),
      prescribedDisplacements: (project.prescribedDisplacements ?? []).filter((item) => item.nodeId === node.id),
    });
  }
  if (selection.kind === 'member') {
    const member = project.members.find((item) => item.id === selection.id);
    if (!member) return null;
    const nodeI = project.nodes.find((node) => node.id === member.i);
    const nodeJ = project.nodes.find((node) => node.id === member.j);
    if (!nodeI || !nodeJ) return null;
    return structuredClone({
      kind: 'member' as const,
      member,
      nodes: [nodeI, nodeJ] as [NodeModel, NodeModel],
      memberLoads: project.memberLoads.filter((load) => load.memberId === member.id),
      initialEffects: (project.memberInitialEffects ?? []).filter((effect) => effect.memberId === member.id),
    });
  }
  if (selection.kind === 'multi') {
    const memberIds = new Set(selection.memberIds);
    const members = project.members.filter((member) => memberIds.has(member.id));
    const nodeIds = new Set(selection.nodeIds);
    for (const member of members) { nodeIds.add(member.i); nodeIds.add(member.j); }
    const nodes = project.nodes.filter((node) => nodeIds.has(node.id));
    if (!nodes.length && !members.length) return null;
    return structuredClone({
      kind: 'multi' as const,
      nodes,
      members,
      nodalLoads: project.nodalLoads.filter((load) => nodeIds.has(load.nodeId)),
      memberLoads: project.memberLoads.filter((load) => memberIds.has(load.memberId)),
      prescribedDisplacements: (project.prescribedDisplacements ?? []).filter((item) => nodeIds.has(item.nodeId)),
      initialEffects: (project.memberInitialEffects ?? []).filter((effect) => memberIds.has(effect.memberId)),
    });
  }
  return null;
};

/** Pastes a clipboard snapshot with fresh IDs. Mutates the supplied draft. */
export const pasteModelClipboard = (
  project: ProjectModel,
  clipboard: ModelClipboard,
  offset: { x: number; y: number },
): ModelSelection => {
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) throw new Error('El desplazamiento de pegado debe ser finito.');
  if (clipboard.kind === 'node') {
    const nodeId = nextId('N', project.nodes.map((node) => node.id));
    project.nodes.push({ ...structuredClone(clipboard.node), id: nodeId, x: clipboard.node.x + offset.x, y: clipboard.node.y + offset.y });
    for (const source of clipboard.nodalLoads) {
      project.nodalLoads.push({
        ...structuredClone(source),
        id: nextId('NL', project.nodalLoads.map((load) => load.id)),
        nodeId,
      });
    }
    project.prescribedDisplacements ??= [];
    for (const source of clipboard.prescribedDisplacements) {
      project.prescribedDisplacements.push({ ...structuredClone(source), id: nextId('PD', project.prescribedDisplacements.map((item) => item.id)), nodeId });
    }
    return { kind: 'node', id: nodeId };
  }

  if (clipboard.kind === 'member') {
  const nodeIId = nextId('N', project.nodes.map((node) => node.id));
  const nodeJId = nextId('N', [...project.nodes.map((node) => node.id), nodeIId]);
  const [sourceI, sourceJ] = clipboard.nodes;
  project.nodes.push(
    { ...structuredClone(sourceI), id: nodeIId, x: sourceI.x + offset.x, y: sourceI.y + offset.y },
    { ...structuredClone(sourceJ), id: nodeJId, x: sourceJ.x + offset.x, y: sourceJ.y + offset.y },
  );
  const memberId = nextId('M', project.members.map((member) => member.id));
  project.members.push({ ...structuredClone(clipboard.member), id: memberId, i: nodeIId, j: nodeJId });
  for (const source of clipboard.memberLoads) {
    project.memberLoads.push({
      ...structuredClone(source),
      id: nextId('ML', project.memberLoads.map((load) => load.id)),
      memberId,
    });
  }
  project.memberInitialEffects ??= [];
  for (const source of clipboard.initialEffects) {
    project.memberInitialEffects.push({ ...structuredClone(source), id: nextId('IE', project.memberInitialEffects.map((effect) => effect.id)), memberId });
  }
  return { kind: 'member', id: memberId };
  }

  const nodeIdMap = new Map<string, string>();
  const pastedNodeIds: string[] = [];
  for (const source of clipboard.nodes) {
    const nodeId = nextId('N', [...project.nodes.map((node) => node.id), ...pastedNodeIds]);
    nodeIdMap.set(source.id, nodeId);
    pastedNodeIds.push(nodeId);
    project.nodes.push({ ...structuredClone(source), id: nodeId, x: source.x + offset.x, y: source.y + offset.y });
  }
  const pastedMemberIds: string[] = [];
  const memberIdMap = new Map<string, string>();
  for (const source of clipboard.members) {
    const i = nodeIdMap.get(source.i);
    const j = nodeIdMap.get(source.j);
    if (!i || !j) continue;
    const memberId = nextId('M', [...project.members.map((member) => member.id), ...pastedMemberIds]);
    memberIdMap.set(source.id, memberId);
    pastedMemberIds.push(memberId);
    project.members.push({ ...structuredClone(source), id: memberId, i, j });
  }
  for (const source of clipboard.nodalLoads) {
    const nodeId = nodeIdMap.get(source.nodeId);
    if (!nodeId) continue;
    project.nodalLoads.push({ ...structuredClone(source), id: nextId('NL', project.nodalLoads.map((load) => load.id)), nodeId });
  }
  for (const source of clipboard.memberLoads) {
    const memberId = memberIdMap.get(source.memberId);
    if (!memberId) continue;
    project.memberLoads.push({ ...structuredClone(source), id: nextId('ML', project.memberLoads.map((load) => load.id)), memberId });
  }
  project.prescribedDisplacements ??= [];
  for (const source of clipboard.prescribedDisplacements) {
    const nodeId = nodeIdMap.get(source.nodeId);
    if (!nodeId) continue;
    project.prescribedDisplacements.push({ ...structuredClone(source), id: nextId('PD', project.prescribedDisplacements.map((item) => item.id)), nodeId });
  }
  project.memberInitialEffects ??= [];
  for (const source of clipboard.initialEffects) {
    const memberId = memberIdMap.get(source.memberId);
    if (!memberId) continue;
    project.memberInitialEffects.push({ ...structuredClone(source), id: nextId('IE', project.memberInitialEffects.map((effect) => effect.id)), memberId });
  }
  return { kind: 'multi', nodeIds: pastedNodeIds, memberIds: pastedMemberIds };
};

/** Copies and pastes a selection in one pure, deterministic model operation. */
export const duplicateModelSelection = (
  project: ProjectModel,
  selection: Selection,
  offset: { x: number; y: number },
): ModelSelection | null => {
  const clipboard = copyModelSelection(project, selection);
  return clipboard ? pasteModelClipboard(project, clipboard, offset) : null;
};

/** Splits a member and conservatively remaps all member loads. Mutates the supplied draft. */
const splitMember = (project: ProjectModel, memberId: string, ratio: number, existingNodeId?: string): SplitMemberResult => {
  if (!(ratio > 1e-8 && ratio < 1 - 1e-8)) throw new Error('La división debe estar dentro del miembro.');
  const memberIndex = project.members.findIndex((member) => member.id === memberId);
  if (memberIndex < 0) throw new Error(`No existe el miembro ${memberId}.`);
  const original = project.members[memberIndex];
  if (original.type === 'rigid') throw new Error('Los vínculos rígidos no se dividen con esta herramienta.');
  const ni = project.nodes.find((node) => node.id === original.i);
  const nj = project.nodes.find((node) => node.id === original.j);
  if (!ni || !nj) throw new Error('El miembro referencia nodos inexistentes.');

  const dx = nj.x - ni.x;
  const dy = nj.y - ni.y;
  const length = Math.hypot(dx, dy);
  const c = dx / length;
  const s = dy / length;
  const startOffset = original.rigidOffsetI ?? 0;
  const endOffset = original.rigidOffsetJ ?? 0;
  const splitDistance = ratio * length;
  const flexibleLength = length - startOffset - endOffset;
  if (!(flexibleLength > 0)) throw new Error('El miembro no conserva una longitud flexible positiva.');
  if (splitDistance <= startOffset + 1e-10 * length || splitDistance >= length - endOffset - 1e-10 * length) {
    throw new Error('No se puede dividir dentro de una zona rígida de extremo.');
  }
  const flexibleRatio = (splitDistance - startOffset) / flexibleLength;

  const existingNode = existingNodeId ? project.nodes.find((node) => node.id === existingNodeId) : undefined;
  if (existingNodeId && !existingNode) throw new Error(`No existe el nodo ${existingNodeId}.`);
  if (existingNode && (existingNode.id === original.i || existingNode.id === original.j)) {
    throw new Error('El nodo ya es un extremo del miembro.');
  }
  const splitX = interpolate(ni.x, nj.x, ratio);
  const splitY = interpolate(ni.y, nj.y, ratio);
  if (existingNode && Math.hypot(existingNode.x - splitX, existingNode.y - splitY) > projectTopologyTolerance(project)) {
    throw new Error(`El nodo ${existingNode.id} no se encuentra sobre el miembro ${memberId}.`);
  }
  const nodeId = existingNode?.id ?? nextId('N', project.nodes.map((node) => node.id));
  const secondMemberId = nextId('M', project.members.map((member) => member.id));
  if (!existingNode) {
    project.nodes.push({ id: nodeId, x: splitX, y: splitY, support: { type: 'none' } });
  } else {
    existingNode.x = splitX;
    existingNode.y = splitY;
  }

  const first: MemberModel = {
    ...original,
    j: nodeId,
    releases: original.releases ? { iMoment: original.releases.iMoment } : undefined,
    rigidOffsetJ: 0,
    rotationalSpringJ: undefined,
  };
  const second: MemberModel = {
    ...original,
    id: secondMemberId,
    i: nodeId,
    releases: original.releases ? { jMoment: original.releases.jMoment } : undefined,
    rigidOffsetI: 0,
    rotationalSpringI: undefined,
  };
  project.members.splice(memberIndex, 1, first, second);

  const remapped: MemberLoad[] = [];
  for (const load of project.memberLoads) {
    if (load.memberId !== memberId) {
      remapped.push(load);
      continue;
    }
    if (load.type === 'distributed') {
      const leftStart = load.start;
      const leftEnd = Math.min(load.end, flexibleRatio);
      if (leftEnd - leftStart > 1e-12) {
        remapped.push(distributedSlice(load, first.id, leftStart, leftEnd, 0, flexibleRatio, load.id));
      }
      const rightStart = Math.max(load.start, flexibleRatio);
      const rightEnd = load.end;
      if (rightEnd - rightStart > 1e-12) {
        const id = leftEnd - leftStart > 1e-12
          ? nextId('ML', [...project.memberLoads, ...remapped].map((item) => item.id))
          : load.id;
        remapped.push(distributedSlice(load, second.id, rightStart, rightEnd, flexibleRatio, 1 - flexibleRatio, id));
      }
      continue;
    }
    const position = load.position ?? 0.5;
    if (Math.abs(position - flexibleRatio) <= 1e-10) {
      if (load.type === 'point') {
        let fx = load.px ?? 0;
        let fy = load.py ?? 0;
        if (load.coordinateSystem === 'local') [fx, fy] = [c * fx - s * fy, s * fx + c * fy];
        project.nodalLoads.push({ id: nextId('NL', project.nodalLoads.map((item) => item.id)), nodeId, caseId: load.caseId, fx, fy, mz: 0 });
      } else {
        project.nodalLoads.push({ id: nextId('NL', project.nodalLoads.map((item) => item.id)), nodeId, caseId: load.caseId, fx: 0, fy: 0, mz: load.moment ?? 0 });
      }
    } else if (position < flexibleRatio) {
      remapped.push({ ...load, memberId: first.id, position: position / flexibleRatio });
    } else {
      remapped.push({ ...load, memberId: second.id, position: (position - flexibleRatio) / (1 - flexibleRatio) });
    }
  }
  project.memberLoads = remapped;
  project.memberInitialEffects ??= [];
  const duplicatedEffects: MemberInitialEffect[] = [];
  for (const effect of project.memberInitialEffects) {
    if (effect.memberId !== memberId) continue;
    duplicatedEffects.push({ ...effect, id: nextId('IE', [...project.memberInitialEffects, ...duplicatedEffects].map((item) => item.id)), memberId: second.id });
  }
  project.memberInitialEffects.push(...duplicatedEffects);
  return { nodeId, firstMemberId: first.id, secondMemberId: second.id };
};

export const splitMemberAt = (project: ProjectModel, memberId: string, ratio: number): SplitMemberResult =>
  splitMember(project, memberId, ratio);

export const splitMemberAtNode = (project: ProjectModel, memberId: string, nodeId: string): SplitMemberResult => {
  const member = project.members.find((item) => item.id === memberId);
  const node = project.nodes.find((item) => item.id === nodeId);
  if (!member) throw new Error(`No existe el miembro ${memberId}.`);
  if (!node) throw new Error(`No existe el nodo ${nodeId}.`);
  const ratio = memberInteriorRatioAtPoint(project, member, node);
  if (ratio === null) throw new Error(`El nodo ${nodeId} no está dentro del miembro ${memberId}.`);
  return splitMember(project, memberId, ratio, nodeId);
};

const supportIsNeutral = (node: NodeModel): boolean => node.support.type === 'none' && !supportHasStiffness(node);

const supportsCanMerge = (first: NodeModel, second: NodeModel): boolean =>
  supportIsNeutral(first)
  || supportIsNeutral(second)
  || JSON.stringify(first.support) === JSON.stringify(second.support);

const connectionCount = (project: ProjectModel, nodeId: string): number =>
  project.members.reduce((count, member) => count + Number(member.i === nodeId || member.j === nodeId), 0);

export interface NodeMergeResult {
  keptNodeId: string;
  removedNodeId: string;
}

/** Safely merges coincident nodes and remaps every model reference. */
export const mergeCoincidentNodes = (project: ProjectModel, firstNodeId: string, secondNodeId: string): NodeMergeResult => {
  const first = project.nodes.find((node) => node.id === firstNodeId);
  const second = project.nodes.find((node) => node.id === secondNodeId);
  if (!first || !second) throw new Error('No se encontraron ambos nodos para unirlos.');
  if (first.id === second.id) throw new Error('Selecciona dos nodos distintos.');
  if (Math.hypot(first.x - second.x, first.y - second.y) > projectTopologyTolerance(project)) {
    throw new Error('Los nodos no son coincidentes.');
  }
  if (project.members.some((member) =>
    (member.i === first.id && member.j === second.id) || (member.i === second.id && member.j === first.id))) {
    throw new Error('Los nodos están unidos por un miembro que quedaría con longitud cero.');
  }
  if (!supportsCanMerge(first, second)) {
    throw new Error('Los nodos tienen apoyos o resortes incompatibles y deben revisarse manualmente.');
  }

  const firstConnections = connectionCount(project, first.id);
  const secondConnections = connectionCount(project, second.id);
  const keep = secondConnections > firstConnections ? second : first;
  const remove = keep.id === first.id ? second : first;
  if (supportIsNeutral(keep) && !supportIsNeutral(remove)) keep.support = structuredClone(remove.support);
  keep.internalHinge = Boolean(keep.internalHinge || remove.internalHinge) || undefined;

  for (const member of project.members) {
    if (member.i === remove.id) member.i = keep.id;
    if (member.j === remove.id) member.j = keep.id;
  }
  for (const load of project.nodalLoads) if (load.nodeId === remove.id) load.nodeId = keep.id;
  for (const displacement of project.prescribedDisplacements ?? []) {
    if (displacement.nodeId === remove.id) displacement.nodeId = keep.id;
  }
  project.nodes = project.nodes.filter((node) => node.id !== remove.id);
  return { keptNodeId: keep.id, removedNodeId: remove.id };
};

export interface TopologyRepairReport {
  mergedNodes: NodeMergeResult[];
  splitMembers: Array<SplitMemberResult & { originalMemberId: string }>;
  skippedCoincidentPairs: Array<{ firstNodeId: string; secondNodeId: string }>;
}

/**
 * Repairs only unambiguous topology: compatible coincident nodes are merged and
 * structurally active nodes lying on deformable members become real joints.
 */
export const repairProjectTopology = (project: ProjectModel): TopologyRepairReport => {
  const report: TopologyRepairReport = { mergedNodes: [], splitMembers: [], skippedCoincidentPairs: [] };
  let merged = true;
  while (merged) {
    merged = false;
    const tolerance = projectTopologyTolerance(project);
    for (let firstIndex = 0; firstIndex < project.nodes.length && !merged; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < project.nodes.length; secondIndex += 1) {
        const first = project.nodes[firstIndex];
        const second = project.nodes[secondIndex];
        if (Math.hypot(first.x - second.x, first.y - second.y) > tolerance) continue;
        try {
          report.mergedNodes.push(mergeCoincidentNodes(project, first.id, second.id));
          merged = true;
          break;
        } catch {
          report.skippedCoincidentPairs.push({ firstNodeId: first.id, secondNodeId: second.id });
        }
      }
    }
  }

  for (const node of [...project.nodes]) {
    if (!nodeHasStructuralActivity(project, node)) continue;
    for (const member of [...project.members]) {
      if (member.type === 'rigid' || member.i === node.id || member.j === node.id) continue;
      const ratio = memberInteriorRatioAtPoint(project, member, node);
      if (ratio === null) continue;
      try {
        const result = splitMember(project, member.id, ratio, node.id);
        report.splitMembers.push({ ...result, originalMemberId: member.id });
      } catch {
        // Ambiguous cases such as rigid offsets remain available to validation.
      }
    }
  }
  return report;
};

export interface EnsureNodeResult {
  nodeId: string;
  created: boolean;
  splitMemberId?: string;
}

export type MemberCreationTemplate = Omit<MemberModel, 'id' | 'i' | 'j'>;

export interface CreateMemberAtPointInput {
  startNodeId: string;
  point: { x: number; y: number };
  template: MemberCreationTemplate;
}

export interface CreateMemberAtPointResult {
  memberId: string;
  nodeId: string;
  created: boolean;
}

/** Reuses a coincident node or creates a connected joint when the point lies on a member. */
export const ensureNodeAtPoint = (project: ProjectModel, point: { x: number; y: number }): EnsureNodeResult => {
  const tolerance = projectTopologyTolerance(project);
  const existing = project.nodes.find((node) => Math.hypot(node.x - point.x, node.y - point.y) <= tolerance);
  if (existing) return { nodeId: existing.id, created: false };
  const containingMember = project.members.find((member) =>
    member.type !== 'rigid' && memberInteriorRatioAtPoint(project, member, point, tolerance) !== null);
  if (containingMember) {
    const ratio = memberInteriorRatioAtPoint(project, containingMember, point, tolerance)!;
    const result = splitMember(project, containingMember.id, ratio);
    const createdNode = project.nodes.find((node) => node.id === result.nodeId)!;
    for (const member of [...project.members]) {
      if (member.type === 'rigid' || member.i === createdNode.id || member.j === createdNode.id) continue;
      const crossingRatio = memberInteriorRatioAtPoint(project, member, createdNode, tolerance);
      if (crossingRatio !== null) splitMember(project, member.id, crossingRatio, createdNode.id);
    }
    return { nodeId: result.nodeId, created: true, splitMemberId: containingMember.id };
  }
  const nodeId = nextId('N', project.nodes.map((node) => node.id));
  project.nodes.push({ id: nodeId, ...point, support: { type: 'none' } });
  return { nodeId, created: true };
};

/** Creates one member intention while keeping endpoint topology inside the domain boundary. */
export const createMemberAtPoint = (project: ProjectModel, input: CreateMemberAtPointInput): CreateMemberAtPointResult => {
  const start = project.nodes.find((node) => node.id === input.startNodeId);
  if (!start) throw new Error(`No existe el nodo ${input.startNodeId}.`);
  if (Math.hypot(input.point.x - start.x, input.point.y - start.y) <= 1e-10) {
    throw new Error('Los extremos del miembro deben estar separados.');
  }

  const endpoint = ensureNodeAtPoint(project, input.point);
  const existing = project.members.find((member) =>
    (member.i === start.id && member.j === endpoint.nodeId)
    || (member.i === endpoint.nodeId && member.j === start.id));
  if (existing) return { memberId: existing.id, nodeId: endpoint.nodeId, created: false };

  const memberId = nextId('M', project.members.map((member) => member.id));
  project.members.push({
    id: memberId,
    i: start.id,
    j: endpoint.nodeId,
    ...structuredClone(input.template),
  });
  return { memberId, nodeId: endpoint.nodeId, created: true };
};
