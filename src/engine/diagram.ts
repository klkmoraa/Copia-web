import type {
  DeformationCriticalPoint,
  DeformationPoint,
  DeformationSegment,
  DiagramCriticalPoint,
  DiagramJump,
  DiagramPoint,
  DiagramQuantity,
  DiagramSegment,
  MemberModel,
} from '../types';

export interface LocalDistributedLoad {
  kind: 'distributed';
  a: number;
  b: number;
  qxA: number;
  qxB: number;
  qyA: number;
  qyB: number;
}

export interface LocalPointLoad {
  kind: 'point';
  x: number;
  px: number;
  py: number;
}

export interface LocalMomentLoad {
  kind: 'moment';
  x: number;
  moment: number;
}

export type LocalMemberLoad = LocalDistributedLoad | LocalPointLoad | LocalMomentLoad;

const EPS = 1e-12;
const ROOT_EPS = 128 * Number.EPSILON;

const coordinateTolerance = (length: number): number => Math.max(
  Math.abs(length) * 1e-10,
  Number.EPSILON * Math.max(Math.abs(length), 1) * 64,
);

// Distributed-load domains are validated in normalized coordinates down to
// 1e-12 of the member length. Their breakpoints therefore need a substantially
// finer, scale-relative tolerance than the one used to group visually
// coincident concentrated actions.
const intervalCoordinateTolerance = (length: number): number => Math.max(
  Math.abs(length) * Number.EPSILON * 64,
  Number.MIN_VALUE,
);

const polynomialScale = (coefficients: readonly number[], interval = 1): number =>
  Math.max(1, ...coefficients.map((coefficient, degree) => Math.abs(coefficient) * Math.abs(interval) ** degree));

const uniqueSorted = (values: number[], tolerance: number): number[] => {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of sorted) {
    if (!out.length || Math.abs(value - out[out.length - 1]) > tolerance) out.push(value);
  }
  return out;
};

export const evaluatePolynomial = (coefficients: readonly number[], x: number): number => {
  let value = 0;
  for (let index = coefficients.length - 1; index >= 0; index -= 1) value = value * x + coefficients[index];
  return value;
};

const solveLinear = (a: number, b: number): number[] => {
  const scale = Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
  if (Math.abs(a) <= ROOT_EPS * scale) return [];
  return [-b / a];
};

const solveQuadratic = (a: number, b: number, c: number): number[] => {
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Number.MIN_VALUE);
  if (Math.abs(a) <= ROOT_EPS * scale) return solveLinear(b, c);
  const discriminant = b * b - 4 * a * c;
  const discriminantScale = Math.max(b * b, Math.abs(4 * a * c), Number.MIN_VALUE);
  const discriminantTolerance = ROOT_EPS * discriminantScale;
  if (discriminant < -discriminantTolerance) return [];
  if (Math.abs(discriminant) <= discriminantTolerance) return [-b / (2 * a)];
  const root = Math.sqrt(Math.max(0, discriminant));
  // Numerically stable quadratic formula.
  const q = -0.5 * (b + Math.sign(b || 1) * root);
  const r1 = q / a;
  const r2 = c / q;
  return uniqueSorted([r1, r2], ROOT_EPS * 16);
};

const bisectRoot = (coefficients: readonly number[], left: number, right: number, valueTolerance: number): number => {
  let a = left;
  let b = right;
  let fa = evaluatePolynomial(coefficients, a);
  let fb = evaluatePolynomial(coefficients, b);
  if (Math.abs(fa) <= valueTolerance) return a;
  if (Math.abs(fb) <= valueTolerance) return b;
  for (let iteration = 0; iteration < 90; iteration += 1) {
    const midpoint = 0.5 * (a + b);
    const fm = evaluatePolynomial(coefficients, midpoint);
    if (Math.abs(fm) <= valueTolerance || Math.abs(b - a) <= ROOT_EPS * 16) return midpoint;
    if (fa * fm <= 0) {
      b = midpoint;
      fb = fm;
    } else {
      a = midpoint;
      fa = fm;
    }
  }
  return Math.abs(fa) < Math.abs(fb) ? a : b;
};

/** Returns all real roots of a polynomial of arbitrary practical degree inside [0, length].
 *  Critical-point isolation makes repeated/tangent roots observable and keeps
 *  the algorithm deterministic for the degree-5 deformation polynomials.
 */
export const rootsInInterval = (coefficients: readonly number[], length: number): number[] => {
  if (!Number.isFinite(length) || length <= 0 || coefficients.some((value) => !Number.isFinite(value))) return [];

  // Solve in the dimensionless coordinate t=x/L. This keeps the same roots for
  // models expressed in m, mm or in, and avoids classifying coefficients by an
  // absolute tolerance that has no dimensional meaning.
  const transformed = coefficients.map((coefficient, degree) => coefficient * length ** degree);
  const scale = Math.max(...transformed.map(Math.abs), Number.MIN_VALUE);
  const trimmed = transformed.map((coefficient) => coefficient / scale);
  while (trimmed.length > 1 && Math.abs(trimmed[trimmed.length - 1]) <= ROOT_EPS) trimmed.pop();
  const degree = trimmed.length - 1;
  if (degree <= 0) return [];
  const interior = (t: number) => t > ROOT_EPS * 64 && t < 1 - ROOT_EPS * 64;
  const toPhysical = (roots: number[]) => uniqueSorted(roots.filter(interior), ROOT_EPS * 64).map((t) => t * length);
  const solveNormalized = (poly: number[]): number[] => {
    while (poly.length > 1 && Math.abs(poly.at(-1) ?? 0) <= ROOT_EPS) poly.pop();
    const n = poly.length - 1;
    if (n <= 0) return [];
    if (n === 1) return solveLinear(poly[1], poly[0]).filter((root) => root >= 0 && root <= 1);
    if (n === 2) return solveQuadratic(poly[2], poly[1], poly[0]).filter((root) => root >= 0 && root <= 1);
    const derivative = poly.slice(1).map((coefficient, index) => coefficient * (index + 1));
    const derivativeRoots = solveNormalized(derivative).filter((root) => root > 0 && root < 1);
    const partitions = uniqueSorted([0, ...derivativeRoots, 1], ROOT_EPS * 128);
    const roots: number[] = [];
    const valueTolerance = ROOT_EPS * 2048 * (n + 1);
    const bisectionTolerance = ROOT_EPS * 8;
    derivativeRoots.forEach((point) => {
      if (Math.abs(evaluatePolynomial(poly, point)) <= valueTolerance) roots.push(point);
    });
    for (let index = 0; index < partitions.length - 1; index += 1) {
      const a = partitions[index];
      const b = partitions[index + 1];
      const fa = evaluatePolynomial(poly, a);
      const fb = evaluatePolynomial(poly, b);
      if (Math.abs(fa) <= valueTolerance) roots.push(a);
      if (fa * fb < 0) roots.push(bisectRoot(poly, a, b, bisectionTolerance));
      if (index === partitions.length - 2 && Math.abs(fb) <= valueTolerance) roots.push(b);
    }
    return uniqueSorted(roots, ROOT_EPS * 256);
  };
  return toPhysical(solveNormalized(trimmed));
};

const loadIntensityAt = (
  loads: LocalMemberLoad[],
  x: number,
  tolerance = EPS,
): { qx: number; qy: number; qxSlope: number; qySlope: number } => {
  let qx = 0;
  let qy = 0;
  let qxSlope = 0;
  let qySlope = 0;
  for (const load of loads) {
    if (load.kind !== 'distributed' || x < load.a - tolerance || x > load.b + tolerance || load.b - load.a <= tolerance) continue;
    const span = load.b - load.a;
    const sx = (load.qxB - load.qxA) / span;
    const sy = (load.qyB - load.qyA) / span;
    qx += load.qxA + sx * (x - load.a);
    qy += load.qyA + sy * (x - load.a);
    qxSlope += sx;
    qySlope += sy;
  }
  return { qx, qy, qxSlope, qySlope };
};

const buildJumps = (loads: LocalMemberLoad[], length: number, tolerance: number): DiagramJump[] => {
  const canonical = (x: number) => Math.min(length, Math.max(0, x));
  const concentrated = loads
    .filter((load): load is LocalPointLoad | LocalMomentLoad => load.kind !== 'distributed')
    .map((load) => ({ load, x: canonical(load.x) }))
    .sort((a, b) => a.x - b.x);
  const jumps: DiagramJump[] = [];
  for (const { load, x } of concentrated) {
    let jump = jumps.at(-1);
    if (!jump || Math.abs(jump.x - x) > tolerance) {
      jump = { x, axialDelta: 0, shearDelta: 0, momentDelta: 0 };
      jumps.push(jump);
    }
    if (load.kind === 'point') {
      jump.axialDelta -= load.px;
      jump.shearDelta += load.py;
    } else {
      jump.momentDelta -= load.moment;
    }
  }
  return jumps;
};

export const evaluateSegment = (segment: DiagramSegment, x: number): DiagramPoint => {
  const xi = Math.min(segment.x1 - segment.x0, Math.max(0, x - segment.x0));
  return {
    x: segment.x0 + xi,
    axial: evaluatePolynomial(segment.axial, xi),
    shear: evaluatePolynomial(segment.shear, xi),
    moment: evaluatePolynomial(segment.moment, xi),
    side: 'continuous',
  };
};

const classifyExtremum = (
  derivative: readonly number[],
  coefficients: readonly number[],
  xi: number,
  h: number,
): 'maximum' | 'minimum' | null => {
  const delta = Math.max(h * 1e-5, Number.EPSILON * Math.max(1, h) * 256);
  const leftXi = Math.max(0, xi - delta);
  const rightXi = Math.min(h, xi + delta);
  const derivativeScale = polynomialScale(derivative, h);
  const slopeTolerance = ROOT_EPS * 512 * derivativeScale;
  const leftSlope = evaluatePolynomial(derivative, leftXi);
  const rightSlope = evaluatePolynomial(derivative, rightXi);
  if (leftSlope > slopeTolerance && rightSlope < -slopeTolerance) return 'maximum';
  if (leftSlope < -slopeTolerance && rightSlope > slopeTolerance) return 'minimum';

  // A stationary inflection has no sign change. The value comparison is only a
  // fallback for an extremely flat but genuine extremum.
  const value = evaluatePolynomial(coefficients, xi);
  const left = evaluatePolynomial(coefficients, leftXi);
  const right = evaluatePolynomial(coefficients, rightXi);
  const valueTolerance = ROOT_EPS * 512 * polynomialScale(coefficients, h);
  if (value - left > valueTolerance && value - right > valueTolerance) return 'maximum';
  if (left - value > valueTolerance && right - value > valueTolerance) return 'minimum';
  return null;
};

const addCritical = (list: DiagramCriticalPoint[], point: DiagramCriticalPoint, length: number) => {
  const tolerance = Math.max(
    Math.abs(length) * 1e-8,
    Number.EPSILON * Math.max(Math.abs(length), 1) * 128,
  );
  const duplicate = list.some((item) => item.quantity === point.quantity && item.kind === point.kind && Math.abs(item.x - point.x) <= tolerance && item.side === point.side);
  if (!duplicate) list.push(point);
};

const segmentCriticalPoints = (segment: DiagramSegment, length: number): DiagramCriticalPoint[] => {
  const out: DiagramCriticalPoint[] = [];
  const h = segment.x1 - segment.x0;
  const quantities: Array<{ quantity: DiagramQuantity; coefficients: readonly number[] }> = [
    { quantity: 'axial', coefficients: segment.axial },
    { quantity: 'shear', coefficients: segment.shear },
    { quantity: 'moment', coefficients: segment.moment },
  ];

  for (const { quantity, coefficients } of quantities) {
    for (const xi of rootsInInterval(coefficients, h)) {
      addCritical(out, { x: segment.x0 + xi, quantity, value: 0, kind: 'zero', side: 'continuous' }, length);
    }
  }

  const derivativeSets: Array<{ quantity: DiagramQuantity; derivative: number[]; coefficients: readonly number[] }> = [
    { quantity: 'axial', derivative: [segment.axial[1], 2 * segment.axial[2]], coefficients: segment.axial },
    { quantity: 'shear', derivative: [segment.shear[1], 2 * segment.shear[2]], coefficients: segment.shear },
    { quantity: 'moment', derivative: [...segment.shear], coefficients: segment.moment },
  ];
  for (const { quantity, derivative, coefficients } of derivativeSets) {
    for (const xi of rootsInInterval(derivative, h)) {
      const value = evaluatePolynomial(coefficients, xi);
      const kind = classifyExtremum(derivative, coefficients, xi, h);
      if (kind) addCritical(out, { x: segment.x0 + xi, quantity, value, kind, side: 'continuous' }, length);
    }
  }
  return out;
};

const quantityCoefficients = (segment: DiagramSegment, quantity: DiagramQuantity): readonly number[] =>
  quantity === 'axial' ? segment.axial : quantity === 'shear' ? segment.shear : segment.moment;

const derivativeCoefficients = (segment: DiagramSegment, quantity: DiagramQuantity): readonly number[] => {
  if (quantity === 'axial') return [segment.axial[1], 2 * segment.axial[2]];
  if (quantity === 'shear') return [segment.shear[1], 2 * segment.shear[2]];
  return segment.shear;
};

const boundaryCriticalPoints = (
  leftSegment: DiagramSegment,
  rightSegment: DiagramSegment,
  length: number,
): DiagramCriticalPoint[] => {
  const out: DiagramCriticalPoint[] = [];
  const x = leftSegment.x1;
  const leftLength = leftSegment.x1 - leftSegment.x0;
  const rightLength = rightSegment.x1 - rightSegment.x0;
  const deltaLeft = Math.max(leftLength * 1e-5, Number.EPSILON * Math.max(1, length) * 256);
  const deltaRight = Math.max(rightLength * 1e-5, Number.EPSILON * Math.max(1, length) * 256);

  for (const quantity of ['axial', 'shear', 'moment'] as const) {
    const leftCoefficients = quantityCoefficients(leftSegment, quantity);
    const rightCoefficients = quantityCoefficients(rightSegment, quantity);
    const leftValue = evaluatePolynomial(leftCoefficients, leftLength);
    const rightValue = evaluatePolynomial(rightCoefficients, 0);
    const valueScale = Math.max(
      polynomialScale(leftCoefficients, leftLength),
      polynomialScale(rightCoefficients, rightLength),
    );
    const valueTolerance = ROOT_EPS * 512 * valueScale;
    if (Math.abs(leftValue - rightValue) > valueTolerance) continue;

    const value = 0.5 * (leftValue + rightValue);
    if (Math.abs(value) <= valueTolerance) {
      addCritical(out, { x, quantity, value: 0, kind: 'zero', side: 'continuous' }, length);
    }

    const leftDerivative = derivativeCoefficients(leftSegment, quantity);
    const rightDerivative = derivativeCoefficients(rightSegment, quantity);
    const leftSlope = evaluatePolynomial(leftDerivative, Math.max(0, leftLength - deltaLeft));
    const rightSlope = evaluatePolynomial(rightDerivative, Math.min(rightLength, deltaRight));
    const slopeScale = Math.max(
      polynomialScale(leftDerivative, leftLength),
      polynomialScale(rightDerivative, rightLength),
    );
    const slopeTolerance = ROOT_EPS * 512 * slopeScale;
    let kind: 'maximum' | 'minimum' | null = null;
    if (leftSlope > slopeTolerance && rightSlope < -slopeTolerance) kind = 'maximum';
    else if (leftSlope < -slopeTolerance && rightSlope > slopeTolerance) kind = 'minimum';
    if (kind) addCritical(out, { x, quantity, value, kind, side: 'continuous' }, length);
  }
  return out;
};

export interface ExactDiagramResult {
  segments: DiagramSegment[];
  jumps: DiagramJump[];
  criticalPoints: DiagramCriticalPoint[];
  points: DiagramPoint[];
  endCompatibility: { axial: number; shear: number; moment: number };
}

export const buildExactDiagrams = (
  endForces: readonly number[],
  loads: LocalMemberLoad[],
  length: number,
): ExactDiagramResult => {
  const tolerance = coordinateTolerance(length);
  const intervalTolerance = intervalCoordinateTolerance(length);
  const rawJumps = buildJumps(loads, length, tolerance);
  const breakpoints = uniqueSorted([
    0,
    length,
    ...loads.flatMap((load) => load.kind === 'distributed' ? [load.a, load.b] : []),
    ...rawJumps.map((jump) => jump.x),
  ].map((x) => Math.min(length, Math.max(0, x))), intervalTolerance);

  // A concentrated action belongs to exactly one segment boundary. Looking a
  // jump up by tolerance at every breakpoint applies it twice whenever another
  // breakpoint — the edge of a distributed load, for instance — falls inside
  // that tolerance, which corrupts the whole diagram downstream of the load.
  const jumpByBreakpoint = new Map<number, DiagramJump>();
  for (const raw of rawJumps) {
    let index = 0;
    for (let candidate = 1; candidate < breakpoints.length; candidate += 1) {
      if (Math.abs(breakpoints[candidate] - raw.x) < Math.abs(breakpoints[index] - raw.x)) index = candidate;
    }
    const existing = jumpByBreakpoint.get(index);
    if (!existing) {
      jumpByBreakpoint.set(index, { ...raw, x: breakpoints[index] });
      continue;
    }
    existing.axialDelta += raw.axialDelta;
    existing.shearDelta += raw.shearDelta;
    existing.momentDelta += raw.momentDelta;
  }
  const jumps = [...jumpByBreakpoint.keys()]
    .sort((a, b) => a - b)
    .map((index) => jumpByBreakpoint.get(index)!);

  let axial = -endForces[0];
  let shear = endForces[1];
  let moment = -endForces[2];

  const segments: DiagramSegment[] = [];
  const points: DiagramPoint[] = [];
  const criticalPoints: DiagramCriticalPoint[] = [];

  const sideRank = (side: DiagramPoint['side']): number => side === 'left' ? 0 : side === 'continuous' ? 1 : 2;
  const pushPoint = (point: DiagramPoint) => {
    const duplicate = points.some((item) => Math.abs(item.x - point.x) <= tolerance && item.side === point.side);
    if (!duplicate) points.push(point);
  };

  const applyJump = (jump: DiagramJump | undefined) => {
    if (!jump) return;
    axial += jump.axialDelta;
    shear += jump.shearDelta;
    moment += jump.momentDelta;
  };

  const initialJump = jumpByBreakpoint.get(0);
  if (initialJump) {
    const leftPoint: DiagramPoint = { x: 0, axial, shear, moment, side: 'left' };
    pushPoint(leftPoint);
    applyJump(initialJump);
    const rightPoint: DiagramPoint = { x: 0, axial, shear, moment, side: 'right' };
    pushPoint(rightPoint);
    for (const quantity of ['axial', 'shear', 'moment'] as const) {
      const delta = quantity === 'axial' ? initialJump.axialDelta : quantity === 'shear' ? initialJump.shearDelta : initialJump.momentDelta;
      const jumpScale = Math.max(1, Math.abs(leftPoint[quantity]), Math.abs(rightPoint[quantity]), Math.abs(delta));
      if (Math.abs(delta) > ROOT_EPS * jumpScale) {
        addCritical(criticalPoints, { x: 0, quantity, value: leftPoint[quantity], kind: 'jump', side: 'left' }, length);
        addCritical(criticalPoints, { x: 0, quantity, value: rightPoint[quantity], kind: 'jump', side: 'right' }, length);
      }
    }
  } else pushPoint({ x: 0, axial, shear, moment, side: 'continuous' });

  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const x0 = breakpoints[index];
    const x1 = breakpoints[index + 1];
    const h = x1 - x0;
    if (h <= intervalTolerance) {
      applyJump(jumpByBreakpoint.get(index + 1));
      continue;
    }
    const probeOffset = h * 0.5;
    const intensity = loadIntensityAt(loads, x0 + probeOffset, intervalTolerance);
    // Re-evaluate the linear intensity at the exact left boundary from its midpoint value and slope.
    const midpoint = x0 + probeOffset;
    const qx0 = intensity.qx - intensity.qxSlope * (midpoint - x0);
    const qy0 = intensity.qy - intensity.qySlope * (midpoint - x0);
    const segment: DiagramSegment = {
      x0,
      x1,
      axial: [axial, -qx0, -0.5 * intensity.qxSlope],
      shear: [shear, qy0, 0.5 * intensity.qySlope],
      moment: [moment, shear, 0.5 * qy0, intensity.qySlope / 6],
      distributedAxial: [qx0, intensity.qxSlope],
      distributedTransverse: [qy0, intensity.qySlope],
    };
    segments.push(segment);
    const segmentCritical = segmentCriticalPoints(segment, length);
    segmentCritical.forEach((point) => addCritical(criticalPoints, point, length));
    const sampleXs = uniqueSorted([
      ...Array.from({ length: 13 }, (_, sample) => (sample * h) / 12),
      ...segmentCritical.filter((point) => point.x > x0 + tolerance && point.x < x1 - tolerance).map((point) => point.x - x0),
    ], tolerance);
    for (const xi of sampleXs) {
      if (xi <= tolerance || xi >= h - tolerance) continue;
      const point = evaluateSegment(segment, x0 + xi);
      pushPoint(point);
    }

    const end = evaluateSegment(segment, x1);
    axial = end.axial;
    shear = end.shear;
    moment = end.moment;

    const boundaryJump = jumpByBreakpoint.get(index + 1);
    if (boundaryJump) {
      const leftPoint: DiagramPoint = { x: x1, axial, shear, moment, side: 'left' };
      pushPoint(leftPoint);
      applyJump(boundaryJump);
      const rightPoint: DiagramPoint = { x: x1, axial, shear, moment, side: 'right' };
      pushPoint(rightPoint);
      for (const quantity of ['axial', 'shear', 'moment'] as const) {
        const delta = quantity === 'axial' ? boundaryJump.axialDelta : quantity === 'shear' ? boundaryJump.shearDelta : boundaryJump.momentDelta;
        const jumpScale = Math.max(
          1,
          Math.abs(leftPoint[quantity]),
          Math.abs(rightPoint[quantity]),
          Math.abs(delta),
        );
        if (Math.abs(delta) > ROOT_EPS * jumpScale) {
          addCritical(criticalPoints, { x: x1, quantity, value: leftPoint[quantity], kind: 'jump', side: 'left' }, length);
          addCritical(criticalPoints, { x: x1, quantity, value: rightPoint[quantity], kind: 'jump', side: 'right' }, length);
        }
      }
    } else pushPoint({ x: x1, axial, shear, moment, side: 'continuous' });
  }

  for (let index = 0; index < segments.length - 1; index += 1) {
    if (Math.abs(segments[index].x1 - segments[index + 1].x0) > tolerance) continue;
    boundaryCriticalPoints(segments[index], segments[index + 1], length)
      .forEach((point) => addCritical(criticalPoints, point, length));
  }

  // Only the material-side limits belong to the member: x=0+ and x=L-. A load
  // placed exactly at an end also has an exterior state, useful for the cursor,
  // but that state must not contaminate member extrema.
  const first = points.find((point) => Math.abs(point.x) <= tolerance && point.side !== 'left')
    ?? points[0]
    ?? { x: 0, axial, shear, moment, side: 'continuous' as const };
  const last = [...points].reverse().find((point) => Math.abs(point.x - length) <= tolerance && point.side !== 'right')
    ?? points.at(-1)
    ?? first;
  for (const quantity of ['axial', 'shear', 'moment'] as const) {
    addCritical(criticalPoints, { x: 0, quantity, value: first[quantity], kind: 'end', side: first.side }, length);
    addCritical(criticalPoints, { x: length, quantity, value: last[quantity], kind: 'end', side: last.side }, length);
  }

  // Add global extrema from all exact candidates and both sides of every jump.
  for (const quantity of ['axial', 'shear', 'moment'] as const) {
    const boundaryCandidates = points
      .filter((point) => {
        if (point.x <= tolerance) return point.side !== 'left';
        if (point.x >= length - tolerance) return point.side !== 'right';
        // Sampled continuous interior points are intentionally omitted. Exact
        // internal extrema are already provided by segmentCriticalPoints; only
        // breakpoints and jump limits need to be added here.
        return point.side !== 'continuous' || breakpoints.some((breakpoint) => Math.abs(breakpoint - point.x) <= tolerance);
      })
      .map((point) => ({ x: point.x, quantity, value: point[quantity], kind: 'end' as const, side: point.side }));
    const candidates = [
      ...criticalPoints.filter((point) => point.quantity === quantity && (point.kind === 'maximum' || point.kind === 'minimum')),
      ...boundaryCandidates,
    ];
    if (candidates.length) {
      const maximum = candidates.reduce((best, point) => point.value > best.value ? point : best);
      const minimum = candidates.reduce((best, point) => point.value < best.value ? point : best);
      addCritical(criticalPoints, { ...maximum, kind: 'maximum' }, length);
      addCritical(criticalPoints, { ...minimum, kind: 'minimum' }, length);
    }
  }

  criticalPoints.sort((a, b) => a.x - b.x || a.quantity.localeCompare(b.quantity) || sideRank(a.side) - sideRank(b.side) || a.kind.localeCompare(b.kind));
  points.sort((a, b) => a.x - b.x || sideRank(a.side) - sideRank(b.side));

  return {
    segments,
    jumps,
    criticalPoints,
    points,
    endCompatibility: {
      axial: axial - endForces[3],
      shear: shear + endForces[4],
      moment: moment - endForces[5],
    },
  };
};

export const evaluateDiagramAt = (
  segments: DiagramSegment[],
  jumps: DiagramJump[],
  x: number,
  side: 'left' | 'right' = 'right',
): DiagramPoint | null => {
  if (!segments.length) return null;
  const length = segments[segments.length - 1].x1;
  const clamped = Math.min(length, Math.max(0, x));
  const tolerance = intervalCoordinateTolerance(length);
  const jump = jumps.find((item) => Math.abs(item.x - clamped) <= tolerance);
  let segment = segments.find((item) => clamped > item.x0 + tolerance && clamped < item.x1 - tolerance);
  if (!segment) {
    segment = side === 'left'
      ? [...segments].reverse().find((item) => Math.abs(item.x1 - clamped) <= tolerance) ?? segments[0]
      : segments.find((item) => Math.abs(item.x0 - clamped) <= tolerance) ?? segments[segments.length - 1];
  }
  const point = evaluateSegment(segment, clamped);
  if (jump) {
    if (side === 'right') {
      // If the chosen segment ends at the jump, apply its discontinuity explicitly.
      const usesLeftSegment = Math.abs(segment.x1 - clamped) <= tolerance;
      if (usesLeftSegment) {
        point.axial += jump.axialDelta;
        point.shear += jump.shearDelta;
        point.moment += jump.momentDelta;
      }
    } else {
      // At x=0 the only segment starts on the right of the jump. Recover the
      // exterior left limit by undoing that jump. At internal jumps the left
      // segment is selected and no correction is necessary.
      const usesRightSegment = Math.abs(segment.x0 - clamped) <= tolerance;
      if (usesRightSegment) {
        point.axial -= jump.axialDelta;
        point.shear -= jump.shearDelta;
        point.moment -= jump.momentDelta;
      }
    }
  }
  point.side = jump ? side : 'continuous';
  return point;
};

export const buildDeformationCurve = (
  segments: DiagramSegment[],
  member: MemberModel,
  localDisplacements: readonly number[],
  initial: { axialStrain?: number; curvature?: number; shearRigidity?: number } = {},
): {
  points: DeformationPoint[];
  segments: DeformationSegment[];
  criticalPoints: DeformationCriticalPoint[];
  compatibilityError: number;
  compatibilityComponents: { du: number; dv: number; dtheta: number };
  } => {
  if (!segments.length || member.type === 'rigid') return { points: [], segments: [], criticalPoints: [], compatibilityError: 0, compatibilityComponents: { du: 0, dv: 0, dtheta: 0 } };
  const isFrame = member.type === 'frame';
  const EA = member.E * member.A;
  const EI = isFrame ? member.E * member.I : Number.POSITIVE_INFINITY;
  const axialStrain = initial.axialStrain ?? 0;
  const curvature = initial.curvature ?? 0;
  const inverseShearRigidity = isFrame && initial.shearRigidity && initial.shearRigidity > 0 ? 1 / initial.shearRigidity : 0;
  const memberLength = (segments.at(-1)?.x1 ?? 0) - (segments[0]?.x0 ?? 0);
  const trussTransverseSlope = !isFrame && memberLength > 0
    ? ((localDisplacements[4] ?? 0) - (localDisplacements[1] ?? 0)) / memberLength
    : 0;
  let u0 = localDisplacements[0] ?? 0;
  let v0 = localDisplacements[1] ?? 0;
  let theta0 = isFrame ? localDisplacements[2] ?? 0 : 0;
  const points: DeformationPoint[] = [];
  const deformationSegments: DeformationSegment[] = [];

  for (const segment of segments) {
    const h = segment.x1 - segment.x0;
    const [n0, n1, n2] = segment.axial;
    const [shear0, shear1, shear2] = segment.shear;
    const [m0, m1, m2, m3] = segment.moment;
    const uCoefficients: DeformationSegment['u'] = [
      u0,
      n0 / EA + axialStrain,
      n1 / (2 * EA),
      n2 / (3 * EA),
    ];
    const thetaCoefficients: DeformationSegment['theta'] = isFrame ? [
      theta0,
      m0 / EI + curvature,
      m1 / (2 * EI),
      m2 / (3 * EI),
      m3 / (4 * EI),
    ] : [0, 0, 0, 0, 0];
    const vCoefficients: DeformationSegment['v'] = isFrame ? [
      v0,
      thetaCoefficients[0] - shear0 * inverseShearRigidity,
      (thetaCoefficients[1] - shear1 * inverseShearRigidity) / 2,
      (thetaCoefficients[2] - shear2 * inverseShearRigidity) / 3,
      thetaCoefficients[3] / 4,
      thetaCoefficients[4] / 5,
    ] : [v0, trussTransverseSlope, 0, 0, 0, 0];
    const deformationSegment: DeformationSegment = {
      x0: segment.x0,
      x1: segment.x1,
      u: uCoefficients,
      theta: thetaCoefficients,
      v: vCoefficients,
    };
    deformationSegments.push(deformationSegment);
    const at = (xi: number): DeformationPoint => {
      const u = evaluatePolynomial(uCoefficients, xi);
      const theta = evaluatePolynomial(thetaCoefficients, xi);
      const v = evaluatePolynomial(vCoefficients, xi);
      return { x: segment.x0 + xi, u, v, theta };
    };
    const start = at(0);
    const end = at(h);
    if (!points.length) points.push(start);
    const addAdaptive = (left: DeformationPoint, right: DeformationPoint, depth: number) => {
      const midpoint = at(0.5 * (left.x + right.x) - segment.x0);
      const chordU = 0.5 * (left.u + right.u);
      const chordV = 0.5 * (left.v + right.v);
      const chordTheta = 0.5 * (left.theta + right.theta);
      const scale = Math.max(1, h, Math.abs(left.u), Math.abs(right.u), Math.abs(left.v), Math.abs(right.v));
      const error = Math.max(Math.abs(midpoint.u - chordU), Math.abs(midpoint.v - chordV), h * Math.abs(midpoint.theta - chordTheta));
      if (depth >= 12 || error <= 1e-9 * scale) {
        points.push(right);
        return;
      }
      addAdaptive(left, midpoint, depth + 1);
      addAdaptive(midpoint, right, depth + 1);
    };
    addAdaptive(start, end, 0);
    u0 = evaluatePolynomial(uCoefficients, h);
    v0 = evaluatePolynomial(vCoefficients, h);
    theta0 = evaluatePolynomial(thetaCoefficients, h);
  }

  const criticalPoints: DeformationCriticalPoint[] = [];
  const addCritical = (point: DeformationCriticalPoint) => {
    const length = deformationSegments.at(-1)?.x1 ?? 1;
    const duplicate = criticalPoints.some((item) => item.quantity === point.quantity && item.kind === point.kind && Math.abs(item.x - point.x) <= coordinateTolerance(length) && Math.abs(item.value - point.value) <= 1e-10 * Math.max(1, Math.abs(item.value), Math.abs(point.value)));
    if (!duplicate) criticalPoints.push(point);
  };
  for (const segment of deformationSegments) {
    const h = segment.x1 - segment.x0;
    for (const quantity of ['u', 'v', 'theta'] as const) {
      const coefficients = segment[quantity];
      rootsInInterval(coefficients, h).forEach((xi) => addCritical({ x: segment.x0 + xi, quantity, value: 0, kind: 'zero' }));
      const derivative = coefficients.slice(1).map((coefficient, index) => coefficient * (index + 1));
      const secondDerivative = derivative.slice(1).map((coefficient, index) => coefficient * (index + 1));
      rootsInInterval(derivative, h).forEach((xi) => {
        const curvatureAtRoot = evaluatePolynomial(secondDerivative, xi);
        const delta = Math.max(h * 1e-6, coordinateTolerance(h));
        const value = evaluatePolynomial(coefficients, xi);
        const left = evaluatePolynomial(coefficients, Math.max(0, xi - delta));
        const right = evaluatePolynomial(coefficients, Math.min(h, xi + delta));
        const kind = curvatureAtRoot < 0 || (value > left && value > right) ? 'maximum' : curvatureAtRoot > 0 || (value < left && value < right) ? 'minimum' : null;
        if (kind) addCritical({ x: segment.x0 + xi, quantity, value, kind });
      });
    }
  }
  const responseAt = (segment: DeformationSegment, quantity: 'u' | 'v' | 'theta', x: number) => evaluatePolynomial(segment[quantity], x - segment.x0);
  for (const quantity of ['u', 'v', 'theta'] as const) {
    const candidates = deformationSegments.flatMap((segment) => [
      { x: segment.x0, value: responseAt(segment, quantity, segment.x0) },
      { x: segment.x1, value: responseAt(segment, quantity, segment.x1) },
      ...criticalPoints.filter((point) => point.quantity === quantity && (point.kind === 'maximum' || point.kind === 'minimum')).map((point) => ({ x: point.x, value: point.value })),
    ]);
    if (candidates.length) {
      const maximum = candidates.reduce((best, point) => point.value > best.value ? point : best);
      const minimum = candidates.reduce((best, point) => point.value < best.value ? point : best);
      addCritical({ ...maximum, quantity, kind: 'maximum' });
      addCritical({ ...minimum, quantity, kind: 'minimum' });
      const first = deformationSegments[0];
      const last = deformationSegments.at(-1)!;
      addCritical({ x: first.x0, quantity, value: responseAt(first, quantity, first.x0), kind: 'end' });
      addCritical({ x: last.x1, quantity, value: responseAt(last, quantity, last.x1), kind: 'end' });
    }
  }
  criticalPoints.sort((a, b) => a.x - b.x || a.quantity.localeCompare(b.quantity) || a.kind.localeCompare(b.kind));

  const target = [localDisplacements[3] ?? u0, localDisplacements[4] ?? v0, isFrame ? localDisplacements[5] ?? theta0 : 0];
  const compatibilityComponents = { du: u0 - target[0], dv: v0 - target[1], dtheta: theta0 - target[2] };
  const characteristicLength = Math.max(segments.at(-1)?.x1 ?? 1, Number.EPSILON);
  const compatibilityError = Math.max(
    Math.abs(compatibilityComponents.du) / characteristicLength,
    Math.abs(compatibilityComponents.dv) / characteristicLength,
    Math.abs(compatibilityComponents.dtheta),
  );
  return { points, segments: deformationSegments, criticalPoints, compatibilityError, compatibilityComponents };
};

export const evaluateDeformationAt = (
  segments: DeformationSegment[],
  x: number,
): DeformationPoint | null => {
  if (!segments.length) return null;
  const length = segments.at(-1)!.x1;
  const clamped = Math.max(0, Math.min(length, x));
  const tolerance = intervalCoordinateTolerance(length);
  const segment = segments.find((item) => clamped >= item.x0 - tolerance && clamped <= item.x1 + tolerance) ?? segments.at(-1)!;
  const xi = Math.max(0, Math.min(segment.x1 - segment.x0, clamped - segment.x0));
  return {
    x: clamped,
    u: evaluatePolynomial(segment.u, xi),
    v: evaluatePolynomial(segment.v, xi),
    theta: evaluatePolynomial(segment.theta, xi),
  };
};

/** Converts a polynomial segment to an exact cubic Bézier path command.
 *  The x coordinate is linear, and N/V/M are at most cubic in x.
 */
export const segmentBezierControls = (
  segment: DiagramSegment,
  quantity: DiagramQuantity,
): { x0: number; x1: number; y0: number; c1x: number; c1y: number; c2x: number; c2y: number; y1: number } => {
  const h = segment.x1 - segment.x0;
  const coefficients = quantity === 'axial' ? [...segment.axial, 0] : quantity === 'shear' ? [...segment.shear, 0] : segment.moment;
  const a0 = coefficients[0];
  const a1 = coefficients[1] * h;
  const a2 = coefficients[2] * h ** 2;
  const a3 = coefficients[3] * h ** 3;
  const y0 = a0;
  const y1 = a0 + a1 + a2 + a3;
  const c1y = y0 + a1 / 3;
  const derivativeAtEnd = a1 + 2 * a2 + 3 * a3;
  const c2y = y1 - derivativeAtEnd / 3;
  return {
    x0: segment.x0,
    x1: segment.x1,
    y0,
    c1x: segment.x0 + h / 3,
    c1y,
    c2x: segment.x0 + (2 * h) / 3,
    c2y,
    y1,
  };
};
