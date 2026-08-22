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
 * y lima en Día, y gris cálido y la misma lima en Noche, sin una sola rama
 * condicional. La lima del pórtico es idéntica en ambos temas —es el relleno
 * de marca, no un trazo— y sólo cambian el marfil y su sombreado.
 *
 * Decorativo a efectos de accesibilidad. Todo lo que comunica está en el texto
 * que la acompaña.
 *
 * ACABADO CLAY (CRI-104). El grano y la luz de borde son UN filtro SVG, y vive
 * exclusivamente dentro de este `<svg>`: no se aplica a ninguna superficie de
 * interfaz, que es lo que hace asumible su coste. Se engancha desde CSS
 * (`.portal-hero__body { filter: url(#…) }`), no con el atributo `filter`, y
 * eso da las tres degradaciones que el contrato exige sin una línea de
 * JavaScript:
 *
 * - `prefers-reduced-motion` o `prefers-reduced-transparency` → una media
 *   query pone `filter: none` y queda el relleno plano por caras.
 * - Navegador sin filtros SVG vía CSS → la declaración es inválida y se
 *   descarta, con el mismo resultado plano.
 *
 * En los tres casos la figura conserva su caja, su geometría y su sombreado
 * por cara: no se pierde espacio ni se rompe la composición, porque el filtro
 * siempre fue aditivo sobre un dibujo que ya estaba completo.
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
  beam: 'var(--sc-color-clay-lime)',
  base: 'var(--sc-color-clay-lime-deep)',
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

/**
 * Id del filtro. Fijo y con prefijo del sistema: sólo hay una pieza clay en la
 * bienvenida, así que no hay colisión posible, y el CSS necesita poder
 * nombrarlo (`filter: url(#sc-portal-clay)`) para poder anularlo.
 */
const PORTAL_FILTER_ID = 'sc-portal-clay';

export const StructuralPortalHero = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  const { faces, groundLines, footEllipses, viewBox } = useMemo(() => {
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

    /* Encuadre derivado, no copiado de un boceto (CRI-112). Antes el
       `viewBox` era una constante escrita a mano, así que cambiar las
       proporciones del pórtico lo descuadraba en silencio. Ahora sale del
       bounding box real de todo lo que se pinta —caras, rejilla y elipses de
       contacto— más un margen proporcional, de modo que la geometría puede
       redibujarse sin volver a tocar este componente. */
    const xs: number[] = [];
    const ys: number[] = [];
    for (const face of faces) for (const p of face.points) { xs.push(p.x); ys.push(p.y); }
    for (const { constX, constZ } of groundLines) {
      for (const p of [constX.p1, constX.p2, constZ.p1, constZ.p2]) { xs.push(p.x); ys.push(p.y); }
    }
    for (const e of footEllipses) { xs.push(e.cx - e.rx, e.cx + e.rx); ys.push(e.cy - e.ry, e.cy + e.ry); }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    /* El margen absorbe el desenfoque de la sombra de contacto y la luz de
       borde del filtro, que se salen del polígono. */
    const pad = Math.max(maxX - minX, maxY - minY) * 0.06;
    /* `formatFixed`, no `toFixed` crudo: la política numérica única
       (`numericPolicy.test.ts`) cubre todo `features/**`, y el encuadre de un
       SVG decorativo no es una excepción. */
    const viewBox = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2]
      .map((value) => formatFixed(value, 2, 'canvas'))
      .join(' ');

    return { faces, groundLines, footEllipses, viewBox };
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
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Un solo filtro, con región acotada al propio dibujo: grano fino
            recortado a la silueta y una luz de borde de un píxel obtenida del
            contorno erosionado. `flood-color` sale de un token vía CSS
            (`.portal-hero__rim`), nunca de un literal. */}
        <filter
          id={PORTAL_FILTER_ID}
          x="-4%"
          y="-4%"
          width="108%"
          height="108%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" result="noiseFlat" />
          <feComponentTransfer in="noiseFlat" result="grain">
            <feFuncA type="table" tableValues="0 0.13" />
          </feComponentTransfer>
          <feComposite in="grain" in2="SourceAlpha" operator="in" result="grainInside" />
          <feBlend in="SourceGraphic" in2="grainInside" mode="overlay" result="grained" />

          <feMorphology in="SourceAlpha" operator="erode" radius="0.9" result="core" />
          <feComposite in="SourceAlpha" in2="core" operator="out" result="rimMask" />
          <feFlood className="portal-hero__rim" result="rimInk" />
          <feComposite in="rimInk" in2="rimMask" operator="in" result="rim" />
          <feComposite in="rim" in2="grained" operator="over" />
        </filter>
      </defs>

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

      {/* El cuerpo sólido es lo único que recibe el acabado clay. La rejilla y
          las sombras de contacto quedan fuera del filtro: son el plano, no la
          pieza, y filtrarlas sólo añadiría coste. */}
      <g className="portal-hero__body">
        {faces.map((face) => (
          <path
            key={face.id}
            className="portal-hero__face"
            d={toPath(face)}
            fill={MATERIAL_TOKEN[face.material]}
            style={{ '--face-shade': formatFixed(face.shade, 3, 'canvas') } as CSSProperties}
          />
        ))}
      </g>
    </svg>
  );
};
