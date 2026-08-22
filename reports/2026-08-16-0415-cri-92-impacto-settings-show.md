# CRI-92 — impacto de sacar `settings.show*` de `ProjectSettings`

**Fecha:** 2026-08-16 04:15
**Agente:** Codex
**Rama de evaluación:** `crisdlm302/cri-92-evaluacion-de-impacto-sacar-settingsshow-del-schema-de`
**Baseline auditada:** `origin/main` = `6b4aed137aedccdce0c2c1e202ebb25b7b50ce78`
**Clasificación:** `AUDIT/TEMPORARY` (véase `reports/README.md`).

## Decisión recomendada

**Opción B: sacar los catorce ajustes de vista a preferencias locales por dispositivo y por proyecto.** El nuevo estado debe ser una `CanvasViewPreferences` independiente de `ProjectModel`, con almacenamiento tolerante a fallos siguiendo el precedente `editorLayers.ts`. Se recomienda una clave versionada y con id de proyecto, por ejemplo `structureco:canvas-view:v1:<projectId>`, no una única preferencia global: así una persona conserva su vista de cada documento en su propio dispositivo, pero abrir o importar el documento de otra persona no cambia su vista.

Esto cumple D-10: `view` es el dueño único de capas, presets, `show*`, snap y filtro; y corrige el hecho actual de que una preferencia de presentación se publica, se persiste, se copia al historial y viaja con el documento. Requiere una futura migración de esquema a v7 y autorización explícita para actualizar el baseline protegido. Esta issue **no ejecutó esa migración**.

## Método y alcance comprobado

Se leyó el código de `src/**` en la baseline indicada, sin modificarlo. Se contabilizaron coincidencias de los 14 tokens en código de producción TypeScript/TSX, excluyendo `*.test.*`: **139 referencias, 136 líneas únicas**. El número incluye declaraciones, defaults, normalización y consumidores; los fixtures no-test de Datasheet cuentan como referencias de construcción, no como lectura de runtime. No se cuentan los literales de pruebas.

Los ocho `show*` y los seis campos relacionados son actualmente parte de `ProjectSettings` (`src/types.ts:167-201`). `ProjectSettings` vive dentro de `ProjectModel`; por ello el serializador genérico no los distingue de datos de ingeniería.

### Inventario de usos reales

En la columna `persistido/sesión`, «persistido» significa que hoy viaja como parte de `ProjectModel` mediante los serializadores comunes; ningún campo tiene hoy una ruta de sesión propia. `R/W` enumera cada punto funcional de lectura o escritura, además de la definición/default/normalización necesaria para explicar la persistencia.

| campo | archivo:línea | read/write | persistido/sesión | impacto |
|---|---|---|---|---|
| `showGrid` | `types.ts:184`; `defaultProject.ts:15`; `migrate.ts:162`; `Inspector.tsx:274`; `CommandPalette.tsx:197,199`; `StructuralCanvas.tsx:1982,1991,2572` | esquema/default/normaliza; W Inspector y paleta; R canvas, dependencia y prop de rejilla | Persistido | Toggle de vista comparte la ruta `updateProjectView`; la rejilla y el comando deben recibir un accessor de vista. |
| `showNodeLabels` | `types.ts:185`; `defaultProject.ts:16`; `migrate.ts:163`; `Inspector.tsx:277`; `StructuralCanvas.tsx:2013` | esquema/default/normaliza; W Inspector; R canvas | Persistido | Sólo presentación de etiquetas; además se combina con `layers.labels` e `layers.ids`. |
| `showMemberLabels` | `types.ts:186`; `defaultProject.ts:17`; `migrate.ts:164`; `Inspector.tsx:278`; `StructuralCanvas.tsx:2034` | esquema/default/normaliza; W Inspector; R canvas | Persistido | Sólo presentación de etiquetas; mismo cruce con capas editoriales. |
| `showLocalAxes` | `types.ts:187`; `defaultProject.ts:18`; `migrate.ts:165`; `Inspector.tsx:279`; `StructuralCanvas.tsx:2046`; `CanvasGeometryLayer.tsx:291` | esquema/default/normaliza; W Inspector; R canvas y capa geométrica | Persistido | Presentación de ejes locales, condicionada además por `layers.dimensions`. |
| `showLoads` | `types.ts:188`; `defaultProject.ts:19`; `migrate.ts:166`; `Inspector.tsx:281`; `StructuralCanvas.tsx:2059`; `CanvasGeometryLayer.tsx:307` | esquema/default/normaliza; W Inspector; R canvas y capa geométrica | Persistido | Visibilidad de cargas; no altera las cargas del modelo ni el análisis. |
| `showDimensions` | `types.ts:189`; `defaultProject.ts:20`; `migrate.ts:167`; `Inspector.tsx:280`; `StructuralCanvas.tsx:2046` | esquema/default/normaliza; W Inspector; R canvas | Persistido | Presentación de cotas; se cruza con `showLocalAxes`, el tool activo y `layers.dimensions`. |
| `showResultValues` | `types.ts:190`; `defaultProject.ts:21`; `migrate.ts:168`; `Inspector.tsx:282`; `StructuralCanvas.tsx:2162` | esquema/default/normaliza; W Inspector; R canvas | Persistido | Visibilidad de valores críticos ya calculados; no cambia la solución. |
| `showResultOverlay` | `types.ts:193`; `defaultProject.ts:24`; `migrate.ts:171`; `Inspector.tsx:303`; `StructuralCanvas.tsx:2180`; `CanvasResultLayer.tsx:103,223` | esquema/default/normaliza; W Inspector; R canvas y capa de resultados | Persistido | Habilita diagramas y sellos de extremos; su ausencia histórica recibe default `true`. |
| `diagramScale` | `types.ts:191`; `defaultProject.ts:22`; `migrate.ts:169,184`; `Inspector.tsx:305`; `CanvasResultLayer.tsx:55,61` | esquema/default/normaliza y valida; W Inspector; R resultados | Persistido | Escala visual de ordinadas. `analysisSignature` la excluye explícitamente (`projectSignature.ts:10-13`). |
| `diagramScaleMode` | `types.ts:192`; `defaultProject.ts:23`; `migrate.ts:170`; `Inspector.tsx:304`; `CanvasResultLayer.tsx:55`; `StructuralCanvas.tsx:2624` | esquema/default/normaliza; W Inspector; R resultados y leyenda | Persistido | Alterna escala común/por miembro; es preferencia de interpretación visual. |
| `deformedScale` | `types.ts:194`; `defaultProject.ts:25`; `migrate.ts:172,185`; `Inspector.tsx:306`; `CanvasResultLayer.tsx:161,205` | esquema/default/normaliza y valida; W Inspector; R resultados | Persistido | Escala exclusivamente gráfica de la deformada; no entra en firma de análisis. |
| `diagramSide` | `types.ts:195`; `defaultProject.ts:26`; `migrate.ts:173`; `Inspector.tsx:307`; `CanvasResultLayer.tsx:106,195,230`; `StructuralCanvas.tsx:2182,2624`; `pdfDiagrams.ts:273` | esquema/default/normaliza; W Inspector; R canvas, resultados, leyenda y PDF | Persistido | Único campo de la familia leído directamente por PDF; la futura API de PDF debe recibir la preferencia efectiva, no releer el modelo. |
| `snapTargets` | `types.ts:172-178`; `defaultProject.ts:13`; `migrate.ts:143,150-155`; `Inspector.tsx:288-292`; `StructuralCanvas.tsx:454,457,465,469,474,477,802-806,812` | esquema/default/normaliza; W cinco toggles; R generación de candidatos y dependencias | Persistido | Preferencia de interacción del observador; no cambia la geometría existente. Es la familia con mayor superficie de canvas. |
| `selectionFilter` | `types.ts:179-183`; `defaultProject.ts:14`; `migrate.ts:144,157-160`; `Inspector.tsx:296-298`; `StructuralCanvas.tsx:482,989-991,1016,1188,1200,1429-1433` | esquema/default/normaliza; W tres chips; R hit testing, marco y disponibilidad | Persistido | Preferencia de interacción; afecta qué se puede seleccionar, no la topología ni el análisis. |

Referencias auxiliares de construcción: `features/datasheet/datasheetFixtures.ts:54-63` inicializa los mismos campos para fixture, y once pruebas de motor contienen settings completos. Son consumidores de tipos a ajustar en la issue de migración, pero no rutas runtime del usuario.

## Persistencia, migraciones y proyectos existentes

1. `createDefaultSettings` materializa los catorce valores (`defaultProject.ts:8-28`) y `CURRENT_SCHEMA_VERSION` es 6 (`defaultProject.ts:4`).
2. `normalizeSettings` reconstruye/valida todos los valores desde JSON y usa defaults para los faltantes (`migrate.ts:140-186`). `normalizeProject` acepta versiones 1..6 y rechaza las futuras (`migrate.ts:488-497`); al normalizar, el proyecto resultante se escribe con la versión corriente.
3. `projectStorage.ts:20-80` normaliza y serializa el proyecto completo en `structureCo.project`, rotando backup y recovery. `ProjectContext.tsx:161-176` persiste todo `ProjectModel` tanto en `localStorage` como en el repositorio IndexedDB. `projectRepository.ts:54-80,188-205` también normaliza, calcula checksum y almacena el objeto completo, incluidas recuperaciones.
4. El estado de vista actual se publica por `updateProjectView` (`ProjectContext.tsx:439-444`), no añade historial ni invalida análisis, pero sí cambia `project`; el efecto de persistencia lo guarda. Por eso el nombre «view» no evita que la vista sea documento.
5. Un proyecto antiguo tiene los valores en `settings`. Para B, la futura lectura v1..v6 debe extraerlos del JSON crudo **antes** de que el normalizador omita esas claves, sembrar una única vez el registro local por `project.id`, y después normalizar el documento a v7 sin ellos. La semilla no debe sobrescribir una preferencia local ya existente. Se debe repetir esa lógica para primario, backup/recovery, IndexedDB y cada ruta de importación/restauración.

La recomendación **sí requiere subir `schemaVersion` a 7**: el contrato persistido de `ProjectSettings` deja de contener campos obligatorios/optativos y la lectura debe distinguir inequívocamente v1..v6 (semilla legacy) de v7 (estado de vista local/default). Mantener 6 y eliminar silenciosamente claves sería compatible de forma accidental, pero ocultaría un cambio de formato, debilitaría la recuperación y no daría una migración reversible ni auditable.

## Transporte: JSON, portable, PDF y DXF

| Superficie | evidencia | impacto de B |
|---|---|---|
| JSON nativo | `export.ts:18-41` normaliza y hace `JSON.stringify(normalized)`; importar normaliza el JSON. | Los JSON v1..v6 conservan preferencias legacy para sembrar al importar. Los JSON v7 no transportan preferencias del observador. Es un cambio intencional de semántica: importar abre con preferencia local/default. |
| Payload portable y PDF reimportable | `portablePayload.ts:61-92` toma `jsonSnapshot(project)` y lo firma; `portableFile.ts:55-95` y el importador PDF restauran ese proyecto. | El adjunto antiguo conserva las claves y debe sembrar una vez. El nuevo no las lleva; la restauración sigue siendo fiel para el modelo estructural, no para la presentación personal. La firma/checksum se recalcula normalmente por el formato existente. |
| Bundle `.structureco` | `portableBundle.ts:70-155` guarda tanto payload como `project.json` de todo `ProjectModel`. | Mismo contrato: bundle legado siembra; bundle v7 no comparte vista. Deben probarse equivalencia payload/bundle después de normalizar a v7. |
| PDF renderizado | `pdfDiagrams.ts:273` lee `project.settings.diagramSide` para orientar el diagrama. | El generador debe recibir `CanvasViewPreferences` (o un `diagramSide` explícito) de la sesión que exporta. El PDF ya congela el dibujo generado; el payload adjunto no debe volver a imponer esa preferencia al reabrir. |
| SVG/PNG | `export.ts:44-115` serializa el SVG ya renderizado. | No tiene schema propio: usará la vista efectiva del canvas sin transportar settings en JSON. |
| DXF | Sólo hay **importación**. `DxfImportDialog.tsx:105-114` crea recovery y ejecuta un comando; `dxfParser.ts:250-301` agrega nodos/miembros desde una plantilla. | No lee/escribe esta familia. El proyecto actual conserva su preferencia local al importar geometría; la recovery v6 debe pasar por la semilla legacy al restaurarse. |

## Aula y Space 3D

**Aula.** `calculationMode` sigue siendo propiedad del documento y del análisis: `Inspector.tsx:267-269`, `projectSignature.ts:12-13,30-32`, `pDelta.ts:562-567` y `solver.ts:758` lo usan. En contraste, `ClassroomSessionContext.tsx:18-58,180-224` ya mantiene localmente por proyecto las predicciones, revelación y conclusión mediante `structureCo.classroom.session.v1:<projectId>`. Es un precedente más cercano que `editorLayers` para la clave por proyecto. B no debe mover `calculationMode` ni introducir una segunda ruta de análisis; sólo debe hacer que los componentes Aula consuman la misma preferencia de vista efectiva cuando muestren canvas/resultados. Debe probarse Expanded, Medium y Compact; Día/Noche y ES/EN no cambian datos, pero el controlador `view` debe conservar los mismos labels, foco y targets táctiles.

**Space 3D.** El códec 3D usa un modelo aislado con allowlist exacta (`space3d/data/codec.ts:203-256`) que no contiene `settings`. El puente 2D es unilateral y sin estado (`space3d/data/bridge2d.ts:1-7`); sólo toma `source.settings.units` (`bridge2d.ts:214-225`). Por ello B no cambia el codec ni el formato Space 3D, y tampoco puede pasar preferencias 2D al modelo 3D. La comprobación futura debe fijar que el bridge sigue tomando unidades y que ningún campo de vista se cuela en el JSON 3D, que rechaza campos desconocidos.

## Precedente: `editorLayers.ts`

`features/canvas/editorLayers.ts:14,41-124` declara una clave local versionada, defaults inmutables, parser defensivo, reducer y persistencia que no bloquea edición. Es el patrón correcto para B con dos ajustes:

- usar un tipo explícito `CanvasViewPreferences` y un reader/writer único, no lecturas dispersas de `localStorage`;
- derivar la clave de `project.id` y ofrecer bootstrap de v1..v6, porque los campos analizados hoy pertenecen al documento y las capas editoriales nunca tuvieron que ser migradas desde él.

## Opciones comparadas

| opción | coste | riesgo | reversibilidad | proyectos existentes | `schemaVersion` | protected baseline | import/export | Aula | Space 3D |
|---|---|---|---|---|---|---|---|---|---|
| **A. Mantener `ProjectSettings`, exponer un accessor único de `view`** | Bajo: encapsular los reads/writes actuales y mover Inspector/Palette/canvas a él. | Bajo de regresión, alto de deuda: el documento sigue sobreescribiendo la vista del observador y D-10 queda sólo parcialmente resuelto. | Alta; se revierte el accessor. | Sin cambio; los proyectos conservan exactamente la conducta actual. | No. | No necesariamente: puede vivir fuera de `src/data`, `ProjectContext.tsx` y `types.ts`; no hace falta refresco si no toca rutas protegidas. | Sin cambio: JSON, portable y PDF siguen viajando con settings completos. | Sin cambio, incluido `calculationMode`; no separa preferencias de Aula. | Sin cambio. |
| **B. Toda la familia a sesión/dispositivo por proyecto** **(recomendada)** | Alto pero acotado: nuevo store/preferencias, bootstrap legacy, adaptación de 139 referencias y firmas de PDF/export. | Medio-alto: pérdida accidental de la semilla legacy, doble fuente temporal, y rutas de import/recovery que omitan bootstrap. Reduce el riesgo de propiedad a largo plazo. | Media: la migración puede escribir una copia de compatibilidad o restaurar los valores legacy desde el registro local mientras dure v7; no es reversión sin datos después de limpiar esas copias. | V1..v6 siembran una vez su vista local; v7 abre con estado local/default. El documento deja de cambiar la vista de otro dispositivo. | **Sí, v7.** | **Sí.** Cambiar `src/types.ts`, `src/data/defaultProject.ts`, `src/data/migrate.ts`, `src/data/projectStorage.ts` y probablemente `ProjectContext.tsx` está dentro de las rutas verificadas. Exige autorización explícita y refresh deliberado. | JSON/portable/bundle nuevos no transportan vista; importaciones legacy la siembran. PDF recibe vista efectiva de la sesión. SVG/PNG ya reflejan canvas. | Compatible y deseable: usa el patrón de sesión por `projectId`; no tocar análisis ni `calculationMode`. | Sin cambio de codec/bridge; comprobar que no se serializa vista hacia S3D. |
| **C. División: propiedades de documento quedan; preferencias del observador salen** | Medio-alto: además del store/migración, requiere clasificar cada campo y mantener dos APIs/contratos. | Alto de ambigüedad y divergencia. `diagramSide` parece candidato documental porque PDF lo lee, pero sigue siendo orientación visual; `snapTargets` y filtro son inequívocamente del observador. | Media: puede revertirse por grupo, pero la política de qué viaja se vuelve parte del producto. | Semilla por grupo; los valores que se quedan continúan viajando y los otros dejan de hacerlo. | Sí si se eliminan campos, aunque menor si sólo se mueven opcionales. | Sí para cualquier cambio de `ProjectSettings`/migrador/defaults; requiere autorización. | Transportes quedan híbridos: PDF podría seguir leyendo `diagramSide`, pero JSON/portable compartirían una parte de la vista y no otra. | `calculationMode` se mantiene; el riesgo es presentar distintos defaults según grupo. | Sin impacto directo, pero la semántica parcial añade documentación y pruebas innecesarias. |

### Por qué no A ni C

A es un repliegue válido únicamente si el propietario no autoriza tocar la frontera protegida: reduce el número de accesos directos, pero no corrige que abrir un proyecto de otra persona cambie la preferencia visual local ni que la vista siga perteneciendo al modelo serializado. C reduce algunos cambios, pero conserva una frontera difícil de explicar: la orientación, escalas y overlays forman una misma decisión de lectura del lienzo; separar un solo `diagramSide` sólo porque el PDF lo consume desplaza la adaptación al exportador sin resolver la propiedad.

## Plan de migración para B (issue futura; no ejecutado aquí)

1. Obtener autorización explícita del propietario para cambiar la frontera protegida y actualizar el baseline después de revisión. Fijar primero pruebas de lectura/escritura legacy, import/export/portable/PDF, recovery, Aula y bridge 2D→3D.
2. Definir `CanvasViewPreferences` y su lista canónica de estos catorce campos, defaults equivalentes a `createDefaultSettings`, parser tolerante y clave `structureco:canvas-view:v1:<projectId>`. Implementar reader, writer, seed-if-absent y reset; nunca dejar que un fallo de almacenamiento bloquee edición.
3. Añadir un extractor de preferencias legacy que opere sobre el JSON v1..v6 antes de `normalizeProject`. Subir `CURRENT_SCHEMA_VERSION` a 7, retirar la familia de `ProjectSettings` y hacer que el normalizador v7 no vuelva a emitirla. Mantener la lectura v1..v6 para bootstrap y validación de integridad.
4. Encadenar bootstrap antes del primer autosave en: `localStorage` primario/backup/recovery, migración a IndexedDB, abrir/restaurar repositorio, JSON, payload, bundle y PDF nativo. Si la clave local ya existe, gana la preferencia local; si no existe, gana una única semilla legacy; si no hay legacy, defaults. Registrar el proyecto normalizado v7 sólo después de guardar/obtener la preferencia efectiva.
5. Crear un contexto/accessor de vista único. Reemplazar los 14 accesos en Inspector, Command Palette, StructuralCanvas, CanvasGeometryLayer, CanvasResultLayer y PDF. Mantener `ProjectContext` como dueño sólo del modelo; toggles de vista no deben llamar `updateProjectView`, publicar `ProjectModel`, persistirlo ni entrar en undo/redo.
6. Actualizar exportadores: JSON/portable/bundle v7 transportan sólo documento; la API de PDF recibe preferencias efectivas para renderizar; SVG/PNG usan el DOM ya renderizado. Decidir y documentar que reimportar no reproduce preferencias personales, mientras que abrir un archivo legacy puede sembrarlas una vez.
7. Ejecutar pruebas focales nuevas y los gates de la issue futura: migración idempotente, prioridad local sobre legacy, recovery/import, PDF con `diagramSide`, no mutación del `ProjectModel` al cambiar viewport/toggle, Aula y bridge Space3D. Después de revisión autorizada, actualizar baseline y ejecutar `npm run verify:protected`.

## Verificación de esta evaluación

- Se confirmó que `src/data/**`, `src/store/ProjectContext.tsx` y `src/types.ts` pertenecen a `scripts/check-protected-baseline.mjs`; `defaultProject.ts`, `migrate.ts`, `projectStorage.ts`, `ProjectContext.tsx` y `types.ts` están cubiertos por el baseline actual.
- No se ejecutó migración, no se modificó `src/**`, no se actualizó `scripts/protected-baseline.sha256` y no se inició CRI-99.
- `reports/**` es ya `AUDIT/TEMPORARY` e indexado por `docs/README.md`; por tanto este informe no requiere añadir una ruta al índice ni ejecutar `verify:docs`.

## Pendiente / siguiente paso

Crear una issue de migración sólo si el propietario aprueba B y la actualización explícita del baseline protegido. Esa issue debe conservar las pruebas de análisis y no puede comenzar CRI-99 como sustituto de esta migración.
