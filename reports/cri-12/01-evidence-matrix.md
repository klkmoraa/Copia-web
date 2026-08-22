# CRI-12A · Matriz de evidencia

**Clasificación:** `AUDIT/TEMPORARY`

Clasificación por tema según la jerarquía de `docs/README.md` y las etiquetas del encargo: `VERIFIED`, `PRODUCT_DECISION_ALREADY_CLOSED`, `PROTOTYPE_VALIDATED`, `EXPERIMENTAL`, `UNKNOWN`, `MUST_DECIDE_IN_12B`, `MUST_DECIDE_IN_12C`. Un tema puede llevar más de una etiqueta cuando arquitectura, implementación y validación de prototipo están en estados distintos — eso es información, no ambigüedad. Los ítems `MUST_DECIDE_*` se listan en detalle, con la pregunta exacta, en `HANDOFF.md`.

Nota de corrección: `VERIFIED_CURRENT` marca un hecho verificable del estado vigente de `main` (qué está implementado hoy) sin que eso implique que la decisión de producto detrás quede cerrada para siempre — se usa específicamente para identidad de color, donde CRI-12A verifica el estado actual pero no puede convertirlo en algo que CRI-12C no pueda revisar.

---

### 1. Adaptive shell (Expanded/Medium/Compact)

- **PRODUCT_DECISION_ALREADY_CLOSED** — arquitectura de clases X2/M1/K0 como salida de un presupuesto de canvas (CB-1..6), no de breakpoints de ancho. CRI-9 D-01/D-04/D-05 (`cri-9-decision-register.csv`, filas 2/5/6); frontera Medium calculada en 1042–1130px según altura. CRI-10 cierra la "vestimenta" de las tres clases (Cinta/riel/zócalo por clase) sin reabrir la arquitectura (`2026-08-16-0100-cri-10-cierre.md` §3).
- **GAP de implementación** (no es decisión abierta, es ejecución pendiente): en producción sólo existe un booleano `toolRailCompact` (`src/features/workspace/AppShellLayout.tsx:15,37,47`, `useWorkspaceLayoutPreferences.ts:10,36,48`), no una máquina de estados resolver-driven. `tokens.css:556-560` tiene tokens de densidad por tier pero ningún hook de `matchMedia` los conecta a un shell de tres clases.
- El defecto original F-01 de CRI-7 (tier Medium 1024–1439px como código muerto, tres `--toolbar-w` contradictorios) está **arquitectónicamente resuelto en el papel**, no en `src/**`.

### 2. Canvas-first

- **VERIFIED + PRODUCT_DECISION_ALREADY_CLOSED**. `App.tsx:20` (`AppScreen`), `WorkspaceShell.tsx` compone `StructuralCanvas` como superficie central; `styles.css:592` `.structural-canvas { touch-action:none }`. Regla constitutiva confirmada en CRI-9 (tabla comparativa, línea 178) y cerrada en CRI-10 (`2026-08-16-0100-cri-10-cierre.md` §3, presupuesto CB-1..6 verificado en 11 viewports). Protegido — ver invariantes en `01b-inherited-decisions.md`.

### 3. Selection/precision

- **VERIFIED** (mecanismo base): `Selection` es unión discriminada por `id`/`nodeIds`/`memberIds` string (`src/types.ts:657-663`), nunca derivada de floats.
- **PRODUCT_DECISION_ALREADY_CLOSED** — contrato de 5 fases (candidatos→preview→elegir/ciclar→confirmar→cancelar), D-06 (`cri-9-decision-register.csv` fila 7; `StructuralCanvas.tsx:1238-1244,1245-1283,1395-1399,954-978`).
- **PROTOTYPE_VALIDATED** — marquee táctil por *long-press* (>480ms, distinto de pan) y ciclado por teclado (ArrowUp/Down/Home/End) del picker de candidatos, cerrando la 5ª fase del contrato D-06; validado en `d2a4dbfa20` fase C (`reports/2026-08-16-cri-11-fase-c-validacion.md` §1.1-1.2). Ninguna de las dos vive en `src/**`.

### 4. Contextual actions

- **PRODUCT_DECISION_ALREADY_CLOSED** — nueva superficie `contextual-actions`, D-07 (`cri-9-decision-register.csv` fila 8): cierra la brecha de paridad táctil (5 tareas) vía esta superficie + un sub-modo de marco de selección + affordance de pegar por portapapeles.
- **VERIFIED parcial** — hoy existe `StructuralEditOverlay.tsx` / `ToolBar.tsx` ligados a selección en el canvas, pero no la superficie formal `contextual-actions` que D-07 describe.
- El "hueco de paridad funcional" original (corrección D-07 de CRI-8, commit `cc586d5`) tiene arquitectura decidida pero **no implementada**: `SEL-02` (resolución de solape), `SEL-03` (box-select), `MOD-13` (copiar/pegar/duplicar), `DAT-06` (pegar bloque), `MOD-12` (Repeat) siguen sin ruta táctil verificada en `src/**`.

### 5. Inspector/Detail

- **VERIFIED** — `src/features/inspector/Inspector.tsx` y familia (`InspectorProperties`, `InspectorNumericField`, `MaterialPresetSelector`, `SectionViewer2D`, etc.), con pruebas dedicadas.
- **PRODUCT_DECISION_ALREADY_CLOSED** — D-02 (`cri-9-decision-register.csv` fila 3): split en `detail`/`analysis-setup`/`view` por dueño, contextual a selección en las tres clases (`Inspector.tsx:86-95` referenciado en CRI-9). No implementado como split en producción hoy (Inspector es un panel único).

### 6. Results

- **VERIFIED** — `src/features/results/ResultsPanel.tsx` es proyección pura (no muta modelo, no recalcula solver — confirmado en `reports/2026-08-12-cri-19-cri-21-architecture-command-audit.md:52`).
- **PRODUCT_DECISION_ALREADY_CLOSED** — D-03 (descomposición en `topbar`/`view`/`detail`/`dense`, ninguna superficie de resultados residente en ninguna clase — presupuesto derivado, no preferencia).
- **UNKNOWN, no bloqueante** — U-14 (compatibilidad con Aula si su dirección de producto reabre) sigue abierto pero explícitamente diferido: "no es tarea de CRI-11" ni de CRI-12 (ver Aula, tema 21).

### 7. Datasheet

- **VERIFIED** — feature completa en `src/features/datasheet/**` (24 archivos + pruebas), contrato canónico en `docs/architecture/structureco-datasheet.md` (`CANONICAL`): rejilla propia sin historial propio, escritura vía `updateProject` una vez por aplicar, no repara topología (delega a Model Doctor).
- **PRODUCT_DECISION_ALREADY_CLOSED** — D-11 (modal + coordinado vía degradación a `peek`, nunca cierre al localizar). El `peek` de D-11 no está implementado en el Datasheet de producción hoy.
- **UNKNOWN** — rendimiento con modelos grandes (ABIERTA-7 de CRI-10 / U-07 de CRI-8/9): sin medir en producción. Único dato existente es del prototipo aislado (ver `EXPERIMENTAL` abajo).
- **EXPERIMENTAL** — CRI-11 midió 1.16s hasta primera fila sin virtualizar sobre 1292 filas en el harness aislado (`metrics.json`, `stress.datasheetOpenMs: 1162`); el propio reporte de fase C pide medir en dispositivo real antes de escalar — no es evidencia de producción.

### 8. Model Doctor

- **VERIFIED** — `src/features/model-doctor/**` (`ModelDoctor.tsx`, `modelDoctorDiagnostics.ts`, `topologyRepairPreview.ts`), motor de reglas determinista sobre `EffectiveModel`, 5 tipos de hallazgo.
- **PROTOTYPE_VALIDATED** — loop crear→detectar→localizar→degradar a `peek`→reconocer, ejercitado end-to-end en fase B y C del harness (`reports/2026-08-16-0300-cri-11-fase-b-harness.md`); el `peek` (D-11) no vive aún en el Model Doctor de producción.

### 9. Command Palette

- **VERIFIED** — `src/features/workspace/CommandPalette.tsx`, ejecuta comandos del mismo `CommandRegistry` que los botones visibles.
- **PRODUCT_DECISION_ALREADY_CLOSED** — orden determinista (comandos derivados de selección primero, luego frecuentes globales, luego alfabético por categoría), CRI-10 evolución §7; explícitamente no-IA, no-historial.
- **PROTOTYPE_VALIDATED** — mismo `commandId` que el botón visible, navegación por ID de objeto, y el *fix* de alcance de atajos de una sola letra al elemento canvas (no `window`) para no romper navegación rápida de lectores de pantalla (fase C, hallazgo real de accesibilidad, corregido sólo en el prototipo).
- **G-01 (Ctrl+Z/Ctrl+Y anunciados sin handler)**: **PRODUCT_DECISION_ALREADY_CLOSED** — decidido implementar más adelante, acotado a no disparar en campos de texto/grilla del datasheet/modal con historial propio (`cri-9-decision-register.csv` fila 17). No implementado todavía; no es una decisión pendiente, es trabajo pendiente.

### 10. Welcome

- **VERIFIED** — pantalla de producción existe: `src/features/welcome/WelcomeScreen.tsx` + `StructuralPortalHero.tsx`, `Phase2ProjectHub.tsx`, `NewExerciseDialog.tsx`.
- **EXPERIMENTAL, no aprobado** — el rediseño de CRI-10 (flujo tipo hoja iOS: Bienvenida→Cómo trabajas→Por dónde→Mesa; portal 3D con "material clay" vía filtros SVG) es una propuesta SPEC/DESIGN en tres pasadas sucesivas, cada una reemplazando el layout de la anterior. El cierre de CRI-10 es explícito: *"Nada de CRI-10 está aprobado visualmente"* (`2026-08-16-0100-cri-10-cierre.md:19`). Las transiciones están descritas, no animadas; la elección del paso 2 no está conectada a preferencia persistente.
- Pasa a `HANDOFF.md` como `MUST_DECIDE_IN_12B` (flujo/pasos) y `MUST_DECIDE_IN_12C` (tratamiento visual del portal).

### 11. Esencial/Completa

- **UNKNOWN** — hipótesis de CRI-10, explícitamente no validada por su propio cierre (*"sigue siendo hipótesis, no funcionalidad aprobada de producción"*, §4.2). Búsqueda en `src/**` no encuentra ningún componente ni bandera "Esencial"/"Completa" (0 coincidencias reales); no está conectada a preferencia persistente.
- Pasa a `HANDOFF.md` como `MUST_DECIDE_IN_12B`.

### 12. States/reliability

- **VERIFIED + PRODUCT_DECISION_ALREADY_CLOSED** — `success ≠ reliable ≠ safe` implementado, probado y calibrado. `src/engine/reliability.test.ts:106` — *"no considera confiable un resultado solo porque success sea true"* (un modelo con `success===true` y un defecto tolerado de nivel warning se clasifica `limited`, no `reliable`). `reliabilityCalibration.test.ts:193-205` calibra umbrales contra modelos de forma cerrada. Reforzado, no reabierto, por CRI-9 D-14 (ruta accesible táctil/teclado a la causa).
- **Stale fail-closed**: **VERIFIED** en producción (`src/features/topbar/analysisStatusModel.ts:17` — `if (!analysis) return hadAnalysis ? 'stale' : 'ready'`) + **PROTOTYPE_VALIDATED** — CRI-11 reconfirma el patrón por una vía independiente (aplicar el cambio destruye el DOM de evidencia, no lo etiqueta; verificado dos veces, por `applyEdits` y por `applyHarnessState`). Protegido — ver `01b-inherited-decisions.md`.

### 13. Touch

- **VERIFIED** (base) — `touch-action:none` en `.structural-canvas` (`styles.css:592`) y en overlays de edición (`phase2.css:215`); `CanvasTouchLoupe.tsx` dedicado a precisión táctil.
- **PRODUCT_DECISION_ALREADY_CLOSED** — arquitectura de cierre de brecha D-07 (ver tema 4).
- **PROTOTYPE_VALIDATED** — marquee táctil por *long-press*; fix real de bug (`.pt-canvas` sin `touch-action:none` cancelaba el gesto como scroll nativo) corregido sólo en el harness.
- La brecha de las 5 tareas sin ruta táctil verificada en producción (tema 4) sigue siendo trabajo de implementación, no una decisión abierta.

### 14. Keyboard/accessibility

- **VERIFIED** — `useModalFocus` (`modalFocus.test.tsx:39-40`: atrapa Tab, cierra con Escape, restaura foco y scroll); `disclosure.test.tsx:17,38` (flechas mueven tabs saltando deshabilitados, accordion controlado); suites dedicadas `DatasheetAccessibility.test.tsx`, `BulkEditAccessibility.test.tsx`, `StructureGeneratorAccessibility.test.tsx`.
- **UNKNOWN** — ABIERTA-6 de CRI-10: contraste medido a nivel de píxel y pase real con lectores de pantalla, explícitamente pendiente: *"Debe hacerse antes de considerar cerrada la accesibilidad"*. No cubierto ni por CRI-7 (que lo declaró fuera de lo verificado) ni por CRI-10.
- El hallazgo de colisión de atajos de una letra con navegación rápida de lectores de pantalla (tema 9) está **PROTOTYPE_VALIDATED** como patrón de corrección, no aplicado en `src/**`.

### 15. Día/Noche

- **VERIFIED** — `ThemeMode = 'light' | 'dark'` (`src/types.ts:1`), `WorkspaceUIContext.tsx:17-18` expone `theme`/`setTheme`.
- **VERIFIED_CURRENT** — paleta lima única para ambos temas es el estado vigente de `main` (ver tema 19 para el detalle y la comparación pendiente para CRI-12C — no está protegida frente a revisión).
- **Gap de disposición ya cerrada, no ejecutada** — LEDGER-04 (CRI-10): el Brandbook prescribe patrón de tres estados (claro explícito/oscuro explícito/sistema vía `@media (prefers-color-scheme: dark)`); producción sólo implementa dos (`:root` y `[data-theme='dark']`), sin bloque `@media`. Disposición ya decidida ("Media — añadir el bloque `@media` y el tercer estado en la UI"); pendiente de ejecución, no de decisión.
- **UNKNOWN** — LEDGER-05 (contraste del pórtico en Noche): documentado, explícitamente no cambiado sin remedir.

### 16. ES/EN

- **VERIFIED** — `Language = 'es' | 'en'` (`src/i18n/catalogs.ts:1991`), catálogos `es`/`en` completos (3994 líneas), paridad forzada por tipos (`Catalog` obliga a que cada clave española tenga equivalente en inglés — el compilador es el gate). Sin hallazgos abiertos.

### 17. Performance

- **VERIFIED** — motor 2D con presupuestos con test: `performance.test.ts:66-69` (<500ms modelo pequeño), `:72-76` (<3000ms modelo medio), `:79-83` (<20000ms modelo máximo declarado), `:86` (escalado mejor que cuadrático); `benchmarks.test.ts`, `pDeltaBenchmarks.test.ts`.
- **UNKNOWN** — rendimiento de Datasheet/paleta con modelos grandes en producción, no medido (ver tema 7).
- Sin techo de tamaño de bundle configurado (`reports/2026-08-10-2033-stabilizacion-gate.md:90`) — gap técnico menor, no bloqueante.

### 18. Clay/materialidad

- **REFERENCE** — `brand/brandbook-clay.html` es la fuente de materialidad, forma, proporción y jerarquía visual, autodeclarada como documento de referencia (línea 1650), protegida por `brand/README.md` y CODEOWNERS.
- **VERIFIED** — la auditoría de reconciliación de CRI-10 confirma que producción ya está mayormente alineada con el lenguaje Clay (cero `backdrop-filter`/blur/glass; el estado "seleccionado hundido" de `.result-tabs button.active` en `src/styles.css` ya tenía el fix antes de que el concepto lo propusiera — *"esta corrección alinea el concepto con el producto, no al revés"*).
- Un único ajuste técnico queda señalado y deliberadamente sin ejecutar: inconsistencia `.canvas-layer-switch` entre `styles.css:2161` y `:3677`. Es una corrección de consistencia de código, no una decisión de diseño — candidato de bajo riesgo para `HANDOFF.md`.

### 19. Color/identidad

- **VERIFIED_CURRENT** — `main`, `brand/brandbook-clay.html` y `src/design-system/tokens.css` usan hoy, de forma verificable, la paleta lima única para Día y Noche: *"cada rol semántico usa ahora un solo HEX, declarado una vez en `:root` y prohibido en el bloque `[data-theme='dark']`"* (commit `74dfc76`). Regla de paleta única en `tokens.css:32-41`, verificada por `tokens.test.ts`.
- La decisión histórica que llevó a lima — descartar en bloque los tres verdes en conflicto del Brandbook (`#159a72`, `#00795f`, `#157A55`) a favor de `#89d448` — **está implementada hoy** en el estado vigente de `main`. Eso es lo que CRI-12A verifica: un hecho del estado actual, no una decisión que quede fuera del alcance de revisión de CRI-12.
- **MUST_DECIDE_IN_12C** — CRI-12C debe comparar explícitamente **mantener lima** vs **recuperar exclusivamente la familia menta/esmeralda histórica de identidad** (la familia teal/esmeralda de marca que existía antes del cierre cromático de `74dfc76`, no una paleta nueva). Pregunta completa en `HANDOFF.md`.
- Si en esa comparación gana menta/esmeralda, será una **decisión futura de producto**: no significa que ya esté implementada, y no autoriza por sí sola revertir los colores técnicos de dominio (punto siguiente) sin que eso pase por su propio proceso de decisión.
- Los colores técnicos de dominio — N/axial, V/cortante, M/momento, deformada, warning, error, selección, foco, reacción — **siguen separados de la identidad de marca** en `tokens.css` (capas "Roles semánticos"/marca vs "Roles técnicos del dominio", `tokens.css:21-30`). Una eventual revisión lima↔menta en 12C afecta el rol de marca, no estos tokens técnicos.

### 20. Space3D experimental

- **VERIFIED + PRODUCT_DECISION_ALREADY_CLOSED** — D-15 (`cri-9-decision-register.csv` fila 16): permanece separado y experimental, NO adopta el sistema de composición de CRI-9, sólo dos contratos neutrales (resolución de tema única, mínimos de entrada de proyecto). `docs/architecture/structureco-space-3d-s3d1.md` (`CANONICAL`) documenta capacidad medida (150 nudos/300 barras) con gate ejecutable `npm run verify:space3d`. Solver propio, separado del 2D por diseño (ver tema "mismo analysis" en `01b-inherited-decisions.md`). Protegido.

### 21. Aula fuera de alcance

- **PRODUCT_DECISION_ALREADY_CLOSED** — excluida explícitamente. Corrección U-14 de CRI-9 (commit `7e9fb05`): *"Aula está fuera de alcance de CRI-9 y sigue estacionada, sin dirección de producto reabierta."* CRI-11 fase B: *"Aula (excluida por el encargo, NOT_IN_SCOPE)"*. CRI-10: *"Aula vNext"* fuera de alcance, sólo se declara su presentación (inset colapsable), sin nuevos componentes pedagógicos ni solver propio.
- **VERIFIED** como módulo separado en código: `src/education/**`, `src/features/classroom/**`, `store/ClassroomSessionContext.tsx` — cero referencias a "education"/Aula desde `src/features/workspace/**` (verificado por grep), sin acoplamiento a nivel de import.
- Protegido — ver `01b-inherited-decisions.md`.

---

## Resumen por etiqueta

| Etiqueta | Temas |
|---|---|
| `VERIFIED` | 2, 3(base), 5, 6, 7, 8, 9, 10, 12, 13(base), 14(base), 16, 17, 18, 20, 21 |
| `VERIFIED_CURRENT` | 15(paleta), 19 — estado vigente de `main`, no cerrado a revisión |
| `PRODUCT_DECISION_ALREADY_CLOSED` | 1, 2, 3, 4, 5, 6, 7, 9, 12, 13, 20, 21 |
| `PROTOTYPE_VALIDATED` | 3, 8, 9, 12(stale), 13 |
| `EXPERIMENTAL` | 7(rendimiento), 10(rediseño Welcome) |
| `UNKNOWN` | 6(U-14, no bloqueante), 7(rendimiento), 11, 14(ABIERTA-6), 15(LEDGER-05), 17(rendimiento) |
| `MUST_DECIDE_IN_12B` | 10 (flujo Welcome), 11 (Esencial/Completa) — lista completa con preguntas en `HANDOFF.md` |
| `MUST_DECIDE_IN_12C` | 10 (tratamiento visual Welcome), 19 (lima vs menta/esmeralda histórica) — lista completa con preguntas en `HANDOFF.md` |
