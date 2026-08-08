# Confiabilidad del motor matemático — 0.8.2

**Fecha:** 2026-08-02 21:10
**Agente:** Claude Code
**Rama:** main

## Qué cambió

El motor ya no trata `success === true` como sinónimo de resultado confiable.
Cada análisis publica ahora una clasificación (`reliable`, `limited`,
`unreliable`, `failed`) derivada de diez comprobaciones numéricas independientes,
y esa clasificación gobierna qué resultados pueden alimentar envolventes y líneas
de influencia.

Además se corrigieron tres defectos comprobados: un salto concentrado podía
aplicarse dos veces y corromper el diagrama completo aguas abajo de la carga; los
escenarios que fallaban desaparecían en silencio de la lista y de las envolventes;
y el error de ajuste de las líneas de influencia se calculaba pero nunca se
aplicaba.

## Por qué

Fase de mejora del motor solicitada por el usuario para 0.8.2, concentrada
únicamente en la confiabilidad de los resultados estructurales. El detalle
completo —reproducción de cada defecto, umbrales elegidos y riesgos pendientes—
está en `docs/motor-matematico/CONTEXTO-MEJORA-MOTOR-0.8.2.md`, escrito para que
Codex retome el trabajo sin releer el código.

## Archivos tocados

- `src/engine/reliability.ts` — **nuevo**: clasificación de confiabilidad, diez
  comprobaciones con umbral doble y regla de valores faltantes.
- `src/types.ts` — tipos `ReliabilityLevel`/`ReliabilityCheck`/`ResultReliability`,
  `AnalysisResult.reliability`, cierre `N-V-M` en `MemberResult`.
- `src/engine/solver.ts` — almacena el cierre `N-V-M`, unifica las salidas
  tempranas y clasifica todo resultado antes de publicarlo.
- `src/engine/diagram.ts` — cada acción concentrada se asigna a una sola frontera
  de tramo; se elimina la doble aplicación de saltos.
- `src/engine/envelope.ts` — devuelve todos los escenarios con su estado y causa;
  `selectEnvelopeScenarios`, cobertura de envolvente y evaluación por lado.
- `src/engine/resultSummary.ts` — cobertura en reacciones y deformadas, `side` en
  los extremos exactos, evaluación por lado.
- `src/engine/influence.ts` — validación del ajuste, subdivisión y rechazo con
  `InfluenceFitError`; aborta ante análisis de carga unitaria no confiables.
- `src/engine/{reliability,discontinuity,scenarioCoverage,influenceFit}.test.ts` —
  **nuevas**, 25 pruebas.
- `src/engine/{performance,resultSummary}.test.ts` — fixtures de `AnalysisScenario`.
- `src/features/results/{ResultSummary,ResultsPanel}.tsx` — cuentan escenarios
  resueltos desde la cobertura de la envolvente; sin cambios de marcado ni estilos.
- `docs/MATHEMATICAL_SPEC.md`, `docs/LIMITATIONS.md` — solo lo relacionado.
- `docs/motor-matematico/CONTEXTO-MEJORA-MOTOR-0.8.2.md` — **nuevo**, contexto para Codex.
- `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` — regenerado (cambio autorizado).
- `package.json`, `package-lock.json` — versión 0.8.2.

## Cómo verificar

```bash
npm run typecheck && npm run lint && npm run verify:protected && npm test && npm run build
```

Resultado obtenido: typecheck sin errores, oxlint sin hallazgos, frontera
protegida intacta, **82 archivos / 555 pruebas en verde** (línea base 78/530) y
build correcto.

Para ver los defectos aislados:

```bash
npx vitest run src/engine/discontinuity.test.ts src/engine/scenarioCoverage.test.ts src/engine/influenceFit.test.ts src/engine/reliability.test.ts
```

## Pendiente / siguiente paso

- La UI todavía no muestra el nivel de confiabilidad ni la causa de un escenario
  excluido más allá de un `title`; es trabajo de diseño, fuera del alcance.
- El cursor de envolvente sigue leyendo un solo lado aunque el motor ya acepta
  `side`.
- `AnalysisResult.reliability` es opcional por compatibilidad: usar siempre
  `resolveReliability(result)`.
- Los riesgos completos están en `docs/motor-matematico/CONTEXTO-MEJORA-MOTOR-0.8.2.md` §7.
- **No se hizo push**: la sesión trabajó solo con commits locales por indicación
  del usuario.
