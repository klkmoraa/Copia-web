# Model Doctor integrado en el workspace

**Fecha:** 2026-08-12 20:38
**Agente:** Codex
**Rama:** main

## Qué cambió

Model Doctor reemplaza a Buscar comandos en la TopBar. Buscar comandos quedó dentro del grupo Navegar de la barra izquierda y conserva el acceso `Ctrl/Cmd + K`, también en la variante móvil. Se retiró Avisos como pestaña y como opción independiente de la paleta.

El workspace calcula el diagnóstico con el módulo existente y publica un `ToastNotification` cuando encuentra un diagnóstico con problemas distinto al último observado para el proyecto. El toast invita a abrir Model Doctor y la firma estable de los hallazgos evita repetirlo mientras el diagnóstico no cambie.

## Por qué

El usuario solicitó convertir Model Doctor en el acceso principal de diagnóstico, conservar la búsqueda de comandos como herramienta de navegación y evitar dos superficies distintas para avisos. También pidió una señal no intrusiva para problemas nuevos sin spam, manteniendo intactos solver, matemáticas, esquema y persistencia.

## Archivos tocados

- `src/features/topbar/TopBar.tsx` y `TopBar.test.tsx` — launcher principal de Model Doctor y cobertura del nuevo contrato.
- `src/features/topbar/AnalysisStatus.tsx` y `AnalysisStatus.test.tsx` — el estado de análisis abre Model Doctor en lugar de Avisos.
- `src/features/canvas/ToolBar.tsx` y `ToolBar.test.tsx` — Buscar comandos en el grupo Navegar, con variantes desktop/compacta/móvil y retorno de foco.
- `src/features/workspace/CommandPalette.tsx` y `CommandPalette.test.tsx` — retiro de Avisos de los destinos independientes.
- `src/features/workspace/WorkspaceShell.tsx` — diagnóstico diferido y deduplicación del toast mediante el sistema existente.
- `src/features/workspace/workspaceCommands.ts` — documentación del emisor de la paleta actualizada a ToolRail/atajo.
- `src/features/results/ResultsPanel.tsx` y `ResultsPanel.test.tsx` — retiro de la pestaña Avisos y redirección de fallos hacia Model Doctor.
- `src/App.test.tsx` — cobertura integrada de launchers, `Ctrl/Cmd + K`, toast nuevo y ausencia de spam.
- `src/i18n/catalogs.ts` — textos accesibles y mensajes del toast en español e inglés.
- `scripts/qa-model-doctor.mjs` — QA real adaptado al launcher directo de desktop y al fallback móvil.

## Cómo verificar

- `npm.cmd test -- src/features/topbar/AnalysisStatus.test.tsx src/features/topbar/TopBar.test.tsx src/features/canvas/ToolBar.test.tsx --maxWorkers=1` — 26/26 tests.
- `npm.cmd test -- src/features/topbar/TopBar.test.tsx src/features/canvas/ToolBar.test.tsx src/features/results/ResultsPanel.test.tsx src/features/workspace/CommandPalette.test.tsx src/App.test.tsx --maxWorkers=1` — 76/76 tests, 3 omitidos.
- `npm.cmd test -- --maxWorkers=1` — suite completa: 151/151 archivos, 1200 tests pasaron, 8 omitidos.
- `npm.cmd run typecheck` — pasa.
- `npm.cmd run lint` — pasa con dos advertencias preexistentes de Fast Refresh en `prototypes/ios-app/src/components/Structure.tsx`.
- `npm.cmd run verify:docs` — 20 documentos clasificados, obligatorios y enlaces válidos.
- `npm.cmd run verify:protected` — 29 archivos protegidos intactos.
- `npm.cmd run build` — pasa.
- `npm.cmd run verify:perf` — 784089 bytes / 204843 gzip, sin techo bloqueante.
- `npm.cmd run qa:topbar` — geometría real pasa en 1024–1920 px, casos de breakpoint ±1 y barrido continuo 1024–1600 px.
- `npm.cmd run qa:model-doctor` — pasa desktop/móvil, seis viewports/zoom, safe area, scroll, touch targets, contraste Day/Night, teclado/foco y movimiento reducido.
- `npm.cmd run qa` — todos los checks Chromium verdaderos, sin errores de consola ni de página.
- `node qa-webkit.mjs` — pasa en iPhone 13 e iPad Pro 11, sin errores. La primera ejecución tuvo un fallo transitorio de importación de módulo en iPad; la reproducción directa sobre el mismo `dist` pasó completa.

La ejecución paralela `npm.cmd test` presentó 16 fallos por contención (14 timeouts y una carrera visible en el resumen); los cuatro archivos implicados pasaron aislados 102/102 y la suite completa serial pasó 1200/1200 ejecutados. No se ampliaron timeouts ni se modificaron módulos ajenos.

## Pendiente / siguiente paso

Se añadieron las clasificaciones y avisos históricos mínimos a los cinco planes/specs preexistentes que bloqueaban `verify:docs`; no se reescribió su contenido histórico.

El usuario autorizó continuar hasta cerrar gates, crear el commit, publicar `main` y actualizar GitHub Pages.
