import { findStandardSection, standardSections, type SectionShapeType, type StandardSection } from '../../data/standardSections';
import { toDisplay, unitLabel } from '../../engine/units';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { MemberPropertyOrigin, UnitSystemId } from '../../types';
import { formatInspectorValue } from './numericFormatting';

const SHAPE_ORDER: readonly SectionShapeType[] = ['I', 'HSS_RECT', 'HSS_ROUND', 'C', 'L', 'RECT'];

const SHAPE_LABEL_KEYS: Record<SectionShapeType, TranslationKey> = {
  I: 'inspector.sectionShapeI',
  HSS_RECT: 'inspector.sectionShapeHssRect',
  HSS_ROUND: 'inspector.sectionShapeHssRound',
  C: 'inspector.sectionShapeC',
  L: 'inspector.sectionShapeL',
  RECT: 'inspector.sectionShapeRect',
};

/**
 * Nombre traducible para las secciones genéricas, cuyo nombre en `src/data` está
 * en español (frontera protegida). Las designaciones comerciales (W12x26, IPE 300,
 * HSS…) son neutrales al idioma y se muestran tal cual desde el catálogo.
 */
const SECTION_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
  'rect-concrete-200x300': 'preset.section.rect-concrete-200x300',
  'rect-concrete-300x500': 'preset.section.rect-concrete-300x500',
  'rect-concrete-400x400': 'preset.section.rect-concrete-400x400',
  'rect-timber-100x200': 'preset.section.rect-timber-100x200',
};

/**
 * Selecciona un perfil comercial del catálogo estándar y aplica A e I al miembro
 * activo. La selección visible se resuelve exclusivamente mediante la identidad
 * persistida del miembro; A e I no se usan para adivinarla.
 */
export const SectionPresetSelector = ({
  units,
  selectedId,
  origin,
  disabled,
  onSelect,
}: {
  units: UnitSystemId;
  selectedId?: string;
  origin?: MemberPropertyOrigin;
  disabled?: boolean;
  onSelect: (section: StandardSection) => void;
}) => {
  const { t } = useI18n();
  const sectionLabel = (section: StandardSection) => {
    const key = SECTION_LABEL_KEYS[section.id];
    return key ? t(key) : section.name;
  };
  const selected = origin === 'catalog' && selectedId ? findStandardSection(selectedId) : undefined;
  const activeId = selected?.id ?? '';
  const identityLabel = origin === 'custom'
    ? t('inspector.identityCustom')
    : origin === 'imported'
      ? t('inspector.identityImported')
      : origin === 'catalog'
        ? t('inspector.identityCatalogUnavailable')
        : t('inspector.identityLegacy');
  return (
    <label className={`select-field${disabled ? ' is-disabled' : ''}`}>
      <span>{t('inspector.sectionPreset')}<small>{t('inspector.sectionPresetHint')}</small></span>
      <select
        value={activeId}
        data-identity-origin={origin ?? 'legacy'}
        disabled={disabled}
        onChange={(event) => {
          const section = standardSections.find((item) => item.id === event.target.value);
          if (!section) return;
          onSelect(section);
        }}
      >
        <option value="" disabled>{identityLabel}</option>
        {SHAPE_ORDER.map((shapeType) => {
          const items = standardSections.filter((section) => section.shapeType === shapeType);
          if (items.length === 0) return null;
          return (
            <optgroup key={shapeType} label={t(SHAPE_LABEL_KEYS[shapeType])}>
              {items.map((section) => (
                <option key={section.id} value={section.id}>
                  {sectionLabel(section)} · A {formatInspectorValue(toDisplay(section.area, units, 'area'), unitLabel(units, 'area'))}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </label>
  );
};
