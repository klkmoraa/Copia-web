# CRI-12C · Registro de dirección visual

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `research/cri-12-direction` · **HEAD de partida:** `066eaa1ee8dc11ad8b787ddb43ef6d6a5e5a1744` (cierre de CRI-12B)
**Baseline de `main` verificado:** `7fb927fb6d118925e63365d1a2bb2813f8795385` — **drift: ninguno.** `origin/main` está exactamente en ese commit; no hay cambios desde el baseline que CRI-12A registró.

Cierra CRI-12C: **cómo debe verse y sentirse structureCo**. No implementa nada. Cero cambios en `src/**`, `brand/**` y `src/design-system/tokens.css`. Su destinatario es CRI-12D, que convierte esto en tareas reales sin reinterpretar el diseño.

---

## 0. Qué NO reabre este documento

CRI-12B cerró la arquitectura UX. Nada de lo siguiente se toca aquí, ni implícitamente: navegación, clases Expanded/Medium/Compact, contrato de selección de 5 fases, descomposición de Results en cuatro dueños, surface ownership (18 superficies, un dueño cada una), el vocabulario de presentación `band`/`dock`/`inset`/`sheet`/`drawer`/`fullscreen`/`overlay`/`floating` y su matriz, Datasheet modal+`peek`, Model Doctor, Command Palette, continuity T-INV-1…8, el contrato de comportamiento de motion y los 11 contratos de accesibilidad de interacción.

Este documento decide **materia, color, jerarquía visual y tacto**. Cuando toca una superficie, decide de qué está hecha — nunca dónde aparece ni quién la asigna. Esa sigue siendo competencia del resolutor (R-3).

## 1. Gobierno del PDF de referencias

`StructureCo_CRI12C_referencias_visuales.pdf` (10 boards) se trató **estrictamente como REFERENCE**. Se extrajo de él materialidad, tactilidad, proporción, profundidad, ritmo, jerarquía, relación canvas/sheet/panel, tratamiento Día/Noche y sensación premium-cálida-técnica. **No** se extrajo ubicación de botones, navegación, funciones, 3D, matemáticas, valores, claims, HEX, nombres de fuentes, estados estructurales ni copy.

Inventario de boards, para que CRI-12D no tenga que reabrirlo:

| Board | Qué es | Qué se tomó | Qué se descartó |
|---|---|---|---|
| 01 · Móvil Día · Resultados clave | 4 pantallas: proyectos + N/V/M | Placa de metadatos plana bajo el diagrama (Longitud · Convención · Unidades); lista de recientes con barra de color a la izquierda; diagrama plano sobre chrome cálido | Copy `Análisis OK`; el sello inferior de confianza; cardificación de todos los valores |
| 02 · Móvil Día · Flujo de trabajo | Welcome, deformada, resumen, anotaciones | Welcome con marca contenida y proyectos primero; piezas clay como materia física; Results como hoja sobre lienzo visible | Copy `Confiabilidad limitada` como etiqueta cerrada de producto; layout de anotaciones (es función, no visual) |
| 03 · Desktop Día · Inicio y overview | Dashboard + 3 workspaces | Ritmo de escritorio: lienzo dominante, panel de resultados estrecho a la derecha, riel estrecho a la izquierda; densidad de la tabla inferior | Ubicación concreta de controles; hero editorial a media pantalla |
| 04 · Desktop Día · Análisis y resultados | 4 variantes de workspace | Tratamiento plano del Datasheet; separación tarjeta-de-extremo vs tabla | **Todo el bloque de "Verificación global · Cumple con los criterios de diseño" + escudo + `Utilización máxima 66.7% OK`** — afirma seguridad desde un resultado; renders 3D fotorrealistas |
| 05 · Móvil Noche · Core screens | 4 pantallas nocturnas | Que Noche conserva material y jerarquía de Día, no invierte | Fondo casi negro; **halo verde ambiental alrededor de tarjetas y teléfono**; copy `Controlado` |
| 06 · Desktop Noche · Workspace y dashboard | 4 vistas nocturnas | Que la tabla densa sigue siendo tabla en Noche; separación base/superficie/superficie-alt/borde en cuatro escalones | Check verde `OK` por fila de la tabla; glow en tarjetas |
| 07 · Responsive system · Día y noche | Matriz 2×2 dispositivo × tema | Mobile y desktop como **estrategias hermanas**, mismo lenguaje y misma lógica | Nombres de fuente (`DM Serif Display`, `Inter`); leyenda de estados como taxonomía |
| 08 · Brandbook 01 · Fundamentos | Lámina de fundamentos | Principios de calma técnica y precisión visible como *sensación*, no como texto | `Fraunces` + `Inter`; **cortante = verde de marca (mismo HEX)** — rompe la separación marca/técnico; escala de sombras casi plana; HEX de paleta |
| 09 · Guía de marca | Lámina de sistema | **Gramática BASE/INSET/RAISED/FLOATING/SHEET/MODAL**; **la frase "Clay para el cascarón. Plano y exacto para la ingeniería"**; confirmación de IBM Plex Sans + Mono | HEX de paleta; grosor de icono 2px (el canon es 1.8, LEDGER-09); escala de radios propia |
| 10 · Brandbook 03 · Aplicación | Aplicación y do/don't | La idea de que el área bajo la línea es un tinte del trazo, no un segundo color; ejes y rejillas en neutros | Copy `No conforme`, `Análisis OK`, `Requiere revisión` como estados de producto; tono de voz |

**Contradicciones internas del PDF, resueltas a favor del canon:** Board 08 propone `Fraunces + Inter` y Board 09 propone `IBM Plex Sans + Mono` en el mismo paquete. Manda Plex. Board 08 pinta cortante con el verde de marca; el sistema exige que marca y roles técnicos no compartan HEX. Manda el sistema.

## 2. Decisiones cerradas

Todas las de esta sección se tomaron **en conversación directa con el propietario del producto**, en bloques de ≤3 preguntas con opciones y recomendación explícita. Las marcadas `DERIVADA` no se preguntaron: se dedujeron del Brandbook vigente + CRI-12B + las decisiones humanas de esta sesión, porque no abrían dos direcciones de producto distintas.

### V-01 · Carácter visual — `CERRADA`

> **Instrumento Clay de precisión sobre una mesa técnica cálida.**

Se cierra **verbatim**, sin añadidos. Se evaluó contra los ocho atributos exigidos y los cubre sin ampliarse: *instrumento* aporta preciso y técnico; *Clay* aporta táctil y amigable; *de precisión* aporta premium; *mesa técnica cálida* aporta cálido y sereno; el conjunto es reconociblemente structureCo porque nombra a la vez el material del cascarón y la naturaleza plana de la mesa. Se rechazaron variantes que añadían "sereno" o "amigable" como adjetivos: la frase pierde filo y el atributo ya está en el sustantivo.

Lo que la frase excluye, y por qué está en ella: *instrumento* excluye el dashboard SaaS genérico; *Clay* excluye el CAD gris; *de precisión* excluye el neumorfismo blando de juguete; *mesa técnica* excluye glassmorphism, neón y profundidad decorativa sobre datos.

### V-02 · Regla Clay / plano — `CERRADA`

> **Clay para el cascarón. Plano y exacto para la ingeniería.**

Coincide literalmente con Board 09 §8 y con el §02 del Brandbook vigente (*"Clay sólo donde ayuda a entender y operar"*). No es una desviación: es el mismo contrato, con nombre.

Consecuencias operativas, no negociables:

1. **La profundidad indica agrupación e interacción. Nunca indica verdad del resultado.** Una tarjeta no sube porque el número sea bueno. Un valor no se eleva porque converja.
2. **Canvas, geometría, rejillas, diagramas, Datasheet, tablas, unidades y datos comparables son planos.** Sin sombra clay, sin canto de volumen, sin gradiente. Su jerarquía la llevan el trazo, el espaciado y la tipografía.
3. El chrome que flota *sobre* el lienzo (badge de modo, chips, zoom, leyenda, quick-entry) sí es materia — relleno opaco y canto medido, nunca vidrio — pero no toca el dibujo ni sus colores.
4. La frontera es de **superficie**, no de módulo: dentro de un panel Clay, una tabla sigue siendo plana. El contenedor tiene materia; el contenido técnico no.

### V-03 · Gramática de superficies — `CERRADA`

Se adopta **BASE / INSET / RAISED / FLOATING / SHEET / MODAL** (origen: Board 09 §5, ya parcialmente implementada en `src/design-system/material.css` como `data-level`).

**Aviso de colisión de nombres, resuelto:** esta gramática es de **materia** (de qué está hecha una superficie). El vocabulario cerrado en CRI-9 §11 y confirmado en CRI-12B §6.10 es de **presentación** (dónde aparece y quién la asigna). Tres nombres coinciden — `inset`, `sheet`, `floating` — con significados distintos. Convención obligatoria a partir de aquí: **materia en MAYÚSCULAS**, **presentación en `minúsculas de código`**. Los dos ejes son ortogonales y ninguno sustituye al otro; la tabla de correspondencia está en `03-surface-grammar.md`.

### V-04 · Intensidad Clay — `CERRADA` (elección: punto medio con canto firme)

Ni el clay marcado de hoy sin disciplina, ni la casi-planitud del Board 08. El acuerdo:

- **El canto de 1px es obligatorio y siempre visible** en RAISED, FLOATING, SHEET y MODAL. Es lo único que separa Clay de neumorfismo blando: sin canto, una pieza no se apoya sobre el fondo, *emerge* de él.
- **Una sola fuente de luz para todo el sistema**, fija, arriba-izquierda. Ningún componente declara la suya.
- **Pressed invierte la luz y elimina toda sombra exterior.** Una sombra exterior en estado pulsado devuelve la pieza a "flotando" y destruye la lectura.
- **La profundidad escala con el tamaño de la pieza**, no con su importancia: piezas pequeñas usan el escalón bajo, paneles el medio, flotantes el alto.
- **Prohibido**: desenfoque mayor que el radio de la pieza; opacidad de sombra que lea como halo; sombra de color como resplandor exterior; dos elevaciones anidadas sin cambio de nivel entre ellas.
- El hundimiento físico al pulsar sigue siendo **un solo token** para todo el sistema, y `prefers-reduced-motion` lo anula de una vez: **el relieve permanece, el desplazamiento se retira**.

### V-05 · Radios — `DERIVADA` (sin desviación nueva)

LEDGER-01 ya está cerrado: alinear a la escala del Brandbook al implementar. Aquí sólo se fija el **reparto por rol**, que es la parte visual:

| Rol | Radio | Por qué |
|---|---|---|
| Datos: tablas, celdas, filas del inspector, campos numéricos | escalón 1–2 (el más cerrado) | Redondear una rejilla de datos la hace más difícil de escanear, no más amable. Regla ya presente en `tokens.css`. |
| Controles: botones, chips, selects, segmentos | escalón 3 | El Brandbook fija que por debajo de ese escalón el volumen deja de leerse: la sombra necesita curva para envolver el canto. |
| Tarjetas y paneles | escalón 4 | |
| Sheets, modales, hero | escalón 5 | |
| Pills y badges | pill | |

Los valores concretos de la escala los fija el Brandbook, no este documento. Los radios actuales de `tokens.css` están fuera de esa escala — es exactamente la desviación que LEDGER-01 ya gobierna, y no se abre ninguna nueva.

**Espaciado y bordes**, también derivados y sin desviación nueva, en `03-surface-grammar.md` §5b: base 4px vigente (Board 08 propone base 8 y pierde), el aire entre grupos y no entre filas, tres densidades de fila, la interfaz de trabajo que no crece con la ventana; y para bordes, 1px por defecto con el canto obligatorio de V-04, 2px reservado a énfasis estructural, y divisores de tabla como trazo fino y nunca como elevación.

### V-06 · Tipografía — `CERRADA`

**Vigente, sin cambio: IBM Plex Sans + IBM Plex Mono.** Board 09 lo confirma; Board 08 lo contradice y pierde. `Fraunces`, `Inter` y `DM Serif Display` aparecen dibujados en el PDF y **no se adoptan**: aparecer en una referencia no es una decisión.

**Se abre una decisión futura, sin acotar** (elección explícita del propietario, tras proponerle yo la versión acotada a Welcome): evaluar un serif editorial para **titulares** de toda la aplicación, no sólo Welcome.

Esa decisión futura nace con dos límites duros, que no son de gusto:

1. **Ningún serif puede llegar a valores numéricos, unidades, tablas, etiquetas del lienzo ni al Datasheet.** Ahí manda Plex Mono por alineación tabular y por cifras de altura constante. La decisión futura cubre titulares; los datos no entran en su alcance.
2. **Debe resolver antes la entrega local-first.** El sistema no puede pedir una fuente a la red; hoy la tipografía se apoya en familias locales por diseño. Sin una respuesta a eso, la decisión no puede cerrarse aunque se apruebe estéticamente.

LEDGER-03 sigue vigente y no lo toca esta fase: los valores del solver nunca viven en el escalón de caption.

### V-07 · Identidad cromática: menta/esmeralda vs lima — `CERRADA` → **MENTA/ESMERALDA**

Detalle completo, incluidas las mediciones pendientes, en `03-color-decision.md`. Resumen:

- **Gana menta/esmeralda.** Manda identidad **y** acción primaria: botón primario, chips activos, riel, marca dibujada, Welcome.
- **La lima no se retira del sistema: cambia de trabajo.** Pasa a ser el color técnico de **cortante (V)** — decisión explícita del propietario, más amplia que "sólo identidad".
- **Nada de esto se implementa aquí.** Es una desviación futura del Brandbook y de la paleta técnica, con su propio gate de remedición.

### V-08 · Colores técnicos — `CERRADA` (con gates de medición abiertos)

Cambios decididos, todos futuros:

| Rol | Hoy | Decisión de 12C |
|---|---|---|
| Marca | lima | Familia **menta/esmeralda**; puede dibujarse y rellenar |
| Cortante V (y carga distribuida, que lo aliasa) | esmeralda | Familia **lima**: trazo con la lima profunda, área con su tinte |
| Línea de influencia | tinta de marca | **Rosa/fucsia pastel vivo** — área pastel + canto del mismo tono bajado a la franja legible + **trazo siempre discontinuo** |
| Snap y hover sobre el lienzo | tinta de marca | Siguen al nuevo trazo de marca (menta) |
| N/axial, M/momento, deformada, reacción, cota, eje, error, aviso, canario, éxito, Aula | — | **Sin cambio** |

**Por qué la influencia puede ser pastel y los demás roles técnicos no.** La regla del sistema es que un rol técnico dibujado como trazo tiene que llegar a 3:1 sobre los cuatro fondos con un solo HEX, y el pastel queda fuera de esa franja por definición. El mecanismo que sí lo permite ya existe en el Brandbook y es el del CTA: **el pastel vive en el relleno; el canto lleva el mismo tono bajado a la franja legible.** La línea de influencia se dibuja con esa misma anatomía. El pastel es superficie, nunca trazo.

**Los colores N/V/M/deformada conservan significado técnico y no se convierten en decoración del chrome.** Ninguno de estos cambios los mueve al cascarón; la reasignación de la lima es de identidad→técnico, nunca al revés.

### V-09 · Día / Noche — `CERRADA` (elección: mantener el suelo actual)

- **Noche conserva el suelo vigente**: grafito frío profundo, nunca negro puro. El Board 05 baja a casi negro y tiene que compensar la pérdida de relieve con un halo verde ambiental — ese halo es exactamente lo que se rechaza.
- **Mismo material y misma jerarquía que Día.** Noche no es una inversión: cada rol se reasigna a mano y la materia se vuelve a medir entera.
- **En Noche la sombra pierde trabajo y el canto lo gana.** No queda luz que quitar; sin canto visible los paneles se funden con el fondo. La luz interior es un velo de marca muy tenue, nunca blanco puro — el blanco puro sobre grafito lee como arañazo.
- **El resplandor de marca se mantiene anulado en Noche.** Glow no es elevación y nunca es selección.
- Se toma del Board 09 §3 una sola idea estructural: que Noche necesita **cuatro escalones distinguibles** — base, superficie, superficie alternativa y canto — y no dos.
- Rechazado: negro puro, neón, glass, `backdrop-filter` por fila.
- LEDGER-05 (remedición de contraste del pórtico en Noche) **sigue abierto**: se documenta, no se cambia sin volver a medir. Esta fase no lo mide.

### V-10 · Results — `CERRADA` (elección: tarjetas hasta donde el contrato deja)

**Van en tarjeta Clay:** resumen, extremos (máximo, mínimo, valor en extremo libre), detalle del objeto, procedencia del número, reacciones, estado del análisis y fiabilidad.

**No van en tarjeta, por contrato cerrado de CRI-9/CRI-12B que esta fase visual no puede reabrir:** la rejilla del **Datasheet** (D-11) y la **tabla densa por posición** de la superficie `dense` (D-03). Ahí la tarjeta sigue existiendo como **contenedor**; el contenido va plano dentro. Nada queda sin vestir.

Guardas duras sobre las tarjetas, todas derivadas de `success ≠ reliable ≠ safe`:

1. **Una tarjeta nunca cambia de nivel, de color ni de elevación para decir que un resultado es bueno.** Elevación = agrupación e interacción, punto.
2. **Valor, unidad, posición, fiabilidad y procedencia siguen legibles en los dos registros** — tarjeta y tabla. Cardificar no puede costar ninguno de los cinco.
3. **La fiabilidad es una línea propia, nunca un color aplicado sobre el valor.**
4. **Copy prohibido en cualquier tarjeta de resultado**: `Análisis OK`, `Controlado`, `Cumple con los criterios de diseño`, `Verificación global`, `No conforme`, y cualquier porcentaje acompañado de un `OK`. Todos aparecen dibujados en los Boards 04, 05, 06 y 10; todos afirman seguridad o cumplimiento desde un resultado numérico.
5. **El check verde por fila del Board 06 (panel 4) queda rechazado explícitamente.** Una fila de tabla no dictamina.

Se registra hacia CRI-12D, **como petición abierta y no como decisión**, la posibilidad de llevar tarjetas también al Datasheet y a las tablas densas: exige reabrir D-11 y la descomposición de Results, que es arquitectura.

### V-11 · Welcome — `CERRADA` (elección: marca presente, proyectos primero)

- Wordmark y **una** línea de marca arriba. La pieza clay isométrica **acompaña en una esquina**; no es héroe a media pantalla.
- **El peso visual va a continuar / nuevo proyecto / recientes.** Lo primero que se puede tocar es el trabajo propio.
- No es landing de marketing: sin titular editorial a dos líneas, sin ilustración a media pantalla, sin doble llamada compitiendo. Los Boards 03, 06 y 10 muestran esa versión y **no se adopta**.
- La estructura de 4 pasos del flujo de Welcome ya la cerró CRI-12B (#2) y **no se toca**: esto viste esa estructura, no la cambia.

**Tratamiento del portal (`DERIVADA`, era la pregunta 13 del HANDOFF de 12A).** Se **aprueba con alcance recortado** el "material clay" vía filtros SVG que propuso CRI-10 — grano, caída por cara, oclusión, luz de borde — con tres límites: (a) aplica **sólo a la pieza ilustrativa**, que es un rol de ilustración, nunca a superficies de interfaz; (b) **no es un motor 3D** y sigue rechazándolo explícitamente; (c) **degrada a relleno plano** cuando los filtros no estén disponibles, y bajo `prefers-reduced-motion` / `prefers-reduced-transparency`. Se aprueba porque la elección de Welcome reduce la pieza a una esquina: a ese tamaño el coste es acotado y el beneficio de materialidad se conserva.

**Se conserva sin cambios la restricción heredada de la placa técnica ilustrativa**: si en implementación pasa a leer datos reales, los lee de verdad o no se muestra.

### V-12 · Iconografía — `DERIVADA`

- Trazo lineal, **grosor 1.8**, terminales redondeadas. Board 09 propone 2px; **LEDGER-09 ya cerró 1.8** y gana.
- **Glifos de UI genérica** (cancelar, deshacer, ajustes) en `currentColor`: neutros, siguen al texto.
- **Glifos que representan un resultado técnico** (axial, cortante, momento, deformada) llevan el color de su rol en la paleta técnica, para que se reconozcan por color antes de leer la etiqueta.
- **En estado seleccionado sobre relleno de marca, el glifo pasa a la tinta medida de ese relleno** — la selección manda sobre el color semántico. Con la marca en menta, cuál es esa tinta (blanca o profunda) **es una medición pendiente**, no un supuesto: depende de si la menta aguanta blanco a 4,5:1.
- **Un icono nunca porta significado solo**: siempre etiqueta o nombre accesible.
- **El mark (hexágono + «S») es geometría fija**: sin clay, sin volumen, sin recoloreado, sin animación. Regla del Brandbook §03, intacta.
- Iconos del chrome sobre lienzo: relleno opaco y canto medido, **nunca vidrio**.

### V-13 · Motion — `DERIVADA` (el contrato de comportamiento ya estaba cerrado)

CRI-12B §6.12 cerró **cuándo y qué anima**, y ya está implementado. Esta fase sólo añade la capa visual:

- **Lo que anima en Clay es la elevación y el hundimiento**, no el color de un rol técnico. Un diagrama nunca cambia de color con una transición.
- Reparto por escalón: el pulsado aplana la arcilla; el rápido gobierna hover, chips y cruce de capas de evidencia; el estándar gobierna paneles, tarjetas e INSET; el lento gobierna sheets, drawers, segmentado y cambio de tema.
- **La geometría del modelo no se interpola nunca.** Se anima la cámara, porque ahí el movimiento *es* la información. El pan y el zoom del usuario son instantáneos.
- **Sin movimiento ambiental**: nada late, nada respira, nada brilla en bucle. No hay animación sobre el lienzo que no sea cámara.
- `prefers-reduced-motion` colapsa duraciones y anula el hundimiento: **el relieve permanece, el movimiento se retira, la función nunca**.

### V-14 · Accesibilidad visual — `DERIVADA`

- **Suelos de contraste**: ≥3:1 no textual para todo rol técnico y de estado, medido sobre los **cuatro** fondos (lienzo y superficie × Día y Noche); ≥4,5:1 para texto. Ningún HEX nuevo entra sin esa medición.
- **Ningún significado depende sólo del color.** Forma (continuo/discontinuo), icono o etiqueta acompañan siempre. El caso vivo de esta fase es la línea de influencia: **siempre discontinua**, frente a la deformada que es siempre continua.
- **Nada depende sólo de hover ni de precisión del puntero.** La causa de un estado crítico o deshabilitado vive en un elemento **enfocable** ("qué / por qué / qué hacer"), nunca sólo en un `title` (D-14).
- **Foco**: anillo visible, `:focus-visible`, separado del canto, en el azul de interacción, legible sobre cualquier relleno incluido el nuevo de marca. **El foco nunca se sustituye por glow ni por elevación.**
- **Selección**: trazo + relleno suave. **Nunca glow.** Debe sobrevivir en escala de grises.
- **Gate nuevo de esta fase, obligatorio antes de implementar el color:** verificación en **escala de grises y con deficiencia de color** (deuteranopia/protanopia) de los tríos que la reasignación crea — marca menta / cortante lima / éxito, y rosa de influencia / coral de momento / rosa de Aula. Si alguno no se separa, la salida no es "aceptarlo", es mover uno de los tres.
- Target táctil 44px (LEDGER-06, cerrado). Piso de caption para valores del solver (LEDGER-03, cerrado).
- ABIERTA-6 (contraste a nivel de píxel + pase real con lectores de pantalla) **sigue siendo gate paralelo abierto**. Esta fase no lo ejecuta y no lo declara cerrado.

## 3. Estrategia visual — invariantes que la dirección conserva

Ninguna decisión de arriba los toca; se listan porque son el marco dentro del que se tomaron:

- **Viewport/evidencia dominante.** El lienzo es el elemento mayor de la composición en las tres clases. Ningún tratamiento visual de esta fase le quita superficie: las tarjetas de Results viven en su superficie, no sobre el dibujo.
- **Controles cerca de lo que afectan.** La materia refuerza esto: una bandeja INSET con piezas RAISED encima lee como "estas herramientas pertenecen a esta zona".
- **Mobile y desktop como estrategias hermanas.** Mismo material, misma gramática de superficies, misma paleta, mismo tacto. Lo que cambia es la presentación que asigna el resolutor, no de qué está hecho.
- **Referencias transformadas en principios, no clonadas.** La tabla de §1 registra qué se transformó y qué se dejó fuera, board por board.

## 4. Invariantes protegidos — confirmados intactos

- **`success ≠ reliable ≠ safe`** — reforzado activamente por V-02 (la profundidad no dice verdad), V-10 (guardas de tarjeta + copy prohibido) y V-14 (fiabilidad como línea propia). Un resultado verde, elevado o visualmente positivo **nunca** significa seguridad, cumplimiento normativo ni certificación.
- **Stale fail-closed** — sin cambios; ninguna decisión visual toca la política de evidencia caducada.
- **Canvas-first** — reforzado por §3; ninguna decisión reduce el presupuesto de lienzo.
- **2D/3D separados · Space3D experimental (D-15 congelado)** — sin cambios; el 3D del PDF se rechazó explícitamente y el "material clay" de Welcome sigue siendo filtro, no motor.
- **Mismo analysis, no segundo solver** — sin cambios; ninguna decisión de esta fase toca el motor.
- **Aula fuera de alcance** — sin cambios. Sólo aparece como *restricción de medición* (el rosa de influencia debe separarse del rosa de Aula), no como trabajo.
- **`materialId`/`sectionId` explícitos** — sin cambios; no aplica a decisiones visuales.
- **Colores técnicos por significado** — reforzado: la reasignación de la lima va de identidad a técnico, con gate de medición, y ningún color técnico baja a decorar el chrome.
- **Brandbook vigente como autoridad visual** — **intacto como mecanismo**. Este documento no modifica `brand/brandbook-clay.html`. Registra desviaciones **futuras** que, si se ejecutan, se ejecutan en el Brandbook primero y en `tokens.css` después — nunca al revés.

## 5. Frontera con CRI-12D

CRI-12D puede crear tareas de implementación a partir de este registro sin reinterpretar el diseño. Lo que **no** puede hacer sin volver a preguntar:

- Aplicar cualquier HEX nuevo sin ejecutar antes el gate de medición de `03-color-decision.md`.
- Decidir el serif (está abierta, no decidida).
- Convertir Datasheet o tablas densas en tarjetas (petición registrada, no decisión).
- Mover un color técnico distinto de los tres que este documento nombra.

## 6. Confirmación de alcance de CRI-12C

- Único directorio creado o modificado: **`reports/cri-12/**`** — `03-visual-direction-record.md`, `03-surface-grammar.md`, `03-color-decision.md`, `03-do-dont.md`, y actualización de `HANDOFF.md`.
- **Cero cambios** en `src/**`, `brand/**` y `src/design-system/tokens.css`. El Brandbook y los tokens se leyeron; no se escribió en ellos.
- No se ejecutó ningún gate (`verify:*`, `npm test`) ni suite de pruebas. Todo lo citado de `src/**` y del Brandbook se verificó **por lectura directa**, no por corrida.
- No hubo prototipo nuevo, no hubo merge a `main`, no hubo publicación en GitHub Pages.
- Ninguna decisión humana fue inferida: las seis decisiones de propietario (identidad cromática, intensidad Clay, tipografía, reasignación de cortante e influencia, Día/Noche, Results, Welcome) se tomaron en conversación directa, en bloques de ≤3 preguntas con opciones y recomendación.
- El PDF de referencias se trató como REFERENCE en todo momento; §1 registra qué se tomó y qué se descartó de cada board.
