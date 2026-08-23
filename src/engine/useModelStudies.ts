/**
 * Estudios opcionales sobre el modelo: pandeo, modos de vibración y certificado
 * numérico.
 *
 * Los tres se **piden**, no se calculan con cada análisis. Meterlos en
 * `analyze()` habría multiplicado el coste de cada análisis interactivo de todos
 * los modelos por unas lecturas que la mayoría no va a mirar: el pandeo levanta
 * un problema de autovalores y el certificado cuesta cuatro resoluciones extra.
 *
 * La forma es la de `useScenarioAnalysis`, que ya resolvió este mismo problema
 * para la comparación de escenarios: un worker por petición, cancelación por
 * `requestId`, y reserva síncrona cuando no hay `Worker` —que es lo que hace que
 * esto siga funcionando en las pruebas de jsdom—.
 *
 * ## Dos relojes de invalidación, no uno
 *
 * Un modo de un modelo que cambió no es un modo de este modelo, así que los tres
 * resultados se tiran cuando cambia `analysisSignature`. Pero **cambiar de
 * combinación no invalida lo mismo**: el pandeo y el certificado dependen de la
 * carga y hay que recalcularlos; los modos propios no dependen de ninguna carga,
 * y tirarlos sería descartar un resultado que sigue siendo válido.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectModel } from '../types';
import type { BucklingResult } from './buckling';
import type { NumericCertificate } from './certificate';
import type { ModalResult } from './modal';
import { analysisSignature } from './projectSignature';
import { handleStudiesEnvelope } from '../runtime/workerHandlers';
import {
  WORKER_PROTOCOL_VERSION,
  type StudiesWorkerPayload,
  type StudiesWorkerResult,
  type StudyKind,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from '../runtime/workerProtocol';

export interface ModelStudiesState {
  buckling: BucklingResult | null;
  modal: ModalResult | null;
  certificate: NumericCertificate | null;
  /** Qué estudio se está calculando ahora mismo, o `null`. Sólo uno a la vez. */
  busy: StudyKind | null;
  error: { kind: StudyKind; message: string } | null;
  run: (kind: StudyKind, options?: { modes?: number }) => void;
  clear: () => void;
}

const DEFAULT_MODES = 3;

export const useModelStudies = (project: ProjectModel, combinationId?: string | null): ModelStudiesState => {
  const [buckling, setBuckling] = useState<BucklingResult | null>(null);
  const [modal, setModal] = useState<ModalResult | null>(null);
  const [certificate, setCertificate] = useState<NumericCertificate | null>(null);
  const [busy, setBusy] = useState<StudyKind | null>(null);
  const [error, setError] = useState<{ kind: StudyKind; message: string } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  const signature = useMemo(() => analysisSignature(project), [project]);
  const projectRef = useRef(project);
  projectRef.current = project;
  const combinationRef = useRef(combinationId);
  combinationRef.current = combinationId;

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
    setBuckling(null);
    setModal(null);
    setCertificate(null);
    setBusy(null);
    setError(null);
  }, [cancelPending]);

  // Reloj 1: el modelo cambió. Nada de lo calculado describe ya a esta estructura.
  useEffect(() => {
    cancelPending();
    setBuckling(null);
    setModal(null);
    setCertificate(null);
    setBusy(null);
    setError(null);
    return cancelPending;
  }, [cancelPending, signature]);

  // Reloj 2: cambió la combinación. El pandeo se calcula sobre un estado axial y
  // el certificado sobre un resultado, así que los dos caducan; los modos
  // propios no dependen de ninguna carga y se quedan.
  useEffect(() => {
    setBuckling(null);
    setCertificate(null);
  }, [combinationId]);

  const publish = useCallback((payload: StudiesWorkerResult) => {
    if (payload.kind === 'buckling') setBuckling(payload.result);
    else if (payload.kind === 'modal') setModal(payload.result);
    else setCertificate(payload.result);
  }, []);

  const run = useCallback((kind: StudyKind, options?: { modes?: number }) => {
    cancelPending();
    const requestId = requestRef.current;
    const payload: StudiesWorkerPayload = {
      kind,
      project: projectRef.current,
      combinationId: combinationRef.current ?? null,
      modes: options?.modes ?? DEFAULT_MODES,
    };
    setBusy(kind);
    setError(null);

    const fallback = () => {
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;
        if (requestRef.current !== requestId) return;
        const response = handleStudiesEnvelope({
          protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'studies', requestId, payload,
        });
        if (response.type === 'success') publish(response.result);
        else setError({ kind, message: response.error.message });
        setBusy(null);
      }, 0);
    };

    if (typeof Worker === 'undefined') { fallback(); return; }

    try {
      const worker = new Worker(new URL('../workers/studies.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      let settled = false;
      const fallbackOnce = () => {
        if (settled || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        fallback();
      };
      worker.onmessage = (event: MessageEvent<WorkerResponseEnvelope<'studies', StudiesWorkerResult>>) => {
        if (settled || event.data.requestId !== requestId || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        if (event.data.type === 'success') publish(event.data.result);
        else setError({ kind, message: event.data.error.message });
        setBusy(null);
      };
      worker.onerror = fallbackOnce;
      const request: WorkerRequestEnvelope<'studies', StudiesWorkerPayload> = {
        protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'studies', requestId, payload,
      };
      worker.postMessage(request);
    } catch {
      fallback();
    }
  }, [cancelPending, publish]);

  return { buckling, modal, certificate, busy, error, run, clear };
};
