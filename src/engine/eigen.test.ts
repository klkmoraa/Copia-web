import { describe, expect, it } from 'vitest';
import {
  backSubstitute,
  choleskyFactor,
  constraintNullSpaceBasis,
  expandFromBasis,
  forwardSubstitute,
  generalizedSmallestEigenpairs,
  projectOntoBasis,
  symmetricEigenJacobi,
} from './eigen';
import { multiplyMatrixVector, zeros, type Matrix } from './math';

/** Tridiagonal (−1, 2, −1) de tamaño n: sus autovalores tienen forma cerrada. */
const tridiagonal = (n: number): Matrix => {
  const matrix = zeros(n, n);
  for (let i = 0; i < n; i += 1) {
    matrix[i][i] = 2;
    if (i > 0) matrix[i][i - 1] = -1;
    if (i < n - 1) matrix[i][i + 1] = -1;
  }
  return matrix;
};
const identity = (n: number): Matrix => {
  const matrix = zeros(n, n);
  for (let i = 0; i < n; i += 1) matrix[i][i] = 1;
  return matrix;
};
/** Autovalores exactos de la tridiagonal: 4·sin²(jπ / 2(n+1)). */
const tridiagonalEigenvalue = (j: number, n: number) => 4 * Math.sin((j * Math.PI) / (2 * (n + 1))) ** 2;

describe('factorización de Cholesky', () => {
  it('reproduce la matriz factorizada', () => {
    const A: Matrix = [[4, 2, 1], [2, 5, 3], [1, 3, 6]];
    const factor = choleskyFactor(A)!;
    expect(factor).not.toBeNull();
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        const product = factor.L[i].reduce((sum, value, k) => sum + value * factor.L[j][k], 0);
        expect(product).toBeCloseTo(A[i][j], 10);
      }
    }
  });

  it('resuelve hacia adelante y hacia atrás de forma consistente', () => {
    const A: Matrix = [[4, 2, 1], [2, 5, 3], [1, 3, 6]];
    const { L } = choleskyFactor(A)!;
    const b = [1, -2, 3];
    // A x = b  con  A = L Lᵀ  ⟹  x = L⁻ᵀ (L⁻¹ b)
    const x = backSubstitute(L, forwardSubstitute(L, b));
    multiplyMatrixVector(A, x).forEach((value, index) => expect(value).toBeCloseTo(b[index], 9));
  });

  it('devuelve null en vez de inventar una raíz cuando la matriz no es definida positiva', () => {
    expect(choleskyFactor([[1, 2], [2, 1]])).toBeNull();
    expect(choleskyFactor([[0, 0], [0, 0]])).toBeNull();
  });
});

describe('Jacobi simétrico', () => {
  it('da los autovalores exactos de la tridiagonal', () => {
    const n = 8;
    const { values, vectors } = symmetricEigenJacobi(tridiagonal(n));
    const expected = Array.from({ length: n }, (_, index) => tridiagonalEigenvalue(index + 1, n)).sort((a, b) => b - a);
    values.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 10));
    // Cada par (valor, vector) satisface A·v = λ·v.
    vectors.forEach((vector, index) => {
      multiplyMatrixVector(tridiagonal(n), vector).forEach((value, row) =>
        expect(value).toBeCloseTo(values[index] * vector[row], 9));
    });
  });

  it('devuelve vectores ortonormales', () => {
    const { vectors } = symmetricEigenJacobi(tridiagonal(6));
    vectors.forEach((a, i) => vectors.forEach((b, j) => {
      const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
      expect(dot).toBeCloseTo(i === j ? 1 : 0, 9);
    }));
  });
});

describe('base del espacio nulo de las restricciones', () => {
  it('elimina un grado de libertad fijado y deja pasar el resto', () => {
    const basis = constraintNullSpaceBasis([[1, 0, 0]], 3);
    expect(basis.rank).toBe(1);
    expect(basis.nullity).toBe(2);
    for (const vector of basis.vectors) expect(vector[0]).toBeCloseTo(0, 12);
  });

  it('representa un enlace rígido como igualdad entre dos grados de libertad', () => {
    const basis = constraintNullSpaceBasis([[1, -1, 0]], 3);
    expect(basis.nullity).toBe(2);
    for (const vector of basis.vectors) expect(vector[0]).toBeCloseTo(vector[1], 12);
  });

  it('ignora una restricción repetida en vez de contarla dos veces', () => {
    const basis = constraintNullSpaceBasis([[1, 0, 0], [2, 0, 0]], 3);
    expect(basis.rank).toBe(1);
    expect(basis.nullity).toBe(2);
  });

  it('sobrevive a coeficientes de magnitudes muy distintas, como el brazo de un enlace rígido', () => {
    const basis = constraintNullSpaceBasis([[1, -1, 3.75], [0, 0, 1]], 3);
    expect(basis.rank).toBe(2);
    expect(basis.nullity).toBe(1);
    const [vector] = basis.vectors;
    expect(vector[2]).toBeCloseTo(0, 12);
    expect(vector[0]).toBeCloseTo(vector[1], 12);
  });

  it('proyectar sobre la base equivale a tachar la fila y la columna del grado fijado', () => {
    const K = tridiagonal(4);
    const basis = constraintNullSpaceBasis([[1, 0, 0, 0]], 4);
    const reduced = projectOntoBasis(K, basis.vectors);
    expect(reduced.length).toBe(3);
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
      expect(reduced[i][j]).toBeCloseTo(K[i + 1][j + 1], 10);
    }
  });

  it('expandir un vector reducido lo devuelve al espacio completo', () => {
    const basis = constraintNullSpaceBasis([[1, 0, 0]], 3);
    const full = expandFromBasis([2, -5], basis.vectors);
    expect(full).toHaveLength(3);
    expect(full[0]).toBeCloseTo(0, 12);
  });
});

describe('autovalores generalizados', () => {
  it('con B = I recupera los autovalores más pequeños de K, con forma cerrada', () => {
    const n = 20;
    const result = generalizedSmallestEigenpairs(tridiagonal(n), identity(n), 4);
    expect(result.converged).toBe(true);
    const expected = [1, 2, 3, 4].map((j) => tridiagonalEigenvalue(j, n));
    result.values.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 8));
    expect(result.residual).toBeLessThan(1e-8);
  });

  it('resuelve el caso 2×2 cuyos autovalores se pueden escribir a mano', () => {
    // K = [[2,-1],[-1,2]], B = I  ⟹  λ ∈ {1, 3}
    const result = generalizedSmallestEigenpairs([[2, -1], [-1, 2]], identity(2), 2);
    expect(result.values[0]).toBeCloseTo(1, 12);
    expect(result.values[1]).toBeCloseTo(3, 12);
  });

  it('devuelve modos B-ortogonales', () => {
    const n = 12;
    const B = identity(n);
    for (let i = 0; i < n; i += 1) B[i][i] = 1 + (i % 3);
    const result = generalizedSmallestEigenpairs(tridiagonal(n), B, 3);
    const { vectors } = result;
    vectors.forEach((a, i) => vectors.forEach((b, j) => {
      if (i >= j) return;
      const product = a.reduce((sum, value, row) => sum + value * multiplyMatrixVector(B, b)[row], 0);
      const scale = Math.hypot(...a) * Math.hypot(...b);
      expect(Math.abs(product) / scale).toBeLessThan(1e-7);
    }));
  });

  it('admite un lado derecho indefinido, que es el caso normal del pandeo', () => {
    // K = I, B = diag(1, −1)  ⟹  λ ∈ {1, −1}. Un pórtico con una barra
    // traccionada y otra comprimida produce exactamente esta situación.
    const B: Matrix = [[1, 0], [0, -1]];
    const both = generalizedSmallestEigenpairs(identity(2), B, 2);
    expect(both.values.map((value) => Math.round(value)).sort((a, b) => a - b)).toEqual([-1, 1]);

    const positive = generalizedSmallestEigenpairs(identity(2), B, 2, { positiveOnly: true });
    expect(positive.values).toHaveLength(1);
    expect(positive.values[0]).toBeCloseTo(1, 10);
  });

  it('declara el mecanismo en vez de devolver autovalores de una estructura inestable', () => {
    const result = generalizedSmallestEigenpairs([[1, 1], [1, 1]], identity(2), 1);
    expect(result.failure).toBe('mechanism');
    expect(result.values).toEqual([]);
    expect(result.reason).toContain('mecanismo');
  });

  it('declara un lado derecho nulo en vez de dividir por cero', () => {
    const result = generalizedSmallestEigenpairs(identity(3), zeros(3, 3), 1);
    expect(result.failure).toBe('empty-right-hand-side');
  });

  it('es determinista: la misma entrada da el mismo modo, no su opuesto', () => {
    const first = generalizedSmallestEigenpairs(tridiagonal(10), identity(10), 2);
    const second = generalizedSmallestEigenpairs(tridiagonal(10), identity(10), 2);
    expect(second.values).toEqual(first.values);
    expect(second.vectors).toEqual(first.vectors);
  });
});
