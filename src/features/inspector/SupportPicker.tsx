import { useCallback, useId, useState } from 'react';
import { Library } from 'lucide-react';
import { Tabs } from '../../design-system/components/disclosure';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import type { SupportDefinition, UnitSystemId } from '../../types';
import { formatFixed } from '../../utils/numberFormat';
import { InspectorHelper, InspectorLockedState, PhysicalNumberField } from './InspectorPrimitives';
import { InspectorNumericField } from './InspectorNumericField';
import { SupportGlyph } from './SupportGlyph';
import { SupportLibraryDialog } from './SupportLibraryDialog';
import {
  DEFAULT_ROLLER_ANGLE_DEG,
  DEFAULT_SPRING_ANGLE_DEG,
  SUPPORT_PICKER_FAMILIES,
  VISUAL_ORIENTATION_STEPS,
  countSupportReactions,
  describeSupportDof,
  entriesOfFamily,
  findSupportEntry,
  hasCustomRollerAngle,
  isSpringEntryActive,
  matchSupportEntry,
  springNormalDisagrees,
  supportDofLabel,
  type SupportDofRow,
  type SupportEntry,
  type SupportFamily,
  type SupportSpringKey,
} from './supportCatalog';

/**
 * El selector de apoyos.
 *
 * LA DECISIÓN DE FONDO. Cuatro familias en pestañas y un panel de detalle, en
 * lugar de una sola lista larga. La primera pestaña contesta **una** pregunta
 * —qué restringe este nudo respecto al terreno— y las otras tres no compiten
 * con ella: una rigidez elástica y un asiento impuesto no son condiciones de
 * borde, son cosas que se le añaden a una. Meterlas en la misma fila que
 * «Libre, Articulado, Rodillo, Empotramiento» es lo que hace que un selector
 * de veinte botones no signifique nada.
 *
 * QUÉ PROMETE CADA MOSAICO. El símbolo, el nombre y la línea de grados de
 * libertad en la notación de la biblioteca (`Ux ✕ · Uy ✕ · Rz ✓`). Los tres,
 * siempre: un dibujo no basta para distinguir una guía horizontal de una
 * vertical. El campo real del modelo lo enseña el panel de detalle, sin
 * traducir, porque es el nombre de la propiedad y no una etiqueta.
 *
 * EL PANEL DE DETALLE SIGUE AL FOCO, NO AL TIPO. Pulsar «Resorte Y» no cambia
 * la condición de borde —abre su campo—, así que el panel tiene que poder
 * hablar de un resorte mientras el nudo sigue siendo un articulado. Cuando el
 * foco apunta a un preset que ya no es el del nudo (porque alguien lo cambió
 * desde el lienzo), el foco vuelve solo al que sí lo es.
 */

const SPRING_LABELS: Readonly<Record<SupportSpringKey, string>> = {
  kx: 'kx',
  ky: 'ky',
  kr: 'kθ',
  kNormal: 'kn',
};

const SPRING_QUANTITY: Readonly<Record<SupportSpringKey, 'translationalStiffness' | 'rotationalStiffness'>> = {
  kx: 'translationalStiffness',
  ky: 'translationalStiffness',
  kNormal: 'translationalStiffness',
  kr: 'rotationalStiffness',
};

const SupportTile = ({
  entry,
  label,
  meta,
  active,
  focused,
  glyphAngle,
  visualAngle,
  disabled,
  onSelect,
}: {
  entry: SupportEntry;
  label: string;
  meta: string;
  active: boolean;
  focused: boolean;
  glyphAngle: number;
  visualAngle?: number;
  disabled: boolean;
  onSelect: (entry: SupportEntry) => void;
}) => (
  <button
    type="button"
    className={`support-tile${active ? ' is-active' : ''}${focused ? ' is-focused' : ''}${disabled ? ' is-unavailable' : ''}`}
    aria-pressed={active}
    aria-disabled={disabled || undefined}
    onClick={() => { if (!disabled) onSelect(entry); }}
  >
    <span className="support-tile__glyph">
      <SupportGlyph glyph={entry.glyph} angleDeg={glyphAngle} visualAngleDeg={visualAngle} />
    </span>
    <span className="support-tile__label">{label}</span>
    <span className="support-tile__meta">{meta}</span>
    {active ? <span className="support-tile__dot" aria-hidden="true" /> : null}
  </button>
);

export const SupportPicker = ({
  support,
  selectionKey,
  units,
  classroomMode,
  settlementCount,
  onApplyPreset,
  onAngleChange,
  onVisualAngleChange,
  onRestraintChange,
  onSpringChange,
}: {
  support: SupportDefinition;
  selectionKey: string;
  units: UnitSystemId;
  classroomMode: boolean;
  settlementCount: number;
  onApplyPreset: (entry: SupportEntry) => void;
  onAngleChange: (angleDeg: number) => void;
  onVisualAngleChange: (angleDeg: number | null) => void;
  onRestraintChange: (key: 'restrainX' | 'restrainY' | 'restrainR', value: boolean) => void;
  onSpringChange: (key: SupportSpringKey | 'angleDeg', value: number) => void;
}) => {
  const { t, language } = useI18n();
  const detailId = useId();

  const matched = matchSupportEntry(support);
  const [family, setFamily] = useState<SupportFamily>(matched.family);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  /* Un foco sobre un preset que ya no describe al nudo se corrige solo: el
     lienzo también cambia apoyos, y el panel no puede quedarse hablando de un
     empotramiento que dejó de serlo. Un foco sobre un resorte o una condición
     avanzada sí se conserva: ésos no dependen del tipo. */
  const candidate = focusedId ? findSupportEntry(focusedId) : undefined;
  const focused = candidate && (candidate.kind !== 'preset' || candidate.id === matched.id) ? candidate : matched;

  const rollerAngle = support.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG;
  const visualAngle = support.type === 'pin' || support.type === 'fixed' ? support.angleDeg : undefined;
  const rows = describeSupportDof(support);
  const reactions = countSupportReactions(support);
  const nonNegative = useCallback(
    (value: number) => value >= 0 ? undefined : t('inspector.nonNegativeValidation'),
    [t],
  );

  const select = (entry: SupportEntry) => {
    setFocusedId(entry.id);
    if (entry.kind === 'preset') onApplyPreset(entry);
  };

  const isActive = (entry: SupportEntry) => {
    if (entry.kind === 'preset') return entry.id === matched.id;
    if (entry.kind === 'spring') return isSpringEntryActive(support, entry);
    if (entry.kind === 'settlement') return settlementCount > 0;
    return false;
  };

  const dofName = (row: SupportDofRow) => row.id === 'normal'
    ? t('inspector.supportDofNormal')
    : row.id === 'tangent'
      ? t('inspector.supportDofTangent')
      : supportDofLabel(row.id);
  const dofSentence = rows
    .map((row) => `${dofName(row)} ${row.restrained ? t('inspector.supportDofRestrained') : t('inspector.supportDofFree')}`)
    .join(' · ');

  const familyTab = (id: SupportFamily) => ({
    id,
    label: t(`inspector.supportFamily.${id}` as TranslationKey),
    content: (
      <div className="support-picker__grid">
        {entriesOfFamily(id).map((entry) => (
          <SupportTile
            key={entry.id}
            entry={entry}
            label={t(entry.labelKey)}
            meta={t(entry.metaKey)}
            active={isActive(entry)}
            focused={entry.id === focused.id}
            glyphAngle={entry.angleDeg ?? (entry.type === 'roller' ? rollerAngle : DEFAULT_ROLLER_ANGLE_DEG)}
            visualAngle={entry.type === 'pin' || entry.type === 'fixed' ? visualAngle : undefined}
            disabled={entry.kind === 'unavailable'}
            onSelect={select}
          />
        ))}
      </div>
    ),
  });

  const springFields = focused.springKeys ?? [];
  const showsNormalDirection = springFields.includes('kNormal') && Boolean(support.spring?.kNormal);

  return (
    <div className="support-picker">
      <p className="support-picker__legend" aria-hidden="true">
        <span className="is-free">✓ {t('inspector.supportDofFree')}</span>
        <span className="is-restrained">✕ {t('inspector.supportDofRestrained')}</span>
      </p>

      <Tabs
        className="support-picker__tabs"
        label={t('inspector.supportFamilies')}
        value={family}
        onValueChange={(next) => setFamily(next as SupportFamily)}
        items={SUPPORT_PICKER_FAMILIES.map(familyTab)}
      />

      <section className="support-detail" aria-labelledby={detailId}>
        <header className="support-detail__header">
          <span className="support-detail__glyph">
            <SupportGlyph glyph={focused.glyph} angleDeg={rollerAngle} visualAngleDeg={visualAngle} size={58} />
          </span>
          <div>
            <strong id={detailId}>{t(focused.labelKey)}</strong>
            <p>{t(focused.descriptionKey)}</p>
            <code className="support-detail__model">{focused.model}</code>
          </div>
        </header>

        {focused.orientation === 'physical' ? (
          <div className="support-detail__section">
            <h4>{t('inspector.supportPhysicalNormal')}</h4>
            <InspectorNumericField
              label={t('inspector.normal')}
              value={rollerAngle}
              unit="°"
              resetKey={`${selectionKey}:support-angle`}
              language={language}
              formatOptions={{ maximumFractionDigits: 2 }}
              hint={t('inspector.rollerNormalHint')}
              onCommit={onAngleChange}
            />
            <p className="support-detail__note">{t('inspector.supportPhysicalNormalNote')}</p>
            {hasCustomRollerAngle(support) ? (
              <p className="support-detail__note">
                {t('inspector.supportRollerCustomAngle', { angle: formatFixed(rollerAngle, 2) })}
              </p>
            ) : null}
          </div>
        ) : null}

        {focused.orientation === 'visual' ? (
          <div className="support-detail__section">
            <h4>{t('inspector.supportVisualOrientation')}</h4>
            <div className="support-detail__chips" role="group" aria-label={t('inspector.supportVisualOrientation')}>
              {VISUAL_ORIENTATION_STEPS.map((step) => {
                const label = step === null ? t('inspector.supportOrientationAuto') : `${step}°`;
                const pressed = step === null ? visualAngle === undefined : visualAngle === step;
                return (
                  <button
                    key={label}
                    type="button"
                    className={`support-chip${pressed ? ' is-active' : ''}`}
                    aria-pressed={pressed}
                    onClick={() => onVisualAngleChange(step)}
                  >{label}</button>
                );
              })}
            </div>
            {/* La frase exacta del prototipo, y no es decorativa: el solver monta
                las mismas tres ecuaciones con ángulo o sin él. */}
            <p className="support-detail__note">{t('inspector.supportVisualOrientationNote')}</p>
          </div>
        ) : null}

        <div className="support-detail__section">
          <h4>{t('inspector.supportDegreesOfFreedom')}</h4>
          {support.type === 'custom' ? (
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
          ) : (
            <div className="support-detail__dof" aria-hidden="true">
              {rows.map((row) => (
                <span key={row.id} className={row.restrained ? 'is-restrained' : 'is-free'}>
                  {supportDofLabel(row.id)} {row.restrained ? '✕' : '✓'}
                </span>
              ))}
            </div>
          )}
          <p className="support-detail__dof-sentence">{dofSentence}</p>
          <p className="support-detail__count">{t('inspector.supportReactionCount', { count: reactions })}</p>
        </div>

        {focused.kind === 'spring' ? (
          classroomMode ? (
            <InspectorLockedState title={t('inspector.springsLockedClassroom')}>
              {t('inspector.springsLockedClassroomBody')}
            </InspectorLockedState>
          ) : (
            <div className="support-detail__section">
              <h4>{t('inspector.supportStiffness')}</h4>
              {springFields.map((key) => (
                <PhysicalNumberField
                  key={key}
                  label={SPRING_LABELS[key]}
                  value={support.spring?.[key] ?? 0}
                  units={units}
                  quantity={SPRING_QUANTITY[key]}
                  resetKey={`${selectionKey}:spring-${key}`}
                  validate={nonNegative}
                  onCommit={(value) => onSpringChange(key, value)}
                />
              ))}
              {/* `spring.angleDeg` existía en el modelo y el solver lo usaba,
                  pero ninguna superficie lo enseñaba: un resorte normal caía
                  siempre en los 90° aunque el rodillo estuviera tumbado. */}
              {showsNormalDirection ? (
                <InspectorNumericField
                  label={t('inspector.springNormalDirection')}
                  value={support.spring?.angleDeg ?? DEFAULT_SPRING_ANGLE_DEG}
                  unit="°"
                  resetKey={`${selectionKey}:spring-angle`}
                  language={language}
                  formatOptions={{ maximumFractionDigits: 2 }}
                  hint={t('inspector.springNormalDirectionHint')}
                  onCommit={(value) => onSpringChange('angleDeg', value)}
                />
              ) : null}
              {springNormalDisagrees(support) ? (
                <InspectorHelper tone="warning">{t('inspector.springNormalMismatch', {
                  spring: formatFixed(support.spring?.angleDeg ?? DEFAULT_SPRING_ANGLE_DEG, 2),
                  support: formatFixed(rollerAngle, 2),
                })}</InspectorHelper>
              ) : null}
              <p className="support-detail__note">{t('inspector.supportStiffnessNote')}</p>
            </div>
          )
        ) : null}

        {focused.kind === 'settlement' ? (
          <div className="support-detail__section">
            <h4>{t('inspector.settlementsByCase')}</h4>
            <p className="support-detail__note">
              {settlementCount > 0
                ? t('inspector.definedCount', { count: settlementCount })
                : t('inspector.noSettlements')}
            </p>
            <p className="support-detail__note">{t('inspector.supportSettlementWhere')}</p>
          </div>
        ) : null}

        {focused.kind === 'unavailable' && focused.unavailableKey ? (
          <InspectorHelper tone="warning">{t(focused.unavailableKey)}</InspectorHelper>
        ) : null}
      </section>

      <p className="support-picker__tip">{t('inspector.supportPickerTip')}</p>

      <button type="button" className="support-picker__library" onClick={() => setLibraryOpen(true)}>
        <Library size={14} aria-hidden="true" />
        {t('inspector.supportOpenLibrary')}
      </button>

      <SupportLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
    </div>
  );
};
