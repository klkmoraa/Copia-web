# CRI-96 Selection and Candidate Picker Implementation Plan

> **HISTORICAL** — Execution plan for a dated CRI-96 slice. Current behavior is proven by code and gates, not this file.

**Clasificación:** `HISTORICAL`

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Each production behavior must follow RED → GREEN → focused regression.

**Goal:** Make ambiguous canvas selection a five-phase, non-destructive flow: detect candidates, preview locally, cycle, confirm, or cancel without changing the prior selection.

**Architecture:** A local `CandidatePickerState` contains explicit structural IDs, the active index, the prior selection, and the anchor. `StructuralCanvas` opens that state from one candidate-collection path for pointer and keyboard activation, while the broker only owns its contextual presentation. The committed `WorkspaceUIContext.selection` is read unchanged for preview and written only by confirmation.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, Testing Library, Playwright/Vite, existing canvas SVG layers, Surface Presentation broker.

## Global Constraints

- Base branch: `origin/main` SHA `5e7be31860e5fed68a3af5498209a100a471e41a`; CRI-89 and CRI-94 are Done.
- Do not modify `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts`, solver/model/schema/persistence/undo-redo, numerical geometry, or protected baseline.
- Candidate identity is always `{ kind, id }`; never infer by material/section floats or coordinates.
- Keep candidate preview and picker state local to canvas interaction. Do not add it to `WorkspaceUIContext` and do not change `selection` before confirmation.
- The touch floor remains 44 px through hit targets only; technical node/member/load drawing dimensions remain unchanged.
- Long press is exactly 480 ms and requires both touch selection intent and movement within a strict jitter tolerance; a slow pan cancels the long-press path before it can open marquee or picker.
- In Compact the `candidatePicker` surface is broker-governed. Recomposition changes its presentation or cancels it cleanly; it never confirms automatically. Escape is stopped at picker scope.
- No CRI-97, contextual action bar, directional selection frame, Brandbook/Clay/color redesign, or dependency update.

---

### Task 1: Candidate state and gesture decisions

**Files:**

- Create: `src/features/canvas/candidatePicker.ts`
- Test: `src/features/canvas/candidatePicker.test.ts`
- Modify: `src/features/canvas/canvasInteraction.ts`
- Test: `src/features/canvas/canvasInteraction.test.ts`

**Interfaces:**

- Produces `CandidateTarget`, `CandidatePickerState`, `openCandidatePicker`, `cycleCandidatePicker`, `activeCandidate`, and `isLongPressEligible`.
- Consumes only explicit `StructuralTarget` kind/id pairs and `Selection` snapshots.

- [ ] **Step 1: Write RED tests for picker state and touch timing**

```ts
expect(openCandidatePicker(candidates, previous, anchor)?.activeIndex).toBe(0);
expect(cycleCandidatePicker(state, 'end').activeIndex).toBe(2);
expect(isLongPressEligible({ elapsedMs: 480, movedPx: 0, pointerType: 'touch' })).toBe(true);
expect(isLongPressEligible({ elapsedMs: 480, movedPx: 4, pointerType: 'touch' })).toBe(false);
```

- [ ] **Step 2: Run the new test and observe missing-module/behavior failures**

Run: `npx.cmd vitest run src/features/canvas/candidatePicker.test.ts src/features/canvas/canvasInteraction.test.ts --maxWorkers=1`

- [ ] **Step 3: Implement the pure local state and movement/timing helpers**

Use immutable ID-based candidate lists, modulo cycling for arrows, direct bounds for Home/End, `LONG_PRESS_MS = 480`, and a jitter tolerance smaller than the touch pan threshold.

- [ ] **Step 4: Run the focused unit tests to green**

Run: `npx.cmd vitest run src/features/canvas/candidatePicker.test.ts src/features/canvas/canvasInteraction.test.ts --maxWorkers=1`

### Task 2: Renderable picker and unambiguous preview

**Files:**

- Create: `src/features/canvas/CandidatePicker.tsx`
- Test: `src/features/canvas/CandidatePicker.test.tsx`
- Modify: `src/features/canvas/CanvasGeometryLayer.tsx`
- Modify: `src/features/canvas/CanvasInteractionLayer.tsx`
- Modify: `src/styles.css`

**Interfaces:**

- `CandidatePicker` receives local state and `onCycle`, `onConfirm`, `onCancel`; it stops handled keyboard events before a containing surface receives them.
- `CanvasGeometryLayer` receives optional `candidatePreview` and keeps committed selection and candidate preview visibly distinct in color-independent SVG treatment.

- [ ] **Step 1: Write RED component tests**

```tsx
fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
expect(onCycle).toHaveBeenCalledWith('next');
fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
expect(onCancel).toHaveBeenCalledOnce();
expect(parentEscape).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the component test and observe the expected failure**

Run: `npx.cmd vitest run src/features/canvas/CandidatePicker.test.tsx --maxWorkers=1`

- [ ] **Step 3: Implement a semantic listbox and preview treatment**

Render active descendant/current option with a visible focus ring, text labels, pointer controls with 44 px target floor, and a dashed/non-color-only candidate outline. Keep technical geometry dimensions and the committed selection visuals unchanged.

- [ ] **Step 4: Run candidate state and component tests to green**

Run: `npx.cmd vitest run src/features/canvas/candidatePicker.test.ts src/features/canvas/CandidatePicker.test.tsx --maxWorkers=1`

### Task 3: Broker ownership and canvas event integration

**Files:**

- Modify: `src/features/workspace/surfacePresentation.ts`
- Test: `src/features/workspace/surfacePresentation.test.ts`
- Modify: `src/features/canvas/StructuralCanvas.tsx`
- Test: `src/features/canvas/StructuralCanvas.candidatePicker.test.tsx`

**Interfaces:**

- `candidatePicker` is a broker surface: floating in X2/M1 and sheet in K0, subject to R-1.
- `StructuralCanvas` owns candidate ephemeral state, requests the broker surface when available, and falls back safely in isolated canvas tests.

- [ ] **Step 1: Write RED tests for broker and full interaction contract**

```tsx
expect(resolveSurfacePresentation('K0', 'candidatePicker')).toBe('sheet');
expect(selectionModel()).toEqual(previousSelection);
await user.keyboard('{ArrowDown}{Enter}');
expect(selectionModel()).toEqual({ kind: 'member', id: 'M1' });
```

- [ ] **Step 2: Run the focused tests and observe picker/broker failures**

Run: `npx.cmd vitest run src/features/workspace/surfacePresentation.test.ts src/features/canvas/StructuralCanvas.candidatePicker.test.tsx --maxWorkers=1`

- [ ] **Step 3: Integrate one candidate collection path**

Collect de-duplicated `data-structure-kind` / `data-structure-id` candidates for mouse, touch, pen, and keyboard activation. A sole candidate keeps the existing immediate action. Two or more open the local picker, preview its active candidate, focus it, and leave `selection` untouched until explicit Enter/click confirmation. Route long press through the same candidate path; background long press becomes marquee only after 480 ms and only if it did not begin panning.

- [ ] **Step 4: Cover cancellation and recomposition**

Escape prevents default and stops propagation, closes only the picker, restores canvas focus, and preserves prior selection. Shell-class recomposition retains or closes the local picker without calling `setSelection`; neither path confirms a candidate.

- [ ] **Step 5: Run focused integration tests to green**

Run: `npx.cmd vitest run src/features/canvas/StructuralCanvas.candidatePicker.test.tsx src/features/workspace/surfacePresentation.test.ts --maxWorkers=1`

### Task 4: Browser QA and durable evidence

**Files:**

- Modify: `scripts/qa-structural-edits.mjs`
- Create: `docs/ux-redesign/evidence/2026-08-16-cri-96-selection-candidate-picker.md`
- Create: `reports/2026-08-16-HHmm-cri-96-selection-candidate-picker.md`

- [ ] **Step 1: Extend RED browser assertions**

Seed a point with three explicit overlapping targets, assert keyboard cycling and preview, commit only active target, assert Escape leaves old selection, dispatch touch long press and slow pan, inspect 44 px hit targets against unchanged rendered technical marks, set Compact and rotate with open picker, and capture normal plus grayscale screenshots.

- [ ] **Step 2: Run Chromium browser QA and correct only CRI-96 behavior**

Run: `npm.cmd run qa:structural-edits`

- [ ] **Step 3: Run the mandatory WebKit QA and correct real pointer/long-press differences**

Run: `npm.cmd run qa:structural-edits:webkit`

- [ ] **Step 4: Record observed artifacts, exact gates, scope review, and remaining risks**

Classify evidence as `AUDIT/TEMPORARY`; record Chromium/WebKit artifacts and explicitly state that CRI-97 did not start.

### Task 5: Final gates, review, integration, and Linear closure

**Files:**

- Modify: only files proven necessary by Tasks 1–4.

- [ ] **Step 1: Run requested gates without mass tests**

```powershell
npm.cmd run lint
npx.cmd vitest run src/features/canvas src/utils --maxWorkers=1
npm.cmd run typecheck
npm.cmd run verify:protected
npm.cmd run qa:structural-edits
npm.cmd run qa:structural-edits:webkit
npm.cmd run build
```

- [ ] **Step 2: Self-review the diff**

Check five phases, every input route, Escape scope, broker R-1/T-INV-1 behavior, grayscale distinction, no changed geometry size, protected paths, and no CRI-97 scope.

- [ ] **Step 3: Commit and integrate**

Stage only CRI-96 paths plus its report and evidence, commit, push the feature branch, fast-forward/merge to `main` through the normal repository flow, push `main`, and verify `origin/main` SHA.

- [ ] **Step 4: Close Linear only after fresh evidence**

Mark CRI-96 Done and comment with final main SHA, all requested gate results, and evidence paths.
