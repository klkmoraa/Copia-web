# Contexto para Codex — Mejora del motor matemático 0.8.2

Fecha: 2026-08-02. Agente: Claude Code. Rama: `main`. Sin operaciones remotas.

Alcance de la fase: **confiabilidad de los resultados estructurales**. Núcleo en
`src/engine`, sus tipos, los workers relacionados y sus pruebas. El usuario
amplió explícitamente el alcance en una segunda parte de la sesión para cerrar
los riesgos §7.3 y §7.4 en la interfaz (`ResultsPanel.tsx`, `src/i18n/catalogs.ts`)
— ver esa sección para el detalle. Exportaciones, PDF e importaciones no se
tocaron en ningún momento. No se implementó P-Delta, 3D, dinámica, plasticidad,
placas, cascarones ni solver disperso. No se agregaron dependencias.

---

## 1. Línea base

`npm test` antes de tocar nada: **78 archivos / 530 pruebas, todas en verde**
(vitest 4.1.10, `structureco@0.8.1`).

---

## 2. Problemas comprobados

Cada defecto se reprodujo con una prueba que falló **antes** de la corrección.

### 2.1 `success` se usaba como sinónimo de resultado confiable

`AnalysisResult.success` es `!issues.some(severity === 'error')`. Todas las
advertencias numéricas del solver —residuo elevado, `κ₁ > 1e12`, residuo lineal,
compatibilidad de restricciones, cierre `N–V–M`, compatibilidad de la deformada—
conservan `success = true`. No existía ninguna distinción entre *cálculo
terminado*, *resultado utilizable* y *resultado confiable*, ni una clasificación
publicada, ni un lugar donde el cierre de diagramas quedara como dato (solo como
texto de advertencia).

### 2.2 Escenarios que desaparecían en silencio

`analyzeProjectScenarios` terminaba con
`.filter((scenario) => scenario.result.success)`. Un caso o una combinación que
fallaba se borraba de la lista sin dejar rastro.

Reproducción: armadura de tres barras con `density` y un caso de carga con
`selfWeightFactor = 1`. El peso propio de una barra de dos fuerzas tiene
componente transversal, así que el solver lo rechaza con error. Escenarios
solicitados: `case:Q`, `case:PP`, `combination:C1`. Escenarios devueltos:
**solo `case:Q`**. Las envolventes construidas sobre esa lista parecían completas.

### 2.3 Un salto concentrado podía aplicarse dos veces

`buildExactDiagrams` localizaba los saltos con
`jumps.find((jump) => Math.abs(jump.x - x) <= tolerance)` en **cada** frontera de
tramo, con `tolerance = 1e-10·L`. Las fronteras de carga distribuida usan una
tolerancia mucho más fina (`≈ 64·ε·L`). Cuando el borde de una carga distribuida
cae dentro de `1e-10·L` de una carga puntual, se generan dos fronteras distintas
y el mismo salto se aplica en las dos.

Reproducción exacta (viga simplemente apoyada `L = 8`, `q = -1 kN/m` sobre
`[0, 4+8e-11]`, `P = -10 kN` en `x = 4`, reacciones `8` y `6`):

| tramo | `V(x0)` antes | `V(x0)` correcto |
| --- | --- | --- |
| `[0, 4]` | `10` | `8 − x` |
| `[4, 4+8e-11]` | `-4` | `-6` |
| `[4+8e-11, 8]` | `-14.00000000008` | `-6` |

El cierre del diagrama salía `ΔV = -4`, `ΔM = -24` — todo el diagrama aguas abajo
de la carga quedaba corrido en el valor completo de la carga puntual, y `success`
seguía siendo `true` (el cierre solo generaba una advertencia).

### 2.4 No se podía pedir el límite derecho de una envolvente

`evaluateEnvelopeAt(envelope, x)` seleccionaba el tramo con
`x >= item.x0 - 1e-10 && x <= item.x1 + 1e-10`, es decir, **siempre el primero
que contiene `x`**: en una discontinuidad devolvía únicamente el límite
izquierdo, sin forma de pedir el derecho. Lo mismo en
`evaluateDeformationEnvelopeAt`. Además, `ExactExtremum` no indicaba a qué lado
pertenecía un extremo situado sobre un salto.

### 2.5 El error de ajuste de la línea de influencia se calculaba y se ignoraba

`buildInfluenceLine` calculaba `fit.maxAbsoluteError` y `fit.maxRelativeError`,
los publicaba… y devolvía la línea igual. No había umbral, ni subdivisión, ni
rechazo. Tampoco se miraba la confiabilidad de los análisis de carga unitaria:
solo se abortaba si `success` era falso.

---

## 3. Cambios realizados

### 3.1 Confiabilidad numérica — `src/engine/reliability.ts` (nuevo)

- Tipos en `src/types.ts`: `ReliabilityLevel`, `ReliabilityCheckId`,
  `ReliabilityCheck`, `ResultReliability`; campo opcional
  `AnalysisResult.reliability`.
- `classifyAnalysisReliability(result)` responde por separado:
  - `completed` — la solución llegó al final (`displacements.length > 0`);
  - `usable` — hay resultados nodales que leer;
  - `level ∈ reliable | limited | unreliable | failed`.
- Diez comprobaciones independientes con umbral doble (`limitedAbove`,
  `unreliableAbove`), alineados con los umbrales de advertencia y error que el
  solver ya aplicaba, para que la clasificación nunca contradiga la lista de
  incidencias:

  | id | limited > | unreliable > |
  | --- | --- | --- |
  | `condition` | 1e10 | 1e12 |
  | `backward-error` | 1e-12 | 1e-8 |
  | `forward-error` | 1e-9 | 1e-4 |
  | `refinement` | agotó iteraciones sin llegar a 5e-15 | — |
  | `structural-residual` | 1e-9 | 1e-7 |
  | `constraints` | 1e-9 | 1e-6 |
  | `equilibrium` | 1e-8 | 1e-6 |
  | `load-audit` | 1e-10 | 1e-8 |
  | `diagram-closure` | 1e-9 | 1e-7 |
  | `compatibility` | 1e-9 | 1e-7 |

- Regla de valores faltantes: una comprobación **obligatoria** sin valor finito
  es `unreliable` (si el error no puede acotarse, no hay evidencia de calidad);
  una **opcional** ausente no degrada (un modelo sin miembros deformables no
  tiene cierre de diagramas).
- `success === false` con números presentes ⇒ como mínimo `unreliable`.
  Sin resultados nodales ⇒ `failed`.
- `isTrustedForCombination(level)` — solo `reliable` y `limited` pueden alimentar
  envolventes, escenario gobernante y líneas de influencia.
- `resolveReliability(result)` deriva la clasificación de resultados construidos
  fuera del solver (fixtures, payloads restaurados).

En `src/engine/solver.ts`:
- `MemberResult.endCompatibility` y `MemberResult.endCompatibilityError` ahora se
  almacenan (antes el cierre `N–V–M` solo existía como texto de advertencia).
- Las cuatro salidas tempranas se unificaron en `abortedResult(...)`, que además
  clasifica el resultado.
- El resultado final se clasifica con `classifyAnalysisReliability` antes de
  publicarse.

### 3.2 Casos, combinaciones y envolventes — `envelope.ts`, `resultSummary.ts`

- `analyzeProjectScenarios` devuelve **todos** los escenarios solicitados.
  `AnalysisScenario` gana `kind` (`case`/`combination`), `status`
  (`ReliabilityLevel`), `usable` y `failureReason`.
- `selectEnvelopeScenarios(scenarios)` → `{ included, excluded }`, conservando la
  causa de cada exclusión.
- `EnvelopeCoverage` (`complete`, `includedScenarioIds`, `excludedScenarios`,
  `level`) se incorpora a `DiagramEnvelope`, `ReactionEnvelope` y
  `DeformationEnvelope`. `complete` es `false` en cuanto falte un escenario.
- Las tres envolventes se construyen únicamente con escenarios `reliable` o
  `limited`. `ReactionEnvelope` además exige, nodo por nodo, que todos los
  escenarios incluidos lo hayan reportado (`NodeReactionEnvelope.complete`,
  ver riesgo §7.5 — resuelto en esta misma fase).

### 3.3 Discontinuidades — `diagram.ts`, `envelope.ts`, `resultSummary.ts`

- `buildExactDiagrams` asigna cada salto a **la frontera de tramo más cercana**,
  ajusta la coordenada del salto a esa frontera y acumula los saltos que caen en
  la misma frontera. Sustituye la búsqueda por tolerancia y elimina la doble
  aplicación descrita en §2.3. Como efecto secundario, los saltos quedan
  exactamente sobre fronteras de tramo, lo que hace consistente la búsqueda de
  `evaluateDiagramAt` (que usa la tolerancia fina de intervalos).
- `evaluateEnvelopeAt(envelope, x, side = 'right')` y
  `evaluateDeformationEnvelopeAt(envelope, x, side = 'right')` reciben el lado
  explícitamente, con la misma estrategia de selección que `evaluateDiagramAt` y
  `evaluateInfluenceLine`. Ambas devuelven también los `scenarioId`.
- `ExactExtremum` gana `side` (`left` / `right` / `continuous`), calculado
  comparando el valor con el del tramo vecino; `DiagramEnvelope.minimum/maximum`
  ganan `EnvelopeExtreme.side`.
- Los diagramas siguen siendo polinómicos exactos; no se introdujo muestreo en
  ninguna ruta de cálculo.

### 3.4 Líneas de influencia — `influence.ts`

- `InfluenceFitLimits` + `DEFAULT_INFLUENCE_FIT_LIMITS`
  (`maxRelativeError: 1e-6`, `maxAbsoluteError: 1e-9`, `maxSubdivisions: 4`).
  `buildInfluenceLine(project, memberIds, target, startNodeId?, limits?)`.
- Un punto de comprobación falla solo si excede **a la vez** la tolerancia
  absoluta y la relativa (cerca de un cero de la línea, el error relativo aislado
  no significa nada).
- Si un intervalo no cumple, se parte por la mitad y cada mitad se vuelve a
  ajustar y certificar de forma independiente, hasta `maxSubdivisions`.
- Si tras el límite sigue sin cumplir, se lanza `InfluenceFitError`, que
  transporta el diagnóstico completo. La línea nunca se devuelve.
- `InfluenceFitDiagnostics` gana `accepted`, `subdivisions`,
  `maxSubdivisionDepth`, `toleranceRelative`, `toleranceAbsolute`,
  `rejectedIntervals`.
- `InfluenceSolverDiagnostics` gana `worstReliability`. `solveUnitResponse` ahora
  aborta también cuando un análisis de carga unitaria no es confiable, no solo
  cuando falla.

**Nota importante para Codex:** para esta biblioteca de elementos la
reconstrucción cúbica es *exacta* (los desplazamientos bajo una carga puntual
móvil son cúbicos por tramos en la posición de la carga, también en Timoshenko y
con conexiones semirrígidas o zonas rígidas). Por eso no existe un modelo físico
que haga fallar el ajuste, y las pruebas del mecanismo de subdivisión/rechazo
fuerzan la tolerancia por parámetro. El guardián vigila **degradación numérica**,
no error de discretización.

### 3.5 Ajustes de consumidores (mínimos, sin cambios de diseño)

- `ResultSummary.tsx`: el contador de escenarios resueltos usa
  `reactionEnvelope.includedScenarioIds.length`; una tarjeta de escenario fallido
  muestra `—` y lleva la causa en `title`. Mismo marcado, mismos estilos.
- `ResultsPanel.tsx`: el contador de escenarios de la envolvente usa
  `envelope.includedScenarioIds.length`.
- Fixtures de prueba existentes (`performance.test.ts`, `resultSummary.test.ts`)
  actualizadas a la nueva forma de `AnalysisScenario`.
- `src/utils/resultsExport.ts` **no** se tocó: lee campos explícitos, y los
  campos añadidos son aditivos, así que el CSV exportado no cambia.

---

## 4. Pruebas ejecutadas y resultados

Orden seguido: prueba específica → pruebas relacionadas → suite completa.

| Archivo (nuevo) | Pruebas | Resultado |
| --- | --- | --- |
| `src/engine/reliability.test.ts` | 9 | verde |
| `src/engine/discontinuity.test.ts` | 5 | verde |
| `src/engine/scenarioCoverage.test.ts` | 6 | verde |
| `src/engine/influenceFit.test.ts` | 5 | verde |

Las 25 pruebas nuevas fallaron primero (17 fallos en la primera corrida conjunta,
más las de influencia una vez definido el contrato) y pasaron después de cada
corrección.

Verificación final:

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | sin errores |
| `npm run lint` (oxlint) | sin hallazgos |
| `npm test` | **83 archivos / 573 pruebas, todas en verde** |
| `npm run build` | correcto (`tsc -b` + vite) |
| `npm run verify:protected` | frontera intacta tras `--update` autorizado |

Línea base 78/530 → 83/573 (incluye la prueba de cobertura por nodo de §7.5, la
de fusión de acciones concentradas de §7.6 y las 16 de calibración empírica de
§7.2). No se desactivó ninguna prueba, no quedaron `console.log`
ni archivos temporales (el archivo de sondeo `__probe.test.ts` se eliminó).

---

## 5. Archivos modificados

Motor y tipos:
- `src/engine/reliability.ts` *(nuevo)*
- `src/engine/solver.ts`
- `src/engine/diagram.ts`
- `src/engine/envelope.ts`
- `src/engine/resultSummary.ts`
- `src/engine/influence.ts`
- `src/types.ts`

Pruebas:
- `src/engine/reliability.test.ts` *(nueva)*
- `src/engine/discontinuity.test.ts` *(nueva)*
- `src/engine/scenarioCoverage.test.ts` *(nueva)*
- `src/engine/influenceFit.test.ts` *(nueva)*
- `src/engine/performance.test.ts` *(fixture)*
- `src/engine/resultSummary.test.ts` *(fixture, más la prueba de cobertura por nodo de §7.5)*
- `src/engine/reliabilityCalibration.test.ts` *(nueva, evidencia de §7.2)*

Consumidores:
- `src/features/results/ResultSummary.tsx`
- `src/features/results/ResultsPanel.tsx` (además del contador de escenarios: el
  indicador de confiabilidad de §7.3 y el cursor de envolvente por lado de §7.4)
- `src/i18n/catalogs.ts` (`results.stateResolvedLimited`, `results.stateResolvedUnreliable`,
  `results.envelopeDiscontinuityReading`, en ambos idiomas)

Documentación y metadatos:
- `docs/MATHEMATICAL_SPEC.md` (§11.2 nueva, §13.3, §13.4, §13.5)
- `docs/LIMITATIONS.md` (envolventes incompletas, líneas rechazadas, `success` ≠ confiable)
- `docs/motor-matematico/CONTEXTO-MEJORA-MOTOR-0.8.2.md` *(este documento)*
- `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` (regenerado con `--update`)
- `package.json`, `package-lock.json` (versión 0.8.2)
- `.claude/launch.json` (configuración `structureco-dev-verify` con puerto
  automático, agregada para poder abrir un servidor de desarrollo propio en esta
  sesión sin chocar con el de otra sesión activa en el puerto 5173; no afecta el
  comportamiento de la aplicación)

Workers: **sin cambios de código**. `scenarios.worker.ts` e `influence.worker.ts`
siguen siendo válidos: `ResultReliability` es dato plano (clonable estructuralmente)
y `InfluenceFitError` se propaga por su `message` como cualquier otro error.

---

## 6. Commits locales

Ver `git log`. Ninguna operación remota: sin `push`, sin PR, sin `fetch`.

---

## 7. Riesgos pendientes

1. **`AnalysisResult.reliability` es opcional.** Se hizo así para no romper los
   literales de `AnalysisResult` que ya existían en las pruebas. Un resultado
   restaurado desde un archivo `.structureco` antiguo no lo trae; usa siempre
   `resolveReliability(result)` en lugar de leer el campo directamente. Verificado
   (`grep -rn '\.reliability\b' src`): ningún consumidor del motor ni de fuera de
   él lee el campo directamente hoy; `envelope.ts` e `influence.ts` ya pasan
   siempre por `resolveReliability`. El riesgo sigue siendo real para código
   futuro, así que se deja documentado en vez de intentar prohibirlo en tiempo de
   compilación (el campo debe poder faltar en datos históricos).
2. ~~Los umbrales son una elección de ingeniería, no una demostración.~~
   **Resuelto con evidencia empírica.** `reliabilityCalibration.test.ts` corre
   diez modelos de referencia legítimos y ya verificados —viga simple, pórtico
   con nudos rígidos, armadura triangular, voladizo con peso propio, conexión
   semirrígida con zonas rígidas colineales, viga profunda Timoshenko, apoyo
   elástico normal inclinado y los cuatro marcos de Hibbeler 4-39 a 4-42— y
   confirma que los diez se clasifican `reliable` sin ninguna comprobación
   degradada. Una segunda prueba mide el margen real: en los diez modelos,
   `condition` queda por debajo de `1e-3 × limitedAbove` (es decir, κ₁ está al
   menos 1000 veces por debajo de `1e10`) y `backward-error` por debajo de
   `1e-2 × limitedAbove`. Esto no demuestra que el umbral sea óptimo, pero
   reemplaza la intuición ("un modelo sano típico...") por una cifra
   reproducible: si algún modelo legítimo futuro se acerca a ese margen, esta
   prueba es donde debe añadirse antes de tocar el umbral.
3. ~~La UI todavía no muestra el nivel de confiabilidad.~~ **Resuelto — alcance
   ampliado explícitamente por el usuario a UI (sin exportaciones/PDF).**
   `ResultsPanel.tsx` deriva `resolveReliability(analysis)` y lo usa en el
   indicador de estado de la barra de comandos: `analysisState` distingue ahora
   `results.stateResolved` (`reliable`), `results.stateResolvedLimited`
   (`limited`) y `results.stateResolvedUnreliable` (`unreliable`), y el `title`
   del indicador lleva el mensaje de la comprobación gobernante
   (`reliability.governing?.message`) sin agregar CSS nuevo — reutiliza la clase
   `is-warning` ya existente. El PDF y el resto de exportaciones no se tocaron.
   Verificado en el navegador: el ejemplo "Viga simplemente apoyada" (modelo
   sano) sigue mostrando "Resultados resueltos" / `is-resolved` / sin `title`,
   sin regresión.
4. ~~El cursor de envolvente sigue leyendo un solo lado.~~ **Resuelto — mismo
   alcance ampliado.** `DiagramView` calcula ahora `evaluateEnvelopeAt(envelope,
   cursorX, 'left')` y `'right'` por separado; cuando difieren en más de
   `1e-9·maxAbs` se muestran ambos límites de mínimo y máximo bajo la lectura
   principal, reutilizando la clase `at-jump` ya existente y el patrón de
   `results.discontinuityReading` (nueva clave `results.envelopeDiscontinuityReading`,
   con placeholders idénticos en ambos catálogos, verificados por
   `catalogs.test.ts`). Confirmado en el navegador con el ejemplo de viga simple
   en modo envolvente (4 escenarios): en `x=4.000 m`, V (que tiene un salto real
   por la carga puntual) muestra `Mín.: izq. 0.000 → der. -30.000 kN` y
   `Máx.: izq. 30.000 → der. 0.000 kN`; M (continuo en ese punto) no muestra
   ninguna línea de discontinuidad — cero falsos positivos.
5. ~~`ReactionEnvelope.complete` solo cubría escenarios.~~ **Resuelto.**
   `NodeReactionEnvelope` gana `complete`: verdadero solo si todos los escenarios
   incluidos reportaron ese nodo. `ReactionEnvelope.complete` ahora exige además
   que todos los nodos sean `complete`. Con `analyzeProjectScenarios` esto nunca
   puede fallar (todo escenario reporta cada nodo de `project.nodes`), pero
   `buildReactionEnvelope` acepta cualquier `AnalysisScenario[]` que un llamador
   construya a mano, y sin esta comprobación un nodo ausente de un escenario
   incluido reducía en silencio su envolvente a los escenarios que sí lo
   reportaban mientras `complete` seguía en `true`. Prueba en
   `resultSummary.test.ts` (`'tolera escenarios sin el mismo conjunto de nodos,
   pero señala la cobertura parcial'`).
6. **La asignación de saltos a la frontera más cercana** fusiona dos acciones
   concentradas separadas por menos de `coordinateTolerance(L)` (`≈1e-10·L`) en
   una sola frontera. Es el comportamiento deseado (esa distancia es la
   definición de "coincidentes"), pero implica que el diagrama no distingue esas
   dos acciones. Confirmado con una prueba dedicada en `discontinuity.test.ts`
   (`'funde dos acciones concentradas más cercanas que la tolerancia de
   coordenada, pero las mantiene distintas si están más separadas'`): dos cargas
   puntuales a `3e-10` m se funden en un único salto con el delta combinado; a
   `5e-9` m —bien fuera de la tolerancia para `L=8`— producen dos saltos
   independientes con sus valores originales. El límite queda documentado, no
   solo implícito en la implementación.
7. **El mecanismo de subdivisión de influencia no tiene una prueba positiva con
   un modelo físico** que lo obligue a subdividir y luego acepte, porque no existe
   tal modelo con esta biblioteca de elementos (§3.4). Si en el futuro se añaden
   elementos cuya respuesta no sea cúbica por tramos, esa prueba se vuelve
   construible y debería añadirse.
