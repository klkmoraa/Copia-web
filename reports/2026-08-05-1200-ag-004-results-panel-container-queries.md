# AG-004: Container Queries, dvh y targets táctiles en ResultsPanel

**Fecha:** 2026-08-05 12:00
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Implementada la propuesta AG-004 (alcance acotado a `ResultsPanel.tsx`), tras validarla contra el código real. Varias premisas del documento ya estaban resueltas de forma más robusta de lo que pedía (token de target táctil, sistema `visualViewport`→CSS var con fallback `dvh`), así que el trabajo real fue más quirúrgico que lo descrito: convertir los `vh` restantes de `.results-panel` a `dvh`, añadir Container Queries para el caso real que las media queries de viewport no cubren (el panel se angosta cuando el inspector ocupa más ancho, no solo en móvil), corregir un bug de especificidad CSS que dejaba dos controles del panel por debajo de 44px táctiles, y hacer que el cálculo de altura/drag-resize de `ResultsPanel.tsx` reutilice el `--sc-visual-viewport-height` que ya mantiene `WorkspaceShell.tsx` en vez de leer `window.innerHeight` crudo.

Se documentó explícitamente qué NO se tocó y por qué (los `matchMedia` de `isMobile`/`isPhone` gobiernan accesibilidad real — modal, trampa de foco, `inert` — no solo layout; eliminarlos habría roto contratos que `qa.mjs` verifica).

## Por qué

Ejecución de la propuesta aprobada `AG-004-sistema-diseno-ux-movil-y-paneles.md` (`Antigravity-propuestas/aprobadas/`), a petición del usuario, con instrucción explícita de validar contra el código real antes de modificar y de no forzar mejoras que impliquen decisiones de arquitectura mayores.

## Archivos tocados

- `src/features/results/ResultsPanel.tsx` — nuevo helper `getViewportHeightPx()` que lee `--sc-visual-viewport-height` (ya publicado por `WorkspaceShell.tsx`) con fallback a `window.innerHeight`; reemplaza los 6 usos post-montaje de `window.innerHeight * 0.4/0.72` en altura inicial, drag-resize, resize por teclado y `aria-valuemax`. No se añadió ningún listener nuevo.
- `src/styles.css` — `.results-panel` ahora es contenedor de Container Queries (`container-type: inline-size`) con una regla `@container results-panel (max-width: 560px)` para el caso "panel angosto por inspector ancho, no por viewport"; conversión de `vh`→`dvh` en las 5 reglas de `.results-panel` que aún usaban `vh`; corrección del bug de especificidad que dejaba `.results-mode-control button` (30px) y `.result-tabs button` (40px) por debajo de 44px en `@media (pointer:coarse)`.
- `Antigravity-propuestas/implementadas/AG-004-sistema-diseno-ux-movil-y-paneles.md` — movido desde `aprobadas/`, estado actualizado a "Implementada", con nota de implementación detallando validación, decisiones y pruebas.
- `Antigravity-propuestas/propuestas/AG-004-sistema-diseno-ux-movil-y-paneles.md` — eliminado (cierre del ciclo de vida propuestas → aprobadas → implementadas; el archivo llevaba ya movido a `aprobadas/` antes de esta sesión).

## Cómo verificar

```bash
npm run verify
npm run qa:webkit
npm run qa
```

`npm run verify` queda en verde (lint, `verify:protected`, 649 tests, build, `verify:perf`). `npm run qa:webkit` y `npm run qa` fallan por un bug **preexistente y no relacionado** en la pantalla de bienvenida (`welcomeStepsReachable` en iPhone/viewports móviles) — confirmado con `git stash` que ya falla en `main` sin estos cambios. Ningún check de `.results-panel`, `.mobile-collapsed`, `.results-mobile-toggle` ni touch targets falló en ninguna de las dos corridas. Se dejó una tarea en segundo plano (chip de sesión) para investigar ese bug por separado.

## Pendiente / siguiente paso

Nada pendiente sobre AG-004. Queda abierto, fuera de este alcance, el bug preexistente de `welcomeStepsReachable` en `qa-webkit.mjs`/`qa.mjs` (pantalla de bienvenida, no ResultsPanel) — flaggeado como tarea separada.
