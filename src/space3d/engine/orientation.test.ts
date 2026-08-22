import { describe, expect, it } from 'vitest';
import { buildMemberOrientation } from './orientation';

const testDot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const testCross = (a: readonly number[], b: readonly number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const expectVectorClose = (actual: readonly number[], expected: readonly number[], digits = 12) =>
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], digits));

describe('Space3D member orientation', () => {
  it('construye una triada diestra y aplica roll pi/2', () => {
    const basis = buildMemberOrientation([0, 0, 0], [2, 0, 0], {
      localYReferenceGlobal: [0, 1, 0], rollRadians: Math.PI / 2,
    });
    expect(basis.x).toEqual([1, 0, 0]);
    expectVectorClose(basis.y, [0, 0, 1], 1e-12);
    expectVectorClose(basis.z, [0, -1, 0], 1e-12);
    expect(testDot(testCross(basis.x, basis.y), basis.z)).toBeCloseTo(1, 12);
  });

  it('rechaza una referencia paralela sin elegir un up alternativo', () => {
    expect(() => buildMemberOrientation([0, 0, 0], [1, 0, 0], {
      localYReferenceGlobal: [2, 0, 0], rollRadians: 0,
    })).toThrow(/orientation-reference-parallel/);
  });

  it('rechaza un miembro de longitud nula y una referencia nula', () => {
    expect(() => buildMemberOrientation([1, 2, 3], [1, 2, 3], {
      localYReferenceGlobal: [0, 1, 0], rollRadians: 0,
    })).toThrow(/zero-length-member/);
    expect(() => buildMemberOrientation([0, 0, 0], [1, 0, 0], {
      localYReferenceGlobal: [0, 0, 0], rollRadians: 0,
    })).toThrow(/orientation-reference-zero/);
  });

  it('mantiene la triada ortonormal y diestra para un miembro oblicuo', () => {
    const basis = buildMemberOrientation([1, -2, 0.5], [3.5, 4, -2.25], {
      localYReferenceGlobal: [0, 1, 0], rollRadians: 0.37,
    });
    expect(testDot(basis.x, basis.x)).toBeCloseTo(1, 12);
    expect(testDot(basis.y, basis.y)).toBeCloseTo(1, 12);
    expect(testDot(basis.z, basis.z)).toBeCloseTo(1, 12);
    expect(testDot(basis.x, basis.y)).toBeCloseTo(0, 12);
    expect(testDot(basis.x, basis.z)).toBeCloseTo(0, 12);
    expect(testDot(basis.y, basis.z)).toBeCloseTo(0, 12);
    expectVectorClose(testCross(basis.x, basis.y), basis.z, 1e-12);
  });

  it('interpreta el roll en radianes, no en grados', () => {
    const radians = buildMemberOrientation([0, 0, 0], [2, 0, 0], {
      localYReferenceGlobal: [0, 1, 0], rollRadians: 1,
    });
    // Un grado daría y ≈ [0, 0.9998, 0.0175]; un radián da cos(1) ≈ 0.5403.
    expect(radians.y[1]).toBeCloseTo(Math.cos(1), 12);
    expect(radians.y[2]).toBeCloseTo(Math.sin(1), 12);
  });

  it('congela la triada devuelta', () => {
    const basis = buildMemberOrientation([0, 0, 0], [0, 3, 0], {
      localYReferenceGlobal: [1, 0, 0], rollRadians: 0,
    });
    expect(Object.isFrozen(basis)).toBe(true);
    expect(Object.isFrozen(basis.x)).toBe(true);
    expectVectorClose(basis.x, [0, 1, 0], 1e-12);
    expectVectorClose(basis.y, [1, 0, 0], 1e-12);
    expectVectorClose(basis.z, [0, 0, -1], 1e-12);
  });
});
