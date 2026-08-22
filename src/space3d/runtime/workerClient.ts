/**
 * Cliente del worker de Space 3D: una corrida viva a la vez, cancelable.
 *
 * Un análisis espacial de 150 nudos puede tardar cientos de milisegundos; si el
 * usuario sigue editando, ese trabajo ya no sirve. La cancelación aquí es real
 * —`terminate()`— porque un Worker no admite abortar un bucle numérico en
 * curso: se mata el hilo y la siguiente corrida arranca uno nuevo.
 *
 * Las respuestas llevan `requestId`: cualquier mensaje de una corrida anterior
 * se descarta en vez de resolver una promesa que ya no corresponde al modelo.
 */
import { SPACE3D_PROTOCOL_VERSION, handleSpace3DWorkerRequest, type Space3DWorkerRequest, type Space3DWorkerResponse } from './protocol';
import type { Space3DAnalysisResult, Space3DProjectV1 } from '../model/types';

/**
 * Forma mínima de un evento del worker. `message` y `error` comparten una sola
 * firma para que un `Worker` real, un doble de prueba y esta interfaz encajen
 * sin sobrecargas ni `any`.
 */
export interface Space3DWorkerEvent {
  readonly data?: unknown;
  readonly message?: string;
}

export interface WorkerLike {
  postMessage(message: Space3DWorkerRequest): void;
  terminate(): void;
  addEventListener(type: string, listener: (event: Space3DWorkerEvent) => void): void;
  removeEventListener(type: string, listener: (event: Space3DWorkerEvent) => void): void;
}

export type Space3DWorkerFactory = () => WorkerLike;

export class Space3DAnalysisCancelledError extends Error {
  constructor() {
    super('El análisis espacial fue cancelado.');
    this.name = 'Space3DAnalysisCancelledError';
  }
}

export class Space3DWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'Space3DWorkerError';
    this.code = code;
  }
}

interface Pending {
  readonly requestId: number;
  readonly resolve: (result: Space3DAnalysisResult) => void;
  readonly reject: (error: Error) => void;
}

/**
 * Fábrica por defecto. Vive aquí y no en el entry de la aplicación para que la
 * URL del worker sólo entre en el grafo del chunk lazy de Space 3D.
 */
const defaultWorkerFactory: Space3DWorkerFactory = () =>
  new Worker(new URL('./space3d.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

/**
 * Worker degradado que corre en el hilo principal.
 *
 * Es la ruta real cuando el entorno no ofrece Web Workers de módulo, y la que
 * usan las pruebas. La respuesta se entrega en un microtask para que el
 * contrato asíncrono del cliente sea idéntico en ambos caminos; `terminate()`
 * deja de entregar, que es la única cancelación posible sin un hilo aparte.
 */
export const createInlineSpace3DWorker = (): WorkerLike => {
  const listeners = new Map<string, Set<(event: Space3DWorkerEvent) => void>>();
  let alive = true;
  return {
    postMessage(message) {
      const response = handleSpace3DWorkerRequest(message);
      queueMicrotask(() => {
        if (!alive) return;
        for (const listener of [...(listeners.get('message') ?? [])]) listener({ data: response });
      });
    },
    terminate() { alive = false; listeners.clear(); },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
};

/** Elige worker real o degradado según lo que ofrezca el entorno. */
export const createSpace3DWorkerClient = (): Space3DWorkerClient =>
  new Space3DWorkerClient(typeof Worker === 'undefined' ? createInlineSpace3DWorker : defaultWorkerFactory);

export class Space3DWorkerClient {
  private readonly createWorker: Space3DWorkerFactory;
  private worker: WorkerLike | null = null;
  private detach: (() => void) | null = null;
  private pending: Pending | null = null;
  private nextRequestId = 0;
  private disposed = false;

  constructor(createWorker: Space3DWorkerFactory = defaultWorkerFactory) {
    this.createWorker = createWorker;
  }

  run(project: Space3DProjectV1, targetId: string): Promise<Space3DAnalysisResult> {
    if (this.disposed) return Promise.reject(new Space3DAnalysisCancelledError());
    this.cancel();

    const worker = this.ensureWorker();
    this.nextRequestId += 1;
    const requestId = this.nextRequestId;

    return new Promise<Space3DAnalysisResult>((resolve, reject) => {
      this.pending = { requestId, resolve, reject };
      worker.postMessage({
        protocolVersion: SPACE3D_PROTOCOL_VERSION,
        type: 'run',
        requestId,
        project,
        targetId,
      });
    });
  }

  /** Cancela la corrida viva. Es idempotente y seguro sin corrida pendiente. */
  cancel(): void {
    const pending = this.pending;
    this.pending = null;
    if (pending) {
      this.teardown();
      pending.reject(new Space3DAnalysisCancelledError());
    }
  }

  dispose(): void {
    this.cancel();
    this.teardown();
    this.disposed = true;
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    const onMessage = (event: Space3DWorkerEvent) => this.receive(event?.data as Space3DWorkerResponse | undefined);
    const onError = (event: Space3DWorkerEvent) => {
      const pending = this.pending;
      this.pending = null;
      this.teardown();
      pending?.reject(new Space3DWorkerError('WORKER_FAILURE', event?.message ?? 'El worker de Space 3D falló.'));
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    this.detach = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    this.worker = worker;
    return worker;
  }

  private receive(response: Space3DWorkerResponse | undefined): void {
    const pending = this.pending;
    if (!pending || !response || response.requestId !== pending.requestId) return;
    this.pending = null;
    if (response.type === 'success') pending.resolve(response.result);
    else pending.reject(new Space3DWorkerError(response.code, response.message));
  }

  private teardown(): void {
    this.detach?.();
    this.detach = null;
    this.worker?.terminate();
    this.worker = null;
  }
}
