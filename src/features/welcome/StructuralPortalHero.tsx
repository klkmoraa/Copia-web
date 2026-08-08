import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { buildPortal, projectIso, DEFAULT_PORTAL, type Face, type MaterialId } from '../../graphics/isometricPortal';
import { formatFixed } from '../../utils/numberFormat';

/**
 * Pórtico clay de la bienvenida.
 *
 * Pinta la geometría que `isometricPortal.ts` deriva. No hay WebGL: la escena
 * de la referencia es estática —cámara ortográfica fija, sin órbita, materiales
 * mate sin reflejos— así que un motor 3D costaría ~200 KB gzip y una segunda
 * implementación del mismo dibujo para producir el mismo fotograma. Aquí no
 * hay nada que pueda fallar, y por eso tampoco hay fallback que mantener.
 *
 * El color sale de tokens, nunca de literales: los mismos `<path>` dan marfil
 * y verde menta en Día, y gris cálido y verde luminoso en Noche, sin una sola
 * rama condicional.
 *
 * Decorativo a efectos de accesibilidad. Todo lo que comunica está en el texto
 * del hero y en los tres chips de confianza.
 *
 * `viewBox` y rejilla de suelo: calculados a partir del bounding box real de
 * `buildPortal()`, no copiados de un boceto. `buildPortal()` proyecta con
 * `+x` hacia la derecha de pantalla y `+z` hacia la izquierda (fijado en la
 * tarea 4); un encuadre calculado a mano para la orientación previa habría
 * dejado la figura descentrada o cortada.
 */

/** Token base de cada material. El sombreado modula su luminosidad en CSS. */
const MATERIAL_TOKEN: Record<MaterialId, string> = {
  column: 'var(--sc-color-clay-ivory)',
  beam: 'var(--sc-color-clay-mint)',
  base: 'var(--sc-color-clay-mint-deep)',
  capital: 'var(--sc-color-clay-ivory-deep)',
};

/* `formatFixed`, no `toFixed` crudo: la política numérica única (ver
   `numberFormat.ts`) la impone `numericPolicy.test.ts` sobre todo `features/**`,
   coordenadas de un `<path>` decorativo incluidas. */
const toPath = (face: Face) =>
  `${face.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${formatFixed(p.x, 2, 'canvas')} ${formatFixed(p.y, 2, 'canvas')}`)
    .join(' ')} Z`;

/**
 * Rejilla del suelo: 9 líneas por eje (i de -4 a 4), igual densidad que el
 * boceto original, pero proyectadas en vivo con `projectIso` sobre un
 * rectángulo de mundo que rodea la huella real de las bases (más
 * `GRID_MARGIN`). Nada de coeficientes escritos a mano: si `ISO_X`/`ISO_Y`,
 * el signo de la proyección o la geometría del pórtico cambian en
 * `isometricPortal.ts`, la rejilla se recalcula sola en vez de quedar
 * desincronizada en silencio.
 */
const GRID_INDICES = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

/** Margen, en unidades de mundo, alrededor de la huella de las bases para la
 * rejilla de suelo — el plano se ve más grande que el objeto que sostiene. */
const GRID_MARGIN = 20;

/** Fracción del bounding-box en pantalla de cada pie que cubre su sombra de
 * contacto. Elegida por muestreo Monte Carlo (4000 puntos) contra las 4
 * esquinas proyectadas de cada pie: s=0.75 cubre el 85% del pie con sólo 3%
 * de fuga fuera de él (s=0.65 → 67%/0%, s=0.85 → 95%/16%, s=1.00 → 100%/36%).
 * Detalle completo en el informe de la ronda de corrección 1/5. */
const CONTACT_SHADOW_SCALE = 0.75;

interface FootprintBox { x: number; z: number; w: number; d: number }

/** Huella en planta (y=0) de la base de una columna, con las mismas fórmulas
 * (`centreOffset`, `columnX`) que `buildPortal` usa para colocar la caja
 * `base-*-lower` — no números sueltos. */
const footprintOf = (columnIndex: 0 | 1): FootprintBox => {
  const { baseWidth, columnWidth, span } = DEFAULT_PORTAL;
  const centreOffset = (baseWidth - columnWidth) / 2;
  const columnX = [0, span - columnWidth];
  return { x: columnX[columnIndex] - centreOffset, z: -centreOffset, w: baseWidth, d: baseWidth };
};

/** Proyecta las 4 esquinas de una huella y devuelve la elipse de sombra de
 * contacto que ajusta `CONTACT_SHADOW_SCALE` a su bounding-box en pantalla. */
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

/** Umbral bajo el cual no se registra ningún listener de puntero: sin hover
 * fino (táctil) o con `prefers-reduced-motion`, la inclinación no debe
 * costar nada ni animarse nunca. */
const canTilt = () =>
  Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) &&
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const StructuralPortalHero = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  const { faces, groundLines, footEllipses } = useMemo(() => {
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

    return { faces, groundLines, footEllipses };
  }, []);

  /* Inclinación con el puntero: sin `setState`, cero re-render de React por
     movimiento. Se escribe directamente en `node.style` vía la ref. Nunca se
     registra un listener en táctil ni con `prefers-reduced-motion`, y el
     `return` del efecto limpia ambos al desmontar.

     La clase `portal-hero--returning` es lo único que decide si `transform`
     tiene transición (ver `styles.css`): fuera mientras el puntero se mueve
     —el pórtico debe seguir al cursor 1:1, sin persecución con retardo—,
     puesta sólo en el instante de `pointerleave` para que el regreso a cero
     se vea suave. */
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
      className="portal-hero"
      viewBox="-90 -190 290 325"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Suelo cuadriculado. Una rejilla, no una textura: sitúa el objeto en un
          plano sin competir con él. */}
      <g className="portal-hero__ground">
        {groundLines.map(({ i, constX, constZ }) => (
          <g key={i}>
            <line x1={constX.p1.x} y1={constX.p1.y} x2={constX.p2.x} y2={constX.p2.y} />
            <line x1={constZ.p1.x} y1={constZ.p1.y} x2={constZ.p2.x} y2={constZ.p2.y} />
          </g>
        ))}
      </g>

      {/* Sombra de contacto: una elipse difuminada por pie, no una bajo todo
          el pórtico — las dos zapatas están separadas por el vano y una sola
          sombra caería en el hueco entre ambas. */}
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

      {faces.map((face) => (
        <path
          key={face.id}
          className="portal-hero__face"
          d={toPath(face)}
          fill={MATERIAL_TOKEN[face.material]}
          style={{ '--face-shade': formatFixed(face.shade, 3, 'canvas') } as CSSProperties}
        />
      ))}
    </svg>
  );
};
