# CRI-8 — Mapa maestro de funciones, superficies y tareas de StructureCo

**Fecha:** 2026-08-15 01:30
**Agente:** Claude Code
**Rama:** `research/cri-8-ux-map`, partiendo de `origin/main` en **`e9a406a`** (`e9a406a56ca05cc25e69b83a6e9d4c34794e7b13`, «merge: CRI-7 — auditoría UX integral»)
**Clasificación:** `AUDIT/TEMPORARY` — mapa funcional de un árbol concreto. No es especificación, no es contrato y no fija diseño.

> **Qué es y qué no es este documento.** CRI-7 respondió *dónde duele*. CRI-8 responde *qué existe, qué tarea resuelve, de qué contexto depende y qué rutas legítimas tiene*. No arregla ningún finding de CRI-7, no decide arquitectura (eso es CRI-9) y no fija estética (eso es CRI-10). No se ha tocado un solo archivo de producción.

---

## 0. Autoridad y restricciones aplicadas

**El Brandbook Clay oficial (`brand/brandbook-clay.html`, 14 secciones) es la autoridad normativa** sobre identidad visual y UX visual. Se leyó íntegro antes de emitir cualquier juicio. En este documento:

- Los competidores y las heurísticas externas aportan **principios de interacción y nada más**. No definen color, radio, sombra, motion, spacing, iconografía ni estética de StructureCo.
- Cuando el código actual contradice el Brandbook, se registra como **estado implementado / desviación a reconciliar**, nunca como fuente alternativa de diseño.

**Restricciones protegidas verificadas durante el mapeo** (todas se cumplen hoy, con el matiz que se indica):

| Restricción | Estado verificado |
|---|---|
| Un solo `ProjectModel` | ✅ Datasheet es **proyección**, no modelo paralelo (`DatasheetPanel.tsx:45-56`). |
| Un solo solver / análisis | ✅ Aula usa el mismo `analyze()`; la traza matricial se calcula bajo demanda (`ensureEducationTrace`). |
| No duplicar persistencia ni comandos por dispositivo | ✅ para comandos (bus `workspaceCommands` único). ⚠️ **Space 3D duplica la resolución de tema** (`Space3DWorkspace.tsx:50` frente a `ProjectContext.tsx:45-49`). |
| `success ≠ reliable ≠ safe` | ✅ Implementado, probado y calibrado (`reliability.ts`, `elasticDemandGate`). |
| 2D y Space 3D separados | ✅ Dominios, stores y motores distintos. Este mapa **no afirma paridad alguna**. |
| No inventar información espacial | ✅ Space 3D se inventaría como dominio experimental; sus unknowns quedan como unknowns. |
| No inferir `materialId`/`sectionId` por floats | ✅ Los comandos transportan el id explícito; hay test dedicado (`identityMetadata.test.ts`). |
| No inventar funcionalidades ausentes | ✅ Toda fila cita archivo y línea. Lo no demostrable va a `unknown`. |

**Lo que este documento NO hizo, por encargo explícito:** no modificar `src/**`, no tocar CSS/tokens/componentes, no implementar fixes de CRI-7, no hacer mockups ni prototipos, no diseñar Aula vNext, no publicar Pages, no convertir el mapa en lista de deseos.

---

## 1. Verificación del baseline — y por qué CRI-7 sigue siendo válido

CRI-7 se ejecutó sobre `b121c03dd307dcdbc7bdea96172222ed8eacddfe`. `main` vigente es `e9a406a`. Antes de reutilizar una sola de sus mediciones se comprobó que el árbol de producto no cambió:

```
$ git diff --stat b121c03dd307dcdbc7bdea96172222ed8eacddfe e9a406a -- src/ package.json
(salida vacía)
```

**`src/` y `package.json` son byte-idénticos entre el árbol que CRI-7 midió y el `main` actual.** El único delta entre ambos SHA es la documentación que CRI-7 añadió bajo `reports/`. Por tanto todas las cifras de CRI-7 —canvas-budget, tamaños de objetivo, tipografías, radios, breakpoints— **siguen describiendo el producto de hoy**, y este mapa las cita sin volver a medirlas.

### 1.1 Una precisión sobre F-04

CRI-7 afirma que el botón de herramienta del rail «no usa `sc-tool-button`», citando `ToolBar.tsx:93`. La lectura del código matiza el mecanismo sin cambiar la conclusión:

`ToolBar.tsx:93` pasa `tool-button tool-${id} active` como `className` a `EditorToolButton`, y ese componente (`design-system/components/editor.tsx:47`) **añade** `sc-tool-button sc-tool-button--${tone} is-active` antes de concatenar el `className` recibido. Es decir: el botón renderizado lleva **las dos clases a la vez**. Se hunde (Clay, `ui.css:565-572`) **y** se tiñe de plano (legacy, `styles.css:574`), simultáneamente.

El diagnóstico de F-04 —«dos gramáticas de estado activo conviven»— es correcto y de hecho es peor de lo descrito: no son dos botones distintos con dos lenguajes, es **un mismo botón con dos lenguajes superpuestos**. Se registra como refinamiento de la evidencia, no como corrección del hallazgo.

### 1.2 Dos hallazgos nuevos que surgieron del mapeo

No se buscaron: aparecieron al verificar rutas. Se declaran aquí porque afectan al mapa.

**G-01 · Undo y Redo no tienen atajo de teclado, pero la interfaz anuncia que sí.**
La paleta de comandos publica `Ctrl Z` y `Ctrl Y` como atajos (`CommandPalette.tsx:150,154`). Búsqueda exhaustiva en `src/**`: **no existe ningún manejador que enlace esas teclas.** El único `'z'` del código es el nombre de un campo de coordenada de Space 3D (`Space3DEntityEditor.tsx:156`). El manejador global del lienzo (`StructuralCanvas.tsx:1642-1734`) atiende `Ctrl+C`, `Ctrl+V`, `Ctrl+D`, `R`, las teclas de herramienta, `Escape` y `Delete/Backspace` — no `Ctrl+Z`. **La interfaz promete un atajo que no existe.** Ver `SHL-03`/`SHL-04`.

**G-02 · `resultTab` admite un valor que la lista de pestañas no puede mostrar.**
`ResultTab` incluye `'issues'` (`WorkspaceUIContext.tsx:4`) y `ProjectContext` lo fija cuando el análisis falla (`ProjectContext.tsx:239,518`). Pero el array `tabs` de `ResultsPanel` no lo contiene, así que `activeTab` cae silenciosamente a `summary` (`ResultsPanel.tsx:179`). **Funcionalmente no se pierde nada** —el cuerpo muestra `FailedResults` igualmente— pero `aria-selected` queda marcado en una pestaña que no refleja el estado real. Severidad baja; se registra por exactitud. Ver `STA-04`.

---

## 2. Cómo leer el mapa

### 2.1 La unidad de análisis es la tarea, no el componente

El inventario tiene **122 tareas de usuario**, no una lista de componentes React. `TopBar.tsx` no es una fila; «renombrar el proyecto abierto» (`ENT-13`), «elegir caso de carga o combinación» (`SHL-07`) y «exportar el proyecto» (`SHL-22`) son tres filas distintas que *casualmente* hoy viven en `TopBar.tsx`. Esa separación es el punto: permite preguntar de cada una si su ubicación actual está justificada.

### 2.2 Esquema de identificadores

| Prefijo | Dominio | Filas |
|---|---|---|
| `ENT-` | Entrada / proyecto | 15 |
| `SHL-` | Shell / global | 24 |
| `MOD-` | Modelado | 16 |
| `SEL-` | Selección | 7 |
| `CNV-` | Lienzo | 10 |
| `INS-` | Inspector / detalle | 7 |
| `RES-` | Resultados | 11 |
| `DAT-` | Datasheet | 10 |
| `DOC-` | Model Doctor | 7 |
| `PER-` | Persistencia | 4 |
| `STA-` | Estados transversales | 6 |
| `AUL-` | Aula (sólo inventario) | 3 |
| `S3D-` | Space 3D (experimental, aparte) | 2 |
| | **Total** | **122** |

Los IDs son estables: CRI-9 y CRI-10 pueden referenciarlos directamente.

### 2.3 Las 33 columnas de cada fila

Cada tarea registra: ID · dominio · tarea · objetivo del usuario · implementación verificada · archivos/componentes · tests/QA/evidencia · frecuencia · **fuente de la frecuencia** · criticidad · objeto/contexto del que depende · precondiciones · dónde vive hoy · rutas alternativas · findings CRI-7 · qué funciona y debe conservarse · clasificación UX · ruta funcional en Expanded / Medium / Compact · mouse-keyboard path · touch path · necesidad de precisión · si puede ser contextual a selección · persistente vs disclosure · superficie apropiada · disabled/loading/error · feedback esperado · focus/Escape/Cancel/Reset · impacto en canvas-budget · decisión para CRI-9 · patrón para CRI-10 · unknowns.

El inventario completo con las 33 columnas está en `cri-8-task-inventory.json` y `.csv`. La **TABLA A** de este informe (§3) es su versión condensada y se lee sin herramientas.

### 2.4 Honestidad de la frecuencia — el dato más débil de este mapa

| Fuente de la frecuencia | Filas | Qué significa |
|---|---|---|
| **evidencia** | 36 | Derivable del código, de un test, de un gate o de la evidencia de CRI-7. Ej.: `SEL-02` (el ciclado de solapados existe y está probado), `PER-03` (el conflicto se salva antes de fallar). |
| **inferencia** | 86 | Razonada desde la naturaleza de la tarea, **no medida**. Ej.: «crear una barra es de frecuencia alta» es sensato pero nadie lo ha medido. |
| **unknown** | 0 filas al nivel de la columna, pero **98 de 122 filas declaran al menos un unknown** en otra dimensión. |

**No hay telemetría en el producto.** Ninguna cifra de frecuencia de este documento debe usarse como justificación dura para quitar algo de la vista. Se usan para *ordenar preguntas*, no para cerrar decisiones. Cuando CRI-9 necesite frecuencia real, tendrá que medirla.

### 2.5 Recuentos generales

| Dimensión | Reparto |
|---|---|
| Criticidad | esencial 80 · contextual 29 · secundaria 10 · configuración 3 |
| Tareas que pueden depender de la selección | 25 de 122 |
| Tareas con necesidad de precisión especial | 30 de 122 |
| Tareas cuya ruta **cambia** en algún tier | 80 de 122 |
| Tareas cuyo Medium **sólo repite** Expanded | 103 de 122 |
| Filas con unknown declarado | 98 de 122 |

---

## 3. Inventario completo — 122 tareas verificadas

> Columnas: ID · tarea · dónde vive hoy · clasificación UX · frecuencia (fuente) · criticidad.
> Las 33 columnas completas: `reports/evidence/2026-08-15-cri-8-ux-map/cri-8-task-inventory.{json,csv}`.

### 3.1 Tabla A — inventario por dominio

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

---

## 4. Clasificación UX de las 122 tareas

Una tarea puede pertenecer a varias categorías compatibles; por eso los recuentos suman más de 122. Reparto reproducible en `cri-8-ux-classification.json`.

| # | Categoría | Tareas | Lectura |
|---|---|---|---|
| 1 | **Global persistente** | 19 | Menos de lo que el chrome actual sugiere. Sólo `SHL-01` (analizar), `SHL-21` (estado de persistencia), `ENT-14` (volver a Inicio), `SHL-23` (canal de toasts), `MOD-01`/`MOD-14` (crear geometría) y `PER-01/02/04` lo son sin discusión. |
| 2 | **Contextual a proyecto/análisis** | 29 | La categoría más poblada. Casi todo lo que hoy vive fijo en la zona de contexto del TopBar cae aquí: combinación, orden de análisis, Model Doctor, exportación, todos los resultados. |
| 3 | **Contextual a selección** | 23 | 20 de estas 23 **ya** tienen contenido contextual; lo que no es contextual es su **presencia**. |
| 4 | **Canvas-local** | 27 | Herramientas, cámara, capas, snap, lupa, readout, modo. |
| 5 | **Inspector / detail** | 9 | Propiedades, catálogos, bulk edit, procedencia. |
| 6 | **Workflow temporal** | 16 | Import Center, generadores, edición estructural, repeat, revisión del Datasheet, reparación de topología, entrada rápida. |
| 7 | **Power-user / Command Palette** | 5 | Paleta, navegación por ID, portapapeles, pegado de bloque, teclado del lienzo. |
| 8 | **Configuración / preferencias** | 13 | Unidades, idioma, tema, modo de cálculo, layout, hub. |
| 9 | **Fullscreen / datos densos** | 21 | Datasheet, Welcome, hub, Space 3D, influencia, aprender, impresión. |
| — | **Transversal** (sin categoría de superficie) | 5 | Estados: vacío, carga, obsoleto, fallido, deshabilitado, movimiento reducido. |

### 4.1 La conclusión que importa

**Sólo 19 de 122 tareas son genuinamente globales persistentes. El chrome permanente de Expanded aloja muchas más que eso.**

Tres ejemplos, con su justificación verificada:

- **`SHL-07` — elegir combinación.** Vive fijo en el TopBar. No depende de la selección ni existe fuera del contexto de análisis: es *contextual a análisis*. Es el candidato número uno a viajar junto a los resultados que gobierna.
- **`SHL-08` — modo de cálculo.** Preferencia de sesión, criticidad `configuración`, con **cuatro** puertas permanentes (TopBar, «Más», Inspector › Vista, guía de Aula). Es el caso más claro de acumulación.
- **`INS-05` — crear casos de carga y combinaciones.** Vive dentro del panel de la *selección* y **no depende de la selección**. Es contextual a proyecto alojado en una superficie de objeto.

Y la simétrica, que es la que evita el error contrario:

- **`MOD-01` y `MOD-14` — crear geometría y generar estructuras.** **No pueden** ser contextuales a la selección: cuando se va a crear, no hay nada seleccionado. El código ya lo razona explícitamente para el generador (`CommandPalette.tsx:158-160`: «no depende de la selección, así que nunca aparece deshabilitada por no haber elegido nada»). Cualquier propuesta de «todo por contexto» rompe aquí.

---

## 5. Responsabilidades actuales por superficie

Qué está haciendo hoy cada superficie, contado desde el inventario.

### 5.1 TopBar — 24 responsabilidades de cinco naturalezas distintas

| Naturaleza | Tareas | Ejemplos |
|---|---|---|
| Identidad del documento | 3 | `ENT-13` nombre, `ENT-14` Inicio, `ENT-03/04/10` menú de proyecto |
| Acción de trabajo | 4 | `SHL-01` analizar, `SHL-03/04` historial, `SHL-14/15` lanzadores |
| Contexto de análisis | 4 | `SHL-07` combinación, `SHL-08` modo, `SHL-09` orden, `SHL-10` P-Delta |
| Preferencias | 3 | `SHL-11` unidades, `SHL-12` idioma, `SHL-13` tema |
| Utilidad / salida | 3 | `SHL-22` exportar (7 salidas), `CNV-09` imagen, `CNV-10` imprimir |
| Estado | 2 | `SHL-02` análisis, `SHL-21` persistencia |
| Layout | 3 | `SHL-16/17/18` inspector, mesa completa, rail |

**El menú «Más» concentra 19 entradas heterogéneas** (F-06). Contadas por naturaleza: 2 de historial, 1 de diagnóstico, 3 de contexto de análisis (+P-Delta anidado), 3 de preferencias, 4 de layout/vistas, 7 de exportación, 1 de estado. **Deshacer comparte cajón con idioma.**

### 5.2 ToolRail — 16 responsabilidades, una sola de ellas contextual

12 herramientas del registro + paleta de comandos + generador + edición estructural + pista de selección. De las 16, **sólo una aparece condicionada al contexto**: el lanzador de edición estructural, que existe únicamente si `canEditSelection` (`ToolBar.tsx:382-390`). Es el precedente interno del patrón.

**Consumo:** 164px permanentes entre 1024 y 1439 px, donde `styles.css:3512` gana a dos reglas anteriores que lo dejaban en 76px (F-01).

### 5.3 Inspector — 7 responsabilidades en tres pestañas, sólo una contextual a la selección

| Pestaña | Tareas | ¿Depende de la selección? |
|---|---|---|
| Inspector | `INS-01` propiedades, `INS-02` material, `INS-03` sección, `INS-04` bulk edit | **Sí, las cuatro** |
| Cargas | `INS-05` casos y combinaciones, `INS-07` elegir herramienta de carga | **No, ninguna** |
| Vista | `INS-06` ~20 ajustes de visualización, `SEL-06` filtro de selección, `CNV-04` snap | **No, ninguna** |

**Dos de las tres pestañas del panel de la selección no dependen de la selección.** Y el panel ocupa 320px permanentes: 27.6% del viewport en 1024×768, **más que el propio lienzo (24.6%)**.

### 5.4 Results — 11 responsabilidades que no forman una unidad

Descompuesto como pedía el encargo:

| Responsabilidad | Tarea | Naturaleza real |
|---|---|---|
| Estado del análisis | `SHL-02` | **Global persistente** — merece estar siempre |
| Fiabilidad | `RES-06` | **Global persistente** — es la afirmación más crítica del producto |
| Resumen | `RES-01` | Contextual a análisis |
| Reacciones (tabla + localizar) | `RES-02` | Datos densos + navegación |
| Diagramas N/V/M | `RES-03` | Contextual a análisis **+ a selección** + overlay de lienzo |
| Deformada | `RES-04` | Contextual a análisis + overlay |
| Índice elástico | `RES-05` | Contextual a análisis + a selección + capa de lienzo |
| Líneas de influencia | `RES-07` | Datos densos — pide superficie propia |
| Aprender | `RES-08` | Datos densos — la vista más larga del panel |
| Modo y altura del panel | `RES-09` | Configuración de layout |
| Procedencia del número | `RES-10` | Detail, ligado al cursor |
| Localizar en el modelo | `RES-11` | Canvas-local (destino) |

**Results no es un panel: son al menos cinco cosas** —un estado global, un selector de evidencia, un overlay de lienzo, un detalle de objeto y dos vistas de datos densos— empaquetadas en 285px de alto que se reservan **antes de que exista un resultado**.

Y el propio panel **ya sabe que es varias cosas**: tiene tres modos (`compact`/`expanded`/`focused`) y agrupa sus 8 pestañas en **cinco familias semánticas** (Estado, Fuerzas, Forma, Avanzado, Entender) con `aria-describedby`. La descomposición está insinuada en el código.

### 5.5 Datasheet — 10 responsabilidades, todas coherentes

Ver, buscar, filtrar/ordenar, seleccionar filas, editar celda, pegar bloque, revisar/aplicar/cancelar, panel editor, cambiar entidad, enfocar en el lienzo. **Ninguna está mal ubicada.** El único problema estructural es que enfocar un objeto **exige cerrar la tabla** (`DAT-10`), porque el drawer es modal y taparía justo el objeto centrado. Es una consecuencia honesta de la decisión de superficie, no un descuido.

### 5.6 Model Doctor — 7 responsabilidades, todas coherentes

Diagnosticar, filtrar por severidad, entender (tres textos separados), localizar, previsualizar/aplicar reparación, reconocer, saltar a la herramienta. **La superficie está bien resuelta.** Sus problemas son de *acceso* (F-06: pierde el botón directo bajo 1024px) y de *señal* (el lanzador no dice cuántos hallazgos hay, aunque el sistema ya lo calcula para el toast).

### 5.7 Canvas — 10 responsabilidades más el chrome flotante

Cámara, minimapa, capas, snap, readout, badge de modo, teclado, arrastre, exportación de imagen, impresión. El chrome flotante (minimapa, controles de cámara, chips de vista, badge de modo, estado, disparador de capas, botón de inspector) ocupa **17.5% del lienzo en 1024×768** frente a 6.5% en 1536×960: son widgets de tamaño fijo sobre un lienzo que encoge.

---

## 6. Matriz Expanded / Medium / Compact + método de entrada

La tabla exhaustiva (80 filas que cambian de tier, con sus rutas de mouse/teclado y touch) está en `report-tables.md` § TABLA B. Aquí, los patrones que la resumen.

### 6.1 Los cinco patrones de adaptación que el producto ya usa

| Patrón | Dónde ya existe | Disparador |
|---|---|---|
| **Panel → hoja** | Inspector (`INS-01`), Results (`RES-01`) | Ancho de viewport (1023px) |
| **Rail → dock flotante + hojas** | ToolRail (`MOD-01`) | Ancho de viewport (1023px) |
| **Botón → entrada de cajón** | Model Doctor (`SHL-14`), contexto de análisis (`SHL-07/08/09`) | Ancho de viewport (1024px, `display:none` en CSS) |
| **Drawer lateral → drawer inferior** | Model Doctor (`DOC-01`) | Ancho de viewport (700px), decidido en JS |
| **Readout de puntero → lupa táctil** | Coordenadas (`CNV-05`), precisión (`SEL-07`) | **Método de entrada**, no ancho |

Los cuatro primeros responden al **ancho**. El quinto responde al **input**. Ese quinto es el único que aplica el principio «misma capacidad, distinta interacción por método de entrada» — y es el que mejor funciona.

### 6.2 Dónde Compact hace lo correcto y Expanded no

| Comportamiento | Compact | Expanded |
|---|---|---|
| Results | Colapsado a 54px; se despliega **solo** cuando llega un resultado | Reserva 22-25% del viewport **siempre**, analizado o no |
| Inspector | Fuera del flujo; vuelve como hoja invocada | 320px permanentes aunque no haya selección |
| ToolRail | Dock flotante de 5 destinos sobre el lienzo | 164px permanentes que no se contraen (F-01) |
| Canvas-budget | 63-76% del viewport al modelo | **20-37%** |

**Compact no es la versión degradada: es la versión que aplica la disciplina del Brandbook §02.** Expanded es la que nunca la recibió. Esta es la inversión que CRI-9 tiene que resolver, y la buena noticia es que **la palanca ya está construida**: `inspectorCollapsed`, `fullCanvas`, `toolRailCompact`, ancho con `clamp` 280-480 y detents normalizados por viewport ya existen y persisten. Lo que falla es el valor por defecto y la cascada, no la arquitectura.

### 6.3 Huecos de paridad por método de entrada

Cuatro tareas verificadas **no tienen ruta táctil**:

| Tarea | Qué falta en táctil | Verificado en |
|---|---|---|
| `SEL-02` Resolver objetos solapados | El `overlapPicker` **no se activa**: la rama táctil sale antes para resolver la intención pan/long-press | `StructuralCanvas.tsx:1241-1244` |
| `SEL-03` Selección con marco | Un dedo sobre el fondo es **pan**, no marco | `StructuralCanvas.tsx:1307-1311` |
| `MOD-13` Copiar / pegar / duplicar | Sólo `Ctrl+C/V/D`; sin botón, menú ni comando de paleta | `StructuralCanvas.tsx:1669-1692` |
| `DAT-06` Pegar bloque en el Datasheet | Depende de `Ctrl+V` | `DatasheetPanel.tsx:285-296` |

Hay rutas de reserva parciales —el Datasheet da multiselección táctil (`DAT-04`), la matriz lineal cubre parte de la duplicación (`MOD-10`)— pero **no son la misma tarea mental**. La restricción «no crear versión funcional separada para móvil» está incumplida en estos cuatro puntos.

Y uno más, de teclado: **`MOD-12` (Repeat) sólo se activa con la tecla `R`**. No está en la paleta ni en «Más». Su ruta táctil es un **unknown declarado**.

---

## 7. Medium no existe como comportamiento — la medida exacta

**103 de las 122 tareas (84%) declaran para Medium «igual que Expanded».** No es una opinión de este informe: es lo que el código produce. Entre 1024 y 1439 px el layout es idéntico al de Expanded (CRI-7 §1), con el agravante de que es justo el rango donde menos ancho sobra.

Las **19 tareas que sí cambian algo en Medium** son casi todas herencia de Compact que se cuela por debajo de 1024, o adaptaciones que responden a otra cosa que no es el viewport:

| Tarea | Qué cambia en Medium | Por qué |
|---|---|---|
| `DOC-01` Model Doctor | Drawer lateral vs inferior | Umbral propio de 700px en JS |
| `SEL-07` Lupa táctil | Aparece si el dispositivo es táctil | **Input**, no ancho — una tablet de 1024px la tiene |
| `RES-01`/`RES-09` Results | Container query a 560px del **panel** | Ancho del contenedor, no del viewport |
| `SHL-14` Model Doctor (lanzador) | Icono sin texto bajo 1536px | Umbral CSS distinto del de tier |
| `AUL-01` Guía de Aula | La banda cuesta aquí lo mismo que en Expanded | Sin adaptación propia |

**Diagnóstico funcional para CRI-9:** Medium no necesita ser un tercer conjunto de reglas de ancho. Necesita ser el tier donde el producto decide **qué chrome deja de ser permanente**. Las 103 filas que hoy repiten Expanded son exactamente la lista de decisiones que Medium tiene que tomar y hoy no toma.

**Y un dato que cambia el planteamiento:** una tablet de 768×1024 recibe hoy **78.6% del viewport para el modelo** porque cae en Compact. Un portátil de 1024×768 recibe **20.3%**. Son 256px de diferencia de ancho y **58 puntos de canvas-budget**. Medium no es un problema de píxeles intermedios: es un acantilado.

---

## 8. Duplicaciones — legítimas e innecesarias

### 8.1 Qué hace legítima una duplicación

Del mapeo sale un criterio de tres condiciones, y las tres se cumplen o no se cumplen en el código:

1. **Escriben el mismo estado.** Todas las puertas terminan en el mismo `ProjectModel`, el mismo `Selection` o el mismo comando.
2. **Responden a una necesidad distinta**: individual / masiva / power-user / recuperación.
3. **El coste de tenerlas es menor que el coste de no tenerlas** en el contexto donde aparecen.

### 8.2 Duplicaciones LEGÍTIMAS — deben preservarse

| Función | Puertas | Por qué cada una existe |
|---|---|---|
| **Seleccionar** (`SEL-01`) | Lienzo · Datasheet · Paleta por ID · Model Doctor · tarjetas de Results | Espacial / tabular / por identificador / desde un diagnóstico / desde una cifra. **Cinco necesidades reales, un solo `Selection`.** |
| **Cambiar sección de una barra** (`INS-03`) | Inspector · Datasheet · Bulk Edit · Generadores | Individual / tabular / masiva / en lote. **Las cuatro emiten el mismo comando con `sectionId` explícito.** Es el ejemplo canónico del enunciado de CRI-8 y está bien resuelto. |
| **Localizar un objeto** (`RES-11`) | Results · Model Doctor · Datasheet · Paleta | Cuatro emisores, **un solo comando tipado** (`focus-object`, con `FocusableSelection` que hace imposible pedir un foco inválido). |
| **Abrir Model Doctor** (`SHL-14`) | TopBar · «Más» · Paleta · AnalysisStatus · Results fallido | Preventivo / de reserva / power-user / desde el estado / desde el fallo. **Cada una nace de un problema distinto.** |
| **Estado del análisis** (`SHL-02`) | Chip del TopBar · texto de Results | Glanceable vs explicativo. Dos profundidades, no dos controles. |
| **Fiabilidad** (`RES-06`) | Chip · estado de Results · tarjeta de calidad numérica | Tres profundidades de la afirmación más crítica del producto. |
| **Leer un valor interno** (`MOD-16` / `RES-03`) | Corte sobre el lienzo · cursor sobre el diagrama | Sobre el modelo vs sobre la gráfica. Distintas tareas mentales. |
| **Multiselección** (`SEL-04`) | Marco en el lienzo · rango en el Datasheet | Espacial vs por criterio. Y en táctil, la segunda es la **única**. |

### 8.3 Duplicaciones INNECESARIAS — mismo control, misma necesidad, varios sitios

| Función | Puertas | Por qué sobra |
|---|---|---|
| **Exportar** (`SHL-22`) | Menú de exportación · «Más» › Exportar (las **mismas 7**) · 4 comandos de paleta | **21 afordancias para una familia de baja frecuencia.** El menú de «Más» replica el menú de exportación entero sin diferenciar nada. |
| **Modo de cálculo** (`SHL-08`) | TopBar · «Más» · Inspector › Vista · guía de Aula | Preferencia de sesión con **cuatro** puertas permanentes. Además con dos gramáticas distintas (`select` y `segmented-control`) para el mismo estado. |
| **Tema** (`SHL-13`) | Welcome · «Más» · Paleta · **lógica duplicada en Space 3D** | Las tres primeras son aceptables; la cuarta es duplicación de **lógica**, no de puerta, y contradice «no duplicar lógica por presentación». |
| **Elegir herramienta de carga** (`INS-07`) | Rail · dock táctil · hoja «Cargas» · Inspector › Cargas · Paleta | **Cinco lanzadores para tres herramientas.** En Compact la del Inspector tiene sentido (la hoja está abierta y se cierra al elegir); en Expanded el rail ya está a la vista. |
| **Visibilidad del dibujo** (`CNV-03` vs `INS-06`) | Capas del lienzo (9 capas + 5 presets) · Inspector › Vista (8 interruptores `show*`) | **Dos sistemas de visibilidad sobre el mismo lienzo**, en dos superficies, sin relación visible. No está verificado qué gana si se contradicen. |
| **Filtrar / reducir el universo** (`DAT-03`, `CNV-03`, `SEL-06`) | Facetas del Datasheet · capas del lienzo · filtro de selección | Tres mecanismos de «enséñame menos» con tres interfaces y tres ubicaciones. |
| **Ficha de propiedades del mismo objeto** (`INS-01`, `DAT-08`, `INS-04`) | Inspector · `DatasheetEditorPanel` · Bulk Edit | **Tres interfaces distintas para leer y escribir el mismo objeto.** Las tres escriben el mismo modelo —eso está bien— pero son tres implementaciones de la misma lectura. |
| **Contrato borrador→plan→preview→escritura** | Datasheet · Bulk Edit · edición estructural · generadores · reparación de topología | **Cinco implementaciones del mismo patrón de interacción.** Todas correctas; ninguna compartida. |

### 8.4 El caso intermedio: `SHL-16/17/18`

Ocultar Inspector, mesa completa y contraer rail son **tres controles distintos con efectos solapados** y sin que la diferencia sea evidente para el usuario. `onToggleInspector` incluso desactiva `fullCanvas` como efecto lateral (`WorkspaceShell.tsx:246-254`). No es duplicación innecesaria —hacen cosas distintas— pero sí es un modelo mental que nadie ha declarado.

---

## 9. Funciones demasiado escondidas y huecos de acceso

### 9.1 Ranking de funciones escondidas

| # | Tarea | Profundidad actual | Por qué importa |
|---|---|---|---|
| 1 | **`SHL-10` Parámetros avanzados de P-Delta** | «Más» → sección Análisis → `<details>` colapsado → 6 campos numéricos. **Triple disclosure, ruta única.** | Es la configuración de convergencia de un análisis no lineal. Si no converge, esto es lo que hay que tocar, y está más escondido que el selector de idioma. |
| 2 | **`SHL-16` Ocultar el Inspector** | «Más» → Vistas → activar. **Tres pasos, ruta única.** | Es **el control que más canvas-budget devuelve** (27.6% del viewport en 1024×768) y está enterrado en un cajón de 19 entradas. |
| 3 | **`SEL-06` Filtro de selección** | Inspector → pestaña Vista → sección «Precisión CAD» → tras el texto de ayuda. **Ruta única, sin realimentación en el lienzo.** | Es una herramienta de **precisión de selección** que vive en una pestaña de preferencias, y un objeto no seleccionable se ve exactamente igual que uno seleccionable. |
| 4 | **`MOD-13` Copiar / pegar / duplicar** | Sólo atajo de teclado. **Sin ninguna afordancia visible.** | Operación básica de edición, invisible y ausente en táctil. |
| 5 | **`MOD-12` Repeat** | Sólo tecla `R` sobre una selección válida. **Ni paleta ni menú.** | Función potente que copia sección, material, releases y muelles del objeto real. Si el teclado falla, no existe. |
| 6 | **`SHL-17`/`SHL-18` Mesa completa y rail compacto** | «Más» → Vistas. | Mismo problema que #2, con menos impacto individual. |
| 7 | **`SHL-09` Orden de análisis (P-Delta)** | TopBar zona contexto en Expanded; «Más» en Compact. | Baja frecuencia pero **criticidad esencial**: cambia la física del resultado. Es el caso donde «poco usado» no puede significar «escondido». |

### 9.2 Huecos de acceso entre contextos — verificados

| # | Hueco | Detalle | Gravedad |
|---|---|---|---|
| 1 | **Conflicto detectado en la mesa, resuelto en otra pantalla** | `PER-03`/`SHL-21` muestran el estado `conflict` en el TopBar. La restauración (`ENT-09`) vive en el Project Hub, dentro de la Welcome. **No hay ruta desde la mesa.** | **Alta** — es pérdida potencial de trabajo. |
| 2 | **No se puede cambiar de proyecto desde la mesa** | `ENT-06` (Project Hub) sólo existe en la Welcome. Desde el workspace, la única forma de abrir otro proyecto guardado es volver a Inicio. | Media |
| 3 | **Importar DXF exige volver a Inicio** | `ENT-11` sólo se lanza desde `Phase2DxfAction` en la Welcome. | Media |
| 4 | **Undo/redo prometen un atajo que no existe** | G-01: la paleta anuncia `Ctrl Z`/`Ctrl Y` sin manejador. | Media |
| 5 | **La causa de una fiabilidad limitada vive en un `title` HTML** | `RES-06`: el `governing.message` se expone en un `title` (`ResultsPanel.tsx:183`). **No existe en táctil ni por teclado.** La información más crítica del producto tiene la ruta más débil. | **Alta** |
| 6 | **Localizar exige cerrar el diagnóstico o la tabla** | `DAT-10` y `DOC-04` cierran su superficie para enfocar, porque taparían el objeto. Es honesto, pero rompe el ida y vuelta. | Media |
| 7 | **`MOD-16` (corte) se puede activar sin análisis y no hace nada** | La herramienta está disponible siempre; su precondición (`resultsAllowed && analysis?.success`) no se comunica. | Baja-media |
| 8 | **Borrar en táctil cuesta 3 pasos y su deshacer está a otros 2** | `MOD-09` + `SHL-03`: hoja «Más» → herramienta destructiva → objeto; y para revertir, «Más» → Deshacer. | Media |

---

## 10. Precisión — dónde la selección actual no resuelve la intención

**30 de 122 tareas declaran necesidad de precisión especial** (tabla completa en `report-tables.md` § TABLA E).

### 10.1 Lo que StructureCo ya resuelve, y bien

No se propone nada nuevo aquí: se documenta para que no se pierda.

| Mecanismo | Qué resuelve | Dónde |
|---|---|---|
| **Áreas de acierto separadas del trazo** | El dedo acierta sin engordar el dibujo: `.member-hit { stroke-width:44 }`, `.node-hit { r:22px }`, `.load-hit { stroke-width:44 }` bajo `(pointer:coarse)` | `styles.css:1109-1125` |
| **Picker de solapados + ciclado** | Elegir entre N objetos coincidentes, con lista explícita **y** contador «i de n» | `StructuralCanvas.tsx:1245-1283` |
| **Lupa táctil que clona la escena real** | Ver bajo el dedo sin una segunda copia del render que pueda desincronizarse | `CanvasTouchLoupe.tsx` |
| **Cinco destinos de snap** | Rejilla, nudos, puntos medios, intersecciones, perpendicular, con control individual | `Inspector.tsx:325-331` |
| **Entrada numérica rápida con coma decimal** | Colocar exacto sin puntería | `quickEntry.ts` |
| **Filtro de selección por tipo** | Reducir el universo de candidatos | `settings.selectionFilter` |
| **Navegación por identificador** | Llegar al objeto sin tocar el lienzo | Paleta (`SHL-06`), ModelNav 3D (`S3D-02`) |
| **Teclado sobre el lienzo** | Tabular no falla nunca el objetivo | `aria-keyshortcuts` en `role="application"` |

**Ocho mecanismos de precisión ya construidos.** El problema no es ausencia: es reparto por método de entrada y descubribilidad.

### 10.2 Casos reales donde la selección actual NO puede resolver la intención

Enumerados, no diseñados. CRI-9 decidirá qué hacer con ellos.

| # | Caso | Por qué falla hoy |
|---|---|---|
| 1 | **Nudo con varias barras concurrentes, en táctil** | `elementsFromPoint` vería todas, pero la rama táctil sale antes de llegar al picker (`StructuralCanvas.tsx:1241-1244`). La lupa muestra qué hay, pero no ofrece **elegir cuál**. |
| 2 | **Carga sobre la barra que la soporta, en táctil** | El código resuelve bien el conflicto para las herramientas de carga/split/cut (`:1218-1227`), pero con la herramienta `select` en táctil el desempate queda al hit-testing, sin picker. |
| 3 | **Dos nudos a distancia menor que el dedo** | La lupa amplía 2,4×, suficiente para *ver* los dos; no hay gesto para *elegir* entre ellos sin acercar la cámara. |
| 4 | **Casilla booleana de 13×13 px en el Datasheet** | Es una **edición estructural real** (rótula por barra) en el objetivo más pequeño del producto (F-02). Con dedo es lotería. |
| 5 | **Punto de división de una barra (`MOD-08`)** | El punto exacto importa y sólo se puede indicar por puntería; no hay entrada numérica de ratio. |
| 6 | **Posición del corte (`MOD-16`)** | La posición **es** el dato. Con dedo, la resolución de lectura depende del pulso. El corte fijado (`pinned`) mitiga, no resuelve. |
| 7 | **Tirador de redimensión del Inspector (64×28) y del panel Results** | Bandas finas; en táctil compiten con el scroll (F-02). |
| 8 | **Enlaces `space3d-linkish` de 26×36** | La ruta *no espacial* a un objeto espacial tiene objetivos por debajo del mínimo (CRI-7 §8). |

### 10.3 La observación central sobre precisión

**El mejor mecanismo de precisión del producto —el picker de solapados con ciclado— está apagado exactamente en el método de entrada que más lo necesita.** No falta capacidad: falta enrutarla. Y la lupa, que sí es táctil, **no se activa durante un tap simple de selección**: sólo tras armarse una interacción de colocación, arrastre, long-press o marco (`StructuralCanvas.tsx:1395-1399`).

---

## 11. Rutas de teclado y power-user

| Ruta | Estado |
|---|---|
| 11 teclas de herramienta (V H N M S P D O C X B) | ✅ Implementadas y declaradas en `aria-keyshortcuts` |
| `Delete` / `Backspace` | ✅ Borra la selección |
| `Escape` | ✅ **Cancelación total**: limpia selección, origen de barra, entrada rápida, picker, receta de repetición y corte, y vuelve a `select`. Siete estados en un gesto. |
| `Ctrl/⌘+K` paleta | ✅ Global, con retorno de foco |
| `Ctrl/⌘+C` / `V` / `D` | ✅ Copiar / pegar con desplazamiento acumulativo / duplicar con borrador |
| `R` repetir | ✅ Sobre selección repetible |
| `Espacio` + arrastre = pan | ✅ |
| `Alt`+clic ciclar solapados | ✅ |
| Navegación de rejilla del Datasheet | ✅ `datasheetGridNavigation` |
| Roving por pestañas (Inspector, Results) y por menús (TopBar) | ✅ Flechas / Home / End |
| Redimensión del Inspector por teclado | ✅ Flechas ±16, Shift ±48, Home/End — con semántica `role="separator"` completa |
| Tabulación por objetos del lienzo | ✅ Con anillo de foco propio sobre SVG |
| Enlace de salto al lienzo | ✅ Primer nodo del shell |
| **`Ctrl+Z` / `Ctrl+Y`** | ❌ **Anunciados en la paleta, sin manejador** (G-01) |
| Atajo para «ajustar a la vista» | ❌ No encontrado |
| Atajo para analizar | ❌ No existe |

**La cobertura de teclado es notablemente buena para un editor de este tipo.** Los tres huecos son concretos y acotados.

---

## 12. Impacto en canvas-budget por superficie persistente

Cifras de CRI-7 §2, válidas para el árbol actual (§1).

| Superficie | 1024×768 | 1280×800 | 1440×900 | 1536×960 | 390×844 |
|---|---|---|---|---|---|
| TopBar | 8.9% | 8.5% | 7.6% | 7.1% | 5.7% |
| ToolRail | 14.1% | 11.4% | 10.3% | 9.7% | 6.9% |
| **Inspector** | **27.6%** | 22.2% | 20.0% | 18.9% | 0 (hoja) |
| Results | 22.0% | 24.9% | 23.6% | 22.8% | 6.4% |
| Nota legal | 2.9% | 2.8% | 2.4% | 2.3% | 0 |
| **Chrome total** | **75.5%** | 69.8% | 63.9% | 60.8% | 19.0% |
| **Lienzo** | 24.6% | 30.3% | 36.1% | 39.2% | **81.0%** |
| Lienzo **útil** (sin chrome flotante) | **20.3%** | 26.7% | 33.3% | 36.7% | **76.2%** |

Y el chrome flotante **sobre** el lienzo: 17.5% del lienzo en 1024×768 frente a 6.5% en 1536×960.

### 12.1 Qué compra cada superficie persistente

| Superficie | Coste en 1024×768 | Tareas que aloja | Cuántas son globales persistentes |
|---|---|---|---|
| Inspector | 27.6% | 7 (`INS-01..07`) + `SEL-06` + `CNV-04` | **0** — las 4 de la pestaña Inspector son contextuales a selección; las otras 5 no dependen de la selección pero tampoco son globales |
| Results | 22.0% | 11 (`RES-01..11`) | **2** — estado (`SHL-02`) y fiabilidad (`RES-06`) |
| ToolRail | 14.1% | 16 | **~14** — crear y navegar sí lo son; editar y transformar no |
| TopBar | 8.9% | 24 de siete naturalezas | **~6** |

**Lectura:** la superficie que más lienzo consume (Inspector, 27.6%) es la que **menos** contenido genuinamente global aloja. Y la segunda (Results, 22.0%) reserva su espacio antes de tener nada que enseñar.

---

## 13. Densidad técnica vs legibilidad

CRI-8 **no sube tamaños**: clasifica qué superficie necesita densidad por naturaleza y qué contenido es demasiado importante para quedar reducido.

| Superficie | ¿Necesita densidad alta? | Qué NO puede quedar reducido |
|---|---|---|
| **Datasheet** | **Sí, por naturaleza.** Es una tabla de auditoría; ver muchas filas es su función. | Los **controles**. La densidad debe estar en el texto, no en objetivos de 13×13 px (F-02). Densidad de datos ≠ densidad de controles. |
| **Results — tablas** | **Sí.** Comparar reacciones exige verlas juntas. | Los **valores del solver** (hoy a 10px) y las **cifras de diagrama** (10px). Son el producto de la app. |
| **Results — procedencia** | **No.** Es una afirmación única, no una lista. | Todo: magnitud, objeto, caso, convención de signos y posición. Es la función más distintiva del producto (`RES-10`). |
| **Results — estado y fiabilidad** | **No.** | El estado de fiabilidad. Es la afirmación más crítica y hoy se renderiza pequeño. |
| **Inspector — propiedades** | **Media.** Muchas propiedades por objeto, pero se leen de una en una. | Los **valores numéricos** y sus **unidades**. `dt` a 9px y `dd` con «-7.7879 kN» a 10px (F-03) no es densidad, es ilegibilidad. |
| **TopBar** | **No.** Pocos elementos, alta frecuencia. | «Modo de cálculo» a **8px** no tiene justificación de densidad. |
| **Canvas — rótulos** | **Sí, deliberada.** El dibujo debe quedar analítico. | Los **valores de resultado** sobre el lienzo (hoy `preview-load-label` «Fy» a 8px). |
| **Nota legal profesional** | **No.** | Está a 10px y es un aviso de responsabilidad. |

**Lo que ya está bien y debe conservarse:** `font-variant-numeric: tabular-nums` en `.number-control input` y `.results-table` — las columnas de cifras alinean, que es lo que distingue una tabla de ingeniería de una tabla cualquiera. Y la elección tipográfica (Plex Sans + Plex Mono) es correcta y está bien aplicada.

---

## 14. Qué debe responder al viewport, al contenedor, al input y al contexto

Clasificación por superficie del **disparador correcto**, extraída del inventario.

| Debe responder a… | Superficies / tareas | Justificación desde el código |
|---|---|---|
| **Ancho del viewport** | Composición del shell: rail↔dock, panel↔hoja, presencia del chrome permanente | Es la única decisión que depende de cuánta pantalla hay en total |
| **Ancho del propio contenedor** | Results (`RES-01`, ya usa `@container results-panel (max-width:560px)`), Bulk Edit (`INS-04`, ya usa `@container` en rem), Inspector (redimensionable 280-480 por el usuario), Datasheet | **Un panel que el usuario puede redimensionar debe responder a SU ancho, no al de la ventana.** El producto ya lo hace en dos sitios; es el patrón a generalizar, no a revertir |
| **Método de entrada** | Lupa (`SEL-07`), readout de coordenadas (`CNV-05`), tamaños de objetivo, picker de solapados (`SEL-02`), pistas de gesto del badge (`CNV-06`), marco vs pan (`SEL-03`) | Ya hay tres casos implementados que deciden por `pointerType` o por `(pointer:coarse)`, no por ancho. Una tablet de 1024px es táctil aunque sea «Expanded» |
| **Selección actual** | 25 tareas (TABLA D). Ya lo hacen: edición estructural (`MOD-10`), Bulk Edit (`INS-04`), contenido del Inspector (`INS-01`), Repeat (`MOD-12`), entidad inicial del Datasheet (`DAT-01`) | La selección es única y compartida: es el contexto más barato de consultar del producto |
| **Estado del workflow** | Badge de modo (`CNV-06`), entrada rápida (`MOD-11`), preview de generación (`MOD-14`), revisión del Datasheet (`DAT-07`), preview de reparación (`DOC-05`) | Cinco superficies que ya aparecen y desaparecen con la tarea |
| **Estado del análisis** | Todo `RES-*`, `SHL-02`, `MOD-16`, `RES-05` | Nada de esto tiene sentido antes de analizar, y hoy Results reserva espacio igualmente |

**El problema medido de fondo (F-13):** 31 umbrales de breakpoint distintos en 96 bloques `@media`/`@container`, sin tokens. Es el terreno en el que ocurre F-01: con 31 umbrales repartidos, tres reglas contradictorias sobre la misma variable pasan desapercibidas.

---

## 15. Investigación competitiva

### 15.1 Nota de método — obligatoria para valorar estas fuentes

Las siete fuentes son **documentación oficial de cada producto**. En este entorno el proxy de red **bloquea el acceso directo** (`WebFetch` devuelve `EGRESS_BLOCKED` para `support.shapr3d.com`, `cad.onshape.com` y los demás dominios de fabricante). El contenido citado se obtuvo mediante la herramienta de **búsqueda web, que recuperó y resumió esas mismas páginas oficiales**. Las URL canónicas se listan para verificación manual.

**Consecuencia honesta:** las citas son fieles al contenido recuperado de las páginas oficiales, pero **no se han verificado carácter a carácter contra el HTML original**. Cualquier decisión de CRI-9 que dependa de un matiz literal de estas fuentes debe releerlas directamente.

### 15.2 Matriz competitiva

| Producto | Patrón verificado (fuente oficial) | Problema de StructureCo al que aplica | Posible aprendizaje | Qué ya hace mejor StructureCo | Riesgo de copiarlo literalmente |
|---|---|---|---|---|---|
| **Shapr3D** | La interfaz adaptativa **recomienda herramientas según lo preseleccionado**; si la herramienta buscada no está, `More` da acceso a **las demás funciones válidas para esa selección**. Documentado como forma de no estar buscando en menús. | ToolRail y TopBar cargan acciones que sólo son válidas con selección (`MOD-10` ya lo hace; `MOD-09`, `MOD-13`, `INS-02/03` no). | El desbordamiento (`More`) puede seguir **filtrado por la selección** en vez de ser un cajón plano. Es exactamente lo que el «Más» de StructureCo **no** hace hoy: sus 19 entradas no dependen de nada. | **La selección es única y compartida por cinco superficies**, y `MOD-10` ya condiciona su lanzador a `canEditSelection`. La base para lo adaptativo ya está construida. | **Creación y navegación no pueden ser contextuales**: cuando se crea, no hay selección. Un producto que sólo muestra lo válido-para-la-selección deja al usuario sin punto de partida en un lienzo vacío. El código de StructureCo ya razona esto para el generador. |
| **Onshape** | **Precision Selector**: mantener pulsado en el área gráfica muestra una retícula que se arrastra como cursor; se suelta cuando la entidad deseada queda resaltada. Motivo documentado: **el dedo tapa el objetivo**. Además, **Select Other** permite recorrer todas las entidades bajo el cursor. | `SEL-02` (picker de solapados apagado en táctil), `SEL-07` (la lupa no cubre el tap simple de selección), casos 1-3 de §10.2. | **Separar «ver bajo el dedo» de «elegir cuál»**: Onshape resuelve las dos con un solo gesto de mantener-arrastrar-soltar. StructureCo tiene la primera (lupa) y la segunda sólo con puntero (picker). | **La lupa clona el render real con `<use>`** en vez de redibujar, así que no puede desincronizarse del lienzo. Y `Select Other` de Onshape es una lista; el picker de StructureCo es lista **y** ciclado con contador. | Copiar el crosshair sin más añadiría un tercer gesto táctil a un lienzo que ya distingue tap, long-press, arrastre-pan y pinza. **La lección no es la retícula: es aceptar que la misma función necesita distinta interacción por método de entrada** — algo que `CNV-05` ya hace. |
| **Autodesk Fusion** | Capacidades agrupadas en **workspaces por propósito**, con **pestañas contextuales** que sólo se activan al invocar su comando, y **entornos contextuales** que **sustituyen** las pestañas por defecto hasta salir. | TopBar y ToolRail exponen a la vez funciones de modelar, revisar resultados, diagnosticar y configurar (§5.1, §5.2). | **Contexto antes que acumulación**, y en dos grados: aparecer *junto a* lo existente (pestaña contextual) o *sustituirlo* (entorno contextual). El segundo grado es lo que hace `DOC-05` (el preview de reparación sustituye la lista) y `DAT-07` (la revisión sustituye el panel editor). | StructureCo **no separa el modelo por fases**: se puede analizar mientras se modela y volver sin cambiar de «workspace». Esa continuidad es una ventaja real para el usuario y para Aula. | Crear «workspaces» por imitación fragmentaría un flujo que hoy es continuo, y multiplicaría el coste de ir y volver entre modelar y leer resultados —justo lo contrario de lo que necesita el bucle de aprendizaje. |
| **Dlubal RFEM 6** | **Navigator** con pestañas **Data / Display / Views / Results** (la cuarta aparece **tras calcular**). Tablas de datos **dockables**: se arrastran al espacio de trabajo y vuelven a acoplarse al borde. Tras el cálculo, los resultados se controlan gráficamente **y** por tablas, con un «Result Table Manager». | Results como panel único (§5.4); dos sistemas de visibilidad (§8.3); el Datasheet modal que hay que cerrar para enfocar (`DAT-10`). | **Separar Datos / Visualización / Vistas / Resultados como responsabilidades distintas**, y que **la pestaña de resultados aparezca tras calcular** en vez de reservar espacio antes. Y tablas que **coexisten** con el modelo en vez de taparlo. | **La procedencia por número** (`RES-10`): magnitud, objeto, caso, convención de signos y posición. No se documenta nada equivalente en RFEM. Y la tabla de StructureCo **usa la selección del workspace**, no una propia. | El árbol del Navigator y la densidad visual de RFEM son de escritorio dedicado. Copiarlos rompería Compact, donde StructureCo hoy es mejor. **Dockable ≠ mejor**: añade un modelo de ventanas que en táctil no existe. |
| **RISA-3D** | Las funciones se alcanzan por **Ribbon, Quick Access, Properties, Explorer, vista 3D y atajos** — varias puertas documentadas para lo mismo. **Las toolbars disponibles dependen de la ventana activa.** El Explorer lista las hojas de datos y, **con solución presente, añade las de resultados**. | §8.2 (validar que varias puertas son fortaleza) y §8.3 (distinguirlas del ruido). | **Que la disponibilidad de controles dependa del contexto activo** es un patrón de producto maduro, no una excentricidad. Y que las superficies de **resultados aparezcan sólo cuando hay solución** valida la pregunta de §5.4. | **Un solo `Selection` compartido y un comando `focus-object` tipado** que hace imposible pedir un foco inválido. RISA tiene muchas puertas; StructureCo tiene muchas puertas **al mismo estado**, que es más difícil y más valioso. | RISA multiplica puertas sin un criterio publicado de cuándo sobra una. StructureCo ya tiene ocho duplicaciones innecesarias (§8.3): imitar «más puertas» empeoraría exactamente eso. |
| **SkyCiv** | Los datos se introducen por **formularios, Datasheet y herramientas gráficas**; el Datasheet se abre desde el icono del propio formulario de entrada. **Repair Model** categoriza los problemas (nudos duplicados, miembros cero, miembros que se cruzan, sin datos de sección…) y ofrece **resaltar los componentes problemáticos** antes de actuar. | `DAT-01` (coherencia canvas↔Inspector↔Datasheet), `DOC-04` (localizar cierra el Doctor). | **Que el diagnóstico pueda resaltar en el modelo SIN cerrarse.** Es la diferencia entre «ir al objeto» y «ver dónde está mientras leo el hallazgo». Y **abrir la tabla desde el formulario del objeto** en vez de desde el chrome global. | **`prepareTopologyRepair` enumera lo que NO puede resolver**, lo que omite, y **detecta si el modelo cambió bajo el preview** y bloquea el aplicar. Y `finding.repair.available === false` produce «reparación ambigua», no una corrección silenciosa. | **Este es el riesgo más importante de toda la matriz.** La reparación automática que no declara sus límites contradice la política fail-closed de StructureCo. Se puede adoptar el *resaltado* de SkyCiv; **no** su disposición a arreglar sin enumerar lo dudoso. |
| **ETABS** | **Model Explorer** reúne definición/asignación de propiedades, revisión de geometría, **opciones de visualización** y **tablas de entrada y salida**. `Show Tables` las despliega en la banda inferior. En `Table Options`: **«Show Selection Only»** limita los datos a lo previamente seleccionado, y **«Show Only if Used in Model»** evita columnas irrelevantes. La base puede generar **más de 500 tipos de tabla**. | `DAT-01` (la tabla muestra todo el modelo), §8.3 (tres mecanismos de filtrado), §5.4 (datos densos dentro del chrome del lienzo). | **«Show Selection Only» es el patrón más directamente aplicable de toda la matriz**: la tabla filtrada por la selección del modelo. StructureCo ya sincroniza selección↔fila en ambos sentidos (`DAT-04`); le falta el modo «sólo lo seleccionado». Y **«Only if Used»** aplica a columnas que hoy se muestran siempre. | **Capacidad disponible desacoplada de controles visibles ya está hecha en parte**: el Datasheet es un drawer bajo demanda, no un panel residente, y sus facetas se calculan del contenido real con recuento. | ETABS acepta 500 tablas y un explorador denso como precio de la potencia. **StructureCo no debe adoptar esa complejidad como objetivo**: lo que se estudia es únicamente cómo desacopla lo *disponible* de lo *permanentemente visible*. |

### 15.3 Fuentes

- Shapr3D — Adaptive user interface: `https://support.shapr3d.com/hc/en-us/articles/7873882619548-Adaptive-user-interface` · Accessing tools: `https://support.shapr3d.com/hc/en-us/articles/7378907587484-Accessing-tools`
- Onshape — Selection: `https://cad.onshape.com/help/Content/Home/selection.htm` · Mobile touch interface: `https://cad.onshape.com/help/Content/Mobile/mobile_touch_interface_videos.htm`
- Autodesk Fusion — Workspaces: `https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GS-WORKSPACES.htm` · Fusion interface: `https://help.autodesk.com/view/fusion360/ENU/?guid=GS-THE-FUSION-INTERFACE` · Contextual environment: `https://help.autodesk.com/view/fusion360/ENU/?guid=GD-EXPLORE-WS-UI`
- Dlubal RFEM 6 — Navigator: `https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/000016` · Tables: `…/000009` · Results: `…/000364` · Views and Visibilities: `…/000073`
- RISA-3D — Main User Interface: `https://help.risa.com/risahelp/risa3d/Content/MainUI/Main-User-Interface%28.NET%29.htm` · Windows Behavior: `…/MainUI/Windows-Behavior.htm` · Explorer Panel: `…/MainUI/Explorer-Panel.htm`
- SkyCiv Structural 3D — Datasheets: `https://skyciv.com/docs/structural-3d/modelling/datasheets/` · Repair Model: `https://skyciv.com/docs/structural-3d/solving/repair-model/` · Nodes: `https://skyciv.com/docs/structural-3d/modelling/nodes/`
- ETABS (CSI) — Model Explorer: `https://docs.csiamerica.com/help-files/etabs/Keyboard_Commands_and_Special_Features/Model_Explorer.htm` · Show Tables: `…/Menus/Display/Show_Tables.htm` · Table Options: `…/Keyboard_Commands_and_Special_Features/Table_Options_form.htm`

### 15.4 Patrones que NO deben copiarse

1. **Reparación automática sin enumerar lo dudoso** (SkyCiv). Contradice fail-closed. StructureCo ya lo hace mejor.
2. **Árbol de navegación denso tipo RFEM/ETABS.** Rompería Compact, donde StructureCo es más fuerte.
3. **Workspaces por fase tipo Fusion.** Fragmentaría un flujo modelar↔analizar que hoy es continuo, y perjudicaría a Aula.
4. **Multiplicar puertas sin criterio** (RISA). StructureCo ya tiene ocho duplicaciones innecesarias.
5. **Ventanas dockables** (RFEM). Introduce un modelo de ventanas sin equivalente táctil.
6. **Estética, color, radios, sombras, motion, spacing e iconografía de cualquiera de los siete.** El Brandbook Clay manda.

---

## 16. Fortalezas actuales que la futura arquitectura NO debe perder

Ordenadas por lo que más costaría recuperar. La lista por tarea está en `report-tables.md` § TABLA I (121 entradas).

1. **Un solo `Selection` compartido por cinco superficies** (`SEL-01`). Lienzo, Inspector, Datasheet, Results y Model Doctor hablan del mismo objeto sin sincronización explícita. Es lo que hace verdad «varias puertas al mismo modelo».
2. **El Datasheet es una proyección, no un modelo paralelo** (`DAT-01`). Sin estado de entidades propio, sin historial ni undo propios.
3. **`focus-object` con carga tipada** (`RES-11`): `FocusableSelection = Extract<NonNullable<Selection>, { id: string }>` hace imposible emitir un foco inválido.
4. **`success ≠ reliable ≠ safe` implementado, probado y calibrado** (`RES-06`, `RES-05`). Con `governing` check nombrado y bloqueos declarados por nombre.
5. **La disciplina táctil bajo `(pointer:coarse)`**, con área de acierto separada del trazo dibujado (`SEL-01`, `MOD-02`).
6. **El lienzo es tabulable de verdad**, con anillo de foco propio sobre objetos SVG (`CNV-07`). Infrecuente en un editor tipo CAD.
7. **Escape como cancelación total** (`SEL-05`): siete estados limpiados en un gesto.
8. **La lupa táctil clona el render real** en vez de redibujarlo (`SEL-07`): no puede desincronizarse.
9. **El picker de solapados con lista Y ciclado con contador** (`SEL-02`). Resuelve con dos afordancias lo que Onshape resuelve con una.
10. **El canvas-budget de Compact** (63-76% al modelo) y su arquitectura de hojas: aplicación literal del Brandbook §02.
11. **Las preferencias de layout ya construidas y persistidas** (`SHL-16/17/18/19/20`), con `clamp` 280-480, detents normalizados por viewport y persistencia tolerante a fallos.
12. **El contrato borrador → plan → preview → escritura única**, en las cinco superficies que lo aplican. Y en el Datasheet, que **el preview salga de la misma función que la escritura**.
13. **La regla de cuándo aparece la revisión en el Datasheet** (`DAT-07`), que distingue el origen del borrador para no destruir el contexto del usuario.
14. **`prepareTopologyRepair` enumera lo que omite y lo que no resuelve**, y se invalida si el modelo cambió debajo (`DOC-05`).
15. **La identidad de catálogo explícita**: `materialId`/`sectionId` viajan en el comando, nunca se infieren por floats (`INS-02`, `INS-03`, `MOD-14`).
16. **La procedencia por número** con convención de signos (`RES-10`). Ningún competidor consultado documenta nada equivalente.
17. **El estado vacío de Results con siguiente paso derivado del modelo real** (`STA-01`), no un «sin datos».
18. **Model Doctor separa qué / por qué / qué hacer en tres campos del modelo** (`DOC-03`), no en un párrafo.
19. **La recuperación se escribe antes de lanzar el conflicto**, en la misma transacción (`PER-03`).
20. **No amputar funciones en Compact**: unidades, orden de análisis, combinaciones, exportación y Model Doctor siguen todos disponibles (`SHL-14`).
21. **El registro único de herramientas** que alimenta rail, dock, hoja y paleta (`MOD-01`).
22. **`canvasChromeGeometry.ts`** como concepto: separar rectángulo seguro de viewport y compartirlo entre encuadre y rótulos.
23. **La transacción del arrastre de nudo** (`CNV-08`): un arrastre = una entrada de historial, cancelable en `blur` y `visibilitychange`.
24. **Paridad i18n forzada por el sistema de tipos** (`SHL-12`).
25. **Tres preferencias del sistema honradas**: `prefers-reduced-motion` (global y por componente), `prefers-reduced-transparency`, `forced-colors` (`STA-06`).
26. **Container queries donde corresponde**: Results y Bulk Edit ya responden a su propio ancho.
27. **`ui.css` como lenguaje clay correcto** y los tiempos de motion idénticos al Brandbook §12.
28. **Cero desbordamiento horizontal** en 11 viewports × 8 flujos, sostenido por un gate real.

---

## 17. Decisiones que CRI-9 debe resolver arquitectónicamente

Lista por tarea en `report-tables.md` § TABLA G (113 entradas). Aquí, las 15 estructurales.

| # | Decisión | Origen |
|---|---|---|
| **D-01** | **¿Qué define el contrato de Medium?** 103 de 122 tareas hoy sólo repiten Expanded. Y 768×1024 recibe 78.6% de lienzo mientras 1024×768 recibe 20.3%: el salto es un acantilado, no una transición. | §7 |
| **D-02** | **¿La presencia del Inspector es contextual a la selección?** Su contenido ya lo es al 100%; su presencia cuesta 27.6% del viewport en 1024×768 y muestra un estado vacío cuando no hay selección. | `INS-01`, §12.1 |
| **D-03** | **¿Cómo se descompone Results?** Al menos cinco responsabilidades distintas (estado global, elección de evidencia, overlay de lienzo, detalle de objeto, datos densos) en 285px reservados antes de que exista un resultado. El propio panel ya tiene tres modos y cinco familias. | §5.4 |
| **D-04** | **¿Qué controla realmente el reparto por defecto?** La palanca existe (`inspectorCollapsed`, `fullCanvas`, `toolRailCompact`, ancho con `clamp`); falla el valor por defecto y una cascada con tres capas contradictorias sobre `--toolbar-w` más un inline en `AppShellLayout.tsx:48` que gana a `:root`. | F-01, `SHL-16/17/18/19` |
| **D-05** | **¿Qué decide por viewport, qué por contenedor, qué por input y qué por contexto?** Hay 31 umbrales en 96 bloques sin tokens, y tres casos que ya deciden bien por `pointerType`. Una tablet de 1024px es táctil aunque el ancho diga «Expanded». | §14, F-13 |
| **D-06** | **¿Se enruta el picker de solapados al táctil, o se amplía la lupa a la selección simple?** El mejor mecanismo de precisión está apagado en el método de entrada que más lo necesita. | `SEL-02`, `SEL-07`, §10.3 |
| **D-07** | **¿Cuál es la ruta táctil de marco / copiar / pegar / duplicar / repetir?** Cinco tareas sin equivalente táctil. Es un hueco de paridad funcional entre métodos de entrada — la tarea existe para puntero y no tiene ruta equivalente para dedo — que CRI-9 debe resolver antes de que pueda considerarse cerrada la restricción de no crear una versión funcional separada por dispositivo. | `SEL-03`, `MOD-13`, `MOD-12`, `DAT-06`, §6.3 |
| **D-08** | **¿Cómo se resuelve un conflicto sin salir de la mesa?** El estado se anuncia en el TopBar; la restauración vive en otra pantalla. Es el hueco de acceso más grave. | `PER-03`, `ENT-09` |
| **D-09** | **¿Qué es el menú «Más» — desbordamiento contextual o cajón de utilidades?** Hoy mezcla 19 entradas de siete naturalezas, con Deshacer junto a idioma. | §5.1, F-06 |
| **D-10** | **¿Cuál es el único sistema de visibilidad del lienzo?** Hoy hay dos: 9 capas + 5 presets sobre el lienzo, y 8 interruptores `show*` en Inspector › Vista. No está verificado qué gana si se contradicen. | `CNV-03` vs `INS-06`, §8.3 |
| **D-11** | **¿El Datasheet es destino modal o vista coordinada?** Hoy enfocar un objeto **exige cerrarlo**. RFEM y ETABS acoplan; ETABS además filtra la tabla por la selección («Show Selection Only»). | `DAT-10`, §15.2 |
| **D-12** | **¿Una ficha de propiedades o tres?** Inspector, `DatasheetEditorPanel` y Bulk Edit son tres interfaces para leer y escribir el mismo objeto. | §8.3 |
| **D-13** | **¿Un contrato de borrador/preview/aplicar o cinco?** Cinco implementaciones del mismo patrón, todas correctas, ninguna compartida. | `DAT-07`, `INS-04`, `MOD-10`, `MOD-14`, `DOC-05` |
| **D-14** | **¿Cómo se explica un control deshabilitado por una ruta que exista en táctil?** El `title` de la causa gobernante de fiabilidad no existe sin ratón, y es la información más crítica del producto. | `RES-06`, `STA-05` |
| **D-15** | **¿Space 3D hereda el sistema de CRI-9 o queda congelado hasta salir de experimental?** Hoy duplica la resolución de tema y tiene breakpoints y mínimos táctiles propios. **No se exige paridad 2D↔3D.** | `S3D-01`, CRI-7 §8 |

**Además, tres cosas que CRI-9 debe decidir sin que sean arquitectura de layout:**

- **G-01**: implementar `Ctrl+Z`/`Ctrl+Y`, o retirar la promesa de la paleta.
- **G-02**: dar pestaña a `resultTab: 'issues'` o retirarlo del tipo.
- **F-11** (heredado de CRI-7): **requiere decisión del propietario**, no investigación. Es el único caso donde el propio Brandbook nombra tres valores en pugna (`#159a72`, `#00795f`, `#157A55`) y pide elegir uno — y hoy manda un cuarto (`#087e5c`).

---

## 18. Patrones que CRI-10 debe diseñar bajo autoridad del Brandbook

Lista por tarea en `report-tables.md` § TABLA H (106 entradas). Familias funcionales que necesitan un patrón unificado:

| # | Patrón | Por qué |
|---|---|---|
| **P-01** | **Una sola gramática de estado activo.** Hoy el botón de rail lleva `sc-tool-button.is-active` (hundido, Clay) **y** `.tool-button.active` (teñido, legacy) a la vez. | F-04, §1.1 |
| **P-02** | **Escala de estados unificada.** `StatusStrip` ya define seis tonos con `role` y `aria-live` correctos y no lo consumen todas las superficies. | `STA-02` |
| **P-03** | **Fiabilidad y estado de análisis con forma además de color**, y su explicación alcanzable sin `title`. | `RES-06`, `SHL-02` |
| **P-04** | **Suelo tipográfico para datos de ingeniería y avisos legales.** Hoy: valores del solver a 10px, diagrama a 10px, nota legal a 10px, «Modo de cálculo» a 8px, rótulo de carga a 8px. | F-03, §13 |
| **P-05** | **Densidad de datos ≠ densidad de controles.** La tabla puede ser densa; su casilla no puede medir 13×13. | F-02, §13 |
| **P-06** | **Escala de radios reconciliada con el Brandbook §06** (6/8/13/18/26). Hoy 10 radios en pantalla, 7 fuera de escala, y falta el peldaño de 18. | F-09 |
| **P-07** | **Iconografía con tamaños y trazo únicos.** 285 usos con 14 tamaños literales y dos pesos (1.8 técnico vs 2.0 por defecto de lucide). | F-10 |
| **P-08** | **Paleta técnica única entre temas**, recalibrada sólo en luminosidad. | F-12 |
| **P-09** | **Un solo verde de marca** en token, favicon y manifest. **Requiere decisión previa del propietario.** | F-11 |
| **P-10** | **Panel de capas + ajustes de vista como un solo patrón.** | D-10 |
| **P-11** | **Chip de estado vs chip accionable.** Los `canvas-view-chips` informan de snap/rejilla y no dejan cambiarlos. | `CNV-04` |
| **P-12** | **Hoja con detents que responda también al arrastre del tirador**, no sólo a tres botones. | `SHL-20` |
| **P-13** | **Estado vacío con siguiente paso**, generalizando el de Results a todas las superficies. | `STA-01` |
| **P-14** | **Tarjeta de hallazgo / error con qué-por qué-qué hacer**, generalizando el modelo de Model Doctor. | `DOC-03`, `STA-04` |
| **P-15** | **Tarjeta de procedencia legible.** Es la función más distintiva del producto y hoy va a tipografía pequeña. | `RES-10` |
| **P-16** | **Picker de candidatos que no tape el punto que se intenta acertar.** | `SEL-02` |
| **P-17** | **Lente táctil bajo Brandbook**: borde, sombra, retícula. | `SEL-07` |
| **P-18** | **Chip de faceta con recuento**, unificando Datasheet, filtros de plantilla de Welcome y filtros de severidad de Model Doctor. | `DAT-03`, `ENT-05`, `DOC-02` |
| **P-19** | **Lanzador con recuento de severidad.** Model Doctor ya calcula los hallazgos para el toast y su botón no lo dice. | `SHL-14` |
| **P-20** | **Acción destructiva con deshacer inmediato accesible**, no sólo atenuación. | `MOD-09` |
| **P-21** | **Símbolos estructurales legibles a densidad alta**: carga puntual, distribuida, momento, apoyo, cota, corte, deformada. | `MOD-05..08`, `MOD-15/16` |
| **P-22** | **Marcado de «experimental»** para Space 3D. | `S3D-01` |
| **P-23** | **Tokens de breakpoint**, para que 31 umbrales no vuelvan a esconder una regla contradictoria. | F-13, D-05 |

---

## 19. Unknowns e inferencias que quedan abiertos

**98 de 122 filas declaran al menos un unknown** (tabla completa en `report-tables.md` § TABLA F). Los que condicionan decisiones:

### 19.1 Unknowns que CRI-9 necesita resolver antes de decidir

| # | Unknown | Por qué bloquea |
|---|---|---|
| U-01 | **No hay telemetría: ninguna frecuencia está medida.** 86 de 122 filas la infieren. | Cualquier decisión de «esto se usa poco, va al cajón» carece hoy de base. |
| U-02 | **Cuánto tiempo de sesión transcurre sin selección.** | Determina si el Inspector puede ser contextual (D-02). |
| U-03 | **Ruta táctil de Repeat (`MOD-12`)**: no se verificó que exista alguna independiente del teclado. | D-07. |
| U-04 | **Si el tap acumula o reemplaza en táctil** (`SEL-01`, `SEL-04`). | Determina si hay multiselección táctil en el lienzo. |
| U-05 | **Qué gana si las capas del lienzo y los `show*` del Inspector se contradicen.** | D-10. |
| U-06 | **Comportamiento del overlay de resultados cuando el análisis está obsoleto** (`STA-03`). | Riesgo de mostrar evidencia caducada sobre el modelo. |
| U-07 | **Rendimiento del Datasheet y de la paleta con modelos grandes** (el generador admite hasta 2 000 entidades). | Determina si «lista de objetos» escala como ruta de precisión. |
| U-08 | **Interactividad del minimapa** (`CNV-02`): no verificada por teclado ni por tap. | Determina si su coste de 144px compra algo más que orientación. |
| U-09 | **Qué se conserva al ir y volver entre 2D y Space 3D** (`S3D-01`). | D-15. **No se inventa nada al respecto.** |
| U-10 | **Si localStorage (proyecto vivo) e IndexedDB (hub) pueden divergir**, y cuál manda. | D-08 y `PER-01`. |

### 19.2 Inferencias declaradas que NO deben leerse como hechos

- Toda frecuencia marcada `inferencia` (86 filas).
- «El usuario no encuentra X» — en ningún caso se ha observado a un usuario. Lo verificado es la **profundidad de la ruta**, no la tasa de éxito.
- La clasificación UX propuesta es un **argumento sobre naturaleza**, no un resultado experimental. CRI-9 puede refutarla con datos.

### 19.3 Pendientes heredados de CRI-7, no cubiertos aquí

Contraste medido por píxel; prueba con lectores de pantalla reales; barrido continuo de anchuras entre 320 y 1920 buscando más reglas contradictorias del tipo F-01.

---

## 20. Cierre — la pregunta de CRI-8, respondida

El criterio de cierre exige que, para **cualquier** capacidad real, se pueda responder sin ambigüedad a diez preguntas. Ejemplo completo con `INS-03` (cambiar la sección de una barra), leído directamente del inventario:

1. **Qué tarea resuelve** — dar propiedades reales de perfil a un miembro.
2. **Dónde y cómo existe hoy** — `SectionPresetSelector` + `SectionViewer2D` en el Inspector; comando `member.section.apply` con `sectionId` explícito (`InspectorProperties.tsx`, `standardSections.ts`).
3. **Qué contexto la vuelve relevante** — un `member` seleccionado.
4. **Frecuencia y certeza** — alta, **inferencia** (no medida).
5. **Rutas actuales y cuáles son duplicaciones legítimas** — Inspector (individual), Datasheet (tabular), Bulk Edit (masiva), generadores (lote). **Las cuatro emiten el mismo comando**: duplicación legítima al 100%.
6. **Cómo sigue siendo accesible en Expanded / Medium / Compact** — panel, panel, hoja Inspector. En las tres, la misma operación.
7. **Qué cambia por input** — nada en la lógica; en Compact la previsualización de sección compite por altura dentro de la hoja.
8. **Clasificación UX** — 3 Contextual a selección + 5 Inspector/detail.
9. **Qué finding justifica replantearla / qué fortaleza obliga a preservarla** — F-01 (el panel que la aloja cuesta 27.6% del viewport); la fortaleza intocable es el **`sectionId` explícito**, que nunca se infiere por floats.
10. **Qué decide CRI-9 y qué diseña CRI-10** — D-02 (presencia contextual del Inspector) y P-15/P-05 (legibilidad y densidad del visor de sección).

**Las 122 filas responden a las diez preguntas.** Las que no pueden responder alguna la declaran como `unknown` en vez de rellenarla.

---

## Archivos añadidos por esta rama

```
reports/2026-08-15-0130-cri-8-mapa-maestro-ux.md                        (este informe)
reports/evidence/2026-08-15-cri-8-ux-map/build-inventory.mjs            (generador reproducible)
reports/evidence/2026-08-15-cri-8-ux-map/build-report-tables.mjs        (generador de tablas del informe)
reports/evidence/2026-08-15-cri-8-ux-map/data/01-entry.mjs              (15 tareas)
reports/evidence/2026-08-15-cri-8-ux-map/data/02-shell.mjs              (24 tareas)
reports/evidence/2026-08-15-cri-8-ux-map/data/03-modelling.mjs          (16 tareas)
reports/evidence/2026-08-15-cri-8-ux-map/data/04-selection-canvas.mjs   (17 tareas)
reports/evidence/2026-08-15-cri-8-ux-map/data/05-inspector-results.mjs  (18 tareas)
reports/evidence/2026-08-15-cri-8-ux-map/data/06-datasheet-doctor.mjs   (17 tareas)
reports/evidence/2026-08-15-cri-8-ux-map/data/07-persistence-states.mjs (15 tareas)
reports/evidence/2026-08-15-cri-8-ux-map/cri-8-task-inventory.json      (122 filas × 33 columnas)
reports/evidence/2026-08-15-cri-8-ux-map/cri-8-task-inventory.csv       (mismo contenido, hoja de cálculo)
reports/evidence/2026-08-15-cri-8-ux-map/cri-8-ux-classification.json   (clasificación UX con IDs)
reports/evidence/2026-08-15-cri-8-ux-map/matrix-fragment.md             (matriz por dominio, Expanded/Medium/Compact)
reports/evidence/2026-08-15-cri-8-ux-map/report-tables.md               (tablas B-I exhaustivas)
```

**Ningún archivo de producción fue modificado.** Sin cambios en `src/**`, `package.json`, gates, CSS, tokens, componentes ni documentación canónica. No se ha hecho merge a `main` ni publicación en Pages.

## Cómo verificar

```bash
# 1. Baseline: el árbol de producto es idéntico al que auditó CRI-7
git diff --stat b121c03dd307dcdbc7bdea96172222ed8eacddfe e9a406a -- src/ package.json   # vacío

# 2. Esta rama no toca producción
git diff --stat e9a406a -- . | grep -v '^ reports/'                                      # vacío

# 3. El inventario es reproducible desde su fuente
node reports/evidence/2026-08-15-cri-8-ux-map/build-inventory.mjs
node reports/evidence/2026-08-15-cri-8-ux-map/build-report-tables.mjs
git diff --stat reports/evidence/2026-08-15-cri-8-ux-map/                                 # vacío tras regenerar
```

Los generadores validan que ninguna fila tenga columnas ausentes y que no haya IDs duplicados; fallan con código 1 si las hay. No requieren `npm install` ni build de la app: no leen nada de `src/**`.

## Pendientes declarados

- **U-01 a U-10** de §19.1 — condicionan decisiones concretas de CRI-9.
- **F-11** sigue esperando decisión del propietario del repositorio (único caso donde el Brandbook deja la elección abierta).
- Los pendientes de CRI-7 §«Pendientes declarados» siguen abiertos y no se cubrieron aquí.
