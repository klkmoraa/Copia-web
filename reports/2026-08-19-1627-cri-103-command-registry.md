# CRI-103 — Registro único de comandos (paleta, botones, atajos)

**Fecha:** 2026-08-19 16:27
**Agente:** Claude Code
**Rama:** claude/cri-103-command-registry-o51brr

## Qué cambió

Se creó `src/features/workspace/commandRegistry.ts`: fuente única para cada comando
del workspace (`commandId`, etiqueta i18n, categoría, atajo mostrado, predicado de
habilitado, ejecución). `CommandPalette.tsx` dejó de construir su propia lista de
`PaletteCommand[]` en línea — ahora llama a `buildCommands(ctx)` y proyecta el
resultado. Las herramientas del lienzo se derivan de `TOOL_REGISTRY`, sin duplicarlo.

Se corrigieron dos huecos de teclado marcados como riesgo en la issue:
1. Los atajos de una sola letra del lienzo (herramientas V/H/N/M/S/P/D/O/C/X/B y
   "repetir") ahora sólo se disparan cuando el foco está dentro del contenedor del
   lienzo (`hostRef`), no en cualquier parte de `window`. Antes, el filtro sólo
   excluía elementos "interactivos" (`input`, `button`, etc.), así que una tecla
   suelta con el foco en `document.body` — justo donde un lector de pantalla en
   modo navegación rápida deja el foco — disparaba una herramienta.
2. Se añadió el atajo global `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` (antes la Paleta mostraba
   "Ctrl Z"/"Ctrl Y" como pista, pero no existía ningún listener real en la app).
   Se implementó en `WorkspaceShell.tsx`, acotado con `isOwnHistoryScope()`
   (exportado desde `commandRegistry.ts`) para que nunca dispare con el foco en un
   campo de texto, `[contenteditable]`, la rejilla del Datasheet (`role="grid"`) o
   cualquier superficie modal (`[aria-modal="true"]`).

## Por qué

CRI-103 (Linear) pedía cerrar el hallazgo de `02-ux-direction-record.md` §6.9: no
existía ningún `CommandRegistry` real — la Paleta reconstruía su propia lista, y la
coherencia entre botón/paleta/atajo era por convención, no por construcción. El
riesgo más señalado en la issue era exactamente G-01: `Ctrl+Z` global invadiendo el
Datasheet y perdiendo una edición de modelo por accidente, y los atajos de letra
compitiendo con la navegación rápida de lectores de pantalla.

## Archivos tocados

- `src/features/workspace/commandRegistry.ts` — nuevo. Registro único: comandos
  estáticos (analizar, undo/redo, Model Doctor, datasheet, generador, vista
  fit/grid/snap/tema, export json/svg/png/print), comandos derivados de
  `TOOL_REGISTRY`, y comandos generados desde datos del proyecto (presets de capa,
  pestañas de resultados, capas de evidencia, navegación a nodo/miembro). Exporta
  `isOwnHistoryScope()`.
- `src/features/workspace/commandRegistry.test.ts` — nuevo. Prueba unitaria de
  `isOwnHistoryScope` contra input/textarea/contenteditable/`role=grid`/
  `aria-modal` vs. el lienzo — es la evidencia directa del criterio "Ctrl+Z en el
  Datasheet no dispara el undo global".
- `src/features/workspace/CommandPalette.tsx` — reescrito para proyectar
  `buildCommands(ctx)` en vez de construir `PaletteCommand[]` a mano. Comportamiento
  observable sin cambios (mismos tests existentes en `CommandPalette.test.tsx`
  pasan sin tocarlos).
- `src/features/workspace/WorkspaceShell.tsx` — nuevo efecto de teclado para
  `Ctrl/Cmd+Z`/`Ctrl/Cmd+Y`, acotado con `isOwnHistoryScope`.
- `src/features/canvas/StructuralCanvas.tsx` — el listener de teclado del lienzo
  ahora exige `hostRef.current.contains(document.activeElement)` antes de disparar
  el atajo de "repetir" (`r`) o cualquier atajo de herramienta de una letra.

## Alcance deliberadamente no tocado

- No se movieron a `commandRegistry` los botones de `TopBar.tsx` (undo/redo,
  Model Doctor, datasheet, exportar, tema): siguen leyendo `canUndo`/`canRedo`/
  `undo`/`redo`/etc. directamente de `useProjectModel()`/`useProjectAnalysis()` —
  el mismo store que alimenta `commandRegistry`, así que el estado "habilitado" se
  calcula una sola vez en la app (el reducer de historial), no dos veces de forma
  independiente. Refactorizar ese archivo (600+ líneas, con tres menús propios) para
  que importe literalmente el registro se evaluó como riesgo desproporcionado frente
  al beneficio, dado el aviso explícito de la propia issue sobre "alcance
  desbordado". Es la decisión de alcance más discutible del slice — documentada
  aquí para que quede a la vista.
- `view:grid` / `view:snap` (togglable sólo desde la Paleta hoy, sin botón
  equivalente en `CanvasChrome.tsx`) se incluyeron en el registro pero no se les
  creó un botón nuevo — no entra en el slice añadir superficies nuevas.
- Navegación a nodo/miembro se queda fuera del registro (es dato del proyecto, no
  un comando con `commandId` fijo ni atajo).
- No se tocó ningún solver/modelo/esquema. `verify:protected` confirma 38 archivos
  protegidos intactos.

## Cómo verificar

```
npx vitest run src/features/workspace src/features/canvas   # 39 files / 239 tests OK
npm run typecheck                                            # OK
npm run verify:protected                                     # 38 archivos, intacto
npm run lint                                                 # 0 errores (mismos 4 warnings preexistentes, en archivos no tocados)
npm run build                                                # OK
QA_LOCAL_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run qa:topbar   # OK (el channel "chrome" por defecto no existe en este contenedor)
```

Prueba de interacción manual sugerida: abrir la Paleta (`Ctrl/Cmd+K`), comparar
"Deshacer"/"Rehacer" (etiqueta + `Ctrl Z`/`Ctrl Y`) contra los botones de historial
del TopBar; enfocar una celda del Datasheet y pulsar `Ctrl+Z` (no debe deshacer
nada de modelo); enfocar cualquier elemento fuera del lienzo y pulsar `n`/`v`/`m`
(no debe cambiar de herramienta); enfocar el lienzo y repetir (sí debe cambiar).

## Pendiente / siguiente paso

Nada pendiente para CRI-103. Si se quiere ir más allá del alcance de este slice,
el siguiente candidato natural sería migrar los botones de `TopBar.tsx` a leer
literalmente del registro (hoy comparten los mismos valores de estado pero no el
mismo objeto `CommandListItem`) — eso quedaría mejor como su propia issue pequeña,
no como parte de CRI-103.
