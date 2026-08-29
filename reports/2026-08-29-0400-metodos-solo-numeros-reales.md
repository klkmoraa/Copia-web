# Reporte de entrega: los once métodos escriben sólo números reales

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdfs-calculos-reales-5ebh2j`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

Continuación directa de `2026-08-29-0337`. El usuario pidió extender lo mismo a **todos** los
métodos: que la sección 5 salga siempre con los números reales del pórtico, la viga o la armadura
que se está analizando, y no con la fórmula que da nombre al método.

## 2. Estado tras la entrega anterior

Seis métodos habían perdido su bloque simbólico y cuatro de ellos ya escribían su propia
aritmética. Faltaban cinco métodos sin ningún desarrollo numérico propio, y dos que sólo habían
perdido el símbolo sin ganar el cálculo:

| Método | Antes de esta entrega |
|---|---|
| Castigliano | Bloque simbólico retirado, pero sin desarrollo: sólo tablas |
| Hardy Cross | Sin desarrollo; prosa con `3EI/L en vez de 4EI/L` |
| Método de los Nudos | Sin desarrollo; prosa con `ΣFx = 0 y ΣFy = 0` |
| Método de los Cortes | Sin desarrollo; prosa con `ΣFx = 0, ΣFy = 0, ΣM = 0` |
| Método del Portal | Sin desarrollo |
| Método del Voladizo | Sin desarrollo |

## 3. Qué escribe ahora cada uno

- **Castigliano.** La fuerza final de cada barra como la suma que la produjo. Con una sola
  redundante el coeficiente de influencia es recuperable exactamente —es el cambio por unidad de
  X— así que se escribe el producto entero, `N = N₀ + (n)(X)`; con varias, sólo su contribución
  conjunta es separable, y eso es lo que se imprime en vez de un factor que nadie podría
  comprobar.
- **Hardy Cross.** Por apoyo interior: `ΣK = K_izq + K_der = …` y el factor de reparto de cada
  vano como el cociente que lo produce. La prosa ya no cita `3EI/L` ni `4EI/L`: las rigideces
  reales que el reparto usó están en la tabla de arriba.
- **Método de los Nudos.** Bajo la tabla de cada nudo, las dos sumas de equilibrio ya efectuadas:
  cada barra que concurre, con su fuerza y su coseno director, más la reacción y la carga
  aplicadas ahí, cerrando en cero.
- **Método de los Cortes.** Lo mismo por corte, sobre el lado conservado, y además la suma de
  momentos respecto del primer nudo retenido —la ecuación que en la mano aísla una sola barra.
- **Método del Portal.** El cortante de planta como la acumulación que es (`V = H₁ + H₂ + …`), el
  cortante de cada columna como su parte del ancho tributario (`V = V_planta · w/Σw`) y el momento
  de extremo como `V · h · f`.
- **Método del Voladizo.** Su hipótesis, comprobada sobre el pórtico: la axial de cada columna
  dividida por su área y su distancia al centroide da el mismo número en toda la planta, y ese
  cociente se imprime columna por columna. Más los momentos de extremo, igual que el Portal.
- **Ambos aproximados.** El cortante de cada viga desde sus dos momentos de extremo.
- **Kani.** La frase que decía «la fórmula no lleva término de bamboleo» pasa a decir «el método»:
  ya no hay fórmula impresa a la que referirse.

## 4. La misma disciplina de la entrega anterior

Ningún desarrollo se imprime si no cierra. `agrees()` compara lo reconstruido aquí contra lo que
el método publicó, relativo a las magnitudes en juego:

- El reparto de cortante sólo se escribe si `V_planta · w/Σw` da de verdad el cortante tabulado.
- El momento de extremo, sólo si `V · h · f` da el momento tabulado.
- El cortante de viga, sólo si `2M/L` da el cortante tabulado.
- Las sumas de cuerpo libre, sólo si cierran en cero; y se omiten por completo cuando el modelo
  lleva cargas de miembro, cuya contribución repartida este ayudante no integra: se prefiere no
  desarrollar a desarrollar una suma con un término de menos.
- Los cocientes del Voladizo se saltan la columna que está en el centroide (divisor nulo) en vez
  de imprimir un infinito.

## 5. Frontera protegida

`src/engine/**`, `src/data/**` y `src/types.ts` siguen byte a byte idénticos: todo el desarrollo
se hace en la capa de dibujo sobre el modelo, el resultado y las soluciones que
`src/analysis-methods/**` ya publica. `npm run verify:protected`: 50 archivos verificados.

## 6. Verificación ejecutada

`npm run verify` completo, en verde: lint · documentación · frontera protegida · pruebas (309
ficheros, 2952 pasadas, 8 saltadas) · build · presupuesto · chunk de entrada.

Gate propio nuevo (`src/utils/pdf/pdfMethodSection.test.ts`, 14 pruebas): recorre los **once**
métodos, cada uno sobre un modelo que lo acepta —viga empotrada-apoyada, viga biapoyada, viga
continua de dos vanos, pórtico arriostrado, armadura isostática, armadura con una redundante,
pórtico bajo carga lateral— y exige que la sección que escribe lleve al menos una ecuación
numerada y que el procedimiento genérico no la haya sustituido. El `(1)` se dibuja como texto PDF
real aunque la ecuación de al lado sea geometría vectorial, así que es la única evidencia que la
extracción de texto puede dar de que se dibujó un desarrollo. Tres pruebas más fijan contenido
concreto: los dos nudos del método de los nudos, el ancho tributario del portal y la comprobación
de la hipótesis del voladizo.

`pdfSubstitution.test.ts` gana dos pruebas: el equilibrio de un nudo de armadura cierra en cero
con cada término escrito como fuerza por coseno director, y el ayudante se declina —lista vacía—
sobre una viga con cargas de miembro.

## 7. Lo que esta entrega no hace

- **No reconstruye la primera pasada de Hardy Cross ni de Kani.** Se imprimen las rigideces y los
  factores de reparto, que son exactos y se pueden repetir a mano; los momentos intermedios de
  cada pasada no se guardan en el resultado del método y reconstruirlos aquí arriesgaría una
  secuencia que no fue la que se ejecutó.
- **El coeficiente de influencia de Castigliano con varias redundantes** no se separa: se imprime
  la contribución conjunta.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`).
