import { toDisplay, unitLabel, type UnitQuantity } from '../../engine/units';
import type { Language, TranslationKey } from '../../i18n/catalogs';
import type { ProjectModel, UnitSystemId } from '../../types';
import { formatNumber } from '../../utils/numberFormat';
import { bulkCatalogOptions, bulkMaterialLabel, bulkSectionLabel } from '../bulk-edit/bulkEditPresentation';
import { serializeInspectorNumber } from '../inspector/numericFormatting';
import type { DatasheetField, DatasheetFieldId } from './datasheetEditModel';
import type { DatasheetColumn, DatasheetEditability, DatasheetValue } from './datasheetModel';

/**
 * Paso de unidad base a texto leído.
 *
 * Está separado de `datasheetModel.ts` a propósito: el modelo ordena y filtra
 * con magnitudes internas, y aquí —y sólo aquí— se convierten al sistema del
 * proyecto. Mezclarlo haría que la misma columna ordenase distinto según las
 * unidades mostradas.
 */

/** Presentación de una celda: `formatNumber(…, 'table')` es la política común. */
export const formatDatasheetNumber = (
  value: number,
  units: UnitSystemId,
  quantity?: UnitQuantity,
): string => formatNumber(quantity ? toDisplay(value, units, quantity) : value, 'table');

export const datasheetCellText = (
  value: DatasheetValue | undefined,
  units: UnitSystemId,
  t: (key: TranslationKey) => string,
): string => {
  if (!value) return '—';
  if (value.kind === 'text') return value.text;
  if (value.kind === 'token') return t(value.labelKey);
  if (value.kind === 'ref') return value.label;
  return value.value === null ? '—' : formatDatasheetNumber(value.value, units, value.quantity);
};

/** Cabecera con su unidad: `x (m)`. Una columna adimensional no lleva paréntesis. */
export const datasheetColumnHeader = (
  column: DatasheetColumn,
  units: UnitSystemId,
  t: (key: TranslationKey) => string,
): string => {
  const label = t(column.labelKey);
  return column.quantity ? `${label} (${unitLabel(units, column.quantity)})` : label;
};

const EDITABILITY_MESSAGES: Record<DatasheetEditability, TranslationKey> = {
  identity: 'datasheet.readOnly.identity',
  derived: 'datasheet.readOnly.derived',
  inline: 'datasheet.edit.inlineHint',
  panel: 'datasheet.edit.panelHint',
};

/**
 * Lo que se anuncia al intentar editar una celda.
 *
 * Cada motivo dice algo distinto y verdadero: una identidad no se editará nunca,
 * un valor derivado se cambia editando su origen, y una celda editable dice
 * dónde se edita. Un mensaje único los haría indistinguibles, y el silencio
 * sería peor todavía.
 */
export const editabilityMessageKey = (editability: DatasheetEditability): TranslationKey =>
  EDITABILITY_MESSAGES[editability];

/**
 * Texto con el que se **abre** el editor.
 *
 * No es el texto de lectura. Un número se sirve sin redondear para que
 * confirmar la celda sin tocar nada no altere el valor: la presentación reduce
 * la precisión a propósito, y devolver ese texto al modelo la perdería de
 * verdad.
 */
export const datasheetEditorText = (
  value: DatasheetValue | undefined,
  units: UnitSystemId,
  field: DatasheetField,
): string => {
  if (!value) return '';
  if (value.kind === 'ref') return value.id;
  if (value.kind === 'token') return value.token;
  if (value.kind === 'text') return value.text;
  if (value.value === null) return '';
  return serializeInspectorNumber(
    field.quantity ? toDisplay(value.value, units, field.quantity) : value.value,
  );
};

/**
 * Clave de la etiqueta de cada opción de un enumerado.
 *
 * Es un `Record` explícito y no una plantilla `${}` porque una clave construida
 * no la verifica TypeScript: una opción sin traducción saldría como el propio
 * identificador en producción en vez de romper la compilación.
 */
const OPTION_LABELS: Partial<Record<DatasheetFieldId, Readonly<Record<string, TranslationKey>>>> = {
  'node.support.type': {
    none: 'datasheet.support.none',
    pin: 'datasheet.support.pin',
    roller: 'datasheet.support.roller',
    fixed: 'datasheet.support.fixed',
    custom: 'datasheet.support.custom',
  },
  'member.type': {
    frame: 'datasheet.memberType.frame',
    truss: 'datasheet.memberType.truss',
    rigid: 'datasheet.memberType.rigid',
  },
  'memberLoad.coordinateSystem': {
    global: 'datasheet.coordinateSystem.global',
    local: 'datasheet.coordinateSystem.local',
  },
  'memberLoad.lengthBasis': {
    real: 'datasheet.lengthBasis.real',
    horizontal: 'datasheet.lengthBasis.horizontal',
    vertical: 'datasheet.lengthBasis.vertical',
  },
};

/**
 * Un valor del plan, que viaja en unidades base, tal como debe leerse.
 *
 * Es la única conversión de salida del plan: la revisión enseña lo que el
 * usuario vería en la tabla, no el número interno con el que se escribe.
 */
export const formatPlannedValue = (
  value: string | number | boolean | undefined,
  field: DatasheetField,
  units: UnitSystemId,
  language: Language,
  t: (key: TranslationKey) => string,
): string => {
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return t(value ? 'datasheet.boolean.yes' : 'datasheet.boolean.no');
  if (typeof value === 'number') return formatDatasheetNumber(value, units, field.quantity);
  if (field.kind === 'material') return bulkMaterialLabel(language, value);
  if (field.kind === 'section') return bulkSectionLabel(language, value);
  const labelKey = OPTION_LABELS[field.id]?.[value];
  // Un caso de carga no tiene traducción: su etiqueta la escribe el usuario y el
  // llamador la resuelve contra el proyecto, así que aquí queda su identificador.
  return labelKey ? t(labelKey) : value;
};

export interface DatasheetFieldOption {
  value: string;
  label: string;
  /** Agrupación de los catálogos largos; ausente en las listas planas. */
  group?: string;
}

/**
 * Opciones del editor: la unión del dominio, el catálogo, o los casos que
 * declara este proyecto concreto.
 */
export const datasheetFieldOptions = (
  field: DatasheetField,
  project: ProjectModel,
  language: Language,
  t: (key: TranslationKey) => string,
): readonly DatasheetFieldOption[] => {
  if (field.optionsFrom === 'loadCases') {
    return project.loadCases.map((item) => ({ value: item.id, label: item.name }));
  }
  if (field.kind === 'material' || field.kind === 'section') {
    return bulkCatalogOptions(field.kind, language);
  }
  const labels = OPTION_LABELS[field.id];
  return (field.options ?? []).map((option) => ({
    value: option,
    label: labels?.[option] ? t(labels[option]) : option,
  }));
};
