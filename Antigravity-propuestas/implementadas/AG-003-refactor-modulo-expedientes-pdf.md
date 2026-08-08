# AG-003

# Refactorización Declarativa del Módulo de Expedientes y Memorias PDF

# Implementada

# 2026-08-05

# PDF / Arquitectura

---

> ## Nota de implementación (2026-08-05)
>
> Propuesta implementada. La superficie pública (`createCalculationReport`,
> `createCalculationReportBlob`, `CalculationReportOptions`, `CalculationReportArtifact`) quedó
> intacta — `portable.ts` la re-exporta con `export *` —, no se agregaron dependencias y la
> frontera matemática protegida no se tocó.
>
> ### 1. Estructura resultante
> `src/utils/calculationPdf.ts` pasó de **1.058 líneas** (un solo closure donde ~20 rutinas de dibujo
> capturaban las mismas variables mutables `page` e `y`) a **~90 líneas** de orquestación. La maquetación
> vive en 13 módulos bajo `src/utils/pdf/`:
>
> | Módulo | Responsabilidad |
> |---|---|
> | `reportContext.ts` | `ReportContext`, tipos de color/fuentes/paleta e índices del modelo |
> | `pdfGlyphs.ts` | Transliteración WinAnsi y ajuste de línea |
> | `pdfFormat.ts` | Política numérica y textual del informe |
> | `pdfBuilder.ts` | `PdfLayout`: cursor vertical, saltos de página, `text`/`heading`/`row`/`rule`, pies |
> | `pdfMath.ts` | Tipografía de fórmulas (super/subíndices, ajuste al ancho) |
> | `pdfChrome.ts` | Cabecera de marca, banda de sección, paneles y tarjetas KPI |
> | `pdfDiagrams.ts` | DCL global, tiras N/V/M por miembro y diagrama global de cantidad |
> | `pdfCover.ts` | Página ejecutiva |
> | `pdfQuantitySection.ts` | Páginas N, V y M |
> | `pdfScopeSection.ts` | Unidades, convenciones, alcance y limitaciones |
> | `pdfProcedureSection.ts` | Procedimiento y cálculos |
> | `pdfAnnexSection.ts` | Anexo técnico verificable (secciones 1–6) |
> | `pdfPayloadSection.ts` | Metadatos del documento y adjunto reimportable |
>
> `PdfLayout` es el único dueño del estado mutable del documento; las secciones leen `layout.page` en el
> momento de dibujar, de modo que un salto de página nunca deja arte huérfano en la página anterior.
>
> ### 2. Fidelidad verificada, no supuesta
> Antes de tocar el archivo se capturó una línea base con los dos fixtures que usan las pruebas
> (`createHibbelerStyleDiagramPractice` y `createHibbelerTributaryBeam`), hasheando con SHA-256 la
> **lista de operadores PDF de cada página** (texto *y* vectores) extraída con PDF.js — las fechas de
> metadatos cambian en cada guardado, así que comparar bytes crudos no sirve. Resultado tras el refactor:
>
> - Mismo número de páginas (9 y 10), mismo número de operadores por página (p. ej. 1.860 en la página 6).
> - Hash idéntico en **todas** las páginas salvo una diferencia intencional (ver punto 3).
> - `payload.checksum.value` y el nombre de archivo idénticos.
> - `scripts/inspect-pdf.mjs`: **0 hallazgos** antes y después (sin desbordes de margen, sin páginas
>   vacías, sin glifos perdidos, cabecera y pie en todas las páginas).
>
> ### 3. Mejoras aplicadas
> - **Índices del modelo** (`ModelIndex`): `project.nodes.find` / `project.members.find` /
>   `analysis.memberResults.find` se ejecutaban dentro de bucles sobre miembros y cargas — coste O(n·m)
>   por página. Ahora son mapas construidos una vez, conservando la semántica de «primera coincidencia»
>   de `find`.
> - **Proyección modelo → página unificada**: el bloque *bounding box → escala uniforme → offsets
>   centrados* estaba escrito dos veces con paddings distintos; ahora es un único helper parametrizado.
> - **Defecto editorial corregido**: la página de «Procedimiento y cálculos» repetía el índice de sección
>   `05` de «Unidades y convenciones»; pasa a `06`. Es la única diferencia visible del documento y se
>   corrigió con autorización explícita del usuario.
> - `PdfColor` como alias con nombre en lugar de `ReturnType<typeof rgb>` repetido.
>
> ### 4. Fuera de alcance / observaciones
> - **`PdfTable` no se implementó**: el documento no tiene tablas — usa filas `label: valor` y paneles
>   dibujados. Un componente de tabla sin consumidor habría sido código muerto.
> - **`PdfVectorCanvas` (SVG → `pdf-lib`) no aplica**: el flujo PDF no consume SVG, dibuja directo desde
>   el modelo. Lo único realmente duplicado era la proyección, ya unificada.
> - **Unificar el trazado vectorial del canvas web con el del PDF** sigue pendiente: son React/SVG con
>   interacción y sistema de coordenadas propios frente a `pdf-lib`; es una decisión de arquitectura
>   mayor y no se forzó aquí.
> - El presupuesto de bundle no se movió: 630 240 bytes eager antes y después; `pdf-lib` sigue detrás del
>   `import()` dinámico porque todos los módulos nuevos lo importan solo como tipos.

# Resumen ejecutivo

Propone refactorizar el módulo monolítico de generación de memorias de cálculo en PDF (`src/utils/calculationPdf.ts`, con más de 1,600 líneas) transformando las llamadas imperativas manuales a `pdf-lib` en un patrón de diseño **Document Builder** declarativo. Esta mejora aislará la creación de tablas, gráficos de diagramas $N, V, M$, portadas y la inyección del payload JSON reutilizable, facilitando la adición de nuevas secciones editoriales sin riesgo de regresiones visuales o errores en el cálculo de coordenadas.

# Problema

El archivo `src/utils/calculationPdf.ts` contiene una implementación imperativa monolítica de 1,680+ líneas de código. Las coordenadas $X, Y$, los saltos de página, las alturas de fila de tabla, el ajuste de texto en columnas y el trazado de gráficos vectoriales de esfuerzos están hardcodeados mediante matemática manual (`y -= 18`, `page.drawText(...)`). Esto provoca:
1. Alta fragilidad: cambiar el tamaño de una fuente o agregar una fila desplaza manualmente el resto de las páginas.
2. Dificultad para mantener y extender nuevas secciones de informe técnico.
3. Duplicación de lógica de trazado vectorial entre el Canvas web y el renderizador PDF.

# Evidencia

- `src/utils/calculationPdf.ts`: Archivo imperativo monolítico con cálculo directo de coordenadas de página para `pdf-lib` (líneas 1-1680).
- `scripts/inspect-pdf.mjs`: Script para inspeccionar y validar la integridad binaria de las memorias PDF.

# Objetivo

1. Reestructurar `calculationPdf.ts` implementando un patrón de diseño **PdfDocumentBuilder** declarativo.
2. Modularizar componentes de renderizado de informe: `PdfPageLayout`, `PdfTableGrid`, `PdfDiagramRenderer`, `PdfPayloadEncoder`.
3. Mantener 100% la fidelidad del documento impreso, la firma SHA-256 de seguridad y la compatibilidad de re-importación.

# Beneficio esperado

- **Desarrollo**: Reducción de la complejidad ciclomática del módulo de PDF. Facilidad para modificar diseños editoriales.
- **Estabilidad**: Eliminación de errores de desbordamiento de página (*text clipping* o superposición de filas).

# Solución propuesta

1. **Creación de Abstracciones de Maquetación (`PdfBuilder`)**:
   - `PdfPageContext`: Maneja automáticamente el cursor de posición vertical $Y$, los márgenes y la creación de nuevas páginas con encabezado y pie de página estándar.
   - `PdfTable`: Componente helper para renderizar tablas con columnas auto-dimensionadas, fondos alternados y bordes.
   - `PdfVectorCanvas`: Helper para traducir primitivas SVG a comandos `pdf-lib`.
2. **Descomposición en Módulos Especializados**:
   - `src/utils/pdf/pdfCover.ts`: Renderizado de la portada editorial.
   - `src/utils/pdf/pdfSummaryTable.ts`: Tabla de resumen global y reacciones.
   - `src/utils/pdf/pdfDiagramSection.ts`: Gráficos vectoriales de $N, V, M$.
   - `src/utils/pdf/pdfPayloadSection.ts`: Adjunto y hash SHA-256 del proyecto.

# Alternativas consideradas

- **Uso de `@react-pdf/renderer`**: Renderizar PDF declarativamente con sintaxis JSX sería ideal, pero introduciría una biblioteca de gran tamaño ($\sim 2\text{MB}$ bundle) y rompería la ejecución pura fuera de React. Mantener `pdf-lib` con capas abstractas declarativas propias es más ligero y conserva cero dependencias pesadas adicionales.

# Justificación técnica

Un patrón Builder interno con control automático de flujo vertical elimina la matemática manual de coordenadas $Y$, previniendo la superposición de elementos y manteniendo la memoria dentro del presupuesto de presupuesto de bundle actual.

# Impacto en la experiencia del usuario

Garantiza informes PDF de calidad editorial impeclable, sin cortes de texto o tablas desbordadas al imprimir proyectos de múltiples nodos.

# Impacto visual

Mejora la consistencia editorial, alineación de columnas y nitidez de gráficos en la exportación PDF.

# Impacto en la arquitectura

Modulariza `src/utils/calculationPdf.ts` dividiéndolo en pequeños archivos especializados bajo `src/utils/pdf/`.

# Complejidad

**Alta**. Requiere refactorizar la lógica de maquetación sin romper la firma binaria de reimportación de datos.

# Prioridad

**Media**. El módulo actual funciona bien, pero posee alta deuda técnica de mantenimiento.

# Riesgos

- Alterar accidentalmente la estructura o nombre del adjunto PDF conteniendo el payload JSON del proyecto, imposibilitando la reimportación.

# Dependencias

Ninguna nueva dependencia. Utiliza la versión existente de `pdf-lib`.

# Librerías o tecnologías recomendadas

Nativa sobre `pdf-lib`.

# Archivos y módulos probablemente afectados

- **Modificación probable**:
  - `src/utils/calculationPdf.ts`
- **Creación probable**:
  - `src/utils/pdf/pdfBuilder.ts`
  - `src/utils/pdf/pdfTable.ts`
  - `src/utils/pdf/pdfDiagrams.ts`
- **Solo revisión**:
  - `src/utils/calculationPdf.test.ts`
  - `scripts/inspect-pdf.mjs`

# Plan de implementación

## Fase 1: Creación de Helpers de Maquetación (`pdfBuilder.ts`)
- Implementar la clase `PdfPageBuilder` para gestión de posición $Y$, saltos de página y márgenes.
- Implementar `drawTable` para formateo automático de celdas.

## Fase 2: Migración Gradual de Secciones
- Migrar Portada -> Resumen de Reacciones -> Diagramas Vectoriales -> Payload Incrustado.

## Fase 3: Validación y Verificación Binaria
- Validar mediante `scripts/inspect-pdf.mjs` que el checksum SHA-256 y el centro de importación sigan reconociendo el documento como PDF nativo reimportable.

# Estrategia de implementación

Ejecutar `npm run inspect:pdf` después de cada sección migrada para certificar que la estructura de anotaciones y archivos adjuntos permanezca 100% válida.

# Criterios de aceptación

- `npm run verify` y `npm run inspect:pdf` se ejecutan sin errores.
- Los expedientes PDF generados se re-importan correctamente en `ImportCenterDialog`.
- Ningún texto o fila de tabla se superpone independientemente del número de miembros.

# Pruebas necesarias

- `src/utils/calculationPdf.test.ts`
- `src/utils/calculationPdfEditorial.test.ts`
- Pruebas manuales con `scripts/inspect-pdf.mjs`

# Restricciones

- No modificar la clave ni el formato del payload inyectado en el PDF (`structureco-portable`).

# Estrategia de reversión

Restaurar el archivo monolítico `src/utils/calculationPdf.ts`.

# Definición de terminado

Propuesta refactorizada en sub-módulos limpios, con pruebas en verde e inspección PDF aprobada.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-003-refactor-modulo-expedientes-pdf.md`

Valida la propuesta contra el código real antes de modificar archivos.

Implementa únicamente el alcance aprobado: refactoriza `src/utils/calculationPdf.ts` dividiéndolo en helper declarativos de maquetación bajo `src/utils/pdf/` sin alterar el formato ni la firma del payload JSON incrustado.

CRITERIO DE MEJORA AUTÓNOMA:
- Si al analizar el código real o durante la implementación detectas una oportunidad de mejora directa (técnica, de rendimiento o de calidad de código) que enriquezca la solución sin alterar la lógica de negocio ni romper la frontera matemática, agrégala.
- Si detectas una mejora más compleja que requiera una decisión de arquitectura mayor, no la fuerces; explícala brevemente en el informe final.
- Si la solución de la propuesta ya es óptima y suficiente, implementa estrictamente lo necesario sin añadir complejidad innecesaria ni código superfluo.

Conserva los comportamientos y restricciones indicados en el documento.

Ejecuta lint, tests y validación de PDF (`npm run verify` y `npm run inspect:pdf`).

Al terminar:
- resume los cambios
- lista los archivos modificados y creados
- indica las pruebas ejecutadas
- documenta si aplicaste alguna mejora adicional o te apegaste estrictamente al plan
- actualiza el estado de la propuesta a Implementada
- mueve el documento a `Antigravity-propuestas/implementadas/AG-003-refactor-modulo-expedientes-pdf.md`
