import { useId } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { formatFixed } from '../../utils/numberFormat';
import type { SupportDefinition } from '../../types';
import { InspectorHelper } from './InspectorPrimitives';
import { InspectorNumericField } from './InspectorNumericField';
import { SupportGlyph } from './SupportGlyph';
import {
  DEFAULT_ROLLER_ANGLE_DEG,
  SUPPORT_BASE_PRESETS,
  SUPPORT_DIRECTION_PRESETS,
  SUPPORT_GUIDE_PRESETS,
  activeSpringKeys,
  applySupportPreset,
  countSupportReactions,
  describeSupportDof,
  matchBasePreset,
  matchDirectionPreset,
  matchGuidePreset,
  supportDofLabel,
  type SupportDofRow,
  type SupportPreset,
} from './supportCatalog';

/**
 * El selector de apoyos, por capas.
 *
 * LA DECISIÓN DE FONDO. La primera pantalla contesta **una** pregunta —qué
 * restringe este nudo respecto al terreno— y se para ahí. La orientación, los
 * grados de libertad manuales y la rigidez no compiten con ella: aparecen
 * después, y sólo cuando el tipo elegido las admite. Un rodillo enseña sus tres
 * presets de ángulo; un empotramiento no enseña nada, porque no hay nada que
 * ajustar.
 *
 * POR QUÉ RADIOS DE VERDAD Y NO BOTONES. Un grupo de `input[type=radio]` trae
 * gratis lo que un `div[role=radiogroup]` obliga a reimplementar a mano: el
 * recorrido con flechas, el salto de tabulación al grupo entero y el anuncio
 * «2 de 5». El aspecto de tarjeta lo pone el CSS sobre la etiqueta; el control
 * sigue siendo el nativo.
 *
 * LO QUE CADA TARJETA PROMETE. El nombre, el campo del modelo que escribe y sus
 * grados de libertad. Los tres, siempre: un dibujo no basta para distinguir una
 * guía horizontal de una vertical, y el `type = roller` escrito es lo que hace
 * evidente que suelo, muro e inclinado **no** son tipos distintos.
 */

const dofSentenceOf = (
  rows: readonly SupportDofRow[],
  name: (row: SupportDofRow) => string,
  state: (row: SupportDofRow) => string,
): string => rows.map((row) => `${name(row)} ${state(row)}`).join(' · ');

const PresetCard = ({
  preset,
  name,
  checked,
  angleDeg,
  rows,
  describedBy,
  onSelect,
  label,
}: {
  preset: SupportPreset;
  name: string;
  checked: boolean;
  angleDeg: number;
  rows: readonly SupportDofRow[];
  describedBy: string;
  onSelect: (preset: SupportPreset) => void;
  label: string;
}) => (
  <label className={`support-card${checked ? ' is-active' : ''}`}>
    <input
      type="radio"
      name={name}
      value={preset.id}
      checked={checked}
      aria-describedby={describedBy}
      onChange={() => onSelect(preset)}
    />
    <span className="support-card__glyph">
      <SupportGlyph glyph={preset.glyph} angleDeg={angleDeg} />
    </span>
    <span className="support-card__label">{label}</span>
    <span className="support-card__dof" aria-hidden="true">
      {rows.map((row) => (
        <span key={row.id} className={row.restrained ? 'is-restrained' : 'is-free'}>{supportDofLabel(row.id)}</span>
      ))}
    </span>
    <code className="support-card__model">{preset.model}</code>
  </label>
);

export const SupportPicker = ({
  support,
  selectionKey,
  onApplyPreset,
  onAngleChange,
  onRestraintChange,
}: {
  support: SupportDefinition;
  selectionKey: string;
  onApplyPreset: (preset: SupportPreset) => void;
  onAngleChange: (angleDeg: number) => void;
  onRestraintChange: (key: 'restrainX' | 'restrainY' | 'restrainR', value: boolean) => void;
}) => {
  const { t, language } = useI18n();
  const groupId = useId();

  const basePreset = matchBasePreset(support);
  const directionPreset = matchDirectionPreset(support);
  const guidePreset = matchGuidePreset(support);
  /* La tarjeta más específica manda en la lectura: si hay guía, la frase que
     hay que leer es la de la guía, no la de «Personalizado». */
  const activePreset = guidePreset ?? directionPreset ?? basePreset;

  const rows = describeSupportDof(support);
  const reactions = countSupportReactions(support);
  const springs = activeSpringKeys(support);
  const angleDeg = support.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG;

  const dofName = (row: SupportDofRow) => row.id === 'normal'
    ? t('inspector.supportDofNormal')
    : row.id === 'tangent'
      ? t('inspector.supportDofTangent')
      : supportDofLabel(row.id);
  const dofState = (row: SupportDofRow) => row.restrained
    ? t('inspector.supportDofRestrained')
    : t('inspector.supportDofFree');
  const sentenceOf = (candidate: readonly SupportDofRow[]) => dofSentenceOf(candidate, dofName, dofState);

  const cardFor = (preset: SupportPreset, layer: string, checked: boolean, glyphAngle: number) => {
    const projected = describeSupportDof(applySupportPreset(support, preset));
    const describedBy = `${groupId}-${preset.id}`;
    return (
      <span className="support-card__slot" key={preset.id}>
        <PresetCard
          preset={preset}
          name={`${groupId}-${layer}`}
          checked={checked}
          angleDeg={glyphAngle}
          rows={projected}
          describedBy={describedBy}
          onSelect={onApplyPreset}
          label={t(preset.labelKey)}
        />
        <span id={describedBy} className="support-picker__assistive">
          {`${preset.model} · ${sentenceOf(projected)} · ${t(preset.descriptionKey)}`}
        </span>
      </span>
    );
  };

  return (
    <div className="support-picker">
      <fieldset className="support-picker__layer">
        <legend>
          <span className="support-picker__ordinal">01</span>
          {t('inspector.supportLayerBase')}
          <small>{t('inspector.supportLayerBaseHint')}</small>
        </legend>
        <div className="support-picker__grid">
          {SUPPORT_BASE_PRESETS.map((preset) => cardFor(
            preset,
            'base',
            preset.type === support.type,
            preset.type === 'roller' ? angleDeg : DEFAULT_ROLLER_ANGLE_DEG,
          ))}
        </div>
      </fieldset>

      {support.type === 'roller' ? (
        <fieldset className="support-picker__layer">
          <legend>
            <span className="support-picker__ordinal">02</span>
            {t('inspector.supportLayerDirection')}
            <small>{t('inspector.supportLayerDirectionHint')}</small>
          </legend>
          <div className="support-picker__grid">
            {SUPPORT_DIRECTION_PRESETS.map((preset) => cardFor(
              preset,
              'direction',
              directionPreset?.id === preset.id,
              preset.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG,
            ))}
          </div>
          <InspectorNumericField
            label={t('inspector.normal')}
            value={angleDeg}
            unit="°"
            resetKey={`${selectionKey}:support-angle`}
            language={language}
            formatOptions={{ maximumFractionDigits: 2 }}
            hint={t('inspector.rollerNormalHint')}
            onCommit={onAngleChange}
          />
          {directionPreset === null ? (
            <p className="support-picker__note">{t('inspector.supportRollerCustomAngle', { angle: formatFixed(angleDeg, 2) })}</p>
          ) : null}
        </fieldset>
      ) : null}

      {support.type === 'custom' ? (
        <fieldset className="support-picker__layer">
          <legend>
            <span className="support-picker__ordinal">02</span>
            {t('inspector.supportLayerGuide')}
            <small>{t('inspector.supportLayerGuideHint')}</small>
          </legend>
          <div className="support-picker__grid">
            {SUPPORT_GUIDE_PRESETS.map((preset) => cardFor(
              preset,
              'guide',
              guidePreset?.id === preset.id,
              DEFAULT_ROLLER_ANGLE_DEG,
            ))}
          </div>
          <div className="checkbox-grid" role="group" aria-label={t('inspector.restrictedDegreesOfFreedom')}>
            <label>
              <input type="checkbox" checked={support.restrainX ?? false} onChange={(event) => onRestraintChange('restrainX', event.target.checked)} /> Ux
            </label>
            <label>
              <input type="checkbox" checked={support.restrainY ?? false} onChange={(event) => onRestraintChange('restrainY', event.target.checked)} /> Uy
            </label>
            <label>
              <input type="checkbox" checked={support.restrainR ?? false} onChange={(event) => onRestraintChange('restrainR', event.target.checked)} /> Rz
            </label>
          </div>
        </fieldset>
      ) : null}

      <div className="support-picker__readout" role="status">
        <span className="support-picker__readout-glyph">
          <SupportGlyph glyph={activePreset.glyph} angleDeg={angleDeg} size={52} />
        </span>
        <div>
          <strong>{t(activePreset.labelKey)}</strong>
          <p className="support-picker__readout-dof">{sentenceOf(rows)}</p>
          <p>{t(activePreset.descriptionKey)}</p>
          <p className="support-picker__readout-count">
            {t('inspector.supportReactionCount', { count: reactions })}
          </p>
        </div>
      </div>

      {springs.length > 0 ? (
        <p className="support-picker__note is-elastic">
          {t('inspector.supportElasticNote', { keys: springs.join(', ') })}
        </p>
      ) : null}

      {support.type === 'roller' ? (
        <InspectorHelper>{t('inspector.supportRollerRule')}</InspectorHelper>
      ) : null}
    </div>
  );
};
