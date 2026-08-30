# Fase 1 del rediseño total · un solo panel derecho

**Fecha:** 2026-08-23 04:05
**Agente:** Claude Code
**Rama:** `claude/redeseno-total-mejoras-gimaf7`

## Qué cambió

El panel derecho deja de ser **tres superficies del broker** que montaban tres copias
del mismo componente, y pasa a ser **una** con tres segmentos: Inspector · Cargas ·
Vista. Con ellas se van los lanzadores duplicados: el pie del riel de herramientas
desaparece entero y el lanzador flotante de K0 baja de tres botones a uno.

El hallazgo que ordena la fase estaba en el propio código: `Inspector.tsx` **ya traía**
un `role="tablist"` completo con los tres segmentos, y la prop `surface` lo apagaba
siempre (`forcedTab`, línea 96). El marcado llevaba escrito desde el principio lo que
esas tres superficies de verdad eran. Esto lo devuelve a esa forma.

La consecuencia de tenerlas separadas no era estética. En Compact hay **una** ranura
contextual (R-1), así que las tres competían: abrir «Cargas» suspendía el detalle de lo
que el usuario acababa de seleccionar.

## Por qué

Primera fase del plan de rediseño total acordado con el usuario (producto + interfaz,
reestructura radical). Los defectos son medidos, no opinados:

| # | Defecto | Dónde |
|---|---|---|
| 1 | Nueve superficies del broker con tres lanzadores para destinos solapados. | `surfacePresentation.ts:16`, `WorkspaceShell.tsx:262` (pie del riel), `:318` (flotante), `TopBar.tsx` (iconos) |
| 2 | Tablist completo del Inspector muerto en producto: `surface` lo apagaba siempre. | `Inspector.tsx:96,194-199` |
| 3 | **Resultados se abría desde dos botones y desde ningún comando registrado.** Dos puertas, cero definición. | `WorkspaceShell.tsx:265,326` |
| 4 | `inspectorPreferences.ts` repartía la propiedad de las secciones entre tres dueños; sólo `detail` llegó a tener consumidor. Los ids `analysis-*` y `view-*` no los escribía nadie. | `inspectorPreferences.ts` |

## Archivos tocados

**El panel**
- `src/features/inspector/inspectorSegments.ts` — **nuevo**. El contrato de los tres
  segmentos y su rótulo i18n, en módulo propio porque lo lee el bus de comandos.
- `src/features/inspector/Inspector.tsx` — reescrito el cuerpo. Un solo componente, el
  tablist como cabecera permanente, tres `role="tabpanel"`.
  - **Guardia de rendimiento.** `SelectionIndependentInspector` existía para que un
    cambio de selección no re-renderizara Cargas ni Vista. Al fundirlos, el cuerpo del
    panel ya no puede suscribirse a la selección: la suscripción baja a una hoja,
    `SelectionSegmentSync`, que renderiza `null` y sólo trae el foco al detalle. La
    herramienta activa la lee `AnalysisSetupPanel`, que es quien la usa.
  - **Un segmento visitado se conserva montado y oculto con `hidden`**, no se
    desmonta: Cargas tiene borradores numéricos sin publicar (los factores de una
    combinación) y cambiar de segmento no puede tirarlos.
- `src/features/inspector/inspectorPreferences.ts` y su prueba — retirado el reparto por
  dueño; queda `readExpandedSections`/`writeExpandedSections`. Los ids ajenos se siguen
  conservando intactos en el almacén.
- `src/features/inspector/InspectorProperties.tsx` — llamadas actualizadas.

**El broker**
- `src/features/workspace/surfacePresentation.ts` — `analysisSetup` y `view` salen de
  `BROKER_SURFACE_IDS`, de la tabla de presentación (3 clases) y de la de actividad.
  De diez superficies a ocho.
- `src/features/workspace/workspaceCommands.ts` — comando `open-detail` con
  `{ segment?, trigger? }`, que sustituye a las dos aperturas de superficie retiradas.
- `src/features/workspace/WorkspaceShell.tsx` — una sola instancia de `Inspector`, el
  segmento como estado del shell, sin `footerActions`, un botón en el lanzador flotante.

**El lanzador de Resultados**
- `src/features/workspace/commandRegistry.ts` — comando **`tool:results`**, la
  definición que faltaba, y su alta en `TOPBAR_COMMAND_IDS`.
- `src/features/topbar/TopBar.tsx` — Resultados entra en el grupo de superficies de la
  barra y en el menú de desbordamiento móvil.
- `src/i18n/catalogs.ts` — `palette.openResultsHint` en los dos idiomas.

**Riel y CSS**
- `src/features/canvas/ToolRail.tsx` — la prop `footerActions` se retira (sin emisor).
- `src/styles.css` — fuera las cinco reglas de `.tool-rail-footer-actions` y sus dos
  menciones en listas de ocultación. `.results-launcher` entra en la lista de los que
  ceden sitio bajo 700 px.
- `src/features/workspace/phase1.css` — comentario del lanzador flotante reescrito.

**Gates**
- `src/features/workspace/oneLauncherPerDestination.test.tsx` — **nuevo**. Un destino,
  un lanzador, en escritorio y en teléfono; y su contrario, que ningún destino se quede
  con cero.
- `src/features/workspace/surfacePresentation.test.ts` — censo de ocho superficies, y
  gate nuevo: **ningún segmento del panel puede declararse como superficie**.
- `src/features/inspector/Inspector.test.tsx` — el arnés de tres superficies pasa a ser
  el del panel único; prueba nueva del borrador que sobrevive al cambio de segmento y
  del foco que vuelve al detalle con la selección.
- `src/App.test.tsx` — `openResults` pasa de `getAllByRole(...)[0]` a `getByRole` en
  singular: el comentario del helper documentaba la duplicación, ahora la prohíbe.

## Cómo verificar

```bash
npm run verify   # lint · docs · frontera protegida · pruebas · build · presupuesto
PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run qa
```

Ambos ejecutados en esta sesión y leídos:

- `npm run verify` — **229 archivos / 2257 pruebas** pasan (8 saltadas), lint sin
  errores, `verify:docs` conforme, `verify:protected` = «Frontera protegida intacta: 38
  archivos verificados» **sin refrescar la línea base**, build correcto.
- `npm run qa` — **152 checks** con Chromium real, salida `exit=0`, **ninguno en
  `false`**, cero mensajes de consola y cero errores de página.

Contra la línea base medida antes de empezar (`ea1f548`): 228 → 229 archivos de prueba,
2250 → 2257 pruebas, 150 → 152 checks de QA. Carga inicial 874 770 → 874 161 bytes.

**Los dos gates nuevos pueden ponerse rojos**, comprobado devolviendo el defecto:
reintroducido el botón «Resultados» en el lanzador flotante, `oneLauncherPerDestination`
cae en escritorio y en teléfono con `[{ name: 'Resultados', count: 2 }]`. Un gate que no
puede fallar no es una red.

Evidencia visual en `reports/evidence/2026-08-23-panel-derecho-unico/`, con su README.

## Pendiente / siguiente paso

**Un defecto encontrado y no arreglado, deliberadamente.** En K0 a 390 px la barra
superior se superpone consigo misma: «P…» encima de deshacer, el galón encima de
rehacer. Se capturó **idéntico sobre la línea base antes de tocar nada**, así que es
preexistente. Sus tres zonas suman ~405 px de contenido mínimo en 374 px útiles y
`topbar-status-zone` tiene `min-width:max-content` por contrato CRI-95; arreglarlo es
decidir quién cede a ese ancho, no una línea de CSS. Queda anotado como trabajo propio.

Lo que sí introdujo esta fase y quedó corregido antes de cerrar: el icono nuevo de
Resultados no estaba en la lista de los que degradan bajo 700 px y, a 390 px, no se
recortaba: se pintaba encima de la marca.

Siguiente fase del plan: **Panorama del modelo** — el estado vacío del panel (hoy dos
tarjetas que dicen lo mismo, `inspector.noneSelected` + `inspector.emptyPropertiesHelp`)
pasa a ser recuento, casos de carga, estado del análisis, hallazgos del Model Doctor y
acciones directas.

`npm run qa:webkit` no se ejecutó: WebKit no está instalado en este entorno.
