# Revalidación de procedencia CRI-5 frente a origin/main

**Fecha:** 2026-08-11 08:54
**Agente:** Codex
**Rama:** main

## Qué cambió

Se registró la procedencia de la revisión CRI-5 contra el estado remoto actual. No se modificaron fuentes permanentes, código, contratos, dependencias ni documentación canónica de producto.

## Por qué

Antes de cerrar CRI-5 se solicitó volver a contrastar `origin/main` con el baseline originalmente usado y actualizar una fuente canónica sólo ante un cambio o aclaración estable demostrable.

## Procedencia de la investigación

- Baseline de comparación original: `5d3db83c5534b0f5f172563f9eecce2de3a1322f`.
- `origin/main` consultado y refrescado: `9c866bc8cedae3ae4e08eb0656ab850d62390199`.
- La relación no es lineal: su merge-base es `7c7d3b2c23419db5bc37326e2e23ea37d2552132`. El análisis usa comparación explícita de árboles `5d3db83..9c866bc8`, no una inferencia de historia lineal.
- Fuentes de autoridad revisadas en el árbol remoto: `docs/README.md`, `docs/architecture/README.md` y `docs/architecture/structureco-member-identity-v6.md`.

## Resultado de contratos estables

Los blobs de baseline y remoto son idénticos para los ocho archivos que cubren migración, persistencia, checksums, recovery, normalización v6 e identidad:

- `src/data/migrate.ts` y `src/data/migrate.test.ts`.
- `src/storage/projectRepository.ts` y `src/storage/projectRepository.test.ts`.
- `src/data/projectStorage.ts`.
- `src/data/defaultProject.ts`.
- `src/types.ts`.
- `src/commands/projectCommand.ts`.

Por tanto, el delta remoto no demuestra un cambio de contrato de migración, persistencia, checksum, recovery, normalización v6, `materialId` ni `sectionId` respecto del baseline indicado.

La única aclaración estable encontrada es de autoridad documental: el contrato existente `docs/architecture/structureco-member-identity-v6.md` queda clasificado como `CANONICAL` y el mapa de arquitectura lo enlaza explícitamente como tal. Esto no modifica su contenido de contrato ni autoriza inferir IDs desde valores numéricos.

## Contradicción y cobertura afectadas

- Cobertura de contratos: los ocho blobs anteriores fueron comparados de forma directa y resultaron idénticos.
- Consistencia de autoridad: el mapa de arquitectura remoto y el documento de identidad v6 coinciden en su clasificación `CANONICAL`.
- `node --test scripts/check-docs.test.mjs` sobre el árbol remoto — PASS, 2/2.
- `node scripts/check-docs.mjs` sobre el árbol remoto — PASS, 15 documentos bajo `docs/**` clasificados, archivos obligatorios y enlaces relativos válidos.
- Cobertura pendiente: el mapa de arquitectura enumera el contrato de identidad v6 como `CANONICAL`, pero la tabla resumida de documentos canónicos en `docs/README.md` no lo lista. El validador remoto no exige exhaustividad semántica del índice, por lo que la verificación automática pasa pese a esa omisión de cobertura.
- Límite: no hay una matriz CRI-5 versionada en los checkouts de StructureCo para ejecutar una comprobación adicional de contradicción/cobertura en sitio.

## Base canónica y fuentes permanentes

No se actualizó contenido de fuentes permanentes: no hubo cambio de contrato de producto en el delta comparado. Esta procedencia reconoce exclusivamente la aclaración remota de autoridad para el documento v6; no incorpora historia de incidencias ni detalles temporales de implementaciones.

## Archivos tocados

- `reports/2026-08-11-0854-cri-5-provenencia-origin-main.md` — este registro de procedencia y resultados de revalidación.

## Cómo verificar

- `git ls-remote origin refs/heads/main` debe devolver `9c866bc8cedae3ae4e08eb0656ab850d62390199`.
- `git diff 5d3db83c5534b0f5f172563f9eecce2de3a1322f 9c866bc8cedae3ae4e08eb0656ab850d62390199 -- <rutas de contrato>` no debe mostrar cambios en las rutas listadas.
- En un worktree temporal de `origin/main`: `node --test scripts/check-docs.test.mjs && node scripts/check-docs.mjs`.

## Pendiente / siguiente paso

- Si CRI-5 mantiene una matriz de fuentes o de contradicción fuera de los checkouts de StructureCo, hace falta su ruta explícita para registrar esta procedencia directamente allí.
- Reconciliar en la rama que contiene el índice canónico la lista resumida de `docs/README.md` con el mapa de arquitectura; no se realiza en este checkout divergente.
- No hay push, PR, merge ni modificación de workspaces ajenos.
