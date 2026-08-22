import { describe, expect, it } from 'vitest';
import { buildSpaceFrameElement, spaceFrameLocalStiffness, spaceFrameTransformation } from './element';
import { buildMemberOrientation } from './orientation';
import { multiply, multiplyMatrixVector, transpose, type Matrix } from '../../engine/math';
import { freeSpace3DRestraints, type Space3DFrameMember, type Space3DNode } from '../model/types';

const expectMatrixClose = (actual: Matrix, expected: Matrix, digits = 10) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((row, i) => row.forEach((value, j) => expect(value).toBeCloseTo(expected[i][j], digits)));
};

const identity = (size: number): Matrix =>
  Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => (i === j ? 1 : 0)));

const node = (id: string, x: number, y: number, z: number): Space3DNode =>
  ({ id, x, y, z, restraints: freeSpace3DRestraints() });

const steel = (overrides: Partial<Space3DFrameMember> = {}): Space3DFrameMember => ({
  id: 'M1', i: 'I', j: 'J',
  E: 200_000_000, G: 77_000_000, A: 0.0076, Iy: 4.5e-5, Iz: 1.36e-4, J: 4e-7,
  orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
  ...overrides,
});

describe('Space3D local stiffness', () => {
  it('recupera rigideces axial y torsional sin acoplamiento espurio', () => {
    const k = spaceFrameLocalStiffness({ E: 200, G: 80, A: 3, Iy: 5, Iz: 7, J: 11 }, 2);
    expect(k[0][0]).toBe(300);
    expect(k[0][6]).toBe(-300);
    expect(k[3][3]).toBe(440);
    expect(k[3][9]).toBe(-440);
    expect(k[0][3]).toBe(0);
  });

  it('usa Iz para v-rz e Iy para w-ry', () => {
    const k = spaceFrameLocalStiffness({ E: 2, G: 3, A: 4, Iy: 5, Iz: 7, J: 11 }, 2);
    expect(k[1][1]).toBeCloseTo(12 * 2 * 7 / 2 ** 3);
    expect(k[2][2]).toBeCloseTo(12 * 2 * 5 / 2 ** 3);
    expect(k[1][5]).toBeCloseTo(6 * 2 * 7 / 2 ** 2);
    expect(k[2][4]).toBeCloseTo(-6 * 2 * 5 / 2 ** 2);
  });

  it('completa los cuatro bloques de flexión con los signos estándar', () => {
    const E = 2;
    const L = 2;
    const k = spaceFrameLocalStiffness({ E, G: 3, A: 4, Iy: 5, Iz: 7, J: 11 }, L);
    const EIz = E * 7;
    const EIy = E * 5;
    expect(k[1][7]).toBeCloseTo(-12 * EIz / L ** 3);
    expect(k[1][11]).toBeCloseTo(6 * EIz / L ** 2);
    expect(k[5][5]).toBeCloseTo(4 * EIz / L);
    expect(k[5][11]).toBeCloseTo(2 * EIz / L);
    expect(k[5][7]).toBeCloseTo(-6 * EIz / L ** 2);
    expect(k[2][8]).toBeCloseTo(-12 * EIy / L ** 3);
    expect(k[2][10]).toBeCloseTo(-6 * EIy / L ** 2);
    expect(k[4][4]).toBeCloseTo(4 * EIy / L);
    expect(k[4][10]).toBeCloseTo(2 * EIy / L);
    expect(k[4][8]).toBeCloseTo(6 * EIy / L ** 2);
  });

  it('es simétrica y no acopla ejes ortogonales', () => {
    const k = spaceFrameLocalStiffness({ E: 210, G: 81, A: 0.01, Iy: 3e-5, Iz: 8e-5, J: 5e-7 }, 3.4);
    for (let row = 0; row < 12; row += 1) {
      expect(k[row]).toHaveLength(12);
      for (let col = 0; col < 12; col += 1) expect(k[row][col]).toBeCloseTo(k[col][row], 15);
    }
    for (const [row, col] of [[0, 1], [0, 2], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [2, 3], [2, 5], [3, 4], [3, 5], [4, 5]]) {
      expect(k[row][col]).toBe(0);
    }
  });
});

describe('Space3D element transformation', () => {
  const basis = buildMemberOrientation([0, 0, 0], [2.5, 3.2, -1.4], {
    localYReferenceGlobal: [0, 1, 0], rollRadians: 0.63,
  });

  it('es ortogonal: T·Tᵀ = I', () => {
    const T = spaceFrameTransformation(basis);
    expectMatrixClose(multiply(T, transpose(T)), identity(12), 12);
  });

  it('deja T = I para un miembro sobre el eje global X con referencia Y', () => {
    const axisAligned = buildMemberOrientation([0, 0, 0], [4, 0, 0], {
      localYReferenceGlobal: [0, 1, 0], rollRadians: 0,
    });
    expectMatrixClose(spaceFrameTransformation(axisAligned), identity(12), 15);
  });

  it('compone k_global = Tᵀ·k_local·T y conserva la simetría', () => {
    const element = buildSpaceFrameElement(steel(), node('I', 1, -1, 0.5), node('J', 3.5, 2.2, -0.9));
    const expected = multiply(transpose(element.transformation), multiply(element.localStiffness, element.transformation));
    expectMatrixClose(element.globalStiffness, expected, 12);
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 12; col += 1) {
        expect(element.globalStiffness[row][col] - element.globalStiffness[col][row]).toBeCloseTo(0, 6);
      }
    }
  });

  it('produce energía de deformación no negativa y nula para un movimiento de sólido rígido', () => {
    const element = buildSpaceFrameElement(steel(), node('I', 0, 0, 0), node('J', 2, 1, 3));
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648 - 0.5;
    };
    for (let trial = 0; trial < 20; trial += 1) {
      const u = Array.from({ length: 12 }, () => random() * 1e-3);
      const energy = u.reduce((sum, value, index) => sum + value * multiplyMatrixVector(element.globalStiffness, u)[index], 0);
      expect(energy).toBeGreaterThanOrEqual(-1e-9);
    }

    const translation = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    multiplyMatrixVector(element.globalStiffness, translation)
      .forEach((value) => expect(Math.abs(value)).toBeLessThan(1e-3));
  });

  it('respeta el orden i-luego-j: el bloque j es la copia desplazada seis GDL', () => {
    const element = buildSpaceFrameElement(steel(), node('I', 0, 0, 0), node('J', 3, 0, 0));
    expect(element.length).toBeCloseTo(3, 12);
    expect(element.globalStiffness[0][0]).toBeCloseTo(element.globalStiffness[6][6], 9);
    expect(element.globalStiffness[0][6]).toBeCloseTo(-element.globalStiffness[0][0], 9);
  });
});
