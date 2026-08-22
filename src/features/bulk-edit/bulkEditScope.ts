import {
  BULK_PROPERTY_GROUPS,
  type BulkEntityKind,
  type BulkPropertyGroupId,
  type BulkPropertyState,
  type BulkSelectionAggregate,
} from './bulkEditTypes';

/**
 * Alcance y agrupación del panel.
 *
 * Ambas cosas son **lentes del Inspector**: deciden qué se muestra y qué se
 * edita. Ninguna toca la selección del lienzo, ninguna llega al comando y
 * ninguna cambia lo que una intención preparada escribiría. Por eso este módulo
 * es puro y sólo lee la agregación.
 */

export type BulkScopeId = 'all' | 'member' | 'node' | 'load';

const SCOPE_OF: Record<BulkEntityKind, Exclude<BulkScopeId, 'all'>> = {
  member: 'member',
  node: 'node',
  nodalLoad: 'load',
  memberLoad: 'load',
};

const SCOPE_ORDER: readonly Exclude<BulkScopeId, 'all'>[] = ['member', 'node', 'load'];

/**
 * Filtros que tiene sentido ofrecer. Sólo aparecen las familias presentes, y
 * «Todos» sólo cuando hay más de una: un único filtro que no filtra nada es un
 * control que ocupa espacio y no decide nada.
 */
export const bulkScopeOptions = (aggregate: BulkSelectionAggregate): readonly BulkScopeId[] => {
  const present = SCOPE_ORDER.filter((scope) => aggregate.targets.some(
    (target) => SCOPE_OF[target.kind] === scope,
  ));
  return present.length > 1 ? ['all', ...present] : present;
};

export const propertiesInScope = (
  properties: readonly BulkPropertyState[],
  scope: BulkScopeId,
): readonly BulkPropertyState[] => (scope === 'all'
  ? properties
  : properties.filter((property) => SCOPE_OF[property.entity] === scope));

/**
 * Grupos que usan revelación progresiva.
 *
 * Un miembro tiene dieciocho propiedades y un nudo seis: esconder las menos
 * frecuentes ayuda a leer el panel. Una familia de carga tiene cuatro o menos, y
 * son exactamente el número que el usuario vino a cambiar; plegarlas convertía
 * editar una carga en una búsqueda dentro de un desplegable.
 */
export const BULK_DISCLOSED_GROUPS: readonly BulkPropertyGroupId[] = ['member', 'node'];

export interface BulkPropertyGroup {
  id: BulkPropertyGroupId;
  properties: readonly BulkPropertyState[];
}

/**
 * Agrupa en el orden de lectura declarado. Un grupo sin propiedades no se
 * devuelve: la lista ya llega filtrada por compatibilidad, así que una familia
 * ausente de la selección no puede producir un encabezado vacío.
 */
export const bulkPropertyGroups = (
  properties: readonly BulkPropertyState[],
): readonly BulkPropertyGroup[] => BULK_PROPERTY_GROUPS.flatMap((id) => {
  const owned = properties.filter((property) => property.group === id);
  return owned.length > 0 ? [{ id, properties: owned }] : [];
});
