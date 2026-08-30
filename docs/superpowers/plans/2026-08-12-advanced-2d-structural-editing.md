# Advanced 2D Structural Editing Implementation Plan

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Plan de ejecución; conserva el método y evidencia de esta entrega, no certifica por sí solo el estado actual.

> **For agentic workers:** el Integrator es el único writer. Los subagentes investigan y revisan en read-only. Ejecutar cada bloque RED → mínimo GREEN → refactor → regresión.

**Goal:** implementar Move, Rotate, Mirror, Linear Array, Align y Distribute sobre `ProjectModel` real con preview exacto, snapping, entrada numérica, cancel puro, una intención de history e invalidación sin reanálisis automático.

**Architecture:** core estructural puro y preparado bajo `src/data`; executor estrecho en context; surface contextual Clay y gesto explícito bajo canvas. Copias reutilizan clipboard/paste, quedan congeladas con sus IDs finales y se aplican sin recompilar.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, QA Playwright existente, design system Clay. Sin dependencias nuevas.

## Constraints globales

- Baseline `638601cf5a669b4cc225826e7c2c1b730c4a2e2d`; preservar `validation/topbar-repeat-{before,after}/` sin rastrear.
- Trabajar sólo en `main`; commit local al finalizar; no push.
- No modificar solver, workers, teoría, reliability, Space 3D ni Aula.
- Mantener unidades, signos, referencias, catálogos, topología, persistencia y regresiones existentes.
- Actualizar deliberadamente el baseline protegido sólo para las rutas estructurales autorizadas y verificar el diff exacto.

### Task 1: Core geométrico y operación preparada

**Files:**
- Create: `src/data/structuralEditing.test.ts`
- Create: `src/data/structuralEditing.ts`

- [ ] RED de helpers 2D, selección/clausura y parámetros inválidos.
- [ ] RED de Move/Rotate/Mirror transform y shared nodes.
- [ ] RED de Mirror copy/Linear Array, IDs y todas las referencias.
- [ ] RED de Align/Distribute, orden, degenerados e incompatibles.
- [ ] RED de source inmutable, stale, preview==apply y validación global.
- [ ] Implementar mínimo, GREEN, refactor y regresión `modelOperations`.

### Task 2: History, invalidación y persistencia

**Files:**
- Modify: `src/store/ProjectModelContext.tsx`
- Modify: `src/store/ProjectContext.tsx`
- Modify: `src/store/ProjectContext.test.tsx`

- [ ] RED de cancel sin publicación/history/invalidation.
- [ ] RED de confirmación única, invalidación, sin auto-analysis, undo/redo exactos.
- [ ] RED de stale atómico.
- [ ] Implementar `executePreparedStructuralEdit`, GREEN y regresión de transacciones/commands.

### Task 3: Surface contextual y gesto de canvas

**Files:**
- Create: `src/features/canvas/StructuralEditOverlay.test.tsx`
- Create: `src/features/canvas/StructuralEditOverlay.tsx`
- Create: `src/features/canvas/structuralEditUi.ts`
- Create: `src/features/canvas/structuralEditUi.test.ts`
- Modify: `src/features/canvas/StructuralCanvas.tsx`
- Modify: `src/features/canvas/CanvasInteractionLayer.tsx`
- Modify: `src/features/canvas/phase2.css`
- Modify: catalogs i18n requeridos

- [ ] RED de acciones válidas/disabled, modos, numeric validation y semánticas visibles.
- [ ] RED de gesto Move/Rotate/Mirror/Array, snap y rAF.
- [ ] RED de Escape/focus, Apply/Cancel y preview local.
- [ ] Implementar surface Clay responsive y preview sobre geometry real.
- [ ] GREEN, revisión React y regresión de node drag/selection/touch pan.

### Task 4: QA renderizada y gates

**Files:**
- Create: `scripts/qa-structural-edits.mjs`
- Modify: `package.json`
- Create: `reports/2026-08-12-HHmm-advanced-2d-structural-editing.md`
- Modify: `scripts/protected-baseline.sha256`

- [ ] QA Chromium: Move pointer/numeric/cancel, Rotate, Mirror, Array, Align, Distribute, undo/redo, snap, invalidación, teclado/foco y consola.
- [ ] QA tablet/mobile: tray, touch targets y gesto explícito; conservar pan normal.
- [ ] QA WebKit de los flujos críticos.
- [ ] Revisores read-only domain, UX y adversarial; revisión integrador React/performance.
- [ ] Corregir BLOCKER/MAJOR y repetir gates afectados.
- [ ] Ejecutar typecheck, lint, test, protected, build, qa, qa:webkit, verify y gates adicionales.
- [ ] Completar change report, revisar diff/staged exactos y crear commit local en `main` sin push.
