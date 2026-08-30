# structureCo Fase 2 — plan de implementación

> **HISTORICAL** — Plan de ejecución conservado. El estado vigente está en el [README principal](../../../README.md) y en el código actual.

**Clasificación:** `HISTORICAL`

**Base:** `main@166d826c9a0c4247873ce78f3e22186ceaef6659`, aplicación raíz 0.8.2.

**Skills locales `structureco-*`: NO DISPONIBLE** (registro único). Respaldo focalizado, hashes, frontera protegida y pruebas equivalentes sustituyen ese flujo sin ampliar el alcance. Los plugins obligatorios sin capacidad invocable (`ui-theme-designer`, `code-simplifier`, `typescript-lsp`, `security-guidance`) también se tratarán mediante revisión focalizada; `frontend-design` sí está activo.

## Alcance exacto

Ejecutar `F2-CMD → F2-HIST → F2-WORK → F2-HUB → F2-PWA → F2-PROD → F2-DXF`: comandos incrementales y patches reversibles; historial snapshot con intención/transacciones; envelopes homogéneos para los tres workers; repositorio IndexedDB con migración copy–verify y espejo legacy; shell PWA actualizable y offline cálido; duplicación 2D con preview; e importación DXF ASCII experimental con diagnóstico.

No se cambiarán solver, formulaciones, unidades, signos, resultados, `ProjectModel` v5, portable v1 ni dependencias. No habrá cloud/sync, journal persistente, sustitución total de snapshots, macros, mirror/rotate/array, exportación DXF, DWG, 3D ni inferencia estructural.

## Archivos y contratos principales

- `src/commands/*` y `ProjectContext`: `ProjectCommand`, `ProjectPatch`, aplicación/inversa atómica y `executeProjectCommand`.
- `src/runtime/*`, hooks y workers existentes: envelope v1, requestId, error, cancelación por terminate y paridad fallback.
- `src/storage/*` y Project Hub lazy: `ProjectRepository`, records revisionados, recoveries y migración idempotente.
- `src/platform/*`, `vite.config.ts` y `App`: generación/registro de service worker y aviso explícito de actualización.
- Canvas/import: comando de duplicación con ghost preview; `DxfInspection` y `DxfImportProposal` para LINE/LWPOLYLINE recta usando un miembro existente como plantilla.

## Orden de ejecución

1. Respaldo focalizado, hashes y baseline.
2. TDD de CMD/HIST y vertical miembro create/update/delete.
3. TDD de workers y fallback.
4. TDD de repository, migración y Hub.
5. PWA después del gate de almacenamiento.
6. Duplicación 2D sobre commands/history.
7. DXF con preview, recovery obligatorio y confirmación atómica.
8. Validación focalizada, manual, typecheck, baseline protegida y una única ejecución de `verify`.

## Riesgos y controles

- **Frontera protegida:** sólo actualizar hashes de archivos F2 autorizados después de invariancia y revisión individual; solver/types/portable permanecen byte-idénticos.
- **Pérdida de datos:** localStorage nunca se borra; toda promoción IDB exige read-back/hash; conflictos y DXF crean recovery.
- **Resultados stale:** mantener revisión/requestId y terminate; no mover cálculo ni alterar handlers matemáticos.
- **DXF ambiguo:** subset allowlist, unidades visibles, contenido unsupported bloqueado y ninguna propiedad estructural inferida.
- **Rendimiento:** superficies grandes lazy-loaded; sin claims ni budgets no medidos.

## Validación final

Tests focalizados de commands/modelOperations, historial, workers/fallback, storage/migración/recovery, portable, operación 2D y DXF; luego `npm.cmd run typecheck`, `npm.cmd run verify:protected`, QA manual en build local y, si todo pasa, una sola invocación de `npm.cmd run verify`. Reportar resultados y limitaciones en `reports/YYYY-MM-DD-HHmm-fase-2-evolucion.md`, actualizar una sola vez la matriz y crear un único commit local sin push.
