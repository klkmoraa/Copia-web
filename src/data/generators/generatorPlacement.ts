import type { MemberModel, NodeModel, ProjectModel } from '../../types';
import { nextEntityId, projectTopologyTolerance } from '../modelOperations';
import type { GeneratedStructure } from './generatorTypes';

/**
 * Reubicación de una geometría generada dentro de un proyecto real (CRI-38, fase 2).
 *
 * El núcleo de la fase 1 numera lo que crea con IDs locales (`N1…`, `M1…`) porque
 * es puro y no conoce ningún proyecto. Insertarla exige traducir esa numeración a
 * IDs libres del proyecto destino, y ese es todo el trabajo de este módulo: no
 * mueve coordenadas, no toca propiedades y no decide nada sobre apoyos.
 *
 * La traducción es determinista —mismo proyecto y mismos parámetros, mismos
 * IDs— porque recorre la geometría en su orden de creación y reserva cada ID con
 * la misma regla que el resto del editor (`nextEntityId`), contando también lo
 * ya reservado en este mismo lote.
 *
 * Coincidir con un nodo existente no es un error ni se resuelve aquí: fundir
 * nudos es una decisión del usuario, no un efecto oculto de generar. Se reporta
 * como advertencia y la geometría se inserta completa.
 */

export type PlacementWarningCode = 'coincident-with-existing';

export interface PlacementWarning {
  readonly code: PlacementWarningCode;
  readonly message: string;
}

export interface PlacedGeneratedStructure {
  readonly nodes: readonly NodeModel[];
  readonly members: readonly MemberModel[];
  /** ID local del generador → ID asignado en el proyecto. */
  readonly nodeIdByLocalId: Readonly<Record<string, string>>;
  readonly memberIdByLocalId: Readonly<Record<string, string>>;
  readonly warnings: readonly PlacementWarning[];
}

/**
 * Nodos generados que caen sobre un nodo existente, con la tolerancia del
 * proyecto **fusionado**: la misma que usaría la reparación topológica después
 * de confirmar, para que la advertencia describa lo que de verdad pasaría.
 */
const coincidentNodeCount = (project: ProjectModel, nodes: readonly NodeModel[]): number => {
  if (!project.nodes.length) return 0;
  const tolerance = projectTopologyTolerance({ ...project, nodes: [...project.nodes, ...nodes] });
  return nodes.filter((node) => project.nodes.some(
    (existing) => Math.hypot(existing.x - node.x, existing.y - node.y) <= tolerance,
  )).length;
};

export const placeGeneratedStructure = (
  project: ProjectModel,
  structure: GeneratedStructure,
): PlacedGeneratedStructure => {
  const nodeIdByLocalId: Record<string, string> = {};
  const memberIdByLocalId: Record<string, string> = {};

  const usedNodeIds = project.nodes.map((node) => node.id);
  const nodes = structure.nodes.map((source) => {
    const id = nextEntityId('N', usedNodeIds);
    usedNodeIds.push(id);
    nodeIdByLocalId[source.id] = id;
    return { ...structuredClone(source), id };
  });

  const usedMemberIds = project.members.map((member) => member.id);
  const members = structure.members.map((source) => {
    const id = nextEntityId('M', usedMemberIds);
    usedMemberIds.push(id);
    memberIdByLocalId[source.id] = id;
    const i = nodeIdByLocalId[source.i];
    const j = nodeIdByLocalId[source.j];
    if (!i || !j) throw new Error(`El miembro generado ${source.id} referencia un nodo que no se reubicó.`);
    return { ...structuredClone(source), id, i, j };
  });

  const coincident = coincidentNodeCount(project, nodes);
  const warnings: PlacementWarning[] = coincident === 0 ? [] : [{
    code: 'coincident-with-existing',
    message: coincident === 1
      ? 'Un nodo generado cae sobre un nodo existente; quedan separados hasta que decidas unirlos.'
      : `${coincident.toLocaleString('es-MX')} nodos generados caen sobre nodos existentes; quedan separados hasta que decidas unirlos.`,
  }];

  return { nodes, members, nodeIdByLocalId, memberIdByLocalId, warnings };
};
