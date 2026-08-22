import type { ModelClipboard } from '../../data/modelOperations';

const STRUCTURAL_CLIPBOARD_PREFIX = 'structureco:model-clipboard:v1\n';

export interface ClipboardReadTextPort {
  readText?: () => Promise<string>;
}

export type ClipboardTextRead =
  | { status: 'unavailable' }
  | { status: 'blocked' }
  | { status: 'timeout' }
  | { status: 'read'; text: string };

/**
 * CRI-118 · `navigator.clipboard.readText()` does not always settle. Measured in
 * real Chromium: without `clipboard-read` granted the promise neither resolves
 * nor rejects — it stays pending until the execution context is destroyed — so a
 * `try/catch`, which only sees rejection, never fires and the caller waits
 * forever with no way to know it is stuck. Two seconds is long enough for a
 * permission prompt answered at gesture time and short enough that a paste that
 * will never arrive falls back to the in-app clipboard instead of hanging.
 */
export const CLIPBOARD_READ_TIMEOUT_MS = 2_000;

export const supportsClipboardReadText = (clipboard: ClipboardReadTextPort | null | undefined): clipboard is Required<ClipboardReadTextPort> => (
  typeof clipboard?.readText === 'function'
);

/**
 * Reads at gesture time so a browser permission policy is observed, not guessed,
 * and gives up after `timeoutMs` so an unsettled permission cannot strand the
 * caller (CRI-118). A timeout is reported apart from `blocked`: the browser never
 * said no, it never said anything, and the two deserve different words.
 */
export const readClipboardText = async (
  clipboard: ClipboardReadTextPort | null | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.clipboard,
  { timeoutMs = CLIPBOARD_READ_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ClipboardTextRead> => {
  if (!supportsClipboardReadText(clipboard)) return { status: 'unavailable' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<ClipboardTextRead>((resolve) => {
      timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
    });
    const read = clipboard.readText().then((text): ClipboardTextRead => ({ status: 'read', text }));
    return await Promise.race([read, timeout]);
  } catch {
    return { status: 'blocked' };
  } finally {
    // The losing promise stays pending on purpose — it belongs to the browser and
    // cannot be cancelled. Only the timer is ours to clean up.
    if (timer !== undefined) clearTimeout(timer);
  }
};

export const encodeStructuralClipboard = (clipboard: ModelClipboard): string => (
  `${STRUCTURAL_CLIPBOARD_PREFIX}${JSON.stringify(clipboard)}`
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isRecordArray = (value: unknown): value is Record<string, unknown>[] => (
  Array.isArray(value) && value.every(isRecord)
);

/**
 * Native clipboard text is untrusted and may be an ordinary spreadsheet grid.
 * Accept only our explicit transport envelope; Datasheet keeps its tabular
 * `datasheetPaste` parser and structural mutations keep their model route.
 */
export const decodeStructuralClipboard = (text: string): ModelClipboard | null => {
  if (!text.startsWith(STRUCTURAL_CLIPBOARD_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(STRUCTURAL_CLIPBOARD_PREFIX.length));
    if (!isRecord(parsed) || typeof parsed.kind !== 'string') return null;
    if (parsed.kind === 'node') {
      return isRecord(parsed.node) && isRecordArray(parsed.nodalLoads) && isRecordArray(parsed.prescribedDisplacements)
        ? parsed as unknown as ModelClipboard
        : null;
    }
    if (parsed.kind === 'member') {
      return isRecord(parsed.member)
        && Array.isArray(parsed.nodes)
        && parsed.nodes.length === 2
        && parsed.nodes.every(isRecord)
        && isRecordArray(parsed.memberLoads)
        && isRecordArray(parsed.initialEffects)
        ? parsed as unknown as ModelClipboard
        : null;
    }
    if (parsed.kind === 'multi') {
      return isRecordArray(parsed.nodes)
        && isRecordArray(parsed.members)
        && isRecordArray(parsed.nodalLoads)
        && isRecordArray(parsed.memberLoads)
        && isRecordArray(parsed.prescribedDisplacements)
        && isRecordArray(parsed.initialEffects)
        ? parsed as unknown as ModelClipboard
        : null;
    }
  } catch {
    return null;
  }
  return null;
};
