/**
 * Copy de interfaz para las causas de confiabilidad.
 *
 * `ReliabilityCheck.label` y `.message` los redacta el motor en español fijo:
 * son diagnóstico interno, escritos para un log y para quien lee el código, no
 * copy de producto. Publicarlos tal cual dejaba frases en español dentro de la
 * interfaz en inglés.
 *
 * Aquí la causa se **reconstruye** desde los campos estructurados que el check
 * ya trae —`id`, `value`, `limitedAbove`, `unreliableAbove`, `level`— en el
 * idioma activo. El motor no cambia: sigue siendo la única autoridad sobre qué
 * se midió y si pasó; esta capa sólo decide cómo se dice.
 */
import type { TranslationKey } from '../../i18n/catalogs';
import type { ReliabilityCheck, ReliabilityCheckId, ReliabilityLevel } from '../../types';
import { formatScientific } from '../../utils/numberFormat';

export type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

/**
 * Las cuatro palabras con las que el producto nombra la fiabilidad. Viven aquí
 * —y no en cada superficie— para que el TopBar (CRI-100) y las tarjetas de
 * resultado (CRI-101) digan literalmente lo mismo: la fiabilidad es una línea
 * de texto, y una sola redacción evita que dos zonas discrepen.
 */
export const reliabilityLevelLabelKey: Record<ReliabilityLevel, TranslationKey> = {
  reliable: 'reliability.levelReliable',
  limited: 'reliability.levelLimited',
  unreliable: 'reliability.levelUnreliable',
  failed: 'reliability.levelUnavailable',
};

export const reliabilityCheckLabelKey: Record<ReliabilityCheckId, TranslationKey> = {
  condition: 'reliability.checkCondition',
  'backward-error': 'reliability.checkBackwardError',
  'forward-error': 'reliability.checkForwardError',
  refinement: 'reliability.checkRefinement',
  'structural-residual': 'reliability.checkStructuralResidual',
  constraints: 'reliability.checkConstraints',
  equilibrium: 'reliability.checkEquilibrium',
  'load-audit': 'reliability.checkLoadAudit',
  'diagram-closure': 'reliability.checkDiagramClosure',
  compatibility: 'reliability.checkCompatibility',
  'p-delta-convergence': 'reliability.checkPDeltaConvergence',
};

/**
 * Los dos checks booleanos del motor valen 0 o 1: no son una magnitud con
 * umbral, y leerlos como «1.000e+0 supera 0e+0» sería ruido en lugar de causa.
 */
const booleanCauseKey: Partial<Record<ReliabilityCheckId, TranslationKey>> = {
  refinement: 'reliability.causeRefinement',
  'p-delta-convergence': 'reliability.causePDelta',
};

export const reliabilityCheckLabel = (check: ReliabilityCheck, t: Translate): string =>
  t(reliabilityCheckLabelKey[check.id]);

export const describeReliabilityCheck = (check: ReliabilityCheck, t: Translate): string => {
  const label = reliabilityCheckLabel(check, t);

  const booleanKey = booleanCauseKey[check.id];
  if (booleanKey) return t(booleanKey, { check: label });

  if (!Number.isFinite(check.value)) return t('reliability.causeUnbounded', { check: label });

  if (check.level === 'reliable') {
    return t('reliability.causeWithin', {
      check: label,
      value: formatScientific(check.value, 3),
      limit: formatScientific(check.limitedAbove, 0),
    });
  }
  /* Se cita el umbral que realmente se cruzó, no el otro. */
  const limit = check.level === 'unreliable' ? check.unreliableAbove : check.limitedAbove;
  return t('reliability.causeAbove', {
    check: label,
    value: formatScientific(check.value, 3),
    limit: formatScientific(limit, 0),
  });
};
