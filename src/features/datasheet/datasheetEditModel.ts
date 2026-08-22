import type { UnitQuantity } from '../../engine/units';
import type { MemberLoad, MemberModel, NodalLoad, NodeModel } from '../../types';
import { bulkPropertyDescriptors } from '../bulk-edit/bulkEditProperties';
import type { BulkIncompatibilityReason, BulkPropertyId } from '../bulk-edit/bulkEditTypes';
import type { DatasheetEntity, DatasheetRowKind } from './datasheetModel';

/**
 * Qué campo del modelo escribe cada celda editable.
 *
 * Casi todo lo que hay aquí ya está descrito en `bulkEditProperties.ts`: qué
 * cantidad física tiene una propiedad, qué opciones admite y por qué una entidad
 * la rechaza. Este registro **lee de allí** en vez de repetirlo, para que añadir
 * un tipo de apoyo o de barra siga rompiendo un único sitio.
 *
 * Las dos excepciones son `node.x` y `node.y`, que ni la edición múltiple ni
 * `ProjectCommand` declaran. Por eso el datasheet escribe siempre por
 * `updateProject`, que es la ruta reversible que ya usa el Inspector: mezclar
 * las dos rutas partiría un pegado de coordenadas y propiedades en dos entradas
 * de historial, y eso es una escritura parcial.
 */

/** Campos que la edición múltiple ya describe; su id es literalmente el suyo. */
type BulkBackedFieldId = Extract<BulkPropertyId,
  | 'node.support.type' | 'node.support.angleDeg'
  | 'node.support.restrainX' | 'node.support.restrainY' | 'node.support.restrainR'
  | 'node.internalHinge'
  | 'member.type' | 'member.materialId' | 'member.sectionId'
  | 'member.E' | 'member.A' | 'member.I' | 'member.G' | 'member.density'
  | 'member.releases.iMoment' | 'member.releases.jMoment'
  | 'nodalLoad.caseId' | 'nodalLoad.fx' | 'nodalLoad.fy' | 'nodalLoad.mz'
  | 'memberLoad.caseId' | 'memberLoad.coordinateSystem' | 'memberLoad.lengthBasis'
  | 'memberLoad.start' | 'memberLoad.end'
  | 'memberLoad.qxStart' | 'memberLoad.qxEnd' | 'memberLoad.qyStart' | 'memberLoad.qyEnd'
  | 'memberLoad.position' | 'memberLoad.px' | 'memberLoad.py' | 'memberLoad.moment'
>;

export type DatasheetFieldId = 'node.x' | 'node.y' | BulkBackedFieldId;

export type DatasheetFieldKind = 'number' | 'enum' | 'boolean' | 'material' | 'section';

export interface DatasheetField {
  id: DatasheetFieldId;
  kind: DatasheetFieldKind;
  quantity?: UnitQuantity;
  /** Unidad fija que no depende del sistema del proyecto (grados, x/L). */
  unit?: string;
  options?: readonly string[];
  /** Enumerado cuyas opciones las declara el proyecto, no una unión del dominio. */
  optionsFrom?: 'loadCases';
  /** Estrictamente positivo: un cero haría singular la matriz de rigidez. */
  positive?: boolean;
  min?: number;
  max?: number;
}

export type DatasheetEditTarget =
  | { kind: 'node'; node: NodeModel }
  | { kind: 'member'; member: MemberModel }
  | { kind: 'nodalLoad'; load: NodalLoad }
  | { kind: 'memberLoad'; load: MemberLoad };

const descriptorById = new Map(bulkPropertyDescriptors.map((descriptor) => [descriptor.id, descriptor]));

/** Sólo estas tres exigen positivo; el resto admite el cero y el negativo. */
const POSITIVE_FIELDS: ReadonlySet<DatasheetFieldId> = new Set<DatasheetFieldId>([
  'member.E', 'member.A', 'member.I',
]);

/** Posiciones normalizadas del modelo: fuera de [0, 1] no hay barra donde caer. */
const NORMALIZED_FIELDS: ReadonlySet<DatasheetFieldId> = new Set<DatasheetFieldId>([
  'memberLoad.start', 'memberLoad.end', 'memberLoad.position',
]);

const CASE_FIELDS: ReadonlySet<DatasheetFieldId> = new Set<DatasheetFieldId>([
  'nodalLoad.caseId', 'memberLoad.caseId',
]);

const COORDINATE_FIELDS: Readonly<Record<'node.x' | 'node.y', DatasheetField>> = {
  'node.x': { id: 'node.x', kind: 'number', quantity: 'length' },
  'node.y': { id: 'node.y', kind: 'number', quantity: 'length' },
};

export const datasheetField = (id: DatasheetFieldId): DatasheetField => {
  if (id === 'node.x' || id === 'node.y') return COORDINATE_FIELDS[id];
  const descriptor = descriptorById.get(id);
  // El registro de bulk-edit es la fuente. Un id sin descriptor es un error de
  // programación, no un estado que la interfaz deba saber dibujar.
  if (!descriptor) throw new Error(`El datasheet no conoce el campo ${id}.`);
  return {
    id,
    kind: descriptor.kind,
    quantity: descriptor.quantity,
    unit: descriptor.unit,
    options: descriptor.options,
    optionsFrom: CASE_FIELDS.has(id) ? 'loadCases' : undefined,
    positive: POSITIVE_FIELDS.has(id) ? true : undefined,
    min: NORMALIZED_FIELDS.has(id) ? 0 : undefined,
    max: NORMALIZED_FIELDS.has(id) ? 1 : undefined,
  };
};

/** Columna de la tabla al campo que escribe. Lo que no está aquí, no se edita. */
const COLUMN_FIELDS: Record<DatasheetEntity, Readonly<Record<string, DatasheetFieldId>>> = {
  nodes: {
    x: 'node.x',
    y: 'node.y',
    support: 'node.support.type',
    hinge: 'node.internalHinge',
  },
  members: {
    type: 'member.type',
    material: 'member.materialId',
    section: 'member.sectionId',
    E: 'member.E',
    A: 'member.A',
    I: 'member.I',
  },
  loads: {
    case: 'nodalLoad.caseId',
    fx: 'nodalLoad.fx',
    fy: 'nodalLoad.fy',
    mz: 'nodalLoad.mz',
    coordinateSystem: 'memberLoad.coordinateSystem',
    lengthBasis: 'memberLoad.lengthBasis',
    start: 'memberLoad.start',
    end: 'memberLoad.end',
    qxStart: 'memberLoad.qxStart',
    qxEnd: 'memberLoad.qxEnd',
    qyStart: 'memberLoad.qyStart',
    qyEnd: 'memberLoad.qyEnd',
    position: 'memberLoad.position',
    px: 'memberLoad.px',
    py: 'memberLoad.py',
    moment: 'memberLoad.moment',
  },
};

/** Existe un campo para esta columna, con independencia de la fila. */
export const datasheetColumnField = (
  entity: DatasheetEntity,
  columnId: string,
): DatasheetFieldId | undefined => COLUMN_FIELDS[entity][columnId];

/**
 * Campo que escribe una celda concreta.
 *
 * La tabla de cargas es una unión de dos familias, así que la columna sola no
 * basta: `case` escribe en las dos con campos distintos, y `fx` sólo existe en
 * la nodal. Resolver contra la fila es lo que impide que un pegado escriba un Fx
 * en una repartida, donde no hay dónde guardarlo.
 */
export const datasheetRowField = (
  entity: DatasheetEntity,
  columnId: string,
  rowKind: DatasheetRowKind,
): DatasheetFieldId | undefined => {
  const field = COLUMN_FIELDS[entity][columnId];
  if (!field) return undefined;
  if (entity !== 'loads') return field;
  if (columnId === 'case') return rowKind === 'nodalLoad' ? 'nodalLoad.caseId' : 'memberLoad.caseId';
  return field.startsWith(`${rowKind}.`) ? field : undefined;
};

/**
 * Por qué esta entidad concreta no admite el campo.
 *
 * El `switch` repite `descriptor.entity ===` a propósito: cada `ineligible` está
 * tipado contra su familia y ésa es la forma de que TypeScript lo estreche sin
 * un `as`. Colapsarlo en una llamada única le pasaría una entidad que ese
 * predicado no está escrito para leer.
 */
export const datasheetFieldIneligibility = (
  id: DatasheetFieldId,
  target: DatasheetEditTarget,
): BulkIncompatibilityReason | undefined => {
  if (id === 'node.x' || id === 'node.y') {
    return target.kind === 'node' ? undefined : 'load-family';
  }
  const descriptor = descriptorById.get(id);
  if (!descriptor) return undefined;
  if (descriptor.entity !== target.kind) return 'load-family';
  switch (target.kind) {
    case 'node':
      return descriptor.entity === 'node' ? descriptor.ineligible?.(target.node) : undefined;
    case 'member':
      return descriptor.entity === 'member' ? descriptor.ineligible?.(target.member) : undefined;
    case 'nodalLoad':
      return descriptor.entity === 'nodalLoad' ? descriptor.ineligible?.(target.load) : undefined;
    case 'memberLoad':
      return descriptor.entity === 'memberLoad' ? descriptor.ineligible?.(target.load) : undefined;
  }
};
