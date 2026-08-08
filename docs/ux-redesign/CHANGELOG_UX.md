# Changelog UX/UI

## 2026-07-27 — Candidato 0.8.0, Fases 4 a 15

### Consolidado

- Fase 4: tokens, color, tipografía, elevación, motion y roles técnicos.
- Fase 5: biblioteca de componentes y reglas de reutilización.
- Fases 6–7: App Shell, navegación global y sistema canvas-first.
- Fase 8: Inspector por selección con edición numérica segura, unidades,
  validación inline y composiciones responsive.
- Fases 9–10: centro analítico de Resultados y recorrido Aula guiado.
- Fases 11–12: paridad desktop/tablet/móvil, touch, accesibilidad, feedback,
  Light/Dark y catálogos ES/EN.
- Fase 13: consolidación de migración UI, lazy loading y presupuesto de bundle.
- Fase 14: candidato certificado en Chromium/WebKit, 6/6 viewports, 8 capturas,
  384/384 pruebas y frontera matemática intacta.
- Fase 15: versionado 0.8.0, release notes, nueva línea base, mantenimiento,
  retrospectiva, preview, rollback y deploy `6a68469008f16649235e8075`.

### No cambiado

- Solver, engine, workers, datos, defaults físicos, unidades internas, signos,
  topología, geometría, precisión almacenada, persistencia y handlers
  matemáticos.
- El formato de proyecto no requiere migración entre 0.7.0 y 0.8.0.

### Evidencia

- `RELEASE_QA_REPORT.md`, `RELEASE_BASELINE.md`, `PERFORMANCE_REPORT.md`,
  `A11Y_REPORT.md` y `evidence/phase-14/after/`.

## 2026-07-17 - Fase 3, entrega para revisión

### Completado

- Informe final de 58 páginas con alcance, slices, decisiones, QA, trazabilidad, limitaciones y cierre.
- Las diez referencias visuales aprobadas, las 12 capturas before y las 19 capturas after están embebidas con nombre, dimensiones y SHA-256.
- Archivo `structureCo_Informe_Completo_Fase_3.pdf`, de 9,908,217 bytes y SHA-256 `9fa863032d95bd1498e7558ca4da97c4b5902fa9469086c60f4935f9dfd42bb9`.

### Inspeccionado

- Las 58 páginas fueron rasterizadas y revisadas en dos contact sheets y vistas individuales.
- Se corrigieron dos saltos de página de anexos verticales y se repitió la inspección sin páginas vacías, recortes o deformaciones.
- La descripción de cada referencia se contrastó con el título real de las páginas 22, 24, 26, 27, 29, 30, 31, 32, 33 y 35.

### Cierre

- **Fase 3 completada y lista para revisión.**
- Fase 4 no iniciada; requiere autorización expresa.

## 2026-07-17 - Fase 3, Slice 3.7

### Añadido

- `qa-phase3.mjs` con 125 comprobaciones para herramientas, chrome, zonas seguras, capas, labels, selección, teclado, touch, pen, zoom 200 % y WebKit.
- Matriz final de nueve viewports y 19 capturas reproducibles con manifiesto, tamaño y SHA-256 por archivo.
- Cobertura visual adicional para Light/Dark, Completo/Aula, ES/EN, listo/analizado, capas abiertas y cinco tipos de selección.

### Ajustado por QA

- El recorrido Chromium heredado reconoce la separación de Fase 3 entre geometría SVG de reacciones y labels P1 decluttered; continúa comprobando los valores visibles de 2.500 kip.

### Validado

- `npm.cmd run verify`: 47 archivos, 258 pruebas y build aprobados.
- `npm.cmd run qa:phase3`: 125/125 checks, nueve filas, 19 capturas, cero errores de consola o página.
- `npm.cmd run qa:phase2`: 117/117; `npm.cmd run qa`: 63/63; WebKit iPhone 13/iPad Pro 11: PASS.
- Cero overflow horizontal, colisiones P0/P1, intersecciones de chrome o cambios en la frontera protegida.

### No cambiado

- Motor, workers, datos, fórmulas, signos, unidades, precisión, schema, migraciones, persistencia y contratos portables.

## 2026-07-17 - Fase 3, Slice 3.6

### Añadido

- Perfil explícito de entrada para mouse, touch y pen con umbral, arrastre, long-press, coordenadas y target mínimo.
- Descripción accesible del canvas, `aria-keyshortcuts` globales y Enter/Espacio para cada objeto estructural.
- Foco geométrico azul para canvas, miembros, nodos y cargas; utilidad `.sr-only` faltante.

### Ajustado

- Targets del dock de tableta elevados a 44×44 px.
- Hit area de miembros elevada a 44 px bajo `pointer: coarse`; nodos y cargas mantienen piso táctil equivalente.
- Las preferencias `prefers-reduced-motion` eliminan transiciones perceptibles también en el flujo actualizado.

### Validado

- 47 archivos y 258 pruebas aprobadas, incluyendo shortcut H, selección por Enter, Escape y perfil pen.
- Browser 834×1194: cero overflow, targets visibles >=54 px en el dock, atajos ARIA y reduced motion efectivo a 0.001 ms.
- Shortcut H ejercitado realmente en Browser; el modo cambió a Desplazar.

### Limitación declarada

- Pen se valida mediante Pointer Events y pruebas deterministas; no se afirma cobertura con stylus físico.

## 2026-07-17 - Fase 3, Slice 3.5

### Cambiado

- Selección del canvas separada del verde de producto mediante roles azules `--selection` y `--selection-soft` para Light/Dark.
- Miembros con halo geométrico; nodos con anillo y cruceta; apoyos con marco; cargas con halo azul sin perder su color técnico.
- Multiselección con envolvente discontinua, cuatro handles y contador localizado ES/EN.
- Inspector, marquee y labels P0 alineados al mismo rol semántico de selección.

### Validado

- Cuatro pruebas puras cubren los cinco tipos de selección, conteo multi, envolvente, handles y clipping.
- 47 archivos y 256 pruebas aprobadas; lint y build limpios.
- Browser 430×932: carga, miembro, nodo/apoyo y multiselección inspeccionados en Light; multiselección también en Dark.
- La carga distribuida conservó verde técnico mientras el halo y label seleccionados se renderizaron azules.

### No cambiado

- Selección de dominio, handlers, filtros, undo/redo, edición, cálculo, datos o persistencia.

## 2026-07-17 - Fase 3, Slice 3.4

### Añadido

- Motor de presentación `labelLayout.ts` con prioridades P0-P3, LOD por escala, offsets deterministas, zona segura y leader lines.
- Etiquetas unificadas para nodos, miembros, cotas, cargas nodales/de miembro, reacciones y valores críticos de diagramas.
- Metadatos de QA `data-smart-label`, prioridad y nivel de detalle renderizado.

### Integrado

- Las etiquetas seleccionadas son P0 y permanecen disponibles aunque las capas secundarias estén ocultas.
- Nodos y valores de carga/reacción son P1; cotas e IDs de miembro ceden por zoom/espacio; detalles de resultados son P2/P3.
- Los textos de reacción mantienen una descripción SVG accesible mientras su presentación visible pasa al layout común.

### Validado

- Cinco pruebas puras cubren LOD, orden independiente de entrada, ocho P0/P1 densas sin colisión, saturación y leader line.
- Browser integrado 1440×900 y 430×932: labels dentro del safe rect, cero overflow horizontal y composición inspeccionada visualmente.
- La regresión detectada por el test de texto accesible de reacciones fue corregida antes del cierre del gate.

### No cambiado

- Solver, resultados numéricos, unidades, signos, precisión, schema, persistencia o contratos protegidos.

## 2026-07-17 - Fase 3, Slice 3.3

### Añadido

- Estado efímero para Modelo, Cargas, Cotas/ejes, Identificadores, Resultados, Etiquetas, Ayuda y Diagnóstico.
- Panel de capas accesible con switches, Escape, cierre exterior, retorno de foco y restablecimiento.
- Modelo bloqueado como siempre visible; elecciones reiniciadas al cambiar de proyecto.

### Integrado

- Cargas, IDs, cotas, ejes, overlays de resultados, labels, ayuda y mecanismo consumen únicamente gates de presentación.
- Herramientas activas conservan información crítica aunque una capa secundaria esté oculta.

### Validado

- 45 archivos y 247 pruebas aprobadas; reducer y panel cubiertos unitariamente.
- Browser 1024 y 430: ocho switches, modelo fijo, cargas 5 -> 2 controles chrome -> 5 al restablecer, tres miembros siempre presentes.

### No cambiado

- `ProjectModel`, `ProjectSettings`, schema, migraciones, persistencia, solver o resultados.

## 2026-07-17 - Fase 3, Slice 3.2

### Cambiado

- Zonas seguras explícitas para modo activo, status de vista, coordenadas, cámara y contenido técnico.
- `Ajustar a vista` usa el rectángulo libre de chrome y reserva espacio para flechas/textos de carga.
- Cámara agrupada horizontalmente abajo a la derecha; escala centrada y ejes globales aislados abajo a la izquierda.
- Readout de coordenadas de cursor en desktop/pen sin rerenderizar el canvas durante el movimiento.
- HUD móvil reducido: touch hint, escala y cámara sin solapamientos; chips secundarios ocultos en teléfonos estrechos.

### Validado

- Tests puros de insets/fit y pruebas de interacción existentes: PASS.
- 43 archivos, 242 pruebas, lint y build aprobados.
- Browser 1440, 430 y 390: modelo/cargas completos, chrome discreto y sin overlap visible.

### No cambiado

- Geometría del modelo, resultados, unidades, ProjectSettings, persistencia o motor.

## 2026-07-17 - Fase 3, Slice 3.1

### Cambiado

- Registro único para las 12 herramientas, sus 11 teclas de activación y `Delete`/`Backspace` contextual.
- ToolRail agrupado en Navegar, Crear, Cargas, Anotar e inspeccionar y Editar.
- Rail expandido desde 1440 px, compacto entre 1024 y 1439 px y dock inferior hasta 1023 px.
- Sheet Más agrupado por intención; cinco destinos frecuentes más acceso a Más en el dock.
- Estado activo usa verde de producto; la acción Eliminar conserva advertencia roja cuando está inactiva.

### Validado

- 42 archivos y 238 pruebas aprobadas; lint y build limpios.
- Browser: grupos accesibles, rail wide/compact, dock y sheet Más verificados en 1536, 1366 y 390 px.
- Las 12 herramientas, todos los shortcuts y el comportamiento Aula avanzado permanecen accesibles.

### No cambiado

- Handlers de herramienta, undo/redo, selección, edición, motor, datos, schema o persistencia.

## 2026-07-17 - Fase 3, Slice 3.0

### Preparado

- PDF rector de 56 páginas leído, renderizado y auditado visualmente.
- Diez referencias aprobadas identificadas para herramientas, canvas, capas, labels, selección y gestos.
- Rama `phase/3-canvas-tools`, baseline real y frontera protegida registrados.
- Plan de slices 3.1-3.8, decisiones y ledger inicial creados.

### Evidencia

- Doce capturas before que cubren los nueve viewports obligatorios, Light/Dark, listo/analizado y selección de miembro.
- Manifiesto por archivo con viewport, raster, bytes y SHA-256.
- Contact sheet revisado visualmente.

### Validado

- `verify`: 41 archivos, 233 pruebas y build aprobados.
- `qa:phase2`: 117 checks; `qa` Chromium y `qa:webkit` aprobados sin errores.

### No cambiado

- Ningún archivo bajo `src/`.
- Motor, workers, dominio, schema, migraciones, persistencia, importación/exportación, fórmulas, signos, unidades y precisión.

## 2026-07-17 - Fase 2, entrega final

### Entregado

- Informe completo de 39 páginas con alcance, cambios, decisiones, trazabilidad, pruebas y todas las capturas de referencia, antes y después.
- Archivo `structureCo_Informe_Completo_Fase_2.pdf`, con SHA-256 `e3ee011026c7974ccce2b7242e279e4dfc48163575d2a7539762a0187576e7a4`.
- Correo enviado a `crisdlm302@gmail.com` con el PDF adjunto.

### Verificado

- Mensaje localizado en Enviados con ID Gmail `19f716b2005b62cf`.
- Destinatario, asunto y adjunto de 5,444,459 bytes confirmados mediante lectura posterior al envío.
- Portada y página de trazabilidad renderizadas nuevamente desde la versión final del PDF sin recortes ni deformaciones.

### Cierre

- Fase 2 completada; Fase 3 no iniciada.
- Motor matemático, workers, fórmulas, precisión, signos, unidades, schema y persistencia preservados.

## 2026-07-17 - Fase 2, Slice 2.7

### Añadido

- `qa-phase2.mjs` con 117 checks geométricos, de estados, contraste, foco, reduced motion y zoom 200 %.
- 13 capturas after y métricas JSON reproducibles.
- Captura controlada de loading real, retrasando únicamente la entrega del mensaje del worker en la página de QA.

### Ajustado por QA

- Ancho estable de Analizar en ES/EN durante loading.
- Roles de primer plano AA para warning/error en Light.
- Padding móvil corregido para que controles de 44 px permanezcan dentro del header en landscape/zoom.
- QA Chromium actualizado para acceder a idioma y tema desde el overflow vigente.

### Validado

- `qa:phase2`: 117/117; Chromium heredado: 63/63; WebKit iPhone/iPad: PASS.
- Cero errores de consola o página.
- Comparación visual directa contra referencias A-E aprobada.

### No cambiado

- Motor, workers productivos, fórmulas, precisión, signos, unidades, schema, persistencia y fixtures.

## 2026-07-17 - Fase 2, Slice 2.6

### Consolidado

- Declaraciones visuales de TopBar y controles reunificadas en su bloque principal.
- Selectores huérfanos del antiguo switch de tema eliminados.
- Popovers alineados con tokens de stacking, radio, spacing, borde y sombra.

### Validado

- Lint sin warnings y build aprobado.
- Tokens Light/Dark comprobados en Browser.
- Matriz de nueve viewports repetida sin intersecciones, salidas del header u overflow horizontal.

### No cambiado

- Ningún archivo de motor, dominio, datos, persistencia, importación/exportación o fixtures.

## 2026-07-17 - Fase 2, Slice 2.5

### Añadido

- Indicador global del análisis con estados listo, calculando, actualizado, desactualizado, advertencia y error.
- Acceso directo desde warning/error al tab Avisos, incluida expansión del panel móvil.
- Traducciones ES/EN y pruebas unitarias de precedencia, ciclo por proyecto y acción accesible.

### Validado

- Estados reales listo, actualizado, desactualizado y error en Browser.
- Nueve viewports de 390 a 1536 px sin intersecciones, elementos fuera del header u overflow horizontal.
- Targets 44 x 44 px en 390, 430 y 834 px.
- `npm.cmd run verify`: 41 archivos, 233 pruebas y build aprobados.

### No cambiado

- Solver, workers, fórmulas, contratos, signos, unidades, precisión, persistencia o resultados.

## 2026-07-17 - Fase 2, Slice 2.4

### Cambiado

- TopBar reorganizada en Documento, Contexto y Acciones.
- Guardado se integra en Documento; historial pasa a Acciones.
- Idioma, tema y utilidades secundarias se concentran en un overflow disponible a cualquier ancho.
- Caso, modo, unidades, export e historial se mueven progresivamente antes de colisionar.

### Validado

- Nueve viewports de 390 a 1536 px: cero intersecciones, cero elementos fuera del header y cero overflow horizontal.
- Nombre largo y copys ES/EN sin colisión.
- Overflow dentro del viewport, focus ring de 3 px, Escape y retorno de foco.
- `npm.cmd run verify`: 40 archivos, 230 pruebas y build aprobados.

### No cambiado

- Payload de Analizar, semántica de historial, exportación o estado del proyecto.

## 2026-07-17 - Fase 2, Slice 2.3

### Cambiado

- Breakpoint funcional tablet ampliado a 1023 px en shell, dock, resultados e inspector.
- Rango 1024-1279 usa rail compacto de 76 px e inspector de 290 px.
- Utilidades secundarias pasan al overflow antes de comprimir el canvas.

### Validado

- 1194, 1024, 834 y 390 px: cero intersecciones y cero overflow horizontal.
- Canvas útil en 1194 x 834: 828 x 414 px.
- Selección M2 y análisis resuelto conservados durante todos los cambios de viewport.
- Drawer de inspector con fondo inert, cierre correcto y retorno de foco.
- `npm.cmd run verify`: 40 archivos, 229 pruebas y build aprobados.

### No cambiado

- Estado matemático, cálculo, resultados, selección y persistencia.

## 2026-07-17 - Fase 2, Slice 2.2

### Cambiado

- Piso legible de 12 px para texto técnico, resultados, warnings y metadatos críticos.
- Controles y menús a 14 px; números tabulares conservados.
- Targets de TopBar, cámara e inspector a 44 x 44 px en tablet/móvil.
- Focus ring semántico azul y ancho estable del botón Analizar durante loading.

### Validado

- Browser 834 x 1194: ocho controles frecuentes medidos en 44 x 44 px, cero overlaps y cero overflow horizontal.
- Menú secundario dentro del viewport, foco visible y retorno al trigger con Escape.
- `npm.cmd run verify`: 40 archivos, 229 pruebas y build aprobados.

### No cambiado

- Valores, precisión, unidades y contratos matemáticos.

## 2026-07-17 - Fase 2, Slice 2.1

### Añadido

- Repositorio Git local, commit baseline `85f671d` y rama `phase/2-ui-foundations`.
- Capa `src/styles/tokens.css` con primitives, roles semánticos, magnitudes técnicas, spacing, radius, elevation, tipografía, controles, layout, motion y z-index.
- Documentación de tokens y política de aliases incrementales.

### Validado

- Light/Dark definidos desde una fuente semántica común.
- Marca, selección, estados y magnitudes técnicas separados.
- `npm.cmd run verify`: 40 archivos, 229 pruebas y build aprobados.

### No cambiado

- Motor, workers, datos, schema, persistencia, importación/exportación y fixtures.

## 2026-07-17 - Fase 2, Slice 2.0

### Aprobado

- Fase 1 aprobada formalmente por el documento rector de Fase 2.
- Fase 2 autorizada dentro de tokens, tipografía, targets, App Shell, TopBar, indicador de análisis y QA.

### Añadido

- Plan de Fase 2 con pregunta bloqueante, supuestos, mapa de archivos y gates por slice.
- Fidelity ledger inicial contra las cinco referencias aprobadas del PDF.
- Baseline técnico reproducible del Slice 2.0.
- Siete capturas P0 deterministas y métricas geométricas de TopBar.

### Validado

- `npm.cmd run verify`: 40 archivos, 229 pruebas y build aprobados.
- `npm.cmd run qa`: Chromium aprobado, sin errores de consola/página.
- `npm.cmd run qa:webkit`: iPhone 13 e iPad Pro 11 emulados aprobados.
- Interacciones: abrir Pórtico de ejemplo y ejecutar Analizar.

### Bloqueo

- No existe repositorio Git válido; no es posible crear rama/worktree hasta que el propietario autorice inicialización o acepte trazabilidad alternativa.

### No cambiado

- Ningún archivo bajo `src/`.
- Motor, workers, datos, schema, persistencia, importación/exportación, pruebas y fixtures.

## 2026-07-17 — Fase 1

### Añadido

- Línea base técnica y visual reproducible.
- Auditoría UX/UI con hallazgos P0–P2 y criterios de aceptación.
- Inventario de superficies, herramientas, inspector, resultados y estados.
- Recorridos para estudiante inicial/avanzado, profesor y profesional.
- Backlog priorizado.
- Decisión explícita conservar/transformar/retirar.
- Matriz de QA, registro de decisiones, estado de fase y handoff.
- Doce capturas de evidencia en desktop, laptop, tableta, móvil, claro/oscuro, Completo/Aula y error/importación.

### Validado

- `npm.cmd run verify`: 40 archivos, 229 pruebas y build aprobados.
- `npm.cmd run qa`: aprobado en Chromium.
- `npm.cmd run qa:webkit`: aprobado en iPhone 13 e iPad Pro 11 emulados.
- Consola limpia durante el recorrido manual.

### No cambiado

- Código productivo bajo `src/`.
- Motor matemático, workers, fórmulas, unidades, precisión y convenciones.
- Pruebas y fixtures.
- Contratos de persistencia, importación o exportación.

### Artefactos generados/refrescados

- `docs/ux-redesign/`.
- Capturas dentro de `docs/ux-redesign/evidence/baseline/`.
- Salidas existentes de `qa-artifacts/` y `dist/` fueron regeneradas por los comandos de validación; no son cambios de lógica.
