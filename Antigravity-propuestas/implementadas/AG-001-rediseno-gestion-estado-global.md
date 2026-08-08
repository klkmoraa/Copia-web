# AG-001

# Rediseño de Gestión de Estado Global y Desacoplamiento de Componentes Canvas

# Implementada

# 2026-08-05

# Arquitectura / UI

---

> ## Nota de implementación (2026-08-05)
>
> Propuesta implementada con éxito.
> 1. **Segregación de Contextos**:
>    - `ProjectModelContext.tsx`: Modelo estructural, historial de deshacer/rehacer (Undo/Redo) y mutaciones del proyecto.
>    - `ProjectAnalysisContext.tsx`: Estado de cálculo asíncrono, worker execution e `AnalysisResult`.
>    - `WorkspaceUIContext.tsx`: Herramienta activa, selección, tema, solapa de resultados activa y cursores.
>    - `ProjectContext.tsx`: Proveedor orquestador unificado que mantiene 100% la fachada retrocompatible para `useProject()`.
> 2. **Desacoplamiento de Canvas**:
>    - `CanvasGeometryLayer.tsx`: Renderizado SVG memoizado de geometría, apops, cargas y cotas.
>    - `CanvasResultLayer.tsx`: Renderizado SVG memoizado de diagramas de esfuerzos $N, V, M$ y forma deformada.
>    - `CanvasInteractionLayer.tsx`: Caja de selección, previsualización de herramientas y resaltados de cursor.
>    - `StructuralCanvas.tsx`: Reducido significativamente en tamaño y complejidad.
> 3. **Pruebas y Verificación**:
>    - `npm run verify`: **649/649 pruebas en verde**. Lint limpio, frontera protegida intacta y presupuestos de bundle superados.

# Resumen ejecutivo

Propone modularizar la gestión de estado global de la aplicación (actualmente concentrada en `src/store/ProjectContext.tsx`) y dividir el componente monolítico del lienzo gráfico (`src/features/canvas/StructuralCanvas.tsx`, con más de 2,200 líneas) en sub-capas independientes y limpias. Esta refactorización evitará re-renders innecesarios en toda la interfaz ante cualquier micro-interacción de selección o arrastre, mejorando la mantenibilidad, escalabilidad y claridad del código sin alterar la frontera matemática protegida.

# Problema

 Actualmente, `ProjectContext.tsx` gestiona simultáneamente:
1. El modelo estructural del proyecto (`project`).
2. Las pilas de historial de Undo/Redo (`past`, `future`).
3. Los resultados del análisis estructural (`analysis`).
4. La herramienta activa (`activeTool`).
5. La selección activa (`selection`).
6. El tema visual (`theme`).
7. La pestaña de resultados activa (`resultTab`).
8. La posición del cursor del resultado (`resultCursor`).
9. El estado del lienzo de líneas de influencia (`influenceCanvasState`).
10. La persisitencia y gestión de errores de almacenamiento (`storageState`).

Cualquier cambio en el cursor del ratón o la selección notifica a todos los componentes consumidores de `useProject()`, provocando re-renders masivos en la TopBar, el Inspector y el ResultsPanel. Asimismo, `StructuralCanvas.tsx` mezcla en un solo archivo la gestión de la cámara pan/zoom, interacción con puntero, snapping, atajos de teclado, dibujo de geometrías SVG, leyes de etiquetas y portapapeles.

# Evidencia

- `src/store/ProjectContext.tsx`: Define un único contexto React con 30+ miembros en su tipo `ProjectContextValue` (líneas 17-54).
- `src/features/canvas/StructuralCanvas.tsx`: Archivo de 2,224 líneas que contiene lógica de cámara, gestos táctiles pinch-zoom, cálculo de snapping, evitación de colisiones de texto y renderizado de geometrías.

# Objetivo

1. Separar el contexto de estado en contextos o slices enfocados (`ModelContext`, `UIStateContext`, `AnalysisContext`).
2. Descomponer `StructuralCanvas.tsx` en sub-componentes especializados (`CanvasRenderLayer`, `CanvasInteractionLayer`, `CanvasOverlayLayer`, `CanvasChrome`).
3. Garantizar que micro-interacciones (como mover el cursor sobre un miembro o cambiar de pestaña de resultados) no re-rendericen el árbol completo del modelo.

# Beneficio esperado

- **Usuarios**: Respuesta visual más fluida en la interacción con el lienzo (60 FPS estables).
- **Desarrollo**: Código modular, fácil de razonar y mantener.
- **Rendimiento**: Reducción de hasta un 70% en re-renders de React durante la edición.

# Solución propuesta

1. **División de Contextos**:
   - `ProjectModelContext`: Exclusivo para el modelo estructural, historial de deshacer/rehacer y operaciones de edición.
   - `ProjectAnalysisContext`: Exclusivo para el resultado del análisis y estado de cálculo asíncrono.
   - `WorkspaceUIContext`: Exclusivo para la herramienta seleccionada, selección actual, pestañas activas y tema.
2. **Refactorización de `StructuralCanvas.tsx`**:
   - `StructuralCanvasContainer.tsx`: Orquestador principal.
   - `CanvasViewport.tsx`: Manejo de cámara pan/zoom y eventos Pointer.
   - `CanvasGeometryLayer.tsx`: Renderizado SVG memoizado de nodos, miembros, apoyos y cargas.
   - `CanvasResultLayer.tsx`: Renderizado de diagramas superpuestos y deformadas.
   - `CanvasInteractionLayer.tsx`: Manejo de la caja de selección y preview de herramienta activa.

# Alternativas consideradas

- **Uso de librería externa (Zustand/Jotai)**: Aunque Zustand simplificaría selectores, el proyecto `structureCo` prohíbe introducir dependencias externas pesadas si las capacidades nativas de React son suficientes. Mantener contextos React divididos preserva la arquitectura sin agregar paquetes extra.

# Justificación técnica

La división de React Contexts mediante la segregación de interfaces evita la propagación de actualizaciones de estado hacia componentes que no dependen de ese fragmento de datos. La frontera matemática protegida (`ProjectContext.tsx`) no cambia su contrato público para el motor.

# Impacto en la experiencia del usuario

Mayor fluidez visual durante el arrastre de nodos y paneo del canvas, eliminando tirones (*jank*) en dispositivos móviles o laptops de bajo consumo.

# Impacto visual

Sin cambios estéticos. Conserva 100% la dirección visual "Mesa Modular" e identidad de marca.

# Impacto en la arquitectura

Modifica la organización interna de `src/store/` y `src/features/canvas/`. Mantiene intactos los tipos de `src/types.ts` y las funciones del motor en `src/engine/`.

# Complejidad

**Alta**. Requiere reestructurar el orquestador principal del canvas y los hooks de acceso al estado.

# Prioridad

**Alta**. Es el habilitador técnico para optimizaciones de rendimiento avanzadas.

# Riesgos

- Regresión en el comportamiento de Undo/Redo si el orden de actualización difiere.
- Pérdida de eventos de selección si los hooks no están sincronizados.

# Dependencias

Ninguna librería externa requerida.

# Librerías o tecnologías recomendadas

Ninguna. Se utilizan las primitivas nativas de React 19 (`useMemo`, `useCallback`, `createContext`, `useRef`).

# Archivos y módulos probablemente afectados

- **Modificación probable**:
  - `src/store/ProjectContext.tsx`
  - `src/features/canvas/StructuralCanvas.tsx`
  - `src/features/workspace/WorkspaceShell.tsx`
- **Solo revisión**:
  - `src/features/inspector/Inspector.tsx`
  - `src/features/results/ResultsPanel.tsx`

# Plan de implementación

## Fase 1: Preparación y Segregación de Contextos
- Crear `src/store/WorkspaceUIContext.tsx` para aislar `activeTool`, `selection`, `theme`, `resultTab`, `resultCursor`.
- Mantener compatibilidad exportando un hook unificado `useProject()` que combine los contextos.

## Fase 2: Descomposición de StructuralCanvas
- Extraer sub-componentes en `src/features/canvas/components/`:
  - `CanvasGeometryLayer.tsx`
  - `CanvasResultLayer.tsx`
  - `CanvasChromeOverlay.tsx`
- Refactorizar `StructuralCanvas.tsx` para actuar como contenedor ligero.

## Fase 3: Pruebas y Validación
- Ejecutar suite completa de Vitest y Playwright.

# Estrategia de implementación

Mantener la exportación de `useProject()` como fachada para garantizar que componentes secundarios (TopBar, Inspector) no requieran cambios masivos simultáneos.

# Criterios de aceptación

- `npm run verify` se ejecuta en verde sin errores.
- Los 530 tests existentes continúan pasando.
- No hay re-renders del `Inspector` cuando el usuario mueve el cursor en el Canvas sin hacer clic.
- La función de Undo/Redo conserva exactamente los 50 niveles de historial.

# Pruebas necesarias

- Pruebas unitarias en Vitest para los nuevos contextos.
- Pruebas E2E de Playwright (`npm run qa`) verificando creación de nodos, miembros y análisis.

# Restricciones

- No modificar firmas de tipos en `src/types.ts`.
- No alterar la lógica de persistencia en `localStorage`.

# Estrategia de reversión

Restaurar `ProjectContext.tsx` y `StructuralCanvas.tsx` desde Git.

# Definición de terminado

Propuesta implementada, validada por la suite de pruebas completa, sin regresiones visuales ni de rendimiento.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-001-rediseno-gestion-estado-global.md`

Valida la propuesta contra el código real antes de modificar archivos.

Implementa únicamente el alcance aprobado: divide los contextos de React en `src/store/` y descompón `StructuralCanvas.tsx` en capas reutilizables sin alterar el contrato público del modelo.

Conserva los comportamientos y restricciones indicados en el documento.

No realices cambios adicionales no solicitados en el motor o los solver.

Si detectas una incompatibilidad importante, detente antes de editar y explica el problema.

Ejecuta lint, tests y build (`npm run verify`).

Al terminar:
- resume los cambios
- lista los archivos modificados
- indica las pruebas ejecutadas
- documenta cualquier desviación
- actualiza el estado de la propuesta a Implementada
- mueve el documento a `Antigravity-propuestas/implementadas/AG-001-rediseno-gestion-estado-global.md`
