import { memo, useMemo } from 'react';
import type { StructureGenerationGhost } from '../../data/generators/generatorGhost';
import type { Point2D } from '../../data/structuralEditing';
import '../structure-generator/structureGenerator.css';

export interface CanvasStructureGeneratorLayerProps {
  ghost: StructureGenerationGhost;
  /** Punto de inserción, para que se vea dónde se está anclando la geometría. */
  origin?: Point2D | null;
  toScreen: (x: number, y: number) => Point2D;
  label: string;
}

/**
 * Vista previa en vivo de una generación (CRI-38, fase 3).
 *
 * Dibuja el ghost de la fase 2 y nada más: sus claves no son IDs de entidad, no
 * viene de un `ProjectModel` y no puede persistirse, así que lo que se ve aquí
 * no existe en ningún sitio salvo en esta capa. Por eso también se dibuja
 * distinto de lo confirmado —trazo discontinuo, nudos huecos—: mientras se
 * ajustan parámetros hay dos geometrías en pantalla, y confundirlas sería
 * confundir lo que se va a crear con lo que ya está.
 *
 * No captura el puntero: el lienzo sigue siendo del usuario mientras el panel
 * está abierto.
 */
const CanvasStructureGeneratorLayerComponent = ({
  ghost,
  origin,
  toScreen,
  label,
}: CanvasStructureGeneratorLayerProps) => {
  const points = useMemo(
    () => new Map(ghost.nodes.map((node) => [node.key, toScreen(node.x, node.y)])),
    [ghost.nodes, toScreen],
  );
  const originPoint = origin ? toScreen(origin.x, origin.y) : null;

  return <g
    className="structure-generation-ghost"
    data-structure-generation-ghost={ghost.kind}
    data-ghost-nodes={ghost.nodes.length}
    data-ghost-members={ghost.members.length}
    style={{ pointerEvents: 'none' }}
    role="img"
    aria-label={label}
  >
    <g className="structure-generation-ghost__members">
      {ghost.members.map((member) => {
        const start = points.get(member.iKey);
        const end = points.get(member.jKey);
        if (!start || !end) return null;
        return <line
          key={member.key}
          data-ghost-member-role={member.role}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
        />;
      })}
    </g>
    <g className="structure-generation-ghost__nodes">
      {ghost.nodes.map((node) => {
        const point = points.get(node.key)!;
        return <circle
          key={node.key}
          data-ghost-node-role={node.role}
          data-ghost-supported={node.supported}
          cx={point.x}
          cy={point.y}
          r="5"
        />;
      })}
    </g>
    {originPoint ? <g className="structure-generation-ghost__origin" data-ghost-origin="true">
      <circle cx={originPoint.x} cy={originPoint.y} r="9" />
      <path d={`M ${originPoint.x - 14} ${originPoint.y} H ${originPoint.x + 14} M ${originPoint.x} ${originPoint.y - 14} V ${originPoint.y + 14}`} />
    </g> : null}
  </g>;
};

export const CanvasStructureGeneratorLayer = memo(CanvasStructureGeneratorLayerComponent);
