# Rediseño claymorphism · Ciclo 2 (la mesa de trabajo)

- **Fecha**: 2026-08-07
- **Estado**: aprobado, pendiente de plan de implementación
- **Alcance**: fase 4 del encargo — `WorkspaceShell`, `TopBar`, toolbars, canvas,
  inspector, panel de resultados, modales y menús. Más el barrido de vidrio de la
  bienvenida, que es global por naturaleza (§2, decisión 4).
- **Ciclo previo**: `docs/superpowers/specs/2026-08-06-claymorphism-ciclo1-design.md`
  (`5be1bc5..491f7be`, fusionado en `main`).

---

## 1 · Problema

El ciclo 1 entregó la materia claymorphism completa —rampa verde medida, neutros
cálidos, sombras de cuatro capas con luz única a 145°, la primitiva `Surface`— pero la
dejó **confinada a la pantalla de inicio**. La app tiene hoy dos materiales conviviendo:

- Los 6 tokens `--sc-shadow-clay-*` están declarados, recalibrados en Noche y protegidos
  por dos tests. Sus **únicos** consumidores son `.sc-surface` y 6 reglas `.welcome-*`.
- Las 602 líneas de `src/design-system/components/ui.css` siguen íntegras en la materia
  plana de AG-015: 5 usos de `--sc-shadow-raised` / `-floating` / `-modal`.
- Las ~2 500 líneas de `src/styles.css` que visten la mesa de trabajo, también.

El usuario entra por una pantalla de arcilla y aterriza en una de vidrio y superficies
planas. Este ciclo cierra esa costura.

**Resultado buscado:** una sola materia en toda la app, un solo sitio donde se declara,
y un arnés capaz de comprobar que eso es cierto.

## 2 · Decisiones tomadas

Cerradas con el usuario antes de escribir este documento:

| # | Decisión | Resolución |
| --- | --- | --- |
| 1 | Alcance | Ciclo entero, **materia primero**. ~10 tareas: materia → arnés → design-system → marco → zonas → cierre. |
| 2 | Vidrio vs arcilla | **Arcilla en todo**, incluidos el TopBar y el chrome flotante del lienzo. Se elimina `backdrop-filter` de las superficies. |
| 3 | Velos de modal | **Se conservan.** Un velo no es superficie: es scrim. |
| 4 | Vidrio de la bienvenida | **Entra en el barrido**, aunque el inicio no sea alcance nominal. |
| 5 | Deuda de `Surface` | Material clay **componible en CSS**, declarado una vez. `Surface` se mantiene y amplía `as`. |
| 6 | Arnés | Contrato de **consumo** en `tokens.test.ts` + checks clay del **workspace** en `qa.mjs`. |
| 7 | Tokens de vidrio | Se **retiran** de `tokens.css` y de las dos listas de `tokens.test.ts`. |

### 2.1 · Por qué el vidrio desaparece por completo

El vidrio de AG-015 (`backdrop-filter: blur(12–20px)` sobre `color-mix(…, transparent)`)
es un material distinto del claymorphism, no una variante suya. La arcilla comunica
volumen por sombra y canto; el vidrio lo comunica por translucidez. Mantener los dos
obliga a que cada superficie declare a cuál pertenece, que es exactamente la clase de
decisión por-componente que el ciclo 1 eliminó de la paleta.

Retirarlo tiene además dos efectos colaterales buenos: `backdrop-filter` es caro en
móvil, y su retirada deja sin objeto tres bloques `@media (prefers-reduced-transparency:
reduce)` que hoy existen solo para desactivarlo en superficies.

### 2.2 · Por qué los velos se quedan

`.import-center-backdrop` (`blur(10px)`), `.mobile-inspector-backdrop` (`blur(2px)`) y
`.results-sheet-backdrop` (`blur(1px)`) no son superficies: son scrims que separan un
modal del contenido de fondo. Ahí el desenfoque es funcional —comunica "esto de detrás
está inactivo"— y no compite con la arcilla, que gobierna objetos. Los tres bloques de
`prefers-reduced-transparency` se **reducen** a los velos, no se borran.

### 2.3 · Por qué el barrido alcanza a la bienvenida

El ciclo 1 dejó seis reglas con `backdrop-filter` en el inicio: `.welcome-header`
(`styles.css:87`), `.welcome-badge-pill` (`:211`), `.welcome-highlight-item` (`:220`),
`.welcome-filter-tabs` (`:372`), `.welcome-workflow` (`:481`) y `.welcome-footer`
(`:493`).

La materia es global por definición: el propio ciclo 1 fijó *"fuente de luz única a 145°
para toda la app"*. Dejar vidrio en la primera pantalla mientras la mesa de trabajo es
arcilla produce justo la incoherencia que el ciclo elimina. Y es la condición para poder
retirar `--sc-blur-glass` y `--sc-blur-chrome`: mientras un solo consumidor siga vivo, no
se pueden borrar. Son seis reglas de re-vestido, no un rediseño del inicio.

## 3 · Restricciones

### 3.1 · Frontera matemática protegida

No se modifica ningún fichero de `src/engine/**`, `src/workers/**`, `src/data/**`,
`src/store/ProjectContext.tsx` ni `src/types.ts`. `npm run verify:protected` debe seguir
verde **sin actualizar el baseline**.

Este ciclo es enteramente de materia y CSS; los únicos `.tsx` que toca son de
presentación (`surface.tsx`, `App.tsx`, y puntualmente `TopBar.tsx` / `ToolBar.tsx` si
una clase necesita reubicarse).

### 3.2 · Contrato de contraste del lienzo

`--sc-color-bg-canvas` (`#fafcfb` día / `#060b09` noche) y toda la familia
`--sc-color-technical-*` **no se tocan**. Son los valores medidos en
`docs/ux-redesign/COLOR_ACCESSIBILITY.md`, y `tokens.test.ts:175-189` exige ≥3:1 de los
ocho roles técnicos contra ese fondo.

Esto es lo que fuerza la solución de §4.3: el chrome se adapta al lienzo, nunca al revés.

### 3.3 · Radios densos congelados

`--sc-radius-xs` … `--sc-radius-md` (8 / 12 / 14 px) gobiernan campos numéricos, filas
del inspector y tablas de resultados. No suben. Redondear una rejilla de datos la vuelve
más difícil de escanear, no más amable — y es exactamente donde este ciclo trabaja.

### 3.4 · El contrato de tokens sigue siendo el arnés

`src/design-system/tokens.test.ts` gobierna: sin literales de color opacos en CSS de
componente, sin primitivas de color fuera de `tokens.css`, `rgba()` solo en sombras y
velos, y toda referencia `var(--sc-…)` debe resolver. Se le **añade** el contrato de
consumo de §7; no se le relaja nada salvo lo de §3.5.

### 3.5 · Relajación deliberada: los tokens de vidrio

`tokens.test.ts:275-289` exige hoy que existan `--sc-surface-glass`,
`--sc-surface-glass-border` y `--sc-blur-glass`; `:291-303` exige que los dos primeros se
recalibren en Noche. Ese test codifica el vidrio como parte del contrato de materia.

Como el ciclo lo sustituye deliberadamente, **se editan las dos listas y se borran los
tokens** de `tokens.css` (`:352-355` día, `:705-707` noche), junto con
`--sc-surface-glass-strong` y `--sc-blur-chrome`. Es el mismo movimiento que el ciclo 1
hizo con la paleta de AG-015: no se silencia un test, se actualiza el contrato que
protege una decisión ya sustituida. Queda registrado aquí para que dentro de tres meses
nadie lo lea como una red retirada por conveniencia.

### 3.6 · Sin dependencias nuevas

`package.json` no cambia sus bloques `dependencies` / `devDependencies`.

## 4 · Arquitectura

### 4.1 · Dónde vive la materia

**El problema estructural.** `src/styles.css` (3 022 líneas) está organizado en
**estratos históricos acumulados**, no por componente. `.tool-button` se declara en las
líneas 575, 1797, 2905 y 3005; `.inspector-*` en 774, 1268, 2298 y 2924. Editar "el CSS
del inspector" significa hoy tocar cuatro estratos y confiar en el orden.

**El precedente correcto ya existe.** La capa AG-015 (`styles.css:2957-3015`) vive al
final *a propósito*, y su comentario explica por qué: `ui.css` se inyecta después
—`WorkspaceShell` es `lazy`— así que una capa terminal es el único sitio donde se gana la
cascada sin `!important`. El ciclo escala ese patrón en vez de pelear con los estratos.

Tres sitios, cada uno con su razón:

| Fichero | Rol | Carga |
| --- | --- | --- |
| `src/design-system/tokens.css` | La materia como tokens. Se le añade el rol del chrome y se le retiran los de vidrio. | eager |
| `src/design-system/components/ui.css` | Se migra **in situ** de materia plana a clay (5 usos). | lazy (workspace) |
| `src/design-system/material.css` **(nuevo)** | Capa terminal de materia para selectores de features. | eager |

`material.css` se importa desde `src/App.tsx` **después** de `./styles.css`. Así queda en
el chunk de entrada —resolviendo de raíz la clase de fallo del Critical C1 del ciclo 1— y
gana la cascada a todo `styles.css`. No se usa `@import` al final de `styles.css`:
`@import` solo es válido al principio de una hoja.

**Por qué `ui.css` se migra dentro y no se pisa desde fuera.** `ui.css` se inyecta cuando
carga el chunk de `WorkspaceShell`, es decir *después* del CSS de entrada. Un
`material.css` eager no puede ganarle a igual especificidad. Migrar la materia dentro de
`ui.css` hace que los componentes `sc-*` lleven arcilla nativamente y elimina la necesidad
de la "clase extra" que el comentario de AG-015 describe. `material.css` gobierna solo
selectores de features, que no viven en `ui.css` y por tanto no compiten.

`.sc-surface` **se queda en `styles.css`** (`:38-53`): lo consume la bienvenida, que no es
lazy. Pasa a consumir el material componible en vez de declararlo.

**No se introducen `@layer`.** Reordenar la cascada de 3 022 líneas heredadas es un riesgo
mayor que el problema que resuelve. Queda anotado para el ciclo 3.

### 4.2 · El material componible

La deuda del ciclo 1 lo enuncia así: *"el material clay se repite a mano en 6 reglas de
`styles.css` en paralelo a `.sc-surface`; cambiar la materia hoy significa tocar 7
sitios"*.

`material.css` declara la materia **una vez** y la aplica por lista de selectores
agrupada por rol de elevación —`flat`, `raised`, `floating`, `pressed`—, con
`[data-clay-level]` como gancho para marcado nuevo. Cambiar la materia pasa a ser un
bloque, no siete.

Los cuatro roles conservan el significado que `surface.tsx` ya documenta: `flat` no
aplica volumen y es el nivel de las zonas técnicas densas —tablas, filas del inspector,
el lienzo—; `raised` es la superficie normal; `floating` es lo que se despega del plano;
`pressed` invierte la iluminación.

**`Surface` amplía `as`** con `button`, `header` y `nav`. Hoy su unión excluye `button`,
lo que —según la propia deuda— *"estructuralmente no puede vestir las seis superficies
clay interactivas que el ciclo 1 sí entregó"*. Emite `[data-clay-level]`, de modo que el
componente React y el CSS heredado consumen la misma declaración.

**Tokens huérfanos heredados.** El ciclo 1 legó tres sin un solo consumidor en `src/`
—verificado por grep—: `--sc-color-surface-pressed` (`tokens.css:103`, dark `:567`),
`--sc-sky-500` (`:91`) y `--sc-lilac-500` (`:93`). El ciclo los resuelve así:

- `--sc-color-surface-pressed` **gana consumidor real** en el rol `pressed` del material.
- `--sc-sky-500` y `--sc-lilac-500` **se retiran**. Son primitivos que nunca tuvieron
  función: los roles que la referencia clay pedía (`--sc-color-accent-blue-soft`,
  `--sc-color-accent-violet-soft`) apuntan a los escalones 100, no a los 500.

No se hereda esta deuda al ciclo 3, y ningún token nuevo de este ciclo se declara sin
consumidor.

### 4.3 · El chrome del lienzo — la decisión medida del ciclo

Es el punto más delicado, y su solución no es una preferencia: es una consecuencia
aritmética.

Hoy el badge de modo, los chips de snap/grid, los controles de zoom, la lectura de
coordenadas, el quick-entry y el tooltip de corte **no se separan del dibujo por color**.
Se separan por el desenfoque de lo que hay debajo. Medido (luminancia relativa WCAG,
lienzo `#fafcfb` en día):

| Rol | vs lienzo (día) |
| --- | --- |
| `--sc-color-surface-1` `#fbfaf8` | **1.01:1** |
| `--sc-color-surface-elevated` `#ffffff` | **1.03:1** |
| `--sc-color-surface-inset` `#eceae6` | 1.17:1 |
| `--sc-color-border` `#e0ded9` | **1.30:1** |
| `--sc-color-border-strong` `#b9b6af` | **1.96:1** |

**Ningún rol existente alcanza 3:1 en día.** Ni siquiera el borde fuerte. Quitar el
`backdrop-filter` sin más deja el chrome flotando invisible sobre la geometría —justo
donde el usuario mide.

Se añade por tanto un rol nuevo, medido en ambos temas:

```
--sc-color-border-canvas-chrome
  día:   #84817a   → 3.77:1 contra #fafcfb
  noche: #5f6d68   → 3.66:1 contra #060b09
```

Noche se recalibra en vez de heredar, según la disciplina que el ciclo 1 fijó. El suelo
de 3:1 es el de WCAG 1.4.11 (contraste no textual): es lo que hace identificable el
límite de un componente de interfaz.

El **relleno** del chrome pasa a `--sc-color-surface-2` (`#f4f3f0`) en vez de blanco: el
chrome pertenece a la app, no al lienzo, y el neutro cálido lo declara. La separación la
sostienen el borde medido y la sombra clay, notablemente más presente que
`--sc-shadow-raised`.

**Zonas seguras.** El chrome opaco ocluye el modelo donde antes lo dejaba entrever. Se
revisan las cuatro declaraciones de `--canvas-safe-*` (`styles.css:1902-1906`,
`:1981-1984`, `:2021-2024`, `:2794-2797`) contra el resultado real en navegador. Es
ajuste medido en pantalla, no cálculo.

### 4.4 · Zonas y su tratamiento

| Zona | Rol de elevación | Nota |
| --- | --- | --- |
| `.topbar` | `raised` | Pierde `--sc-surface-glass-strong` y `--sc-blur-glass`. |
| `.tool-rail`, dock móvil | `raised`; herramienta activa `pressed` | El halo por `--tool-color` se conserva: el rail codifica dominio, no solo estado. |
| Chrome del lienzo | `floating` + borde de §4.3 | El lienzo en sí queda fuera del sistema (§3.2). |
| `.inspector-panel` | `raised`; filas y campos `flat` | Radios densos congelados (§3.3). |
| `.results-panel` | `raised`; tablas y gráficas `flat` | Ídem. |
| Popovers, menús, modales, toasts | `floating` | Vive en `ui.css` para `sc-*`, en `material.css` para `.popover`. |
| Bienvenida (6 reglas) | según su rol actual | Solo sustituye vidrio por arcilla; no rediseña. |

**Retirada de materia duplicada.** Cada tarea de vestido deja **una sola declaración de
materia por selector en su zona** — no retira nada fuera de la zona que toca. La limpieza
total de los cuatro estratos no cabe en este ciclo y no se intenta.

### 4.5 · Lo que este ciclo *no* refactoriza

Inspector y resultados reimplementan `Field`, `Select`, `SegmentedControl`, `PanelHeader`
y `ToolGroup` con clases ad-hoc (`.select-field`, `.number-control`,
`.segmented-control`, `.toggle-row`); `ToolBar.tsx:274` escribe `<section
className="tool-group">` a mano teniendo `ToolGroup` disponible.

Es deuda real, pero **adoptar el design-system en esos dos paneles es un refactor de
marcado, no de materia**, y mezclarlo con el rediseño haría irrevisable cada tarea. El
material componible de §4.2 los alcanza igualmente por selector. Queda anotado para el
ciclo 3 con esta justificación.

## 5 · Flujo de datos

Sin cambios. El rediseño no toca estado: el modelo sigue siendo propiedad de
`ProjectContext`, el tema sigue en `WorkspaceUIContext`, el idioma sigue siendo
`project.settings.language`, y la coordinación entre paneles sigue pasando por
`workspaceCommands.ts`.

Las tres custom properties que `WorkspaceShell` inyecta en runtime
(`--sc-visual-viewport-height`, `-top`, `-bottom`) se conservan; `tokens.test.ts` ya las
excluye de su comprobación de resolución.

## 6 · Errores y degradación

- **`backdrop-filter` no soportado**: deja de importar. Es la única mejora de robustez
  que el ciclo entrega gratis.
- **`prefers-reduced-transparency: reduce`**: los tres bloques se reducen a los velos
  (§2.2). Se verifica que ninguno queda apuntando a un selector sin translucidez.
- **`color-mix` no soportado**: sin cambio respecto a hoy; ya es la base de la paleta.
- **Primer pintado**: `material.css` es eager, así que la clase de fallo del Critical C1
  del ciclo 1 —materia clay pintada sin material— no puede reaparecer en la bienvenida.
  Para el workspace el riesgo no existe: su CSS y su JS viajan en el mismo chunk lazy.

## 7 · Testing

El ciclo 1 pagó 2 Criticals y **5 redes de test falsas**. La causa raíz está identificada
y este ciclo la ataca directamente.

**El hallazgo estructural:** `vite.config.ts` no declara `test.css`, así que Vitest
renderiza en jsdom **sin CSS**. Ningún test unitario puede ver un problema de cascada o
especificidad. `qa.mjs` sí mide `getComputedStyle` real —pero **todos sus checks de
materia apuntan a `.welcome-*`**: ni uno lee un `.sc-*` ni el workspace. Y `npm run
verify` no ejecuta `qa`. Migrar `.sc-button` a clay pasaría los ~95 checks y los 17 `it`
sin que nada lo confirmara ni lo negara.

**No se activa `test.css`.** jsdom no evalúa media queries ni cascada completa de forma
fiable: daría cobertura aparente sobre justo la clase de fallo que buscamos, y ralentiza
toda la suite. La cobertura de cascada se compra donde de verdad existe: Chromium.

**Nuevos:**

| Test | Qué asegura | Dónde |
| --- | --- | --- |
| Contrato de **consumo** clay | Las zonas migradas no declaran sombras planas AG-015; toda elevación del workspace resuelve a `var(--sc-shadow-clay-*)`. Es análisis de texto: barato y corre en `verify`. | `tokens.test.ts` |
| Ausencia de `backdrop-filter` en superficies | Solo los tres velos de §2.2 pueden declararlo. Impide que el vidrio vuelva por la puerta de atrás. | `tokens.test.ts` |
| Contraste del chrome del lienzo | `--sc-color-border-canvas-chrome` ≥3:1 contra `--sc-color-bg-canvas` en **ambos** temas. | `tokens.test.ts` |
| Checks de materia del workspace | `getComputedStyle` real sobre topbar, tool rail, inspector, resultados, popover y modal — blindados como los de `.welcome-*`: valores exactos, no "cambia". | `qa.mjs` |
| `surface.test.tsx` (ampliado) | `as` admite `button` / `header` / `nav`; emite `[data-clay-level]`. | `surface.test.tsx` |

**Verificación por mutación obligatoria.** Cada red nueva se rompe a propósito una vez
para comprobar que falla, antes de commitearla. El ciclo 1 tuvo cinco redes que no podían
detectar nada; cuatro se descubrieron tarde. La regla no es negociable en este ciclo.

**Existentes que deben seguir verdes sin tocar expectativas:** `App.test.tsx`,
`numericPolicy.test.ts`, `dependencyBoundary.test.ts`, `controls.test.tsx`,
`overlays.test.tsx`, `feedback.test.tsx`, `disclosure.test.tsx`, `editor.test.tsx`,
`modalFocus.test.tsx`, `Inspector.test.tsx`, `ResultsPanel.test.tsx`, `TopBar.test.tsx`,
`ToolBar.test.tsx`. La única expectativa que se edita es la de §3.5, documentada.

## 8 · Verificación

Gate del ciclo, ejecutado y **visto** antes de declarar nada cerrado:

```
npm run verify     # lint + verify:protected + test + build + verify:perf
npm run qa         # recorrido Chromium desktop + móvil
npm run qa:webkit  # importación, PDF nativo, targets táctiles en WebKit
```

`npm run qa` **no entra en `verify`** —encadenar build + Chromium a cada verificación
alarga demasiado el ciclo de trabajo de los dos agentes— pero **ninguna tarea que toque
materia se marca completa sin haberlo corrido y visto el resultado**. Es la lección
directa del Critical C2 del ciclo 1, donde el defecto de cascada existía y `qa` no se
ejecutó.

Cada tarea de vestido añade sus propios checks a `qa.mjs` sobre el helper de la tarea de
arnés, para que el gate nunca quede rojo entre tareas y cada zona llegue con red propia.

**Revisión manual**, anotada punto por punto: consola sin errores, navegación completa por
teclado del workspace, foco visible, tema claro y oscuro, 390×844, 1366×768, zoom 200 % y
`prefers-reduced-motion: reduce`.

**Riesgo a verificar en navegador, no en test:** el chrome del lienzo sobre geometría
densa. Cargar un modelo con muchas barras y comprobar que badge, chips, zoom, status,
quick-entry y cut-tooltip siguen legibles **y siguen dejando ver el modelo**. Ningún test
automático puede juzgar esto.

**Presupuesto de rendimiento.** Se mide antes y después. `material.css` añade bytes al
chunk de entrada; retirar declaraciones duplicadas los quita; retirar `backdrop-filter`
no cambia bytes pero sí coste de pintado. El neto es incierto de antemano, así que se
mide y se documenta, y solo se re-basa el techo si la medición lo justifica. Línea base
tras el ciclo 1: **663 916 B / 178 161 gzip**, techo actual 670 000 / 179 500.

Al cerrar, reporte en `reports/YYYY-MM-DD-HHmm-slug.md` según la skill `change-report`,
commiteado junto al cambio. **Sin `git push` sin confirmación explícita** — el repo lo
comparten dos agentes y `autoPush` está desactivado a propósito.

## 9 · Fuera de alcance

Explícitamente diferido al **ciclo 3**:

- Modo Aula y centro de importación.
- Estados vacíos, mensajes de error y feedback.
- Barrido final de responsive, accesibilidad y documentación.
- **Adopción del design-system en inspector y resultados** (§4.5): sustituir
  `.select-field`, `.number-control`, `.segmented-control` y `.toggle-row` por `Select`,
  `UnitField`, `SegmentedControl` y `PropertyRow`; y `<section className="tool-group">`
  por `ToolGroup`. Es refactor de marcado, no de materia.
- **Limpieza de los estratos históricos de `styles.css`** (§4.4): consolidar las 3-4
  declaraciones dispersas por selector en una sola.
- **`@layer`** como sustituto del orden de importación (§4.1).

## 10 · Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El chrome opaco oculta el modelo donde antes lo dejaba entrever. | Zonas seguras revisadas en navegador contra un modelo denso (§4.3, §8). Es el riesgo principal del ciclo y el único que ningún test puede juzgar. |
| Una regresión de cascada como los dos Criticals del ciclo 1. | `material.css` eager elimina la clase de fallo de C1. `qa` obligatorio por tarea de materia ataca la de C2. |
| Una red nueva que no puede detectar nada (5 casos en el ciclo 1). | Verificación por mutación obligatoria antes de commitear cada red (§7). |
| Retirar los tokens de vidrio rompe un consumidor no detectado. | El contrato de resolución de `tokens.test.ts:251` falla si queda un `var(--sc-…)` colgando en `styles.css` o `ui.css`. |
| El volumen clay se filtra a las zonas técnicas densas y degrada la lectura de datos. | El rol `flat` es el nivel por defecto de tablas, filas del inspector y campos numéricos; los radios densos están congelados (§3.3). |
| `material.css` engorda el chunk de entrada más de lo que la retirada de duplicados devuelve. | Se mide antes y después; el techo solo se re-basa si la medición lo justifica (§8). |
| El ciclo es largo (10 tareas) y la revisión se relaja hacia el final. | Revisor por tarea, ledger SDD, y cada tarea acotada a una zona con su propia red en `qa.mjs`. |
