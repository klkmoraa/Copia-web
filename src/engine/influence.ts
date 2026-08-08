import type { AnalysisResult, DiagramQuantity, MemberModel, ProjectModel, ReliabilityLevel } from '../types';
import { evaluateDiagramAt, evaluatePolynomial, rootsInInterval } from './diagram';
import { solveLinearSystem } from './math';
import { isTrustedForCombination, resolveReliability, worstLevel } from './reliability';
import { analyzeProject } from './solver';

const GEOMETRY_EPS = 1e-10;
const UNIT_CASE_ID = '__structureco_influence_unit__';
const FIT_ABSCISSAE = [1 / 8, 3 / 8, 5 / 8, 7 / 8] as const;
const VALIDATION_ABSCISSAE = [0.22360679774997896, 0.7548776662466927] as const;

export type InfluenceQuantity = 'N' | 'V' | 'M';
export type LimitSide = 'left' | 'right' | 'continuous';

export interface InfluenceTarget {
  memberId: string;
  /** Coordinate on the deformable part of the target member, measured from end i. */
  x: number;
  quantity: InfluenceQuantity;
  /** Side used only when the target cut itself contains a concentrated action. */
  side?: Exclude<LimitSide, 'continuous'>;
}

export interface OrderedInfluenceMember {
  memberId: string;
  startNodeId: string;
  endNodeId: string;
  reversed: boolean;
  /** Length of the deformable part of the member. */
  length: number;
  pathStart: number;
  pathEnd: number;
}

export interface OrderedInfluencePath {
  members: OrderedInfluenceMember[];
  startNodeId: string;
  endNodeId: string;
  length: number;
}

export interface InfluenceValidationPoint {
  position: number;
  memberId: string;
  memberX: number;
  expected: number;
  fitted: number;
  absoluteError: number;
  relativeError: number;
}

export interface InfluenceSolverDiagnostics {
  analyses: number;
  maxEquilibriumResidual: number;
  maxStructuralResidual: number;
  maxLinearResidual: number;
  maxConditionEstimate: number;
  maxForwardErrorBound: number;
  minReliableDigits: number;
  /** Worst reliability level observed across every moving-load analysis. */
  worstReliability: ReliabilityLevel;
}

export interface RejectedInfluenceInterval {
  pathStart: number;
  pathEnd: number;
  depth: number;
  maxAbsoluteError: number;
  maxRelativeError: number;
}

export interface InfluenceFitDiagnostics {
  maxAbsoluteError: number;
  maxRelativeError: number;
  interpolationConditionEstimate: number;
  interpolationRelativeResidual: number;
  interpolationPivotRatio: number;
  validations: InfluenceValidationPoint[];
  /** True only when every interval satisfied its tolerance. */
  accepted: boolean;
  /** Number of interval splits performed while chasing the tolerance. */
  subdivisions: number;
  maxSubdivisionDepth: number;
  toleranceRelative: number;
  toleranceAbsolute: number;
  rejectedIntervals: RejectedInfluenceInterval[];
}

/** Acceptance limits applied to the piecewise-cubic reconstruction. */
export interface InfluenceFitLimits {
  /** An interval fails only when it exceeds both tolerances at a check point. */
  maxRelativeError: number;
  maxAbsoluteError: number;
  /** Maximum number of successive halvings of one interval. */
  maxSubdivisions: number;
}

/**
 * The reconstruction is exact for this element library, so these limits are a
 * guard against numerical degradation rather than against discretization: they
 * sit far above double-precision round-off and far below any error that could
 * change an engineering decision.
 */
export const DEFAULT_INFLUENCE_FIT_LIMITS: InfluenceFitLimits = {
  maxRelativeError: 1e-6,
  maxAbsoluteError: 1e-9,
  maxSubdivisions: 4,
};

/** Thrown when a line cannot meet its tolerance; it must never reach the app as valid. */
export class InfluenceFitError extends Error {
  readonly fit: InfluenceFitDiagnostics;

  constructor(message: string, fit: InfluenceFitDiagnostics) {
    super(message);
    this.name = 'InfluenceFitError';
    this.fit = fit;
  }
}

export interface InfluenceSegment {
  memberId: string;
  pathStart: number;
  pathEnd: number;
  memberXStart: number;
  memberXEnd: number;
  /** Coefficients c0..c3 in xi = position - pathStart. */
  coefficients: [number, number, number, number];
}

export interface InfluenceJump {
  position: number;
  left: number;
  right: number;
  delta: number;
}

export interface InfluenceExtreme {
  position: number;
  value: number;
  side: LimitSide;
  memberId: string;
  memberX: number;
}

export interface InfluenceLine {
  target: InfluenceTarget;
  path: OrderedInfluencePath;
  segments: InfluenceSegment[];
  jumps: InfluenceJump[];
  minimum: InfluenceExtreme;
  maximum: InfluenceExtreme;
  fit: InfluenceFitDiagnostics;
  solver: InfluenceSolverDiagnostics;
}

export interface ConcentratedAxle {
  id?: string;
  /** Positive magnitude of the downward global force. */
  P: number;
  /** Axle coordinate minus the train reference coordinate. */
  offset: number;
}

export interface ConcentratedAxleTrain {
  axles: ConcentratedAxle[];
  impactFactor?: number;
}

export interface AxleTrainSegment {
  positionStart: number;
  positionEnd: number;
  /** Coefficients in eta = referencePosition - positionStart. */
  coefficients: [number, number, number, number];
}

export interface AxleTrainExtreme {
  referencePosition: number;
  value: number;
  side: LimitSide;
  axlePositions: Array<{ id?: string; position: number; onPath: boolean }>;
}

export interface AxleTrainEnvelope {
  train: Required<Pick<ConcentratedAxleTrain, 'impactFactor'>> & Pick<ConcentratedAxleTrain, 'axles'>;
  domain: [number, number];
  segments: AxleTrainSegment[];
  minimum: AxleTrainExtreme;
  maximum: AxleTrainExtreme;
}

interface AnalysisAccumulator {
  analyses: number;
  maxEquilibriumResidual: number;
  maxStructuralResidual: number;
  maxLinearResidual: number;
  maxConditionEstimate: number;
  maxForwardErrorBound: number;
  minReliableDigits: number;
  worstReliability: ReliabilityLevel;
}

const finiteMaximum = (current: number, value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? Math.max(current, value) : current;

const finiteMinimum = (current: number, value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? Math.min(current, value) : current;

const memberLength = (member: MemberModel, project: ProjectModel): number => {
  const nodeI = project.nodes.find((node) => node.id === member.i);
  const nodeJ = project.nodes.find((node) => node.id === member.j);
  if (!nodeI || !nodeJ) throw new Error(`El miembro ${member.id} referencia un nodo inexistente.`);
  const gross = Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y);
  const length = gross - (member.rigidOffsetI ?? 0) - (member.rigidOffsetJ ?? 0);
  if (!(length > GEOMETRY_EPS)) throw new Error(`El miembro ${member.id} no tiene longitud deformable positiva.`);
  return length;
};

/** Orders a selected set of frame members as one connected, open, non-branched chain. */
export const orderInfluencePath = (
  project: ProjectModel,
  memberIds: readonly string[],
  startNodeId?: string,
): OrderedInfluencePath => {
  if (!memberIds.length) throw new Error('Selecciona al menos un miembro para la trayectoria de la carga.');
  if (new Set(memberIds).size !== memberIds.length) throw new Error('La trayectoria contiene miembros repetidos.');

  const byId = new Map(project.members.map((member) => [member.id, member]));
  const selected = memberIds.map((id) => {
    const member = byId.get(id);
    if (!member) throw new Error(`No existe el miembro ${id}.`);
    if (member.type !== 'frame') throw new Error(`El miembro ${id} no es frame y no puede pertenecer a la trayectoria.`);
    return member;
  });
  const incident = new Map<string, MemberModel[]>();
  for (const member of selected) {
    incident.set(member.i, [...(incident.get(member.i) ?? []), member]);
    incident.set(member.j, [...(incident.get(member.j) ?? []), member]);
  }
  const branch = [...incident.entries()].find(([, members]) => members.length > 2);
  if (branch) throw new Error(`La trayectoria se ramifica en el nodo ${branch[0]}.`);

  const endpoints = [...incident.entries()].filter(([, members]) => members.length === 1).map(([nodeId]) => nodeId);
  if (selected.length > 1 && endpoints.length !== 2) {
    throw new Error('La trayectoria debe ser una cadena abierta continua; no se admiten ciclos ni grupos desconectados.');
  }
  const firstSelected = selected[0];
  let start: string;
  if (startNodeId !== undefined) {
    if (!incident.has(startNodeId) || (selected.length > 1 && !endpoints.includes(startNodeId))) {
      throw new Error(`El nodo inicial ${startNodeId} no es un extremo de la trayectoria.`);
    }
    start = startNodeId;
  } else if (selected.length === 1) {
    start = firstSelected.i;
  } else if (endpoints.includes(firstSelected.i)) {
    start = firstSelected.i;
  } else if (endpoints.includes(firstSelected.j)) {
    start = firstSelected.j;
  } else {
    start = [...endpoints].sort()[0];
  }

  const used = new Set<string>();
  const ordered: OrderedInfluenceMember[] = [];
  let currentNode = start;
  let distance = 0;
  while (used.size < selected.length) {
    const candidates = (incident.get(currentNode) ?? []).filter((member) => !used.has(member.id));
    if (candidates.length !== 1) {
      throw new Error('Los miembros seleccionados no forman una única cadena continua no ramificada.');
    }
    const member = candidates[0];
    const reversed = member.j === currentNode;
    const nextNode = reversed ? member.i : member.j;
    const length = memberLength(member, project);
    ordered.push({
      memberId: member.id,
      startNodeId: currentNode,
      endNodeId: nextNode,
      reversed,
      length,
      pathStart: distance,
      pathEnd: distance + length,
    });
    distance += length;
    currentNode = nextNode;
    used.add(member.id);
  }
  if (used.size !== selected.length || (selected.length > 1 && !endpoints.includes(currentNode))) {
    throw new Error('Los miembros seleccionados no forman una única cadena continua no ramificada.');
  }
  return { members: ordered, startNodeId: start, endNodeId: currentNode, length: distance };
};

/** Alias emphasizing that only frame members are accepted. */
export const orderFramePath = orderInfluencePath;

const pathMemberAt = (path: OrderedInfluencePath, position: number): OrderedInfluenceMember | undefined => {
  const tolerance = Math.max(1, path.length) * GEOMETRY_EPS;
  return path.members.find((member) => position > member.pathStart + tolerance && position < member.pathEnd - tolerance)
    ?? path.members.find((member) => Math.abs(position - member.pathStart) <= tolerance)
    ?? path.members.at(-1);
};

const memberXAt = (member: OrderedInfluenceMember, position: number): number => {
  const alongPath = Math.max(0, Math.min(member.length, position - member.pathStart));
  return member.reversed ? member.length - alongPath : alongPath;
};

const influenceProject = (project: ProjectModel): ProjectModel => ({
  ...project,
  educationalCase: undefined,
  nodes: project.nodes.map((node) => ({
    ...node,
    support: { ...node.support, prescribed: undefined },
  })),
  loadCases: [{
    id: UNIT_CASE_ID,
    name: 'Carga unitaria móvil',
    category: 'variable',
    active: true,
    selfWeightFactor: 0,
  }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
});

const quantityName = (quantity: InfluenceQuantity): DiagramQuantity => {
  if (quantity === 'N') return 'axial';
  if (quantity === 'V') return 'shear';
  return 'moment';
};

const recordAnalysis = (accumulator: AnalysisAccumulator, result: AnalysisResult): ReliabilityLevel => {
  accumulator.analyses += 1;
  accumulator.maxEquilibriumResidual = finiteMaximum(accumulator.maxEquilibriumResidual, result.equilibrium.normalizedResidual);
  accumulator.maxStructuralResidual = finiteMaximum(accumulator.maxStructuralResidual, result.residualNorm);
  accumulator.maxLinearResidual = finiteMaximum(accumulator.maxLinearResidual, result.linearResidual);
  accumulator.maxConditionEstimate = finiteMaximum(accumulator.maxConditionEstimate, result.conditionEstimate);
  accumulator.maxForwardErrorBound = finiteMaximum(accumulator.maxForwardErrorBound, result.forwardErrorBound);
  accumulator.minReliableDigits = finiteMinimum(accumulator.minReliableDigits, result.reliableDigits);
  const level = resolveReliability(result).level;
  accumulator.worstReliability = worstLevel(accumulator.worstReliability, level);
  return level;
};

const solveUnitResponse = (
  base: ProjectModel,
  pathMember: OrderedInfluenceMember,
  pathPosition: number,
  target: InfluenceTarget,
  diagnostics: AnalysisAccumulator,
): number => {
  const memberX = memberXAt(pathMember, pathPosition);
  const loaded: ProjectModel = {
    ...base,
    memberLoads: [{
      id: '__influence_moving_point__',
      memberId: pathMember.memberId,
      caseId: UNIT_CASE_ID,
      type: 'point',
      coordinateSystem: 'global',
      lengthBasis: 'real',
      start: 0,
      end: 1,
      px: 0,
      py: -1,
      position: memberX / pathMember.length,
    }],
  };
  // Only a single scalar ordinate is read from `result` below; the influence
  // sweep calls this once per sample point along the path, so skipping the
  // education trace here removes a large, entirely unused cost.
  const result = analyzeProject(loaded, undefined, { includeEducationTrace: false });
  const level = recordAnalysis(diagnostics, result);
  if (!result.success || !isTrustedForCombination(level)) {
    const reliability = resolveReliability(result);
    const message = result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' ')
      || reliability.reasons[0]
      || 'análisis fallido';
    throw new Error(`No se pudo resolver la carga unitaria en ${pathPosition}: ${message}`);
  }
  const targetResult = result.memberResults.find((member) => member.memberId === target.memberId);
  if (!targetResult) throw new Error(`El análisis no devolvió resultados para el miembro objetivo ${target.memberId}.`);
  const point = evaluateDiagramAt(targetResult.diagramSegments, targetResult.diagramJumps, target.x, target.side ?? 'right');
  if (!point) throw new Error(`No se pudo evaluar el corte objetivo ${target.memberId} @ ${target.x}.`);
  return point[quantityName(target.quantity)];
};

const fitCubic = (
  positions: readonly number[],
  values: readonly number[],
  start: number,
  length: number,
) => {
  const matrix = positions.map((position) => {
    const t = (position - start) / length;
    return [1, t, t ** 2, t ** 3];
  });
  const solved = solveLinearSystem(matrix, [...values]);
  const coefficients: [number, number, number, number] = [
    solved.x[0],
    solved.x[1] / length,
    solved.x[2] / length ** 2,
    solved.x[3] / length ** 3,
  ];
  return { coefficients, solved };
};

const shiftPolynomial = (
  coefficients: readonly number[],
  distance: number,
): [number, number, number, number] => {
  const [c0 = 0, c1 = 0, c2 = 0, c3 = 0] = coefficients;
  return [
    c0 + c1 * distance + c2 * distance ** 2 + c3 * distance ** 3,
    c1 + 2 * c2 * distance + 3 * c3 * distance ** 2,
    c2 + 3 * c3 * distance,
    c3,
  ];
};

const uniqueSorted = (values: readonly number[], tolerance: number): number[] =>
  [...values].sort((a, b) => a - b).filter((value, index, sorted) =>
    index === 0 || Math.abs(value - sorted[index - 1]) > tolerance);

const segmentValue = (segment: InfluenceSegment, position: number): number =>
  evaluatePolynomial(segment.coefficients, position - segment.pathStart);

const influenceCandidates = (line: Pick<InfluenceLine, 'segments' | 'path'>): InfluenceExtreme[] =>
  line.segments.flatMap((segment) => {
    const length = segment.pathEnd - segment.pathStart;
    const derivative = [segment.coefficients[1], 2 * segment.coefficients[2], 3 * segment.coefficients[3]];
    return [0, ...rootsInInterval(derivative, length), length].map((xi) => {
      const fraction = length > 0 ? xi / length : 0;
      return {
        position: segment.pathStart + xi,
        value: evaluatePolynomial(segment.coefficients, xi),
        side: xi === 0 ? 'right' as const : xi === length ? 'left' as const : 'continuous' as const,
        memberId: segment.memberId,
        memberX: segment.memberXStart + fraction * (segment.memberXEnd - segment.memberXStart),
      };
    });
  });

/** Finds global min/max from polynomial endpoints and exact derivative roots. */
export const findInfluenceLineExtrema = (
  line: Pick<InfluenceLine, 'segments' | 'path'>,
): { minimum: InfluenceExtreme; maximum: InfluenceExtreme } => {
  const candidates = influenceCandidates(line);
  if (!candidates.length) throw new Error('La línea de influencia no contiene tramos evaluables.');
  return {
    minimum: candidates.reduce((best, candidate) => candidate.value < best.value ? candidate : best),
    maximum: candidates.reduce((best, candidate) => candidate.value > best.value ? candidate : best),
  };
};

/**
 * Builds a piecewise-cubic influence line. Four strict interior solves identify
 * every interval; two independent interior solves certify the reconstruction.
 */
export const buildInfluenceLine = (
  project: ProjectModel,
  memberIds: readonly string[],
  target: InfluenceTarget,
  startNodeId?: string,
  limits: Partial<InfluenceFitLimits> = {},
): InfluenceLine => {
  const fitLimits: InfluenceFitLimits = { ...DEFAULT_INFLUENCE_FIT_LIMITS, ...limits };
  if (!(fitLimits.maxRelativeError >= 0) || !(fitLimits.maxAbsoluteError >= 0)) {
    throw new Error('Las tolerancias de ajuste de la línea de influencia deben ser finitas y no negativas.');
  }
  if (!Number.isInteger(fitLimits.maxSubdivisions) || fitLimits.maxSubdivisions < 0) {
    throw new Error('El límite de subdivisión de la línea de influencia debe ser un entero no negativo.');
  }
  const path = orderInfluencePath(project, memberIds, startNodeId);
  const targetMember = project.members.find((member) => member.id === target.memberId);
  if (!targetMember || targetMember.type === 'rigid') throw new Error(`No existe un miembro deformable objetivo ${target.memberId}.`);
  const targetLength = memberLength(targetMember, project);
  const targetTolerance = Math.max(1, targetLength) * GEOMETRY_EPS;
  if (!Number.isFinite(target.x) || target.x < -targetTolerance || target.x > targetLength + targetTolerance) {
    throw new Error(`La coordenada objetivo debe estar entre 0 y ${targetLength}.`);
  }
  const normalizedTarget: InfluenceTarget = { ...target, x: Math.max(0, Math.min(targetLength, target.x)) };
  const targetPathMember = path.members.find((member) => member.memberId === target.memberId);
  const targetPathPosition = targetPathMember
    ? targetPathMember.pathStart + (targetPathMember.reversed ? targetPathMember.length - normalizedTarget.x : normalizedTarget.x)
    : undefined;
  const tolerance = Math.max(1, path.length) * GEOMETRY_EPS;
  const breakpoints = uniqueSorted([
    ...path.members.flatMap((member) => [member.pathStart, member.pathEnd]),
    ...(targetPathPosition !== undefined
      && targetPathPosition > tolerance
      && targetPathPosition < path.length - tolerance ? [targetPathPosition] : []),
  ], tolerance);
  const base = influenceProject(project);
  const analysisDiagnostics: AnalysisAccumulator = {
    analyses: 0,
    maxEquilibriumResidual: 0,
    maxStructuralResidual: 0,
    maxLinearResidual: 0,
    maxConditionEstimate: 0,
    maxForwardErrorBound: 0,
    minReliableDigits: Number.POSITIVE_INFINITY,
    worstReliability: 'reliable',
  };
  const validations: InfluenceValidationPoint[] = [];
  const segments: InfluenceSegment[] = [];
  const rejectedIntervals: RejectedInfluenceInterval[] = [];
  let interpolationConditionEstimate = 0;
  let interpolationRelativeResidual = 0;
  let interpolationPivotRatio = 0;
  let subdivisions = 0;
  let maxSubdivisionDepth = 0;

  /**
   * Fits one interval and certifies it at two independent interior positions.
   * A check point fails only when it exceeds both the absolute and the relative
   * tolerance: near a zero of the line a relative error alone means nothing.
   */
  const fitAndValidate = (
    pathStart: number,
    pathEnd: number,
    pathMember: OrderedInfluenceMember,
    depth: number,
  ): void => {
    const length = pathEnd - pathStart;
    if (length <= tolerance) return;
    maxSubdivisionDepth = Math.max(maxSubdivisionDepth, depth);
    const fitPositions = FIT_ABSCISSAE.map((fraction) => pathStart + fraction * length);
    const fitValues = fitPositions.map((position) =>
      solveUnitResponse(base, pathMember, position, normalizedTarget, analysisDiagnostics));
    const fitted = fitCubic(fitPositions, fitValues, pathStart, length);
    const segment: InfluenceSegment = {
      memberId: pathMember.memberId,
      pathStart,
      pathEnd,
      memberXStart: memberXAt(pathMember, pathStart),
      memberXEnd: memberXAt(pathMember, pathEnd),
      coefficients: fitted.coefficients,
    };

    const checks: InfluenceValidationPoint[] = VALIDATION_ABSCISSAE.map((fraction) => {
      const position = pathStart + fraction * length;
      const expected = solveUnitResponse(base, pathMember, position, normalizedTarget, analysisDiagnostics);
      const predicted = segmentValue(segment, position);
      const absoluteError = Math.abs(expected - predicted);
      return {
        position,
        memberId: pathMember.memberId,
        memberX: memberXAt(pathMember, position),
        expected,
        fitted: predicted,
        absoluteError,
        relativeError: absoluteError / Math.max(1e-14, Math.abs(expected), Math.abs(predicted)),
      };
    });
    const worstAbsolute = Math.max(0, ...checks.map((check) => check.absoluteError));
    const worstRelative = Math.max(0, ...checks.map((check) => check.relativeError));
    const meetsTolerance = checks.every((check) =>
      check.absoluteError <= fitLimits.maxAbsoluteError || check.relativeError <= fitLimits.maxRelativeError);

    if (!meetsTolerance && depth < fitLimits.maxSubdivisions) {
      // Halve the interval and certify each half independently.
      subdivisions += 1;
      const midpoint = pathStart + length / 2;
      fitAndValidate(pathStart, midpoint, pathMember, depth + 1);
      fitAndValidate(midpoint, pathEnd, pathMember, depth + 1);
      return;
    }

    interpolationConditionEstimate = Math.max(interpolationConditionEstimate, fitted.solved.conditionEstimate);
    interpolationRelativeResidual = Math.max(interpolationRelativeResidual, fitted.solved.relativeResidual);
    interpolationPivotRatio = Math.max(interpolationPivotRatio, fitted.solved.pivotRatio);
    segments.push(segment);
    validations.push(...checks);
    if (!meetsTolerance) {
      rejectedIntervals.push({
        pathStart,
        pathEnd,
        depth,
        maxAbsoluteError: worstAbsolute,
        maxRelativeError: worstRelative,
      });
    }
  };

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const pathStart = breakpoints[index];
    const pathEnd = breakpoints[index + 1];
    if (pathEnd - pathStart <= tolerance) continue;
    const pathMember = pathMemberAt(path, (pathStart + pathEnd) / 2);
    if (!pathMember) throw new Error('No se pudo localizar un tramo de trayectoria.');
    fitAndValidate(pathStart, pathEnd, pathMember, 0);
  }

  if (!segments.length) throw new Error('La trayectoria no produjo intervalos de influencia.');
  const jumps: InfluenceJump[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const next = segments[index];
    if (Math.abs(previous.pathEnd - next.pathStart) > tolerance) continue;
    const position = next.pathStart;
    const left = segmentValue(previous, position);
    const right = segmentValue(next, position);
    const delta = right - left;
    if (Math.abs(delta) > 1e-7 * Math.max(1, Math.abs(left), Math.abs(right))) {
      jumps.push({ position, left, right, delta });
    }
  }
  const fit: InfluenceFitDiagnostics = {
    maxAbsoluteError: Math.max(0, ...validations.map((validation) => validation.absoluteError)),
    maxRelativeError: Math.max(0, ...validations.map((validation) => validation.relativeError)),
    interpolationConditionEstimate,
    interpolationRelativeResidual,
    interpolationPivotRatio,
    validations,
    accepted: rejectedIntervals.length === 0,
    subdivisions,
    maxSubdivisionDepth,
    toleranceRelative: fitLimits.maxRelativeError,
    toleranceAbsolute: fitLimits.maxAbsoluteError,
    rejectedIntervals,
  };
  if (!fit.accepted) {
    const worst = rejectedIntervals.reduce((critical, interval) =>
      interval.maxRelativeError > critical.maxRelativeError ? interval : critical);
    throw new InfluenceFitError(
      `El ajuste de la línea de influencia no alcanzó la tolerancia exigida tras ${fitLimits.maxSubdivisions} subdivisiones: `
      + `el intervalo [${worst.pathStart.toPrecision(6)}, ${worst.pathEnd.toPrecision(6)}] conserva un error absoluto de `
      + `${worst.maxAbsoluteError.toExponential(3)} y relativo de ${worst.maxRelativeError.toExponential(3)}. `
      + 'La línea se rechaza y no debe usarse.',
      fit,
    );
  }
  const extrema = findInfluenceLineExtrema({ segments, path });
  return {
    target: normalizedTarget,
    path,
    segments,
    jumps,
    ...extrema,
    fit,
    solver: {
      ...analysisDiagnostics,
      minReliableDigits: Number.isFinite(analysisDiagnostics.minReliableDigits)
        ? analysisDiagnostics.minReliableDigits
        : Number.NaN,
    },
  };
};

/** Evaluates either lateral limit of an influence line without sampling. */
export const evaluateInfluenceLine = (
  line: Pick<InfluenceLine, 'segments' | 'path'>,
  position: number,
  side: Exclude<LimitSide, 'continuous'> = 'right',
): number | null => {
  if (!Number.isFinite(position) || position < -GEOMETRY_EPS || position > line.path.length + GEOMETRY_EPS) return null;
  const clamped = Math.max(0, Math.min(line.path.length, position));
  const tolerance = Math.max(1, line.path.length) * GEOMETRY_EPS;
  let segment = line.segments.find((item) => clamped > item.pathStart + tolerance && clamped < item.pathEnd - tolerance);
  if (!segment) {
    segment = side === 'left'
      ? [...line.segments].reverse().find((item) => Math.abs(item.pathEnd - clamped) <= tolerance) ?? line.segments[0]
      : line.segments.find((item) => Math.abs(item.pathStart - clamped) <= tolerance) ?? line.segments.at(-1);
  }
  return segment ? segmentValue(segment, clamped) : null;
};

const trainValueAt = (segment: AxleTrainSegment, position: number): number =>
  evaluatePolynomial(segment.coefficients, position - segment.positionStart);

const axleLocations = (
  train: ConcentratedAxleTrain,
  pathLength: number,
  referencePosition: number,
): AxleTrainExtreme['axlePositions'] => train.axles.map((axle) => {
  const position = referencePosition + axle.offset;
  return { id: axle.id, position, onPath: position >= -GEOMETRY_EPS && position <= pathLength + GEOMETRY_EPS };
});

const trainCandidates = (
  segments: readonly AxleTrainSegment[],
  train: ConcentratedAxleTrain,
  pathLength: number,
): AxleTrainExtreme[] => segments.flatMap((segment) => {
  const length = segment.positionEnd - segment.positionStart;
  const derivative = [segment.coefficients[1], 2 * segment.coefficients[2], 3 * segment.coefficients[3]];
  return [0, ...rootsInInterval(derivative, length), length].map((eta) => {
    const referencePosition = segment.positionStart + eta;
    return {
      referencePosition,
      value: evaluatePolynomial(segment.coefficients, eta),
      side: eta === 0 ? 'right' as const : eta === length ? 'left' as const : 'continuous' as const,
      axlePositions: axleLocations(train, pathLength, referencePosition),
    };
  });
});

/**
 * Superposes translated influence polynomials for a concentrated axle train.
 * Every change of active polynomial is an exact breakpoint; derivative roots
 * provide all interior extrema, so no positioning grid is used.
 */
export const analyzeAxleTrain = (
  line: InfluenceLine,
  train: ConcentratedAxleTrain,
): AxleTrainEnvelope => {
  if (!train.axles.length) throw new Error('El tren debe contener al menos un eje.');
  for (const axle of train.axles) {
    if (!Number.isFinite(axle.P) || axle.P <= 0) throw new Error('Cada eje debe tener una carga P positiva y finita.');
    if (!Number.isFinite(axle.offset)) throw new Error('Cada offset de eje debe ser finito.');
  }
  const impactFactor = train.impactFactor ?? 1;
  if (!Number.isFinite(impactFactor) || impactFactor < 1) throw new Error('impactFactor debe ser finito y mayor o igual que 1.');

  const pathLength = line.path.length;
  const domainStart = Math.min(...train.axles.map((axle) => -axle.offset));
  const domainEnd = Math.max(...train.axles.map((axle) => pathLength - axle.offset));
  const tolerance = Math.max(1, pathLength, domainEnd - domainStart) * GEOMETRY_EPS;
  const lineBreakpoints = uniqueSorted(line.segments.flatMap((segment) => [segment.pathStart, segment.pathEnd]), tolerance);
  const breakpoints = uniqueSorted([
    domainStart,
    domainEnd,
    ...train.axles.flatMap((axle) => lineBreakpoints.map((point) => point - axle.offset)),
  ].filter((point) => point >= domainStart - tolerance && point <= domainEnd + tolerance), tolerance);
  const segments: AxleTrainSegment[] = [];

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const positionStart = breakpoints[index];
    const positionEnd = breakpoints[index + 1];
    const length = positionEnd - positionStart;
    if (length <= tolerance) continue;
    const midpoint = 0.5 * (positionStart + positionEnd);
    const coefficients: [number, number, number, number] = [0, 0, 0, 0];
    for (const axle of train.axles) {
      const axlePosition = midpoint + axle.offset;
      if (axlePosition < -tolerance || axlePosition > pathLength + tolerance) continue;
      const source = line.segments.find((segment) =>
        axlePosition > segment.pathStart + tolerance && axlePosition < segment.pathEnd - tolerance)
        ?? line.segments.find((segment) => Math.abs(axlePosition - segment.pathStart) <= tolerance)
        ?? line.segments.at(-1);
      if (!source) continue;
      const translated = shiftPolynomial(source.coefficients, positionStart + axle.offset - source.pathStart);
      for (let degree = 0; degree < 4; degree += 1) {
        coefficients[degree] += impactFactor * axle.P * translated[degree];
      }
    }
    segments.push({ positionStart, positionEnd, coefficients });
  }
  if (!segments.length) throw new Error('No se pudieron construir posiciones válidas para el tren.');
  const candidates = trainCandidates(segments, train, pathLength);
  const minimum = candidates.reduce((best, candidate) => candidate.value < best.value ? candidate : best);
  const maximum = candidates.reduce((best, candidate) => candidate.value > best.value ? candidate : best);
  return {
    train: { axles: train.axles.map((axle) => ({ ...axle })), impactFactor },
    domain: [domainStart, domainEnd],
    segments,
    minimum,
    maximum,
  };
};

export const buildAxleTrainEnvelope = analyzeAxleTrain;

/** Evaluates a lateral train-response limit; outside its traversal domain the response is zero. */
export const evaluateAxleTrain = (
  envelope: AxleTrainEnvelope,
  referencePosition: number,
  side: Exclude<LimitSide, 'continuous'> = 'right',
): number => {
  const [domainStart, domainEnd] = envelope.domain;
  if (!Number.isFinite(referencePosition) || referencePosition < domainStart - GEOMETRY_EPS || referencePosition > domainEnd + GEOMETRY_EPS) return 0;
  const clamped = Math.max(domainStart, Math.min(domainEnd, referencePosition));
  const tolerance = Math.max(1, domainEnd - domainStart) * GEOMETRY_EPS;
  let segment = envelope.segments.find((item) => clamped > item.positionStart + tolerance && clamped < item.positionEnd - tolerance);
  if (!segment) {
    segment = side === 'left'
      ? [...envelope.segments].reverse().find((item) => Math.abs(item.positionEnd - clamped) <= tolerance) ?? envelope.segments[0]
      : envelope.segments.find((item) => Math.abs(item.positionStart - clamped) <= tolerance) ?? envelope.segments.at(-1);
  }
  return segment ? trainValueAt(segment, clamped) : 0;
};
