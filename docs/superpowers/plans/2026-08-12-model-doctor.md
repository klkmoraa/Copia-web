# Model Doctor Implementation Plan

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Plan ejecutado; conserva decisiones y evidencia de su momento, no certifica el estado actual por sí solo.

> **For agentic workers:** Implementar por loops; subagentes sólo investigan o evalúan. El Integrator es el único writer. No commit ni push.

**Goal:** Construir Model Doctor preventivo, localizable, explicativo y con reparación topológica segura, preview exacto y undo/redo.

**Architecture:** Adapter puro sobre `validateProject`; UI lazy bajo `features/model-doctor`; target resolver compartido; `topology.repair` y aplicación preparada con snapshot global exacto. Sin store, schema, solver alterno ni dependencia nueva. La decisión estática de grounding ya usada por el análisis se extrajo a un helper compartido, sin tocar ensamblaje ni matemática.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Playwright existente, ProjectCommand patches, design system Clay.

## Global Constraints

- Baseline `2cef4d65862f0c057bb618f7c80a25756c8c1ecb`; preservar los dos directorios `validation/topbar-repeat-*` ajenos.
- Trabajar en `main`; no commit; no push.
- TDD estricto: cada comportamiento nuevo debe verse RED por la razón esperada antes de producción.
- No modificar solver math, workers, schema, persistencia, formatos, PDF ni Space 3D.
- No ampliar heurísticas de `validateProject` ni `repairProjectTopology`.

---

### Task 1: Diagnostic adapter y target resolver

**Files:**
- Create: `src/features/model-doctor/modelDoctorDiagnostics.test.ts`
- Create: `src/features/model-doctor/modelDoctorDiagnostics.ts`
- Create: `src/features/workspace/validationIssueTarget.test.ts`
- Create: `src/features/workspace/validationIssueTarget.ts`
- Modify: `src/features/results/ResultsPanel.tsx`

**Produces:** `buildModelDoctorReport(project)`, `resolveValidationIssueTarget(project, issue)`.

- [x] Escribir RED para severidades, categorías, IDs duplicados deterministas, conteos, explicación/impacto, targets válidos/rotos y reparabilidad/skips sin mutación.
- [x] Ejecutar focal y confirmar fallos por símbolos ausentes.
- [x] Implementar mapping mínimo consumiendo `validateProject` y repair sobre clon.
- [x] Extraer la resolución inline de Results sin cambiar su comportamiento.
- [x] Ejecutar focal GREEN y evaluación adversarial de duplicación, IDs y imports.

### Task 2: Preview y comando preparado

**Files:**
- Create: `src/features/model-doctor/topologyRepairPreview.test.ts`
- Create: `src/features/model-doctor/topologyRepairPreview.ts`
- Modify: `src/commands/projectCommand.test.ts`
- Modify: `src/commands/projectCommand.ts`
- Modify: `src/store/ProjectModelContext.tsx`
- Modify: `src/store/ProjectContext.test.tsx`
- Modify: `src/store/ProjectContext.tsx`

**Produces:** `prepareTopologyRepair(project)`, `topology.repair`, `executePreparedTopologyRepair(preview)`.

- [x] Escribir RED para merge compatible, skip incompatible, splits múltiples, cargas, effects, end mechanics, prescribed, orden, no mutación y patches inspeccionables.
- [x] Escribir RED para apply==preview, stale por cambio relacionado/no relacionado, rechazo atómico, analysis invalidation, una entrada, undo exacto y redo exacto.
- [x] Confirmar RED por contrato ausente.
- [x] Implementar repair preparado mediante la función existente y snapshots completos.
- [x] Ejecutar focal GREEN y evaluación domain adversarial.

### Task 3: Surface UI y launchers

**Files:**
- Create: `src/features/model-doctor/ModelDoctor.test.tsx`
- Create: `src/features/model-doctor/ModelDoctor.tsx`
- Create: `src/features/model-doctor/modelDoctor.css`
- Create: `src/features/model-doctor/modelDoctorI18n.ts`
- Modify: `src/features/workspace/workspaceCommands.test.ts`
- Modify: `src/features/workspace/workspaceCommands.ts`
- Modify: `src/features/workspace/CommandPalette.test.tsx`
- Modify: `src/features/workspace/CommandPalette.tsx`
- Modify: `src/features/topbar/TopBar.test.tsx`
- Modify: `src/features/topbar/TopBar.tsx`
- Modify: `src/features/workspace/WorkspaceShell.tsx`

**Produces:** lazy Drawer, summary, severity filters, cards, explanation, acknowledgement, Localizar, preview/confirm/apply.

- [x] Escribir RED de all-clear, summary, filtros, reconocimiento permitido, no ocultar critical, localizar/no-localizable, preview/cancel/apply y stale feedback.
- [x] Escribir RED de launcher antes de analysis, command bus, Escape, focus return e inert background.
- [x] Confirmar RED por surface/comando ausentes.
- [x] Implementar con Drawer/tokens existentes; sin modal anidado ni imports de Results.
- [x] Ejecutar focal GREEN y revisión React/web-design/a11y.

### Task 4: Integración, browser QA y gates

**Files:**
- Create: `scripts/qa-model-doctor.mjs`
- Modify: `package.json`
- Modify: `reports/2026-08-12-1415-model-doctor.md`

- [x] Caracterizar que `analyze()` conserva su auto-repair actual.
- [x] Probar que abrir/cerrar/localizar/ack/preview no mutan ni invalidan; apply sí; cambios refrescan findings.
- [x] Añadir QA browser A–F con geometría, temas, keyboard y stale.
- [x] Ejecutar focal, QA Model Doctor, `qa:topbar`, `qa`, `qa:webkit`.
- [x] Ejecutar suite completa serial, typecheck, lint, protected, build, perf y diff-check.
- [x] Ejecutar Brooks audit/test/review y evaluadores globales; reparar BLOCKER/MAJOR y repetir.
- [x] Completar reporte con evidencia fresca y limitaciones reales.
