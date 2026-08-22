import type { AnalysisResult } from '../../types';
import type { SurfaceLevel } from '../../design-system/components/surface';
import { useI18n } from '../../i18n/useI18n';
import { formatResultNumber } from './resultFormatting';
import { resolveExplanationAnchor, type ResultRef } from './provenance';

/**
 * De dónde sale el número.
 *
 * Es la pieza que peor cabe al cardificar y la primera que se pierde, así que
 * tiene materia propia: `raised` cuando es la tarjeta de procedencia del panel,
 * y `flat` cuando vive **dentro** de otra tarjeta —el contenido de un `raised`
 * es `BASE` o `INSET`, nunca otra tarjeta (CRI-90 · CRI-101).
 *
 * `data-level` engancha la materia directamente, sin pasar por `Surface`:
 * `details` no es una de sus etiquetas y la hoja de materia lo contempla.
 */
export const ProvenanceCard = ({
  analysis,
  resultRef,
  level = 'raised',
}: {
  analysis: AnalysisResult;
  resultRef: ResultRef;
  level?: Extract<SurfaceLevel, 'raised' | 'flat'>;
}) => {
  const { t } = useI18n();
  const anchor = resolveExplanationAnchor(analysis, resultRef);
  return <details className={`provenance-card is-${anchor.status}`} data-level={level}>
    <summary>{t('results.explainValue')}</summary>
    <div className="provenance-card__body" aria-live="polite">
      <div><span>{t('results.provenanceEntity')}</span><strong>{resultRef.entity.id} · {resultRef.quantity}{resultRef.component ? `.${resultRef.component}` : ''}</strong></div>
      <div><span>{t('results.provenanceScenario')}</span><strong>{resultRef.caseOrCombinationId}</strong></div>
      <div><span>{t('results.provenanceSign')}</span><strong>{resultRef.signConvention}</strong></div>
      {resultRef.position ? <div><span>{t('results.provenancePosition')}</span><strong>x = {formatResultNumber(resultRef.position.x)} m{resultRef.position.side ? ` · ${resultRef.position.side}` : ''}</strong></div> : null}
      {anchor.status === 'resolved' ? <>
        <div><span>{t('results.provenanceStoredValue')}</span><strong>{formatResultNumber(anchor.value as number)} {anchor.unit}</strong></div>
        <div><span>{t('results.provenanceSource')}</span><code>{anchor.source}</code></div>
        {anchor.explanationStepIds.length ? <div><span>{t('results.provenanceSteps')}</span><strong>{anchor.explanationStepIds.join(', ')}</strong></div> : null}
      </> : <p role="status">{t('results.provenanceInsufficient')}</p>}
    </div>
  </details>;
};
