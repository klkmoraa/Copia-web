import { useEffect, useRef, type RefObject } from 'react';

export interface ModalFocusOptions<T extends HTMLElement> {
  open: boolean;
  containerRef: RefObject<T | null>;
  onEscape: () => void;
  initialFocus?: (container: T) => HTMLElement | null;
  lockBodyScroll?: boolean;
}

const focusableSelector = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (container: HTMLElement | null) => [
  ...(container?.querySelectorAll<HTMLElement>(focusableSelector) ?? []),
].filter((element) => !element.closest('[hidden], [aria-hidden="true"], [inert]'));

export const useModalFocus = <T extends HTMLElement>({
  open,
  containerRef,
  onEscape,
  initialFocus,
  lockBodyScroll = true,
}: ModalFocusOptions<T>) => {
  const onEscapeRef = useRef(onEscape);
  const initialFocusRef = useRef(initialFocus);
  onEscapeRef.current = onEscape;
  initialFocusRef.current = initialFocus;

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (lockBodyScroll) document.body.style.overflow = 'hidden';

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
      if (lockBodyScroll) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) window.requestAnimationFrame(() => previousFocus.focus());
    };
  }, [containerRef, lockBodyScroll, open]);
};
