import type { BulkPropertyId, BulkValue } from './bulkEditTypes';

/**
 * Valor almacenado frente a valor efectivo.
 *
 * El modelo permite escribir la misma configuración estructural de dos formas:
 * omitiendo un campo opcional, o guardando explícitamente el valor que el solver
 * habría supuesto. Un rodillo sin `angleDeg` y otro con `angleDeg: 90` producen
 * exactamente la misma matriz de rigidez, así que leerlos como «Varios» describe
 * la representación interna, no la estructura.
 *
 * La única autoridad aquí es `src/engine/solver.ts`: cada entrada sustituye la
 * ausencia por la **misma constante** con la que el solver resuelve ese campo, y
 * cada una cita la línea que lo demuestra. No hay heurística, no se comparan
 * flotantes con tolerancia y no se infiere identidad de dos números parecidos:
 * sólo se sustituye `undefined` por el literal que el motor ya aplica.
 *
 * Una propiedad ausente de este registro no se normaliza. En particular quedan
 * fuera, a propósito:
 *
 * - `member.rotationalSpringI` / `J`: el solver documenta que ausente es una
 *   conexión rígida y `0` es el límite de liberación (solver.ts:113-115).
 *   Normalizarlos convertiría una conexión rígida en una articulación.
 * - `member.G` y `member.shearArea`: sólo se leen bajo Timoshenko
 *   (solver.ts:151, 228), así que su equivalencia depende de otra propiedad y no
 *   es canónica.
 *
 * Normalizar sólo afecta a la **lectura**: decide `same` frente a `mixed` y qué
 * valor actual se muestra. Nunca produce una escritura, porque el borrador sigue
 * conteniendo únicamente lo que el usuario tocó.
 */
export const BULK_CANONICAL_DEFAULTS: Partial<Record<BulkPropertyId, Exclude<BulkValue, undefined>>> = {
  /** solver.ts:518, 1428, 1667 — `support.angleDeg ?? 90` para un rodillo. */
  'node.support.angleDeg': 90,
  /** solver.ts:111-114 — `!explicitlyReleased`: ausente no está liberado. */
  'member.releases.iMoment': false,
  'member.releases.jMoment': false,
  /** solver.ts:452, 547 — `Boolean(support.restrainX)`: ausente no restringe. */
  'node.support.restrainX': false,
  'node.support.restrainY': false,
  'node.support.restrainR': false,
  /** solver.ts:675, 699 — la articulación interna se lee por veracidad. */
  'node.internalHinge': false,
  /** solver.ts:151, 228, 580 — sólo `'timoshenko'` cambia la formulación. */
  'member.beamTheory': 'euler-bernoulli',
  /** solver.ts:745, 1021 — `member.density ?? 0`: sin densidad no hay peso propio. */
  'member.density': 0,
  /** solver.ts:136-137, 594-595 — `member.rigidOffsetI ?? 0`. */
  'member.rigidOffsetI': 0,
  'member.rigidOffsetJ': 0,
};

/**
 * Valor efectivo de una propiedad. Sólo sustituye la ausencia: un valor que el
 * modelo guarda de verdad se devuelve intacto, incluidos `false` y `0`.
 */
export const canonicalBulkValue = (id: BulkPropertyId, value: BulkValue): BulkValue =>
  value === undefined ? BULK_CANONICAL_DEFAULTS[id] : value;
