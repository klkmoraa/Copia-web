# CRI-12B · Registro de dirección UX

**Clasificación:** `AUDIT/TEMPORARY`

Cierra CRI-12B: la dirección UX funcional/no-visual de structureCo sobre `research/cri-12-direction`, HEAD verificado `05f250ec443af7c35e5890ccaceee8da4fa16993`. No decide identidad de color, Clay fino, ni tratamiento visual — eso sigue siendo `MUST_DECIDE_IN_12C` (ver cierre, abajo). No implementa producción: ningún archivo de `src/**`, `brand/**` ni `src/design-system/tokens.css` cambió en esta sesión.

## 1. Qué hereda sin reabrir

Todo lo que `01b-inherited-decisions.md` §A/§B marca como cerrado permanece cerrado: el registro D-01…D-15/G-01/G-02 de CRI-9 (arquitectura de shell adaptativo, contrato de selección de 5 fases, superficie `contextual-actions`, split de Inspector, descomposición de Results, Datasheet modal+`peek`, superficie `recovery`, unificación de edición D-12, Space3D congelado D-15) y el ledger LEDGER-01…09 de CRI-10 (radios, foco, tipografía, tema de 3 estados, target táctil, aviso legal vía `ⓘ`, clases legacy, grosor de icono). Ninguna de estas es una pregunta de 12B — son trabajo de ejecución pendiente en `src/**`, no elección.

## 2. Decisiones cerradas en esta sesión

Detalle fila por fila en `02-ux-decision-matrix.md`. Resumen narrativo:

**Esencial/Completa — descartado.** Sin sustento en código ni en preferencia persistente, y CRI-10 nunca la dio por aprobada. Se retira del roadmap de 12B/12C; no queda ningún trabajo de validación pendiente sobre esta hipótesis.

**Flujo de Welcome — estructura adoptada.** Se cierra la navegación de 4 pasos (Bienvenida→Cómo trabajas→Por dónde→Mesa, con salto directo a Mesa para quien regresa) propuesta en la 3ª pasada de CRI-10. Esto es exclusivamente estructura/navegación: el tratamiento visual del portal ("material clay" vía filtros SVG) sigue sin aprobar y es competencia de CRI-12C. Las transiciones entre pasos siguen sin animar ni implementar.

**Shell adaptativo (X2/M1/K0) — prioridad de implementación fijada para CRI-12D.** La arquitectura ya estaba `DECIDED` (D-01/D-04/D-05); lo que se decide ahora es su prioridad relativa dentro del backlog de implementación, no la implementación en sí — CRI-12B no toca `src/**`. La máquina de estados resolver-driven vía `matchMedia` (conectando los tokens de densidad por tier que ya existen en `tokens.css:556-560`, en vez del booleano `toolRailCompact` actual) debe ir antes que otras piezas que dependen de tener las tres clases funcionando de verdad. CRI-12D es quien convierte esta prioridad en tareas de backlog.

**Marco de selección direccional (ABIERTA-3) — diferido.** No se incorpora al contrato D-06 todavía. El contrato de 5 fases sigue siendo la única superficie de selección vigente; esta adición queda pendiente de un test de discoverability que no se ha corrido.

**Riel sólo-icono en Medium (ABIERTA-1) — mantenido, provisional.** Sin la tarea cronometrada riel-etiquetado-vs-icono, se mantiene el M1 actual (icono sin etiqueta) documentando explícitamente que es una decisión sin evidencia de discoverability, no una que la tenga.

**Histéresis del resolver (ABIERTA-2/U-13) — fijada en `bandPx = 24`.** Es el valor por defecto que CRI-11 ya usaba en el harness y que, junto con 0/60/120, dio el mismo número de recomposiciones (3) en el barrido 900↔1300px a la altura probada. Se documenta explícitamente que esto es evidencia `PROTOTYPE_VALIDATED`, no de producción, y que la fase C de CRI-11 fue honesta al decir que no discrimina si el valor de banda importa a otras alturas o con una banda mayor a 400px — eso queda como pregunta abierta para si una medición futura lo contradice.

**Zócalo Compact apaisado (ABIERTA-4) y chrome de Cinta Compact (GAP-1) — piso conservador fijado.** Zócalo: 1 verbo primario (el más frecuente para el tipo de selección) + Borrar, siempre visibles, resto a `⋯`. Cinta: Estado/resolver y Doctor nunca se degradan (protege `success ≠ reliable ≠ safe` y stale fail-closed, D-14); persistencia, Datasheet y nombre de proyecto son los primeros candidatos a icono-only o truncado con elipsis. Este piso reutiliza el patrón de disclosure que CRI-10 ya mostró en su lámina 25 — **no** reactiva el concepto Esencial/Completa, que queda descartado (ver arriba). No sustituye la medición real pendiente sobre 7 tipos de selección × 2 idiomas.

**8 escenarios de discoverability — riesgo aceptado, se avanza sin ellos.** Ninguna decisión de discoverability de esta sesión (riel Medium, marco direccional si se retoma) tiene respaldo de tiempo/abandono real. Queda como seguimiento post-lanzamiento, no como bloqueante de 12B.

**`settings.show*` fuera del schema (ABIERTA-8/U-12) — pendiente técnico marcado como prioritario para CRI-12D.** No se decide todavía si se migra, y la evaluación de riesgo/impacto en sí no se ejecuta en esta sesión. Lo que se decide es que ese pendiente — el que el propio CRI-9 marcó como el riesgo más alto de todo su schema — queda asignado a CRI-12D, que debe encargar y ejecutar la evaluación antes de que cualquier fase pueda decidir la migración.

**Brechas de paridad táctil D-07 (SEL-02, SEL-03, MOD-13, DAT-06, MOD-12) — prioridad/secuencia fijada para CRI-12D.** Arquitectura ya cerrada (superficie `contextual-actions` + sub-modo de marco de selección + affordance de pegar); se fija su prioridad dentro del backlog de implementación de CRI-12D, consistente con priorizar el shell adaptativo del que dependen. CRI-12B no las implementa.

**Verificaciones técnicas bloqueantes — gate paralelo, no bloqueante.** Contraste a nivel de píxel + lectores de pantalla reales (ABIERTA-6), rendimiento de Datasheet/paleta en dispositivo real (ABIERTA-7), disponibilidad de `navigator.clipboard.readText()` (U-11) y matriz multi-navegador completa (sólo Chromium probado) no bloquean cerrar esta dirección UX, pero sí bloquean declarar cerrada accesibilidad, rendimiento o compatibilidad — se ejecutan como pista paralela.

## 3. Invariantes protegidos — confirmados intactos

Ninguna decisión de esta sesión los toca:

- `success ≠ reliable ≠ safe` — reforzado por el piso de Cinta Compact (#7), que protege que Estado/resolver y Doctor nunca degraden.
- **Stale fail-closed** — sin cambios.
- **Canvas-first** — sin cambios; el shell adaptativo prioriza ejecución, no reabre presupuesto CB-1..6.
- **Mismo producto en Expanded/Medium/Compact** — el piso conservador del zócalo/Cinta (#7) es explícitamente eso: un piso, no una segunda aplicación. No revive Esencial/Completa.
- **No segundo solver** — sin cambios; ninguna decisión de 12B toca el motor de análisis.
- **2D/3D separados** — sin cambios; Space3D no se mencionó en ninguna de las 11 decisiones.
- **Space3D experimental (D-15 congelado)** — sin cambios.
- **Aula fuera de alcance** — sin cambios; no se mencionó en ninguna decisión.
- **`materialId`/`sectionId` explícitos, nunca inferidos por floats** — sin cambios; no aplica a ninguna de las 11 decisiones (son de navegación/shell/discoverability, no de identidad de datos).
- **No ocultar capacidades reales por "limpieza"** — el piso conservador del zócalo (#7) pliega a overflow, nunca retira una capacidad: mismo patrón que ya usaba el contrato D-07 (Copiar/Duplicar/Repetir con ruta contextual, nunca sólo atajo).

## 4. Qué sigue abierto — no se cierra aquí

Detalle completo en `02-rejected-and-deferred.md`. En síntesis: el marco de selección direccional (diferido), la migración de `settings.show*` (sólo se asignó como pendiente técnico prioritario a CRI-12D, ni la evaluación ni la decisión de migrar se ejecutaron aquí), el backlog de implementación del shell adaptativo y de las brechas D-07 (prioridad fijada, ejecución asignada a CRI-12D), y todas las verificaciones técnicas y mediciones reales (riel Medium, 8 escenarios de discoverability, contraste+lectores de pantalla, rendimiento en dispositivo real, clipboard, multi-navegador, medición real del zócalo Compact sobre 7 tipos × 2 idiomas, sensibilidad de `bandPx` a otras alturas/bandas) siguen sin ejecutarse. Fijar un valor provisional en 5 de estas (#5, #6, #7) no es lo mismo que haberlas medido — queda explícito en cada fila de la matriz.

## 5. Frontera con CRI-12C — sin tocar

Lo que sigue siendo exclusivamente de CRI-12C, sin ninguna decisión de esta sesión que lo adelante:

- Lima vs menta/esmeralda histórica (tema 19 de `01-evidence-matrix.md`) — identidad de color de marca.
- Tratamiento visual del portal de Welcome ("material clay" vía filtros SVG) — la estructura de pasos se cerró en esta sesión (§2), el tratamiento visual no.
- Remedición de contraste del pórtico en Noche (LEDGER-05).
- Regla de la placa técnica ilustrativa "IPE-240 · A992" en Welcome, si se implementa el Welcome propuesto.

## 6. Contratos finales — resumen autocontenido exigido por CRI-84

Esta sección reúne, tema por tema, **únicamente** decisiones ya cerradas de CRI-9/CRI-10/CRI-12B y evidencia ya citada de CRI-11. No introduce ninguna regla nueva. Cada punto lleva su disposición: `DECIDED` (CRI-9/10, cerrado, no se reabre), `VERIFIED` (confirmado en `src/**` hoy), `PROVISIONAL` (CRI-12B fijó un valor sin la medición real), `PROTOTYPE_VALIDATED` (evidencia de CRI-11, harness aislado, no producción), `PRIORITIZED_FOR_12D` (CRI-12B fija orden, CRI-12D implementa), `DEFERRED` (no se decide todavía) o `UNKNOWN` (sin dato). Fuente de cada punto: `reports/2026-08-15-0400-cri-9-arquitectura-interaccion-adaptativa.md` (secciones citadas entre paréntesis), CRI-10 base/evolución/cierre, y `01-evidence-matrix.md`/`01b-inherited-decisions.md`/`02-ux-decision-matrix.md` de CRI-12.

### 6.1 Expanded / Medium / Compact

- **DECIDED** (D-01, D-04, D-05 — CRI-9 §13): tres composiciones `X2`/`M1`/`K0`, salida de un resolutor puro sobre presupuesto de lienzo CB-1..6, nunca breakpoints de ancho fijados a mano. Frontera de Medium calculada en 1042–1130px según altura. `M1` = riel de iconos + detalle superpuesto sin reflow + cero resultados residentes.
- **DECIDED** (CRI-10 cierre §3): "Expanded / Medium / Compact resueltas por el resolutor de composición; las 9 clases prometidas se resuelven como se prometen."
- **PRIORITIZED_FOR_12D** (CRI-12B #3): construir la máquina de estados resolver-driven vía `matchMedia`, conectando los tokens de densidad por tier ya presentes en `tokens.css:556-560`, en vez del booleano `toolRailCompact` actual (`AppShellLayout.tsx:15,37,47`).
- **PROVISIONAL** (CRI-12B #5): riel sólo-icono en Medium (ABIERTA-1) mantenido sin la tarea cronometrada riel-etiquetado-vs-icono.
- **PROVISIONAL** (CRI-12B #6): histéresis del resolver fijada en `bandPx = 24`, sobre evidencia `PROTOTYPE_VALIDATED` de CRI-11 fase C (900↔1300px, 3 recomposiciones estables en 0/24/60/120).
- **PROVISIONAL** (CRI-12B #7): piso conservador del zócalo Compact apaisado (ABIERTA-4) y del chrome de Cinta Compact (GAP-1).
- **UNKNOWN**: medición real de discoverability del riel Medium; sensibilidad de `bandPx` a otras alturas o bandas >400px; ancho real de Cinta/zócalo con contenido real sobre 7 tipos de selección × 2 idiomas.

### 6.2 Surface ownership

- **DECIDED** (CRI-9 §5/§6, elevado a contrato cerrado en §15 punto 6): catálogo de **18 superficies, un dueño cada una**, no se renegocia. `Inspector` se parte en tres por dueño (`detail`=selección; `analysis-setup`=proyecto/análisis; `view`=estado de vista del lienzo). `ResultsPanel` se parte en cuatro (`topbar`=estado/fiabilidad; `view`=elección de evidencia, es capa; `detail`=detalle y procedencia del número; `dense`=datos densos, invocados). Nuevas superficies con dueño propio: `contextual-actions` (ruta táctil, D-07), `recovery` (conflicto/recuperación, D-08), `view` como dueño único de visibilidad del lienzo (D-10), `analysis-setup` (D-09). Se conservan intactas sin partir: `canvas`, `toolrail`, `dense` (datasheet), `doctor`, `palette`, `status`, `welcome`, `classroom`, `space3d`. La TopBar sobrevive reducida a tres naturalezas: identidad del documento, acción global, estado.
- **DECIDED** (R-3, CRI-9 §11): "Ninguna superficie puede pedir su propia presentación. Sólo el resolutor la asigna."
- **VERIFIED parcial**: hoy `Inspector.tsx` y `ResultsPanel.tsx` existen como panel único en producción, sin el split por dueño — mismo gap de ejecución que el shell adaptativo, dentro del backlog `PRIORITIZED_FOR_12D` (#3).

### 6.3 Rutas visible / contextual / experto

- **DECIDED** (CRI-10 evolución §3, cerrado en cierre §3 como "tres velocidades de acceso"): *"Ninguna capacidad esencial puede depender únicamente de un atajo, de la Command Palette o de un menú contextual. Toda capacidad esencial necesita al menos una ruta visible o contextual — la ruta rápida es un acelerador, nunca la única puerta."* Ejemplo cerrado que prueba la regla: Copiar/Duplicar/Repetir no tienen ruta visible de primer nivel, pero sí ruta contextual (desbordamiento del zócalo con atajo mostrado al lado) — nunca dependen sólo de la tecla.
- **DECIDED** (D-09): el menú "Más" deja de ser un menú fijo y pasa a ser una regla — desbordamiento filtrado por contexto; ningún task vive sólo en overflow.
- **PROVISIONAL** (CRI-12B #7), consistente con la regla anterior: piso del zócalo Compact = 1 verbo primario + Borrar siempre visibles (ruta visible), resto a overflow `⋯` (ruta contextual); el atajo de teclado sigue siendo la ruta experta, nunca la única.
- **DEFERRED** (CRI-12B #4): marco de selección direccional (ABIERTA-3) no se incorpora todavía a ninguna de estas tres rutas.

### 6.4 Continuity de viewport / selection / evidence / state

- **DECIDED** (CRI-9 §8, los ocho invariantes de transición T-INV-1…8): cambio de viewport es un evento de **presentación** — nunca muta `ProjectModel`, nunca hace commit/cancel de un borrador, nunca cambia la selección (T-INV-1); una superficie no se cierra en una transición, **migra** (T-INV-2); el foco sigue a su superficie, y si migra va al elemento equivalente (T-INV-3); el teclado virtual **no** es un cambio de clase — `visualViewport` ajusta, nunca recompone (T-INV-4); el resolutor tiene histéresis en las fronteras y sólo commitea sobre tamaño estable (T-INV-5); la rotación conserva el desplazamiento por ancla, nunca por offset en píxeles (T-INV-6); un cambio de input cambia afordancias de inmediato y nunca la composición (T-INV-7); un borrador sin aplicar bloquea la sustitución de su superficie — si el destino es exclusivo, el origen se suspende con su estado, no se destruye (T-INV-8).
- **PROTOTYPE_VALIDATED** (CRI-11 fase C, `reports/evidence/2026-08-16-cri-11-fase-c/04-continuidad-final.png`): continuidad de cámara/selección/evidencia ejercitada end-to-end en el recorrido Expanded↔Medium↔Compact portrait/landscape.
- **PROVISIONAL** (CRI-12B #6): el mecanismo de histéresis (T-INV-5) queda fijado con `bandPx = 24`.
- **PRIORITIZED_FOR_12D**: la máquina de estados que hace cumplir T-INV-1…8 en producción no existe todavía — mismo backlog que 7.1.

### 6.5 Selection + Candidate Picker

- **DECIDED** (D-06, CRI-9 §9): contrato de 5 fases — detección de candidatos → previsualización → elección/ciclado → compromiso → cancelación —, idéntico en mouse/touch/stylus/keyboard. La lupa y el picker son **dos fases de un mismo mecanismo**, no dos mecanismos distintos. Sin gesto táctil nuevo: el long-press de 480ms arma el picker cuando hay más de un candidato, y se comporta como hoy cuando hay uno solo. Cancelar nunca altera la selección previa; con el picker abierto, `Escape` tiene alcance acotado (cierra sólo el picker). La ampliación del objetivo táctil nunca engorda la geometría técnica.
- **PROTOTYPE_VALIDATED** (CRI-11 fase C, `reports/2026-08-16-cri-11-fase-c-validacion.md` §1.1-1.2): marquee táctil por long-press (>480ms, distinto de pan) y ciclado por teclado (ArrowUp/Down/Home/End) del picker de candidatos, cerrando la 5ª fase del contrato. Ninguna de las dos vive en `src/**` todavía; ninguna decisión de CRI-12B les asignó prioridad explícita de implementación — se deja constando como gap sin asignar, no se inventa una prioridad aquí.
- **DEFERRED** (CRI-12B #4): marco de selección direccional (ABIERTA-3) no se incorpora al contrato D-06.

### 6.6 Results

- **DECIDED** (D-03): deja de existir como panel. Se reparte en `topbar` (estado del análisis y fiabilidad — "es la afirmación más crítica del producto"), `view` (elección de evidencia N/V/M/deformada/mapa — "elegir evidencia es elegir capa, no abrir una pestaña"), `detail` (detalle del objeto y procedencia del número), `dense` (reacciones, influencia, "Entender" — datos densos, invocados, nunca residentes). Ninguna superficie de resultados es residente en ninguna clase.
- **VERIFIED**: `ResultsPanel.tsx` es proyección pura hoy — no muta el modelo, no recalcula el solver.
- **UNKNOWN, no bloqueante**: U-14 (compatibilidad con Aula si su dirección de producto reabre) — diferido explícitamente, no es tarea de CRI-11 ni de CRI-12.
- **PRIORITIZED_FOR_12D**: la descomposición en cuatro dueños no está implementada en producción (sigue siendo panel único) — depende del mismo backlog que 7.1/7.2.

### 6.7 Datasheet

- **DECIDED** (D-11): modal **y** coordinado, por la misma regla de presentación; **localizar degrada a `peek`, nunca cierra**. Modo "sólo la selección" como faceta.
- **VERIFIED**: feature completa en `src/features/datasheet/**` (24 archivos + pruebas); contrato canónico `CANONICAL` en `docs/architecture/structureco-datasheet.md` — rejilla propia sin historial propio, escritura vía `updateProject` una vez por aplicar, no repara topología (delega a Model Doctor).
- Gap: `peek` de D-11 no implementado en el Datasheet de producción hoy.
- **UNKNOWN** (ABIERTA-7 / U-07), tratado como **gate paralelo no bloqueante** (CRI-12B #11): rendimiento con modelos grandes (~2000 entidades) sin medir en producción. Único dato existente es **EXPERIMENTAL**: 1.16s hasta primera fila sin virtualizar sobre 1292 filas en el harness aislado de CRI-11.

### 6.8 Model Doctor

- **VERIFIED**: motor de reglas determinista sobre `EffectiveModel` (`ModelDoctor.tsx`, `modelDoctorDiagnostics.ts`, `topologyRepairPreview.ts`), 5 tipos de hallazgo.
- **PROTOTYPE_VALIDATED**: loop crear→detectar→localizar→degradar a `peek`→reconocer, ejercitado end-to-end en fase B y C del harness de CRI-11.
- Gap: el `peek` de D-11 no vive aún en el Model Doctor de producción — mismo patrón que Datasheet (7.7).

### 6.9 Command Palette

- **VERIFIED**: `CommandPalette.tsx` ejecuta comandos del mismo `CommandRegistry` que los botones visibles.
- **DECIDED** (CRI-10 evolución §7, cerrado): orden determinista — comandos derivados de la selección activa primero, luego frecuentes globales, luego alfabético por categoría; explícitamente no-IA, no-historial.
- **PROTOTYPE_VALIDATED** (CRI-11 fase C): mismo `commandId` que el botón visible; navegación por ID de objeto; y el *fix* de alcance de atajos de una sola letra al elemento canvas (no `window`), para no romper la navegación rápida de lectores de pantalla — corregido sólo en el prototipo, no en `src/**`.
- **DECIDED** (G-01): `Ctrl+Z`/`Ctrl+Y` se implementan más adelante, acotados a no disparar con foco en campo de texto, grilla del datasheet o superficie modal con historial propio. No implementado todavía; es trabajo pendiente, no una decisión abierta.

### 6.10 Panel / inset / sheet / fullscreen

- **DECIDED** (CRI-9 §11, vocabulario cerrado, elevado a contrato en §15 punto 3): una superficie sólo puede tener **una** de estas presentaciones, y **quien la elige es siempre el resolutor** (R-3) — nunca la superficie misma.

  | Presentación | Cuándo | Coexiste con el lienzo | Foco | Escape |
  |---|---|---|---|---|
  | `band` | Chrome permanente justificado (sólo TopBar) | Sí | No atrapa | No aplica |
  | `dock` | El presupuesto paga espacio permanente y el reflow es barato | Sí, con reflow | No atrapa | No cierra |
  | `inset` | El presupuesto paga la superficie pero **no** el reflow | Sí, sin reflow | No atrapa | Cierra |
  | `sheet` | Compact: la superficie **es** la tarea activa | Parcial, con detents | No atrapa mientras haya lienzo visible | Cierra y devuelve foco |
  | `drawer` | Superficie densa invocada sobre el lienzo | No — es modal | Atrapa, con `inert`/`aria-hidden` en el fondo | Cierra y devuelve foco |
  | `fullscreen` | Sustituye la mesa | No | Atrapa | Vuelve, conservando contexto |
  | `overlay` | Efímero ligado a un gesto | Sí | No atrapa | Cancela sólo lo suyo |
  | `floating` | Chrome sobre el lienzo | Sí | No atrapa | No aplica |

  Reglas de convivencia: **R-1** una capa contextual a la vez en Compact, con excepción declarada de `status` y `transient` (pueden coexistir con cualquier otra). **R-2** `drawer` y `fullscreen` son exclusivos entre sí en todas las clases. **R-4** `peek` es un estado de `drawer`/`fullscreen`, no una presentación nueva. **R-5** `drawer` y `fullscreen` atrapan foco y marcan el fondo `inert`; `dock`, `inset` y `sheet` no.

- **DECIDED** (matriz Expanded/Medium/Compact × superficie, CRI-9 §7): ejemplos cerrados — `detail` = dock contextual (Expanded) → inset contextual (Medium) → sheet con detents (Compact); `dense` = drawer/dock fijable (Expanded) → drawer con `peek` (Medium) → fullscreen con `peek` (Compact); `doctor` = drawer lateral (Expanded) → drawer con `peek` (Medium) → hoja/fullscreen con `peek` (Compact); `palette` = overlay modal (Expanded/Medium) → hoja casi completa (Compact).
- **PRIORITIZED_FOR_12D**: vocabulario y matriz vigentes en la arquitectura, sin máquina de estados que los aplique en producción hoy — mismo backlog que 7.1.

### 6.11 Accessibility interaction

- **DECIDED** (CRI-9 §14, 11 contratos — 8 ya implementados y elevados a regla): propiedad de foco al abrir/cerrar/**reubicar** (reubicar es nuevo, T-INV-3); restauración de foco (resuelto); `Escape`/Cancel coherente con el alcance acotado que añade D-06; ruta de teclado equivalente (salvo G-01 y el marco de selección); equivalencia hover→foco/tap (roto en el punto más crítico — la causa de fiabilidad vivía en un `title` — D-14 lo cierra); alternativas al arrastre (redimensión del Inspector con teclado vía `role="separator"`; el detent aún necesita arrastre, P-12); ampliación de objetivo sin alterar geometría (resuelto bajo `pointer:coarse`; falta el equivalente de puntero fino, F-02); resumen para lector de pantalla (parcial — 66 regiones `aria-live` existen, la causa gobernante no se anuncia); movimiento reducido (resuelto global y por componente); semántica modal/`inert` (resuelto); teclado virtual y `visualViewport` (resuelto, T-INV-4 lo eleva a contrato).
- **DECIDED** (D-14): explicación accesible de estados críticos/deshabilitados vía elemento **enfocable** ("qué / por qué / qué hacer"), nunca sólo `title` o hover — protege `success ≠ reliable ≠ safe`.
- **PROTOTYPE_VALIDATED** (CRI-11 fase C): fix del hallazgo real de colisión entre atajos de una letra y la navegación rápida de lectores de pantalla — corregido sólo en el prototipo, no en producción.
- **UNKNOWN**, tratado como **gate paralelo no bloqueante** (CRI-12B #11): contraste medido a nivel de píxel + pase real con lectores de pantalla (ABIERTA-6) — *"debe hacerse antes de considerar cerrada la accesibilidad"*.

### 6.12 Motion behavioral

- **DECIDED + VERIFIED** (CRI-10 base §16, confirmado como contrato cerrado en cierre §3 — *"Tiempos del Brandbook §12, que ya coinciden exactamente con los tokens"*; no es una propuesta visual nueva, ya está implementado en `tokens.css:565-577` y honrado con `@media (prefers-reduced-motion: reduce)` en `tokens.css:805` y en `styles.css`): cuatro tiempos — `press` 70ms (la arcilla se aplana al pulsar), `fast` 140ms (hover, tooltips, chips, cruce de capas de evidencia), `standard` 220ms (paneles, tarjetas, `inset`, el zócalo con 60ms de retardo), `slow` 360ms (hojas, drawers, segmentado, cambio de tema). Sólo se anima `transform`, `opacity` y `box-shadow` — nada que provoque recálculo de layout.
- **DECIDED** — tres reglas de dominio: (1) la geometría del modelo **nunca se interpola** — los cambios de geometría son instantáneos, lo que se anima es la cámara; (2) la cámara sí suaviza al encuadrar un objeto (`--sc-ease-emphasized`, `standard`) porque ahí el movimiento *es* la información — el pan y el zoom del usuario son instantáneos; (3) las capas de evidencia entran y salen con `fast`, nunca con desplazamiento.
- **DECIDED**: `prefers-reduced-motion` colapsa todas las duraciones a 0.001ms y `--sc-clay-press-transform` pasa a `none` — el relieve permanece, se retira el desplazamiento; el encuadre de cámara sigue ocurriendo, instantáneo — se retira el movimiento, nunca la función.
- Frontera con CRI-12C, sin conflicto: este es el contrato de **comportamiento** (cuándo/qué anima y por qué), ya cerrado y ya implementado. Es distinto del tratamiento visual del portal de Welcome (`MUST_DECIDE_IN_12C`) y de sus transiciones de flujo, que CRI-10 cierre §4.3 deja explícitamente *"descritas, no animadas ni implementadas"* — ese pendiente sigue abierto (§4 de este documento), sin que este contrato general de motion lo prejuzgue.

### 6.13 Tabla resumen de disposición

| Tema | Disposición(es) |
|---|---|
| Expanded/Medium/Compact | `DECIDED` (arquitectura) + `PRIORITIZED_FOR_12D` (implementación) + `PROVISIONAL` (riel, histéresis, zócalo/chrome) |
| Surface ownership | `DECIDED` + gap de implementación bajo `PRIORITIZED_FOR_12D` |
| Rutas visible/contextual/experto | `DECIDED` + `PROVISIONAL` (piso del zócalo) + `DEFERRED` (marco direccional) |
| Continuity viewport/selection/evidence/state | `DECIDED` (T-INV-1…8) + `PROTOTYPE_VALIDATED` (CRI-11) + `PROVISIONAL` (bandPx) + `PRIORITIZED_FOR_12D` (máquina de estados) |
| Selection + Candidate Picker | `DECIDED` (D-06) + `PROTOTYPE_VALIDATED` (touch/teclado) + `DEFERRED` (marco direccional) |
| Results | `DECIDED` (D-03) + `VERIFIED` (proyección pura) + `UNKNOWN` no bloqueante (U-14) + `PRIORITIZED_FOR_12D` (descomposición) |
| Datasheet | `DECIDED` (D-11) + `VERIFIED` (feature) + `UNKNOWN`/`EXPERIMENTAL` (rendimiento, gate paralelo) |
| Model Doctor | `VERIFIED` + `PROTOTYPE_VALIDATED` (loop) |
| Command Palette | `VERIFIED` + `DECIDED` (orden, G-01) + `PROTOTYPE_VALIDATED` (fix accesibilidad) |
| Panel/inset/sheet/fullscreen | `DECIDED` (vocabulario cerrado + matriz) + `PRIORITIZED_FOR_12D` (implementación) |
| Accessibility interaction | `DECIDED` (11 contratos, D-14) + `PROTOTYPE_VALIDATED` (fix atajos) + `UNKNOWN` gate paralelo (ABIERTA-6) |
| Motion behavioral | `DECIDED + VERIFIED` (ya implementado, coincide con Brandbook) |

## 7. Confirmación de alcance de CRI-12B

- Único directorio creado o modificado: `reports/cri-12/**` (`02-ux-decision-matrix.md`, `02-ux-direction-record.md`, `02-rejected-and-deferred.md`, actualización de `HANDOFF.md`).
- Cero cambios en `src/**`, `brand/**`, `src/design-system/tokens.css`.
- No se ejecutó ningún gate (`verify:*`, `npm test`) ni suite de pruebas.
- No hubo prototipo nuevo, no hubo merge a `main`, no hubo publicación en GitHub Pages.
- Todas las 11 decisiones fueron tomadas por el propietario del producto en conversación directa, en bloques de 3–5 preguntas con opciones A/B/C(+recomendación), no inferidas ni decididas unilateralmente por el agente.
- **Fixup posterior de esta misma sesión** (sin reabrir ninguna de las 11 decisiones ni preguntar nada nuevo): corrige el fraseo de tres filas de la matriz que sugerían implementación/evaluación dentro de 12B (shell adaptativo, brechas D-07, migración `settings.show*`) — quedan como prioridad/pendiente técnico para `CRI-12D`; añade §7 (contratos finales autocontenidos exigidos por CRI-84, verificados por lectura directa de `reports/2026-08-15-0400-cri-9-arquitectura-interaccion-adaptativa.md` y de `tokens.css:565-577,805` — sólo lectura, cero escritura); actualiza `HANDOFF.md`.
