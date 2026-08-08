# Slice 2.3 - App Shell responsive

Fecha: 2026-07-17  
Estado: gate aprobado.

## Composición aplicada

| Rango | Composición |
| --- | --- |
| >=1440 | Desktop wide con rail e inspector persistentes. |
| 1280-1439 | Desktop standard; compactación de utilidades se completa en Slice 2.4. |
| 1024-1279 | Rail de 76 px, inspector de 290 px y contexto secundario al overflow. |
| 768-1023 | Tablet con dock inferior, resultados colapsables e inspector drawer. |
| <768 | Header mínimo, dock móvil y paneles dedicados existentes. |

El breakpoint funcional de tablet pasó de 960 a 1023 px para evitar desktop comprimido. No detecta dispositivos; responde al ancho disponible.

## Evidencia geométrica

| Viewport | Canvas | Overlaps TopBar | Overflow horizontal | Selección/análisis |
| --- | --- | --- | --- | --- |
| 1194 x 834 | 828 x 414 | 0 | 0 px | M2 + resultados conservados |
| 1024 x 768 | 658 x 348 | 0 | 0 px | M2 + resultados conservados |
| 834 x 1194 | 834 x 1018, resultados colapsables | 0 | 0 px | M2 + resultados conservados |
| 390 x 844 | 390 x 674, resultados colapsables | 0 | 0 px | M2 + resultados conservados |

## Panel móvil

- Inspector abierto dentro de 390 x 844: `left=0`, `right=390`, `bottom=844`.
- TopBar, toolbar y center-stage reciben `inert` y `aria-hidden=true` mientras el dialog está abierto.
- Al cerrar, el foco vuelve a `Abrir inspector`.
- Sin scroll trap ni overflow horizontal.

## Gate

- [x] 1194 x 834 sin colisión y con canvas útil.
- [x] 834 x 1194 y 390 x 844 sin overflow.
- [x] Panel abre/cierra, aísla el fondo y restaura foco.
- [x] Selección y análisis no se pierden al cambiar viewport.
- [x] `npm.cmd run verify`: 40 archivos, 229 pruebas y build aprobados.
- [x] Sin cambios en motor, workers, datos o contratos.
