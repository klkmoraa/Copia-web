# CRI-12D · Roadmap de implementación

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `research/cri-12-direction` · **HEAD de partida:** `6c4370cab9c7e6077f2eb3a2b585cba8005e270a` (cierre de CRI-12C)
**Baseline de `main` verificado al abrir la fase:** `7fb927fb6d118925e63365d1a2bb2813f8795385` — **drift: ninguno.**

Cierra CRI-86 (CRI-12·D). Convierte las decisiones cerradas de CRI-12B (UX/interacción) y CRI-12C (visual/Clay/color) en un **backlog de producción real en Linear**, ejecutable issue por issue en chats nuevos. **No implementa nada:** cero cambios en `src/**`, `brand/**` y `src/design-system/tokens.css`.

---

## 0. Qué se verificó en `main` antes de ordenar nada

CRI-86 exige revisar sólo el código necesario para saber **qué existe realmente y quién posee cada superficie**, y prohíbe usar una issue de Linear como prueba de implementación. Lo verificado por lectura directa sobre `7fb927fb`:

| Área | Estado real verificado |
|---|---|
| Shell | `AppShellLayout.tsx` compone por slots con cuatro booleanos (`inspectorCollapsed`, `fullCanvas`, `toolRailCompact`, `inspectorWidth`). **No existe noción de clase.** |
| Resolutor | **No existe.** Hay cinco `matchMedia` de ancho dispersos: `WorkspaceShell.tsx` (×3), `ToolBar.tsx`, `ResultsPanel.tsx` (×2), `ModelDoctor.tsx`. Más breakpoints repartidos por `styles.css` (1023/1024, 700, 640, 460, 1439/1440 + variantes landscape). |
| Presentación | **No existe broker.** `WorkspaceShell` mantiene cuatro `useState` booleanos y hace la exclusión mutua a mano. El `inert`/`aria-hidden` se gestiona a mano y **sólo** para el Model Doctor. |
| Materia | `material.css` (119 líneas) declara `flat`, `raised`, `floating`, `[data-pressed]` y el grupo de chrome sobre lienzo. **`SHEET` y `MODAL` no existen como nivel**, aunque `--sc-shadow-sheet` y los roles de velo **sí** existen en `tokens.css`. `SurfaceLevel` sólo admite tres valores. |
| Inspector | Panel único (`Inspector.tsx`, 349 líneas + 9 archivos). **Sin split por dueño.** |
| Results | Panel único (`ResultsPanel.tsx`, **1019 líneas**) con `role="tablist"`. **Sin descomposición D-03.** Es **proyección pura** (verificado): no muta el modelo, no recalcula. La causa gobernante de fiabilidad vive hoy en un **`title`** (`:512`) — el hallazgo exacto que D-14 cierra. |
| Datasheet | Feature completa y madura (24 archivos + pruebas), contrato canónico en `docs/architecture/structureco-datasheet.md`. **`peek` no existe.** `DatasheetGrid` no virtualiza. |
| Model Doctor | Motor determinista sobre `EffectiveModel`, 5 tipos de hallazgo. **`peek` no existe.** |
| ToolRail | `ToolRail.tsx` **son 5 líneas**: alias de compatibilidad de `ToolBar.tsx`. |
| Selección | `canvasPointerProfile()` **ya existe** y resuelve el objetivo táctil (touch 44px, `usesLongPress`, pen 32px) **sin engordar la geometría técnica**. Marquee existe **por ratón**. **No existe** candidate picker con ciclado, ni marquee táctil, ni afordancia de pegar (`navigator.clipboard.readText()` **no aparece en `src/**`**). |
| Command Palette | **`CommandRegistry` NO EXISTE.** `CommandPalette.tsx` construye su propia lista `PaletteCommand[]` en línea. Lo compartido es `TOOL_REGISTRY` (sólo herramientas) y `workspaceCommands.ts` (bus tipado de intenciones, sin etiqueta/atajo/habilitado). **Esto corrige a `02-ux-direction-record.md` §6.9, que lo marcaba `VERIFIED`.** |
| Welcome | `WelcomeScreen.tsx` es la pantalla de entrada, **no `lazy`**. El `ProjectHub` (IndexedDB real, con `RecoveryRecord`) **vive dentro** de Welcome vía `lazy`; no es una pantalla rival. `StructuralPortalHero` ya respeta `pointer:fine` y `prefers-reduced-motion`. |
| `settings.show*` | Los ocho campos viven en `ProjectSettings` → `ProjectModel`, **persistido con `schemaVersion`**. |
| **Gate protegido** | `scripts/protected-baseline.sha256` cubre `src/engine`, `src/workers`, `src/data`, **`src/store/ProjectContext.tsx` y `src/types.ts`**. Cualquier cambio ahí rompe `verify:protected` y exige autorización explícita. **Hecho decisivo para el orden.** |
| Multi-navegador | **Sí hay vehículo WebKit**: `qa:webkit`, y variantes `--webkit` de `qa:bulk-edit`, `qa:structural-edits`, `qa:structure-generator`. **Firefox no tiene vehículo.** El "sólo Chromium" de CRI-11 se refiere a su harness, no a la capacidad del repo. |
| Estado persistido | Siete claves: `structureCo.project` · `structureco:workspace-layout:v1` · `structureCo.results.mode.v1` · `structureco:editor-layers:v1` · `structureCo.inspector.expanded.v1` · `structureCo.theme` · `structureco:space3d:v1`(+backup) · prefijo de sesión de Aula. Más IndexedDB para proyectos y recuperación. |
| Deuda conocida | `.canvas-layer-switch` declarado de forma inconsistente en `styles.css:2161` y `:3677`. |

**Precondición de programa, verificada en Linear:** los P0 del *Backlog maestro* están **Done** — CRI-13 (main verde), CRI-20 (fuente de verdad), CRI-33 (gates obligatorios), CRI-34 (identidad explícita), CRI-54. La regla *"no ampliar features sobre una base cuyo gate no es confiable"* está satisfecha; este backlog no queda bloqueado por P0.

---

## 1. Estructura del backlog

Un épico nuevo — **CRI-88, hijo de CRI-6** (el programa UX), no de CRI-12. Las fases A–E de CRI-12 son investigación; la implementación no cuelga de ellas para no mezclar registros. CRI-86 bloquea CRI-88; CRI-88 bloquea CRI-87 (CRI-12·E).

**18 slices**, no 30 microissues. Cada uno es un resultado visible de producto, cerrable de forma independiente, con rollback declarado.

---

## 2. El orden, y por qué es éste

CRI-86 §A propone un orden tentativo de 16 puntos y dice explícitamente: *"sin imponerlo si dependencias reales aconsejan otro. El orden final debe considerar dependencias reales de Linear y `main`."* Se han introducido **cuatro desviaciones**, todas justificadas por hechos verificados:

**Desviación 1 — la identidad visual sube del puesto 13 al arranque, en paralelo.** CRI-86 la coloca casi al final. Se adelanta porque `brand/**` + `tokens.css` + Component Lab son **disjuntos** de `src/features/**`: no hay conflicto real de archivos con la fundación. Y el coste de dejarla al final es concreto — cada slice de UI se tendría que someter dos veces al QA de Día/Noche y contraste, una sobre lima y otra sobre menta. Empezándola ya, todo lo que se construye después se construye y se mide **una vez**, sobre color final. No bloquea a nadie de la fundación, y bloquea deliberadamente a los slices donde el color sí importa (tarjetas de Results, Welcome, Clay, gate de accesibilidad).

**Desviación 2 — "Esencial/Completa disclosure" (puesto 12 de CRI-86) no se crea.** CRI-12B #1 **rechazó** la hipótesis. Crear la issue contradiría una decisión cerrada.

**Desviación 3 — el "performance hardening" (puesto 16) se convierte en una medición que se lanza desde el día uno.** El principio es *sólo donde la medición demuestre necesidad*; para que informe a tiempo a los slices de Datasheet, tiene que medirse antes, no después.

**Desviación 4 — la evaluación de `settings.show*` deja de ser un pendiente suelto y pasa a ser bloqueante de una mitad concreta.** Se descubrió que `src/types.ts` está bajo baseline protegido: sin el veredicto de la evaluación, la superficie `view` de D-10 no se puede especificar sin arriesgar el gate. Es un bloqueo real, no burocrático.

### Capas

**Capa 0 — Arranque (nada bloquea; los cinco pueden empezar hoy)**

| # | Issue | Prioridad | Por qué está aquí |
|---|---|---|---|
| 1 | **CRI-89** · Resolutor de composición X2/M1/K0 | Urgent | Fundación. Nada que dependa de la clase puede construirse sin ella. **Es la primera issue READY del camino crítico.** |
| 2 | **CRI-90** · Materia `SHEET`/`MODAL` + `BASE` en zonas densas | High | Formalización pura en `src/design-system/**`. Parallel-safe. Desbloquea broker, `peek`, riel y tarjetas. |
| 3 | **CRI-91** · **Brandbook oficial renovado** (menta/esmeralda) | Urgent | Ficheros disjuntos. Su gate de medición es trabajo real y largo: empezarlo tarde retrasa todo lo que depende del color. |
| 4 | **CRI-92** · Evaluación de `settings.show*` (spike) | High | Sólo lectura. Su veredicto bloquea la mitad `view` del Inspector. |
| 5 | **CRI-93** · Medición de rendimiento Datasheet/paleta (spike) | Medium | Sólo medición. Informa a Datasheet y a la paleta antes de que se toquen. |

**Capa 1 — Contratos de estado**

| # | Issue | Prioridad | blockedBy |
|---|---|---|---|
| 6 | **CRI-94** · Broker de presentación y continuidad T-INV-1…8 | Urgent | CRI-89 |
| 7 | **CRI-95** · Chrome global: TopBar a tres naturalezas, piso de Cinta, causa enfocable (D-14) | High | CRI-89 |

**Capa 2 — Interacción precisa**

| # | Issue | Prioridad | blockedBy |
|---|---|---|---|
| 8 | **CRI-96** · Selección de 5 fases + Candidate Picker (D-06) | High | CRI-89, CRI-94 |
| 9 | **CRI-97** · `contextual-actions` + paridad táctil D-07 | High | CRI-89, CRI-94, CRI-96 |

**Capa 3 — Superficies con dueño**

| # | Issue | Prioridad | blockedBy |
|---|---|---|---|
| 10 | **CRI-99** · Inspector partido: `detail` / `analysis-setup` / `view` | High | CRI-89, CRI-94, **CRI-92** |
| 11 | **CRI-100** · Results 1/2: estado y fiabilidad al `topbar`, evidencia como capa | High | CRI-89, CRI-94, CRI-95 |
| 12 | **CRI-101** · Results 2/2: tarjetas de extremos/detalle/procedencia + `dense` invocada | High | CRI-100, CRI-90, CRI-91 |
| 13 | **CRI-102** · Datasheet y Model Doctor con `peek` (D-11) | Medium | CRI-94, CRI-90 |
| 14 | **CRI-98** · ToolRail por clase, bandeja `INSET` + herramientas `RAISED` | Medium | CRI-89, CRI-90 |
| 15 | **CRI-103** · Registro único de comandos + atajos (G-01) | Medium | CRI-89 |
| 16 | **CRI-104** · Welcome: 4 pasos, marca presente, portal clay acotado | Medium | CRI-90, CRI-91 |

**Capa 4 — Acabado y gates**

| # | Issue | Prioridad | blockedBy |
|---|---|---|---|
| 17 | **CRI-105** · Reconciliación Clay: radios por rol, canto, una sola luz (LEDGER-01) | Medium | CRI-91, CRI-90 |
| 18 | **CRI-106** · Gate de accesibilidad real: contraste, lectores, multi-navegador (ABIERTA-6) | High | CRI-91 |

### Por qué Results va partido en dos y no en uno ni en cuatro

`ResultsPanel.tsx` son 1019 líneas y D-03 lo reparte entre cuatro dueños. Un solo slice sería el mayor riesgo de regresión del programa; cuatro serían microissues sin valor visible por separado. El corte natural es **por naturaleza de cambio**: la primera mitad mueve *afirmación* (estado/fiabilidad al chrome) y *mecanismo* (evidencia como capa); la segunda mueve *presentación* (tarjetas y superficie densa) y por eso necesita color y materia finales.

### Por qué Datasheet y Model Doctor van juntos

Es el **mismo patrón**: `peek` como estado de `drawer`/`fullscreen`, "localizar" que degrada en vez de cerrar. Separarlos duplicaría el trabajo de integración con el broker sin entregar dos valores distintos.

---

## 3. Cobertura respecto al encargo

| Pedido en CRI-86 / por el propietario | Issue |
|---|---|
| adaptive shell | CRI-89 |
| continuity / surface broker | CRI-94 |
| selección precisa | CRI-96 |
| chrome | CRI-95 |
| Inspector | CRI-99 |
| ToolRail | CRI-98 |
| Results | CRI-100 + CRI-101 |
| Datasheet | CRI-102 |
| Doctor | CRI-102 |
| Welcome | CRI-104 |
| Palette / shortcuts | CRI-103 |
| Clay / materiality | CRI-90 + CRI-105 |
| accesibilidad | CRI-106 |
| **Brandbook (obligatorio)** | **CRI-91** |
| riesgos técnicos heredados | CRI-92 (schema) + CRI-93 (rendimiento) + CRI-106 (multi-navegador, clipboard) |
| paridad táctil D-07 | CRI-97 |
| Esencial/Completa | **no se crea** — rechazada en CRI-12B #1 |

---

## 4. Sobre la issue del Brandbook (CRI-91)

Es la única issue del backlog cuyo contenido lo especificó el propietario punto por punto. Se recoge íntegro y sin reinterpretar:

- **Actualiza el Brandbook oficial existente**, en `brand/brandbook-clay.html`, **en su sitio**. No hay "Brandbook v2", ni sistema visual paralelo, ni documento nuevo que compita. Al terminar sigue habiendo **una** autoridad visual — renovada y completa.
- **Incorpora las decisiones aprobadas de CRI-12C**: carácter visual (V-01), regla Clay/plano (V-02), gramática `BASE`/`INSET`/`RAISED`/`FLOATING`/`SHEET`/`MODAL` (V-03), intensidad Clay (V-04), radios (V-05), materialidad, Día/Noche (V-09), Results (V-10), Welcome (V-11), iconografía (V-12), motion (V-13) y accesibilidad (V-14).
- **Ejecuta primero el gate cromático** de `03-color-decision.md` §4 — es condición de entrada, no verificación final.
- **Los HEX salen de la medición, no del gusto.** `03-color-decision.md` deliberadamente no fija ninguno.
- Identidad **lima → menta/esmeralda**; **cortante V → familia lima** (trazo profundo + área en tinte); **línea de influencia → rosa/fucsia pastel** con canto medido y **trazo siempre discontinuo**.
- **Preserva los demás colores técnicos** salvo que el gate documentado obligue a mover **éxito** o **Aula** — y para esos dos la decisión de qué se mueve ya está tomada en §4.2.
- **Actualiza de forma coordinada** `brand/brandbook-clay.html`, `tokens.css` y Component Lab, en ese orden (Brandbook primero: un HEX en `tokens.css` ausente del Brandbook es una regresión del mecanismo de autoridad única).
- **Nada de `git revert` global.** Los commits `74dfc76`/`f60eae5`/`7fb927f` siguen siendo historia válida.
- **QA Día/Noche, contraste, escala de grises/CVD y accesibilidad** incluidos.

---

## 5. Qué NO se creó, y por qué

| Tema | Disposición | Fuente |
|---|---|---|
| Esencial/Completa | **Rechazada.** No se crea issue. | CRI-12B #1 |
| Marco de selección direccional (ABIERTA-3) | **Diferido.** Requiere test de discoverability no ejecutado. | CRI-12B #4 |
| Serif editorial para titulares | **Decisión abierta sin acotar.** Requiere resolver antes la entrega local-first, y nunca alcanza valores/unidades/tablas/Datasheet. | V-06 |
| Tarjetas en Datasheet y tablas densas | **Petición registrada, no decisión.** Reabriría D-11 y D-03. | V-10 |
| Aula vNext | Fuera de alcance. | CRI-86 |
| Productización de Space3D | Fuera de alcance; D-15 congelado. | CRI-86 |
| Medición del zócalo Compact (ABIERTA-4) y del riel Medium (ABIERTA-1) | Los valores provisionales entran en CRI-97 y CRI-98 **marcados como provisionales**; medirlos es trabajo posterior. | CRI-12B #5/#7 |
| 8 escenarios de discoverability | Riesgo aceptado; seguimiento post-lanzamiento. | CRI-12B #8 |

---

## 6. Decisiones de producto abiertas encontradas durante la planificación

CRI-86 y el encargo permiten preguntar al propietario si aparece una decisión de producto no cerrada que impida crear una issue correcta. **No apareció ninguna.** Cada ítem abierto tenía ya una disposición explícita que permite escribir la issue sin inventar nada:

- `settings.show*` → 12B ya decidió *"ejecutar la evaluación primero"* → issue de evaluación (CRI-92), no de migración.
- Serif → decisión futura declarada → excluida explícitamente de CRI-91 y CRI-104.
- LEDGER-05 → gate con orden ya fijado (después de los HEX) → asignado a CRI-106.
- ABIERTA-1/4/6/7, U-11, multi-navegador → gates y valores provisionales ya fijados → issues de medición o notas de provisionalidad.
- Welcome vs ProjectHub → **resuelto por verificación de código**, no por decisión: el hub vive dentro de Welcome, no compite con él.

La única elección genuina de esta fase era el **orden**, y CRI-86 §A la delega explícitamente en CRI-12D. Está tomada y justificada en §2.

---

## 7. Confirmación de alcance de CRI-12D

- Único directorio creado o modificado: **`reports/cri-12/**`** — `04-implementation-roadmap.md`, `04-dependency-map.md`, `04-migration-strategy.md`, `04-implementation-risk-register.md`, y actualización de `HANDOFF.md`.
- **Cero cambios** en `src/**`, `brand/**` y `src/design-system/tokens.css`. Todo lo citado del código se verificó **por lectura directa**, no por corrida.
- No se ejecutó ninguna suite ni ningún gate.
- No hubo prototipo, no hubo merge a `main`, no hubo publicación en GitHub Pages.
- No se implementó ninguna issue del backlog.
- Se crearon **19 issues reales en Linear** (CRI-88 épico + CRI-89…CRI-106), con prioridad razonada, padre correcto, `blockedBy`/`blocks` explícitos, labels y descripción autocontenida.
- Una corrección de hecho respecto a documentos previos: **`CommandRegistry` no existe en `src/**`**, contra lo que `02-ux-direction-record.md` §6.9 marcaba como `VERIFIED`. Queda registrada en CRI-103 y en §0 de este documento.
