import { lazy, Suspense, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { BrandMark } from './features/topbar/BrandMark';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';
import { ProjectProvider } from './store/ProjectContext';
import { useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import { useI18n } from './i18n/useI18n';
import './styles.css';
import './design-system/material.css';

const loadWorkspaceShell = () => import('./features/workspace/WorkspaceShell');
const WorkspaceShell = lazy(loadWorkspaceShell);

const AppShell = () => {
  const [screen, setScreen] = useState<'welcome' | 'workspace'>('welcome');
  const { project, analysis } = useProject();
  const { t } = useI18n();

  useEffect(() => {
    document.documentElement.lang = project.settings.language;
  }, [project.settings.language]);

  useEffect(() => {
    const preload = () => { void loadWorkspaceShell(); };
    const idleWindow = window as Window & { requestIdleCallback?: typeof window.requestIdleCallback };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preload, { timeout: 1800 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(preload, 700);
    return () => window.clearTimeout(handle);
  }, []);

  const navigate = (next: 'welcome' | 'workspace') => {
    setScreen(next);
  };

  if (screen === 'welcome') {
    return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}><WelcomeScreen onOpenWorkspace={() => navigate('workspace')} onPreloadWorkspace={() => { void loadWorkspaceShell(); }} /></ClassroomSessionProvider>;
  }

  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    <Suspense fallback={<div className="workspace-loading" role="status" aria-label={t('workspace.loading')}><BrandMark size={42} /><LoaderCircle className="spin" size={22} /></div>}>
      <WorkspaceShell projectId={project.id} onOpenHome={() => navigate('welcome')} />
    </Suspense>
  </ClassroomSessionProvider>;
};

export default function App() {
  return <ProjectProvider><AppShell /></ProjectProvider>;
}
