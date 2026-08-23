# La Cinta deja de pintarse encima de sí misma

**Fecha:** 2026-08-23 17:17
**Agente:** Claude Code
**Rama:** claude/redeseno-total-mejoras-gimaf7

## Qué cambió

A 390 px la barra superior se superponía consigo misma: el nombre del proyecto
sobre deshacer y el galón del menú sobre rehacer. Estaba anotado como
preexistente al empezar el rediseño y era el único defecto que quedaba abierto.

No era una medida mal puesta. Era la cascada. `.topbar-tool-group { display:flex }`
(`22-topbar.css`) tiene la misma especificidad (0,1,0) que las reglas que mandaban
el historial y la exportación al desbordamiento, y se empaqueta **después**: las
ganaba por orden. Consecuencias medidas en Chromium sobre el `dist/` de producción:

- Entre **701 y 1279 px**, deshacer y rehacer aparecían **dos veces** — en la
  Cinta y en «Más acciones» —, porque la mitad que los apagaba en la Cinta perdía
  y la mitad que los encendía en el menú ganaba.
- Entre **701 y 1439 px**, el icono de exportación tampoco se iba nunca.
- Por debajo de **700 px** esos 99 px de historial dejaban la celda de `document`
  en 31 px con 128 px de contenido táctil dentro. Un contenido que no cabe en su
  celda no se recorta: se sale. De ahí la superposición, real y medida a 500, 460,
  430, 390, 375 y 360 px.

## Por qué

Tres reglas escritas, ninguna en vigor. `AGENTS.md` dice que una regla que deja de
valer se reescribe explicando por qué, nunca se relaja en silencio — aquí no hacía
falta ni relajar ni reescribir el umbral por gusto: bastaba **medirlo**. El barrido
en navegador dice que la Cinta cabe holgada hasta 701 px y que el conflicto empieza
a 500. Así que los umbrales viejos (1279 para el historial, 1439 para exportación)
no describían nada: se retiran, y el historial se une a las cuatro capacidades que
ya ceden en el sub-umbral de teléfono (700 px), donde «Más acciones» lo recoge
entero. Ninguna capacidad queda huérfana y ninguna tiene dos casas.

## Archivos tocados

- `src/styles/11-topbar.css`
  - `@media (max-width:1439px)` — se retira `.export-wrap { display:none }`, que
    nunca apagó nada, con la razón escrita en su sitio.
  - `@media (max-width:1279px)` — se retira el par `.history-controls` /
    `.mobile-history-actions.overflow-history`, que producía el duplicado.
  - `@media (max-width:1023px)` — se retira el `.history-controls { display:none }`
    duplicado, muerto por lo mismo.
  - `@media (max-width:1023px)` — `.project-name input` pasa de `min-width:32px` a
    `min-width:0`. Ese suelo era lo que convertía «encoger» en «desbordar»: un
    mínimo que el contenedor no puede pagar no se recorta, se sale.
  - `@media (max-width:700px)` — el historial entra en la lista de degradación con
    selector compuesto (0,2,0), que sí gana, y el desbordamiento lo enciende aquí.
    Además el grupo que se queda vacío se apaga entero y «Más acciones» pierde el
    filete que ya no separa nada: `+` empareja hermanos del **DOM**, no hermanos
    visibles, así que el separador y sus 17 px sobrevivían a los grupos que
    separaban. El nombre del proyecto pasa de 32 px superpuestos a **53 px
    limpios** a 390 px («Pórti…» en vez de «P…»).
- `src/styles/14-results.css` — el `min-width:0` del tramo ≤360 px queda redundante
  y se retira; sólo se queda el ancho visible.
- `qa.mjs` — gate nuevo `verifyTopBarNeverOverlapsItself()`: barre 18 anchos entre
  1536 y 360 px sobre el `dist/` real y afirma el **efecto**, que dos controles de
  zonas distintas no compartan un píxel, más «una sola casa para el historial» a
  390 y 900 px con el menú abierto. Ninguna prueba de jsdom puede ver esto: allí no
  hay cascada, ni `@media`, ni geometría.

## Cómo verificar

```bash
npm run verify   # lint · docs · frontera protegida · pruebas · build · presupuesto
npm run qa       # checks compuestos con Chromium real
```

Resultados leídos de esta ejecución:

- `npm run verify` — `exit=0`. **233 archivos / 2283 pruebas** (8 omitidas).
  «Frontera protegida intacta: 38 archivos verificados», **sin** `--update`.
  Carga inicial 869 505 bytes / 223 045 gzip.
- `npm run qa` — `exit=0`, **153 checks**, ninguno en `false`, cero errores de
  consola y de página. El barrido de la Cinta: **0 colisiones** en los 18 anchos.
  `topbarHistoryHomes` = `{390: {ribbon:false, overflow:true}, 900: {ribbon:true,
  overflow:false}}`.

**El gate se puso rojo a propósito** antes de darlo por bueno: deshaciendo las dos
líneas del arreglo, `npm run qa` sale con `exit=1` y nombra
`topbarControlsNeverOverlap, topbarHistoryLivesInOverflowOnPhones`, con el detalle
por ancho en `qa-artifacts/qa-results.json`:

```
500 ["document«Abrir proyectos y ejemplos» ∩ actions«Deshacer»"]
460 ["document«Abrir proyectos y ejemplos» ∩ actions«Deshacer»"]
430 ["document«Abrir proyectos y ejemplos» ∩ actions«Deshacer»"]
390 ["document«Nombre del proyecto» ∩ actions«Deshacer»", …3]
375 [… 3]
360 [… 4]
```

El recuento de checks pasa de 150 a 153: **+4** del gate nuevo y **−1** de
`welcome390x844HasScrollableOverflow`/`TouchScroll`, las dos condicionales que sólo
se emiten cuando la bienvenida desborda. Esta vez midió `844 = 844` exacto y no
desbordó, así que no se emitieron — es la medición de ±3 px ya documentada en
`qa.mjs`, sin relación con este cambio.

Evidencia en `reports/evidence/2026-08-23-cinta-sin-superposicion/`.

## Pendiente / siguiente paso

Dos cosas quedan medidas y **no** arregladas, con su razón:

1. **Por debajo de 360 px la Cinta se queda sin ancho de verdad.** A 320 px sus
   tres zonas piden 93 px de dianas táctiles en una celda de 70. No es un número
   que mover: exige quitarle su casa a un control —«Ir al inicio» no está en
   ningún otro sitio de la Cinta— o romper el suelo táctil de 44 px. El suelo del
   barrido son 360 px, el teléfono más estrecho que el producto atiende.
2. **Entre 1024–1100 y 1280–1360 px el botón «Analizar» se sale de su celda**,
   pero cae en el hueco entre columnas: no toca ningún control de `status`, así
   que no hay superposición. Es el contrato CRI-95 en acción —«los comandos
   conservan su ancho»— con la zona `document` tomando `max-content` en vez de
   ceder primero. Queda anotado como condición latente, no como defecto abierto:
   el gate afirma colisiones reales, no desbordes de celda sin consecuencia.

El resto del rediseño (fases 1 a 6) está cerrado y publicado.
