import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { MemberModel, NodeModel, ProjectModel, SupportType } from '../../types';
import type { DatasheetEditPlan, DatasheetPlannedChange } from './datasheetEditDraft';

/**
 * La única escritura del datasheet.
 *
 * Es pura: recibe un proyecto y devuelve otro. La misma función alimenta el
 * proyecto de preview y el `updateProject` real, y eso es lo que garantiza que
 * lo que el usuario ve antes de aplicar es exactamente lo que se escribe. Dos
 * caminos distintos podrían divergir; uno solo, no.
 *
 * Un plan no aplicable devuelve el proyecto **por identidad**, de modo que el
 * llamador puede compararlo por referencia y no existe camino por el que se
 * escriba la mitad de un plan.
 */

/**
 * Un tipo de apoyo nace con los campos que ese tipo sostiene y sin los del
 * anterior. Conservar el ángulo de un rodillo en un empotramiento dejaría un
 * dato que nadie lee y que reaparecería al volver a rodillo.
 *
 * El muelle y el desplazamiento impuesto sí se conservan: son propiedades del
 * nudo que cualquier tipo de apoyo puede sostener.
 */
const rebuildSupport = (node: NodeModel, type: SupportType): NodeModel['support'] => {
  const { spring, prescribed } = node.support;
  if (type === 'roller') return { type, angleDeg: node.support.angleDeg ?? 90, spring, prescribed };
  if (type === 'custom') return { type, restrainX: false, restrainY: false, restrainR: false, spring, prescribed };
  return { type, spring, prescribed };
};

/**
 * Escribir a mano un número del material degrada el origen a `custom` y suelta
 * la identidad: es la regla que `member.update` ya aplica. Dejar el id apuntando
 * a un perfil cuyos números ya no coinciden sería una identidad falsa.
 *
 * El material y la sección se degradan por separado porque son dos identidades
 * independientes: cambiar E no dice nada sobre el perfil.
 */
const degradeMaterial = (member: MemberModel): void => {
  if (member.materialOrigin !== 'catalog') return;
  member.materialOrigin = 'custom';
  delete member.materialId;
};

const degradeSection = (member: MemberModel): void => {
  if (member.sectionOrigin !== 'catalog') return;
  member.sectionOrigin = 'custom';
  delete member.sectionId;
};

const writeNode = (node: NodeModel, change: DatasheetPlannedChange): void => {
  switch (change.fieldId) {
    case 'node.x': node.x = change.after as number; break;
    case 'node.y': node.y = change.after as number; break;
    case 'node.support.type': node.support = rebuildSupport(node, change.after as SupportType); break;
    case 'node.support.angleDeg': node.support.angleDeg = change.after as number; break;
    case 'node.support.restrainX': node.support.restrainX = change.after as boolean; break;
    case 'node.support.restrainY': node.support.restrainY = change.after as boolean; break;
    case 'node.support.restrainR': node.support.restrainR = change.after as boolean; break;
    case 'node.internalHinge': node.internalHinge = change.after as boolean; break;
    default: break;
  }
};

const writeMember = (member: MemberModel, change: DatasheetPlannedChange): void => {
  switch (change.fieldId) {
    case 'member.type': member.type = change.after as MemberModel['type']; break;
    case 'member.materialId': {
      // La identidad viaja con sus números: el catálogo es la única fuente, así
      // que aplicarla no puede inventar procedencia.
      const material = findStandardMaterial(String(change.after));
      if (!material) break;
      member.materialId = material.id;
      member.materialOrigin = 'catalog';
      member.E = material.elasticModulus;
      if (material.shearModulus !== undefined) member.G = material.shearModulus;
      if (material.density !== undefined) member.density = material.density;
      break;
    }
    case 'member.sectionId': {
      const section = findStandardSection(String(change.after));
      if (!section) break;
      member.sectionId = section.id;
      member.sectionOrigin = 'catalog';
      member.A = section.area;
      member.I = section.inertiaX;
      break;
    }
    case 'member.E': member.E = change.after as number; degradeMaterial(member); break;
    case 'member.G': member.G = change.after as number; degradeMaterial(member); break;
    case 'member.density': member.density = change.after as number; degradeMaterial(member); break;
    case 'member.A': member.A = change.after as number; degradeSection(member); break;
    case 'member.I': member.I = change.after as number; degradeSection(member); break;
    case 'member.releases.iMoment':
      // Se escribe sobre una copia del objeto de liberaciones para no borrar la
      // contraria: son dos extremos independientes de la misma barra.
      member.releases = { ...member.releases, iMoment: change.after as boolean };
      break;
    case 'member.releases.jMoment':
      member.releases = { ...member.releases, jMoment: change.after as boolean };
      break;
    default: break;
  }
};

export const applyDatasheetPlan = (project: ProjectModel, plan: DatasheetEditPlan): ProjectModel => {
  if (!plan.applicable) return project;

  const next = structuredClone(project);
  const nodes = new Map(next.nodes.map((node) => [node.id, node]));
  const members = new Map(next.members.map((member) => [member.id, member]));
  const nodalLoads = new Map(next.nodalLoads.map((load) => [load.id, load]));
  const memberLoads = new Map(next.memberLoads.map((load) => [load.id, load]));

  for (const change of plan.changes) {
    switch (change.targetKind) {
      case 'node': {
        const node = nodes.get(change.rowId);
        if (node) writeNode(node, change);
        break;
      }
      case 'member': {
        const member = members.get(change.rowId);
        if (member) writeMember(member, change);
        break;
      }
      case 'nodalLoad': {
        const load = nodalLoads.get(change.rowId);
        if (!load) break;
        // Los cuatro campos nodales son homogéneos y su nombre es el sufijo del
        // identificador, que el registro ya validó: cuatro ramas no dirían más.
        (load as unknown as Record<string, unknown>)[change.fieldId.slice('nodalLoad.'.length)] = change.after;
        break;
      }
      case 'memberLoad': {
        const load = memberLoads.get(change.rowId);
        if (!load) break;
        (load as unknown as Record<string, unknown>)[change.fieldId.slice('memberLoad.'.length)] = change.after;
        break;
      }
    }
  }

  return next;
};
