import {
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { Spinner } from './feedback';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ControlSize = 'sm' | 'md' | 'touch';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  loading?: boolean;
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  loadingLabel = 'Loading',
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className = '',
  disabled,
  type = 'button',
  'aria-label': ariaLabel,
  children,
  ref,
  ...props
}: ButtonProps) {
  return <button
    {...props}
    ref={ref}
    type={type}
    className={`sc-button sc-button--${variant} sc-button--${size}${fullWidth ? ' sc-button--full' : ''}${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    aria-label={loading ? loadingLabel : ariaLabel}
  >
    {loading ? <Spinner size="sm" label={loadingLabel} decorative /> : leadingIcon ? <span className="sc-button__icon" aria-hidden="true">{leadingIcon}</span> : null}
    <span className="sc-button__label">{children}</span>
    {!loading && trailingIcon ? <span className="sc-button__icon" aria-hidden="true">{trailingIcon}</span> : null}
  </button>;
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string;
  variant?: ButtonVariant;
  size?: ControlSize;
  loading?: boolean;
  loadingLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  loading = false,
  loadingLabel,
  className = '',
  disabled,
  type = 'button',
  children,
  ref,
  ...props
}: IconButtonProps) {
  return <button
    {...props}
    ref={ref}
    type={type}
    className={`sc-icon-button sc-icon-button--${variant} sc-icon-button--${size}${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
    aria-label={loading ? (loadingLabel ?? label) : label}
    aria-busy={loading || undefined}
    disabled={disabled || loading}
  >
    {loading ? <Spinner size="sm" label={loadingLabel} decorative /> : children}
  </button>;
}

interface FieldFrameProps {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  optionalLabel?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>, FieldFrameProps {
  controlSize?: ControlSize;
  ref?: Ref<HTMLInputElement>;
}

export function Field({
  label,
  hint,
  error,
  optionalLabel,
  prefix,
  suffix,
  controlSize = 'md',
  className = '',
  id: providedId,
  'aria-describedby': ariaDescribedBy,
  ref,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = providedId ?? `sc-field-${generatedId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return <div className={`sc-field${error ? ' has-error' : ''}${props.disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}>
    <label className="sc-field__label" htmlFor={id}>{label}{optionalLabel ? <small>{optionalLabel}</small> : null}</label>
    <span className={`sc-field__control sc-field__control--${controlSize}`}>
      {prefix ? <span className="sc-field__affix" aria-hidden="true">{prefix}</span> : null}
      <input {...props} ref={ref} id={id} aria-describedby={describedBy} aria-errormessage={errorId} aria-invalid={Boolean(error) || undefined} />
      {suffix ? <span className="sc-field__affix">{suffix}</span> : null}
    </span>
    {hint ? <small id={hintId} className="sc-field__hint">{hint}</small> : null}
    {error ? <small id={errorId} className="sc-field__error" role="alert">{error}</small> : null}
  </div>;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'prefix'>, FieldFrameProps {
  controlSize?: ControlSize;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({
  label,
  hint,
  error,
  optionalLabel,
  prefix,
  suffix,
  controlSize = 'md',
  className = '',
  id: providedId,
  'aria-describedby': ariaDescribedBy,
  children,
  ref,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const id = providedId ?? `sc-select-${generatedId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return <div className={`sc-field${error ? ' has-error' : ''}${props.disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}>
    <label className="sc-field__label" htmlFor={id}>{label}{optionalLabel ? <small>{optionalLabel}</small> : null}</label>
    <span className={`sc-field__control sc-field__control--select sc-field__control--${controlSize}`}>
      {prefix ? <span className="sc-field__affix" aria-hidden="true">{prefix}</span> : null}
      <select {...props} ref={ref} id={id} aria-describedby={describedBy} aria-errormessage={errorId} aria-invalid={Boolean(error) || undefined}>{children}</select>
      {suffix ? <span className="sc-field__affix">{suffix}</span> : <ChevronDown className="sc-field__select-icon" size={16} aria-hidden="true" />}
    </span>
    {hint ? <small id={hintId} className="sc-field__hint">{hint}</small> : null}
    {error ? <small id={errorId} className="sc-field__error" role="alert">{error}</small> : null}
  </div>;
}

export interface SegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  label: string;
  value: string;
  options: readonly SegmentedOption[];
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** Id(s) of the text that describes the group, for `aria-describedby`. */
  describedBy?: string;
}

export const SegmentedControl = ({
  label,
  value,
  options,
  onValueChange,
  size = 'md',
  className = '',
  describedBy,
}: SegmentedControlProps) => {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (currentIndex: number, key: string) => {
    const enabled = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
    if (!enabled.length) return;
    const currentPosition = Math.max(0, enabled.indexOf(currentIndex));
    let nextPosition = currentPosition;
    if (key === 'Home') nextPosition = 0;
    else if (key === 'End') nextPosition = enabled.length - 1;
    else if (key === 'ArrowRight' || key === 'ArrowDown') nextPosition = (currentPosition + 1) % enabled.length;
    else if (key === 'ArrowLeft' || key === 'ArrowUp') nextPosition = (currentPosition - 1 + enabled.length) % enabled.length;
    else return;
    const nextIndex = enabled[nextPosition];
    onValueChange(options[nextIndex].value);
    window.requestAnimationFrame(() => buttonRefs.current[nextIndex]?.focus());
  };

  return <div
    className={`sc-segmented sc-segmented--${size}${className ? ` ${className}` : ''}`}
    role="radiogroup"
    aria-label={label}
    aria-describedby={describedBy}
  >
    {options.map((option, index) => {
      const selected = option.value === value;
      return <button
        key={option.value}
        ref={(element) => { buttonRefs.current[index] = element; }}
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={option.disabled}
        tabIndex={selected ? 0 : -1}
        onClick={() => onValueChange(option.value)}
        onKeyDown={(event) => {
          if (!['Home', 'End', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
          event.preventDefault();
          move(index, event.key);
        }}
      >{option.label}</button>;
    })}
  </div>;
};
