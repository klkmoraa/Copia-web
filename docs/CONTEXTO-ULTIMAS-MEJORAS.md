# Contexto de las últimas mejoras

Sesión del 2026-08-03 · rama `main` · versión `0.8.2` · **sin push**

## Mejoras realizadas

### 1. El análisis que nunca corrió ahora llega al usuario

**Motivo.** Dos fallos silenciosos reales en `ProjectContext.analyze()`:

- `runFallbackAnalysis(...).then(complete)` no tenía `catch`. Si el chunk del
  solver no se podía cargar (pestaña vieja contra un despliegue nuevo, sin red)
  la promesa quedaba sin manejar, `isAnalyzing` se quedaba en `true` para
  siempre y la UI mostraba "Analizando…" sin ningún mensaje ni forma de salir.
- Cuando el worker respondía `analysis-error`, la UI ejecutaba de nuevo la misma
  función pura en el hilo principal: bloqueaba la interfaz para llegar al mismo
  fallo y descartaba el mensaje del worker.
- El camino `analyzeAfter` de `updateProject` publicaba su resultado sin
  comprobar la revisión, así que un resultado de un modelo anterior podía pisar
  una edición más nueva (además de no tener `catch`).

**Solución.** `abortedResult` sale de `solver.ts` a `src/engine/analysisFailure.ts`
(`abortedAnalysis` + `unavailableAnalysis`), de modo que la UI puede publicar una
corrida abortada sin arrastrar el solver al bundle principal ni duplicar la forma
del resultado fallido. `analysis-error` se muestra tal cual con su `issue`, los
dos caminos de fallback tienen `catch`, y `analyzeAfter` comprueba la revisión.

### 2. La envolvente resuelta sobrevive a los cambios de presentación

**Motivo.** `useScenarioAnalysis` y `useInfluenceAnalysis` reiniciaban su estado
con la **identidad del objeto** `ProjectModel`. El store entrega un clon profundo
nuevo ante cualquier cambio, así que cambiar unidades, idioma o la escala del
diagrama apagaba el botón "Env." y tiraba N análisis completos (un solve por caso
y por combinación) que seguían siendo exactos.

**Solución.** `src/engine/projectSignature.ts` (nuevo, memoizado por objeto con un
`WeakMap`) identifica solo lo que `analyzeProject` lee: nodos, miembros, casos,
combinaciones, cargas, efectos iniciales y `settings.calculationMode` — el único
`settings.*` que el motor consulta, comprobado por búsqueda. Las tres
reinicializaciones se apoyan en esa firma. De paso, el fallback de
`useScenarioAnalysis` guarda y cancela su temporizador al desmontar, igual que ya
hacía `useInfluenceAnalysis`.

**Ninguna formulación matemática se modificó.**

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `src/engine/analysisFailure.ts` | Nuevo · `abortedAnalysis` / `unavailableAnalysis` |
| `src/engine/projectSignature.ts` | Nuevo · `analysisSignature` |
| `src/engine/projectSignature.test.ts` | Nuevo · contrato de la firma |
| `src/store/ProjectContext.analysisFailure.test.tsx` | Nuevo · fallos de análisis |
| `src/engine/solver.ts` | `abortedResult` pasa a ser alias del módulo extraído |
| `src/store/ProjectContext.tsx` | `fail()`, `catch`, guardia de revisión |
| `src/engine/useScenarioAnalysis.ts` | Reinicio por firma + temporizador cancelable |
| `src/engine/useInfluenceAnalysis.ts` | Reinicio por firma |
| `src/features/results/ResultsPanel.tsx` | Reinicio de "Env." por firma |
| `src/features/results/ResultsPanel.test.tsx` | Prueba de persistencia de la envolvente |
| `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` | Refresco de la frontera protegida |

## Pruebas ejecutadas

Las cuatro pruebas nuevas se escribieron primero y **fallaron** contra el código
anterior (las dos de análisis con `Unhandled Rejection`; la de la envolvente con
`expected 'false' to be 'true'`).

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | ✅ |
| `npm run lint` (oxlint) | ✅ |
| `npm run verify:protected` | ✅ 25 archivos |
| `npm test` (suite completa) | ✅ **85 archivos / 578 pruebas** (línea base: 83/573) |
| `npm run build` | ✅ 1.87 s |
| `npm run verify` (pasada final única) | ✅ |

Verificación en navegador (dev server propio, puerto 5174):

- "Env." activo → `aria-pressed=true`, `4 escenarios`, 2 curvas de envolvente.
- Cambio de unidades a `N-mm` → **se conserva**: `true`, `4 escenarios`, 2 curvas.
- Cambio de modo de cálculo (que sí lee el solver) → **se reinicia**: `false`,
  0 curvas. Sin errores en consola.

## Commits locales

```
578c40f chore(release): refrescar la línea base protegida tras los dos arreglos
d184730 perf(results): conservar los escenarios resueltos al cambiar solo la presentación
95b0865 fix(store): publicar el análisis que nunca corrió en vez de congelar la UI
```

## Riesgos pendientes

- **Firma de análisis.** `analysisSignature` debe crecer si el solver empieza a
  leer otro campo de `settings`. Hoy solo lee `calculationMode`, y
  `projectSignature.test.ts` fija ese contrato; si se añade otro, hay que
  añadirlo a la firma **y** a esa prueba, o resultados obsoletos sobrevivirán a
  un cambio real.
- **`updateProject(updater, analyzeAfter)`.** El parámetro sigue sin usarse en
  toda la app; se le arreglaron la guardia de revisión y el `catch`, pero no se
  eliminó para no tocar la API del contexto que comparte el otro agente.
- **Riesgos #1 y #7 del informe anterior** (`AnalysisResult.reliability` opcional
  y ausencia de una prueba positiva de subdivisión de influencia con un modelo
  físico real) siguen abiertos y sin cambios en esta sesión.
- **No se hizo push.** Los tres commits están solo en `main` local.
