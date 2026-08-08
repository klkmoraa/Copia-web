# Claymorphism ciclo 2 — tarea 7: inspector raised con datos densos flat

**Fecha:** 2026-08-07 14:48
**Agente:** Codex
**Rama:** main
**Base:** `ebd87ec`

## Qué cambió

El panel del inspector y su resumen de selección consumen ahora el material `raised` eager de `material.css`. Los campos y contenedores densos del inspector consumen un único material `flat`: `.selection-card`, `.number-control`, `.select-field select`, `.effect-card`, `.combination-card`, `.norm-source`, `.compact-toggle-grid label`, `.inspector-note` y `.load-tool-grid button`.

La geometría responsive del panel queda desacoplada del shorthand compartido mediante `--inspector-clay-border-width`. El hook previo del rail también salió del bloque `raised` común y quedó en una regla exclusiva de `.toolbar`. `styles.css` conserva radios, posición, clip-path, safe areas, handle, tabs, foco, error, disabled, selected/active y demás comportamiento, pero ya no repite la materia de los contenedores migrados.

`qa.mjs` selecciona un miembro por su ruta real de teclado y mide la cascada compilada en Chromium: panel y summary raised, control numérico flat con fondo y borde tokenizados, y bottom sheet móvil con anchos `1px 1px 0px 1px`.

## Por qué

El inspector mezclaba paneles elevados con datos técnicos densos y repetía fondos, bordes y sombras en reglas dispersas. Centralizar la materia mantiene la jerarquía clay del ciclo 2 sin dar volumen a cada campo y evita que el shorthand eager destruya los cantos responsive del panel.

## Archivos tocados

- `qa.mjs` — añade y conecta los contratos desktop/mobile del material del inspector.
- `src/design-system/material.css` — incorpora los grupos raised/flat y separa los hooks locales de borde del toolbar y del inspector.
- `src/styles.css` — elimina materia duplicada, conserva estados y reemplaza las geometrías de borde por `--inspector-clay-border-width`.
- `reports/2026-08-07-1430-claymorphism-ciclo2-task7.md` — reporte rastreado de la tarea.
- `.superpowers/sdd/2026-08-07-claymorphism-ciclo2/task-7-report.md` — evidencia SDD ignorada.

## Cómo verificar

- Guardián inicial: `main@ebd87ec4e95b`, `structureco@0.8.2`; respaldo externo en `%TEMP%/structureco-task7-ebd87ec-20260807-143330`; 63 archivos protegidos inventariados; `capturas.mjs` registrado con SHA-256 `1F2CDE477FA77BC74A16C1848F544E8C7E5435FFCF0E7A4D12D644EEA774A710`.
- RED check-only: con CSS intacto, `npm.cmd run build` pasó. Tras corregir el accionamiento del `<g>` SVG a `focus + Enter`, `node qa.mjs` falló los tres contratos raised ausentes: `inspectorDesktopPanelHasRaisedClayMaterial`, `inspectorDesktopSummaryHasRaisedClayMaterial` e `inspectorMobilePanelHasRaisedClayMaterial`. El control numérico ya coincidía visualmente con flat en la base.
- GREEN final restaurado: `npm.cmd run build` pasó; `node qa.mjs` pasó completo, incluidas las cinco claves T7, con `console: []`, `pageErrors: []` y sin overflow horizontal.
- Mutación A: mover temporalmente `.number-control` de flat a raised hizo fallar `inspectorDesktopNumberControlHasFlatMaterial`.
- Mutación B: invalidar temporalmente el valor phone de `--inspector-clay-border-width` hizo fallar `inspectorMobilePanelHasTopOnlyClayEdge`. Se usó `initial` porque una eliminación literal heredaría el mismo valor desde la regla temprana `max-width:1023px` y no alteraría la cascada computada.
- Restauración byte a byte: `material.css` volvió a `528E5D6A149B61C2884A55F3A80A9335B2DF39BFA7BF481C0FBA559592927C80` y `styles.css` a `4FB9621AA3CC470399D8907DE9874DFD3AC50F29E1DA81BD1915F1AA93AF579C`.
- Tokens focused: `npx.cmd vitest run src/design-system/tokens.test.ts` pasó 1 archivo y 22/22 pruebas. La búsqueda de hooks locales `--sc-toolbar/inspector-clay-border-width` terminó sin coincidencias.
- Cierre del guardián: 63/63 hashes protegidos intactos, `capturas.mjs` con el mismo SHA-256 inicial y `git diff --check` limpio.

## Pendiente / siguiente paso

No hay bloqueo de implementación. La carrera heredada de `:active` de welcome apareció en RED, GREEN intermedio y mutaciones; no se modificó y el QA final restaurado pasó. El controlador conserva la revisión independiente y la matriz visual Day/Night y responsive descrita en el brief.

Por alcance no se abrió dev server ni navegador visual, no se ejecutó WebKit ni suite completa, no se tocaron TSX, dependencias, rutas protegidas o `capturas.mjs`, y no se hizo push.

## Revisión Important — corrección sobre `9e35c96707039d1397dae25c591580ca87795e1c`

**Fecha:** 2026-08-07 15:23

### Correcciones

- El contrato fuerte de `.inspector-summary` raised se aplica también al estado vacío real. De `.inspector-summary.is-empty` se retiraron únicamente `background` y `box-shadow`; se preservaron el contenido y `.inspector-summary.is-empty::before { background:var(--subtle); }`.
- `qa.mjs` separa materia y geometría. Raised exige gradiente, al menos un canto solid no nulo, dos o más sombras inset y ausencia de `backdrop-filter`; la geometría se certifica aparte con `1536: 1px 1px 1px 1px`, `430: 1px 1px 0px 1px`, `900x1024: 0px 0px 0px 1px` y `844x390: 0px 0px 0px 1px`.
- Tablet y paisaje usan páginas aisladas y abren selección/inspector por el flujo real. El summary vacío se mide antes de seleccionar; el seleccionado se vuelve a medir después.
- Se certifican por claves nominales las nueve familias flat. `number-control` y `select-field select` se midieron en DOM real; `selection-card`, `effect-card`, `combination-card`, `norm-source`, `compact-toggle-grid label`, `inspector-note` y `load-tool-grid button` usaron probes temporales dentro del inspector, eliminados en `finally` y confirmados ausentes al terminar.
- Se auditaron las reglas del inspector en `styles.css`: no cambió ningún estado, radio, posición, `clip-path`, safe area, tab, foco, error, disabled, selected/active, geometry ni behavior fuera de retirar la materia local que contradecía raised.

### Evidencia TDD y mutaciones

- RED con checks nuevos y CSS intacto: build PASS; QA FAIL únicamente en `inspectorDesktopEmptySummaryHasRaisedClayMaterial`.
- GREEN tras retirar la materia local de `.is-empty`: build PASS y QA PASS completo.
- Mutación A, reponer `background` y `box-shadow` en `.inspector-summary.is-empty`: FAIL nominal `inspectorDesktopEmptySummaryHasRaisedClayMaterial`.
- Mutación B, cambiar temporalmente el hook tablet a `1px 1px 0`: tras reconstruir, FAIL nominal de `inspectorTabletPanelHasLeftOnlyClayGeometry` y `inspectorLandscapePanelHasLeftOnlyClayGeometry`. La primera corrida se descartó porque aún consumía el build de la mutación A; la repetición reconstruida ejercitó el CSS correcto. También fluctuó el check heredado `welcomeimportCardActiveTransformIsPressedTranslate`, fuera de este alcance.
- Mutación C, retirar `.norm-source` del grupo flat: FAIL únicamente en `inspectorDesktopFlatNormSourceHasFlatMaterial`.
- Restauración byte a byte: `src/design-system/material.css` = `528E5D6A149B61C2884A55F3A80A9335B2DF39BFA7BF481C0FBA559592927C80`; `src/styles.css` = `B451333A34F53201BB3ED4762369F79C2B364C5AB3E75CD433313094A468CD44`.

### Gates finales de la revisión

- `node --check qa.mjs`: PASS.
- `npx.cmd vitest run src/design-system/tokens.test.ts`: PASS, 1 archivo y 22/22 pruebas.
- `npm.cmd run build`: PASS.
- `node qa.mjs`: PASS completo; las cuatro geometrías, ambos summaries y las nueve familias flat están en `true`; `console: []`, `pageErrors: []` y probes retirados.
- Guardián final: `git diff --check` PASS; 63/63 hashes protegidos intactos; `capturas.mjs` conservó SHA-256 `1F2CDE477FA77BC74A16C1848F544E8C7E5435FFCF0E7A4D12D644EEA774A710`; el diff rastreado se limita a `qa.mjs`, `src/styles.css` y este reporte.
- Alcance negativo: sin dev server, navegador visual, WebKit, suite completa, TSX, dependencias, `capturas.mjs`, rutas protegidas ni push.

## Cierre del controlador y revisión independiente

**Fecha:** 2026-08-07 15:39

- Revisión independiente inicial sobre `ebd87ec..9e35c96`: tres Important detectados (summary vacío fuera de raised, geometrías responsive incompletas y cobertura flat parcial). Corrección en `a03df6e`.
- Re-revisión independiente sobre `9e35c96..a03df6e`: **APPROVED**, sin Critical ni Important. Queda como Minor heredado que `.number-control` es un selector flat global y también alcanza Influence Line; T7 no amplió ese acoplamiento ni cambió su resultado computado.
- Matriz visual Chromium real: PASS en Day/Night para `1536x960`, `1366x768`, `900x1024`, `390x844` y `844x390` (10 combinaciones). Panel y summary conservaron jerarquía raised; los tres campos numéricos visibles permanecieron flat; no hubo overflow horizontal, errores de consola ni `pageerror`. Evidencia local ignorada: `.superpowers/sdd/2026-08-07-claymorphism-ciclo2/task-7-*-full.png`, `task-7-*-panel.png` y `task-7-visual-results.json`.
- Geometrías computadas confirmadas: desktop `1px 1px 1px 1px`; tablet y paisaje corto `0px 0px 0px 1px`; teléfono `1px 1px 0px 1px`.
- Gates frescos del controlador: lint PASS; `verify:protected` PASS (29/29); Vitest completo PASS (97 archivos, 738/738) en ejecución serial después de cerrar el servidor visual; typecheck PASS; build PASS; `verify:perf` PASS con `662430` bytes / `178309` gzip frente a techos `670000` / `179500`; `node qa.mjs` PASS completo con todas las claves T7 en `true`, `console: []` y `pageErrors: []`.
- Una primera corrida Vitest bajo saturación del host falló exclusivamente por timeouts/microbenchmarks; App y Results pasaron después en aislamiento, el microbenchmark pasó al repetirlo aislado y la suite serial completa cerró verde. No se modificaron tests, límites ni motor para ocultar esa condición ambiental.
- WebKit queda reservado al barrido global de T9/T10 conforme al plan. No se hizo push.