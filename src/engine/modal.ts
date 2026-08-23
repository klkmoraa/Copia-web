/**
 * Análisis modal: frecuencias propias, periodos y formas de vibración.
 *
 * ```text
 * K·φ = ω²·M·φ
 * ```
 *
 * Es el mismo problema que el pandeo con otra matriz a la derecha, y se resuelve
 * con el mismo motor (`eigen.ts`). Aquí `M` es semidefinida positiva, no
 * indefinida, así que el caso es más benigno que el de pandeo — y sale gratis
 * precisamente porque el resolvedor se escribió para el caso difícil.
 *
 * Un detalle que la transformación regala: los grados de libertad sin masa
 * —los giros bajo masa concentrada, por ejemplo— producen un autovalor **nulo**
 * del problema transformado, es decir frecuencia infinita, y el resolvedor los
 * descarta solo. No hace falta condensarlos a mano.
 *
 * ## Lo que esto no es
 *
 * No es un análisis sísmico. Da los modos y la masa que participa en cada uno;
 * no aplica espectro, no combina modos, no calcula fuerzas. Y es un análisis
 * **elástico y sin amortiguamiento**: las frecuencias son las de la estructura
 * intacta.
 */
import type { ProjectModel, ValidationIssue } from '../types';
import { constraintNullSpaceBasis, expandFromBasis, generalizedSmallestEigenpairs, projectOntoBasis } from './eigen';
import { assembleForEigen } from './eigenAssembly';
import { assembleMass, type MassFormulation } from './mass';
import { multiplyMatrixVector, type Matrix } from './math';
import type { ModeShapeNode } from './buckling';

export interface VibrationMode {
  /** Frecuencia angular en rad/s. */
  angularFrequency: number;
  /** Frecuencia en Hz. */
  frequency: number;
  /** Periodo en segundos. */
  period: number;
  /** Fracción de la masa total que participa en este modo, por dirección. */
  participatingMassRatioX: number;
  participatingMassRatioY: number;
  shape: ModeShapeNode[];
}

export interface ModalResult {
  success: boolean;
  modes: VibrationMode[];
  /** Fracción acumulada de masa cubierta por los modos devueltos. */
  cumulativeMassRatioX: number;
  cumulativeMassRatioY: number;
  /** Masa total del modelo en Mg. */
  totalMass: number;
  formulation: MassFormulation;
  converged: boolean;
  residual: number;
  issues: ValidationIssue[];
  reason: string;
  freeDegreesOfFreedom: number;
}

export interface ModalOptions {
  modes?: number;
  formulation?: MassFormulation;
  maxIterations?: number;
  tolerance?: number;
}

const failure = (reason: string, issues: ValidationIssue[] = []): ModalResult => ({
  success: false, modes: [], cumulativeMassRatioX: 0, cumulativeMassRatioY: 0, totalMass: 0,
  formulation: 'consistent', converged: false, residual: Number.NaN, issues, reason, freeDegreesOfFreedom: 0,
});

/** Producto φᵀ·A·ψ. */
const bilinear = (A: Matrix, phi: readonly number[], psi: readonly number[]): number =>
  multiplyMatrixVector(A, psi as number[]).reduce((sum, value, index) => sum + phi[index] * value, 0);

export const analyzeModal = (project: ProjectModel, options: ModalOptions = {}): ModalResult => {
  const requested = Math.max(1, Math.trunc(options.modes ?? 5));
  const formulation = options.formulation ?? 'consistent';

  const assembly = assembleForEigen(project);
  if (!assembly.elements.length) {
    return failure('El modelo no tiene miembros deformables: no hay nada que pueda vibrar.');
  }

  const mass = assembleMass(assembly, formulation);
  if (!(mass.totalMass > 0)) {
    return failure('Ningún miembro declara densidad y área, así que el modelo no tiene masa. Asigna un material con densidad antes de pedir los modos de vibración.');
  }

  const basis = constraintNullSpaceBasis(assembly.constraints.map((constraint) => constraint.row), assembly.ndof);
  if (!basis.nullity) {
    return failure('Las condiciones de contorno no dejan ningún grado de libertad libre.');
  }

  const reducedK = projectOntoBasis(assembly.K, basis.vectors);
  const reducedM = projectOntoBasis(mass.M, basis.vectors);
  const eigen = generalizedSmallestEigenpairs(reducedK, reducedM, requested, {
    // ω² es no negativa por construcción; un valor negativo sólo puede salir de
    // un modelo con un mecanismo, y el resolvedor lo declara antes de llegar aquí.
    positiveOnly: true,
    maxIterations: options.maxIterations,
    tolerance: options.tolerance,
  });

  if (!eigen.values.length) {
    return { ...failure(eigen.reason), formulation, freeDegreesOfFreedom: basis.nullity, totalMass: mass.totalMass };
  }

  /** Vector de influencia: desplazamiento unitario del suelo en una dirección. */
  const influence = (component: 0 | 1): number[] => {
    const vector = Array(assembly.ndof).fill(0);
    for (let index = component; index < assembly.ndof; index += 3) vector[index] = 1;
    return vector;
  };
  const rx = influence(0);
  const ry = influence(1);
  const totalX = bilinear(mass.M, rx, rx);
  const totalY = bilinear(mass.M, ry, ry);

  const modes: VibrationMode[] = eigen.values.map((omegaSquared, index) => {
    const phi = expandFromBasis(eigen.vectors[index], basis.vectors);
    const modalMass = bilinear(mass.M, phi, phi);
    // Masa modal efectiva: (φᵀMr)² / (φᵀMφ). Es la parte de la masa total que
    // este modo mueve, y su suma sobre todos los modos es la masa total.
    const effective = (component: number[], total: number) => {
      if (!(modalMass > 0) || !(total > 0)) return 0;
      const excitation = bilinear(mass.M, phi, component);
      return (excitation * excitation) / modalMass / total;
    };
    const angularFrequency = Math.sqrt(omegaSquared);
    const peak = Math.max(...project.nodes.map((node) => {
      const base = assembly.nodeIndex.get(node.id)! * 3;
      return Math.max(Math.abs(phi[base]), Math.abs(phi[base + 1]));
    }), 0);
    const scale = peak > 0 ? 1 / peak : 1;
    return {
      angularFrequency,
      frequency: angularFrequency / (2 * Math.PI),
      period: angularFrequency > 0 ? (2 * Math.PI) / angularFrequency : Number.POSITIVE_INFINITY,
      participatingMassRatioX: effective(rx, totalX),
      participatingMassRatioY: effective(ry, totalY),
      shape: project.nodes.map((node) => {
        const base = assembly.nodeIndex.get(node.id)! * 3;
        return { nodeId: node.id, ux: phi[base] * scale, uy: phi[base + 1] * scale, rz: phi[base + 2] * scale };
      }),
    };
  });

  const cumulativeMassRatioX = modes.reduce((sum, mode) => sum + mode.participatingMassRatioX, 0);
  const cumulativeMassRatioY = modes.reduce((sum, mode) => sum + mode.participatingMassRatioY, 0);

  const issues: ValidationIssue[] = [];
  if (mass.masslessMemberIds.length) {
    issues.push({
      id: 'modal-massless-members',
      severity: 'info',
      title: 'Hay miembros sin masa',
      message: `${mass.masslessMemberIds.length} miembro(s) no declaran densidad, así que no aportan masa a los modos.`,
      suggestedFix: 'Asigna un material con densidad a esos miembros si su peso debe participar.',
    });
  }
  if (Math.max(cumulativeMassRatioX, cumulativeMassRatioY) < 0.9) {
    issues.push({
      id: 'modal-insufficient-mass',
      severity: 'warning',
      title: 'Los modos calculados no cubren el 90 % de la masa',
      message: `Los ${modes.length} modos acumulan ${(cumulativeMassRatioX * 100).toFixed(1)} % en X y ${(cumulativeMassRatioY * 100).toFixed(1)} % en Y.`,
      suggestedFix: 'Pide más modos si vas a usar estos resultados para algo que dependa de la masa participante.',
    });
  }

  return {
    success: true,
    modes,
    cumulativeMassRatioX,
    cumulativeMassRatioY,
    totalMass: mass.totalMass,
    formulation,
    converged: eigen.converged,
    residual: eigen.residual,
    issues,
    reason: eigen.reason,
    freeDegreesOfFreedom: basis.nullity,
  };
};
