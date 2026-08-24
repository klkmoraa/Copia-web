import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ProjectModel, Selection, Tool } from '../../types';
import { structuralSelectionFromIds } from '../../data/modelOperations';
import type { PreparedStructuralEdit } from '../../data/structuralEditing';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';
import {
  changeStructuralEditKind,
  createStructuralEditDraft,
  type StructuralEditDraft,
  type StructuralEditKind,
} from './structuralEditUi';
import type { CutInfo } from './canvasVocabulary';
import type { RepeatRecipe } from './repeatAction';
import type { TranslationKey } from '../../i18n/catalogs';

export interface UseCanvasStructuralEditArgs {
  project: ProjectModel;
  selection: Selection;
  setSelection: (next: Selection) => void;
  structuralEditingCapable: boolean;
  setActiveTool: (tool: Tool) => void;
  cancelActiveInteraction: () => void;
  closeCandidatePicker: () => void;
  setDuplicateDraft: Dispatch<SetStateAction<{ selection: Selection; x: string; y: string } | null>>;
  setRepeatRecipe: Dispatch<SetStateAction<RepeatRecipe | null>>;
  setMemberStart: Dispatch<SetStateAction<string | null>>;
  setCut: Dispatch<SetStateAction<CutInfo | null>>;
  structuralEditDraft: StructuralEditDraft | null;
  setStructuralEditDraft: Dispatch<SetStateAction<StructuralEditDraft | null>>;
  structuralEditLiveDraftRef: RefObject<StructuralEditDraft | null>;
  setStructuralEditLiveDraft: Dispatch<SetStateAction<StructuralEditDraft | null>>;
  setStructuralEditPointerArmed: Dispatch<SetStateAction<boolean>>;
  setStructuralEditCommitError: Dispatch<SetStateAction<string>>;
  structuralEditApplyingRef: RefObject<boolean>;
  structuralEditPreviewPrepared: PreparedStructuralEdit | null;
  executePreparedStructuralEdit: (prepared: PreparedStructuralEdit) => Promise<unknown>;
  svgRef: RefObject<SVGSVGElement | null>;
  showCanvasFeedback: (message: string) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

/**
 * Ciclo de vida del draft de edición estructural: abrir, cambiar de
 * operación, actualizar por formulario o gesto, confirmar y cancelar.
 * La lógica de dominio (qué operaciones son válidas, cómo se preparan)
 * vive en `data/structuralEditing.ts` (protegido) y `structuralEditUi.ts`;
 * este hook sólo orquesta cuándo llamarla y qué otro estado del canvas
 * limpiar alrededor (herramienta activa, portapapeles de duplicado,
 * corte activo, selector de candidatos).
 */
export const useCanvasStructuralEdit = ({
  project,
  selection,
  setSelection,
  structuralEditingCapable,
  setActiveTool,
  cancelActiveInteraction,
  closeCandidatePicker,
  setDuplicateDraft,
  setRepeatRecipe,
  setMemberStart,
  setCut,
  structuralEditDraft,
  setStructuralEditDraft,
  structuralEditLiveDraftRef,
  setStructuralEditLiveDraft,
  setStructuralEditPointerArmed,
  setStructuralEditCommitError,
  structuralEditApplyingRef,
  structuralEditPreviewPrepared,
  executePreparedStructuralEdit,
  svgRef,
  showCanvasFeedback,
  t,
}: UseCanvasStructuralEditArgs) => {
  const cancelStructuralEdit = useCallback(() => {
    cancelActiveInteraction();
    setStructuralEditDraft(null);
    structuralEditLiveDraftRef.current = null;
    setStructuralEditLiveDraft(null);
    setStructuralEditPointerArmed(false);
    setStructuralEditCommitError('');
    window.requestAnimationFrame(() => svgRef.current?.focus({ preventScroll: true }));
  }, [cancelActiveInteraction, setStructuralEditCommitError, setStructuralEditDraft, setStructuralEditLiveDraft, setStructuralEditPointerArmed, structuralEditLiveDraftRef, svgRef]);

  const startStructuralEdit = useCallback((kind: StructuralEditKind) => {
    if (!selection || !structuralEditingCapable) return;
    cancelActiveInteraction();
    setDuplicateDraft(null);
    setRepeatRecipe(null);
    setMemberStart(null);
    setCut(null);
    closeCandidatePicker();
    setActiveTool('select');
    setStructuralEditPointerArmed(false);
    structuralEditLiveDraftRef.current = null;
    setStructuralEditLiveDraft(null);
    setStructuralEditCommitError('');
    try {
      setStructuralEditDraft(createStructuralEditDraft(project, selection, kind));
    } catch (error) {
      showCanvasFeedback(error instanceof Error ? error.message : t('canvas.twoValidNumbers'));
    }
  }, [cancelActiveInteraction, closeCandidatePicker, project, selection, setActiveTool, setCut, setDuplicateDraft, setMemberStart, setRepeatRecipe, setStructuralEditCommitError, setStructuralEditDraft, setStructuralEditLiveDraft, setStructuralEditPointerArmed, showCanvasFeedback, structuralEditingCapable, structuralEditLiveDraftRef, t]);

  useEffect(() => onWorkspaceCommand('open-structural-edit', () => startStructuralEdit('move')), [startStructuralEdit]);

  const changeStructuralEditOperation = useCallback((kind: StructuralEditKind) => {
    setStructuralEditDraft((current) => current ? changeStructuralEditKind(project, current, kind) : current);
    structuralEditLiveDraftRef.current = null;
    setStructuralEditLiveDraft(null);
    setStructuralEditPointerArmed(false);
    setStructuralEditCommitError('');
  }, [project, setStructuralEditCommitError, setStructuralEditDraft, setStructuralEditLiveDraft, setStructuralEditPointerArmed, structuralEditLiveDraftRef]);

  const updateStructuralEditDraft = useCallback((draft: StructuralEditDraft) => {
    setStructuralEditDraft(draft);
    structuralEditLiveDraftRef.current = null;
    setStructuralEditLiveDraft(null);
    setStructuralEditCommitError('');
  }, [setStructuralEditCommitError, setStructuralEditDraft, setStructuralEditLiveDraft, structuralEditLiveDraftRef]);

  const confirmStructuralEdit = useCallback(async () => {
    const prepared = structuralEditPreviewPrepared;
    if (!prepared?.hasChanges || structuralEditApplyingRef.current) return;
    structuralEditApplyingRef.current = true;
    try {
      await executePreparedStructuralEdit(prepared);
      if (prepared.createdNodeIds.length || prepared.createdMemberIds.length) {
        setSelection(structuralSelectionFromIds(prepared.createdNodeIds, prepared.createdMemberIds));
      }
      setStructuralEditDraft(null);
      structuralEditLiveDraftRef.current = null;
      setStructuralEditLiveDraft(null);
      setStructuralEditPointerArmed(false);
      setStructuralEditCommitError('');
      window.requestAnimationFrame(() => svgRef.current?.focus({ preventScroll: true }));
    } catch (error) {
      setStructuralEditCommitError(error instanceof Error ? error.message : t('canvas.twoValidNumbers'));
    } finally {
      structuralEditApplyingRef.current = false;
    }
  }, [executePreparedStructuralEdit, setSelection, setStructuralEditCommitError, setStructuralEditDraft, setStructuralEditLiveDraft, setStructuralEditPointerArmed, structuralEditApplyingRef, structuralEditLiveDraftRef, structuralEditPreviewPrepared, svgRef, t]);

  useEffect(() => {
    if (!structuralEditDraft || JSON.stringify(structuralEditDraft.selection) === JSON.stringify(selection)) return;
    cancelStructuralEdit();
  }, [cancelStructuralEdit, selection, structuralEditDraft]);

  return {
    cancelStructuralEdit,
    startStructuralEdit,
    changeStructuralEditOperation,
    updateStructuralEditDraft,
    confirmStructuralEdit,
  };
};
