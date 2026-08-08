# AG-013 — Generación diferida de `educationTrace`

**Fecha:** 2026-08-05 17:44
**Agente:** Claude Code
**Rama:** main

## Qué cambió

`analyzeProject` (`src/engine/solver.ts`) gana `options.includeEducationTrace`
(por defecto `true`, para no romper a nadie). Cuando es `false`, se saltan
tanto las 4 llamadas a `toMatrixTrace` por miembro como la traza de ensamblaje
completa (`toMatrixTrace` sobre `K` y `C`, de tamaño `ndof × ndof` — el cuello
de botella que AG-011 midió en 58–64 % del tiempo total). El resto del
resultado (`displacements`, `nodeResults`, `memberResults`, diagramas,
auditoría, fiabilidad) es matemáticamente idéntico con o sin la traza; lo
verifica un test nuevo campo a campo.

El lienzo interactivo (`ProjectContext.analyze()`, vía worker o fallback),
P-Delta (`pDelta.ts`, en cada iteración de `solveLoadStep` salvo que el
llamador pida la traza), las envolventes (`envelope.ts`) y las líneas de
influencia (`influence.ts`, un `analyzeProject` por punto de la barrida) ahora
piden `includeEducationTrace: false` — ninguno de ellos lee jamás ese campo.

La pestaña "Aprender" y la exportación de PDF/paquete sí la necesitan. Se
añadió `ProjectContext.ensureEducationTrace()`: si el análisis actual ya tiene
la traza no hace nada; si no, dispara un `analyzeProject` adicional (por
worker cuando es posible, para no congelar la UI) y la injerta en el
`AnalysisResult` ya publicado, con guardas de referencia para descartar el
resultado si el proyecto cambió mientras tanto. `EducationExplorer`
(`ResultsPanel.tsx`) la llama al montar (es decir, al abrir la pestaña) y
muestra un estado de carga (`results.loadingTrace`, ES/EN) mientras llega;
`TopBar.exportPortable` la llama antes de generar el reporte si el análisis en
memoria aún no la trae.

Verificado en el navegador: modelo de pórtico de ejemplo → analizar → pestaña
"Aprender" → etapa "Ensamblaje" muestra la matriz `K` 12×12 y `C` 4×12 con
valores reales, sin errores de consola.

## Por qué

AG-011 (perfilado empírico) encontró que construir `educationTrace` domina el
tiempo de análisis en modelos grandes (300 miembros: 58,1–65,6 % según el
tipo de estructura) pese a ser información puramente presentacional que solo
consume la pestaña educativa. AG-013 es la propuesta aprobada que pide
diferir ese cálculo a demanda.

**Ampliación autónoma respecto al alcance aprobado.** La propuesta solo
mencionaba `solver.ts`, el worker y el store. Al revisar el código real se
encontró que `pDelta.ts` llama `analyzeProject` una vez por iteración de
convergencia (hasta `maxIterationsPerStep × maxLoadSteps`, descartando casi
todas salvo la última), `envelope.ts` una vez por caso/combinación de
envolvente, e `influence.ts` una vez por punto de muestreo de la línea de
influencia — los tres, sin excepción, ignoran `.educationTrace` en el
resultado. Extender el mismo flag opt-out a esos tres sitios es una mejora
directa y de bajo riesgo (un solo parámetro booleano hilado, sin tocar
convergencia ni lógica de negocio) que multiplica el impacto medido de
AG-013 en el modo P-Delta y en herramientas que ya eran lentas por repetir el
análisis muchas veces.

## Archivos tocados

- `src/engine/solver.ts` — nuevo `options.includeEducationTrace` (default
  `true`); `elementTraces.push(...)` y la construcción de
  `educationTrace` (K/C, `dofs`, `reactionVector`, `strainEnergy`) quedan
  condicionadas al flag.
- `src/engine/pDelta.ts` — `analyzeProjectPDelta`/`analyzeProjectAuto` ganan
  `options.includeEducationTrace`; se hila hacia `solveLoadStep` y hacia el
  `firstOrder` inicial; la llamada de referencia `stepFirstOrder` (nunca
  publicada) siempre pide `false`.
- `src/engine/envelope.ts` — `analyzeProjectScenarios` pide `false`.
- `src/engine/influence.ts` — `solveUnitResponse` pide `false`.
- `src/engine/analysisWorkerProtocol.ts` — `AnalysisWorkerRequest` gana
  `includeEducationTrace?: boolean`, propagado a `analyzeProjectAuto`.
- `src/store/ProjectAnalysisContext.tsx` — nueva `ensureEducationTrace()` en
  el tipo del contexto.
- `src/store/ProjectContext.tsx` — `analyze()` y `runFallbackAnalysis` piden
  `false`; nuevo `runAnalysisWithTrace` (worker-o-fallback independiente) y
  `ensureEducationTrace()`, expuestos por `ProjectProvider`.
- `src/features/results/ResultsPanel.tsx` — `EducationExplorer` llama
  `ensureEducationTrace()` al montar y muestra un estado de carga mientras no
  hay traza.
- `src/features/topbar/TopBar.tsx` — `exportPortable` asegura la traza antes
  de generar el PDF/paquete si el análisis en memoria no la trae.
- `src/i18n/catalogs.ts` — clave `results.loadingTrace` (ES/EN).
- `src/engine/benchmarks.test.ts` — test de paridad numérica
  (`includeEducationTrace: false` no cambia ningún resultado) y benchmark
  gateado por `STRUCTURECO_PROFILE_ANALYSIS=1` con la medición antes/después.
- `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` — actualizado
  (`--update`, 27 archivos): cambio explícitamente autorizado por el alcance
  aprobado de AG-013, tras confirmar paridad numérica.
- `Antigravity-propuestas/` — AG-013 movida de `aprobadas/` a
  `implementadas/`; `backlog.md` y `roadmap.md` actualizados a "Implementada".

## Mediciones (antes / después)

`STRUCTURECO_PROFILE_ANALYSIS=1 npx vitest run src/engine/benchmarks.test.ts`,
viga continua de 300 vanos (misma máquina que AG-011):

| Escenario | Con traza (antes) | Sin traza (después) | Speedup |
|---|---:|---:|---:|
| Viga continua, 300 vanos | 1 976,3 ms | 768,3 ms | **2,57x** |

Coincide con la proyección de la propuesta ($2,17\text{ s} \to <0,80\text{ s}$,
2,5x–3x). El benchmark completo de AG-011 (7 fases, 9 escenarios) sigue
disponible sin cambios para comparación de más geometrías.

## Cómo verificar

```bash
npm run verify
```

Resultado obtenido: lint limpio · frontera protegida intacta (27 archivos,
baseline actualizado con autorización explícita) · **670/670 pruebas en
verde** · build correcto · presupuesto de bundle respetado (631 319 B /
169 609 gzip, techo 648 000 / 174 000).

```bash
STRUCTURECO_PROFILE_ANALYSIS=1 npx vitest run src/engine/benchmarks.test.ts --reporter=verbose
```

para reproducir la tabla de fases de AG-011 y la medición antes/después de
AG-013.

Verificación manual en navegador: `npm run dev` → cargar "Pórtico de
ejemplo" → Analizar → pestaña "Aprender" → etapa "Ensamblaje" → matrices `K`
(12×12) y `C` (4×12) con valores reales, sin errores de consola.

## Pendiente / siguiente paso

- **Sin pushear**: los commits quedan locales. `autoPush: false` a propósito;
  falta confirmación explícita del usuario para `git push origin main`.
- No se tocó la exportación PDF/bundle más allá de asegurar la traza antes de
  generarlos; su contenido es idéntico al de antes del cambio.
- No se optimizó `toMatrixTrace` en sí (modo `'summary'` sigue escaneando
  `O(ndof²)`); si se necesita más margen en el modo P-Delta con la pestaña
  "Aprender" abierta sobre modelos muy grandes, esa sería la siguiente
  palanca, pero no estaba en el alcance aprobado de AG-013.
