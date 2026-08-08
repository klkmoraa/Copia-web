import { describe, expect, it } from 'vitest';
import { __testables, findNullSpaceVector, multiplyMatrixVector, solveLinearSystem, zeros, type Matrix } from './math';

const close = (actual: number, expected: number, tolerance = 1e-11) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));
};

interface TestConstraint { terms: Array<[number, number]> }

/**
 * The shape `solver.ts` actually hands to the solver: a symmetric stiffness
 * block bordered by Lagrange-multiplier constraint rows. The block is the 1D
 * Laplacian, which is symmetric positive definite, so the reduced system is
 * genuinely factorizable without pivoting once the constraints are removed.
 */
const augmentedSystem = (dofs: number, constraints: TestConstraint[]): Matrix => {
  const size = dofs + constraints.length;
  const matrix = zeros(size, size);
  for (let i = 0; i < dofs; i += 1) {
    matrix[i][i] = 2;
    if (i > 0) {
      matrix[i][i - 1] = -1;
      matrix[i - 1][i] = -1;
    }
  }
  constraints.forEach((constraint, row) => {
    for (const [index, coefficient] of constraint.terms) {
      matrix[index][dofs + row] += coefficient;
      matrix[dofs + row][index] += coefficient;
    }
  });
  return matrix;
};

/** Independent Gauss-Jordan inverse, used to check the condition estimate
 *  against a directly computed kappa_1 rather than against another estimate. */
const invert = (matrix: Matrix): Matrix => {
  const n = matrix.length;
  const work = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let column = 0; column < n; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(work[row][column]) > Math.abs(work[pivotRow][column])) pivotRow = row;
    }
    [work[column], work[pivotRow]] = [work[pivotRow], work[column]];
    const pivot = work[column][column];
    for (let j = 0; j < 2 * n; j += 1) work[column][j] /= pivot;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = work[row][column];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j += 1) work[row][j] -= factor * work[column][j];
    }
  }
  return work.map((row) => row.slice(n));
};

const oneNorm = (matrix: Matrix): number => {
  let norm = 0;
  for (let column = 0; column < matrix[0].length; column += 1) {
    let sum = 0;
    for (let row = 0; row < matrix.length; row += 1) sum += Math.abs(matrix[row][column]);
    norm = Math.max(norm, sum);
  }
  return norm;
};

/** Solves with a right-hand side built from a chosen answer, so the assertion
 *  compares against an exact solution instead of another factorization. */
const solveForKnown = (matrix: Matrix, expected: number[]) =>
  solveLinearSystem(matrix, multiplyMatrixVector(matrix, expected));

describe('solucionador lineal robusto', () => {
  it('resuelve un sistema con pivote inicial nulo mediante pivoteo', () => {
    const matrix: Matrix = [
      [0, 2, 1],
      [1, -2, -3],
      [2, 3, 1],
    ];
    const expected = [1.25, -0.5, 3];
    const result = solveLinearSystem(matrix, multiplyMatrixVector(matrix, expected));
    result.x.forEach((value, index) => close(value, expected[index]));
    expect(result.relativeResidual).toBeLessThan(1e-14);
    expect(result.conditionEstimate).toBeGreaterThanOrEqual(1);
  });

  it('estima como mal condicionado un sistema de Hilbert', () => {
    const size = 6;
    const matrix: Matrix = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, column) => 1 / (row + column + 1)),
    );
    const expected = Array(size).fill(1);
    const result = solveLinearSystem(matrix, multiplyMatrixVector(matrix, expected));
    result.x.forEach((value) => close(value, 1, 2e-8));
    expect(result.conditionEstimate).toBeGreaterThan(1e6);
    expect(result.relativeResidual).toBeLessThan(1e-13);
  });

  it('rechaza dependencias lineales exactas', () => {
    const matrix: Matrix = [
      [1, 2, 3],
      [2, 4, 6],
      [0, 1, 1],
    ];
    expect(() => solveLinearSystem(matrix, [1, 2, 0])).toThrow(/singular|mecanismo/i);
  });

  it('rechaza valores no finitos antes de factorizar', () => {
    expect(() => solveLinearSystem([[1, Number.NaN], [0, 1]], [1, 1])).toThrow(/no finitos/i);
  });

  it('resuelve un sistema aumentado grande por la vía dispersa sin perder exactitud', () => {
    const dofs = 90;
    const matrix = augmentedSystem(dofs, [{ terms: [[0, 1]] }, { terms: [[dofs - 1, 1]] }]);
    expect(__testables.buildHybridSolver(matrix)).not.toBeNull();
    const expected = Array.from({ length: matrix.length }, (_, index) => Math.sin(index) * 3 + 1);
    const result = solveForKnown(matrix, expected);
    result.x.forEach((value, index) => close(value, expected[index]));
    expect(result.relativeResidual).toBeLessThan(1e-13);
  });

  it('trata como restricción de un grado el apoyo deslizante alineado a los ejes', () => {
    // Math.cos(PI/2) is 6.1e-17, not an exact zero: a literal zero test would
    // push every model with a roller onto the dense path.
    const dofs = 90;
    const angle = Math.PI / 2;
    const matrix = augmentedSystem(dofs, [
      { terms: [[0, 1]] },
      { terms: [[10, Math.cos(angle)], [11, Math.sin(angle)]] },
    ]);
    const elimination = __testables.findSingleDofConstraints(matrix);
    expect(elimination).not.toBeNull();
    expect(elimination!.steps).toHaveLength(2);
    expect(elimination!.steps.map((step) => step.dofColumn)).toContain(11);
    expect(__testables.buildHybridSolver(matrix)).not.toBeNull();

    const expected = Array.from({ length: matrix.length }, (_, index) => Math.cos(index) * 2 - 1);
    const result = solveForKnown(matrix, expected);
    result.x.forEach((value, index) => close(value, expected[index]));
  });

  it('abandona la vía dispersa cuando el bloque reducido deja de ser definido positivo', () => {
    const dofs = 90;
    const matrix = augmentedSystem(dofs, [{ terms: [[0, 1]] }]);
    // Geometric stiffness near buckling produces exactly this: a stiffness
    // block that is still symmetric but no longer positive definite.
    matrix[40][40] = -5;
    expect(__testables.buildHybridSolver(matrix)).toBeNull();

    const expected = Array.from({ length: matrix.length }, (_, index) => (index % 7) - 3);
    const result = solveForKnown(matrix, expected);
    result.x.forEach((value, index) => close(value, expected[index]));
  });

  it('abandona la vía dispersa ante restricciones de varios grados', () => {
    const dofs = 90;
    // A rigid link couples three degrees of freedom at once and cannot be
    // reduced to a Dirichlet condition.
    const matrix = augmentedSystem(dofs, [
      { terms: [[0, 1]] },
      { terms: [[20, 1], [21, -1], [22, 0.5]] },
    ]);
    expect(__testables.buildHybridSolver(matrix)).toBeNull();

    const expected = Array.from({ length: matrix.length }, (_, index) => Math.sin(index * 0.5));
    const result = solveForKnown(matrix, expected);
    result.x.forEach((value, index) => close(value, expected[index]));
  });

  it('estima la condición del sistema completo, no la del bloque reducido', () => {
    const dofs = 70;
    const matrix = augmentedSystem(dofs, [{ terms: [[0, 1]] }, { terms: [[dofs - 1, 1]] }]);
    expect(__testables.buildHybridSolver(matrix)).not.toBeNull();
    const result = solveForKnown(matrix, Array(matrix.length).fill(1));
    const trueCondition = oneNorm(matrix) * oneNorm(invert(matrix));
    // Hager's iteration is a lower bound on kappa_1; it must stay below the
    // true value and remain close enough to be a usable diagnostic.
    expect(result.conditionEstimate).toBeLessThanOrEqual(trueCondition * 1.0001);
    expect(result.conditionEstimate).toBeGreaterThan(trueCondition / 10);
  });

  it('mantiene el mismo diagnóstico de singularidad en tamaños que activan la vía dispersa', () => {
    const dofs = 90;
    // Two constraints fighting over the same degree of freedom: the second
    // cannot be eliminated, so the reduced block keeps a zero pivot.
    const matrix = augmentedSystem(dofs, [{ terms: [[5, 1]] }, { terms: [[5, 1]] }]);
    expect(__testables.buildHybridSolver(matrix)).toBeNull();
    expect(() => solveLinearSystem(matrix, Array(matrix.length).fill(1))).toThrow(/singular|mecanismo/i);
  });

  it('reordena y almacena en CSR sin alterar la solución', () => {
    const dofs = 80;
    const matrix = augmentedSystem(dofs, [{ terms: [[0, 1]] }]);
    const elimination = __testables.findSingleDofConstraints(matrix)!;
    const order = __testables.reverseCuthillMcKee(matrix, elimination.keep);
    expect([...order].sort((a, b) => a - b)).toEqual(elimination.keep.map((_, index) => index));

    const csr = __testables.buildLowerCSR(matrix, elimination.keep, order);
    expect(csr.rowPointers).toHaveLength(csr.n + 1);
    expect(csr.values).toHaveLength(csr.rowPointers[csr.n]);
    // Only the lower triangle is stored.
    for (let row = 0; row < csr.n; row += 1) {
      for (let p = csr.rowPointers[row]; p < csr.rowPointers[row + 1]; p += 1) {
        expect(csr.colIndices[p]).toBeLessThanOrEqual(row);
      }
    }

    const symbolic = __testables.symbolicLDLT(csr);
    const factorization = __testables.numericLDLT(csr, symbolic)!;
    expect(factorization).not.toBeNull();
    expect(factorization.minPivot).toBeGreaterThan(0);

    const rhs = Array.from({ length: csr.n }, (_, index) => index % 5);
    const solved = __testables.solveLDLT(factorization, rhs);
    // Verify against the reduced system in its own permuted ordering.
    const residual = solved.map((_, row) => {
      let sum = 0;
      for (let column = 0; column < csr.n; column += 1) {
        sum += matrix[elimination.keep[order[row]]][elimination.keep[order[column]]] * solved[column];
      }
      return sum - rhs[row];
    });
    residual.forEach((value) => expect(Math.abs(value)).toBeLessThan(1e-10));
  });

  it('recupera un vector del espacio nulo y su nulidad', () => {
    const matrix: Matrix = [
      [1, -1, 0],
      [-1, 2, -1],
      [0, -1, 1],
    ];
    const result = findNullSpaceVector(matrix);
    expect(result.rank).toBe(2);
    expect(result.nullity).toBe(1);
    expect(result.vector).not.toBeNull();
    expect(result.residual).toBeLessThan(1e-12);
    const vector = result.vector!;
    close(vector[0] / vector[1], 1);
    close(vector[2] / vector[1], 1);
  });
});
