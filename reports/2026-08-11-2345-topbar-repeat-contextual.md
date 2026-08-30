# TopBar contextual y Repeat táctil

**Fecha:** 2026-08-11 23:45
**Agente:** Codex
**Rama:** main

## Qué cambió

Se rediseñó la TopBar del Workspace como tres grupos Clay visibles: documento, contexto de cálculo y acciones. Caso/combinación, modo, orden y unidades ahora se presentan como controles táctiles con rótulo técnico y jerarquía, en vez de campos aislados; el escenario lleva el acento contextual.

Repeat se convirtió en una acción contextual de canvas con icono, tecla `R`, estado preparado de dos niveles y cancelar discreto. Su composición conserva centrado móvil, estados de foco y movimiento reducido.

Como ajuste final de jerarquía, se retiró el indicador visible `Local` de la TopBar: competía con el nombre del proyecto sin ofrecer una acción. El mismo estado de almacenamiento se mantiene accesible dentro de `Más acciones`.

## Por qué

La solicitud pidió una mejora visual perceptible de TopBar y Repetir sin alterar la lógica estructural. Durante la comprobación visual se detectó que la animación inicial anulaba el centrado del aviso Repeat en móvil; se corrigió antes de cerrar.

## Archivos tocados

- `src/features/topbar/TopBar.tsx` — agrupación semántica y controles contextuales etiquetados.
- `src/styles.css` — superficies Clay, jerarquía de contexto y reglas responsive de TopBar.
- `src/features/canvas/RepeatActionOverlay.tsx` — presentación animada y accesible de Repeat.
- `src/features/canvas/StructuralCanvas.tsx` — conecta el overlay con los callbacks y receta existentes, sin cambiar su lógica.
- `src/features/workspace/phase1.css` — estilos contextualizados de Repeat y reduced motion.
- `src/App.test.tsx`, `src/features/topbar/TopBar.test.tsx` — regresiones de jerarquía y accesibilidad.
- `docs/superpowers/specs/2026-08-11-workspace-topbar-repeat-design.md` — alcance y diseño aprobado.
- `docs/superpowers/plans/2026-08-11-workspace-topbar-repeat.md` — plan de implementación.

## Cómo verificar

- `npx.cmd vitest run src/features/topbar/TopBar.test.tsx src/App.test.tsx --maxWorkers=1`
- `npx.cmd vitest run src/features/space3d/Space3DWorkspace.test.tsx --maxWorkers=1`
- `npm.cmd run verify:protected`
- `npm.cmd run build`
- Revisar las capturas dirigidas en `validation/topbar-repeat-after/` para desktop, tablet, teléfono y ambos temas.

## Pendiente / siguiente paso

Se debe publicar el commit de este reporte junto con el build más reciente en `gh-pages`. El pase paralelo completo de Vitest registró cinco timeouts de `Space3DWorkspace.test.tsx`; el mismo archivo pasó 25/25 con `--maxWorkers=1`, por lo que se mantiene como contención conocida no atribuible a este cambio.
