// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { ProjectModel, Selection, Tool } from '../../types';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { CANVAS_REFERENCE_SCALE } from './canvasChromeGeometry';
import type { CandidatePickerState } from './candidatePicker';
import type { RepeatRecipe } from './repeatAction';
import type { SnapKind } from '../../utils/snapping';
import { useCanvasModelActions } from './useCanvasModelActions';

afterEach(cleanup);

const camera = { scale: CANVAS_REFERENCE_SCALE, x: 260, y: 500 };
const size = { width: 1000, height: 640 };

/** Reconstruye lo mínimo que StructuralCanvas.tsx le pasaría al hook, con un `project` que de verdad muta como en el componente real. */
const setup = () => {
  let project = createDefaultProject();
  const executeProjectCommand = vi.fn(async () => undefined);
  const replaceProject = vi.fn((next: ProjectModel) => { project = next; });
  const hook = renderHook(() => {
    const [selection, setSelectionState] = useState<Selection>(null);
    const setSelection = (next: Selection) => setSelectionState(next);
    const [activeTool, setActiveTool] = useState<Tool>('node');
    const view = readCanvasViewSettings(project);
    const [memberStart, setMemberStart] = useState<string | null>(null);
    const [repeatRecipe, setRepeatRecipe] = useState<RepeatRecipe | null>(null);
    const [quickEntry, setQuickEntry] = useState({ first: '', second: '' });
    const [quickEntryError, setQuickEntryErrorState] = useState('');
    const setQuickEntryError = (value: string | ((current: string) => string)) =>
      setQuickEntryErrorState(value as string);
    const [, setSnapPreview] = useState<{ x: number; y: number; kind: SnapKind } | null>(null);
    const [, setDuplicateDraft] = useState<{ selection: Selection; x: string; y: string } | null>(null);
    const [candidatePicker, setCandidatePicker] = useState<CandidatePickerState | null>(null);
    const clipboardRef = useRef(null);
    const pasteCountRef = useRef(1);
    const [, refreshClipboardAvailability] = useState(0);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const showCanvasFeedback = vi.fn();
    const localScreenPoint = (clientX: number, clientY: number) => ({ x: clientX, y: clientY });
    const updateProject = (updater: (draft: ProjectModel) => ProjectModel) => {
      project = updater(project);
    };
    const actions = useCanvasModelActions({
      project,
      selection,
      setSelection,
      activeTool,
      setActiveTool,
      executeProjectCommand,
      updateProject,
      replaceProject,
      nodeMap: new Map(project.nodes.map((node) => [node.id, node])),
      memberStart,
      setMemberStart,
      repeatRecipe,
      setRepeatRecipe,
      quickEntry,
      setQuickEntry,
      quickEntryMode: 'delta',
      setQuickEntryError,
      units: project.settings.units,
      view,
      camera,
      cameraRef: useRef(camera),
      size,
      drawingOrigin: null,
      baseSnapCandidates: [],
      perpendicularSnapCandidates: [],
      setSnapPreview,
      localScreenPoint,
      selectionFilter: view.selectionFilter,
      clipboardRef,
      pasteCountRef,
      refreshClipboardAvailability,
      setDuplicateDraft,
      showCanvasFeedback,
      svgRef,
      candidatePicker,
      setCandidatePicker,
      surfaceBroker: null,
      t: (key: string) => key,
    });
    return { actions, selection, project, quickEntryError };
  });
  return { hook, executeProjectCommand, replaceProject, getProject: () => project };
};

describe('useCanvasModelActions', () => {
  it('addNode crea un nodo en el punto dado y lo selecciona', () => {
    const { hook, getProject } = setup();
    const before = getProject().nodes.length;
    act(() => { hook.result.current.actions.addNode({ x: 5, y: 5 }); });
    expect(getProject().nodes.length).toBe(before + 1);
    expect(hook.result.current.selection).toMatchObject({ kind: 'node' });
  });

  it('deleteSelection no hace nada cuando no hay selección', () => {
    const { hook, executeProjectCommand } = setup();
    act(() => { hook.result.current.actions.deleteSelection(null); });
    expect(executeProjectCommand).not.toHaveBeenCalled();
  });

  it('deleteSelection despacha el comando de borrado de nodo y limpia la selección', () => {
    const { hook, executeProjectCommand } = setup();
    act(() => { hook.result.current.actions.deleteSelection({ kind: 'node', id: 'N1' }); });
    expect(executeProjectCommand).toHaveBeenCalledWith(expect.objectContaining({ kind: 'node.delete', nodeId: 'N1' }));
    expect(hook.result.current.selection).toBeNull();
  });

  it('pasteStructuralSelection no cambia el proyecto cuando no hay nada copiado', async () => {
    const { hook, replaceProject } = setup();
    await act(async () => { await hook.result.current.actions.pasteStructuralSelection(); });
    expect(replaceProject).not.toHaveBeenCalled();
  });

  it('copyStructuralSelection y pasteStructuralSelection redondean el viaje completo', async () => {
    const { hook, replaceProject } = setup();
    // Selecciona el primer nodo del proyecto de ejemplo antes de copiar.
    act(() => { hook.result.current.actions.selectStructuralTarget({ kind: 'node', id: 'N1' }); });
    await act(async () => { await hook.result.current.actions.copyStructuralSelection(); });
    await act(async () => { await hook.result.current.actions.pasteStructuralSelection(); });
    expect(replaceProject).toHaveBeenCalledTimes(1);
  });

  it('selectStructuralTarget limpia la selección para el fondo y la fija para un objeto', () => {
    const { hook } = setup();
    act(() => { hook.result.current.actions.selectStructuralTarget({ kind: 'node', id: 'N1' }); });
    expect(hook.result.current.selection).toEqual({ kind: 'node', id: 'N1' });
    act(() => { hook.result.current.actions.selectStructuralTarget({ kind: 'background' }); });
    expect(hook.result.current.selection).toBeNull();
  });
});
