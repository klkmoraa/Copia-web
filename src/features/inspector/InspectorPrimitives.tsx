import type { LucideIcon } from 'lucide-react';
import { CircleHelp, LockKeyhole, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { Accordion } from '../../design-system/components/disclosure';

export interface InspectorSummaryMetric {
  label: string;
  value: string;
  tone?: 'neutral' | 'axial' | 'shear' | 'moment';
}

export const InspectorSelectionSummary = ({
  icon: Icon,
  type,
  id,
  description,
  metrics = [],
}: {
  icon: LucideIcon;
  type: string;
  id: string;
  description: string;
  metrics?: readonly InspectorSummaryMetric[];
}) => {
  const { t } = useI18n();
  /* Sin estado vacio: el panel ya no monta este resumen cuando no hay nada que
     resumir — en ese caso enseña el Panorama del modelo. */
  return <section className="inspector-summary" aria-label={t('inspector.selectionSummary')}>
    <div className="inspector-summary__identity">
      <span className="inspector-summary__preview" aria-hidden="true"><Icon size={20} /></span>
      <div>
        <span className="inspector-summary__type">{type}</span>
        <strong>{id}</strong>
        <small>{description}</small>
      </div>
    </div>
    {metrics.length > 0 ? <dl className="inspector-summary__metrics" aria-label={t('inspector.quickResults')}>
      {metrics.map((metric) => <div key={metric.label} className={metric.tone ? `is-${metric.tone}` : undefined}>
        <dt>{metric.label}</dt>
        <dd>{metric.value}</dd>
      </div>)}
    </dl> : null}
  </section>;
};

export const InspectorPropertyGroup = ({
  title,
  description,
  mode = 'editable',
  children,
  className = '',
}: {
  title: string;
  description?: string;
  mode?: 'editable' | 'derived';
  children: ReactNode;
  className?: string;
}) => {
  const { t } = useI18n();
  return <section className={`inspector-property-group is-${mode}${className ? ` ${className}` : ''}`}>
    <header className="inspector-property-group__header">
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <span className="inspector-property-group__mode">
        {mode === 'editable' ? <PencilLine size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}
        {mode === 'editable' ? t('inspector.editable') : t('inspector.calculated')}
      </span>
    </header>
    <div className="inspector-property-group__body">{children}</div>
  </section>;
};

export interface InspectorDerivedRow {
  label: string;
  value: ReactNode;
  description?: string;
}

export const InspectorDerivedList = ({ rows }: { rows: readonly InspectorDerivedRow[] }) => (
  <dl className="inspector-derived-list">
    {rows.map((row) => <div key={row.label}>
      <dt>{row.label}{row.description ? <small>{row.description}</small> : null}</dt>
      <dd>{row.value}</dd>
    </div>)}
  </dl>
);

export const InspectorLockedState = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="inspector-locked-state" role="note">
    <LockKeyhole size={16} aria-hidden="true" />
    <div><strong>{title}</strong><span>{children}</span></div>
  </div>
);

export const InspectorHelper = ({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) => (
  <div className={`inspector-helper is-${tone}`} role={tone === 'warning' ? 'status' : undefined}>
    <CircleHelp size={16} aria-hidden="true" />
    <span>{children}</span>
  </div>
);

export const InspectorAdvancedProperties = ({
  id,
  expanded,
  onExpandedChange,
  children,
}: {
  id: string;
  expanded: readonly string[];
  onExpandedChange: (expanded: string[]) => void;
  children: ReactNode;
}) => {
  const { t } = useI18n();
  return <Accordion
    multiple
    className="inspector-advanced"
    expanded={expanded}
    onExpandedChange={onExpandedChange}
    items={[{
      id,
      title: t('inspector.advancedProperties'),
      content: <div className="inspector-advanced__content">{children}</div>,
    }]}
  />;
};
