# Workspace TopBar and Repeat Implementation Plan

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Plan ejecutado; conserva decisiones y evidencia de su momento, no certifica el estado actual por sí solo.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Workspace TopBar and Repeat affordance visibly clearer and more tactile without changing Workspace behavior or structural-domain contracts.

**Architecture:** Preserve TopBar's existing three data zones and callbacks, adding only presentational grouping landmarks. Extract the existing Repeat markup into a focused overlay component that receives state and existing callbacks, so presentation can evolve independently of placement logic.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS custom properties, Motion, Playwright QA.

## Global Constraints

- Do not modify `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/**`, persistence formats, topology, or result contracts.
- Reuse the existing Clay tokens and support light, dark, responsive, focus-visible, keyboard, and reduced-motion behavior.
- Keep all existing TopBar and Repeat actions available at every current breakpoint.

---

### Task 1: Lock the visual contracts with component tests

**Files:**
- Modify: `src/features/topbar/TopBar.test.tsx`
- Create: `src/features/canvas/RepeatActionOverlay.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
expect(container.querySelector('[data-topbar-cluster="document"]')).not.toBeNull();
expect(screen.getByRole('button', { name: /Repetir/i })).toHaveAttribute('aria-keyshortcuts', 'R');
```

- [ ] **Step 2: Run the focused tests and confirm the new expectations fail**

Run: `npx.cmd vitest run src/features/topbar/TopBar.test.tsx src/features/canvas/RepeatActionOverlay.test.tsx --maxWorkers=1`

- [ ] **Step 3: Implement only the required semantic landmarks and repeat overlay**

```tsx
<section className="repeat-context" role="status">
  <strong>{preview}</strong>
  <span>{instruction}</span>
</section>
```

- [ ] **Step 4: Run focused tests and confirm they pass**

Run: `npx.cmd vitest run src/features/topbar/TopBar.test.tsx src/features/canvas/RepeatActionOverlay.test.tsx --maxWorkers=1`

### Task 2: Apply the Clay visual redesign

**Files:**
- Modify: `src/styles.css`
- Modify: `src/features/workspace/phase1.css`

- [ ] **Step 1: Add scoped TopBar clusters and repeat animation styles**

```css
.repeat-context { border-inline-start: 3px solid color-mix(in srgb, var(--success) 72%, var(--border)); }
@media (prefers-reduced-motion: reduce) { .repeat-action-control, .repeat-preview { animation: none; } }
```

- [ ] **Step 2: Verify desktop, tablet, phone, light, dark, and reduced-motion with browser screenshots**

Run: `npm.cmd run qa`

### Task 3: Verify and publish

**Files:**
- Create: `reports/2026-08-11-<time>-workspace-topbar-repeat.md`

- [ ] **Step 1: Run scope, focused, full, and build verification**

Run: `npm.cmd run verify:protected`, focused Vitest, `npm.cmd run build`, and browser QA.

- [ ] **Step 2: Generate the required Spanish change report, commit explicitly, and push main**

- [ ] **Step 3: Publish the complete `dist` tree plus `.nojekyll` to `gh-pages` from an isolated worktree**

- [ ] **Step 4: Verify the remote branch tree, GitHub Pages terminal build state, and public URL**
