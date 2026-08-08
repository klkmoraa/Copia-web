# Arquitectura de información de Resultados - Fase 9

## Propósito

`ResultsPanel` es el centro analítico de structureCo. Organiza la salida existente para que una persona pueda responder, en orden: si el modelo resolvió, qué gobierna, dónde ocurre, cómo se relaciona con la geometría y qué debe corregirse o comprenderse después.

La Fase 9 transforma la presentación, no el cálculo. El canvas sigue siendo el documento principal y Resultados es una superficie de apoyo vinculada a él.

## Fuente de verdad y frontera protegida

| Capa | Fuente autoritativa | Responsabilidad de Resultados |
| --- | --- | --- |
| Modelo y selección | `ProjectContext` y contratos de selección existentes | Consumir selección y emitir las acciones públicas actuales. |
| Análisis | `AnalysisResult` producido por el solver | Ordenar y presentar resultados; nunca recalcularlos. |
| Diagramas y extremos | Segmentos, saltos, puntos críticos y deformación existentes | Trazar, etiquetar y navegar los valores recibidos. |
| Unidades | `toDisplay` y `unitLabel` de `src/engine/units.ts` | Convertir exclusivamente para presentación. |
| Estado educativo | Sesión de Aula existente | Guiar revelado y comparación sobre el mismo análisis. |
| Estado de interfaz | Tab, altura, expansión, cursor y foco existentes | Mantenerlo como estado de presentación, fuera del proyecto estructural. |

Quedan fuera de alcance el solver, polinomios, raíces, extremos, envolventes, signos, tolerancias, unidades internas, topología, geometría, persistencia del proyecto, IDs y handlers matemáticos. Un valor mostrado no vuelve al modelo ni se convierte en una segunda fuente de verdad.

## Jerarquía del centro analítico

1. **Estado del análisis.** Listo, calculando, resuelto, desactualizado, fallido o bloqueado por Aula.
2. **Resumen gobernante.** Magnitudes absolutas, ubicación, miembro o nodo y acceso directo al origen.
3. **Resultado principal.** Tabla, diagrama o explicación de la familia activa.
4. **Contexto de lectura.** Selección, caso/combinación, unidad, estación y lado de discontinuidad.
5. **Acciones secundarias.** Comparar casos, copiar/exportar, mostrar en lienzo o corregir.

La jerarquía evita convertir cada dato en una tarjeta. Encabezados, tabs, tablas y agrupaciones ligeras tienen prioridad sobre superficies decorativas.

## Familias y tabs

Los IDs actuales permanecen estables. Las familias son una capa de orientación y no crean resultados alternos.

| Familia | Tab actual | Pregunta que responde | Contenido principal |
| --- | --- | --- | --- |
| Visión general | `summary` | ¿Qué magnitudes gobiernan y dónde? | Extremos absolutos, ubicación, comparación de escenarios y acciones de documentación. |
| Visión general | `reactions` | ¿Cómo responde cada apoyo o nodo? | Desplazamientos, rotación, reacciones y momento nodal con unidades visibles. |
| Esfuerzos | `axial` | ¿Cómo varía N a lo largo del miembro? | Diagrama N, extremos, ceros, saltos y cursor compartido. |
| Esfuerzos | `shear` | ¿Cómo varía V a lo largo del miembro? | Diagrama V, extremos, ceros, saltos y cursor compartido. |
| Esfuerzos | `moment` | ¿Cómo varía M a lo largo del miembro? | Diagrama M, extremos, ceros y cursor compartido. |
| Respuesta | `deformed` | ¿Cómo se desplaza y rota el miembro? | Respuestas u, v y θ, máximos interiores y cursor compartido. |
| Análisis avanzado | `influence` | ¿Cómo cambia la respuesta al recorrer la estructura? | Línea de influencia y estado sincronizado con el canvas. |
| Comprensión | `learn` | ¿Cómo se obtiene y verifica el resultado? | Procedimiento, GDL, elemento, ensamble, solución y verificación del análisis real. |
| Estado | `issues` | ¿Qué impide o compromete el análisis y cómo se corrige? | Issues separados por severidad, objeto afectado y acción contextual. |

En escritorio las familias pueden actuar como rótulos o agrupaciones dentro de la misma navegación. En espacios estrechos se usa una navegación jerárquica o desplazable que conserva los nueve destinos; no se oculta ninguna capacidad.

## Modos de presentación

| Modo | Uso | Contenido visible | Regla de composición |
| --- | --- | --- | --- |
| Cerrado | Recuperar el máximo espacio de modelado | Invocador y estado resumido | El cierre conserva el último destino y devuelve el foco al invocador. |
| Compacto | Monitorear el análisis mientras se modela | Estado, familia/tab activo y valor o issue gobernante | No comprime gráficas o matrices hasta hacerlas ilegibles. |
| Expandido | Lectura y comparación habitual | Navegación, contexto, resultado y acciones | Redimensionable; el canvas permanece visible en desktop. |
| Enfocado | Interpretación detallada | Una familia con mayor área, trazabilidad y navegación entre entidades | Reduce chrome secundario, no datos. |
| Pantalla completa | Matrices, comparación o móvil | Resultado completo, contexto y salida segura | Tiene título, cerrar/volver, foco contenido y retorno al origen. |

El tamaño y último destino son preferencias de presentación. Si se conservan entre sesiones, se hace mediante el mecanismo UI vigente; nunca se añaden al schema del proyecto ni afectan undo/redo.

## Estados del contenido

| Estado | Mensaje y contenido | Acción primaria | Comportamiento |
| --- | --- | --- | --- |
| Sin análisis | Explica que el modelo está listo o cuál es el siguiente paso de Aula | Analizar o activar la herramienta sugerida | No muestra ceros como sustituto de resultados. |
| Calculando | Mantiene el contexto y anuncia progreso | Ninguna acción destructiva | `aria-busy`; evita saltos de layout y resultados parciales inventados. |
| Resuelto | Indica vigencia, caso/combinación y unidades | Explorar o localizar | Consume exclusivamente el análisis terminado. |
| Desactualizado | Explica que el modelo cambió y los datos ya no representan el estado actual | Volver a analizar | Distingue visualmente valores históricos sin tratarlos como vigentes. |
| Fallido | Resume el fallo sin mezclarlo con magnitudes físicas | Abrir Avisos | No rellena tabs con valores vacíos o ficticios. |
| Sin objeto compatible | Conserva la familia y pide una selección aplicable | Seleccionar miembro/nodo | No cambia de tab de forma inesperada. |
| Aula bloqueada | Pide predecir o revelar según la sesión | Predecir o revelar y comparar | Usa el mismo análisis; no crea una respuesta educativa paralela. |
| Sin issues | Confirma estado limpio con texto e icono | Volver a resultados | El éxito no depende solo del verde. |
| Error de comparación/exportación | Explica problema, impacto y siguiente acción | Reintentar o cerrar | El resultado base permanece disponible. |

Los mensajes siguen la fórmula **problema o estado → impacto → acción**. Loading, error, warning, success, disabled y stale combinan icono, texto y color.

## Trazabilidad modelo → resultado

| Selección existente | Destino y filtro esperados |
| --- | --- |
| Ninguna | Resumen global; los diagramas usan el miembro de resultado vigente sin crear selección nueva. |
| Nodo | Reacciones y avisos priorizan la fila o issue de ese nodo. |
| Miembro | N/V/M, deformada, influencia y resumen muestran ese miembro. La estación fijada se mantiene si sigue dentro de su dominio. |
| Apoyo | Se localiza mediante su nodo y se prioriza la respuesta compatible usando las relaciones existentes. |
| Carga puntual, distribuida o momento | Se conserva la selección y se contextualiza el miembro asociado solo cuando esa relación ya existe en el modelo. No se infiere geometría nueva. |
| Selección múltiple | Resumen global y comparación conservan el conjunto. Las vistas de un miembro consumen el elemento primario según el orden canónico actual y muestran el conteo del conjunto. |

Cambiar la selección filtra el contenido compatible, pero no ejecuta análisis, cambia valores, inventa un orden alterno ni elimina una selección múltiple.

## Trazabilidad resultado → modelo

- Un extremo gobernante selecciona su miembro y fija la estación correspondiente.
- Una reacción selecciona el nodo asociado.
- Un renglón de procedimiento o GDL resalta los nodos/miembros ya referenciados por el trace.
- Un issue con `objectId` selecciona el objeto y solicita enfocarlo en el canvas; un issue sin objeto usa la herramienta sugerida existente.
- Cambiar el miembro desde un diagrama actualiza la selección mediante `setSelection` y limpia únicamente el cursor que ya no sea válido.
- Selección y foco usan azul; el color técnico N/V/M no se convierte en color de selección.

Cada acción debe ser reversible mediante otra selección normal y respetar shortcuts, historial y contratos actuales. Navegar por resultados no crea una entrada de undo.

## Cursor compartido

El cursor representa `{ memberId, x, pinned }` y se comparte entre N, V, M y deformación. La lectura fija conserva miembro y estación al cambiar de tab; el valor se evalúa mediante los helpers existentes para la magnitud activa.

- Hover o arrastre ofrece lectura transitoria; click/tap fija o libera.
- Flecha izquierda/derecha recorre la estación; `Shift` usa un paso mayor; `Inicio` y `Fin` saltan a los extremos.
- El snap usa extremos, límites de tramo, saltos y puntos críticos existentes.
- En una discontinuidad se muestran explícitamente valor izquierdo y derecho. Nunca se dibuja ni reporta un promedio que no exista.
- El readout reúne estación y N/V/M, o u/v/θ, con unidades visibles. Fijar el cursor no modifica el modelo.

## Navegación y teclado

- La navegación principal usa `role="tablist"`, `role="tab"` y roving `tabIndex`.
- Flechas izquierda/derecha cambian tab; `Inicio`/`Fin` van al primero/último.
- El separador de resize es operable con flechas arriba/abajo, `Shift` para incremento mayor e `Inicio`/`Fin` para límites.
- Cada gráfica tiene nombre y descripción accesibles, recibe foco y admite su cursor por teclado.
- Tab avanza por navegación, contexto, gráfica/tabla y acciones en orden visual.
- Escape cierra el modo enfocado/pantalla completa o libera la capa activa y devuelve el foco al invocador; no borra selección ni análisis.
- Las actualizaciones de estado se anuncian sin leer de nuevo toda la tabla o gráfica.

## Tablas, unidades y formato

- Encabezados de fila y columna usan semántica de tabla; títulos persistentes describen entidad, magnitud y caso.
- Encabezados permanecen visibles al hacer scroll en tablas largas; el foco no queda oculto bajo ellos.
- Texto a la izquierda; números a la derecha con cifras tabulares y signo visible cuando sea significativo.
- Cada columna muestra su unidad en el encabezado. La estación usa la unidad de longitud activa y θ usa `rad`.
- Los valores consumen `toDisplay`/`unitLabel` y formatters presentacionales. Cambiar unidad no altera el resultado almacenado.
- Precisión de lectura: decimal compacto para acciones habituales; notación científica para desplazamientos, residuos y escalas extremas. La vista/copia técnica puede conservar más cifras.
- `0` solo representa cero real. No se agrega una tolerancia de UI para esconder residuos ni se redondea destructivamente.
- Copiar/exportar conserva encabezados, unidades, identidad de entidad/caso y precisión suficiente para trazabilidad.

## Responsive

### Desktop, ≥ 1024 px

Panel inferior persistente y redimensionable. Compacto mantiene canvas y estado; expandido permite tabla/gráfica más contexto. El modo enfocado amplía Resultados sin perder una ruta directa al lienzo.

### Tablet, 701-1023 px

Drawer o sheet de Resultados sobre el canvas, con backdrop, focus trap, Escape y retorno de foco. Una tabla o gráfica conserva su ancho útil mediante scroll interno; no se escala hasta volverla ilegible.

### Móvil, ≤ 700 px

Bottom sheet compacto para estado y resultado rápido; pantalla dedicada para gráfica, matrices, comparación y detalle. La navegación usa targets de 44 px, respeta safe areas y nunca queda detrás del teclado o dock.

La composición cambia, pero familias, resultados y acciones siguen disponibles en los tres formatos.

## Separación entre resultados, comprensión y diagnóstico

- **Resultados** responde qué y dónde con valores físicos.
- **Análisis avanzado** compara influencia, casos y envolventes sin sustituir el resultado base.
- **Comprensión** explica cómo se obtuvo usando traces reales.
- **Estado/Avisos** explica por qué no se puede confiar todavía o qué debe corregirse.
- **Aula** controla el momento de predecir/revelar y se desarrolla en la Fase 10; no contamina tabs físicos con contenido simulado.

## Criterios de aceptación

- Los nueve IDs y contratos actuales siguen estables y quedan agrupados por propósito.
- Todos los estados distinguen estado, impacto y acción sin inventar valores.
- Seleccionar en el modelo filtra resultados y actuar desde un resultado localiza el objeto correcto.
- El cursor mantiene miembro/estación entre N/V/M/deformación y reporta ambos lados de cada salto.
- Closed/compact/expanded/focused/full-screen tienen una salida clara y preservan contexto.
- Tablas y gráficas son legibles en desktop, tablet y móvil, Light/Dark y teclado.
- Valores, signos, unidades internas, extremos, issues, exportes y análisis coinciden con baseline y fixtures.

## Exclusiones explícitas

- No crear un dashboard de métricas ficticias ni un segundo centro de análisis.
- No agrupar datos que cambien su significado físico.
- No recalcular curvas, extremos, envolventes, discontinuidades o governing values en componentes visuales.
- No cambiar IDs de tabs, selecciones, resultados, casos o combinaciones por conveniencia visual.
- No guardar estado de panel dentro del proyecto ni incorporarlo a undo/redo.
- No usar color como único indicador ni confundir verde de acción, azul de selección y colores técnicos.
- No comprimir matrices o gráficas para evitar una composición responsive apropiada.
