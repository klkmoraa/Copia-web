export type EditorLayerId =
  | 'model'
  | 'loads'
  | 'dimensions'
  | 'ids'
  | 'results'
  | 'labels'
  | 'help'
  | 'diagnostics';

export type EditorLayerState = Record<EditorLayerId, boolean>;

export const EDITOR_LAYER_STORAGE_KEY = 'structureco:editor-layers:v1';

const EDITOR_LAYER_IDS: readonly EditorLayerId[] = [
  'model',
  'loads',
  'dimensions',
  'ids',
  'results',
  'labels',
  'help',
  'diagnostics',
];

export type EditorLayerAction =
  | { type: 'toggle'; layer: EditorLayerId }
  | { type: 'set'; layer: EditorLayerId; visible: boolean }
  | { type: 'reset' };

export const DEFAULT_EDITOR_LAYERS: Readonly<EditorLayerState> = Object.freeze({
  model: true,
  loads: true,
  dimensions: true,
  ids: true,
  results: true,
  labels: true,
  help: true,
  diagnostics: true,
});

export const editorLayerReducer = (
  state: EditorLayerState,
  action: EditorLayerAction,
): EditorLayerState => {
  if (action.type === 'reset') return { ...DEFAULT_EDITOR_LAYERS };
  if (action.layer === 'model') return state;
  const visible = action.type === 'toggle' ? !state[action.layer] : action.visible;
  if (state[action.layer] === visible) return state;
  return { ...state, [action.layer]: visible, model: true };
};

export const createEditorLayerState = (): EditorLayerState => ({ ...DEFAULT_EDITOR_LAYERS });

export const parseEditorLayerState = (serialized: string | null): EditorLayerState => {
  if (!serialized) return createEditorLayerState();
  try {
    const parsed = JSON.parse(serialized) as Partial<EditorLayerState> | null;
    if (!parsed || typeof parsed !== 'object') return createEditorLayerState();
    return Object.fromEntries(EDITOR_LAYER_IDS.map((id) => [
      id,
      id === 'model' ? true : typeof parsed[id] === 'boolean' ? parsed[id] : DEFAULT_EDITOR_LAYERS[id],
    ])) as EditorLayerState;
  } catch {
    return createEditorLayerState();
  }
};

export const createPersistedEditorLayerState = (): EditorLayerState => {
  if (typeof window === 'undefined') return createEditorLayerState();
  try {
    return parseEditorLayerState(window.localStorage.getItem(EDITOR_LAYER_STORAGE_KEY));
  } catch {
    return createEditorLayerState();
  }
};

export const persistEditorLayerState = (state: EditorLayerState): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EDITOR_LAYER_STORAGE_KEY, JSON.stringify({ ...state, model: true }));
  } catch {
    // Layer choices are optional presentation state and never block editing.
  }
};
