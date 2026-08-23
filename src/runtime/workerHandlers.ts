import { analyzeBuckling } from '../engine/buckling';
import { certifyResult } from '../engine/certificate';
import { analyzeModal } from '../engine/modal';
import { analyzeProjectScenarios, type AnalysisScenario } from '../engine/envelope';
import { analyzeAxleTrain, buildInfluenceLine } from '../engine/influence';
import { handleAnalysisWorkerRequest } from '../engine/analysisWorkerProtocol';
import type { AnalysisResult, ProjectModel } from '../types';
import {
  WORKER_PROTOCOL_VERSION,
  type AnalysisWorkerPayload,
  type InfluenceWorkerPayload,
  type InfluenceWorkerResult,
  type StudiesWorkerPayload,
  type StudiesWorkerResult,
  type WorkerDomain,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from './workerProtocol';

const mismatch = <Domain extends WorkerDomain, Result>(domain: Domain, requestId: number): WorkerResponseEnvelope<Domain, Result> => ({
  protocolVersion: WORKER_PROTOCOL_VERSION,
  type: 'error',
  domain,
  requestId,
  error: { code: 'PROTOCOL_MISMATCH', message: 'Versión de protocolo de worker no compatible.' },
});

const domainError = <Domain extends WorkerDomain, Result>(domain: Domain, requestId: number, error: unknown, fallback: string): WorkerResponseEnvelope<Domain, Result> => ({
  protocolVersion: WORKER_PROTOCOL_VERSION,
  type: 'error',
  domain,
  requestId,
  error: { code: 'DOMAIN_ERROR', message: error instanceof Error ? error.message : fallback },
});

export const handleAnalysisEnvelope = (
  request: WorkerRequestEnvelope<'analysis', AnalysisWorkerPayload>,
): WorkerResponseEnvelope<'analysis', AnalysisResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'analysis') return mismatch('analysis', request.requestId);
  const response = handleAnalysisWorkerRequest({ type: 'analyze', requestId: request.requestId, ...request.payload });
  return response.type === 'analysis-result'
    ? { protocolVersion: 1, type: 'success', domain: 'analysis', requestId: response.requestId, result: response.result }
    : domainError('analysis', response.requestId, new Error(response.message), response.message);
};

export const handleScenarioEnvelope = (
  request: WorkerRequestEnvelope<'scenarios', { project: ProjectModel }>,
): WorkerResponseEnvelope<'scenarios', AnalysisScenario[]> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'scenarios') return mismatch('scenarios', request.requestId);
  try {
    return { protocolVersion: 1, type: 'success', domain: 'scenarios', requestId: request.requestId, result: analyzeProjectScenarios(request.payload.project) };
  } catch (error) {
    return domainError('scenarios', request.requestId, error, 'No se pudieron comparar los escenarios.');
  }
};

export const handleInfluenceEnvelope = (
  request: WorkerRequestEnvelope<'influence', InfluenceWorkerPayload>,
): WorkerResponseEnvelope<'influence', InfluenceWorkerResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'influence') return mismatch('influence', request.requestId);
  try {
    const { project, input } = request.payload;
    const line = buildInfluenceLine(project, input.pathMemberIds, input.target, input.startNodeId);
    return {
      protocolVersion: 1, type: 'success', domain: 'influence', requestId: request.requestId,
      result: { line, axleTrain: input.train ? analyzeAxleTrain(line, input.train) : null },
    };
  } catch (error) {
    return domainError('influence', request.requestId, error, 'No se pudo calcular la línea de influencia.');
  }
};

/**
 * Resuelve un estudio opcional sobre el modelo.
 *
 * La combinación se resuelve **aquí** y no en el llamador: sólo viaja su `id`
 * por el sobre, porque mandar el objeto entero permitiría pedir un estudio bajo
 * una combinación que no está en el proyecto. Es la misma regla que ya sigue el
 * dominio `analysis`.
 */
export const handleStudiesEnvelope = (
  request: WorkerRequestEnvelope<'studies', StudiesWorkerPayload>,
): WorkerResponseEnvelope<'studies', StudiesWorkerResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'studies') return mismatch('studies', request.requestId);
  const { kind, project, combinationId, modes } = request.payload;
  const combination = combinationId
    ? project.combinations.find((candidate) => candidate.id === combinationId) ?? null
    : null;
  const success = (result: StudiesWorkerResult): WorkerResponseEnvelope<'studies', StudiesWorkerResult> =>
    ({ protocolVersion: 1, type: 'success', domain: 'studies', requestId: request.requestId, result });
  try {
    if (kind === 'buckling') return success({ kind, result: analyzeBuckling(project, combination, { modes }) });
    if (kind === 'modal') return success({ kind, result: analyzeModal(project, { modes }) });
    return success({ kind: 'certificate', result: certifyResult(project, combination) });
  } catch (error) {
    return domainError('studies', request.requestId, error, 'No se pudo completar el estudio del modelo.');
  }
};
