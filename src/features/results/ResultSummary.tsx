import { useCallback, useMemo } from 'react';
import { Download, GitCompareArrows, Printer, RefreshCw } from 'lucide-react';
import { useScenarioAnalysis } from '../../engine/useScenarioAnalysis';
import { buildDeformationEnvelope, buildReactionEnvelope, summarizeAnalysisResults } from '../../engine/resultSummary';
import { toDisplay, unitLabel } from '../../engine/units';
import { Surface } from '../../design-system/components/surface';
import { resolveReliability } from '../../engine/reliability';
import { useProject, type ResultTab } from '../../store/ProjectContext';
import type { DiagramQuantity, ResponseQuantity } from '../../types';
import { downloadResultsCsv } from '../../utils/resultsExport';
import { formatResultNumber, formatResultValue } from './resultFormatting';
import { useI18n } from '../../i18n/useI18n';
import { formatFixed, formatScientific } from '../../utils/numberFormat';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { NumericQualityCard } from './NumericQualityCard';
import { ElasticDemandCard } from './ElasticDemandCard';
import { ResultExtremeCard } from './ResultExtremeCard';
import type { ResultRef } from './provenance';

const diagramTab: Record<DiagramQuantity, ResultTab> = { axial: 'axial', shear: 'shear', moment: 'moment' };
const diagramSymbol: Record<DiagramQuantity, string> = { axial: 'N', shear: 'V', moment: 'M' };

export const ResultSummary = () => {
  const { project, analysis, setSelection, setResultCursor, setResultTab } = useProject();
  const { language, t } = useI18n();
  const { scenarios, busy: comparisonBusy, error: comparisonError, run: compare } = useScenarioAnalysis(project);
  const summary = useMemo(() => analysis?.success ? summarizeAnalysisResults(analysis) : null, [analysis]);
  const reactionEnvelope = useMemo(() => scenarios ? buildReactionEnvelope(scenarios) : null, [scenarios]);
  const selectedMemberId = summary?.diagrams.moment?.absolute.memberId ?? summary?.members[0]?.memberId ?? '';
  const deformationEnvelope = useMemo(() => scenarios && selectedMemberId ? buildDeformationEnvelope(scenarios, selectedMemberId, 'v') : null, [scenarios, selectedMemberId]);
  const units = project.settings.units;
  /* Estable a propósito: las tarjetas de extremos están memoizadas y no deben
     repintarse cuando el cursor de resultados cambia con el puntero. */
  const locate = useCallback((quantity: DiagramQuantity | ResponseQuantity, memberId: string, x: number) => {
    setSelection({ kind: 'member', id: memberId });
    setResultCursor({ memberId, x, pinned: true });
    setResultTab(quantity === 'u' || quantity === 'v' || quantity === 'theta' ? 'deformed' : diagramTab[quantity]);
  }, [setResultCursor, setResultTab, setSelection]);
  /**
   * Los extremos se derivan del análisis y de las unidades — nunca del cursor —
   * y se pasan ya formateados a tarjetas memoizadas, con los cinco datos que
   * cardificar no puede costar: valor, unidad, posición, fiabilidad y
   * procedencia.
   */
  const extremes = useMemo(() => {
    if (!analysis?.success || !summary) return [];
    const caseOrCombinationId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? '—';
    const lengthLabel = unitLabel(units, 'length');
    const position = (memberId: string, x: number) => `${memberId} · x ${formatResultNumber(toDisplay(x, units, 'length'))} ${lengthLabel}`;
    type ExtremeCardData = {
      id: string;
      accent: 'axial' | 'shear' | 'moment' | 'deformation';
      label: string;
      value: string;
      unit: string;
      position: string;
      onLocate: () => void;
      provenanceRef?: ResultRef;
    };
    const cards: ExtremeCardData[] = (['axial', 'shear', 'moment'] as const).flatMap((quantity) => {
      const item = summary.diagrams[quantity]?.absolute;
      if (!item) return [];
      const unitQuantity = quantity === 'moment' ? 'moment' as const : 'force' as const;
      const symbol = diagramSymbol[quantity];
      return [{
        id: quantity,
        accent: quantity,
        label: t('results.absoluteMaximum', { symbol }),
        value: formatResultNumber(toDisplay(item.value, units, unitQuantity)),
        unit: unitLabel(units, unitQuantity),
        position: position(item.memberId, item.x),
        onLocate: () => locate(quantity, item.memberId, item.x),
        provenanceRef: {
          quantity: symbol as ResultRef['quantity'],
          entity: { kind: 'member', id: item.memberId },
          caseOrCombinationId,
          signConvention: t(quantity === 'axial' ? 'results.signAxial' : quantity === 'shear' ? 'results.signShear' : 'results.signMoment'),
          position: { x: item.x },
        } satisfies ResultRef,
      }];
    });
    const deformation = summary.deformations.v?.absolute;
    if (deformation) cards.push({
      id: 'deformation',
      accent: 'deformation',
      label: t('results.verticalDeformation'),
      value: formatResultNumber(toDisplay(deformation.value, units, 'length')),
      unit: lengthLabel,
      position: `${deformation.memberId} · ${t('results.exactInteriorMaximum')}`,
      onLocate: () => locate('v', deformation.memberId, deformation.x),
      /* Sin procedencia, y a propósito: el máximo interior se evalúa desde la
         forma exacta, no hay dato almacenado que lo respalde y `ResultRef` no
         sabe expresarlo. La tarjeta no reclama una evidencia que no tiene —
         tampoco la tenía la rejilla anterior, así que cardificar no cuesta
         ninguno de los cinco. */
    });
    return cards;
  }, [analysis, locate, project.loadCases, summary, t, units]);
  const reliability = useMemo(() => analysis?.success ? resolveReliability(analysis).level : 'failed', [analysis]);
  if (!analysis?.success || !summary) return null;
  const displayDiagram = (quantity: DiagramQuantity, value: number) => {
    const unitQuantity = quantity === 'moment' ? 'moment' as const : 'force' as const;
    return formatResultValue(toDisplay(value, units, unitQuantity), unitLabel(units, unitQuantity));
  };
  return <section id="classroom-result-summary" className="result-summary-workspace" aria-label={t('results.summaryWorkspace')} tabIndex={-1}>
    <header className="result-summary-header">
      <div><strong>{t('results.globalSummaryTitle')}</strong><span>{t('results.globalSummaryHint')}</span></div>
      <div className="result-summary-actions">
        <button onClick={() => { downloadResultsCsv(project, analysis); emitWorkspaceCommand('show-toast', { message: t('export.completed'), tone: 'success' }); }}><Download size={16} /> CSV</button>
        <button onClick={() => window.print()}><Printer size={16} /> {t('results.printPdf')}</button>
        <button disabled={comparisonBusy} onClick={compare}>{comparisonBusy ? <RefreshCw className="spin" size={16} /> : <GitCompareArrows size={16} />} {scenarios ? t('results.updateComparison') : t('results.compareCases')}</button>
      </div>
    </header>
    <ElasticDemandCard />
    <NumericQualityCard analysis={analysis} />
    {analysis.pDelta ? <section className="p-delta-summary" aria-label={t('pdelta.summaryTitle')}>
      <strong>{t('pdelta.summaryTitle')} <span className="experimental-badge">{t('pdelta.experimental')}</span></strong>
      <span className={analysis.pDelta.converged ? 'is-resolved' : 'is-warning'}>{analysis.pDelta.converged ? t('pdelta.converged') : t('pdelta.notConverged')}</span>
      <small>{t('pdelta.experimentalNote')}</small>
      <small>{t('pdelta.iterationsSummary', { steps: analysis.pDelta.loadStepsUsed, iterations: analysis.pDelta.totalIterations })}</small>
      {typeof analysis.pDelta.amplificationFactor === 'number' ? <small>{t('pdelta.amplification', { factor: formatFixed(analysis.pDelta.amplificationFactor, 3) })}</small> : null}
      <small>{t('pdelta.equilibriumResidual', {
        value: formatScientific(analysis.pDelta.finalEquilibriumResidual, 2),
        axial: formatScientific(analysis.pDelta.finalAxialChange, 2),
      })}</small>
      {/* Rendered from the structured factor rather than the engine's own
          message so the reading follows the selected language, and always
          alongside the note that it is an estimate, never a computed eigenvalue. */}
      {typeof analysis.pDelta.criticalLoadFactor === 'number' ? <>
        <small className={analysis.pDelta.stabilityWarning ? 'is-warning' : undefined}>{t('pdelta.criticalFactor', {
          factor: formatFixed(analysis.pDelta.criticalLoadFactor, 2),
          percent: formatFixed(100 / analysis.pDelta.criticalLoadFactor, 0),
        })}</small>
        <small>{t('pdelta.criticalFactorNote')}</small>
        {analysis.pDelta.stabilityWarning ? <small className="is-warning">{t('pdelta.discretizationHint')}</small> : null}
      </> : null}
      {analysis.pDelta.failureReason ? <small className="is-warning">{t('pdelta.failureReason', { reason: analysis.pDelta.failureReason })}</small> : null}
    </section> : null}
    <div className="result-extreme-grid">
      {extremes.map((extreme) => <ResultExtremeCard
        key={extreme.id}
        label={extreme.label}
        value={extreme.value}
        unit={extreme.unit}
        position={extreme.position}
        reliability={reliability}
        accent={extreme.accent}
        analysis={analysis}
        provenanceRef={extreme.provenanceRef}
        onLocate={extreme.onLocate}
      />)}
    </div>
    <Surface as="section" level="raised" className="result-table-card" aria-label={t('results.memberExtremaCaption')}>
      <div className="summary-table-wrap"><table className="results-table result-extrema-table"><caption>{t('results.memberExtremaCaption')}</caption><thead><tr><th>{t('results.member')}</th><th>N</th><th>V</th><th>M</th><th>v</th></tr></thead><tbody>{summary.members.map((member) => <tr key={member.memberId}><th scope="row">{member.memberId}</th>{(['axial', 'shear', 'moment'] as const).map((quantity) => { const item = member.diagrams[quantity].absolute; return <td key={quantity}><button onClick={() => locate(quantity, member.memberId, item.x)}>{displayDiagram(quantity, item.value)}<small>x {formatResultNumber(toDisplay(item.x, units, 'length'))}</small></button></td>; })}<td>{member.deformations.v?.absolute ? <button onClick={() => locate('v', member.memberId, member.deformations.v!.absolute.x)}>{formatResultValue(toDisplay(member.deformations.v.absolute.value, units, 'length'), unitLabel(units, 'length'))}<small>x {formatResultNumber(toDisplay(member.deformations.v.absolute.x, units, 'length'))}</small></button> : '—'}</td></tr>)}</tbody></table></div>
    </Surface>
    {scenarios ? <section className="scenario-comparison" aria-live="polite"><div className="scenario-comparison-heading"><div><strong>{t('results.scenarioComparison')}</strong><span>{t('results.scenariosSolved', { count: reactionEnvelope?.includedScenarioIds.length ?? 0 })}</span></div><small>{t('results.smallMultiplesHint')}</small></div><div className="scenario-cards">{scenarios.map((scenario) => { const item = summarizeAnalysisResults(scenario.result); return <article key={scenario.id}><strong>{scenario.name}</strong>{(['axial', 'shear', 'moment'] as const).map((quantity) => <span key={quantity}><b>{diagramSymbol[quantity]}</b>{scenario.failureReason || !item.diagrams[quantity] ? '—' : displayDiagram(quantity, item.diagrams[quantity]!.absolute.value)}</span>)}{/* El motivo del fallo vivía sólo en `title`: invisible para teclado y
             para lectores de pantalla, y perdido en táctil. Ahora es texto. El
             motivo lo redacta el motor en español, así que fuera de ese idioma
             se publica la lectura equivalente traducida. */}
        {scenario.failureReason ? <small className="scenario-card-failure">{language === 'es' ? scenario.failureReason : t('results.scenarioUnsolved')}</small> : null}</article>; })}</div><div className="envelope-summary"><span><b>{t('results.reactionEnvelope')}</b>{t('results.nodesCompared', { count: reactionEnvelope?.nodes.length ?? 0 })}</span><span><b>{t('results.deformationEnvelope', { member: selectedMemberId })}</b>{deformationEnvelope ? `${formatScientific(toDisplay(deformationEnvelope.minimum.value, units, 'length'), 2)} → ${formatScientific(toDisplay(deformationEnvelope.maximum.value, units, 'length'), 2)} ${unitLabel(units, 'length')}` : t('results.unavailable')}</span></div></section> : null}
    {comparisonError ? <p className="scenario-error" role="alert">{language === 'es' ? comparisonError : t('results.comparisonFailed')}</p> : null}
  </section>;
};
