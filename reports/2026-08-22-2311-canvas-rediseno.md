# Rediseño del lienzo (canvas)

**Fecha:** 2026-08-22 23:11
**Agente:** Claude Code
**Rama:** claude/canvas-redesign-improvements-0qmpzw

## Qué cambió

Tercera fase del rediseño "estilo Apple / app de sistema", esta vez centrada
enteramente en `src/features/canvas/`. El usuario pidió libertad total: quitar,
añadir, mover y reorganizar botones y funciones del lienzo. Se ejecutó el plan
completo P0→P3 en una sola sesión:

- **P0 — bug real de etiquetas.** Había dos sistemas de texto sobre el lienzo:
  el repartidor `layoutSmartLabels()` (sin solapes) y `CanvasResultLayer`
  dibujando sus propios `<text>` con coordenadas fijas, ajeno a ese repartidor.
  Peor: cada extremo `maximum`/`minimum` del diagrama se etiquetaba **dos
  veces** por dos productores distintos (el sello `Mmax/Mmin` y el candidato
  genérico `M = …`), lo que producía el solape visible en la evidencia previa
  ("Mmax 31" tapando a "N4"). Se unificó todo bajo un solo repartidor.
- **P1 — descongestión del pie del lienzo.** Cuatro superficies flotantes
  independientes (controles de cámara, minimapa, chip "Repetir", lector de
  coordenadas) que llegaron a solaparse se fundieron en un solo componente,
  `CanvasNavigator`, con revelado por opacidad. El chip "Repetir" desapareció:
  ahora es la acción primaria de `ContextualActions`. El lanzador de
  superficies (Detalle·Cargas·Vista·Resultados) se mudó al pie del riel de
  herramientas en escritorio.
- **P2 — reorganización del riel y del panel de capas.** El riel pasó de 5
  grupos a 4 (Navegar·Crear·Cargar·Medir); "Desplazar" y "Eliminar" dejaron de
  ser botones permanentes (sus gestos/atajos siguen intactos); "Dividir
  miembro" subió al grupo Crear; el flag `classroomAdvanced` se retiró de
  Cota/Corte (antes escondía justo las herramientas pedagógicas del producto
  en modo Aula). `CanvasLayers` migró de un popover manual a `Popover` del
  sistema de diseño, e incorporó Snap/Rejilla como conmutadores reales
  (antes eran chips inertes, `pointer-events:none`, duplicados en Inspector).
- **P3 — mejoras menores.** El minimapa ahora navega: un clic en un punto del
  radar centra la cámara ahí (antes cualquier clic hacía "ajustar a la
  vista"). El número mágico `85` (escala de referencia) se nombró como
  `CANVAS_REFERENCE_SCALE`. `layoutSmartLabels` ganó un índice espacial por
  celdas para la prueba de colisión, bajando de comparar cada candidato contra
  *todas* las etiquetas ya colocadas a sólo las de celdas cercanas.

Durante la verificación final con Chromium real se encontró y arregló un bug
de layout que las pruebas unitarias (jsdom) no podían ver: el popover de capas
migrado a `Popover` quedaba clipado a ~32px de alto porque su `max-height:
calc(100% - 126px)` heredaba como bloque contenedor un ancestro
`position:absolute` de sólo 40px de alto, no el lienzo completo. Se corrigió
usando `calc(100dvh - var(--topbar-h) - env(safe-area-inset-top) - 60px)`, que
no depende de ese contenedor intermedio.

## Por qué

El usuario, en la sesión anterior, pidió continuar el rediseño con acceso y
libertad totales, específicamente sobre el canvas: "quitar funciones agregar
funciones mover botones quitar botones acomodar cambiar mejorar". Explorando
el código (no sólo las capturas) se encontraron causas concretas y
verificables del desorden visible, documentadas en el plan aprobado por el
usuario vía `ExitPlanMode`/`AskUserQuestion`: dos sistemas de etiquetado en
conflicto, un rectángulo "seguro" desincronizado del chrome real, aritmética
muerta reservando espacio que otro elemento ocupaba por accidente, y un riel
con hasta 3 caminos redundantes al mismo destino.

## Archivos tocados

**P0 — repartidor único de etiquetas**
- `src/features/canvas/canvasLabelSources.ts` (nuevo) — construcción de
  candidatos extraída de `StructuralCanvas.tsx`, con los sellos Mmax/Mmin/
  Vmax/Vmin como candidatos multirrenglón deduplicados contra `M = …`.
- `src/features/canvas/labelLayout.ts` — `lines?` multirrenglón, ancho/alto
  estimado unificado, techo global de etiquetas visibles (`visibleBudget`),
  índice espacial por celdas (P3).
- `src/features/canvas/CanvasResultLayer.tsx` — `renderCriticalPoints` cede el
  texto al repartidor; conserva sólo tallo+punto (geometría).
- `src/features/canvas/StructuralCanvas.tsx` — usa `buildCanvasLabelCandidates`,
  escribe `--canvas-safe-*` desde `canvasSafeInsetsFor()`.
- `src/features/canvas/canvasChromeGeometry.ts` — `CANVAS_REFERENCE_SCALE`.

**P1 — pie del lienzo**
- `src/features/canvas/CanvasNavigator.tsx` (nuevo) — funde minimapa, cámara,
  escala y coordenadas en una pastilla con revelado por opacidad; escucha el
  comando `fit-canvas`.
- `src/features/canvas/CanvasMiniMap.tsx` — glifo SVG puro; ganó navegación
  por clic (P3, ver más abajo).
- `src/features/canvas/CanvasChrome.tsx` — monta el Navegador, delega
  snap/rejilla a `CanvasLayers`.
- `src/features/canvas/RepeatActionOverlay.tsx` — pierde el chip flotante.
- `src/features/workspace/WorkspaceShell.tsx`, `phase1.css` — lanzador de
  superficies al pie del riel en escritorio.
- `src/styles.css`, `src/design-system/material.css` — retiro de reglas
  obsoletas (`.canvas-controls`, `.canvas-status`, fórmula `×3` muerta,
  parches `:has()` de anticolisión), reglas nuevas del Navegador y del
  popover de capas (incluida la corrección de `max-height`).

**P2 — riel y capas**
- `src/features/canvas/toolRegistry.ts` — 4 grupos, `pan`/`delete` fuera del
  registro de botones, `split` a Crear, sin `classroomAdvanced`.
- `src/features/canvas/ToolRail.tsx` — ajustado a la nueva forma del registro,
  admite `footerActions`.
- `src/features/canvas/CanvasLayers.tsx` — migrado a `Popover` del sistema,
  Snap/Rejilla como `LayerToggle` interactivos.
- `src/features/inspector/Inspector.tsx` — retira las casillas Snap/Rejilla
  duplicadas.
- `src/features/workspace/commandRegistry.ts`, `src/i18n/catalogs.ts` —
  limpieza de filtros y claves huérfanas.

**P3 — mejoras menores**
- `src/features/canvas/CanvasMiniMap.tsx` — clic en el radar navega al punto
  bajo el cursor (`onNavigate`), usando `getScreenCTM()` para la conversión
  exacta; activación por teclado sigue encuadrando el modelo completo.
- `src/features/canvas/CanvasNavigator.tsx`, `StructuralCanvas.tsx` — cablean
  `onNavigate` hasta la cámara (`navigateMinimapTo`).
- `src/features/canvas/labelLayout.ts` — índice espacial (`SmartLabelSpatialIndex`).

**QA y pruebas**
- `qa.mjs` — `verifyFloatingSurfacesDoNotOverlap` reescrito para comparar
  todos los pares relevantes (antes 4 de 21); selectores actualizados al
  Navegador y al popover de capas; se añadió un `.hover()` sobre
  `.canvas-navigator` antes de pulsar "Ajustar modelo a la vista", porque ese
  botón vive ahora detrás del revelado por opacidad (antes era un botón
  siempre visible).
- `src/design-system/material.test.ts` — el gate de material translúcido del
  panel de capas se reescribió para leer `.sc-popover__surface` desde
  `ui.css` en vez de una regla propia ya retirada de `material.css`.
- Se actualizaron o crearon los `.test.tsx`/`.test.ts` de cada archivo tocado
  (10 archivos de test modificados, 2 nuevos: `CanvasNavigator.test.tsx`,
  `canvasLabelSources.test.ts`).

## Cómo verificar

```bash
npm run verify   # lint · docs · frontera protegida · build · presupuesto de rendimiento
npm run qa       # 149+ checks con Chromium real (requiere PLAYWRIGHT_EXECUTABLE_PATH en este entorno)
```

Ambos corrieron en esta sesión y quedaron en verde: `npm run verify` — lint,
`verify:docs`, `verify:protected` ("Frontera protegida intacta: 38 archivos
verificados"), 228 archivos / 2250 pruebas de `vitest`, `build` y
`verify:perf` — y `npm run qa` — 149+ checks, sin ningún `false`, sin errores
de consola ni de página, incluida la versión ampliada de
`verifyFloatingSurfacesDoNotOverlap` sobre los 6 pares relevantes.

Evidencia visual en `reports/evidence/2026-08-22-canvas-rediseno/` (1600×950,
`Pórtico de ejemplo`, claro/oscuro donde aplica): lienzo en reposo con las 4
esquinas nuevas, barra de selección sola en el centro, vista de momento sin
solape de etiquetas, Navegador revelado por hover, popover de capas con
Snap/Rejilla, riel con Medir siempre visible, y presentación `K0` táctil. Ver
el `README.md` de esa carpeta para el detalle de cada captura y una nota
sobre por qué no incluye una captura de `M1` (esa composición no se alcanzó en
ningún viewport probado en este build; es una pieza de `shellComposition.ts`
ajena a este rediseño).

## Pendiente / siguiente paso

Nada pendiente en el alcance P0–P3 acordado. `npm run qa:webkit` no se
ejecutó (no se confirmó disponibilidad de WebKit en este entorno); si el
usuario quiere esa cobertura adicional para el `:has()` y `backdrop-filter`
del pie del lienzo, es la siguiente verificación natural. El commit queda
hecho en la rama de trabajo; el push está pendiente de confirmación explícita
del usuario en el chat.
