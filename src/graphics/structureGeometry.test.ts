/**
 * The canvas and the PDF report now share one geometry kernel. These are the properties both
 * of them relied on when each had its own copy of the math.
 */
import { describe, expect, it } from 'vitest';
import type { MemberLoad, MemberModel, NodeModel } from '../types';
import {
  distributedIntensityAt,
  flexibleRatioFromGross,
  grossRatioAtPoint,
  grossRatioFromFlexible,
  lerpPoint,
  memberAxis,
  modelBounds,
  pointAtGrossRatio,
  toGlobalVector,
} from './structureGeometry';

const node = (id: string, x: number, y: number): NodeModel => ({ id, x, y, support: { type: 'none' } });

const member = (overrides: Partial<MemberModel> = {}): MemberModel => ({
  id: 'M1', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, ...overrides,
});

const distributed = (overrides: Partial<MemberLoad> = {}): MemberLoad => ({
  id: 'ML1', memberId: 'M1', caseId: 'LC1', type: 'distributed',
  coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, ...overrides,
});

describe('memberAxis', () => {
  it('resolves direction, normal and flexible span', () => {
    const axis = memberAxis(member({ rigidOffsetI: 1, rigidOffsetJ: 2 }), node('A', 0, 0), node('B', 10, 0));
    expect(axis.length).toBe(10);
    expect(axis.c).toBe(1);
    expect(axis.s).toBe(0);
    expect(axis.flexibleLength).toBe(7);
    // Local +y is 90 degrees counter-clockwise from the member.
    expect(axis.normal).toEqual({ x: -0, y: 1 });
  });

  it('keeps the normal unit-long and orthogonal on a skew member', () => {
    const axis = memberAxis(member(), node('A', 1, 1), node('B', 4, 5));
    expect(axis.length).toBe(5);
    expect(axis.c * axis.normal.x + axis.s * axis.normal.y).toBeCloseTo(0, 15);
    expect(Math.hypot(axis.normal.x, axis.normal.y)).toBeCloseTo(1, 15);
  });
});

describe('stations along the member', () => {
  const axis = memberAxis(member({ rigidOffsetI: 2, rigidOffsetJ: 2 }), node('A', 0, 0), node('B', 10, 0));

  it('maps the flexible span onto the gross member', () => {
    expect(grossRatioFromFlexible(axis, 0)).toBeCloseTo(0.2, 12);
    expect(grossRatioFromFlexible(axis, 1)).toBeCloseTo(0.8, 12);
    expect(pointAtGrossRatio(axis, grossRatioFromFlexible(axis, 0.5))).toEqual({ x: 5, y: 0 });
  });

  it('round-trips against flexibleRatioFromGross', () => {
    for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
      expect(flexibleRatioFromGross(axis, grossRatioFromFlexible(axis, ratio))).toBeCloseTo(ratio, 12);
    }
  });

  it('clamps a gross ratio that falls inside a rigid end zone', () => {
    // A pointer over the rigid zone must not place a load outside the flexible span.
    expect(flexibleRatioFromGross(axis, 0)).toBe(0);
    expect(flexibleRatioFromGross(axis, 1)).toBe(1);
  });

  it('degrades to the flexible ratio on a zero-length member instead of dividing by zero', () => {
    const degenerate = memberAxis(member(), node('A', 3, 3), node('B', 3, 3));
    expect(grossRatioFromFlexible(degenerate, 0.4)).toBe(0.4);
  });

  it('projects a pointer onto the member and clamps it to the ends', () => {
    const beam = memberAxis(member(), node('A', 0, 0), node('B', 8, 0));
    expect(grossRatioAtPoint(beam, { x: 2, y: 5 })).toBeCloseTo(0.25, 12);
    expect(grossRatioAtPoint(beam, { x: -4, y: 0 })).toBe(0);
    expect(grossRatioAtPoint(beam, { x: 99, y: 0 })).toBe(1);
  });

  it('interpolates already-projected endpoints', () => {
    expect(lerpPoint({ x: 10, y: 20 }, { x: 30, y: 60 }, 0.25)).toEqual({ x: 15, y: 30 });
  });
});

describe('toGlobalVector', () => {
  it('passes a global vector through untouched', () => {
    const axis = memberAxis(member(), node('A', 0, 0), node('B', 0, 4));
    expect(toGlobalVector(axis, 'global', 3, -7)).toEqual([3, -7]);
  });

  it('rotates a local vector onto a vertical member', () => {
    const axis = memberAxis(member(), node('A', 0, 0), node('B', 0, 4));
    // Local +x points up the column, so a local +y load pushes toward global -x.
    const [gx, gy] = toGlobalVector(axis, 'local', 0, 5);
    expect(gx).toBeCloseTo(-5, 12);
    expect(gy).toBeCloseTo(0, 12);
  });
});

describe('distributedIntensityAt', () => {
  it('interpolates between the declared ends', () => {
    const load = distributed({ qyStart: -10, qyEnd: -30, qxStart: 0, qxEnd: 4 });
    expect(distributedIntensityAt(load, 0)).toEqual({ qx: 0, qy: -10 });
    expect(distributedIntensityAt(load, 0.5)).toEqual({ qx: 2, qy: -20 });
    expect(distributedIntensityAt(load, 1)).toEqual({ qx: 4, qy: -30 });
  });

  it('treats a missing end intensity as uniform, not as zero', () => {
    const load = distributed({ qyStart: -12 });
    expect(distributedIntensityAt(load, 1)).toEqual({ qx: 0, qy: -12 });
  });
});

describe('modelBounds', () => {
  it('spans every node', () => {
    expect(modelBounds([node('A', -2, 5), node('B', 7, -1), node('C', 3, 3)]))
      .toEqual({ minX: -2, maxX: 7, minY: -1, maxY: 5 });
  });
});
