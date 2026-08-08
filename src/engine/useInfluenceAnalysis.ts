import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeAxleTrain,
  buildInfluenceLine,
  type AxleTrainEnvelope,
  type ConcentratedAxleTrain,
  type InfluenceLine,
  type InfluenceTarget,
} from './influence';
import { analysisSignature } from './projectSignature';
import type { ProjectModel } from '../types';

export interface InfluenceAnalysisInput {
  pathMemberIds: readonly string[];
  target: InfluenceTarget;
  startNodeId?: string;
  train?: ConcentratedAxleTrain | null;
}

export interface InfluenceAnalysisOutput {
  line: InfluenceLine;
  axleTrain: AxleTrainEnvelope | null;
}

interface InfluenceWorkerRequest {
  type: 'analyze-influence';
  requestId: number;
  project: ProjectModel;
  input: InfluenceAnalysisInput;
}

interface InfluenceWorkerSuccess {
  type: 'influence-result';
  requestId: number;
  result: InfluenceAnalysisOutput;
}

interface InfluenceWorkerFailure {
  type: 'influence-error';
  requestId: number;
  message: string;
}

type InfluenceWorkerResponse = InfluenceWorkerSuccess | InfluenceWorkerFailure;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'No se pudo calcular la línea de influencia.';

export const useInfluenceAnalysis = (project: ProjectModel) => {
  const [result, setResult] = useState<InfluenceAnalysisOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  // An influence line stays exact while only presentation settings change.
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
    setResult(null);
    setBusy(false);
    setError(null);
  }, [cancelPending]);

  useEffect(() => {
    setResult(null);
    setBusy(false);
    setError(null);
    return cancelPending;
  }, [cancelPending, signature]);

  const run = useCallback((input: InfluenceAnalysisInput) => {
    cancelPending();
    const requestId = requestRef.current;
    const project = projectRef.current;
    const immutableInput: InfluenceAnalysisInput = {
      ...input,
      pathMemberIds: [...input.pathMemberIds],
      target: { ...input.target },
      train: input.train
        ? {
            impactFactor: input.train.impactFactor,
            axles: input.train.axles.map((axle) => ({ ...axle })),
          }
        : null,
    };
    setBusy(true);
    setError(null);
    setResult(null);

    const fallback = () => {
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;
        if (requestRef.current !== requestId) return;
        try {
          const line = buildInfluenceLine(
            project,
            immutableInput.pathMemberIds,
            immutableInput.target,
            immutableInput.startNodeId,
          );
          const axleTrain = immutableInput.train
            ? analyzeAxleTrain(line, immutableInput.train)
            : null;
          if (requestRef.current !== requestId) return;
          setResult({ line, axleTrain });
        } catch (caught) {
          if (requestRef.current === requestId) setError(errorMessage(caught));
        } finally {
          if (requestRef.current === requestId) setBusy(false);
        }
      }, 0);
    };

    if (typeof Worker === 'undefined') {
      fallback();
      return;
    }
    try {
      const worker = new Worker(new URL('../workers/influence.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      let settled = false;
      const fallbackOnce = () => {
        if (settled || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        fallback();
      };
      worker.onmessage = (event: MessageEvent<InfluenceWorkerResponse>) => {
        if (settled || event.data.requestId !== requestId || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        if (event.data.type === 'influence-result') setResult(event.data.result);
        else setError(event.data.message);
        setBusy(false);
      };
      worker.onerror = fallbackOnce;
      const request: InfluenceWorkerRequest = {
        type: 'analyze-influence',
        requestId,
        project,
        input: immutableInput,
      };
      worker.postMessage(request);
    } catch {
      fallback();
    }
  }, [cancelPending]);

  return {
    line: result?.line ?? null,
    axleTrain: result?.axleTrain ?? null,
    busy,
    error,
    run,
    clear,
  };
};
