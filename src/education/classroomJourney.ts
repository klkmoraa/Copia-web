import type { AnalysisResult, ProjectModel, Tool } from '../types';
import { deriveClassroomProgress } from './classroomProgress';

export type ClassroomJourneyStepId = 'build' | 'define' | 'analyze' | 'compare' | 'conclude';
export type ClassroomJourneyStepState = 'complete' | 'current' | 'pending' | 'attention';
export type ClassroomJourneyAction =
  | { kind: 'tool'; tool: Tool }
  | { kind: 'analyze' }
  | { kind: 'compare' }
  | { kind: 'conclude' };

export interface ClassroomJourneyStep {
  id: ClassroomJourneyStepId;
  complete: boolean;
  state: ClassroomJourneyStepState;
  action: ClassroomJourneyAction;
}

export interface ClassroomJourneyInput {
  /** Legacy session fields are accepted only so old callers can open safely. */
  hasPredictions?: boolean;
  analysisRequested: boolean;
  resultsVisible?: boolean;
  conclusion: string;
}

export interface ClassroomJourney {
  steps: ClassroomJourneyStep[];
  currentStep: ClassroomJourneyStep;
  completedSteps: number;
  completionPercent: number;
  modelProgress: ReturnType<typeof deriveClassroomProgress>;
}

export const deriveClassroomJourney = (
  project: ProjectModel,
  analysis: AnalysisResult | null,
  session: ClassroomJourneyInput,
): ClassroomJourney => {
  const modelProgress = deriveClassroomProgress(project, analysis);
  const buildComplete = modelProgress.geometry.valid;
  const definitionComplete = buildComplete && modelProgress.supports.valid && modelProgress.loads.valid;
  const analysisComplete = definitionComplete && analysis?.success === true;
  const comparisonComplete = analysisComplete;
  const definitions: Array<Omit<ClassroomJourneyStep, 'state'>> = [
    {
      id: 'build',
      complete: buildComplete,
      action: modelProgress.geometry.nodeCount < 2
        ? { kind: 'tool', tool: 'node' }
        : { kind: 'tool', tool: 'member' },
    },
    {
      id: 'define',
      complete: definitionComplete,
      action: modelProgress.supports.valid
        ? { kind: 'tool', tool: 'pointLoad' }
        : { kind: 'tool', tool: 'support' },
    },
    { id: 'analyze', complete: analysisComplete, action: { kind: 'analyze' } },
    { id: 'compare', complete: comparisonComplete, action: { kind: 'compare' } },
    { id: 'conclude', complete: comparisonComplete && Boolean(session.conclusion.trim()), action: { kind: 'conclude' } },
  ];
  const firstIncompleteIndex = Math.max(0, definitions.findIndex((step) => !step.complete));
  const steps = definitions.map<ClassroomJourneyStep>((step, index) => ({
    ...step,
    state: step.complete
      ? 'complete'
      : step.id === 'analyze' && session.analysisRequested && analysis?.success === false
        ? 'attention'
        : index === firstIncompleteIndex
          ? 'current'
          : 'pending',
  }));
  const currentStep = steps.find((step) => step.state === 'attention' || step.state === 'current') ?? steps[steps.length - 1];
  const completedSteps = steps.filter((step) => step.complete).length;
  return {
    steps,
    currentStep,
    completedSteps,
    completionPercent: (completedSteps / steps.length) * 100,
    modelProgress,
  };
};
