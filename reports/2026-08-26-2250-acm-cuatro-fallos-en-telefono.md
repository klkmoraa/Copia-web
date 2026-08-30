# El ACM no servía en el teléfono · cuatro fallos, medidos y corregidos

**Fecha:** 2026-08-26 22:50
**Agente:** Claude Code
**Rama:** main

## Qué pasaba
El usuario abrió la página publicada en un iPhone y reportó que el ACM «no sirve», con
fallos visibles. Reproducido en Chromium a 390×844 con toque, sobre el mismo `dist`.
Los cuatro, con números antes de tocar nada:

| Fallo | Medida |
|---|---|
| El despliegue nacía fuera de la pantalla | sobresalía **136 px por debajo** del lienzo (558 px de alto) |
| El selector de carriles se salía del lienzo | `x = −54 px`: recortado por el borde izquierdo |
| La barra partía en dos renglones | 70 px de alto en vez de 38 |
| El ACM encendido se pintaba apagado | `aria-pressed=true` con fondo `rgb(245,245,247)` |

## Por qué pasaba cada uno
1. **Franja fija.** Los carriles medían 88 px y el aire bajo el modelo 104, pasara lo que
   pasara: 392 px de franja bajo un lienzo de 558. El momento caía fuera y el botón
   parecía no hacer nada. Además, desplegar no reencuadraba.
2. **Panel anclado al grupo ACM**, que vive cerca del borde derecho de la barra. Cualquier
   panel más ancho que su ancla acaba fuera de la pantalla.
3. **`left:50%` sobre una caja absoluta.** El espacio disponible para una caja absoluta con
   sólo `left` es lo que queda **a su derecha**: 195 px de 390. La barra se estrechaba y
   partía por falta de sitio, no por ancho de contenido.
4. **Cascada.** `:hover:not(:disabled)` (0,3,0) pesa más que `[aria-pressed='true']`
   (0,2,0). Con ratón se nota poco; en táctil el hover se queda pegado tras el toque, así
   que el botón encendido se pintaba de reposo. Lo introduje yo al añadir el `:not(:disabled)`.

## Qué se hizo
1. `stackMetricsFor(altoDelLienzo, carriles)`: los carriles ceden alto —hasta un mínimo
   legible de 46 px— y el aire se ajusta antes que salirse. Y **desplegar reencuadra**
   reservando esa franja, con `cameraToFitBounds(..., reservedBottom)`; «Encuadrar» respeta
   la misma reserva mientras el ACM esté abierto.
2. El selector pasa a ser **una fila de la propia barra**, no un panel flotante. Dentro de
   la barra no hay nada que se pueda salir.
3. La barra se centra con `left:0; right:0; margin-inline:auto`, que sí ve el lienzo entero.
4. La regla de hover excluye el pulsado.

**De paso, un fallo latente que no llegó a producirse:** al dar a `fitModel` un parámetro
opcional, `onFit={fitModel}` habría entregado el evento del clic como reserva —
`Math.max(0, MouseEvent)` es NaN y la cámara se rompe. Se pasa siempre un valor explícito.

## Resultado, medido igual que el defecto
| | antes | después |
|---|---|---|
| Despliegue respecto al lienzo | +136 px fuera | 100 px **dentro** |
| Selector | `x = −54` | `x = 16`, entero dentro |
| Alto de la barra | 70 px | 38 px |
| Fondo del ACM pulsado | `rgb(245,245,247)` | `rgb(0,113,235)` |

## Archivos tocados
- `src/features/canvas/diagramStack.ts` — `stackMetricsFor`.
- `src/features/canvas/canvasChromeGeometry.ts` — `reservedBottom` en el encuadre.
- `src/features/canvas/useCanvasCamera.ts` — `fitModel(reservedBottom)`.
- `src/features/canvas/CanvasDiagramStack.tsx` — métricas del lienzo real.
- `src/features/canvas/CanvasEvidenceBar.tsx` — selector como fila de la barra.
- `src/features/canvas/StructuralCanvas.tsx` — reserva, reencuadre al desplegar, `onFit` explícito.
- `src/features/canvas/phase2.css` — centrado, fila del selector, hover que no pisa al pulsado.
- Pruebas: `diagramStack.test.ts` (+4 sobre las métricas) y `CanvasEvidenceBar.test.tsx`
  (+1, guarda de cascada: ninguna regla de hover del botón puede omitir
  `:not([aria-pressed='true'])`).

## Cómo verificar
```bash
npm run verify   # 258 archivos de prueba, 2666 pruebas, frontera protegida intacta
```
Y en un teléfono: analizar → ACM. Los tres carriles quedan bajo el modelo, dentro de la
pantalla, y el botón se ve encendido.

## Límite conocido
Con la hoja del inspector abierta en «Media», tapa la mitad inferior del lienzo y con ella
los carriles. No es propio del ACM —tapa igual las reacciones y la deformada—, así que no
se toca aquí.

## Pendiente / siguiente paso
Nada pendiente.
