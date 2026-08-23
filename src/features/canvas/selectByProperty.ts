/**
 * Seleccionar por propiedad.
 *
 * QUE PROBLEMA RESUELVE. El producto tiene una edición masiva completa
 * —`bulkEditScope.ts` agrupa por familia, calcula compatibilidades y prepara
 * intenciones reversibles— y la única forma de llegar a ella era señalar los
 * objetos **uno a uno** en el lienzo. En un pórtico de ejemplo eso es un clic;
 * en una malla generada son cincuenta, y el error de haberse dejado uno no se
 * ve hasta después de aplicar.
 *
 * QUE **NO** HACE, y por qué importa. No toca el motor, no inventa un modo de
 * selección nuevo y no añade estado. Produce una selección múltiple
 * —`Selection` ya admite `{ kind: 'multi'; nodeIds; memberIds }` desde antes de
 * este cambio— y ahí se acaba su trabajo: el bulk-edit la consume tal cual, sin
 * una línea de pegamento, porque es exactamente la misma selección que produce
 * arrastrar un rectángulo sobre el lienzo.
 *
 * POR QUE ES UN MODULO PURO. De datos a datos, sin React y sin DOM: cada
 * predicado se prueba contra un modelo, no contra una pantalla.
 */
import type { ProjectModel, Selection, SupportType } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';

export interface SelectionQueryResult {
  nodeIds: string[];
  memberIds: string[];
}

export const EMPTY_SELECTION_QUERY_RESULT: SelectionQueryResult = { nodeIds: [], memberIds: [] };

export type SelectionQueryId =
  | 'members.frame'
  | 'members.truss'
  | 'members.released'
  | 'members.loaded'
  | 'members.unloaded'
  | 'members.similar'
  | 'nodes.supported'
  | 'nodes.free'
  | 'nodes.loaded'
  | 'nodes.support.pin'
  | 'nodes.support.roller'
  | 'nodes.support.fixed';

export interface SelectionQuery {
  id: SelectionQueryId;
  labelKey: TranslationKey;
  /**
   * `true` cuando la consulta necesita algo seleccionado para tener sentido.
   * «Similares» sin selección no es una consulta vacía: es una consulta que no
   * se puede formular, y ofrecerla desactivada dice más que ofrecer cero.
   */
  needsSelection?: boolean;
  run: (project: ProjectModel, selection: Selection) => SelectionQueryResult;
}

const memberIdsOf = (project: ProjectModel, predicate: (member: ProjectModel['members'][number]) => boolean): SelectionQueryResult => ({
  nodeIds: [],
  memberIds: project.members.filter(predicate).map((member) => member.id),
});

const nodeIdsOf = (project: ProjectModel, predicate: (node: ProjectModel['nodes'][number]) => boolean): SelectionQueryResult => ({
  nodeIds: project.nodes.filter(predicate).map((node) => node.id),
  memberIds: [],
});

const loadedMemberIds = (project: ProjectModel): ReadonlySet<string> =>
  new Set(project.memberLoads.map((load) => load.memberId));

const loadedNodeIds = (project: ProjectModel): ReadonlySet<string> =>
  new Set(project.nodalLoads.map((load) => load.nodeId));

/** Un extremo liberado es `releases.iMoment` o `releases.jMoment` en `true`. */
const hasMomentRelease = (member: ProjectModel['members'][number]): boolean =>
  member.releases?.iMoment === true || member.releases?.jMoment === true;

const supportOf = (type: SupportType) => (node: ProjectModel['nodes'][number]) => node.support.type === type;

/**
 * Los miembros de la selección actual, vengan de una selección simple o
 * múltiple. Una carga en barra también cuenta: quien selecciona una carga está
 * señalando la barra que la lleva.
 */
const selectedMembers = (project: ProjectModel, selection: Selection): ProjectModel['members'] => {
  if (!selection) return [];
  const ids = new Set<string>();
  if (selection.kind === 'member') ids.add(selection.id);
  if (selection.kind === 'multi') selection.memberIds.forEach((id) => ids.add(id));
  if (selection.kind === 'memberLoad') {
    const load = project.memberLoads.find((item) => item.id === selection.id);
    if (load) ids.add(load.memberId);
  }
  return project.members.filter((member) => ids.has(member.id));
};

/**
 * «Similares» = misma sección **y** mismo material que algo de lo seleccionado.
 *
 * La comparación es por identidad de catálogo cuando la hay (`sectionId` /
 * `materialId`) y por los números del solver cuando no (`E`, `A`, `I`). Es la
 * misma distinción que ya hace el Inspector entre un perfil elegido del
 * catálogo y uno tecleado a mano: dos barras con la misma E y la misma I son
 * la misma sección aunque nadie les haya puesto nombre.
 */
const similarityKey = (member: ProjectModel['members'][number]): string => [
  member.type,
  member.sectionId ?? `A:${member.A}|I:${member.I}`,
  member.materialId ?? `E:${member.E}`,
].join('·');

export const SELECTION_QUERIES: readonly SelectionQuery[] = [
  {
    id: 'members.similar',
    labelKey: 'select.membersSimilar',
    needsSelection: true,
    run: (project, selection) => {
      const keys = new Set(selectedMembers(project, selection).map(similarityKey));
      if (keys.size === 0) return EMPTY_SELECTION_QUERY_RESULT;
      return memberIdsOf(project, (member) => keys.has(similarityKey(member)));
    },
  },
  { id: 'members.frame', labelKey: 'select.membersFrame', run: (project) => memberIdsOf(project, (member) => member.type === 'frame') },
  { id: 'members.truss', labelKey: 'select.membersTruss', run: (project) => memberIdsOf(project, (member) => member.type === 'truss') },
  { id: 'members.released', labelKey: 'select.membersReleased', run: (project) => memberIdsOf(project, hasMomentRelease) },
  {
    id: 'members.loaded',
    labelKey: 'select.membersLoaded',
    run: (project) => {
      const loaded = loadedMemberIds(project);
      return memberIdsOf(project, (member) => loaded.has(member.id));
    },
  },
  {
    id: 'members.unloaded',
    labelKey: 'select.membersUnloaded',
    run: (project) => {
      const loaded = loadedMemberIds(project);
      return memberIdsOf(project, (member) => !loaded.has(member.id));
    },
  },
  { id: 'nodes.supported', labelKey: 'select.nodesSupported', run: (project) => nodeIdsOf(project, (node) => node.support.type !== 'none') },
  { id: 'nodes.free', labelKey: 'select.nodesFree', run: (project) => nodeIdsOf(project, (node) => node.support.type === 'none') },
  {
    id: 'nodes.loaded',
    labelKey: 'select.nodesLoaded',
    run: (project) => {
      const loaded = loadedNodeIds(project);
      return nodeIdsOf(project, (node) => loaded.has(node.id));
    },
  },
  { id: 'nodes.support.pin', labelKey: 'select.nodesPin', run: (project) => nodeIdsOf(project, supportOf('pin')) },
  { id: 'nodes.support.roller', labelKey: 'select.nodesRoller', run: (project) => nodeIdsOf(project, supportOf('roller')) },
  { id: 'nodes.support.fixed', labelKey: 'select.nodesFixed', run: (project) => nodeIdsOf(project, supportOf('fixed')) },
];

export const selectionQueryById = (id: SelectionQueryId): SelectionQuery => {
  const query = SELECTION_QUERIES.find((candidate) => candidate.id === id);
  if (!query) throw new Error(`selectByProperty: consulta desconocida "${id}"`);
  return query;
};

export const countOf = (result: SelectionQueryResult): number => result.nodeIds.length + result.memberIds.length;

/**
 * Traduce el resultado a una selección del producto.
 *
 * Siempre `multi`, incluso con un solo objeto: quien pide «todos los apoyos
 * empotrados» y encuentra uno está seleccionando un CONJUNTO de uno, y el
 * panel de edición masiva es el que corresponde. Colapsar a selección simple
 * cambiaría el panel bajo los pies según cuántos hubiera.
 *
 * Cero resultados devuelve `null` —deseleccionar— en vez de una selección
 * múltiple vacía, que ningún consumidor sabe leer.
 */
export const toSelection = (result: SelectionQueryResult): Selection => (
  countOf(result) === 0 ? null : { kind: 'multi', nodeIds: result.nodeIds, memberIds: result.memberIds }
);

/** Las consultas que hoy encuentran algo, con su recuento, en orden de lectura. */
export const availableSelectionQueries = (
  project: ProjectModel,
  selection: Selection,
): ReadonlyArray<{ query: SelectionQuery; count: number }> => SELECTION_QUERIES
  .map((query) => ({ query, count: countOf(query.run(project, selection)) }))
  .filter((entry) => entry.count > 0);
