/**
 * Estado, historial y análisis de Space 3D.
 *
 * Vive completamente aparte de `ProjectContext` (2D): su propio proyecto, su
 * propia clave de almacenamiento y su propio worker. Abrir Space 3D nunca puede
 * alterar el modelo plano del usuario.
 *
 * El historial guarda snapshots completos. Un marco espacial de S3D-1 cabe de
 * sobra en memoria (150 nudos), y guardar estados en vez de comandos inversos
 * hace imposible que deshacer produzca un modelo que el validador rechazaría.
 *
 * `analysisState` distingue explícitamente `ready` de `stale`: un resultado
 * calculado para otra geometría sigue siendo información útil, pero no puede
 * presentarse como si describiera el modelo que hay en pantalla.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applySpace3DCommand, Space3DCommandError, type Space3DCommand } from '../data/commands';
import { parseSpace3DProject, serializeSpace3DProject, Space3DCodecError } from '../data/codec';
import { loadSpace3DProject, saveSpace3DProject, type Space3DStorageLike } from '../data/storage';
import { createBlankSpace3DProject, createSpace3DPortalExample } from '../model/defaultProject';
import { Space3DAnalysisCancelledError, Space3DWorkerClient, createSpace3DWorkerClient } from '../runtime/workerClient';
import type { Space3DAnalysisResult, Space3DProjectV1 } from '../model/types';

export type Space3DAnalysisState = 'idle' | 'running' | 'ready' | 'stale' | 'failed' | 'cancelled';

export type Space3DSelectionKind = 'node' | 'member' | 'load';

export interface Space3DSelection {
  readonly kind: Space3DSelectionKind;
  readonly id: string;
}

export type Space3DExecuteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface Space3DProjectContextValue {
  readonly project: Space3DProjectV1;
  readonly analysis: Space3DAnalysisResult | null;
  readonly analysisState: Space3DAnalysisState;
  readonly analysisTargetId: string;
  readonly selectedEntity: Space3DSelection | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly lastError: string | null;
  readonly lastErrorMessage: string | null;
  readonly execute: (command: Space3DCommand) => Space3DExecuteResult;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly analyze: () => Promise<void>;
  readonly cancelAnalysis: () => void;
  readonly setAnalysisTargetId: (targetId: string) => void;
  readonly replaceProject: (project: Space3DProjectV1) => void;
  readonly importPortable: (json: string) => Space3DExecuteResult;
  readonly exportPortable: () => string;
  readonly select: (selection: Space3DSelection | null) => void;
  readonly loadExample: () => void;
  readonly resetToBlank: () => void;
}

const Space3DProjectContext = createContext<Space3DProjectContextValue | null>(null);

interface History {
  readonly past: readonly Space3DProjectV1[];
  readonly present: Space3DProjectV1;
  readonly future: readonly Space3DProjectV1[];
}

const HISTORY_LIMIT = 100;

/**
 * Objetivo de analisis por defecto: el primer caso del proyecto y, si no hay
 * ninguno, la primera combinacion.
 *
 * Asumir `'LC1'` funcionaba mientras el unico proyecto posible fuera el
 * ejemplo. Un modelo importado o derivado de 2D trae los identificadores de su
 * origen, y con ellos el analisis fallaba con `unknown-target` sin que nada
 * explicara por que.
 */
const defaultTargetId = (project: Space3DProjectV1): string =>
  project.loadCases[0]?.id ?? project.loadCombinations[0]?.id ?? '';

const targetExists = (project: Space3DProjectV1, targetId: string): boolean =>
  project.loadCases.some((item) => item.id === targetId)
  || project.loadCombinations.some((item) => item.id === targetId);

const push = (history: History, next: Space3DProjectV1): History => ({
  past: [...history.past, history.present].slice(-HISTORY_LIMIT),
  present: next,
  future: [],
});

export interface Space3DProjectProviderProps {
  readonly children: ReactNode;
  readonly storage?: Space3DStorageLike | null;
  readonly client?: Space3DWorkerClient;
  readonly initialProject?: Space3DProjectV1;
  /** Aísla el almacenamiento de un Space 3D derivado del de uno independiente. */
  readonly namespace?: string;
}

export const Space3DProjectProvider = ({ children, storage, client, initialProject, namespace }: Space3DProjectProviderProps) => {
  const storageRef = useRef<Space3DStorageLike | null | undefined>(storage);
  storageRef.current = storage;

  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: initialProject ?? loadSpace3DProject(storage, namespace) ?? createSpace3DPortalExample(),
    future: [],
  }));
  const [analysis, setAnalysis] = useState<Space3DAnalysisResult | null>(null);
  const [analysisState, setAnalysisState] = useState<Space3DAnalysisState>('idle');
  const [analysisTargetId, setTargetId] = useState(() => defaultTargetId(history.present));
  const [selectedEntity, setSelectedEntity] = useState<Space3DSelection | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  const clientRef = useRef<Space3DWorkerClient | null>(null);
  const ownsClient = useRef(false);
  const alive = useRef(true);

  /**
   * El cliente se crea perezosamente y se suelta en cada limpieza.
   *
   * Un `Space3DWorkerClient` desechado lo está para siempre — es lo correcto
   * para `dispose()` —, así que el proveedor no puede guardar uno entre
   * montajes: con StrictMode (y con cualquier remontaje real) el segundo ciclo
   * se quedaría con un cliente muerto y todo análisis respondería «cancelado»
   * sin que nada lo explique.
   */
  const ensureClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = client ?? createSpace3DWorkerClient();
      ownsClient.current = client === undefined;
    }
    return clientRef.current;
  }, [client]);

  useEffect(() => {
    alive.current = true;
    const mounted = alive;
    return () => {
      mounted.current = false;
      const runner = clientRef.current;
      clientRef.current = null;
      if (ownsClient.current) runner?.dispose();
      else runner?.cancel();
    };
  }, []);

  const project = history.present;

  useEffect(() => {
    saveSpace3DProject(project, storageRef.current ?? undefined, namespace);
  }, [namespace, project]);

  /** Un resultado deja de describir el modelo en cuanto el modelo cambia. */
  const invalidate = useCallback(() => {
    setAnalysisState((current) => (current === 'ready' || current === 'stale' ? 'stale' : current === 'running' ? 'running' : current));
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
    setLastErrorMessage(null);
  }, []);

  const reportError = useCallback((code: string, message: string): Space3DExecuteResult => {
    setLastError(code);
    setLastErrorMessage(message);
    return { ok: false, code, message };
  }, []);

  const execute = useCallback((command: Space3DCommand): Space3DExecuteResult => {
    try {
      const next = applySpace3DCommand(history.present, command);
      setHistory((current) => push(current, next));
      clearError();
      invalidate();
      return { ok: true };
    } catch (error) {
      if (error instanceof Space3DCommandError) return reportError(error.code, error.message);
      throw error;
    }
  }, [clearError, history.present, invalidate, reportError]);

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
    invalidate();
  }, [invalidate]);

  const redo = useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) return current;
      const [next, ...rest] = current.future;
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
      };
    });
    invalidate();
  }, [invalidate]);

  const replaceProject = useCallback((next: Space3DProjectV1) => {
    setHistory((current) => push(current, next));
    setSelectedEntity(null);
    // Un proyecto nuevo puede no tener el objetivo actual: se realinea en vez
    // de dejar apuntando a un caso que ya no existe.
    setTargetId((current) => (targetExists(next, current) ? current : defaultTargetId(next)));
    clearError();
    invalidate();
  }, [clearError, invalidate]);

  const analyze = useCallback(async () => {
    const runner = ensureClient();
    setAnalysisState('running');
    clearError();
    try {
      const result = await runner.run(project, analysisTargetId);
      if (!alive.current) return;
      setAnalysis(result);
      setAnalysisState(result.success ? 'ready' : 'failed');
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof Space3DAnalysisCancelledError) {
        setAnalysisState('cancelled');
        return;
      }
      setAnalysisState('failed');
      reportError('analysis-failed', error instanceof Error ? error.message : String(error));
    }
  }, [analysisTargetId, clearError, ensureClient, project, reportError]);

  /**
   * Cambiar de objetivo deja obsoleto el resultado: describe otra combinacion de
   * cargas sobre la misma geometria, que es exactamente lo que `stale` significa.
   */
  const setAnalysisTargetId = useCallback((targetId: string) => {
    setTargetId((current) => {
      if (current !== targetId) invalidate();
      return targetId;
    });
  }, [invalidate]);

  const cancelAnalysis = useCallback(() => {
    clientRef.current?.cancel();
    setAnalysisState((current) => (current === 'running' ? 'cancelled' : current));
  }, []);

  const importPortable = useCallback((json: string): Space3DExecuteResult => {
    try {
      replaceProject(parseSpace3DProject(json));
      return { ok: true };
    } catch (error) {
      if (error instanceof Space3DCodecError) return reportError(error.code, error.message);
      return reportError('malformed-json', error instanceof Error ? error.message : String(error));
    }
  }, [replaceProject, reportError]);

  const exportPortable = useCallback(() => serializeSpace3DProject(project), [project]);

  const value = useMemo<Space3DProjectContextValue>(() => ({
    project,
    analysis,
    analysisState,
    analysisTargetId,
    selectedEntity,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    lastError,
    lastErrorMessage,
    execute,
    undo,
    redo,
    analyze,
    cancelAnalysis,
    setAnalysisTargetId,
    replaceProject,
    importPortable,
    exportPortable,
    select: setSelectedEntity,
    loadExample: () => replaceProject(createSpace3DPortalExample()),
    resetToBlank: () => replaceProject(createBlankSpace3DProject()),
  }), [
    analysis, analysisState, analysisTargetId, analyze, cancelAnalysis, execute, exportPortable,
    history.future.length, history.past.length, importPortable, lastError, lastErrorMessage,
    project, redo, replaceProject, selectedEntity, setAnalysisTargetId, undo,
  ]);

  return <Space3DProjectContext.Provider value={value}>{children}</Space3DProjectContext.Provider>;
};

// oxlint-disable-next-line react/only-export-components
export const useSpace3DProject = (): Space3DProjectContextValue => {
  const value = useContext(Space3DProjectContext);
  if (!value) throw new Error('useSpace3DProject requiere Space3DProjectProvider.');
  return value;
};
