# Reporte de entrega: vista previa del PDF y composición matemática de la memoria

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-preview-before-download-5r1bp3`
**Commits:** `4f29012`, `e9586a8`, `77827f8`

---

## 1. Qué se pidió y qué se entregó

La petición fue poder ver el PDF antes de descargarlo, y «proponer mejoras para el
PDF». Al abrir el generador apareció un problema mayor que la descarga, así que la
tarea acabó teniendo dos mitades de peso parecido.

| Entregado | Dónde |
|---|---|
| Diálogo de vista previa con opciones de contenido | `src/features/import-export/PdfPreviewDialog.tsx` |
| Rasterizado de páginas y arranque compartido de PDF.js | `pdfPageRenderer.ts`, `src/utils/pdfjsRuntime.ts` |
| Composición matemática real (Symbol, fracciones, envoltura) | `src/utils/pdf/pdfMath.ts`, `pdfGlyphs.ts` |
| Tildes en toda la memoria | los ocho módulos de `src/utils/pdf/` |
| Portada, índice y marcadores | `pdfFrontMatter.ts`, `pdfOutline.ts` |
| Metadatos y PDF reproducible | `pdfPayloadSection.ts` |

Fuera de alcance por decisión del usuario: marca de agua de estado y bloque de firmas.

## 2. El hallazgo que reorientó la tarea

`src/engine/solver.ts` —frontera protegida— **ya publicaba las ecuaciones bien
escritas**: `ΔX = Xⱼ − Xᵢ`, `L = √(ΔX² + ΔY²)`, `dθ/dx = M/EI`. El PDF las imprimía
como `DeltaX = X^j - X^i`, `L = sqrt(DeltaX^2 + DeltaY^2)`, `dtheta/dx = M/EI`.

Dos causas, ambas en la capa de dibujo:

1. `pdfGlyphs.pdfText` transcribía a ASCII todo glifo fuera de WinAnsi, porque
   Helvetica y Times sólo traen esa codificación.
2. `pdfAnnexSection.ts:372` —donde viven las ecuaciones completas— las sacaba por
   `layout.text()`, es decir prosa en Helvetica, sin pasar por el tipógrafo. Ahí los
   `^` y `_` se veían literalmente.

La salida fue `StandardFonts.Symbol`, que `pdf-lib` ya trae. Se sondearon 90
codepoints: **86 codifican** (todo el griego, `√ ∫ ∑ ∏ ≤ ≥ ≠ ± × ÷ ∞ ∂ ∇ → ⇒ − ⋅ ≈`),
y sólo fallan `·`, `∥`, `⟨`, `⟩`, que conservan su transcripción. Ni una dependencia
nueva ni un byte de descarga: Symbol es una de las catorce fuentes estándar de PDF.

## 3. Defectos encontrados por el camino

- **`ᵢ` y `ⱼ` mapeados a `^i`/`^j`.** Son subíndices Unicode. Los índices de nodo de
  `ΔX = Xⱼ − Xᵢ` se imprimían como exponentes.
- **Los marcadores `^`/`_` sólo elevaban un glifo.** `d_local` salía como `d` con
  subíndice `l` seguido de `ocal` a tamaño normal. Ahora reclaman la palabra
  alfanumérica completa, que es como el motor las escribe (`f_source`, `N_theta`).
- **La ecuación clave se cortaba a 92 caracteres** con puntos suspensivos, a veces a
  mitad de símbolo. Ahora se envuelve por sus operadores.
- **`ΣFx` y `κ₁` salían `SumFx` y `kappa_1`** en las tablas de resultados.
- **Las fechas salían del reloj**, así que dos exportaciones del mismo modelo nunca
  coincidían byte a byte.
- **El nombre del archivo** se acentuó por error al aplicar las tildes y se revirtió:
  un `.pdf` con tilde es frágil fuera del navegador.

## 4. Decisiones que se apartan del plan aprobado

- **No se añadió la leyenda «donde:»** prevista en A5. Las etiquetas del motor son
  prosa —`κ₁ estimada (sistema escalado)`, `Residuo equilibrio físico`—, no pares
  símbolo-definición; construirla mecánicamente habría producido renglones sin
  sentido. En su lugar se recuperaron los símbolos de esas etiquetas, que sí era un
  defecto real y visible.
- **No se implementó el tamaño Carta.** El plan ya lo marcaba como el punto de más
  roce (hay posiciones absolutas calculadas contra el alto A4 en `pdfCover.ts` y
  `pdfProcedureSection.ts`) y como candidato a quedar fuera. El diálogo entrega las
  cinco opciones de contenido; el tamaño de página queda pendiente.
- **Sin miniaturas ni presets de zoom**, conforme a lo elegido: el cuerpo es scroll
  continuo con contador de página en vivo.

## 5. Comportamiento nuevo del flujo de exportación

«PDF completo reimportable» ya no descarga: retiene el análisis y abre el diálogo,
que compone el informe, lo enseña y lo entrega desde su propio pie. Consecuencias
deliberadas:

- Se previsualizan **los bytes que se van a guardar**, no un dibujo aparte del modelo.
- Las páginas se rasterizan al entrar en pantalla; sin `IntersectionObserver` se
  pintan todas.
- Recomponer va con retardo: marcar tres casillas paga una recomposición.
- Componer y dibujar fallan por separado, porque dejan al lector en sitios distintos:
  sin documento no hay descarga; un documento que sólo no se pintó se descarga igual.
- Descargar sale de un clic dentro del diálogo, lo que devuelve la activación
  transitoria que `navigator.share` exige y que una exportación asíncrona perdía en
  Safari (aviso ya documentado en `portableDownload.ts:22`).

## 6. Verificación ejecutada

`npm run verify` completo, en verde:

```
Frontera protegida intacta: 50 archivos verificados.
Test Files  289 passed (289)
     Tests  2826 passed | 8 skipped (2834)
Métrica de rendimiento: 817782 bytes / 211792 gzip
Chunk de entrada limpio
```

`pdf-lib` y PDF.js siguen fuera del chunk de entrada: el diálogo y el rasterizador
entran por `lazy()`, y `pdfOutline` recibe las factorías de pdf-lib como parámetro en
vez de importarlas.

Pruebas nuevas: `pdfGlyphs.test.ts` (6), `pdfMath.test.ts` (7),
`PdfPreviewDialog.test.tsx` (6), más cuatro casos en `calculationPdfEditorial.test.ts`
(símbolos, portada e índice, marcadores y metadatos, bytes reproducibles).

Pruebas actualizadas, todas por cambio de comportamiento real y no por conveniencia:
las tres de `TopBar.test.tsx` que afirmaban la descarga inmediata ahora pasan por el
diálogo; las aserciones que fijaban texto sin tilde, el guión bajo literal de
`d_local` y la barra de `dV/dx` se ajustaron a un dibujo donde eso es geometría y ya
no un carácter.

## 7. Pendiente comprobado sólo por extracción de texto

El contenido del PDF se verificó extrayendo texto con PDF.js y leyendo los marcadores
y metadatos del archivo. **No se abrió el PDF en un lector gráfico ni se ejecutó la
aplicación en un navegador**: la maquetación de las fracciones apiladas y el aspecto
del diálogo no están comprobados a ojo. `npm run qa` (Playwright) tampoco se ejecutó.
