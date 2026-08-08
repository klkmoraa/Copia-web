import { useState } from 'react';
import { standardSections, type SectionShapeType, type StandardSection } from '../../data/standardSections';
import { toDisplay, unitLabel } from '../../engine/units';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { UnitSystemId } from '../../types';
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
 * activo. Recuerda el perfil elegido para que el usuario lo siga viendo en pantalla,
 * pero solo mientras el miembro conserve esos valores: si A o I se editan a mano, el
 * selector vuelve al placeholder en lugar de mentir sobre el perfil aplicado. El
 * remontaje por selección (`key` en el llamador) evita arrastrar el perfil de un
 * miembro al siguiente.
 */
export const SectionPresetSelector = ({
  units,
  current,
  disabled,
  onSelect,
}: {
  units: UnitSystemId;
  /** Valores vigentes del miembro; si dejan de coincidir, el perfil deja de mostrarse. */
  current: { A: number; I: number };
  disabled?: boolean;
  onSelect: (section: StandardSection) => void;
}) => {
  const { t } = useI18n();
  const sectionLabel = (section: StandardSection) => {
    const key = SECTION_LABEL_KEYS[section.id];
    return key ? t(key) : section.name;
  };
  const [selectedId, setSelectedId] = useState('');
  const selected = standardSections.find((section) => section.id === selectedId);
  const activeId = selected && selected.area === current.A && selected.inertiaX === current.I
    ? selectedId
    : '';
  return (
    <label className={`select-field${disabled ? ' is-disabled' : ''}`}>
      <span>{t('inspector.sectionPreset')}<small>{t('inspector.sectionPresetHint')}</small></span>
      <select
        value={activeId}
        disabled={disabled}
        onChange={(event) => {
          const section = standardSections.find((item) => item.id === event.target.value);
          if (!section) return;
          setSelectedId(section.id);
          onSelect(section);
        }}
      >
        <option value="" disabled>{t('inspector.sectionPresetPlaceholder')}</option>
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
