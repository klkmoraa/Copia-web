import type {
  LoadCoordinateSystem,
  LoadLengthBasis,
  MemberLoad,
  MemberModel,
  MemberPropertyOrigin,
  MemberType,
  NodeModel,
  SupportType,
} from '../../types';
import type {
  BulkIncompatibilityReason,
  BulkMemberLoadPropertyDescriptor,
  BulkMemberPropertyDescriptor,
  BulkNodalLoadPropertyDescriptor,
  BulkNodePropertyDescriptor,
  BulkPropertyDescriptor,
} from './bulkEditTypes';

/**
 * Registro de las propiedades que la edición múltiple sabe leer.
 *
 * Cada entrada declara de forma explícita quién la admite y por qué la rechaza.
 * No hay reglas implícitas: si un miembro rígido no tiene rigidez editable, la
 * agregación lo dice con un motivo, no lo omite en silencio.
 */

/**
 * Las opciones de un `enum` se declaran contra la unión del dominio: si `types.ts`
 * gana un tipo de apoyo o de miembro, falta una clave aquí y el build se rompe en
 * vez de ofrecer una lista incompleta en silencio.
 */
const optionsOf = <T extends string>(values: Record<T, true>): readonly T[] =>
  Object.keys(values) as T[];

const MEMBER_TYPES = optionsOf<MemberType>({ frame: true, truss: true, rigid: true });
const SUPPORT_TYPES = optionsOf<SupportType>({ none: true, pin: true, roller: true, fixed: true, custom: true });
const PROPERTY_ORIGINS = optionsOf<MemberPropertyOrigin>({ catalog: true, custom: true, imported: true, legacy: true });
const BEAM_THEORIES = optionsOf<NonNullable<MemberModel['beamTheory']>>({ 'euler-bernoulli': true, timoshenko: true });

/** Un miembro rígido no expone rigidez: su comportamiento no procede de E, A ni I. */
const notRigid = (member: MemberModel): BulkIncompatibilityReason | undefined =>
  member.type === 'rigid' ? 'member-type' : undefined;

/** Liberaciones, semirrigidez, zonas rígidas y teoría de viga son propias del pórtico. */
const frameOnly = (member: MemberModel): BulkIncompatibilityReason | undefined =>
  member.type === 'frame' ? undefined : 'member-type';

const customSupportOnly = (node: NodeModel): BulkIncompatibilityReason | undefined =>
  node.support.type === 'custom' ? undefined : 'support-type';

const rollerOnly = (node: NodeModel): BulkIncompatibilityReason | undefined =>
  node.support.type === 'roller' ? undefined : 'support-type';

/** Un campo sólo existe en su familia de carga; fuera de ella no hay dónde escribirlo. */
const loadFamily = (...types: readonly MemberLoad['type'][]) =>
  (load: MemberLoad): BulkIncompatibilityReason | undefined =>
    types.includes(load.type) ? undefined : 'load-family';

const COORDINATE_SYSTEMS = optionsOf<LoadCoordinateSystem>({ global: true, local: true });
const LENGTH_BASES = optionsOf<LoadLengthBasis>({ real: true, horizontal: true, vertical: true });

const nodalLoadProperties: readonly BulkNodalLoadPropertyDescriptor[] = [
  { id: 'nodalLoad.caseId', group: 'load.nodal', entity: 'nodalLoad', kind: 'enum', editable: true, clearable: false, read: (load) => load.caseId },
  { id: 'nodalLoad.fx', group: 'load.nodal', entity: 'nodalLoad', kind: 'number', editable: true, clearable: false, quantity: 'force', read: (load) => load.fx },
  { id: 'nodalLoad.fy', group: 'load.nodal', entity: 'nodalLoad', kind: 'number', editable: true, clearable: false, quantity: 'force', read: (load) => load.fy },
  { id: 'nodalLoad.mz', group: 'load.nodal', entity: 'nodalLoad', kind: 'number', editable: true, clearable: false, quantity: 'moment', read: (load) => load.mz },
];

const memberLoadProperties: readonly BulkMemberLoadPropertyDescriptor[] = [
  { id: 'memberLoad.caseId', group: 'load.member', entity: 'memberLoad', kind: 'enum', editable: true, clearable: false, read: (load) => load.caseId },
  {
    id: 'memberLoad.coordinateSystem', group: 'load.distributedPoint', entity: 'memberLoad', kind: 'enum', editable: true, clearable: false,
    options: COORDINATE_SYSTEMS, ineligible: loadFamily('distributed', 'point'), read: (load) => load.coordinateSystem,
  },
  {
    id: 'memberLoad.lengthBasis', group: 'load.distributed', entity: 'memberLoad', kind: 'enum', editable: true, clearable: false,
    options: LENGTH_BASES, ineligible: loadFamily('distributed'), read: (load) => load.lengthBasis,
  },
  { id: 'memberLoad.start', group: 'load.distributed', entity: 'memberLoad', kind: 'number', editable: true, clearable: false, unit: 'x/L', ineligible: loadFamily('distributed'), read: (load) => load.start },
  { id: 'memberLoad.end', group: 'load.distributed', entity: 'memberLoad', kind: 'number', editable: true, clearable: false, unit: 'x/L', ineligible: loadFamily('distributed'), read: (load) => load.end },
  { id: 'memberLoad.qxStart', group: 'load.distributed', entity: 'memberLoad', kind: 'number', editable: true, clearable: true, quantity: 'distributedForce', ineligible: loadFamily('distributed'), read: (load) => load.qxStart },
  { id: 'memberLoad.qxEnd', group: 'load.distributed', entity: 'memberLoad', kind: 'number', editable: true, clearable: true, quantity: 'distributedForce', ineligible: loadFamily('distributed'), read: (load) => load.qxEnd },
  { id: 'memberLoad.qyStart', group: 'load.distributed', entity: 'memberLoad', kind: 'number', editable: true, clearable: true, quantity: 'distributedForce', ineligible: loadFamily('distributed'), read: (load) => load.qyStart },
  { id: 'memberLoad.qyEnd', group: 'load.distributed', entity: 'memberLoad', kind: 'number', editable: true, clearable: true, quantity: 'distributedForce', ineligible: loadFamily('distributed'), read: (load) => load.qyEnd },
  { id: 'memberLoad.position', group: 'load.pointMoment', entity: 'memberLoad', kind: 'number', editable: true, clearable: false, unit: 'x/L', ineligible: loadFamily('point', 'moment'), read: (load) => load.position },
  { id: 'memberLoad.px', group: 'load.point', entity: 'memberLoad', kind: 'number', editable: true, clearable: true, quantity: 'force', ineligible: loadFamily('point'), read: (load) => load.px },
  { id: 'memberLoad.py', group: 'load.point', entity: 'memberLoad', kind: 'number', editable: true, clearable: true, quantity: 'force', ineligible: loadFamily('point'), read: (load) => load.py },
  { id: 'memberLoad.moment', group: 'load.moment', entity: 'memberLoad', kind: 'number', editable: true, clearable: true, quantity: 'moment', ineligible: loadFamily('moment'), read: (load) => load.moment },
];

const memberProperties: readonly BulkMemberPropertyDescriptor[] = [
  {
    id: 'member.type', group: 'member', entity: 'member', kind: 'enum', editable: true, clearable: false,
    options: MEMBER_TYPES,
    read: (member) => member.type,
  },
  {
    id: 'member.materialId', group: 'member', entity: 'member', kind: 'material', editable: true, clearable: false,
    ineligible: notRigid,
    read: (member) => member.materialId,
  },
  {
    id: 'member.materialOrigin', group: 'member', entity: 'member', kind: 'enum', editable: false, clearable: false,
    options: PROPERTY_ORIGINS,
    ineligible: notRigid,
    read: (member) => member.materialOrigin,
  },
  {
    id: 'member.sectionId', group: 'member', entity: 'member', kind: 'section', editable: true, clearable: false,
    ineligible: notRigid,
    read: (member) => member.sectionId,
  },
  {
    id: 'member.sectionOrigin', group: 'member', entity: 'member', kind: 'enum', editable: false, clearable: false,
    options: PROPERTY_ORIGINS,
    ineligible: notRigid,
    read: (member) => member.sectionOrigin,
  },
  {
    id: 'member.E', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: false,
    quantity: 'elasticModulus', ineligible: notRigid,
    read: (member) => member.E,
  },
  {
    id: 'member.A', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: false,
    quantity: 'area', ineligible: notRigid,
    read: (member) => member.A,
  },
  {
    id: 'member.I', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: false,
    quantity: 'inertia', ineligible: notRigid,
    read: (member) => member.I,
  },
  {
    id: 'member.G', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: true,
    quantity: 'elasticModulus', ineligible: notRigid,
    read: (member) => member.G,
  },
  {
    id: 'member.shearArea', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: true,
    quantity: 'area', ineligible: frameOnly,
    read: (member) => member.shearArea,
  },
  {
    id: 'member.density', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: true,
    quantity: 'density', ineligible: notRigid,
    read: (member) => member.density,
  },
  {
    id: 'member.beamTheory', group: 'member', entity: 'member', kind: 'enum', editable: true, clearable: true,
    options: BEAM_THEORIES, ineligible: frameOnly,
    read: (member) => member.beamTheory,
  },
  {
    id: 'member.releases.iMoment', group: 'member', entity: 'member', kind: 'boolean', editable: true, clearable: true,
    ineligible: frameOnly,
    read: (member) => member.releases?.iMoment,
  },
  {
    id: 'member.releases.jMoment', group: 'member', entity: 'member', kind: 'boolean', editable: true, clearable: true,
    ineligible: frameOnly,
    read: (member) => member.releases?.jMoment,
  },
  {
    id: 'member.rotationalSpringI', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: true,
    quantity: 'rotationalStiffness', ineligible: frameOnly,
    read: (member) => member.rotationalSpringI,
  },
  {
    id: 'member.rotationalSpringJ', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: true,
    quantity: 'rotationalStiffness', ineligible: frameOnly,
    read: (member) => member.rotationalSpringJ,
  },
  {
    id: 'member.rigidOffsetI', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: true,
    quantity: 'length', ineligible: frameOnly,
    read: (member) => member.rigidOffsetI,
  },
  {
    id: 'member.rigidOffsetJ', group: 'member', entity: 'member', kind: 'number', editable: true, clearable: true,
    quantity: 'length', ineligible: frameOnly,
    read: (member) => member.rigidOffsetJ,
  },
];

const nodeProperties: readonly BulkNodePropertyDescriptor[] = [
  {
    id: 'node.support.type', group: 'node', entity: 'node', kind: 'enum', editable: true, clearable: false,
    options: SUPPORT_TYPES,
    read: (node) => node.support.type,
  },
  {
    id: 'node.support.angleDeg', group: 'node', entity: 'node', kind: 'number', editable: true, clearable: true,
    unit: '°', ineligible: rollerOnly,
    read: (node) => node.support.angleDeg,
  },
  {
    id: 'node.support.restrainX', group: 'node', entity: 'node', kind: 'boolean', editable: true, clearable: true,
    ineligible: customSupportOnly,
    read: (node) => node.support.restrainX,
  },
  {
    id: 'node.support.restrainY', group: 'node', entity: 'node', kind: 'boolean', editable: true, clearable: true,
    ineligible: customSupportOnly,
    read: (node) => node.support.restrainY,
  },
  {
    id: 'node.support.restrainR', group: 'node', entity: 'node', kind: 'boolean', editable: true, clearable: true,
    ineligible: customSupportOnly,
    read: (node) => node.support.restrainR,
  },
  {
    id: 'node.internalHinge', group: 'node', entity: 'node', kind: 'boolean', editable: true, clearable: true,
    read: (node) => node.internalHinge,
  },
];

/** Orden de lectura del panel: primero los miembros, después los nudos. */
export const bulkPropertyDescriptors: readonly BulkPropertyDescriptor[] = [
  ...memberProperties,
  ...nodeProperties,
  ...nodalLoadProperties,
  ...memberLoadProperties,
];
