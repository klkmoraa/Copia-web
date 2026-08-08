# App Shell specification — Phase 6

## Scope

`AppShellLayout` is a presentation-only composition boundary. It arranges the existing TopBar, ToolRail, canvas/results stage, inspector, mobile backdrop/action, and professional note. It does not read or mutate the structural project, analysis, history, selection, geometry, or persistence owned by `ProjectContext`.

## Ownership and adapters

| Surface | Source of truth | Shell adapter |
| --- | --- | --- |
| Document, units, language, mode, undo/redo, export, analysis | `ProjectContext` through `TopBar` | Slot only; existing handlers are passed through unchanged |
| Model and canvas interactions | `StructuralCanvas` | Rendered in the `workspace` slot |
| Results | `ResultsPanel` | Shares the center-stage slot; visibility changes are CSS-only |
| Selection and properties | `Inspector` | Rendered in the inspector slot; mobile modal behavior remains in `WorkspaceShell` |
| Layers | `editorLayerReducer` | Still owned by `WorkspaceShell`; not duplicated by the shell |
| Layout preferences | `useWorkspaceLayoutPreferences` | Versioned visual-only local storage record |

`App.tsx` remains the welcome/workspace router and lazy-load boundary. `WorkspaceShell` remains the only composition adapter between application state and visual slots.

## Layout states

- Standard: ToolRail, center stage, and inspector are visible.
- Inspector collapsed: desktop grid removes only the inspector column.
- Full canvas: ToolRail, results, inspector, and floating inspector control are visually hidden while the TopBar remains available to restore the layout.
- Mobile/tablet: the existing dock and inspector sheet continue to own responsive interaction. Full canvas remains reversible from the TopBar overflow menu.

Preferences are validated as booleans and failures to read or write storage are ignored. They never enter the project file, undo stack, analysis payload, or import/export formats.

## Accessibility and overflow contract

- A keyboard skip link targets `#workspace-canvas`.
- The main canvas region is programmatically focusable.
- Layout commands live in a labeled group inside the existing secondary-actions dialog.
- Shell columns use `minmax(0, 1fr)` and each scroll owner remains unchanged, preventing nested page scroll traps.
- Breakpoints follow the approved system: expanded desktop at 1440+, compact desktop/tablet landscape from 1024–1439, and mobile/tablet sheet/dock behavior below 1024.

## Rollback boundary

Removing `AppShellLayout` and rendering the injected slots in their previous order restores the former DOM composition. No domain or engine migration is required.

