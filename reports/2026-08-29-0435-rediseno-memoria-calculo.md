# Reporte de entrega: rediseño completo de la memoria de cálculo

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdfs-calculos-reales-5ebh2j`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

«Rediseña completamente el PDF, no debe ser igual, cámbialo todo, mejóralo.»

## 2. Qué estaba mal, más allá del gusto

El documento no era un documento: eran dos, encuadernados juntos.

| Problema | Evidencia |
|---|---|
| **Dos lenguajes visuales.** Páginas 1–7 con cabecera verde, banda numerada y paneles con borde; de la 8 en adelante, texto suelto sin cabecera, sin pie y sin número de página. | `pdfChrome.ts` sólo lo dibujaba en las «visuales»; el anexo no lo llamaba. |
| **Dos numeraciones a la vez.** Bandas `01`…`06` en las visuales y un `1.`…`6.` propio dentro del anexo: «la sección 5» significaba dos cosas distintas. | `drawSectionBand(index)` vs. `layout.heading('5. Procedimiento…')`. |
| **Maquetación absoluta que perdía contenido.** Las páginas ejecutiva, de magnitudes y de procedimiento colocaban todo en coordenadas fijas. La de magnitudes cabía exactamente dos miembros y el propio documento anunciaba el recorte como si fuera una decisión editorial. | `operationBottom = 174`, `.slice(0, 2)`, «Se muestran los primeros 2». |
| **Resúmenes cortados a media frase.** La página de procedimiento recortaba cada etapa a dos líneas: la segunda terminaba en «nunca se sustituyó la longitud». | `wrapText(...).slice(0, 2)` sobre paneles de 91 pt. |
| **Índice con techo.** Nueve entradas como máximo, porque a la décima chocaba con el aviso profesional. | `layout.sections.slice(0, 9)`. |
| **Contenido duplicado.** La página de procedimiento y la sección 5 del anexo contaban lo mismo, una de ellas peor. Las funciones por tramo aparecían dos veces. | `drawProcedureSummary` vs. `drawGenericProcedure`. |
| **Color inventado.** Los diagramas usaban azul/verde/rojo en el PDF y teal/verde/naranja en el lienzo. El verde bosque del cromo no existe en el producto. | `rgb(0.02,0.40,0.82)` en `pdfDiagrams.ts` frente a `--sc-color-technical-axial: #0071a4`. |
| **`kN·m` impreso como `kN x m`.** El punto medio es WinAnsi y aun así se transliteraba. | `['·', ' x ']` en `pdfGlyphs.ts`. |

## 3. El documento nuevo

**Un sistema, no una colección de páginas.** `pdfTheme.ts` declara la paleta, la escala tipográfica de seis pasos y la unidad de espaciado; todo lo demás las consume.

**La paleta ya no se inventa: se toma de `tokens.css`,** la fuente única de color del producto, en su apariencia clara. Axial es el teal del lienzo, cortante su verde, momento su naranja; las reacciones, el azul de reacción; las acciones aplicadas, el índigo de carga. Una curva conserva su identidad entre la pantalla y el papel firmado. `pdfTheme.test.ts` lee el CSS real y compara, así que un token que cambie en la app no puede dejar de coincidir en silencio.

**Una sola secuencia de partes.** Portada · Contenido · `01` Resumen del análisis · `02–04` Diagramas N, V y M · `05` Unidades, convenciones y alcance · `06` Procedimiento y cálculos · `07` Modelo y acciones · `08` Resultados nodales y por miembro · `09` Traza del sistema resuelto. `layout.part()` es el único sitio que avanza el número, así que una copia sin diagramas numera 01, 02, 03 sin dejar hueco.

**Un solo cromo, en todas las hojas de cuerpo.** Cabecera corriente con el proyecto a la izquierda y la parte actual a la derecha; pie con el título del documento y el folio. La portada y el índice son portada e índice: no llevan folio.

**Todo fluye.** Se eliminaron las tres páginas de coordenadas fijas. Las primitivas nuevas de `PdfLayout` —`part`, `metrics`, `keyValues`, `bullets`, `callout`, `figure`, `label`, `note`— maquetan sobre el cursor, así que un modelo de cuarenta miembros imprime cuarenta miembros y una etapa larga se lee entera.

**Las figuras se numeran y llevan pie** («Figura 3 — Diagrama V…»), igual que ya lo hacían las ecuaciones, de modo que la prosa puede citarlas.

**Portada e índice separados.** La portada es una página de identidad, con una franja oscura a la izquierda que hace localizable una pila impresa. El índice tiene su propia hoja, sin tope: imprime dos niveles cuando caben en una hoja y sólo las partes cuando no, en vez de cortarse a mitad de lista.

**Se borró la duplicación.** La página-resumen de procedimiento desapareció; la parte `06` es el recorrido completo. Las funciones por tramo se imprimen una vez, en la parte del diagrama que describen.

**El punto medio sobrevive:** `kN·m`, `kip·ft`, `2 nodos · 1 miembros`.

## 4. Arquitectura

| Módulo | Estado |
|---|---|
| `pdf/pdfTheme.ts` | **Nuevo.** Paleta desde tokens, escala tipográfica, espaciado. |
| `pdf/pdfBuilder.ts` | Reescrito: primitivas nuevas, cromo corriente, numeración de partes y figuras. |
| `pdf/pdfChrome.ts` | Reescrito: sólo lo que la portada y las figuras necesitan; fuera masthead, banda y paneles. |
| `pdf/pdfFrontMatter.ts` | Reescrito: portada e índice en hojas propias. |
| `pdf/pdfCover.ts` → `pdf/pdfSummarySection.ts` | Renombrado (dibujaba el resumen, no la portada) y reescrito en flujo. |
| `pdf/pdfQuantitySection.ts`, `pdfProcedureSection.ts`, `pdfScopeSection.ts` | Reescritos en flujo. |
| `pdf/pdfAnnexSection.ts` | **Eliminado.** Sus 500 líneas se reparten en `pdfModelSection.ts`, `pdfResultsSection.ts` y `pdfTraceSection.ts`; su sección 5 pasó a `pdfProcedureSection.ts`. |
| `pdf/pdfDiagrams.ts` | Colores desde la paleta; `drawGlobalDcl` y `drawMemberDiagrams` pasan a recibir un rectángulo, para componer con `layout.figure`. |
| `pdf/pdfGlyphs.ts` | El punto medio deja de transliterarse. |

`src/engine/**`, `src/data/**` y `src/types.ts` quedan byte a byte idénticos.

## 5. Verificación ejecutada

`npm run verify` completo, en verde: lint · documentación · frontera protegida (50 archivos) · pruebas (310 ficheros, 2960 pasadas, 8 saltadas) · build · presupuesto · chunk de entrada.

Gates nuevos y actualizados:

- **`pdfTheme.test.ts` (nuevo, 5 pruebas).** Parsea `tokens.css` y exige que cada color de la memoria sea el token del producto; que ninguna acción aplicada comparta tono con una respuesta (en el DCL, una causa no puede confundirse con un efecto); y que la escala tipográfica sea monótona y nunca baje de 6 pt.
- **`calculationPdf.test.ts` (reescrito, 6 pruebas).** Cada parte abre su propia página y en el orden que promete el índice; los diagramas se desarrollan con la pendiente medida; **un modelo de ocho vanos imprime los ocho** y el documento ya no se disculpa por lo que no cabía; una copia recortada numera sin huecos.
- **`calculationPdfEditorial.test.ts`.** La prueba de cromo pasa a exigir que **toda** hoja de cuerpo lleve cabecera, pie y folio —lo que el anexo nunca tuvo— y que la portada y el índice no los lleven.
- **`pdfGlyphs.test.ts`.** El punto medio se conserva; su gemelo matemático U+22C5 se pliega sobre él.
- **`pdfBuilder.test.ts`.** Construye con la paleta real en vez de una de mentira.

## 6. Lo que este rediseño no hace

- **No cambia ninguna cifra.** Es maquetación, tipografía y color: los números, las sustituciones y las verificaciones son los de las dos entregas anteriores.
- **No toca las opciones del diálogo de vista previa** (`includeDiagrams`, `includeScope`, `includeProcedure`, `includeAnnex`, `includeEducationTrace`) ni sus claves de i18n, para no arrastrar la interfaz en un cambio de documento. `includeAnnex` gobierna ahora tres partes en vez de una.
- **No pagina el índice.** Si un documento llegara a tener más partes de las que caben en una hoja, el índice imprime sólo las partes; el panel de marcadores sigue llevando el detalle completo.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`).
