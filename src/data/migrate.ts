import { CURRENT_SCHEMA_VERSION, createDefaultSettings } from './defaultProject';
import type {
  LoadCase,
  LoadCombination,
  EducationalAssertion,
  MemberInitialEffect,
  MemberLoad,
  MemberModel,
  NodeModel,
  NodalLoad,
  PrescribedDisplacement,
  ProjectModel,
  ProjectSettings,
  SpringDefinition,
  SupportDefinition,
} from '../types';
import { createId } from '../utils/id';

type JsonObject = Record<string, unknown>;
const MAX_COLLECTION_ITEMS = 50_000;
const MAX_TEXT_LENGTH = 20_000;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};

const objectAt = (value: unknown, path: string): JsonObject =>
  isObject(value) ? value : fail(path, 'se esperaba un objeto.');

const arrayAt = (value: unknown, path: string, fallback: unknown[] = []): unknown[] => {
  if (value === undefined) return fallback;
  if (!Array.isArray(value)) return fail(path, 'se esperaba una lista.');
  if (value.length > MAX_COLLECTION_ITEMS) return fail(path, `excede el límite de ${MAX_COLLECTION_ITEMS} elementos.`);
  return value;
};

const stringAt = (value: unknown, path: string, fallback?: string): string => {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'se esperaba texto no vacío.');
  const text = value as string;
  if (text.length > MAX_TEXT_LENGTH) fail(path, `el texto excede ${MAX_TEXT_LENGTH} caracteres.`);
  return text;
};

const optionalStringAt = (value: unknown, path: string): string | undefined => {
  if (value === undefined) return undefined;
  return stringAt(value, path);
};

const optionalHttpUrlAt = (value: unknown, path: string): string | undefined => {
  const text = optionalStringAt(value, path);
  if (text === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail(path, 'se esperaba una URL válida.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail(path, 'solo se permiten URLs http o https.');
  return url.toString();
};

const finiteAt = (value: unknown, path: string, fallback?: number): number => {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'se esperaba un número finito.');
  return value as number;
};

const optionalFiniteAt = (value: unknown, path: string): number | undefined =>
  value === undefined ? undefined : finiteAt(value, path);

const booleanAt = (value: unknown, path: string, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return typeof value === 'boolean' ? value : fail(path, 'se esperaba verdadero o falso.');
};

const enumAt = <T extends string>(value: unknown, path: string, values: readonly T[], fallback?: T): T => {
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === 'string' && values.includes(value as T)
    ? value as T
    : fail(path, `valor no permitido; use ${values.join(', ')}.`);
};

/** Optional per-project P-Delta overrides; every field is optional and merged over the defaults. */
const normalizePDeltaConfig = (input: unknown, path: string): ProjectSettings['pDeltaConfig'] => {
  if (input === undefined) return undefined;
  const raw = objectAt(input, path);
  const result: NonNullable<ProjectSettings['pDeltaConfig']> = {};
  for (const key of ['maxLoadSteps', 'maxIterationsPerStep', 'equilibriumTolerance', 'displacementTolerance', 'stepReductionFactor', 'minimumStep'] as const) {
    const value = optionalFiniteAt(raw[key], `${path}.${key}`);
    if (value !== undefined) result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
};

const uniqueId = (id: string, ids: Set<string>, path: string) => {
  if (ids.has(id)) fail(path, `el identificador "${id}" está repetido.`);
  ids.add(id);
};

const normalizeSpring = (input: unknown, path: string): SpringDefinition | undefined => {
  if (input === undefined) return undefined;
  const raw = objectAt(input, path);
  const result: SpringDefinition = {};
  for (const key of ['kx', 'ky', 'kr', 'kNormal', 'angleDeg'] as const) {
    const value = optionalFiniteAt(raw[key], `${path}.${key}`);
    if (value !== undefined) result[key] = value;
  }
  if (result.kx !== undefined && result.kx < 0) fail(`${path}.kx`, 'la rigidez no puede ser negativa.');
  if (result.ky !== undefined && result.ky < 0) fail(`${path}.ky`, 'la rigidez no puede ser negativa.');
  if (result.kr !== undefined && result.kr < 0) fail(`${path}.kr`, 'la rigidez no puede ser negativa.');
  if (result.kNormal !== undefined && result.kNormal < 0) fail(`${path}.kNormal`, 'la rigidez no puede ser negativa.');
  return result;
};

const normalizeSupport = (input: unknown, path: string): SupportDefinition => {
  if (input === undefined) return { type: 'none' };
  const raw = objectAt(input, path);
  const prescribedRaw = raw.prescribed === undefined ? undefined : objectAt(raw.prescribed, `${path}.prescribed`);
  const prescribed = prescribedRaw ? {
    ux: optionalFiniteAt(prescribedRaw.ux, `${path}.prescribed.ux`),
    uy: optionalFiniteAt(prescribedRaw.uy, `${path}.prescribed.uy`),
    rz: optionalFiniteAt(prescribedRaw.rz, `${path}.prescribed.rz`),
    normal: optionalFiniteAt(prescribedRaw.normal, `${path}.prescribed.normal`),
  } : undefined;
  return {
    type: enumAt(raw.type, `${path}.type`, ['none', 'pin', 'roller', 'fixed', 'custom'] as const, 'none'),
    angleDeg: optionalFiniteAt(raw.angleDeg, `${path}.angleDeg`),
    restrainX: raw.restrainX === undefined ? undefined : booleanAt(raw.restrainX, `${path}.restrainX`, false),
    restrainY: raw.restrainY === undefined ? undefined : booleanAt(raw.restrainY, `${path}.restrainY`, false),
    restrainR: raw.restrainR === undefined ? undefined : booleanAt(raw.restrainR, `${path}.restrainR`, false),
    spring: normalizeSpring(raw.spring, `${path}.spring`),
    prescribed,
  };
};

const normalizeSettings = (input: unknown): ProjectSettings => {
  const defaults = createDefaultSettings();
  const raw = input === undefined ? {} : objectAt(input, 'settings');
  const snapTargetsRaw = raw.snapTargets === undefined ? {} : objectAt(raw.snapTargets, 'settings.snapTargets');
  const selectionFilterRaw = raw.selectionFilter === undefined ? {} : objectAt(raw.selectionFilter, 'settings.selectionFilter');
  const settings: ProjectSettings = {
    units: enumAt(raw.units, 'settings.units', ['kN-m', 'N-mm', 'kgf-m', 'kip-ft'] as const, defaults.units),
    language: enumAt(raw.language, 'settings.language', ['es', 'en'] as const, defaults.language),
    gridSize: finiteAt(raw.gridSize, 'settings.gridSize', defaults.gridSize),
    snap: booleanAt(raw.snap, 'settings.snap', defaults.snap),
    snapTargets: {
      grid: booleanAt(snapTargetsRaw.grid, 'settings.snapTargets.grid', defaults.snapTargets?.grid ?? true),
      nodes: booleanAt(snapTargetsRaw.nodes, 'settings.snapTargets.nodes', defaults.snapTargets?.nodes ?? true),
      midpoints: booleanAt(snapTargetsRaw.midpoints, 'settings.snapTargets.midpoints', defaults.snapTargets?.midpoints ?? true),
      intersections: booleanAt(snapTargetsRaw.intersections, 'settings.snapTargets.intersections', defaults.snapTargets?.intersections ?? true),
      perpendicular: booleanAt(snapTargetsRaw.perpendicular, 'settings.snapTargets.perpendicular', defaults.snapTargets?.perpendicular ?? true),
    },
    selectionFilter: {
      nodes: booleanAt(selectionFilterRaw.nodes, 'settings.selectionFilter.nodes', defaults.selectionFilter?.nodes ?? true),
      members: booleanAt(selectionFilterRaw.members, 'settings.selectionFilter.members', defaults.selectionFilter?.members ?? true),
      loads: booleanAt(selectionFilterRaw.loads, 'settings.selectionFilter.loads', defaults.selectionFilter?.loads ?? true),
    },
    showGrid: booleanAt(raw.showGrid, 'settings.showGrid', defaults.showGrid),
    showNodeLabels: booleanAt(raw.showNodeLabels, 'settings.showNodeLabels', defaults.showNodeLabels),
    showMemberLabels: booleanAt(raw.showMemberLabels, 'settings.showMemberLabels', defaults.showMemberLabels),
    showLocalAxes: booleanAt(raw.showLocalAxes, 'settings.showLocalAxes', defaults.showLocalAxes),
    showLoads: booleanAt(raw.showLoads, 'settings.showLoads', defaults.showLoads),
    showDimensions: booleanAt(raw.showDimensions, 'settings.showDimensions', defaults.showDimensions),
    showResultValues: booleanAt(raw.showResultValues, 'settings.showResultValues', defaults.showResultValues),
    diagramScale: finiteAt(raw.diagramScale, 'settings.diagramScale', defaults.diagramScale),
    diagramScaleMode: enumAt(raw.diagramScaleMode, 'settings.diagramScaleMode', ['common', 'individual'] as const, defaults.diagramScaleMode),
    showResultOverlay: booleanAt(raw.showResultOverlay, 'settings.showResultOverlay', defaults.showResultOverlay ?? true),
    deformedScale: finiteAt(raw.deformedScale, 'settings.deformedScale', defaults.deformedScale),
    diagramSide: enumAt(raw.diagramSide, 'settings.diagramSide', ['positive', 'negative'] as const, defaults.diagramSide),
    calculationMode: enumAt(raw.calculationMode, 'settings.calculationMode', ['complete', 'classroom'] as const, defaults.calculationMode),
    // Second-order settings must survive persistence, import and undo like any
    // other analysis input: dropping them silently reverted every reloaded
    // project to first order while the selector still had to be re-picked.
    analysisMode: raw.analysisMode === undefined
      ? defaults.analysisMode
      : enumAt(raw.analysisMode, 'settings.analysisMode', ['first-order', 'p-delta'] as const),
    // Sin esta línea el campo se descartaría en cada guardado: los ajustes se reconstruyen
    // con lista blanca, así que lo que no se lee aquí no sobrevive a un ciclo de ida y vuelta.
    solutionMethod: raw.solutionMethod === undefined
      ? defaults.solutionMethod
      : enumAt(raw.solutionMethod, 'settings.solutionMethod', ['matrix-stiffness', 'double-integration', 'portal-method', 'cantilever-method', 'three-moment', 'virtual-work', 'castigliano-truss', 'hardy-cross', 'kani-frame', 'method-of-sections', 'method-of-joints'] as const),
    pDeltaConfig: normalizePDeltaConfig(raw.pDeltaConfig, 'settings.pDeltaConfig'),
  };
  if (settings.gridSize <= 0) fail('settings.gridSize', 'debe ser mayor que cero.');
  if (settings.diagramScale <= 0) fail('settings.diagramScale', 'debe ser mayor que cero.');
  if (settings.deformedScale <= 0) fail('settings.deformedScale', 'debe ser mayor que cero.');
  return settings;
};

const normalizeNodes = (input: unknown): NodeModel[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'nodes').map((item, index) => {
    const path = `nodes[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `N${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    return {
      id,
      x: finiteAt(raw.x, `${path}.x`, 0),
      y: finiteAt(raw.y, `${path}.y`, 0),
      support: normalizeSupport(raw.support, `${path}.support`),
      internalHinge: raw.internalHinge === undefined
        ? undefined
        : booleanAt(raw.internalHinge, `${path}.internalHinge`, false),
    };
  });
};

const normalizeMembers = (input: unknown, nodeIds: Set<string>): MemberModel[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'members').map((item, index) => {
    const path = `members[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `M${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    const i = stringAt(raw.i, `${path}.i`);
    const j = stringAt(raw.j, `${path}.j`);
    if (!nodeIds.has(i)) fail(`${path}.i`, `el nodo "${i}" no existe.`);
    if (!nodeIds.has(j)) fail(`${path}.j`, `el nodo "${j}" no existe.`);
    if (i === j) fail(path, 'los extremos i y j deben ser nodos distintos.');
    const type = enumAt(raw.type, `${path}.type`, ['frame', 'truss', 'rigid'] as const, 'frame');
    const releaseRaw = raw.releases === undefined ? undefined : objectAt(raw.releases, `${path}.releases`);
    const rigidOffsetI = optionalFiniteAt(raw.rigidOffsetI, `${path}.rigidOffsetI`);
    const rigidOffsetJ = optionalFiniteAt(raw.rigidOffsetJ, `${path}.rigidOffsetJ`);
    const rotationalSpringI = optionalFiniteAt(raw.rotationalSpringI, `${path}.rotationalSpringI`);
    const rotationalSpringJ = optionalFiniteAt(raw.rotationalSpringJ, `${path}.rotationalSpringJ`);
    const materialId = optionalStringAt(raw.materialId, `${path}.materialId`);
    const sectionId = optionalStringAt(raw.sectionId, `${path}.sectionId`);
    const materialOrigin = enumAt(
      raw.materialOrigin,
      `${path}.materialOrigin`,
      ['catalog', 'custom', 'imported', 'legacy'] as const,
      'legacy',
    );
    const sectionOrigin = enumAt(
      raw.sectionOrigin,
      `${path}.sectionOrigin`,
      ['catalog', 'custom', 'imported', 'legacy'] as const,
      'legacy',
    );
    if (materialOrigin === 'catalog' && materialId === undefined) {
      fail(`${path}.materialId`, 'es obligatorio cuando materialOrigin es catalog.');
    }
    if (sectionOrigin === 'catalog' && sectionId === undefined) {
      fail(`${path}.sectionId`, 'es obligatorio cuando sectionOrigin es catalog.');
    }
    if (rigidOffsetI !== undefined && rigidOffsetI < 0) fail(`${path}.rigidOffsetI`, 'no puede ser negativo.');
    if (rigidOffsetJ !== undefined && rigidOffsetJ < 0) fail(`${path}.rigidOffsetJ`, 'no puede ser negativo.');
    if (rotationalSpringI !== undefined && rotationalSpringI < 0) fail(`${path}.rotationalSpringI`, 'no puede ser negativo.');
    if (rotationalSpringJ !== undefined && rotationalSpringJ < 0) fail(`${path}.rotationalSpringJ`, 'no puede ser negativo.');
    return {
      id,
      i,
      j,
      type,
      ...(materialId === undefined ? {} : { materialId }),
      materialOrigin,
      ...(sectionId === undefined ? {} : { sectionId }),
      sectionOrigin,
      E: finiteAt(raw.E, `${path}.E`, 200e6),
      A: finiteAt(raw.A, `${path}.A`, 0.01),
      I: finiteAt(raw.I, `${path}.I`, type === 'truss' ? 0 : 8e-5),
      beamTheory: raw.beamTheory === undefined ? undefined : enumAt(raw.beamTheory, `${path}.beamTheory`, ['euler-bernoulli', 'timoshenko'] as const),
      G: optionalFiniteAt(raw.G, `${path}.G`),
      shearArea: optionalFiniteAt(raw.shearArea, `${path}.shearArea`),
      density: optionalFiniteAt(raw.density, `${path}.density`),
      releases: releaseRaw ? {
        iMoment: releaseRaw.iMoment === undefined ? undefined : booleanAt(releaseRaw.iMoment, `${path}.releases.iMoment`, false),
        jMoment: releaseRaw.jMoment === undefined ? undefined : booleanAt(releaseRaw.jMoment, `${path}.releases.jMoment`, false),
      } : undefined,
      rotationalSpringI,
      rotationalSpringJ,
      rigidOffsetI,
      rigidOffsetJ,
      label: optionalStringAt(raw.label, `${path}.label`),
    };
  });
};

const normalizeLoadCases = (input: unknown): LoadCase[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'loadCases').map((item, index) => {
    const path = `loadCases[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `LC${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    return {
      id,
      name: stringAt(raw.name, `${path}.name`, id),
      category: enumAt(raw.category, `${path}.category`, ['permanent', 'variable', 'accidental', 'other'] as const, 'other'),
      active: booleanAt(raw.active, `${path}.active`, true),
      selfWeightFactor: optionalFiniteAt(raw.selfWeightFactor, `${path}.selfWeightFactor`),
    };
  });
};

const normalizeCombinations = (input: unknown, caseIds: Set<string>): LoadCombination[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'combinations').map((item, index) => {
    const path = `combinations[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `COMB${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    const factorsRaw = objectAt(raw.factors ?? {}, `${path}.factors`);
    const factors: Record<string, number> = {};
    Object.entries(factorsRaw).forEach(([caseId, value]) => {
      if (!caseIds.has(caseId)) fail(`${path}.factors.${caseId}`, 'hace referencia a un caso de carga inexistente.');
      factors[caseId] = finiteAt(value, `${path}.factors.${caseId}`);
    });
    return {
      id,
      name: stringAt(raw.name, `${path}.name`, id),
      factors,
      source: optionalStringAt(raw.source, `${path}.source`),
      sourceUrl: optionalHttpUrlAt(raw.sourceUrl, `${path}.sourceUrl`),
      jurisdiction: optionalStringAt(raw.jurisdiction, `${path}.jurisdiction`),
      edition: optionalStringAt(raw.edition, `${path}.edition`),
      stateLimit: raw.stateLimit === undefined ? undefined : enumAt(raw.stateLimit, `${path}.stateLimit`, ['service', 'ultimate', 'other'] as const),
      reviewedAt: optionalStringAt(raw.reviewedAt, `${path}.reviewedAt`),
    };
  });
};

const normalizeNodalLoads = (input: unknown, nodeIds: Set<string>, caseIds: Set<string>): NodalLoad[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'nodalLoads').map((item, index) => {
    const path = `nodalLoads[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `NL${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    const nodeId = stringAt(raw.nodeId, `${path}.nodeId`);
    const caseId = stringAt(raw.caseId, `${path}.caseId`);
    if (!nodeIds.has(nodeId)) fail(`${path}.nodeId`, `el nodo "${nodeId}" no existe.`);
    if (!caseIds.has(caseId)) fail(`${path}.caseId`, `el caso "${caseId}" no existe.`);
    return {
      id,
      nodeId,
      caseId,
      fx: finiteAt(raw.fx, `${path}.fx`, 0),
      fy: finiteAt(raw.fy, `${path}.fy`, 0),
      mz: finiteAt(raw.mz, `${path}.mz`, 0),
    };
  });
};

const normalizePrescribedDisplacements = (
  input: unknown,
  nodeIds: Set<string>,
  caseIds: Set<string>,
): PrescribedDisplacement[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'prescribedDisplacements').map((item, index) => {
    const path = `prescribedDisplacements[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `PD${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    const nodeId = stringAt(raw.nodeId, `${path}.nodeId`);
    const caseId = stringAt(raw.caseId, `${path}.caseId`);
    if (!nodeIds.has(nodeId)) fail(`${path}.nodeId`, `el nodo "${nodeId}" no existe.`);
    if (!caseIds.has(caseId)) fail(`${path}.caseId`, `el caso "${caseId}" no existe.`);
    return {
      id,
      nodeId,
      caseId,
      component: enumAt(raw.component, `${path}.component`, ['ux', 'uy', 'rz', 'normal'] as const),
      value: finiteAt(raw.value, `${path}.value`),
    };
  });
};

const normalizeMemberLoads = (input: unknown, memberIds: Set<string>, caseIds: Set<string>): MemberLoad[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'memberLoads').map((item, index) => {
    const path = `memberLoads[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `ML${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    const memberId = stringAt(raw.memberId, `${path}.memberId`);
    const caseId = stringAt(raw.caseId, `${path}.caseId`);
    if (!memberIds.has(memberId)) fail(`${path}.memberId`, `el miembro "${memberId}" no existe.`);
    if (!caseIds.has(caseId)) fail(`${path}.caseId`, `el caso "${caseId}" no existe.`);
    const type = enumAt(raw.type, `${path}.type`, ['distributed', 'point', 'moment'] as const);
    let start = finiteAt(raw.start, `${path}.start`, 0);
    let end = finiteAt(raw.end, `${path}.end`, 1);
    let qxStart = optionalFiniteAt(raw.qxStart, `${path}.qxStart`);
    let qxEnd = optionalFiniteAt(raw.qxEnd, `${path}.qxEnd`);
    let qyStart = optionalFiniteAt(raw.qyStart, `${path}.qyStart`);
    let qyEnd = optionalFiniteAt(raw.qyEnd, `${path}.qyEnd`);
    if (start < 0 || start > 1 || end < 0 || end > 1) fail(path, 'start y end deben estar entre 0 y 1.');
    if (type === 'distributed' && start > end) {
      [start, end] = [end, start];
      [qxStart, qxEnd] = [qxEnd, qxStart];
      [qyStart, qyEnd] = [qyEnd, qyStart];
    }
    const position = optionalFiniteAt(raw.position, `${path}.position`);
    if (position !== undefined && (position < 0 || position > 1)) fail(`${path}.position`, 'debe estar entre 0 y 1.');
    return {
      id,
      memberId,
      caseId,
      type,
      coordinateSystem: enumAt(raw.coordinateSystem, `${path}.coordinateSystem`, ['global', 'local'] as const, 'global'),
      lengthBasis: enumAt(raw.lengthBasis, `${path}.lengthBasis`, ['real', 'horizontal', 'vertical'] as const, 'real'),
      start,
      end,
      qxStart,
      qxEnd,
      qyStart,
      qyEnd,
      px: optionalFiniteAt(raw.px, `${path}.px`),
      py: optionalFiniteAt(raw.py, `${path}.py`),
      moment: optionalFiniteAt(raw.moment, `${path}.moment`),
      position,
    };
  });
};

const normalizeMemberInitialEffects = (
  input: unknown,
  memberIds: Set<string>,
  caseIds: Set<string>,
): MemberInitialEffect[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'memberInitialEffects').map((item, index) => {
    const path = `memberInitialEffects[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `IE${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    const memberId = stringAt(raw.memberId, `${path}.memberId`);
    const caseId = stringAt(raw.caseId, `${path}.caseId`);
    if (!memberIds.has(memberId)) fail(`${path}.memberId`, `el miembro "${memberId}" no existe.`);
    if (!caseIds.has(caseId)) fail(`${path}.caseId`, `el caso "${caseId}" no existe.`);
    return {
      id,
      memberId,
      caseId,
      type: enumAt(raw.type, `${path}.type`, ['temperature', 'initial-strain'] as const),
      alpha: optionalFiniteAt(raw.alpha, `${path}.alpha`),
      deltaT: optionalFiniteAt(raw.deltaT, `${path}.deltaT`),
      gradient: optionalFiniteAt(raw.gradient, `${path}.gradient`),
      axialStrain: optionalFiniteAt(raw.axialStrain, `${path}.axialStrain`),
      curvature: optionalFiniteAt(raw.curvature, `${path}.curvature`),
    };
  });
};

const normalizeEducationalAssertions = (
  input: unknown,
  nodeIds: Set<string>,
  memberIds: Set<string>,
): EducationalAssertion[] => {
  const ids = new Set<string>();
  return arrayAt(input, 'educationalCase.expectedAssertions').map((item, index) => {
    const path = `educationalCase.expectedAssertions[${index}]`;
    const raw = objectAt(item, path);
    const id = stringAt(raw.id, `${path}.id`, `assertion-${index + 1}`);
    uniqueId(id, ids, `${path}.id`);
    const targetRaw = objectAt(raw.target, `${path}.target`);
    const kind = enumAt(targetRaw.kind, `${path}.target.kind`, ['node-result', 'member-extreme', 'member-end-force'] as const);
    let target: EducationalAssertion['target'];
    if (kind === 'node-result') {
      const nodeId = stringAt(targetRaw.nodeId, `${path}.target.nodeId`);
      if (!nodeIds.has(nodeId)) fail(`${path}.target.nodeId`, `el nodo "${nodeId}" no existe.`);
      target = {
        kind,
        nodeId,
        component: enumAt(targetRaw.component, `${path}.target.component`, ['ux', 'uy', 'rz', 'rx', 'ry', 'rm'] as const),
      };
    } else {
      const memberId = stringAt(targetRaw.memberId, `${path}.target.memberId`);
      if (!memberIds.has(memberId)) fail(`${path}.target.memberId`, `el miembro "${memberId}" no existe.`);
      const quantity = enumAt(targetRaw.quantity, `${path}.target.quantity`, ['axial', 'shear', 'moment'] as const);
      target = kind === 'member-extreme'
        ? { kind, memberId, quantity, extreme: enumAt(targetRaw.extreme, `${path}.target.extreme`, ['maximum', 'minimum', 'absolute-maximum'] as const) }
        : { kind, memberId, quantity, end: enumAt(targetRaw.end, `${path}.target.end`, ['i', 'j'] as const) };
    }
    const atol = optionalFiniteAt(raw.atol, `${path}.atol`);
    const rtol = optionalFiniteAt(raw.rtol, `${path}.rtol`);
    if ((atol ?? 0) < 0 || (rtol ?? 0) < 0) fail(path, 'las tolerancias no pueden ser negativas.');
    return { id, label: stringAt(raw.label, `${path}.label`, id), target, expected: finiteAt(raw.expected, `${path}.expected`), atol, rtol };
  });
};

/**
 * Migrates and validates projects at the serialization boundary. Mathematical
 * values are never repaired silently: malformed finite values, enums and
 * references reject the import with a field path.
 */
export const normalizeProject = (input: unknown): ProjectModel => {
  const raw = objectAt(input, 'project');
  const versionInput = raw.schemaVersion ?? 1;
  if (typeof versionInput !== 'number' || !Number.isInteger(versionInput) || versionInput < 1) {
    fail('schemaVersion', 'debe ser un entero positivo.');
  }
  const versionValue = versionInput as number;
  if (versionValue > CURRENT_SCHEMA_VERSION) {
    fail('schemaVersion', `la versión ${versionValue} es más nueva que la versión compatible ${CURRENT_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.members)) {
    fail('project', 'el archivo debe contener las listas nodes y members.');
  }

  const nodes = normalizeNodes(raw.nodes);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const members = normalizeMembers(raw.members, nodeIds);
  const memberIds = new Set(members.map((member) => member.id));
  const loadCases = normalizeLoadCases(raw.loadCases);
  const caseIds = new Set(loadCases.map((loadCase) => loadCase.id));

  const educationalRaw = raw.educationalCase === undefined
    ? undefined
    : objectAt(raw.educationalCase, 'educationalCase');
  const expectedResults = educationalRaw
    ? arrayAt(educationalRaw.expectedResults, 'educationalCase.expectedResults').map((value, index) =>
      stringAt(value, `educationalCase.expectedResults[${index}]`))
    : undefined;
  const expectedAssertions = educationalRaw && educationalRaw.expectedAssertions !== undefined
    ? normalizeEducationalAssertions(educationalRaw.expectedAssertions, nodeIds, memberIds)
    : undefined;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: stringAt(raw.id, 'id', createId()),
    name: stringAt(raw.name, 'name', 'Proyecto importado'),
    nodes,
    members,
    loadCases,
    combinations: normalizeCombinations(raw.combinations, caseIds),
    nodalLoads: normalizeNodalLoads(raw.nodalLoads, nodeIds, caseIds),
    prescribedDisplacements: normalizePrescribedDisplacements(raw.prescribedDisplacements, nodeIds, caseIds),
    memberLoads: normalizeMemberLoads(raw.memberLoads, memberIds, caseIds),
    memberInitialEffects: normalizeMemberInitialEffects(raw.memberInitialEffects, memberIds, caseIds),
    settings: normalizeSettings(raw.settings),
    educationalCase: educationalRaw ? {
      kind: enumAt(educationalRaw.kind, 'educationalCase.kind', ['attributed-example', 'original-practice'] as const),
      sourceTitle: stringAt(educationalRaw.sourceTitle, 'educationalCase.sourceTitle'),
      sourceUrl: optionalHttpUrlAt(educationalRaw.sourceUrl, 'educationalCase.sourceUrl'),
      chapter: stringAt(educationalRaw.chapter, 'educationalCase.chapter'),
      note: stringAt(educationalRaw.note, 'educationalCase.note'),
      expectedResults: expectedResults ?? [],
      expectedAssertions,
    } : undefined,
  };
};
