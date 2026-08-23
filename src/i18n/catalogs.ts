/**
 * API pública de i18n: tipos, traducción y el registro de catálogos.
 *
 * Antes este archivo era el catálogo entero —4122 líneas con los dos idiomas
 * dentro—, y como `useI18n` lo importa, **ambos viajaban en el chunk de
 * entrada**: medido en `dist/assets/index-*.js`, un usuario en español
 * descargaba el inglés completo antes de pintar nada.
 *
 * Ahora el español se importa estático (es la reserva de `translate()`, no
 * puede llegar tarde) y el inglés se pide bajo demanda. `translate()` sigue
 * siendo **síncrona**: mientras el catálogo pedido no ha llegado responde en
 * español, que es exactamente lo que este archivo ya hacía con una clave
 * ausente. Ningún llamador cambia de forma.
 */
import { es } from './catalogEs';

export { es };
export type { Catalog, TranslationKey } from './catalogEs';
import type { Catalog, TranslationKey } from './catalogEs';

export type Language = 'es' | 'en';

/**
 * Registro vivo de catálogos resueltos. El español está desde el primer
 * instante; el inglés aparece cuando `loadCatalog('en')` termina.
 *
 * Es mutable a propósito: `translate()` lee de aquí en cada llamada, así que
 * registrar un idioma lo pone en circulación sin que nadie tenga que volver a
 * importar nada.
 */
export const catalogs: Partial<Record<Language, Catalog>> & { es: Catalog } = { es };

const listeners = new Set<() => void>();

/** Publica un catálogo ya resuelto y despierta a quien esté pintando texto. */
export const registerCatalog = (language: Language, catalog: Catalog): void => {
  if (catalogs[language] === catalog) return;
  catalogs[language] = catalog;
  for (const listener of listeners) listener();
};

/** Avisa cuando entra un catálogo nuevo, para repintar lo que se pintó en la reserva. */
export const subscribeToCatalogs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const pending = new Map<Language, Promise<Catalog>>();

/**
 * Trae un catálogo y lo registra. Idempotente y memoizada: pedir el mismo
 * idioma dos veces no dispara dos descargas.
 *
 * Un fallo de red no puede dejar la aplicación sin texto —la reserva española
 * sigue ahí—, así que se resuelve con el español en vez de propagar el error a
 * un componente que sólo quería pintar una etiqueta.
 */
export const loadCatalog = (language: Language): Promise<Catalog> => {
  const resolved = catalogs[language];
  if (resolved) return Promise.resolve(resolved);
  const existing = pending.get(language);
  if (existing) return existing;
  const request = import('./catalogEn')
    .then((module) => { registerCatalog('en', module.en); return module.en; })
    .catch(() => es);
  pending.set(language, request);
  return request;
};

/** `true` cuando el idioma ya puede pintarse sin caer en la reserva. */
export const isCatalogReady = (language: Language): boolean => catalogs[language] !== undefined;

export const translate = (
  language: Language,
  key: TranslationKey,
  variables?: Record<string, string | number>,
): string => {
  const template = catalogs[language]?.[key] ?? es[key];
  if (!variables) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : match);
};
