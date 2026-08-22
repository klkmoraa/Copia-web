import { translate, type Language, type TranslationKey } from '../../i18n/catalogs';

/**
 * Acceso a la copia de «Generar estructura».
 *
 * Las cadenas viven en el catálogo global bajo el prefijo `generator.`, igual
 * que las de la edición múltiple bajo `bulk.`: un solo origen de texto y un solo
 * motor de interpolación. Este módulo sólo antepone el prefijo, de modo que el
 * panel sigue recibiendo el idioma por props y puede renderizarse con fixtures.
 */

type StripGeneratorPrefix<Key> = Key extends `generator.${infer Rest}` ? Rest : never;

/** Las claves `generator.*` del catálogo, sin el prefijo. */
export type StructureGeneratorCopyKey = StripGeneratorPrefix<TranslationKey>;

export type StructureGeneratorTranslate = (
  key: StructureGeneratorCopyKey,
  variables?: Record<string, string | number>,
) => string;

export const translateStructureGenerator = (
  language: Language,
  key: StructureGeneratorCopyKey,
  variables?: Record<string, string | number>,
): string => translate(language, `generator.${key}` as TranslationKey, variables);

export const createStructureGeneratorTranslator = (language: Language): StructureGeneratorTranslate =>
  (key, variables) => translateStructureGenerator(language, key, variables);
