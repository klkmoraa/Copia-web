import type { MemberType } from '../../types';
import { canonicalBulkValue } from './bulkEditEffective';
import { BULK_GATE_PROPERTIES, projectBulkSelection } from './bulkEditProjection';
import { bulkPropertyDescriptors } from './bulkEditProperties';
import { BULK_ENTITY_KINDS } from './bulkEditTypes';
import type {
  BulkEditDraft,
  AggregatedValue,
  BulkCompatibility,
  BulkEntityKind,
  BulkIncompatibilityReason,
  BulkIncompatibleTarget,
  BulkPropertyDescriptor,
  BulkPropertyId,
  BulkPropertyState,
  BulkSelectionAggregate,
  BulkSelectionInput,
  BulkTargetRef,
  BulkValue,
} from './bulkEditTypes';

/**
 * Agregación pura de una selección múltiple.
 *
 * No depende de React ni del store: recibe las entidades ya resueltas y devuelve
 * el estado agregado de cada propiedad. La misma entrada produce exactamente la
 * misma salida, que es lo que permite probar el contrato sin renderizar nada.
 */

/**
 * Reparte la familia de la propiedad entre las entidades que la admiten y las
 * que no. El motivo viaja con cada entidad rechazada: la UI no tiene que
 * deducirlo.
 *
 * El denominador es la **familia de la propiedad**, no la selección entera. Un
 * nudo no es «incompatible con la sección»: sencillamente no es un miembro, y
 * contarlo como rechazo convierte «2 de 7 compatibles» en un número que no
 * describe ninguna decisión. Las entidades de otras familias siguen presentes en
 * `aggregate.targets`, que es el alcance explícito.
 */
const resolveCompatibility = (
  descriptor: BulkPropertyDescriptor,
  family: readonly { id: string }[],
): { compatibility: BulkCompatibility; values: BulkValue[] } => {
  const compatible: BulkTargetRef[] = [];
  const incompatible: BulkIncompatibleTarget[] = [];
  const values: BulkValue[] = [];

  const ineligible = descriptor.ineligible as
    ((entity: { id: string }) => BulkIncompatibilityReason | undefined) | undefined;
  const read = descriptor.read as (entity: { id: string }) => BulkValue;

  for (const entity of family) {
    const target: BulkTargetRef = { kind: descriptor.entity, id: entity.id };
    const reason = ineligible?.(entity);
    if (reason) incompatible.push({ target, reason });
    else {
      compatible.push(target);
      // Se agrega el valor **efectivo**, no el almacenado: dos apoyos que el
      // solver resuelve igual no pueden leerse como «Varios» sólo porque uno
      // omita el campo que el otro guarda explícitamente.
      values.push(canonicalBulkValue(descriptor.id, read(entity)));
    }
  }

  return { compatibility: { selected: family.length, compatible, incompatible }, values };
};

/**
 * `same` sólo si todas las entidades compatibles coinciden. `undefined` es un
 * valor legítimo: dos miembros sin densidad comparten valor, no están «mezclados».
 *
 * El `Set` compara con SameValueZero, que sólo difiere de `Object.is` en `NaN`
 * y en `±0`; ninguno de los dos distingue un valor estructural real.
 */
const aggregateValues = (values: readonly BulkValue[]): AggregatedValue => {
  if (values.length === 0) return { state: 'incompatible' };
  const distinct = [...new Set(values)];
  return distinct.length === 1 ? { state: 'same', value: distinct[0] } : { state: 'mixed', values: distinct };
};

/** Los casos de carga son del proyecto, no del descriptor: se inyectan aquí. */
const optionsFor = (
  descriptor: BulkPropertyDescriptor,
  selection: BulkSelectionInput,
): readonly string[] | undefined => (
  descriptor.id === 'nodalLoad.caseId' || descriptor.id === 'memberLoad.caseId'
    ? selection.loadCases ?? []
    : descriptor.options
);

const aggregateProperty = (
  descriptor: BulkPropertyDescriptor,
  selection: BulkSelectionInput,
  family: readonly { id: string }[],
): BulkPropertyState => {
  const { compatibility, values } = resolveCompatibility(descriptor, family);
  return {
    id: descriptor.id,
    group: descriptor.group,
    entity: descriptor.entity,
    kind: descriptor.kind,
    editable: descriptor.editable,
    clearable: descriptor.clearable,
    quantity: descriptor.quantity,
    unit: descriptor.unit,
    options: optionsFor(descriptor, selection),
    value: aggregateValues(values),
    compatibility,
  };
};

const emptyMemberTypeCounts = (): Record<MemberType, number> => ({ frame: 0, truss: 0, rigid: 0 });

/** Sin borrador no hay proyección; la constante evita recrear el objeto por llamada. */
const EMPTY_DRAFT: BulkEditDraft = Object.freeze({});

/**
 * Agrega la selección. Con un borrador, las propiedades que dependen de una
 * puerta (`member.type`, `node.support.type`) se agregan sobre la selección
 * **proyectada**, de modo que habilitar y configurar caben en una sola
 * confirmación.
 *
 * Las puertas mismas se agregan siempre sobre la selección almacenada: su
 * «Actual» tiene que seguir siendo lo que el modelo guarda hoy, no la decisión
 * que el usuario acaba de preparar.
 */
export const aggregateBulkSelection = (
  selection: BulkSelectionInput,
  draft: BulkEditDraft = EMPTY_DRAFT,
): BulkSelectionAggregate => {
  const memberTypeCounts = emptyMemberTypeCounts();
  for (const member of selection.members) memberTypeCounts[member.type] += 1;

  const projected = projectBulkSelection(selection, draft);
  const nodalLoads = selection.nodalLoads ?? [];
  const memberLoads = selection.memberLoads ?? [];
  const families: Record<BulkEntityKind, readonly { id: string }[]> = {
    member: selection.members,
    node: selection.nodes,
    nodalLoad: nodalLoads,
    memberLoad: memberLoads,
  };
  const projectedFamilies: Record<BulkEntityKind, readonly { id: string }[]> = {
    member: projected.members,
    node: projected.nodes,
    nodalLoad: nodalLoads,
    memberLoad: memberLoads,
  };

  return {
    /*
     * El total es lo que el usuario seleccionó: nudos y miembros. Las cargas
     * llegan colgadas de esa selección, no elegidas una a una, así que contarlas
     * aquí diría «5 objetos seleccionados» cuando se marcaron 3.
     */
    total: selection.members.length + selection.nodes.length,
    counts: {
      member: selection.members.length,
      node: selection.nodes.length,
      nodalLoad: nodalLoads.length,
      memberLoad: memberLoads.length,
    },
    /*
     * Alcance explícito. Antes, saber si una entidad estaba en la selección
     * exigía buscarla entre los rechazos de alguna propiedad, lo que ataba esa
     * respuesta a que existiera una propiedad que la rechazara.
     */
    targets: BULK_ENTITY_KINDS.flatMap((kind) => families[kind].map((entity) => ({ kind, id: entity.id }))),
    memberTypeCounts,
    properties: bulkPropertyDescriptors.map((descriptor) => aggregateProperty(
      descriptor,
      selection,
      BULK_GATE_PROPERTIES.includes(descriptor.id)
        ? families[descriptor.entity]
        : projectedFamilies[descriptor.entity],
    )),
  };
};

export const findBulkProperty = (
  aggregate: BulkSelectionAggregate,
  id: BulkPropertyId,
): BulkPropertyState => {
  const state = aggregate.properties.find((property) => property.id === id);
  if (!state) throw new Error(`Unknown bulk property: ${id}`);
  return state;
};

/** Propiedades que la UI puede ofrecer: editables y con al menos un objetivo compatible. */
export const editableBulkProperties = (
  aggregate: BulkSelectionAggregate,
): readonly BulkPropertyState[] => aggregate.properties.filter(
  (property) => property.editable && property.compatibility.compatible.length > 0,
);
