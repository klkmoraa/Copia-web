/**
 * Proveedor local y determinista.
 *
 * No es una IA ni pretende serlo: es el enchufe con la forma correcta. Existe
 * para que toda la maquinaria —esquema, allowlist, unidades, clon, diff,
 * confirmación— tenga algo que la ejercite hoy, y para dejar demostrado que
 * cambiar de proveedor es cambiar **este archivo y sólo éste**.
 *
 * Reconoce lo que puede reconocer sin ambigüedad —un ID que existe, una
 * cantidad con su unidad— y en cuanto no lo tiene contesta
 * `needs-clarification` o `rejected`. Eso no es una limitación de la
 * implementación: es lo que el contrato pide que haga cualquier proveedor,
 * incluido uno que razone. Una propuesta ambigua no se resuelve adivinando.
 *
 * **Cero red.** Un gate comprueba que en `src/ai/**` no aparece ninguna forma
 * de salir del dispositivo.
 */
import type { CommandProposalV1, ProposalProvider, ProposalRequest } from './commandProposal';
import { allowedUnits } from './proposalUnits';

const newProposalId = (): string => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new Error('Se necesita crypto.randomUUID para identificar una propuesta.');
};

/** Primer identificador de la lista que aparece mencionado en el texto, o `null`. */
const mentioned = (intent: string, ids: readonly string[]): string | null => {
  const haystack = intent.toLowerCase();
  // El más largo primero: si existen «M1» y «M12», mencionar M12 no puede
  // resolverse como M1 más un dígito suelto.
  const candidates = [...ids].sort((a, b) => b.length - a.length);
  return candidates.find((id) => haystack.includes(id.toLowerCase())) ?? null;
};

const QUANTITY_FIELDS = {
  E: 'elasticModulus',
  A: 'area',
  I: 'inertia',
  density: 'density',
} as const;

/** Busca «E = 210 GPa» y equivalentes, con la unidad tomada de la lista admitida. */
const readQuantity = (intent: string, field: keyof typeof QUANTITY_FIELDS) => {
  const units = allowedUnits(QUANTITY_FIELDS[field]).map((unit) => unit.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const pattern = new RegExp(`\\b${field}\\b\\s*=?\\s*(-?\\d+(?:[.,]\\d+)?)\\s*(${units.join('|')})\\b`, 'i');
  const match = pattern.exec(intent);
  if (!match) return null;
  // La unidad se devuelve con la grafía del catálogo, no con la que escribió el
  // usuario: el validador compara contra la lista cerrada, no contra variantes.
  const unit = allowedUnits(QUANTITY_FIELDS[field]).find((candidate) => candidate.toLowerCase() === match[2].toLowerCase())!;
  return { value: Number.parseFloat(match[1].replace(',', '.')), unit };
};

export const createLocalProposalProvider = (): ProposalProvider => ({
  id: 'local-deterministic',
  async propose(request: ProposalRequest): Promise<unknown> {
    const base = { version: 1 as const, proposalId: newProposalId(), snapshotHash: request.snapshotHash };
    const memberId = mentioned(request.intent, request.memberIds);

    if (!memberId) {
      return {
        ...base,
        status: 'needs-clarification',
        summary: 'No se identificó la barra sobre la que actuar.',
        question: '¿Sobre qué barra hay que aplicar el cambio? Nómbrala por su identificador.',
      } satisfies CommandProposalV1;
    }

    const sectionId = mentioned(request.intent, request.sectionIds);
    if (sectionId) {
      return {
        ...base,
        status: 'ready',
        summary: `Aplicar la sección ${sectionId} a la barra ${memberId}.`,
        operation: { kind: 'member.section.apply', memberId, sectionId },
      } satisfies CommandProposalV1;
    }

    const materialId = mentioned(request.intent, request.materialIds);
    if (materialId) {
      return {
        ...base,
        status: 'ready',
        summary: `Aplicar el material ${materialId} a la barra ${memberId}.`,
        operation: { kind: 'member.material.apply', memberId, materialId },
      } satisfies CommandProposalV1;
    }

    const changes: Record<string, { value: number; unit: string }> = {};
    for (const field of Object.keys(QUANTITY_FIELDS) as Array<keyof typeof QUANTITY_FIELDS>) {
      const quantity = readQuantity(request.intent, field);
      if (quantity) changes[field] = quantity;
    }
    if (Object.keys(changes).length) {
      return {
        ...base,
        status: 'ready',
        summary: `Actualizar ${Object.keys(changes).join(', ')} en la barra ${memberId}.`,
        operation: { kind: 'member.update', memberId, changes },
      } as CommandProposalV1;
    }

    return {
      ...base,
      status: 'rejected',
      summary: `No hay ninguna operación de la lista admitida que corresponda a lo pedido sobre ${memberId}.`,
      reason: 'La petición no nombra una sección, un material ni una propiedad con su unidad.',
    } satisfies CommandProposalV1;
  },
});
