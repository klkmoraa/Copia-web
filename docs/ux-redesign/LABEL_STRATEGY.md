# Canvas label strategy

Labels are presentation-only SVG overlays produced by `layoutSmartLabels` after geometry has been projected to screen coordinates.

## Priority

| Priority | Content | Behavior |
| --- | --- | --- |
| P0 | Current selection | Always visible; first placement claim |
| P1 | Essential node/load/reaction information | Visible at every scale |
| P2 | Member IDs, dimensions, extrema | Visible from standard detail; selected and critical extrema can force visibility |
| P3 | Secondary endpoints and diagram detail | Visible only at detailed zoom and yields first in dense areas |

## Placement rules

1. Filter by scale unless `forceVisible` is set.
2. Sort deterministically by priority and stable ID.
3. Try the preferred quadrant, mirrored quadrants, then expanding radial positions.
4. Keep every rectangle inside the current chrome-safe canvas rectangle.
5. Drop only non-critical P2/P3 labels when no collision-free position exists.
6. Draw a leader when a label moves materially away from its preferred anchor.

Detail thresholds are essential below 52 px/unit, standard from 52–89, and detailed at 90+. Critical diagram maxima/minima are forced visible when their results layer is relevant. Unit tests cover determinism, collision avoidance, saturation, leader creation, zoom thresholds, and forced critical values.

