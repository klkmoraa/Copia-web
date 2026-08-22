import { resolveNumericQualityState, resolveReliability } from '../../engine/reliability';
import type { AnalysisResult, NumericQualityState } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import { formatFixed, formatScientific } from '../../utils/numberFormat';

const statusKey: Record<NumericQualityState, TranslationKey> = {
  stable: 'results.qualityStable',
  limited: 'results.qualityLimited',
  unreliable: 'results.qualityUnreliable',
  failed: 'results.qualityFailed',
  unavailable: 'results.qualityUnavailable',
};

const finiteMetric = (value: number | undefined, fallback: string): string =>
  typeof value === 'number' && Number.isFinite(value) ? formatScientific(value, 3) : fallback;

export const NumericQualityCard = ({ analysis }: { analysis: AnalysisResult }) => {
  const { t } = useI18n();
  const reliability = resolveReliability(analysis);
  const state = resolveNumericQualityState(analysis);
  const unavailable = t('results.unavailable');
  const causes = [...new Set(reliability.reasons)];
  const backend = analysis.linearSolver
    ? analysis.linearSolver.backend === 'sparse-ldlt' ? 'Sparse LDLT' : 'Dense LU'
    : unavailable;

  /* Materia fija: `raised` para cualquier estado. La calidad numérica se lee
     en su texto y en su etiqueta, nunca en el color de la tarjeta — así un
     análisis estable y uno limitado tienen exactamente la misma materia. */
  return <section
    className="numeric-quality-card"
    data-level="raised"
    data-state={state}
    aria-label={t('results.qualityTitle')}
  >
    <div className="numeric-quality-heading">
      <div>
        <span>{t('results.qualityTitle')}</span>
        <h3 aria-live="polite">{t(statusKey[state])}</h3>
      </div>
      <span className="numeric-quality-state">{t(statusKey[state])}</span>
    </div>
    <dl className="numeric-quality-metrics">
      <div><dt>{t('results.qualityCondition')}</dt><dd>{finiteMetric(analysis.conditionEstimate, unavailable)}</dd></div>
      <div><dt>{t('results.qualityResidual')}</dt><dd>{finiteMetric(analysis.linearResidual ?? analysis.residualNorm, unavailable)}</dd></div>
      <div><dt>{t('results.qualityForwardError')}</dt><dd>{finiteMetric(analysis.forwardErrorBound, unavailable)}</dd></div>
      <div><dt>{t('results.qualityDigits')}</dt><dd>{Number.isFinite(analysis.reliableDigits) ? formatFixed(analysis.reliableDigits!, 1) : unavailable}</dd></div>
      <div><dt>{t('results.qualityRefinement')}</dt><dd>{analysis.refinementIterations ?? unavailable}</dd></div>
      <div><dt>{t('results.qualityBackend')}</dt><dd>{backend}</dd></div>
    </dl>
    {reliability.governing ? <p className="numeric-quality-governing">
      <strong>{t('results.qualityGoverning')}:</strong> {reliability.governing.message}
    </p> : null}
    {causes.length ? <ul className="numeric-quality-causes" aria-label={t('results.qualityCauses')}>
      {causes.map((cause) => <li key={cause}>{cause}</li>)}
    </ul> : null}
    <p className="numeric-quality-limit">{t('results.qualityMeaning')}</p>
  </section>;
};
