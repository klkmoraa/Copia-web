import type { ProjectModel, Selection } from '../types';
import { copyModelSelection, pasteModelClipboard } from './modelOperations';

export interface Point2D {
  x: number;
  y: number;
}

export interface StructuralSelectionResolution {
  nodeIds: string[];
  selectedMemberIds: string[];
  affectedMemberIds: string[];
}

export type StructuralAlignment = 'min-x' | 'max-x' | 'center-x' | 'min-y' | 'max-y' | 'center-y';

export type StructuralEditRequest =
  | { kind: 'move'; selection: Selection; delta: Point2D }
  | { kind: 'rotate'; selection: Selection; center: Point2D; angleDeg: number }
  | {
    kind: 'mirror';
    selection: Selection;
    mode: 'transform' | 'copy';
    axis: { start: Point2D; end: Point2D };
  }
  | {
    kind: 'linear-array';
    selection: Selection;
    direction: Point2D;
    spacing: number;
    /** Total number of instances, including the unchanged source. */
    count: number;
  }
  | { kind: 'align'; selection: Selection; alignment: StructuralAlignment }
  | { kind: 'distribute'; selection: Selection; axis: 'x' | 'y' };

export interface PreparedStructuralEdit {
  readonly kind: StructuralEditRequest['kind'];
  readonly description: string;
  readonly request: StructuralEditRequest;
  readonly previewProject: ProjectModel;
  readonly affectedNodeIds: readonly string[];
  readonly affectedMemberIds: readonly string[];
  readonly createdNodeIds: readonly string[];
  readonly createdMemberIds: readonly string[];
  readonly hasChanges: boolean;
  /** Exact, undefined-aware precondition for rejecting stale previews. */
  readonly sourceSnapshot: string;
  /** Exact, undefined-aware result shown by the preview. */
  readonly previewSnapshot: string;
}

/**
 * Lightweight geometry used while a pointer gesture is still in flight. It is
 * deliberately not a ProjectModel: it cannot be persisted, analyzed, or
 * mistaken for a committed structural state.
 */
export interface StructuralEditGeometryPreview {
  readonly kind: StructuralEditRequest['kind'];
  readonly request: StructuralEditRequest;
  readonly nodes: readonly {
    key: string;
    sourceNodeId: string;
    x: number;
    y: number;
    created: boolean;
  }[];
  readonly members: readonly {
    key: string;
    sourceMemberId: string;
    iKey: string;
    jKey: string;
    created: boolean;
  }[];
  readonly affectedNodeIds: readonly string[];
  readonly affectedMemberIds: readonly string[];
  readonly createdNodeCount: number;
  readonly createdMemberCount: number;
  readonly hasChanges: boolean;
}

const MAX_LINEAR_ARRAY_COUNT = 500;
/**
 * Pasting assigns durable IDs against the growing project. Bound the complete
 * copied closure, not only the number of array instances, so a large source
 * selection cannot stall preview, persistence, or a single undo snapshot.
 */
const MAX_REPLICATED_ENTITIES = 2_000;
const COORDINATE_EPSILON = 1e-12;

const assertFinite = (value: number, label: string) => {
  if (!Number.isFinite(value)) throw new Error(`${label} debe ser finito.`);
};

const assertPoint = (point: Point2D, label: string) => {
  assertFinite(point.x, `${label} X`);
  assertFinite(point.y, `${label} Y`);
};

/** Removes floating noise around exact zero/integer cardinal results. */
export const cleanCoordinate = (value: number): number => {
  if (Math.abs(value) <= COORDINATE_EPSILON) return 0;
  const integer = Math.round(value);
  return Math.abs(value - integer) <= COORDINATE_EPSILON ? integer : value;
};

export const translatePoint = (point: Point2D, delta: Point2D): Point2D => {
  assertPoint(point, 'El punto');
  assertPoint(delta, 'El desplazamiento');
  return { x: cleanCoordinate(point.x + delta.x), y: cleanCoordinate(point.y + delta.y) };
};

/** Rotates a point counter-clockwise around an explicit center. */
export const rotatePoint = (point: Point2D, center: Point2D, angleDeg: number): Point2D => {
  assertPoint(point, 'El punto');
  assertPoint(center, 'El centro');
  assertFinite(angleDeg, 'El ángulo');
  const radians = angleDeg * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: cleanCoordinate(center.x + dx * cosine - dy * sine),
    y: cleanCoordinate(center.y + dx * sine + dy * cosine),
  };
};

/** Reflects a point across the infinite line defined by two distinct points. */
export const reflectPointAcrossLine = (point: Point2D, start: Point2D, end: Point2D): Point2D => {
  assertPoint(point, 'El punto');
  assertPoint(start, 'El inicio del eje');
  assertPoint(end, 'El final del eje');
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!(lengthSquared > COORDINATE_EPSILON * COORDINATE_EPSILON)) {
    throw new Error('El eje de reflexión requiere dos puntos distintos.');
  }
  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const projectedX = start.x + projection * dx;
  const projectedY = start.y + projection * dy;
  return {
    x: cleanCoordinate(2 * projectedX - point.x),
    y: cleanCoordinate(2 * projectedY - point.y),
  };
};

const snapshotReplacer = (_key: string, value: unknown) => value === undefined
  ? { __structureCoStructuralEditUndefined: true }
  : value;

export const structuralEditSnapshot = (project: ProjectModel): string => JSON.stringify(project, snapshotReplacer);

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
};

const assertUniqueIds = (label: string, values: readonly { id: string }[]) => {
  const used = new Set<string>();
  for (const item of values) {
    if (!item.id) throw new Error(`${label}: existe un ID vacío.`);
    if (used.has(item.id)) throw new Error(`${label}: ID duplicado ${item.id}.`);
    used.add(item.id);
  }
};

/**
 * Mutation-boundary validation for structural editing. It deliberately checks
 * identity and references, not stability/solvability; those remain engine concerns.
 */
export const validateStructuralEditBoundary = (project: ProjectModel): void => {
  assertUniqueIds('Nodos', project.nodes);
  assertUniqueIds('Miembros', project.members);
  assertUniqueIds('Casos de carga', project.loadCases);
  assertUniqueIds('Combinaciones', project.combinations);
  assertUniqueIds('Cargas nodales', project.nodalLoads);
  assertUniqueIds('Cargas de miembro', project.memberLoads);
  assertUniqueIds('Desplazamientos prescritos', project.prescribedDisplacements ?? []);
  assertUniqueIds('Efectos iniciales', project.memberInitialEffects ?? []);

  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const memberIds = new Set(project.members.map((member) => member.id));
  const caseIds = new Set(project.loadCases.map((loadCase) => loadCase.id));

  for (const node of project.nodes) assertPoint(node, `El nodo ${node.id}`);
  for (const member of project.members) {
    const start = nodeById.get(member.i);
    const end = nodeById.get(member.j);
    if (!start) throw new Error(`El miembro ${member.id} referencia el nodo inexistente ${member.i}.`);
    if (!end) throw new Error(`El miembro ${member.id} referencia el nodo inexistente ${member.j}.`);
    if (member.i === member.j) throw new Error(`El miembro ${member.id} no puede usar el mismo nodo en ambos extremos.`);
    const reference = Math.max(1, Math.abs(start.x), Math.abs(start.y), Math.abs(end.x), Math.abs(end.y));
    if (!(Math.hypot(end.x - start.x, end.y - start.y) > reference * 1e-10)) {
      throw new Error(`El miembro ${member.id} quedaría con longitud cero.`);
    }
    // Keep the catalog identity contract symmetric with ProjectCommand and
    // migration: catalog provenance must have its durable key, and an explicit
    // key must retain provenance rather than being silently downgraded.
    if (member.materialOrigin === 'catalog' && !member.materialId) {
      throw new Error(`El miembro ${member.id} declara material de catálogo sin materialId.`);
    }
    if (member.sectionOrigin === 'catalog' && !member.sectionId) {
      throw new Error(`El miembro ${member.id} declara sección de catálogo sin sectionId.`);
    }
    if (member.materialId && !member.materialOrigin) {
      throw new Error(`El miembro ${member.id} tiene materialId sin materialOrigin.`);
    }
    if (member.sectionId && !member.sectionOrigin) {
      throw new Error(`El miembro ${member.id} tiene sectionId sin sectionOrigin.`);
    }
  }

  const assertCase = (caseId: string, owner: string) => {
    if (!caseIds.has(caseId)) throw new Error(`${owner} referencia el caso inexistente ${caseId}.`);
  };
  for (const load of project.nodalLoads) {
    if (!nodeById.has(load.nodeId)) throw new Error(`La carga nodal ${load.id} referencia el nodo inexistente ${load.nodeId}.`);
    assertCase(load.caseId, `La carga nodal ${load.id}`);
  }
  for (const item of project.prescribedDisplacements ?? []) {
    if (!nodeById.has(item.nodeId)) throw new Error(`El desplazamiento prescrito ${item.id} referencia el nodo inexistente ${item.nodeId}.`);
    assertCase(item.caseId, `El desplazamiento prescrito ${item.id}`);
  }
  for (const load of project.memberLoads) {
    if (!memberIds.has(load.memberId)) throw new Error(`La carga ${load.id} referencia el miembro inexistente ${load.memberId}.`);
    assertCase(load.caseId, `La carga ${load.id}`);
  }
  for (const effect of project.memberInitialEffects ?? []) {
    if (!memberIds.has(effect.memberId)) throw new Error(`El efecto inicial ${effect.id} referencia el miembro inexistente ${effect.memberId}.`);
    assertCase(effect.caseId, `El efecto inicial ${effect.id}`);
  }
  for (const combination of project.combinations) {
    for (const caseId of Object.keys(combination.factors)) assertCase(caseId, `La combinación ${combination.id}`);
  }
};

export const resolveStructuralSelection = (
  project: ProjectModel,
  selection: Selection,
): StructuralSelectionResolution => {
  if (!selection || selection.kind === 'nodalLoad' || selection.kind === 'memberLoad') {
    throw new Error('La operación requiere una selección estructural de nodos o miembros.');
  }

  const requestedNodeIds = new Set<string>();
  const requestedMemberIds = new Set<string>();
  if (selection.kind === 'node') requestedNodeIds.add(selection.id);
  else if (selection.kind === 'member') requestedMemberIds.add(selection.id);
  else {
    for (const nodeId of selection.nodeIds) requestedNodeIds.add(nodeId);
    for (const memberId of selection.memberIds) requestedMemberIds.add(memberId);
  }
  if (!requestedNodeIds.size && !requestedMemberIds.size) throw new Error('La selección estructural está vacía.');

  const projectNodeIds = new Set(project.nodes.map((node) => node.id));
  const projectMemberIds = new Set(project.members.map((member) => member.id));
  for (const nodeId of requestedNodeIds) {
    if (!projectNodeIds.has(nodeId)) throw new Error(`No existe el nodo ${nodeId}.`);
  }
  for (const memberId of requestedMemberIds) {
    if (!projectMemberIds.has(memberId)) throw new Error(`No existe el miembro ${memberId}.`);
  }
  for (const member of project.members) {
    if (!requestedMemberIds.has(member.id)) continue;
    requestedNodeIds.add(member.i);
    requestedNodeIds.add(member.j);
  }

  const nodeIds = project.nodes.filter((node) => requestedNodeIds.has(node.id)).map((node) => node.id);
  const selectedMemberIds = project.members.filter((member) => requestedMemberIds.has(member.id)).map((member) => member.id);
  const affectedMemberIds = project.members
    .filter((member) => requestedNodeIds.has(member.i) || requestedNodeIds.has(member.j))
    .map((member) => member.id);
  return { nodeIds, selectedMemberIds, affectedMemberIds };
};

const assertNodeOnlyTargets = (
  project: ProjectModel,
  selection: Selection,
  minimum: number,
  operation: string,
): StructuralSelectionResolution => {
  if (!selection || selection.kind !== 'multi' || selection.memberIds.length > 0) {
    throw new Error(`${operation} sólo admite una selección múltiple de nodos.`);
  }
  const resolved = resolveStructuralSelection(project, selection);
  if (resolved.selectedMemberIds.length > 0 || resolved.nodeIds.length < minimum) {
    const count = minimum === 2 ? 'dos' : 'tres';
    throw new Error(`${operation} requiere al menos ${count} nodos.`);
  }
  return resolved;
};

type NodePoint = Point2D & { id: string };
type NodeTransform = (point: NodePoint) => Point2D;

type StructuralEditPlan =
  | {
    mode: 'transform';
    resolved: StructuralSelectionResolution;
    transform: NodeTransform;
  }
  | {
    mode: 'replicate';
    resolved: StructuralSelectionResolution;
    transforms: readonly NodeTransform[];
  };

const assertReplicationBudget = (
  project: ProjectModel,
  resolved: StructuralSelectionResolution,
  copyCount: number,
): void => {
  const nodeIds = new Set(resolved.nodeIds);
  const memberIds = new Set(resolved.selectedMemberIds);
  const entitiesPerCopy = nodeIds.size
    + memberIds.size
    + project.nodalLoads.filter((load) => nodeIds.has(load.nodeId)).length
    + project.memberLoads.filter((load) => memberIds.has(load.memberId)).length
    + (project.prescribedDisplacements ?? []).filter((item) => nodeIds.has(item.nodeId)).length
    + (project.memberInitialEffects ?? []).filter((item) => memberIds.has(item.memberId)).length;
  const total = entitiesPerCopy * copyCount;
  if (total > MAX_REPLICATED_ENTITIES) {
    throw new Error(
      `La operaciÃ³n crearÃ­a ${total.toLocaleString('es-MX')} entidades; el lÃ­mite de una vista previa es ${MAX_REPLICATED_ENTITIES.toLocaleString('es-MX')}. Reduce la selecciÃ³n o la cantidad.`,
    );
  }
};

const assertAlignment = (alignment: StructuralAlignment): void => {
  if (!['min-x', 'max-x', 'center-x', 'min-y', 'max-y', 'center-y'].includes(alignment)) {
    throw new Error('La regla de alineación no es válida.');
  }
};

const compileStructuralEditPlan = (
  project: ProjectModel,
  request: StructuralEditRequest,
): StructuralEditPlan => {
  if (request.kind === 'align') {
    assertAlignment(request.alignment);
    const resolved = assertNodeOnlyTargets(project, request.selection, 2, 'Alinear');
    const nodeIds = new Set(resolved.nodeIds);
    const nodes = project.nodes.filter((node) => nodeIds.has(node.id));
    const axis = request.alignment.endsWith('x') ? 'x' : 'y';
    const values = nodes.map((node) => node[axis]);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const target = request.alignment.startsWith('min')
      ? minimum
      : request.alignment.startsWith('max')
        ? maximum
        : (minimum + maximum) / 2;
    return {
      mode: 'transform',
      resolved,
      transform: (point) => ({ ...point, [axis]: cleanCoordinate(target) }),
    };
  }

  if (request.kind === 'distribute') {
    if (request.axis !== 'x' && request.axis !== 'y') throw new Error('El eje de distribución no es válido.');
    const resolved = assertNodeOnlyTargets(project, request.selection, 3, 'Distribuir');
    const selected = new Set(resolved.nodeIds);
    const secondary = request.axis === 'x' ? 'y' : 'x';
    const nodes = project.nodes
      .filter((node) => selected.has(node.id))
      .sort((first, secondNode) => first[request.axis] - secondNode[request.axis]
        || first[secondary] - secondNode[secondary]
        || first.id.localeCompare(secondNode.id));
    const minimum = nodes[0][request.axis];
    const maximum = nodes.at(-1)![request.axis];
    if (!(maximum - minimum > COORDINATE_EPSILON)) {
      throw new Error(`Distribuir requiere un rango ${request.axis.toUpperCase()} no degenerado.`);
    }
    const coordinates = new Map(nodes.map((node, index) => [
      node.id,
      cleanCoordinate(minimum + index * (maximum - minimum) / (nodes.length - 1)),
    ]));
    return {
      mode: 'transform',
      resolved,
      transform: (point) => ({ ...point, [request.axis]: coordinates.get(point.id) ?? point[request.axis] }),
    };
  }

  const resolved = resolveStructuralSelection(project, request.selection);
  if (request.kind === 'move') {
    assertPoint(request.delta, 'El desplazamiento');
    return { mode: 'transform', resolved, transform: (point) => translatePoint(point, request.delta) };
  }

  if (request.kind === 'rotate') {
    assertPoint(request.center, 'El centro');
    assertFinite(request.angleDeg, 'El ángulo');
    return { mode: 'transform', resolved, transform: (point) => rotatePoint(point, request.center, request.angleDeg) };
  }

  if (request.kind === 'mirror') {
    if (request.mode !== 'transform' && request.mode !== 'copy') throw new Error('El modo de reflexión no es válido.');
    // Validate the axis even when every selected point happens to lie on it.
    reflectPointAcrossLine(request.axis.start, request.axis.start, request.axis.end);
    const reflect: NodeTransform = (point) => reflectPointAcrossLine(point, request.axis.start, request.axis.end);
    if (request.mode === 'transform') return { mode: 'transform', resolved, transform: reflect };
    assertReplicationBudget(project, resolved, 1);
    return { mode: 'replicate', resolved, transforms: [reflect] };
  }

  assertPoint(request.direction, 'La dirección');
  assertFinite(request.spacing, 'El espaciamiento');
  assertFinite(request.count, 'La cantidad');
  const directionLength = Math.hypot(request.direction.x, request.direction.y);
  if (!(directionLength > COORDINATE_EPSILON)) throw new Error('La dirección de la matriz no puede ser un vector nulo.');
  if (!(request.spacing > 0)) throw new Error('El espaciamiento de la matriz debe ser mayor que cero.');
  if (!Number.isInteger(request.count) || request.count < 2) {
    throw new Error('La cantidad total de instancias debe ser un entero mayor o igual que 2.');
  }
  if (request.count > MAX_LINEAR_ARRAY_COUNT) {
    throw new Error(`La matriz admite hasta ${MAX_LINEAR_ARRAY_COUNT} instancias por operación.`);
  }
  const step = {
    x: request.direction.x / directionLength * request.spacing,
    y: request.direction.y / directionLength * request.spacing,
  };
  const transforms = Array.from({ length: request.count - 1 }, (_, index) => {
    const multiplier = index + 1;
    return (point: NodePoint) => translatePoint(point, { x: step.x * multiplier, y: step.y * multiplier });
  });
  assertReplicationBudget(project, resolved, transforms.length);
  return {
    mode: 'replicate',
    resolved,
    transforms,
  };
};

const transformNodes = (
  project: ProjectModel,
  nodeIds: readonly string[],
  transform: NodeTransform,
): ProjectModel => {
  const selected = new Set(nodeIds);
  const preview = structuredClone(project);
  for (const node of preview.nodes) {
    if (!selected.has(node.id)) continue;
    const transformed = transform(node);
    assertPoint(transformed, `La coordenada transformada de ${node.id}`);
    node.x = transformed.x;
    node.y = transformed.y;
  }
  return preview;
};

const assertTransformedMemberLengths = (
  project: ProjectModel,
  memberIds: readonly string[],
  transformedNodes: readonly { sourceNodeId: string; x: number; y: number }[],
): void => {
  const nodeById = new Map(project.nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
  for (const node of transformedNodes) nodeById.set(node.sourceNodeId, { x: node.x, y: node.y });
  const selectedMembers = new Set(memberIds);
  for (const member of project.members) {
    if (!selectedMembers.has(member.id)) continue;
    const start = nodeById.get(member.i);
    const end = nodeById.get(member.j);
    if (!start || !end) throw new Error(`El miembro ${member.id} referencia un nodo inexistente.`);
    const reference = Math.max(1, Math.abs(start.x), Math.abs(start.y), Math.abs(end.x), Math.abs(end.y));
    if (!(Math.hypot(end.x - start.x, end.y - start.y) > reference * 1e-10)) {
      throw new Error(`El miembro ${member.id} quedaría con longitud cero.`);
    }
  }
};

const clipboardSourceNodes = (clipboard: NonNullable<ReturnType<typeof copyModelSelection>>) => {
  if (clipboard.kind === 'node') return [clipboard.node];
  return clipboard.kind === 'member' ? clipboard.nodes : clipboard.nodes;
};

const replicateSelection = (
  project: ProjectModel,
  resolved: StructuralSelectionResolution,
  transforms: readonly NodeTransform[],
) => {
  const preview = structuredClone(project);
  // Always use the multi closure so a member copy also carries endpoint nodal
  // loads and prescribed displacements, matching multi-copy reference safety.
  const normalizedSelection: Selection = {
    kind: 'multi',
    nodeIds: [...resolved.nodeIds],
    memberIds: [...resolved.selectedMemberIds],
  };
  const clipboard = copyModelSelection(project, normalizedSelection);
  if (!clipboard) throw new Error('No se pudo preparar una copia de la selección estructural.');
  const sourceNodes = clipboardSourceNodes(clipboard);
  const createdNodeIds: string[] = [];
  const createdMemberIds: string[] = [];

  for (const transform of transforms) {
    const nodeStart = preview.nodes.length;
    const memberStart = preview.members.length;
    pasteModelClipboard(preview, clipboard, { x: 0, y: 0 });
    const nodes = preview.nodes.slice(nodeStart);
    if (nodes.length !== sourceNodes.length) throw new Error('La copia no conservó la clausura de nodos preparada.');
    nodes.forEach((node, index) => {
      const transformed = transform(sourceNodes[index]);
      assertPoint(transformed, `La coordenada copiada de ${node.id}`);
      node.x = transformed.x;
      node.y = transformed.y;
      createdNodeIds.push(node.id);
    });
    createdMemberIds.push(...preview.members.slice(memberStart).map((member) => member.id));
  }
  return { preview, createdNodeIds, createdMemberIds };
};

const operationDescription: Record<StructuralEditRequest['kind'], string> = {
  move: 'Mover selección',
  rotate: 'Rotar selección',
  mirror: 'Reflejar selección',
  'linear-array': 'Crear matriz lineal',
  align: 'Alinear nodos',
  distribute: 'Distribuir nodos',
};

const createPrepared = (
  project: ProjectModel,
  request: StructuralEditRequest,
  previewProject: ProjectModel,
  affectedNodeIds: readonly string[],
  affectedMemberIds: readonly string[],
  createdNodeIds: readonly string[] = [],
  createdMemberIds: readonly string[] = [],
): PreparedStructuralEdit => {
  validateStructuralEditBoundary(previewProject);
  const sourceSnapshot = structuralEditSnapshot(project);
  const previewSnapshot = structuralEditSnapshot(previewProject);
  const prepared: PreparedStructuralEdit = {
    kind: request.kind,
    description: operationDescription[request.kind],
    request: structuredClone(request),
    previewProject: structuredClone(previewProject),
    affectedNodeIds: [...affectedNodeIds],
    affectedMemberIds: [...affectedMemberIds],
    createdNodeIds: [...createdNodeIds],
    createdMemberIds: [...createdMemberIds],
    hasChanges: sourceSnapshot !== previewSnapshot,
    sourceSnapshot,
    previewSnapshot,
  };
  return deepFreeze(prepared);
};

export const prepareStructuralEdit = (
  project: ProjectModel,
  request: StructuralEditRequest,
): PreparedStructuralEdit => {
  validateStructuralEditBoundary(project);
  const plan = compileStructuralEditPlan(project, request);
  if (plan.mode === 'transform') {
    const preview = transformNodes(project, plan.resolved.nodeIds, plan.transform);
    return createPrepared(project, request, preview, plan.resolved.nodeIds, plan.resolved.affectedMemberIds);
  }
  const replicated = replicateSelection(project, plan.resolved, plan.transforms);
  return createPrepared(
    project,
    request,
    replicated.preview,
    plan.resolved.nodeIds,
    plan.resolved.affectedMemberIds,
    replicated.createdNodeIds,
    replicated.createdMemberIds,
  );
};

/**
 * Builds only the ghost geometry needed during a pointer gesture. The exact
 * same compiled plan is later expanded to a ProjectModel by
 * {@link prepareStructuralEdit}; no React component owns transformation math.
 */
export const createStructuralEditGeometryPreview = (
  project: ProjectModel,
  request: StructuralEditRequest,
): StructuralEditGeometryPreview => {
  const plan = compileStructuralEditPlan(project, request);
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const memberById = new Map(project.members.map((member) => [member.id, member]));

  if (plan.mode === 'transform') {
    const nodes = plan.resolved.nodeIds.map((id) => {
      const source = nodeById.get(id);
      if (!source) throw new Error(`No existe el nodo ${id}.`);
      const point = plan.transform(source);
      assertPoint(point, `La coordenada transformada de ${id}`);
      return { key: id, sourceNodeId: id, x: point.x, y: point.y, created: false };
    });
    const members = plan.resolved.affectedMemberIds.map((id) => {
      const source = memberById.get(id);
      if (!source) throw new Error(`No existe el miembro ${id}.`);
      return { key: id, sourceMemberId: id, iKey: source.i, jKey: source.j, created: false };
    });
    assertTransformedMemberLengths(project, plan.resolved.affectedMemberIds, nodes);
    const hasChanges = nodes.some((node) => {
      const source = nodeById.get(node.sourceNodeId)!;
      return node.x !== source.x || node.y !== source.y;
    });
    return {
      kind: request.kind,
      request: structuredClone(request),
      nodes,
      members,
      affectedNodeIds: [...plan.resolved.nodeIds],
      affectedMemberIds: [...plan.resolved.affectedMemberIds],
      createdNodeCount: 0,
      createdMemberCount: 0,
      hasChanges,
    };
  }

  const nodes: StructuralEditGeometryPreview['nodes'][number][] = [];
  const members: StructuralEditGeometryPreview['members'][number][] = [];
  plan.transforms.forEach((transform, copyIndex) => {
    const keyFor = (nodeId: string) => `structural-edit-copy-${copyIndex + 1}-${nodeId}`;
    for (const nodeId of plan.resolved.nodeIds) {
      const source = nodeById.get(nodeId);
      if (!source) throw new Error(`No existe el nodo ${nodeId}.`);
      const point = transform(source);
      assertPoint(point, `La coordenada copiada de ${nodeId}`);
      nodes.push({ key: keyFor(nodeId), sourceNodeId: nodeId, x: point.x, y: point.y, created: true });
    }
    for (const memberId of plan.resolved.selectedMemberIds) {
      const source = memberById.get(memberId);
      if (!source) throw new Error(`No existe el miembro ${memberId}.`);
      members.push({
        key: `structural-edit-copy-${copyIndex + 1}-${memberId}`,
        sourceMemberId: memberId,
        iKey: keyFor(source.i),
        jKey: keyFor(source.j),
        created: true,
      });
    }
  });
  return {
    kind: request.kind,
    request: structuredClone(request),
    nodes,
    members,
    affectedNodeIds: [...plan.resolved.nodeIds],
    affectedMemberIds: [...plan.resolved.affectedMemberIds],
    createdNodeCount: nodes.length,
    createdMemberCount: members.length,
    hasChanges: nodes.length > 0 || members.length > 0,
  };
};

/** Applies exactly the validated project shown by the prepared preview. */
export const applyPreparedStructuralEdit = (
  current: ProjectModel,
  prepared: PreparedStructuralEdit,
): ProjectModel => {
  if (structuralEditSnapshot(current) !== prepared.sourceSnapshot) {
    throw new Error('La vista previa quedó obsoleta porque el proyecto cambió. Vuelve a preparar la operación.');
  }
  if (structuralEditSnapshot(prepared.previewProject) !== prepared.previewSnapshot) {
    throw new Error('La vista previa preparada fue alterada y no puede aplicarse.');
  }
  const recomputed = prepareStructuralEdit(current, structuredClone(prepared.request));
  if (recomputed.previewSnapshot !== prepared.previewSnapshot) {
    throw new Error('La vista previa ya no coincide con la operación estructural preparada.');
  }
  const applied = structuredClone(prepared.previewProject);
  validateStructuralEditBoundary(applied);
  return applied;
};
