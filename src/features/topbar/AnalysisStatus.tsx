import { useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  CircleX,
  Clock3,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import type { AnalysisResult } from '../../types';
import { deriveAnalysisStatus, type AnalysisVisualStatus } from './analysisStatusModel';

interface AnalysisStatusProps {
  projectId: string;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  onOpenIssues: () => void;
}

const statusPresentation: Record<AnalysisVisualStatus, {
  icon: LucideIcon;
  labelKey:
    | 'analysis.statusReady'
    | 'analysis.statusCalculating'
    | 'analysis.statusResolved'
    | 'analysis.statusStale'
    | 'analysis.statusWarning'
    | 'analysis.statusError';
}> = {
  ready: { icon: Circle, labelKey: 'analysis.statusReady' },
  calculating: { icon: LoaderCircle, labelKey: 'analysis.statusCalculating' },
  resolved: { icon: CheckCircle2, labelKey: 'analysis.statusResolved' },
  stale: { icon: Clock3, labelKey: 'analysis.statusStale' },
  warning: { icon: TriangleAlert, labelKey: 'analysis.statusWarning' },
  error: { icon: CircleX, labelKey: 'analysis.statusError' },
};

export const AnalysisStatus = ({ projectId, analysis, isAnalyzing, onOpenIssues }: AnalysisStatusProps) => {
  const { t } = useI18n();
  const lifecycleRef = useRef({ projectId, hadAnalysis: Boolean(analysis) });

  if (lifecycleRef.current.projectId !== projectId) {
    lifecycleRef.current = { projectId, hadAnalysis: Boolean(analysis) };
  }

  const status = deriveAnalysisStatus({
    analysis,
    isAnalyzing,
    hadAnalysis: lifecycleRef.current.hadAnalysis,
  });
  if (analysis) lifecycleRef.current.hadAnalysis = true;

  const presentation = statusPresentation[status];
  const Icon = presentation.icon;
  const label = t(presentation.labelKey);
  const actionable = status === 'warning' || status === 'error';
  const content = (
    <>
      <Icon className={status === 'calculating' ? 'spin' : undefined} size={17} aria-hidden="true" />
      <span className="analysis-status-label">{label}</span>
    </>
  );

  return (
    <div
      className="analysis-status-shell"
      data-analysis-status={status}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {actionable ? (
        <button
          type="button"
          className={`analysis-status is-${status}`}
          title={label}
          aria-label={`${label}. ${t('analysis.statusOpenIssues')}`}
          onClick={onOpenIssues}
        >
          {content}
        </button>
      ) : (
        <div className={`analysis-status is-${status}`} title={label} aria-label={label}>
          {content}
        </div>
      )}
    </div>
  );
};
