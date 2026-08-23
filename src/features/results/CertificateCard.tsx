import { LoaderCircle } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import type { CertificateStatus } from '../../engine/certificate';
import type { ModelStudiesState } from '../../engine/useModelStudies';
import type { TranslationKey } from '../../i18n/catalogs';

/**
 * El certificado numérico, junto a la calidad numérica en el Resumen.
 *
 * Las dos tarjetas contestan preguntas distintas y por eso están las dos.
 * `NumericQualityCard` publica lo que **el propio solver** midió al resolver;
 * esto publica cuatro comprobaciones que **vuelven a resolver** el modelo, y que
 * por tanto pueden fallar sin que ningún residuo interno se inmute.
 *
 * Cuesta cuatro resoluciones extra, así que se pide. El número de resoluciones
 * se publica: quien decide pedirlo tiene derecho a saber lo que cuesta.
 *
 * **El límite se pinta, no se queda en el código.** La cabecera de
 * `certificate.ts` avisa de que un modelo equivocado y bien resuelto sale con
 * las cuatro en verde; esa frase está aquí abajo, en la tarjeta, porque es
 * exactamente lo que alguien podría malinterpretar al ver cuatro visto buenos.
 */

const STATUS_LABEL: Record<CertificateStatus, TranslationKey> = {
  passed: 'results.certificatePassed',
  observed: 'results.certificateObserved',
  failed: 'results.certificateFailedCheck',
  'not-applicable': 'results.certificateNotApplicable',
};

export const CertificateCard = ({ studies }: { studies: ModelStudiesState }) => {
  const { t } = useI18n();
  const certificate = studies.certificate;
  const running = studies.busy === 'certificate';
  const error = studies.error?.kind === 'certificate' ? studies.error.message : null;

  const verdictKey: TranslationKey = certificate?.verdict === 'verified'
    ? 'results.certificateVerified'
    : certificate?.verdict === 'observations'
      ? 'results.certificateObservations'
      : 'results.certificateNotVerifiable';

  /* Materia fija: `raised` para cualquier veredicto, igual que la calidad
     numérica. Un certificado limpio y uno con observaciones tienen la misma
     elevación y el mismo color de tarjeta; la diferencia se lee en su texto. */
  return <section className="study-panel" data-level="raised" aria-label={t('results.certificateTitle')}>
    <header className="study-header">
      <div>
        <h3>{t('results.certificateTitle')}</h3>
        <p>{certificate ? t(verdictKey) : t('results.certificateIdle')}</p>
      </div>
      <button type="button" onClick={() => studies.run('certificate')} disabled={running}>
        {running
          ? <><LoaderCircle className="spin" size={16} aria-hidden="true" /> {t('results.studyRunning')}</>
          : certificate ? t('results.studyRecompute') : t('results.computeCertificate')}
      </button>
    </header>

    {error ? <p className="study-limit" role="alert">{t('results.studyFailed')}: {error}</p> : null}

    {certificate ? <>
      <ul className="study-checks">
        {certificate.checks.map((check) => <li key={check.id} className="study-check" data-level="flat" data-state={check.status}>
          <div className="study-check-heading">
            <strong>{check.label}</strong>
            <span className="study-check-state">{t(STATUS_LABEL[check.status])}</span>
          </div>
          <p>{check.message}</p>
        </li>)}
      </ul>
      <dl className="study-metrics">
        <div><dt>{t('results.certificateExtraSolves')}</dt><dd>{certificate.extraSolves}</dd></div>
      </dl>
      <p className="study-limit">{certificate.summary}</p>
    </> : null}

    <p className="study-limit">{t('results.certificateLimit')}</p>
  </section>;
};
