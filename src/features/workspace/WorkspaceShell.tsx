import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Inspector } from '../inspector/Inspector';
import type { InspectorSegment } from '../inspector/inspectorSegments';
import { StructuralCanvas } from '../canvas/StructuralCanvas';
import { ToolRail } from '../canvas/ToolRail';
import { TopBar } from '../topbar/TopBar';
import { ClassroomGuide } from '../classroom/ClassroomGuide';
import { ToastNotification } from './ToastNotification';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { createPersistedEditorLayerState, editorLayerReducer, persistEditorLayerState } from '../canvas/editorLayers';
import { AppShellLayout } from './AppShellLayout';
import { ShellCompositionProvider } from './ShellCompositionProvider';
import { SurfacePresentationProvider } from './SurfacePresentationProvider';
import { useShellComposition } from './useShellComposition';
import { useSurfacePresentation } from './useSurfacePresentation';
import { normalizeInspectorDetent, useWorkspaceLayoutPreferences } from './useWorkspaceLayoutPreferences';
import type { DataSurfaceTab } from '../data/dataSurface';
import type { SurfaceId } from './surfacePresentation';
import '../../design-system/components/ui.css';
import './phase1.css';
import { emitWorkspaceCommand, onWorkspaceCommand } from './workspaceCommands';
import { isOwnHistoryScope } from './commandRegistry';

const LazyCommandPalette = lazy(() => import('./CommandPalette').then((module) => ({ default: module.CommandPalette })));
const LazyDataSurface = lazy(() => import('../data/DataSurface.tsx').then((module) => ({ default: module.DataSurface })));

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
  const modelDoctorToastRef = useRef<{ projectId: string; signature: string }>({ projectId, signature: '' });
  const { t } = useI18n();
  const { project, analysis, setActiveTool, setResultTab, analyze, undo, redo, canUndo, canRedo } = useProject();
  const { preferences: layout, setPreference, togglePreference } = layoutController;
  const { shellClass } = useShellComposition();
  const broker = useSurfacePresentation();
  const { openSurface, closeSurface, toggleSurface, markSurfaceReady, setSurfaceExtent } = broker;
  const detail = broker.stateFor('detail');
  /** Segmento visible del panel derecho; un comando puede apuntarlo. */
  const [detailSegment, setDetailSegment] = useState<InspectorSegment>('detail');
  const data = broker.stateFor('data');
  /** Pestaña visible de «Datos»; el comando de apertura la apunta. */
  const [dataTab, setDataTab] = useState<DataSurfaceTab>('results');
  const palette = broker.stateFor('palette');

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
      onWorkspaceCommand('open-detail', (request) => {
        if (request?.segment) setDetailSegment(request.segment);
        openSurface('detail', request?.trigger);
      }),
      /* «Datos» es invocada: el lanzador viaja en el comando para que el broker
         sepa a dónde devolver el foco al cerrar.

         `resultTab` es la única carga útil que sale de la superficie: la lectura
         de influencia vive TAMBIÉN en el lienzo —`CanvasResultLayer` gatea su
         overlay con `resultTab === 'influence'`, el mismo campo que `analyze()`
         mueve a 'issues'/'summary'—, así que pedir esa lectura tiene que
         escribirla, no sólo abrir la pestaña. */
      onWorkspaceCommand('open-data', (request) => {
        if (request?.tab) setDataTab(request.tab);
        if (request?.resultTab) setResultTab(request.resultTab);
        openSurface('data', request?.trigger);
      }),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [openSurface, setResultTab]);

  useEffect(() => {
    setModelDoctorAcknowledgedIds(new Set());
    (['data', 'palette'] as const).forEach((surface) => closeSurface(surface));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
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
      modelDoctorToastRef.current = { projectId: project.id, signature };
      if (report.total === 0 || signature === previous) return;
      emitWorkspaceCommand('show-toast', {
        message: t('modelDoctor.toastTitle'),
        description: t('modelDoctor.toastDescription'),
        tone: 'warning',
      });
    });
    return () => { current = false; };
  }, [project, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      // «Datos» tiene su propia edición dentro (la rejilla de la Tabla): la
      // paleta no se abre encima de ella.
      if (data.status === 'active') return;
      event.preventDefault();
      toggleSurface('palette', document.activeElement instanceof HTMLElement ? document.activeElement : null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data.status, toggleSurface]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Y drive the same undo/redo the history buttons use
  // (G-01 · CRI-103) — but never with focus in a text field, the Datasheet
  // grid, or any modal surface with its own editing history: the worst case is
  // silently undoing a model operation while the user meant to undo a cell.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      const isUndo = key === 'z';
      const isRedo = key === 'y';
      if (!isUndo && !isRedo) return;
      if (isOwnHistoryScope(event.target)) return;
      if (isUndo) {
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

  const setDataOpen = useCallback((open: boolean, trigger?: HTMLElement | null) => {
    if (open) openSurface('data', trigger);
    else closeSurface('data');
  }, [closeSurface, openSurface]);
  const markDataReady = useCallback((ready: boolean) => markSurfaceReady('data', ready), [markSurfaceReady]);
  // "Localizar" degrada a `peek`, nunca cierra (CRI-102 / D-11). Era el mismo
  // mecanismo duplicado en Datasheet y Doctor; con una sola superficie es uno.
  const peekData = useCallback(() => setSurfaceExtent('data', 'peek'), [setSurfaceExtent]);
  const restoreData = useCallback(() => setSurfaceExtent('data', 'default'), [setSurfaceExtent]);

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
          if (detail.open) {
            closeSurface('detail');
            setPreference('inspectorCollapsed', true);
          } else {
            openSurface('detail');
            setPreference('inspectorCollapsed', false);
          }
        },
        onToggleFullCanvas: () => {
          if (!layout.fullCanvas) {
            closeSurface('detail');
            closeSurface('data');
          } else if (!layout.inspectorCollapsed) {
            // «Datos» no es residente en ninguna clase, así que salir de lienzo
            // completo no la recupera; sólo vuelve el panel que el usuario
            // tenía abierto.
            openSurface('detail');
          }
          togglePreference('fullCanvas');
        },
      }}
    />}
    toolRail={<ToolRail />}
    workspace={<>
      {project.settings.calculationMode === 'classroom' ? <ClassroomGuide className="classroom-workspace-journey" project={project} analysis={analysis} onChooseTool={setActiveTool} onAnalyze={analyze} /> : null}
      <StructuralCanvas layers={editorLayers} dispatchLayers={dispatchEditorLayers} onRequestInspector={() => openSurface('detail')} />
      <ToastNotification />
      {broker.isRetained('palette') ? <Suspense fallback={null}><LazyCommandPalette
        open={palette.status === 'active'}
        onClose={() => closeSurface('palette')}
        dispatchLayers={dispatchEditorLayers}
        presentation={palette.presentation as 'overlay' | 'sheet'}
      /></Suspense> : null}
      {/* Invocada, nunca residente: sólo existe en el árbol mientras el broker
          la retiene, y desaparece al cerrarse. Era el contrato de `dense`
          (CRI-101) y ahora vale para las tres pestañas: abrir «Datos» no monta
          la Hoja de datos ni el Doctor si el usuario está en Resultados. */}
      {broker.isRetained('data') ? <Suspense fallback={<span className="sr-only" role="status">{t('results.denseLoading')}</span>}><LazyDataSurface
        open={data.status === 'active'}
        tab={dataTab}
        onTabChange={setDataTab}
        onOpenChange={setDataOpen}
        presentation={data.presentation as 'drawer' | 'fullscreen'}
        onSurfaceReady={markDataReady}
        extent={data.extent}
        onPeek={peekData}
        onRestore={restoreData}
        acknowledgedIds={modelDoctorAcknowledgedIds}
        onAcknowledgedIdsChange={setModelDoctorAcknowledgedIds}
      /></Suspense> : null}
    </>}
    inspector={<div className="workspace-surfaces">
      {broker.isRetained('detail') ? <Inspector
        className={detail.presentation === 'sheet' && detail.status === 'active' ? 'mobile-open' : ''}
        desktopWidth={layout.inspectorWidth}
        presentation={detail.presentation as 'dock' | 'inset' | 'sheet'}
        status={detail.status}
        segment={detailSegment}
        onSegmentChange={setDetailSegment}
        onClose={() => closeSurface('detail')}
        onDesktopWidthChange={(width) => setPreference('inspectorWidth', width)}
        mobileDetent={layout.inspectorDetent}
        onMobileDetentChange={(detent) => setPreference('inspectorDetent', detent)}
      /> : null}
    </div>}
    floatingActions={<div className="workspace-surface-launcher">
      {/* Un destino, un lanzador. Antes habia tres botones aqui —Cargas, Vista
          y Resultados— duplicando el pie del riel y los segmentos del propio
          panel. Cargas y Vista son segmentos, no destinos; Resultados se pide
          desde la barra superior y desde la paleta. */}
      <button className="mobile-inspector-toggle" onClick={(event) => openSurface('detail', event.currentTarget)} aria-label={t('inspector.open')} aria-expanded={detail.status === 'active'} aria-controls="workspace-detail"><SlidersHorizontal size={20} /></button>
    </div>}
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
    // En K0 el detalle no es un dock: es una hoja que ocupa 58dvh desde el
    // borde inferior, así que nacer abierta tapa el lienzo Y la bandeja de
    // herramientas entera — la sesión empieza sin nada con lo que dibujar.
    // `inspectorCollapsed` es además una preferencia de la mesa ancha (viaja
    // con `inspectorWidth`), no una decisión que el teléfono haya tomado. Aquí
    // vale lo mismo que para «Datos» y «Resultados» (CRI-100/CRI-101): se pide
    // —desde el lanzador flotante que existe sólo en K0—, no se hereda abierta.
    if (shellClass === 'K0') return [];
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
