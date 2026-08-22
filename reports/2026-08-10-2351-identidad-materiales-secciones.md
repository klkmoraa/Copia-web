# Identidad explícita de materiales y secciones

**Fecha:** 2026-08-10 23:51
**Agente:** Codex
**Rama:** `codex/cri-34-material-section-identity` (integrada sobre `origin/main` `17e56536bf3b9e2709e4058311681aa4099a778c`)

## Qué cambió

StructureCo Model v6 conserva en cada miembro 2D `materialId`, `sectionId`, `materialOrigin` y `sectionOrigin`, además de las propiedades numéricas existentes. Los presets se aplican mediante comandos atómicos; las ediciones manuales invalidan la identidad correspondiente en el mismo patch. Inspector, visor de sección y demanda elástica resuelven catálogos sólo por ID explícito.

No se modificó la formulación, el solver ni los workers. E, G, densidad, A e I continúan siendo los valores autocontenidos que consume el análisis.

## Por qué

El modelo y la UI inferían silenciosamente materiales y secciones comparando floats. Eso hacía imposible distinguir de forma estable un preset seleccionado, valores custom idénticos, una importación y un proyecto legacy. CRI-34 convierte esa identidad en metadato persistente de dominio sin introducir consultas de catálogo en el solver.

## Modelo final

- IDs: `materialId?: string` y `sectionId?: string`.
- Origen: `catalog | custom | imported | legacy` por material y sección.
- `catalog` exige un ID; `custom`, `imported` y `legacy` pueden existir sin ID.
- Seleccionar un preset copia propiedades + ID + origen `catalog` en una sola operación.
- Editar E, G o densidad elimina `materialId` y pasa material a `custom`.
- Editar A o I elimina `sectionId` y pasa sección a `custom`.
- Reescribir los mismos floats no recupera un ID; sólo una selección explícita lo hace.
- Undo/redo conserva el miembro completo antes/después; duplicar, copiar, repetir y dividir clonan la identidad.
- No se añadió versión de catálogo: los catálogos actuales tienen IDs estables, pero no publican una versión canónica que aporte trazabilidad verificable.

## Compatibilidad legacy e importación

La normalización eleva proyectos v1-v5 a v6, conserva todos sus números y asigna origen `legacy` cuando no existen campos de identidad. No intenta reconocer presets por igualdad o proximidad numérica. El DXF conserva las propiedades de su miembro plantilla, elimina cualquier ID heredado y asigna origen `imported`.

Persistencia local, IndexedDB, JSON interno y paquetes `.structureco` conservan IDs y orígenes al pasar por la normalización v6.

## Archivos tocados

- `src/types.ts` — contrato de identidad y procedencia en `MemberModel`.
- `src/data/defaultProject.ts` — schema v6 y miembros nuevos/example como `custom`.
- `src/data/migrate.ts` — normalización backward-compatible sin inferencia por floats.
- `src/storage/projectRepository.ts` — marcador de migración ligado a la versión vigente.
- `src/commands/projectCommand.ts` — comandos atómicos de preset e invalidación manual.
- `src/features/canvas/StructuralCanvas.tsx` — identidad custom en miembros nuevos.
- `src/education/exerciseTemplates.ts` — identidad custom en plantillas actuales.
- `src/features/inspector/InspectorProperties.tsx` — selección por ID y comandos dedicados.
- `src/features/inspector/MaterialPresetSelector.tsx` — resolución por `materialId`/origen.
- `src/features/inspector/SectionPresetSelector.tsx` — resolución por `sectionId`/origen.
- `src/features/inspector/SectionViewer2D.tsx` — forma comercial sólo con identidad explícita.
- `src/features/results/elasticDemand.ts` — sección/Fy de catálogo sólo mediante IDs.
- `src/import/dxf/dxfParser.ts` — origen importado sin IDs inventados.
- `src/i18n/catalogs.ts` — estados visuales custom/imported/legacy/catálogo no disponible.
- `scripts/protected-baseline.sha256` — baseline deliberadamente actualizada para Model v6.
- `docs/architecture/structureco-member-identity-v6.md` — contrato canónico de schema.
- `src/commands/projectCommand.test.ts` — preset atómico, invalidación y undo/redo.
- `src/data/migrate.test.ts` — identidad actual y proyecto legacy sin inferencia.
- `src/data/projectStorage.test.ts` — save/load de identidad.
- `src/data/modelOperations.test.ts` — copia/duplicación de identidad.
- `src/import/dxf/dxfParser.test.ts` — import externo sin identidad inventada.
- `src/features/inspector/Inspector.test.tsx` — resolución por ID y transición a custom.
- `src/features/inspector/SectionViewer2D.test.tsx` — ausencia de inferencia geométrica.
- `src/features/results/elasticDemand.test.ts` — lookup por ID y fallback sin ID.
- `src/utils/portable.test.ts` — round-trip `.structureco`.
- `src/engine/identityMetadata.test.ts` — invariancia numérica con/sin metadatos.
- `reports/2026-08-10-2351-identidad-materiales-secciones.md` — este reporte.

## Cómo verificar

- `npx.cmd vitest run <10 archivos focalizados> --maxWorkers=1 --reporter=verbose` — PASS, 10 archivos / 89 tests.
- `npm.cmd run verify:docs` — PASS, 15 documentos clasificados; `docs/README.md` y `reports/README.md` presentes.
- `npm.cmd run typecheck` — PASS.
- `npm.cmd run verify:protected` — PASS, 29 archivos.
- `npm.cmd run verify:space3d` — PASS, 20 archivos / 212 tests; 5 omitidos; capacidad 150 nudos / 300 barras.
- `npm.cmd run validate:ci` — PASS, 2 workflows.
- `npm.cmd run build` — PASS; advertencia no bloqueante de chunks mayores a 500 kB.
- `npm.cmd exec vitest -- run --maxWorkers=1` — PASS, 144 archivos / 1082 tests; 8 omitidos.
- `npm.cmd run verify:perf` — PASS, 769910 bytes / 201477 gzip; presupuesto sin techo bloqueante.
- `git diff --check` — PASS.
- Barrido `rg` de comparaciones E/G/densidad/A/I contra catálogos — sin reverse-inference en producción; sólo quedan búsquedas por ID.
- `npm.cmd run verify` — NO PASA únicamente por timeouts intermitentes de 5 s en `crea una barra eligiendo extremos existentes` e `informa un mecanismo sin perder el modelo` de `Space3DWorkspace.test.tsx`; 1080 pruebas sí pasaron. Ambos casos pasaron aislados y la suite completa serial pasó. No se cambiaron tests, timeouts ni Space3D para ocultar el flake.

## Contexto de seguridad y Git

- Respaldo previo: `C:\Users\crisd\AppData\Local\Temp\structureco-cri34-resume-20260810-233335`.
- Versión de paquete: 0.8.2; no se actualizaron dependencias.
- La integración se realizó en un worktree aislado creado desde el `origin/main` actual, sin hacer pull, reset, clean, stash ni checkout sobre el checkout principal.
- El commit final se publicó en `origin/codex/cri-34-material-section-identity` como `43b72cd64608ed2c3c04933113c261aa59e6ce56`; no se abrió PR ni se hizo merge.
- La rama remota queda un commit por delante y cero por detrás de `origin/main`.

## Pendiente / siguiente paso

- Fuera de CRI-34: estabilizar el timeout paralelo de `Space3DWorkspace.test.tsx` para que el wrapper `npm run verify` sea determinista.
- CRI-34 queda publicado únicamente en su rama remota; no hay PR ni merge pendiente ejecutado por esta tarea.
