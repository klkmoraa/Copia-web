# Plan de ejecución - Fase 3

Fecha: 2026-07-17  
Estado: **completada y lista para revisión**.

## Fuente de verdad visual

El documento `structureCo_Fase_3_Instrucciones_ULTRA_Detalladas_para_Codex.pdf` gobierna la fase completa. Sus conceptos aprobados se encuentran en las páginas 22, 24, 26, 27, 29, 30, 31, 32, 33 y 35.

| Referencia | Dirección aplicada |
| --- | --- |
| p. 22 | Canvas first: modelo al centro y más área útil. |
| p. 24 | Herramientas agrupadas por intención. |
| p. 26 | Chrome discreto y zonas seguras del canvas. |
| p. 27 | Capas de información como estado UI. |
| p. 29 | Etiquetas inteligentes: prioridad, zoom, decluttering y colisiones. |
| p. 30 | Estados de selección por objeto y multiselección. |
| p. 31 | Adaptación consistente entre desktop y tablet. |
| p. 32 | Experiencia móvil canvas-first con dock inferior. |
| p. 33 | Gestos e interacción para mouse, teclado, touch, pinch y stylus. |
| p. 35 | Accesibilidad, targets, foco, rendimiento y estabilidad responsive. |

## Arquitectura prevista

| Ruta | Responsabilidad visual |
| --- | --- |
| `src/components/toolRegistry.ts` | Fuente única para ids, shortcut, grupo, prioridad y presentación responsive. |
| `src/components/ToolBar.tsx` | Rail/dock accesible, grupos y sheets sin cambiar handlers. |
| `src/components/editorLayers.ts` | Estado UI-only, defaults y reducer de capas. |
| `src/components/labelLayout.ts` | Prioridad, LOD y colisión deterministas en coordenadas de pantalla. |
| `src/components/StructuralCanvas.tsx` | Aplicar capas, safe zones, labels y feedback de selección. |
| `src/components/WorkspaceShell.tsx` | Poseer el estado de capas durante la sesión. |
| `src/i18n/catalogs.ts` | Copys visuales ES/EN. |
| `src/styles/tokens.css`, `src/styles.css` | Tokens de selección/chrome y composiciones responsive. |
| `qa-phase3.mjs` | Matriz geométrica, herramientas, labels, capas, accesibilidad y capturas. |

## Slices y gates

### 3.0 - Línea base y plan

- Leer/renderizar las 56 páginas del PDF.
- Repetir gates heredados y capturar los nueve viewports.
- Registrar baseline Git, frontera protegida, decisiones y supuestos.
- Gate: `src/` sin cambios y evidencia before inspeccionada.

### 3.1 - Registro y ToolRail/ToolDock

- Extraer una fuente única de herramientas y shortcuts existentes.
- Agrupar Navegar, Crear, Cargas, Anotar/Inspeccionar y Editar.
- Mantener 12 herramientas, acceso Aula y Delete/Backspace.
- Gate: tests de registro, paridad de acciones y `verify`.

### 3.2 - Chrome y zonas seguras

- Reorganizar modo activo, cámara, estado y acciones en zonas reservadas.
- Evitar colisión con dock, inspector, leyendas y resultados.
- Gate: nueve viewports sin overlap/overflow.

### 3.3 - Capas UI-only

- Implementar modelo, cargas, cotas, IDs, resultados, labels, ayuda y diagnóstico.
- Mantener modelo siempre visible; no persistir estado ni tocar ProjectSettings.
- Gate: reducer determinista, accesibilidad y compatibilidad Completo/Aula.

### 3.4 - Etiquetas y decluttering

- P0 selección/acción y P1 nodos/apoyos nunca se ocultan.
- LOD por escala, resolución determinista y leader line cuando sea necesario.
- Gate: cero colisiones P0/P1 en escenarios densos y tests puros.
- Estado: **implementado**; cinco pruebas puras y revisión Browser 1440/430 aprobadas.

### 3.5 - Feedback de selección

- Separar selección azul de verde de producto y colores técnicos.
- Dar feedback específico a miembro, nodo, apoyo, carga y multiselección.
- Gate: selección visible en Light/Dark y no dependiente sólo del color.
- Estado: **implementado**; feedback geométrico por objeto y revisión Browser Light/Dark aprobados.

### 3.6 - Gestos, responsive y accesibilidad

- Mouse, rueda, teclado, touch, pinch y pointer pen conservados.
- Foco, aria, targets de 44 px, reduced motion y zoom 200 %.
- Gate: tests de interacción y QA touch/WebKit.
- Estado: **implementación cerrada**; QA integral WebKit/zoom 200 % se repite en Slice 3.7.

### 3.7 - QA integral

- `verify`, `qa:phase3`, `qa`, `qa:webkit`.
- ES/EN, Light/Dark, Completo/Aula, nueve viewports, estados y selección.
- Gate: cero errores, cero protected diff y comparativa visual aprobada.
- Estado: **cerrado**; 125 checks de Fase 3, regresiones heredadas, WebKit y 19 capturas aprobados.

### 3.8 - Evidencia e informe

- Capturas before/after, manifiestos, changelog, ledger y PDF completo.
- Renderizar e inspeccionar el PDF y calcular SHA-256.
- Gate: “Fase 3 completada y lista para revisión”. No iniciar Fase 4.
- Estado: **cerrado**; informe de 58 páginas renderizado e inspeccionado, SHA-256 registrado.

## Definición de terminado

- Todas las herramientas y shortcuts existentes siguen disponibles.
- P0/P1 de labels sin colisión y selección inequívoca.
- Cero overflow horizontal, errores de consola o page errors.
- Temas, idiomas, modos, touch, WebKit y zoom 200 % aprobados.
- Cero cambios en rutas protegidas y mismos contratos/resultados matemáticos.
- Informe `structureCo_Informe_Completo_Fase_3.pdf` generado y revisado.
