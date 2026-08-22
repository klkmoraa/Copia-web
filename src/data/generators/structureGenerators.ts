import type { MemberModel, MemberType, NodeModel, SupportDefinition, SupportType } from '../../types';
import type { Point2D } from '../structuralEditing';
import { resolveGeneratorMemberProperties, type ResolvedGeneratorMemberProperties } from './generatorProperties';
import { isUniformSpacing, resolveSpacingStations, roundGeneratedCoordinate } from './generatorSpacing';
import type {
  GeneratedMemberRole,
  GeneratedNodeRole,
  GeneratedStructure,
  GeneratedStructureSummary,
  GeneratorParams,
  GeneratorWarning,
  TrussTopology,
} from './generatorTypes';
import { validateGeneratedStructure } from './generatorValidation';

/**
 * Núcleo determinista de generación 2D (CRI-38, fase 1).
 *
 * Una sola entrada, `generateStructure`, traduce parámetros en nodos, miembros y
 * conectividad. Es puro: no toca el proyecto, no crea comandos, no conoce React
 * y no guarda ninguna asociación paramétrica. Los mismos parámetros producen
 * siempre los mismos IDs, las mismas coordenadas y el mismo orden, porque todo
 * el reparto de identidad ocurre en el orden de creación documentado en cada
 * familia y las coordenadas se redondean con la misma regla.
 *
 * Lo que el usuario no pidió no se genera: sin apoyos por defecto, sin cargas de
 * ningún tipo y sin material o sección inventados.
 */

/** Mismo presupuesto que la replicación estructural: una operación, un undo. */
export const MAX_GENERATED_ENTITIES = 2_000;

/** A partir de aquí conviene revisar el modelo antes de confirmarlo. */
export const LARGE_MODEL_ENTITIES = 400;

const SUPPORT_TYPES: readonly SupportType[] = ['none', 'pin', 'roller', 'fixed', 'custom'];
const MEMBER_TYPES: readonly MemberType[] = ['frame', 'truss', 'rigid'];
const TRUSS_TOPOLOGIES: readonly TrussTopology[] = ['pratt', 'warren', 'howe'];
const GRID_MEMBER_MODES = ['both', 'horizontal', 'vertical', 'none'] as const;

const TRUSS_NAMES: Record<TrussTopology, string> = { pratt: 'Pratt', warren: 'Warren', howe: 'Howe' };

const assertPositive = (value: number, message: string): void => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(message);
};

const resolveOrigin = (origin: Point2D | undefined): Point2D => {
  const point = origin ?? { x: 0, y: 0 };
  if (!Number.isFinite(point.x)) throw new Error('El origen X debe ser finito.');
  if (!Number.isFinite(point.y)) throw new Error('El origen Y debe ser finito.');
  return point;
};

const resolveMemberType = (requested: MemberType | undefined, fallback: MemberType): MemberType => {
  if (requested === undefined) return fallback;
  if (!MEMBER_TYPES.includes(requested)) throw new Error('El tipo de miembro no es válido.');
  if (requested === 'rigid') throw new Error('Los generadores no crean vínculos rígidos.');
  return requested;
};

const resolveSupport = (support: SupportDefinition | undefined): SupportDefinition | null => {
  if (!support) return null;
  if (!SUPPORT_TYPES.includes(support.type)) throw new Error('El tipo de apoyo no es válido.');
  return support.type === 'none' ? null : support;
};

interface GeneratedGeometryBuilder {
  readonly nodes: NodeModel[];
  readonly members: MemberModel[];
  readonly nodeRoles: Record<string, GeneratedNodeRole>;
  readonly memberRoles: Record<string, GeneratedMemberRole>;
  addNode: (x: number, y: number, role: GeneratedNodeRole) => string;
  addMember: (i: string, j: string, role: GeneratedMemberRole) => string;
}

const createGeometryBuilder = (
  memberType: MemberType,
  properties: ResolvedGeneratorMemberProperties,
  origin: Point2D,
): GeneratedGeometryBuilder => {
  const nodes: NodeModel[] = [];
  const members: MemberModel[] = [];
  const nodeRoles: Record<string, GeneratedNodeRole> = {};
  const memberRoles: Record<string, GeneratedMemberRole> = {};

  const assertBudget = () => {
    if (nodes.length + members.length > MAX_GENERATED_ENTITIES) {
      throw new Error(
        `La geometría generada excede el límite de ${MAX_GENERATED_ENTITIES.toLocaleString('es-MX')} entidades. Reduce las divisiones.`,
      );
    }
  };

  return {
    nodes,
    members,
    nodeRoles,
    memberRoles,
    addNode: (x, y, role) => {
      const id = `N${nodes.length + 1}`;
      nodes.push({
        id,
        x: roundGeneratedCoordinate(origin.x + x),
        y: roundGeneratedCoordinate(origin.y + y),
        support: { type: 'none' },
      });
      nodeRoles[id] = role;
      assertBudget();
      return id;
    },
    addMember: (i, j, role) => {
      const id = `M${members.length + 1}`;
      // Las propiedades resueltas son escalares: el spread ya da a cada miembro
      // su propia copia, sin estado compartido entre miembros ni generaciones.
      members.push({ id, i, j, type: memberType, ...properties });
      memberRoles[id] = role;
      assertBudget();
      return id;
    },
  };
};

interface FamilyResult {
  readonly builder: GeneratedGeometryBuilder;
  readonly description: string;
  /** Nodos que reciben el apoyo elegido, si el usuario eligió alguno. */
  readonly supportCandidateIds: readonly string[];
  readonly warnings: readonly GeneratorWarning[];
}

/** Viga continua: una fila de nodos y un miembro por claro; todo nodo es un apoyo posible. */
const buildContinuousBeam = (
  builder: GeneratedGeometryBuilder,
  params: Extract<GeneratorParams, { kind: 'continuous-beam' }>,
): FamilyResult => {
  const stations = resolveSpacingStations(params.spans, 'Claros');
  const ids = stations.map((x) => builder.addNode(x, 0, 'joint'));
  for (let span = 0; span < ids.length - 1; span += 1) builder.addMember(ids[span], ids[span + 1], 'beam');
  return { builder, description: 'Viga continua', supportCandidateIds: ids, warnings: [] };
};

/**
 * Marco ortogonal. Los nodos se crean nivel por nivel de abajo hacia arriba y,
 * dentro de cada nivel, de izquierda a derecha. Los miembros se crean por
 * entrepiso: primero sus columnas y luego las vigas que lo cierran.
 */
const buildFrame = (
  builder: GeneratedGeometryBuilder,
  bays: Extract<GeneratorParams, { kind: 'multi-story-frame' }>['bays'],
  stories: Extract<GeneratorParams, { kind: 'multi-story-frame' }>['stories'],
  description: string,
): FamilyResult => {
  const columns = resolveSpacingStations(bays, 'Crujías');
  const levels = resolveSpacingStations(stories, 'Niveles');
  const grid = levels.map((y, level) => columns.map((x) => builder.addNode(x, y, level === 0 ? 'base' : 'joint')));

  for (let story = 0; story < levels.length - 1; story += 1) {
    for (let column = 0; column < columns.length; column += 1) {
      builder.addMember(grid[story][column], grid[story + 1][column], 'column');
    }
    for (let bay = 0; bay < columns.length - 1; bay += 1) {
      builder.addMember(grid[story + 1][bay], grid[story + 1][bay + 1], 'beam');
    }
  }
  return { builder, description, supportCandidateIds: grid[0], warnings: [] };
};

type ChordRef = { readonly chord: 'bottom' | 'top'; readonly index: number };

/** Diagonales de cada topología, expresadas como índices de panel y no como coordenadas. */
const trussDiagonals = (topology: TrussTopology, panels: number): readonly (readonly [ChordRef, ChordRef])[] => {
  const diagonals: (readonly [ChordRef, ChordRef])[] = [];
  for (let panel = 0; panel < panels; panel += 1) {
    const bottomStart = { chord: 'bottom', index: panel } as const;
    const topStart = { chord: 'top', index: panel } as const;
    const bottomEnd = { chord: 'bottom', index: panel + 1 } as const;
    const topEnd = { chord: 'top', index: panel + 1 } as const;
    if (topology === 'warren') {
      diagonals.push(panel % 2 === 0 ? [bottomStart, topEnd] : [topStart, bottomEnd]);
      continue;
    }
    const leftHalf = panel < panels / 2;
    // Pratt tracciona sus diagonales bajando hacia el centro; Howe es su espejo.
    const descending = topology === 'pratt' ? leftHalf : !leftHalf;
    diagonals.push(descending ? [topStart, bottomEnd] : [bottomStart, topEnd]);
  }
  return diagonals;
};

/**
 * Cercha de cordones paralelos. El cordón inferior siempre tiene un nudo por
 * panel; el superior sólo existe donde llega un montante o una diagonal, de modo
 * que la Warren sin montantes no deja nudos colgados sobre el cordón.
 */
const buildTruss = (
  builder: GeneratedGeometryBuilder,
  params: Extract<GeneratorParams, { kind: 'truss' }>,
): FamilyResult => {
  if (!TRUSS_TOPOLOGIES.includes(params.topology)) throw new Error('La topología de cercha no es válida.');
  assertPositive(params.depth, 'El peralte debe ser un número finito mayor que cero.');
  const stations = resolveSpacingStations(params.panels, 'Paneles');
  const panels = stations.length - 1;

  const diagonals = trussDiagonals(params.topology, panels);
  const verticalIndices = params.topology === 'warren' && !params.includeVerticals
    ? [0, panels]
    : stations.map((_, index) => index);

  const usedTopIndices = [...new Set([
    ...verticalIndices,
    ...diagonals.flatMap(([start, end]) => [start, end].filter((ref) => ref.chord === 'top').map((ref) => ref.index)),
  ])].sort((first, second) => first - second);

  const bottomIds = stations.map((x) => builder.addNode(x, 0, 'bottom-chord'));
  const topIds = new Map(usedTopIndices.map((index) => [
    index,
    builder.addNode(stations[index], params.depth, 'top-chord'),
  ]));
  const idOf = (ref: ChordRef): string => {
    const id = ref.chord === 'bottom' ? bottomIds[ref.index] : topIds.get(ref.index);
    if (!id) throw new Error(`La cercha no creó el nudo superior ${ref.index}.`);
    return id;
  };

  for (let panel = 0; panel < panels; panel += 1) builder.addMember(bottomIds[panel], bottomIds[panel + 1], 'bottom-chord');
  for (let used = 0; used < usedTopIndices.length - 1; used += 1) {
    builder.addMember(topIds.get(usedTopIndices[used])!, topIds.get(usedTopIndices[used + 1])!, 'top-chord');
  }
  for (const index of verticalIndices) builder.addMember(bottomIds[index], topIds.get(index)!, 'vertical');
  for (const [start, end] of diagonals) builder.addMember(idOf(start), idOf(end), 'diagonal');

  const warnings: GeneratorWarning[] = [];
  if (!isUniformSpacing(params.panels, 'Paneles')) {
    warnings.push({
      code: 'non-uniform-truss-panels',
      message: 'La cercha tiene paneles desiguales: las diagonales no comparten inclinación.',
    });
  }
  if (panels % 2 === 1) {
    warnings.push({
      code: 'asymmetric-truss-diagonals',
      message: 'La cercha tiene un número impar de paneles: las diagonales no quedan simétricas.',
    });
  }

  return {
    builder,
    description: `Cercha ${TRUSS_NAMES[params.topology]}`,
    supportCandidateIds: [bottomIds[0], bottomIds[panels]],
    warnings,
  };
};

/**
 * Retícula estructural. Los nodos se crean fila por fila de abajo hacia arriba;
 * los miembros horizontales van por fila y los verticales por columna.
 */
const buildGrid = (
  builder: GeneratedGeometryBuilder,
  params: Extract<GeneratorParams, { kind: 'grid' }>,
): FamilyResult => {
  const mode = params.members ?? 'both';
  if (!GRID_MEMBER_MODES.includes(mode)) throw new Error('El modo de miembros de la retícula no es válido.');
  const columns = resolveSpacingStations(params.columns, 'Columnas');
  const rows = resolveSpacingStations(params.rows, 'Filas');
  const grid = rows.map((y, row) => columns.map((x) => builder.addNode(x, y, row === 0 ? 'base' : 'grid')));

  if (mode === 'both' || mode === 'horizontal') {
    for (const row of grid) {
      for (let column = 0; column < columns.length - 1; column += 1) {
        builder.addMember(row[column], row[column + 1], 'grid-horizontal');
      }
    }
  }
  if (mode === 'both' || mode === 'vertical') {
    for (let column = 0; column < columns.length; column += 1) {
      for (let row = 0; row < rows.length - 1; row += 1) {
        builder.addMember(grid[row][column], grid[row + 1][column], 'grid-vertical');
      }
    }
  }
  return { builder, description: 'Retícula estructural', supportCandidateIds: grid[0], warnings: [] };
};

const buildFamily = (
  params: GeneratorParams,
  properties: ResolvedGeneratorMemberProperties,
  origin: Point2D,
): FamilyResult => {
  const builder = (fallback: MemberType) =>
    createGeometryBuilder(resolveMemberType(params.memberType, fallback), properties, origin);

  switch (params.kind) {
    case 'continuous-beam':
      return buildContinuousBeam(builder('frame'), params);
    case 'portal-frame':
      assertPositive(params.height, 'La altura debe ser un número finito mayor que cero.');
      return buildFrame(builder('frame'), params.bays, { kind: 'list', values: [params.height] }, 'Pórtico');
    case 'multi-story-frame':
      return buildFrame(builder('frame'), params.bays, params.stories, 'Marco de varios niveles');
    case 'truss':
      return buildTruss(builder('truss'), params);
    case 'grid':
      return buildGrid(builder('frame'), params);
    default:
      throw new Error('El generador solicitado no es válido.');
  }
};

const summarize = (
  builder: GeneratedGeometryBuilder,
  supportedNodeIds: readonly string[],
  properties: ResolvedGeneratorMemberProperties,
): GeneratedStructureSummary => {
  const nodeById = new Map(builder.nodes.map((node) => [node.id, node]));
  const memberCountsByRole: Partial<Record<GeneratedMemberRole, number>> = {};
  let totalMemberLength = 0;
  for (const member of builder.members) {
    const role = builder.memberRoles[member.id];
    memberCountsByRole[role] = (memberCountsByRole[role] ?? 0) + 1;
    const start = nodeById.get(member.i)!;
    const end = nodeById.get(member.j)!;
    totalMemberLength += Math.hypot(end.x - start.x, end.y - start.y);
  }

  return {
    nodeCount: builder.nodes.length,
    memberCount: builder.members.length,
    supportedNodeCount: supportedNodeIds.length,
    memberCountsByRole,
    totalMemberLength: roundGeneratedCoordinate(totalMemberLength),
    bounds: {
      minX: Math.min(...builder.nodes.map((node) => node.x)),
      minY: Math.min(...builder.nodes.map((node) => node.y)),
      maxX: Math.max(...builder.nodes.map((node) => node.x)),
      maxY: Math.max(...builder.nodes.map((node) => node.y)),
    },
    properties: {
      ...(properties.materialId === undefined ? {} : { materialId: properties.materialId }),
      ...(properties.sectionId === undefined ? {} : { sectionId: properties.sectionId }),
      E: properties.E,
      A: properties.A,
      I: properties.I,
    },
  };
};

const collectWarnings = (
  builder: GeneratedGeometryBuilder,
  supportedNodeIds: readonly string[],
  familyWarnings: readonly GeneratorWarning[],
): GeneratorWarning[] => {
  const warnings: GeneratorWarning[] = [];
  if (!supportedNodeIds.length) {
    warnings.push({
      code: 'no-supports',
      message: 'La geometría se genera sin apoyos. Añádelos antes de analizar el modelo.',
    });
  }
  const entities = builder.nodes.length + builder.members.length;
  if (entities > LARGE_MODEL_ENTITIES) {
    warnings.push({
      code: 'large-model',
      message: `La geometría crearía ${entities.toLocaleString('es-MX')} entidades. Revísala antes de confirmarla.`,
    });
  }
  warnings.push(...familyWarnings);

  const connected = new Set(builder.members.flatMap((member) => [member.i, member.j]));
  const isolated = builder.nodes.filter((node) => !connected.has(node.id));
  if (isolated.length) {
    warnings.push({
      code: 'isolated-nodes',
      message: `${isolated.length.toLocaleString('es-MX')} nodos generados no tocan ningún miembro.`,
    });
  }
  return warnings;
};

export const generateStructure = (params: GeneratorParams): GeneratedStructure => {
  const origin = resolveOrigin(params.origin);
  const support = resolveSupport(params.baseSupport);
  const properties = resolveGeneratorMemberProperties(params.properties);

  const family = buildFamily(params, properties, origin);
  const { builder } = family;

  const supportedNodeIds = support ? [...family.supportCandidateIds] : [];
  if (support) {
    const supported = new Set(supportedNodeIds);
    for (const node of builder.nodes) {
      if (supported.has(node.id)) node.support = structuredClone(support);
    }
  }

  const structure: GeneratedStructure = {
    kind: params.kind,
    description: family.description,
    nodes: builder.nodes,
    members: builder.members,
    nodeRoles: builder.nodeRoles,
    memberRoles: builder.memberRoles,
    supportedNodeIds,
    summary: summarize(builder, supportedNodeIds, properties),
    warnings: collectWarnings(builder, supportedNodeIds, family.warnings),
  };
  validateGeneratedStructure(structure);
  return structure;
};
