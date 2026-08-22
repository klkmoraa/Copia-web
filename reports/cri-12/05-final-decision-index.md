# CRI-12E · Índice final de decisiones

**Clasificación:** `AUDIT/TEMPORARY`

Índice corto. Apunta a la fuente de verdad de cada decisión final de CRI-12; no duplica el contenido. Para el detalle, abrir el documento citado — no reinterpretar desde aquí.

## Arquitectura UX (CRI-12B)

| Decisión | Fuente de verdad |
|---|---|
| Resumen autocontenido de todos los contratos UX finales | `02-ux-direction-record.md` §6 |
| Las 11 decisiones fila por fila, con evidencia y riesgo de revisión | `02-ux-decision-matrix.md` |
| Rechazado (Esencial/Completa) y diferido (marco de selección direccional) | `02-rejected-and-deferred.md` |
| Expanded/Medium/Compact (D-01/D-04/D-05), frontera Medium, `bandPx=24` | `02-ux-direction-record.md` §6.1 |
| Surface ownership — 18 superficies, un dueño cada una | `02-ux-direction-record.md` §6.2 |
| Rutas visible/contextual/experta | `02-ux-direction-record.md` §6.3 |
| Continuity — T-INV-1…8 | `02-ux-direction-record.md` §6.4 |
| Selección + Candidate Picker (D-06) | `02-ux-direction-record.md` §6.5 |
| Results (D-03, cuatro dueños) | `02-ux-direction-record.md` §6.6 |
| Datasheet (D-11, `peek`) | `02-ux-direction-record.md` §6.7 |
| Model Doctor | `02-ux-direction-record.md` §6.8 |
| Command Palette (G-01) — **corregido**: `CommandRegistry` no existe hoy | `02-ux-direction-record.md` §6.9; corrección en `04-implementation-roadmap.md` §0 y CRI-103 |
| Panel/inset/sheet/fullscreen — vocabulario y matriz | `02-ux-direction-record.md` §6.10 |
| Accesibilidad de interacción (11 contratos, D-14) | `02-ux-direction-record.md` §6.11 |
| Motion behavioral | `02-ux-direction-record.md` §6.12 |

## Dirección visual (CRI-12C)

| Decisión | Fuente de verdad |
|---|---|
| V-01…V-14 completo (carácter, Clay/plano, gramática, intensidad, radios, tipografía, color, Día/Noche, Results, Welcome, iconografía, motion, accesibilidad visual) | `03-visual-direction-record.md` |
| Gramática de superficies BASE/INSET/RAISED/FLOATING/SHEET/MODAL y su correspondencia con presentación | `03-surface-grammar.md` |
| **Menta/esmeralda gana** sobre lima vigente; cortante→lima; influencia→rosa pastel; gate de medición obligatorio (§4) | `03-color-decision.md` |
| Siete pares DO/DON'T con casos concretos | `03-do-dont.md` |
| Serif editorial para titulares — **abierta, sin acotar**, no decidida | `03-visual-direction-record.md` V-06 |
| Estado actual de `main`/Brandbook/`tokens.css` — **sigue en lima**, sin cambios dentro de CRI-12 | `01-evidence-matrix.md` tema 19; confirmado por spot-check de este gate (`tokens.css` líneas 108/111/117) |

## Backlog de implementación (CRI-12D)

| Decisión | Fuente de verdad |
|---|---|
| Roadmap por capas, orden y las 4 desviaciones justificadas respecto al orden tentativo de CRI-86 | `04-implementation-roadmap.md` |
| Dependencias HARD/SOFT/PARALLEL, grafo, camino crítico, puntos de contención | `04-dependency-map.md` |
| Estrategia de migración incremental, estado persistido, rollback | `04-migration-strategy.md` |
| 32 riesgos con detección y mitigación | `04-implementation-risk-register.md` |
| Las 18 issues de producción, cada una autocontenida | Linear CRI-89…CRI-106 (parent CRI-88) |

## Gaps heredados de CRI-11 (CRI-12A, con fixup de CRI-12E)

| Gap | Disposición | Fuente |
|---|---|---|
| Datasheet perf con modelo grande | Medición en dispositivo real, sin optimizar a priori | CRI-93 |
| Firefox/WebKit sin evidencia | WebKit **sí** tiene vehículo; Firefox pendiente de vehículo o declaración explícita | CRI-106; `04-implementation-risk-register.md` R-15 |
| pan↔marquee touch | Decisión de producto (long-press 480ms + umbral de desplazamiento) | CRI-96; R-13 |
| Histéresis del resolver (U-13) | `bandPx=24` fijado, `PROTOTYPE_VALIDATED`, parametrizado no enterrado | `02-ux-decision-matrix.md` #6; CRI-89; R-17 |
| Medium landscape real | Caso de QA obligatorio transversal | R-16; CRI-89/95/97/102 |
| Artifact download sandbox | Ya resuelto por CRI-11 misma (no es bug de producto); registrado explícitamente en este cierre | `01b-inherited-decisions.md` §C (fixup de CRI-12E); `reports/2026-08-16-cri-11-fase-c-validacion.md:310-314` |

## Contratos protegidos (transversal a todo CRI-12)

| Invariante | Fuente de verdad |
|---|---|
| `success ≠ reliable ≠ safe` | `01b-inherited-decisions.md` §E; reforzado en `03-visual-direction-record.md` V-02/V-10; código: `src/engine/reliability.test.ts:106` |
| Stale fail-closed | `01b-inherited-decisions.md` §E; código: `src/features/topbar/analysisStatusModel.ts:17` |
| Canvas-first | `01b-inherited-decisions.md` §E; `03-visual-direction-record.md` §3 |
| Mismo analysis, no segundo solver; Aula usa el mismo análisis | `01b-inherited-decisions.md` §E; verificado como criterio de aceptación en CRI-100 (#8) |
| Aula fuera de alcance salvo restricción de medición cromática | `01b-inherited-decisions.md` §E; `03-color-decision.md` §4.2 |
| Space3D experimental (D-15 congelado) | `01b-inherited-decisions.md` §E; `docs/architecture/structureco-space-3d-s3d1.md` (`CANONICAL`) |
| `materialId`/`sectionId` explícitos, nunca por floats | `01b-inherited-decisions.md` §E; código: `src/types.ts` (`Selection`); riesgo R-04 en `04-implementation-risk-register.md` |
| Colores técnicos semánticos | `01b-inherited-decisions.md` §E; `03-color-decision.md` completo |
| Menta/esmeralda es decisión futura aprobada, **no implementación actual** | `03-color-decision.md` §1/§6; confirmado por spot-check de este gate: `tokens.css` sigue en lima |
| Brandbook/tokens actuales sin cambiar dentro de CRI-12 | `01-evidence-matrix.md` tema 19; Gate 10 de `05-closure-gate.md` (diff confirma cero cambios) |
| `CommandRegistry` no existe hoy — CRI-103 lo trata como implementación futura, no como cableado de algo existente | `04-implementation-roadmap.md` §0; CRI-103 (Linear) |

## Backlog maestro y prioridad real

| Decisión | Fuente de verdad |
|---|---|
| P0 verificados `Done` antes de ordenar el backlog UX | `04-implementation-roadmap.md` §0 ("Precondición de programa"); reverificado en este gate directamente en Linear (CRI-13, CRI-20, CRI-33, CRI-34, CRI-54) |
| Orden final, primera issue READY, paralelizables, bloqueadas, diferidas | `05-ready-backlog.md` (este cierre) |

## Cierre del gate

| Documento | Qué contiene |
|---|---|
| `05-closure-gate.md` | Los 10 gates, PASS/FAIL, evidencia, riesgo, acción; el único fixup aplicado |
| `05-ready-backlog.md` | Clasificación READY/BLOCKED/PARALLEL_SAFE/DEFERRED y primera issue ejecutable |
| `HANDOFF.md` | Actualización final: estado de CRI-12A→E, confirmación de alcance, instrucción de arranque para CRI-88 |
