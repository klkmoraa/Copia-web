/**
 * Flattens a straight beam's members into one continuous axis.
 *
 * The solver reasons per member, in each member's own local coordinate. A reader reasoning by
 * Double Integration reasons about *one* beam, with a single x running from one end to the
 * other and a moment function that changes expression at each discontinuity. This module is
 * the translation between the two: it places every member on the shared axis, notes whether
 * it runs with or against it, and re-expresses its polynomials in the global coordinate.
 */
import type { AnalysisResult, ProjectModel } from '../types';
import { differentiate, shift, type Polynomial } from './polynomialAlgebra';

export interface AxisStation {
  nodeId: string;
  /** Distance along the beam axis from the first node. */
  x: number;
}

export interface AxisSegment {
  memberId: string;
  /** Global axis interval this segment covers, always with `x0 < x1`. */
  x0: number;
  x1: number;
  /** Bending stiffness of the member carrying this segment. */
  EI: number;
  /** Bending moment as a polynomial in the *global* axis coordinate. */
  moment: number[];
  /** Shear, likewise in the global coordinate. Kept for the diagrams and for checks. */
  shear: number[];
}

export interface BeamAxis {
  stations: AxisStation[];
  /** Total length along the axis. */
  length: number;
  segments: AxisSegment[];
  /** True when every member shares the same EI, which lets the report factor it out. */
  uniformEI: boolean;
  EI: number;
}

/** Position of every node along the ordered axis, measured from the first. */
export const axisStations = (project: ProjectModel, axisNodeIds: readonly string[]): AxisStation[] => {
  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  const first = byId.get(axisNodeIds[0]);
  if (!first) return [];
  return axisNodeIds.map((nodeId) => {
    const node = byId.get(nodeId);
    return { nodeId, x: node ? Math.hypot(node.x - first.x, node.y - first.y) : 0 };
  });
};

/**
 * Re-expresses one member segment in the global coordinate.
 *
 * A member declared from j to i runs against the axis, so its local ξ decreases as global x
 * grows. Substituting ξ = (start − x) flips the sign of every odd power, which is exactly what
 * `shift` composed with a reflection does — and getting it wrong would silently mirror the
 * moment diagram of any member captured backwards.
 */
const toGlobal = (polynomial: Polynomial, origin: number, forward: boolean): number[] => {
  if (forward) return shift(polynomial, -origin);
  // Against the axis the local coordinate is ζ = origin − x, so the reflection has to happen
  // *before* the translation: reflecting p first gives p̃(u) = p(−u), and p̃(x − origin) is
  // p(origin − x). Reflecting afterwards yields p(x − origin) negated, which mirrors the
  // diagram about the wrong point — a sign error no downstream check would attribute here.
  // The whole moment also changes sign: a member declared against the axis has its local y
  // inverted, so what it calls sagging the axis calls hogging.
  const reflected = polynomial.map((coefficient, power) => (power % 2 === 1 ? coefficient : -coefficient));
  return shift(reflected, -origin);
};

/**
 * Builds the continuous axis from a project and one of its analyses.
 *
 * `analysis` supplies the exact polynomials; `project` supplies the geometry. Segments come
 * back sorted along the axis, which is the order the report walks them in.
 */
export const buildBeamAxis = (
  project: ProjectModel,
  analysis: AnalysisResult,
  axisNodeIds: readonly string[],
): BeamAxis | undefined => {
  const stations = axisStations(project, axisNodeIds);
  if (stations.length < 2) return undefined;
  const positionOf = new Map(stations.map((station) => [station.nodeId, station.x]));
  const segments: AxisSegment[] = [];

  for (const member of project.members) {
    if (member.type === 'rigid') continue;
    const start = positionOf.get(member.i);
    const end = positionOf.get(member.j);
    const result = analysis.memberResults.find((entry) => entry.memberId === member.id);
    if (start === undefined || end === undefined || !result) return undefined;
    const forward = end > start;
    const EI = member.E * member.I;
    if (!(EI > 0)) return undefined;

    for (const segment of result.diagramSegments) {
      const a = forward ? start + segment.x0 : start - segment.x0;
      const b = forward ? start + segment.x1 : start - segment.x1;
      // The local origin of the polynomials is the segment's own x0, so the global origin is
      // where that x0 lands on the axis.
      const origin = a;
      const moment = toGlobal(segment.moment as unknown as Polynomial, origin, forward);
      segments.push({
        memberId: member.id,
        x0: Math.min(a, b),
        x1: Math.max(a, b),
        EI,
        moment,
        // The solver's own relation is dM/dx = V(x). Differentiating the global moment keeps
        // the two consistent by construction, instead of transforming the local shear with a
        // second sign rule that could drift away from the first.
        shear: differentiate(moment),
      });
    }
  }

  if (!segments.length) return undefined;
  segments.sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1);
  const stiffnesses = new Set(segments.map((segment) => segment.EI));
  return {
    stations,
    length: stations[stations.length - 1].x,
    segments,
    uniformEI: stiffnesses.size === 1,
    EI: segments[0].EI,
  };
};
