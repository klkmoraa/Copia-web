/**
 * Typed command bus for the workspace shell.
 *
 * The panels of the workspace — TopBar, canvas, Inspector, results dock, classroom guide —
 * cannot reach each other through the project store, because what they exchange are
 * *intentions* ("centre this object", "expand the results sheet") rather than state.
 * They used raw `window.dispatchEvent(new CustomEvent('structureco:…'))`, with the name
 * spelled out at 27 call sites and a `detail` typed as `any`. A typo in either produced
 * silence, not an error.
 *
 * The transport is unchanged — still a `CustomEvent` on `window`, so anything already
 * listening keeps working — but the name and the payload now have one definition each.
 */
import type { Selection } from '../../types';

/** A selection that names exactly one object; `multi` and `null` cannot be focused. */
export type FocusableSelection = Extract<NonNullable<Selection>, { id: string }>;

/**
 * Payload of every workspace command. `void` means the command carries no detail.
 *
 * Adding a command here is what makes it dispatchable: there is no string overload.
 */
export interface WorkspaceCommands {
  /** Centre and reveal a model object; emitted from results and warnings. */
  'focus-object': FocusableSelection;
  /** Fit the whole model into the visible canvas. */
  'fit-canvas': void;
  /** Raise the results sheet on small viewports. */
  'expand-mobile-results': void;
  /** Lower the results sheet on small viewports. */
  'collapse-mobile-results': void;
  /** Export the structural canvas as a standalone SVG file. */
  'export-svg': void;
  /** Export the structural canvas as a raster image. */
  'export-png': void;
  /** Show a toast notification on screen. */
  'show-toast': {
    message: string;
    description?: string;
    tone?: 'success' | 'info' | 'warning' | 'error';
    durationMs?: number;
  };
  /** Open the global Command Palette modal. */
  'open-command-palette': void;
}

export type WorkspaceCommand = keyof WorkspaceCommands;

const EVENT_PREFIX = 'structureco:';

const eventName = (command: WorkspaceCommand): string => `${EVENT_PREFIX}${command}`;

/** Emits a command. Commands whose payload is `void` take no second argument. */
export function emitWorkspaceCommand<K extends WorkspaceCommand>(
  ...[command, detail]: WorkspaceCommands[K] extends void ? [K] : [K, WorkspaceCommands[K]]
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName(command), { detail }));
}

/**
 * Subscribes to a command and returns the matching unsubscribe, so an effect can hand it
 * back directly and never leak a listener.
 */
export const onWorkspaceCommand = <K extends WorkspaceCommand>(
  command: K,
  handler: (detail: WorkspaceCommands[K]) => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent<WorkspaceCommands[K]>).detail);
  };
  window.addEventListener(eventName(command), listener);
  return () => window.removeEventListener(eventName(command), listener);
};

/** Exposed for tests and diagnostics; components should not build names by hand. */
export const workspaceCommandEventName = eventName;
