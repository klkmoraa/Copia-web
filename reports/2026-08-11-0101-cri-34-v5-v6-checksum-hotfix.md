# Hotfix P0 CRI-34: checksum v5 a v6

**Fecha:** 2026-08-11 01:01
**Agente:** Codex
**Rama:** main

## Qué cambió

`migrateLegacyProject` ya no declara conflicto sólo porque el checksum persistido fue calculado con el schema v5. Cuando el proyecto de IndexedDB y el de localStorage tienen la misma serialización canónica v6, conserva esa semántica y vuelve a guardar por la interfaz existente para actualizar checksum y schema del registro a v6.

La detección de conflictos sigue activa: si las representaciones canónicas difieren, se crea la recuperación de migración y no se sobrescribe IndexedDB.

## Por qué

CRI-34 añadió `materialOrigin` y `sectionOrigin` durante la normalización de proyectos v1-v5, sin inferir IDs desde floats. Un registro IndexedDB escrito en v5 tenía un SHA-256 de la serialización previa; el localStorage equivalente se normalizaba a v6 antes de calcular su SHA-256. La comparación literal de ambos digests devolvía un falso conflicto pese a que el contenido estructural era el mismo.

## Archivos tocados

- `src/storage/projectRepository.ts` — compara contenido canónico para decidir conflicto y actualiza el registro equivalente que conserva checksum/schema históricos.
- `src/storage/projectRepository.test.ts` — regresión TDD con fila IndexedDB v5, checksum SHA-256 histórico, localStorage v6 equivalente, idempotencia y ausencia de recovery.
- `docs/superpowers/plans/2026-08-11-cri-34-v5-v6-checksum-hotfix.md` — plan mínimo y ciclo RED/GREEN ejecutado.
- `reports/2026-08-11-0101-cri-34-v5-v6-checksum-hotfix.md` — este reporte.

## Cómo verificar

- RED previo: `npx.cmd vitest run src/storage/projectRepository.test.ts --maxWorkers=1` falló exactamente con `expected 'conflict' to be 'migrated'` en la nueva regresión.
- GREEN focalizado: `npx.cmd vitest run src/storage/projectRepository.test.ts src/data/migrate.test.ts --maxWorkers=1` — PASS, 2 archivos / 17 pruebas.
- `npm.cmd run lint` — exit 0; conserva dos advertencias preexistentes `react(only-export-components)` del prototipo iOS.
- `npm.cmd run typecheck` — PASS.
- `npm.cmd test` — PASS, 144 archivos / 1083 pruebas aprobadas / 8 omitidas.
- `npm.cmd run verify:protected` — PASS, 29 archivos de frontera protegida intactos.
- `npm.cmd run build` — PASS.
- `npm.cmd run verify:perf` — PASS, 769910 bytes / 201469 gzip; sin techo bloqueante.
- `git diff --check` — PASS.
- `npm.cmd run verify` — NO PASA: se detuvo en dos timeouts de 5 s del flake conocido y ajeno `src/features/space3d/Space3DWorkspace.test.tsx` (casos de líneas 55 y 139). Antes de ello, lint y `verify:protected` pasaron. No se modificaron Space3D, el test ni sus timeouts.

## Pendiente / siguiente paso

- Fuera de CRI-34, estabilizar por separado el flake paralelo de `Space3DWorkspace.test.tsx`; no pertenece a este hotfix.
- El cambio se deja en un commit local sin push, PR ni merge. No se tocó el workspace separado de Claude en `Structure-cri34-material-section-identity`.
