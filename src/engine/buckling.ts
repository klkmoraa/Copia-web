/**
 * Pandeo elástico lineal: el factor por el que habría que multiplicar la
 * combinación aplicada para que la estructura pierda la estabilidad, y la forma
 * en que la perdería.
 *
 * ```text
 * (K + λ·Kg)·φ = 0
 * ```
 *
 * `Kg` se construye con el estado axial que el análisis de primer orden
 * devuelve bajo la combinación pedida, así que λ multiplica **esa** carga y no
 * otra: «esta estructura pandea a 3.4 veces lo que le has puesto».
 *
 * ## Lo que este número no es
 *
 * No es una verificación normativa ni un factor de seguridad, y se comunica con
 * la misma disciplina que el índice elástico η: es pandeo **elástico** y
 * **lineal**, con la geometría sin deformar y sin plastificación, sin
 * imperfecciones iniciales, sin pandeo lateral por torsión —que es un fenómeno
 * fuera del plano y este dominio es plano— y sin pandeo local de la sección.
 * Una estructura real pandea antes que su λcr elástico, no después.
 *
 * ## Relación con la estimación que ya existía
 *
 * `pDelta.ts` publica una estimación de λcr derivada de la amplificación de
 * segundo orden, y declara su supuesto: un único modo dominante. Aquí se mide
 * el autovalor de verdad. Cuando ambos existen se publican los dos: la
 * discrepancia entre ellos es información sobre cuán dominante era ese modo, no
 * un error de ninguno de los dos.
 */
import type { LoadCombination, ProjectModel, ValidationIssue } from '../types';
import { assembleForEigen, assembleGeometricStiffness, axialForcesFromResult } from './eigenAssembly';
import { constraintNullSpaceBasis, expandFromBasis, generalizedSmallestEigenpairs, projectOntoBasis } from './eigen';
import { analyzeProject } from './solver';

/** Desplazamiento modal de un nudo. Adimensional: un modo tiene forma, no magnitud. */
export interface ModeShapeNode {
  nodeId: string;
  ux: number;
  uy: number;
  rz: number;
}

export interface BucklingMode {
  /** λcr: multiplicador de la combinación de referencia que produce este modo. */
  criticalLoadFactor: number;
  /** Forma normalizada a traslación máxima unidad. */
  shape: ModeShapeNode[];
}

export interface BucklingResult {
  success: boolean;
  modes: BucklingMode[];
  /** El menor λcr positivo, cuando existe. */
  criticalLoadFactor?: number;
  converged: boolean;
  /** Residuo relativo máximo de los modos devueltos. */
  residual: number;
  issues: ValidationIssue[];
  reason: string;
  /** Estado axial de referencia, por miembro de pórtico, en kN (tracción positiva). */
  referenceAxialForces: Record<string, number>;
  /** Grados de libertad libres tras aplicar las condiciones de contorno. */
  freeDegreesOfFreedom: number;
}

export interface BucklingOptions {
  /** Cuántos modos calcular. Por defecto 3. */
  modes?: number;
  maxIterations?: number;
  tolerance?: number;
}

const failure = (reason: string, issues: ValidationIssue[] = [], freeDegreesOfFreedom = 0): BucklingResult => ({
  success: false, modes: [], converged: false, residual: Number.NaN,
  issues, reason, referenceAxialForces: {}, freeDegreesOfFreedom,
});

export const analyzeBuckling = (
  project: ProjectModel,
  combination?: LoadCombination | null,
  options: BucklingOptions = {},
): BucklingResult => {
  const requested = Math.max(1, Math.trunc(options.modes ?? 3));

  // El estado axial de referencia sale del análisis que el usuario ya conoce.
  // Si ese análisis no vale, el pandeo tampoco: no se calcula un autovalor
  // sobre un modelo que el solver ha rechazado.
  const reference = analyzeProject(project, combination, { includeEducationTrace: false });
  if (!reference.success) {
    return failure('El análisis de primer orden no es válido para este modelo; corrígelo antes de pedir el pandeo.', reference.issues);
  }

  const assembly = assembleForEigen(project);
  const frameIds = assembly.elements.filter((element) => element.member.type === 'frame').map((element) => element.member.id);
  if (!frameIds.length) {
    return failure('El modelo no tiene miembros de pórtico: sin rigidez a flexión no hay pandeo por flexión que calcular.');
  }

  const axialForces = axialForcesFromResult(reference.memberResults, frameIds);
  const compressed = frameIds.filter((id) => (axialForces.get(id) ?? 0) < 0);
  if (!compressed.length) {
    return failure('Ningún miembro está comprimido bajo esta combinación: no hay pandeo posible mientras la carga no cambie de signo.');
  }

  const Kg = assembleGeometricStiffness(assembly, axialForces);
  const basis = constraintNullSpaceBasis(assembly.constraints.map((constraint) => constraint.row), assembly.ndof);
  if (!basis.nullity) {
    return failure('Las condiciones de contorno no dejan ningún grado de libertad libre.', [], 0);
  }

  const reducedK = projectOntoBasis(assembly.K, basis.vectors);
  // El problema es (K + λ·Kg)φ = 0, es decir K·φ = λ·(−Kg)·φ.
  const reducedB = projectOntoBasis(Kg, basis.vectors).map((row) => row.map((value) => -value));

  const eigen = generalizedSmallestEigenpairs(reducedK, reducedB, requested, {
    // Sólo interesa el λ positivo: un λ negativo describe el pandeo bajo la
    // carga invertida, que es otra pregunta y se contestaría invirtiendo la
    // combinación, no leyéndolo aquí de refilón.
    positiveOnly: true,
    maxIterations: options.maxIterations,
    tolerance: options.tolerance,
  });

  if (!eigen.values.length) {
    return failure(eigen.reason, [], basis.nullity);
  }

  const modes: BucklingMode[] = eigen.values.map((criticalLoadFactor, index) => {
    const full = expandFromBasis(eigen.vectors[index], basis.vectors);
    const shape: ModeShapeNode[] = project.nodes.map((node) => {
      const base = assembly.nodeIndex.get(node.id)! * 3;
      return { nodeId: node.id, ux: full[base], uy: full[base + 1], rz: full[base + 2] };
    });
    // Normalización por traslación máxima: la rotación tiene otras unidades y
    // mezclarlas en la norma haría que la escala del dibujo dependiera del
    // tamaño del modelo.
    const peak = Math.max(...shape.map((node) => Math.max(Math.abs(node.ux), Math.abs(node.uy))), 0);
    const scale = peak > 0 ? 1 / peak : 1;
    return {
      criticalLoadFactor,
      shape: shape.map((node) => ({ nodeId: node.nodeId, ux: node.ux * scale, uy: node.uy * scale, rz: node.rz * scale })),
    };
  });

  const issues: ValidationIssue[] = [];
  if (modes[0].criticalLoadFactor <= 1) {
    issues.push({
      id: 'buckling-below-applied-load',
      severity: 'warning',
      title: 'La carga aplicada supera la carga crítica elástica',
      message: `El primer modo de pandeo aparece a ${modes[0].criticalLoadFactor.toFixed(3)} veces la combinación aplicada, es decir por debajo de ella.`,
      suggestedFix: 'Revisa las secciones comprimidas, la longitud de pandeo o el arriostramiento antes de dar el modelo por bueno.',
    });
  }
  if (!eigen.converged) {
    issues.push({
      id: 'buckling-not-converged',
      severity: 'warning',
      title: 'El cálculo de pandeo no estabilizó los modos',
      message: eigen.reason,
      suggestedFix: 'Pide menos modos o revisa que el modelo no tenga partes casi desconectadas.',
    });
  }

  return {
    success: true,
    modes,
    criticalLoadFactor: modes[0].criticalLoadFactor,
    converged: eigen.converged,
    residual: eigen.residual,
    issues,
    reason: eigen.reason,
    referenceAxialForces: Object.fromEntries(axialForces),
    freeDegreesOfFreedom: basis.nullity,
  };
};
