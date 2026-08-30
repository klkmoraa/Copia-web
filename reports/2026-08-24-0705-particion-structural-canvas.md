# Partir StructuralCanvas.tsx en ocho hooks

**Fecha:** 2026-08-24 07:05
**Agente:** Claude Code
**Rama:** claude/propuestas-mejora-7x3xb7

## Qué cambió

`src/features/canvas/StructuralCanvas.tsx` era el "god component" del canvas
de modelado 2D: 2497 líneas mezclando cámara, gestos de puntero, edición
estructural, CRUD de nodos/miembros y wiring de renderizado. Queda en 1390
líneas (−44%) tras mover su lógica no visual a ocho módulos nuevos, cada uno
con su propia batería de tests, siguiendo el patrón ya establecido en
`src/features/canvas/` (lógica pura en `.ts` + componente presentacional en
`.tsx`, cada uno con su `.test.ts(x)` hermano):

1. `CutInspector.tsx` — el tooltip del diagrama de cuerpo libre (corte FBD),
   ~55 líneas de JSX que vivían incrustadas en el render.
2. `useCanvasDerivedGeometry.ts` — los ~20 `useMemo` de solo lectura (mapas
   por id, candidatos de snap, mapa de demanda elástica, visor del minimapa,
   corte FBD).
3. `useCanvasCoordinates.ts` — `toScreen`/`toModel`/`fitModel`/`navigateMinimapTo`.
4. `useCanvasInteractionLoop.ts` — el batching por `requestAnimationFrame` de
   cámara, drag de nodo y draft de edición estructural en vivo.
5. `useCanvasModelActions.ts` — CRUD de modelo: crear/borrar nodo y miembro,
   portapapeles, duplicar, snapping, selector de candidatos superpuestos.
6. `useCanvasToolDispatch.ts` — el switch que decide qué hace un clic según
   la herramienta activa.
7. `useCanvasStructuralEdit.ts` — ciclo de vida del draft de edición
   estructural (abrir/cambiar/actualizar/confirmar/cancelar).
8. `useCanvasPointerGestures.ts` — pointerdown/move/up, pinch multi-touch y
   long-press: la pieza más grande y de mayor riesgo, dejada de colofón a
   propósito.

También sale `useStableCanvasEvent.ts` a su propio módulo (antes vivía
privado dentro de `StructuralCanvas.tsx`), compartido ahora por varios de
los hooks nuevos.

Es un refactor de mantenibilidad puro: ningún comportamiento visible cambia.
`src/engine/**`, `src/workers/**`, `src/data/**`,
`src/store/ProjectContext.tsx` y `src/types.ts` (frontera protegida) no se
tocaron — los hooks nuevos siguen consumiéndolos igual que antes.

### Un bug real que atrapó la extracción, no el original

Al mover `shouldStartPan` a `useCanvasPointerGestures.ts` se perdió por un
momento la condición `spacePressedRef.current` del pan con barra espaciadora
— quedó solo `activeTool === 'pan'`. Lo encontró la propia verificación
(`spacePan` es uno de los 191 checks de `npm run qa`, no un test unitario) y
se corrigió antes de comitear esa fase. Es la razón concreta por la que el
plan exigía `npm run qa` en navegador real para la Fase 4 y la Fase 8: jsdom
no tiene `requestAnimationFrame` real ni gestos táctiles, así que un test
unitario con mocks no lo habría detectado — el mock de `shouldStartPan`
habría "pasado" con la rama que faltaba.

### Decisiones de orden entre fases

- `useCanvasCoordinates` recibe `updateCamera` inyectado (definido en
  `useCanvasInteractionLoop`) en vez de recrearlo, para no duplicar el
  batching de rAF.
- `useCanvasStructuralEdit` recibe `cancelActiveInteraction` inyectado desde
  `useCanvasPointerGestures`, así que su llamada en `StructuralCanvas.tsx`
  quedó después de la del hook de gestos.
- `useCanvasPointerGestures` recibe `clearLongPressTimer` inyectado desde
  `useCanvasInteractionLoop` en vez de redefinirlo — evita dos instancias
  operando sobre las mismas refs.
- Las refs mutables (`cameraRef`, `interactionRef`, refs de rAF, refs de
  gestos) las sigue creando `StructuralCanvas.tsx` con `useRef`; cada hook
  sólo las consume, nunca las duplica.

## Por qué

Quedó como pendiente explícito en el reporte anterior
(`reports/2026-08-24-0338-versiones-y-diff.md`): *"Partición de
`StructuralCanvas.tsx` (~2350 líneas)"*. El usuario pidió mejoras al
repositorio con permiso amplio; en vez de inventar trabajo, se usó esa
lista de pendientes ya identificada por el otro agente que trabaja este
proyecto, y se le pidió al usuario elegir cuál atacar — eligió esta.

## Archivos tocados

- `src/features/canvas/StructuralCanvas.tsx` — reducido de 2497 a 1390
  líneas; ahora es principalmente wiring de estado + JSX.
- `src/features/canvas/CutInspector.tsx` *(nuevo)* + test
- `src/features/canvas/useCanvasDerivedGeometry.ts` *(nuevo)* + test
- `src/features/canvas/useCanvasCoordinates.ts` *(nuevo)* + test
- `src/features/canvas/useCanvasInteractionLoop.ts` *(nuevo)* + test
- `src/features/canvas/useStableCanvasEvent.ts` *(nuevo, extraído)* + test
- `src/features/canvas/useCanvasModelActions.ts` *(nuevo)* + test
- `src/features/canvas/useCanvasToolDispatch.ts` *(nuevo)* + test
- `src/features/canvas/useCanvasStructuralEdit.ts` *(nuevo)* + test
- `src/features/canvas/useCanvasPointerGestures.ts` *(nuevo)* + test

Frontera protegida intacta en las ocho fases: 49 archivos verificados en
cada una.

## Cómo verificar

```bash
npm run verify        # lint · docs · frontera protegida · pruebas · build · presupuesto
npm run qa             # PLAYWRIGHT_CHANNEL=chromium PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
npm run verify:space3d
node scripts/validate-ci.mjs
```

Leído de esta ejecución final:

- `npm run verify` — **exit=0**. **263 archivos / 2669 pruebas** (8
  omitidas). «Frontera protegida intacta: 49 archivos verificados».
- `npm run qa` — **exit=0**, **191 checks**, ninguno en `false`, cero
  consola y cero errores de página. Incluye `spacePan`, `mobilePinchZoom`,
  `mobileTouchDragOnNodePans`, `mobileTouchDragPreservesNode` y
  `mobileTouchPlacesLoad` — los flujos que dependían de la Fase 8.
- `npm run verify:space3d` — **exit=0**, 213 pruebas, capacidad aprobada
  (150 nudos / 300 barras).
- `node scripts/validate-ci.mjs` — **exit=0**, 3 workflows sin problemas
  detectables.

Cada una de las ocho fases se comiteó y verificó por separado (tests
dirigidos + `npm run build` + `verify:protected` en cada una, más
`npm run qa` completo en las Fases 4, 5, 6, 7 y 8) antes de pasar a la
siguiente, para que un problema quedara acotado a una sola fase.

## Pendiente / siguiente paso

De la lista de pendientes del reporte anterior quedan dos sin tocar en este
bloque:

1. **Guardar en disco y compartir** (`saveBytes`, `buildShareLink`).
2. **Diálogo de la propuesta de IA**, con el diff y la confirmación
   (`projectDiffSummary.ts` ya está listo para alimentarlo).

Y los ya nombrados de antes, sin resolver: el reparto de la fila del hub
(nombre del proyecto truncado), la descripción de una sección construida sin
persistir, el certificado y los estudios fuera de la memoria PDF, y P-Delta
con barras de signo restringido avisando en vez de componer.

Dentro de esta partición, nada quedó pendiente: las ocho fases están
completas, comiteadas y verificadas.
