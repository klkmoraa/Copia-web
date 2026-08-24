import { CircleSlash, Ruler } from 'lucide-react';
import { toDisplay, unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import type { AnalysisResult, MemberModel, MemberResult, UnitSystemId } from '../../types';
import { formatFixed } from '../../utils/numberFormat';
import { formatInspectorValue } from './numericFormatting';
import {
  memberAisc360View,
  type Aisc360Gap,
  type Aisc360GoverningCheck,
} from '../results/aisc360Design';
import { describeReliabilityCheck, reliabilityCheckLabel } from '../results/reliabilityCopy';

export interface Aisc360DesignCardProps {
  member: MemberModel;
  result: MemberResult;
  analysis: AnalysisResult | null | undefined;
  units: UnitSystemId;
}

const GAP_LABEL: Record<Aisc360Gap, TranslationKey> = {
  'section-not-supported': 'aisc.gapSectionNotSupported',
  'material-catalog': 'aisc.gapMaterialCatalog',
  'non-compact-section': 'aisc.gapNonCompactSection',
  'ltb-inelastic': 'aisc.gapLtbInelastic',
  'shear-slender-web': 'aisc.gapShearSlenderWeb',
};

const GOVERNING_LABEL: Record<Aisc360GoverningCheck, TranslationKey> = {
  axial: 'aisc.governingCheckAxial',
  flexure: 'aisc.governingCheckFlexure',
  shear: 'aisc.governingCheckShear',
  interaction: 'aisc.governingCheckInteraction',
};

/**
 * Verificación por norma real (CRI-45): AISC 360-16, LRFD, sobre el mismo
 * miembro y el mismo resultado que muestra `InspectorNarrativeCard`.
 *
 * No sustituye a η: son dos lecturas independientes con distinto contrato
 * (`aisc360Design.ts` documenta el alcance completo). Aquí sólo se presenta lo
 * que el motor ya decidió — ratio, gaps, cuál sub-estado gobierna — sin volver
 * a calcular nada.
 */
export const Aisc360DesignCard = ({ member, result, analysis, units }: Aisc360DesignCardProps) => {
  const { t } = useI18n();
  const view = memberAisc360View(member, result, analysis);

  if (view.status === 'unavailable') {
    if (view.blocker === null && view.gaps.length === 0) return null; // sin analizar: nada relevante que declarar aquí, ya lo dice la tarjeta elástica
    const blockedKey: TranslationKey | null = view.blocker === 'no-analysis'
      ? 'elastic.blockedNoAnalysis'
      : view.blocker === 'unreliable' ? 'elastic.blockedUnreliable' : null;
    return <section className="inspector-narrative" data-status="unavailable" aria-label={t('aisc.unavailableTitle')}>
      <header>
        <CircleSlash size={16} aria-hidden="true" />
        <strong>{t('aisc.unavailableTitle')}</strong>
      </header>
      {blockedKey ? <p className="inspector-narrative-body">{t(blockedKey)}</p> : null}
      {view.gaps.length ? <ul className="elastic-demand-missing">
        {view.gaps.map((gap) => <li key={gap}>{t(GAP_LABEL[gap])}</li>)}
      </ul> : null}
    </section>;
  }

  const { reading, confidence, governingCheckReliability } = view;
  const ratioText = formatFixed(reading.governingRatio, 2, 'inspector');
  const percent = reading.governingRatio * 100;

  return <section
    className="inspector-narrative"
    data-status="available"
    data-confidence={confidence}
    aria-label={t('aisc.title')}
  >
    <header>
      <Ruler size={16} aria-hidden="true" />
      <strong>{t('aisc.title')}</strong>
    </header>

    <p className="elastic-index-value" data-testid="inspector-aisc-value">{t('aisc.value', {
      ratio: ratioText,
      percent: formatFixed(percent, 0, 'inspector'),
    })}</p>
    <p className="inspector-narrative-body">{t(GOVERNING_LABEL[reading.governingCheck])}</p>

    {confidence === 'limited' ? <p className="elastic-demand-limited" role="note">
      <strong>{t('elastic.limitedConfidence')}</strong>
      {governingCheckReliability ? <>
        <span>{t('elastic.limitedGoverning', { check: reliabilityCheckLabel(governingCheckReliability, t) })}</span>
        <span className="elastic-demand-limited-message">{describeReliabilityCheck(governingCheckReliability, t)}</span>
      </> : null}
    </p> : null}

    <dl className="inspector-narrative-values">
      <div>
        <dt>{t('aisc.axialTitle')}</dt>
        <dd>{reading.axial.status === 'available'
          ? `${t(reading.axial.mode === 'tension' ? 'aisc.axialModeTension' : 'aisc.axialModeCompression')} · η=${formatFixed(reading.axial.ratio, 2, 'inspector')}`
          : t(GAP_LABEL[reading.axial.gap])}</dd>
      </div>
      <div>
        <dt>{t('aisc.flexureTitle')}</dt>
        <dd>{reading.flexure.status === 'available'
          ? `η=${formatFixed(reading.flexure.ratio, 2, 'inspector')}`
          : reading.flexure.status === 'not-applicable' ? t('aisc.notApplicableTruss') : t(GAP_LABEL[reading.flexure.gap])}</dd>
      </div>
      <div>
        <dt>{t('aisc.shearTitle')}</dt>
        <dd>{reading.shear.status === 'available'
          ? `η=${formatFixed(reading.shear.ratio, 2, 'inspector')}`
          : reading.shear.status === 'not-applicable' ? t('aisc.notApplicableTruss') : t(GAP_LABEL[reading.shear.gap])}</dd>
      </div>
      <div>
        <dt>{t('aisc.interactionTitle')}</dt>
        <dd>{reading.interaction.status === 'available'
          ? `η=${formatFixed(reading.interaction.ratio, 2, 'inspector')} · ${t('aisc.interactionFormula', { formula: reading.interaction.formula })}`
          : t('aisc.interactionUnavailable')}</dd>
      </div>
    </dl>

    {reading.axial.status === 'available' && reading.axial.mode === 'compression' ? <p className="inspector-narrative-basis">
      {t(reading.axial.governingAxis === 'major' ? 'aisc.axialGoverningAxisMajor' : 'aisc.axialGoverningAxisMinor')} ·{' '}
      {t('aisc.axialSlenderness', {
        major: formatFixed(reading.axial.slendernessMajor ?? 0, 1, 'inspector'),
        minor: formatFixed(reading.axial.slendernessMinor ?? 0, 1, 'inspector'),
      })}
    </p> : null}
    {reading.axial.status === 'available' && reading.axial.tensionRuptureNotEvaluated ? <p className="inspector-narrative-basis">{t('aisc.axialTensionRuptureNote')}</p> : null}
    {reading.flexure.status === 'available' ? <p className="inspector-narrative-basis">{t('aisc.flexureDetail', {
      mp: formatInspectorValue(toDisplay(reading.flexure.mp, units, 'moment'), unitLabel(units, 'moment')),
      lb: formatInspectorValue(toDisplay(reading.flexure.lb, units, 'length'), unitLabel(units, 'length')),
      lp: formatInspectorValue(toDisplay(reading.flexure.lp, units, 'length'), unitLabel(units, 'length')),
    })}</p> : null}

    <small className="inspector-narrative-basis">{t('aisc.scopeNote')}</small>
  </section>;
};
