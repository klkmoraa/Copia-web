import { memo, useMemo } from 'react';
import type { ProjectModel } from '../../types';
import {
  resolveStructuralSelection,
  type Point2D,
  type PreparedStructuralEdit,
  type StructuralEditGeometryPreview,
} from '../../data/structuralEditing';

export interface CanvasStructuralEditPreviewLayerProps {
  /** The real model is used only as a fallback for unchanged member endpoints. */
  project: ProjectModel;
  prepared?: PreparedStructuralEdit | null;
  geometry?: StructuralEditGeometryPreview | null;
  size: { width: number; height: number };
  toScreen: (x: number, y: number) => Point2D;
  label: string;
}

const CanvasStructuralEditPreviewLayerComponent = ({
  project,
  prepared,
  geometry,
  size,
  toScreen,
  label,
}: CanvasStructuralEditPreviewLayerProps) => {
  const previewProject = prepared?.previewProject ?? project;
  const request = prepared?.request ?? geometry?.request;
  const nodeMap = useMemo<Map<string, Point2D>>(
    () => new Map(previewProject.nodes.map((node) => [node.id, { x: node.x, y: node.y }])),
    [previewProject.nodes],
  );
  const renderNodes = prepared
    ? prepared.previewProject.nodes
      .filter((node) => (prepared.createdNodeIds.length ? prepared.createdNodeIds : prepared.affectedNodeIds).includes(node.id))
      .map((node) => ({ key: node.id, x: node.x, y: node.y }))
    : geometry?.nodes.map((node) => ({ key: node.key, x: node.x, y: node.y })) ?? [];
  const resolvedNodes = useMemo(() => {
    const resolved = new Map(nodeMap);
    for (const node of geometry?.nodes ?? []) resolved.set(node.key, node);
    return resolved;
  }, [geometry?.nodes, nodeMap]);
  const renderMembers = prepared
    ? prepared.previewProject.members
      .filter((member) => (prepared.createdMemberIds.length ? prepared.createdMemberIds : prepared.affectedMemberIds).includes(member.id))
      .map((member) => ({ key: member.id, iKey: member.i, jKey: member.j }))
    : geometry?.members.map((member) => ({ key: member.key, iKey: member.iKey, jKey: member.jKey })) ?? [];
  const sourceResolution = request ? resolveStructuralSelection(project, request.selection) : null;
  const sourceAnchor = sourceResolution ? resolvedNodes.get(sourceResolution.nodeIds[0]) : null;

  if (!request) return null;

  let control: React.ReactNode = null;
  if (request.kind === 'mirror') {
    const start = toScreen(request.axis.start.x, request.axis.start.y);
    const end = toScreen(request.axis.end.x, request.axis.end.y);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const extent = Math.max(size.width, size.height) * 2;
    const ux = dx / length;
    const uy = dy / length;
    control = <line
      data-preview-control="axis"
      className="structural-edit-preview-axis"
      x1={start.x - ux * extent}
      y1={start.y - uy * extent}
      x2={end.x + ux * extent}
      y2={end.y + uy * extent}
    />;
  } else if (request.kind === 'rotate') {
    const center = toScreen(request.center.x, request.center.y);
    control = <g data-preview-control="center" className="structural-edit-preview-center">
      <circle cx={center.x} cy={center.y} r="8" />
      <path d={`M ${center.x - 13} ${center.y} H ${center.x + 13} M ${center.x} ${center.y - 13} V ${center.y + 13}`} />
    </g>;
  } else if (sourceAnchor && (request.kind === 'move' || request.kind === 'linear-array')) {
    const start = request.kind === 'move'
      ? {
        x: sourceAnchor.x - request.delta.x,
        y: sourceAnchor.y - request.delta.y,
      }
      : sourceAnchor;
    const end = request.kind === 'move'
      ? sourceAnchor
      : (() => {
        const magnitude = Math.hypot(request.direction.x, request.direction.y) || 1;
        return {
          x: start.x + request.direction.x / magnitude * request.spacing,
          y: start.y + request.direction.y / magnitude * request.spacing,
        };
      })();
    const screenStart = toScreen(start.x, start.y);
    const screenEnd = toScreen(end.x, end.y);
    control = <g data-preview-control="vector" className="structural-edit-preview-vector">
      <line x1={screenStart.x} y1={screenStart.y} x2={screenEnd.x} y2={screenEnd.y} markerEnd="url(#structural-edit-preview-arrow)" />
      <circle cx={screenStart.x} cy={screenStart.y} r="4" />
    </g>;
  }

  return <g
    data-structural-edit-preview={request.kind}
    data-structural-edit-preview-mode={geometry ? 'gesture' : 'prepared'}
    className="structural-edit-preview-layer"
    style={{ pointerEvents: 'none' }}
    role="img"
    aria-label={label}
  >
    <defs>
      <marker id="structural-edit-preview-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
    </defs>
    <g className="structural-edit-preview-members">
      {renderMembers.map((member) => {
        const start = resolvedNodes.get(member.iKey);
        const end = resolvedNodes.get(member.jKey);
        if (!start || !end) return null;
        const screenStart = toScreen(start.x, start.y);
        const screenEnd = toScreen(end.x, end.y);
        return <line
          key={member.key}
          data-preview-member={member.key}
          x1={screenStart.x}
          y1={screenStart.y}
          x2={screenEnd.x}
          y2={screenEnd.y}
        />;
      })}
    </g>
    <g className="structural-edit-preview-nodes">
      {renderNodes.map((node) => {
        const point = toScreen(node.x, node.y);
        return <circle key={node.key} data-preview-node={node.key} cx={point.x} cy={point.y} r="6" />;
      })}
    </g>
    {control}
  </g>;
};

export const CanvasStructuralEditPreviewLayer = memo(CanvasStructuralEditPreviewLayerComponent);
