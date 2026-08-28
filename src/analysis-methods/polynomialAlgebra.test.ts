/**
 * These are the operations every solution method leans on, so an error here would surface as
 * a wrong deflection in a signed document rather than as a failing unit.
 */
import { describe, expect, it } from 'vitest';
import { add, differentiate, evaluate, integrate, magnitude, scale, shift, sum, trim } from './polynomialAlgebra';

describe('evaluate', () => {
  it('lee el polinomio en el orden declarado: coefficients[k] multiplica ξᵏ', () => {
    expect(evaluate([3, 0, -2], 2)).toBe(3 - 2 * 4);
    expect(evaluate([32.5, -5], 3)).toBeCloseTo(17.5, 12);
  });
});

describe('integrate', () => {
  it('deja la constante en cero, que es la incógnita que fijan las condiciones de contorno', () => {
    expect(integrate([6, 0, 3])).toEqual([0, 6, 0, 1]);
  });

  it('es inversa de derivar salvo esa constante', () => {
    const original = [7, -2, 0.5, 4];
    expect(differentiate(integrate(original))).toEqual(trim(original));
  });

  it('reproduce la relación del motor: ∫(dV/dx) = V salvo constante', () => {
    // M(s) = 32.5 s − 2.5 s² del ejemplo Hibbeler: V = dM/dx = 32.5 − 5 s.
    expect(differentiate([0, 32.5, -2.5])).toEqual([32.5, -5]);
  });
});

describe('add, scale y sum', () => {
  it('superponen sin depender de la longitud de cada arreglo', () => {
    expect(add([1, 2], [0, 0, 3])).toEqual([1, 2, 3]);
    expect(scale([2, -4], 0.5)).toEqual([1, -2]);
    expect(sum([[1], [0, 1], [0, 0, 1]])).toEqual([1, 1, 1]);
  });

  it('recorta los ceros finales para que dos polinomios iguales lo parezcan', () => {
    expect(add([1, 1], [0, -1])).toEqual([1]);
    expect(trim([5, 0, 0])).toEqual([5]);
  });
});

describe('shift', () => {
  it('traslada la variable: p(ξ + d) evaluado en ξ es p evaluado en ξ + d', () => {
    const p = [1, -3, 2];
    const moved = shift(p, 1.5);
    for (const x of [-2, 0, 0.75, 3]) {
      expect(evaluate(moved, x)).toBeCloseTo(evaluate(p, x + 1.5), 10);
    }
  });

  it('no toca nada cuando el desplazamiento es cero', () => {
    expect(shift([4, 5, 6], 0)).toEqual([4, 5, 6]);
  });
});

describe('magnitude', () => {
  it('devuelve el mayor valor absoluto, que es la referencia contra la que se colapsa el ruido', () => {
    expect(magnitude([0.001, -47.2, 3])).toBe(47.2);
    expect(magnitude([0])).toBe(0);
  });
});
