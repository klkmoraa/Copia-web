import type { AnalysisResult, ValidationIssue } from '../types';
import { classifyAnalysisReliability } from './reliability';

/**
 * Result of a run that never reached a usable solution; always classified
 * `failed`.
 *
 * It lives outside `solver.ts` so the UI can publish an aborted run — a solver
 * chunk that failed to load, a worker that answered with an error — without
 * pulling the whole solver into the main bundle, and without a second, slightly
 * different shape of "failed result" drifting away from this one.
 */
export const abortedAnalysis = (
  issues: ValidationIssue[],
  extra: Partial<AnalysisResult> = {},
): AnalysisResult => {
  const base: AnalysisResult = {
    success: false,
    issues,
    nodeResults: [],
    memberResults: [],
    displacements: [],
    residualNorm: Number.NaN,
    conditionEstimate: Number.NaN,
    equilibrium: { sumFx: Number.NaN, sumFy: Number.NaN, sumM: Number.NaN, normalizedComponents: { fx: Number.NaN, fy: Number.NaN, mz: Number.NaN }, normalizedResidual: Number.NaN },
    explanation: [],
    ...extra,
  };
  return { ...base, reliability: classifyAnalysisReliability(base) };
};

/** Aborted run caused by the analysis never executing, not by the model. */
export const unavailableAnalysis = (message: string): AnalysisResult => abortedAnalysis([{
  id: 'analysis-failed',
  severity: 'error',
  title: 'No se pudo completar el análisis',
  message,
  suggestedFix: 'Vuelve a ejecutar el análisis. Si el problema persiste, recarga la página para obtener la última versión de la aplicación.',
}]);
