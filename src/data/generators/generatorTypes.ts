import type { MemberModel, MemberType, NodeModel, SupportDefinition } from '../../types';
import type { Point2D } from '../structuralEditing';
import type { GeneratorMemberProperties } from './generatorProperties';
import type { SpacingSpec } from './generatorSpacing';

/**
 * Contratos del núcleo determinista de generación 2D (CRI-38, fase 1).
 *
 * El núcleo es puro y no conoce React, comandos ni persistencia: recibe
 * parámetros y devuelve nodos, miembros y conectividad. Los mismos parámetros
 * producen siempre exactamente los mismos IDs, las mismas coordenadas y el mismo
 * orden. Ni cargas, ni apoyos no solicitados, ni asociaciones paramétricas.
 */

export type GeneratorKind =
  | 'continuous-beam'
  | 'portal-frame'
  | 'multi-story-frame'
  | 'truss'
  | 'grid';

/** Topologías de cercha de cordones paralelos, explícitas y verificables. */
export type TrussTopology = 'pratt' | 'warren' | 'howe';

/** Qué miembros crea una retícula estructural; los nodos siempre se crean. */
export type GridMemberMode = 'both' | 'horizontal' | 'vertical' | 'none';

export interface GeneratorCommonParams {
  /** Punto de inserción de la geometría. Por defecto, el origen del modelo. */
  readonly origin?: Point2D;
  /** Material y sección: identidad de catálogo o números explícitos. */
  readonly properties: GeneratorMemberProperties;
  /**
   * Apoyo aplicado a los nodos de apoyo de la familia. Ausente o `'none'`
   * significa modelo sin apoyos, que es el valor seguro por defecto.
   */
  readonly baseSupport?: SupportDefinition;
  /** Tipo de miembro; por defecto `'frame'`, salvo la cercha, que usa `'truss'`. */
  readonly memberType?: MemberType;
}

export type GeneratorParams =
  | (GeneratorCommonParams & { readonly kind: 'continuous-beam'; readonly spans: SpacingSpec })
  | (GeneratorCommonParams & { readonly kind: 'portal-frame'; readonly bays: SpacingSpec; readonly height: number })
  | (GeneratorCommonParams & { readonly kind: 'multi-story-frame'; readonly bays: SpacingSpec; readonly stories: SpacingSpec })
  | (GeneratorCommonParams & {
    readonly kind: 'truss';
    readonly topology: TrussTopology;
    readonly panels: SpacingSpec;
    readonly depth: number;
    /** Montantes intermedios de la Warren; Pratt y Howe los llevan siempre. */
    readonly includeVerticals?: boolean;
  })
  | (GeneratorCommonParams & {
    readonly kind: 'grid';
    readonly columns: SpacingSpec;
    readonly rows: SpacingSpec;
    readonly members?: GridMemberMode;
  });

export type GeneratedNodeRole = 'base' | 'joint' | 'top-chord' | 'bottom-chord' | 'grid';

export type GeneratedMemberRole =
  | 'beam'
  | 'column'
  | 'top-chord'
  | 'bottom-chord'
  | 'vertical'
  | 'diagonal'
  | 'grid-horizontal'
  | 'grid-vertical';

export type GeneratorWarningCode =
  | 'no-supports'
  | 'large-model'
  | 'non-uniform-truss-panels'
  | 'asymmetric-truss-diagonals'
  | 'isolated-nodes';

export interface GeneratorWarning {
  readonly code: GeneratorWarningCode;
  readonly message: string;
}

/** Resumen exacto de lo que se crearía; ninguna cifra es estimada. */
export interface GeneratedStructureSummary {
  readonly nodeCount: number;
  readonly memberCount: number;
  readonly supportedNodeCount: number;
  readonly memberCountsByRole: Readonly<Partial<Record<GeneratedMemberRole, number>>>;
  readonly totalMemberLength: number;
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  /** Propiedades realmente aplicadas a los miembros generados. */
  readonly properties: {
    readonly materialId?: string;
    readonly sectionId?: string;
    readonly E: number;
    readonly A: number;
    readonly I: number;
  };
}

/**
 * Resultado del núcleo. Nodos y miembros ya son contratos de `ProjectModel`; los
 * IDs son locales a la geometría generada (`N1…`, `M1…`) y la fase de
 * confirmación es la responsable de reubicarlos dentro de un proyecto real.
 */
export interface GeneratedStructure {
  readonly kind: GeneratorKind;
  readonly description: string;
  readonly nodes: readonly NodeModel[];
  readonly members: readonly MemberModel[];
  readonly nodeRoles: Readonly<Record<string, GeneratedNodeRole>>;
  readonly memberRoles: Readonly<Record<string, GeneratedMemberRole>>;
  /** Nodos que recibieron un apoyo real; vacío cuando el usuario no eligió ninguno. */
  readonly supportedNodeIds: readonly string[];
  readonly summary: GeneratedStructureSummary;
  readonly warnings: readonly GeneratorWarning[];
}
