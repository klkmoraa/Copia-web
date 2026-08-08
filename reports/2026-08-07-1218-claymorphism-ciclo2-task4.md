# Claymorphism ciclo 2 — tarea 4: `TopBar` de vidrio a arcilla

**Fecha:** 2026-08-07 12:18
**Agente:** Codex
**Rama:** main
**Base:** `9e19f44`

## Qué cambió

La `.topbar` se añadió al grupo semántico `raised` de `material.css`, que se importa de forma eager desde `App.tsx`. Su gradiente, canto y sombra ahora proceden del contrato clay compartido desde el primer pintado del workspace.

Se retiraron de `styles.css` la materia local, el desenfoque de vidrio, el borde inferior duplicado, el override AG-015 tardío y las dos excepciones de transparencia reducida de `.topbar`. Se añadió a `qa.mjs` una comprobación Chromium de estilos computados que exige ausencia de `backdrop-filter` y presencia de sombra clay con capas `inset`.

## Por qué

La barra superior era el primer consumidor real del workspace que debía abandonar `--sc-surface-glass-strong` y `blur(18px)` para consumir el material clay eager creado en las tareas anteriores, sin cambiar layout, comportamiento ni contratos estructurales.

## Archivos tocados

- `qa.mjs` — añade y conecta `verifyTopbarClayMaterial` mediante `readClayMaterial`.
- `src/design-system/material.css` — incorpora `.topbar` al grupo `raised`.
- `src/styles.css` — deja en `.topbar` solo forma/layout y retira sus overrides de vidrio/transparencia reducida.
- `reports/2026-08-07-1218-claymorphism-ciclo2-task4.md` — este reporte de cambio.
- `.superpowers/sdd/2026-08-07-claymorphism-ciclo2/task-4-report.md` — evidencia SDD ignorada para revisión del controlador.

## Cómo verificar

- Guardián previo: `main` en `9e19f44`, `structureco@0.8.2`, respaldo local con hashes y `npm.cmd run verify:protected` verde (29 archivos).
- RED con CSS intacto: `npm.cmd run build` pasó; `node qa.mjs` salió 1 con `topbarHasNoBackdropFilter` y `topbarHasClayShadow`.
- GREEN tras el CSS: build verde; la corrida final limpia de `node qa.mjs` salió 0 con ambos checks `true`, sin errores de consola o página.
- Mutación: un `backdrop-filter: blur(4px)` temporal hizo fallar `topbarHasNoBackdropFilter`; se retiró y `material.css` recuperó exactamente el SHA-256 previo `F67D6E1DF4765487A0D94692C8DBC0958120965B6EE65C96B9070B20C000B0C9`.
- `npx.cmd vitest run src/design-system/tokens.test.ts` — 22/22 pruebas verdes.
- `npm.cmd run verify:protected` — 29 archivos protegidos verificados.
- `git diff --check`, escaneo de dependencias y escaneo de rutas protegidas — limpios.

## Pendiente / siguiente paso

El controlador debe realizar la revisión visual Day/Night y ejecutar una verificación completa y un QA fresco después del review. No se lanzó dev server, navegador interactivo, WebKit ni suite completa en esta tarea.

Concern no bloqueante: durante repeticiones de `qa.mjs`, el check preexistente `welcomeimportCardActiveTransformIsPressedTranslate` mostró una carrera de frame (`0.999925` frente a `1` exacto); no se alteró por estar fuera de alcance y la corrida final limpia pasó. No se hizo push.

## Cierre del controlador (2026-08-07 12:50)

- Revisión independiente: APPROVED, sin Critical ni Important. Minor diferido a la Tarea 9: endurecer el check para medir gradiente, canto, capas y `-webkit-backdrop-filter`.
- Playwright real, 1536×960, Day/Night: `.topbar` mantiene 68 px de alto, gradiente clay, canto de 1 px en las cuatro aristas, dos capas `inset`, `backdrop-filter: none`, consola y errores de página vacíos. Evidencia local: `task-4-topbar-light.png` y `task-4-topbar-dark.png`.
- Pipeline funcional equivalente: lint, frontera protegida 29/29, Vitest 738/738 con timeout diagnóstico de 15 s, build y presupuesto 665236/670000 bytes y 178357/179500 gzip.
- `npm.cmd run verify` estricto agotó 5 s únicamente en `shows the N–V–M cursor and learning levels`; la ejecución enfocada con 15 s completó todas las aserciones en 5.70 s. El diff de esta tarea no participa en ese test (solo QA/CSS, y Vitest no carga CSS). Se difiere estabilizar el presupuesto del arnés a la Tarea 10.
- `npm.cmd run qa` mostró la carrera de muestreo `:active` ya diagnosticada; dos ejecuciones directas consecutivas posteriores pasaron toda la matriz, incluidos `topbarHasNoBackdropFilter` y `topbarHasClayShadow`, con consola/página limpias. La estabilización del muestreo queda para la certificación final.

La tarea queda cerrada visual y funcionalmente; no se hizo push.