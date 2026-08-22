# CRI-12C · Decisión de color

**Clasificación:** `AUDIT/TEMPORARY`
**Complementa:** `03-visual-direction-record.md` (V-07, V-08, V-09, V-14)

Cierra la pregunta 12 del `HANDOFF.md` de CRI-12A (`MUST_DECIDE_IN_12C`, tema 19 de `01-evidence-matrix.md`) y las consecuencias que el propietario decidió sobre la paleta técnica.

**Nada de este documento está implementado.** Todo es desviación **futura** del Brandbook vigente. `brand/brandbook-clay.html` y `src/design-system/tokens.css` no se modificaron en esta fase y siguen siendo la autoridad vigente hasta que la desviación se ejecute en su propio proceso — Brandbook primero, `tokens.css` después, nunca al revés.

---

## 1. La decisión: menta/esmeralda gana

**El verde de identidad de structureCo pasa de la lima vigente a la familia menta/esmeralda.** Decisión del propietario, tomada en conversación directa tras comparar las dos opciones visualmente.

### Qué se comparó

| | **Lima vigente** (estado de `main`) | **Menta/esmeralda** (elegida) |
|---|---|---|
| Cómo se ve | Verde vivo, casi chillón, temple pastel | Verde profundo y sereno, casi teal |
| Cómo se lee | Energía, producto joven | Instrumento técnico caro |
| Qué puede hacer | **Sólo relleno.** `#89d448` mide 1,65:1 sobre marfil: no se puede dibujar. Para trazo hace falta un segundo token (`#468c09`, 3,84:1) | **Relleno y trazo.** Un verde profundo cae dentro de la franja de luminancia y puede dibujarse |
| Coste estructural | Dos tokens obligatorios por rol (relleno + canto), y confundirlos es el error más fácil del sistema — el propio Brandbook lo dice | Un solo verde hace más trabajo con menos reglas |
| Evidencia en el PDF | No aparece en ningún board | Los 10 boards la usan |

### Alcance de la decisión

- La menta manda **identidad y acción primaria**: botón primario, chips activos, riel, marca dibujada, Welcome, subrayados de pestaña, canto de control.
- **No** significa revertir el cierre cromático previo ni hacer un `git revert` global. Los commits `74dfc76`/`f60eae5`/`7fb927f` siguen siendo historia válida; lo que cambia hacia delante es el rol del verde de marca.
- **No** es "recuperar los tres verdes históricos". Los tres candidatos que el cierre anterior descartó (`#159a72`, `#00795f`, `#157A55`) siguen descartados **como conjunto en conflicto**. Lo que se recupera es la **familia**, con un único HEX resultado de medición.
- Se conserva íntegro el **mecanismo** que el cierre cromático estableció: un solo HEX por significado, idéntico en Día y en Noche, declarado una vez en `:root`; el bloque oscuro sólo redefine neutros, fondos, superficies, bordes, tintas de texto y materia clay. `tokens.test.ts` debe seguir pasando sin relajarse.

## 2. Reasignación de la paleta técnica

Decisión explícita del propietario, más amplia que la identidad. Se registra tal cual, con los avisos que planteé y que el propietario mantuvo.

### 2.1 Cortante (V) pasa a la familia lima

**La lima no se retira del sistema: cambia de trabajo.** De identidad de marca a color técnico de cortante. La carga distribuida sigue al cortante, porque hoy lo aliasa (`--sc-color-technical-distributed`, `--sc-color-load-distributed`, `--sc-color-tool-distributed-load`).

**Aviso registrado, no bloqueante:** la lima de relleno no se puede dibujar. Un diagrama de cortante es trazo **y** área, así que hereda la misma partición que hoy tiene el CTA — **trazo con la lima profunda, área con su tinte**. Esto no es una excepción: el Board 10 del PDF ya observa, de forma independiente, que el área bajo la línea debe ser un tinte del trazo y no un segundo color.

### 2.2 Línea de influencia pasa a rosa/fucsia pastel vivo

El propietario pidió primero morado. **No es viable**: el morado está ocupado tres veces — deformada (`#8b5cf6`), envolvente (`#8966db`) y la rampa del índice elástico (`#6a3fa0` / `#43206c`). Un cuarto morado no se separa de los otros tres, y menos aún en gris o con deficiencia de color. Planteado el problema, el propietario pidió otro color no usado, **manteniendo la cualidad "pastel vivo"**, y eligió rosa/fucsia sobre aguamarina.

**Por qué un rol técnico puede ser pastel aquí, y por qué eso no rompe la regla.** La regla del sistema dice que un rol técnico **dibujado como trazo** tiene que llegar a 3:1 sobre los cuatro fondos con un solo HEX, y que el pastel queda fuera de esa franja **por definición** — es demasiado claro para verse sobre papel. El mecanismo que sí lo permite ya existe en el Brandbook y es el del CTA: *"lo pastel-vivo vive donde sí cabe — en el relleno, que no es trazo sino superficie, y que por eso lleva tinta oscura y canto medido"*.

La línea de influencia adopta esa misma anatomía:

- **Área** = pastel vivo. Es superficie, y las superficies no están sujetas al suelo de trazo.
- **Canto/trazo** = el mismo tono bajado a la franja legible, que sí cumple 3:1 sobre los cuatro fondos.
- **Patrón** = **siempre discontinuo**, frente a la deformada que es siempre continua.

El patrón discontinuo no es decoración: es lo que hace que el rol no dependa del color, que es la regla que el sistema ya exige a todos los roles técnicos.

**Por qué rosa y no aguamarina.** El aguamarina queda encajado entre el cian del axial y la menta de la marca: en gris y con deficiencia rojo-verde se confunde con el diagrama axial justo cuando ambos se dibujan sobre la misma barra. El rosa/fucsia es la única zona del lienzo que se separa de cian, lima, coral, violeta, azul e índigo **también en escala de grises**.

### 2.3 Snap, hover y marcas de construcción

Siguen al nuevo trazo de marca (menta). Hoy apuntan a la tinta de marca (`--sc-color-snap-target`, `--sc-color-hover-target`); ese apuntamiento no cambia, cambia a qué apunta.

**El choque original queda resuelto por la propia decisión del propietario.** El problema que planteé era que una marca menta dibujada sobre el lienzo quedaría en la misma familia que el diagrama de cortante esmeralda. Al mover cortante a la lima, esa colisión desaparece: la menta es el único verde que se dibuja sobre el lienzo. La solución del propietario es más limpia que la alternativa que yo había recomendado (sacar la marca del lienzo por completo), porque conserva la marca dentro del dibujo sin ambigüedad.

### 2.4 Sin cambio

`N`/axial, `M`/momento, deformada, reacción, cota, eje y corte, error, aviso trazo, canario, éxito, selección, foco y Aula **conservan su HEX vigente**. Ninguno pasa a decorar el chrome. La rampa del índice elástico conserva su excepción documentada (es una escala secuencial, no un significado, y por eso sí cambia de fase por tema).

## 3. Tabla de cambios

| Rol | Hoy (vigente en `main`) | Decisión de 12C | Disposición |
|---|---|---|---|
| Marca — relleno | `--sc-lime-400` `#89d448` | Familia **menta/esmeralda**, HEX por medir | `FUTURE_DEVIATION` |
| Marca — trazo/canto | `--sc-lime-700` `#468c09` | Trazo de la misma familia menta, HEX por medir | `FUTURE_DEVIATION` |
| Marca — tinta sobre relleno | `--sc-lime-ink` `#16250d` | Por medir: depende de si la menta aguanta tinta clara u oscura | `FUTURE_DEVIATION` |
| Cortante V (+ carga distribuida) | `#059669` | Familia **lima**: trazo profundo + área en tinte | `FUTURE_DEVIATION` |
| Línea de influencia | `var(--sc-color-action-ink)` | **Rosa/fucsia pastel** — área pastel + canto medido + **siempre discontinua** | `FUTURE_DEVIATION` |
| Snap / hover sobre lienzo | `var(--sc-color-action-ink)` | Siguen al nuevo trazo de marca | `FUTURE_DEVIATION` (consecuencia) |
| Éxito | `#2f9a2a` | Sin cambio **salvo que la medición lo obligue** (§4.2) | `CONDITIONAL` |
| Aula | `#c94a8f` | Sin cambio **salvo que la medición lo obligue** (§4.2) | `CONDITIONAL` |
| N/axial, M/momento, deformada, reacción, cota, eje, error, aviso, canario, selección, foco | — | **Sin cambio** | `UNCHANGED` |
| Neutros, fondos, superficies, bordes, tintas de texto, materia clay | — | **Sin cambio** (§5, Día/Noche) | `UNCHANGED` |

**No se fija ningún HEX en este documento.** Los HEX del PDF no se copian — es REFERENCE, y además sus dos láminas de paleta se contradicen entre sí. Los valores concretos son **salida de la medición** de §4, no una elección estética que pueda cerrarse aquí.

## 4. Gate de medición — obligatorio antes de implementar

Ninguna de las decisiones de §2 puede entrar en `tokens.css` sin pasar esto entero. **CRI-12C no lo ejecuta**: lo especifica.

### 4.1 Suelos de contraste

1. Cada HEX nuevo se mide sobre los **cuatro fondos** — lienzo y superficie × Día y Noche — con suelo **≥3:1** (WCAG 1.4.11, contraste no textual).
2. Todo par relleno/tinta se mide como pareja, con suelo **≥4,5:1** para texto.
3. La menta debe caer **dentro de la franja de luminancia** que hace posible el HEX único en ambos temas. Si no cabe, la menta se ajusta — no se relaja la franja.
4. El pastel de la línea de influencia **no** se mide como trazo: se mide su **canto**. El área pastel es superficie y no está sujeta al suelo de trazo.
5. La lima de cortante se mide como **trazo profundo**, no como relleno.

### 4.2 Separaciones obligatorias

La reasignación crea tres vecindades nuevas. Cada una se verifica **en color, en escala de grises y bajo deuteranopia/protanopia**:

| Trío / par | Riesgo | Si no se separa |
|---|---|---|
| **marca menta / cortante lima / éxito** `#2f9a2a` | La lima de trazo de cortante queda cerca en tono del verde de éxito | **Éxito se mueve.** Es un color de estado del cascarón, mientras cortante es significado técnico del lienzo: el técnico tiene prioridad |
| **rosa de influencia / Aula** `#c94a8f` | El rosa de Aula ocupa la misma región de tono | **Aula se mueve.** Aula está fuera de alcance y parada; la influencia es un rol vivo del lienzo |
| **rosa de influencia / momento coral** `#ed4b46` / **error carmín** `#d92e28` | Los tres viven en el lado cálido | Si no se separan, la influencia se empuja hacia el fucsia frío, no hacia el naranja |

**La salida nunca es "aceptarlo porque el patrón discontinuo lo salva".** El patrón es una capa de refuerzo, no un sustituto del suelo de contraste.

### 4.3 Invariancia

`tokens.test.ts` debe seguir pasando **sin relajarse**: si un rol semántico reaparece en el bloque `[data-theme='dark']`, falla. La única excepción vigente sigue siendo la rampa del índice elástico, y este documento no añade ninguna nueva.

### 4.4 Coherencia documental

El Brandbook se actualiza **antes** que `tokens.css`, incluidas su tabla de contraste con números reales y su bloque de tokens copiables. Un HEX en `tokens.css` que no esté en el Brandbook es una regresión del mecanismo de autoridad única, no un detalle de orden.

## 5. Día / Noche

Sin cambio de suelo. Decisión del propietario: **mantener el grafito frío profundo vigente**, no bajar a casi negro (Boards 05/06) ni subir a grafito medio.

- **Noche conserva material y jerarquía de Día.** No es una inversión: cada rol se reasigna a mano y la materia se vuelve a medir entera.
- **En Noche la sombra pierde trabajo y el canto lo gana.** No queda luz que quitar; sin canto visible los paneles se funden con el fondo.
- **La luz interior es un velo de marca muy tenue, nunca blanco puro** — el blanco puro sobre grafito lee como arañazo.
- **El resplandor de marca sigue anulado en Noche.** Glow no es elevación y nunca es selección. El halo verde ambiental del Board 05 queda rechazado explícitamente: es el síntoma de haber bajado el fondo tanto que el relieve dejó de funcionar.
- Del Board 09 §3 se toma **una sola idea estructural**: Noche necesita **cuatro escalones distinguibles** — base, superficie, superficie alternativa y canto — no dos. Sus HEX no se copian.
- **Rechazado**: negro puro, neón, glass, `backdrop-filter` por fila.
- **LEDGER-05 sigue abierto.** La remedición de contraste del pórtico en Noche no se ejecutó aquí; se documenta, no se cambia sin volver a medir. Cuando se ejecute, debe hacerse **después** de fijar los HEX nuevos de §4, no antes: la menta cambia el fondo contra el que se mide el pórtico.

## 6. Lo que esta decisión NO autoriza

- **No autoriza tocar ningún color técnico distinto de los dos que nombra** (cortante y línea de influencia). El resto de la familia N/V/M/deformada/reacción/cota/eje conserva su significado y su HEX.
- **No autoriza convertir un color técnico en decoración del chrome.** La reasignación va de identidad → técnico. Nunca al revés.
- **No autoriza usar el verde para afirmar seguridad.** Un resultado verde, elevado o visualmente positivo **nunca** significa seguridad, cumplimiento normativo ni certificación. `success ≠ reliable ≠ safe` sigue intacto y esta fase lo refuerza (V-10, `03-do-dont.md`).
- **No autoriza implementar nada.** Es una decisión de producto futura, con gate. CRI-12D crea las tareas; el gate de §4 es su condición de entrada.

## 7. Resumen de desviaciones futuras del Brandbook

| # | Desviación | Sección del Brandbook afectada |
|---|---|---|
| 1 | Verde de marca: lima → menta/esmeralda (identidad + acción primaria) | §03 Marca, §04 Lenguaje de color, tabla de contraste, bloque de tokens |
| 2 | Cortante V (y carga distribuida): esmeralda → familia lima, con partición trazo/área | §04 Lenguaje de color, tabla de contraste, bloque de tokens |
| 3 | Línea de influencia: tinta de marca → rosa/fucsia pastel con canto medido y trazo siempre discontinuo | §04 Lenguaje de color; regla nueva de patrón |
| 4 | Snap / hover sobre lienzo: siguen al nuevo trazo de marca | §04 (consecuencia de 1) |
| 5 | Tipografía: se abre decisión futura **sin acotar** sobre un serif editorial para titulares, con prohibición dura en valores, unidades, tablas, etiquetas del lienzo y Datasheet, y con la entrega local-first como prerrequisito | §05 Tipografía |
| 6 | **Condicional:** éxito se mueve si no se separa de la lima de cortante | §04 |
| 7 | **Condicional:** Aula se mueve si no se separa del rosa de influencia | §04 |

Ninguna está ejecutada. Ninguna autoriza a otra fase a ejecutarla sin el gate de §4.
