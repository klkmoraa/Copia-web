import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { LoaderCircle } from 'lucide-react';
import { BrandMark } from './features/topbar/BrandMark';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';
import { ProjectProvider } from './store/ProjectContext';
import { useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import { useI18n } from './i18n/useI18n';
import './styles.css';
import './design-system/material.css';
/* La biblioteca de componentes viaja en el chunk de ENTRADA, no sólo con la
   Mesa. La bienvenida monta `Drawer`, `Dialog` y `SegmentedControl`, y hasta
   aquí su hoja llegaba únicamente por `WorkspaceShell` —que es diferido—, así
   que esas tres superficies se pintaban sin materia hasta que ganaba la
   carrera del precalentamiento. */
import './design-system/components/ui.css';

const loadWorkspaceShell = () => import('./features/workspace/WorkspaceShell');
const WorkspaceShell = lazy(loadWorkspaceShell);
// Space 3D es la única superficie 3D del producto: su dominio, su worker y
// Three.js sólo entran en el grafo cuando el usuario abre la pantalla.
const loadSpace3DWorkspace = () => import('./features/space3d/Space3DWorkspace');
const Space3DWorkspace = lazy(loadSpace3DWorkspace);
const PwaUpdateNotice = lazy(() => import('./platform/PwaUpdateNotice').then((module) => ({ default: module.PwaUpdateNotice })));

export type AppScreen = 'welcome' | 'workspace' | 'space3d';

/**
 * De dónde se abrió Space 3D. Desde la mesa 2D se abre el proyecto actual
 * convertido al dominio espacial; desde Inicio, un modelo espacial propio.
 */
type Space3DOrigin = 'workspace' | 'standalone';

const AppShell = () => {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [space3dOrigin, setSpace3DOrigin] = useState<Space3DOrigin>('standalone');
  /**
   * CRI-104 · el salto directo a la Mesa de quien ya tiene proyectos guardados
   * se ofrece UNA vez por sesión. Después, volver a Inicio tiene que llevar de
   * verdad a Inicio: si el salto se repitiera, el botón de Inicio dejaría de
   * dar acceso a ejemplos, Aula, importación y recuperación. No se persiste
   * nada — al recargar, la decisión vuelve a salir del repositorio.
   */
  const [directResumeAvailable, setDirectResumeAvailable] = useState(true);
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

  const navigate = (next: AppScreen) => {
    setScreen(next);
  };

  const renderScreen = () => {
    if (screen === 'welcome') {
      return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}><WelcomeScreen
        onOpenWorkspace={() => navigate('workspace')}
        onOpenSpace3D={() => { setSpace3DOrigin('standalone'); navigate('space3d'); }}
        onPreloadWorkspace={() => { void loadWorkspaceShell(); }}
        allowDirectResume={directResumeAvailable}
        onDirectResume={() => setDirectResumeAvailable(false)}
      /></ClassroomSessionProvider>;
    }

    if (screen === 'space3d') {
      // Space 3D no se envuelve en ClassroomSessionProvider: su modelo no es el
      // proyecto 2D y el Modo Aula no lo evalúa.
      return (
        <Suspense fallback={<div className="workspace-loading" role="status" aria-label={t('space3d.loading')}><BrandMark size={42} /><LoaderCircle className="spin" size={22} /></div>}>
          <Space3DWorkspace
            language={project.settings.language}
            sourceProject={space3dOrigin === 'workspace' ? project : undefined}
            onOpenHome={() => navigate('welcome')}
            onOpen2D={() => navigate('workspace')}
          />
        </Suspense>
      );
    }

    return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
      <Suspense fallback={<div className="workspace-loading" role="status" aria-label={t('workspace.loading')}><BrandMark size={42} /><LoaderCircle className="spin" size={22} /></div>}>
        <WorkspaceShell projectId={project.id} onOpenHome={() => navigate('welcome')} onOpenSpace3D={() => { setSpace3DOrigin('workspace'); navigate('space3d'); }} />
      </Suspense>
    </ClassroomSessionProvider>;
  };

  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <m.div key={screen} className="app-screen-frame" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
        {renderScreen()}
      </m.div>
    </AnimatePresence>
  );
};

export default function App() {
  return <ProjectProvider><AppShell /><Suspense fallback={null}><PwaUpdateNotice /></Suspense></ProjectProvider>;
}
