# StructureCo Clay Identity Foundations — Phase 1 Implementation Plan

**Clasificación:** `AUDIT/TEMPORARY`

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Apply `superpowers:test-driven-development` to every behavioral or contract change and `superpowers:verification-before-completion` before the phase commit.

**Execution status:** Completed and published on `codex/clay-identity-redesign`; all listed gates passed. Draft review: `https://github.com/klkmoraa/structureco/pull/5`.

**Goal:** Replace the current visual foundations with the approved pronounced matte Clay identity while leaving every structural, persistence, command and solver contract untouched.

**Architecture:** Evolve the existing `src/design-system/**` authority instead of adding a parallel theme. Semantic tokens remain the single source for both themes; Day and Night change only neutral grounds/materials, while technical colors remain invariant. The development-only Component Lab is the visual acceptance surface; production feature migration starts in Phase 2.

**Tech Stack:** React 19, TypeScript 6, CSS custom properties, Vitest, Testing Library, Vite, Playwright.

## Global Constraints

- Work only in the isolated GitHub checkout and branch `codex/clay-identity-redesign`; do not touch the user's existing Structure folder.
- Do not modify `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts`, `src/commands/**`, persistence, import/export or Space 3D domain code.
- Do not update npm dependencies or the protected files in `brand/**`.
- Day background stays warm ivory; Night stays deep functional graphite.
- Technical colors use one declaration shared by Day and Night.
- Matte pronounced Clay uses visible raised, inset, floating, sheet and modal planes; no glassmorphism, backdrop blur, decorative glow or glossy sheen.
- Normal motion is visible and physical. `prefers-reduced-motion: reduce` removes translation, scale and duration while retaining state and material depth.
- All new copy is bilingual; engineering terminology, units, signs and calculated labels are unchanged.
- Do not push or merge without explicit user authorization.

---

### Task 1: Lock the new foundation contracts with failing tests

**Files:**
- Modify: `src/design-system/tokens.test.ts`
- Modify: `src/design-system/clayReconciliation.test.ts`
- Modify: `src/design-system/material.test.ts`
- Create: `src/design-system/typography.test.ts`

**Interfaces:**
- Produces semantic tokens `--sc-color-load-point`, `--sc-color-load-distributed`, `--sc-color-load-moment-applied`, `--sc-shadow-clay-inset`, and the existing `--sc-clay-press-transform` with approved values.
- Produces typography contracts for `DM Serif Display`, `Manrope`, and `JetBrains Mono` with local WOFF2 sources.

- [x] Add tests asserting point `#3a72e3`, distributed `#468c09`, and applied moment `#d9720a`, with no dark-theme redeclarations.
- [x] Add tests asserting general load/tool aliases resolve to the appropriate type token while result Moment remains `#ed4b46`.
- [x] Add tests asserting static inset material uses `--sc-shadow-clay-inset`, pressed material uses `--sc-shadow-clay-pressed`, and both contain only inset shadow layers.
- [x] Replace the old glow/gradient-presence assertion with a contract that decorative glow tokens resolve to `0 0 transparent` and presentation gradients resolve to solid matte values or `none`.
- [x] Add typography tests asserting all three approved families, local files, `font-display: swap`, and absence of IBM Plex in active font declarations.
- [x] Add a press contract for `translateY(2px) scale(0.98)` and a reduced-motion override of `none` plus `0.001ms` durations.
- [x] Run `npm.cmd test -- src/design-system/tokens.test.ts src/design-system/clayReconciliation.test.ts src/design-system/material.test.ts src/design-system/typography.test.ts` and confirm failures are caused by missing new contracts.

### Task 2: Install the self-hosted typography without dependencies

**Files:**
- Modify: `src/design-system/fonts.css`
- Modify: `src/design-system/tokens.css`
- Create: `public/fonts/dm-serif-display-latin-400.woff2`
- Create: `public/fonts/manrope-latin-variable.woff2`
- Create: `public/fonts/jetbrains-mono-latin-variable.woff2`
- Create: `public/fonts/jetbrains-mono-greek-variable.woff2`
- Create: `public/fonts/OFL-DM-Serif-Display.txt`
- Create: `public/fonts/OFL-Manrope.txt`
- Create: `public/fonts/OFL-JetBrains-Mono.txt`
- Delete: `public/fonts/ibm-plex-sans-400.woff2`
- Delete: `public/fonts/ibm-plex-sans-500.woff2`
- Delete: `public/fonts/ibm-plex-sans-600.woff2`
- Delete: `public/fonts/ibm-plex-sans-700.woff2`
- Delete: `public/fonts/ibm-plex-mono-400.woff2`
- Delete: `public/fonts/ibm-plex-mono-500.woff2`

**Interfaces:**
- `--sc-font-display`: `"DM Serif Display", Georgia, serif`.
- `--sc-font-ui`: `"Manrope", ui-sans-serif, system-ui, sans-serif`.
- `--sc-font-mono`: `"JetBrains Mono", ui-monospace, "Cascadia Mono", monospace`.

- [x] Download the four WOFF2 files from the exact `fonts.gstatic.com` URLs returned by the official Google Fonts CSS endpoint: DM Serif Display latin `https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFnOHM81r4j6k0gjAW3mujVU2B2G_Bx0g.woff2`, Manrope latin `https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2`, JetBrains Mono latin `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD7OwE.woff2`, and JetBrains Mono greek `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD4OwG_TA.woff2`.
- [x] Download the OFL texts from `https://raw.githubusercontent.com/google/fonts/main/ofl/dmserifdisplay/OFL.txt`, `https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt`, and `https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/OFL.txt`; record source URLs and SHA-256 hashes in the phase report.
- [x] Declare local `@font-face` rules with the actual supported weight ranges and `font-display: swap`.
- [x] Remove the six superseded IBM Plex webfont files after a failing test proves the legacy bundle is still present.
- [x] Map editorial/display, UI and technical data roles to their approved families without changing engineering content.
- [x] Run `npm.cmd test -- src/design-system/typography.test.ts src/design-system/tokens.test.ts` and confirm green.

### Task 3: Implement matte pronounced Clay and load roles

**Files:**
- Modify: `src/design-system/tokens.css`
- Modify: `src/design-system/material.css`
- Modify: `src/design-system/components/ui.css`

**Interfaces:**
- `--sc-shadow-clay-inset` is the static cavity material.
- `--sc-shadow-clay-pressed` is the transient pressed material.
- Technical result roles remain independent from applied-load roles.

- [x] Define invariant load-type colors and compatibility aliases.
- [x] Give inset wells a stable cavity shadow and pressed controls the deeper transient cavity plus the approved press transform.
- [x] Preserve one upper-left light source, 1px physical edges, and the existing blur-not-greater-than-radius rule.
- [x] Neutralize decorative glow and glossy presentation gradients without removing technical data fills or grid/diagram patterns.
- [x] Keep technical grids, numeric cells and result tables flat inside their parent plane.
- [x] Run the three foundation contract suites and confirm green.

### Task 4: Turn Component Lab into the Phase 1 acceptance surface

**Files:**
- Modify: `src/design-system/lab/ComponentLab.tsx`
- Modify: `src/design-system/lab/componentLab.css`
- Create: `src/design-system/lab/ComponentLab.foundations.test.tsx`

**Interfaces:**
- Development URL remains `/__components`.
- Lab exposes named regions for typography, load roles, material depth, pressed motion and reduced-motion notes.

- [x] Write a failing Testing Library test for the three typography roles, three load types, six material planes and explicit reduced-motion explanation.
- [x] Add the minimum bilingual lab content needed by that contract.
- [x] Render raised cards, static wells, pressed controls and overlapping planes using real design-system components/tokens, not local shadow literals.
- [x] Add technical swatches for `P`, `q`, `Mₐ`, `N`, `V`, `M`, deformation and Aula so action/response distinctions are visible.
- [x] Keep all targets at least 44×44 CSS px and all interactive states keyboard reachable.
- [x] Run the lab and design-system tests and confirm green.

### Task 5: Verify the isolated foundation phase

**Files:**
- Create under `reports/evidence/2026-08-21-clay-foundations/`: Day/Night screenshots for desktop, tablet and mobile Component Lab.

- [x] Run `npm.cmd run lint`.
- [x] Run `npm.cmd run typecheck`.
- [x] Run focused design-system tests with one worker.
- [x] Run `npm.cmd run build`.
- [x] Run `npm.cmd run verify:protected` and confirm all 38 protected files remain intact.
- [x] Launch the dev-only Component Lab and capture Day/Night at 1440×900, 1024×768 and 390×844.
- [x] Visually inspect typography, load colors, raised/inset/pressed depth, overlap, focus and reduced-motion behavior against the mandatory attachments.
- [x] Confirm `git diff --name-only` contains no protected-domain or brand files.

### Task 6: Report and create the local phase commit

**Files:**
- Create: `reports/2026-08-21-1554-clay-foundations-phase-1.md`

- [x] Record the GitHub base SHA, backup bundle, font provenance/hashes, exact changed files, screenshots, commands and any remaining visual gaps.
- [x] Stage only explicit Phase 1 paths and evidence; preserve every unrelated file.
- [x] Commit with message `feat(design-system): establish pronounced clay foundations` and include the report path in the commit body.
- [x] Show final branch status and commit SHA.
- [x] Stop before push and request explicit authorization.
