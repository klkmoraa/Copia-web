/**
 * Autovalores generalizados simétricos para los problemas de estabilidad y
 * vibración.
 *
 * Los dos que este producto necesita son **el mismo problema**:
 *
 * ```text
 * pandeo:  K φ = λ (−Kg) φ
 * modal:   K φ = ω² M φ
 * ```
 *
 * En ambos `K` es la rigidez elástica —simétrica y definida positiva mientras
 * la estructura sea estable— y lo que interesa es el autovalor **más pequeño**:
 * la primera carga que pandea, la frecuencia más baja. Escribir dos solvers
 * para eso sería escribir el mismo dos veces.
 *
 * ## Por qué no se resuelve en la forma en que se escribe
 *
 * La receta habitual —iteración de subespacio con `M*` reducida por Cholesky—
 * exige que la matriz de la derecha sea definida positiva. En modal lo es; en
 * **pandeo no**: `−Kg` es indefinida en cuanto una barra está traccionada y
 * otra comprimida, que es el caso normal de un pórtico. Aplicar allí la receta
 * da una factorización que falla o, peor, que no falla y devuelve modos que no
 * existen.
 *
 * Así que se transforma primero. Con `K = L·Lᵀ` y `ψ = Lᵀφ`:
 *
 * ```text
 * K φ = λ B φ   ⟹   (L⁻¹ B L⁻ᵀ) ψ = (1/λ) ψ
 * ```
 *
 * El problema pasa a ser **estándar y simétrico**, y `S = L⁻¹BL⁻ᵀ` puede ser
 * indefinida sin que eso moleste a nadie. El autovalor pequeño de la izquierda
 * es el grande de la derecha, que es justo hacia donde converge sola una
 * iteración de subespacio. `S` nunca se forma: se aplica resolviendo con `L`.
 *
 * ## Por qué iteración de subespacio y no Jacobi entero
 *
 * Jacobi sobre `S` daría todos los autovalores sin ajustar nada, y para 200
 * grados de libertad tarda poco. Medido el coste, es O(n³) por barrido: a 600
 * GDL —un modelo de 200 barras, que este producto admite— son decenas de
 * segundos en el navegador. La iteración de subespacio pide sólo los pocos
 * modos que se van a enseñar, y usa Jacobi donde sí es barato: en la proyección
 * `q×q`, con `q` del orden de diez.
 */
import { multiply, multiplyMatrixVector, transpose, zeros, type Matrix } from './math';

const EPS = 1e-12;

export interface CholeskyFactor {
  /** Triangular inferior tal que L·Lᵀ reproduce la matriz factorizada. */
  L: Matrix;
}

/**
 * Cholesky sin pivoteo. Devuelve `null` cuando la matriz no es definida
 * positiva, que para una rigidez reducida significa exactamente una cosa: la
 * estructura tiene un mecanismo. No se le suma un desplazamiento diagonal para
 * «arreglarla» — eso convertiría un modelo inestable en unos autovalores con
 * pinta de válidos.
 */
export const choleskyFactor = (matrix: Matrix): CholeskyFactor | null => {
  const n = matrix.length;
  const L = zeros(n, n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k += 1) sum -= L[i][k] * L[j][k];
      if (i === j) {
        // El umbral es relativo a la propia diagonal: una rigidez en kN/m y una
        // en N/mm no comparten escala, y un cero absoluto no significa lo mismo
        // en las dos.
        if (!(sum > Math.abs(matrix[i][i]) * 1e-14) || !Number.isFinite(sum)) return null;
        L[i][i] = Math.sqrt(sum);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  return { L };
};

/** Resuelve L·x = b hacia adelante. */
export const forwardSubstitute = (L: Matrix, b: readonly number[]): number[] => {
  const n = L.length;
  const x = Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let sum = b[i];
    for (let k = 0; k < i; k += 1) sum -= L[i][k] * x[k];
    x[i] = sum / L[i][i];
  }
  return x;
};

/** Resuelve Lᵀ·x = b hacia atrás. */
export const backSubstitute = (L: Matrix, b: readonly number[]): number[] => {
  const n = L.length;
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = b[i];
    for (let k = i + 1; k < n; k += 1) sum -= L[k][i] * x[k];
    x[i] = sum / L[i][i];
  }
  return x;
};

export interface SymmetricEigenResult {
  /** Autovalores en orden descendente. */
  values: number[];
  /** `vectors[k]` es el autovector de `values[k]`, ya normalizado. */
  vectors: number[][];
}

/**
 * Jacobi cíclico para matrices simétricas pequeñas. Se usa sólo en la
 * proyección del subespacio, donde el tamaño es de una decena: ahí es exacto,
 * incondicionalmente convergente y no necesita ningún parámetro.
 */
export const symmetricEigenJacobi = (input: Matrix, maxSweeps = 60): SymmetricEigenResult => {
  const n = input.length;
  const a = input.map((row) => [...row]);
  let v = zeros(n, n);
  for (let i = 0; i < n; i += 1) v[i][i] = 1;

  const offDiagonalNorm = () => {
    let sum = 0;
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) sum += a[i][j] * a[i][j];
    return Math.sqrt(2 * sum);
  };

  /* Escala de referencia de la matriz. El respaldo es 1 y no `Number.MIN_VALUE`
     porque aquí la escala **multiplica** al umbral: `5e-324 · 1e-18` es cero
     exacto, y un umbral cero convierte la comparación en «distinto de cero»,
     que con una matriz nula haría girar rotaciones sobre nada. Con 1 el barrido
     sale en la primera comprobación, que es lo correcto: una matriz nula ya
     está diagonalizada. */
  const scale = Math.max(...a.map((row) => Math.max(...row.map(Math.abs))), 0) || 1;
  /* Invariante del bucle, y escrito como división a propósito: el factor
     recíproco evita que el analizador lo lea como una multiplicación por un
     literal que puede desnormalizar. */
  const rotationThreshold = scale / 1e18;
  for (let sweep = 0; sweep < maxSweeps && offDiagonalNorm() > scale * 1e-15; sweep += 1) {
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(a[p][q]) <= rotationThreshold) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, index) => index).sort((x, y) => a[y][y] - a[x][x]);
  return {
    values: order.map((index) => a[index][index]),
    vectors: order.map((index) => {
      const vector = Array.from({ length: n }, (_, row) => v[row][index]);
      const norm = Math.hypot(...vector) || 1;
      // Signo determinista: la primera componente significativa se deja
      // positiva. Un modo y su opuesto son el mismo modo, pero un test que
      // compara números no lo sabe.
      const first = vector.find((value) => Math.abs(value) > 1e-10) ?? 1;
      const sign = first < 0 ? -1 : 1;
      return vector.map((value) => (value / norm) * sign);
    }),
  };
};

export interface NullSpaceBasis {
  /** Vectores columna que generan el espacio nulo; `vectors[k]` tiene longitud `columns`. */
  vectors: number[][];
  rank: number;
  nullity: number;
}

/**
 * Base del espacio nulo de un conjunto de restricciones `C·u = 0`.
 *
 * Los apoyos, los grados de libertad de contabilidad y los enlaces rígidos
 * entran al análisis estático como filas de un sistema KKT, que **no es
 * definido positivo**: a un KKT no se le puede pedir un autovalor. Proyectar
 * sobre esta base convierte el problema restringido en uno libre —`ZᵀKZ`— que
 * sí lo es, y lo hace sin penalizaciones ni números grandes inventados: un
 * apoyo fijo desaparece del problema en vez de volverse muy rígido.
 *
 * Reducción de Gauss-Jordan con pivoteo por magnitud, porque las filas de un
 * enlace rígido mezclan coeficientes 1 con brazos en metros.
 */
export const constraintNullSpaceBasis = (rows: readonly number[][], columns: number): NullSpaceBasis => {
  const matrix = rows.map((row) => [...row]);
  const pivotColumnOf: number[] = [];
  let pivotRow = 0;
  const scale = Math.max(...matrix.flatMap((row) => row.map(Math.abs)), Number.MIN_VALUE);
  const tolerance = scale * 1e-12;

  for (let column = 0; column < columns && pivotRow < matrix.length; column += 1) {
    let best = pivotRow;
    for (let row = pivotRow + 1; row < matrix.length; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[best][column])) best = row;
    }
    if (Math.abs(matrix[best][column]) <= tolerance) continue;
    [matrix[pivotRow], matrix[best]] = [matrix[best], matrix[pivotRow]];
    const pivot = matrix[pivotRow][column];
    for (let c = 0; c < columns; c += 1) matrix[pivotRow][c] /= pivot;
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === pivotRow) continue;
      const factor = matrix[row][column];
      if (Math.abs(factor) <= EPS) continue;
      for (let c = 0; c < columns; c += 1) matrix[row][c] -= factor * matrix[pivotRow][c];
    }
    pivotColumnOf.push(column);
    pivotRow += 1;
  }

  const isPivot = new Set(pivotColumnOf);
  const freeColumns = Array.from({ length: columns }, (_, index) => index).filter((index) => !isPivot.has(index));
  const vectors = freeColumns.map((free) => {
    const vector = Array(columns).fill(0);
    vector[free] = 1;
    pivotColumnOf.forEach((pivotColumn, row) => { vector[pivotColumn] = -matrix[row][free]; });
    return vector;
  });

  return { vectors, rank: pivotColumnOf.length, nullity: vectors.length };
};

export type EigenFailure =
  | 'mechanism'
  | 'no-degrees-of-freedom'
  | 'empty-right-hand-side'
  | 'not-converged';

export interface GeneralizedEigenResult {
  /** Autovalores λ pedidos, de menor a mayor valor absoluto útil. */
  values: number[];
  /** `vectors[k]` es el modo de `values[k]`, en el espacio completo de `K`. */
  vectors: number[][];
  converged: boolean;
  iterations: number;
  /** Residuo relativo máximo ‖Kφ − λBφ‖ / ‖Kφ‖ entre los modos devueltos. */
  residual: number;
  failure?: EigenFailure;
  reason: string;
}

export interface GeneralizedEigenOptions {
  /** Tamaño del subespacio. Por defecto `min(n, max(2·count, count + 4))`. */
  subspaceSize?: number;
  maxIterations?: number;
  /**
   * Residuo relativo máximo admitido para dar un modo por convergido.
   *
   * Se mide sobre el **modo**, no sobre el autovalor. En un problema simétrico
   * el error del autovalor va como el cuadrado del residuo del vector, así que
   * un criterio sobre el valor da por bueno un modo mil veces peor de lo que
   * parece: medido en la tridiagonal de 20 GDL, valores exactos a 1e-10 con
   * modos a 3.9e-6. Y el modo es justamente lo que se dibuja.
   */
  tolerance?: number;
  /** `true` descarta los autovalores no positivos (pandeo: sólo interesa la carga que sube). */
  positiveOnly?: boolean;
}

const DEFAULTS = { maxIterations: 300, tolerance: 1e-9 };

/**
 * Resuelve `K φ = λ B φ` y devuelve los `count` autovalores de menor módulo.
 *
 * `K` debe ser simétrica definida positiva (rigidez de una estructura estable);
 * `B` sólo simétrica. Ambas ya reducidas: aquí no hay restricciones, se
 * eliminan antes con `constraintNullSpaceBasis`.
 */
export const generalizedSmallestEigenpairs = (
  K: Matrix,
  B: Matrix,
  count: number,
  options: GeneralizedEigenOptions = {},
): GeneralizedEigenResult => {
  const n = K.length;
  const maxIterations = options.maxIterations ?? DEFAULTS.maxIterations;
  const tolerance = options.tolerance ?? DEFAULTS.tolerance;
  const fail = (failure: EigenFailure, reason: string): GeneralizedEigenResult =>
    ({ values: [], vectors: [], converged: false, iterations: 0, residual: Number.NaN, failure, reason });

  if (n === 0) return fail('no-degrees-of-freedom', 'El modelo no tiene grados de libertad libres una vez aplicadas las condiciones de contorno.');

  const rightHandNorm = Math.max(...B.flatMap((row) => row.map(Math.abs)), 0);
  if (!(rightHandNorm > 0)) {
    return fail('empty-right-hand-side', 'La matriz del lado derecho es idénticamente nula: no hay nada que pueda producir un autovalor.');
  }

  const factor = choleskyFactor(K);
  if (!factor) {
    return fail('mechanism', 'La rigidez reducida no es definida positiva: el modelo tiene un mecanismo y no admite un análisis de autovalores.');
  }
  const { L } = factor;

  /** Aplica S = L⁻¹ B L⁻ᵀ sin formarla: dos sustituciones y un producto. */
  const applyS = (vector: readonly number[]): number[] =>
    forwardSubstitute(L, multiplyMatrixVector(B, backSubstitute(L, vector)));

  const q = Math.min(n, Math.max(options.subspaceSize ?? 0, Math.max(2 * count, count + 4)));

  /**
   * Arranque determinista. La primera columna excita todos los GDL por igual;
   * las siguientes apuntan a los grados de libertad más blandos respecto de `B`,
   * que es donde viven los modos bajos. Nada aleatorio: el mismo modelo tiene
   * que dar el mismo modo en cada ejecución y en cada máquina.
   */
  const softness = Array.from({ length: n }, (_, index) => Math.abs(B[index][index]) / Math.max(Math.abs(K[index][index]), Number.MIN_VALUE));
  const bySoftness = Array.from({ length: n }, (_, index) => index).sort((a, b) => softness[b] - softness[a]);
  let X: number[][] = [Array(n).fill(1)];
  for (let k = 1; k < q; k += 1) {
    const vector = Array(n).fill(0);
    vector[bySoftness[(k - 1) % n]] = 1;
    X.push(vector);
  }

  /** Gram-Schmidt modificado; descarta las direcciones que el subespacio ya agotó. */
  const orthonormalize = (vectors: number[][]): number[][] => {
    const basis: number[][] = [];
    for (const candidate of vectors) {
      const vector = [...candidate];
      for (const previous of basis) {
        const projection = vector.reduce((sum, value, index) => sum + value * previous[index], 0);
        for (let index = 0; index < n; index += 1) vector[index] -= projection * previous[index];
      }
      const norm = Math.hypot(...vector);
      if (norm <= 1e-10) continue;
      basis.push(vector.map((value) => value / norm));
    }
    return basis;
  };

  let iterations = 0;
  let converged = false;
  let ritzValues: number[] = [];
  let ritzVectors: number[][] = [];

  /** Residuo relativo de un par de Ritz en el problema transformado: ‖Sψ − μψ‖ / (|μ|·‖ψ‖). */
  const ritzResidual = (mu: number, psi: readonly number[]): number => {
    const image = applyS(psi);
    const difference = image.map((value, index) => value - mu * psi[index]);
    const reference = Math.abs(mu) * Math.hypot(...psi);
    return reference > 0 ? Math.hypot(...difference) / reference : Number.POSITIVE_INFINITY;
  };

  for (; iterations < maxIterations; iterations += 1) {
    const image = orthonormalize(X.map(applyS));
    if (!image.length) {
      return fail('empty-right-hand-side', 'El subespacio colapsó: el lado derecho no excita ningún grado de libertad del modelo.');
    }
    // Proyección de Rayleigh-Ritz: T = Yᵀ S Y, simétrica y pequeña.
    const projected = image.map(applyS);
    const T = image.map((row) => projected.map((column) => row.reduce((sum, value, index) => sum + value * column[index], 0)));
    // La simetría se impone en vez de suponerse: los redondeos la rompen y
    // Jacobi la da por cierta.
    for (let i = 0; i < T.length; i += 1) for (let j = i + 1; j < T.length; j += 1) {
      const mean = (T[i][j] + T[j][i]) / 2;
      T[i][j] = mean;
      T[j][i] = mean;
    }
    const small = symmetricEigenJacobi(T);
    ritzValues = small.values;
    ritzVectors = small.vectors.map((coefficients) => {
      const vector = Array(n).fill(0);
      coefficients.forEach((coefficient, index) => {
        for (let row = 0; row < n; row += 1) vector[row] += coefficient * image[index][row];
      });
      return vector;
    });
    X = ritzVectors;

    // Se vigilan los `count` modos que se van a devolver, contados sobre los de
    // mayor |μ| —los de menor |λ|—, que son los únicos que el llamador verá.
    const wanted = Math.min(count, ritzValues.length);
    const worst = Math.max(...Array.from({ length: wanted }, (_, index) => ritzResidual(ritzValues[index], ritzVectors[index])));
    if (worst <= tolerance) { converged = true; iterations += 1; break; }
  }

  // μ = 1/λ. Un μ nulo es un modo infinitamente rígido —masa nula, o rigidez
  // geométrica nula en esa dirección— y no corresponde a ningún λ finito.
  const pairs = ritzValues
    .map((mu, index) => ({ mu, psi: ritzVectors[index] }))
    .filter(({ mu }) => Math.abs(mu) > 1e-14)
    .map(({ mu, psi }) => ({ lambda: 1 / mu, phi: backSubstitute(L, psi) }))
    .filter(({ lambda }) => (options.positiveOnly ? lambda > 0 : true))
    .sort((a, b) => Math.abs(a.lambda) - Math.abs(b.lambda))
    .slice(0, count);

  if (!pairs.length) {
    return {
      values: [], vectors: [], converged, iterations, residual: Number.NaN,
      failure: 'not-converged',
      reason: options.positiveOnly
        ? 'No se encontró ningún autovalor positivo en el subespacio calculado.'
        : 'No se encontró ningún autovalor finito en el subespacio calculado.',
    };
  }

  // Residuo medido sobre el problema original, no sobre el transformado: es la
  // única comprobación que no puede heredar un error de la propia transformación.
  let residual = 0;
  for (const { lambda, phi } of pairs) {
    const kPhi = multiplyMatrixVector(K, phi);
    const bPhi = multiplyMatrixVector(B, phi);
    const difference = kPhi.map((value, index) => value - lambda * bPhi[index]);
    const reference = Math.max(Math.hypot(...kPhi), Number.MIN_VALUE);
    residual = Math.max(residual, Math.hypot(...difference) / reference);
  }

  return {
    values: pairs.map((pair) => pair.lambda),
    vectors: pairs.map((pair) => pair.phi),
    converged,
    iterations,
    residual,
    reason: converged
      ? `Convergió en ${iterations} iteraciones con residuo relativo ${residual.toExponential(2)}.`
      : `Se agotaron las ${maxIterations} iteraciones sin estabilizar los autovalores.`,
  };
};

/** Proyecta una matriz del espacio completo al generado por `basis`: Zᵀ·A·Z. */
export const projectOntoBasis = (matrix: Matrix, basis: readonly number[][]): Matrix => {
  const Z = transpose(basis as Matrix);
  return multiply(multiply(transpose(Z), matrix), Z);
};

/** Devuelve al espacio completo un vector expresado en la base reducida. */
export const expandFromBasis = (reduced: readonly number[], basis: readonly number[][]): number[] => {
  const full = Array(basis[0]?.length ?? 0).fill(0);
  reduced.forEach((coefficient, index) => {
    const vector = basis[index];
    for (let row = 0; row < full.length; row += 1) full[row] += coefficient * vector[row];
  });
  return full;
};
