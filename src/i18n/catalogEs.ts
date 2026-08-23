/**
 * Catálogo español completo, fundido de sus ocho dominios.
 *
 * El español es el idioma de reserva de `translate()`, así que viaja siempre
 * con la aplicación y se importa de forma estática: es el único catálogo que
 * puede resolver una clave sin esperar a nada. El inglés no tiene esa
 * obligación y por eso vive detrás de una importación dinámica
 * (`catalogEn.ts`), fuera del chunk de entrada.
 *
 * `TranslationKey` sigue derivando de este objeto, así que la lista de claves
 * la sigue mandando el español y ningún idioma puede inventarse una.
 */
import { canvas } from './es/canvas';
import { inspector } from './es/inspector';
import { model } from './es/model';
import { results } from './es/results';
import { shell } from './es/shell';
import { space3d } from './es/space3d';
import { transfer } from './es/transfer';
import { welcome } from './es/welcome';

export const es = {
  ...shell,
  ...welcome,
  ...canvas,
  ...inspector,
  ...results,
  ...model,
  ...transfer,
  ...space3d,
} as const;

export type TranslationKey = keyof typeof es;
export type Catalog = Record<TranslationKey, string>;
