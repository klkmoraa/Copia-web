# AG-006

# Sistema de Undo/Redo Granular y Transacciones de Selección Independientes

# En evaluación

# 2026-08-05

# UX / Store

# Resumen ejecutivo

Propone refactorizar el sistema de deshacer y rehacer (*Undo/Redo*) en `src/store/ProjectModelContext.tsx`. Actualmente, las pilas de historial almacenan snapshots completos del modelo `ProjectModel` (50 estados), incluyendo cambios puramente de selección o cambios cosméticos. Esta mejora desacoplará los eventos de UI (selección, pestaña activa, herramientas) del historial de mutaciones geométricas/mecánicas, permitiendo deshacer cambios físicos (mover nodos, borrar miembros) sin perder el foco ni la selección activa del usuario.

# Problema

En la implementación actual:
- Al hacer *Undo* (`Ctrl+Z`), el historial restaura el `ProjectModel` anterior.
- Sin embargo, si el usuario seleccionó un miembro o cambió una vista entre dos ediciones, el estado de selección se resetea o desalinea.
- Almacenar copias profundas (`structuredClone`) del objeto `ProjectModel` completo 50 veces consume memoria innecesaria cuando solo cambió la posición de un nodo.

# Evidencia

- `src/store/ProjectContext.tsx` y `src/store/ProjectModelContext.tsx`: Pilas `past` y `future` de tipo `ProjectModel[]` (líneas 67-68).

# Objetivo

1. Aislar las transacciones de deshacer/rehacer exclusivamente para mutaciones del modelo físico (nodos, miembros, apoyos, cargas).
2. Conservar el estado de selección e UI independiente del historial de undo/redo.
3. Optimizar el almacenamiento del historial mediante deltas o diffs inmutables en lugar de snapshots completos duplicados.

# Beneficio esperado

- **Usuarios**: Comportamiento de Undo/Redo predictivo y profesional (igual a software CAD estándar como AutoCAD o FTOOL).
- **Memoria**: Reducción del uso de RAM por la pila de historial en más de un $60\%$.

# Solución propuesta

1. **Separación Estricta de Historial**:
   - `past` y `future` solo registran estados producidos por mutaciones estructurales (`addNode`, `deleteMember`, `updateLoad`, etc.).
   - La selección (`selection`) permanece intacta tras un Undo si los objetos seleccionados siguen existiendo en el modelo restaurado.
2. **Estructura de Transacciones Limpias**:
   - Agrupar operaciones continuas (como el arrastre en vivo de un nodo) en una sola entrada del historial al soltar el puntero (`pointerup`).

# Complejidad

**Media**.

# Prioridad

**Media**.

# Archivos y módulos probablemente afectados

- `src/store/ProjectModelContext.tsx`
- `src/store/WorkspaceUIContext.tsx`
- `src/features/canvas/StructuralCanvas.tsx`
