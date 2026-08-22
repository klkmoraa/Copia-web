import { findStandardMaterial, standardMaterials, type MaterialCategory } from '../../data/standardMaterials';
import { findStandardSection, standardSections, type SectionShapeType } from '../../data/standardSections';
import { toDisplay, unitLabel } from '../../engine/units';
import { es, translate, type Language, type TranslationKey } from '../../i18n/catalogs';
import type { UnitSystemId } from '../../types';
import { formatInspectorValue } from '../inspector/numericFormatting';
import type { BulkEditCopyKey, BulkEditTranslate } from './bulkEditCopy';
import { BULK_ENTITY_KINDS } from './bulkEditTypes';
import type {
  AggregatedValue,
  BulkEntityKind,
  BulkPropertyId,
  BulkPropertyState,
  BulkSelectionAggregate,
  BulkValue,
} from './bulkEditTypes';

/**
 * Presentación de la edición múltiple: convierte estado agregado en texto.
 *
 * Es un módulo puro para que los componentes queden pequeños y para que las
 * reglas delicadas —«mixto se muestra como Varios», «ausente no es cero»— puedan
 * probarse sin renderizar.
 */

export interface BulkFormatContext {
  t: BulkEditTranslate;
  language: Language;
  units: UnitSystemId;
}

export const bulkPropertyLabel = (t: BulkEditTranslate, id: BulkPropertyId): string =>
  t(`property.${id}`);

/**
 * La clave de una opción se construye a partir del id y del valor. TypeScript no
 * puede estrechar `${string}` a la unión de claves, así que la garantía la da una
 * prueba: `bulkEditCopy.test.ts` comprueba que cada opción declarada por un
 * descriptor tiene su clave en ambos idiomas.
 */
export const bulkOptionLabel = (t: BulkEditTranslate, id: BulkPropertyId, value: string): string =>
  t(`option.${id}.${value}` as BulkEditCopyKey);

/**
 * Nombre localizado de un preset del catálogo. Las claves `preset.*` ya existen
 * en el catálogo global y son mecánicas; un id sin entrada cae al nombre técnico
 * del catálogo, que es neutral al idioma en las designaciones comerciales.
 */
const presetLabel = (language: Language, key: string, fallback: string): string =>
  key in es ? translate(language, key as TranslationKey) : fallback;

export const bulkMaterialLabel = (language: Language, materialId: string): string => {
  const material = findStandardMaterial(materialId);
  return material ? presetLabel(language, `preset.material.${material.id}`, material.name) : materialId;
};

export const bulkSectionLabel = (language: Language, sectionId: string): string => {
  const section = findStandardSection(sectionId);
  return section ? presetLabel(language, `preset.section.${section.id}`, section.name) : sectionId;
};

const propertyUnit = (state: BulkPropertyState, units: UnitSystemId): string =>
  state.quantity ? unitLabel(units, state.quantity) : state.unit ?? '';

/** Un valor concreto ya resuelto: nunca recibe `mixed` ni `incompatible`. */
export const formatBulkValue = (
  state: BulkPropertyState,
  value: BulkValue,
  { t, language, units }: BulkFormatContext,
): string => {
  if (value === undefined) return t('value.empty');
  switch (state.kind) {
    case 'boolean':
      return value === true ? t('value.true') : t('value.false');
    case 'number':
      return typeof value === 'number'
        ? formatInspectorValue(state.quantity ? toDisplay(value, units, state.quantity) : value, propertyUnit(state, units))
        : String(value);
    case 'material':
      return bulkMaterialLabel(language, String(value));
    case 'section':
      return bulkSectionLabel(language, String(value));
    case 'enum':
      return bulkOptionLabel(t, state.id, String(value));
  }
};

/**
 * `mixed` se muestra siempre como «Varios». No se elige un representante ni se
 * colapsa a `false`: ese es exactamente el fallo que esta capa debe impedir.
 */
export const formatAggregatedValue = (
  state: BulkPropertyState,
  value: AggregatedValue,
  context: BulkFormatContext,
): string => {
  switch (value.state) {
    case 'incompatible':
      return context.t('value.unavailable');
    case 'mixed':
      return context.t('value.mixed');
    case 'same':
      return formatBulkValue(state, value.value, context);
  }
};

export interface BulkPropertyOption {
  value: string;
  label: string;
  /** Agrupación opcional para catálogos largos. */
  group?: string;
}

const MATERIAL_CATEGORY_KEYS: Record<MaterialCategory, TranslationKey> = {
  STEEL: 'inspector.materialCategorySteel',
  CONCRETE: 'inspector.materialCategoryConcrete',
  TIMBER: 'inspector.materialCategoryTimber',
  ALUMINUM: 'inspector.materialCategoryAluminum',
};

const SECTION_SHAPE_ORDER: readonly SectionShapeType[] = ['I', 'HSS_RECT', 'HSS_ROUND', 'C', 'L', 'RECT'];

const SECTION_SHAPE_KEYS: Record<SectionShapeType, TranslationKey> = {
  I: 'inspector.sectionShapeI',
  HSS_RECT: 'inspector.sectionShapeHssRect',
  HSS_ROUND: 'inspector.sectionShapeHssRound',
  C: 'inspector.sectionShapeC',
  L: 'inspector.sectionShapeL',
  RECT: 'inspector.sectionShapeRect',
};

/**
 * Catálogo completo de materiales o de secciones, ya agrupado y traducido.
 *
 * Se separa de `bulkPropertyOptions` porque el catálogo no depende del estado
 * agregado de ninguna selección: es el mismo para la edición múltiple y para el
 * datasheet, que no tiene agregación que ofrecer.
 */
export const bulkCatalogOptions = (
  kind: 'material' | 'section',
  language: Language,
): readonly BulkPropertyOption[] => kind === 'material'
  ? standardMaterials.map((material) => ({
    value: material.id,
    label: bulkMaterialLabel(language, material.id),
    group: translate(language, MATERIAL_CATEGORY_KEYS[material.category]),
  }))
  : SECTION_SHAPE_ORDER.flatMap((shapeType) => standardSections
    .filter((section) => section.shapeType === shapeType)
    .map((section) => ({
      value: section.id,
      label: bulkSectionLabel(language, section.id),
      group: translate(language, SECTION_SHAPE_KEYS[shapeType]),
    })));

/** Opciones que el usuario puede fijar. No incluye `untouched` ni `clear`. */
export const bulkPropertyOptions = (
  state: BulkPropertyState,
  { t, language }: BulkFormatContext,
): readonly BulkPropertyOption[] => {
  switch (state.kind) {
    case 'enum':
      return (state.options ?? []).map((option) => ({ value: option, label: bulkOptionLabel(t, state.id, option) }));
    case 'material':
    case 'section':
      return bulkCatalogOptions(state.kind, language);
    default:
      return [];
  }
};

export interface BulkPropertyOptionGroup {
  /** `undefined` en las listas planas, que no llevan `optgroup`. */
  label?: string;
  options: readonly BulkPropertyOption[];
}

/**
 * Las opciones ya agrupadas, que es la única forma en que el `select` las usa.
 * Agrupar aquí evita que el componente derive los grupos y vuelva a filtrar la
 * lista plana una vez por grupo.
 */
export const bulkPropertyOptionGroups = (
  state: BulkPropertyState,
  context: BulkFormatContext,
): readonly BulkPropertyOptionGroup[] => {
  const options = bulkPropertyOptions(state, context);
  const groups = new Map<string, BulkPropertyOption[]>();
  const ungrouped: BulkPropertyOption[] = [];
  for (const option of options) {
    if (option.group === undefined) ungrouped.push(option);
    else {
      const bucket = groups.get(option.group);
      if (bucket) bucket.push(option);
      else groups.set(option.group, [option]);
    }
  }
  return [
    ...(ungrouped.length > 0 ? [{ options: ungrouped }] : []),
    ...[...groups].map(([label, grouped]) => ({ label, options: grouped })),
  ];
};

export interface BulkScopeRow {
  kind: BulkEntityKind;
  selected: number;
  compatible: number;
  incompatible: number;
}

/**
 * Reparto exacto del alcance, familia por familia.
 *
 * Sustituye al contador global anterior, que restaba un conjunto que incluía las
 * cargas de un total que no las contaba y podía dar un número negativo. Aquí
 * cada fila se cierra sobre su propia familia: `compatible + incompatible`
 * siempre es `selected`, y una familia que no está en el alcance no aparece.
 *
 * «Compatible» significa que alguna propiedad **editable** admite ese objeto; un
 * objeto que ninguna admite se cuenta como incompatible en lugar de desaparecer.
 */
export const bulkScopeBreakdown = (aggregate: BulkSelectionAggregate): readonly BulkScopeRow[] => {
  const compatible = new Set<string>();
  for (const property of aggregate.properties) {
    if (!property.editable) continue;
    for (const target of property.compatibility.compatible) compatible.add(`${target.kind}:${target.id}`);
  }

  return BULK_ENTITY_KINDS.flatMap((kind) => {
    const selected = aggregate.counts[kind];
    if (selected === 0) return [];
    const accepted = aggregate.targets.filter(
      (target) => target.kind === kind && compatible.has(`${target.kind}:${target.id}`),
    ).length;
    return [{ kind, selected, compatible: accepted, incompatible: selected - accepted }];
  });
};
