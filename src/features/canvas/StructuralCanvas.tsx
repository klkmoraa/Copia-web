import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { X } from 'lucide-react';
import { useProject } from '../../store/ProjectContext';
import type { DiagramPoint, DiagramQuantity, MemberModel, NodeModel, Selection, Tool } from '../../types';
import { evaluateDiagramAt } from '../../engine/diagram';
import { buildLeftCutEquilibrium } from '../../engine/cut';
import { resolveMemberLocalLoads } from '../../engine/solver';
import { fromDisplay, toDisplay, unitLabel } from '../../engine/units';
import { exportSvgAsPng, exportSvgElement } from '../../utils/export';
import { formatFixed, formatScientific } from '../../utils/numberFormat';
import { copyModelSelection, duplicateModelSelection, ensureNodeAtPoint, pasteModelClipboard, splitMemberAt, structuralSelectionFromIds, toggleStructuralSelection, type ModelClipboard } from '../../data/modelOperations';
import {
  buildIntersectionSnapCandidates,
  buildPerpendicularSnapCandidates,
  resolveSnap,
  type SnapCandidate,
  type SnapKind,
  type SnapSegment,
} from '../../utils/snapping';
import { selectGeometryByBox } from '../../utils/selectionGeometry';
import { useI18n } from '../../i18n/useI18n';
import { useClassroomSession } from '../../store/ClassroomSessionContext';
import type { TranslationKey } from '../../i18n/catalogs';
import {
  cameraForViewportResize,
  cameraForPinch,
  canvasPointerProfile,
  midpoint,
  movedPastThreshold,
  panCameraFrom,
  pendingDragIntent,
  pointDistance,
  screenToModelPoint,
  shouldArmLongPress,
  zoomCameraAt,
  type CanvasCamera,
  type ModelPoint,
  type ScreenPoint,
} from './canvasInteraction';
import { toolFromShortcut } from './toolRegistry';
import { cameraToFitBounds, canvasSafeInsetsFor, canvasSafeRect } from './canvasChromeGeometry';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';
import { CanvasChrome } from './CanvasChrome';
import { layoutSmartLabels, smartLabelDetailForScale, type SmartLabelCandidate } from './labelLayout';
import { buildCanvasSelectionVisualState, selectionEnvelopeForPoints } from './selectionVisuals';
import { onWorkspaceCommand, type FocusableSelection } from '../workspace/workspaceCommands';
import { CanvasGeometryLayer, type StructuralTarget } from './CanvasGeometryLayer';
import {
  flexibleRatioFromGross,
  grossRatioAtPoint,
  grossRatioFromFlexible,
  memberAxis,
  modelBounds,
  pointAtGrossRatio,
  toGlobalVector,
} from '../../graphics/structureGeometry';
import { CanvasResultLayer, diagramPixelScaleFor, reactionClearanceFor } from './CanvasResultLayer';
import { CanvasInteractionLayer } from './CanvasInteractionLayer';

type Camera = CanvasCamera;

/** Shared empty list so the memoised snap candidates keep a stable identity. */
const EMPTY_SNAP_CANDIDATES: SnapCandidate[] = [];

interface Size {
  width: number;
  height: number;
}

interface CutInfo {
  memberId: string;
  ratio: number;
  point: DiagramPoint | null;
  clientX: number;
  clientY: number;
  pinned?: boolean;
}

interface SelectionBox {
  pointerId: number;
  start: { x: number; y: number };
  current: { x: number; y: number };
  additive: boolean;
}

type CanvasInteraction =
  | { kind: 'idle' }
  | {
    kind: 'pending';
    pointerId: number;
    pointerType: string;
    start: ScreenPoint;
    target: StructuralTarget;
    tool: Tool;
    shiftKey: boolean;
  }
  | {
    kind: 'pan';
    pointerId: number;
    pointerType: string;
    start: ScreenPoint;
    camera: Camera;
    moved: boolean;
    clearSelectionOnTap: boolean;
  }
  | {
    kind: 'pinch';
    pointerIds: [number, number];
    camera: Camera;
    anchor: ModelPoint;
    startDistance: number;
  }
  | { kind: 'node-drag'; pointerId: number; pointerType: string; nodeId: string; grabOffset: ModelPoint }
  | ({ kind: 'selection-box' } & SelectionBox)
  | { kind: 'long-press'; pointerId: number; target: StructuralTarget };

const IDLE_INTERACTION: CanvasInteraction = { kind: 'idle' };

const toolLabelKeys: Record<Tool, TranslationKey> = {
  select: 'toolbar.select',
  pan: 'toolbar.pan',
  node: 'toolbar.node',
  member: 'toolbar.member',
  support: 'toolbar.support',
  pointLoad: 'toolbar.pointLoad',
  distributedLoad: 'toolbar.distributedLoad',
  moment: 'toolbar.moment',
  dimension: 'toolbar.dimension',
  cut: 'toolbar.cut',
  split: 'toolbar.split',
  delete: 'toolbar.delete',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const nextId = (prefix: string, ids: string[]) => {
  let index = 1;
  while (ids.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
};

const supportCycle = ['none', 'pin', 'roller', 'fixed'] as const;

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
    selectedCombinationId,
    setSelection,
    setActiveTool,
    updateProject,
    replaceProject,
    beginProjectTransaction,
    moveNodeTransient,
    commitProjectTransaction,
    cancelProjectTransaction,
    learningFocus,
    resultCursor,
    influenceCanvasState,
  } = useProject();
  const { resultsVisible } = useClassroomSession();
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const coordinateReadoutRef = useRef<HTMLOutputElement>(null);
  const [size, setSize] = useState<Size>({ width: 1000, height: 640 });
  const [canvasMeasured, setCanvasMeasured] = useState(false);
  const [camera, setCamera] = useState<Camera>({ scale: 85, x: 260, y: 500 });
  const [memberStart, setMemberStart] = useState<string | null>(null);
  const [cut, setCut] = useState<CutInfo | null>(null);
  const [interaction, setInteractionState] = useState<CanvasInteraction>(IDLE_INTERACTION);
  const [spacePressed, setSpacePressed] = useState(false);
  const [snapPreview, setSnapPreview] = useState<{ x: number; y: number; kind: SnapKind } | null>(null);
  const [quickEntry, setQuickEntry] = useState({ first: '', second: '' });
  const [quickEntryMode, setQuickEntryMode] = useState<'delta' | 'polar'>('delta');
  const [quickEntryError, setQuickEntryError] = useState('');
  const [cycleIndicator, setCycleIndicator] = useState<{ x: number; y: number; index: number; total: number } | null>(null);
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
  const selectionCycleRef = useRef<{ x: number; y: number; at: number; key: string; index: number } | null>(null);
  const cycleTimerRef = useRef<number | null>(null);
  const previousSizeRef = useRef<Size | null>(null);
  const fittedProjectRef = useRef<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const [canvasFeedback, setCanvasFeedback] = useState('');
  const selectionBox = interaction.kind === 'selection-box' ? interaction : null;

  const nodeMap = useMemo(() => new Map(project.nodes.map((node) => [node.id, node])), [project.nodes]);
  const memberMap = useMemo(() => new Map(project.members.map((member) => [member.id, member])), [project.members]);
  const snapSegments = useMemo<SnapSegment[]>(() => project.members.flatMap((member) => {
    const start = nodeMap.get(member.i);
    const end = nodeMap.get(member.j);
    return start && end ? [{ id: member.id, start, end }] : [];
  }), [nodeMap, project.members]);
  const baseSnapCandidates = useMemo<SnapCandidate[]>(() => {
    const candidates: SnapCandidate[] = [];
    if (project.settings.snapTargets?.nodes ?? true) {
      for (const node of project.nodes) candidates.push({ x: node.x, y: node.y, kind: 'node', sourceIds: [node.id] });
    }
    if (project.settings.snapTargets?.midpoints ?? true) {
      for (const segment of snapSegments) candidates.push({
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
        kind: 'midpoint',
        sourceIds: [segment.id],
      });
    }
    if ((project.settings.snapTargets?.intersections ?? true) && snapSegments.length <= 500) {
      candidates.push(...buildIntersectionSnapCandidates(snapSegments));
    }
    return candidates;
  }, [project.nodes, project.settings.snapTargets, snapSegments]);
  const drawingOrigin = useMemo(() => (memberStart ? nodeMap.get(memberStart) ?? null : null), [memberStart, nodeMap]);
  // Perpendicular feet only depend on the drawing origin and the geometry, never
  // on the pointer, so they are built per model revision instead of per frame.
  const perpendicularSnapCandidates = useMemo<SnapCandidate[]>(() => (
    drawingOrigin && (project.settings.snapTargets?.perpendicular ?? true)
      ? buildPerpendicularSnapCandidates(drawingOrigin, snapSegments)
      : EMPTY_SNAP_CANDIDATES
  ), [drawingOrigin, project.settings.snapTargets, snapSegments]);
  const resultMap = useMemo(() => new Map((analysis?.memberResults ?? []).map((result) => [result.memberId, result])), [analysis]);
  const nodeResultMap = useMemo(() => new Map((analysis?.nodeResults ?? []).map((result) => [result.nodeId, result])), [analysis]);
  const mechanismMap = useMemo(() => new Map((analysis?.mechanism?.nodes ?? []).map((node) => [node.nodeId, node])), [analysis?.mechanism]);
  /** P6 — Heatmap: demand ratio η per member. Pure presentation — reads frozen analysis data, never writes. */
  const heatmapRatios = useMemo<Map<string, number>>(() => {
    if (!analysis?.success || !layers.heatmap) return new Map();
    const fy = 250_000; // kPa = kN/m², ref. S275
    const ratioMap = new Map<string, number>();
    for (const result of analysis.memberResults) {
      const member = memberMap.get(result.memberId);
      if (!member || member.type === 'rigid') continue;
      const area = member.A > 0 ? member.A : 0.005;
      const inertia = member.I > 0 ? member.I : 0.00008;
      const depth = Math.sqrt((12 * inertia) / area) || 0.3;
      const Wel = inertia / (depth / 2) || 0.0005;
      const maxAxial = Math.max(Math.abs(result.maxAxial ?? 0), Math.abs(result.minAxial ?? 0));
      const maxMoment = Math.max(Math.abs(result.maxMoment ?? 0), Math.abs(result.minMoment ?? 0));
      const sigmaAxial = maxAxial / area;   // kPa
      const sigmaBending = maxMoment / Wel;  // kPa
      const ratio = (sigmaAxial + sigmaBending) / fy;
      ratioMap.set(result.memberId, ratio);
    }
    return ratioMap;
  }, [analysis, layers.heatmap, memberMap]);
  const units = project.settings.units;
  const selectionFilter = useMemo(() => project.settings.selectionFilter ?? { nodes: true, members: true, loads: true }, [project.settings.selectionFilter]);
  const resultsAllowed = project.settings.calculationMode !== 'classroom' || resultsVisible;
  const lengthLabel = unitLabel(units, 'length');
  const forceLabel = unitLabel(units, 'force');
  const momentLabel = unitLabel(units, 'moment');
  const distributedLabel = unitLabel(units, 'distributedForce');
  const selectedCombination = project.combinations.find((item) => item.id === selectedCombinationId) ?? null;
  const selectionVisualState = useMemo(() => buildCanvasSelectionVisualState(selection), [selection]);

  /** P12 — Dynamic Mode Shapes: Harmonic oscillation loop for deformed shape */
  const [oscillating, setOscillating] = useState(false);
  const [oscillationFactor, setOscillationFactor] = useState(1);

  useEffect(() => {
    if (!oscillating || resultTab !== 'deformed' || !analysis?.success) {
      setOscillationFactor(1);
      return undefined;
    }
    let frame: number;
    const startTime = performance.now();
    const loop = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      // Harmonic wave: sin(2*pi*f*t) with f = 0.85 Hz
      const factor = Math.sin(elapsed * Math.PI * 2 * 0.85);
      setOscillationFactor(factor);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [oscillating, resultTab, analysis?.success]);
  const loadPlacementInstruction = activeTool === 'pointLoad'
    ? t('canvas.placePointLoad')
    : activeTool === 'distributedLoad'
      ? t('canvas.placeDistributedLoad')
      : activeTool === 'moment'
        ? t('canvas.placeMoment')
        : null;
  const loadsLayerVisible = layers.loads || loadPlacementInstruction !== null;
  const cutEquilibrium = useMemo(() => {
    if (!cut?.point || !analysis?.success) return null;
    const memberResult = resultMap.get(cut.memberId);
    if (!memberResult) return null;
    try {
      const resolved = resolveMemberLocalLoads(project, cut.memberId, selectedCombination);
      return buildLeftCutEquilibrium(memberResult.localEndForces, resolved.loads, cut.point);
    } catch {
      return null;
    }
  }, [analysis?.success, cut, project, resultMap, selectedCombination]);

  const transitionInteraction = useCallback((next: CanvasInteraction) => {
    interactionRef.current = next;
    setInteractionState(next);
  }, []);

  const updateCamera = useCallback((next: Camera | ((current: Camera) => Camera)) => {
    const resolved = typeof next === 'function' ? next(cameraRef.current) : next;
    cameraRef.current = resolved;
    if (cameraFrameRef.current !== null) return;
    cameraFrameRef.current = window.requestAnimationFrame(() => {
      cameraFrameRef.current = null;
      setCamera(cameraRef.current);
    });
  }, []);

  const scheduleInteractionFrame = useCallback((next: CanvasInteraction) => {
    interactionRef.current = next;
    if (interactionFrameRef.current !== null) return;
    interactionFrameRef.current = window.requestAnimationFrame(() => {
      interactionFrameRef.current = null;
      setInteractionState(interactionRef.current);
    });
  }, []);

  const flushNodeMove = useCallback(() => {
    if (nodeMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(nodeMoveFrameRef.current);
      nodeMoveFrameRef.current = null;
    }
    const pending = pendingNodeMoveRef.current;
    pendingNodeMoveRef.current = null;
    if (pending) moveNodeTransient(pending.nodeId, pending.point);
  }, [moveNodeTransient]);

  const scheduleNodeMove = useCallback((nodeId: string, point: { x: number; y: number }) => {
    pendingNodeMoveRef.current = { nodeId, point };
    if (nodeMoveFrameRef.current !== null) return;
    nodeMoveFrameRef.current = window.requestAnimationFrame(() => {
      nodeMoveFrameRef.current = null;
      const pending = pendingNodeMoveRef.current;
      pendingNodeMoveRef.current = null;
      if (pending) moveNodeTransient(pending.nodeId, pending.point);
    });
  }, [moveNodeTransient]);

  const cancelNodeDragTransaction = useCallback(() => {
    pendingNodeMoveRef.current = null;
    if (nodeMoveFrameRef.current !== null) window.cancelAnimationFrame(nodeMoveFrameRef.current);
    nodeMoveFrameRef.current = null;
    cancelProjectTransaction();
  }, [cancelProjectTransaction]);

  const showCanvasFeedback = useCallback((message: string) => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    setCanvasFeedback(message);
    feedbackTimerRef.current = window.setTimeout(() => {
      setCanvasFeedback('');
      feedbackTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => () => {
    if (cameraFrameRef.current !== null) window.cancelAnimationFrame(cameraFrameRef.current);
    if (interactionFrameRef.current !== null) window.cancelAnimationFrame(interactionFrameRef.current);
    if (nodeMoveFrameRef.current !== null) window.cancelAnimationFrame(nodeMoveFrameRef.current);
    if (cycleTimerRef.current !== null) window.clearTimeout(cycleTimerRef.current);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    cameraFrameRef.current = null;
    interactionFrameRef.current = null;
    nodeMoveFrameRef.current = null;
    cycleTimerRef.current = null;
    feedbackTimerRef.current = null;
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const toScreen = useCallback((x: number, y: number) => ({ x: camera.x + x * camera.scale, y: camera.y - y * camera.scale }), [camera]);
  const toModel = useCallback((screenX: number, screenY: number) => ({ x: (screenX - camera.x) / camera.scale, y: (camera.y - screenY) / camera.scale }), [camera]);
  const localScreenPoint = useCallback((clientX: number, clientY: number): ScreenPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const updateCoordinateReadout = useCallback((clientX: number, clientY: number, pointerType: string) => {
    if (!canvasPointerProfile(pointerType).showsCoordinates || !coordinateReadoutRef.current) return;
    const point = screenToModelPoint(localScreenPoint(clientX, clientY), cameraRef.current);
    coordinateReadoutRef.current.textContent = `X ${formatFixed(toDisplay(point.x, units, 'length'), 3)} · Y ${formatFixed(toDisplay(point.y, units, 'length'), 3)} ${lengthLabel}`;
  }, [lengthLabel, localScreenPoint, units]);

  const fitModel = useCallback(() => {
    if (!project.nodes.length || !size.width || !size.height) return;
    const viewport = { width: size.width, height: size.height };
    updateCamera(cameraToFitBounds(
      modelBounds(project.nodes),
      viewport,
      canvasSafeInsetsFor(viewport),
    ));
  }, [project.nodes, size, updateCamera]);

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
      const scale = Math.max(85, cameraRef.current.scale);
      updateCamera({ scale, x: size.width / 2 - point.x * scale, y: size.height / 2 + point.y * scale });
      showCanvasFeedback(t('canvas.objectCentered', { id: detail.id }));
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

  const snapPoint = useCallback((point: { x: number; y: number }, excludedNodeId?: string) => {
    // Reuse the memoised arrays untouched whenever nothing has to be merged or
    // excluded: a pointer move should not copy the whole candidate list.
    const merged = perpendicularSnapCandidates.length
      ? [...baseSnapCandidates, ...perpendicularSnapCandidates]
      : baseSnapCandidates;
    const candidates = excludedNodeId
      ? merged.filter((candidate) => !(candidate.kind === 'node' && candidate.sourceIds?.includes(excludedNodeId)))
      : merged;
    const result = resolveSnap(point, {
      enabled: project.settings.snap,
      gridSize: project.settings.gridSize,
      pixelsPerUnit: camera.scale,
      candidates,
      modes: {
        grid: project.settings.snapTargets?.grid ?? true,
        node: project.settings.snapTargets?.nodes ?? true,
        midpoint: project.settings.snapTargets?.midpoints ?? true,
        intersection: project.settings.snapTargets?.intersections ?? true,
        perpendicular: Boolean(drawingOrigin) && (project.settings.snapTargets?.perpendicular ?? true),
      },
    });
    const nextPreview = result.kind === 'none' ? null : { ...result.point, kind: result.kind };
    setSnapPreview((current) => current?.kind === nextPreview?.kind && current?.x === nextPreview?.x && current?.y === nextPreview?.y ? current : nextPreview);
    return result.point;
  }, [baseSnapCandidates, camera.scale, drawingOrigin, perpendicularSnapCandidates, project.settings.gridSize, project.settings.snap, project.settings.snapTargets]);

  const modelPointFromClient = useCallback((clientX: number, clientY: number, excludedNodeId?: string) => {
    const local = localScreenPoint(clientX, clientY);
    return snapPoint(screenToModelPoint(local, cameraRef.current), excludedNodeId);
  }, [localScreenPoint, snapPoint]);

  const nodeDragPointFromClient = useCallback((
    clientX: number,
    clientY: number,
    excludedNodeId: string,
    grabOffset: ModelPoint,
  ) => {
    const local = localScreenPoint(clientX, clientY);
    const pointerPoint = screenToModelPoint(local, cameraRef.current);
    return snapPoint({ x: pointerPoint.x + grabOffset.x, y: pointerPoint.y + grabOffset.y }, excludedNodeId);
  }, [localScreenPoint, snapPoint]);

  const deleteSelection = useCallback((target: Selection = selection) => {
    if (!target) return;
    updateProject((draft) => {
      if (target.kind === 'multi') {
        const nodeIds = new Set(target.nodeIds);
        const memberIds = new Set(target.memberIds);
        for (const member of draft.members) if (nodeIds.has(member.i) || nodeIds.has(member.j)) memberIds.add(member.id);
        draft.nodes = draft.nodes.filter((node) => !nodeIds.has(node.id));
        draft.members = draft.members.filter((member) => !memberIds.has(member.id));
        draft.nodalLoads = draft.nodalLoads.filter((load) => !nodeIds.has(load.nodeId));
        draft.memberLoads = draft.memberLoads.filter((load) => !memberIds.has(load.memberId));
        draft.prescribedDisplacements = (draft.prescribedDisplacements ?? []).filter((item) => !nodeIds.has(item.nodeId));
        draft.memberInitialEffects = (draft.memberInitialEffects ?? []).filter((effect) => !memberIds.has(effect.memberId));
      } else if (target.kind === 'node') {
        draft.nodes = draft.nodes.filter((node) => node.id !== target.id);
        const deletedMembers = draft.members.filter((member) => member.i === target.id || member.j === target.id).map((member) => member.id);
        draft.members = draft.members.filter((member) => !deletedMembers.includes(member.id));
        draft.nodalLoads = draft.nodalLoads.filter((load) => load.nodeId !== target.id);
        draft.memberLoads = draft.memberLoads.filter((load) => !deletedMembers.includes(load.memberId));
        draft.prescribedDisplacements = (draft.prescribedDisplacements ?? []).filter((item) => item.nodeId !== target.id);
        draft.memberInitialEffects = (draft.memberInitialEffects ?? []).filter((effect) => !deletedMembers.includes(effect.memberId));
      } else if (target.kind === 'member') {
        draft.members = draft.members.filter((member) => member.id !== target.id);
        draft.memberLoads = draft.memberLoads.filter((load) => load.memberId !== target.id);
        draft.memberInitialEffects = (draft.memberInitialEffects ?? []).filter((effect) => effect.memberId !== target.id);
      } else if (target.kind === 'nodalLoad') draft.nodalLoads = draft.nodalLoads.filter((load) => load.id !== target.id);
      else draft.memberLoads = draft.memberLoads.filter((load) => load.id !== target.id);
      return draft;
    });
    setSelection(null);
  }, [selection, setSelection, updateProject]);

  const addNode = (point: { x: number; y: number }) => {
    let id = '';
    updateProject((draft) => {
      id = ensureNodeAtPoint(draft, point).nodeId;
      return draft;
    });
    if (id) setSelection({ kind: 'node', id });
    return id;
  };

  const createMemberEndpoint = (point: { x: number; y: number }) => {
    if (!memberStart) {
      const id = addNode(point);
      setMemberStart(id);
      return;
    }
    const startNode = nodeMap.get(memberStart);
    if (!startNode || Math.hypot(point.x - startNode.x, point.y - startNode.y) <= 1e-10) {
      setQuickEntryError(t('canvas.endpointSeparated'));
      return;
    }
    let nodeId = '';
    let memberId = '';
    updateProject((draft) => {
      nodeId = ensureNodeAtPoint(draft, point).nodeId;
      if (nodeId === memberStart) return draft;
      const existing = draft.members.find((member) =>
        (member.i === memberStart && member.j === nodeId) || (member.i === nodeId && member.j === memberStart));
      if (existing) {
        memberId = existing.id;
        return draft;
      }
      memberId = nextId('M', draft.members.map((member) => member.id));
      draft.members.push({ id: memberId, i: memberStart, j: nodeId, type: 'frame', E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 });
      return draft;
    });
    setMemberStart(null);
    if (memberId) setSelection({ kind: 'member', id: memberId });
    setQuickEntry({ first: '', second: '' });
    setQuickEntryError('');
  };

  const submitQuickEntry = () => {
    const first = Number(quickEntry.first);
    const second = Number(quickEntry.second);
    if (
      quickEntry.first.trim() === ''
      || quickEntry.second.trim() === ''
      || !Number.isFinite(first)
      || !Number.isFinite(second)
    ) {
      setQuickEntryError(t('canvas.twoValidNumbers'));
      return;
    }
    if (activeTool === 'node') {
      addNode({ x: fromDisplay(first, units, 'length'), y: fromDisplay(second, units, 'length') });
      setQuickEntry({ first: '', second: '' });
      setQuickEntryError('');
      return;
    }
    const startNode = memberStart ? nodeMap.get(memberStart) : null;
    if (!startNode) return;
    if (quickEntryMode === 'delta') {
      createMemberEndpoint({ x: startNode.x + fromDisplay(first, units, 'length'), y: startNode.y + fromDisplay(second, units, 'length') });
    } else {
      const length = fromDisplay(first, units, 'length');
      const radians = second * Math.PI / 180;
      createMemberEndpoint({ x: startNode.x + length * Math.cos(radians), y: startNode.y + length * Math.sin(radians) });
    }
  };

  const capturePointer = useCallback((pointerId: number) => {
    try { svgRef.current?.setPointerCapture(pointerId); } catch { /* Pointer may already be cancelled. */ }
  }, []);

  const releasePointer = useCallback((pointerId: number) => {
    try {
      if (svgRef.current?.hasPointerCapture(pointerId)) svgRef.current.releasePointerCapture(pointerId);
    } catch { /* The browser already released it. */ }
  }, []);

  const selectStructuralTarget = useCallback((target: StructuralTarget) => {
    if (target.kind === 'background') setSelection(null);
    else setSelection({ kind: target.kind, id: target.id });
  }, [setSelection]);

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

  const startPending = useCallback((event: ReactPointerEvent, target: StructuralTarget) => {
    const pending: CanvasInteraction = {
      kind: 'pending',
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      start: { x: event.clientX, y: event.clientY },
      target,
      tool: activeTool,
      shiftKey: event.shiftKey,
    };
    capturePointer(event.pointerId);
    transitionInteraction(pending);
    clearLongPressTimer();
    if (shouldArmLongPress(event.pointerType, activeTool, target.kind)) {
      longPressTimerRef.current = window.setTimeout(() => {
        const current = interactionRef.current;
        if (current.kind !== 'pending' || current.pointerId !== event.pointerId) return;
        selectStructuralTarget(target);
        setActiveTool('select');
        onRequestInspector?.();
        transitionInteraction({ kind: 'long-press', pointerId: event.pointerId, target });
        longPressTimerRef.current = null;
      }, 480);
    }
  }, [activeTool, capturePointer, clearLongPressTimer, onRequestInspector, selectStructuralTarget, setActiveTool, transitionInteraction]);

  const completeLoadPlacement = (label: string) => {
    setActiveTool('select');
    showCanvasFeedback(t('canvas.loadAdded', { load: label }));
    // Open after the click sequence so the newly mounted backdrop cannot receive
    // the matching pointerup/click.
    window.requestAnimationFrame(() => onRequestInspector?.());
  };

  const finishSelectionBox = useCallback((box: SelectionBox) => {
    const result = selectGeometryByBox(box.start, box.current, project.nodes, project.members, selectionFilter);
    const nodeIds = new Set(result.nodeIds);
    const memberIds = new Set(result.memberIds);
    if (box.additive) {
      if (selection?.kind === 'node') nodeIds.add(selection.id);
      else if (selection?.kind === 'member') memberIds.add(selection.id);
      else if (selection?.kind === 'multi') {
        selection.nodeIds.forEach((id) => nodeIds.add(id));
        selection.memberIds.forEach((id) => memberIds.add(id));
      }
    }
    setSelection(structuralSelectionFromIds(nodeIds, memberIds));
  }, [project.members, project.nodes, selection, selectionFilter, setSelection]);

  const performNodeAction = (node: NodeModel, tool: Tool, shiftKey = false) => {
    if (tool === 'member') {
      if (!memberStart) { setMemberStart(node.id); setSelection({ kind: 'node', id: node.id }); return; }
      if (memberStart === node.id) { setMemberStart(null); return; }
      const id = nextId('M', project.members.map((member) => member.id));
      updateProject((draft) => {
        draft.members.push({ id, i: memberStart, j: node.id, type: 'frame', E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 });
        return draft;
      });
      setMemberStart(null);
      setSelection({ kind: 'member', id });
      return;
    }
    if (tool === 'support') {
      updateProject((draft) => {
        const target = draft.nodes.find((item) => item.id === node.id);
        if (target) {
          const current = supportCycle.indexOf(target.support.type as typeof supportCycle[number]);
          const type = supportCycle[(current + 1 + supportCycle.length) % supportCycle.length];
          target.support = type === 'roller' ? { type, angleDeg: 90 } : { type };
        }
        return draft;
      });
      setSelection({ kind: 'node', id: node.id });
      return;
    }
    if (tool === 'pointLoad') {
      const id = nextId('NL', project.nodalLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        draft.nodalLoads.push({ id, nodeId: node.id, caseId, fx: 0, fy: -fromDisplay(10, units, 'force'), mz: 0 });
        return draft;
      });
      setSelection({ kind: 'nodalLoad', id });
      completeLoadPlacement(t('toolbar.pointLoad'));
      return;
    }
    if (tool === 'moment') {
      const id = nextId('NL', project.nodalLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        draft.nodalLoads.push({ id, nodeId: node.id, caseId, fx: 0, fy: 0, mz: fromDisplay(10, units, 'moment') });
        return draft;
      });
      setSelection({ kind: 'nodalLoad', id });
      completeLoadPlacement(t('toolbar.moment'));
      return;
    }
    if (tool === 'distributedLoad') {
      showCanvasFeedback(t('canvas.placeDistributedLoad'));
      return;
    }
    if (tool === 'delete') { deleteSelection({ kind: 'node', id: node.id }); return; }
    if (tool === 'select' && shiftKey) {
      setSelection(toggleStructuralSelection(selection, { kind: 'node', id: node.id }));
      return;
    }
    setSelection({ kind: 'node', id: node.id });
  };

  const performMemberAction = (member: MemberModel, tool: Tool, client: ScreenPoint, shiftKey = false) => {
    if (tool === 'split' || tool === 'node' || tool === 'support') {
      const point = screenToModelPoint(localScreenPoint(client.x, client.y), cameraRef.current);
      const ni = nodeMap.get(member.i)!;
      const nj = nodeMap.get(member.j)!;
      const dx = nj.x - ni.x;
      const dy = nj.y - ni.y;
      const ratio = clamp(((point.x - ni.x) * dx + (point.y - ni.y) * dy) / Math.max(dx * dx + dy * dy, 1e-18), 1e-6, 1 - 1e-6);
      let nodeId = '';
      updateProject((draft) => {
        const result = splitMemberAt(draft, member.id, ratio);
        nodeId = result.nodeId;
        if (tool === 'support') {
          const target = draft.nodes.find((node) => node.id === nodeId);
          if (target) target.support = { type: 'pin' };
        }
        return draft;
      });
      if (nodeId) setSelection({ kind: 'node', id: nodeId });
      return;
    }
    if (tool === 'distributedLoad') {
      const id = nextId('ML', project.memberLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        draft.memberLoads.push({
          id, memberId: member.id, caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
          start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -fromDisplay(10, units, 'distributedForce'), qyEnd: -fromDisplay(10, units, 'distributedForce'),
        });
        return draft;
      });
      setSelection({ kind: 'memberLoad', id });
      completeLoadPlacement(t('toolbar.distributedLoad'));
      return;
    }
    if (tool === 'pointLoad') {
      const p = screenToModelPoint(localScreenPoint(client.x, client.y), cameraRef.current);
      const ni = nodeMap.get(member.i)!;
      const nj = nodeMap.get(member.j)!;
      const axis = memberAxis(member, ni, nj);
      const ratio = flexibleRatioFromGross(axis, grossRatioAtPoint(axis, p));
      const id = nextId('ML', project.memberLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        draft.memberLoads.push({ id, memberId: member.id, caseId, type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -fromDisplay(10, units, 'force'), position: ratio });
        return draft;
      });
      setSelection({ kind: 'memberLoad', id });
      completeLoadPlacement(t('toolbar.pointLoad'));
      return;
    }
    if (tool === 'moment') {
      const p = screenToModelPoint(localScreenPoint(client.x, client.y), cameraRef.current);
      const ni = nodeMap.get(member.i)!;
      const nj = nodeMap.get(member.j)!;
      const axis = memberAxis(member, ni, nj);
      const ratio = flexibleRatioFromGross(axis, grossRatioAtPoint(axis, p));
      const id = nextId('ML', project.memberLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        draft.memberLoads.push({ id, memberId: member.id, caseId, type: 'moment', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, moment: fromDisplay(10, units, 'moment'), position: ratio });
        return draft;
      });
      setSelection({ kind: 'memberLoad', id });
      completeLoadPlacement(t('toolbar.moment'));
      return;
    }
    if (tool === 'cut') {
      const modelPoint = screenToModelPoint(localScreenPoint(client.x, client.y), cameraRef.current);
      const ni = nodeMap.get(member.i)!;
      const nj = nodeMap.get(member.j)!;
      const dx = nj.x - ni.x;
      const dy = nj.y - ni.y;
      const ratio = clamp(((modelPoint.x - ni.x) * dx + (modelPoint.y - ni.y) * dy) / Math.max(dx * dx + dy * dy, 1e-18), 0, 1);
      setCut({ memberId: member.id, ratio, point: memberValueAt(member.id, ratio), clientX: client.x, clientY: client.y, pinned: true });
      setSelection({ kind: 'member', id: member.id });
      return;
    }
    if (tool === 'delete') { deleteSelection({ kind: 'member', id: member.id }); return; }
    if (tool === 'select' && shiftKey) {
      setSelection(toggleStructuralSelection(selection, { kind: 'member', id: member.id }));
      return;
    }
    setSelection({ kind: 'member', id: member.id });
  };

  const performTargetAction = (target: StructuralTarget, tool: Tool, client: ScreenPoint, shiftKey = false) => {
    if (target.kind === 'background') {
      if (tool === 'node') addNode(modelPointFromClient(client.x, client.y));
      else if (tool === 'member') createMemberEndpoint(modelPointFromClient(client.x, client.y));
      else if (tool === 'pointLoad' || tool === 'distributedLoad' || tool === 'moment') {
        showCanvasFeedback(tool === 'distributedLoad'
          ? t('canvas.placeDistributedLoad')
          : tool === 'moment'
            ? t('canvas.placeMoment')
            : t('canvas.placePointLoad'));
      }
      else {
        setSelection(null);
        setMemberStart(null);
        setCut(null);
      }
      return;
    }
    if (target.kind === 'node') {
      const node = nodeMap.get(target.id);
      if (node) performNodeAction(node, tool, shiftKey);
      return;
    }
    if (target.kind === 'member') {
      const member = memberMap.get(target.id);
      if (member) performMemberAction(member, tool, client, shiftKey);
      return;
    }
    const selectedTarget: Selection = { kind: target.kind, id: target.id };
    if (tool === 'delete') deleteSelection(selectedTarget);
    else setSelection(selectedTarget);
  };

  const shouldStartPan = useCallback((event: ReactPointerEvent) =>
    event.button === 1 || (event.button === 0 && (activeTool === 'pan' || spacePressedRef.current)), [activeTool]);

  const handleObjectPointerDown = (event: ReactPointerEvent, target: StructuralTarget) => {
    event.stopPropagation();
    if (interactionRef.current.kind === 'pinch') return;
    if (shouldStartPan(event)) {
      event.preventDefault();
      startPan(event.pointerId, event.pointerType, { x: event.clientX, y: event.clientY }, false);
      return;
    }
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
      if (event.pointerType !== 'touch') {
        const candidates: StructuralTarget[] = [];
        const seen = new Set<string>();
        const hitElements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [event.target as Element];
        for (const element of hitElements) {
          const object = element.closest<SVGElement>('[data-structure-kind][data-structure-id]');
          const kind = object?.dataset.structureKind;
          const id = object?.dataset.structureId;
          if (!kind || !id || !['node', 'member', 'nodalLoad', 'memberLoad'].includes(kind)) continue;
          if (kind === 'node' && !selectionFilter.nodes) continue;
          if (kind === 'member' && !selectionFilter.members) continue;
          if ((kind === 'nodalLoad' || kind === 'memberLoad') && !selectionFilter.loads) continue;
          const candidateKey = `${kind}:${id}`;
          if (seen.has(candidateKey)) continue;
          seen.add(candidateKey);
          candidates.push({ kind: kind as 'node' | 'member' | 'nodalLoad' | 'memberLoad', id });
        }
        if (candidates.length > 1) {
          const key = candidates.map((candidate) => `${candidate.kind}:${'id' in candidate ? candidate.id : ''}`).join('|');
          const previous = selectionCycleRef.current;
          const sameSpot = previous && Math.hypot(previous.x - event.clientX, previous.y - event.clientY) <= 6 && performance.now() - previous.at <= 900 && previous.key === key;
          const initialIndex = 'id' in target
            ? candidates.findIndex((candidate) => 'id' in candidate && candidate.kind === target.kind && candidate.id === target.id)
            : 0;
          const index = sameSpot || event.altKey ? ((previous?.index ?? -1) + 1) % candidates.length : Math.max(0, initialIndex);
          resolvedTarget = candidates[index];
          selectionCycleRef.current = { x: event.clientX, y: event.clientY, at: performance.now(), key, index };
          const rect = hostRef.current?.getBoundingClientRect();
          setCycleIndicator({ x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0), index: index + 1, total: candidates.length });
          if (cycleTimerRef.current !== null) window.clearTimeout(cycleTimerRef.current);
          cycleTimerRef.current = window.setTimeout(() => { setCycleIndicator(null); cycleTimerRef.current = null; }, 1100);
        } else selectionCycleRef.current = null;
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
  };

  const handleBackgroundPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget && (event.target as Element).closest('[data-structure-object]')) return;
    if (interactionRef.current.kind === 'pinch') return;
    if (shouldStartPan(event)) {
      event.preventDefault();
      startPan(event.pointerId, event.pointerType, { x: event.clientX, y: event.clientY }, false);
      return;
    }
    if (event.button !== 0) return;
    if (event.pointerType === 'touch') {
      if (activeTool === 'select' || activeTool === 'pan') {
        startPan(event.pointerId, event.pointerType, { x: event.clientX, y: event.clientY }, activeTool === 'select');
      } else startPending(event, { kind: 'background' });
      return;
    }
    if (activeTool === 'pointLoad' || activeTool === 'distributedLoad' || activeTool === 'moment') {
      startPending(event, { kind: 'background' });
      return;
    }
    if (activeTool === 'node') addNode(modelPointFromClient(event.clientX, event.clientY));
    else if (activeTool === 'member') createMemberEndpoint(modelPointFromClient(event.clientX, event.clientY));
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
    if (event.pointerType !== 'touch') return;
    // A fresh primary contact starts a new touch sequence. Some mobile engines
    // may omit one of the final pointer events after a pinch; discard any stale
    // bookkeeping so the next one-finger drag cannot be mistaken for a pinch.
    if (event.isPrimary && activePointersRef.current.size > 0) {
      clearLongPressTimer();
      if (interactionRef.current.kind === 'node-drag') cancelNodeDragTransaction();
      for (const pointerId of activePointersRef.current.keys()) releasePointer(pointerId);
      activePointersRef.current.clear();
      transitionInteraction(IDLE_INTERACTION);
    }
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointersRef.current.size !== 2) return;
    event.preventDefault();
    clearLongPressTimer();
    if (interactionRef.current.kind === 'node-drag') cancelNodeDragTransaction();
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

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const client = { x: event.clientX, y: event.clientY };
    updateCoordinateReadout(event.clientX, event.clientY, event.pointerType);
    if (event.pointerType === 'touch') activePointersRef.current.set(event.pointerId, client);
    const current = interactionRef.current;
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
    const current = interactionRef.current;
    if (current.kind === 'node-drag') {
      cancelNodeDragTransaction();
    }
    for (const pointerId of activePointersRef.current.keys()) releasePointer(pointerId);
    activePointersRef.current.clear();
    transitionInteraction(IDLE_INTERACTION);
  }, [cancelNodeDragTransaction, clearLongPressTimer, releasePointer, transitionInteraction]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const modalOpen = document.querySelector<HTMLElement>('[aria-modal="true"]');
      const interactive = target?.closest('input, select, textarea, button, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [role="tablist"]');
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
      if (command && key === 'c') {
        event.preventDefault();
        clipboardRef.current = copyModelSelection(project, selection);
        pasteCountRef.current = 1;
        return;
      }
      if (command && key === 'v') {
        if (!clipboardRef.current) return;
        event.preventDefault();
        const step = Math.max(project.settings.gridSize || 1, 0.25) * pasteCountRef.current;
        const next = structuredClone(project);
        const pasted = pasteModelClipboard(next, clipboardRef.current, { x: step, y: step });
        replaceProject(next);
        pasteCountRef.current += 1;
        setSelection(pasted);
        return;
      }
      if (command && key === 'd') {
        if (!selection || !['node', 'member', 'multi'].includes(selection.kind)) return;
        event.preventDefault();
        const step = Math.max(project.settings.gridSize || 1, 0.25);
        const next = structuredClone(project);
        const duplicated = duplicateModelSelection(next, selection, { x: step, y: step });
        replaceProject(next);
        setSelection(duplicated);
        return;
      }
      const shortcutTool = toolFromShortcut(key);
      if (shortcutTool && !command && !event.altKey) {
        event.preventDefault();
        setActiveTool(shortcutTool);
      }
      if (event.key === 'Escape') {
        cancelActiveInteraction();
        setMemberStart(null);
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
  }, [cancelActiveInteraction, deleteSelection, project, replaceProject, selection, setActiveTool, setSelection]);

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

  const memberValueAt = (memberId: string, ratio: number): DiagramPoint | null => {
    const result = resultMap.get(memberId);
    if (!result?.diagramSegments.length) return null;
    const grossLength = result.totalLength ?? result.length;
    const localX = clamp(ratio * grossLength - (result.startOffset ?? 0), 0, result.length);
    return evaluateDiagramAt(result.diagramSegments, result.diagramJumps, localX, 'right');
  };

  const showCut = (event: ReactPointerEvent, member: MemberModel) => {
    if (!resultsAllowed || !analysis?.success || cut?.pinned) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const model = toModel(event.clientX - rect.left, event.clientY - rect.top);
    const ni = nodeMap.get(member.i)!;
    const nj = nodeMap.get(member.j)!;
    const ratio = grossRatioAtPoint(memberAxis(member, ni, nj), model);
    setCut({ memberId: member.id, ratio, point: memberValueAt(member.id, ratio), clientX: event.clientX, clientY: event.clientY, pinned: false });
  };

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
    if (!project.settings.showGrid) return null;
    const step = project.settings.gridSize * camera.scale;
    if (step < 8) return null;
    const lines = [];
    const startX = ((camera.x % step) + step) % step;
    const startY = ((camera.y % step) + step) % step;
    for (let x = startX; x < size.width; x += step) lines.push(<line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={size.height} />);
    for (let y = startY; y < size.height; y += step) lines.push(<line key={`gy-${y}`} x1={0} y1={y} x2={size.width} y2={y} />);
    return <g className="grid-lines">{lines}</g>;
  }, [camera, project.settings.gridSize, project.settings.showGrid, size]);

  const handleLoadKeyDown = (event: ReactKeyboardEvent<SVGGElement>, target: Selection) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelection(target);
    onRequestInspector?.();
  };

  const onCutLeave = useCallback(() => setCut((current) => current?.pinned ? current : null), []);

  const smartLabelCandidates: SmartLabelCandidate[] = [];
  const selectedNodeIds = selectionVisualState.nodeIds;
  const selectedMemberIds = selectionVisualState.memberIds;

  for (const node of project.nodes) {
    const selected = selectedNodeIds.includes(node.id);
    if (!selected && !(layers.labels && layers.ids && project.settings.showNodeLabels)) continue;
    const anchor = toScreen(node.x, node.y);
    smartLabelCandidates.push({
      id: `node:${node.id}`,
      text: node.id,
      anchor,
      priority: selected ? 0 : 1,
      tone: selected ? 'selection' : 'neutral',
      preferredOffset: { x: -22, y: -22 },
      forceVisible: selected,
    });
  }

  for (const member of project.members) {
    const ni = nodeMap.get(member.i);
    const nj = nodeMap.get(member.j);
    if (!ni || !nj) continue;
    const a = toScreen(ni.x, ni.y);
    const b = toScreen(nj.x, nj.y);
    const anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const selected = selectedMemberIds.includes(member.id);
    if (selected || (layers.labels && layers.ids && project.settings.showMemberLabels)) {
      smartLabelCandidates.push({
        id: `member:${member.id}`,
        text: member.id,
        anchor,
        priority: selected ? 0 : 2,
        tone: selected ? 'selection' : 'neutral',
        preferredOffset: { x: 0, y: -21 },
        forceVisible: selected,
      });
    }
    const dimensionToolActive = activeTool === 'dimension';
    if (dimensionToolActive || (layers.labels && layers.dimensions && (project.settings.showLocalAxes || project.settings.showDimensions))) {
      smartLabelCandidates.push({
        id: `dimension:${member.id}`,
        text: `${formatFixed(toDisplay(Math.hypot(nj.x - ni.x, nj.y - ni.y), units, 'length'), 3)} ${lengthLabel}`,
        anchor,
        priority: dimensionToolActive ? 1 : 2,
        tone: 'dimension',
        preferredOffset: { x: 0, y: 24 },
        forceVisible: dimensionToolActive,
      });
    }
  }

  if (loadsLayerVisible && project.settings.showLoads && resultTab !== 'influence') {
    for (const load of project.nodalLoads) {
      const node = nodeMap.get(load.nodeId);
      if (!node) continue;
      const selected = selectionVisualState.nodalLoadId === load.id;
      if (!selected && !layers.labels) continue;
      const point = toScreen(node.x, node.y);
      const magnitude = Math.hypot(load.fx, load.fy);
      if (magnitude > 1e-9) {
        const ux = load.fx / magnitude;
        const uy = -load.fy / magnitude;
        smartLabelCandidates.push({
          id: `nodal-load:${load.id}`,
          text: `P = ${formatFixed(toDisplay(magnitude, units, 'force'), 2)} ${forceLabel}`,
          anchor: { x: point.x - ux * 62, y: point.y - uy * 62 - 5 },
          priority: selected ? 0 : 1,
          tone: selected ? 'selection' : 'force',
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      } else if (Math.abs(load.mz) > 1e-9) {
        smartLabelCandidates.push({
          id: `nodal-moment:${load.id}`,
          text: `M = ${formatFixed(toDisplay(load.mz, units, 'moment'), 2)} ${momentLabel}`,
          anchor: { x: point.x, y: point.y - 38 },
          priority: selected ? 0 : 1,
          tone: selected ? 'selection' : 'moment',
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      }
    }

    for (const load of project.memberLoads) {
      const member = memberMap.get(load.memberId);
      const ni = member ? nodeMap.get(member.i) : undefined;
      const nj = member ? nodeMap.get(member.j) : undefined;
      if (!member || !ni || !nj) continue;
      const axis = memberAxis(member, ni, nj);
      if (axis.length <= 1e-12) continue;
      const stationOf = (flexibleRatio: number) => {
        const point = pointAtGrossRatio(axis, grossRatioFromFlexible(axis, flexibleRatio));
        return toScreen(point.x, point.y);
      };
      const selected = selectionVisualState.memberLoadId === load.id;
      if (!selected && !layers.labels) continue;
      const priority = selected ? 0 as const : 1 as const;
      const tone = selected ? 'selection' as const : load.type === 'distributed' ? 'shear' as const : load.type === 'moment' ? 'moment' as const : 'force' as const;
      if (load.type === 'point') {
        const base = stationOf(load.position ?? 0.5);
        const px = load.px ?? 0;
        const py = load.py ?? 0;
        const magnitude = Math.hypot(px, py) || 1;
        const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, px, py);
        const ux = gx / magnitude;
        const uy = -gy / magnitude;
        smartLabelCandidates.push({
          id: `member-point-load:${load.id}`,
          text: `P = ${formatFixed(toDisplay(magnitude, units, 'force'), 2)} ${forceLabel}`,
          anchor: { x: base.x - ux * 60, y: base.y - uy * 60 - 5 },
          priority,
          tone,
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      } else if (load.type === 'moment') {
        const base = stationOf(load.position ?? 0.5);
        smartLabelCandidates.push({
          id: `member-moment:${load.id}`,
          text: `M = ${formatFixed(toDisplay(load.moment ?? 0, units, 'moment'), 2)} ${momentLabel}`,
          anchor: { x: base.x, y: base.y - 38 },
          priority,
          tone,
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      } else {
        const base = stationOf((load.start + load.end) / 2);
        // The label states the mean intensity of the span, not the value at its midpoint.
        const qx = ((load.qxStart ?? 0) + (load.qxEnd ?? load.qxStart ?? 0)) / 2;
        const qy = ((load.qyStart ?? 0) + (load.qyEnd ?? load.qyStart ?? 0)) / 2;
        const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, qx, qy);
        const magnitude = Math.hypot(gx, gy) || 1;
        const ux = gx / magnitude;
        const uy = -gy / magnitude;
        const maximum = Math.max(Math.abs(load.qyStart ?? 0), Math.abs(load.qyEnd ?? 0), Math.abs(load.qxStart ?? 0), Math.abs(load.qxEnd ?? 0), 1);
        const arrowLength = 33 + 12 * (magnitude / maximum);
        const startMagnitude = Math.hypot(load.qxStart ?? 0, load.qyStart ?? 0);
        const endMagnitude = Math.hypot(load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0);
        const average = (startMagnitude + endMagnitude) / 2;
        smartLabelCandidates.push({
          id: `distributed-load:${load.id}`,
          text: `w = ${formatFixed(toDisplay(average, units, 'distributedForce'), 2)} ${distributedLabel}`,
          anchor: { x: base.x - ux * (arrowLength + 9), y: base.y - uy * (arrowLength + 9) - 5 },
          priority,
          tone,
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      }
    }
  }

  if (layers.results && layers.labels && resultsAllowed && project.settings.showResultValues && analysis?.success) {
    for (const node of project.nodes) {
      const result = nodeResultMap.get(node.id);
      if (!result) continue;
      const point = toScreen(node.x, node.y);
      const { bottom: bottomClearance, side: sideClearance } = reactionClearanceFor(node.support.type);
      if (Math.abs(result.rx) > 1e-8) {
        const direction = Math.sign(result.rx);
        smartLabelCandidates.push({ id: `reaction:${node.id}:rx`, text: `Rx = ${formatFixed(toDisplay(result.rx, units, 'force'), 3)} ${forceLabel}`, anchor: { x: point.x - direction * (sideClearance + 24), y: point.y - 14 }, priority: 1, tone: 'axial', preferredOffset: { x: 0, y: 0 } });
      }
      if (Math.abs(result.ry) > 1e-8) {
        smartLabelCandidates.push({ id: `reaction:${node.id}:ry`, text: `Ry = ${formatFixed(toDisplay(result.ry, units, 'force'), 3)} ${forceLabel}`, anchor: { x: point.x + 18, y: point.y + bottomClearance + 24 }, priority: 1, tone: 'axial', preferredOffset: { x: 0, y: 0 } });
      }
      if (Math.abs(result.rm) > 1e-8) {
        smartLabelCandidates.push({ id: `reaction:${node.id}:rm`, text: `Mᵣ = ${formatFixed(toDisplay(result.rm, units, 'moment'), 3)} ${momentLabel}`, anchor: { x: point.x, y: point.y - 38 }, priority: 1, tone: 'moment', preferredOffset: { x: 0, y: 0 } });
      }
    }

    if (['axial', 'shear', 'moment'].includes(resultTab) && project.settings.showResultOverlay) {
      const quantity = resultTab as DiagramQuantity;
      const side = project.settings.diagramSide === 'negative' ? -1 : 1;
      for (const member of project.members) {
        const result = resultMap.get(member.id);
        const ni = nodeMap.get(member.i);
        const nj = nodeMap.get(member.j);
        if (!result || !ni || !nj) continue;
        const axis = memberAxis(member, ni, nj);
        const length = axis.length;
        if (length <= 1e-12) continue;
        const tx = axis.c;
        const ty = axis.s;
        const nx = axis.normal.x * side;
        const ny = axis.normal.y * side;
        const quantityUnit = quantity === 'moment' ? momentLabel : forceLabel;
        const displayQuantity = quantity === 'moment' ? 'moment' as const : 'force' as const;
        const points = result.criticalPoints
          .filter((point) => point.quantity === quantity && ['maximum', 'minimum', 'end', 'jump'].includes(point.kind))
          .filter((point, index, all) => all.findIndex((candidate) => Math.abs(candidate.x - point.x) <= Math.max(1, length) * 1e-7 && Math.abs(candidate.value - point.value) <= Math.max(1, Math.abs(point.value)) * 1e-7) === index)
          .sort((first, second) => {
            const rank = (kind: typeof first.kind) => kind === 'maximum' || kind === 'minimum' ? 0 : kind === 'jump' ? 1 : 2;
            return rank(first.kind) - rank(second.kind) || first.x - second.x;
          })
          .slice(0, size.width < 520 ? 2 : 6);
        for (const [index, point] of points.entries()) {
          const grossX = (result.startOffset ?? 0) + point.x;
          const baseX = ni.x + tx * grossX;
          const baseY = ni.y + ty * grossX;
          const offsetModel = point.value * diagramPixelScaleFor(project, resultTab, globalDiagramMax, result) / camera.scale;
          const anchor = toScreen(baseX + nx * offsetModel, baseY + ny * offsetModel);
          const outward = point.value * side >= 0 ? 1 : -1;
          smartLabelCandidates.push({
            id: `result:${member.id}:${quantity}:${point.kind}:${index}`,
            text: `${quantity === 'axial' ? 'N' : quantity === 'shear' ? 'V' : 'M'} = ${formatFixed(toDisplay(point.value, units, displayQuantity), 2)} ${quantityUnit}`,
            anchor,
            priority: point.kind === 'maximum' || point.kind === 'minimum' ? 2 : 3,
            forceVisible: point.kind === 'maximum' || point.kind === 'minimum',
            tone: quantity,
            preferredOffset: { x: nx * outward * 28, y: -ny * outward * 28 - 6 },
          });
        }
      }
    }
  }

  const placedSmartLabels = layoutSmartLabels(smartLabelCandidates, canvasSafeRect(size), camera.scale);
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

  return (
    <div className="canvas-host" ref={hostRef}>
      <svg
        ref={svgRef}
        className={`structural-canvas tool-${activeTool} interaction-${interaction.kind} ${spacePressed ? 'space-pan-ready' : ''}`}
        data-interaction={interaction.kind}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="application"
        aria-label={t('canvas.workspace')}
        aria-describedby="canvas-interaction-description"
        aria-keyshortcuts="V H N M S P D O C X B Delete Backspace Escape"
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

        <CanvasResultLayer
          slot="diagrams"
          project={project}
          analysis={analysis}
          resultTab={resultTab}
          resultsAllowed={resultsAllowed}
          resultCursor={resultCursor}
          influenceCanvasState={influenceCanvasState}
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
          showResults={layers.results}
          showDiagnostics={layers.diagnostics}
          size={size}
          t={t}
          oscillationFactor={oscillationFactor}
        />

        <CanvasGeometryLayer
          slot="members"
          project={project}
          nodeMap={nodeMap}
          memberMap={memberMap}
          toScreen={toScreen}
          camera={camera}
          selectionVisualState={selectionVisualState}
          learningFocus={learningFocus}
          memberStartId={memberStart}
          layers={layers}
          loadsLayerVisible={loadsLayerVisible}
          resultTab={resultTab}
          units={units}
          forceLabel={forceLabel}
          momentLabel={momentLabel}
          distributedLabel={distributedLabel}
          t={t}
          heatmapRatios={heatmapRatios}
          onObjectPointerDown={handleObjectPointerDown}
          onSelect={setSelection}
          onLoadKeyDown={handleLoadKeyDown}
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
          showResults={layers.results}
          showDiagnostics={layers.diagnostics}
          size={size}
          t={t}
          oscillationFactor={oscillationFactor}
        />

        <CanvasGeometryLayer
          slot="objects"
          project={project}
          nodeMap={nodeMap}
          memberMap={memberMap}
          toScreen={toScreen}
          camera={camera}
          selectionVisualState={selectionVisualState}
          learningFocus={learningFocus}
          memberStartId={memberStart}
          layers={layers}
          loadsLayerVisible={loadsLayerVisible}
          resultTab={resultTab}
          units={units}
          forceLabel={forceLabel}
          momentLabel={momentLabel}
          distributedLabel={distributedLabel}
          t={t}
          onObjectPointerDown={handleObjectPointerDown}
          onSelect={setSelection}
          onLoadKeyDown={handleLoadKeyDown}
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

        <g className="smart-label-layer" data-label-detail={smartLabelDetailForScale(camera.scale)} aria-hidden="true">
          {placedSmartLabels.map((label) => {
            const centerX = label.rect.x + label.rect.width / 2;
            const centerY = label.rect.y + label.rect.height / 2;
            return <g key={label.id} className={`smart-label priority-${label.priority} tone-${label.tone ?? 'neutral'}`} data-smart-label={label.id} data-label-priority={label.priority}>
              {label.leader ? <line className="smart-label-leader" x1={label.anchor.x} y1={label.anchor.y} x2={centerX} y2={centerY} /> : null}
              <rect x={label.rect.x} y={label.rect.y} width={label.rect.width} height={label.rect.height} rx="6" />
              <text x={label.rect.x + 8} y={label.rect.y + 15}>{label.text}</text>
            </g>;
          })}
        </g>

        <g className="global-axes" transform={`translate(42 ${size.height - 45})`}>
          <line x1="0" y1="0" x2="58" y2="0" markerEnd="url(#axis-x)" />
          <line x1="0" y1="0" x2="0" y2="-58" markerEnd="url(#axis-y)" />
          <defs>
            <marker id="axis-x" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="var(--moment)" /></marker>
            <marker id="axis-y" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="var(--shear)" /></marker>
          </defs>
          <text x="65" y="5" className="axis-x-label">X</text><text x="-5" y="-66" className="axis-y-label">Y</text>
        </g>
      </svg>

      <CanvasChrome
        modeLabel={t(toolLabelKeys[activeTool])}
        placementInstruction={loadPlacementInstruction}
        showHelp={layers.help}
        layers={layers}
        dispatchLayers={dispatchLayers}
        snapEnabled={project.settings.snap}
        gridEnabled={project.settings.showGrid}
        coordinateReadoutRef={coordinateReadoutRef}
        lengthLabel={lengthLabel}
        scale={camera.scale}
        hasAnalysis={Boolean(analysis?.success)}
        isDeformedTab={resultTab === 'deformed'}
        oscillating={oscillating}
        onToggleOscillation={() => setOscillating((prev) => !prev)}
        onCancelPlacement={() => setActiveTool('select')}
        onZoomIn={() => updateCamera(zoomCameraAt(cameraRef.current, { x: size.width / 2, y: size.height / 2 }, 1.15))}
        onZoomOut={() => updateCamera(zoomCameraAt(cameraRef.current, { x: size.width / 2, y: size.height / 2 }, 1 / 1.15))}
        onFit={fitModel}
      />
      {canvasFeedback ? <div className="canvas-feedback" role="alert">{canvasFeedback}</div> : null}
      {layers.results && layers.labels && resultsAllowed && analysis?.success && ['axial', 'shear', 'moment'].includes(resultTab) ? <div className={`canvas-result-legend ${resultTab}`} aria-label={t('canvas.diagramConvention')} data-canvas-chrome="result-legend"><strong>{resultTab === 'axial' ? `N · ${t('results.axial')}` : resultTab === 'shear' ? `V · ${t('results.shear')}` : `M · ${t('results.moment')}`}</strong><span><i /> {t('canvas.exactCurveScale', { scale: t(project.settings.diagramScaleMode === 'individual' ? 'canvas.scaleByMember' : 'canvas.scaleCommon') })}</span><small>{t('canvas.diagramSideDescription', { side: project.settings.diagramSide === 'positive' ? '+y' : '−y' })}</small></div> : null}
      {memberStart ? <div className="canvas-hint" role="status"><span>{t('canvas.touchDestinationNode')}</span><button type="button" onClick={() => setMemberStart(null)} aria-label={t('canvas.cancelMemberCreation')}><X size={14} /></button></div> : null}
      {activeTool === 'node' || (activeTool === 'member' && memberStart) ? <form className="quick-entry-bar" aria-label={t('canvas.cadEntry')} onSubmit={(event) => { event.preventDefault(); submitQuickEntry(); }}><div className="quick-entry-heading"><strong>{t(activeTool === 'node' ? 'canvas.nodeByCoordinates' : 'canvas.memberEndpoint')}</strong>{activeTool === 'member' ? <div className="quick-entry-mode"><button type="button" aria-pressed={quickEntryMode === 'delta'} onClick={() => setQuickEntryMode('delta')}>ΔX · ΔY</button><button type="button" aria-pressed={quickEntryMode === 'polar'} onClick={() => setQuickEntryMode('polar')}>L · ∠</button></div> : null}</div><label><span>{activeTool === 'node' ? 'X' : quickEntryMode === 'delta' ? 'ΔX' : 'L'}</span><input type="number" inputMode="decimal" step="any" value={quickEntry.first} onChange={(event) => setQuickEntry((current) => ({ ...current, first: event.target.value }))} /><small>{lengthLabel}</small></label><label><span>{activeTool === 'node' ? 'Y' : quickEntryMode === 'delta' ? 'ΔY' : '∠'}</span><input type="number" inputMode="decimal" step="any" value={quickEntry.second} onChange={(event) => setQuickEntry((current) => ({ ...current, second: event.target.value }))} /><small>{activeTool === 'member' && quickEntryMode === 'polar' ? '°' : lengthLabel}</small></label><button type="submit">{t(activeTool === 'node' ? 'canvas.createNode' : 'canvas.createMember')}</button>{quickEntryError ? <span className="quick-entry-error" role="alert">{quickEntryError}</span> : null}</form> : null}
      {cycleIndicator ? <div className="selection-cycle-indicator" style={{ left: cycleIndicator.x + 12, top: cycleIndicator.y + 12 }} role="status">{t('canvas.selectionCycle', { index: cycleIndicator.index, total: cycleIndicator.total })}</div> : null}
      {cut?.point ? (
        <div className="cut-tooltip" style={{ left: clamp(cut.clientX - (hostRef.current?.getBoundingClientRect().left ?? 0) + 14, 10, Math.max(10, size.width - 350)), top: clamp(cut.clientY - (hostRef.current?.getBoundingClientRect().top ?? 0) + 14, 10, Math.max(10, size.height - 390)) }}>
          <div className="cut-title-row">
            <strong>{t('canvas.cutTitle', { member: cut.memberId })}</strong>
            {(() => {
              const member = memberMap.get(cut.memberId);
              if (!member || member.type === 'rigid') return null;
              const area = member.A > 0 ? member.A : 0.005;
              const inertia = member.I > 0 ? member.I : 0.00008;
              const depth = Math.sqrt((12 * inertia) / area) || 0.3;
              const Wel = inertia / (depth / 2) || 0.0005;
              const sigmaAxial = (Math.abs(cut.point.axial) / area) / 1000;
              const sigmaBending = Wel > 0 ? (Math.abs(cut.point.moment) / Wel) / 1000 : 0;
              const sigmaTotal = sigmaAxial + sigmaBending;
              const ratio = sigmaTotal / 250;
              const pct = Math.round(ratio * 100);
              const tone = ratio > 1.0 ? 'overstressed' : ratio > 0.85 ? 'warning' : 'ok';
              return (
                <span className="member-narrative-badge" data-tone={tone}>
                  η = {pct}%
                </span>
              );
            })()}
            <span>{t(cut.pinned ? 'canvas.pinned' : 'canvas.preview')}</span>
          </div>
          <span>x = {formatFixed(toDisplay(cut.point.x, units, 'length'), 3)} {lengthLabel} <small>({formatFixed(cut.ratio * 100, 1)}%)</small></span>
          <div className="cut-values">
            <span className="axial-text">N = {formatFixed(toDisplay(cut.point.axial, units, 'force'), 3)} {forceLabel}</span>
            <span className="shear-text">V = {formatFixed(toDisplay(cut.point.shear, units, 'force'), 3)} {forceLabel}</span>
            <span className="moment-text">M = {formatFixed(toDisplay(cut.point.moment, units, 'moment'), 3)} {momentLabel}</span>
          </div>
          {cutEquilibrium ? (
            <div className="cut-equilibrium">
              <b>{t('canvas.leftSideFbd')}</b>
              <svg className="cut-fbd" viewBox="0 0 280 82" role="img" aria-label={t('canvas.fbdAria', { member: cut.memberId, x: formatFixed(cut.point.x, 3) })}>
                <line className="cut-fbd-member" x1="24" y1="43" x2="232" y2="43" />
                <line className="cut-fbd-section" x1="232" y1="17" x2="232" y2="68" />
                <line className="cut-fbd-axis" x1="24" y1="70" x2="65" y2="70" />
                <line className="cut-fbd-axis" x1="24" y1="70" x2="24" y2="54" />
                <text x="68" y="74">+x</text><text x="8" y="55">+y</text>
                <text x="20" y="35">N₀, V₀, M₀</text>
                <text x="238" y="29" className="axial-text">N</text>
                <text x="238" y="45" className="shear-text">V</text>
                <text x="238" y="61" className="moment-text">M</text>
                {cutEquilibrium.resultants.filter((load) => load.kind !== 'moment').map((load, index) => {
                  const px = 24 + (cutEquilibrium.x > 1e-12 ? Math.max(0, Math.min(1, load.sourceX / cutEquilibrium.x)) : 0) * 198;
                  return <g key={`${load.kind}-${load.sourceX}-${index}`} className="cut-fbd-load"><line x1={px} y1="12" x2={px} y2="38" /><path d={`M ${px - 4} 33 L ${px} 40 L ${px + 4} 33 Z`} /><text x={px} y="10" textAnchor="middle">{load.kind === 'distributed' ? 'Rᵥ' : 'P'}</text></g>;
                })}
                <text x="140" y="80" textAnchor="middle">x = {formatFixed(toDisplay(cutEquilibrium.x, units, 'length'), 3)} {lengthLabel}</text>
              </svg>
              {cutEquilibrium.resultants.length ? <div className="cut-resultants"><small>{t('canvas.externalResultants')}</small>{cutEquilibrium.resultants.map((load, index) => <span key={`${load.kind}-${load.sourceX}-${index}`}><b>{t(load.kind === 'distributed' ? 'canvas.distributedKind' : load.kind === 'point' ? 'canvas.pointKind' : 'canvas.momentKind')}</b> x={formatFixed(toDisplay(load.sourceX, units, 'length'), 3)} {lengthLabel} · Fx={formatFixed(toDisplay(load.forceX, units, 'force'), 3)} {forceLabel} · Fy={formatFixed(toDisplay(load.forceY, units, 'force'), 3)} {forceLabel}{Math.abs(load.appliedMoment) > 1e-12 ? ` · M=${formatFixed(toDisplay(load.appliedMoment, units, 'moment'), 3)} ${momentLabel}` : ''}</span>)}</div> : <small className="cut-no-loads">{t('canvas.noExternalLoads')}</small>}
              {cutEquilibrium.symbolicEquations.map((equation) => <code key={equation}>{equation}</code>)}
              <div className="cut-substitution">
                <code>ΣFₓ = {formatFixed(toDisplay(-cutEquilibrium.start.axial, units, 'force'), 3)} + {formatFixed(toDisplay(cutEquilibrium.totals.forceX, units, 'force'), 3)} + {formatFixed(toDisplay(cut.point.axial, units, 'force'), 3)} = {formatScientific(toDisplay(cutEquilibrium.residuals.forceX, units, 'force'), 1)} {forceLabel}</code>
                <code>ΣFᵧ = {formatFixed(toDisplay(cutEquilibrium.start.shear, units, 'force'), 3)} + {formatFixed(toDisplay(cutEquilibrium.totals.forceY, units, 'force'), 3)} − {formatFixed(toDisplay(cut.point.shear, units, 'force'), 3)} = {formatScientific(toDisplay(cutEquilibrium.residuals.forceY, units, 'force'), 1)} {forceLabel}</code>
                <code>ΣM = {formatFixed(toDisplay(-cutEquilibrium.start.moment, units, 'moment'), 3)} − ({formatFixed(toDisplay(cutEquilibrium.start.shear, units, 'force'), 3)})({formatFixed(toDisplay(cutEquilibrium.x, units, 'length'), 3)}) + {formatFixed(toDisplay(cutEquilibrium.totals.momentAboutCut, units, 'moment'), 3)} + {formatFixed(toDisplay(cut.point.moment, units, 'moment'), 3)} = {formatScientific(toDisplay(cutEquilibrium.residuals.moment, units, 'moment'), 1)} {momentLabel}</code>
              </div>
              <div className="cut-residuals">
                <span>rₓ = {formatScientific(toDisplay(cutEquilibrium.residuals.forceX, units, 'force'), 1)} {forceLabel}</span>
                <span>rᵧ = {formatScientific(toDisplay(cutEquilibrium.residuals.forceY, units, 'force'), 1)} {forceLabel}</span>
                <span>rₘ = {formatScientific(toDisplay(cutEquilibrium.residuals.moment, units, 'moment'), 1)} {momentLabel}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
