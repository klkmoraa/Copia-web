import type { SupportGlyphName } from './supportCatalog';

/**
 * El símbolo del apoyo, en miniatura.
 *
 * POR QUÉ NO ES UN ICONO DE LA LIBRERÍA. La tarjeta y el lienzo tienen que
 * enseñar **la misma pieza**: si el selector dibuja un triángulo genérico y el
 * modelo dibuja un rodillo con dos ruedas y su placa rayada, el usuario aprende
 * dos vocabularios para una sola cosa. Las coordenadas de los cinco tipos base
 * son las de `CanvasGeometryLayer`, a la misma escala y con el nudo en el
 * origen; lo único que cambia es el encuadre.
 *
 * EL GIRO ES DATO EN UN SITIO Y DIBUJO EN OTRO. Un rodillo se dibuja girado
 * `angleDeg - 90` porque el ángulo *es* la dirección restringida: el preset
 * «Muro» tiene que verse tumbado antes de pulsarlo. Un articulado o un
 * empotramiento también giran, pero ahí el giro es sólo presentación y el
 * solver monta las mismas ecuaciones; el panel de detalle lo dice con esas
 * palabras para que nadie espere una reacción distinta.
 *
 * EL ENCUADRE, Y POR QUÉ NO BASTA CON GIRAR. El apoyo cuelga **por debajo** del
 * nudo, así que girarlo alrededor del nudo lo saca de la caja: a 45° la placa
 * rayada se salía de la tarjeta y a 0° se comía a la vecina. Cada símbolo
 * declara su centro (`CENTER_Y`, sobre el eje del dibujo) y el grupo se
 * recoloca por el centro **ya girado**, así que la pieza queda centrada en
 * cualquier ángulo sin cambiar de tamaño ni mentir sobre dónde está el nudo. El
 * `viewBox` es cuadrado por lo mismo: alto y ancho tienen que dar de sí igual
 * porque cualquiera de los dos puede tocarle al giro.
 */

/** Mitad del lado del encuadre. Cubre el radio del símbolo más largo —el
 *  rodillo, con su placa— medido desde su propio centro, más el trazo. */
const HALF_BOX = 28;

const HATCH_X = [-12, -6, 0, 6, 12] as const;

const Hatch = ({ y, dy = 6 }: { y: number; dy?: number }) => (
  <>
    {HATCH_X.map((x) => (
      <line key={x} x1={x} y1={y} x2={x - 5} y2={y + dy} strokeWidth="1.4" strokeLinecap="round" />
    ))}
  </>
);

/** Placa rayada completa: el canto más su tramado. Es «el terreno». */
const Ground = ({ y, width = 17 }: { y: number; width?: number }) => (
  <>
    <line x1={-width} y1={y} x2={width} y2={y} className="support-glyph__plate" strokeWidth="2" strokeLinecap="round" />
    <Hatch y={y} dy={5} />
  </>
);

const Node = () => <circle cx="0" cy="0" r="2.6" className="support-glyph__node" />;

/** Muelle helicoidal en vertical, de `y0` a `y1`, con `turns` vueltas. */
const Coil = ({ y0, y1, turns = 4, width = 6 }: { y0: number; y1: number; turns?: number; width?: number }) => {
  const step = (y1 - y0) / (turns * 2);
  const points = [`M0 ${y0}`];
  for (let index = 0; index < turns * 2; index += 1) {
    const x = index % 2 === 0 ? -width : width;
    points.push(`L${x} ${y0 + step * (index + 0.5)}`);
  }
  points.push(`L0 ${y1}`);
  return <path d={points.join(' ')} fill="none" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />;
};

const Free = () => (
  <g>
    <circle cx="0" cy="4" r="10" className="support-glyph__halo" strokeWidth="1.4" strokeDasharray="3 3" fill="none" />
    <circle cx="0" cy="4" r="2.8" className="support-glyph__node" />
  </g>
);

const Pin = () => (
  <g>
    <polygon points="0,0 -12,18 12,18" className="support-glyph__body" strokeWidth="1.8" strokeLinejoin="round" />
    <line x1="-16" y1="18" x2="16" y2="18" className="support-glyph__plate" strokeWidth="2" strokeLinecap="round" />
    <Hatch y={18} />
    <Node />
  </g>
);

const Roller = () => (
  <g>
    <polygon points="0,0 -11,15 11,15" className="support-glyph__body" strokeWidth="1.8" strokeLinejoin="round" />
    <line x1="-13" y1="15" x2="13" y2="15" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="-5.5" cy="18.5" r="2.8" className="support-glyph__wheel" strokeWidth="1.5" />
    <circle cx="5.5" cy="18.5" r="2.8" className="support-glyph__wheel" strokeWidth="1.5" />
    <Ground y={21.5} />
    <Node />
  </g>
);

const Fixed = () => (
  <g>
    <line x1="0" y1="0" x2="0" y2="7" strokeWidth="2" />
    <line x1="-18" y1="7" x2="18" y2="7" className="support-glyph__plate" strokeWidth="2.4" strokeLinecap="round" />
    {[-14, -8, -2, 4, 10, 16].map((x) => (
      <line key={x} x1={x} y1="7" x2={x - 5} y2="14" strokeWidth="1.4" strokeLinecap="round" />
    ))}
    <Node />
  </g>
);

const Custom = () => (
  <g>
    <line x1="-16" y1="-6" x2="16" y2="-6" strokeWidth="1.6" strokeDasharray="3 2" />
    <line x1="-16" y1="10" x2="16" y2="10" strokeWidth="1.6" strokeDasharray="3 2" />
    <rect x="-10" y="-3" width="20" height="10" rx="3" className="support-glyph__body" strokeWidth="1.8" />
    <Node />
  </g>
);

/**
 * La guía: un patín rígido sobre un carril.
 *
 * El patín va unido al nudo por un vástago **rígido**, no por un pasador, y eso
 * es lo que dibuja la diferencia con un rodillo: además de la traslación
 * perpendicular, la guía impide el giro. La vertical es la misma pieza girada
 * 90°, con lo que la placa acaba a un lado — que es exactamente lo que
 * significa restringir Ux en lugar de Uy.
 */
const Guide = () => (
  <g>
    <line x1="0" y1="0" x2="0" y2="2" strokeWidth="2" />
    <rect x="-9" y="2" width="18" height="9" rx="2.5" className="support-glyph__body" strokeWidth="1.8" />
    <Ground y={14} />
    <Node />
  </g>
);

/** Resorte traslacional. Se dibuja en vertical y se gira al eje que toque. */
const TranslationalSpring = () => (
  <g>
    <Coil y0={2} y1={18} />
    <Ground y={20} width={14} />
    <Node />
  </g>
);

/** Resorte rotacional: una espiral, que es giro y no traslación. */
const RotationalSpring = () => (
  <g>
    <path
      d="M0 2c-4 0-7 3-7 6s3 6 6 6 5-2 5-4.5-2-4-4-4-3.2 1.4-3.2 3"
      fill="none"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <Ground y={20} width={14} />
    <Node />
  </g>
);

/** Combinado: la espiral y el muelle a la vez, sobre el mismo terreno. */
const CombinedSpring = () => (
  <g>
    <path d="M-9 3c-3.4 0-6 2.6-6 5.6s2.6 5 5.2 5 4.4-1.8 4.4-3.8" fill="none" strokeWidth="1.6" strokeLinecap="round" />
    <g transform="translate(7 0)"><Coil y0={2} y1={18} turns={3} width={5} /></g>
    <Ground y={20} width={16} />
    <Node />
  </g>
);

/** Asiento impuesto: el apoyo baja una cantidad conocida. */
const Settlement = () => (
  <g>
    <polygon points="0,0 -11,14 11,14" className="support-glyph__body" strokeWidth="1.8" strokeLinejoin="round" />
    <Ground y={16} width={15} />
    <g className="support-glyph__accent">
      <line x1="16" y1="-2" x2="16" y2="12" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 15l-3.4-5h6.8Z" />
    </g>
    <Node />
  </g>
);

/**
 * Contacto unilateral en compresión: el nudo se apoya, pero no tira.
 *
 * El hueco entre el vástago y el terreno es la separación posible; el muelle
 * dice que la reacción sólo aparece al acercarse.
 */
const CompressionOnly = () => (
  <g>
    <Coil y0={2} y1={14} turns={3} width={5} />
    <line x1="-8" y1="16" x2="8" y2="16" strokeWidth="1.8" strokeLinecap="round" />
    <Ground y={21} width={14} />
    <Node />
  </g>
);

/** Sólo tensión: un gancho, que trabaja tirando y se afloja al comprimir. */
const TensionOnly = () => (
  <g>
    <line x1="0" y1="0" x2="0" y2="5" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M0 5c4 0 6 2.5 6 5.5S3.6 16 0.6 16" fill="none" strokeWidth="1.8" strokeLinecap="round" />
    <Coil y0={16} y1={26} turns={2} width={4} />
    <Node />
  </g>
);

/** Tope con holgura: el recorrido libre antes de que el tope actúe. */
const Gap = () => (
  <g>
    <line x1="0" y1="0" x2="0" y2="9" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="-9" y1="9" x2="9" y2="9" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="-9" y1="16" x2="9" y2="16" strokeWidth="1.6" strokeDasharray="2.5 2.5" />
    <g className="support-glyph__accent">
      <line x1="12" y1="9" x2="12" y2="16" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.5" y1="9" x2="14.5" y2="9" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.5" y1="16" x2="14.5" y2="16" strokeWidth="1.4" strokeLinecap="round" />
    </g>
    <Ground y={20} width={14} />
    <Node />
  </g>
);

/** Fricción: el bloque desliza cuando se supera la fuerza de rozamiento. */
const Friction = () => (
  <g>
    <line x1="0" y1="0" x2="0" y2="4" strokeWidth="1.8" />
    <rect x="-11" y="4" width="22" height="9" rx="2" className="support-glyph__body" strokeWidth="1.8" />
    <Ground y={15} width={16} />
    <g className="support-glyph__accent">
      <line x1="-8" y1="-4" x2="8" y2="-4" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 -4l-5-3v6Z" />
      <path d="M-11 -4l5-3v6Z" />
    </g>
  </g>
);

/** Rótula interna: el momento se libera **entre** las barras, sin terreno. */
const InternalHinge = () => (
  <g>
    <line x1="-16" y1="0" x2="-5" y2="0" strokeWidth="2" strokeLinecap="round" />
    <line x1="5" y1="0" x2="16" y2="0" strokeWidth="2" strokeLinecap="round" />
    <circle cx="0" cy="0" r="4.5" className="support-glyph__wheel" strokeWidth="1.8" />
  </g>
);

/** Semirrígida: ni rótula ni nudo rígido, una rigidez finita en el extremo. */
const SemiRigid = () => (
  <g>
    <line x1="-16" y1="0" x2="-5" y2="0" strokeWidth="2" strokeLinecap="round" />
    <line x1="6" y1="0" x2="16" y2="0" strokeWidth="2" strokeLinecap="round" />
    <path d="M-1 -4c2.6 0 4.6 2 4.6 4.4S1.4 4.6-0.6 4.6-3.8 3-3.8 1.2-2.4-1.6-1-1.6-0.4 0.6-0.4 0.6" fill="none" strokeWidth="1.6" strokeLinecap="round" />
  </g>
);

/** Centro vertical del dibujo de cada símbolo, sobre su propio eje. */
const CENTER_Y: Readonly<Record<SupportGlyphName, number>> = {
  free: 4,
  pin: 12,
  roller: 13,
  fixed: 6,
  custom: 2,
  'guide-horizontal': 8,
  'guide-vertical': 8,
  'spring-x': 10,
  'spring-y': 10,
  'spring-normal': 10,
  'spring-rotational': 10,
  'spring-combined': 10,
  settlement: 8,
  'compression-only': 10,
  'tension-only': 13,
  gap: 10,
  friction: 6,
  'internal-hinge': 0,
  'semi-rigid': 0,
};

/**
 * El giro propio de cada símbolo, para los que se dibujan una sola vez y se
 * reutilizan orientados. El rodillo no está aquí: el suyo es un dato del
 * modelo, no una constante.
 */
const FIXED_ROTATION: Partial<Record<SupportGlyphName, number>> = {
  'guide-vertical': 90,
  'spring-x': 90,
  'spring-normal': 45,
};

const tidy = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Sitúa el dibujo centrado tras aplicarle su giro.
 *
 * `rotate` gira alrededor del nudo, que es el origen; el `translate` de delante
 * lleva el centro ya girado de vuelta al medio del encuadre. El orden importa:
 * en SVG la transformación de la izquierda se aplica después.
 */
const placement = (centerY: number, rotation: number) => {
  const radians = (rotation * Math.PI) / 180;
  return `translate(${tidy(centerY * Math.sin(radians))} ${tidy(-centerY * Math.cos(radians))}) rotate(${tidy(rotation)})`;
};

const DRAWINGS: Readonly<Record<SupportGlyphName, () => React.JSX.Element>> = {
  free: Free,
  pin: Pin,
  roller: Roller,
  fixed: Fixed,
  custom: Custom,
  'guide-horizontal': Guide,
  'guide-vertical': Guide,
  'spring-x': TranslationalSpring,
  'spring-y': TranslationalSpring,
  'spring-normal': TranslationalSpring,
  'spring-rotational': RotationalSpring,
  'spring-combined': CombinedSpring,
  settlement: Settlement,
  'compression-only': CompressionOnly,
  'tension-only': TensionOnly,
  gap: Gap,
  friction: Friction,
  'internal-hinge': InternalHinge,
  'semi-rigid': SemiRigid,
};

/** Los tipos que el solver orienta de verdad. El resto gira sólo el dibujo. */
const rotationOf = (glyph: SupportGlyphName, angleDeg: number, visualAngleDeg?: number) => {
  if (glyph === 'roller') return angleDeg - 90;
  if ((glyph === 'pin' || glyph === 'fixed') && visualAngleDeg !== undefined) return visualAngleDeg;
  return FIXED_ROTATION[glyph] ?? 0;
};

export const SupportGlyph = ({
  glyph,
  angleDeg = 90,
  visualAngleDeg,
  size = 50,
}: {
  glyph: SupportGlyphName;
  /** Normal física, sólo la usa el rodillo. */
  angleDeg?: number;
  /** Giro de presentación de un articulado o un empotramiento. */
  visualAngleDeg?: number;
  size?: number;
}) => {
  const rotation = rotationOf(glyph, angleDeg, visualAngleDeg);
  const Drawing = DRAWINGS[glyph];
  return (
    <svg
      className={`support-glyph support-glyph--${glyph}`}
      viewBox={`${-HALF_BOX} ${-HALF_BOX} ${HALF_BOX * 2} ${HALF_BOX * 2}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <g transform={placement(CENTER_Y[glyph], rotation)}><Drawing /></g>
    </svg>
  );
};
