import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../design-system/components/controls';
import { Banner } from '../../design-system/components/feedback';
import { Surface } from '../../design-system/components/surface';
import type { Language, TranslationKey } from '../../i18n/catalogs';
import type { ProjectModel, UnitSystemId } from '../../types';
import { datasheetField, type DatasheetFieldId } from './datasheetEditModel';
import type { DatasheetEditErrorCode, DatasheetEditPlan } from './datasheetEditDraft';
import { formatPlannedValue } from './datasheetPresentation';

/**
 * Revisión del plan antes de escribir.
 *
 * **No es un `Dialog`.** `ModalSurface` registra su `Escape` en `document` sin
 * detener la propagación, así que un diálogo anidado dentro del Drawer del
 * datasheet cerraría los dos con una sola pulsación. Esta revisión vive dentro
 * del propio Drawer, en el carril del panel contextual, y hereda su foco
 * atrapado.
 *
 * Enseña tres cosas que un contador solo escondería: qué cambia celda a celda,
 * qué descartó el pegado y por qué, y qué avisos deja el plan sin bloquearlo.
 */

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

/** Un `Record` explícito: un código nuevo rompe la compilación en vez de callarse. */
const ERROR_MESSAGES: Record<DatasheetEditErrorCode, TranslationKey> = {
  'not-a-number': 'datasheet.error.notANumber',
  'not-positive': 'datasheet.error.notPositive',
  'out-of-range': 'datasheet.error.outOfRange',
  'unknown-option': 'datasheet.error.unknownOption',
  ineligible: 'datasheet.error.ineligible',
  'unknown-row': 'datasheet.error.unknownRow',
};

export interface DatasheetPasteReport {
  droppedOutside: number;
  droppedReadOnly: number;
}

export interface DatasheetReviewPanelProps {
  plan: DatasheetEditPlan;
  /** Presente sólo cuando el borrador viene de un pegado. */
  paste: DatasheetPasteReport | null;
  project: ProjectModel;
  units: UnitSystemId;
  language: Language;
  t: Translate;
  /** Etiqueta legible de un campo; la resuelve el panel, que conoce las columnas. */
  fieldLabel: (fieldId: DatasheetFieldId) => string;
  onApply: () => void;
  onCancel: () => void;
}

export const DatasheetReviewPanel = ({
  plan,
  paste,
  project,
  units,
  language,
  t,
  fieldLabel,
  onApply,
  onCancel,
}: DatasheetReviewPanelProps) => {
  // El nombre de un caso lo escribe el usuario, así que no puede salir de una
  // traducción: se resuelve contra el proyecto igual que en la tabla.
  const caseNames = useMemo(
    () => new Map(project.loadCases.map((item) => [item.id, item.name])),
    [project.loadCases],
  );

  const describe = (value: string | number | boolean | undefined, fieldId: DatasheetFieldId): string => {
    const field = datasheetField(fieldId);
    if (field.optionsFrom === 'loadCases' && typeof value === 'string') {
      return caseNames.get(value) ?? value;
    }
    return formatPlannedValue(value, field, units, language, t);
  };

  const dropped = paste ? paste.droppedOutside + paste.droppedReadOnly : 0;

  return <Surface
    as="section"
    level="raised"
    className="datasheet-review"
    role="region"
    aria-label={t('datasheet.review.title')}
  >
    <header className="datasheet-review__header">
      <h2>{t('datasheet.review.title')}</h2>
      <p role="status">
        {plan.errors.length > 0
          ? t('datasheet.review.blocked', { count: plan.errors.length })
          : t('datasheet.review.ready', { count: plan.changes.length })}
      </p>
    </header>

    {dropped > 0 ? <Banner
      tone="warning"
      title={t('datasheet.review.droppedTitle')}
    >
      {t('datasheet.review.dropped', {
        outside: paste?.droppedOutside ?? 0,
        readOnly: paste?.droppedReadOnly ?? 0,
      })}
    </Banner> : null}

    {plan.coincidentNodeIds.length > 0 ? <Banner
      tone="warning"
      aria-label={t('datasheet.review.coincidentLabel')}
      title={t('datasheet.review.coincidentLabel')}
    >
      {t('datasheet.review.coincident', { ids: [...plan.coincidentNodeIds].sort().join(', ') })}
    </Banner> : null}

    {plan.errors.length > 0 ? <ul className="datasheet-review__errors">
      {plan.errors.map((error) => <li key={`${error.rowId}|${error.fieldId}`}>
        {t(ERROR_MESSAGES[error.code], { row: error.rowId, raw: error.raw })}
      </li>)}
    </ul> : null}

    {plan.changes.length > 0 ? <dl className="datasheet-review__list">
      {plan.changes.map((change) => <div key={`${change.rowId}|${change.fieldId}`}>
        <dt>{change.rowId}</dt>
        <dd>
          <span className="datasheet-review__transition">
            {describe(change.before, change.fieldId)}
            {/* La dirección del cambio no puede vivir sólo en el icono. */}
            <span className="sr-only">{t('datasheet.review.to')}</span>
            <ArrowRight size={13} aria-hidden="true" />
            {describe(change.after, change.fieldId)}
          </span>
          <small>{fieldLabel(change.fieldId)}</small>
        </dd>
      </div>)}
    </dl> : null}

    <footer className="datasheet-review__actions">
      <Button variant="ghost" onClick={onCancel}>{t('datasheet.draft.cancel')}</Button>
      <Button variant="primary" disabled={!plan.applicable} onClick={onApply}>
        {t('datasheet.review.applyAll')}
      </Button>
    </footer>
  </Surface>;
};
