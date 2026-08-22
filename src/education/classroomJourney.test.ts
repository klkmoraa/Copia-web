import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../engine/solver';
import { createSimpleBeamExercise } from './exerciseTemplates';
import { deriveClassroomJourney } from './classroomJourney';

const attempt = {
  analysisRequested: false,
  conclusion: '',
};

describe('deriveClassroomJourney', () => {
  it('uses a five-stage journey and never blocks analysis on legacy predictions', () => {
    const project = createSimpleBeamExercise();
    const solved = analyzeProject(project);
    const premature = deriveClassroomJourney(project, solved, attempt);
    expect(premature.steps.map((step) => step.id)).toEqual(['build', 'define', 'analyze', 'compare', 'conclude']);
    expect(premature.currentStep.id).toBe('conclude');
    expect(premature.steps.find((step) => step.id === 'analyze')?.complete).toBe(true);

    const failedBeforePrediction = deriveClassroomJourney(project, { ...solved, success: false }, attempt);
    expect(failedBeforePrediction.currentStep.id).toBe('analyze');
    expect(failedBeforePrediction.steps.find((step) => step.id === 'analyze')?.state).toBe('current');

    const analyzed = deriveClassroomJourney(project, solved, { ...attempt, analysisRequested: true });
    expect(analyzed.currentStep.id).toBe('conclude');
    expect(analyzed.completedSteps).toBe(4);

    const concluded = deriveClassroomJourney(project, solved, {
      analysisRequested: true,
      conclusion: 'La deformada coincide con el equilibrio esperado.',
    });
    expect(concluded.completedSteps).toBe(5);
    expect(concluded.completionPercent).toBe(100);
  });
});
