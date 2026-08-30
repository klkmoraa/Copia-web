# Fase 4 del rediseño Apple: animación y experiencia móvil

**Fecha:** 2026-08-23 00:56
**Agente:** Claude Code
**Rama:** claude/apple-redesign-mobile-animations-0hkvmp

## Qué cambió

Cuarta fase del rediseño "estilo Apple / app de sistema" (tras identidad,
disposición y lienzo), esta vez centrada en **animación y experiencia móvil**,
con libertad total del usuario para quitar/mover/cambiar lo que hiciera falta.

- **Hojas móviles arrastrables de verdad.** El Inspector en K0 (teléfono) sólo
  cambiaba de detent (`compact`/`medium`/`large`) por botón; ahora tiene una
  manija real con arrastre 1:1 al dedo, resistencia elástica en los extremos,
  snap al detent más cercano o cierre por velocidad (un gesto rápido hacia
  abajo cierra aunque no cruce el umbral de posición) — patrón estándar de
  hoja iOS, implementado con `pointer events` crudos (mismo estilo que el
  resize del Inspector de escritorio ya existente), sin añadir una librería de
  gestos nueva. La hoja "más acciones"/"cargas" del riel de herramientas
  (`ToolRail`) gana el mismo arrastre en su variante de descarte (empuje hacia
  abajo cierra, hacia arriba rebota). Los botones de detent se conservan como
  camino de teclado/lector de pantalla.
- **Transición entre pantallas.** `welcome` ↔ `workspace` ↔ `space3d` pasaba de
  una a otra con un corte seco (`useState` + `Suspense` desnudo, sin animación
  de salida en ningún sentido). Ahora usa `AnimatePresence` con `motion` para
  un fundido cruzado, respetando `prefers-reduced-motion`.
- **Cobertura de motion en paneles de datos.** Investigado en profundidad:
  Inspector, Datasheet, Model Doctor y la superficie densa de resultados YA
  usaban el primitivo `<Drawer>` animado del sistema de diseño — no hacía
  falta tocarlos. El hueco real era «Generar estructura»
  (`StructureGeneratorSurface`), que aparecía/desaparecía sobre el lienzo sin
  ninguna transición; ahora entra con el mismo muelle que `Dialog`/`Drawer`
  del sistema (`m.section` + `AnimatePresence`), reutilizando la abstracción
  `Surface` sólo donde no chocaba con la animación.
- **Auditoría de pulsación táctil.** El dock inferior de herramientas
  (`.tool-button`), la paleta móvil (`.mobile-palette-tool`), los botones de
  detent del Inspector, el lanzador de superficies y el botón «Cerrar» de la
  paleta tenían `:hover` pero **ningún `:active`** — en un dispositivo táctil
  eso es cero feedback de pulsación. Se añadió `:active` con relleno + el
  encogido del 3 % que ya define el sistema (`--sc-press-transform`) en los
  cinco sitios.
- **Hallazgo de mobile-experience, corregido de paso:** en 390×844 el lanzador
  flotante de superficies (Detalle·Cargas·Vista·Resultados,
  `.workspace-surface-launcher`) tapaba casi entero el botón «Más
  herramientas» del dock inferior — confirmado con `getBoundingClientRect()` y
  reproducido tanto por un script de QA nuevo como por el `qa-structure-
  generator.mjs` YA EXISTENTE (que fallaba por esto antes de esta sesión,
  verificado contra la rama limpia con `git stash`). Se corrigió subiendo el
  lanzador por encima de la fila que el dock reserva (`64px + safe-area`, y su
  equivalente en el recorte de paisaje). De paso se ajustó
  `qa-structure-generator.mjs` para cerrar primero la hoja del Inspector
  (retenida y activa por defecto en K0), que tapaba el mismo botón por una
  razón distinta y ya documentada.

## Por qué

El usuario pidió continuar el rediseño con libertad total, esta vez
enfocado explícitamente en animación y experiencia móvil. Antes de tocar nada
se exploró el código (no sólo la intuición): la base de motion ya era madura
(escala de duraciones/curvas en `tokens.css`, `motion` cargado de forma
perezosa, `Popover`/`Dialog`/`Drawer`/Toast ya animados), así que el trabajo
real era cerrar huecos concretos y verificables, no reconstruir el sistema.

## Archivos tocados

- `src/design-system/components/sheetDrag.ts` (nuevo) — `useSheetResizeDrag`
  (Inspector: detents con snap/velocidad/rubber-band) y
  `useSheetDismissDrag` (paleta: descarte por traslación), compartiendo
  `getViewportHeightPx` (mismo truco que `ResultsPanel`, consciente del
  teclado virtual).
- `src/features/inspector/Inspector.tsx` — manija real + drag hook.
- `src/features/canvas/ToolRail.tsx` — drag hook en la manija de la paleta.
- `src/features/workspace/phase1.css` — CSS de la manija, estado de arrastre,
  y el ajuste de posición del lanzador de superficies.
- `src/styles.css` — `height` sumado a la transición del Inspector (para que
  el snap entre detents anime), transición de `transform` de la paleta móvil,
  y los `:active` del dock/paleta/lanzador/botón cerrar.
- `src/App.tsx` — fundido cruzado de pantalla con `AnimatePresence`.
- `src/features/canvas/StructuralCanvas.tsx` — `AnimatePresence` alrededor del
  montaje perezoso de «Generar estructura».
- `src/features/structure-generator/StructureGeneratorPanel.tsx` — su
  superficie raíz pasa de `<Surface>` a `<m.section>` con muelle de entrada/
  salida, respetando `useReducedMotion()`.
- `src/features/canvas/phase2.css` — `:active` con encogido en
  `ContextualActions` (tenía el relleno pero no el encogido) y en su acción de
  desbordamiento (no tenía ninguno de los dos).
- `scripts/qa-sheet-drag.mjs` (nuevo) + `package.json` (`qa:sheet-drag`) —
  QA de navegador real para el arrastre: snap por distancia, cierre por
  velocidad, limpieza del estado de arrastre, descarte por traslación con
  rebote y con cierre.
- `scripts/qa-structure-generator.mjs` — cierra la hoja del Inspector antes de
  probar el dock en compacto (ver hallazgo arriba).

## Cómo verificar

```bash
npm run verify          # lint · docs · frontera protegida · 2250 pruebas · build · presupuesto
npm run qa              # 149+ checks con Chromium real
npm run qa:sheet-drag    # arrastre de hojas móviles (nuevo)
npm run qa:structure-generator   # incluye el fundido de «Generar estructura»
```

Los cuatro corrieron en esta sesión y quedaron en verde: `npm run verify`
completo (lint sin errores nuevos, `verify:docs`, `verify:protected` — 38
archivos, frontera intacta —, 228 archivos / 2250 pruebas, `build`,
`verify:perf` sin techo bloqueante), `npm run qa` (149+ checks, sin ningún
`false`, sin errores de consola ni de página), y los dos scripts dirigidos con
Chromium real (`PLAYWRIGHT_EXECUTABLE_PATH` apuntando al Chromium
preinstalado del entorno).

## Pendiente / siguiente paso

- **`ResultsPanel.tsx`** (el panel de resultados dock/inset/sheet, no la
  superficie densa) sigue montado siempre con `hidden={status !== 'active'}`
  en vez del patrón `AnimatePresence` que ya usan Inspector/Datasheet/Doctor —
  no se tocó en esta fase porque migrarlo exige el mismo tipo de cambio de
  ciclo de vida de montaje que tiene CRI-94 detrás, no un ajuste de motion
  suelto. Candidato natural para la próxima fase.
- **El intercambio Inspector ↔ `BulkEditInspectorPanel`** (selección múltiple)
  no lleva cross-fade: es una función de render de 500+ líneas con drafts en
  vivo (undo/redo, validación) y tocar su ciclo de montaje para una animación
  cosmética no pareció una relación riesgo/beneficio razonable en esta pasada.
- `npm run qa:webkit` no se ejecutó (no se confirmó WebKit en este entorno,
  igual que en la fase anterior).
- El commit queda hecho en la rama de trabajo; el push está pendiente de
  confirmación explícita del usuario en el chat.
