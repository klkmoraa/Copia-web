# CRI-12A · Decisiones heredadas de CRI-7→CRI-11

**Clasificación:** `AUDIT/TEMPORARY`

Este documento fija qué ya está **decidido y no debe reabrirse** en CRI-12, y qué sigue **explícitamente abierto** y se hereda como trabajo, no como pregunta nueva. Es el inventario de continuidad entre CRI-9/CRI-10 y CRI-12; las preguntas que sí requieren elección humana están en `HANDOFF.md`, no aquí.

## A. Decisiones cerradas — registro D-01…D-15 (CRI-9)

Fuente: `reports/2026-08-15-0400-cri-9-arquitectura-interaccion-adaptativa.md` + `reports/evidence/2026-08-15-cri-9-adaptive-architecture/cri-9-decision-register.csv`. 14 de 15 decididas, 1 diferida.

| ID | Decisión cerrada | Disposición |
|---|---|---|
| D-01 | Medium es la salida de un presupuesto de canvas (CB-1..6), no un breakpoint de ancho. Frontera calculada 1042–1130px según altura. | DECIDED |
| D-02 | Inspector se divide en `detail`/`analysis-setup`/`view` por dueño, contextual a selección en las tres clases. | DECIDED |
| D-03 | Results deja de ser un panel; se reparte en `topbar`/`view`/`detail`/`dense`. Ninguna superficie de resultados es residente en ninguna clase. | DECIDED (con U-14 abierto, ver §C) |
| D-04 | El resolver calcula la asignación por defecto; las preferencias del usuario son "intenciones" (`dockIntent`) honradas o degradadas con aviso, nunca violadas. | DECIDED |
| D-05 | Un solo módulo puede leer `matchMedia` ("sensor de entorno"); el contenedor decide layout interno sólo por container queries; el input decide affordances, nunca presencia. | DECIDED |
| D-06 | Contrato de selección táctil precisa de 5 fases: candidatos→preview→elegir/ciclar→confirmar→cancelar. | DECIDED |
| D-07 | Todo task necesita ruta {puntero+teclado} y ruta {táctil}; 5 brechas se cierran vía superficie `contextual-actions` + sub-modo de marco de selección + affordance de pegar. | DECIDED |
| D-08 | Nueva superficie `recovery`; localStorage=sesión viva, IndexedDB=biblioteca, conflicto nunca se autoresuelve. | DECIDED |
| D-09 | El menú "Más" se vuelve una regla (overflow filtrado por contexto), no un menú fijo; ningún task vive *sólo* en overflow. | DECIDED |
| D-10 | Modelo único de visibilidad de canvas; dueño `view` fuera de `ProjectModel`; `settings.show*` planeado para salir del schema (ver ABIERTA-8/U-12). | DECIDED |
| D-11 | Datasheet es modal y coordinado, vía la misma regla de presentación; localizar degrada a `peek`, nunca cierra. | DECIDED |
| D-12 | Un solo view-model/tipo de intención de edición, 3 presentaciones, 2 cardinalidades; retira duplicación de presentación, mantiene duplicación de tarea. | DECIDED |
| D-13 | Contrato draft→preview→apply ya existe en código con 2 niveles de conformidad; se unifica el ciclo de vida de UI (`DraftLifecycle`), no la implementación interna. | DECIDED |
| D-14 | Explicación accesible de estados críticos/deshabilitados vía elemento enfocable ("qué/por qué/qué hacer"), nunca sólo `title`/hover. | DECIDED |
| D-15 | Space 3D permanece separado y experimental; NO adopta el sistema de composición; sólo dos contratos neutrales (resolución de tema única, mínimos de entrada de proyecto). | **DEFERRED — congelado, no decidir en CRI-12** |
| G-01 | Ctrl+Z/Ctrl+Y anunciados sin handler: no se retira la promesa, se acota a no disparar en campos de texto/grilla/modal con historial propio. | DECIDED — implementar más adelante |
| G-02 | `resultTab:'issues'` se elimina del tipo; un análisis fallido es estado+ruta a Model Doctor, no una pestaña. | DECIDED — quitar del tipo |
| F-11 | Cuál de los tres verdes de marca gana — era la única decisión de propietario pendiente. | **Implementada como lima por el cierre cromático posterior** (ver §D) — es el estado vigente de `main`, no una decisión cerrada a revisión. CRI-12C debe comparar explícitamente mantener lima vs recuperar la familia menta/esmeralda histórica; ver `HANDOFF.md`. |

Ninguna de D-01…D-14, G-01, G-02 se re-decide en CRI-12A/B/C. Lo que falta es **ejecución** (implementarlas en `src/**`), no elección. F-11 es la excepción: su implementación actual (lima) es un hecho verificado, pero la elección de identidad de color en sí queda explícitamente abierta a CRI-12C (ver §D).

## B. Disposiciones cerradas del ledger — LEDGER-01…09 (CRI-10)

Fuente: `reports/2026-08-15-0730-cri-10-sistema-ux-ui.md` §20.2. *"Ninguna de estas nueve es una disyuntiva de autoridad… las nueve tienen disposición cerrada — ninguna espera ya decisión del propietario."*

| ID | Desviación | Severidad | Disposición |
|---|---|---|---|
| LEDGER-01 | Radios fuera de la escala 6/8/13/18/26 del Brandbook | Media | Cerrado — alinear a la escala al implementar |
| LEDGER-02 | Ancho del anillo de foco | Baja | Cerrado |
| LEDGER-03 | Piso de tipografía de captions (valores de solver en 10px) | Alta | Cerrado — corregir al implementar |
| LEDGER-04 | Falta el patrón de tema de 3 estados (claro/oscuro/sistema vía `@media`) | Media | Cerrado — añadir bloque `@media` + tercer estado en UI |
| LEDGER-05 | Hex de fondo nocturno no coincide con lo medido | Baja | Cerrado — *"se documenta, no se cambia sin volver a medir"* |
| LEDGER-06 | Target táctil 44px vs 48px recomendado por Brandbook | Baja | Cerrado |
| LEDGER-07 | Aviso de responsabilidad legal, banda dedicada | — | **Cerrado — decisión aprobada**: pasa a un `ⓘ` enfocable y expandible dentro de la Cinta. No es afirmación de cumplimiento legal ni cambio del contenido del aviso. Sustituye a ABIERTA-5. |
| LEDGER-08 | `.tool-button.active` con clase legacy no conectada al patrón correcto | Media | Cerrado |
| LEDGER-09 | Grosor de trazo de iconos 1.8 vs 2.0 (default de lucide) | Baja | Cerrado |

Estas nueve son correcciones de implementación con dirección ya fijada — candidatas de ejecución de bajo riesgo para quien implemente, no preguntas para CRI-12B/C.

## C. Abierto y heredado — no se decide en CRI-12A, pasa como trabajo/pregunta

| ID | Origen | Estado | Destino |
|---|---|---|---|
| ABIERTA-1 | CRI-10 | ¿El riel sólo-icono en Medium perjudica discoverability? Necesita tarea cronometrada, riel etiquetado vs icono. | `HANDOFF.md` → 12B |
| ABIERTA-2 / U-13 | CRI-10 / CRI-9 | Umbral de histéresis del resolver (banda 900–1300px). CRI-11 lo midió (3 recomposiciones estables en 4 anchos de banda) pero no concluyó si importa: *"la medición está hecha, la interpretación fuerte no."* | `HANDOFF.md` → 12B |
| ABIERTA-3 | CRI-10 | Marco de selección direccional — *"es una adición propuesta, no decidida"*, necesita test de discoverability. | `HANDOFF.md` → 12B |
| ABIERTA-4 | CRI-10 | Cuántos verbos primarios caben en el zócalo Compact apaisado — medición pendiente sobre 7 tipos de selección × 2 idiomas. | `HANDOFF.md` → 12B |
| ABIERTA-6 | CRI-10 | Contraste medido a nivel de píxel + pase real con lectores de pantalla. *"Debe hacerse antes de considerar cerrada la accesibilidad."* | `HANDOFF.md` → 12B |
| ABIERTA-7 / U-07 | CRI-10 / CRI-8-9 | Rendimiento del Datasheet/paleta con modelos grandes (~2000 entidades) sin medir en producción. | `HANDOFF.md` → 12B (verificación técnica) |
| ABIERTA-8 / U-12 | CRI-10 / CRI-9 | Costo de sacar `settings.show*` del schema de `ProjectSettings` — *"el mayor riesgo adyacente a schema de todo CRI-9"*. | `HANDOFF.md` → 12B |
| GAP-1 | CRI-10 | Presupuesto de chrome de 6 controles en Compact apaisado con contenido real — argumentado, no medido. | `HANDOFF.md` → 12B |
| Hipótesis Esencial/Completa | CRI-10 | No validada, no conectada a preferencia persistente, no implementada en `src/**`. | `HANDOFF.md` → 12B (ver tema 11 de la matriz) |
| 8 escenarios de discoverability | CRI-10 | Diseñados, no ejecutados — *"no existe ningún tiempo ni tasa de abandono todavía"*. | `HANDOFF.md` → 12B |
| U-01 | CRI-8/9 | Sin telemetría; 86/122 frecuencias de uso son inferidas, no medidas. No bloqueante (la presencia se decide por dueño+presupuesto, no por uso). | Informativo, sin acción obligatoria |
| U-11 | CRI-9 | Disponibilidad de `navigator.clipboard.readText()` en la matriz real de navegadores, sin probar. | `HANDOFF.md` → 12B (verificación técnica) |
| U-14 | CRI-9 (corregido) | Compatibilidad de Aula con Results no-residente — *diferido explícitamente, no es tarea de CRI-11 ni de CRI-12; Aula sigue fuera de alcance.* | Sin acción en CRI-12 — ver §E |
| .canvas-layer-switch | CRI-10 (reconciliación Clay) | Inconsistencia `styles.css:2161` vs `:3677`, único cambio de `src/**` que CRI-10 recomienda y deliberadamente no ejecutó. | `HANDOFF.md` (corrección técnica de bajo riesgo, no decisión de diseño) |
| Multi-browser | CRI-11 | Sólo Chromium probado en las tres fases; Firefox/WebKit no instalados en el entorno del prototipo. | `HANDOFF.md` → 12B (verificación técnica) |
| Artifact download sandbox | CRI-11 fase C (`reports/2026-08-16-cri-11-fase-c-validacion.md:310-314`) | El botón "Descargar JSON" de telemetría no produce una descarga real **sólo** cuando el harness se ve dentro del visor de Artifact — el sandbox del visor bloquea descargas iniciadas por la página. Funciona sin problema clonando el repo o sirviendo el build fuera de ese visor. CRI-11 lo documenta explícitamente para que **no se lea como un bug del prototipo**. | **Resuelto por la propia CRI-11, no heredado como gap abierto**: es una restricción del entorno de visualización, no del producto ni del harness. Sin owner de CRI-12 — no aplica a `src/**` ni a ninguna issue de CRI-88. Se registra aquí (fixup de CRI-12E, gate 6) para que su disposición quede explícita en vez de en silencio. |

## D. Cierre cromático — ejecutado, es el estado vigente, pero no cerrado a revisión de CRI-12C

- Commit `74dfc76`: *"Sustituye la familia teal/esmeralda por una lima viva y elimina la segunda paleta nocturna: cada rol semántico usa ahora un solo HEX… El brandbook queda como autoridad única de color y cierra su nota abierta sobre los tres verdes candidatos."*
- Commit `f60eae5`: sube el croma manteniendo la misma franja de luminancia y el mismo mecanismo de invariancia Día/Noche.
- Commit `7fb927f`: Component Lab pasa a abrir por defecto en la paleta oficial; paletas previas (continuity/mineral/analytical) quedan agrupadas como "Históricas · supersedidas".
- Esto es lo que CRI-12A verifica como **hecho del estado actual** (`VERIFIED_CURRENT`, tema 19 de la matriz de evidencia): lima es la paleta implementada hoy en `main`, Brandbook y `tokens.css`. No es lo mismo que decir que la elección de identidad quede fuera del alcance de CRI-12. **CRI-12C debe comparar explícitamente mantener lima vs recuperar exclusivamente la familia menta/esmeralda histórica** — pregunta completa en `HANDOFF.md`. Si esa comparación mantiene lima, no cambia nada; si resulta en menta/esmeralda, es una decisión de producto nueva de 12C, no una que ya esté implementada, y no autoriza por sí sola tocar los colores técnicos de dominio (§E).

## E. Fronteras protegidas que CRI-12 no toca

Extraídas literalmente de los reportes fuente — se repiten aquí porque son las que el encargo pide proteger explícitamente:

- **`success ≠ reliable ≠ safe`**: *"implementado, probado y calibrado"* (CRI-9, línea 578); reforzado por D-14.
- **Stale fail-closed**: *"es imposible pintar evidencia caducada sobre el modelo"* (CRI-11 fase A); *"`stale` es fail-closed por construcción"* (CRI-9, U-06 resuelto).
- **Canvas-first**: regla constitutiva (CRI-9); presupuesto CB-1..6 cerrado por CRI-10.
- **2D/3D separados**: D-15 congela Space3D salvo dos contratos neutrales; U-09 resuelto — el dominio 2D sobrevive a la navegación a Space3D, la presentación 2D no, 3D nunca escribe al proyecto 2D.
- **Space3D experimental**: *"separado y experimental… D-15 lo congela salvo dos contratos neutrales"*.
- **Aula fuera de alcance**: *"Aula está fuera de alcance… y sigue estacionada, sin dirección de producto reabierta"* (CRI-9); *"excluida por el encargo, NOT_IN_SCOPE"* (CRI-11).
- **Mismo analysis, no segundo solver**: *"un solo solver / análisis 2D — intacto, nada de lo decidido lo toca"* (CRI-9, verificación de restricciones). Space3D tiene su propio solver por diseño para el dominio 3D — no es un segundo solver sobre datos 2D; el puente `src/space3d/data/bridge2d.ts` es de sólo lectura, unidireccional 2D→3D.
- **materialId/sectionId explícitos, nunca inferidos por floats**: *"la unificación no puede tocar esta fortaleza"* (D-12); test dedicado `identityMetadata.test.ts`.
- **Colores técnicos por significado**: regla de paleta única de `tokens.css:32-41`, mapeo de severidad vía `reliabilityCopy.ts`, no hex ad hoc.
- **Brandbook vigente como autoridad visual**: *"la autoridad de color es `brand/brandbook-clay.html`… este archivo no decide identidad: la implementa"* (`tokens.css:32-41`); confirmado sin modificar en todo CRI-10 (*"ningún HEX ni token de tokens.css se modificó en todo CRI-10"*). Esto protege el mecanismo — que el Brandbook, no cada implementación suelta, es la fuente única de color — no un HEX concreto: la identidad de color en sí (lima vs menta/esmeralda) es explícitamente `MUST_DECIDE_IN_12C` (tema 19), y esa fase, si decide una modificación, es la que actualizaría el propio Brandbook de forma explícita.
