# Workspace TopBar and Repeat design

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Diseño ejecutado; conserva decisiones y evidencia de su momento, no certifica el estado actual por sí solo.

## Scope and approval

The request explicitly approves a focused visual redesign of the Workspace TopBar and Repeat, including commit, push, and GitHub Pages publication. This document records that approved scope; it does not change any solver, result, persistence, topology, or repeat-placement behavior.

## Design direction

StructureCo is a structural-analysis workspace for people who need precise controls without visual noise. The top bar becomes an instrument header: the document identity, analysis context, and utility actions each sit in their own quiet Clay surface. Spacing and separators make those groups legible before a user reads their labels.

Repeat becomes an on-canvas contextual affordance rather than a small green button. Its signature is a compact stacked capsule: a circular repeat glyph and the `R` keycap flank the primary action; after activation, a short status card carries the title, destination instruction, and a discrete cancel action. Green is restricted to border, icon, keycap, and focus-compatible semantic accents.

## Visual system

- Surface: existing `--sc-color-surface-*` Clay surfaces and current light/dark tokens.
- Text: existing display/body/mono roles; the keyboard cue remains mono.
- Layout: desktop uses separated document/context/action clusters; smaller desktop progressively reduces nonessential width; tablet and phone retain all secondary actions in the existing overflow menu.
- Motion: one 160–220 ms entrance/exit for Repeat and existing top-bar control transitions. `prefers-reduced-motion` removes transforms and timing.
- Accessibility: retain existing labels, keyboard paths, focus rings, live status, `R` shortcut, and button semantics. Add labelled visual subparts without duplicating status announcements.

## Files and boundaries

- `src/features/topbar/TopBar.tsx` — semantic grouping only, no command behavior changes.
- `src/features/canvas/RepeatActionOverlay.tsx` — presentational repeat control/status composition.
- `src/features/canvas/StructuralCanvas.tsx` — delegates existing repeat callbacks and state to the overlay.
- `src/features/workspace/phase1.css` and `src/styles.css` — scoped visual treatment and responsive/reduced-motion rules.
- Related component tests — protect grouping, keyboard labels, activation/cancel callbacks, and live status semantics.

## Acceptance checks

The delivered UI must visibly differ in screenshots, preserve current TopBar actions and Repeat logic, retain responsive access at desktop/tablet/phone widths, have no horizontal overlap, and pass related tests, protected-boundary validation, build, and browser QA before publication.
