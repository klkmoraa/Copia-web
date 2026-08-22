import {
  applyProjectPatch,
  compileProjectCommand,
  projectCommandSnapshot,
  type ProjectCommand,
  type ProjectCommandResult,
  type ProjectPatch,
} from './projectCommand';
import {
  createStructureGenerationGhost,
  type StructureGenerationGhost,
} from '../data/generators/generatorGhost';
import {
  placeGeneratedStructure,
  type PlacementWarning,
} from '../data/generators/generatorPlacement';
import type {
  GeneratedStructureSummary,
  GeneratorKind,
  GeneratorParams,
  GeneratorWarning,
} from '../data/generators/generatorTypes';
import { generateStructure } from '../data/generators/structureGenerators';
import { validateStructuralEditBoundary } from '../data/structuralEditing';
import type { ProjectModel } from '../types';

/**
 * Preparación y confirmación de una generación de estructura (CRI-38, fase 2).
 *
 * Es el mismo contrato que ya usan la edición estructural y la reparación
 * topológica, aplicado a los generadores: preparar calcula la operación entera
 * sobre una copia y no toca nada; el objeto preparado congela el estado exacto
 * sobre el que se preparó y el resultado exacto que se mostró; confirmar
 * reconstruye la operación autoritativa y sólo publica si coincide, en un solo
 * lote y por tanto en un solo undo.
 *
 * Cancelar es, literalmente, no llamar a la confirmación: preparar no muta el
 * proyecto, no reserva identidad y no deja rastro. El ghost que se dibuja
 * mientras el usuario ajusta parámetros no es un `ProjectModel` y no puede
 * persistirse.
 *
 * Lo confirmado deja de ser «generador»: nodos y miembros normales, sin marca de
 * procedencia ni asociación paramétrica que los ate a estos parámetros.
 */

export interface PreparedStructureGeneration {
  readonly kind: GeneratorKind;
  readonly description: string;
  readonly params: GeneratorParams;
  readonly command: Extract<ProjectCommand, { kind: 'structure.generate' }>;
  readonly forward: ProjectPatch;
  readonly inverse: ProjectPatch;
  readonly result: Extract<ProjectCommandResult, { kind: 'structure.generate' }>;
  /** Proyecto completo tal como quedaría; se muestra, no se guarda. */
  readonly previewProject: ProjectModel;
  /** Geometría del preview, sin IDs y sin forma de proyecto. */
  readonly ghost: StructureGenerationGhost;
  /** Resumen exacto de lo que se crearía; ninguna cifra es estimada. */
  readonly summary: GeneratedStructureSummary;
  /** Avisos del núcleo más los que sólo existen al insertar en un proyecto real. */
  readonly warnings: readonly (GeneratorWarning | PlacementWarning)[];
  readonly createdNodeIds: readonly string[];
  readonly createdMemberIds: readonly string[];
  /** Precondición exacta que rechaza un preview obsoleto. */
  readonly sourceSnapshot: string;
  /** Resultado exacto que mostró el preview. */
  readonly previewSnapshot: string;
  /** Geometría exacta que se confirmaría, aislada del resto del proyecto. */
  readonly generatedSnapshot: string;
}

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
};

/** «Viga continua» → «Generar viga continua»; ninguna familia empieza por nombre propio. */
const historyDescription = (family: string): string =>
  `Generar ${family.charAt(0).toLocaleLowerCase('es-MX')}${family.slice(1)}`;

export const prepareStructureGeneration = (
  project: ProjectModel,
  params: GeneratorParams,
  description?: string,
): PreparedStructureGeneration => {
  validateStructuralEditBoundary(project);
  const structure = generateStructure(params);
  const placed = placeGeneratedStructure(project, structure);

  const command: Extract<ProjectCommand, { kind: 'structure.generate' }> = {
    kind: 'structure.generate',
    description: description ?? historyDescription(structure.description),
    params: structuredClone(params),
    sourceSnapshot: projectCommandSnapshot(project),
    generatedSnapshot: projectCommandSnapshot({ nodes: placed.nodes, members: placed.members }),
  };

  const compiled = compileProjectCommand(project, command);
  if (compiled.result?.kind !== 'structure.generate') {
    throw new Error('La generación preparada no produjo el resultado esperado.');
  }
  const previewProject = applyProjectPatch(project, compiled.forward);

  return deepFreeze<PreparedStructureGeneration>({
    kind: structure.kind,
    description: command.description,
    params: structuredClone(params),
    command,
    forward: compiled.forward,
    inverse: compiled.inverse,
    result: compiled.result,
    previewProject,
    ghost: createStructureGenerationGhost(params),
    summary: structuredClone(structure.summary),
    warnings: [...structure.warnings, ...placed.warnings].map((warning) => ({ ...warning })),
    createdNodeIds: compiled.result.nodeIds,
    createdMemberIds: compiled.result.memberIds,
    sourceSnapshot: command.sourceSnapshot,
    previewSnapshot: projectCommandSnapshot(previewProject),
    generatedSnapshot: command.generatedSnapshot,
  });
};

/**
 * Publica exactamente la generación que el usuario revisó.
 *
 * No confía en los parches que trae el objeto preparado: reconstruye la
 * operación autoritativa sobre el proyecto actual y sólo aplica si coincide
 * parche a parche. Así, un preview manipulado no puede convertirse en un canal
 * para escribir geometría arbitraria.
 */
export const applyPreparedStructureGeneration = (
  current: ProjectModel,
  prepared: PreparedStructureGeneration,
): ProjectModel => {
  if (projectCommandSnapshot(current) !== prepared.sourceSnapshot) {
    throw new Error('La vista previa de generación quedó obsoleta porque el proyecto cambió. Vuelve a prepararla.');
  }
  if (projectCommandSnapshot(prepared.previewProject) !== prepared.previewSnapshot
    || prepared.command.sourceSnapshot !== prepared.sourceSnapshot
    || prepared.command.generatedSnapshot !== prepared.generatedSnapshot) {
    throw new Error('La vista previa de generación fue alterada y no puede aplicarse.');
  }

  const trusted = compileProjectCommand(current, prepared.command);
  if (projectCommandSnapshot(trusted.forward) !== projectCommandSnapshot(prepared.forward)
    || projectCommandSnapshot(trusted.inverse) !== projectCommandSnapshot(prepared.inverse)
    || projectCommandSnapshot(trusted.result) !== projectCommandSnapshot(prepared.result)) {
    throw new Error('La generación preparada no coincide con la operación autoritativa.');
  }

  const applied = applyProjectPatch(current, trusted.forward);
  if (projectCommandSnapshot(applied) !== prepared.previewSnapshot) {
    throw new Error('El resultado aplicado no coincide con la vista previa de generación.');
  }
  validateStructuralEditBoundary(applied);
  return applied;
};
