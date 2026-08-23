/**
 * Diferencia estructural entre dos estados de un modelo.
 *
 * Contesta «¿qué cambió?» con el mismo vocabulario de objetos que usan el Model
 * Doctor y las incidencias del solver —nudo, barra, carga nodal, carga de
 * barra—, para que un cambio se pueda señalar en el lienzo sin traducir nada.
 *
 * Tiene dos clientes distintos y por eso vive en `data` y no en una vista:
 * comparar dos versiones guardadas de un proyecto, y enseñar **antes de
 * aplicarla** qué haría una operación propuesta. El segundo es el que exige que
 * esto sea exacto: una propuesta que se acepta a ciegas no está siendo revisada.
 */
import type { ProjectModel } from '../types';

export type DiffEntityKind =
  | 'node'
  | 'member'
  | 'nodalLoad'
  | 'memberLoad'
  | 'prescribedDisplacement'
  | 'memberInitialEffect'
  | 'loadCase'
  | 'combination'
  | 'settings';

export type DiffChangeKind = 'added' | 'removed' | 'modified';

export interface DiffFieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface DiffChange {
  kind: DiffEntityKind;
  id: string;
  change: DiffChangeKind;
  /** Vacío en altas y bajas: ahí lo que cambió es la existencia, no un campo. */
  fields: DiffFieldChange[];
}

export interface ProjectDiff {
  changes: DiffChange[];
  summary: Record<DiffChangeKind, number>;
  identical: boolean;
}

export interface DiffOptions {
  /**
   * Diferencia relativa por debajo de la cual dos números se consideran el
   * mismo. Por defecto **cero**: un diff miente si esconde algo.
   *
   * Se admite un valor mayor porque un proyecto que ha ido y vuelto de JSON
   * puede traer ruido en el último bit, y marcar eso como «modificado» sería
   * ruido que tapa los cambios de verdad. Es una decisión del llamador, no una
   * comodidad por defecto.
   */
  numericTolerance?: number;
}

const COLLECTIONS = [
  ['node', 'nodes'],
  ['member', 'members'],
  ['nodalLoad', 'nodalLoads'],
  ['memberLoad', 'memberLoads'],
  ['prescribedDisplacement', 'prescribedDisplacements'],
  ['memberInitialEffect', 'memberInitialEffects'],
  ['loadCase', 'loadCases'],
  ['combination', 'combinations'],
] as const;

type Identified = { id: string };

const sameNumber = (a: number, b: number, tolerance: number): boolean => {
  if (Object.is(a, b)) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (tolerance <= 0) return a === b;
  return Math.abs(a - b) <= tolerance * Math.max(Math.abs(a), Math.abs(b), 1);
};

/** Igualdad profunda con tolerancia numérica; `undefined` y ausente son lo mismo. */
const sameValue = (a: unknown, b: unknown, tolerance: number): boolean => {
  if (a === b) return true;
  if (a === undefined || b === undefined) return a === undefined && b === undefined;
  if (typeof a === 'number' && typeof b === 'number') return sameNumber(a, b, tolerance);
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => sameValue(value, b[index], tolerance));
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) =>
      sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], tolerance));
  }
  return false;
};

/** Campos que difieren entre dos objetos, mirando la unión de sus claves. */
const changedFields = (before: object, after: object, tolerance: number): DiffFieldChange[] => {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes: DiffFieldChange[] = [];
  for (const key of keys) {
    if (key === 'id') continue;
    const previous = (before as Record<string, unknown>)[key];
    const next = (after as Record<string, unknown>)[key];
    if (!sameValue(previous, next, tolerance)) changes.push({ field: key, before: previous, after: next });
  }
  return changes;
};

export const diffProjects = (before: ProjectModel, after: ProjectModel, options: DiffOptions = {}): ProjectDiff => {
  const tolerance = options.numericTolerance ?? 0;
  const changes: DiffChange[] = [];

  for (const [kind, collection] of COLLECTIONS) {
    const previousItems = (before[collection] ?? []) as readonly Identified[];
    const nextItems = (after[collection] ?? []) as readonly Identified[];
    const previousById = new Map(previousItems.map((item) => [item.id, item]));
    const nextById = new Map(nextItems.map((item) => [item.id, item]));

    // El orden de salida sigue el del modelo nuevo y luego las bajas, para que
    // dos ejecuciones sobre los mismos modelos den exactamente la misma lista.
    for (const item of nextItems) {
      const previous = previousById.get(item.id);
      if (!previous) { changes.push({ kind, id: item.id, change: 'added', fields: [] }); continue; }
      const fields = changedFields(previous, item, tolerance);
      if (fields.length) changes.push({ kind, id: item.id, change: 'modified', fields });
    }
    for (const item of previousItems) {
      if (!nextById.has(item.id)) changes.push({ kind, id: item.id, change: 'removed', fields: [] });
    }
  }

  const settingsFields = changedFields(before.settings, after.settings, tolerance);
  if (settingsFields.length) changes.push({ kind: 'settings', id: 'settings', change: 'modified', fields: settingsFields });

  const summary: Record<DiffChangeKind, number> = { added: 0, removed: 0, modified: 0 };
  for (const change of changes) summary[change.change] += 1;

  return { changes, summary, identical: changes.length === 0 };
};

/** Objetos que el diff toca, en el vocabulario que el lienzo y el Model Doctor entienden. */
export const affectedObjects = (diff: ProjectDiff): Array<{ kind: DiffEntityKind; id: string }> =>
  diff.changes.filter((change) => change.kind !== 'settings').map((change) => ({ kind: change.kind, id: change.id }));

/** Resumen de una línea, apto para un botón de confirmación. */
export const describeDiff = (diff: ProjectDiff): string => {
  if (diff.identical) return 'Sin cambios.';
  const parts: string[] = [];
  if (diff.summary.added) parts.push(`${diff.summary.added} alta(s)`);
  if (diff.summary.modified) parts.push(`${diff.summary.modified} modificación(es)`);
  if (diff.summary.removed) parts.push(`${diff.summary.removed} baja(s)`);
  return `${parts.join(', ')}.`;
};
