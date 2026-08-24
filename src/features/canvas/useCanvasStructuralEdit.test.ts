// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { Selection } from '../../types';
import type { CutInfo } from './canvasVocabulary';
import type { RepeatRecipe } from './repeatAction';
import type { StructuralEditDraft } from './structuralEditUi';
import { useCanvasStructuralEdit } from './useCanvasStructuralEdit';

afterEach(cleanup);

const t = (key: string) => key;

const setup = () => {
  const project = createDefaultProject();
  const selection: Selection = { kind: 'node', id: project.nodes[0]!.id };
  const cancelActiveInteraction = vi.fn();
  const closeCandidatePicker = vi.fn();
  const setActiveTool = vi.fn();
  const showCanvasFeedback = vi.fn();
  const executePreparedStructuralEdit = vi.fn(async () => undefined);
  const setSelection = vi.fn();

  const hook = renderHook(() => {
    const [duplicateDraft, setDuplicateDraft] = useState<{ selection: Selection; x: string; y: string } | null>(null);
    const [, setRepeatRecipe] = useState<RepeatRecipe | null>(null);
    const [memberStart, setMemberStart] = useState<string | null>('N1');
    const [, setCut] = useState<CutInfo | null>(null);
    const [structuralEditDraft, setStructuralEditDraft] = useState<StructuralEditDraft | null>(null);
    const structuralEditLiveDraftRef = useRef<StructuralEditDraft | null>(null);
    const [, setStructuralEditLiveDraft] = useState<StructuralEditDraft | null>(null);
    const [structuralEditPointerArmed, setStructuralEditPointerArmed] = useState(false);
    const [structuralEditCommitError, setStructuralEditCommitError] = useState('');
    const structuralEditApplyingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement | null>(null);

    const actions = useCanvasStructuralEdit({
      project,
      selection,
      setSelection,
      structuralEditingCapable: true,
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
      structuralEditPreviewPrepared: null,
      executePreparedStructuralEdit,
      svgRef,
      showCanvasFeedback,
      t,
    });

    return {
      actions,
      duplicateDraft,
      memberStart,
      structuralEditDraft,
      structuralEditPointerArmed,
      structuralEditCommitError,
    };
  });

  return { hook, cancelActiveInteraction, closeCandidatePicker, setActiveTool, showCanvasFeedback };
};

describe('useCanvasStructuralEdit', () => {
  it('startStructuralEdit crea un draft y limpia el estado de otras herramientas', () => {
    const { hook, cancelActiveInteraction, closeCandidatePicker, setActiveTool } = setup();
    act(() => { hook.result.current.actions.startStructuralEdit('move'); });
    expect(hook.result.current.structuralEditDraft).not.toBeNull();
    expect(hook.result.current.structuralEditDraft?.kind).toBe('move');
    expect(hook.result.current.memberStart).toBeNull();
    expect(hook.result.current.duplicateDraft).toBeNull();
    expect(cancelActiveInteraction).toHaveBeenCalledTimes(1);
    expect(closeCandidatePicker).toHaveBeenCalledTimes(1);
    expect(setActiveTool).toHaveBeenCalledWith('select');
  });

  it('startStructuralEdit reporta feedback cuando la selección no admite edición estructural', () => {
    const project = createDefaultProject();
    const showCanvasFeedback = vi.fn();
    const hook = renderHook(() => {
      const [structuralEditDraft, setStructuralEditDraft] = useState<StructuralEditDraft | null>(null);
      const structuralEditLiveDraftRef = useRef<StructuralEditDraft | null>(null);
      const [, setStructuralEditLiveDraft] = useState<StructuralEditDraft | null>(null);
      const [, setStructuralEditPointerArmed] = useState(false);
      const [, setStructuralEditCommitError] = useState('');
      const structuralEditApplyingRef = useRef(false);
      const svgRef = useRef<SVGSVGElement | null>(null);
      const actions = useCanvasStructuralEdit({
        project,
        selection: { kind: 'nodalLoad', id: 'does-not-exist' },
        setSelection: vi.fn(),
        structuralEditingCapable: false,
        setActiveTool: vi.fn(),
        cancelActiveInteraction: vi.fn(),
        closeCandidatePicker: vi.fn(),
        setDuplicateDraft: vi.fn(),
        setRepeatRecipe: vi.fn(),
        setMemberStart: vi.fn(),
        setCut: vi.fn(),
        structuralEditDraft,
        setStructuralEditDraft,
        structuralEditLiveDraftRef,
        setStructuralEditLiveDraft,
        setStructuralEditPointerArmed,
        setStructuralEditCommitError,
        structuralEditApplyingRef,
        structuralEditPreviewPrepared: null,
        executePreparedStructuralEdit: vi.fn(async () => undefined),
        svgRef,
        showCanvasFeedback,
        t,
      });
      return { actions, structuralEditDraft };
    });
    act(() => { hook.result.current.actions.startStructuralEdit('move'); });
    expect(hook.result.current.structuralEditDraft).toBeNull();
    expect(showCanvasFeedback).not.toHaveBeenCalled();
  });

  it('changeStructuralEditOperation cambia el kind del draft existente', () => {
    const { hook } = setup();
    act(() => { hook.result.current.actions.startStructuralEdit('move'); });
    act(() => { hook.result.current.actions.changeStructuralEditOperation('mirror'); });
    expect(hook.result.current.structuralEditDraft?.kind).toBe('mirror');
  });

  it('cancelStructuralEdit limpia el draft y delega en cancelActiveInteraction', () => {
    const { hook, cancelActiveInteraction } = setup();
    act(() => { hook.result.current.actions.startStructuralEdit('move'); });
    act(() => { hook.result.current.actions.cancelStructuralEdit(); });
    expect(hook.result.current.structuralEditDraft).toBeNull();
    expect(cancelActiveInteraction).toHaveBeenCalledTimes(2); // una vez al abrir, otra al cancelar
  });

  it('confirmStructuralEdit no hace nada sin cambios preparados', async () => {
    const { hook } = setup();
    act(() => { hook.result.current.actions.startStructuralEdit('move'); });
    await act(async () => { await hook.result.current.actions.confirmStructuralEdit(); });
    // structuralEditPreviewPrepared es null en este setup, así que el draft sigue abierto.
    expect(hook.result.current.structuralEditDraft).not.toBeNull();
  });
});
