# CRI-80 · Fase 3 de CRI-38 — UX integrada y QA de generadores

**Fecha:** 2026-08-13 22:30
**Agente:** Claude Code
**Rama:** main (local, sin push)

## Qué cambió

El contrato de la fase 2 (CRI-79) ya tiene superficie. «Generar estructura» existe en el
Workspace y en la paleta de comandos, y el recorrido completo —elegir familia, ajustar
parámetros, ver la geometría dibujarse sobre el lienzo, revisar el resumen exacto y confirmar—
funciona en escritorio y en compacto:

- **Traducción pura del formulario** — `structureGeneratorForm.ts` convierte el texto tecleado en
  `GeneratorParams`, con errores por campo y conversión de unidades de pantalla a internas.
- **Presentación pura del resumen** — `structureGeneratorSummary.ts` construye las filas exactas
  y clasifica los avisos en los que piden una decisión y los que sólo informan.
- **Panel Clay** — `StructureGeneratorPanel.tsx`, superficie flotante sobre el lienzo, con
  parámetros por familia, separaciones uniformes o personalizadas, origen de inserción,
  propiedades base y una revisión explícita antes de crear.
- **Superficie conectada** — `StructureGeneratorSurface.tsx` prepara contra el modelo vigente,
  publica el ghost y confirma por la ruta reversible de la fase 2.
- **Vista previa en vivo** — `CanvasStructureGeneratorLayer.tsx` dibuja el ghost dentro del SVG
  del lienzo, con trazo discontinuo y sin capturar el puntero.
- **Entradas al Workspace** — grupo «Crear» del ToolRail, hoja «Más» en compacto y paleta de
  comandos, todas por `emitWorkspaceCommand('open-structure-generator')`.
- **Origen elegido en el lienzo** — un clic entrega el punto de inserción, ajustado a rejilla y
  a nudos existentes.

No se añadió 3D, cargas automáticas, diseño normativo, presets personales ni editor tabular.

## Por qué

Es exactamente el alcance de CRI-80. Las fases 1 y 2 dejaron la generación probada y conectada
pero sin forma de invocarla: el criterio de cierre de CRI-38 —«modelar una geometría común
requiere configurar parámetros y ajustar el resultado, no dibujar cada repetición»— sólo se
cumple cuando existe la superficie que traduce parámetros a esa geometría.

## Decisiones de diseño

- **Superficie flotante, no diálogo modal.** Lo que el usuario mira mientras ajusta parámetros es
  la vista previa dibujada detrás. Un modal habría tapado justamente lo que hay que ver, y el
  patrón ya existía en el editor estructural (`structural-edit-surface`). El lienzo sigue siendo
  suyo mientras el panel está abierto: el ghost no captura el puntero.
- **La bandeja compacta ocupa media pantalla, no lo que quepa.** La primera versión usaba
  `72vh` y dejaba 60 px de lienzo visible en un 390×844: canvas-first sin lienzo. Un formulario
  largo scrollea dentro; un lienzo tapado no tiene arreglo desde dentro del panel. El QA lo fija
  como umbral (`compactTrayLeavesThePreviewVisibleAbove`), no como preferencia.
- **El panel toma el foco al abrirse y lo devuelve al cerrarse.** No es un cepo de foco —no es
  modal—, sino el mínimo para que exista para el teclado: sin esto, Escape se lo quedaba el botón
  del ToolRail y cerrar con teclado exigía tabular a ciegas hasta dentro. Lo detectó el QA de
  navegador, no una revisión de código.
- **Revisar es un paso obligatorio.** Generar añade decenas de entidades, invalida los resultados
  vigentes y ocupa el historial: no puede ocurrir por rozar un botón mientras se teclea. Volver
  conserva el borrador; un commit rechazado conserva la revisión.
- **Las unidades se convierten una sola vez, en la traducción.** Todo lo que se teclea está en las
  unidades que el proyecto muestra y todo lo que sale está en las internas, igual que en la
  edición estructural. Sin esto, una viga de 5 en `kip-ft` habría llegado al núcleo como 5 m.
- **Personalizar propiedades parte del catálogo activo.** Al cambiar a propiedades explícitas, los
  campos se siembran con los números que el catálogo ya resolvía, serializados sin pérdida
  (`serializeNumber`, no un formateador de lectura). Empezar en blanco obligaría a teclear de
  memoria lo que se acaba de ver; sembrar una constante inventaría propiedades que nadie pidió.
- **Sin apoyos sigue siendo el valor por defecto**, y el panel lo dice en vez de callarlo: el
  aviso `no-supports` aparece desde el primer render y se retira solo al elegir uno.
- **Los dos modos de separación conviven en el mismo borrador**, de modo que alternar entre
  uniforme y personalizada no borra lo ya escrito.
- **La preparación se memoriza por firma de parámetros y estado del proyecto**, no por identidad
  del borrador: pasar de `5` a `5.` mientras se teclea no cuesta una regeneración ni redibuja el
  ghost. Como se vuelve a preparar en cada cambio del proyecto, la vista previa nunca queda
  obsoleta; una carrera real la sigue detectando y nombrando `applyPreparedStructureGeneration`.
- **Sólo la Warren ofrece quitar montantes.** En Pratt y Howe el control mentiría, porque el
  núcleo los crea de todos modos.
- **El tipo de miembro no se expone.** El núcleo ya elige el correcto por familia (`truss` para
  cerchas, `frame` para el resto) y el resultado es editable con los comandos ordinarios. Es una
  exclusión deliberada para no convertir el panel en un inspector.

## Archivos tocados

Nuevos:
- `src/features/structure-generator/structureGeneratorForm.ts` + `.test.ts` (36 pruebas)
- `src/features/structure-generator/structureGeneratorSummary.ts` + `.test.ts` (11)
- `src/features/structure-generator/structureGeneratorCopy.ts`
- `src/features/structure-generator/StructureGeneratorPanel.tsx` + `.test.tsx` (23)
- `src/features/structure-generator/StructureGeneratorSurface.tsx` + `.test.tsx` (12)
- `src/features/structure-generator/StructureGeneratorAccessibility.test.tsx` (14)
- `src/features/structure-generator/structureGenerator.css`
- `src/features/canvas/CanvasStructureGeneratorLayer.tsx` + `.test.tsx` (8)
- `scripts/qa-structure-generator.mjs`

Modificados:
- `src/features/canvas/StructuralCanvas.tsx` — estado del generador (ghost, origen, puntero
  armado), montaje diferido de la superficie, capa de vista previa y elección de origen en fase
  de captura, para que elegir sobre un nudo existente entregue el punto sin seleccionarlo además.
- `src/features/canvas/ToolBar.tsx` — entrada en el grupo «Crear» (escritorio y hoja «Más»).
- `src/features/workspace/CommandPalette.tsx` — entrada en el grupo de herramientas.
- `src/features/workspace/workspaceCommands.ts` — comando `open-structure-generator`.
- `src/design-system/components/surface.tsx` — `Surface` acepta `ref`, como el resto de la
  librería (`Button`, `Field`, `Select`). Aditivo; ningún consumidor cambia.
- `src/i18n/catalogs.ts` — namespace `generator.*` en español e inglés.
- `src/features/canvas/ToolBar.test.tsx` y `src/features/workspace/CommandPalette.test.tsx` —
  conteos por grupo actualizados y cobertura de las entradas nuevas.
- `package.json` — `qa:structure-generator` y `qa:structure-generator:webkit`.

No se tocó `src/data/**`, `src/engine/**` ni `src/store/ProjectContext.tsx`: la frontera
protegida queda byte a byte igual y `scripts/protected-baseline.sha256` no cambia.

## Cómo verificar

```bash
npx vitest run src/features/structure-generator src/features/canvas/CanvasStructureGeneratorLayer.test.tsx --maxWorkers=1
```

```bash
npm run qa:structure-generator
```

```bash
npm run qa:structure-generator:webkit
```

Compuertas ejecutadas y en verde: `npx tsc -b --noEmit` y `npm run verify` completo —lint,
`verify:docs`, `verify:protected`, suite Vitest entera, build y presupuesto de rendimiento—, más
el QA de navegador nuevo en Chromium y WebKit. Como regresión de las superficies tocadas se
volvieron a pasar `scripts/qa-structural-edits.mjs` y `scripts/qa-topbar.mjs`, ambos en verde.

La superficie viaja en su propio chunk diferido (`StructureGeneratorSurface`, 16.8 kB / 5.6 kB
gzip): el editor no paga su código al arrancar. El presupuesto total quedó en 816 415 bytes /
212 787 gzip.

Lo que el QA de navegador afirma y las pruebas unitarias no pueden: el ghost está en el SVG y no
en el modelo, ajustar parámetros no escribe nada en `localStorage`, las tres topologías de cercha
son geometrías distintas, el resumen previo coincide exactamente con lo creado, un solo deshacer
retira el lote entero, los resultados vigentes se invalidan una vez, los objetivos táctiles miden
44 px en compacto y una retícula de 169 nudos se previsualiza sin colgar el hilo principal.

## Pendiente / siguiente paso

- **CRI-38 queda cerrable**: las tres fases (CRI-78 núcleo, CRI-79 preview y commit atómico,
  CRI-80 UX y QA) están completas.
- Los mensajes de los avisos siguen viniendo del núcleo en español, como en las fases 1 y 2; sólo
  su título está traducido. Homogeneizar el idioma de los mensajes del núcleo es un cambio de
  `src/data/**` y no pertenece a esta fase.
- El cambio y este reporte quedan **commiteados en local, sin push**, por indicación explícita del
  usuario. Codex no los verá hasta que se haga `git push origin main`.
