import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import {
  Check,
  Box,
  ChevronDown,
  CloudOff,
  Copy,
  Download,
  FileArchive,
  FileText,
  FilePlus2,
  FolderOpen,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Redo2,
  Save,
  Sheet,
  Undo2,
  Wrench,
} from 'lucide-react';
import { createBlankProject, exampleProjects } from '../../data/defaultProject';
import { useI18n } from '../../i18n/useI18n';
import { usePhase2I18n } from '../../i18n/usePhase2I18n';
import { useProjectAnalysis, useProjectModel } from '../../store/ProjectContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { exportProjectJson } from '../../utils/export';
import { normalizeProject } from '../../data/migrate';
import { AnalysisStatus } from './AnalysisStatus';
import { BrandMark } from './BrandMark';
import { Button, IconButton } from '../../design-system/components/controls';
import { useClassroomSession } from '../../store/ClassroomSessionContext';
import { presentExample } from '../welcome/examplePresentation';
import { APP_VERSION } from '../../appVersion';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { resolveTopBarCommand, type TopBarCommandContext } from '../workspace/commandRegistry';
import { DEFAULT_PDELTA_CONFIG } from '../../engine/pDelta';
import type { TranslationKey } from '../../i18n/catalogs';
import type { PDeltaConfig } from '../../types';

const PortableImportCenter = lazy(() => import('../import-export/PortableImportCenter').then((module) => ({ default: module.PortableImportCenter })));

/**
 * La compacidad del riel salió de aquí en CRI-89: la decide la clase de
 * composición, no el usuario, así que su conmutador dejó de tener un estado que
 * conmutar. El resto de acciones de vista —inspector y lienzo completo— siguen
 * siendo intenciones del usuario y no cambian.
 */
export interface TopBarLayoutActions {
  inspectorCollapsed: boolean;
  fullCanvas: boolean;
  onToggleInspector: () => void;
  onToggleFullCanvas: () => void;
}

export const TopBar = ({ onOpenHome, onOpenSpace3D, layoutActions }: { onOpenHome?: () => void; onOpenSpace3D?: () => void; layoutActions?: TopBarLayoutActions }) => {
  // Split across the three focused contexts (CRI-100): `project`/`analysis` come
  // from the model/analysis contexts, and only `theme` is read off the UI context
  // here — `resultTab` and the diagram cursor live in that same context too but
  // are never destructured. `AnalysisStatus` below is additionally memoized with
  // stable props, so even the pointer-driven changes this component *does* still
  // receive (selection, the diagram cursor) never reach its state/reliability
  // subtree.
  const {
    project,
    canUndo,
    canRedo,
    storageIssue,
    storageMessage,
    renameProject,
    updateProjectView,
    updateProjectAnalysisSettings,
    replaceProject,
    undo,
    redo,
  } = useProjectModel();
  const {
    analysis,
    isAnalyzing,
    selectedCombinationId,
    setSelectedCombinationId,
    analyze,
    ensureEducationTrace,
  } = useProjectAnalysis();
  const { theme, setTheme } = useWorkspaceUI();
  const { language, t } = useI18n();
  const { t: phase2T } = usePhase2I18n(language);
  const classroomSession = useClassroomSession();
  const reducedMotion = useReducedMotion();
  const popoverMotionProps = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } }
    : {
      initial: { opacity: 0, y: -10, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } },
      transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
    };
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [importCenterOpen, setImportCenterOpen] = useState(false);
  const [portableExport, setPortableExport] = useState<'pdf' | 'bundle' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState(project.name);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const topbarRef = useRef<HTMLElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const projectMenuButtonRef = useRef<HTMLButtonElement>(null);
  const exportMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const menuOpen = showProjectMenu || showExportMenu || showMobileMenu;

  useEffect(() => {
    const syncConnectivity = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', syncConnectivity);
    window.addEventListener('offline', syncConnectivity);
    return () => {
      window.removeEventListener('online', syncConnectivity);
      window.removeEventListener('offline', syncConnectivity);
    };
  }, []);

  const closeMenus = () => {
    setShowProjectMenu(false);
    setShowExportMenu(false);
    setShowMobileMenu(false);
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.project-menu, .project-menu-toggle, .export-wrap, .mobile-actions-wrap')) closeMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const trigger = showProjectMenu ? projectMenuButtonRef.current : showExportMenu ? exportMenuButtonRef.current : mobileMenuButtonRef.current;
      closeMenus();
      window.requestAnimationFrame(() => trigger?.focus());
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, showExportMenu, showMobileMenu, showProjectMenu]);

  useEffect(() => {
    const selector = showProjectMenu ? '.project-menu button:not(:disabled)' : showExportMenu ? '.export-menu button:not(:disabled)' : showMobileMenu ? '.mobile-actions-menu button:not(:disabled)' : null;
    if (!selector) return undefined;
    const handle = window.requestAnimationFrame(() => topbarRef.current?.querySelector<HTMLButtonElement>(selector)?.focus());
    return () => window.cancelAnimationFrame(handle);
  }, [showExportMenu, showMobileMenu, showProjectMenu]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'));
    if (!items.length) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const toggleProjectMenu = () => {
    setShowProjectMenu((open) => !open);
    setShowExportMenu(false);
    setShowMobileMenu(false);
  };
  const toggleExportMenu = () => {
    setShowExportMenu((open) => !open);
    setShowProjectMenu(false);
    setShowMobileMenu(false);
  };
  const toggleMobileMenu = () => {
    setShowMobileMenu((open) => !open);
    setShowProjectMenu(false);
    setShowExportMenu(false);
  };

  // Stable reference so the memoized `AnalysisStatus` below doesn't re-render
  // just because the TopBar itself re-rendered for an unrelated reason. Its
  // body is the same `emitWorkspaceCommand('open-model-doctor')` the registry's
  // `analysis:model-doctor` command runs — kept as its own `useCallback` (rather
  // than `modelDoctorCommand.run`, a fresh closure every render) only because
  // `AnalysisStatus` is itself a protected, re-render-sensitive component
  // (CRI-100); the visible "Model Doctor" buttons below read straight off
  // `modelDoctorCommand` instead.
  const openModelDoctor = useCallback(() => {
    emitWorkspaceCommand('open-model-doctor');
  }, []);
  const closeImportCenter = () => {
    setImportCenterOpen(false);
    window.requestAnimationFrame(() => projectMenuButtonRef.current?.focus());
  };

  useLayoutEffect(() => setProjectNameDraft(project.name), [project.id, project.name]);

  const commitProjectName = () => {
    const next = projectNameDraft.trim() || project.name;
    setProjectNameDraft(next);
    renameProject(next);
  };
  const selectedCombination = project.combinations.find((item) => item.id === selectedCombinationId);
  const scenarioName = selectedCombination?.name
    ?? (project.loadCases.filter((item) => item.active).map((item) => item.name).join(' + ') || t('analysis.activeCases'));
  const scenarioFactors = selectedCombination?.factors ?? Object.fromEntries(
    project.loadCases.filter((loadCase) => loadCase.active).map((loadCase) => [loadCase.id, 1]),
  );
  const storageState = storageIssue === 'load-failed'
    ? 'load-error'
    : storageIssue === 'save-failed'
      ? 'save-error'
      : storageIssue === 'conflict'
        ? 'conflict'
        : storageIssue === 'repository-degraded'
          ? 'repository-error'
      : !online
        ? 'offline'
        : storageIssue === 'recovered'
          ? 'recovered'
          : 'local';
  const storageHasError = ['load-error', 'save-error', 'repository-error', 'conflict'].includes(storageState);
  const storageLabel = storageState === 'load-error'
    ? t('storage.loadFailedShort')
    : storageState === 'save-error'
      ? t('storage.failedShort')
    : storageState === 'conflict'
      ? phase2T('storage.conflictShort')
    : storageState === 'repository-error'
      ? phase2T('storage.repositoryShort')
    : storageState === 'recovered'
      ? t('storage.recoveredShort')
      : storageState === 'offline'
        ? t('storage.offline')
        : t('storage.local');
  const storageDescription = storageState === 'load-error'
    ? t('storage.loadFailed')
    : storageState === 'save-error'
      ? t('storage.failed')
    : storageState === 'conflict'
      ? (storageMessage ?? phase2T('storage.conflict'))
    : storageState === 'repository-error'
      ? (storageMessage ?? phase2T('storage.repository'))
    : storageState === 'recovered'
      ? t('storage.recovered')
      : storageState === 'offline'
        ? t('storage.offlineDescription')
        : t('storage.localDescription');
  const portableExportLabel = (kind: 'pdf' | 'bundle'): string => {
    if (portableExport !== kind) return t(kind === 'pdf' ? 'portable.pdfLabel' : 'portable.bundleLabel');
    if (!analysis) return t(kind === 'pdf' ? 'portable.analyzingPdf' : 'portable.analyzingBundle');
    return t(kind === 'pdf' ? 'portable.generatingPdf' : 'portable.preparingBundle');
  };
  const requestAnalysis = () => {
    if (project.settings.calculationMode === 'classroom') {
      classroomSession.markAnalysisRequested();
    }
    analyze();
  };

  // Single source for undo/redo, datasheet, Model Doctor, analyze, theme and
  // the plain-export controls (CRI-103): the button below reads label/disabled/run
  // straight off `commandRegistry` instead of recomputing them, so it can never
  // drift from the same command's Palette entry. `analyze` here is
  // `requestAnalysis` (this button's own classroom-session bookkeeping), not the
  // raw `analyze` — the registry only fixes *which* command runs and how its
  // enabled state is computed, not which concrete callback a surface supplies.
  const topBarCommandContext: TopBarCommandContext = { t, project, isAnalyzing, canUndo, canRedo, theme, setTheme, analyze: requestAnalysis, undo, redo };
  const command = (id: Parameters<typeof resolveTopBarCommand>[0]) => resolveTopBarCommand(id, topBarCommandContext);

  const exportPortable = async (kind: 'pdf' | 'bundle') => {
    setPortableExport(kind);
    setExportError(null);
    try {
      let exportAnalysis = analysis;
      if (!exportAnalysis) {
        const { analyzeForPortableExport } = await import('./portableExportAnalysis');
        exportAnalysis = analyzeForPortableExport(project, selectedCombination ?? null);
      } else if (!exportAnalysis.educationTrace) {
        // The interactive analysis run skips the matrix trace for speed
        // (AG-013); the report annex needs it, so fetch it here on demand.
        exportAnalysis = await ensureEducationTrace() ?? exportAnalysis;
      }
      const portable = await import('../../utils/portable');
      const options = { appVersion: APP_VERSION, scenarioName, scenarioFactors, includeEducationTrace: true };
      if (kind === 'pdf') {
        const report = await portable.createCalculationReport(project, exportAnalysis, options);
        await portable.shareOrDownloadPortableBytes(report.bytes, report.filename, 'application/pdf', t('portable.reportShareTitle', { name: project.name }));
      } else {
        const bundle = await portable.createPortableBundle(project, exportAnalysis, options);
        await portable.shareOrDownloadPortableBytes(bundle.bytes, bundle.filename, portable.STRUCTURECO_BUNDLE_MIME, t('portable.bundleShareTitle', { name: project.name }));
      }
      emitWorkspaceCommand('show-toast', { message: t('export.completed'), description: project.name, tone: 'success' });
      setShowExportMenu(false);
      setShowMobileMenu(false);
    } catch (error) {
      setExportError(language === 'es' && error instanceof Error ? error.message : t('portable.exportFailed'));
    } finally {
      setPortableExport(null);
    }
  };

  const handleCopyJson = async () => {
    const payload = JSON.stringify(normalizeProject(project), null, 2);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(payload);
        emitWorkspaceCommand('show-toast', { message: t('export.copySuccessful'), description: project.name, tone: 'success' });
      } else {
        exportProjectJson(project);
        emitWorkspaceCommand('show-toast', { message: t('export.copyFallbackDownloaded'), description: project.name, tone: 'info' });
      }
    } catch {
      exportProjectJson(project);
      emitWorkspaceCommand('show-toast', { message: t('export.copyFallbackDownloaded'), description: project.name, tone: 'info' });
    }
    setShowExportMenu(false);
    setShowMobileMenu(false);
  };

  const analyzeCommand = command('analysis:run');
  const undoCommand = command('analysis:undo');
  const redoCommand = command('analysis:redo');
  const datasheetCommand = command('tool:datasheet');
  const modelDoctorCommand = command('analysis:model-doctor');
  const themeCommand = command('view:theme');
  const ThemeIcon = themeCommand.icon;
  const exportJsonCommand = command('export:json');
  const exportSvgCommand = command('export:svg');
  const exportPngCommand = command('export:png');
  const exportPrintCommand = command('export:print');

  return (
    <header ref={topbarRef} className="topbar">
      <div className="brand-block topbar-zone topbar-document-zone" data-topbar-zone="document" data-topbar-cluster="document">
        <button className="brand-mark brand-home-button" type="button" aria-label={t('navigation.home')} onClick={onOpenHome}>
          <BrandMark size={46} />
        </button>
        <div className="top-divider" />
        <div className="document-identity">
          <span className="brand-name">structureCo</span>
          <div className="project-name">
            <input
              ref={projectNameRef}
              aria-label={t('project.name')}
              title={projectNameDraft}
              value={projectNameDraft}
              onChange={(event) => setProjectNameDraft(event.target.value)}
              onBlur={commitProjectName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') projectNameRef.current?.blur();
                if (event.key === 'Escape') {
                  setProjectNameDraft(project.name);
                  projectNameRef.current?.blur();
                }
              }}
            />
            <button
              ref={projectMenuButtonRef}
              className="project-menu-toggle"
              type="button"
              aria-label={t('project.openExamples')}
              aria-expanded={showProjectMenu}
              aria-haspopup="menu"
              onClick={toggleProjectMenu}
            >
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
        <AnimatePresence>
          {showProjectMenu ? (
            <m.div {...popoverMotionProps} className="popover project-menu" role="menu" aria-label={t('project.openExamples')} onKeyDown={onMenuKeyDown}>
              <button role="menuitem" onClick={() => { const next = createBlankProject(); replaceProject({ ...next, settings: { ...next.settings, language } }); setShowProjectMenu(false); }}>
                <FilePlus2 size={17} /> {t('project.new')}
              </button>
              {exampleProjects.map((example) => {
                const copy = presentExample(example.name, example.description, t);
                return <button role="menuitem" key={example.name} onClick={() => { const next = example.build(); replaceProject({ ...next, settings: { ...next.settings, language } }); setShowProjectMenu(false); }}>
                  <span className="menu-copy"><strong>{copy.name}</strong><small>{copy.description}</small></span>
                </button>;
              })}
              <button role="menuitem" onClick={() => { setImportCenterOpen(true); setShowProjectMenu(false); }}><FolderOpen size={17} /> {t('project.importJson')}</button>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="top-actions topbar-zone topbar-actions-zone" data-topbar-zone="actions">
        <div className="topbar-context-zone" data-topbar-cluster="context" aria-label={t('analysis.caseOrCombination')}>
          <label className="topbar-context-control topbar-context-control--scenario" data-context-control="scenario">
            <span>{t('analysis.caseOrCombination')}</span>
            <select
              className="compact-select combination-select"
              aria-label={t('analysis.caseOrCombination')}
              value={selectedCombinationId}
              onChange={(event) => setSelectedCombinationId(event.target.value)}
            >
              <option value="">{t('analysis.activeCases')}</option>
              {project.combinations.map((combination) => <option key={combination.id} value={combination.id}>{combination.name}</option>)}
            </select>
          </label>
          <label className="topbar-context-control" data-context-control="mode">
            <span>{t('analysis.mode')}</span>
            <select
              className="compact-select mode-select"
              aria-label={t('analysis.mode')}
              value={project.settings.calculationMode ?? 'complete'}
              onChange={(event) => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, calculationMode: event.target.value as 'complete' | 'classroom' } }))}
            >
              <option value="classroom">{t('analysis.modeClassroom')}</option>
              <option value="complete">{t('analysis.modeComplete')}</option>
            </select>
          </label>
          <label className="topbar-context-control" data-context-control="order">
            <span>{t('analysis.order')}</span>
            <select
              className="compact-select analysis-order-select"
              aria-label={t('analysis.order')}
              value={project.settings.analysisMode ?? 'first-order'}
              onChange={(event) => updateProjectAnalysisSettings((settings) => ({ ...settings, analysisMode: event.target.value as 'first-order' | 'p-delta' }))}
            >
              <option value="first-order">{t('analysis.orderFirst')}</option>
              <option value="p-delta">{t('analysis.orderPDelta')}</option>
            </select>
          </label>
          <label className="topbar-context-control topbar-context-control--units" data-context-control="units">
            <span>{t('units.label')}</span>
            <select
              className="compact-select units-select"
              aria-label={t('units.label')}
              value={project.settings.units}
              onChange={(event) => updateProjectView((draft) => ({
                ...draft,
                settings: { ...draft.settings, units: event.target.value as typeof draft.settings.units },
              }))}
            >
              <option value="kN-m">kN · m</option>
              <option value="N-mm">N · mm</option>
              <option value="kgf-m">kgf · m</option>
              <option value="kip-ft">kip · ft</option>
            </select>
          </label>
        </div>
        <div className="topbar-command-cluster" data-topbar-cluster="actions">
        <IconButton
          variant="secondary"
          className="icon-button datasheet-launcher"
          label={datasheetCommand.label}
          title={datasheetCommand.hint}
          onClick={datasheetCommand.run}
        ><Sheet size={19} /></IconButton>
        {onOpenSpace3D ? <IconButton
          variant="secondary"
          className="icon-button space3d-open-button"
          label={t('space3d.open')}
          title={t('space3d.open')}
          onClick={onOpenSpace3D}
        ><Box size={19} /></IconButton> : null}
        <div className="history-controls" aria-label={t('history.label')}>
          <IconButton variant="secondary" className="icon-button" label={undoCommand.label} onClick={undoCommand.run} disabled={undoCommand.disabled} title={undoCommand.label}><Undo2 size={19} /></IconButton>
          <IconButton variant="secondary" className="icon-button" label={redoCommand.label} onClick={redoCommand.run} disabled={redoCommand.disabled} title={redoCommand.label}><Redo2 size={19} /></IconButton>
        </div>
        <div className="export-wrap">
          <IconButton variant="secondary" ref={exportMenuButtonRef} className="icon-button" label={t('export.label')} title={t('export.label')} aria-expanded={showExportMenu} aria-haspopup="menu" onClick={toggleExportMenu}><Download size={19} /></IconButton>
          <AnimatePresence>
            {showExportMenu ? (
              <m.div {...popoverMotionProps} className="popover export-menu" role="menu" aria-label={t('export.label')} onKeyDown={onMenuKeyDown}>
                <button role="menuitem" onClick={() => { exportJsonCommand.run(); setShowExportMenu(false); }}><Save size={16} /> {exportJsonCommand.label}</button>
                <button role="menuitem" onClick={() => void handleCopyJson()}><Copy size={16} /> {t('export.copyData')}</button>
                <button role="menuitem" disabled={isAnalyzing || portableExport !== null} onClick={() => void exportPortable('pdf')}><FileText size={16} /> {portableExportLabel('pdf')}</button>
                <button role="menuitem" disabled={isAnalyzing || portableExport !== null} onClick={() => void exportPortable('bundle')}><FileArchive size={16} /> {portableExportLabel('bundle')}</button>
                <button role="menuitem" onClick={() => { exportSvgCommand.run(); setShowExportMenu(false); }}>{exportSvgCommand.label}</button>
                <button role="menuitem" onClick={() => { exportPngCommand.run(); setShowExportMenu(false); }}>{exportPngCommand.label}</button>
                <button role="menuitem" onClick={() => { exportPrintCommand.run(); setShowExportMenu(false); }}>{exportPrintCommand.label}</button>
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="mobile-actions-wrap utility-actions-wrap">
          <IconButton variant="secondary" ref={mobileMenuButtonRef} className="icon-button mobile-more-button utility-more-button" label={t('actions.more')} aria-expanded={showMobileMenu} aria-haspopup="dialog" onClick={toggleMobileMenu}><MoreHorizontal size={20} /></IconButton>
          <AnimatePresence>
            {showMobileMenu ? (
              <m.div {...popoverMotionProps} className="popover mobile-actions-menu utility-actions-menu" role="dialog" aria-label={t('actions.more')}>
                <div className="mobile-history-actions overflow-history" role="group" aria-label={t('history.label')}>
                  <button onClick={undoCommand.run} disabled={undoCommand.disabled}><Undo2 size={17} /> {undoCommand.label}</button>
                  <button onClick={redoCommand.run} disabled={redoCommand.disabled}><Redo2 size={17} /> {redoCommand.label}</button>
                </div>

                <div className="menu-section">
                  <div className="menu-section-title">{t('menu.sectionAnalysis')}</div>
                  <button onClick={() => { mobileMenuButtonRef.current?.focus({ preventScroll: true }); setShowMobileMenu(false); modelDoctorCommand.run(); }}><Wrench size={17} /> {modelDoctorCommand.label}</button>
                  {/* Datasheet degrada a icono-only y luego a este desbordamiento antes
                      de tocar Estado/Doctor (orden de degradación · CRI-95). */}
                  <button className="overflow-datasheet" onClick={() => { datasheetCommand.run(); setShowMobileMenu(false); }}><Sheet size={17} /> {datasheetCommand.label}</button>
                  <label className="mobile-menu-field overflow-case"><span>{t('analysis.caseOrCombination')}</span><select value={selectedCombinationId} onChange={(event) => setSelectedCombinationId(event.target.value)}><option value="">{t('analysis.activeCases')}</option>{project.combinations.map((combination) => <option key={combination.id} value={combination.id}>{combination.name}</option>)}</select></label>
                  <label className="mobile-menu-field overflow-mode"><span>{t('analysis.mode')}</span><select value={project.settings.calculationMode ?? 'complete'} onChange={(event) => { updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, calculationMode: event.target.value as 'complete' | 'classroom' } })); setShowMobileMenu(false); }}><option value="classroom">{t('analysis.modeClassroom')}</option><option value="complete">{t('analysis.modeComplete')}</option></select></label>
                  <label className="mobile-menu-field overflow-analysis-order"><span>{t('analysis.order')}</span><select value={project.settings.analysisMode ?? 'first-order'} onChange={(event) => { updateProjectAnalysisSettings((settings) => ({ ...settings, analysisMode: event.target.value as 'first-order' | 'p-delta' })); setShowMobileMenu(false); }}><option value="first-order">{t('analysis.orderFirst')}</option><option value="p-delta">{t('analysis.orderPDelta')}</option></select></label>
                  {(project.settings.analysisMode ?? 'first-order') === 'p-delta' ? <PDeltaAdvancedConfig /> : null}
                </div>

                <div className="menu-section">
                  <div className="menu-section-title">{t('menu.sectionPreferences')}</div>
                  <label className="mobile-menu-field overflow-units"><span>{t('units.label')}</span><select value={project.settings.units} onChange={(event) => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, units: event.target.value as typeof draft.settings.units } }))}><option value="kN-m">kN · m</option><option value="N-mm">N · mm</option><option value="kgf-m">kgf · m</option><option value="kip-ft">kip · ft</option></select></label>
                  <label className="mobile-menu-field"><span>{t('language.label')}</span><select value={language} onChange={(event) => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, language: event.target.value as 'es' | 'en' } }))}><option value="es">{t('language.es')}</option><option value="en">{t('language.en')}</option></select></label>
                  <button onClick={() => { themeCommand.run(); setShowMobileMenu(false); }}><ThemeIcon size={17} /> {themeCommand.label}</button>
                </div>

                {layoutActions ? <div className="menu-section overflow-layout-actions" role="group" aria-label={t('shell.viewLayout')}>
                  <div className="menu-section-title">{t('menu.sectionViews')}</div>
                  {onOpenSpace3D ? <button onClick={() => { onOpenSpace3D(); setShowMobileMenu(false); }}>
                    <Box size={17} /> {t('space3d.open')}
                  </button> : null}
                  <button onClick={() => { layoutActions.onToggleInspector(); setShowMobileMenu(false); }}>
                    {layoutActions.inspectorCollapsed || layoutActions.fullCanvas ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
                    {layoutActions.inspectorCollapsed || layoutActions.fullCanvas ? t('shell.showInspector') : t('shell.hideInspector')}
                  </button>
                  <button onClick={() => { layoutActions.onToggleFullCanvas(); setShowMobileMenu(false); }}>
                    {layoutActions.fullCanvas ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                    {layoutActions.fullCanvas ? t('shell.exitFullCanvas') : t('shell.fullCanvas')}
                  </button>
                </div> : null}

                <div className="menu-section">
                  <div className="menu-section-title">{t('menu.sectionExport')}</div>
                  <button onClick={() => { exportJsonCommand.run(); setShowMobileMenu(false); }}><Save size={16} /> {exportJsonCommand.label}</button>
                  <button onClick={() => void handleCopyJson()}><Copy size={16} /> {t('export.copyData')}</button>
                  <button disabled={isAnalyzing || portableExport !== null} onClick={() => void exportPortable('pdf')}><FileText size={16} /> {portableExportLabel('pdf')}</button>
                  <button disabled={isAnalyzing || portableExport !== null} onClick={() => void exportPortable('bundle')}><FileArchive size={16} /> {portableExportLabel('bundle')}</button>
                  <button onClick={() => { exportSvgCommand.run(); setShowMobileMenu(false); }}><Download size={16} /> {exportSvgCommand.label}</button>
                  <button onClick={() => { exportPngCommand.run(); setShowMobileMenu(false); }}><Download size={16} /> {exportPngCommand.label}</button>
                  <button onClick={() => { exportPrintCommand.run(); setShowMobileMenu(false); }}>{exportPrintCommand.label}</button>
                </div>

                {/* El chip de persistencia de la Cinta (zona `status`) ya es la
                    única región `aria-live` de este estado; este es su duplicado
                    visible del desbordamiento y no vuelve a anunciarse solo. */}
                <div className={`mobile-storage-state ${storageHasError || storageState === 'offline' ? 'error' : ''}`} data-storage-state={storageState}>{storageHasError || storageState === 'offline' ? <CloudOff size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}<span><strong>{storageLabel}</strong><small>{storageDescription}</small></span></div>
                {exportError ? <div className="portable-export-error" role="alert">{exportError}</div> : null}
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>
        <Button
          className={`analyze-button${isAnalyzing ? ' analyzing' : ''}`}
          variant="primary"
          size="touch"
          onClick={analyzeCommand.run}
          loading={isAnalyzing}
          loadingLabel={t('analysis.runningLabel')}
          leadingIcon={<Play size={17} fill="currentColor" />}
          aria-label={isAnalyzing ? t('analysis.runningLabel') : analyzeCommand.label}
        >{isAnalyzing ? t('analysis.running') : analyzeCommand.label}</Button>
        </div>
      </div>

      <div className="topbar-zone topbar-status-zone" data-topbar-zone="status" data-topbar-cluster="status">
        <div
          className={`autosave-state${storageHasError || storageState === 'offline' ? ' has-issue' : ''} topbar-persistence`}
          data-storage-state={storageState}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {storageHasError || storageState === 'offline' ? <CloudOff size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
          <span className="autosave-state__label">{storageLabel}</span>
          {/* La descripción sobrevive al icono-only del piso Compact: no es un
              `span` genérico, así que la regla que oculta la etiqueta corta no
              se la lleva por delante (GAP-1 · CRI-95). */}
          <span className="sr-only">{storageDescription}</span>
        </div>
        {/* En pantallas anchas el botón lleva texto; por debajo de 1536px
            colapsa a icono en CSS y libera el ancho que la zona necesita. Estado
            y Doctor son la afirmación más crítica del producto (D-14 · CRI-95):
            nunca desaparecen ni pierden su etiqueta accesible, sea cual sea la
            clase de composición. */}
        <button
          type="button"
          className="topbar-command-button model-doctor-launcher"
          onClick={modelDoctorCommand.run}
          aria-label={modelDoctorCommand.label}
          title={t('modelDoctor.description')}
        >
          <Wrench size={17} aria-hidden="true" />
          <span>{modelDoctorCommand.label}</span>
        </button>
        <AnalysisStatus
          projectId={project.id}
          analysis={analysis}
          isAnalyzing={isAnalyzing}
          onOpenModelDoctor={openModelDoctor}
        />
      </div>
      {exportError && showExportMenu ? <div className="portable-export-error desktop" role="alert">{exportError}</div> : null}
      {importCenterOpen ? <Suspense fallback={null}><PortableImportCenter
        open
        currentProjectName={project.name}
        onClose={closeImportCenter}
        onSaveCurrent={() => exportProjectJson(project)}
        onImported={(outcome) => {
          replaceProject({ ...outcome.project, settings: { ...outcome.project.settings, language } }, outcome.restoredAnalysis);
          closeImportCenter();
        }}
      /></Suspense> : null}
    </header>
  );
};

const PDELTA_FIELDS: Array<{ key: keyof PDeltaConfig; labelKey: TranslationKey; step?: number }> = [
  { key: 'maxLoadSteps', labelKey: 'pdelta.maxLoadSteps', step: 1 },
  { key: 'maxIterationsPerStep', labelKey: 'pdelta.maxIterationsPerStep', step: 1 },
  { key: 'equilibriumTolerance', labelKey: 'pdelta.equilibriumTolerance' },
  { key: 'displacementTolerance', labelKey: 'pdelta.displacementTolerance' },
  { key: 'stepReductionFactor', labelKey: 'pdelta.stepReductionFactor' },
  { key: 'minimumStep', labelKey: 'pdelta.minimumStep' },
];

const PDeltaAdvancedConfig = () => {
  const { project, updateProjectAnalysisSettings } = useProjectModel();
  const { t } = useI18n();
  const config = { ...DEFAULT_PDELTA_CONFIG, ...project.settings.pDeltaConfig };
  const setField = (key: keyof PDeltaConfig, value: number) => {
    if (!Number.isFinite(value)) return;
    updateProjectAnalysisSettings((settings) => ({
      ...settings,
      pDeltaConfig: { ...settings.pDeltaConfig, [key]: value },
    }));
  };
  return (
    <details className="pdelta-advanced-details">
      <summary>{t('pdelta.advancedConfig')}</summary>
      <div className="pdelta-advanced-content">
        {PDELTA_FIELDS.map(({ key, labelKey, step }) => (
          <label className="mobile-menu-field" key={key}>
            <span>{t(labelKey)}</span>
            <input
              type="number"
              value={config[key]}
              step={step ?? 'any'}
              onChange={(event) => setField(key, event.target.valueAsNumber)}
            />
          </label>
        ))}
      </div>
    </details>
  );
};
