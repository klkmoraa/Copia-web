# T06 — Presupuesto de capacidad y rendimiento

**Estado inicial:** `BLOCKED` por el dictamen T04. **No bloquea 0.8.1 salvo hallazgo crítico.**

## Objetivo

Publicar límites operativos medidos para modelos, importación, reparación topológica, drag/snapping y análisis; no cambiar solver todavía.

## Archivos propietarios

Fixtures de rendimiento, scripts de medición y documentación. Cualquier cambio de `engine`, `data`, `workers` o canvas requiere una nueva autorización.

## Pasos

1. Basar la medición en fixtures incrementales y reproducibles; registrar número de nodos, miembros, grados de libertad, bytes y navegador/hardware.
2. Medir preparación topológica, drag, snapping, worker de análisis, memoria y long tasks; distinguir mediana local de SLA.
3. Escribir presupuesto recomendado y umbrales de advertencia en un informe versionado.
4. Separar propuestas de solución: preparación en worker, índice espacial y solver disperso son especificaciones posteriores, no cambios de esta tarea.
5. Ejecutar build, scripts de medición repetidos y pruebas de no-regresión pertinentes.
6. Commit de fixtures/documentación, STATUS `COMPLETE` y handoff con tablas de resultados.

## Criterio de aceptación

El producto comunica un tamaño de modelo razonable y una futura optimización no puede justificarse sólo con impresiones subjetivas.
