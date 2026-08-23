import { useId } from 'react';
import { Check, ChevronRight, Lightbulb, TriangleAlert } from 'lucide-react';
import { deriveClassroomJourney, type ClassroomJourney, type ClassroomJourneyStepId } from '../../education/classroomJourney';
import { useI18n } from '../../i18n/useI18n';
import { useClassroomSession } from '../../store/ClassroomSessionContext';
import type { AnalysisResult, ProjectModel, Tool } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';

export interface ClassroomGuideProps {
  project: ProjectModel;
  analysis?: AnalysisResult | null;
  progress?: ClassroomJourney;
  compact?: boolean;
  className?: string;
  onChooseTool?: (tool: Tool) => void;
  onAnalyze?: () => void;
}

const stepCopy: Record<ClassroomJourneyStepId, { title: TranslationKey; description: TranslationKey; action: TranslationKey }> = {
  build: { title: 'classroom.buildTitle', description: 'classroom.buildBody', action: 'classroom.buildAction' },
  define: { title: 'classroom.defineTitle', description: 'classroom.defineBody', action: 'classroom.defineAction' },
  analyze: { title: 'classroom.analyzeTitle', description: 'classroom.analyzeBody', action: 'classroom.analyzeAction' },
  compare: { title: 'classroom.compareTitle', description: 'classroom.compareBody', action: 'classroom.compareAction' },
  conclude: { title: 'classroom.concludeTitle', description: 'classroom.concludeBody', action: 'classroom.concludeAction' },
};

export const ClassroomGuide = ({
  project,
  analysis = null,
  progress: suppliedProgress,
  compact = false,
  className = '',
  onChooseTool,
  onAnalyze,
}: ClassroomGuideProps) => {
  const { t } = useI18n();
  const session = useClassroomSession();
  const conclusionId = useId();
  const progress = suppliedProgress ?? deriveClassroomJourney(project, analysis, {
    analysisRequested: session.analysisRequested,
    conclusion: session.conclusion,
  });
  const visibleSteps = compact ? [progress.currentStep] : progress.steps;

  const runAction = (stepId: ClassroomJourneyStepId) => {
    const step = progress.steps.find((candidate) => candidate.id === stepId);
    if (!step) return;
    if (step.action.kind === 'tool') onChooseTool?.(step.action.tool);
    else if (step.action.kind === 'analyze') {
      session.markAnalysisRequested();
      onAnalyze?.();
    } else if (step.action.kind === 'compare') {
      emitWorkspaceCommand('open-data', { tab: 'results' });
    } else {
      window.requestAnimationFrame(() => document.getElementById(conclusionId)?.focus());
    }
  };

  return <section className={`classroom-journey${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`} aria-labelledby={compact ? undefined : 'classroom-guide-title'} aria-label={compact ? t('classroom.guideTitle') : undefined}>
    <header className="classroom-journey__header">
      <div>
        <span>{t('classroom.eyebrow')}</span>
        {compact ? <strong>{t(stepCopy[progress.currentStep.id].title)}</strong> : <h2 id="classroom-guide-title">{t('classroom.guideTitle')}</h2>}
      </div>
      <output aria-live="polite">{t('classroom.progressCount', { completed: progress.completedSteps, total: progress.steps.length })}</output>
    </header>
    <progress value={progress.completedSteps} max={progress.steps.length} aria-label={t('classroom.progressLabel')} />
    <ol className="classroom-journey__steps" aria-label={t('classroom.stepsLabel')}>
      {visibleSteps.map((step, index) => {
        const copy = stepCopy[step.id];
        const actionAvailable = step.action.kind === 'tool'
          ? Boolean(onChooseTool)
          : step.action.kind === 'analyze'
            ? Boolean(onAnalyze)
            : step.action.kind !== 'compare' || Boolean(analysis?.success);
        return <li key={step.id} data-classroom-step={step.id} data-state={step.state} aria-current={step.id === progress.currentStep.id ? 'step' : undefined}>
          <span className="sr-only">{t(step.complete ? 'classroom.stepComplete' : step.state === 'attention' ? 'classroom.stepAttention' : step.state === 'current' ? 'classroom.stepCurrent' : 'classroom.stepPending')}</span>
          <span className="classroom-journey__marker" aria-hidden="true">{step.complete ? <Check size={14} /> : step.state === 'attention' ? <TriangleAlert size={14} /> : compact ? progress.steps.findIndex((candidate) => candidate.id === step.id) + 1 : index + 1}</span>
          <div>
            <strong>{t(copy.title)}</strong>
            <small>{t(copy.description)}</small>
            {!step.complete && step.state !== 'pending' && actionAvailable ? <button type="button" onClick={() => runAction(step.id)}>{t(copy.action)} <ChevronRight size={14} /></button> : null}
          </div>
        </li>;
      })}
    </ol>
    {progress.currentStep.id === 'conclude' || session.conclusion ? <label className="classroom-conclusion" htmlFor={conclusionId}>
      <span>{t('classroom.conclusionLabel')}</span>
      <textarea id={conclusionId} rows={compact ? 2 : 3} value={session.conclusion} placeholder={t('classroom.conclusionPlaceholder')} onChange={(event) => session.setConclusion(event.currentTarget.value)} />
      <small>{session.conclusion.trim() ? t('classroom.conclusionSaved') : t('classroom.conclusionHint')}</small>
    </label> : null}
    <p className="classroom-journey__notice"><Lightbulb size={16} /> <span>{t('classroom.defaultsWarning')}</span></p>
  </section>;
};
