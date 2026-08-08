import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp, CircleDotDashed, GripHorizontal, LoaderCircle } from 'lucide-react';
import { useProject, type ResultTab } from '../../store/ProjectContext';
import { evaluateDeformationAt, evaluateDiagramAt, segmentBezierControls } from '../../engine/diagram';
import { evaluateEducationalAssertions, type EducationalAssertionEvaluation } from '../../engine/educationalAssertions';
import { buildDiagramEnvelope, evaluateEnvelopeAt } from '../../engine/envelope';
import { analysisSignature } from '../../engine/projectSignature';
import { resolveReliability } from '../../engine/reliability';
import { useScenarioAnalysis } from '../../engine/useScenarioAnalysis';
import type { DiagramQuantity, DiagramSegment, EducationalAssertionTarget, MatrixTrace, MemberModel, MemberResult, ProjectModel } from '../../types';
import { toDisplay, unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { ResultSummary } from './ResultSummary';
import { useClassroomSession } from '../../store/ClassroomSessionContext';
import { deriveClassroomProgress, type ClassroomProgressStepId } from '../../education/classroomProgress';
import { formatResultNumber } from './resultFormatting';
import { buildStiffnessSubstitution } from './stiffnessSubstitution';
import { formatFixed, formatScientific, formatSignificant } from '../../utils/numberFormat';
import { ClassroomPredictionForm } from '../classroom/ClassroomPredictionForm';
import { emitWorkspaceCommand, onWorkspaceCommand } from '../workspace/workspaceCommands';

const loadInfluenceLineView = () => import('./InfluenceLineView')
  .then((module) => ({ default: module.InfluenceLineView }));
const LazyInfluenceLineView = lazy(loadInfluenceLineView);

const tabs: Array<{ id: ResultTab; labelKey: TranslationKey; color?: string }> = [
  { id: 'summary', labelKey: 'results.summary' },
  { id: 'reactions', labelKey: 'results.reactions' },
  { id: 'axial', labelKey: 'results.axial', color: 'axial' },
  { id: 'shear', labelKey: 'results.shear', color: 'shear' },
  { id: 'moment', labelKey: 'results.moment', color: 'moment' },
  { id: 'influence', labelKey: 'results.influence', color: 'influence' },
  { id: 'deformed', labelKey: 'results.deformed' },
  { id: 'learn', labelKey: 'results.learn' },
  { id: 'issues', labelKey: 'results.issues' },
];

type ResultsPanelMode = 'compact' | 'expanded' | 'focused';

const RESULTS_MODE_STORAGE_KEY = 'structureCo.results.mode.v1';
const resultFamilies: Array<{ id: string; labelKey: TranslationKey; tabs: ResultTab[] }> = [
  { id: 'state', labelKey: 'results.familyState', tabs: ['summary', 'reactions'] },
  { id: 'forces', labelKey: 'results.familyForces', tabs: ['axial', 'shear', 'moment'] },
  { id: 'shape', labelKey: 'results.familyShape', tabs: ['deformed'] },
  { id: 'advanced', labelKey: 'results.familyAdvanced', tabs: ['influence'] },
  { id: 'understand', labelKey: 'results.familyUnderstand', tabs: ['learn'] },
  { id: 'warnings', labelKey: 'results.familyWarnings', tabs: ['issues'] },
];

const classroomProgressCopy: Record<ClassroomProgressStepId, { title: TranslationKey; description: TranslationKey; action: TranslationKey }> = {
  geometry: { title: 'classroom.buildTitle', description: 'classroom.buildBody', action: 'classroom.buildAction' },
  supports: { title: 'classroom.defineTitle', description: 'classroom.defineBody', action: 'classroom.defineAction' },
  loads: { title: 'classroom.defineTitle', description: 'classroom.defineBody', action: 'classroom.defineAction' },
  analysis: { title: 'classroom.analyzeTitle', description: 'classroom.analyzeBody', action: 'classroom.analyzeAction' },
};

const resultsFocusableSelector = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getResultsFocusable = (panel: HTMLElement | null) => [
  ...(panel?.querySelectorAll<HTMLElement>(resultsFocusableSelector) ?? []),
].filter((element) => {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const closedDetails = element.closest('details:not([open])');
  return !closedDetails || element.tagName === 'SUMMARY';
});

const readResultsMode = (): ResultsPanelMode => {
  if (typeof window === 'undefined') return 'expanded';
  const stored = window.localStorage.getItem(RESULTS_MODE_STORAGE_KEY);
  return stored === 'compact' || stored === 'focused' || stored === 'expanded' ? stored : 'expanded';
};

const MOBILE_RESULTS_QUERY = '(max-width: 1023px)';
const PHONE_RESULTS_QUERY = '(max-width: 700px)';
const isMobileResultsViewport = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(MOBILE_RESULTS_QUERY).matches);
const isPhoneResultsViewport = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(PHONE_RESULTS_QUERY).matches);

// WorkspaceShell already tracks window.visualViewport (keyboard-aware, unlike
// window.innerHeight) and publishes it as --sc-visual-viewport-height on the
// shell element. Reading that here keeps the resizable panel's bounds correct
// when the on-screen keyboard opens, without a second resize listener.
const getViewportHeightPx = (referenceElement: HTMLElement | null): number => {
  if (typeof window === 'undefined') return 0;
  if (referenceElement) {
    const raw = window.getComputedStyle(referenceElement).getPropertyValue('--sc-visual-viewport-height');
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return window.innerHeight;
};

export const ResultsPanel = () => {
  const { project, analysis, resultTab, setResultTab, analyze, selection, isAnalyzing, setInfluenceCanvasState } = useProject();
  const { t } = useI18n();
  const [height, setHeight] = useState(() => isMobileResultsViewport() ? Math.min(330, window.innerHeight * 0.4) : 285);
  const [drag, setDrag] = useState<{ y: number; height: number } | null>(null);
  const [isMobile, setIsMobile] = useState(isMobileResultsViewport);
  const [isPhone, setIsPhone] = useState(isPhoneResultsViewport);
  const [mobileExpanded, setMobileExpanded] = useState(() => !isMobileResultsViewport());
  const [panelMode, setPanelMode] = useState<ResultsPanelMode>(readResultsMode);
  const previousAnalysisRef = useRef(analysis);
  const resizeFrameRef = useRef<number | null>(null);
  const mobileFitFrameRef = useRef<number | null>(null);
  const mobileFitTimerRef = useRef<number | null>(null);
  const mobileFitTransitionCleanupRef = useRef<(() => void) | null>(null);
  const pendingHeightRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const focusedLauncherRef = useRef<HTMLButtonElement | null>(null);
  const previousPanelModeRef = useRef<ResultsPanelMode>('expanded');
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileReturnFocusRef = useRef<HTMLElement | null>(null);
  const phoneCanvasInteractive = isPhone && mobileExpanded;
  const mobileResultsModal = isMobile && mobileExpanded && !isPhone;
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
  const classroomMode = project.settings.calculationMode === 'classroom';
  const classroomSession = useClassroomSession();
  const { resultsVisible, hideResults } = classroomSession;
  const classroomProgress = classroomMode ? deriveClassroomProgress(project, analysis) : null;
  const classroomPredictionRequired = Boolean(classroomMode
    && classroomProgress?.readyToAnalyze
    && (!analysis || (!analysis.success && (!classroomSession.hasPredictions || classroomSession.revealState === 'predicting'))));
  const resultsAllowed = !classroomMode || resultsVisible;
  const availableTabs = classroomMode ? tabs.filter((tab) => tab.id !== 'deformed') : tabs;
  const activeTab = availableTabs.find((tab) => tab.id === resultTab) ?? availableTabs[0];
  const visibleFamilies = resultFamilies.map((family) => ({
    ...family,
    tabs: family.tabs.map((id) => availableTabs.find((tab) => tab.id === id)).filter((tab): tab is (typeof tabs)[number] => Boolean(tab)),
  })).filter((family) => family.tabs.length > 0);
  // success only means no error-severity issue was raised; it says nothing about
  // whether the numbers can be trusted. reliability.level is the answer to that.
  const reliability = analysis ? resolveReliability(analysis) : null;
  const analysisState = isAnalyzing
    ? t('results.stateAnalyzing')
    : !analysis
      ? t('results.stateReady')
      : analysis.success
        ? reliability?.level === 'limited'
          ? t('results.stateResolvedLimited')
          : reliability?.level === 'unreliable'
            ? t('results.stateResolvedUnreliable')
            : t('results.stateResolved')
        : t('results.stateReview');
  const mobileResultLabel = analysis
    ? `${t(activeTab.labelKey)} · ${resultContext.label}`
    : t('results.outputs');
  const rememberMobileLauncher = useCallback((candidate: EventTarget | null) => {
    mobileReturnFocusRef.current = candidate instanceof HTMLElement
      && candidate !== document.body
      && candidate !== document.documentElement
      ? candidate
      : mobileToggleRef.current;
  }, []);
  const cancelScheduledPhoneFit = useCallback(() => {
    if (mobileFitFrameRef.current !== null) {
      window.cancelAnimationFrame(mobileFitFrameRef.current);
      mobileFitFrameRef.current = null;
    }
    if (mobileFitTimerRef.current !== null) {
      window.clearTimeout(mobileFitTimerRef.current);
      mobileFitTimerRef.current = null;
    }
    mobileFitTransitionCleanupRef.current?.();
    mobileFitTransitionCleanupRef.current = null;
    panelRef.current?.removeAttribute('data-canvas-fit-settled');
  }, []);
  const closeMobileResults = useCallback(() => {
    cancelScheduledPhoneFit();
    setMobileExpanded(false);
    window.requestAnimationFrame(() => {
      const remembered = mobileReturnFocusRef.current;
      const rememberedUnavailable = !remembered?.isConnected
        || Boolean(remembered.closest('.inspector-panel:not(.mobile-open), [inert], [aria-hidden="true"]'));
      const returnTarget = rememberedUnavailable ? mobileToggleRef.current : remembered;
      returnTarget?.focus({ preventScroll: true });
    });
  }, [cancelScheduledPhoneFit]);
  const schedulePhoneCanvasFit = useCallback(() => {
    cancelScheduledPhoneFit();
    mobileFitFrameRef.current = window.requestAnimationFrame(() => {
      mobileFitFrameRef.current = null;
      const panel = panelRef.current;
      if (!panel) return;

      let completed = false;
      const cleanupTransition = () => {
        panel.removeEventListener('transitionend', onTransitionEnd);
        if (mobileFitTimerRef.current !== null) {
          window.clearTimeout(mobileFitTimerRef.current);
          mobileFitTimerRef.current = null;
        }
        if (mobileFitTransitionCleanupRef.current === cleanupTransition) {
          mobileFitTransitionCleanupRef.current = null;
        }
      };
      const finish = () => {
        if (completed) return;
        completed = true;
        cleanupTransition();
        mobileFitFrameRef.current = window.requestAnimationFrame(() => {
          mobileFitFrameRef.current = window.requestAnimationFrame(() => {
            emitWorkspaceCommand('fit-canvas');
            mobileFitFrameRef.current = window.requestAnimationFrame(() => {
              mobileFitFrameRef.current = null;
              panelRef.current?.setAttribute('data-canvas-fit-settled', 'true');
            });
          });
        });
      };
      function onTransitionEnd(event: TransitionEvent) {
        if (event.target === panel && ['height', 'min-height', 'max-height'].includes(event.propertyName)) finish();
      }

      const parseTime = (value: string) => {
        const normalized = value.trim();
        if (normalized.endsWith('ms')) return Number.parseFloat(normalized);
        if (normalized.endsWith('s')) return Number.parseFloat(normalized) * 1_000;
        return 0;
      };
      const style = window.getComputedStyle(panel);
      const durations = style.transitionDuration.split(',').map(parseTime);
      const delays = style.transitionDelay.split(',').map(parseTime);
      const transitionTime = durations.reduce((maximum, duration, index) => (
        Math.max(maximum, duration + (delays[index % Math.max(delays.length, 1)] ?? 0))
      ), 0);

      if (transitionTime <= 0) {
        finish();
        return;
      }

      panel.addEventListener('transitionend', onTransitionEnd);
      mobileFitTransitionCleanupRef.current = cleanupTransition;
      mobileFitTimerRef.current = window.setTimeout(finish, Math.max(800, transitionTime + 200));
    });
  }, [cancelScheduledPhoneFit]);
  useEffect(() => {
    if (classroomMode && resultTab === 'deformed') setResultTab('moment');
  }, [classroomMode, resultTab, setResultTab]);
  useEffect(() => {
    if (!classroomMode || !analysis?.success) return;
    const targetId = resultsVisible ? 'classroom-result-summary' : 'classroom-result-gate-title';
    const focusFrame = window.requestAnimationFrame(() => document.getElementById(targetId)?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(focusFrame);
  }, [analysis, classroomMode, resultsVisible]);
  useEffect(() => {
    const query = window.matchMedia?.(MOBILE_RESULTS_QUERY);
    if (!query) return undefined;
    const update = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (event.matches) {
        setHeight(Math.min(330, getViewportHeightPx(panelRef.current) * 0.4));
        setMobileExpanded(false);
      } else setMobileExpanded(true);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const query = window.matchMedia?.(PHONE_RESULTS_QUERY);
    if (!query) return undefined;
    const update = (event: MediaQueryListEvent) => setIsPhone(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (isMobile && analysis && analysis !== previousAnalysisRef.current) {
      rememberMobileLauncher(document.activeElement);
      setMobileExpanded(true);
      if (isPhone) schedulePhoneCanvasFit();
    }
    previousAnalysisRef.current = analysis;
  }, [analysis, isMobile, isPhone, rememberMobileLauncher, schedulePhoneCanvasFit]);
  useEffect(() => {
    const collapse = () => closeMobileResults();
    const expand = () => {
      rememberMobileLauncher(document.activeElement);
      setMobileExpanded(true);
      window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    };
    const unsubscribes = [
      onWorkspaceCommand('collapse-mobile-results', collapse),
      onWorkspaceCommand('expand-mobile-results', expand),
    ];
    return () => { for (const unsubscribe of unsubscribes) unsubscribe(); };
  }, [closeMobileResults, rememberMobileLauncher]);
  useEffect(() => () => {
    if (resizeFrameRef.current !== null) window.cancelAnimationFrame(resizeFrameRef.current);
    cancelScheduledPhoneFit();
  }, [cancelScheduledPhoneFit]);
  useEffect(() => {
    window.localStorage.setItem(RESULTS_MODE_STORAGE_KEY, panelMode);
    if (isMobile) return;
    if (panelMode === 'compact') setHeight(190);
    else if (panelMode === 'expanded') setHeight((current) => Math.max(current, 320));
    else setHeight(getViewportHeightPx(panelRef.current) * 0.72);
  }, [isMobile, panelMode]);
  useEffect(() => {
    if (isMobile && panelMode === 'focused') setPanelMode('expanded');
  }, [isMobile, panelMode]);
  useEffect(() => {
    if (!mobileResultsModal) return undefined;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    const inactive = document.querySelectorAll<HTMLElement>('.app-shell-skip-link, .topbar, .toolbar, .inspector-panel, .mobile-inspector-toggle, .canvas-host, .classroom-workspace-journey');
    inactive.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      if (!panel?.contains(document.activeElement)) mobileToggleRef.current?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileResults();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getResultsFocusable(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      inactive.forEach((element) => {
        element.inert = false;
        element.removeAttribute('aria-hidden');
      });
    };
  }, [closeMobileResults, mobileResultsModal]);
  useEffect(() => {
    if (!phoneCanvasInteractive) return undefined;
    const onPhoneEscape = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      const visibleModalAbove = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
        .some((element) => {
          if (element === panelRef.current || panelRef.current?.contains(element)) return false;
          const style = window.getComputedStyle(element);
          return !element.hidden
            && element.inert !== true
            && element.getAttribute('aria-hidden') !== 'true'
            && style.display !== 'none'
            && style.visibility !== 'hidden';
        });
      if (visibleModalAbove) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMobileResults();
    };
    document.addEventListener('keydown', onPhoneEscape, true);
    return () => document.removeEventListener('keydown', onPhoneEscape, true);
  }, [closeMobileResults, phoneCanvasInteractive]);

  const scheduleHeight = (next: number) => {
    pendingHeightRef.current = next;
    if (resizeFrameRef.current !== null) return;
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      if (pendingHeightRef.current !== null) setHeight(pendingHeightRef.current);
    });
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag) return;
    scheduleHeight(Math.max(150, Math.min(getViewportHeightPx(panelRef.current) * 0.72, drag.height + drag.y - event.clientY)));
  };
  const resizeBy = (delta: number) => setHeight((current) => Math.max(150, Math.min(getViewportHeightPx(panelRef.current) * 0.72, current + delta)));
  const choosePanelMode = (next: ResultsPanelMode, launcher: HTMLButtonElement) => {
    if (next === 'focused' && panelMode !== 'focused') {
      previousPanelModeRef.current = panelMode;
      focusedLauncherRef.current = launcher;
      setPanelMode('focused');
      window.requestAnimationFrame(() => panelRef.current?.focus());
      return;
    }
    setPanelMode(next);
  };
  const leaveFocusedMode = () => {
    if (panelMode !== 'focused') return;
    setPanelMode(previousPanelModeRef.current === 'focused' ? 'expanded' : previousPanelModeRef.current);
    window.requestAnimationFrame(() => focusedLauncherRef.current?.focus());
  };

  return <>
    {mobileResultsModal ? <button className="results-sheet-backdrop" type="button" aria-hidden="true" tabIndex={-1} onClick={closeMobileResults} /> : null}
    <section
      ref={panelRef}
      className={`results-panel results-mode-${panelMode}${isMobile && !mobileExpanded ? ' mobile-collapsed' : ''}`}
      aria-label={t('results.panel')}
      role={mobileResultsModal ? 'dialog' : undefined}
      aria-modal={mobileResultsModal ? true : undefined}
      data-results-mode={panelMode}
      data-canvas-interactive={phoneCanvasInteractive ? 'true' : undefined}
      tabIndex={-1}
      style={{ height: isMobile && !mobileExpanded ? 54 : height }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && panelMode === 'focused') {
          event.preventDefault();
          leaveFocusedMode();
        }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <button ref={mobileToggleRef} className="results-mobile-toggle" type="button" aria-expanded={mobileExpanded} aria-controls="results-content" onClick={(event) => {
        if (mobileExpanded) closeMobileResults();
        else {
          rememberMobileLauncher(event.currentTarget);
          setMobileExpanded(true);
        }
      }}>
        <i className={activeTab.color ?? ''} aria-hidden="true" />
        <strong>{mobileResultLabel}</strong>
        <ChevronUp className={`results-toggle-chevron${mobileExpanded ? ' expanded' : ''}`} size={19} />
      </button>
      <button
        className="resize-handle"
        role="separator"
        aria-label={t('results.resize')}
        aria-orientation="horizontal"
        aria-valuemin={150}
        aria-valuemax={Math.round(getViewportHeightPx(panelRef.current) * 0.72)}
        aria-valuenow={Math.round(height)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') { event.preventDefault(); resizeBy(event.shiftKey ? 48 : 16); }
          if (event.key === 'ArrowDown') { event.preventDefault(); resizeBy(event.shiftKey ? -48 : -16); }
          if (event.key === 'Home') { event.preventDefault(); setHeight(150); }
          if (event.key === 'End') { event.preventDefault(); setHeight(getViewportHeightPx(panelRef.current) * 0.72); }
        }}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setPanelMode('expanded'); setDrag({ y: event.clientY, height }); }}
      ><GripHorizontal size={22} /></button>
      <header className="results-commandbar">
        <div className="results-commandbar__context">
          <span>{t('results.center')}</span>
          <strong>{resultContext.label}</strong>
          <small role="status" aria-live="polite" aria-atomic="true" title={reliability?.governing?.message} className={analysis?.success ? (reliability && reliability.level !== 'reliable' ? 'is-warning' : 'is-resolved') : analysis && !analysis.success ? 'is-warning' : ''}>{analysisState}</small>
        </div>
        <div className="results-mode-control" role="group" aria-label={t('results.modeGroup')}>
          {(['compact', 'expanded', 'focused'] as const).map((mode) => <button
            key={mode}
            type="button"
            aria-pressed={panelMode === mode}
            onClick={(event) => panelMode === 'focused' && mode === 'focused' ? leaveFocusedMode() : choosePanelMode(mode, event.currentTarget)}
          >{mode === 'compact' ? t('results.modeCompact') : mode === 'expanded' ? t('results.modeExpanded') : panelMode === 'focused' ? t('results.modeExitFocus') : t('results.modeFocus')}</button>)}
        </div>
      </header>
      <nav className="result-tabs" role="tablist" aria-label={t('results.panel')}>
        {visibleFamilies.map((family) => <div className="result-tab-family" role="presentation" key={family.id}>
          <span id={`result-family-${family.id}`} className="result-tab-family__label">{t(family.labelKey)}</span>
          <div role="presentation">{family.tabs.map((tab) => {
            const index = availableTabs.findIndex((item) => item.id === tab.id);
            return <button id={`result-tab-${tab.id}`} key={tab.id} data-result-tab={tab.id} role="tab" aria-selected={resultTab === tab.id} aria-describedby={`result-family-${family.id}`} aria-controls="results-content" tabIndex={resultTab === tab.id ? 0 : -1} className={`${resultTab === tab.id ? 'active' : ''} ${tab.color ?? ''}`} onFocus={() => { if (tab.id === 'influence') void loadInfluenceLineView(); }} onPointerEnter={() => { if (tab.id === 'influence') void loadInfluenceLineView(); }} onClick={() => setResultTab(tab.id)} onKeyDown={(event) => {
              let nextIndex = index;
              if (event.key === 'ArrowLeft') nextIndex = (index - 1 + availableTabs.length) % availableTabs.length;
              else if (event.key === 'ArrowRight') nextIndex = (index + 1) % availableTabs.length;
              else if (event.key === 'Home') nextIndex = 0;
              else if (event.key === 'End') nextIndex = availableTabs.length - 1;
              else return;
              event.preventDefault();
              const next = availableTabs[nextIndex];
              setResultTab(next.id);
              window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-result-tab="${next.id}"]`)?.focus());
            }}>{t(tab.labelKey)}{tab.id === 'issues' && analysis?.issues.length ? <span className="issue-count">{analysis.issues.length}</span> : null}</button>;
          })}</div>
        </div>)}
      </nav>
      <div id="results-content" className="results-body" role="tabpanel" aria-labelledby={`result-tab-${activeTab.id}`} aria-busy={isAnalyzing}>
        {analysis?.success && classroomMode && resultsVisible ? <button className="hide-classroom-results" onClick={hideResults}>{t('classroom.hideResults')}</button> : null}
        {classroomPredictionRequired ? <ClassroomPredictionForm project={project} preferredMemberId={selectedMemberId} onContinue={() => { classroomSession.markAnalysisRequested(); analyze(); }} /> : null}
        {!analysis && (!classroomMode || !classroomProgress?.readyToAnalyze) ? <EmptyResults onAnalyze={analyze} /> : null}
        {analysis && !analysis.success && !classroomPredictionRequired && resultTab !== 'issues' ? <FailedResults onOpenIssues={() => setResultTab('issues')} /> : null}
        {analysis?.success && !resultsAllowed ? <ClassroomResultGate project={project} memberId={selectedMemberId ?? memberResult?.memberId ?? ''} onAnalyze={analyze} /> : null}
        {analysis?.success && resultsAllowed && resultTab === 'reactions' ? <ReactionTable /> : null}
        {analysis?.success && resultsAllowed && resultTab === 'summary' ? <ResultSummary /> : null}
        {analysis?.success && resultsAllowed && ['axial', 'shear', 'moment'].includes(resultTab) ? <DiagramView type={resultTab as 'axial' | 'shear' | 'moment'} memberResult={memberResult} memberId={selectedMemberId ?? ''} /> : null}
        {analysis?.success && resultsAllowed && resultTab === 'influence' ? <Suspense fallback={<div className="results-view-loading" role="status" aria-label={t('results.loadingInfluence')}><LoaderCircle className="spin" size={20} aria-hidden="true" /><span>{t('results.loadingInfluence')}</span></div>}><LazyInfluenceLineView project={project} selection={selection ?? undefined} onCanvasStateChange={setInfluenceCanvasState} /></Suspense> : null}
        {analysis?.success && resultsAllowed && resultTab === 'deformed' ? <DeformationView memberResult={memberResult} memberId={selectedMemberId ?? ''} /> : null}
        {analysis?.success && resultsAllowed && resultTab === 'learn' ? <LearningSteps /> : null}
        {analysis && resultTab === 'issues' && !classroomPredictionRequired ? <IssuesView /> : null}
      </div>
    </section>
  </>;
};

const ClassroomResultGate = ({ project, memberId, onAnalyze }: { project: ProjectModel; memberId: string; onAnalyze: () => void }) => {
  const { t } = useI18n();
  const { hasPredictions, revealState, startPredicting, revealResults, markAnalysisRequested } = useClassroomSession();
  const { setResultTab } = useProject();
  if (!hasPredictions || revealState === 'predicting') return <ClassroomPredictionForm project={project} preferredMemberId={memberId} onContinue={() => { markAnalysisRequested(); onAnalyze(); }} />;
  return <section className="classroom-result-gate" aria-labelledby="classroom-result-gate-title" aria-live="polite">
    <div className="classroom-result-lock" aria-hidden="true">?</div>
    <div><span className="eyebrow">{t('classroom.practiceActive')}</span><h3 id="classroom-result-gate-title" tabIndex={-1}>{t('classroom.gateTitle')}</h3><p>{t('classroom.gateBody', { member: memberId || t('classroom.selectedMember') })}</p></div>
    <div className="classroom-result-gate-actions"><button className="secondary" onClick={() => { startPredicting(); window.requestAnimationFrame(() => document.getElementById('classroom-prediction-title')?.focus()); }}>{t('classroom.editPrediction')}</button><button onClick={() => { revealResults(); setResultTab('summary'); }}>{t('classroom.revealAndCompare')}</button></div>
  </section>;
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

const FailedResults = ({ onOpenIssues }: { onOpenIssues: () => void }) => { const { t } = useI18n(); return <div className="failed-results"><AlertCircle size={28} /><div><strong>{t('results.failedTitle')}</strong><p>{t('results.failedBody')}</p></div><button onClick={onOpenIssues}>{t('results.openIssues')}</button></div>; };

const ReactionTable = () => {
  const { analysis, project, selection, setSelection } = useProject();
  const { t } = useI18n();
  const units = project.settings.units;
  const lengthUnit = unitLabel(units, 'length');
  const forceUnit = unitLabel(units, 'force');
  const momentUnit = unitLabel(units, 'moment');
  const classroom = project.settings.calculationMode === 'classroom';
  return <div className="table-wrap">
    {classroom ? <div className="classroom-result-note"><strong>{t('classroom.resultNoteTitle')}</strong><span>{t('classroom.resultNoteBody')}</span></div> : null}
    <table className="results-table">
      <caption>{t('results.reactionCaption')}</caption>
      <thead><tr><th scope="col">{t('results.node')}</th>{classroom ? null : <><th scope="col">Ux ({lengthUnit})</th><th scope="col">Uy ({lengthUnit})</th><th scope="col">Rz (rad)</th></>}<th scope="col">Rx ({forceUnit})</th><th scope="col">Ry ({forceUnit})</th><th scope="col">Mz ({momentUnit})</th></tr></thead>
      <tbody>{analysis?.nodeResults.map((result) => {
        const selected = selection?.kind === 'node' && selection.id === result.nodeId;
        return <tr key={result.nodeId} aria-selected={selected || undefined}>
          <th scope="row"><button type="button" className="result-object-link" aria-pressed={selected} onClick={() => setSelection({ kind: 'node', id: result.nodeId })}>{result.nodeId}<span className="sr-only"> · {t('results.locateModel')}</span></button></th>
          {classroom ? null : <><td>{formatResultNumber(toDisplay(result.ux, units, 'length'))}</td><td>{formatResultNumber(toDisplay(result.uy, units, 'length'))}</td><td>{formatResultNumber(result.rz)}</td></>}
          <td>{formatResultNumber(toDisplay(result.rx, units, 'force'))}</td>
          <td>{formatResultNumber(toDisplay(result.ry, units, 'force'))}</td>
          <td>{formatResultNumber(toDisplay(result.rm, units, 'moment'))}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
};

const DiagramView = ({ type, memberResult, memberId }: { type: DiagramQuantity; memberResult: MemberResult | undefined; memberId: string }) => {
  const { project, analysis, setSelection, resultCursor, setResultCursor } = useProject();
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

const LearningSteps = () => {
  const { analysis, project, setLearningFocus } = useProject();
  const { t } = useI18n();
  const educationalCase = project.educationalCase;
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<'summary' | 'steps' | 'full'>('steps');
  useEffect(() => () => setLearningFocus(null), [setLearningFocus]);
  return <div className="learning-steps">
    <EducationExplorer />
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

const IssuesView = () => {
  const { analysis, project, setSelection, setActiveTool } = useProject();
  const { t } = useI18n();
  if (!analysis?.issues.length) return <div className="all-clear"><Check size={26} /><strong>{t('results.clearTitle')}</strong><p>{t('results.clearBody')}</p></div>;
  const act = (issue: typeof analysis.issues[number]) => {
    if (issue.objectId) {
      const target = issue.objectKind
        ? { kind: issue.objectKind, id: issue.objectId }
        : project.nodes.some((node) => node.id === issue.objectId)
          ? { kind: 'node' as const, id: issue.objectId }
          : project.members.some((member) => member.id === issue.objectId)
            ? { kind: 'member' as const, id: issue.objectId }
            : project.nodalLoads.some((load) => load.id === issue.objectId)
              ? { kind: 'nodalLoad' as const, id: issue.objectId }
              : project.memberLoads.some((load) => load.id === issue.objectId)
                ? { kind: 'memberLoad' as const, id: issue.objectId }
                : null;
      if (target) {
        setSelection(target);
        emitWorkspaceCommand('focus-object', target);
      }
      return;
    }
    if (issue.suggestedTool) { setActiveTool(issue.suggestedTool); return; }
    const text = `${issue.id} ${issue.title} ${issue.message}`.toLowerCase();
    if (text.includes('nodo') || text.includes('geometr')) setActiveTool('node');
    else if (text.includes('miembro') || text.includes('barra')) setActiveTool('member');
    else if (text.includes('apoyo') || text.includes('mecanismo') || text.includes('restric')) setActiveTool('support');
    else if (text.includes('carga')) setActiveTool('pointLoad');
    else setActiveTool('select');
  };
  return <div className="issues-list">{analysis.issues.map((issue) => <div className={`issue-card ${issue.severity}`} key={issue.id}><span className="issue-icon">{issue.severity === 'error' ? '!' : issue.severity === 'warning' ? '△' : 'i'}</span><div><strong>{issue.title}</strong><p>{issue.message}</p>{issue.objectId ? <small>{t('results.object', { id: issue.objectId })}</small> : null}{issue.suggestedFix ? <p className="issue-fix"><b>{t('results.fix')}</b> {issue.suggestedFix}</p> : null}<button className="issue-action" onClick={() => act(issue)}>{t(issue.objectId ? 'results.showOnCanvas' : 'results.correctInModel')}</button></div></div>)}</div>;
};
