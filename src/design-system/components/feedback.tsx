import type { HTMLAttributes, ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';

export type FeedbackTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  decorative?: boolean;
}

export const Spinner = ({
  size = 'md',
  label = 'Loading',
  decorative = false,
  className = '',
  ...props
}: SpinnerProps) => (
  <span
    {...props}
    className={`sc-spinner sc-spinner--${size}${className ? ` ${className}` : ''}`}
    role={decorative ? undefined : 'status'}
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : label}
  >
    <span className="sc-spinner__ring" aria-hidden="true" />
  </span>
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: FeedbackTone;
  dot?: boolean;
}

export const Badge = ({ tone = 'neutral', dot = false, className = '', children, ...props }: BadgeProps) => (
  <span {...props} className={`sc-badge sc-badge--${tone}${className ? ` ${className}` : ''}`}>
    {dot ? <span className="sc-badge__dot" aria-hidden="true" /> : null}
    {children}
  </span>
);

export interface BannerProps extends HTMLAttributes<HTMLElement> {
  tone?: Exclude<FeedbackTone, 'neutral'>;
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}

export const Banner = ({
  tone = 'info',
  title,
  icon,
  actions,
  onDismiss,
  dismissLabel = 'Dismiss',
  className = '',
  children,
  ...props
}: BannerProps) => (
  <section
    {...props}
    className={`sc-banner sc-banner--${tone}${className ? ` ${className}` : ''}`}
    role={tone === 'error' ? 'alert' : 'status'}
    aria-live={tone === 'error' ? 'assertive' : 'polite'}
    aria-atomic="true"
  >
    <span className="sc-banner__icon" aria-hidden="true">{icon ?? (
      tone === 'success' ? <CheckCircle2 size={18} />
        : tone === 'warning' ? <TriangleAlert size={18} />
          : tone === 'error' ? <CircleAlert size={18} />
            : <Info size={18} />
    )}</span>
    <div className="sc-banner__copy">
      <strong>{title}</strong>
      {children ? <div className="sc-banner__description">{children}</div> : null}
      {actions ? <div className="sc-banner__actions">{actions}</div> : null}
    </div>
    {onDismiss ? <button type="button" className="sc-banner__dismiss" aria-label={dismissLabel} onClick={onDismiss}><X size={16} /></button> : null}
  </section>
);

export interface EmptyStateProps extends HTMLAttributes<HTMLElement> {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export const EmptyState = ({
  title,
  description,
  icon,
  action,
  compact = false,
  className = '',
  ...props
}: EmptyStateProps) => (
  <section {...props} className={`sc-empty-state${compact ? ' sc-empty-state--compact' : ''}${className ? ` ${className}` : ''}`}>
    {icon ? <span className="sc-empty-state__icon" aria-hidden="true">{icon}</span> : null}
    <div className="sc-empty-state__copy">
      <strong>{title}</strong>
      {description ? <div>{description}</div> : null}
    </div>
    {action ? <div className="sc-empty-state__action">{action}</div> : null}
  </section>
);

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}

export const Divider = ({ orientation = 'horizontal', label, className = '', ...props }: DividerProps) => (
  <div
    {...props}
    className={`sc-divider sc-divider--${orientation}${label ? ' sc-divider--labeled' : ''}${className ? ` ${className}` : ''}`}
    role="separator"
    aria-orientation={orientation}
  >
    {label ? <span>{label}</span> : null}
  </div>
);
