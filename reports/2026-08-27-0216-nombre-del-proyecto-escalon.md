# Un teléfono más ancho leía menos nombre de proyecto

**Fecha:** 2026-08-27 02:16
**Agente:** Claude Code
**Rama:** claude/dock-topbar-improvements-kzoef9

## De dónde sale
El reporte anterior (`2026-08-27-0122-bandeja-y-riel.md`) dejó **una decisión abierta**: el
campo del nombre del proyecto medía 50 px a 390 px, y esconder la marca para dárselos
chocaba con `topbarGoToStartLivesInBrandMarkOnPhones`, un check declarado de `qa.mjs`. El
usuario delegó la decisión. Antes de tomarla se midió la curva entera, y la curva la toma
sola.

## Lo que se midió
Ancho del campo del nombre, y caracteres que caben en él, barriendo de 320 a 1023 px con el
nombre por defecto:

| ancho | campo | caracteres | qué cambia |
|---|---|---|---|
| 360 px | 79 px | **8** | la marca está cedida (regla ≤360) |
| **361 px** | **24 px** | **2** | **vuelve la marca** |
| 390 px | 53 px | 5 | |
| 460 px | 100 px | 11 | |
| **461 px** | **86 px** | **9** | fin del tramo declarado |
| 700 px | 190 px | 22 | |
| **701 px** | **83 px** | **9** | entran seis destinos a la Cinta |

Un píxel más de pantalla costaba **seis caracteres** en 360→361. Eso no es la degradación
ordenada de CRI-95: es una discontinuidad.

## El criterio con el que se decidió
CRI-95 dice que el nombre cede antes que los comandos. Mirado por el otro lado, eso
significa que **el nombre sólo debe pagar cuando la Cinta gana capacidad**. Con ese criterio
los tres escalones se separan solos:

- **361 y 461 · no se sostienen.** Lo que vuelve es la marca, y la marca es identidad, no
  capacidad: su única acción, «Ir al inicio», ya está servida por `.overflow-home` —la
  primera entrada del menú del proyecto— a los dos lados de la frontera. El nombre pagaba
  por nada.
- **701 · legítimo.** Entran seis destinos de verdad (Resultados, Hoja de datos, Space 3D,
  deshacer, rehacer y exportar) y el nombre paga 107 px por ellos. Es la escalera declarada.
  **No se toca**, y queda anotado abajo con su número.

## Qué se hizo
1. **La marca cede hasta 475 px**, con el mismo trato que ya tenía por debajo de 360:
   `.brand-home-button` apagada y `.overflow-home` encendida. 475 no es redondo — es el
   último ancho al que el campo *todavía* paga por la marca: con la marca puesta el campo
   recupera sus 100 px justo en **476** (101 px), y por debajo se queda corto (86 a 461).
2. **El check de `qa.mjs` se reescribió, no se relajó.** `topbarGoToStartHasExactlyOneHome`
   —la invariante que de verdad protegía: la capacidad ni desaparece ni se duplica— sigue
   intacta y ahora barre **siete anchos** en vez de dos, con los dos lados de la frontera
   (475/476). Los dos checks de ubicación se sustituyen por
   `topbarGoToStartLivesInBrandMarkAbove475` y `topbarGoToStartYieldsToOverflowUpTo475`.
3. **Un gate nuevo afirma la regla, no el umbral** (`scripts/qa-topbar.mjs`): en 146 anchos
   entre 320 y 1023, *el nombre nunca pierde caracteres legibles sin que la Cinta haya
   ganado un control pintado*. La marca se excluye del recuento a propósito — es justo lo
   que la hace ceder. Si mañana se mueve el reparto, el gate sigue diciendo la verdad sin
   tocarlo.
   La unidad es el **carácter**, no el píxel: entre tramos cambian la cara (12 px bajo 700,
   13 por encima) y los rellenos, así que comparar píxeles acusaría de regresión a un tramo
   que en realidad lee lo mismo.
4. **De paso, una carrera en el propio gate.** `openMenu` leía `document.activeElement` en
   cuanto el menú se hacía visible, pero `TopBar` coloca el foco dentro de un
   `requestAnimationFrame`: con dos anchos colaba, con siete fallaba. Ahora espera dos
   cuadros antes de medir. No enmascara nada — si el foco no llega, sigue dando `false`.

## Resultado
| | antes | después |
|---|---|---|
| Campo del nombre a 390 px | 53 px · **5 caracteres** | **100 px · 11 caracteres** |
| Escalón 360→361 | 8 → **2** caracteres | 8 → 8 |
| Escalón 460→461 | 11 → 9 caracteres | sin escalón (la frontera se mueve a 475/476: 11 → 11) |
| Escalón 700→701 | 22 → 9 caracteres | **igual, a propósito**: entran seis destinos |
| Anchos vigilados para «Ir al inicio» | 2 | 7, con los dos lados de la frontera |

## Archivos tocados
- `src/styles/14-results.css` — la marca cede en 361–475, con la derivación del 475 escrita.
- `qa.mjs` — check de ubicación reescrito con su porqué; `openMenu` deja de correr una
  carrera contra el `requestAnimationFrame` del foco.
- `scripts/qa-topbar.mjs` — gate nuevo de la escalera del nombre (146 anchos, en caracteres).

## Cómo verificar
```bash
npm run verify    # 259 archivos, 2670 pruebas, frontera protegida intacta
npm run qa        # 192 checks, 0 errores de consola, 0 de página
npm run qa:topbar # incluye la escalera del nombre
npm run qa:dock
```
El gate nuevo se comprobó en rojo antes de darlo por bueno: sobre el CSS anterior nombra
**los dos** escalones con sus números (`360→361: 11→1 caracteres`, `460→465: 14→12`), lo que
además demuestra que arreglar sólo el de 360 no habría bastado.

## Pendiente / siguiente paso
Nada pendiente para esta tanda. Queda **anotado, no pendiente**: a 701 px el nombre cae de
22 a 9 caracteres porque seis destinos entran a la Cinta de golpe. Es un intercambio real y
la escalera lo declara, así que no se toca aquí; si algún día se quiere suavizar, el sitio
es el reparto de `.topbar-tool-group` y el gate de la escalera ya lo dejará pasar mientras
la Cinta gane capacidad a cambio.
