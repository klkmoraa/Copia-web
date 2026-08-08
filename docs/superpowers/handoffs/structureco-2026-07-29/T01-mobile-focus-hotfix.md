# T01 — Hotfix de foco móvil de Inspector

**Estado inicial:** `NOT_STARTED`. **Base:** `0071688`. **Puede ejecutarse en paralelo:** T02, T03 y T04. **No puede ejecutarse junto con:** T05.

## Objetivo

Eliminar el launcher de Inspector cubierto del orden de foco cuando Resultados está abierto en teléfono, sin convertir Resultados en modal ni alterar canvas, selección o dominio.

## Alcance permitido

- `src/components/ResultsPanel.tsx`, `src/components/WorkspaceShell.tsx`, `src/styles.css`.
- `src/components/ResultsPanel.test.tsx`, pruebas del shell y `qa-phase11.mjs`/`qa-phase14.mjs` si hacen falta para cubrir el defecto.

## Fuera de alcance

`src/engine/**`, `src/workers/**`, `src/data/**`, `ProjectContext.tsx`, `types.ts`, `StructuralCanvas.tsx`, resultados matemáticos, persistencia, unidades, historial y topología.

## Pasos

1. Crear `fix/mobile-inspector-focus` desde `0071688` en worktree propio; registrar `IN_PROGRESS` en STATUS.
2. Añadir una prueba que abra Resultados a 390 px y pruebe que el launcher `.mobile-inspector-toggle` no es tabbable, no recibe hit testing y no puede abrir Inspector mientras esté cubierto.
3. Aplicar el estado de inaccesibilidad sólo cuando `isPhone && mobileExpanded`; al cerrar Resultados restaurar nombre accesible, foco y comportamiento previo.
4. Confirmar que el inspector sigue disponible cuando Resultados está cerrado y que Escape devuelve foco al launcher de Resultados.
5. Ejecutar:

```powershell
npm.cmd test -- src/components/ResultsPanel.test.tsx
npm.cmd run build
node qa-phase11.mjs
$env:PHASE14_VIEWPORT='mobile'; node qa-phase14.mjs
```

6. Revisar que el diff no toca rutas protegidas, crear un commit `fix(a11y): hide covered mobile inspector launcher`, actualizar STATUS a `COMPLETE` y dejar handoff con los cuatro resultados.

## Criterio de aceptación

En 390 y 430 px, Tab/Shift+Tab sólo alcanzan controles visibles; Inspector no puede abrirse desde un launcher cubierto; canvas, pan, pinch, Resultados, Escape y retorno de foco continúan operables.
