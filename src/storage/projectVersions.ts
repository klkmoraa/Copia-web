/**
 * Versiones nombradas de un proyecto y su comparación.
 *
 * Una versión es una instantánea que el usuario pidió y bautizó, frente a las
 * recuperaciones que el producto tiende solo antes de una operación delicada.
 * Comparten almacén a propósito —`RecoveryRecord` con `reason: 'version'` y
 * etiqueta—, así que restaurar una versión es exactamente restaurar una
 * recuperación: una sola ruta de escritura, probada una vez.
 *
 * Lo que aporta este archivo sobre el repositorio pelado son dos cosas que no
 * deberían repetirse en cada llamador: que una versión **exige** nombre, y que
 * comparar dos versiones es un diff estructural y no una lectura a ojo.
 */
import { normalizeProject } from '../data/migrate';
import { diffProjects, type ProjectDiff } from '../data/projectDiff';
import type { ProjectModel } from '../types';
import type { ProjectRepository, RecoveryRecord, StoredProjectRecord } from './projectRepository';

/** Una recuperación que además es una versión: siempre lleva etiqueta. */
export type NamedVersion = RecoveryRecord & { reason: 'version'; label: string };

const isNamedVersion = (record: RecoveryRecord): record is NamedVersion =>
  record.reason === 'version' && typeof record.label === 'string' && record.label.length > 0;

/**
 * Guarda el estado actual como versión nombrada.
 *
 * El nombre es obligatorio porque una lista de instantáneas sin nombre no es un
 * historial, es un montón: la fecha distingue dos versiones pero no dice cuál
 * era «antes de subir las cargas».
 */
export const saveNamedVersion = async (
  repository: ProjectRepository,
  project: ProjectModel,
  label: string,
): Promise<NamedVersion> => {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Una versión necesita un nombre que la distinga de las demás.');
  const record = await repository.createRecovery(project, 'version', trimmed);
  if (!isNamedVersion(record)) throw new Error('El repositorio no conservó la etiqueta de la versión.');
  return record;
};

/** Versiones nombradas de un proyecto, de la más reciente a la más antigua. */
export const listNamedVersions = async (
  repository: ProjectRepository,
  projectId: string,
): Promise<NamedVersion[]> =>
  (await repository.listRecoveries(projectId)).filter(isNamedVersion);

/** Devuelve el proyecto al estado de una versión, por la misma ruta que una recuperación. */
export const restoreNamedVersion = (
  repository: ProjectRepository,
  versionId: string,
): Promise<StoredProjectRecord> => repository.restoreRecovery(versionId);

export interface VersionComparison {
  from: NamedVersion;
  to: NamedVersion;
  diff: ProjectDiff;
  /** `true` cuando las dos versiones guardan exactamente el mismo modelo. */
  identical: boolean;
}

/**
 * Compara dos versiones. El atajo por checksum no es una optimización: es la
 * única forma de afirmar «son idénticas» sin depender de que el diff sepa mirar
 * cada campo que el modelo llegue a tener algún día.
 */
export const compareVersions = (from: NamedVersion, to: NamedVersion): VersionComparison => {
  if (from.checksum === to.checksum) {
    return { from, to, diff: { changes: [], summary: { added: 0, removed: 0, modified: 0 }, identical: true }, identical: true };
  }
  const diff = diffProjects(from.project, to.project);
  return { from, to, diff, identical: diff.identical };
};

/**
 * Compara una versión guardada con el estado que se está editando ahora.
 *
 * El proyecto actual se normaliza antes de comparar. No es un detalle: lo que
 * el repositorio guardó **ya está normalizado**, así que enfrentarlo con un
 * modelo en crudo inventa diferencias en cada campo que la normalización
 * rellena —`materialOrigin`, `sectionOrigin` y los que vengan— y el usuario
 * vería «modificado» en barras que nadie tocó. Comparar es comparar lo mismo
 * con lo mismo.
 */
export const compareVersionWithCurrent = (version: NamedVersion, current: ProjectModel): ProjectDiff =>
  diffProjects(version.project, normalizeProject(current));
