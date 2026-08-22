import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Repeat2 } from 'lucide-react';

interface RepeatActionOverlayProps {
  active: boolean;
  previewLabel: string;
  instruction: string;
  cancelLabel: string;
  onCancel: () => void;
}

/**
 * Vista previa de "repetir" en curso. Activar la repetición ya no tiene un
 * chip flotante propio: es la acción primaria de `ContextualActions` cuando
 * hay un patrón repetible (`preferredPrimary` en `ContextualActions.tsx`) —
 * una superficie flotante menos en el pie del lienzo.
 */
export const RepeatActionOverlay = ({
  active, previewLabel, instruction, cancelLabel, onCancel,
}: RepeatActionOverlayProps) => {
  const reducedMotion = useReducedMotion();

  return <AnimatePresence initial={false}>
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
      <span className="repeat-preview__icon" aria-hidden="true"><Repeat2 size={16} strokeWidth={2.3} /></span>
      <div className="repeat-preview__copy">
        <strong>{previewLabel}</strong>
        <span>{instruction}</span>
      </div>
      <button type="button" onClick={onCancel}>{cancelLabel}</button>
    </m.section> : null}
  </AnimatePresence>;
};
