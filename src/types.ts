export type ThemeMode = 'light' | 'dark';
export type Tool =
  | 'select'
  | 'pan'
  | 'node'
  | 'member'
  | 'support'
  | 'pointLoad'
  | 'distributedLoad'
  | 'moment'
  | 'dimension'
  | 'cut'
  | 'split'
  | 'delete';

export type MemberType = 'frame' | 'truss' | 'rigid';
export type SupportType = 'none' | 'pin' | 'roller' | 'fixed' | 'custom';
export type LoadCoordinateSystem = 'global' | 'local';
export type LoadLengthBasis = 'real' | 'horizontal' | 'vertical';
export type UnitSystemId = 'kN-m' | 'N-mm' | 'kgf-m' | 'kip-ft';

export interface SpringDefinition {
  kx?: number;
  ky?: number;
  kr?: number;
  kNormal?: number;
  angleDeg?: number;
}

export interface SupportDefinition {
  type: SupportType;
  /** Direction of the restrained normal axis, measured CCW from global +X. */
  angleDeg?: number;
  restrainX?: boolean;
  restrainY?: boolean;
  restrainR?: boolean;
  spring?: SpringDefinition;
  /** Imposed support motion in global axes; roller displacement is measured along its restrained normal. */
  prescribed?: {
    ux?: number;
    uy?: number;
    rz?: number;
    normal?: number;
  };
}

export interface NodeModel {
  id: string;
  x: number; // m, internal base unit
  y: number; // m, internal base unit
  support: SupportDefinition;
  /** Releases the rotational connection of every frame end meeting at this node. */
  internalHinge?: boolean;
}

export interface MemberRelease {
  iMoment?: boolean;
  jMoment?: boolean;
}

/** Provenance of the material or section properties stored on a 2D member. */
export type MemberPropertyOrigin = 'catalog' | 'custom' | 'imported' | 'legacy';

export interface MemberModel {
  id: string;
  i: string;
  j: string;
  type: MemberType;
  /** Stable catalog identity. Numeric properties remain the solver inputs. */
  materialId?: string;
  materialOrigin?: MemberPropertyOrigin;
  /** Stable catalog identity. Numeric properties remain the solver inputs. */
  sectionId?: string;
  sectionOrigin?: MemberPropertyOrigin;
  E: number; // kN / m², internal base unit
  A: number; // m²
  I: number; // m⁴
  beamTheory?: 'euler-bernoulli' | 'timoshenko';
  G?: number; // kN / m²
  /** Effective shear area, including the shear-correction factor. */
  shearArea?: number; // m²
  density?: number; // kg/m³
  releases?: MemberRelease;
  /**
   * Restringe el signo de la fuerza axial que el miembro puede transmitir.
   *
   * Ausente o `'both'` es una barra ordinaria y **no cambia ningún resultado
   * existente**: el análisis lineal sigue siendo lineal. `'tension-only'` es un
   * cable o un tirante, que se afloja en cuanto se le pide compresión;
   * `'compression-only'` es un puntal o un contacto, que se separa en cuanto se
   * le pide tracción. Los resuelve `activeSet.ts` iterando qué barras están
   * activas, no el solver lineal.
   */
  axialBehavior?: 'both' | 'tension-only' | 'compression-only';
  /** Semi-rigid end connection stiffness. Undefined means rigid; zero is a release. */
  rotationalSpringI?: number; // kN·m/rad
  rotationalSpringJ?: number;
  /** Rigid end-zone lengths measured along local +x from nodes i and j. */
  rigidOffsetI?: number;
  rigidOffsetJ?: number;
  label?: string;
}

/** Load-case-dependent initial deformation of a member.
 *  Positive axial strain elongates the member. Positive curvature follows
 *  dtheta/dx > 0 in the local axes. A positive thermal gradient means
 *  temperature increases toward local +y and therefore contributes -alpha*g.
 */
export interface MemberInitialEffect {
  id: string;
  memberId: string;
  caseId: string;
  type: 'temperature' | 'initial-strain';
  alpha?: number; // 1/°C
  deltaT?: number; // °C
  gradient?: number; // °C/m along local +y
  axialStrain?: number; // dimensionless
  curvature?: number; // 1/m
}

export interface LoadCase {
  id: string;
  name: string;
  category: 'permanent' | 'variable' | 'accidental' | 'other';
  active: boolean;
  /** Multiplier applied to member self-weight within this load case. */
  selfWeightFactor?: number;
}

export interface LoadCombination {
  id: string;
  name: string;
  factors: Record<string, number>;
  source?: string;
  sourceUrl?: string;
  jurisdiction?: string;
  edition?: string;
  stateLimit?: 'service' | 'ultimate' | 'other';
  reviewedAt?: string;
}

export interface NodalLoad {
  id: string;
  nodeId: string;
  caseId: string;
  fx: number; // kN
  fy: number; // kN
  mz: number; // kN·m
}

export interface PrescribedDisplacement {
  id: string;
  nodeId: string;
  caseId: string;
  component: 'ux' | 'uy' | 'rz' | 'normal';
  value: number;
}

export interface MemberLoad {
  id: string;
  memberId: string;
  caseId: string;
  type: 'distributed' | 'point' | 'moment';
  coordinateSystem: LoadCoordinateSystem;
  lengthBasis: LoadLengthBasis;
  start: number; // normalized 0..1
  end: number; // normalized 0..1
  qxStart?: number; // force / chosen reference length
  qxEnd?: number;
  qyStart?: number;
  qyEnd?: number;
  px?: number; // kN
  py?: number; // kN
  moment?: number; // kN·m, positive CCW
  position?: number; // normalized 0..1
}

export interface ProjectSettings {
  units: UnitSystemId;
  language: 'es' | 'en';
  gridSize: number;
  snap: boolean;
  snapTargets?: {
    grid: boolean;
    nodes: boolean;
    midpoints: boolean;
    intersections: boolean;
    perpendicular: boolean;
  };
  selectionFilter?: {
    nodes: boolean;
    members: boolean;
    loads: boolean;
  };
  showGrid: boolean;
  showNodeLabels: boolean;
  showMemberLabels: boolean;
  showLocalAxes: boolean;
  showLoads: boolean;
  showDimensions: boolean;
  showResultValues: boolean;
  diagramScale: number;
  diagramScaleMode?: 'common' | 'individual';
  showResultOverlay?: boolean;
  deformedScale: number;
  diagramSide: 'positive' | 'negative';
  /** Classroom mode keeps advanced material/eigenstrain inputs out of the primary workflow. */
  calculationMode?: 'complete' | 'classroom';
  /** Second-order geometric-stiffness (P-Delta) analysis; absent/`'first-order'` keeps today's linear behavior. */
  analysisMode?: 'first-order' | 'p-delta';
  /**
   * Procedure the calculation report narrates. The results always come from the matrix
   * stiffness solver; a different method re-derives them the way a reader was taught to.
   * An exact method (Double Integration, Three Moments, Hardy Cross, Kani, Virtual Work,
   * Castigliano, Method of Sections, Method of Joints) is required to land on the same numbers;
   * a deliberately approximate one (Portal, Cantilever) is required to disclose the gap instead.
   */
  solutionMethod?: 'matrix-stiffness' | 'double-integration' | 'portal-method' | 'cantilever-method' | 'three-moment' | 'virtual-work' | 'castigliano-truss' | 'hardy-cross' | 'kani-frame' | 'method-of-sections' | 'method-of-joints';
  /** Overrides merged over `DEFAULT_PDELTA_CONFIG`; unset fields keep their default. */
  pDeltaConfig?: Partial<PDeltaConfig>;
}

export interface ProjectModel {
  schemaVersion: number;
  id: string;
  name: string;
  nodes: NodeModel[];
  members: MemberModel[];
  loadCases: LoadCase[];
  combinations: LoadCombination[];
  nodalLoads: NodalLoad[];
  prescribedDisplacements?: PrescribedDisplacement[];
  memberLoads: MemberLoad[];
  /** Optional for backwards-compatible in-memory fixtures; imports normalize it to an array. */
  memberInitialEffects?: MemberInitialEffect[];
  settings: ProjectSettings;
  educationalCase?: {
    kind: 'attributed-example' | 'original-practice';
    sourceTitle: string;
    sourceUrl?: string;
    chapter: string;
    note: string;
    expectedResults: string[];
    /** Machine-checkable expectations in internal base units. Legacy prose remains in expectedResults. */
    expectedAssertions?: EducationalAssertion[];
  };
}

export type EducationalAssertionTarget =
  | { kind: 'node-result'; nodeId: string; component: 'ux' | 'uy' | 'rz' | 'rx' | 'ry' | 'rm' }
  | { kind: 'member-extreme'; memberId: string; quantity: DiagramQuantity; extreme: 'maximum' | 'minimum' | 'absolute-maximum' }
  | { kind: 'member-end-force'; memberId: string; end: 'i' | 'j'; quantity: DiagramQuantity };

export interface EducationalAssertion {
  id: string;
  label: string;
  target: EducationalAssertionTarget;
  /** Expected value in the engine's internal base units (kN, m, kN·m or radians). */
  expected: number;
  /** Absolute and relative tolerances use |a-b| <= atol + rtol max(|a|, |b|). */
  atol?: number;
  rtol?: number;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  objectId?: string;
  objectKind?: 'node' | 'member' | 'nodalLoad' | 'memberLoad';
  suggestedFix?: string;
  suggestedTool?: Tool;
}

export interface NodeResult {
  nodeId: string;
  ux: number;
  uy: number;
  rz: number;
  rx: number;
  ry: number;
  rm: number;
  supportNormalReaction?: number;
  supportTangentialReaction?: number;
}

export interface DiagramPoint {
  x: number;
  axial: number;
  shear: number;
  moment: number;
  side?: 'left' | 'right' | 'continuous';
}

/** Polynomial coefficients are written in local coordinate ξ = x - x0. */
export interface DiagramSegment {
  x0: number;
  x1: number;
  axial: [number, number, number];
  shear: [number, number, number];
  moment: [number, number, number, number];
  distributedAxial: [number, number];
  distributedTransverse: [number, number];
}

export interface DiagramJump {
  x: number;
  axialDelta: number;
  shearDelta: number;
  momentDelta: number;
}

export type DiagramQuantity = 'axial' | 'shear' | 'moment';
export type CriticalKind = 'end' | 'zero' | 'maximum' | 'minimum' | 'jump';

export interface DiagramCriticalPoint {
  x: number;
  quantity: DiagramQuantity;
  value: number;
  kind: CriticalKind;
  side?: 'left' | 'right' | 'continuous';
}

export interface DeformationPoint {
  x: number;
  u: number;
  v: number;
  theta: number;
}

/** Polynomial coefficients use the local coordinate ξ = x - x0. */
export interface DeformationSegment {
  x0: number;
  x1: number;
  u: [number, number, number, number];
  theta: [number, number, number, number, number];
  v: [number, number, number, number, number, number];
}

export type ResponseQuantity = 'u' | 'v' | 'theta';

export interface DeformationCriticalPoint {
  x: number;
  quantity: ResponseQuantity;
  value: number;
  kind: 'end' | 'zero' | 'maximum' | 'minimum';
}

export interface MemberResult {
  memberId: string;
  length: number;
  totalLength?: number;
  startOffset?: number;
  endOffset?: number;
  localDisplacements: number[];
  localEndForces: number[];
  diagramSegments: DiagramSegment[];
  diagramJumps: DiagramJump[];
  criticalPoints: DiagramCriticalPoint[];
  diagram: DiagramPoint[];
  deformation: DeformationPoint[];
  deformationSegments: DeformationSegment[];
  deformationCriticalPoints: DeformationCriticalPoint[];
  maxAxial: number;
  minAxial: number;
  maxShear: number;
  minShear: number;
  maxMoment: number;
  minMoment: number;
  trussState?: 'tension' | 'compression' | 'zero';
  /** Dimensionless end-compatibility residual: max(|du|/L, |dv|/L, |dtheta|). */
  compatibilityError?: number;
  compatibilityComponents?: { du: number; dv: number; dtheta: number };
  /** Absolute N-V-M closure of the exact diagram against the element end forces. */
  endCompatibility?: { axial: number; shear: number; moment: number };
  /** Same closure normalized by this member's own diagram magnitudes. */
  endCompatibilityError?: number;
}

export interface ExplanationValue {
  label: string;
  value: number;
  unit: string;
}

export interface ExplanationStep {
  id: string;
  title: string;
  category: 'geometry' | 'loads' | 'equilibrium' | 'stiffness' | 'results' | 'verification';
  summary: string;
  equations: string[];
  inputs?: ExplanationValue[];
  outputs?: ExplanationValue[];
  relatedNodeIds?: string[];
  relatedMemberIds?: string[];
}

export interface GlobalResultant {
  fx: number;
  fy: number;
  mz: number;
}

export interface MemberLoadAudit {
  memberId: string;
  flexibleLength: {
    source: number;
    assembled: number;
    normalizedResidual: number;
  };
  mechanical: GeneralizedLoadComparison;
  initial: GeneralizedLoadComparison;
  /** Work-equivalent local nodal actions integrated directly from the source loads. */
  source: number[];
  /** Local nodal actions produced by the assembly route, before connection condensation. */
  assembled: number[];
  difference: number[];
  normalizedResidual: number;
}

export interface GeneralizedLoadComparison {
  source: number[];
  assembled: number[];
  difference: number[];
  normalizedResidual: number;
}

/** Independent reconciliation between source actions and the assembled load vector. */
export interface LoadAudit {
  referenceNodeId?: string;
  referencePoint?: { x: number; y: number };
  source: GlobalResultant;
  assembled: GlobalResultant;
  difference: GlobalResultant;
  /** Dimensionless residual of each independent global resultant component. */
  normalizedDifference: GlobalResultant;
  resultantResidual: number;
  memberAudits: MemberLoadAudit[];
  /** Maximum of the global resultant audit and every member generalized-load audit. */
  normalizedResidual: number;
}

/**
 * How much of a finished analysis may be trusted. `failed` means there is no
 * usable result at all; `unreliable` means numbers exist but must never be
 * consumed as an ordinary result.
 */
export type ReliabilityLevel = 'reliable' | 'limited' | 'unreliable' | 'failed';

export type ReliabilityCheckId =
  | 'condition'
  | 'backward-error'
  | 'forward-error'
  | 'refinement'
  | 'structural-residual'
  | 'constraints'
  | 'equilibrium'
  | 'load-audit'
  | 'diagram-closure'
  | 'compatibility'
  | 'p-delta-convergence';

export interface ReliabilityCheck {
  id: ReliabilityCheckId;
  label: string;
  value: number;
  /** Value above which the check stops being `reliable`. */
  limitedAbove: number;
  /** Value above which the check becomes `unreliable`. */
  unreliableAbove: number;
  level: ReliabilityLevel;
  message: string;
}

export interface ResultReliability {
  /** The numeric solution ran to the end without aborting. */
  completed: boolean;
  /** The run produced nodal results that can be read at all. */
  usable: boolean;
  level: ReliabilityLevel;
  checks: ReliabilityCheck[];
  /** Worst check; absent only when every check is `reliable`. */
  governing?: ReliabilityCheck;
  /** Causes ordered from worst to mildest. */
  reasons: string[];
}

/** Public presentation state for numerical quality; it is not a safety rating. */
export type NumericQualityState = 'stable' | 'limited' | 'unreliable' | 'failed' | 'unavailable';

/** Backend policy for one complete analysis run. `auto` retains the hybrid solver gates. */
export type LinearSolverPolicy = 'auto' | 'dense';
export type LinearSolverBackend = 'dense-lu' | 'sparse-ldlt';
export type LinearSolverFallbackReason =
  | 'forced-dense'
  | 'below-size-threshold'
  | 'constraints-not-reducible'
  | 'reduced-system-below-threshold'
  | 'excessive-fill'
  | 'non-positive-pivot';

/** Additive trace of the actual linear backend used; never changes structural values. */
export interface LinearSolverDiagnostics {
  policy: LinearSolverPolicy;
  backend: LinearSolverBackend;
  fallbackReason?: LinearSolverFallbackReason;
  dimension: number;
  reducedDimension?: number;
}

/** Advanced load-stepping/iteration limits for the P-Delta solver; every field has a project-independent default. */
export interface PDeltaConfig {
  maxLoadSteps: number;
  maxIterationsPerStep: number;
  equilibriumTolerance: number;
  displacementTolerance: number;
  stepReductionFactor: number;
  /** Fraction of the total load; a step smaller than this aborts the run instead of subdividing further. */
  minimumStep: number;
}

export interface PDeltaStepIteration {
  step: number;
  iteration: number;
  /** Load fraction (0-1] this step targets. */
  lambda: number;
  /** Relative change in member axial forces since the previous iteration. */
  residual: number;
  /** Relative change in the global displacement vector since the previous iteration. */
  displacementIncrement: number;
  /** Normalized physical equilibrium residual of this iterate; independent of the two increment measures. */
  equilibriumResidual: number;
  conditionEstimate: number;
}

export interface PDeltaDiagnostics {
  enabled: true;
  /** P-Delta remains an opt-in, bounded experimental capability. */
  experimental: true;
  converged: boolean;
  loadStepsUsed: number;
  totalIterations: number;
  initialResidual: number;
  finalResidual: number;
  finalDisplacementIncrement: number;
  /** Final relative change in member axial forces (same quantity as `finalResidual`, named for what it measures). */
  finalAxialChange: number;
  /** Final normalized physical equilibrium residual — an independent check, not an increment measure. */
  finalEquilibriumResidual: number;
  /**
   * Estimated elastic critical load factor for THIS load pattern: the multiple
   * of the applied loads at which the tangent stiffness stops being positive
   * definite along the loading direction. Found by bisection on the axial-force
   * scale, so it is a computed estimate bounded by the model's discretisation
   * — not a full eigenvalue extraction. Absent when it could not be bracketed.
   */
  criticalLoadFactor?: number;
  convergenceReason: string;
  failureReason?: string;
  stabilityWarning?: string;
  /** Ratio of a global displacement measure against the equivalent first-order run; absent when that baseline is ~zero. */
  amplificationFactor?: number;
  /** Compact per-iteration trail; not every iteration ever attempted, see `totalIterations` for the true count. */
  history: PDeltaStepIteration[];
  /** Axial force (tension positive) used to build each frame member's geometric stiffness at convergence. */
  memberAxialForces: Record<string, number>;
}

export interface AnalysisResult {
  success: boolean;
  issues: ValidationIssue[];
  nodeResults: NodeResult[];
  memberResults: MemberResult[];
  displacements: number[];
  residualNorm: number;
  constraintResidual?: number;
  /** Relative backward error of the equilibrated constrained linear system. */
  linearResidual?: number;
  refinementIterations?: number;
  /** Hager estimate of kappa_1 for the symmetrically equilibrated system. */
  conditionEstimate: number;
  forwardErrorBound?: number;
  reliableDigits?: number;
  /** Backend used for this run; absent only on failed or legacy/external results. */
  linearSolver?: LinearSolverDiagnostics;
  mechanism?: {
    nullity: number;
    residual: number;
    nodes: Array<{
      nodeId: string;
      ux: number;
      uy: number;
      rz: number;
      normalizedAmplitude: number;
      dominantDof: 'Ux' | 'Uy' | 'Rz';
    }>;
  };
  equilibrium: {
    sumFx: number;
    sumFy: number;
    sumM: number;
    referenceNodeId?: string;
    referencePoint?: { x: number; y: number };
    normalizedComponents: GlobalResultant;
    normalizedResidual: number;
  };
  loadAudit?: LoadAudit;
  educationTrace?: EducationTrace;
  /** Populated by `analyzeProject`; derive it with `resolveReliability` elsewhere. */
  reliability?: ResultReliability;
  explanation: ExplanationStep[];
  /** Present only when `analyzeProjectPDelta` produced this result; absent on every first-order run. */
  pDelta?: PDeltaDiagnostics;
  /** Presente sólo cuando el modelo tiene barras de signo restringido; ausente en cualquier otro caso. */
  activeSet?: ActiveSetDiagnostics;
}

/** Cómo terminó la iteración de conjunto activo de las barras de signo restringido. */
export interface ActiveSetDiagnostics {
  converged: boolean;
  /** Iteraciones completas —una resolución lineal cada una— hasta estabilizar el conjunto. */
  iterations: number;
  /** Miembros de signo restringido que quedaron trabajando. */
  activeMemberIds: string[];
  /** Miembros de signo restringido que quedaron descolgados del modelo. */
  inactiveMemberIds: string[];
  /** Motivo de la parada, convergida o no. */
  reason: string;
  /** `true` cuando la iteración volvió a un conjunto ya visitado en vez de estabilizarse. */
  cycled: boolean;
}

export interface MatrixTrace {
  rows: number;
  columns: number;
  rowLabels: string[];
  columnLabels: string[];
  /** Sparse entries preserve exact values while avoiding a second dense copy for mostly-zero matrices. */
  entries: Array<{ row: number; column: number; value: number }>;
}

export interface DofTrace {
  index: number;
  nodeId: string;
  component: 'ux' | 'uy' | 'rz';
  label: string;
  displacement: number;
  appliedLoad: number;
  reaction: number;
  residual: number;
  constrained: boolean;
  prescribedValue?: number;
}

export interface ElementTrace {
  memberId: string;
  dofIndices: number[];
  dofLabels: string[];
  length: number;
  grossLength: number;
  c: number;
  s: number;
  releasedLocalDofs: number[];
  transformation: MatrixTrace;
  localStiffnessOriginal: MatrixTrace;
  localStiffnessEffective: MatrixTrace;
  globalStiffnessContribution: MatrixTrace;
  localEquivalentLoadOriginal: number[];
  localEquivalentLoadEffective: number[];
  globalEquivalentLoadContribution: number[];
  globalDisplacements: number[];
  localDisplacements: number[];
  localEndForces: number[];
}

export interface EducationTrace {
  schemaVersion: 1;
  formulation: 'linear-static-euler-bernoulli' | 'linear-static-mixed-beam';
  dofs: DofTrace[];
  elements: ElementTrace[];
  assembly: {
    stiffness: MatrixTrace;
    load: number[];
    constraintMatrix: MatrixTrace;
    constraintValues: number[];
    diagonalScale: number[];
    matrixDetail: 'full' | 'summary';
    strainEnergy: number;
  };
}

export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'member'; id: string }
  | { kind: 'multi'; nodeIds: string[]; memberIds: string[] }
  | { kind: 'nodalLoad'; id: string }
  | { kind: 'memberLoad'; id: string }
  | null;
