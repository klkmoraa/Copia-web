import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { StructuralEditDraft } from './structuralEditUi';
import type { Camera, CanvasInteractionState as CanvasInteraction } from './canvasVocabulary';

export interface UseCanvasInteractionLoopArgs {
  interactionRef: RefObject<CanvasInteraction>;
  setInteractionState: Dispatch<SetStateAction<CanvasInteraction>>;
  cameraRef: RefObject<Camera>;
  setCamera: Dispatch<SetStateAction<Camera>>;
  cameraFrameRef: RefObject<number | null>;
  interactionFrameRef: RefObject<number | null>;
  nodeMoveFrameRef: RefObject<number | null>;
  pendingNodeMoveRef: RefObject<{ nodeId: string; point: { x: number; y: number } } | null>;
  structuralEditFrameRef: RefObject<number | null>;
  pendingStructuralEditDraftRef: RefObject<StructuralEditDraft | null>;
  structuralEditLiveDraftRef: RefObject<StructuralEditDraft | null>;
  setStructuralEditDraft: Dispatch<SetStateAction<StructuralEditDraft | null>>;
  setStructuralEditLiveDraft: Dispatch<SetStateAction<StructuralEditDraft | null>>;
  feedbackTimerRef: RefObject<number | null>;
  setCanvasFeedback: Dispatch<SetStateAction<string>>;
  longPressTimerRef: RefObject<number | null>;
  longPressMotionRef: RefObject<{ pointerId: number; start: { x: number; y: number }; current: { x: number; y: number } } | null>;
  moveNodeTransient: (nodeId: string, point: { x: number; y: number }) => void;
  cancelProjectTransaction: () => void;
}

/**
 * Batching por `requestAnimationFrame` de la cámara, el drag de nodo y el
 * draft de edición estructural en vivo, más la retroalimentación temporal
 * del canvas y el temporizador del long-press. Ninguno de estos gestos
 * necesita repintar más de una vez por frame, así que cada `schedule*`
 * colapsa las actualizaciones intermedias y sólo la última llega a React.
 *
 * Las refs las crea y posee `StructuralCanvas.tsx` (las necesitan también
 * los gestos de puntero, aún sin extraer); este hook sólo las consume, para
 * que ninguna quede duplicada entre módulos.
 */
export const useCanvasInteractionLoop = ({
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
}: UseCanvasInteractionLoopArgs) => {
  const transitionInteraction = useCallback((next: CanvasInteraction) => {
    interactionRef.current = next;
    setInteractionState(next);
  }, [interactionRef, setInteractionState]);

  const updateCamera = useCallback((next: Camera | ((current: Camera) => Camera)) => {
    const resolved = typeof next === 'function' ? next(cameraRef.current) : next;
    cameraRef.current = resolved;
    if (cameraFrameRef.current !== null) return;
    cameraFrameRef.current = window.requestAnimationFrame(() => {
      cameraFrameRef.current = null;
      setCamera(cameraRef.current);
    });
  }, [cameraFrameRef, cameraRef, setCamera]);

  const scheduleInteractionFrame = useCallback((next: CanvasInteraction) => {
    interactionRef.current = next;
    if (interactionFrameRef.current !== null) return;
    interactionFrameRef.current = window.requestAnimationFrame(() => {
      interactionFrameRef.current = null;
      setInteractionState(interactionRef.current);
    });
  }, [interactionFrameRef, interactionRef, setInteractionState]);

  const flushNodeMove = useCallback(() => {
    if (nodeMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(nodeMoveFrameRef.current);
      nodeMoveFrameRef.current = null;
    }
    const pending = pendingNodeMoveRef.current;
    pendingNodeMoveRef.current = null;
    if (pending) moveNodeTransient(pending.nodeId, pending.point);
  }, [moveNodeTransient, nodeMoveFrameRef, pendingNodeMoveRef]);

  const scheduleNodeMove = useCallback((nodeId: string, point: { x: number; y: number }) => {
    pendingNodeMoveRef.current = { nodeId, point };
    if (nodeMoveFrameRef.current !== null) return;
    nodeMoveFrameRef.current = window.requestAnimationFrame(() => {
      nodeMoveFrameRef.current = null;
      const pending = pendingNodeMoveRef.current;
      pendingNodeMoveRef.current = null;
      if (pending) moveNodeTransient(pending.nodeId, pending.point);
    });
  }, [moveNodeTransient, nodeMoveFrameRef, pendingNodeMoveRef]);

  const flushStructuralEditDraft = useCallback(() => {
    if (structuralEditFrameRef.current !== null) {
      window.cancelAnimationFrame(structuralEditFrameRef.current);
      structuralEditFrameRef.current = null;
    }
    const pending = pendingStructuralEditDraftRef.current ?? structuralEditLiveDraftRef.current;
    pendingStructuralEditDraftRef.current = null;
    structuralEditLiveDraftRef.current = null;
    if (pending) setStructuralEditDraft(pending);
    setStructuralEditLiveDraft(null);
  }, [pendingStructuralEditDraftRef, setStructuralEditDraft, setStructuralEditLiveDraft, structuralEditFrameRef, structuralEditLiveDraftRef]);

  const scheduleStructuralEditDraft = useCallback((draft: StructuralEditDraft) => {
    pendingStructuralEditDraftRef.current = draft;
    if (structuralEditFrameRef.current !== null) return;
    structuralEditFrameRef.current = window.requestAnimationFrame(() => {
      structuralEditFrameRef.current = null;
      const pending = pendingStructuralEditDraftRef.current;
      pendingStructuralEditDraftRef.current = null;
      if (pending) {
        structuralEditLiveDraftRef.current = pending;
        setStructuralEditLiveDraft(pending);
      }
    });
  }, [pendingStructuralEditDraftRef, setStructuralEditLiveDraft, structuralEditFrameRef, structuralEditLiveDraftRef]);

  const cancelNodeDragTransaction = useCallback(() => {
    pendingNodeMoveRef.current = null;
    if (nodeMoveFrameRef.current !== null) window.cancelAnimationFrame(nodeMoveFrameRef.current);
    if (structuralEditFrameRef.current !== null) window.cancelAnimationFrame(structuralEditFrameRef.current);
    nodeMoveFrameRef.current = null;
    structuralEditFrameRef.current = null;
    pendingStructuralEditDraftRef.current = null;
    structuralEditLiveDraftRef.current = null;
    setStructuralEditLiveDraft(null);
    cancelProjectTransaction();
  }, [cancelProjectTransaction, nodeMoveFrameRef, pendingNodeMoveRef, pendingStructuralEditDraftRef, setStructuralEditLiveDraft, structuralEditFrameRef, structuralEditLiveDraftRef]);

  const showCanvasFeedback = useCallback((message: string) => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    setCanvasFeedback(message);
    feedbackTimerRef.current = window.setTimeout(() => {
      setCanvasFeedback('');
      feedbackTimerRef.current = null;
    }, 2400);
  }, [feedbackTimerRef, setCanvasFeedback]);

  useEffect(() => () => {
    if (cameraFrameRef.current !== null) window.cancelAnimationFrame(cameraFrameRef.current);
    if (interactionFrameRef.current !== null) window.cancelAnimationFrame(interactionFrameRef.current);
    if (nodeMoveFrameRef.current !== null) window.cancelAnimationFrame(nodeMoveFrameRef.current);
    if (structuralEditFrameRef.current !== null) window.cancelAnimationFrame(structuralEditFrameRef.current);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    cameraFrameRef.current = null;
    interactionFrameRef.current = null;
    nodeMoveFrameRef.current = null;
    structuralEditFrameRef.current = null;
    pendingStructuralEditDraftRef.current = null;
    structuralEditLiveDraftRef.current = null;
    feedbackTimerRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressMotionRef.current = null;
  }, [longPressMotionRef, longPressTimerRef]);

  return {
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
  };
};
