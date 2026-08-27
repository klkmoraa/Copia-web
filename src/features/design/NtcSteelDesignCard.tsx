import { BookOpenCheck, CircleSlash, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { summarizeNtcSteelTensionDesign, type NtcSteelDesignBlocker } from '../../design/ntcSteel2023';
import { toDisplay, unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { useProject } from '../../store/ProjectContext';
import { formatFixed } from '../../utils/numberFormat';
import './ntcSteelDesignCard.css';

/**
 * Tarjeta del primer módulo de diseño normativo: NTC Acero CDMX 2023,
 * fluencia de sección total (§5.3.1.a), sólo para barras truss en tensión
 * axial pura con identidad de catálogo explícita A992 + perfil I AISC.
 *
 * Publica un `DesignResult` — separado de `AnalysisResult` por contrato, ver
 * `src/design/types.ts` — y nunca concluye el diseño del miembro: el estado
 * es siempre `'incomplete'`, con los checks ausentes listados en la propia
 * tarjeta.
 */

const blockerKey = (blocker: NtcSteelDesignBlocker | undefined): TranslationKey => {
  if (blocker === 'ntc-ultimate-combination-required') return 'ntc.unavailableCombination';
  if (blocker === 'reliable-analysis-required') return 'ntc.unavailableReliability';
  if (blocker === 'explicit-catalog-identity-required') return 'ntc.unavailableIdentity';
  if (blocker === 'unsupported-member-family' || blocker === 'unsupported-material-section-family') return 'ntc.unavailableFamily';
  if (blocker === 'catalog-properties-drifted') return 'ntc.unavailableDrift';
  if (blocker === 'pure-axial-demand-required' || blocker === 'positive-tension-required') return 'ntc.unavailableDemand';
  return 'ntc.unavailableGeneric';
};

export const NtcSteelDesignCard = () => {
  const { project, analysis, selectedCombinationId } = useProject();
  const { t } = useI18n();
  const summary = useMemo(() => summarizeNtcSteelTensionDesign({
    project,
    analysis,
    combinationId: selectedCombinationId,
  }), [analysis, project, selectedCombinationId]);

  if (summary.status === 'unavailable') {
    return <section
      className="ntc-design-card"
      data-testid="ntc-steel-design-card"
      data-result-kind="design"
      data-status="unavailable"
      aria-label={t('ntc.title')}
    >
      <header className="ntc-design-card__header">
        <div><CircleSlash size={17} aria-hidden="true" /><span><small>{t('ntc.eyebrow')}</small><strong>{t('ntc.title')}</strong></span></div>
        <b>{t('ntc.inconclusive')}</b>
      </header>
      <div className="ntc-design-card__unavailable">
        <strong>{t('ntc.unavailable')}</strong>
        <p>{t(blockerKey(summary.skipped[0]?.blockers[0]))}</p>
      </div>
      <small className="ntc-design-card__limit">{t('ntc.conclusion')}</small>
    </section>;
  }

  const result = summary.highest;
  const units = project.settings.units;
  const demand = formatFixed(toDisplay(result.demand.value, units, 'force'), 2, 'inspector');
  const resistance = formatFixed(toDisplay(result.resistance.value, units, 'force'), 2, 'inspector');
  const forceUnit = unitLabel(units, 'force');
  const componentLabel = result.componentStatus === 'within-component' ? t('ntc.within') : t('ntc.outside');
  const total = summary.results.length + summary.skipped.length;

  return <section
    className="ntc-design-card"
    data-testid="ntc-steel-design-card"
    data-result-kind="design"
    data-status={result.status}
    data-component-status={result.componentStatus}
    aria-label={t('ntc.title')}
  >
    <header className="ntc-design-card__header">
      <div><BookOpenCheck size={17} aria-hidden="true" /><span><small>{t('ntc.eyebrow')}</small><strong>{t('ntc.title')}</strong></span></div>
      <b>{t('ntc.inconclusive')}</b>
    </header>

    <div className="ntc-design-card__standard">
      <span>NTC Acero CDMX 2023 · §5.3.1.a</span>
      <span data-component-status={result.componentStatus}>{componentLabel}</span>
    </div>

    <p className="ntc-design-card__ratio">{t('ntc.ratio')} <strong>{formatFixed(result.ratio.value, 2, 'inspector')}</strong></p>

    <dl className="ntc-design-card__values">
      <div><dt>{t('ntc.demand')}</dt><dd>Pu = {demand} {forceUnit}</dd></div>
      <div><dt>{t('ntc.resistance')}</dt><dd>Rt,y = {resistance} {forceUnit}</dd></div>
      <div><dt>{t('ntc.subject')}</dt><dd>{result.subject.memberId}<small>{result.subject.materialId} · {result.subject.sectionId}</small></dd></div>
      <div><dt>{t('ntc.coverage')}</dt><dd>{t('ntc.coverageValue', { evaluated: summary.results.length, total })}</dd></div>
    </dl>

    <details className="ntc-design-card__trace">
      <summary>{t('ntc.trace')}</summary>
      <code>{result.check.equation}</code>
      <p>FR = 0.90 · Fy = {formatFixed(result.substitutions[2].value, 0, 'inspector')} kN/m² · A = {formatFixed(result.substitutions[3].value, 6, 'inspector')} m²</p>
      <a href={result.standard.sourceUrl} target="_blank" rel="noreferrer">{t('ntc.source')}</a>
    </details>

    <div className="ntc-design-card__missing" role="note">
      <TriangleAlert size={16} aria-hidden="true" />
      <div><strong>{t('ntc.missing')}</strong><ul><li>{t('ntc.fracture')}</li><li>{t('ntc.connection')}</li></ul></div>
    </div>
    <small className="ntc-design-card__limit">{t('ntc.conclusion')}</small>
  </section>;
};

export default NtcSteelDesignCard;
