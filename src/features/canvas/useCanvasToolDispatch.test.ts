// @vitest-environment jsdom
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { DiagramPoint, ProjectModel, Selection, Tool } from '../../types';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { CANVAS_REFERENCE_SCALE } from './canvasChromeGeometry';
import { useCanvasToolDispatch } from './useCanvasToolDispatch';

afterEach(cleanup);

const camera = { scale: CANVAS_REFERENCE_SCALE, x: 260, y: 500 };

const setup = () => {
  const project = createDefaultProject();
  const nodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  const memberMap = new Map(project.members.map((member) => [member.id, member]));
  let selection: Selection = null;
  const setSelection = vi.fn((next: Selection) => { selection = next; });
  let activeTool: Tool = 'select';
  const setActiveTool = vi.fn((tool: Tool) => { activeTool = tool; });
  let memberStart: string | null = null;
  const setMemberStart = vi.fn((next: string | null | ((current: string | null) => string | null)) => {
    memberStart = typeof next === 'function' ? (next as (current: string | null) => string | null)(memberStart) : next;
  });
  const setRepeatRecipe = vi.fn();
  const executeProjectCommand = vi.fn(async () => undefined);
  const updateProject = vi.fn((updater: (draft: ProjectModel) => ProjectModel) => { updater(structuredClone(project)); });
  const setCut = vi.fn();
  const memberValueAt = vi.fn((): DiagramPoint | null => null);
  const deleteSelection = vi.fn();
  const addNode = vi.fn(() => 'N-new');
  const createMemberEndpoint = vi.fn(async () => undefined);
  const modelPointFromClient = vi.fn(() => ({ x: 1, y: 1 }));
  const showCanvasFeedback = vi.fn();
  const onRequestInspector = vi.fn();
  const t = (key: string) => key;
  const localScreenPoint = (clientX: number, clientY: number) => ({ x: clientX, y: clientY });

  const dispatch = useCanvasToolDispatch({
    project,
    units: project.settings.units,
    selectionFilter: readCanvasViewSettings(project).selectionFilter,
    selection,
    setSelection,
    activeTool,
    setActiveTool,
    memberStart,
    setMemberStart,
    repeatRecipe: null,
    setRepeatRecipe,
    executeProjectCommand,
    updateProject,
    nodeMap,
    memberMap,
    localScreenPoint,
    cameraRef: { current: camera },
    setCut,
    memberValueAt,
    deleteSelection,
    addNode,
    createMemberEndpoint,
    modelPointFromClient,
    showCanvasFeedback,
    onRequestInspector,
    t,
  });

  return { dispatch, project, setSelection, setMemberStart, deleteSelection, addNode, createMemberEndpoint, setCut, executeProjectCommand };
};

describe('useCanvasToolDispatch', () => {
  it('performTargetAction sobre el fondo con la herramienta nodo crea un nodo', () => {
    const { dispatch, addNode } = setup();
    dispatch.performTargetAction({ kind: 'background' }, 'node', { x: 10, y: 10 });
    expect(addNode).toHaveBeenCalledWith({ x: 1, y: 1 });
  });

  it('performTargetAction sobre el fondo con la herramienta seleccionar limpia la selección', () => {
    const { dispatch, setSelection, setMemberStart, setCut } = setup();
    dispatch.performTargetAction({ kind: 'background' }, 'select', { x: 0, y: 0 });
    expect(setSelection).toHaveBeenCalledWith(null);
    expect(setMemberStart).toHaveBeenCalledWith(null);
    expect(setCut).toHaveBeenCalledWith(null);
  });

  it('performTargetAction sobre un nodo con la herramienta borrar despacha deleteSelection', () => {
    const { dispatch, project, deleteSelection } = setup();
    const nodeId = project.nodes[0]!.id;
    dispatch.performTargetAction({ kind: 'node', id: nodeId }, 'delete', { x: 0, y: 0 });
    expect(deleteSelection).toHaveBeenCalledWith({ kind: 'node', id: nodeId });
  });

  it('performTargetAction sobre un nodo con la herramienta seleccionar fija la selección de ese nodo', () => {
    const { dispatch, project, setSelection } = setup();
    const nodeId = project.nodes[0]!.id;
    dispatch.performTargetAction({ kind: 'node', id: nodeId }, 'select', { x: 0, y: 0 });
    expect(setSelection).toHaveBeenCalledWith({ kind: 'node', id: nodeId });
  });

  it('performTargetAction sobre una barra con la herramienta corte pinea un corte', () => {
    const { dispatch, project, setCut, setSelection } = setup();
    const memberId = project.members[0]!.id;
    dispatch.performTargetAction({ kind: 'member', id: memberId }, 'cut', { x: 400, y: 400 });
    expect(setCut).toHaveBeenCalledWith(expect.objectContaining({ memberId, pinned: true }));
    expect(setSelection).toHaveBeenCalledWith({ kind: 'member', id: memberId });
  });

  it('performTargetAction sobre una barra con la herramienta miembro despacha member.split', () => {
    const { dispatch, project, executeProjectCommand } = setup();
    const memberId = project.members[0]!.id;
    dispatch.performTargetAction({ kind: 'member', id: memberId }, 'node', { x: 400, y: 400 });
    expect(executeProjectCommand).toHaveBeenCalledWith(expect.objectContaining({ kind: 'member.split', memberId }));
  });

  it('finishSelectionBox convierte la caja en selección múltiple', () => {
    const { dispatch, project, setSelection } = setup();
    const node = project.nodes[0]!;
    dispatch.finishSelectionBox({
      pointerId: 1,
      additive: false,
      start: { x: node.x - 1000, y: node.y - 1000 },
      current: { x: node.x + 1000, y: node.y + 1000 },
    } as Parameters<typeof dispatch.finishSelectionBox>[0]);
    expect(setSelection).toHaveBeenCalled();
  });
});
