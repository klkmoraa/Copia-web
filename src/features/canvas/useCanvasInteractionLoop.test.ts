// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_INTERACTION, type CanvasInteractionState } from './canvasVocabulary';
import type { StructuralEditDraft } from './structuralEditUi';
import { useCanvasInteractionLoop } from './useCanvasInteractionLoop';

afterEach(cleanup);

const flushFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve));

const setup = (overrides: {
  moveNodeTransient?: (nodeId: string, point: { x: number; y: number }) => void;
  cancelProjectTransaction?: () => void;
} = {}) => {
  const moveNodeTransient = overrides.moveNodeTransient ?? vi.fn<(nodeId: string, point: { x: number; y: number }) => void>();
  const cancelProjectTransaction = overrides.cancelProjectTransaction ?? vi.fn<() => void>();
  const hook = renderHook(() => {
    const interactionRef = useRef<CanvasInteractionState>(IDLE_INTERACTION);
    const [interaction, setInteractionState] = useState<CanvasInteractionState>(IDLE_INTERACTION);
    const cameraRef = useRef({ scale: 85, x: 0, y: 0 });
    const [camera, setCamera] = useState(cameraRef.current);
    const cameraFrameRef = useRef<number | null>(null);
    const interactionFrameRef = useRef<number | null>(null);
    const nodeMoveFrameRef = useRef<number | null>(null);
    const pendingNodeMoveRef = useRef<{ nodeId: string; point: { x: number; y: number } } | null>(null);
    const structuralEditFrameRef = useRef<number | null>(null);
    const pendingStructuralEditDraftRef = useRef<StructuralEditDraft | null>(null);
    const structuralEditLiveDraftRef = useRef<StructuralEditDraft | null>(null);
    const [structuralEditDraft, setStructuralEditDraft] = useState<StructuralEditDraft | null>(null);
    const [structuralEditLiveDraft, setStructuralEditLiveDraft] = useState<StructuralEditDraft | null>(null);
    const feedbackTimerRef = useRef<number | null>(null);
    const [canvasFeedback, setCanvasFeedback] = useState('');
    const longPressTimerRef = useRef<number | null>(null);
    const longPressMotionRef = useRef<{ pointerId: number; start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
    const loop = useCanvasInteractionLoop({
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
    return { loop, interaction, camera, structuralEditDraft, structuralEditLiveDraft, canvasFeedback };
  });
  return { hook, moveNodeTransient, cancelProjectTransaction };
};

describe('useCanvasInteractionLoop', () => {
  it('transitionInteraction actualiza el estado de inmediato', () => {
    const { hook } = setup();
    act(() => { hook.result.current.loop.transitionInteraction({ kind: 'pan' } as CanvasInteractionState); });
    expect(hook.result.current.interaction).toEqual({ kind: 'pan' });
  });

  it('updateCamera colapsa varias llamadas en un solo frame', async () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.loop.updateCamera((current) => ({ ...current, x: current.x + 10 }));
      hook.result.current.loop.updateCamera((current) => ({ ...current, x: current.x + 10 }));
    });
    await act(async () => { await flushFrame(); });
    expect(hook.result.current.camera.x).toBe(20);
  });

  it('scheduleNodeMove aplaza moveNodeTransient hasta el frame y sólo aplica el último punto', async () => {
    const { hook, moveNodeTransient } = setup();
    act(() => {
      hook.result.current.loop.scheduleNodeMove('N1', { x: 1, y: 1 });
      hook.result.current.loop.scheduleNodeMove('N1', { x: 2, y: 2 });
    });
    expect(moveNodeTransient).not.toHaveBeenCalled();
    await act(async () => { await flushFrame(); });
    expect(moveNodeTransient).toHaveBeenCalledTimes(1);
    expect(moveNodeTransient).toHaveBeenCalledWith('N1', { x: 2, y: 2 });
  });

  it('cancelNodeDragTransaction limpia el draft en vivo y delega en cancelProjectTransaction', () => {
    const { hook, cancelProjectTransaction } = setup();
    act(() => { hook.result.current.loop.cancelNodeDragTransaction(); });
    expect(cancelProjectTransaction).toHaveBeenCalledTimes(1);
    expect(hook.result.current.structuralEditLiveDraft).toBeNull();
  });

  it('showCanvasFeedback limpia el mensaje después de su temporizador', async () => {
    vi.useFakeTimers();
    try {
      const { hook } = setup();
      act(() => { hook.result.current.loop.showCanvasFeedback('listo'); });
      expect(hook.result.current.canvasFeedback).toBe('listo');
      act(() => { vi.advanceTimersByTime(2400); });
      expect(hook.result.current.canvasFeedback).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
