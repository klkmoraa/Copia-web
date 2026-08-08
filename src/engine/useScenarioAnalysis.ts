import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeProjectScenarios, type AnalysisScenario } from './envelope';
import { analysisSignature } from './projectSignature';
import type { ProjectModel } from '../types';

interface ScenarioWorkerResponse {
  requestId: number;
  scenarios?: AnalysisScenario[];
  error?: string;
}

export const useScenarioAnalysis = (project: ProjectModel) => {
  const [scenarios, setScenarios] = useState<AnalysisScenario[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  // Scenarios stay valid while only presentation settings change, so the reset
  // is keyed on what the solver actually reads, not on project identity.
  const signature = useMemo(() => analysisSignature(project), [project]);
  const projectRef = useRef(project);
  projectRef.current = project;

  const cancelPending = useCallback(() => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    cancelPending();
    setScenarios(null);
    setBusy(false);
    setError(null);
  }, [cancelPending]);

  useEffect(() => {
    setScenarios(null);
    setBusy(false);
    setError(null);
    return cancelPending;
  }, [cancelPending, signature]);

  const run = useCallback(() => {
    cancelPending();
    const requestId = requestRef.current;
    const project = projectRef.current;
    setBusy(true);
    setError(null);
    const fallback = () => {
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;
        if (requestRef.current !== requestId) return;
        try {
          setScenarios(analyzeProjectScenarios(project));
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'No se pudieron comparar los escenarios.');
        } finally {
          setBusy(false);
        }
      }, 0);
    };
    if (typeof Worker === 'undefined') {
      fallback();
      return;
    }
    try {
      const worker = new Worker(new URL('../workers/scenarios.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      let settled = false;
      const fallbackOnce = () => {
        if (settled || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        fallback();
      };
      worker.onmessage = (event: MessageEvent<ScenarioWorkerResponse>) => {
        if (settled || event.data.requestId !== requestId || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        if (event.data.scenarios) setScenarios(event.data.scenarios);
        else setError(event.data.error ?? 'No se pudieron comparar los escenarios.');
        setBusy(false);
      };
      worker.onerror = fallbackOnce;
      worker.postMessage({ requestId, project });
    } catch {
      fallback();
    }
  }, [cancelPending]);

  return { scenarios, busy, error, run, clear };
};
