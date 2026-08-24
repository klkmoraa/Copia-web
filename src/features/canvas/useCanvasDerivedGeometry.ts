import { useMemo } from 'react';
import type { AnalysisResult, MemberModel, NodeModel, ProjectModel, Selection, Tool } from '../../types';
import { buildLeftCutEquilibrium } from '../../engine/cut';
import { resolveMemberLocalLoads } from '../../engine/solver';
import { unitLabel } from '../../engine/units';
import {
  buildIntersectionSnapCandidates,
  buildPerpendicularSnapCandidates,
  type SnapCandidate,
  type SnapSegment,
} from '../../utils/snapping';
import { elasticDemandGate, elasticDemandView, elasticIndexPaint, sectionElasticIndex } from '../results/elasticDemand';
import { buildCanvasSelectionVisualState } from './selectionVisuals';
import { screenToModelPoint } from './canvasInteraction';
import { EMPTY_DEMAND_RATIOS, EMPTY_SNAP_CANDIDATES, type Camera, type CutInfo, type Size } from './canvasVocabulary';
import type { CanvasViewSettings } from '../view/canvasViewSettings';
import type { TranslationKey } from '../../i18n/catalogs';

export interface UseCanvasDerivedGeometryArgs {
  project: ProjectModel;
  analysis: AnalysisResult | null;
  view: CanvasViewSettings;
  camera: Camera;
  canvasMeasured: boolean;
  size: Size;
  selection: Selection;
  memberStart: string | null;
  activeTool: Tool;
  selectedCombinationId: string;
  loadsLayerFromEditor: boolean;
  heatmapLayerFromEditor: boolean;
  cut: CutInfo | null;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

/**
 * Agrupa los `useMemo` de geometría/derivados de solo lectura del canvas
 * (mapas por id, candidatos de snap, mapa de demanda elástica, visor del
 * minimapa). Ninguno depende de refs de interacción en vivo, así que se
 * recalculan por revisión de modelo/vista, no por frame de gesto.
 */
export const useCanvasDerivedGeometry = ({
  project,
  analysis,
  view,
  camera,
  canvasMeasured,
  size,
  selection,
  memberStart,
  activeTool,
  selectedCombinationId,
  loadsLayerFromEditor,
  heatmapLayerFromEditor,
  cut,
  t,
}: UseCanvasDerivedGeometryArgs) => {
  const nodeMap = useMemo(() => new Map(project.nodes.map((node) => [node.id, node] as [string, NodeModel])), [project.nodes]);
  const memberMap = useMemo(() => new Map(project.members.map((member) => [member.id, member] as [string, MemberModel])), [project.members]);
  const snapSegments = useMemo<SnapSegment[]>(() => project.members.flatMap((member) => {
    const start = nodeMap.get(member.i);
    const end = nodeMap.get(member.j);
    return start && end ? [{ id: member.id, start, end }] : [];
  }), [nodeMap, project.members]);
  const baseSnapCandidates = useMemo<SnapCandidate[]>(() => {
    const candidates: SnapCandidate[] = [];
    if (view.snapTargets.nodes) {
      for (const node of project.nodes) candidates.push({ x: node.x, y: node.y, kind: 'node', sourceIds: [node.id] });
    }
    if (view.snapTargets.midpoints) {
      for (const segment of snapSegments) candidates.push({
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
        kind: 'midpoint',
        sourceIds: [segment.id],
      });
    }
    if (view.snapTargets.intersections && snapSegments.length <= 500) {
      candidates.push(...buildIntersectionSnapCandidates(snapSegments));
    }
    return candidates;
  }, [project.nodes, snapSegments, view.snapTargets]);
  const drawingOrigin = useMemo(() => (memberStart ? nodeMap.get(memberStart) ?? null : null), [memberStart, nodeMap]);
  // Perpendicular feet only depend on the drawing origin and the geometry, never
  // on the pointer, so they are built per model revision instead of per frame.
  const perpendicularSnapCandidates = useMemo<SnapCandidate[]>(() => (
    drawingOrigin && view.snapTargets.perpendicular
      ? buildPerpendicularSnapCandidates(drawingOrigin, snapSegments)
      : EMPTY_SNAP_CANDIDATES
  ), [drawingOrigin, snapSegments, view.snapTargets.perpendicular]);
  const resultMap = useMemo(() => new Map((analysis?.memberResults ?? []).map((result) => [result.memberId, result])), [analysis]);
  const nodeResultMap = useMemo(() => new Map((analysis?.nodeResults ?? []).map((result) => [result.nodeId, result])), [analysis]);
  const mechanismMap = useMemo(() => new Map((analysis?.mechanism?.nodes ?? []).map((node) => [node.nodeId, node])), [analysis?.mechanism]);
  const units = project.settings.units;
  const selectionFilter = view.selectionFilter;
  const resultsAllowed = true;
  const lengthLabel = unitLabel(units, 'length');
  const forceLabel = unitLabel(units, 'force');
  const momentLabel = unitLabel(units, 'moment');
  const distributedLabel = unitLabel(units, 'distributedForce');
  const selectedCombination = project.combinations.find((item) => item.id === selectedCombinationId) ?? null;
  const selectionVisualState = useMemo(() => buildCanvasSelectionVisualState(selection), [selection]);
  const loadPlacementInstruction = activeTool === 'pointLoad'
    ? t('canvas.placePointLoad')
    : activeTool === 'distributedLoad'
      ? t('canvas.placeDistributedLoad')
      : activeTool === 'moment'
        ? t('canvas.placeMoment')
        : null;
  const loadsLayerVisible = loadsLayerFromEditor || loadPlacementInstruction !== null;
  /**
   * El mapa de demanda es una lectura derivada, no un estado: se recalcula sólo
   * cuando la capa está encendida, así el coste no lo paga quien no lo pidió.
   *
   * Sale del mismo view-model que el Resumen y el Inspector, de modo que una
   * barra sin Fy o sin W verificables —o un análisis no confiable— simplemente
   * no aparece en el mapa: conserva su color de dibujo técnico en lugar de
   * recibir un η fabricado.
   */
  const demandMapActive = heatmapLayerFromEditor && resultsAllowed;
  const demandView = useMemo(
    () => demandMapActive ? elasticDemandView(project, analysis) : null,
    [analysis, demandMapActive, project],
  );
  const heatmapRatios = demandView?.ratios ?? EMPTY_DEMAND_RATIOS;
  /**
   * Leyenda del mapa: sin ella el color es un adorno. Declara qué significa la
   * rampa, cuántos miembros entraron realmente en la lectura y si algún η superó
   * el techo de la rampa —punto en el que el color deja de distinguir magnitud y
   * hay que leer el número—.
   */
  const demandLegend = useMemo(() => {
    if (!demandView) return null;
    const ratios = [...demandView.ratios.values()];
    return {
      evaluated: demandView.status === 'available' ? demandView.evaluated : 0,
      total: demandView.total,
      unevaluated: demandView.unevaluated.size,
      saturated: ratios.some((ratio) => elasticIndexPaint(ratio).saturated),
      maxRatio: ratios.length ? Math.max(...ratios) : null,
    };
  }, [demandView]);
  /** Rectángulo de modelo que cabe hoy en pantalla; es lo que el radar enmarca. */
  const minimapViewport = useMemo(() => {
    if (!canvasMeasured || !size.width || !size.height) return null;
    const topLeft = screenToModelPoint({ x: 0, y: 0 }, camera);
    const bottomRight = screenToModelPoint({ x: size.width, y: size.height }, camera);
    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y),
    };
  }, [camera, canvasMeasured, size.height, size.width]);
  /**
   * Tarjeta contextual: el índice elástico *en esa sección concreta*, no el de
   * la barra entera. Comparte `sectionElasticIndex` y la puerta de confiabilidad
   * con los paneles, así que aquí tampoco se publica un η sin Fy o sin W
   * verificables: en ese caso el corte dice «no disponible» y explica por qué.
   */
  const cutDemand = useMemo(() => {
    if (!cut?.point || !resultsAllowed) return null;
    const member = memberMap.get(cut.memberId);
    if (!member) return null;
    if (elasticDemandGate(analysis).blocker) return { status: 'unavailable' as const };
    const index = sectionElasticIndex(member, cut.point.axial, cut.point.moment);
    return index.status === 'available'
      ? { status: 'available' as const, ratio: index.ratio, ...elasticIndexPaint(index.ratio) }
      : { status: 'unavailable' as const };
  }, [analysis, cut, memberMap, resultsAllowed]);
  const cutEquilibrium = useMemo(() => {
    if (!cut?.point || !analysis?.success) return null;
    const memberResult = resultMap.get(cut.memberId);
    if (!memberResult) return null;
    try {
      const resolved = resolveMemberLocalLoads(project, cut.memberId, selectedCombination);
      return buildLeftCutEquilibrium(memberResult.localEndForces, resolved.loads, cut.point);
    } catch {
      return null;
    }
  }, [analysis?.success, cut, project, resultMap, selectedCombination]);

  return {
    nodeMap,
    memberMap,
    snapSegments,
    baseSnapCandidates,
    drawingOrigin,
    perpendicularSnapCandidates,
    resultMap,
    nodeResultMap,
    mechanismMap,
    units,
    selectionFilter,
    resultsAllowed,
    lengthLabel,
    forceLabel,
    momentLabel,
    distributedLabel,
    selectedCombination,
    selectionVisualState,
    loadPlacementInstruction,
    loadsLayerVisible,
    demandMapActive,
    demandView,
    heatmapRatios,
    demandLegend,
    minimapViewport,
    cutDemand,
    cutEquilibrium,
  };
};
