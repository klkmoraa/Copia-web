# Cierre cromático · paleta lima oficial (previo a CRI-10)

**Clasificación:** `AUDIT/TEMPORARY` — evidencia de la ejecución del 2026-08-15.
La autoridad vigente de color es `brand/brandbook-clay.html`; este reporte sólo
documenta cómo se llegó a ella.

## Qué cambió

La identidad cromática pasa de la familia **teal/esmeralda** a una **lima viva**
y, sobre todo, deja de haber **dos paletas**. Antes cada rol semántico tenía un
hex de Día y otro de Noche; ahora tiene uno solo.

- Marca: `#159a72` / `#087e5c` → **`#89d448`** (relleno) + **`#468c09`** (trazo).
- Todos los roles técnicos, de estado, selección, foco y Aula: **un solo HEX**,
  declarado una vez en `:root` y prohibido en el bloque `[data-theme='dark']`.
- Se retira el segundo juego nocturno completo (`#eb8373`, `#72c3df`, `#78be83`,
  `#ab93e8`, `#86b9df`, `#f4d75e`, `#d8a579`).

## Por qué la marca se parte en dos roles

`#89d448` es claro: mide **1,65:1** contra el marfil. Eso lo inhabilita como
trazo —un subrayado o una línea de influencia pintados con él son invisibles—
pero no como **relleno**, que es lo que la dirección aprobada pedía. Así que la
lima hereda exactamente la partición que el brandbook ya usaba para el canario:

| rol | hex | trabajo |
|---|---|---|
| `--brand` | `#89d448` | relleno del CTA. Nunca trazo, nunca texto blanco (1,80:1). |
| `--brand-ink` | `#16250d` | tinta encima de ese relleno. 8,87:1. |
| `--brand-edge` | `#468c09` | canto, subrayado, snap, línea de influencia, eje Y 3D. 3,81:1. |

El canto no es decorativo: como el relleno no llega a 3:1 contra la superficie,
es `--brand-edge` quien cumple WCAG 1.4.11 y define la silueta del control.
`tokens.test.ts` lo fija; devolverlo a `transparent` rompe la prueba.

## Por qué ningún color técnico es pastel

Exigir un mismo HEX en los dos temas encierra el color en una franja estrecha de
luminancia relativa —**[0,146 … 0,293]**— la única en la que llega a 3:1 sobre
el lienzo *y* la superficie de ambos temas. El pastel queda fuera de esa franja
por definición: es demasiado claro para verse sobre papel. Lo pastel-vivo vive
donde sí cabe, en el relleno del CTA.

De ahí también las tres excepciones deliberadas, todas por medición:

1. **Tintas de texto sobre superficie** (`--sc-color-state-*-foreground`,
   `--sc-color-text-link`) **no pueden** ser invariantes. Entre la superficie de
   Día y la de Noche hay 15,7:1; un mismo color a 4,5:1 de las dos necesitaría
   20,25:1. Es imposible, no una omisión. La señal es invariante; la tinta que
   la escribe se recalibra.
2. **Rellenos suaves** (`--sc-color-action-subtle`, `--sc-color-selection`) son
   fondos, y los fondos cambian de fase por tema.
3. **Rampa del índice elástico** (`--sc-color-demand-*`) es una escala
   secuencial, no un significado: crece alejándose del fondo, y el fondo se
   invierte entre temas.

## Ganancia real de contraste

La paleta anterior sólo se medía contra el **lienzo**. En Noche la superficie
(`#15232b`) es más clara que el lienzo (`#0d161b`), así que era ella la que
mandaba — y nadie la comprobaba. Los valores nocturnos caían por debajo del piso:

| rol | antes Día | antes Noche | ahora (único) |
|---|---|---|---|
| axial N | 3,89 | **1,94** | 3,34 |
| cortante V | 3,60 | **2,16** | 3,34 |
| momento M | 3,58 | **2,56** | 3,60 |
| deformada | 3,44 | **2,54** | 3,46 |
| reacción | 3,65 | **2,05** | 3,26 |
| cota | 3,25 | **1,39** | 3,36 |
| eje | **2,87** | **2,14** | 3,36 |
| selección | **2,87** | **1,94** | 3,22 |
| success | 3,02 | **2,16** | 3,43 |

(peor de los cuatro fondos: lienzo y superficie × Día y Noche)

Es la primera vez que toda la familia técnica supera 3:1 en ambos temas.

## Distinguibilidad

Unificar los hexes fija la luminancia y quita ese eje de separación, así que la
luminancia se **repartió** a propósito dentro de la franja en vez de centrarla:
pinchar todos los roles en el mismo valor volvía confundibles los hues vecinos.
Medido en OKLab sobre 13 parejas que pueden coincidir en pantalla, **12 quedan
iguales o mejores** que antes y el ΔE mínimo sube de **0,03 a 0,05**.

La única que baja es `axial vs selección` (0,13 → 0,11), a cambio de que
`axial vs reacción` suba de 0,03 a 0,10 — la pareja que de verdad convivía en el
lienzo. Ningún significado depende sólo del color: forma, icono y etiqueta
siguen siendo el refuerzo, como fija el brandbook.

## Archivos tocados

| archivo | qué |
|---|---|
| `brand/brandbook-clay.html` | paleta canónica, swatches, tabla de ratios, tokens, regla relleno/trazo. Cierra la nota de revisión de los tres verdes. |
| `brand/manifest.json` | hash y tamaño nuevos + motivo de la sustitución. |
| `src/design-system/tokens.css` | familia lima, roles invariantes, `--sc-color-action-edge/-ink`, `--sc-color-canario`, `--sc-color-aula-solid`, `--sc-color-on-signal`. |
| `src/design-system/tokens.test.ts` | 4 gates nuevos: invariancia, señal legible sobre superficie, canto+tinta del CTA, prohibición de blanco sobre la lima. |
| `src/design-system/components/ui.css` | canto del CTA; `--danger` pasa a la pareja `error-solid`/`error-on-solid`. |
| `src/styles.css` | reparto `--accent` (tinta) / `--accent-fill` (relleno); indicadores finos al trazo. |
| `src/space3d/view/threeViewport.ts` | respaldos ya no son "valores de Día"; `axisY` usa el trazo, no el relleno. |
| `src/features/welcome/StructuralPortalHero.tsx` | `clay-mint` → `clay-lime`. |
| `src/features/{space3d,bulk-edit}/*.css` | cantos medidos en controles rellenos de marca. |
| `index.html`, `public/site.webmanifest`, `public/favicon.svg` | cierra el `#157A55` histórico de PWA/favicon que el brandbook señalaba. |
| `src/design-system/lab/componentLab.css` | las direcciones teal quedan marcadas como superadas, no como opciones. |

## El reparto de `--accent` (lo más fácil de romper)

De los ~158 usos de `--accent` en `styles.css`, **~136 son tinta, trazo o borde**
y sólo 15 eran relleno. Apuntarlo al relleno claro habría dejado texto y trazos
a 1,8:1 en toda la aplicación. Por eso:

- `--accent` → **tinta** (`#468c09`).
- `--accent-fill` → **relleno** (`#89d448`), el único que puede ir bajo
  `--accent-foreground`.

`background:var(--accent)` con texto encima ya no cumple. La prueba
`never puts white ink on the light brand fill` lo bloquea.

## Cómo verificar

```bash
npm run typecheck
npx vitest run src/design-system --maxWorkers=1     # 69 pruebas
npm run lint
npm run verify:docs
npm run verify:protected
```

Contraste sobre valores **computados** por un navegador real (no jsdom), que es
lo único que evalúa los `color-mix()` del gradiente clay: 25 roles idénticos en
Día y Noche, y todas las parejas por encima de su piso. El script está en
`reports/evidence/` del día.

## Pendientes (fuera de este cierre)

- CRI-10 diseña sobre esta paleta; layout, navegación, Inspector, Results y
  ToolRail no se tocaron aquí.
- Las capturas de `prototypes/ios-app/screenshots/` y su `tokens.css` siguen en
  teal: son un prototipo congelado, no la aplicación.
- `src/design-system/tokens.css` cita un `README.md` de la familia grafito que no
  existe. Es previo a este cambio y no afecta a color.
