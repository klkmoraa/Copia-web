import { lazy, Suspense, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Cpu,
  FolderOpen,
  GitCommitHorizontal,
  GraduationCap,
  Layers,
  Menu,
  Moon,
  Play,
  Sparkles,
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
import { Drawer } from '../../design-system/components/overlays';
import { Surface } from '../../design-system/components/surface';
import type { TranslationKey } from '../../i18n/catalogs';

const PortableImportCenter = lazy(() => import('../import-export/PortableImportCenter').then((module) => ({ default: module.PortableImportCenter })));

interface WelcomeScreenProps {
  onOpenWorkspace: () => void;
  onPreloadWorkspace?: () => void;
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
 * Separa la última palabra del titular para teñirla con el gradiente de marca.
 * Se hace sobre el texto ya traducido —y no con dos claves de i18n— porque el
 * énfasis es una decisión tipográfica, no de contenido: cualquier idioma nuevo
 * lo hereda sin tener que partir la frase en el catálogo. El texto renderizado
 * sigue siendo idéntico al de la clave, así que el nombre accesible no cambia.
 */
const splitEmphasis = (title: string) => {
  const lastSpace = title.trimEnd().lastIndexOf(' ');
  if (lastSpace <= 0) return { lead: '', emphasis: title };
  return { lead: title.slice(0, lastSpace), emphasis: title.slice(lastSpace + 1) };
};

export const WelcomeScreen = ({ onOpenWorkspace, onPreloadWorkspace }: WelcomeScreenProps) => {
  const { project, replaceProject, updateProjectView } = useProject();
  const { language, t } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
  const reducedMotion = useReducedMotion();
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [importCenterOpen, setImportCenterOpen] = useState(false);
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>('all');
  const [menuOpen, setMenuOpen] = useState(false);

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

  const filteredExamples = exampleProjects.filter((example) => {
    if (templateFilter === 'academic') return ACADEMIC_EXAMPLE_NAMES.has(example.name);
    if (templateFilter === 'models') return !ACADEMIC_EXAMPLE_NAMES.has(example.name);
    return true;
  });

  const nodeCount = project.nodes.length;
  const memberCount = project.members.length;
  const { lead, emphasis } = splitEmphasis(t('welcome.title'));

  const templateMotion = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } }
    : { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } };

  return (
    <main className="welcome-screen" data-testid="welcome-screen">
      <div className="welcome-base" inert={exerciseDialogOpen || importCenterOpen || menuOpen} aria-hidden={exerciseDialogOpen || importCenterOpen || menuOpen || undefined}>
        <header className="welcome-header">
          <div className="welcome-brand" aria-label="structureCo">
            <BrandMark size={34} />
            <strong><span>structure</span>Co</strong>
            <span className="welcome-version-tag">v{APP_VERSION}</span>
          </div>
          <div className="welcome-header-actions">
            <button className="welcome-continue-link" onClick={onOpenWorkspace}>
              <span>{t('welcome.continue')}</span> <ArrowRight size={16} />
            </button>
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

        <Surface as="div" level="raised" className="welcome-frame">
          <div className="welcome-content">
            <section className="welcome-hero" aria-labelledby="welcome-title">
              <div className="welcome-hero-copy">
                <p className="welcome-badge-pill">
                  <Sparkles size={14} />
                  <span>{t('welcome.badgePill')}</span>
                </p>

                <h1 id="welcome-title">
                  {lead ? `${lead} ` : null}<em className="welcome-title-accent">{emphasis}</em>
                </h1>
                <p className="welcome-hero-subtitle">{t('welcome.subtitle')}</p>

                <ul className="welcome-features-highlights">
                  <li className="welcome-highlight-item"><CheckCircle2 size={15} /><span>{t('welcome.highlightStiffnessMethod')}</span></li>
                  <li className="welcome-highlight-item"><CheckCircle2 size={15} /><span>{t('welcome.highlightVerified')}</span></li>
                  <li className="welcome-highlight-item"><CheckCircle2 size={15} /><span>{t('welcome.highlightPdfExport')}</span></li>
                </ul>
              </div>

              <div className="welcome-hero-figure">
                <StructuralPortalHero />
              </div>
            </section>

            {/* Launcher Cards con jerarquía visual mejorada */}
            <div className="welcome-hero-launcher" onPointerEnter={onPreloadWorkspace} onFocusCapture={onPreloadWorkspace} onTouchStart={onPreloadWorkspace}>
              <button type="button" className="welcome-launcher-card welcome-launcher-card--primary" onClick={openBlankProject}>
                <span className="welcome-launcher-icon"><Compass size={22} /></span>
                <span className="welcome-launcher-info">
                  <span className="welcome-launcher-header">
                    <strong>{t('welcome.fullProject')}</strong>
                    <span className="welcome-pill-badge">{t('welcome.pillFreeCanvas')}</span>
                  </span>
                  <small>{t('welcome.launcherFreeCanvasDescription')}</small>
                </span>
                <ArrowRight size={18} className="welcome-launcher-arrow" />
              </button>

              <button type="button" className="welcome-launcher-card welcome-launcher-card--classroom" onClick={() => setExerciseDialogOpen(true)}>
                <span className="welcome-launcher-icon"><GraduationCap size={22} /></span>
                <span className="welcome-launcher-info">
                  <span className="welcome-launcher-header">
                    <strong>{t('welcome.newExercise')}</strong>
                    <span className="welcome-pill-badge welcome-pill-badge--aula">{t('welcome.pillClassroomMode')}</span>
                  </span>
                  <small>{t('welcome.launcherClassroomDescription')}</small>
                </span>
                <ArrowRight size={18} className="welcome-launcher-arrow" />
              </button>

              <button type="button" className="welcome-launcher-card welcome-launcher-card--recent" onClick={onOpenWorkspace}>
                <span className="welcome-launcher-icon"><FolderOpen size={22} /></span>
                <span className="welcome-launcher-info">
                  <span className="welcome-launcher-header">
                    <small>{t('welcome.continueProject')}</small>
                    <span className="welcome-project-stats">{t('welcome.projectStats', { nodes: nodeCount, members: memberCount })}</span>
                  </span>
                  <strong>{project.name}</strong>
                </span>
                <ArrowRight size={18} className="welcome-launcher-arrow" />
              </button>
            </div>

            {/* 4 Pilares de Confianza de Ingeniería */}
            <div className="welcome-pillars-grid">
              <div className="welcome-pillar-item">
                <span className="welcome-pillar-icon"><Cpu size={18} /></span>
                <div>
                  <strong>Rigidez Directa 64-bit</strong>
                  <small>Solución matricial analítica exacta IEEE 754</small>
                </div>
              </div>
              <div className="welcome-pillar-item">
                <span className="welcome-pillar-icon"><Layers size={18} /></span>
                <div>
                  <strong>Efectos P-Delta 2º Orden</strong>
                  <small>Análisis no lineal geométrico por sub-pasos</small>
                </div>
              </div>
              <div className="welcome-pillar-item">
                <span className="welcome-pillar-icon"><GraduationCap size={18} /></span>
                <div>
                  <strong>Pedagogía & Hibbeler</strong>
                  <small>Verificado contra ejemplos estándar de ingeniería</small>
                </div>
              </div>
              <div className="welcome-pillar-item">
                <span className="welcome-pillar-icon"><CheckCircle2 size={18} /></span>
                <div>
                  <strong>100% Local & Privado</strong>
                  <small>Cero telemetría; tus cálculos se quedan en tu navegador</small>
                </div>
              </div>
            </div>

            <section className="welcome-showcase" aria-labelledby="welcome-showcase-title">
              <div className="welcome-showcase-header">
                <div>
                  <h2 id="welcome-showcase-title">{t('welcome.otherWays')}</h2>
                  <p className="welcome-showcase-sub">{t('welcome.showcaseSubtitle')}</p>
                </div>
                <div className="welcome-filter-tabs" role="tablist">
                  <button className={`welcome-filter-tab${templateFilter === 'all' ? ' active' : ''}`} onClick={() => setTemplateFilter('all')} role="tab" aria-selected={templateFilter === 'all'}>{t('welcome.filterAll')}</button>
                  <button className={`welcome-filter-tab${templateFilter === 'academic' ? ' active' : ''}`} onClick={() => setTemplateFilter('academic')} role="tab" aria-selected={templateFilter === 'academic'}>{t('welcome.filterAcademic')}</button>
                  <button className={`welcome-filter-tab${templateFilter === 'models' ? ' active' : ''}`} onClick={() => setTemplateFilter('models')} role="tab" aria-selected={templateFilter === 'models'}>{t('welcome.filterModels')}</button>
                </div>
              </div>

              <button type="button" className="welcome-import-card" onClick={() => setImportCenterOpen(true)}>
                <span className="welcome-import-icon"><Upload size={20} /></span>
                <span className="welcome-import-text">
                  <strong>{t('welcome.import')}</strong>
                  <small>{t('welcome.importDescription')}</small>
                </span>
                <span className="welcome-import-formats">
                  <span className="welcome-format-chip">.JSON</span>
                  <span className="welcome-format-chip">.FTL</span>
                  <span className="welcome-format-chip">.POS</span>
                  <span className="welcome-format-chip">.ZIP</span>
                </span>
                <ArrowRight size={16} className="welcome-launcher-arrow" />
              </button>

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
            </section>

            <section className="welcome-workflow" aria-labelledby="welcome-workflow-title">
              <div className="welcome-workflow-header">
                <Cpu size={18} />
                <h2 id="welcome-workflow-title">{t('welcome.stepsTitle')}</h2>
              </div>
              <ol className="welcome-workflow-steps">
                <li className="welcome-workflow-step">
                  <span className="welcome-step-num">1</span>
                  <div className="welcome-step-content"><strong>{t('welcome.model')}</strong><p>{t('welcome.modelDescription')}</p></div>
                </li>
                <li className="welcome-workflow-step">
                  <span className="welcome-step-num">2</span>
                  <div className="welcome-step-content"><strong>{t('welcome.load')}</strong><p>{t('welcome.loadDescription')}</p></div>
                </li>
                <li className="welcome-workflow-step">
                  <span className="welcome-step-num">3</span>
                  <div className="welcome-step-content"><strong>{t('welcome.analyze')}</strong><p>{t('welcome.analyzeDescription')}</p></div>
                </li>
              </ol>
            </section>
          </div>
        </Surface>

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
