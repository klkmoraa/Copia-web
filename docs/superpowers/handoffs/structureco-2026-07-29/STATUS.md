# Estado canónico — programa de mejora structureCo

Base inicial: `fix/mobile-results-canvas-visibility` en `0071688`. Este ledger se actualiza en el mismo commit que cierra la tarea.

| ID | Estado | Predecesores | Rama/commit aceptado | Evidencia mínima | Siguiente desbloqueo |
| --- | --- | --- | --- | --- | --- |
| T01 | NOT_STARTED | — | — | foco visible a 390/430, QA móvil | T05 |
| T02 | NOT_STARTED | — | — | límites previos a lectura, corpus adversarial | T07 |
| T03 | NOT_STARTED | — | — | versión exportada y round-trip | T07 |
| T04 | NOT_STARTED | — | — | fixture de paridad y nota de decisión | decisión de dominio / T06 |
| T05 | BLOCKED | T01 | — | contrato UX, tabs, matriz responsive | T07 |
| T06 | BLOCKED | T04 | — | presupuesto reproducible | T09, no bloquea 0.8.1 |
| T07 | BLOCKED | T01,T02,T03,T04,T05 | — | gates completos, docs, rollback | T08 |
| T08 | BLOCKED | T07 | — | versión privada de Sites y URL | cierre de release |
| T09 | BLOCKED | T04,T06 | — | especificación aprobada | programa posterior |

## Definiciones de estado

- `NOT_STARTED`: aún no existe branch ni cambio.
- `IN_PROGRESS`: existe un único branch/worktree dueño; anotar branch y objetivo.
- `BLOCKED`: falta el predecesor, una decisión de usuario o autorización para ruta protegida.
- `COMPLETE`: commit, comandos verdes, artefactos, diff protegido y handoff registrados.
- `NOT_NEEDED`: se investigó y el commit/evidencia demuestra que no requiere implementación.

## Registro de cierres

Agregar debajo de este título una línea por cierre: `Txx | fecha | branch | commit | pruebas | diff protegido | decisión/siguiente tarea`.
