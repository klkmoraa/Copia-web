/**
 * Adaptador puro de proyecto + análisis a geometría de escena.
 *
 * Todo lo que se dibuja se decide aquí, sin Three.js: el viewport recibe
 * números y no vuelve a interpretar el dominio. Eso permite comprobar en test
 * exactamente qué se muestra —incluida la deformada— sin WebGL.
 *
 * Regla dura: la deformada sólo existe si hay un resultado **vigente**. Un
 * resultado obsoleto describe otra geometría, y dibujarlo encima del modelo
 * actual sería mentir con precisión de doce decimales.
 */
import { buildMemberOrientation } from '../engine/orientation';
import { resolveSpace3DTarget } from '../engine/solver';
import { Space3DGeometryError, type Space3DAnalysisResult, type Space3DOrientationBasis, type Space3DProjectV1, type Space3DVector } from '../model/types';
import type { Space3DAnalysisState, Space3DSelection } from '../store/Space3DProjectContext';

export interface Space3DSceneNode {
  readonly id: string;
  readonly position: Space3DVector;
  readonly restrained: boolean;
  readonly selected: boolean;
}

export interface Space3DSceneMember {
  readonly id: string;
  readonly nodeI: string;
  readonly nodeJ: string;
  readonly start: Space3DVector;
  readonly end: Space3DVector;
  readonly midpoint: Space3DVector;
  readonly length: number;
  readonly basis: Space3DOrientationBasis | null;
  readonly selected: boolean;
}

export interface Space3DSceneSupport {
  readonly nodeId: string;
  readonly position: Space3DVector;
  readonly translations: readonly [boolean, boolean, boolean];
  readonly rotations: readonly [boolean, boolean, boolean];
  readonly fullyFixed: boolean;
}

export interface Space3DSceneLoad {
  readonly id: string;
  readonly nodeId: string;
  readonly kind: 'force' | 'moment';
  readonly origin: Space3DVector;
  readonly direction: Space3DVector;
  readonly magnitude: number;
  /** Magnitud relativa a la mayor carga del mismo tipo, en `(0, 1]`. */
  readonly relative: number;
}

export interface Space3DSceneLocalAxes {
  readonly memberId: string;
  readonly origin: Space3DVector;
  readonly basis: Space3DOrientationBasis;
  readonly length: number;
}

export interface Space3DSceneDeformed {
  readonly scale: number;
  readonly maxDisplacement: number;
  readonly nodes: readonly { readonly id: string; readonly position: Space3DVector }[];
  readonly members: readonly { readonly id: string; readonly start: Space3DVector; readonly end: Space3DVector }[];
}

export interface Space3DSceneBounds {
  readonly min: Space3DVector;
  readonly max: Space3DVector;
  readonly center: Space3DVector;
  readonly span: number;
}

export type Space3DSceneDiagnostic =
  | { readonly code: 'unresolved-member-endpoint'; readonly entityId: string }
  | { readonly code: 'degenerate-member'; readonly entityId: string }
  | { readonly code: 'invalid-node-coordinate'; readonly entityId: string };

export interface Space3DSceneModel {
  readonly nodes: readonly Space3DSceneNode[];
  readonly members: readonly Space3DSceneMember[];
  readonly supports: readonly Space3DSceneSupport[];
  readonly loads: readonly Space3DSceneLoad[];
  readonly localAxes: Space3DSceneLocalAxes | null;
  readonly deformed: Space3DSceneDeformed | null;
  readonly bounds: Space3DSceneBounds;
  readonly diagnostics: readonly Space3DSceneDiagnostic[];
  readonly isEmpty: boolean;
}

export interface Space3DSceneInput {
  readonly project: Space3DProjectV1;
  readonly analysis: Space3DAnalysisResult | null;
  readonly analysisState: Space3DAnalysisState;
  readonly selection: Space3DSelection | null;
  readonly targetId: string;
  /** Escala explícita de la deformada; si falta se calcula para ocupar el 8 % del modelo. */
  readonly deformationScale?: number;
}

const DEFAULT_SPAN = 6;
const DEFORMED_FRACTION = 0.08;

const point = (x: number, y: number, z: number): Space3DVector => Object.freeze([x, y, z] as const);

const boundsOf = (positions: readonly Space3DVector[]): Space3DSceneBounds => {
  if (positions.length === 0) {
    return Object.freeze({
      min: point(0, 0, 0), max: point(0, 0, 0), center: point(0, 0, 0), span: DEFAULT_SPAN,
    });
  }
  const min: [number, number, number] = [positions[0][0], positions[0][1], positions[0][2]];
  const max: [number, number, number] = [...min];
  for (const position of positions) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], position[axis]);
      max[axis] = Math.max(max[axis], position[axis]);
    }
  }
  const extents = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return Object.freeze({
    min: point(min[0], min[1], min[2]),
    max: point(max[0], max[1], max[2]),
    center: point((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2),
    span: Math.max(...extents, 1),
  });
};

const normalizeOrZero = (vector: Space3DVector): Space3DVector => {
  const length = Math.hypot(...vector);
  return length === 0 ? point(0, 0, 0) : point(vector[0] / length, vector[1] / length, vector[2] / length);
};

export const buildSpace3DSceneModel = (input: Space3DSceneInput): Space3DSceneModel => {
  const { project, analysis, analysisState, selection, targetId, deformationScale } = input;
  const diagnostics: Space3DSceneDiagnostic[] = [];

  const nodes: Space3DSceneNode[] = [];
  const positionById = new Map<string, Space3DVector>();
  for (const node of project.nodes) {
    if (![node.x, node.y, node.z].every(Number.isFinite)) {
      diagnostics.push(Object.freeze({ code: 'invalid-node-coordinate', entityId: node.id }));
      continue;
    }
    const position = point(node.x, node.y, node.z);
    positionById.set(node.id, position);
    const restraints = node.restraints;
    nodes.push(Object.freeze({
      id: node.id,
      position,
      restrained: restraints.ux || restraints.uy || restraints.uz || restraints.rx || restraints.ry || restraints.rz,
      selected: selection?.kind === 'node' && selection.id === node.id,
    }));
  }

  const members: Space3DSceneMember[] = [];
  for (const member of project.members) {
    const start = positionById.get(member.i);
    const end = positionById.get(member.j);
    if (!start || !end) {
      diagnostics.push(Object.freeze({ code: 'unresolved-member-endpoint', entityId: member.id }));
      continue;
    }
    const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    if (length === 0) {
      diagnostics.push(Object.freeze({ code: 'degenerate-member', entityId: member.id }));
      continue;
    }
    let basis: Space3DOrientationBasis | null = null;
    try {
      basis = buildMemberOrientation(start, end, member.orientation);
    } catch (error) {
      if (!(error instanceof Space3DGeometryError)) throw error;
      basis = null;
    }
    members.push(Object.freeze({
      id: member.id,
      nodeI: member.i,
      nodeJ: member.j,
      start,
      end,
      midpoint: point((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2),
      length,
      basis,
      selected: selection?.kind === 'member' && selection.id === member.id,
    }));
  }

  const supports: Space3DSceneSupport[] = project.nodes
    .filter((node) => positionById.has(node.id))
    .filter((node) => Object.values(node.restraints).some(Boolean))
    .map((node) => Object.freeze({
      nodeId: node.id,
      position: positionById.get(node.id)!,
      translations: Object.freeze([node.restraints.ux, node.restraints.uy, node.restraints.uz] as const),
      rotations: Object.freeze([node.restraints.rx, node.restraints.ry, node.restraints.rz] as const),
      fullyFixed: Object.values(node.restraints).every(Boolean),
    }));

  const target = resolveSpace3DTarget(project, targetId);
  const rawLoads = project.nodalLoads
    .filter((load) => positionById.has(load.nodeId))
    .flatMap((load) => {
      const factor = target?.factors.get(load.caseId) ?? 0;
      if (factor === 0) return [];
      const force: Space3DVector = point(load.fx * factor, load.fy * factor, load.fz * factor);
      const moment: Space3DVector = point(load.mx * factor, load.my * factor, load.mz * factor);
      const entries: { kind: 'force' | 'moment'; vector: Space3DVector; id: string; nodeId: string }[] = [];
      if (Math.hypot(...force) > 0) entries.push({ kind: 'force', vector: force, id: load.id, nodeId: load.nodeId });
      if (Math.hypot(...moment) > 0) entries.push({ kind: 'moment', vector: moment, id: load.id, nodeId: load.nodeId });
      return entries;
    });

  const maxForce = Math.max(...rawLoads.filter((item) => item.kind === 'force').map((item) => Math.hypot(...item.vector)), 0);
  const maxMoment = Math.max(...rawLoads.filter((item) => item.kind === 'moment').map((item) => Math.hypot(...item.vector)), 0);

  const loads: Space3DSceneLoad[] = rawLoads.map((item) => {
    const magnitude = Math.hypot(...item.vector);
    const reference = item.kind === 'force' ? maxForce : maxMoment;
    return Object.freeze({
      id: item.id,
      nodeId: item.nodeId,
      kind: item.kind,
      origin: positionById.get(item.nodeId)!,
      direction: normalizeOrZero(item.vector),
      magnitude,
      relative: reference > 0 ? magnitude / reference : 1,
    });
  });

  const bounds = boundsOf(nodes.map((node) => node.position));

  const selectedMember = selection?.kind === 'member'
    ? members.find((member) => member.id === selection.id)
    : undefined;
  const localAxes: Space3DSceneLocalAxes | null = selectedMember?.basis
    ? Object.freeze({
      memberId: selectedMember.id,
      origin: selectedMember.midpoint,
      basis: selectedMember.basis,
      length: Math.min(selectedMember.length * 0.32, bounds.span * 0.22),
    })
    : null;

  const deformed = buildDeformed({ analysis, analysisState, members, positionById, bounds, deformationScale });

  return Object.freeze({
    nodes: Object.freeze(nodes),
    members: Object.freeze(members),
    supports: Object.freeze(supports),
    loads: Object.freeze(loads),
    localAxes,
    deformed,
    bounds,
    diagnostics: Object.freeze(diagnostics),
    isEmpty: nodes.length === 0,
  });
};

const buildDeformed = ({
  analysis, analysisState, members, positionById, bounds, deformationScale,
}: {
  analysis: Space3DAnalysisResult | null;
  analysisState: Space3DAnalysisState;
  members: readonly Space3DSceneMember[];
  positionById: ReadonlyMap<string, Space3DVector>;
  bounds: Space3DSceneBounds;
  deformationScale: number | undefined;
}): Space3DSceneDeformed | null => {
  if (analysisState !== 'ready' || !analysis?.success || analysis.nodeResults.length === 0) return null;

  const displaced = new Map<string, Space3DVector>();
  let maxDisplacement = 0;
  for (const result of analysis.nodeResults) {
    const { ux, uy, uz } = result.displacement;
    if (![ux, uy, uz].every(Number.isFinite)) return null;
    maxDisplacement = Math.max(maxDisplacement, Math.hypot(ux, uy, uz));
  }

  // La deformada real de una estructura de servicio es invisible a escala 1:1.
  // Se amplifica hasta ocupar una fracción fija del modelo, y la escala se
  // publica para que la interfaz pueda decir por cuánto está multiplicada.
  const scale = deformationScale ?? (maxDisplacement > 0 ? (bounds.span * DEFORMED_FRACTION) / maxDisplacement : 1);

  for (const result of analysis.nodeResults) {
    const base = positionById.get(result.nodeId);
    if (!base) continue;
    displaced.set(result.nodeId, point(
      base[0] + scale * result.displacement.ux,
      base[1] + scale * result.displacement.uy,
      base[2] + scale * result.displacement.uz,
    ));
  }

  const deformedMembers = members.flatMap((member) => {
    const start = displaced.get(member.nodeI);
    const end = displaced.get(member.nodeJ);
    return start && end ? [Object.freeze({ id: member.id, start, end })] : [];
  });

  return Object.freeze({
    scale,
    maxDisplacement,
    nodes: Object.freeze([...displaced].map(([id, position]) => Object.freeze({ id, position }))),
    members: Object.freeze(deformedMembers),
  });
};
