import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ProjectModel } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';
import {
  createStructuralEditGeometryPreview,
  prepareStructuralEdit,
  resolveStructuralSelection,
  structuralEditSnapshot,
  type PreparedStructuralEdit,
  type StructuralEditGeometryPreview,
} from '../../data/structuralEditing';
import { buildStructuralEditRequest, type StructuralEditDraft } from './structuralEditUi';
import { EMPTY_STRUCTURAL_EDIT_NODE_IDS } from './canvasVocabulary';

export interface UseStructuralEditDraftParams {
  project: ProjectModel;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  /** Dónde buscar el primer campo de parámetros al que devolver el foco. */
  hostRef: RefObject<HTMLDivElement | null>;
}

/**
 * El borrador de edición estructural, extraído tal cual de `StructuralCanvas.tsx`.
 *
 * Hay dos borradores y no uno por una razón de rendimiento que conviene no
 * perder: `structuralEditDraft` es el borrador comprometido, del que salen la
 * preparación y el conjunto de nudos excluidos; `structuralEditLiveDraft` es el
 * que avanza con el puntero en cada `requestAnimationFrame`. Separarlos permite
 * que un arrastre repinte la previsualización geométrica sin rehacer el cierre
 * estructural —que es O(N + M)— en cada frame.
 *
 * Las tres operaciones sobre el frame en vuelo viven aquí porque las cuatro
 * referencias que coordinan son suyas y de nadie más: descartarlo, volcarlo, y
 * deshacerlo devolviendo el borrador previo.
 */
export const useStructuralEditDraft = ({ project, t, hostRef }: UseStructuralEditDraftParams) => {
  const [structuralEditDraft, setStructuralEditDraft] = useState<StructuralEditDraft | null>(null);
  const [structuralEditLiveDraft, setStructuralEditLiveDraft] = useState<StructuralEditDraft | null>(null);
  const [structuralEditPointerArmed, setStructuralEditPointerArmed] = useState(false);
  const [structuralEditCommitError, setStructuralEditCommitError] = useState('');

  const frameRef = useRef<number | null>(null);
  const pendingDraftRef = useRef<StructuralEditDraft | null>(null);
  const liveDraftRef = useRef<StructuralEditDraft | null>(null);
  /** Evita que un segundo Enter lance la misma edición mientras la primera corre. */
  const applyingRef = useRef(false);

  const structuralEditPreview = useMemo((): { prepared: PreparedStructuralEdit | null; error: string } => {
    if (!structuralEditDraft) return { prepared: null, error: '' };
    if (structuralEditDraft.sourceSnapshot !== structuralEditSnapshot(project)) {
      return { prepared: null, error: t('modelDoctor.previewStaleBody') };
    }
    try {
      return {
        prepared: prepareStructuralEdit(project, buildStructuralEditRequest(project, structuralEditDraft)),
        error: '',
      };
    } catch (error) {
      return { prepared: null, error: error instanceof Error ? error.message : t('canvas.twoValidNumbers') };
    }
  }, [project, structuralEditDraft, t]);

  const structuralEditLivePreview = useMemo((): { preview: StructuralEditGeometryPreview | null; error: string } => {
    if (!structuralEditLiveDraft || structuralEditPreview.error) return { preview: null, error: structuralEditPreview.error };
    try {
      return {
        preview: createStructuralEditGeometryPreview(project, buildStructuralEditRequest(project, structuralEditLiveDraft)),
        error: '',
      };
    } catch (error) {
      return { preview: null, error: error instanceof Error ? error.message : t('canvas.twoValidNumbers') };
    }
  }, [project, structuralEditLiveDraft, structuralEditPreview.error, t]);

  const structuralEditExcludedNodeIds = useMemo(() => {
    // A gesture only changes parameters. Its structural closure is fixed from
    // the source draft, so do not rebuild this O(N + M) set on every rAF frame.
    const draft = structuralEditDraft;
    if (!draft) return EMPTY_STRUCTURAL_EDIT_NODE_IDS;
    try {
      return new Set(resolveStructuralSelection(project, draft.selection).nodeIds);
    } catch {
      return EMPTY_STRUCTURAL_EDIT_NODE_IDS;
    }
  }, [project, structuralEditDraft]);

  const structuralEditFocusSession = structuralEditDraft?.sourceSnapshot ?? null;
  useEffect(() => {
    if (!structuralEditFocusSession) return undefined;
    // Run after the surface is committed. This is deliberately session-scoped
    // (not draft-scoped), so numeric typing never steals focus back but a mobile
    // sheet handoff reliably lands on the first parameter field.
    const frame = window.requestAnimationFrame(() => {
      hostRef.current?.querySelector<HTMLInputElement>('.structural-edit-surface input')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hostRef, structuralEditFocusSession]);

  /**
   * Tira el frame en vuelo y el borrador en vivo, sin tocar el comprometido.
   * Es la mitad común de deshacer y de cancelar el arrastre de un nudo.
   */
  const discardStructuralEditFrame = useCallback(() => {
    pendingDraftRef.current = null;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    liveDraftRef.current = null;
    setStructuralEditLiveDraft(null);
  }, []);

  /**
   * Deshace la edición en vuelo y devuelve el borrador al estado con el que
   * empezó el gesto.
   *
   * Esta secuencia estaba escrita cuatro veces —al empezar un pellizco, al
   * descartar un contacto obsoleto, al cancelar el puntero y al cancelar la
   * interacción activa— y las cuatro tenían que acordarse de las mismas cosas
   * en el mismo orden. Olvidar el `cancelAnimationFrame` deja un frame
   * pendiente que reescribe el borrador que se acaba de restaurar.
   */
  const revertStructuralEditTo = useCallback((beforeDraft: StructuralEditDraft | null) => {
    discardStructuralEditFrame();
    setStructuralEditDraft(beforeDraft);
  }, [discardStructuralEditFrame]);

  /** Adelanta el frame pendiente y lo compromete: el gesto ha terminado. */
  const flushStructuralEditDraft = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const pending = pendingDraftRef.current ?? liveDraftRef.current;
    pendingDraftRef.current = null;
    liveDraftRef.current = null;
    if (pending) setStructuralEditDraft(pending);
    setStructuralEditLiveDraft(null);
  }, []);

  const scheduleStructuralEditDraft = useCallback((draft: StructuralEditDraft) => {
    pendingDraftRef.current = draft;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const pending = pendingDraftRef.current;
      pendingDraftRef.current = null;
      if (pending) {
        liveDraftRef.current = pending;
        setStructuralEditLiveDraft(pending);
      }
    });
  }, []);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingDraftRef.current = null;
    liveDraftRef.current = null;
  }, []);

  return {
    structuralEditDraft,
    setStructuralEditDraft,
    structuralEditLiveDraft,
    structuralEditPointerArmed,
    setStructuralEditPointerArmed,
    structuralEditCommitError,
    setStructuralEditCommitError,
    structuralEditPreview,
    structuralEditLivePreview,
    structuralEditExcludedNodeIds,
    structuralEditApplyingRef: applyingRef,
    discardStructuralEditFrame,
    revertStructuralEditTo,
    flushStructuralEditDraft,
    scheduleStructuralEditDraft,
  };
};
