# T04 — Investigación de paridad entre análisis y exportación

**Estado inicial:** `NOT_STARTED`. **Base:** `0071688`. **Puede ejecutarse en paralelo:** T01, T02 y T03. **Debe permanecer separada de cualquier implementación de dominio.**

## Objetivo

Determinar, con una fixture reproducible, si exportar antes de Analizar puede usar una topología distinta del flujo normal.

## Alcance

Se permite crear pruebas y una nota de decisión. No modificar `ProjectContext`, solver, modelos, persistencia, topología ni exportación de producción sin una autorización posterior.

## Pasos

1. Crear `investigate/analysis-export-parity`; registrar `IN_PROGRESS`.
2. Construir una fixture mínima con un nodo/apoyo coincidente que `repairProjectTopology` normalice y documentar su topología inicial, reparada y resultados esperados.
3. Ejecutar tres rutas con la misma fixture: flujo normal de análisis, análisis directo usado por exportación y bundle/PDF generado sin análisis previo.
4. Crear `docs/superpowers/handoffs/structureco-2026-07-29/decisions/T04-parity.md` con una tabla de igualdad/diferencia para proyecto, resultados, advertencias y persistencia.
5. Si no hay diferencia, marcar `NOT_NEEDED` con pruebas verdes. Si hay diferencia, marcar `COMPLETE` como investigación y pedir elección explícita antes de crear una tarea nueva:
   - persistir reparación;
   - usar snapshot reparado sólo para el artefacto;
   - rechazar exportación hasta que el usuario analice.
6. Ejecutar pruebas enfocadas más `npm.cmd run build`, commit `test: characterize analysis export parity` y actualizar STATUS.

## Criterio de aceptación

El siguiente chat puede decidir una solución sin inferir semántica de topología, historial o persistencia.
