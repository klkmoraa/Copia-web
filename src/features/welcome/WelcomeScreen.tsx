import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  GitCommitHorizontal,
  FileUp,
  GraduationCap,
  Layers,
  LogIn,
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
import { WorkCycleGlyph } from './WorkCycleGlyph';
import { presentExample } from './examplePresentation';
import { shouldResumeDirectly, useWelcomeEntry } from './welcomeEntry';
import { Drawer } from '../../design-system/components/overlays';
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
 * Los tres pasos que se recorren DENTRO de la bienvenida. El cuarto —la Mesa—
 * no es un panel de esta pantalla: es la pantalla siguiente, y por eso el
 * cuarto elemento del carril la abre en vez de cambiar este estado.
 */
type WelcomeStep = 'welcome' | 'how' | 'where';
const STEP_ORDER: readonly WelcomeStep[] = ['welcome', 'how', 'where'];

/** Cómo se trabaja: proyecto libre o ejercicio de Aula. Ordena la etapa 3; no
 *  retira ninguna puerta — en la etapa 3 están todas, siempre. */
type WorkTrack = 'project' | 'classroom';

const STEP_LABEL: Record<WelcomeStep, TranslationKey> = {
  welcome: 'welcome.stepWelcome',
  how: 'welcome.stepHow',
  where: 'welcome.stepWhere',
};

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
  const [step, setStep] = useState<WelcomeStep>('welcome');
  const [track, setTrack] = useState<WorkTrack>('project');
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [importCenterOpen, setImportCenterOpen] = useState(false);
  const [dxfImportOpen, setDxfImportOpen] = useState(false);
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
  // propio —la asociación label/control es por anidamiento—, así que montarlos
  // dos veces (cuando el drawer está abierto) no produce colisiones de `id` ni
  // de nombre accesible entre instancias: son elementos distintos con el mismo
  // texto, no el mismo nodo compartido.
  const themeControl = (
    <button
      type="button"
      className="welcome-header-icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );

  const languageControl = (
    <label className="welcome-header-language">
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={language}
        onChange={(event) => updateProjectView((draft) => ({
          ...draft,
          settings: { ...draft.settings, language: event.target.value as 'es' | 'en' },
        }))}
      >
        <option value="es">{t('language.es')}</option>
        <option value="en">{t('language.en')}</option>
      </select>
    </label>
  );

  const openBlankProject = () => {
    const next = createBlankProject();
    replaceProject({ ...next, settings: { ...next.settings, language } });
    onOpenWorkspace();
  };

  const openExample = (build: () => typeof project) => {
    const next = build();
    replaceProject({ ...next, settings: { ...next.settings, language } });
    onOpenWorkspace();
  };

  const chooseTrack = (next: WorkTrack) => {
    setTrack(next);
    setTemplateFilter(next === 'classroom' ? 'academic' : 'models');
    setStep('where');
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
  const overlayOpen = exerciseDialogOpen || importCenterOpen || dxfImportOpen || menuOpen;

  const templateMotion = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } }
    : { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } };

  /* Las dos puertas de la etapa 3 que dependen del modo de trabajo. Se
     declaran una vez y sólo cambian de ORDEN: las dos se pintan siempre, en
     los dos modos, porque reordenar el peso visual no puede retirar una
     capacidad real. */
  const blankCanvasGate = (
    <button type="button" className="welcome-launcher-card" onClick={openBlankProject} key="blank">
      <span className="welcome-launcher-icon"><Compass size={20} /></span>
      <span className="welcome-launcher-info">
        <strong>{t('welcome.blankCanvas')}</strong>
        <small>{t('welcome.launcherFreeCanvasDescription')}</small>
      </span>
      <ArrowRight size={16} className="welcome-launcher-arrow" />
    </button>
  );

  const classroomGate = (
    <button type="button" className="welcome-launcher-card welcome-launcher-card--classroom" onClick={() => setExerciseDialogOpen(true)} key="classroom">
      <span className="welcome-launcher-icon"><GraduationCap size={20} /></span>
      <span className="welcome-launcher-info">
        <strong>{t('welcome.newExercise')}</strong>
        <small>{t('welcome.launcherClassroomDescription')}</small>
      </span>
      <ArrowRight size={16} className="welcome-launcher-arrow" />
    </button>
  );

  return (
    <main className="welcome-screen" data-testid="welcome-screen" data-welcome-step={step}>
      <div className="welcome-base" inert={overlayOpen} aria-hidden={overlayOpen || undefined}>
        <header className="welcome-header">
          {/* Wordmark y UNA línea de marca. Nada más compite arriba: el resto
              de la cabecera son controles de sesión (idioma, tema, menú). */}
          <div className="welcome-brand-block">
            <h1 className="welcome-brand">
              <BrandMark size={30} />
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
        </header>

        <div className="welcome-stage">
          {/* CRI-112 · Carril de puertas.
              Las cinco puertas que antes sólo existían en la etapa 3 suben
              aquí, a la entrada, sin retirarse de allí. Se renderiza SÓLO en
              la primera etapa: en la tercera las puertas son el contenido, y
              dos juegos simultáneos romperían el contrato de CRI-104 de que
              Space 3D es la única superficie 3D alcanzable de la pantalla
              (`WelcomeScreen.test.tsx` lo comprueba contando exactamente uno). */}
          {step === 'welcome' ? (
            <nav className="welcome-gate-rail" aria-label={t('welcome.gateRailNav')}>
              <button type="button" className="welcome-gate" onClick={openBlankProject}>
                <span className="welcome-gate-icon"><Compass size={19} /></span>
                <span className="welcome-gate-label">{t('welcome.blankCanvas')}</span>
              </button>
              <button type="button" className="welcome-gate welcome-gate--classroom" onClick={() => setExerciseDialogOpen(true)}>
                <span className="welcome-gate-icon"><GraduationCap size={19} /></span>
                <span className="welcome-gate-label">{t('welcome.newExercise')}</span>
              </button>
              <button type="button" className="welcome-gate" onClick={() => setImportCenterOpen(true)}>
                <span className="welcome-gate-icon"><Upload size={19} /></span>
                <span className="welcome-gate-label">{t('welcome.import')}</span>
              </button>
              <button type="button" className="welcome-gate welcome-gate--file" onClick={() => setDxfImportOpen(true)}>
                <span className="welcome-gate-icon"><FileUp size={19} /></span>
                <span className="welcome-gate-label">{t('welcome.gateDxf')}</span>
              </button>
              {onOpenSpace3D ? (
                <button type="button" className="welcome-gate welcome-gate--space3d" onClick={onOpenSpace3D}>
                  <span className="welcome-gate-icon"><Move3d size={19} /></span>
                  <span className="welcome-gate-label">{t('space3d.title')}</span>
                  {/* La marca de experimental viaja con la puerta, aquí también. */}
                  <span className="welcome-gate-badge">{t('space3d.badge')}</span>
                </button>
              ) : null}
            </nav>
          ) : null}

          <div className="welcome-work">
            {/* Corona: el carril de progreso y la pieza clay. El pórtico ocupa
                la columna derecha a lo alto de las DOS filas de la corona
                —rail y acciones—, que es lo que le da presencia sin salirse de
                su esquina. */}
            <nav className="welcome-steps" aria-label={t('welcome.stepsNav')}>
              <ol>
                {STEP_ORDER.map((id, index) => (
                  <li key={id}>
                    <button
                      type="button"
                      className={`welcome-step${step === id ? ' active' : ''}`}
                      aria-current={step === id ? 'step' : undefined}
                      onClick={() => setStep(id)}
                    >
                      <span className="welcome-step-index" aria-hidden="true">{index + 1}</span>
                      <span className="welcome-step-label">{t(STEP_LABEL[id])}</span>
                    </button>
                  </li>
                ))}
                <li>
                  {/* El cuarto paso ES la Mesa: no cambia de panel, abre la
                      pantalla de trabajo con el proyecto actual. Por eso lleva
                      materia propia y un signo de salida: es un nodo del
                      recorrido, pero el que te saca de esta pantalla. */}
                  <button
                    type="button"
                    className="welcome-step welcome-step--table"
                    onClick={onOpenWorkspace}
                    onPointerEnter={onPreloadWorkspace}
                    onFocus={onPreloadWorkspace}
                  >
                    <span className="welcome-step-index" aria-hidden="true">4</span>
                    <span className="welcome-step-label">{t('welcome.stepTable')}</span>
                    <LogIn size={14} className="welcome-step-exit" aria-hidden="true" />
                  </button>
                </li>
              </ol>
            </nav>

            {/* Pieza ilustrativa. Decorativa: todo lo que dice está en el texto
                que la acompaña. */}
            <div className="welcome-portal">
              <StructuralPortalHero />
            </div>

            {step === 'welcome' ? (
              <section className="welcome-panel welcome-panel--work" aria-labelledby="welcome-work-title">
                {/* El carril de progreso ya nombra la etapa activa; un titular
                    de display repitiéndolo era la banda con peor relación
                    entre espacio e información de la pantalla. El encabezado
                    se conserva para el árbol accesible, no para la vista. */}
                <div className="welcome-panel-head sr-only">
                  <h2 id="welcome-work-title">{t('welcome.workTitle')}</h2>
                  <p>{t('welcome.workSubtitle')}</p>
                </div>

                <div
                  className="welcome-work-actions"
                  onPointerEnter={onPreloadWorkspace}
                  onFocusCapture={onPreloadWorkspace}
                  onTouchStart={onPreloadWorkspace}
                >
                  <button type="button" className="welcome-resume-card" onClick={onOpenWorkspace}>
                    <span className="welcome-resume-eyebrow">{t('welcome.continueProject')}</span>
                    <strong className="welcome-resume-name">{project.name}</strong>
                    {/* Placa adaptativa: con contenido enseña la medida real
                        del modelo; recién creado, la medida sería una fila de
                        ceros en la pieza mayor de la pantalla, así que cede el
                        sitio a la invitación. Ningún dato inventado en ninguna
                        de las dos ramas, y el botón hace lo mismo siempre. */}
                    <span className="welcome-resume-meta">
                      {hasModel ? (
                        <span className="welcome-project-stats">{t('welcome.projectStats', { nodes: nodeCount, members: memberCount })}</span>
                      ) : (
                        <span className="welcome-resume-invite">{t('welcome.resumeEmpty')}</span>
                      )}
                      <span className="welcome-resume-go">{t('welcome.goToTable')} <ArrowRight size={16} /></span>
                    </span>
                  </button>

                  <button type="button" className="welcome-launcher-card welcome-new-card" onClick={openBlankProject}>
                    <span className="welcome-launcher-icon"><Compass size={20} /></span>
                    <span className="welcome-launcher-info">
                      <strong>{t('welcome.newProject')}</strong>
                      <small>{t('welcome.newProjectDescription')}</small>
                    </span>
                    <ArrowRight size={16} className="welcome-launcher-arrow" />
                  </button>
                </div>

              </section>
            ) : null}

            {step === 'how' ? (
              <section className="welcome-panel" aria-labelledby="welcome-how-title">
                <div className="welcome-panel-head sr-only">
                  <h2 id="welcome-how-title">{t('welcome.stepHow')}</h2>
                  <p>{t('welcome.howSubtitle')}</p>
                </div>

                <div className="welcome-track-options">
                  <button
                    type="button"
                    className={`welcome-launcher-card welcome-track-card${track === 'project' ? ' active' : ''}`}
                    aria-pressed={track === 'project'}
                    onClick={() => chooseTrack('project')}
                  >
                    <span className="welcome-launcher-icon"><Compass size={20} /></span>
                    <span className="welcome-launcher-info">
                      <strong>{t('welcome.fullProject')}</strong>
                      <small>{t('welcome.launcherFreeCanvasDescription')}</small>
                    </span>
                    <span className="welcome-pill-badge">{t('welcome.pillFreeCanvas')}</span>
                  </button>

                  <button
                    type="button"
                    className={`welcome-launcher-card welcome-track-card welcome-track-card--classroom${track === 'classroom' ? ' active' : ''}`}
                    aria-pressed={track === 'classroom'}
                    onClick={() => chooseTrack('classroom')}
                  >
                    <span className="welcome-launcher-icon"><GraduationCap size={20} /></span>
                    <span className="welcome-launcher-info">
                      <strong>{t('welcome.newExercise')}</strong>
                      <small>{t('welcome.launcherClassroomDescription')}</small>
                    </span>
                    <span className="welcome-pill-badge welcome-pill-badge--aula">{t('welcome.pillClassroomMode')}</span>
                  </button>
                </div>

                <div className="welcome-workflow">
                  <h3>{t('welcome.cycleTitle')}</h3>
                  <ol className="welcome-workflow-steps">
                    <li className="welcome-workflow-step">
                      <WorkCycleGlyph stage="model" />
                      <span className="welcome-step-num">1</span>
                      <div className="welcome-step-content"><strong>{t('welcome.model')}</strong><p>{t('welcome.modelDescription')}</p></div>
                    </li>
                    <li className="welcome-workflow-step">
                      <WorkCycleGlyph stage="load" />
                      <span className="welcome-step-num">2</span>
                      <div className="welcome-step-content"><strong>{t('welcome.load')}</strong><p>{t('welcome.loadDescription')}</p></div>
                    </li>
                    <li className="welcome-workflow-step">
                      <WorkCycleGlyph stage="analyze" />
                      <span className="welcome-step-num">3</span>
                      <div className="welcome-step-content"><strong>{t('welcome.analyze')}</strong><p>{t('welcome.analyzeDescription')}</p></div>
                    </li>
                  </ol>
                  <ul className="welcome-features-highlights">
                    <li className="welcome-highlight-item"><CheckCircle2 size={14} /><span>{t('welcome.highlightStiffnessMethod')}</span></li>
                    <li className="welcome-highlight-item"><CheckCircle2 size={14} /><span>{t('welcome.highlightVerified')}</span></li>
                    <li className="welcome-highlight-item"><CheckCircle2 size={14} /><span>{t('welcome.highlightPdfExport')}</span></li>
                  </ul>
                </div>
              </section>
            ) : null}

            {step === 'where' ? (
              <section className="welcome-panel" aria-labelledby="welcome-where-title">
                <div className="welcome-panel-head sr-only">
                  <h2 id="welcome-where-title">{t('welcome.startTitle')}</h2>
                  <p>{t('welcome.startSubtitle')}</p>
                </div>

                <div
                  className="welcome-start-grid"
                  onPointerEnter={onPreloadWorkspace}
                  onFocusCapture={onPreloadWorkspace}
                  onTouchStart={onPreloadWorkspace}
                >
                  {track === 'classroom' ? [classroomGate, blankCanvasGate] : [blankCanvasGate, classroomGate]}

                  {/* Importación portátil y DXF comparten el trazo discontinuo:
                      las dos son zonas de archivo, y ese trazo es lo que lo
                      dice. `Phase2DxfAction` ya emite exactamente esta materia. */}
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
                </div>

                <div className="welcome-showcase">
                  <div className="welcome-showcase-header">
                    <div>
                      <h3 id="welcome-showcase-title">{t('welcome.otherWays')}</h3>
                      <p className="welcome-showcase-sub">{t('welcome.showcaseSubtitle')}</p>
                    </div>
                    <div className="welcome-filter-tabs" role="tablist">
                      <button className={`welcome-filter-tab${templateFilter === 'all' ? ' active' : ''}`} onClick={() => setTemplateFilter('all')} role="tab" aria-selected={templateFilter === 'all'}>{t('welcome.filterAll')}</button>
                      <button className={`welcome-filter-tab${templateFilter === 'academic' ? ' active' : ''}`} onClick={() => setTemplateFilter('academic')} role="tab" aria-selected={templateFilter === 'academic'}>{t('welcome.filterAcademic')}</button>
                      <button className={`welcome-filter-tab${templateFilter === 'models' ? ' active' : ''}`} onClick={() => setTemplateFilter('models')} role="tab" aria-selected={templateFilter === 'models'}>{t('welcome.filterModels')}</button>
                    </div>
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
                              <Icon size={18} className="welcome-template-icon" />
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
                </div>
              </section>
            ) : null}

            {step !== 'welcome' ? (
              <div className="welcome-panel-nav">
                <button type="button" className="welcome-back-link" onClick={() => setStep(step === 'where' ? 'how' : 'welcome')}>
                  {t('welcome.back')}
                </button>
                <button
                  type="button"
                  className="welcome-forward-link"
                  onClick={() => (step === 'how' ? setStep('where') : onOpenWorkspace())}
                  onPointerEnter={onPreloadWorkspace}
                  onFocus={onPreloadWorkspace}
                >
                  {step === 'how' ? t('welcome.stepWhere') : t('welcome.goToTable')} <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="welcome-panel-nav welcome-panel-nav--forward">
                <button
                  type="button"
                  className="welcome-forward-link"
                  onClick={() => setStep('how')}
                >
                  {t('welcome.exploreOptions')} <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* El hub real, respaldado por IndexedDB: recientes, renombrar,
              duplicar y recuperación. Banda propia de la mesa —cruza bajo el
              carril y el trabajo— porque una tabla necesita ancho, y porque
              dejarla dentro de la columna de trabajo abría un vacío del alto
              de la biblioteca a la izquierda. */}
          {step === 'welcome' ? (
            <Suspense fallback={<p className="welcome-hub-band" role="status">{t('hub.loading')}</p>}>
              <Phase2ProjectHub onOpenWorkspace={onOpenWorkspace} />
            </Suspense>
          ) : null}
        </div>

        <footer className="welcome-footer"><Play size={13} fill="currentColor" /> {t('welcome.footer')}</footer>
      </div>

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
