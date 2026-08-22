import { generateStructure } from './structureGenerators';
import type {
  GeneratedMemberRole,
  GeneratedNodeRole,
  GeneratedStructureSummary,
  GeneratorKind,
  GeneratorParams,
  GeneratorWarning,
} from './generatorTypes';

/**
 * Ghost de generación: la geometría que se vería, nunca la que se guardaría.
 *
 * Es deliberadamente **no** un `ProjectModel` y deliberadamente **no** lleva IDs
 * de entidad, igual que el ghost de la edición estructural: sus claves no son
 * IDs de nodo ni de miembro, así que ninguna ruta de guardado, análisis o
 * historial puede confundirlo con estado confirmado. Vive sólo mientras el
 * usuario ajusta parámetros.
 *
 * Se deriva de los parámetros, no del proyecto: dibujar el preview no reserva
 * identidad, no clona el modelo y no deja rastro. La identidad real se reparte
 * una sola vez, al confirmar.
 */

export interface StructureGenerationGhostNode {
  /** Clave local del preview; nunca es el ID que tendría el nodo confirmado. */
  readonly key: string;
  readonly role: GeneratedNodeRole;
  readonly x: number;
  readonly y: number;
  /** Si este nudo recibiría el apoyo que el usuario eligió explícitamente. */
  readonly supported: boolean;
}

export interface StructureGenerationGhostMember {
  readonly key: string;
  readonly role: GeneratedMemberRole;
  readonly iKey: string;
  readonly jKey: string;
}

export interface StructureGenerationGhost {
  readonly kind: GeneratorKind;
  readonly description: string;
  readonly nodes: readonly StructureGenerationGhostNode[];
  readonly members: readonly StructureGenerationGhostMember[];
  /** Resumen exacto de lo que se crearía; ninguna cifra es estimada. */
  readonly summary: GeneratedStructureSummary;
  readonly warnings: readonly GeneratorWarning[];
}

const GHOST_KEY_PREFIX = 'structure-generation-ghost';

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
};

export const createStructureGenerationGhost = (params: GeneratorParams): StructureGenerationGhost => {
  const structure = generateStructure(params);
  const supported = new Set(structure.supportedNodeIds);
  const keyOf = (localId: string) => `${GHOST_KEY_PREFIX}-${localId}`;

  return deepFreeze<StructureGenerationGhost>({
    kind: structure.kind,
    description: structure.description,
    nodes: structure.nodes.map((node) => ({
      key: keyOf(node.id),
      role: structure.nodeRoles[node.id],
      x: node.x,
      y: node.y,
      supported: supported.has(node.id),
    })),
    members: structure.members.map((member) => ({
      key: keyOf(member.id),
      role: structure.memberRoles[member.id],
      iKey: keyOf(member.i),
      jKey: keyOf(member.j),
    })),
    summary: structuredClone(structure.summary),
    warnings: structure.warnings.map((warning) => ({ ...warning })),
  });
};
