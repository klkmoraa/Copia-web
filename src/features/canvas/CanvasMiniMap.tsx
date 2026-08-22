import { memo, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import type { MemberModel, NodeModel } from '../../types';

export interface CanvasMiniMapProps {
  nodes: readonly NodeModel[];
  members: readonly MemberModel[];
  /** Rectángulo del modelo visible ahora mismo, en coordenadas de modelo. `null` mientras el lienzo no se ha medido. */
  viewport: { minX: number; minY: number; maxX: number; maxY: number } | null;
  label: string;
  onFit: () => void;
  /** Clic sobre un punto del radar: centra la cámara ahí, en coordenadas de modelo. */
  onNavigate: (point: { x: number; y: number }) => void;
}

const SVG_WIDTH = 120;
const SVG_HEIGHT = 80;

/**
 * Radar de navegación: la estructura entera reducida a una estampa, con el
 * recuadro de lo que se está mirando. Resuelve la pregunta que el zoom no
 * contesta — "¿dónde estoy dentro del modelo?" — y devuelve al encuadre
 * completo de un clic.
 *
 * Es presentación pura: no lee la cámara ni la escribe, sólo recibe el
 * rectángulo visible y emite la intención de reencuadrar.
 */
const CanvasMiniMapImpl = ({ nodes, members, viewport, label, onFit, onNavigate }: CanvasMiniMapProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const bounds = useMemo(() => {
    if (nodes.length === 0) return null;
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const node of nodes) {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }
    const padX = Math.max(0.5, (maxX - minX) * 0.15);
    const padY = Math.max(0.5, (maxY - minY) * 0.15);
    return {
      minX: minX - padX,
      minY: minY - padY,
      width: Math.max(1e-6, maxX - minX + padX * 2),
      height: Math.max(1e-6, maxY - minY + padY * 2),
    };
  }, [nodes]);

  const projected = useMemo(() => {
    if (!bounds) return null;
    const toSvg = (x: number, y: number) => ({
      cx: ((x - bounds.minX) / bounds.width) * SVG_WIDTH,
      // El modelo crece hacia arriba y el SVG hacia abajo: la Y se invierte una sola vez, aquí.
      cy: SVG_HEIGHT - ((y - bounds.minY) / bounds.height) * SVG_HEIGHT,
    });
    const points = new Map(nodes.map((node) => [node.id, toSvg(node.x, node.y)]));
    return { points, toSvg };
  }, [bounds, nodes]);

  if (!bounds || !projected) return null;

  const frame = viewport ? (() => {
    const start = projected.toSvg(viewport.minX, viewport.maxY);
    const end = projected.toSvg(viewport.maxX, viewport.minY);
    const x = Math.max(0, Math.min(start.cx, end.cx));
    const y = Math.max(0, Math.min(start.cy, end.cy));
    const width = Math.min(SVG_WIDTH - x, Math.abs(end.cx - start.cx));
    const height = Math.min(SVG_HEIGHT - y, Math.abs(end.cy - start.cy));
    // Un recuadro que cubre el radar entero no informa de nada: sólo estorba.
    if (width >= SVG_WIDTH - 1 && height >= SVG_HEIGHT - 1) return null;
    return { x, y, width: Math.max(3, width), height: Math.max(3, height) };
  })() : null;

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const svg = svgRef.current;
    // `detail === 0` marca una activación por teclado (Enter/Espacio), sin
    // coordenadas de puntero fiables: ahí el radar sólo puede encuadrar.
    // jsdom (pruebas unitarias) no implementa el API de coordenadas SVG.
    if (event.detail === 0 || !svg || typeof svg.getScreenCTM !== 'function') { onFit(); return; }
    const ctm = svg.getScreenCTM();
    if (!ctm) { onFit(); return; }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(ctm.inverse());
    onNavigate({
      x: bounds.minX + (local.x / SVG_WIDTH) * bounds.width,
      y: bounds.minY + (1 - local.y / SVG_HEIGHT) * bounds.height,
    });
  };

  return <button
    type="button"
    className="canvas-minimap"
    onClick={handleClick}
    title={label}
    aria-label={label}
    data-canvas-chrome="minimap"
  >
    <svg ref={svgRef} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="canvas-minimap-members">
        {members.map((member) => {
          const start = projected.points.get(member.i);
          const end = projected.points.get(member.j);
          if (!start || !end) return null;
          return <line key={member.id} x1={start.cx} y1={start.cy} x2={end.cx} y2={end.cy} />;
        })}
      </g>
      <g className="canvas-minimap-nodes">
        {nodes.map((node) => {
          const point = projected.points.get(node.id);
          return point ? <circle key={node.id} cx={point.cx} cy={point.cy} r={1.9} /> : null;
        })}
      </g>
      {frame ? <rect className="canvas-minimap-viewport" x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx={2} /> : null}
    </svg>
  </button>;
};

export const CanvasMiniMap = memo(CanvasMiniMapImpl);
