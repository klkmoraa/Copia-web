import { useState } from 'react';
import { standardMaterials, type MaterialCategory, type StandardMaterial } from '../../data/standardMaterials';
import { toDisplay, unitLabel } from '../../engine/units';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { UnitSystemId } from '../../types';
import { formatInspectorValue } from './numericFormatting';

const CATEGORY_ORDER: readonly MaterialCategory[] = ['STEEL', 'CONCRETE', 'TIMBER', 'ALUMINUM'];

const CATEGORY_LABEL_KEYS: Record<MaterialCategory, TranslationKey> = {
  STEEL: 'inspector.materialCategorySteel',
  CONCRETE: 'inspector.materialCategoryConcrete',
  TIMBER: 'inspector.materialCategoryTimber',
  ALUMINUM: 'inspector.materialCategoryAluminum',
};

/**
 * Nombre corto y traducible por material. El catálogo de `src/data` guarda la
 * designación completa en español (frontera protegida); aquí se presenta una
 * etiqueta compacta y localizada. Un id sin entrada cae al nombre del catálogo.
 */
const MATERIAL_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
  'steel-a36': 'preset.material.steel-a36',
  'steel-a992': 'preset.material.steel-a992',
  'steel-a500-grade-b': 'preset.material.steel-a500-grade-b',
  'steel-stainless-aisi304': 'preset.material.steel-stainless-aisi304',
  'concrete-21mpa': 'preset.material.concrete-21mpa',
  'concrete-28mpa': 'preset.material.concrete-28mpa',
  'concrete-35mpa': 'preset.material.concrete-35mpa',
  'concrete-42mpa': 'preset.material.concrete-42mpa',
  'timber-c18': 'preset.material.timber-c18',
  'timber-c24': 'preset.material.timber-c24',
  'timber-gl24h': 'preset.material.timber-gl24h',
  'aluminum-6061-t6': 'preset.material.aluminum-6061-t6',
};

/**
 * Selecciona un material del catálogo estándar y aplica E, G y densidad al miembro
 * activo. Recuerda el preset elegido para que el usuario lo siga viendo en pantalla,
 * pero solo mientras el miembro conserve esos valores: si E, G o la densidad se
 * editan a mano, el selector vuelve al placeholder en lugar de mentir sobre el
 * material aplicado. El remontaje por selección (`key` en el llamador) evita
 * arrastrar el preset de un miembro al siguiente.
 */
export const MaterialPresetSelector = ({
  units,
  current,
  disabled,
  onSelect,
}: {
  units: UnitSystemId;
  /** Valores vigentes del miembro; si dejan de coincidir, el preset deja de mostrarse. */
  current: { E: number; G?: number; density?: number };
  disabled?: boolean;
  onSelect: (material: StandardMaterial) => void;
}) => {
  const { t } = useI18n();
  const materialLabel = (material: StandardMaterial) => {
    const key = MATERIAL_LABEL_KEYS[material.id];
    return key ? t(key) : material.name;
  };
  const [selectedId, setSelectedId] = useState('');
  const selected = standardMaterials.find((material) => material.id === selectedId);
  const activeId = selected
    && selected.elasticModulus === current.E
    && selected.shearModulus === current.G
    && selected.density === current.density
    ? selectedId
    : '';
  return (
    <label className={`select-field${disabled ? ' is-disabled' : ''}`}>
      <span>{t('inspector.materialPreset')}<small>{t('inspector.materialPresetHint')}</small></span>
      <select
        value={activeId}
        disabled={disabled}
        onChange={(event) => {
          const material = standardMaterials.find((item) => item.id === event.target.value);
          if (!material) return;
          setSelectedId(material.id);
          onSelect(material);
        }}
      >
        <option value="" disabled>{t('inspector.materialPresetPlaceholder')}</option>
        {CATEGORY_ORDER.map((category) => {
          const items = standardMaterials.filter((material) => material.category === category);
          if (items.length === 0) return null;
          return (
            <optgroup key={category} label={t(CATEGORY_LABEL_KEYS[category])}>
              {items.map((material) => (
                <option key={material.id} value={material.id}>
                  {materialLabel(material)} · E {formatInspectorValue(toDisplay(material.elasticModulus, units, 'elasticModulus'), unitLabel(units, 'elasticModulus'))}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </label>
  );
};
