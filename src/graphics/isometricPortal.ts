/**
 * Geometría del pórtico clay de la bienvenida.
 *
 * Es aritmética, no dibujo: define el pórtico en coordenadas de mundo y lo
 * proyecta a 2D con una matriz isométrica, devolviendo caras ya ordenadas por
 * profundidad y ya sombreadas contra una única fuente de luz. El componente
 * que lo consume sólo pinta.
 *
 * Esa frontera es lo que permite testear la figura con asserts numéricos en
 * jsdom, sin render y sin WebGL — y lo que permitiría sustituir el motor de
 * pintura sin volver a derivar la geometría.
 *
 * La luz parte de la misma fuente que la materia clay (arriba-izquierda, a
 * 145° en `tokens.css`), pero al proyectarla aquí con `projectIso` no cae en
 * el mismo ángulo: medida en convención `linear-gradient`, la del pórtico
 * queda a ~151,7° — mismo cuadrante, ~6,7° de diferencia por la proyección
 * isométrica. Si la luz de `tokens.css` cambia, revisa también `LIGHT` más
 * abajo.
 */

export interface Vec3 { x: number; y: number; z: number }
export interface Point2 { x: number; y: number }

export type MaterialId = 'column' | 'beam' | 'base' | 'capital';

export interface Face {
  id: string;
  material: MaterialId;
  points: Point2[];
  /** 0 = cara en sombra, 1 = cara de cara a la luz. */
  shade: number;
  /** Mayor = más cerca del observador. */
  depth: number;
}

export interface PortalDimensions {
  columnWidth: number;
  columnHeight: number;
  columnDepth: number;
  beamHeight: number;
  beamModules: number;
  baseWidth: number;
  baseHeight: number;
  span: number;
}

/**
 * Proporciones del pórtico (CRI-112).
 *
 * El dibujo anterior era ancho y achaparrado porque vivía a 208 px de ancho:
 * a ese tamaño una figura esbelta se lee como un palito. Al pasar la pieza a
 * ~460 px la relación se invierte —lo achaparrado se lee como pesado— así que
 * la figura se redibuja para el tamaño en el que ahora vive: columnas más
 * finas y bastante más altas, dintel más bajo y con más módulos, y un vano
 * mayor. El resultado tiene proporción de pórtico real y deja ver el suelo
 * entre las patas, que es lo que lo apoya en la mesa en vez de flotar.
 *
 * Ninguna de estas cifras está codificada en otro sitio: `buildPortal` es
 * paramétrico y el encuadre del SVG se deriva del bounding box real, así que
 * cambiar proporciones aquí no obliga a tocar el componente.
 */
export const DEFAULT_PORTAL: PortalDimensions = {
  columnWidth: 18,
  columnHeight: 150,
  columnDepth: 18,
  /* `beamHeight` 21 → 15 (ajuste final CRI-112): el lima cubre dintel y
     zapatas, y a la escala nueva (~430 px de ancho) un dintel del mismo
     grosor de antes lee como más masa verde de la que la figura necesita. No
     es un cambio de color — es la misma primitiva `beamHeight` que ya existía,
     sólo con otro valor —, así que ni un HEX ni un token se tocan. */
  beamHeight: 15,
  beamModules: 6,
  baseWidth: 34,
  baseHeight: 11,
  span: 178,
};

/**
 * Isométrica clásica 2:1. `y` del mundo sube; en pantalla, baja. `depth` (ver
 * `boxFaces`) sitúa al observador en el octante +x/+y/+z: `+x` proyecta hacia
 * la derecha de pantalla, `+z` hacia la izquierda — así lo espera todo lo que
 * usa esta proyección, `buildPortal` incluido, así que el signo vive aquí y
 * en ningún otro sitio.
 */
const ISO_X = Math.cos(Math.PI / 6);
const ISO_Y = Math.sin(Math.PI / 6);

export const projectIso = (v: Vec3): Point2 => ({
  x: (v.x - v.z) * ISO_X,
  y: (v.x + v.z) * ISO_Y - v.y,
});

/**
 * Luz normalizada, en el octante +x/+y/+z que de verdad ve la cámara (ver
 * `boxFaces`). Sigue entrando por arriba-izquierda de PANTALLA — su
 * proyección vía `projectIso` cae en (x negativo, y negativo), es decir
 * `projectIso(LIGHT) ≈ (-0,1559, -0,2900)`, que en convención
 * `linear-gradient` es ~151,7°: mismo cuadrante que los 145° de la materia
 * clay en `tokens.css`, pero no el mismo ángulo — la proyección isométrica
 * lo desvía ~6,7°.
 */
const LIGHT: Vec3 = (() => {
  const raw = { x: 0.37, y: 0.75, z: 0.55 };
  const length = Math.hypot(raw.x, raw.y, raw.z);
  return { x: raw.x / length, y: raw.y / length, z: raw.z / length };
})();

/**
 * Normales de las tres caras visibles desde el octante +x/+y/+z. `left` y
 * `right` nombran dónde cae la cara EN PANTALLA, no el eje de mundo: con
 * `projectIso` proyectando `screen.x = (x - z) * ISO_X`, la cara `+z` queda a
 * la izquierda y la cara `+x` a la derecha. Lo que sí fija
 * `isometricPortal.test.ts` es que `+x` cae a la derecha de pantalla (test
 * "is parametric: a wider span moves the right column right") y que las tres
 * caras no se solapan ni dejan huecos entre sí; el test "mirrors x and z
 * horizontally" sólo asserta `a.x ≈ -b.x`, simétrico en signo, y no
 * distingue por sí solo la etiqueta `left` de la `right` — ningún test lo
 * hace directamente.
 */
const NORMALS: Record<'top' | 'left' | 'right', Vec3> = {
  top: { x: 0, y: 1, z: 0 },
  left: { x: 0, y: 0, z: 1 },
  right: { x: 1, y: 0, z: 0 },
};

/**
 * Lambert con un suelo ambiental. Sin el suelo, la cara derecha cae a negro y
 * el objeto deja de leerse como una pieza de un solo material.
 */
const AMBIENT = 0.34;
const shadeOf = (normal: Vec3) => {
  const lambert = normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z;
  return Math.min(1, Math.max(0, AMBIENT + (1 - AMBIENT) * Math.max(0, lambert)));
};

interface Box { x: number; y: number; z: number; w: number; h: number; d: number }

/**
 * Emite las tres caras visibles de una caja desde el octante +x/+y/+z (la
 * cámara que implica `depth`, ver más abajo): `+y` (top), `+z` (left) y `+x`
 * (right). Las otras tres (−x, −y, −z) quedan fuera: en isométrica sin
 * transparencia nunca se ven, y emitirlas duplicaría el número de `<path>`
 * del SVG sin cambiar un píxel — pero emitir la trasera EN LUGAR de la
 * delantera sí cambia píxeles (y mal): por eso `right` usa `dx = w`, no
 * `dx = 0`. El orden de vértices de cada cara está elegido para que las tres
 * giren en el mismo sentido en pantalla y para que no se solapen ni dejen
 * huecos entre sí — ambas cosas las comprueba `isometricPortal.test.ts`.
 */
const boxFaces = (id: string, material: MaterialId, box: Box): Face[] => {
  const { x, y, z, w, h, d } = box;
  const corner = (dx: number, dy: number, dz: number) => projectIso({ x: x + dx, y: y + dy, z: z + dz });
  const depth = x + y + z + (w + h + d) / 2;

  return [
    {
      id: `${id}:top`,
      material,
      shade: shadeOf(NORMALS.top),
      depth,
      points: [corner(0, h, 0), corner(w, h, 0), corner(w, h, d), corner(0, h, d)],
    },
    {
      id: `${id}:left`,
      material,
      shade: shadeOf(NORMALS.left),
      depth,
      points: [corner(0, h, d), corner(w, h, d), corner(w, 0, d), corner(0, 0, d)],
    },
    {
      id: `${id}:right`,
      material,
      shade: shadeOf(NORMALS.right),
      depth,
      points: [corner(w, h, 0), corner(w, 0, 0), corner(w, 0, d), corner(w, h, d)],
    },
  ];
};

export const buildPortal = (dims: PortalDimensions = DEFAULT_PORTAL): Face[] => {
  const { columnWidth: cw, columnHeight: ch, columnDepth: cd, beamHeight: bh, beamModules, baseWidth: bw, baseHeight: bhh, span } = dims;
  const faces: Face[] = [];

  /* Dos columnas. `span` es la distancia entre sus caras exteriores. */
  const columnX = [0, span - cw];
  const centreOffset = (bw - cw) / 2;

  for (const [index, x] of columnX.entries()) {
    const side = index === 0 ? 'l' : 'r';

    /* Base: dos cajas apiladas, la de abajo más ancha. */
    faces.push(...boxFaces(`base-${side}-lower`, 'base', {
      x: x - centreOffset, y: 0, z: -centreOffset, w: bw, h: bhh, d: bw,
    }));
    faces.push(...boxFaces(`base-${side}-upper`, 'base', {
      x: x - centreOffset / 2, y: bhh, z: -centreOffset / 2,
      w: cw + centreOffset, h: bhh * 0.7, d: cd + centreOffset,
    }));

    const columnBase = bhh + bhh * 0.7;
    faces.push(...boxFaces(`column-${side}`, 'column', {
      x, y: columnBase, z: 0, w: cw, h: ch, d: cd,
    }));

    /* Capitel: un escalón muy leve entre columna y dintel. */
    faces.push(...boxFaces(`capital-${side}`, 'capital', {
      x: x - 2, y: columnBase + ch, z: -2, w: cw + 4, h: 5, d: cd + 4,
    }));
  }

  /* Dintel dividido en módulos. Se emiten como cajas independientes para que
     la junta entre módulos exista de verdad y no sea una línea pintada. La
     junta de 1.5 es SÓLO interior, entre módulos: el primero arranca a ras
     de la columna izquierda (x=0) y el último termina a ras de la columna
     derecha (x=span), sin comerse 1.5 del borde exterior. */
  const beamY = bhh + bhh * 0.7 + ch + 5;
  const beamGap = 1.5;
  const moduleWidth = (span - beamGap * (beamModules - 1)) / beamModules;
  for (let i = 0; i < beamModules; i += 1) {
    faces.push(...boxFaces(`beam:${i}`, 'beam', {
      x: i * (moduleWidth + beamGap), y: beamY, z: 0, w: moduleWidth, h: bh, d: cd,
    }));
  }

  /* Pintor: de atrás hacia delante. Es el orden en el que hay que dibujarlas. */
  return faces.sort((a, b) => a.depth - b.depth);
};
