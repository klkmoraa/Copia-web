import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { analyzeProject } from './solver';
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
});
