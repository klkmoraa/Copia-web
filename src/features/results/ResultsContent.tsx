import { lazy, Suspense, useEffect, useId, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertCircle, CircleDotDashed, LoaderCircle } from 'lucide-react';
import { useProject } from '../../store/ProjectContext';
import { evaluateDeformationAt, evaluateDiagramAt, segmentBezierControls } from '../../engine/diagram';
import { resolveReliability } from '../../engine/reliability';
import { buildDiagramEnvelope, evaluateEnvelopeAt } from '../../engine/envelope';
import { analysisSignature } from '../../engine/projectSignature';
import { useScenarioAnalysis } from '../../engine/useScenarioAnalysis';
import type { DiagramQuantity, DiagramSegment, MemberResult } from '../../types';
import { toDisplay, unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { ResultSummary } from './ResultSummary';
import { NumericQualityCard } from './NumericQualityCard';
import { deriveClassroomProgress, type ClassroomProgressStepId } from '../../education/classroomProgress';
import { formatFixed, formatScientific } from '../../utils/numberFormat';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { ProvenanceCard } from './ProvenanceCard';
import { ResultExtremeCard } from './ResultExtremeCard';
import { ReactionsView } from './ReactionsView';
import { LearnView } from './LearnView';
import type { ResultRef } from './provenance';
import {
  RESULT_FAMILIES,
  RESULT_TABS_IN_ORDER,
  RESULT_TAB_COLOR,
  RESULT_TAB_LABEL_KEY,
  resolveResultTab,
} from '../data/dataSurface';

const LazyInfluenceLineView = lazy(() => import('./InfluenceLineView').then((module) => ({ default: module.InfluenceLineView })));

const classroomProgressCopy: Record<ClassroomProgressStepId, { title: TranslationKey; description: TranslationKey; action: TranslationKey }> = {
  geometry: { title: 'classroom.buildTitle', description: 'classroom.buildBody', action: 'classroom.buildAction' },
  supports: { title: 'classroom.defineTitle', description: 'classroom.defineBody', action: 'classroom.defineAction' },
  loads: { title: 'classroom.defineTitle', description: 'classroom.defineBody', action: 'classroom.defineAction' },
  analysis: { title: 'classroom.analyzeTitle', description: 'classroom.analyzeBody', action: 'classroom.analyzeAction' },
};

/**
 * El cuerpo de Resultados dentro de la superficie «Datos».
 *
 * Lo que YA NO ESTA aqui, y por que. Este componente era un dock inferior
 * redimensionable con tres modos (compacto · expandido · enfoque), un tirador
 * de arrastre, una altura persistida, un conmutador movil y una trampa de
 * `Escape` propia. Todo eso existia porque era un dock, y un dock tiene que
 * negociar su alto con el lienzo. Dentro de una superficie modal no hay nada
 * que negociar: el cromo —titulo, cerrar, `peek`— lo pone `DataSurface` una
 * sola vez para las tres pestañas.
 *
 * Lo que SI llego aqui: las tres lecturas que vivian en `DenseResultsSurface`
 * —Reacciones, Influencia y «Entender»—. Estaban separadas por componente, no
 * por dominio: las nueve lecturas siempre fueron un solo `ResultTab`.
 */
export const ResultsContent = () => {
  const {
    project,
    analysis,
    resultTab,
    setResultTab,
    analyze,
    selection,
    isAnalyzing,
    selectedCombinationId,
    resultCursor,
    setInfluenceCanvasState,
  } = useProject();
  const { t } = useI18n();

  const resultContext = useMemo(() => {
    if (selection?.kind === 'member') return { memberId: selection.id, label: t('results.contextMember', { id: selection.id }) };
    if (selection?.kind === 'multi') {
      const memberId = selection.memberIds.find((id) => analysis?.memberResults.some((result) => result.memberId === id));
      return { memberId, label: t('results.contextMulti', { count: selection.nodeIds.length + selection.memberIds.length }) };
    }
    if (selection?.kind === 'memberLoad') {
      const load = project.memberLoads.find((item) => item.id === selection.id);
      return { memberId: load?.memberId, label: load
        ? t('results.contextMemberLoad', { loadId: load.id, memberId: load.memberId })
        : t('results.contextLoad', { id: selection.id }) };
    }
    if (selection?.kind === 'nodalLoad') {
      const load = project.nodalLoads.find((item) => item.id === selection.id);
      return { memberId: undefined, label: load
        ? t('results.contextNodalLoad', { loadId: load.id, nodeId: load.nodeId })
        : t('results.contextLoad', { id: selection.id }) };
    }
    if (selection?.kind === 'node') return { memberId: undefined, label: t('results.contextNode', { id: selection.id }) };
    const first = analysis?.memberResults[0]?.memberId ?? project.members.find((member) => member.type !== 'rigid')?.id;
    return { memberId: first, label: t('results.contextGlobal') };
  }, [analysis?.memberResults, project.memberLoads, project.members, project.nodalLoads, selection, t]);

  const selectedMemberId = resultContext.memberId;
  const memberResult = selectedMemberId ? analysis?.memberResults.find((result) => result.memberId === selectedMemberId) : undefined;
  const activeTab = resolveResultTab(resultTab);

  const provenanceRef = useMemo<ResultRef | null>(() => {
    if (!analysis?.success) return null;
    const caseOrCombinationId = selectedCombinationId || project.loadCases.find((loadCase) => loadCase.active)?.id || project.loadCases[0]?.id || '—';
    if (activeTab === 'axial' || activeTab === 'shear' || activeTab === 'moment') {
      if (!memberResult) return null;
      const storedStart = memberResult.diagram[0];
      const cursor = resultCursor?.memberId === memberResult.memberId ? resultCursor : null;
      const quantity = activeTab === 'axial' ? 'N' : activeTab === 'shear' ? 'V' : 'M';
      return {
        quantity,
        entity: { kind: 'member', id: memberResult.memberId },
        caseOrCombinationId,
        signConvention: quantity === 'N' ? t('results.signAxial') : quantity === 'V' ? t('results.signShear') : t('results.signMoment'),
        position: { x: cursor?.x ?? storedStart?.x ?? 0, side: cursor ? undefined : storedStart?.side },
      };
    }
    if (activeTab === 'summary' || activeTab === 'reactions' || activeTab === 'deformed' || activeTab === 'learn') {
      const nodeId = selection?.kind === 'node' ? selection.id : analysis.nodeResults[0]?.nodeId;
      if (!nodeId) return null;
      const reaction = activeTab === 'reactions';
      return {
        quantity: reaction ? 'R' : 'U',
        entity: { kind: 'node', id: nodeId },
        component: 'y',
        caseOrCombinationId,
        signConvention: t('results.signGlobalY'),
      };
    }
    return null;
  }, [activeTab, analysis, memberResult, project.loadCases, resultCursor, selectedCombinationId, selection, t]);

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowLeft') next = (index - 1 + RESULT_TABS_IN_ORDER.length) % RESULT_TABS_IN_ORDER.length;
    else if (event.key === 'ArrowRight') next = (index + 1) % RESULT_TABS_IN_ORDER.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = RESULT_TABS_IN_ORDER.length - 1;
    else return;
    event.preventDefault();
    const target = RESULT_TABS_IN_ORDER[next];
    setResultTab(target);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-result-tab="${target}"]`)?.focus());
  };

  return <div className="results-content" data-results-tab={activeTab}>
    {/* Estado del análisis y fiabilidad viven en el TopBar desde CRI-100: son
        la afirmación más crítica del producto y deben verse sin abrir nada.
        Aquí sólo queda el contexto — qué objeto describen estas lecturas. */}
    <p className="results-context">
      <span>{t('results.center')}</span>
      <strong>{resultContext.label}</strong>
    </p>

    <nav className="result-tabs" role="tablist" aria-label={t('results.panel')}>
      {RESULT_FAMILIES.map((family) => <div className="result-tab-family" role="presentation" key={family.id}>
        <span id={`result-family-${family.id}`} className="result-tab-family__label">{t(family.labelKey)}</span>
        <div role="presentation">{family.tabs.map((tab) => {
          const index = RESULT_TABS_IN_ORDER.indexOf(tab);
          const color = RESULT_TAB_COLOR[tab];
          return <button
            id={`result-tab-${tab}`}
            key={tab}
            data-result-tab={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-describedby={`result-family-${family.id}`}
            aria-controls="results-content"
            tabIndex={activeTab === tab ? 0 : -1}
            className={`${activeTab === tab ? 'active' : ''} ${color ?? ''}`.trim()}
            onClick={() => setResultTab(tab)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >{t(RESULT_TAB_LABEL_KEY[tab as Exclude<typeof tab, 'issues'>])}</button>;
        })}</div>
      </div>)}
    </nav>

    <div id="results-content" className="results-body" role="tabpanel" aria-labelledby={`result-tab-${activeTab}`} aria-busy={isAnalyzing}>
      {!analysis ? <EmptyResults onAnalyze={analyze} /> : null}
      {analysis && !analysis.success ? <FailedResults onOpenModelDoctor={() => emitWorkspaceCommand('open-data', { tab: 'review' })} /> : null}
      {analysis?.success && activeTab === 'summary' ? <ResultSummary /> : null}
      {analysis?.success && activeTab === 'reactions' ? <ReactionsView /> : null}
      {analysis?.success && (activeTab === 'axial' || activeTab === 'shear' || activeTab === 'moment')
        ? <DiagramView type={activeTab} memberResult={memberResult} memberId={selectedMemberId ?? ''} /> : null}
      {analysis?.success && activeTab === 'deformed' ? <DeformationView memberResult={memberResult} memberId={selectedMemberId ?? ''} /> : null}
      {analysis?.success && activeTab === 'influence' ? <Suspense fallback={<div className="results-view-loading" role="status" aria-label={t('results.loadingInfluence')}><LoaderCircle className="spin" size={20} aria-hidden="true" /><span>{t('results.loadingInfluence')}</span></div>}>
        <LazyInfluenceLineView project={project} selection={selection ?? undefined} onCanvasStateChange={setInfluenceCanvasState} />
      </Suspense> : null}
      {analysis?.success && activeTab === 'learn' ? <LearnView /> : null}
      {analysis?.success && provenanceRef ? <ProvenanceCard analysis={analysis} resultRef={provenanceRef} /> : null}
    </div>
  </div>;
};

const EmptyResults = ({ onAnalyze }: { onAnalyze: () => void }) => {
  const { t } = useI18n();
  const { project, setActiveTool } = useProject();
  const classroom = project.settings.calculationMode === 'classroom';
  const current = classroom ? deriveClassroomProgress(project).currentStep : null;
  const currentCopy = current ? classroomProgressCopy[current.id] : null;
  const run = () => {
    if (current?.action.kind === 'tool') setActiveTool(current.action.tool);
    else onAnalyze();
  };
  return <div className="empty-results"><CircleDotDashed size={28} /><div><strong>{currentCopy ? t('results.nextStep', { title: t(currentCopy.title) }) : t('results.readyTitle')}</strong><p>{currentCopy ? t(currentCopy.description) : t('results.readyBody')}</p></div><button onClick={run}>{currentCopy ? t(currentCopy.action) : t('results.analyzeStructure')}</button></div>;
};

const FailedResults = ({ onOpenModelDoctor }: { onOpenModelDoctor: () => void }) => {
  const { analysis } = useProject();
  const { t } = useI18n();
  return <div className="failed-results-layout">
    {analysis ? <NumericQualityCard analysis={analysis} /> : null}
    <div className="failed-results"><AlertCircle size={28} /><div><strong>{t('results.failedTitle')}</strong><p>{t('results.failedBody')}</p></div><button onClick={onOpenModelDoctor}>{t('modelDoctor.open')}</button></div>
  </div>;
};

const DiagramView = ({ type, memberResult, memberId }: { type: DiagramQuantity; memberResult: MemberResult | undefined; memberId: string }) => {
  const { project, analysis, selectedCombinationId, setSelection, resultCursor, setResultCursor } = useProject();
  const { t } = useI18n();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [envelopeMode, setEnvelopeMode] = useState(false);
  const cursorHelpId = useId();
  const { scenarios: envelopeScenarios, busy: envelopeBusy, run: runEnvelopeAnalysis } = useScenarioAnalysis(project);
  // Only a change the solver would see invalidates the envelope; units,
  // language or diagram scale leave the solved scenarios exact.
  const modelSignature = useMemo(() => analysisSignature(project), [project]);
  useEffect(() => { setEnvelopeMode(false); }, [modelSignature]);
  const envelope = useMemo(() => envelopeScenarios ? buildDiagramEnvelope(envelopeScenarios, memberId, type) : null, [envelopeScenarios, memberId, type]);
  const units = project.settings.units;
  if (!memberResult?.diagramSegments.length) return <div className="empty-small">{t('results.selectMember')}</div>;
  const min = type === 'axial' ? memberResult.minAxial : type === 'shear' ? memberResult.minShear : memberResult.minMoment;
  const max = type === 'axial' ? memberResult.maxAxial : type === 'shear' ? memberResult.maxShear : memberResult.maxMoment;
  const maxAbs = Math.max(Math.abs(min), Math.abs(max), Math.abs(envelope?.minimum.value ?? 0), Math.abs(envelope?.maximum.value ?? 0), 1e-9);
  const L = memberResult.length;
  const pinnedX = resultCursor?.memberId === memberId && resultCursor.pinned ? Math.max(0, Math.min(L, resultCursor.x)) : null;
  const width = 820;
  const height = 190;
  const baseline = 98;
  const amplitude = 70;
  const sx = (x: number) => (x / L) * width;
  const sy = (value: number) => baseline - (value / maxAbs) * amplitude;
  const first = segmentBezierControls(memberResult.diagramSegments[0], type);
  const lineCommands = [`M ${sx(first.x0)} ${sy(first.y0)}`];
  const fillCommands = [`M 0 ${baseline}`, `L ${sx(first.x0)} ${sy(first.y0)}`];
  memberResult.diagramSegments.forEach((segment, index) => {
    const control = segmentBezierControls(segment, type);
    const command = `C ${sx(control.c1x)} ${sy(control.c1y)} ${sx(control.c2x)} ${sy(control.c2y)} ${sx(control.x1)} ${sy(control.y1)}`;
    lineCommands.push(command);
    fillCommands.push(command);
    const next = memberResult.diagramSegments[index + 1];
    if (next) {
      const nextControl = segmentBezierControls(next, type);
      if (Math.abs(nextControl.y0 - control.y1) > 1e-10) {
        const jumpCommand = `L ${sx(nextControl.x0)} ${sy(nextControl.y0)}`;
        lineCommands.push(jumpCommand);
        fillCommands.push(jumpCommand);
      }
    }
  });
  fillCommands.push(`L ${width} ${baseline}`, 'Z');
  const envelopePath = (branch: 'minimum' | 'maximum') => {
    if (!envelope) return '';
    const commands: string[] = [];
    envelope.segments.forEach((segment, index) => {
      const coefficients = segment[branch].coefficients;
      const synthetic: DiagramSegment = {
        x0: segment.x0,
        x1: segment.x1,
        axial: [coefficients[0], coefficients[1], coefficients[2]],
        shear: [coefficients[0], coefficients[1], coefficients[2]],
        moment: coefficients,
        distributedAxial: [0, 0],
        distributedTransverse: [0, 0],
      };
      const control = segmentBezierControls(synthetic, type);
      if (index === 0) commands.push(`M ${sx(control.x0)} ${sy(control.y0)}`);
      else commands.push(`L ${sx(control.x0)} ${sy(control.y0)}`);
      commands.push(`C ${sx(control.c1x)} ${sy(control.c1y)} ${sx(control.c2x)} ${sy(control.c2y)} ${sx(control.x1)} ${sy(control.y1)}`);
    });
    return commands.join(' ');
  };
  const label = type === 'axial' ? t('results.axialDiagram') : type === 'shear' ? t('results.shearDiagram') : t('results.momentDiagram');
  const unit = type === 'moment' ? unitLabel(units, 'moment') : unitLabel(units, 'force');
  const quantity = type === 'moment' ? 'moment' as const : 'force' as const;
  const displayValue = (value: number) => toDisplay(value, units, quantity);
  const colorClass = type;
  const diagramAriaLabel = t('results.diagramForMember', { diagram: label, member: memberId });
  const displayCritical = memberResult.criticalPoints
    .filter((point) => point.quantity === type && ['maximum', 'minimum', 'jump', 'end', 'zero'].includes(point.kind))
    .filter((point, index, all) => all.findIndex((candidate) => Math.abs(candidate.x - point.x) < Math.max(L, 1) * 1e-7 && Math.abs(candidate.value - point.value) < Math.max(maxAbs, 1) * 1e-7 && candidate.side === point.side) === index)
    .slice(0, 14);
  const lengthUnit = unitLabel(units, 'length');
  const maxPoint = memberResult.criticalPoints.find((point) => point.quantity === type && point.kind === 'maximum');
  const minPoint = memberResult.criticalPoints.find((point) => point.quantity === type && point.kind === 'minimum');
  const reliability = analysis ? resolveReliability(analysis).level : 'failed';
  const caseOrCombinationId = selectedCombinationId
    || project.loadCases.find((loadCase) => loadCase.active)?.id
    || project.loadCases[0]?.id
    || '—';
  const extremeProvenance = (x: number, side?: 'left' | 'right' | 'continuous'): ResultRef => ({
    quantity: type === 'axial' ? 'N' : type === 'shear' ? 'V' : 'M',
    entity: { kind: 'member', id: memberId },
    caseOrCombinationId,
    signConvention: t(type === 'axial' ? 'results.signAxial' : type === 'shear' ? 'results.signShear' : 'results.signMoment'),
    position: { x, side },
  });
  const snapCandidates = Array.from(new Set([
    0,
    L,
    ...memberResult.diagramSegments.flatMap((segment) => [segment.x0, segment.x1]),
    ...memberResult.diagramJumps.map((jump) => jump.x),
    ...displayCritical.map((point) => point.x),
  ])).sort((a, b) => a - b);
  const snapCursor = (raw: number) => {
    const nearest = snapCandidates.reduce((best, candidate) => Math.abs(candidate - raw) < Math.abs(best - raw) ? candidate : best, snapCandidates[0] ?? raw);
    return Math.abs(nearest - raw) <= Math.max(L * 0.012, 1e-8) ? nearest : raw;
  };
  const cursorX = pinnedX ?? hoverX;
  const cursorLeft = cursorX === null ? null : evaluateDiagramAt(memberResult.diagramSegments, memberResult.diagramJumps, cursorX, 'left');
  const cursorRight = cursorX === null ? null : evaluateDiagramAt(memberResult.diagramSegments, memberResult.diagramJumps, cursorX, 'right');
  const cursorPoint = cursorRight ?? cursorLeft;
  const cursorJump = cursorX === null ? null : memberResult.diagramJumps.find((jump) => Math.abs(jump.x - cursorX) <= Math.max(L, 1) * 1e-8);
  // evaluateEnvelopeAt takes an explicit side because at a discontinuity the two
  // lateral limits are different numbers; both are computed so a jump can be
  // shown instead of silently picking the right-hand value.
  const envelopeCursorLeft = envelopeMode && envelope && cursorX !== null ? evaluateEnvelopeAt(envelope, cursorX, 'left') : null;
  const envelopeCursorRight = envelopeMode && envelope && cursorX !== null ? evaluateEnvelopeAt(envelope, cursorX, 'right') : null;
  const envelopeCursor = envelopeCursorRight ?? envelopeCursorLeft;
  const envelopeJumpTolerance = 1e-9 * maxAbs;
  const envelopeCursorJump = Boolean(envelopeCursorLeft && envelopeCursorRight && (
    Math.abs(envelopeCursorLeft.minimum - envelopeCursorRight.minimum) > envelopeJumpTolerance
    || Math.abs(envelopeCursorLeft.maximum - envelopeCursorRight.maximum) > envelopeJumpTolerance
  ));
  const xTicks = [0, .25, .5, .75, 1].map((ratio) => ratio * L);
  const memberOptions = analysis?.memberResults ?? [];
  const pointerX = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return snapCursor(Math.max(0, Math.min(L, ((event.clientX - rect.left) / rect.width) * L)));
  };
  const pinAt = (x: number) => setResultCursor(pinnedX !== null && Math.abs(pinnedX - x) <= Math.max(L, 1) * 1e-8 ? null : { memberId, x, pinned: true });
  const movePinnedByKeyboard = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const current = pinnedX ?? 0;
    const step = event.shiftKey ? L / 20 : L / 100;
    if (event.key === 'Escape' && pinnedX !== null) {
      event.preventDefault();
      event.stopPropagation();
      setResultCursor(null);
      return;
    }
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = current - step;
    else if (event.key === 'ArrowRight') next = current + step;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = L;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    setResultCursor({ memberId, x: Math.max(0, Math.min(L, next)), pinned: true });
  };
  return <div className="diagram-result-layout">
    {/* Máximo y mínimo del diagrama son extremos y van en tarjeta: mismo
        componente, misma materia y los mismos datos que en el resumen. La
        lectura del cursor no es un extremo — sigue siendo lectura, y vive
        junto al gráfico. */}
    <div className="result-extreme-grid diagram-focus-cards">
      <ResultExtremeCard
        label={`${label} · ${t('results.maximum')}`}
        value={formatFixed(displayValue(max), 3)}
        unit={unit}
        position={maxPoint ? `${memberId} · x ${formatFixed(toDisplay(maxPoint.x, units, 'length'), 2)} ${lengthUnit}` : memberId}
        reliability={reliability}
        accent={colorClass}
        analysis={analysis ?? undefined}
        provenanceRef={maxPoint ? extremeProvenance(maxPoint.x, maxPoint.side) : undefined}
      />
      <ResultExtremeCard
        label={`${label} · ${t('results.minimum')}`}
        value={formatFixed(displayValue(min), 3)}
        unit={unit}
        position={minPoint ? `${memberId} · x ${formatFixed(toDisplay(minPoint.x, units, 'length'), 2)} ${lengthUnit}` : memberId}
        reliability={reliability}
        accent={colorClass}
        analysis={analysis ?? undefined}
        provenanceRef={minPoint ? extremeProvenance(minPoint.x, minPoint.side) : undefined}
      />
      {cursorPoint ? <div className="diagram-cursor-readout diagram-cursor-metric"><span>{t('results.cursorValue')}</span><strong>{formatFixed(displayValue(cursorPoint[type]), 3)} {unit}</strong><small>x {formatFixed(toDisplay(cursorPoint.x, units, 'length'), 2)} {lengthUnit}</small></div> : null}
    </div>
    <div className="diagram-guidance"><div className={`step-badge ${colorClass}`}>1</div><div><strong>{label}</strong><p>{t('results.exactCurves')}</p></div><div className="step-badge muted">2</div><div><strong>{t('results.mainValues')}</strong><p>{t('results.maximum')} {formatFixed(displayValue(max), 3)} {unit}<br />{t('results.minimum')} {formatFixed(displayValue(min), 3)} {unit}</p></div><div className="step-badge muted">3</div><div><strong>{t('results.verification')}</strong><p>{t('results.derivativeCheck')}</p></div></div>
    <div className={`diagram-chart ${colorClass}`} data-testid="diagram-chart"><div className="diagram-chart-heading"><label><span>{t('results.member')}</span><select aria-label={t('results.memberForDiagram')} value={memberId} onChange={(event) => { setSelection({ kind: 'member', id: event.target.value }); setResultCursor(null); }}>{memberOptions.map((member) => <option key={member.memberId} value={member.memberId}>{member.memberId}</option>)}</select></label><strong>{label}</strong><button className="envelope-toggle" aria-pressed={envelopeMode} disabled={envelopeBusy} title={t('results.compareAllCases')} onClick={() => { if (!envelopeScenarios) runEnvelopeAnalysis(); setEnvelopeMode((current) => !current); }}>{envelopeBusy ? '…' : 'Env.'}</button><small>{envelopeMode ? t('results.scenarioCount', { count: envelope?.includedScenarioIds.length ?? 0 }) : pinnedX === null ? t('results.pointerHint') : t('results.pinnedHint')}</small></div><span id={cursorHelpId} className="sr-only">{t('results.chartKeyboardHelp')}</span><svg tabIndex={0} role="img" aria-label={diagramAriaLabel} aria-describedby={cursorHelpId} aria-keyshortcuts="ArrowLeft ArrowRight Home End Escape" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onKeyDown={movePinnedByKeyboard} onPointerMove={(event) => setHoverX(pointerX(event))} onPointerDown={(event) => pinAt(pointerX(event))} onPointerLeave={() => setHoverX(null)}>
      <title>{diagramAriaLabel}</title><desc>{t('results.chartKeyboardHelp')}</desc>
      <line className="chart-axis" x1="0" y1={baseline} x2={width} y2={baseline} />
      {xTicks.map((x) => <g className="chart-tick" key={`tick-${x}`}><line x1={sx(x)} y1={baseline - 4} x2={sx(x)} y2={baseline + 4} /><text x={sx(x)} y={height - 6} textAnchor={x === 0 ? 'start' : x === L ? 'end' : 'middle'}>{formatFixed(toDisplay(x, units, 'length'), 2)}</text></g>)}
      {memberResult.diagramSegments.slice(1).map((segment) => <line key={segment.x0} className="chart-break" x1={sx(segment.x0)} y1="20" x2={sx(segment.x0)} y2={height - 20} />)}
      {memberResult.diagramJumps.map((jump) => {
        const left = evaluateDiagramAt(memberResult.diagramSegments, memberResult.diagramJumps, jump.x, 'left');
        const right = evaluateDiagramAt(memberResult.diagramSegments, memberResult.diagramJumps, jump.x, 'right');
        return left && right ? <line key={`jump-${jump.x}`} className="chart-jump" x1={sx(jump.x)} y1={sy(left[type])} x2={sx(jump.x)} y2={sy(right[type])} /> : null;
      })}
      <path className={`chart-fill ${envelopeMode ? 'muted' : ''}`} d={fillCommands.join(' ')} />
      <path className={`chart-line ${envelopeMode ? 'muted' : ''}`} d={lineCommands.join(' ')} fill="none" />
      {envelopeMode && envelope ? <><path className="envelope-line minimum" d={envelopePath('minimum')} fill="none" /><path className="envelope-line maximum" d={envelopePath('maximum')} fill="none" /></> : null}
      {displayCritical.map((point, index) => <g className={`chart-critical ${point.kind}`} key={`${point.kind}-${point.side}-${point.x}-${index}`}><circle cx={sx(point.x)} cy={sy(point.value)} r={point.kind === 'zero' ? 4 : 3.2} /><text x={sx(point.x)} y={sy(point.value) + (point.value >= 0 ? -8 : 14)} textAnchor={point.x < L * .08 ? 'start' : point.x > L * .92 ? 'end' : 'middle'}>{point.kind === 'zero' ? '0' : formatFixed(displayValue(point.value), 2)}</text></g>)}
      {cursorPoint ? <g className={`chart-hover ${pinnedX === null ? '' : 'pinned'}`}><line x1={sx(cursorPoint.x)} y1="16" x2={sx(cursorPoint.x)} y2={height - 18} /><circle cx={sx(cursorPoint.x)} cy={sy(cursorPoint[type])} r="4" /></g> : null}
    </svg>{cursorPoint ? <div className={`diagram-cursor-readout ${cursorJump || envelopeCursorJump ? 'at-jump' : ''}`} role={pinnedX !== null ? 'status' : undefined} aria-live={pinnedX !== null ? 'polite' : undefined} aria-atomic={pinnedX !== null ? true : undefined}><span className="cursor-position"><b>x</b>{formatFixed(toDisplay(cursorPoint.x, units, 'length'), 3)} {unitLabel(units, 'length')}</span>{envelopeCursor ? <><span className="envelope-min"><b>{t('results.minimum')}</b>{formatFixed(displayValue(envelopeCursor.minimum), 3)} {unit}</span><span className="envelope-max"><b>{t('results.maximum')}</b>{formatFixed(displayValue(envelopeCursor.maximum), 3)} {unit}</span><small>{envelopeCursor.minimumScenario} → {envelopeCursor.maximumScenario}</small>{envelopeCursorJump && envelopeCursorLeft && envelopeCursorRight ? <><small>{t('results.envelopeDiscontinuityReading', { quantity: t('results.minimum'), left: formatFixed(displayValue(envelopeCursorLeft.minimum), 3), right: formatFixed(displayValue(envelopeCursorRight.minimum), 3), unit })}</small><small>{t('results.envelopeDiscontinuityReading', { quantity: t('results.maximum'), left: formatFixed(displayValue(envelopeCursorLeft.maximum), 3), right: formatFixed(displayValue(envelopeCursorRight.maximum), 3), unit })}</small></> : null}</> : <><span className="axial-text"><b>N</b>{formatFixed(toDisplay(cursorPoint.axial, units, 'force'), 3)} {unitLabel(units, 'force')}</span><span className="shear-text"><b>V</b>{formatFixed(toDisplay(cursorPoint.shear, units, 'force'), 3)} {unitLabel(units, 'force')}</span><span className="moment-text"><b>M</b>{formatFixed(toDisplay(cursorPoint.moment, units, 'moment'), 3)} {unitLabel(units, 'moment')}</span>{cursorJump && cursorLeft && cursorRight ? <small>{t('results.discontinuityReading', { left: formatFixed(displayValue(cursorLeft[type]), 3), right: formatFixed(displayValue(cursorRight[type]), 3), unit })}</small> : null}</>}</div> : <div className="diagram-cursor-placeholder">{t('results.exactDiagramCursor')}</div>}</div>
  </div>;
};

const DeformationView = ({ memberResult, memberId }: { memberResult: MemberResult | undefined; memberId: string }) => {
  const { project, analysis, setSelection, resultCursor, setResultCursor } = useProject();
  const reliability = analysis ? resolveReliability(analysis).level : 'failed';
  const { t } = useI18n();
  const [quantity, setQuantity] = useState<'u' | 'v' | 'theta'>('v');
  const [hoverX, setHoverX] = useState<number | null>(null);
  const cursorHelpId = useId();
  if (!memberResult?.deformationSegments.length) return <div className="empty-small">{t('results.selectFrameMember')}</div>;
  const L = memberResult.length;
  const pinnedX = resultCursor?.memberId === memberId && resultCursor.pinned ? Math.max(0, Math.min(L, resultCursor.x)) : null;
  const units = project.settings.units;
  const unit = quantity === 'theta' ? 'rad' : unitLabel(units, 'length');
  const displayValue = (value: number) => quantity === 'theta' ? value : toDisplay(value, units, 'length');
  const critical = memberResult.deformationCriticalPoints.filter((point) => point.quantity === quantity);
  const candidates = critical.filter((point) => point.kind === 'maximum' || point.kind === 'minimum' || point.kind === 'end');
  const maximum = candidates.reduce((best, point) => point.value > best.value ? point : best, candidates[0]);
  const minimum = candidates.reduce((best, point) => point.value < best.value ? point : best, candidates[0]);
  const absolute = [maximum, minimum].filter(Boolean).reduce((best, point) => Math.abs(point.value) > Math.abs(best.value) ? point : best);
  const maxAbsValue = Math.max(1e-15, ...candidates.map((point) => Math.abs(point.value)), ...memberResult.deformation.map((point) => Math.abs(point[quantity])));
  const absoluteFor = (targetQuantity: 'u' | 'v' | 'theta') => {
    const points = memberResult.deformationCriticalPoints.filter((point) => point.quantity === targetQuantity && (point.kind === 'maximum' || point.kind === 'minimum' || point.kind === 'end'));
    if (!points.length) return null;
    return points.reduce((best, point) => Math.abs(point.value) > Math.abs(best.value) ? point : best, points[0]);
  };
  const displayFor = (targetQuantity: 'u' | 'v' | 'theta', value: number) => targetQuantity === 'theta' ? value : toDisplay(value, units, 'length');
  const absU = absoluteFor('u');
  const absV = absoluteFor('v');
  const absTheta = absoluteFor('theta');
  const width = 820;
  const height = 190;
  const baseline = 98;
  const amplitude = 66;
  const sx = (x: number) => x / L * width;
  const sy = (value: number) => baseline - value / maxAbsValue * amplitude;
  const line = memberResult.deformation.map((point, index) => `${index ? 'L' : 'M'} ${sx(point.x)} ${sy(point[quantity])}`).join(' ');
  const responseAriaLabel = t('results.responseForMember', { quantity, member: memberId });
  const cursorX = pinnedX ?? hoverX;
  const cursor = cursorX === null ? null : evaluateDeformationAt(memberResult.deformationSegments, cursorX);
  const memberOptions = analysis?.memberResults ?? [];
  const pointerX = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(L, (event.clientX - rect.left) / rect.width * L));
  };
  const pinAt = (x: number) => setResultCursor(pinnedX === null ? { memberId, x, pinned: true } : null);
  const movePinnedByKeyboard = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const current = pinnedX ?? 0;
    const step = event.shiftKey ? L / 20 : L / 100;
    if (event.key === 'Escape' && pinnedX !== null) {
      event.preventDefault();
      event.stopPropagation();
      setResultCursor(null);
      return;
    }
    const next = event.key === 'ArrowLeft' ? current - step : event.key === 'ArrowRight' ? current + step : event.key === 'Home' ? 0 : event.key === 'End' ? L : null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    setResultCursor({ memberId, x: Math.max(0, Math.min(L, next)), pinned: true });
  };
  return <div className="deformation-result-layout">
    {/* Los tres máximos de respuesta son extremos: misma tarjeta, misma
        materia. Sin procedencia porque el máximo interior no tiene dato
        almacenado que lo respalde — no se pierde nada que antes existiera. */}
    <div className="result-extreme-grid deformation-focus-cards">
      {([
        { id: 'u', symbol: '|u|', point: absU, unit: unitLabel(units, 'length') },
        { id: 'v', symbol: '|v|', point: absV, unit: unitLabel(units, 'length') },
        { id: 'theta', symbol: '|θ|', point: absTheta, unit: 'rad' },
      ] as const).map((entry) => <ResultExtremeCard
        key={entry.id}
        label={`${entry.symbol} ${t('results.maximum')}`}
        value={entry.point ? formatScientific(displayFor(entry.id, entry.point.value), 3) : '—'}
        unit={entry.unit}
        position={entry.point
          ? `${memberId} · ${t('results.criticalPosition')} x ${formatFixed(toDisplay(entry.point.x, units, 'length'), 2)} ${unitLabel(units, 'length')}`
          : memberId}
        reliability={reliability}
        accent="deformation"
      />)}
    </div>
    <div className="diagram-guidance deformation-guidance"><div className="step-badge deformed">1</div><div><strong>{t('results.exactMemberResponseTitle')}</strong><p>{t('results.exactMemberResponseBody')}</p></div><div className="step-badge muted">2</div><div><strong>{t('results.interiorMaximum')}</strong><p>{absolute ? t('results.responseAtPosition', { quantity, value: formatScientific(displayValue(absolute.value), 4), unit, x: formatFixed(toDisplay(absolute.x, units, 'length'), 3), lengthUnit: unitLabel(units, 'length') }) : '—'}</p></div></div>
    <div className="diagram-chart deformation" data-testid="deformation-chart"><div className="diagram-chart-heading"><label><span>{t('results.member')}</span><select aria-label={t('results.memberForDeformation')} value={memberId} onChange={(event) => { setSelection({ kind: 'member', id: event.target.value }); setResultCursor(null); }}>{memberOptions.map((member) => <option key={member.memberId} value={member.memberId}>{member.memberId}</option>)}</select></label><div className="response-selector" role="group" aria-label={t('results.memberResponse')}>{(['u', 'v', 'theta'] as const).map((item) => <button key={item} aria-pressed={quantity === item} className={quantity === item ? 'active' : ''} onClick={() => setQuantity(item)}>{item === 'theta' ? 'θ' : item}</button>)}</div><small>{pinnedX === null ? t('results.pointerHint') : t('results.pinnedHint')}</small></div>
      <span id={cursorHelpId} className="sr-only">{t('results.chartKeyboardHelp')}</span>
      <svg tabIndex={0} role="img" aria-label={responseAriaLabel} aria-describedby={cursorHelpId} aria-keyshortcuts="ArrowLeft ArrowRight Home End Escape" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onKeyDown={movePinnedByKeyboard} onPointerMove={(event) => setHoverX(pointerX(event))} onPointerDown={(event) => pinAt(pointerX(event))} onPointerLeave={() => setHoverX(null)}>
        <title>{responseAriaLabel}</title><desc>{t('results.chartKeyboardHelp')}</desc>
        <line className="chart-axis" x1="0" y1={baseline} x2={width} y2={baseline} />
        <path className="chart-line" d={line} fill="none" />
        {critical.filter((point) => point.kind === 'maximum' || point.kind === 'minimum' || point.kind === 'zero').slice(0, 16).map((point, index) => <g className={`chart-critical ${point.kind}`} key={`${point.kind}-${point.x}-${index}`}><circle cx={sx(point.x)} cy={sy(point.value)} r="3.2" /><text x={sx(point.x)} y={sy(point.value) + (point.value >= 0 ? -8 : 14)} textAnchor={point.x < L * .08 ? 'start' : point.x > L * .92 ? 'end' : 'middle'}>{point.kind === 'zero' ? '0' : formatScientific(displayValue(point.value), 2)}</text></g>)}
        {cursor ? <g className={`chart-hover ${pinnedX === null ? '' : 'pinned'}`}><line x1={sx(cursor.x)} y1="16" x2={sx(cursor.x)} y2={height - 18} /><circle cx={sx(cursor.x)} cy={sy(cursor[quantity])} r="4" /></g> : null}
      </svg>
      {cursor ? <div className="diagram-cursor-readout" role={pinnedX !== null ? 'status' : undefined} aria-live={pinnedX !== null ? 'polite' : undefined} aria-atomic={pinnedX !== null ? true : undefined}><span className="cursor-position"><b>x</b>{formatFixed(toDisplay(cursor.x, units, 'length'), 3)} {unitLabel(units, 'length')}</span><span><b>u</b>{formatScientific(toDisplay(cursor.u, units, 'length'), 4)} {unitLabel(units, 'length')}</span><span><b>v</b>{formatScientific(toDisplay(cursor.v, units, 'length'), 4)} {unitLabel(units, 'length')}</span><span><b>θ</b>{formatScientific(cursor.theta, 4)} rad</span></div> : <div className="diagram-cursor-placeholder">{t('results.exactDeformationCursor')}</div>}
    </div>
  </div>;
};
