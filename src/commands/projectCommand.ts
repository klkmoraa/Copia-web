import { placeGeneratedStructure } from '../data/generators/generatorPlacement';
import { generateStructure } from '../data/generators/structureGenerators';
import type { GeneratorParams } from '../data/generators/generatorTypes';
import {
  createMemberAtPoint,
  deleteStructuralSelection,
  duplicateModelSelection,
  repairProjectTopology,
  splitMemberAt,
  type MemberCreationTemplate,
  type TopologyRepairReport,
} from '../data/modelOperations';
import type {
  LoadCoordinateSystem,
  LoadLengthBasis,
  MemberInitialEffect,
  MemberLoad,
  MemberModel,
  NodalLoad,
  NodeModel,
  PrescribedDisplacement,
  ProjectModel,
  Selection,
  SupportDefinition,
} from '../types';

type ProjectEntity = NodeModel | MemberModel | NodalLoad | MemberLoad | PrescribedDisplacement | MemberInitialEffect;
export type ProjectEntityCollection = 'nodes' | 'members' | 'nodalLoads' | 'memberLoads' | 'prescribedDisplacements' | 'memberInitialEffects';

export interface ProjectPatchOperation {
  collection: ProjectEntityCollection;
  id: string;
  index: number;
  before: ProjectEntity | null;
  after: ProjectEntity | null;
}

export interface ProjectPatch {
  description: string;
  operations: ProjectPatchOperation[];
}

interface CommandBase { description: string }

/**
 * Cambios preparados de una edición múltiple sobre miembros.
 *
 * Una propiedad ausente es «sin tocar» y no se escribe jamás; `null` la borra
 * explícitamente. Esa distinción es el contrato completo de la operación: un
 * valor mixto que el usuario no editó nunca llega hasta aquí.
 *
 * `materialId` y `sectionId` sólo aceptan una identidad de catálogo y viajan con
 * las propiedades numéricas que esa identidad implica, igual que
 * `member.material.apply` / `member.section.apply`. Escribir E, G o densidad por
 * separado degrada el material a `custom`; escribir A o I degrada la sección.
 */
export interface MemberBulkChanges {
  type?: MemberModel['type'];
  material?: {
    materialId: string;
    properties: Pick<MemberModel, 'E'> & Pick<Partial<MemberModel>, 'G' | 'density'>;
  };
  section?: {
    sectionId: string;
    properties: Pick<MemberModel, 'A' | 'I'>;
  };
  E?: number;
  A?: number;
  I?: number;
  G?: number | null;
  shearArea?: number | null;
  density?: number | null;
  beamTheory?: MemberModel['beamTheory'] | null;
  iMoment?: boolean | null;
  jMoment?: boolean | null;
  rotationalSpringI?: number | null;
  rotationalSpringJ?: number | null;
  rigidOffsetI?: number | null;
  rigidOffsetJ?: number | null;
}

export interface MemberBulkEntry {
  /** Miembros que reciben exactamente este conjunto de cambios. */
  readonly memberIds: readonly string[];
  readonly changes: MemberBulkChanges;
}

/**
 * Cambios preparados de una edición múltiple sobre nudos.
 *
 * Mismo contrato que los miembros: ausente es «sin tocar», `null` borra. Las
 * banderas de restricción y la normal del rodillo sólo se escriben donde el
 * apoyo resultante puede sostenerlas.
 */
export interface NodeBulkChanges {
  supportType?: SupportDefinition['type'];
  angleDeg?: number | null;
  restrainX?: boolean | null;
  restrainY?: boolean | null;
  restrainR?: boolean | null;
  internalHinge?: boolean | null;
}

export interface NodeBulkEntry {
  readonly nodeIds: readonly string[];
  readonly changes: NodeBulkChanges;
}

/**
 * Cambios preparados sobre cargas. Cada familia lleva sólo los campos que
 * existen en ella: escribir `py` en una repartida guardaría un valor que el
 * motor nunca lee, y mover una carga a otro caso la saca de su combinación.
 */
export interface NodalLoadBulkChanges {
  caseId?: string;
  fx?: number;
  fy?: number;
  mz?: number;
}

export interface MemberLoadBulkChanges {
  caseId?: string;
  coordinateSystem?: LoadCoordinateSystem;
  lengthBasis?: LoadLengthBasis;
  start?: number;
  end?: number;
  qxStart?: number | null;
  qxEnd?: number | null;
  qyStart?: number | null;
  qyEnd?: number | null;
  position?: number;
  px?: number | null;
  py?: number | null;
  moment?: number | null;
}

export interface NodalLoadBulkEntry {
  readonly loadIds: readonly string[];
  readonly changes: NodalLoadBulkChanges;
}

export interface MemberLoadBulkEntry {
  readonly loadIds: readonly string[];
  readonly changes: MemberLoadBulkChanges;
}

export type ProjectCommand =
  | (CommandBase & { kind: 'member.create'; nodes: NodeModel[]; member: MemberModel })
  | (CommandBase & {
    kind: 'member.createAtPoint';
    startNodeId: string;
    point: { x: number; y: number };
    template: MemberCreationTemplate;
  })
  | (CommandBase & {
    kind: 'member.split';
    memberId: string;
    ratio: number;
    nodeSupport?: SupportDefinition;
  })
  | (CommandBase & {
    kind: 'member.material.apply';
    memberId: string;
    materialId: string;
    properties: Pick<MemberModel, 'E'> & Pick<Partial<MemberModel>, 'G' | 'density'>;
  })
  | (CommandBase & {
    kind: 'member.section.apply';
    memberId: string;
    sectionId: string;
    properties: Pick<MemberModel, 'A' | 'I'>;
  })
  | (CommandBase & { kind: 'member.update'; memberId: string; changes: Partial<Omit<MemberModel, 'id'>> })
  | (CommandBase & {
    kind: 'selection.bulk.apply';
    /** Grupos de miembros que reciben exactamente el mismo cambio. */
    entries: readonly MemberBulkEntry[];
    /** Grupos de nudos que reciben exactamente el mismo cambio. */
    nodeEntries: readonly NodeBulkEntry[];
    /** Grupos de cargas nodales y de miembro, cada familia por separado. */
    nodalLoadEntries: readonly NodalLoadBulkEntry[];
    memberLoadEntries: readonly MemberLoadBulkEntry[];
    /** Estado exacto sobre el que se preparó; rechaza una intención obsoleta. */
    sourceSnapshot: string;
  })
  | (CommandBase & { kind: 'member.delete'; memberId: string })
  | (CommandBase & { kind: 'node.delete'; nodeId: string })
  | (CommandBase & { kind: 'selection.delete'; selection: Extract<Selection, { kind: 'multi' }> })
  | (CommandBase & { kind: 'selection.duplicate'; selection: Selection; offset: { x: number; y: number } })
  | (CommandBase & { kind: 'dxf.import'; nodes: NodeModel[]; members: MemberModel[]; sourceName: string })
  | (CommandBase & {
    /**
     * Generación de una geometría completa como un solo lote reversible.
     *
     * El comando lleva **parámetros**, no geometría: la geometría se vuelve a
     * generar aquí y sólo se acepta si coincide con la que mostró el preview.
     * Un comando que transportara nodos y miembros sería un bus para inyectar
     * cualquier geometría; éste no puede crear nada que el núcleo determinista
     * de generación no produzca a partir de estos mismos parámetros.
     */
    kind: 'structure.generate';
    params: GeneratorParams;
    /** Estado exacto sobre el que se preparó; rechaza una intención obsoleta. */
    sourceSnapshot: string;
    /** Geometría exacta que mostró el preview; rechaza un resultado distinto. */
    generatedSnapshot: string;
  })
  | (CommandBase & {
    kind: 'topology.repair';
    /** Exact project state shown when the user reviewed the preview. */
    sourceSnapshot: string;
    /** Exact repair result accepted by the user. */
    repairedSnapshot: string;
  });

export type ProjectCommandResult =
  | { kind: 'member.create'; memberId: string; nodeId: string; created: true }
  | { kind: 'member.createAtPoint'; memberId: string; nodeId: string; created: boolean }
  | { kind: 'member.split'; nodeId: string; firstMemberId: string; secondMemberId: string }
  | { kind: 'topology.repair'; report: TopologyRepairReport }
  | { kind: 'structure.generate'; nodeIds: string[]; memberIds: string[] };

export interface CompiledProjectCommand {
  command: ProjectCommand;
  forward: ProjectPatch;
  inverse: ProjectPatch;
  result?: ProjectCommandResult;
}

export interface PreparedTopologyRepair extends CompiledProjectCommand {
  command: Extract<ProjectCommand, { kind: 'topology.repair' }>;
  result: Extract<ProjectCommandResult, { kind: 'topology.repair' }>;
  report: TopologyRepairReport;
  repairedProject: ProjectModel;
  repairedSnapshot: string;
}

const COLLECTIONS: ProjectEntityCollection[] = [
  'nodes', 'members', 'nodalLoads', 'memberLoads', 'prescribedDisplacements', 'memberInitialEffects',
];

const entities = (project: ProjectModel, collection: ProjectEntityCollection): ProjectEntity[] => {
  const value = project[collection];
  return (value ?? []) as ProjectEntity[];
};

const encodeExact = (value: unknown): unknown => {
  if (value === undefined) return ['undefined'];
  if (value === null) return ['null'];
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return ['number', 'NaN'];
    if (value === Number.POSITIVE_INFINITY) return ['number', '+Infinity'];
    if (value === Number.NEGATIVE_INFINITY) return ['number', '-Infinity'];
    if (Object.is(value, -0)) return ['number', '-0'];
    return ['number', value];
  }
  if (typeof value === 'string') return ['string', value];
  if (typeof value === 'boolean') return ['boolean', value];
  if (Array.isArray(value)) return ['array', value.map(encodeExact)];
  if (typeof value === 'object') {
    return ['object', Object.keys(value as Record<string, unknown>).sort()
      .map((key) => [key, encodeExact((value as Record<string, unknown>)[key])])];
  }
  throw new Error(`El proyecto contiene un valor no serializable de tipo ${typeof value}.`);
};

/** Exact, deterministic snapshot that preserves non-finite numbers and undefined fields. */
export const projectCommandSnapshot = (value: unknown): string => JSON.stringify(encodeExact(value));

const same = (first: unknown, second: unknown): boolean => projectCommandSnapshot(first) === projectCommandSnapshot(second);
const owns = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);

const validateProjectBoundary = (project: ProjectModel): void => {
  const nodeIds = new Set<string>();
  for (const node of project.nodes) {
    if (nodeIds.has(node.id)) throw new Error(`ID de nodo duplicado: ${node.id}.`);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error(`El nodo ${node.id} tiene coordenadas no finitas.`);
    nodeIds.add(node.id);
  }
  const memberIds = new Set<string>();
  for (const member of project.members) {
    if (memberIds.has(member.id)) throw new Error(`ID de miembro duplicado: ${member.id}.`);
    if (!nodeIds.has(member.i) || !nodeIds.has(member.j) || member.i === member.j) {
      throw new Error(`El miembro ${member.id} no conserva extremos válidos.`);
    }
    if (member.materialOrigin === 'catalog' && !member.materialId) {
      throw new Error(`El miembro ${member.id} declara material de catálogo sin materialId.`);
    }
    if (member.sectionOrigin === 'catalog' && !member.sectionId) {
      throw new Error(`El miembro ${member.id} declara sección de catálogo sin sectionId.`);
    }
    memberIds.add(member.id);
  }
  for (const load of project.memberLoads) if (!memberIds.has(load.memberId)) throw new Error(`La carga ${load.id} referencia un miembro inexistente.`);
  for (const effect of project.memberInitialEffects ?? []) if (!memberIds.has(effect.memberId)) throw new Error(`El efecto ${effect.id} referencia un miembro inexistente.`);
};

const diffProjects = (before: ProjectModel, after: ProjectModel, description: string): ProjectPatch => {
  const operations: ProjectPatchOperation[] = [];
  for (const collection of COLLECTIONS) {
    const previous = entities(before, collection);
    const next = entities(after, collection);
    for (let index = 0; index < previous.length; index += 1) {
      const entity = previous[index];
      const nextEntity = next.find((candidate) => candidate.id === entity.id) ?? null;
      if (!nextEntity) operations.push({ collection, id: entity.id, index, before: structuredClone(entity), after: null });
      else if (!same(entity, nextEntity)) operations.push({ collection, id: entity.id, index, before: structuredClone(entity), after: structuredClone(nextEntity) });
    }
    for (let index = 0; index < next.length; index += 1) {
      const entity = next[index];
      if (!previous.some((candidate) => candidate.id === entity.id)) {
        operations.push({ collection, id: entity.id, index, before: null, after: structuredClone(entity) });
      }
    }
  }
  return { description, operations };
};

export const invertProjectPatch = (patch: ProjectPatch): ProjectPatch => ({
  description: `Revertir: ${patch.description}`,
  operations: patch.operations.map((operation) => ({
    ...operation,
    before: operation.after ? structuredClone(operation.after) : null,
    after: operation.before ? structuredClone(operation.before) : null,
  })),
});

export const applyProjectPatch = (project: ProjectModel, patch: ProjectPatch): ProjectModel => {
  const next = structuredClone(project);
  for (const operation of patch.operations) {
    const collection = entities(next, operation.collection);
    const currentIndex = collection.findIndex((candidate) => candidate.id === operation.id);
    const current = currentIndex >= 0 ? collection[currentIndex] : null;
    if (!same(current, operation.before)) throw new Error(`Falló la precondición para ${operation.collection}/${operation.id}.`);
    if (operation.after === null) collection.splice(currentIndex, 1);
    else if (currentIndex >= 0) collection[currentIndex] = structuredClone(operation.after);
    else collection.splice(Math.min(operation.index, collection.length), 0, structuredClone(operation.after));
    (next as unknown as Record<string, ProjectEntity[]>)[operation.collection] = collection;
  }
  validateProjectBoundary(next);
  return next;
};

/** Propiedades que sólo un pórtico puede sostener; el solver rechaza el resto. */
const FRAME_ONLY_FIELDS = [
  'beamTheory', 'releases', 'rotationalSpringI', 'rotationalSpringJ', 'rigidOffsetI', 'rigidOffsetJ', 'shearArea',
] as const;

const setOrClear = <Entity, Key extends keyof Entity>(
  entity: Entity,
  key: Key,
  value: Entity[Key] | null | undefined,
) => {
  if (value === undefined) return;
  if (value === null) delete entity[key];
  else entity[key] = value;
};

/**
 * Escribe un cambio preparado sobre un miembro.
 *
 * Tres reglas del dominio se aplican aquí, no en la interfaz:
 * 1. una identidad de catálogo llega con sus números y fija el origen `catalog`;
 * 2. escribir E/G/densidad o A/I por separado degrada la identidad a `custom`,
 *    igual que `member.update`, para que el id nunca contradiga a los números;
 * 3. cambiar el tipo retira lo que el nuevo tipo no puede sostener, en vez de
 *    dejar propiedades que harían fallar al solver.
 */
const applyMemberBulkChanges = (current: MemberModel, changes: MemberBulkChanges): MemberModel => {
  const updated: MemberModel = structuredClone(current);

  if (changes.material) {
    Object.assign(updated, structuredClone(changes.material.properties));
    updated.materialId = changes.material.materialId;
    updated.materialOrigin = 'catalog';
  }
  if (changes.section) {
    Object.assign(updated, structuredClone(changes.section.properties));
    updated.sectionId = changes.section.sectionId;
    updated.sectionOrigin = 'catalog';
  }

  const materialChanged = (['E', 'G', 'density'] as const).some(
    (key) => changes[key] !== undefined && !Object.is(changes[key] ?? undefined, current[key]),
  );
  const sectionChanged = (['A', 'I'] as const).some(
    (key) => changes[key] !== undefined && !Object.is(changes[key], current[key]),
  );

  if (changes.E !== undefined) updated.E = changes.E;
  if (changes.A !== undefined) updated.A = changes.A;
  if (changes.I !== undefined) updated.I = changes.I;
  setOrClear(updated, 'G', changes.G);
  setOrClear(updated, 'shearArea', changes.shearArea);
  setOrClear(updated, 'density', changes.density);
  setOrClear(updated, 'beamTheory', changes.beamTheory);
  setOrClear(updated, 'rotationalSpringI', changes.rotationalSpringI);
  setOrClear(updated, 'rotationalSpringJ', changes.rotationalSpringJ);
  setOrClear(updated, 'rigidOffsetI', changes.rigidOffsetI);
  setOrClear(updated, 'rigidOffsetJ', changes.rigidOffsetJ);

  if (changes.iMoment !== undefined || changes.jMoment !== undefined) {
    const releases = { ...updated.releases };
    if (changes.iMoment === null) delete releases.iMoment;
    else if (changes.iMoment !== undefined) releases.iMoment = changes.iMoment;
    if (changes.jMoment === null) delete releases.jMoment;
    else if (changes.jMoment !== undefined) releases.jMoment = changes.jMoment;
    if (Object.keys(releases).length === 0) delete updated.releases;
    else updated.releases = releases;
  }

  if (materialChanged) {
    delete updated.materialId;
    updated.materialOrigin = 'custom';
  }
  if (sectionChanged) {
    delete updated.sectionId;
    updated.sectionOrigin = 'custom';
  }

  if (changes.type !== undefined && changes.type !== updated.type) {
    updated.type = changes.type;
    if (changes.type !== 'frame') for (const field of FRAME_ONLY_FIELDS) delete updated[field];
  }

  return updated;
};

/** Componentes de movimiento impuesto que cada tipo de apoyo puede restringir. */
const prescribedComponentsFor = (support: SupportDefinition): ReadonlySet<string> => {
  switch (support.type) {
    case 'pin': return new Set(['ux', 'uy']);
    case 'fixed': return new Set(['ux', 'uy', 'rz']);
    case 'roller': return new Set(['normal']);
    case 'custom': return new Set([
      ...(support.restrainX ? ['ux'] : []),
      ...(support.restrainY ? ['uy'] : []),
      ...(support.restrainR ? ['rz'] : []),
    ]);
    case 'none': return new Set();
  }
};

/**
 * Reconstruye el apoyo entero cuando cambia el tipo.
 *
 * Escribir sólo `type` dejaría banderas de restricción de un apoyo
 * personalizado, la normal de un rodillo anterior o un movimiento impuesto que
 * el nuevo tipo ya no restringe. Se conservan los muelles, que son
 * independientes del tipo, y se descarta el resto igual que hace el Inspector
 * al cambiar un apoyo de uno en uno.
 *
 * Se exporta porque la edición múltiple necesita **anticipar** este resultado
 * para saber qué propiedades quedarán disponibles tras cambiar el tipo. Que la
 * previsión y la escritura compartan esta función es lo que impide que el panel
 * ofrezca una configuración que el aplicador acabaría descartando.
 */
export const rebuildSupport = (current: SupportDefinition, type: SupportDefinition['type']): SupportDefinition => {
  const spring = current.spring ? structuredClone(current.spring) : undefined;
  if (type === 'roller') return { type, angleDeg: current.angleDeg ?? 90, ...(spring ? { spring } : {}) };
  if (type === 'custom') {
    return { type, restrainX: false, restrainY: false, restrainR: false, ...(spring ? { spring } : {}) };
  }
  return { type, ...(spring ? { spring } : {}) };
};

const applyNodalLoadBulkChanges = (current: NodalLoad, changes: NodalLoadBulkChanges): NodalLoad => {
  const updated: NodalLoad = structuredClone(current);
  if (changes.caseId !== undefined) updated.caseId = changes.caseId;
  if (changes.fx !== undefined) updated.fx = changes.fx;
  if (changes.fy !== undefined) updated.fy = changes.fy;
  if (changes.mz !== undefined) updated.mz = changes.mz;
  return updated;
};

const applyMemberLoadBulkChanges = (current: MemberLoad, changes: MemberLoadBulkChanges): MemberLoad => {
  const updated: MemberLoad = structuredClone(current);
  if (changes.caseId !== undefined) updated.caseId = changes.caseId;
  if (changes.coordinateSystem !== undefined) updated.coordinateSystem = changes.coordinateSystem;
  if (changes.lengthBasis !== undefined) updated.lengthBasis = changes.lengthBasis;
  if (changes.start !== undefined) updated.start = changes.start;
  if (changes.end !== undefined) updated.end = changes.end;
  if (changes.position !== undefined) updated.position = changes.position;
  setOrClear(updated, 'qxStart', changes.qxStart);
  setOrClear(updated, 'qxEnd', changes.qxEnd);
  setOrClear(updated, 'qyStart', changes.qyStart);
  setOrClear(updated, 'qyEnd', changes.qyEnd);
  setOrClear(updated, 'px', changes.px);
  setOrClear(updated, 'py', changes.py);
  setOrClear(updated, 'moment', changes.moment);
  return updated;
};

const applyNodeBulkChanges = (current: NodeModel, changes: NodeBulkChanges): NodeModel => {
  const updated: NodeModel = structuredClone(current);

  if (changes.supportType !== undefined && changes.supportType !== updated.support.type) {
    updated.support = rebuildSupport(updated.support, changes.supportType);
  }

  // Cada bandera vive sólo en un apoyo personalizado, y la normal sólo en un
  // rodillo: escribirlas fuera de ahí guardaría un valor que nadie lee.
  if (updated.support.type === 'custom') {
    if (changes.restrainX === null) delete updated.support.restrainX;
    else if (changes.restrainX !== undefined) updated.support.restrainX = changes.restrainX;
    if (changes.restrainY === null) delete updated.support.restrainY;
    else if (changes.restrainY !== undefined) updated.support.restrainY = changes.restrainY;
    if (changes.restrainR === null) delete updated.support.restrainR;
    else if (changes.restrainR !== undefined) updated.support.restrainR = changes.restrainR;
  }
  if (updated.support.type === 'roller') {
    if (changes.angleDeg === null) delete updated.support.angleDeg;
    else if (changes.angleDeg !== undefined) updated.support.angleDeg = changes.angleDeg;
  }

  if (changes.internalHinge === null) delete updated.internalHinge;
  else if (changes.internalHinge !== undefined) updated.internalHinge = changes.internalHinge;

  // El movimiento impuesto que el apoyo resultante no puede restringir deja de
  // tener sentido físico; conservarlo haría fallar el análisis.
  const allowed = prescribedComponentsFor(updated.support);
  if (updated.support.prescribed) {
    const kept = Object.entries(updated.support.prescribed)
      .filter(([component, value]) => allowed.has(component) && value !== undefined);
    if (kept.length === 0) delete updated.support.prescribed;
    else updated.support.prescribed = Object.fromEntries(kept) as SupportDefinition['prescribed'];
  }

  return updated;
};

export const compileProjectCommand = (project: ProjectModel, command: ProjectCommand): CompiledProjectCommand => {
  const next = structuredClone(project);
  let result: ProjectCommandResult | undefined;
  if (command.kind === 'member.create') {
    next.nodes.push(...structuredClone(command.nodes));
    const member = structuredClone(command.member);
    member.materialOrigin ??= 'custom';
    member.sectionOrigin ??= 'custom';
    next.members.push(member);
    result = { kind: 'member.create', memberId: member.id, nodeId: member.j, created: true };
  } else if (command.kind === 'member.createAtPoint') {
    const created = createMemberAtPoint(next, command);
    result = { kind: command.kind, ...created };
  } else if (command.kind === 'member.split') {
    const split = splitMemberAt(next, command.memberId, command.ratio);
    if (command.nodeSupport) {
      const node = next.nodes.find((candidate) => candidate.id === split.nodeId);
      if (!node) throw new Error(`No existe el nodo ${split.nodeId}.`);
      node.support = structuredClone(command.nodeSupport);
    }
    result = { kind: command.kind, ...split };
  } else if (command.kind === 'member.material.apply') {
    const index = next.members.findIndex((member) => member.id === command.memberId);
    if (index < 0) throw new Error(`No existe el miembro ${command.memberId}.`);
    next.members[index] = {
      ...next.members[index],
      ...structuredClone(command.properties),
      materialId: command.materialId,
      materialOrigin: 'catalog',
    };
  } else if (command.kind === 'member.section.apply') {
    const index = next.members.findIndex((member) => member.id === command.memberId);
    if (index < 0) throw new Error(`No existe el miembro ${command.memberId}.`);
    next.members[index] = {
      ...next.members[index],
      ...structuredClone(command.properties),
      sectionId: command.sectionId,
      sectionOrigin: 'catalog',
    };
  } else if (command.kind === 'member.update') {
    const index = next.members.findIndex((member) => member.id === command.memberId);
    if (index < 0) throw new Error(`No existe el miembro ${command.memberId}.`);
    const current = next.members[index];
    const changes = structuredClone(command.changes);
    const materialChanged = (['E', 'G', 'density'] as const).some(
      (key) => owns(changes, key) && !Object.is(changes[key], current[key]),
    );
    const sectionChanged = (['A', 'I'] as const).some(
      (key) => owns(changes, key) && !Object.is(changes[key], current[key]),
    );
    // Identity is only assigned through the two explicit preset commands.
    // Generic edits cannot inject or recover a catalog identity.
    delete changes.materialId;
    delete changes.materialOrigin;
    delete changes.sectionId;
    delete changes.sectionOrigin;
    const updated = { ...current, ...changes, id: command.memberId };
    if (materialChanged) {
      delete updated.materialId;
      updated.materialOrigin = 'custom';
    }
    if (sectionChanged) {
      delete updated.sectionId;
      updated.sectionOrigin = 'custom';
    }
    next.members[index] = updated;
  } else if (command.kind === 'selection.bulk.apply') {
    if (projectCommandSnapshot(project) !== command.sourceSnapshot) {
      throw new Error('La edición múltiple preparada está obsoleta; vuelve a prepararla antes de aplicarla.');
    }
    const seen = new Set<string>();
    for (const entry of command.entries) {
      for (const memberId of entry.memberIds) {
        if (seen.has(memberId)) throw new Error(`El miembro ${memberId} recibe dos cambios en la misma edición múltiple.`);
        seen.add(memberId);
        const index = next.members.findIndex((member) => member.id === memberId);
        if (index < 0) throw new Error(`No existe el miembro ${memberId}.`);
        next.members[index] = applyMemberBulkChanges(next.members[index], entry.changes);
      }
    }
    // Las cargas se protegen igual que los miembros y los nudos: dos entradas
    // sobre la misma carga harían que la última ganara en silencio, y cuál es
    // «la última» depende del orden de agrupación, no de lo que se preparó.
    const seenNodalLoads = new Set<string>();
    for (const entry of command.nodalLoadEntries) {
      for (const loadId of entry.loadIds) {
        if (seenNodalLoads.has(loadId)) throw new Error(`La carga nodal ${loadId} recibe dos cambios en la misma edición múltiple.`);
        seenNodalLoads.add(loadId);
        const index = next.nodalLoads.findIndex((load) => load.id === loadId);
        if (index < 0) throw new Error(`No existe la carga nodal ${loadId}.`);
        next.nodalLoads[index] = applyNodalLoadBulkChanges(next.nodalLoads[index], entry.changes);
      }
    }
    const seenMemberLoads = new Set<string>();
    for (const entry of command.memberLoadEntries) {
      for (const loadId of entry.loadIds) {
        if (seenMemberLoads.has(loadId)) throw new Error(`La carga de miembro ${loadId} recibe dos cambios en la misma edición múltiple.`);
        seenMemberLoads.add(loadId);
        const index = next.memberLoads.findIndex((load) => load.id === loadId);
        if (index < 0) throw new Error(`No existe la carga de miembro ${loadId}.`);
        next.memberLoads[index] = applyMemberLoadBulkChanges(next.memberLoads[index], entry.changes);
      }
    }
    const seenNodes = new Set<string>();
    for (const entry of command.nodeEntries) {
      for (const nodeId of entry.nodeIds) {
        if (seenNodes.has(nodeId)) throw new Error(`El nudo ${nodeId} recibe dos cambios en la misma edición múltiple.`);
        seenNodes.add(nodeId);
        const index = next.nodes.findIndex((item) => item.id === nodeId);
        if (index < 0) throw new Error(`No existe el nodo ${nodeId}.`);
        next.nodes[index] = applyNodeBulkChanges(next.nodes[index], entry.changes);
      }
    }
    // Un asiento por caso que el apoyo resultante ya no restringe quedaría
    // colgando y haría fallar el análisis: se retira con el mismo cambio.
    if (seenNodes.size > 0 && next.prescribedDisplacements) {
      const supportById = new Map(next.nodes.map((item) => [item.id, item.support]));
      next.prescribedDisplacements = next.prescribedDisplacements.filter((item) => {
        if (!seenNodes.has(item.nodeId)) return true;
        const support = supportById.get(item.nodeId);
        return support ? prescribedComponentsFor(support).has(item.component) : true;
      });
    }
  } else if (command.kind === 'member.delete') {
    if (!next.members.some((member) => member.id === command.memberId)) throw new Error(`No existe el miembro ${command.memberId}.`);
    deleteStructuralSelection(next, { kind: 'member', id: command.memberId });
  } else if (command.kind === 'node.delete') {
    deleteStructuralSelection(next, { kind: 'node', id: command.nodeId });
  } else if (command.kind === 'selection.delete') {
    deleteStructuralSelection(next, command.selection);
  } else if (command.kind === 'selection.duplicate') {
    const duplicated = duplicateModelSelection(next, command.selection, command.offset);
    if (!duplicated) throw new Error('La selección no se puede duplicar.');
  } else if (command.kind === 'structure.generate') {
    if (projectCommandSnapshot(project) !== command.sourceSnapshot) {
      throw new Error('La generación preparada está obsoleta; vuelve a prepararla antes de aplicarla.');
    }
    // El núcleo es determinista, así que regenerar aquí tiene que dar
    // exactamente lo que el usuario revisó. Si no coincide, la intención ya no
    // es la que se aprobó y no se escribe nada.
    const placed = placeGeneratedStructure(project, generateStructure(structuredClone(command.params)));
    if (projectCommandSnapshot({ nodes: placed.nodes, members: placed.members }) !== command.generatedSnapshot) {
      throw new Error('La geometría generada no coincide con la vista previa preparada.');
    }
    next.nodes.push(...placed.nodes.map((node) => structuredClone(node)));
    next.members.push(...placed.members.map((member) => structuredClone(member)));
    result = {
      kind: 'structure.generate',
      nodeIds: placed.nodes.map((node) => node.id),
      memberIds: placed.members.map((member) => member.id),
    };
  } else if (command.kind === 'dxf.import') {
    next.nodes.push(...structuredClone(command.nodes));
    next.members.push(...structuredClone(command.members));
  } else if (command.kind === 'topology.repair') {
    if (projectCommandSnapshot(project) !== command.sourceSnapshot) {
      throw new Error('El preview de reparación está obsoleto; regénéralo antes de aplicar.');
    }
    const report = repairProjectTopology(next);
    if (projectCommandSnapshot(next) !== command.repairedSnapshot) {
      throw new Error('La reparación actual no coincide con el preview preparado.');
    }
    result = { kind: 'topology.repair', report };
  }
  validateProjectBoundary(next);
  const forward = diffProjects(project, next, command.description);
  return { command, forward, inverse: invertProjectPatch(forward), result };
};

/**
 * Runs the established topology repair once on a private clone and freezes the
 * exact source/result contract that the confirmation step must honor.
 */
export const prepareTopologyRepairCommand = (
  project: ProjectModel,
  description = 'Reparar topología segura',
): PreparedTopologyRepair => {
  const sourceSnapshot = projectCommandSnapshot(project);
  const repairedProject = structuredClone(project);
  const report = repairProjectTopology(repairedProject);
  validateProjectBoundary(repairedProject);
  const repairedSnapshot = projectCommandSnapshot(repairedProject);
  const command: Extract<ProjectCommand, { kind: 'topology.repair' }> = {
    kind: 'topology.repair',
    description,
    sourceSnapshot,
    repairedSnapshot,
  };
  const forward = diffProjects(project, repairedProject, description);
  return {
    command,
    forward,
    inverse: invertProjectPatch(forward),
    result: { kind: 'topology.repair', report },
    report,
    repairedProject,
    repairedSnapshot,
  };
};

/** Applies only the already-reviewed repair. It never recompiles a new one. */
export const applyPreparedTopologyRepair = (
  project: ProjectModel,
  prepared: PreparedTopologyRepair,
): ProjectModel => {
  if (projectCommandSnapshot(project) !== prepared.command.sourceSnapshot) {
    throw new Error('El preview de reparación está obsoleto; regénéralo antes de aplicar.');
  }
  if (projectCommandSnapshot(prepared.repairedProject) !== prepared.repairedSnapshot
    || prepared.command.repairedSnapshot !== prepared.repairedSnapshot
    || projectCommandSnapshot(prepared.report) !== projectCommandSnapshot(prepared.result.report)) {
    throw new Error('El resultado preparado no coincide con el preview de reparación.');
  }
  // Reconstruct the authoritative domain operation before trusting any patches
  // carried by the prepared object. This keeps the specific API from becoming
  // a generic, self-signed patch bus for arbitrary structural edits.
  const trusted = compileProjectCommand(project, prepared.command);
  if (projectCommandSnapshot(trusted.forward) !== projectCommandSnapshot(prepared.forward)
    || projectCommandSnapshot(trusted.inverse) !== projectCommandSnapshot(prepared.inverse)
    || projectCommandSnapshot(trusted.result) !== projectCommandSnapshot(prepared.result)) {
    throw new Error('La reparación preparada no coincide con el preview autoritativo.');
  }
  const repaired = applyProjectPatch(project, prepared.forward);
  if (projectCommandSnapshot(repaired) !== prepared.repairedSnapshot) {
    throw new Error('El resultado aplicado no coincide con el preview de reparación.');
  }
  return repaired;
};
