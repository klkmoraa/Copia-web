/**
 * Ensamblaje de las matrices que necesitan los problemas de autovalores.
 *
 * Pandeo y modal comparten estructura y condiciones de contorno con el análisis
 * estático, pero **no** comparten término independiente: un modo propio es
 * homogéneo. No hay cargas, no hay asientos impuestos, no hay deformaciones
 * iniciales. Lo que sí tiene que ser idéntico —y por eso se toma prestado de
 * `solver.ts` en vez de reescribirse— es todo lo que define la estructura:
 * geometría deformable con zonas rígidas, condensación de liberaciones y
 * conexiones semirrígidas, muelles de apoyo y el conjunto independiente de
 * restricciones cinemáticas.
 *
 * Si esto se escribiera aparte, un día divergiría y el modo propio dibujado
 * dejaría de pertenecer a la estructura que el usuario resolvió, sin que nada
 * lo dijera.
 */
import type { LoadCombination, MemberModel, NodeModel, ProjectModel } from '../types';
import { addToMatrix, multiply, transpose, zeros, type Matrix } from './math';
import {
  assembleKinematicConstraints,
  condenseConnections,
  deformableGeometryOf,
  frameLocalStiffness,
  geometricStiffness,
  getNodeMap,
  rigidOffsetTransform,
  trussLocalStiffness,
  type ConstraintDefinition,
} from './solver';

export interface EigenAssembly {
  /** Rigidez elástica global, incluidos muelles de apoyo. */
  K: Matrix;
  /** Restricciones cinemáticas independientes; sólo se usa `row` (el modo es homogéneo). */
  constraints: ConstraintDefinition[];
  ndof: number;
  /** Etiqueta legible de cada grado de libertad, en el mismo orden que las filas. */
  dofLabels: string[];
  nodeIndex: Map<string, number>;
  nodes: Map<string, NodeModel>;
  /** Miembros que aportaron rigidez, con su geometría e índices ya resueltos. */
  elements: AssembledElement[];
}

export interface AssembledElement {
  member: MemberModel;
  /** Longitud deformable (descontadas las zonas rígidas). */
  length: number;
  /** Longitud completa entre nudos. */
  grossLength: number;
  indices: number[];
  /** Transformación de global a local, incluida la excentricidad de las zonas rígidas. */
  transform: Matrix;
  /** `true` si la rotación del extremo i/j quedó liberada. */
  released: number[];
}

/** Traslada una matriz local de 6×6 al espacio global del elemento. */
const toGlobal = (local: Matrix, transform: Matrix): Matrix =>
  multiply(multiply(transpose(transform), local), transform);

/**
 * Ensambla la rigidez elástica y las restricciones. No mira ni una carga: el
 * mapa de asientos impuestos que se pasa vacío es deliberado, porque el valor
 * de la restricción no interviene en un problema homogéneo.
 */
export const assembleForEigen = (project: ProjectModel): EigenAssembly => {
  const nodes = getNodeMap(project);
  const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
  const ndof = project.nodes.length * 3;
  const dofLabels = project.nodes.flatMap((node) => [`${node.id}.Ux`, `${node.id}.Uy`, `${node.id}.Rz`]);
  const K = zeros(ndof, ndof);
  const elements: AssembledElement[] = [];

  for (const member of project.members) {
    if (member.type === 'rigid') continue;
    const { geometry, grossLength, startOffset, endOffset } = deformableGeometryOf(member, nodes);
    const iIndex = nodeIndex.get(member.i);
    const jIndex = nodeIndex.get(member.j);
    if (iIndex === undefined || jIndex === undefined) continue;
    const indices = [iIndex * 3, iIndex * 3 + 1, iIndex * 3 + 2, jIndex * 3, jIndex * 3 + 1, jIndex * 3 + 2];
    const transform = rigidOffsetTransform(geometry, startOffset, endOffset);
    const elastic = member.type === 'truss' ? trussLocalStiffness(member, geometry.L) : frameLocalStiffness(member, geometry.L);
    const releaseI = member.type === 'frame' && Boolean(member.releases?.iMoment || nodes.get(member.i)?.internalHinge);
    const releaseJ = member.type === 'frame' && Boolean(member.releases?.jMoment || nodes.get(member.j)?.internalHinge);
    const condensed = member.type === 'frame'
      ? condenseConnections(elastic, Array(6).fill(0), member, releaseI, releaseJ, 'dense')
      : { stiffness: elastic, load: Array(6).fill(0), released: [] as number[] };
    addToMatrix(K, toGlobal(condensed.stiffness, transform), indices);
    elements.push({ member, length: geometry.L, grossLength, indices, transform, released: condensed.released });
  }

  // Muelles de apoyo: se ensamblan directamente en globales, igual que en el
  // análisis estático. Un muelle es rigidez, y la rigidez cuenta para el modo.
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

  const constraints = assembleKinematicConstraints(project, nodes, nodeIndex, ndof, new Map());
  return { K, constraints, ndof, dofLabels, nodeIndex, nodes, elements };
};

/**
 * Rigidez geométrica global para un estado axial dado.
 *
 * Sólo la aportan los miembros de pórtico: una barra de armadura no tiene
 * grados de libertad transversales que ablandar, y un miembro rígido nunca es
 * un elemento, es una restricción. Es la misma regla que aplica `analyzeProject`
 * cuando P-Delta está activo, y la misma matriz `geometricStiffness(L, N)`.
 *
 * La condensación se aplica **al conjunto elástico + geométrico**, no sólo al
 * elástico: liberar una rotación con la carga axial puesta no es lo mismo que
 * liberarla antes.
 */
export const assembleGeometricStiffness = (
  assembly: EigenAssembly,
  axialForces: ReadonlyMap<string, number>,
): Matrix => {
  const Kg = zeros(assembly.ndof, assembly.ndof);
  for (const element of assembly.elements) {
    if (element.member.type !== 'frame') continue;
    const axial = axialForces.get(element.member.id);
    if (!axial) continue;
    const geometric = geometricStiffness(element.length, axial);
    const elastic = frameLocalStiffness(element.member, element.length);
    const releaseI = element.released.includes(2);
    const releaseJ = element.released.includes(5);
    const combined = elastic.map((row, i) => row.map((value, j) => value + geometric[i][j]));
    const condensedCombined = condenseConnections(combined, Array(6).fill(0), element.member, releaseI, releaseJ, 'dense').stiffness;
    const condensedElastic = condenseConnections(elastic, Array(6).fill(0), element.member, releaseI, releaseJ, 'dense').stiffness;
    // La parte geométrica es la diferencia entre condensar con carga axial y
    // condensar sin ella: así el efecto de la liberación entra una sola vez.
    const geometricOnly = condensedCombined.map((row, i) => row.map((value, j) => value - condensedElastic[i][j]));
    addToMatrix(Kg, toGlobal(geometricOnly, element.transform), element.indices);
  }
  return Kg;
};

/** Fuerza axial media por miembro de pórtico, con el convenio de tracción positiva. */
export const axialForcesFromResult = (
  memberResults: ReadonlyArray<{ memberId: string; localEndForces: readonly number[] }>,
  memberIds: readonly string[],
): Map<string, number> => {
  const forces = new Map<string, number>();
  for (const id of memberIds) {
    const member = memberResults.find((candidate) => candidate.memberId === id);
    if (!member) { forces.set(id, 0); continue; }
    // Mismo promediado que `pDelta.ts`: la matriz geométrica clásica supone
    // fuerza axial constante a lo largo del elemento.
    forces.set(id, (-member.localEndForces[0] + member.localEndForces[3]) / 2);
  }
  return forces;
};

/** Combinación efectiva sobre la que se calcula el estado axial de referencia. */
export type EigenCombination = LoadCombination | null | undefined;
