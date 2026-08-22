# Evidencia visual · rediseño a la identidad de sistema

**Clasificación:** `AUDIT/TEMPORARY`

Capturas del producto **después** del rediseño que retira la identidad de arcilla
(marfil cálido, menta/esmeralda, sombras de doble luz, radios 10/18/24/28 y serif
editorial) y la sustituye por la de una aplicación de escritorio del sistema.

No hay pareja `before/`: la identidad anterior está documentada en
`brand/brandbook-clay.html`, que se conserva sin tocar, y sus capturas viven en
las carpetas de evidencia de los slices que la construyeron
(`2026-08-21-clay-foundations` y siguientes).

| Captura | Qué muestra |
|---|---|
| `1-bienvenida-{light,dark}.png` | Portal de entrada: marca nueva, cabecera de cristal, tarjetas y el pórtico isométrico. |
| `2-mesa-{light,dark}.png` | Espacio de trabajo: barra unificada, barra lateral con selección de acento, chrome del lienzo translúcido. |
| `3-resultados-{light,dark}.png` | Modelo analizado: diagrama de momentos, anotaciones del lienzo, inspector y centro analítico. |

Tomadas a 1600×950 sobre el servidor de desarrollo, con la biblioteca de
proyectos vacía y el ejemplo `Pórtico de ejemplo` cargado desde la bienvenida.

## Qué NO son estas capturas

No son especificación ni prueba de nada. La autoridad del sistema visual es
`src/design-system/tokens.css`; lo que verifica que el producto lo cumple son
`tokens.test.ts`, `surfaceGeometry.test.ts`, `material.test.ts`,
`typography.test.ts` y los 145 checks de `npm run qa`. Una captura envejece; un
gate no.
