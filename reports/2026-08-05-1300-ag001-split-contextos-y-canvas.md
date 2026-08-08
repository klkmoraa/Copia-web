# AG-001: split de ProjectContext y descomposición de StructuralCanvas

**Fecha:** 2026-08-05 13:00
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Implementación de la propuesta `AG-001` (Antigravity): se dividió `src/store/ProjectContext.tsx` en tres contextos React enfocados (modelo, análisis, UI de workspace) manteniendo `useProject()` como fachada 100% compatible, y se descompuso `src/features/canvas/StructuralCanvas.tsx` (2223 líneas) en tres sub-capas SVG memoizadas con `React.memo`. Objetivo: evitar que micro-interacciones (cambiar herramienta, mover el cursor, seleccionar) fuercen re-renders del árbol completo del modelo/resultados.

## Por qué

El usuario aprobó explícitamente la propuesta `Antigravity-propuestas/aprobadas/AG-001-rediseno-gestion-estado-global.md` (arquitecto Antigravity), incluyendo autorización expresa para tocar `src/store/ProjectContext.tsx`, que forma parte de la frontera matemática protegida del proyecto.

## Archivos tocados

- `src/store/ProjectModelContext.tsx` (nuevo) — modelo del proyecto, undo/redo, transacciones, persistencia.
- `src/store/ProjectAnalysisContext.tsx` (nuevo) — resultado del análisis, estado async, `learningFocus`, líneas de influencia.
- `src/store/WorkspaceUIContext.tsx` (nuevo) — herramienta activa, selección, tema, pestaña/cursor de resultados.
- `src/store/ProjectContext.tsx` (modificado) — pasa a orquestar los tres contextos anteriores (misma lógica interna, sin cambios de comportamiento) y expone `useProject()` como fachada combinada para no romper a los 17 consumidores existentes.
- `src/features/canvas/CanvasGeometryLayer.tsx` (nuevo) — capa memoizada de nodos, miembros, apoyos y cargas.
- `src/features/canvas/CanvasResultLayer.tsx` (nuevo) — capa memoizada de diagramas, deformada, reacciones y mecanismo.
- `src/features/canvas/CanvasInteractionLayer.tsx` (nuevo) — capa memoizada de snap glyph, marquee de selección, preview de miembro y badge de multi-selección.
- `src/features/canvas/StructuralCanvas.tsx` (modificado) — se reduce a orquestador (cámara, gestos de puntero, snapping, atajos, portapapeles) que invoca las tres capas anteriores; cada capa se invoca dos veces con un prop `slot` distinto para preservar exactamente el orden de pintado SVG original (z-order).
- `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` (modificado) — hash de `ProjectContext.tsx` re-firmado tras el cambio autorizado (`node scripts/check-protected-baseline.mjs --update`).

## Cómo verificar

```bash
npm run verify
```
Resultado: lint sin advertencias, frontera protegida intacta (26 archivos), **649/649 tests**, build y presupuesto de rendimiento en verde. Además se hizo un smoke test manual en navegador (crear nodos, verificar selección/undo, sin errores de consola).

## Pendiente / siguiente paso

- **No forzado deliberadamente**: estabilizar con `useCallback` toda la cadena de manejadores de interacción del puntero (`performTargetAction`, `performNodeAction`, `performMemberAction`, etc.) para que `CanvasGeometryLayer` también evite re-render durante clics/arrastres. Es una decisión de arquitectura mayor con riesgo real de introducir bugs de closure obsoleto en la lógica de interacción más sensible del canvas — no se tocó en esta pasada. `CanvasResultLayer` y `CanvasInteractionLayer` sí obtienen el beneficio completo de memoización ya que sus props ya eran estables/memoizadas aguas arriba.
- Se detectó que `Antigravity-propuestas/` (backlog.md, roadmap.md, AG-002, y el propio AG-001 en `implementadas/`) fue editado en paralelo por otro proceso (Antigravity) mientras se ejecutaba este cambio. Por indicación del usuario, este commit incluye únicamente los archivos de código propios; el estado de `Antigravity-propuestas/` se deja intacto para que el usuario lo revise por separado.
