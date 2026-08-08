# AG-005 — Solver disperso híbrido en math.ts (Fase A)

**Fecha:** 2026-08-05 10:50
**Agente:** Claude Code
**Rama:** main

## Qué cambió

`src/engine/math.ts` gana una vía de resolución dispersa para el sistema aumentado: elimina
primero las restricciones que fijan un solo grado de libertad, factoriza el bloque de rigidez
restante con `LDLᵀ` disperso (CSR + reordenamiento Cuthill-McKee inverso) y vuelve
automáticamente a la factorización densa de siempre ante cualquier pivote no positivo o
restricción que no pueda reducirse. `solveLinearSystem` conserva firma, contrato y forma de
`LinearSolveResult`; `solver.ts` no se tocó.

Se actualizó el baseline de la frontera protegida (autorizado explícitamente por el usuario en
el chat de esta sesión), y la documentación que afirmaba que no existía backend disperso.

## Por qué

Ejecución de la propuesta `AG-005`, que pedía CSR + LDLᵀ disperso para acelerar el motor.

**La premisa técnica de la propuesta era incorrecta y hubo que corregirla.** El documento
asume que `solveLinearSystem` recibe una matriz de rigidez `K` simétrica definida positiva,
donde un `LDLᵀ` sin pivoteo sería válido. En realidad recibe el sistema aumentado de
multiplicadores de Lagrange `[[K, Cᵀ], [C, 0]]` (`solver.ts:1492-1515`), que es **simétrico
indefinido**: todas las condiciones de borde —apoyos, desplazamientos prescritos, vínculos
rígidos, grados contables— entran como filas de restricción, no por eliminación ni
penalización. `docs/MATHEMATICAL_SPEC.md` ya lo advertía explícitamente. Implementar lo
propuesto literalmente habría dado resultados incorrectos, o simplemente nunca se habría
activado.

La corrección aprobada por el usuario fue el diseño híbrido: reducir primero a un bloque
genuinamente definido positivo, y solo entonces aplicar la factorización dispersa.

## Archivos tocados

- `src/engine/math.ts` — tipo `SparseMatrixCSR`, detección y eliminación de restricciones de un
  grado, RCM, `LDLᵀ` disperso simbólico + numérico, y refactor de la estimación de condición
  (Hager) y el refinamiento iterativo para operar contra un cierre `solve(rhs)` compartido por
  ambas vías. Añade `__testables` (solo pruebas).
- `src/engine/math.test.ts` — 7 pruebas nuevas; las 5 existentes quedan intactas.
- `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` — actualizado (`--update`), 26 archivos.
- `docs/MATHEMATICAL_SPEC.md` — §11 describe la vía híbrida y cuándo se abandona; §17 ya no
  lista la solución dispersa como no implementada.
- `docs/LIMITATIONS.md` — ya no afirma que el solucionador sea únicamente denso.
- `docs/releases/0.8.1/PERFORMANCE.md` — tabla medida antes/después.
- `Antigravity-propuestas/` — AG-005 movida a `implementadas/` con nota de implementación;
  `backlog.md` y `roadmap.md` actualizados; nuevas entradas AG-011 y AG-012.

## Cómo verificar

```bash
npm run verify
```

Resultado obtenido: lint limpio · frontera protegida intacta (26 archivos) · **649/649 pruebas
en verde** (642 previas + 7 nuevas, sin relajar ninguna tolerancia) · build correcto ·
presupuesto de bundle respetado (629 337 B / 169 127 gzip, techo 648 000 / 174 000).

Medición de rendimiento (`npm run perf` **no** sirve: su sección de solver es un stub que falla
al importar TypeScript desde Node):

```bash
npx vitest run src/engine/performance.test.ts
```

## Resultado real de rendimiento

Viga continua de 300 vanos, 980 incógnitas, misma máquina:

| Etapa | Densa | Dispersa |
|---|---:|---:|
| Factorización | 180 ms | 36 ms |
| `solveLinearSystem` completo | 303 ms | 143 ms |
| Análisis completo | ~3 060 ms | ~2 900 ms |

**La factorización es 5x más rápida, pero el análisis completo apenas cambia.** El sistema
lineal era el 10 % del tiempo y ahora es el 4,5 %; el coste dominante está fuera del
solucionador lineal. El "5x–20x" que prometía la propuesta no es alcanzable por esta vía.

Paridad numérica: la estimación de condición coincide entre ambas vías hasta la decimotercera
cifra (1 293 831,434578906 vs 1 293 831,434578983), por lo que la clasificación de
confiabilidad de `reliability.ts` no cambia según la vía tomada.

## Detalles no obvios para quien siga este código

- **Un apoyo deslizante vertical no tiene un cero exacto en su fila.** Se construye con
  `Math.cos(PI/2)`, que vale `6.1e-17` (`solver.ts:1380-1381`). La detección de restricciones
  de un grado usa por eso una tolerancia relativa (`1e-12` del mayor de la fila). Con una
  prueba de cero literal, *todo* modelo con un apoyo deslizante —incluido el de la prueba de
  rendimiento— caería a la vía densa y la optimización no serviría de nada.
- **La estimación de condición debe correr sobre el sistema completo**, no sobre el bloque
  reducido, o los umbrales `1e10`/`1e12` de `reliability.ts` dejarían de significar lo que
  tienen calibrado. Por eso el cierre `solve(rhs)` trabaja con vectores de longitud original.
- **`pivotRatio` cambia de significado** en la vía dispersa (pivotes del bloque reducido). Es
  inocuo: el del solve global se descarta, y su único consumidor es `influence.ts:575` para un
  ajuste 4×4 que siempre va por la vía densa.
- `findNullSpaceVector` solo se invoca sobre la matriz original; la vía híbrida se retira antes
  de llegar a ese flujo, para no alterar el diagnóstico de mecanismos.

## Pendiente / siguiente paso

- **Sin pushear**: el commit está hecho localmente. `autoPush: false` a propósito; falta tu
  confirmación explícita para `git push origin main`.
- **AG-011 (recomendado antes que cualquier otra optimización del motor)**: perfilar el
  análisis completo para localizar el coste dominante. Este trabajo demostró que no está en el
  solucionador lineal, pero no midió dónde sí está.
- **AG-012 (Fase B)**: complemento de Schur para extender la vía dispersa a vínculos rígidos y
  apoyos deslizantes inclinados. Solo vale la pena si AG-011 muestra que el solucionador lineal
  llega a ser un coste relevante en algún escenario real.
- La política de `VERIFICATION_POLICY.md` pide reejecutar FTool ante "un cambio real en el
  motor". Aquí la **formulación** no cambió (§11 del spec conserva las mismas ecuaciones); solo
  cambió la ruta de álgebra lineal, y la paridad la demuestra la suite congelada
  `ftoolComparison.test.ts`, que pasa sin tocar tolerancias. Se deja constancia de la decisión
  en lugar de omitirla en silencio.
