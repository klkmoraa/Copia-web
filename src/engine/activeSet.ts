/**
 * Barras de signo restringido: cables, tirantes, puntales y contactos.
 *
 * Un cable no resiste compresión: se afloja. Un puntal no resiste tracción: se
 * separa. Eso no es un material no lineal —cada barra sigue siendo elástica y
 * lineal mientras trabaja— sino un problema de **conjunto activo**: hay que
 * averiguar qué barras trabajan, y esa pregunta sólo se puede contestar
 * resolviendo.
 *
 * ```text
 * resolver → mirar el signo de cada barra condicional → cambiar el conjunto → repetir
 * ```
 *
 * ## Por qué se quitan del modelo y no se ablandan
 *
 * La alternativa habitual es dejar la barra con una rigidez muy pequeña. Es más
 * cómoda y es mentira: introduce un número arbitrario que contamina el
 * condicionamiento del sistema y produce fuerzas residuales en una barra que se
 * supone descolgada. Aquí una barra inactiva **no está**, y si al quitarla el
 * modelo se convierte en un mecanismo, eso se comunica como mecanismo — que es
 * la verdad sobre esa estructura, no un fallo del método.
 *
 * ## Por qué la reactivación mira el alargamiento y no la fuerza
 *
 * Una barra inactiva no tiene fuerza: no está en el modelo. Lo que se puede
 * medir es cuánto se han separado sus dos nudos, y ese es el criterio correcto:
 * si un cable descolgado tendría que alargarse para unir sus extremos, vuelve a
 * trabajar.
 */
import type { AnalysisResult, LoadCombination, MemberModel, ProjectModel } from '../types';
import { analyzeProject, type AnalyzeProjectOptions } from './solver';

export interface ActiveSetOptions extends AnalyzeProjectOptions {
  /**
   * Techo de resoluciones lineales. Cada iteración es un análisis completo, así
   * que el presupuesto es explícito y no «hasta que converja».
   */
  maxIterations?: number;
}

const DEFAULT_MAX_ITERATIONS = 40;

/** Barras cuyo signo está restringido. Una barra ordinaria nunca entra aquí. */
export const conditionalMembers = (project: ProjectModel): MemberModel[] =>
  project.members.filter((member) => member.axialBehavior && member.axialBehavior !== 'both');

export const hasConditionalMembers = (project: ProjectModel): boolean => conditionalMembers(project).length > 0;

/** Fuerza axial media del miembro, tracción positiva: el convenio del motor. */
const axialForceOf = (result: AnalysisResult, memberId: string): number => {
  const member = result.memberResults.find((candidate) => candidate.memberId === memberId);
  if (!member) return 0;
  return (-member.localEndForces[0] + member.localEndForces[3]) / 2;
};

/**
 * Alargamiento que tendría una barra ausente con los desplazamientos actuales.
 * Positivo significa que sus extremos se han separado, es decir tracción.
 */
const elongationOf = (result: AnalysisResult, project: ProjectModel, member: MemberModel): number => {
  const nodeI = project.nodes.find((node) => node.id === member.i);
  const nodeJ = project.nodes.find((node) => node.id === member.j);
  if (!nodeI || !nodeJ) return 0;
  const length = Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y);
  if (!(length > 0)) return 0;
  const cos = (nodeJ.x - nodeI.x) / length;
  const sin = (nodeJ.y - nodeI.y) / length;
  const displacementI = result.nodeResults.find((node) => node.nodeId === member.i);
  const displacementJ = result.nodeResults.find((node) => node.nodeId === member.j);
  if (!displacementI || !displacementJ) return 0;
  return (displacementJ.ux - displacementI.ux) * cos + (displacementJ.uy - displacementI.uy) * sin;
};

/** ¿El signo medido es el que esta barra puede transmitir? */
const admits = (member: MemberModel, value: number, tolerance: number): boolean =>
  member.axialBehavior === 'tension-only' ? value >= -tolerance : value <= tolerance;

const projectWithout = (project: ProjectModel, inactive: ReadonlySet<string>): ProjectModel =>
  inactive.size === 0 ? project : { ...project, members: project.members.filter((member) => !inactive.has(member.id)) };

/**
 * Analiza el proyecto respetando el signo admisible de cada barra condicional.
 *
 * Sin barras condicionales delega en `analyzeProject` **sin tocar nada**: el
 * resultado es idéntico byte a byte al de siempre, incluido el campo
 * `activeSet`, que ni siquiera aparece.
 */
export const analyzeProjectWithActiveSet = (
  project: ProjectModel,
  combination?: LoadCombination | null,
  options: ActiveSetOptions = {},
): AnalysisResult => {
  const conditional = conditionalMembers(project);
  if (!conditional.length) return analyzeProject(project, combination, options);

  const maxIterations = Math.max(1, Math.trunc(options.maxIterations ?? DEFAULT_MAX_ITERATIONS));
  let inactive = new Set<string>();
  const visited = new Set<string>();
  const signature = (set: ReadonlySet<string>) => [...set].sort().join('|');

  // Sin asignación previa a propósito: el bucle siempre da al menos una vuelta
  // (`maxIterations >= 1`) y resolver aquí además sería resolver dos veces el
  // mismo sistema, que en un modelo grande es la mitad del coste del método.
  let result!: AnalysisResult;
  let iterations = 1;
  let cycled = false;
  let reason = '';

  for (; iterations <= maxIterations; iterations += 1) {
    const active = projectWithout(project, inactive);
    result = analyzeProject(active, combination, options);
    if (!result.success) {
      // Quitar una barra puede dejar el modelo sin sostener. No es un fallo del
      // método: es lo que le pasa a esa estructura si el cable se afloja.
      reason = inactive.size
        ? `Al descolgar ${inactive.size} barra(s) de signo restringido el modelo deja de ser estable.`
        : 'El análisis no es válido ni con todas las barras trabajando.';
      return {
        ...result,
        activeSet: {
          converged: false, iterations, cycled: false, reason,
          activeMemberIds: conditional.filter((member) => !inactive.has(member.id)).map((member) => member.id),
          inactiveMemberIds: [...inactive],
        },
      };
    }

    // Tolerancia relativa a la mayor fuerza axial condicional del paso: un cero
    // absoluto en kN no significa lo mismo en un tirante de fachada que en un
    // atirantado de puente.
    const scale = Math.max(...conditional.map((member) => Math.abs(axialForceOf(result, member.id))), 1e-9);
    const tolerance = scale * 1e-9;

    const next = new Set<string>();
    for (const member of conditional) {
      if (inactive.has(member.id)) {
        // Reactiva si sus extremos se han separado en el sentido que la barra sí resiste.
        const elongation = elongationOf(result, project, member);
        const wouldWork = member.axialBehavior === 'tension-only' ? elongation > 0 : elongation < 0;
        if (!wouldWork) next.add(member.id);
        continue;
      }
      if (!admits(member, axialForceOf(result, member.id), tolerance)) next.add(member.id);
    }

    if (signature(next) === signature(inactive)) {
      reason = inactive.size
        ? `Conjunto activo estable tras ${iterations} resolución(es); ${inactive.size} barra(s) quedan descolgadas.`
        : `Todas las barras de signo restringido trabajan; el conjunto fue estable a la primera.`;
      return {
        ...result,
        activeSet: {
          converged: true, iterations, cycled: false, reason,
          activeMemberIds: conditional.filter((member) => !inactive.has(member.id)).map((member) => member.id),
          inactiveMemberIds: [...inactive],
        },
      };
    }

    const key = signature(next);
    if (visited.has(key)) {
      // Alternancia: el conjunto oscila entre estados ya visitados. Iterar más
      // no lo arregla, y devolver el último sin decirlo lo escondería.
      cycled = true;
      reason = 'La iteración alterna entre conjuntos ya visitados: el modelo no tiene una configuración de barras estable bajo esta carga.';
      break;
    }
    visited.add(key);
    inactive = next;
  }

  if (!cycled) reason = `Se agotaron las ${maxIterations} resoluciones sin que el conjunto de barras activas se estabilizara.`;

  return {
    ...result,
    issues: [...result.issues, {
      id: 'active-set-not-converged',
      severity: 'warning' as const,
      title: 'Las barras de signo restringido no se estabilizaron',
      message: reason,
      suggestedFix: 'Revisa si alguna barra sobra o si la carga hace que el modelo dependa de una barra que se afloja y vuelve.',
    }],
    activeSet: {
      converged: false, iterations: Math.min(iterations, maxIterations), cycled, reason,
      activeMemberIds: conditional.filter((member) => !inactive.has(member.id)).map((member) => member.id),
      inactiveMemberIds: [...inactive],
    },
  };
};
