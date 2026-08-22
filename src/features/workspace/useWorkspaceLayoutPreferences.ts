import { useCallback, useEffect, useState } from 'react';

export const WORKSPACE_LAYOUT_STORAGE_KEY = 'structureco:workspace-layout:v1';

export type InspectorDetent = 'compact' | 'medium' | 'large';

/**
 * `toolRailCompact` ya NO vive aquí: desde CRI-89 la compacidad del riel se
 * deriva de la clase de composición (`isToolRailCompact`), no de una
 * preferencia. La clave persistida no sube de versión y el campo almacenado se
 * ignora **sin borrarlo** — ver `readPreferences` y el efecto de escritura.
 */
export interface WorkspaceLayoutPreferences {
  inspectorCollapsed: boolean;
  fullCanvas: boolean;
  inspectorWidth: number;
  inspectorDetent: InspectorDetent;
}

export const MIN_INSPECTOR_WIDTH = 280;
export const MAX_INSPECTOR_WIDTH = 480;
export const DEFAULT_INSPECTOR_WIDTH = 320;

export const normalizeInspectorDetent = (
  detent: InspectorDetent,
  viewport: { width: number; height: number },
): InspectorDetent => {
  if (viewport.height < 340) return 'compact';
  if (detent === 'large' && (viewport.width > viewport.height || viewport.height < 560)) return 'medium';
  return detent;
};

export const clampInspectorWidth = (value: number) => Math.min(
  MAX_INSPECTOR_WIDTH,
  Math.max(MIN_INSPECTOR_WIDTH, Math.round(value)),
);

const DEFAULT_PREFERENCES: WorkspaceLayoutPreferences = {
  inspectorCollapsed: false,
  fullCanvas: false,
  inspectorWidth: DEFAULT_INSPECTOR_WIDTH,
  inspectorDetent: 'medium',
};

/** Lo que hubiera en la clave y este lector ya no gobierna. Se conserva tal cual. */
const readStoredRecord = (): Record<string, unknown> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? '{}');
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

/**
 * Lectura tolerante: un `toolRailCompact` almacenado se descarta sin invalidar
 * el resto de la preferencia — inspector, detent, ancho y lienzo completo
 * siguen honrándose exactamente igual que antes de CRI-89.
 */
const readPreferences = (): WorkspaceLayoutPreferences => {
  const stored = readStoredRecord() as Partial<WorkspaceLayoutPreferences>;
  return {
    inspectorCollapsed: typeof stored.inspectorCollapsed === 'boolean' ? stored.inspectorCollapsed : DEFAULT_PREFERENCES.inspectorCollapsed,
    fullCanvas: typeof stored.fullCanvas === 'boolean' ? stored.fullCanvas : DEFAULT_PREFERENCES.fullCanvas,
    inspectorWidth: typeof stored.inspectorWidth === 'number' && Number.isFinite(stored.inspectorWidth)
      ? clampInspectorWidth(stored.inspectorWidth)
      : DEFAULT_PREFERENCES.inspectorWidth,
    inspectorDetent: stored.inspectorDetent === 'compact' || stored.inspectorDetent === 'medium' || stored.inspectorDetent === 'large'
      ? stored.inspectorDetent
      : DEFAULT_PREFERENCES.inspectorDetent,
  };
};

export const useWorkspaceLayoutPreferences = () => {
  const [preferences, setPreferences] = useState<WorkspaceLayoutPreferences>(readPreferences);

  useEffect(() => {
    try {
      // Se escribe SOBRE lo almacenado, no en su lugar: un `toolRailCompact`
      // heredado se ignora al leer pero sobrevive al escribir, así que revertir
      // el slice devuelve al usuario su preferencia intacta (rollback sin
      // migración destructiva).
      window.localStorage.setItem(
        WORKSPACE_LAYOUT_STORAGE_KEY,
        JSON.stringify({ ...readStoredRecord(), ...preferences }),
      );
    } catch {
      // Layout persistence is optional and must never interrupt the editor.
    }
  }, [preferences]);

  const setPreference = useCallback(<Key extends keyof WorkspaceLayoutPreferences>(
    key: Key,
    value: WorkspaceLayoutPreferences[Key],
  ) => setPreferences((current) => ({
    ...current,
    [key]: key === 'inspectorWidth' ? clampInspectorWidth(value as number) : value,
  })), []);

  const togglePreference = useCallback((key: keyof WorkspaceLayoutPreferences) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  return { preferences, setPreference, togglePreference };
};
