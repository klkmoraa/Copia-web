import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Inspector } from '../inspector/Inspector';
import { ResultsPanel } from '../results/ResultsPanel';
import { StructuralCanvas } from '../canvas/StructuralCanvas';
import { ToolRail } from '../canvas/ToolRail';
import { TopBar } from '../topbar/TopBar';
import { ClassroomGuide } from '../classroom/ClassroomGuide';
import { ToastNotification } from './ToastNotification';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { analysisSignature } from '../../engine/projectSignature';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { createPersistedEditorLayerState, editorLayerReducer, persistEditorLayerState } from '../canvas/editorLayers';
import { AppShellLayout } from './AppShellLayout';
import { ShellCompositionProvider } from './ShellCompositionProvider';
import { SurfacePresentationProvider } from './SurfacePresentationProvider';
import { useShellComposition } from './useShellComposition';
import { useSurfacePresentation } from './useSurfacePresentation';
import { normalizeInspectorDetent, useWorkspaceLayoutPreferences } from './useWorkspaceLayoutPreferences';
import { preloadDenseResultsSurface, type DenseResultView } from '../results/denseResults';
import type { SurfaceId } from './surfacePresentation';
import '../../design-system/components/ui.css';
import './phase1.css';
import { emitWorkspaceCommand, onWorkspaceCommand } from './workspaceCommands';
import { isOwnHistoryScope, resolveHistoryAction } from './commandRegistry';

const LazyCommandPalette = lazy(() => import('./CommandPalette').then((module) => ({ default: module.CommandPalette })));
const LazyModelDoctor = lazy(() => import('../model-doctor/ModelDoctor').then((module) => ({ default: module.ModelDoctor })));
const LazyDatasheet = lazy(() => import('../datasheet/DatasheetPanel').then((module) => ({ default: module.DatasheetPanel })));
const LazyDenseResults = lazy(() => preloadDenseResultsSurface());

type WorkspaceShellProps = { onOpenHome: () => void; onOpenSpace3D: () => void; projectId: string };
type LayoutController = ReturnType<typeof useWorkspaceLayoutPreferences>;

const WorkspaceBrokerContent = ({
  onOpenHome,
  onOpenSpace3D,
  projectId,
  shellRef,
  layoutController,
}: WorkspaceShellProps & {
  shellRef: RefObject<HTMLDivElement | null>;
  layoutController: LayoutController;
}) => {
  const [modelDoctorAcknowledgedIds, setModelDoctorAcknowledgedIds] = useState<Set<string>>(() => new Set());
  const [editorLayers, dispatchEditorLayers] = useReducer(editorLayerReducer, undefined, createPersistedEditorLayerState);
  const modelDoctorToastRef = useRef<{ projectId: string; model: string; signature: string }>({ projectId, model: '', signature: '' });
  const { t } = useI18n();
  const { project, analysis, setActiveTool, setResultTab, analyze, undo, redo, canUndo, canRedo } = useProject();
  const { activeTool } = useWorkspaceUI();
  const { preferences: layout, setPreference, togglePreference } = layoutController;
  const { shellClass } = useShellComposition();
  const broker = useSurfacePresentation();
  const { openSurface, closeSurface, toggleSurface, markSurfaceReady, setSurfaceExtent } = broker;
  const detail = broker.stateFor('detail');
  const analysisSetup = broker.stateFor('analysisSetup');
  const view = broker.stateFor('view');
  const results = broker.stateFor('results');
  const dense = broker.stateFor('dense');
  const [denseView, setDenseView] = useState<DenseResultView>('reactions');
  const datasheet = broker.stateFor('datasheet');
  const doctor = broker.stateFor('doctor');
  const palette = broker.stateFor('palette');

  /**
   * Abrir y cerrar el Inspector de detalle, definido UNA vez.
   *
   * Había dos fuentes de verdad para lo mismo —`detail.open` del broker y
   * `layout.inspectorCollapsed`, que es la que se persiste— y sólo el
   * interruptor de la barra superior escribía las dos. Abrir el Inspector desde
   * el lienzo o desde el lanzador flotante dejaba `inspectorCollapsed` en
   * `true`, así que al salir de lienzo completo el panel NO volvía —la rama
   * `else if (!layout.inspectorCollapsed)` leía el valor rancio— y ese mismo
   * valor era el que se guardaba para la siguiente sesión.
   */
  const openDetail = useCallback((trigger?: HTMLElement) => {
    openSurface('detail', trigger);
    setPreference('inspectorCollapsed', false);
  }, [openSurface, setPreference]);
  const closeDetail = useCallback(() => {
    closeSurface('detail');
    setPreference('inspectorCollapsed', true);
  }, [closeSurface, setPreference]);
  const toggleDetail = useCallback((trigger?: HTMLElement) => {
    if (detail.open) closeDetail(); else openDetail(trigger);
  }, [closeDetail, detail.open, openDetail]);

  useEffect(() => persistEditorLayerState(editorLayers), [editorLayers]);

  useEffect(() => {
    const normalizeDetent = () => {
      const next = normalizeInspectorDetent(layout.inspectorDetent, {
        width: window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
      });
      if (next !== layout.inspectorDetent) setPreference('inspectorDetent', next);
    };
    normalizeDetent();
    window.addEventListener('resize', normalizeDetent);
    window.addEventListener('orientationchange', normalizeDetent);
    window.visualViewport?.addEventListener('resize', normalizeDetent);
    return () => {
      window.removeEventListener('resize', normalizeDetent);
      window.removeEventListener('orientationchange', normalizeDetent);
      window.visualViewport?.removeEventListener('resize', normalizeDetent);
    };
  }, [layout.inspectorDetent, setPreference]);

  useEffect(() => {
    const subscriptions = [
      onWorkspaceCommand('open-command-palette', () => openSurface('palette')),
      onWorkspaceCommand('open-model-doctor', () => openSurface('doctor')),
      onWorkspaceCommand('open-datasheet', () => openSurface('datasheet')),
      onWorkspaceCommand('open-results', () => openSurface('results')),
      /* `dense` es invocada: el lanzador viaja en el propio comando para que el
         broker sepa a dónde devolver el foco al cerrar.
         `influence` es además el único de los tres cuya lectura vive también
         en el lienzo (CanvasResultLayer gatea el overlay de influencia con
         `resultTab === 'influence'`, el mismo campo que `analyze()` ya mueve
         a 'issues'/'summary'). CRI-101 dejó esa lectura sin quien la ponga:
         el resto de superficies densas no tienen lectura en el lienzo, así
         que no necesitan tocar `resultTab`. */
      onWorkspaceCommand('open-dense-results', ({ view: requestedView, trigger }) => {
        setDenseView(requestedView);
        if (requestedView === 'influence') setResultTab('influence');
        openSurface('dense', trigger);
      }),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [openSurface]);

  useEffect(() => {
    setModelDoctorAcknowledgedIds(new Set());
    (['dense', 'datasheet', 'doctor', 'palette'] as const).forEach((surface) => closeSurface(surface));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /**
   * El aviso del Model Doctor sólo depende de lo que el Model Doctor LEE.
   *
   * Este efecto dependía de `project`, cuya identidad cambia en cada edición
   * —el store reparte un clon profundo por cambio—, así que cambiar de unidades,
   * de idioma, de capa visible o de escala de diagrama disparaba un `import()`
   * dinámico, un `buildModelDoctorReport` entero sobre todo el modelo, un
   * map+sort de los hallazgos y un `JSON.stringify`, en el hilo principal, para
   * llegar al mismo resultado. El ref sólo silenciaba el toast; el trabajo se
   * hacía igual.
   *
   * `analysisSignature` es la identidad de todo lo que el análisis —y con él el
   * diagnóstico— lee: geometría, apoyos, cargas y modo de cálculo. Está
   * memoizada por objeto de proyecto en un `WeakMap`, y el resto del producto ya
   * la calcula para cada cambio, así que aquí sale de la caché.
   */
  const modelSignature = analysisSignature(project);
  useEffect(() => {
    if (modelDoctorToastRef.current.projectId === project.id
      && modelDoctorToastRef.current.model === modelSignature) return undefined;
    let current = true;
    void import('../model-doctor/modelDoctorDiagnostics').then(({ buildModelDoctorReport }) => {
      if (!current) return;
      const report = buildModelDoctorReport(project);
      const signature = JSON.stringify(report.findings
        .map((finding) => ({
          id: finding.id,
          severity: finding.severity,
          affected: finding.affectedObjects.map((object) => `${object.kind}:${object.id}`).sort(),
        }))
        .sort((first, second) => first.id.localeCompare(second.id)));
      const previous = modelDoctorToastRef.current.projectId === project.id
        ? modelDoctorToastRef.current.signature
        : '';
      modelDoctorToastRef.current = { projectId: project.id, model: modelSignature, signature };
      if (report.total === 0 || signature === previous) return;
      emitWorkspaceCommand('show-toast', {
        message: t('modelDoctor.toastTitle'),
        description: t('modelDoctor.toastDescription'),
        tone: 'warning',
      });
    });
    return () => { current = false; };
    // `project` se lee dentro, pero lo que decide si hay que releerlo es su
    // firma: incluirlo en las dependencias reintroduciría el defecto entero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelSignature, project.id, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (datasheet.status === 'active' || doctor.status === 'active') return;
      event.preventDefault();
      toggleSurface('palette', document.activeElement instanceof HTMLElement ? document.activeElement : null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [datasheet.status, doctor.status, toggleSurface]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Y drive the same undo/redo the history buttons use
  // (G-01 · CRI-103) — but never with focus in a text field, the Datasheet
  // grid, or any modal surface with its own editing history: the worst case is
  // silently undoing a model operation while the user meant to undo a cell.
  //
  // ⌘⇧Z REHACE. Es el rehacer de macOS —la plataforma que este producto imita—
  // y estaba explícitamente rechazado: la guarda salía ante cualquier `shiftKey`
  // y sólo `Ctrl+Y`, que es la convención de Windows, llegaba a `redo()`. Un
  // usuario de Mac pulsaba el atajo que su sistema le enseñó y no pasaba nada.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveHistoryAction(event);
      if (!action) return;
      if (isOwnHistoryScope(event.target)) return;
      if (action === 'undo') {
        if (!canUndo) return;
        event.preventDefault();
        undo();
      } else {
        if (!canRedo) return;
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canRedo, canUndo, redo, undo]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const shell = shellRef.current;
    if (!viewport || !shell) return undefined;
    const syncViewport = () => {
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      shell.style.setProperty('--sc-visual-viewport-height', `${viewport.height}px`);
      shell.style.setProperty('--sc-visual-viewport-top', `${viewport.offsetTop}px`);
      shell.style.setProperty('--sc-visual-viewport-bottom', `${bottom}px`);
    };
    syncViewport();
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
    return () => {
      viewport.removeEventListener('resize', syncViewport);
      viewport.removeEventListener('scroll', syncViewport);
    };
  }, [shellRef]);

  const setResultsOpen = useCallback((open: boolean, trigger?: HTMLElement | null) => {
    if (open) openSurface('results', trigger);
    else closeSurface('results');
  }, [closeSurface, openSurface]);
  const setDatasheetOpen = useCallback((open: boolean) => {
    if (open) openSurface('datasheet');
    else closeSurface('datasheet');
  }, [closeSurface, openSurface]);
  const setDoctorOpen = useCallback((open: boolean) => {
    if (open) openSurface('doctor');
    else closeSurface('doctor');
  }, [closeSurface, openSurface]);
  const setDenseOpen = useCallback((open: boolean) => {
    if (open) openSurface('dense');
    else closeSurface('dense');
  }, [closeSurface, openSurface]);
  const markDenseReady = useCallback((ready: boolean) => markSurfaceReady('dense', ready), [markSurfaceReady]);
  const markDatasheetReady = useCallback((ready: boolean) => markSurfaceReady('datasheet', ready), [markSurfaceReady]);
  const markDoctorReady = useCallback((ready: boolean) => markSurfaceReady('doctor', ready), [markSurfaceReady]);
  // "Localizar" degrada a `peek`, nunca cierra (CRI-102 / D-11): mismo mecanismo
  // para Datasheet y Doctor, porque es el mismo hueco en las dos superficies.
  const peekDatasheet = useCallback(() => setSurfaceExtent('datasheet', 'peek'), [setSurfaceExtent]);
  const restoreDatasheet = useCallback(() => setSurfaceExtent('datasheet', 'default'), [setSurfaceExtent]);
  const peekDoctor = useCallback(() => setSurfaceExtent('doctor', 'peek'), [setSurfaceExtent]);
  const restoreDoctor = useCallback(() => setSurfaceExtent('doctor', 'default'), [setSurfaceExtent]);

  return <AppShellLayout
    ref={shellRef}
    projectId={projectId}
    skipLabel={t('shell.skipToCanvas')}
    shellClass={shellClass}
    inspectorCollapsed={!detail.open}
    inspectorWidth={layout.inspectorWidth}
    fullCanvas={layout.fullCanvas}
    topBar={<TopBar
      onOpenHome={onOpenHome}
      onOpenSpace3D={onOpenSpace3D}
      layoutActions={{
        inspectorCollapsed: !detail.open,
        fullCanvas: layout.fullCanvas,
        onToggleInspector: () => {
          if (layout.fullCanvas) setPreference('fullCanvas', false);
          toggleDetail();
        },
        onToggleFullCanvas: () => {
          if (!layout.fullCanvas) {
            closeSurface('detail');
            closeSurface('analysisSetup');
            closeSurface('view');
            closeSurface('results');
          } else if (!layout.inspectorCollapsed) {
            // Results stays non-resident even leaving full-canvas (CRI-100);
            // only the inspector, which the user had open, comes back.
            openSurface('detail');
          }
          togglePreference('fullCanvas');
        },
      }}
    />}
    toolRail={<ToolRail />}
    workspace={<>
      {project.settings.calculationMode === 'classroom' ? <ClassroomGuide className="classroom-workspace-journey" project={project} analysis={analysis} onChooseTool={setActiveTool} onAnalyze={analyze} /> : null}
      <StructuralCanvas layers={editorLayers} dispatchLayers={dispatchEditorLayers} onRequestInspector={() => openDetail()} />
      {broker.isRetained('results') ? <ResultsPanel
        presentation={results.presentation as 'dock' | 'inset' | 'sheet'}
        status={results.status}
        onOpenChange={setResultsOpen}
      /> : null}
      <ToastNotification />
      {broker.isRetained('palette') ? <Suspense fallback={null}><LazyCommandPalette
        open={palette.status === 'active'}
        onClose={() => closeSurface('palette')}
        dispatchLayers={dispatchEditorLayers}
        presentation={palette.presentation as 'overlay' | 'sheet'}
      /></Suspense> : null}
      {/* Invocada, nunca residente: sólo existe en el árbol mientras el broker
          la retiene, y desaparece al cerrarse (CRI-101). */}
      {broker.isRetained('dense') ? <Suspense fallback={<span className="sr-only" role="status">{t('results.denseLoading')}</span>}><LazyDenseResults
        open={dense.status === 'active'}
        view={denseView}
        onViewChange={setDenseView}
        onOpenChange={setDenseOpen}
        presentation={dense.presentation as 'drawer' | 'fullscreen'}
        onSurfaceReady={markDenseReady}
      /></Suspense> : null}
      {broker.isRetained('datasheet') ? <Suspense fallback={null}><LazyDatasheet
        open={datasheet.status === 'active'}
        onOpenChange={setDatasheetOpen}
        presentation={datasheet.presentation as 'drawer' | 'fullscreen'}
        onSurfaceReady={markDatasheetReady}
        extent={datasheet.extent}
        onPeek={peekDatasheet}
        onRestore={restoreDatasheet}
      /></Suspense> : null}
      {broker.isRetained('doctor') ? <Suspense fallback={<span className="sr-only" role="status">{t('modelDoctor.loading')}</span>}><LazyModelDoctor
        open={doctor.status === 'active'}
        onOpenChange={setDoctorOpen}
        onSurfaceReady={markDoctorReady}
        presentation={doctor.presentation as 'drawer' | 'fullscreen'}
        acknowledgedIds={modelDoctorAcknowledgedIds}
        onAcknowledgedIdsChange={setModelDoctorAcknowledgedIds}
        extent={doctor.extent}
        onPeek={peekDoctor}
        onRestore={restoreDoctor}
      /></Suspense> : null}
    </>}
    inspector={<div className="workspace-surfaces">
      {broker.isRetained('detail') ? <Inspector surface="detail" className={detail.presentation === 'sheet' && detail.status === 'active' ? 'mobile-open' : ''} desktopWidth={layout.inspectorWidth} presentation={detail.presentation as 'dock' | 'inset' | 'sheet'} status={detail.status} onClose={() => closeSurface('detail')} onDesktopWidthChange={(width) => setPreference('inspectorWidth', width)} mobileDetent={layout.inspectorDetent} onMobileDetentChange={(detent) => setPreference('inspectorDetent', detent)} /> : null}
      {broker.isRetained('analysisSetup') ? <Inspector surface="analysisSetup" className={analysisSetup.presentation === 'sheet' && analysisSetup.status === 'active' ? 'mobile-open' : ''} presentation={analysisSetup.presentation as 'dock' | 'inset' | 'sheet'} status={analysisSetup.status} onClose={() => closeSurface('analysisSetup')} mobileDetent={layout.inspectorDetent} onMobileDetentChange={(detent) => setPreference('inspectorDetent', detent)} activeTool={activeTool} onActiveToolChange={setActiveTool} /> : null}
      {broker.isRetained('view') ? <Inspector surface="view" className={view.presentation === 'sheet' && view.status === 'active' ? 'mobile-open' : ''} presentation={view.presentation as 'dock' | 'inset' | 'sheet'} status={view.status} onClose={() => closeSurface('view')} mobileDetent={layout.inspectorDetent} onMobileDetentChange={(detent) => setPreference('inspectorDetent', detent)} /> : null}
    </div>}
    floatingActions={<div className="workspace-surface-launcher">
      {/* Alterna. Antes sólo abría, pero anunciaba `aria-expanded="true"` en
          cuanto la superficie estaba activa: a un lector de pantalla se le
          prometía que pulsar lo plegaría, y no hacía nada. `aria-controls`
          apuntaba además a un id que no existe mientras la superficie no está
          retenida. */}
      <button className="mobile-inspector-toggle" onClick={(event) => toggleDetail(event.currentTarget)} aria-label={detail.open ? t('inspector.close') : t('inspector.open')} aria-expanded={detail.status === 'active'} aria-controls={broker.isRetained('detail') ? 'workspace-detail' : undefined}><SlidersHorizontal size={20} /></button>
      <button type="button" onClick={(event) => openSurface('analysisSetup', event.currentTarget)} aria-label={t('inspector.loadsTab')}>{t('inspector.loadsTab')}</button>
      <button type="button" onClick={(event) => openSurface('view', event.currentTarget)} aria-label={t('inspector.viewTab')}>{t('inspector.viewTab')}</button>
      {/* Results ya no es residente en ninguna clase (CRI-100): estado y
          fiabilidad viven siempre en el TopBar, N/V/M/deformada/mapa como capas
          del lienzo; este lanzador abre el panel sólo para lo que sigue siendo
          denso (resumen, reacciones, influencia, aprender). */}
      <button type="button" onClick={(event) => openSurface('results', event.currentTarget)} aria-label={t('results.outputs')}>{t('results.outputs')}</button>
    </div>}
    footer={<div className="professional-note">{t('app.professionalNote')}</div>}
  />;
};

const WorkspaceSurface = (props: WorkspaceShellProps) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const layoutController = useWorkspaceLayoutPreferences();
  const { shellClass } = useShellComposition();
  // Results is never resident, in any class (CRI-100): state and reliability
  // already live in the TopBar and evidence is a canvas layer, so the panel only
  // opens on request now — it no longer starts open by default.
  const initialOpen = useMemo<SurfaceId[]>(() => {
    if (layoutController.preferences.fullCanvas) return [];
    const surfaces: SurfaceId[] = [];
    if (!layoutController.preferences.inspectorCollapsed) surfaces.push('detail');
    return surfaces;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SurfacePresentationProvider shellClass={shellClass} initialOpen={initialOpen} backgroundRef={shellRef}>
    <WorkspaceBrokerContent {...props} shellRef={shellRef} layoutController={layoutController} />
  </SurfacePresentationProvider>;
};

export const WorkspaceShell = (props: WorkspaceShellProps) => (
  <ShellCompositionProvider><WorkspaceSurface {...props} /></ShellCompositionProvider>
);

export default WorkspaceShell;
