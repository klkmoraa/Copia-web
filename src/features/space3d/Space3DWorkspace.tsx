/**
 * Superficie Space 3D.
 *
 * Composición: cabecera de identidad, bandeja de herramientas, viewport como
 * protagonista, carril de modelo/resultados y tira de estado. En móvil el
 * lienzo se queda arriba y los paneles bajan apilados, siguiendo la regla del
 * brandbook «canvas primero en móvil».
 *
 * El módulo trae su propio `Space3DProjectProvider`: es la superficie completa
 * y lo único que la aplicación necesita cargar de forma diferida.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronLeft, CircleStop, Download, Grid3x3, Home, Layers, Minus,
  Moon, PenLine, Play, Plus, Sparkles, Spline, Sun, Tag, Upload, Weight,
} from 'lucide-react';
import { Space3DProjectProvider, useSpace3DProject, type Space3DSelection } from '../../space3d/store/Space3DProjectContext';
import {
  deriveSpace3DFromPlanarProject,
  space3dMatchesPlanarSource,
  unresolvedSpace3DBridgeNotes,
  type Space3DBridgeNote,
} from '../../space3d/data/bridge2d';
import { loadSpace3DProject } from '../../space3d/data/storage';
import { Dialog } from '../../design-system/components/overlays';
import { Space3DCanvas, type Space3DViewportFactory } from '../../space3d/view/Space3DCanvas';
import { buildSpace3DSceneModel } from '../../space3d/view/sceneModel';
import { SPACE3D_DEFAULT_LAYERS, type Space3DLayerVisibility } from '../../space3d/view/threeViewport';
import { SPACE3D_VIEW_PRESETS, type Space3DViewPreset } from '../../space3d/view/cameraModel';
import { Space3DEntityEditor, type Space3DEditorTarget } from './Space3DEntityEditor';
import { Space3DResultsPanel, type Space3DResultsTab } from './Space3DResultsPanel';
import { Space3DToolRail, type Space3DActiveTool } from './Space3DToolRail';
import { Space3DModelNav, type Space3DModelFocus } from './Space3DModelNav';
import { translate, type Language, type TranslationKey } from '../../i18n/catalogs';
import { formatNumber } from '../../utils/numberFormat';
import { BrandMark } from '../topbar/BrandMark';
import type { Space3DCommand } from '../../space3d/data/commands';
import type { Space3DProjectV1, Space3DRestraints } from '../../space3d/model/types';
import type { ProjectModel } from '../../types';
import type { Space3DStorageLike } from '../../space3d/data/storage';
import type { Space3DWorkerClient } from '../../space3d/runtime/workerClient';
import './space3d.css';

type Space3DThemeMode = 'light' | 'dark';

const readStoredTheme = (): Space3DThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage?.getItem('structureCo.theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const VIEW_LABEL_KEYS: Record<Space3DViewPreset, TranslationKey> = {
  front: 'space3d.viewFront',
  top: 'space3d.viewTop',
  side: 'space3d.viewSide',
  isometric: 'space3d.viewIsometric',
};

export interface Space3DWorkspaceProps {
  readonly language: Language;
  readonly onOpenHome?: () => void;
  readonly onOpen2D?: () => void;
  readonly storage?: Space3DStorageLike | null;
  readonly client?: Space3DWorkerClient;
  readonly createViewport?: Space3DViewportFactory;
  /**
   * Proyecto 2D del que parte esta sesion. Al recibirlo, la superficie abre el
   * modelo espacial derivado de el en vez de uno independiente.
   */
  readonly sourceProject?: ProjectModel;
}

const ERROR_KEYS: Record<string, TranslationKey> = {
  'duplicate-id': 'space3d.error.duplicateId',
  'empty-id': 'space3d.error.emptyId',
  'missing-entity': 'space3d.error.missingEntity',
  'node-in-use': 'space3d.error.nodeInUse',
  'self-referential': 'space3d.error.selfReferential',
  'invalid-value': 'space3d.error.invalidValue',
  'limit-exceeded': 'space3d.error.limitExceeded',
  'invalid-result': 'space3d.error.invalidResult',
  'malformed-json': 'space3d.error.malformedJson',
  'analysis-space': 'space3d.error.analysisSpace',
  'schema-version': 'space3d.error.schemaVersion',
  'unknown-field': 'space3d.error.unknownField',
  'invalid-model': 'space3d.error.invalidModel',
  'analysis-failed': 'space3d.error.analysisFailed',
};

/** Códigos de issue del solver traducidos para el aviso de la superficie. */
const ANALYSIS_ISSUE_KEYS: Record<string, TranslationKey> = {
  mechanism: 'space3d.error.mechanism',
  'no-free-dof': 'space3d.error.noFreeDof',
  'empty-model': 'space3d.error.emptyModel',
  'unknown-target': 'space3d.error.unknownTarget',
  'non-finite-solution': 'space3d.error.analysisFailed',
  'missing-reference': 'space3d.error.missingEntity',
  'invalid-property': 'space3d.error.invalidValue',
  'invalid-coordinate': 'space3d.error.invalidValue',
  'degenerate-length': 'space3d.error.invalidValue',
  'degenerate-orientation': 'space3d.error.invalidValue',
  'missing-case': 'space3d.error.missingEntity',
  'duplicate-id': 'space3d.error.duplicateId',
  'limit-exceeded': 'space3d.error.limitExceeded',
};

const STATE_KEYS: Record<string, TranslationKey> = {
  idle: 'space3d.stateIdle',
  running: 'space3d.stateRunning',
  ready: 'space3d.stateReady',
  stale: 'space3d.stateStale',
  failed: 'space3d.stateFailed',
  cancelled: 'space3d.stateCancelled',
};

const STATE_TONES: Record<string, string> = {
  idle: 'neutral', running: 'loading', ready: 'ok', stale: 'warn', failed: 'error', cancelled: 'neutral',
};

const BRIDGE_KEYS: Record<string, TranslationKey> = {
  'pending-shear-modulus': 'space3d.bridge.pendingShearModulus',
  'pending-weak-axis-inertia': 'space3d.bridge.pendingWeakAxisInertia',
  'pending-torsion-constant': 'space3d.bridge.pendingTorsionConstant',
  'out-of-plane-unrestrained': 'space3d.bridge.outOfPlaneUnrestrained',
  'truss-member-as-frame': 'space3d.bridge.trussMemberAsFrame',
  'dropped-member-release': 'space3d.bridge.droppedMemberRelease',
  'dropped-internal-hinge': 'space3d.bridge.droppedInternalHinge',
  'dropped-semi-rigid-connection': 'space3d.bridge.droppedSemiRigidConnection',
  'dropped-rigid-offset': 'space3d.bridge.droppedRigidOffset',
  'dropped-support-spring': 'space3d.bridge.droppedSupportSpring',
  'dropped-inclined-support': 'space3d.bridge.droppedInclinedSupport',
  'dropped-prescribed-support-motion': 'space3d.bridge.droppedPrescribedSupportMotion',
  'dropped-member-load': 'space3d.bridge.droppedMemberLoad',
  'dropped-prescribed-displacement': 'space3d.bridge.droppedPrescribedDisplacement',
  'dropped-initial-effect': 'space3d.bridge.droppedInitialEffect',
};

/** Notas que el usuario resuelve escribiendo un valor, no reconociendolas. */
const BRIDGE_RESOLVABLE = new Set([
  'pending-shear-modulus', 'pending-weak-axis-inertia', 'pending-torsion-constant', 'out-of-plane-unrestrained',
]);

/**
 * Límites del multiplicador manual sobre la escala automática de la deformada.
 * Seis duplicaciones (2⁶ = 64) separan lo apenas visible de lo que ya no cabe
 * en pantalla; más allá de eso el control deja de ayudar a leer el modelo, y
 * los botones se deshabilitan en el límite para decirlo sin ambigüedad.
 */
const SCALE_FACTOR_MIN = 1 / 64;
const SCALE_FACTOR_MAX = 64;

const LAYER_TOGGLES: readonly { id: keyof Space3DLayerVisibility; key: TranslationKey; Icon: typeof Grid3x3 }[] = [
  { id: 'grid', key: 'space3d.layerGrid', Icon: Grid3x3 },
  { id: 'loads', key: 'space3d.layerLoads', Icon: Weight },
  { id: 'supports', key: 'space3d.layerSupports', Icon: ChevronLeft },
  { id: 'labels', key: 'space3d.layerLabels', Icon: Tag },
  { id: 'deformed', key: 'space3d.layerDeformed', Icon: Spline },
];

/** Misma política numérica que el resto del producto. */
const number = (value: number): string => formatNumber(value, 'table');

const countRestraints = (restraints: Space3DRestraints) => Object.values(restraints).filter(Boolean).length;

interface WorkspaceBodyProps extends Pick<Space3DWorkspaceProps,
  'language' | 'onOpenHome' | 'onOpen2D' | 'createViewport' | 'sourceProject'> {
  readonly bridgeNotes: readonly Space3DBridgeNote[];
  readonly derived: Space3DProjectV1 | null;
}

const WorkspaceBody = ({
  language, onOpenHome, onOpen2D, createViewport, sourceProject, bridgeNotes, derived,
}: WorkspaceBodyProps) => {
  const t = useCallback(
    (key: TranslationKey, variables?: Record<string, string | number>) => translate(language, key, variables),
    [language],
  );

  const {
    project, analysis, analysisState, analysisTargetId, selectedEntity, canUndo, canRedo, lastError,
    execute, undo, redo, analyze, cancelAnalysis, select, importPortable, exportPortable, loadExample, resetToBlank,
    replaceProject, setAnalysisTargetId,
  } = useSpace3DProject();

  const [layers, setLayers] = useState<Space3DLayerVisibility>(SPACE3D_DEFAULT_LAYERS);
  const [rail, setRail] = useState<'model' | 'results'>('model');
  const [resultsTab, setResultsTab] = useState<Space3DResultsTab>('summary');
  const [editorTarget, setEditorTarget] = useState<Space3DEditorTarget | null>(null);
  const [transfer, setTransfer] = useState<'import' | 'export' | null>(null);
  const [importText, setImportText] = useState('');
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * Multiplicador sobre la escala automatica de la deformada. `null` deja que
   * la escena la calcule para ocupar una fraccion fija del modelo; cualquier
   * otro valor la amplifica sin tocar el modelo ni el resultado.
   */
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  /**
   * "Cargar ejemplo" y "Proyecto vacío" reemplazan el modelo entero. Son
   * recuperables con Deshacer, pero eso no es obvio para quien no lo sabe: se
   * confirma antes de actuar, salvo que no haya nada que perder.
   */
  const [pendingReplace, setPendingReplace] = useState<'example' | 'blank' | null>(null);
  const [theme, setThemeState] = useState<Space3DThemeMode>(readStoredTheme);
  const [activeView, setActiveView] = useState<Space3DViewPreset>('isometric');
  const [modelNavFocus, setModelNavFocus] = useState<Space3DModelFocus>('node');
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);
  const hasContent = project.nodes.length > 0;
  // Doce clics en cada sentido: suficiente margen para explorar sin llegar a
  // una deformada ilegible por minúscula o a una que ya no cabe en pantalla.
  const effectiveScaleFactor = scaleFactor ?? 1;

  const automatic = useMemo(() => buildSpace3DSceneModel({
    project, analysis, analysisState, selection: selectedEntity, targetId: analysisTargetId,
  }), [analysis, analysisState, analysisTargetId, project, selectedEntity]);

  const scene = useMemo(() => {
    if (scaleFactor === null || automatic.deformed === null) return automatic;
    return buildSpace3DSceneModel({
      project,
      analysis,
      analysisState,
      selection: selectedEntity,
      targetId: analysisTargetId,
      deformationScale: automatic.deformed.scale * scaleFactor,
    });
  }, [analysis, analysisState, analysisTargetId, automatic, project, scaleFactor, selectedEntity]);

  const submit = useCallback((command: Space3DCommand) => execute(command).ok, [execute]);

  // El tema es local a Space 3D (la superficie es independiente del editor
  // 2D, ver cabecera del módulo) pero comparte la misma clave de almacenamiento
  // y el mismo atributo de documento que el editor 2D, así que ambas
  // superficies quedan visualmente consistentes sin depender la una de la otra.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage?.setItem('structureCo.theme', theme); } catch { /* almacenamiento no disponible */ }
  }, [theme]);
  const toggleTheme = () => setThemeState((current) => (current === 'light' ? 'dark' : 'light'));

  // El resultado listo no trae marca de tiempo propia (el dominio no la
  // modela): se anota aquí, en la superficie, sólo para mostrarla junto al
  // botón Analizar. No participa del cálculo ni se persiste con el proyecto.
  useEffect(() => {
    if (analysisState === 'ready') setLastAnalyzedAt(Date.now());
  }, [analysisState]);

  const selectEntity = useCallback((selection: Space3DSelection | null) => {
    select(selection);
    setEditorTarget(selection ? { kind: selection.kind, id: selection.id } : null);
    if (selection) {
      setModelNavFocus(selection.kind);
      // En móvil, la bandeja inferior puede estar contraída: sin esto, el
      // editor se abre fuera de la vista y parece que el toque no hizo nada.
      setSheetExpanded(true);
    }
  }, [select]);

  const openNew = (kind: Space3DEditorTarget['kind']) => {
    select(null);
    setRail('model');
    setEditorTarget({ kind, id: null });
    setModelNavFocus(kind);
    setSheetExpanded(true);
  };

  const clearToolSelection = () => {
    select(null);
    setEditorTarget(null);
  };

  const selectedNodeId = selectedEntity?.kind === 'node' ? selectedEntity.id : null;
  const editSelectedSupports = () => {
    if (!selectedNodeId) return;
    selectEntity({ kind: 'node', id: selectedNodeId });
  };

  const activeTool: Space3DActiveTool = !editorTarget
    ? 'select'
    : editorTarget.id === null ? editorTarget.kind : 'select';

  const cycleView = () => setActiveView((current) => {
    const index = SPACE3D_VIEW_PRESETS.indexOf(current);
    return SPACE3D_VIEW_PRESETS[(index + 1) % SPACE3D_VIEW_PRESETS.length];
  });

  const focusModelSection = (focus: Space3DModelFocus) => {
    setModelNavFocus(focus);
    setRail('model');
    setSheetExpanded(true);
    document.getElementById(`space3d-table-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  /** Reemplaza directamente si no hay nada que perder; si lo hay, pide confirmación. */
  const requestReplace = (target: 'example' | 'blank') => {
    if (hasContent) { setPendingReplace(target); return; }
    if (target === 'example') loadExample(); else resetToBlank();
    setEditorTarget(null);
  };

  const confirmReplace = () => {
    if (pendingReplace === 'example') loadExample(); else if (pendingReplace === 'blank') resetToBlank();
    setEditorTarget(null);
    setPendingReplace(null);
  };

  const remove = (target: Space3DEditorTarget) => {
    if (!target.id) return;
    const command: Space3DCommand = target.kind === 'node'
      ? { kind: 'delete-node', nodeId: target.id }
      : target.kind === 'member'
        ? { kind: 'delete-member', memberId: target.id }
        : { kind: 'delete-nodal-load', loadId: target.id };
    if (execute(command).ok) {
      select(null);
      setEditorTarget(null);
    }
  };

  // El puente solo bloquea lo que no pudo mapear con autoridad. En cuanto el
  // usuario completa un numero o reconoce una diferencia, deja de bloquear.
  const pendingNotes = useMemo(
    () => unresolvedSpace3DBridgeNotes(bridgeNotes, project, acknowledged),
    [acknowledged, bridgeNotes, project],
  );
  const acknowledgeable = useMemo(
    () => [...new Set(pendingNotes.filter((item) => !BRIDGE_RESOLVABLE.has(item.code)).map((item) => item.code))],
    [pendingNotes],
  );
  const diverged = sourceProject !== undefined && derived !== null
    && !space3dMatchesPlanarSource(project, sourceProject);

  const running = analysisState === 'running';
  const errorMessage = lastError ? t(ERROR_KEYS[lastError] ?? 'space3d.error.generic') : null;

  const canNewMember = project.nodes.length >= 2;
  const canNewLoad = project.nodes.length > 0;
  const canEditSupport = selectedNodeId !== null;
  const canDeleteSelection = editorTarget !== null && editorTarget.id !== null;
  const modelCounts = {
    nodes: project.nodes.length,
    members: project.members.length,
    supports: project.nodes.filter((node) => countRestraints(node.restraints) > 0).length,
    loads: project.nodalLoads.length,
    loadCases: project.loadCases.length,
    combinations: project.loadCombinations.length,
  };
  const modelProperties = {
    id: project.id,
    target: analysisTargetId,
    dofTotal: project.nodes.length * 6,
    dofFree: analysis?.diagnostics.freeDofCount ?? 0,
    dofRestrained: analysis?.diagnostics.restrainedDofCount ?? 0,
  };
  const viewLabels = {
    front: t(VIEW_LABEL_KEYS.front), top: t(VIEW_LABEL_KEYS.top),
    side: t(VIEW_LABEL_KEYS.side), isometric: t(VIEW_LABEL_KEYS.isometric),
  };
  const lastAnalysisLabel = lastAnalyzedAt === null ? null : t('space3d.lastAnalysis', {
    time: new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', { hour: 'numeric', minute: '2-digit' }).format(lastAnalyzedAt),
  });
  const targetSelect = <label className="space3d-target">
    <span className="space3d-visually-hidden">{t('space3d.loadTarget')}</span>
    <select
      aria-label={t('space3d.loadTarget')}
      value={analysisTargetId}
      onChange={(event) => setAnalysisTargetId(event.target.value)}
    >
      {project.loadCases.length > 0 ? <optgroup label={t('space3d.loadCase')}>
        {project.loadCases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </optgroup> : null}
      {project.loadCombinations.length > 0 ? <optgroup label={t('space3d.loadCombination')}>
        {project.loadCombinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </optgroup> : null}
    </select>
  </label>;

  return <div className="space3d-screen">
    <header className="space3d-header">
      <div className="space3d-identity">
        <BrandMark size={30} />
        <span>
          <strong>{t('space3d.title')}</strong>
          <small>{t('space3d.subtitle')}</small>
        </span>
        <span className="space3d-badge">{t('space3d.badge')}</span>
      </div>
      <div className="space3d-project-picker">
        <ChevronDown size={14} aria-hidden="true" className="space3d-project-picker-caret" />
        <span className="space3d-project-picker-label">{t('space3d.projectSelector')}</span>
        {targetSelect}
      </div>
      <nav className="space3d-destinations" aria-label={t('space3d.title')}>
        <button type="button" className="space3d-tool space3d-theme-toggle" onClick={toggleTheme} title={theme === 'light' ? t('theme.dark') : t('theme.light')}>
          {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
          <span className="space3d-visually-hidden">{theme === 'light' ? t('theme.dark') : t('theme.light')}</span>
        </button>
        {onOpenHome ? <button type="button" className="space3d-button" onClick={onOpenHome} aria-label={t('space3d.home')} title={t('space3d.home')}>
          <Home size={16} aria-hidden="true" /><span className="space3d-button-label">{t('space3d.home')}</span>
        </button> : null}
        {onOpen2D ? <button type="button" className="space3d-button" onClick={onOpen2D} aria-label={t('space3d.editor2D')} title={t('space3d.editor2D')}>
          <PenLine size={16} aria-hidden="true" /><span className="space3d-button-label">{t('space3d.editor2D')}</span>
        </button> : null}
      </nav>
    </header>

    <p className="space3d-experimental" role="note">{t('space3d.experimentalNotice')}</p>

    <div className="space3d-toolbar">
      <div className="space3d-tray" role="group" aria-label={t('space3d.toolbarProject')}>
        <button type="button" className="space3d-tool" onClick={() => requestReplace('example')}>
          <Sparkles size={16} aria-hidden="true" />{t('space3d.loadExample')}
        </button>
        <button type="button" className="space3d-tool" onClick={() => requestReplace('blank')}>
          {t('space3d.resetBlank')}
        </button>
        <button type="button" className="space3d-tool" onClick={() => setTransfer('import')}>
          <Upload size={16} aria-hidden="true" />{t('space3d.import')}
        </button>
        <button type="button" className="space3d-tool" onClick={() => setTransfer('export')}>
          <Download size={16} aria-hidden="true" />{t('space3d.export')}
        </button>
      </div>

      <div className="space3d-tray space3d-tray--layers" role="group" aria-label={t('space3d.layers')}>
        <Layers size={16} aria-hidden="true" />
        {LAYER_TOGGLES.map(({ id, key, Icon }) => <button
          key={id}
          type="button"
          className="space3d-tool space3d-tool--toggle"
          aria-pressed={layers[id]}
          onClick={() => setLayers((current) => ({ ...current, [id]: !current[id] }))}
          title={t(key)}
        >
          <Icon size={16} aria-hidden="true" />
          <span className="space3d-visually-hidden">{t(key)}</span>
        </button>)}
      </div>

      <div className="space3d-tray space3d-tray--run" role="group" aria-label={t('space3d.analyze')}>
        <button type="button" className="space3d-button space3d-button--primary" onClick={() => { void analyze(); }}
          disabled={running || pendingNotes.length > 0}
          title={pendingNotes.length > 0 ? t('space3d.bridgeBlocked', { count: pendingNotes.length }) : undefined}
        >
          <Play size={16} aria-hidden="true" />{running ? t('space3d.analyzing') : t('space3d.analyze')}
        </button>
        <button type="button" className="space3d-tool" onClick={cancelAnalysis} disabled={!running} title={t('space3d.cancelAnalysis')}>
          <CircleStop size={16} aria-hidden="true" /><span className="space3d-visually-hidden">{t('space3d.cancelAnalysis')}</span>
        </button>
      </div>
    </div>

    {sourceProject ? <section className="space3d-bridge" aria-label={t('space3d.bridgeTitle')}>
      <header>
        <strong>{t('space3d.sourceProject', { name: sourceProject.name })}</strong>
        {diverged ? <span className="space3d-state space3d-state--warn">{t('space3d.bridgeDiverged')}</span> : null}
        {diverged && derived
          ? <button type="button" className="space3d-button" title={t('space3d.rederiveWarning')} onClick={() => replaceProject(derived)}>
            {t('space3d.rederive')}
          </button>
          : null}
      </header>
      {pendingNotes.length === 0
        ? <p className="space3d-notice">{t('space3d.bridgeResolved')}</p>
        : <>
          <p className="space3d-notice space3d-notice--warn" role="status">{t('space3d.bridgeBody')}</p>
          <ul className="space3d-issues">
            {[...new Map(pendingNotes.map((item) => [item.code, item])).values()].map((item) => <li key={item.code}>
              <code>{item.code}</code>
              <span>{t(BRIDGE_KEYS[item.code] ?? 'space3d.error.generic')}</span>
              <em>{pendingNotes.filter((other) => other.code === item.code).map((other) => other.entityId).filter(Boolean).join(' ')}</em>
            </li>)}
          </ul>
          {acknowledgeable.length > 0
            ? <button
              type="button"
              className="space3d-button"
              onClick={() => setAcknowledged((current) => new Set([...current, ...acknowledgeable]))}
            >{t('space3d.bridgeAcknowledge')}</button>
            : null}
        </>}
    </section> : null}

    {errorMessage ? <p className="space3d-notice space3d-notice--error" role="alert">{errorMessage}</p> : null}

    {/* El motivo del fallo se publica junto a la acción que lo provocó, no
        escondido tras una pestaña: quien pulsa «Analizar» tiene que ver por qué
        no salió sin ir a buscarlo. */}
    {analysisState === 'failed' && analysis && analysis.issues.length > 0
      ? <div className="space3d-notice space3d-notice--error" role="alert">
        <strong>{t('space3d.analysisIssues')}</strong>
        <ul className="space3d-issue-line">
          {analysis.issues.slice(0, 4).map((issue, index) => <li key={`${issue.code}-${issue.entityId}-${index}`}>
            <code>{issue.code}</code> {t(ANALYSIS_ISSUE_KEYS[issue.code] ?? 'space3d.error.generic')}
          </li>)}
        </ul>
      </div>
      : null}

    <div className="space3d-layout">
      <Space3DToolRail
        t={t}
        activeTool={activeTool}
        onSelectTool={clearToolSelection}
        onNewNode={() => openNew('node')}
        onNewMember={() => openNew('member')}
        onNewLoad={() => openNew('load')}
        onEditSupport={editSelectedSupports}
        canNewMember={canNewMember}
        canNewLoad={canNewLoad}
        canEditSupport={canEditSupport}
        onCycleView={cycleView}
        canUndo={canUndo}
        canRedo={canRedo}
        canDelete={canDeleteSelection}
        onUndo={undo}
        onRedo={redo}
        onDelete={() => { if (editorTarget) remove(editorTarget); }}
      />

      <section className="space3d-stage" aria-label={t('space3d.canvasLabel')}>
        <Space3DCanvas
          model={scene}
          layers={layers}
          onSelect={selectEntity}
          createViewport={createViewport}
          viewLabels={viewLabels}
          activeView={activeView}
          onViewChange={setActiveView}
          zoomInLabel={t('space3d.zoomIn')}
          zoomOutLabel={t('space3d.zoomOut')}
          resetLabel={t('space3d.resetView')}
          fullscreenEnterLabel={t('space3d.fullscreenEnter')}
          fullscreenExitLabel={t('space3d.fullscreenExit')}
          copy={{
            label: t('space3d.canvasLabel'),
            fallbackTitle: t('space3d.webglTitle'),
            fallbackBody: t('space3d.webglBody'),
            retry: t('space3d.retry'),
            summaryTitle: t('space3d.canvasSummary'),
            nodes: t('space3d.nodes'),
            members: t('space3d.members'),
            supports: t('space3d.supports'),
            loads: t('space3d.loads'),
          }}
        />
        {scene.deformed ? <div className="space3d-scale" role="group" aria-label={t('space3d.layerDeformed')}>
          <span role="status" aria-live="polite">
            {t('space3d.deformationScale', { scale: formatNumber(scene.deformed.scale, 'table', { significantDigits: 4 }) })}
            <span data-testid="space3d-deformation-scale" className="space3d-visually-hidden">{scene.deformed.scale}</span>
          </span>
          <button type="button" className="space3d-tool" title={t('space3d.scaleHalve')}
            disabled={effectiveScaleFactor <= SCALE_FACTOR_MIN}
            onClick={() => setScaleFactor((current) => Math.max(SCALE_FACTOR_MIN, (current ?? 1) / 2))}>
            <Minus size={16} aria-hidden="true" /><span className="space3d-visually-hidden">{t('space3d.scaleHalve')}</span>
          </button>
          <button type="button" className="space3d-tool" title={t('space3d.scaleDouble')}
            disabled={effectiveScaleFactor >= SCALE_FACTOR_MAX}
            onClick={() => setScaleFactor((current) => Math.min(SCALE_FACTOR_MAX, (current ?? 1) * 2))}>
            <Plus size={16} aria-hidden="true" /><span className="space3d-visually-hidden">{t('space3d.scaleDouble')}</span>
          </button>
          <button type="button" className="space3d-tool" disabled={scaleFactor === null}
            onClick={() => setScaleFactor(null)}>{t('space3d.scaleAuto')}</button>
        </div> : null}
        <p className="space3d-help">{t('space3d.interactionHelp')}</p>
      </section>

      <div className="space3d-sheet" data-expanded={sheetExpanded || undefined}>
        <button
          type="button"
          className="space3d-sheet-handle"
          onClick={() => setSheetExpanded((current) => !current)}
          aria-expanded={sheetExpanded}
        >
          <span className="space3d-sheet-handle-bar" aria-hidden="true" />
          <span className="space3d-visually-hidden">{sheetExpanded ? t('space3d.mobileSheetCollapse') : t('space3d.mobileSheetExpand')}</span>
        </button>

        <aside className="space3d-model-nav-panel">
          <Space3DModelNav
            t={t}
            counts={modelCounts}
            focus={modelNavFocus}
            onFocusChange={focusModelSection}
            views={SPACE3D_VIEW_PRESETS}
            viewLabels={viewLabels}
            activeView={activeView}
            onViewChange={setActiveView}
            properties={modelProperties}
            propertiesOpen={propertiesOpen}
            onToggleProperties={() => setPropertiesOpen((current) => !current)}
          />
        </aside>

        <aside className="space3d-rail">
        <div className="space3d-tabs space3d-tray" role="tablist" aria-label={t('space3d.title')}>
          <button type="button" role="tab" className="space3d-tab" aria-selected={rail === 'model'} onClick={() => setRail('model')}>{t('space3d.tabInspector')}</button>
          <button type="button" role="tab" className="space3d-tab" aria-selected={rail === 'results'} onClick={() => setRail('results')}>{t('space3d.tabResults')}</button>
        </div>

        {rail === 'model' ? <div className="space3d-rail-body">
          {scene.isEmpty ? <div className="space3d-empty">
            <strong>{t('space3d.emptyModelTitle')}</strong>
            <p>{t('space3d.emptyModelBody')}</p>
          </div> : null}

          <div className="space3d-table-scroll" id="space3d-table-node">
            <table className="space3d-table" aria-label={t('space3d.nodes')}>
              <thead>
                <tr>
                  <th scope="col">{t('space3d.node')}</th>
                  <th scope="col">X</th><th scope="col">Y</th><th scope="col">Z</th>
                  <th scope="col">{t('space3d.restraints')}</th>
                </tr>
              </thead>
              <tbody>
                {project.nodes.map((node) => <tr key={node.id} aria-selected={selectedEntity?.kind === 'node' && selectedEntity.id === node.id}>
                  <th scope="row">
                    <button type="button" className="space3d-linkish" onClick={() => selectEntity({ kind: 'node', id: node.id })}>{node.id}</button>
                  </th>
                  <td>{number(node.x)}</td><td>{number(node.y)}</td><td>{number(node.z)}</td>
                  <td>{countRestraints(node.restraints)}</td>
                </tr>)}
              </tbody>
            </table>
            {project.nodes.length === 0 ? <p className="space3d-notice">{t('space3d.emptyNodes')}</p> : null}
          </div>

          <div className="space3d-table-scroll" id="space3d-table-member">
            <table className="space3d-table" aria-label={t('space3d.members')}>
              <thead>
                <tr>
                  <th scope="col">{t('space3d.member')}</th>
                  <th scope="col">{t('space3d.endI')}</th>
                  <th scope="col">{t('space3d.endJ')}</th>
                  <th scope="col">A</th><th scope="col">Iz</th>
                </tr>
              </thead>
              <tbody>
                {project.members.map((member) => <tr key={member.id}>
                  <th scope="row">
                    <button type="button" className="space3d-linkish" onClick={() => selectEntity({ kind: 'member', id: member.id })}>{member.id}</button>
                  </th>
                  <td>{member.i}</td><td>{member.j}</td>
                  <td>{member.A}</td><td>{member.Iz}</td>
                </tr>)}
              </tbody>
            </table>
            {project.members.length === 0 ? <p className="space3d-notice">{t('space3d.emptyMembers')}</p> : null}
          </div>

          <div className="space3d-table-scroll" id="space3d-table-load">
            <table className="space3d-table" aria-label={t('space3d.loads')}>
              <thead>
                <tr>
                  <th scope="col">{t('space3d.load')}</th>
                  <th scope="col">{t('space3d.node')}</th>
                  <th scope="col">Fx</th><th scope="col">Fy</th><th scope="col">Fz</th>
                </tr>
              </thead>
              <tbody>
                {project.nodalLoads.map((load) => <tr key={load.id}>
                  <th scope="row">
                    <button type="button" className="space3d-linkish" onClick={() => selectEntity({ kind: 'load', id: load.id })}>{load.id}</button>
                  </th>
                  <td>{load.nodeId}</td>
                  <td>{number(load.fx)}</td><td>{number(load.fy)}</td><td>{number(load.fz)}</td>
                </tr>)}
              </tbody>
            </table>
            {project.nodalLoads.length === 0 ? <p className="space3d-notice">{t('space3d.emptyLoads')}</p> : null}
          </div>

          {editorTarget
            ? <Space3DEntityEditor
              project={project}
              target={editorTarget}
              t={t}
              onSubmit={submit}
              onCancel={() => setEditorTarget(null)}
              onDelete={remove}
            />
            : <p className="space3d-notice">{t('space3d.noSelection')}</p>}
        </div> : <div className="space3d-rail-body">
          <Space3DResultsPanel
            analysis={analysis}
            analysisState={analysisState}
            tab={resultsTab}
            onTabChange={setResultsTab}
            deformationScale={scene.deformed?.scale ?? null}
            maxDisplacement={scene.deformed?.maxDisplacement ?? null}
            t={t}
            onSelectNode={(id) => selectEntity({ kind: 'node', id })}
            onSelectMember={(id) => selectEntity({ kind: 'member', id })}
          />
        </div>}
      </aside>
      </div>
    </div>

    {transfer ? <div className="space3d-transfer" role="group" aria-label={transfer === 'import' ? t('space3d.import') : t('space3d.export')}>
      <label className="space3d-field">
        <span className="space3d-field-label">{transfer === 'import' ? t('space3d.transferImportLabel') : t('space3d.transferExportLabel')}</span>
        <textarea
          rows={6}
          spellCheck={false}
          readOnly={transfer === 'export'}
          placeholder={transfer === 'import' ? t('space3d.importPlaceholder') : undefined}
          value={transfer === 'export' ? exportPortable() : importText}
          onChange={(event) => setImportText(event.target.value)}
        />
      </label>
      <div className="space3d-inline-actions">
        {transfer === 'import' ? <button
          type="button"
          className="space3d-button space3d-button--primary"
          onClick={() => {
            if (importPortable(importText).ok) {
              setTransfer(null);
              setImportText('');
              setEditorTarget(null);
            }
          }}
        >{t('space3d.importConfirm')}</button> : null}
        <button type="button" className="space3d-button" onClick={() => setTransfer(null)}>{t('space3d.importCancel')}</button>
      </div>
    </div> : null}

    <Dialog
      open={pendingReplace !== null}
      onOpenChange={(open) => { if (!open) setPendingReplace(null); }}
      title={pendingReplace === 'example' ? t('space3d.confirmReplaceTitleExample') : t('space3d.confirmReplaceTitleBlank')}
      description={pendingReplace === 'example' ? t('space3d.confirmReplaceBodyExample') : t('space3d.confirmReplaceBodyBlank')}
      footer={<>
        <button type="button" className="space3d-button" onClick={() => setPendingReplace(null)}>
          {t('space3d.confirmReplaceCancel')}
        </button>
        <button type="button" className="space3d-button space3d-button--primary" onClick={confirmReplace}>
          {t('space3d.confirmReplaceConfirm')}
        </button>
      </>}
    >{null}</Dialog>

    <footer className="space3d-status" aria-label={t('space3d.title')}>
      <span className={`space3d-state space3d-state--${STATE_TONES[analysisState]}`}>{t(STATE_KEYS[analysisState])}</span>
      <span><b>{project.nodes.length}</b> {t('space3d.nodes')}</span>
      <span><b>{project.members.length}</b> {t('space3d.members')}</span>
      <span><b>{project.nodalLoads.length}</b> {t('space3d.loads')}</span>
      <span><b>{project.nodes.length * 6}</b> {t('space3d.dofCount')}</span>
      <span>{t('space3d.analysisTarget', { id: analysisTargetId })}</span>
      {lastAnalysisLabel ? <span className="space3d-status-last">{lastAnalysisLabel}</span> : null}
      <span className="space3d-status-units">{t('space3d.unitsChip')}</span>
      <span data-testid="space3d-analysis-state" className="space3d-visually-hidden">{analysisState}</span>
      <span data-testid="space3d-deformed-visible" className="space3d-visually-hidden">{String(scene.deformed !== null)}</span>
    </footer>
  </div>;
};

/**
 * Resolucion del proyecto inicial.
 *
 * Con un proyecto 2D de origen se reabre el modelo espacial ya asociado a el si
 * sigue correspondiendole; solo cuando no existe se deriva uno nuevo. Asi,
 * volver al 2D y entrar otra vez no duplica nada ni descarta el trabajo 3D.
 */
const Space3DWorkspace = ({ storage, client, sourceProject, ...rest }: Space3DWorkspaceProps) => {
  const bridge = useMemo(
    () => (sourceProject ? deriveSpace3DFromPlanarProject(sourceProject) : null),
    [sourceProject],
  );
  const namespace = sourceProject ? `src:${sourceProject.id}` : undefined;
  const initialProject = useMemo(() => {
    if (!bridge) return undefined;
    const stored = loadSpace3DProject(storage ?? undefined, namespace);
    return stored && stored.id === bridge.project.id ? stored : bridge.project;
    // El proyecto inicial se resuelve una vez por origen; despues manda el store.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, namespace]);

  return (
    <Space3DProjectProvider storage={storage} client={client} namespace={namespace} initialProject={initialProject}>
      <WorkspaceBody
        {...rest}
        sourceProject={sourceProject}
        bridgeNotes={bridge?.notes ?? []}
        derived={bridge?.project ?? null}
      />
    </Space3DProjectProvider>
  );
};

export default Space3DWorkspace;
