import { type KeyboardEvent as ReactKeyboardEvent, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import {
  Check,
  Box,
  ChartNoAxesCombined,
  ChevronDown,
  CloudOff,
  Copy,
  Download,
  FileArchive,
  FileText,
  FilePlus2,
  FolderOpen,
  HardDriveDownload,
  Home,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Redo2,
  Save,
  Share2,
  Sheet,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Wrench,
} from 'lucide-react';
import { createBlankProject, exampleProjects } from '../../data/defaultProject';
import { useI18n } from '../../i18n/useI18n';
import { usePhase2I18n } from '../../i18n/usePhase2I18n';
import { useProjectAnalysis, useProjectModel } from '../../store/ProjectContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { exportProjectJson, safeProjectFilename } from '../../utils/export';
import { normalizeProject } from '../../data/migrate';
import { saveBytes, type SaveOutcome } from '../../platform/fileSystem';
import { buildShareLink } from '../../utils/shareLink';
import { AnalysisStatus } from './AnalysisStatus';
import { DesignStandardSelector } from './DesignStandardSelector';
import { BrandMark } from './BrandMark';
import { Button, IconButton } from '../../design-system/components/controls';
import { useClassroomSession } from '../../store/ClassroomSessionContext';
import { presentExample } from '../welcome/examplePresentation';
import { APP_VERSION } from '../../appVersion';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { LazySurface } from '../workspace/LazySurface';
import { resolveTopBarCommand, type TopBarCommandContext } from '../workspace/commandRegistry';
import { DEFAULT_PDELTA_CONFIG } from '../../engine/pDelta';
import type { TranslationKey } from '../../i18n/catalogs';
import type { AnalysisResult, PDeltaConfig } from '../../types';
import { applicableMethods, resolveSolutionMethod, type SolutionMethodId } from '../../analysis-methods/methodRegistry';

const PortableImportCenter = lazy(() => import('../import-export/PortableImportCenter').then((module) => ({ default: module.PortableImportCenter })));
const ProposalAssistant = lazy(() => import('../ai/ProposalAssistant').then((module) => ({ default: module.ProposalAssistant })));
const PdfPreviewDialog = lazy(() => import('../import-export/PdfPreviewDialog').then((module) => ({ default: module.PdfPreviewDialog })));

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

/**
 * Un ítem apagado por CSS sigue estando en el DOM, y `querySelector` no lo sabe.
 *
 * Estos menús son también el desbordamiento de la Cinta: llevan dentro copias
 * que sólo se encienden por debajo de su umbral —el historial, «Ir al inicio»—.
 * La primera de ellas es, además, el primer `button` del popover, así que abrir
 * el menú con el teclado mandaba el foco a un elemento con `display:none`: el
 * `focus()` no hace nada y el foco se queda en ninguna parte. Lo mismo con las
 * flechas, que contaban paradas invisibles.
 *
 * Se comprueba por la cadena de ancestros y con `getComputedStyle`, no con
 * `offsetParent`: en jsdom —donde corren las pruebas y no hay ni una hoja de
 * estilo cargada— `offsetParent` es siempre `null` y daría todo por invisible,
 * mientras que `display` sin CSS nunca es `none`. Así la misma función dice la
 * verdad en el navegador y en las pruebas.
 */
const isRendered = (element: HTMLElement): boolean => {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (window.getComputedStyle(node).display === 'none') return false;
  }
  return true;
};

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
    replaceProject,
    undo,
    redo,
  } = useProjectModel();
  const {
    analysis,
    isAnalyzing,
    selectedCombinationId,
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
  /**
   * Los cuatro popovers de la Cinta son uno solo, y por eso son un valor y no
   * cuatro banderas.
   *
   * Con cuatro booleanos la exclusión mutua había que recordarla en cada
   * conmutador, y estaba escrita cuatro veces con un subconjunto distinto cada
   * vez: abrir «Proyecto» o «Exportar» cerraba los otros dos menús pero **no**
   * la configuración de análisis, así que quedaban dos popovers en pantalla a
   * la vez. No era sólo cosa de la vista: al cerrar con Escape, el foco se
   * devuelve al disparador que se elige con un ternario encadenado
   * (`showProjectMenu ? … : showExportMenu ? …`) que da por hecho que hay uno
   * abierto — con dos, el foco volvía al botón equivocado.
   *
   * Un valor único no puede representar ese estado. No hay nada que recordar.
   */
  const [openMenu, setOpenMenu] = useState<'project' | 'export' | 'mobile' | 'analysis' | null>(null);
  const showProjectMenu = openMenu === 'project';
  const showExportMenu = openMenu === 'export';
  const showMobileMenu = openMenu === 'mobile';
  const showAnalysisSetup = openMenu === 'analysis';
  const [importCenterOpen, setImportCenterOpen] = useState(false);
  const [proposalAssistantOpen, setProposalAssistantOpen] = useState(false);
  const [portableExport, setPortableExport] = useState<'pdf' | 'bundle' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  /* La vista previa retiene el análisis con el que se compuso el informe: mientras el
     diálogo está abierto, cada cambio de contenido recompone el PDF sin volver a analizar. */
  const [previewAnalysis, setPreviewAnalysis] = useState<AnalysisResult | null>(null);
  /* Manejador de un guardado nativo previo (File System Access API). Vive en
     el componente, no en `saveBytes` —que documenta explícitamente que
     retenerlo ahí lo compartiría entre proyectos— ni en `commandRegistry`,
     cuyos comandos son funciones puras de `ctx` sin estado propio. */
  const [saveHandle, setSaveHandle] = useState<unknown>(null);
  const [projectNameDraft, setProjectNameDraft] = useState(project.name);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const topbarRef = useRef<HTMLElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const projectMenuButtonRef = useRef<HTMLButtonElement>(null);
  const exportMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const analysisSetupButtonRef = useRef<HTMLButtonElement>(null);
  const menuOpen = showProjectMenu || showExportMenu || showMobileMenu || showAnalysisSetup;

  useEffect(() => {
    const syncConnectivity = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', syncConnectivity);
    window.addEventListener('offline', syncConnectivity);
    return () => {
      window.removeEventListener('online', syncConnectivity);
      window.removeEventListener('offline', syncConnectivity);
    };
  }, []);

  const closeMenus = () => { setOpenMenu(null); };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.project-menu, .project-menu-toggle, .export-wrap, .mobile-actions-wrap, .analysis-setup-wrap')) closeMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const trigger = showProjectMenu ? projectMenuButtonRef.current
        : showExportMenu ? exportMenuButtonRef.current
        : showAnalysisSetup ? analysisSetupButtonRef.current
        : mobileMenuButtonRef.current;
      closeMenus();
      window.requestAnimationFrame(() => trigger?.focus());
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, showAnalysisSetup, showExportMenu, showMobileMenu, showProjectMenu]);

  useEffect(() => {
    const selector = showProjectMenu ? '.project-menu button:not(:disabled)' : showExportMenu ? '.export-menu button:not(:disabled)' : showMobileMenu ? '.mobile-actions-menu button:not(:disabled)' : null;
    if (!selector) return undefined;
    const handle = window.requestAnimationFrame(() => {
      const items = topbarRef.current?.querySelectorAll<HTMLButtonElement>(selector);
      Array.from(items ?? []).find(isRendered)?.focus();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [showExportMenu, showMobileMenu, showProjectMenu]);

  /* El popover de análisis abre el foco en su primer campo, no en un botón: no
     es un menú de acciones, es un formulario de cuatro decisiones. */
  useEffect(() => {
    if (!showAnalysisSetup) return undefined;
    const handle = window.requestAnimationFrame(() => topbarRef.current?.querySelector<HTMLSelectElement>('.analysis-setup-popover select')?.focus());
    return () => window.cancelAnimationFrame(handle);
  }, [showAnalysisSetup]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')).filter(isRendered);
    if (!items.length) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const toggleMenu = (menu: 'project' | 'export' | 'mobile' | 'analysis') => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };
  const toggleProjectMenu = () => { toggleMenu('project'); };
  const toggleExportMenu = () => { toggleMenu('export'); };
  const toggleMobileMenu = () => { toggleMenu('mobile'); };
  const toggleAnalysisSetup = () => { toggleMenu('analysis'); };

  // Stable reference so the memoized `AnalysisStatus` below doesn't re-render
  // just because the TopBar itself re-rendered for an unrelated reason. Its
  // body is the same `emitWorkspaceCommand('open-data', { tab: 'review' })` the registry's
  // `analysis:model-doctor` command runs — kept as its own `useCallback` (rather
  // than `modelDoctorCommand.run`, a fresh closure every render) only because
  // `AnalysisStatus` is itself a protected, re-render-sensitive component
  // (CRI-100); the visible "Model Doctor" buttons below read straight off
  // `modelDoctorCommand` instead.
  const openModelDoctor = useCallback(() => {
    emitWorkspaceCommand('open-data', { tab: 'review' });
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
  /* El botón de la barra lleva el caso activo, no la palabra «Análisis»: un
     ítem de barra unificada enseña su valor, no su categoría. */
  const activeScenarioLabel = selectedCombination?.name ?? t('analysis.activeCases');
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
      if (kind === 'pdf') {
        // El PDF ya no baja a ciegas: el análisis queda retenido y el diálogo compone el
        // documento, lo enseña y descarga desde su propio pie. El `toast` de exportación
        // se emite allí, cuando el archivo sale de verdad.
        setPreviewAnalysis(exportAnalysis);
        setOpenMenu(null);
        return;
      }
      const portable = await import('../../utils/portable');
      const options = { appVersion: APP_VERSION, scenarioName, scenarioFactors, includeEducationTrace: true };
      const bundle = await portable.createPortableBundle(project, exportAnalysis, options);
      await portable.shareOrDownloadPortableBytes(bundle.bytes, bundle.filename, portable.STRUCTURECO_BUNDLE_MIME, t('portable.bundleShareTitle', { name: project.name }));
      emitWorkspaceCommand('show-toast', { message: t('export.completed'), description: project.name, tone: 'success' });
      setOpenMenu(null);
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
    setOpenMenu(null);
  };

  /* «Guardar en el disco» (File System Access API): elige el archivo una vez
     y las siguientes veces escribe encima sin volver a preguntar. Donde el
     navegador no la ofrece, `saveBytes` ya cae sola a la descarga de
     siempre — la rama `cancelled` no hace nada porque el usuario cerró el
     selector a propósito. */
  const handleSaveToDisk = async () => {
    const normalized = normalizeProject(project);
    const filename = `${safeProjectFilename(normalized.name)}.structureco.json`;
    const outcome: SaveOutcome = await saveBytes({
      bytes: new TextEncoder().encode(JSON.stringify(normalized, null, 2)),
      filename,
      mimeType: 'application/json',
      extension: '.json',
      description: t('export.saveToDisk'),
      handle: saveHandle,
    });
    if (outcome.status === 'written') {
      setSaveHandle(outcome.handle);
      emitWorkspaceCommand('show-toast', { message: t('export.savedToFile', { filename: outcome.filename }), description: project.name, tone: 'success' });
    } else if (outcome.status === 'downloaded') {
      emitWorkspaceCommand('show-toast', { message: t('export.savedDownload', { filename: outcome.filename }), description: project.name, tone: 'info' });
    } else {
      return;
    }
    setOpenMenu(null);
  };

  /* Enlace para compartir: el modelo va comprimido en el fragmento (nunca al
     servidor); `App.tsx` lo lee al arrancar. Un modelo demasiado grande no
     falla en silencio: `buildShareLink` lo dice y el menú se queda abierto
     mostrando el porqué, igual que hace `exportPortable` con sus errores. */
  const handleShare = async () => {
    const result = buildShareLink(project, window.location.href);
    if (!result.ok) {
      setExportError(t('export.shareTooLarge', { characters: result.characters, limit: result.limit }));
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(result.url);
      } else {
        throw new Error('clipboard-unavailable');
      }
    } catch {
      setExportError(t('export.shareFailed'));
      return;
    }
    setExportError(null);
    emitWorkspaceCommand('show-toast', { message: t('export.shareLinkCopied'), description: project.name, tone: 'success' });
    setOpenMenu(null);
  };

  const analyzeCommand = command('analysis:run');
  const undoCommand = command('analysis:undo');
  const redoCommand = command('analysis:redo');
  const datasheetCommand = command('tool:datasheet');
  const resultsCommand = command('tool:results');
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
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
        <AnimatePresence>
          {showProjectMenu ? (
            <m.div {...popoverMotionProps} className="popover project-menu" role="menu" aria-label={t('project.openExamples')} onKeyDown={onMenuKeyDown}>
              {/* Ir al inicio, sólo por debajo de 360 px. Ahí la marca —que es
                  el botón de inicio— cede su sitio: las tres zonas de la Cinta
                  piden 110 px de dianas táctiles en una celda de 89 y algo tiene
                  que salir. Sale la identidad, no la capacidad, y sale al menú
                  que está justo debajo del galón que la sustituye. Por encima de
                  360 px esta entrada no existe: el destino sigue teniendo un solo
                  lanzador a cada ancho, igual que el historial. El gate que lo
                  fija barre anchos en Chromium (`qa.mjs`); jsdom no ve `@media`. */}
              <button role="menuitem" className="overflow-home" onClick={() => { setOpenMenu(null); onOpenHome?.(); }}>
                <Home size={16} /> {t('navigation.home')}
              </button>
              <button role="menuitem" onClick={() => { const next = createBlankProject(); replaceProject({ ...next, settings: { ...next.settings, language } }); setOpenMenu(null); }}>
                <FilePlus2 size={16} /> {t('project.new')}
              </button>
              {exampleProjects.map((example) => {
                const copy = presentExample(example.name, example.description, t);
                return <button role="menuitem" key={example.name} onClick={() => { const next = example.build(); replaceProject({ ...next, settings: { ...next.settings, language } }); setOpenMenu(null); }}>
                  <span className="menu-copy"><strong>{copy.name}</strong><small>{copy.description}</small></span>
                </button>;
              })}
              <button role="menuitem" onClick={() => { setImportCenterOpen(true); setOpenMenu(null); }}><FolderOpen size={16} /> {t('project.importJson')}</button>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="top-actions topbar-zone topbar-actions-zone" data-topbar-zone="actions">
        <div className="topbar-context-zone" data-topbar-cluster="context">
          {/* CUATRO decisiones, UN ítem de barra.
              Antes eran cuatro `<select>` con su etiqueta encima, y a 1280 px
              las etiquetas se recortaban a «Caso o com…», «Modo de cál…»,
              «Orden del a…». Una barra unificada del sistema no rotula sus
              ítems ni apila etiquetas sobre controles: enseña el valor activo y
              abre el resto en un popover. Lo que se ve de un vistazo es el caso
              en curso, que es el dato que cambia mientras se trabaja; los otros
              tres se eligen una vez y se olvidan. */}
          <div className="analysis-setup-wrap">
            <button
              type="button"
              ref={analysisSetupButtonRef}
              className="topbar-context-button analysis-setup-button"
              aria-haspopup="dialog"
              aria-expanded={showAnalysisSetup}
              aria-label={t('menu.sectionAnalysis')}
              title={t('analysis.setupHint')}
              onClick={toggleAnalysisSetup}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span className="topbar-context-button__value">{activeScenarioLabel}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <AnimatePresence>
              {showAnalysisSetup ? (
                <m.div {...popoverMotionProps} className="popover analysis-setup-popover" role="dialog" aria-label={t('menu.sectionAnalysis')}>
                  <AnalysisContextFields />
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
        <div className="topbar-command-cluster" data-topbar-cluster="actions">
        {/* Grupos, no una fila de seis iconos sueltos: superficies · historial ·
            exportación · resto. El separador de medio píxel entre grupos lo pone
            el CSS, que es donde vive el reparto visual. */}
        <div className="topbar-tool-group" role="group" aria-label={t('menu.sectionViews')}>
          {/* Tres lanzadores, tres destinos, UNA superficie: cada botón abre
              «Datos» en su pestaña. No se colapsan en un solo botón «Datos»
              porque el de Model Doctor es contrato protegido (D-14 · CRI-95:
              «nunca desaparece ni pierde su etiqueta accesible»), y porque una
              pestaña es un destino propio: llevar a las tres al mismo sitio y
              obligar a buscar la pestaña sería cambiar tres puertas correctas
              por una puerta y un paso de más. */}
          <IconButton
            variant="secondary"
            className="icon-button results-launcher"
            label={resultsCommand.label}
            title={resultsCommand.hint}
            onClick={resultsCommand.run}
          ><ChartNoAxesCombined size={18} /></IconButton>
          <IconButton
            variant="secondary"
            className="icon-button datasheet-launcher"
            label={datasheetCommand.label}
            title={datasheetCommand.hint}
            onClick={datasheetCommand.run}
          ><Sheet size={18} /></IconButton>
          {onOpenSpace3D ? <IconButton
            variant="secondary"
            className="icon-button space3d-open-button"
            label={t('space3d.open')}
            title={t('space3d.open')}
            onClick={onOpenSpace3D}
          ><Box size={18} /></IconButton> : null}
        </div>
        <div className="history-controls topbar-tool-group" aria-label={t('history.label')}>
          <IconButton variant="secondary" className="icon-button" label={undoCommand.label} onClick={undoCommand.run} disabled={undoCommand.disabled} title={undoCommand.label}><Undo2 size={18} /></IconButton>
          <IconButton variant="secondary" className="icon-button" label={redoCommand.label} onClick={redoCommand.run} disabled={redoCommand.disabled} title={redoCommand.label}><Redo2 size={18} /></IconButton>
        </div>
        <div className="export-wrap topbar-tool-group">
          <IconButton variant="secondary" ref={exportMenuButtonRef} className="icon-button" label={t('export.label')} title={t('export.label')} aria-expanded={showExportMenu} aria-haspopup="menu" onClick={toggleExportMenu}><Download size={18} /></IconButton>
          <AnimatePresence>
            {showExportMenu ? (
              <m.div {...popoverMotionProps} className="popover export-menu" role="menu" aria-label={t('export.label')} onKeyDown={onMenuKeyDown}>
                <button role="menuitem" onClick={() => { exportJsonCommand.run(); setOpenMenu(null); }}><Save size={16} /> {exportJsonCommand.label}</button>
                <button role="menuitem" onClick={() => void handleSaveToDisk()}><HardDriveDownload size={16} /> {t('export.saveToDisk')}</button>
                <button role="menuitem" onClick={() => void handleCopyJson()}><Copy size={16} /> {t('export.copyData')}</button>
                <button role="menuitem" onClick={() => void handleShare()}><Share2 size={16} /> {t('export.share')}</button>
                <button role="menuitem" disabled={isAnalyzing || portableExport !== null} onClick={() => void exportPortable('pdf')}><FileText size={16} /> {portableExportLabel('pdf')}</button>
                <button role="menuitem" disabled={isAnalyzing || portableExport !== null} onClick={() => void exportPortable('bundle')}><FileArchive size={16} /> {portableExportLabel('bundle')}</button>
                <button role="menuitem" onClick={() => { exportSvgCommand.run(); setOpenMenu(null); }}>{exportSvgCommand.label}</button>
                <button role="menuitem" onClick={() => { exportPngCommand.run(); setOpenMenu(null); }}>{exportPngCommand.label}</button>
                <button role="menuitem" onClick={() => { exportPrintCommand.run(); setOpenMenu(null); }}>{exportPrintCommand.label}</button>
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="mobile-actions-wrap utility-actions-wrap topbar-tool-group">
          <IconButton variant="secondary" ref={mobileMenuButtonRef} className="icon-button mobile-more-button utility-more-button" label={t('actions.more')} aria-expanded={showMobileMenu} aria-haspopup="dialog" onClick={toggleMobileMenu}><MoreHorizontal size={20} /></IconButton>
          <AnimatePresence>
            {showMobileMenu ? (
              <m.div {...popoverMotionProps} className="popover mobile-actions-menu utility-actions-menu" role="dialog" aria-label={t('actions.more')}>
                <div className="mobile-history-actions overflow-history" role="group" aria-label={t('history.label')}>
                  <button onClick={undoCommand.run} disabled={undoCommand.disabled}><Undo2 size={16} /> {undoCommand.label}</button>
                  <button onClick={redoCommand.run} disabled={redoCommand.disabled}><Redo2 size={16} /> {redoCommand.label}</button>
                </div>

                <div className="menu-section">
                  <div className="menu-section-title">{t('menu.sectionAnalysis')}</div>
                  <button onClick={() => { mobileMenuButtonRef.current?.focus({ preventScroll: true }); setOpenMenu(null); modelDoctorCommand.run(); }}><Wrench size={16} /> {modelDoctorCommand.label}</button>
                  <button onClick={() => { setOpenMenu(null); setProposalAssistantOpen(true); }}><Sparkles size={16} /> {phase2T('proposal.menuLabel')}</button>
                  {/* Datasheet degrada a icono-only y luego a este desbordamiento antes
                      de tocar Estado/Doctor (orden de degradación · CRI-95). */}
                  <button className="overflow-results" onClick={() => { resultsCommand.run(); setOpenMenu(null); }}><ChartNoAxesCombined size={16} /> {resultsCommand.label}</button>
                  <button className="overflow-datasheet" onClick={() => { datasheetCommand.run(); setOpenMenu(null); }}><Sheet size={16} /> {datasheetCommand.label}</button>
                  {/* Los mismos campos que el popover de la barra, no una
                      segunda copia: una sola definición consumida por las dos
                      presentaciones. En el desbordamiento, elegir cierra. */}
                  <AnalysisContextFields onCommit={() => setOpenMenu(null)} />
                </div>

                <div className="menu-section">
                  <div className="menu-section-title">{t('menu.sectionPreferences')}</div>
                  <label className="mobile-menu-field"><span>{t('language.label')}</span><select value={language} onChange={(event) => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, language: event.target.value as 'es' | 'en' } }))}><option value="es">{t('language.es')}</option><option value="en">{t('language.en')}</option></select></label>
                  <button onClick={() => { themeCommand.run(); setOpenMenu(null); }}><ThemeIcon size={16} /> {themeCommand.label}</button>
                </div>

                {layoutActions ? <div className="menu-section overflow-layout-actions" role="group" aria-label={t('shell.viewLayout')}>
                  <div className="menu-section-title">{t('menu.sectionViews')}</div>
                  {onOpenSpace3D ? <button onClick={() => { onOpenSpace3D(); setOpenMenu(null); }}>
                    <Box size={16} /> {t('space3d.open')}
                  </button> : null}
                  <button onClick={() => { layoutActions.onToggleInspector(); setOpenMenu(null); }}>
                    {layoutActions.inspectorCollapsed || layoutActions.fullCanvas ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
                    {layoutActions.inspectorCollapsed || layoutActions.fullCanvas ? t('shell.showInspector') : t('shell.hideInspector')}
                  </button>
                  <button onClick={() => { layoutActions.onToggleFullCanvas(); setOpenMenu(null); }}>
                    {layoutActions.fullCanvas ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    {layoutActions.fullCanvas ? t('shell.exitFullCanvas') : t('shell.fullCanvas')}
                  </button>
                </div> : null}

                <div className="menu-section">
                  <div className="menu-section-title">{t('menu.sectionExport')}</div>
                  <button onClick={() => { exportJsonCommand.run(); setOpenMenu(null); }}><Save size={16} /> {exportJsonCommand.label}</button>
                  <button onClick={() => void handleSaveToDisk()}><HardDriveDownload size={16} /> {t('export.saveToDisk')}</button>
                  <button onClick={() => void handleCopyJson()}><Copy size={16} /> {t('export.copyData')}</button>
                  <button onClick={() => void handleShare()}><Share2 size={16} /> {t('export.share')}</button>
                  <button disabled={isAnalyzing || portableExport !== null} onClick={() => void exportPortable('pdf')}><FileText size={16} /> {portableExportLabel('pdf')}</button>
                  <button disabled={isAnalyzing || portableExport !== null} onClick={() => void exportPortable('bundle')}><FileArchive size={16} /> {portableExportLabel('bundle')}</button>
                  <button onClick={() => { exportSvgCommand.run(); setOpenMenu(null); }}><Download size={16} /> {exportSvgCommand.label}</button>
                  <button onClick={() => { exportPngCommand.run(); setOpenMenu(null); }}><Download size={16} /> {exportPngCommand.label}</button>
                  <button onClick={() => { exportPrintCommand.run(); setOpenMenu(null); }}>{exportPrintCommand.label}</button>
                </div>

                {/* El chip de persistencia de la Cinta (zona `status`) ya es la
                    única región `aria-live` de este estado; este es su duplicado
                    visible del desbordamiento y no vuelve a anunciarse solo. */}
                <div className={`mobile-storage-state ${storageHasError || storageState === 'offline' ? 'error' : ''}`} data-storage-state={storageState}>{storageHasError || storageState === 'offline' ? <CloudOff size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}<span><strong>{storageLabel}</strong><small>{storageDescription}</small></span></div>
                {exportError ? <div className="portable-export-error" role="alert">{exportError}</div> : null}

                {/* El aviso profesional. Ocupaba 22 px de alto en CADA pantalla
                    y en las tres composiciones, siempre; a cambio nadie lo lee
                    después de la primera vez. Aquí sigue alcanzable en un gesto
                    y sin cobrarle alto al lienzo, y sigue entero donde de
                    verdad se lee: la entrada del producto y la memoria de
                    cálculo que alguien va a firmar. */}
                <p className="menu-professional-note">{t('app.professionalNote')}</p>
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
          leadingIcon={<Play size={16} fill="currentColor" />}
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
          <Wrench size={16} aria-hidden="true" />
          <span>{modelDoctorCommand.label}</span>
        </button>
        <DesignStandardSelector />
        <AnalysisStatus
          projectId={project.id}
          analysis={analysis}
          isAnalyzing={isAnalyzing}
          onOpenModelDoctor={openModelDoctor}
        />
      </div>
      {exportError && showExportMenu ? <div className="portable-export-error desktop" role="alert">{exportError}</div> : null}
      {importCenterOpen ? <LazySurface><PortableImportCenter
        open
        currentProjectName={project.name}
        onClose={closeImportCenter}
        onSaveCurrent={() => exportProjectJson(project)}
        onImported={(outcome) => {
          replaceProject({ ...outcome.project, settings: { ...outcome.project.settings, language } }, outcome.restoredAnalysis);
          closeImportCenter();
        }}
      /></LazySurface> : null}
      {proposalAssistantOpen ? <LazySurface><ProposalAssistant
        open
        onClose={() => setProposalAssistantOpen(false)}
      /></LazySurface> : null}
      {previewAnalysis ? <LazySurface><PdfPreviewDialog
        open
        onOpenChange={(next) => { if (!next) setPreviewAnalysis(null); }}
        t={t as (key: string, values?: Record<string, string | number>) => string}
        buildReport={async (contentOptions) => {
          const portable = await import('../../utils/portable');
          return portable.createCalculationReport(project, previewAnalysis, {
            appVersion: APP_VERSION,
            scenarioName,
            scenarioFactors,
            ...contentOptions,
          });
        }}
        openDocument={async (bytes) => {
          const { openPreviewDocument } = await import('../import-export/pdfPageRenderer');
          return openPreviewDocument(bytes);
        }}
        onDownload={async (artifact) => {
          const portable = await import('../../utils/portable');
          await portable.shareOrDownloadPortableBytes(artifact.bytes, artifact.filename, 'application/pdf', t('portable.reportShareTitle', { name: project.name }));
          emitWorkspaceCommand('show-toast', { message: t('export.completed'), description: project.name, tone: 'success' });
        }}
      /></LazySurface> : null}
    </header>
  );
};

/**
 * Las cuatro decisiones de análisis —caso o combinación, modo de cálculo, orden
 * y unidades—, definidas UNA vez.
 *
 * Vivían duplicadas: cuatro `<select>` rotulados en la barra para escritorio y
 * otros cuatro idénticos dentro del menú de desbordamiento para compacto, cada
 * juego con su propia copia del manejador. Dos definiciones de la misma
 * decisión divergen en cuanto alguien toca una — y ya lo habían hecho: la
 * versión de la barra no cerraba nada al cambiar y la del desbordamiento sí,
 * sin que ninguna regla dijera por qué. Ahora la diferencia es un parámetro.
 *
 * `data-context-control` viaja con cada campo: es lo que `TopBar.test.tsx` usa
 * para contar que las cuatro decisiones siguen alcanzables, esté donde esté el
 * campo. Las clases `combination-select`/`mode-select`/`analysis-order-select`/
 * `units-select` se conservan porque `qa.mjs` lee sus valores en Chromium real.
 */
const AnalysisContextFields = ({ onCommit }: { onCommit?: () => void }) => {
  const { project, updateProjectView, updateProjectAnalysisSettings } = useProjectModel();
  const { selectedCombinationId, setSelectedCombinationId } = useProjectAnalysis();
  const { t } = useI18n();
  const analysisMode = project.settings.analysisMode ?? 'first-order';
  // La aplicabilidad depende de la geometría, así que se recalcula cuando el modelo cambia:
  // una viga editada hasta volverse marco deja de ofrecer la doble integración sola.
  const methods = useMemo(() => applicableMethods(project), [project]);

  return <>
    <label className="mobile-menu-field topbar-context-field overflow-case" data-context-control="scenario">
      <span>{t('analysis.caseOrCombination')}</span>
      <select
        className="combination-select"
        value={selectedCombinationId}
        onChange={(event) => setSelectedCombinationId(event.target.value)}
      >
        <option value="">{t('analysis.activeCases')}</option>
        {project.combinations.map((combination) => <option key={combination.id} value={combination.id}>{combination.name}</option>)}
      </select>
    </label>

    <label className="mobile-menu-field topbar-context-field overflow-mode" data-context-control="mode">
      <span>{t('analysis.mode')}</span>
      <select
        className="mode-select"
        value={project.settings.calculationMode ?? 'complete'}
        onChange={(event) => {
          updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, calculationMode: event.target.value as 'complete' | 'classroom' } }));
          onCommit?.();
        }}
      >
        <option value="classroom">{t('analysis.modeClassroom')}</option>
        <option value="complete">{t('analysis.modeComplete')}</option>
      </select>
    </label>

    <label className="mobile-menu-field topbar-context-field overflow-analysis-order" data-context-control="order">
      <span>{t('analysis.order')}</span>
      <select
        className="analysis-order-select"
        value={analysisMode}
        onChange={(event) => {
          updateProjectAnalysisSettings((settings) => ({ ...settings, analysisMode: event.target.value as 'first-order' | 'p-delta' }));
          onCommit?.();
        }}
      >
        <option value="first-order">{t('analysis.orderFirst')}</option>
        <option value="p-delta">{t('analysis.orderPDelta')}</option>
      </select>
    </label>

    {analysisMode === 'p-delta' ? <PDeltaAdvancedConfig /> : null}

    {/* Sólo se ofrecen los métodos que de verdad aplican a esta estructura: la doble
        integración no significa nada en un marco ni en una armadura, y un selector que
        ofrece lo que luego no puede honrar es peor que uno que se calla. Con un único
        método aplicable el control se oculta, porque no habría nada que elegir. */}
    {methods.length > 1 ? (
      <label className="mobile-menu-field topbar-context-field overflow-method" data-context-control="method">
        <span>{t('method.label')}</span>
        <select
          className="method-select"
          value={resolveSolutionMethod(project)}
          onChange={(event) => {
            updateProjectView((draft) => ({
              ...draft,
              settings: { ...draft.settings, solutionMethod: event.target.value as SolutionMethodId },
            }));
            onCommit?.();
          }}
        >
          {methods.map((method) => (
            <option key={method.id} value={method.id}>{t(method.labelKey as TranslationKey)}</option>
          ))}
        </select>
      </label>
    ) : null}

    <label className="mobile-menu-field topbar-context-field overflow-units" data-context-control="units">
      <span>{t('units.label')}</span>
      <select
        className="units-select"
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
  </>;
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
