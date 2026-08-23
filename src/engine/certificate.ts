/**
 * Certificado numérico: cuatro comprobaciones independientes sobre un resultado
 * ya calculado.
 *
 * `reliability.ts` clasifica lo que **el propio solver** midió al resolver
 * —residuos, condicionamiento, cierre de diagramas—. Es información valiosa y
 * tiene un límite: la reporta la misma maquinaria que produjo el resultado, así
 * que un error de ensamblaje coherente consigo mismo pasa desapercibido. Un
 * sistema mal montado se resuelve estupendamente.
 *
 * Esto es lo otro: cuatro preguntas que se contestan **volviendo a resolver**,
 * cada una capaz de fallar sin que ningún residuo interno se inmute.
 *
 * | Comprobación | Qué delataría |
 * |---|---|
 * | Equilibrio global | Cargas que entran al sistema distintas de las que el usuario puso. |
 * | Linealidad | Cualquier no linealidad colada en una ruta que se declara lineal. |
 * | Reciprocidad de Maxwell-Betti | Una rigidez global no simétrica: transformaciones, condensación o excentricidades mal aplicadas. |
 * | Refinamiento h | El error de discretización, que no es un defecto sino una magnitud que conviene conocer. |
 *
 * Ninguna es una verificación normativa ni dice que el **modelo** sea correcto:
 * dicen que la aritmética que lo resolvió se sostiene. Un modelo equivocado y
 * bien resuelto sale de aquí con las cuatro en verde.
 *
 * Cuesta entre tres y cuatro resoluciones extra, así que no vive dentro de
 * `analyzeProject`: se pide.
 */
import type { LoadCombination, ProjectModel } from '../types';
import { splitMemberAt } from '../data/modelOperations';
import { analyzeProject } from './solver';

export type CertificateCheckId = 'global-equilibrium' | 'linearity' | 'maxwell-betti' | 'h-refinement';

export type CertificateStatus = 'passed' | 'observed' | 'not-applicable' | 'failed';

export interface CertificateCheck {
  id: CertificateCheckId;
  label: string;
  status: CertificateStatus;
  /** Magnitud medida, relativa y adimensional siempre que la comprobación lo permita. */
  value?: number;
  tolerance?: number;
  message: string;
}

export interface NumericCertificate {
  checks: CertificateCheck[];
  /** `verified` si todo lo aplicable quedó dentro de tolerancia. */
  verdict: 'verified' | 'observations' | 'not-verifiable';
  summary: string;
  /** Resoluciones adicionales que costó emitirlo. */
  extraSolves: number;
}

export interface CertificateOptions {
  skip?: readonly CertificateCheckId[];
  /** Deriva relativa por encima de la cual el refinamiento h merece un aviso. Por defecto 5 %. */
  refinementObservationThreshold?: number;
}

const EQUILIBRIUM_TOLERANCE = 1e-8;
const LINEARITY_TOLERANCE = 1e-10;
const RECIPROCITY_TOLERANCE = 1e-8;

const clone = (project: ProjectModel): ProjectModel => JSON.parse(JSON.stringify(project)) as ProjectModel;

/**
 * Copia del modelo con la **estructura** intacta y **toda** acción exterior
 * retirada: cargas, asientos impuestos, deformaciones iniciales y peso propio.
 *
 * Betti compara dos sistemas de carga sobre la misma estructura. Dejar dentro
 * una carga preexistente compararía otra cosa y la comprobación pasaría o
 * fallaría por motivos que no tienen que ver con la simetría de la rigidez.
 */
const bareStructure = (project: ProjectModel): ProjectModel => {
  const bare = clone(project);
  bare.nodalLoads = [];
  bare.memberLoads = [];
  bare.memberInitialEffects = [];
  bare.prescribedDisplacements = [];
  bare.combinations = [];
  bare.loadCases = [{ id: 'BETTI', name: 'Betti', category: 'other', active: true }];
  bare.nodes = bare.nodes.map((node) => ({
    ...node,
    support: { ...node.support, prescribed: undefined },
  }));
  return bare;
};

type Component = 'ux' | 'uy';

/** Desplazamiento de un grado de libertad bajo una carga unidad en otro. */
const unitResponse = (
  bare: ProjectModel,
  loadAt: { nodeId: string; component: Component },
  readAt: { nodeId: string; component: Component },
): number | undefined => {
  const project = clone(bare);
  project.nodalLoads = [{
    id: 'UNIT',
    nodeId: loadAt.nodeId,
    caseId: 'BETTI',
    fx: loadAt.component === 'ux' ? 1 : 0,
    fy: loadAt.component === 'uy' ? 1 : 0,
    mz: 0,
  }];
  const result = analyzeProject(project, null, { includeEducationTrace: false });
  if (!result.success) return undefined;
  const node = result.nodeResults.find((candidate) => candidate.nodeId === readAt.nodeId);
  return node ? node[readAt.component] : undefined;
};

export const certifyResult = (
  project: ProjectModel,
  combination?: LoadCombination | null,
  options: CertificateOptions = {},
): NumericCertificate => {
  const skip = new Set(options.skip ?? []);
  const refinementThreshold = options.refinementObservationThreshold ?? 0.05;
  const checks: CertificateCheck[] = [];
  let extraSolves = 0;

  const reference = analyzeProject(project, combination, { includeEducationTrace: false });
  if (!reference.success) {
    return {
      checks: [],
      verdict: 'not-verifiable',
      summary: 'El análisis de referencia no es válido, así que no hay resultado que certificar.',
      extraSolves: 0,
    };
  }

  // 1 · Equilibrio global. El solver ya lo mide; aquí se publica como evidencia
  // en vez de dejarlo dentro de una clasificación.
  if (!skip.has('global-equilibrium')) {
    const value = reference.equilibrium.normalizedResidual;
    checks.push({
      id: 'global-equilibrium',
      label: 'Equilibrio global',
      status: Number.isFinite(value) ? (value <= EQUILIBRIUM_TOLERANCE ? 'passed' : 'failed') : 'not-applicable',
      value,
      tolerance: EQUILIBRIUM_TOLERANCE,
      message: Number.isFinite(value)
        ? `La resultante de cargas y reacciones se anula con residuo relativo ${value.toExponential(2)}.`
        : 'El solver no reportó un residuo de equilibrio finito.',
    });
  }

  // 2 · Linealidad. Duplicar la carga tiene que duplicar exactamente la
  // respuesta. Es la comprobación más barata que puede delatar una no
  // linealidad colada en una ruta que se declara lineal.
  if (!skip.has('linearity')) {
    const doubled = clone(project);
    const scale = 2;
    doubled.nodalLoads = doubled.nodalLoads.map((load) => ({ ...load, fx: load.fx * scale, fy: load.fy * scale, mz: load.mz * scale }));
    doubled.memberLoads = doubled.memberLoads.map((load) => ({
      ...load,
      qxStart: load.qxStart === undefined ? undefined : load.qxStart * scale,
      qxEnd: load.qxEnd === undefined ? undefined : load.qxEnd * scale,
      qyStart: load.qyStart === undefined ? undefined : load.qyStart * scale,
      qyEnd: load.qyEnd === undefined ? undefined : load.qyEnd * scale,
      px: load.px === undefined ? undefined : load.px * scale,
      py: load.py === undefined ? undefined : load.py * scale,
      moment: load.moment === undefined ? undefined : load.moment * scale,
    }));
    const scaled = analyzeProject(doubled, combination, { includeEducationTrace: false });
    extraSolves += 1;
    const magnitude = Math.max(...reference.displacements.map(Math.abs), 0);
    if (!scaled.success || !(magnitude > 0)) {
      checks.push({
        id: 'linearity',
        label: 'Linealidad de la respuesta',
        status: 'not-applicable',
        message: scaled.success
          ? 'El modelo no se mueve bajo esta combinación, así que escalar la carga no dice nada.'
          : 'El modelo con la carga duplicada deja de resolverse.',
      });
    } else {
      const drift = Math.max(...reference.displacements.map((value, index) =>
        Math.abs((scaled.displacements[index] ?? 0) - scale * value))) / (scale * magnitude);
      checks.push({
        id: 'linearity',
        label: 'Linealidad de la respuesta',
        status: drift <= LINEARITY_TOLERANCE ? 'passed' : 'failed',
        value: drift,
        tolerance: LINEARITY_TOLERANCE,
        message: `Duplicar la carga duplica la respuesta con desviación relativa ${drift.toExponential(2)}.`,
      });
    }
  }

  // 3 · Reciprocidad de Maxwell-Betti. Una rigidez global no simétrica la
  // rompe, y la simetría es exactamente lo que las transformaciones, la
  // condensación de conexiones y las zonas rígidas pueden estropear.
  if (!skip.has('maxwell-betti')) {
    const movers = reference.nodeResults
      .map((node) => ({
        nodeId: node.nodeId,
        component: (Math.abs(node.ux) >= Math.abs(node.uy) ? 'ux' : 'uy') as Component,
        magnitude: Math.max(Math.abs(node.ux), Math.abs(node.uy)),
      }))
      .filter((candidate) => candidate.magnitude > 0)
      .sort((a, b) => b.magnitude - a.magnitude);

    if (movers.length < 2) {
      checks.push({
        id: 'maxwell-betti',
        label: 'Reciprocidad de Maxwell-Betti',
        status: 'not-applicable',
        message: 'El modelo no tiene dos grados de libertad con movimiento apreciable que comparar.',
      });
    } else {
      const bare = bareStructure(project);
      const [first, second] = movers;
      const forward = unitResponse(bare, first, second);
      const backward = unitResponse(bare, second, first);
      extraSolves += 2;
      const scale = Math.max(Math.abs(forward ?? 0), Math.abs(backward ?? 0));
      if (forward === undefined || backward === undefined || !(scale > 0)) {
        checks.push({
          id: 'maxwell-betti',
          label: 'Reciprocidad de Maxwell-Betti',
          status: 'not-applicable',
          message: 'La estructura sin cargas no responde a una carga unidad en los grados de libertad elegidos.',
        });
      } else {
        const drift = Math.abs(forward - backward) / scale;
        checks.push({
          id: 'maxwell-betti',
          label: 'Reciprocidad de Maxwell-Betti',
          status: drift <= RECIPROCITY_TOLERANCE ? 'passed' : 'failed',
          value: drift,
          tolerance: RECIPROCITY_TOLERANCE,
          message: `El desplazamiento en ${second.nodeId}.${second.component} por una carga unidad en ${first.nodeId}.${first.component} coincide con el recíproco: discrepancia relativa ${drift.toExponential(2)}.`,
        });
      }
    }
  }

  // 4 · Refinamiento h. No es un aprobado: es la medida del error de
  // discretización, que en un elemento de viga siempre existe y conviene
  // conocer antes de leer un número con tres decimales.
  if (!skip.has('h-refinement')) {
    const refined = clone(project);
    const originalMemberIds = project.members.map((member) => member.id);
    let splits = 0;
    for (const memberId of originalMemberIds) {
      if (splitMemberAt(refined, memberId, 0.5)) splits += 1;
    }
    if (!splits) {
      checks.push({
        id: 'h-refinement',
        label: 'Error de discretización (refinamiento h)',
        status: 'not-applicable',
        message: 'Ningún miembro admite subdivisión, así que no hay malla que refinar.',
      });
    } else {
      const fine = analyzeProject(refined, combination, { includeEducationTrace: false });
      extraSolves += 1;
      const peak = Math.max(...reference.nodeResults.map((node) => Math.hypot(node.ux, node.uy)), 0);
      if (!fine.success || !(peak > 0)) {
        checks.push({
          id: 'h-refinement',
          label: 'Error de discretización (refinamiento h)',
          status: 'not-applicable',
          message: fine.success
            ? 'El modelo no se mueve, así que refinar no cambia nada que medir.'
            : 'El modelo subdividido deja de resolverse.',
        });
      } else {
        // Se comparan sólo los nudos originales: los intermedios no existen en
        // la malla gruesa y no hay con qué compararlos.
        const drift = Math.max(...reference.nodeResults.map((node) => {
          const refinedNode = fine.nodeResults.find((candidate) => candidate.nodeId === node.nodeId);
          if (!refinedNode) return 0;
          return Math.hypot(refinedNode.ux - node.ux, refinedNode.uy - node.uy);
        })) / peak;
        checks.push({
          id: 'h-refinement',
          label: 'Error de discretización (refinamiento h)',
          status: drift <= refinementThreshold ? 'passed' : 'observed',
          value: drift,
          tolerance: refinementThreshold,
          message: `Duplicar la malla mueve los desplazamientos un ${(drift * 100).toFixed(3)} %. Es la escala del error de discretización de este modelo, no un defecto del cálculo.`,
        });
      }
    }
  }

  const failed = checks.filter((check) => check.status === 'failed');
  const observed = checks.filter((check) => check.status === 'observed');
  const verdict = failed.length ? 'observations' : observed.length ? 'observations' : 'verified';
  const applicable = checks.filter((check) => check.status !== 'not-applicable').length;

  return {
    checks,
    verdict,
    extraSolves,
    summary: failed.length
      ? `${failed.length} de ${applicable} comprobaciones independientes no se cumplen: ${failed.map((check) => check.label).join(', ')}.`
      : observed.length
        ? `Las ${applicable} comprobaciones se cumplen; ${observed.length} merecen atención: ${observed.map((check) => check.label).join(', ')}.`
        : `Las ${applicable} comprobaciones independientes se cumplen.`,
  };
};
