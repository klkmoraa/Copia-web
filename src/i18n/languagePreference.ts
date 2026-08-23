/**
 * Pista de idioma para arrancar la descarga del catálogo antes de saber el idioma.
 *
 * El idioma vive en el proyecto, y el proyecto se hidrata de IndexedDB, que es
 * asíncrono. Sin esta pista la secuencia de un recargado en inglés sería:
 * pintar en español (reserva) → hidratar → pedir el catálogo → repintar. El
 * usuario vería un parpadeo de español que antes no existía, porque antes el
 * inglés ya venía dentro del chunk de entrada.
 *
 * `localStorage` es síncrono, así que `main.tsx` puede leerlo y lanzar la
 * descarga en el primer instante, **en paralelo** con la hidratación. No es una
 * fuente de verdad: si miente o no está, no pasa nada — el idioma real sigue
 * saliendo del proyecto y `useI18n` pedirá el catálogo que toque.
 */
import { loadCatalog, type Language } from './catalogs';

const KEY = 'structureCo.languageHint';

const isLanguage = (value: string | null): value is Language => value === 'es' || value === 'en';

/** Guarda el idioma real del proyecto. Un almacenamiento bloqueado no es un error. */
export const rememberLanguage = (language: Language): void => {
  try {
    window.localStorage.setItem(KEY, language);
  } catch {
    // Modo privado, cuota llena o almacenamiento denegado: la pista es una
    // optimización, nunca un requisito.
  }
};

/**
 * Lanza la descarga del catálogo que probablemente haga falta. Se llama una vez,
 * en el arranque, y devuelve el idioma que se dio por probable para que una
 * prueba pueda comprobarlo sin espiar la red.
 */
export const preloadPreferredCatalog = (): Language => {
  let hint: string | null = null;
  try {
    hint = window.localStorage.getItem(KEY);
  } catch {
    hint = null;
  }
  const language: Language = isLanguage(hint) ? hint : 'es';
  if (language !== 'es') void loadCatalog(language);
  return language;
};
