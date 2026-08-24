// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { Selection } from '../../types';
import { IDLE_INTERACTION, type CanvasInteractionState, type CutInfo } from './canvasVocabulary';
import type { StructuralEditDraft } from './structuralEditUi';
import { useCanvasPointerGestures } from './useCanvasPointerGestures';

afterEach(cleanup);

const camera = { scale: 85, x: 260, y: 500 };
const t = (key: string) => key;

/**
 * Sólo se prueba aquí el comportamiento aislable sin simular un DOM real de
 * eventos de puntero (captura, pinch, drag): esos flujos ya están cubiertos
 * por los 26 tests de montaje de StructuralCanvas y por `npm run qa` en
 * navegador real, que es donde el timing de puntero real importa.
 */
const setup = () => {
  const project = createDefaultProject();
  const setActiveTool = vi.fn();
  const setSelection = vi.fn();
  const setMemberStart = vi.fn();
  const setGeneratorOpen = vi.fn();
  const setGeneratorGhost = vi.fn();
  const setGeneratorOrigin = vi.fn();
  const setGeneratorPickedOrigin = vi.fn();
  const setCut = vi.fn();
  const setSnapPreview = vi.fn();
  const setTouchLoupe = vi.fn();
  const setStructuralEditDraft = vi.fn();
  const setStructuralEditLiveDraft = vi.fn();
  const setStructuralEditPointerArmed = vi.fn();
  const setStructuralEditCommitError = vi.fn();
  const transitionInteraction = vi.fn();
  const scheduleInteractionFrame = vi.fn();
  const scheduleNodeMove = vi.fn();
  const flushNodeMove = vi.fn();
  const scheduleStructuralEditDraft = vi.fn();
  const flushStructuralEditDraft = vi.fn();
  const cancelNodeDragTransaction = vi.fn();
  const updateCamera = vi.fn();
  const updateCoordinateReadout = vi.fn();
  const localScreenPoint = vi.fn((clientX: number, clientY: number) => ({ x: clientX, y: clientY }));
  const snapPoint = vi.fn((point: { x: number; y: number }) => point);
  const modelPointFromClient = vi.fn(() => ({ x: 0, y: 0 }));
  const nodeDragPointFromClient = vi.fn(() => ({ x: 0, y: 0 }));
  const addNode = vi.fn(() => 'N-new');
  const createMemberEndpoint = vi.fn(async () => undefined);
  const openCandidatePicker = vi.fn(() => false);
  const selectStructuralTarget = vi.fn();
  const candidateTargetsAtPoint = vi.fn(() => []);
  const performTargetAction = vi.fn();
  const finishSelectionBox = vi.fn();
  const beginProjectTransaction = vi.fn();
  const commitProjectTransaction = vi.fn();
  const clearLongPressTimer = vi.fn();

  const hook = renderHook(() => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const cameraRef = useRef(camera);
    const interactionRef = useRef<CanvasInteractionState>(IDLE_INTERACTION);
    const activePointersRef = useRef(new Map());
    const spacePressedRef = useRef(false);
    const longPressTimerRef = useRef<number | null>(null);
    const longPressMotionRef = useRef(null);
    const generatorOriginPickingRef = useRef(false);
    const generatorPickTokenRef = useRef(0);
    const pendingStructuralEditDraftRef = useRef<StructuralEditDraft | null>(null);
    const structuralEditFrameRef = useRef<number | null>(null);
    const structuralEditLiveDraftRef = useRef<StructuralEditDraft | null>(null);
    const [activeTool, setActiveToolState] = useState<'select' | 'pan'>('select');
    const [, setGeneratorOriginPicking] = useState(false);

    const gestures = useCanvasPointerGestures({
      project,
      activeTool,
      setActiveTool: (tool) => { setActiveToolState(tool as 'select' | 'pan'); setActiveTool(tool); },
      setSelection,
      setMemberStart,
      units: project.settings.units,
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
      candidatePicker: null,
      setGeneratorOpen,
      setGeneratorGhost,
      setGeneratorOrigin,
      setGeneratorOriginPicking,
      setGeneratorPickedOrigin,
      setCut: setCut as React.Dispatch<React.SetStateAction<CutInfo | null>>,
      setSnapPreview,
      setTouchLoupe,
      structuralEditDraft: null,
      structuralEditPointerArmed: false,
      structuralEditExcludedNodeIds: new Set<string>(),
      setStructuralEditDraft,
      setStructuralEditLiveDraft,
      setStructuralEditPointerArmed,
      setStructuralEditCommitError,
      selectionFilter: { nodes: true, members: true, loads: true },
      nodeMap: new Map(project.nodes.map((node) => [node.id, node])),
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
      t,
    });

    return { gestures, activeTool, interactionRef, generatorOriginPickingRef };
  });

  return { hook, transitionInteraction, cancelNodeDragTransaction, setStructuralEditDraft, setSelection: setSelection as (next: Selection) => void };
};

describe('useCanvasPointerGestures', () => {
  it('shouldStartPan reconoce el botón central del mouse', () => {
    const { hook } = setup();
    const event = { button: 1 } as unknown as Parameters<typeof hook.result.current.gestures.shouldStartPan>[0];
    expect(hook.result.current.gestures.shouldStartPan(event)).toBe(true);
  });

  it('shouldStartPan con botón izquierdo depende de la herramienta activa, no del espacio (que vive fuera del hook)', () => {
    const { hook } = setup();
    const leftClick = { button: 0 } as unknown as Parameters<typeof hook.result.current.gestures.shouldStartPan>[0];
    expect(hook.result.current.gestures.shouldStartPan(leftClick)).toBe(false);
  });

  it('capturePointer y releasePointer no lanzan cuando el SVG aún no está montado', () => {
    const { hook } = setup();
    expect(() => hook.result.current.gestures.capturePointer(1)).not.toThrow();
    expect(() => hook.result.current.gestures.releasePointer(1)).not.toThrow();
  });

  it('toggleGeneratorOriginPick alterna el estado y su ref en el mismo paso', () => {
    const { hook } = setup();
    expect(hook.result.current.generatorOriginPickingRef.current).toBe(false);
    act(() => { hook.result.current.gestures.toggleGeneratorOriginPick(); });
    expect(hook.result.current.generatorOriginPickingRef.current).toBe(true);
    act(() => { hook.result.current.gestures.toggleGeneratorOriginPick(); });
    expect(hook.result.current.generatorOriginPickingRef.current).toBe(false);
  });

  it('cancelActiveInteraction vuelve la interacción a idle', () => {
    const { hook, transitionInteraction } = setup();
    act(() => { hook.result.current.gestures.cancelActiveInteraction(); });
    expect(transitionInteraction).toHaveBeenCalledWith(IDLE_INTERACTION);
  });
});
