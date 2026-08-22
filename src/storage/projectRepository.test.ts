import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { normalizeProject } from '../data/migrate';
import { PROJECT_STORAGE_KEY, type StorageLike } from '../data/projectStorage';
import {
  InMemoryProjectRepository,
  RepositoryConflictError,
  migrateLegacyProject,
  projectChecksum,
  type StoredProjectRecord,
} from './projectRepository';

class MemoryStorage implements StorageLike {
  private readonly values: Map<string, string>;
  constructor(values = new Map<string, string>()) { this.values = values; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const checksumOf = async (serialized: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const seedHistoricalRecord = (repository: InMemoryProjectRepository, record: StoredProjectRecord) => {
  // The in-memory implementation uses the same record shape as IndexedDB; seed a v5 row
  // directly so the migration sees the persisted historical checksum rather than recalculating it.
  const projects = (repository as unknown as { projects: Map<string, StoredProjectRecord> }).projects;
  projects.set(record.id, structuredClone(record));
};

describe('ProjectRepository', () => {
  it('copies, reads back and marks a legacy project without deleting its source', async () => {
    const project = createDefaultProject();
    const raw = JSON.stringify(project);
    const storage = new MemoryStorage(new Map([[PROJECT_STORAGE_KEY, raw]]));
    const repository = new InMemoryProjectRepository();

    const first = await migrateLegacyProject(repository, storage);
    const second = await migrateLegacyProject(repository, storage);

    expect(first.status).toBe('migrated');
    expect(second.status).toBe('already-migrated');
    expect((await repository.openProject(project.id))?.project).toEqual(project);
    expect(storage.getItem(PROJECT_STORAGE_KEY)).toBe(raw);
    expect(await repository.listProjects()).toHaveLength(1);
  });

  it('preserves a conflicting write as a recovery instead of overwriting', async () => {
    const repository = new InMemoryProjectRepository();
    const project = createDefaultProject();
    const stored = await repository.saveProject(project);
    const concurrent = { ...project, name: 'Cambio de otra pestaña' };
    await repository.saveProject(concurrent, stored.revision);

    await expect(repository.saveProject({ ...project, name: 'Cambio local' }, stored.revision)).rejects.toBeInstanceOf(RepositoryConflictError);
    const current = await repository.openProject(project.id);
    expect(current?.project.name).toBe('Cambio de otra pestaña');
    expect((await repository.listRecoveries(project.id))[0]?.project.name).toBe('Cambio local');
  });

  it('does not overwrite IndexedDB when the legacy source has the same id and different content', async () => {
    const repository = new InMemoryProjectRepository();
    const stored = { ...createDefaultProject(), name: 'Revisión IndexedDB' };
    const legacy = { ...stored, name: 'Revisión localStorage' };
    await repository.saveProject(stored);
    const raw = JSON.stringify(legacy);
    const storage = new MemoryStorage(new Map([[PROJECT_STORAGE_KEY, raw]]));

    const result = await migrateLegacyProject(repository, storage);

    expect(result.status).toBe('conflict');
    expect((await repository.openProject(stored.id))?.project.name).toBe('Revisión IndexedDB');
    expect((await repository.listRecoveries(stored.id))[0]?.project.name).toBe('Revisión localStorage');
    expect(storage.getItem(PROJECT_STORAGE_KEY)).toBe(raw);
  });

  it('migrates a v5 IndexedDB checksum when localStorage has the equivalent normalized v6 project', async () => {
    const legacy = JSON.parse(JSON.stringify(createDefaultProject())) as Record<string, unknown>;
    legacy.schemaVersion = 5;
    for (const member of legacy.members as Array<Record<string, unknown>>) {
      delete member.materialId;
      delete member.materialOrigin;
      delete member.sectionId;
      delete member.sectionOrigin;
    }
    const v6 = normalizeProject(legacy);
    const historicalChecksum = await checksumOf(JSON.stringify(legacy));
    const repository = new InMemoryProjectRepository();
    seedHistoricalRecord(repository, {
      id: v6.id,
      name: v6.name,
      schemaVersion: 5,
      revision: 7,
      updatedAt: '2026-08-10T00:00:00.000Z',
      checksum: historicalChecksum,
      project: legacy as unknown as StoredProjectRecord['project'],
    });
    const storage = new MemoryStorage(new Map([[PROJECT_STORAGE_KEY, JSON.stringify(v6)]]));

    expect(historicalChecksum).not.toBe(await projectChecksum(v6));

    const first = await migrateLegacyProject(repository, storage);
    const second = await migrateLegacyProject(repository, storage);

    expect(first.status).toBe('migrated');
    expect(second.status).toBe('already-migrated');
    expect((await repository.listRecoveries(v6.id))).toHaveLength(0);
    expect(await repository.openProject(v6.id)).toMatchObject({
      schemaVersion: 6,
      revision: 8,
      checksum: await projectChecksum(v6),
      project: v6,
    });
  });

  it('renames and duplicates without sharing a project id or object graph', async () => {
    const repository = new InMemoryProjectRepository();
    const project = createDefaultProject();
    await repository.saveProject(project);
    await repository.renameProject(project.id, 'Proyecto renombrado');
    const duplicate = await repository.duplicateProject(project.id, 'Copia segura');

    expect((await repository.openProject(project.id))?.project.name).toBe('Proyecto renombrado');
    expect(duplicate.project.id).not.toBe(project.id);
    expect(duplicate.project.name).toBe('Copia segura');
    duplicate.project.nodes[0].x += 10;
    expect((await repository.openProject(project.id))?.project.nodes[0].x).toBe(project.nodes[0].x);
  });
});
