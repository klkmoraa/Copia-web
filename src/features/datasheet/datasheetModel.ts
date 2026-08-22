import type { UnitQuantity } from '../../engine/units';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { TranslationKey } from '../../i18n/catalogs';
import type { MemberLoad, MemberModel, NodalLoad, NodeModel, ProjectModel } from '../../types';

/**
 * Proyección tabular del modelo estructural.
 *
 * Este módulo es puro y no conoce React, el store ni el idioma activo: recibe un
 * `ProjectModel` y devuelve filas. Esa es la garantía de que el datasheet no
 * puede convertirse en una segunda fuente de verdad — no hay dónde guardar una
 * copia divergente porque no hay estado que guardar.
 *
 * Las magnitudes viajan siempre en **unidades base internas** (kN, m, m², m⁴).
 * La conversión a las unidades del proyecto ocurre al presentar, nunca aquí: si
 * el orden dependiera del sistema de unidades mostrado, la misma columna
 * ordenaría distinto en kN-m y en kip-ft.
 */

export type DatasheetEntity = 'nodes' | 'members' | 'loads';

/**
 * Por qué una celda no se edita, o **dónde** se edita.
 *
 * CRI-81 declaró `pending` como promesa de la fase de edición. CRI-82 la cumple
 * y la sustituye: cada celda editable dice ahora si se edita en la propia celda
 * o sólo en el editor visual del panel, porque escribe varios campos a la vez y
 * aplicarla a medias dejaría estados que nadie pidió.
 */
export type DatasheetEditability =
  /** Nunca editable: identidad y referencias estructurales. */
  | 'identity'
  /** Nunca editable: se calcula del modelo. */
  | 'derived'
  /** Editable en la propia celda. */
  | 'inline'
  /** Editable sólo en el editor visual del panel. */
  | 'panel';

/**
 * Valor de una celda.
 *
 * - `number` lleva la magnitud en unidad base y la cantidad con la que se
 *   convierte y se rotula; `null` es ausencia real, no cero.
 * - `token` lleva una clave estable del dominio (`pin`, `frame`, …) y su clave
 *   de traducción. Se guarda el token, no el texto, para que ordenar y filtrar
 *   no dependan del idioma.
 * - `text` es texto ya legible que no procede de un enumerado (nombre de
 *   catálogo, resumen de liberaciones).
 * - `ref` es una referencia a algo que el usuario nombra (un caso de carga). A
 *   diferencia de `token`, su etiqueta **es** dato del proyecto y no una
 *   traducción, así que ordenar por ella es lo correcto y no depende del idioma.
 */
export type DatasheetValue =
  | { kind: 'text'; text: string }
  | { kind: 'number'; value: number | null; quantity?: UnitQuantity }
  | { kind: 'token'; token: string; labelKey: TranslationKey }
  | { kind: 'ref'; id: string; label: string };

export interface DatasheetColumn {
  id: string;
  labelKey: TranslationKey;
  editability: DatasheetEditability;
  /** Cantidad física de la columna; su ausencia significa adimensional. */
  quantity?: UnitQuantity;
  /** Las columnas numéricas se alinean a la derecha para poder compararlas. */
  numeric?: boolean;
}

export type DatasheetRowKind = 'node' | 'member' | 'nodalLoad' | 'memberLoad';

export interface DatasheetRow {
  id: string;
  kind: DatasheetRowKind;
  values: Readonly<Record<string, DatasheetValue>>;
}

export interface DatasheetFacetOption {
  token: string;
  /** Etiqueta traducible de un enumerado del dominio. */
  labelKey?: TranslationKey;
  /** Etiqueta que escribe el usuario; excluyente con `labelKey`. */
  label?: string;
  count: number;
}

export interface DatasheetFacet {
  columnId: string;
  labelKey: TranslationKey;
  /** Tokens presentes en el modelo actual, en orden estable de catálogo. */
  options: readonly DatasheetFacetOption[];
}

export type DatasheetSortDirection = 'asc' | 'desc';

export interface DatasheetSort {
  columnId: string;
  direction: DatasheetSortDirection;
}

const SUPPORT_LABELS: Record<string, TranslationKey> = {
  none: 'datasheet.support.none',
  pin: 'datasheet.support.pin',
  roller: 'datasheet.support.roller',
  fixed: 'datasheet.support.fixed',
  custom: 'datasheet.support.custom',
};

const MEMBER_TYPE_LABELS: Record<string, TranslationKey> = {
  frame: 'datasheet.memberType.frame',
  truss: 'datasheet.memberType.truss',
  rigid: 'datasheet.memberType.rigid',
};

const ORIGIN_LABELS: Record<string, TranslationKey> = {
  catalog: 'datasheet.origin.catalog',
  custom: 'datasheet.origin.custom',
  imported: 'datasheet.origin.imported',
  legacy: 'datasheet.origin.legacy',
};

const BOOLEAN_LABELS: Record<string, TranslationKey> = {
  yes: 'datasheet.boolean.yes',
  no: 'datasheet.boolean.no',
};

const LOAD_FAMILY_LABELS: Record<string, TranslationKey> = {
  nodal: 'datasheet.loadFamily.nodal',
  distributed: 'datasheet.loadFamily.distributed',
  point: 'datasheet.loadFamily.point',
  moment: 'datasheet.loadFamily.moment',
};

const COORDINATE_SYSTEM_LABELS: Record<string, TranslationKey> = {
  global: 'datasheet.coordinateSystem.global',
  local: 'datasheet.coordinateSystem.local',
};

const LENGTH_BASIS_LABELS: Record<string, TranslationKey> = {
  real: 'datasheet.lengthBasis.real',
  horizontal: 'datasheet.lengthBasis.horizontal',
  vertical: 'datasheet.lengthBasis.vertical',
};

/** Orden de presentación de los tokens; el orden alfabético no dice nada aquí. */
const TOKEN_ORDER: Record<string, readonly string[]> = {
  support: ['none', 'pin', 'roller', 'fixed', 'custom'],
  type: ['frame', 'truss', 'rigid'],
  materialOrigin: ['catalog', 'custom', 'imported', 'legacy'],
  hinge: ['no', 'yes'],
  family: ['nodal', 'distributed', 'point', 'moment'],
};

export const NODE_COLUMNS: readonly DatasheetColumn[] = [
  { id: 'id', labelKey: 'datasheet.column.id', editability: 'identity' },
  { id: 'x', labelKey: 'datasheet.column.x', editability: 'inline', quantity: 'length', numeric: true },
  { id: 'y', labelKey: 'datasheet.column.y', editability: 'inline', quantity: 'length', numeric: true },
  { id: 'support', labelKey: 'datasheet.column.support', editability: 'inline' },
  { id: 'restraints', labelKey: 'datasheet.column.restraints', editability: 'derived' },
  { id: 'hinge', labelKey: 'datasheet.column.hinge', editability: 'inline' },
  { id: 'loads', labelKey: 'datasheet.column.loads', editability: 'derived', numeric: true },
];

export const MEMBER_COLUMNS: readonly DatasheetColumn[] = [
  { id: 'id', labelKey: 'datasheet.column.id', editability: 'identity' },
  { id: 'i', labelKey: 'datasheet.column.nodeI', editability: 'identity' },
  { id: 'j', labelKey: 'datasheet.column.nodeJ', editability: 'identity' },
  { id: 'type', labelKey: 'datasheet.column.memberType', editability: 'inline' },
  { id: 'length', labelKey: 'datasheet.column.length', editability: 'derived', quantity: 'length', numeric: true },
  { id: 'material', labelKey: 'datasheet.column.material', editability: 'inline' },
  { id: 'materialOrigin', labelKey: 'datasheet.column.materialOrigin', editability: 'derived' },
  { id: 'E', labelKey: 'datasheet.column.elasticModulus', editability: 'inline', quantity: 'elasticModulus', numeric: true },
  { id: 'section', labelKey: 'datasheet.column.section', editability: 'inline' },
  { id: 'A', labelKey: 'datasheet.column.area', editability: 'inline', quantity: 'area', numeric: true },
  { id: 'I', labelKey: 'datasheet.column.inertia', editability: 'inline', quantity: 'inertia', numeric: true },
  // Dos booleanos en una sola celda: se editan juntos en el panel o no se
  // entiende cuál de los dos extremos se está liberando.
  { id: 'releases', labelKey: 'datasheet.column.releases', editability: 'panel' },
  { id: 'loads', labelKey: 'datasheet.column.loads', editability: 'derived', numeric: true },
];

/**
 * Columnas de la tabla de cargas: la **unión** de las dos familias del modelo.
 *
 * Una celda que no pertenece a la familia de su fila se proyecta como ausencia
 * (`value: null`), no como cero: una repartida no tiene un Fx que valga cero,
 * tiene un Fx que no existe.
 *
 * Objeto y familia son `identity`. Cambiar el nudo de una carga es reconectar
 * el modelo, no editar una propiedad; y convertir una repartida en puntual es
 * sustituir la carga por otra con otros campos obligatorios, no cambiar un
 * valor. Las dos tienen sus propias operaciones fuera de esta tabla.
 */
export const LOAD_COLUMNS: readonly DatasheetColumn[] = [
  { id: 'id', labelKey: 'datasheet.column.id', editability: 'identity' },
  { id: 'object', labelKey: 'datasheet.column.loadObject', editability: 'identity' },
  { id: 'family', labelKey: 'datasheet.column.loadFamily', editability: 'identity' },
  { id: 'case', labelKey: 'datasheet.column.loadCase', editability: 'inline' },
  { id: 'fx', labelKey: 'datasheet.column.fx', editability: 'inline', quantity: 'force', numeric: true },
  { id: 'fy', labelKey: 'datasheet.column.fy', editability: 'inline', quantity: 'force', numeric: true },
  { id: 'mz', labelKey: 'datasheet.column.mz', editability: 'inline', quantity: 'moment', numeric: true },
  { id: 'coordinateSystem', labelKey: 'datasheet.column.coordinateSystem', editability: 'inline' },
  { id: 'lengthBasis', labelKey: 'datasheet.column.lengthBasis', editability: 'inline' },
  { id: 'start', labelKey: 'datasheet.column.start', editability: 'inline', numeric: true },
  { id: 'end', labelKey: 'datasheet.column.end', editability: 'inline', numeric: true },
  { id: 'qxStart', labelKey: 'datasheet.column.qxStart', editability: 'inline', quantity: 'distributedForce', numeric: true },
  { id: 'qxEnd', labelKey: 'datasheet.column.qxEnd', editability: 'inline', quantity: 'distributedForce', numeric: true },
  { id: 'qyStart', labelKey: 'datasheet.column.qyStart', editability: 'inline', quantity: 'distributedForce', numeric: true },
  { id: 'qyEnd', labelKey: 'datasheet.column.qyEnd', editability: 'inline', quantity: 'distributedForce', numeric: true },
  { id: 'position', labelKey: 'datasheet.column.position', editability: 'inline', numeric: true },
  { id: 'px', labelKey: 'datasheet.column.px', editability: 'inline', quantity: 'force', numeric: true },
  { id: 'py', labelKey: 'datasheet.column.py', editability: 'inline', quantity: 'force', numeric: true },
  { id: 'moment', labelKey: 'datasheet.column.momentValue', editability: 'inline', quantity: 'moment', numeric: true },
];

export const datasheetColumns = (entity: DatasheetEntity): readonly DatasheetColumn[] =>
  entity === 'nodes' ? NODE_COLUMNS : entity === 'members' ? MEMBER_COLUMNS : LOAD_COLUMNS;

/** Columnas cuyos tokens se ofrecen como filtro; el resto tiene demasiados valores. */
export const datasheetFacetColumnIds = (entity: DatasheetEntity): readonly string[] =>
  entity === 'nodes' ? ['support'] : entity === 'members' ? ['type', 'materialOrigin'] : ['family', 'case'];

const booleanValue = (value: boolean): DatasheetValue => ({
  kind: 'token',
  token: value ? 'yes' : 'no',
  labelKey: BOOLEAN_LABELS[value ? 'yes' : 'no'],
});

/**
 * Grados restringidos del apoyo, en el mismo lenguaje que usa el solver.
 *
 * Un rodillo restringe su normal, no un eje global, así que se rotula como tal
 * en vez de traducirlo a X o Y: la orientación vive en `angleDeg`.
 */
const restraintSummary = (node: NodeModel): string => {
  const support = node.support;
  switch (support.type) {
    case 'none': return '—';
    case 'pin': return 'X Y';
    case 'fixed': return 'X Y Rz';
    case 'roller': return `n ${Math.round(support.angleDeg ?? 90)}°`;
    case 'custom': {
      const parts = [
        support.restrainX ? 'X' : null,
        support.restrainY ? 'Y' : null,
        support.restrainR ? 'Rz' : null,
      ].filter((part): part is string => part !== null);
      return parts.length > 0 ? parts.join(' ') : '—';
    }
  }
};

const releaseSummary = (member: MemberModel): string => {
  const parts = [
    member.releases?.iMoment ? 'i' : null,
    member.releases?.jMoment ? 'j' : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' ') : '—';
};

/**
 * Nombre de material o sección.
 *
 * Sólo una identidad de catálogo se rotula con su nombre; cualquier otro origen
 * se rotula como personalizado. Deducir un perfil a partir de A e I sería
 * inventar una identidad que el modelo no declara, la misma regla que aplica
 * `resolveSectionGeometry`.
 */
const catalogName = (
  id: string | undefined,
  origin: MemberModel['materialOrigin'],
  lookup: (id: string) => { name: string } | undefined,
): DatasheetValue => {
  if (origin === 'catalog' && id) {
    const found = lookup(id);
    if (found) return { kind: 'text', text: found.name };
  }
  return { kind: 'token', token: 'custom', labelKey: ORIGIN_LABELS.custom };
};

const nodeRow = (
  node: NodeModel,
  loadCount: number,
): DatasheetRow => ({
  id: node.id,
  kind: 'node',
  values: {
    id: { kind: 'text', text: node.id },
    x: { kind: 'number', value: node.x, quantity: 'length' },
    y: { kind: 'number', value: node.y, quantity: 'length' },
    support: { kind: 'token', token: node.support.type, labelKey: SUPPORT_LABELS[node.support.type] },
    restraints: { kind: 'text', text: restraintSummary(node) },
    hinge: booleanValue(node.internalHinge === true),
    loads: { kind: 'number', value: loadCount },
  },
});

const memberRow = (
  member: MemberModel,
  length: number | null,
  loadCount: number,
): DatasheetRow => {
  const materialOrigin = member.materialOrigin ?? 'custom';
  return {
    id: member.id,
    kind: 'member',
    values: {
      id: { kind: 'text', text: member.id },
      i: { kind: 'text', text: member.i },
      j: { kind: 'text', text: member.j },
      type: { kind: 'token', token: member.type, labelKey: MEMBER_TYPE_LABELS[member.type] },
      length: { kind: 'number', value: length, quantity: 'length' },
      material: catalogName(member.materialId, member.materialOrigin, findStandardMaterial),
      materialOrigin: { kind: 'token', token: materialOrigin, labelKey: ORIGIN_LABELS[materialOrigin] },
      E: { kind: 'number', value: member.E, quantity: 'elasticModulus' },
      section: catalogName(member.sectionId, member.sectionOrigin, findStandardSection),
      A: { kind: 'number', value: member.A, quantity: 'area' },
      I: { kind: 'number', value: member.I, quantity: 'inertia' },
      releases: { kind: 'text', text: releaseSummary(member) },
      loads: { kind: 'number', value: loadCount },
    },
  };
};

/** Celda que no existe en esta familia. Ausencia declarada, nunca cero. */
const absent = (quantity?: UnitQuantity): DatasheetValue => ({ kind: 'number', value: null, quantity });

const optionalNumber = (value: number | undefined, quantity?: UnitQuantity): DatasheetValue =>
  ({ kind: 'number', value: value ?? null, quantity });

/**
 * Caso de una carga. Un caso borrado deja su id a la vista en vez de una celda
 * vacía, que escondería que la carga apunta a algo que ya no existe.
 */
const caseValue = (caseId: string, caseNames: ReadonlyMap<string, string>): DatasheetValue =>
  ({ kind: 'ref', id: caseId, label: caseNames.get(caseId) ?? caseId });

const nodalLoadRow = (load: NodalLoad, caseNames: ReadonlyMap<string, string>): DatasheetRow => ({
  id: load.id,
  kind: 'nodalLoad',
  values: {
    id: { kind: 'text', text: load.id },
    object: { kind: 'text', text: load.nodeId },
    family: { kind: 'token', token: 'nodal', labelKey: LOAD_FAMILY_LABELS.nodal },
    case: caseValue(load.caseId, caseNames),
    fx: { kind: 'number', value: load.fx, quantity: 'force' },
    fy: { kind: 'number', value: load.fy, quantity: 'force' },
    mz: { kind: 'number', value: load.mz, quantity: 'moment' },
    coordinateSystem: absent(),
    lengthBasis: absent(),
    start: absent(),
    end: absent(),
    qxStart: absent('distributedForce'),
    qxEnd: absent('distributedForce'),
    qyStart: absent('distributedForce'),
    qyEnd: absent('distributedForce'),
    position: absent(),
    px: absent('force'),
    py: absent('force'),
    moment: absent('moment'),
  },
});

const memberLoadRow = (load: MemberLoad, caseNames: ReadonlyMap<string, string>): DatasheetRow => {
  const distributed = load.type === 'distributed';
  const point = load.type === 'point';
  const moment = load.type === 'moment';
  return {
    id: load.id,
    kind: 'memberLoad',
    values: {
      id: { kind: 'text', text: load.id },
      object: { kind: 'text', text: load.memberId },
      family: { kind: 'token', token: load.type, labelKey: LOAD_FAMILY_LABELS[load.type] },
      case: caseValue(load.caseId, caseNames),
      fx: absent('force'),
      fy: absent('force'),
      mz: absent('moment'),
      // Un momento se aplica en un punto: no tiene ejes de referencia que elegir.
      coordinateSystem: moment
        ? absent()
        : { kind: 'token', token: load.coordinateSystem, labelKey: COORDINATE_SYSTEM_LABELS[load.coordinateSystem] },
      lengthBasis: distributed
        ? { kind: 'token', token: load.lengthBasis, labelKey: LENGTH_BASIS_LABELS[load.lengthBasis] }
        : absent(),
      start: distributed ? { kind: 'number', value: load.start } : absent(),
      end: distributed ? { kind: 'number', value: load.end } : absent(),
      qxStart: distributed ? optionalNumber(load.qxStart, 'distributedForce') : absent('distributedForce'),
      qxEnd: distributed ? optionalNumber(load.qxEnd, 'distributedForce') : absent('distributedForce'),
      qyStart: distributed ? optionalNumber(load.qyStart, 'distributedForce') : absent('distributedForce'),
      qyEnd: distributed ? optionalNumber(load.qyEnd, 'distributedForce') : absent('distributedForce'),
      position: point || moment ? optionalNumber(load.position) : absent(),
      px: point ? optionalNumber(load.px, 'force') : absent('force'),
      py: point ? optionalNumber(load.py, 'force') : absent('force'),
      moment: moment ? optionalNumber(load.moment, 'moment') : absent('moment'),
    },
  };
};

/**
 * Proyecta el modelo a filas. Recorre cada colección una sola vez y cuenta las
 * cargas con índices previos: contar dentro del bucle de nudos convertiría una
 * tabla de mil filas en un recorrido cuadrático sobre las cargas.
 */
export const projectDatasheetRows = (
  project: ProjectModel,
  entity: DatasheetEntity,
): DatasheetRow[] => {
  if (entity === 'loads') {
    const caseNames = new Map(project.loadCases.map((item) => [item.id, item.name]));
    return [
      ...project.nodalLoads.map((load) => nodalLoadRow(load, caseNames)),
      ...project.memberLoads.map((load) => memberLoadRow(load, caseNames)),
    ];
  }

  if (entity === 'nodes') {
    const loadsByNode = new Map<string, number>();
    for (const load of project.nodalLoads) loadsByNode.set(load.nodeId, (loadsByNode.get(load.nodeId) ?? 0) + 1);
    for (const item of project.prescribedDisplacements ?? []) {
      loadsByNode.set(item.nodeId, (loadsByNode.get(item.nodeId) ?? 0) + 1);
    }
    return project.nodes.map((node) => nodeRow(node, loadsByNode.get(node.id) ?? 0));
  }

  const loadsByMember = new Map<string, number>();
  for (const load of project.memberLoads) loadsByMember.set(load.memberId, (loadsByMember.get(load.memberId) ?? 0) + 1);
  for (const effect of project.memberInitialEffects ?? []) {
    loadsByMember.set(effect.memberId, (loadsByMember.get(effect.memberId) ?? 0) + 1);
  }
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  return project.members.map((member) => {
    const start = nodeById.get(member.i);
    const end = nodeById.get(member.j);
    // Una barra puede referenciar un nudo ausente en un modelo importado a
    // medias: se muestra sin longitud en vez de propagar un NaN por la columna.
    const length = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : null;
    return memberRow(member, length, loadsByMember.get(member.id) ?? 0);
  });
};

/** Texto sobre el que busca la caja de búsqueda; el llamador traduce los tokens. */
export const datasheetRowSearchText = (
  row: DatasheetRow,
  translateToken: (labelKey: TranslationKey) => string,
  formatNumeric: (value: number, quantity?: UnitQuantity) => string,
): string => {
  const parts: string[] = [row.id];
  for (const value of Object.values(row.values)) {
    if (value.kind === 'text') parts.push(value.text);
    else if (value.kind === 'token') parts.push(translateToken(value.labelKey));
    else if (value.kind === 'ref') parts.push(value.label);
    else if (value.value !== null) parts.push(formatNumeric(value.value, value.quantity));
  }
  return parts.join(' ').toLowerCase();
};

/**
 * Búsqueda por subcadena sobre el texto ya presentado.
 *
 * Se normalizan los acentos para que «seccion» encuentre «sección»: en un
 * datasheet técnico, obligar a acentuar es una barrera sin contrapartida.
 */
const normalizeSearch = (value: string): string =>
  value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export const searchDatasheetRows = (
  rows: readonly DatasheetRow[],
  query: string,
  haystack: (row: DatasheetRow) => string,
): DatasheetRow[] => {
  const needle = normalizeSearch(query);
  if (needle === '') return [...rows];
  return rows.filter((row) => normalizeSearch(haystack(row)).includes(needle));
};

/** Facetas presentes en las filas dadas, con su recuento y en orden de dominio. */
export const datasheetFacets = (
  rows: readonly DatasheetRow[],
  entity: DatasheetEntity,
): DatasheetFacet[] => {
  const columns = datasheetColumns(entity);
  return datasheetFacetColumnIds(entity).flatMap((columnId) => {
    const column = columns.find((candidate) => candidate.id === columnId);
    if (!column) return [];
    const counts = new Map<string, { labelKey?: TranslationKey; label?: string; count: number }>();
    for (const row of rows) {
      const value = row.values[columnId];
      // Una faceta agrupa por clave estable: el token de un enumerado o el id de
      // una referencia. La etiqueta acompaña, pero nunca es la que agrupa.
      const token = value?.kind === 'token' ? value.token : value?.kind === 'ref' ? value.id : null;
      if (token === null || !value) continue;
      const current = counts.get(token);
      if (current) current.count += 1;
      else if (value.kind === 'token') counts.set(token, { labelKey: value.labelKey, count: 1 });
      else if (value.kind === 'ref') counts.set(token, { label: value.label, count: 1 });
    }
    const order = TOKEN_ORDER[columnId] ?? [];
    const options = [...counts.entries()]
      .map(([token, entry]) => ({ token, labelKey: entry.labelKey, label: entry.label, count: entry.count }))
      .sort((first, second) => {
        const firstIndex = order.indexOf(first.token);
        const secondIndex = order.indexOf(second.token);
        if (firstIndex !== secondIndex) return (firstIndex < 0 ? order.length : firstIndex) - (secondIndex < 0 ? order.length : secondIndex);
        return first.token.localeCompare(second.token);
      });
    return options.length > 1 ? [{ columnId, labelKey: column.labelKey, options }] : [];
  });
};

/** Filtros activos por columna. Un conjunto vacío no filtra: no oculta todo. */
export type DatasheetFilters = Readonly<Record<string, ReadonlySet<string>>>;

export const filterDatasheetRows = (
  rows: readonly DatasheetRow[],
  filters: DatasheetFilters,
): DatasheetRow[] => {
  const active = Object.entries(filters).filter(([, tokens]) => tokens.size > 0);
  if (active.length === 0) return [...rows];
  return rows.filter((row) => active.every(([columnId, tokens]) => {
    const value = row.values[columnId];
    if (value?.kind === 'token') return tokens.has(value.token);
    return value?.kind === 'ref' && tokens.has(value.id);
  }));
};

/**
 * Comparación estable dentro de una columna.
 *
 * Los números se comparan como números y la ausencia (`null`) va siempre al
 * final, ascendente o descendente: una celda vacía no es «menor que cero», es
 * una celda sin dato, y enterrarla entre valores reales la haría parecer uno.
 * Los tokens se comparan por su clave estable, nunca por su traducción. Una
 * referencia se compara por su etiqueta porque ésa es la que escribió el
 * usuario: ordenar los casos de carga por su id interno no diría nada.
 */
const comparableText = (value: DatasheetValue): string => {
  switch (value.kind) {
    case 'token': return value.token;
    case 'text': return value.text;
    case 'ref': return value.label;
    case 'number': return '';
  }
};

const compareValues = (first: DatasheetValue | undefined, second: DatasheetValue | undefined): number => {
  if (!first || !second) return 0;
  if (first.kind === 'number' && second.kind === 'number') {
    if (first.value === null) return second.value === null ? 0 : 1;
    if (second.value === null) return -1;
    return first.value - second.value;
  }
  return comparableText(first).localeCompare(comparableText(second), undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Ordena por una columna. Con valores iguales gana el orden del modelo, así que
 * reordenar dos veces por la misma columna devuelve exactamente la misma tabla.
 */
export const sortDatasheetRows = (
  rows: readonly DatasheetRow[],
  sort: DatasheetSort | null,
): DatasheetRow[] => {
  if (!sort) return [...rows];
  const indexed = rows.map((row, index) => ({ row, index }));
  const sign = sort.direction === 'asc' ? 1 : -1;
  indexed.sort((first, second) => {
    const firstValue = first.row.values[sort.columnId];
    const secondValue = second.row.values[sort.columnId];
    // La ausencia se mantiene al final en ambos sentidos, así que no se invierte.
    if (firstValue?.kind === 'number' && secondValue?.kind === 'number') {
      if (firstValue.value === null || secondValue.value === null) {
        const comparison = compareValues(firstValue, secondValue);
        if (comparison !== 0) return comparison;
        return first.index - second.index;
      }
    }
    const comparison = compareValues(firstValue, secondValue) * sign;
    return comparison !== 0 ? comparison : first.index - second.index;
  });
  return indexed.map((entry) => entry.row);
};

export interface DatasheetPipelineInput {
  rows: readonly DatasheetRow[];
  query: string;
  filters: DatasheetFilters;
  sort: DatasheetSort | null;
  haystack: (row: DatasheetRow) => string;
}

/** Búsqueda, después filtros, después orden. El orden nunca decide qué se ve. */
export const applyDatasheetPipeline = ({
  rows,
  query,
  filters,
  sort,
  haystack,
}: DatasheetPipelineInput): DatasheetRow[] =>
  sortDatasheetRows(filterDatasheetRows(searchDatasheetRows(rows, query, haystack), filters), sort);
