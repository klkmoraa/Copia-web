# AG-011

# Perfilado y Medición del Análisis Completo para Localizar el Cuello de Botella del Motor

# Implementada

# 2026-08-05

# Rendimiento / Engine

---

> ## Nota de implementación (2026-08-05)
>
> Propuesta implementada con éxito, con una ampliación autónoma respecto al alcance original.
>
> 1. **`src/engine/performanceProfiler.ts` (nuevo)**: arnés de perfilado con `beginProfiling()`/`endProfiling()` y marcadores `profileStart()`/`profileEnd(phase, since)`. Inactivo por defecto: `profileStart()` devuelve `null` en una sola comparación booleana y `profileEnd` retorna de inmediato — cero llamadas a `performance.now()` en ejecuciones normales, tal como pedía la propuesta.
> 2. **`src/engine/solver.ts`**: instrumentados los marcadores de `analyzeProject` alrededor de `assembly`, `linearSolve`, `diagrams` (por miembro), `deformations` (por miembro), `auditAndReliability` (auditoría de cargas + `classifyAnalysisReliability`) y `explanation`. Ningún resultado numérico ni firma pública cambia — son únicamente pares `profileStart`/`profileEnd` alrededor de código ya existente.
> 3. **Mejora autónoma (criterio de la propuesta)**: al medir con las seis fases originales, entre el 44 % y el 69 % del tiempo total quedaba en un remanente "sin instrumentar" — inaceptable para el objetivo declarado de "identificación clara del componente dominante". Se agregó una séptima fase, **`educationTrace`**, alrededor de la construcción de `elementTraces` (con sus llamadas a `toMatrixTrace` por miembro) y de la traza final de `K`/`C` completas para la trazabilidad educativa. Con ella, el remanente sin explicar cae a 3–33 % y aparece el verdadero cuello de botella.
> 4. **Resultado de la medición** (ver tabla completa en el reporte `reports/2026-08-05-1518-ag011-perfilado-analisis-completo.md`): en modelos grandes (~300 miembros), **`educationTrace` domina con 58–64 % del tiempo total**, muy por delante de `deformations` (~16–20 %) y del propio `linearSolve` (~3 %). AG-005 ya había descartado el solucionador lineal; AG-011 confirma que tampoco son los diagramas ni las deformaciones — es la generación de trazas de matrices para la UI educativa.
> 5. **Verificación**: `npm run verify` — lint limpio, frontera protegida intacta (27 archivos, baseline actualizado con autorización explícita del alcance aprobado), **668/668 pruebas en verde**, build correcto, presupuesto de bundle respetado.

# Resumen ejecutivo

Propone desarrollar un arnés de perfilado e inspección de rendimiento determinista (`src/engine/benchmarks.test.ts` / script de medición) para medir con precisión milimétrica la distribución de tiempos de ejecución dentro del ciclo completo de análisis estructural (`analyzeProjectAuto`). Tras la implementación de AG-005 (donde acelerar el solver lineal 5x solo redujo el tiempo total de $3.06\text{ s} \to 2.90\text{ s}$ en 300 vanos), esta propuesta identificará exactamente dónde se gasta el $95.5\%$ del tiempo de cómputo restante (integraciones polinómicas de diagramas en `diagram.ts`, evaluación de puntos críticos, cálculo de envolventes o generación de la trazabilidad educativa), permitiendo optimizaciones quirúrgicas basadas en datos reales.

# Problema

Actualmente, el motor estructural ejecuta múltiples fases por cada corrida de `analyzeProject`:
1. Construcción del modelo y ensamblaje de rigidez.
2. Resolución del sistema lineal de ecuaciones (optimizado en AG-005 a 143 ms).
3. Recuperación de fuerzas de extremos y desplazamientos.
4. Construcción de funciones polinómicas analíticas $N(x), V(x), M(x)$ e integración de curvas deformadas por tramo (`diagram.ts`).
5. Búsqueda de puntos críticos (raíces, máximos y mínimos) mediante algoritmos numéricos de bisección/búsqueda de raíces.
6. Construcción de envolventes y cálculo de fiabilidad (`envelope.ts`, `reliability.ts`).
7. Generación de trazas explicativas educativas (`explanationPresentation.ts`).

La medición realizada en AG-005 demostró que el sistema lineal solo representa el $4.5\%$ del tiempo total. Sin un arnés de perfilado de grano fino, cualquier intento posterior de optimización de rendimiento del motor sería a ciegas y correría el riesgo de invertir esfuerzo en áreas secundarias.

# Evidencia

- `reports/2026-08-05-1050-ag005-solver-disperso-hibrido.md`: Medición real en viga continua de 300 vanos (980 incógnitas): Solver lineal = 143 ms; Análisis completo = ~2,900 ms.
- `src/engine/solver.ts`: Invocación secuencial de diagramas, envolventes, auditoría de cargas y fiabilidad en cada ejecución.

# Objetivo

1. Crear un módulo o arnés de perfilado ligero (`src/engine/performanceProfiler.ts`) que mida el tiempo consumido por cada fase del solucionador en microsegundos usando `performance.now()`.
2. Identificar el área responsable del $95.5\%$ del tiempo de análisis en estructuras medianas y grandes.
3. Generar recomendaciones y propuestas de optimización basadas en métricas reales.

# Beneficio esperado

- **Desarrollo**: Claridad absoluta sobre el verdadero cuello de botella del motor de cálculo.
- **Rendimiento**: Base técnica para reducir el tiempo total de análisis de $2.9\text{ s} \to <0.5\text{ s}$ en modelos grandes.

# Solución propuesta

1. **Habilitación de Medición por Fases en `solver.ts`**:
   - Introducir `profileAnalysisPhase(name, fn)` en `src/engine/solver.ts` activo durante ejecuciones de prueba/benchmark.
2. **Desglose de Métricas**:
   - `phase.assembly`: Tiempo de ensamblaje de $K$ y $P$.
   - `phase.linearSolve`: Tiempo del solucionador lineal ($K \cdot U = P$).
   - `phase.diagrams`: Tiempo de generación de diagramas y puntos críticos por miembro (`diagram.ts`).
   - `phase.deformations`: Tiempo de integración de deformaciones $u(x), v(x), \theta(x)$.
   - `phase.auditAndReliability`: Tiempo de auditoría de cargas y clasificación de fiabilidad.
   - `phase.explanation`: Tiempo de generación del reporte explicativo.
3. **Prueba de Benchmark Automatizada**:
   - Agregar un test de benchmark en `src/engine/benchmarks.test.ts` que imprima la tabla de tiempos por fase al ejecutar con un flag de entorno.

# Alternativas consideradas

- **Uso de profilers de navegador (Chrome DevTools Performance tab)**: Es útil para inspección manual visual, pero no proporciona métricas automatizadas ni integrables en scripts de CI/Vitest. Un arnés de código liviano mediante `performance.now()` permite mediciones repetibles y deterministas.

# Justificación técnica

El perfilado por instrumentación interna con `performance.now()` tiene un costo insignificante ($<0.01\text{ ms}$) y entrega datos exactos sobre la distribución porcentual del tiempo de cómputo en Web Workers o hilo principal.

# Impacto en la experiencia del usuario

Permitirá enfocar las optimizaciones futuras en las operaciones que el usuario realmente percibe durante el uso interactivo.

# Impacto visual

Ninguno.

# Impacto en la arquitectura

Agrega utilidades de perfilado interno en `src/engine/`. No altera firmas públicas ni los resultados matemáticos.

# Complejidad

**Baja**. Es una tarea de instrumentación y medición puramente analítica.

# Prioridad

**Alta**. Desbloquea todas las decisiones futuras de optimización del motor.

# Riesgos

- Ninguno. La instrumentación no altera las salidas matemáticas.

# Dependencias

Ninguna nueva dependencia.

# Librerías o tecnologías recomendadas

Nativa (`performance.now()`).

# Archivos y módulos probablemente afectados

- **Modificación probable**:
  - `src/engine/solver.ts`
  - `src/engine/benchmarks.test.ts`
- **Creación probable**:
  - `src/engine/performanceProfiler.ts`

# Plan de implementación

## Fase 1: Instrumentación de Tiempos
- Crear `performanceProfiler.ts` con funciones de marcas temporales.
- Instrumentar las fases en `solver.ts`.

## Fase 2: Ejecución de Benchmarks
- Medir la distribución de tiempos en vigas continuas, pórticos y cerchas de 50, 150 y 300 miembros.

## Fase 3: Reporte de Resultados
- Emitir informe con la distribución porcentual por fase y registrar la propuesta de optimización correspondiente (e.g., paralelizabilidad de diagramas o memoización de raíces).

# Estrategia de implementación

Mantener la instrumentación desactivable o con overhead cero para ejecuciones normales.

# Criterios de aceptación

- `npm run verify` pasa en verde.
- El benchmark de `benchmarks.test.ts` entrega el desglose de milisegundos por fase.
- Identificación clara del componente dominante ($>50\%$ del tiempo).

# Pruebas necesarias

- `src/engine/benchmarks.test.ts`

# Restricciones

- No modificar los resultados numéricos ni la firma protegida.

# Estrategia de reversión

Desactivar las marcas de tiempo en `solver.ts`.

# Definición de terminado

Informe de perfilado completado y cuello de botella localizado con datos empíricos.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-011-perfilado-análisis-completo-cuello-botella.md`

Valida la propuesta contra el código real antes de modificar archivos.

Implementa únicamente el alcance aprobado: agrega instrumentación de tiempo por fases (`performance.now()`) en `src/engine/solver.ts` y ejecuta benchmarks para medir la distribución exacta de tiempos (ensamblaje, solver, diagramas, deformaciones, fiabilidad).

CRITERIO DE MEJORA AUTÓNOMA:
- Si al analizar el código real o durante la implementación detectas una oportunidad de mejora directa que enriquezca la solución sin alterar la lógica de negocio ni romper la frontera matemática, agrégala.
- Si la solución de la propuesta ya es óptima y suficiente, implementa estrictamente lo necesario sin añadir complejidad innecesaria.

Conserva los comportamientos y restricciones indicados en el documento.

Ejecuta lint, tests y build (`npm run verify`).

Al terminar:
- resume los cambios
- presenta la tabla con los tiempos medidos por fase en modelos de prueba
- lista los archivos modificados y creados
- actualiza el estado de la propuesta a Implementada
- mueve el documento a `Antigravity-propuestas/implementadas/AG-011-perfilado-análisis-completo-cuello-botella.md`
