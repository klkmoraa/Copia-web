/**
 * Puente explícito del dominio plano 2D al dominio espacial S3D-1.
 *
 * Es un adaptador de una sola dirección y sin estado: lee un `ProjectModel` y
 * devuelve un `Space3DProjectV1` nuevo. Los dos dominios siguen separados —
 * ningún store se acopla, ningún solver se vuelve híbrido— y el proyecto 2D
 * nunca se toca.
 *
 * La regla que gobierna todo el archivo: **lo que el modelo plano no dice, no
 * se inventa**. Un marco 2D no contiene el eje débil, la torsión ni ninguna
 * restricción fuera del plano; rellenarlos con «valores razonables» produciría
 * un análisis espacial creíble y falso. En su lugar:
 *
 *   · las propiedades que faltan quedan en `0`, que el validador rechaza y el
 *     editor pide completar;
 *   · lo que no es un número (una celosía, un muelle, un apoyo inclinado) se
 *     publica como nota **bloqueante** que el usuario debe reconocer.
 *
 * Hasta que no quede ninguna nota sin resolver, la superficie no analiza.
 */
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  freeSpace3DRestraints,
  type Space3DEntityKind,
  type Space3DFrameMember,
  type Space3DLoadCombination,
  type Space3DNodalLoad,
  type Space3DNode,
  type Space3DProjectV1,
  type Space3DRestraints,
  type Space3DVector,
} from '../model/types';
import type { MemberModel, NodeModel, ProjectModel } from '../../types';

export const SPACE3D_DERIVED_ID_PREFIX = 'space3d-from-';

export const derivedSpace3DId = (sourceProjectId: string): string => `${SPACE3D_DERIVED_ID_PREFIX}${sourceProjectId}`;

export type Space3DBridgeCode =
  /** Datos que S3D-1 necesita y el plano no puede aportar: se dejan a cero. */
  | 'pending-shear-modulus'
  | 'pending-weak-axis-inertia'
  | 'pending-torsion-constant'
  /** Semántica que S3D-1 no representa: se declara y el usuario la reconoce. */
  | 'out-of-plane-unrestrained'
  | 'truss-member-as-frame'
  | 'dropped-member-release'
  | 'dropped-internal-hinge'
  | 'dropped-semi-rigid-connection'
  | 'dropped-rigid-offset'
  | 'dropped-support-spring'
  | 'dropped-inclined-support'
  | 'dropped-prescribed-support-motion'
  | 'dropped-member-load'
  | 'dropped-prescribed-displacement'
  | 'dropped-initial-effect';

export interface Space3DBridgeNote {
  readonly code: Space3DBridgeCode;
  readonly entityKind: Space3DEntityKind;
  readonly entityId: string;
  readonly field: string;
  /** Una nota bloqueante impide analizar hasta que se resuelve o se reconoce. */
  readonly blocking: boolean;
}

export interface Space3DBridgeResult {
  readonly project: Space3DProjectV1;
  readonly notes: readonly Space3DBridgeNote[];
}

/** Notas cuya resolución es un número que el usuario escribe en el editor. */
const PROPERTY_NOTES: Record<string, keyof Pick<Space3DFrameMember, 'G' | 'Iy' | 'J'>> = {
  'pending-shear-modulus': 'G',
  'pending-weak-axis-inertia': 'Iy',
  'pending-torsion-constant': 'J',
};

const positive = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const restraintsOf = (node: NodeModel): Space3DRestraints => {
  const support = node.support;
  const base = freeSpace3DRestraints();
  switch (support.type) {
    case 'fixed': return { ...base, ux: true, uy: true, rz: true };
    case 'pin': return { ...base, ux: true, uy: true };
    case 'roller': return { ...base, uy: true };
    case 'custom': return {
      ...base,
      ux: support.restrainX === true,
      uy: support.restrainY === true,
      rz: support.restrainR === true,
    };
    default: return base;
  }
};

/**
 * Referencia del eje local `y` para un miembro contenido en el plano global XY.
 *
 * `[0, 1, 0]` —el valor por defecto de S3D-1— es paralelo a cualquier pilar
 * vertical y degeneraría su triada. La perpendicular dentro del plano,
 * `ẑ_global × x̂`, existe siempre para un miembro plano y hace que `Iz` gobierne
 * exactamente la misma flexión que gobernaba `I` en 2D.
 */
const planarLocalYReference = (start: NodeModel, end: NodeModel): Space3DVector => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return [0, 1, 0];
  // ẑ × x̂ = (-x̂_y, x̂_x, 0)
  return [-dy / length, dx / length, 0];
};

export const deriveSpace3DFromPlanarProject = (source: ProjectModel): Space3DBridgeResult => {
  const notes: Space3DBridgeNote[] = [];
  const note = (
    code: Space3DBridgeCode,
    entityKind: Space3DEntityKind,
    entityId: string,
    field: string,
    blocking = true,
  ) => { notes.push({ code, entityKind, entityId, field, blocking }); };

  const nodes: Space3DNode[] = source.nodes.map((node) => {
    const support = node.support;
    if (support.spring && Object.values(support.spring).some((value) => typeof value === 'number' && value !== 0)) {
      note('dropped-support-spring', 'node', node.id, 'support.spring');
    }
    if (typeof support.angleDeg === 'number' && support.angleDeg % 180 !== 0 && support.type !== 'none') {
      note('dropped-inclined-support', 'node', node.id, 'support.angleDeg');
    }
    if (support.prescribed && Object.values(support.prescribed).some((value) => typeof value === 'number' && value !== 0)) {
      note('dropped-prescribed-support-motion', 'node', node.id, 'support.prescribed');
    }
    if (node.internalHinge) note('dropped-internal-hinge', 'node', node.id, 'internalHinge');

    return { id: node.id, x: node.x, y: node.y, z: 0, restraints: restraintsOf(node) };
  });

  const nodeById = new Map(source.nodes.map((node) => [node.id, node]));

  const members: Space3DFrameMember[] = source.members.map((member: MemberModel) => {
    if (member.type === 'truss') note('truss-member-as-frame', 'member', member.id, 'type');
    if (member.releases?.iMoment || member.releases?.jMoment) note('dropped-member-release', 'member', member.id, 'releases');
    if (typeof member.rotationalSpringI === 'number' || typeof member.rotationalSpringJ === 'number') {
      note('dropped-semi-rigid-connection', 'member', member.id, 'rotationalSpring');
    }
    if (positive(member.rigidOffsetI) || positive(member.rigidOffsetJ)) {
      note('dropped-rigid-offset', 'member', member.id, 'rigidOffset');
    }

    // `G` sólo existe en modelos planos con teoría de Timoshenko. Sin ese dato
    // no hay forma autoritativa de deducirlo: haría falta el coeficiente de
    // Poisson, que el modelo 2D no guarda.
    const G = positive(member.G) ? member.G : 0;
    if (G === 0) note('pending-shear-modulus', 'member', member.id, 'G');
    note('pending-weak-axis-inertia', 'member', member.id, 'Iy');
    note('pending-torsion-constant', 'member', member.id, 'J');

    const start = nodeById.get(member.i);
    const end = nodeById.get(member.j);

    return {
      id: member.id,
      i: member.i,
      j: member.j,
      E: member.E,
      G,
      A: member.A,
      Iy: 0,
      Iz: member.I,
      J: 0,
      orientation: {
        localYReferenceGlobal: start && end ? planarLocalYReference(start, end) : [0, 1, 0],
        rollRadians: 0,
      },
    };
  });

  if (nodes.length > 0) note('out-of-plane-unrestrained', 'project', '', 'restraints');

  for (const load of source.memberLoads) note('dropped-member-load', 'load', load.id, 'memberLoads');
  for (const item of source.prescribedDisplacements ?? []) note('dropped-prescribed-displacement', 'load', item.id, 'prescribedDisplacements');
  for (const item of source.memberInitialEffects ?? []) note('dropped-initial-effect', 'load', item.id, 'memberInitialEffects');

  const nodalLoads: Space3DNodalLoad[] = source.nodalLoads
    .filter((load) => nodeById.has(load.nodeId))
    .map((load) => ({
      id: load.id,
      caseId: load.caseId,
      nodeId: load.nodeId,
      fx: load.fx,
      fy: load.fy,
      fz: 0,
      mx: 0,
      my: 0,
      // El momento plano gira alrededor del eje global Z, el mismo `mz` espacial.
      mz: load.mz,
    }));

  const loadCases = source.loadCases.map((item) => ({ id: item.id, name: item.name }));
  const caseIds = new Set(loadCases.map((item) => item.id));
  const loadCombinations: Space3DLoadCombination[] = source.combinations.map((combination) => ({
    id: combination.id,
    name: combination.name,
    terms: Object.entries(combination.factors)
      .filter(([caseId]) => caseIds.has(caseId))
      .map(([caseId, factor]) => ({ caseId, factor })),
  }));

  const project: Space3DProjectV1 = {
    analysisSpace: SPACE3D_ANALYSIS_SPACE,
    schemaVersion: SPACE3D_SCHEMA_VERSION,
    id: derivedSpace3DId(source.id),
    name: source.name,
    units: source.settings.units,
    nodes,
    members,
    nodalLoads,
    loadCases,
    loadCombinations,
  };

  return { project, notes };
};

/**
 * Notas todavía sin resolver contra el estado actual del proyecto espacial.
 *
 * Las de propiedad se resuelven solas en cuanto el valor deja de ser cero; la
 * de restricción fuera del plano, cuando algún nudo restringe `uz`, `rx` o `ry`.
 * Las demás describen una diferencia de comportamiento que ningún número
 * cancela, así que se resuelven por reconocimiento explícito del usuario.
 */
export const unresolvedSpace3DBridgeNotes = (
  notes: readonly Space3DBridgeNote[],
  project: Space3DProjectV1,
  acknowledged: ReadonlySet<string>,
): readonly Space3DBridgeNote[] => notes.filter((item) => {
  if (!item.blocking) return false;

  const property = PROPERTY_NOTES[item.code];
  if (property) {
    const member = project.members.find((candidate) => candidate.id === item.entityId);
    // Un miembro que ya no existe no deja nada pendiente.
    return member ? !positive(member[property]) : false;
  }

  if (item.code === 'out-of-plane-unrestrained') {
    if (project.nodes.length === 0) return false;
    return !project.nodes.some((node) => node.restraints.uz || node.restraints.rx || node.restraints.ry);
  }

  return !acknowledged.has(item.code);
});

/**
 * ¿Sigue este proyecto espacial derivando del proyecto plano indicado?
 *
 * Comprueba en una sola dirección: que todo lo que vino del 2D siga ahí y en su
 * sitio. Lo que el usuario haya añadido o completado en 3D es suyo y no cuenta
 * — incluir sus nudos nuevos en la comparación declararía «el 2D cambió» por el
 * simple hecho de haber trabajado, que es justo el aviso que no debe salir.
 */
export const space3dMatchesPlanarSource = (project: Space3DProjectV1, source: ProjectModel): boolean => {
  if (project.id !== derivedSpace3DId(source.id)) return false;

  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  for (const node of source.nodes) {
    const twin = nodeById.get(node.id);
    if (!twin || twin.x !== node.x || twin.y !== node.y) return false;
  }

  const memberById = new Map(project.members.map((member) => [member.id, member]));
  for (const member of source.members) {
    const twin = memberById.get(member.id);
    if (!twin || twin.i !== member.i || twin.j !== member.j) return false;
  }

  return true;
};
