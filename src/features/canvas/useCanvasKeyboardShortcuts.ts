import { useEffect, type RefObject } from 'react';
import type { Selection, Tool } from '../../types';
import { toolFromShortcut } from './toolRegistry';
import type { CandidatePickerState } from './candidatePicker';
import type { StructuralEditDraft } from './structuralEditUi';
import type { RepeatRecipe } from './repeatAction';

/**
 * Atajos de teclado del lienzo, extraídos tal cual de `StructuralCanvas.tsx`:
 * un único `useEffect` que ya sólo necesitaba los callbacks/setters de fuera
 * como parámetros — la máquina de gestos (puntero) no lo toca, así que sale
 * limpio sin tocar refs compartidas con ella.
 */
export interface UseCanvasKeyboardShortcutsParams {
  hostRef: RefObject<HTMLDivElement | null>;
  spacePressedRef: RefObject<boolean>;
  setSpacePressed: (pressed: boolean) => void;
  candidatePicker: CandidatePickerState | null;
  closeCandidatePicker: () => void;
  structuralEditDraft: StructuralEditDraft | null;
  cancelStructuralEdit: () => void;
  repeatCandidate: RepeatRecipe | null;
  activateRepeat: () => void;
  copyStructuralSelection: () => void | Promise<void>;
  pasteStructuralSelection: () => void | Promise<void>;
  startDuplicate: () => void;
  setActiveTool: (tool: Tool) => void;
  duplicateDraft: unknown;
  setDuplicateDraft: (value: null) => void;
  cancelActiveInteraction: () => void;
  setMemberStart: (value: string | null) => void;
  setQuickEntry: (value: { first: string; second: string }) => void;
  setQuickEntryError: (value: string) => void;
  setRepeatRecipe: (value: null) => void;
  setSelection: (value: Selection) => void;
  setCut: (value: null) => void;
  deleteSelection: () => void;
}

export const useCanvasKeyboardShortcuts = ({
  hostRef,
  spacePressedRef,
  setSpacePressed,
  candidatePicker,
  closeCandidatePicker,
  structuralEditDraft,
  cancelStructuralEdit,
  repeatCandidate,
  activateRepeat,
  copyStructuralSelection,
  pasteStructuralSelection,
  startDuplicate,
  setActiveTool,
  duplicateDraft,
  setDuplicateDraft,
  cancelActiveInteraction,
  setMemberStart,
  setQuickEntry,
  setQuickEntryError,
  setRepeatRecipe,
  setSelection,
  setCut,
  deleteSelection,
}: UseCanvasKeyboardShortcutsParams): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const modalOpen = document.querySelector<HTMLElement>('[aria-modal="true"]');
      const interactive = target?.closest('input, select, textarea, button, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [role="tablist"]');
      if (event.key === 'Escape' && candidatePicker) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeCandidatePicker();
        return;
      }
      if ((modalOpen && !target?.closest('[aria-modal="true"]')) || interactive) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (!spacePressedRef.current) {
          spacePressedRef.current = true;
          setSpacePressed(true);
        }
        return;
      }
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape' && structuralEditDraft) {
        event.preventDefault();
        cancelStructuralEdit();
        return;
      }
      if (structuralEditDraft) return;
      // Letter-only shortcuts (no modifier) are scoped to the canvas element
      // itself (CRI-103): anywhere else — including plain document/body focus,
      // which is where a screen reader's quick-nav browse mode intercepts
      // single letters — they must not fire, or they hijack that navigation.
      const canvasHasFocus = document.activeElement instanceof Node && Boolean(hostRef.current?.contains(document.activeElement));
      if (key === 'r' && !command && !event.altKey && canvasHasFocus) {
        if (!repeatCandidate) return;
        event.preventDefault();
        activateRepeat();
        return;
      }
      if (command && key === 'c') {
        event.preventDefault();
        void copyStructuralSelection();
        return;
      }
      if (command && key === 'v') {
        event.preventDefault();
        void pasteStructuralSelection();
        return;
      }
      if (command && key === 'd') {
        event.preventDefault();
        startDuplicate();
        return;
      }
      const shortcutTool = toolFromShortcut(key);
      if (shortcutTool && !command && !event.altKey && canvasHasFocus) {
        event.preventDefault();
        setActiveTool(shortcutTool);
      }
      if (event.key === 'Escape') {
        if (duplicateDraft) {
          setDuplicateDraft(null);
          return;
        }
        cancelActiveInteraction();
        setMemberStart(null);
        setQuickEntry({ first: '', second: '' });
        setQuickEntryError('');
        setRepeatRecipe(null);
        setSelection(null);
        setCut(null);
        setActiveTool('select');
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      }
    };
    const releaseSpace = (event?: KeyboardEvent) => {
      if (event && event.code !== 'Space') return;
      spacePressedRef.current = false;
      setSpacePressed(false);
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') cancelActiveInteraction(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', releaseSpace);
    window.addEventListener('blur', cancelActiveInteraction);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', releaseSpace);
      window.removeEventListener('blur', cancelActiveInteraction);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    activateRepeat, cancelActiveInteraction, cancelStructuralEdit, candidatePicker, closeCandidatePicker,
    copyStructuralSelection, deleteSelection, duplicateDraft, hostRef, pasteStructuralSelection, repeatCandidate,
    setActiveTool, setCut, setDuplicateDraft, setMemberStart, setQuickEntry, setQuickEntryError, setRepeatRecipe,
    setSelection, setSpacePressed, spacePressedRef, startDuplicate, structuralEditDraft,
  ]);
};
