import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Compass,
  GraduationCap,
  LayoutTemplate,
  Layers,
  GitCommitHorizontal,
  Menu,
  Moon,
  Move3d,
  Play,
  Sun,
  Triangle,
  Upload,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { createBlankProject, exampleProjects } from '../../data/defaultProject';
import { useProject, useWorkspaceUI } from '../../store/ProjectContext';
import { exportProjectJson } from '../../utils/export';
import { useI18n } from '../../i18n/useI18n';
import { APP_VERSION } from '../../appVersion';
import { NewExerciseDialog } from './NewExerciseDialog';
import { BrandMark } from '../topbar/BrandMark';
import { StructuralPortalHero } from './StructuralPortalHero';
import { presentExample } from './examplePresentation';
import { shouldResumeDirectly, useWelcomeEntry } from './welcomeEntry';
import { Dialog, Drawer } from '../../design-system/components/overlays';
import { SegmentedControl } from '../../design-system/components/controls';
import type { TranslationKey } from '../../i18n/catalogs';

const PortableImportCenter = lazy(() => import('../import-export/PortableImportCenter').then((module) => ({ default: module.PortableImportCenter })));
const Phase2ProjectHub = lazy(() => import('./Phase2ProjectHub').then((module) => ({ default: module.Phase2ProjectHub })));
const Phase2DxfAction = lazy(() => import('./Phase2DxfAction').then((module) => ({ default: module.Phase2DxfAction })));

interface WelcomeScreenProps {
  onOpenWorkspace: () => void;
  onOpenSpace3D?: () => void;
  onPreloadWorkspace?: () => void;
  /**
   * `true` sólo en el PRIMER montaje de la sesión. Cuando alguien vuelve a
   * Inicio desde la Mesa, el shell lo pone en `false` y la bienvenida se queda
   * donde está: un salto automático en ese momento convertiría el botón de
   * Inicio en un botón que no lleva a ninguna parte, y eso sí escondería
   * capacidades reales (ejemplos, Aula, importación, recuperación).
   */
  allowDirectResume?: boolean;
  /** Avisa al shell de que el salto ya se consumió. */
  onDirectResume?: () => void;
}

/**
 * Explicit per-example presentation metadata, keyed by the exact name from
 * `data/defaultProject.ts` (which this feature must not modify — the protected
 * boundary covers all of `src/data/**`). Mirrors the lookup pattern already
 * used by `examplePresentation.ts` rather than guessing category from a
 * substring of the name.
 */
const EXAMPLE_META: Record<string, { categoryKey: TranslationKey; badgeClass: string; icon: typeof Layers }> = {
  'Hibbeler · carga tributaria Fig. 2–11': { categoryKey: 'welcome.categoryAcademic', badgeClass: 'welcome-badge--academic', icon: GitCommitHorizontal },
  'Práctica tipo Hibbeler · diagramas': { categoryKey: 'welcome.categoryAcademic', badgeClass: 'welcome-badge--academic', icon: GitCommitHorizontal },
  'Práctica tipo Hibbeler · armadura': { categoryKey: 'welcome.categoryAcademic', badgeClass: 'welcome-badge--academic', icon: Triangle },
  'Pórtico de ejemplo': { categoryKey: 'welcome.categoryFrame', badgeClass: 'welcome-badge--frame', icon: Layers },
  'Viga simplemente apoyada': { categoryKey: 'welcome.categoryBeam', badgeClass: 'welcome-badge--beam', icon: GitCommitHorizontal },
  'Armadura triangular': { categoryKey: 'welcome.categoryTruss', badgeClass: 'welcome-badge--truss', icon: Triangle },
};
const DEFAULT_EXAMPLE_META = { categoryKey: 'welcome.categoryFrame' as TranslationKey, badgeClass: 'welcome-badge--frame', icon: Layers };
const ACADEMIC_EXAMPLE_NAMES = new Set(['Hibbeler · carga tributaria Fig. 2–11', 'Práctica tipo Hibbeler · diagramas', 'Práctica tipo Hibbeler · armadura']);

type TemplateFilter = 'all' | 'academic' | 'models';

/**
 * La bienvenida es un LANZADOR DE DOCUMENTO, no un recorrido.
 *
 * Hasta aquí era un asistente de cuatro pasos (Bienvenida · Cómo trabajas ·
 * Por dónde · Mesa) con las puertas repetidas en dos sitios y media ventana
 * vacía bajo el pliegue. Ninguna aplicación del sistema abre así: abren con
 * una ventana acotada que enseña **qué puedes crear** a un lado y **qué
 * tienes** al otro, y se cierra en cuanto eliges. Eso es lo que hay aquí.
 *
 * Tres consecuencias que gobiernan el resto del archivo:
 *
 *   · UNA superficie por destino. Cada capacidad —proyecto nuevo, ejercicio de
 *     Aula, plantilla, importación, DXF, Space 3D— tiene exactamente un botón
 *     en la pantalla. Antes había hasta tres caminos al mismo sitio y ninguno
 *     de los tres decía que los otros existían.
 *   · Sin etapas. No hay estado de navegación que mantener, ni carril de
 *     progreso, ni botones de atrás/adelante. La vitrina de plantillas, que
 *     era la etapa 3, es un diálogo: se abre sobre el lanzador y lo devuelve.
 *   · El marco se centra y se acota. El vacío de antes no era espacio en
 *     blanco, era una página estirada a un contenido que no la llenaba.
 */
export const WelcomeScreen = ({
  onOpenWorkspace,
  onOpenSpace3D,
  onPreloadWorkspace,
  allowDirectResume = false,
  onDirectResume,
}: WelcomeScreenProps) => {
  const { project, replaceProject, updateProjectView } = useProject();
  const { language, t } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
  const reducedMotion = useReducedMotion();
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [importCenterOpen, setImportCenterOpen] = useState(false);
  const [dxfImportOpen, setDxfImportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const entry = useWelcomeEntry();

  /* Salto directo a la Mesa. La condición sale entera del repositorio real
     (`welcomeEntry.ts`): hay proyectos guardados y no hay copia de
     recuperación pendiente. Un usuario sin nada guardado nunca entra aquí. */
  useEffect(() => {
    if (!allowDirectResume || !shouldResumeDirectly(entry)) return;
    onDirectResume?.();
    onOpenWorkspace();
  }, [allowDirectResume, entry, onDirectResume, onOpenWorkspace]);

  // Un único par de controles reutilizado en dos sitios (cabecera de escritorio
  // y drawer móvil) en vez de duplicar el JSX. Ninguno de los dos lleva `id`
  // propio —la asociación label/control es por anidamiento o por `aria-label`—,
  // así que montarlos dos veces (cuando el drawer está abierto) no produce
  // colisiones de `id` ni de nombre accesible entre instancias.
  const themeControl = (
    <button
      type="button"
      className="welcome-header-icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );

  /* Idioma: dos opciones fijas y excluyentes, que es exactamente lo que un
     control segmentado del sistema resuelve mejor que un desplegable — se ve
     el estado sin abrir nada y se cambia con una pulsación en vez de tres. */
  const languageControl = (
    <SegmentedControl
      className="welcome-header-language"
      size="sm"
      label={t('language.label')}
      value={language}
      options={[
        { value: 'es', label: t('language.es') },
        { value: 'en', label: t('language.en') },
      ]}
      onValueChange={(next) => updateProjectView((draft) => ({
        ...draft,
        settings: { ...draft.settings, language: next as 'es' | 'en' },
      }))}
    />
  );

  const openBlankProject = () => {
    const next = createBlankProject();
    replaceProject({ ...next, settings: { ...next.settings, language } });
    onOpenWorkspace();
  };

  const openExample = (build: () => typeof project) => {
    const next = build();
    replaceProject({ ...next, settings: { ...next.settings, language } });
    setTemplatesOpen(false);
    onOpenWorkspace();
  };

  const filteredExamples = useMemo(() => exampleProjects.filter((example) => {
    if (templateFilter === 'academic') return ACADEMIC_EXAMPLE_NAMES.has(example.name);
    if (templateFilter === 'models') return !ACADEMIC_EXAMPLE_NAMES.has(example.name);
    return true;
  }), [templateFilter]);

  const nodeCount = project.nodes.length;
  const memberCount = project.members.length;
  /* Un proyecto recién creado no tiene medida que enseñar. La placa de
     Continuar se adapta a eso; el botón no cambia de función. */
  const hasModel = nodeCount > 0 || memberCount > 0;
  const overlayOpen = exerciseDialogOpen || importCenterOpen || dxfImportOpen || templatesOpen || menuOpen;

  const templateMotion = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } }
    : { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } };

  return (
    <main className="welcome-screen" data-testid="welcome-screen">
      <div className="welcome-base" inert={overlayOpen} aria-hidden={overlayOpen || undefined}>
        {/* El marco. Es una ventana, no una página: se acota, se centra y se
            acaba. Todo lo que la bienvenida puede hacer cabe dentro. */}
        <div className="welcome-launcher">
          <header className="welcome-header">
            <div className="welcome-brand-block">
              <h1 className="welcome-brand">
                <BrandMark size={28} />
                <strong><span>structure</span>Co</strong>
                <span className="welcome-version-tag">v{APP_VERSION}</span>
              </h1>
              <p className="welcome-brand-line">{t('welcome.brandLine')}</p>
            </div>
            <div className="welcome-header-actions">
              <div className="welcome-header-desktop-only">
                {languageControl}
                {themeControl}
              </div>
              <button
                type="button"
                className="welcome-header-icon welcome-header-menu"
                onClick={() => setMenuOpen(true)}
                aria-label={t('welcome.menu')}
              >
                <Menu size={20} />
              </button>
            </div>
            {/* Portada. La figura pasa de flotar suelta en una columna propia a
                ser el fondo de la banda de cabecera, que es donde un lanzador
                del sistema pone su arte. Decorativa: cuanto dice está en el
                texto que la acompaña. */}
            <div className="welcome-launcher-art">
              <StructuralPortalHero />
            </div>
          </header>

          <div className="welcome-launcher-body">
            <section className="welcome-column welcome-column--start" aria-labelledby="welcome-start-title">
              <h2 className="welcome-column-title" id="welcome-start-title">{t('welcome.sectionStart')}</h2>
              <nav
                className="welcome-action-list"
                aria-label={t('welcome.gateRailNav')}
                onPointerEnter={onPreloadWorkspace}
                onFocusCapture={onPreloadWorkspace}
                onTouchStart={onPreloadWorkspace}
              >
                <button type="button" className="welcome-launcher-card welcome-new-card" onClick={openBlankProject}>
                  <span className="welcome-launcher-icon"><Compass size={20} /></span>
                  <span className="welcome-launcher-info">
                    <strong>{t('welcome.newProject')}</strong>
                    <small>{t('welcome.newProjectDescription')}</small>
                  </span>
                  <ArrowRight size={16} className="welcome-launcher-arrow" />
                </button>

                <button type="button" className="welcome-launcher-card welcome-launcher-card--classroom" onClick={() => setExerciseDialogOpen(true)}>
                  <span className="welcome-launcher-icon"><GraduationCap size={20} /></span>
                  <span className="welcome-launcher-info">
                    <strong>{t('welcome.newExercise')}</strong>
                    <small>{t('welcome.launcherClassroomDescription')}</small>
                  </span>
                  <ArrowRight size={16} className="welcome-launcher-arrow" />
                </button>

                <button type="button" className="welcome-launcher-card welcome-template-launcher" onClick={() => setTemplatesOpen(true)}>
                  <span className="welcome-launcher-icon"><LayoutTemplate size={20} /></span>
                  <span className="welcome-launcher-info">
                    <strong>{t('welcome.fromTemplate')}</strong>
                    <small>{t('welcome.fromTemplateDescription')}</small>
                  </span>
                  <ArrowRight size={16} className="welcome-launcher-arrow" />
                </button>

                {/* Importación portátil y DXF comparten materia: las dos son
                    zonas de archivo, y `.welcome-import-card` es lo que lo
                    dice. `Phase2DxfAction` ya emite exactamente esa materia. */}
                <button type="button" className="welcome-import-card" onClick={() => setImportCenterOpen(true)}>
                  <span className="welcome-import-icon"><Upload size={20} /></span>
                  <span className="welcome-import-text">
                    <strong>{t('welcome.import')}</strong>
                    <small>{t('welcome.importDescription')}</small>
                  </span>
                  <ArrowRight size={16} className="welcome-launcher-arrow" />
                </button>

                <Suspense fallback={null}><Phase2DxfAction
                  open={dxfImportOpen}
                  onOpenChange={setDxfImportOpen}
                  onOpenWorkspace={onOpenWorkspace}
                /></Suspense>

                {onOpenSpace3D ? (
                  <button type="button" className="welcome-launcher-card welcome-launcher-card--space3d" onClick={onOpenSpace3D}>
                    <span className="welcome-launcher-icon"><Move3d size={20} /></span>
                    <span className="welcome-launcher-info">
                      <strong>{t('space3d.title')}</strong>
                      <small>{t('welcome.space3DDescription')}</small>
                    </span>
                    {/* La marca de experimental va fuera del nombre: dentro
                        del `<strong>` la recorta su propio `text-overflow`,
                        y una advertencia truncada no advierte de nada. */}
                    <span className="welcome-pill-badge welcome-pill-badge--experimental">{t('space3d.badge')}</span>
                  </button>
                ) : null}
              </nav>
            </section>

            <section className="welcome-column welcome-column--recents" aria-labelledby="welcome-recents-title">
              <h2 className="welcome-column-title" id="welcome-recents-title">{t('welcome.sectionRecents')}</h2>

              <button
                type="button"
                className="welcome-resume-card"
                onClick={onOpenWorkspace}
                onPointerEnter={onPreloadWorkspace}
                onFocus={onPreloadWorkspace}
              >
                <span className="welcome-resume-eyebrow">{t('welcome.continueProject')}</span>
                <strong className="welcome-resume-name">{project.name}</strong>
                {/* Placa adaptativa: con contenido enseña la medida real del
                    modelo; recién creado, la medida sería una fila de ceros y
                    cede el sitio a la invitación. Ningún dato inventado en
                    ninguna de las dos ramas, y el botón hace lo mismo siempre. */}
                <span className="welcome-resume-meta">
                  {hasModel ? (
                    <span className="welcome-project-stats">{t('welcome.projectStats', { nodes: nodeCount, members: memberCount })}</span>
                  ) : (
                    <span className="welcome-resume-invite">{t('welcome.resumeEmpty')}</span>
                  )}
                  <span className="welcome-resume-go">{t('welcome.goToTable')} <ArrowRight size={16} /></span>
                </span>
              </button>

              {/* El hub real, respaldado por IndexedDB: recientes, renombrar,
                  duplicar y recuperación. */}
              <Suspense fallback={<p className="welcome-hub-loading" role="status">{t('hub.loading')}</p>}>
                <Phase2ProjectHub onOpenWorkspace={onOpenWorkspace} />
              </Suspense>
            </section>
          </div>

          <footer className="welcome-footer"><Play size={14} fill="currentColor" /> {t('welcome.footer')}</footer>
        </div>
      </div>

      {/* Vitrina de plantillas. Era la tercera etapa del recorrido; es un
          diálogo porque elegir una plantilla es una decisión que se toma y se
          cierra, no un lugar donde se está. */}
      <Dialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        title={t('welcome.templatesTitle')}
        description={t('welcome.showcaseSubtitle')}
        closeLabel={t('toolbar.close')}
        className="welcome-templates-dialog"
      >
        <div className="welcome-filter-tabs" role="tablist" aria-label={t('welcome.templatesTitle')}>
          <button className={`welcome-filter-tab${templateFilter === 'all' ? ' active' : ''}`} onClick={() => setTemplateFilter('all')} role="tab" aria-selected={templateFilter === 'all'}>{t('welcome.filterAll')}</button>
          <button className={`welcome-filter-tab${templateFilter === 'academic' ? ' active' : ''}`} onClick={() => setTemplateFilter('academic')} role="tab" aria-selected={templateFilter === 'academic'}>{t('welcome.filterAcademic')}</button>
          <button className={`welcome-filter-tab${templateFilter === 'models' ? ' active' : ''}`} onClick={() => setTemplateFilter('models')} role="tab" aria-selected={templateFilter === 'models'}>{t('welcome.filterModels')}</button>
        </div>

        <div className="welcome-templates-grid">
          {/* `initial={false}`: en el primer montaje las tarjetas aparecen ya en su
              estado final. Las capacidades de animación se cargan de forma asíncrona
              (ver `motionFeatures.ts`), así que un `initial` con `opacity: 0` en el
              montaje deja la vitrina invisible si las capacidades aún no llegaron.
              Los cambios de filtro posteriores sí animan con normalidad. */}
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredExamples.map((example) => {
              const meta = EXAMPLE_META[example.name] ?? DEFAULT_EXAMPLE_META;
              const Icon = meta.icon;
              const copy = presentExample(example.name, example.description, t);
              return (
                <m.button
                  key={example.name}
                  layout
                  {...templateMotion}
                  className="welcome-template-card"
                  onClick={() => openExample(example.build)}
                >
                  <span className="welcome-template-top">
                    <span className={`welcome-category-badge ${meta.badgeClass}`}>{t(meta.categoryKey)}</span>
                    <Icon size={16} className="welcome-template-icon" />
                  </span>
                  <span className="welcome-template-body">
                    <strong>{copy.name}</strong>
                    <small>{copy.description}</small>
                  </span>
                  <span className="welcome-template-footer">
                    <span>{t('welcome.loadModel')}</span>
                    <ArrowRight size={14} />
                  </span>
                </m.button>
              );
            })}
          </AnimatePresence>
        </div>
      </Dialog>

      {importCenterOpen ? <Suspense fallback={null}><PortableImportCenter
        open
        currentProjectName={project.name}
        onClose={() => setImportCenterOpen(false)}
        onSaveCurrent={() => exportProjectJson(project)}
        onImported={(outcome) => {
          replaceProject({ ...outcome.project, settings: { ...outcome.project.settings, language } }, outcome.restoredAnalysis);
          setImportCenterOpen(false);
          onOpenWorkspace();
        }}
      /></Suspense> : null}
      <NewExerciseDialog open={exerciseDialogOpen} onClose={() => setExerciseDialogOpen(false)} onCreate={(next) => { replaceProject({ ...next, settings: { ...next.settings, language } }); setExerciseDialogOpen(false); onOpenWorkspace(); }} />
      <Drawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t('welcome.menu')}
        closeLabel={t('toolbar.close')}
        side="right"
      >
        <div className="welcome-menu-body">
          {languageControl}
          {themeControl}
        </div>
      </Drawer>
    </main>
  );
};
