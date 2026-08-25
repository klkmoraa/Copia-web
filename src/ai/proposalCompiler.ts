/**
 * Compilación de una propuesta validada: del contrato al comando, pasando por
 * un clon y terminando en un diff que el usuario puede leer.
 *
 * ```text
 * propuesta validada
 *  → huella del proyecto actual comprobada
 *  → identidades resueltas contra el modelo y el catálogo
 *  → unidades convertidas a base
 *  → compilación sobre un CLON
 *  → diff semántico
 *  → (el usuario mira)
 *  → confirmación ligada a proposalId + snapshotHash
 *  → ProjectCommand
 * ```
 *
 * ## Por qué sobre un clon
 *
 * Porque preparar no puede ser aplicar. Entre que se calcula el diff y que el
 * usuario lo acepta pasa tiempo, y en ese tiempo el proyecto puede cambiar. Un
 * compilador que tocara el proyecto real dejaría el modelo modificado por una
 * propuesta que nadie llegó a aceptar.
 *
 * ## Por qué la confirmación repite la huella
 *
 * `snapshotHash` se comprueba dos veces: al preparar y al confirmar. La segunda
 * no es redundante — es la única que importa. Si el modelo cambió mientras el
 * usuario leía el diff, ese diff describe un estado que ya no existe, y
 * aplicarlo escribiría cambios calculados sobre otra cosa.
 */
import type { MemberModel, ProjectModel } from '../types';
import { standardMaterials } from '../data/standardMaterials';
import { standardSections } from '../data/standardSections';
import { diffProjects, type ProjectDiff } from '../data/projectDiff';
import { applyProjectPatch, compileProjectCommand, type ProjectCommand } from '../commands/projectCommand';
import { ProposalUnitError, toBaseUnits } from './proposalUnits';
import type { CommandProposalV1, ProposedOperation } from './commandProposal';
import { translatePhase2, type Phase2TranslationKey } from '../i18n/phase2Catalogs';

export interface PreparedProposal {
  proposalId: string;
  snapshotHash: string;
  summary: string;
  command: ProjectCommand;
  /** Lo que la propuesta haría, calculado sobre un clon. */
  diff: ProjectDiff;
}

export interface PreparationRejected {
  ok: false;
  /** `stale` distingue «el modelo cambió» de «la propuesta no vale». */
  code: 'stale-snapshot' | 'unknown-id' | 'bad-units' | 'no-effect' | 'not-ready';
  reason: string;
  /** Clave de catálogo del mensaje, para que la UI lo traduzca al idioma activo. */
  key: Phase2TranslationKey;
  params?: Record<string, string | number>;
}
export type PreparationOutcome = { ok: true; prepared: PreparedProposal } | PreparationRejected;

const reject = (
  code: PreparationRejected['code'],
  key: Phase2TranslationKey,
  params?: Record<string, string | number>,
): PreparationRejected => ({ ok: false, code, reason: translatePhase2('es', key, params), key, params });

const clone = (project: ProjectModel): ProjectModel => JSON.parse(JSON.stringify(project)) as ProjectModel;

/** Traduce la operación de la allowlist a un `ProjectCommand`, o dice por qué no puede. */
const toCommand = (project: ProjectModel, operation: ProposedOperation): ProjectCommand | PreparationRejected => {
  const member = project.members.find((candidate) => candidate.id === operation.memberId);
  if (!member) return reject('unknown-id', 'proposal.error.unknownMember', { memberId: operation.memberId });

  if (operation.kind === 'member.section.apply') {
    const section = standardSections.find((candidate) => candidate.id === operation.sectionId);
    if (!section) return reject('unknown-id', 'proposal.error.unknownSection', { sectionId: operation.sectionId });
    return {
      description: `Aplicar la sección ${section.name} a ${member.id}`,
      kind: 'member.section.apply',
      memberId: member.id,
      sectionId: section.id,
      // Las propiedades numéricas salen del catálogo local, nunca de la
      // propuesta: una identidad de catálogo no puede traer sus propios números.
      properties: { A: section.area, I: section.inertiaX },
    };
  }

  if (operation.kind === 'member.material.apply') {
    const material = standardMaterials.find((candidate) => candidate.id === operation.materialId);
    if (!material) return reject('unknown-id', 'proposal.error.unknownMaterial', { materialId: operation.materialId });
    return {
      description: `Aplicar el material ${material.name} a ${member.id}`,
      kind: 'member.material.apply',
      memberId: member.id,
      materialId: material.id,
      properties: { E: material.elasticModulus, G: material.shearModulus, density: material.density },
    };
  }

  const changes: Partial<Omit<MemberModel, 'id'>> = {};
  try {
    if (operation.changes.E) changes.E = toBaseUnits(operation.changes.E, 'elasticModulus');
    if (operation.changes.A) changes.A = toBaseUnits(operation.changes.A, 'area');
    if (operation.changes.I) changes.I = toBaseUnits(operation.changes.I, 'inertia');
    if (operation.changes.density) changes.density = toBaseUnits(operation.changes.density, 'density');
  } catch (error) {
    if (error instanceof ProposalUnitError) return reject('bad-units', error.key, error.params);
    throw error;
  }
  if (operation.changes.label !== undefined) changes.label = operation.changes.label;

  // Escribir un número no positivo donde el solver espera una rigidez no es un
  // cambio: es un modelo roto que además pasaría el esquema.
  for (const [field, value] of Object.entries(changes)) {
    if (typeof value === 'number' && !(value > 0)) {
      return reject('bad-units', 'proposal.error.notPositive', { field });
    }
  }

  return {
    description: `Actualizar ${Object.keys(changes).join(', ')} en ${member.id}`,
    kind: 'member.update',
    memberId: member.id,
    changes,
  };
};

/**
 * Prepara una propuesta contra el proyecto actual y su huella.
 *
 * `currentSnapshotHash` lo calcula el llamador con `projectChecksum`, que es
 * asíncrono; pedirlo ya calculado deja esta función pura y comprobable sin
 * Web Crypto.
 */
export const prepareProposal = (
  project: ProjectModel,
  currentSnapshotHash: string,
  proposal: CommandProposalV1,
): PreparationOutcome => {
  if (proposal.status !== 'ready') {
    return proposal.status === 'needs-clarification'
      ? reject('not-ready', 'proposal.error.needsClarification', { question: proposal.question })
      : reject('not-ready', 'proposal.error.selfRejected', { reason: proposal.reason });
  }
  if (proposal.snapshotHash !== currentSnapshotHash) {
    return reject('stale-snapshot', 'proposal.error.staleSnapshot');
  }

  const command = toCommand(project, proposal.operation);
  if ('ok' in command) return command;

  // Sobre un clon: preparar no es aplicar.
  const draft = clone(project);
  const compiled = compileProjectCommand(draft, command);
  const after = applyProjectPatch(draft, compiled.forward);
  const diff = diffProjects(project, after);
  if (diff.identical) {
    return reject('no-effect', 'proposal.error.noEffect');
  }

  return {
    ok: true,
    prepared: {
      proposalId: proposal.proposalId,
      snapshotHash: proposal.snapshotHash,
      summary: proposal.summary,
      command,
      diff,
    },
  };
};

export interface Confirmation {
  proposalId: string;
  snapshotHash: string;
}

export type ConfirmationOutcome =
  | { ok: true; command: ProjectCommand }
  | { ok: false; reason: string; key: Phase2TranslationKey; params?: Record<string, string | number> };

const rejectConfirmation = (key: Phase2TranslationKey): ConfirmationOutcome =>
  ({ ok: false, reason: translatePhase2('es', key), key });

/**
 * Devuelve el comando **sólo** si la confirmación nombra exactamente la
 * propuesta que se preparó y el estado sobre el que se preparó.
 *
 * `currentSnapshotHash` se vuelve a pasar porque entre la preparación y este
 * momento el usuario ha estado leyendo, y el modelo ha podido cambiar en otra
 * pestaña. Confirmar contra un estado distinto aplicaría un diff que describe
 * otra cosa.
 */
export const confirmProposal = (
  prepared: PreparedProposal,
  confirmation: Confirmation,
  currentSnapshotHash: string,
): ConfirmationOutcome => {
  if (confirmation.proposalId !== prepared.proposalId) {
    return rejectConfirmation('proposal.error.mismatchedProposal');
  }
  if (confirmation.snapshotHash !== prepared.snapshotHash) {
    return rejectConfirmation('proposal.error.mismatchedSnapshot');
  }
  if (currentSnapshotHash !== prepared.snapshotHash) {
    return rejectConfirmation('proposal.error.projectChanged');
  }
  return { ok: true, command: prepared.command };
};
