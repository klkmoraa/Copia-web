import type { PlacementWarning } from '../../data/generators/generatorPlacement';
import type {
  GeneratedMemberRole,
  GeneratedStructureSummary,
  GeneratorWarning,
} from '../../data/generators/generatorTypes';
import { toDisplay, unitLabel } from '../../engine/units';
import type { Language } from '../../i18n/catalogs';
import { formatNumber } from '../../utils/numberFormat';
import type { UnitSystemId } from '../../types';
import { createStructureGeneratorTranslator } from './structureGeneratorCopy';

/**
 * Presentación del resumen previo y de los avisos (CRI-38, fase 3).
 *
 * El resumen que se muestra antes de confirmar es *exacto*: cada cifra viene ya
 * contada por el núcleo sobre la geometría que se generaría, y aquí sólo se
 * convierte a las unidades del proyecto y se le pone nombre. Nada se estima, se
 * extrapola ni se redondea hacia arriba «para dar una idea»: si el número que se
 * enseña no fuera el que se va a crear, el resumen sería peor que no tenerlo.
 *
 * Los avisos conservan el mensaje que los produjo. El código decide el tono
 * —qué exige una decisión y qué sólo se informa— y el mensaje sigue siendo el
 * del núcleo o el de la inserción, que son los únicos que conocen las cifras
 * concretas del caso.
 */

export interface GeneratorSummaryRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** Detalle secundario, como el desglose de barras por rol. */
  readonly detail?: string;
}

export type GeneratorWarningTone = 'decision' | 'info';

export interface PresentedGeneratorWarning {
  readonly code: string;
  readonly tone: GeneratorWarningTone;
  readonly title: string;
  readonly message: string;
}

/**
 * Avisos que describen una decisión pendiente del usuario, no una peculiaridad
 * de la geometría. Un modelo sin apoyos no se puede analizar y dos nudos
 * coincidentes se van a quedar separados: ambos exigen que alguien decida algo
 * después, y por eso se muestran con más peso que una cercha asimétrica.
 */
const DECISION_CODES: readonly string[] = ['no-supports', 'coincident-with-existing', 'isolated-nodes'];

const MEMBER_ROLE_ORDER: readonly GeneratedMemberRole[] = [
  'beam',
  'column',
  'top-chord',
  'bottom-chord',
  'vertical',
  'diagonal',
  'grid-horizontal',
  'grid-vertical',
];

const count = (value: number, language: Language): string =>
  value.toLocaleString(language === 'en' ? 'en-US' : 'es-MX');

const length = (value: number, units: UnitSystemId): string =>
  formatNumber(toDisplay(value, units, 'length'), 'table', { maximumFractionDigits: 3 });

/**
 * Resumen exacto de lo que se crearía. Se construye a partir del resumen del
 * núcleo —nunca recorriendo la geometría otra vez—, para que lo que se lee y lo
 * que se escribe no puedan divergir.
 */
export const buildGeneratorSummaryRows = (
  summary: GeneratedStructureSummary,
  units: UnitSystemId,
  language: Language,
): readonly GeneratorSummaryRow[] => {
  const t = createStructureGeneratorTranslator(language);
  const lengthUnit = unitLabel(units, 'length');
  const rows: GeneratorSummaryRow[] = [];

  const roleDetail = MEMBER_ROLE_ORDER
    .filter((role) => (summary.memberCountsByRole[role] ?? 0) > 0)
    .map((role) => `${t(`role.${role}` as never)} ${count(summary.memberCountsByRole[role]!, language)}`)
    .join(' · ');

  rows.push({ id: 'nodes', label: t('summary.nodes'), value: count(summary.nodeCount, language) });
  rows.push({
    id: 'members',
    label: t('summary.members'),
    value: count(summary.memberCount, language),
    ...(roleDetail ? { detail: roleDetail } : {}),
  });
  rows.push({
    id: 'supports',
    label: t('summary.supports'),
    value: summary.supportedNodeCount === 0
      ? t('summary.noSupports')
      : count(summary.supportedNodeCount, language),
  });
  rows.push({
    id: 'totalLength',
    label: t('summary.totalLength'),
    value: `${length(summary.totalMemberLength, units)} ${lengthUnit}`,
  });
  rows.push({
    id: 'extent',
    label: t('summary.extent'),
    value: `${length(summary.bounds.maxX - summary.bounds.minX, units)} × ${length(summary.bounds.maxY - summary.bounds.minY, units)} ${lengthUnit}`,
    detail: `X ${length(summary.bounds.minX, units)} … ${length(summary.bounds.maxX, units)} · Y ${length(summary.bounds.minY, units)} … ${length(summary.bounds.maxY, units)}`,
  });

  // Propiedades realmente aplicadas: o la identidad de catálogo, o los números
  // que el usuario escribió. Nunca las dos cosas, porque nunca hay las dos.
  if (summary.properties.materialId && summary.properties.sectionId) {
    rows.push({ id: 'material', label: t('summary.material'), value: summary.properties.materialId });
    rows.push({ id: 'section', label: t('summary.section'), value: summary.properties.sectionId });
  } else {
    rows.push({
      id: 'custom-properties',
      label: t('summary.customProperties'),
      value: [
        `E ${formatNumber(toDisplay(summary.properties.E, units, 'elasticModulus'), 'table')} ${unitLabel(units, 'elasticModulus')}`,
        `A ${formatNumber(toDisplay(summary.properties.A, units, 'area'), 'table')} ${unitLabel(units, 'area')}`,
        `I ${formatNumber(toDisplay(summary.properties.I, units, 'inertia'), 'table')} ${unitLabel(units, 'inertia')}`,
      ].join(' · '),
    });
  }

  return rows;
};

export const presentGeneratorWarnings = (
  warnings: readonly (GeneratorWarning | PlacementWarning)[],
  language: Language,
): readonly PresentedGeneratorWarning[] => {
  const t = createStructureGeneratorTranslator(language);
  return warnings.map((warning) => ({
    code: warning.code,
    tone: DECISION_CODES.includes(warning.code) ? 'decision' : 'info',
    title: t(`warning.${warning.code}` as never),
    message: warning.message,
  }));
};

/** Cuántos avisos exigen una decisión; el pie los cuenta sin repetir la regla. */
export const countGeneratorDecisions = (
  warnings: readonly (GeneratorWarning | PlacementWarning)[],
): number => warnings.filter((warning) => DECISION_CODES.includes(warning.code)).length;
