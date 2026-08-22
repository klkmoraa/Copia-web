# CRI-12C · DO / DON'T visual

**Clasificación:** `AUDIT/TEMPORARY`
**Complementa:** `03-visual-direction-record.md`, `03-surface-grammar.md`, `03-color-decision.md`

Siete pares. Cada uno con un caso concreto de structureCo, no con una regla abstracta. Cuando el error aparece dibujado en el PDF de referencias, se cita el board — **no para criticarlo, sino para que CRI-12D sepa que ese dibujo no es una decisión.**

---

## 1 · Clay correcto vs neumorfismo blando

### ✅ HACER

**El panel del Inspector.** Canto de 1px **siempre visible**, sombra doble con una sola fuente de luz arriba-izquierda, radio del escalón de panel. La pieza **se apoya sobre** el fondo: se ve dónde termina el panel y empieza la mesa.

**El botón primario.** Cuatro capas: gradiente propio del acento, sombra direccional **corta** teñida del propio color, brillo interior en el canto superior, oscurecido interior abajo. Desplazamiento pequeño, desenfoque pequeño.

### ❌ NO HACER

**Quitar el canto y subir la sombra.** Sin canto, el panel deja de apoyarse y **emerge** del fondo, como si estuviera modelado en la misma masa. Eso es neumorfismo, y es lo que hace que una interfaz clay se sienta de plastilina.

**Desenfoque mayor que el radio de la pieza.** Un botón de radio de control con una sombra de 34px no tiene volumen: tiene niebla.

**Sombra de color con mucho desenfoque y opacidad alta.** Se lee como halo de neón, no como relieve — y sobre fondo oscuro se nota muchísimo. El volumen lo dan las capas interiores, nunca el resplandor exterior.

**Regla de bolsillo:** si tapas la sombra y la pieza desaparece, está mal. Si tapas la sombra y la pieza sigue teniendo borde, está bien.

---

## 2 · Shell elevado vs dato plano

### ✅ HACER

**La tabla del Datasheet dentro de un panel Clay.** El panel es `RAISED`: tiene canto, sombra y radio. La rejilla de dentro es `BASE`: sin sombra, sin canto de volumen, sin gradiente, con radio del escalón más cerrado. El contenedor tiene materia; el contenido técnico no.

**Los diagramas N/V/M sobre el lienzo.** Trazo nítido, área en tinte del propio trazo, ejes y rejilla en neutros del sistema. Cero profundidad.

**El chrome que flota sobre el lienzo** (badge de modo, chips de vista, zoom, leyenda): sí es materia — relleno opaco y canto medido — pero **no toca el dibujo ni sus colores**.

### ❌ NO HACER

**Poner sombra clay sobre vigas, cotas, diagramas o valores numéricos.** Es el ítem que el propio checklist del Brandbook pone como condición de terminado.

**Redondear las celdas de una rejilla de datos.** Redondear una tabla la hace más difícil de escanear, no más amable.

**Vidrio o `backdrop-filter` por fila.** El desenfoque es caro y en una tabla larga es inaceptable. Relleno opaco, siempre.

**Elevar la fila de una tabla al pasar por encima.** El resaltado de fila es un cambio de fondo plano, no un cambio de nivel.

---

## 3 · Pressed vs glow

### ✅ HACER

**Un toggle activo baja.** El segmento seleccionado, la capa de evidencia activa, la herramienta elegida: todos pasan a `INSET`. La luz se invierte hacia dentro y **desaparece toda sombra exterior**.

**Una bandeja `INSET` con herramientas `RAISED` encima.** El contenedor baja, las piezas suben. Es la única combinación de dos niveles anidados que es legítima, y es la que produce la sensación física de herramientas apoyadas en una mesa.

**El foco es un anillo.** Visible, separado del canto, en el azul de interacción, con `:focus-visible` — aparece al navegar con teclado, no al hacer clic.

### ❌ NO HACER

**Elevar el estado activo.** Es la regla clay que más se olvida: elevar lo seleccionado es lo que infla una interfaz y le quita jerarquía. Si todo lo activo sube, nada está arriba.

**Usar glow como selección.** El resplandor no es un estado. El Board 05 rodea las tarjetas nocturnas de un halo verde ambiental — eso no es selección, es el síntoma de haber bajado el fondo tanto que el relieve dejó de funcionar. En Noche el resplandor de marca está anulado a propósito y así se queda.

**Sustituir el anillo de foco por elevación o por glow.** El foco tiene que ser visible sobre cualquier relleno, incluido el de marca, y tiene que sobrevivir en escala de grises.

**Dejar sombra exterior en estado pulsado.** Devuelve la pieza a "flotando" y destruye la lectura del hundimiento.

---

## 4 · Color semántico vs decorativo

### ✅ HACER

**Un color, un significado técnico.** Axial, cortante, momento, deformada, reacción, cota, eje: cada uno con su HEX, el mismo en Día y en Noche, medido sobre los cuatro fondos.

**Reforzar siempre el color con algo que no sea color.** Forma (continuo / discontinuo), icono o etiqueta. El caso vivo de esta fase: la **línea de influencia es siempre discontinua**, la deformada es siempre continua — así se distinguen aunque compartan vecindario de tono.

**El área bajo la línea es un tinte del trazo**, no un segundo color.

**Los glifos que representan un resultado técnico llevan el color de su rol**, para reconocerse antes de leer la etiqueta. Los glifos de UI genérica se quedan neutros, siguiendo al texto.

### ❌ NO HACER

**Pintar el chrome con colores técnicos.** N/V/M/deformada tienen significado y no son decoración. Un botón no se colorea de "momento" porque quede bien.

**Hacer que marca y un rol técnico compartan HEX.** El Board 08 pinta cortante con el verde de marca — es exactamente lo que el sistema prohíbe, y por eso ese board no se adoptó.

**Usar la lima de relleno como trazo.** Mide 1,65:1 sobre marfil: una línea de influencia o un imán de snap pintados con ella serían invisibles. Relleno y trazo son roles distintos, no intercambiables — es el error más fácil de cometer con esta paleta.

**Introducir un cuarto morado.** Deformada, envolvente y la rampa de demanda ya ocupan esa región. Un cuarto no se separa de los otros tres.

**Dar por buena una separación que sólo existe en color.** Todo trío nuevo se verifica también en escala de grises y bajo deficiencia rojo-verde. Si no se separa ahí, se mueve uno de los tres.

---

## 5 · Card útil vs cardification

### ✅ HACER

**Tarjeta para los extremos y para el detalle.** Momento flector máximo con su valor, su unidad, su posición y su fiabilidad: eso es una tarjeta. Detalle del objeto, procedencia del número, reacciones, estado del análisis: tarjeta.

**Tarjeta como contenedor de una tabla.** En el Datasheet y en la tabla densa por posición, la tarjeta es el marco y la tabla va plana dentro. Nada queda sin vestir, y comparar cuarenta posiciones sigue siendo posible.

**Una tarjeta destaca un número. Nunca lo juzga.**

### ❌ NO HACER

**Poner cada valor de una tabla en su propia tarjeta.** Los Boards 01 y 04 lo hacen; comparar diez posiciones en diez tarjetas es mucho peor que en diez filas.

**Cambiar el nivel, el color o la elevación de una tarjeta para decir que el resultado es bueno.** La elevación indica agrupación e interacción, nunca verdad. Una tarjeta elevada con acento verde se lee como "aprobado" aunque el texto no lo diga.

**Poner un check verde por fila de tabla.** El Board 06 (panel 4) lo hace. Una fila de tabla no dictamina.

**Perder alguno de los cinco al cardificar.** Valor, unidad, posición, fiabilidad y procedencia tienen que seguir legibles en los dos registros. Si una tarjeta bonita cuesta la procedencia, la tarjeta está mal.

**Escribir cualquiera de estos textos en una tarjeta de resultado:** `Análisis OK`, `Controlado`, `Cumple con los criterios de diseño`, `Verificación global`, `No conforme`, o un porcentaje seguido de `OK`. Todos aparecen dibujados en los Boards 04, 05, 06 y 10. Todos afirman seguridad o cumplimiento a partir de un número. **`success ≠ reliable ≠ safe`**: un resultado verde, elevado o visualmente positivo nunca significa seguridad, cumplimiento normativo ni certificación.

---

## 6 · Densidad compacta vs saturación

### ✅ HACER

**Densidad profesional: compacta pero legible.** Filas ajustadas, cifras tabulares alineadas, unidades en su columna. El Board 06 (panel 4) muestra bien este registro.

**Una jerarquía de tres niveles y no más** en cualquier vista: título, subtítulo, dato. Tres pesos, tres tamaños.

**Espaciado generoso alrededor de los bloques, apretado dentro de ellos.** El aire va entre grupos, no entre filas.

**Reservar el escalón de tipografía grande a superficies editoriales** — Welcome y estados vacíos grandes. La interfaz de trabajo no crece con la ventana.

### ❌ NO HACER

**Competir con demasiados pesos y tamaños.** El propio Board 10 lo pone como su primer "no hacer", y tiene razón.

**Bajar los valores del solver al escalón de caption.** LEDGER-03 ya lo cerró: un número que decide algo no vive a 10px.

**Rellenar el espacio porque sobra.** Si una vista compacta cabe holgada, el resultado correcto es más aire, no más contenido.

**Confundir densa con saturada.** Una tabla de cuarenta filas con dos pesos y una alineación consistente es densa. La misma tabla con cinco colores de fondo, tres iconos por fila y badges en cada celda está saturada.

---

## 7 · Coherencia Día / Noche

### ✅ HACER

**Mismo material, misma jerarquía, mismos significados.** Noche es la misma app con otra luz, no otra app. Los colores técnicos y de estado usan **el mismo HEX** en los dos temas.

**En Noche, el canto asume el trabajo que la sombra pierde.** No queda luz que quitar; sin canto visible los paneles se funden con el fondo.

**Luz interior como velo tenue de marca, nunca blanco puro.** El blanco puro sobre grafito lee como arañazo.

**Cuatro escalones distinguibles en Noche**: base, superficie, superficie alternativa y canto. Con dos, todo se aplana.

**Tres estados de tema, no dos**: claro explícito, oscuro explícito y "según el sistema". Ningún color se define **únicamente** dentro de un `@media` o de un `[data-theme]` — si lo haces, en el estado "según el sistema" ese color no existe y la página acaba con el texto de un tema sobre el fondo del otro.

### ❌ NO HACER

**Invertir a negro.** El suelo es grafito frío profundo, nunca negro puro. Los Boards 05 y 06 bajan más y tienen que compensar con un halo verde: el halo es la prueba de que el fondo bajó demasiado.

**Estética neón o glass en Noche.** Ni resplandor ambiental, ni bordes luminosos, ni vidrio sobre listas.

**Dar dos matices al mismo significado.** La versión anterior del sistema tenía un juego de colores técnicos por tema, y sobre la superficie de Noche medía entre 1,39:1 y 2,56:1 — por debajo del suelo, porque sólo se había medido contra el lienzo. Unificar no fue estética: subió el suelo real de toda la familia técnica por encima de 3:1 por primera vez.

**Medir un color contra un solo fondo.** Son cuatro: lienzo y superficie × Día y Noche. El peor de los cuatro es el que manda.
