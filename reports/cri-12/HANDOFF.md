# CRI-12 · HANDOFF de ejecución

**Clasificación:** `AUDIT/TEMPORARY`

Este documento cierra CRI-12A: congela el baseline, no decide UX ni visuales. Lista las preguntas que sí requieren elección humana, con contexto suficiente para decidir sin releer todo lo anterior.

## Actualización final — CRI-12E cerrado (gate de cierre del programa)

CRI-12E (CRI-87) ejecuta el gate independiente de cierre exigido para que CRI-12 pueda pasar a `Done`. Ejecutado sobre HEAD `7f789824529c24e38543731c8ec3b7ecd7805d65` de esta rama (cierre de CRI-12D). Baseline de `main` reverificado al abrir la fase: `origin/main` = `7fb927fb6d118925e63365d1a2bb2813f8795385`, **sin drift** — idéntico al baseline congelado por CRI-12A y reconfirmado en las cuatro fases anteriores.

Se leyeron íntegros: CRI-12 padre, CRI-87 completa, el protocolo de ejecución atómica, este `HANDOFF.md`, los diez entregables 00→04, el épico CRI-88 y las 18 issues CRI-89…CRI-106 (no por resumen — cada una completa), y el documento *StructureCo — Backlog maestro y prioridad real*.

**Los 10 gates de CRI-87 pasan.** Detalle gate por gate, con evidencia y spot-checks contra `main`, en `05-closure-gate.md`. Resumen de los spot-checks que sostienen el veredicto: `tokens.css` confirma la paleta lima intacta (`--sc-lime-400:#89d448` sin cambios); `grep -rn CommandRegistry src/` confirma cero coincidencias, validando la corrección que CRI-12D ya había registrado; `scripts/protected-baseline.sha256` confirma cobertura exacta de `src/store/ProjectContext.tsx` y `src/types.ts`; `git diff origin/main..origin/research/cri-12-direction --stat` confirma 15 archivos / 2263 inserciones / 0 eliminaciones, el 100% dentro de `reports/cri-12/**`, sin commits de merge.

**Un fixup real, mínimo y localizado, aplicado en este mismo cierre**: CRI-87 exige verificar específicamente que el gap "Artifact download sandbox" de CRI-11 no quedó "mágicamente declarado resuelto". CRI-11 fase C (`reports/2026-08-16-cri-11-fase-c-validacion.md:310-314`) ya lo documentaba correctamente como *no* un bug de producto (el sandbox del visor de Artifact bloquea descargas iniciadas por la página; funciona clonando o sirviendo fuera del visor) — pero ninguna fase de CRI-12A/B/C/D lo mencionaba, ni resuelto ni diferido: estaba en silencio. Se añadió una fila a `01b-inherited-decisions.md` §C (owner correcto: CRI-12A, que es donde vive el inventario de gaps heredados de CRI-11) registrando su disposición explícita. No reabre ninguna decisión de producto ni toca ningún otro archivo.

**Índice de decisiones finales, sin duplicar contenido**: `05-final-decision-index.md`. **Backlog final ordenado, con clasificación READY/BLOCKED/PARALLEL_SAFE/DEFERRED y la primera issue ejecutable**: `05-ready-backlog.md`.

**Primera issue READY del programa: CRI-89** (resolutor de composición X2/M1/K0), sin `blockedBy`, raíz del camino crítico. Arrancan en paralelo, sin bloqueo formal entre sí: CRI-90 (materia SHEET/MODAL), CRI-91 (Brandbook renovado), CRI-92 (spike `settings.show*`) y CRI-93 (spike de rendimiento).

**Decisión menta/esmeralda**: sigue siendo `FUTURE_DEVIATION` aprobada por el propietario en CRI-12C — no implementación. Confirmado por spot-check de este gate: `brand/brandbook-clay.html` y `src/design-system/tokens.css` no cambiaron, la paleta vigente sigue siendo lima.

### Confirmación de alcance de CRI-12E

- Único directorio modificado: `reports/cri-12/**` — se crearon `05-closure-gate.md`, `05-final-decision-index.md`, `05-ready-backlog.md`, se aplicó el fixup en `01b-inherited-decisions.md` §C, y se actualizó este `HANDOFF.md` por última vez.
- **Cero cambios** en `src/**`, `brand/**`, `src/design-system/tokens.css`. Todo lo citado del código se verificó por lectura directa y con comandos de sólo lectura (`grep`, `git diff --stat`, `git log --merges`, `cat` sobre `protected-baseline.sha256`) — ningún gate (`verify:*`, `npm test`) se ejecutó, porque CRI-87 no lo exige y el mandato es auditar documentación y dependencias, no producto.
- No hubo prototipo nuevo, no hubo merge a `main`, no hubo publicación en GitHub Pages, no se refrescó `protected-baseline.sha256`.
- **No se cerraron issues en Linear.** Por instrucción explícita del propietario, el cierre en Linear (CRI-12A/B/C/D/E a `Done`, CRI-12 padre a `Done`, comentario final con SHA/decisiones/primera issue READY) queda pendiente de revisión independiente antes de ejecutarse.
- Instrucción de arranque para quien retome después de este cierre: si el propietario confirma el resultado de este gate, la siguiente acción es el cierre en Linear descrito en el criterio de cierre de CRI-87 — no una subtask nueva de CRI-12.

## Actualización — CRI-12D cerrado (backlog de implementación)

CRI-12D (CRI-86) convierte las decisiones de 12B y 12C en un **backlog de producción real en Linear**, ejecutable issue por issue en chats nuevos. Ejecutado sobre HEAD `6c4370cab9c7e6077f2eb3a2b585cba8005e270a` de esta rama. Baseline de `main` reverificado al abrir la fase: `origin/main` = `7fb927fb6d118925e63365d1a2bb2813f8795385`, **sin drift**.

Cuatro documentos nuevos:

- `04-implementation-roadmap.md` — qué se verificó en `main` antes de ordenar nada, la estructura del backlog, el orden por capas con sus **cuatro desviaciones justificadas** respecto al orden tentativo de CRI-86, la cobertura del encargo, el detalle de la issue del Brandbook, y qué **no** se creó (con su fuente de decisión).
- `04-dependency-map.md` — dependencias `HARD` / `SOFT` / `PARALLEL` con razón y riesgo de ejecutar fuera de orden, grafo, qué corre en paralelo, camino crítico y puntos de contención de archivo.
- `04-migration-strategy.md` — sustitución incremental sin big-bang, qué migra junto, coexistencia acotada, inventario completo de las siete claves persistidas + IndexedDB con su destino, continuidad de undo/selección/borradores/foco, cómo se evita la divergencia Compact/Expanded, rollback por slice y política de gates focales.
- `04-implementation-risk-register.md` — 32 riesgos con probabilidad, impacto, **detección**, mitigación e issue dueña.

**Backlog creado: 19 issues reales en Linear.** Épico **CRI-88** (hijo de CRI-6, no de CRI-12: la implementación no cuelga de los registros de investigación) + **18 slices**, CRI-89…CRI-106, cada uno con objetivo visible, baseline a revalidar, alcance/fuera de alcance, contratos protegidos, dependencias, archivos orientativos, riesgos, criterios observables, QA Expanded/Medium/Compact + mouse/teclado/touch + Día/Noche + ES/EN + focus/reduced-motion, gates focales, rollout, rollback y evidencia exigida. CRI-86 bloquea CRI-88; CRI-88 bloquea CRI-87.

**Primera issue READY del camino crítico: CRI-89** (resolutor de composición X2/M1/K0). Arrancan también sin bloqueo, en paralelo: CRI-90 (materia `SHEET`/`MODAL`), **CRI-91 (Brandbook renovado)**, CRI-92 y CRI-93 (spikes).

**La issue del Brandbook (CRI-91) se adelantó al arranque**, frente al puesto 13 del orden tentativo de CRI-86. Razón: `brand/**` + `tokens.css` + Component Lab son disjuntos de `src/features/**`, así que no bloquea la fundación; y dejarla al final obligaría a someter cada slice de UI dos veces al QA de Día/Noche y contraste — una sobre lima y otra sobre menta. Actualiza el **Brandbook canónico en su sitio**: no crea un "Brandbook v2" ni un sistema visual paralelo.

**Corrección de hecho descubierta al verificar `main`:** §6.9 de `02-ux-direction-record.md` marca como `VERIFIED` que la Command Palette *"ejecuta comandos del mismo `CommandRegistry` que los botones visibles"*. **No existe ningún `CommandRegistry` en `src/**`**: `CommandPalette.tsx` construye su propia lista en línea; lo compartido es `TOOL_REGISTRY` (sólo herramientas) y el bus tipado `workspaceCommands.ts` (sin etiqueta, atajo ni estado de habilitado). La coherencia de hoy es por convención, no por construcción. CRI-103 **crea** el registro; no lo cablea. Queda registrado en la propia issue y en §0 del roadmap.

**Hecho del repositorio que gobierna una dependencia:** `scripts/protected-baseline.sha256` cubre `src/store/ProjectContext.tsx` y `src/types.ts`. Como los ocho campos `settings.show*` viven en `ProjectSettings` dentro de `src/types.ts`, la superficie `view` de D-10 no se puede especificar sin el veredicto de la evaluación — por eso **CRI-92 bloquea de forma dura a CRI-99**. Es el único bloqueo del backlog que nace de un gate del repositorio y no de una decisión de diseño.

**No apareció ninguna decisión de producto no cerrada que impidiera crear una issue correcta**, así que no hubo nada que preguntar al propietario. Cada ítem abierto tenía disposición explícita: `settings.show*` → issue de evaluación, no de migración; serif → excluido explícitamente; LEDGER-05 → orden ya fijado, asignado a CRI-106; ABIERTA-1/4/6/7 y U-11 → gates o valores provisionales marcados como tales. La duda sobre Welcome vs ProjectHub se resolvió **verificando código**: el hub vive dentro de Welcome, no compite con él. La única elección genuina de esta fase era el **orden**, y CRI-86 §A la delega explícitamente en CRI-12D.

## Actualización — CRI-12C cerrado (dirección visual)

Las preguntas **12, 13, 14 y 15** de la sección "Preguntas para CRI-12C" de abajo están **cerradas**, decididas por el propietario del producto en conversación directa (bloques de ≤3 preguntas, opciones + recomendación explícita), sobre HEAD `066eaa1ee8dc11ad8b787ddb43ef6d6a5e5a1744` de esta rama. Baseline de `main` reverificado: `7fb927fb6d118925e63365d1a2bb2813f8795385`, **sin drift**.

Cuatro documentos nuevos:

- `03-visual-direction-record.md` — narrativa de cierre: V-01…V-14 (carácter visual, regla Clay/plano, gramática de superficies, intensidad Clay, radios, tipografía, identidad cromática, colores técnicos, Día/Noche, Results, Welcome, iconografía, motion, accesibilidad visual), gobierno board-por-board del PDF de referencias, invariantes protegidos confirmados y frontera con CRI-12D.
- `03-surface-grammar.md` — `BASE`/`INSET`/`RAISED`/`FLOATING`/`SHEET`/`MODAL`, su correspondencia con el vocabulario de presentación de CRI-9/12B (**son ejes distintos**, con tres nombres que colisionan), reglas transversales, radios y motion por nivel, y estado de implementación en `material.css`.
- `03-color-decision.md` — menta/esmeralda vs lima decidido, reasignación de cortante y línea de influencia, gate de medición obligatorio, Día/Noche, y las 7 desviaciones futuras del Brandbook.
- `03-do-dont.md` — siete pares con casos concretos: Clay vs neumorfismo, shell elevado vs dato plano, pressed vs glow, color semántico vs decorativo, card útil vs cardification, densidad vs saturación, coherencia Día/Noche.

**Decisión de identidad cromática (pregunta 12): gana menta/esmeralda.** Manda identidad y acción primaria. La lima no se retira del sistema: por decisión explícita del propietario pasa a ser el color técnico de **cortante (V)**, y la **línea de influencia** pasa a un rosa/fucsia pastel con canto medido y trazo siempre discontinuo. Todo es **desviación futura**: `brand/**` y `tokens.css` no se tocaron, y nada entra en implementación sin el gate de medición de `03-color-decision.md` §4.

**Qué NO se cerró en 12C, a propósito:** la decisión de tipografía serif quedó **abierta sin acotar** (es una pregunta futura registrada, no una decisión); LEDGER-05 y ABIERTA-6 siguen siendo gates abiertos; y llevar tarjetas al Datasheet y a las tablas densas quedó registrado como **petición hacia CRI-12D**, no como decisión, porque reabre arquitectura cerrada (D-11, D-03).

## Actualización — CRI-12B cerrado

Las 11 preguntas de la sección "Preguntas para CRI-12B" de abajo están **cerradas**, decididas por el propietario del producto en conversación directa (bloques de 3–5, opciones A/B/C + recomendación), sobre HEAD `05f250ec443af7c35e5890ccaceee8da4fa16993` de esta rama. Detalle completo:

- `02-ux-decision-matrix.md` — las 11 decisiones, fila por fila, con evidencia y riesgo de revisión.
- `02-ux-direction-record.md` — narrativa de cierre, invariantes protegidos confirmados intactos, §6 con el resumen autocontenido de contratos finales exigidos por CRI-84 (Expanded/Medium/Compact, surface ownership, rutas visible/contextual/experto, continuity, selección + Candidate Picker, Results, Datasheet, Model Doctor, Command Palette, panel/inset/sheet/fullscreen, accesibilidad, motion), frontera con CRI-12C.
- `02-rejected-and-deferred.md` — qué se rechazó (Esencial/Completa), qué se difirió (marco de selección direccional), qué quedó asignado como pendiente técnico prioritario a **CRI-12D** (evaluación de impacto de `settings.show*`), qué prioridad de implementación se fijó para **CRI-12D** (shell adaptativo, brechas táctiles D-07) y los unknowns que persisten aunque la política ya esté cerrada (riel Medium, histéresis del resolver, zócalo Compact, discoverability, verificaciones técnicas).

Cada pregunta 1–11 de abajo se marca `[CERRADA → 02-ux-decision-matrix.md #N]` para navegar directo a su fila. El texto original de las preguntas se conserva sin editar, por fidelidad histórica de este documento de CRI-12A.

## Qué es CRI-12D (introducido en el fixup de cierre de 12B)

**CRI-12B no implementa producción, no ejecuta evaluaciones de impacto y no secuencia trabajo de ingeniería** — sólo fija dirección de producto y, en tres temas, **prioridad**. Esa prioridad necesita una fase que la convierta en backlog real: **CRI-12D** es esa fase de implementación/evaluación técnica, distinta de CRI-12C (que cierra identidad visual). Tres ítems de la matriz quedan explícitamente asignados a CRI-12D, no a 12B:

- Shell adaptativo (X2/M1/K0) — prioridad de implementación fijada (`02-ux-decision-matrix.md` #3).
- Brechas de paridad táctil D-07 (SEL-02, SEL-03, MOD-13, DAT-06, MOD-12) — prioridad/secuencia fijada (`02-ux-decision-matrix.md` #10).
- Evaluación de impacto de sacar `settings.show*` del schema (ABIERTA-8/U-12) — pendiente técnico prioritario asignado (`02-ux-decision-matrix.md` #9).

**CRI-12C puede empezar sin depender de ninguno de estos tres** — son trabajo de implementación/evaluación en paralelo, no bloqueantes de la dirección visual (color, Clay, tratamiento del portal de Welcome). Ninguno estaba genuinamente "hecho en 12B"; el fraseo original de este documento y de los tres reportes de cierre lo decía así por error de encargo y se corrigió en el mismo commit que añadió esta nota. **Confirmado a posteriori:** CRI-12C se ejecutó y cerró sin que ninguno de los tres estuviera resuelto.

### Qué le añade CRI-12C al encargo de CRI-12D

CRI-12D puede crear tareas de implementación visual a partir de `03-visual-direction-record.md` **sin reinterpretar el diseño**. Se suma a los tres ítems de arriba:

- **Gate de medición cromática** (`03-color-decision.md` §4) — condición de entrada de cualquier tarea de color: suelos sobre los cuatro fondos, separaciones obligatorias de los tríos nuevos (marca/cortante/éxito y influencia/Aula/momento) verificadas también en escala de grises y con deficiencia de color, invariancia Día/Noche intacta y `tokens.test.ts` sin relajar. Su salida son los HEX; CRI-12C deliberadamente no fija ninguno.
- **Formalizar `SHEET` y `MODAL`** como niveles de `data-level` en `material.css`, y ampliar la lista de selectores de `BASE` a las zonas técnicas densas que hoy no lo declaran (`03-surface-grammar.md` §7). Es formalización, no decisión.
- **Alinear radios a la escala del Brandbook** según el reparto por rol de V-05 — sigue siendo LEDGER-01, sin desviación nueva.

Y lo que CRI-12D **no** puede hacer sin volver a preguntar: aplicar un HEX nuevo sin el gate; decidir el serif (abierta, no decidida); convertir Datasheet o tablas densas en tarjetas (petición registrada, reabre D-11/D-03); mover un color técnico distinto de los dos que 12C nombra.

## Frontera 12B/12C — confirmada por CRI-84/CRI-85

CRI-84 define formalmente 12B como el cierre de arquitectura UX/interacción; CRI-85 define 12C como el cierre de dirección visual/Clay/identidad. La frontera no es una lectura operativa de este documento: es la definición formal del programa.

- **12B (CRI-84)** = decisiones de arquitectura funcional/UX no visuales: navegación, ubicación de funciones, gobierno de discoverability, validación de hipótesis de producto (Esencial/Completa), verificaciones técnicas pendientes (rendimiento, accesibilidad, multi-navegador).
- **12C (CRI-85)** = el cierre de dirección visual: no se limita a ejecutar dentro del Brandbook vigente sin tocarlo — incluye comparar explícitamente mantener la paleta lima vigente vs recuperar la familia menta/esmeralda histórica de identidad, decidir el tratamiento del portal de Welcome, la remedición de contraste y la aplicación concreta de Clay, y puede decidir una modificación futura explícita del propio Brandbook si el resultado de esa comparación lo requiere.

La separación VERIFIED/DECIDED/UNKNOWN de `01-evidence-matrix.md` no depende de este corte y sigue siendo válida.

## Preguntas para CRI-12B (funcional / no visual)

1. **Esencial/Completa**: ¿se valida la hipótesis (con estudio real, conectada a preferencia persistente) y se implementa, o se descarta por falta de sustento? Hoy no existe en `src/**`; CRI-10 mismo la marca como hipótesis no aprobada. `[CERRADA → 02-ux-decision-matrix.md #1 — Descartar]`
2. **Flujo de Welcome**: ¿se adopta el flujo de hoja tipo iOS (Bienvenida→Cómo trabajas→Por dónde→Mesa, con salto directo a la Mesa para usuarios que regresan) propuesto por CRI-10, se itera, o se descarta? Las transiciones están descritas, no animadas ni implementadas; nada de esto está aprobado. `[CERRADA → 02-ux-decision-matrix.md #2 — Adoptar estructura de 4 pasos]`
3. **Implementación del adaptive shell**: la arquitectura X2/M1/K0 (CB-1..6, D-01/D-04/D-05) ya está decidida y cerrada; producción hoy sólo tiene un booleano de riel compacto. ¿Se prioriza su implementación, o queda para después de otras decisiones? `[CERRADA → 02-ux-decision-matrix.md #3 — Prioridad fijada para CRI-12D]`
4. **Riel sólo-icono en Medium (ABIERTA-1)**: ¿perjudica discoverability? Requiere tarea cronometrada, riel etiquetado vs icono, antes de dar por bueno el M1 actual. `[CERRADA → 02-ux-decision-matrix.md #5 — Mantener icon-only, provisional]`
5. **Marco de selección direccional (ABIERTA-3)**: adición propuesta, no decidida. ¿Se incorpora al contrato D-06, se descarta? `[CERRADA → 02-ux-decision-matrix.md #4 — Diferir]`
6. **Presupuesto de verbos en zócalo Compact apaisado (ABIERTA-4)** y **presupuesto de 6 controles con contenido real (GAP-1)**: pendientes de medir sobre 7 tipos de selección × 2 idiomas antes de fijar el diseño del zócalo Compact. `[CERRADA → 02-ux-decision-matrix.md #7 — Piso conservador fijado, provisional]`
7. **8 escenarios de discoverability**: diseñados, no ejecutados. Sin esto no hay dato de abandono/tiempo que respalde ninguna decisión de descubribilidad. `[CERRADA → 02-ux-decision-matrix.md #8 — Aceptar riesgo y avanzar]`
8. **Umbral de histéresis del resolver (ABIERTA-2/U-13)**: CRI-11 midió 3 recomposiciones estables en el rango probado, pero su propio reporte dice que la medición no discrimina si el bandPx importa. ¿Se necesita otra medición, o se fija un valor y se avanza? `[CERRADA → 02-ux-decision-matrix.md #6 — bandPx = 24]`
9. **Costo de sacar `settings.show*` del schema (ABIERTA-8/U-12)**: marcado como el mayor riesgo adyacente a schema de todo CRI-9. Necesita evaluación de impacto antes de decidir si se migra. `[CERRADA → 02-ux-decision-matrix.md #9 — Pendiente técnico prioritario asignado a CRI-12D, migración aún sin decidir]`
10. **Verificaciones técnicas pendientes, sin decisión de producto pero bloqueantes para cerrar sus temas**: contraste medido a nivel de píxel + lectores de pantalla reales (ABIERTA-6); rendimiento de Datasheet/paleta con ~2000 entidades en dispositivo real, no sólo en el harness aislado (ABIERTA-7); disponibilidad de `navigator.clipboard.readText()` en la matriz real de navegadores (U-11); matriz multi-navegador completa (sólo Chromium se probó en CRI-11). `[CERRADA → 02-ux-decision-matrix.md #11 — Gate paralelo, no bloqueante]`
11. **Brechas de implementación de D-07 (paridad táctil)**: `SEL-02`, `SEL-03`, `MOD-13`, `DAT-06`, `MOD-12` tienen arquitectura de cierre decidida (superficie `contextual-actions` + submodo de marco de selección + affordance de pegar) pero cero implementación. ¿Se secuencian? `[CERRADA → 02-ux-decision-matrix.md #10 — Prioridad/secuencia fijada para CRI-12D]`

## Preguntas para CRI-12C (cierre de dirección visual)

Las cuatro están **cerradas**. Igual que con las preguntas 1–11, el texto original se conserva sin editar por fidelidad histórica de este documento de CRI-12A; el marcador `[CERRADA → …]` al final de cada una lleva a su registro.

12. **Lima vs menta/esmeralda histórica (tema 19 de la matriz de evidencia)**: `main`, el Brandbook y `tokens.css` usan hoy, de forma verificada, la paleta lima única cerrada por los commits `74dfc76`/`f60eae5` (que descartaron en bloque los tres verdes en conflicto — `#159a72`, `#00795f`, `#157A55` — a favor de `#89d448`). Eso es un hecho del estado vigente, no una decisión que CRI-12A pueda dejar fuera de revisión. CRI-12C debe comparar **explícitamente** mantener lima vigente vs recuperar **exclusivamente** la familia menta/esmeralda histórica de identidad (la familia teal/esmeralda que existía antes de ese cierre, no una paleta nueva). Si gana menta/esmeralda, es una decisión de producto **futura**: no implica que ya esté implementada, y no autoriza por sí sola tocar los colores técnicos de dominio (N/axial, V/cortante, M/momento, deformada, warning, error, selección, foco, reacción) — esos permanecen separados de la identidad de marca en `tokens.css` y su eventual revisión seguiría su propio proceso. `[CERRADA → 03-color-decision.md — gana MENTA/ESMERALDA. El propietario decidió además reasignar la lima a cortante (V) y la línea de influencia a rosa/fucsia pastel; ambas son desviaciones futuras con gate de medición, no implementación]`
13. **Tratamiento visual del portal de Welcome**: el "material clay" vía filtros SVG (grano feTurbulence, caída por cara, oclusión ambiental, luz de borde) propuesto en la 3ª pasada de CRI-10 — explícitamente rechaza un motor 3D real. ¿Se aprueba esta dirección visual, se ajusta, o se descarta? `[CERRADA → 03-visual-direction-record.md V-11 — aprobado con alcance recortado: sólo la pieza ilustrativa, nunca superficies de interfaz, no es motor 3D, y degrada a relleno plano sin filtros o bajo reduced-motion/reduced-transparency. Derivada de la decisión de Welcome (marca presente, proyectos primero), no preguntada por separado]`
14. **Remedición de contraste del pórtico en modo Noche (LEDGER-05)**: documentado pero no cambiado sin remedir — ejecutar la medición y decidir si requiere ajuste. `[SIGUE ABIERTA → 03-color-decision.md §5 — CRI-12C no ejecutó la medición. Se añade una condición de orden: debe medirse DESPUÉS de fijar los HEX nuevos, porque la menta cambia el fondo contra el que se mide el pórtico]`
15. **Placa técnica ilustrativa "IPE-240 · A992" en Welcome**: CRI-10 ya fija la regla — si en implementación pasa a leer datos reales, tiene que leerlos de verdad o no mostrarse. No es una decisión nueva, es una restricción a respetar si se implementa el Welcome propuesto. `[CONFIRMADA sin cambio → 03-visual-direction-record.md V-11]`

## Corrección de gobierno de datos recomendada (no es una decisión de producto)

`reports/evidence/2026-08-15-cri-10-ux-system/competitive-research.md` se investigó como si fuera únicamente REFERENCE de materialidad, pero su contenido real hace afirmaciones funcionales y de navegación explícitas (arquitectura de menú contextual dirigida por selección, tamaño de objetivo táctil, un único estado de selección compartido entre canvas/Inspector/Datasheet/Results/Model Doctor, criterios de disclosure progresivo). Esto excede el marco que el encargo fija para las referencias visuales ("no prueban ni deciden navegación, acomodo de botones, funciones, claims"). Las decisiones D-03/D-06/D-07/D-09/D-11/D-12 de CRI-9 citan esta matriz como insumo pero afirman explícitamente que *"ninguna decisión de este informe depende de un matiz literal de esas fuentes"* — así que las decisiones en sí quedan grounded en el presupuesto de canvas y el razonamiento propio de CRI-9, no en mimetismo de competidores. Recomendación para quien retome CRI-12B/C: tratar `competitive-research.md` como REFERENCE estricto de aquí en adelante y no usar sus recomendaciones funcionales como si fueran validación independiente.

## Corrección técnica de bajo riesgo (no es una decisión de diseño)

`.canvas-layer-switch` está declarado de forma inconsistente entre `src/styles.css:2161` y `:3677`. CRI-10 lo señaló como el único cambio de `src/**` que recomienda, deliberadamente sin ejecutar. Es candidato de arreglo mecánico, no de UX — puede resolverse en 12B sin abrir ninguna pregunta de producto.

## Invariantes protegidos (recordatorio, detalle en `01b-inherited-decisions.md` §E)

`success ≠ reliable ≠ safe` · stale fail-closed · canvas-first · 2D/3D separados · Space3D experimental (D-15 congelado) · Aula fuera de alcance · mismo analysis, no segundo solver · `materialId`/`sectionId` explícitos, nunca inferidos por floats · colores técnicos por significado (N/axial, V/cortante, M/momento, deformada, warning, error, selección, foco, reacción — separados de la identidad de marca) · Brandbook vigente como autoridad visual mientras no se decida lo contrario en su propio proceso.

La identidad de color de marca (lima vs menta/esmeralda) **no** es un invariante protegido en este listado: es `VERIFIED_CURRENT` (estado vigente) y `MUST_DECIDE_IN_12C` (pregunta 12, arriba) — CRI-12A verifica que hoy es lima, sin cerrarlo a revisión.

> **Actualización tras CRI-12C:** la pregunta 12 está cerrada a favor de **menta/esmeralda**. Eso no altera ningún invariante de la lista de arriba: el Brandbook sigue siendo la autoridad visual **como mecanismo** (`brand/**` no se modificó en 12C), los colores técnicos siguen separados de la identidad de marca, y los dos roles técnicos que sí se reasignan — cortante (V) a la familia lima, línea de influencia a rosa/fucsia pastel — lo hacen por decisión explícita del propietario, con gate de medición obligatorio y sin implementación. `success ≠ reliable ≠ safe` sale reforzado, no tocado: `03-visual-direction-record.md` V-02/V-10 y `03-do-dont.md` §5 prohíben explícitamente que la profundidad, el color verde o una tarjeta elevada afirmen seguridad o cumplimiento.

## Confirmación de alcance de CRI-12A

- Único directorio creado o modificado: `reports/cri-12/**` (`00-input-manifest.md`, `01-evidence-matrix.md`, `01b-inherited-decisions.md`, `HANDOFF.md`).
- Cero cambios en `src/**`, `brand/**`, `src/design-system/tokens.css`.
- No se ejecutó ninguna suite de pruebas masiva; las pruebas citadas se verificaron por lectura de código, no por corrida.
- No hubo merge a `main`, no hubo publicación en GitHub Pages.
- No se decidió menta/lima ni ningún otro color en CRI-12A — se verificó que lima es el estado vigente de `main` (`VERIFIED_CURRENT`) y se dejó explícitamente como `MUST_DECIDE_IN_12C` la comparación con la familia menta/esmeralda histórica (§D de `01b-inherited-decisions.md`, pregunta 12 arriba).
- No se prototipó ni se diseñó nada nuevo — todo lo citado como `PROTOTYPE_VALIDATED` proviene de `d2a4dbfa20c08f1e22206619ee4291794555546a`, ya congelado, no ampliado aquí.

## Confirmación de alcance de CRI-12D

- Único directorio creado o modificado: `reports/cri-12/**` (`04-implementation-roadmap.md`, `04-dependency-map.md`, `04-migration-strategy.md`, `04-implementation-risk-register.md`, actualización de este `HANDOFF.md`).
- Cero cambios en `src/**`, `brand/**`, `src/design-system/tokens.css` y Component Lab. Todo lo citado del código se verificó **por lectura directa** sobre `origin/main` = `7fb927fb`, no por corrida.
- No se ejecutó ningún gate (`verify:*`, `npm test`) ni suite de pruebas.
- No se implementó **ninguna** issue del backlog. No hubo prototipo, no hubo merge a `main`, no hubo publicación en GitHub Pages.
- Se crearon 19 issues reales en Linear (CRI-88 + CRI-89…CRI-106), con prioridad razonada, padre correcto, `blockedBy`/`blocks` explícitos, labels y descripción autocontenida.
- Ninguna issue reabre UX ni dirección visual: 12B y 12C siguen cerrados. Lo rechazado sigue rechazado (Esencial/Completa **no** tiene issue), lo diferido sigue diferido (marco de selección direccional), y las peticiones abiertas siguen sin ejecutarse (tarjetas en Datasheet/tablas densas, serif editorial).
- Los P0 del *Backlog maestro* se verificaron **Done** en Linear (CRI-13, CRI-20, CRI-33, CRI-34, CRI-54) antes de ordenar trabajo, según exige el START de CRI-86.

## Confirmación de alcance de CRI-12C

- Único directorio creado o modificado: `reports/cri-12/**` (`03-visual-direction-record.md`, `03-surface-grammar.md`, `03-color-decision.md`, `03-do-dont.md`, actualización de este `HANDOFF.md`).
- Cero cambios en `src/**`, `brand/**`, `src/design-system/tokens.css`. El Brandbook y los tokens se leyeron íntegros; no se escribió en ellos.
- No se ejecutó ningún gate (`verify:*`, `npm test`) ni suite de pruebas; todo lo citado de `src/**` y del Brandbook se verificó por lectura directa.
- No hubo prototipo nuevo, no hubo merge a `main`, no hubo publicación en GitHub Pages.
- Baseline de `main` reverificado al abrir la fase: `origin/main` = `7fb927fb6d118925e63365d1a2bb2813f8795385`, **drift ninguno**.
- Las decisiones de propietario se tomaron en conversación directa, en bloques de ≤3 preguntas con opciones y recomendación explícita: identidad cromática, intensidad Clay, tipografía, reasignación de cortante y de la línea de influencia, Día/Noche, Results y Welcome. Ninguna se infirió. Las marcadas `DERIVADA` en `03-visual-direction-record.md` (radios, iconografía, motion, accesibilidad visual, tratamiento del portal) se dedujeron del Brandbook + CRI-12B + esas decisiones, y se señalan como tales.
- El PDF `StructureCo_CRI12C_referencias_visuales.pdf` se trató estrictamente como `REFERENCE`. `03-visual-direction-record.md` §1 registra board por board qué se transformó en principio y qué se descartó, incluidas sus dos contradicciones internas (tipografía y cortante = verde de marca), resueltas a favor del canon.
- No se implementó ningún color. Todos los cambios cromáticos son `FUTURE_DEVIATION` con gate de medición; ningún HEX nuevo se fija en esta fase.
