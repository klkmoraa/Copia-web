# Edición estructural avanzada 2D — diseño

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Diseño de ejecución; conserva decisiones de esta entrega, pero el estado vigente siempre se demuestra con código, pruebas y gates.

**Baseline:** `638601cf5a669b4cc225826e7c2c1b730c4a2e2d` (`main`, `package.json` 0.8.2)

## Objetivo y límite

Move, Rotate, Mirror, Linear Array, Align y Distribute editan el `ProjectModel` 2D real con preview transitorio, entrada numérica, pointer/touch, snapping, confirmación atómica, invalidación de resultados, persistencia y un único undo. No se crea un mini-CAD, no se modifica solver/worker/Space 3D/Aula y no se repara topología automáticamente.

Rectangular Array se omite en esta entrega: aunque una grilla podría producir placements para el mismo replicador, añadir otra superficie de parámetros y su matriz de interacción/QA no es necesario para cerrar el objetivo obligatorio. No se implementan arrays polares.

## Semántica estructural

La clausura geométrica de una selección es determinista:

```text
node   → node
member → endpoints i + j
multi  → nodeIds explícitos ∪ endpoints de memberIds
```

Cada nodo se transforma una sola vez. Si un nodo pertenece también a miembros no seleccionados, esos miembros conservan `i/j` y se deforman porque siguen conectados al mismo nodo. El preview muestra todos los miembros incidentes afectados. No se despegan extremos, fusionan nodos, dividen miembros ni cambian referencias para “arreglar” el resultado.

Una transformación sólo cambia `node.x/y`. Conserva IDs, `member.i/j`, tipo, supports, hinges, releases, springs, offsets, cargas, prescribed displacements, initial effects, identidad de catálogo, orígenes y metadata. Las componentes globales de carga no se rotan ni reflejan: permanecen valores estructurales globales enlazados a sus mismos IDs.

Las copias mantienen el original, generan IDs mediante el clonador existente y remapean nodes, members, nodal/member loads, prescribed displacements e initial effects. Una selección individual de miembro se normaliza a la clausura multi para no perder dependencias de sus endpoints.

Snapping decide coordenadas, nunca conectividad. Nodos distintos pueden quedar coincidentes y siguen siendo distintos; cualquier miembro de longitud cero se rechaza antes del commit.

## Arquitectura

```text
selection
→ request semántico
→ matemática 2D pura
→ operación preparada (source + preview exactos)
→ preview local en Canvas
→ validación de frontera estructural
→ executePreparedStructuralEdit
→ un history intent + invalidación
→ persistencia existente
```

El core vive fuera de React y aporta traslación, rotación, reflexión sobre recta, placements lineales, resolución de selección, Align/Distribute, replicación y validación de referencias. Preparar clona el source, calcula una sola vez el resultado con IDs finales y congela ambos snapshots. Aplicar exige que el modelo actual sea exactamente el source preparado y publica un clon exacto del preview; si quedó obsoleto, rechaza sin mutación.

No se reutilizan `updateProjectTransient` ni las transacciones de node drag: publican `ProjectModel` durante el gesto y por tanto no satisfacen preview/cancel sin mutación. `ProjectCommand` tampoco se convierte en bus universal. Una frontera estrecha `executePreparedStructuralEdit` reutiliza el historial, invalidación y persistencia de `ProjectContext`, con la descripción semántica preparada.

## Operaciones

- **Move:** delta en unidades internas. Pointer mueve un ancla determinista de la clausura y el ancla usa el snapping existente; los campos ΔX/ΔY convierten desde unidades visibles.
- **Rotate:** centro explícito y ángulo en grados. Pointer deriva el ángulo desde el centro usando un punto snapped; 0° es un preview válido sin commit efectivo.
- **Mirror:** eje horizontal, vertical o arbitrario. `transform` y `copy` son modos separados y visibles; una recta arbitraria requiere dos puntos distintos.
- **Linear Array:** `count` incluye el original, mínimo 2; crea `count - 1` instancias en `source + k·step`, siempre desde el snapshot fuente y dentro de una sola operación/undo.
- **Align:** sólo multi-selección de nodos, mínimo 2. Usa min/max/center X/Y del modelo; center es `(min + max) / 2`.
- **Distribute:** sólo multi-selección de 3+ nodos. Ordena por eje, luego eje secundario e ID; conserva extremos y reparte uniformemente. Un span degenerado es inválido.

## UX

Las acciones viven en una surface contextual de Edit cuando existe selección estructural; no se añaden seis herramientas persistentes al rail. Al activar una operación, la surface muestra únicamente sus parámetros, ayuda corta, error, Aplicar y Cancelar. Desktop/tablet usa panel flotante; phone reutiliza el patrón de tray inferior, mantiene canvas-first y targets mínimos de 44 px.

Move, Rotate, Mirror y Array activan un gesto explícito, por lo que touch modifica el preview únicamente dentro de ese modo; fuera de él se conserva el pan táctil normal. Escape cancela sólo la edición preparada y devuelve foco al canvas. Los resultados se ocultan durante preview para no superponer geometría obsoleta.

El pointermove conserva datos transitorios en refs y publica como máximo una actualización React por animation frame. Candidatos de snap, clausura y estructuras auxiliares se memorizan por revisión de modelo, no por frame.

## Validación y pruebas

La frontera comprueba finitud, unicidad de IDs en todas las colecciones, endpoints, longitud positiva y referencias de nodes/members/load cases. La preparación rechaza selección vacía, IDs ausentes, cargas seleccionadas, parámetros no finitos, axis degenerado, count inválido y selección incompatible.

Los loops TDD cubren matemática, conservación estructural, shared nodes, IDs/remaps, stale source, preview==apply, cancel puro, undo/redo, invalidación, snapping, teclado/touch, responsive y regresiones de duplicate/copy/paste, node drag, split/delete y topology repair. QA renderizada verifica los flujos obligatorios en Chromium y WebKit, desktop/tablet/mobile y consola limpia.
