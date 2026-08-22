import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Repeat2 } from 'lucide-react';

interface RepeatActionOverlayProps {
  available: boolean;
  active: boolean;
  actionLabel: string;
  previewLabel: string;
  instruction: string;
  cancelLabel: string;
  onActivate: () => void;
  onCancel: () => void;
}

/** Presentational repeat affordance; StructuralCanvas keeps the placement recipe. */
export const RepeatActionOverlay = ({
  available, active, actionLabel, previewLabel, instruction, cancelLabel, onActivate, onCancel,
}: RepeatActionOverlayProps) => {
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 };
  const initial = reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 };
  const exit = reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 };

  return <AnimatePresence initial={false}>
    {available ? <m.button
      type="button"
      className="repeat-action-control"
      data-repeat-affordance={active ? 'active' : 'available'}
      aria-keyshortcuts="R"
      initial={initial}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={exit}
      transition={transition}
      onClick={onActivate}
    >
      <span className="repeat-action-control__icon" aria-hidden="true"><Repeat2 size={16} strokeWidth={2.25} /></span>
      <span className="repeat-action-control__copy">{actionLabel}</span>
      <kbd aria-hidden="true">R</kbd>
    </m.button> : null}
    {active ? <m.section
      className="repeat-preview"
      data-repeat-affordance="active"
      role="status"
      aria-label={previewLabel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reducedMotion ? { duration: 0.01 } : { duration: 0.16 }}
    >
      <span className="repeat-preview__icon" aria-hidden="true"><Repeat2 size={17} strokeWidth={2.3} /></span>
      <div className="repeat-preview__copy">
        <strong>{previewLabel}</strong>
        <span>{instruction}</span>
      </div>
      <button type="button" onClick={onCancel}>{cancelLabel}</button>
    </m.section> : null}
  </AnimatePresence>;
};
