import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/**
 * WorkspaceShell publica el alto del visual viewport (consciente del teclado
 * virtual) como `--sc-visual-viewport-height` en el shell. Leerlo aquí evita
 * un segundo listener de resize y mantiene los detents correctos cuando el
 * teclado está abierto — mismo truco que `ResultsPanel.getViewportHeightPx`.
 */
export const getViewportHeightPx = (referenceElement: HTMLElement | null): number => {
  if (typeof window === 'undefined') return 0;
  if (referenceElement) {
    const raw = window.getComputedStyle(referenceElement).getPropertyValue('--sc-visual-viewport-height');
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return window.innerHeight;
};

const RUBBER_BAND_RESISTANCE = 0.42;
const VELOCITY_DISMISS_PX_MS = 0.55;
const VELOCITY_EXPAND_PX_MS = 0.55;
const CLOSE_THRESHOLD_RATIO = 0.6;

export interface SheetResizeDragOptions {
  panelRef: RefObject<HTMLElement | null>;
  /** Alturas ascendentes en px (p.ej. [compacto, medio, grande]), recalculadas en cada gesto. */
  getDetents: () => number[];
  /** Snap a `getDetents()[index]`. */
  onSettle: (index: number) => void;
  /** Arrastre rápido hacia abajo, o por debajo del detent más pequeño. */
  onDismiss: () => void;
  disabled?: boolean;
}

/**
 * Arrastre de hoja con detents (Inspector móvil): sigue el dedo 1:1 escribiendo
 * `--sheet-drag-height` directamente en el DOM (sin `setState` por frame), con
 * resistencia elástica más allá del detent mayor o por debajo del menor. Al
 * soltar decide por velocidad (un gesto rápido cierra o expande aunque no haya
 * cruzado el umbral de posición) o, si el gesto fue lento, por la distancia al
 * detent más cercano.
 */
export const useSheetResizeDrag = ({ panelRef, getDetents, onSettle, onDismiss, disabled }: SheetResizeDragOptions) => {
  const dragRef = useRef<{ startY: number; startHeight: number; lastY: number; lastT: number; velocity: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const applyHeight = (px: number) => {
    pendingRef.current = px;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (pendingRef.current !== null) panelRef.current?.style.setProperty('--sheet-drag-height', `${pendingRef.current}px`);
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled) return;
    const panel = panelRef.current;
    if (!panel) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, startHeight: panel.getBoundingClientRect().height, lastY: event.clientY, lastT: event.timeStamp, velocity: 0 };
    panel.setAttribute('data-sheet-dragging', 'true');
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const detents = getDetents();
    const min = detents[0] ?? drag.startHeight;
    const max = detents[detents.length - 1] ?? drag.startHeight;
    let next = drag.startHeight + (drag.startY - event.clientY);
    if (next > max) next = max + (next - max) * RUBBER_BAND_RESISTANCE;
    else if (next < min) next = min - (min - next) * RUBBER_BAND_RESISTANCE;
    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    applyHeight(Math.max(0, next));
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    dragRef.current = null;
    if (!drag || !panel) return;
    if (frameRef.current !== null) { window.cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    panel.removeAttribute('data-sheet-dragging');
    panel.style.removeProperty('--sheet-drag-height');
    const detents = getDetents();
    const min = detents[0] ?? drag.startHeight;
    if (drag.velocity > VELOCITY_DISMISS_PX_MS) { onDismiss(); return; }
    if (drag.velocity < -VELOCITY_EXPAND_PX_MS) { onSettle(detents.length - 1); return; }
    const finalHeight = Math.max(0, drag.startHeight + (drag.startY - drag.lastY));
    if (finalHeight < min * CLOSE_THRESHOLD_RATIO) { onDismiss(); return; }
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    detents.forEach((detent, index) => {
      const distance = Math.abs(detent - finalHeight);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    onSettle(nearestIndex);
  };

  return { onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag };
};

export interface SheetDismissDragOptions {
  panelRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  disabled?: boolean;
}

const DISMISS_DISTANCE_PX = 96;
const DISMISS_VELOCITY_PX_MS = 0.55;
const OVERDRAG_RESISTANCE = 0.35;

/**
 * Arrastre de hoja de un solo tamaño (paleta móvil de herramientas): sólo se
 * puede empujar hacia abajo (traslación, no redimensiona), con resistencia
 * elástica si se tira hacia arriba. Soltar por debajo del umbral de distancia
 * o con un gesto rápido descarta; en cualquier otro caso vuelve a su sitio
 * (la vuelta la anima el `transition` de `transform` en CSS, no este hook).
 */
export const useSheetDismissDrag = ({ panelRef, onDismiss, disabled }: SheetDismissDragOptions) => {
  const dragRef = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const applyOffset = (px: number) => {
    pendingRef.current = px;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (pendingRef.current !== null) panelRef.current?.style.setProperty('--sheet-drag-offset', `${pendingRef.current}px`);
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled) return;
    const panel = panelRef.current;
    if (!panel) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, lastY: event.clientY, lastT: event.timeStamp, velocity: 0 };
    panel.setAttribute('data-sheet-dragging', 'true');
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    let delta = event.clientY - drag.startY;
    if (delta < 0) delta *= OVERDRAG_RESISTANCE;
    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    applyOffset(Math.max(0, delta));
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    dragRef.current = null;
    if (!drag || !panel) return;
    if (frameRef.current !== null) { window.cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    panel.removeAttribute('data-sheet-dragging');
    panel.style.removeProperty('--sheet-drag-offset');
    const distance = Math.max(0, drag.lastY - drag.startY);
    if (drag.velocity > DISMISS_VELOCITY_PX_MS || distance > DISMISS_DISTANCE_PX) onDismiss();
  };

  return { onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag };
};
