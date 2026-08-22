<!-- GENERADO por build-inventory.mjs — no editar a mano. -->

### Entrada (15)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `ENT-01` | Elegir por dónde empezar al abrir la app | Pantalla completa propia, fuera del shell del workspace. | 1 Global persistente (pantalla propia) | alta (inferencia) | Pantalla completa, misma composición. Sin cambios funcionales. | Igual que Expanded; sólo densidad de tarjetas. | Igual, con cabecera colapsada a drawer de menú. |
| `ENT-02` | Continuar el proyecto en el que estaba | Botón principal de la Welcome. | 1 Global persistente | alta (inferencia) | Acción primaria de la Welcome. | Igual. | Igual. |
| `ENT-03` | Crear un proyecto en blanco | Welcome + menú desplegable del nombre de proyecto (TopBar). | 1 Global persistente + 2 Contextual a proyecto | media (inferencia) | Menú de proyecto en TopBar. | Igual. | El menú de proyecto sobrevive en Compact (zona documento no se oculta entera). |
| `ENT-04` | Abrir un ejemplo / plantilla | Tarjetas de la Welcome + menú de proyecto del TopBar. | 1 Global persistente + 9 Fullscreen (Welcome) | media (evidencia) | Rejilla de tarjetas con categoría e icono. | Rejilla más estrecha. | Columna única. |
| `ENT-05` | Filtrar plantillas por tipo | Chips en la Welcome. | 9 Fullscreen (auxiliar de la lista) | baja (inferencia) | Chips visibles. | Igual. | Igual, con scroll horizontal. |
| `ENT-06` | Ver y abrir proyectos guardados (Project Hub) | Sólo en la Welcome, tras `Phase2ProjectHub`. | 1 Global persistente + 9 Fullscreen / datos densos | media (inferencia) | Lista completa con acciones por fila. | Igual. | Fila apilada. |
| `ENT-07` | Renombrar un proyecto guardado | Sólo en el Hub. | 8 Configuración / 9 Fullscreen | baja (inferencia) | Inline. | Inline. | Inline. |
| `ENT-08` | Duplicar un proyecto guardado | Sólo en el Hub. | 8 Configuración / 9 Fullscreen | baja (inferencia) | Acción de fila. | Igual. | Igual. |
| `ENT-09` | Restaurar una recuperación tras conflicto | Sólo en el Project Hub, dentro de la Welcome. | 2 Contextual a proyecto + 6 Workflow temporal | baja (evidencia) | Sección propia dentro del Hub. | Igual. | Igual. |
| `ENT-10` | Importar JSON / bundle / PDF (Import Center) | Menú de proyecto del TopBar y Welcome. | 6 Workflow temporal | baja (inferencia) | Diálogo modal con etapas. | Igual. | Igual, apilado. |
| `ENT-11` | Importar geometría desde DXF | SÓLO en la Welcome. | 6 Workflow temporal | baja (inferencia) | Diálogo. | Igual. | Igual. |
| `ENT-12` | Crear un ejercicio de Aula | Botón «Nuevo ejercicio» de la Welcome. | 6 Workflow temporal | baja (inferencia) | Modal. | Modal. | Modal a pantalla casi completa. |
| `ENT-13` | Renombrar el proyecto abierto | TopBar, zona documento. | 2 Contextual a proyecto | media (inferencia) | Campo visible en TopBar. | Igual. | Presente pero comprimido; por debajo de 375px es inusable (F-08). |
| `ENT-14` | Volver a Inicio desde la mesa | Marca del TopBar. | 1 Global persistente | media (inferencia) | Marca 46px. | Igual. | La marca sobrevive; el nombre textual se retira. |
| `ENT-15` | Abrir Space 3D | Botón de icono del TopBar + tarjeta de la Welcome + menú «Más» en Compact. | 9 Fullscreen (dominio separado) | baja (inferencia) | Icono en TopBar. | Igual. | Sólo dentro de «Más». |

### Shell (24)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `SHL-01` | Ejecutar el análisis | TopBar, extremo derecho, siempre visible. | 1 Global persistente | alta (evidencia) | Botón con texto. | Botón con texto. | Icono 44×44. |
| `SHL-02` | Saber en qué estado está el análisis | TopBar (chip) + cabecera del panel de Results (texto de estado). | 2 Contextual a proyecto/análisis | alta (evidencia) | Chip en TopBar + estado en Results. | Igual. | El chip permanece; el estado de Results vive en la hoja. |
| `SHL-03` | Deshacer | TopBar (icono), menú «Más» (primer bloque), Command Palette. | 1 Global persistente | alta (inferencia) | Par de iconos en TopBar. | Igual. | Dentro de «Más», en su propio grupo. |
| `SHL-04` | Rehacer | Idéntico a SHL-03. | 1 Global persistente | media (inferencia) | Icono. | Icono. | Dentro de «Más». |
| `SHL-05` | Abrir la paleta de comandos | ToolRail + atajo + hoja «Más» móvil. | 7 Power-user / Command Palette | avanzada (inferencia) | Botón visible en el rail + atajo. | Igual. | Dentro de la hoja «Más» del dock táctil. |
| `SHL-06` | Navegar a un nudo o barra por identificador | Sólo en la paleta. | 7 Power-user | avanzada (inferencia) | Paleta. | Paleta. | Paleta (vía «Más»). |
| `SHL-07` | Elegir caso de carga o combinación a analizar | TopBar zona contexto (oculta en Compact) + «Más» + Inspector › Cargas. | 2 Contextual a proyecto/análisis | alta (inferencia) | Select visible en TopBar. | Igual (la zona de contexto no se contrae por sí sola). | Dentro de «Más» › sección Análisis. |
| `SHL-08` | Cambiar el modo de cálculo (Aula / Completo) | CUATRO sitios: TopBar zona contexto, «Más», Inspector › Vista, y el propio guía. | 8 Configuración / preferencias | baja (inferencia) | Select en TopBar + segmented en Inspector. | Igual. | «Más» + Inspector. |
| `SHL-09` | Elegir el orden de análisis (1.º orden / P-Delta) | TopBar zona contexto + «Más». | 2 Contextual a proyecto/análisis | baja (inferencia) | Select en TopBar. | Igual. | «Más» › Análisis. |
| `SHL-10` | Ajustar los parámetros avanzados de P-Delta | SÓLO dentro del popover «Más», bajo un `<details>` colapsado, dentro de una sección. | 8 Configuración + 2 Contextual a análisis | avanzada (inferencia) | Idéntico a Compact: «Más» › details. No gana nada por tener más espacio. | Igual. | Igual. |
| `SHL-11` | Cambiar el sistema de unidades | TopBar zona contexto + «Más» › Preferencias. | 8 Configuración / preferencias | baja (inferencia) | Select en TopBar. | Igual. | «Más» › Preferencias. |
| `SHL-12` | Cambiar el idioma | Welcome (cabecera y drawer) + «Más» › Preferencias. NO está en el TopBar de Expanded fuera del cajón. | 8 Configuración / preferencias | baja (inferencia) | «Más» › Preferencias. | Igual. | Igual. |
| `SHL-13` | Cambiar el tema (claro / oscuro) | CUATRO sitios: Welcome, «Más», Command Palette, y Space3D con su propia lógica. | 8 Configuración / preferencias | baja (inferencia) | «Más» + paleta. | Igual. | Igual. |
| `SHL-14` | Abrir Model Doctor | Botón propio en TopBar (oculto por CSS bajo 1024px), «Más» (3.ª entrada), paleta, AnalysisStatus, Results fallido. | 2 Contextual a proyecto/análisis | media (inferencia) | Botón con texto (colapsa a icono bajo 1536px). | Icono en TopBar. | «Más» › Análisis, tercera entrada, sin señal visual de que hay hallazgos. |
| `SHL-15` | Abrir la hoja de datos (Datasheet) | Icono en TopBar + paleta. En Compact el icono NO se oculta (a diferencia de Model Doctor). | 9 Fullscreen / datos densos | media (inferencia) | Icono en TopBar → Drawer inferior. | Igual. | Igual. |
| `SHL-16` | Ocultar / mostrar el Inspector | SÓLO dentro del menú «Más» › Vistas. | 8 Configuración de layout (hoy) / debería estudiarse como 4 Canvas-local | media (inferencia) | «Más» › Vistas. | Igual. | No aplica: en Compact el Inspector ya es hoja. |
| `SHL-17` | Entrar/salir de «mesa completa» | SÓLO «Más» › Vistas. | 8 Configuración de layout | baja (inferencia) | «Más» › Vistas. | Igual. | Presente pero de efecto menor. |
| `SHL-18` | Contraer el ToolRail a iconos | SÓLO «Más» › Vistas. | 8 Configuración de layout | baja (inferencia) | «Más» › Vistas. | Igual — y es justo donde más falta hace. | No aplica (el rail ya es dock flotante). |
| `SHL-19` | Redimensionar el Inspector | Borde izquierdo del Inspector. | 4 Canvas-local (negocia el reparto con el lienzo) | baja (inferencia) | Tirador en el borde. | Igual. | No aplica; en su lugar hay detents. |
| `SHL-20` | Elegir el detent de la hoja Inspector en táctil | Grupo de tres botones en la cabecera de la hoja. | 6 Workflow temporal / hoja | media (inferencia) | No existe: en Expanded el equivalente es el ancho (SHL-19). | No existe hoy. | Tres botones en la hoja. |
| `SHL-21` | Conocer el estado de persistencia y conectividad | Chip en TopBar (colapsa a icono en Compact) y bloque con descripción dentro de «Más». | 1 Global persistente | alta (evidencia) | Chip con etiqueta. | Igual. | Icono; el detalle en «Más». |
| `SHL-22` | Exportar el proyecto y compartirlo | Menú de exportación (icono propio) en TopBar + sección Exportar de «Más» (las 7 repetidas) + 4 comandos en la paleta. | 2 Contextual a proyecto + 8 Configuración/utilidad | baja (inferencia) | Menú de exportación propio. | Igual. | «Más» › Exportar. |
| `SHL-23` | Recibir avisos transitorios (toasts) | Sobre el lienzo, dentro del `workspace` slot. | 1 Global persistente (canal) | media (evidencia) | Sobre el lienzo. | Igual. | Igual. |
| `SHL-24` | Actualizar la app instalada (PWA) | Aviso propio. | 1 Global persistente | baja (evidencia) | Aviso. | Igual. | Igual. |

### Modelado (16)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `MOD-01` | Elegir herramienta activa | ToolRail (164px permanentes en Expanded) + dock flotante de 5 botones en Compact. | 1 Global persistente (crear) + 4 Canvas-local | alta (evidencia) | Rail con etiqueta y `kbd` visible. | Rail idéntico (no se contrae solo — F-01). | Dock flotante horizontal sobre el lienzo con 5 destinos: Seleccionar, Nodo, Barra, Apoyo, Cargas▸, Más▸. |
| `MOD-02` | Crear un nudo | Lienzo, con la herramienta activa. | 4 Canvas-local | alta (inferencia) | Rail → clic. | Igual. | Dock → tap. |
| `MOD-03` | Crear una barra | Lienzo. | 4 Canvas-local + 6 Workflow temporal (los dos tiempos) | alta (inferencia) | Rail → dos clics. | Igual. | Dock → dos taps. |
| `MOD-04` | Aplicar o cambiar un apoyo | Lienzo (rápido, tipo por defecto) + Inspector (completo) + Datasheet (columna) + Bulk Edit (masivo). | 3 Contextual a selección + 5 Inspector/detail | alta (inferencia) | Lienzo + Inspector permanente. | Igual. | Lienzo + hoja Inspector. |
| `MOD-05` | Colocar una carga puntual | Lienzo + hoja «Cargas» del dock táctil + pestaña Cargas del Inspector (que sólo ELIGE la herramienta y cierra). | 4 Canvas-local + 3 Contextual a selección | alta (inferencia) | Rail grupo «Cargas». | Igual. | Dock → hoja «Cargas». |
| `MOD-06` | Colocar una carga distribuida | Lienzo + hoja «Cargas» + Inspector › Cargas. | 4 Canvas-local + 3 Contextual a selección | alta (inferencia) | Rail. | Igual. | Dock → hoja «Cargas». |
| `MOD-07` | Colocar un momento | Lienzo + hoja «Cargas» + Inspector › Cargas. | 4 Canvas-local + 3 Contextual a selección | media (inferencia) | Rail. | Igual. | Dock → hoja «Cargas». |
| `MOD-08` | Dividir una barra (Split) | Rail grupo «Editar» + hoja «Más» táctil + paleta. | 3 Contextual a selección + 4 Canvas-local | media (inferencia) | Rail. | Igual. | Hoja «Más». |
| `MOD-09` | Borrar objetos | Rail (destructiva) + tecla + hoja «Más». | 3 Contextual a selección | alta (inferencia) | Rail + tecla. | Igual. | Hoja «Más» + tecla si hay teclado. |
| `MOD-10` | Transformar la selección (mover, rotar, espejo, matriz, alinear, distribuir) | Lanzador `open-structural-edit` que SÓLO aparece en el grupo «Editar» del rail cuando hay selección válida, y en la hoja «Más» táctil bajo la misma condición. | 3 Contextual a selección + 6 Workflow temporal | media (inferencia) | Rail (condicional) → overlay sobre el lienzo. | Igual. | Hoja «Más» › Editar (condicional) → overlay. |
| `MOD-11` | Entrada numérica rápida durante la colocación | Sobre el lienzo, durante la colocación. | 6 Workflow temporal | media (inferencia) | Aparece durante la colocación. | Igual. | Igual. |
| `MOD-12` | Repetir la última operación (Repeat) | Tecla `R` + overlay contextual sobre el lienzo. | 3 Contextual a selección | media (inferencia) | Tecla + overlay. | Igual. | SÓLO overlay: sin teclado físico no hay tecla `R`. No verificado si el overlay es alcanzable por tap en Compact. |
| `MOD-13` | Copiar, pegar y duplicar | SÓLO por teclado. No hay botón, entrada de menú ni comando de paleta para copiar/pegar/duplicar. | 3 Contextual a selección + 7 Power-user | media (inferencia) | Sólo teclado. | Sólo teclado. | INEXISTENTE sin teclado físico. |
| `MOD-14` | Generar una estructura completa | Botón propio en el grupo «Crear» del rail + hoja «Más» › Crear + comando de paleta. | 1 Global persistente (crear) + 6 Workflow temporal | media (inferencia) | Rail → panel con formulario + preview en el lienzo. | Igual. | Hoja «Más» › Crear → panel. |
| `MOD-15` | Medir con la herramienta de dimensión | Rail grupo «Inspeccionar» + hoja «Más» + paleta. | 4 Canvas-local | baja (inferencia) | Rail. | Igual. | Hoja «Más». |
| `MOD-16` | Hacer un corte para leer valores internos | Rail grupo «Inspeccionar» + hoja «Más» + paleta. | 3 Contextual a selección + 2 Contextual a análisis | media (inferencia) | Rail. | Igual. | Hoja «Más». |

### Selección (7)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `SEL-01` | Seleccionar un objeto | Lienzo (clic/tap), Datasheet (fila), paleta (por ID), Model Doctor (localizar), tarjetas de Results (objeto crítico). | 3 Contextual a selección (es la fuente del contexto) | alta (evidencia) | Clic. | Clic/tap. | Tap. |
| `SEL-02` | Resolver objetos solapados con puntero | Lienzo, automático. | 4 Canvas-local + 6 Workflow temporal | alta (evidencia) | Picker + indicador. | Igual. | NO SE ACTIVA. El código sale antes por la rama `pointerType === "touch"`, que resuelve la intención pan/long-press primero. En táctil no hay picker de solapados. |
| `SEL-03` | Seleccionar con marco (box select) | Lienzo. | 4 Canvas-local | alta (inferencia) | Arrastre. | Arrastre. | NO EXISTE en táctil: un arrastre de un dedo sobre el fondo es PAN (`StructuralCanvas.tsx:1307-1311`), no marco. |
| `SEL-04` | Multiselección acumulativa | Lienzo (Shift+clic, marco) + Datasheet (filas, rango). | 3 Contextual a selección | media (inferencia) | Shift+clic / marco. | Igual. | Sólo vía Datasheet (ver SEL-03). |
| `SEL-05` | Deseleccionar | Escape + clic en el fondo. | 3 Contextual a selección | alta (evidencia) | Escape. | Escape. | Sin teclado, sólo tap en el fondo — que además debe distinguirse de un pan. |
| `SEL-06` | Filtrar qué tipos son seleccionables | Inspector › Vista › sección «Precisión CAD», tras `selectionDragHelp`. | 4 Canvas-local (hoy clasificado como 8 Configuración) | media (inferencia) | Inspector › Vista, tercer nivel. | Igual. | Hoja Inspector › Vista. |
| `SEL-07` | Precisión táctil: ver bajo el dedo | Automática sobre el lienzo. | 4 Canvas-local | alta (en táctil) (evidencia) | No aparece (no hay `pointerType: touch`). | Aparece si el dispositivo es táctil — el disparador es el INPUT, no el ancho. | Aparece durante colocación y arrastre. |

### Lienzo (10)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `CNV-01` | Encuadrar, acercar y alejar | Chrome flotante sobre el lienzo, esquina. | 4 Canvas-local | alta (evidencia) | Tres iconos + rueda + espacio. | Igual. | Tres iconos + pinza. El chrome flotante pesa 12-14% del lienzo en teléfono apaisado. |
| `CNV-02` | Orientarse con el minimapa | Esquina del lienzo, siempre. | 4 Canvas-local | media (inferencia) | 144px permanentes en la esquina. | Igual. | Igual — donde más caro sale. |
| `CNV-03` | Controlar qué capas se ven | Disparador flotante sobre el lienzo (`canvas-layer-trigger`) + 5 comandos de preset en la paleta. | 4 Canvas-local | media (inferencia) | Disparador flotante. | Igual. | Igual. |
| `CNV-04` | Activar rejilla y ajuste (snap) | Inspector › Vista (los cinco destinos) + comandos `view:grid` y `view:snap` en la paleta + chips de estado sobre el lienzo (SÓLO informativos, no accionables). | 4 Canvas-local | alta (inferencia) | Inspector › Vista + paleta. | Igual. | Hoja Inspector › Vista. |
| `CNV-05` | Leer la posición y la escala actuales | Chrome de estado del lienzo. | 4 Canvas-local | alta (evidencia) | Readout permanente. | Igual. | Presente pero sin actualizarse en táctil; la cota vive en la lupa. |
| `CNV-06` | Saber en qué modo está el lienzo | Esquina superior del lienzo. | 4 Canvas-local + 6 Workflow temporal | alta (evidencia) | Badge + pista de escritorio. | Igual. | Badge + pista táctil. |
| `CNV-07` | Navegar el modelo con el teclado | El propio lienzo. | 4 Canvas-local + 7 Power-user | media (evidencia) | Tab por objetos. | Igual. | Igual si hay teclado. |
| `CNV-08` | Arrastrar un nudo | Lienzo. | 4 Canvas-local + 3 Contextual a selección | alta (inferencia) | Arrastre. | Arrastre. | Arrastre con lupa. |
| `CNV-09` | Exportar el lienzo como imagen | Menú de exportación + «Más» + paleta. | 2 Contextual a proyecto | baja (inferencia) | Menú de exportación. | Igual. | «Más» › Exportar. |
| `CNV-10` | Ver el modelo en modo impresión | Entrada «Imprimir» en el menú de exportación y en «Más». | 9 Fullscreen / datos densos | baja (inferencia) | Igual en las tres clases: la hoja de papel no tiene breakpoints. | Igual. | Igual. |

### Inspector (7)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `INS-01` | Ver y editar las propiedades del objeto seleccionado | Panel lateral de 320px SIEMPRE presente en Expanded, aunque no haya selección. Hoja inferior en Compact. | 5 Inspector/detail + 3 Contextual a selección | alta (evidencia) | Panel permanente de 280-480px. | Panel permanente idéntico — no se contrae (F-01). Es el mayor problema del tier. | Hoja inferior modal con tres detents, abierta por botón flotante o por selección en el lienzo. |
| `INS-02` | Aplicar un material de catálogo | Inspector, sección de miembro. | 3 Contextual a selección + 5 Inspector/detail | alta (inferencia) | Inspector. | Igual. | Hoja Inspector. |
| `INS-03` | Aplicar una sección de catálogo | Inspector. | 3 Contextual a selección + 5 Inspector/detail | alta (inferencia) | Inspector con dibujo. | Igual. | Hoja. |
| `INS-04` | Editar varios objetos a la vez (Bulk Edit) | Dentro del Inspector, sustituyendo la ficha individual. | 3 Contextual a selección + 5 Inspector/detail | media (inferencia) | Inspector. | Igual. | Hoja Inspector. |
| `INS-05` | Gestionar casos de carga y combinaciones | Inspector › pestaña Cargas. Es la ÚNICA puerta a crear casos y combinaciones. | 2 Contextual a proyecto/análisis + 5 Inspector/detail | media (inferencia) | Pestaña del Inspector. | Igual. | Hoja Inspector › Cargas. |
| `INS-06` | Ajustar la visualización del modelo y de los resultados | Pestaña «Vista» del Inspector — 4 secciones y ~20 controles. | 4 Canvas-local + 8 Configuración | media (inferencia) | Pestaña del Inspector. | Igual. | Hoja Inspector › Vista. |
| `INS-07` | Elegir la herramienta de carga desde el Inspector | Inspector › Cargas, sección «Añadir carga». | 3 Contextual a selección (débil) + 1 Global persistente (duplicado) | media (inferencia) | Inspector. | Igual. | Hoja que se cierra sola. |

### Resultados (11)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `RES-01` | Leer el resumen del análisis | Panel Results, familia «Estado». | 2 Contextual a análisis | alta (inferencia) | Pestaña dentro del panel inferior. | Igual. | Dentro de la hoja de resultados, que se abre sola tras analizar. |
| `RES-02` | Leer reacciones y localizar la máxima | Panel Results, familia «Estado». | 2 Contextual a análisis + 9 Datos densos | alta (inferencia) | Tabla en el panel. | Igual, más estrecha. | Tabla en la hoja, con `@container` que la recompone bajo 560px. |
| `RES-03` | Leer los diagramas N, V y M | Panel Results + overlay sobre el lienzo (capa `results`). | 2 Contextual a análisis + 3 Contextual a selección + 4 Canvas-local (el overlay) | alta (evidencia) | Panel + overlay. | Igual. | Hoja + overlay; hay modo «enfocado» a pantalla completa (`results-mode-focused`). |
| `RES-04` | Ver la deformada | Panel Results + overlay en el lienzo. | 2 Contextual a análisis + 4 Canvas-local | alta (inferencia) | Panel + overlay. | Igual. | Hoja + overlay. |
| `RES-05` | Consultar el índice elástico estimado | Tarjeta dentro de Results; capa `heatmap` del lienzo (apagada por defecto). | 2 Contextual a análisis + 3 Contextual a selección | media (inferencia) | Tarjeta en Results + heatmap opcional. | Igual. | Igual. |
| `RES-06` | Entender la fiabilidad del resultado | Texto de estado en la cabecera de Results (con `title` = mensaje del check gobernante) + chip del TopBar + tarjeta de calidad numérica. | 2 Contextual a análisis + 1 Global persistente (el chip) | alta (evidencia) | Cabecera de Results + chip. | Igual. | Chip + hoja. |
| `RES-07` | Ver líneas de influencia | Pestaña de Results. | 2 Contextual a análisis + 9 Datos densos | avanzada (inferencia) | Pestaña. | Igual. | Hoja; el modo «enfocado» le da altura. |
| `RES-08` | Aprender por qué salió ese resultado | Pestaña de Results, disponible en AMBOS modos (no sólo Aula). | 2 Contextual a análisis + 9 Datos densos | media (en Aula) (inferencia) | Pestaña. | Igual. | Hoja; el modo enfocado recompone `learning-steps` a una columna. |
| `RES-09` | Cambiar la altura y el modo del panel de resultados | Cabecera del panel (`results-mode-control`) + tirador + botón de enfoque en móvil. | 9 Fullscreen / datos densos + 8 Configuración de layout | media (inferencia) | Tres modos + tirador. | Igual. | Colapsado a 54px por defecto; se despliega solo tras analizar; botón de enfoque propio. |
| `RES-10` | Saber de dónde sale un número (procedencia) | Tarjeta al pie del cuerpo de Results. | 2 Contextual a análisis + 5 Detail | alta (evidencia) | Tarjeta al pie. | Igual. | Igual, dentro de la hoja. |
| `RES-11` | Localizar el objeto de un resultado en el modelo | Cuatro emisores, un solo consumidor (el lienzo). | 4 Canvas-local (destino) + 2/3 (origen) | alta (evidencia) | Clic en la cifra o en el hallazgo. | Igual. | Igual; el Datasheet además SE CIERRA al enfocar, porque taparía el objeto centrado. |

### Datasheet (10)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `DAT-01` | Ver el modelo como tabla | `Drawer` inferior modal sobre el lienzo. | 9 Fullscreen / datos densos | media (inferencia) | Drawer inferior; tapa el lienzo mientras está abierto. | Igual. | Igual, con recomposición bajo 700px. |
| `DAT-02` | Buscar dentro de la tabla | Campo `type="search"` en la barra de la tabla. | 9 Datos densos | media (inferencia) | Campo en la barra. | Igual. | Igual. |
| `DAT-03` | Filtrar y ordenar | Chips bajo la barra de la tabla. | 9 Datos densos | media (inferencia) | Chips. | Igual. | Igual, con scroll. |
| `DAT-04` | Seleccionar filas y sincronizar con el lienzo | Rejilla de la tabla. | 9 Datos densos + 3 Contextual a selección | media (evidencia) | Clic, Ctrl+clic, Shift+clic. | Igual. | Tap; ES LA RUTA TÁCTIL A LA MULTISELECCIÓN, dado que el marco no existe (SEL-03). |
| `DAT-05` | Editar una celda | Rejilla. | 9 Datos densos | media (inferencia) | Doble clic / Enter sobre la celda. | Igual. | Tap. |
| `DAT-06` | Pegar un bloque de celdas | Ctrl+V sobre la rejilla. | 9 Datos densos + 7 Power-user | media (inferencia) | Ctrl+V. | Igual. | DEPENDE DE TECLADO: sin teclado físico no hay pegado. Hueco táctil. |
| `DAT-07` | Revisar, aplicar o cancelar un cambio pendiente | Panel lateral dentro del drawer. | 6 Workflow temporal | media (inferencia) | Panel lateral en el drawer. | Igual. | Apilado; compite por altura con la rejilla. |
| `DAT-08` | Editar el objeto enfocado desde el panel editor | Panel lateral del drawer. | 5 Inspector/detail dentro de 9 Datos densos | media (inferencia) | Panel lateral. | Igual. | Apilado. |
| `DAT-09` | Cambiar de entidad (nudos / barras / cargas) | Barra de la tabla. | 9 Datos densos | media (evidencia) | Tres botones. | Igual. | Igual. |
| `DAT-10` | Enfocar en el lienzo el objeto de la fila | Botón del panel editor. | 4 Canvas-local (destino) | media (evidencia) | Botón. | Igual. | Igual. |

### Model Doctor (7)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `DOC-01` | Diagnosticar el modelo antes de analizar | `Drawer` lateral en escritorio, INFERIOR bajo 700px (`useCompactDoctor`). | 2 Contextual a proyecto/análisis | media (inferencia) | Drawer lateral. | Drawer lateral. | Drawer inferior. |
| `DOC-02` | Filtrar hallazgos por severidad | Cabecera del drawer. | 2 Contextual a proyecto | media (inferencia) | Cuatro botones. | Igual. | Igual. |
| `DOC-03` | Entender un hallazgo | Tarjeta del drawer, con disclosure. | 5 Detail | media (evidencia) | Tarjeta + disclosure. | Igual. | Igual. |
| `DOC-04` | Localizar el objeto de un hallazgo | Botón de la tarjeta. | 4 Canvas-local (destino) | media (evidencia) | Botón. | Igual. | Igual. |
| `DOC-05` | Previsualizar y aplicar una reparación de topología | Vista sustitutiva dentro del drawer, con botón de volver. | 6 Workflow temporal | baja (inferencia) | Vista sustitutiva en el drawer. | Igual. | Igual, en drawer inferior. |
| `DOC-06` | Reconocer (acknowledge) un hallazgo | Botón de la tarjeta. | 2 Contextual a proyecto | baja (inferencia) | Botón. | Igual. | Igual. |
| `DOC-07` | Saltar del hallazgo a la herramienta que lo arregla | Botón de la tarjeta. | 6 Workflow temporal | baja (inferencia) | Botón. | Igual. | Igual. |

### Persistencia (4)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `PER-01` | Guardar automáticamente el trabajo | Invisible; su estado se ve en el chip del TopBar (SHL-21). | 1 Global persistente | alta (evidencia) | Invisible. | Invisible. | Invisible. |
| `PER-02` | Trabajar sin conexión | Estado en el TopBar. | 1 Global persistente | media (inferencia) | Chip. | Chip. | Icono + detalle en «Más». |
| `PER-03` | Resolver un conflicto de revisión | Estado `conflict` en el TopBar; la resolución está en el Project Hub (ENT-09), en otra pantalla. | 2 Contextual a proyecto + 6 Workflow temporal | baja (evidencia) | Aviso sin acción. | Igual. | Igual. |
| `PER-04` | Migrar un proyecto de una versión anterior | Invisible, automático. | 1 Global persistente | baja (evidencia) | Invisible. | Invisible. | Invisible. |

### Estados (6)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `STA-01` | Entender un estado vacío | Dentro de cada superficie. | Transversal | alta (evidencia) | Tarjeta con acción. | Igual. | Igual. |
| `STA-02` | Entender un estado de carga | En cada superficie que carga. | Transversal | alta (evidencia) | Spinner / strip. | Igual. | Igual. |
| `STA-03` | Entender un análisis obsoleto (stale) | Chip del TopBar + estado de Results. | Transversal / 2 Contextual a análisis | alta (evidencia) | Chip + estado. | Igual. | Chip. |
| `STA-04` | Entender un análisis fallido | Cuerpo de Results + chip del TopBar. | Transversal / 2 Contextual a análisis | media (evidencia) | Tarjeta + chip. | Igual. | Igual. |
| `STA-05` | Entender un control deshabilitado | Disperso por superficie. | Transversal | alta (evidencia) | Variable. | Variable. | Variable. |
| `STA-06` | Trabajar con movimiento reducido / alto contraste | Automático. | Transversal | baja (evidencia) | Automático. | Automático. | Automático. |

### Aula (3)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `AUL-01` | Seguir el recorrido guiado de un ejercicio | Banda sobre el lienzo, encima del canvas. | 6 Workflow temporal + 2 Contextual a proyecto | media (en Aula) (inferencia) | Banda de 6 columnas sobre el lienzo. | Igual — y aquí es donde más lienzo cuesta. | `is-compact`: sólo el paso actual, con su descripción. |
| `AUL-02` | Ver niveles pedagógicos del resultado | Results › Entender. | 2 Contextual a análisis | baja (inferencia) | Pestaña. | Igual. | Hoja. |
| `AUL-03` | Mantener la sesión de aula | Invisible. | Transversal | media (en Aula) (evidencia) | Invisible. | Invisible. | Invisible. |

### Space 3D (2)

| ID | Tarea | Dónde vive hoy | Clasificación UX | Frecuencia (fuente) | Expanded | Medium | Compact |
|---|---|---|---|---|---|---|---|
| `S3D-01` | Trabajar en el dominio espacial experimental | Pantalla completa propia, con dos orígenes (Inicio o mesa). | 9 Fullscreen (dominio separado) | baja (inferencia) | Pantalla propia. | Igual. | Igual. |
| `S3D-02` | Navegar el modelo espacial por lista | Panel dentro de la pantalla Space3D. | 9 Fullscreen (dominio separado) | baja (inferencia) | Panel. | Igual. | Igual. |

