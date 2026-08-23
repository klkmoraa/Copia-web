import { useEffect, useState } from 'react';
import { Grid3x3, Stethoscope, TriangleAlert } from 'lucide-react';
import { unitLabel, toDisplay } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis } from '../../store/ProjectAnalysisContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { buildModelOverview } from './modelOverview';

/**
 * Recuento de hallazgos del Model Doctor.
 *
 * Se carga igual que lo carga `WorkspaceShell`: por `import()` diferido, para
 * que el diagnostico no entre en el chunk del area de trabajo solo por
 * enseñar un numero. Los dos llamantes resuelven al mismo chunk.
 *
 * Hasta aqui este recuento solo existia como un aviso pasajero que se va solo.
 * Un modelo con tres hallazgos y un aviso ya cerrado no tenia forma de decirlo.
 */
const useModelDoctorTotal = (): number | null => {
  const { project } = useProjectModel();
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let current = true;
    void import('../model-doctor/modelDoctorDiagnostics').then(({ buildModelDoctorReport }) => {
      if (current) setTotal(buildModelDoctorReport(project).total);
    });
    return () => { current = false; };
  }, [project]);
  return total;
};

const Census = ({ rows }: { rows: readonly { label: string; value: number }[] }) => (
  <dl className="model-overview__census">
    {rows.map((row) => <div key={row.label}>
      <dt>{row.label}</dt>
      <dd>{row.value}</dd>
    </div>)}
  </dl>
);

/**
 * Lo que el panel derecho enseña cuando no hay nada seleccionado.
 *
 * Sustituye a dos tarjetas que decian lo mismo y no informaban de nada. El
 * criterio de que entra aqui esta en `modelOverview.ts`: solo lo que hoy no
 * enseña ninguna otra superficie. El estado del analisis y la fiabilidad viven
 * en la barra superior y **no** se repiten.
 */
export const ModelOverview = () => {
  const { project } = useProjectModel();
  const { selectedCombinationId } = useProjectAnalysis();
  const { language, t } = useI18n();
  const overview = buildModelOverview(project, selectedCombinationId);
  const doctorTotal = useModelDoctorTotal();
  const units = project.settings.units;

  if (overview.empty) {
    return <section className="model-overview is-empty" aria-label={t('overview.region')}>
      <h3>{t('overview.emptyTitle')}</h3>
      <p>{t('overview.emptyBody')}</p>
      <button type="button" className="model-overview__action" onClick={() => emitWorkspaceCommand('open-structure-generator')}>
        <Grid3x3 size={18} aria-hidden="true" />
        <span>
          <strong>{t('generator.launcher')}</strong>
          <small>{t('overview.generatorHint')}</small>
        </span>
      </button>
    </section>;
  }

  const length = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 2 })
    .format(toDisplay(value, units, 'length'));

  return <section className="model-overview" aria-label={t('overview.region')}>
    <h3>{t('overview.title')}</h3>
    <Census rows={[
      { label: t('inspector.nodes'), value: overview.census.nodes },
      { label: t('inspector.members'), value: overview.census.members },
      { label: t('overview.supports'), value: overview.census.supports },
      { label: t('inspector.loadsTab'), value: overview.census.loads },
    ]} />

    <dl className="model-overview__facts">
      {overview.extent ? <div>
        <dt>{t('overview.extent')}</dt>
        <dd>{length(overview.extent.width)} × {length(overview.extent.height)} {unitLabel(units, 'length')}</dd>
      </div> : null}
      <div>
        <dt>{t('overview.loadCases')}</dt>
        <dd>{t('overview.loadCasesValue', { active: overview.loadCases.active, total: overview.loadCases.total })}</dd>
      </div>
      <div>
        <dt>{t('inspector.analyze')}</dt>
        <dd>{overview.loadCases.combinationName ?? t('analysis.activeCases')}</dd>
      </div>
    </dl>

    {doctorTotal !== null && doctorTotal > 0 ? <button
      type="button"
      className="model-overview__action is-warning"
      onClick={() => emitWorkspaceCommand('open-model-doctor')}
    >
      <TriangleAlert size={18} aria-hidden="true" />
      <span>
        <strong>{t('overview.doctorFindings', { count: doctorTotal })}</strong>
        <small>{t('overview.doctorHint')}</small>
      </span>
    </button> : null}

    {doctorTotal === 0 ? <p className="model-overview__clean">
      <Stethoscope size={16} aria-hidden="true" /> {t('overview.doctorClean')}
    </p> : null}
  </section>;
};
