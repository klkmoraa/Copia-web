# Claymorphism ciclo 2 — Task 8: panel de resultados

**Fecha:** 2026-08-07 16:15
**Agente:** Codex
**Rama:** `main`
**Base:** `686a5b6af3f6018db03fd84d15a55f0033271a52`
**Estado:** `IMPLEMENTED_UNCERTIFIED`

## Qué cambió

El panel de resultados consume ahora la materia `raised` eager y mantiene su geometría de canto mediante `--results-clay-border-width`. MatrixView, EducationExplorer, la lectura de cursor y los pasos educativos consumen `flat`; la sustitución numérica quedó integrada y transparente dentro del explorador. La tabla de resultados conserva su estructura sin caja propia y mantiene los bordes de celdas.

`qa.mjs` certifica materia y geometría por separado en desktop, phone portrait `430x932`, phone landscape `690x390` y print. Las familias ausentes se prueban con probes temporales dentro de `.results-panel`, retirados en `finally`.

## Por qué

Task 8 del plan `docs/superpowers/plans/2026-08-07-claymorphism-ciclo2.md` y el brief vinculante exigieron vestir el panel como arcilla sin tocar contratos funcionales o matemáticos. La variable responsive evita que el shorthand eager de `raised` destruya el canto lateral de landscape y el override print neutraliza la materia al imprimir.

## Archivos tocados

- `src/design-system/material.css` — une el panel a `raised`, cuatro familias técnicas a `flat`, centraliza el ancho de borde y neutraliza print.
- `src/styles.css` — retira materia local duplicada, conserva geometría/estados y mueve el canto landscape al hook; también retira el borde local responsive que impedía que el hook ganara la cascada.
- `qa.mjs` — añade `verifyResultsClayMaterial`, comprobaciones responsive/print, probes con limpieza y claves nominales por familia.
- `reports/2026-08-07-1545-claymorphism-ciclo2-task8.md` — este reporte rastreado.
- `.superpowers/sdd/2026-08-07-claymorphism-ciclo2/task-8-report.md` — evidencia SDD ignorada.

## TDD RED → GREEN

### RED

- `npm.cmd run build`: PASS con CSS de producción intacto.
- `node qa.mjs`: FAIL nominal en panel raised desktop, las cuatro familias flat, integración de `.education-numerical-substitution`, fondo print, raised landscape, raised portrait y canto portrait.
- El canto portrait calculado era `1px 1px 0px 1px`: el selector más específico `.results-panel[data-canvas-interactive='true']` conservaba un borde local y anulaba la geometría centralizada.

### GREEN

- Builds de la implementación: PASS.
- `node qa.mjs`: PASS completo antes de las mutaciones, con todas las claves T8 en `true`, `console: []` y `pageErrors: []`.
- Métricas: portrait `1px 0px 0px 0px`; landscape `1px 0px 0px 1px` y `data-canvas-interactive='true'`.
- Desktop: panel raised/sin backdrop/canto superior; cuatro familias flat; sustitución transparente/sin borde/sin sombra; probes retirados; tabla sin caja y celdas con borde.
- Print: fondo transparente, borde cero y sombra `none`.

## Mutaciones

1. **Panel fuera de `raised`: completada.** Build PASS; QA FAIL en las claves nominales del panel y sus cantos en desktop, portrait y landscape. `material.css` se restauró al SHA-256 `20AA1D301990CB64D585053B68745EBAA6610C1184578964F92829AE7077BC94`.
2. **MatrixView fuera de `flat`: completada.** Build PASS; QA FAIL únicamente en `resultsDesktopFlatMatrixViewHasFlatMaterial`. `material.css` volvió al mismo SHA-256.
3. **Hook landscape retirado: completada.** Build PASS; QA FAIL únicamente en `resultsPhoneLandscapePanelHasTopLeftClayGeometry`. `styles.css` se restauró byte a byte al SHA-256 `AD175A8395FCF2388A234B87F11C814CC23DEADB4DCCB5AAD3EDB1FC6A490AF7`.
4. **Override print retirado: completada.** Build PASS; QA FAIL únicamente en las tres claves nominales de fondo, borde y sombra print. `material.css` se restauró byte a byte al SHA-256 `20AA1D301990CB64D585053B68745EBAA6610C1184578964F92829AE7077BC94`.

## Corrección de revisión independiente

El revisor detectó que el helper responsive aceptaba cualquier `box-shadow` distinto de `none`, mientras desktop exigía la firma clay completa. Se corrigió el contrato para reutilizar `hasRaisedClayMaterial` en los tres viewports y se añadió geometría exacta de anchos **y** estilos de borde. La prueba estricta reveló dos overrides responsive con `--sc-shadow-sheet`; se retiraron para que el material eager `--sc-shadow-clay-md` gobierne también portrait y landscape. El modo focused se preservó sin cambios.

## Evidencia visual focalizada

- Desktop día `1536x960`: borde `1px 0 0 0`, dos sombras inset, sin backdrop ni overflow.
- Phone portrait noche `430x932`: panel expandido, borde `1px 0 0 0`, dos sombras inset, canvas interactivo y sin overflow.
- Phone landscape día `690x390`: panel lateral, borde `1px 0 0 1px`, dos sombras inset, canvas interactivo y sin overflow.
- Capturas y métricas: `.superpowers/sdd/2026-08-07-claymorphism-ciclo2/visual/task8/`.
## Cómo verificar

Evidencia obtenida:

- `node --check qa.mjs` — PASS.
- `git diff --check` — PASS antes del reporte; se repite tras escribirlo.
- `npm.cmd run verify:protected` — PASS, 29/29.
- `npx.cmd vitest run src/design-system/tokens.test.ts` — PASS, 1 archivo y 22/22 tests.
- `npm.cmd run build` — PASS en RED y en la implementación GREEN.
- `node qa.mjs` — PASS completo final tras restaurar las cuatro mutaciones, con `console: []` y `pageErrors: []`.
- Guardián final — 63/63 hashes protegidos idénticos; diff prohibido vacío.
- `capturas.mjs` — sin rastrear e intacto, SHA-256 `1F2CDE477FA77BC74A16C1848F544E8C7E5435FFCF0E7A4D12D644EEA774A710`.
- `package.json` — intacto, SHA-256 `4DFD428718F3AF11A23ABA141630DCFFB56049BE724A07F8802AE756129DA76C`.

## Pendiente / siguiente paso

- La re-revisión y las suites posteriores se omiten por instrucción expresa del usuario para acelerar el cierre.
- No se tocaron TSX, dependencias, motor, workers, data, store, tipos, Aula/import ni `capturas.mjs`. No se hizo push.
