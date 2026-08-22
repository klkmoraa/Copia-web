import { useEffect, useRef, type RefObject } from 'react';

export interface ModalFocusOptions<T extends HTMLElement> {
  open: boolean;
  containerRef: RefObject<T | null>;
  onEscape: () => void;
  initialFocus?: (container: T) => HTMLElement | null;
  lockBodyScroll?: boolean;
  restoreFocus?: boolean;
  returnFocusTo?: HTMLElement | null;
  /**
   * Whether the surface currently traps Tab and claims initial focus. A `peek`
   * surface stays `open` — mounted, scrolled, drafted exactly as it was — but
   * stops being a focus trap: the body-scroll lock and the close-time focus
   * restoration (both keyed on `open`) must survive the toggle untouched, or
   * degrading to `peek` would yank focus back the moment it leaves.
   */
  trapFocus?: boolean;
}

const focusableSelector = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (container: HTMLElement | null) => [
  ...(container?.querySelectorAll<HTMLElement>(focusableSelector) ?? []),
].filter((element) => {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const closedDetails = element.closest('details:not([open])');
  if (closedDetails && element.tagName !== 'SUMMARY') return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
});

export const useModalFocus = <T extends HTMLElement>({
  open,
  containerRef,
  onEscape,
  initialFocus,
  lockBodyScroll = true,
  restoreFocus = true,
  returnFocusTo,
  trapFocus = true,
}: ModalFocusOptions<T>) => {
  const onEscapeRef = useRef(onEscape);
  const initialFocusRef = useRef(initialFocus);
  onEscapeRef.current = onEscape;
  initialFocusRef.current = initialFocus;

  // Body-scroll lock and close-time focus restoration key only on `open`, so
  // toggling `trapFocus` (entering/leaving `peek`) never re-runs them.
  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (lockBodyScroll) document.body.style.overflow = 'hidden';

    return () => {
      if (lockBodyScroll) document.body.style.overflow = previousOverflow;
      if (!restoreFocus) return;
      const returnTarget = returnFocusTo?.isConnected ? returnFocusTo : previousFocus;
      if (returnTarget?.isConnected) window.requestAnimationFrame(() => returnTarget.focus({ preventScroll: true }));
    };
  }, [lockBodyScroll, open, restoreFocus, returnFocusTo]);

  // Initial focus + Tab trap + Escape key on `open && trapFocus`. A `peek`
  // surface turns this off without touching the effect above: focus is free
  // to leave for the canvas, and Tab no longer loops inside a shrunk surface.
  useEffect(() => {
    if (!open || !trapFocus) return undefined;

    const focusHandle = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      (initialFocusRef.current?.(container) ?? getFocusable(container)[0] ?? container).focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const container = containerRef.current;
      const focusable = getFocusable(container);
      if (!focusable.length) {
        event.preventDefault();
        container?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !container?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !container?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusHandle);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, open, trapFocus]);
};
