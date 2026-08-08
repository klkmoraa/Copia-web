# AG-003 — Refactor declarativo del módulo de expedientes PDF

**Fecha:** 2026-08-05 13:26
**Agente:** Claude Code
**Rama:** main

## Qué cambió

`src/utils/calculationPdf.ts` era un único closure de 1.058 líneas donde ~20 rutinas de dibujo
capturaban las mismas variables mutables (`page`, `y`) y las constantes de marca. Ahora es un
orquestador de ~90 líneas y la maquetación vive en 13 módulos bajo `src/utils/pdf/`, con
`PdfLayout` como único dueño del cursor vertical y de los saltos de página.

El documento impreso es el mismo: se verificó operador a operador con PDF.js (texto **y**
vectores) que todas las páginas de los dos fixtures de prueba tienen hash idéntico, salvo una
diferencia intencional — la página de «Procedimiento y cálculos» repetía el índice de sección
`05` de «Unidades y convenciones» y pasa a `06`. El payload JSON incrustado, su checksum
SHA-256, el nombre del adjunto y el nombre del archivo no cambiaron.

## Por qué

Implementación de la propuesta aprobada `Antigravity-propuestas/aprobadas/AG-003-...md`. El
módulo funcionaba bien pero tenía toda la maquetación en matemática manual de coordenadas: no se
podía tocar una sección sin releer el archivo entero, y cualquier cambio de tamaño de fuente
obligaba a recalcular offsets en varios sitios.

Al validar la propuesta contra el código real se descartaron dos piezas que no tenían consumidor:
`PdfTable` (el documento no tiene tablas, usa filas `label: valor` y paneles) y `PdfVectorCanvas`
(el flujo PDF no consume SVG, dibuja directo desde el modelo).

## Archivos tocados

- `src/utils/calculationPdf.ts` — reducido a orquestación: crea payload, arma el `ReportContext`,
  llama las secciones en orden, sella pies y adjunta el expediente. Superficie pública intacta
  (`createCalculationReport`, `createCalculationReportBlob` y sus dos tipos, que `portable.ts`
  re-exporta con `export *`).
- `src/utils/pdf/reportContext.ts` — **nuevo**. `ReportContext`, `PdfColor`, `ReportFonts`,
  `ReportPalette`, los tipos públicos del artefacto y `createModelIndex`.
- `src/utils/pdf/pdfGlyphs.ts` — **nuevo**. Transliteración WinAnsi (`pdfText`) y `wrapText`.
- `src/utils/pdf/pdfFormat.ts` — **nuevo**. Política numérica y textual del informe.
- `src/utils/pdf/pdfBuilder.ts` — **nuevo**. `PdfLayout`: cursor, `ensure`/`newPage`, `text`,
  `heading`, `row`, `rule`, pies de página.
- `src/utils/pdf/pdfMath.ts` — **nuevo**. Tipografía de fórmulas con super/subíndices.
- `src/utils/pdf/pdfChrome.ts` — **nuevo**. Cabecera, banda de sección, paneles y KPIs.
- `src/utils/pdf/pdfDiagrams.ts` — **nuevo**. DCL global, tiras N/V/M y diagrama global.
- `src/utils/pdf/pdfCover.ts` — **nuevo**. Página ejecutiva.
- `src/utils/pdf/pdfQuantitySection.ts` — **nuevo**. Páginas N, V y M.
- `src/utils/pdf/pdfScopeSection.ts` — **nuevo**. Unidades, convenciones y limitaciones.
- `src/utils/pdf/pdfProcedureSection.ts` — **nuevo**. Procedimiento (índice `05` → `06`).
- `src/utils/pdf/pdfAnnexSection.ts` — **nuevo**. Anexo técnico verificable.
- `src/utils/pdf/pdfPayloadSection.ts` — **nuevo**. Metadatos y adjunto reimportable.
- `Antigravity-propuestas/implementadas/AG-003-...md` — movida desde `aprobadas/`, estado
  `Implementada` + nota de implementación.
- `Antigravity-propuestas/backlog.md`, `roadmap.md` — AG-003 marcada como implementada.

### Mejoras aplicadas más allá del texto de la propuesta

- `ModelIndex`: los `find` sobre nodos/miembros/resultados ocurrían dentro de bucles sobre
  miembros y cargas (O(n·m) por página). Ahora son mapas construidos una vez, conservando la
  semántica de «primera coincidencia» de `find`.
- Proyección modelo → página unificada (estaba duplicada con paddings distintos).

## Cómo verificar

```bash
npm run verify
```

Pasó completo: oxlint, `verify:protected` (la frontera matemática no se tocó), 653 tests en 89
archivos, build y presupuesto de rendimiento (630 240 bytes eager / 169 318 gzip, techo 648 000 /
174 000 — idéntico al valor previo al refactor: `pdf-lib` sigue detrás del `import()` dinámico
porque todos los módulos nuevos lo importan solo como tipos).

Para la inspección editorial hay que generar un PDF primero — `npm run inspect:pdf` sin argumento
sale con código 2 porque el script espera la ruta del archivo:

```bash
node scripts/inspect-pdf.mjs <ruta-al-pdf-generado>
```

Resultado sobre los dos fixtures (`createHibbelerStyleDiagramPractice`,
`createHibbelerTributaryBeam`): **0 hallazgos**, antes y después del refactor — sin desbordes de
margen, sin páginas vacías, sin glifos perdidos, cabecera y pie en todas las páginas.

La comparación de fidelidad se hizo con un spec temporal que hashea la lista de operadores PDF de
cada página (las fechas de metadatos cambian en cada guardado, así que comparar bytes crudos no
sirve). Se eliminó al terminar; para repetirla basta renderizar los dos fixtures antes y después
y comparar `getOperatorList()` página por página.

## Pendiente / siguiente paso

- **Sin pushear** — el commit quedó local, a la espera de confirmación del usuario.
- Queda abierta, y deliberadamente fuera de alcance, la unificación del trazado vectorial entre el
  canvas web (React/SVG, con interacción y sistema de coordenadas propios) y el renderizador PDF
  (`pdf-lib`). Es una decisión de arquitectura mayor, no un efecto colateral de este refactor.
