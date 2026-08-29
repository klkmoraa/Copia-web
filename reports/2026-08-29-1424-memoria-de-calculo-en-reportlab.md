# Reporte de entrega: la memoria de cálculo pasa a Python + ReportLab

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-reportlab-migration-79ofmk` (partiendo de `5134657`, punta de `claude/pdf-diagrams-improvements-2vopp2`)
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

> «Migra todo el generador de reportes PDF a Python + ReportLab, funcionando 100% local, sin
> internet ni IA. Conserva cálculos, contenido, diagramas y funciones actuales. TypeScript genera
> un JSON normalizado; ReportLab solo renderiza. Crea componentes reutilizables para vigas,
> pórticos, DCL, ecuaciones, tablas y diagramas. Soporta reportes pequeños y grandes sin perder
> calidad. Mantén gráficos vectoriales, paginación, encabezados y verificaciones. Elimina el
> generador y dependencias anteriores solo cuando ReportLab los reemplace completamente. No
> cambies UI, lógica estructural ni branding. Verifica la generación desde la app.»

## 2. La decisión que lo condiciona todo, y por qué

structureCo es una aplicación de navegador que se publica como sitio estático y funciona como
PWA sin conexión. ReportLab es una biblioteca de Python. «Funcionando 100 % local, sin internet»
y «verifica la generación desde la app» sólo se cumplen a la vez de una manera: **el intérprete
de Python viaja con la aplicación**. Se usa Pyodide (CPython compilado a WebAssembly), servido
desde los propios activos del build, nunca desde un CDN.

Lo que eso conserva:

- El modelo que alguien va a firmar **no sale de su máquina**. No hay servicio que se caiga, ni
  subida, ni clave.
- Una PWA instalada **sin conexión** genera el mismo documento que con ella, byte a byte.
- La UI no cambia: el mismo menú, el mismo diálogo de vista previa, los mismos interruptores de
  contenido, el mismo nombre de archivo.

Lo que cuesta: **13,1 MB** de activos diferidos —intérprete, biblioteca estándar y la rueda de
ReportLab— que se piden la primera vez que alguien exporta un informe, y ~2 s de arranque. No
entran en la carga inicial (`npm run verify:entry` y el presupuesto siguen midiendo 823 012 B /
213 160 gzip, lo mismo que antes) y el service worker los cachea con el resto del shell.

La rueda va **vendida en el repositorio** (`vendor/reportlab-5.0.1-py3-none-any.whl`, 1,96 MB):
no está en npm, y un build que fuese a buscarla a PyPI no sería reproducible ni offline. Es una
rueda pura de Python, así que se monta en `sys.path` y se importa desde el zip — sin instalador
y sin compilador.

## 3. La costura

```
  ProjectModel + AnalysisResult
        │
        ▼  TypeScript: decide
  src/utils/pdf/**            ── secciones, tablas, escenas, MathJax
        │
        ▼  ReportDocument (JSON puro, sin funciones, sin colores, sin fuentes, sin páginas)
  src/utils/pdf/reportDocument.ts
        │
        ▼  Python: dibuja
  python/structureco_report/  ── ReportLab sobre Pyodide
        │
        ▼
  bytes del PDF
```

Dos propiedades sostienen la costura, y son las que hacen que el reparto sea comprobable:

- **Es JSON plano.** Un tono es el nombre de un token (`'moment'`), una cara es un nombre
  (`'bold'`), una longitud es un número en puntos. `JSON.stringify` de un `ReportDocument` es
  exactamente lo que el renderizador analiza.
- **No menciona páginas.** Los bloques fluyen y el renderizador los rompe; las marcas de una
  figura están en coordenadas **locales a la figura**, con origen en su esquina inferior
  izquierda. Una figura compuesta aquí es correcta caiga donde caiga.

### Qué se quedó de cada lado

| Decide TypeScript | Dibuja ReportLab |
|---|---|
| Qué partes tiene el documento y en qué orden | Dónde rompe cada página |
| Qué dice cada tabla | Anchos de columna, envoltura, encabezado repetido, salto entre filas |
| Qué marca lleva un DCL y dónde | Cómo se traza cada marca |
| Tipografía matemática (MathJax → contornos) | El relleno de esos contornos |
| Qué facts lleva la portada | La portada, el índice, el cromo y los marcadores |

La tipografía matemática **no** cruza. No hay motor TeX en el paquete de Python y no debe
haberlo: el renderizador rellena contornos que se le entregan, así que la misma expresión se lee
igual en una prueba de Vitest y en el navegador.

## 4. Qué se escribió

### 4.1 El lado de TypeScript

| Archivo | Qué es |
|---|---|
| `reportDocument.ts` (nuevo) | Los tipos del documento normalizado: partes, bloques, marcas vectoriales, portada, metadatos, adjunto. |
| `pdfSurface.ts` (nuevo) | La superficie de dibujo. Mismos nombres y mismas formas de argumento que la página que sustituye, así que `pdfScene.ts` y sus llamantes conservaron su geometría intacta; sólo cambió dónde caen las marcas. |
| `standardFontWidths.ts` (nuevo, generado) | Anchos de Helvetica, Helvetica-Bold y Times-Roman, **generados desde las propias tablas de ReportLab** a través de su vector WinAnsi. Un rótulo medido en TypeScript y compuesto en Python miden el mismo glifo. |
| `pdfBuilder.ts` (reescrito) | `PdfLayout` deja de ser un motor de flujo vertical y pasa a ser un grabador. Misma superficie de llamada (`part`, `heading`, `text`, `table`, `figure`, `callout`…), pero sin página y sin cursor `y`. |
| `pdfFrontMatter.ts` (reescrito) | Ya no dibuja: declara el contenido de la portada. |
| `pdfPayloadSection.ts` (reescrito) | Ya no escribe en el PDF: declara metadatos y adjunto. |
| `pdfOutline.ts` (eliminado) | Los marcadores los escribe el renderizador, que es el único lado que sabe en qué página cayó cada parte. |
| `reportlabRenderer.ts` (nuevo) | La costura, en una función. `setReportRenderer` la sustituye para las pruebas y la QA. |
| `pythonRuntime.ts` (nuevo) | Arranca Pyodide desde los activos de la app, monta la rueda y `python/**`, y ejecuta el renderizador. |

### 4.2 El paquete de Python

`python/structureco_report/` — 9 módulos, componentes reutilizables:

| Módulo | Qué compone |
|---|---|
| `theme.py` | La paleta por nombre de token, la escala tipográfica, el ritmo vertical. |
| `text.py` | Medida y envoltura con la misma regla que `pdfGlyphs.wrapText`. |
| `paths.py` | Un lector de rutas SVG: los contornos de MathJax llegan como `M289 629Q289 635…`, sin separadores. Las cuadráticas se **elevan** exactamente a cúbicas, no se aproximan. |
| `marks.py` | Las primitivas de dibujo: línea, polilínea, rectángulo, círculo, texto, contorno. Aquí viven las vigas, los pórticos, los DCL y los diagramas: hay **una** implementación de cada trazo, y por eso todos los dibujos del informe hablan el mismo idioma. |
| `blocks.py` | Los bloques como *flowables*: encabezado, prosa, rótulo, viñetas, rejilla clave/valor, tira de cifras, aviso, filete, aire, figura, ecuación. Cada uno sabe su medida y su corte. |
| `tables.py` | La tabla: anchos, envoltura por columna, encabezado que se repite, corte entre filas y nunca a través de una. |
| `frontmatter.py` | La portada y el índice. |
| `document.py` | El armazón: marco, cromo, marcadores y el lienzo diferido. |
| `render.py` | La entrada pública: documento JSON dentro, bytes fuera. |

`python/pilshim/PIL/` es un sustituto de Pillow de dos nombres. `reportlab.lib.utils` importa
`PIL.Image` en el ámbito del módulo, y Pillow es una extensión compilada: cargarla significaría
arrastrar una compilación WebAssembly de libjpeg, libpng y zlib para un documento **que no tiene
ni una imagen de trama**. Todo lo que dibuja el informe es vectorial. Pedir una trama lanza con
una frase que dice por qué, en vez de fallar dentro de ReportLab.

### 4.3 El lienzo diferido, que es la parte con truco

Un encabezado que dice «página 7 de 24» no se puede dibujar mientras se compone la página 7,
porque 24 todavía no existe. Tampoco la columna de folios del índice, ni el nombre de la parte a
la que pertenece una hoja cuando una parte se desborda. Así que la primera pasada compone sólo
el cuerpo y va anotando; la pasada diferida recorre las páginas guardadas y pinta el cromo, la
portada, el índice y los marcadores con el documento entero en la mano. **Es una sola
composición**, no dos: nada se maqueta dos veces.

## 5. Un defecto encontrado y corregido durante el trabajo

La primera renderización imprimió **todos los dígitos boca abajo**. MathJax compone la fórmula
en un SVG cuya raíz lleva `scale(1, -1)`, así que la `d` que llega ya es negativa; y los
contornos de los glifos están dibujados con la `y` hacia abajo, lo que la vuelve a girar. Son dos
volteos: la matriz compuesta expresa uno, y el segundo es una convención del contorno que el
árbol no declara en ninguna parte. El renderizador anterior lo recibía gratis de `drawSvgPath`
de `pdf-lib`, que lleva un `scale(s, -s)` cableado dentro. Con el dibujo en ReportLab, que no
aplica ninguna convención propia, el volteo hay que escribirlo. Está escrito, explicado, y
`mathVector.test.ts` lo fija: comprueba que la escala vertical que recibe el renderizador es
**positiva** y que la tinta de una `M` cae por encima de la línea base.

## 6. Qué se eliminó, y cuándo

`pdf-lib` **ya no es dependencia**. Se retiró sólo cuando ReportLab cubría sus tres usos:

1. El generador del informe → ReportLab.
2. El adjunto portable (`/EmbeddedFiles`) → `attachment.py`, contra los objetos de bajo nivel de
   ReportLab, con la misma forma que el generador anterior escribía a mano.
3. Las fixtures de PDF **ajenos** de la ruta de importación → `foreignPdfFixture.ts`, cuarenta
   líneas de sintaxis PDF sin dependencia, alcanzables sólo desde una prueba. Son PDF que a
   propósito **no** son de structureCo (uno de otro programa, uno escaneado sin texto), y por eso
   el renderizador del producto no puede fabricarlos.

`qa-webkit.mjs` fabricaba su PDF nativo con `pdf-lib`; ahora lo fabrica **el renderizador del
producto**, que es lo correcto: lo que comprueba es que un documento de structureCo vuelve a
entrar en la aplicación, así que debe ser un documento de structureCo.

También desapareció `drawFormulaCard`, que sólo alcanzaba una prueba: la tarjeta que dibujaba no
tenía ningún llamante en el producto.

## 7. Verificación

### Gates del repositorio

```
npm run lint                    limpio (15 avisos preexistentes, 0 errores)
npm run verify:docs             10 documentos clasificados, enlaces válidos
npm run verify:protected        frontera intacta: 50 archivos verificados
npm test                        314 archivos · 3009 pruebas · 8 omitidas · 0 fallos
npm run build                   ✓
npm run verify:perf             823 012 B / 213 160 gzip (sin techo bloqueante)
npm run verify:entry            chunk de entrada limpio
npm run verify:browser-bundle   89 archivos sin construcciones exclusivas de Node
```

Las pruebas que leen el PDF de vuelta —los once métodos, las fichas de material, la calidad
editorial, el expediente portable— rinden **a través del mismo ReportLab que usa el producto**,
sobre el mismo Pyodide, arrancado desde `node_modules` en lugar de desde los activos
(`scripts/report-renderer.mjs`). No hay ningún doble de prueba en esa ruta.

### Gate nuevo: generación desde la app

`npm run qa:calculation-report` abre la **aplicación construida** en Chromium, pide el informe
por donde lo pide un lector —el menú de exportación— y comprueba lo que sale. Existe porque en
Vitest el intérprete se arranca desde `node_modules`: una prueba verde no dice nada sobre si el
navegador encuentra `assets/pyodide/*`, ni sobre si la rueda se sirve con el tipo correcto. Es
exactamente la clase de defecto que sólo ve un gate sobre el artefacto construido — la misma
razón por la que existe `check-browser-bundle.mjs`. Y encontró uno: faltaba emitir
`pyodide-lock.json`, sin el cual el arranque moría con `Unexpected token '<'` porque el fallback
de la SPA devolvía `index.html`.

```
OK    la vista previa pinta páginas del documento  {"pages":12,"renderMs":354}
OK    el contador declara un documento de varias páginas  {"counter":"Página 1 de 12"}
OK    el intérprete y la rueda se sirvieron desde el propio origen
OK    la rueda de ReportLab se descargó
OK    descarga un PDF con nombre de memoria
OK    el archivo descargado es un PDF real  {"bytes":37959}
OK    lleva el expediente adjunto para reimportarse
OK    la consola no registró errores durante la generación
```

### Inspección editorial de un informe real

`node scripts/inspect-pdf.mjs` sobre la práctica tipo Hibbeler (viga de dos tramos con carga
distribuida y puntual):

```
Paginas:   18
Texto:     18 651 caracteres extraibles
Metadata:  Title / Author / Subject / Creator completos
Hallazgos: 3  (los tres son el logotipo del lomo de la portada, fuera de margen a propósito)
```

Sin páginas en blanco, sin encabezados huérfanos, sin pérdida de glifos, sin texto fuera de caja.

## 8. Diferencias observables respecto al documento anterior

Tres, todas menores, todas deliberadas:

1. **Formato de fecha del `/Info`.** `D:20260802120000Z` pasa a `D:20260802120000+00'00'`, que es
   la forma que ISO 32000 §7.9.4 da para UTC. La fecha sigue saliendo del `generatedAt` del
   expediente y no del reloj, que es lo que hace el archivo reproducible.
2. **Versión del PDF.** 1.4 → 1.7, la primera en la que todo lector trata `/UF` y el árbol de
   nombres de archivos incrustados como normativos.
3. **La tinta de las ecuaciones desarrolladas** era un literal `rgb(0.24, 0.28, 0.34)` heredado
   de la paleta anterior a 0.8.3; ahora es el token `ink`, que es lo que `pdfTheme.ts` lleva
   diciendo desde entonces que debe ocurrir con cualquier color del documento.

Ni la UI, ni la lógica estructural, ni el branding, ni el contenido cambiaron. La numeración de
figuras se conserva exactamente: las dos ilustraciones que nunca fueron figuras numeradas —la
curva elástica y la viga conjugada— se emiten con `layout.plate()`, que reserva el mismo alto sin
consumir número.

## 9. Gates nuevos que sostienen la costura

| Gate | Qué vigila |
|---|---|
| `pdfTheme.test.ts` | Que `theme.py` resuelva **exactamente** los mismos hexes que `REPORT_TOKENS`, que a su vez se comparan contra `tokens.css`. Tres copias, una verdad. |
| `pdfBuilder.test.ts` | Que la regla de anchos de columna sea la misma a los dos lados: una celda tipografiada se compone contra el ancho de aquí y la línea de rejilla se traza con el de allá. |
| `mathVector.test.ts` | El volteo vertical del §5, y que la caja de la barra de fracción no colapse. |
| `qa:calculation-report` | Que el informe se genere de verdad desde la app construida, con todo servido desde el propio origen. |

## 10. Lo que este cambio no hace

- No toca `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx` ni
  `src/types.ts`. La frontera protegida está intacta y verificada.
- No cambia ningún número. Cada cifra del informe la sigue resolviendo el mismo solver, y el
  paquete de Python no calcula nada: no sabe qué es un momento flector.
- No introduce ninguna llamada de red en tiempo de ejecución, ni ningún modelo. El intérprete,
  la biblioteca estándar, la rueda y el renderizador salen del propio origen.
