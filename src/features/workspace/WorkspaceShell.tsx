import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
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
import { createPersistedEditorLayerState, editorLayerReducer, persistEditorLayerState } from '../canvas/editorLayers';
import { AppShellLayout } from './AppShellLayout';
import { useWorkspaceLayoutPreferences } from './useWorkspaceLayoutPreferences';
import '../../design-system/components/ui.css';
import { emitWorkspaceCommand, onWorkspaceCommand } from './workspaceCommands';

export const WorkspaceShell = ({ onOpenHome, projectId }: { onOpenHome: () => void; projectId: string }) => {
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [editorLayers, dispatchEditorLayers] = useReducer(editorLayerReducer, undefined, createPersistedEditorLayerState);
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const inspectorReturnFocusRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const { project, analysis, setActiveTool, analyze } = useProject();
  const { preferences: layout, setPreference, togglePreference } = useWorkspaceLayoutPreferences();

  useEffect(() => persistEditorLayerState(editorLayers), [editorLayers]);

  const closeMobileInspector = useCallback(() => {
    setMobileInspectorOpen(false);
    window.requestAnimationFrame(() => {
      const remembered = inspectorReturnFocusRef.current;
      const returnTarget = remembered?.isConnected ? remembered : inspectorToggleRef.current;
      returnTarget?.focus({ preventScroll: true });
    });
  }, []);

  const openMobileInspector = useCallback(() => {
    const activeElement = document.activeElement;
    inspectorReturnFocusRef.current = activeElement instanceof HTMLElement
      && activeElement !== document.body
      && activeElement !== document.documentElement
      ? activeElement
      : inspectorToggleRef.current;
    emitWorkspaceCommand('collapse-mobile-results');
    setMobileInspectorOpen(true);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 1024px)');
    if (!desktop) return undefined;
    const syncBreakpoint = () => {
      if (desktop.matches) setMobileInspectorOpen(false);
    };
    desktop.addEventListener?.('change', syncBreakpoint);
    return () => desktop.removeEventListener?.('change', syncBreakpoint);
  }, []);

  useEffect(() => {
    return onWorkspaceCommand('expand-mobile-results', () => setMobileInspectorOpen(false));
  }, []);

  useEffect(() => {
    if (!mobileInspectorOpen) return undefined;
    const background = shellRef.current?.querySelectorAll<HTMLElement>('.topbar, .toolbar, .center-stage');
    background?.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    return () => background?.forEach((element) => {
      element.inert = false;
      element.removeAttribute('aria-hidden');
    });
  }, [mobileInspectorOpen]);

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
  }, []);

  return <AppShellLayout
    ref={shellRef}
    projectId={projectId}
    skipLabel={t('shell.skipToCanvas')}
    inspectorCollapsed={layout.inspectorCollapsed}
    inspectorWidth={layout.inspectorWidth}
    fullCanvas={layout.fullCanvas}
    toolRailCompact={layout.toolRailCompact}
    topBar={<TopBar
      onOpenHome={onOpenHome}
      layoutActions={{
        inspectorCollapsed: layout.inspectorCollapsed,
        fullCanvas: layout.fullCanvas,
        toolRailCompact: layout.toolRailCompact,
        onToggleInspector: () => {
          setMobileInspectorOpen(false);
          if (layout.fullCanvas) {
            setPreference('fullCanvas', false);
            setPreference('inspectorCollapsed', false);
            return;
          }
          togglePreference('inspectorCollapsed');
        },
        onToggleFullCanvas: () => {
          setMobileInspectorOpen(false);
          togglePreference('fullCanvas');
        },
        onToggleToolRail: () => togglePreference('toolRailCompact'),
      }}
    />}
    toolRail={<ToolRail compact={layout.toolRailCompact} />}
    workspace={<>
        {project.settings.calculationMode === 'classroom' ? <ClassroomGuide className="classroom-workspace-journey" project={project} analysis={analysis} onChooseTool={setActiveTool} onAnalyze={analyze} /> : null}
        <StructuralCanvas layers={editorLayers} dispatchLayers={dispatchEditorLayers} onRequestInspector={() => {
          if (window.matchMedia('(max-width: 1023px)').matches) openMobileInspector();
        }} />
        <ResultsPanel />
        <ToastNotification />
      </>}
    backdrop={mobileInspectorOpen ? <button className="mobile-inspector-backdrop" aria-hidden="true" tabIndex={-1} onClick={closeMobileInspector} /> : null}
    inspector={<Inspector
      className={mobileInspectorOpen ? 'mobile-open' : ''}
      desktopWidth={layout.inspectorWidth}
      modal={mobileInspectorOpen}
      onClose={closeMobileInspector}
      onDesktopWidthChange={(width) => setPreference('inspectorWidth', width)}
    />}
    floatingActions={!mobileInspectorOpen ? <button
        ref={inspectorToggleRef}
        className="mobile-inspector-toggle"
        onClick={openMobileInspector}
        aria-label={t('inspector.open')}
        aria-expanded={mobileInspectorOpen}
        aria-controls="workspace-inspector"
      >
        <SlidersHorizontal size={20} />
      </button> : null}
    footer={<div className="professional-note">{t('app.professionalNote')}</div>}
  />;
};

export default WorkspaceShell;
