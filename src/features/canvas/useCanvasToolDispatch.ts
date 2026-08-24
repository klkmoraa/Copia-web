import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { DiagramPoint, MemberModel, NodeModel, ProjectModel, Selection, Tool, UnitSystemId } from '../../types';
import type { ProjectCommand, ProjectCommandResult } from '../../commands/projectCommand';
import { fromDisplay } from '../../engine/units';
import { toggleStructuralSelection, structuralSelectionFromIds } from '../../data/modelOperations';
import { selectGeometryByBox } from '../../utils/selectionGeometry';
import { flexibleRatioFromGross, grossRatioAtPoint, memberAxis } from '../../graphics/structureGeometry';
import { screenToModelPoint, type ScreenPoint } from './canvasInteraction';
import { clamp, nextCanvasId as nextId, supportCycle, type Camera, type CutInfo, type SelectionBox } from './canvasVocabulary';
import type { CanvasViewSettings } from '../view/canvasViewSettings';
import type { RepeatRecipe } from './repeatAction';
import type { StructuralTarget } from './CanvasGeometryLayer';
import type { TranslationKey } from '../../i18n/catalogs';

export interface UseCanvasToolDispatchArgs {
  project: ProjectModel;
  units: UnitSystemId;
  selectionFilter: CanvasViewSettings['selectionFilter'];
  selection: Selection;
  setSelection: (next: Selection) => void;
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  memberStart: string | null;
  setMemberStart: Dispatch<SetStateAction<string | null>>;
  repeatRecipe: RepeatRecipe | null;
  setRepeatRecipe: Dispatch<SetStateAction<RepeatRecipe | null>>;
  executeProjectCommand: (command: ProjectCommand) => Promise<ProjectCommandResult | undefined>;
  updateProject: (updater: (project: ProjectModel) => ProjectModel, analyzeAfter?: boolean) => void;
  nodeMap: ReadonlyMap<string, NodeModel>;
  memberMap: ReadonlyMap<string, MemberModel>;
  localScreenPoint: (clientX: number, clientY: number) => ScreenPoint;
  cameraRef: RefObject<Camera>;
  setCut: Dispatch<SetStateAction<CutInfo | null>>;
  memberValueAt: (memberId: string, ratio: number) => DiagramPoint | null;
  deleteSelection: (target?: Selection) => void;
  addNode: (point: { x: number; y: number }) => string;
  createMemberEndpoint: (point: { x: number; y: number }) => Promise<void>;
  modelPointFromClient: (clientX: number, clientY: number, excludedNodeIds?: string | ReadonlySet<string>) => { x: number; y: number };
  showCanvasFeedback: (message: string) => void;
  onRequestInspector?: () => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

/**
 * Despacho de acciones por herramienta activa: qué hace un clic sobre el
 * fondo, un nudo, una barra o el resultado de una caja de selección, para
 * cada herramienta del lienzo. Recibe ya resueltas las acciones de CRUD
 * (`deleteSelection`, `addNode`, `createMemberEndpoint`) y sólo decide, a
 * partir de la herramienta activa y el objetivo, cuál invocar.
 */
export const useCanvasToolDispatch = ({
  project,
  units,
  selectionFilter,
  selection,
  setSelection,
  setActiveTool,
  memberStart,
  setMemberStart,
  repeatRecipe,
  setRepeatRecipe,
  executeProjectCommand,
  updateProject,
  nodeMap,
  memberMap,
  localScreenPoint,
  cameraRef,
  setCut,
  memberValueAt,
  deleteSelection,
  addNode,
  createMemberEndpoint,
  modelPointFromClient,
  showCanvasFeedback,
  onRequestInspector,
  t,
}: UseCanvasToolDispatchArgs) => {
  const completeLoadPlacement = (label: string) => {
    setActiveTool('select');
    showCanvasFeedback(t('canvas.loadAdded', { load: label }));
    // Open after the click sequence so the newly mounted backdrop cannot receive
    // the matching pointerup/click.
    window.requestAnimationFrame(() => onRequestInspector?.());
  };

  const finishSelectionBox = (box: SelectionBox) => {
    const result = selectGeometryByBox(box.start, box.current, project.nodes, project.members, selectionFilter);
    const nodeIds = new Set(result.nodeIds);
    const memberIds = new Set(result.memberIds);
    if (box.additive) {
      if (selection?.kind === 'node') nodeIds.add(selection.id);
      else if (selection?.kind === 'member') memberIds.add(selection.id);
      else if (selection?.kind === 'multi') {
        selection.nodeIds.forEach((id) => nodeIds.add(id));
        selection.memberIds.forEach((id) => memberIds.add(id));
      }
    }
    setSelection(structuralSelectionFromIds(nodeIds, memberIds));
  };

  const performNodeAction = (node: NodeModel, tool: Tool, shiftKey = false) => {
    if (tool === 'member') {
      if (!memberStart) { setMemberStart(node.id); setSelection({ kind: 'node', id: node.id }); return; }
      if (memberStart === node.id) { setMemberStart(null); return; }
      const id = nextId('M', project.members.map((member) => member.id));
      const template = repeatRecipe?.kind === 'member'
        ? repeatRecipe.template
        : { type: 'frame' as const, materialOrigin: 'custom' as const, sectionOrigin: 'custom' as const, E: 200e6, A: 0.005, I: 8.333e-6, density: 7850 };
      void executeProjectCommand({
        kind: 'member.create',
        description: `Crear miembro ${id}`,
        nodes: [],
        member: { id, i: memberStart, j: node.id, ...template },
      });
      setMemberStart(null);
      setRepeatRecipe(null);
      setSelection({ kind: 'member', id });
      return;
    }
    if (tool === 'support') {
      updateProject((draft) => {
        const target = draft.nodes.find((item) => item.id === node.id);
        if (target) {
          const current = supportCycle.indexOf(target.support.type as typeof supportCycle[number]);
          const type = supportCycle[(current + 1 + supportCycle.length) % supportCycle.length];
          target.support = type === 'roller' ? { type, angleDeg: 90 } : { type };
        }
        return draft;
      });
      setSelection({ kind: 'node', id: node.id });
      return;
    }
    if (tool === 'pointLoad') {
      const id = nextId('NL', project.nodalLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        const template = repeatRecipe?.kind === 'nodalLoad' && repeatRecipe.tool === 'pointLoad'
          ? repeatRecipe.template
          : { caseId, fx: 0, fy: -fromDisplay(10, units, 'force'), mz: 0 };
        draft.nodalLoads.push({ id, nodeId: node.id, ...template });
        return draft;
      });
      setSelection({ kind: 'nodalLoad', id });
      setRepeatRecipe(null);
      completeLoadPlacement(t('toolbar.pointLoad'));
      return;
    }
    if (tool === 'moment') {
      const id = nextId('NL', project.nodalLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        const template = repeatRecipe?.kind === 'nodalLoad' && repeatRecipe.tool === 'moment'
          ? repeatRecipe.template
          : { caseId, fx: 0, fy: 0, mz: fromDisplay(10, units, 'moment') };
        draft.nodalLoads.push({ id, nodeId: node.id, ...template });
        return draft;
      });
      setSelection({ kind: 'nodalLoad', id });
      setRepeatRecipe(null);
      completeLoadPlacement(t('toolbar.moment'));
      return;
    }
    if (tool === 'distributedLoad') {
      showCanvasFeedback(t('canvas.placeDistributedLoad'));
      return;
    }
    if (tool === 'delete') { deleteSelection({ kind: 'node', id: node.id }); return; }
    if (tool === 'select' && shiftKey) {
      setSelection(toggleStructuralSelection(selection, { kind: 'node', id: node.id }));
      return;
    }
    setSelection({ kind: 'node', id: node.id });
  };

  const performMemberAction = (member: MemberModel, tool: Tool, client: ScreenPoint, shiftKey = false) => {
    if (tool === 'split' || tool === 'node' || tool === 'support') {
      const point = screenToModelPoint(localScreenPoint(client.x, client.y), cameraRef.current);
      const ni = nodeMap.get(member.i)!;
      const nj = nodeMap.get(member.j)!;
      const dx = nj.x - ni.x;
      const dy = nj.y - ni.y;
      const ratio = clamp(((point.x - ni.x) * dx + (point.y - ni.y) * dy) / Math.max(dx * dx + dy * dy, 1e-18), 1e-6, 1 - 1e-6);
      void executeProjectCommand({
        kind: 'member.split',
        description: `Dividir miembro ${member.id}`,
        memberId: member.id,
        ratio,
        nodeSupport: tool === 'support' ? { type: 'pin' } : undefined,
      }).then((result) => {
        if (result?.kind === 'member.split') setSelection({ kind: 'node', id: result.nodeId });
      });
      return;
    }
    if (tool === 'distributedLoad') {
      const id = nextId('ML', project.memberLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        const template = repeatRecipe?.kind === 'memberLoad' && repeatRecipe.tool === 'distributedLoad'
          ? repeatRecipe.template
          : { caseId, type: 'distributed' as const, coordinateSystem: 'global' as const, lengthBasis: 'real' as const, start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -fromDisplay(10, units, 'distributedForce'), qyEnd: -fromDisplay(10, units, 'distributedForce') };
        draft.memberLoads.push({ id, memberId: member.id, ...template });
        return draft;
      });
      setSelection({ kind: 'memberLoad', id });
      setRepeatRecipe(null);
      completeLoadPlacement(t('toolbar.distributedLoad'));
      return;
    }
    if (tool === 'pointLoad') {
      const p = screenToModelPoint(localScreenPoint(client.x, client.y), cameraRef.current);
      const ni = nodeMap.get(member.i)!;
      const nj = nodeMap.get(member.j)!;
      const axis = memberAxis(member, ni, nj);
      const ratio = flexibleRatioFromGross(axis, grossRatioAtPoint(axis, p));
      const id = nextId('ML', project.memberLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        const template = repeatRecipe?.kind === 'memberLoad' && repeatRecipe.tool === 'pointLoad'
          ? repeatRecipe.template
          : { caseId, type: 'point' as const, coordinateSystem: 'global' as const, lengthBasis: 'real' as const, start: 0, end: 1, px: 0, py: -fromDisplay(10, units, 'force') };
        draft.memberLoads.push({ id, memberId: member.id, ...template, position: ratio });
        return draft;
      });
      setSelection({ kind: 'memberLoad', id });
      setRepeatRecipe(null);
      completeLoadPlacement(t('toolbar.pointLoad'));
      return;
    }
    if (tool === 'moment') {
      const p = screenToModelPoint(localScreenPoint(client.x, client.y), cameraRef.current);
      const ni = nodeMap.get(member.i)!;
      const nj = nodeMap.get(member.j)!;
      const axis = memberAxis(member, ni, nj);
      const ratio = flexibleRatioFromGross(axis, grossRatioAtPoint(axis, p));
      const id = nextId('ML', project.memberLoads.map((load) => load.id));
      const caseId = project.loadCases.find((loadCase) => loadCase.active)?.id ?? project.loadCases[0]?.id ?? 'LC1';
      updateProject((draft) => {
        const template = repeatRecipe?.kind === 'memberLoad' && repeatRecipe.tool === 'moment'
          ? repeatRecipe.template
          : { caseId, type: 'moment' as const, coordinateSystem: 'local' as const, lengthBasis: 'real' as const, start: 0, end: 1, moment: fromDisplay(10, units, 'moment') };
        draft.memberLoads.push({ id, memberId: member.id, ...template, position: ratio });
        return draft;
      });
      setSelection({ kind: 'memberLoad', id });
      setRepeatRecipe(null);
      completeLoadPlacement(t('toolbar.moment'));
      return;
    }
    if (tool === 'cut') {
      const modelPoint = screenToModelPoint(localScreenPoint(client.x, client.y), cameraRef.current);
      const ni = nodeMap.get(member.i)!;
      const nj = nodeMap.get(member.j)!;
      const dx = nj.x - ni.x;
      const dy = nj.y - ni.y;
      const ratio = clamp(((modelPoint.x - ni.x) * dx + (modelPoint.y - ni.y) * dy) / Math.max(dx * dx + dy * dy, 1e-18), 0, 1);
      setCut({ memberId: member.id, ratio, point: memberValueAt(member.id, ratio), clientX: client.x, clientY: client.y, pinned: true });
      setSelection({ kind: 'member', id: member.id });
      return;
    }
    if (tool === 'delete') { deleteSelection({ kind: 'member', id: member.id }); return; }
    if (tool === 'select' && shiftKey) {
      setSelection(toggleStructuralSelection(selection, { kind: 'member', id: member.id }));
      return;
    }
    setSelection({ kind: 'member', id: member.id });
  };

  const performTargetAction = (target: StructuralTarget, tool: Tool, client: ScreenPoint, shiftKey = false) => {
    if (target.kind === 'background') {
      if (tool === 'node') addNode(modelPointFromClient(client.x, client.y));
      else if (tool === 'member') void createMemberEndpoint(modelPointFromClient(client.x, client.y));
      else if (tool === 'pointLoad' || tool === 'distributedLoad' || tool === 'moment') {
        showCanvasFeedback(tool === 'distributedLoad'
          ? t('canvas.placeDistributedLoad')
          : tool === 'moment'
            ? t('canvas.placeMoment')
            : t('canvas.placePointLoad'));
      }
      else {
        setSelection(null);
        setMemberStart(null);
        setCut(null);
      }
      return;
    }
    if (target.kind === 'node') {
      const node = nodeMap.get(target.id);
      if (node) performNodeAction(node, tool, shiftKey);
      return;
    }
    if (target.kind === 'member') {
      const member = memberMap.get(target.id);
      if (member) performMemberAction(member, tool, client, shiftKey);
      return;
    }
    const selectedTarget: Selection = { kind: target.kind, id: target.id };
    if (tool === 'delete') deleteSelection(selectedTarget);
    else setSelection(selectedTarget);
  };

  return {
    completeLoadPlacement,
    finishSelectionBox,
    performNodeAction,
    performMemberAction,
    performTargetAction,
  };
};
