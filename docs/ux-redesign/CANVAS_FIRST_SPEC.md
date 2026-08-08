# Canvas-first specification — Phase 7

## Boundaries

- `ToolRail` is the named editor-tool boundary. `ToolBar` remains a compatibility export and owns the existing registry, IDs, shortcuts, mobile sheets, and selection command.
- `CanvasChrome` renders mode guidance, layer access, SNAP/GRID state, camera controls, coordinates, and scale. Camera state and every callback remain owned by `StructuralCanvas`.
- `CanvasLayers` renders presentation switches through the component library. The model layer is fixed on and all other choices are independent of project, solver, history, and export state.
- `canvasChromeGeometry` contains only safe-zone and fit-camera math. It is the unchanged helper previously named `canvasChrome`; the explicit name avoids a Windows filename collision with the component.

No tool handler, project command, structural geometry, topology operation, analysis algorithm, worker, or domain type moved into these presentation components.

## ToolRail contract

- The registry remains the single source for the 12 tools, five intent groups, labels, shortcuts, mobile placement, classroom visibility, and destructive state.
- Expanded desktop exposes icon, full label, and shortcut. Compact desktop exposes the same buttons and accessible names in a 76 px rail.
- Below 1440 px the approved responsive compact rail remains automatic. Below 1024 px the six-item ToolDock and the portaled Load/More sheets remain authoritative.
- Tool tones map to existing semantic tokens; blue remains reserved for selection/focus and no historical tool color is replaced by active state.

## CanvasChrome and safe areas

- Top-left: active mode and gesture/placement guidance.
- Top-right: SNAP, GRID, and layers.
- Bottom-right: zoom in, zoom out, and fit.
- Bottom-center: live coordinates and scale.
- Safe rectangles continue to be calculated by `canvasSafeInsetsFor` and are consumed by fit-camera and label layout.

All chrome commands delegate upstream. The extraction introduces no alternate camera state and no duplicate global action.

## Layers and persistence

The eight layers are Model, Loads, Dimensions/axes, IDs, Results, Labels, Help, and Diagnostics. Preferences use the versioned key `structureco:editor-layers:v1`, validate every boolean, force Model to `true`, and fail closed to approved defaults. They are never stored in a project or included in undo/redo, imports, exports, or analysis payloads.

## Input parity

Mouse wheel zoom, middle-button/Space pan, keyboard shortcuts, selection windows, touch pan/pinch/long-press, and stylus selection continue through the existing `StructuralCanvas` event pipeline. Component extraction changes only rendered controls and their callbacks.

