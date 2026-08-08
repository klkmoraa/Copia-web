# Claymorphism ciclo 2 — tarea 2: arnés de tokens y QA

**Fecha:** 2026-08-07 11:05
**Agente:** Codex
**Rama:** main

## Qué cambió
`tokens.test.ts` incorpora `material.css` al texto de CSS de componentes, por lo que los cuatro controles de higiene y la resolución de tokens cubren el archivo creado en la tarea anterior.

`qa.mjs` incorpora `readClayMaterial(page, selector)`, que lee la cascada real de Chromium, y usa el helper en `.welcome-frame` para asegurar que una superficie clay elevada no tenga `backdrop-filter`.

## Por qué
La tarea 2 cierra el punto ciego estático de `material.css` y proporciona la medición reutilizable que usarán las tareas 4–9. La comprobación de Chromium es necesaria porque jsdom no aplica la cascada CSS.

## Archivos tocados
- `src/design-system/tokens.test.ts` — amplía el contrato CSS a `material.css`.
- `qa.mjs` — añade `readClayMaterial()` y `welcomeFrameHasNoBackdropFilter`.
- `reports/2026-08-07-1052-claymorphism-ciclo2-task2.md` — este reporte de handoff.

## Cómo verificar
- `npx.cmd vitest run src/design-system/tokens.test.ts` — 1 archivo, 21 pruebas verdes.
- `npm.cmd run build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node qa.mjs` — QA Chromium verde, incluido `welcomeFrameHasNoBackdropFilter: true`, sin consola ni errores de página.
- `npm.cmd run lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx.cmd vitest run; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm.cmd run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm.cmd run build` — lint, 97 archivos/737 pruebas, typecheck y build verdes.

La prueba RED temporal añadió `backdrop-filter: blur(4px);` al grupo `raised` de `src/design-system/material.css`; Chromium falló con `welcomeFrameHasNoBackdropFilter`, y el cambio fue revertido antes de la GREEN y no forma parte del commit.

## Pendiente / siguiente paso
El controlador ejecutará de nuevo la suite completa. No hay cambios en rutas protegidas, tokens de glass, dependencias ni `capturas.mjs`; no se hizo push.
