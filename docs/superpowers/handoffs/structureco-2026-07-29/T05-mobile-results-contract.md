# T05 — Contrato y descubribilidad de Resultados móvil

**Estado inicial:** `BLOCKED` por T01. **Puede ejecutarse sólo después de aceptar T01.**

## Objetivo

Hacer coherentes código, QA y documentación de Resultados móvil; cada pestaña debe ser descubrible y los detalles deben tener una ruta inequívoca.

## Recomendación de producto

Mantener panel compacto y canvas visible para consulta rápida; abrir una vista dedicada para tablas largas, gráficas, comparación y Avisos. Si se decide conservar split-view para todo, documentarlo explícitamente y demostrar que el teclado no encuentra controles cubiertos.

## Archivos propietarios

`ResultsPanel.tsx`, superficies UI relacionadas, `styles.css`, `RESPONSIVE_SPEC.md`, `RESULTS_INFO_ARCH.md`, `RESULTS_VISUALIZATION_SPEC.md` y QA de fases 11/14.

## Pasos

1. Rebasar sobre el commit aceptado de T01 y registrar `IN_PROGRESS`.
2. Escribir una especificación corta de los dos niveles de Resultados y el criterio elegido; no introducir estado de modelo duplicado.
3. Añadir navegación visible para todas las familias de pestañas: agrupación/overflow o señal persistente y desplazamiento al tab activo; Avisos y Aprender deben alcanzarse en una acción evidente.
4. Actualizar docs y QA para que el contrato modal/modeless sea único, no contradictorio.
5. Ejecutar pruebas de Resultados, build, Fase 11, Fase 14 móvil y revisión Light/Dark, ES/EN, touch/teclado.
6. Commit, diff protegido limpio, STATUS `COMPLETE` y handoff con capturas/evidencia.

## Criterio de aceptación

No hay tabs ocultos sin señal; móvil conserva canvas para consulta rápida y ofrece detalle accesible; tablet y escritorio no cambian sin justificación.
