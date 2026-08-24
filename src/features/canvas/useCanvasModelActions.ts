import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { AnalysisResult, MemberModel, NodeModel, ProjectModel, Selection, Tool, UnitSystemId } from '../../types';
import type { ProjectCommand, ProjectCommandResult } from '../../commands/projectCommand';
import { fromDisplay } from '../../engine/units';
import {
  copyModelSelection,
  ensureNodeAtPoint,
  pasteModelClipboard,
  toggleStructuralSelection,
  type ModelClipboard,
} from '../../data/modelOperations';
import { resolveSnap, type SnapCandidate, type SnapKind } from '../../utils/snapping';
import { screenToModelPoint, type ModelPoint, type ScreenPoint } from './canvasInteraction';
import { clamp, type Camera, type Size } from './canvasVocabulary';
import type { CanvasViewSettings } from '../view/canvasViewSettings';
import { parseQuickEntryPair } from './quickEntry';
import { resolveRepeatRecipe, type RepeatRecipe } from './repeatAction';
import {
  decodeStructuralClipboard,
  encodeStructuralClipboard,
  readClipboardText,
} from './structuralClipboard';
import type { StructuralTarget } from './CanvasGeometryLayer';
import {
  activeCandidate,
  candidateToSelection,
  createCandidatePickerState,
  type CandidatePickerState,
  type CandidateTarget,
} from './candidatePicker';
import { toolLabelKeys } from './canvasVocabulary';
import type { SurfacePresentationContextValue } from '../workspace/SurfacePresentationContext';
import type { TranslationKey } from '../../i18n/catalogs';

export interface UseCanvasModelActionsArgs {
  project: ProjectModel;
  selection: Selection;
  setSelection: (next: Selection) => void;
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  executeProjectCommand: (command: ProjectCommand) => Promise<ProjectCommandResult | undefined>;
  updateProject: (updater: (project: ProjectModel) => ProjectModel, analyzeAfter?: boolean) => void;
  replaceProject: (next: ProjectModel, restoredAnalysis?: AnalysisResult, repositoryRevision?: number) => void;
  nodeMap: ReadonlyMap<string, NodeModel>;
  memberStart: string | null;
  setMemberStart: Dispatch<SetStateAction<string | null>>;
  repeatRecipe: RepeatRecipe | null;
  setRepeatRecipe: Dispatch<SetStateAction<RepeatRecipe | null>>;
  quickEntry: { first: string; second: string };
  setQuickEntry: Dispatch<SetStateAction<{ first: string; second: string }>>;
  quickEntryMode: 'delta' | 'polar';
  setQuickEntryError: Dispatch<SetStateAction<string>>;
  units: UnitSystemId;
  view: CanvasViewSettings;
  camera: Camera;
  cameraRef: RefObject<Camera>;
  size: Size;
  drawingOrigin: NodeModel | null;
  baseSnapCandidates: SnapCandidate[];
  perpendicularSnapCandidates: SnapCandidate[];
  setSnapPreview: Dispatch<SetStateAction<{ x: number; y: number; kind: SnapKind } | null>>;
  localScreenPoint: (clientX: number, clientY: number) => ScreenPoint;
  selectionFilter: CanvasViewSettings['selectionFilter'];
  clipboardRef: RefObject<ModelClipboard | null>;
  pasteCountRef: RefObject<number>;
  refreshClipboardAvailability: Dispatch<SetStateAction<number>>;
  setDuplicateDraft: Dispatch<SetStateAction<{ selection: Selection; x: string; y: string } | null>>;
  showCanvasFeedback: (message: string) => void;
  svgRef: RefObject<SVGSVGElement | null>;
  candidatePicker: CandidatePickerState | null;
  setCandidatePicker: Dispatch<SetStateAction<CandidatePickerState | null>>;
  surfaceBroker: SurfacePresentationContextValue | null;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

/**
 * CRUD de modelo y utilidades de puntero que no capturan un gesto en vivo:
 * crear/borrar nodo o miembro, portapapeles, duplicar, snapping, selección
 * por hit-testing y el selector de candidatos superpuestos. Deja fuera a
 * propósito `capturePointer`/`startPan` y todo lo que gestione
 * `setPointerCapture`: eso pertenece a los gestos de puntero, aún sin
 * extraer, que consumen estas acciones ya resueltas.
 */
export const useCanvasModelActions = ({
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
}: UseCanvasModelActionsArgs) => {
  const snapPoint = useCallback((point: { x: number; y: number }, excludedNodeIds?: string | ReadonlySet<string>) => {
    // Reuse the memoised arrays untouched whenever nothing has to be merged or
    // excluded: a pointer move should not copy the whole candidate list.
    const merged = perpendicularSnapCandidates.length
      ? [...baseSnapCandidates, ...perpendicularSnapCandidates]
      : baseSnapCandidates;
    const excluded = typeof excludedNodeIds === 'string' ? new Set([excludedNodeIds]) : excludedNodeIds;
    const candidates = excluded?.size
      ? merged.filter((candidate) => !(candidate.kind === 'node' && candidate.sourceIds?.some((id) => excluded.has(id))))
      : merged;
    const result = resolveSnap(point, {
      enabled: view.snap,
      gridSize: view.gridSize,
      pixelsPerUnit: camera.scale,
      candidates,
      modes: {
        grid: view.snapTargets.grid,
        node: view.snapTargets.nodes,
        midpoint: view.snapTargets.midpoints,
        intersection: view.snapTargets.intersections,
        perpendicular: Boolean(drawingOrigin) && view.snapTargets.perpendicular,
      },
    });
    const nextPreview = result.kind === 'none' ? null : { ...result.point, kind: result.kind };
    setSnapPreview((current) => current?.kind === nextPreview?.kind && current?.x === nextPreview?.x && current?.y === nextPreview?.y ? current : nextPreview);
    return result.point;
  }, [baseSnapCandidates, camera.scale, drawingOrigin, perpendicularSnapCandidates, setSnapPreview, view]);

  const modelPointFromClient = useCallback((clientX: number, clientY: number, excludedNodeIds?: string | ReadonlySet<string>) => {
    const local = localScreenPoint(clientX, clientY);
    return snapPoint(screenToModelPoint(local, cameraRef.current), excludedNodeIds);
  }, [cameraRef, localScreenPoint, snapPoint]);

  const nodeDragPointFromClient = useCallback((
    clientX: number,
    clientY: number,
    excludedNodeId: string,
    grabOffset: ModelPoint,
  ) => {
    const local = localScreenPoint(clientX, clientY);
    const pointerPoint = screenToModelPoint(local, cameraRef.current);
    return snapPoint({ x: pointerPoint.x + grabOffset.x, y: pointerPoint.y + grabOffset.y }, excludedNodeId);
  }, [cameraRef, localScreenPoint, snapPoint]);

  const deleteSelection = useCallback((target: Selection = selection) => {
    if (!target) return;
    if (target.kind === 'member') void executeProjectCommand({ kind: 'member.delete', description: `Eliminar miembro ${target.id}`, memberId: target.id });
    else if (target.kind === 'node') void executeProjectCommand({ kind: 'node.delete', description: 'Editar proyecto', nodeId: target.id });
    else if (target.kind === 'multi') void executeProjectCommand({ kind: 'selection.delete', description: 'Editar proyecto', selection: target });
    else if (target.kind === 'nodalLoad') updateProject((draft) => ({ ...draft, nodalLoads: draft.nodalLoads.filter((load) => load.id !== target.id) }));
    else updateProject((draft) => ({ ...draft, memberLoads: draft.memberLoads.filter((load) => load.id !== target.id) }));
    setSelection(null);
  }, [executeProjectCommand, selection, setSelection, updateProject]);

  const addNode = useCallback((point: { x: number; y: number }) => {
    let id = '';
    updateProject((draft) => {
      id = ensureNodeAtPoint(draft, point).nodeId;
      return draft;
    });
    if (id) setSelection({ kind: 'node', id });
    if (activeTool === 'node') setRepeatRecipe(null);
    return id;
  }, [activeTool, setRepeatRecipe, setSelection, updateProject]);

  const createMemberEndpoint = useCallback(async (point: { x: number; y: number }) => {
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
    let memberId = '';
    const template = repeatRecipe?.kind === 'member'
      ? repeatRecipe.template
      : { type: 'frame' as const, materialOrigin: 'custom' as const, sectionOrigin: 'custom' as const, E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 };
    const result = await executeProjectCommand({
      kind: 'member.createAtPoint',
      description: 'Crear miembro',
      startNodeId: memberStart,
      point,
      template,
    });
    if (result?.kind === 'member.createAtPoint') memberId = result.memberId;
    setMemberStart(null);
    if (memberId) setSelection({ kind: 'member', id: memberId });
    setQuickEntry({ first: '', second: '' });
    setQuickEntryError('');
    setRepeatRecipe(null);
  }, [addNode, executeProjectCommand, memberStart, nodeMap, repeatRecipe, setMemberStart, setQuickEntry, setQuickEntryError, setRepeatRecipe, setSelection, t]);

  const submitQuickEntry = useCallback(() => {
    const parsed = parseQuickEntryPair(quickEntry.first, quickEntry.second);
    if (!parsed.ok) {
      setQuickEntryError(t('canvas.twoValidNumbers'));
      return;
    }
    const { first, second } = parsed.value;
    if (activeTool === 'node') {
      addNode({ x: fromDisplay(first, units, 'length'), y: fromDisplay(second, units, 'length') });
      setQuickEntry({ first: '', second: '' });
      setQuickEntryError('');
      return;
    }
    const startNode = memberStart ? nodeMap.get(memberStart) : null;
    if (!startNode) return;
    if (quickEntryMode === 'delta') {
      void createMemberEndpoint({ x: startNode.x + fromDisplay(first, units, 'length'), y: startNode.y + fromDisplay(second, units, 'length') });
    } else {
      const length = fromDisplay(first, units, 'length');
      const radians = second * Math.PI / 180;
      void createMemberEndpoint({ x: startNode.x + length * Math.cos(radians), y: startNode.y + length * Math.sin(radians) });
    }
  }, [activeTool, addNode, createMemberEndpoint, memberStart, nodeMap, quickEntry.first, quickEntry.second, quickEntryMode, setQuickEntry, setQuickEntryError, t, units]);

  const cancelQuickEntry = useCallback(() => {
    setQuickEntry({ first: '', second: '' });
    setQuickEntryError('');
    if (activeTool === 'member') setMemberStart(null);
  }, [activeTool, setMemberStart, setQuickEntry, setQuickEntryError]);

  const activateRepeat = useCallback(() => {
    const recipe = resolveRepeatRecipe(project, selection);
    if (!recipe) return;
    setRepeatRecipe(recipe);
    setMemberStart(null);
    setActiveTool(recipe.tool);
    showCanvasFeedback(t('canvas.repeatWaiting', { tool: t(toolLabelKeys[recipe.tool]) }));
    window.requestAnimationFrame(() => svgRef.current?.focus({ preventScroll: true }));
  }, [project, selection, setActiveTool, setMemberStart, setRepeatRecipe, showCanvasFeedback, svgRef, t]);

  const copyStructuralSelection = useCallback(async () => {
    const copied = copyModelSelection(project, selection);
    if (!copied) return;
    clipboardRef.current = copied;
    pasteCountRef.current = 1;
    refreshClipboardAvailability((revision) => revision + 1);
    const browserClipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (typeof browserClipboard?.writeText === 'function') {
      try {
        await browserClipboard.writeText(encodeStructuralClipboard(copied));
      } catch {
        // The existing in-app clipboard remains a valid touch fallback.
      }
    }
    showCanvasFeedback(t('contextualActions.copyReady'));
  }, [clipboardRef, pasteCountRef, project, refreshClipboardAvailability, selection, showCanvasFeedback, t]);

  const pasteStructuralSelection = useCallback(async () => {
    const read = await readClipboardText();
    const systemClipboard = read.status === 'read' ? decodeStructuralClipboard(read.text) : null;
    const clipboard = systemClipboard ?? clipboardRef.current;
    if (!clipboard) {
      showCanvasFeedback(t('contextualActions.pasteUnavailable'));
      return;
    }
    clipboardRef.current = clipboard;
    const step = Math.max(project.settings.gridSize || 1, 0.25) * pasteCountRef.current;
    const next = structuredClone(project);
    const pasted = pasteModelClipboard(next, clipboard, { x: step, y: step });
    replaceProject(next);
    pasteCountRef.current += 1;
    setSelection(pasted);
    showCanvasFeedback(systemClipboard
      ? t('contextualActions.pasteReady')
      : t('contextualActions.pasteFallback'));
  }, [clipboardRef, pasteCountRef, project, replaceProject, setSelection, showCanvasFeedback, t]);

  const startDuplicate = useCallback(() => {
    if (!selection || !['node', 'member', 'multi'].includes(selection.kind)) return;
    const step = Math.max(project.settings.gridSize || 1, 0.25);
    setDuplicateDraft({ selection: structuredClone(selection), x: String(step), y: String(step) });
  }, [project.settings.gridSize, selection, setDuplicateDraft]);

  const selectStructuralTarget = useCallback((target: StructuralTarget) => {
    if (target.kind === 'background') setSelection(null);
    else setSelection({ kind: target.kind, id: target.id });
  }, [setSelection]);

  const candidateTargetsAtPoint = useCallback((
    clientX: number,
    clientY: number,
    fallback: StructuralTarget,
  ): CandidateTarget[] => {
    const candidates: CandidateTarget[] = [];
    const seen = new Set<string>();
    const elements = document.elementsFromPoint?.(clientX, clientY) ?? [];
    const append = (kind: string | undefined, id: string | undefined) => {
      if (!id || !kind || !['node', 'member', 'nodalLoad', 'memberLoad'].includes(kind)) return;
      if (kind === 'node' && !selectionFilter.nodes) return;
      if (kind === 'member' && !selectionFilter.members) return;
      if ((kind === 'nodalLoad' || kind === 'memberLoad') && !selectionFilter.loads) return;
      const key = `${kind}:${id}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ kind: kind as CandidateTarget['kind'], id });
    };
    for (const element of elements) {
      const object = element.closest<SVGElement>('[data-structure-kind][data-structure-id]');
      append(object?.dataset.structureKind, object?.dataset.structureId);
    }
    if (fallback.kind !== 'background') append(fallback.kind, fallback.id);
    // SVG hit-testing does not consistently report a member exactly at one of
    // its endpoint nodes. The model already owns that exact incidence through
    // IDs, so complete the node stack from topology rather than tolerances or
    // coordinate comparisons. A shared node can therefore offer its node,
    // attached members, and its nodal loads as one precise candidate set.
    if (fallback.kind === 'node') {
      for (const member of project.members as MemberModel[]) {
        if (member.i === fallback.id || member.j === fallback.id) append('member', member.id);
      }
      for (const load of project.nodalLoads) {
        if (load.nodeId === fallback.id) append('nodalLoad', load.id);
      }
    }
    return candidates;
  }, [project.members, project.nodalLoads, selectionFilter.loads, selectionFilter.members, selectionFilter.nodes]);

  const closeCandidatePicker = useCallback(() => {
    setCandidatePicker(null);
    surfaceBroker?.closeSurface('candidatePicker');
    window.requestAnimationFrame(() => svgRef.current?.focus({ preventScroll: true }));
  }, [setCandidatePicker, surfaceBroker, svgRef]);

  const openCandidatePicker = useCallback((candidates: CandidateTarget[], anchor: ScreenPoint, additive = false): boolean => {
    const picker = createCandidatePickerState(candidates, selection, {
      x: clamp(anchor.x + 12, 8, Math.max(8, size.width - 260)),
      y: clamp(anchor.y + 12, 8, Math.max(8, size.height - 260)),
    }, 0, additive);
    if (!picker) return false;
    setCandidatePicker(picker);
    surfaceBroker?.openSurface('candidatePicker');
    return true;
  }, [selection, setCandidatePicker, size.height, size.width, surfaceBroker]);

  const confirmCandidatePicker = useCallback(() => {
    if (!candidatePicker) return;
    const candidate = activeCandidate(candidatePicker);
    if (candidatePicker.additive && (candidate.kind === 'node' || candidate.kind === 'member')) {
      setSelection(toggleStructuralSelection(candidatePicker.previousSelection, { kind: candidate.kind, id: candidate.id }));
    } else {
      setSelection(candidateToSelection(candidate));
    }
    closeCandidatePicker();
  }, [candidatePicker, closeCandidatePicker, setSelection]);

  const setCandidatePickerIndex = useCallback((index: number) => {
    setCandidatePicker((current) => {
      if (!current) return null;
      const activeIndex = clamp(index, 0, current.candidates.length - 1);
      return activeIndex === current.activeIndex ? current : { ...current, activeIndex };
    });
  }, [setCandidatePicker]);

  return {
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
  };
};
