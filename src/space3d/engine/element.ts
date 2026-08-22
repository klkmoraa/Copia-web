/**
 * Elemento frame espacial de doce grados de libertad (Euler–Bernoulli
 * prismático, sin deformación por cortante ni alabeo).
 *
 * Orden local de GDL: `[u, v, w, rx, ry, rz]` en el nudo `i` y luego los mismos
 * seis en el nudo `j`. `Iz` gobierna la flexión en el plano `x–y` (pareja
 * `v`–`rz`) e `Iy` la del plano `x–z` (pareja `w`–`ry`); esta última cambia de
 * signo porque un giro positivo alrededor de `+y` desplaza `w` en `-z`.
 */
import { multiply, transpose, zeros, type Matrix } from '../../engine/math';
import { buildMemberOrientation, memberLength } from './orientation';
import type { Space3DFrameMember, Space3DNode, Space3DOrientationBasis } from '../model/types';

export interface Space3DSectionProperties {
  readonly E: number;
  readonly G: number;
  readonly A: number;
  readonly Iy: number;
  readonly Iz: number;
  readonly J: number;
}

export interface Space3DElement {
  readonly memberId: string;
  readonly length: number;
  readonly basis: Space3DOrientationBasis;
  readonly localStiffness: Matrix;
  readonly transformation: Matrix;
  readonly globalStiffness: Matrix;
}

const addSymmetric2 = (k: Matrix, [a, b]: readonly [number, number], diagonal: number, offDiagonal: number) => {
  k[a][a] += diagonal;
  k[b][b] += diagonal;
  k[a][b] += offDiagonal;
  k[b][a] += offDiagonal;
};

/**
 * Bloque de flexión estándar sobre los índices `[traslación_i, giro_i,
 * traslación_j, giro_j]`. `sign` es `+1` para la pareja `v`–`rz` y `-1` para
 * `w`–`ry`.
 */
const addBendingBlock = (
  k: Matrix,
  [a, b, c, d]: readonly [number, number, number, number],
  EI: number,
  L: number,
  sign: 1 | -1,
) => {
  const t = 12 * EI / L ** 3;
  const m = sign * 6 * EI / L ** 2;
  const r4 = 4 * EI / L;
  const r2 = 2 * EI / L;

  k[a][a] += t; k[a][b] += m; k[a][c] += -t; k[a][d] += m;
  k[b][a] += m; k[b][b] += r4; k[b][c] += -m; k[b][d] += r2;
  k[c][a] += -t; k[c][b] += -m; k[c][c] += t; k[c][d] += -m;
  k[d][a] += m; k[d][b] += r2; k[d][c] += -m; k[d][d] += r4;
};

export const spaceFrameLocalStiffness = (properties: Space3DSectionProperties, length: number): Matrix => {
  const { E, G, A, Iy, Iz, J } = properties;
  const L = length;
  const k = zeros(12, 12);

  addSymmetric2(k, [0, 6], E * A / L, -(E * A / L));
  addSymmetric2(k, [3, 9], G * J / L, -(G * J / L));
  addBendingBlock(k, [1, 5, 7, 11], E * Iz, L, 1);
  addBendingBlock(k, [2, 4, 8, 10], E * Iy, L, -1);

  return k;
};

/**
 * Matriz de transformación 12×12: cuatro copias del bloque 3×3 cuyas filas son
 * los ejes locales expresados en global, de modo que `uLocal = T · uGlobal`.
 */
export const spaceFrameTransformation = (basis: Space3DOrientationBasis): Matrix => {
  const T = zeros(12, 12);
  const rows = [basis.x, basis.y, basis.z];
  for (let block = 0; block < 4; block += 1) {
    const offset = block * 3;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) T[offset + row][offset + col] = rows[row][col];
    }
  }
  return T;
};

export const buildSpaceFrameElement = (
  member: Space3DFrameMember,
  nodeI: Space3DNode,
  nodeJ: Space3DNode,
): Space3DElement => {
  const start = [nodeI.x, nodeI.y, nodeI.z] as const;
  const end = [nodeJ.x, nodeJ.y, nodeJ.z] as const;
  const length = memberLength(start, end);
  const basis = buildMemberOrientation(start, end, member.orientation);
  const localStiffness = spaceFrameLocalStiffness(member, length);
  const transformation = spaceFrameTransformation(basis);
  const globalStiffness = multiply(transpose(transformation), multiply(localStiffness, transformation));

  return { memberId: member.id, length, basis, localStiffness, transformation, globalStiffness };
};
