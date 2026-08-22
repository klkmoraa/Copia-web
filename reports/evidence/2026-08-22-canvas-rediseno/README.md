# Evidencia visual · rediseño del lienzo

**Clasificación:** `AUDIT/TEMPORARY`

Capturas del lienzo (`src/features/canvas/`) después de la fase P0→P3 del
rediseño. 1600×950 salvo donde se indica, `Pórtico de ejemplo` cargado desde
la bienvenida.

| Captura | Qué muestra |
|---|---|
| `1-lienzo-reposo-{light,dark}.png` | Las 4 esquinas nuevas del lienzo en reposo: riel a la izquierda, badge de modo arriba-izquierda, Navegador (minimapa+escala) abajo-derecha, panel de capas cerrado arriba-derecha. |
| `2-seleccion-barra-contextual.png` | Barra de selección sola en el centro-inferior, sin ninguna superficie flotante tapándola. |
| `3-vista-momento-sin-solape.png` | Modelo analizado, capa de Momento activa: los sellos `Mmax`/`Mmin` con su estación (`x 3.00 m`) no tapan los IDs de nodo ni las cotas — el bug de doble etiquetado (P0) queda cerrado. |
| `4-navegador-revelado.png` | El Navegador con el puntero encima: zoom in/out/encuadrar y el lector de coordenadas revelados por opacidad (nunca `display`). |
| `5-popover-capas-snap-rejilla.png` | El panel de capas migrado a `Popover` del sistema, con Snap y Rejilla como conmutadores reales arriba (antes chips inertes duplicados en Inspector). Corrige también el bug de `max-height` encontrado en esta misma verificación. |
| `6-riel-medir-siempre-visible.png` | El riel de 4 grupos (Navegar·Crear·Cargas·Medir): Cota y Corte visibles sin condición — se retiró `classroomAdvanced`, que antes los escondía en modo Aula. |
| `7-riel-x2-ancho-compacto-1180px.png` | El mismo riel a 1180×820. **Nota:** este ancho sigue resolviendo a la clase `X2` (etiquetas visibles) en este build — la composición `M1` (iconos sin etiqueta) es una pieza de `shellComposition.ts`, ajena a este rediseño, y no se alcanza en viewports reales probados aquí. Se conserva como evidencia de que el riel reorganizado sigue siendo responsive a ese ancho, no como muestra de `M1`. |
| `8-presentacion-k0-tactil.png` | Presentación `K0` táctil a 390×844: dock de herramientas flotante arriba-izquierda, hoja de inspector con detents, lanzador Cargas·Vista·Resultados como dock persistente abajo-derecha. |

## Qué NO son estas capturas

No son especificación ni prueba de nada. La autoridad de layout es
`src/features/canvas/canvasChromeGeometry.ts` y `layoutSmartLabels()`; lo que
verifica que el producto lo cumple es `npm run verify` (2250 pruebas, frontera
protegida, presupuesto de rendimiento) y los 149+ checks de `npm run qa`,
incluida la versión ampliada de `verifyFloatingSurfacesDoNotOverlap` (todos
los pares relevantes, antes 4 de 21). Una captura envejece; un gate no.
