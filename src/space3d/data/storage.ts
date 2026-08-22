/**
 * Persistencia local de Space 3D con copia de seguridad.
 *
 * Claves propias, separadas del producto 2D: abrir Space 3D nunca puede tocar
 * el proyecto plano del usuario.
 *
 * El invariante del backup es simple y deliberado: el backup sólo se escribe
 * con contenido que ya se ha comprobado que parsea. Si el primary se corrompe
 * por cualquier motivo, guardar encima no arrastra esa corrupción al backup, y
 * el usuario conserva el último estado bueno.
 */
import { parseSpace3DDraft, serializeSpace3DProject } from './codec';
import type { Space3DProjectV1 } from '../model/types';

export const SPACE3D_STORAGE_KEY = 'structureco:space3d:v1';
export const SPACE3D_BACKUP_STORAGE_KEY = 'structureco:space3d:v1:backup';

export type Space3DStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Claves por espacio de trabajo. Un Space 3D derivado de un proyecto 2D vive en
 * su propio par de claves para que abrirlo no pise el Space 3D independiente
 * que el usuario tenga empezado desde Inicio, ni al revés.
 */
export const space3dStorageKeys = (namespace?: string) => (namespace
  ? { primary: `${SPACE3D_STORAGE_KEY}:${namespace}`, backup: `${SPACE3D_STORAGE_KEY}:${namespace}:backup` }
  : { primary: SPACE3D_STORAGE_KEY, backup: SPACE3D_BACKUP_STORAGE_KEY });

const browserStorage = (): Space3DStorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Safari en modo privado y algunos entornos embebidos lanzan al tocar `localStorage`.
    return null;
  }
};

const readValid = (storage: Space3DStorageLike, key: string): Space3DProjectV1 | null => {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return parseSpace3DDraft(raw);
  } catch {
    return null;
  }
};

export const loadSpace3DProject = (
  storage: Space3DStorageLike | null = browserStorage(),
  namespace?: string,
): Space3DProjectV1 | null => {
  if (!storage) return null;
  const keys = space3dStorageKeys(namespace);
  return readValid(storage, keys.primary) ?? readValid(storage, keys.backup);
};

/** Devuelve `true` sólo si el proyecto quedó realmente escrito y es recuperable. */
export const saveSpace3DProject = (
  project: Space3DProjectV1,
  storage: Space3DStorageLike | null = browserStorage(),
  namespace?: string,
): boolean => {
  if (!storage) return false;
  const keys = space3dStorageKeys(namespace);

  let payload: string;
  try {
    payload = serializeSpace3DProject(project);
    // Serializar no basta: el archivo tiene que volver a entrar por el códec.
    // Se comprueba la forma, no la admisibilidad: un modelo a medio completar
    // —el derivado de un proyecto 2D, por ejemplo— también tiene que sobrevivir
    // a una recarga.
    parseSpace3DDraft(payload);
  } catch {
    return false;
  }

  try {
    const current = storage.getItem(keys.primary);
    if (current !== null && current !== payload && readValid(storage, keys.primary)) {
      storage.setItem(keys.backup, current);
    }
    storage.setItem(keys.primary, payload);
    return true;
  } catch {
    return false;
  }
};

export const clearSpace3DProject = (
  storage: Space3DStorageLike | null = browserStorage(),
  namespace?: string,
): void => {
  if (!storage) return;
  const keys = space3dStorageKeys(namespace);
  try {
    storage.removeItem(keys.primary);
    storage.removeItem(keys.backup);
  } catch {
    // Un almacenamiento que no deja borrar tampoco deja guardar: no hay nada que rescatar.
  }
};
