import type { AnalysisResult, DiagramQuantity, MemberModel, NodeModel, ProjectModel, Tool, UnitSystemId } from '../../types';
import type { ResultTab } from '../../store/ProjectContext';
import { toDisplay } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import { grossRatioFromFlexible, memberAxis, pointAtGrossRatio, toGlobalVector } from '../../graphics/structureGeometry';
import type { ScreenPoint } from './canvasInteraction';
import type { EditorLayerState } from './editorLayers';
import type { CanvasSelectionVisualState } from './selectionVisuals';
import type { SmartLabelCandidate } from './labelLayout';
import { CRITICAL_MARKER_MIN_SHARE, criticalExtremesFor, diagramPixelScaleFor, reactionClearanceFor } from './CanvasResultLayer';
import type { CanvasViewSettings } from '../view/canvasViewSettings';

type MemberResult = AnalysisResult['memberResults'][number];
type NodeResult = AnalysisResult['nodeResults'][number];

export interface CanvasLabelSourcesParams {
  activeTool: Tool;
  analysis: AnalysisResult | null;
  cameraScale: number;
  distributedLabel: string;
  forceLabel: string;
  globalDiagramMax: number;
  layers: EditorLayerState;
  lengthLabel: string;
  loadsLayerVisible: boolean;
  memberMap: Map<string, MemberModel>;
  momentLabel: string;
  nodeMap: Map<string, NodeModel>;
  nodeResultMap: Map<string, NodeResult>;
  project: ProjectModel;
  resultMap: Map<string, MemberResult>;
  resultTab: ResultTab;
  resultsAllowed: boolean;
  selectionVisualState: CanvasSelectionVisualState;
  size: { width: number; height: number };
  toScreen: (x: number, y: number) => ScreenPoint;
  units: UnitSystemId;
  view: CanvasViewSettings;
}

/**
 * Todo lo que se etiqueta sobre el lienzo: nodos, miembros, cotas, cargas,
 * reacciones y los valores puntuales del diagrama activo. Un solo productor de
 * candidatos para que `layoutSmartLabels` los reparta a todos juntos — nunca
 * dos sistemas etiquetando el mismo dato (CRI: fase 3, D1).
 *
 * Los extremos máximo/mínimo del diagrama NO generan aquí su candidato
 * `M = …`: ese valor ya lo sella `renderCriticalPoints` en `CanvasResultLayer`,
 * que empuja su propio candidato con el mismo id de extremo. Duplicarlo aquí
 * pondría dos etiquetas sobre el mismo punto.
 */
export const buildCanvasLabelCandidates = ({
  activeTool,
  analysis,
  cameraScale,
  distributedLabel,
  forceLabel,
  globalDiagramMax,
  layers,
  lengthLabel,
  loadsLayerVisible,
  memberMap,
  momentLabel,
  nodeMap,
  nodeResultMap,
  project,
  resultMap,
  resultTab,
  resultsAllowed,
  selectionVisualState,
  size,
  toScreen,
  units,
  view,
}: CanvasLabelSourcesParams): SmartLabelCandidate[] => {
  const smartLabelCandidates: SmartLabelCandidate[] = [];
  const selectedNodeIds = selectionVisualState.nodeIds;
  const selectedMemberIds = selectionVisualState.memberIds;

  for (const node of project.nodes) {
    const selected = selectedNodeIds.includes(node.id);
    if (!selected && !(layers.labels && layers.ids && view.showNodeLabels)) continue;
    const anchor = toScreen(node.x, node.y);
    smartLabelCandidates.push({
      id: `node:${node.id}`,
      text: node.id,
      anchor,
      priority: selected ? 0 : 1,
      tone: selected ? 'selection' : 'neutral',
      preferredOffset: { x: -22, y: -22 },
      forceVisible: selected,
    });
  }

  for (const member of project.members) {
    const ni = nodeMap.get(member.i);
    const nj = nodeMap.get(member.j);
    if (!ni || !nj) continue;
    const a = toScreen(ni.x, ni.y);
    const b = toScreen(nj.x, nj.y);
    const anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const selected = selectedMemberIds.includes(member.id);
    if (selected || (layers.labels && layers.ids && view.showMemberLabels)) {
      smartLabelCandidates.push({
        id: `member:${member.id}`,
        text: member.id,
        anchor,
        priority: selected ? 0 : 2,
        tone: selected ? 'selection' : 'neutral',
        preferredOffset: { x: 0, y: -21 },
        forceVisible: selected,
      });
    }
    const dimensionToolActive = activeTool === 'dimension';
    if (dimensionToolActive || (layers.labels && layers.dimensions && (view.showLocalAxes || view.showDimensions))) {
      smartLabelCandidates.push({
        id: `dimension:${member.id}`,
        text: `${formatFixed(toDisplay(Math.hypot(nj.x - ni.x, nj.y - ni.y), units, 'length'), 3)} ${lengthLabel}`,
        anchor,
        priority: dimensionToolActive ? 1 : 2,
        tone: 'dimension',
        preferredOffset: { x: 0, y: 24 },
        forceVisible: dimensionToolActive,
      });
    }
  }

  if (loadsLayerVisible && view.showLoads && resultTab !== 'influence') {
    for (const load of project.nodalLoads) {
      const node = nodeMap.get(load.nodeId);
      if (!node) continue;
      const selected = selectionVisualState.nodalLoadId === load.id;
      if (!selected && !layers.labels) continue;
      const point = toScreen(node.x, node.y);
      const magnitude = Math.hypot(load.fx, load.fy);
      if (magnitude > 1e-9) {
        const ux = load.fx / magnitude;
        const uy = -load.fy / magnitude;
        smartLabelCandidates.push({
          id: `nodal-load:${load.id}`,
          text: `P = ${formatFixed(toDisplay(magnitude, units, 'force'), 2)} ${forceLabel}`,
          anchor: { x: point.x - ux * 62, y: point.y - uy * 62 - 5 },
          priority: selected ? 0 : 1,
          tone: selected ? 'selection' : 'force',
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      } else if (Math.abs(load.mz) > 1e-9) {
        smartLabelCandidates.push({
          id: `nodal-moment:${load.id}`,
          text: `M = ${formatFixed(toDisplay(load.mz, units, 'moment'), 2)} ${momentLabel}`,
          anchor: { x: point.x, y: point.y - 38 },
          priority: selected ? 0 : 1,
          tone: selected ? 'selection' : 'moment',
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      }
    }

    for (const load of project.memberLoads) {
      const member = memberMap.get(load.memberId);
      const ni = member ? nodeMap.get(member.i) : undefined;
      const nj = member ? nodeMap.get(member.j) : undefined;
      if (!member || !ni || !nj) continue;
      const axis = memberAxis(member, ni, nj);
      if (axis.length <= 1e-12) continue;
      const stationOf = (flexibleRatio: number) => {
        const point = pointAtGrossRatio(axis, grossRatioFromFlexible(axis, flexibleRatio));
        return toScreen(point.x, point.y);
      };
      const selected = selectionVisualState.memberLoadId === load.id;
      if (!selected && !layers.labels) continue;
      const priority = selected ? 0 as const : 1 as const;
      const tone = selected ? 'selection' as const : load.type === 'distributed' ? 'shear' as const : load.type === 'moment' ? 'moment' as const : 'force' as const;
      if (load.type === 'point') {
        const base = stationOf(load.position ?? 0.5);
        const px = load.px ?? 0;
        const py = load.py ?? 0;
        const magnitude = Math.hypot(px, py) || 1;
        const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, px, py);
        const ux = gx / magnitude;
        const uy = -gy / magnitude;
        smartLabelCandidates.push({
          id: `member-point-load:${load.id}`,
          text: `P = ${formatFixed(toDisplay(magnitude, units, 'force'), 2)} ${forceLabel}`,
          anchor: { x: base.x - ux * 60, y: base.y - uy * 60 - 5 },
          priority,
          tone,
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      } else if (load.type === 'moment') {
        const base = stationOf(load.position ?? 0.5);
        smartLabelCandidates.push({
          id: `member-moment:${load.id}`,
          text: `M = ${formatFixed(toDisplay(load.moment ?? 0, units, 'moment'), 2)} ${momentLabel}`,
          anchor: { x: base.x, y: base.y - 38 },
          priority,
          tone,
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      } else {
        const base = stationOf((load.start + load.end) / 2);
        // The label states the mean intensity of the span, not the value at its midpoint.
        const qx = ((load.qxStart ?? 0) + (load.qxEnd ?? load.qxStart ?? 0)) / 2;
        const qy = ((load.qyStart ?? 0) + (load.qyEnd ?? load.qyStart ?? 0)) / 2;
        const [gx, gy] = toGlobalVector(axis, load.coordinateSystem, qx, qy);
        const magnitude = Math.hypot(gx, gy) || 1;
        const ux = gx / magnitude;
        const uy = -gy / magnitude;
        const maximum = Math.max(Math.abs(load.qyStart ?? 0), Math.abs(load.qyEnd ?? 0), Math.abs(load.qxStart ?? 0), Math.abs(load.qxEnd ?? 0), 1);
        const arrowLength = 33 + 12 * (magnitude / maximum);
        const startMagnitude = Math.hypot(load.qxStart ?? 0, load.qyStart ?? 0);
        const endMagnitude = Math.hypot(load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0);
        const average = (startMagnitude + endMagnitude) / 2;
        smartLabelCandidates.push({
          id: `distributed-load:${load.id}`,
          text: `w = ${formatFixed(toDisplay(average, units, 'distributedForce'), 2)} ${distributedLabel}`,
          anchor: { x: base.x - ux * (arrowLength + 9), y: base.y - uy * (arrowLength + 9) - 5 },
          priority,
          tone,
          preferredOffset: { x: 0, y: 0 },
          forceVisible: selected,
        });
      }
    }
  }

  if (layers.results && layers.labels && resultsAllowed && view.showResultValues && analysis?.success) {
    for (const node of project.nodes) {
      const result = nodeResultMap.get(node.id);
      if (!result) continue;
      const point = toScreen(node.x, node.y);
      const { bottom: bottomClearance, side: sideClearance } = reactionClearanceFor(node.support.type);
      if (Math.abs(result.rx) > 1e-8) {
        const direction = Math.sign(result.rx);
        smartLabelCandidates.push({ id: `reaction:${node.id}:rx`, text: `Rx = ${formatFixed(toDisplay(result.rx, units, 'force'), 3)} ${forceLabel}`, anchor: { x: point.x - direction * (sideClearance + 24), y: point.y - 14 }, priority: 1, tone: 'axial', preferredOffset: { x: 0, y: 0 } });
      }
      if (Math.abs(result.ry) > 1e-8) {
        smartLabelCandidates.push({ id: `reaction:${node.id}:ry`, text: `Ry = ${formatFixed(toDisplay(result.ry, units, 'force'), 3)} ${forceLabel}`, anchor: { x: point.x + 18, y: point.y + bottomClearance + 24 }, priority: 1, tone: 'axial', preferredOffset: { x: 0, y: 0 } });
      }
      if (Math.abs(result.rm) > 1e-8) {
        smartLabelCandidates.push({ id: `reaction:${node.id}:rm`, text: `Mᵣ = ${formatFixed(toDisplay(result.rm, units, 'moment'), 3)} ${momentLabel}`, anchor: { x: point.x, y: point.y - 38 }, priority: 1, tone: 'moment', preferredOffset: { x: 0, y: 0 } });
      }
    }

    if (['axial', 'shear', 'moment'].includes(resultTab) && view.showResultOverlay) {
      const quantity = resultTab as DiagramQuantity;
      const side = view.diagramSide === 'negative' ? -1 : 1;
      for (const member of project.members) {
        const result = resultMap.get(member.id);
        const ni = nodeMap.get(member.i);
        const nj = nodeMap.get(member.j);
        if (!result || !ni || !nj) continue;
        const axis = memberAxis(member, ni, nj);
        const length = axis.length;
        if (length <= 1e-12) continue;
        const tx = axis.c;
        const ty = axis.s;
        const nx = axis.normal.x * side;
        const ny = axis.normal.y * side;
        const quantityUnit = quantity === 'moment' ? momentLabel : forceLabel;
        const displayQuantity = quantity === 'moment' ? 'moment' as const : 'force' as const;
        const points = result.criticalPoints
          // Los extremos (maximum/minimum) los sella `renderCriticalPoints` en
          // `CanvasResultLayer`, con tallo, punto y su propio candidato: aquí
          // sólo se etiquetan los puntos que ese sello no cubre (extremos de
          // barra y saltos), para no poner dos etiquetas sobre el mismo dato.
          .filter((point) => point.quantity === quantity && ['end', 'jump'].includes(point.kind))
          .filter((point, index, all) => all.findIndex((candidate) => Math.abs(candidate.x - point.x) <= Math.max(1, length) * 1e-7 && Math.abs(candidate.value - point.value) <= Math.max(1, Math.abs(point.value)) * 1e-7) === index)
          .sort((first, second) => first.x - second.x)
          .slice(0, size.width < 520 ? 2 : 6);
        for (const [index, point] of points.entries()) {
          const grossX = (result.startOffset ?? 0) + point.x;
          const baseX = ni.x + tx * grossX;
          const baseY = ni.y + ty * grossX;
          const offsetModel = point.value * diagramPixelScaleFor(project, resultTab, globalDiagramMax, result) / cameraScale;
          const anchor = toScreen(baseX + nx * offsetModel, baseY + ny * offsetModel);
          const outward = point.value * side >= 0 ? 1 : -1;
          smartLabelCandidates.push({
            id: `result:${member.id}:${quantity}:${point.kind}:${index}`,
            text: `${quantity === 'axial' ? 'N' : quantity === 'shear' ? 'V' : 'M'} = ${formatFixed(toDisplay(point.value, units, displayQuantity), 2)} ${quantityUnit}`,
            anchor,
            priority: 3,
            tone: quantity,
            preferredOffset: { x: nx * outward * 28, y: -ny * outward * 28 - 6 },
          });
        }
      }
    }
  }

  // Sellos Mmax/Mmin y Vmax/Vmin del diagrama activo. Mismo guard que tenía
  // `renderCriticalPoints` en `CanvasResultLayer` antes de ceder su texto a
  // este repartidor — independiente de `layers.results`/`layers.labels`,
  // que gobiernan el otro grupo de etiquetas de resultado.
  if (resultsAllowed && analysis?.success && view.showResultOverlay && (resultTab === 'shear' || resultTab === 'moment')) {
    const key = resultTab as 'shear' | 'moment';
    const symbol = key === 'shear' ? 'V' : 'M';
    const displayQuantity = key === 'moment' ? 'moment' as const : 'force' as const;
    const valueUnit = key === 'moment' ? momentLabel : forceLabel;
    const floor = Math.max(globalDiagramMax * CRITICAL_MARKER_MIN_SHARE, 1e-9);
    const side = view.diagramSide === 'negative' ? -1 : 1;
    for (const member of project.members) {
      const result = resultMap.get(member.id);
      const ni = nodeMap.get(member.i);
      const nj = nodeMap.get(member.j);
      if (!result || !ni || !nj || !result.criticalPoints.length) continue;
      const axis = memberAxis(member, ni, nj);
      if (axis.length <= 1e-12) continue;
      const nx = axis.normal.x * side;
      const ny = axis.normal.y * side;
      const diagramPixelScale = diagramPixelScaleFor(project, resultTab, globalDiagramMax, result);
      for (const { point, extreme } of criticalExtremesFor(result.criticalPoints, key, floor)) {
        const grossX = (result.startOffset ?? 0) + point.x;
        const baseX = ni.x + axis.c * grossX;
        const baseY = ni.y + axis.s * grossX;
        const offsetModel = (point.value * diagramPixelScale) / cameraScale;
        const tip = toScreen(baseX + nx * offsetModel, baseY + ny * offsetModel);
        const value = `${symbol}${extreme === 'max' ? 'max' : 'min'} ${formatFixed(toDisplay(point.value, units, displayQuantity), 2)} ${valueUnit}`;
        const station = `x ${formatFixed(toDisplay(point.x, units, 'length'), 2)} ${lengthLabel}`;
        // El sello se aparta hacia el lado libre del diagrama, nunca hacia la
        // barra: ahí es donde ya hay geometría y etiquetas de modelo.
        const away = Math.sign(offsetModel) || 1;
        smartLabelCandidates.push({
          id: `critical:${member.id}:${key}:${extreme}`,
          text: value,
          lines: [value, station],
          anchor: tip,
          priority: 1,
          forceVisible: true,
          tone: key,
          preferredOffset: { x: nx * away * 9, y: ny * away * 9 - 6 },
        });
      }
    }
  }

  return smartLabelCandidates;
};
