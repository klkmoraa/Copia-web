# Edición estructural avanzada 2D

**Fecha:** 2026-08-13 01:28
**Agente:** Codex
**Rama:** main

## Qué cambió

Se incorporaron Move, Rotate, Mirror (transformar o copiar), Linear Array, Align y Distribute sobre `ProjectModel` real. Las operaciones usan una preparación pura e inmutable para que el preview coincida exactamente con el commit, con cancelación sin mutación, una sola entrada de undo/redo e invalidación de resultados sin relanzar el análisis.

El canvas recibió una superficie contextual Clay dentro de Edit/Selection, entrada numérica, snapping, gesto explícito para touch y previews transitorios. Las copias reutilizan el clipboard/remapeo existente, generan IDs nuevos y conservan referencias estructurales. Se añadieron límites de réplica, validación de referencias/identidad de catálogo y cobertura de QA real en Chromium y WebKit.

También se endureció el arnés QA general contra recargas de actualización PWA durante recorridos visuales y se corrigió el área táctil del cierre de notificaciones a 44 px.

## Por qué

La edición de marcos, crujías y geometrías repetitivas requería operaciones estructurales rápidas sin convertir el producto en un CAD generalista ni alterar solver, Space 3D, topología automática, referencias, catálogo o persistencia durante un preview.

## Archivos tocados

- `src/data/structuralEditing.ts` y `src/data/structuralEditing.test.ts` — core puro, operación preparada, replicación/remapeo y validación.
- `src/store/ProjectContext.tsx`, `src/store/ProjectModelContext.tsx` y sus pruebas — confirmación atómica, history e invalidación.
- `src/features/canvas/StructuralCanvas.tsx`, `StructuralEditOverlay.tsx`, `CanvasStructuralEditPreviewLayer.tsx`, `structuralEditUi.ts` y pruebas — interacción, preview, foco, snapping y rendimiento.
- `src/features/canvas/ToolBar.tsx`, `phase2.css`, `workspaceCommands.ts`, `catalogs.ts` y pruebas — integración contextual Clay e i18n.
- `scripts/qa-structural-edits.mjs`, `qa.mjs` y `package.json` — QA de edición y estabilización de gates visuales/seriales.
- `src/styles.css` — canvas status no intercepta gestos y cierre de toast con target táctil de 44 px.
- `docs/README.md` y `docs/superpowers/{specs,plans}/2026-08-12-advanced-2d-structural-editing*` — diseño y plan históricos indexados.
- `scripts/protected-baseline.sha256` — hashes autorizados de la nueva frontera estructural y ProjectContext.

## Cómo verificar

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run verify:protected
npm.cmd run build
npm.cmd run qa
npm.cmd run qa:webkit
npm.cmd run qa:structural-edits
npm.cmd run qa:structural-edits:webkit
npm.cmd run qa:topbar
npm.cmd run qa:model-doctor
npm.cmd run verify:space3d
npm.cmd run validate:ci
npm.cmd run verify
```

Resultado de esta entrega: todos los comandos anteriores pasaron; `npm test` y `verify` registraron 156 archivos y 1,257 pruebas aprobadas, con 8 omitidas. Lint mantiene únicamente dos warnings preexistentes del prototipo iOS; el build mantiene el aviso no bloqueante de chunks grandes.

## Pendiente / siguiente paso

Rectangular Array se descartó intencionalmente: no aportaba un core reutilizable suficientemente limpio dentro de este alcance. No hay pendiente técnico de la entrega. El commit queda local en `main`; no se hará push sin autorización explícita.
