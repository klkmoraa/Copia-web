/**
 * Space 3D · Contratos inmutables del dominio espacial (S3D-1).
 *
 * Este módulo es la única fuente de verdad de los tipos 3D y no comparte
 * estructuras con el dominio 2D: `src/types.ts` sólo aporta `UnitSystemId`
 * para que ambos productos hablen del mismo sistema de unidades.
 *
 * Convenciones fijas de S3D-1 — no reinterpretarlas fuera de este archivo:
 *
 *   · Ejes globales: X y Z horizontales, **Y vertical hacia arriba**. Es la
 *     misma convención que el editor 2D (plano XY con Y arriba), de modo que
 *     un modelo plano es un caso particular de uno espacial con z = 0.
 *   · Orden de GDL nodales: `[ux, uy, uz, rx, ry, rz]`.
 *   · Orden de GDL del elemento: los seis del nudo `i` y luego los seis de `j`.
 *   · Unidades internas: `m`, `kN`, `kN·m`, `kN/m²`, `m²`, `m⁴`, `rad`.
 *   · Ejes locales: `x` del nudo `i` al `j`; `y` es la referencia global
 *     proyectada perpendicular a `x` y girada por `rollRadians`; `z = x × y`.
 *   · Inercias: `Iz` gobierna la flexión en el plano `x–y` (desplazamiento
 *     local `v`, giro `rz`) y `Iy` la del plano `x–z` (`w`, `ry`).
 */
import type { UnitSystemId } from '../../types';

export const SPACE3D_SCHEMA_VERSION = 1 as const;
export const SPACE3D_ANALYSIS_SPACE = 'space-3d' as const;

/**
 * Límites duros aplicados antes de reservar cualquier matriz. Un modelo de 150
 * nudos son 900 GDL, es decir una densa de 900×900: el techo existe para que un
 * archivo corrupto no intente asignar gigabytes.
 */
export const SPACE3D_LIMITS = Object.freeze({
  maxNodes: 150,
  maxMembers: 300,
  maxCoordinateMagnitude: 1e9,
  minMemberLength: 1e-9,
  minReferenceNorm: 1e-12,
  minPerpendicularRatio: 1e-8,
});

export type Space3DVector = readonly [number, number, number];

export interface Space3DRestraints {
  readonly ux: boolean;
  readonly uy: boolean;
  readonly uz: boolean;
  readonly rx: boolean;
  readonly ry: boolean;
  readonly rz: boolean;
}

export const SPACE3D_DOF_KEYS = Object.freeze(['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const);
export type Space3DDofKey = (typeof SPACE3D_DOF_KEYS)[number];

export interface Space3DNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly restraints: Space3DRestraints;
}

export interface Space3DMemberOrientation {
  /** Vector global que define el plano `x–y` local antes de aplicar el roll. */
  readonly localYReferenceGlobal: Space3DVector;
  /** Giro de la triada alrededor del eje local `x`, en radianes. */
  readonly rollRadians: number;
}

export interface Space3DFrameMember {
  readonly id: string;
  readonly i: string;
  readonly j: string;
  /** Módulo de elasticidad, kN/m². */
  readonly E: number;
  /** Módulo de corte, kN/m². */
  readonly G: number;
  /** Área, m². */
  readonly A: number;
  /** Inercia respecto al eje local y, m⁴ (flexión en el plano x–z). */
  readonly Iy: number;
  /** Inercia respecto al eje local z, m⁴ (flexión en el plano x–y). */
  readonly Iz: number;
  /** Constante torsional de St. Venant, m⁴. */
  readonly J: number;
  readonly orientation: Space3DMemberOrientation;
}

export interface Space3DNodalLoad {
  readonly id: string;
  readonly caseId: string;
  readonly nodeId: string;
  /** Fuerzas globales, kN. */
  readonly fx: number;
  readonly fy: number;
  readonly fz: number;
  /** Momentos globales, kN·m. */
  readonly mx: number;
  readonly my: number;
  readonly mz: number;
}

export interface Space3DLoadCase {
  readonly id: string;
  readonly name: string;
}

export interface Space3DLoadCombinationTerm {
  readonly caseId: string;
  readonly factor: number;
}

export interface Space3DLoadCombination {
  readonly id: string;
  readonly name: string;
  readonly terms: readonly Space3DLoadCombinationTerm[];
}

export interface Space3DProjectV1 {
  readonly analysisSpace: typeof SPACE3D_ANALYSIS_SPACE;
  readonly schemaVersion: typeof SPACE3D_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly units: UnitSystemId;
  readonly nodes: readonly Space3DNode[];
  readonly members: readonly Space3DFrameMember[];
  readonly nodalLoads: readonly Space3DNodalLoad[];
  readonly loadCases: readonly Space3DLoadCase[];
  readonly loadCombinations: readonly Space3DLoadCombination[];
}

export type Space3DEntityKind = 'project' | 'node' | 'member' | 'load' | 'case' | 'combination';

export type Space3DValidationCode =
  | 'duplicate-id'
  | 'empty-id'
  | 'missing-reference'
  | 'self-referential-member'
  | 'invalid-coordinate'
  | 'invalid-property'
  | 'degenerate-length'
  | 'degenerate-orientation'
  | 'missing-case'
  | 'unknown-field'
  | 'limit-exceeded';

export interface Space3DValidationIssue {
  readonly code: Space3DValidationCode;
  readonly entityKind: Space3DEntityKind;
  readonly entityId: string;
  /** Campo concreto responsable, o cadena vacía cuando el problema es de entidad. */
  readonly field: string;
}

export type Space3DAnalysisIssueCode =
  | Space3DValidationCode
  | 'empty-model'
  | 'unknown-target'
  | 'no-free-dof'
  | 'mechanism'
  | 'non-finite-solution';

export interface Space3DAnalysisIssue {
  readonly code: Space3DAnalysisIssueCode;
  readonly entityKind: Space3DEntityKind;
  readonly entityId: string;
  readonly field: string;
}

export interface Space3DDofValues {
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
}

export interface Space3DNodeResult {
  readonly nodeId: string;
  /** Desplazamientos globales, m y rad. */
  readonly displacement: Space3DDofValues;
  /** Reacciones globales, kN y kN·m; cero en los GDL libres. */
  readonly reaction: Space3DDofValues;
}

/**
 * Acciones internas en un extremo, expresadas en ejes locales del miembro.
 * `N` es el axil, `T` el torsor, `Vy`/`Vz` los cortantes y `My`/`Mz` los
 * flectores alrededor de los ejes locales homónimos.
 */
export interface Space3DMemberEndForces {
  readonly N: number;
  readonly Vy: number;
  readonly Vz: number;
  readonly T: number;
  readonly My: number;
  readonly Mz: number;
}

export interface Space3DOrientationBasis {
  readonly x: Space3DVector;
  readonly y: Space3DVector;
  readonly z: Space3DVector;
}

export interface Space3DMemberResult {
  readonly memberId: string;
  readonly length: number;
  readonly basis: Space3DOrientationBasis;
  readonly start: Space3DMemberEndForces;
  readonly end: Space3DMemberEndForces;
}

export interface Space3DEquilibriumAudit {
  /** Σ de fuerzas aplicadas y reacciones, kN. */
  readonly force: Space3DVector;
  /** Σ de momentos respecto al origen global, kN·m. */
  readonly moment: Space3DVector;
  /** Residual normalizado por la mayor acción presente y por 1. */
  readonly normalized: number;
}

export interface Space3DAnalysisDiagnostics {
  readonly dofCount: number;
  readonly freeDofCount: number;
  readonly restrainedDofCount: number;
  /** Residual relativo del sistema lineal reducido. */
  readonly relativeResidual: number;
  readonly conditionEstimate: number;
  readonly equilibrium: Space3DEquilibriumAudit;
}

export interface Space3DAnalysisResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly targetKind: 'case' | 'combination' | 'unknown';
  readonly nodeResults: readonly Space3DNodeResult[];
  readonly memberResults: readonly Space3DMemberResult[];
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly diagnostics: Space3DAnalysisDiagnostics;
}

/** Error de geometría degenerada; su `message` es el código estable. */
export class Space3DGeometryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'Space3DGeometryError';
    this.code = code;
  }
}

export const fixedSpace3DRestraints = (): Space3DRestraints => ({
  ux: true, uy: true, uz: true, rx: true, ry: true, rz: true,
});

export const freeSpace3DRestraints = (): Space3DRestraints => ({
  ux: false, uy: false, uz: false, rx: false, ry: false, rz: false,
});

export const zeroSpace3DDofValues = (): Space3DDofValues => ({
  ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0,
});
