import type { Selection } from '../../types';

export const CONTEXTUAL_ACTION_IDS = [
  'copy',
  'paste',
  'duplicate',
  'repeat',
  'delete',
  'datasheet',
  'structuralEdit',
  /**
   * «Seleccionar similares»: todo lo que comparte sección y material con lo
   * seleccionado. Vive aquí, y no sólo en la paleta, porque es la única de las
   * consultas por propiedad que se define CONTRA la selección — y este zócalo
   * es justo el sitio donde el usuario ya tiene una selección delante.
   */
  'selectSimilar',
] as const;

export type ContextualActionId = (typeof CONTEXTUAL_ACTION_IDS)[number];

export interface ContextualActionAvailability {
  copy: boolean;
  paste: boolean;
  duplicate: boolean;
  repeat: boolean;
  datasheet: boolean;
  structuralEdit: boolean;
  selectSimilar: boolean;
}

export interface ContextualAction {
  id: ContextualActionId;
  shortcut?: string;
}

export interface ContextualActionModel {
  primary: ContextualAction;
  visible: readonly [ContextualAction, ContextualAction];
  overflow: readonly ContextualAction[];
}

export const ACTIONS: Record<ContextualActionId, ContextualAction> = {
  copy: { id: 'copy', shortcut: 'Ctrl/Cmd+C' },
  paste: { id: 'paste', shortcut: 'Ctrl/Cmd+V' },
  duplicate: { id: 'duplicate', shortcut: 'Ctrl/Cmd+D' },
  repeat: { id: 'repeat', shortcut: 'R' },
  delete: { id: 'delete', shortcut: 'Delete' },
  datasheet: { id: 'datasheet' },
  structuralEdit: { id: 'structuralEdit' },
  selectSimilar: { id: 'selectSimilar' },
};

export const actionAvailable = (
  action: ContextualActionId,
  availability: ContextualActionAvailability,
): boolean => action === 'delete' || availability[action];

export const preferredPrimary = (selection: Exclude<Selection, null>): readonly ContextualActionId[] => {
  if (selection.kind === 'node' || selection.kind === 'member' || selection.kind === 'multi') {
    return ['structuralEdit', 'duplicate', 'copy', 'datasheet'];
  }
  return ['repeat', 'copy', 'datasheet'];
};

/**
 * Selection owns the existence and capability set. This model only projects it
 * into the Compact floor; it never stores a second selection or shell class.
 */
export const resolveContextualActionModel = (
  selection: Selection,
  availability: ContextualActionAvailability,
): ContextualActionModel | null => {
  if (!selection) return null;
  const primaryId = preferredPrimary(selection).find((action) => actionAvailable(action, availability));
  if (!primaryId) return null;
  const primary = ACTIONS[primaryId];
  const overflow = CONTEXTUAL_ACTION_IDS
    .filter((id) => id !== primaryId && id !== 'delete' && actionAvailable(id, availability))
    .map((id) => ACTIONS[id]);
  return { primary, visible: [primary, ACTIONS.delete], overflow };
};
