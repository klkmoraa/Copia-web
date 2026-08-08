# T09 — Consolidación arquitectónica posterior

**Estado inicial:** `BLOCKED` por T04 y T06. **No pertenece a la release 0.8.1.**

## Objetivo

Reducir dependencias implícitas entre Canvas, Inspector, TopBar y resultados sin cambiar semántica estructural.

## Fronteras obligatorias

Una futura fachada de comandos debe conservar IDs, undo/redo, selección, remapeo de cargas, importación/exportación, valores almacenados, unidades, signos y resultados. No se inicia código hasta aprobar una especificación técnica separada.

## Pasos

1. Inventariar entry points de crear, borrar, dividir, pegar, reparar topología y exportar; mapear inputs, efectos y pruebas existentes.
2. Definir una interfaz de intención UI y una fachada de dominio con tipos explícitos; incluir snapshots de proyecto/historial/resultados como contratos de compatibilidad.
3. Diseñar la extracción de responsabilidades de `ResultsPanel` y CSS móvil sin duplicar estado de resultados.
4. Someter la especificación al dueño del motor; si toca rutas protegidas, obtener autorización del usuario antes de crear plan de implementación.
5. Actualizar STATUS como `COMPLETE` sólo cuando la especificación sea aprobada; la implementación será una nueva serie de tareas.

## Criterio de aceptación

El trabajo futuro de dominio tiene una interfaz acordada y pruebas de invariantes antes de cualquier refactorización riesgosa.
