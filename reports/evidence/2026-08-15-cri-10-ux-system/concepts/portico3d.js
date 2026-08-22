/* CRI-10 · pórtico 3D clay de la entrada — render material, no sólo geometría.
 *
 * ELECCIÓN DE HERRAMIENTA (por qué NO un motor 3D)
 * ---------------------------------------------------------------------------
 * Se evaluó traer un motor real (three.js / regl / babylon). Se descartó, y no
 * por pereza — por tres razones que se sostienen:
 *
 *   1. `StructuralPortalHero.tsx` ya documenta la decisión en producción: la
 *      escena es estática (cámara ortográfica fija, sin órbita, materiales
 *      mate sin reflejos), así que un motor costaría ~200 KB gzip y una
 *      segunda implementación del mismo dibujo para producir el mismo
 *      fotograma. Meter WebGL aquí contradiría una decisión ya cerrada.
 *   2. El color TIENE que salir de `tokens.css`. Un motor WebGL no lee
 *      variables CSS: habría que duplicar la paleta en JS y se rompería la
 *      regla de paleta única que gobierna todo CRI-10.
 *   3. El pipeline de estas láminas es una captura estática. WebGL en
 *      headless es exactamente donde más frágil se vuelve un render
 *      reproducible.
 *
 * Lo que sí da material de verdad es el stack de filtros SVG, que es un
 * pipeline de sombreado real y corre en el compositor del navegador:
 *
 *   · `feTurbulence` (fractalNoise, semilla fija) → grano de superficie.
 *   · `feDiffuseLighting` + `feDistantLight` → relieve difuso mate: la arcilla
 *     no refleja, difunde. Sin `feSpecularLighting` a propósito — un
 *     especular convertiría el barro en plástico.
 *   · Gradiente de caída por cara → volumen interno, no relleno plano.
 *   · Canto redondeado real (`stroke-linejoin:round` con trazo del propio
 *     color) → la arcilla no tiene aristas vivas.
 *   · Oclusión ambiental en las juntas → las piezas se tocan de verdad.
 *
 * GEOMETRÍA: sin cambios respecto a `src/graphics/isometricPortal.ts`.
 * Misma proyección isométrica 2:1, misma fuente de luz, mismas proporciones de
 * `DEFAULT_PORTAL`, mismo Lambert con suelo ambiental. Los tres shades que
 * emite siguen siendo 0.8345 / 0.7027 / 0.5840, verificados. Lo que cambió es
 * el RENDER, no el álgebra.
 */

const ISO_X = Math.cos(Math.PI / 6);
const ISO_Y = Math.sin(Math.PI / 6);

const projectIso = (v) => ({
  x: (v.x - v.z) * ISO_X,
  y: (v.x + v.z) * ISO_Y - v.y,
});

const DEFAULT_PORTAL = {
  columnWidth: 22, columnHeight: 116, columnDepth: 22,
  beamHeight: 26, beamModules: 4,
  baseWidth: 40, baseHeight: 14, span: 150,
};

const LIGHT = (() => {
  const raw = { x: 0.37, y: 0.75, z: 0.55 };
  const length = Math.hypot(raw.x, raw.y, raw.z);
  return { x: raw.x / length, y: raw.y / length, z: raw.z / length };
})();

const NORMALS = {
  top: { x: 0, y: 1, z: 0 },
  left: { x: 0, y: 0, z: 1 },
  right: { x: 1, y: 0, z: 0 },
};

const AMBIENT = 0.34;
const shadeOf = (normal) => {
  const lambert = normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z;
  return Math.min(1, Math.max(0, AMBIENT + (1 - AMBIENT) * Math.max(0, lambert)));
};

const boxFaces = (id, material, box) => {
  const { x, y, z, w, h, d } = box;
  const corner = (dx, dy, dz) => projectIso({ x: x + dx, y: y + dy, z: z + dz });
  const depth = x + y + z + (w + h + d) / 2;
  return [
    { id: `${id}:top`, material, kind: 'top', shade: shadeOf(NORMALS.top), depth, points: [corner(0, h, 0), corner(w, h, 0), corner(w, h, d), corner(0, h, d)] },
    { id: `${id}:left`, material, kind: 'left', shade: shadeOf(NORMALS.left), depth, points: [corner(0, h, d), corner(w, h, d), corner(w, 0, d), corner(0, 0, d)] },
    { id: `${id}:right`, material, kind: 'right', shade: shadeOf(NORMALS.right), depth, points: [corner(w, h, 0), corner(w, 0, 0), corner(w, 0, d), corner(w, h, d)] },
  ];
};

const buildPortal = (dims = DEFAULT_PORTAL) => {
  const { columnWidth: cw, columnHeight: ch, columnDepth: cd, beamHeight: bh, beamModules, baseWidth: bw, baseHeight: bhh, span } = dims;
  const faces = [];
  const columnX = [0, span - cw];
  const centreOffset = (bw - cw) / 2;
  for (const [index, x] of columnX.entries()) {
    const side = index === 0 ? 'l' : 'r';
    faces.push(...boxFaces(`base-${side}-lower`, 'base', { x: x - centreOffset, y: 0, z: -centreOffset, w: bw, h: bhh, d: bw }));
    faces.push(...boxFaces(`base-${side}-upper`, 'base', { x: x - centreOffset / 2, y: bhh, z: -centreOffset / 2, w: cw + centreOffset, h: bhh * 0.7, d: cd + centreOffset }));
    const columnBase = bhh + bhh * 0.7;
    faces.push(...boxFaces(`column-${side}`, 'column', { x, y: columnBase, z: 0, w: cw, h: ch, d: cd }));
    faces.push(...boxFaces(`capital-${side}`, 'capital', { x: x - 2, y: columnBase + ch, z: -2, w: cw + 4, h: 5, d: cd + 4 }));
  }
  const beamY = bhh + bhh * 0.7 + ch + 5;
  const beamGap = 1.5;
  const moduleWidth = (span - beamGap * (beamModules - 1)) / beamModules;
  for (let i = 0; i < beamModules; i += 1) {
    faces.push(...boxFaces(`beam:${i}`, 'beam', { x: i * (moduleWidth + beamGap), y: beamY, z: 0, w: moduleWidth, h: bh, d: cd }));
  }
  return faces.sort((a, b) => a.depth - b.depth);
};

const MATERIAL_TOKEN = {
  column: 'var(--sc-color-clay-ivory)',
  beam: 'var(--sc-color-clay-lime)',
  base: 'var(--sc-color-clay-lime-deep)',
  capital: 'var(--sc-color-clay-ivory-deep)',
};

const GRID_INDICES = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const GRID_MARGIN = 20;
const CONTACT_SHADOW_SCALE = 0.75;

const footprintOf = (columnIndex) => {
  const { baseWidth, columnWidth, span } = DEFAULT_PORTAL;
  const centreOffset = (baseWidth - columnWidth) / 2;
  const columnX = [0, span - columnWidth];
  return { x: columnX[columnIndex] - centreOffset, z: -centreOffset, w: baseWidth, d: baseWidth };
};

const contactEllipseOf = (footprint) => {
  const corners = [
    projectIso({ x: footprint.x, y: 0, z: footprint.z }),
    projectIso({ x: footprint.x + footprint.w, y: 0, z: footprint.z }),
    projectIso({ x: footprint.x + footprint.w, y: 0, z: footprint.z + footprint.d }),
    projectIso({ x: footprint.x, y: 0, z: footprint.z + footprint.d }),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  return {
    cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
    rx: ((maxX - minX) / 2) * CONTACT_SHADOW_SCALE,
    ry: ((maxY - minY) / 2) * CONTACT_SHADOW_SCALE,
  };
};

const toPath = (face) => `${face.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')} Z`;

/** Junta entre dos piezas apiladas: la elipse proyectada de la sección
 *  horizontal a la altura `y`, usada para la oclusión ambiental. Una pieza
 *  apoyada sobre otra ensombrece el borde de la de abajo — sin esto las cajas
 *  se ven pegadas con pegamento, no apoyadas. */
const jointEllipseAt = (x, z, w, d, y) => {
  const corners = [
    projectIso({ x, y, z }), projectIso({ x: x + w, y, z }),
    projectIso({ x: x + w, y, z: z + d }), projectIso({ x, y, z: z + d }),
  ];
  const xs = corners.map((p) => p.x); const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
};

/* Contador de instancia: cada `<svg>` lleva sus propios `<defs>`, y dos
   láminas en la misma página compartirían los ids del filtro. Con sufijo
   único, el grano de una no puede aplicarse a la otra. */
let instance = 0;

/**
 * Devuelve el `<svg>` del pórtico clay como string.
 * @param extraClass clases adicionales para el `<svg>`.
 * @param grain      intensidad del grano de superficie (0 = liso).
 */
export const porticoHero = (extraClass = '', { grain = 0.07 } = {}) => {
  instance += 1;
  const uid = `p3d${instance}`;
  const faces = buildPortal();
  const { columnWidth: cw, columnDepth: cd, baseWidth: bw, baseHeight: bhh, columnHeight: ch, span } = DEFAULT_PORTAL;

  const footprints = [footprintOf(0), footprintOf(1)];
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
      constX: { p1: projectIso({ x: xAt, y: 0, z: zMin }), p2: projectIso({ x: xAt, y: 0, z: zMax }) },
      constZ: { p1: projectIso({ x: xMin, y: 0, z: zAt }), p2: projectIso({ x: xMax, y: 0, z: zAt }) },
    };
  });

  const groundSvg = groundLines.map(({ constX, constZ }) => `
    <line x1="${constX.p1.x.toFixed(2)}" y1="${constX.p1.y.toFixed(2)}" x2="${constX.p2.x.toFixed(2)}" y2="${constX.p2.y.toFixed(2)}"/>
    <line x1="${constZ.p1.x.toFixed(2)}" y1="${constZ.p1.y.toFixed(2)}" x2="${constZ.p2.x.toFixed(2)}" y2="${constZ.p2.y.toFixed(2)}"/>`).join('');

  const contactSvg = footEllipses.map((e) => `<ellipse class="p3d__contact" cx="${e.cx.toFixed(2)}" cy="${e.cy.toFixed(2)}" rx="${e.rx.toFixed(2)}" ry="${e.ry.toFixed(2)}"/>`).join('');

  /* OCLUSIÓN AMBIENTAL EN LA JUNTA — y por qué va INTERCALADA, no al final.
     La sombra de una columna sobre su zapata tiene que pintarse DESPUÉS de la
     zapata y ANTES de la columna. Emitida al final, sobre todo lo demás, la
     elipse cae encima del fuste y deja un manchón gris a media altura (fallo
     real de la primera versión de esta pasada, visible en el render). Aquí se
     inyecta en el flujo de pintura justo antes de la primera cara de cada
     columna: la mitad que cae sobre la zapata se ve, y la mitad que caería
     sobre el fuste queda tapada por el propio fuste — que es exactamente cómo
     se comporta una oclusión de contacto real. */
  const columnBaseY = bhh + bhh * 0.7;
  const aoAtColumnFoot = (side) => {
    const x = side === 'l' ? 0 : span - cw;
    const e = jointEllipseAt(x, 0, cw, cd, columnBaseY);
    return `<ellipse class="p3d__ao" cx="${e.cx.toFixed(2)}" cy="${e.cy.toFixed(2)}" rx="${(e.rx * 1.5).toFixed(2)}" ry="${(e.ry * 1.5).toFixed(2)}"/>`;
  };

  /* Cada cara: relleno de material + canto redondeado (trazo del propio color,
     `linejoin:round`) + una segunda capa con el gradiente de caída, que es lo
     que impide que la cara se lea como un polígono plano. */
  const emittedAo = new Set();
  const facesSvg = faces.map((face) => {
    const d = toPath(face);
    let prefix = '';
    const columnStart = /^column-(l|r):top$/.exec(face.id);
    if (columnStart && !emittedAo.has(columnStart[1])) {
      emittedAo.add(columnStart[1]);
      prefix = aoAtColumnFoot(columnStart[1]);
    }
    return `${prefix}<path class="p3d__face" d="${d}" fill="${MATERIAL_TOKEN[face.material]}" stroke="${MATERIAL_TOKEN[face.material]}" style="--face-shade:${face.shade.toFixed(3)}"/>
      <path class="p3d__falloff p3d__falloff--${face.kind}" d="${d}" fill="url(#${uid}-fall-${face.kind})"/>`;
  }).join('');

  /* Luz de canto sobre el dintel: la arista superior que da a la luz. Es una
     línea, no un halo — el brillo vive EN el canto, no alrededor de la pieza. */
  const beamTopY = columnBaseY + ch + 5 + DEFAULT_PORTAL.beamHeight;
  const rimA = projectIso({ x: 0, y: beamTopY, z: cd });
  const rimB = projectIso({ x: span, y: beamTopY, z: cd });
  const rimSvg = `<line class="p3d__rim" x1="${rimA.x.toFixed(2)}" y1="${rimA.y.toFixed(2)}" x2="${rimB.x.toFixed(2)}" y2="${rimB.y.toFixed(2)}"/>`;

  return `<svg class="p3d ${extraClass}" viewBox="-96 -196 302 338" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pórtico de dos crujías en vista isométrica, materiales de arcilla" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Caída de luz DENTRO de cada cara, por orientación. Sin esto cada cara
         es un color plano y el objeto se lee como papel recortado. -->
    <linearGradient id="${uid}-fall-top" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.12"/>
    </linearGradient>
    <linearGradient id="${uid}-fall-left" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.24"/>
    </linearGradient>
    <linearGradient id="${uid}-fall-right" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.32"/>
    </linearGradient>

    <!-- MATERIAL ARCILLA. Dos pasos y ninguno decorativo:
         1. feTurbulence + feDiffuseLighting = relieve mate real. Difuso,
            nunca especular: la arcilla difunde la luz, el plastico la refleja.
         2. El relieve se mezcla en overlay a baja opacidad y se recorta al
            alfa de la figura, asi el grano vive DENTRO de la pieza y no la
            desborda ni le cambia el color. -->
    <filter id="${uid}-clay" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="3" seed="17" result="noise"/>
      <feDiffuseLighting in="noise" lighting-color="#ffffff" surfaceScale="1.05" diffuseConstant="1" result="bump">
        <feDistantLight azimuth="225" elevation="58"/>
      </feDiffuseLighting>
      <feColorMatrix in="bump" type="saturate" values="0" result="bumpGrey"/>
      <feComponentTransfer in="bumpGrey" result="bumpSoft">
        <feFuncA type="linear" slope="${grain}" intercept="0"/>
      </feComponentTransfer>
      <feComposite in="bumpSoft" in2="SourceGraphic" operator="in" result="bumpClipped"/>
      <feBlend in="SourceGraphic" in2="bumpClipped" mode="overlay"/>
    </filter>
  </defs>

  <g class="p3d__ground">${groundSvg}</g>
  ${contactSvg}

  <g filter="url(#${uid}-clay)">
    ${facesSvg}
  </g>

  ${rimSvg}
</svg>`;
};
