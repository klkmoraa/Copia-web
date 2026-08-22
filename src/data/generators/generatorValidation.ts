import type { ProjectModel } from '../../types';
import { createBlankProject } from '../defaultProject';
import { projectTopologyTolerance } from '../modelOperations';
import { validateStructuralEditBoundary } from '../structuralEditing';
import type { GeneratedStructure } from './generatorTypes';

/**
 * Frontera de validación del núcleo de generación.
 *
 * No inventa reglas nuevas: proyecta la geometría generada sobre un proyecto en
 * blanco y la somete a `validateStructuralEditBoundary`, el mismo contrato que
 * ya protege la edición estructural (identidad, referencias, longitud cero y
 * coherencia catálogo/procedencia). Encima añade lo que sólo el generador puede
 * afirmar: que no produjo nodos coincidentes, que cada objeto declara su rol,
 * que los apoyos declarados son exactamente los aplicados y que el resumen
 * cuenta lo que de verdad existe.
 */

/** Proyecta la geometría sobre un proyecto en blanco para reutilizar la validación vigente. */
const projectGeneratedStructure = (structure: GeneratedStructure): ProjectModel => {
  const project = createBlankProject();
  project.nodes = structure.nodes.map((node) => structuredClone(node));
  project.members = structure.members.map((member) => structuredClone(member));
  return project;
};

const assertNoCoincidentNodes = (project: ProjectModel): void => {
  const tolerance = projectTopologyTolerance(project);
  for (let first = 0; first < project.nodes.length; first += 1) {
    for (let second = first + 1; second < project.nodes.length; second += 1) {
      const a = project.nodes[first];
      const b = project.nodes[second];
      if (Math.hypot(a.x - b.x, a.y - b.y) <= tolerance) {
        throw new Error(`Los nodos generados ${a.id} y ${b.id} son coincidentes.`);
      }
    }
  }
};

const assertRolesMatch = (structure: GeneratedStructure): void => {
  for (const node of structure.nodes) {
    if (!structure.nodeRoles[node.id]) throw new Error(`El nodo generado ${node.id} no declara su rol.`);
  }
  const nodeIds = new Set(structure.nodes.map((node) => node.id));
  for (const id of Object.keys(structure.nodeRoles)) {
    if (!nodeIds.has(id)) throw new Error(`El rol ${id} no corresponde a ningún nodo generado.`);
  }
  for (const member of structure.members) {
    if (!structure.memberRoles[member.id]) throw new Error(`El miembro generado ${member.id} no declara su rol.`);
  }
  const memberIds = new Set(structure.members.map((member) => member.id));
  for (const id of Object.keys(structure.memberRoles)) {
    if (!memberIds.has(id)) throw new Error(`El rol ${id} no corresponde a ningún miembro generado.`);
  }
};

const assertSupportsMatch = (structure: GeneratedStructure): void => {
  const declared = new Set(structure.supportedNodeIds);
  if (declared.size !== structure.supportedNodeIds.length) {
    throw new Error('La lista de nodos apoyados tiene entradas repetidas.');
  }
  const nodeById = new Map(structure.nodes.map((node) => [node.id, node]));
  for (const id of structure.supportedNodeIds) {
    const node = nodeById.get(id);
    if (!node) throw new Error(`El apoyo declarado apunta al nodo inexistente ${id}.`);
    if (node.support.type === 'none') {
      throw new Error(`El nodo ${id} está declarado como apoyado pero no tiene apoyo.`);
    }
  }
  for (const node of structure.nodes) {
    if (node.support.type !== 'none' && !declared.has(node.id)) {
      throw new Error(`El nodo ${node.id} tiene apoyo pero no está declarado como apoyado.`);
    }
  }
};

const assertSummaryCounts = (structure: GeneratedStructure): void => {
  const { summary } = structure;
  if (summary.nodeCount !== structure.nodes.length) {
    throw new Error(`El resumen declara ${summary.nodeCount} nodos pero la geometría tiene ${structure.nodes.length}.`);
  }
  if (summary.memberCount !== structure.members.length) {
    throw new Error(`El resumen declara ${summary.memberCount} miembros pero la geometría tiene ${structure.members.length}.`);
  }
  if (summary.supportedNodeCount !== structure.supportedNodeIds.length) {
    throw new Error(
      `El resumen declara ${summary.supportedNodeCount} nodos apoyados pero la geometría tiene ${structure.supportedNodeIds.length}.`,
    );
  }
};

export const validateGeneratedStructure = (structure: GeneratedStructure): void => {
  const project = projectGeneratedStructure(structure);
  validateStructuralEditBoundary(project);
  assertNoCoincidentNodes(project);
  assertRolesMatch(structure);
  assertSupportsMatch(structure);
  assertSummaryCounts(structure);
};
