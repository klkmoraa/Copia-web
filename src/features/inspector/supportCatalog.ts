/**
 * El catálogo de apoyos, por capas.
 *
 * QUÉ PROBLEMA RESUELVE. Un desplegable con cinco entradas —«Libre, Articulado,
 * Rodillo orientable, Empotramiento, Personalizado»— obliga a saberse de
 * memoria qué restringe cada palabra, y no dice en ningún momento que «rodillo
 * de suelo» y «rodillo de muro» son **el mismo tipo** con distinto ángulo. Este
 * módulo separa lo que la industria separa: primero la condición de borde, y
 * sólo después la orientación o los grados de libertad.
 *
 * LA REGLA QUE LO SOSTIENE. Aquí no se inventa ningún `SupportType`. Los cinco
 * de `src/types.ts` son los cinco que existen; todo lo demás de este archivo es
 * un **preset**: una combinación de `angleDeg` o de `restrainX/Y/R` sobre uno de
 * esos cinco. Por eso `SupportPreset.model` guarda el campo real que la tarjeta
 * escribe y se enseña sin traducir: es el nombre de la propiedad, no una
 * etiqueta de interfaz.
 *
 * LO QUE NO ESTÁ AQUÍ, Y POR QUÉ. Contacto unilateral, tope con holgura y
 * fricción son relaciones fuerza-desplazamiento y necesitan un solver que las
 * itere; este motor no las tiene en el nudo, así que no aparecen como tarjeta.
 * Una tarjeta apagada que promete un comportamiento inexistente es peor que su
 * ausencia. La rigidez elástica (`support.spring`) y el asentamiento
 * (`prescribedDisplacements`) sí existen, pero no son condiciones de borde: se
 * editan en Propiedades avanzadas, que es donde el modelo las guarda.
 *
 * La descripción de grados de libertad de este archivo refleja lo que
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

export type SupportLayer = 'base' | 'direction' | 'guide';

export type SupportGlyphName =
  | 'free'
  | 'pin'
  | 'roller'
  | 'fixed'
  | 'custom'
  | 'guide-horizontal'
  | 'guide-vertical';

export interface SupportRestraints {
  readonly x: boolean;
  readonly y: boolean;
  readonly r: boolean;
}

export interface SupportPreset {
  readonly id: string;
  readonly layer: SupportLayer;
  /** El tipo real que la tarjeta escribe. Nunca hay un sexto. */
  readonly type: SupportType;
  readonly glyph: SupportGlyphName;
  readonly labelKey: TranslationKey;
  readonly descriptionKey: TranslationKey;
  /** Campo del modelo que la tarjeta escribe, sin traducir a propósito. */
  readonly model: string;
  /** Sólo los presets de dirección fijan un ángulo. */
  readonly angleDeg?: number;
  /** Sólo los presets de guía fijan restricciones. */
  readonly restraints?: SupportRestraints;
}

/** Capa 01 · la condición de borde. Cinco tarjetas, cinco tipos reales. */
export const SUPPORT_BASE_PRESETS: readonly SupportPreset[] = [
  {
    id: 'free',
    layer: 'base',
    type: 'none',
    glyph: 'free',
    labelKey: 'inspector.free',
    descriptionKey: 'inspector.supportFreeDescription',
    model: 'type = none',
  },
  {
    id: 'pin',
    layer: 'base',
    type: 'pin',
    glyph: 'pin',
    labelKey: 'inspector.pin',
    descriptionKey: 'inspector.supportPinDescription',
    model: 'type = pin',
  },
  {
    id: 'roller',
    layer: 'base',
    type: 'roller',
    glyph: 'roller',
    labelKey: 'inspector.roller',
    descriptionKey: 'inspector.supportRollerDescription',
    model: 'type = roller',
  },
  {
    id: 'fixed',
    layer: 'base',
    type: 'fixed',
    glyph: 'fixed',
    labelKey: 'inspector.fixed',
    descriptionKey: 'inspector.supportFixedDescription',
    model: 'type = fixed',
  },
  {
    id: 'custom',
    layer: 'base',
    type: 'custom',
    glyph: 'custom',
    labelKey: 'inspector.custom',
    descriptionKey: 'inspector.supportCustomDescription',
    model: 'type = custom',
  },
];

/** Capa 02a · la orientación de un rodillo. No son tipos: son `angleDeg`. */
export const SUPPORT_DIRECTION_PRESETS: readonly SupportPreset[] = [
  {
    id: 'roller-ground',
    layer: 'direction',
    type: 'roller',
    glyph: 'roller',
    labelKey: 'inspector.supportRollerGround',
    descriptionKey: 'inspector.supportRollerGroundDescription',
    model: 'angleDeg = 90',
    angleDeg: 90,
  },
  {
    id: 'roller-wall',
    layer: 'direction',
    type: 'roller',
    glyph: 'roller',
    labelKey: 'inspector.supportRollerWall',
    descriptionKey: 'inspector.supportRollerWallDescription',
    model: 'angleDeg = 0',
    angleDeg: 0,
  },
  {
    id: 'roller-incline',
    layer: 'direction',
    type: 'roller',
    glyph: 'roller',
    labelKey: 'inspector.supportRollerIncline',
    descriptionKey: 'inspector.supportRollerInclineDescription',
    model: 'angleDeg = 45',
    angleDeg: 45,
  },
];

/** Capa 02b · las guías. Son `custom` con una sola casilla marcada. */
export const SUPPORT_GUIDE_PRESETS: readonly SupportPreset[] = [
  {
    id: 'guide-horizontal',
    layer: 'guide',
    type: 'custom',
    glyph: 'guide-horizontal',
    labelKey: 'inspector.supportGuideHorizontal',
    descriptionKey: 'inspector.supportGuideHorizontalDescription',
    model: 'restrainY = true',
    restraints: { x: false, y: true, r: false },
  },
  {
    id: 'guide-vertical',
    layer: 'guide',
    type: 'custom',
    glyph: 'guide-vertical',
    labelKey: 'inspector.supportGuideVertical',
    descriptionKey: 'inspector.supportGuideVerticalDescription',
    model: 'restrainX = true',
    restraints: { x: true, y: false, r: false },
  },
];

const restraintsOf = (support: SupportDefinition): SupportRestraints => ({
  x: Boolean(support.restrainX),
  y: Boolean(support.restrainY),
  r: Boolean(support.restrainR),
});

/**
 * Aplica un preset sobre el apoyo que ya había.
 *
 * Conserva `spring` —una rigidez es una propiedad del nodo, no del tipo— y
 * reconstruye las restricciones desde cero, que es justo lo que impide que
 * quede una bandera de un tipo anterior sin dueño. El ángulo se hereda al
 * cambiar de tipo a rodillo para no perder una orientación ya trabajada.
 *
 * `prescribed` no viaja: el solver rechaza un asentamiento sobre un grado de
 * libertad que el apoyo nuevo ya no restringe, y arrastrarlo dejaría un
 * proyecto que no analiza. Es el mismo criterio que tenía el desplegable al que
 * este catálogo sustituye.
 */
export const applySupportPreset = (current: SupportDefinition, preset: SupportPreset): SupportDefinition => {
  const spring = current.spring;
  if (preset.type === 'roller') {
    return {
      type: 'roller',
      angleDeg: preset.angleDeg ?? current.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG,
      spring,
    };
  }
  if (preset.type === 'custom') {
    /* Sin restricciones propias, el preset base «Personalizado» respeta las
       casillas que ya estaban si el apoyo ya era personalizado: pulsar la
       tarjeta del tipo que ya tienes no debe borrarte el trabajo. */
    const restraints = preset.restraints
      ?? (current.type === 'custom' ? restraintsOf(current) : { x: false, y: false, r: false });
    return {
      type: 'custom',
      restrainX: restraints.x,
      restrainY: restraints.y,
      restrainR: restraints.r,
      spring,
    };
  }
  return { type: preset.type, spring };
};

/** El preset base activo. Siempre hay uno: los cinco cubren los cinco tipos. */
export const matchBasePreset = (support: SupportDefinition): SupportPreset =>
  SUPPORT_BASE_PRESETS.find((preset) => preset.type === support.type) ?? SUPPORT_BASE_PRESETS[0];

/** El preset de dirección activo, o `null` si el rodillo lleva un ángulo propio. */
export const matchDirectionPreset = (support: SupportDefinition): SupportPreset | null => {
  if (support.type !== 'roller') return null;
  const angle = support.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG;
  return SUPPORT_DIRECTION_PRESETS.find((preset) => preset.angleDeg === angle) ?? null;
};

/** El preset de guía activo, o `null` si las casillas no son las de ninguna. */
export const matchGuidePreset = (support: SupportDefinition): SupportPreset | null => {
  if (support.type !== 'custom') return null;
  const current = restraintsOf(support);
  return SUPPORT_GUIDE_PRESETS.find((preset) => preset.restraints?.x === current.x
    && preset.restraints.y === current.y
    && preset.restraints.r === current.r) ?? null;
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
  normal: 'n',
  tangent: 't',
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

export type SupportSpringKey = 'kx' | 'ky' | 'kr' | 'kNormal';

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
