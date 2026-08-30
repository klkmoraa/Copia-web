# CRI-34 v5 to v6 Checksum Hotfix Implementation Plan

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Plan ejecutado; conserva decisiones y evidencia de su momento, no certifica el estado actual por sí solo.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a false localStorage to IndexedDB migration conflict when a v5 project and its v6 normalization describe the same project.

**Architecture:** Keep the existing checksum for integrity and marker keys. At the one migration comparison boundary, compare canonical normalized project content when an IndexedDB record already exists; retain a recovery and conflict for any canonical-content difference.

**Tech Stack:** TypeScript, Vitest, Web Crypto, existing in-memory repository.

## Global Constraints

- Base is `main` at `5d3db83c5534b0f5f172563f9eecce2de3a1322f`, newer than `origin/main` `9c866bc8`.
- Do not add dependencies, touch solver, Space3D, mathematical logic, IDs, undo/redo, recoveries, or topology.
- Do not infer material or section IDs from floating-point values.
- Do not remove checksum-based persistence verification or real conflict detection.
- No push, PR, merge, timeout changes, or edits to the separate Claude workspace.

---

### Task 1: Reproduce the checksum-version false conflict

**Files:**

- Modify: `src/storage/projectRepository.test.ts`
- Uses: `migrateLegacyProject`, `normalizeProject`, `InMemoryProjectRepository`
- Produces: a RED regression that seeds an IndexedDB-shaped v5 record with its historical checksum and migrates semantically equal v6 localStorage.

- [x] **Step 1: Write the failing test**

Build a v5 source by removing only v6 member identity fields, calculate its historical SHA-256 over the v5 serialized form, seed it as the IndexedDB record, then migrate its v6 normalization from localStorage. Assert `migrated`, no recovery, retained project identity/provenance, and `already-migrated` on the second invocation.

- [x] **Step 2: Run the focused test to verify RED**

Run: `npx.cmd vitest run src/storage/projectRepository.test.ts --maxWorkers=1`

Expected before the fix: the new case fails because `existing.checksum !== checksum` returns `conflict` solely from v5/v6 serialization differences.

### Task 2: Apply the smallest canonical comparison fix

**Files:**

- Modify: `src/storage/projectRepository.ts`
- Test: `src/storage/projectRepository.test.ts`
- Produces: `migrateLegacyProject` treats canonical-equivalent existing and source projects as the same while preserving checksum integrity checks and recoveries for differing content.

- [x] **Step 1: Implement only the comparison change**

At the existing-record conflict branch, compare `serializeProject(existing.project)` with `serializeProject(project)` instead of only the persisted checksum. Keep the existing checksum in marker keys and read-back validation unchanged.

- [x] **Step 2: Run focused tests to verify GREEN**

Run: `npx.cmd vitest run src/storage/projectRepository.test.ts src/data/migrate.test.ts --maxWorkers=1`

Expected: the semantic v5/v6 case migrates and is idempotent; the existing distinct-content conflict remains a conflict with a recovery.

### Task 3: Verify and hand off locally

**Files:**

- Create: `reports/YYYY-MM-DD-HHmm-cri-34-v5-v6-checksum-hotfix.md`
- Modify: `docs/superpowers/plans/2026-08-11-cri-34-v5-v6-checksum-hotfix.md`

- [x] **Step 1: Run required gates**

Run: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run verify`, and `npm.cmd run build`.

- [x] **Step 2: Check protected scope and diff**

Run: `npm.cmd run verify:protected`, `git diff --check`, and inspect the path list. The only production path is `src/storage/projectRepository.ts`; no solver, worker, Space3D, or numerical file may differ.

- [x] **Step 3: Create the Spanish change report and commit locally**

Include the demonstrated cause, RED/GREEN evidence, verification results, base SHA, touched files, no-push state, and remaining `Space3DWorkspace.test.tsx` flake risk. Stage only the hotfix test/code, plan, and report, then create one local `fix:` commit without pushing.
