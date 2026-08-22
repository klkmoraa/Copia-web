import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Undo2 } from 'lucide-react';
import { SegmentedControl } from '../../design-system/components/controls';
import { fromDisplay, toDisplay } from '../../engine/units';
import type { Language } from '../../i18n/catalogs';
import type { UnitSystemId } from '../../types';
import { parseInspectorNumber, serializeInspectorNumber } from '../inspector/numericFormatting';
import { createBulkEditTranslator } from './bulkEditCopy';
import {
  bulkPropertyLabel,
  bulkPropertyOptionGroups,
  formatAggregatedValue,
  type BulkFormatContext,
} from './bulkEditPresentation';
import type { AggregatedValue, BulkChangeIntent, BulkPropertyState, BulkStagedChange } from './bulkEditTypes';

/**
 * Campo de una propiedad en la edición múltiple.
 *
 * Los tres estados del usuario son visibles y distintos: `Sin cambios` (que es
 * el valor inicial de todo campo), un valor fijado, y `Borrar valor` en las
 * propiedades opcionales. Un valor común mixto se lee «Varios» y jamás se
 * sustituye por el primer valor de la selección: sin una acción explícita el
 * campo permanece `untouched` y no produce ninguna escritura.
 *
 * `clear` tiene su propia representación en cada control. Si se dibujara como
 * un campo vacío sería indistinguible de `untouched`, que es justo la distinción
 * que este módulo existe para conservar.
 */

/** Centinelas de los controles: no son valores del modelo. */
export const BULK_UNTOUCHED_OPTION = '__untouched__';
export const BULK_CLEAR_OPTION = '__clear__';

export interface BulkPropertyFieldProps {
  state: BulkPropertyState;
  change: BulkChangeIntent;
  units: UnitSystemId;
  language: Language;
  onStage: (change: BulkStagedChange) => void;
  onUntouch: () => void;
}

/**
 * Estado tri-estado del **valor actual** de un booleano.
 *
 * `mixed` no es «a medias» ni «falso»: es que la selección no comparte valor.
 * Devolverlo como `false` sería exactamente la confusión que este panel existe
 * para impedir, así que el estado indeterminado viaja tal cual al árbol de
 * accesibilidad.
 */
const currentChecked = (value: AggregatedValue): 'true' | 'false' | 'mixed' => {
  if (value.state === 'mixed') return 'mixed';
  return value.state === 'same' && value.value === true ? 'true' : 'false';
};

const controlValue = (change: BulkChangeIntent): string => {
  if (change.kind === 'set') return String(change.value);
  return change.kind === 'clear' ? BULK_CLEAR_OPTION : BULK_UNTOUCHED_OPTION;
};

const BulkNumberInput = ({
  state,
  change,
  units,
  context,
  inputId,
  describedBy,
  inputRef,
  onStage,
  onUntouch,
}: Pick<BulkPropertyFieldProps, 'state' | 'change' | 'units' | 'onStage' | 'onUntouch'> & {
  context: BulkFormatContext;
  inputId: string;
  describedBy: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) => {
  const committed = change.kind === 'set' && typeof change.value === 'number'
    ? serializeInspectorNumber(state.quantity ? toDisplay(change.value, units, state.quantity) : change.value)
    : '';
  const [text, setText] = useState(committed);
  const [invalid, setInvalid] = useState(false);
  const errorId = `${inputId}-error`;

  // El borrador lo posee el panel: si `Cancelar` retira el cambio, el texto
  // escrito tiene que volver a estar vacío, no quedarse como resto visual.
  useEffect(() => {
    setText(committed);
    setInvalid(false);
  }, [committed]);

  const commit = () => {
    if (text.trim() === '') {
      setInvalid(false);
      // Vaciar el campo retira un valor fijado, pero NO un borrado explícito:
      // `clear` también se muestra con el campo vacío y perderlo aquí lo
      // convertiría en `untouched` sin que el usuario lo pidiera.
      if (change.kind === 'set') onUntouch();
      return;
    }
    const parsed = parseInspectorNumber(text);
    if (!parsed.ok) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onStage({ kind: 'set', value: state.quantity ? fromDisplay(parsed.value, units, state.quantity) : parsed.value });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key !== 'Escape') return;
    // Sólo se consume el Escape que revierte algo. Si no hay nada que revertir
    // debe seguir subiendo, o una hoja móvil dejaría de poder cerrarse.
    if (text === committed && !invalid) return;
    event.preventDefault();
    event.stopPropagation();
    setText(committed);
    setInvalid(false);
  };

  return <>
    <input
      ref={inputRef}
      id={inputId}
      className="bulk-field__input"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={text}
      placeholder={change.kind === 'clear' ? context.t('field.clear') : context.t('field.untouched')}
      aria-describedby={invalid ? `${describedBy} ${errorId}` : describedBy}
      aria-invalid={invalid || undefined}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
    {invalid ? <small id={errorId} className="bulk-field__error" role="alert">{context.t('field.numberInvalid')}</small> : null}
  </>;
};

export const BulkPropertyField = ({
  state,
  change,
  units,
  language,
  onStage,
  onUntouch,
}: BulkPropertyFieldProps) => {
  const t = createBulkEditTranslator(language);
  const context: BulkFormatContext = { t, language, units };
  const generatedId = useId();
  const controlId = `bulk-field-${generatedId}`;
  const currentId = `${controlId}-current`;
  const compatibilityId = `${controlId}-compatibility`;
  const hintId = `${controlId}-hint`;
  const label = bulkPropertyLabel(t, state.id);
  const { compatible, selected, incompatible } = state.compatibility;
  const partial = incompatible.length > 0;
  const staged = change.kind !== 'untouched';
  const controlRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const describedBy = [currentId, compatibilityId, state.kind === 'number' ? hintId : '']
    .filter(Boolean)
    .join(' ');

  const stage = (value: string) => {
    if (value === BULK_UNTOUCHED_OPTION) onUntouch();
    else if (value === BULK_CLEAR_OPTION) onStage({ kind: 'clear' });
    else onStage({ kind: 'set', value: state.kind === 'boolean' ? value === 'true' : value });
  };

  /*
   * El botón de descartar es lo que provoca su propio desmontaje, así que el
   * foco se devuelve al control antes de cambiar el estado. Sin esto el foco
   * cae en `<body>` y el siguiente Tab reempieza desde el principio del
   * documento, justo después de la acción más frecuente del panel.
   */
  const discard = () => {
    const target = controlRef.current
      ?? groupRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]');
    target?.focus();
    onUntouch();
  };

  const renderControl = () => {
    if (state.kind === 'boolean') {
      return <div ref={groupRef} className="bulk-field__segmented-wrap">
        <SegmentedControl
          className="bulk-field__segmented"
          label={t('field.booleanGroup', { property: label })}
          describedBy={describedBy}
          value={controlValue(change)}
          options={[
            { value: BULK_UNTOUCHED_OPTION, label: t('field.untouched') },
            { value: 'true', label: t('value.true') },
            { value: 'false', label: t('value.false') },
            ...(state.clearable ? [{ value: BULK_CLEAR_OPTION, label: t('field.clear') }] : []),
          ]}
          onValueChange={stage}
        />
      </div>;
    }

    if (state.kind === 'number') {
      return <>
        <BulkNumberInput
          state={state}
          change={change}
          units={units}
          context={context}
          inputId={controlId}
          describedBy={describedBy}
          inputRef={controlRef as React.RefObject<HTMLInputElement | null>}
          onStage={onStage}
          onUntouch={onUntouch}
        />
        {/* El nombre lleva la propiedad, igual que el de descartar: en un panel
            con doce campos numéricos, doce botones «Borrar valor» idénticos no
            se distinguen en la lista de un lector de pantalla. */}
        {state.clearable ? <button
          type="button"
          className="bulk-field__action"
          aria-label={t('field.clearNamed', { property: label })}
          aria-pressed={change.kind === 'clear'}
          onClick={() => change.kind === 'clear' ? onUntouch() : onStage({ kind: 'clear' })}
        >{t('field.clear')}</button> : null}
      </>;
    }

    return <select
      ref={controlRef as React.RefObject<HTMLSelectElement | null>}
      id={controlId}
      className="bulk-field__select"
      value={controlValue(change)}
      aria-describedby={describedBy}
      onChange={(event) => stage(event.target.value)}
    >
      <option value={BULK_UNTOUCHED_OPTION}>{t('field.untouched')}</option>
      {state.clearable ? <option value={BULK_CLEAR_OPTION}>{t('field.clear')}</option> : null}
      {bulkPropertyOptionGroups(state, context).map((group) => group.label === undefined
        ? group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)
        : <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </optgroup>)}
    </select>;
  };

  return <div
    className={`bulk-field${staged ? ' is-staged' : ''}${partial ? ' is-partial' : ''}`}
    data-property={state.id}
    data-change={change.kind}
  >
    <div className="bulk-field__header">
      {state.kind === 'boolean'
        ? <span className="bulk-field__label">{label}</span>
        : <label className="bulk-field__label" htmlFor={controlId}>{label}</label>}
      <span className="bulk-field__current" id={currentId}>
        <small>{t('field.current')}</small>
        {/*
          * En un booleano el valor actual es tri-estado de verdad, así que se
          * expone como tal: `mixed` es un estado propio y no puede colapsar a
          * `false`. El control de intención de abajo es un grupo de radios y no
          * admite `aria-checked="mixed"`; este indicador es de sólo lectura y no
          * recibe foco, porque no decide nada — sólo informa.
          */}
        {state.kind === 'boolean' ? <span
          className="bulk-field__current-state"
          role="checkbox"
          aria-readonly="true"
          aria-label={t('field.currentValue', { property: label })}
          aria-checked={currentChecked(state.value)}
        /> : null}
        {formatAggregatedValue(state, state.value, context)}
      </span>
    </div>

    <div className="bulk-field__control">
      {renderControl()}
      {staged ? <button
        type="button"
        className="bulk-field__action bulk-field__revert"
        aria-label={t('field.revert', { property: label })}
        onClick={discard}
      ><Undo2 size={14} aria-hidden="true" /> {t('field.discard')}</button> : null}
    </div>

    {state.kind === 'number'
      ? <small className="bulk-field__hint" id={hintId}>{t('field.numberHint')}</small>
      : null}

    <small className="bulk-field__compatibility" id={compatibilityId}>
      {t('field.compatibility', { compatible: compatible.length, selected })}
      {[...new Set(incompatible.map((entry) => entry.reason))].map((reason) => ` · ${t(`reason.${reason}`)}`).join('')}
    </small>
  </div>;
};
