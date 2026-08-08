# AG-005

# Introducción de Solucionador Disperso (Sparse Matrix Solver) para el Motor Matricial

# Implementada

# 2026-08-05

# Solver / Rendimiento

---

> ## Nota de implementación (2026-08-05, Claude Code)
>
> Implementada **con una corrección técnica sustancial** respecto a lo redactado abajo, y
> acotada a la **Fase A**. Reporte completo:
> `reports/2026-08-05-1050-ag005-solver-disperso-hibrido.md`.
>
> **La premisa de esta propuesta era incorrecta.** El documento asume que
> `solveLinearSystem` recibe una matriz de rigidez `K` simétrica definida positiva, donde un
> `LDLᵀ` sin pivoteo sería válido. En el código real recibe el sistema aumentado de
> multiplicadores de Lagrange `[[K, Cᵀ], [C, 0]]` —**simétrico indefinido**—, porque todas
> las condiciones de borde entran como filas de restricción. La propia
> `docs/MATHEMATICAL_SPEC.md` ya advertía que Cholesky no es válido ahí. Implementar lo
> propuesto al pie de la letra habría dado resultados incorrectos o nunca se habría activado.
>
> **Lo implementado**: eliminación previa de las restricciones de un solo grado de libertad
> para obtener un bloque reducido genuinamente definido positivo, y solo entonces CSR + LDLᵀ
> disperso con reordenamiento RCM, con retorno automático a la factorización densa actual ante
> cualquier pivote no positivo.
>
> **Rendimiento real medido** (viga continua de 300 vanos, 980 incógnitas): factorización
> 180 ms → 36 ms (5x), resolución completa 303 ms → 143 ms (2,1x). El **análisis completo
> apenas cambia** (~3,06 s → ~2,90 s) porque el sistema lineal era el 10 % del tiempo. El
> "5x–20x" que enuncia esta propuesta **no es alcanzable**: el cuello de botella no está en el
> álgebra lineal.
>
> **Correcciones a los datos del documento**: la suite tenía 642 pruebas, no 530 (ahora 649);
> y `npm run perf` no mide el solver —esa sección del script es un stub que falla al importar
> TypeScript desde Node—, por lo que la medición se hizo con `src/engine/performance.test.ts`.
>
> **Fuera de alcance (Fase B)**: los modelos con vínculos rígidos o apoyos deslizantes
> inclinados siguen usando la ruta densa; cubrirlos requiere un complemento de Schur.

# Resumen ejecutivo

Propone implementar una estructura de almacenamiento de matrices dispersas (Compressed Sparse Row - CSR / Compressed Sparse Column - CSC) y un algoritmo de resolución de ecuaciones simétricas dispersas (LDLT / Cholesky disperso) dentro del módulo de álgebra lineal `src/engine/math.ts`. Esta optimización reducirá el costo computacional del solucionador estructural de $\mathcal{O}(N^3)$ a $\mathcal{O}(N)$ o $\mathcal{O}(N \cdot b^2)$ (donde $b$ es el ancho de banda), permitiendo calcular estructuras complejas de cientos de miembros y análisis $P-\Delta$ en una fracción de milisegundo, conservando la identidad numérica exacta y la firma protegida del baseline.

# Problema

Actualmente, `src/engine/math.ts` y `src/engine/solver.ts` utilizan arreglos bidimensionales densos (`type Matrix = number[][]`) para representar la matriz global de rigidez $K$. En estructuras de ingeniería plana 2D, la inmensa mayoría de los nodos solo están conectados con sus vecinos inmediatos, por lo que la matriz $K$ es altamente **dispersa** (más del $80\text{-}95\%$ de las entradas son ceros).
El solucionador actual (`solveLinearSystem` en `math.ts`):
1. Almacena y procesa ceros inútilmente, multiplicando el uso de memoria RAM.
2. Realiza la eliminación gaussiana o descomposición LU completa $\mathcal{O}(N^3)$, desperdiciando ciclos de CPU.
3. Ralentiza los análisis iterativos no lineales $P-\Delta$ (que ejecutan decenas de resoluciones del sistema $K(N_i) \cdot U = P$) y el barrido de líneas de influencia.

# Evidencia

- `src/engine/math.ts`: Definición de `type Matrix = number[][]`, funciones `solveLinearSystem`, `multiply`, `findNullSpaceVector` basadas en iteraciones densas (líneas 1-300).
- `src/engine/solver.ts`: Invocación del solver lineal para la matriz global ensamblada.
- `docs/LIMITATIONS.md`: Documenta que el motor actual utiliza matrices densas como una limitación de escala conocida.

# Objetivo

1. Desarrollar o integrar un solucionador de matriz dispersa simétrica (Sparse Cholesky / LDLT) en `src/engine/math.ts`.
2. Reducir la complejidad temporal de resolución de $\mathcal{O}(N^3)$ a $\mathcal{O}(N)$ para la fase de eliminación.
3. Mantener 100% la paridad numérica ($|a - b| \le 10^{-12}$) con los resultados actuales, superando la suite completa de tests y la verificación del baseline protegido (`npm run verify:protected`).

# Beneficio esperado

- **Rendimiento**: Velocidad de cálculo entre 5x y 20x más rápida en estructuras de mediano y gran tamaño.
- **Memoria**: Reducción drástica de la huella de memoria en el hilo principal y Web Workers.
- **Escalabilidad**: Habilita el soporte futuro para mallas o reticulados planos complejos sin congelar la interfaz.

# Solución propuesta

1. **Estructura SparseMatrix (CSR)**:
   - Crear el tipo `SparseMatrixCSR` en `src/engine/math.ts` con arreglos planos `values`, `colIndices`, `rowPointers`.
2. **Algoritmo Sparse Cholesky / LDLT**:
   - Implementar la descomposición $K = L \cdot D \cdot L^T$ aprovechando la simetría y dispersión de la matriz de rigidez.
   - Incluir reordenamiento de nodos ligero (Reverse Cuthill-McKee - RCM) opcional para minimizar el rellenado (*fill-in*).
3. **Adaptador Transparente**:
   - `solveLinearSystem` detectará el tamaño y dispersión de la matriz: si $N > 12$, empleará automáticamente la vía dispersa; para matrices pequeñas ($N \le 12$), conservará la vía directa.

# Alternativas consideradas

- **Librería externa (e.g. `mathjs` o `eigen-js` WebAssembly)**: Aumentaría el tamaño del bundle en varios megabytes y requeriría binarios Wasm. Una implementación pura y liviana en TypeScript de Sparse LDLT ($\sim 200$ líneas en `math.ts`) es autónoma, rápida y no agrega dependencias externas.

# Justificación técnica

Las matrices de rigidez estructural son por definición simétricas y definidas positivas (o semi-definidas). La descomposición $L \cdot D \cdot L^T$ sin pivoteo numérico es numéricamente estable y la opción óptima en la literatura de elementos finitos.

# Impacto en la experiencia del usuario

Cálculo y respuesta instantánea al ejecutar análisis $P-\Delta$, combinaciones de carga masivas o explorar líneas de influencia.

# Impacto visual

Ninguno.

# Impacto en la arquitectura

Impacta el módulo interno `src/engine/math.ts` y la actualización autorizada del baseline de protección (`npm run verify:protected -- --update`).

# Complejidad

**Alta**. Requiere rigor matemático extremo, tratamiento de presiciones flotantes y verificación de paridad numérica exacta.

# Prioridad

**Media**. Es una mejora de escalabilidad importante pero no urgente para modelos pequeños.

# Riesgos

- Alteración imperceptible de precisión flotante ($< 10^{-14}$) que pudiera hacer fallar tests con tolerancias ultra-estrictas.
- Modificación de la Frontera Matemática Protegida: requiere ejecución explícita de `node scripts/check-protected-baseline.mjs --update` autorizada por el usuario.

# Dependencias

Ninguna nueva dependencia.

# Librerías o tecnologías recomendadas

Implementación nativa en TypeScript dentro de `src/engine/math.ts`.

# Archivos y módulos probablemente afectados

- **Modificación probable**:
  - `src/engine/math.ts`
  - `docs/releases/0.8.1/PROTECTED_BASELINE.sha256`
- **Solo revisión**:
  - `src/engine/math.test.ts`
  - `src/engine/solver.ts`
  - `src/engine/solver.test.ts`
  - `src/engine/pDelta.ts`

# Plan de implementación

## Fase 1: Desarrollo del Sparse Solver en math.ts
- Crear el tipo `SparseMatrixCSR` y la función `solveSparseLinearSystem`.
- Escribir pruebas unitarias dedicadas en `math.test.ts`.

## Fase 2: Integración y Verificación de Paridad
- Integrar la selección de solver en `solver.ts`.
- Ejecutar la suite de paridad contra Hibbeler (`hibbelerFrames.test.ts`) y FTOOL (`ftoolComparison.test.ts`).

## Fase 3: Actualización del Baseline Protegido
- Una vez verificada la paridad absoluta de todos los 530 tests, actualizar el baseline SHA-256 mediante `npm run verify:protected -- --update`.

# Estrategia de implementación

Desarrollar la función de forma aislada en `math.ts` y compararla término a término contra la solución densa en los tests antes de reemplazar la ruta predeterminada.

# Criterios de aceptación

- `npm run verify` completo en verde.
- Todos los 530 tests existentes pasan sin modificar ninguna tolerancia.
- Reducción probada de tiempo de ejecución en `npm run perf`.

# Pruebas necesarias

- `src/engine/math.test.ts`
- `src/engine/solver.test.ts`
- `src/engine/pDeltaBenchmarks.test.ts`
- `scripts/measure-performance.mjs` (`npm run perf`)

# Restricciones

- **CRÍTICO**: No alterar los formatos de salida de `AnalysisResult`, `NodeResult` o `MemberResult`.
- Requiere confirmación y autorización del usuario antes de actualizar el baseline de la frontera protegida.

# Estrategia de reversión

Desactivar el flag de solver disperso en `math.ts` para retornar a la eliminación densa tradicional.

# Definición de terminado

Solver disperso integrado, verificado con 100% de paridad matemática y baseline protegido actualizado.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-005-migracion-solver-matriz-dispersa.md`

Valida la propuesta contra el código real antes de modificar archivos.

Implementa únicamente el alcance aprobado: agrega la estructura Sparse CSR y el solver LDLT disperso en `src/engine/math.ts`, garantizando 100% de paridad matemática con los tests existentes.

ATENCIÓN: Esta propuesta modifica la Frontera Matemática Protegida. Al finalizar y confirmar que los 530 tests están en verde, actualiza el baseline con `node scripts/check-protected-baseline.mjs --update`.

Conserva los comportamientos y restricciones indicados en el documento.

Ejecuta lint, tests, baseline y build (`npm run verify`).

Al terminar:
- resume los cambios
- lista los archivos modificados
- indica las pruebas ejecutadas
- documenta la paridad numérica verificada
- actualiza el estado de la propuesta a Implementada
- mueve el documento a `Antigravity-propuestas/implementadas/AG-005-migracion-solver-matriz-dispersa.md`
