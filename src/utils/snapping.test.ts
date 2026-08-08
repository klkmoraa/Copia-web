import { describe, expect, it } from 'vitest';
import {
  buildIntersectionSnapCandidates,
  buildPerpendicularSnapCandidates,
  resolveSnap,
  snapModelPoint,
  type SnapCandidate,
  type SnapSegment,
} from './snapping';

describe('snapModelPoint', () => {
  it('keeps the target tolerance constant in screen pixels across zoom levels', () => {
    const target = { x: 3, y: 2 };
    const zoomedOut = snapModelPoint({ x: 3.2, y: 2 }, { enabled: true, gridSize: 1, pixelsPerUnit: 50, targets: [target] });
    const zoomedIn = snapModelPoint({ x: 3.1, y: 2 }, { enabled: true, gridSize: 1, pixelsPerUnit: 100, targets: [target] });
    expect(zoomedOut).toEqual(target);
    expect(zoomedIn).toEqual(target);
  });

  it('chooses the closest node or midpoint candidate before the grid', () => {
    const result = snapModelPoint({ x: 2.08, y: 2.06 }, {
      enabled: true, gridSize: 1, pixelsPerUnit: 100,
      targets: [{ x: 2, y: 2 }, { x: 2.1, y: 2.05 }],
    });
    expect(result).toEqual({ x: 2.1, y: 2.05 });
  });

  it('falls back to grid snapping outside the screen-space tolerance', () => {
    const result = snapModelPoint({ x: 1.42, y: 2.61 }, { enabled: true, gridSize: 0.5, pixelsPerUnit: 100, targets: [{ x: 9, y: 9 }] });
    expect(result).toEqual({ x: 1.5, y: 2.5 });
  });

  it('preserves the unsnapped point when snapping or the grid mode is disabled', () => {
    const point = { x: 1.42, y: 2.61 };
    expect(resolveSnap(point, { enabled: false, gridSize: 1, pixelsPerUnit: 100 }).kind).toBe('none');
    expect(resolveSnap(point, {
      enabled: true, gridSize: 1, pixelsPerUnit: 100, modes: { grid: false },
    })).toMatchObject({ point, kind: 'none' });
  });

  it('uses semantic priority before distance and allows callers to override it', () => {
    const candidates = [
      { x: 0.02, y: 0, kind: 'midpoint' as const },
      { x: 0.08, y: 0, kind: 'node' as const },
    ];
    const preferredNode = resolveSnap({ x: 0, y: 0 }, {
      enabled: true, gridSize: 1, pixelsPerUnit: 100, candidates,
    });
    expect(preferredNode.kind).toBe('node');

    const preferredMidpoint = resolveSnap({ x: 0, y: 0 }, {
      enabled: true, gridSize: 1, pixelsPerUnit: 100, candidates,
      priority: ['midpoint', 'node', 'grid'],
    });
    expect(preferredMidpoint.kind).toBe('midpoint');
    expect(preferredMidpoint.distancePixels).toBeCloseTo(2);
  });

  it('respects individual mode toggles', () => {
    const result = resolveSnap({ x: 0, y: 0 }, {
      enabled: true,
      gridSize: 1,
      pixelsPerUnit: 100,
      candidates: [
        { x: 0.03, y: 0, kind: 'node' },
        { x: 0.05, y: 0, kind: 'midpoint' },
      ],
      modes: { node: false },
    });
    expect(result.kind).toBe('midpoint');
  });
});

describe('geometric snap candidates', () => {
  const segments: SnapSegment[] = [
    { id: 'M1', start: { x: 0, y: 0 }, end: { x: 4, y: 4 } },
    { id: 'M2', start: { x: 0, y: 4 }, end: { x: 4, y: 0 } },
  ];

  it('finds a unique interior intersection with its source members', () => {
    expect(buildIntersectionSnapCandidates(segments)).toEqual([
      { x: 2, y: 2, kind: 'intersection', sourceIds: ['M1', 'M2'] },
    ]);
  });

  it('ignores parallel, collinear and shared-end intersections by default', () => {
    const candidates = buildIntersectionSnapCandidates([
      { id: 'A', start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
      { id: 'B', start: { x: 0, y: 1 }, end: { x: 2, y: 1 } },
      { id: 'C', start: { x: 1, y: 0 }, end: { x: 3, y: 0 } },
      { id: 'D', start: { x: 2, y: 0 }, end: { x: 2, y: 2 } },
    ]);
    expect(candidates).toEqual([]);
  });

  it('deduplicates coincident intersections from several members', () => {
    const candidates = buildIntersectionSnapCandidates([
      ...segments,
      { id: 'M3', start: { x: 2, y: -1 }, end: { x: 2, y: 5 } },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ x: 2, y: 2, kind: 'intersection' });
    expect(candidates[0].sourceIds).toEqual(['M1', 'M2', 'M3']);
  });

  it('can include endpoint intersections explicitly without duplicating their coordinate', () => {
    const candidates = buildIntersectionSnapCandidates([
      { id: 'A', start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
      { id: 'B', start: { x: 2, y: 0 }, end: { x: 2, y: 2 } },
      { id: 'C', start: { x: 2, y: 0 }, end: { x: 3, y: -1 } },
    ], { includeEndpoints: true });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].sourceIds).toEqual(['A', 'B', 'C']);
  });

  it('builds perpendicular feet only when they lie on finite members', () => {
    const finite = buildPerpendicularSnapCandidates({ x: 2, y: 3 }, [
      { id: 'beam', start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
    ]);
    expect(finite).toEqual([{ x: 2, y: 0, kind: 'perpendicular', sourceIds: ['beam'] }]);

    const outside = buildPerpendicularSnapCandidates({ x: 7, y: 3 }, [
      { id: 'beam', start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
    ]);
    expect(outside).toEqual([]);

    const extension = buildPerpendicularSnapCandidates({ x: 7, y: 3 }, [
      { id: 'beam', start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
    ], { includeExtensions: true });
    expect(extension[0]).toMatchObject({ x: 7, y: 0, kind: 'perpendicular' });
  });

  it('keeps vertical, coincident and zero-length members from disturbing the broad phase', () => {
    const candidates = buildIntersectionSnapCandidates([
      { id: 'V1', start: { x: 2, y: -5 }, end: { x: 2, y: 5 } },
      { id: 'V2', start: { x: 2, y: -5 }, end: { x: 2, y: 5 } },
      { id: 'ZERO', start: { x: 2, y: 0 }, end: { x: 2, y: 0 } },
      { id: 'H1', start: { x: -5, y: 0 }, end: { x: 5, y: 0 } },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ x: 2, y: 0, kind: 'intersection' });
    // The two coincident verticals both cross the beam at the same point, so the
    // shared candidate accumulates every source and the degenerate one is ignored.
    expect(candidates[0].sourceIds).toEqual(['V1', 'H1', 'V2']);
  });
});

/**
 * Reference implementations kept deliberately naive: the production builders use
 * a spatial broad phase, and these exhaustive scans are what the broad phase must
 * reproduce candidate for candidate.
 */
const naiveIntersections = (segments: SnapSegment[]): SnapCandidate[] => {
  const epsilon = Number.EPSILON > 1e-9 ? Number.EPSILON : 1e-9;
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const candidates: SnapCandidate[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const first = segments[i];
    const rx = first.end.x - first.start.x;
    const ry = first.end.y - first.start.y;
    if (rx * rx + ry * ry <= epsilon * epsilon) continue;
    for (let j = i + 1; j < segments.length; j += 1) {
      const second = segments[j];
      const sx = second.end.x - second.start.x;
      const sy = second.end.y - second.start.y;
      if (sx * sx + sy * sy <= epsilon * epsilon) continue;
      const denominator = cross(rx, ry, sx, sy);
      const scale = Math.max(Math.hypot(rx, ry) * Math.hypot(sx, sy), 1);
      if (Math.abs(denominator) <= epsilon * scale) continue;
      const qpx = second.start.x - first.start.x;
      const qpy = second.start.y - first.start.y;
      const t = cross(qpx, qpy, sx, sy) / denominator;
      const u = cross(qpx, qpy, rx, ry) / denominator;
      if (!(t >= -epsilon && t <= 1 + epsilon && u >= -epsilon && u <= 1 + epsilon)) continue;
      if (t <= epsilon || t >= 1 - epsilon || u <= epsilon || u >= 1 - epsilon) continue;
      const point = { x: first.start.x + t * rx, y: first.start.y + t * ry };
      const duplicate = candidates.find((candidate) => (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2 <= epsilon * epsilon);
      if (duplicate) duplicate.sourceIds = [...new Set([...(duplicate.sourceIds ?? []), first.id, second.id])];
      else candidates.push({ ...point, kind: 'intersection', sourceIds: [first.id, second.id] });
    }
  }
  return candidates;
};

/** Deterministic sequence so a parity failure is always reproducible. */
const pseudoRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const denseTruss = (memberCount: number): SnapSegment[] => {
  const next = pseudoRandom(20260805);
  return Array.from({ length: memberCount }, (_, index) => ({
    id: `M${index}`,
    start: { x: Math.round(next() * 400) / 10, y: Math.round(next() * 400) / 10 },
    end: { x: Math.round(next() * 400) / 10, y: Math.round(next() * 400) / 10 },
  }));
};

describe('spatial broad phase', () => {
  it('matches the exhaustive scan candidate for candidate on a dense model', () => {
    const segments = denseTruss(150);
    expect(buildIntersectionSnapCandidates(segments)).toEqual(naiveIntersections(segments));
  });

  it('matches the exhaustive scan on a regular grid where boxes touch without crossing', () => {
    const segments: SnapSegment[] = [];
    for (let index = 0; index <= 12; index += 1) {
      segments.push({ id: `H${index}`, start: { x: 0, y: index }, end: { x: 12, y: index } });
      segments.push({ id: `V${index}`, start: { x: index, y: 0 }, end: { x: index, y: 12 } });
    }
    const candidates = buildIntersectionSnapCandidates(segments);
    // Only the 11×11 interior crossings qualify; the perimeter ones sit on an end.
    expect(candidates).toHaveLength(121);
    expect(candidates).toEqual(naiveIntersections(segments));
  });

  it('resolves a snap over a dense candidate set well inside the frame budget', () => {
    const segments = denseTruss(150);
    const candidates = [
      ...segments.map((segment) => ({ x: segment.start.x, y: segment.start.y, kind: 'node' as const, sourceIds: [segment.id] })),
      ...buildIntersectionSnapCandidates(segments),
    ];
    const query = { x: candidates[0].x + 0.001, y: candidates[0].y + 0.001 };
    const started = performance.now();
    for (let iteration = 0; iteration < 100; iteration += 1) {
      resolveSnap(query, { enabled: true, gridSize: 1, pixelsPerUnit: 100, candidates });
    }
    const perCall = (performance.now() - started) / 100;
    expect(resolveSnap(query, { enabled: true, gridSize: 1, pixelsPerUnit: 100, candidates }).kind).toBe('node');
    expect(perCall).toBeLessThan(2);
  });
});
