import { lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { X } from 'lucide-react';
import { useProject } from '../../store/ProjectContext';
import type { DiagramPoint, MemberModel, Selection } from '../../types';
import { evaluateDiagramAt } from '../../engine/diagram';
import { toDisplay } from '../../engine/units';
import { exportSvgAsPng, exportSvgElement } from '../../utils/export';
import { formatFixed } from '../../utils/numberFormat';
import { copyModelSelection, type ModelClipboard } from '../../data/modelOperations';
import { type SnapKind } from '../../utils/snapping';
import { useI18n } from '../../i18n/useI18n';
import { usePhase2I18n } from '../../i18n/usePhase2I18n';
import {
  cameraForViewportResize,
  cameraForPinch,
  LONG_PRESS_MS,
  LONG_PRESS_JITTER_PX,
  midpoint,
  movedPastThreshold,
  panCameraFrom,
  pendingDragIntent,
  pointDistance,
  screenToModelPoint,
  shouldArmLongPress,
  shouldTriggerLongPress,
  zoomCameraAt,
  type ScreenPoint,
} from './canvasInteraction';
import {
  CANVAS_SCENE_ID,
  EMPTY_STRUCTURAL_EDIT_NODE_IDS,
  IDLE_INTERACTION,
  clamp,
  contextualActionLabelKeys,
  toolLabelKeys,
  type Camera,
  type CanvasInteractionState as CanvasInteraction,
  type CutInfo,
  type Size,
} from './canvasVocabulary';
import { toolFromShortcut } from './toolRegistry';
import { countOf, selectionQueryById, toSelection } from './selectByProperty';
import { CANVAS_REFERENCE_SCALE, canvasSafeInsetsFor, canvasSafeRect } from './canvasChromeGeometry';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';
import { CanvasChrome } from './CanvasChrome';
import { layoutSmartLabels, smartLabelDetailForScale } from './labelLayout';
import { selectionEnvelopeForPoints } from './selectionVisuals';
import { emitWorkspaceCommand, onWorkspaceCommand, type FocusableSelection } from '../workspace/workspaceCommands';
import { CanvasGeometryLayer, type StructuralTarget } from './CanvasGeometryLayer';
import {
  grossRatioAtPoint,
  memberAxis,
} from '../../graphics/structureGeometry';
import { CanvasResultLayer } from './CanvasResultLayer';
import { buildCanvasLabelCandidates } from './canvasLabelSources';
import { CanvasInteractionLayer } from './CanvasInteractionLayer';
import { CanvasNavigator } from './CanvasNavigator';
import { CanvasTouchLoupe } from './CanvasTouchLoupe';
import { CandidatePicker } from './CanvasCandidatePicker';
import {
  activeCandidate,
  cycleCandidatePicker,
  type CandidatePickerState,
  type CandidateTarget,
} from './candidatePicker';
import { SurfacePresentationContext } from '../workspace/SurfacePresentationContext';
import { readCanvasViewSettings, withCanvasViewSettings } from '../view/canvasViewSettings';
import { ELASTIC_SATURATION_RATIO } from '../results/elasticDemand';
import { resolveRepeatRecipe, type RepeatRecipe } from './repeatAction';
import { RepeatActionOverlay } from './RepeatActionOverlay';
import { prepareDuplicatePreview } from './duplicatePreview';
import { ContextualActions, type ContextualActionAvailability, type ContextualActionId } from './ContextualActions';
import { supportsClipboardReadText } from './structuralClipboard';
import {
  createStructuralEditGeometryPreview,
  prepareStructuralEdit,
  resolveStructuralSelection,
  structuralEditSnapshot,
  type PreparedStructuralEdit,
  type StructuralEditGeometryPreview,
} from '../../data/structuralEditing';
import {
  buildStructuralEditRequest,
  structuralEditCapabilities,
  structuralEditSelectionAnchor,
  updateDraftFromPointer,
  type StructuralEditDraft,
} from './structuralEditUi';
import { StructuralEditOverlay } from './StructuralEditOverlay';
import { CanvasStructuralEditPreviewLayer } from './CanvasStructuralEditPreviewLayer';
import { CanvasStructureGeneratorLayer } from './CanvasStructureGeneratorLayer';
import { CutInspector } from './CutInspector';
import { useCanvasDerivedGeometry } from './useCanvasDerivedGeometry';
import { useCanvasCoordinates } from './useCanvasCoordinates';
import { useCanvasInteractionLoop } from './useCanvasInteractionLoop';
import { useStableCanvasEvent } from './useStableCanvasEvent';
import { useCanvasModelActions } from './useCanvasModelActions';
import { useCanvasToolDispatch } from './useCanvasToolDispatch';
import { useCanvasStructuralEdit } from './useCanvasStructuralEdit';
import type { StructureGenerationGhost } from '../../data/generators/generatorGhost';

/**
 * El generador y su núcleo determinista sólo pesan cuando se abre: nadie paga su
 * código —ni el de los catálogos que ofrece— por arrancar el editor.
 */
const LazyStructureGeneratorSurface = lazy(() =>
  import('../structure-generator/StructureGeneratorSurface')
    .then((module) => ({ default: module.StructureGeneratorSurface })));
import './phase2.css';

export const StructuralCanvas = ({
  onRequestInspector,
  layers,
  dispatchLayers,
}: {
  onRequestInspector?: () => void;
  layers: EditorLayerState;
  dispatchLayers: (action: EditorLayerAction) => void;
}) => {
  const {
    project,
    analysis,
    activeTool,
    selection,
    resultTab,
    setResultTab,
    selectedCombinationId,
    setSelection,
    setActiveTool,
    executeProjectCommand,
    executePreparedStructuralEdit,
    updateProject,
    updateProjectView,
    replaceProject,
    beginProjectTransaction,
    moveNodeTransient,
    commitProjectTransaction,
    cancelProjectTransaction,
    learningFocus,
    resultCursor,
    influenceCanvasState,
    modeShapeState,
  } = useProject();
  const view = readCanvasViewSettings(project);
  const setView = useCallback((patch: Partial<typeof view>) => {
    updateProjectView((draft) => withCanvasViewSettings(draft, patch));
  }, [updateProjectView]);
  const { language, t } = useI18n();
  const { t: phase2T } = usePhase2I18n(language);
  /** The broker owns Compact contextual-layer exclusivity; candidate identity stays local below. */
  const surfaceBroker = useContext(SurfacePresentationContext);
  const candidatePickerSurface = surfaceBroker?.stateFor('candidatePicker');
  const contextualActionsSurface = surfaceBroker?.stateFor('contextualActions');
  const openContextualActionsSurface = surfaceBroker?.openSurface;
  const closeContextualActionsSurface = surfaceBroker?.closeSurface;
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const coordinateReadoutRef = useRef<HTMLOutputElement>(null);
  const [size, setSize] = useState<Size>({ width: 1000, height: 640 });
  const [canvasMeasured, setCanvasMeasured] = useState(false);
  const [camera, setCamera] = useState<Camera>({ scale: CANVAS_REFERENCE_SCALE, x: 260, y: 500 });
  const [memberStart, setMemberStart] = useState<string | null>(null);
  const [cut, setCut] = useState<CutInfo | null>(null);
  const [interaction, setInteractionState] = useState<CanvasInteraction>(IDLE_INTERACTION);
  const [spacePressed, setSpacePressed] = useState(false);
  const [snapPreview, setSnapPreview] = useState<{ x: number; y: number; kind: SnapKind } | null>(null);
  const [quickEntry, setQuickEntry] = useState({ first: '', second: '' });
  const [quickEntryMode, setQuickEntryMode] = useState<'delta' | 'polar'>('delta');
  const [quickEntryError, setQuickEntryError] = useState('');
  const [candidatePicker, setCandidatePicker] = useState<CandidatePickerState | null>(null);
  const [repeatRecipe, setRepeatRecipe] = useState<RepeatRecipe | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<{ selection: Selection; x: string; y: string } | null>(null);
  const [structuralEditDraft, setStructuralEditDraft] = useState<StructuralEditDraft | null>(null);
  const [structuralEditLiveDraft, setStructuralEditLiveDraft] = useState<StructuralEditDraft | null>(null);
  const [structuralEditPointerArmed, setStructuralEditPointerArmed] = useState(false);
  const [structuralEditCommitError, setStructuralEditCommitError] = useState('');
  /**
   * Generador de estructuras. El lienzo guarda sólo lo que tiene que dibujar
   * —el ghost y su ancla— y quién está pidiendo un punto; los parámetros viven
   * en la superficie, que es la única que sabe traducirlos.
   */
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorGhost, setGeneratorGhost] = useState<StructureGenerationGhost | null>(null);
  const [generatorOrigin, setGeneratorOrigin] = useState<{ x: number; y: number } | null>(null);
  const [generatorOriginPicking, setGeneratorOriginPicking] = useState(false);
  const [generatorPickedOrigin, setGeneratorPickedOrigin] = useState<{ x: number; y: number; token: number } | null>(null);
  const generatorOriginPickingRef = useRef(false);
  const generatorPickTokenRef = useRef(0);
  const [touchLoupe, setTouchLoupe] = useState<{ screenX: number; screenY: number; modelX: number; modelY: number } | null>(null);
  const spacePressedRef = useRef(false);
  const interactionRef = useRef<CanvasInteraction>(IDLE_INTERACTION);
  const cameraRef = useRef(camera);
  const activePointersRef = useRef(new Map<number, ScreenPoint>());
  const longPressTimerRef = useRef<number | null>(null);
  const clipboardRef = useRef<ModelClipboard | null>(null);
  const pasteCountRef = useRef(1);
  const cameraFrameRef = useRef<number | null>(null);
  const interactionFrameRef = useRef<number | null>(null);
  const nodeMoveFrameRef = useRef<number | null>(null);
  const pendingNodeMoveRef = useRef<{ nodeId: string; point: { x: number; y: number } } | null>(null);
  const structuralEditFrameRef = useRef<number | null>(null);
  const pendingStructuralEditDraftRef = useRef<StructuralEditDraft | null>(null);
  const structuralEditLiveDraftRef = useRef<StructuralEditDraft | null>(null);
  const structuralEditApplyingRef = useRef(false);
  const longPressMotionRef = useRef<{ pointerId: number; start: ScreenPoint; current: ScreenPoint } | null>(null);
  const previousSizeRef = useRef<Size | null>(null);
  const fittedProjectRef = useRef<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const [canvasFeedback, setCanvasFeedback] = useState('');
  // This carries no clipboard availability or selection data. It only asks
  // React to re-read the existing in-app clipboard ref after Copy succeeds.
  const [, refreshClipboardAvailability] = useState(0);

  // This intent is wholly derived from the canonical workspace selection. The
  // broker stores only its presentation lifecycle, never a copied selection —
  // and, being derived, it never outranks a surface the user opened. The
  // Candidate Picker's precedence over it is the broker's, by surface role and
  // in any opening order (CRI-108); it used to need a re-activation from here
  // to win the "latest activation" race.
  useEffect(() => {
    if (!openContextualActionsSurface || !closeContextualActionsSurface) return;
    if (selection) openContextualActionsSurface('contextualActions');
    else closeContextualActionsSurface('contextualActions');
  }, [closeContextualActionsSurface, openContextualActionsSurface, selection]);

  const selectionBox = interaction.kind === 'selection-box' ? interaction : null;
  const candidatePreview = candidatePicker ? activeCandidate(candidatePicker) : null;
  const repeatCandidate = useMemo(() => resolveRepeatRecipe(project, selection), [project, selection]);
  const editCapabilities = useMemo(() => structuralEditCapabilities(project, selection), [project, selection]);
  const hasInAppClipboard = Boolean(clipboardRef.current);
  const contextualActionAvailability = useMemo<ContextualActionAvailability>(() => {
    const browserClipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    return {
      copy: Boolean(copyModelSelection(project, selection)),
      paste: hasInAppClipboard || supportsClipboardReadText(browserClipboard),
      duplicate: Boolean(selection && ['node', 'member', 'multi'].includes(selection.kind)),
      repeat: Boolean(repeatCandidate),
      datasheet: Boolean(selection),
      structuralEdit: editCapabilities.structural,
      /* Sólo cuando de verdad hay MÁS de lo ya seleccionado. Ofrecer
         «Seleccionar similares» sobre la única barra de su clase es ofrecer una
         acción que no cambia nada. */
      selectSimilar: countOf(selectionQueryById('members.similar').run(project, selection))
        > (selection?.kind === 'multi' ? selection.memberIds.length : selection?.kind === 'member' ? 1 : 0),
    };
  }, [editCapabilities.structural, hasInAppClipboard, project, repeatCandidate, selection]);
  const structuralEditPreview = useMemo((): { prepared: PreparedStructuralEdit | null; error: string } => {
    if (!structuralEditDraft) return { prepared: null, error: '' };
    if (structuralEditDraft.sourceSnapshot !== structuralEditSnapshot(project)) {
      return { prepared: null, error: t('modelDoctor.previewStaleBody') };
    }
    try {
      return {
        prepared: prepareStructuralEdit(project, buildStructuralEditRequest(project, structuralEditDraft)),
        error: '',
      };
    } catch (error) {
      return { prepared: null, error: error instanceof Error ? error.message : t('canvas.twoValidNumbers') };
    }
  }, [project, structuralEditDraft, t]);
  const structuralEditLivePreview = useMemo((): { preview: StructuralEditGeometryPreview | null; error: string } => {
    if (!structuralEditLiveDraft || structuralEditPreview.error) return { preview: null, error: structuralEditPreview.error };
    try {
      return {
        preview: createStructuralEditGeometryPreview(project, buildStructuralEditRequest(project, structuralEditLiveDraft)),
        error: '',
      };
    } catch (error) {
      return { preview: null, error: error instanceof Error ? error.message : t('canvas.twoValidNumbers') };
    }
  }, [project, structuralEditLiveDraft, structuralEditPreview.error, t]);
  const structuralEditExcludedNodeIds = useMemo(() => {
    // A gesture only changes parameters. Its structural closure is fixed from
    // the source draft, so do not rebuild this O(N + M) set on every rAF frame.
    const draft = structuralEditDraft;
    if (!draft) return EMPTY_STRUCTURAL_EDIT_NODE_IDS;
    try {
      return new Set(resolveStructuralSelection(project, draft.selection).nodeIds);
    } catch {
      return EMPTY_STRUCTURAL_EDIT_NODE_IDS;
    }
  }, [project, structuralEditDraft]);
  const structuralEditFocusSession = structuralEditDraft?.sourceSnapshot ?? null;
  useEffect(() => {
    if (!structuralEditFocusSession) return undefined;
    // Run after the surface is committed. This is deliberately session-scoped
    // (not draft-scoped), so numeric typing never steals focus back but a mobile
    // sheet handoff reliably lands on the first parameter field.
    const frame = window.requestAnimationFrame(() => {
      hostRef.current?.querySelector<HTMLInputElement>('.structural-edit-surface input')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [structuralEditFocusSession]);
  const duplicatePreview = useMemo(() => {
    if (!duplicateDraft) return null;
    try {
      if (!duplicateDraft.x.trim() || !duplicateDraft.y.trim()) throw new Error(phase2T('canvas.invalidOffset'));
      return {
        prepared: prepareDuplicatePreview(project, duplicateDraft.selection, {
          x: Number(duplicateDraft.x),
          y: Number(duplicateDraft.y),
        }),
        error: '',
      };
    } catch (error) {
      return { prepared: null, error: error instanceof Error ? error.message : phase2T('canvas.invalidOffset') };
    }
  }, [duplicateDraft, phase2T, project]);

  const confirmDuplicate = useCallback(async () => {
    if (!duplicatePreview?.prepared) return;
    await executeProjectCommand(duplicatePreview.prepared.command);
    const nodeIds = duplicatePreview.prepared.addedNodes.map((node) => node.id);
    const memberIds = duplicatePreview.prepared.addedMembers.map((member) => member.id);
    if (memberIds.length === 1 && nodeIds.length === 0) setSelection({ kind: 'member', id: memberIds[0] });
    else if (nodeIds.length === 1 && memberIds.length === 0) setSelection({ kind: 'node', id: nodeIds[0] });
    else setSelection({ kind: 'multi', nodeIds, memberIds });
    setDuplicateDraft(null);
  }, [duplicatePreview, executeProjectCommand, setSelection]);

  const {
    nodeMap,
    memberMap,
    baseSnapCandidates,
    drawingOrigin,
    perpendicularSnapCandidates,
    resultMap,
    nodeResultMap,
    mechanismMap,
    units,
    selectionFilter,
    resultsAllowed,
    lengthLabel,
    forceLabel,
    momentLabel,
    distributedLabel,
    selectionVisualState,
    loadPlacementInstruction,
    loadsLayerVisible,
    demandMapActive,
    heatmapRatios,
    demandLegend,
    minimapViewport,
    cutDemand,
    cutEquilibrium,
  } = useCanvasDerivedGeometry({
    project,
    analysis,
    view,
    camera,
    canvasMeasured,
    size,
    selection,
    memberStart,
    activeTool,
    selectedCombinationId,
    loadsLayerFromEditor: layers.loads,
    heatmapLayerFromEditor: layers.heatmap,
    cut,
    t,
  });

  const {
    transitionInteraction,
    updateCamera,
    scheduleInteractionFrame,
    flushNodeMove,
    scheduleNodeMove,
    flushStructuralEditDraft,
    scheduleStructuralEditDraft,
    cancelNodeDragTransaction,
    showCanvasFeedback,
    clearLongPressTimer,
  } = useCanvasInteractionLoop({
    interactionRef,
    setInteractionState,
    cameraRef,
    setCamera,
    cameraFrameRef,
    interactionFrameRef,
    nodeMoveFrameRef,
    pendingNodeMoveRef,
    structuralEditFrameRef,
    pendingStructuralEditDraftRef,
    structuralEditLiveDraftRef,
    setStructuralEditDraft,
    setStructuralEditLiveDraft,
    feedbackTimerRef,
    setCanvasFeedback,
    longPressTimerRef,
    longPressMotionRef,
    moveNodeTransient,
    cancelProjectTransaction,
  });

  const { toScreen, toModel, localScreenPoint, updateCoordinateReadout, fitModel, navigateMinimapTo } = useCanvasCoordinates({
    camera,
    cameraRef,
    svgRef,
    coordinateReadoutRef,
    size,
    nodes: project.nodes,
    units,
    lengthLabel,
    updateCamera,
  });

  useEffect(() => {
    if (!hostRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
      setCanvasMeasured(true);
    });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasMeasured || !size.width || !size.height) return;
    const previousSize = previousSizeRef.current;
    const currentSize = { width: size.width, height: size.height };
    previousSizeRef.current = currentSize;

    if (!project.nodes.length) return;
    if (fittedProjectRef.current !== project.id) {
      fittedProjectRef.current = project.id;
      fitModel();
      return;
    }
    if (previousSize && (previousSize.width !== currentSize.width || previousSize.height !== currentSize.height)) {
      updateCamera((current) => cameraForViewportResize(current, previousSize, currentSize));
    }
  }, [canvasMeasured, fitModel, project.id, project.nodes.length, size.height, size.width, updateCamera]);

  useEffect(() => {
    const focusObject = (detail: FocusableSelection) => {
      if (!detail) return;
      let point: { x: number; y: number } | null = null;
      if (detail.kind === 'node') {
        const node = nodeMap.get(detail.id);
        if (node) point = { x: node.x, y: node.y };
      } else if (detail.kind === 'nodalLoad') {
        const load = project.nodalLoads.find((item) => item.id === detail.id);
        const node = load ? nodeMap.get(load.nodeId) : undefined;
        if (node) point = { x: node.x, y: node.y };
      } else {
        const memberId = detail.kind === 'member'
          ? detail.id
          : project.memberLoads.find((load) => load.id === detail.id)?.memberId;
        const member = memberId ? memberMap.get(memberId) : undefined;
        const nodeI = member ? nodeMap.get(member.i) : undefined;
        const nodeJ = member ? nodeMap.get(member.j) : undefined;
        if (nodeI && nodeJ) point = { x: (nodeI.x + nodeJ.x) / 2, y: (nodeI.y + nodeJ.y) / 2 };
      }
      if (!point) return;
      const scale = Math.max(CANVAS_REFERENCE_SCALE, cameraRef.current.scale);
      updateCamera({ scale, x: size.width / 2 - point.x * scale, y: size.height / 2 + point.y * scale });
      showCanvasFeedback(t('canvas.objectCentered', { id: detail.id }));
      // "Localizar" from a peeked Datasheet/Doctor moves DOM focus here: the
      // background stops being inert the moment the surface degrades, and
      // leaving focus behind on a now-shrunk handle would strand it (CRI-102).
      window.requestAnimationFrame(() => svgRef.current?.focus({ preventScroll: true }));
    };
    return onWorkspaceCommand('focus-object', focusObject);
  }, [memberMap, nodeMap, project.memberLoads, project.nodalLoads, showCanvasFeedback, size.height, size.width, t, updateCamera]);

  useEffect(() => {
    const baseName = project.name.replace(/\s+/g, '-').toLowerCase();
    // The drawing is exported over the background the user is actually looking at: a
    // dark-theme canvas on a transparent page would be invisible in most viewers.
    const options = {
      background: 'current' as const,
      title: project.name,
      description: t('canvas.exportDescription', { project: project.name }),
    };
    const exportSvg = () => svgRef.current && exportSvgElement(svgRef.current, `${baseName}.svg`, options);
    const exportPng = () => {
      if (!svgRef.current) return;
      exportSvgAsPng(svgRef.current, `${baseName}.png`, options)
        .catch((error: unknown) => showCanvasFeedback(error instanceof Error ? error.message : t('canvas.exportFailed')));
    };
    const unsubscribes = [
      onWorkspaceCommand('export-svg', exportSvg),
      onWorkspaceCommand('export-png', exportPng),
    ];
    return () => { for (const unsubscribe of unsubscribes) unsubscribe(); };
  }, [project.name, showCanvasFeedback, t]);

  const {
    snapPoint,
    modelPointFromClient,
    nodeDragPointFromClient,
    deleteSelection,
    addNode,
    createMemberEndpoint,
    submitQuickEntry,
    cancelQuickEntry,
    activateRepeat,
    copyStructuralSelection,
    pasteStructuralSelection,
    startDuplicate,
    selectStructuralTarget,
    candidateTargetsAtPoint,
    closeCandidatePicker,
    openCandidatePicker,
    confirmCandidatePicker,
    setCandidatePickerIndex,
  } = useCanvasModelActions({
    project,
    selection,
    setSelection,
    activeTool,
    setActiveTool,
    executeProjectCommand,
    updateProject,
    replaceProject,
    nodeMap,
    memberStart,
    setMemberStart,
    repeatRecipe,
    setRepeatRecipe,
    quickEntry,
    setQuickEntry,
    quickEntryMode,
    setQuickEntryError,
    units,
    view,
    camera,
    cameraRef,
    size,
    drawingOrigin,
    baseSnapCandidates,
    perpendicularSnapCandidates,
    setSnapPreview,
    localScreenPoint,
    selectionFilter,
    clipboardRef,
    pasteCountRef,
    refreshClipboardAvailability,
    setDuplicateDraft,
    showCanvasFeedback,
    svgRef,
    candidatePicker,
    setCandidatePicker,
    surfaceBroker,
    t,
  });

  const capturePointer = useCallback((pointerId: number) => {
    try { svgRef.current?.setPointerCapture(pointerId); } catch { /* Pointer may already be cancelled. */ }
  }, []);

  const releasePointer = useCallback((pointerId: number) => {
    try {
      if (svgRef.current?.hasPointerCapture(pointerId)) svgRef.current.releasePointerCapture(pointerId);
    } catch { /* The browser already released it. */ }
  }, []);

  const startPan = useCallback((
    pointerId: number,
    pointerType: string,
    start: ScreenPoint,
    clearSelectionOnTap: boolean,
    moved = false,
    startCamera = cameraRef.current,
  ) => {
    clearLongPressTimer();
    capturePointer(pointerId);
    transitionInteraction({
      kind: 'pan', pointerId, pointerType, start, camera: startCamera, moved, clearSelectionOnTap,
    });
  }, [capturePointer, clearLongPressTimer, transitionInteraction]);

  const startStructuralEditPointer = useCallback((event: ReactPointerEvent) => {
    const draft = structuralEditDraft;
    if (!draft || !structuralEditPointerArmed || event.button !== 0) return false;
    event.preventDefault();
    clearLongPressTimer();
    const raw = screenToModelPoint(localScreenPoint(event.clientX, event.clientY), cameraRef.current);
    const start = draft.kind === 'move'
      ? structuralEditSelectionAnchor(project, draft.selection)
      : modelPointFromClient(event.clientX, event.clientY);
    const grabOffset = draft.kind === 'move'
      ? { x: start.x - raw.x, y: start.y - raw.y }
      : { x: 0, y: 0 };
    capturePointer(event.pointerId);
    transitionInteraction({
      kind: 'structural-edit',
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      start,
      grabOffset,
      beforeDraft: draft,
    });
    if (draft.kind === 'mirror' && draft.fields.mirrorAxis !== 'arbitrary') {
      try {
        scheduleStructuralEditDraft(updateDraftFromPointer(draft, project, { start, current: start }));
      } catch (error) {
        setStructuralEditCommitError(error instanceof Error ? error.message : t('canvas.twoValidNumbers'));
      }
    }
    return true;
  }, [capturePointer, clearLongPressTimer, localScreenPoint, modelPointFromClient, project, scheduleStructuralEditDraft, structuralEditDraft, structuralEditPointerArmed, t, transitionInteraction]);

  /**
   * Un solo clic entrega el origen de inserción y desarma el puntero.
   *
   * Se resuelve antes que cualquier herramienta y antes de la guardia que
   * ignora los objetos del modelo: elegir el origen sobre un nudo existente es
   * justamente el caso que más se quiere —el punto se ajusta a él— y no un
   * accidente que haya que evitar. No abre interacción ni captura el puntero
   * porque no hay arrastre: es un punto, no un gesto.
   */
  const pickGeneratorOrigin = useCallback((event: ReactPointerEvent): boolean => {
    if (!generatorOriginPickingRef.current || event.button !== 0) return false;
    event.preventDefault();
    clearLongPressTimer();
    const point = modelPointFromClient(event.clientX, event.clientY);
    generatorPickTokenRef.current += 1;
    setGeneratorPickedOrigin({ x: point.x, y: point.y, token: generatorPickTokenRef.current });
    generatorOriginPickingRef.current = false;
    setGeneratorOriginPicking(false);
    return true;
  }, [clearLongPressTimer, modelPointFromClient]);

  const toggleGeneratorOriginPick = useCallback(() => {
    setGeneratorOriginPicking((armed) => {
      const next = !armed;
      generatorOriginPickingRef.current = next;
      return next;
    });
  }, []);

  /** El punto ya llegó al formulario; el lienzo puede olvidarlo. */
  const resolveGeneratorOriginPick = useCallback(() => setGeneratorPickedOrigin(null), []);

  const closeGenerator = useCallback(() => {
    setGeneratorOpen(false);
    setGeneratorGhost(null);
    setGeneratorOrigin(null);
    setGeneratorOriginPicking(false);
    generatorOriginPickingRef.current = false;
  }, []);

  const startPending = useCallback((event: ReactPointerEvent, target: StructuralTarget, candidates: CandidateTarget[] = []) => {
    const anchor = localScreenPoint(event.clientX, event.clientY);
    const pending: CanvasInteraction = {
      kind: 'pending',
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      start: { x: event.clientX, y: event.clientY },
      target,
      candidates,
      anchor,
      tool: activeTool,
      shiftKey: event.shiftKey,
    };
    capturePointer(event.pointerId);
    transitionInteraction(pending);
    clearLongPressTimer();
    longPressMotionRef.current = { pointerId: event.pointerId, start: pending.start, current: pending.start };
    if (shouldArmLongPress(event.pointerType, activeTool, target.kind)) {
      longPressTimerRef.current = window.setTimeout(() => {
        const current = interactionRef.current;
        if (current.kind !== 'pending' || current.pointerId !== event.pointerId) return;
        const motion = longPressMotionRef.current;
        const movedPx = motion?.pointerId === event.pointerId ? pointDistance(motion.start, motion.current) : 0;
        if (!shouldTriggerLongPress(event.pointerType, current.tool, current.target.kind, LONG_PRESS_MS, movedPx)) return;
        longPressTimerRef.current = null;
        longPressMotionRef.current = null;
        if (current.target.kind === 'background') {
          const start = screenToModelPoint(current.anchor, cameraRef.current);
          transitionInteraction({ kind: 'selection-box', pointerId: event.pointerId, start, current: start, additive: current.shiftKey });
          return;
        }
        if (openCandidatePicker(current.candidates, current.anchor)) {
          transitionInteraction({ kind: 'long-press', pointerId: event.pointerId, target: current.target });
          return;
        }
        selectStructuralTarget(current.target);
        setActiveTool('select');
        onRequestInspector?.();
        transitionInteraction({ kind: 'long-press', pointerId: event.pointerId, target: current.target });
        longPressTimerRef.current = null;
      }, LONG_PRESS_MS);
    }
  }, [activeTool, capturePointer, clearLongPressTimer, localScreenPoint, onRequestInspector, openCandidatePicker, selectStructuralTarget, setActiveTool, transitionInteraction]);

  const memberValueAt = (memberId: string, ratio: number): DiagramPoint | null => {
    const result = resultMap.get(memberId);
    if (!result?.diagramSegments.length) return null;
    const grossLength = result.totalLength ?? result.length;
    const localX = clamp(ratio * grossLength - (result.startOffset ?? 0), 0, result.length);
    return evaluateDiagramAt(result.diagramSegments, result.diagramJumps, localX, 'right');
  };

  const {
    finishSelectionBox,
    performTargetAction,
  } = useCanvasToolDispatch({
    project,
    units,
    selectionFilter,
    selection,
    setSelection,
    activeTool,
    setActiveTool,
    memberStart,
    setMemberStart,
    repeatRecipe,
    setRepeatRecipe,
    executeProjectCommand,
    updateProject,
    nodeMap,
    memberMap,
    localScreenPoint,
    cameraRef,
    setCut,
    memberValueAt,
    deleteSelection,
    addNode,
    createMemberEndpoint,
    modelPointFromClient,
    showCanvasFeedback,
    onRequestInspector,
    t,
  });

  const shouldStartPan = useCallback((event: ReactPointerEvent) =>
    event.button === 1 || (event.button === 0 && (activeTool === 'pan' || spacePressedRef.current)), [activeTool]);

  const handleObjectPointerDown = useStableCanvasEvent((event: ReactPointerEvent, target: StructuralTarget) => {
    event.stopPropagation();
    if (candidatePicker) return;
    if (interactionRef.current.kind === 'pinch') return;
    if (shouldStartPan(event)) {
      event.preventDefault();
      startPan(event.pointerId, event.pointerType, { x: event.clientX, y: event.clientY }, false);
      return;
    }
    if (startStructuralEditPointer(event)) return;
    if (event.button !== 0) return;
    let resolvedTarget = target;
    // Loads are intentionally easy to hit, but they must not block tools whose
    // destination is the supporting member. This also lets users add another
    // load, split a member, or inspect a cut without first hiding existing loads.
    if (
      target.kind === 'memberLoad'
      && ['pointLoad', 'distributedLoad', 'moment', 'split', 'cut'].includes(activeTool)
    ) {
      const supportingMemberId = project.memberLoads.find((load) => load.id === target.id)?.memberId;
      if (supportingMemberId) resolvedTarget = { kind: 'member', id: supportingMemberId };
    }
    if (activeTool === 'select') {
      const selectable = target.kind === 'node'
        ? selectionFilter.nodes
        : target.kind === 'member'
          ? selectionFilter.members
          : target.kind === 'nodalLoad' || target.kind === 'memberLoad'
            ? selectionFilter.loads
            : true;
      if (!selectable) return;
      const candidates = candidateTargetsAtPoint(event.clientX, event.clientY, resolvedTarget);
      if (candidates.length > 1) {
        if (event.pointerType === 'touch') startPending(event, resolvedTarget, candidates);
        else openCandidatePicker(candidates, localScreenPoint(event.clientX, event.clientY), event.shiftKey);
        return;
      }
      // A one-finger touch remains pending until time plus displacement resolves
      // it as a true long press, marquee, or pan.
      if (event.pointerType === 'touch') {
        startPending(event, resolvedTarget, candidates);
        return;
      }
    }
    if (event.pointerType === 'touch' || activeTool === 'pointLoad' || activeTool === 'distributedLoad' || activeTool === 'moment') {
        startPending(event, resolvedTarget);
      return;
    }
    if (resolvedTarget.kind === 'node' && activeTool === 'select' && !event.shiftKey) {
      setSelection({ kind: 'node', id: resolvedTarget.id });
      startPending(event, resolvedTarget);
      return;
    }
    performTargetAction(resolvedTarget, activeTool, { x: event.clientX, y: event.clientY }, event.shiftKey);
  });

  const handleBackgroundPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (candidatePicker) return;
    if (event.target !== event.currentTarget && (event.target as Element).closest('[data-structure-object]')) return;
    if (interactionRef.current.kind === 'pinch') return;
    if (shouldStartPan(event)) {
      event.preventDefault();
      startPan(event.pointerId, event.pointerType, { x: event.clientX, y: event.clientY }, false);
      return;
    }
    if (startStructuralEditPointer(event)) return;
    if (event.button !== 0) return;
    if (event.pointerType === 'touch') {
      if (activeTool === 'select') startPending(event, { kind: 'background' });
      else if (activeTool === 'pan') startPan(event.pointerId, event.pointerType, { x: event.clientX, y: event.clientY }, false);
      else startPending(event, { kind: 'background' });
      return;
    }
    if (activeTool === 'pointLoad' || activeTool === 'distributedLoad' || activeTool === 'moment') {
      startPending(event, { kind: 'background' });
      return;
    }
    if (activeTool === 'node') addNode(modelPointFromClient(event.clientX, event.clientY));
    else if (activeTool === 'member') void createMemberEndpoint(modelPointFromClient(event.clientX, event.clientY));
    else if (activeTool === 'select') {
      const start = screenToModelPoint(localScreenPoint(event.clientX, event.clientY), cameraRef.current);
      capturePointer(event.pointerId);
      transitionInteraction({ kind: 'selection-box', pointerId: event.pointerId, start, current: start, additive: event.shiftKey });
    } else if (activeTool !== 'pan') {
      setSelection(null);
      setMemberStart(null);
      setCut(null);
    }
  };

  const handlePointerDownCapture = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (candidatePicker) {
      event.stopPropagation();
      return;
    }
    // En captura, para que elegir el origen sobre un nudo existente entregue el
    // punto y no lo seleccione además: el manejador del objeto está por debajo
    // y nunca llega a verlo.
    if (pickGeneratorOrigin(event)) {
      event.stopPropagation();
      return;
    }
    if (event.pointerType !== 'touch') return;
    // A fresh primary contact starts a new touch sequence. Some mobile engines
    // may omit one of the final pointer events after a pinch; discard any stale
    // bookkeeping so the next one-finger drag cannot be mistaken for a pinch.
    if (event.isPrimary && activePointersRef.current.size > 0) {
      clearLongPressTimer();
      if (interactionRef.current.kind === 'node-drag') cancelNodeDragTransaction();
      if (interactionRef.current.kind === 'structural-edit') {
        pendingStructuralEditDraftRef.current = null;
        if (structuralEditFrameRef.current !== null) window.cancelAnimationFrame(structuralEditFrameRef.current);
        structuralEditFrameRef.current = null;
        setStructuralEditDraft(interactionRef.current.beforeDraft);
        structuralEditLiveDraftRef.current = null;
        setStructuralEditLiveDraft(null);
        setStructuralEditPointerArmed(false);
      }
      for (const pointerId of activePointersRef.current.keys()) releasePointer(pointerId);
      activePointersRef.current.clear();
      transitionInteraction(IDLE_INTERACTION);
    }
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointersRef.current.size !== 2) return;
    event.preventDefault();
    clearLongPressTimer();
    if (interactionRef.current.kind === 'node-drag') cancelNodeDragTransaction();
    if (interactionRef.current.kind === 'structural-edit') {
      pendingStructuralEditDraftRef.current = null;
      if (structuralEditFrameRef.current !== null) window.cancelAnimationFrame(structuralEditFrameRef.current);
      structuralEditFrameRef.current = null;
      setStructuralEditDraft(interactionRef.current.beforeDraft);
      structuralEditLiveDraftRef.current = null;
      setStructuralEditLiveDraft(null);
      setStructuralEditPointerArmed(false);
    }
    const entries = [...activePointersRef.current.entries()];
    const first = entries[0];
    const second = entries[1];
    capturePointer(first[0]);
    capturePointer(second[0]);
    const startMidpoint = midpoint(first[1], second[1]);
    const localMidpoint = localScreenPoint(startMidpoint.x, startMidpoint.y);
    const startCamera = cameraRef.current;
    transitionInteraction({
      kind: 'pinch',
      pointerIds: [first[0], second[0]],
      camera: startCamera,
      anchor: screenToModelPoint(localMidpoint, startCamera),
      startDistance: pointDistance(first[1], second[1]),
    });
  };

  /**
   * La lupa sólo aparece bajo un dedo y sólo mientras hay una intención en curso
   * (colocación, arrastre, marco de selección). Durante `pan` o `pinch` el punto
   * de modelo bajo el dedo no cambia — dibujarla ahí sería una cota que miente
   * sobre el gesto y un `setState` por cuadro que no compra nada.
   */
  const syncTouchLoupe = (pointerType: string, current: CanvasInteraction, clientX: number, clientY: number) => {
    const placing = current.kind === 'idle' && (activeTool === 'node' || activeTool === 'member');
    const tracking = current.kind === 'pending' || current.kind === 'node-drag' || current.kind === 'structural-edit'
      || current.kind === 'long-press' || current.kind === 'selection-box';
    if (pointerType !== 'touch' || !(placing || tracking)) {
      setTouchLoupe((existing) => existing === null ? existing : null);
      return;
    }
    const local = localScreenPoint(clientX, clientY);
    const model = screenToModelPoint(local, cameraRef.current);
    setTouchLoupe({
      screenX: local.x,
      screenY: local.y,
      modelX: toDisplay(model.x, units, 'length'),
      modelY: toDisplay(model.y, units, 'length'),
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const client = { x: event.clientX, y: event.clientY };
    updateCoordinateReadout(event.clientX, event.clientY, event.pointerType);
    if (event.pointerType === 'touch') activePointersRef.current.set(event.pointerId, client);
    const current = interactionRef.current;
    syncTouchLoupe(event.pointerType, current, event.clientX, event.clientY);
    if (current.kind === 'idle' && (activeTool === 'node' || activeTool === 'member')) {
      modelPointFromClient(event.clientX, event.clientY);
    }
    if (current.kind === 'pinch') {
      const first = activePointersRef.current.get(current.pointerIds[0]);
      const second = activePointersRef.current.get(current.pointerIds[1]);
      if (!first || !second) return;
      const clientMidpoint = midpoint(first, second);
      updateCamera(cameraForPinch(
        current.camera,
        current.anchor,
        current.startDistance,
        pointDistance(first, second),
        localScreenPoint(clientMidpoint.x, clientMidpoint.y),
      ));
      return;
    }
    if (current.kind === 'pending' && current.pointerId === event.pointerId) {
      const movedPx = pointDistance(current.start, client);
      if (current.pointerType === 'touch') {
        longPressMotionRef.current = { pointerId: current.pointerId, start: current.start, current: client };
        if (movedPx > LONG_PRESS_JITTER_PX) clearLongPressTimer();
      }
      if (!movedPastThreshold(current.start, client, current.pointerType)) return;
      clearLongPressTimer();
      if (current.target.kind === 'node' && pendingDragIntent(current.pointerType, current.tool, current.target.kind) === 'node-drag') {
        const node = nodeMap.get(current.target.id);
        if (!node) return;
        const pointerAtStart = screenToModelPoint(localScreenPoint(current.start.x, current.start.y), cameraRef.current);
        const grabOffset = { x: node.x - pointerAtStart.x, y: node.y - pointerAtStart.y };
        beginProjectTransaction();
        setSelection({ kind: 'node', id: current.target.id });
        transitionInteraction({ kind: 'node-drag', pointerId: current.pointerId, pointerType: current.pointerType, nodeId: current.target.id, grabOffset });
        scheduleNodeMove(current.target.id, nodeDragPointFromClient(event.clientX, event.clientY, current.target.id, grabOffset));
      } else {
        const panInteraction: CanvasInteraction = {
          kind: 'pan', pointerId: current.pointerId, pointerType: current.pointerType,
          start: current.start, camera: cameraRef.current, moved: true, clearSelectionOnTap: false,
        };
        transitionInteraction(panInteraction);
        updateCamera(panCameraFrom(panInteraction.camera, panInteraction.start, client));
      }
      return;
    }
    if (current.kind === 'pan' && current.pointerId === event.pointerId) {
      if (!current.moved) {
        if (!movedPastThreshold(current.start, client, current.pointerType)) return;
        const movedInteraction = { ...current, moved: true };
        interactionRef.current = movedInteraction;
        scheduleInteractionFrame(movedInteraction);
      }
      updateCamera(panCameraFrom(current.camera, current.start, client));
      return;
    }
    if (current.kind === 'node-drag' && current.pointerId === event.pointerId) {
      scheduleNodeMove(current.nodeId, nodeDragPointFromClient(event.clientX, event.clientY, current.nodeId, current.grabOffset));
      return;
    }
    if (current.kind === 'structural-edit' && current.pointerId === event.pointerId) {
      try {
        const raw = screenToModelPoint(localScreenPoint(event.clientX, event.clientY), cameraRef.current);
        const point = current.beforeDraft.kind === 'move'
          ? snapPoint({ x: raw.x + current.grabOffset.x, y: raw.y + current.grabOffset.y }, structuralEditExcludedNodeIds)
          : modelPointFromClient(event.clientX, event.clientY);
        scheduleStructuralEditDraft(updateDraftFromPointer(current.beforeDraft, project, { start: current.start, current: point }));
        setStructuralEditCommitError('');
      } catch (error) {
        setStructuralEditCommitError(error instanceof Error ? error.message : t('canvas.twoValidNumbers'));
      }
      return;
    }
    if (current.kind === 'selection-box' && current.pointerId === event.pointerId) {
      scheduleInteractionFrame({
        ...current,
        current: screenToModelPoint(localScreenPoint(event.clientX, event.clientY), cameraRef.current),
      });
    }
  };

  const finishPointer = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    clearLongPressTimer();
    setSnapPreview(null);
    setTouchLoupe(null);
    if (event.pointerType === 'touch') activePointersRef.current.delete(event.pointerId);
    const current = interactionRef.current;
    if (current.kind === 'pinch' && current.pointerIds.includes(event.pointerId)) {
      const remaining = [...activePointersRef.current.entries()][0];
      if (remaining) {
        transitionInteraction({
          kind: 'pan', pointerId: remaining[0], pointerType: 'touch', start: remaining[1],
          camera: cameraRef.current, moved: true, clearSelectionOnTap: false,
        });
      } else transitionInteraction(IDLE_INTERACTION);
    } else if (current.kind === 'pending' && current.pointerId === event.pointerId) {
      if (!cancelled) performTargetAction(current.target, current.tool, { x: event.clientX, y: event.clientY }, current.shiftKey);
      transitionInteraction(IDLE_INTERACTION);
    } else if (current.kind === 'pan' && current.pointerId === event.pointerId) {
      if (!cancelled && !current.moved && current.clearSelectionOnTap) {
        setSelection(null);
        setMemberStart(null);
        setCut(null);
      }
      transitionInteraction(IDLE_INTERACTION);
    } else if (current.kind === 'node-drag' && current.pointerId === event.pointerId) {
      if (cancelled) {
        cancelNodeDragTransaction();
      } else {
        flushNodeMove();
        commitProjectTransaction();
      }
      transitionInteraction(IDLE_INTERACTION);
    } else if (current.kind === 'structural-edit' && current.pointerId === event.pointerId) {
      if (cancelled) {
        pendingStructuralEditDraftRef.current = null;
        if (structuralEditFrameRef.current !== null) window.cancelAnimationFrame(structuralEditFrameRef.current);
        structuralEditFrameRef.current = null;
        setStructuralEditDraft(current.beforeDraft);
        structuralEditLiveDraftRef.current = null;
        setStructuralEditLiveDraft(null);
      } else flushStructuralEditDraft();
      setStructuralEditPointerArmed(false);
      transitionInteraction(IDLE_INTERACTION);
    } else if (current.kind === 'selection-box' && current.pointerId === event.pointerId) {
      if (!cancelled) finishSelectionBox(current);
      transitionInteraction(IDLE_INTERACTION);
    } else if (current.kind === 'long-press' && current.pointerId === event.pointerId) {
      transitionInteraction(IDLE_INTERACTION);
    }
    releasePointer(event.pointerId);
  };

  const cancelActiveInteraction = useCallback(() => {
    clearLongPressTimer();
    setSnapPreview(null);
    setTouchLoupe(null);
    const current = interactionRef.current;
    if (current.kind === 'node-drag') {
      cancelNodeDragTransaction();
    } else if (current.kind === 'structural-edit') {
      pendingStructuralEditDraftRef.current = null;
      if (structuralEditFrameRef.current !== null) window.cancelAnimationFrame(structuralEditFrameRef.current);
      structuralEditFrameRef.current = null;
      setStructuralEditDraft(current.beforeDraft);
      structuralEditLiveDraftRef.current = null;
      setStructuralEditLiveDraft(null);
      setStructuralEditPointerArmed(false);
    }
    for (const pointerId of activePointersRef.current.keys()) releasePointer(pointerId);
    activePointersRef.current.clear();
    transitionInteraction(IDLE_INTERACTION);
  }, [cancelNodeDragTransaction, clearLongPressTimer, releasePointer, transitionInteraction]);

  const {
    cancelStructuralEdit,
    startStructuralEdit,
    changeStructuralEditOperation,
    updateStructuralEditDraft,
    confirmStructuralEdit,
  } = useCanvasStructuralEdit({
    project,
    selection,
    setSelection,
    structuralEditingCapable: editCapabilities.structural,
    setActiveTool,
    cancelActiveInteraction,
    closeCandidatePicker,
    setDuplicateDraft,
    setRepeatRecipe,
    setMemberStart,
    setCut,
    structuralEditDraft,
    setStructuralEditDraft,
    structuralEditLiveDraftRef,
    setStructuralEditLiveDraft,
    setStructuralEditPointerArmed,
    setStructuralEditCommitError,
    structuralEditApplyingRef,
    structuralEditPreviewPrepared: structuralEditPreview.prepared,
    executePreparedStructuralEdit,
    svgRef,
    showCanvasFeedback,
    t,
  });

  const invokeContextualAction = useCallback((action: ContextualActionId) => {
    switch (action) {
      case 'copy':
        void copyStructuralSelection();
        return;
      case 'paste':
        void pasteStructuralSelection();
        return;
      case 'duplicate':
        startDuplicate();
        return;
      case 'repeat':
        activateRepeat();
        return;
      case 'delete':
        deleteSelection();
        return;
      case 'datasheet':
        emitWorkspaceCommand('open-data', { tab: 'table' });
        return;
      case 'structuralEdit':
        emitWorkspaceCommand('open-structural-edit');
        return;
      case 'selectSimilar':
        setSelection(toSelection(selectionQueryById('members.similar').run(project, selection)));
        return;
    }
  }, [activateRepeat, copyStructuralSelection, deleteSelection, pasteStructuralSelection, project, selection, setSelection, startDuplicate]);

  useEffect(() => onWorkspaceCommand('open-structure-generator', () => setGeneratorOpen(true)), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const modalOpen = document.querySelector<HTMLElement>('[aria-modal="true"]');
      const interactive = target?.closest('input, select, textarea, button, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [role="tablist"]');
      if (event.key === 'Escape' && candidatePicker) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeCandidatePicker();
        return;
      }
      if ((modalOpen && !target?.closest('[aria-modal="true"]')) || interactive) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (!spacePressedRef.current) {
          spacePressedRef.current = true;
          setSpacePressed(true);
        }
        return;
      }
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape' && structuralEditDraft) {
        event.preventDefault();
        cancelStructuralEdit();
        return;
      }
      if (structuralEditDraft) return;
      // Letter-only shortcuts (no modifier) are scoped to the canvas element
      // itself (CRI-103): anywhere else — including plain document/body focus,
      // which is where a screen reader's quick-nav browse mode intercepts
      // single letters — they must not fire, or they hijack that navigation.
      const canvasHasFocus = document.activeElement instanceof Node && Boolean(hostRef.current?.contains(document.activeElement));
      if (key === 'r' && !command && !event.altKey && canvasHasFocus) {
        if (!repeatCandidate) return;
        event.preventDefault();
        activateRepeat();
        return;
      }
      if (command && key === 'c') {
        event.preventDefault();
        void copyStructuralSelection();
        return;
      }
      if (command && key === 'v') {
        event.preventDefault();
        void pasteStructuralSelection();
        return;
      }
      if (command && key === 'd') {
        event.preventDefault();
        startDuplicate();
        return;
      }
      const shortcutTool = toolFromShortcut(key);
      if (shortcutTool && !command && !event.altKey && canvasHasFocus) {
        event.preventDefault();
        setActiveTool(shortcutTool);
      }
      if (event.key === 'Escape') {
        if (duplicateDraft) {
          setDuplicateDraft(null);
          return;
        }
        cancelActiveInteraction();
        setMemberStart(null);
        setQuickEntry({ first: '', second: '' });
        setQuickEntryError('');
        setRepeatRecipe(null);
        setSelection(null);
        setCut(null);
        setActiveTool('select');
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      }
    };
    const releaseSpace = (event?: KeyboardEvent) => {
      if (event && event.code !== 'Space') return;
      spacePressedRef.current = false;
      setSpacePressed(false);
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') cancelActiveInteraction(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', releaseSpace);
    window.addEventListener('blur', cancelActiveInteraction);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', releaseSpace);
      window.removeEventListener('blur', cancelActiveInteraction);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activateRepeat, cancelActiveInteraction, cancelStructuralEdit, candidatePicker, closeCandidatePicker, copyStructuralSelection, deleteSelection, duplicateDraft, pasteStructuralSelection, repeatCandidate, selection, setActiveTool, setSelection, startDuplicate, structuralEditDraft]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const local = localScreenPoint(event.clientX, event.clientY);
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * size.height : event.deltaY;
      const factor = Math.exp(-clamp(delta, -400, 400) * 0.0012);
      updateCamera(zoomCameraAt(cameraRef.current, local, factor));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [localScreenPoint, size.height, updateCamera]);

  const showCut = useStableCanvasEvent((event: ReactPointerEvent, member: MemberModel) => {
    if (!resultsAllowed || !analysis?.success || cut?.pinned) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const model = toModel(event.clientX - rect.left, event.clientY - rect.top);
    const ni = nodeMap.get(member.i)!;
    const nj = nodeMap.get(member.j)!;
    const ratio = grossRatioAtPoint(memberAxis(member, ni, nj), model);
    setCut({ memberId: member.id, ratio, point: memberValueAt(member.id, ratio), clientX: event.clientX, clientY: event.clientY, pinned: false });
  });

  const globalDiagramMax = useMemo(() => {
    if (!analysis?.success) return 1e-9;
    const key = resultTab === 'axial' ? 'axial' : resultTab === 'shear' ? 'shear' : 'moment';
    let maximum = 1e-9;
    for (const result of analysis.memberResults) {
      for (const point of result.criticalPoints) {
        if (point.quantity === key) maximum = Math.max(maximum, Math.abs(point.value));
      }
    }
    return maximum;
  }, [analysis, resultTab]);

  const mechanismPixelScale = useMemo(() => {
    let maximum = 0;
    for (const node of mechanismMap.values()) maximum = Math.max(maximum, Math.hypot(node.ux, node.uy));
    return maximum > 1e-14 ? 72 / maximum : 0;
  }, [mechanismMap]);
  const grid = useMemo(() => {
    if (!view.showGrid) return null;
    const step = view.gridSize * camera.scale;
    if (step < 8) return null;
    const lines = [];
    const startX = ((camera.x % step) + step) % step;
    const startY = ((camera.y % step) + step) % step;
    for (let x = startX; x < size.width; x += step) lines.push(<line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={size.height} />);
    for (let y = startY; y < size.height; y += step) lines.push(<line key={`gy-${y}`} x1={0} y1={y} x2={size.width} y2={y} />);
    return <g className="grid-lines">{lines}</g>;
  }, [camera, size, view.gridSize, view.showGrid]);

  const handleObjectKeyDown = useStableCanvasEvent((event: ReactKeyboardEvent<SVGGElement>, target: Exclude<StructuralTarget, { kind: 'background' }>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const client = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const candidates = candidateTargetsAtPoint(client.x, client.y, target);
    if (openCandidatePicker(candidates, localScreenPoint(client.x, client.y), event.shiftKey)) return;
    performTargetAction(target, 'select', client);
    if (target.kind === 'nodalLoad' || target.kind === 'memberLoad') onRequestInspector?.();
  });

  const onCutLeave = useCallback(() => setCut((current) => current?.pinned ? current : null), []);

  const placedSmartLabels = useMemo(() => {
    const smartLabelCandidates = buildCanvasLabelCandidates({
      activeTool,
      analysis,
      cameraScale: camera.scale,
      distributedLabel,
      forceLabel,
      globalDiagramMax,
      layers,
      lengthLabel,
      loadsLayerVisible,
      memberMap,
      momentLabel,
      nodeMap,
      nodeResultMap,
      project,
      resultMap,
      resultTab,
      resultsAllowed,
      selectionVisualState,
      size,
      toScreen,
      units,
      view,
    });
    return layoutSmartLabels(smartLabelCandidates, canvasSafeRect(size), camera.scale);
  }, [
    activeTool,
    analysis,
    camera.scale,
    distributedLabel,
    forceLabel,
    globalDiagramMax,
    layers,
    lengthLabel,
    loadsLayerVisible,
    memberMap,
    momentLabel,
    nodeMap,
    nodeResultMap,
    project,
    resultMap,
    resultTab,
    resultsAllowed,
    selectionVisualState,
    size,
    toScreen,
    units,
    view,
  ]);
  const smartLabelLayer = useMemo(() => <g className="smart-label-layer" data-label-detail={smartLabelDetailForScale(camera.scale)} aria-hidden="true">
    {placedSmartLabels.map((label) => {
      const centerX = label.rect.x + label.rect.width / 2;
      const centerY = label.rect.y + label.rect.height / 2;
      const lines = label.lines ?? [label.text];
      return <g key={label.id} className={`smart-label priority-${label.priority} tone-${label.tone ?? 'neutral'}${lines.length > 1 ? ' smart-label-multiline' : ''}`} data-smart-label={label.id} data-label-priority={label.priority}>
        {label.leader ? <line className="smart-label-leader" x1={label.anchor.x} y1={label.anchor.y} x2={centerX} y2={centerY} /> : null}
        <rect x={label.rect.x} y={label.rect.y} width={label.rect.width} height={label.rect.height} rx="6" />
        {lines.map((line, index) => <text key={index} className={index === 0 ? 'smart-label-line-primary' : 'smart-label-line-detail'} x={label.rect.x + 8} y={label.rect.y + 15 + index * 12}>{line}</text>)}
      </g>;
    })}
  </g>, [camera.scale, placedSmartLabels]);
  const multiSelectionPoints = selectionVisualState.kind === 'multi' ? [
    ...selectionVisualState.nodeIds.flatMap((nodeId) => {
      const node = nodeMap.get(nodeId);
      return node ? [toScreen(node.x, node.y)] : [];
    }),
    ...selectionVisualState.memberIds.flatMap((memberId) => {
      const member = memberMap.get(memberId);
      const ni = member ? nodeMap.get(member.i) : undefined;
      const nj = member ? nodeMap.get(member.j) : undefined;
      return ni && nj ? [toScreen(ni.x, ni.y), toScreen(nj.x, nj.y)] : [];
    }),
  ] : [];
  const multiSelectionEnvelope = selectionEnvelopeForPoints(multiSelectionPoints, { x: 0, y: 0, width: size.width, height: size.height }, 22);
  const duplicatePreviewNodeMap = new Map([
    ...project.nodes.map((node) => [node.id, node] as const),
    ...(duplicatePreview?.prepared?.addedNodes ?? []).map((node) => [node.id, node] as const),
  ]);

  // Única fuente de los márgenes seguros del chrome: la misma función que usa
  // `canvasSafeRect` para repartir etiquetas decide, aquí, dónde cae el chrome
  // CSS. Antes ambos números vivían por separado —éste en TS, aquél repetido
  // a mano en tres media queries de `styles.css`— y podían desincronizarse: la
  // media query lee el ancho de la ventana, `size` es el ancho medido del
  // propio lienzo, que se angosta con el inspector acoplado sin cruzar ningún
  // punto de quiebre de la ventana.
  const canvasSafeInsets = canvasSafeInsetsFor(size);

  return (
    <div
      className="canvas-host"
      ref={hostRef}
      style={{
        '--canvas-safe-top': `${canvasSafeInsets.top}px`,
        '--canvas-safe-right': `${canvasSafeInsets.right}px`,
        '--canvas-safe-bottom': `${canvasSafeInsets.bottom}px`,
        '--canvas-safe-left': `${canvasSafeInsets.left}px`,
      } as CSSProperties}
    >
      <svg
        ref={svgRef}
        className={`structural-canvas tool-${activeTool} interaction-${interaction.kind} ${spacePressed ? 'space-pan-ready' : ''}`}
        data-interaction={interaction.kind}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="application"
        aria-label={t('canvas.workspace')}
        aria-describedby="canvas-interaction-description"
        aria-keyshortcuts="V H N M S P D O C X B R ArrowUp ArrowDown Home End Enter Delete Backspace Escape"
        data-pointer-support="mouse touch pen"
        tabIndex={0}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPointer(event, false)}
        onPointerCancel={(event) => finishPointer(event, true)}
        onLostPointerCapture={(event) => {
          const current = interactionRef.current;
          if ('pointerId' in current && current.pointerId === event.pointerId) finishPointer(event, true);
          else if (current.kind === 'pinch' && current.pointerIds.includes(event.pointerId)) finishPointer(event, true);
        }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerLeave={() => {
          if (interactionRef.current.kind === 'idle') setSnapPreview(null);
          if (coordinateReadoutRef.current) coordinateReadoutRef.current.textContent = `X — · Y — ${lengthLabel}`;
        }}
      >
        <title>{t('canvas.workspace')}</title>
        <desc id="canvas-interaction-description">{t('canvas.gestureDesktop')}. {t('canvas.gestureTouch')}.</desc>
        <defs>
          <marker id="arrow-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--force)" /></marker>
          <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--shear)" /></marker>
          <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--axial)" /></marker>
          <marker id="arrow-mechanism" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--warning)" /></marker>
        </defs>
        {/* Todo lo dibujable va dentro de un grupo con `id`: la lupa táctil lo
            clona con `<use>` para ampliarlo, en vez de mantener un segundo
            render de la estructura que podría desincronizarse de éste. El
            grupo no lleva transform — sus coordenadas son las del lienzo. */}
        <g id={CANVAS_SCENE_ID}>
        {grid}
        <CanvasInteractionLayer
          slot="preview"
          snapPreview={snapPreview}
          selectionBox={selectionBox}
          memberStartId={memberStart}
          nodeMap={nodeMap}
          toScreen={toScreen}
          units={units}
          lengthLabel={lengthLabel}
          multiSelectionEnvelope={multiSelectionEnvelope}
          selectionCount={selectionVisualState.count}
          size={size}
          t={t}
        />

        {duplicatePreview?.prepared ? <g className="duplicate-preview-layer" aria-label={phase2T('canvas.duplicatePreviewAria')}>
          {duplicatePreview.prepared.addedMembers.map((member) => {
            const start = duplicatePreviewNodeMap.get(member.i);
            const end = duplicatePreviewNodeMap.get(member.j);
            if (!start || !end) return null;
            const a = toScreen(start.x, start.y);
            const b = toScreen(end.x, end.y);
            return <line key={member.id} className="duplicate-preview-member" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
          {duplicatePreview.prepared.addedNodes.map((node) => {
            const point = toScreen(node.x, node.y);
            return <circle key={node.id} className="duplicate-preview-node" cx={point.x} cy={point.y} r="6" />;
          })}
        </g> : null}

        {generatorGhost ? <CanvasStructureGeneratorLayer
          ghost={generatorGhost}
          origin={generatorOrigin}
          toScreen={toScreen}
          label={t('generator.title')}
        /> : null}

        {structuralEditLivePreview.preview || structuralEditPreview.prepared ? <CanvasStructuralEditPreviewLayer
          project={project}
          prepared={structuralEditLivePreview.preview ? null : structuralEditPreview.prepared}
          geometry={structuralEditLivePreview.preview}
          size={size}
          toScreen={toScreen}
          label={t('canvas.structuralEditTitle')}
        /> : null}

        <CanvasResultLayer
          slot="diagrams"
          project={project}
          analysis={analysis}
          resultTab={resultTab}
          resultsAllowed={resultsAllowed}
          resultCursor={resultCursor}
          influenceCanvasState={influenceCanvasState}
          modeShapeState={modeShapeState}
          camera={camera}
          toScreen={toScreen}
          nodeMap={nodeMap}
          memberMap={memberMap}
          resultMap={resultMap}
          nodeResultMap={nodeResultMap}
          mechanismMap={mechanismMap}
          mechanismPixelScale={mechanismPixelScale}
          globalDiagramMax={globalDiagramMax}
          units={units}
          lengthLabel={lengthLabel}
          forceLabel={forceLabel}
          momentLabel={momentLabel}
          showResults={layers.results && !structuralEditDraft}
          showDiagnostics={layers.diagnostics && !structuralEditDraft}
          size={size}
          t={t}
        />

        <CanvasGeometryLayer
          slot="members"
          project={project}
          nodeMap={nodeMap}
          memberMap={memberMap}
          toScreen={toScreen}
          camera={camera}
          selectionVisualState={selectionVisualState}
          candidatePreview={candidatePreview}
          learningFocus={learningFocus}
          memberStartId={memberStart}
          layers={layers}
          loadsLayerVisible={loadsLayerVisible}
          heatmapRatios={heatmapRatios}
          demandMapActive={demandMapActive}
          resultTab={resultTab}
          units={units}
          forceLabel={forceLabel}
          momentLabel={momentLabel}
          distributedLabel={distributedLabel}
          t={t}
          onObjectPointerDown={handleObjectPointerDown}
          onObjectKeyDown={handleObjectKeyDown}
          onShowCut={showCut}
          onCutLeave={onCutLeave}
        />

        <CanvasResultLayer
          slot="annotations"
          project={project}
          analysis={analysis}
          resultTab={resultTab}
          resultsAllowed={resultsAllowed}
          resultCursor={resultCursor}
          influenceCanvasState={influenceCanvasState}
          modeShapeState={modeShapeState}
          camera={camera}
          toScreen={toScreen}
          nodeMap={nodeMap}
          memberMap={memberMap}
          resultMap={resultMap}
          nodeResultMap={nodeResultMap}
          mechanismMap={mechanismMap}
          mechanismPixelScale={mechanismPixelScale}
          globalDiagramMax={globalDiagramMax}
          units={units}
          lengthLabel={lengthLabel}
          forceLabel={forceLabel}
          momentLabel={momentLabel}
          showResults={layers.results && !structuralEditDraft}
          showDiagnostics={layers.diagnostics && !structuralEditDraft}
          size={size}
          t={t}
        />

        <CanvasGeometryLayer
          slot="objects"
          project={project}
          nodeMap={nodeMap}
          memberMap={memberMap}
          toScreen={toScreen}
          camera={camera}
          selectionVisualState={selectionVisualState}
          candidatePreview={candidatePreview}
          learningFocus={learningFocus}
          memberStartId={memberStart}
          layers={layers}
          loadsLayerVisible={loadsLayerVisible}
          heatmapRatios={heatmapRatios}
          demandMapActive={demandMapActive}
          resultTab={resultTab}
          units={units}
          forceLabel={forceLabel}
          momentLabel={momentLabel}
          distributedLabel={distributedLabel}
          t={t}
          onObjectPointerDown={handleObjectPointerDown}
          onObjectKeyDown={handleObjectKeyDown}
          onShowCut={showCut}
          onCutLeave={onCutLeave}
        />

        <CanvasInteractionLayer
          slot="overlay"
          snapPreview={snapPreview}
          selectionBox={selectionBox}
          memberStartId={memberStart}
          nodeMap={nodeMap}
          toScreen={toScreen}
          units={units}
          lengthLabel={lengthLabel}
          multiSelectionEnvelope={multiSelectionEnvelope}
          selectionCount={selectionVisualState.count}
          size={size}
          t={t}
        />

        {smartLabelLayer}

        <g className="global-axes" transform={`translate(42 ${size.height - 45})`}>
          <line x1="0" y1="0" x2="58" y2="0" markerEnd="url(#axis-x)" />
          <line x1="0" y1="0" x2="0" y2="-58" markerEnd="url(#axis-y)" />
          <defs>
            <marker id="axis-x" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="var(--moment)" /></marker>
            <marker id="axis-y" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="var(--shear)" /></marker>
          </defs>
          <text x="65" y="5" className="axis-x-label">X</text><text x="-5" y="-66" className="axis-y-label">Y</text>
        </g>
        </g>
      </svg>

      {duplicateDraft ? <form
        className="duplicate-preview-panel"
        aria-label={phase2T('canvas.duplicateTitle')}
        onSubmit={(event) => { event.preventDefault(); confirmDuplicate(); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setDuplicateDraft(null);
            svgRef.current?.focus();
          }
        }}
      >
        <strong>{phase2T('canvas.duplicateTitle')}</strong>
        <p>{phase2T('canvas.duplicateDescription')}</p>
        <div className="duplicate-preview-fields">
          <label>{phase2T('canvas.offsetX')}<input type="number" step="any" value={duplicateDraft.x} onChange={(event) => setDuplicateDraft((current) => current ? { ...current, x: event.target.value } : null)} /></label>
          <label>{phase2T('canvas.offsetY')}<input type="number" step="any" value={duplicateDraft.y} onChange={(event) => setDuplicateDraft((current) => current ? { ...current, y: event.target.value } : null)} /></label>
        </div>
        {duplicatePreview?.error ? <span className="duplicate-preview-error" role="alert">{duplicatePreview.error}</span> : null}
        <div className="duplicate-preview-actions">
          <button type="submit" disabled={!duplicatePreview?.prepared}>{phase2T('canvas.confirmDuplicate')}</button>
          <button type="button" onClick={() => { setDuplicateDraft(null); svgRef.current?.focus(); }}>{phase2T('canvas.cancelDuplicate')}</button>
        </div>
      </form> : null}

      {generatorOpen ? <Suspense fallback={null}><LazyStructureGeneratorSurface
        pickedOrigin={generatorPickedOrigin}
        originPicking={generatorOriginPicking}
        onToggleOriginPick={toggleGeneratorOriginPick}
        onOriginPickResolved={resolveGeneratorOriginPick}
        onGhostChange={setGeneratorGhost}
        onOriginChange={setGeneratorOrigin}
        onClose={closeGenerator}
      /></Suspense> : null}

      <StructuralEditOverlay
        // Contextual-actions owns the selection entry point. Once a structural
        // draft starts, this overlay continues to own that in-progress intent.
        // Never leave the legacy launcher visible or focusable beside the
        // Compact floor (primary verb + Delete + overflow).
        available={Boolean(structuralEditDraft) || (editCapabilities.structural
          && !selection && !duplicateDraft && !repeatRecipe && !generatorOpen)}
        repeatAvailable={Boolean(repeatCandidate) && !structuralEditDraft}
        draft={structuralEditDraft}
        capabilities={editCapabilities}
        prepared={structuralEditPreview.prepared}
        error={structuralEditCommitError || structuralEditLivePreview.error || structuralEditPreview.error}
        pointerArmed={structuralEditPointerArmed}
        lengthUnit={lengthLabel}
        onStart={startStructuralEdit}
        onKindChange={changeStructuralEditOperation}
        onDraftChange={updateStructuralEditDraft}
        onTogglePointer={() => {
          setStructuralEditPointerArmed((current) => !current);
          window.requestAnimationFrame(() => svgRef.current?.focus({ preventScroll: true }));
        }}
        onApply={() => { void confirmStructuralEdit(); }}
        onCancel={cancelStructuralEdit}
      />

      <CanvasChrome
        modeLabel={t(toolLabelKeys[activeTool])}
        placementInstruction={loadPlacementInstruction}
        showHelp={layers.help}
        layers={layers}
        dispatchLayers={dispatchLayers}
        resultTab={resultTab}
        setResultTab={setResultTab}
        snapEnabled={view.snap}
        gridEnabled={view.showGrid}
        onSnapChange={(snap) => setView({ snap })}
        onGridChange={(showGrid) => setView({ showGrid })}
        onCancelPlacement={() => setActiveTool('select')}
      />
      <CanvasNavigator
        nodes={project.nodes}
        members={project.members}
        viewport={minimapViewport}
        minimapLabel={t('canvas.minimap')}
        coordinateReadoutRef={coordinateReadoutRef}
        coordinatesLabel={t('canvas.coordinates')}
        lengthLabel={lengthLabel}
        scale={camera.scale}
        scaleLabel={t('canvas.scale')}
        viewControlsLabel={t('canvas.viewControls')}
        zoomInLabel={t('canvas.zoomIn')}
        zoomOutLabel={t('canvas.zoomOut')}
        fitLabel={t('canvas.fit')}
        onFit={fitModel}
        onZoomIn={() => updateCamera(zoomCameraAt(cameraRef.current, { x: size.width / 2, y: size.height / 2 }, 1.15))}
        onZoomOut={() => updateCamera(zoomCameraAt(cameraRef.current, { x: size.width / 2, y: size.height / 2 }, 1 / 1.15))}
        onNavigate={navigateMinimapTo}
      />
      {touchLoupe ? <CanvasTouchLoupe
        {...touchLoupe}
        lengthLabel={lengthLabel}
        sceneId={CANVAS_SCENE_ID}
        canvasHeight={size.height}
      /> : null}
      {canvasFeedback ? <div className="canvas-feedback" role="alert">{canvasFeedback}</div> : null}
      {selection && (!surfaceBroker || contextualActionsSurface?.status === 'active') ? <div
        data-workspace-surface={surfaceBroker ? 'contextualActions' : undefined}
        ref={surfaceBroker?.surfaceRootRef('contextualActions') as Ref<HTMLDivElement> | undefined}
      >
        <ContextualActions
          selection={selection}
          availability={contextualActionAvailability}
          active
          presentation={contextualActionsSurface?.presentation ?? 'inset'}
          shellClass={surfaceBroker?.shellClass ?? 'K0'}
          ariaLabel={t('contextualActions.title')}
          labelForAction={(action) => t(contextualActionLabelKeys[action])}
          accessibleLabelForAction={(action) => action === 'structuralEdit'
            ? t('contextualActions.structuralEditAccessible')
            : t(contextualActionLabelKeys[action])}
          overflowLabel={t('contextualActions.more')}
          onInvoke={invokeContextualAction}
        />
      </div> : null}
      <RepeatActionOverlay
        active={Boolean(repeatRecipe)}
        previewLabel={t('canvas.repeatPreview')}
        instruction={repeatRecipe ? t('canvas.repeatWaiting', { tool: t(toolLabelKeys[repeatRecipe.tool]) }) : ''}
        cancelLabel={t('canvas.cancelPlacement')}
        onCancel={() => { setRepeatRecipe(null); setMemberStart(null); setActiveTool('select'); }}
      />
      {layers.results && layers.labels && resultsAllowed && analysis?.success && ['axial', 'shear', 'moment'].includes(resultTab) ? <div className={`canvas-result-legend ${resultTab}`} aria-label={t('canvas.diagramConvention')} data-canvas-chrome="result-legend"><strong>{resultTab === 'axial' ? `N · ${t('results.axial')}` : resultTab === 'shear' ? `V · ${t('results.shear')}` : `M · ${t('results.moment')}`}</strong><span><i /> {t('canvas.exactCurveScale', { scale: t(view.diagramScaleMode === 'individual' ? 'canvas.scaleByMember' : 'canvas.scaleCommon') })}</span><small>{t('canvas.diagramSideDescription', { side: view.diagramSide === 'positive' ? '+y' : '−y' })}</small></div> : null}
      {demandLegend ? <div className="canvas-demand-legend" aria-label={t('canvas.demandLegendTitle')} data-canvas-chrome="demand-legend" data-testid="canvas-demand-legend">
        <strong>{t('canvas.demandLegendTitle')}</strong>
        {/* La rampa se declara con sus dos extremos y la referencia: sin esto el
            color es decoración y el usuario no sabe qué está mirando. */}
        <span className="canvas-demand-ramp" aria-hidden="true" />
        <span className="canvas-demand-scale"><i>η 0</i><i>η 1</i><i>{`η ${ELASTIC_SATURATION_RATIO}+`}</i></span>
        <small>{t('canvas.demandLegendMeaning')}</small>
        <small data-testid="canvas-demand-coverage">{t(
          demandLegend.unevaluated > 0 ? 'canvas.demandLegendCoveragePartial' : 'canvas.demandLegendCoverageComplete',
          { evaluated: demandLegend.evaluated, total: demandLegend.total, unevaluated: demandLegend.unevaluated },
        )}</small>
        {demandLegend.unevaluated > 0 ? <small className="canvas-demand-unevaluated">{t('canvas.demandLegendUnevaluated')}</small> : null}
        {demandLegend.saturated ? <small className="canvas-demand-saturated" data-testid="canvas-demand-saturated">{t('canvas.demandLegendSaturated', {
          saturation: formatFixed(ELASTIC_SATURATION_RATIO, 2),
          max: formatFixed(demandLegend.maxRatio ?? 0, 2),
        })}</small> : null}
      </div> : null}
      {memberStart ? <div className="canvas-hint" role="status"><span>{t('canvas.touchDestinationNode')}</span><button type="button" onClick={() => setMemberStart(null)} aria-label={t('canvas.cancelMemberCreation')}><X size={14} /></button></div> : null}
      {activeTool === 'node' || (activeTool === 'member' && memberStart) ? <form className="quick-entry-bar" aria-label={t('canvas.cadEntry')} onSubmit={(event) => { event.preventDefault(); submitQuickEntry(); }}>
        <div className="quick-entry-heading"><strong>{t(activeTool === 'node' ? 'canvas.nodeByCoordinates' : 'canvas.memberEndpoint')}</strong>{activeTool === 'member' ? <div className="quick-entry-mode"><button type="button" aria-pressed={quickEntryMode === 'delta'} onClick={() => setQuickEntryMode('delta')}>ΔX · ΔY</button><button type="button" aria-pressed={quickEntryMode === 'polar'} onClick={() => setQuickEntryMode('polar')}>L · ∠</button></div> : null}</div>
        <label><span>{activeTool === 'node' ? 'X' : quickEntryMode === 'delta' ? 'ΔX' : 'L'}</span><input type="text" inputMode="decimal" autoComplete="off" value={quickEntry.first} onChange={(event) => { setQuickEntry((current) => ({ ...current, first: event.target.value })); setQuickEntryError(''); }} /><small>{lengthLabel}</small></label>
        <label><span>{activeTool === 'node' ? 'Y' : quickEntryMode === 'delta' ? 'ΔY' : '∠'}</span><input type="text" inputMode="decimal" autoComplete="off" value={quickEntry.second} onChange={(event) => { setQuickEntry((current) => ({ ...current, second: event.target.value })); setQuickEntryError(''); }} /><small>{activeTool === 'member' && quickEntryMode === 'polar' ? '°' : lengthLabel}</small></label>
        <button type="submit">{t(activeTool === 'node' ? 'canvas.createNode' : 'canvas.createMember')}</button>
        <button type="button" className="quick-entry-cancel" onClick={cancelQuickEntry}>{t('canvas.cancelPlacement')}</button>
        {quickEntryError ? <span className="quick-entry-error" role="alert">{quickEntryError}</span> : null}
      </form> : null}
      {candidatePicker && (!surfaceBroker || candidatePickerSurface?.status === 'active') ? <div
        data-workspace-surface={surfaceBroker ? 'candidatePicker' : undefined}
        ref={surfaceBroker?.surfaceRootRef('candidatePicker') as Ref<HTMLDivElement> | undefined}
      >
        <CandidatePicker
          state={candidatePicker}
          presentation={candidatePickerSurface?.presentation === 'sheet' ? 'sheet' : 'floating'}
          onCycle={(direction) => setCandidatePicker((current) => current ? cycleCandidatePicker(current, direction) : null)}
          onSetActive={setCandidatePickerIndex}
          onConfirm={confirmCandidatePicker}
          onCancel={closeCandidatePicker}
          labels={{
            title: t('canvas.overlapPicker'),
            cancel: t('canvas.cancelPlacement'),
            confirm: t('canvas.confirmSelection'),
          }}
          labelForCandidate={(candidate) => `${candidate.kind === 'node' ? t('inspector.node') : candidate.kind === 'member' ? t('inspector.member') : candidate.kind === 'nodalLoad' ? t('canvas.overlapNodalLoad') : t('inspector.memberLoad')} ${candidate.id}`}
        />
      </div> : null}
      {cut?.point ? (
        <CutInspector
          cut={cut}
          cutDemand={cutDemand}
          cutEquilibrium={cutEquilibrium}
          hostLeft={hostRef.current?.getBoundingClientRect().left ?? 0}
          hostTop={hostRef.current?.getBoundingClientRect().top ?? 0}
          size={size}
          units={units}
          lengthLabel={lengthLabel}
          forceLabel={forceLabel}
          momentLabel={momentLabel}
          t={t}
        />
      ) : null}
    </div>
  );
};
