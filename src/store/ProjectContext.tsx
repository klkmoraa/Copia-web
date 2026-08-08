import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { unavailableAnalysis } from '../engine/analysisFailure';
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from '../engine/analysisWorkerProtocol';
import { normalizeProject } from '../data/migrate';
import { loadProjectFromStorage, saveProjectToStorage } from '../data/projectStorage';
import { repairProjectTopology } from '../data/modelOperations';
import type { AnalysisResult, ProjectModel, Selection, ThemeMode, Tool } from '../types';
import { ProjectModelContext, useProjectModel, type ProjectModelContextValue } from './ProjectModelContext';
import { ProjectAnalysisContext, useProjectAnalysis, type ProjectAnalysisContextValue, type InfluenceCanvasState } from './ProjectAnalysisContext';
import { WorkspaceUIContext, useWorkspaceUI, type WorkspaceUIContextValue, type ResultCursor, type ResultTab } from './WorkspaceUIContext';

// oxlint-disable-next-line react/only-export-components
export { useProjectModel } from './ProjectModelContext';
// oxlint-disable-next-line react/only-export-components
export { useProjectAnalysis } from './ProjectAnalysisContext';
// oxlint-disable-next-line react/only-export-components
export { useWorkspaceUI } from './WorkspaceUIContext';
export type { ResultTab, ResultCursor } from './WorkspaceUIContext';
export type { InfluenceCanvasState } from './ProjectAnalysisContext';

const runFallbackAnalysis = async (project: ProjectModel, combinationId: string, includeEducationTrace: boolean) => {
  const { analyzeProjectAuto } = await import('../engine/pDelta');
  const combination = project.combinations.find((item) => item.id === combinationId) ?? null;
  return analyzeProjectAuto(project, combination, { includeEducationTrace });
};

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [initial] = useState(() => loadProjectFromStorage(localStorage));
  const [project, setProject] = useState<ProjectModel>(initial.project);
  const [past, setPast] = useState<ProjectModel[]>([]);
  const [future, setFuture] = useState<ProjectModel[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selection, setSelectionState] = useState<Selection>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('structureCo.theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [resultTab, setResultTab] = useState<ResultTab>('moment');
  const [selectedCombinationId, setSelectedCombinationIdState] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [learningFocus, setLearningFocus] = useState<{ nodeIds: string[]; memberIds: string[] } | null>(null);
  const [resultCursor, setResultCursor] = useState<ResultCursor | null>(null);
  const [influenceCanvasState, setInfluenceCanvasState] = useState<InfluenceCanvasState | null>(null);
  const [transactionActive, setTransactionActive] = useState(false);
  const [persistenceRevision, setPersistenceRevision] = useState(0);
  const [storageState, setStorageState] = useState<{
    issue: 'recovered' | 'load-failed' | 'save-failed' | null;
    message: string | null;
  }>(() => ({
    issue: initial.recoveredFromBackup ? 'recovered' : initial.recoveryMessage ? 'load-failed' : null,
    message: initial.recoveryMessage ?? null,
  }));
  const projectRef = useRef(project);
  const selectionRef = useRef(selection);
  const analysisRef = useRef(analysis);
  const transactionStartRef = useRef<ProjectModel | null>(null);
  const analysisTimerRef = useRef<number | null>(null);
  const analysisRevisionRef = useRef(0);
  const analysisWorkerRef = useRef<Worker | null>(null);

  const setSelection = useCallback((next: Selection) => {
    selectionRef.current = next;
    setSelectionState(next);
  }, []);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  useEffect(() => { analysisRef.current = analysis; }, [analysis]);

  const invalidateAnalysis = useCallback(() => {
    analysisRevisionRef.current += 1;
    if (analysisTimerRef.current !== null) {
      window.clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    analysisWorkerRef.current?.terminate();
    analysisWorkerRef.current = null;
    setIsAnalyzing(false);
    setAnalysis(null);
    setResultCursor(null);
    setInfluenceCanvasState(null);
  }, []);

  useEffect(() => () => {
    if (analysisTimerRef.current !== null) window.clearTimeout(analysisTimerRef.current);
    analysisWorkerRef.current?.terminate();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('structureCo.theme', theme);
  }, [theme]);

  useEffect(() => {
    if (transactionActive) return;
    const handle = window.setTimeout(() => {
      try {
        saveProjectToStorage(localStorage, project);
        setStorageState((current) => current.issue === 'save-failed'
          ? { issue: null, message: null }
          : current);
      } catch (error) {
        setStorageState({
          issue: 'save-failed',
          message: error instanceof Error ? error.message : 'No se pudo guardar el proyecto.',
        });
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [project, persistenceRevision, transactionActive]);

  const analyze = useCallback(() => {
    if (analysisTimerRef.current !== null) window.clearTimeout(analysisTimerRef.current);
    analysisWorkerRef.current?.terminate();
    analysisWorkerRef.current = null;
    const currentProject = projectRef.current;
    const source = structuredClone(currentProject);
    const topologyRepair = repairProjectTopology(source);
    const topologyRepairCount = topologyRepair.mergedNodes.length + topologyRepair.splitMembers.length;
    if (topologyRepairCount > 0) {
      setPast((history) => [...history.slice(-49), currentProject]);
      setFuture([]);
      projectRef.current = source;
      setProject(source);
      setPersistenceRevision((revision) => revision + 1);
      const selected = selectionRef.current;
      if (selected?.kind === 'node') {
        const merge = topologyRepair.mergedNodes.find((item) => item.removedNodeId === selected.id);
        if (merge) setSelection({ kind: 'node', id: merge.keptNodeId });
      }
    }
    const requestRevision = analysisRevisionRef.current + 1;
    analysisRevisionRef.current = requestRevision;
    setIsAnalyzing(true);
    const complete = (nextResult: AnalysisResult) => {
      if (analysisRevisionRef.current !== requestRevision) return;
      const next = topologyRepairCount > 0 ? {
        ...nextResult,
        issues: [{
          id: 'topology-auto-repair',
          severity: 'info' as const,
          title: 'Topología conectada automáticamente',
          message: `Se ${topologyRepair.mergedNodes.length === 1 ? 'unió 1 par de nodos' : `unieron ${topologyRepair.mergedNodes.length} pares de nodos`} y se ${topologyRepair.splitMembers.length === 1 ? 'dividió 1 miembro' : `dividieron ${topologyRepair.splitMembers.length} miembros`} para que los apoyos y cruces coincidentes participen en el análisis.`,
          suggestedFix: 'Revisa la geometría reparada; puedes deshacerla desde el historial si la coincidencia era intencional.',
        }, ...nextResult.issues],
      } : nextResult;
      setAnalysis(next);
      setIsAnalyzing(false);
      if (!next.success) setResultTab('issues');
      else if (selectionRef.current?.kind !== 'member' && next.memberResults.length) {
        const critical = next.memberResults.reduce((best, current) => {
          const bestValue = Math.max(Math.abs(best.maxMoment), Math.abs(best.minMoment));
          const currentValue = Math.max(Math.abs(current.maxMoment), Math.abs(current.minMoment));
          return currentValue > bestValue ? current : best;
        });
        setSelection({ kind: 'member', id: critical.memberId });
      }
    };
    // A run that never produced numbers still has to reach the user: leaving
    // `isAnalyzing` set would freeze the UI on "analysing" with no explanation.
    const fail = (message: string) => complete(unavailableAnalysis(message));
    const runFallback = () => {
      analysisTimerRef.current = window.setTimeout(() => {
        analysisTimerRef.current = null;
        // Interactive edits never need the education trace up front — the
        // "Aprender" tab and PDF export fetch it on demand (AG-013).
        void runFallbackAnalysis(source, selectedCombinationId, false)
          .then(complete)
          .catch((error: unknown) => fail(error instanceof Error ? error.message : 'No se pudo completar el análisis estructural.'));
      }, 0);
    };
    if (typeof Worker === 'undefined') {
      runFallback();
      return;
    }
    try {
      const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
      analysisWorkerRef.current = worker;
      let settled = false;
      const fallbackOnce = () => {
        if (settled || analysisRevisionRef.current !== requestRevision) return;
        settled = true;
        worker.terminate();
        if (analysisWorkerRef.current === worker) analysisWorkerRef.current = null;
        runFallback();
      };
      worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
        if (settled || event.data.requestId !== requestRevision) return;
        settled = true;
        worker.terminate();
        if (analysisWorkerRef.current === worker) analysisWorkerRef.current = null;
        // `analysis-error` is a decision taken by the same pure function the
        // fallback would call, so recomputing it on the main thread would only
        // block the UI to reach the identical failure and hide its message.
        if (event.data.type === 'analysis-result') complete(event.data.result);
        else fail(event.data.message);
      };
      worker.onerror = fallbackOnce;
      const request: AnalysisWorkerRequest = { type: 'analyze', requestId: requestRevision, project: source, combinationId: selectedCombinationId || null, includeEducationTrace: false };
      worker.postMessage(request);
    } catch {
      runFallback();
    }
  }, [selectedCombinationId, setSelection]);

  // Standalone worker-or-fallback runner for `ensureEducationTrace`: unlike
  // `analyze()` above, this never touches history, selection or the revision
  // counter that governs the main interactive analysis — it only computes one
  // extra result, on demand, to read its `educationTrace` off of.
  const runAnalysisWithTrace = useCallback((source: ProjectModel, combinationId: string): Promise<AnalysisResult> => {
    return new Promise((resolve, reject) => {
      const runFallback = () => {
        void runFallbackAnalysis(source, combinationId, true).then(resolve).catch(reject);
      };
      if (typeof Worker === 'undefined') {
        runFallback();
        return;
      }
      try {
        const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
        let settled = false;
        const fallbackOnce = () => {
          if (settled) return;
          settled = true;
          worker.terminate();
          runFallback();
        };
        worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
          if (settled) return;
          settled = true;
          worker.terminate();
          if (event.data.type === 'analysis-result') resolve(event.data.result);
          else reject(new Error(event.data.message));
        };
        worker.onerror = fallbackOnce;
        const request: AnalysisWorkerRequest = { type: 'analyze', requestId: 0, project: source, combinationId: combinationId || null, includeEducationTrace: true };
        worker.postMessage(request);
      } catch {
        runFallback();
      }
    });
  }, []);

  const ensureEducationTrace = useCallback(async (): Promise<AnalysisResult | null> => {
    const target = analysisRef.current;
    if (!target || !target.success || target.educationTrace) return target;
    try {
      const withTrace = await runAnalysisWithTrace(projectRef.current, selectedCombinationId);
      // The project (or a fresh `analyze()` run) may have moved on while this
      // was in flight; only splice the trace onto the exact result it was
      // requested for, never onto whatever is current now.
      if (analysisRef.current !== target || !withTrace.educationTrace) return null;
      const merged = { ...target, educationTrace: withTrace.educationTrace };
      analysisRef.current = merged;
      setAnalysis(merged);
      return merged;
    } catch {
      return null;
    }
  }, [runAnalysisWithTrace, selectedCombinationId]);

  const setSelectedCombinationId = useCallback((id: string) => {
    if (id === selectedCombinationId) return;
    invalidateAnalysis();
    setSelectedCombinationIdState(id);
  }, [invalidateAnalysis, selectedCombinationId]);

  const renameProject = useCallback((name: string) => {
    const current = projectRef.current;
    if (name === current.name) return;
    const next = { ...current, name };
    projectRef.current = next;
    setProject(next);
  }, []);

  const updateProject = useCallback((updater: (project: ProjectModel) => ProjectModel, analyzeAfter = false) => {
    const current = projectRef.current;
    const next = updater(structuredClone(current));
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    setPast((history) => [...history.slice(-49), current]);
    setFuture([]);
    invalidateAnalysis();
    projectRef.current = next;
    setProject(next);
    if (analyzeAfter) {
      // `invalidateAnalysis` above already bumped the revision; publishing this
      // run without re-checking it would let a result from an older model land
      // on top of a newer edit.
      const requestRevision = analysisRevisionRef.current;
      window.setTimeout(() => {
        void runFallbackAnalysis(next, selectedCombinationId, false)
          .then((result) => { if (analysisRevisionRef.current === requestRevision) setAnalysis(result); })
          .catch((error: unknown) => {
            if (analysisRevisionRef.current !== requestRevision) return;
            setAnalysis(unavailableAnalysis(error instanceof Error ? error.message : 'No se pudo completar el análisis estructural.'));
          });
      }, 0);
    }
  }, [invalidateAnalysis, selectedCombinationId]);

  const updateProjectView = useCallback((updater: (project: ProjectModel) => ProjectModel) => {
    const current = projectRef.current;
    const next = updater(structuredClone(current));
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    projectRef.current = next;
    setProject(next);
  }, []);

  const beginProjectTransaction = useCallback(() => {
    if (transactionStartRef.current) return;
    transactionStartRef.current = structuredClone(projectRef.current);
    setTransactionActive(true);
  }, []);

  const updateProjectTransient = useCallback((updater: (project: ProjectModel) => ProjectModel) => {
    const current = projectRef.current;
    const next = updater(structuredClone(current));
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    projectRef.current = next;
    invalidateAnalysis();
    setProject(next);
  }, [invalidateAnalysis]);

  const moveNodeTransient = useCallback((nodeId: string, point: { x: number; y: number }) => {
    const current = projectRef.current;
    const index = current.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;
    const node = current.nodes[index];
    if (node.x === point.x && node.y === point.y) return;
    const nodes = current.nodes.slice();
    nodes[index] = { ...node, x: point.x, y: point.y };
    const next = { ...current, nodes };
    projectRef.current = next;
    invalidateAnalysis();
    setProject(next);
  }, [invalidateAnalysis]);

  const commitProjectTransaction = useCallback(() => {
    const start = transactionStartRef.current;
    transactionStartRef.current = null;
    if (start && JSON.stringify(start) !== JSON.stringify(projectRef.current)) {
      setPast((history) => [...history.slice(-49), start]);
      setFuture([]);
    }
    setTransactionActive(false);
    setPersistenceRevision((revision) => revision + 1);
  }, []);

  const cancelProjectTransaction = useCallback(() => {
    const start = transactionStartRef.current;
    transactionStartRef.current = null;
    if (start) {
      projectRef.current = start;
      setProject(start);
      invalidateAnalysis();
    }
    setTransactionActive(false);
    setPersistenceRevision((revision) => revision + 1);
  }, [invalidateAnalysis]);

  const replaceProject = useCallback((next: ProjectModel, restoredAnalysis?: AnalysisResult) => {
    const normalized = normalizeProject(next);
    setPast((history) => [...history.slice(-49), project]);
    setFuture([]);
    setProject(normalized);
    projectRef.current = normalized;
    invalidateAnalysis();
    if (restoredAnalysis) {
      setAnalysis(restoredAnalysis);
      setResultTab(restoredAnalysis.success ? 'summary' : 'issues');
    }
    setActiveTool('select');
    setSelectedCombinationIdState((current) => normalized.combinations.some((item) => item.id === current) ? current : '');
    setSelection(null);
    setResultCursor(null);
  }, [invalidateAnalysis, project, setSelection]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture((items) => [project, ...items].slice(0, 50));
    setPast(past.slice(0, -1));
    setProject(previous);
    projectRef.current = previous;
    invalidateAnalysis();
    setSelection(null);
  }, [invalidateAnalysis, past, project, setSelection]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const normalized = normalizeProject(future[0]);
    setPast((history) => [...history.slice(-49), project]);
    setFuture(future.slice(1));
    setProject(normalized);
    projectRef.current = normalized;
    invalidateAnalysis();
    setSelection(null);
  }, [future, invalidateAnalysis, project, setSelection]);

  const modelValue = useMemo<ProjectModelContextValue>(() => ({
    project,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    storageIssue: storageState.issue,
    storageMessage: storageState.message,
    renameProject, updateProject, updateProjectView, beginProjectTransaction, updateProjectTransient,
    moveNodeTransient, commitProjectTransaction, cancelProjectTransaction, replaceProject, undo, redo,
  }), [project, past.length, future.length, storageState.issue, storageState.message, renameProject, updateProject, updateProjectView, beginProjectTransaction, updateProjectTransient, moveNodeTransient, commitProjectTransaction, cancelProjectTransaction, replaceProject, undo, redo]);

  const analysisValue = useMemo<ProjectAnalysisContextValue>(() => ({
    analysis, isAnalyzing, selectedCombinationId, learningFocus, influenceCanvasState,
    setSelectedCombinationId, setLearningFocus, setInfluenceCanvasState, analyze, clearAnalysis: invalidateAnalysis,
    ensureEducationTrace,
  }), [analysis, isAnalyzing, selectedCombinationId, learningFocus, influenceCanvasState, setSelectedCombinationId, analyze, invalidateAnalysis, ensureEducationTrace]);

  const uiValue = useMemo<WorkspaceUIContextValue>(() => ({
    activeTool, selection, theme, resultTab, resultCursor,
    setActiveTool, setSelection, setTheme, setResultTab, setResultCursor,
  }), [activeTool, selection, theme, resultTab, resultCursor, setSelection]);

  return (
    <ProjectModelContext.Provider value={modelValue}>
      <ProjectAnalysisContext.Provider value={analysisValue}>
        <WorkspaceUIContext.Provider value={uiValue}>
          {children}
        </WorkspaceUIContext.Provider>
      </ProjectAnalysisContext.Provider>
    </ProjectModelContext.Provider>
  );
};

/**
 * Back-compat facade combining the three focused contexts into the original shape.
 * Prefer {@link useProjectModel}, {@link useProjectAnalysis} or {@link useWorkspaceUI} in new code:
 * this subscribes to all three and re-renders on any change to any of them.
 */
// oxlint-disable-next-line react/only-export-components
export const useProject = () => {
  const model = useProjectModel();
  const analysis = useProjectAnalysis();
  const ui = useWorkspaceUI();
  return useMemo(() => ({ ...model, ...analysis, ...ui }), [model, analysis, ui]);
};
