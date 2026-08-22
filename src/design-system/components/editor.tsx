import {
  useId,
  useMemo,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { CheckCircle2, Circle, CircleAlert, Clock3, TriangleAlert } from 'lucide-react';
import { Spinner } from './feedback';

export type ToolTone = 'navigation' | 'structure' | 'load' | 'distributed' | 'moment' | 'dimension' | 'cut' | 'destructive';

export interface ToolButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  label: string;
  icon: ReactNode;
  shortcut?: string;
  keyShortcut?: string;
  detail?: string;
  active?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  tone?: ToolTone;
  compact?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function ToolButton({
  label,
  icon,
  shortcut,
  keyShortcut,
  detail,
  active = false,
  loading = false,
  loadingLabel,
  tone = 'navigation',
  compact = false,
  className = '',
  disabled,
  type = 'button',
  role,
  ref,
  ...props
}: ToolButtonProps) {
  return <button
    {...props}
    ref={ref}
    type={type}
    role={role}
    className={`sc-tool-button sc-tool-button--${tone}${active ? ' is-active' : ''}${compact ? ' is-compact' : ''}${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
    aria-label={loading ? (loadingLabel ?? label) : shortcut ? `${label} (${shortcut})` : label}
    aria-pressed={role === 'menuitemradio' || role === 'radio' ? undefined : active}
    aria-busy={loading || undefined}
    aria-keyshortcuts={keyShortcut ?? shortcut}
    disabled={disabled || loading}
  >
    <span className="sc-tool-button__icon" aria-hidden="true">{loading ? <Spinner size="sm" label={loadingLabel} decorative /> : icon}</span>
    <span className="sc-tool-button__copy"><strong>{label}</strong>{detail && !compact ? <small>{detail}</small> : null}</span>
    {shortcut && !compact ? <kbd>{shortcut}</kbd> : null}
  </button>;
}

export interface ToolGroupProps {
  title: string;
  children: ReactNode;
  compact?: boolean;
  className?: string;
}

export const ToolGroup = ({ title, children, compact = false, className = '' }: ToolGroupProps) => {
  const titleId = useId();
  return <section className={`sc-tool-group${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`} role="group" aria-labelledby={titleId}>
    <h3 id={titleId}>{title}</h3>
    <div className="sc-tool-group__items">{children}</div>
  </section>;
};

export type StatusTone = 'ready' | 'loading' | 'success' | 'stale' | 'warning' | 'error';

export interface StatusStripProps {
  status: StatusTone;
  title: string;
  detail?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const StatusStrip = ({ status, title, detail, action, className = '' }: StatusStripProps) => (
  <section
    className={`sc-status-strip sc-status-strip--${status}${className ? ` ${className}` : ''}`}
    role={status === 'error' ? 'alert' : 'status'}
    aria-live={status === 'error' ? 'assertive' : status === 'loading' || status === 'stale' || status === 'warning' || status === 'success' ? 'polite' : 'off'}
    aria-atomic="true"
    aria-busy={status === 'loading' || undefined}
  >
    <span className="sc-status-strip__mark" aria-hidden="true">{
      status === 'loading' ? <Spinner size="sm" decorative />
        : status === 'success' ? <CheckCircle2 size={18} />
          : status === 'stale' ? <Clock3 size={18} />
            : status === 'warning' ? <TriangleAlert size={18} />
              : status === 'error' ? <CircleAlert size={18} />
                : <Circle size={18} />
    }</span>
    <div className="sc-status-strip__copy"><strong>{title}</strong>{detail ? <span>{detail}</span> : null}</div>
    {action ? <div className="sc-status-strip__action">{action}</div> : null}
  </section>
);

export interface PanelHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const PanelHeader = ({ title, description, actions, className = '' }: PanelHeaderProps) => (
  <header className={`sc-panel-header${className ? ` ${className}` : ''}`}>
    <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
    {actions ? <div className="sc-panel-header__actions">{actions}</div> : null}
  </header>
);

export interface PropertyRowProps {
  label: string;
  description?: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center';
  className?: string;
}

export const PropertyRow = ({ label, description, children, align = 'center', className = '' }: PropertyRowProps) => (
  <div className={`sc-property-row sc-property-row--${align}${className ? ` ${className}` : ''}`}>
    <div className="sc-property-row__label"><strong>{label}</strong>{description ? <small>{description}</small> : null}</div>
    <div className="sc-property-row__control">{children}</div>
  </div>
);

export interface UnitFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'size'> {
  label: string;
  value: string | number;
  unit: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function UnitField({
  label,
  value,
  unit,
  onValueChange,
  hint,
  error,
  id: providedId,
  className = '',
  ref,
  ...props
}: UnitFieldProps) {
  const generatedId = useId();
  const id = providedId ?? `sc-unit-field-${generatedId}`;
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return <div className={`sc-unit-field${error ? ' has-error' : ''}${props.disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}>
    <label htmlFor={id}>{label}</label>
    <span className="sc-unit-field__control">
      <input
        {...props}
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        aria-describedby={messageId}
        aria-errormessage={error ? messageId : undefined}
        aria-invalid={Boolean(error) || undefined}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <span aria-hidden="true">{unit}</span>
    </span>
    {error ? <small id={messageId} className="sc-unit-field__error" role="alert">{error}</small> : hint ? <small id={messageId}>{hint}</small> : null}
  </div>;
}

export interface ResultMetricProps {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  tone?: 'neutral' | 'axial' | 'shear' | 'moment' | 'deformed' | 'reaction';
  className?: string;
}

export const ResultMetric = ({ label, value, unit, detail, tone = 'neutral', className = '' }: ResultMetricProps) => (
  <div className={`sc-result-metric sc-result-metric--${tone}${className ? ` ${className}` : ''}`}>
    <span>{label}</span>
    <strong>{value}{unit ? <small>{unit}</small> : null}</strong>
    {detail ? <small className="sc-result-metric__detail">{detail}</small> : null}
  </div>
);

export interface LayerToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'children'> {
  label: string;
  description?: string;
  icon?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const LayerToggle = ({
  label,
  description,
  icon,
  checked,
  onCheckedChange,
  className = '',
  disabled,
  type = 'button',
  ...props
}: LayerToggleProps) => (
  <button
    {...props}
    type={type}
    className={`sc-layer-toggle${checked ? ' is-checked' : ''}${className ? ` ${className}` : ''}`}
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
  >
    {icon ? <span className="sc-layer-toggle__icon" aria-hidden="true">{icon}</span> : null}
    <span className="sc-layer-toggle__copy"><strong>{label}</strong>{description ? <small>{description}</small> : null}</span>
    <span className="sc-layer-toggle__switch" aria-hidden="true"><i /></span>
  </button>
);

export interface NumericValueProps {
  value: number | string;
  unit?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  sign?: 'auto' | 'always';
  tone?: 'default' | 'muted' | 'positive' | 'negative';
  className?: string;
}

export const NumericValue = ({
  value,
  unit,
  locale = 'es-MX',
  minimumFractionDigits = 0,
  maximumFractionDigits = 3,
  sign = 'auto',
  tone = 'default',
  className = '',
}: NumericValueProps) => {
  const formatted = useMemo(() => typeof value === 'number'
    ? new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      signDisplay: sign === 'always' ? 'always' : 'auto',
    }).format(value)
    : value, [locale, maximumFractionDigits, minimumFractionDigits, sign, value]);
  return <span className={`sc-numeric-value sc-numeric-value--${tone}${className ? ` ${className}` : ''}`}>
    <span>{formatted}</span>{unit ? <small>{unit}</small> : null}
  </span>;
};
