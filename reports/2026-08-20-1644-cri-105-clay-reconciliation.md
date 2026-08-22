# CRI-105 · Reconciliación Clay — radios por rol, canto obligatorio y una sola fuente de luz

**Fecha:** 2026-08-20 16:44 UTC
**Agente:** Claude Code
**Rama:** `main`
**Baseline:** `c7f0bdeaeaf0d9b97e36e17810099e5446d1e415` (`origin/main`, CRI-108 integrado)
**Issue:** CRI-105 (LEDGER-01, V-04/V-05)

## Qué cambió

StructureCo dejó de tener dos sistemas de relieve conviviendo. Los radios siguen ahora la escala del Brandbook repartida **por rol** (dato 0 · control 10 · tarjeta 18 · panel/hoja 24 · modal 28 · pastilla 999), la profundidad escala **por tamaño físico** y no por importancia, ningún desenfoque supera el radio de la pieza que lo consume, el pulsado invierte la luz sin dejar ninguna capa exterior, el hundimiento sale de **un solo token** que `prefers-reduced-motion` apaga de una vez, y **ninguna pieza declara su propia fuente de luz**. Se cerró además la duplicación conocida de `.canvas-layer-switch`.

No cambió ningún HEX, ni una sola ruta funcional, ni el solver, el modelo, el schema o la persistencia.

## Por qué

CRI-91 fijó la escala en el Brandbook y CRI-90 formalizó los seis niveles, pero el producto seguía implementando ocho radios propios (8/12/14/26/26/32/26/28) que **no coincidían con ninguno** de los cinco del Brandbook — la desviación que LEDGER-01 ya gobierna. Encima, piezas creadas en épocas distintas habían acumulado su propia iluminación local: un halo de marca bajo cada control "activo", tres literales de sombra escritos a mano, dos gradientes de volumen reproducidos por componente y dieciocho magnitudes distintas del mismo hundimiento.

## Baseline

La descripción de CRI-105 apuntaba a `7fb927fb6d118925e63365d1a2bb2813f8795385`. `origin/main` había avanzado legítimamente hasta `c7f0bde` (CRI-107 y CRI-108, ambos Done). Se revalidó cada archivo contra `main` en vez de confiar en las líneas citadas por el issue: `.canvas-layer-switch` ya no estaba en 2161/3677 sino en 2237/3716, y `styles.css` tiene 5209 líneas, no 4895. Nada del avance contradice CRI-105.

## Fuentes canónicas leídas

`brand/brandbook-clay.html` (V-02, V-03, V-04, V-05, V-06, V-09, V-10, V-11, V-12, V-13, V-14 y la tabla de tokens de la sección 04) · `brand/README.md` · `docs/README.md` · `AGENTS.md` · CRI-105 completa en Linear con sus criterios, riesgos, QA y evidencia exigida · CRI-90, CRI-91, CRI-98, CRI-100/101, CRI-104, CRI-107, CRI-108.

**Autoridad de la escala — V-05, literal:** «Radio por rol. Control 10px · card 18px · panel/sheet 24px · modal 28px · pill 999px.»

## Inventario previo

Recogido en `reports/evidence/2026-08-20-cri-105-clay/audit.md` §1-§2. Los titulares:

- **3** literales de `box-shadow` en todo `src/**` (los tres en `styles.css`). El resto ya derivaba de tokens: la fuente de luz estaba casi centralizada y el trabajo era cerrar las fugas, no reescribir la materia.
- **18** literales de hundimiento en estados pulsados, más la regla global `:where(…):active { transform: scale(.975) }` de `ui.css` — que además quedaba **fuera del alcance de `prefers-reduced-motion`**, porque el token es lo único que ese bloque apaga.
- **8** consumidores de `--sc-shadow-contact`, todos estados `active`/`aria-pressed`: un halo de marca exterior que **elevaba** lo que debía hundirse.
- `--sc-glow-accent` y `--sc-glow-aula`: **cero** consumidores.
- `.canvas-layer-switch`: dos definiciones base incompatibles (32×18 con pulgar de 14px y 38×22 con pulgar de 16px) y **ningún marcado que las usara**.

## Decisiones tomadas

1. **La escala genérica sobrevive como alias, no como valores.** Repuntar 180 consumidores uno a uno habría sido un refactor, no una reconciliación. `--sc-radius-xs/sm/md/lg/xl/2xl/hero/sheet` pasan a resolver a un escalón del Brandbook, elegido por lo que sus consumidores **son** hoy (`md` viste botones, campos y herramientas → control). Sólo los pocos cuyo rol no coincidía con su alias se repuntaron a mano: diálogo, superficie de popover, paleta de comandos, panel de capas, superficie de edición estructural, generador.
2. **El tope `blur ≤ radio` se demuestra, no se estima.** Cada escalón de profundidad está emparejado con un radio y una prueba comprueba la desigualdad en los dos temas. Una segunda prueba la comprueba sobre las piezas reales: toda regla que declara a la vez su radio y su sombra dice por sí sola qué esquina tiene y cuánto desenfoca.
3. **De `xs` a `sm` la altura la lleva el desplazamiento, no el desenfoque.** Las dos visten piezas con radio de control, así que el tope es 10px para ambas; separar un hover de un reposo dentro de ese presupuesto se hace con offset y opacidad. Es lo correcto físicamente y evita subir radios para legalizar sombras.
4. **La acción menta conserva relleno, canto y tinta; pierde su fuente de luz propia.** Su elevación exterior pasa a la misma física neutra que el resto (`3px 4px 8px` de grafito + contraluz arriba-izquierda). El acento sigue modelando el volumen **dentro** de la pieza, donde es relleno y no luz.
5. **`--sc-shadow-contact` se retira.** Sus ocho consumidores eran estados elegidos que se elevaban con un halo verde. Todos pasan a la cavidad neutra: un control activo **baja**. Con cero consumidores, dejar el token vivo sería dejar la trampa puesta.
6. **`--sc-glow-accent` y `--sc-glow-aula` se conservan** aunque no los use nadie: `tokens.test.ts` exige que existan, y relajar una prueba existente para cerrar esta tarea no entra. Ninguna pieza Clay depende de un halo, que es lo que el criterio pide.
7. **No se recorrió `styles.css` limpiando.** Cada línea tocada responde a un criterio de CRI-105. La deuda de duplicación en alcance era una sola y es la que se cerró.

## Radios por rol

| Rol | Token | Valor | Quién lo usa |
|---|---|---|---|
| Dato técnico | `--sc-radius-data` | `0` | Celdas del Datasheet, `.results-table`, editor de celda |
| Control | `--sc-radius-control` | `10px` | Botones, icon buttons, campos, herramientas, segmentos, chrome del lienzo, tooltips, `LayerToggle` |
| Tarjeta | `--sc-radius-card` | `18px` | `.result-extreme-card`, banner, tira de estado, resumen del Inspector, `.cut-tooltip`, `.repeat-preview`, `peek` |
| Panel / hoja | `--sc-radius-panel` | `24px` | `.sc-popover__surface`, sheets y drawers, `.canvas-layer-panel`, `.structural-edit-surface`, `.structure-generator` |
| Modal | `--sc-radius-modal` | `28px` | `.sc-modal-surface--dialog`, `.command-palette` |
| Pastilla | `--sc-radius-pill` | `999px` | Badges, chips, `.canvas-mode-badge`, `.canvas-status`, `.canvas-hint`, `.repeat-action-control` |

**CRI-90 intacto:** una hoja pegada al borde del viewport no redondea el borde que lo toca. Medido en el Datasheet: `border-radius: 24px 24px 0px 0px` en Día y en Noche.

## Profundidad por tamaño

| Token | Radio emparejado | Blur Día / Noche | Consumidores representativos |
|---|---|---|---|
| `--sc-shadow-clay-xs` | control · 10px | 8 / 8 | Control en reposo, icon button, herramienta, pulgar del interruptor |
| `--sc-shadow-clay-sm` | control · 10px | 10 / 10 | Hover de control, chrome del lienzo, enlace de salto, tooltip del riel |
| `--sc-shadow-clay-md` | tarjeta · 18px | 16 / 16 | `RAISED`: topbar, ToolRail, Inspector, Results; `.cut-tooltip`, `.repeat-preview`, `.contextual-actions` |
| `--sc-shadow-clay-lg` / `-floating` | panel · 24px | 22 / 22 | `FLOATING`: popovers, toast, panel de capas, edición estructural, generador |
| `--sc-shadow-sheet` | panel · 24px | 18 / 18 | `SHEET`: Datasheet, Model Doctor, drawers |
| `--sc-shadow-modal` | modal · 28px | 26 / 26 | `MODAL`: diálogo, pantalla completa, paleta de comandos |
| `--sc-shadow-clay-pressed` | control · 10px | 7 / 7 | Todo estado pulsado o elegido, campos en reposo, bandeja del riel |

Antes `clay-md` desenfocaba 34px y `clay-lg` 39px, con radios de 10-14px debajo: **ningún** escalón cumplía el tope.

**El único caso en que la desigualdad no muerde** son los paneles a sangre completa contra el viewport (topbar, Inspector y Results acoplados): CRI-90 les quita el redondeo contra el borde, su radio es `0` y no hay esquina que acotar. Ahí quien los separa del lienzo es el canto de 1px, y por eso ahí el canto es obligatorio.

Una tarjeta de Results usa `clay-md` porque mide lo que mide, **no** porque el resultado sea favorable. La profundidad no comunica verdad.

## Fuente de luz

Arriba-izquierda, fija, declarada una sola vez en `tokens.css`. Cada escalón volumétrico lleva exactamente dos capas exteriores: sombra oscura abajo-derecha (offsets positivos) y contraluz arriba-izquierda (offsets negativos). Una prueba lo comprueba capa por capa, en los dos temas.

Fugas cerradas:

- `.topbar .compact-select:hover` y `.topbar .project-name input:hover` — cavidad escrita a mano en Día y otra distinta en Noche → `--sc-shadow-clay-pressed`, que ya cambia por tema.
- `.toggle-row input[type='checkbox']::after` — volumen modelado con un gradiente entre dos superficies más una sombra exterior propia → `--sc-shadow-clay-xs`.
- `.toggle-row input[type='checkbox']:checked` — reproducción literal de la arcilla teñida (mismo ángulo, mezcla con blanco y con negro) → `--sc-gradient-clay-action` + `--sc-shadow-clay-action-pressed`.
- `--sc-shadow-clay-action` / `-hover` / `-pressed` — proyectaban menta al 28% en vertical → física neutra con contraluz.

Búsqueda de cierre, pegada:

```
$ rg -n "box-shadow:\s*(?!.*var\()(?!.*none)" -P src --glob '!*.test.*'
(sin resultados)

$ rg -n "black" src --glob '*.css' | grep -v tokens.css
(sin resultados)
```

La única mezcla con negro del sistema —la mitad en sombra del volumen clay— vive sólo en `tokens.css`. Las dos comprobaciones están además como pruebas, para que no vuelvan.

## Pressed y active

Un solo token: `--sc-clay-press-transform: translateY(1.5px) scale(0.985)`. Los 18 literales dispersos y la regla global de `ui.css` lo nombran ahora. Se dejaron intactos los `transform` funcionales: `translateX` del pulgar de un interruptor, `scaleX` del subrayado de una pestaña, arrastre, zoom y animaciones de entrada.

Medido con `getComputedStyle`, capas exteriores de `box-shadow` (un pulsado correcto vale 0):

| Control | Antes | Después |
|---|---|---|
| `.sc-button--primary` pulsado | 0 | 0 |
| `.sc-icon-button` pulsado | **2** | **0** |
| `.sc-tool-button` pulsado | 0 | 0 |
| `.sc-segmented button` elegido | 0 | 0 |

El icon button conservaba dos capas exteriores al pulsarse: parecía flotar más, no hundirse.

`active` nunca eleva: los ocho consumidores del halo de marca pasan a la cavidad. El icono de la tecla activa del dock móvil dejó de llevar su propio empujón de 1px — la tecla entera baja con el token, y ese empujón sobrevivía al movimiento reducido.

## Reduced motion

El relieve permanece, el hundimiento se retira, y se retira desde el token:

| | `transform` | `box-shadow` |
|---|---|---|
| Normal | `matrix(0.985, 0, 0, 0.985, 0, 1.5)` | 3 capas, todas `inset` |
| `reduce` | `none` | 3 capas, todas `inset` — **idénticas** |

Canto: `1px` en los dos casos. Ningún token de materia se neutraliza bajo `reduced-motion`; una prueba lo comprueba recorriendo el bloque entero.

## Elevaciones anidadas corregidas

- **`.inspector-summary` dentro de `.inspector-panel`.** Los dos estaban en el grupo `RAISED` de `material.css`, y además `styles.css` le daba canto de volumen y sombra propia con especificidad (0,2,0). Dos elevaciones sin cambio de nivel entre ellas. El resumen baja a BASE: fondo, trazo fino de 1px y `box-shadow: none`. Medido: de 2 capas exteriores a 0, en Día y en Noche. Su rejilla de métricas sigue en `INSET`, que **sí** es otro nivel.
- **Chrome del lienzo.** Todo el grupo compartía la sombra de un panel flotante. Repartido por tamaño: pastillas a `clay-sm`, tarjetas (`cut-tooltip`, `repeat-preview`) a `clay-md`, panel de capas a `clay-lg`.

## `.canvas-layer-switch`

`styles.css` declaraba dos bases incompatibles —32×18 con pulgar de 14px en 2237 y 38×22 con pulgar de 16px en 3716, cada una con su propia iluminación— peleando por la cascada. Al revisar el marcado apareció el dato que cierra el caso: **ninguna de las dos tenía consumidor**. `LayerToggle` (`design-system/components/editor.tsx`) emite `.sc-layer-toggle__switch`, nunca `.canvas-layer-switch`, y la búsqueda en todo el repo (no sólo `src/**`, también `prototypes/`, `qa*.mjs` y `scripts/`) no devuelve ni una aparición fuera de `styles.css`. Las dos definiciones estaban muertas desde que el componente se movió al Design System.

Se retiran las dos y su `@media (prefers-reduced-motion)` asociada, dejando un comentario que explica dónde vive la definición viva.

```
$ rg -n "canvas-layer-switch" src
src/design-system/clayReconciliation.test.ts:435:// Deuda conocida en alcance · `.canvas-layer-switch`
src/design-system/clayReconciliation.test.ts:440:    // `styles.css` declaraba `.canvas-layer-switch` dos veces con geometrías
src/design-system/clayReconciliation.test.ts:445:    expect(withoutComments, 'ninguna regla vuelve a declarar `.canvas-layer-switch`')
src/design-system/clayReconciliation.test.ts:446:      .not.toContain('canvas-layer-switch');
src/styles.css:2241:   Aquí había dos definiciones base incompatibles de `.canvas-layer-switch`
src/styles.css:2245:   `.sc-layer-toggle__switch`, nunca `.canvas-layer-switch`. Las dos estaban
```

Las seis apariciones restantes son legítimas: cuatro dentro de la prueba que impide que vuelvan (dos comentarios, dos líneas de la afirmación) y dos dentro del comentario de `styles.css` que documenta la retirada. **Ninguna es una regla CSS**: la prueba comprueba el archivo con los comentarios retirados. La definición base viva es una sola, `.sc-layer-toggle__switch` en `ui.css`, con su pulgar, su estado `is-checked` y su objetivo táctil intactos — `CanvasLayers.test.tsx` y el resto de `src/features/canvas` siguen pasando.

## Planitud técnica

Medido con `getComputedStyle`, Día y Noche:

| Pieza | Radio | Canto | Capas exteriores |
|---|---|---|---|
| `.datasheet-grid tbody td` | `0px` | `0px` | 0 |
| `.results-table` | `0px` | `0px` | 0 |
| `.sc-property-row` | `0px` | `0px` | 0 |

La rejilla del Datasheet sigue plana, exacta y sin celdas redondeadas; ninguna fila se convirtió en ficha. El lienzo estructural —miembros, nudos, cargas, diagramas, deformada, cotas— no aparece en ningún grupo de materia y no recibe nada. `grid-template-rows`, la política del broker, `peek`, `contextualActions`, selección, scroll, borradores, edición, filtros y localización quedan sin tocar: no se modificó `datasheet.css` ni `modelDoctor.css`.

## Archivos tocados

| Archivo | Qué se le hizo |
|---|---|
| `src/design-system/tokens.css` | Escala de radios por rol (V-05) + alias de migración; escala de profundidad reconstruida con el tope `blur ≤ radio` en los dos temas; física neutra para la arcilla teñida; retirada de `--sc-shadow-contact` |
| `src/design-system/material.css` | `.inspector-summary` sale del grupo `RAISED`; radio por nivel sobre `Surface`; `--sc-radius-data` en rejillas técnicas; chrome del lienzo repartido por tamaño |
| `src/design-system/components/ui.css` | El hundimiento global pasa al token; radios por rol en tooltip, popover, diálogo, peek, segmentos, badge, banner, tira de estado e interruptor |
| `src/styles.css` | 18 literales de hundimiento → token; 3 literales de sombra → token; 2 gradientes de volumen → token; 6 halos de marca → cavidad; foco del selector deja de hundir; `.inspector-summary` deja de elevarse; radios del chrome a la escala; retirada de `.canvas-layer-switch` |
| `src/features/canvas/phase2.css` | Radio de panel en `.structural-edit-surface`; radio de tarjeta en `.duplicate-preview-panel`; profundidad por tamaño en el zócalo contextual y su menú |
| `src/features/workspace/phase1.css` | Hundimiento por token en la pastilla de repetición; el aviso de repetición alinea radio y profundidad de tarjeta; el detent del Inspector deja el halo |
| `src/features/project-hub/projectHub.css` | Hundimiento por token |
| `src/features/space3d/space3d.css` | Hundimiento por token; el botón primario toma la materia de acción del sistema en vez del halo retirado |
| `src/features/structure-generator/structureGenerator.css` | Radio de panel |
| `src/design-system/lab/ComponentLab.tsx` · `componentLab.css` | Vitrinas nuevas: radios por rol, profundidad por tamaño, planitud técnica y pulsado fotografiable |
| `src/design-system/clayReconciliation.test.ts` | **Nuevo.** 30 pruebas de los contratos de V-04 y V-05 |
| `src/design-system/tokens.test.ts` | La prueba del chrome de repetición se actualiza al reparto por tamaño; su intención (materia central, sin halo) no cambia |
| `scripts/qa-clay-reconciliation.mjs` | **Nuevo.** QA de navegador reproducible, antes y después, con la misma batería |

Ninguna ruta protegida: `npm run verify:protected` confirma los 38 archivos de frontera intactos.

## Cómo verificar

```bash
npm run lint                        # OK
npx vitest run src/design-system    # 103 pasan · 1 falla (preexistente, ver abajo)
npm run typecheck                   # OK
npm run build                       # OK
npm run verify:protected            # Frontera protegida intacta: 38 archivos verificados

# QA de navegador (reproduce la evidencia)
node scripts/qa-clay-reconciliation.mjs after
```

Pruebas focales de las features cuyo CSS propio se tocó:

```bash
npx vitest run src/features/canvas src/features/workspace \
  src/features/project-hub src/features/structure-generator --maxWorkers=1
# 343 pasan · 1 falla (preexistente, ver abajo)
npx vitest run src/features/space3d --maxWorkers=1   # 25 pasan
```

## Evidencia

`reports/evidence/2026-08-20-cri-105-clay/`

- `before/` (47 capturas) y `after/` (53 capturas), emparejadas: **las dos tandas se tomaron con el mismo script**, la de `before` sobre el baseline con los cambios en `git stash`.
- `computed-styles.before.json` / `computed-styles.after.json` — 57 lecturas de `getComputedStyle` cada una.
- `audit.md` — inventario, clasificación de gradientes, tablas de radio y profundidad, elevaciones anidadas y la tabla antes/después completa de 52 piezas.

Cubre: los seis niveles en Día y Noche · las tres vitrinas nuevas del Lab · reposo/hover/foco/pulsado/deshabilitado · pulsado de botón, icon button, herramienta y segmento · movimiento normal vs reducido sobre el mismo control · TopBar, ToolRail, Inspector, resumen del Inspector, Results, tarjeta de Results, tabla de Results, Datasheet, chrome del lienzo y Welcome, en Día y Noche · X2, M1 (en inglés), K0 portrait y K0 landscape.

**Sin overflow horizontal** en ninguna clase: `scrollWidth === innerWidth` en 390×844, 844×390 y 1100×768.

## No se cambió ningún HEX

```
$ git diff -U0 -- src | grep -E "^[+-]" | grep -v "^[+-][+-]" | grep -oiE "#[0-9a-f]{3,8}\b"
(sin resultados)

$ git diff -U0 -- src | grep -E "^[+-]" | grep -v "^[+-][+-]" | grep -E "^\s*[+-]\s*--sc-color-"
(sin resultados)
```

Cero HEX añadidos o retirados en todo el diff, y ninguna declaración `--sc-color-*` tocada. Lo único que cambia en `rgba()` y `color-mix()` son offsets, desenfoques y opacidades de sombra: geometría de materia, no color semántico. El foco conserva su HEX y su anillo; la selección sigue sin glow y sigue leyéndose en escala de grises.

## Solver, modelo y schema intactos

`npm run verify:protected` → frontera protegida intacta, 38 archivos verificados. El diff no toca `src/engine/**`, `src/workers/**`, `src/types.ts`, persistencia, IndexedDB, undo/redo, `materialId`, `sectionId`, topología, unidades, convenciones de signo, combinaciones ni lógica de fiabilidad o `stale`. El único `.tsx` modificado es `ComponentLab.tsx`, que es la vitrina de desarrollo.

## Limitaciones y hallazgos preexistentes

Ninguno de los dos lo causó este cambio; los dos se reprodujeron sobre el baseline `c7f0bde` **antes** de tocar nada, y arreglarlos habría convertido un slice visual en un bugfix funcional.

1. **`tokens.test.ts > never puts white ink on the light brand fill` falla en `main`.** Origen: `styles.css`, `.welcome-step.active .welcome-step-index { background:var(--accent); color:var(--accent-foreground); }` — tinta oscura sobre relleno oscuro. Es un defecto de **color**, y CRI-105 tiene prohibido cambiar HEX; CRI-106 es el gate de accesibilidad. Reproducción: `git stash && npx vitest run src/design-system/tokens.test.ts` → `1 failed | 28 passed`.
2. **`StructuralCanvas.candidatePicker.test.tsx > cycles preview through the keyboard…` falla en `main`.** Depende del orden de ejecución: pasa cuando el directorio corre con workers en paralelo y falla de forma determinista con `--maxWorkers=1`. Reproducción sobre el baseline: 3 de 3 ejecuciones fallan con `--maxWorkers=1`, con y sin los cambios de CRI-105.

Otras notas, sin acción en este slice:

- `--sc-glow-accent` y `--sc-glow-aula` siguen declarados con **cero** consumidores porque `tokens.test.ts` exige que existan. Ninguna pieza Clay depende de un halo, que es lo que pide el criterio; retirarlos exigiría relajar una prueba existente.
- `.repeat-preview` conserva su franja de acento de 3px en el borde de inicio. Es un raíl semántico de notificación, no el canto de la pieza —que sigue en 1px— y CRI-105 no lo toca.
- El ritmo de espaciado no se movió: la escala base sigue en 4px y no hubo ningún grupo que la materia obligara a reagrupar.

## Pendiente / siguiente paso

CRI-105 queda cerrada. CRI-93 sigue **In Progress/BLOCKED** por falta de dispositivo físico. CRI-106 sigue en **Backlog** y no se empezó. Los dos fallos preexistentes de arriba quedan documentados para que se traten donde corresponde, fuera de este slice.
