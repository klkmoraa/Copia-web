import { memo, useRef, useState } from 'react';
import {
  AlertCircle,
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
import { Popover } from '../../design-system/components/overlays';
import { describeReliabilityCheck, reliabilityLevelLabelKey } from '../results/reliabilityCopy';
import { deriveAnalysisStatus, deriveReliabilityPresentation, type AnalysisVisualStatus } from './analysisStatusModel';

interface AnalysisStatusProps {
  projectId: string;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  onOpenModelDoctor: () => void;
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

/**
 * Memoized so a diagram-cursor step or an evidence-layer switch — neither of
 * which changes `analysis`, `isAnalyzing` or `projectId` — never re-renders the
 * state/reliability line the TopBar owns (CRI-100 architecture requirement).
 */
const AnalysisStatusComponent = ({ projectId, analysis, isAnalyzing, onOpenModelDoctor }: AnalysisStatusProps) => {
  const { t } = useI18n();
  const lifecycleRef = useRef({ projectId, hadAnalysis: Boolean(analysis) });
  const [governingCauseOpen, setGoverningCauseOpen] = useState(false);

  if (lifecycleRef.current.projectId !== projectId) {
    lifecycleRef.current = { projectId, hadAnalysis: Boolean(analysis) };
  }

  const status = deriveAnalysisStatus({
    analysis,
    isAnalyzing,
    hadAnalysis: lifecycleRef.current.hadAnalysis,
  });
  if (analysis) lifecycleRef.current.hadAnalysis = true;
  // `reliability` answers a different question than `status`: a run can succeed
  // (status `resolved`) and still be numerically unreliable. Kept as its own read
  // so the two never collapse into one shared label or color (protected contract).
  const reliability = deriveReliabilityPresentation(analysis, isAnalyzing);

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
    <>
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
            aria-label={`${label}. ${t('modelDoctor.open')}`}
            onClick={onOpenModelDoctor}
          >
            {content}
          </button>
        ) : (
          <div className={`analysis-status is-${status}`} title={label} aria-label={label}>
            {content}
          </div>
        )}
      </div>
      {/* Fiabilidad es una línea propia, deliberadamente fuera de la región
          `aria-live` del estado: la causa gobernante (D-14 · CRI-95) es un
          `dialog` normal, alcanzable por teclado, que no debe re-disparar el
          anuncio del estado al abrirse. */}
      {reliability ? (
        <div
          className="analysis-reliability-line"
          data-analysis-reliability={reliability.level}
          role="group"
          aria-label={`${t('reliability.lineLabel')}: ${t(reliabilityLevelLabelKey[reliability.level])}`}
        >
          <span className="analysis-reliability-dot" aria-hidden="true" />
          <span className="analysis-reliability-label" aria-hidden="true">{t('reliability.lineLabel')}</span>
          <span className="analysis-reliability-value" aria-hidden="true">{t(reliabilityLevelLabelKey[reliability.level])}</span>
          {reliability.governing ? (
            <Popover
              label={t('reliability.governingCauseLabel')}
              trigger={<AlertCircle size={14} aria-hidden="true" />}
              open={governingCauseOpen}
              onOpenChange={setGoverningCauseOpen}
              align="start"
              className="reliability-governing-cause"
            >
              <dl className="reliability-governing-cause__body">
                <div><dt>{t('reliability.causeWhatHeading')}</dt><dd>{t(reliabilityLevelLabelKey[reliability.level])}</dd></div>
                <div><dt>{t('reliability.causeWhyHeading')}</dt><dd>{describeReliabilityCheck(reliability.governing, t)}</dd></div>
                <div><dt>{t('reliability.causeNextHeading')}</dt><dd>{t(reliability.level === 'unreliable' || reliability.level === 'failed' ? 'reliability.nextStepsUnreliable' : 'reliability.nextStepsLimited')}</dd></div>
              </dl>
            </Popover>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

export const AnalysisStatus = memo(AnalysisStatusComponent);
