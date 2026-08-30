# CRI-81 · Base del datasheet estructural (fase 1 de CRI-41)

**Fecha:** 2026-08-14 00:10
**Agente:** Claude Code
**Rama:** `feature/cri-41-structural-datasheet`

## Qué cambió

Primera versión usable del **datasheet estructural**: una hoja de datos de Nodos
y Barras con búsqueda, orden, filtros por faceta, unidades visibles, selección
sincronizada con el lienzo y un panel contextual con previews de Nodo, Apoyo,
Material, Sección y Carga. Se abre como Drawer modal desde la barra superior y
la paleta de comandos.

**Es de sólo lectura y no duplica estado**: las filas son una proyección pura de
`ProjectModel`, la selección es la del workspace (`useWorkspaceUI`), y no hay
store, historial ni undo propios del datasheet. La editabilidad de cada columna
ya está tipada (`identity` / `derived` / `pending`) para que CRI-82 abra
exactamente las celdas `pending`.

## Por qué

CRI-41 necesita una superficie para auditar el modelo entero, que hoy sólo se
puede revisar objeto a objeto en el Inspector. Esta fase construye la base
—arquitectura, teclado, accesibilidad y previews— sin introducir escritura, que
es lo que trae CRI-82.

Dos decisiones quedan documentadas como contrato, según pedía el encargo:

- **Rejilla propia, sin TanStack Table.** No se instala ninguna dependencia. El
  spike concluye que TanStack no ahorra trabajo aquí: lo caro es el teclado y la
  accesibilidad (foco itinerante en `role="grid"`, selección distinta del foco,
  costura `Enter`/`F2`), que es *headless* y no cubre; y su edición de celdas es
  «trae la tuya». La condición para reabrir la decisión está escrita en el doc.
- **Ruta canónica de `loadCases` y `combinations`: `updateProject`.** Verificado
  en el código: `ProjectEntityCollection` de `projectCommand.ts` no incluye esas
  dos colecciones, así que `executeProjectCommand` no puede expresarlas —
  `diffProjects` produciría un parche vacío. La única ruta existente y
  reversible es `updateProject(updater)`, la que ya usa el Inspector. Si se
  quisiera la semántica de comando, lo correcto es ampliar
  `ProjectEntityCollection` en un ticket propio, no abrir una ruta paralela.

Decisiones tomadas por el usuario en esta sesión: superficie **Drawer modal a
pantalla completa** y panel contextual **de preview puro, sin edición**.
Consecuencia asumida del drawer modal: con el lienzo inerte la sincronización
sólo se ve al cerrar, así que **Enfocar** emite `focus-object` y cierra la hoja
en el mismo gesto.

## Archivos tocados

Nuevos — `src/features/datasheet/`:

- `datasheetModel.ts` — columnas, proyección de filas, búsqueda, facetas y orden. Puro; magnitudes en unidades base.
- `datasheetGridNavigation.ts` — movimiento del foco por teclado, topes y reencaje. Puro.
- `datasheetPresentation.ts` — conversión a unidades del proyecto y mensajes de editabilidad.
- `DatasheetGrid.tsx` — rejilla semántica plana `<table role="grid">` con foco itinerante.
- `DatasheetContextPanel.tsx` — tarjetas Clay de Nodo, Apoyo, Material, Sección y Carga.
- `DatasheetPanel.tsx` — superficie, pestañas de entidad, búsqueda, filtros, acciones.
- `datasheet.css` — tabla plana + Clay; foco (anillo) distinto de selección (fondo).
- `datasheetFixtures.ts` y cinco suites de prueba (`datasheetModel`, `datasheetGridNavigation`, `DatasheetPanel`, `DatasheetAccessibility`, `datasheetStyles`).

Modificados:

- `src/features/workspace/workspaceCommands.ts` — comando `open-datasheet`.
- `src/features/workspace/WorkspaceShell.tsx` — montaje diferido del panel, foco de retorno y cierre al cambiar de proyecto.
- `src/features/workspace/CommandPalette.tsx` — entrada en el grupo de herramientas.
- `src/features/topbar/TopBar.tsx` — botón «Abrir hoja de datos».
- `src/i18n/catalogs.ts` — 68 claves nuevas en español e inglés.
- `docs/architecture/structureco-datasheet-cri-81.md` *(nuevo, `CANONICAL`)* — contrato vigente: rejilla, editabilidad, casos y combinaciones, teclado.
- `docs/superpowers/specs/2026-08-13-structural-datasheet-cri-81-design.md` *(nuevo, `HISTORICAL`)* — diseño de la fase.
- `docs/README.md` y `docs/architecture/README.md` — índices.

**No se tocó** el solver, la teoría estructural ni `package.json`.

## Cómo verificar

```bash
npx vitest run src/features/datasheet src/features/workspace src/features/topbar src/i18n src/features/inspector src/features/bulk-edit src/App.test.tsx --maxWorkers=1
```

```bash
npm run typecheck && npx oxlint src && npm run verify:docs && npm run verify:protected
```

Resultados de esta sesión: **407 pruebas en 40 archivos, todas en verde**;
typecheck y lint limpios; gate documental y frontera protegida intactos.

Smoke de navegador (`npm run dev`, ejemplo Hibbeler en kip·ft), comprobado sobre
el DOM real:

- Nudos: `aria-rowcount` 3 / `aria-colcount` 7; cabeceras `X (ft)`, `Y (ft)`; `X = 10` para el nudo B (modelo `3.048 m`), es decir conversión de unidades correcta.
- Barras: `E (ksi) 29007.5`, `A (in²) 15.5`, `I (in⁴) 192.201`, nombre del caso de carga y aviso de «Sección equivalente» sin identidad de catálogo.
- Flechas mueven el foco **sin** cambiar la selección; `F2` anuncia «X todavía no se edita en esta fase.»; `Enter` selecciona la fila.
- Filtro por faceta: `1 de 2`. Búsqueda «articulado» encuentra el nudo por su token traducido y **no** roba el foco del buscador.
- `Esc` limpia la selección; el segundo `Esc` cierra y devuelve el foco al botón «Abrir hoja de datos».
- «Enfocar» cierra la hoja y deja el nudo B seleccionado en el lienzo.
- Tema oscuro: rejilla sin sombra (`box-shadow: none`) y tarjetas con elevación clay; sin errores de consola.

Limitación honesta: **no hay captura de pantalla**. El panel del navegador no
estaba compositando frames en esta sesión y `screenshot` falló por timeout; toda
la evidencia visual anterior es de DOM y estilos computados, no de imagen.

## Pendiente / siguiente paso

- **Sin pushear.** El commit queda en local, en `feature/cri-41-structural-datasheet`, a la espera de confirmación explícita.
- **CRI-82** abre la edición: sólo las celdas `pending`, por `executeProjectCommand` para nudos/barras/cargas y por `updateProject` para casos y combinaciones.
- Ampliar `ProjectEntityCollection` a `loadCases` y `combinations` queda como ticket propio si se quiere semántica de comando para ellos.
- Sin virtualización: la rejilla renderiza todas las filas. Es suficiente para los modelos actuales y es el disparador escrito para reconsiderar TanStack.
- Falta una captura de la superficie cuando el panel del navegador vuelva a componer.
