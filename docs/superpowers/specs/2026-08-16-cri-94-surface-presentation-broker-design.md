# CRI-94 · Broker de presentación y continuidad

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Contrato de la entrega CRI-94; conserva decisiones y evidencia de su momento, no certifica el estado actual por sí solo.

## Contrato

CRI-94 introduce una única autoridad de presentación para las superficies que hoy coordina `WorkspaceShell`. La fuente principal es la issue CRI-94 en Linear; las decisiones de CRI-12 se leyeron desde el snapshot Git `3d5c807` porque `reports/cri-12/**` no está presente en el árbol de `main` `e59051b`.

No se rediseña contenido, no se implementa CRI-90, no se parte Inspector ni Results por owner y no se implementa el comportamiento de `peek` de CRI-102. Solver, modelo, schema, persistencia, workers y formatos quedan intactos.

## Tabla declarativa única

El bridge actual cubre las cinco superficies que hoy tienen autoridad de apertura o presentación repartida entre `WorkspaceShell` y sus hijos. CRI-100 sustituirá en el futuro la fila puente `results` por sus owners definitivos; CRI-94 no adelanta esa separación.

| shellClass | inspector | results | datasheet | doctor | palette |
|---|---|---|---|---|---|
| `X2` | `dock` | `dock` | `drawer` | `drawer` | `overlay` |
| `M1` | `inset` | `inset` | `drawer` | `drawer` | `overlay` |
| `K0` | `sheet` | `sheet` | `fullscreen` | `fullscreen` | `sheet` |

Sólo esta tabla asigna `band | dock | inset | sheet | drawer | fullscreen | overlay | floating`. Los componentes reciben la presentación resuelta; nunca leen ancho o clase para escogerla.

## Estado y resolución

`SurfacePresentationProvider` vive separado de `WorkspaceUIContext`. Su reducer conserva únicamente intención lógica, orden de activación y estado `default | peek`; la presentación se deriva de la tabla y de `shellClass` en cada render.

- Abrir mueve la superficie al final del orden de activación.
- Cerrar elimina su intención y permite reanudar la última superficie suspendida.
- En `K0`, sólo la última capa contextual queda activa; las demás permanecen montadas como `suspended`.
- En cualquier clase, sólo una presentación `drawer` o `fullscreen` queda activa.
- Cambiar `shellClass` no modifica intención lógica, selección, evidencia, cámara ni draft.
- `peek` existe en el tipo de estado, pero sólo es válido para `drawer` o `fullscreen`; ninguna UI de `peek` se añade en este slice.

La apertura inicial conserva el comportamiento vigente: Results está disponible y el Inspector se inicializa desde la preferencia persistida. Desde ese momento el broker es la fuente runtime; la preferencia sólo se actualiza como persistencia de la intención explícita del usuario.

## Continuidad de borradores

No se crea `DraftLifecycle` global en CRI-94. La suspensión conserva montadas las instancias reales:

- Inspector: `InspectorNumericField` mantiene `text`, `dirty` y `error`.
- Datasheet: `draft`, `editing`, `paste` y `draftSource` permanecen en `DatasheetPanel`.
- Doctor: el preview de reparación y su snapshot permanecen en `ModelDoctor`.
- Edición estructural: `StructuralCanvas` no se desmonta; sus drafts y refs siguen siendo los existentes.

Cerrar explícitamente conserva la semántica actual de cada superficie. Suspender no equivale a cerrar y no dispara commit/cancel.

## Foco, modal e inert

El broker absorbe los refs de retorno de Inspector, Results, Datasheet, Doctor y Palette. Registra el disparador al abrir, devuelve foco sólo al cierre lógico y conserva una clave semántica del elemento enfocado para recomposición.

`modalFocus.ts` queda como implementación común del trap. `drawer` y `fullscreen` usan ese trap y el broker marca el fondo del shell `inert` + `aria-hidden` cuando el chunk confirma que la superficie ya está montada. `dock`, `inset`, `sheet`, `overlay`, `floating` y `band` no vuelven inerte el fondo. La limpieza restaura exactamente el estado previo y se ejecuta al cerrar, suspender o desmontar.

Para lazy loading, la intención se registra antes de cargar el chunk. El fondo permanece operativo hasta `surfaceReady`; no se añade loading global.

## Cámara e input

La cámara continúa siendo el único estado local de `StructuralCanvas`. `cameraForViewportResize` conserva el punto de modelo situado en el centro visual; no se guarda/restaura un offset paralelo. `ShellCompositionProvider` sigue siendo el único dueño de histéresis/debounce y no escucha `visualViewport`, por lo que teclado virtual e input mouse/touch/pen no cambian clase ni presentación.

## Pruebas y evidencia

TDD cubrirá tabla, exclusión/suspensión, migración X2↔M1↔K0, `peek`, lazy intent, selección/evidence, draft real, foco equivalente, retorno de foco, `inert`/`aria-hidden`, teclado virtual, cámara por ancla y ausencia de escrituras de modelo. La QA renderizada demostrará los casos A–G y reutilizará/adaptará `qa:model-doctor` sin rebajar sus aserciones.

## Autorrevisión de alcance

La especificación no contiene placeholders, no introduce materia `SHEET`/`MODAL`, no cambia paleta/radios/Clay, no separa owners futuros y no toca rutas protegidas. La fila `results` es un bridge deliberado para el panel actual, no la implementación de CRI-100.
