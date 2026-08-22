import type {
  AnalysisResult,
  ElementTrace,
  EducationTrace,
  ExplanationStep,
  GlobalResultant,
  LoadAudit,
  LoadCombination,
  LinearSolverPolicy,
  MemberLoad,
  MemberModel,
  MemberResult,
  MatrixTrace,
  NodeModel,
  NodeResult,
  ProjectModel,
  ValidationIssue,
} from '../types';
import { memberInteriorRatioAtPoint, nodeHasStructuralActivity } from '../data/modelOperations';
import { abortedAnalysis } from './analysisFailure';
import {
  buildDeformationCurve,
  buildExactDiagrams,
  type LocalMemberLoad,
} from './diagram';
import { compareGeneralizedLoads, integrateIndependentMemberSourceLoads } from './loadAudit';
import { profileEnd, profileStart } from './performanceProfiler';
import { classifyAnalysisReliability } from './reliability';
import {
  addToMatrix,
  addToVector,
  findNullSpaceVector,
  maxAbs,
  multiply,
  multiplyMatrixVector,
  solveLinearSystem,
  submatrix,
  subvector,
  transpose,
  zeros,
  type Matrix,
} from './math';

export interface Geometry {
  L: number;
  c: number;
  s: number;
  dx: number;
  dy: number;
}

interface ElementAssembly {
  member: MemberModel;
  geometry: Geometry;
  grossLength: number;
  startOffset: number;
  endOffset: number;
  indices: number[];
  transform: Matrix;
  localStiffnessOriginal: Matrix;
  localStiffnessEffective: Matrix;
  mechanicalEquivalentLoad: number[];
  initialEquivalentLoad: number[];
  localLoadOriginal: number[];
  localLoadEffective: number[];
  loads: LocalMemberLoad[];
  released: number[];
  initialAxialStrain: number;
  initialCurvature: number;
  globalStiffness: Matrix;
  globalLoad: number[];
  connectionRecovery?: NonNullable<CondensationResult['recovery']>;
}

const EPS = 1e-12;
const GAUSS_POINTS = [
  { x: -0.906179845938664, w: 0.236926885056189 },
  { x: -0.538469310105683, w: 0.478628670499366 },
  { x: 0, w: 0.568888888888889 },
  { x: 0.538469310105683, w: 0.478628670499366 },
  { x: 0.906179845938664, w: 0.236926885056189 },
];

const evaluatePolynomial = (coefficients: readonly number[], x: number): number => {
  let value = 0;
  for (let index = coefficients.length - 1; index >= 0; index -= 1) value = value * x + coefficients[index];
  return value;
};

/** Five-point Gauss integration is exact for the square of every N/V/M
 * polynomial used by the diagram engine (maximum degree six).
 */
const integratePolynomialSquare = (coefficients: readonly number[], length: number): number => {
  if (!(length > 0)) return 0;
  const jacobian = length / 2;
  return GAUSS_POINTS.reduce((sum, point) => {
    const x = (point.x + 1) * jacobian;
    const value = evaluatePolynomial(coefficients, x);
    return sum + point.w * jacobian * value * value;
  }, 0);
};

const getNodeMap = (project: ProjectModel): Map<string, NodeModel> =>
  new Map(project.nodes.map((node) => [node.id, node]));

const frameEndTransfersRotation = (member: MemberModel, nodeId: string): boolean => {
  if (member.type !== 'frame') return false;
  const atI = member.i === nodeId;
  const atJ = member.j === nodeId;
  if (!atI && !atJ) return false;
  const explicitlyReleased = atI ? member.releases?.iMoment : member.releases?.jMoment;
  const connectionStiffness = atI ? member.rotationalSpringI : member.rotationalSpringJ;
  // Undefined is a rigid connection. A finite positive value is semi-rigid.
  // Zero is the documented release limit and must not activate the joint Rz DOF.
  return !explicitlyReleased && connectionStiffness !== 0;
};

const geometryOf = (member: MemberModel, nodes: Map<string, NodeModel>): Geometry => {
  const ni = nodes.get(member.i);
  const nj = nodes.get(member.j);
  if (!ni || !nj) throw new Error(`El miembro ${member.id} referencia nodos inexistentes.`);
  const dx = nj.x - ni.x;
  const dy = nj.y - ni.y;
  const L = Math.hypot(dx, dy);
  if (L <= EPS) throw new Error(`El miembro ${member.id} tiene longitud cero.`);
  return { L, c: dx / L, s: dy / L, dx, dy };
};

const deformableGeometryOf = (member: MemberModel, nodes: Map<string, NodeModel>): {
  geometry: Geometry;
  grossLength: number;
  startOffset: number;
  endOffset: number;
} => {
  const gross = geometryOf(member, nodes);
  const startOffset = member.rigidOffsetI ?? 0;
  const endOffset = member.rigidOffsetJ ?? 0;
  const L = gross.L - startOffset - endOffset;
  if (!(L > EPS)) throw new Error(`Las zonas rígidas del miembro ${member.id} consumen toda su longitud.`);
  return {
    geometry: { ...gross, L },
    grossLength: gross.L,
    startOffset,
    endOffset,
  };
};

export const frameLocalStiffness = (member: MemberModel, L: number): Matrix => {
  const EA = member.E * member.A;
  const EI = member.E * member.I;
  const shearRigidity = member.beamTheory === 'timoshenko' ? (member.G ?? 0) * (member.shearArea ?? 0) : Number.POSITIVE_INFINITY;
  const phi = Number.isFinite(shearRigidity) && shearRigidity > 0 ? 12 * EI / (shearRigidity * L ** 2) : 0;
  const a = EA / L;
  const b = (12 * EI) / (L ** 3 * (1 + phi));
  const c = (6 * EI) / (L ** 2 * (1 + phi));
  const d = ((4 + phi) * EI) / (L * (1 + phi));
  const e = ((2 - phi) * EI) / (L * (1 + phi));
  return [
    [a, 0, 0, -a, 0, 0],
    [0, b, c, 0, -b, c],
    [0, c, d, 0, -c, e],
    [-a, 0, 0, a, 0, 0],
    [0, -b, -c, 0, b, -c],
    [0, c, e, 0, -c, d],
  ];
};

/**
 * Consistent geometric-stiffness matrix for a prismatic 2-node beam-column
 * element, local DOF order `[ui, vi, θi, uj, vj, θj]` (rows/cols 0 and 3, the
 * axial DOFs, are left at zero). `N` follows this engine's own convention —
 * tension positive — so a compressive member (`N < 0`) softens the transverse
 * stiffness and an axial-force-free member (`N = 0`) leaves it unchanged.
 */
export const geometricStiffness = (L: number, N: number): Matrix => {
  const g = N / L;
  const k = zeros(6, 6);
  k[1][1] = k[4][4] = (6 / 5) * g;
  k[1][4] = k[4][1] = -(6 / 5) * g;
  k[1][2] = k[2][1] = k[1][5] = k[5][1] = (L / 10) * g;
  k[2][4] = k[4][2] = k[4][5] = k[5][4] = -(L / 10) * g;
  k[2][2] = k[5][5] = (2 * L * L / 15) * g;
  k[2][5] = k[5][2] = -(L * L / 30) * g;
  return k;
};

const trussLocalStiffness = (member: MemberModel, L: number): Matrix => {
  const a = (member.E * member.A) / L;
  return [
    [a, 0, 0, -a, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [-a, 0, 0, a, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ];
};

export const transformMatrix = ({ c, s }: Geometry): Matrix => [
  [c, s, 0, 0, 0, 0],
  [-s, c, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0],
  [0, 0, 0, c, s, 0],
  [0, 0, 0, -s, c, 0],
  [0, 0, 0, 0, 0, 1],
];

/** Maps global joint DOFs directly to the local DOFs at the deformable faces. */
export const rigidOffsetTransform = (
  geometry: Geometry,
  startOffset = 0,
  endOffset = 0,
): Matrix => {
  const localJoint = transformMatrix(geometry);
  const faceFromJoint: Matrix = [
    [1, 0, 0, 0, 0, 0],
    [0, 1, startOffset, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 1, -endOffset],
    [0, 0, 0, 0, 0, 1],
  ];
  return multiply(faceFromJoint, localJoint);
};

const frameInterpolation = (member: MemberModel, x: number, L: number): { v: number[]; theta: number[] } => {
  const EI = member.E * member.I;
  const shearRigidity = member.beamTheory === 'timoshenko' ? (member.G ?? 0) * (member.shearArea ?? 0) : Number.POSITIVE_INFINITY;
  const inverseShearRigidity = Number.isFinite(shearRigidity) && shearRigidity > 0 ? 1 / shearRigidity : 0;
  const a = L / EI;
  const b = L ** 2 / (2 * EI);
  const d = L ** 3 / (6 * EI) - L * inverseShearRigidity;
  const determinant = a * d - b * b;
  const bases = [
    { vi: 1, ti: 0, vj: 0, tj: 0 },
    { vi: 0, ti: 1, vj: 0, tj: 0 },
    { vi: 0, ti: 0, vj: 1, tj: 0 },
    { vi: 0, ti: 0, vj: 0, tj: 1 },
  ];
  const v: number[] = [];
  const theta: number[] = [];
  for (const basis of bases) {
    const rhsTheta = basis.tj - basis.ti;
    const rhsV = basis.vj - basis.vi - basis.ti * L;
    const m0 = (rhsTheta * d - b * rhsV) / determinant;
    const shear = (a * rhsV - b * rhsTheta) / determinant;
    theta.push(basis.ti + (m0 * x + shear * x ** 2 / 2) / EI);
    v.push(basis.vi + basis.ti * x + (m0 * x ** 2 / 2 + shear * x ** 3 / 6) / EI - shear * x * inverseShearRigidity);
  }
  return { v, theta };
};

const shapeVector = (member: MemberModel, x: number, L: number): number[] => {
  const r = x / L;
  if (member.type !== 'frame') return [1 - r, 0, 0, r, 0, 0];
  const interpolation = frameInterpolation(member, x, L);
  return [1 - r, interpolation.v[0], interpolation.v[1], r, interpolation.v[2], interpolation.v[3]];
};

const rotationShapeVector = (member: MemberModel, x: number, L: number): number[] => {
  if (member.type !== 'frame') return [0, 0, 0, 0, 0, 0];
  const interpolation = frameInterpolation(member, x, L);
  return [0, interpolation.theta[0], interpolation.theta[1], 0, interpolation.theta[2], interpolation.theta[3]];
};

const toLocalVector = (x: number, y: number, coordinateSystem: 'global' | 'local', geometry: Geometry): [number, number] => {
  if (coordinateSystem === 'local') return [x, y];
  return [geometry.c * x + geometry.s * y, -geometry.s * x + geometry.c * y];
};

const lengthBasisScale = (basis: 'real' | 'horizontal' | 'vertical', geometry: Geometry): number => {
  if (basis === 'horizontal') return Math.abs(geometry.c);
  if (basis === 'vertical') return Math.abs(geometry.s);
  return 1;
};

const loadToLocal = (load: MemberLoad, geometry: Geometry, factor: number): LocalMemberLoad => {
  if (load.type === 'point') {
    const [px, py] = toLocalVector(load.px ?? 0, load.py ?? 0, load.coordinateSystem, geometry);
    return {
      kind: 'point',
      x: Math.min(1, Math.max(0, load.position ?? 0.5)) * geometry.L,
      px: px * factor,
      py: py * factor,
    };
  }
  if (load.type === 'moment') {
    return {
      kind: 'moment',
      x: Math.min(1, Math.max(0, load.position ?? 0.5)) * geometry.L,
      moment: (load.moment ?? 0) * factor,
    };
  }

  const basisScale = lengthBasisScale(load.lengthBasis, geometry);
  const [qxA, qyA] = toLocalVector(load.qxStart ?? 0, load.qyStart ?? 0, load.coordinateSystem, geometry);
  const [qxB, qyB] = toLocalVector(load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0, load.coordinateSystem, geometry);
  const a = Math.min(load.start, load.end) * geometry.L;
  const b = Math.max(load.start, load.end) * geometry.L;
  return {
    kind: 'distributed',
    a,
    b,
    qxA: qxA * basisScale * factor,
    qxB: qxB * basisScale * factor,
    qyA: qyA * basisScale * factor,
    qyB: qyB * basisScale * factor,
  };
};

const equivalentNodalLoad = (loads: LocalMemberLoad[], L: number, member: MemberModel): number[] => {
  const f = Array(6).fill(0);
  for (const load of loads) {
    if (load.kind === 'point') {
      const n = shapeVector(member, load.x, L);
      f[0] += n[0] * load.px;
      f[3] += n[3] * load.px;
      f[1] += n[1] * load.py;
      f[2] += n[2] * load.py;
      f[4] += n[4] * load.py;
      f[5] += n[5] * load.py;
      continue;
    }
    if (load.kind === 'moment') {
      const d = rotationShapeVector(member, load.x, L);
      for (let i = 0; i < 6; i += 1) f[i] += d[i] * load.moment;
      continue;
    }

    const span = load.b - load.a;
    if (!(span > 0)) continue;
    for (const gp of GAUSS_POINTS) {
      const x = load.a + ((gp.x + 1) * span) / 2;
      const r = (x - load.a) / span;
      const qx = load.qxA + (load.qxB - load.qxA) * r;
      const qy = load.qyA + (load.qyB - load.qyA) * r;
      const n = shapeVector(member, x, L);
      const jac = span / 2;
      f[0] += gp.w * jac * n[0] * qx;
      f[3] += gp.w * jac * n[3] * qx;
      f[1] += gp.w * jac * n[1] * qy;
      f[2] += gp.w * jac * n[2] * qy;
      f[4] += gp.w * jac * n[4] * qy;
      f[5] += gp.w * jac * n[5] * qy;
    }
  }
  return f;
};

const initialEffectEquivalentLoad = (
  member: MemberModel,
  axialStrain: number,
  curvature: number,
): number[] => {
  const axial = member.E * member.A * axialStrain;
  const bending = member.E * member.I * curvature;
  return [-axial, 0, -bending, axial, 0, bending];
};

interface CondensationResult {
  stiffness: Matrix;
  load: number[];
  released: number[];
  recovery?: {
    kba: Matrix;
    kbb: Matrix;
    fb: number[];
    beamRotationIndices: number[];
  };
}

const condenseConnections = (
  k: Matrix,
  f: number[],
  member: MemberModel,
  releaseI: boolean,
  releaseJ: boolean,
  linearBackend: LinearSolverPolicy = 'auto',
): CondensationResult => {
  const connections = [
    releaseI || member.rotationalSpringI !== undefined ? { localRotation: 2, stiffness: releaseI ? 0 : member.rotationalSpringI ?? 0 } : null,
    releaseJ || member.rotationalSpringJ !== undefined ? { localRotation: 5, stiffness: releaseJ ? 0 : member.rotationalSpringJ ?? 0 } : null,
  ].filter((connection): connection is { localRotation: number; stiffness: number } => connection !== null);
  const released = connections.filter((connection) => connection.stiffness === 0).map((connection) => connection.localRotation);
  if (!connections.length) return { stiffness: k, load: f, released };
  const size = 6 + connections.length;
  const augmentedK = zeros(size, size);
  const augmentedF = Array(size).fill(0);
  const beamMap = [0, 1, 2, 3, 4, 5];
  connections.forEach((connection, index) => { beamMap[connection.localRotation] = 6 + index; });
  for (let i = 0; i < 6; i += 1) {
    augmentedF[beamMap[i]] += f[i];
    for (let j = 0; j < 6; j += 1) augmentedK[beamMap[i]][beamMap[j]] += k[i][j];
  }
  connections.forEach((connection, index) => {
    if (connection.stiffness <= 0) return;
    const internal = 6 + index;
    const joint = connection.localRotation;
    augmentedK[joint][joint] += connection.stiffness;
    augmentedK[internal][internal] += connection.stiffness;
    augmentedK[joint][internal] -= connection.stiffness;
    augmentedK[internal][joint] -= connection.stiffness;
  });
  const retained = [0, 1, 2, 3, 4, 5];
  const internal = connections.map((_, index) => 6 + index);
  const kaa = submatrix(augmentedK, retained, retained);
  const kab = submatrix(augmentedK, retained, internal);
  const kba = submatrix(augmentedK, internal, retained);
  const kbb = submatrix(augmentedK, internal, internal);
  const fa = subvector(augmentedF, retained);
  const fb = subvector(augmentedF, internal);
  // Static condensation without forming Kbb^-1 explicitly:
  // Kbar = Kaa - Kab X, with Kbb X = Kba.
  const solvedColumns = transpose(kba).map((column) => solveLinearSystem(kbb, column, { backend: linearBackend }).x);
  const kbbInverseTimesKba = transpose(solvedColumns);
  const kbbInverseTimesFb = solveLinearSystem(kbb, fb, { backend: linearBackend }).x;
  const correctionK = multiply(kab, kbbInverseTimesKba);
  const correctionF = multiplyMatrixVector(kab, kbbInverseTimesFb);
  const condensedK = kaa.map((row, i) => row.map((value, j) => value - correctionK[i][j]));
  const condensedF = fa.map((value, i) => value - correctionF[i]);
  return { stiffness: condensedK, load: condensedF, released, recovery: { kba, kbb, fb, beamRotationIndices: connections.map((connection) => connection.localRotation) } };
};

const recoverConnectedDisplacements = (
  assembly: ElementAssembly,
  nodalLocalDisplacements: number[],
  linearBackend: LinearSolverPolicy = 'auto',
): number[] => {
  if (!assembly.connectionRecovery) return nodalLocalDisplacements;
  const { kba, kbb, fb, beamRotationIndices } = assembly.connectionRecovery;
  const rhs = fb.map((value, i) => value - multiplyMatrixVector(kba, nodalLocalDisplacements)[i]);
  const db = solveLinearSystem(kbb, rhs, { backend: linearBackend }).x;
  const recovered = [...nodalLocalDisplacements];
  beamRotationIndices.forEach((index, i) => {
    recovered[index] = db[i];
  });
  return recovered;
};

/**
 * Static counterpart of the assembly grounding guard. This deliberately says
 * only whether the model has any direct support constraint or positive nodal
 * spring; it does not attempt to diagnose general mechanisms.
 */
const hasEvidentGrounding = (project: ProjectModel): boolean => {
  if (!project.members.length) return false;
  const participatingNodeIds = new Set(project.members.flatMap((member) => [member.i, member.j]));
  const hasSupportConstraint = project.nodes.some((node) => {
    if (!participatingNodeIds.has(node.id)) return false;
    const support = node.support;
    if (support.type === 'fixed' || support.type === 'pin' || support.type === 'roller') return true;
    return support.type === 'custom' && Boolean(support.restrainX || support.restrainY || support.restrainR);
  });
  const hasGroundingSpring = project.nodes.some((node) => {
    if (!participatingNodeIds.has(node.id)) return false;
    const spring = node.support.spring;
    return Boolean(spring && [spring.kx, spring.ky, spring.kr, spring.kNormal].some((value) => (value ?? 0) > 0));
  });
  return hasSupportConstraint || hasGroundingSpring;
};

export const getEvidentGroundingIssue = (project: ProjectModel): ValidationIssue | null => hasEvidentGrounding(project)
  || !project.members.length ? null
  : { id: 'no-supports', severity: 'error', title: 'Estructura sin restricciones', message: 'Agrega apoyos para impedir los movimientos rígidos del modelo.' };

export const validateProject = (project: ProjectModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const push = (issue: ValidationIssue) => issues.push(issue);
  const nodeMap = getNodeMap(project);
  const memberMap = new Map(project.members.map((member) => [member.id, member]));
  const caseIds = new Set(project.loadCases.map((loadCase) => loadCase.id));
  const finiteValue = (value: number) => Number.isFinite(value);

  if (project.nodes.length < 2) {
    push({ id: 'nodes-min', severity: 'error', title: 'Modelo incompleto', message: 'Agrega al menos dos nodos.', suggestedFix: 'Usa la herramienta Nodo y después conecta los nodos con miembros.' });
  }
  if (project.members.length === 0) {
    push({ id: 'members-min', severity: 'error', title: 'Sin miembros', message: 'Conecta los nodos con al menos un miembro.', suggestedFix: 'Selecciona Miembro y toca dos nodos.' });
  }

  const repeatedNodeIds = project.nodes.filter((node, index) => project.nodes.findIndex((item) => item.id === node.id) !== index);
  repeatedNodeIds.forEach((node) => push({ id: `duplicate-node-id-${node.id}`, severity: 'error', title: 'Identificador de nodo repetido', message: `El identificador ${node.id} se utiliza más de una vez.`, objectId: node.id, suggestedFix: 'Asigna identificadores únicos antes de analizar.' }));
  const repeatedMemberIds = project.members.filter((member, index) => project.members.findIndex((item) => item.id === member.id) !== index);
  repeatedMemberIds.forEach((member) => push({ id: `duplicate-member-id-${member.id}`, severity: 'error', title: 'Identificador de miembro repetido', message: `El identificador ${member.id} se utiliza más de una vez.`, objectId: member.id, suggestedFix: 'Asigna identificadores únicos antes de analizar.' }));
  const validateUniqueIds = (items: Array<{ id: string }>, kind: string, slug: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) push({ id: `duplicate-${slug}-id-${item.id}`, severity: 'error', title: 'Identificador repetido', message: `El identificador ${item.id} se utiliza más de una vez en ${kind}.`, objectId: item.id, suggestedFix: 'Asigna identificadores únicos antes de analizar.' });
      seen.add(item.id);
    }
  };
  validateUniqueIds(project.loadCases, 'casos de carga', 'load-case');
  validateUniqueIds(project.combinations, 'combinaciones', 'combination');
  validateUniqueIds(project.nodalLoads, 'cargas nodales', 'nodal-load');
  validateUniqueIds(project.memberLoads, 'cargas de miembro', 'member-load');
  validateUniqueIds(project.prescribedDisplacements ?? [], 'desplazamientos prescritos', 'prescribed-displacement');

  const xs = project.nodes.map((node) => node.x).filter(Number.isFinite);
  const ys = project.nodes.map((node) => node.y).filter(Number.isFinite);
  const referenceLength = Math.max(
    1,
    xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
  );
  const geometryTolerance = referenceLength * 1e-9;

  project.nodes.forEach((node, index) => {
    if (!finiteValue(node.x) || !finiteValue(node.y)) {
      push({ id: `node-coordinate-${node.id}`, severity: 'error', title: 'Coordenada inválida', message: `El nodo ${node.id} contiene una coordenada no numérica.`, objectId: node.id, suggestedFix: 'Introduce valores finitos para X y Y.' });
    }
    for (let otherIndex = index + 1; otherIndex < project.nodes.length; otherIndex += 1) {
      const other = project.nodes[otherIndex];
      if (Math.hypot(other.x - node.x, other.y - node.y) <= geometryTolerance) {
        push({ id: `near-node-${node.id}-${other.id}`, severity: 'warning', title: 'Nodos coincidentes o casi coincidentes', message: `${node.id} y ${other.id} están separados menos de ${geometryTolerance.toExponential(2)} m.`, objectId: node.id, suggestedFix: 'Une los nodos o aumenta su separación para evitar miembros casi nulos.' });
      }
    }
    const support = node.support;
    if (support.type === 'roller' && !finiteValue(support.angleDeg ?? 90)) {
      push({ id: `support-angle-${node.id}`, severity: 'error', title: 'Ángulo de apoyo inválido', message: `El rodillo de ${node.id} no tiene una dirección normal válida.`, objectId: node.id, suggestedFix: 'Define el ángulo de la dirección restringida en grados.' });
    }
    const spring = support.spring;
    if (spring) {
      for (const [key, value] of Object.entries(spring)) {
        if (key === 'angleDeg' || value === undefined) continue;
        if (!finiteValue(value) || value < 0) {
          push({ id: `spring-${node.id}-${key}`, severity: 'error', title: 'Rigidez de resorte inválida', message: `El resorte ${key} del nodo ${node.id} debe ser finito y no negativo.`, objectId: node.id, suggestedFix: 'Introduce una rigidez mayor o igual que cero.' });
        }
      }
      if ((spring.kNormal ?? 0) > 0 && spring.angleDeg !== undefined && !finiteValue(spring.angleDeg)) {
        push({ id: `spring-angle-${node.id}`, severity: 'error', title: 'Ángulo de resorte inválido', message: `El resorte normal del nodo ${node.id} necesita una dirección finita.`, objectId: node.id, suggestedFix: 'Define el ángulo del resorte normal en grados.' });
      }
    }
    const prescribed = support.prescribed;
    if (prescribed) {
      for (const [component, value] of Object.entries(prescribed)) {
        if (value !== undefined && !finiteValue(value)) {
          push({ id: `prescribed-${node.id}-${component}`, severity: 'error', title: 'Desplazamiento prescrito inválido', message: `El valor ${component} del apoyo ${node.id} debe ser finito.`, objectId: node.id, suggestedFix: 'Introduce un asentamiento finito o elimina el valor prescrito.' });
        }
      }
      const invalidComponents: string[] = [];
      if (support.type === 'none') invalidComponents.push(...Object.keys(prescribed).filter((key) => prescribed[key as keyof typeof prescribed] !== undefined));
      if (support.type === 'pin' && prescribed.rz !== undefined) invalidComponents.push('rz');
      if (support.type === 'pin' && prescribed.normal !== undefined) invalidComponents.push('normal');
      if (support.type === 'fixed' && prescribed.normal !== undefined) invalidComponents.push('normal');
      if (support.type === 'roller' && (prescribed.ux !== undefined || prescribed.uy !== undefined || prescribed.rz !== undefined)) invalidComponents.push('ux/uy/rz');
      if (support.type === 'custom') {
        if (!support.restrainX && prescribed.ux !== undefined) invalidComponents.push('ux');
        if (!support.restrainY && prescribed.uy !== undefined) invalidComponents.push('uy');
        if (!support.restrainR && prescribed.rz !== undefined) invalidComponents.push('rz');
        if (prescribed.normal !== undefined) invalidComponents.push('normal');
      }
      if (invalidComponents.length) {
        push({ id: `prescribed-support-${node.id}`, severity: 'error', title: 'Asentamiento incompatible con el apoyo', message: `El apoyo ${node.id} no restringe directamente ${[...new Set(invalidComponents)].join(', ')}.`, objectId: node.id, suggestedFix: 'Prescribe únicamente los grados de libertad restringidos; en un rodillo usa el desplazamiento normal.' });
      }
    }
  });

  const memberPairs = new Set<string>();
  const connectedNodeIds = new Set<string>();
  for (const member of project.members) {
    const ni = nodeMap.get(member.i);
    const nj = nodeMap.get(member.j);
    if (!ni || !nj) {
      push({ id: `missing-${member.id}`, severity: 'error', title: 'Nodo inexistente', message: `El miembro ${member.id} referencia un nodo que no existe.`, objectId: member.id, suggestedFix: 'Selecciona nodos existentes para los extremos i y j.' });
      continue;
    }
    connectedNodeIds.add(member.i);
    connectedNodeIds.add(member.j);
    const L = Math.hypot(nj.x - ni.x, nj.y - ni.y);
    if (member.i === member.j || L <= geometryTolerance) {
      push({ id: `zero-${member.id}`, severity: 'error', title: 'Longitud cero', message: `El miembro ${member.id} tiene longitud nula o casi nula.`, objectId: member.id, suggestedFix: 'Separa sus nodos extremos o elimina el miembro.' });
    }
    if (member.type !== 'rigid') {
      if (!finiteValue(member.E) || member.E <= 0) push({ id: `E-${member.id}`, severity: 'error', title: 'Módulo elástico inválido', message: `E del miembro ${member.id} debe ser mayor que cero.`, objectId: member.id, suggestedFix: 'Define E con unidades coherentes.' });
      if (!finiteValue(member.A) || member.A <= 0) push({ id: `A-${member.id}`, severity: 'error', title: 'Área inválida', message: `A del miembro ${member.id} debe ser mayor que cero.`, objectId: member.id, suggestedFix: 'Define un área transversal positiva.' });
      if (member.type === 'frame' && (!finiteValue(member.I) || member.I <= 0)) push({ id: `I-${member.id}`, severity: 'error', title: 'Inercia inválida', message: `I del miembro ${member.id} debe ser mayor que cero.`, objectId: member.id, suggestedFix: 'Define un momento de inercia positivo.' });
      if (finiteValue(member.E) && finiteValue(member.A) && !finiteValue(member.E * member.A)) push({ id: `EA-${member.id}`, severity: 'error', title: 'Rigidez axial fuera de rango', message: `E·A del miembro ${member.id} excede el rango numérico disponible.`, objectId: member.id, suggestedFix: 'Revisa unidades y órdenes de magnitud de E y A.' });
      if (member.type === 'frame' && finiteValue(member.E) && finiteValue(member.I) && !finiteValue(member.E * member.I)) push({ id: `EI-${member.id}`, severity: 'error', title: 'Rigidez flexional fuera de rango', message: `E·I del miembro ${member.id} excede el rango numérico disponible.`, objectId: member.id, suggestedFix: 'Revisa unidades y órdenes de magnitud de E e I.' });
      if (member.type !== 'frame' && (member.releases?.iMoment || member.releases?.jMoment)) push({ id: `release-type-${member.id}`, severity: 'error', title: 'Liberación incompatible', message: `Las liberaciones de momento de ${member.id} solo aplican a miembros de marco.`, objectId: member.id, suggestedFix: 'Elimina la liberación o cambia el tipo de miembro.' });
      if (member.beamTheory === 'timoshenko') {
        if (member.type !== 'frame') push({ id: `timoshenko-type-${member.id}`, severity: 'error', title: 'Teoría de viga incompatible', message: `Timoshenko solo está disponible para miembros de pórtico; ${member.id} es ${member.type}.`, objectId: member.id });
        if (!finiteValue(member.G ?? Number.NaN) || (member.G ?? 0) <= 0) push({ id: `G-${member.id}`, severity: 'error', title: 'Módulo cortante inválido', message: `G del miembro ${member.id} debe ser mayor que cero para Timoshenko.`, objectId: member.id, suggestedFix: 'Define G o usa Euler–Bernoulli.' });
        if (!finiteValue(member.shearArea ?? Number.NaN) || (member.shearArea ?? 0) <= 0) push({ id: `As-${member.id}`, severity: 'error', title: 'Área cortante inválida', message: `As efectiva del miembro ${member.id} debe ser mayor que cero para Timoshenko.`, objectId: member.id, suggestedFix: 'Define el área cortante efectiva, incluida la corrección de cortante.' });
        if (finiteValue(member.G ?? Number.NaN) && finiteValue(member.shearArea ?? Number.NaN) && !finiteValue((member.G ?? 0) * (member.shearArea ?? 0))) push({ id: `GAs-${member.id}`, severity: 'error', title: 'Rigidez cortante fuera de rango', message: `G·As del miembro ${member.id} excede el rango numérico disponible.`, objectId: member.id, suggestedFix: 'Revisa unidades y órdenes de magnitud de G y As.' });
      }
      for (const [end, stiffness] of [['i', member.rotationalSpringI], ['j', member.rotationalSpringJ]] as const) {
        if (stiffness !== undefined && (!finiteValue(stiffness) || stiffness < 0)) push({ id: `rotational-spring-${member.id}-${end}`, severity: 'error', title: 'Conexión semirrígida inválida', message: `La rigidez rotacional del extremo ${end} de ${member.id} debe ser finita y no negativa.`, objectId: member.id });
        if (stiffness !== undefined && member.type !== 'frame') push({ id: `rotational-spring-type-${member.id}-${end}`, severity: 'error', title: 'Conexión semirrígida incompatible', message: `La rigidez rotacional de extremo solo aplica a miembros de pórtico.`, objectId: member.id });
        if (stiffness !== undefined && (end === 'i' ? member.releases?.iMoment : member.releases?.jMoment)) push({ id: `rotational-spring-release-${member.id}-${end}`, severity: 'warning', title: 'Liberación prevalece sobre el resorte', message: `El extremo ${end} de ${member.id} tiene liberación y rigidez semirrígida; se analizará como articulado.`, objectId: member.id, suggestedFix: 'Desactiva la liberación para usar la rigidez semirrígida.' });
        if (stiffness !== undefined && (end === 'i' ? ni.internalHinge : nj.internalHinge)) push({ id: `rotational-spring-hinge-${member.id}-${end}`, severity: 'warning', title: 'Articulación interna prevalece sobre el resorte', message: `El nodo del extremo ${end} de ${member.id} es una articulación interna; su resorte rotacional no participa.`, objectId: member.id, suggestedFix: 'Desactiva la articulación interna para usar la conexión semirrígida.' });
      }
      if (member.density !== undefined && (!finiteValue(member.density) || member.density < 0)) push({ id: `density-${member.id}`, severity: 'error', title: 'Densidad inválida', message: `La densidad del miembro ${member.id} debe ser finita y no negativa.`, objectId: member.id, suggestedFix: 'Corrige la densidad o déjala en cero si no usarás peso propio.' });
    }
    const offsetI = member.rigidOffsetI ?? 0;
    const offsetJ = member.rigidOffsetJ ?? 0;
    if (![offsetI, offsetJ].every(finiteValue) || offsetI < 0 || offsetJ < 0) {
      push({ id: `rigid-offset-value-${member.id}`, severity: 'error', title: 'Zona rígida inválida', message: `Las zonas rígidas de ${member.id} deben ser longitudes finitas no negativas.`, objectId: member.id, suggestedFix: 'Introduce offsets mayores o iguales que cero.' });
    } else if (offsetI + offsetJ >= L - geometryTolerance) {
      push({ id: `rigid-offset-length-${member.id}`, severity: 'error', title: 'Zona rígida demasiado larga', message: `Las zonas rígidas de ${member.id} dejan una longitud deformable nula o casi nula.`, objectId: member.id, suggestedFix: 'Reduce los offsets para conservar un tramo flexible positivo.' });
    }
    if ((offsetI > 0 || offsetJ > 0) && member.type !== 'frame') {
      push({ id: `rigid-offset-type-${member.id}`, severity: 'error', title: 'Zona rígida incompatible', message: `Las zonas rígidas colineales solo están disponibles en miembros de marco; ${member.id} es ${member.type}.`, objectId: member.id, suggestedFix: 'Usa un miembro de marco o elimina los offsets.' });
    }
    if ((offsetI > 0 && ni.internalHinge) || (offsetJ > 0 && nj.internalHinge)) {
      push({ id: `rigid-offset-hinge-${member.id}`, severity: 'error', title: 'Ubicación de articulación ambigua', message: `El miembro ${member.id} combina una zona rígida con una articulación interna en el mismo extremo.`, objectId: member.id, suggestedFix: 'Elimina el offset o modela la articulación en un nodo ubicado en la cara de la zona rígida.' });
    }
    const key = [member.i, member.j].sort().join('::');
    if (memberPairs.has(key)) push({ id: `dup-${member.id}`, severity: 'warning', title: 'Miembro superpuesto', message: `Hay más de un miembro entre ${member.i} y ${member.j}. Puede ser intencional, pero duplica rigidez y carga.`, objectId: member.id, suggestedFix: 'Elimina el duplicado si no representa dos elementos físicos paralelos.' });
    memberPairs.add(key);
  }

  project.nodes.filter((node) => !connectedNodeIds.has(node.id)).forEach((node) => {
    const loaded = project.nodalLoads.some((load) => load.nodeId === node.id && Math.abs(load.fx) + Math.abs(load.fy) + Math.abs(load.mz) > 0);
    const containingMember = project.members.find((member) => memberInteriorRatioAtPoint(project, member, node, geometryTolerance) !== null);
    const active = nodeHasStructuralActivity(project, node);
    const supportOrSpring = node.support.type !== 'none' || Boolean(node.support.spring && Object.entries(node.support.spring).some(([key, value]) => key !== 'angleDeg' && Math.abs(value ?? 0) > 0));
    if (containingMember) {
      push({
        id: `node-on-member-${node.id}-${containingMember.id}`,
        severity: active ? 'error' : 'warning',
        title: supportOrSpring ? 'Apoyo dibujado sin conexión estructural' : 'Nodo sobre miembro sin conexión',
        message: `${node.id} coincide con el interior de ${containingMember.id}, pero el miembro no termina en ese nodo y no transfiere fuerzas${supportOrSpring ? ' al apoyo' : ''}.`,
        objectId: node.id,
        objectKind: 'node',
        suggestedFix: `Divide ${containingMember.id} en ${node.id} para crear una unión real.`,
        suggestedTool: 'split',
      });
      return;
    }
    push({
      id: `isolated-${node.id}`,
      severity: loaded || supportOrSpring ? 'error' : 'warning',
      title: loaded ? 'Carga en nodo aislado' : supportOrSpring ? 'Apoyo desconectado' : 'Nodo aislado',
      message: `El nodo ${node.id} no está conectado a ningún miembro${loaded ? ' y tiene carga aplicada' : supportOrSpring ? '; su apoyo no participa en la estructura' : ''}.`,
      objectId: node.id,
      objectKind: 'node',
      suggestedFix: 'Conéctalo a la estructura o elimínalo.',
      suggestedTool: 'member',
    });
  });

  const repeatedEffectIds = (project.memberInitialEffects ?? []).filter((effect, index, effects) => effects.findIndex((item) => item.id === effect.id) !== index);
  repeatedEffectIds.forEach((effect) => push({ id: `duplicate-initial-effect-${effect.id}`, severity: 'error', title: 'Identificador de efecto inicial repetido', message: `El identificador ${effect.id} se utiliza más de una vez.`, objectId: effect.id, suggestedFix: 'Asigna identificadores únicos a los efectos térmicos e iniciales.' }));
  for (const effect of project.memberInitialEffects ?? []) {
    if (!memberMap.has(effect.memberId)) push({ id: `initial-effect-member-${effect.id}`, severity: 'error', title: 'Miembro inexistente', message: `El efecto ${effect.id} referencia el miembro ${effect.memberId}, que no existe.`, objectId: effect.id });
    if (!caseIds.has(effect.caseId)) push({ id: `initial-effect-case-${effect.id}`, severity: 'error', title: 'Caso de carga inexistente', message: `El efecto ${effect.id} referencia el caso ${effect.caseId}, que no existe.`, objectId: effect.id });
    const values = effect.type === 'temperature'
      ? [effect.alpha ?? 1.2e-5, effect.deltaT ?? 0, effect.gradient ?? 0]
      : [effect.axialStrain ?? 0, effect.curvature ?? 0];
    if (values.some((value) => !finiteValue(value))) push({ id: `initial-effect-value-${effect.id}`, severity: 'error', title: 'Efecto inicial inválido', message: `El efecto ${effect.id} contiene valores no finitos.`, objectId: effect.id, suggestedFix: 'Corrige α, ΔT, gradiente, deformación o curvatura.' });
    if (effect.type === 'temperature' && (effect.alpha ?? 1.2e-5) < 0) push({ id: `initial-effect-alpha-${effect.id}`, severity: 'error', title: 'Coeficiente térmico inválido', message: `α del efecto ${effect.id} no puede ser negativo.`, objectId: effect.id });
    const targetMember = memberMap.get(effect.memberId);
    if (targetMember?.type === 'rigid') push({ id: `initial-effect-rigid-${effect.id}`, severity: 'error', title: 'Efecto inicial incompatible con vínculo rígido', message: `El efecto ${effect.id} se aplica a ${targetMember.id}, que no tiene deformación propia.`, objectId: effect.id, suggestedFix: 'Aplica el efecto a un miembro deformable o elimina el efecto.' });
    const hasCurvature = effect.type === 'temperature' ? Math.abs((effect.alpha ?? 1.2e-5) * (effect.gradient ?? 0)) > 0 : Math.abs(effect.curvature ?? 0) > 0;
    if (targetMember?.type === 'truss' && hasCurvature) push({ id: `initial-effect-curvature-${effect.id}`, severity: 'error', title: 'Curvatura incompatible con armadura', message: `El efecto ${effect.id} aplica curvatura a la barra axial ${targetMember.id}.`, objectId: effect.id, suggestedFix: 'Usa un miembro de pórtico o elimina la curvatura/gradiente.' });
  }

  for (const displacement of project.prescribedDisplacements ?? []) {
    const node = nodeMap.get(displacement.nodeId);
    if (!node) push({ id: `prescribed-node-${displacement.id}`, severity: 'error', title: 'Nodo inexistente', message: `El desplazamiento ${displacement.id} referencia el nodo ${displacement.nodeId}, que no existe.`, objectId: displacement.id });
    if (!caseIds.has(displacement.caseId)) push({ id: `prescribed-case-${displacement.id}`, severity: 'error', title: 'Caso de carga inexistente', message: `El desplazamiento ${displacement.id} referencia el caso ${displacement.caseId}, que no existe.`, objectId: displacement.id });
    if (!finiteValue(displacement.value)) push({ id: `prescribed-value-${displacement.id}`, severity: 'error', title: 'Desplazamiento prescrito inválido', message: `El desplazamiento ${displacement.id} debe ser finito.`, objectId: displacement.id });
    if (!node) continue;
    const support = node.support;
    const compatible = displacement.component === 'normal'
      ? support.type === 'roller'
      : displacement.component === 'ux'
        ? support.type === 'fixed' || support.type === 'pin' || (support.type === 'custom' && Boolean(support.restrainX))
        : displacement.component === 'uy'
          ? support.type === 'fixed' || support.type === 'pin' || (support.type === 'custom' && Boolean(support.restrainY))
          : support.type === 'fixed' || (support.type === 'custom' && Boolean(support.restrainR));
    if (!compatible) push({ id: `prescribed-component-${displacement.id}`, severity: 'error', title: 'Desplazamiento incompatible con el apoyo', message: `${displacement.component} no corresponde a una restricción del apoyo ${node.id}.`, objectId: displacement.id, suggestedFix: 'Cambia el apoyo o prescribe únicamente un grado de libertad restringido.' });
  }

  project.nodes.filter((node) => node.internalHinge).forEach((node) => {
    const incidentFrames = project.members.filter((member) => member.type === 'frame' && (member.i === node.id || member.j === node.id));
    if (incidentFrames.length < 2) {
      push({ id: `hinge-connectivity-${node.id}`, severity: 'warning', title: 'Articulación interna con poca conectividad', message: `${node.id} está marcado como articulación interna pero conecta menos de dos extremos de marco.`, objectId: node.id, suggestedFix: 'Revisa si buscabas una liberación de extremo o conecta los miembros que comparten la articulación.' });
    }
    if (incidentFrames.length === 0) {
      push({ id: `hinge-no-frame-${node.id}`, severity: 'warning', title: 'Articulación sin miembros de marco', message: `${node.id} no conecta miembros capaces de transmitir momento.`, objectId: node.id, suggestedFix: 'Elimina la articulación si el nodo solo conecta barras de armadura.' });
    }
  });

  if (!project.loadCases.length) push({ id: 'load-cases-empty', severity: 'error', title: 'Sin casos de carga', message: 'El proyecto necesita al menos un caso de carga.', suggestedFix: 'Crea un caso de carga antes de aplicar acciones.' });
  if (project.loadCases.length && !project.loadCases.some((loadCase) => loadCase.active)) push({ id: 'no-active-case', severity: 'warning', title: 'Sin casos activos', message: 'Ningún caso de carga está activo.', suggestedFix: 'Activa un caso o selecciona una combinación.' });
  for (const loadCase of project.loadCases) {
    if (loadCase.selfWeightFactor !== undefined && !finiteValue(loadCase.selfWeightFactor)) push({ id: `self-weight-${loadCase.id}`, severity: 'error', title: 'Factor de peso propio inválido', message: `El factor de peso propio de ${loadCase.name} debe ser finito.`, objectId: loadCase.id, suggestedFix: 'Introduce un multiplicador numérico finito.' });
  }

  for (const load of project.nodalLoads) {
    if (!nodeMap.has(load.nodeId)) push({ id: `nodal-node-${load.id}`, severity: 'error', title: 'Carga nodal huérfana', message: `La carga ${load.id} referencia el nodo inexistente ${load.nodeId}.`, objectId: load.id, suggestedFix: 'Asigna la carga a un nodo existente.' });
    if (!caseIds.has(load.caseId)) push({ id: `nodal-case-${load.id}`, severity: 'error', title: 'Caso de carga inexistente', message: `La carga ${load.id} referencia el caso ${load.caseId}.`, objectId: load.id, suggestedFix: 'Selecciona un caso de carga existente.' });
    if (![load.fx, load.fy, load.mz].every(finiteValue)) push({ id: `nodal-value-${load.id}`, severity: 'error', title: 'Carga no numérica', message: `La carga nodal ${load.id} contiene una magnitud inválida.`, objectId: load.id, suggestedFix: 'Introduce magnitudes finitas.' });
    const loadedNode = nodeMap.get(load.nodeId);
    const rotationRestrained = loadedNode?.support.type === 'fixed'
      || (loadedNode?.support.type === 'custom' && loadedNode.support.restrainR)
      || (loadedNode?.support.spring?.kr ?? 0) > 0;
    const rotationParticipates = loadedNode && !loadedNode.internalHinge && project.members.some((member) => {
      if (member.i !== loadedNode.id && member.j !== loadedNode.id) return false;
      if (member.type === 'rigid') return true;
      return frameEndTransfersRotation(member, loadedNode.id);
    });
    if (Math.abs(load.mz) > 1e-12 && !rotationRestrained && !rotationParticipates) {
      push({ id: `${loadedNode?.internalHinge ? 'hinge-moment' : 'free-rotation-moment'}-${load.id}`, severity: 'error', title: 'Momento aplicado a una rotación sin rigidez', message: `El momento nodal ${load.id} actúa en ${loadedNode?.id ?? load.nodeId}, cuya rotación no participa en ningún miembro ni apoyo.`, objectId: load.id, suggestedFix: 'Aplica el momento a un extremo de marco continuo o agrega una restricción rotacional físicamente justificada.' });
    }
  }

  for (const load of project.memberLoads) {
    const member = memberMap.get(load.memberId);
    if (!member) {
      push({ id: `member-load-member-${load.id}`, severity: 'error', title: 'Carga de miembro huérfana', message: `La carga ${load.id} referencia el miembro inexistente ${load.memberId}.`, objectId: load.id, suggestedFix: 'Asigna la carga a un miembro existente.' });
      continue;
    }
    if (!caseIds.has(load.caseId)) push({ id: `member-load-case-${load.id}`, severity: 'error', title: 'Caso de carga inexistente', message: `La carga ${load.id} referencia el caso ${load.caseId}.`, objectId: load.id, suggestedFix: 'Selecciona un caso de carga existente.' });
    if (member.type === 'rigid') push({ id: `rigid-load-${load.id}`, severity: 'error', title: 'Carga sobre vínculo rígido', message: `La carga ${load.id} no puede aplicarse directamente al vínculo rígido ${member.id}.`, objectId: load.id, suggestedFix: 'Aplica la carga a sus nodos o a un miembro deformable.' });
    if (member.type === 'truss') push({ id: `truss-member-load-${load.id}`, severity: 'error', title: 'Carga intermedia en barra de armadura', message: `La barra ${member.id} se modela como elemento de dos fuerzas y no admite cargas entre nodos.`, objectId: load.id, suggestedFix: 'Crea un nodo en la posición de la carga y aplícala como carga nodal.' });
    if (load.type === 'distributed') {
      if (![load.start, load.end, load.qxStart ?? 0, load.qxEnd ?? 0, load.qyStart ?? 0, load.qyEnd ?? 0].every(finiteValue)) push({ id: `distributed-value-${load.id}`, severity: 'error', title: 'Carga distribuida inválida', message: `La carga ${load.id} contiene magnitudes no numéricas.`, objectId: load.id, suggestedFix: 'Introduce valores finitos.' });
      if (load.start < 0 || load.start > 1 || load.end < 0 || load.end > 1 || load.end - load.start <= 1e-12) push({ id: `distributed-domain-${load.id}`, severity: 'error', title: 'Dominio de carga inválido', message: `El intervalo de ${load.id} debe cumplir 0 ≤ inicio < fin ≤ 1.`, objectId: load.id, suggestedFix: 'Corrige las posiciones inicial y final; la intensidad inicial corresponde al extremo de menor coordenada.' });
      if (member && member.type !== 'rigid') {
        const ni = nodeMap.get(member.i)!;
        const nj = nodeMap.get(member.j)!;
        const dx = nj.x - ni.x;
        const dy = nj.y - ni.y;
        const L = Math.hypot(dx, dy);
        if (load.lengthBasis === 'horizontal' && Math.abs(dx) <= geometryTolerance) push({ id: `horizontal-basis-${load.id}`, severity: 'error', title: 'Proyección horizontal nula', message: `La carga ${load.id} está definida por proyección horizontal, pero el miembro ${member.id} es vertical.`, objectId: load.id, suggestedFix: 'Usa longitud real o proyección vertical.' });
        if (load.lengthBasis === 'vertical' && Math.abs(dy) <= geometryTolerance) push({ id: `vertical-basis-${load.id}`, severity: 'error', title: 'Proyección vertical nula', message: `La carga ${load.id} está definida por proyección vertical, pero el miembro ${member.id} es horizontal.`, objectId: load.id, suggestedFix: 'Usa longitud real o proyección horizontal.' });
        if (L <= geometryTolerance) continue;
      }
    } else {
      const position = load.position ?? 0.5;
      if (!finiteValue(position) || position < 0 || position > 1) push({ id: `point-position-${load.id}`, severity: 'error', title: 'Posición de carga inválida', message: `La posición de ${load.id} debe cumplir 0 ≤ x/L ≤ 1.`, objectId: load.id, suggestedFix: 'Corrige la coordenada normalizada de la carga.' });
      const values = load.type === 'point' ? [load.px ?? 0, load.py ?? 0] : [load.moment ?? 0];
      if (!values.every(finiteValue)) push({ id: `point-value-${load.id}`, severity: 'error', title: 'Carga no numérica', message: `La carga ${load.id} contiene una magnitud inválida.`, objectId: load.id, suggestedFix: 'Introduce valores finitos.' });
    }
  }

  project.combinations.forEach((combination) => {
    Object.keys(combination.factors).filter((caseId) => !caseIds.has(caseId)).forEach((caseId) => push({ id: `combination-${combination.id}-${caseId}`, severity: 'warning', title: 'Factor de caso inexistente', message: `${combination.name} contiene un factor para ${caseId}, que no existe en el proyecto.`, objectId: combination.id, suggestedFix: 'Elimina el factor o crea el caso correspondiente.' }));
    Object.entries(combination.factors).filter(([, factor]) => !finiteValue(factor)).forEach(([caseId]) => push({ id: `combination-factor-${combination.id}-${caseId}`, severity: 'error', title: 'Factor inválido', message: `El factor de ${caseId} en ${combination.name} no es numérico.`, objectId: combination.id, suggestedFix: 'Introduce un factor finito.' }));
  });

  const hasSelfWeight = project.loadCases.some((loadCase) => Math.abs(loadCase.selfWeightFactor ?? 0) > 0)
    && project.members.some((member) => member.type !== 'rigid' && (member.density ?? 0) > 0 && member.A > 0);
  const hasLoad = hasSelfWeight
    || project.nodalLoads.some((load) => Math.abs(load.fx) + Math.abs(load.fy) + Math.abs(load.mz) > 0)
    || project.memberLoads.some((load) => {
      if (load.type === 'distributed') return Math.abs(load.qxStart ?? 0) + Math.abs(load.qxEnd ?? 0) + Math.abs(load.qyStart ?? 0) + Math.abs(load.qyEnd ?? 0) > 0;
      if (load.type === 'point') return Math.abs(load.px ?? 0) + Math.abs(load.py ?? 0) > 0;
      return Math.abs(load.moment ?? 0) > 0;
    })
    || (project.memberInitialEffects ?? []).some((effect) => effect.type === 'temperature'
      ? Math.abs((effect.alpha ?? 1.2e-5) * (effect.deltaT ?? 0)) + Math.abs((effect.alpha ?? 1.2e-5) * (effect.gradient ?? 0)) > 0
      : Math.abs(effect.axialStrain ?? 0) + Math.abs(effect.curvature ?? 0) > 0)
    || (project.prescribedDisplacements ?? []).some((displacement) => Math.abs(displacement.value) > 0);
  if (!hasLoad) push({ id: 'no-loads', severity: 'warning', title: 'Sin cargas', message: 'El modelo no contiene cargas distintas de cero.', suggestedFix: 'Agrega una carga o analiza el caso nulo únicamente como comprobación.' });
  if (project.settings.calculationMode === 'classroom') {
    const restraintCount = project.nodes.reduce((total, node) => {
      if (node.support.type === 'fixed') return total + (project.members.every((member) => member.type === 'truss') ? 2 : 3);
      if (node.support.type === 'pin') return total + 2;
      if (node.support.type === 'roller') return total + 1;
      if (node.support.type === 'custom') return total + Number(Boolean(node.support.restrainX)) + Number(Boolean(node.support.restrainY)) + Number(Boolean(node.support.restrainR));
      return total;
    }, 0);
    const pureTruss = project.members.length > 0 && project.members.every((member) => member.type === 'truss');
    const pureFrame = project.members.length > 0 && project.members.every((member) => member.type === 'frame');
    const uncomplicatedFrame = pureFrame && !project.nodes.some((node) => node.internalHinge) && !project.members.some((member) => member.releases?.iMoment || member.releases?.jMoment);
    const staticIndeterminacy = pureTruss
      ? project.members.length + restraintCount - 2 * project.nodes.length
      : uncomplicatedFrame ? 3 * project.members.length + restraintCount - 3 * project.nodes.length : 0;
    if (staticIndeterminacy > 0) push({
      id: 'classroom-relative-stiffness',
      severity: 'warning',
      title: 'Ejercicio hiperestático en modo Aula',
      message: `El conteo básico detecta ${staticIndeterminacy} redundancia${staticIndeterminacy === 1 ? '' : 's'}. Los diagramas dependen de las rigideces automáticas ocultas.`,
      suggestedFix: 'Para un reparto controlado, cambia a modo Completo y define E, A, I o G·As; para ejercicios isostáticos puedes continuar en modo Aula.',
    });
  }
  return issues;
};

export const selectedFactors = (project: ProjectModel, combination?: LoadCombination | null): Record<string, number> => {
  if (combination) return combination.factors;
  const factors: Record<string, number> = {};
  project.loadCases.forEach((loadCase) => {
    if (loadCase.active) factors[loadCase.id] = 1;
  });
  return factors;
};

export interface ResolvedMemberInitialEffect {
  axialStrain: number;
  curvature: number;
}

export const resolveMemberInitialEffect = (
  project: ProjectModel,
  memberId: string,
  combination?: LoadCombination | null,
): ResolvedMemberInitialEffect => {
  const factors = selectedFactors(project, combination);
  return (project.memberInitialEffects ?? [])
    .filter((effect) => effect.memberId === memberId && (factors[effect.caseId] ?? 0) !== 0)
    .reduce<ResolvedMemberInitialEffect>((total, effect) => {
      const factor = factors[effect.caseId] ?? 0;
      if (effect.type === 'temperature') {
        const alpha = effect.alpha ?? 1.2e-5;
        total.axialStrain += factor * alpha * (effect.deltaT ?? 0);
        // T(y)=T0+g*y and epsilon(y)=epsilon0-y*kappa, hence kappa=-alpha*g.
        total.curvature -= factor * alpha * (effect.gradient ?? 0);
      } else {
        total.axialStrain += factor * (effect.axialStrain ?? 0);
        total.curvature += factor * (effect.curvature ?? 0);
      }
      return total;
    }, { axialStrain: 0, curvature: 0 });
};

const resolvePrescribedDisplacements = (
  project: ProjectModel,
  factors: Record<string, number>,
): Map<string, { ux: number; uy: number; rz: number; normal: number }> => {
  const resolved = new Map<string, { ux: number; uy: number; rz: number; normal: number }>();
  for (const node of project.nodes) {
    resolved.set(node.id, {
      ux: node.support.prescribed?.ux ?? 0,
      uy: node.support.prescribed?.uy ?? 0,
      rz: node.support.prescribed?.rz ?? 0,
      normal: node.support.prescribed?.normal ?? 0,
    });
  }
  for (const displacement of project.prescribedDisplacements ?? []) {
    const factor = factors[displacement.caseId] ?? 0;
    const target = resolved.get(displacement.nodeId);
    if (target && factor !== 0) target[displacement.component] += factor * displacement.value;
  }
  return resolved;
};
export interface ResolvedMemberLoads {
  member: MemberModel;
  geometry: Geometry;
  loads: LocalMemberLoad[];
}

/** Resolve the exact local load model used by the stiffness solver and diagram engine.
 *  This is intentionally exported so educational cuts never duplicate load conversion logic.
 */
export const resolveMemberLocalLoads = (
  project: ProjectModel,
  memberId: string,
  combination?: LoadCombination | null,
): ResolvedMemberLoads => {
  const member = project.members.find((item) => item.id === memberId);
  if (!member) throw new Error(`No existe el miembro ${memberId}.`);
  const nodes = getNodeMap(project);
  const { geometry } = deformableGeometryOf(member, nodes);
  const factors = selectedFactors(project, combination);
  const loads = project.memberLoads
    .filter((load) => load.memberId === member.id && (factors[load.caseId] ?? 0) !== 0)
    .map((load) => loadToLocal(load, geometry, factors[load.caseId] ?? 0));

  const selfWeightFactor = project.loadCases.reduce(
    (sum, loadCase) => sum + (factors[loadCase.id] ?? 0) * (loadCase.selfWeightFactor ?? 0),
    0,
  );
  if (selfWeightFactor !== 0 && member.density && member.A > 0) {
    const weight = (member.density * 9.80665 * member.A) / 1000;
    const [qx, qy] = toLocalVector(0, -weight, 'global', geometry);
    loads.push({
      kind: 'distributed',
      a: 0,
      b: geometry.L,
      qxA: qx * selfWeightFactor,
      qxB: qx * selfWeightFactor,
      qyA: qy * selfWeightFactor,
      qyB: qy * selfWeightFactor,
    });
  }

  return { member, geometry, loads };
};

interface ResultantAccumulator {
  resultant: GlobalResultant;
  correction: GlobalResultant;
  absoluteFx: number;
  absoluteFy: number;
  absoluteMoment: number;
}

const emptyResultantAccumulator = (): ResultantAccumulator => ({
  resultant: { fx: 0, fy: 0, mz: 0 },
  correction: { fx: 0, fy: 0, mz: 0 },
  absoluteFx: 0,
  absoluteFy: 0,
  absoluteMoment: 0,
});

const neumaierAdd = (sum: number, correction: number, value: number): [number, number] => {
  const next = sum + value;
  const nextCorrection = correction + (Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum);
  return [next, nextCorrection];
};

const normalizedActivityResidual = (difference: number, componentActivity: number, familyActivity: number): number => {
  const magnitude = Math.abs(difference);
  // Round-off from rotations between local/global axes can leak into a physically
  // zero component. Remove only a family-relative floating-point noise floor.
  if (magnitude <= 1e-12 * Math.max(1, familyActivity)) return 0;
  return magnitude / Math.max(1e-12, componentActivity);
};

const addResultant = (
  accumulator: ResultantAccumulator,
  fx: number,
  fy: number,
  mz: number,
  momentActivity = Math.abs(mz),
): void => {
  [accumulator.resultant.fx, accumulator.correction.fx] = neumaierAdd(accumulator.resultant.fx, accumulator.correction.fx, fx);
  [accumulator.resultant.fy, accumulator.correction.fy] = neumaierAdd(accumulator.resultant.fy, accumulator.correction.fy, fy);
  [accumulator.resultant.mz, accumulator.correction.mz] = neumaierAdd(accumulator.resultant.mz, accumulator.correction.mz, mz);
  accumulator.absoluteFx += Math.abs(fx);
  accumulator.absoluteFy += Math.abs(fy);
  accumulator.absoluteMoment += momentActivity;
};

const finalizedResultant = (accumulator: ResultantAccumulator): GlobalResultant => ({
  fx: accumulator.resultant.fx + accumulator.correction.fx,
  fy: accumulator.resultant.fy + accumulator.correction.fy,
  mz: accumulator.resultant.mz + accumulator.correction.mz,
});

/** Exact integral of q(x) and x q(x) for a linear load over [a,b]. */
const linearLoadIntegrals = (qA: number, qB: number, a: number, b: number): { force: number; firstMoment: number } => {
  const span = b - a;
  if (!(span > 0)) return { force: 0, firstMoment: 0 };
  const slope = (qB - qA) / span;
  return {
    force: qA * span + slope * span ** 2 / 2,
    firstMoment: qA * (a * span + span ** 2 / 2)
      + slope * (a * span ** 2 / 2 + span ** 3 / 3),
  };
};

/**
 * Integrates the source actions directly, without using shape functions or the
 * assembled vector. This deliberately duplicates only global statics so an
 * assembly error cannot validate itself with the same equivalent nodal loads.
 */
const sourceActionResultant = (
  project: ProjectModel,
  factors: Record<string, number>,
  nodes: Map<string, NodeModel>,
  referenceX: number,
  referenceY: number,
): ResultantAccumulator => {
  const total = emptyResultantAccumulator();
  for (const load of project.nodalLoads) {
    const factor = factors[load.caseId] ?? 0;
    const node = nodes.get(load.nodeId);
    if (!node || factor === 0) continue;
    const fx = load.fx * factor;
    const fy = load.fy * factor;
    const dx = node.x - referenceX;
    const dy = node.y - referenceY;
    const appliedMoment = load.mz * factor;
    const mz = appliedMoment + dx * fy - dy * fx;
    addResultant(total, fx, fy, mz, Math.abs(appliedMoment) + Math.abs(dx * fy) + Math.abs(dy * fx));
  }

  for (const load of project.memberLoads) {
    const factor = factors[load.caseId] ?? 0;
    const member = project.members.find((candidate) => candidate.id === load.memberId);
    if (!member || member.type === 'rigid' || factor === 0) continue;
    const { geometry, startOffset } = deformableGeometryOf(member, nodes);
    const ni = nodes.get(member.i)!;
    // Form coordinates relative to the audit origin before adding offsets.
    // `(x + offset) - reference` loses meaningful digits when x is very large.
    const faceDx = (ni.x - referenceX) + geometry.c * startOffset;
    const faceDy = (ni.y - referenceY) + geometry.s * startOffset;

    if (load.type === 'moment') {
      const moment = (load.moment ?? 0) * factor;
      addResultant(total, 0, 0, moment, Math.abs(moment));
      continue;
    }

    if (load.type === 'point') {
      const [localFx, localFy] = toLocalVector(load.px ?? 0, load.py ?? 0, load.coordinateSystem, geometry);
      const fxLocal = localFx * factor;
      const fyLocal = localFy * factor;
      const fx = geometry.c * fxLocal - geometry.s * fyLocal;
      const fy = geometry.s * fxLocal + geometry.c * fyLocal;
      const x = Math.min(1, Math.max(0, load.position ?? 0.5)) * geometry.L;
      const mz = faceDx * fy - faceDy * fx + x * fyLocal;
      addResultant(total, fx, fy, mz, Math.abs(faceDx * fy) + Math.abs(faceDy * fx) + Math.abs(x * fyLocal));
      continue;
    }

    const a = Math.min(load.start, load.end) * geometry.L;
    const b = Math.max(load.start, load.end) * geometry.L;
    const scale = lengthBasisScale(load.lengthBasis, geometry) * factor;
    const [qxA0, qyA0] = toLocalVector(load.qxStart ?? 0, load.qyStart ?? 0, load.coordinateSystem, geometry);
    const [qxB0, qyB0] = toLocalVector(load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0, load.coordinateSystem, geometry);
    const axial = linearLoadIntegrals(qxA0 * scale, qxB0 * scale, a, b);
    const transverse = linearLoadIntegrals(qyA0 * scale, qyB0 * scale, a, b);
    const fx = geometry.c * axial.force - geometry.s * transverse.force;
    const fy = geometry.s * axial.force + geometry.c * transverse.force;
    const mz = faceDx * fy - faceDy * fx + transverse.firstMoment;
    addResultant(total, fx, fy, mz, Math.abs(faceDx * fy) + Math.abs(faceDy * fx) + Math.abs(transverse.firstMoment));
  }

  const selfWeightFactor = project.loadCases.reduce(
    (sum, loadCase) => sum + (factors[loadCase.id] ?? 0) * (loadCase.selfWeightFactor ?? 0),
    0,
  );
  if (selfWeightFactor !== 0) {
    for (const member of project.members) {
      if (member.type === 'rigid' || !member.density || !(member.A > 0)) continue;
      const { geometry, startOffset } = deformableGeometryOf(member, nodes);
      const ni = nodes.get(member.i)!;
      const faceDx = (ni.x - referenceX) + geometry.c * startOffset;
      const weight = (member.density * 9.80665 * member.A) / 1000 * selfWeightFactor;
      const fy = -weight * geometry.L;
      const centroidDx = faceDx + geometry.c * geometry.L / 2;
      addResultant(total, 0, fy, centroidDx * fy, Math.abs(centroidDx * fy));
    }
  }
  total.resultant = finalizedResultant(total);
  total.correction = { fx: 0, fy: 0, mz: 0 };
  return total;
};

const constraintKey = (row: number[]): string => {
  const norm = Math.hypot(...row);
  if (norm < EPS) return '';
  const normalized = row.map((value) => Math.abs(value / norm) < 1e-12 ? 0 : value / norm);
  const first = normalized.find((value) => Math.abs(value) > 1e-12) ?? 1;
  const signed = first < 0 ? normalized.map((value) => -value) : normalized;
  return signed.map((value) => value.toFixed(10)).join('|');
};

const toMatrixTrace = (
  matrix: Matrix,
  rowLabels: string[],
  columnLabels: string[],
  detail: 'full' | 'summary' = 'full',
): MatrixTrace => {
  const entries: MatrixTrace['entries'] = [];
  matrix.forEach((row, rowIndex) => {
    if (detail === 'full') {
      row.forEach((value, column) => {
        if (value !== 0) entries.push({ row: rowIndex, column, value });
      });
      return;
    }
    const candidates = row
      .map((value, column) => ({ column, value }))
      .filter((entry) => entry.value !== 0)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const chosen = new Map<number, number>();
    if (row[rowIndex] !== undefined && row[rowIndex] !== 0) chosen.set(rowIndex, row[rowIndex]);
    candidates.slice(0, 4).forEach((entry) => chosen.set(entry.column, entry.value));
    chosen.forEach((value, column) => entries.push({ row: rowIndex, column, value }));
  });
  return { rows: matrix.length, columns: matrix[0]?.length ?? 0, rowLabels, columnLabels, entries };
};

/**
 * Formats one number for the explanation prose and equations.
 *
 * Presentation only: it is applied exclusively to the strings in `ExplanationStep`, never
 * to a stored result. `explanation` also carries `inputs`/`outputs` as raw numbers, and
 * those keep full precision.
 *
 * A value that is zero up to the solver's tolerance is written as `0`. Publishing
 * `-2.93915e-15 kN` as an axial force in a transversally loaded beam states a measurable
 * quantity where there is none, and that text is reproduced verbatim in the PDF report.
 */
const explanationValue = (value: number, reference: number, digits = 5): string => {
  if (!Number.isFinite(value)) return 'n/d';
  const scale = Number.isFinite(reference) ? Math.abs(reference) : 0;
  if (value === 0 || (scale > 0 && Math.abs(value) <= 1e-9 * scale)) return '0';
  return value.toExponential(digits);
};

const explanationSteps = (project: ProjectModel, result: Omit<AnalysisResult, 'explanation'>): ExplanationStep[] => {
  const nodeMap = getNodeMap(project);
  const maxReaction = Math.max(0, ...result.nodeResults.flatMap((node) => [Math.abs(node.rx), Math.abs(node.ry), Math.abs(node.rm)]));
  const maxDisp = Math.max(0, ...result.nodeResults.flatMap((node) => [Math.abs(node.ux), Math.abs(node.uy)]));
  /* A maximum has no larger sibling to be compared against, so displacement is judged
     against the model's own size and reaction against the actions that produced it. */
  const modelSpan = Math.max(
    1,
    ...project.nodes.map((node) => Math.abs(node.x)),
    ...project.nodes.map((node) => Math.abs(node.y)),
  );
  const appliedScale = Math.max(
    ...project.nodalLoads.map((load) => Math.max(Math.abs(load.fx), Math.abs(load.fy), Math.abs(load.mz))),
    ...project.memberLoads.map((load) => Math.max(
      Math.abs(load.qyStart ?? 0), Math.abs(load.qyEnd ?? 0),
      Math.abs(load.qxStart ?? 0), Math.abs(load.qxEnd ?? 0),
      Math.abs(load.px ?? 0), Math.abs(load.py ?? 0), Math.abs(load.moment ?? 0),
    )),
    0,
  );
  const restrainedDofs = project.nodes.reduce((total, node) => {
    if (node.support.type === 'fixed') return total + 3;
    if (node.support.type === 'pin') return total + 2;
    if (node.support.type === 'roller') return total + 1;
    if (node.support.type === 'custom') return total + Number(Boolean(node.support.restrainX)) + Number(Boolean(node.support.restrainY)) + Number(Boolean(node.support.restrainR));
    return total;
  }, 0);
  const steps: ExplanationStep[] = [
    {
      id: 'geometry', category: 'geometry', title: '1. Geometría, nodos y ejes',
      summary: `Se normalizó un modelo con ${project.nodes.length} nodos y ${project.members.length} miembros. +X apunta a la derecha, +Y hacia arriba; cada eje local x va de i hacia j y el eje local y gira 90° en sentido antihorario.`,
      equations: ['ΔX = Xⱼ − Xᵢ', 'ΔY = Yⱼ − Yᵢ', 'L = √(ΔX² + ΔY²)', 'c = ΔX/L', 's = ΔY/L'],
      relatedNodeIds: project.nodes.map((node) => node.id), relatedMemberIds: project.members.map((member) => member.id),
    },
    {
      id: 'supports', category: 'geometry', title: '2. Apoyos, resortes y grados de libertad',
      summary: `Cada nodo de marco usa tres grados globales [U_x, U_y, R_z]; en el elemento local se distinguen [u, v, theta]. Se detectaron ${restrainedDofs} restricciones nodales explícitas. Los rodillos se restringen en su dirección normal y los resortes se ensamblan en la dirección definida por el usuario.`,
      equations: ['d_global,n = [U_x  U_y  R_z]^T', 'K_s = k n n^T', 'n = [cos(alpha)  sin(alpha)]^T', 'C U = 0'],
      relatedNodeIds: project.nodes.filter((node) => node.support.type !== 'none' || node.support.spring).map((node) => node.id),
    },
    {
      id: 'loads', category: 'loads', title: '3. Cargas, direcciones y longitud de referencia',
      summary: 'Cada carga se convirtió primero a ejes locales y se integró únicamente en su intervalo declarado [start·L, end·L]. En miembros inclinados, una intensidad por proyección se convirtió a intensidad por longitud real antes de integrar; nunca se sustituyó la longitud real por una proyección.',
      equations: [
        '[qₓ  qᵧ]ᵀ = [c  s; −s  c][qX  qY]ᵀ',
        'a = min(start, end) L; b = max(start, end) L',
        'wreal = whorizontal |c|',
        'wreal = wvertical |s|',
        'W = ∫ₐᵇ w(x) dx',
      ],
      relatedMemberIds: [...new Set(project.memberLoads.map((load) => load.memberId))],
      relatedNodeIds: [...new Set(project.nodalLoads.map((load) => load.nodeId))],
    },
    {
      id: 'equivalent-loads', category: 'loads', title: '4. Vectores nodales consistentes',
      summary: 'Las cargas puntuales, uniformes, triangulares, trapezoidales y parciales se integraron con las mismas funciones de forma usadas por el elemento. Esto conserva fuerza, momento y trabajo virtual.',
      equations: [
        'fₑˡ = ∫ₐᵇ Nᵀ(x) p(x) dx',
        'q uniforme transversal → [0, qL/2, qL²/12, 0, qL/2, −qL²/12]ᵀ',
        'P transversal en ξ → P[0, N₁, N₂, 0, N₃, N₄]ᵀ',
        'M concentrado en ξ → M dNᵀ/dx',
      ],
      relatedMemberIds: [...new Set(project.memberLoads.map((load) => load.memberId))],
    },
    {
      id: 'stiffness', category: 'stiffness', title: '5. Rigidez local de cada elemento',
      summary: 'Los marcos utilizan el elemento Euler–Bernoulli con deformación axial y flexión; las armaduras utilizan exclusivamente rigidez axial. Las liberaciones de momento se condensan exactamente.',
      equations: [
        'dₑˡ = [uᵢ, vᵢ, θᵢ, uⱼ, vⱼ, θⱼ]ᵀ',
        'a = EA/L, b = 12EI/L³, c = 6EI/L², d = 4EI/L, e = 2EI/L',
        'k̄aa = Kaa − Kab Kbb⁻¹ Kba',
        'f̄a = fa − Kab Kbb⁻¹ fb',
      ],
      relatedMemberIds: project.members.filter((member) => member.type !== 'rigid').map((member) => member.id),
    },
    {
      id: 'transform', category: 'stiffness', title: '6. Transformación y ensamblaje global',
      summary: 'Cada contribución local se rotó al sistema global y se sumó en los grados de libertad correspondientes. Los vínculos rígidos se aplicaron mediante compatibilidad cinemática, no mediante rigideces artificialmente grandes.',
      equations: [
        'd_local = T d_global',
        'k_global = T^T k_local T',
        'K = Sum(A_e^T k_global,e A_e)',
        'F = F_nodal + Sum(A_e^T f_global,e)',
        '[K  C^T; C  0][U; lambda] = [F; g]',
      ],
      relatedMemberIds: project.members.map((member) => member.id),
    },
    {
      id: 'solution', category: 'stiffness', title: '7. Solución de desplazamientos y reacciones',
      summary: `Se resolvió el sistema restringido con equilibrado simétrico, factorización LU con pivoteo escalado y refinamiento por residuo. El desplazamiento traslacional máximo fue ${explanationValue(maxDisp, modelSpan, 4)} m y la reacción de mayor magnitud fue ${explanationValue(maxReaction, appliedScale, 4)} en unidades base.`,
      equations: ['D A D y = D b', 'x = D y', 'A = [K  Cᵀ; C  0]', 'Rsoporte = −Csoporteᵀ λ', 'Rresorte = −Ks U'],
      outputs: [
        { label: 'Residuo normalizado', value: result.residualNorm, unit: '—' },
        { label: 'κ₁ estimada (sistema escalado)', value: result.conditionEstimate, unit: '—' },
        { label: 'Residuo lineal relativo', value: result.linearResidual ?? Number.NaN, unit: '—' },
      ],
      relatedNodeIds: project.nodes.map((node) => node.id),
    },
  ];

  const memberSteps = project.members.filter((member) => member.type !== 'rigid').map((member, index): ExplanationStep => {
    const ni = nodeMap.get(member.i)!;
    const nj = nodeMap.get(member.j)!;
    const dx = nj.x - ni.x;
    const dy = nj.y - ni.y;
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const s = dy / L;
    const memberResult = result.memberResults.find((item) => item.memberId === member.id);
    const endForces = memberResult?.localEndForces ?? [];
    return {
      id: `member-${member.id}`,
      category: 'results',
      title: `${8 + index}. Miembro ${member.id}: recuperación local`,
      summary: `${member.type === 'truss' ? 'Barra de armadura' : 'Elemento de marco'} desde ${member.i} hasta ${member.j}; L = ${L.toFixed(6)} m, c = ${c.toFixed(6)}, s = ${s.toFixed(6)}.`,
      equations: member.type === 'truss'
        ? ['N = EA/L [−1  1] dˡaxial', `N = ${explanationValue(memberResult?.diagram[0]?.axial ?? 0, maxReaction, 6)} kN (${memberResult?.trussState ?? 'sin clasificar'})`]
        : [
            'qₑˡ = kₑˡ dₑˡ − fₑˡ',
            // Compared against the largest component of this member's own vector: a
            // component that is 1e-16 of its neighbours is nothing, not a small force.
            `qₑˡ = [${endForces.map((value) => explanationValue(value, Math.max(...endForces.map(Math.abs)), 5)).join(', ')}]ᵀ`,
            'N positivo = tensión; M positivo = sagante en el diagrama.',
          ],
      relatedMemberIds: [member.id],
      relatedNodeIds: [member.i, member.j],
    };
  });
  steps.push(...memberSteps);

  steps.push(
    {
      id: 'diagrams', category: 'results', title: `${8 + memberSteps.length}. Diagramas exactos por tramos`,
      summary: 'Se localizaron extremos de cargas, fuerzas y momentos puntuales. En cada tramo se construyeron polinomios exactos y se obtuvieron ceros, saltos y extremos sin interpolar una nube de puntos.',
      equations: ['dN/dx = −pₓ(x)', 'dV/dx = pᵧ(x)', 'dM/dx = V(x)', 'V = 0 → candidato a extremo de M', 'ΔV = Pᵧ', 'ΔM = −Mpuntual'],
      relatedMemberIds: result.memberResults.map((member) => member.memberId),
    },
    {
      id: 'deformation', category: 'results', title: `${9 + memberSteps.length}. Forma deformada compatible`,
      summary: 'La deformada se integró a partir de N/EA y M/EI en cada tramo y se comparó con los desplazamientos nodales obtenidos por el sistema global.',
      equations: ['du/dx = N/EA', 'dθ/dx = M/EI', 'dv/dx = θ'],
      relatedMemberIds: result.memberResults.map((member) => member.memberId),
    },
    {
      id: 'verification', category: 'verification', title: `${10 + memberSteps.length}. Equilibrio y comprobaciones`,
      summary: `El residuo algebraico fue ${result.residualNorm.toExponential(3)}. Las cargas fuente se reintegraron por dos rutas independientes: estática global y trabajo virtual sobre los seis GDL locales de cada miembro. El equilibrio físico normalizado es ${result.equilibrium.normalizedResidual.toExponential(3)}.`,
      equations: ['r = K U + C^T lambda - F', '||r||inf / max(1, ||F||inf)', 'f_source = integral(N^T q dx) + sum(N^T P) + sum(N_theta^T M)', 'Delta f_member = f_assembled - f_source', 'Sum Fx = 0', 'Sum Fy = 0', 'Sum M_O = 0'],
      outputs: [
        { label: 'ΣFx', value: result.equilibrium.sumFx, unit: 'kN' },
        { label: 'ΣFy', value: result.equilibrium.sumFy, unit: 'kN' },
        { label: 'ΣM', value: result.equilibrium.sumM, unit: 'kN·m' },
        { label: 'Residuo equilibrio físico', value: result.equilibrium.normalizedResidual, unit: '—' },
        { label: 'Residuo de resultantes de carga', value: result.loadAudit?.resultantResidual ?? Number.NaN, unit: '—' },
        { label: 'Residuo cargas fuente/ensamblaje', value: result.loadAudit?.normalizedResidual ?? Number.NaN, unit: '—' },
      ],
    },
  );
  return steps;
};

/** Result of a run that never reached a usable solution; always classified `failed`. */
const abortedResult = abortedAnalysis;

/**
 * `pDeltaAxialForces` is an internal hook used by `analyzeProjectPDelta`
 * (`./pDelta.ts`) to fold each frame member's current axial force into its
 * local stiffness before condensation, iteration over iteration. Every
 * ordinary caller omits it and gets today's first-order behavior unchanged.
 */
export interface AnalyzeProjectOptions {
  pDeltaAxialForces?: Map<string, number>;
  includeEducationTrace?: boolean;
  /** Internal run-wide policy; P-Delta uses `dense` to stay isolated from sparse. */
  linearBackend?: LinearSolverPolicy;
}

export const analyzeProject = (
  project: ProjectModel,
  combination?: LoadCombination | null,
  options?: AnalyzeProjectOptions,
): AnalysisResult => {
  const issues = validateProject(project);
  if (issues.some((issue) => issue.severity === 'error')) {
    return abortedResult(issues);
  }
  // Building `educationTrace` means scanning the full ndof×ndof stiffness and
  // constraint matrices cell by cell — AG-011 measured that at 58-64% of total
  // analysis time on ~300-member models, far more than the actual linear solve.
  // It is a purely presentational/educational artifact (never read by the
  // solution vector, diagrams, audits or reliability classification below), so
  // every caller that does not show it can skip building it. Defaults to `true`
  // so every existing caller — tests, PDF export, the "Aprender" tab — keeps
  // seeing it unless it explicitly opts out for an interactive/discarded run.
  const includeEducationTrace = options?.includeEducationTrace ?? true;

  // Every first-order-geometry audit below (global equilibrium, load audit,
  // per-member diagram closure) compares against the *undeformed* geometry;
  // a converged P-Delta run correctly departs from that by its own P·Δ
  // second-order moment, so those checks are informational, never blocking,
  // while this run has geometric stiffness active.
  // An empty map (a project with no `frame` members at all) means geometric
  // stiffness can never contribute anything to this run; relaxing the
  // first-order equilibrium checks for it would hide a genuine assembly bug
  // behind a P-Delta explanation that does not actually apply.
  const pDeltaActive = Boolean(options?.pDeltaAxialForces?.size);
  let mechanism: NonNullable<AnalysisResult['mechanism']> | undefined;
  try {
    const assemblyStart = profileStart();
    const nodes = getNodeMap(project);
    const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
    const ndof = project.nodes.length * 3;
    const dofLabels = project.nodes.flatMap((node) => [`${node.id}.Ux`, `${node.id}.Uy`, `${node.id}.Rz`]);
    const K = zeros(ndof, ndof);
    const F = Array(ndof).fill(0);
    const factors = selectedFactors(project, combination);
    const selectedSelfWeightFactor = project.loadCases.reduce(
      (sum, loadCase) => sum + (factors[loadCase.id] ?? 0) * (loadCase.selfWeightFactor ?? 0),
      0,
    );
    if (selectedSelfWeightFactor !== 0) {
      project.members.filter((member) => member.type === 'truss' && member.density && member.A > 0).forEach((member) => {
        const nodeI = nodes.get(member.i)!;
        const nodeJ = nodes.get(member.j)!;
        const grossLength = Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y);
        const transverseProjection = grossLength > EPS ? Math.abs((nodeJ.x - nodeI.x) / grossLength) : 0;
        if (transverseProjection <= 1e-12) return;
        issues.push({
          id: `truss-self-weight-${member.id}`,
          severity: 'error',
          title: 'Peso propio distribuido en una armadura',
          message: `El miembro ${member.id} es de dos fuerzas y su peso propio tiene una componente transversal que no puede representarse como carga de barra.`,
          objectId: member.id,
          suggestedFix: 'Divide la armadura en paneles y aplica el peso propio como cargas nodales equivalentes.',
        });
      });
      if (issues.some((issue) => issue.severity === 'error')) {
        return abortedResult(issues);
      }
    }
    const prescribedByNode = resolvePrescribedDisplacements(project, factors);
    const elementAssemblies: ElementAssembly[] = [];

    for (const load of project.nodalLoads) {
      const factor = factors[load.caseId] ?? 0;
      const index = nodeIndex.get(load.nodeId);
      if (index === undefined || factor === 0) continue;
      F[index * 3] += load.fx * factor;
      F[index * 3 + 1] += load.fy * factor;
      F[index * 3 + 2] += load.mz * factor;
    }

    for (const member of project.members) {
      if (member.type === 'rigid') continue;
      const { geometry, grossLength, startOffset, endOffset } = deformableGeometryOf(member, nodes);
      const iIndex = nodeIndex.get(member.i);
      const jIndex = nodeIndex.get(member.j);
      if (iIndex === undefined || jIndex === undefined) continue;
      const indices = [iIndex * 3, iIndex * 3 + 1, iIndex * 3 + 2, jIndex * 3, jIndex * 3 + 1, jIndex * 3 + 2];
      const transform = rigidOffsetTransform(geometry, startOffset, endOffset);
      const elasticStiffness = member.type === 'truss' ? trussLocalStiffness(member, geometry.L) : frameLocalStiffness(member, geometry.L);
      // Geometric stiffness only applies to bending (frame) members: a truss
      // member has no transverse DOFs to soften/stiffen, and a rigid member
      // never reaches this loop (it is a pure kinematic constraint, see below).
      const pDeltaAxialForce = member.type === 'frame' ? options?.pDeltaAxialForces?.get(member.id) : undefined;
      const localStiffnessOriginal = pDeltaAxialForce
        ? (() => {
            const kg = geometricStiffness(geometry.L, pDeltaAxialForce);
            return elasticStiffness.map((row, i) => row.map((value, j) => value + kg[i][j]));
          })()
        : elasticStiffness;
      const localLoads = resolveMemberLocalLoads(project, member.id, combination).loads;
      const initialEffect = resolveMemberInitialEffect(project, member.id, combination);
      const mechanicalEquivalentLoad = equivalentNodalLoad(localLoads, geometry.L, member);
      const initialEquivalentLoad = initialEffectEquivalentLoad(member, initialEffect.axialStrain, member.type === 'frame' ? initialEffect.curvature : 0);
      const localLoadOriginal = mechanicalEquivalentLoad.map((value, index) => value + initialEquivalentLoad[index]);
      const releaseI = member.type === 'frame' && Boolean(member.releases?.iMoment || nodes.get(member.i)?.internalHinge);
      const releaseJ = member.type === 'frame' && Boolean(member.releases?.jMoment || nodes.get(member.j)?.internalHinge);
      const condensed = member.type === 'frame'
        ? condenseConnections(localStiffnessOriginal, localLoadOriginal, member, releaseI, releaseJ, options?.linearBackend)
        : { stiffness: localStiffnessOriginal, load: localLoadOriginal, released: [] };
      const globalStiffness = multiply(multiply(transpose(transform), condensed.stiffness), transform);
      const globalLoad = multiplyMatrixVector(transpose(transform), condensed.load);
      addToMatrix(K, globalStiffness, indices);
      addToVector(F, globalLoad, indices);
      elementAssemblies.push({
        member, geometry, grossLength, startOffset, endOffset, indices, transform,
        localStiffnessOriginal,
        localStiffnessEffective: condensed.stiffness,
        mechanicalEquivalentLoad,
        initialEquivalentLoad,
        localLoadOriginal,
        localLoadEffective: condensed.load,
        loads: localLoads,
        released: condensed.released,
        initialAxialStrain: initialEffect.axialStrain,
        initialCurvature: member.type === 'frame' ? initialEffect.curvature : 0,
        globalStiffness,
        globalLoad,
        connectionRecovery: condensed.recovery,
      });
    }

    // Springs are assembled directly in global coordinates.
    for (const node of project.nodes) {
      const index = nodeIndex.get(node.id)! * 3;
      const spring = node.support.spring;
      if (!spring) continue;
      if (spring.kx) K[index][index] += spring.kx;
      if (spring.ky) K[index + 1][index + 1] += spring.ky;
      if (spring.kr) K[index + 2][index + 2] += spring.kr;
      if (spring.kNormal) {
        const angle = ((spring.angleDeg ?? 90) * Math.PI) / 180;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        K[index][index] += spring.kNormal * nx * nx;
        K[index][index + 1] += spring.kNormal * nx * ny;
        K[index + 1][index] += spring.kNormal * nx * ny;
        K[index + 1][index + 1] += spring.kNormal * ny * ny;
      }
    }

    type ConstraintKind = 'support' | 'bookkeeping' | 'rigid';
    interface ConstraintDefinition { row: number[]; kind: ConstraintKind; nodeId?: string; value: number }
    const constraints: ConstraintDefinition[] = [];
    const addConstraint = (terms: Array<[number, number]>, kind: ConstraintKind, nodeId?: string, value = 0) => {
      const row = Array(ndof).fill(0);
      terms.forEach(([index, coefficient]) => { row[index] += coefficient; });
      constraints.push({ row, kind, nodeId, value });
    };

    for (const node of project.nodes) {
      const base = nodeIndex.get(node.id)! * 3;
      const support = node.support;
      const prescribed = prescribedByNode.get(node.id);
      if (support.type === 'fixed') {
        addConstraint([[base, 1]], 'support', node.id, prescribed?.ux ?? 0); addConstraint([[base + 1, 1]], 'support', node.id, prescribed?.uy ?? 0); addConstraint([[base + 2, 1]], 'support', node.id, prescribed?.rz ?? 0);
      } else if (support.type === 'pin') {
        addConstraint([[base, 1]], 'support', node.id, prescribed?.ux ?? 0); addConstraint([[base + 1, 1]], 'support', node.id, prescribed?.uy ?? 0);
      } else if (support.type === 'roller') {
        const angle = ((support.angleDeg ?? 90) * Math.PI) / 180;
        addConstraint([[base, Math.cos(angle)], [base + 1, Math.sin(angle)]], 'support', node.id, prescribed?.normal ?? 0);
      } else if (support.type === 'custom') {
        if (support.restrainX) addConstraint([[base, 1]], 'support', node.id, prescribed?.ux ?? 0);
        if (support.restrainY) addConstraint([[base + 1, 1]], 'support', node.id, prescribed?.uy ?? 0);
        if (support.restrainR) addConstraint([[base + 2, 1]], 'support', node.id, prescribed?.rz ?? 0);
      }
    }

    // Free drafting nodes that do not belong to any member are not structural
    // degrees of freedom. Keep them in the result ordering, but constrain their
    // three empty rows so they cannot masquerade as a mechanism.
    const participatingNodeIds = new Set(project.members.flatMap((member) => [member.i, member.j]));
    for (const node of project.nodes) {
      if (participatingNodeIds.has(node.id)) continue;
      const base = nodeIndex.get(node.id)! * 3;
      addConstraint([[base, 1]], 'bookkeeping', node.id);
      addConstraint([[base + 1, 1]], 'bookkeeping', node.id);
      addConstraint([[base + 2, 1]], 'bookkeeping', node.id);
    }

    // Rotations that do not participate in any element (truss nodes or fully
    // released frame ends) are bookkeeping DOFs. Determine participation from
    // topology instead of comparing EI against the largest (often axial) term.
    for (const node of project.nodes) {
      const supportRestrainsRotation = node.support.type === 'fixed' || (node.support.type === 'custom' && Boolean(node.support.restrainR));
      const nodalSpringParticipatesInRotation = (node.support.spring?.kr ?? 0) > 0;
      const participatesInRotation = project.members.some((member) => {
        if (member.i !== node.id && member.j !== node.id) return false;
        if (member.type === 'rigid') return true;
        if (node.internalHinge) return false;
        return frameEndTransfersRotation(member, node.id);
      });
      const rotationIndex = nodeIndex.get(node.id)! * 3 + 2;
      if (!supportRestrainsRotation && !nodalSpringParticipatesInRotation && !participatesInRotation) addConstraint([[rotationIndex, 1]], 'bookkeeping', node.id);
    }

    // Exact rigid-link kinematic constraints.
    for (const member of project.members.filter((item) => item.type === 'rigid')) {
      const ni = nodes.get(member.i)!;
      const nj = nodes.get(member.j)!;
      const ii = nodeIndex.get(member.i)! * 3;
      const ji = nodeIndex.get(member.j)! * 3;
      const dx = nj.x - ni.x;
      const dy = nj.y - ni.y;
      addConstraint([[ji, 1], [ii, -1], [ii + 2, dy]], 'rigid');
      addConstraint([[ji + 1, 1], [ii + 1, -1], [ii + 2, -dx]], 'rigid');
      addConstraint([[ji + 2, 1], [ii + 2, -1]], 'rigid');
    }

    // Remove exact duplicate constraints to avoid an artificial singularity.
    const uniqueConstraintMap = new Map<string, ConstraintDefinition>();
    constraints.forEach((definition) => {
      const key = constraintKey(definition.row);
      // Supports are added first and take precedence over bookkeeping duplicates.
      if (!key) return;
      const existing = uniqueConstraintMap.get(key);
      if (!existing) {
        uniqueConstraintMap.set(key, definition);
        return;
      }
      const normalizedValue = (item: ConstraintDefinition) => {
        const norm = Math.hypot(...item.row);
        const first = item.row.find((value) => Math.abs(value) > EPS) ?? 1;
        return item.value / norm * (first < 0 ? -1 : 1);
      };
      const a = normalizedValue(existing);
      const bValue = normalizedValue(definition);
      if (Math.abs(a - bValue) > 1e-10 * Math.max(1, Math.abs(a), Math.abs(bValue))) {
        throw new Error(`Existen restricciones cinemáticas incompatibles${definition.nodeId ? ` en el nodo ${definition.nodeId}` : ''}.`);
      }
    });
    const independentConstraints: ConstraintDefinition[] = [];
    const orthogonalConstraintBasis: Array<{ row: number[]; value: number }> = [];
    for (const definition of uniqueConstraintMap.values()) {
      const norm = Math.hypot(...definition.row);
      if (!(norm > 0)) continue;
      const residualRow = definition.row.map((value) => value / norm);
      let residualValue = definition.value / norm;
      // Re-orthogonalize once: rigid-link loops can be exactly dependent but
      // contain translations and rotations with very different coefficients.
      for (let pass = 0; pass < 2; pass += 1) {
        for (const basis of orthogonalConstraintBasis) {
          const projection = residualRow.reduce((sum, value, index) => sum + value * basis.row[index], 0);
          if (Math.abs(projection) <= Number.EPSILON) continue;
          residualRow.forEach((value, index) => { residualRow[index] = value - projection * basis.row[index]; });
          residualValue -= projection * basis.value;
        }
      }
      const residualNorm = Math.hypot(...residualRow);
      const dependenceTolerance = 1e-10 * Math.max(1, Math.sqrt(ndof));
      if (residualNorm <= dependenceTolerance) {
        if (Math.abs(residualValue) > 1e-9 * Math.max(1, Math.abs(definition.value / norm))) {
          throw new Error(`Existen restricciones cinemáticas incompatibles${definition.nodeId ? ` en el nodo ${definition.nodeId}` : ''}.`);
        }
        continue;
      }
      orthogonalConstraintBasis.push({ row: residualRow.map((value) => value / residualNorm), value: residualValue / residualNorm });
      independentConstraints.push(definition);
    }
    const constraintDefinitions = independentConstraints;
    const C = constraintDefinitions.map((definition) => definition.row);
    const groundingIssue = getEvidentGroundingIssue(project);
    if (groundingIssue) {
      issues.push(groundingIssue);
      return abortedResult(issues);
    }

    const naug = ndof + C.length;
    const A = zeros(naug, naug);
    const b = Array(naug).fill(0);
    for (let i = 0; i < ndof; i += 1) {
      b[i] = F[i];
      for (let j = 0; j < ndof; j += 1) A[i][j] = K[i][j];
    }
    C.forEach((row, r) => {
      b[ndof + r] = constraintDefinitions[r].value;
      for (let j = 0; j < ndof; j += 1) {
        A[j][ndof + r] = row[j];
        A[ndof + r][j] = row[j];
      }
    });

    // Symmetric diagonal equilibration preserves the symmetry of the saddle-point
    // system while reducing contrasts between translations, rotations and multipliers.
    // With x = D y: A x = b -> D A D y = D b.
    const diagonalScale = A.map((row) => 1 / Math.sqrt(Math.max(...row.map(Math.abs), Number.MIN_VALUE)));
    const scaledA = A.map((row, i) => row.map((value, j) => value * diagonalScale[i] * diagonalScale[j]));
    const scaledB = b.map((value, i) => value * diagonalScale[i]);
    profileEnd('assembly', assemblyStart);
    let solved: ReturnType<typeof solveLinearSystem>;
    const linearSolveStart = profileStart();
    try {
      solved = solveLinearSystem(scaledA, scaledB, { backend: options?.linearBackend });
    } catch (error) {
      const nullSpace = findNullSpaceVector(scaledA, ndof);
      if (nullSpace.vector) {
        const physicalMode = nullSpace.vector.slice(0, ndof).map((value, index) => value * diagonalScale[index]);
        const xs = project.nodes.map((node) => node.x);
        const ys = project.nodes.map((node) => node.y);
        const characteristicLength = Math.max(
          1,
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        );
        const rawNodes = project.nodes.map((node, index) => {
          const ux = physicalMode[index * 3];
          const uy = physicalMode[index * 3 + 1];
          const rz = physicalMode[index * 3 + 2];
          const weighted = [Math.abs(ux), Math.abs(uy), Math.abs(rz) * characteristicLength];
          const dominantIndex = weighted.indexOf(Math.max(...weighted));
          return {
            nodeId: node.id,
            ux,
            uy,
            rz,
            amplitude: Math.hypot(ux, uy, characteristicLength * rz),
            dominantDof: (['Ux', 'Uy', 'Rz'] as const)[dominantIndex],
          };
        });
        const maximumAmplitude = Math.max(Number.MIN_VALUE, ...rawNodes.map((node) => node.amplitude));
        mechanism = {
          nullity: nullSpace.nullity,
          residual: nullSpace.residual,
          nodes: rawNodes
            .map(({ amplitude, ...node }) => ({ ...node, normalizedAmplitude: amplitude / maximumAmplitude }))
            .filter((node) => node.normalizedAmplitude > 1e-6)
            .sort((a, b) => b.normalizedAmplitude - a.normalizedAmplitude),
        };
      }
      throw error;
    }
    profileEnd('linearSolve', linearSolveStart);
    const solution = solved.x.map((value, index) => value * diagonalScale[index]);
    const U = solution.slice(0, ndof);
    const lambda = solution.slice(ndof);

    const KU = multiplyMatrixVector(K, U);
    const hardSupportReactions = Array(ndof).fill(0);
    constraintDefinitions.forEach((definition, constraintIndex) => {
      if (definition.kind !== 'support') return;
      definition.row.forEach((coefficient, dof) => {
        // K U + Cᵀλ = F, therefore the physical support reaction is −Cᵀλ.
        hardSupportReactions[dof] -= coefficient * lambda[constraintIndex];
      });
    });
    const constraintForces = Array(ndof).fill(0);
    for (let r = 0; r < C.length; r += 1) {
      for (let i = 0; i < ndof; i += 1) constraintForces[i] += C[r][i] * lambda[r];
    }
    const equilibriumResidual = KU.map((value, i) => {
      let constraintContribution = 0;
      for (let r = 0; r < C.length; r += 1) constraintContribution += C[r][i] * lambda[r];
      return value + constraintContribution - F[i];
    });
    const residualNorm = maxAbs(equilibriumResidual) / Math.max(
      1,
      maxAbs(KU) + maxAbs(constraintForces) + maxAbs(F),
    );
    const constraintResidual = C.reduce((maximum, row, index) => {
      const actual = row.reduce((sum, coefficient, dof) => sum + coefficient * U[dof], 0);
      const scale = Math.max(1, Math.abs(constraintDefinitions[index].value), row.reduce((sum, coefficient, dof) => sum + Math.abs(coefficient * U[dof]), 0));
      return Math.max(maximum, Math.abs(actual - constraintDefinitions[index].value) / scale);
    }, 0);

    if (residualNorm > 1e-7) {
      issues.push({ id: 'residual', severity: 'warning', title: 'Residuo numérico elevado', message: `El residuo normalizado es ${residualNorm.toExponential(3)}. Revisa unidades y rigideces extremas.` });
    }
    if (constraintResidual > 1e-9) {
      issues.push({ id: 'constraint-residual', severity: 'warning', title: 'Compatibilidad de restricciones limitada', message: `El residuo normalizado C·U−g es ${constraintResidual.toExponential(3)}. Revisa asentamientos y vínculos cinemáticos.` });
    }
    if (solved.conditionEstimate > 1e12) {
      issues.push({ id: 'condition', severity: 'warning', title: 'Modelo mal condicionado', message: `La estimación κ₁ del sistema equilibrado es ${solved.conditionEstimate.toExponential(3)}. Existen dependencias o rigideces con órdenes de magnitud muy diferentes; interpreta los resultados con precaución.` });
    }
    if (solved.relativeResidual > 1e-12) {
      issues.push({ id: 'linear-residual', severity: 'warning', title: 'Precisión limitada del sistema lineal', message: `El residuo relativo del sistema equilibrado es ${solved.relativeResidual.toExponential(3)} después de ${solved.refinementIterations} iteraciones de refinamiento.` });
    }

    const nodeResults: NodeResult[] = project.nodes.map((node, index) => {
      const ux = U[index * 3];
      const uy = U[index * 3 + 1];
      const rz = U[index * 3 + 2];
      let rx = hardSupportReactions[index * 3];
      let ry = hardSupportReactions[index * 3 + 1];
      let rm = hardSupportReactions[index * 3 + 2];
      const spring = node.support.spring;
      if (spring) {
        rx -= (spring.kx ?? 0) * ux;
        ry -= (spring.ky ?? 0) * uy;
        rm -= (spring.kr ?? 0) * rz;
        if (spring.kNormal) {
          const angle = ((spring.angleDeg ?? 90) * Math.PI) / 180;
          const nx = Math.cos(angle);
          const ny = Math.sin(angle);
          const normalDisplacement = nx * ux + ny * uy;
          rx -= spring.kNormal * normalDisplacement * nx;
          ry -= spring.kNormal * normalDisplacement * ny;
        }
      }
      const supportAngle = ((node.support.angleDeg ?? 90) * Math.PI) / 180;
      const nx = Math.cos(supportAngle);
      const ny = Math.sin(supportAngle);
      return {
        nodeId: node.id,
        ux,
        uy,
        rz,
        rx,
        ry,
        rm,
        supportNormalReaction: node.support.type === 'roller' ? rx * nx + ry * ny : undefined,
        supportTangentialReaction: node.support.type === 'roller' ? -rx * ny + ry * nx : undefined,
      };
    });

    const coordinateXs = project.nodes.map((node) => node.x);
    const coordinateYs = project.nodes.map((node) => node.y);
    const minimumX = coordinateXs.length ? Math.min(...coordinateXs) : 0;
    const maximumX = coordinateXs.length ? Math.max(...coordinateXs) : 0;
    const minimumY = coordinateYs.length ? Math.min(...coordinateYs) : 0;
    const maximumY = coordinateYs.length ? Math.max(...coordinateYs) : 0;
    // Canonical, order-independent origin with short moment arms.
    const referenceX = minimumX + (maximumX - minimumX) / 2;
    const referenceY = minimumY + (maximumY - minimumY) / 2;
    const sourceActions = sourceActionResultant(project, factors, nodes, referenceX, referenceY);
    const assembledAccumulator = emptyResultantAccumulator();
    project.nodes.forEach((node, index) => {
      const base = index * 3;
      const dx = node.x - referenceX;
      const dy = node.y - referenceY;
      const fx = F[base];
      const fy = F[base + 1];
      const nodalMoment = F[base + 2];
      addResultant(
        assembledAccumulator,
        fx,
        fy,
        nodalMoment + dx * fy - dy * fx,
        Math.abs(nodalMoment) + Math.abs(dx * fy) + Math.abs(dy * fx),
      );
    });
    const assembledActions = finalizedResultant(assembledAccumulator);
    const assembledActivity: GlobalResultant = {
      fx: assembledAccumulator.absoluteFx,
      fy: assembledAccumulator.absoluteFy,
      mz: assembledAccumulator.absoluteMoment,
    };
    const loadDifference: GlobalResultant = {
      fx: assembledActions.fx - sourceActions.resultant.fx,
      fy: assembledActions.fy - sourceActions.resultant.fy,
      mz: assembledActions.mz - sourceActions.resultant.mz,
    };
    const loadForceFamilyActivity = sourceActions.absoluteFx + sourceActions.absoluteFy + assembledActivity.fx + assembledActivity.fy;
    const loadMomentFamilyActivity = sourceActions.absoluteMoment + assembledActivity.mz;
    const normalizedDifference: GlobalResultant = {
      fx: normalizedActivityResidual(loadDifference.fx, sourceActions.absoluteFx + assembledActivity.fx, loadForceFamilyActivity),
      fy: normalizedActivityResidual(loadDifference.fy, sourceActions.absoluteFy + assembledActivity.fy, loadForceFamilyActivity),
      mz: normalizedActivityResidual(loadDifference.mz, loadMomentFamilyActivity, loadMomentFamilyActivity),
    };
    const resultantResidual = Math.max(normalizedDifference.fx, normalizedDifference.fy, normalizedDifference.mz);
    const memberAuditStart = profileStart();
    const memberAudits = elementAssemblies.map((assembly) => {
      const independent = integrateIndependentMemberSourceLoads(project, assembly.member, factors);
      const sourceMechanical = independent?.mechanical ?? Array(6).fill(Number.NaN);
      const sourceInitial = independent?.initial ?? Array(6).fill(Number.NaN);
      const source = independent?.total ?? Array(6).fill(Number.NaN);
      const mechanical = compareGeneralizedLoads(sourceMechanical, [...assembly.mechanicalEquivalentLoad], independent?.mechanicalActivity ?? []);
      const initial = compareGeneralizedLoads(sourceInitial, [...assembly.initialEquivalentLoad], independent?.initialActivity ?? []);
      const total = compareGeneralizedLoads(source, [...assembly.localLoadOriginal], independent?.totalActivity ?? []);
      const lengthSource = independent?.geometry.length ?? Number.NaN;
      const lengthResidual = Math.abs(lengthSource - assembly.geometry.L) / Math.max(1e-12, Math.abs(lengthSource), Math.abs(assembly.geometry.L));
      return {
        memberId: assembly.member.id,
        flexibleLength: { source: lengthSource, assembled: assembly.geometry.L, normalizedResidual: lengthResidual },
        mechanical,
        initial,
        source: total.source,
        assembled: total.assembled,
        difference: total.difference,
        normalizedResidual: Math.max(lengthResidual, mechanical.normalizedResidual, initial.normalizedResidual, total.normalizedResidual),
      };
    });
    const criticalMemberAudit = memberAudits.reduce<typeof memberAudits[number] | undefined>(
      (critical, audit) => !critical || audit.normalizedResidual > critical.normalizedResidual ? audit : critical,
      undefined,
    );
    const loadAudit: LoadAudit = {
      referencePoint: { x: referenceX, y: referenceY },
      source: sourceActions.resultant,
      assembled: assembledActions,
      difference: loadDifference,
      normalizedDifference,
      resultantResidual,
      memberAudits,
      normalizedResidual: Math.max(resultantResidual, criticalMemberAudit?.normalizedResidual ?? 0),
    };
    profileEnd('auditAndReliability', memberAuditStart);
    if (loadAudit.normalizedResidual > 1e-8) {
      issues.push({
        id: 'load-assembly-audit',
        severity: 'error',
        title: 'Las cargas fuente no coinciden con el ensamblaje',
        message: `La estática global o el trabajo virtual por miembro difiere del vector nodal equivalente (residuo global ${resultantResidual.toExponential(3)}; máximo por miembro ${(criticalMemberAudit?.normalizedResidual ?? 0).toExponential(3)}${criticalMemberAudit ? ` en ${criticalMemberAudit.memberId}` : ''}).`,
        suggestedFix: 'No uses los resultados: revisa el intervalo, los ejes y la conversión de cargas de miembro.',
      });
    } else if (loadAudit.normalizedResidual > 1e-10) {
      issues.push({
        id: 'load-assembly-audit',
        severity: 'warning',
        title: 'Precisión limitada en el ensamblaje de cargas',
        message: `La auditoría independiente produjo un residuo de ${loadAudit.normalizedResidual.toExponential(3)}.`,
        suggestedFix: 'Revisa escalas extremas, intervalos muy cortos y cancelaciones entre casos de carga.',
      });
    }

    const elementTraces: ElementTrace[] = [];
    let memberStrainEnergy = 0;
    const memberResults: MemberResult[] = elementAssemblies.map((assembly) => {
      const globalD = assembly.indices.map((index) => U[index]);
      const nodalLocalD = multiplyMatrixVector(assembly.transform, globalD);
      const localD = recoverConnectedDisplacements(assembly, nodalLocalD, options?.linearBackend);
      const localEndForces = multiplyMatrixVector(assembly.localStiffnessOriginal, localD)
        .map((value, index) => value - assembly.localLoadOriginal[index]);
      assembly.released.forEach((index) => { localEndForces[index] = 0; });
      if (includeEducationTrace) {
        const localLabels = [`${assembly.member.id}.ui`, `${assembly.member.id}.vi`, `${assembly.member.id}.θi`, `${assembly.member.id}.uj`, `${assembly.member.id}.vj`, `${assembly.member.id}.θj`];
        const elementTraceStart = profileStart();
        elementTraces.push({
          memberId: assembly.member.id,
          dofIndices: [...assembly.indices],
          dofLabels: assembly.indices.map((index) => dofLabels[index]),
          length: assembly.geometry.L,
          grossLength: assembly.grossLength,
          c: assembly.geometry.c,
          s: assembly.geometry.s,
          releasedLocalDofs: [...assembly.released],
          transformation: toMatrixTrace(assembly.transform, localLabels, assembly.indices.map((index) => dofLabels[index])),
          localStiffnessOriginal: toMatrixTrace(assembly.localStiffnessOriginal, localLabels, localLabels),
          localStiffnessEffective: toMatrixTrace(assembly.localStiffnessEffective, localLabels, localLabels),
          globalStiffnessContribution: toMatrixTrace(assembly.globalStiffness, assembly.indices.map((index) => dofLabels[index]), assembly.indices.map((index) => dofLabels[index])),
          localEquivalentLoadOriginal: [...assembly.localLoadOriginal],
          localEquivalentLoadEffective: [...assembly.localLoadEffective],
          globalEquivalentLoadContribution: [...assembly.globalLoad],
          globalDisplacements: [...globalD],
          localDisplacements: [...localD],
          localEndForces: [...localEndForces],
        });
        profileEnd('educationTrace', elementTraceStart);
      }
      const diagramsStart = profileStart();
      const exact = buildExactDiagrams(localEndForces, assembly.loads, assembly.geometry.L);
      profileEnd('diagrams', diagramsStart);
      const EA = assembly.member.E * assembly.member.A;
      const EI = assembly.member.E * assembly.member.I;
      const shearRigidity = assembly.member.beamTheory === 'timoshenko'
        ? (assembly.member.G ?? 0) * (assembly.member.shearArea ?? 0)
        : Number.POSITIVE_INFINITY;
      for (const segment of exact.segments) {
        const length = segment.x1 - segment.x0;
        memberStrainEnergy += integratePolynomialSquare(segment.axial, length) / (2 * EA);
        if (assembly.member.type === 'frame') {
          memberStrainEnergy += integratePolynomialSquare(segment.moment, length) / (2 * EI);
          if (Number.isFinite(shearRigidity) && shearRigidity > 0) {
            memberStrainEnergy += integratePolynomialSquare(segment.shear, length) / (2 * shearRigidity);
          }
        }
      }
      const addConnectionSpringEnergy = (stiffness: number | undefined, rotationIndex: 2 | 5) => {
        if (!(stiffness && stiffness > 0) || assembly.released.includes(rotationIndex)) return;
        const relativeRotation = nodalLocalD[rotationIndex] - localD[rotationIndex];
        memberStrainEnergy += 0.5 * stiffness * relativeRotation ** 2;
      };
      addConnectionSpringEnergy(assembly.member.rotationalSpringI, 2);
      addConnectionSpringEnergy(assembly.member.rotationalSpringJ, 5);
      const deformationsStart = profileStart();
      const deformation = buildDeformationCurve(exact.segments, assembly.member, localD, {
        axialStrain: assembly.initialAxialStrain,
        curvature: assembly.initialCurvature,
        shearRigidity: Number.isFinite(shearRigidity) ? shearRigidity : undefined,
      });
      profileEnd('deformations', deformationsStart);
      const axial = exact.points.map((point) => point.axial);
      const shear = exact.points.map((point) => point.shear);
      const moment = exact.points.map((point) => point.moment);
      const compatibilityTolerance = 1e-7;
      // Same first-order-vs-P-Delta caveat as the global equilibrium check above.
      if (deformation.compatibilityError > compatibilityTolerance && !pDeltaActive) {
        issues.push({
          id: `compatibility-${assembly.member.id}`,
          severity: 'warning',
          title: 'Compatibilidad de deformada',
          message: `La integración N/EA y M/EI del miembro ${assembly.member.id} presenta un residuo adimensional de compatibilidad de ${deformation.compatibilityError.toExponential(3)}.`,
          objectId: assembly.member.id,
          suggestedFix: 'Revisa rigideces extremas, liberaciones y condición numérica del modelo.',
        });
      }
      const endScales = {
        axial: Math.max(1, ...axial.map(Math.abs)),
        shear: Math.max(1, ...shear.map(Math.abs)),
        moment: Math.max(1, ...moment.map(Math.abs)),
      };
      const endRelativeError = Math.max(
        Math.abs(exact.endCompatibility.axial) / endScales.axial,
        Math.abs(exact.endCompatibility.shear) / endScales.shear,
        Math.abs(exact.endCompatibility.moment) / endScales.moment,
      );
      if (endRelativeError > 1e-7 && !pDeltaActive) {
        issues.push({
          id: `diagram-equilibrium-${assembly.member.id}`,
          severity: 'warning',
          title: 'Cierre del diagrama',
          message: `El cierre N-V-M del miembro ${assembly.member.id} presenta un residuo relativo de ${endRelativeError.toExponential(3)} (ΔN=${exact.endCompatibility.axial.toExponential(3)} kN, ΔV=${exact.endCompatibility.shear.toExponential(3)} kN, ΔM=${exact.endCompatibility.moment.toExponential(3)} kN·m).`,
          objectId: assembly.member.id,
          suggestedFix: 'Revisa cargas aplicadas exactamente en los extremos o el condicionamiento del modelo.',
        });
      }
      const representativeAxial = exact.points.reduce((sum, point) => sum + point.axial, 0) / Math.max(1, exact.points.length);
      const axialTolerance = Math.max(1e-9, 1e-8 * Math.max(1, ...axial.map(Math.abs)));
      const exactRange = (quantity: 'axial' | 'shear' | 'moment') => {
        const candidates = exact.criticalPoints
          .filter((point) => point.quantity === quantity)
          // A concentrated action placed exactly at an end has an exterior
          // limit for cursor/equilibrium purposes. It is not a material state
          // of the member and must not govern its reported extrema.
          .filter((point) => !(point.x === 0 && point.side === 'left')
            && !(point.x === assembly.geometry.L && point.side === 'right'))
          .map((point) => point.value);
        const fallback = exact.points
          .filter((point) => !(point.x === 0 && point.side === 'left')
            && !(point.x === assembly.geometry.L && point.side === 'right'))
          .map((point) => point[quantity]);
        const values = candidates.length ? candidates : fallback;
        return { max: Math.max(...values), min: Math.min(...values) };
      };
      const axialRange = exactRange('axial');
      const shearRange = exactRange('shear');
      const momentRange = exactRange('moment');
      return {
        memberId: assembly.member.id,
        length: assembly.geometry.L,
        totalLength: assembly.grossLength,
        startOffset: assembly.startOffset,
        endOffset: assembly.endOffset,
        localDisplacements: localD,
        localEndForces,
        diagramSegments: exact.segments,
        diagramJumps: exact.jumps,
        criticalPoints: exact.criticalPoints,
        diagram: exact.points,
        deformation: deformation.points,
        deformationSegments: deformation.segments,
        deformationCriticalPoints: deformation.criticalPoints,
        maxAxial: axialRange.max, minAxial: axialRange.min,
        maxShear: shearRange.max, minShear: shearRange.min,
        maxMoment: momentRange.max, minMoment: momentRange.min,
        trussState: assembly.member.type === 'truss'
          ? Math.abs(representativeAxial) <= axialTolerance ? 'zero' : representativeAxial > 0 ? 'tension' : 'compression'
          : undefined,
        compatibilityError: deformation.compatibilityError,
        compatibilityComponents: deformation.compatibilityComponents,
        endCompatibility: { ...exact.endCompatibility },
        endCompatibilityError: endRelativeError,
      };
    });

    const maximumTranslation = nodeResults.reduce((best, node) => {
      const magnitude = Math.hypot(node.ux, node.uy);
      return magnitude > best.magnitude ? { nodeId: node.nodeId, magnitude } : best;
    }, { nodeId: '', magnitude: 0 });
    const maximumRelativeTranslation = project.members.reduce((best, member) => {
      const ni = nodes.get(member.i);
      const nj = nodes.get(member.j);
      const ui = nodeResults.find((node) => node.nodeId === member.i);
      const uj = nodeResults.find((node) => node.nodeId === member.j);
      if (!ni || !nj || !ui || !uj) return best;
      const length = Math.hypot(nj.x - ni.x, nj.y - ni.y);
      if (!(length > EPS)) return best;
      const ratio = Math.hypot(uj.ux - ui.ux, uj.uy - ui.uy) / length;
      return ratio > best.ratio ? { memberId: member.id, ratio } : best;
    }, { memberId: '', ratio: 0 });
    const maximumRotation = nodeResults.reduce((best, node) => Math.abs(node.rz) > best.magnitude
      ? { nodeId: node.nodeId, magnitude: Math.abs(node.rz) }
      : best, { nodeId: '', magnitude: 0 });
    const maximumChordDeviation = memberResults.reduce((best, member) => {
      const first = member.deformation[0];
      const last = member.deformation.at(-1);
      if (!first || !last || !(last.x - first.x > EPS) || !(member.length > EPS)) return best;
      for (const point of member.deformation) {
        const ratio = (point.x - first.x) / (last.x - first.x);
        const chordU = first.u + (last.u - first.u) * ratio;
        const chordV = first.v + (last.v - first.v) * ratio;
        const deviationRatio = Math.hypot(point.u - chordU, point.v - chordV) / member.length;
        if (deviationRatio > best.ratio) best = { memberId: member.memberId, x: point.x, ratio: deviationRatio };
      }
      return best;
    }, { memberId: '', x: 0, ratio: 0 });
    const maximumSectionRotation = memberResults.reduce((best, member) => {
      const candidates = [
        ...member.deformation.map((point) => ({ x: point.x, magnitude: Math.abs(point.theta) })),
        ...member.deformationCriticalPoints.filter((point) => point.quantity === 'theta').map((point) => ({ x: point.x, magnitude: Math.abs(point.value) })),
      ];
      const local = candidates.reduce((maximum, candidate) => candidate.magnitude > maximum.magnitude ? candidate : maximum, { x: 0, magnitude: 0 });
      return local.magnitude > best.magnitude ? { memberId: member.memberId, ...local } : best;
    }, { memberId: '', x: 0, magnitude: 0 });
    const governingRotation = Math.max(maximumRotation.magnitude, maximumSectionRotation.magnitude);
    if (maximumRelativeTranslation.ratio > 0.05 || maximumChordDeviation.ratio > 0.05 || governingRotation > 0.1) {
      issues.push({
        id: 'small-displacement-assumption',
        severity: 'warning',
        title: 'Respuesta fuera del rango de pequeñas deformaciones',
        message: `Umax=${maximumTranslation.magnitude.toExponential(4)} m en ${maximumTranslation.nodeId}; max(||u_j-u_i||/L)=${maximumRelativeTranslation.ratio.toExponential(3)} en ${maximumRelativeTranslation.memberId}; máxima separación de la cuerda/L=${maximumChordDeviation.ratio.toExponential(3)} en ${maximumChordDeviation.memberId} (x=${maximumChordDeviation.x.toPrecision(5)} m); |θ|max=${governingRotation.toExponential(4)} rad. La solución matricial es lineal, pero la geometría deformada ya no puede interpretarse como físicamente válida de primer orden.`,
        suggestedFix: 'Revisa E, A, I y sus unidades; si las propiedades son correctas, usa un análisis geométricamente no lineal o de segundo orden.',
      });
    }

    const reactionAccumulator = emptyResultantAccumulator();
    nodeResults.forEach((nodeResult) => {
      const node = nodes.get(nodeResult.nodeId)!;
      const dx = node.x - referenceX;
      const dy = node.y - referenceY;
      addResultant(
        reactionAccumulator,
        nodeResult.rx,
        nodeResult.ry,
        nodeResult.rm + dx * nodeResult.ry - dy * nodeResult.rx,
        Math.abs(nodeResult.rm) + Math.abs(dx * nodeResult.ry) + Math.abs(dy * nodeResult.rx),
      );
    });
    const reactionResultant = finalizedResultant(reactionAccumulator);
    const equilibriumComponents = {
      sumFx: sourceActions.resultant.fx + reactionResultant.fx,
      sumFy: sourceActions.resultant.fy + reactionResultant.fy,
      sumM: sourceActions.resultant.mz + reactionResultant.mz,
    };
    const equilibriumForceFamilyActivity = sourceActions.absoluteFx + sourceActions.absoluteFy + reactionAccumulator.absoluteFx + reactionAccumulator.absoluteFy;
    const equilibriumMomentFamilyActivity = sourceActions.absoluteMoment + reactionAccumulator.absoluteMoment;
    const normalizedEquilibriumComponents: GlobalResultant = {
      fx: normalizedActivityResidual(equilibriumComponents.sumFx, sourceActions.absoluteFx + reactionAccumulator.absoluteFx, equilibriumForceFamilyActivity),
      fy: normalizedActivityResidual(equilibriumComponents.sumFy, sourceActions.absoluteFy + reactionAccumulator.absoluteFy, equilibriumForceFamilyActivity),
      mz: normalizedActivityResidual(equilibriumComponents.sumM, equilibriumMomentFamilyActivity, equilibriumMomentFamilyActivity),
    };
    const equilibrium = {
      ...equilibriumComponents,
      referencePoint: { x: referenceX, y: referenceY },
      normalizedComponents: normalizedEquilibriumComponents,
      normalizedResidual: Math.max(normalizedEquilibriumComponents.fx, normalizedEquilibriumComponents.fy, normalizedEquilibriumComponents.mz),
    };
    // This resultant sums moments using every node's UNDEFORMED position — a
    // valid closure test for a first-order solve, but a P-Delta run correctly
    // carries an additional P·Δ moment (the axial force's line of action
    // through the *displaced* node) that this undeformed-geometry bookkeeping
    // was never meant to see. Reporting it as a hard error would reject every
    // P-Delta run with a real second-order effect, defeating the feature.
    if (equilibrium.normalizedResidual > 1e-6 && !pDeltaActive) {
      issues.push({
        id: 'global-equilibrium',
        severity: 'error',
        title: 'El equilibrio global no cierra',
        message: `El residuo físico normalizado es ${equilibrium.normalizedResidual.toExponential(3)} (Fx=${normalizedEquilibriumComponents.fx.toExponential(3)}, Fy=${normalizedEquilibriumComponents.fy.toExponential(3)}, M=${normalizedEquilibriumComponents.mz.toExponential(3)}).`,
        suggestedFix: 'No uses los resultados: revisa las reacciones, las restricciones y el ensamblaje de cargas.',
      });
    } else if (equilibrium.normalizedResidual > 1e-6 && pDeltaActive) {
      issues.push({
        id: 'global-equilibrium',
        severity: 'info',
        title: 'Momento de segundo orden (P·Δ) presente',
        message: `El residuo de equilibrio de primer orden es ${equilibrium.normalizedResidual.toExponential(3)}; bajo P-Delta esto refleja el momento adicional de la fuerza axial actuando sobre el nodo desplazado, no un error de ensamblaje.`,
      });
    } else if (equilibrium.normalizedResidual > 1e-8) {
      issues.push({
        id: 'global-equilibrium',
        severity: 'warning',
        title: 'Cierre global limitado',
        message: `El residuo físico normalizado es ${equilibrium.normalizedResidual.toExponential(3)}.`,
        suggestedFix: 'Revisa el condicionamiento, las unidades y las rigideces extremas del modelo.',
      });
    }

    const educationTraceStart = profileStart();
    const educationTrace: EducationTrace | undefined = includeEducationTrace ? (() => {
      const matrixDetail = ndof <= 90 ? 'full' as const : 'summary' as const;
      const reactionVector = project.nodes.flatMap((node) => {
        const result = nodeResults.find((candidate) => candidate.nodeId === node.id)!;
        return [result.rx, result.ry, result.rm];
      });
      const nodalSpringEnergy = project.nodes.reduce((energy, node, index) => {
        const spring = node.support.spring;
        if (!spring) return energy;
        const ux = U[index * 3];
        const uy = U[index * 3 + 1];
        const rz = U[index * 3 + 2];
        let contribution = 0.5 * (spring.kx ?? 0) * ux ** 2
          + 0.5 * (spring.ky ?? 0) * uy ** 2
          + 0.5 * (spring.kr ?? 0) * rz ** 2;
        if (spring.kNormal) {
          const angle = ((spring.angleDeg ?? 90) * Math.PI) / 180;
          const normalDisplacement = Math.cos(angle) * ux + Math.sin(angle) * uy;
          contribution += 0.5 * spring.kNormal * normalDisplacement ** 2;
        }
        return energy + contribution;
      }, 0);
      const strainEnergy = memberStrainEnergy + nodalSpringEnergy;
      return {
        schemaVersion: 1 as const,
        formulation: project.members.some((member) => member.beamTheory === 'timoshenko') ? 'linear-static-mixed-beam' as const : 'linear-static-euler-bernoulli' as const,
        dofs: dofLabels.map((label, index) => {
          const component = (['ux', 'uy', 'rz'] as const)[index % 3];
          const directConstraint = constraintDefinitions.find((definition) => {
            const nonzero = definition.row.map((value, dof) => ({ value, dof })).filter((entry) => Math.abs(entry.value) > EPS);
            return nonzero.length === 1 && nonzero[0].dof === index;
          });
          return {
            index,
            nodeId: project.nodes[Math.floor(index / 3)].id,
            component,
            label,
            displacement: U[index],
            appliedLoad: F[index],
            reaction: reactionVector[index],
            residual: equilibriumResidual[index],
            constrained: C.some((row) => Math.abs(row[index]) > EPS),
            prescribedValue: directConstraint?.value,
          };
        }),
        elements: elementTraces,
        assembly: {
          stiffness: toMatrixTrace(K, dofLabels, dofLabels, matrixDetail),
          load: [...F],
          constraintMatrix: toMatrixTrace(C, C.map((_, index) => `C${index + 1}`), dofLabels, matrixDetail),
          constraintValues: constraintDefinitions.map((definition) => definition.value),
          diagonalScale: diagonalScale.slice(0, ndof),
          matrixDetail,
          strainEnergy,
        },
      };
    })() : undefined;
    profileEnd('educationTrace', educationTraceStart);

    // A zero computed residual does not imply more information than IEEE-754
    // double precision can carry. Include the condition-amplified round-off
    // floor before reporting an approximate forward error or reliable digits.
    const forwardErrorBound = Math.min(
      1,
      Math.max(
        solved.conditionEstimate * solved.relativeResidual,
        Math.max(1, solved.conditionEstimate) * Number.EPSILON,
      ),
    );
    const reliableDigits = Math.max(
      0,
      Math.min(-Math.log10(Number.EPSILON), -Math.log10(forwardErrorBound)),
    );

    const partial: Omit<AnalysisResult, 'explanation'> = {
      success: !issues.some((issue) => issue.severity === 'error'),
      issues,
      nodeResults,
      memberResults,
      displacements: U,
      residualNorm,
      constraintResidual,
      conditionEstimate: solved.conditionEstimate,
      linearResidual: solved.relativeResidual,
      refinementIterations: solved.refinementIterations,
      forwardErrorBound,
      reliableDigits,
      linearSolver: solved.diagnostics,
      equilibrium,
      loadAudit,
      educationTrace,
    };
    const explanationStart = profileStart();
    const explanation = explanationSteps(project, partial);
    profileEnd('explanation', explanationStart);
    const analysis: AnalysisResult = { ...partial, explanation };
    // Finishing is not the same as being trustworthy: classify the run against
    // every independent numeric check before publishing it.
    const reliabilityStart = profileStart();
    const reliability = classifyAnalysisReliability(analysis);
    profileEnd('auditAndReliability', reliabilityStart);
    return { ...analysis, reliability };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido durante el análisis.';
    const singular = message.toLowerCase().includes('singular') || message.toLowerCase().includes('mecanismo');
    const pivotMatch = message.match(/grado de libertad\s+(\d+)/i);
    const candidateIndex = pivotMatch ? Number(pivotMatch[1]) - 1 : -1;
    const candidateNode = candidateIndex >= 0 && candidateIndex < project.nodes.length * 3
      ? project.nodes[Math.floor(candidateIndex / 3)]
      : undefined;
    const candidateDof = candidateIndex >= 0
      ? ['Ux', 'Uy', 'Rz'][candidateIndex % 3]
      : undefined;
    const dominantMechanismNodes = mechanism?.nodes.slice(0, 3) ?? [];
    const mechanismDetail = dominantMechanismNodes.length
      ? ` El modo nulo dominante involucra ${dominantMechanismNodes.map((node) => `${node.dominantDof} de ${node.nodeId} (${(100 * node.normalizedAmplitude).toFixed(0)}%)`).join(', ')}.`
      : candidateNode && candidateDof
        ? ` El primer pivote deficiente está asociado aproximadamente con ${candidateDof} del nodo ${candidateNode.id}.`
        : '';
    issues.push({
      id: 'solver-error',
      severity: 'error',
      title: singular ? 'Estructura inestable o mecanismo' : 'No fue posible resolver el modelo',
      message: singular
        ? `El modelo conserva al menos un movimiento rígido o una liberación produjo un mecanismo.${mechanismDetail}`
        : message,
      objectId: dominantMechanismNodes[0]?.nodeId ?? candidateNode?.id,
      suggestedFix: singular
        ? mechanism
          ? `Revisa las restricciones y liberaciones de los nodos indicados. La nulidad numérica detectada es ${mechanism.nullity} y el residuo normalizado del modo es ${mechanism.residual.toExponential(2)}.`
          : 'Revisa las restricciones de ese nodo, la conectividad de sus miembros y las liberaciones cercanas. El grado indicado es un candidato numérico, no un modo propio completo.'
        : undefined,
    });
    return abortedResult(issues, { mechanism });
  }
};
