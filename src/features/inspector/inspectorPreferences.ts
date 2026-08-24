/**
 * Secciones desplegadas del panel de propiedades, persistidas.
 *
 * La clave de almacenamiento es la del Inspector original y no cambia: lo que
 * un usuario tenia desplegado sigue desplegado tras esta reorganizacion.
 *
 * Los ids que no son de este panel se conservan intactos en el almacen. Pueden
 * venir de una version anterior o de una superficie que aun no existe, y
 * borrarlos al escribir seria decidir por ellas.
 *
 * Hubo un momento en que este modulo repartia la propiedad de las secciones
 * entre tres duenos —`detail`, `analysisSetup` y `view`— porque el panel eran
 * tres superficies. Solo `detail` llego a tener consumidor: los ids de los
 * otros dos (`analysis-*`, `view-*`) nunca los escribio nadie. Con el panel
 * unificado, el reparto se retira y queda lo que de verdad se usa.
 */
export const INSPECTOR_EXPANDED_STORAGE_KEY = 'structureCo.inspector.expanded.v1';

/**
 * Las secciones plegables que `InspectorProperties` puede desplegar.
 *
 * `section-builder` no es «avanzada»: es una herramienta que se abre cuando se
 * necesita y se cierra cuando no. Se persiste igual que las otras porque quien
 * está describiendo secciones a mano suele describir varias seguidas.
 */
const OWNED_SECTION_IDS: readonly string[] = [
  'advanced-node',
  'advanced-member',
  'advanced-nodal-load',
  'advanced-member-load',
  'section-builder',
];

const readAll = (storage: Storage | undefined): string[] => {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INSPECTOR_EXPANDED_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export const readExpandedSections = (
  storage = typeof window === 'undefined' ? undefined : window.localStorage,
): string[] => {
  const owned = new Set(OWNED_SECTION_IDS);
  return readAll(storage).filter((id) => owned.has(id));
};

export const writeExpandedSections = (
  next: readonly string[],
  storage = typeof window === 'undefined' ? undefined : window.localStorage,
): void => {
  if (!storage) return;
  const owned = new Set(OWNED_SECTION_IDS);
  const retained = readAll(storage).filter((id) => !owned.has(id));
  const ownNext = next.filter((id) => owned.has(id));
  try {
    storage.setItem(INSPECTOR_EXPANDED_STORAGE_KEY, JSON.stringify([...new Set([...retained, ...ownNext])]));
  } catch {
    // UI preference persistence must never block property editing.
  }
};
