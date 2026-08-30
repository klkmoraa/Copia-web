# La Cinta cierra sus dos condiciones latentes

**Fecha:** 2026-08-23 18:19
**Agente:** Claude Code
**Rama:** claude/redeseno-total-mejoras-gimaf7

## Qué cambió

El reporte anterior (`2026-08-23-1717`) cerró la superposición de la Cinta y dejó
**dos cosas medidas y sin arreglar**. Ya no están. Y arreglarlas destapó una
tercera, que también entra aquí.

### 1 · «Analizar» se salía de su celda (1024–1100 y 1280–1360 px)

La pista de `actions` era `minmax(0,1fr)`. Con mínimo 0 la rejilla la da por
satisfecha a cualquier tamaño, así que `document` se quedaba con su `max-content`
entero y el clúster de comandos —que lleva `min-width:max-content` por contrato—
se salía por la derecha: **50 px a 1024 px, 30 px a 1300 px**. No chocaba con
nada porque caía en el hueco entre columnas. Un hueco no es un margen de
seguridad, es una coincidencia.

`minmax(min-content,1fr)` le da un mínimo real, así que la rejilla tiene que
encoger `document`. Es exactamente el orden que el propio archivo declara dos
líneas más arriba y que CRI-95 fija: **el nombre cede antes que los comandos**.
Medido después: «Analizar» termina justo en el borde de su celda a los 22 anchos.

### 2 · Por debajo de 360 px la Cinta se quedaba sin ancho

A 320 px las tres zonas pedían 110 px de dianas táctiles en una celda de
`document` de 89, y `actions` y `status` ya estaban en su suelo protegido
(D-14 · CRI-95): el galón se pintaba encima de «Más acciones».

Cede la marca, que es **identidad, no capacidad**. Y su capacidad no se pierde:
«Ir al inicio» reaparece como primera entrada del menú del proyecto, que cuelga
del galón que la sustituye. Por encima de 360 px esa entrada no existe — un
destino, un lanzador a cada ancho, ni cero ni dos, el mismo trato que el
historial. De regalo, el nombre del proyecto pasa de 27 px a **79 px** a 360 px.

### 3 · Los menús mandaban el foco a un ítem apagado

Lo destapó el arreglo anterior. Estos popovers son también el desbordamiento de
la Cinta: llevan dentro copias que sólo se encienden bajo su umbral, y la primera
de ellas es además el primer `button` del menú. `querySelector` no sabe de CSS,
así que abrir el menú con el teclado llamaba a `focus()` sobre un elemento con
`display:none` —que no hace nada— y el foco se quedaba en el disparador. Las
flechas contaban las mismas paradas invisibles.

Ya existía antes de esta sesión para «Más acciones» por encima de 1280 px; mover
el umbral del historial a 700 px lo habría ensanchado a todo el escritorio. Se
arregla saltando lo que no está pintado, por cadena de ancestros y con
`getComputedStyle` —no con `offsetParent`, que en jsdom es siempre `null` y daría
todo por invisible—, así que la misma función dice la verdad en el navegador y en
las pruebas.

## Por qué

Porque una condición latente medida y anotada no es un arreglo, y porque las tres
son la misma avería en tres tallas: algo que no cabe donde debería, y una regla
que decía lo correcto sin poder cumplirlo.

## Archivos tocados

- `src/styles/03-topbar.css` — la pista base de `actions` pasa a
  `minmax(min-content,1fr)`, con la medición escrita en su sitio.
- `src/styles/11-topbar.css` — los dos tramos que repiten esa plantilla (≤1439 y
  ≤1279); `.project-menu .overflow-home` nace apagado junto a los otros
  desbordamientos; se retiran `padding-left/right:8px` del tramo ≤460, que nunca
  aplicaron (`14-results.css` los pisa desde ≤1023 por orden de empaquetado —
  medido: 10 px, no 8).
- `src/styles/14-results.css` — el tramo ≤360 px apaga la marca y enciende la
  entrada de inicio del menú, con la razón y los números al lado.
- `src/features/topbar/TopBar.tsx` — entrada «Ir al inicio» en el menú del
  proyecto y `isRendered()`, que el enfoque de apertura y las flechas usan para
  saltar lo que el CSS tiene apagado.
- `qa.mjs` — el barrido pasa de 18 a **22 anchos** (baja a 320 px y mete 361/360,
  los dos lados del umbral: un gate que sólo mira un lado de una frontera no la
  vigila) y suma tres afirmaciones: que ningún control se salga de su celda, que
  «Ir al inicio» tenga exactamente una casa a cada ancho, y que abrir un menú deje
  el foco **dentro de él y sobre algo pintado**.

## Cómo verificar

```bash
npm run verify   # lint · docs · frontera protegida · pruebas · build · presupuesto
npm run qa       # checks compuestos con Chromium real
```

Leído de esta ejecución:

- `npm run verify` — `exit=0`. **233 archivos / 2283 pruebas** (8 omitidas).
  «Frontera protegida intacta: 38 archivos verificados», **sin** `--update`.
  Carga inicial 869 603 bytes / 223 061 gzip.
- `npm run qa` — `exit=0`, **158 checks**, ninguno en `false`, cero consola y cero
  errores de página. Barrido: **0 colisiones y 0 desbordes** en 22 anchos.
  `topbarStartHomes` = `{390:{ribbon:true,overflow:false}, 320:{ribbon:false,
  overflow:true}}`; `topbarMenuFocus` = los cuatro `true`.

**Los tres gates puestos en rojo, uno por defecto, cada uno por separado:**

| Se deshace | `npm run qa` dice |
|---|---|
| `minmax(min-content,1fr)` → `minmax(0,1fr)` | `topbarControlsStayInTheirZone`; `1280 ["actions«Analizar» 826–974 fuera de 385–924"]`, `1024 [… 788–912 fuera de 346–862]` |
| el apagado de la marca a ≤360 px | `topbarControlsNeverOverlap, topbarControlsStayInTheirZone, topbarGoToStartLivesInProjectMenuOnTheNarrowest`; colisión a 320 y desborde ya a **340** |
| `isRendered()` en el enfoque de apertura | `topbarMenusFocusAVisibleItem`; `utilidades@900:false`, `proyecto@390:false` — y `true` donde el primer ítem sí se ve |

La primera versión de ese tercer check daba verde con el defecto puesto: pedía
sólo que el elemento enfocado se viera, y `focus()` sobre algo apagado no hace
nada, así que el foco se quedaba en el disparador —visible— y pasaba. Se corrigió
a «dentro del menú **y** pintado» y entonces sí lo vio. Un gate que no se prueba
en rojo no es una red; éste lo demostró de la peor manera.

Evidencia en `reports/evidence/2026-08-23-cinta-sin-superposicion/`.

## Pendiente / siguiente paso

Nada pendiente de la Cinta. Queda una discontinuidad conocida y aceptada: al
cruzar de 360 a 361 px el nombre del proyecto se acorta de 79 a 24 px, porque la
marca vuelve y se lleva sus 44 px. Es inherente a cambiar un control de sitio en
un umbral, no un defecto que un número arregle.

El rediseño (fases 1 a 6) sigue cerrado y publicado.
