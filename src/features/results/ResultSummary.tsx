import { useMemo } from 'react';
import { Download, GitCompareArrows, LocateFixed, Printer, RefreshCw } from 'lucide-react';
import { useScenarioAnalysis } from '../../engine/useScenarioAnalysis';
import { buildDeformationEnvelope, buildReactionEnvelope, summarizeAnalysisResults } from '../../engine/resultSummary';
import { toDisplay, unitLabel } from '../../engine/units';
import { useProject, type ResultTab } from '../../store/ProjectContext';
import type { DiagramQuantity, ResponseQuantity } from '../../types';
import { downloadResultsCsv } from '../../utils/resultsExport';
import { useClassroomSession } from '../../store/ClassroomSessionContext';
import { formatResultNumber, formatResultValue } from './resultFormatting';
import { useI18n } from '../../i18n/useI18n';
import { formatFixed, formatScientific } from '../../utils/numberFormat';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';

const diagramTab: Record<DiagramQuantity, ResultTab> = { axial: 'axial', shear: 'shear', moment: 'moment' };
const diagramSymbol: Record<DiagramQuantity, string> = { axial: 'N', shear: 'V', moment: 'M' };

export const ResultSummary = () => {
  const { project, analysis, setSelection, setResultCursor, setResultTab } = useProject();
  const { language, t } = useI18n();
  const { scenarios, busy: comparisonBusy, error: comparisonError, run: compare } = useScenarioAnalysis(project);
  const { predictions, signPredictions } = useClassroomSession();
  const summary = useMemo(() => analysis?.success ? summarizeAnalysisResults(analysis) : null, [analysis]);
  const reactionEnvelope = useMemo(() => scenarios ? buildReactionEnvelope(scenarios) : null, [scenarios]);
  const selectedMemberId = summary?.diagrams.moment?.absolute.memberId ?? summary?.members[0]?.memberId ?? '';
  const classroom = project.settings.calculationMode === 'classroom';
  const deformationEnvelope = useMemo(() => !classroom && scenarios && selectedMemberId ? buildDeformationEnvelope(scenarios, selectedMemberId, 'v') : null, [classroom, scenarios, selectedMemberId]);
  if (!analysis?.success || !summary) return null;
  const units = project.settings.units;
  const locate = (quantity: DiagramQuantity | ResponseQuantity, memberId: string, x: number) => {
    setSelection({ kind: 'member', id: memberId });
    setResultCursor({ memberId, x, pinned: true });
    setResultTab(quantity === 'u' || quantity === 'v' || quantity === 'theta' ? 'deformed' : diagramTab[quantity]);
  };
  const displayDiagram = (quantity: DiagramQuantity, value: number) => {
    const unitQuantity = quantity === 'moment' ? 'moment' as const : 'force' as const;
    return formatResultValue(toDisplay(value, units, unitQuantity), unitLabel(units, unitQuantity));
  };
  const signLabels = {
    positive: t('classroom.signPositive'),
    negative: t('classroom.signNegative'),
    zero: t('classroom.signZero'),
    changes: t('classroom.signChanges'),
  } as const;
  const actualSign = (quantity: DiagramQuantity, memberId: string) => {
    const extrema = summary.members.find((item) => item.memberId === memberId)?.diagrams[quantity];
    if (!extrema) return null;
    if (extrema.minimum.value < 0 && extrema.maximum.value > 0) return 'changes' as const;
    if (extrema.absolute.value === 0) return 'zero' as const;
    return extrema.absolute.value > 0 ? 'positive' as const : 'negative' as const;
  };
  const predictionCards = [...new Set([...Object.keys(predictions), ...Object.keys(signPredictions)])].flatMap((memberId) =>
    (['axial', 'shear', 'moment'] as const).flatMap((quantity) => {
      const predictedBase = predictions[memberId]?.[quantity];
      const predictedSign = signPredictions[memberId]?.[quantity];
      const member = summary.members.find((item) => item.memberId === memberId);
      if ((predictedBase === undefined && predictedSign === undefined) || !member) return [];
      const unitQuantity = quantity === 'moment' ? 'moment' as const : 'force' as const;
      const unit = unitLabel(units, unitQuantity);
      const actual = member.diagrams[quantity].absolute;
      const actualDisplay = toDisplay(actual.value, units, unitQuantity);
      const predictedDisplay = predictedBase === undefined ? undefined : toDisplay(predictedBase, units, unitQuantity);
      const measuredSign = actualSign(quantity, memberId);
      return [<button key={`${memberId}-${quantity}`} onClick={() => locate(quantity, memberId, actual.x)}>
        <b>{memberId} · {diagramSymbol[quantity]}</b>
        {predictedSign ? <span>{t('classroom.predictedSign', { sign: signLabels[predictedSign] })}</span> : null}
        {measuredSign ? <span>{t('classroom.actualSign', { sign: signLabels[measuredSign] })}</span> : null}
        {predictedDisplay === undefined ? null : <>
          <span>{t('classroom.predictedValue', { value: formatResultValue(predictedDisplay, unit) })}</span>
          <span>{t('classroom.actualValue', { value: formatResultValue(actualDisplay, unit) })}</span>
          <small>{t('classroom.predictionError', { value: formatResultValue(Math.abs(predictedDisplay - actualDisplay), unit) })}</small>
        </>}
        {predictedDisplay === undefined ? <small>{t('classroom.qualitativeComparison')}</small> : null}
      </button>];
    }),
  );
  return <section id="classroom-result-summary" className="result-summary-workspace" aria-label={t('results.summaryWorkspace')} tabIndex={-1}>
    <header className="result-summary-header">
      <div><strong>{t('results.globalSummaryTitle')}</strong><span>{t('results.globalSummaryHint')}</span></div>
      <div className="result-summary-actions">
        <button onClick={() => { downloadResultsCsv(project, analysis); emitWorkspaceCommand('show-toast', { message: t('export.completed'), tone: 'success' }); }}><Download size={15} /> CSV</button>
        <button onClick={() => window.print()}><Printer size={15} /> {t('results.printPdf')}</button>
        <button disabled={comparisonBusy} onClick={compare}>{comparisonBusy ? <RefreshCw className="spin" size={15} /> : <GitCompareArrows size={15} />} {scenarios ? t('results.updateComparison') : t('results.compareCases')}</button>
      </div>
    </header>
    {analysis.pDelta ? <section className="p-delta-summary" aria-label={t('pdelta.summaryTitle')}>
      <strong>{t('pdelta.summaryTitle')}</strong>
      <span className={analysis.pDelta.converged ? 'is-resolved' : 'is-warning'}>{analysis.pDelta.converged ? t('pdelta.converged') : t('pdelta.notConverged')}</span>
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
    <div className="global-extrema-grid">
      {(['axial', 'shear', 'moment'] as const).map((quantity) => {
        const item = summary.diagrams[quantity]?.absolute;
        return item ? <button className={quantity} key={quantity} onClick={() => locate(quantity, item.memberId, item.x)}><span>{t('results.absoluteMaximum', { symbol: diagramSymbol[quantity] })}</span><strong>{displayDiagram(quantity, item.value)}</strong><small>{item.memberId} · x {formatResultNumber(toDisplay(item.x, units, 'length'))} {unitLabel(units, 'length')}</small><LocateFixed size={14} /></button> : null;
      })}
      {!classroom && summary.deformations.v?.absolute ? <button className="deformation" onClick={() => { const item = summary.deformations.v!.absolute; locate('v', item.memberId, item.x); }}><span>{t('results.verticalDeformation')}</span><strong>{formatResultValue(toDisplay(summary.deformations.v.absolute.value, units, 'length'), unitLabel(units, 'length'))}</strong><small>{summary.deformations.v.absolute.memberId} · {t('results.exactInteriorMaximum')}</small><LocateFixed size={14} /></button> : null}
    </div>
    {predictionCards.length ? <section className="prediction-comparison"><div><strong>{t('classroom.comparisonTitle')}</strong><span>{t('classroom.comparisonBody')}</span></div><div>{predictionCards}</div></section> : null}
    <div className="summary-table-wrap"><table className="results-table result-extrema-table"><caption>{t('results.memberExtremaCaption')}</caption><thead><tr><th>{t('results.member')}</th><th>N</th><th>V</th><th>M</th>{classroom ? null : <th>v</th>}</tr></thead><tbody>{summary.members.map((member) => <tr key={member.memberId}><th scope="row">{member.memberId}</th>{(['axial', 'shear', 'moment'] as const).map((quantity) => { const item = member.diagrams[quantity].absolute; return <td key={quantity}><button onClick={() => locate(quantity, member.memberId, item.x)}>{displayDiagram(quantity, item.value)}<small>x {formatResultNumber(toDisplay(item.x, units, 'length'))}</small></button></td>; })}{classroom ? null : <td>{member.deformations.v?.absolute ? <button onClick={() => locate('v', member.memberId, member.deformations.v!.absolute.x)}>{formatResultValue(toDisplay(member.deformations.v.absolute.value, units, 'length'), unitLabel(units, 'length'))}<small>x {formatResultNumber(toDisplay(member.deformations.v.absolute.x, units, 'length'))}</small></button> : '—'}</td>}</tr>)}</tbody></table></div>
    {scenarios ? <section className="scenario-comparison" aria-live="polite"><div className="scenario-comparison-heading"><div><strong>{t('results.scenarioComparison')}</strong><span>{t('results.scenariosSolved', { count: reactionEnvelope?.includedScenarioIds.length ?? 0 })}</span></div><small>{t('results.smallMultiplesHint')}</small></div><div className="scenario-cards">{scenarios.map((scenario) => { const item = summarizeAnalysisResults(scenario.result); return <article key={scenario.id} title={scenario.failureReason}><strong>{scenario.name}</strong>{(['axial', 'shear', 'moment'] as const).map((quantity) => <span key={quantity}><b>{diagramSymbol[quantity]}</b>{scenario.failureReason || !item.diagrams[quantity] ? '—' : displayDiagram(quantity, item.diagrams[quantity]!.absolute.value)}</span>)}</article>; })}</div><div className="envelope-summary"><span><b>{t('results.reactionEnvelope')}</b>{t('results.nodesCompared', { count: reactionEnvelope?.nodes.length ?? 0 })}</span>{classroom ? null : <span><b>{t('results.deformationEnvelope', { member: selectedMemberId })}</b>{deformationEnvelope ? `${formatScientific(toDisplay(deformationEnvelope.minimum.value, units, 'length'), 2)} → ${formatScientific(toDisplay(deformationEnvelope.maximum.value, units, 'length'), 2)} ${unitLabel(units, 'length')}` : t('results.unavailable')}</span>}</div></section> : null}
    {comparisonError ? <p className="scenario-error" role="alert">{language === 'es' ? comparisonError : t('results.comparisonFailed')}</p> : null}
  </section>;
};
