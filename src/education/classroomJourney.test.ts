import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../engine/solver';
import { createSimpleBeamExercise } from './exerciseTemplates';
import { deriveClassroomJourney } from './classroomJourney';

const attempt = {
  hasPredictions: false,
  analysisRequested: false,
  resultsVisible: false,
  conclusion: '',
};

describe('deriveClassroomJourney', () => {
  it('keeps the six-stage journey cumulative and blocks analysis before prediction', () => {
    const project = createSimpleBeamExercise();
    const solved = analyzeProject(project);
    const premature = deriveClassroomJourney(project, solved, attempt);
    expect(premature.steps.map((step) => step.id)).toEqual(['build', 'define', 'predict', 'analyze', 'compare', 'conclude']);
    expect(premature.currentStep.id).toBe('predict');
    expect(premature.steps.find((step) => step.id === 'analyze')?.complete).toBe(false);

    const failedBeforePrediction = deriveClassroomJourney(project, { ...solved, success: false }, attempt);
    expect(failedBeforePrediction.currentStep.id).toBe('predict');
    expect(failedBeforePrediction.steps.find((step) => step.id === 'analyze')?.state).toBe('pending');

    const analyzed = deriveClassroomJourney(project, solved, { ...attempt, hasPredictions: true, analysisRequested: true });
    expect(analyzed.currentStep.id).toBe('compare');
    expect(analyzed.completedSteps).toBe(4);

    const concluded = deriveClassroomJourney(project, solved, {
      hasPredictions: true,
      analysisRequested: true,
      resultsVisible: true,
      conclusion: 'La deformada coincide con el equilibrio esperado.',
    });
    expect(concluded.completedSteps).toBe(6);
    expect(concluded.completionPercent).toBe(100);
  });
});
