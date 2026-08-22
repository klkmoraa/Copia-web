import { useMemo } from 'react';
import { CircleSlash, Gauge, Info, LocateFixed } from 'lucide-react';
import { toDisplay, unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { useProject } from '../../store/ProjectContext';
import { formatFixed } from '../../utils/numberFormat';
import { formatInspectorNumber, formatInspectorValue } from '../inspector/numericFormatting';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import {
  ELASTIC_REFERENCE_RATIO,
  elasticDemandView,
  elasticIndexPaint,
  type ElasticIndexGap,
} from './elasticDemand';
import { describeReliabilityCheck, reliabilityCheckLabel } from './reliabilityCopy';

/**
 * Índice elástico estimado de la estructura.
 *
 * Responde dos preguntas después de un análisis: cuánta demanda elástica hay
 * respecto del Fy declarado y dónde es mayor **entre los miembros que pueden
 * leerse**. No responde si la estructura es segura —eso exige una comprobación
 * por norma que este producto todavía no hace— y no afirma cuál es el miembro
 * gobernante cuando la cobertura es parcial: el más exigido puede ser
 * precisamente uno de los que no se pudo evaluar.
 *
 * El view-model vive en `elasticDemand`: el Inspector y el lienzo consumen el
 * mismo, así que las tres superficies no pueden contradecirse.
 */

const gapLabel: Record<ElasticIndexGap, TranslationKey> = {
  'yield-strength': 'elastic.missingYield',
  'section-modulus': 'elastic.missingModulus',
  'section-geometry': 'elastic.missingGeometry',
};

export const ElasticDemandCard = () => {
  const { project, analysis, setSelection } = useProject();
  const { t } = useI18n();
  const view = useMemo(() => elasticDemandView(project, analysis), [analysis, project]);
  const units = project.settings.units;

  const locate = (memberId: string) => {
    setSelection({ kind: 'member', id: memberId });
    emitWorkspaceCommand('focus-object', { kind: 'member', id: memberId });
  };

  /**
   * La causa del nivel de confiabilidad, reconstruida en el idioma activo desde
   * los campos estructurados del check. Nunca `check.label` ni `check.message`:
   * el motor los redacta en español fijo como diagnóstico interno.
   */
  const cause = view.governingCheck
    ? <>
      <span>{t(view.confidence === 'limited' ? 'elastic.limitedGoverning' : 'elastic.blockedGoverning', {
        check: reliabilityCheckLabel(view.governingCheck, t),
      })}</span>
      <span className="elastic-demand-limited-message">{describeReliabilityCheck(view.governingCheck, t)}</span>
    </>
    : null;

  const doctorButton = <button
    type="button"
    className="elastic-demand-action"
    data-testid="elastic-index-action"
    onClick={() => emitWorkspaceCommand('open-model-doctor')}
  >{t('elastic.actionDoctor')}</button>;

  if (view.status === 'unavailable') {
    const blockedKey: TranslationKey = view.blocker === 'no-analysis'
      ? 'elastic.blockedNoAnalysis'
      : view.blocker === 'unreliable' ? 'elastic.blockedUnreliable' : 'elastic.blockedNoMember';
    const firstGap = view.gaps[0];
    return <section
      data-level="raised"
      className="elastic-demand"
      data-status="unavailable"
      data-coverage="unavailable"
      data-blocker={view.blocker}
      aria-label={t('elastic.unavailableTitle')}
      data-testid="elastic-demand-card"
    >
      <header className="elastic-demand-header">
        <div className="elastic-demand-title">
          <CircleSlash size={16} aria-hidden="true" />
          <strong>{t('elastic.unavailableTitle')}</strong>
        </div>
        {view.total > 0 ? <span className="elastic-demand-coverage" data-coverage="unavailable" data-testid="elastic-coverage">
          {t('elastic.coverageNone', { total: view.total })}
        </span> : null}
      </header>
      <p className="elastic-demand-blocked">{t(blockedKey)}</p>
      {/* Un análisis no confiable no es una lectura «limitada»: se dice qué lo
          bloquea y por qué, sin etiquetarlo como algo intermedio y utilizable.
          Un solo acceso al Doctor del modelo, aquí abajo con las demás acciones. */}
      {view.blocker === 'unreliable' && cause ? <p className="elastic-demand-blocked-cause" data-testid="elastic-blocked-cause">
        {cause}
      </p> : null}
      {view.missing.length ? <ul className="elastic-demand-missing">
        {view.missing.map((gap) => <li key={gap}>{t(gapLabel[gap])}</li>)}
      </ul> : null}
      {view.blocker === 'unreliable' ? doctorButton
        : firstGap ? <button
          type="button"
          className="elastic-demand-action"
          data-testid="elastic-index-action"
          onClick={() => locate(firstGap.memberId)}
        ><LocateFixed size={13} aria-hidden="true" />{t('elastic.actionAssign', { member: firstGap.memberId })}</button>
          : null}
      <small className="elastic-demand-limit">{t('elastic.limitNote')}</small>
    </section>;
  }

  const highest = view.highest;
  const ratio = highest.ratio;
  const paint = elasticIndexPaint(ratio);
  const percent = ratio * 100;
  const ratioText = formatFixed(ratio, 2, 'inspector');
  const percentText = formatFixed(percent, 0, 'inspector');
  const axialShare = Math.round(highest.axialShare * 100);

  return <section
    data-level="raised"
    className="elastic-demand"
    data-status="available"
    data-coverage={view.coverage}
    data-confidence={view.confidence}
    data-at-reference={paint.atReference ? 'true' : 'false'}
    aria-label={t('elastic.title')}
    data-testid="elastic-demand-card"
  >
    <header className="elastic-demand-header">
      <div className="elastic-demand-title">
        <Gauge size={16} aria-hidden="true" />
        <strong>{t('elastic.title')}</strong>
      </div>
      {/* La cobertura va en la cabecera, no en una nota al pie: cambia lo que el
          número significa, no es un detalle de procedencia. */}
      <span className="elastic-demand-coverage" data-coverage={view.coverage} data-testid="elastic-coverage">
        {t(view.coverage === 'complete' ? 'elastic.coverageComplete' : 'elastic.coveragePartial', {
          evaluated: view.evaluated,
          total: view.total,
        })}
      </span>
    </header>

    <p className="elastic-index-value" data-testid="elastic-index-value">
      {t('elastic.value', { ratio: ratioText, percent: percentText })}
    </p>
    {/* «Mayor índice entre X/Y evaluables», nunca «gobernante», cuando falta
        cobertura: el miembro más exigido puede ser uno de los no evaluados. */}
    <p className="elastic-index-scope" data-testid="elastic-index-scope">
      {t(view.coverage === 'complete' ? 'elastic.scopeComplete' : 'elastic.scopePartial', {
        member: highest.memberId,
        evaluated: view.evaluated,
        total: view.total,
      })}
    </p>
    {paint.atReference ? <p className="elastic-index-reference-note" data-testid="elastic-at-reference">
      {t('elastic.atReference')}
    </p> : null}

    {/* Decorativa por contrato: η puede superar 1 y `role="meter"` obliga a
        aria-valuenow ≤ aria-valuemax. El valor y su alcance ya están en texto. */}
    <div className="elastic-index-scale" data-at-reference={paint.atReference ? 'true' : 'false'} aria-hidden="true">
      <span className="elastic-index-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
      <span className="elastic-index-reference" style={{ left: `${ELASTIC_REFERENCE_RATIO * 100}%` }} />
    </div>

    {view.confidence === 'limited' ? <p className="elastic-demand-limited" role="note" data-testid="elastic-limited-cause">
      <strong>{t('elastic.limitedConfidence')}</strong>
      {cause}
      {doctorButton}
    </p> : null}

    <dl className="elastic-demand-grid">
      <div>
        <dt>{t('elastic.highestMember')}</dt>
        <dd>
          <button
            type="button"
            className="elastic-demand-locate"
            data-testid="elastic-index-locate"
            title={t('elastic.locateHint', { member: highest.memberId })}
            onClick={() => locate(highest.memberId)}
          ><strong>{highest.memberId}</strong><LocateFixed size={13} aria-hidden="true" />{t('elastic.locate')}</button>
        </dd>
      </div>
      <div>
        <dt>{t('elastic.materialLabel')}</dt>
        <dd>
          {formatInspectorValue(toDisplay(highest.material.yieldStrength, units, 'elasticModulus'), unitLabel(units, 'elasticModulus'))}
          <small>{t('elastic.provenanceCatalog', { name: highest.material.name, id: highest.material.id })}</small>
        </dd>
      </div>
      <div>
        <dt>{t('elastic.sectionLabel')}</dt>
        <dd>
          {highest.section
            ? <>
              {formatInspectorValue(toDisplay(highest.section.sectionModulus, units, 'sectionModulus'), unitLabel(units, 'sectionModulus'))}
              <small>{t('elastic.provenanceCatalog', { name: highest.section.name, id: highest.section.id })}</small>
            </>
            /* Demanda puramente axial: W no participó, así que no se declara. */
            : <><span>—</span><small>{t('elastic.axialOnly')}</small></>}
        </dd>
      </div>
      <div>
        <dt>{t('elastic.forcesLabel')}</dt>
        <dd>
          N* {formatFixed(toDisplay(highest.maxAxial, units, 'force'), 2, 'inspector')} {unitLabel(units, 'force')}
          {' · '}
          M* {formatFixed(toDisplay(highest.maxMoment, units, 'moment'), 2, 'inspector')} {unitLabel(units, 'moment')}
          <small>{t('elastic.envelopeNote')}</small>
        </dd>
      </div>
    </dl>

    <details className="elastic-how">
      <summary>{t('elastic.howTitle')}</summary>
      <p className="elastic-how-chain">{highest.section ? t('elastic.howChain') : t('elastic.howChainAxial')}</p>
      <ol className="elastic-how-steps">
        <li>{t('elastic.howAxial', {
          axial: formatFixed(toDisplay(highest.maxAxial, units, 'force'), 2, 'inspector'),
          forceUnit: unitLabel(units, 'force'),
          area: formatInspectorNumber(toDisplay(highest.area, units, 'area')),
          areaUnit: unitLabel(units, 'area'),
          value: formatInspectorValue(toDisplay(highest.sigmaAxial, units, 'elasticModulus'), unitLabel(units, 'elasticModulus')),
        })}</li>
        {highest.section ? <li>{t('elastic.howBending', {
          moment: formatFixed(toDisplay(highest.maxMoment, units, 'moment'), 2, 'inspector'),
          momentUnit: unitLabel(units, 'moment'),
          modulus: formatInspectorNumber(toDisplay(highest.section.sectionModulus, units, 'sectionModulus')),
          modulusUnit: unitLabel(units, 'sectionModulus'),
          value: formatInspectorValue(toDisplay(highest.sigmaBending, units, 'elasticModulus'), unitLabel(units, 'elasticModulus')),
        })}</li> : <li>{t('elastic.howBendingAbsent')}</li>}
        <li>{t('elastic.howTotal', {
          value: formatInspectorValue(toDisplay(highest.sigmaTotal, units, 'elasticModulus'), unitLabel(units, 'elasticModulus')),
        })}</li>
        <li>{t('elastic.howRatio', {
          sigma: formatInspectorValue(toDisplay(highest.sigmaTotal, units, 'elasticModulus'), unitLabel(units, 'elasticModulus')),
          yield: formatInspectorValue(toDisplay(highest.material.yieldStrength, units, 'elasticModulus'), unitLabel(units, 'elasticModulus')),
          ratio: ratioText,
        })}</li>
      </ol>
      <p className="elastic-how-split">{`N* ${axialShare} % · M* ${100 - axialShare} % de σ*`}</p>
      <p className="elastic-how-reference"><Info size={13} aria-hidden="true" />{t('elastic.referenceNote')}</p>
    </details>

    {view.gaps.length ? <div className="elastic-demand-skipped">
      <p>{t('elastic.skipped', { count: view.gaps.length, total: view.total })}</p>
      <ul>
        {view.gaps.map((gap) => <li key={gap.memberId}>
          <button type="button" onClick={() => locate(gap.memberId)}>
            {t('elastic.skippedItem', { member: gap.memberId, reason: t(gapLabel[gap.gaps[0]]) })}
          </button>
        </li>)}
      </ul>
    </div> : null}

    <small className="elastic-demand-limit">{t('elastic.limitNote')}</small>
  </section>;
};
