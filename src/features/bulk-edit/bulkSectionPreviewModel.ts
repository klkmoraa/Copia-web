import { findStandardSection } from '../../data/standardSections';
import { findBulkProperty } from './bulkEditAggregation';
import type { AggregatedValue, BulkEditDraft, BulkSelectionAggregate } from './bulkEditTypes';

/**
 * Modelo puro de la vista previa ACTUAL → OBJETIVO de la sección.
 *
 * Distingue tres procedencias visibles y una ausencia:
 *
 * - `catalog`: identidad explícita y verificable en el catálogo, se dibuja la
 *   forma real del perfil;
 * - `equivalent`: no hay identidad, sólo A e I, así que se dibuja la rectangular
 *   equivalente y se rotula como tal;
 * - `mixed`: la selección no comparte una sola sección; no se elige ninguna;
 * - `none`: ningún miembro seleccionado admite sección.
 *
 * La cuarta procedencia futura —una sección paramétrica del Section Builder—
 * entra como una variante más de esta unión sin tocar el resto del panel. Esta
 * fase no la implementa: no hay geometría paramétrica ni fórmulas nuevas.
 */
export type BulkSectionSource =
  | { kind: 'catalog'; sectionId: string }
  | { kind: 'equivalent'; area: number; inertia: number }
  | { kind: 'mixed' }
  | { kind: 'none' };

export interface BulkSectionPreviewModel {
  current: BulkSectionSource;
  target: BulkSectionSource;
  /** `false` deja explícito que no hay cambio preparado, no que sea irrelevante. */
  changed: boolean;
}

const sameString = (value: AggregatedValue): string | undefined =>
  value.state === 'same' && typeof value.value === 'string' ? value.value : undefined;

const sameNumber = (value: AggregatedValue): number | undefined =>
  value.state === 'same' && typeof value.value === 'number' ? value.value : undefined;

/**
 * Sin identidad de catálogo verificada sólo queda la equivalente, y sólo si A e I
 * son comunes a toda la selección. Deducir un perfil comercial a partir de esos
 * dos números sería inventar una identidad que el modelo no guarda.
 */
const equivalentOrMixed = (aggregate: BulkSelectionAggregate): BulkSectionSource => {
  const area = sameNumber(findBulkProperty(aggregate, 'member.A').value);
  const inertia = sameNumber(findBulkProperty(aggregate, 'member.I').value);
  return area !== undefined && inertia !== undefined
    ? { kind: 'equivalent', area, inertia }
    : { kind: 'mixed' };
};

const resolveCurrentSource = (aggregate: BulkSelectionAggregate): BulkSectionSource => {
  const section = findBulkProperty(aggregate, 'member.sectionId');
  if (section.value.state === 'incompatible') return { kind: 'none' };
  if (section.value.state === 'mixed') return { kind: 'mixed' };

  const sectionId = sameString(section.value);
  const origin = sameString(findBulkProperty(aggregate, 'member.sectionOrigin').value);
  if (!sectionId || origin !== 'catalog') return equivalentOrMixed(aggregate);
  // Un id que el catálogo no reconoce no puede dibujarse como perfil real.
  return findStandardSection(sectionId) ? { kind: 'catalog', sectionId } : equivalentOrMixed(aggregate);
};

export const buildBulkSectionPreview = (
  aggregate: BulkSelectionAggregate,
  draft: BulkEditDraft,
): BulkSectionPreviewModel => {
  const current = resolveCurrentSource(aggregate);
  const staged = draft['member.sectionId'];
  const stagedId = staged?.kind === 'set' && typeof staged.value === 'string' ? staged.value : undefined;
  const target: BulkSectionSource | undefined = stagedId && findStandardSection(stagedId)
    ? { kind: 'catalog', sectionId: stagedId }
    : undefined;

  return target && current.kind !== 'none'
    ? { current, target, changed: true }
    : { current, target: current, changed: false };
};
