## TABLA A — Inventario condensado (122 tareas)

### Entrada — 15 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `ENT-01` | Elegir por dónde empezar al abrir la app | Pantalla completa propia, fuera del shell del workspace. | 1 Global persistente (pantalla propia) | alta (inferencia) | esencial |
| `ENT-02` | Continuar el proyecto en el que estaba | Botón principal de la Welcome. | 1 Global persistente | alta (inferencia) | esencial |
| `ENT-03` | Crear un proyecto en blanco | Welcome + menú desplegable del nombre de proyecto (TopBar). | 1 Global persistente + 2 Contextual a proyecto | media (inferencia) | esencial |
| `ENT-04` | Abrir un ejemplo / plantilla | Tarjetas de la Welcome + menú de proyecto del TopBar. | 1 Global persistente + 9 Fullscreen (Welcome) | media (evidencia) | esencial |
| `ENT-05` | Filtrar plantillas por tipo | Chips en la Welcome. | 9 Fullscreen (auxiliar de la lista) | baja (inferencia) | secundaria |
| `ENT-06` | Ver y abrir proyectos guardados (Project Hub) | Sólo en la Welcome, tras `Phase2ProjectHub`. | 1 Global persistente + 9 Fullscreen / datos densos | media (inferencia) | esencial |
| `ENT-07` | Renombrar un proyecto guardado | Sólo en el Hub. | 8 Configuración / 9 Fullscreen | baja (inferencia) | secundaria |
| `ENT-08` | Duplicar un proyecto guardado | Sólo en el Hub. | 8 Configuración / 9 Fullscreen | baja (inferencia) | secundaria |
| `ENT-09` | Restaurar una recuperación tras conflicto | Sólo en el Project Hub, dentro de la Welcome. | 2 Contextual a proyecto + 6 Workflow temporal | baja (evidencia) | esencial |
| `ENT-10` | Importar JSON / bundle / PDF (Import Center) | Menú de proyecto del TopBar y Welcome. | 6 Workflow temporal | baja (inferencia) | esencial |
| `ENT-11` | Importar geometría desde DXF | SÓLO en la Welcome. | 6 Workflow temporal | baja (inferencia) | contextual |
| `ENT-12` | Crear un ejercicio de Aula | Botón «Nuevo ejercicio» de la Welcome. | 6 Workflow temporal | baja (inferencia) | contextual |
| `ENT-13` | Renombrar el proyecto abierto | TopBar, zona documento. | 2 Contextual a proyecto | media (inferencia) | esencial |
| `ENT-14` | Volver a Inicio desde la mesa | Marca del TopBar. | 1 Global persistente | media (inferencia) | esencial |
| `ENT-15` | Abrir Space 3D | Botón de icono del TopBar + tarjeta de la Welcome + menú «Más» en Compact. | 9 Fullscreen (dominio separado) | baja (inferencia) | secundaria |

### Shell — 24 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `SHL-01` | Ejecutar el análisis | TopBar, extremo derecho, siempre visible. | 1 Global persistente | alta (evidencia) | esencial |
| `SHL-02` | Saber en qué estado está el análisis | TopBar (chip) + cabecera del panel de Results (texto de estado). | 2 Contextual a proyecto/análisis | alta (evidencia) | esencial |
| `SHL-03` | Deshacer | TopBar (icono), menú «Más» (primer bloque), Command Palette. | 1 Global persistente | alta (inferencia) | esencial |
| `SHL-04` | Rehacer | Idéntico a SHL-03. | 1 Global persistente | media (inferencia) | esencial |
| `SHL-05` | Abrir la paleta de comandos | ToolRail + atajo + hoja «Más» móvil. | 7 Power-user / Command Palette | avanzada (inferencia) | contextual |
| `SHL-06` | Navegar a un nudo o barra por identificador | Sólo en la paleta. | 7 Power-user | avanzada (inferencia) | contextual |
| `SHL-07` | Elegir caso de carga o combinación a analizar | TopBar zona contexto (oculta en Compact) + «Más» + Inspector › Cargas. | 2 Contextual a proyecto/análisis | alta (inferencia) | esencial |
| `SHL-08` | Cambiar el modo de cálculo (Aula / Completo) | CUATRO sitios: TopBar zona contexto, «Más», Inspector › Vista, y el propio guía. | 8 Configuración / preferencias | baja (inferencia) | configuración |
| `SHL-09` | Elegir el orden de análisis (1.º orden / P-Delta) | TopBar zona contexto + «Más». | 2 Contextual a proyecto/análisis | baja (inferencia) | esencial |
| `SHL-10` | Ajustar los parámetros avanzados de P-Delta | SÓLO dentro del popover «Más», bajo un `<details>` colapsado, dentro de una sección. | 8 Configuración + 2 Contextual a análisis | avanzada (inferencia) | contextual |
| `SHL-11` | Cambiar el sistema de unidades | TopBar zona contexto + «Más» › Preferencias. | 8 Configuración / preferencias | baja (inferencia) | esencial |
| `SHL-12` | Cambiar el idioma | Welcome (cabecera y drawer) + «Más» › Preferencias. NO está en el TopBar de Expanded fuera del cajón. | 8 Configuración / preferencias | baja (inferencia) | configuración |
| `SHL-13` | Cambiar el tema (claro / oscuro) | CUATRO sitios: Welcome, «Más», Command Palette, y Space3D con su propia lógica. | 8 Configuración / preferencias | baja (inferencia) | configuración |
| `SHL-14` | Abrir Model Doctor | Botón propio en TopBar (oculto por CSS bajo 1024px), «Más» (3.ª entrada), paleta, AnalysisStatus, Results fallido. | 2 Contextual a proyecto/análisis | media (inferencia) | esencial |
| `SHL-15` | Abrir la hoja de datos (Datasheet) | Icono en TopBar + paleta. En Compact el icono NO se oculta (a diferencia de Model Doctor). | 9 Fullscreen / datos densos | media (inferencia) | esencial |
| `SHL-16` | Ocultar / mostrar el Inspector | SÓLO dentro del menú «Más» › Vistas. | 8 Configuración de layout (hoy) / debería estudiarse como 4 Canvas-local | media (inferencia) | contextual |
| `SHL-17` | Entrar/salir de «mesa completa» | SÓLO «Más» › Vistas. | 8 Configuración de layout | baja (inferencia) | contextual |
| `SHL-18` | Contraer el ToolRail a iconos | SÓLO «Más» › Vistas. | 8 Configuración de layout | baja (inferencia) | contextual |
| `SHL-19` | Redimensionar el Inspector | Borde izquierdo del Inspector. | 4 Canvas-local (negocia el reparto con el lienzo) | baja (inferencia) | contextual |
| `SHL-20` | Elegir el detent de la hoja Inspector en táctil | Grupo de tres botones en la cabecera de la hoja. | 6 Workflow temporal / hoja | media (inferencia) | contextual |
| `SHL-21` | Conocer el estado de persistencia y conectividad | Chip en TopBar (colapsa a icono en Compact) y bloque con descripción dentro de «Más». | 1 Global persistente | alta (evidencia) | esencial |
| `SHL-22` | Exportar el proyecto y compartirlo | Menú de exportación (icono propio) en TopBar + sección Exportar de «Más» (las 7 repetidas) + 4 comandos en la paleta. | 2 Contextual a proyecto + 8 Configuración/utilidad | baja (inferencia) | esencial |
| `SHL-23` | Recibir avisos transitorios (toasts) | Sobre el lienzo, dentro del `workspace` slot. | 1 Global persistente (canal) | media (evidencia) | contextual |
| `SHL-24` | Actualizar la app instalada (PWA) | Aviso propio. | 1 Global persistente | baja (evidencia) | secundaria |

### Modelado — 16 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `MOD-01` | Elegir herramienta activa | ToolRail (164px permanentes en Expanded) + dock flotante de 5 botones en Compact. | 1 Global persistente (crear) + 4 Canvas-local | alta (evidencia) | esencial |
| `MOD-02` | Crear un nudo | Lienzo, con la herramienta activa. | 4 Canvas-local | alta (inferencia) | esencial |
| `MOD-03` | Crear una barra | Lienzo. | 4 Canvas-local + 6 Workflow temporal (los dos tiempos) | alta (inferencia) | esencial |
| `MOD-04` | Aplicar o cambiar un apoyo | Lienzo (rápido, tipo por defecto) + Inspector (completo) + Datasheet (columna) + Bulk Edit (masivo). | 3 Contextual a selección + 5 Inspector/detail | alta (inferencia) | esencial |
| `MOD-05` | Colocar una carga puntual | Lienzo + hoja «Cargas» del dock táctil + pestaña Cargas del Inspector (que sólo ELIGE la herramienta y cierra). | 4 Canvas-local + 3 Contextual a selección | alta (inferencia) | esencial |
| `MOD-06` | Colocar una carga distribuida | Lienzo + hoja «Cargas» + Inspector › Cargas. | 4 Canvas-local + 3 Contextual a selección | alta (inferencia) | esencial |
| `MOD-07` | Colocar un momento | Lienzo + hoja «Cargas» + Inspector › Cargas. | 4 Canvas-local + 3 Contextual a selección | media (inferencia) | esencial |
| `MOD-08` | Dividir una barra (Split) | Rail grupo «Editar» + hoja «Más» táctil + paleta. | 3 Contextual a selección + 4 Canvas-local | media (inferencia) | esencial |
| `MOD-09` | Borrar objetos | Rail (destructiva) + tecla + hoja «Más». | 3 Contextual a selección | alta (inferencia) | esencial |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | Lanzador `open-structural-edit` que SÓLO aparece en el grupo «Editar» del rail cuando hay selección válida, y en la hoja «Más» táctil bajo la misma condición. | 3 Contextual a selección + 6 Workflow temporal | media (inferencia) | esencial |
| `MOD-11` | Entrada numérica rápida durante la colocación | Sobre el lienzo, durante la colocación. | 6 Workflow temporal | media (inferencia) | esencial |
| `MOD-12` | Repetir la última operación (Repeat) | Tecla `R` + overlay contextual sobre el lienzo. | 3 Contextual a selección | media (inferencia) | contextual |
| `MOD-13` | Copiar, pegar y duplicar | SÓLO por teclado. No hay botón, entrada de menú ni comando de paleta para copiar/pegar/duplicar. | 3 Contextual a selección + 7 Power-user | media (inferencia) | esencial |
| `MOD-14` | Generar una estructura completa | Botón propio en el grupo «Crear» del rail + hoja «Más» › Crear + comando de paleta. | 1 Global persistente (crear) + 6 Workflow temporal | media (inferencia) | esencial |
| `MOD-15` | Medir con la herramienta de dimensión | Rail grupo «Inspeccionar» + hoja «Más» + paleta. | 4 Canvas-local | baja (inferencia) | secundaria |
| `MOD-16` | Hacer un corte para leer valores internos | Rail grupo «Inspeccionar» + hoja «Más» + paleta. | 3 Contextual a selección + 2 Contextual a análisis | media (inferencia) | contextual |

### Selección — 7 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `SEL-01` | Seleccionar un objeto | Lienzo (clic/tap), Datasheet (fila), paleta (por ID), Model Doctor (localizar), tarjetas de Results (objeto crítico). | 3 Contextual a selección (es la fuente del contexto) | alta (evidencia) | esencial |
| `SEL-02` | Resolver objetos solapados con puntero | Lienzo, automático. | 4 Canvas-local + 6 Workflow temporal | alta (evidencia) | esencial |
| `SEL-03` | Seleccionar con marco (box select) | Lienzo. | 4 Canvas-local | alta (inferencia) | esencial |
| `SEL-04` | Multiselección acumulativa | Lienzo (Shift+clic, marco) + Datasheet (filas, rango). | 3 Contextual a selección | media (inferencia) | esencial |
| `SEL-05` | Deseleccionar | Escape + clic en el fondo. | 3 Contextual a selección | alta (evidencia) | esencial |
| `SEL-06` | Filtrar qué tipos son seleccionables | Inspector › Vista › sección «Precisión CAD», tras `selectionDragHelp`. | 4 Canvas-local (hoy clasificado como 8 Configuración) | media (inferencia) | contextual |
| `SEL-07` | Precisión táctil: ver bajo el dedo | Automática sobre el lienzo. | 4 Canvas-local | alta (en táctil) (evidencia) | esencial |

### Lienzo — 10 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `CNV-01` | Encuadrar, acercar y alejar | Chrome flotante sobre el lienzo, esquina. | 4 Canvas-local | alta (evidencia) | esencial |
| `CNV-02` | Orientarse con el minimapa | Esquina del lienzo, siempre. | 4 Canvas-local | media (inferencia) | secundaria |
| `CNV-03` | Controlar qué capas se ven | Disparador flotante sobre el lienzo (`canvas-layer-trigger`) + 5 comandos de preset en la paleta. | 4 Canvas-local | media (inferencia) | contextual |
| `CNV-04` | Activar rejilla y ajuste (snap) | Inspector › Vista (los cinco destinos) + comandos `view:grid` y `view:snap` en la paleta + chips de estado sobre el lienzo (SÓLO informativos, no accionables). | 4 Canvas-local | alta (inferencia) | esencial |
| `CNV-05` | Leer la posición y la escala actuales | Chrome de estado del lienzo. | 4 Canvas-local | alta (evidencia) | esencial |
| `CNV-06` | Saber en qué modo está el lienzo | Esquina superior del lienzo. | 4 Canvas-local + 6 Workflow temporal | alta (evidencia) | esencial |
| `CNV-07` | Navegar el modelo con el teclado | El propio lienzo. | 4 Canvas-local + 7 Power-user | media (evidencia) | esencial |
| `CNV-08` | Arrastrar un nudo | Lienzo. | 4 Canvas-local + 3 Contextual a selección | alta (inferencia) | esencial |
| `CNV-09` | Exportar el lienzo como imagen | Menú de exportación + «Más» + paleta. | 2 Contextual a proyecto | baja (inferencia) | secundaria |
| `CNV-10` | Ver el modelo en modo impresión | Entrada «Imprimir» en el menú de exportación y en «Más». | 9 Fullscreen / datos densos | baja (inferencia) | secundaria |

### Inspector — 7 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | Panel lateral de 320px SIEMPRE presente en Expanded, aunque no haya selección. Hoja inferior en Compact. | 5 Inspector/detail + 3 Contextual a selección | alta (evidencia) | esencial |
| `INS-02` | Aplicar un material de catálogo | Inspector, sección de miembro. | 3 Contextual a selección + 5 Inspector/detail | alta (inferencia) | esencial |
| `INS-03` | Aplicar una sección de catálogo | Inspector. | 3 Contextual a selección + 5 Inspector/detail | alta (inferencia) | esencial |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | Dentro del Inspector, sustituyendo la ficha individual. | 3 Contextual a selección + 5 Inspector/detail | media (inferencia) | esencial |
| `INS-05` | Gestionar casos de carga y combinaciones | Inspector › pestaña Cargas. Es la ÚNICA puerta a crear casos y combinaciones. | 2 Contextual a proyecto/análisis + 5 Inspector/detail | media (inferencia) | esencial |
| `INS-06` | Ajustar la visualización del modelo y de los resultados | Pestaña «Vista» del Inspector — 4 secciones y ~20 controles. | 4 Canvas-local + 8 Configuración | media (inferencia) | contextual |
| `INS-07` | Elegir la herramienta de carga desde el Inspector | Inspector › Cargas, sección «Añadir carga». | 3 Contextual a selección (débil) + 1 Global persistente (duplicado) | media (inferencia) | contextual |

### Resultados — 11 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `RES-01` | Leer el resumen del análisis | Panel Results, familia «Estado». | 2 Contextual a análisis | alta (inferencia) | esencial |
| `RES-02` | Leer reacciones y localizar la máxima | Panel Results, familia «Estado». | 2 Contextual a análisis + 9 Datos densos | alta (inferencia) | esencial |
| `RES-03` | Leer los diagramas N, V y M | Panel Results + overlay sobre el lienzo (capa `results`). | 2 Contextual a análisis + 3 Contextual a selección + 4 Canvas-local (el overlay) | alta (evidencia) | esencial |
| `RES-04` | Ver la deformada | Panel Results + overlay en el lienzo. | 2 Contextual a análisis + 4 Canvas-local | alta (inferencia) | esencial |
| `RES-05` | Consultar el índice elástico estimado | Tarjeta dentro de Results; capa `heatmap` del lienzo (apagada por defecto). | 2 Contextual a análisis + 3 Contextual a selección | media (inferencia) | esencial |
| `RES-06` | Entender la fiabilidad del resultado | Texto de estado en la cabecera de Results (con `title` = mensaje del check gobernante) + chip del TopBar + tarjeta de calidad numérica. | 2 Contextual a análisis + 1 Global persistente (el chip) | alta (evidencia) | esencial |
| `RES-07` | Ver líneas de influencia | Pestaña de Results. | 2 Contextual a análisis + 9 Datos densos | avanzada (inferencia) | contextual |
| `RES-08` | Aprender por qué salió ese resultado | Pestaña de Results, disponible en AMBOS modos (no sólo Aula). | 2 Contextual a análisis + 9 Datos densos | media (en Aula) (inferencia) | contextual |
| `RES-09` | Cambiar la altura y el modo del panel de resultados | Cabecera del panel (`results-mode-control`) + tirador + botón de enfoque en móvil. | 9 Fullscreen / datos densos + 8 Configuración de layout | media (inferencia) | contextual |
| `RES-10` | Saber de dónde sale un número (procedencia) | Tarjeta al pie del cuerpo de Results. | 2 Contextual a análisis + 5 Detail | alta (evidencia) | esencial |
| `RES-11` | Localizar el objeto de un resultado en el modelo | Cuatro emisores, un solo consumidor (el lienzo). | 4 Canvas-local (destino) + 2/3 (origen) | alta (evidencia) | esencial |

### Datasheet — 10 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `DAT-01` | Ver el modelo como tabla | `Drawer` inferior modal sobre el lienzo. | 9 Fullscreen / datos densos | media (inferencia) | esencial |
| `DAT-02` | Buscar dentro de la tabla | Campo `type="search"` en la barra de la tabla. | 9 Datos densos | media (inferencia) | esencial |
| `DAT-03` | Filtrar y ordenar | Chips bajo la barra de la tabla. | 9 Datos densos | media (inferencia) | contextual |
| `DAT-04` | Seleccionar filas y sincronizar con el lienzo | Rejilla de la tabla. | 9 Datos densos + 3 Contextual a selección | media (evidencia) | esencial |
| `DAT-05` | Editar una celda | Rejilla. | 9 Datos densos | media (inferencia) | esencial |
| `DAT-06` | Pegar un bloque de celdas | Ctrl+V sobre la rejilla. | 9 Datos densos + 7 Power-user | media (inferencia) | esencial |
| `DAT-07` | Revisar, aplicar o cancelar un cambio pendiente | Panel lateral dentro del drawer. | 6 Workflow temporal | media (inferencia) | esencial |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | Panel lateral del drawer. | 5 Inspector/detail dentro de 9 Datos densos | media (inferencia) | contextual |
| `DAT-09` | Cambiar de entidad (nudos / barras / cargas) | Barra de la tabla. | 9 Datos densos | media (evidencia) | esencial |
| `DAT-10` | Enfocar en el lienzo el objeto de la fila | Botón del panel editor. | 4 Canvas-local (destino) | media (evidencia) | esencial |

### Model Doctor — 7 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `DOC-01` | Diagnosticar el modelo antes de analizar | `Drawer` lateral en escritorio, INFERIOR bajo 700px (`useCompactDoctor`). | 2 Contextual a proyecto/análisis | media (inferencia) | esencial |
| `DOC-02` | Filtrar hallazgos por severidad | Cabecera del drawer. | 2 Contextual a proyecto | media (inferencia) | contextual |
| `DOC-03` | Entender un hallazgo | Tarjeta del drawer, con disclosure. | 5 Detail | media (evidencia) | esencial |
| `DOC-04` | Localizar el objeto de un hallazgo | Botón de la tarjeta. | 4 Canvas-local (destino) | media (evidencia) | esencial |
| `DOC-05` | Previsualizar y aplicar una reparación de topología | Vista sustitutiva dentro del drawer, con botón de volver. | 6 Workflow temporal | baja (inferencia) | esencial |
| `DOC-06` | Reconocer (acknowledge) un hallazgo | Botón de la tarjeta. | 2 Contextual a proyecto | baja (inferencia) | contextual |
| `DOC-07` | Saltar del hallazgo a la herramienta que lo arregla | Botón de la tarjeta. | 6 Workflow temporal | baja (inferencia) | contextual |

### Persistencia — 4 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `PER-01` | Guardar automáticamente el trabajo | Invisible; su estado se ve en el chip del TopBar (SHL-21). | 1 Global persistente | alta (evidencia) | esencial |
| `PER-02` | Trabajar sin conexión | Estado en el TopBar. | 1 Global persistente | media (inferencia) | esencial |
| `PER-03` | Resolver un conflicto de revisión | Estado `conflict` en el TopBar; la resolución está en el Project Hub (ENT-09), en otra pantalla. | 2 Contextual a proyecto + 6 Workflow temporal | baja (evidencia) | esencial |
| `PER-04` | Migrar un proyecto de una versión anterior | Invisible, automático. | 1 Global persistente | baja (evidencia) | esencial |

### Estados — 6 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `STA-01` | Entender un estado vacío | Dentro de cada superficie. | Transversal | alta (evidencia) | esencial |
| `STA-02` | Entender un estado de carga | En cada superficie que carga. | Transversal | alta (evidencia) | esencial |
| `STA-03` | Entender un análisis obsoleto (stale) | Chip del TopBar + estado de Results. | Transversal / 2 Contextual a análisis | alta (evidencia) | esencial |
| `STA-04` | Entender un análisis fallido | Cuerpo de Results + chip del TopBar. | Transversal / 2 Contextual a análisis | media (evidencia) | esencial |
| `STA-05` | Entender un control deshabilitado | Disperso por superficie. | Transversal | alta (evidencia) | esencial |
| `STA-06` | Trabajar con movimiento reducido / alto contraste | Automático. | Transversal | baja (evidencia) | esencial |

### Aula — 3 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `AUL-01` | Seguir el recorrido guiado de un ejercicio | Banda sobre el lienzo, encima del canvas. | 6 Workflow temporal + 2 Contextual a proyecto | media (en Aula) (inferencia) | contextual |
| `AUL-02` | Ver niveles pedagógicos del resultado | Results › Entender. | 2 Contextual a análisis | baja (inferencia) | contextual |
| `AUL-03` | Mantener la sesión de aula | Invisible. | Transversal | media (en Aula) (evidencia) | contextual |

### Space 3D — 2 tareas

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frec. (fuente) | Criticidad |
|---|---|---|---|---|---|
| `S3D-01` | Trabajar en el dominio espacial experimental | Pantalla completa propia, con dos orígenes (Inicio o mesa). | 9 Fullscreen (dominio separado) | baja (inferencia) | secundaria |
| `S3D-02` | Navegar el modelo espacial por lista | Panel dentro de la pantalla Space3D. | 9 Fullscreen (dominio separado) | baja (inferencia) | contextual |

## TABLA B — Expanded / Medium / Compact + método de entrada

Filas cuya ruta funcional **cambia** en algún tier: **80 de 122**.

| ID | Tarea | Expanded | Medium | Compact | Mouse/teclado | Touch |
|---|---|---|---|---|---|---|
| `ENT-03` | Crear un proyecto en blanco | Menú de proyecto en TopBar. | Igual. | El menú de proyecto sobrevive en Compact (zona documento no se oculta entera). | Click en la flecha; el menú tiene navegación por flechas/Home/End (`onMenuKeyDown`). | Tap en la flecha de 33×40 — por debajo del mínimo táctil de 44 declarado por el proyecto. |
| `ENT-04` | Abrir un ejemplo / plantilla | Rejilla de tarjetas con categoría e icono. | Rejilla más estrecha. | Columna única. | Tab + Enter. | Tap. |
| `ENT-06` | Ver y abrir proyectos guardados (Project Hub) | Lista completa con acciones por fila. | Igual. | Fila apilada. | Tab por filas y acciones. | Tap. |
| `ENT-07` | Renombrar un proyecto guardado | Inline. | Inline. | Inline. | Enter confirma (no verificado si Escape cancela). | Teclado en pantalla. |
| `ENT-12` | Crear un ejercicio de Aula | Modal. | Modal. | Modal a pantalla casi completa. | Roving por flechas sobre plantillas; Escape cierra. | Tap + teclado en pantalla. |
| `ENT-13` | Renombrar el proyecto abierto | Campo visible en TopBar. | Igual. | Presente pero comprimido; por debajo de 375px es inusable (F-08). | Enter confirma, Escape revierte. | Tap + teclado en pantalla. |
| `ENT-14` | Volver a Inicio desde la mesa | Marca 46px. | Igual. | La marca sobrevive; el nombre textual se retira. | Tab + Enter. | Tap. |
| `ENT-15` | Abrir Space 3D | Icono en TopBar. | Igual. | Sólo dentro de «Más». | Tab + Enter. | Tap. |
| `SHL-01` | Ejecutar el análisis | Botón con texto. | Botón con texto. | Icono 44×44. | Tab + Enter. NO tiene atajo de teclado propio. | Tap. |
| `SHL-02` | Saber en qué estado está el análisis | Chip en TopBar + estado en Results. | Igual. | El chip permanece; el estado de Results vive en la hoja. | Tab hasta el chip; enlaza a Model Doctor. | Tap. |
| `SHL-03` | Deshacer | Par de iconos en TopBar. | Igual. | Dentro de «Más», en su propio grupo. | HUECO: la paleta anuncia `Ctrl Z` como atajo pero NINGÚN manejador lo enlaza. Verificado por búsqueda en todo `src/`: no existe handler de tecla Z fuera de un campo de coordenada de Space3D. | Tap en TopBar o en «Más». |
| `SHL-04` | Rehacer | Icono. | Icono. | Dentro de «Más». | HUECO idéntico: la paleta anuncia `Ctrl Y` sin manejador. | Tap. |
| `SHL-05` | Abrir la paleta de comandos | Botón visible en el rail + atajo. | Igual. | Dentro de la hoja «Más» del dock táctil. | Ctrl/⌘K abre; flechas/Home/End navegan; Enter ejecuta; Escape cierra con retorno de foco. | Tap en la hoja «Más» → paleta. Funciona, pero teclear es el punto de la paleta. |
| `SHL-06` | Navegar a un nudo o barra por identificador | Paleta. | Paleta. | Paleta (vía «Más»). | Escribir el ID + Enter. | Posible pero incómodo. |
| `SHL-07` | Elegir caso de carga o combinación a analizar | Select visible en TopBar. | Igual (la zona de contexto no se contrae por sí sola). | Dentro de «Más» › sección Análisis. | Select nativo. | Select nativo. |
| `SHL-08` | Cambiar el modo de cálculo (Aula / Completo) | Select en TopBar + segmented en Inspector. | Igual. | «Más» + Inspector. | Select / segmented. | Igual. |
| `SHL-09` | Elegir el orden de análisis (1.º orden / P-Delta) | Select en TopBar. | Igual. | «Más» › Análisis. | Select. | Select. |
| `SHL-11` | Cambiar el sistema de unidades | Select en TopBar. | Igual. | «Más» › Preferencias. | Select. | Select de 58×30 — bajo el mínimo táctil. |
| `SHL-14` | Abrir Model Doctor | Botón con texto (colapsa a icono bajo 1536px). | Icono en TopBar. | «Más» › Análisis, tercera entrada, sin señal visual de que hay hallazgos. | Tab + Enter; también desde la paleta. | Dos toques en Compact. |
| `SHL-16` | Ocultar / mostrar el Inspector | «Más» › Vistas. | Igual. | No aplica: en Compact el Inspector ya es hoja. | Tres pasos: abrir «Más», bajar a Vistas, activar. | Igual. |
| `SHL-17` | Entrar/salir de «mesa completa» | «Más» › Vistas. | Igual. | Presente pero de efecto menor. | Tres pasos. | Igual. |
| `SHL-18` | Contraer el ToolRail a iconos | «Más» › Vistas. | Igual — y es justo donde más falta hace. | No aplica (el rail ya es dock flotante). | Tres pasos. | Igual. |
| `SHL-19` | Redimensionar el Inspector | Tirador en el borde. | Igual. | No aplica; en su lugar hay detents. | Arrastre o flechas/Home/End con foco en el separador. | Arrastre; el tirador es fino. |
| `SHL-20` | Elegir el detent de la hoja Inspector en táctil | No existe: en Expanded el equivalente es el ancho (SHL-19). | No existe hoy. | Tres botones en la hoja. | Tab + Enter. | Tap. NO hay arrastre del tirador para cambiar detent. |
| `SHL-21` | Conocer el estado de persistencia y conectividad | Chip con etiqueta. | Igual. | Icono; el detalle en «Más». | Es informativo, no accionable. | Igual. |
| `SHL-22` | Exportar el proyecto y compartirlo | Menú de exportación propio. | Igual. | «Más» › Exportar. | Menú con navegación por flechas. | Tap. |
| `MOD-01` | Elegir herramienta activa | Rail con etiqueta y `kbd` visible. | Rail idéntico (no se contrae solo — F-01). | Dock flotante horizontal sobre el lienzo con 5 destinos: Seleccionar, Nodo, Barra, Apoyo, Cargas▸, Más▸. | Tecla única por herramienta (`toolFromShortcut`). Es la ruta más rápida del producto. | Tap en el dock; las herramientas secundarias viven en dos hojas modales (`loads`, `more`). |
| `MOD-02` | Crear un nudo | Rail → clic. | Igual. | Dock → tap. | N + clic. Snap a rejilla/nudos/puntos medios/intersecciones/perpendicular según `snapTargets`. | Tap con lupa activa durante la colocación (`syncTouchLoupe`). |
| `MOD-03` | Crear una barra | Rail → dos clics. | Igual. | Dock → dos taps. | M + dos clics; Escape cancela a medio camino. | Dos taps con lupa. |
| `MOD-04` | Aplicar o cambiar un apoyo | Lienzo + Inspector permanente. | Igual. | Lienzo + hoja Inspector. | S + clic para el rápido; Tab en el Inspector para el detalle. | Tap con herramienta; hoja Inspector para el detalle. |
| `MOD-05` | Colocar una carga puntual | Rail grupo «Cargas». | Igual. | Dock → hoja «Cargas». | P + clic. | Tap → hoja → tap herramienta → tap destino (tres toques). |
| `MOD-06` | Colocar una carga distribuida | Rail. | Igual. | Dock → hoja «Cargas». | D + arrastre/clic sobre la barra. | Tres toques. |
| `MOD-07` | Colocar un momento | Rail. | Igual. | Dock → hoja «Cargas». | O + clic. | Tres toques. |
| `MOD-08` | Dividir una barra (Split) | Rail. | Igual. | Hoja «Más». | B + clic en el punto. | Dos niveles + tap. |
| `MOD-09` | Borrar objetos | Rail + tecla. | Igual. | Hoja «Más» + tecla si hay teclado. | Delete/Backspace sobre la selección. Es la ruta natural. | SIN TECLADO: hay que entrar en la hoja «Más», elegir la herramienta destructiva y tocar el objeto. Tres pasos para borrar. |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | Rail (condicional) → overlay sobre el lienzo. | Igual. | Hoja «Más» › Editar (condicional) → overlay. | Arrastre para el gesto; campos numéricos para exactitud; Escape cancela el borrador. | Arrastre + campos. La lupa acompaña el arrastre. |
| `MOD-12` | Repetir la última operación (Repeat) | Tecla + overlay. | Igual. | SÓLO overlay: sin teclado físico no hay tecla `R`. No verificado si el overlay es alcanzable por tap en Compact. | `R` sobre la selección. | UNKNOWN: no se verificó una ruta táctil independiente del teclado. |
| `MOD-13` | Copiar, pegar y duplicar | Sólo teclado. | Sólo teclado. | INEXISTENTE sin teclado físico. | Ctrl+C / Ctrl+V / Ctrl+D. | NO EXISTE. Hueco funcional real en Compact táctil. |
| `MOD-14` | Generar una estructura completa | Rail → panel con formulario + preview en el lienzo. | Igual. | Hoja «Más» › Crear → panel. | Formulario extenso + elección del origen con el puntero (`pickGeneratorOrigin` en fase de captura). | Formulario + tap para el origen. |
| `MOD-15` | Medir con la herramienta de dimensión | Rail. | Igual. | Hoja «Más». | C + clics. | Dos niveles + taps. |
| `MOD-16` | Hacer un corte para leer valores internos | Rail. | Igual. | Hoja «Más». | X + hover/clic sobre la barra. | Sin hover: hay que tocar. El corte fijado (`pinned`) es la respuesta táctil correcta. |
| `SEL-01` | Seleccionar un objeto | Clic. | Clic/tap. | Tap. | V + clic; Shift para acumular; Alt cicla candidatos solapados. | Tap; pulsación larga arma acciones adicionales (`long-press`). |
| `SEL-02` | Resolver objetos solapados con puntero | Picker + indicador. | Igual. | NO SE ACTIVA. El código sale antes por la rama `pointerType === "touch"`, que resuelve la intención pan/long-press primero. En táctil no hay picker de solapados. | Clic repetido o Alt+clic; el picker es navegable. | NO DISPONIBLE — hueco explícito y verificado en `StructuralCanvas.tsx:1241-1244`. |
| `SEL-03` | Seleccionar con marco (box select) | Arrastre. | Arrastre. | NO EXISTE en táctil: un arrastre de un dedo sobre el fondo es PAN (`StructuralCanvas.tsx:1307-1311`), no marco. | Arrastre; Shift para acumular. La pista está en el rail (`selection-tip`). | NO DISPONIBLE. La ruta táctil a multiselección es el Datasheet o taps acumulativos. |
| `SEL-04` | Multiselección acumulativa | Shift+clic / marco. | Igual. | Sólo vía Datasheet (ver SEL-03). | Shift+clic; rango con Shift en el Datasheet. | Vía Datasheet. |
| `SEL-05` | Deseleccionar | Escape. | Escape. | Sin teclado, sólo tap en el fondo — que además debe distinguirse de un pan. | Escape. | Tap en vacío. |
| `SEL-06` | Filtrar qué tipos son seleccionables | Inspector › Vista, tercer nivel. | Igual. | Hoja Inspector › Vista. | Chips con `aria-pressed`. | Tap. |
| `SEL-07` | Precisión táctil: ver bajo el dedo | No aparece (no hay `pointerType: touch`). | Aparece si el dispositivo es táctil — el disparador es el INPUT, no el ancho. | Aparece durante colocación y arrastre. | No aplica. | Automática. NO se activa durante un tap simple de selección: sólo tras armarse una interacción. |
| `CNV-01` | Encuadrar, acercar y alejar | Tres iconos + rueda + espacio. | Igual. | Tres iconos + pinza. El chrome flotante pesa 12-14% del lienzo en teléfono apaisado. | Rueda para zoom; espacio+arrastre o botón central para pan; botón «ajustar». | Pinza para zoom; un dedo para pan (por eso no hay marco de selección). |
| `CNV-04` | Activar rejilla y ajuste (snap) | Inspector › Vista + paleta. | Igual. | Hoja Inspector › Vista. | Casillas o comandos de paleta. | Casillas en la hoja. |
| `CNV-05` | Leer la posición y la escala actuales | Readout permanente. | Igual. | Presente pero sin actualizarse en táctil; la cota vive en la lupa. | Se actualiza con el movimiento. | Sustituido por la cota de la lupa. |
| `CNV-06` | Saber en qué modo está el lienzo | Badge + pista de escritorio. | Igual. | Badge + pista táctil. | Informativo; el botón X cancela. | Igual. |
| `CNV-08` | Arrastrar un nudo | Arrastre. | Arrastre. | Arrastre con lupa. | Arrastre; snap activo. | Arrastre con lupa. |
| `CNV-09` | Exportar el lienzo como imagen | Menú de exportación. | Igual. | «Más» › Exportar. | Menú. | Tap. |
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | Panel permanente de 280-480px. | Panel permanente idéntico — no se contrae (F-01). Es el mayor problema del tier. | Hoja inferior modal con tres detents, abierta por botón flotante o por selección en el lienzo. | Tab por campos; commit en blur/Enter. | Hoja con detents; teclado en pantalla gestionado vía `visualViewport`. |
| `INS-02` | Aplicar un material de catálogo | Inspector. | Igual. | Hoja Inspector. | Selector. | Selector. |
| `INS-03` | Aplicar una sección de catálogo | Inspector con dibujo. | Igual. | Hoja. | Selector. | Selector. |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | Inspector. | Igual. | Hoja Inspector. | Tab por campos; aplicar explícito. | Hoja; la revisión pide altura, que es justo lo que falta en Compact. |
| `INS-05` | Gestionar casos de carga y combinaciones | Pestaña del Inspector. | Igual. | Hoja Inspector › Cargas. | Tab; navegación de pestañas por flechas/Home/End (`onTabKeyDown`). | Hoja. |
| `INS-06` | Ajustar la visualización del modelo y de los resultados | Pestaña del Inspector. | Igual. | Hoja Inspector › Vista. | Tab por ~20 controles. | Hoja con scroll largo. |
| `INS-07` | Elegir la herramienta de carga desde el Inspector | Inspector. | Igual. | Hoja que se cierra sola. | Tab + Enter. | Tap. |
| `RES-01` | Leer el resumen del análisis | Pestaña dentro del panel inferior. | Igual. | Dentro de la hoja de resultados, que se abre sola tras analizar. | Flechas/Home/End entre pestañas; comando de paleta. | Tap en pestaña. |
| `RES-02` | Leer reacciones y localizar la máxima | Tabla en el panel. | Igual, más estrecha. | Tabla en la hoja, con `@container` que la recompone bajo 560px. | Tab por celdas-botón. | Tap. |
| `RES-03` | Leer los diagramas N, V y M | Panel + overlay. | Igual. | Hoja + overlay; hay modo «enfocado» a pantalla completa (`results-mode-focused`). | Flechas entre pestañas; cursor sobre la gráfica. | Tap; el modo enfocado da altura real al diagrama. |
| `RES-04` | Ver la deformada | Panel + overlay. | Igual. | Hoja + overlay. | Pestaña. | Tap. |
| `RES-06` | Entender la fiabilidad del resultado | Cabecera de Results + chip. | Igual. | Chip + hoja. | El detalle está en un `title`, no alcanzable por teclado. | El `title` no aparece en táctil: la causa gobernante es INVISIBLE sin ratón. |
| `RES-07` | Ver líneas de influencia | Pestaña. | Igual. | Hoja; el modo «enfocado» le da altura. | Pestaña + cursor. | Tap. |
| `RES-08` | Aprender por qué salió ese resultado | Pestaña. | Igual. | Hoja; el modo enfocado recompone `learning-steps` a una columna. | Pestaña. | Tap. |
| `RES-09` | Cambiar la altura y el modo del panel de resultados | Tres modos + tirador. | Igual. | Colapsado a 54px por defecto; se despliega solo tras analizar; botón de enfoque propio. | Botones de modo; el tirador es `role="separator"`. | Tap en el modo; arrastre del tirador de 64×28. |
| `DAT-04` | Seleccionar filas y sincronizar con el lienzo | Clic, Ctrl+clic, Shift+clic. | Igual. | Tap; ES LA RUTA TÁCTIL A LA MULTISELECCIÓN, dado que el marco no existe (SEL-03). | Rejilla navegable por teclado. | Tap y rango. |
| `DAT-05` | Editar una celda | Doble clic / Enter sobre la celda. | Igual. | Tap. | Enter edita, Escape cancela, commit al confirmar. | Tap + teclado en pantalla. |
| `DAT-06` | Pegar un bloque de celdas | Ctrl+V. | Igual. | DEPENDE DE TECLADO: sin teclado físico no hay pegado. Hueco táctil. | Ctrl+V. | UNKNOWN: no se verificó una ruta táctil de pegado. |
| `DAT-07` | Revisar, aplicar o cancelar un cambio pendiente | Panel lateral en el drawer. | Igual. | Apilado; compite por altura con la rejilla. | Aplicar / Cancelar explícitos. | Igual. |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | Panel lateral. | Igual. | Apilado. | Tab por campos. | Scroll + campos. |
| `DOC-01` | Diagnosticar el modelo antes de analizar | Drawer lateral. | Drawer lateral. | Drawer inferior. | Tab por hallazgos. | Scroll + tap. |
| `PER-02` | Trabajar sin conexión | Chip. | Chip. | Icono + detalle en «Más». | Informativo. | Informativo. |
| `STA-03` | Entender un análisis obsoleto (stale) | Chip + estado. | Igual. | Chip. | No accionable directamente. | Igual. |
| `STA-05` | Entender un control deshabilitado | Variable. | Variable. | Variable. | Cuando se explica, por `aria-live`. | Cuando se explica por `title` (RES-06), NO llega al táctil. |
| `AUL-01` | Seguir el recorrido guiado de un ejercicio | Banda de 6 columnas sobre el lienzo. | Igual — y aquí es donde más lienzo cuesta. | `is-compact`: sólo el paso actual, con su descripción. | Botón de acción por paso. | Tap; el botón respeta 44px de alto. |
| `AUL-02` | Ver niveles pedagógicos del resultado | Pestaña. | Igual. | Hoja. | Pestaña. | Tap. |

## TABLA C — Tareas cuyo Medium hoy sólo repite Expanded

**103 de 122** filas declaran para Medium «igual que Expanded». Es la medida directa de F-01: Medium no existe como comportamiento.

| ID | Tarea | Qué dice Medium hoy |
|---|---|---|
| `ENT-01` | Elegir por dónde empezar al abrir la app | Igual que Expanded; sólo densidad de tarjetas. |
| `ENT-02` | Continuar el proyecto en el que estaba | Igual. |
| `ENT-03` | Crear un proyecto en blanco | Igual. |
| `ENT-05` | Filtrar plantillas por tipo | Igual. |
| `ENT-06` | Ver y abrir proyectos guardados (Project Hub) | Igual. |
| `ENT-08` | Duplicar un proyecto guardado | Igual. |
| `ENT-09` | Restaurar una recuperación tras conflicto | Igual. |
| `ENT-10` | Importar JSON / bundle / PDF (Import Center) | Igual. |
| `ENT-11` | Importar geometría desde DXF | Igual. |
| `ENT-13` | Renombrar el proyecto abierto | Igual. |
| `ENT-14` | Volver a Inicio desde la mesa | Igual. |
| `ENT-15` | Abrir Space 3D | Igual. |
| `SHL-02` | Saber en qué estado está el análisis | Igual. |
| `SHL-03` | Deshacer | Igual. |
| `SHL-05` | Abrir la paleta de comandos | Igual. |
| `SHL-07` | Elegir caso de carga o combinación a analizar | Igual (la zona de contexto no se contrae por sí sola). |
| `SHL-08` | Cambiar el modo de cálculo (Aula / Completo) | Igual. |
| `SHL-09` | Elegir el orden de análisis (1.º orden / P-Delta) | Igual. |
| `SHL-10` | Ajustar los parámetros avanzados de P-Delta | Igual. |
| `SHL-11` | Cambiar el sistema de unidades | Igual. |
| `SHL-12` | Cambiar el idioma | Igual. |
| `SHL-13` | Cambiar el tema (claro / oscuro) | Igual. |
| `SHL-15` | Abrir la hoja de datos (Datasheet) | Igual. |
| `SHL-16` | Ocultar / mostrar el Inspector | Igual. |
| `SHL-17` | Entrar/salir de «mesa completa» | Igual. |
| `SHL-18` | Contraer el ToolRail a iconos | Igual — y es justo donde más falta hace. |
| `SHL-19` | Redimensionar el Inspector | Igual. |
| `SHL-21` | Conocer el estado de persistencia y conectividad | Igual. |
| `SHL-22` | Exportar el proyecto y compartirlo | Igual. |
| `SHL-23` | Recibir avisos transitorios (toasts) | Igual. |
| `SHL-24` | Actualizar la app instalada (PWA) | Igual. |
| `MOD-02` | Crear un nudo | Igual. |
| `MOD-03` | Crear una barra | Igual. |
| `MOD-04` | Aplicar o cambiar un apoyo | Igual. |
| `MOD-05` | Colocar una carga puntual | Igual. |
| `MOD-06` | Colocar una carga distribuida | Igual. |
| `MOD-07` | Colocar un momento | Igual. |
| `MOD-08` | Dividir una barra (Split) | Igual. |
| `MOD-09` | Borrar objetos | Igual. |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | Igual. |
| `MOD-11` | Entrada numérica rápida durante la colocación | Igual. |
| `MOD-12` | Repetir la última operación (Repeat) | Igual. |
| `MOD-14` | Generar una estructura completa | Igual. |
| `MOD-15` | Medir con la herramienta de dimensión | Igual. |
| `MOD-16` | Hacer un corte para leer valores internos | Igual. |
| `SEL-02` | Resolver objetos solapados con puntero | Igual. |
| `SEL-04` | Multiselección acumulativa | Igual. |
| `SEL-06` | Filtrar qué tipos son seleccionables | Igual. |
| `CNV-01` | Encuadrar, acercar y alejar | Igual. |
| `CNV-02` | Orientarse con el minimapa | Igual. |
| `CNV-03` | Controlar qué capas se ven | Igual. |
| `CNV-04` | Activar rejilla y ajuste (snap) | Igual. |
| `CNV-05` | Leer la posición y la escala actuales | Igual. |
| `CNV-06` | Saber en qué modo está el lienzo | Igual. |
| `CNV-07` | Navegar el modelo con el teclado | Igual. |
| `CNV-09` | Exportar el lienzo como imagen | Igual. |
| `CNV-10` | Ver el modelo en modo impresión | Igual. |
| `INS-02` | Aplicar un material de catálogo | Igual. |
| `INS-03` | Aplicar una sección de catálogo | Igual. |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | Igual. |
| `INS-05` | Gestionar casos de carga y combinaciones | Igual. |
| `INS-06` | Ajustar la visualización del modelo y de los resultados | Igual. |
| `INS-07` | Elegir la herramienta de carga desde el Inspector | Igual. |
| `RES-01` | Leer el resumen del análisis | Igual. |
| `RES-02` | Leer reacciones y localizar la máxima | Igual, más estrecha. |
| `RES-03` | Leer los diagramas N, V y M | Igual. |
| `RES-04` | Ver la deformada | Igual. |
| `RES-05` | Consultar el índice elástico estimado | Igual. |
| `RES-06` | Entender la fiabilidad del resultado | Igual. |
| `RES-07` | Ver líneas de influencia | Igual. |
| `RES-08` | Aprender por qué salió ese resultado | Igual. |
| `RES-09` | Cambiar la altura y el modo del panel de resultados | Igual. |
| `RES-10` | Saber de dónde sale un número (procedencia) | Igual. |
| `RES-11` | Localizar el objeto de un resultado en el modelo | Igual. |
| `DAT-01` | Ver el modelo como tabla | Igual. |
| `DAT-02` | Buscar dentro de la tabla | Igual. |
| `DAT-03` | Filtrar y ordenar | Igual. |
| `DAT-04` | Seleccionar filas y sincronizar con el lienzo | Igual. |
| `DAT-05` | Editar una celda | Igual. |
| `DAT-06` | Pegar un bloque de celdas | Igual. |
| `DAT-07` | Revisar, aplicar o cancelar un cambio pendiente | Igual. |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | Igual. |
| `DAT-09` | Cambiar de entidad (nudos / barras / cargas) | Igual. |
| `DAT-10` | Enfocar en el lienzo el objeto de la fila | Igual. |
| `DOC-02` | Filtrar hallazgos por severidad | Igual. |
| `DOC-03` | Entender un hallazgo | Igual. |
| `DOC-04` | Localizar el objeto de un hallazgo | Igual. |
| `DOC-05` | Previsualizar y aplicar una reparación de topología | Igual. |
| `DOC-06` | Reconocer (acknowledge) un hallazgo | Igual. |
| `DOC-07` | Saltar del hallazgo a la herramienta que lo arregla | Igual. |
| `PER-01` | Guardar automáticamente el trabajo | Invisible. |
| `PER-03` | Resolver un conflicto de revisión | Igual. |
| `PER-04` | Migrar un proyecto de una versión anterior | Invisible. |
| `STA-01` | Entender un estado vacío | Igual. |
| `STA-02` | Entender un estado de carga | Igual. |
| `STA-03` | Entender un análisis obsoleto (stale) | Igual. |
| `STA-04` | Entender un análisis fallido | Igual. |
| `STA-06` | Trabajar con movimiento reducido / alto contraste | Automático. |
| `AUL-01` | Seguir el recorrido guiado de un ejercicio | Igual — y aquí es donde más lienzo cuesta. |
| `AUL-02` | Ver niveles pedagógicos del resultado | Igual. |
| `AUL-03` | Mantener la sesión de aula | Invisible. |
| `S3D-01` | Trabajar en el dominio espacial experimental | Igual. |
| `S3D-02` | Navegar el modelo espacial por lista | Igual. |

## TABLA D — Tareas que pueden depender de la selección

**25 de 122**. La columna dice si ya lo son o si sólo podrían serlo.

| ID | Tarea | ¿Contextual a selección? | Dónde vive hoy |
|---|---|---|---|
| `SHL-15` | Abrir la hoja de datos (Datasheet) | Sí, ya lo es: la entidad inicial se deriva del tipo de selección. | Icono en TopBar + paleta. En Compact el icono NO se oculta (a diferencia de Model Doctor). |
| `MOD-04` | Aplicar o cambiar un apoyo | SÍ, plenamente: sólo tiene sentido con un nudo (o varios) seleccionado. | Lienzo (rápido, tipo por defecto) + Inspector (completo) + Datasheet (columna) + Bulk Edit (masivo). |
| `MOD-05` | Colocar una carga puntual | SÍ. | Lienzo + hoja «Cargas» del dock táctil + pestaña Cargas del Inspector (que sólo ELIGE la herramienta y cierra). |
| `MOD-06` | Colocar una carga distribuida | SÍ. | Lienzo + hoja «Cargas» + Inspector › Cargas. |
| `MOD-07` | Colocar un momento | SÍ. | Lienzo + hoja «Cargas» + Inspector › Cargas. |
| `MOD-08` | Dividir una barra (Split) | SÍ. | Rail grupo «Editar» + hoja «Más» táctil + paleta. |
| `MOD-09` | Borrar objetos | SÍ, plenamente. | Rail (destructiva) + tecla + hoja «Más». |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | SÍ — ya lo es. | Lanzador `open-structural-edit` que SÓLO aparece en el grupo «Editar» del rail cuando hay selección válida, y en la hoja «Más» táctil bajo la misma condición. |
| `MOD-12` | Repetir la última operación (Repeat) | SÍ — ya lo es. | Tecla `R` + overlay contextual sobre el lienzo. |
| `MOD-13` | Copiar, pegar y duplicar | SÍ. | SÓLO por teclado. No hay botón, entrada de menú ni comando de paleta para copiar/pegar/duplicar. |
| `MOD-16` | Hacer un corte para leer valores internos | SÍ. | Rail grupo «Inspeccionar» + hoja «Más» + paleta. |
| `SEL-05` | Deseleccionar | Sí. | Escape + clic en el fondo. |
| `CNV-08` | Arrastrar un nudo | SÍ. | Lienzo. |
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | SÍ, plenamente — ya lo es en contenido, no en presencia. | Panel lateral de 320px SIEMPRE presente en Expanded, aunque no haya selección. Hoja inferior en Compact. |
| `INS-02` | Aplicar un material de catálogo | SÍ. | Inspector, sección de miembro. |
| `INS-03` | Aplicar una sección de catálogo | SÍ. | Inspector. |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | SÍ — aparece SOLO con multiselección. Contextualidad ya implementada. | Dentro del Inspector, sustituyendo la ficha individual. |
| `RES-03` | Leer los diagramas N, V y M | SÍ: el diagrama que se ve es el del miembro seleccionado (`resultContext`). | Panel Results + overlay sobre el lienzo (capa `results`). |
| `RES-04` | Ver la deformada | Sí para el detalle por miembro. | Panel Results + overlay en el lienzo. |
| `RES-05` | Consultar el índice elástico estimado | SÍ para la cifra por miembro. | Tarjeta dentro de Results; capa `heatmap` del lienzo (apagada por defecto). |
| `RES-07` | Ver líneas de influencia | SÍ: usa `selection` para elegir el objetivo. | Pestaña de Results. |
| `RES-10` | Saber de dónde sale un número (procedencia) | SÍ. | Tarjeta al pie del cuerpo de Results. |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | Sigue a la fila enfocada, no a la selección. | Panel lateral del drawer. |
| `DAT-09` | Cambiar de entidad (nudos / barras / cargas) | Sí al abrir. | Barra de la tabla. |
| `S3D-02` | Navegar el modelo espacial por lista | Sincroniza con la selección espacial. | Panel dentro de la pantalla Space3D. |

## TABLA E — Tareas con necesidad de precisión especial

**30 de 122**.

| ID | Tarea | Por qué necesita precisión | Touch path actual |
|---|---|---|---|
| `SHL-19` | Redimensionar el Inspector | Sí: el tirador es una banda estrecha. | Arrastre; el tirador es fino. |
| `MOD-02` | Crear un nudo | Sí. Resuelta con: snap configurable + lupa táctil + entrada numérica. | Tap con lupa activa durante la colocación (`syncTouchLoupe`). |
| `MOD-03` | Crear una barra | Sí: el segundo punto debe caer en un nudo concreto. | Dos taps con lupa. |
| `MOD-04` | Aplicar o cambiar un apoyo | Sí: el apoyo se aplica a un nudo concreto entre varios cercanos. | Tap con herramienta; hoja Inspector para el detalle. |
| `MOD-05` | Colocar una carga puntual | Sí: distinguir nudo de barra de carga existente en el mismo punto. | Tap → hoja → tap herramienta → tap destino (tres toques). |
| `MOD-06` | Colocar una carga distribuida | Sí: el tramo se define sobre la barra. | Tres toques. |
| `MOD-07` | Colocar un momento | Sí. | Tres toques. |
| `MOD-08` | Dividir una barra (Split) | Sí: el punto de división importa. | Dos niveles + tap. |
| `MOD-09` | Borrar objetos | Sí, y con consecuencia irreversible-en-un-paso. | SIN TECLADO: hay que entrar en la hoja «Más», elegir la herramienta destructiva y tocar el objeto. Tres pasos para borrar. |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | Sí, y está resuelta por la doble vía gesto+número. | Arrastre + campos. La lupa acompaña el arrastre. |
| `MOD-11` | Entrada numérica rápida durante la colocación | ES la respuesta a la precisión: entrada exacta sin puntería. | Teclado en pantalla; compite con la lupa por el espacio. |
| `MOD-14` | Generar una estructura completa | Sí para el origen; el resto es numérico. | Formulario + tap para el origen. |
| `MOD-15` | Medir con la herramienta de dimensión | Sí. | Dos niveles + taps. |
| `MOD-16` | Hacer un corte para leer valores internos | Sí: la posición del corte es el dato. | Sin hover: hay que tocar. El corte fijado (`pinned`) es la respuesta táctil correcta. |
| `SEL-01` | Seleccionar un objeto | SÍ — es el problema de precisión central del producto. | Tap; pulsación larga arma acciones adicionales (`long-press`). |
| `SEL-02` | Resolver objetos solapados con puntero | ES la respuesta a la precisión con puntero. | NO DISPONIBLE — hueco explícito y verificado en `StructuralCanvas.tsx:1241-1244`. |
| `SEL-04` | Multiselección acumulativa | Sí. | Vía Datasheet. |
| `SEL-06` | Filtrar qué tipos son seleccionables | ES una herramienta de precisión, y vive donde nadie la busca durante la selección. | Tap. |
| `SEL-07` | Precisión táctil: ver bajo el dedo | ES la respuesta táctil a la precisión, y está bien construida. | Automática. NO se activa durante un tap simple de selección: sólo tras armarse una interacción. |
| `CNV-04` | Activar rejilla y ajuste (snap) | ES la herramienta de precisión principal con puntero. | Casillas en la hoja. |
| `CNV-05` | Leer la posición y la escala actuales | Sí. | Sustituido por la cota de la lupa. |
| `CNV-07` | Navegar el modelo con el teclado | ES una ruta de precisión: tabular no falla nunca el objetivo. | No aplica. |
| `CNV-08` | Arrastrar un nudo | Sí; resuelta por snap + lupa + alternativa numérica. | Arrastre con lupa. |
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | ES la ruta de precisión numérica: el lienzo aproxima, el Inspector es exacto. | Hoja con detents; teclado en pantalla gestionado vía `visualViewport`. |
| `RES-07` | Ver líneas de influencia | Sí: leer un valor en una posición. | Tap. |
| `RES-11` | Localizar el objeto de un resultado en el modelo | ES una ruta de precisión no espacial. | Tap. |
| `DAT-01` | Ver el modelo como tabla | SÍ, y es donde peor está resuelta: la casilla de rótula es una edición estructural real en 13×13 px. | Scroll y tap; los controles finos (13×13) son el peor caso táctil. |
| `DAT-05` | Editar una celda | SÍ, y mal resuelta en el caso de la casilla booleana. | Tap + teclado en pantalla. |
| `S3D-01` | Trabajar en el dominio espacial experimental | Sí, y peor resuelta que en 2D. | Controles bajo el mínimo táctil (CRI-7 §8). |
| `S3D-02` | Navegar el modelo espacial por lista | ES la respuesta a la precisión en 3D, y sus objetivos son demasiado pequeños. | Objetivos por debajo del mínimo. |

## TABLA F — Unknowns declarados

**98 de 122** filas declaran al menos un unknown.

| ID | Tarea | Unknown |
|---|---|---|
| `ENT-01` | Elegir por dónde empezar al abrir la app | No hay evidencia de frecuencia real de uso de cada ruta de arranque. |
| `ENT-02` | Continuar el proyecto en el que estaba | No se verificó qué ocurre si localStorage tiene un proyecto y el hub otro más reciente. |
| `ENT-03` | Crear un proyecto en blanco | Frecuencia real. |
| `ENT-04` | Abrir un ejemplo / plantilla | Si el usuario entiende que el ejemplo YA es su proyecto editable. |
| `ENT-05` | Filtrar plantillas por tipo | Frecuencia real de uso. |
| `ENT-06` | Ver y abrir proyectos guardados (Project Hub) | Si el Hub y el proyecto vivo de localStorage pueden desincronizarse. |
| `ENT-07` | Renombrar un proyecto guardado | Comportamiento de Escape durante la edición. |
| `ENT-08` | Duplicar un proyecto guardado | Frecuencia real. |
| `ENT-09` | Restaurar una recuperación tras conflicto | Si el usuario relaciona el aviso del TopBar con la lista del Hub. |
| `ENT-10` | Importar JSON / bundle / PDF (Import Center) | Qué porcentaje de bundles reales son importables (el código distingue `available` de `withAdapter`). |
| `ENT-11` | Importar geometría desde DXF | Estados de error del parser y su presentación. |
| `ENT-12` | Crear un ejercicio de Aula | Ninguno relevante para este mapa. |
| `ENT-13` | Renombrar el proyecto abierto | Frecuencia real de renombrado. |
| `ENT-15` | Abrir Space 3D | No se verificó qué se conserva al ir y volver entre 2D y Space3D. |
| `SHL-01` | Ejecutar el análisis | No existe ruta para cancelar un análisis en curso. |
| `SHL-02` | Saber en qué estado está el análisis | Si el usuario distingue «limitado» de «no fiable» sin abrir el detalle. |
| `SHL-03` | Deshacer | Frecuencia real de undo. |
| `SHL-05` | Abrir la paleta de comandos | Uso real en táctil. |
| `SHL-06` | Navegar a un nudo o barra por identificador | Rendimiento con modelos grandes; el generador admite hasta 2 000 entidades (`MAX_GENERATED_ENTITIES`). |
| `SHL-07` | Elegir caso de carga o combinación a analizar | Cuántas combinaciones tiene un proyecto real medio. |
| `SHL-08` | Cambiar el modo de cálculo (Aula / Completo) | Si el usuario cambia de modo alguna vez tras la primera elección. |
| `SHL-09` | Elegir el orden de análisis (1.º orden / P-Delta) | Frecuencia real. |
| `SHL-10` | Ajustar los parámetros avanzados de P-Delta | Si algún usuario ha llegado a estos campos. |
| `SHL-11` | Cambiar el sistema de unidades | Frecuencia de cambio dentro de una sesión. |
| `SHL-14` | Abrir Model Doctor | Frecuencia real de apertura preventiva vs reactiva. |
| `SHL-16` | Ocultar / mostrar el Inspector | Cuántos usuarios han encontrado esta preferencia. |
| `SHL-17` | Entrar/salir de «mesa completa» | Qué hace exactamente `fullCanvas` que no haga `inspectorCollapsed`. |
| `SHL-18` | Contraer el ToolRail a iconos | Coste real en descubribilidad de herramientas (H-1 de CRI-7 pide medirlo). |
| `SHL-19` | Redimensionar el Inspector | Anchura preferida real de los usuarios. |
| `SHL-20` | Elegir el detent de la hoja Inspector en táctil | Si el usuario descubre los tres botones o arrastra esperando cambiar de detent. |
| `SHL-21` | Conocer el estado de persistencia y conectividad | Si el usuario entiende «recuperado» sin más contexto. |
| `SHL-22` | Exportar el proyecto y compartirlo | Qué salidas se usan realmente. |
| `SHL-24` | Actualizar la app instalada (PWA) | Si se pierde estado no persistido al aplicar la actualización. |
| `MOD-01` | Elegir herramienta activa | Frecuencia relativa entre herramientas. |
| `MOD-02` | Crear un nudo | Frecuencia real. |
| `MOD-03` | Crear una barra | Frecuencia real. |
| `MOD-04` | Aplicar o cambiar un apoyo | Qué tipo de apoyo se usa más. |
| `MOD-05` | Colocar una carga puntual | Frecuencia relativa entre tipos de carga. |
| `MOD-06` | Colocar una carga distribuida | Si el usuario controla el sistema de coordenadas desde la interfaz o sólo desde el Datasheet. |
| `MOD-09` | Borrar objetos | Si el usuario táctil encuentra el undo tras un borrado accidental. |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | Si el usuario descubre que el lanzador aparece sólo con selección. |
| `MOD-11` | Entrada numérica rápida durante la colocación | Descubribilidad real. |
| `MOD-12` | Repetir la última operación (Repeat) | Ruta táctil de Repeat — UNKNOWN explícito. |
| `MOD-13` | Copiar, pegar y duplicar | Si `linear-array` (MOD-10) cubre en la práctica la necesidad de duplicar en táctil. |
| `MOD-14` | Generar una estructura completa | Frecuencia relativa entre las cinco familias. |
| `MOD-15` | Medir con la herramienta de dimensión | Frecuencia real. |
| `MOD-16` | Hacer un corte para leer valores internos | Si el usuario entiende por qué la herramienta «no hace nada» antes de analizar. |
| `SEL-01` | Seleccionar un objeto | Que `selectionFilter` esté ocultando objetos no se comunica en el lienzo. |
| `SEL-02` | Resolver objetos solapados con puntero | Si la lupa táctil compensa en la práctica la ausencia del picker. |
| `SEL-03` | Seleccionar con marco (box select) | Si taps acumulativos funcionan en táctil (no verificado si el tap acumula o reemplaza). |
| `SEL-04` | Multiselección acumulativa | Si el tap acumula en táctil. |
| `SEL-05` | Deseleccionar | Equivalente táctil completo de Escape. |
| `SEL-06` | Filtrar qué tipos son seleccionables | Si algún usuario lo ha encontrado. |
| `SEL-07` | Precisión táctil: ver bajo el dedo | Si el long-press (`shouldArmLongPress`) produce en la práctica una experiencia equivalente al Precision Selector. |
| `CNV-01` | Encuadrar, acercar y alejar | Si existe atajo de teclado para «ajustar» (no encontrado). |
| `CNV-02` | Orientarse con el minimapa | Interactividad del minimapa (teclado y táctil) — no verificada. |
| `CNV-03` | Controlar qué capas se ven | Qué gana si las capas y los `show*` del Inspector se contradicen. |
| `CNV-04` | Activar rejilla y ajuste (snap) | Frecuencia de cambio de `snapTargets`. |
| `CNV-07` | Navegar el modelo con el teclado | Escalabilidad con modelos grandes. |
| `CNV-09` | Exportar el lienzo como imagen | Si el toast puede aparecer aunque la exportación falle. |
| `CNV-10` | Ver el modelo en modo impresión | Calidad real del resultado impreso — no verificada. |
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | Cuánto tiempo de sesión transcurre sin selección. |
| `INS-02` | Aplicar un material de catálogo | Tamaño real del catálogo de materiales. |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | Cuál de las dos vías masivas se usa más. |
| `INS-05` | Gestionar casos de carga y combinaciones | Cuántas combinaciones maneja un proyecto real. |
| `INS-06` | Ajustar la visualización del modelo y de los resultados | Cuáles de los ~20 controles se tocan alguna vez. |
| `INS-07` | Elegir la herramienta de carga desde el Inspector | Si alguien usa esta ruta en Expanded. |
| `RES-02` | Leer reacciones y localizar la máxima | Comportamiento con cientos de nudos (¿hay virtualización? no verificado). |
| `RES-03` | Leer los diagramas N, V y M | Cómo se elige el miembro cuando no hay selección (hoy: el primero no rígido). |
| `RES-05` | Consultar el índice elástico estimado | Qué fracción de modelos reales tiene sección Y material identificados. |
| `RES-06` | Entender la fiabilidad del resultado | Si el usuario distingue los cuatro niveles. |
| `RES-07` | Ver líneas de influencia | Frecuencia real de uso. |
| `RES-08` | Aprender por qué salió ese resultado | Uso fuera del modo Aula. |
| `RES-09` | Cambiar la altura y el modo del panel de resultados | Por qué `focused` no se restaura al recargar. |
| `RES-10` | Saber de dónde sale un número (procedencia) | Por qué `influence` no genera procedencia. |
| `RES-11` | Localizar el objeto de un resultado en el modelo | Si `focus-object` anuncia algo a lectores de pantalla. |
| `DAT-01` | Ver el modelo como tabla | Rendimiento con miles de filas (no se verificó virtualización). |
| `DAT-06` | Pegar un bloque de celdas | Ruta táctil de pegado — UNKNOWN explícito. |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | Cuánto se solapa realmente el conjunto de campos entre las tres. |
| `DAT-09` | Cambiar de entidad (nudos / barras / cargas) | Si faltan entidades que el usuario esperaría (apoyos, combinaciones). |
| `DAT-10` | Enfocar en el lienzo el objeto de la fila | Si el usuario pierde el contexto tabular al volver. |
| `DOC-01` | Diagnosticar el modelo antes de analizar | Cuántos hallazgos tiene un modelo real medio. |
| `DOC-04` | Localizar el objeto de un hallazgo | Si el usuario vuelve al Doctor tras localizar, y cómo. |
| `DOC-05` | Previsualizar y aplicar una reparación de topología | Frecuencia real de reparaciones aplicables. |
| `DOC-06` | Reconocer (acknowledge) un hallazgo | Si el usuario espera que persista. |
| `DOC-07` | Saltar del hallazgo a la herramienta que lo arregla | Si combinar localizar + herramienta en un solo gesto sería mejor. |
| `PER-01` | Guardar automáticamente el trabajo | Qué ocurre si localStorage y IndexedDB divergen. |
| `PER-03` | Resolver un conflicto de revisión | Frecuencia real de conflictos. |
| `PER-04` | Migrar un proyecto de una versión anterior | Si el usuario se entera de que su proyecto fue migrado. |
| `STA-02` | Entender un estado de carga | Cuántas superficies consumen `StatusStrip` realmente. |
| `STA-03` | Entender un análisis obsoleto (stale) | Comportamiento del overlay del lienzo en estado stale. |
| `STA-04` | Entender un análisis fallido | Si `issues` fue una pestaña que se retiró sin limpiar el tipo. |
| `STA-05` | Entender un control deshabilitado | Recuento exacto de controles deshabilitados sin explicación. |
| `STA-06` | Trabajar con movimiento reducido / alto contraste | Contraste medido por píxel (CRI-7 lo declara pendiente). |
| `AUL-01` | Seguir el recorrido guiado de un ejercicio | Nada relevante: CRI-8 no diseña Aula. |
| `AUL-03` | Mantener la sesión de aula | Qué persiste de una sesión de aula entre recargas. |
| `S3D-01` | Trabajar en el dominio espacial experimental | Qué se conserva al ir y volver entre 2D y Space3D. NO SE INVENTA información espacial: el mapa no afirma paridad alguna. |
| `S3D-02` | Navegar el modelo espacial por lista | Alcance real del navegador (¿todas las entidades?). |

## TABLA G — Decisiones que CRI-9 debe resolver (por tarea)

**113 entradas.**

| ID | Tarea | Decisión pendiente |
|---|---|---|
| `ENT-01` | Elegir por dónde empezar al abrir la app | ¿Welcome debe seguir siendo una pantalla o pasar a ser un estado del shell? Hoy es una pantalla con su propio breakpoint (767). |
| `ENT-02` | Continuar el proyecto en el que estaba | Coexisten dos almacenes (localStorage para el proyecto vivo, IndexedDB para el hub). CRI-9 debe decidir cuál es la fuente de "continuar". |
| `ENT-03` | Crear un proyecto en blanco | ¿Crear proyecto debe pedir confirmación cuando hay trabajo sin exportar? Hoy sólo lo protege el undo. |
| `ENT-04` | Abrir un ejemplo / plantilla | "Abrir un ejemplo y convertirlo en proyecto propio" no tiene hoy paso de apropiación: se abre como proyecto sin renombrar. |
| `ENT-05` | Filtrar plantillas por tipo | Con 6 ejemplos, el filtro puede no justificarse; es decisión de CRI-9, no de este mapa. |
| `ENT-06` | Ver y abrir proyectos guardados (Project Hub) | HUECO DE ACCESO: desde la mesa no hay ruta al Hub. Cambiar de proyecto obliga a volver a Inicio. |
| `ENT-08` | Duplicar un proyecto guardado | Duplicar es la única forma de versionar; ¿debe existir también desde la mesa? |
| `ENT-09` | Restaurar una recuperación tras conflicto | HUECO DE ACCESO CRÍTICO: el conflicto se anuncia en la mesa y se resuelve en otra pantalla. CRI-9 debe cerrar ese salto. |
| `ENT-10` | Importar JSON / bundle / PDF (Import Center) | Es el modelo de "workflow temporal" que el resto del producto no tiene. ¿Se generaliza el patrón? |
| `ENT-11` | Importar geometría desde DXF | HUECO DE ACCESO: importar DXF sobre un modelo ya abierto exige volver a Inicio. |
| `ENT-12` | Crear un ejercicio de Aula | Fuera de alcance: CRI-8 no diseña Aula vNext. Sólo se registra que la superficie existe. |
| `ENT-13` | Renombrar el proyecto abierto | ¿La identidad del documento merece anchura permanente en Compact, o basta con verla y editarla bajo disclosure? |
| `ENT-14` | Volver a Inicio desde la mesa | ¿Sale sin avisar aunque haya trabajo sin guardar? Hoy sí; el autosave lo justifica pero no se comunica. |
| `ENT-15` | Abrir Space 3D | ¿Un dominio experimental merece presencia permanente en el TopBar de Expanded? Es la pregunta, no la respuesta. |
| `SHL-01` | Ejecutar el análisis | Es la única acción que justifica sin discusión presencia permanente. ¿Merece atajo de teclado? |
| `SHL-02` | Saber en qué estado está el análisis | Es candidato claro a «global persistente» aunque el resto de Results no lo sea. CRI-9 debe poder separarlos. |
| `SHL-03` | Deshacer | DECISIÓN: implementar el atajo que la interfaz ya promete, o retirar la promesa. Hoy la paleta miente. |
| `SHL-04` | Rehacer | Mismo que SHL-03. |
| `SHL-05` | Abrir la paleta de comandos | OPORTUNIDAD: la paleta ya conoce la selección pero no la usa para ordenar ni filtrar. Es el sitio natural del patrón "acciones válidas para lo seleccionado". |
| `SHL-06` | Navegar a un nudo o barra por identificador | Con miles de entidades la lista es lineal: ¿escala? No se midió. |
| `SHL-07` | Elegir caso de carga o combinación a analizar | Es el control que MÁS se parece a "contextual a análisis" y hoy vive fijo en el chrome global. Candidato número uno a reubicarse junto a los resultados. |
| `SHL-08` | Cambiar el modo de cálculo (Aula / Completo) | DECISIÓN: es una preferencia de sesión, no una acción de trabajo. Cuatro puertas permanentes para ella es el ejemplo más claro de acumulación del producto. |
| `SHL-09` | Elegir el orden de análisis (1.º orden / P-Delta) | Baja frecuencia, alta criticidad: es el caso donde "poco usado" no puede significar "escondido". |
| `SHL-10` | Ajustar los parámetros avanzados de P-Delta | FUNCIÓN DEMASIADO ESCONDIDA nº 1. La configuración de convergencia de un análisis no lineal no debería vivir bajo un `details` dentro de un popover. |
| `SHL-11` | Cambiar el sistema de unidades | Es preferencia, pero de consecuencia visible inmediata en cada cifra. ¿Preferencia o contexto de lectura? |
| `SHL-12` | Cambiar el idioma | Ubicación correcta hoy; el problema es que comparte cajón con Deshacer. |
| `SHL-13` | Cambiar el tema (claro / oscuro) | Space3D duplica la resolución de tema — infracción de "no duplicar lógica por presentación". |
| `SHL-14` | Abrir Model Doctor | ¿El acceso debe ser permanente o debe aparecer cuando HAY hallazgos? El toast ya sabe cuándo los hay. |
| `SHL-15` | Abrir la hoja de datos (Datasheet) | ¿El Datasheet es un destino modal o una vista coordinada? Hoy es modal y cerrarse es parte de enfocar un objeto (DAT-10). |
| `SHL-16` | Ocultar / mostrar el Inspector | FUNCIÓN DEMASIADO ESCONDIDA nº 2. El control que más canvas-budget devuelve está a tres pasos dentro de un cajón de 19 entradas. |
| `SHL-17` | Entrar/salir de «mesa completa» | Se solapa con SHL-16 sin que la diferencia sea evidente: ocultar Inspector vs mesa completa. |
| `SHL-18` | Contraer el ToolRail a iconos | El usuario tiene que corregir a mano un reparto que la app debería proponer bien. CRI-9 debe fijar el valor por defecto por clase de ventana. |
| `SHL-19` | Redimensionar el Inspector | El default de 320px es el que produce el canvas-budget invertido. La palanca existe; el punto de partida está mal. |
| `SHL-20` | Elegir el detent de la hoja Inspector en táctil | Los detents son la respuesta táctil al mismo problema que el ancho resuelve en puntero. Medium no tiene NINGUNA de las dos. |
| `SHL-21` | Conocer el estado de persistencia y conectividad | HUECO: el estado `conflict` informa pero no ofrece acción. La restauración vive en el Project Hub, en otra pantalla (ENT-09). |
| `SHL-22` | Exportar el proyecto y compartirlo | Siete salidas × tres puertas = 21 afordancias para una familia de baja frecuencia. Es el caso más claro de "duplicación innecesaria". |
| `SHL-23` | Recibir avisos transitorios (toasts) | ¿Qué merece toast y qué merece estado persistente? Hoy el toast de Model Doctor compite con el chip de AnalysisStatus. |
| `MOD-01` | Elegir herramienta activa | Las herramientas de CREACIÓN no pueden depender de la selección (no hay nada seleccionado al crear). Las de EDICIÓN sí. El rail hoy no distingue. |
| `MOD-03` | Crear una barra | El patrón "operación en dos tiempos con estado intermedio" existe aquí, en cut y en la edición estructural. ¿Es un patrón del sistema? |
| `MOD-04` | Aplicar o cambiar un apoyo | La herramienta `support` del rail está SIEMPRE visible aunque no haya nudo; la edición fina está SIEMPRE visible aunque no haya selección. Ambas mitades son candidatas a contexto. |
| `MOD-05` | Colocar una carga puntual | En Compact colocar una carga cuesta 3 toques frente a 2 en Expanded. ¿Es aceptable o es el precio de no tener rail? |
| `MOD-08` | Dividir una barra (Split) | El ocultamiento por modo Aula ya es un precedente de "capacidad presente, exposición contextual". CRI-9 puede generalizarlo. |
| `MOD-09` | Borrar objetos | Borrar en táctil cuesta 3 pasos y no tiene deshacer accesible sin teclado (SHL-03 no tiene atajo y en Compact vive en «Más»). Es un hueco real. |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | ESTE ES EL PATRÓN A GENERALIZAR: aparece por selección, ocupa espacio sólo mientras dura, previsualiza y se cancela con Escape. |
| `MOD-11` | Entrada numérica rápida durante la colocación | Es la ruta de precisión que NO depende del método de entrada. Merece ser primera clase, no un accesorio de la colocación. |
| `MOD-12` | Repetir la última operación (Repeat) | Función potente sin ruta de menú ni entrada en la paleta. Si el teclado falla, no existe. |
| `MOD-13` | Copiar, pegar y duplicar | HUECO DE ACCESO CONFIRMADO: copiar/pegar/duplicar no tienen ninguna ruta táctil. La restricción "no crear versión funcional separada para móvil" está incumplida aquí. |
| `MOD-14` | Generar una estructura completa | El generador es "crear" y no depende de selección; la edición estructural es "transformar" y sí depende. El rail los mezcla en el mismo espacio permanente. |
| `MOD-16` | Hacer un corte para leer valores internos | Herramienta que sólo funciona tras analizar, pero que está disponible siempre y no explica su precondición. Es el caso tipo de "disabled sin explicación". |
| `SEL-01` | Seleccionar un objeto | La selección única es la restricción que hace posible todo lo contextual. CRI-9 debe construir sobre ella, no romperla. |
| `SEL-02` | Resolver objetos solapados con puntero | HUECO DE PARIDAD: el mejor mecanismo de precisión del producto está apagado justo en el método de entrada que más lo necesita. |
| `SEL-03` | Seleccionar con marco (box select) | HUECO DE PARIDAD nº 2: seleccionar varios objetos en el lienzo táctil no tiene equivalente. La ruta de reserva (Datasheet) existe, pero es otra tarea mental. |
| `SEL-04` | Multiselección acumulativa | Multiselección de CARGAS no existe como estado. Si CRI-9 quiere «acciones válidas para la selección», debe saber que ese caso no se puede expresar hoy. |
| `SEL-05` | Deseleccionar | Escape es el contrato de cancelación del producto. Cualquier superficie nueva debe respetarlo. |
| `SEL-06` | Filtrar qué tipos son seleccionables | FUNCIÓN DEMASIADO ESCONDIDA nº 3: una herramienta de precisión de selección enterrada en una pestaña de preferencias del Inspector, y sin realimentación en el lienzo. |
| `SEL-07` | Precisión táctil: ver bajo el dedo | LA LUPA YA EXISTE Y NO CUBRE LA SELECCIÓN SIMPLE. Es donde Onshape sí llega (touch-and-hold → Precision Selector → soltar para seleccionar). CRI-9 debe decidir si se amplía o si el long-press ya lo cubre. |
| `CNV-01` | Encuadrar, acercar y alejar | El chrome flotante debería escalar con el lienzo o retirarse cuando el lienzo es pequeño. Hoy hace lo contrario. |
| `CNV-02` | Orientarse con el minimapa | ¿Un minimapa permanente se justifica cuando el modelo cabe entero? Hoy ocupa lo mismo en ambos casos. |
| `CNV-03` | Controlar qué capas se ven | DUPLICACIÓN INNECESARIA CONFIRMADA: dos sistemas de visibilidad (capas del lienzo y ajustes del Inspector › Vista) gobiernan lo mismo desde sitios distintos, sin relación visible entre ellos. |
| `CNV-04` | Activar rejilla y ajuste (snap) | Los chips ocupan lienzo para informar de algo que no dejan cambiar. Si van a estar ahí, ¿por qué no son el control? |
| `CNV-05` | Leer la posición y la escala actuales | Es el precedente interno de «responder al método de entrada». CRI-9 puede citarlo como patrón existente. |
| `CNV-06` | Saber en qué modo está el lienzo | El badge es el único sitio donde el producto explica el gesto correcto. ¿Es suficiente o hace falta más? |
| `CNV-07` | Navegar el modelo con el teclado | Con miles de objetos, tabular uno a uno no escala. ¿Hay un nivel intermedio (grupos, saltos)? Hoy no. |
| `CNV-08` | Arrastrar un nudo | El patrón de transacción es correcto y debería ser el contrato para cualquier gesto continuo nuevo. |
| `CNV-10` | Ver el modelo en modo impresión | La composición de impresión es la prueba de que «retirar todo el chrome» no rompe nada. CRI-9 debería mirarla como referencia interna. |
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | DECISIÓN CENTRAL: el Inspector es contextual a la selección en su CONTENIDO pero global permanente en su PRESENCIA. Sin selección ocupa 320px para mostrar un estado vacío. |
| `INS-02` | Aplicar un material de catálogo | Ejemplo canónico del enunciado de CRI-8: puerta individual = Inspector, masiva = Bulk Edit/Datasheet, en lote = generador. Las tres escriben el MISMO comando. |
| `INS-03` | Aplicar una sección de catálogo | La previsualización de sección necesita espacio propio. En una hoja Compact compite con el resto de propiedades. |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | Bulk Edit y el Datasheet resuelven «masivo» de dos formas distintas (por propiedad vs por celda). Ambas legítimas; CRI-9 debe decir cuándo lleva a cuál. |
| `INS-05` | Gestionar casos de carga y combinaciones | INCOHERENCIA DE UBICACIÓN: definir hipótesis no es una propiedad de la selección, pero vive dentro del panel de selección. Es contextual a PROYECTO, no a OBJETO. |
| `INS-06` | Ajustar la visualización del modelo y de los resultados | SEGUNDA INCOHERENCIA: los ajustes del LIENZO viven en el panel de la SELECCIÓN, mientras el control de capas vive sobre el lienzo. Dos sistemas, dos sitios, un solo dibujo. |
| `INS-07` | Elegir la herramienta de carga desde el Inspector | DUPLICACIÓN INNECESARIA: cinco lanzadores para las mismas tres herramientas. En Compact tiene sentido (la hoja está abierta); en Expanded el rail ya está a la vista. |
| `RES-01` | Leer el resumen del análisis | DECISIÓN CENTRAL: el panel reserva altura antes de que exista un resultado. El contenido es 100% contextual al análisis; la presencia no. |
| `RES-02` | Leer reacciones y localizar la máxima | La tabla de reacciones y el Datasheet muestran datos del mismo modelo con dos motores de tabla distintos. |
| `RES-03` | Leer los diagramas N, V y M | RESULTS NO ES UNA UNIDAD: el diagrama tiene una parte de panel (la gráfica), una de lienzo (el overlay), una de selección (qué miembro) y una de datos densos (la tabla). CRI-9 puede separarlas. |
| `RES-04` | Ver la deformada | El control de escala vive en el Inspector y el resultado en Results: dos paneles para una lectura. |
| `RES-05` | Consultar el índice elástico estimado | Es la mejor prueba de que el producto sabe decir «no puedo». Ese contrato debe sobrevivir a cualquier reorganización. |
| `RES-06` | Entender la fiabilidad del resultado | HUECO: la EXPLICACIÓN de por qué un resultado es limitado o no fiable vive en un `title` HTML, que no existe en táctil ni por teclado. La información más crítica del producto tiene la ruta más débil. |
| `RES-07` | Ver líneas de influencia | Es datos densos dentro de un panel de 285px. Candidata clara a superficie propia. |
| `RES-08` | Aprender por qué salió ese resultado | Contenido explicativo largo dentro de un panel corto: el modo «enfocado» ya lo reconoce. ¿Debe ser una superficie propia? |
| `RES-09` | Cambiar la altura y el modo del panel de resultados | COMPACT YA HACE LO CORRECTO (colapsado por defecto, se abre cuando hay algo que enseñar). Expanded reserva altura desde el arranque. Es la misma inversión que el canvas-budget general. |
| `RES-10` | Saber de dónde sale un número (procedencia) | Debe sobrevivir a cualquier reorganización de Results. Si Results se descompone, la procedencia tiene que seguir al número, no quedarse en un panel. |
| `RES-11` | Localizar el objeto de un resultado en el modelo | ESTE ES EL TEJIDO QUE MANTIENE COHERENTES LAS «VARIAS PUERTAS AL MISMO MODELO». Cualquier superficie nueva debe emitir `focus-object`, no inventar navegación. |
| `DAT-01` | Ver el modelo como tabla | ¿Debe seguir siendo modal, o puede coexistir con el lienzo como en RFEM/ETABS? Hoy enfocar un objeto obliga a cerrarla. |
| `DAT-03` | Filtrar y ordenar | Los filtros del Datasheet, las capas del lienzo y el filtro de selección resuelven «reducir el universo» de tres maneras distintas en tres sitios. |
| `DAT-04` | Seleccionar filas y sincronizar con el lienzo | La tabla es hoy la ÚNICA vía táctil a la multiselección, pero tapa el lienzo mientras se usa: se selecciona sin ver lo que se selecciona. |
| `DAT-05` | Editar una celda | La regla «un cambio simple se aplica solo, varios pasan por revisión» es un contrato de interacción propio. Merece enunciarse como patrón, no quedarse en un comentario. |
| `DAT-06` | Pegar un bloque de celdas | Pegar es la operación masiva más potente y no tiene ruta táctil. Mismo hueco que MOD-13. |
| `DAT-07` | Revisar, aplicar o cancelar un cambio pendiente | Este patrón (borrador → plan → preview → escritura única) existe en Datasheet, Bulk Edit, edición estructural, generadores y Model Doctor. Son CINCO implementaciones del mismo contrato. |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | DUPLICACIÓN A EVALUAR: hay TRES fichas de propiedades del mismo objeto (Inspector, DatasheetEditorPanel, Bulk Edit). Las tres escriben el mismo modelo, pero son tres interfaces distintas para la misma lectura. |
| `DAT-09` | Cambiar de entidad (nudos / barras / cargas) | Sólo tres entidades. Apoyos, materiales, secciones y combinaciones no tienen tabla. |
| `DAT-10` | Enfocar en el lienzo el objeto de la fila | Que enfocar EXIJA cerrar la tabla es la prueba de que hoy son destinos alternativos y no vistas coordinadas. RFEM y ETABS resuelven esto con tablas acopladas. |
| `DOC-01` | Diagnosticar el modelo antes de analizar | El lanzador no dice cuántos hallazgos hay, aunque el sistema ya lo calcula para el toast. |
| `DOC-03` | Entender un hallazgo | Este modelo de tres textos es el mismo que necesitaría cualquier estado de error del producto. Hoy sólo lo tiene Model Doctor. |
| `DOC-04` | Localizar el objeto de un hallazgo | Igual que DAT-10: localizar exige cerrar el diagnóstico. SkyCiv mantiene el resalte con el panel abierto («Preview»). |
| `DOC-05` | Previsualizar y aplicar una reparación de topología | Es el workflow temporal más completo del producto y vive dentro de un drawer. ¿Merece superficie propia? |
| `DOC-06` | Reconocer (acknowledge) un hallazgo | El reconocimiento se pierde al recargar la app. ¿Debe persistir? Es una decisión de producto, no un defecto. |
| `DOC-07` | Saltar del hallazgo a la herramienta que lo arregla | Elige la herramienta pero NO la selección: el usuario queda con la herramienta correcta y sin el objeto. Comparar con DOC-04, que sí selecciona. |
| `PER-01` | Guardar automáticamente el trabajo | Dos almacenes con papeles distintos y sin contrato explícito de cuál manda. Es la ambigüedad de persistencia más importante que queda. |
| `PER-02` | Trabajar sin conexión | Offline no bloquea nada, pero se muestra con el mismo tono de aviso que los errores reales. ¿Es un problema o un estado normal? |
| `PER-03` | Resolver un conflicto de revisión | HUECO DE ACCESO nº 1 EN GRAVEDAD: el producto detecta el conflicto, salva ambas versiones y luego deja al usuario sin ruta para resolverlo sin salir de la mesa. |
| `PER-04` | Migrar un proyecto de una versión anterior | Una migración silenciosa es cómoda hasta que algo cambia de sentido. ¿Debe anunciarse? |
| `STA-01` | Entender un estado vacío | El panel de Results reserva 22-25% del viewport PARA MOSTRAR UN ESTADO VACÍO cuando no se ha analizado. El estado es bueno; el coste de mostrarlo permanentemente, no. |
| `STA-02` | Entender un estado de carga | El `StatusStrip` con seis tonos existe y NO lo consumen todas las superficies. Es el mismo problema que F-04: patrón hecho, no conectado. |
| `STA-03` | Entender un análisis obsoleto (stale) | Con el análisis obsoleto, el overlay de resultados del lienzo sigue dibujado. No se verificó si se atenúa o se retira. |
| `STA-04` | Entender un análisis fallido | INCOHERENCIA MENOR VERIFICADA: `resultTab` puede valer `"issues"`, pero la lista de pestañas de `ResultsPanel` no incluye esa pestaña, así que `activeTab` cae silenciosamente a `summary` (`ResultsPanel.tsx:179`). Funcionalmente no se pierde nada (el cuerpo muestra el fallo igualmente), pero `aria-selected` queda en una pestaña que no es el estado real. |
| `STA-05` | Entender un control deshabilitado | Regla pendiente: todo control deshabilitado debe poder decir por qué, y por una ruta que exista en táctil (no `title`). |
| `STA-06` | Trabajar con movimiento reducido / alto contraste | Cualquier animación nueva debe respetar el mismo contrato. |
| `AUL-01` | Seguir el recorrido guiado de un ejercicio | FUERA DE ALCANCE DISEÑAR AULA vNEXT. Sólo se registra: en modo Aula el lienzo pierde una banda adicional sobre un presupuesto que ya está invertido en Expanded. |
| `AUL-02` | Ver niveles pedagógicos del resultado | Fuera de alcance. |
| `AUL-03` | Mantener la sesión de aula | Fuera de alcance. |
| `S3D-01` | Trabajar en el dominio espacial experimental | RESTRICCIÓN PROTEGIDA: mantener 2D y Space3D separados y NO exigir paridad. Lo que sí debe decidirse es si Space3D hereda el sistema de interacción de CRI-9 o queda congelado hasta salir de experimental. |
| `S3D-02` | Navegar el modelo espacial por lista | Confirma que «lista de objetos como ruta de precisión» es un patrón que el producto ya usó dos veces (paleta 2D, ModelNav 3D) sin declararlo. |

## TABLA H — Patrones que CRI-10 debe diseñar (por tarea)

**106 entradas.**

| ID | Tarea | Patrón visual/interactivo |
|---|---|---|
| `ENT-01` | Elegir por dónde empezar al abrir la app | Sistema de tarjeta de plantilla y jerarquía del hero bajo Brandbook. |
| `ENT-03` | Crear un proyecto en blanco | Patrón único de popover de menú con secciones. |
| `ENT-04` | Abrir un ejemplo / plantilla | Tarjeta de plantilla con categoría, badge e icono. |
| `ENT-05` | Filtrar plantillas por tipo | Chip de filtro (mismo patrón que las facetas del Datasheet — hoy son dos implementaciones distintas). |
| `ENT-06` | Ver y abrir proyectos guardados (Project Hub) | Fila de proyecto con acciones secundarias. |
| `ENT-07` | Renombrar un proyecto guardado | Campo editable en línea dentro de tabla. |
| `ENT-09` | Restaurar una recuperación tras conflicto | Patrón de recuperación: cómo se presenta una versión alternativa sin sugerir que se pierde la actual. |
| `ENT-10` | Importar JSON / bundle / PDF (Import Center) | Indicador de etapas y su versión Compact. |
| `ENT-12` | Crear un ejercicio de Aula | Reconstruir este diálogo con `sc-*` SIN perder su accesibilidad. |
| `ENT-13` | Renombrar el proyecto abierto | Campo de identidad de documento: cuándo es texto y cuándo es campo. |
| `ENT-14` | Volver a Inicio desde la mesa | Marca-como-navegación. |
| `ENT-15` | Abrir Space 3D | Marcado visual de "experimental" bajo Brandbook. |
| `SHL-01` | Ejecutar el análisis | Botón primario y su estado de carga. |
| `SHL-02` | Saber en qué estado está el análisis | Escala de estados de fiabilidad: seis niveles con forma además de color. |
| `SHL-03` | Deshacer | Anuncio de "se deshizo X" — la descripción ya existe y no se muestra. |
| `SHL-05` | Abrir la paleta de comandos | Item de paleta con grupo, pista y atajo. |
| `SHL-07` | Elegir caso de carga o combinación a analizar | Selector de hipótesis: cómo se lee que TODO lo que se ve pertenece a esa combinación. |
| `SHL-08` | Cambiar el modo de cálculo (Aula / Completo) | Segmented control unificado (hoy conviven `select` y `segmented-control` para el mismo estado). |
| `SHL-09` | Elegir el orden de análisis (1.º orden / P-Delta) | Cómo se marca que un ajuste invalida lo que hay en pantalla. |
| `SHL-10` | Ajustar los parámetros avanzados de P-Delta | Grupo de parámetros numéricos avanzados con sus valores por defecto visibles. |
| `SHL-11` | Cambiar el sistema de unidades | Cómo se indica la unidad activa sin repetirla en cada celda. |
| `SHL-13` | Cambiar el tema (claro / oscuro) | Tercer estado «según el sistema» que el Brandbook describe y el producto no tiene. |
| `SHL-14` | Abrir Model Doctor | Indicador de severidad en el lanzador (hoy no existe: el botón no dice si hay 0 o 12 hallazgos). |
| `SHL-15` | Abrir la hoja de datos (Datasheet) | Lanzador de superficie densa. |
| `SHL-16` | Ocultar / mostrar el Inspector | Afordancia de colapso de panel en el borde del propio panel (hoy el Inspector sólo tiene tirador de ANCHO, no de colapso). |
| `SHL-18` | Contraer el ToolRail a iconos | Rail de sólo iconos: cómo se conserva la descubribilidad sin la etiqueta. |
| `SHL-19` | Redimensionar el Inspector | Tirador de redimensión: ancho de acierto vs ancho dibujado. |
| `SHL-20` | Elegir el detent de la hoja Inspector en táctil | Hoja con detents: tirador arrastrable además de los botones. |
| `SHL-21` | Conocer el estado de persistencia y conectividad | Escala de estados de almacenamiento con forma además de color. |
| `SHL-22` | Exportar el proyecto y compartirlo | Menú de exportación agrupado por destino (datos / informe / imagen). |
| `SHL-23` | Recibir avisos transitorios (toasts) | Toast bajo Brandbook con los cuatro tonos. |
| `SHL-24` | Actualizar la app instalada (PWA) | Coherencia del verde de marca entre icono instalado y CTA (F-11). |
| `MOD-01` | Elegir herramienta activa | Unificar la gramática de estado activo: hundido, nunca teñido y hundido a la vez. |
| `MOD-02` | Crear un nudo | Retícula de snap y su realimentación visual. |
| `MOD-03` | Crear una barra | Estado intermedio de creación: cómo se lee que falta un paso. |
| `MOD-04` | Aplicar o cambiar un apoyo | Editor de apoyo: tipo, ángulo, restricciones y muelles en una sola lectura. |
| `MOD-05` | Colocar una carga puntual | Símbolo de carga y su rótulo: hoy el rótulo va a 8px. |
| `MOD-06` | Colocar una carga distribuida | Símbolo de carga distribuida legible a densidad alta. |
| `MOD-07` | Colocar un momento | Símbolo de momento con sentido de giro legible. |
| `MOD-09` | Borrar objetos | Acción destructiva: cómo se marca sin volverse alarmista, y cómo se ofrece deshacer inmediato. |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | Overlay de transformación: gesto y número en la misma superficie. |
| `MOD-11` | Entrada numérica rápida durante la colocación | Campo numérico flotante sobre lienzo, legible en ambos temas. |
| `MOD-12` | Repetir la última operación (Repeat) | Overlay de repetición contextual. |
| `MOD-13` | Copiar, pegar y duplicar | Acciones de portapapeles contextual a selección. |
| `MOD-14` | Generar una estructura completa | Formulario de parámetros con preview simultáneo. |
| `MOD-15` | Medir con la herramienta de dimensión | Cota: trazo y tipografía legibles a densidad alta. |
| `MOD-16` | Hacer un corte para leer valores internos | Marca de corte y su lectura numérica sobre el lienzo. |
| `SEL-01` | Seleccionar un objeto | Realce de selección: contorno vs relleno, y su versión sobre diagramas. |
| `SEL-02` | Resolver objetos solapados con puntero | Picker de candidatos: cómo se lee la lista sin tapar el punto que se intenta acertar. |
| `SEL-03` | Seleccionar con marco (box select) | Marco de selección: trazo y relleno. |
| `SEL-04` | Multiselección acumulativa | Resumen de selección múltiple. |
| `SEL-06` | Filtrar qué tipos son seleccionables | Indicador de filtro activo sobre el lienzo (hoy inexistente). |
| `SEL-07` | Precisión táctil: ver bajo el dedo | Lente táctil bajo Brandbook: borde, sombra y retícula. |
| `CNV-01` | Encuadrar, acercar y alejar | Controles de cámara: tamaño mínimo vs peso sobre el lienzo. |
| `CNV-02` | Orientarse con el minimapa | Minimapa bajo Brandbook y su relación con el rectángulo seguro. |
| `CNV-03` | Controlar qué capas se ven | Panel de capas con presets, unificado con los interruptores del Inspector. |
| `CNV-04` | Activar rejilla y ajuste (snap) | Chip de estado vs chip accionable: la diferencia debe ser legible. |
| `CNV-05` | Leer la posición y la escala actuales | Tipografía tabular del readout. |
| `CNV-06` | Saber en qué modo está el lienzo | Badge de modo con instrucción y cancelación. |
| `CNV-07` | Navegar el modelo con el teclado | Anillo de foco sobre SVG: unificarlo entre tipos de objeto. |
| `CNV-10` | Ver el modelo en modo impresión | Estilo de impresión bajo Brandbook. |
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | Ficha de propiedades: densidad legible con datos de ingeniería por encima del suelo tipográfico. |
| `INS-02` | Aplicar un material de catálogo | Selector de catálogo con previsualización de propiedades. |
| `INS-03` | Aplicar una sección de catálogo | Visor de sección: escala, cotas y legibilidad en ambos temas. |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | Representación de valor mixto y de cambio pendiente. |
| `INS-05` | Gestionar casos de carga y combinaciones | Editor de combinación con factores y procedencia normativa. |
| `INS-06` | Ajustar la visualización del modelo y de los resultados | Unificar capas + ajustes de vista en un solo patrón. |
| `RES-01` | Leer el resumen del análisis | Familias de resultado: cómo se leen cinco grupos sin parecer ocho pestañas. |
| `RES-02` | Leer reacciones y localizar la máxima | Tabla de resultados: densidad, alineación tabular y celda-como-enlace. |
| `RES-03` | Leer los diagramas N, V y M | Diagrama: trazo, relleno, rótulos de valor y su suelo tipográfico. |
| `RES-04` | Ver la deformada | Deformada: trazo y su relación con el modelo sin deformar. |
| `RES-05` | Consultar el índice elástico estimado | Escala continua del índice (`elasticIndexPaint`) y su leyenda. |
| `RES-06` | Entender la fiabilidad del resultado | Escala de fiabilidad con forma, no sólo color, y su explicación alcanzable. |
| `RES-07` | Ver líneas de influencia | Gráfica de influencia a densidad legible. |
| `RES-08` | Aprender por qué salió ese resultado | Pasos de aprendizaje y sustitución matricial legibles. |
| `RES-09` | Cambiar la altura y el modo del panel de resultados | Panel con tres modos: cómo se lee el estado actual y cómo se cambia. |
| `RES-10` | Saber de dónde sale un número (procedencia) | Tarjeta de procedencia: es contenido técnico denso que no puede quedar a 10px. |
| `RES-11` | Localizar el objeto de un resultado en el modelo | Animación de centrado y realce de llegada. |
| `DAT-01` | Ver el modelo como tabla | Rejilla de datos: densidad alta CON controles de tamaño usable (la contradicción que F-02 expone). |
| `DAT-02` | Buscar dentro de la tabla | Campo de búsqueda con altura usable en superficie densa. |
| `DAT-03` | Filtrar y ordenar | Chip de faceta con recuento (unificable con el filtro de plantillas de la Welcome). |
| `DAT-04` | Seleccionar filas y sincronizar con el lienzo | Fila seleccionada vs fila enfocada: dos estados distintos que deben leerse distinto. |
| `DAT-05` | Editar una celda | Editor de celda por tipo (número, enumerado, booleano) con objetivos usables. |
| `DAT-06` | Pegar un bloque de celdas | Informe de pegado: aceptado vs descartado. |
| `DAT-07` | Revisar, aplicar o cancelar un cambio pendiente | Panel de revisión unificado para los cinco casos. |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | Ficha de propiedades unificada, instanciable en panel, hoja y drawer. |
| `DAT-09` | Cambiar de entidad (nudos / barras / cargas) | Selector de entidad con recuento. |
| `DAT-10` | Enfocar en el lienzo el objeto de la fila | Transición tabla→modelo: cómo no se pierde el sitio. |
| `DOC-01` | Diagnosticar el modelo antes de analizar | Severidad con forma además de color; recuento en el lanzador. |
| `DOC-02` | Filtrar hallazgos por severidad | Filtro por severidad con recuento (unificable con las facetas del Datasheet). |
| `DOC-03` | Entender un hallazgo | Tarjeta de hallazgo con severidad, explicación progresiva y acciones. |
| `DOC-04` | Localizar el objeto de un hallazgo | Realce de llegada tras localizar. |
| `DOC-05` | Previsualizar y aplicar una reparación de topología | Preview de reparación: lista larga de cambios legible sin agotar. |
| `DOC-06` | Reconocer (acknowledge) un hallazgo | Estado «reconocido» sin sugerir «resuelto». |
| `PER-02` | Trabajar sin conexión | Tono de «offline»: informativo, no de error. |
| `PER-03` | Resolver un conflicto de revisión | Estado de conflicto con acción, no sólo con aviso. |
| `STA-01` | Entender un estado vacío | Estado vacío con siguiente paso: patrón unificable a todas las superficies. |
| `STA-02` | Entender un estado de carga | Un solo vocabulario de estado consumido por todas las superficies. |
| `STA-03` | Entender un análisis obsoleto (stale) | Marcado de «obsoleto» sobre datos y sobre overlays. |
| `STA-04` | Entender un análisis fallido | Estado de fallo: qué falló y qué hacer, con la misma estructura de tres textos de Model Doctor. |
| `STA-05` | Entender un control deshabilitado | Patrón único de «no disponible porque…». |
| `STA-06` | Trabajar con movimiento reducido / alto contraste | Motion bajo Brandbook §12, ya alineado. |
| `AUL-01` | Seguir el recorrido guiado de un ejercicio | Recorrido de pasos: tipografía y radios dentro de escala. |
| `AUL-02` | Ver niveles pedagógicos del resultado | Tipografía de contenido explicativo largo. |
| `S3D-01` | Trabajar en el dominio espacial experimental | Space3D queda fuera del sistema visual de CRI-10 salvo el marcado de «experimental» y los tokens compartidos. |
| `S3D-02` | Navegar el modelo espacial por lista | Fuera de alcance salvo tokens. |

## TABLA I — Fortalezas a conservar (por tarea)

**121 entradas.**

| ID | Tarea | Qué funciona y no debe perderse |
|---|---|---|
| `ENT-01` | Elegir por dónde empezar al abrir la app | No amputa: todas las rutas de arranque existen en los 11 viewports. |
| `ENT-02` | Continuar el proyecto en el que estaba | Local-first real: el proyecto está en memoria antes de que la mesa se monte. |
| `ENT-03` | Crear un proyecto en blanco | Que exista dentro de la mesa evita volver a Inicio para empezar otro modelo. |
| `ENT-04` | Abrir un ejemplo / plantilla | Los ejemplos son la vía de arranque más rápida y están en las dos superficies donde tienen sentido. |
| `ENT-06` | Ver y abrir proyectos guardados (Project Hub) | Degradación honesta: si no hay IndexedDB lo dice en vez de fallar en silencio. |
| `ENT-07` | Renombrar un proyecto guardado | Edición en línea, sin modal. |
| `ENT-08` | Duplicar un proyecto guardado | Nombre de copia derivado y traducido. |
| `ENT-09` | Restaurar una recuperación tras conflicto | Fail-closed correcto: el conflicto crea una recuperación ANTES de lanzar `RepositoryConflictError`. |
| `ENT-10` | Importar JSON / bundle / PDF (Import Center) | Es el único workflow por etapas del producto y está bien construido: inspecciona antes de escribir y explica qué no soporta. |
| `ENT-11` | Importar geometría desde DXF | La importación deja rastro recuperable antes de escribir. |
| `ENT-12` | Crear un ejercicio de Aula | ACCESIBILIDAD MODELO del producto: `role="dialog"`, `aria-modal`, `aria-labelledby`+`aria-describedby`, trampa de foco, Escape, navegación roving y reenfoque del primer campo inválido. No debe perderse en ninguna reescritura. |
| `ENT-13` | Renombrar el proyecto abierto | Escape revierte al nombre guardado; el borrador nunca escribe a medias. |
| `ENT-14` | Volver a Inicio desde la mesa | La marca como botón de Inicio es descubrible y no gasta espacio adicional. |
| `ENT-15` | Abrir Space 3D | El coste (649 kB) sólo lo paga quien lo abre. |
| `SHL-01` | Ejecutar el análisis | Cuatro puertas coherentes a un solo `analyze()`. En Compact el botón colapsa a icono 44×44 sin perder la acción. |
| `SHL-02` | Saber en qué estado está el análisis | La distinción `success ≠ reliable ≠ safe` está implementada de verdad, con `governing` check nombrado. |
| `SHL-03` | Deshacer | El historial guarda descripción por entrada, no sólo el estado: permite explicar qué se deshace. |
| `SHL-04` | Rehacer | Simetría exacta con undo. |
| `SHL-05` | Abrir la paleta de comandos | No inventa acciones: cada entrada llama a un comando existente. Está documentado así en el propio archivo. |
| `SHL-06` | Navegar a un nudo o barra por identificador | Buscar por ID sin salir del teclado es exactamente lo que un modelo grande necesita. |
| `SHL-07` | Elegir caso de carga o combinación a analizar | Cambiar de combinación invalida el análisis de forma explícita; no deja resultados de otra hipótesis en pantalla. |
| `SHL-08` | Cambiar el modo de cálculo (Aula / Completo) | Que el modo Aula no amputa capacidad: `showAdvanced` revela las herramientas avanzadas bajo demanda y se auto-revela si la activa está entre ellas. |
| `SHL-09` | Elegir el orden de análisis (1.º orden / P-Delta) | Cambiarlo invalida el análisis: no quedan resultados de primer orden etiquetados como P-Delta. |
| `SHL-10` | Ajustar los parámetros avanzados de P-Delta | Aparición condicionada al modo: es un buen ejemplo de contextualidad ya implementada. |
| `SHL-11` | Cambiar el sistema de unidades | RESTRICCIÓN PROTEGIDA CUMPLIDA: cambiar unidades no reinterpreta el modelo. La conversión ocurre en un solo sitio y hay un test de invariancia numérica que lo sostiene. |
| `SHL-12` | Cambiar el idioma | Paridad de catálogos garantizada por el sistema de tipos: no hay cadenas huérfanas. |
| `SHL-13` | Cambiar el tema (claro / oscuro) | Escribir siempre `data-theme` evita colores huérfanos dentro de `@media` (Brandbook §14.4). |
| `SHL-14` | Abrir Model Doctor | Que la ruta de reserva sea COMPLETA en Compact. El problema es de jerarquía, no de capacidad. |
| `SHL-15` | Abrir la hoja de datos (Datasheet) | Al abrir se sitúa sobre lo que ya estaba seleccionado en el lienzo, en vez de mandar a la fila 1. |
| `SHL-16` | Ocultar / mostrar el Inspector | Persistencia tolerante a fallos de `localStorage` (try/catch que nunca interrumpe el editor). |
| `SHL-17` | Entrar/salir de «mesa completa» | Existe y persiste. |
| `SHL-18` | Contraer el ToolRail a iconos | El mecanismo funciona: `compact` está bien propagado por el design system. |
| `SHL-19` | Redimensionar el Inspector | ES EL MEJOR CONTROL DE REDIMENSIÓN DEL PRODUCTO: puntero y teclado con semántica ARIA completa. Debe conservarse tal cual. |
| `SHL-20` | Elegir el detent de la hoja Inspector en táctil | La normalización reacciona a `resize`, `orientationchange` Y `visualViewport.resize` — cubre el teclado en pantalla. |
| `SHL-21` | Conocer el estado de persistencia y conectividad | Siete estados distinguidos de verdad, con `role="status"` y `aria-live`. Los errores no se disfrazan de éxito. |
| `SHL-22` | Exportar el proyecto y compartirlo | La caída del portapapeles a descarga cuando no hay contexto seguro. Y que PDF/bundle no exporten un análisis inexistente en silencio. |
| `SHL-23` | Recibir avisos transitorios (toasts) | Un solo canal tipado para todos los avisos: no hay tres sistemas de notificación compitiendo. |
| `SHL-24` | Actualizar la app instalada (PWA) | La actualización se ofrece, no se impone. |
| `MOD-01` | Elegir herramienta activa | Un solo registro de herramientas alimenta rail, dock táctil, hoja móvil y paleta. Añadir una herramienta es una línea, no cuatro superficies. |
| `MOD-02` | Crear un nudo | Área de acierto táctil ampliada SIN engordar el trazo dibujado. Es exactamente la separación que pide el Brandbook §02. |
| `MOD-03` | Crear una barra | El estado intermedio (origen elegido, esperando destino) se cancela con Escape y se anuncia en el badge de modo. |
| `MOD-04` | Aplicar o cambiar un apoyo | Los muelles y los desplazamientos prescritos existen y no se pierden al cambiar de tipo (`const spring = node.support.spring` se conserva). |
| `MOD-05` | Colocar una carga puntual | La resolución de objetivo es deliberada y está comentada: las cargas son fáciles de acertar pero no bloquean las herramientas cuyo destino es la barra. |
| `MOD-06` | Colocar una carga distribuida | El modelo distingue coordenadas locales/globales y base de longitud proyectada/real: no simplifica la física. |
| `MOD-07` | Colocar un momento | El `resolveRepeatRecipe` distingue un momento puro (`\|mz\|>0` con `fx=fy=0`) de una carga puntual para elegir la herramienta correcta al repetir. Es un detalle fino y correcto. |
| `MOD-08` | Dividir una barra (Split) | La división CONSERVA releases, muelles rotacionales y offsets rígidos, y lo declara explícitamente en el preview de reparación. |
| `MOD-09` | Borrar objetos | Reversible por undo; marcada `destructive` en el registro, lo que da al design system la información para tratarla distinto. |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | ES EL MEJOR EJEMPLO DE CONTEXTUALIDAD YA IMPLEMENTADO: el lanzador no existe si no hay nada que transformar. Y el preview se invalida si el modelo cambia debajo. |
| `MOD-11` | Entrada numérica rápida durante la colocación | Acepta decimales con coma: es la diferencia entre usable e inusable en español. Y el error es propio del campo, no un toast. |
| `MOD-12` | Repetir la última operación (Repeat) | Deriva la receta del objeto real, no de un historial de acciones: repetir una barra copia su sección, material, releases y muelles. |
| `MOD-13` | Copiar, pegar y duplicar | El pegado se desplaza progresivamente: pegar tres veces no apila tres copias en el mismo sitio. |
| `MOD-14` | Generar una estructura completa | IDENTIDAD DE CATÁLOGO PRESERVADA: `properties: catalog \| explicit` mantiene `materialId`/`sectionId` explícitos en vez de inferirlos por floats. Y hay un test de determinismo. |
| `MOD-15` | Medir con la herramienta de dimensión | Su visibilidad es una capa, no un ajuste enterrado. |
| `MOD-16` | Hacer un corte para leer valores internos | El corte respeta discontinuidades y saltos del diagrama (`diagramJumps`), no interpola a ciegas. |
| `SEL-01` | Seleccionar un objeto | UNA SOLA SELECCIÓN COMPARTIDA. Lienzo, Inspector, Datasheet, Results y Model Doctor hablan del mismo objeto sin sincronización explícita. |
| `SEL-02` | Resolver objetos solapados con puntero | ESTO YA RESUELVE EL PROBLEMA QUE ONSHAPE RESUELVE CON «Select Other», y con dos afordancias a la vez: lista explícita Y ciclado. Es una fortaleza que ninguna propuesta debe perder. |
| `SEL-03` | Seleccionar con marco (box select) | Shift acumula en vez de reemplazar: coherente con el resto del producto. |
| `SEL-04` | Multiselección acumulativa | La limitación de `multi` a nudos y miembros es DELIBERADA y está justificada en el código: editar varias cargas no lo necesita porque las ediciones son por celda. No se amplió el tipo por comodidad. |
| `SEL-05` | Deseleccionar | ESCAPE ES UN VERDADERO «CANCELAR TODO»: limpia siete estados distintos en un solo gesto y devuelve la herramienta a select. Muy pocos editores lo hacen tan completo. |
| `SEL-06` | Filtrar qué tipos son seleccionables | Se aplica de verdad a los dos caminos de selección, no sólo al directo. |
| `SEL-07` | Precisión táctil: ver bajo el dedo | REUTILIZA EL RENDER en lugar de duplicarlo: la lupa no puede desincronizarse del lienzo porque no tiene una segunda copia. Es una decisión de arquitectura, no de estilo, y está documentada en el propio archivo. |
| `CNV-01` | Encuadrar, acercar y alejar | `canvasChromeGeometry.ts` separa «rectángulo seguro» de viewport y lo comparte entre encuadre y colocación de rótulos. El concepto es correcto; sólo la fuente de los números es frágil. |
| `CNV-02` | Orientarse con el minimapa | Es la única orientación global cuando el modelo excede la vista. |
| `CNV-03` | Controlar qué capas se ven | Los presets como «respuesta a qué estoy haciendo ahora» en vez de una capa más: está razonado en el propio código. |
| `CNV-04` | Activar rejilla y ajuste (snap) | Cinco destinos de snap con control individual: es nivel CAD y está construido. |
| `CNV-05` | Leer la posición y la escala actuales | DECIDE POR MÉTODO DE ENTRADA, no por ancho: el readout es de puntero, la lupa es de dedo. Es exactamente el principio «misma capacidad, distinta interacción por input» ya implementado. |
| `CNV-06` | Saber en qué modo está el lienzo | Pistas de gesto separadas por método de entrada, ya escritas y traducidas. |
| `CNV-07` | Navegar el modelo con el teclado | ES UNA DE LAS DOS O TRES MEJORES COSAS DEL PRODUCTO. Un lienzo CAD realmente tabulable con foco visible sobre SVG. |
| `CNV-08` | Arrastrar un nudo | La transacción impide que un arrastre genere 60 entradas de historial, y se cancela limpiamente si la app pierde el foco o el gesto se corta. |
| `CNV-09` | Exportar el lienzo como imagen | La exportación la ejecuta quien tiene el render, no un duplicador: el bus evita una segunda implementación del dibujo. |
| `CNV-10` | Ver el modelo en modo impresión | ES UNA CUARTA COMPOSICIÓN NO DECLARADA: print ya demuestra que el producto sabe recomponerse retirando todo el chrome. Nadie la cuenta como tier, y funcionalmente lo es. |
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | `InspectorNumericField` con `resetKey`: al cambiar de objeto o de unidad el campo se reinicia en vez de arrastrar el valor anterior. Y las ediciones de miembro pasan por `executeProjectCommand`, no por mutación directa. |
| `INS-02` | Aplicar un material de catálogo | RESTRICCIÓN PROTEGIDA CUMPLIDA Y PROBADA: el `materialId` viaja explícito y NO se infiere por coincidencia de floats. Hay test dedicado (`identityMetadata.test.ts`). |
| `INS-03` | Aplicar una sección de catálogo | La PREVISUALIZACIÓN GRÁFICA de la sección: no es una lista de nombres, es la forma dibujada. Y el `sectionId` explícito, igual que el material. |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | REVISIÓN ANTES DE ESCRIBIR: resumen de cambios, valores mixtos representados de verdad, y una sola entrada de historial. Es el patrón «review/apply» mejor construido del producto junto al del Datasheet. |
| `INS-05` | Gestionar casos de carga y combinaciones | Las combinaciones de plantilla declaran su fuente normativa (`jurisdiction`, `edition`, `source`) y avisan de que son editables. Trazabilidad real. |
| `INS-06` | Ajustar la visualización del modelo y de los resultados | La leyenda de colores semánticos vive junto a los controles que la usan. |
| `INS-07` | Elegir la herramienta de carga desde el Inspector | Cerrar la hoja al elegir es correcto: la herramienta se usa sobre el lienzo, que la hoja tapaba. |
| `RES-01` | Leer el resumen del análisis | Las pestañas están agrupadas en CINCO FAMILIAS semánticas (Estado, Fuerzas, Forma, Avanzado, Entender) con `aria-describedby` que las enlaza. No es una tira plana de 8 pestañas. |
| `RES-02` | Leer reacciones y localizar la máxima | CADA NÚMERO ES NAVEGABLE: de la cifra al objeto en un clic, con `sr-only` que anuncia «localizar en el modelo». Es la unión resultado↔modelo mejor resuelta del producto. |
| `RES-03` | Leer los diagramas N, V y M | Los colores técnicos coinciden EXACTAMENTE con el Brandbook en tema claro, y el significado nunca depende sólo del color (trazo continuo/discontinuo + icono + etiqueta). |
| `RES-04` | Ver la deformada | La escala es un factor VISUAL declarado, no una deformación real: el usuario sabe que está exagerada. |
| `RES-05` | Consultar el índice elástico estimado | FAIL-CLOSED EJEMPLAR: `success ≠ reliable ≠ safe` implementado literalmente. Si no puede calcularse, dice por qué y nombra el check que gobierna, en vez de mostrar un número tranquilizador. |
| `RES-06` | Entender la fiabilidad del resultado | LA DISTINCIÓN `success ≠ reliable ≠ safe` ESTÁ IMPLEMENTADA, PROBADA Y CALIBRADA. Es la restricción protegida más importante y el producto la cumple. |
| `RES-07` | Ver líneas de influencia | Precarga por `onFocus`/`onPointerEnter`: el chunk llega antes de que se pulse. Detalle fino y correcto. |
| `RES-08` | Aprender por qué salió ese resultado | RESTRICCIÓN PROTEGIDA CUMPLIDA: Aula usa el MISMO análisis. La traza matricial se calcula bajo demanda (`ensureEducationTrace`) porque la corrida interactiva la omite por velocidad — un solo solver, dos profundidades de traza. |
| `RES-09` | Cambiar la altura y el modo del panel de resultados | EL MODO «ENFOCADO» YA ES UN FULLSCREEN DE RESULTADOS. La capacidad de dar espacio propio a los datos densos existe; lo que falta es que sea el camino natural. |
| `RES-10` | Saber de dónde sale un número (procedencia) | ES LA FUNCIÓN MÁS DISTINTIVA DEL PRODUCTO. Ningún competidor consultado documenta una tarjeta de procedencia por número. Incluye la CONVENCIÓN DE SIGNOS, que es exactamente donde se pierde la trazabilidad en la práctica. |
| `RES-11` | Localizar el objeto de un resultado en el modelo | EL TIPO IMPIDE EL ERROR: `FocusableSelection = Extract<NonNullable<Selection>, { id: string }>`. No hay forma de emitir un foco imposible. Es la mejor decisión del bus de comandos. |
| `DAT-01` | Ver el modelo como tabla | LA DECISIÓN DE QUE SEA PROYECCIÓN Y NO MODELO PARALELO. Está documentada en el propio archivo y es lo que hace que «varias puertas al mismo modelo» sea verdad y no un eslogan. |
| `DAT-02` | Buscar dentro de la tabla | Buscar sobre el texto RENDERIZADO en las unidades activas. Es sutil y es lo correcto. |
| `DAT-03` | Filtrar y ordenar | Recuento por faceta: se sabe cuántas filas quedarán antes de filtrar. |
| `DAT-04` | Seleccionar filas y sincronizar con el lienzo | ES LA MEJOR SINCRONIZACIÓN MODELO↔TABLA DEL PRODUCTO: la tabla no tiene selección propia, usa la del workspace. Al abrir se sitúa sobre lo ya seleccionado, y la selección de la otra entidad no se pierde. |
| `DAT-05` | Editar una celda | EL PREVIEW SALE DE LA MISMA FUNCIÓN QUE LA ESCRITURA (`applyDatasheetPlan`): si fueran dos caminos podrían divergir, y entonces lo que se ve antes de aplicar dejaría de ser lo que se escribe. Está razonado así en el código. |
| `DAT-06` | Pegar un bloque de celdas | DECIR QUÉ SE DESCARTÓ Y POR QUÉ, incluso cuando no se descartó nada. Es honestidad de interfaz poco común. |
| `DAT-07` | Revisar, aplicar o cancelar un cambio pendiente | LA REGLA DE CUÁNDO APARECE LA REVISIÓN ESTÁ RAZONADA Y ES CORRECTA. Distingue el origen del borrador para no destruir el contexto del usuario. Es el detalle de UX mejor pensado del producto. |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | El preview usa `previewProject`, el proyecto con el plan aplicado, así que lo que se ve es lo que se escribirá. |
| `DAT-09` | Cambiar de entidad (nudos / barras / cargas) | El recuento en el propio botón: se sabe cuántas cargas hay sin cambiar de vista. |
| `DAT-10` | Enfocar en el lienzo el objeto de la fila | Cerrar al enfocar es la consecuencia HONESTA de que el drawer sea modal. Reconoce el problema en vez de disimularlo. |
| `DOC-01` | Diagnosticar el modelo antes de analizar | DIAGNOSTICA SIN ANALIZAR. Y elige el lado del drawer por ANCHO DE VIEWPORT (700px), que es un ejemplo interno de adaptación de superficie sin cambiar la función. |
| `DOC-02` | Filtrar hallazgos por severidad | Recuento por severidad visible sin filtrar. |
| `DOC-03` | Entender un hallazgo | SEPARAR «QUÉ», «POR QUÉ» Y «QUÉ HACER» EN TRES CAMPOS DEL MODELO, no en un párrafo. Es lo que permite mostrarlos progresivamente sin reescribir el texto. |
| `DOC-04` | Localizar el objeto de un hallazgo | DICE CUÁNDO NO PUEDE en vez de ofrecer un botón que no hace nada. `canLocate` es parte del modelo del hallazgo, no una comprobación de la vista. |
| `DOC-05` | Previsualizar y aplicar una reparación de topología | FAIL-CLOSED EJEMPLAR Y ALINEADO CON LA POLÍTICA: (a) no repara lo ambiguo y lo dice (`ambiguousRepair`); (b) enumera lo que OMITE y lo que NO resuelve; (c) invalida el preview si el modelo cambió debajo; (d) exige regenerar en vez de aplicar a ciegas. Esto es exactamente lo que NO debe copiarse de la reparación automática de SkyCiv. |
| `DOC-06` | Reconocer (acknowledge) un hallazgo | NO SE PERSISTE ENTRE PROYECTOS NI SOBREVIVE A QUE EL HALLAZGO DESAPAREZCA. Un «reconocido» caducado sería peor que ninguno. |
| `DOC-07` | Saltar del hallazgo a la herramienta que lo arregla | El hallazgo SABE qué herramienta lo resuelve. Es contextualidad de dominio, no de interfaz. |
| `PER-01` | Guardar automáticamente el trabajo | LOCAL-FIRST REAL: sin red, sin cuenta y sin pérdida. Y la persistencia NUNCA interrumpe el editor: los fallos de `localStorage` se capturan y se muestran como estado, no como excepción. |
| `PER-02` | Trabajar sin conexión | NADA DEL PRODUCTO REQUIERE RED: solver, persistencia, exportación y análisis son locales. Estar offline no degrada ninguna función. |
| `PER-03` | Resolver un conflicto de revisión | LA RECUPERACIÓN SE ESCRIBE ANTES DE FALLAR, en la misma transacción. Es fail-closed correcto: primero se salva, luego se avisa. |
| `PER-04` | Migrar un proyecto de una versión anterior | La migración deja rastro recuperable ANTES de reescribir. Y `already-migrated` se distingue de `migrated`: no se migra dos veces. |
| `STA-01` | Entender un estado vacío | EL VACÍO DE RESULTS ES UN ESTADO CON INSTRUCCIÓN, no un hueco. Deriva el siguiente paso del estado real del modelo y ofrece la acción. Es el mejor estado vacío del producto. |
| `STA-02` | Entender un estado de carga | `StatusStrip` ya define SEIS tonos (`ready, loading, success, stale, warning, error`) con `role` y `aria-live` correctos por tono. El vocabulario de estados existe en el design system. |
| `STA-03` | Entender un análisis obsoleto (stale) | LA FIRMA DEL PROYECTO ES LA FUENTE, no una bandera manual. No hay forma de que un resultado obsoleto se presente como vigente. |
| `STA-04` | Entender un análisis fallido | EL FALLO OFRECE LA SIGUIENTE ACCIÓN (abrir Model Doctor), no sólo el diagnóstico. Cerrar el bucle error→herramienta es lo correcto. |
| `STA-05` | Entender un control deshabilitado | Los tres casos que SÍ explican son el modelo a seguir, y ya existen en el producto. |
| `STA-06` | Trabajar con movimiento reducido / alto contraste | TRES preferencias del sistema honradas, dos de ellas poco frecuentes. Y los tiempos de motion coinciden exactamente con el Brandbook §12 (70/140/220/360). |
| `AUL-01` | Seguir el recorrido guiado de un ejercicio | EL PROGRESO SE DERIVA DEL MODELO REAL, no de un checklist que el usuario marca. Y `is-compact` ya demuestra que la banda sabe recomponerse. El color de Aula (`--sc-color-aula` = rosa) cumple el Brandbook §01 y nunca comparte tono con el violeta de deformada. |
| `AUL-02` | Ver niveles pedagógicos del resultado | Comparte panel y análisis con el modo Completo: un solo motor, dos profundidades de lectura. |
| `AUL-03` | Mantener la sesión de aula | La sesión NO duplica el análisis: sólo marca que se pidió. RESTRICCIÓN PROTEGIDA CUMPLIDA — Aula usa el mismo solver. |
| `S3D-01` | Trabajar en el dominio espacial experimental | ESTÁ MARCADO COMO EXPERIMENTAL EN LA INTERFAZ y su coste (649 kB) sólo lo paga quien lo abre. La separación es honesta. |
| `S3D-02` | Navegar el modelo espacial por lista | Es la ruta NO ESPACIAL a un objeto espacial: el mismo principio que la paleta por ID en 2D. |

