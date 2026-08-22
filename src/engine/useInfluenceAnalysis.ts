import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AxleTrainEnvelope,
  type InfluenceLine,
} from './influence';
import { analysisSignature } from './projectSignature';
import type { ProjectModel } from '../types';
import { handleInfluenceEnvelope } from '../runtime/workerHandlers';
import {
  WORKER_PROTOCOL_VERSION,
  type InfluenceAnalysisInput as ProtocolInfluenceAnalysisInput,
  type InfluenceWorkerPayload,
  type InfluenceWorkerResult,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from '../runtime/workerProtocol';

export type InfluenceAnalysisInput = ProtocolInfluenceAnalysisInput;

export interface InfluenceAnalysisOutput {
  line: InfluenceLine;
  axleTrain: AxleTrainEnvelope | null;
}

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
        const response = handleInfluenceEnvelope({
          protocolVersion: 1, type: 'run', domain: 'influence', requestId, payload: { project, input: immutableInput },
        });
        if (requestRef.current !== requestId) return;
        if (response.type === 'success') setResult(response.result);
        else setError(response.error.message);
        setBusy(false);
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
      worker.onmessage = (event: MessageEvent<WorkerResponseEnvelope<'influence', InfluenceWorkerResult>>) => {
        if (settled || event.data.requestId !== requestId || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        if (event.data.type === 'success') setResult(event.data.result);
        else setError(event.data.error.message);
        setBusy(false);
      };
      worker.onerror = fallbackOnce;
      const request: WorkerRequestEnvelope<'influence', InfluenceWorkerPayload> = {
        protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'influence', requestId,
        payload: { project, input: immutableInput },
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
