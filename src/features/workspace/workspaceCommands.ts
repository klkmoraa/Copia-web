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
import type { InspectorSegment } from '../inspector/inspectorSegments';
import type { DenseResultView } from '../results/denseResults';

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
  /** Request the Results surface; the presentation broker chooses its placement. */
  'open-results': void;
  /**
   * Abre el panel derecho, opcionalmente en un segmento concreto.
   *
   * Sustituye a las dos aperturas de superficie que habia —`analysisSetup` y
   * `view`—: un segmento no es una superficie, asi que quien queria «cargas» o
   * «vista» ya no pide otra superficie, pide este panel apuntando a donde iba.
   * `trigger` viaja para que el broker devuelva el foco al cerrarse.
   */
  'open-detail': { segment?: InspectorSegment; trigger?: HTMLElement | null };
  /**
   * Invoke the dense results surface (reactions, influence, "Entender") on a
   * given view. It is never resident, so the launcher travels with the element
   * that asked for it: the broker returns focus there when the surface closes.
   */
  'open-dense-results': { view: DenseResultView; trigger?: HTMLElement | null };
  /** Export the structural canvas as a standalone SVG file. */
  'export-svg': void;
  /** Export the structural canvas as a raster image. */
  'export-png': void;
  /** Raise the command palette; emitted from the ToolRail trigger or keyboard shortcut. */
  'open-command-palette': void;
  /** Open the preventive Model Doctor surface before or after analysis. */
  'open-model-doctor': void;
  /**
   * Open the structural datasheet. It projects the current model as a table and
   * shares the workspace selection, so it needs no payload of its own.
   */
  'open-datasheet': void;
  /** Open the contextual structural-editing surface for the current selection. */
  'open-structural-edit': void;
  /**
   * Open the structure generator over the canvas. It needs no selection: it
   * creates geometry rather than transforming what is already there.
   */
  'open-structure-generator': void;
  /** Show a toast notification on screen. */
  'show-toast': {
    message: string;
    description?: string;
    tone?: 'success' | 'info' | 'warning' | 'error';
    durationMs?: number;
  };
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
