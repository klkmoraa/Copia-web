import type { DiffChange, DiffChangeKind, DiffEntityKind, ProjectDiff } from '../../data/projectDiff';
import { formatSignificant } from '../../utils/numberFormat';

/**
 * Presentación de un diff estructural.
 *
 * `src/data/projectDiff.ts` calcula la diferencia y sabe resumirla en una
 * línea, pero esa línea está escrita en español dentro de la frontera
 * protegida: `describeDiff` sirve para un mensaje interno, no para una interfaz
 * que se lee también en inglés. Aquí no se recalcula nada — el diff es el que
 * es— sino que se ordena, se agrupa y se convierte a texto traducible.
 *
 * Es puro y no depende de React: lo prueba su propio gate y lo consume el panel
 * de versiones.
 */

/**
 * Orden en el que se enseñan las familias.
 *
 * No es alfabético: es el orden en el que un modelo se construye —geometría,
 * barras, cargas, casos— porque un cambio en un nudo explica los cambios de las
 * barras que lo tocan, y leerlo al revés obliga a volver atrás.
 */
export const DIFF_ENTITY_ORDER: readonly DiffEntityKind[] = [
  'node',
  'member',
  'nodalLoad',
  'memberLoad',
  'prescribedDisplacement',
  'memberInitialEffect',
  'loadCase',
  'combination',
  'settings',
];

/** Las tres cuentas, en orden fijo y sin las que valen cero. */
export const diffCounts = (diff: ProjectDiff): Array<{ change: DiffChangeKind; count: number }> =>
  (['added', 'modified', 'removed'] as const)
    .map((change) => ({ change, count: diff.summary[change] }))
    .filter((entry) => entry.count > 0);

export interface DiffGroup {
  kind: DiffEntityKind;
  changes: DiffChange[];
}

/**
 * Agrupa los cambios por familia, en el orden de `DIFF_ENTITY_ORDER` y, dentro
 * de cada familia, por id. Un diff llega en el orden en que el algoritmo
 * recorre las colecciones; enseñarlo así mezclaría nudos y barras según el
 * azar del recorrido.
 */
export const groupChangesByKind = (diff: ProjectDiff): DiffGroup[] => {
  const groups = new Map<DiffEntityKind, DiffChange[]>();
  for (const change of diff.changes) {
    const bucket = groups.get(change.kind);
    if (bucket) bucket.push(change); else groups.set(change.kind, [change]);
  }
  return DIFF_ENTITY_ORDER
    .filter((kind) => groups.has(kind))
    .map((kind) => ({
      kind,
      changes: [...groups.get(kind)!].sort((first, second) => first.id.localeCompare(second.id)),
    }));
};

export interface DiffValueLabels {
  /** Texto para un valor que no existe a un lado del cambio. */
  absent: string;
  yes: string;
  no: string;
}

const MAX_TEXT_LENGTH = 48;

/**
 * Texto de un valor del modelo.
 *
 * Los números se enseñan **en las unidades base del modelo** —metros, kN,
 * kN/m²—, que es como el diff los compara. Convertirlos al sistema del usuario
 * exigiría saber qué magnitud es cada campo, y esa tabla —`x` es longitud, `A`
 * es área, `E` es módulo, `angleDeg` no es ninguna de las dos— sería una lista
 * que se queda atrás en cuanto el modelo crezca, mintiendo justo en el campo
 * nuevo. El panel dice en qué unidades está leyendo en vez de adivinarlo.
 *
 * Los booleanos y la ausencia sí se traducen: son vocabulario, no magnitud.
 */
export const formatDiffValue = (value: unknown, labels: DiffValueLabels): string => {
  if (value === undefined || value === null) return labels.absent;
  if (typeof value === 'boolean') return value ? labels.yes : labels.no;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return Number.isNaN(value) ? 'NaN' : value > 0 ? '∞' : '−∞';
    return formatSignificant(value, 6);
  }
  if (typeof value === 'string') return value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH)}…` : value;
  const serialized = JSON.stringify(value) ?? String(value);
  return serialized.length > MAX_TEXT_LENGTH ? `${serialized.slice(0, MAX_TEXT_LENGTH)}…` : serialized;
};

export interface LimitedChanges {
  shown: DiffChange[];
  hidden: number;
}

/**
 * Recorta la lista a un máximo enseñable.
 *
 * Restaurar una versión antigua de un modelo grande produce miles de cambios, y
 * pintarlos todos convierte el panel en una pared que además cuesta pintar. Se
 * enseña un tramo y se dice **cuántos quedan fuera**: un «y 1 240 más» informa;
 * cortar en silencio, no.
 */
export const limitChanges = (changes: readonly DiffChange[], max: number): LimitedChanges => ({
  shown: changes.slice(0, Math.max(0, max)),
  hidden: Math.max(0, changes.length - Math.max(0, max)),
});
