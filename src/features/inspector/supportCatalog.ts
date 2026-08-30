/**
 * El catálogo de apoyos: cuatro familias, una biblioteca.
 *
 * QUÉ PROBLEMA RESUELVE. Un desplegable con cinco entradas —«Libre, Articulado,
 * Rodillo orientable, Empotramiento, Personalizado»— obliga a saberse de
 * memoria qué restringe cada palabra, y no dice en ningún momento que «rodillo
 * de suelo» y «rodillo de muro» son **el mismo tipo** con distinto ángulo.
 *
 * LA REGLA QUE LO SOSTIENE. Aquí no se inventa ningún `SupportType`. Los cinco
 * de `src/types.ts` son los cinco que existen; una entrada de familia `basic` o
 * `guided` es una combinación de `angleDeg` o de `restrainX/Y/R` sobre uno de
 * esos cinco. Por eso `SupportEntry.model` guarda el campo real que la tarjeta
 * escribe y se enseña sin traducir: es el nombre de la propiedad, no una
 * etiqueta de interfaz.
 *
 * LAS CUATRO FAMILIAS, Y POR QUÉ NO SON UNA SOLA LISTA.
 *
 *   · `basic`      — la condición de borde. Escribe `type`.
 *   · `guided`     — guías y restricciones declaradas a mano. Escribe `type =
 *                    custom` más las banderas.
 *   · `elastic`    — rigidez finita. **No cambia el tipo**: escribe
 *                    `support.spring.*`, que es una relación fuerza-
 *                    desplazamiento y no un pictograma de apoyo.
 *   · `advanced`   — asiento impuesto y contactos no lineales.
 *   · `connection` — rótula interna y semirrigidez. No son apoyos al terreno;
 *                    viven en el nudo o en el extremo del miembro. Sólo se
 *                    enseñan en la biblioteca, para que nadie confunda un apoyo
 *                    articulado con una rótula interna.
 *
 * LO QUE ESTE MOTOR NO TIENE, DECLARADO COMO TAL. Contacto unilateral, tope con
 * holgura y fricción **en el nudo** necesitan un solver que itere el estado, y
 * este no lo tiene: no hay `NodeLink` en `src/types.ts`. Sus entradas existen en
 * el catálogo con `kind: 'unavailable'` para que la biblioteca las explique y
 * diga dónde está el límite — nunca como una opción que se pueda aplicar. El
 * contacto unilateral que sí existe es axial y vive en la barra
 * (`member.axialBehavior`), no aquí.
 *
 * La descripción de grados de libertad refleja lo que
 * `assembleKinematicConstraints` monta en `src/engine/solver.ts`, y nada más:
 * si el solver no añade la ecuación, aquí el grado de libertad está libre.
 */
import type { TranslationKey } from '../../i18n/catalogs';
import type { SupportDefinition, SupportType } from '../../types';

/** Ángulo de la normal de un rodillo cuando el modelo no trae otro. Es el mismo
 *  valor que asume el solver, y por eso se compara contra él. */
export const DEFAULT_ROLLER_ANGLE_DEG = 90;

/** Dirección del resorte normal cuando `spring.angleDeg` está ausente. También
 *  la fija el solver, y no tiene por qué coincidir con la del apoyo. */
export const DEFAULT_SPRING_ANGLE_DEG = 90;

export type SupportFamily = 'basic' | 'guided' | 'elastic' | 'advanced' | 'connection';

/**
 * Qué hace la entrada al pulsarla.
 *
 * `unavailable` no es un estado de interfaz: es una propiedad del motor. Una
 * entrada así no tiene forma de aplicarse porque el modelo no tiene dónde
 * guardarla.
 */
export type SupportEntryKind = 'preset' | 'spring' | 'settlement' | 'connection' | 'unavailable';

/**
 * Qué significa girar el símbolo de esta entrada.
 *
 *   · `physical` — el ángulo **es** la dirección restringida. Sólo el rodillo:
 *     el solver monta `cos θ·ux + sen θ·uy = 0` con ese número.
 *   · `visual`   — el giro sólo cambia el dibujo. El solver monta las mismas
 *     ecuaciones con ángulo o sin él, y por eso girar un empotramiento no
 *     cambia ni una reacción.
 *   · `none`     — no hay nada que orientar.
 */
export type SupportOrientationMode = 'physical' | 'visual' | 'none';

export type SupportGlyphName =
  | 'free'
  | 'pin'
  | 'roller'
  | 'fixed'
  | 'custom'
  | 'guide-horizontal'
  | 'guide-vertical'
  | 'spring-x'
  | 'spring-y'
  | 'spring-normal'
  | 'spring-rotational'
  | 'spring-combined'
  | 'settlement'
  | 'compression-only'
  | 'tension-only'
  | 'gap'
  | 'friction'
  | 'internal-hinge'
  | 'semi-rigid';

export type SupportSpringKey = 'kx' | 'ky' | 'kr' | 'kNormal';

export interface SupportRestraints {
  readonly x: boolean;
  readonly y: boolean;
  readonly r: boolean;
}

export interface SupportEntry {
  readonly id: string;
  readonly family: SupportFamily;
  readonly kind: SupportEntryKind;
  readonly glyph: SupportGlyphName;
  readonly labelKey: TranslationKey;
  /** La línea corta bajo el nombre: notación de grados de libertad o campo. */
  readonly metaKey: TranslationKey;
  readonly descriptionKey: TranslationKey;
  /** Campo del modelo que la entrada escribe, sin traducir a propósito. */
  readonly model: string;
  readonly orientation?: SupportOrientationMode;
  /** Sólo `preset`: el tipo real que escribe. Nunca hay un sexto. */
  readonly type?: SupportType;
  /** Sólo los presets de rodillo fijan un ángulo. */
  readonly angleDeg?: number;
  /** Sólo los presets guiados fijan restricciones. */
  readonly restraints?: SupportRestraints;
  /** Sólo `spring`: qué rigideces abre la tarjeta. */
  readonly springKeys?: readonly SupportSpringKey[];
  /** Sólo `unavailable`: por qué este motor no lo tiene. */
  readonly unavailableKey?: TranslationKey;
}

/**
 * Familia 01 · la condición de borde.
 *
 * Los tres rodillos comparten `type = roller` y sólo se distinguen en el
 * ángulo. Que las tres tarjetas escriban `angleDeg = …` y ninguna escriba
 * `type = …` es lo que lo hace evidente sin explicárselo a nadie.
 */
const BASIC_ENTRIES: readonly SupportEntry[] = [
  {
    id: 'free',
    family: 'basic',
    kind: 'preset',
    type: 'none',
    glyph: 'free',
    labelKey: 'inspector.free',
    metaKey: 'inspector.supportMetaFree',
    descriptionKey: 'inspector.supportFreeDescription',
    model: 'type = none',
    orientation: 'none',
  },
  {
    id: 'pin',
    family: 'basic',
    kind: 'preset',
    type: 'pin',
    glyph: 'pin',
    labelKey: 'inspector.pin',
    metaKey: 'inspector.supportMetaPin',
    descriptionKey: 'inspector.supportPinDescription',
    model: 'type = pin',
    orientation: 'visual',
  },
  {
    id: 'roller-ground',
    family: 'basic',
    kind: 'preset',
    type: 'roller',
    angleDeg: 90,
    glyph: 'roller',
    labelKey: 'inspector.supportRollerGround',
    metaKey: 'inspector.supportMetaRollerGround',
    descriptionKey: 'inspector.supportRollerGroundDescription',
    model: 'angleDeg = 90',
    orientation: 'physical',
  },
  {
    id: 'roller-wall',
    family: 'basic',
    kind: 'preset',
    type: 'roller',
    angleDeg: 0,
    glyph: 'roller',
    labelKey: 'inspector.supportRollerWall',
    metaKey: 'inspector.supportMetaRollerWall',
    descriptionKey: 'inspector.supportRollerWallDescription',
    model: 'angleDeg = 0',
    orientation: 'physical',
  },
  {
    id: 'roller-incline',
    family: 'basic',
    kind: 'preset',
    type: 'roller',
    angleDeg: 45,
    glyph: 'roller',
    labelKey: 'inspector.supportRollerIncline',
    metaKey: 'inspector.supportMetaRollerIncline',
    descriptionKey: 'inspector.supportRollerInclineDescription',
    model: 'angleDeg = θ',
    orientation: 'physical',
  },
  {
    id: 'fixed',
    family: 'basic',
    kind: 'preset',
    type: 'fixed',
    glyph: 'fixed',
    labelKey: 'inspector.fixed',
    metaKey: 'inspector.supportMetaFixed',
    descriptionKey: 'inspector.supportFixedDescription',
    model: 'type = fixed',
    orientation: 'visual',
  },
];

/**
 * Familia 02 · guías y grados de libertad declarados.
 *
 * Una guía **restringe también el giro**: es el apoyo guiado clásico —el patín
 * que corre por un carril sin poder voltearse—, no un rodillo con las casillas
 * puestas a mano. Restringir sólo la traslación perpendicular sería otra vez un
 * rodillo, y entonces la tarjeta no añadiría nada.
 */
const GUIDED_ENTRIES: readonly SupportEntry[] = [
  {
    id: 'guide-horizontal',
    family: 'guided',
    kind: 'preset',
    type: 'custom',
    restraints: { x: false, y: true, r: true },
    glyph: 'guide-horizontal',
    labelKey: 'inspector.supportGuideHorizontal',
    metaKey: 'inspector.supportMetaGuideHorizontal',
    descriptionKey: 'inspector.supportGuideHorizontalDescription',
    model: 'restrainY · restrainR',
    orientation: 'none',
  },
  {
    id: 'guide-vertical',
    family: 'guided',
    kind: 'preset',
    type: 'custom',
    restraints: { x: true, y: false, r: true },
    glyph: 'guide-vertical',
    labelKey: 'inspector.supportGuideVertical',
    metaKey: 'inspector.supportMetaGuideVertical',
    descriptionKey: 'inspector.supportGuideVerticalDescription',
    model: 'restrainX · restrainR',
    orientation: 'none',
  },
  {
    id: 'custom',
    family: 'guided',
    kind: 'preset',
    type: 'custom',
    glyph: 'custom',
    labelKey: 'inspector.custom',
    metaKey: 'inspector.supportMetaCustom',
    descriptionKey: 'inspector.supportCustomDescription',
    model: 'type = custom',
    orientation: 'none',
  },
];

/**
 * Familia 03 · rigidez finita.
 *
 * Ninguna de estas entradas toca `type`: se suman a la condición de borde que
 * ya haya. Y ninguna escribe un número: el solver suma `k` directamente a la
 * diagonal de la matriz, así que una rigidez inventada por la interfaz sería
 * una rigidez inventada en el resultado. La tarjeta abre el campo; el valor lo
 * pone quien sabe cuánto vale.
 */
const ELASTIC_ENTRIES: readonly SupportEntry[] = [
  {
    id: 'spring-x',
    family: 'elastic',
    kind: 'spring',
    springKeys: ['kx'],
    glyph: 'spring-x',
    labelKey: 'inspector.supportSpringX',
    metaKey: 'inspector.supportMetaSpringX',
    descriptionKey: 'inspector.supportSpringXDescription',
    model: 'spring.kx',
  },
  {
    id: 'spring-y',
    family: 'elastic',
    kind: 'spring',
    springKeys: ['ky'],
    glyph: 'spring-y',
    labelKey: 'inspector.supportSpringY',
    metaKey: 'inspector.supportMetaSpringY',
    descriptionKey: 'inspector.supportSpringYDescription',
    model: 'spring.ky',
  },
  {
    id: 'spring-normal',
    family: 'elastic',
    kind: 'spring',
    springKeys: ['kNormal'],
    glyph: 'spring-normal',
    labelKey: 'inspector.supportSpringNormal',
    metaKey: 'inspector.supportMetaSpringNormal',
    descriptionKey: 'inspector.supportSpringNormalDescription',
    model: 'spring.kNormal',
  },
  {
    id: 'spring-rotational',
    family: 'elastic',
    kind: 'spring',
    springKeys: ['kr'],
    glyph: 'spring-rotational',
    labelKey: 'inspector.supportSpringRotational',
    metaKey: 'inspector.supportMetaSpringRotational',
    descriptionKey: 'inspector.supportSpringRotationalDescription',
    model: 'spring.kr',
  },
  {
    id: 'spring-combined',
    family: 'elastic',
    kind: 'spring',
    springKeys: ['kx', 'ky', 'kr', 'kNormal'],
    glyph: 'spring-combined',
    labelKey: 'inspector.supportSpringCombined',
    metaKey: 'inspector.supportMetaSpringCombined',
    descriptionKey: 'inspector.supportSpringCombinedDescription',
    model: 'spring.kx · ky · kr · kNormal',
  },
];

/**
 * Familia 04 · condiciones avanzadas.
 *
 * Sólo la primera existe. Las cuatro siguientes están declaradas para que la
 * biblioteca pueda decir **dónde está el límite de este motor** en lugar de
 * callarlo, y llevan `kind: 'unavailable'`, que es lo que impide que ninguna
 * superficie las ofrezca como opción aplicable.
 */
const ADVANCED_ENTRIES: readonly SupportEntry[] = [
  {
    id: 'settlement',
    family: 'advanced',
    kind: 'settlement',
    glyph: 'settlement',
    labelKey: 'inspector.supportSettlement',
    metaKey: 'inspector.supportMetaSettlement',
    descriptionKey: 'inspector.supportSettlementDescription',
    model: 'prescribedDisplacements',
  },
  {
    id: 'compression-only',
    family: 'advanced',
    kind: 'unavailable',
    glyph: 'compression-only',
    labelKey: 'inspector.supportCompressionOnly',
    metaKey: 'inspector.supportMetaCompressionOnly',
    descriptionKey: 'inspector.supportCompressionOnlyDescription',
    model: '—',
    unavailableKey: 'inspector.supportNeedsContactSolver',
  },
  {
    id: 'tension-only',
    family: 'advanced',
    kind: 'unavailable',
    glyph: 'tension-only',
    labelKey: 'inspector.supportTensionOnly',
    metaKey: 'inspector.supportMetaTensionOnly',
    descriptionKey: 'inspector.supportTensionOnlyDescription',
    model: '—',
    unavailableKey: 'inspector.supportNeedsContactSolver',
  },
  {
    id: 'gap',
    family: 'advanced',
    kind: 'unavailable',
    glyph: 'gap',
    labelKey: 'inspector.supportGap',
    metaKey: 'inspector.supportMetaGap',
    descriptionKey: 'inspector.supportGapDescription',
    model: '—',
    unavailableKey: 'inspector.supportNeedsContactSolver',
  },
  {
    id: 'friction',
    family: 'advanced',
    kind: 'unavailable',
    glyph: 'friction',
    labelKey: 'inspector.supportFriction',
    metaKey: 'inspector.supportMetaFriction',
    descriptionKey: 'inspector.supportFrictionDescription',
    model: '—',
    unavailableKey: 'inspector.supportNeedsContactSolver',
  },
];

/**
 * Familia 05 · conexiones, que no son apoyos externos.
 *
 * Están en la biblioteca y no en el selector a propósito: separarlas es lo que
 * evita confundir un apoyo articulado —que sujeta el nudo contra el terreno—
 * con una rótula interna, que sólo libera el momento entre las barras que
 * llegan a ese nudo y no aporta ninguna reacción.
 */
const CONNECTION_ENTRIES: readonly SupportEntry[] = [
  {
    id: 'internal-hinge',
    family: 'connection',
    kind: 'connection',
    glyph: 'internal-hinge',
    labelKey: 'inspector.internalHinge',
    metaKey: 'inspector.supportMetaInternalHinge',
    descriptionKey: 'inspector.supportInternalHingeDescription',
    model: 'node.internalHinge',
  },
  {
    id: 'semi-rigid',
    family: 'connection',
    kind: 'connection',
    glyph: 'semi-rigid',
    labelKey: 'inspector.supportSemiRigid',
    metaKey: 'inspector.supportMetaSemiRigid',
    descriptionKey: 'inspector.supportSemiRigidDescription',
    model: 'member.rotationalSpringI / J',
  },
];

export const SUPPORT_ENTRIES: readonly SupportEntry[] = [
  ...BASIC_ENTRIES,
  ...GUIDED_ENTRIES,
  ...ELASTIC_ENTRIES,
  ...ADVANCED_ENTRIES,
  ...CONNECTION_ENTRIES,
];

/** Las cuatro familias que el selector ofrece, en su orden. La quinta
 *  —conexiones— sólo aparece en la biblioteca. */
export const SUPPORT_PICKER_FAMILIES: readonly SupportFamily[] = ['basic', 'guided', 'elastic', 'advanced'];

export const entriesOfFamily = (family: SupportFamily): readonly SupportEntry[] =>
  SUPPORT_ENTRIES.filter((entry) => entry.family === family);

export const findSupportEntry = (id: string): SupportEntry | undefined =>
  SUPPORT_ENTRIES.find((entry) => entry.id === id);

const restraintsOf = (support: SupportDefinition): SupportRestraints => ({
  x: Boolean(support.restrainX),
  y: Boolean(support.restrainY),
  r: Boolean(support.restrainR),
});

/**
 * El apoyo que la entrada representa por sí sola, sin mirar el nudo.
 *
 * Es lo que la biblioteca necesita para dibujar la ficha de grados de libertad
 * de una tarjeta que nadie ha pulsado todavía. Devuelve `null` cuando la
 * entrada no fija una condición de borde completa —«Personalizado», los
 * resortes, lo avanzado—, porque en esos casos no hay un apoyo que enseñar.
 */
export const previewSupportOf = (entry: SupportEntry): SupportDefinition | null => {
  if (entry.kind !== 'preset' || !entry.type) return null;
  if (entry.type === 'roller') return { type: 'roller', angleDeg: entry.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG };
  if (entry.type === 'custom') {
    if (!entry.restraints) return null;
    return {
      type: 'custom',
      restrainX: entry.restraints.x,
      restrainY: entry.restraints.y,
      restrainR: entry.restraints.r,
    };
  }
  return { type: entry.type };
};

/**
 * Aplica un preset sobre el apoyo que ya había.
 *
 * Conserva `spring` —una rigidez es una propiedad del nodo, no del tipo— y
 * reconstruye las restricciones desde cero, que es justo lo que impide que
 * quede una bandera de un tipo anterior sin dueño.
 *
 * EL ÁNGULO NO SE HEREDA ENTRE FAMILIAS DE ORIENTACIÓN, Y ESA ES LA PARTE
 * DELICADA. `angleDeg` significa dos cosas distintas según el tipo: en un
 * rodillo **es** la normal restringida y el solver la usa; en un articulado o
 * un empotramiento sólo gira el dibujo. Heredarlo de un empotramiento a un
 * rodillo convertiría en silencio una decisión de presentación en una
 * restricción física. Así que el rodillo sólo hereda el ángulo de otro rodillo;
 * en cualquier otro caso arranca en su valor por omisión.
 */
export const applySupportPreset = (current: SupportDefinition, entry: SupportEntry): SupportDefinition => {
  const spring = current.spring;
  if (entry.kind !== 'preset' || !entry.type) return current;
  if (entry.type === 'roller') {
    const inherited = current.type === 'roller' ? current.angleDeg : undefined;
    return { type: 'roller', angleDeg: entry.angleDeg ?? inherited ?? DEFAULT_ROLLER_ANGLE_DEG, spring };
  }
  if (entry.type === 'custom') {
    /* Sin restricciones propias, «Personalizado» respeta las casillas que ya
       estaban si el apoyo ya era personalizado: pulsar la tarjeta del tipo que
       ya tienes no debe borrarte el trabajo. */
    const restraints = entry.restraints
      ?? (current.type === 'custom' ? restraintsOf(current) : { x: false, y: false, r: false });
    return {
      type: 'custom',
      restrainX: restraints.x,
      restrainY: restraints.y,
      restrainR: restraints.r,
      spring,
    };
  }
  /* Articulado y empotramiento conservan su giro de presentación entre ellos: el
     solver lo ignora, y perderlo al ir y volver borraría un ajuste visual
     deliberado. «Libre» no lo hereda porque no dibuja nada que girar, y dejarlo
     escrito sería un campo sin dueño esperando a que alguien lo malinterprete. */
  const drawsAngle = entry.type === 'pin' || entry.type === 'fixed';
  const visualAngle = drawsAngle && (current.type === 'pin' || current.type === 'fixed')
    ? current.angleDeg
    : undefined;
  return visualAngle === undefined
    ? { type: entry.type, spring }
    : { type: entry.type, angleDeg: visualAngle, spring };
};

/**
 * La entrada que describe el apoyo actual.
 *
 * Gana la más específica: una guía se reconoce antes que «Personalizado», y un
 * rodillo a 45° antes que un rodillo a secas. Devuelve `null` sólo para un
 * personalizado cuyas casillas no son las de ninguna guía; ahí la tarjeta que
 * corresponde es «Personalizado».
 */
export const matchSupportEntry = (support: SupportDefinition): SupportEntry => {
  if (support.type === 'roller') {
    const angle = support.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG;
    return BASIC_ENTRIES.find((entry) => entry.type === 'roller' && entry.angleDeg === angle)
      ?? BASIC_ENTRIES.find((entry) => entry.id === 'roller-incline')!;
  }
  if (support.type === 'custom') {
    const current = restraintsOf(support);
    return GUIDED_ENTRIES.find((entry) => entry.restraints?.x === current.x
      && entry.restraints.y === current.y
      && entry.restraints.r === current.r)
      ?? GUIDED_ENTRIES.find((entry) => entry.id === 'custom')!;
  }
  return BASIC_ENTRIES.find((entry) => entry.type === support.type) ?? BASIC_ENTRIES[0];
};

/** Cierto cuando el rodillo lleva un ángulo que no es el de ningún preset. */
export const hasCustomRollerAngle = (support: SupportDefinition): boolean => {
  if (support.type !== 'roller') return false;
  const angle = support.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG;
  return !BASIC_ENTRIES.some((entry) => entry.type === 'roller' && entry.angleDeg === angle);
};

export type SupportDofId = 'ux' | 'uy' | 'rz' | 'normal' | 'tangent';

export interface SupportDofRow {
  readonly id: SupportDofId;
  readonly restrained: boolean;
}

const DOF_LABELS: Readonly<Record<SupportDofId, string>> = {
  ux: 'Ux',
  uy: 'Uy',
  rz: 'Rz',
  normal: 'N',
  tangent: 'T',
};

/** El símbolo del grado de libertad. Es notación, no texto traducible. */
export const supportDofLabel = (id: SupportDofId): string => DOF_LABELS[id];

/**
 * Qué restringe el apoyo, leído del mismo sitio que lo lee el solver.
 *
 * Un rodillo no restringe Ux ni Uy: restringe **una** dirección, la normal, y
 * por eso sus filas son otras. Enseñar «Ux libre / Uy libre» en un rodillo a 45°
 * sería literalmente cierto y completamente inútil.
 */
export const describeSupportDof = (support: SupportDefinition): readonly SupportDofRow[] => {
  if (support.type === 'fixed') {
    return [{ id: 'ux', restrained: true }, { id: 'uy', restrained: true }, { id: 'rz', restrained: true }];
  }
  if (support.type === 'pin') {
    return [{ id: 'ux', restrained: true }, { id: 'uy', restrained: true }, { id: 'rz', restrained: false }];
  }
  if (support.type === 'roller') {
    return [{ id: 'normal', restrained: true }, { id: 'tangent', restrained: false }, { id: 'rz', restrained: false }];
  }
  if (support.type === 'custom') {
    const current = restraintsOf(support);
    return [{ id: 'ux', restrained: current.x }, { id: 'uy', restrained: current.y }, { id: 'rz', restrained: current.r }];
  }
  return [{ id: 'ux', restrained: false }, { id: 'uy', restrained: false }, { id: 'rz', restrained: false }];
};

/**
 * Cuántas ecuaciones de apoyo aporta el nodo.
 *
 * Es el conteo de `assembleKinematicConstraints`, no el del diagnóstico de
 * estabilidad: aquél descuenta el giro de un empotramiento cuando todo el
 * modelo es armadura, y ése es un criterio de mecanismo, no de este apoyo.
 */
export const countSupportReactions = (support: SupportDefinition): number =>
  describeSupportDof(support).filter((row) => row.restrained).length;

const SPRING_KEYS: readonly SupportSpringKey[] = ['kx', 'ky', 'kr', 'kNormal'];

/**
 * Las rigideces con valor. Una rigidez cero no está: el solver sólo suma al
 * término de la matriz cuando el valor es distinto de cero, así que un `kx: 0`
 * guardado no es un resorte.
 */
export const activeSpringKeys = (support: SupportDefinition): readonly SupportSpringKey[] => {
  const spring = support.spring;
  if (!spring) return [];
  return SPRING_KEYS.filter((key) => Boolean(spring[key]));
};

/** Cierto cuando la entrada elástica ya tiene alguna de sus rigideces puesta. */
export const isSpringEntryActive = (support: SupportDefinition, entry: SupportEntry): boolean => {
  if (entry.kind !== 'spring' || !entry.springKeys) return false;
  const active = activeSpringKeys(support);
  /* El combinado sólo se da por activo cuando hay más de una rigidez: si no,
     la tarjeta que describe el estado es la del resorte suelto. */
  if (entry.id === 'spring-combined') return active.length > 1;
  return entry.springKeys.every((key) => active.includes(key));
};

/**
 * Cierto cuando el resorte normal apunta a un sitio y la normal del rodillo a
 * otro.
 *
 * No es un error del modelo —`spring.angleDeg` y `support.angleDeg` son campos
 * distintos y el solver usa cada uno en su sitio—, pero sí es la clase de
 * discrepancia que nadie escribe a propósito: el resorte cae por omisión en 90°
 * aunque el rodillo esté a 30°.
 */
export const springNormalDisagrees = (support: SupportDefinition): boolean => {
  if (support.type !== 'roller') return false;
  if (!support.spring?.kNormal) return false;
  const springAngle = support.spring.angleDeg ?? DEFAULT_SPRING_ANGLE_DEG;
  const supportAngle = support.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG;
  return Math.abs(springAngle - supportAngle) > 1e-9;
};

/** Los pasos de «Orientación visual». `null` es Auto: sin ángulo guardado. */
export const VISUAL_ORIENTATION_STEPS: readonly (number | null)[] = [null, 0, 90, 180, 270];
