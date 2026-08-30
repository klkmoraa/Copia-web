# Versiones nombradas y su diff, dentro de la biblioteca

**Fecha:** 2026-08-24 03:38
**Agente:** Claude Code
**Rama:** claude/upgrade-integral-mejoras-lpa0pt

## Qué cambió

`src/storage/projectVersions.ts` y `src/data/projectDiff.ts` sabían guardar,
listar, comparar y restaurar desde la primera tanda. **Nadie los llamaba.** Un
`grep` de sus cuatro funciones exportadas no devolvía ni un consumidor fuera de
sus propias pruebas.

Ahora cada proyecto de la biblioteca lleva colgado un plegable **«Versiones»**:
se guarda el estado con un nombre, se elige una versión y se ve en qué se
diferencia del estado de ahora o de otra versión, y se restaura.

### Qué es «el estado actual» aquí

El registro de la biblioteca, no el modelo en memoria. `ProjectContext`
autoguarda en el repositorio en cada cambio —`repositorySaveChainRef`—, así que
el registro **es** lo último editado. Compararse contra otra cosa sería
compararse contra un estado que nadie tiene guardado, y en la pantalla de
bienvenida —donde vive la biblioteca— el modelo en memoria puede ser el de otro
proyecto.

### Restaurar deja de ser un camino de una sola dirección

`restoreRecovery` escribe la versión encima del proyecto y el estado que había
se perdía: era la única operación de la biblioteca de la que no se podía volver.
Antes de restaurar se tiende una copia de recuperación del estado actual —la
misma red que la importación DXF tiende antes de pisar un modelo—, y el panel lo
dice **antes** de que alguien pulse, no después.

### Las versiones salen del cajón de las copias recuperables

Una versión nombrada es un `RecoveryRecord` con etiqueta: comparten esquema,
almacén y ruta de restauración a propósito, y eso no cambia. Lo que cambia es
que el bloque «Copias recuperables» del hub las filtra: desde que cada proyecto
enseña las suyas, dejarlas también ahí las contaría dos veces y llamaría «copia
recuperable» a algo que se llama «Antes de subir las cargas». Una la pidió el
usuario y tiene nombre; la otra la tendió el producto solo.

### El diff, traducible

`describeDiff` resume un diff en una línea, y esa línea está escrita **en
español dentro de la frontera protegida**: sirve para un mensaje interno, no
para una interfaz que se lee también en inglés. `projectDiffSummary.ts` no
recalcula nada —el diff es el que es— sino que lo ordena, lo agrupa y lo
convierte en texto traducible. Cuatro decisiones que tiene:

- **El orden de las familias no es alfabético**, es el orden en que un modelo se
  construye —nudos, barras, cargas, casos—, porque un cambio en un nudo explica
  los cambios de las barras que lo tocan y leerlo al revés obliga a volver atrás.
  Un gate recorre un diff que toca **las nueve familias** y exige que el orden
  las nombre a todas: una familia nueva que no estuviera aquí desaparecería del
  panel en silencio.
- **Los números se leen en las unidades base del modelo**, y el panel lo dice.
  Convertirlos al sistema del usuario exigiría una tabla campo → magnitud —`x`
  es longitud, `A` es área, `angleDeg` no es ninguna— que se queda atrás en
  cuanto el modelo crezca, mintiendo justo en el campo nuevo.
- **Se recorta a 40 cambios por familia y se dice cuántos quedan fuera.**
  Restaurar una versión antigua de un modelo grande produce miles; cortar en
  silencio sería esconderlos.
- **Los tres estados se leen en la palabra, no en el color.** Teñir alta y baja
  de verde y rojo se descartó por dos motivos que apuntan al mismo sitio: deja
  fuera a quien no separa esos tonos, y el rol verde del sistema
  (`--sc-color-state-success`) mide 4,11:1, por debajo del mínimo para un texto
  de 10 px. Inventar aquí un verde a medida sería un literal fuera del sistema.

## Por qué

Mismo argumento que las dos tandas anteriores: un motor validado que no se puede
pedir no existe para quien usa la aplicación. Éste llevaba dos tandas escrito y
probado sin una sola puerta.

## Archivos tocados

Sin tocar la frontera protegida: «Frontera protegida intacta: 49 archivos».

- `src/features/project-hub/projectDiffSummary.ts` *(nuevo)* — presentación pura
  del diff: orden, agrupación, formato de valores y recorte.
- `src/features/project-hub/ProjectVersions.tsx` *(nuevo)* — el panel: guardar,
  listar, comparar, restaurar.
- `src/features/project-hub/ProjectHub.tsx` — cableado, filtro de las versiones
  en el bloque de copias y el nombre completo en `title`.
- `src/features/project-hub/projectHub.css` — el panel y su diff.
- `src/i18n/phase2Catalogs.ts` — 35 claves. La paridad la impone el tipo
  (`Phase2Catalog = Record<Phase2TranslationKey, string>`), no un gate aparte.
- `qa.mjs` — recorrido `projectVersions()` con navegador real.
- Gates: `projectDiffSummary.test.ts` *(nuevo)*, `ProjectVersions.test.tsx`
  *(nuevo)*, `ProjectHub.test.tsx`.

## Cómo verificar

```bash
npm run verify
npm run qa      # PLAYWRIGHT_CHANNEL=chromium PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
npm run verify:space3d
node scripts/validate-ci.mjs
```

Leído de esta ejecución:

- `npm run verify` — **exit=0**. **254 archivos / 2626 pruebas** (8 omitidas),
  frente a las 2605 con las que empezó el bloque. «Frontera protegida intacta:
  49 archivos verificados». Carga inicial 770 420 bytes / 195 888 gzip
  (+71 / +45 gzip: el hub ya viajaba en su propio chunk perezoso).
- `npm run qa` — **exit=0**, **191 checks** (11 nuevos), ninguno en `false`,
  cero consola y cero errores de página. Medido sobre el pórtico de ejemplo:
  con la versión guardada, aplicar W12x26 a M1 lleva `A` de **0,005** a
  **0,004935474 m²** y `sectionId` a `w12x26`; el diff al volver dice
  «Modificaciones: 1» sobre Barras · M1; restaurar devuelve **0,005** y deja
  `sectionId` vacío.
- `npm run verify:space3d` — **exit=0**.
- `node scripts/validate-ci.mjs` — **exit=0**.

### Gates nuevos, probados en rojo

| Se deshace | Qué falla |
|---|---|
| el filtro que saca las versiones de «Copias recuperables» | `qa` en `namedVersionIsNotCountedAsARecovery` |
| que la red se tienda antes de restaurar | 1 prueba del panel (no aparece la copia `manual`) |
| que una familia nueva entre en el orden del diff | la prueba de cobertura de las nueve familias |
| el recorte con su cuenta de sobrantes | 2 pruebas del módulo puro y 1 del panel |

## Tres cosas que salieron por el camino

**`page.waitForFunction` no espera una promesa.** El recorrido esperaba a que
IndexedDB reflejara un cambio con un predicado `async`; una promesa siempre es
un valor verdadero, así que la primera llamada la daba por cumplida y el QA
seguía leyendo el estado anterior —y afirmaba en verde sobre él—. Todo lo que se
lee de IndexedDB es asíncrono, así que el sondeo se mudó a Node y la página sólo
contesta lecturas. Es el mismo patrón que puede repetir cualquiera: **un
`waitForFunction` con `async` no vigila nada.**

**La biblioteca tiene más de un proyecto.** Al abrir el ejemplo quedan dos
registros —el vacío del arranque y el ejemplo—, y leer «el primero» apuntaba al
vacío, que no tiene M1: devolvía nulo sin decir por qué. El recorrido identifica
ahora la fila por el id del proyecto abierto.

**El nombre del proyecto se trunca, y no lo he arreglado.** La fila del hub es
flex con cuatro celdas, y la identidad es la única con `min-width: 0`: se lleva
todo el recorte. Medido a 1440, el nombre ocupa **44,5 px de los 436 de la
fila** y queda en «Pórti…» con la fecha y la revisión enteras al lado. Probé
darle una base del 40 % y dejar que la revisión cediera: **no funcionó** —la
medición volvió a dar 44,5 px, porque las otras tres celdas no bajan de 391 px—
y lo revertí en vez de dejar un comentario que afirmara un arreglo que no
ocurre. Es un reparto de fila que necesita su propia pasada y su propia
medición. Mientras tanto, el nombre completo viaja en `title`.

## Pendiente / siguiente paso

De la lista quedan tres:

1. **Guardar en disco y compartir** (`saveBytes`, `buildShareLink`).
2. **Diálogo de la propuesta de IA**, con el diff y la confirmación. Ahora tiene
   dónde apoyarse: `projectDiffSummary.ts` es exactamente lo que ese diálogo
   necesita para enseñar un `CommandProposal` antes de aplicarlo.
3. **Partición de `StructuralCanvas.tsx`** (~2 350 líneas).

Nombrado y no resuelto en este bloque: el **reparto de la fila del hub** (arriba,
con su medición). Siguen abiertos de antes: la descripción de una sección
construida no se persiste, el certificado y los estudios no entran en la memoria
PDF, y P-Delta con barras de signo restringido avisa en vez de componer.
