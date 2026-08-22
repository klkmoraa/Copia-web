/**
 * The original Inspector kept every accordion id in one tolerant array.  The
 * split keeps that exact storage key while giving each independent surface an
 * ownership boundary.  Unknown ids deliberately remain in storage: they may
 * belong to a newer surface or an older extension.
 */
export const INSPECTOR_EXPANDED_STORAGE_KEY = 'structureCo.inspector.expanded.v1';

export type InspectorSurfacePreferenceOwner = 'detail' | 'analysisSetup' | 'view';

const OWNED_SECTION_IDS: Readonly<Record<InspectorSurfacePreferenceOwner, readonly string[]>> = {
  detail: ['advanced-node', 'advanced-member', 'advanced-nodal-load', 'advanced-member-load'],
  analysisSetup: ['analysis-load-cases', 'analysis-combinations', 'analysis-calculation-mode'],
  view: ['view-cad', 'view-layers', 'view-results'],
};

const readAll = (storage: Storage | undefined): string[] => {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INSPECTOR_EXPANDED_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export const readExpandedSectionsForSurface = (
  owner: InspectorSurfacePreferenceOwner,
  storage = typeof window === 'undefined' ? undefined : window.localStorage,
): string[] => {
  const owned = new Set(OWNED_SECTION_IDS[owner]);
  return readAll(storage).filter((id) => owned.has(id));
};

export const writeExpandedSectionsForSurface = (
  owner: InspectorSurfacePreferenceOwner,
  next: readonly string[],
  storage = typeof window === 'undefined' ? undefined : window.localStorage,
): void => {
  if (!storage) return;
  const owned = new Set(OWNED_SECTION_IDS[owner]);
  const retained = readAll(storage).filter((id) => !owned.has(id));
  const ownNext = next.filter((id) => owned.has(id));
  try {
    storage.setItem(INSPECTOR_EXPANDED_STORAGE_KEY, JSON.stringify([...new Set([...retained, ...ownNext])]));
  } catch {
    // UI preference persistence must never block property editing.
  }
};
