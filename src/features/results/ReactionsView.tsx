import { useMemo } from 'react';
import { Surface } from '../../design-system/components/surface';
import { resolveReliability } from '../../engine/reliability';
import { toDisplay, unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import type { ResultRef } from './provenance';
import { ResultExtremeCard } from './ResultExtremeCard';
import { formatResultNumber } from './resultFormatting';

/**
 * Reacciones — vista densa invocada (CRI-101).
 *
 * Los tres extremos van en tarjeta Clay `RAISED` con sus cinco datos; la tabla
 * completa sigue existiendo y sigue siendo comparable de un vistazo, sólo que
 * ahora **dentro** de una tarjeta que le hace de marco: la tabla es `BASE`, sin
 * sombra, sin celdas clay y sin canto redondeado por fila. Ninguna fila
 * dictamina: no hay check por fila, porque una fila no es un veredicto.
 */
export const ReactionsView = () => {
  const { analysis, project, selection, setSelection } = useProject();
  const { t } = useI18n();
  const units = project.settings.units;
  const lengthUnit = unitLabel(units, 'length');
  const forceUnit = unitLabel(units, 'force');
  const momentUnit = unitLabel(units, 'moment');
  const nodeResults = useMemo(() => analysis?.nodeResults ?? [], [analysis]);
  const reliability = analysis ? resolveReliability(analysis).level : 'failed';
  const caseOrCombinationId = project.loadCases.find((loadCase) => loadCase.active)?.id
    ?? project.loadCases[0]?.id
    ?? '—';

  /**
   * Los extremos no dependen del cursor de resultados: se derivan una sola vez
   * del análisis y de las unidades, y se pasan a tarjetas memoizadas.
   */
  const extremes = useMemo(() => {
    type NodeResult = (typeof nodeResults)[number];
    const critical = (pick: (result: NodeResult) => number): NodeResult | null => nodeResults.reduce<NodeResult | null>(
      (best, result) => !best || Math.abs(pick(result)) > Math.abs(pick(best)) ? result : best,
      null,
    );
    const entries: Array<{
      id: string;
      symbol: string;
      nodeId: string;
      value: number;
      quantity: 'force' | 'moment';
      component: ResultRef['component'];
    }> = [];
    const rx = critical((result) => result.rx);
    const ry = critical((result) => result.ry);
    const rm = critical((result) => result.rm);
    if (rx) entries.push({ id: 'rx', symbol: 'Rx', nodeId: rx.nodeId, value: rx.rx, quantity: 'force', component: 'x' });
    if (ry) entries.push({ id: 'ry', symbol: 'Ry', nodeId: ry.nodeId, value: ry.ry, quantity: 'force', component: 'y' });
    if (rm) entries.push({ id: 'rm', symbol: 'Mz', nodeId: rm.nodeId, value: rm.rm, quantity: 'moment', component: 'rotation' });
    return entries;
  }, [nodeResults]);

  const provenanceRefs = useMemo(() => new Map(extremes.map((extreme) => [extreme.id, {
    quantity: 'R',
    entity: { kind: 'node', id: extreme.nodeId },
    component: extreme.component,
    caseOrCombinationId,
    signConvention: t(extreme.component === 'x'
      ? 'results.signGlobalX'
      : extreme.component === 'y' ? 'results.signGlobalY' : 'results.signGlobalRotation'),
  } satisfies ResultRef])), [caseOrCombinationId, extremes, t]);

  return <div className="dense-reactions">
    <div className="result-extreme-grid">
      {extremes.map((extreme) => <ResultExtremeCard
        key={extreme.id}
        label={`${extreme.symbol} ${t('results.maximum')}`}
        value={formatResultNumber(toDisplay(extreme.value, units, extreme.quantity))}
        unit={extreme.quantity === 'moment' ? momentUnit : forceUnit}
        position={`${t('results.node')} ${extreme.nodeId}`}
        reliability={reliability}
        accent="reaction"
        analysis={analysis ?? undefined}
        provenanceRef={provenanceRefs.get(extreme.id)}
        onLocate={() => setSelection({ kind: 'node', id: extreme.nodeId })}
      />)}
    </div>
    <Surface as="section" level="raised" className="result-table-card" aria-label={t('results.reactionCaption')}>
      <div className="table-wrap">
        <table className="results-table">
          <caption>{t('results.reactionCaption')}</caption>
          <thead><tr><th scope="col">{t('results.node')}</th><th scope="col">Ux ({lengthUnit})</th><th scope="col">Uy ({lengthUnit})</th><th scope="col">Rz (rad)</th><th scope="col">Rx ({forceUnit})</th><th scope="col">Ry ({forceUnit})</th><th scope="col">Mz ({momentUnit})</th></tr></thead>
          <tbody>{nodeResults.map((result) => {
            const selected = selection?.kind === 'node' && selection.id === result.nodeId;
            return <tr key={result.nodeId} aria-selected={selected || undefined}>
              <th scope="row"><button type="button" className="result-object-link" aria-pressed={selected} onClick={() => setSelection({ kind: 'node', id: result.nodeId })}>{result.nodeId}<span className="sr-only"> · {t('results.locateModel')}</span></button></th>
              <td>{formatResultNumber(toDisplay(result.ux, units, 'length'))}</td><td>{formatResultNumber(toDisplay(result.uy, units, 'length'))}</td><td>{formatResultNumber(result.rz)}</td>
              <td>{formatResultNumber(toDisplay(result.rx, units, 'force'))}</td>
              <td>{formatResultNumber(toDisplay(result.ry, units, 'force'))}</td>
              <td>{formatResultNumber(toDisplay(result.rm, units, 'moment'))}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </Surface>
  </div>;
};
