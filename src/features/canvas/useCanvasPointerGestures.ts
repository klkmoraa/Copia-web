import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { NodeModel, ProjectModel, Selection, Tool } from '../../types';
import { toDisplay } from '../../engine/units';
import type { UnitSystemId } from '../../types';
import type { SnapKind } from '../../utils/snapping';
import {
  LONG_PRESS_MS,
  LONG_PRESS_JITTER_PX,
  cameraForPinch,
  midpoint,
  movedPastThreshold,
  panCameraFrom,
  pendingDragIntent,
  pointDistance,
  screenToModelPoint,
  shouldArmLongPress,
  shouldTriggerLongPress,
  type ModelPoint,
  type ScreenPoint,
} from './canvasInteraction';
import { IDLE_INTERACTION, type Camera, type CanvasInteractionState as CanvasInteraction, type CutInfo } from './canvasVocabulary';
import type { StructuralTarget } from './CanvasGeometryLayer';
import type { CandidatePickerState, CandidateTarget } from './candidatePicker';
import { structuralEditSelectionAnchor, updateDraftFromPointer, type StructuralEditDraft } from './structuralEditUi';
import { useStableCanvasEvent } from './useStableCanvasEvent';
import type { StructureGenerationGhost } from '../../data/generators/generatorGhost';
import type { TranslationKey } from '../../i18n/catalogs';

export interface UseCanvasPointerGesturesArgs {
  project: ProjectModel;
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  setSelection: (next: Selection) => void;
  setMemberStart: Dispatch<SetStateAction<string | null>>;
  units: UnitSystemId;

  svgRef: RefObject<SVGSVGElement | null>;
  cameraRef: RefObject<Camera>;
  interactionRef: RefObject<CanvasInteraction>;
  activePointersRef: RefObject<Map<number, ScreenPoint>>;
  spacePressedRef: RefObject<boolean>;
  longPressTimerRef: RefObject<number | null>;
  longPressMotionRef: RefObject<{ pointerId: number; start: ScreenPoint; current: ScreenPoint } | null>;
  generatorOriginPickingRef: RefObject<boolean>;
  generatorPickTokenRef: RefObject<number>;
  pendingStructuralEditDraftRef: RefObject<StructuralEditDraft | null>;
  structuralEditFrameRef: RefObject<number | null>;
  structuralEditLiveDraftRef: RefObject<StructuralEditDraft | null>;

  candidatePicker: CandidatePickerState | null;
  setGeneratorOpen: Dispatch<SetStateAction<boolean>>;
  setGeneratorGhost: Dispatch<SetStateAction<StructureGenerationGhost | null>>;
  setGeneratorOrigin: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setGeneratorOriginPicking: Dispatch<SetStateAction<boolean>>;
  setGeneratorPickedOrigin: Dispatch<SetStateAction<{ x: number; y: number; token: number } | null>>;
  setCut: Dispatch<SetStateAction<CutInfo | null>>;
  setSnapPreview: Dispatch<SetStateAction<{ x: number; y: number; kind: SnapKind } | null>>;
  setTouchLoupe: Dispatch<SetStateAction<{ screenX: number; screenY: number; modelX: number; modelY: number } | null>>;

  structuralEditDraft: StructuralEditDraft | null;
  structuralEditPointerArmed: boolean;
  structuralEditExcludedNodeIds: ReadonlySet<string>;
  setStructuralEditDraft: Dispatch<SetStateAction<StructuralEditDraft | null>>;
  setStructuralEditLiveDraft: Dispatch<SetStateAction<StructuralEditDraft | null>>;
  setStructuralEditPointerArmed: Dispatch<SetStateAction<boolean>>;
  setStructuralEditCommitError: Dispatch<SetStateAction<string>>;

  selectionFilter: { nodes: boolean; members: boolean; loads: boolean };
  nodeMap: ReadonlyMap<string, NodeModel>;

  clearLongPressTimer: () => void;
  transitionInteraction: (next: CanvasInteraction) => void;
  scheduleInteractionFrame: (next: CanvasInteraction) => void;
  scheduleNodeMove: (nodeId: string, point: { x: number; y: number }) => void;
  flushNodeMove: () => void;
  scheduleStructuralEditDraft: (draft: StructuralEditDraft) => void;
  flushStructuralEditDraft: () => void;
  cancelNodeDragTransaction: () => void;
  updateCamera: (next: Camera | ((current: Camera) => Camera)) => void;
  updateCoordinateReadout: (clientX: number, clientY: number, pointerType: string) => void;
  localScreenPoint: (clientX: number, clientY: number) => ScreenPoint;
  snapPoint: (point: { x: number; y: number }, excludedNodeIds?: string | ReadonlySet<string>) => ModelPoint;
  modelPointFromClient: (clientX: number, clientY: number, excludedNodeIds?: string | ReadonlySet<string>) => ModelPoint;
  nodeDragPointFromClient: (clientX: number, clientY: number, excludedNodeId: string, grabOffset: ModelPoint) => ModelPoint;
  addNode: (point: { x: number; y: number }) => string;
  createMemberEndpoint: (point: { x: number; y: number }) => Promise<void>;
  openCandidatePicker: (candidates: CandidateTarget[], anchor: ScreenPoint, additive?: boolean) => boolean;
  selectStructuralTarget: (target: StructuralTarget) => void;
  candidateTargetsAtPoint: (clientX: number, clientY: number, fallback: StructuralTarget) => CandidateTarget[];
  performTargetAction: (target: StructuralTarget, tool: Tool, client: ScreenPoint, shiftKey?: boolean) => void;
  finishSelectionBox: (box: { pointerId: number; start: ModelPoint; current: ModelPoint; additive: boolean }) => void;
  beginProjectTransaction: () => void;
  commitProjectTransaction: () => void;
  onRequestInspector?: () => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

/**
 * Gestos de puntero: pointerdown/move/up, pinch multi-touch y long-press.
 * Es la pieza con más estado mutable compartido del canvas (rAF de la Fase
 * 4, acciones de la Fase 5/6, coordenadas de la Fase 2) y la más sensible al
 * timing real de eventos, que jsdom simula de forma imperfecta — por eso es
 * la última en extraerse: sólo consume contratos que las fases anteriores
 * ya dejaron aislados, no inventa acoplamientos nuevos.
 */
export const useCanvasPointerGestures = ({
  project,
  activeTool,
  setActiveTool,
  setSelection,
  setMemberStart,
  units,
  svgRef,
  cameraRef,
  interactionRef,
  activePointersRef,
  spacePressedRef,
  longPressTimerRef,
  longPressMotionRef,
  generatorOriginPickingRef,
  generatorPickTokenRef,
  pendingStructuralEditDraftRef,
  structuralEditFrameRef,
  structuralEditLiveDraftRef,
  candidatePicker,
  setGeneratorOpen,
  setGeneratorGhost,
  setGeneratorOrigin,
  setGeneratorOriginPicking,
  setGeneratorPickedOrigin,
  setCut,
  setSnapPreview,
  setTouchLoupe,
  structuralEditDraft,
  structuralEditPointerArmed,
  structuralEditExcludedNodeIds,
  setStructuralEditDraft,
  setStructuralEditLiveDraft,
  setStructuralEditPointerArmed,
  setStructuralEditCommitError,
  selectionFilter,
  nodeMap,
  clearLongPressTimer,
  transitionInteraction,
  scheduleInteractionFrame,
  scheduleNodeMove,
  flushNodeMove,
  scheduleStructuralEditDraft,
  flushStructuralEditDraft,
  cancelNodeDragTransaction,
  updateCamera,
  updateCoordinateReadout,
  localScreenPoint,
  snapPoint,
  modelPointFromClient,
  nodeDragPointFromClient,
  addNode,
  createMemberEndpoint,
  openCandidatePicker,
  selectStructuralTarget,
  candidateTargetsAtPoint,
  performTargetAction,
  finishSelectionBox,
  beginProjectTransaction,
  commitProjectTransaction,
  onRequestInspector,
  t,
}: UseCanvasPointerGesturesArgs) => {
  const capturePointer = useCallback((pointerId: number) => {
    try { svgRef.current?.setPointerCapture(pointerId); } catch { /* Pointer may already be cancelled. */ }
  }, [svgRef]);

  const releasePointer = useCallback((pointerId: number) => {
    try {
      if (svgRef.current?.hasPointerCapture(pointerId)) svgRef.current.releasePointerCapture(pointerId);
    } catch { /* The browser already released it. */ }
  }, [svgRef]);

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
  }, [cameraRef, capturePointer, clearLongPressTimer, transitionInteraction]);

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
  }, [cameraRef, capturePointer, clearLongPressTimer, localScreenPoint, modelPointFromClient, project, scheduleStructuralEditDraft, setStructuralEditCommitError, structuralEditDraft, structuralEditPointerArmed, t, transitionInteraction]);

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
  }, [clearLongPressTimer, generatorOriginPickingRef, generatorPickTokenRef, modelPointFromClient, setGeneratorOriginPicking, setGeneratorPickedOrigin]);

  const toggleGeneratorOriginPick = useCallback(() => {
    setGeneratorOriginPicking((armed) => {
      const next = !armed;
      generatorOriginPickingRef.current = next;
      return next;
    });
  }, [generatorOriginPickingRef, setGeneratorOriginPicking]);

  /** El punto ya llegó al formulario; el lienzo puede olvidarlo. */
  const resolveGeneratorOriginPick = useCallback(() => setGeneratorPickedOrigin(null), [setGeneratorPickedOrigin]);

  const closeGenerator = useCallback(() => {
    setGeneratorOpen(false);
    setGeneratorGhost(null);
    setGeneratorOrigin(null);
    setGeneratorOriginPicking(false);
    generatorOriginPickingRef.current = false;
  }, [generatorOriginPickingRef, setGeneratorGhost, setGeneratorOpen, setGeneratorOrigin, setGeneratorOriginPicking]);

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
  }, [activeTool, cameraRef, capturePointer, clearLongPressTimer, interactionRef, localScreenPoint, longPressMotionRef, longPressTimerRef, onRequestInspector, openCandidatePicker, selectStructuralTarget, setActiveTool, transitionInteraction]);

  const shouldStartPan = useCallback((event: ReactPointerEvent) =>
    event.button === 1 || (event.button === 0 && (activeTool === 'pan' || spacePressedRef.current)), [activeTool, spacePressedRef]);

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
    const first = entries[0]!;
    const second = entries[1]!;
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
      const first = activePointersRef.current.get(current.pointerIds[0]!);
      const second = activePointersRef.current.get(current.pointerIds[1]!);
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
  }, [activePointersRef, cancelNodeDragTransaction, clearLongPressTimer, interactionRef, pendingStructuralEditDraftRef, releasePointer, setSnapPreview, setStructuralEditDraft, setStructuralEditLiveDraft, setStructuralEditPointerArmed, setTouchLoupe, structuralEditFrameRef, structuralEditLiveDraftRef, transitionInteraction]);

  return {
    capturePointer,
    releasePointer,
    startPan,
    startStructuralEditPointer,
    pickGeneratorOrigin,
    toggleGeneratorOriginPick,
    resolveGeneratorOriginPick,
    closeGenerator,
    startPending,
    shouldStartPan,
    handleObjectPointerDown,
    handleBackgroundPointerDown,
    handlePointerDownCapture,
    syncTouchLoupe,
    handlePointerMove,
    finishPointer,
    cancelActiveInteraction,
  };
};
