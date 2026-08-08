import type { AnalysisResult, ProjectModel } from '../types';
import { analyzeProjectAuto } from './pDelta';

export interface AnalysisWorkerRequest {
  type: 'analyze';
  requestId: number;
  project: ProjectModel;
  combinationId?: string | null;
  /** Defaults to `true` (see `analyzeProject`); the interactive canvas path passes `false`. */
  includeEducationTrace?: boolean;
}

export interface AnalysisWorkerSuccess {
  type: 'analysis-result';
  requestId: number;
  result: AnalysisResult;
}

export interface AnalysisWorkerFailure {
  type: 'analysis-error';
  requestId: number;
  message: string;
}

export type AnalysisWorkerResponse = AnalysisWorkerSuccess | AnalysisWorkerFailure;

/**
 * Pure protocol handler shared by the Vite worker and unit tests. Request ids
 * are echoed so the UI can discard a result after the model has changed.
 */
export const handleAnalysisWorkerRequest = (request: AnalysisWorkerRequest): AnalysisWorkerResponse => {
  try {
    const combination = request.combinationId
      ? request.project.combinations.find((candidate) => candidate.id === request.combinationId) ?? null
      : null;
    return {
      type: 'analysis-result',
      requestId: request.requestId,
      result: analyzeProjectAuto(request.project, combination, { includeEducationTrace: request.includeEducationTrace }),
    };
  } catch (error) {
    return {
      type: 'analysis-error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'No se pudo completar el análisis estructural.',
    };
  }
};
