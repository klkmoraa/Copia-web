import { useMemo } from 'react';
import type { ProjectModel } from '../../types';

export interface CanvasMiniMapProps {
  project: ProjectModel;
  onFit?: () => void;
}

export const CanvasMiniMap = ({ project, onFit }: CanvasMiniMapProps) => {
  const { nodes, members } = project;

  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10, width: 10, height: 10 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const padX = Math.max(1, (maxX - minX) * 0.15);
    const padY = Math.max(1, (maxY - minY) * 0.15);

    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
      width: Math.max(1, maxX - minX + padX * 2),
      height: Math.max(1, maxY - minY + padY * 2),
    };
  }, [nodes]);

  // Convert model coordinate to SVG viewBox space [0..120, 0..80]
  const nodeMap = useMemo(() => {
    const map = new Map<string, { cx: number; cy: number }>();
    const svgW = 120;
    const svgH = 80;

    for (const n of nodes) {
      const normX = (n.x - bounds.minX) / bounds.width;
      const normY = (n.y - bounds.minY) / bounds.height;
      const cx = normX * svgW;
      const cy = svgH - normY * svgH; // Invert Y for cartesian
      map.set(n.id, { cx, cy });
    }
    return map;
  }, [nodes, bounds]);

  if (nodes.length === 0) return null;

  return (
    <div
      className="canvas-minimap"
      onClick={onFit}
      title="Minimapa de Navegación (Clic para auto-encuadre)"
      role="region"
      aria-label="Minimapa Radar de la estructura"
    >
      <svg width="100%" height="100%" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet">
        {/* Render Members */}
        {members.map((m) => {
          const start = nodeMap.get(m.startNodeId);
          const end = nodeMap.get(m.endNodeId);
          if (!start || !end) return null;
          return (
            <line
              key={m.id}
              x1={start.cx}
              y1={start.cy}
              x2={end.cx}
              y2={end.cy}
              stroke="var(--sc-color-text-primary, currentColor)"
              strokeWidth={1.6}
              opacity={0.7}
            />
          );
        })}

        {/* Render Nodes */}
        {nodes.map((n) => {
          const pt = nodeMap.get(n.id);
          if (!pt) return null;
          return (
            <circle
              key={n.id}
              cx={pt.cx}
              cy={pt.cy}
              r={2.2}
              fill="var(--sc-color-action-primary, #00c9db)"
            />
          );
        })}
      </svg>
      <span className="canvas-minimap-badge">RADAR</span>
    </div>
  );
};
