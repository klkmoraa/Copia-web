import { useCallback, useSyncExternalStore } from 'react';
import { useProject } from '../store/ProjectContext';
import { isCatalogReady, loadCatalog, subscribeToCatalogs, translate, type Language, type TranslationKey } from './catalogs';

/**
 * Contador de catálogos registrados. Es el estado externo mínimo que hace
 * falta: cuando entra un idioma nuevo cambia el número y React repinta el
 * texto que se había resuelto en la reserva española.
 *
 * `useSyncExternalStore` y no un `useState` en cada componente porque los
 * suscriptores son muchos y el evento es único: el catálogo llega una sola vez
 * para toda la aplicación.
 */
let registeredCatalogs = 0;
subscribeToCatalogs(() => { registeredCatalogs += 1; });
const catalogVersion = () => registeredCatalogs;

/**
 * Pide el catálogo si aún no está. Se llama durante el render a propósito:
 * `loadCatalog` es idempotente y memoizada, así que llamarla de más no cuesta
 * una descarga, y esperar a un efecto retrasaría la petición un ciclo entero
 * de pintado en el único caso que importa —el primero.
 */
const ensureCatalog = (language: Language) => {
  if (!isCatalogReady(language)) void loadCatalog(language);
};

export const useI18n = () => {
  const { project } = useProject();
  const language = project.settings.language;
  const version = useSyncExternalStore(subscribeToCatalogs, catalogVersion, catalogVersion);
  ensureCatalog(language);
  const t = useCallback(
    (key: TranslationKey, variables?: Record<string, string | number>) =>
      translate(language, key, variables),
    // `version` no lo usa el cuerpo: está aquí para que la identidad de `t`
    // cambie cuando llega un catálogo nuevo y los consumidores memoizados
    // vuelvan a resolver sus textos en vez de quedarse con la reserva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, version],
  );
  return { language, t };
};
