/**
 * Contrato `CommandProposalV1`: lo único que una IA puede decir.
 *
 * Implementa la parte verificable del pre-RFC
 * (`docs/architecture/structureco-fase-4-ai-command-proposal-pre-rfc.md`) **sin
 * proveedor y sin red**. Eso no es media implementación: es la mitad que
 * decide si la otra puede existir sin riesgo, y es la que se puede probar hoy.
 *
 * ## Lo que un proveedor NO recibe y NO puede tocar
 *
 * No hay acceso a `ProjectContext`, al almacenamiento, a los workers, al
 * solver, a las herramientas ni a ningún mutador. Un proveedor produce **texto**
 * y ese texto entra al sistema como `unknown`. Todo lo que ocurre después
 * —esquema, allowlist, unidades, compilación, diff, confirmación— ocurre en
 * local sobre un clon, y sólo un `ProjectCommand` ya validado llega a
 * `executeProjectCommand`.
 *
 * ## Las tres respuestas posibles
 *
 * `ready` propone **una** operación cerrada. `needs-clarification` pregunta.
 * `rejected` se niega. No hay una cuarta forma de contestar, y ninguna de las
 * tres puede traer geometría, ni IDs inventados, ni un comando arbitrario.
 */

/** Cantidad con unidad explícita. Un número sin unidad no es una cantidad. */
export interface ProposalQuantityValue {
  value: number;
  unit: string;
}

/**
 * Allowlist de operaciones de la versión 1.
 *
 * Deliberadamente corta y toda ella **no destructiva**: cambiar propiedades de
 * una barra y aplicarle un material o una sección del catálogo. Crear y borrar
 * no están, no porque el mecanismo no lo soportaría —lleva diff y confirmación
 * exacta— sino porque una allowlist se empieza por lo que se puede deshacer
 * mirando un número, y se amplía con evidencia de uso, no antes.
 */
export type ProposedOperation =
  | {
    kind: 'member.update';
    memberId: string;
    changes: {
      E?: ProposalQuantityValue;
      A?: ProposalQuantityValue;
      I?: ProposalQuantityValue;
      density?: ProposalQuantityValue;
      label?: string;
    };
  }
  | { kind: 'member.section.apply'; memberId: string; sectionId: string }
  | { kind: 'member.material.apply'; memberId: string; materialId: string };

export const PROPOSED_OPERATION_KINDS = [
  'member.update',
  'member.section.apply',
  'member.material.apply',
] as const;

interface ProposalBase {
  version: 1;
  proposalId: string;
  /** Huella exacta del proyecto sobre el que se razonó. */
  snapshotHash: string;
  summary: string;
}

export type CommandProposalV1 =
  | (ProposalBase & { status: 'ready'; operation: ProposedOperation })
  | (ProposalBase & { status: 'needs-clarification'; question: string })
  | (ProposalBase & { status: 'rejected'; reason: string });

/** Contexto mínimo que se le entrega a un proveedor. Redactado: sin nombres de proyecto ni rutas. */
export interface ProposalRequest {
  /** Lo que el usuario pidió, literal. */
  intent: string;
  snapshotHash: string;
  /** IDs de barras existentes: sin esto un proveedor sólo puede inventarlos. */
  memberIds: readonly string[];
  /** IDs de secciones y materiales del catálogo. */
  sectionIds: readonly string[];
  materialIds: readonly string[];
}

/**
 * Un proveedor devuelve `unknown` **a propósito**.
 *
 * Tipar su salida como `CommandProposalV1` sería afirmar en el sistema de tipos
 * algo que sólo se puede comprobar en tiempo de ejecución, y TypeScript se
 * borra al compilar: la garantía desaparecería justo donde hace falta. Lo que
 * cruza esta frontera es texto de fuera hasta que el validador diga otra cosa.
 */
export interface ProposalProvider {
  readonly id: string;
  propose(request: ProposalRequest): Promise<unknown>;
}
