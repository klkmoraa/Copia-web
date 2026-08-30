import type { SupportGlyphName } from './supportCatalog';

/**
 * El símbolo del apoyo, en miniatura.
 *
 * POR QUÉ NO ES UN ICONO DE LA LIBRERÍA. La tarjeta y el lienzo tienen que
 * enseñar **la misma pieza**: si el selector dibuja un triángulo genérico y el
 * modelo dibuja un rodillo con dos ruedas y su placa rayada, el usuario aprende
 * dos vocabularios para una sola cosa. Las coordenadas de aquí son las de
 * `CanvasGeometryLayer`, a la misma escala y con el nudo en el origen; lo único
 * que cambia es el encuadre.
 *
 * EL GIRO ES DATO, NO ADORNO. Un rodillo se dibuja girado `angleDeg - 90`,
 * exactamente como en el lienzo, porque el ángulo *es* la dirección restringida.
 * Un preset que escribe `angleDeg = 0` tiene que verse tumbado contra el muro
 * antes de pulsarlo, o el preset no explica nada.
 *
 * EL ENCUADRE, Y POR QUÉ NO BASTA CON GIRAR. El apoyo cuelga **por debajo** del
 * nudo, así que girarlo alrededor del nudo lo saca de la caja: a 45° la placa
 * rayada se salía de la tarjeta y a 0° se comía a la vecina. Cada símbolo
 * declara su centro (`CENTER_Y`, sobre el eje del dibujo) y el grupo se
 * recoloca por el centro **ya girado**, así que la pieza queda centrada en
 * cualquier ángulo sin cambiar de tamaño ni mentir sobre dónde está el nudo. El
 * `viewBox` es cuadrado por lo mismo: alto y ancho tienen que dar de sí igual
 * porque cualquiera de los dos puede tocarle al giro.
 *
 * Los tipos que el solver no orienta —articulado, empotrado, personalizado— se
 * dibujan siempre rectos, aunque el modelo traiga un `angleDeg`: el solver los
 * monta sin ángulo, y girarlos aquí prometería una orientación que el análisis
 * no tiene en cuenta.
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

/** Doble flecha que declara por dónde puede correr el nudo. */
const FreedomArrow = ({ y }: { y: number }) => (
  <g className="support-glyph__freedom">
    <line x1="-14" y1={y} x2="14" y2={y} strokeWidth="1.4" strokeLinecap="round" />
    <path d={`M-14 ${y}l5-3.2v6.4Z`} />
    <path d={`M14 ${y}l-5-3.2v6.4Z`} />
  </g>
);

const Node = () => <circle cx="0" cy="0" r="2.6" className="support-glyph__node" />;

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
    <line x1="-17" y1="21.5" x2="17" y2="21.5" className="support-glyph__plate" strokeWidth="2" strokeLinecap="round" />
    <Hatch y={21.5} dy={5} />
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
 * La guía: un patín sobre un carril, y la flecha que dice hacia dónde corre.
 *
 * Se dibuja una sola vez y la vertical es la misma pieza girada 90°. La placa
 * rayada acaba entonces a la izquierda, que es exactamente lo que significa
 * restringir Ux en lugar de Uy.
 */
const Guide = () => (
  <g>
    <rect x="-9" y="1" width="18" height="9" rx="3" className="support-glyph__body" strokeWidth="1.8" />
    <line x1="0" y1="0" x2="0" y2="1" strokeWidth="1.8" />
    <line x1="-17" y1="14" x2="17" y2="14" className="support-glyph__plate" strokeWidth="2" strokeLinecap="round" />
    <Hatch y={14} dy={5} />
    <FreedomArrow y={-9} />
    <Node />
  </g>
);

/** Centro vertical del dibujo de cada símbolo, sobre su propio eje. */
const CENTER_Y: Readonly<Record<SupportGlyphName, number>> = {
  free: 4,
  pin: 12,
  roller: 13,
  fixed: 6,
  custom: 2,
  'guide-horizontal': 4,
  'guide-vertical': 4,
};

/** Los dos únicos símbolos que llevan giro propio; el resto se dibuja recto. */
const FIXED_ROTATION: Partial<Record<SupportGlyphName, number>> = {
  'guide-vertical': 90,
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

export const SupportGlyph = ({
  glyph,
  angleDeg = 90,
  size = 50,
}: {
  glyph: SupportGlyphName;
  angleDeg?: number;
  size?: number;
}) => {
  const rotation = glyph === 'roller' ? angleDeg - 90 : FIXED_ROTATION[glyph] ?? 0;
  return (
    <svg
      className={`support-glyph support-glyph--${glyph}`}
      viewBox={`${-HALF_BOX} ${-HALF_BOX} ${HALF_BOX * 2} ${HALF_BOX * 2}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <g transform={placement(CENTER_Y[glyph], rotation)}>
        {glyph === 'free' ? <Free /> : null}
        {glyph === 'pin' ? <Pin /> : null}
        {glyph === 'roller' ? <Roller /> : null}
        {glyph === 'fixed' ? <Fixed /> : null}
        {glyph === 'custom' ? <Custom /> : null}
        {glyph === 'guide-horizontal' || glyph === 'guide-vertical' ? <Guide /> : null}
      </g>
    </svg>
  );
};
