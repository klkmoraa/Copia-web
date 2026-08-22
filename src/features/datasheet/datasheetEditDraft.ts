import { projectTopologyTolerance } from '../../data/modelOperations';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import { fromDisplay } from '../../engine/units';
import type { ProjectModel, UnitSystemId } from '../../types';
import { parseInspectorNumber } from '../inspector/numericFormatting';
import {
  datasheetField,
  datasheetFieldIneligibility,
  type DatasheetEditTarget,
  type DatasheetFieldId,
} from './datasheetEditModel';

/**
 * Borrador de edición del datasheet: interpretar → convertir → validar.
 *
 * El borrador guarda **la cadena tal como se teclea**, sin interpretar.
 * Interpretar en cada pulsación convertiría `1.` o `-` en `NaN` mientras el
 * usuario todavía está escribiendo el número.
 *
 * El plan que sale de aquí está en **unidades base** y es todo o nada: un solo
 * error deja `applicable` en `false`, y nadie puede escribir una parte.
 */

/** Clave `rowId|fieldId`. La barra no aparece en ningún identificador del modelo. */
export type DatasheetEditDraft = Readonly<Record<string, string>>;

export const EMPTY_DATASHEET_DRAFT: DatasheetEditDraft = Object.freeze({});

export const draftKey = (rowId: string, fieldId: DatasheetFieldId): string => `${rowId}|${fieldId}`;

export const stageDatasheetEdit = (
  draft: DatasheetEditDraft,
  rowId: string,
  fieldId: DatasheetFieldId,
  raw: string,
): DatasheetEditDraft => ({ ...draft, [draftKey(rowId, fieldId)]: raw });

export const unstageDatasheetEdit = (
  draft: DatasheetEditDraft,
  rowId: string,
  fieldId: DatasheetFieldId,
): DatasheetEditDraft => {
  const key = draftKey(rowId, fieldId);
  if (!(key in draft)) return draft;
  const next = { ...draft };
  delete next[key];
  return next;
};

export const datasheetDraftCount = (draft: DatasheetEditDraft): number => Object.keys(draft).length;

export type DatasheetEditErrorCode =
  | 'not-a-number'
  | 'not-positive'
  | 'out-of-range'
  | 'unknown-option'
  | 'ineligible'
  | 'unknown-row';

export type DatasheetEditValue = string | number | boolean | undefined;

export interface DatasheetPlannedChange {
  rowId: string;
  targetKind: DatasheetEditTarget['kind'];
  fieldId: DatasheetFieldId;
  /** Unidades base, nunca las mostradas. */
  before: DatasheetEditValue;
  after: DatasheetEditValue;
}

export interface DatasheetEditError {
  rowId: string;
  fieldId: DatasheetFieldId;
  code: DatasheetEditErrorCode;
  raw: string;
}

export interface DatasheetEditPlan {
  changes: readonly DatasheetPlannedChange[];
  errors: readonly DatasheetEditError[];
  /** Nudos que compartirían punto tras aplicar. Avisa; no fusiona ni bloquea. */
  coincidentNodeIds: readonly string[];
  applicable: boolean;
}

/**
 * Índice de una sola pasada. Buscar cada fila recorriendo el modelo convertiría
 * un pegado de cien celdas en un recorrido cuadrático sobre el proyecto entero.
 */
interface ProjectIndex {
  nodes: ReadonlyMap<string, ProjectModel['nodes'][number]>;
  members: ReadonlyMap<string, ProjectModel['members'][number]>;
  nodalLoads: ReadonlyMap<string, ProjectModel['nodalLoads'][number]>;
  memberLoads: ReadonlyMap<string, ProjectModel['memberLoads'][number]>;
  loadCaseIds: ReadonlySet<string>;
}

const indexProject = (project: ProjectModel): ProjectIndex => ({
  nodes: new Map(project.nodes.map((node) => [node.id, node])),
  members: new Map(project.members.map((member) => [member.id, member])),
  nodalLoads: new Map(project.nodalLoads.map((load) => [load.id, load])),
  memberLoads: new Map(project.memberLoads.map((load) => [load.id, load])),
  loadCaseIds: new Set(project.loadCases.map((item) => item.id)),
});

const targetFor = (
  index: ProjectIndex,
  fieldId: DatasheetFieldId,
  rowId: string,
): DatasheetEditTarget | undefined => {
  if (fieldId.startsWith('node.')) {
    const node = index.nodes.get(rowId);
    return node ? { kind: 'node', node } : undefined;
  }
  if (fieldId.startsWith('member.')) {
    const member = index.members.get(rowId);
    return member ? { kind: 'member', member } : undefined;
  }
  if (fieldId.startsWith('nodalLoad.')) {
    const load = index.nodalLoads.get(rowId);
    return load ? { kind: 'nodalLoad', load } : undefined;
  }
  const load = index.memberLoads.get(rowId);
  return load ? { kind: 'memberLoad', load } : undefined;
};

/** Valor actual del campo, en unidades base. Es lo que la revisión enseña como «antes». */
const readField = (target: DatasheetEditTarget, fieldId: DatasheetFieldId): DatasheetEditValue => {
  switch (target.kind) {
    case 'node': {
      const { node } = target;
      switch (fieldId) {
        case 'node.x': return node.x;
        case 'node.y': return node.y;
        case 'node.support.type': return node.support.type;
        case 'node.support.angleDeg': return node.support.angleDeg;
        case 'node.support.restrainX': return node.support.restrainX;
        case 'node.support.restrainY': return node.support.restrainY;
        case 'node.support.restrainR': return node.support.restrainR;
        case 'node.internalHinge': return node.internalHinge;
        default: return undefined;
      }
    }
    case 'member': {
      const { member } = target;
      switch (fieldId) {
        case 'member.type': return member.type;
        case 'member.materialId': return member.materialId;
        case 'member.sectionId': return member.sectionId;
        case 'member.E': return member.E;
        case 'member.A': return member.A;
        case 'member.I': return member.I;
        case 'member.G': return member.G;
        case 'member.density': return member.density;
        case 'member.releases.iMoment': return member.releases?.iMoment;
        case 'member.releases.jMoment': return member.releases?.jMoment;
        default: return undefined;
      }
    }
    case 'nodalLoad': {
      const { load } = target;
      switch (fieldId) {
        case 'nodalLoad.caseId': return load.caseId;
        case 'nodalLoad.fx': return load.fx;
        case 'nodalLoad.fy': return load.fy;
        case 'nodalLoad.mz': return load.mz;
        default: return undefined;
      }
    }
    case 'memberLoad': {
      // Los campos de carga de barra son homogéneos y su nombre es el sufijo del
      // identificador; el registro ya validó que el campo existe en la familia.
      const key = fieldId.slice('memberLoad.'.length);
      return (target.load as unknown as Record<string, DatasheetEditValue>)[key];
    }
  }
};

/** Comprueba la opción contra su dominio: unión fija, catálogo o casos del proyecto. */
const optionError = (
  fieldId: DatasheetFieldId,
  raw: string,
  index: ProjectIndex,
): DatasheetEditErrorCode | undefined => {
  const field = datasheetField(fieldId);
  // Un identificador que el catálogo no reconoce no puede resolver ni origen ni
  // números: aceptarlo dejaría una identidad que nada respalda.
  if (field.kind === 'material') return findStandardMaterial(raw) ? undefined : 'unknown-option';
  if (field.kind === 'section') return findStandardSection(raw) ? undefined : 'unknown-option';
  if (field.optionsFrom === 'loadCases') return index.loadCaseIds.has(raw) ? undefined : 'unknown-option';
  return field.options?.includes(raw) ? undefined : 'unknown-option';
};

/**
 * Un booleano llega como texto porque el borrador es homogéneo: la celda, el
 * panel y el pegado escriben todos una cadena, y sólo aquí se decide qué es.
 */
const parseBoolean = (raw: string): boolean | undefined => {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
};

interface Interpreted {
  change?: DatasheetPlannedChange;
  error?: DatasheetEditError;
}

const interpretEntry = (
  index: ProjectIndex,
  rowId: string,
  fieldId: DatasheetFieldId,
  raw: string,
  units: UnitSystemId,
): Interpreted => {
  const fail = (code: DatasheetEditErrorCode): Interpreted => ({ error: { rowId, fieldId, code, raw } });
  const target = targetFor(index, fieldId, rowId);
  if (!target) return fail('unknown-row');
  if (datasheetFieldIneligibility(fieldId, target)) return fail('ineligible');

  const field = datasheetField(fieldId);
  const before = readField(target, fieldId);
  let after: DatasheetEditValue;

  if (field.kind === 'number') {
    const parsed = parseInspectorNumber(raw);
    if (!parsed.ok) return fail('not-a-number');
    // El usuario teclea en las unidades que la tabla le muestra.
    after = field.quantity ? fromDisplay(parsed.value, units, field.quantity) : parsed.value;
    if (field.positive && after <= 0) return fail('not-positive');
    if (field.min !== undefined && after < field.min) return fail('out-of-range');
    if (field.max !== undefined && after > field.max) return fail('out-of-range');
  } else if (field.kind === 'boolean') {
    const parsed = parseBoolean(raw);
    if (parsed === undefined) return fail('unknown-option');
    after = parsed;
  } else {
    const trimmed = raw.trim();
    const error = optionError(fieldId, trimmed, index);
    if (error) return fail(error);
    after = trimmed;
  }

  // Volver a teclear el valor que ya estaba no es un cambio. Dejarlo en el plan
  // haría que «Aplicar» registrase una entrada de historial que no cambia nada.
  if (before === after) return {};
  return { change: { rowId, targetKind: target.kind, fieldId, before, after } };
};

/**
 * Nudos que compartirían punto tras el plan.
 *
 * El datasheet **no** repara la topología, a diferencia del Inspector: un pegado
 * de coordenadas no debe borrar filas en silencio. Se avisa y se remite al Model
 * Doctor, que es la ruta explícita y reversible para fusionarlos.
 */
const coincidentNodes = (
  project: ProjectModel,
  changes: readonly DatasheetPlannedChange[],
): readonly string[] => {
  const moved = changes.filter((change) => change.fieldId === 'node.x' || change.fieldId === 'node.y');
  if (moved.length === 0) return [];

  const points = new Map(project.nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
  for (const change of moved) {
    const point = points.get(change.rowId);
    if (!point || typeof change.after !== 'number') continue;
    if (change.fieldId === 'node.x') point.x = change.after;
    else point.y = change.after;
  }

  const tolerance = projectTopologyTolerance(project);
  const coincident = new Set<string>();
  const entries = [...points.entries()];
  for (let first = 0; first < entries.length; first += 1) {
    for (let second = first + 1; second < entries.length; second += 1) {
      const [firstId, firstPoint] = entries[first];
      const [secondId, secondPoint] = entries[second];
      if (Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y) > tolerance) continue;
      coincident.add(firstId);
      coincident.add(secondId);
    }
  }
  return [...coincident];
};

export const interpretDatasheetEdits = (
  project: ProjectModel,
  draft: DatasheetEditDraft,
  units: UnitSystemId,
): DatasheetEditPlan => {
  const index = indexProject(project);
  const changes: DatasheetPlannedChange[] = [];
  const errors: DatasheetEditError[] = [];

  for (const [key, raw] of Object.entries(draft)) {
    const separator = key.indexOf('|');
    const rowId = key.slice(0, separator);
    const fieldId = key.slice(separator + 1) as DatasheetFieldId;
    const { change, error } = interpretEntry(index, rowId, fieldId, raw, units);
    if (change) changes.push(change);
    if (error) errors.push(error);
  }

  return {
    changes,
    errors,
    coincidentNodeIds: coincidentNodes(project, changes),
    applicable: errors.length === 0 && changes.length > 0,
  };
};
