# CRI-107 · Datasheet en K0 — la rejilla se resolvía a altura 0

Evidencia de `npm run qa:datasheet-k0` (`scripts/qa-datasheet-k0.mjs`), que mide
**layout real** en Chromium sobre la aplicación construida. `report.json` lleva
las 38 comprobaciones con sus valores medidos.

## Causa raíz

`src/features/datasheet/datasheet.css`, dentro de `@media (max-width: 1023px)`:

```css
.datasheet-layout {
  grid-template-rows: minmax(0, 1fr) auto;   /* fila 1 = rejilla, fila 2 = panel */
}
```

Apiladas, la rejilla y `.datasheet-context` comparten la misma altura. Con la
fila del panel en `auto`, el panel **se sirve primero** su alto de contenido
entero; a `minmax(0, 1fr)` no le queda espacio libre que repartir y la fila de
la rejilla se resuelve a `0`.

`.datasheet-main` y `.datasheet-grid-scroll` declaran `min-height: 0` —lo
necesitan para poder encogerse dentro de su carril— así que **colapsan sin
protestar** en vez de desbordar: no hay síntoma visible salvo que la tabla
desaparece y el punto donde debería estar devuelve un nodo del panel.

## Before / after del valor que producía la altura 0

`getComputedStyle('.datasheet-layout').gridTemplateRows`:

| viewport | antes | después |
| --- | --- | --- |
| K0 portrait 390×844 | `0px 716.234px` | `533.188px 183.047px` |
| K0 landscape 844×390 | `0px 275px` | `202.25px 72.75px` |
| M1 1100×768 | `576.828px` | `576.828px` (sin cambio) |
| X2 1440×900 | `693px` | `693px` (sin cambio) |

`.datasheet-grid-scroll`:

| viewport | `clientHeight` antes | después | `scrollHeight` |
| --- | --- | --- | --- |
| K0 portrait | **0** | **255** | 2145 |
| K0 landscape | **0** | **57** | 2137 |
| M1 | 402 | 402 | 2137 |
| X2 | 562 | 562 | 2137 |

Hit-test con `document.elementFromPoint` sobre el centro visible de la rejilla:

| viewport | antes | después |
| --- | --- | --- |
| K0 portrait | `<line>` **dentro de** `.datasheet-context` | `<td>` dentro de `.datasheet-grid-scroll` |
| K0 landscape | `<svg>` **dentro de** `.datasheet-context` | `<button class="datasheet-sort">` dentro de la rejilla |

## El arreglo

```css
grid-template-rows: minmax(0, 1fr) fit-content(25%);
```

`fit-content` mantiene el panel medido por su contenido —cuando es corto ocupa
lo que ocupa y no reserva de más— pero le pone un tope: nunca más de un cuarto
de la superficie. La rejilla conserva siempre los tres cuartos restantes, y el
panel no pierde información porque `.datasheet-context__body` ya se desplaza por
dentro. Una sola declaración, sin altura mágica, sin `matchMedia` nuevo, sin
esconder nada y sin tocar M1 ni X2.

## Regresión

* `src/features/datasheet/datasheetStyles.test.ts` fija el contrato de la pista
  acotada; falla con `auto` y entra en el gate `npx vitest run src/features/datasheet`.
* `scripts/qa-datasheet-k0.mjs` mide el layout real: **28/38 sobre el CSS de
  `origin/main`** (10 fallos, todos del colapso) y **38/38 con el arreglo**.

## Capturas

* `k0-portrait-grid-visible.png` — 390×844, rejilla visible y desplazada.
* `k0-landscape-grid-visible.png` — 844×390.
* `m1-grid-visible.png`, `x2-grid-visible.png` — smoke de las clases no afectadas.
* `x2-peek.png` — ciclo de `peek` de CRI-102 con borrador sin aplicar.

## Dos defectos DISTINTOS encontrados de paso — no los toca este cambio

Ambos verificados sobre `origin/main` **con el CSS intacto**, así que ninguno lo
introduce este arreglo, que es sólo CSS. Quedan sin corregir a propósito: cada
uno decide política del broker y merece su propia issue.

1. **En K0, seleccionar suspende la superficie.** Pinchar una fila del Datasheet
   abre `contextual-actions`, que pasa a ser el `latest` de
   `resolveSurfaceActivity` y por tanto el ganador en Compact
   (`src/features/workspace/surfacePresentation.ts`), y el Datasheet queda
   `suspended`.
2. **En K0, "Localizar" no degrada a `peek`.** Por lo mismo: fija la selección,
   gana `contextual-actions` y la superficie se suspende en vez de encogerse.
   Medido en `origin/main` sin tocar el CSS: K0 `{peek:false, handle:false}`
   frente a X2 `{peek:true, handle:true}`. Es una regresión del contrato de
   CRI-102 en Compact.

Aparte, `npm run qa:model-doctor` ya falla en `origin/main` antes de llegar al
Doctor: su `enterWorkspace` busca el lanzador "Pórtico de ejemplo", que la
Bienvenida de CRI-104 ya no presenta así.
