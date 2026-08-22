import { Layers3 } from 'lucide-react';
import type { Language } from '../../i18n/catalogs';
import { createBulkEditTranslator } from './bulkEditCopy';
import { bulkScopeBreakdown } from './bulkEditPresentation';
import type { BulkEntityKind, BulkSelectionAggregate } from './bulkEditTypes';

/**
 * Cabecera del panel: qué hay en el alcance y qué admite la edición.
 *
 * El reparto se lee familia por familia. Un único número global mezclaba objetos
 * seleccionados con cargas colgadas de ellos y podía restar un conjunto mayor
 * que su propio total; aquí cada fila se cierra sobre su familia y el recuento de
 * incompatibles sólo aparece cuando existe de verdad.
 */
const SCOPE_KEYS: Record<BulkEntityKind, 'scope.member' | 'scope.node' | 'scope.nodalLoad' | 'scope.memberLoad'> = {
  member: 'scope.member',
  node: 'scope.node',
  nodalLoad: 'scope.nodalLoad',
  memberLoad: 'scope.memberLoad',
};

export const BulkSelectionSummary = ({
  aggregate,
  language,
}: {
  aggregate: BulkSelectionAggregate;
  language: Language;
}) => {
  const t = createBulkEditTranslator(language);
  const scope = bulkScopeBreakdown(aggregate);
  const { member, node } = aggregate.counts;
  const count = (plural: 'summary.members' | 'summary.nodes' | 'summary.objects', value: number) =>
    value === 1 ? t(`${plural}One`) : t(plural, { count: value });
  const headline = aggregate.total === 0
    ? t('summary.empty')
    : node === 0
      ? count('summary.members', member)
      : member === 0
        ? count('summary.nodes', node)
        : count('summary.objects', aggregate.total);

  return <section className="bulk-summary" aria-label={t('summary.label')}>
    <span className="bulk-summary__icon" aria-hidden="true"><Layers3 size={20} /></span>
    <div className="bulk-summary__body">
      <strong>{headline}</strong>
      {aggregate.total === 0 ? <span>{t('summary.emptyHelp')}</span> : <span className="bulk-summary__counts">
        {scope.map((row) => <span key={row.kind} className="bulk-summary__chip" data-scope={row.kind}>
          {row.selected === 1 ? t(`${SCOPE_KEYS[row.kind]}One`) : t(SCOPE_KEYS[row.kind], { count: row.selected })}
          {row.incompatible > 0
            ? <em className="bulk-summary__incompatible">{t('summary.incompatible', { count: row.incompatible })}</em>
            : null}
        </span>)}
      </span>}
      {member > 0 ? <small>{t('summary.memberTypes', aggregate.memberTypeCounts)}</small> : null}
    </div>
  </section>;
};
