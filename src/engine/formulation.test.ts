import { describe, expect, it } from 'vitest';
import type { MemberModel } from '../types';
import { multiply, multiplyMatrixVector, transpose } from './math';
import { frameLocalStiffness, transformMatrix } from './solver';

// Primary references:
// Purdue CE474, Frame Element Stiffness Matrix Derivation:
// https://engineering.purdue.edu/~ce474/Docs/FRAME%20ELEMENT%20STIFFNESS%20MATRIX%20DERIVATION%20_FULL_.pdf
// Duke CEE421L, The Matrix Stiffness Method for 2D Frames:
// https://people.duke.edu/~hpgavin/cee421/frame-method.pdf

const member: MemberModel = {
  id: 'E1', i: 'A', j: 'B', type: 'frame', E: 210e6, A: 0.012, I: 8.5e-5,
};

const close = (actual: number, expected: number, rtol = 1e-12, atol = 1e-12) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + rtol * Math.max(1, Math.abs(expected)));
};

const quadraticForm = (matrix: number[][], vector: number[]) =>
  vector.reduce((sum, value, index) => sum + value * multiplyMatrixVector(matrix, vector)[index], 0);

describe('formulación del elemento de pórtico plano Euler-Bernoulli', () => {
  it('reproduce término por término la matriz local publicada', () => {
    const L = 5;
    const k = frameLocalStiffness(member, L);
    const a = member.E * member.A / L;
    const b = 12 * member.E * member.I / L ** 3;
    const c = 6 * member.E * member.I / L ** 2;
    const d = 4 * member.E * member.I / L;
    const e = 2 * member.E * member.I / L;
    const expected = [
      [a, 0, 0, -a, 0, 0],
      [0, b, c, 0, -b, c],
      [0, c, d, 0, -c, e],
      [-a, 0, 0, a, 0, 0],
      [0, -b, -c, 0, b, -c],
      [0, c, e, 0, -c, d],
    ];
    k.forEach((row, i) => row.forEach((value, j) => close(value, expected[i][j])));
  });

  it('es simétrica y no genera fuerzas para los tres modos de cuerpo rígido', () => {
    const L = 5;
    const k = frameLocalStiffness(member, L);
    k.forEach((row, i) => row.forEach((value, j) => close(value, k[j][i])));
    const rigidModes = [
      [1, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 0],
      [0, 0, 1, 0, L, 1],
    ];
    rigidModes.forEach((mode) => multiplyMatrixVector(k, mode).forEach((force) => close(force, 0, 1e-12, 1e-7)));
  });

  it('conserva energía de deformación al transformar local-global', () => {
    const L = 5;
    const c = 0.6;
    const s = 0.8;
    const kLocal = frameLocalStiffness(member, L);
    const T = transformMatrix({ L, c, s, dx: c * L, dy: s * L });
    const identity = multiply(T, transpose(T));
    identity.forEach((row, i) => row.forEach((value, j) => close(value, i === j ? 1 : 0)));
    const kGlobal = multiply(multiply(transpose(T), kLocal), T);
    const globalDisplacements = [0.001, -0.002, 0.0004, 0.003, 0.001, -0.0002];
    const localDisplacements = multiplyMatrixVector(T, globalDisplacements);
    close(
      quadraticForm(kGlobal, globalDisplacements),
      quadraticForm(kLocal, localDisplacements),
      2e-12,
      1e-10,
    );
    expect(quadraticForm(kGlobal, globalDisplacements)).toBeGreaterThan(0);
  });
});
