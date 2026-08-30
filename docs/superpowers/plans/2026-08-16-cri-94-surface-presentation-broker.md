# CRI-94 Surface Presentation Broker Implementation Plan

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Plan ejecutado; conserva decisiones y evidencia de su momento, no certifica el estado actual por sí solo.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered workspace surface booleans and presentation decisions with one broker that preserves logical state, focus, drafts and canvas context across X2/M1/K0.

**Architecture:** A pure table and resolver determine presentation and exclusivity. A narrow React provider owns logical open/suspended state and focus return, while existing surface components retain their real local drafts. A shared modal primitive owns traps; the broker owns background inertness after lazy readiness.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Vite, existing design-system overlay primitives.

## Global Constraints

- Linear CRI-94 is the primary contract; CRI-90 and later issues are out of scope.
- Presentation vocabulary is exactly `band | dock | inset | sheet | drawer | fullscreen | overlay | floating`.
- No protected model/solver/schema/persistence files and no baseline refresh.
- TDD red-green-refactor for every production behavior.
- Only the focal gates requested by CRI-94.

---

### Task 1: Pure presentation table and resolver

**Files:**
- Create: `src/features/workspace/surfacePresentation.ts`
- Test: `src/features/workspace/surfacePresentation.test.ts`

**Interfaces:**
- Produces: `SurfaceId`, `SurfacePresentation`, `SURFACE_PRESENTATION_TABLE`, `resolveSurfacePresentation`, `resolveSurfaceActivity`, `validateSurfaceCombination`.

- [ ] Write literal table tests for every X2/M1/K0 × surface cell and RED tests for R-1, R-2, suspension/resume, migration and `peek` validation.
- [ ] Run `npx vitest run src/features/workspace/surfacePresentation.test.ts` and confirm failures are caused by missing production exports.
- [ ] Implement the minimal immutable table and pure resolver.
- [ ] Rerun the focal test and refactor only after green.

### Task 2: Narrow React broker and focus ownership

**Files:**
- Create: `src/features/workspace/SurfacePresentationProvider.tsx`
- Create: `src/features/workspace/useSurfacePresentation.ts`
- Test: `src/features/workspace/SurfacePresentationProvider.test.tsx`

**Interfaces:**
- Consumes: pure resolver from Task 1 and `ShellClass` from CRI-89.
- Produces: `openSurface`, `closeSurface`, `toggleSurface`, `activateSurface`, `markSurfaceReady`, `presentationFor`, `stateFor`, `isRetained`.

- [ ] Write RED tests for intent-before-lazy-load, suspended instance retention, centralized focus return, semantic focus after recomposition and symmetric modal background cleanup.
- [ ] Run the provider test and verify expected failures.
- [ ] Implement reducer/context/ref registry without importing `WorkspaceUIContext` or project state.
- [ ] Rerun and keep provider output memoized so unrelated selection/result cursor changes cannot be dependencies.

### Task 3: Shared focus primitive

**Files:**
- Modify: `src/design-system/components/modalFocus.ts`
- Modify: `src/design-system/components/overlays.tsx`
- Modify: `src/design-system/components/overlays.test.tsx`
- Modify: `src/design-system/components/ui.css`

**Interfaces:**
- Produces: common drawer/fullscreen trap with optional broker-owned focus restoration and readiness callback.

- [ ] Add RED tests for fullscreen trap, no local return during suspension, readiness, and cleanup.
- [ ] Run `npx vitest run src/design-system/components` and confirm the new tests fail.
- [ ] Remove the duplicated overlay focus implementation, reuse `modalFocus.ts`, and add fullscreen styling without CRI-90 material changes.
- [ ] Rerun the component tests.

### Task 4: Migrate WorkspaceShell authority

**Files:**
- Modify: `src/features/workspace/WorkspaceShell.tsx`
- Modify: `src/features/workspace/AppShellLayout.tsx`
- Modify: `src/features/workspace/workspaceCommands.ts`
- Modify: `src/features/workspace/workspaceCommands.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: broker APIs from Task 2.
- Produces: one logical source for Inspector, Results, Datasheet, Doctor and Palette; `open-results` remains an intention command.

- [ ] Write RED integration tests proving old collapse/expand synchronization is absent and X2→K0→X2 keeps the same logical Inspector open.
- [ ] Replace the four shell booleans and return refs with broker state/ref ownership.
- [ ] Seed/persist Inspector preference without reading it as a second runtime authority.
- [ ] Key layout only from broker-assigned presentation; M1 inset must not reduce canvas.
- [ ] Rerun focal workspace tests.

### Task 5: Make surfaces render assigned presentation

**Files:**
- Modify: `src/features/inspector/Inspector.tsx`
- Modify: `src/features/results/ResultsPanel.tsx`
- Modify: `src/features/datasheet/DatasheetPanel.tsx`
- Modify: `src/features/model-doctor/ModelDoctor.tsx`
- Modify: `src/features/workspace/CommandPalette.tsx`
- Modify direct tests for those components only.

**Interfaces:**
- Consumes: `presentation` and broker activity props; no surface reads `shellClass` to choose its presentation.

- [ ] Add RED tests for Inspector draft preservation, Results no-manual-sync, Datasheet/Doctor drawer↔fullscreen, Palette overlay↔sheet and focus semantics.
- [ ] Remove local presentation choice and special modal/inert implementations.
- [ ] Keep retained/suspended components mounted, passing `open` only to the active presentation frame.
- [ ] Rerun only directly modified component tests.

### Task 6: Continuity integration and browser evidence

**Files:**
- Modify: `src/features/workspace/shellRecomposition.test.tsx`
- Modify: `src/features/canvas/canvasInteraction.test.ts`
- Create: `scripts/qa-surface-presentation.mjs`
- Create: `reports/evidence/2026-08-16-cri-94-surface-presentation/**`

**Interfaces:**
- Produces: deterministic T-INV-1…8 evidence and cases A–G browser assertions/captures.

- [ ] Add RED integration coverage using real selection/result state and real Inspector numeric draft.
- [ ] Add anchor-preservation assertion against the existing camera state, without new camera storage.
- [ ] Run focal tests, then implement only missing wiring until green.
- [ ] Run the Browser-first interaction loop; if unavailable, use the repo Playwright harness and record the reason.

### Task 7: Gates, self-review, report and delivery

**Files:**
- Create: `reports/YYYY-MM-DD-HHmm-cri-94-broker-presentacion.md`
- Modify: `docs/README.md` only to index these historical Superpowers documents.

- [ ] Run exactly: `npm run lint`; `npx vitest run src/features/workspace src/design-system/components`; direct modified-component tests; `npm run typecheck`; `npm run verify:protected`; `npm run qa:model-doctor`; `npm run build`.
- [ ] Review the diff line-by-line against CRI-94 prohibitions and verify protected hashes stayed unchanged.
- [ ] Generate the change report and explicit evidence matrix for T-INV-1…8.
- [ ] Stage explicit paths, commit, push the CRI-94 branch, integrate normally into current `main`, push `origin/main`, and verify the remote SHA.
- [ ] Mark CRI-94 Done and add the Linear closure comment only after fresh post-integration evidence.

## Plan self-review

Every acceptance criterion maps to a task. There are no placeholders, names are consistent across tasks, and no task implements CRI-90, CRI-95/96/97/99/100/102 or protected-domain changes.
