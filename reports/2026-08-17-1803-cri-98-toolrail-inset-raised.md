# ToolRail único, bandeja INSET con herramientas RAISED (CRI-98)

**Fecha:** 2026-08-17 18:03
**Agente:** Claude Code
**Rama:** claude/toolrail-inset-raised-6e3pxc (integrada a `main` en `cd35d88`)

## Qué cambió

- Se consolidó `ToolRail.tsx`/`ToolBar.tsx` en un único componente real (`ToolRail`), eliminando el alias huérfano de 5 líneas. El componente lee `shellClass` (X2/M1/K0) directamente de `useShellComposition()`; ya no recibe una prop `compact` de compatibilidad desde `WorkspaceShell`.
- La bandeja del riel (`.toolbar`) pasó del grupo `raised` al grupo `inset` en `material.css`. Los overrides de `box-shadow`/`background` en `styles.css` que hacían que la herramienta activa se viera con un acento de color o elevada (en vez de hundida) se limpiaron en tres puntos: reglas base del riel, riel Medium (`.tool-rail.is-compact`) y dock táctil de Compact. Ahora la activa usa la gramática `.sc-tool-button` (`ui.css`): reposo `RAISED`, activo `INSET` sin sombra exterior, en X2, M1 y K0.
- En Medium (icon-only) cada herramienta ya tenía `aria-label` real; se añadió un tooltip local (`RailTooltip`) portado a `document.body` que aparece por foco y no sólo por hover — evita que lo recorte el `overflow-y:auto` propio del riel.
- Verificado sin `matchMedia` propio en el componente (ya lo había eliminado CRI-89; sólo queda una mención textual en un comentario).

## Por qué

Ejecuta CRI-98: el riel debía sentirse como herramientas apoyadas sobre una mesa (bandeja hundida, piezas apoyadas encima, activa que baja) y tomar su forma sólo de la clase resuelta por el shell, sin lógica responsive propia ni alias de compatibilidad.

## Archivos tocados

- `src/features/canvas/ToolRail.tsx` — componente único (antes `ToolBar.tsx` + alias `ToolRail.tsx`); tooltip local por foco.
- `src/features/canvas/ToolBar.tsx` — eliminado.
- `src/features/canvas/ToolRail.test.tsx` — renombrado desde `ToolBar.test.tsx`; pruebas ahora fijan `shellClass` vía `ShellCompositionContext.Provider` en vez de una prop `compact`.
- `src/features/canvas/StructuralToolIcon.tsx` — comentario actualizado (ya no menciona `ToolBar`).
- `src/features/workspace/WorkspaceShell.tsx` — `<ToolRail />` sin prop; import de `isToolRailCompact` retirado (ya no se usa ahí).
- `src/design-system/material.css` — `.toolbar` movida de `raised` a `inset`.
- `src/styles.css` — limpieza de overrides de `.tool-button.active`/`.tool-node.active` que fighting contra la gramática `INSET`; `.tool-rail.is-compact` reescrito a reposo `RAISED`/activo `INSET`; tooltip del riel (`.tool-rail-tooltip*`).

## Cómo verificar

```
npx vitest run src/features/canvas src/design-system   # 229 tests, verde
npm run typecheck                                        # verde
npm run build                                             # verde
npm run lint                                              # verde (sólo warnings preexistentes en ContextualActions.tsx y prototypes/ios-app, no tocados)
```

Verificación visual (Playwright + Chromium local, no commiteada): X2/M1/K0, Día/Noche, tooltip por foco en M1, medición de objetivo táctil en K0 (47–48px), `box-shadow` computado 100% `inset` en la herramienta activa en las tres clases, `reduced-motion` conserva el `box-shadow` y anula `transform`/`transition`.

## Pendiente / siguiente paso

- **Riesgo pre-existente, no de este ticket:** en K0 (viewport ≤1023px), `.workspace` no colapsa a una sola columna de grid en este entorno de prueba — `.toolbar` queda confinado a una columna de 76px en vez de ocupar el ancho completo como dock inferior, y el panel `Inspector` (bottom sheet) lo tapa incluso en el detent "Compacta". Confirmado reproducible de forma idéntica en `origin/main` sin ninguno de los cambios de CRI-98 (se probó con `git stash`), así que es anterior a este ticket y queda fuera de su alcance (toca `.workspace`/`--toolbar-w`, terreno de CRI-89/103/105, no de `ToolRail.tsx`). Documentado para que se abra como ticket aparte.
- Icon-only en Medium sigue siendo **provisional** (ABIERTA-1 sin medir), tal como pide CRI-98 — no se intentó validar si perjudica la discoverability.
