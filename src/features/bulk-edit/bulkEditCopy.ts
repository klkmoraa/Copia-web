import { translate, type Language, type TranslationKey } from '../../i18n/catalogs';

/**
 * Acceso a la copia de la edición múltiple.
 *
 * Las cadenas viven en el catálogo global bajo el prefijo `bulk.`, igual que el
 * resto del producto: un solo origen de texto y un solo motor de interpolación.
 * Este módulo sólo antepone el prefijo, de modo que los componentes siguen
 * recibiendo el idioma por props y pueden renderizarse con fixtures.
 */

type StripBulkPrefix<Key> = Key extends `bulk.${infer Rest}` ? Rest : never;

/** Las claves `bulk.*` del catálogo, sin el prefijo. */
export type BulkEditCopyKey = StripBulkPrefix<TranslationKey>;

export type BulkEditTranslate = (
  key: BulkEditCopyKey,
  variables?: Record<string, string | number>,
) => string;

export const translateBulkEdit = (
  language: Language,
  key: BulkEditCopyKey,
  variables?: Record<string, string | number>,
): string => translate(language, `bulk.${key}` as TranslationKey, variables);

export const createBulkEditTranslator = (language: Language): BulkEditTranslate =>
  (key, variables) => translateBulkEdit(language, key, variables);
