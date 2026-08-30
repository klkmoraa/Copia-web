# Fase 6 del rediseño total · partir `styles.css`

**Fecha:** 2026-08-23 07:31
**Agente:** Claude Code
**Rama:** `claude/redeseno-total-mejoras-gimaf7`

## Qué cambió

`src/styles.css` deja de ser un archivo de **5 106 líneas** y pasa a ser un manifiesto de
44 líneas que importa **29 tramos** en `src/styles/`, cada uno nombrado por el dominio
que lo ocupa: `01-shell`, `02-welcome`, `03-topbar`, `04-results`, `05-canvas`…

**El CSS construido es byte a byte idéntico: 290 019 bytes antes y después.** Ésa es la
evidencia de que no hay cambio visual, y es más fuerte que cualquier captura.

## Por qué los tramos van numerados, y por qué no hay un `welcome.css` a secas

Éste es el hallazgo de la fase, y salió de intentarlo mal primero.

**Se intentó el corte limpio por dominio** —una hoja por área— con una comprobación de
cascada que parecía suficiente: para cada (contexto de at-rule, selector, propiedad),
que el último valor declarado no cambiara. Pasó: 2 186 pares idénticos. Se construyó, y
el CSS resultante también daba «cascada equivalente» con 2 567 pares.

**Y estaba roto.** `npm run qa` falló: el botón de **Analizar dejó de ser pulsable a
690×390**, porque `.analysis-status` de la zona de estado se le ponía encima.

La comprobación tenía un agujero. Compara selector contra sí mismo, y con la misma
especificidad la disputa también ocurre **entre selectores distintos que casan sobre el
mismo elemento**. El reparto por dominio movía **2 267 selectores** de sitio; entre ellos,
`@media (width<=1023px) .analysis-status` bajaba 832 posiciones y cambiaba de ganador
contra reglas de la barra superior. Ninguna prueba unitaria lo veía. Lo cazó el navegador.

Así que el corte es por **tramos contiguos**: cada archivo es un trozo del original, en su
sitio. La cascada es idéntica **por construcción**, no por comprobación —medido: **0
selectores cambian de posición** en el CSS construido—.

Que `welcome` aparezca en cuatro tramos (`02`, `19`, `21`, `29`) no es un defecto del
corte: es el estado real del archivo, que estaba escondido dentro de 5 106 líneas y ahora
se ve. Ordenarlo de verdad por dominio es un trabajo aparte, que exige resolver esas
disputas una a una y no repartir a ciegas.

## Archivos tocados

- `src/styles.css` — manifiesto. Tokens y caras primero, luego los 29 tramos.
- `src/styles/01-shell.css` … `29-welcome.css` — **nuevos**, el contenido íntegro y en
  orden.
- `src/styles/stylesManifest.test.ts` — **nuevo**, el gate.

## Cómo verificar

```bash
npm run verify
PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run qa
```

Los dos ejecutados y leídos:

- `npm run verify` — **233 archivos / 2283 pruebas** (8 saltadas), lint limpio,
  `verify:protected` = «Frontera protegida intacta: 38 archivos» **sin refrescar la línea
  base**. Carga inicial **869 376 bytes**, la misma que la Fase 5 a byte.
- `npm run qa` — **150 checks**, `exit=0`, ninguno en `false`, cero consola.

**El gate cuida lo que hay que cuidar:**

| Prueba | Qué fija |
|---|---|
| No declara nada por su cuenta | El manifiesto ordena, no define. |
| Cada tramo una vez, ninguno huérfano | Un archivo suelto sin importar es CSS muerto. |
| Tokens y caras primero | Todo lo de abajo los lee. |
| **Orden numérico = orden de importación** | Ese orden **es** la cascada. |
| Tramos por debajo de 1 200 líneas | Que no vuelva a crecer un monolito. |

**Puede ponerse rojo**, comprobado: intercambiados `03-topbar` y `04-results` en el
manifiesto, la prueba del orden cae. Es exactamente el fallo que rompió el botón de
Analizar.

## Pendiente / siguiente paso

**El Paso B del plan no se hace, y la razón es la de arriba.** Consistía en sacar las
hojas de features diferidas del chunk de entrada para que cargaran con su chunk. Mover
una hoja a un chunk diferido la mueve **al final de la cascada**, que es precisamente la
clase de cambio que esta fase acaba de demostrar que rompe cosas en silencio. Hacerlo
exige resolver antes las disputas entre dominios, una a una y con el navegador delante.

Con esto quedan cerradas las seis fases del plan. Sigue abierto, y es preexistente, el
solape de la barra superior a 390 px anotado en el reporte de la Fase 1.

`npm run qa:webkit` no se ejecutó: WebKit no está instalado en este entorno.
