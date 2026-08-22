# Evidencia visual · lanzador de documento y barra unificada

**Clasificación:** `AUDIT/TEMPORARY`

Capturas del producto **después** de la segunda fase del rediseño. La primera
(`2026-08-22-rediseno-identidad-sistema`) cambió la **materia**: paleta
acromática, un solo acento, material en vez de sombra. Ésta cambia la
**disposición y la gramática de interacción**, que era lo que el reporte de
aquella dejaba anotado como pendiente.

La pareja `before/` son las capturas de esa carpeta anterior, tomadas con el
mismo encuadre (1600×950, biblioteca vacía, `Pórtico de ejemplo` cargado desde
la bienvenida) para que se puedan comparar una contra otra.

| Captura | Qué muestra | Contra qué se compara |
|---|---|---|
| `1-lanzador-{light,dark}.png` | Ventana de entrada: dos columnas, seis puertas sin repetición, biblioteca al lado, marco acotado. | `1-bienvenida-*` de la carpeta anterior: asistente de cuatro pasos, puertas duplicadas, media ventana vacía. |
| `2-mesa-{light,dark}.png` | Barra unificada: un ítem de contexto, iconos agrupados, estado con etiqueta. | `2-mesa-*`: cuatro `<select>` rotulados y estado reducido a punto de color. |
| `3-resultados-{light,dark}.png` | Modelo analizado con selección viva: inspector denso, ninguna superficie flotante encima de otra. | `3-resultados-*`: la barra de selección tapando la escala y las pestañas sobre el inspector. |
| `4-plantillas-{light,dark}.png` | La vitrina de ejemplos como diálogo de tres columnas. | Antes era la tercera etapa del recorrido. |
| `5-barra-analisis-1280-light.png` | El popover de análisis a **1280 px**, el ancho exacto donde antes se truncaba a «Caso o com…». | — |
| `6-lanzador-telefono.png` | El lanzador a 390×844: una columna, sin desbordamiento. | Antes el mismo tamaño desbordaba (945 px de contenido en 844 de ventana). |

## Qué NO son estas capturas

No son especificación ni prueba de nada. La autoridad del sistema visual es
`src/design-system/tokens.css`; lo que verifica que el producto lo cumple son
`tokens.test.ts`, `surfaceGeometry.test.ts`, `material.test.ts`,
`typography.test.ts` y los 149 checks de `npm run qa` — cuatro de ellos nuevos y
escritos en esta fase para los solapes y para la ayuda revelada del inspector.
Una captura envejece; un gate no.
