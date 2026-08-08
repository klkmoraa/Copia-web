import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Language } from '../../i18n/catalogs';
import {
  formatInspectorNumber,
  parseInspectorNumber,
  serializeInspectorNumber,
  type InspectorNumberFormatOptions,
} from './numericFormatting';

export interface InspectorNumericFieldProps {
  label: string;
  value: number;
  unit?: string;
  resetKey: string;
  onCommit: (value: number) => void;
  hint?: string;
  disabled?: boolean;
  lockedReason?: string;
  validate?: (value: number) => string | undefined;
  step?: string;
  id?: string;
  className?: string;
  formatOptions?: InspectorNumberFormatOptions;
  language?: Language;
  emptyMessage?: string;
  invalidMessage?: string;
}

const valuesAreEquivalent = (left: number, right: number) => (
  Object.is(left, right) || (left === 0 && right === 0)
);

export const InspectorNumericField = ({
  label,
  value,
  unit = '',
  resetKey,
  onCommit,
  hint,
  disabled = false,
  lockedReason,
  validate,
  step = 'any',
  id: providedId,
  className = '',
  formatOptions,
  language = 'es',
  emptyMessage,
  invalidMessage,
}: InspectorNumericFieldProps) => {
  const resolvedEmptyMessage = emptyMessage ?? (language === 'en'
    ? 'This field cannot be empty.'
    : 'Este campo no puede quedar vacío.');
  const resolvedInvalidMessage = invalidMessage ?? (language === 'en'
    ? 'Enter a valid number.'
    : 'Ingresa un número válido.');
  const generatedId = useId();
  const inputId = providedId ?? `inspector-number-${generatedId}`;
  const unitId = unit ? `${inputId}-unit` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const lockId = lockedReason ? `${inputId}-locked` : undefined;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const maximumFractionDigits = formatOptions?.maximumFractionDigits;
  const significantDigits = formatOptions?.significantDigits;
  const present = (nextValue: number) => formatInspectorNumber(nextValue, {
    maximumFractionDigits,
    significantDigits,
  });
  const [text, setText] = useState(() => present(value));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string>();
  const isDisabled = disabled || Boolean(lockedReason);

  const validationMessage = (candidate: string) => {
    const parsed = parseInspectorNumber(candidate);
    if (!parsed.ok) return parsed.reason === 'empty' ? resolvedEmptyMessage : resolvedInvalidMessage;
    return validate?.(parsed.value);
  };

  useEffect(() => {
    const focused = document.activeElement === inputRef.current;
    setText(focused ? serializeInspectorNumber(value) : formatInspectorNumber(value, {
      maximumFractionDigits,
      significantDigits,
    }));
    setDirty(false);
    setError(undefined);
  }, [maximumFractionDigits, resetKey, significantDigits, value]);

  const commitDraft = () => {
    if (!dirty) {
      setText(present(value));
      setError(undefined);
      return;
    }

    const parsed = parseInspectorNumber(text);
    const nextError = !parsed.ok
      ? parsed.reason === 'empty' ? resolvedEmptyMessage : resolvedInvalidMessage
      : validate?.(parsed.value);
    if (!parsed.ok || nextError) {
      setError(nextError ?? resolvedInvalidMessage);
      return;
    }

    setDirty(false);
    setError(undefined);
    setText(present(parsed.value));
    if (!valuesAreEquivalent(parsed.value, value)) onCommit(parsed.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (event.key !== 'Escape') return;

    event.preventDefault();
    event.stopPropagation();
    setText(serializeInspectorNumber(value));
    setDirty(false);
    setError(undefined);
  };

  const describedBy = [unitId, lockId, hintId, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={`field-row inspector-numeric-field${dirty ? ' is-dirty' : ''}${error ? ' has-error' : ''}${isDisabled ? ' is-disabled' : ''}${lockedReason ? ' is-locked' : ''}${className ? ` ${className}` : ''}`}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className="inspector-numeric-field__body">
        <div className="number-control inspector-numeric-field__control">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            step={step}
            value={text}
            disabled={isDisabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-errormessage={error ? errorId : undefined}
            onFocus={() => {
              if (!dirty) setText(serializeInspectorNumber(value));
            }}
            onChange={(event) => {
              const nextText = event.target.value;
              setText(nextText);
              setDirty(true);
              if (error) setError(validationMessage(nextText));
            }}
            onBlur={commitDraft}
            onKeyDown={handleKeyDown}
          />
          {unit ? <small id={unitId} className="inspector-numeric-field__unit">{unit}</small> : null}
        </div>
        {lockedReason ? <small id={lockId} className="field-help inspector-numeric-field__locked">{lockedReason}</small> : null}
        {hint ? <small id={hintId} className="field-help inspector-numeric-field__hint">{hint}</small> : null}
        {error ? <small id={errorId} className="field-help inspector-numeric-field__error" role="alert">{error}</small> : null}
      </div>
    </div>
  );
};
