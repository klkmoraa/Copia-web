import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { ThemeMode, UnitSystemId } from '../../types';
import type { CanvasViewSettings } from '../view/canvasViewSettings';

export const PERSONAL_LIBRARY_STORAGE_KEY = 'structureCo.personal-library.v1';
export const PERSONAL_LIBRARY_SCHEMA_VERSION = 1 as const;

interface PersonalFavoriteBase {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  unitsAtSave: UnitSystemId;
}

export interface PersonalMaterialFavorite extends PersonalFavoriteBase {
  kind: 'material';
  materialId: string;
}

export interface PersonalSectionFavorite extends PersonalFavoriteBase {
  kind: 'section';
  sectionId: string;
}

export interface PersonalPairFavorite extends PersonalFavoriteBase {
  kind: 'pair';
  materialId: string;
  sectionId: string;
}

export interface PersonalViewFavorite extends PersonalFavoriteBase {
  kind: 'view';
  theme: ThemeMode;
  view: CanvasViewSettings;
}

export type PersonalFavorite = PersonalMaterialFavorite | PersonalSectionFavorite | PersonalPairFavorite | PersonalViewFavorite;

export type PersonalFavoriteDraft =
  | Pick<PersonalMaterialFavorite, 'kind' | 'name' | 'materialId' | 'unitsAtSave'>
  | Pick<PersonalSectionFavorite, 'kind' | 'name' | 'sectionId' | 'unitsAtSave'>
  | Pick<PersonalPairFavorite, 'kind' | 'name' | 'materialId' | 'sectionId' | 'unitsAtSave'>
  | Pick<PersonalViewFavorite, 'kind' | 'name' | 'theme' | 'view' | 'unitsAtSave'>;

export type PersonalFavoriteFilter = 'all' | PersonalFavorite['kind'];

const UNIT_SYSTEMS: readonly UnitSystemId[] = ['kN-m', 'N-mm', 'kgf-m', 'kip-ft'];
const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const includes = <T extends string>(items: readonly T[], value: unknown): value is T => typeof value === 'string' && items.includes(value as T);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isIsoDate = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase();

const normalizeName = (name: string) => {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('El favorito necesita un nombre.');
  return normalized;
};

const assertUsableId = (library: readonly PersonalFavorite[], id: string) => {
  if (!id.trim() || library.some((favorite) => favorite.id === id)) {
    throw new Error('El identificador del favorito debe ser único y no vacío.');
  }
};

const assertUniqueActiveName = (library: readonly PersonalFavorite[], name: string, exceptId?: string) => {
  const key = normalizeSearch(name);
  if (library.some((favorite) => !favorite.deletedAt && favorite.id !== exceptId && normalizeSearch(favorite.name) === key)) {
    throw new Error('Ya existe un favorito activo con ese nombre.');
  }
};

const assertCatalogIdentity = (draft: PersonalFavoriteDraft) => {
  if ((draft.kind === 'material' || draft.kind === 'pair') && !findStandardMaterial(draft.materialId)) {
    throw new Error('El material de catálogo no está disponible.');
  }
  if ((draft.kind === 'section' || draft.kind === 'pair') && !findStandardSection(draft.sectionId)) {
    throw new Error('La sección de catálogo no está disponible.');
  }
};

const assertBooleanRecord = (value: unknown, keys: readonly string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Preferencias visuales inválidas.');
  const record = value as Record<string, unknown>;
  if (!keys.every((key) => typeof record[key] === 'boolean')) throw new Error('Preferencias visuales inválidas.');
};

const decodeView = (value: unknown): CanvasViewSettings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Preferencias visuales inválidas.');
  const view = value as Record<string, unknown>;
  const booleans = ['showGrid', 'snap', 'showNodeLabels', 'showMemberLabels', 'showLocalAxes', 'showDimensions', 'showLoads', 'showResultValues', 'showResultOverlay'] as const;
  if (!booleans.every((key) => typeof view[key] === 'boolean')) throw new Error('Preferencias visuales inválidas.');
  if (![view.gridSize, view.diagramScale, view.deformedScale].every(isFiniteNumber)) throw new Error('Preferencias visuales inválidas.');
  if ((view.gridSize as number) <= 0 || (view.diagramScale as number) < .1 || (view.deformedScale as number) < 1) throw new Error('Preferencias visuales inválidas.');
  if (view.diagramScaleMode !== 'common' && view.diagramScaleMode !== 'individual') throw new Error('Preferencias visuales inválidas.');
  if (view.diagramSide !== 'positive' && view.diagramSide !== 'negative') throw new Error('Preferencias visuales inválidas.');
  assertBooleanRecord(view.snapTargets, ['grid', 'nodes', 'midpoints', 'intersections', 'perpendicular']);
  assertBooleanRecord(view.selectionFilter, ['nodes', 'members', 'loads']);
  return structuredClone(value) as CanvasViewSettings;
};

const clonePayload = <T extends PersonalFavoriteDraft>(draft: T): T => draft.kind === 'view'
  ? { ...draft, view: structuredClone(draft.view) }
  : { ...draft };

export const createFavorite = (
  library: readonly PersonalFavorite[],
  rawDraft: PersonalFavoriteDraft,
  id = `favorite:${crypto.randomUUID()}`,
  now = new Date().toISOString(),
): PersonalFavorite[] => {
  const draft = clonePayload(rawDraft);
  const name = normalizeName(draft.name);
  if (!includes(UNIT_SYSTEMS, draft.unitsAtSave)) throw new Error('Sistema de unidades inválido.');
  if (!isIsoDate(now)) throw new Error('Fecha del favorito inválida.');
  assertUsableId(library, id);
  assertUniqueActiveName(library, name);
  assertCatalogIdentity(draft);
  if (draft.kind === 'view') draft.view = decodeView(draft.view);
  return [...library, { ...draft, id, name, createdAt: now, updatedAt: now } as PersonalFavorite];
};

export const renameFavorite = (
  library: readonly PersonalFavorite[],
  id: string,
  rawName: string,
  now = new Date().toISOString(),
): PersonalFavorite[] => {
  const favorite = library.find((item) => item.id === id);
  if (!favorite) return [...library];
  const name = normalizeName(rawName);
  if (!favorite.deletedAt) assertUniqueActiveName(library, name, id);
  return library.map((item) => item.id === id ? { ...item, name, updatedAt: now } : item);
};

export const duplicateFavorite = (
  library: readonly PersonalFavorite[],
  sourceId: string,
  rawName: string,
  duplicateId = `favorite:${crypto.randomUUID()}`,
  now = new Date().toISOString(),
): PersonalFavorite[] => {
  const source = library.find((favorite) => favorite.id === sourceId);
  if (!source) return [...library];
  const name = normalizeName(rawName);
  assertUsableId(library, duplicateId);
  assertUniqueActiveName(library, name);
  const copy = structuredClone(source);
  delete copy.deletedAt;
  return [...library, { ...copy, id: duplicateId, name, createdAt: now, updatedAt: now }];
};

export const deleteFavorite = (
  library: readonly PersonalFavorite[],
  id: string,
  now = new Date().toISOString(),
): PersonalFavorite[] => library.map((favorite) => favorite.id === id && !favorite.deletedAt
  ? { ...favorite, deletedAt: now, updatedAt: now }
  : favorite);

export const restoreFavorite = (
  library: readonly PersonalFavorite[],
  id: string,
  now = new Date().toISOString(),
): PersonalFavorite[] => {
  const favorite = library.find((item) => item.id === id);
  if (!favorite?.deletedAt) return [...library];
  assertUniqueActiveName(library, favorite.name, id);
  return library.map((item) => {
    if (item.id !== id) return item;
    const restored = { ...item, updatedAt: now };
    delete restored.deletedAt;
    return restored;
  });
};

export const uniqueFavoriteName = (library: readonly PersonalFavorite[], base: string) => {
  const normalizedBase = normalizeName(base);
  let candidate = normalizedBase;
  let index = 2;
  while (library.some((favorite) => !favorite.deletedAt && normalizeSearch(favorite.name) === normalizeSearch(candidate))) {
    candidate = `${normalizedBase} ${index++}`;
  }
  return candidate;
};

const favoriteSearchText = (favorite: PersonalFavorite) => {
  const parts = [favorite.name, favorite.kind, favorite.unitsAtSave, favorite.id];
  if (favorite.kind === 'material' || favorite.kind === 'pair') {
    const material = findStandardMaterial(favorite.materialId);
    parts.push(favorite.materialId, material?.name ?? '', material?.category ?? '');
  }
  if (favorite.kind === 'section' || favorite.kind === 'pair') {
    const section = findStandardSection(favorite.sectionId);
    parts.push(favorite.sectionId, section?.name ?? '', section?.standard ?? '', section?.shapeType ?? '');
  }
  const kindLabel = favorite.kind === 'material' ? 'material'
    : favorite.kind === 'section' ? 'sección seccion'
      : favorite.kind === 'pair' ? 'par material sección seccion'
        : 'vista visual';
  parts.push(kindLabel);
  return normalizeSearch(parts.join(' '));
};

export const searchFavorites = (
  library: readonly PersonalFavorite[],
  query: string,
  options: { filter?: PersonalFavoriteFilter; deleted?: boolean } = {},
) => {
  const filter = options.filter ?? 'all';
  const deleted = options.deleted ?? false;
  const needle = normalizeSearch(query);
  return library.filter((favorite) => Boolean(favorite.deletedAt) === deleted)
    .filter((favorite) => filter === 'all' || favorite.kind === filter)
    .filter((favorite) => !needle || favoriteSearchText(favorite).includes(needle));
};

const decodeBase = (raw: Record<string, unknown>) => {
  if (typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.name !== 'string') throw new Error('Favorito inválido.');
  if (!isIsoDate(raw.createdAt) || !isIsoDate(raw.updatedAt) || (hasOwn(raw, 'deletedAt') && raw.deletedAt !== undefined && !isIsoDate(raw.deletedAt))) throw new Error('Fecha del favorito inválida.');
  if (!includes(UNIT_SYSTEMS, raw.unitsAtSave)) throw new Error('Sistema de unidades inválido.');
  return {
    id: raw.id,
    name: normalizeName(raw.name),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    ...(typeof raw.deletedAt === 'string' ? { deletedAt: raw.deletedAt } : {}),
    unitsAtSave: raw.unitsAtSave,
  };
};

const decodeFavorite = (raw: unknown): PersonalFavorite => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Favorito inválido.');
  const value = raw as Record<string, unknown>;
  const base = decodeBase(value);
  if (value.kind === 'material' && typeof value.materialId === 'string' && value.materialId.trim()) {
    return { ...base, kind: 'material', materialId: value.materialId };
  }
  if (value.kind === 'section' && typeof value.sectionId === 'string' && value.sectionId.trim()) {
    return { ...base, kind: 'section', sectionId: value.sectionId };
  }
  if (value.kind === 'pair' && typeof value.materialId === 'string' && value.materialId.trim() && typeof value.sectionId === 'string' && value.sectionId.trim()) {
    return { ...base, kind: 'pair', materialId: value.materialId, sectionId: value.sectionId };
  }
  if (value.kind === 'view' && (value.theme === 'light' || value.theme === 'dark')) {
    return { ...base, kind: 'view', theme: value.theme, view: decodeView(value.view) };
  }
  throw new Error('Tipo de favorito inválido.');
};

export const readPersonalLibrary = (storage: Storage): PersonalFavorite[] => {
  try {
    const serialized = storage.getItem(PERSONAL_LIBRARY_STORAGE_KEY);
    if (!serialized) return [];
    const payload = JSON.parse(serialized) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    const record = payload as { schemaVersion?: unknown; favorites?: unknown };
    if (record.schemaVersion !== PERSONAL_LIBRARY_SCHEMA_VERSION || !Array.isArray(record.favorites)) return [];
    const library = record.favorites.map(decodeFavorite);
    const ids = new Set(library.map((favorite) => favorite.id));
    if (ids.size !== library.length) return [];
    const activeNames = library.filter((favorite) => !favorite.deletedAt).map((favorite) => normalizeSearch(favorite.name));
    if (new Set(activeNames).size !== activeNames.length) return [];
    return library;
  } catch {
    return [];
  }
};

export const writePersonalLibrary = (storage: Storage, library: readonly PersonalFavorite[]) => {
  try {
    storage.setItem(PERSONAL_LIBRARY_STORAGE_KEY, JSON.stringify({ schemaVersion: PERSONAL_LIBRARY_SCHEMA_VERSION, favorites: library }));
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: 'storage-unavailable' as const };
  }
};
