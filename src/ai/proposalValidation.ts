/**
 * Validador cerrado de `CommandProposalV1`.
 *
 * Escrito a mano y no con un validador de terceros por una razón concreta: el
 * pre-RFC exige `additionalProperties: false` **revalidado en local aunque el
 * proveedor anuncie modo JSON estricto**. Una biblioteca haría eso mismo y
 * además traería su propio compilador de esquemas al chunk; lo que no haría es
 * dejar escrito, junto a cada campo, por qué ese campo es como es. Aquí el
 * esquema y su razón viven en el mismo sitio.
 *
 * La regla de oro de este archivo: **nada se corrige**. Un campo sobrante no se
 * ignora, un número como texto no se convierte, una unidad desconocida no se
 * adivina. Cada tolerancia sería una forma de que un texto externo acabara
 * significando algo que nadie escribió.
 */
import {
  PROPOSED_OPERATION_KINDS,
  type CommandProposalV1,
  type ProposalQuantityValue,
  type ProposedOperation,
} from './commandProposal';

export interface ValidationFailure {
  ok: false;
  /** Ruta del campo culpable, en notación de puntos. */
  path: string;
  reason: string;
}
export type ValidationOutcome<T> = { ok: true; value: T } | ValidationFailure;

const fail = (path: string, reason: string): ValidationFailure => ({ ok: false, path, reason });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Rechaza toda clave que no esté declarada. Es el `additionalProperties: false` del contrato. */
const rejectExtraKeys = (value: Record<string, unknown>, allowed: readonly string[], path: string): ValidationFailure | null => {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  return extra.length ? fail(path, `Propiedades no declaradas en el contrato: ${extra.join(', ')}.`) : null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;

const validateQuantity = (value: unknown, path: string): ValidationOutcome<ProposalQuantityValue> => {
  if (!isRecord(value)) return fail(path, 'Una cantidad tiene que ser un objeto con valor y unidad.');
  const extra = rejectExtraKeys(value, ['value', 'unit'], path);
  if (extra) return extra;
  // `typeof 'x' === 'number'` es falso para una cadena numérica, y así se queda:
  // aceptar "210000" sería aceptar que el proveedor decida el tipo.
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
    return fail(`${path}.value`, 'El valor tiene que ser un número finito.');
  }
  if (typeof value.unit !== 'string' || !value.unit) {
    return fail(`${path}.unit`, 'La unidad tiene que ser una cadena no vacía.');
  }
  return { ok: true, value: { value: value.value, unit: value.unit } };
};

const UPDATE_FIELDS = ['E', 'A', 'I', 'density', 'label'] as const;

const validateOperation = (value: unknown, path: string): ValidationOutcome<ProposedOperation> => {
  if (!isRecord(value)) return fail(path, 'La operación tiene que ser un objeto.');
  const kind = value.kind;
  if (typeof kind !== 'string' || !(PROPOSED_OPERATION_KINDS as readonly string[]).includes(kind)) {
    return fail(`${path}.kind`, `Operación fuera de la allowlist. Admitidas: ${PROPOSED_OPERATION_KINDS.join(', ')}.`);
  }
  if (typeof value.memberId !== 'string' || !value.memberId) {
    return fail(`${path}.memberId`, 'Falta el identificador de la barra.');
  }

  if (kind === 'member.section.apply' || kind === 'member.material.apply') {
    const key = kind === 'member.section.apply' ? 'sectionId' : 'materialId';
    const extra = rejectExtraKeys(value, ['kind', 'memberId', key], path);
    if (extra) return extra;
    const id = value[key];
    if (typeof id !== 'string' || !id) return fail(`${path}.${key}`, 'Falta el identificador del catálogo.');
    return kind === 'member.section.apply'
      ? { ok: true, value: { kind, memberId: value.memberId, sectionId: id } }
      : { ok: true, value: { kind, memberId: value.memberId, materialId: id } };
  }

  const extra = rejectExtraKeys(value, ['kind', 'memberId', 'changes'], path);
  if (extra) return extra;
  const changes = value.changes;
  if (!isRecord(changes)) return fail(`${path}.changes`, 'Los cambios tienen que ser un objeto.');
  const extraChanges = rejectExtraKeys(changes, UPDATE_FIELDS, `${path}.changes`);
  if (extraChanges) return extraChanges;
  if (!Object.keys(changes).length) {
    return fail(`${path}.changes`, 'Una propuesta que no cambia nada no es una propuesta.');
  }

  const parsed: ProposedOperation & { kind: 'member.update' } = { kind: 'member.update', memberId: value.memberId, changes: {} };
  for (const field of ['E', 'A', 'I', 'density'] as const) {
    if (!(field in changes)) continue;
    const quantity = validateQuantity(changes[field], `${path}.changes.${field}`);
    if (!quantity.ok) return quantity;
    parsed.changes[field] = quantity.value;
  }
  if ('label' in changes) {
    if (typeof changes.label !== 'string') return fail(`${path}.changes.label`, 'La etiqueta tiene que ser una cadena.');
    if (changes.label.length > 60) return fail(`${path}.changes.label`, 'La etiqueta no puede pasar de 60 caracteres.');
    parsed.changes.label = changes.label;
  }
  return { ok: true, value: parsed };
};

/**
 * Convierte una respuesta de proveedor —`unknown`— en una propuesta válida, o
 * dice exactamente qué campo la invalidó.
 */
export const validateCommandProposal = (input: unknown): ValidationOutcome<CommandProposalV1> => {
  if (!isRecord(input)) return fail('', 'La respuesta no es un objeto.');

  const statusKeys = {
    ready: 'operation',
    'needs-clarification': 'question',
    rejected: 'reason',
  } as const;
  const status = input.status as keyof typeof statusKeys;
  if (typeof input.status !== 'string' || !(status in statusKeys)) {
    return fail('status', `Estado desconocido. Admitidos: ${Object.keys(statusKeys).join(', ')}.`);
  }
  const extra = rejectExtraKeys(input, ['version', 'proposalId', 'snapshotHash', 'status', 'summary', statusKeys[status]], '');
  if (extra) return extra;

  // La versión es `const 1`, no «un número»: una propuesta de otra versión no
  // se interpreta con las reglas de ésta.
  if (input.version !== 1) return fail('version', 'Sólo se admite la versión 1 del contrato.');
  if (typeof input.proposalId !== 'string' || !UUID.test(input.proposalId)) {
    return fail('proposalId', 'El identificador de propuesta tiene que ser un UUID.');
  }
  if (typeof input.snapshotHash !== 'string' || !SHA256.test(input.snapshotHash)) {
    return fail('snapshotHash', 'La huella del proyecto tiene que ser un SHA-256 en hexadecimal.');
  }
  if (typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > 240) {
    return fail('summary', 'El resumen tiene que ser una cadena de 1 a 240 caracteres.');
  }

  const base = {
    version: 1 as const,
    proposalId: input.proposalId,
    snapshotHash: input.snapshotHash,
    summary: input.summary,
  };

  if (status === 'ready') {
    const operation = validateOperation(input.operation, 'operation');
    if (!operation.ok) return operation;
    return { ok: true, value: { ...base, status: 'ready', operation: operation.value } };
  }
  const field = statusKeys[status];
  const text = input[field];
  if (typeof text !== 'string' || !text.trim() || text.length > 240) {
    return fail(field, 'El texto tiene que ser una cadena de 1 a 240 caracteres.');
  }
  return status === 'needs-clarification'
    ? { ok: true, value: { ...base, status, question: text } }
    : { ok: true, value: { ...base, status, reason: text } };
};
