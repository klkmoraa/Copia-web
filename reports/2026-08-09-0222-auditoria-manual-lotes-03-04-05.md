# Reporte de cambio — auditoría manual Lotes 03–05

**Fecha:** 2026-08-09 02:22 (America/Mexico_City)  
**Tipo:** documentación/auditoría; aditiva y reversible mediante eliminación de los nuevos documentos si se autorizara.  
**Estado:** entregado como evidencia manual/documental; no certifica gates de ejecución.

## Resumen

Se añadieron tres addenda independientes, una matriz transversal, un ledger de fuentes y una lista de pendientes para los Lotes 3, 4 y 5. El trabajo se limitó a:

- revisión documental de lotes, gates, estado, dependencias, 11 informes y evidencia preexistente;
- lectura estática de contratos/tipos/rutas relacionados;
- literatura, normas, RFC, manuales oficiales y comparables documentados;
- derivaciones manuales con entradas, cálculos, unidades, signos, invariantes, criterios y límites.

**No se ejecutó el producto.** No se ejecutaron scripts de aplicación, solver, workers, tests, builds, benchmarks, migraciones, oráculos, readers, IndexedDB, URL sharing, despliegues ni estudios humanos. **No se modificó producción:** no se tocaron `src`, solver, UI, workers, dependencias, almacenamiento, formatos, contratos ni configuración.

## Motivo

Completar únicamente las porciones manuales/documentales comprobables de NUM-002, NUM-005, ARCH-004, ARCH-001, ARCH-002, EDU-001, EDU-002, ARCH-003, DATA-001, DATA-003 y DATA-004, sin convertir una revisión estática o bibliografía en evidencia de operación.

## Entregables añadidos

| Archivo | Contenido |
|---|---|
| `structureCo/docs/structureco_evolution/02_seguimiento_implementacion/investigaciones/evidence/lote-03/manual-documental.md` | Sparse-first, influencia y pre-RFC 3D con casos manuales. |
| `structureCo/docs/structureco_evolution/02_seguimiento_implementacion/investigaciones/evidence/lote-04/manual-documental.md` | EducationTrace, provenance, Aula y explicación progresiva. |
| `structureCo/docs/structureco_evolution/02_seguimiento_implementacion/investigaciones/evidence/lote-05/manual-documental.md` | Comandos reversibles, migración, portable y sharing por URL. |
| `structureCo/docs/structureco_evolution/02_seguimiento_implementacion/investigaciones/matriz_manual_afirmacion_fuente_derivacion_gate_lotes_03_05.md` | Trazabilidad de afirmación → evidencia → fuente → derivación → gate. |
| `structureCo/docs/structureco_evolution/02_seguimiento_implementacion/investigaciones/ledger_fuentes_manual_lotes_03_05.md` | Autor, título, URL/DOI, versión/edición, fecha y sección de las fuentes. |
| `structureCo/docs/structureco_evolution/02_seguimiento_implementacion/investigaciones/pendientes_no_manuales_lotes_03_05.md` | Oráculos, tests, p50/p95, heap/cuota/recovery, round-trip, threat model y evidencia humana pendientes. |

Los 11 informes originales de 47 secciones se conservaron; ningún archivo existente de esos informes fue sobrescrito.

## Subafirmaciones que pasan manualmente

`PASA` se usó de manera estrecha, sólo para lo siguiente:

- NUM-002: solución/residual/LDLᵀ de una cadena SPD, suma de duplicados, conteo de fill-in y frontera KKT.
- NUM-005: viga simple, cortante por lados, voladizo, dos vanos e inversión geométrica de miembro con signos declarados.
- ARCH-004: triada de seis GDL, transformación, dimensionalidad axial/torsión/flexión, roll y degeneración como pre-RFC.
- ARCH-001/002: identidad semántica de trace, taxonomía PROV y anchors con snapshot/lado/versiones como propuesta verificable.
- EDU-001/002: distinción lógica entre predicción/señal/evidencia humana, abstención, no-explicación y progresión algebraicamente coherente.
- ARCH-003: álgebra abstracta de `apply`, `invert`, `replay` y transacción atómica.
- DATA-001: máquina de estados copy-verify-switch fail-closed.
- DATA-003: vector JCS, razonamiento de checksum/versiones y discrepancia documental de `localeCompare` frente a RFC 8785.
- DATA-004: fórmula base64url, límite de fragmento/TTL/hash y política conceptual de preview/fallback/consentimiento.

## Gates que siguen sin pasar

Los 11 IDs permanecen **NO PASA** en sus gates completos. Ningún `PASA` documental afirma rendimiento, seguridad operacional, funcionamiento de runtime, compatibilidad real, recuperación observada, comprensión o accesibilidad humana.

> NO PASA significa gate completo no cerrado; no significa que la derivación manual o la investigación documental hayan fallado.

En particular siguen pendientes: oráculos ejecutados, tests, p50/p95, heap, cuota, recuperación, round-trip real, lectores compatibles, crash/recovery observado, threat model probado y evidencia humana de comprensión/accesibilidad.

## Evidencia estática y conservación de producción

Se revisaron estáticamente rutas de matemática, influencia, tipos, contexto, almacenamiento, migración y portable. Hashes SHA-256 observados antes de escribir documentación para las rutas de producción consultadas:

| Ruta | SHA-256 observado |
|---|---|
| `structureCo/src/engine/math.ts` | `025778D4388EC90F21B66B8430777872EB6B3638827C02E7B4E85EE8A846F183` |
| `structureCo/src/engine/influence.ts` | `BD48A77EEAFF429C3AA1DF1442935F07630325CEFEEF4B3BF238F9C725FABFAB` |
| `structureCo/src/types.ts` | `01D3CD23F62019B74B7E2C27AA3CE2726C871EF11135159C451E6935C70BBC92` |
| `structureCo/src/store/ProjectContext.tsx` | `5CFE837D8D7C142C369ACB78D0273CB1AF94EEBAAD226DEC1A67F021173CBAB3` |
| `structureCo/src/data/projectStorage.ts` | `71F1E67E3D2D9B4DE2666ECE12046130F07FD304FEE8B402C4E37DE097752433` |
| `structureCo/src/data/migrate.ts` | `DF3FA4436FB9B843B3FFAF999053C07B6CDC3D228A25E8B5739A1AA76657B209` |
| `structureCo/src/utils/portablePayload.ts` | `159B882062A008558788846B080C48320C7E1E1E7B405EEFB1AAD962C5A41001` |
| `structureCo/src/utils/portableTypes.ts` | `7E362E87BE033BA66646AB291DF66924035F1CDD1CD8C0073185001F962171AD` |

La ruta documental efectiva se encontró bajo `structureCo/docs/structureco_evolution`, no bajo `docs/` en la raíz. Se registró además una discrepancia de corte: producto raíz observado `0.8.2` frente a checkout documental `0.8.0`; no se usó esa discrepancia como prueba de implementación ni se resolvió mediante cambios.

## Verificación realizada

- Existencia previa de los destinos nuevos comprobada antes de crear los archivos.
- Los 11 informes existentes y sus 47 secciones se leyeron y se conservaron sin modificación.
- Se leyó estáticamente el código pertinente y se consultaron fuentes directas trazables.
- Se validaron en UTF-8 los encabezados, IDs, rutas, columnas requeridas de matriz, claves de fuente y lista explícita de pendientes; los hashes posteriores de las ocho rutas de producción consultadas coinciden con los valores previos.
- No se ejecutarán pruebas de aplicación por restricción del encargo.

## Preguntas abiertas

1. ¿Qué contrato de signos/lados usará la futura adaptación entre líneas de influencia manuales y `LimitSide`?
2. ¿Qué espacio de análisis/versionado separará 2D y 3D sin reinterpretación silenciosa de datos existentes?
3. ¿Cuál será el perfil canónico de portable/trace, y cómo se tratarán `-0`, duplicados y campos desconocidos?
4. ¿Cuál es la autoridad de datos durante migración, concurrencia, downgrade y recuperación bajo cuota/crash?
5. ¿Qué amenaza/retención/consentimiento se aprueba para links con datos estructurales?
6. ¿Qué protocolo humano y de accesibilidad permitirá inferir comprensión sin convertir telemetría en evidencia educativa?

## Siguiente paso seguro

Mantener todos los gates abiertos y usar estas derivaciones como fixtures de especificación. Con autorización independiente, preparar un protocolo de ejecución que fije corpus, entorno, versiones, oráculos, adaptadores de unidades/signos, métricas, criterios, artefactos crudos y revisión humana. Este reporte **no autoriza implementación**.

## Git/publicación

No se realizó commit ni push, conforme a la instrucción de esta sesión. El reporte preexistente `reports/2026-08-09-0158-lotes-03-04-05-investigacion.md` no fue sobrescrito.
