# Reporte de entrega: rediseño CAD de los diagramas del método

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-diagrams-improvements-2vopp2`
**Commits:** ver el commit que acompaña este reporte (segunda vuelta sobre `a489951`)

---

## 1. Qué se pidió

«Mejora los diagramas, no me gustan, aún pueden mejorar más.»

Preguntado qué fallaba, el usuario señaló las cuatro cosas a la vez —el dibujo diminuto, los
rótulos que estorban, el trazo flojo, la falta de información de dibujo— y añadió una quinta:
**el DCL debe ser el del método que se usa.** Estilo elegido: **técnico tipo CAD**.

## 2. Qué estaba mal, medido

Los DCL de la primera vuelta eran correctos —la dirección de cada axial y el lado conservado de
cada corte están probados— pero se veían mal. Medido sobre el marco real que recibía cada escena:

```
caja de trazado: 379.3 x 90.9 pt dentro de un marco de 495 x 186

viga 6 m (canto nulo)      dibujo 379.3 x   0.0 pt   ocupa 76.6% del ancho,  0.5% del alto
armadura triangular 6x4 m  dibujo 136.3 x  90.9 pt   ocupa 27.5% del ancho, 48.9% del alto
```

Una armadura ocupaba **el 27,5 % del ancho de su propia figura**.

| Causa | Evidencia |
|---|---|
| Marco fijo para las once escenas, con relleno fijo y 21 pt de leyenda dentro. | `SCENE_HEIGHT = 186`; caja de trazado 379×91, proporción 4,2:1 que casi ninguna estructura tiene. |
| Marcas de tamaño constante. | Flecha 22–30 pt, punto de nudo 3 pt, rótulo 5,9 pt, ajustados a un solo tamaño de marco. |
| Rótulos sin anticolisión. | `placeLabel` desplazaba en perpendicular a ciegas y recortaba contra el marco. |
| Trazo flojo. | Parte retirada en gris punteado al 50 %: se lee como ruido, no como contexto. |
| Sin información de dibujo. | Ni cotas, ni ejes, ni rótulas, ni puntos de reducción. |
| Escenas genéricas donde el método tiene dibujo propio. | Tres momentos y Hardy Cross dibujaban «un vano con dos arcos»; la viga conjugada, una copia del corte de doble integración; Kani, una barra. |

## 3. Qué se hizo

### 3.1 El dibujo llena su figura

`pdfSceneLayout.ts` (nuevo, geometría pura y probada aparte) decide el tamaño:

- `sceneFigureHeight` hace **coincidir la proporción del trazado con la del modelo**, así `min()`
  ya no tiene una dimensión con holgura que dejar vacía. Una viga pide el mínimo (figura baja y
  ancha); un pórtico, el máximo.
- `sceneFrame` **abraza el dibujo** en vez de bordear todo el hueco, centrado.
- `sceneMetrics` escala flecha, arco, punto de nudo, rótulo y grosor de barra al trazado.
- La leyenda sale del marco al pie numerado; para eso `figure()` **envuelve el pie en varias
  líneas** (antes lo dibujaba en una sola, un desbordamiento latente para cualquier pie largo).

Resultado, ahora fijado como gate: **≥ 60 % del ancho y del alto** en armadura y pórtico, ≥ 85 %
del ancho en viga.

### 3.2 Vocabulario técnico

En `pdfScene.ts`: `drawDimension` (líneas de referencia, extremos en tick a 45°, valor centrado),
`drawLeader`, `drawHinge`, `drawCutLine` (discontinua con tick en los dos extremos),
`drawAxesIndicator`, `drawIsolationBoundary` (el círculo de trazos que dice dónde acaba el cuerpo
libre), `drawPolynomialCurve` (con área rayada) y `evaluatePolynomial`. La parte retirada pasa de
punteado al 50 % a **hairline continuo**: jerarquía por peso, no por trama.

### 3.3 Rótulos

`placeLabelBox` prueba ocho posiciones alrededor del ancla en dos anillos, rechaza las que solapan
una caja ya puesta —y **las cajas de los trazos dibujados**, muestreadas a lo largo de cada barra
en vez de por su rectángulo envolvente, que en una diagonal cubre todo el triángulo— y tira una
guía cuando el rótulo tuvo que viajar. Las etiquetas de carga que dibuja `drawMemberLoads` entran
también en el conjunto de obstáculos.

### 3.4 Cada DCL es el del método

| Método | Ahora dibuja |
|---|---|
| Cortes | Además del corte: **el muñón en tinta de cada barra seccionada**, de la porción conservada hasta la cara del corte — antes se difuminaba la barra entera y un corte que conservaba dos barras dejaba en tinta sólo un nudo— y el punto de reducción `O` de `ΣM`. |
| Nudos | **El pin aislado**: círculo de trazos como frontera y un muñón por barra concurrente, no la armadura en tinta. |
| Portal · Voladizo | **Rótulas dibujadas** en cada punto de inflexión, cota entre ellas, y la resultante de planta aplicada en el nudo de barlovento. |
| Tres momentos | **El diagrama de momento libre** de cada vano, con su área rayada y los brazos `a` y `b` acotados al centroide: de ahí salen `Aₙaₙ` y `Aₙbₙ`. Se deduce restando al momento final la recta entre los momentos de apoyo ya resueltos. |
| Hardy Cross | **El nudo interior**: el FEM que llega por cada vano, el factor de reparto de cada uno y el momento convergido. |
| Kani | **El nudo** con el momento final de cada barra concurrente, que es lo que distingue a Kani de Hardy Cross. |
| Viga conjugada | **La pareja viga real / viga conjugada**, con `w* = M/EI` dibujada como carga real y la conversión de apoyos rotulada en cada extremo. |
| Doble integración | El corte, más la **cota de la estación `x`** desde el apoyo izquierdo. |

Nada se recalcula: todo sale de lo que `src/analysis-methods/` ya resolvió y contrastó contra el
análisis matricial.

## 4. Fallos encontrados y corregidos por el camino

Todos salieron de mirar los PDF rasterizados, no de las pruebas:

1. **Trazado degenerado.** Una viga de canto nulo pedía un trazado de altura cero y toda la
   estructura colapsaba en un punto. Piso mínimo `MIN_PLOT_HEIGHT`, con prueba.
2. **Proyección y marco en desacuerdo.** La figura se dimensionaba a un vano y se proyectaba el
   modelo entero dentro: el vano salía en la mitad de su marco. Ahora ambos leen `framedNodes`.
3. **Caja de foco no centrada.** `focusBounds` devolvía el rectángulo envolvente y la proyección
   se centra en el nudo, así que el semiancho se quedaba corto y el modelo se salía de la
   figura y cruzaba el texto de la página. Se mide simétricamente respecto del nudo.
4. **`createFocusProjection` isótropa.** Ajustaba un solo vano a los dos ejes; en un nudo de viga
   continua, con los dos muñones alineados, el vano vertical es cero y la altura mandaba: el
   dibujo quedaba en una cuarta parte del marco. Ahora respeta cada eje.
5. **Círculo de aislamiento en unidades de modelo.** Con la escala horizontal grande salía más
   alto que el marco. Acotado en puntos.
6. **Fantasma desbordado en los primeros planos.** Un primer plano se escala a sus muñones, así
   que el resto del modelo caía fuera del marco — y aquí nada recorta un dibujo a su marco. Los
   primeros planos ya no dibujan ni el fantasma ni la mitad descartada.
7. **Reacción a través de su propio apoyo**, y **corte con un rebase de un cuarto del vano** que
   en un dibujo a tamaño completo salía fuera de la estructura.

## 5. Verificación ejecutada

```
npm run verify
  lint · docs                ✓
  verify:protected           ✓  Frontera protegida intacta: 50 archivos verificados (sin --update)
  test                       ✓  314 archivos · 3009 pruebas · 8 omitidas
  build · perf · entry       ✓  chunk de entrada limpio
  verify:browser-bundle      ✓  84 archivos sin construcciones de Node
```

**Pruebas nuevas (13):** `pdfSceneLayout.test.ts` (12) fija la proporción, el mínimo de una viga,
el techo, el trazado no degenerado, el marco que abraza y no se sale, la separación de dos
rótulos con la misma ancla y la guía cuando no queda hueco. `pdfMethodScenes.test.ts` gana el
**gate de ocupación** —el 27,5 % que motivó este trabajo, convertido en umbral— y su prueba de
nudos pasa a exigir el pin aislado con muñones en vez de barras enteras.

**Revisión visual:** se generó una memoria por cada uno de los diez métodos aplicables, se
rasterizaron las páginas con el mismo `pdfjs-dist` que usa la vista previa y se miraron una por
una; los siete fallos de arriba salieron de ahí. `node scripts/inspect-pdf.mjs` sobre los diez
PDF no reporta ningún hallazgo nuevo: los tres de margen izquierdo son la portada y son previos.

## 6. Límites de lo entregado

- **No hay recorte al marco.** `pdf-lib` no expone un clip cómodo, así que las escenas que se
  escalan a un detalle (nudos, repartos) no dibujan el resto del modelo en vez de dibujarlo y
  recortarlo. Un lector pierde el contexto de dónde está ese nudo en la estructura; lo tiene en
  el DCL global de la parte 1.
- Los rótulos de carga entran en la anticolisión como obstáculos, pero no se reubican: los dibuja
  `drawMemberLoads`, no el colocador.
- Kani sigue retirándose en un pórtico que se desplaza lateralmente, como debe: la revisión visual
  se hizo sobre un pórtico arriostrado.
