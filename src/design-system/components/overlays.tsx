import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useModalFocus } from './modalFocus';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement<{ 'aria-describedby'?: string }>;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const Tooltip = ({ content, children, placement = 'top', className = '' }: TooltipProps) => {
  const id = useId();
  const existingDescription = children.props['aria-describedby'];
  const trigger = cloneElement(children, {
    'aria-describedby': [existingDescription, id].filter(Boolean).join(' '),
  });

  return <span className={`sc-tooltip sc-tooltip--${placement}${className ? ` ${className}` : ''}`}>
    {trigger}
    <span id={id} role="tooltip" className="sc-tooltip__content">{content}</span>
  </span>;
};

export interface PopoverProps {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
  className?: string;
}

export const Popover = ({
  label,
  trigger,
  children,
  open,
  onOpenChange,
  align = 'start',
  disabled = false,
  className = '',
}: PopoverProps) => {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChange(false);
      const trigger = triggerRef.current;
      trigger?.focus({ preventScroll: true });
      window.requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  return <div ref={rootRef} className={`sc-popover sc-popover--${align}${className ? ` ${className}` : ''}`}>
    <button
      ref={triggerRef}
      type="button"
      className="sc-popover__trigger"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      disabled={disabled}
      onClick={() => onOpenChange(!open)}
    >{trigger}</button>
    <AnimatePresence>
      {open ? (
        <m.section
          key={id}
          id={id}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.96 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="sc-popover__surface"
          role="dialog"
          aria-label={label}
        >
          {children}
        </m.section>
      ) : null}
    </AnimatePresence>
  </div>;
};

export type ModalSurfaceExtent = 'default' | 'peek';

interface ModalSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  kind: 'dialog' | 'drawer' | 'fullscreen';
  side?: 'left' | 'right' | 'bottom';
  className?: string;
  /** Explicit launcher used when another surface transfers focus during lazy loading. */
  returnFocusTo?: HTMLElement | null;
  /** The broker owns focus return for retained workspace surfaces. */
  restoreFocus?: boolean;
  surfaceId?: string;
  onSurfaceReady?: (ready: boolean) => void;
  /**
   * `peek` shrinks a `drawer`/`fullscreen` surface to a handle without
   * unmounting it: scroll, drafts and list position stay exactly where they
   * were. Only `drawer`/`fullscreen` accept it — the broker enforces that.
   */
  extent?: ModalSurfaceExtent;
  /** Restores a `peek`ed surface to `default`. Required when `extent` is passed. */
  onRestore?: () => void;
  /** Accessible label for the peek handle, e.g. "Restore Datasheet". */
  restoreLabel?: string;
}

const ModalSurface = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel = 'Close',
  kind,
  side = 'right',
  className = '',
  returnFocusTo,
  restoreFocus = true,
  surfaceId,
  onSurfaceReady,
  extent = 'default',
  onRestore,
  restoreLabel,
}: ModalSurfaceProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const surfaceRef = useRef<HTMLElement>(null);
  const peeked = extent === 'peek';
  useModalFocus({
    open,
    containerRef: surfaceRef,
    onEscape: () => onOpenChange(false),
    restoreFocus,
    returnFocusTo,
    trapFocus: !peeked,
  });
  useLayoutEffect(() => {
    if (!open) return undefined;
    onSurfaceReady?.(true);
    return () => onSurfaceReady?.(false);
  }, [onSurfaceReady, open]);
  const reducedMotion = useReducedMotion();

  if (typeof document === 'undefined') return null;

  const isDrawer = kind === 'drawer';
  const drawerAxis: Record<NonNullable<ModalSurfaceProps['side']>, { hidden: Record<string, string>; visible: Record<string, number> }> = {
    right: { hidden: { x: '100%' }, visible: { x: 0 } },
    left: { hidden: { x: '-100%' }, visible: { x: 0 } },
    bottom: { hidden: { y: '100%' }, visible: { y: 0 } },
  };
  const surfaceMotionProps = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } }
    : isDrawer
      ? {
        initial: drawerAxis[side].hidden,
        animate: drawerAxis[side].visible,
        exit: drawerAxis[side].hidden,
        transition: { type: 'spring' as const, stiffness: 380, damping: 32 },
      }
      : {
        initial: { opacity: 0, scale: 0.94, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.94, y: 8 },
        transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
      };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 0.2 }}
          className={`sc-overlay sc-overlay--${kind}${peeked ? ' sc-overlay--peek' : ''}`}
          data-ui-overlay={kind}
          data-surface-presentation={kind === 'dialog' ? 'overlay' : kind}
          onMouseDown={(event) => {
            if (peeked || event.target !== event.currentTarget) return;
            onOpenChange(false);
          }}
        >
          <m.section
            ref={surfaceRef}
            {...surfaceMotionProps}
            className={`sc-modal-surface sc-modal-surface--${kind}${kind === 'drawer' ? ` sc-modal-surface--${side}` : ''}${peeked ? ' sc-modal-surface--peek' : ''}${className ? ` ${className}` : ''}`}
            data-level={kind === 'drawer' ? 'sheet' : 'modal'}
            data-workspace-surface={surfaceId}
            data-surface-extent={extent}
            role="dialog"
            aria-modal={peeked ? undefined : true}
            aria-label={peeked ? title : undefined}
            aria-labelledby={peeked ? undefined : titleId}
            aria-describedby={peeked || !description ? undefined : descriptionId}
            tabIndex={-1}
          >
            {peeked ? (
              <button
                type="button"
                className="sc-modal-surface__peek-handle"
                aria-label={restoreLabel ? `${restoreLabel}: ${title}` : title}
                onClick={() => onRestore?.()}
              >
                <Maximize2 size={16} aria-hidden="true" />
                <span>{title}</span>
              </button>
            ) : (
              <header className="sc-modal-surface__header">
                <div>
                  <h2 id={titleId}>{title}</h2>
                  {description ? <p id={descriptionId}>{description}</p> : null}
                </div>
                <button type="button" className="sc-modal-surface__close" aria-label={closeLabel} onClick={() => onOpenChange(false)}><X size={18} /></button>
              </header>
            )}
            <div className="sc-modal-surface__body" inert={peeked} aria-hidden={peeked || undefined}>{children}</div>
            {footer ? <footer className="sc-modal-surface__footer">{footer}</footer> : null}
          </m.section>
        </m.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};

export interface DialogProps extends Omit<ModalSurfaceProps, 'kind' | 'side'> {}

export const Dialog = (props: DialogProps) => <ModalSurface {...props} kind="dialog" />;

export interface DrawerProps extends Omit<ModalSurfaceProps, 'kind'> {
  side?: 'left' | 'right' | 'bottom';
  presentation?: 'drawer' | 'fullscreen';
}

export const Drawer = ({ presentation = 'drawer', ...props }: DrawerProps) => <ModalSurface {...props} kind={presentation} />;
