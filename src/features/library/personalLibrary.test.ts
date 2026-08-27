// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import {
  PERSONAL_LIBRARY_STORAGE_KEY,
  createFavorite,
  deleteFavorite,
  duplicateFavorite,
  readPersonalLibrary,
  renameFavorite,
  restoreFavorite,
  searchFavorites,
  uniqueFavoriteName,
  writePersonalLibrary,
} from './personalLibrary';

const NOW = '2026-08-24T12:00:00.000Z';
const LATER = '2026-08-24T13:00:00.000Z';

beforeEach(() => localStorage.clear());

describe('personal library boundary', () => {
  it('creates every safe kind with explicit identity and timestamps', () => {
    const view = readCanvasViewSettings(createDefaultProject());
    let library = createFavorite([], { kind: 'material', name: '  Acero A992  ', materialId: 'steel-a992', unitsAtSave: 'kN-m' }, 'fav-m', NOW);
    library = createFavorite(library, { kind: 'section', name: 'IPE 300', sectionId: 'ipe-300', unitsAtSave: 'N-mm' }, 'fav-s', NOW);
    library = createFavorite(library, { kind: 'pair', name: 'A992 + IPE 300', materialId: 'steel-a992', sectionId: 'ipe-300', unitsAtSave: 'kip-ft' }, 'fav-p', NOW);
    library = createFavorite(library, { kind: 'view', name: 'Vista limpia', theme: 'dark', view, unitsAtSave: 'kgf-m' }, 'fav-v', NOW);

    expect(library).toHaveLength(4);
    expect(library[0]).toEqual({ kind: 'material', id: 'fav-m', name: 'Acero A992', materialId: 'steel-a992', unitsAtSave: 'kN-m', createdAt: NOW, updatedAt: NOW });
    expect(library[2]).toMatchObject({ kind: 'pair', materialId: 'steel-a992', sectionId: 'ipe-300' });
    expect(library[3]).toMatchObject({ kind: 'view', theme: 'dark', view });
  });

  it('rejects unknown catalog ids, blank/duplicate names and duplicate ids', () => {
    expect(() => createFavorite([], { kind: 'material', name: 'No existe', materialId: 'missing', unitsAtSave: 'kN-m' }, 'x', NOW)).toThrow(/material/i);
    expect(() => createFavorite([], { kind: 'section', name: 'No existe', sectionId: 'missing', unitsAtSave: 'kN-m' }, 'x', NOW)).toThrow(/sección/i);
    const library = createFavorite([], { kind: 'material', name: 'Acero', materialId: 'steel-a36', unitsAtSave: 'kN-m' }, 'fav-1', NOW);
    expect(() => createFavorite(library, { kind: 'material', name: ' acero ', materialId: 'steel-a992', unitsAtSave: 'kN-m' }, 'fav-2', NOW)).toThrow(/nombre/i);
    expect(() => createFavorite(library, { kind: 'material', name: 'Otro', materialId: 'steel-a992', unitsAtSave: 'kN-m' }, 'fav-1', NOW)).toThrow(/identificador/i);
    expect(() => renameFavorite(library, 'fav-1', '  ', LATER)).toThrow(/nombre/i);
  });

  it('renames and duplicates without mutating the technical payload', () => {
    const original = createFavorite([], { kind: 'pair', name: 'Par', materialId: 'steel-a992', sectionId: 'ipe-300', unitsAtSave: 'kN-m' }, 'fav-1', NOW);
    const renamed = renameFavorite(original, 'fav-1', 'Par principal', LATER);
    const duplicated = duplicateFavorite(renamed, 'fav-1', 'Par copia', 'fav-2', LATER);

    expect(original[0].name).toBe('Par');
    expect(duplicated.map((favorite) => favorite.name)).toEqual(['Par principal', 'Par copia']);
    expect(duplicated[1]).toMatchObject({ materialId: 'steel-a992', sectionId: 'ipe-300', createdAt: LATER, updatedAt: LATER });
  });

  it('soft deletes, restores, and reports an active-name conflict without overwriting', () => {
    const first = createFavorite([], { kind: 'pair', name: 'Acero + IPE', materialId: 'steel-a992', sectionId: 'ipe-300', unitsAtSave: 'kN-m' }, 'fav-1', NOW);
    const deleted = deleteFavorite(first, 'fav-1', LATER);
    expect(deleted[0]).toMatchObject({ deletedAt: LATER });
    const occupied = createFavorite(deleted, { kind: 'material', name: 'Acero + IPE', materialId: 'steel-a36', unitsAtSave: 'kN-m' }, 'fav-2', LATER);
    expect(() => restoreFavorite(occupied, 'fav-1', LATER)).toThrow(/nombre/i);
    expect(occupied[0]).toMatchObject({ materialId: 'steel-a992', sectionId: 'ipe-300', deletedAt: LATER });
    const restored = restoreFavorite(renameFavorite(occupied, 'fav-1', 'Par restaurado', LATER), 'fav-1', LATER);
    expect(restored[0].deletedAt).toBeUndefined();
  });

  it('searches names, ids, catalog labels, standards, kinds and units', () => {
    let library = createFavorite([], { kind: 'material', name: 'Mi acero', materialId: 'steel-a992', unitsAtSave: 'kN-m' }, 'fav-1', NOW);
    library = createFavorite(library, { kind: 'section', name: 'Perfil europeo', sectionId: 'ipe-300', unitsAtSave: 'N-mm' }, 'fav-2', NOW);
    expect(searchFavorites(library, 'a992')).toHaveLength(1);
    expect(searchFavorites(library, 'ASTM')).toHaveLength(1);
    expect(searchFavorites(library, 'eurocode')).toHaveLength(1);
    expect(searchFavorites(library, 'n-mm')).toHaveLength(1);
    expect(searchFavorites(library, 'seccion')).toHaveLength(1);
    expect(uniqueFavoriteName(library, 'Mi acero')).toBe('Mi acero 2');
  });

  it('round-trips the versioned envelope and rejects corrupt or future payloads without rewriting them', () => {
    const library = createFavorite([], { kind: 'material', name: 'Acero', materialId: 'steel-a36', unitsAtSave: 'kN-m' }, 'fav-1', NOW);
    expect(writePersonalLibrary(localStorage, library)).toEqual({ ok: true });
    expect(readPersonalLibrary(localStorage)).toEqual(library);

    for (const original of ['{corrupt', JSON.stringify({ schemaVersion: 9, favorites: library }), JSON.stringify({ schemaVersion: 1, favorites: [{ future: true }] })]) {
      localStorage.setItem(PERSONAL_LIBRARY_STORAGE_KEY, original);
      expect(readPersonalLibrary(localStorage)).toEqual([]);
      expect(localStorage.getItem(PERSONAL_LIBRARY_STORAGE_KEY)).toBe(original);
    }
  });

  it('preserves an explicit catalog id that becomes unavailable so the UI can report it', () => {
    const unavailable = {
      kind: 'pair',
      id: 'fav-retired',
      name: 'Par retirado',
      materialId: 'catalog-material-retired',
      sectionId: 'catalog-section-retired',
      unitsAtSave: 'kN-m',
      createdAt: NOW,
      updatedAt: LATER,
    };
    localStorage.setItem(PERSONAL_LIBRARY_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, favorites: [unavailable] }));

    expect(readPersonalLibrary(localStorage)).toEqual([unavailable]);
  });

  it('returns a non-fatal write failure and never touches project persistence', () => {
    const project = '{"protected":"project"}';
    const storage = {
      getItem: (key: string) => key === 'structureCo.project' ? project : null,
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
    } as unknown as Storage;
    expect(writePersonalLibrary(storage, [])).toEqual({ ok: false, reason: 'storage-unavailable' });
    expect(storage.getItem('structureCo.project')).toBe(project);
  });
});
