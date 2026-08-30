# CRI-101 — Results 2/2: tarjetas de extremos, detalle y procedencia, y la superficie `dense` invocada

**Fecha:** 2026-08-17 16:50 UTC
**Agente:** Claude Code
**Rama:** claude/cri-101-results-cards-dense-n6wpjp
**Base:** `061d6e358a7797bf29ae56ca33fa378929e8d36d` (CRI-100 integrado)

## Qué cambió

Segunda y última mitad de D-03. Dos movimientos:

**1 · Los extremos, el detalle y la procedencia pasan a tarjeta Clay `RAISED`.** Nueva pieza única
`ResultExtremeCard` (memoizada) que conserva **a la vez** los cinco que cardificar suele costar:
valor, unidad, posición, fiabilidad y procedencia cuando la magnitud es expresable como
`ResultRef`. La usa el resumen global (N/V/M absolutos + desplazamiento v), la tabla de reacciones
(Rx/Ry/Mz máximas) y las lecturas de extremo de los diagramas y de la deformada. La fiabilidad es
**línea propia en texto** (`Fiabilidad · Confiable/Limitada/No confiable`), nunca color sobre el
número: en escala de grises se sigue leyendo. La materia es `raised` **siempre**, para cualquier
valor — no hay prop, clase ni regla CSS que dependa del signo o de un umbral.

`ProvenanceCard` gana nivel: `raised` cuando es la tarjeta del panel, `flat` cuando vive dentro de
otra tarjeta (el contenido de un `RAISED` es `BASE`/`INSET`, nunca otra tarjeta).
`NumericQualityCard` y `ElasticDemandCard` dejan de pintar su propia materia y pasan a
`data-level="raised"`: la calidad numérica ya no tiñe el fondo de la tarjeta según el estado, se
lee en su texto y en su píldora.

**2 · Reacciones, influencia y «Entender» dejan de ser residentes.** Nueva superficie `dense` con
dueño propio (`DenseResultsSurface`), registrada en el broker: `drawer` en X2/M1, `fullscreen` en
K0, compatible con `peek` por ser modal en las tres. Se **invoca** (comando `open-dense-results`,
que lleva su lanzador dentro para que el broker devuelva el foco al cerrar) y **no existe en el
árbol** hasta que alguien la pide. `InfluenceLineView` sigue `lazy` y sigue precargándose por
hover/foco; el chunk de la propia superficie también se precarga desde el lanzador.

Dentro de una tarjeta con tabla, **la tabla va plana**: la regla vive en `material.css`, así que
vale para cualquier tarjeta futura, no sólo para éstas. Sin sombra, sin segundo borde alrededor del
scroll, sin celdas redondeadas, sin check por fila.

De paso, y sin ampliar el rediseño: el motivo de fallo de un escenario en la comparación vivía
**sólo en `title`** —invisible para teclado, lectores de pantalla y táctil—; ahora es texto de la
propia tarjeta.

## Por qué

Contrato de CRI-101 en Linear y las cinco guardas de V-10. La decisión que gobierna el slice es la
que **no** se tomó: no se cardificó la rejilla del Datasheet ni ninguna tabla densa por posición
(reabriría D-11 y D-03), y no se convirtió cada dato en tarjeta — sólo los extremos, que son los
que merecen destacarse.

## Archivos tocados

- `src/features/results/ResultExtremeCard.tsx` **(nuevo)** — la tarjeta de extremo/detalle, memoizada.
- `src/features/results/denseResults.ts` **(nuevo)** — tipo de vista densa y las dos precargas (superficie e influencia).
- `src/features/results/DenseResultsSurface.tsx` **(nuevo)** — la superficie invocada y su conmutador de vistas (teclado incluido).
- `src/features/results/ReactionsView.tsx` **(nuevo)** — reacciones: extremos en tarjeta + tabla plana enmarcada.
- `src/features/results/LearnView.tsx` **(nuevo)** — «Entender» movido tal cual desde `ResultsPanel` (explorador del método, sustitución numérica, niveles pedagógicos, procedimiento).
- `src/features/results/ResultsPanel.tsx` — pierde tres pestañas y ~200 líneas de vistas densas; gana los lanzadores de `dense`; sus extremos de diagrama y deformada pasan a tarjeta.
- `src/features/results/ResultSummary.tsx` — extremos en tarjetas memoizadas derivadas del análisis (nunca del cursor); tabla de detalle enmarcada en tarjeta; motivo de fallo accesible.
- `src/features/results/ProvenanceCard.tsx` — prop `level` (`raised`/`flat`).
- `src/features/results/NumericQualityCard.tsx`, `ElasticDemandCard.tsx` — materia por `data-level`.
- `src/features/results/reliabilityCopy.ts` — `reliabilityLevelLabelKey` como fuente única (la usaba `AnalysisStatus` en local).
- `src/features/topbar/AnalysisStatus.tsx` — consume esa fuente única.
- `src/features/workspace/surfacePresentation.ts` — nueva `SurfaceId` `dense` y su fila en la tabla de presentación.
- `src/features/workspace/workspaceCommands.ts` — comando `open-dense-results` (vista + lanzador).
- `src/features/workspace/WorkspaceShell.tsx` — monta `dense` lazy y sólo mientras el broker la retiene.
- `src/design-system/material.css` — BASE de una tabla dentro de una tarjeta.
- `src/styles.css` — tarjetas de extremo, tarjeta-marco de tabla, lanzadores y superficie densa; se retira `.global-extrema-grid` (sustituida).
- `src/i18n/catalogs.ts` — claves ES/EN nuevas (`results.cardPosition`, `cardLocate`, `dense*`, `scenarioUnsolved`, `signGlobalX`, `signGlobalRotation`).
- Tests: `ResultExtremeCard`/copy prohibido (`resultCardContracts.test.tsx`, nuevo), `DenseResultsSurface.test.tsx` (nuevo), `ResultsPanel.test.tsx` (actualizado), `surfacePresentation.test.ts` (`dense` + `peek`).
- `scripts/qa-results-cards.mjs` **(nuevo)** — evidencia sobre la app construida.
- `scripts/qa-shell-composition.mjs` — mide la fila densa abriendo `dense` (reacciones ya no es pestaña).

**No tocado (a propósito):** solver/engine/model/schema y la frontera protegida (`ProjectContext.tsx`,
`types.ts`, `src/engine`, `src/workers`, `src/data`); tokens y HEX de color; Datasheet (verificado
intacto y **sin cardificar**); Aula (mismas vistas, mismo análisis, sólo invocadas);
`InfluenceLineView` (sigue lazy con precarga); CRI-102 y CRI-105.

## Cómo verificar

```
npx vitest run src/features/results src/education   # 14 archivos · 113 passed / 3 skipped
npm run typecheck                                   # limpio
npm run verify:protected                            # 38 archivos protegidos intactos
npm run build                                       # ok (DenseResultsSurface e InfluenceLineView en chunks propios)
npm run lint                                        # sin errores (4 warnings preexistentes: ContextualActions.tsx, prototypes/)
npx vitest run src/features/workspace               # 11 archivos · 76 passed (comprobación extra, no gate)
npm run build && node scripts/qa-results-cards.mjs  # evidencia visual y de interacción: TODO OK
```

Evidencia en `reports/evidence/2026-08-17-cri-101-results-cards-dense/` (capturas + `qa-results-cards.json`):
tarjeta de extremo completa Día/Noche, procedencia desplegada, favorable vs desfavorable con la
materia **medida** idéntica (fondo, borde, sombra y color del número), escala de grises, tabla BASE
dentro de tarjeta RAISED, `dense` en X2/M1/K0 y K0 landscape con retorno de foco por teclado,
EN en Compact sin desbordes, y el Datasheet sin cardificar.

## Nota conocida, preexistente (no introducida por CRI-101)

Con el panel de Results abierto en K0 (390px), la columna del workspace se comprime a ~76px.
Reproducido idéntico sobre `main` en `061d6e3` con el mismo recorrido:
`k0-panel-squeeze-PREEXISTS-on-main-061d6e3.png` vs `k0-panel-squeeze-same-with-cri-101.png`.
Es composición del shell/lanzadores en K0, ajeno a este slice; la superficie `dense` sí se presenta
correctamente a pantalla completa en esa misma clase. Los lanzadores flotantes de K0 también se
solapan entre sí (por eso el QA los activa por teclado). Ambas cosas piden issue propia.

## Pendiente / siguiente paso

Nada pendiente para CRI-101. Fuera de alcance a propósito: CRI-102, CRI-105, la petición abierta
hacia CRI-12D de cardificar el Datasheet (**no se ejecuta**), y el arreglo del K0 descrito arriba.
