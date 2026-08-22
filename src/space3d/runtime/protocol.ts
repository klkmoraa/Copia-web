/**
 * Sobres versionados del worker de Space 3D.
 *
 * El handler es puro y se comparte entre el Web Worker y las pruebas, así que
 * la ruta en hilo y la ruta en worker son literalmente el mismo código. Todo lo
 * que cruza el `postMessage` es JSON simple: nada de clases, funciones ni
 * `Map`/`Set`, para que `structuredClone` lo transporte sin pérdida.
 */
import { analyzeSpace3DProject } from '../engine/solver';
import type { Space3DAnalysisResult, Space3DProjectV1 } from '../model/types';

export const SPACE3D_PROTOCOL_VERSION = 1 as const;

export interface Space3DRunRequest {
  readonly protocolVersion: typeof SPACE3D_PROTOCOL_VERSION;
  readonly type: 'run';
  readonly requestId: number;
  readonly project: Space3DProjectV1;
  readonly targetId: string;
}

export type Space3DWorkerRequest = Space3DRunRequest;

export interface Space3DSuccessResponse {
  readonly protocolVersion: typeof SPACE3D_PROTOCOL_VERSION;
  readonly type: 'success';
  readonly requestId: number;
  readonly result: Space3DAnalysisResult;
}

export type Space3DWorkerErrorCode = 'PROTOCOL_MISMATCH' | 'UNSUPPORTED_REQUEST' | 'WORKER_FAILURE';

export interface Space3DErrorResponse {
  readonly protocolVersion: typeof SPACE3D_PROTOCOL_VERSION;
  readonly type: 'error';
  readonly requestId: number;
  readonly code: Space3DWorkerErrorCode;
  readonly message: string;
}

export type Space3DWorkerResponse = Space3DSuccessResponse | Space3DErrorResponse;

const error = (requestId: number, code: Space3DWorkerErrorCode, message: string): Space3DErrorResponse => ({
  protocolVersion: SPACE3D_PROTOCOL_VERSION,
  type: 'error',
  requestId,
  code,
  message,
});

const requestIdOf = (request: unknown): number => {
  const candidate = (request as { requestId?: unknown } | null)?.requestId;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
};

/**
 * Fail-closed: una versión distinta no se «adapta», se rechaza. Un worker
 * antiguo respondiendo a una app nueva devolvería resultados con otra semántica
 * de signos o de GDL, y eso es peor que no responder.
 */
export const handleSpace3DWorkerRequest = (request: unknown): Space3DWorkerResponse => {
  const requestId = requestIdOf(request);
  if (typeof request !== 'object' || request === null) {
    return error(requestId, 'PROTOCOL_MISMATCH', 'El worker de Space 3D recibió un sobre vacío.');
  }
  const envelope = request as Partial<Space3DRunRequest>;
  if (envelope.protocolVersion !== SPACE3D_PROTOCOL_VERSION) {
    return error(
      requestId,
      'PROTOCOL_MISMATCH',
      `El worker de Space 3D habla el protocolo ${SPACE3D_PROTOCOL_VERSION} y recibió ${String(envelope.protocolVersion)}.`,
    );
  }
  if (envelope.type !== 'run') {
    return error(requestId, 'UNSUPPORTED_REQUEST', `El worker de Space 3D no admite la petición «${String(envelope.type)}».`);
  }

  try {
    return {
      protocolVersion: SPACE3D_PROTOCOL_VERSION,
      type: 'success',
      requestId,
      result: analyzeSpace3DProject(envelope.project as Space3DProjectV1, String(envelope.targetId)),
    };
  } catch (cause) {
    return error(
      requestId,
      'WORKER_FAILURE',
      cause instanceof Error ? cause.message : 'El análisis espacial terminó de forma inesperada.',
    );
  }
};
