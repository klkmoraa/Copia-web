/**
 * Validación fail-closed del modelo espacial.
 *
 * El validador nunca repara ni muta el proyecto: acumula todos los problemas y
 * devuelve una lista ordenada de forma determinista (`entityKind`, `entityId`,
 * `code`, `field`) para que la interfaz, el worker y los tests observen
 * siempre la misma secuencia.
 *
 * Los códigos no llevan texto: la traducción vive en el catálogo i18n y el
 * dominio se mantiene independiente del idioma.
 */
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_LIMITS,
  SPACE3D_SCHEMA_VERSION,
  Space3DGeometryError,
  type Space3DEntityKind,
  type Space3DProjectV1,
  type Space3DValidationCode,
  type Space3DValidationIssue,
  type Space3DVector,
} from './types';
import { buildMemberOrientation, memberLength } from '../engine/orientation';

const PROJECT_FIELDS = ['analysisSpace', 'schemaVersion', 'id', 'name', 'units', 'nodes', 'members', 'nodalLoads', 'loadCases', 'loadCombinations'];
const NODE_FIELDS = ['id', 'x', 'y', 'z', 'restraints'];
const RESTRAINT_FIELDS = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'];
const MEMBER_FIELDS = ['id', 'i', 'j', 'E', 'G', 'A', 'Iy', 'Iz', 'J', 'orientation'];
const ORIENTATION_FIELDS = ['localYReferenceGlobal', 'rollRadians'];
const LOAD_FIELDS = ['id', 'caseId', 'nodeId', 'fx', 'fy', 'fz', 'mx', 'my', 'mz'];
const LOAD_COMPONENT_FIELDS = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'];
const CASE_FIELDS = ['id', 'name'];
const COMBINATION_FIELDS = ['id', 'name', 'terms'];
const TERM_FIELDS = ['caseId', 'factor'];
const MEMBER_PROPERTY_FIELDS = ['A', 'E', 'G', 'Iy', 'Iz', 'J'] as const;

const UNIT_SYSTEMS = ['kN-m', 'N-mm', 'kgf-m', 'kip-ft'];

const isPositiveFinite = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isFiniteNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);
const isCoordinate = (value: unknown): boolean =>
  isFiniteNumber(value) && Math.abs(value as number) <= SPACE3D_LIMITS.maxCoordinateMagnitude;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const sortIssues = (issues: Space3DValidationIssue[]): Space3DValidationIssue[] =>
  [...issues].sort((a, b) =>
    compare(a.entityKind, b.entityKind)
    || compare(a.entityId, b.entityId)
    || compare(a.code, b.code)
    || compare(a.field, b.field));

interface Collector {
  readonly push: (code: Space3DValidationCode, entityKind: Space3DEntityKind, entityId: string, field: string) => void;
}

const unknownFields = (
  collect: Collector,
  source: unknown,
  allowed: readonly string[],
  entityKind: Space3DEntityKind,
  entityId: string,
) => {
  if (typeof source !== 'object' || source === null) return;
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) collect.push('unknown-field', entityKind, entityId, key);
  }
};

const checkIdentity = (
  collect: Collector,
  id: unknown,
  seen: Set<string>,
  entityKind: Space3DEntityKind,
) => {
  if (typeof id !== 'string' || id.trim() === '') {
    collect.push('empty-id', entityKind, typeof id === 'string' ? id : '', 'id');
    return;
  }
  if (seen.has(id)) collect.push('duplicate-id', entityKind, id, 'id');
  seen.add(id);
};

const isVector3 = (value: unknown): value is Space3DVector =>
  Array.isArray(value) && value.length === 3 && value.every((component) => isFiniteNumber(component));

export const validateSpace3DProject = (project: Space3DProjectV1): readonly Space3DValidationIssue[] => {
  const issues: Space3DValidationIssue[] = [];
  const collect: Collector = {
    push: (code, entityKind, entityId, field) => { issues.push({ code, entityKind, entityId, field }); },
  };

  if (typeof project !== 'object' || project === null) {
    collect.push('invalid-property', 'project', '', 'project');
    return Object.freeze(sortIssues(issues));
  }

  unknownFields(collect, project, PROJECT_FIELDS, 'project', '');
  if (project.analysisSpace !== SPACE3D_ANALYSIS_SPACE) collect.push('invalid-property', 'project', '', 'analysisSpace');
  if (project.schemaVersion !== SPACE3D_SCHEMA_VERSION) collect.push('invalid-property', 'project', '', 'schemaVersion');
  if (!UNIT_SYSTEMS.includes(project.units)) collect.push('invalid-property', 'project', '', 'units');
  if (typeof project.id !== 'string' || project.id === '') collect.push('empty-id', 'project', '', 'id');
  if (typeof project.name !== 'string') collect.push('invalid-property', 'project', '', 'name');

  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const members = Array.isArray(project.members) ? project.members : [];
  const nodalLoads = Array.isArray(project.nodalLoads) ? project.nodalLoads : [];
  const loadCases = Array.isArray(project.loadCases) ? project.loadCases : [];
  const loadCombinations = Array.isArray(project.loadCombinations) ? project.loadCombinations : [];
  if (!Array.isArray(project.nodes)) collect.push('invalid-property', 'project', '', 'nodes');
  if (!Array.isArray(project.members)) collect.push('invalid-property', 'project', '', 'members');
  if (!Array.isArray(project.nodalLoads)) collect.push('invalid-property', 'project', '', 'nodalLoads');
  if (!Array.isArray(project.loadCases)) collect.push('invalid-property', 'project', '', 'loadCases');
  if (!Array.isArray(project.loadCombinations)) collect.push('invalid-property', 'project', '', 'loadCombinations');

  if (nodes.length > SPACE3D_LIMITS.maxNodes) collect.push('limit-exceeded', 'project', '', 'nodes');
  if (members.length > SPACE3D_LIMITS.maxMembers) collect.push('limit-exceeded', 'project', '', 'members');

  const nodeIds = new Set<string>();
  const nodeById = new Map<string, { x: number; y: number; z: number }>();
  for (const node of nodes) {
    unknownFields(collect, node, NODE_FIELDS, 'node', node?.id ?? '');
    checkIdentity(collect, node?.id, nodeIds, 'node');
    const id = typeof node?.id === 'string' ? node.id : '';
    for (const axis of ['x', 'y', 'z'] as const) {
      if (!isCoordinate(node?.[axis])) collect.push('invalid-coordinate', 'node', id, axis);
    }
    const restraints = node?.restraints;
    if (typeof restraints !== 'object' || restraints === null) {
      collect.push('invalid-property', 'node', id, 'restraints');
    } else {
      unknownFields(collect, restraints, RESTRAINT_FIELDS, 'node', id);
      for (const dof of RESTRAINT_FIELDS) {
        if (typeof (restraints as Record<string, unknown>)[dof] !== 'boolean') {
          collect.push('invalid-property', 'node', id, `restraints.${dof}`);
        }
      }
    }
    if (id !== '' && isCoordinate(node?.x) && isCoordinate(node?.y) && isCoordinate(node?.z) && !nodeById.has(id)) {
      nodeById.set(id, { x: node.x, y: node.y, z: node.z });
    }
  }

  const memberIds = new Set<string>();
  for (const member of members) {
    unknownFields(collect, member, MEMBER_FIELDS, 'member', member?.id ?? '');
    checkIdentity(collect, member?.id, memberIds, 'member');
    const id = typeof member?.id === 'string' ? member.id : '';

    for (const field of MEMBER_PROPERTY_FIELDS) {
      if (!isPositiveFinite(member?.[field])) collect.push('invalid-property', 'member', id, field);
    }

    const orientation = member?.orientation;
    let orientationUsable = false;
    if (typeof orientation !== 'object' || orientation === null) {
      collect.push('invalid-property', 'member', id, 'orientation');
    } else {
      unknownFields(collect, orientation, ORIENTATION_FIELDS, 'member', id);
      const referenceOk = isVector3(orientation.localYReferenceGlobal);
      const rollOk = isFiniteNumber(orientation.rollRadians);
      if (!referenceOk) collect.push('invalid-property', 'member', id, 'orientation.localYReferenceGlobal');
      if (!rollOk) collect.push('invalid-property', 'member', id, 'orientation.rollRadians');
      orientationUsable = referenceOk && rollOk;
    }

    const start = typeof member?.i === 'string' ? nodeById.get(member.i) : undefined;
    const end = typeof member?.j === 'string' ? nodeById.get(member.j) : undefined;
    if (typeof member?.i !== 'string' || !nodeIds.has(member.i)) collect.push('missing-reference', 'member', id, 'i');
    if (typeof member?.j !== 'string' || !nodeIds.has(member.j)) collect.push('missing-reference', 'member', id, 'j');

    if (typeof member?.i === 'string' && member.i === member.j) {
      collect.push('self-referential-member', 'member', id, 'j');
      continue;
    }
    if (!start || !end) continue;

    const from: Space3DVector = [start.x, start.y, start.z];
    const to: Space3DVector = [end.x, end.y, end.z];
    if (memberLength(from, to) < SPACE3D_LIMITS.minMemberLength) {
      collect.push('degenerate-length', 'member', id, 'j');
      continue;
    }
    if (!orientationUsable) continue;
    try {
      buildMemberOrientation(from, to, member.orientation);
    } catch (error) {
      if (!(error instanceof Space3DGeometryError)) throw error;
      collect.push('degenerate-orientation', 'member', id, 'orientation');
    }
  }

  const caseIds = new Set<string>();
  for (const loadCase of loadCases) {
    unknownFields(collect, loadCase, CASE_FIELDS, 'case', loadCase?.id ?? '');
    checkIdentity(collect, loadCase?.id, caseIds, 'case');
    if (typeof loadCase?.name !== 'string') collect.push('invalid-property', 'case', loadCase?.id ?? '', 'name');
  }

  const loadIds = new Set<string>();
  for (const load of nodalLoads) {
    unknownFields(collect, load, LOAD_FIELDS, 'load', load?.id ?? '');
    checkIdentity(collect, load?.id, loadIds, 'load');
    const id = typeof load?.id === 'string' ? load.id : '';
    if (typeof load?.nodeId !== 'string' || !nodeIds.has(load.nodeId)) collect.push('missing-reference', 'load', id, 'nodeId');
    if (typeof load?.caseId !== 'string' || !caseIds.has(load.caseId)) collect.push('missing-case', 'load', id, 'caseId');
    for (const component of LOAD_COMPONENT_FIELDS) {
      if (!isFiniteNumber(load?.[component as keyof typeof load])) collect.push('invalid-property', 'load', id, component);
    }
  }

  const combinationIds = new Set<string>();
  for (const combination of loadCombinations) {
    unknownFields(collect, combination, COMBINATION_FIELDS, 'combination', combination?.id ?? '');
    checkIdentity(collect, combination?.id, combinationIds, 'combination');
    const id = typeof combination?.id === 'string' ? combination.id : '';
    if (typeof combination?.name !== 'string') collect.push('invalid-property', 'combination', id, 'name');
    const terms = Array.isArray(combination?.terms) ? combination.terms : [];
    if (!Array.isArray(combination?.terms)) collect.push('invalid-property', 'combination', id, 'terms');
    for (const term of terms) {
      unknownFields(collect, term, TERM_FIELDS, 'combination', id);
      if (typeof term?.caseId !== 'string' || !caseIds.has(term.caseId)) collect.push('missing-case', 'combination', id, 'terms.caseId');
      if (!isFiniteNumber(term?.factor)) collect.push('invalid-property', 'combination', id, 'terms.factor');
    }
  }

  return Object.freeze(sortIssues(issues));
};
