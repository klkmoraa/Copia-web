import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { analyzeProject } from './solver';
import { analyzeProjectAuto } from './pDelta';
import { handleAnalysisWorkerRequest, type AnalysisWorkerRequest } from './analysisWorkerProtocol';

describe('analysis worker protocol', () => {
  it('returns the same analysis as the synchronous engine for a load case', () => {
    const project = createDefaultProject();
    const request: AnalysisWorkerRequest = {
      type: 'analyze',
      requestId: 17,
      project,
    };

    const response = handleAnalysisWorkerRequest(request);
    expect(response.type).toBe('analysis-result');
    if (response.type !== 'analysis-result') throw new Error(response.message);
    expect(response.requestId).toBe(17);
    expect(response.result).toEqual(analyzeProject(project, null));
  });

  it('resolves a requested combination and remains structured-clone compatible', () => {
    const project = createDefaultProject();
    const combination = project.combinations.find((candidate) => candidate.id === 'COMB1')!;
    const request: AnalysisWorkerRequest = {
      type: 'analyze',
      requestId: 18,
      project,
      combinationId: combination.id,
    };

    const response = handleAnalysisWorkerRequest(structuredClone(request));
    expect(response.type).toBe('analysis-result');
    if (response.type !== 'analysis-result') throw new Error(response.message);
    expect(structuredClone(response.result)).toEqual(analyzeProject(project, combination));
  });

  it('uses the unfactored load cases when the combination id is unknown', () => {
    const project = createDefaultProject();
    const response = handleAnalysisWorkerRequest({
      type: 'analyze', requestId: 19, project, combinationId: 'missing',
    });
    expect(response.type).toBe('analysis-result');
    if (response.type !== 'analysis-result') throw new Error(response.message);
    expect(response.result).toEqual(analyzeProject(project, null));
  });

  it('preserves P-Delta mode, experimental metadata and dense isolation across the worker contract', () => {
    const project = createDefaultProject();
    project.settings.analysisMode = 'p-delta';
    const request: AnalysisWorkerRequest = {
      type: 'analyze', requestId: 20, project, includeEducationTrace: false,
    };

    const response = handleAnalysisWorkerRequest(structuredClone(request));
    expect(response.type).toBe('analysis-result');
    if (response.type !== 'analysis-result') throw new Error(response.message);
    const fallback = analyzeProjectAuto(project, null, { includeEducationTrace: false });
    expect(structuredClone(response.result)).toEqual(fallback);
    expect(response.result.pDelta).toMatchObject({ experimental: true, converged: true });
    expect(response.result.linearSolver).toMatchObject({ policy: 'dense', backend: 'dense-lu' });
  });
});
