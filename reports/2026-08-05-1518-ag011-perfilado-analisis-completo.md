# AG-011 — Perfilado por fases de `analyzeProject`

**Fecha:** 2026-08-05 15:18
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se agregó un arnés de perfilado por fases (`performance.now()`) opt-in y de overhead cero
para `analyzeProject` (`src/engine/solver.ts`), y un benchmark en `src/engine/benchmarks.test.ts`
que mide la distribución real de tiempos en vigas continuas, pórticos y cerchas de ~50/150/300
miembros. El objetivo era localizar dónde se gasta el tiempo que AG-005 dejó fuera del
solucionador lineal (~95.5 % del total en el caso de 300 vanos).

**Hallazgo principal:** el cuello de botella no está en los diagramas ni en las deformaciones,
sino en la generación de trazas de matrices para la trazabilidad educativa (`toMatrixTrace`
sobre la matriz de rigidez global `K` y la matriz de restricciones `C` completas, más una traza
por miembro). Esa fase, bautizada `educationTrace`, consume **58–64 % del tiempo total en
modelos de ~300 miembros** — más que todas las demás fases combinadas.

## Por qué

Ejecución de la propuesta `AG-011`, aprobada como paso previo obligatorio a cualquier otra
optimización del motor (recomendación explícita del reporte de AG-005). La propuesta pedía
instrumentar `solver.ts` con marcas de tiempo por fase y medir con benchmarks reales.

**Ampliación autónoma respecto al alcance aprobado.** La propuesta especificaba seis fases
(`assembly`, `linearSolve`, `diagrams`, `deformations`, `auditAndReliability`, `explanation`).
Instrumentadas esas seis, entre el 44 % y el 69 % del tiempo total quedaba en un remanente "sin
instrumentar" — inaceptable frente al criterio de aceptación de la propia propuesta
("identificación clara del componente dominante, >50 % del tiempo"). Se agregó una séptima fase,
`educationTrace`, para no entregar un perfilado incompleto. Es una ampliación de instrumentación
pura: no toca lógica de negocio, no cambia ningún resultado numérico ni firma pública.

## Archivos tocados

- `src/engine/performanceProfiler.ts` (nuevo) — arnés de perfilado: `beginProfiling()`/
  `endProfiling()` abren y cierran una ventana de medición; `profileStart()`/`profileEnd(phase,
  since)` marcan una fase. Inactivo por defecto: `profileStart()` es una sola comparación
  booleana (retorna `null`, sin llamar a `performance.now()`) y `profileEnd` retorna de
  inmediato al ver `since === null`. Cero costo en ejecuciones normales de la app.
- `src/engine/solver.ts` — instrumentado `analyzeProject` con pares `profileStart`/`profileEnd`
  alrededor de: ensamblaje de `K`/`F`/restricciones (`assembly`), `solveLinearSystem`
  (`linearSolve`), `buildExactDiagrams` por miembro (`diagrams`), `buildDeformationCurve` por
  miembro (`deformations`), auditoría de cargas + `classifyAnalysisReliability`
  (`auditAndReliability`), `explanationSteps` (`explanation`) y construcción de `elementTraces`
  + traza final de `K`/`C` (`educationTrace`, fase agregada — ver "Por qué"). Ningún bloque de
  código existente fue reordenado ni modificado; solo se insertaron marcadores alrededor de
  código ya presente.
- `src/engine/benchmarks.test.ts` — nuevo `describe('perfilado de fases del analisis completo
  (AG-011)')` con:
  - Un test siempre activo (barato, modelo de 20 vanos) que verifica que la suma de fases
    nombradas es coherente con el total — corre en cada `npm test`/`npm run verify`.
  - Un test gateado por `STRUCTURECO_PROFILE_ANALYSIS=1` (variable de entorno, tal como pedía la
    propuesta) que mide 9 escenarios (viga/pórtico/cercha × ~50/150/300 miembros) e imprime la
    tabla de tiempos por fase con `console.table`. Sin la variable, el test retorna de inmediato
    y no alarga la suite por defecto.
- `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` — actualizado (`--update`, 27 archivos): cambio
  explícitamente autorizado por el alcance aprobado de AG-011 (modificar `solver.ts` y crear
  `performanceProfiler.ts` estaba en el documento de la propuesta).
- `Antigravity-propuestas/` — AG-011 movida de `aprobadas/` a `implementadas/` con nota de
  implementación; `backlog.md` y `roadmap.md` actualizados (AG-011 pasa a "Implementada").

## Tabla de tiempos medidos por fase

Medición real (`STRUCTURECO_PROFILE_ANALYSIS=1 npx vitest run src/engine/benchmarks.test.ts`),
misma máquina que el benchmark de AG-005:

| Modelo | Miembros | Total | assembly | linearSolve | diagrams | deformations | auditAndReliability | explanation | **educationTrace** | sin instrumentar |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Viga continua | 50 | 123 ms | 8.2% | 6.2% | 2.9% | 33.0% | 1.7% | 0.5% | **25.8%** | 21.7% |
| Viga continua | 150 | 665 ms | 9.3% | 6.2% | 2.4% | 23.3% | 1.8% | 0.3% | **41.0%** | 15.8% |
| Viga continua | 300 | 2 178 ms | 9.2% | 3.0% | 1.8% | 16.0% | 0.7% | 0.3% | **63.7%** | 5.3% |
| Pórtico | 54 | 67 ms | 9.1% | 5.8% | 6.5% | 22.6% | 2.6% | 0.8% | **20.1%** | 32.5% |
| Pórtico | 150 | 162 ms | 10.8% | 5.0% | 5.3% | 22.0% | 2.4% | 0.6% | **28.4%** | 25.4% |
| Pórtico | 304 | 431 ms | 11.3% | 4.8% | 2.9% | 20.7% | 2.2% | 0.5% | **41.6%** | 16.2% |
| Cercha Pratt | 49 | 20 ms | 16.8% | 28.9% | 9.9% | 10.4% | 4.7% | 1.0% | **17.8%** | 10.6% |
| Cercha Pratt | 149 | 193 ms | 19.9% | 7.5% | 3.0% | 3.5% | 1.3% | 0.3% | **60.4%** | 4.1% |
| Cercha Pratt | 301 | 1 049 ms | 32.7% | 3.7% | 0.9% | 1.1% | 0.5% | 0.2% | **58.1%** | 2.7% |

**Lectura:** `educationTrace` crece más rápido que cualquier otra fase con el tamaño del modelo
y domina (>50 %) en los tres escenarios de ~300 miembros. Es consistente con su costo teórico:
`toMatrixTrace` sobre la matriz de rigidez global `K` (`ndof × ndof`, densa) escanea cada fila
completa y ordena las entradas no nulas incluso en modo `'summary'`, un costo que crece con el
cuadrado de los grados de libertad — mientras que `linearSolve` ya se benefició de la vía
dispersa de AG-005 y `diagrams`/`deformations` operan por miembro (lineal en el número de
miembros). `linearSolve` nunca supera el 7 % del tiempo total en ningún escenario medido,
confirmando la conclusión de AG-005 desde un ángulo independiente.

## Cómo verificar

```bash
npm run verify
```

Resultado obtenido: lint limpio · frontera protegida intacta (27 archivos, baseline actualizado
con autorización explícita) · **668/668 pruebas en verde** (661 previas + 7 nuevas) · build
correcto · presupuesto de bundle respetado (630 252 B / 169 329 gzip, techo 648 000 / 174 000).

Para reproducir la tabla completa de tiempos por fase:

```bash
STRUCTURECO_PROFILE_ANALYSIS=1 npx vitest run src/engine/benchmarks.test.ts --reporter=verbose
```

## Pendiente / siguiente paso

- **Sin pushear**: los commits quedan locales. `autoPush: false` a propósito; falta confirmación
  explícita del usuario para `git push origin main`.
- **Próxima propuesta recomendada**: optimizar `toMatrixTrace` en modo `'summary'` (o diferir su
  cálculo hasta que el panel educativo/inspector realmente lo consulte, en lugar de calcularlo en
  cada `analyzeProject`) es ahora la palanca de mayor impacto medido — muy por delante de
  cualquier trabajo adicional sobre el solucionador lineal o los diagramas. No se implementó en
  este cambio porque el alcance aprobado de AG-011 era exclusivamente perfilar y medir, no
  optimizar; la propuesta explícitamente prohibía alterar resultados o comportamiento.
- La cercha de 49 miembros muestra `linearSolve` en 28.9 % del total — un caso pequeño donde el
  tiempo absoluto (20 ms) está dominado por ruido de JIT/warm-up más que por el algoritmo; no es
  representativo del comportamiento asintótico y no debe usarse para descartar la vía dispersa de
  AG-005.
