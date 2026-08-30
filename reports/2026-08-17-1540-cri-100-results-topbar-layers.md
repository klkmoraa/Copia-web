# CRI-100 — Results 1/2: estado/fiabilidad al TopBar y evidencia como capas del canvas

**Fecha:** 2026-08-17 15:40 UTC
**Agente:** Claude Code
**Rama:** claude/cri-100-results-topbar-layers-76igbc

## Qué cambió

Primera mitad de la descomposición de D-03: el `topbar` pasa a ser dueño del **estado del análisis y su fiabilidad** (visibles en X2/M1/K0 sin abrir Results), y elegir N/V/M/deformada/mapa pasa de ser una pestaña de `ResultsPanel` a ser una **capa del canvas**, apoyada en la maquinaria ya existente (`CanvasResultLayer`, `editorLayers`, `resultTab`). Ninguna superficie de Results queda residente en ninguna clase: el panel ya no se abre por defecto y sólo se monta cuando el usuario lo pide (lanzador nuevo en `floatingActions`, Command Palette, o el flujo de Aula).

La fiabilidad se muestra como **línea propia**, nunca como color del valor: junto al chip de estado existe ahora un segundo elemento (`.analysis-reliability-line`) con su propio texto y su propia causa gobernante enfocable (Popover con qué/por qué/qué hacer), movida —no duplicada— desde `ResultsPanel`. `stale` sigue derivándose exactamente igual que antes (sin tocar `analysisStatusModel.deriveAnalysisStatus`), así que sigue fail-closed.

Elegir una capa de evidencia nunca muta el proyecto ni llama a `analyze()`: sólo alterna `resultTab` y los booleanos `results`/`heatmap` de `editorLayers`. Verificado en vivo con Playwright: 6 cambios de capa después de un análisis real generaron **0 workers nuevos**.

## Por qué

Contrato de CRI-100 (Linear): la afirmación más crítica del producto (estado + fiabilidad) no puede vivir dentro de un panel que puede estar cerrado, y elegir evidencia no puede seguir siendo "abrir una pestaña" cuando ya existe la maquinaria de capas sobre el lienzo. Bloqueado por CRI-89/94/95 (ya integrados en `main`).

## Archivos tocados

- `src/features/topbar/analysisStatusModel.ts` — nueva `deriveReliabilityPresentation` (usa `resolveReliability`, independiente de `deriveAnalysisStatus`).
- `src/features/topbar/AnalysisStatus.tsx` — línea de fiabilidad propia + causa gobernante enfocable (Popover), memoizado (`React.memo`) para no re-renderizar por cambios ajenos.
- `src/features/topbar/TopBar.tsx` — deja de usar el facade `useProject()`; compone `useProjectModel`/`useProjectAnalysis`/`useWorkspaceUI(theme)` para no acoplar el estado/fiabilidad a `resultTab`/selección/cursor; `onOpenModelDoctor` estabilizado con `useCallback`.
- `src/features/results/ResultsPanel.tsx` — retira el `<small>` de estado y el Popover de causa gobernante (ahora en TopBar); ya no había `matchMedia` propio (confirmado, herencia de CRI-89/94).
- `src/features/canvas/evidenceLayers.ts` **(nuevo)** — fuente única de las 5 capas de evidencia (N/V/M/deformada/mapa) y su lógica de selección/activación sobre `resultTab` + `editorLayers`, sin sistema paralelo.
- `src/features/canvas/CanvasLayers.tsx` — nueva sección "Evidencia" dentro del panel de capas existente (siempre accesible en el chrome del canvas, no dentro de Results).
- `src/features/canvas/CanvasChrome.tsx`, `src/features/canvas/StructuralCanvas.tsx` — pasan `resultTab`/`setResultTab` hasta `CanvasLayers`.
- `src/features/workspace/CommandPalette.tsx` — separa comandos de panel (resumen/reacciones/influencia/aprender, siguen abriendo Results) de comandos de capa de evidencia (N/V/M/deformada/mapa, ya no abren el panel).
- `src/features/workspace/WorkspaceShell.tsx` — `initialOpen` ya no incluye `'results'`; se retira el `openSurface('results')` automático al salir de pantalla completa; nuevo lanzador "Resultados" en `floatingActions` para abrir el panel bajo demanda.
- `src/i18n/catalogs.ts` — claves nuevas ES/EN: `reliability.lineLabel/levelReliable/levelLimited/levelUnreliable/levelUnavailable`, `canvas.evidenceLayers`, `palette.toggleEvidenceLayer`.
- `src/styles.css` — estilos de `.analysis-reliability-line` (degradación icon-only bajo 1500px, igual que el chip de estado) y `.canvas-evidence-layers`.
- Tests actualizados/migrados: `AnalysisStatus.test.tsx` (causa gobernante movida desde `ResultsPanel.test.tsx`), `ResultsPanel.test.tsx`, `CanvasLayers.test.tsx`, `CanvasChrome.test.tsx`, `CommandPalette.test.tsx`.

**No tocado (a propósito):** `src/store/ProjectContext.tsx` (frontera protegida — se evaluó separar `resultCursor` a un contexto propio pero se revirtió: la mitigación final contra rerenders del TopBar es memoización, no tocar el archivo protegido), solver/engine/model/schema, Datasheet, `structureCo.results.mode.v1` (se deja intacta, sin migración), `InfluenceLineView` (sigue lazy con su precarga por hover/foco), `results.learn`/Aula.

## Cómo verificar

```
npx vitest run src/features/results src/features/topbar src/features/canvas src/education   # 43/43 archivos, 287 passed / 3 skipped
npm run typecheck        # limpio
npm run verify:protected # 38 archivos protegidos intactos
npm run qa:topbar         # pasa en todo el barrido de anchos (360px–1920px), Estado/Doctor nunca degradan
npm run build              # ok
npm run lint                # sin errores (mismos warnings preexistentes en ContextualActions.tsx / prototypes)
```

Prueba de interacción (Playwright, ad hoc): con un análisis real corrido una vez, 6 cambios de capa de evidencia (Axial/Cortante/Momento/Deformada/Mapa/Axial) generaron 0 workers nuevos; en X2/M1/K0 el estado y la fiabilidad del TopBar son visibles sin que `[data-workspace-surface="results"]` esté activo en ningún momento; tras editar el modelo (nuevo caso de carga) sin re-analizar, el TopBar muestra `data-analysis-status="stale"`.

Nota conocida, preexistente (no introducida por CRI-100): el popover "Capas de información" se solapa visualmente con otro chrome flotante en K0 (390px) — reproducido igual en `main` sin estos cambios (el popover ya se solapaba con el panel de Results, que antes era residente).

## Pendiente / siguiente paso

Nada pendiente para CRI-100. Explícitamente fuera de alcance (Results 2/2, issue propia): tarjetas de resumen/extremos/procedencia/reacciones, superficie `dense` (reacciones/influencia/aprender), cardificar Datasheet.
