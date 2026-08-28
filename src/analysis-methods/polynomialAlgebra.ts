/**
 * Polynomial arithmetic over coefficient arrays.
 *
 * The solver publishes every internal action and every deformation as exact polynomials in
 * the local coordinate ξ = x − x0 (`DiagramSegment`, `DeformationSegment`). Integrating,
 * evaluating and superposing those is all the "symbolic maths" the solution methods need, and
 * on plain `number[]` it is a handful of lines — which is why this module exists instead of a
 * computer-algebra dependency that would cost far more than it earns.
 *
 * Convention: `coefficients[k]` multiplies ξᵏ, so `[3, 0, -2]` is `3 − 2ξ²`. Trailing zeros
 * are meaningless and are trimmed, so two equal polynomials always compare equal by length.
 */

export type Polynomial = readonly number[];

/** Drops trailing zeros so degree is a property of the value, not of how it was built. */
export const trim = (polynomial: Polynomial): number[] => {
  const coefficients = [...polynomial];
  while (coefficients.length > 1 && coefficients[coefficients.length - 1] === 0) coefficients.pop();
  return coefficients;
};

export const evaluate = (polynomial: Polynomial, x: number): number => {
  // Horner: fewer multiplications and less rounding drift than powering ξ term by term.
  let value = 0;
  for (let power = polynomial.length - 1; power >= 0; power -= 1) value = value * x + polynomial[power];
  return value;
};

export const add = (a: Polynomial, b: Polynomial): number[] => {
  const result = new Array<number>(Math.max(a.length, b.length)).fill(0);
  for (const [index, value] of a.entries()) result[index] += value;
  for (const [index, value] of b.entries()) result[index] += value;
  return trim(result);
};

export const scale = (polynomial: Polynomial, factor: number): number[] =>
  trim(polynomial.map((coefficient) => coefficient * factor));

/** Sums any number of polynomials; the neutral element is the zero polynomial. */
export const sum = (polynomials: readonly Polynomial[]): number[] =>
  polynomials.reduce<number[]>((total, polynomial) => add(total, polynomial), [0]);

/**
 * Indefinite integral with a zero constant term.
 *
 * The constant is deliberately left at zero: in the double-integration method it is the
 * unknown the boundary conditions determine, so baking one in here would quietly answer a
 * question the method exists to ask.
 */
export const integrate = (polynomial: Polynomial): number[] => {
  const result = [0];
  for (const [power, coefficient] of polynomial.entries()) result.push(coefficient / (power + 1));
  return trim(result);
};

export const differentiate = (polynomial: Polynomial): number[] => {
  if (polynomial.length <= 1) return [0];
  return trim(polynomial.slice(1).map((coefficient, index) => coefficient * (index + 1)));
};

/** Shifts the variable: returns q(ξ) = p(ξ + delta). */
export const shift = (polynomial: Polynomial, delta: number): number[] => {
  if (delta === 0) return trim(polynomial);
  let result: number[] = [0];
  for (const [power, coefficient] of polynomial.entries()) {
    // (ξ + delta)^power expanded by the binomial theorem, scaled by its coefficient.
    let binomial = 1;
    const term = new Array<number>(power + 1).fill(0);
    for (let k = 0; k <= power; k += 1) {
      term[k] = binomial * delta ** (power - k);
      binomial = binomial * (power - k) / (k + 1);
    }
    result = add(result, scale(term, coefficient));
  }
  return result;
};

/** Largest |coefficient|, used as the reference magnitude when collapsing numeric noise. */
export const magnitude = (polynomial: Polynomial): number =>
  polynomial.reduce((largest, coefficient) => Math.max(largest, Math.abs(coefficient)), 0);
