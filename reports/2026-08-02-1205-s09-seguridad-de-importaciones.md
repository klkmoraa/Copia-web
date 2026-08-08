# S09 — Seguridad de importaciones

- **Agente:** Claude Code (agente principal)
- **Modelo:** Opus 5 (`claude-opus-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Aplicar el principio «rechazar antes de reservar memoria» a todo lo que structureCo lee de
disco, y acotar los paquetes `.structureco` con presupuestos comprobables.

## Hallazgos

### 1. El límite de tamaño se aplicaba después de leer el archivo (crítico)

`src/utils/portableFile.ts` empezaba con:

```ts
const bytes = new Uint8Array(await file.arrayBuffer());
```

antes de cualquier validación. La opción `maxBytes: 25 MB` que `portableImportAdapter` pasaba
sólo llegaba a `inspectPdf`, es decir **sólo se aplicaba a PDF y sólo después de haber
materializado el archivo completo**. Un `.structureco` o un `.json` de cualquier tamaño se
cargaba íntegro en memoria antes de que nadie protestara.

`inspectPdf` tenía el mismo patrón: convertía el `Blob` a `Uint8Array` y **después** comparaba
`source.byteLength` contra el límite.

### 2. `readPortableBundle` descomprimía ZIP sin ningún límite (crítico)

La llamada era `unzipSync(source)` sin filtro. No había control de:

- número de entradas
- tamaño descomprimido por entrada
- tamaño descomprimido total
- relación de compresión
- rutas con `../`, rutas absolutas o letras de unidad
- nombres duplicados

Una zip bomb se inflaba entera en memoria de forma síncrona.

### 3. `assertManifest` no validaba el bloque `files`

Comprobaba `format`, `formatVersion` y `payloadChecksum`, pero no `files`. Un manifest sin ese
bloque provocaba un `TypeError` no controlado en `manifest.files.payload`, y un manifest con
`files.payload = '../../robo.json'` se usaba tal cual como clave de búsqueda.

### 4. Presupuestos duplicados e inconsistentes

`export.ts` tenía su propio límite de 20 MB con un mensaje distinto; `pdfImport.ts` tenía 50 MB
por defecto mientras el adaptador pasaba 25 MB; el límite de páginas 120 estaba escrito dos veces.

## Decisiones

- Un único módulo `src/utils/fileGuards.ts` concentra los presupuestos
  (`FILE_BUDGETS`, `ARCHIVE_BUDGETS`, `PDF_BUDGETS`) y las utilidades de verificación.
- `FileBudgetError` distingue un rechazo por presupuesto de un fallo de parseo, para que
  `readPortableBundle` no lo confunda con «ZIP inválido».
- La clasificación del archivo se hace leyendo **8 bytes** con `Blob.slice`, no el archivo entero.
  Si la extensión contradice la firma, gana la firma: es lo que verán los parsers.
- El presupuesto del ZIP se aplica en el `filter` de `fflate`, que corre contra la cabecera
  declarada de cada entrada **antes** de inflarla. Los tamaños declarados pueden mentir, por eso
  el tamaño de origen también está acotado.
- Los mensajes nuevos se traducen en el borde de presentación (`portableImportAdapter`), no se
  muestran crudos. Se añadieron 10 claves en español e inglés.

### Presupuestos definidos

| Concepto | Valor |
|---|---|
| PDF | 25 MB |
| `.structureco` | 40 MB |
| JSON | 20 MB |
| Tipo aún desconocido | 40 MB |
| Entradas por paquete | 32 |
| Descomprimido por entrada | 64 MB |
| Descomprimido total | 128 MB |
| Relación de compresión | 120:1 |
| Profundidad de ruta | 6 |
| Longitud de nombre | 180 |
| Páginas de PDF inspeccionadas | 120 |
| Adjuntos examinados | 24 |
| Tamaño por adjunto | 20 MB |

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/utils/fileGuards.ts` | **nuevo**: presupuestos, `FileBudgetError`, firma, rutas y contador de archivo |
| `src/utils/portableFile.ts` | rechazo temprano por tamaño, clasificación por firma, presupuesto por tipo |
| `src/utils/portableBundle.ts` | filtro de presupuesto en `unzipSync`; validación de `manifest.files` |
| `src/utils/pdfImport.ts` | comprueba `Blob.size` antes de leer; límites de adjuntos; usa `PDF_BUDGETS` |
| `src/utils/export.ts` | usa el presupuesto compartido de JSON |
| `src/i18n/catalogs.ts` | 10 claves nuevas × 2 idiomas |
| `src/features/import-export/portableImportAdapter.ts` | traduce los rechazos por presupuesto |
| `src/utils/fileGuards.test.ts` | **nuevo**: 28 pruebas |
| `src/utils/portableSecurity.test.ts` | **nuevo**: 22 pruebas adversariales |
| `src/features/import-export/portableImportAdapter.test.ts` | + 1 prueba de localización (11 casos) |

## Archivos protegidos comprobados

`node scripts/check-protected-baseline.mjs` → «Frontera protegida intacta: 45 archivos verificados.»
Ningún archivo de `src/engine/**`, `src/workers/**`, `src/data/**`, `ProjectContext.tsx` o
`types.ts` fue modificado.

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx oxlint` | limpio |
| `npm run typecheck` | limpio |
| `npx vitest run` | **69 archivos, 439 pruebas, todas en verde** (66,6 s) |
| `npm run build` | correcto |
| `npm run verify` | correcto de extremo a extremo |

Delta respecto al baseline S01: 67 → 69 archivos, 388 → 439 pruebas (**+51**).

### Corpus adversarial cubierto

Rechazo temprano: PDF/`.structureco`/JSON sobredimensionados, techo previo a la clasificación,
archivo vacío, formato desconocido, ZIP disfrazado de `.json`.
Paquete: exceso de entradas, `../` y rutas absolutas, zip bomb real de 1 MB de ceros,
ZIP inválido, ausencia de `manifest.json`.
Manifest: sin bloque `files`, `files` como array, ruta obligatoria ausente, traversal en el
manifest, versión de formato futura, checksum no textual, paquete incompleto.
JSON: sintaxis inválida, intento de contaminación de `Object.prototype` vía `__proto__`.

Todas las fixtures se generan en memoria; **no se agregó ningún archivo binario al repositorio**.

## Evidencia

`src/utils/portableSecurity.test.ts` es la evidencia ejecutable: cada rechazo descrito arriba
es una prueba que falla si la protección se retira.

## Riesgos

- Los tamaños declarados en la cabecera de un ZIP pueden mentir. La mitigación es el tope de
  40 MB sobre los bytes de origen, que limita cuánto puede inflarse una mentira.
- `unzipSync` sigue siendo síncrono: un paquete de 40 MB legítimo bloquea el hilo durante la
  descompresión. Se registra para S16, no se cambió aquí porque tocaría la UX de importación.

## Limitaciones

- No se añadió cancelación de operaciones pesadas (pertenece a S10, experiencia de importación).
- No se añadió OCR: un PDF escaneado sigue siendo referencia, como exige el alcance de 0.8.1.

## Pendientes

- S10: exponer estos rechazos en la vista previa de importación con distinción explícita entre
  información, advertencia y error bloqueante, y permitir cancelar.
- S16: evaluar mover la descompresión a un worker.

## Siguiente paso

S11 — Política numérica: existen cinco formateadores con umbrales incompatibles
(`1e-4/1e7` en Inspector y Resultados, `1e-5/1e7` en el PDF, `1e-4/1e8` en `clearNumber`),
por lo que un mismo valor se presenta distinto en la interfaz y en el PDF.

## Commit local

`fix(import): reject oversized files early and budget portable archives`
