# Cierre cromático · corrección de vividez (segunda pasada, previo a CRI-10)

**Clasificación:** `AUDIT/TEMPORARY` — evidencia de la ejecución del 2026-08-15,
sobre la rama `claude/structureco-palette-closure-0w9xmv`, commit base `74dfc76`.
La autoridad vigente de color sigue siendo `brand/brandbook-clay.html`; este
reporte documenta la corrección, no reemplaza al reporte de la primera pasada
(`2026-08-15-0500-cierre-cromatico-paleta-lima.md`), que sigue siendo válido en
todo lo que no toca aquí.

## Por qué esta segunda pasada

La primera pasada del cierre cromático resolvió el suelo de contraste
**apagando el color**: para que un único HEX llegue a 3:1 sobre lienzo y
superficie en Día y en Noche a la vez, encerró cada rol técnico en una franja
de luminancia relativa `[0,146 … 0,293]`. Eso es correcto — sigue siéndolo —
pero dentro de esa franja el **croma es un grado de libertad que la primera
pasada no usó**. El síntoma más visible: `V/cortante` quedó en `#08816d`, un
teal oscuro y grisáceo que lee "corporativo", no "marca técnica viva".

Esta pasada no cambia la franja, el mecanismo de invariancia Día/Noche, ni
introduce tokens nuevos por rol (salvo dos excepciones documentadas abajo).
Sube la saturación de cada color hasta el borde de la misma franja.

## Qué cambió — tabla por rol

| Rol | Antes (74dfc76) | Ahora | Peor de 4 fondos (antes → ahora) |
|---|---|---|---|
| Marca (relleno CTA) | `#89d448` | **sin cambio** | 1,80:1 (relleno; el canto sostiene 1.4.11) |
| Marca (trazo/canto) | `#468c09` | **sin cambio** | 3,84:1 |
| N / axial | `#1092d9` | `#0f95d1` | 3,34 → 3,29 |
| V / cortante | `#08816d` (teal oscuro) | `#059669` (esmeralda vivo) | 3,34 → 3,68 |
| M / carga puntual | `#ed4b46` | **sin cambio** (pedido explícito) | 3,60 |
| M / momento | `#ed4b46` | **sin cambio** (pedido explícito) | 3,60 |
| deformada | `#9153e1` | `#8b5cf6` | 3,46 → 3,79 |
| reacción | `#2c6cda` | `#3a72e3` | 3,26 → 3,59 |
| selección / foco | `#7d81f8` | `#6a5df2` | 3,22 → 3,41 |
| éxito | `#149e39` | `#2f9a2a` | 3,43 → 3,55 |
| **error** | `#ed4b46` (= momento, mismo HEX) | `#d92e28` (rojo carmín propio) | 3,60 → 3,34 |
| warning (trazo/aviso) | `#ac850d` (= cota, mismo HEX) | `#d9720a` | 3,36 → 3,23 |
| cota / dimensión | `#ac850d` (= warning, mismo HEX) | `#b8860b` | 3,36 → 3,18 |
| eje / corte | `#ad5e18` | **sin cambio** | 3,36 |
| Aula | `#c15b8f` | `#c94a8f` | 3,95 → 3,72 |
| canario (relleno) | `#f4d75e` | **sin cambio** | 1,39 (trazo, prohibido) / 5,10 (tinta) |

Ningún valor queda por debajo de 3:1 en ninguno de los cuatro fondos (lienzo y
superficie × Día y Noche); ver evidencia computada abajo. La mayoría de los
márgenes **suben** respecto a la primera pasada porque los hues elegidos ahora
maximizan croma dentro de la franja en vez de acercarse al borde por el lado
más oscuro.

## La corrección real no es sólo estética: dos colisiones de HEX

Dos pares de roles compartían literalmente el mismo HEX en 74dfc76, lo que
hacía imposible distinguirlos si convivían en una vista — exactamente lo que
pide evitar la sección "Distinguibilidad" del encargo:

- **`error` vs `momento`**: los dos eran `#ed4b46`. Ahora `error` es un rojo
  carmín propio (`#d92e28`, ΔE_OK 0,064 respecto a momento) — comparten
  familia (rojo) pero no HEX. Se actualizó el brandbook para que los usos
  genuinamente de error (`.banner.error`, `.ov-dialog .dial-icon`, `.no`,
  `.compare .bad .tag2`, `.btn-danger`) usen `--error` y no `--momento`.
- **`warning` (aviso dibujado) vs `cota` (anotación de medida)**: los dos eran
  `--sc-amber-500` = `#ac850d`. Ahora son primitivas separadas: `--sc-amber-500
  = #d9720a` (warning/aviso-trazo) y `--sc-amber-700 = #b8860b` (dimensión).
  En el brandbook, `--cota` cambia de significado (antes "el canario, como
  trazo"; ahora la anotación de medida real) y el aviso dibujado pasa a
  `--aviso-trazo`, un token nuevo.

Estos dos son los únicos tokens genuinamente nuevos de esta pasada
(`--sc-red-600`, `--sc-amber-700` como primitivas; `--error` y `--aviso-trazo`
en el brandbook). No se introdujo una familia core/stroke/foreground paralela
para los demás roles porque no hacía falta: el patrón ya existente — un solo
HEX de "señal" a full-opacity para trazo/icono/texto pequeño, más
`color-mix(..., transparent)` u `opacity` para el relleno diluido en badges,
diagramas y halos — ya cumple ese contrato, y así lo confirmó la auditoría de
consumidores (canvas SVG, `SectionViewer2D`, `threeViewport.ts`) antes de
tocar ningún valor: ningún rol necesitaba un HEX de relleno *opaco* distinto
del de trazo, salvo los que ya lo tenían (`--sc-color-*-solid` /
`-on-solid` para éxito/error/Aula, y el propio CTA lima con su
`core / edge / ink`, ninguno de los cuales se tocó).

## Verificación de contraste — valores computados por navegador real

`reports/evidence/2026-08-15-palette-closure-v2/computed-contrast.txt`, generado
con el mismo script Playwright de la primera pasada
(`measure-computed.mjs`, sin modificar) contra los valores computados —
incluidos los `color-mix()` que un test en jsdom no puede evaluar. Resultado:

- **25 roles semánticos idénticos en Día y Noche** (cero deriva).
- **Todas** las parejas señal/fondo (8 roles técnicos × lienzo/superficie ×
  Día/Noche = 32 mediciones) ≥ 3:1.
- Tinta del CTA sobre relleno/hover/pulsado/gradiente ≥ 4,5:1 en los dos temas.
- Canto del CTA sobre superficie y sobre `accent-soft` ≥ 3:1.
- Blanco sobre éxito/error/Aula sólido ≥ 4,5:1 (sin cambios: estas tres son
  la misma pareja `-solid`/`-on-solid` de la primera pasada, ya vivas).
- Tinta del canario sobre canario 5,10:1.

`TODO PASA` — cero fallos.

## Distinguibilidad — ΔE en OKLab (script ad-hoc, ver metodología abajo)

Pares que el encargo pide comprobar explícitamente, comparados contra la
primera pasada:

| Par | ΔE antes | ΔE ahora |
|---|---|---|
| axial vs reacción | 0,102 | 0,128 |
| axial vs selección | 0,108 | 0,163 |
| cortante vs éxito | 0,127 | 0,074 |
| cortante vs marca (edge) | 0,116 | 0,083 |
| momento/carga vs error | 0,000 (mismo HEX) | 0,064 |
| deformada vs selección | 0,106 | 0,053 |
| warning vs cota/eje | 0,000 (mismo HEX, warning=cota) | 0,072 / 0,099 |

Dos pares bajan (cortante vs éxito, cortante vs marca, deformada vs
selección): es el coste directo de sacar `V/cortante` del teal grisáceo hacia
un verde más puro y de separar `selección` en un índigo más vivo entre
`reacción` y `deformada`, dentro de una franja de hue ya congestionada por
tres verdes y cuatro azules/violetas. Ninguno cae a un valor menor que el
mínimo que la primera pasada ya consideraba aceptable (0,05 — ver su reporte,
"axial vs selección: 0,13 → 0,11"); el más bajo de esta tabla es 0,053. Los
dos pares que antes compartían HEX exacto (ΔE 0,000: momento/error,
warning/cota) ahora tienen separación real. Ningún significado depende sólo
del color: forma, icono y etiqueta siguen siendo el refuerzo (sin cambios de
este cierre).

**Metodología:** conversión sRGB → OKLab estándar (mismo espacio que usa
`color-mix(in oklab, …)`; aquí sólo para medir distancia, no para mezclar) y
distancia euclídea en `L, a, b`. Script en
`reports/evidence/2026-08-15-palette-closure-v2/` (no committeado como parte
del build — es una herramienta de auditoría de un solo uso, igual que
`palette-search.txt` de la primera pasada).

## Verificación visual

El Component Lab (`/__components`) sólo ofrece tres direcciones cromáticas
*supersedidas* en su selector ("Continuidad calibrada", "Mineral + Pino",
"Contraste analítico") — exploraciones previas a la decisión de la lima que
nunca se retiraron del dropdown. Ninguna es la paleta viva. Para obtener
evidencia fiel se forzó `data-foundation` a un valor que no matchea ninguno de
los tres bloques de `componentLab.css`, con lo que cada swatch, badge, banner
y tarjeta de métrica vuelve a leer directamente `:root` de `tokens.css` — sin
tocar ese archivo ni introducir una paleta paralela. El script que automatiza
esto vive en `screenshot-evidence.mjs`, en la misma carpeta de evidencia.

Capturas (Día y Noche) en `reports/evidence/2026-08-15-palette-closure-v2/`:

- `lab-live-{light,dark}.png` — marca/CTA (acción), canvas, superficie, N
  (axial), V (cortante), M (carga), advertencia, error y Aula, lado a lado.
- `lab-badges-{light,dark}.png` — badges y banners de éxito/advertencia/error
  en contexto real de componente (Retroalimentación).
- `lab-editor-{light,dark}.png` — herramientas (carga puntual, carga
  distribuida, momento, cota) y tarjetas de métrica con el canto de color de
  axial/cortante/momento/desplazamiento (deformada), más los banners de
  éxito/advertencia de estado de análisis.
- `lab-buttons-{light,dark}.png` — el CTA (`Guardar cambios`) en contexto de
  botones reales, con el botón `Eliminar` sobre `--sc-color-error-solid`
  (sin cambios) y el borde de campo inválido en rojo.

Lectura: la familia se siente viva y saturada sin caer en neón — el verde de
cortante es un esmeralda limpio, no fluorescente; el índigo de selección tiene
temple, no es un azul puro de sistema operativo; el ámbar de advertencia es
anaranjado-dorado, no mostaza. Día y Noche muestran exactamente los mismos
HEX en cada rol técnico y de estado (confirmado también en el paso 1 del
script de contraste), y las superficies/fondos son las únicas que cambian de
fase.

## Archivos tocados

| archivo | qué |
|---|---|
| `src/design-system/tokens.css` | nuevos valores de primitivas (`--sc-cyan-600`, `--sc-blue-500`, `--sc-violet-500`, `--sc-pink-500`, `--sc-amber-500`, nuevas `--sc-red-600`/`--sc-amber-700`) y de los roles que no pasan por primitiva (`technical-shear`, `technical-reaction`, `state-success`); comentario de cabecera con la nota de corrección. |
| `brand/brandbook-clay.html` | `:root` con los nuevos HEX + `--error` y `--aviso-trazo`; swatches, ramp, tabla de contraste y bloque de tokens actualizados; `--cota` cambia de significado (aviso → anotación de medida); usos reales de error (`.banner.error`, `.ov-dialog .dial-icon`, `.no`, `.compare .bad`, `.btn-danger`) migrados de `--momento` a `--error`; nota nueva "Vivo dentro de la franja, no apagado". |
| `brand/manifest.json` | hash y tamaño del brandbook + motivo de la sustitución. |
| `src/space3d/view/threeViewport.ts` | respaldos hex de `memberSelected`/`nodeSelected`/`support`/`deformed`/`axisZ` actualizados para no divergir de `tokens.css` si `getComputedStyle` falla. |
| `reports/evidence/2026-08-15-palette-closure-v2/` | evidencia de esta pasada: contraste computado, capturas Día/Noche, y los dos scripts que las generan. |

No se tocó layout, arquitectura adaptativa, TopBar, ToolRail, Inspector,
Results, responsive, solver, ProjectModel, schema, persistencia, reliability,
Aula funcional, contratos 2D/3D, ni `prototypes/ios-app`.

## Cómo verificar

```bash
npm run typecheck
npx vitest run src/design-system --maxWorkers=1     # 69 pruebas, sin cambios de gate
npm run lint
npm run verify:docs
npm run verify:protected
node reports/evidence/2026-08-15-palette-closure/measure-computed.mjs   # contraste real, navegador
```

`tokens.test.ts` no cambió: los mismos gates de invariancia, señal-sobre-
superficie, canto+tinta del CTA y prohibición de blanco sobre la lima siguen
aplicando sin modificación, porque esta pasada no cambia el mecanismo — sólo
los valores.

## Excepciones que se mantienen (heredadas de la primera pasada, no tocadas aquí)

1. Las tintas de texto sobre superficie (`--sc-color-state-*-foreground`,
   `--sc-color-text-link`) siguen sin poder ser invariantes — la superficie
   Día/Noche tiene 15,7:1 de diferencia entre sí.
2. Los rellenos suaves (`--sc-color-action-subtle`, `--sc-color-selection`)
   siguen siendo fondos, y cambian de fase por tema.
3. La rampa del índice elástico (`--sc-color-demand-*`) sigue siendo una
   escala secuencial, no un significado — sin tocar en esta pasada.
4. `prototypes/ios-app` sigue en teal: prototipo congelado fuera del producto
   actual, fuera de alcance.

## Pendientes (fuera de este cierre)

- CRI-10 diseña sobre esta paleta; no se tocó layout, navegación, Inspector,
  Results ni ToolRail.

## Adenda — corrección del Component Lab (commit posterior a `f60eae5`)

Con la paleta de `f60eae5` ya aprobada, se detectó que el pendiente anotado
arriba ("el Component Lab sigue ofreciendo sólo direcciones supersedidas")
era más grave de lo documentado: el selector "Dirección cromática" abría por
defecto en `mineral`, una de las tres exploraciones anteriores al cierre
cromático — así que visitar `/__components` sin tocar nada mostraba una
paleta que **no** es la oficial. Se corrigió sin tocar ningún HEX, el
Brandbook ni ningún ratio de contraste:

- `FoundationPalette` gana un cuarto valor, `'official'`, y es ahora el
  `useState` por defecto. `data-foundation="official"` no tiene bloque
  correspondiente en `componentLab.css` a propósito: al no matchear ningún
  selector, cada `--sc-color-*` cae directo a `:root` de `tokens.css` — la
  paleta viva, sin copiarla.
- El `<select>` ahora lista "Oficial · Brandbook" como primera opción, y las
  tres direcciones antiguas quedan agrupadas bajo un `<optgroup>` con la
  etiqueta "Históricas · supersedidas", separadas visualmente de la opción
  vigente. Sus resúmenes de texto ahora empiezan con "Supersedida —" para que
  quede claro en el propio Lab, no sólo en un comentario de código.
- `componentLab.css` gana una nota explícita: no añadir un bloque
  `[data-foundation='official']`, porque eso duplicaría la paleta en vez de
  heredarla.
- Corrección adicional pedida en revisión: el swatch "Advertencia" del mapa
  semántico (`ComponentLab.tsx`, sección 00) usaba
  `--sc-color-state-warning` (`#d9720a`, el ámbar vivo reservado a trazos e
  íconos — mecanismo, borde de campo inválido) en vez de
  `--sc-color-canario` (`#f4d75e`, el amarillo pastel con el que la
  advertencia se ve realmente en badges, banners y toasts). Se corrigió el
  mapeo de esa única regla CSS (`componentLab.css`, `.is-warning`) a
  `--sc-color-canario` — ningún HEX cambió, sólo qué token oficial
  representa el swatch de demostración.

Verificado con Playwright contra `/__components` recién abierto, sin
interacción: `data-foundation="official"` y el `<select>` en `official` por
defecto, en Día y Noche, mostrando exactamente los HEX de `f60eae5`
(incluido el swatch de advertencia ya en amarillo canario). Capturas en
`reports/evidence/2026-08-15-palette-closure-v2/lab-default-{light,dark}.png`
y `lab-warning-fix-{light,dark}.png`.

Archivos tocados en esta corrección: `src/design-system/lab/ComponentLab.tsx`,
`src/design-system/lab/componentLab.css`. Sin cambios en
`tokens.css`, `brand/brandbook-clay.html`, `brand/manifest.json` ni ningún
otro archivo de producto.
