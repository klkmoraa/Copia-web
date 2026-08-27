import { useCallback, useState } from 'react';
import {
  createFavorite,
  deleteFavorite,
  duplicateFavorite,
  readPersonalLibrary,
  renameFavorite,
  restoreFavorite,
  writePersonalLibrary,
  type PersonalFavorite,
  type PersonalFavoriteDraft,
} from './personalLibrary';

export type LibraryOperationResult =
  | { ok: true }
  | { ok: false; reason: 'storage-unavailable' | 'name-conflict' | 'invalid'; message?: string };

const classifyError = (error: unknown): LibraryOperationResult => {
  const message = error instanceof Error ? error.message : undefined;
  return {
    ok: false,
    reason: message?.toLocaleLowerCase().includes('ya existe') ? 'name-conflict' : 'invalid',
    message,
  };
};

export const usePersonalLibrary = (storage: Storage) => {
  const [library, setLibrary] = useState<PersonalFavorite[]>(() => readPersonalLibrary(storage));

  const commit = useCallback((operation: (current: readonly PersonalFavorite[]) => PersonalFavorite[]): LibraryOperationResult => {
    try {
      const next = operation(library);
      const written = writePersonalLibrary(storage, next);
      if (!written.ok) return { ok: false, reason: written.reason };
      setLibrary(next);
      return { ok: true };
    } catch (error) {
      return classifyError(error);
    }
  }, [library, storage]);

  return {
    library,
    create: (draft: PersonalFavoriteDraft) => commit((current) => createFavorite(current, draft)),
    rename: (id: string, name: string) => commit((current) => renameFavorite(current, id, name)),
    duplicate: (id: string, name: string) => commit((current) => duplicateFavorite(current, id, name)),
    remove: (id: string) => commit((current) => deleteFavorite(current, id)),
    restore: (id: string) => commit((current) => restoreFavorite(current, id)),
  };
};
