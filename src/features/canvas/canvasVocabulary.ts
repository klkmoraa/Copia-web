/**
 * Vocabulario del lienzo: qué puede estar pasando en él y cómo se llama cada cosa.
 *
 * Primer tramo de la partición de `StructuralCanvas.tsx`, que son 2592 líneas.
 * Aquí vive sólo lo que **no cierra sobre el estado del componente**: los tipos
 * de la interacción, las constantes de identidad estable, los mapas de
 * etiquetas y dos ayudas puras. Es la parte que se puede mover sin poder
 * cambiar el comportamiento ni por accidente.
 *
 * El cuerpo del componente —los cerca de 2350 restantes— comparte un único
 * cierre de estado y **no** tiene una costura equivalente: partirlo es extraer
 * hooks que se pasan quince valores entre sí, y eso es un trabajo con su propio
 * riesgo, que merece su propia pasada con los gates del lienzo ejecutados entre
 * extracción y extracción. Hacerlo con prisa al final de una tanda grande es
 * exactamente como se cuela una regresión en el archivo más delicado del
 * producto.
 */
import type { CandidateTarget } from './candidatePicker';
import type { CanvasCamera, ModelPoint, ScreenPoint } from './canvasInteraction';
import type { ContextualActionId } from './ContextualActions';
import type { StructuralTarget } from './CanvasGeometryLayer';
import type { StructuralEditDraft } from './structuralEditUi';
import type { SnapCandidate } from '../../utils/snapping';
import type { DiagramPoint, Tool } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';

export type Camera = CanvasCamera;

/** Lista vacía compartida, para que los candidatos memoizados mantengan identidad estable. */
export const EMPTY_SNAP_CANDIDATES: SnapCandidate[] = [];

/** El mismo conjunto vacío para una edición inactiva, para que la vista previa no agite props. */
export const EMPTY_STRUCTURAL_EDIT_NODE_IDS: ReadonlySet<string> = new Set();

/** Misma razón: sin mapa de calor, la capa de geometría recibe siempre la misma referencia. */
export const EMPTY_DEMAND_RATIOS: ReadonlyMap<string, number> = new Map();

/** `id` del grupo que la lupa táctil clona con `<use>` para ampliar la escena. */
export const CANVAS_SCENE_ID = 'canvas-scene-root';

export interface Size {
  width: number;
  height: number;
}

export interface CutInfo {
  memberId: string;
  ratio: number;
  point: DiagramPoint | null;
  clientX: number;
  clientY: number;
  pinned?: boolean;
}

export interface SelectionBox {
  pointerId: number;
  start: { x: number; y: number };
  current: { x: number; y: number };
  additive: boolean;
}

/**
 * Estados posibles de la interacción con el lienzo.
 *
 * Unión discriminada y no un puñado de banderas a propósito: «arrastrando un
 * nudo» y «encuadrando con dos dedos» no pueden ocurrir a la vez, y un tipo que
 * lo permitiera obligaría a comprobarlo en cada manejador.
 */
export type CanvasInteractionState =
  | { kind: 'idle' }
  | {
    kind: 'pending';
    pointerId: number;
    pointerType: string;
    start: ScreenPoint;
    target: StructuralTarget;
    candidates: CandidateTarget[];
    anchor: ScreenPoint;
    tool: Tool;
    shiftKey: boolean;
  }
  | {
    kind: 'pan';
    pointerId: number;
    pointerType: string;
    start: ScreenPoint;
    camera: Camera;
    moved: boolean;
    clearSelectionOnTap: boolean;
  }
  | {
    kind: 'pinch';
    pointerIds: [number, number];
    camera: Camera;
    anchor: ModelPoint;
    startDistance: number;
  }
  | { kind: 'node-drag'; pointerId: number; pointerType: string; nodeId: string; grabOffset: ModelPoint }
  | {
    kind: 'structural-edit';
    pointerId: number;
    pointerType: string;
    start: ModelPoint;
    grabOffset: ModelPoint;
    beforeDraft: StructuralEditDraft;
  }
  | ({ kind: 'selection-box' } & SelectionBox)
  | { kind: 'long-press'; pointerId: number; target: StructuralTarget };

export const IDLE_INTERACTION: CanvasInteractionState = { kind: 'idle' };

export const toolLabelKeys: Record<Tool, TranslationKey> = {
  select: 'toolbar.select',
  pan: 'toolbar.pan',
  node: 'toolbar.node',
  member: 'toolbar.member',
  support: 'toolbar.support',
  pointLoad: 'toolbar.pointLoad',
  distributedLoad: 'toolbar.distributedLoad',
  moment: 'toolbar.moment',
  dimension: 'toolbar.dimension',
  cut: 'toolbar.cut',
  split: 'toolbar.split',
  delete: 'toolbar.delete',
};

export const contextualActionLabelKeys: Record<ContextualActionId, TranslationKey> = {
  copy: 'contextualActions.copy',
  paste: 'contextualActions.paste',
  duplicate: 'contextualActions.duplicate',
  repeat: 'contextualActions.repeat',
  delete: 'contextualActions.delete',
  datasheet: 'contextualActions.datasheet',
  structuralEdit: 'contextualActions.structuralEdit',
  selectSimilar: 'select.similarAction',
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Primer `prefijo + número` libre de una lista. */
export const nextCanvasId = (prefix: string, ids: string[]) => {
  let index = 1;
  while (ids.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
};

/** Orden en que un clic repetido recorre los tipos de apoyo. */
export const supportCycle = ['none', 'pin', 'roller', 'fixed'] as const;
