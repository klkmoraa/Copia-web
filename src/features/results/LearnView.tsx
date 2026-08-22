import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AlertCircle, Check, ChevronDown, LoaderCircle } from 'lucide-react';
import { useProject } from '../../store/ProjectContext';
import { evaluateEducationalAssertions, type EducationalAssertionEvaluation } from '../../engine/educationalAssertions';
import type { EducationalAssertionTarget, MatrixTrace, MemberModel } from '../../types';
import { toDisplay, unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import { buildStiffnessSubstitution } from './stiffnessSubstitution';
import { formatFixed, formatScientific, formatSignificant } from '../../utils/numberFormat';
import { ClassroomPedagogyLevels } from '../classroom/ClassroomPedagogyLevels';

/**
 * «Entender» — vista densa invocada (CRI-101).
 *
 * Es exactamente el mismo contenido que vivía en la pestaña `learn` del panel:
 * el explorador del método de rigidez, la sustitución numérica, los niveles
 * pedagógicos y el procedimiento paso a paso. **Aula usa el mismo análisis y
 * las mismas vistas**; lo único que cambia es que ahora se invocan en lugar de
 * ocupar sitio de forma residente.
 */
const MatrixView = ({ title, trace }: { title: string; trace: MatrixTrace }) => {
  const { t } = useI18n();
  const rowLimit = Math.min(trace.rows, 12);
  const columnLimit = Math.min(trace.columns, 12);
  const values = new Map(trace.entries.map((entry) => [`${entry.row}:${entry.column}`, entry.value]));
  return <div className="matrix-view"><div className="matrix-view-heading"><strong>{title}</strong><span>{trace.rows} × {trace.columns}</span></div>{trace.rows > rowLimit || trace.columns > columnLimit ? <small>{t('results.partialMatrix')}</small> : null}<div className="matrix-scroll"><table aria-label={title}><thead><tr><th>{t('results.dof')}</th>{trace.columnLabels.slice(0, columnLimit).map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{trace.rowLabels.slice(0, rowLimit).map((label, row) => <tr key={label}><th scope="row">{label}</th>{Array.from({ length: columnLimit }, (_, column) => { const value = values.get(`${row}:${column}`) ?? 0; return <td className={value === 0 ? 'zero' : ''} key={`${row}-${column}`}>{value === 0 ? '·' : formatScientific(value, 2)}</td>; })}</tr>)}</tbody></table></div></div>;
};

/**
 * The step between the symbolic formula and the assembled matrix.
 *
 * `MatrixView` above already prints kˡ as finished numbers; on its own it shows *that* an
 * entry is 3.61e4, never *why*. Each row here restates the formula in force, substitutes the
 * member's own E, A, I and L, and lands on a number the reader can find in that grid — the
 * arithmetic stays in base units precisely so the two agree on screen.
 */
const NumericalSubstitution = ({ member, length }: { member: MemberModel; length: number }) => {
  const { t } = useI18n();
  const { terms, inputs, phi, theory } = useMemo(() => buildStiffnessSubstitution(member, length), [member, length]);
  if (!terms.length) return null;
  const axialTerms = terms.filter((term) => term.id === 'axial');
  const bendingTerms = terms.filter((term) => term.id !== 'axial');
  const group = (label: string, rows: typeof terms) => rows.length ? <tbody key={label}>
    <tr className="substitution-group"><th colSpan={4} scope="colgroup">{label}</th></tr>
    {rows.map((term) => <tr key={term.id}>
      <td><code>{term.entry}</code></td>
      <td className="substitution-formula">{term.formula}</td>
      <td className="substitution-values">{term.substitution}</td>
      <td className="substitution-result"><strong>{formatSignificant(term.value, 5)}</strong> <span>{term.unit}</span></td>
    </tr>)}
  </tbody> : null;
  return <div className="education-numerical-substitution">
    <div className="education-substitution-heading">
      <div><strong>{t('results.numericalSubstitutionTitle')}</strong><small>{t('results.numericalSubstitutionSubtitle')}</small></div>
      <span>{theory === 'timoshenko' ? `${t('results.shearFactorPhi')} = ${formatSignificant(phi, 4)}` : 'Φ = 0'}</span>
    </div>
    <dl className="education-substitution-inputs">{inputs.map((input) => <div key={input.id}>
      <dt>{input.symbol}</dt><dd>{formatSignificant(input.value, 5)} <span>{input.unit}</span></dd>
    </div>)}</dl>
    <div className="table-wrap"><table className="results-table education-substitution-table">
      <thead><tr>
        <th scope="col">{t('results.substitutionEntry')}</th>
        <th scope="col">{t('results.substitutionFormula')}</th>
        <th scope="col">{t('results.substitutionValues')}</th>
        <th scope="col">{t('results.substitutionResult')}</th>
      </tr></thead>
      {group(t('results.axialStiffnessLabel'), axialTerms)}
      {group(t('results.bendingStiffnessLabel'), bendingTerms)}
    </table></div>
    <small>{member.type === 'truss' ? t('results.substitutionTrussNote') : t('results.substitutionBaseUnits')}</small>
  </div>;
};

const EducationExplorer = () => {
  const { analysis, project, selection, setSelection, setLearningFocus, ensureEducationTrace } = useProject();
  const { t } = useI18n();
  const trace = analysis?.educationTrace;
  const [stage, setStage] = useState<'model' | 'dofs' | 'element' | 'assembly' | 'verify'>('model');
  const [elementId, setElementId] = useState(() => selection?.kind === 'member' ? selection.id : trace?.elements[0]?.memberId ?? '');
  const [elementMatrix, setElementMatrix] = useState<'local' | 'condensed' | 'transform' | 'global'>('local');
  const explorerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (stage === 'element' && elementId) setLearningFocus({ nodeIds: [], memberIds: [elementId] });
    else setLearningFocus(null);
    return () => setLearningFocus(null);
  }, [elementId, setLearningFocus, stage]);
  // The interactive analysis run skips the matrix trace for speed (AG-013);
  // this tab is the one place that reads it, so it fetches it on demand here.
  useEffect(() => { void ensureEducationTrace(); }, [ensureEducationTrace, analysis]);
  if (!trace) return analysis?.success ? <div className="results-view-loading" role="status" aria-label={t('results.loadingTrace')}><LoaderCircle className="spin" size={20} aria-hidden="true" /><span>{t('results.loadingTrace')}</span></div> : null;
  const element = trace.elements.find((item) => item.memberId === elementId) ?? trace.elements[0];
  const elementMember = element ? project.members.find((item) => item.id === element.memberId) : undefined;
  const stages = [
    { id: 'model' as const, label: t('results.stageModel') },
    { id: 'dofs' as const, label: t('results.stageDofs') },
    { id: 'element' as const, label: t('results.stageElement') },
    { id: 'assembly' as const, label: t('results.stageAssembly') },
    { id: 'verify' as const, label: t('results.stageVerification') },
  ];
  const onStageKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + stages.length) % stages.length;
    else if (event.key === 'ArrowRight') nextIndex = (index + 1) % stages.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = stages.length - 1;
    else return;
    event.preventDefault();
    const next = stages[nextIndex];
    setStage(next.id);
    window.requestAnimationFrame(() => explorerRef.current?.querySelector<HTMLButtonElement>(`[data-education-stage-tab="${next.id}"]`)?.focus());
  };
  const focusDof = (nodeId: string) => {
    setSelection({ kind: 'node', id: nodeId });
    setLearningFocus({ nodeIds: [nodeId], memberIds: [] });
  };
  return <section ref={explorerRef} className="education-explorer" aria-label={t('results.stiffnessExplorer')}><div className="education-explorer-heading"><div><strong>{t('results.stiffnessExplorer')}</strong><small>{t('results.stiffnessExplorerSubtitle')}</small></div><span>{trace.formulation === 'linear-static-mixed-beam' ? 'Euler–Bernoulli + Timoshenko' : 'Euler–Bernoulli'}</span></div><div className="education-stage-tabs" role="tablist" aria-label={t('results.methodStages')}>{stages.map((item, index) => <button id={`education-stage-tab-${item.id}`} type="button" role="tab" aria-selected={stage === item.id} aria-controls={`education-stage-panel-${item.id}`} tabIndex={stage === item.id ? 0 : -1} data-education-stage-tab={item.id} className={stage === item.id ? 'active' : ''} key={item.id} onClick={() => setStage(item.id)} onKeyDown={(event) => onStageKeyDown(event, index)}>{item.label}</button>)}</div>
    {stage === 'model' ? <div id="education-stage-panel-model" className="education-stage" role="tabpanel" aria-labelledby="education-stage-tab-model"><div className="education-kpis"><div><span>{t('results.nodes')}</span><strong>{project.nodes.length}</strong></div><div><span>{t('results.members')}</span><strong>{project.members.length}</strong></div><div><span>{t('results.dofs')}</span><strong>{trace.dofs.length}</strong></div><div><span>{t('results.constraints')}</span><strong>{trace.assembly.constraintMatrix.rows}</strong></div></div><div className="equation-block">[ K  Cᵀ ; C  0 ] [ U ; λ ] = [ F ; g ]</div><p>{t('results.stiffnessMethodSummary')}</p></div> : null}
    {stage === 'dofs' ? <div id="education-stage-panel-dofs" className="education-stage table-wrap" role="tabpanel" aria-labelledby="education-stage-tab-dofs"><table className="results-table dof-table"><thead><tr><th>{t('results.dof')}</th><th>{t('results.state')}</th><th>U</th><th>F</th><th>R</th><th>{t('results.residual')}</th></tr></thead><tbody>{trace.dofs.map((dof) => <tr key={dof.index}><td><button type="button" className="result-object-link" aria-label={t('results.showNodeForDof', { node: dof.nodeId, dof: dof.label })} onClick={() => focusDof(dof.nodeId)}><strong>{dof.label}</strong></button></td><td>{dof.constrained ? dof.prescribedValue ? t('results.prescribed') : t('results.constrained') : t('results.free')}</td><td>{formatScientific(dof.displacement, 3)}</td><td>{formatScientific(dof.appliedLoad, 3)}</td><td>{formatScientific(dof.reaction, 3)}</td><td>{formatScientific(dof.residual, 2)}</td></tr>)}</tbody></table></div> : null}
    {stage === 'element' && element ? <div id="education-stage-panel-element" className="education-stage" role="tabpanel" aria-labelledby="education-stage-tab-element"><div className="education-element-controls"><label><span>{t('results.member')}</span><select value={element.memberId} onChange={(event) => { setElementId(event.target.value); setSelection({ kind: 'member', id: event.target.value }); }}>{trace.elements.map((item) => <option key={item.memberId} value={item.memberId}>{item.memberId}</option>)}</select></label><label><span>{t('results.matrix')}</span><select value={elementMatrix} onChange={(event) => setElementMatrix(event.target.value as typeof elementMatrix)}><option value="local">{t('results.matrixOptionLocal')}</option><option value="condensed">{t('results.matrixOptionReleased')}</option><option value="transform">{t('results.matrixOptionTransform')}</option><option value="global">{t('results.matrixOptionGlobal')}</option></select></label></div><div className="education-kpis"><div><span>{t('results.flexibleLength')}</span><strong>{formatSignificant(element.length, 5)} m</strong></div><div><span>cos θ</span><strong>{formatSignificant(element.c, 4)}</strong></div><div><span>{t('results.sineTheta')}</span><strong>{formatSignificant(element.s, 4)}</strong></div><div><span>{t('results.releasedDofs')}</span><strong>{element.releasedLocalDofs.length ? element.releasedLocalDofs.join(', ') : '—'}</strong></div></div>{elementMember ? <NumericalSubstitution member={elementMember} length={element.length} /> : null}<MatrixView title={elementMatrix === 'local' ? t('results.localStiffnessMatrix') : elementMatrix === 'condensed' ? t('results.releasedStiffnessMatrix') : elementMatrix === 'transform' ? t('results.transformationMatrix') : t('results.globalContributionMatrix')} trace={elementMatrix === 'local' ? element.localStiffnessOriginal : elementMatrix === 'condensed' ? element.localStiffnessEffective : elementMatrix === 'transform' ? element.transformation : element.globalStiffnessContribution} /><div className="equation-block">qˡ = kˡ dˡ − fˡ₀</div></div> : null}
    {stage === 'assembly' ? <div id="education-stage-panel-assembly" className="education-stage" role="tabpanel" aria-labelledby="education-stage-tab-assembly"><div className="education-kpis"><div><span>{t('results.detail')}</span><strong>{trace.assembly.matrixDetail === 'full' ? t('results.full') : t('results.summary')}</strong></div><div><span>{t('results.strainEnergy')}</span><strong>{formatScientific(trace.assembly.strainEnergy, 3)}</strong></div><div><span>‖F‖∞</span><strong>{formatScientific(Math.max(0, ...trace.assembly.load.map(Math.abs)), 3)}</strong></div></div><MatrixView title={t('results.globalStiffnessMatrix')} trace={trace.assembly.stiffness} /><MatrixView title={t('results.constraintMatrix')} trace={trace.assembly.constraintMatrix} /></div> : null}
    {stage === 'verify' ? <div id="education-stage-panel-verify" className="education-stage verification-grid" role="tabpanel" aria-labelledby="education-stage-tab-verify"><div className={(analysis?.residualNorm ?? 1) < 1e-8 ? 'passed' : 'warning'}><span>{t('results.algebraicEquilibrium')}</span><strong>{formatScientific(analysis?.residualNorm, 3)}</strong><small>{t('results.normalizedEquilibriumResidual')}</small></div><div className={(analysis?.constraintResidual ?? 1) < 1e-9 ? 'passed' : 'warning'}><span>{t('results.compatibility')}</span><strong>{formatScientific(analysis?.constraintResidual, 3)}</strong><small>{t('results.normalizedCompatibilityResidual')}</small></div><div className={(analysis?.linearResidual ?? 1) < 1e-12 ? 'passed' : 'warning'}><span>{t('results.linearSolver')}</span><strong>{formatScientific(analysis?.linearResidual, 3)}</strong><small>{t('results.refinementCount', { count: analysis?.refinementIterations ?? 0 })}</small></div><div className={(analysis?.forwardErrorBound ?? 1) < 1e-6 ? 'passed' : 'warning'}><span>{t('results.errorBound')}</span><strong>{formatScientific(analysis?.forwardErrorBound, 3)}</strong><small>{t('results.reliableDigits', { digits: formatFixed(analysis?.reliableDigits, 1) ?? '0' })}</small></div></div> : null}
  </section>;
};

export const LearnView = () => {
  const { analysis, project, setLearningFocus } = useProject();
  const { t } = useI18n();
  const educationalCase = project.educationalCase;
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<'summary' | 'steps' | 'full'>('steps');
  useEffect(() => () => setLearningFocus(null), [setLearningFocus]);
  return <div className="learning-steps">
    <EducationExplorer />
    <ClassroomPedagogyLevels />
    <div className="learning-toolbar"><div><strong>{t('results.linkedProcedure')}</strong><small>{t('results.learningStepCount', { count: analysis?.explanation.length ?? 0 })}</small></div><div className="learning-level" role="group" aria-label={t('results.detailLevel')}><button aria-pressed={detailLevel === 'summary'} className={detailLevel === 'summary' ? 'active' : ''} onClick={() => setDetailLevel('summary')}>{t('results.summary')}</button><button aria-pressed={detailLevel === 'steps'} className={detailLevel === 'steps' ? 'active' : ''} onClick={() => setDetailLevel('steps')}>{t('results.stepByStep')}</button><button aria-pressed={detailLevel === 'full'} className={detailLevel === 'full' ? 'active' : ''} onClick={() => setDetailLevel('full')}>{t('results.full')}</button></div></div>
    {educationalCase ? <section className="educational-source">
      <div><strong>{educationalCase.chapter}</strong><span>{educationalCase.kind === 'attributed-example' ? t('results.attributedExample') : t('results.originalPractice')}</span></div>
      <p>{educationalCase.note}</p>
      <ul>{educationalCase.expectedResults.map((result) => <li key={result}>{result}</li>)}</ul>
      {analysis && educationalCase.expectedAssertions?.length ? <AssertionResults evaluations={evaluateEducationalAssertions(educationalCase.expectedAssertions, analysis)} /> : null}
      {educationalCase.sourceUrl ? <a href={educationalCase.sourceUrl} target="_blank" rel="noreferrer">{t('results.source', { title: educationalCase.sourceTitle })}</a> : <small>{educationalCase.sourceTitle}</small>}
    </section> : null}
    {analysis?.explanation.map((step, index) => <details key={step.id} className={`learning-step detail-${detailLevel}`} onToggle={(event) => {
      if (event.currentTarget.open) {
        setFocusedStepId(step.id);
        setLearningFocus({ nodeIds: step.relatedNodeIds ?? [], memberIds: step.relatedMemberIds ?? [] });
      } else if (focusedStepId === step.id) {
        setFocusedStepId(null);
        setLearningFocus(null);
      }
    }}><summary><span className="learn-check">{index + 1}</span><div><strong>{step.title}</strong><small>{step.category} · {t('results.equationCount', { count: step.equations.length })}</small></div><ChevronDown size={17} /></summary><div className="learning-content"><p>{step.summary}</p>{detailLevel === 'full' && step.inputs?.length ? <><small className="learning-value-heading">{t('results.inputData')}</small><dl className="learning-values inputs">{step.inputs.map((input) => <div key={`${step.id}-input-${input.label}`}><dt>{input.label}</dt><dd>{Number.isFinite(input.value) ? formatSignificant(input.value, 6) : '—'} {input.unit}</dd></div>)}</dl></> : null}{detailLevel !== 'summary' ? step.equations.map((equation) => <div className="equation-block" key={equation}>{equation}</div>) : null}{detailLevel !== 'summary' && step.outputs?.length ? <><small className="learning-value-heading">{t('results.outputs')}</small><dl className="learning-values">{step.outputs.map((output) => <div key={`${step.id}-${output.label}`}><dt>{output.label}</dt><dd>{Number.isFinite(output.value) ? formatSignificant(output.value, 6) : '—'} {output.unit}</dd></div>)}</dl></> : null}{detailLevel === 'full' && step.relatedMemberIds?.length && step.relatedNodeIds?.length ? <small className="learning-related">{t('results.relatedMembersAndNodes', { members: step.relatedMemberIds.join(', '), nodes: step.relatedNodeIds.join(', ') })}</small> : detailLevel === 'full' && step.relatedMemberIds?.length ? <small className="learning-related">{t('results.relatedMembers', { members: step.relatedMemberIds.join(', ') })}</small> : detailLevel === 'full' && step.relatedNodeIds?.length ? <small className="learning-related">{t('results.relatedNodes', { nodes: step.relatedNodeIds.join(', ') })}</small> : null}</div></details>)}
  </div>;
};

const assertionQuantity = (target: EducationalAssertionTarget): 'length' | 'force' | 'moment' | 'rotation' => {
  if (target.kind === 'node-result') {
    if (target.component === 'ux' || target.component === 'uy') return 'length';
    if (target.component === 'rz') return 'rotation';
    if (target.component === 'rm') return 'moment';
    return 'force';
  }
  return target.quantity === 'moment' ? 'moment' : 'force';
};

const AssertionResults = ({ evaluations }: { evaluations: EducationalAssertionEvaluation[] }) => {
  const { project } = useProject();
  const { t } = useI18n();
  const units = project.settings.units;
  const passed = evaluations.filter((evaluation) => evaluation.passed).length;
  return <div className="assertion-results">
    <div className="assertion-summary"><strong>{t('results.autoCheck')}</strong><span>{t('results.passed', { passed, total: evaluations.length })}</span></div>
    {evaluations.map((evaluation) => {
      const quantity = assertionQuantity(evaluation.assertion.target);
      const convert = (value: number) => quantity === 'rotation' ? value : toDisplay(value, units, quantity);
      const unit = quantity === 'rotation' ? 'rad' : unitLabel(units, quantity);
      return <div className={`assertion-row ${evaluation.passed ? 'passed' : 'failed'}`} key={evaluation.assertion.id}>
        <span className="assertion-status">{evaluation.passed ? <Check size={13} /> : <AlertCircle size={13} />}</span>
        <div><strong>{evaluation.assertion.label}</strong>{evaluation.unavailableReason ? <small>{evaluation.unavailableReason}</small> : <small>{t('results.calculatedExpected', { actual: formatSignificant(convert(evaluation.actual), 6), expected: formatSignificant(convert(evaluation.expected), 6), unit })}</small>}</div>
        <div className="assertion-errors"><span>{t('results.absoluteError')} {Number.isFinite(evaluation.absoluteError) ? formatScientific(convert(evaluation.absoluteError), 2) : '—'} {unit}</span><span>{t('results.relativeError')} {Number.isFinite(evaluation.relativeError) ? `${formatScientific((evaluation.relativeError * 100), 2)} %` : '—'}</span></div>
      </div>;
    })}
  </div>;
};
