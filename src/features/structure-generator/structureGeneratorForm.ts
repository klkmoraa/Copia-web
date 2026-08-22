import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { SpacingSpec } from '../../data/generators/generatorSpacing';
import { MAX_SPACING_DIVISIONS } from '../../data/generators/generatorSpacing';
import type {
  GeneratorKind,
  GeneratorParams,
  GridMemberMode,
  TrussTopology,
} from '../../data/generators/generatorTypes';
import { fromDisplay, toDisplay } from '../../engine/units';
import { serializeNumber } from '../../utils/numberFormat';
import type { SupportDefinition, SupportType, UnitSystemId } from '../../types';

/**
 * Traducción del formulario de «Generar estructura» a parámetros del núcleo
 * (CRI-38, fase 3).
 *
 * Es puro y no conoce React: recibe el texto tal como se escribió y devuelve o
 * unos `GeneratorParams` válidos, o los errores por campo que impiden
 * construirlos. Esa separación es la que permite probar cada familia, cada
 * separación irregular y cada mensaje sin montar un solo componente, y es la
 * misma frontera que ya respetan la edición múltiple y la edición estructural.
 *
 * Todo lo que se teclea está en las unidades que el proyecto muestra y todo lo
 * que sale está en las internas, igual que en la edición estructural: la
 * conversión ocurre aquí y una sola vez, de modo que ninguna coordenada llega
 * al núcleo en pies creyéndose metros.
 *
 * El formulario no valida geometría: eso ya lo hace el núcleo, y duplicarlo
 * produciría dos verdades. Aquí sólo se comprueba lo que impide *formar* los
 * parámetros —un número que no es número, una lista vacía, un catálogo
 * inexistente— y el resto se deja fallar donde vive la regla.
 */

export type GeneratorSpacingMode = 'uniform' | 'list';

/** Apoyo base ofrecido por la superficie; `none` es el valor seguro por defecto. */
export type GeneratorSupportChoice = Extract<SupportType, 'none' | 'pin' | 'roller' | 'fixed'>;

export type GeneratorPropertiesSource = 'catalog' | 'explicit';

/**
 * Una separación tal como se captura. Los dos modos conviven en el mismo
 * borrador —y no en uno que se pierde al cambiar de modo— para que alternar
 * entre uniforme y personalizada no borre lo ya escrito.
 */
export interface GeneratorSpacingDraft {
  readonly mode: GeneratorSpacingMode;
  readonly count: string;
  readonly spacing: string;
  readonly list: string;
}

export interface GeneratorFormState {
  readonly family: GeneratorKind;
  readonly originX: string;
  readonly originY: string;
  readonly spans: GeneratorSpacingDraft;
  readonly bays: GeneratorSpacingDraft;
  readonly height: string;
  readonly stories: GeneratorSpacingDraft;
  readonly topology: TrussTopology;
  readonly panels: GeneratorSpacingDraft;
  readonly depth: string;
  readonly includeVerticals: boolean;
  readonly columns: GeneratorSpacingDraft;
  readonly rows: GeneratorSpacingDraft;
  readonly gridMembers: GridMemberMode;
  readonly support: GeneratorSupportChoice;
  readonly propertiesSource: GeneratorPropertiesSource;
  readonly materialId: string;
  readonly sectionId: string;
  readonly elasticModulus: string;
  readonly area: string;
  readonly inertia: string;
}

/** Campos que pueden señalar un error; el panel los usa para colocarlo. */
export type GeneratorFormField =
  | 'originX'
  | 'originY'
  | 'spans'
  | 'bays'
  | 'height'
  | 'stories'
  | 'topology'
  | 'panels'
  | 'depth'
  | 'columns'
  | 'rows'
  | 'materialId'
  | 'sectionId'
  | 'elasticModulus'
  | 'area'
  | 'inertia';

export type GeneratorFormErrors = Readonly<Partial<Record<GeneratorFormField, string>>>;

export type GeneratorFormParseResult =
  | { readonly ok: true; readonly params: GeneratorParams }
  | { readonly ok: false; readonly errors: GeneratorFormErrors };

const uniformSpacing = (count: string, spacing: string): GeneratorSpacingDraft =>
  ({ mode: 'uniform', count, spacing, list: '' });

/**
 * Valores iniciales. Son un punto de partida editable, no una plantilla: cada
 * cifra es una que el usuario cambiaría de todos modos, y ninguna introduce
 * apoyos, cargas ni propiedades que no haya pedido — el apoyo nace en `none`.
 */
export const DEFAULT_GENERATOR_FORM: GeneratorFormState = {
  family: 'continuous-beam',
  originX: '0',
  originY: '0',
  spans: uniformSpacing('3', '5'),
  bays: uniformSpacing('2', '6'),
  height: '4',
  stories: uniformSpacing('3', '3.5'),
  topology: 'pratt',
  panels: uniformSpacing('8', '1.5'),
  depth: '1.8',
  includeVerticals: true,
  columns: uniformSpacing('4', '6'),
  rows: uniformSpacing('3', '3.5'),
  gridMembers: 'both',
  support: 'none',
  propertiesSource: 'catalog',
  materialId: 'steel-a992',
  sectionId: 'w12x53',
  // Vacías a propósito: no hay un E, un A ni una I «por defecto». Al elegir
  // propiedades personalizadas, la superficie las siembra con los números que
  // el catálogo activo ya resolvía, para partir de lo que se tenía y no de una
  // cifra inventada.
  elasticModulus: '',
  area: '',
  inertia: '',
};

/**
 * Los números del catálogo elegido, en las unidades que se muestran. Es lo que
 * llena los campos personalizados al cambiar de origen: personalizar es partir
 * de lo que había, no empezar en blanco ni en una constante inventada.
 */
export const explicitPropertiesFromCatalog = (
  materialId: string,
  sectionId: string,
  units: UnitSystemId,
): { readonly elasticModulus: string; readonly area: string; readonly inertia: string } | null => {
  const material = findStandardMaterial(materialId);
  const section = findStandardSection(sectionId);
  if (!material || !section) return null;
  // `serializeNumber`, no un formateador de lectura: estos campos se van a
  // editar, y redondear la inercia del catálogo al sembrarla convertiría
  // «personalizar» en «perder cifras» sin avisar.
  const display = (value: number, quantity: 'elasticModulus' | 'area' | 'inertia') =>
    serializeNumber(toDisplay(value, units, quantity));
  return {
    elasticModulus: display(material.elasticModulus, 'elasticModulus'),
    area: display(section.area, 'area'),
    inertia: display(section.inertiaX, 'inertia'),
  };
};

/** Familias en el orden en que se ofrecen; de la más simple a la más compuesta. */
export const GENERATOR_FAMILIES: readonly GeneratorKind[] = [
  'continuous-beam',
  'portal-frame',
  'multi-story-frame',
  'truss',
  'grid',
];

export const TRUSS_TOPOLOGIES: readonly TrussTopology[] = ['pratt', 'warren', 'howe'];

export const GRID_MEMBER_MODES: readonly GridMemberMode[] = ['both', 'horizontal', 'vertical', 'none'];

export const GENERATOR_SUPPORT_CHOICES: readonly GeneratorSupportChoice[] = ['none', 'pin', 'roller', 'fixed'];

/**
 * Qué separaciones pide cada familia, en el orden en que se muestran. El panel
 * lee esto en vez de repetir el `switch`, así que añadir una familia al núcleo
 * no deja la superficie mostrando campos de otra.
 */
export const GENERATOR_SPACING_FIELDS: Readonly<Record<GeneratorKind, readonly GeneratorSpacingField[]>> = {
  'continuous-beam': ['spans'],
  'portal-frame': ['bays'],
  'multi-story-frame': ['bays', 'stories'],
  truss: ['panels'],
  grid: ['columns', 'rows'],
};

export type GeneratorSpacingField = Extract<
  GeneratorFormField,
  'spans' | 'bays' | 'stories' | 'panels' | 'columns' | 'rows'
>;

/**
 * Un número escrito a mano. Se acepta la coma decimal porque el producto se usa
 * en español, y se rechaza el texto vacío en vez de tratarlo como cero: un campo
 * en blanco es una decisión pendiente, no un valor.
 */
const parseNumber = (text: string): number | null => {
  const normalized = text.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

/**
 * Lista de separaciones no uniformes. Separadores admitidos: coma, punto y coma,
 * espacio o salto de línea, para que pegar una columna de una hoja de cálculo
 * funcione igual que teclearla. La coma decimal no se admite aquí: sería
 * ambigua frente al separador de elementos.
 */
export const parseSpacingList = (text: string): readonly (number | null)[] => text
  .split(/[\s,;]+/)
  .map((token) => token.trim())
  .filter((token) => token.length > 0)
  .map((token) => {
    const value = Number(token);
    return Number.isFinite(value) ? value : null;
  });

const spacingErrorMessage = (draft: GeneratorSpacingDraft): string | null => {
  if (draft.mode === 'uniform') {
    const count = parseNumber(draft.count);
    if (count === null || !Number.isInteger(count) || count < 1) {
      return 'Escribe una cantidad entera de al menos 1.';
    }
    if (count > MAX_SPACING_DIVISIONS) return `Admite hasta ${MAX_SPACING_DIVISIONS} divisiones.`;
    const spacing = parseNumber(draft.spacing);
    if (spacing === null || spacing <= 0) return 'Escribe una separación mayor que cero.';
    return null;
  }

  const values = parseSpacingList(draft.list);
  if (!values.length) return 'Escribe al menos una separación, separada por comas o espacios.';
  if (values.length > MAX_SPACING_DIVISIONS) return `Admite hasta ${MAX_SPACING_DIVISIONS} divisiones.`;
  const invalid = values.findIndex((value) => value === null || value <= 0);
  if (invalid >= 0) return `La separación ${invalid + 1} debe ser un número mayor que cero.`;
  return null;
};

/**
 * Resuelve una separación capturada. Devuelve el error en vez de lanzarlo
 * porque el formulario está incompleto la mayor parte del tiempo que existe: un
 * campo a medio escribir no es una excepción, es el estado normal.
 */
export const parseSpacingDraft = (
  draft: GeneratorSpacingDraft,
): { readonly ok: true; readonly spec: SpacingSpec } | { readonly ok: false; readonly error: string } => {
  const error = spacingErrorMessage(draft);
  if (error) return { ok: false, error };
  if (draft.mode === 'uniform') {
    return { ok: true, spec: { kind: 'uniform', count: parseNumber(draft.count)!, spacing: parseNumber(draft.spacing)! } };
  }
  return { ok: true, spec: { kind: 'list', values: parseSpacingList(draft.list) as readonly number[] } };
};

/** El número de divisiones que la separación ya describe, para el resumen en vivo. */
export const spacingDraftDivisions = (draft: GeneratorSpacingDraft): number | null => {
  const parsed = parseSpacingDraft(draft);
  if (!parsed.ok) return null;
  return parsed.spec.kind === 'uniform' ? parsed.spec.count : parsed.spec.values.length;
};

const resolveSupport = (choice: GeneratorSupportChoice): SupportDefinition | undefined =>
  choice === 'none' ? undefined : { type: choice };

interface Collector {
  readonly errors: Partial<Record<GeneratorFormField, string>>;
  /** Separación capturada en unidades de pantalla, devuelta ya en internas. */
  spacing: (field: GeneratorSpacingField, draft: GeneratorSpacingDraft) => SpacingSpec;
  positive: (
    field: GeneratorFormField,
    text: string,
    message: string,
    quantity?: 'length' | 'elasticModulus' | 'area' | 'inertia',
  ) => number;
}

const createCollector = (units: UnitSystemId): Collector => {
  const errors: Partial<Record<GeneratorFormField, string>> = {};
  return {
    errors,
    spacing: (field, draft) => {
      const parsed = parseSpacingDraft(draft);
      if (!parsed.ok) {
        errors[field] = parsed.error;
        // El marcador nunca llega al núcleo: la presencia de un error descarta
        // el resultado entero antes de devolverlo.
        return { kind: 'uniform', count: 1, spacing: 1 };
      }
      const internal = (value: number) => fromDisplay(value, units, 'length');
      return parsed.spec.kind === 'uniform'
        ? { kind: 'uniform', count: parsed.spec.count, spacing: internal(parsed.spec.spacing) }
        : { kind: 'list', values: parsed.spec.values.map(internal) };
    },
    positive: (field, text, message, quantity = 'length') => {
      const value = parseNumber(text);
      if (value === null || value <= 0) {
        errors[field] = message;
        return 1;
      }
      return fromDisplay(value, units, quantity);
    },
  };
};

/**
 * Construye los parámetros de la familia activa. Sólo se leen los campos de esa
 * familia: un valor inválido en otra —por ejemplo, un peralte en blanco
 * mientras se genera una viga— no puede bloquear la generación actual.
 */
export const buildGeneratorParams = (
  form: GeneratorFormState,
  units: UnitSystemId,
): GeneratorFormParseResult => {
  const collector = createCollector(units);
  const { errors } = collector;

  const originX = parseNumber(form.originX);
  if (originX === null) errors.originX = 'Escribe un número.';
  const originY = parseNumber(form.originY);
  if (originY === null) errors.originY = 'Escribe un número.';

  let properties: GeneratorParams['properties'];
  if (form.propertiesSource === 'catalog') {
    if (!findStandardMaterial(form.materialId)) errors.materialId = 'Elige un material del catálogo.';
    if (!findStandardSection(form.sectionId)) errors.sectionId = 'Elige una sección del catálogo.';
    properties = { kind: 'catalog', materialId: form.materialId, sectionId: form.sectionId };
  } else {
    properties = {
      kind: 'explicit',
      E: collector.positive('elasticModulus', form.elasticModulus, 'Escribe un módulo E mayor que cero.', 'elasticModulus'),
      A: collector.positive('area', form.area, 'Escribe un área A mayor que cero.', 'area'),
      I: collector.positive('inertia', form.inertia, 'Escribe una inercia I mayor que cero.', 'inertia'),
    };
  }

  const common = {
    origin: {
      x: fromDisplay(originX ?? 0, units, 'length'),
      y: fromDisplay(originY ?? 0, units, 'length'),
    },
    properties,
    ...(resolveSupport(form.support) ? { baseSupport: resolveSupport(form.support)! } : {}),
  };

  let params: GeneratorParams;
  switch (form.family) {
    case 'continuous-beam':
      params = { ...common, kind: 'continuous-beam', spans: collector.spacing('spans', form.spans) };
      break;
    case 'portal-frame':
      params = {
        ...common,
        kind: 'portal-frame',
        bays: collector.spacing('bays', form.bays),
        height: collector.positive('height', form.height, 'Escribe una altura mayor que cero.'),
      };
      break;
    case 'multi-story-frame':
      params = {
        ...common,
        kind: 'multi-story-frame',
        bays: collector.spacing('bays', form.bays),
        stories: collector.spacing('stories', form.stories),
      };
      break;
    case 'truss':
      if (!TRUSS_TOPOLOGIES.includes(form.topology)) errors.topology = 'Elige una topología de cercha.';
      params = {
        ...common,
        kind: 'truss',
        topology: form.topology,
        panels: collector.spacing('panels', form.panels),
        depth: collector.positive('depth', form.depth, 'Escribe un peralte mayor que cero.'),
        includeVerticals: form.includeVerticals,
      };
      break;
    case 'grid':
      params = {
        ...common,
        kind: 'grid',
        columns: collector.spacing('columns', form.columns),
        rows: collector.spacing('rows', form.rows),
        members: form.gridMembers,
      };
      break;
    default:
      return { ok: false, errors: {} };
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, params };
};

/**
 * Identidad de unos parámetros. La superficie la usa para no volver a generar
 * —ni a redibujar el ghost— cuando una pulsación no cambió nada que el núcleo
 * pueda ver, como pasar de `5` a `5.` mientras se teclea.
 */
export const generatorParamsSignature = (params: GeneratorParams): string => JSON.stringify(params);
