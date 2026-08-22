import { describe, expect, it } from 'vitest';
import { createBlankProject, createDefaultProject, CURRENT_SCHEMA_VERSION } from './defaultProject';
import {
  loadProjectFromStorage,
  PROJECT_BACKUP_KEY,
  PROJECT_RECOVERY_KEY,
  PROJECT_STORAGE_KEY,
  saveProjectToStorage,
  type StorageLike,
} from './projectStorage';

const memoryStorage = (seed: Record<string, string> = {}): StorageLike & { data: Map<string, string> } => {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
};

describe('project storage recovery', () => {
  it('round-trips material and section identity through save and load', () => {
    const project = createDefaultProject();
    Object.assign(project.members[0] as object, {
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
    });
    const storage = memoryStorage();

    saveProjectToStorage(storage, project);
    const loaded = loadProjectFromStorage(storage).project;

    expect(loaded.members[0]).toMatchObject({
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
    });
  });

  it('rotates the previous valid project into a backup', () => {
    const first = createDefaultProject();
    first.name = 'First';
    const storage = memoryStorage();
    saveProjectToStorage(storage, first);
    const second = { ...first, name: 'Second' };
    saveProjectToStorage(storage, second);

    expect(JSON.parse(storage.getItem(PROJECT_BACKUP_KEY) ?? '{}').name).toBe('First');
    expect(JSON.parse(storage.getItem(PROJECT_STORAGE_KEY) ?? '{}').name).toBe('Second');
  });

  it('recovers a valid backup and preserves the damaged primary payload', () => {
    const backup = JSON.stringify(createDefaultProject());
    const damaged = '{not-json';
    const storage = memoryStorage({
      [PROJECT_STORAGE_KEY]: damaged,
      [PROJECT_BACKUP_KEY]: backup,
    });
    const loaded = loadProjectFromStorage(storage);

    expect(loaded.recoveredFromBackup).toBe(true);
    expect(loaded.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(storage.getItem(PROJECT_RECOVERY_KEY)).toBe(damaged);
  });

  it('uses the starter model if both persisted copies are invalid', () => {
    const storage = memoryStorage({
      [PROJECT_STORAGE_KEY]: '{bad',
      [PROJECT_BACKUP_KEY]: JSON.stringify({ schemaVersion: 999, nodes: [], members: [] }),
    });
    const loaded = loadProjectFromStorage(storage);
    expect(loaded.project).toMatchObject({
      name: createBlankProject().name,
      nodes: [],
      members: [],
      nodalLoads: [],
      memberLoads: [],
    });
    expect(loaded.recoveryMessage).toBeTruthy();
  });
});
