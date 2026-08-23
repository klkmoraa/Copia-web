import { CURRENT_SCHEMA_VERSION } from '../data/defaultProject';
import { normalizeProject } from '../data/migrate';
import { PROJECT_STORAGE_KEY, type StorageLike } from '../data/projectStorage';
import type { ProjectModel } from '../types';
import { createId } from '../utils/id';

const DATABASE_NAME = 'structureCo.projects';
const DATABASE_VERSION = 1;
const PROJECTS_STORE = 'projects';
const RECOVERIES_STORE = 'recoveries';
const META_STORE = 'meta';

export interface StoredProjectRecord {
  id: string;
  name: string;
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  checksum: string;
  project: ProjectModel;
}

export interface RecoveryRecord {
  id: string;
  projectId: string;
  /**
   * `'version'` es una instantánea que el usuario pidió y nombró; el resto son
   * redes que el producto tiende solo antes de una operación delicada.
   *
   * Una versión nombrada **es** una recuperación con etiqueta: mismo contenido,
   * mismo almacén, misma restauración. Darle un almacén propio habría duplicado
   * el esquema, la transacción y la ruta de restauración para no cambiar nada
   * de lo que se guarda.
   */
  reason: 'conflict' | 'manual' | 'migration' | 'dxf-import' | 'version';
  createdAt: string;
  checksum: string;
  /** Nombre que le dio el usuario. Sólo lo llevan las de `reason: 'version'`. */
  label?: string;
  project: ProjectModel;
}

export interface ProjectRepository {
  listProjects(): Promise<StoredProjectRecord[]>;
  openProject(id: string): Promise<StoredProjectRecord | null>;
  saveProject(project: ProjectModel, expectedRevision?: number): Promise<StoredProjectRecord>;
  renameProject(id: string, name: string): Promise<StoredProjectRecord>;
  duplicateProject(id: string, name: string): Promise<StoredProjectRecord>;
  createRecovery(project: ProjectModel, reason: RecoveryRecord['reason'], label?: string): Promise<RecoveryRecord>;
  listRecoveries(projectId?: string): Promise<RecoveryRecord[]>;
  restoreRecovery(id: string): Promise<StoredProjectRecord>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

export class RepositoryConflictError extends Error {
  readonly projectId: string;
  constructor(projectId: string) {
    super(`El proyecto ${projectId} cambió en otra pestaña; la edición local quedó en recuperación.`);
    this.projectId = projectId;
    this.name = 'RepositoryConflictError';
  }
}

const serializeProject = (project: ProjectModel): string => JSON.stringify(normalizeProject(project));

export const projectChecksum = async (project: ProjectModel): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto no está disponible para verificar el proyecto.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serializeProject(project)));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const projectRecord = async (project: ProjectModel, revision: number): Promise<StoredProjectRecord> => {
  const normalized = normalizeProject(project);
  return {
    id: normalized.id,
    name: normalized.name,
    schemaVersion: normalized.schemaVersion,
    revision,
    updatedAt: new Date().toISOString(),
    checksum: await projectChecksum(normalized),
    project: normalized,
  };
};

const recoveryRecord = async (project: ProjectModel, reason: RecoveryRecord['reason'], label?: string): Promise<RecoveryRecord> => {
  const normalized = normalizeProject(project);
  const trimmed = label?.trim();
  return {
    id: createId(), projectId: normalized.id, reason, createdAt: new Date().toISOString(),
    checksum: await projectChecksum(normalized),
    // Una etiqueta vacía no es una etiqueta: se omite en vez de guardarse como
    // cadena vacía, que luego habría que distinguir de «sin nombre» en cada lectura.
    ...(trimmed ? { label: trimmed } : {}),
    project: normalized,
  };
};

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, StoredProjectRecord>();
  private readonly recoveries = new Map<string, RecoveryRecord>();
  private readonly meta = new Map<string, string>();

  async listProjects() { return [...this.projects.values()].map((record) => structuredClone(record)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async openProject(id: string) { return this.projects.has(id) ? structuredClone(this.projects.get(id)!) : null; }

  async saveProject(project: ProjectModel, expectedRevision?: number) {
    const existing = this.projects.get(project.id);
    if (expectedRevision !== undefined && existing?.revision !== expectedRevision) {
      await this.createRecovery(project, 'conflict');
      throw new RepositoryConflictError(project.id);
    }
    const record = await projectRecord(project, (existing?.revision ?? 0) + 1);
    this.projects.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async renameProject(id: string, name: string) {
    const record = await this.openProject(id);
    if (!record) throw new Error(`No existe el proyecto ${id}.`);
    return this.saveProject({ ...record.project, name }, record.revision);
  }

  async duplicateProject(id: string, name: string) {
    const record = await this.openProject(id);
    if (!record) throw new Error(`No existe el proyecto ${id}.`);
    return this.saveProject({ ...structuredClone(record.project), id: createId(), name });
  }

  async createRecovery(project: ProjectModel, reason: RecoveryRecord['reason'], label?: string) {
    const record = await recoveryRecord(project, reason, label);
    this.recoveries.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async listRecoveries(projectId?: string) {
    return [...this.recoveries.values()]
      .filter((record) => !projectId || record.projectId === projectId)
      .map((record) => structuredClone(record))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async restoreRecovery(id: string) {
    const recovery = this.recoveries.get(id);
    if (!recovery) throw new Error(`No existe la recuperación ${id}.`);
    const current = this.projects.get(recovery.projectId);
    return this.saveProject(recovery.project, current?.revision);
  }

  async getMeta(key: string) { return this.meta.get(key) ?? null; }
  async setMeta(key: string, value: string) { this.meta.set(key, value); }
}

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Falló IndexedDB.'));
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error ?? new Error('La transacción IndexedDB fue cancelada.'));
  transaction.onerror = () => reject(transaction.error ?? new Error('Falló la transacción IndexedDB.'));
});

export class IndexedDbProjectRepository implements ProjectRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory;
  constructor(factory: IDBFactory = indexedDB) { this.factory = factory; }

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECTS_STORE)) database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        if (!database.objectStoreNames.contains(RECOVERIES_STORE)) database.createObjectStore(RECOVERIES_STORE, { keyPath: 'id' });
        if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
      request.onblocked = () => reject(new Error('IndexedDB está bloqueado por otra pestaña.'));
    });
    return this.databasePromise;
  }

  async listProjects() {
    const database = await this.database();
    const transaction = database.transaction(PROJECTS_STORE, 'readonly');
    const done = transactionDone(transaction);
    const records = await requestResult(transaction.objectStore(PROJECTS_STORE).getAll() as IDBRequest<StoredProjectRecord[]>);
    await done;
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async openProject(id: string) {
    const database = await this.database();
    const transaction = database.transaction(PROJECTS_STORE, 'readonly');
    const done = transactionDone(transaction);
    const record = await requestResult(transaction.objectStore(PROJECTS_STORE).get(id) as IDBRequest<StoredProjectRecord | undefined>);
    await done;
    return record ? structuredClone(record) : null;
  }

  async saveProject(project: ProjectModel, expectedRevision?: number) {
    const normalized = normalizeProject(project);
    const checksum = await projectChecksum(normalized);
    const database = await this.database();
    const transaction = database.transaction([PROJECTS_STORE, RECOVERIES_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const projectStore = transaction.objectStore(PROJECTS_STORE);
    const recoveryStore = transaction.objectStore(RECOVERIES_STORE);
    const existing = await requestResult(projectStore.get(project.id) as IDBRequest<StoredProjectRecord | undefined>);
    let conflict = false;
    let record: StoredProjectRecord;
    if (expectedRevision !== undefined && existing?.revision !== expectedRevision) {
      conflict = true;
      recoveryStore.put({ id: createId(), projectId: normalized.id, reason: 'conflict', createdAt: new Date().toISOString(), checksum, project: normalized } satisfies RecoveryRecord);
      record = existing ?? { id: normalized.id, name: normalized.name, schemaVersion: normalized.schemaVersion, revision: 0, updatedAt: new Date().toISOString(), checksum, project: normalized };
    } else {
      record = { id: normalized.id, name: normalized.name, schemaVersion: normalized.schemaVersion, revision: (existing?.revision ?? 0) + 1, updatedAt: new Date().toISOString(), checksum, project: normalized };
      projectStore.put(record);
    }
    await done;
    if (conflict) throw new RepositoryConflictError(project.id);
    return structuredClone(record);
  }

  async renameProject(id: string, name: string) {
    const record = await this.openProject(id);
    if (!record) throw new Error(`No existe el proyecto ${id}.`);
    return this.saveProject({ ...record.project, name }, record.revision);
  }

  async duplicateProject(id: string, name: string) {
    const record = await this.openProject(id);
    if (!record) throw new Error(`No existe el proyecto ${id}.`);
    return this.saveProject({ ...structuredClone(record.project), id: createId(), name });
  }

  async createRecovery(project: ProjectModel, reason: RecoveryRecord['reason'], label?: string) {
    const record = await recoveryRecord(project, reason, label);
    const database = await this.database();
    const transaction = database.transaction(RECOVERIES_STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(RECOVERIES_STORE).put(record);
    await done;
    return structuredClone(record);
  }

  async listRecoveries(projectId?: string) {
    const database = await this.database();
    const transaction = database.transaction(RECOVERIES_STORE, 'readonly');
    const done = transactionDone(transaction);
    const records = await requestResult(transaction.objectStore(RECOVERIES_STORE).getAll() as IDBRequest<RecoveryRecord[]>);
    await done;
    return records.filter((record) => !projectId || record.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async restoreRecovery(id: string) {
    const recoveries = await this.listRecoveries();
    const recovery = recoveries.find((record) => record.id === id);
    if (!recovery) throw new Error(`No existe la recuperación ${id}.`);
    const current = await this.openProject(recovery.projectId);
    return this.saveProject(recovery.project, current?.revision);
  }

  async getMeta(key: string) {
    const database = await this.database();
    const transaction = database.transaction(META_STORE, 'readonly');
    const done = transactionDone(transaction);
    const record = await requestResult(transaction.objectStore(META_STORE).get(key) as IDBRequest<{ key: string; value: string } | undefined>);
    await done;
    return record?.value ?? null;
  }

  async setMeta(key: string, value: string) {
    const database = await this.database();
    const transaction = database.transaction(META_STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(META_STORE).put({ key, value });
    await done;
  }
}

let sharedRepository: ProjectRepository | null = null;
export const getProjectRepository = (): ProjectRepository => {
  sharedRepository ??= new IndexedDbProjectRepository();
  return sharedRepository;
};

export type LegacyMigrationResult = { status: 'no-source' | 'migrated' | 'already-migrated' | 'conflict'; record?: StoredProjectRecord };

export const migrateLegacyProject = async (repository: ProjectRepository, storage: StorageLike): Promise<LegacyMigrationResult> => {
  const raw = storage.getItem(PROJECT_STORAGE_KEY);
  if (raw === null) return { status: 'no-source' };
  const project = normalizeProject(JSON.parse(raw) as unknown);
  const checksum = await projectChecksum(project);
  const markerKey = `legacy-v${CURRENT_SCHEMA_VERSION}:${project.id}:${checksum}`;
  if (await repository.getMeta(markerKey)) return { status: 'already-migrated', record: await repository.openProject(project.id) ?? undefined };
  const existing = await repository.openProject(project.id);
  if (existing && serializeProject(existing.project) !== serializeProject(project)) {
    await repository.createRecovery(project, 'migration');
    return { status: 'conflict', record: existing };
  }
  const written = existing?.checksum === checksum && existing.schemaVersion === CURRENT_SCHEMA_VERSION
    ? existing
    : await repository.saveProject(project, existing?.revision);
  const readBack = await repository.openProject(project.id);
  if (!readBack || readBack.checksum !== checksum || serializeProject(readBack.project) !== serializeProject(project)) {
    throw new Error('La copia IndexedDB no superó la verificación de lectura.');
  }
  await repository.setMeta(markerKey, readBack.checksum);
  return { status: 'migrated', record: written };
};
