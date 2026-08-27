import { useRef, useState } from 'react';
import type { Selection } from '../../types';
import type { ShellClass } from '../workspace/shellComposition';
import type { SurfacePresentation } from '../workspace/surfacePresentation';
import {
  resolveContextualActionModel,
  type ContextualActionAvailability,
  type ContextualActionId,
} from './contextualActionsModel';

export type {
  ContextualAction,
  ContextualActionAvailability,
  ContextualActionId,
  ContextualActionModel,
} from './contextualActionsModel';

export interface ContextualActionsProps {
  selection: Selection;
  availability: ContextualActionAvailability;
  active: boolean;
  presentation: SurfacePresentation;
  shellClass: ShellClass;
  ariaLabel: string;
  labelForAction: (action: ContextualActionId) => string;
  accessibleLabelForAction?: (action: ContextualActionId) => string;
  overflowLabel: string;
  onInvoke: (action: ContextualActionId) => void | Promise<void>;
}

/**
 * Broker-presented surface for contextual selection actions. Its only local
 * state is the overflow disclosure; selection and availability remain derived
 * inputs from its owner.
 */
export const ContextualActions = ({
  selection,
  availability,
  active,
  presentation,
  shellClass,
  ariaLabel,
  labelForAction,
  accessibleLabelForAction = labelForAction,
  overflowLabel,
  onInvoke,
}: ContextualActionsProps) => {
  const model = resolveContextualActionModel(selection, availability);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);

  if (!model || !active) return null;

  const closeOverflow = (restoreFocus = false) => {
    if (!overflowOpen) return;
    setOverflowOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => overflowTriggerRef.current?.focus());
  };

  const invoke = (action: ContextualActionId) => {
    closeOverflow();
    void onInvoke(action);
  };

  return <section
    className="contextual-actions"
    data-contextual-actions
    data-presentation={presentation}
    data-shell-class={shellClass}
    role="toolbar"
    aria-label={ariaLabel}
    onKeyDownCapture={(event) => {
      if (event.key !== 'Escape' || !overflowOpen) return;
      event.preventDefault();
      event.stopPropagation();
      closeOverflow(true);
    }}
  >
    {model.visible.map((action) => <button
      key={action.id}
      type="button"
      className={action.id === 'delete' ? 'contextual-actions__action contextual-actions__action--danger' : 'contextual-actions__action'}
      aria-label={accessibleLabelForAction(action.id)}
      aria-keyshortcuts={action.shortcut}
      onClick={() => invoke(action.id)}
    >{labelForAction(action.id)}</button>)}
    <button
      ref={overflowTriggerRef}
      type="button"
      className="contextual-actions__overflow-trigger"
      aria-label={overflowLabel}
      aria-expanded={overflowOpen}
      aria-haspopup="menu"
      onClick={() => setOverflowOpen((current) => !current)}
    >⋯</button>
    {overflowOpen ? <div className="contextual-actions__overflow" role="menu" aria-label={overflowLabel}>
      {model.overflow.map((action) => <button
        key={action.id}
        type="button"
        role="menuitem"
        className="contextual-actions__overflow-action"
        aria-keyshortcuts={action.shortcut}
        onClick={() => invoke(action.id)}
      >
        <span>{labelForAction(action.id)}</span>
        {action.shortcut ? <kbd>{action.shortcut}</kbd> : null}
      </button>)}
    </div> : null}
  </section>;
};
