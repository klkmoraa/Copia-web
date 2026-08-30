import { useCallback, useMemo, useState, type RefObject } from 'react';
import type { MemberModel, NodeModel } from '../../types';
import {
  buildIntersectionSnapCandidates,
  buildPerpendicularSnapCandidates,
  resolveSnap,
  type SnapCandidate,
  type SnapKind,
  type SnapSegment,
} from '../../utils/snapping';
import type { CanvasViewSettings } from '../view/canvasViewSettings';
import { screenToModelPoint, type ModelPoint, type ScreenPoint } from './canvasInteraction';
import { EMPTY_SNAP_CANDIDATES, type Camera } from './canvasVocabulary';

/**
 * Por encima de este número de barras, las intersecciones dejan de calcularse.
 * Son O(n²) por pares de segmentos, y a partir de aquí el coste de encontrarlas
 * supera lo que aportan.
 */
const INTERSECTION_SEGMENT_LIMIT = 500;

export interface UseCanvasSnappingParams {
  projectNodes: readonly NodeModel[];
  projectMembers: readonly MemberModel[];
  nodeMap: ReadonlyMap<string, NodeModel>;
  view: CanvasViewSettings;
  camera: Camera;
  cameraRef: RefObject<Camera>;
  /** Nudo desde el que se está dibujando, si hay un miembro a medias. */
  memberStart: string | null;
  localScreenPoint: (clientX: number, clientY: number) => ScreenPoint;
}

/**
 * El enganche del lienzo, extraído tal cual de `StructuralCanvas.tsx`.
 *
 * Reúne todo lo que decide a qué punto se pega el puntero: los segmentos que
 * ofrecen candidatos, los candidatos por revisión del modelo, el pie
 * perpendicular al origen de dibujo, y las tres formas de preguntar por un
 * punto —crudo, desde coordenadas de cliente, y arrastrando un nudo con su
 * agarre—. La previsualización del enganche vive aquí porque nadie más la
 * escribe: fuera sólo se lee para dibujarla, y se apaga al terminar el gesto.
 *
 * Sale entero porque es una sola pregunta —«¿dónde cae de verdad este
 * punto?»— resuelta en un solo sitio, y porque las tres memoizaciones que la
 * sostienen no le hacen falta a nadie más.
 */
export const useCanvasSnapping = ({
  projectNodes,
  projectMembers,
  nodeMap,
  view,
  camera,
  cameraRef,
  memberStart,
  localScreenPoint,
}: UseCanvasSnappingParams) => {
  const [snapPreview, setSnapPreview] = useState<{ x: number; y: number; kind: SnapKind } | null>(null);

  const snapSegments = useMemo<SnapSegment[]>(() => projectMembers.flatMap((member) => {
    const start = nodeMap.get(member.i);
    const end = nodeMap.get(member.j);
    return start && end ? [{ id: member.id, start, end }] : [];
  }), [nodeMap, projectMembers]);

  const baseSnapCandidates = useMemo<SnapCandidate[]>(() => {
    const candidates: SnapCandidate[] = [];
    if (view.snapTargets.nodes) {
      for (const node of projectNodes) candidates.push({ x: node.x, y: node.y, kind: 'node', sourceIds: [node.id] });
    }
    if (view.snapTargets.midpoints) {
      for (const segment of snapSegments) candidates.push({
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
        kind: 'midpoint',
        sourceIds: [segment.id],
      });
    }
    if (view.snapTargets.intersections && snapSegments.length <= INTERSECTION_SEGMENT_LIMIT) {
      candidates.push(...buildIntersectionSnapCandidates(snapSegments));
    }
    return candidates;
  }, [projectNodes, snapSegments, view.snapTargets]);

  const drawingOrigin = useMemo(() => (memberStart ? nodeMap.get(memberStart) ?? null : null), [memberStart, nodeMap]);

  // Perpendicular feet only depend on the drawing origin and the geometry, never
  // on the pointer, so they are built per model revision instead of per frame.
  const perpendicularSnapCandidates = useMemo<SnapCandidate[]>(() => (
    drawingOrigin && view.snapTargets.perpendicular
      ? buildPerpendicularSnapCandidates(drawingOrigin, snapSegments)
      : EMPTY_SNAP_CANDIDATES
  ), [drawingOrigin, snapSegments, view.snapTargets.perpendicular]);

  const snapPoint = useCallback((point: { x: number; y: number }, excludedNodeIds?: string | ReadonlySet<string>) => {
    // Reuse the memoised arrays untouched whenever nothing has to be merged or
    // excluded: a pointer move should not copy the whole candidate list.
    const merged = perpendicularSnapCandidates.length
      ? [...baseSnapCandidates, ...perpendicularSnapCandidates]
      : baseSnapCandidates;
    const excluded = typeof excludedNodeIds === 'string' ? new Set([excludedNodeIds]) : excludedNodeIds;
    const candidates = excluded?.size
      ? merged.filter((candidate) => !(candidate.kind === 'node' && candidate.sourceIds?.some((id) => excluded.has(id))))
      : merged;
    const result = resolveSnap(point, {
      enabled: view.snap,
      gridSize: view.gridSize,
      pixelsPerUnit: camera.scale,
      candidates,
      modes: {
        grid: view.snapTargets.grid,
        node: view.snapTargets.nodes,
        midpoint: view.snapTargets.midpoints,
        intersection: view.snapTargets.intersections,
        perpendicular: Boolean(drawingOrigin) && view.snapTargets.perpendicular,
      },
    });
    const nextPreview = result.kind === 'none' ? null : { ...result.point, kind: result.kind };
    setSnapPreview((current) => current?.kind === nextPreview?.kind && current?.x === nextPreview?.x && current?.y === nextPreview?.y ? current : nextPreview);
    return result.point;
  }, [baseSnapCandidates, camera.scale, drawingOrigin, perpendicularSnapCandidates, view]);

  const modelPointFromClient = useCallback((clientX: number, clientY: number, excludedNodeIds?: string | ReadonlySet<string>) => {
    const local = localScreenPoint(clientX, clientY);
    return snapPoint(screenToModelPoint(local, cameraRef.current), excludedNodeIds);
  }, [cameraRef, localScreenPoint, snapPoint]);

  const nodeDragPointFromClient = useCallback((
    clientX: number,
    clientY: number,
    excludedNodeId: string,
    grabOffset: ModelPoint,
  ) => {
    const local = localScreenPoint(clientX, clientY);
    const pointerPoint = screenToModelPoint(local, cameraRef.current);
    return snapPoint({ x: pointerPoint.x + grabOffset.x, y: pointerPoint.y + grabOffset.y }, excludedNodeId);
  }, [cameraRef, localScreenPoint, snapPoint]);

  const clearSnapPreview = useCallback(() => { setSnapPreview(null); }, []);

  return {
    snapPreview,
    clearSnapPreview,
    snapPoint,
    modelPointFromClient,
    nodeDragPointFromClient,
  };
};
