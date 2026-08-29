# Reporte de entrega: los diagramas, dibujados con lo que ReportLab sabe hacer

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-reportlab-migration-79ofmk` (segunda vuelta, sobre `5bbd854`)
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

> «Mejora los diagramas con reportlab.»

La migración anterior movió el renderizado a ReportLab conservando el dibujo **tal cual**: cada
figura salía igual que antes, marca por marca. Eso era lo correcto para una migración —una
sola variable a la vez— pero dejó sobre la mesa la razón de haberla hecho. Esta vuelta gasta lo
que el renderizador nuevo sabe hacer y el anterior no.

## 2. Lo que estaba mal, mirado en la página

Los cinco defectos venían todos del mismo sitio: la API de dibujo anterior no podía **rellenar
una forma arbitraria**, así que cada área se aproximaba con líneas y cada punta con dos trazos.

| Qué se veía | Por qué |
|---|---|
| El diagrama V como un peine de 18 rayas verticales. | Una magnitud que **es** un área se dibujaba como su fleco. |
| Puntas de flecha en `V` abierta, que a 4 pt se leen como ruido. | Dos trazos que se cruzan, no un triángulo. |
| Arcos de momento facetados. | Veinticuatro cuerdas rectas; a 15 pt de radio cada una se queda 0,13 pt corta de la curva —un quinto del pelo con que se dibuja. |
| Círculos de aislamiento con los huecos apelotonados en un lado. | Cuarenta cuerdas con una de cada dos omitida: los huecos caían a ángulo fijo, no a longitud de arco fija. |
| `Ry 27.5 kN` escrito fuera del marco, encima del apoyo. | Sin recorte contra el marco y sin forma de que un rótulo sobreviva a cruzar geometría. |

Y uno que no era de dibujo sino de tamaño: **la figura medio vacía**. Medido sobre el marco real:

```
DCL de una viga         tinta 45 pt de 206 pt de figura   22 %
diagrama V de esa viga  tinta 88 pt de 246 pt de trazado  36 %
```

Una viga recta no abarca nada en vertical, así que centrarla en una banda dimensionada para un
pórtico ponía una línea en mitad de la caja y blanco en todo lo demás.

## 3. Qué se hizo

### 3.1 El vocabulario de marcas crece con lo que ReportLab sí puede

`SceneMark` gana `path` —la única marca que se puede **rellenar**—, `cap` y `join` en los trazos,
`dash` en el círculo, y `halo` en el texto. `PathBuilder` y `arcOps` viven del lado de
TypeScript: la curva se calcula donde se calcula todo lo demás, y el renderizador rellena y
traza lo que le llega, sin decidir geometría propia.

Los trazos son **redondos de cabo y de unión** por omisión. Eso solo ya quita el pico de inglete
donde se juntan dos tramos empinados de un diagrama y el canto cuadrado con que terminaba el
astil de cada flecha.

### 3.2 Las áreas son áreas

Los tres diagramas —el de página completa, las tres tiras por miembro, y la curva polinómica de
los métodos— se rellenan al 16-18 % con su propio color, con las **ordenadas** encima. La
ordenada se queda porque es lo que permite **medir** un valor sobre el papel en vez de estimarlo
del tono; el relleno se añade porque es lo que dice de qué lado del eje está la magnitud antes de
que el lector haya encontrado la curva.

### 3.3 Las puntas se cierran, los arcos se curvan

`arrowHead` es un triángulo relleno, ingletado para que la punta siga siendo una punta, y
devuelve dónde debe parar el astil para que ningún trazo asome por delante. `drawMomentArc` es
un arco de Béziers cúbicas —un cuarto de vuelta por segmento, error radial ~2,7·10⁻⁴ del radio—
que se detiene justo debajo de su propia punta. El círculo de aislamiento es un círculo con
guiones de verdad.

### 3.4 Los rótulos se quedan donde nombran

Un valor que cruza su propia curva se apoya ahora en una **placa** del color del papel. Se usa
en las reacciones del DCL, en los valores gobernantes de cada diagrama, en los rótulos de las
escenas de método y en las cotas.

Es una placa dibujada y **no** una copia de los glifos trazada por detrás, que es la forma más
bonita de hacerlo: una copia trazada es un segundo operador de texto, y entonces **todo
extractor lee el rótulo dos veces** —en la inspección del propio informe, en el copiar-pegar de
un lector, y en los gates que releen el PDF. Se probó, se vio duplicado, y se cambió.

### 3.5 La figura se dimensiona por lo que dibuja

- `globalDclHeight` hace que la altura del DCL siga la proporción del modelo, que es la misma
  regla que `sceneFigureHeight` aplica desde 0.8.3 a las escenas de método: una viga pide una
  figura baja y ancha, un pórtico una alta.
- En el diagrama de magnitud, la amplitud de las ordenadas sale de **lo que sobra** una vez
  proyectada la estructura, en vez de un tope plano de 62 pt. Un marco profundo mantiene sus
  ordenadas modestas porque la geometría ya llena la caja; una viga plana se gasta el sitio que
  no quiere nadie.
- Los márgenes del diagrama bajan de 58/52/48 a 44/34/18: estaban dimensionados para cuando los
  valores gobernantes se aparcaban en una banda arriba y abajo, y entre los tres regalaban un
  tercio de la figura.

Medido después, sobre los mismos modelos:

```
DCL de una viga         22 % → 68 % de la figura
diagrama V de esa viga  36 % → 74 % del trazado
DCL del pórtico         ocupa las dos direcciones, no una
```

### 3.6 La flecha de una carga nodal deja de esconderse en el nudo

Centrada en el punto del nudo, la punta desaparecía dentro de él y lo que quedaba se leía como
una raya saliendo del dibujo. Ahora para 4,5 pt antes.

## 4. Un defecto encontrado por el camino

La primera versión del relleno **imprimió sólido**. `setFillColor` de ReportLab termina
aplicando el alfa del propio objeto de color, y un `Color` normal es opaco: cualquier alfa puesto
antes se borra en silencio. El alfa viaja ahora con cada color, en la misma llamada. Es un fallo
invisible en la estructura del PDF y evidente en el papel, así que tiene prueba propia.

## 5. Verificación

```
npm run verify                  315 archivos · 3014 pruebas · 8 omitidas · 0 fallos
                                lint · docs · frontera protegida · build · presupuesto ·
                                entry · bundle del navegador — todo en verde
npm run qa:calculation-report   8 comprobaciones en verde sobre la app construida
```

La carga inicial no se mueve: 823 012 B / 213 158 gzip, los mismos que antes.

Cinco pruebas nuevas en `sceneMarks.test.ts`, todas sobre cosas invisibles en la estructura del
PDF o indistinguibles de una respuesta plausible pero equivocada:

| Prueba | Qué fija |
|---|---|
| `arcOps` | Cada ancla del arco cae sobre el círculo, y gira hacia donde se le pidió. |
| `drawArrow` | La punta es **un** camino cerrado de tres esquinas, ingletado, y el astil termina dentro de ella. |
| `drawMomentArc` | Un trazo curvo y una punta rellena; cero líneas rectas. |
| relleno traslúcido | El `/ca` que la página lleva de verdad es fraccionario. |
| rótulo con halo | Se extrae **una** vez. |

Revisión visual sobre tres modelos —viga de dos tramos, armadura triangular y pórtico resuelto
por el Método del Portal— rasterizando las páginas de figura a 2,2× y mirándolas.

## 6. Lo que este cambio no hace

- No cambia ningún número, ninguna unidad, ningún rótulo ni qué muestra cada figura. Lo que
  cambia es **cómo se traza** lo que ya se dibujaba, y **cuánto sitio** se le da.
- No toca la frontera protegida, la UI, ni el branding: los colores siguen saliendo de
  `REPORT_TOKENS`, y el relleno es el tono de la propia magnitud a baja opacidad, no un color
  nuevo.
- No cambia qué escenas compone cada método. La columna aislada del Método del Portal sigue
  encuadrando el modelo entero con su fantasma, que es una decisión de contenido —qué enseña el
  dibujo— y no de renderizado.
