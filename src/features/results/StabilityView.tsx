import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useProject } from '../../store/ProjectContext';
import { useI18n } from '../../i18n/useI18n';
import { formatFixed, formatScientific } from '../../utils/numberFormat';
import type { ModeShapeNode } from '../../engine/buckling';
import type { ModelStudiesState } from '../../engine/useModelStudies';

/**
 * Pandeo y modos de vibración, en la superficie «Datos».
 *
 * Una sola vista para los dos porque desde fuera son la misma lectura —«¿qué
 * forma toma esta estructura y a qué precio?»— y sólo cambian las magnitudes de
 * cada modo. Dos componentes casi iguales habrían sido dos sitios donde el
 * estado vacío, el error y el selector de modo pudieran divergir.
 *
 * Los dos **se piden**: cuestan un problema de autovalores que no se paga con
 * cada análisis. Por eso el estado inicial no es un vacío mudo sino una frase
 * que dice por qué hay un botón.
 *
 * El límite de lo que el número significa viaja **con el número**, no en una
 * ayuda escondida. Es la misma disciplina del índice elástico η: un λcr elástico
 * sin φ ni imperfecciones no es una verificación, y quien lo lee tiene que
 * poder saberlo sin buscarlo.
 */

interface StabilityViewProps {
  kind: 'buckling' | 'modal';
  studies: ModelStudiesState;
}

interface ModeRow {
  /** Número grande del botón: λcr o el periodo. */
  headline: string;
  /** Unidad o aclaración bajo el número. */
  caption: string;
  metrics: Array<{ label: string; value: string }>;
  shape: readonly ModeShapeNode[];
}

export const StabilityView = ({ kind, studies }: StabilityViewProps) => {
  const { t } = useI18n();
  const { analysis, modeShapeState, setModeShapeState } = useProject();
  const [selected, setSelected] = useState(0);

  const result = kind === 'buckling' ? studies.buckling : studies.modal;
  const running = studies.busy === kind;
  const error = studies.error?.kind === kind ? studies.error.message : null;

  // Un estudio que se recalcula puede devolver menos modos que el anterior; el
  // índice elegido tiene que caer dentro, no quedarse apuntando al vacío.
  const modeCount = result?.success ? result.modes.length : 0;
  useEffect(() => {
    if (selected >= modeCount) setSelected(0);
  }, [modeCount, selected]);

  /* El modo NO se retira al desmontarse esta vista, y eso es deliberado: cerrar
     «Datos» para mirar el dibujo es exactamente el motivo de dibujarlo. La
     primera versión lo limpiaba al desmontar y el modo desaparecía justo cuando
     se iba a ver — lo cazó el QA de navegador, no las pruebas de jsdom, porque
     sólo allí se cierra la superficie de verdad.

     Quien sí lo retira es `invalidateAnalysis`, junto a la línea de influencia:
     un modo es una lectura de un modelo concreto y se va cuando ese modelo
     cambia. */

  const rows: ModeRow[] = result?.success
    ? kind === 'buckling'
      ? (result as NonNullable<ModelStudiesState['buckling']>).modes.map((mode) => ({
        headline: formatFixed(mode.criticalLoadFactor, 3),
        caption: t('results.bucklingMultiplier'),
        metrics: [{ label: t('results.criticalLoadFactor'), value: formatFixed(mode.criticalLoadFactor, 4) }],
        shape: mode.shape,
      }))
      : (result as NonNullable<ModelStudiesState['modal']>).modes.map((mode) => ({
        headline: formatFixed(mode.period, 4),
        caption: 's',
        metrics: [
          { label: t('results.period'), value: `${formatFixed(mode.period, 4)} s` },
          { label: t('results.frequency'), value: `${formatFixed(mode.frequency, 3)} Hz` },
          { label: t('results.angularFrequency'), value: `${formatFixed(mode.angularFrequency, 3)} rad/s` },
          { label: `${t('results.participatingMass')} X`, value: `${formatFixed(mode.participatingMassRatioX * 100, 1)} %` },
          { label: `${t('results.participatingMass')} Y`, value: `${formatFixed(mode.participatingMassRatioY * 100, 1)} %` },
        ],
        shape: mode.shape,
      }))
    : [];

  const current = rows[selected];
  const drawn = modeShapeState?.kind === kind && modeShapeState.index === selected;

  const toggleCanvas = () => {
    if (drawn || !current) { setModeShapeState(null); return; }
    setModeShapeState({
      kind,
      index: selected,
      // La etiqueta se resuelve aquí: el lienzo pinta, no traduce.
      label: t(kind === 'buckling' ? 'results.bucklingMode' : 'results.modalMode', { index: selected + 1 }),
      shape: current.shape,
    });
  };

  const title = t(kind === 'buckling' ? 'results.buckling' : 'results.modal');
  const computeLabel = t(kind === 'buckling' ? 'results.computeBuckling' : 'results.computeModal');

  return <section className="study-panel" aria-label={title}>
    <header className="study-header">
      <div>
        <h3>{title}</h3>
        <p>{t('results.studyIdle')}</p>
      </div>
      <button type="button" onClick={() => studies.run(kind)} disabled={running || !analysis?.success}>
        {running ? <><LoaderCircle className="spin" size={16} aria-hidden="true" /> {t('results.studyRunning')}</> : result ? t('results.studyRecompute') : computeLabel}
      </button>
    </header>

    {!analysis?.success ? <p className="study-limit">{t('results.studyNeedsAnalysis')}</p> : null}
    {error ? <p className="study-limit" role="alert">{t('results.studyFailed')}: {error}</p> : null}

    {result && !result.success
      ? <p className="study-limit" role="status">{result.reason}</p>
      : null}

    {result?.success && rows.length ? <>
      <ul className="study-modes" role="listbox" aria-label={title}>
        {rows.map((row, index) => <li key={index}>
          <button
            type="button"
            role="option"
            aria-selected={index === selected}
            data-level="raised"
            className={`study-mode-button${index === selected ? ' active' : ''}`}
            onClick={() => setSelected(index)}
          >
            <span>{t(kind === 'buckling' ? 'results.bucklingMode' : 'results.modalMode', { index: index + 1 })}</span>
            <strong>{row.headline}</strong>
            <span>{row.caption}</span>
          </button>
        </li>)}
      </ul>

      {current ? <dl className="study-metrics">
        {current.metrics.map((metric) => <div key={metric.label}>
          <dt>{metric.label}</dt><dd>{metric.value}</dd>
        </div>)}
        <div><dt>{t('results.studyResidual')}</dt><dd>{formatScientific(result.residual, 2)}</dd></div>
        <div><dt>{t('results.studyFreeDof')}</dt><dd>{result.freeDegreesOfFreedom}</dd></div>
        {kind === 'modal' ? <div>
          <dt>{t('results.cumulativeMass')} Y</dt>
          <dd>{formatFixed((result as NonNullable<ModelStudiesState['modal']>).cumulativeMassRatioY * 100, 1)} %</dd>
        </div> : null}
        {kind === 'modal' ? <div>
          <dt>{t('results.totalMass')}</dt>
          <dd>{formatFixed((result as NonNullable<ModelStudiesState['modal']>).totalMass, 3)} Mg</dd>
        </div> : null}
      </dl> : null}

      <button type="button" onClick={toggleCanvas} aria-pressed={drawn}>
        {drawn ? t('results.hideModeOnCanvas') : t('results.showModeOnCanvas')}
      </button>

      {result.issues.length ? <ul className="study-issues">
        {result.issues.map((issue) => <li key={issue.id}>{issue.message}</li>)}
      </ul> : null}
    </> : null}

    <p className="study-limit">{t(kind === 'buckling' ? 'results.bucklingLimit' : 'results.modalLimit')}</p>
    {kind === 'modal' ? <p className="study-limit">{t('results.modalMassSource')}</p> : null}
  </section>;
};
