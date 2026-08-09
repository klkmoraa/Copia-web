import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { buildPortal, projectIso, DEFAULT_PORTAL, type Face, type MaterialId } from '../../graphics/isometricPortal';
import { formatFixed } from '../../utils/numberFormat';

/**
 * Pórtico clay de la bienvenida con iluminación volumétrica y nodos activos.
 * Pinta la geometría derivada de isometricPortal.ts con halo volumétrico y vértices iluminados.
 */

const MATERIAL_TOKEN: Record<MaterialId, string> = {
  column: 'var(--sc-color-clay-ivory)',
  beam: 'var(--sc-color-clay-mint)',
  base: 'var(--sc-color-clay-mint-deep)',
  capital: 'var(--sc-color-clay-ivory-deep)',
};

const toPath = (face: Face) =>
  `${face.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${formatFixed(p.x, 2, 'canvas')} ${formatFixed(p.y, 2, 'canvas')}`)
    .join(' ')} Z`;

const GRID_INDICES = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const GRID_MARGIN = 20;
const CONTACT_SHADOW_SCALE = 0.75;

interface FootprintBox { x: number; z: number; w: number; d: number }

const footprintOf = (columnIndex: 0 | 1): FootprintBox => {
  const { baseWidth, columnWidth, span } = DEFAULT_PORTAL;
  const centreOffset = (baseWidth - columnWidth) / 2;
  const columnX = [0, span - columnWidth];
  return { x: columnX[columnIndex] - centreOffset, z: -centreOffset, w: baseWidth, d: baseWidth };
};

const contactEllipseOf = (footprint: FootprintBox) => {
  const corners = [
    projectIso({ x: footprint.x, y: 0, z: footprint.z }),
    projectIso({ x: footprint.x + footprint.w, y: 0, z: footprint.z }),
    projectIso({ x: footprint.x + footprint.w, y: 0, z: footprint.z + footprint.d }),
    projectIso({ x: footprint.x, y: 0, z: footprint.z + footprint.d }),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: ((maxX - minX) / 2) * CONTACT_SHADOW_SCALE,
    ry: ((maxY - minY) / 2) * CONTACT_SHADOW_SCALE,
  };
};

const canTilt = () =>
  Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) &&
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const StructuralPortalHero = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  const { faces, groundLines, footEllipses, nodes } = useMemo(() => {
    const faces = buildPortal();
    const footprints: [FootprintBox, FootprintBox] = [footprintOf(0), footprintOf(1)];
    const footEllipses = footprints.map(contactEllipseOf);

    const xMin = Math.min(...footprints.map((f) => f.x)) - GRID_MARGIN;
    const xMax = Math.max(...footprints.map((f) => f.x + f.w)) + GRID_MARGIN;
    const zMin = Math.min(...footprints.map((f) => f.z)) - GRID_MARGIN;
    const zMax = Math.max(...footprints.map((f) => f.z + f.d)) + GRID_MARGIN;

    const groundLines = GRID_INDICES.map((i) => {
      const t = (i + 4) / 8;
      const xAt = xMin + t * (xMax - xMin);
      const zAt = zMin + t * (zMax - zMin);
      return {
        i,
        constX: { p1: projectIso({ x: xAt, y: 0, z: zMin }), p2: projectIso({ x: xAt, y: 0, z: zMax }) },
        constZ: { p1: projectIso({ x: xMin, y: 0, z: zAt }), p2: projectIso({ x: xMax, y: 0, z: zAt }) },
      };
    });

    // Puntos nodales clave proyectados (vértices superiores e inferiores)
    const { span, columnHeight, beamDepth, columnWidth } = DEFAULT_PORTAL;
    const nodes = [
      projectIso({ x: columnWidth / 2, y: columnHeight + beamDepth / 2, z: 0 }),
      projectIso({ x: span - columnWidth / 2, y: columnHeight + beamDepth / 2, z: 0 }),
      projectIso({ x: columnWidth / 2, y: 0, z: 0 }),
      projectIso({ x: span - columnWidth / 2, y: 0, z: 0 }),
    ];

    return { faces, groundLines, footEllipses, nodes };
  }, []);

  useEffect(() => {
    const node = svgRef.current;
    if (!node || !canTilt()) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      node.classList.remove('portal-hero--returning');
      const rect = node.getBoundingClientRect();
      const relX = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      const relY = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * 2 - 1 : 0;
      node.style.setProperty('--tilt-x', String(Math.min(1, Math.max(-1, relX))));
      node.style.setProperty('--tilt-y', String(Math.min(1, Math.max(-1, relY))));
    };

    const handlePointerLeave = () => {
      node.classList.add('portal-hero--returning');
      node.style.setProperty('--tilt-x', '0');
      node.style.setProperty('--tilt-y', '0');
    };

    node.addEventListener('pointermove', handlePointerMove);
    node.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      node.removeEventListener('pointermove', handlePointerMove);
      node.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="portal-hero portal-hero--enhanced"
      viewBox="-90 -190 290 325"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Halo de luz volumétrica suave */}
        <radialGradient id="portal-hero-halo" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--sc-color-action-primary, #059669) 24%, transparent)" />
          <stop offset="50%" stopColor="color-mix(in srgb, var(--sc-color-brand-secondary, #00a3b4) 10%, transparent)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Halo de fondo */}
      <ellipse cx="55" cy="-35" rx="145" ry="115" fill="url(#portal-hero-halo)" className="portal-hero__halo" />

      {/* Suelo cuadriculado proyectado */}
      <g className="portal-hero__ground">
        {groundLines.map(({ i, constX, constZ }) => (
          <g key={i}>
            <line x1={constX.p1.x} y1={constX.p1.y} x2={constX.p2.x} y2={constX.p2.y} />
            <line x1={constZ.p1.x} y1={constZ.p1.y} x2={constZ.p2.x} y2={constZ.p2.y} />
          </g>
        ))}
      </g>

      {/* Sombras de contacto */}
      {footEllipses.map((ellipse, index) => (
        <ellipse
          key={index}
          className="portal-hero__contact"
          cx={ellipse.cx}
          cy={ellipse.cy}
          rx={ellipse.rx}
          ry={ellipse.ry}
        />
      ))}

      {/* Caras del pórtico 3D */}
      {faces.map((face) => (
        <path
          key={face.id}
          className="portal-hero__face"
          d={toPath(face)}
          fill={MATERIAL_TOKEN[face.material]}
          style={{ '--face-shade': formatFixed(face.shade, 3, 'canvas') } as CSSProperties}
        />
      ))}

      {/* Nodos de vértice estructurales activos con resplandor */}
      <g className="portal-hero__nodes">
        {nodes.map((node, index) => (
          <g key={index} transform={`translate(${node.x}, ${node.y})`}>
            <circle r="4.5" className="portal-node-halo" fill="color-mix(in srgb, var(--sc-color-action-primary, #059669) 35%, transparent)" />
            <circle r="2.5" className="portal-node-core" fill="var(--sc-color-action-primary, #059669)" />
          </g>
        ))}
      </g>
    </svg>
  );
};
