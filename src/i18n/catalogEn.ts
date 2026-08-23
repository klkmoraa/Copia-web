/**
 * Catálogo inglés completo, fundido de sus ocho dominios.
 *
 * Sólo se alcanza por importación dinámica desde `loadCatalog()` o, en las
 * pruebas, desde el arranque de Vitest que lo registra de una vez. Ese es el
 * motivo de que este archivo exista separado de `catalogEs.ts`: un `import`
 * estático desde `catalogs.ts` lo devolvería al chunk de entrada y el ahorro
 * desaparecería sin que ninguna prueba se enterara.
 *
 * El tipo `Catalog` obliga a que estén **todas** las claves del español; que
 * además digan lo mismo lo vigila `catalogs.test.ts`.
 */
import type { Catalog } from './catalogEs';
import { canvas } from './en/canvas';
import { inspector } from './en/inspector';
import { model } from './en/model';
import { results } from './en/results';
import { shell } from './en/shell';
import { space3d } from './en/space3d';
import { transfer } from './en/transfer';
import { welcome } from './en/welcome';

export const en: Catalog = {
  ...shell,
  ...welcome,
  ...canvas,
  ...inspector,
  ...results,
  ...model,
  ...transfer,
  ...space3d,
};
