# CRI-12B · Rechazado, diferido y unknowns restantes

**Clasificación:** `AUDIT/TEMPORARY`

Complementa `02-ux-decision-matrix.md` y `02-ux-direction-record.md`. Este documento separa explícitamente tres categorías que no deben confundirse: lo **rechazado** (no se hace, punto), lo **diferido** (se decide no decidir todavía) y los **unknowns** que persisten aunque una decisión de política ya se haya cerrado sobre ellos (por ejemplo: "avanzar sin el dato" es una decisión cerrada; el dato en sí sigue sin existir).

## Rechazado (`REJECTED`)

| Tema | Decisión | Por qué |
|---|---|---|
| Esencial/Completa | Se descarta la hipótesis de densidad de presentación (`densidad: 'esencial' \| 'completa'`) propuesta en CRI-10 | 0 referencias en `src/**`; no conectada a preferencia persistente; el propio cierre de CRI-10 la califica de *"hipótesis, no funcionalidad aprobada de producción"*. No hay estudio real que la sustente. |

No hay más rechazos en esta sesión — el resto de temas abiertos se resolvió como adopción, diferimiento o asignación de prioridad/pendiente técnico a CRI-12D, no como descarte.

## Diferido (`DEFERRED`)

| Tema | Qué queda pendiente para decidir | Condición para retomarlo |
|---|---|---|
| Marco de selección direccional (ABIERTA-3) | Si se incorpora al contrato D-06 de selección (5 fases) o se descarta | Requiere test de discoverability, no ejecutado. Mientras tanto D-06 sigue vigente sin esta variante. |

## Pendiente técnico asignado a CRI-12D (`PENDING_FOR_12D`)

Distinto de diferido: aquí sí se decidió algo (que es prioritario y a quién se asigna), pero ni la evaluación ni la decisión de fondo se ejecutan en CRI-12B — CRI-12B no implementa producción ni ejecuta evaluaciones de impacto, sólo fija dirección y prioridad.

| Tema | Qué se decidió en 12B | Qué queda para CRI-12D | Qué sigue sin decidirse |
|---|---|---|---|
| `settings.show*` fuera del schema de `ProjectSettings` (ABIERTA-8/U-12) | Es un pendiente técnico prioritario, no descartable | Asignar y ejecutar la evaluación de impacto | Si se migra o no — depende del resultado de esa evaluación, marcada por CRI-9 como *"el mayor riesgo adyacente a schema de todo CRI-9"*. |

## Priorizado para CRI-12D (`PRIORITIZED_FOR_12D`) — arquitectura ya cerrada, sólo prioridad de backlog

Ninguno de estos reabre arquitectura (D-01/D-04/D-05/D-07 ya `DECIDED`). CRI-12B fija cuál va primero; CRI-12D es quien convierte esto en tareas de implementación real — CRI-12B no toca `src/**`.

| Tema | Prioridad fijada en 12B | Qué debe hacer CRI-12D |
|---|---|---|
| Shell adaptativo (X2/M1/K0) | Va antes que otras piezas de implementación que dependen de las tres clases funcionando de verdad | Construir la máquina de estados resolver-driven (`matchMedia` + tokens de densidad por tier ya existentes en `tokens.css:556-560`), sustituyendo el booleano `toolRailCompact` actual |
| Brechas de paridad táctil D-07 (SEL-02, SEL-03, MOD-13, DAT-06, MOD-12) | Va en el mismo backlog que el shell adaptativo, del que depende | Implementar la superficie `contextual-actions` + sub-modo de marco de selección + affordance de pegar |

## Adoptado con valor provisional — no confundir con "medido"

Estas cinco decisiones se cerraron fijando un valor o una política, explícitamente marcadas como revisables cuando exista la medición real que hoy no existe. Se listan aquí también porque cada una deja un unknown vivo detrás:

| Decisión cerrada | Unknown que persiste |
|---|---|
| Riel sólo-icono en Medium, mantenido | Si perjudica discoverability sigue sin medir — tarea cronometrada riel-etiquetado-vs-icono no ejecutada. |
| `bandPx = 24` fijado para histéresis del resolver | Si el valor de banda importa a otra altura de viewport (que cruce dos fronteras) o con banda >400px — CRI-11 fase C es explícita: *"la medición está hecha, la interpretación fuerte no"*. |
| Piso conservador del zócalo Compact apaisado (1 verbo + Borrar + `⋯`) | Cuántos verbos primarios caben realmente — medición sobre 7 tipos de selección × 2 idiomas con contenido real (ABIERTA-4) sigue sin ejecutar. |
| Piso conservador del chrome de Cinta Compact (Estado/Doctor nunca degradan; persistencia/Datasheet/nombre primero a icono-only) | Ancho exacto de la Cinta en el producto real con nombres de proyecto y combinaciones largas, en los dos idiomas (GAP-1) sigue sin medir — CRI-10 mismo señaló que su gate mide el DOM de una lámina, no el producto. |
| 8 escenarios de discoverability, avanzar sin ellos | Los 8 escenarios siguen sin ejecutarse. Ninguna decisión de discoverability de esta sesión tiene dato real de tiempo/abandono detrás. |

## Unknowns restantes sin ninguna decisión de política todavía

Estos no se tocaron en las 11 decisiones de 12B porque `HANDOFF.md` los marca como verificación técnica, no como decisión de producto — pero la política de tratarlos como "gate paralelo, no bloqueante" (decisión #11 de la matriz) sí se cerró:

- Contraste medido a nivel de píxel + pase real con lectores de pantalla (ABIERTA-6).
- Rendimiento de Datasheet/paleta con ~2000 entidades en dispositivo real — único dato existente es `EXPERIMENTAL` (harness aislado, 1.16s a primera fila sin virtualizar sobre 1292 filas) (ABIERTA-7).
- Disponibilidad de `navigator.clipboard.readText()` en la matriz real de navegadores (U-11).
- Matriz multi-navegador completa — sólo Chromium se probó en las tres fases de CRI-11 (Firefox/WebKit no instalados en ese entorno).

## Frontera con CRI-12C — ninguna decisión de color/visual tomada aquí

Recordatorio explícito, no una decisión nueva: lima vs menta/esmeralda histórica (tema 19), tratamiento visual del portal de Welcome, remedición de contraste del pórtico en Noche (LEDGER-05), y la regla de la placa técnica "IPE-240 · A992" siguen intactas como `MUST_DECIDE_IN_12C`. Nada en esta sesión las adelanta ni las prejuzga.
