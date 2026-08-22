import { ArrowRight } from 'lucide-react';
import type { Language } from '../../i18n/catalogs';
import type { UnitSystemId } from '../../types';
import { findBulkProperty } from './bulkEditAggregation';
import { createBulkEditTranslator } from './bulkEditCopy';
import {
  bulkPropertyLabel,
  formatAggregatedValue,
  formatBulkValue,
  type BulkFormatContext,
} from './bulkEditPresentation';
import type { BulkChangeSummaryRow, BulkSelectionAggregate } from './bulkEditTypes';

/**
 * Resumen de lo que se aplicaría.
 *
 * Se deriva de la intención preparada, no de comparar formularios: por eso puede
 * afirmar «Sin cambios» sobre una propiedad mixta sin riesgo de escribirla.
 *
 * Lo que cambia se lee primero y entero. Lo que no cambia sigue estando —saber
 * qué NO se toca es media información— pero plegado en una sola línea: con 16
 * propiedades por miembro, quince filas de «Sin cambios» esconden el único
 * cambio real en vez de acompañarlo.
 */
export const BulkChangeSummary = ({
  aggregate,
  rows,
  units,
  language,
  /** La revisión abre siempre desplegado lo que no cambia; el panel lo pliega. */
  expandUntouched = false,
}: {
  aggregate: BulkSelectionAggregate;
  rows: readonly BulkChangeSummaryRow[];
  units: UnitSystemId;
  language: Language;
  expandUntouched?: boolean;
}) => {
  const t = createBulkEditTranslator(language);
  const context: BulkFormatContext = { t, language, units };
  const staged = rows.filter((row) => row.status !== 'unchanged');
  const untouched = rows.length - staged.length;
  const heading = staged.length === 0
    ? t('changes.none')
    : staged.length === 1 ? t('changes.countOne') : t('changes.count', { count: staged.length });

  return <section className="bulk-changes" aria-label={t('changes.title')}>
    <h3 className="bulk-changes__title">{t('changes.title')}</h3>
    <p className="bulk-changes__count" data-testid="bulk-changes-count" role="status">{heading}</p>

    {staged.length > 0 ? <dl className="bulk-changes__list">
      {staged.map((row) => {
        const state = findBulkProperty(aggregate, row.property);
        return <div key={row.property} className={`bulk-changes__row is-${row.status}`} data-property={row.property}>
          <dt>{bulkPropertyLabel(t, row.property)}</dt>
          <dd>
            <span className="bulk-changes__transition">
              {formatAggregatedValue(state, row.current, context)}
              {/* La dirección del cambio no puede vivir sólo en el icono. */}
              <span className="sr-only">{t('changes.to')}</span>
              <ArrowRight size={13} aria-hidden="true" />
              {row.status === 'clear' || row.next === undefined
                ? t('changes.clear')
                : formatBulkValue(state, row.next, context)}
            </span>
            <small>
              {row.affected === 1 ? t('changes.affectedOne') : t('changes.affected', { count: row.affected })}
              {/* Cuántos quedan fuera **y por qué**: un número solo obliga a
                  volver al campo para averiguar la causa. */}
              {row.skipped > 0
                ? ` · ${row.skipped === 1 ? t('changes.skippedOne') : t('changes.skipped', { count: row.skipped })}`
                : ''}
              {row.reasons.map((reason) => ` · ${t(`reason.${reason}`)}`).join('')}
            </small>
          </dd>
        </div>;
      })}
    </dl> : null}

    {untouched > 0 ? <details className="bulk-changes__untouched" data-testid="bulk-changes-untouched" open={expandUntouched}>
      <summary>{untouched === 1 ? t('changes.unchangedCountOne') : t('changes.unchangedCount', { count: untouched })}</summary>
      <ul>
        {rows.filter((row) => row.status === 'unchanged').map((row) => <li key={row.property} data-property={row.property}>
          {bulkPropertyLabel(t, row.property)}
          <span>{formatAggregatedValue(findBulkProperty(aggregate, row.property), row.current, context)}</span>
        </li>)}
      </ul>
    </details> : null}
  </section>;
};
