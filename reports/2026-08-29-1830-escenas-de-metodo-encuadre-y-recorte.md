# Reporte de entrega: las escenas de método se encuadran sobre su sujeto

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-reportlab-migration-79ofmk` (tercera vuelta, sobre `5abcd4d`)
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

> «¿Puedes mejorarlo?»

Abierto, sobre el trabajo de diagramas de la vuelta anterior. Lo que quedaba pendiente estaba
declarado en el reporte de esa vuelta: «no cambia qué escenas compone cada método. La columna
aislada del Método del Portal sigue encuadrando el modelo entero con su fantasma». Esta vuelta
va a por eso.

## 2. Lo que estaba mal

Dos defectos, ambos de **encuadre** —a qué se dimensiona la figura—, no de trazo:

### 2.1 Una vista de detalle encuadrada sobre lo que no es su sujeto

`framedNodes` devolvía **todos** los nodos del modelo salvo que la escena escondiese su
fantasma. Una columna aislada de un pórtico son dos nodos de cuatro; encuadrar sobre los cuatro
dibujaba el sujeto como una astilla vertical a un lado de una caja que era, en sus tres cuartas
partes, *el resto de la estructura*. El fantasma es contexto, y el contexto no es a lo que debe
dimensionarse un dibujo.

Medido: la columna ocupaba un tercio del ancho de su propia figura, y sus arcos de momento
salían a 15 pt en una caja de 495.

### 2.2 Un nudo enfocado midiendo simétricamente alrededor de sí mismo

`focusBounds` medía `max|x − x₀| · 2`, simétrico respecto del nudo, porque la proyección
centraba el nudo. En el nudo B de la armadura las dos barras salen **arriba y a la izquierda**,
así que el encuadre reservaba tanto sitio a la derecha y abajo como a la izquierda y arriba:

```
caja real de lo dibujado   3.48 m
extent declarado           5.04 m     (2 x la mayor semiluz)
```

Un 45 % de sobra, todo del lado vacío.

## 3. Qué se hizo

### 3.1 El recorte, que es lo que hace seguro lo demás

`SceneMark` gana `group`, con un `clip` opcional; `marks.py` lo dibuja con `clipPath`.
`PdfLayout.clipped` abre una superficie anidada y la agrupa, igual que `figure()` ya hacía.

Eso es lo que permite encuadrar sobre el sujeto **sin perder el contexto**: la estructura
alrededor se dibuja a la escala del sujeto y se corta en el marco —que es como se dibuja una
vista de detalle— en vez de o quedarse fuera, o desparramarse sobre el pie de figura.

Dos comentarios del código decían «no hay nada aquí que recorte un dibujo a un marco» y
justificaban con eso dos omisiones. Ahora lo hay, y las dos se revierten:

- El fantasma se dibuja en las vistas de detalle.
- La mitad descartada de una barra seccionada se dibuja también en los primeros planos: una
  barra que simplemente se detenía en el corte dejaba al lector adivinar si terminaba ahí.

### 3.2 El encuadre sigue al sujeto

- `framedNodes` devuelve lo que la escena conserva, siempre que sea un cuerpo.
- `focusBox` sustituye a `focusBounds`: la caja envolvente llana —nudo, círculo de aislamiento,
  extremos de los muñones y cualquier ancla en coordenadas de modelo— **con su propio centro**,
  y la proyección centra *esa caja*, no el nudo. Independiente en cada eje, así que sirve igual
  para un nudo de armadura (barras en todas direcciones) y para uno de viga continua (muñones
  colineales), que era el caso que obligó a la medida simétrica en su día.

### 3.3 Un suelo de ancho, simétrico al que ya había de alto

Una columna aislada no abarca nada en horizontal, así que igualar la proporción del trazado a la
del modelo pedía un trazado de ancho cero y el marco colapsaba a su propio relleno.
`MIN_PLOT_WIDTH` es el análogo exacto de `MIN_PLOT_HEIGHT`, que existe desde 0.8.3 por la razón
espejo: lo que necesitan las marcas que cuelgan de una columna —un arco de momento en cada
extremo, una flecha de cortante en la cabeza y los valores al lado de los tres.

### 3.4 Dos colisiones de rótulo

- Los rótulos se colocan en un marco **retranqueado**: uno pegado al borde ponía la línea base
  sobre el filete y colgaba las gambas a través de él.
- El indicador de ejes se **reserva** antes de colocar rótulos aunque se dibuje al final: vive
  en una esquina fija, así que un rótulo enviado allí aterrizaba encima. Es lo que ponía «punto
  de inflexión a 50 % de la altura» sobre el rayado del empotramiento y sobre los ejes.

## 4. El gate que no podía ver esto, y el que sí

`pdfMethodScenes.test.ts` ya tenía una comprobación de ocupación desde 0.8.3. Compara el extent
**declarado** de la escena contra el trazado al que se dimensionó — y esos dos coinciden por
construcción. No puede ver una escena cuya declaración es honesta y cuyo sujeto sigue sin llenar
la figura. Las dos de arriba pasaban.

Medir **tinta** tampoco sirve, y se probó: el fantasma es tinta y llenaba el marco en los dos
casos.

Lo que cada defecto estropeaba es *a qué se dimensiona la figura*, así que eso es lo que mide el
gate nuevo: la caja en coordenadas de modelo que ocupa el sujeto de la escena —nodos conservados,
extremos de muñón, radio de aislamiento— derivada en la prueba de forma independiente del código
que vigila.

Contra el código anterior falla con el número exacto del defecto:

```
× la figura se dimensiona sobre su sujeto, no sobre el resto de la estructura
  AssertionError: nudo A: expected 5.04 to be close to 3.48
```

## 5. Verificación

```
npm run verify                  315 archivos · 3015 pruebas · 8 omitidas · 0 fallos
npm run qa:calculation-report   8 comprobaciones en verde sobre la app construida
```

Carga inicial sin mover: 823 012 B / 213 150 gzip.

Revisión visual rasterizando a 2,2× las páginas de figura de tres modelos —viga de dos tramos,
armadura triangular por el Método de los Nudos, y pórtico por el Método del Portal—, antes y
después de cada cambio.

## 6. Lo que este cambio no hace

- No cambia ningún número, ninguna unidad ni ningún rótulo.
- No cambia **qué** enseña cada escena: los mismos nodos conservados, las mismas barras, las
  mismas fuerzas y momentos, el mismo fantasma. Cambia a qué se dimensiona la figura que los
  contiene, y dónde para el contexto.
- No toca la frontera protegida, la UI ni el branding.
