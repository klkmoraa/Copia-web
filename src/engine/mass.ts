/**
 * Matriz de masa de la estructura.
 *
 * La masa no se pide aparte: sale de `density × A`, exactamente los mismos dos
 * campos con los que `solver.ts` calcula el peso propio. Un modelo sin densidad
 * no tiene masa, y eso se dice en vez de rellenarse con un supuesto: inventar
 * una densidad por defecto convertiría un modelo incompleto en unas frecuencias
 * con aspecto de válidas.
 *
 * ## Unidades
 *
 * La rigidez de este motor está en kN/m y la densidad en kg/m³. Para que
 * `ω² = k/m` salga en rad²/s² la masa tiene que estar en **Mg** (toneladas):
 *
 * ```text
 * (kN/m) / Mg = (1000 N/m) / (1000 kg) = 1/s²
 * ```
 *
 * De ahí el único factor de escala de este archivo. Escribirlo mal no rompe
 * nada visiblemente: devuelve frecuencias que se parecen a frecuencias y están
 * multiplicadas por √1000.
 */
import type { MemberModel } from '../types';
import { addToMatrix, multiply, transpose, zeros, type Matrix } from './math';
import type { EigenAssembly } from './eigenAssembly';

/** kg → Mg. Ver la nota de unidades de la cabecera. */
const KILOGRAM_TO_MEGAGRAM = 1e-3;

export type MassFormulation = 'consistent' | 'lumped';

/** Masa por unidad de longitud en Mg/m, o cero si el miembro no declara densidad. */
export const linearMass = (member: MemberModel): number =>
  (member.density ?? 0) > 0 && member.A > 0 ? (member.density! * member.A) * KILOGRAM_TO_MEGAGRAM : 0;

/**
 * Masa consistente de un elemento de pórtico (Archer). Interpola la masa con
 * las mismas funciones de forma cúbicas con las que se interpola la flecha, así
 * que las frecuencias convergen desde arriba, igual que la rigidez.
 */
export const frameConsistentMass = (m: number, L: number): Matrix => {
  const c = (m * L) / 420;
  const L2 = L * L;
  return [
    [140 * c, 0, 0, 70 * c, 0, 0],
    [0, 156 * c, 22 * L * c, 0, 54 * c, -13 * L * c],
    [0, 22 * L * c, 4 * L2 * c, 0, 13 * L * c, -3 * L2 * c],
    [70 * c, 0, 0, 140 * c, 0, 0],
    [0, 54 * c, 13 * L * c, 0, 156 * c, -22 * L * c],
    [0, -13 * L * c, -3 * L2 * c, 0, -22 * L * c, 4 * L2 * c],
  ];
};

/**
 * Masa consistente de una barra de dos fuerzas. Sólo tiene masa traslacional:
 * una barra de armadura no tiene grados de libertad de giro que inerciar, igual
 * que no tiene rigidez que oponerles.
 */
export const trussConsistentMass = (m: number, L: number): Matrix => {
  const c = (m * L) / 6;
  return [
    [2 * c, 0, 0, c, 0, 0],
    [0, 2 * c, 0, 0, c, 0],
    [0, 0, 0, 0, 0, 0],
    [c, 0, 0, 2 * c, 0, 0],
    [0, c, 0, 0, 2 * c, 0],
    [0, 0, 0, 0, 0, 0],
  ];
};

/**
 * Masa concentrada: la mitad del peso del elemento en cada nudo, y nada en los
 * giros. Es más barata y da frecuencias por debajo de las exactas, así que
 * junto a la consistente —que las da por encima— acota la solución por los dos
 * lados. Los grados de libertad de giro quedan sin masa, y eso no es un
 * problema: el propio resolvedor los descarta porque producen un autovalor
 * nulo, es decir frecuencia infinita.
 */
export const lumpedMass = (m: number, L: number): Matrix => {
  const half = (m * L) / 2;
  const matrix = zeros(6, 6);
  matrix[0][0] = half;
  matrix[1][1] = half;
  matrix[3][3] = half;
  matrix[4][4] = half;
  return matrix;
};

export interface AssembledMass {
  M: Matrix;
  /** Masa total del modelo en Mg, contada una sola vez por miembro. */
  totalMass: number;
  /** Miembros que no declaran densidad o área y por tanto no aportan masa. */
  masslessMemberIds: string[];
}

/**
 * Ensambla la masa global sobre el mismo reparto de grados de libertad que la
 * rigidez, incluida la excentricidad de las zonas rígidas: la masa de un
 * elemento con brazo rígido se mueve con el brazo, no con el nudo.
 */
export const assembleMass = (assembly: EigenAssembly, formulation: MassFormulation = 'consistent'): AssembledMass => {
  const M = zeros(assembly.ndof, assembly.ndof);
  const masslessMemberIds: string[] = [];
  let totalMass = 0;

  for (const element of assembly.elements) {
    const m = linearMass(element.member);
    if (!(m > 0)) { masslessMemberIds.push(element.member.id); continue; }
    // La masa se reparte sobre la longitud **completa** del miembro: las zonas
    // rígidas no son huecos, tienen su propio peso.
    totalMass += m * element.grossLength;
    const local = formulation === 'lumped'
      ? lumpedMass(m, element.grossLength)
      : element.member.type === 'truss'
        ? trussConsistentMass(m, element.grossLength)
        : frameConsistentMass(m, element.grossLength);
    const global = multiply(multiply(transpose(element.transform), local), element.transform);
    addToMatrix(M, global, element.indices);
  }

  return { M, totalMass, masslessMemberIds };
};
