/**
 * Códec portable estricto de Space 3D.
 *
 * Sin Zod ni Ajv: cada objeto se recorre con una allowlist exacta antes de
 * convertirse al tipo de dominio. Un campo desconocido no se ignora — se
 * rechaza. Un archivo que «casi» encaja es la forma más rápida de corromper un
 * modelo estructural sin que nadie se entere.
 *
 * `JSON.stringify` convierte `NaN` e `Infinity` en `null`, así que aceptar
 * `null` donde se espera un número equivaldría a aceptar basura numérica: el
 * lector exige `typeof value === 'number' && Number.isFinite(value)`.
 */
import { validateSpace3DProject } from '../model/validation';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_LIMITS,
  SPACE3D_SCHEMA_VERSION,
  type Space3DFrameMember,
  type Space3DLoadCase,
  type Space3DLoadCombination,
  type Space3DNodalLoad,
  type Space3DNode,
  type Space3DProjectV1,
  type Space3DRestraints,
  type Space3DVector,
} from '../model/types';

export type Space3DCodecErrorCode =
  | 'malformed-json'
  | 'analysis-space'
  | 'schema-version'
  | 'unknown-field'
  | 'missing-field'
  | 'not-a-number'
  | 'not-a-string'
  | 'not-a-boolean'
  | 'not-an-array'
  | 'not-a-vector'
  | 'limit-exceeded'
  | 'invalid-model';

export class Space3DCodecError extends Error {
  readonly code: Space3DCodecErrorCode;

  constructor(code: Space3DCodecErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'Space3DCodecError';
    this.code = code;
  }
}

type Raw = Record<string, unknown>;

const fail = (code: Space3DCodecErrorCode, detail: string): never => { throw new Space3DCodecError(code, detail); };

const object = (value: unknown, path: string): Raw => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('malformed-json', path);
  return value as Raw;
};

/** Allowlist exacta: sobra un campo ⇒ se rechaza; falta uno ⇒ se rechaza. */
const exactKeys = (source: Raw, allowed: readonly string[], path: string): void => {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) fail('unknown-field', `${path}.${key}`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(source, key)) fail('missing-field', `${path}.${key}`);
  }
};

const num = (source: Raw, key: string, path: string): number => {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('not-a-number', `${path}.${key}`);
  return value as number;
};

const text = (source: Raw, key: string, path: string): string => {
  const value = source[key];
  if (typeof value !== 'string') fail('not-a-string', `${path}.${key}`);
  return value as string;
};

const flag = (source: Raw, key: string, path: string): boolean => {
  const value = source[key];
  if (typeof value !== 'boolean') fail('not-a-boolean', `${path}.${key}`);
  return value as boolean;
};

const list = (source: Raw, key: string, path: string, limit?: number): unknown[] => {
  const value = source[key];
  if (!Array.isArray(value)) fail('not-an-array', `${path}.${key}`);
  const array = value as unknown[];
  if (limit !== undefined && array.length > limit) fail('limit-exceeded', `${path}.${key} (${array.length} > ${limit})`);
  return array;
};

const vector = (value: unknown, path: string): Space3DVector => {
  if (!Array.isArray(value) || value.length !== 3) fail('not-a-vector', path);
  const array = value as unknown[];
  return array.map((component, index) => {
    if (typeof component !== 'number' || !Number.isFinite(component)) fail('not-a-number', `${path}[${index}]`);
    return component as number;
  }) as unknown as Space3DVector;
};

const readRestraints = (value: unknown, path: string): Space3DRestraints => {
  const source = object(value, path);
  exactKeys(source, ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'], path);
  return {
    ux: flag(source, 'ux', path), uy: flag(source, 'uy', path), uz: flag(source, 'uz', path),
    rx: flag(source, 'rx', path), ry: flag(source, 'ry', path), rz: flag(source, 'rz', path),
  };
};

const readNode = (value: unknown, index: number): Space3DNode => {
  const path = `nodes[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'x', 'y', 'z', 'restraints'], path);
  return {
    id: text(source, 'id', path),
    x: num(source, 'x', path),
    y: num(source, 'y', path),
    z: num(source, 'z', path),
    restraints: readRestraints(source.restraints, `${path}.restraints`),
  };
};

const readMember = (value: unknown, index: number): Space3DFrameMember => {
  const path = `members[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'i', 'j', 'E', 'G', 'A', 'Iy', 'Iz', 'J', 'orientation'], path);
  const orientationPath = `${path}.orientation`;
  const orientation = object(source.orientation, orientationPath);
  exactKeys(orientation, ['localYReferenceGlobal', 'rollRadians'], orientationPath);
  return {
    id: text(source, 'id', path),
    i: text(source, 'i', path),
    j: text(source, 'j', path),
    E: num(source, 'E', path),
    G: num(source, 'G', path),
    A: num(source, 'A', path),
    Iy: num(source, 'Iy', path),
    Iz: num(source, 'Iz', path),
    J: num(source, 'J', path),
    orientation: {
      localYReferenceGlobal: vector(orientation.localYReferenceGlobal, `${orientationPath}.localYReferenceGlobal`),
      rollRadians: num(orientation, 'rollRadians', orientationPath),
    },
  };
};

const readLoad = (value: unknown, index: number): Space3DNodalLoad => {
  const path = `nodalLoads[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'caseId', 'nodeId', 'fx', 'fy', 'fz', 'mx', 'my', 'mz'], path);
  return {
    id: text(source, 'id', path),
    caseId: text(source, 'caseId', path),
    nodeId: text(source, 'nodeId', path),
    fx: num(source, 'fx', path), fy: num(source, 'fy', path), fz: num(source, 'fz', path),
    mx: num(source, 'mx', path), my: num(source, 'my', path), mz: num(source, 'mz', path),
  };
};

const readCase = (value: unknown, index: number): Space3DLoadCase => {
  const path = `loadCases[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'name'], path);
  return { id: text(source, 'id', path), name: text(source, 'name', path) };
};

const readCombination = (value: unknown, index: number): Space3DLoadCombination => {
  const path = `loadCombinations[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'name', 'terms'], path);
  return {
    id: text(source, 'id', path),
    name: text(source, 'name', path),
    terms: list(source, 'terms', path).map((term, termIndex) => {
      const termPath = `${path}.terms[${termIndex}]`;
      const raw = object(term, termPath);
      exactKeys(raw, ['caseId', 'factor'], termPath);
      return { caseId: text(raw, 'caseId', termPath), factor: num(raw, 'factor', termPath) };
    }),
  };
};

const UNIT_SYSTEMS = ['kN-m', 'N-mm', 'kgf-m', 'kip-ft'] as const;

export interface Space3DParseOptions {
  /**
   * Exige además un modelo estructuralmente admisible.
   *
   * Un archivo puede tener la forma correcta y aun así describir un modelo que
   * no se puede analizar — por ejemplo el derivado de un proyecto 2D, con la
   * inercia del eje débil todavía a cero. Eso es trabajo en curso legítimo: se
   * guarda y se reabre, y es el validador quien impide analizarlo. Un archivo
   * que llega de fuera sí se exige coherente.
   */
  readonly requireAdmissibleModel?: boolean;
}

export const parseSpace3DProject = (json: string, options: Space3DParseOptions = {}): Space3DProjectV1 => {
  const requireAdmissibleModel = options.requireAdmissibleModel ?? true;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Space3DCodecError('malformed-json', 'el archivo no es JSON válido');
  }
  const source = object(raw, 'project');

  // La discriminación va primero: así un archivo 2D falla por lo que es, y no
  // por el primer campo que le falte.
  if (source.analysisSpace !== SPACE3D_ANALYSIS_SPACE) {
    fail('analysis-space', `se esperaba «${SPACE3D_ANALYSIS_SPACE}» y llegó «${String(source.analysisSpace)}»`);
  }
  if (source.schemaVersion !== SPACE3D_SCHEMA_VERSION) {
    fail('schema-version', `se esperaba ${SPACE3D_SCHEMA_VERSION} y llegó ${String(source.schemaVersion)}`);
  }

  exactKeys(source, ['analysisSpace', 'schemaVersion', 'id', 'name', 'units', 'nodes', 'members', 'nodalLoads', 'loadCases', 'loadCombinations'], 'project');

  const units = text(source, 'units', 'project');
  if (!(UNIT_SYSTEMS as readonly string[]).includes(units)) fail('not-a-string', `project.units «${units}»`);

  const project: Space3DProjectV1 = {
    analysisSpace: SPACE3D_ANALYSIS_SPACE,
    schemaVersion: SPACE3D_SCHEMA_VERSION,
    id: text(source, 'id', 'project'),
    name: text(source, 'name', 'project'),
    units: units as Space3DProjectV1['units'],
    nodes: list(source, 'nodes', 'project', SPACE3D_LIMITS.maxNodes).map(readNode),
    members: list(source, 'members', 'project', SPACE3D_LIMITS.maxMembers).map(readMember),
    nodalLoads: list(source, 'nodalLoads', 'project').map(readLoad),
    loadCases: list(source, 'loadCases', 'project').map(readCase),
    loadCombinations: list(source, 'loadCombinations', 'project').map(readCombination),
  };

  if (requireAdmissibleModel) {
    const issues = validateSpace3DProject(project);
    if (issues.length > 0) {
      const detail = issues.slice(0, 3).map((item) => `${item.entityKind}:${item.entityId}:${item.code}`).join(', ');
      fail('invalid-model', `${issues.length} problema(s): ${detail}`);
    }
  }

  return project;
};

/** Lectura de trabajo en curso: forma estricta, admisibilidad no exigida. */
export const parseSpace3DDraft = (json: string): Space3DProjectV1 =>
  parseSpace3DProject(json, { requireAdmissibleModel: false });

export const serializeSpace3DProject = (project: Space3DProjectV1): string => JSON.stringify({
  analysisSpace: project.analysisSpace,
  schemaVersion: project.schemaVersion,
  id: project.id,
  name: project.name,
  units: project.units,
  nodes: project.nodes.map((node) => ({
    id: node.id, x: node.x, y: node.y, z: node.z,
    restraints: {
      ux: node.restraints.ux, uy: node.restraints.uy, uz: node.restraints.uz,
      rx: node.restraints.rx, ry: node.restraints.ry, rz: node.restraints.rz,
    },
  })),
  members: project.members.map((member) => ({
    id: member.id, i: member.i, j: member.j,
    E: member.E, G: member.G, A: member.A, Iy: member.Iy, Iz: member.Iz, J: member.J,
    orientation: {
      localYReferenceGlobal: [...member.orientation.localYReferenceGlobal],
      rollRadians: member.orientation.rollRadians,
    },
  })),
  nodalLoads: project.nodalLoads.map((load) => ({
    id: load.id, caseId: load.caseId, nodeId: load.nodeId,
    fx: load.fx, fy: load.fy, fz: load.fz, mx: load.mx, my: load.my, mz: load.mz,
  })),
  loadCases: project.loadCases.map((item) => ({ id: item.id, name: item.name })),
  loadCombinations: project.loadCombinations.map((item) => ({
    id: item.id, name: item.name,
    terms: item.terms.map((term) => ({ caseId: term.caseId, factor: term.factor })),
  })),
}, null, 2);
