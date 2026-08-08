# S12 + S13 — Fidelidad de exportación SVG y PNG

- **Agente:** Claude Code (agente principal)
- **Modelo:** Opus 5 (`claude-opus-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Que el SVG y el PNG exportados reproduzcan realmente el dibujo que el usuario ve, sin
depender de la hoja de estilos de la aplicación.

## Hallazgos

### 1. El SVG exportado no podía tener los colores del producto (crítico)

`exportSvgElement` clonaba el SVG vivo, le anteponía una única regla de `font-family` y lo
serializaba. Pero el canvas estructural se pinta casi por completo desde clases de
`styles.css` y desde tokens como `var(--force)` y `var(--shear)`.

Verificado en la aplicación real antes del cambio, sobre el SVG serializado tal cual:

```
classCount:  39        ← 39 atributos class="…" sin hoja de estilos que los defina
cssVarRefs:  ["var(--force)", "var(--shear)", "var(--axial)",
              "var(--warning)", "var(--moment)", "var(--shear)"]
hasStyleTag: false
width:       null
height:      null
```

Es decir: el archivo salía sin ninguna de sus reglas de pintado y sin dimensiones
intrínsecas. Un visor externo lo dibujaba con los valores por defecto de SVG.

### 2. El PNG heredaba el mismo problema y además perdía recursos

`exportSvgAsPng` serializaba el SVG vivo igual de crudo, así que rasterizaba el mismo dibujo
sin estilo. Además:

- no tenía `image.onerror`: un fallo de carga quedaba en silencio para siempre;
- si `getContext('2d')` devolvía `null`, hacía `return` **sin** `URL.revokeObjectURL`,
  filtrando el blob;
- el fondo se leía de `--canvas-bg` del documento y se pintaba aparte, de modo que SVG y PNG
  podían discrepar;
- no había opción de resolución ni de fondo, ni protección frente al límite de canvas del
  navegador.

## Decisiones

- `src/utils/svgExport.ts` recorre el árbol vivo y su clon en paralelo y copia el valor
  **computado** de cada propiedad de pintado. `getComputedStyle` ya resolvió la cascada y las
  custom properties, así que una sola pasada arregla clases y tokens a la vez.
- Los `var()` que sobrevivan se sustituyen explícitamente. No es defensa teórica: los
  marcadores de flecha viven en `<defs>` y se pintan con `fill="var(--force)"` como
  **atributo de presentación**; los motores discrepan sobre si eso llega al estilo computado.
  Cuando hay un atributo con `var()`, ese atributo gana.
- Se declaran `width`/`height` desde el `viewBox`, y `preserveAspectRatio`.
- Fondo elegible: `transparent`, `light`, `dark` o `current`. El fondo se pinta **dentro** del
  SVG, de modo que PNG y SVG ya no pueden discrepar.
- Se retiran clases, atributos que sólo significan algo en una aplicación viva
  (`role`, `aria-keyshortcuts`, `tabindex`…), `<script>`, `<foreignObject>` y cualquier
  atributo `on*`. Un dibujo exportado es un documento, no un programa.
- El PNG rasteriza **el mismo SVG independiente** que se descarga, a su tamaño final. Nunca
  se genera pequeño para escalarlo después.
- `rasterScaleFor` acota la escala al límite práctico de canvas del navegador, con un suelo
  de 1×: un dibujo cuyo tamaño natural ya excede el límite **no se reduce en silencio**;
  se intenta a 1× y, si el navegador se niega, la promesa se rechaza con un mensaje.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/utils/svgExport.ts` | **nuevo**: serializador independiente |
| `src/utils/svgExport.test.ts` | **nuevo**: 14 pruebas |
| `src/utils/rasterExport.test.ts` | **nuevo**: 6 pruebas de escala |
| `src/utils/export.ts` | SVG y PNG usan el serializador; PNG devuelve promesa, maneja error y libera siempre la URL |
| `src/features/canvas/StructuralCanvas.tsx` | pasa título, descripción y fondo; muestra el error de exportación |
| `src/i18n/catalogs.ts` | 2 claves nuevas × 2 idiomas |

## Archivos protegidos comprobados

`node scripts/check-protected-baseline.mjs` → «Frontera protegida intacta: 45 archivos verificados.»

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx oxlint` | limpio |
| `npm run typecheck` | limpio |
| `npx vitest run` | **73 archivos, 487 pruebas, todas en verde** (53,5 s) |
| `npm run build` | correcto |

Delta: 71 → 73 archivos, 467 → 487 pruebas (**+20**).

## Evidencia funcional

Pórtico de ejemplo analizado, tema oscuro, exportación ejecutada en el navegador real:

| Medida | Antes | Después |
|---|---|---|
| `var(--…)` sin resolver | 6 | **0** |
| atributos `class=` | 39 | **0** |
| `xmlns` duplicado | sí | **1 sola vez** |
| `width` / `height` | ausentes | `1000` / `640` |
| `<title>` / `<desc>` | genéricos | «Pórtico» / «evidencia S12» |
| fondo | ninguno | `<rect fill="#0c1012">` (canvas oscuro real) |
| `<script>` / `on*` | no filtrados | eliminados |
| re-parseo como `image/svg+xml` | — | **sin error** |
| marcadores de flecha conservados | — | 6 |
| canvas vivo modificado | — | **no** |

Colores resueltos observados en el archivo: `rgb(255,130,92)` (carga), `rgb(88,207,131)`
(cortante), `rgb(81,189,210)` (axial), `rgb(120,168,255)` (reacción) — corresponden a los
tokens técnicos del tema oscuro.

Rasterización comprobada: la imagen carga, el lienzo resultante es 2000 × 1280 a 2×, el píxel
de esquina es `[12,16,18,255]` = `#0c1012` opaco, y el PNG pesa 95 824 bytes.
`rasterScaleFor(4000,3000,4)` se acota por debajo de 4; `rasterScaleFor(20000,20000,4)` = 1.

## Riesgos

- El estilo se escribe elemento por elemento, así que el archivo es más grande
  (≈50 kB para el pórtico de ejemplo). Es el precio de que no dependa de una hoja externa;
  se prefirió corrección sobre brevedad porque una propiedad heredada omitida daría un color
  equivocado.

## Limitaciones

- **No hay capturas de pantalla:** el panel del navegador no se muestra en esta sesión y la
  página no compone frames. La evidencia es textual y numérica, obtenida ejecutando el módulo
  real en la aplicación real. Las capturas se generarán con Playwright en S17.
- Todavía no existe una interfaz para elegir fondo, resolución o alcance de la exportación
  (modelo, modelo con cargas, diagrama, lámina). El motor ya lo soporta; la interfaz es S04/S10.

## Pendientes

- Exponer en la interfaz las opciones que el serializador ya acepta.
- Aplicar el mismo serializador a los diagramas de `ResultsPanel` e `InfluenceLineView`, que
  hoy no tienen exportación propia de imagen.

## Siguiente paso

S14 — PDF: memoria editorial y anexo técnico.

## Commit local

`fix(export): make svg and png self-contained and faithful`
