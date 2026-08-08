import type { ProjectModel } from '../types';
import { createBlankProject } from './defaultProject';
import { normalizeProject } from './migrate';

export const PROJECT_STORAGE_KEY = 'structureCo.project';
export const PROJECT_BACKUP_KEY = 'structureCo.project.backup';
export const PROJECT_RECOVERY_KEY = 'structureCo.project.recovery';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StoredProjectLoad {
  project: ProjectModel;
  recoveredFromBackup: boolean;
  recoveryMessage?: string;
}

const parseProject = (serialized: string): ProjectModel =>
  normalizeProject(JSON.parse(serialized) as unknown);

/**
 * Loads the primary project and falls back to the last validated backup. A
 * malformed primary payload is copied verbatim to a recovery slot before the
 * app continues, so importing a damaged file never destroys forensic data.
 */
export const loadProjectFromStorage = (storage: StorageLike): StoredProjectLoad => {
  const primary = storage.getItem(PROJECT_STORAGE_KEY);
  if (primary !== null) {
    try {
      return { project: parseProject(primary), recoveredFromBackup: false };
    } catch (primaryError) {
      try {
        storage.setItem(PROJECT_RECOVERY_KEY, primary);
      } catch {
        // Recovery storage can be unavailable in privacy/quota constrained browsers.
      }
      const backup = storage.getItem(PROJECT_BACKUP_KEY);
      if (backup !== null) {
        try {
          return {
            project: parseProject(backup),
            recoveredFromBackup: true,
            recoveryMessage: primaryError instanceof Error ? primaryError.message : 'Proyecto local inválido.',
          };
        } catch {
          // Both persisted copies are invalid; the verified starter model is safer.
        }
      }
      return {
        project: createBlankProject(),
        recoveredFromBackup: false,
        recoveryMessage: primaryError instanceof Error ? primaryError.message : 'Proyecto local inválido.',
      };
    }
  }
  return { project: createBlankProject(), recoveredFromBackup: false };
};

/** Saves only normalized v3 data and rotates the previous valid primary copy. */
export const saveProjectToStorage = (storage: StorageLike, project: ProjectModel): void => {
  const normalized = normalizeProject(project);
  const serialized = JSON.stringify(normalized);
  const previous = storage.getItem(PROJECT_STORAGE_KEY);
  if (previous !== null) {
    try {
      parseProject(previous);
      storage.setItem(PROJECT_BACKUP_KEY, previous);
    } catch {
      try {
        storage.setItem(PROJECT_RECOVERY_KEY, previous);
      } catch {
        // The primary write below remains the important operation.
      }
    }
  } else {
    storage.setItem(PROJECT_BACKUP_KEY, serialized);
  }
  storage.setItem(PROJECT_STORAGE_KEY, serialized);
};
