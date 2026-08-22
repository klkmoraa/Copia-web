import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import { editableBulkProperties } from './bulkEditAggregation';
import type {
  BulkChangeIntent,
  BulkChangeSummaryRow,
  BulkDefinedValue,
  BulkEditDraft,
  BulkEditIntent,
  BulkEditIntentEntry,
  BulkPropertyId,
  BulkPropertyState,
  BulkSelectionAggregate,
  BulkStagedChange,
  BulkTargetRef,
} from './bulkEditTypes';

/**
 * Intención preparada de la edición múltiple.
 *
 * El borrador guarda **sólo** lo que el usuario tocó. Una propiedad ausente es
 * `untouched` y no llega nunca a la intención: un valor mixto que nadie editó no
 * puede convertirse en una escritura. Por eso el resumen se deriva de la
 * intención y no de comparar dos formularios completos.
 *
 * Esta fase no muta `ProjectModel`. `buildBulkEditIntent` describe qué se
 * cambiaría y sobre qué entidades; ejecutarlo es trabajo de una fase posterior.
 */

export const EMPTY_BULK_DRAFT: BulkEditDraft = Object.freeze({});

/**
 * Una identidad de catálogo lleva consigo sus números. Prepararlas a la vez
 * describiría un miembro cuyo id dice una cosa y cuyas propiedades dicen otra,
 * que es justo la incoherencia que `member.update` evita degradando el origen.
 * Preparar un lado retira el otro.
 */
const IDENTITY_COUPLINGS: readonly (readonly [BulkPropertyId, readonly BulkPropertyId[]])[] = [
  ['member.sectionId', ['member.A', 'member.I']],
  ['member.materialId', ['member.E', 'member.G', 'member.density']],
];

const coupledProperties = (id: BulkPropertyId): readonly BulkPropertyId[] => {
  for (const [identity, numerics] of IDENTITY_COUPLINGS) {
    if (id === identity) return numerics;
    if (numerics.includes(id)) return [identity];
  }
  return [];
};

const valueMatchesKind = (state: BulkPropertyState, value: BulkDefinedValue): boolean => {
  switch (state.kind) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'enum':
      return typeof value === 'string' && (state.options?.includes(value) ?? false);
    // Un id que el catálogo no reconoce no puede resolver ni origen ni números:
    // aceptarlo dejaría una intención inaplicable sin inventar procedencia.
    case 'material':
      return typeof value === 'string' && findStandardMaterial(value) !== undefined;
    case 'section':
      return typeof value === 'string' && findStandardSection(value) !== undefined;
  }
};

/**
 * Un cambio sólo puede prepararse sobre una propiedad editable, con al menos una
 * entidad compatible y con un valor del tipo correcto. Si algo falla el borrador
 * se devuelve intacto: preparar una intención inválida sería peor que no hacerlo.
 */
export const canStageBulkChange = (state: BulkPropertyState, change: BulkStagedChange): boolean => {
  if (!state.editable || state.compatibility.compatible.length === 0) return false;
  return change.kind === 'clear' ? state.clearable : valueMatchesKind(state, change.value);
};

export const stageBulkChange = (
  draft: BulkEditDraft,
  state: BulkPropertyState,
  change: BulkStagedChange,
): BulkEditDraft => {
  if (!canStageBulkChange(state, change)) return draft;
  const next: Record<string, BulkStagedChange> = { ...draft };
  for (const coupled of coupledProperties(state.id)) delete next[coupled];
  next[state.id] = change;
  return next;
};

/** Devuelve la propiedad al estado `untouched`; no la fija a un valor «vacío». */
export const untouchBulkChange = (draft: BulkEditDraft, id: BulkPropertyId): BulkEditDraft => {
  if (!(id in draft)) return draft;
  const next = { ...draft };
  delete next[id];
  return next;
};

export const resolveBulkChange = (draft: BulkEditDraft, id: BulkPropertyId): BulkChangeIntent =>
  draft[id] ?? { kind: 'untouched' };

export const buildBulkEditIntent = (
  aggregate: BulkSelectionAggregate,
  draft: BulkEditDraft,
): BulkEditIntent => {
  const entries: BulkEditIntentEntry[] = [];
  const affected = new Map<string, BulkTargetRef>();
  let hasIncompatibleTargets = false;

  // El orden del registro de propiedades, no el orden en que el usuario editó:
  // el resumen tiene que leerse igual sin importar por dónde empezó.
  for (const state of aggregate.properties) {
    const change = draft[state.id];
    if (!change || !canStageBulkChange(state, change)) continue;
    entries.push({
      property: state.id,
      change,
      previous: state.value,
      compatible: state.compatibility.compatible,
      incompatible: state.compatibility.incompatible,
    });
    for (const target of state.compatibility.compatible) affected.set(`${target.kind}:${target.id}`, target);
    if (state.compatibility.incompatible.length > 0) hasIncompatibleTargets = true;
  }

  return { entries, affected: [...affected.values()], hasIncompatibleTargets };
};

/**
 * Una fila por propiedad ofrecida, incluidas las que no cambian: el usuario debe
 * poder leer qué NO va a tocarse con la misma claridad que lo que sí.
 */
export const buildBulkChangeSummary = (
  aggregate: BulkSelectionAggregate,
  draft: BulkEditDraft,
): readonly BulkChangeSummaryRow[] => editableBulkProperties(aggregate).map((state) => {
  const change = draft[state.id];
  if (!change || !canStageBulkChange(state, change)) {
    return { property: state.id, status: 'unchanged', current: state.value, affected: 0, skipped: 0, reasons: [] };
  }
  return {
    property: state.id,
    status: change.kind,
    current: state.value,
    next: change.kind === 'set' ? change.value : undefined,
    affected: state.compatibility.compatible.length,
    skipped: state.compatibility.incompatible.length,
    // El motivo viaja con la fila: la revisión tiene que poder decir por qué
    // queda alguien fuera sin volver a recorrer la compatibilidad.
    reasons: [...new Set(state.compatibility.incompatible.map((entry) => entry.reason))],
  };
});
