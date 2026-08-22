/**
 * Resultados de Space 3D.
 *
 * Los seis componentes se muestran siempre juntos y con su unidad: en un marco
 * espacial no hay un «valor principal», y ocultar tres de ellos es lo que hace
 * que un usuario confunda un giro con un desplazamiento.
 *
 * Un resultado obsoleto se etiqueta y se conserva; uno fallido muestra los
 * códigos de issue. En ningún caso se borra el modelo del usuario.
 */
import { AlertTriangle, ChevronDown, CircleCheck, CircleSlash, Clock } from 'lucide-react';
import type { Space3DAnalysisIssue, Space3DAnalysisResult } from '../../space3d/model/types';
import type { Space3DAnalysisState } from '../../space3d/store/Space3DProjectContext';
import { formatNumber } from '../../utils/numberFormat';
import type { TranslationKey } from '../../i18n/catalogs';

export type Space3DResultsTab = 'summary' | 'nodes' | 'members' | 'diagnostics';

export interface Space3DResultsPanelProps {
  readonly analysis: Space3DAnalysisResult | null;
  readonly analysisState: Space3DAnalysisState;
  readonly tab: Space3DResultsTab;
  readonly onTabChange: (tab: Space3DResultsTab) => void;
  readonly deformationScale: number | null;
  readonly maxDisplacement: number | null;
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  readonly onSelectNode: (id: string) => void;
  readonly onSelectMember: (id: string) => void;
}

const TABS: readonly { id: Space3DResultsTab; key: TranslationKey }[] = [
  { id: 'summary', key: 'space3d.resultsSummary' },
  { id: 'nodes', key: 'space3d.resultsNodes' },
  { id: 'members', key: 'space3d.resultsMembers' },
  { id: 'diagnostics', key: 'space3d.resultsDiagnostics' },
];

const ISSUE_KEYS: Record<string, TranslationKey> = {
  mechanism: 'space3d.error.mechanism',
  'no-free-dof': 'space3d.error.noFreeDof',
  'empty-model': 'space3d.error.emptyModel',
  'unknown-target': 'space3d.error.unknownTarget',
  'non-finite-solution': 'space3d.error.analysisFailed',
  'duplicate-id': 'space3d.error.duplicateId',
  'empty-id': 'space3d.error.emptyId',
  'missing-reference': 'space3d.error.missingEntity',
  'self-referential-member': 'space3d.error.selfReferential',
  'invalid-coordinate': 'space3d.error.invalidValue',
  'invalid-property': 'space3d.error.invalidValue',
  'degenerate-length': 'space3d.error.invalidValue',
  'degenerate-orientation': 'space3d.error.invalidValue',
  'missing-case': 'space3d.error.missingEntity',
  'unknown-field': 'space3d.error.unknownField',
  'limit-exceeded': 'space3d.error.limitExceeded',
};

const STATE_META: Record<Space3DAnalysisState, { key: TranslationKey; tone: string; Icon: typeof CircleCheck }> = {
  idle: { key: 'space3d.stateIdle', tone: 'neutral', Icon: Clock },
  running: { key: 'space3d.stateRunning', tone: 'loading', Icon: Clock },
  ready: { key: 'space3d.stateReady', tone: 'ok', Icon: CircleCheck },
  stale: { key: 'space3d.stateStale', tone: 'warn', Icon: AlertTriangle },
  failed: { key: 'space3d.stateFailed', tone: 'error', Icon: CircleSlash },
  cancelled: { key: 'space3d.stateCancelled', tone: 'neutral', Icon: CircleSlash },
};

/**
 * Una sola política numérica en todo el producto: `utils/numberFormat` decide
 * cuándo un valor se lee en decimal y cuándo en científica, y qué se imprime
 * cuando no hay número. Los desplazamientos espaciales son del orden de 1e-5 m,
 * así que el contexto `table` es el que evita una columna de ceros.
 */
const engineering = (value: number, digits = 6): string =>
  formatNumber(value, 'table', { significantDigits: digits });

/** Acciones de extremo: cuatro cifras bastan y mantienen la columna estrecha. */
const action = (value: number): string => formatNumber(value, 'table', { significantDigits: 4 });

export const Space3DResultsPanel = ({
  analysis, analysisState, tab, onTabChange, deformationScale, maxDisplacement, t, onSelectNode, onSelectMember,
}: Space3DResultsPanelProps) => {
  const meta = STATE_META[analysisState];
  const StateIcon = meta.Icon;

  const banner = () => {
    if (analysisState === 'ready') return <p className="space3d-notice space3d-notice--ok" role="status">{t('space3d.readyNotice')}</p>;
    if (analysisState === 'stale') return <p className="space3d-notice space3d-notice--warn" role="status">{t('space3d.staleNotice')}</p>;
    if (analysisState === 'failed') return <p className="space3d-notice space3d-notice--error" role="alert">{t('space3d.failedNotice')}</p>;
    if (analysisState === 'idle' || analysisState === 'cancelled') return <p className="space3d-notice">{t('space3d.idleNotice')}</p>;
    return null;
  };

  const issueList = (issues: readonly Space3DAnalysisIssue[]) => <ul className="space3d-issues">
    {issues.map((issue, index) => <li key={`${issue.code}-${issue.entityId}-${index}`}>
      <code>{issue.code}</code>
      <span>{t(ISSUE_KEYS[issue.code] ?? 'space3d.error.generic')}</span>
      {issue.entityId ? <em>{issue.entityKind} {issue.entityId}{issue.field ? `.${issue.field}` : ''}</em> : null}
    </li>)}
  </ul>;

  return <section className="space3d-results" aria-label={t('space3d.tabResults')}>
    <header className="space3d-results-head">
      <span className={`space3d-state space3d-state--${meta.tone}`} data-testid="space3d-analysis-state-label">
        <StateIcon size={15} aria-hidden="true" />{t(meta.key)}
      </span>
      {deformationScale !== null && analysisState === 'ready'
        ? <span className="space3d-chip">{t('space3d.deformationScale', { scale: engineering(deformationScale, 4) })}</span>
        : null}
    </header>

    {banner()}

    <label className="space3d-view-select space3d-results-select">
      <span className="space3d-field-label">{t('space3d.resultsTablesLabel')}</span>
      <select value={tab} onChange={(event) => onTabChange(event.target.value as Space3DResultsTab)}>
        {TABS.map((entry) => <option key={entry.id} value={entry.id}>{t(entry.key)}</option>)}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>

    {tab === 'summary' ? <dl className="space3d-metrics">
      <div><dt>{t('space3d.dofCount')}</dt><dd>{analysis?.diagnostics.dofCount ?? '—'}</dd></div>
      <div><dt>{t('space3d.freeDofCount')}</dt><dd>{analysis?.diagnostics.freeDofCount ?? '—'}</dd></div>
      <div><dt>{t('space3d.restrainedDofCount')}</dt><dd>{analysis?.diagnostics.restrainedDofCount ?? '—'}</dd></div>
      <div><dt>{t('space3d.residual')}</dt><dd>{analysis ? engineering(analysis.diagnostics.relativeResidual) : '—'}</dd></div>
      <div><dt>{t('space3d.condition')}</dt><dd>{analysis ? engineering(analysis.diagnostics.conditionEstimate) : '—'}</dd></div>
      <div><dt>{t('space3d.equilibrium')}</dt><dd>{analysis ? engineering(analysis.diagnostics.equilibrium.normalized) : '—'}</dd></div>
      <div>
        <dt>{t('space3d.maxDisplacement')}</dt>
        <dd>{maxDisplacement === null ? '—' : `${engineering(maxDisplacement)} ${t('space3d.unitLength')}`}</dd>
      </div>
    </dl> : null}

    {tab === 'nodes' ? <div className="space3d-table-scroll">
      <table className="space3d-table" aria-label={`${t('space3d.displacement')} · ${t('space3d.reaction')}`}>
        <thead>
          <tr>
            <th scope="col">{t('space3d.node')}</th>
            {(['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const).map((dof) => <th key={dof} scope="col">{dof}</th>)}
          </tr>
        </thead>
        <tbody>
          {(analysis?.nodeResults ?? []).flatMap((item) => [
            <tr key={`${item.nodeId}-d`}>
              <th scope="row">
                <button type="button" className="space3d-linkish" onClick={() => onSelectNode(item.nodeId)}>{item.nodeId}</button>
                <em>{t('space3d.displacement')}</em>
              </th>
              {(['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const).map((dof) => <td key={dof}>{engineering(item.displacement[dof])}</td>)}
            </tr>,
            <tr key={`${item.nodeId}-r`} className="space3d-row-secondary">
              <th scope="row"><span aria-hidden="true">{item.nodeId}</span><em>{t('space3d.reaction')}</em></th>
              {(['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const).map((dof) => <td key={dof}>{engineering(item.reaction[dof], 4)}</td>)}
            </tr>,
          ])}
        </tbody>
      </table>
    </div> : null}

    {tab === 'members' ? <div className="space3d-table-scroll">
      <table className="space3d-table" aria-label={t('space3d.endForces')}>
        <thead>
          <tr>
            <th scope="col">{t('space3d.member')}</th>
            <th scope="col">N</th><th scope="col">Vy</th><th scope="col">Vz</th>
            <th scope="col">T</th><th scope="col">My</th><th scope="col">Mz</th>
          </tr>
        </thead>
        <tbody>
          {(analysis?.memberResults ?? []).flatMap((item) => [
            <tr key={`${item.memberId}-i`}>
              <th scope="row">
                <button type="button" className="space3d-linkish" onClick={() => onSelectMember(item.memberId)}>{item.memberId}</button>
                <em>{t('space3d.startEnd')}</em>
              </th>
              <td className="space3d-axial">{action(item.start.N)}</td>
              <td className="space3d-shear">{action(item.start.Vy)}</td>
              <td className="space3d-shear">{action(item.start.Vz)}</td>
              <td>{action(item.start.T)}</td>
              <td className="space3d-moment">{action(item.start.My)}</td>
              <td className="space3d-moment">{action(item.start.Mz)}</td>
            </tr>,
            <tr key={`${item.memberId}-j`} className="space3d-row-secondary">
              <th scope="row"><span aria-hidden="true">{item.memberId}</span><em>{t('space3d.finishEnd')}</em></th>
              <td className="space3d-axial">{action(item.end.N)}</td>
              <td className="space3d-shear">{action(item.end.Vy)}</td>
              <td className="space3d-shear">{action(item.end.Vz)}</td>
              <td>{action(item.end.T)}</td>
              <td className="space3d-moment">{action(item.end.My)}</td>
              <td className="space3d-moment">{action(item.end.Mz)}</td>
            </tr>,
          ])}
        </tbody>
      </table>
    </div> : null}

    {tab === 'diagnostics' ? <div className="space3d-diagnostics">
      {analysis && analysis.issues.length > 0 ? issueList(analysis.issues) : <p className="space3d-notice">{t('space3d.noDiagnostics')}</p>}
      {analysis?.success ? <dl className="space3d-metrics">
        <div>
          <dt>{t('space3d.equilibriumForce')}</dt>
          <dd>{analysis.diagnostics.equilibrium.force.map((value) => engineering(value, 4)).join(' · ')}</dd>
        </div>
        <div>
          <dt>{t('space3d.equilibriumMoment')}</dt>
          <dd>{analysis.diagnostics.equilibrium.moment.map((value) => engineering(value, 4)).join(' · ')}</dd>
        </div>
      </dl> : null}
    </div> : null}
  </section>;
};
