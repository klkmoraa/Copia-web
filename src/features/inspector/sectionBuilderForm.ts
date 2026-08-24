import { shapeOfStandardSection, type BuiltSectionShape } from '../../data/sectionBuilder';
import type { SectionShapeType, StandardSection } from '../../data/standardSections';

/**
 * Modelo del formulario del constructor de secciones.
 *
 * `src/data/sectionBuilder.ts` sabe convertir una forma en propiedades y
 * rechazar las que no cierran. Lo que no sabe —ni debe— es qué campos enseña un
 * formulario, con qué valores arranca, y **por qué** una descripción concreta no
 * vale. Eso es lo que vive aquí, en un módulo puro que no depende de React.
 *
 * ## La duplicación aparente de las reglas, y el gate que la ata
 *
 * `sectionBuilderIssue` vuelve a enunciar las restricciones geométricas que el
 * constructor ya comprueba. No es un descuido: el constructor las comunica
 * lanzando un `Error` con un texto en español, y esta aplicación se lee también
 * en inglés. Un `catch` que pintara ese texto pondría castellano en una interfaz
 * inglesa; un mensaje genérico —«la geometría no es válida»— no diría cuál de
 * las cinco cosas está mal.
 *
 * La copia sería peligrosa si pudiera desviarse en silencio, así que no puede:
 * el gate de este módulo recorre una malla de dimensiones por forma y exige la
 * **equivalencia** en los dos sentidos —hay motivo si y sólo si `buildSection`
 * lanza—. Si alguien cambia una restricción en un sitio y no en el otro, la
 * malla lo encuentra.
 *
 * La autoridad sigue siendo el constructor: el panel sólo aplica lo que
 * `buildSection` devuelve, nunca lo que este módulo opina.
 */

/** Las seis formas que el formulario sabe describir. */
export type SectionBuilderKind = Exclude<BuiltSectionShape['kind'], 'composite'>;

/**
 * `composite` queda fuera a propósito: es una lista de rectángulos con signo,
 * no un puñado de cotas, y no tiene formulario que la exprese. El constructor
 * la sigue aceptando desde código.
 */
export const SECTION_BUILDER_KINDS: readonly SectionBuilderKind[] = [
  'i-shape', 'channel', 'box', 'tube', 'angle', 'rectangle',
];

export type SectionDimensionKey =
  | 'depth' | 'width' | 'webThickness' | 'flangeThickness' | 'thickness' | 'outerDiameter';

/** Todas las cotas a la vez, en unidades base (m). */
export type SectionDimensions = Readonly<Record<SectionDimensionKey, number>>;

/**
 * Qué cotas pide cada forma, en el orden en que se escriben.
 *
 * El estado guarda **las seis siempre**, y cada forma lee las suyas. Así, pasar
 * de doble T a cajón y volver no pierde el espesor de ala que ya estaba escrito:
 * cambiar de forma es cambiar de vista sobre la misma descripción, no empezar de
 * cero.
 */
export const SECTION_DIMENSION_KEYS: Readonly<Record<SectionBuilderKind, readonly SectionDimensionKey[]>> = {
  rectangle: ['depth', 'width'],
  'i-shape': ['depth', 'width', 'webThickness', 'flangeThickness'],
  channel: ['depth', 'width', 'webThickness', 'flangeThickness'],
  angle: ['depth', 'width', 'thickness'],
  box: ['depth', 'width', 'thickness'],
  tube: ['outerDiameter', 'thickness'],
};

/** Un IPE 300 redondeado: una sección que existe, no ceros. */
export const DEFAULT_SECTION_DIMENSIONS: SectionDimensions = {
  depth: 0.3,
  width: 0.15,
  webThickness: 0.007,
  flangeThickness: 0.011,
  thickness: 0.008,
  outerDiameter: 0.15,
};

export const shapeFromDimensions = (
  kind: SectionBuilderKind,
  dimensions: SectionDimensions,
): BuiltSectionShape => {
  switch (kind) {
    case 'rectangle':
      return { kind, depth: dimensions.depth, width: dimensions.width };
    case 'i-shape':
    case 'channel':
      return {
        kind,
        depth: dimensions.depth,
        width: dimensions.width,
        webThickness: dimensions.webThickness,
        flangeThickness: dimensions.flangeThickness,
      };
    case 'angle':
    case 'box':
      return { kind, depth: dimensions.depth, width: dimensions.width, thickness: dimensions.thickness };
    case 'tube':
      return { kind, outerDiameter: dimensions.outerDiameter, thickness: dimensions.thickness };
  }
};

/**
 * Estado inicial del formulario a partir de un perfil del catálogo.
 *
 * La traducción forma ← perfil es `shapeOfStandardSection`, la misma que el
 * catálogo usa para validarse a sí mismo. Empezar desde un W12x26 real y mover
 * un espesor es el caso que este panel existe para servir, y así arranca en una
 * descripción cuya reconstrucción ya está medida contra el catálogo.
 *
 * Las cotas que la forma no usa conservan su valor por defecto: no se inventan
 * a partir de las que sí usa.
 */
export const seedFromStandardSection = (
  section: StandardSection,
): { kind: SectionBuilderKind; dimensions: SectionDimensions } => {
  const shape = shapeOfStandardSection(section);
  const dimensions: Record<SectionDimensionKey, number> = { ...DEFAULT_SECTION_DIMENSIONS };
  if (shape.kind === 'tube') {
    dimensions.outerDiameter = shape.outerDiameter;
    dimensions.thickness = shape.thickness;
  } else if (shape.kind !== 'composite') {
    dimensions.depth = shape.depth;
    dimensions.width = shape.width;
    if (shape.kind === 'i-shape' || shape.kind === 'channel') {
      dimensions.webThickness = shape.webThickness;
      dimensions.flangeThickness = shape.flangeThickness;
    } else if (shape.kind === 'angle' || shape.kind === 'box') {
      dimensions.thickness = shape.thickness;
    }
  }
  // `shapeOfStandardSection` nunca devuelve `composite`; el estrechamiento es
  // para el tipo, no para un caso que pueda ocurrir.
  return { kind: shape.kind === 'composite' ? 'rectangle' : shape.kind, dimensions };
};

export type SectionBuilderIssue =
  | 'non-positive'
  | 'flanges-consume-depth'
  | 'web-wider-than-flange'
  | 'thickness-consumes-leg'
  | 'thickness-closes-hole'
  | 'thickness-closes-tube';

const isPositive = (value: number) => Number.isFinite(value) && value > 0;

/**
 * Por qué una descripción no cierra, o `undefined` si cierra.
 *
 * Devuelve **el** motivo, no la lista: el formulario enseña una frase, y con
 * dos cotas mal la primera basta para que la persona siga adelante.
 */
export const sectionBuilderIssue = (shape: BuiltSectionShape): SectionBuilderIssue | undefined => {
  switch (shape.kind) {
    case 'rectangle':
      return isPositive(shape.depth) && isPositive(shape.width) ? undefined : 'non-positive';
    case 'i-shape':
    case 'channel':
      if (![shape.depth, shape.width, shape.webThickness, shape.flangeThickness].every(isPositive)) return 'non-positive';
      if (2 * shape.flangeThickness >= shape.depth) return 'flanges-consume-depth';
      if (shape.webThickness >= shape.width) return 'web-wider-than-flange';
      return undefined;
    case 'angle':
      if (![shape.depth, shape.width, shape.thickness].every(isPositive)) return 'non-positive';
      if (shape.thickness >= shape.depth || shape.thickness >= shape.width) return 'thickness-consumes-leg';
      return undefined;
    case 'box':
      if (![shape.depth, shape.width, shape.thickness].every(isPositive)) return 'non-positive';
      if (2 * shape.thickness >= shape.depth || 2 * shape.thickness >= shape.width) return 'thickness-closes-hole';
      return undefined;
    case 'tube':
      if (![shape.outerDiameter, shape.thickness].every(isPositive)) return 'non-positive';
      if (2 * shape.thickness >= shape.outerDiameter) return 'thickness-closes-tube';
      return undefined;
    case 'composite':
      return shape.parts.length > 0 ? undefined : 'non-positive';
  }
};

/**
 * Forma dibujable equivalente, para reutilizar el contorno que el Inspector ya
 * pinta. El constructor describe seis formas y el catálogo seis tipos: son las
 * mismas seis, y por eso la vista previa no estrena dibujo propio.
 */
export const SECTION_SHAPE_TYPE_OF_KIND: Readonly<Record<SectionBuilderKind, SectionShapeType>> = {
  rectangle: 'RECT',
  'i-shape': 'I',
  channel: 'C',
  angle: 'L',
  box: 'HSS_RECT',
  tube: 'HSS_ROUND',
};

/** Cotas que `sectionShapeLayout` necesita, tomadas de la descripción y no de A e I. */
export const previewGeometryOf = (
  kind: SectionBuilderKind,
  dimensions: SectionDimensions,
): { depth: number; width: number; web: number; flange: number } => {
  switch (kind) {
    case 'tube':
      return {
        depth: dimensions.outerDiameter,
        width: dimensions.outerDiameter,
        web: dimensions.thickness,
        flange: dimensions.thickness,
      };
    case 'i-shape':
    case 'channel':
      return {
        depth: dimensions.depth,
        width: dimensions.width,
        web: dimensions.webThickness,
        flange: dimensions.flangeThickness,
      };
    case 'angle':
    case 'box':
      return {
        depth: dimensions.depth,
        width: dimensions.width,
        web: dimensions.thickness,
        flange: dimensions.thickness,
      };
    case 'rectangle':
      // El contorno macizo ignora alma y ala; se rellenan para no publicar ceros
      // que un cambio de forma tomaría por cotas escritas.
      return {
        depth: dimensions.depth,
        width: dimensions.width,
        web: dimensions.width / 10,
        flange: dimensions.depth / 10,
      };
  }
};
