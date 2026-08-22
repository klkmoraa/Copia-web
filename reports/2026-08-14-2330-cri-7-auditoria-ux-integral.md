# CRI-7 — Auditoría UX integral de StructureCo

**Fecha:** 2026-08-14 23:30
**Agente:** Claude Code
**Rama:** `research/cri-7-ux-audit`, partiendo de `main` en **`b121c03`** (`b121c03dd307dcdbc7bdea96172222ed8eacddfe`, «merge: limpieza segura del repositorio, gate completo en verde»)
**Clasificación:** `AUDIT/TEMPORARY` — evidencia de una ejecución concreta. No es especificación ni contrato.

> **Nota de procedencia del SHA.** `origin/main` estaba en `b121c03` al iniciar. La referencia local `main` estaba desactualizada en `8b3705d`; el árbol auditado es el de `origin/main` (`b121c03`), verificado con `git rev-parse`.

## Alcance y no-alcance

Esta es una auditoría **de diagnóstico**. No rediseña ni modifica la UX de producción.

| | |
|---|---|
| **Se audita** | Bienvenida, TopBar, ToolRail, Canvas, selección/precisión, Inspector, Results, Datasheet, Model Doctor, persistencia/import-export, estados, accesibilidad y micro-UX (botones, inputs, cards, iconos, espaciado, overlays, foco, táctil, teclado) en las tres clases de ventana. |
| **Sólo se diagnostica** | **Aula.** Se describe lo observado; no se propone un Aula vNext. |
| **Se trata aparte** | **Space 3D**, marcado experimental por el propio producto. Sus hallazgos van en una sección separada y **no** se mezclan con la priorización del producto 2D. |
| **No se toca** | Solver, schema, lógica, CSS y componentes de producción. Los únicos archivos añadidos son el script de auditoría y su evidencia bajo `reports/evidence/2026-08-14-cri-7-ux-audit/`. |

**El Brandbook Clay se leyó íntegro antes de emitir cualquier juicio de diseño** (`brand/brandbook-clay.html`, 14 secciones).

> **Regla transversal de autoridad.** El Brandbook Clay oficial de StructureCo es la **autoridad normativa** para identidad visual y UX visual del producto. El código, los tokens y los componentes actuales representan únicamente el **estado implementado** — no una fuente alternativa de verdad que compita con el brandbook. En consecuencia, en todo este informe:
> - Cuando código/tokens difieren del brandbook, se clasifica como **desviación del contrato visual a reconciliar** — el brandbook fija el objetivo, la implementación actual es el punto de partida a corregir en una fase posterior. No se plantea como una disyuntiva de «qué documento manda».
> - Sólo se deja como **decisión pendiente** aquello que el propio brandbook declara explícitamente abierto en su texto. Todo lo demás donde el código se aparta del brandbook tiene ya una dirección clara: converger hacia el brandbook.

`.claude/skills/mobile-app-ui-design` se usó **sólo** como referencia de heurística táctil y ergonómica (tamaños de objetivo, alcance del pulgar, hojas inferiores). Ninguna de sus recomendaciones estéticas genéricas entra en este informe: la estética de referencia es Clay.

## Método y reproducibilidad

```
npm ci && npm run build
node reports/evidence/2026-08-14-cri-7-ux-audit/audit-ux.mjs
```

El script sirve `dist/` con `vite preview` y recorre la app real en Chromium (Playwright, el mismo motor que `qa.mjs`), midiendo por flujo × viewport:

- **canvas-budget**: área del lienzo, chrome fijo por panel y chrome flotante que se superpone al lienzo, con unión de rectángulos por barrido para no contar dos veces los solapes.
- objetivos interactivos por debajo de los mínimos **que declara el propio proyecto** (`--sc-size-target-touch: 44px`, `--sc-size-target-pointer: 36px`).
- texto renderizado por debajo de 11px.
- desbordamiento horizontal del documento.
- anillo de foco al recorrer con `Tab`.
- radios de borde efectivamente renderizados, contra la escala del Brandbook §06.
- solapamiento entre controles flotantes sobre el lienzo.

Evidencia: **85 capturas** en `reports/evidence/2026-08-14-cri-7-ux-audit/shots/` y métricas crudas en `audit-data.json`.

Los viewports táctiles se emularon con `hasTouch: true`, lo que **sí** activa `(pointer: coarse)` y `(hover: none)` en Chromium — verificado explícitamente antes de aceptar las cifras, porque de ello depende que se apliquen los mínimos táctiles del proyecto.

### Limitaciones honestas de esta medición

1. **El anillo de foco se detectó sobre el elemento enfocado.** 70 de 480 paradas aparecieron «sin anillo»: todas son objetos SVG del lienzo (`g.node-object`, `g.member-object`, `g.load-symbol`, `g.distributed-symbol`). **Son falsos positivos**: `styles.css:604-605,663-664,689` sí pinta el indicador, pero sobre un *hijo* (`.member-line`, `.node-dot`) o con `filter: drop-shadow`. Verificado en el CSS. **No se reporta como defecto.**
2. **El contraste no se midió automáticamente.** Se citan las ratios que el propio brandbook publica (§04); no se recalcularon por píxel. Cualquier afirmación de contraste aquí es del brandbook, no una medición nueva.
3. Un primer sondeo manual mostró un clic inicial perdido al entrar al espacio de trabajo. **No se reprodujo**: en los 11 viewports de la corrida instrumentada `firstClickDropped` fue `false` en todos. Se atribuye a arranque en frío del arnés, **no** se reporta como hallazgo.
4. Model Doctor y Datasheet aparecen como `unreachable` en `audit-data.json` en varios viewports. Se comprobó después a mano que **es una limitación del arnés, no del producto** (ver F-06): el arnés sólo buscaba el lanzador del TopBar.

---

## 1. Matriz de flujos × viewports

`ok` = flujo alcanzado y medido · `ok*` = alcanzado por ruta alternativa distinta de la de escritorio · `—` = no aplica en esa clase.

| Flujo | 320×568 | 360×800 | 375×667 | 390×844 | 844×390 apais. | 768×1024 tablet | 900×1000 split | 1024×768 | 1280×800 | 1440×900 | 1536×960 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 Bienvenida | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| 02 Mesa (reposo) | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| 03 Análisis → Results | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| 04 Selección + Inspector | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| 05 Diagramas (Momento) | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| 06 Model Doctor | ok\* | ok\* | ok\* | ok\* | ok\* | ok\* | ok\* | ok | ok | ok | ok |
| 07 Datasheet | ok\* | ok\* | ok\* | ok\* | ok | ok\* | ok | ok | ok | ok | ok |
| 08 Menú utilidades / export | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| 09a Aula · diálogo | — | — | — | ok | — | ok | — | — | — | ok | — |
| 09b Aula · mesa guiada | — | — | — | ok | — | ok | — | — | — | ok | — |
| 10 Space 3D (experimental) | — | — | — | ok | — | ok | — | — | — | ok | — |

**Clases de ventana efectivas del producto** (medidas, no declaradas):

| Clase | Rango real | Qué cambia |
|---|---|---|
| Compact | ≤ 1023px | Inspector pasa a hoja inferior tras botón flotante; rail se convierte en barra flotante horizontal sobre el lienzo; TopBar colapsa a marca + acciones + «Más»; zona de contexto oculta. |
| Medium | **no existe como tier propio** | Ver F-01. Entre 1024 y 1439 el layout es idéntico al Expanded. |
| Expanded | ≥ 1024px | Rail 164px + Inspector 320px + Results 320px de alto, todos permanentes. |

---

## 2. Canvas-budget

La pregunta: **de todo el píxel disponible, ¿cuánto llega de verdad al modelo?**

- *canvas % vp* — el hueco de layout del lienzo (`.canvas-host`) sobre el área del viewport.
- *útil % vp* — ese hueco **menos** el chrome flotante que se le superpone (minimapa, controles de zoom, chips de vista, badge de modo, estado, disparador de capas, botón de inspector).
- *útil % lienzo* — cuánto del propio lienzo queda libre de chrome flotante.

| Viewport | Clase | canvas % vp | **útil % vp** | útil % lienzo | flotante % lienzo |
|---|---|---|---|---|---|
| 320×568 | Compact | 71.8 | **63.0** | 87.7 | 12.3 |
| 360×800 | Compact | 80.0 | **74.4** | 93.1 | 6.9 |
| 375×667 | Compact | 76.0 | **69.6** | 91.6 | 8.4 |
| 390×844 | Compact | 81.0 | **76.2** | 94.0 | 6.0 |
| 844×390 apaisado | Compact | 69.5 | **59.4** | 85.5 | 14.5 |
| 768×1024 tablet | Medium | 82.8 | **78.6** | 94.9 | 5.1 |
| 900×1000 split | Medium | 82.4 | **78.1** | 94.8 | 5.2 |
| **1024×768** | Expanded | 24.6 | **20.3** | 82.5 | 17.5 |
| 1280×800 | Expanded | 30.3 | **26.7** | 87.9 | 12.1 |
| 1440×900 | Expanded | 36.1 | **33.3** | 92.0 | 8.0 |
| 1536×960 | Expanded | 39.2 | **36.7** | 93.5 | 6.5 |

**El presupuesto está invertido.** El móvil da al modelo 63–76% de la pantalla; el escritorio, 20–37%. En 1024×768 —una resolución de portátil corriente— el lienzo mide **540×358 px**: el modelo estructural vive en **una quinta parte** de la pantalla.

Desglose del chrome fijo, en % del viewport:

| Viewport | TopBar | ToolRail | Inspector | Results | Nota legal | **chrome total** | lienzo |
|---|---|---|---|---|---|---|---|
| 1024×768 | 8.9 | 14.1 | **27.6** | 22.0 | 2.9 | **75.5** | 24.6 |
| 1280×800 | 8.5 | 11.4 | 22.2 | 24.9 | 2.8 | 69.8 | 30.3 |
| 1440×900 | 7.6 | 10.3 | 20.0 | 23.6 | 2.4 | 63.9 | 36.1 |
| 1536×960 | 7.1 | 9.7 | 18.9 | 22.8 | 2.3 | 60.8 | 39.2 |
| 390×844 | 5.7 | 6.9 | 0 (hoja) | 6.4 | 0 | 19.0 | 81.0 |

En 1024×768 **el Inspector ocupa más superficie que el propio modelo** (27.6% vs 24.6%).

Tres causas concretas, todas verificadas:

1. **El rail y el Inspector no se contraen nunca por encima de 1024** (F-01).
2. **El panel Results reserva 320px de alto fijos** en todas las anchuras. En una pantalla de 768px de alto son 22 puntos de viewport que el lienzo no recupera, incluso antes de analizar.
3. El chrome flotante sobre el lienzo pesa más cuanto menor es el lienzo: 17.5% del lienzo en 1024×768 frente a 6.5% en 1536×960. Los mismos widgets de tamaño fijo sobre un lienzo que se encoge.

**Qué ya funciona y debe conservarse:** en Compact el reparto es correcto y deliberado — el lienzo manda, Inspector y Results salen del flujo y vuelven como hojas. Es exactamente lo que pide el Brandbook §02 («Canvas primero en móvil; Inspector y resultados migran a hojas inferiores»). El problema no es el móvil: es que el escritorio nunca recibió esa misma disciplina.

---

## 3. Hallazgos priorizados

Severidad: **Alta** = impide, degrada o desorienta en un flujo principal · **Media** = fricción medible o incoherencia perceptible · **Baja** = pulido.

---

### F-01 · El tier responsive de 1024–1439 es código muerto: el rail y el Inspector nunca se contraen

- **Flujo:** 02 Mesa, 03 Results, 04 Inspector — todo el trabajo de escritorio.
- **Pasos:** Abrir la app → «Pórtico de ejemplo» → llevar la ventana a 1024×768 → medir `.toolbar` e `.inspector-panel`.
- **Viewport / input:** 1024–1439px, puntero fino.
- **Evidencia:** `shots/02-workspace-idle__1024x768.png`, `shots/03-results__1024x768.png`; medición viva del cascade.

**Problema observado.** `styles.css` declara **tres veces** el ancho del rail para el mismo rango, y la última gana:

| Orden | Línea | Regla | Valor |
|---|---|---|---|
| 1 | `styles.css:979` | `@media (max-width:1279px) { :root { --toolbar-w: rail-compact } }` | 76px |
| 2 | `styles.css:1851` | `@media (min-width:1024px) and (max-width:1439px) { :root { --toolbar-w: rail-compact } }` | 76px |
| 3 | `styles.css:3512` | `@media (min-width:1024px) and (max-width:1439px) { :root { --toolbar-w: rail } }` | **164px ← gana** |

Medición del valor computado en `:root`, barriendo anchuras:

| Ancho | `--toolbar-w` computado | rail medido | Inspector medido |
|---|---|---|---|
| 1280 | 164px | 164px | 320px |
| 1279 | **290px declarado para el inspector** | 164px | **320px** |
| 1100 | — | 164px | 320px |
| 1024 | 164px | 164px | 320px |
| **1023** | 76px | (pasa a barra flotante) | (pasa a hoja) |

El Inspector tiene su propia causa, distinta: `AppShellLayout.tsx:48` escribe `--inspector-w: 320px` **inline** sobre `.app-shell` a partir de la preferencia de layout (por defecto `DEFAULT_INSPECTOR_WIDTH = 320`). Una declaración inline en un ancestro gana siempre a `:root`, así que `--inspector-w: 290px` de `styles.css:979` **nunca se aplica**. El valor computado en `:root` sí baja a 290px en ≤1279 — se puede leer en devtools y creer que funciona — pero `.workspace` resuelve el inline de 320px.

El efecto neto: entre 1024 y 1439 el usuario paga 164px de rail + 320px de Inspector = **484px de los 1024 disponibles (47% del ancho) en chrome lateral permanente**, en el rango de anchura donde menos sobra.

Además queda muerto todo el bloque de `styles.css:980-982`, que colapsaba el rail a sólo iconos (`.tool-button > span:not(.sc-tool-button__icon) { display:none }`): `styles.css:3514` lo revierte con `display:inline` para el mismo rango.

- **Severidad:** **Alta.**
- **Impacto:** es la causa principal del canvas-budget invertido de la §2. En 1024×768 el modelo cae al 24.6% del viewport.
- **Local o sistémico:** **sistémico** — no es un valor mal puesto, es una cascada con tres capas contradictorias sobre la misma variable, sin ninguna prueba que fije cuál debe ganar. `qa-topbar.mjs` recorre 1024–1600 pero sólo verifica que las zonas del TopBar no se solapen ni desborden; nada afirma que el tier compacto llegue a activarse.
- **Qué funciona bien y hay que conservar:** el mecanismo de preferencias (`useWorkspaceLayoutPreferences`) es sólido: ancho de Inspector con `clamp` entre 280 y 480, detents normalizados por viewport, persistencia tolerante a fallos de `localStorage`, y `toolRailCompact`/`fullCanvas`/`inspectorCollapsed` ya existen como controles de usuario. **La capacidad de dar más lienzo ya está construida**; lo que falla es el valor por defecto y la cascada, no la arquitectura.

---

### F-02 · El escritorio no cumple el mínimo de puntero que el propio proyecto declara

- **Flujo:** 02, 03, 05, 07 — TopBar, Results, Datasheet.
- **Pasos:** entrar a la mesa → analizar → abrir Datasheet → medir todo control interactivo visible.
- **Viewport / input:** 1024–1536, puntero fino.
- **Evidencia:** `audit-data.json` → `hitTargetsPointer`; `shots/07-datasheet__1440x900.png`.

**Problema observado.** El proyecto declara `--sc-size-target-pointer: 36px`. Por debajo de ese mínimo, en Expanded:

| Control | Medida | Región | Viewports |
|---|---|---|---|
| `input` (casilla del Datasheet) | **13×13** | diálogo | 4 |
| `input` «Buscar en la tabla» | 292×**19.5** | Datasheet | 4 |
| `select` «Objetivo de análisis» | 81×**20** | Results | 3 |
| `input` «Nombre del proyecto» | 260×**24** | TopBar | 4 |
| `button.envelope-toggle` | 48×**26** | Results | 4 |
| `button.resize-handle` | 64×**28** | Results | 4 |
| `select.units-select` | 58×**30** | TopBar | 2 |
| `button.project-menu-toggle` | **33**×40 | TopBar | 1 |

Una casilla de 13×13 px en la hoja de datos es el peor caso: es el control con el que se marca «Rótula» por barra.

- **Severidad:** **Media-alta** (alta para la casilla de 13×13, que además es una edición estructural real).
- **Impacto:** precisión de puntero degradada justo en las superficies densas (Datasheet, Results), que son las que más clics finos piden.
- **Local o sistémico:** **sistémico en el origen, local en cada caso**. El bloque `@media (pointer:coarse)` de `styles.css:1109-1125` impone 44px con disciplina y **funciona**: los viewports táctiles salen casi limpios (1–6 incumplimientos). No existe el bloque equivalente para puntero fino, así que el mínimo de 36px es un token que nadie hace cumplir.
- **Qué funciona bien y hay que conservar:** el bloque `(pointer:coarse)` completo. Es la razón por la que el móvil aprueba, e incluye detalles finos que conviene no perder: `.member-hit { stroke-width:44 }`, `.node-object .node-hit { r:22px }`, `.load-hit { stroke-width:44 }` — el área de acierto sobre el lienzo se agranda para el dedo **sin** engordar el trazo dibujado. Eso es exactamente la separación que pide el Brandbook §02 (el dibujo se mantiene analítico; lo táctil está alrededor).

---

### F-03 · La escala tipográfica vive por debajo del umbral legible

- **Flujo:** todos.
- **Pasos:** cualquier flujo → recolectar `font-size` computado de todo nodo de texto visible.
- **Viewport / input:** los 11.
- **Evidencia:** `audit-data.json` → `tinyText`; `shots/04-selection-inspector__1440x900.png`.

**Problema observado.** 37 combinaciones distintas de selector/tamaño por debajo de 11px, repartidas en 8px (2), 9px (4) y 10px (31). Y no es sólo decoración:

| Tamaño | Elemento | Contenido |
|---|---|---|
| 8px | `span` (TopBar) | «Modo de cálculo» |
| 8px | `text.preview-load-label` | «Fy» — rótulo de carga sobre el lienzo |
| 9px | `dt` (Inspector) | «N máx.» |
| 9px | `span` (Results) | «Centro analítico» |
| 10px | `dd` (Inspector) | **«-7.7879 kN» — un resultado del solver** |
| 10px | `text` (diagrama) | **«36.35» — un valor de diagrama** |
| 10px | `div.professional-note` | el aviso legal de responsabilidad profesional |

En el fuente, la distribución de literales de `font-size` confirma que no son excepciones: **7px×1, 8px×35, 9px×73, 10px×76, 11px×44**. 229 declaraciones a 11px o menos, frente a 72 por encima.

- **Severidad:** **Alta** para los valores numéricos de ingeniería y el aviso legal; Media para el resto.
- **Impacto:** una app cuyo producto es un número trazable renderiza varios de esos números a 10px. El Brandbook §13 dice «los números siempre acompañan la afirmación»; a 10px acompañan mal.
- **Local o sistémico:** **sistémico**. Hay tokens de tipografía, pero la mayoría del CSS usa literales y el suelo de facto de la escala está en 8-9px.
- **Qué funciona bien y hay que conservar:** el uso de `font-variant-numeric: tabular-nums` en los campos numéricos (`.number-control input`, `.results-table`) — las columnas de cifras alinean correctamente, que es lo que distingue una tabla de ingeniería de una tabla cualquiera. Y la elección tipográfica (Plex Sans + Plex Mono) es la correcta y está bien aplicada.

---

### F-04 · Dos lenguajes de botón de herramienta conviven en el mismo rail

- **Flujo:** 02 Mesa — selección de herramienta.
- **Pasos:** entrar a la mesa → observar el rail → activar «Nodo» y comparar con el botón de paleta de comandos.
- **Viewport / input:** todos; más visible en Expanded.
- **Evidencia:** `shots/02-workspace-idle__1440x900.png`.

**Problema observado.** El design system implementa la regla de arcilla **correctamente**. `ui.css:565-572`, con comentario propio («La herramienta se reconoce por el color del icono; el estado, por el volumen — elegida = hundida, nunca rellena de color»):

```css
.sc-tool-button.is-active { background: var(--sc-color-surface-inset);
  box-shadow: var(--sc-shadow-clay-pressed); transform: var(--sc-clay-press-transform); }
```

Eso es exactamente el Brandbook §08: «un botón activo **se hunde**, no se resalta con más elevación. Elevar el estado activo es lo que hace que una interfaz clay se sienta inflada».

Pero el botón de herramienta que **realmente** se renderiza en el rail no usa esa clase. `ToolBar.tsx:93`:

```jsx
className={`tool-button tool-${id}${active ? ' active' : ''}...`}
```

— sin `sc-tool-button`, y con `active` en vez de `is-active`. Cae por tanto en la regla legacy de `styles.css:571`:

```css
.tool-button.active { color: var(--accent); background: var(--accent-soft); }
```

Un tinte plano: ni elevación en reposo, ni hundido al activarse, ni volumen. Mientras tanto, en el mismo rail, el botón de paleta de comandos (`ToolBar.tsx:142`) y el dock móvil de cargas (`ToolBar.tsx:416`) **sí** llevan `sc-tool-button`/`is-active` y sí se hunden. Resultado: dos gramáticas de estado activo a centímetros una de otra.

- **Severidad:** **Media.**
- **Impacto:** el rail es el control más usado del editor y es donde el sistema de arcilla se demuestra o se cae — el brandbook lo dice literalmente. Ahora mismo se cae en el botón principal y se sostiene en los secundarios.
- **Local o sistémico:** **sistémico de forma engañosa**. No es que falte el patrón: el patrón existe, está bien hecho y hasta documentado en el CSS. Lo que falta es que el componente de producción lo consuma. Es la diferencia entre «no implementado» y «implementado y no conectado», y esa distinción cambia por completo el coste de arreglarlo.
- **Qué funciona bien y hay que conservar:** `ui.css` entero como fuente del lenguaje clay. Los tokens de sombra (`--sc-shadow-clay-xs/sm/md/lg/pressed`) reproducen fielmente las recetas del Brandbook §14.1, con las dos capas (oscura abajo-derecha, luz arriba-izquierda) y sin el halo de neón contra el que el brandbook advierte. Los tiempos de motion coinciden exactamente con §12: `press 70ms`, `fast 140ms`, `standard 220ms`, `slow 360ms`.

---

### F-05 · El diálogo de «Nuevo ejercicio» está construido fuera del design system

- **Flujo:** 09a Aula — creación de ejercicio (**diagnóstico**, sin propuesta de rediseño).
- **Pasos:** Bienvenida → «Nuevo ejercicio» → se abre un modal sobre la propia bienvenida (no navega).
- **Viewport / input:** 390×844, 768×1024, 1440×900.
- **Evidencia:** `shots/09a-aula-dialogo__390x844.png`, `…__768x1024-tablet.png`, `…__1440x900.png`.

**Problema observado.** `NewExerciseDialog.tsx` no usa ni `sc-*` ni clases CSS: dibuja todo con un objeto de estilos inline (`styles.backdrop`, `styles.dialog`, `styles.template`, `styles.submit`, …). Consecuencias medibles:

- **Sombra genérica en vez de arcilla:** `boxShadow: '0 24px 80px rgba(0,0,0,.24)'`. Es justo el `drop shadow` genérico que el Brandbook §14.1 usa como contraejemplo: falta la segunda capa de luz que define el clay.
- **Radios fuera de toda escala:** 20, 14, 12, 11, 9 y 999 px. Ni la escala del brandbook (6/8/13/18/26) ni la de tokens (8/12/14/26).
- **Tipografía por debajo del suelo:** 9px (`unit`, `badge`), 10px (`templateDescription`, `note`, `fieldError`).
- **Colores de reserva del tema claro codificados a mano:** `#d8dde5`, `#667085`, `#18202a`, `#f2f4f7`, `#b42318`. Si un token faltara en tema oscuro, el diálogo caería a paleta clara sobre fondo oscuro. Hoy los tokens existen, así que es un riesgo latente, no un fallo visible — pero es exactamente el patrón contra el que advierte el Brandbook §14.4.
- Sin `:focus-visible` propio: estos controles dependen del anillo por defecto del navegador, no del anillo de 3px del sistema.

- **Severidad:** **Media.**
- **Impacto:** Aula es una de las dos audiencias declaradas del producto, y su puerta de entrada es la superficie menos alineada con la identidad. El Brandbook §01 insiste en que Aula y Completo son «un solo motor»: aquí se notan como dos productos.
- **Local o sistémico:** **local en el archivo, sintomático de lo sistémico** — es la prueba de que no hay nada que impida construir una superficie entera al margen del design system.
- **Qué funciona bien y hay que conservar:** la **accesibilidad de este diálogo es de las mejores del producto** y no debe perderse en ninguna reescritura: `role="dialog"`, `aria-modal`, `aria-labelledby` + `aria-describedby`, `useModalFocus` con trampa de foco y `Escape`, foco inicial dirigido, navegación **roving** por flechas/Home/End sobre las plantillas, y reenfoque automático del primer campo inválido tras un envío fallido (`shouldFocusInvalidRef`). El botón de cierre respeta 44×44 y el de envío 46px de alto. Eso es trabajo fino y correcto.

---

### F-06 · Model Doctor pierde su afordancia directa por debajo de 1024px

- **Flujo:** 06 Model Doctor.
- **Pasos:** mesa en Compact → el botón «Model Doctor» del TopBar no está → abrir «Más acciones» → «Model Doctor» (tercera entrada).
- **Viewport / input:** ≤1023px, táctil.
- **Evidencia:** `shots/06-model-doctor__1440x900.png` (directo) frente al recorrido por menú verificado a mano en 390×844 y 768×1024.

**Problema observado.** `styles.css:4713-4715` hace `display:none` sobre `.topbar-command-button` por debajo de 1024px. **Model Doctor sigue siendo alcanzable**: está en el menú «Más acciones», visible y funcional (verificado enumerando el menú en 390×844). No es un bloqueo.

Lo que sí se observa es el **contenido de ese menú**: 19 entradas heterogéneas en un solo popover plano — Deshacer, Rehacer, Model Doctor, casos activos, experiencia Aula/Completo, orden de análisis, unidades, idioma, tema, Space 3D, ocultar inspector, mesa completa, contraer herramientas y seis acciones de exportación. Deshacer/Rehacer y Model Doctor (acciones de trabajo frecuentes) comparten un mismo cajón con preferencias de idioma y tema.

- **Severidad:** **Baja-media** (descubribilidad, no acceso).
- **Impacto:** en tablet —donde revisar el modelo antes de analizar tiene todo el sentido— la herramienta de diagnóstico queda a dos toques y sin señal visual.
- **Local o sistémico:** **local** en cuanto a Model Doctor; el menú sobrecargado sí es un patrón de Compact que conviene mirar entero.
- **Qué funciona bien y hay que conservar:** que exista una ruta de reserva completa. La app **no** amputa funciones en móvil: unidades, orden de análisis, combinaciones, exportaciones y Model Doctor siguen todos disponibles. Es una decisión de producto correcta y poco común; el problema es de jerarquía dentro del cajón, no de capacidad.

---

### F-07 · «Ajustar modelo a la vista» reserva menos margen derecho del que ocupa el chrome

- **Flujo:** 02 Mesa — encuadre.
- **Pasos:** mesa con modelo → pulsar «Ajustar modelo a la vista» → comparar el rectángulo seguro con el chrome real del borde derecho.
- **Viewport / input:** ≥1024px.
- **Evidencia:** medición de bandas en `audit-data.json` → `canvasBudget.floatingChrome.items`.

**Problema observado.** `canvasChromeGeometry.ts:27-30` fija los márgenes por constantes:

```ts
if (viewport.width <= 480)  return { top:104, right:58, bottom:58, left:58 };
if (viewport.width <= 1023) return { top:116, right:64, bottom:62, left:64 };
return { top:116, right:68, bottom:62, left:68 };
```

Contrastadas contra el chrome medido dentro del lienzo:

| Viewport | superior | inferior | izquierda | **derecha** |
|---|---|---|---|---|
| 320×568 | 44 vs 104 ok | 54 vs 58 ok | 0 vs 58 ok | 52 vs 58 ok |
| 390×844 | 44 vs 104 ok | 54 vs 58 ok | 0 vs 58 ok | 52 vs 58 ok |
| 768×1024 | 48 vs 116 ok | 56 vs 62 ok | 0 vs 64 ok | 54 vs 64 ok |
| 1024×768 | 50 vs 116 ok | 54 vs 62 ok | 0 vs 64 ok | **144 vs 64 ✗** |
| 1440×900 | 50 vs 116 ok | 54 vs 62 ok | 0 vs 64 ok | **144 vs 68 ✗** |
| 1536×960 | 50 vs 116 ok | 54 vs 62 ok | 0 vs 68 ok | **144 vs 68 ✗** |

En Compact las constantes son **generosas** y el encuadre es correcto — conviene decirlo, porque era la hipótesis contraria y la medición la desmintió. El desajuste está sólo en el **borde derecho en Expanded**: `.canvas-minimap` mide 132px y se separa 12px del borde, ocupando **144px**, más del doble del margen de 68px que reserva el encuadre. Los chips de vista llegan a 247px desde el borde derecho, aunque quedan altos y en parte los cubre la banda superior.

Efecto: tras «Ajustar a la vista», la parte derecha del modelo puede quedar bajo el minimapa.

- **Severidad:** **Media.**
- **Impacto:** afecta a la acción de encuadre más usada, y en la clase de ventana donde el lienzo ya es escaso.
- **Local o sistémico:** **local**, con causa sistémica: los márgenes son constantes escritas a mano en vez de medidas del chrome real, así que cualquier cambio de tamaño de un widget flotante los desincroniza en silencio.
- **Qué funciona bien y hay que conservar:** **que este módulo exista**. `canvasChromeGeometry.ts` ya separa correctamente «rectángulo seguro» de «viewport», ya lo usa tanto el encuadre (`cameraToFitBounds`) como la colocación de rótulos inteligentes (`layoutSmartLabels`), y tiene `clamp` de escala entre 24 y 150. El concepto es el correcto; sólo la fuente de los números es frágil.

---

### F-08 · En 320 y 360px el nombre del proyecto se reduce a una franja de 8px

- **Flujo:** 02 Mesa — identidad del documento.
- **Pasos:** mesa en 320×568 → mirar la zona de marca del TopBar.
- **Viewport / input:** 320 y 360 px, táctil.
- **Evidencia:** `shots/02-workspace-idle__320x568.png`, `shots/02-workspace-idle__360x800.png`.

**Problema observado.** `input` «Nombre del proyecto» medido en **8×44 px**. Alto correcto (el bloque coarse hace su trabajo), pero 8px de ancho: no cabe ni un carácter. El campo declara `min-width:72px` en `styles.css:501`, pero `.project-name { min-width:0 }` y `.document-identity { min-width:0 }` permiten que el grid lo comprima por debajo de ese mínimo cuando la zona de acciones —que es `max-content`— reclama el ancho.

A partir de 375px el problema desaparece; en 1024+ el campo mide 187–260px.

- **Severidad:** **Media.**
- **Impacto:** en los dos anchos más estrechos el usuario pierde de vista en qué proyecto está y no puede renombrar desde el TopBar. Hay ruta alternativa (menú de proyecto), así que no bloquea.
- **Local o sistémico:** **local**, en la negociación de ancho del TopBar por debajo de 375px.
- **Qué funciona bien y hay que conservar:** el resto de la degradación del TopBar en Compact es ordenada y está bien pensada — nombre de marca fuera, divisor fuera, zona de contexto al menú, `analyze-button` a icono de 44×44, autosave a icono. Y sobre todo: **cero desbordamiento horizontal en los 11 viewports y los 8 flujos**. Eso no es gratis y hay un gate (`qa-topbar.mjs`) que lo sostiene.

---

### F-09 · La escala de radios tiene 10 valores en pantalla, 7 fuera de la escala Clay

- **Flujo:** todos.
- **Pasos:** recolectar `border-radius` computado de botones, superficies, tarjetas, campos y pestañas visibles.
- **Viewport / input:** los 11.
- **Evidencia:** `audit-data.json` → `radii`.

**Problema observado.** Radios efectivamente renderizados:

| Radio | ¿En la escala Clay? | Instancias | Ejemplos |
|---|---|---|---|
| 6px | sí | 4 | `select` |
| **7px** | no | 123 | `button` |
| 8px | sí | 145 | `sc-tool-button` |
| **9px** | no | 20 | `mobile-inspector-close` |
| **10px** | no | 108 | `sc-tool-button` |
| **11px** | no | 70 | `canvas-layer-trigger`, `new-exercise-submit` |
| **12px** | no | 629 | `brand-mark`, `project-menu-toggle` |
| **14px** | no | 871 | `welcome-launcher-card` |
| 26px | sí | 16 | `welcome-frame`, `inspector-panel` |
| **28px** | no | 16 | `inspector-panel.mobile-open` |

El Brandbook §06 fija xs·6 / sm·8 / md·13 / lg·18 / xl·26 y advierte: «Por debajo de 13px el volumen deja de leerse: la sombra necesita curva para envolver el borde. Controles a 13px, tarjetas y paneles a 18–26px».

Dos desviaciones distintas:

1. **Los tokens mismos ya divergen**: `--sc-radius-sm: 12px` (brandbook: 8), `--sc-radius-md: 14px` (brandbook: 13), y `--sc-radius-lg` = `--sc-radius-xl` = 26px, con lo que **el peldaño de 18px del brandbook no existe** — el salto va de 14 a 26. Los dos radios más usados de la app (12px con 629 instancias y 14px con 871) son precisamente esos dos tokens desviados.
2. **1.099 instancias renderizadas por debajo de 13px**, el umbral en que el propio brandbook dice que el relieve deja de leerse. En el fuente hay 128 literales de `border-radius` por debajo de 13px (37×8px, 27×9px, 27×10px, 22×7px, 7×6px, y sueltos de 2, 3 y 4px).

- **Severidad:** **Baja** individualmente, **Media** como sistema.
- **Impacto:** el relieve de arcilla se lee peor de lo que el sistema de sombras permitiría. Las sombras están bien calibradas (F-04); las curvas que deben envolverlas, no.
- **Local o sistémico:** **sistémico.**
- **Qué funciona bien y hay que conservar:** los peldaños 6, 8 y 26 se usan y coinciden. Y `--sc-radius-sheet: 28px` para la hoja inferior es una decisión razonable aunque quede fuera de escala: una hoja que sube desde el borde pide más curva que un panel.

---

### F-10 · La iconografía tiene 14 tamaños y dos pesos de trazo

- **Flujo:** todos.
- **Pasos:** análisis estático de las llamadas a iconos.
- **Evidencia:** conteo sobre `src/**/*.tsx`.

**Problema observado.**

- **285** usos de icono con tamaño en píxeles literales, en **14 valores distintos**: 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 26, 28, 32, 42. Existen sólo 4 tokens (`--sc-size-icon-sm/md/lg/tool` = 16/20/24/22) y prácticamente nadie los usa desde TSX.
- **Sólo 9 de esos 285** fijan `strokeWidth`. No hay `LucideProvider` que cambie el valor por defecto (verificado: no aparece en el código). Por tanto **276 iconos se dibujan con el `strokeWidth: 2` por defecto de lucide-react**, mientras `design-system/icons/structural.tsx` dibuja los glifos estructurales a **1.8**, que es el valor que fija el Brandbook §11 («el mismo trazo 1.8 de terminales redondeadas del sistema real»).

Conviven pues dos pesos de trazo: 1.8 en los glifos técnicos y 2.0 en toda la iconografía de interfaz. La diferencia es sutil pero constante, y a tamaños de 13–16px es visible.

- **Severidad:** **Baja.**
- **Impacto:** ruido visual de fondo; ninguna función se pierde.
- **Local o sistémico:** **sistémico.**
- **Qué funciona bien y hay que conservar:** la **semántica** de color de iconos sí está bien resuelta y sigue el Brandbook §11 al pie: los glifos de UI genérica van en `currentColor` y los que representan un resultado técnico (axial, cortante, momento, deformada) llevan su color de la paleta técnica, con `--sc-tool-color` por variante de `sc-tool-button`. Eso es lo difícil, y está hecho.

---

### F-11 · Tres verdes de marca compiten en el producto enviado

- **Flujo:** identidad, transversal.
- **Evidencia:** `tokens.css:61-62,130`, `public/favicon.svg:2`, `public/site.webmanifest:11`.

**Problema observado.** El Brandbook §03 dice, en sus propias palabras: «esta propuesta introduce `#159a72` … reemplaza tanto al token vigente `#00795f` como al histórico del favicon/PWA `#157A55`. Antes de adoptarlo, decidir cuál de los tres queda como fuente única de verdad». Es el propio brandbook el que deja esta elección abierta — no es una lectura de este informe.

Estado hoy:

| Fuente | Valor | Uso |
|---|---|---|
| `--sc-green-500` | `#159a72` | **definido pero no usado** como color de acción |
| `--sc-color-action-primary` = `--sc-green-600` | **`#087e5c`** | todo CTA, selección, líneas de influencia, snap |
| `favicon.svg` / `site.webmanifest` | **`#157A55`** | icono e instalación PWA |

Es decir: el verde del brandbook existe en la paleta pero no manda; el que manda es un cuarto valor (`#087e5c`) que no es ninguno de los tres que el brandbook puso a decidir; y el icono con el que la app aparece instalada en el sistema usa un tercero. Un usuario que instale la PWA verá un verde en el icono y otro distinto en el botón «Resolver».

- **Severidad:** **Media** (identidad, no función).
- **Impacto:** la marca no es reconocible como un único verde en los tres puntos donde más se ve.
- **Local o sistémico:** **sistémico.** Sigue como **decisión pendiente** — y sólo por eso, no por regla general: es el único de los hallazgos de identidad de este informe donde el propio brandbook nombra explícitamente los tres valores en pugna y pide que se elija uno antes de adoptarlo. No debe «arreglarse» eligiendo por cuenta propia durante la investigación; sí debe resolverse pronto, porque hasta que se decida, ninguno de los tres valores tiene autoridad clara sobre los otros dos.
- **Qué funciona bien y hay que conservar:** la **paleta técnica** sí es disciplinada y coincide exactamente con el Brandbook §04 en tema claro: axial `#1f88b8`, cortante `#4a9463`, momento `#c94f3f`, deformada `#7d63c9`. Y el principio de que ningún significado dependa sólo del color está respetado (trazo continuo/discontinuo, iconos y etiquetas acompañan).

---

### F-12 · El tema oscuro implementa una paleta técnica distinta a la que fija el Brandbook — desviación a reconciliar

- **Flujo:** transversal, tema oscuro.
- **Evidencia:** `tokens.css:189-192` frente a `tokens.css:645-648`.

**Problema observado.** El Brandbook §04 fija el objetivo con precisión: «**Una sola paleta, no dos**: estos siete colores son idénticos en tema día y tema noche — solo el fondo y las superficies cambian de fase. Antes cada tema tenía su propio matiz…; ahora un mismo `#159a72` se reconoce igual en ambos». A diferencia de F-11, el brandbook **no** deja esto abierto: describe una paleta técnica única como el estado correcto del sistema.

La implementación actual todavía no llegó a ese objetivo — mantiene el esquema anterior de un matiz por tema:

| Rol | Claro | Oscuro (estado implementado hoy) |
|---|---|---|
| axial | `#1f88b8` | `#72c3df` |
| cortante | `#4a9463` | `#78be83` |
| momento | `#c94f3f` | `#eb8373` |
| deformada | `#7d63c9` | `#ab93e8` |

- **Severidad:** **Media.**
- **Impacto:** el color deja de ser un identificador estable entre temas justo donde más importa —los cuatro roles del solver—. Alguien que trabaje de día y revise de noche ve dos azules distintos para «axial».
- **Local o sistémico:** **sistémico.** Esto **no** es una decisión pendiente ni una disyuntiva entre dos fuentes de autoridad: el Brandbook Clay ya fija el objetivo (una sola paleta técnica, recalibrada sólo en luminosidad si el contraste sobre fondo oscuro lo exige, no en matiz). La paleta día/noche distinta que hoy implementan los tokens es el **estado actual a reconciliar contra ese contrato en una fase posterior**, no una alternativa igualmente válida.
- **Qué funciona bien y hay que conservar:** el patrón de tema **no** tiene el bug clásico de colores huérfanos contra el que advierte el Brandbook §14.4. La app resuelve el tema en JS (`ProjectContext.tsx:45-49`) y **siempre** escribe un `data-theme` explícito, así que ningún color queda definido sólo dentro de un `@media`. Ese mecanismo de resolución de tema es correcto y debe conservarse tal cual al reconciliar la paleta con el brandbook — lo que hay que corregir es qué valores de color carga en tema oscuro, no cómo decide cuándo aplicarlos.
  **Matiz observado:** el tema se lee del sistema **una sola vez**, en el inicializador de `useState`. No hay suscripción a `matchMedia`, así que si el sistema operativo cambia a oscuro con la app abierta, la app no lo sigue hasta recargar. El producto tiene dos estados de tema (claro/oscuro) donde el brandbook describe tres (claro/oscuro/según el sistema).

---

### F-13 · 31 umbrales de breakpoint distintos, sin escala compartida

- **Flujo:** transversal.
- **Evidencia:** análisis estático de `src/**/*.css`.

**Problema observado.** 96 bloques `@media`/`@container` condicionados por ancho, con **31 valores umbral distintos**:

```
360 361 380 430 460 520 560 599 600 620 640 680 700 701 760 767 768
860 900 959 960 1023 1024 1120 1279 1439 1440 1500 1536 · 26rem · 34rem
```

Cada área eligió los suyos: la bienvenida rompe en 767, el datasheet en 1023 y 700, el hub de proyectos en 680, `phase2` en 640 y 430, Space 3D en 599/959/1440, el workspace en 460/1023/1279/1439/1500. No hay tokens de breakpoint.

- **Severidad:** **Media** (mantenibilidad y coherencia, no fallo visible).
- **Impacto:** ninguna anchura concreta rompe hoy —los 11 viewports salen sin desbordamiento—, pero es el terreno en el que ocurre F-01: con 31 umbrales repartidos en 96 bloques, reglas contradictorias sobre la misma variable pasan desapercibidas.
- **Local o sistémico:** **sistémico.**
- **Qué funciona bien y hay que conservar:** el uso de **container queries** donde corresponde: `.results-panel` declara `container-type: inline-size` y `@container results-panel (max-width:560px)`, y `bulkEdit.css` usa `@container` en rem. Eso es lo moderno y lo correcto — un panel redimensionable por el usuario debe responder a **su** ancho, no al de la ventana. Es el patrón que convendría generalizar, no revertir.

---

## 4. Micro-UX: resumen de inconsistencias

| Dimensión | Estado | Referencia |
|---|---|---|
| Sombras / elevación clay | **Fiel al brandbook.** Dos capas, sin halo, con escalera completa y variante `pressed`. | §14.1 |
| Tiempos de motion | **Coinciden exactamente** (70/140/220/360). `prefers-reduced-motion` colapsa a 0.001ms globalmente. | §12 |
| Estado activo «se hunde» | Implementado en `ui.css`, **no consumido** por el botón de rail real. | F-04 |
| Radios | 10 valores en pantalla, 7 fuera de escala; falta el peldaño 18px. | F-09 |
| Tipografía | 229 declaraciones ≤11px; datos de ingeniería a 10px. | F-03 |
| Iconos | 14 tamaños literales; dos pesos de trazo (1.8 vs 2.0). | F-10 |
| Espaciado | **Tokens correctos** `--sc-space-1..8` = 4/8/12/16/20/24/32/40, base 4px exacta. Convive con literales. | §06 |
| Color de marca | Tres verdes en el producto enviado. | F-11 |
| Paleta técnica | Correcta en claro; redefinida en oscuro. | F-12 |
| Overlays | `backdrop-filter` reservado a barra superior y overlays, como pide el brandbook. Sin desenfoque por fila. | §14.6 |
| Foco | Anillo de 3px con `--sc-focus-ring-offset: 2px`, `:focus-visible`, y tratamiento propio para objetos SVG del lienzo. | §08 |

---

## 5. Accesibilidad

**Lo que está bien y hay que preservar:**

- **Enlace de salto** (`a.app-shell-skip-link`) como primer nodo del shell.
- **El lienzo es accesible por teclado de verdad.** `role="application"`, `aria-label`, `aria-describedby` y `aria-keyshortcuts="V H N M S P D O C X B R Delete Backspace Escape"`. Nodos, barras y cargas son paradas de tabulación con indicador de foco propio. Para un editor tipo CAD esto es infrecuente y valioso.
- **66 regiones `aria-live`/`role="status"`/`role="alert"`** en el producto; los errores de entrada rápida y del lienzo se anuncian.
- **Trampa de foco correcta en modales** (`modalFocus.ts`), con `Escape`, foco inicial dirigido y navegación roving por flechas en el diálogo de Aula.
- **`prefers-reduced-motion`** honrado globalmente y además por componente. También hay `prefers-reduced-transparency` y `forced-colors: active`.
- **Paridad de idiomas garantizada por tipos**: `export const en: Catalog` obliga a que cada clave española tenga su equivalente inglés; el compilador es el gate.
- **Cero desbordamiento horizontal** en 11 viewports × 8 flujos.
- **Mínimos táctiles cumplidos** bajo `(pointer: coarse)`, incluidas las áreas de acierto sobre el SVG.

**Lo que falla:**

| | Hallazgo |
|---|---|
| Tamaño de objetivo con puntero fino | F-02 — hasta una casilla de 13×13 px |
| Texto por debajo del umbral legible | F-03 — resultados del solver a 10px, aviso legal a 10px |
| Seguimiento del tema del sistema | F-12 — sin suscripción a `matchMedia` |

**No verificado en esta pasada** (y por tanto no afirmado): contraste medido por píxel, lectores de pantalla reales, y navegación por teclado exhaustiva más allá de las 480 paradas muestreadas.

---

## 6. Fortalezas que deben conservarse

Ordenadas por lo que más costaría recuperar si se perdiera:

1. **La disciplina táctil bajo `(pointer: coarse)`**, incluida la separación entre trazo dibujado y área de acierto en el SVG (`.member-hit`, `.node-hit`, `.load-hit`). Es la razón de que el móvil apruebe.
2. **La accesibilidad del lienzo por teclado**, con foco visible en objetos SVG.
3. **El canvas-budget de Compact** (63–76% al modelo) y su arquitectura de hojas inferiores: es la aplicación literal del Brandbook §02.
4. **`ui.css` como lenguaje clay correcto**: sombras de dos capas, escalera completa, `pressed`, y la regla «activo = hundido» ya escrita y comentada.
5. **Los tiempos de motion**, idénticos al brandbook, con reducción de movimiento honrada.
6. **`canvasChromeGeometry.ts`** como concepto: separar «rectángulo seguro» del viewport, y compartirlo entre encuadre y rótulos.
7. **Cero desbordamiento horizontal**, sostenido por un gate real (`qa-topbar.mjs` barre 1024–1600 más los bordes de breakpoint).
8. **Paridad i18n forzada por el sistema de tipos.**
9. **No amputar funciones en móvil**: unidades, orden de análisis, combinaciones, exportación y Model Doctor siguen accesibles en Compact.
10. **Las preferencias de layout ya existentes** (`inspectorCollapsed`, `fullCanvas`, `toolRailCompact`, ancho con `clamp`): la palanca para arreglar F-01 ya está construida.
11. **Container queries** en Results y Bulk Edit.
12. **La semántica de color técnico** (axial/cortante/momento/deformada) y el refuerzo por forma además de color.

---

## 7. Aula — sólo diagnóstico

No se propone Aula vNext. Lo observado, sin más:

- **La entrada no navega**: «Nuevo ejercicio» abre un modal sobre la bienvenida. La creación de ejercicio es un formulario de plantilla + parámetros, no un flujo guiado.
- **El modal está fuera del design system** (F-05), con buena accesibilidad y estética divergente.
- **En la mesa**, Aula aparece como `.classroom-journey`: cabecera, barra de progreso, 6 pasos en `grid-template-columns: repeat(6, minmax(0,1fr))` y un aviso. Los pasos usan tipografía de 9–10px (marcador, títulos, descripciones) y radios de 9px, ambos fuera de escala. Hay `.classroom-journey.is-compact` que pasa los pasos a una columna y revela las descripciones.
- **El color de Aula está bien resuelto**: `--sc-color-aula` = `--sc-pink-500`, aplicado como `--classroom-color` local, con mezclas `color-mix` para borde y fondo. Cumple el Brandbook §01 (el rosa identifica experiencia de aprendizaje y nunca comparte tono con el violeta de deformada).
- **El botón de paso** respeta `min-height: 44px`.

Evidencia: `shots/09a-aula-dialogo__*.png`, `shots/09b-aula-mesa__*.png`.

---

## 8. Space 3D — experimental, tratado aparte

No entra en la priorización del producto 2D. Constataciones:

- Carga como dominio separado (`.space3d-screen`, chunk propio de 649 kB) y se marca «Experimental» en la interfaz.
- **Objetivos por debajo del mínimo**: en 1440×900, 20 controles bajo 44px y 11 bajo 36px. Los más pequeños: `button.space3d-linkish` a **26×36** (los enlaces N1/N2/M1… de la lista de objetos) y `button.space3d-rail-button` a **24×44** (Deshacer, Rehacer, Eliminar selección). En 390×844, 10 controles bajo 44px y 9 bajo 36px.
- Breakpoints propios (599/959/1440) que no coinciden con los del 2D (F-13).
- Texto a 10px en `span.space3d-badge` y `span.space3d-project-picker-label`.
- Tiene su propia resolución de tema (`Space3DWorkspace.tsx:50`), duplicando la lógica de `ProjectContext`.

Evidencia: `shots/10-space3d-experimental__*.png`.

---

## 9. Principios comparados (sin copiar interfaz)

Sólo principios, para situar los hallazgos. Ninguna recomendación de imitar una interfaz concreta.

| Producto | Principio relevante | Qué dice sobre StructureCo |
|---|---|---|
| **Shapr3D** | El modelo ocupa casi toda la pantalla; las herramientas son overlays que aparecen y se retiran. | Es lo que StructureCo ya hace en Compact y **deja de hacer en Expanded** (F-01, §2). |
| **Onshape** | Paneles laterales colapsables con estado recordado; el árbol de features se esconde de un clic. | StructureCo **ya tiene** `inspectorCollapsed`/`fullCanvas`/`toolRailCompact`; lo que falta es que el valor por defecto no reserve 484px. |
| **Fusion 360** | Barra de herramientas contextual: sólo aparecen los comandos del contexto activo. | El menú «Más acciones» de Compact mezcla 19 acciones sin contexto (F-06). |
| **Dlubal RFEM** | Tablas de datos como ciudadano de primera clase, con densidad alta pero controles de tamaño normal. | El Datasheet acierta en la densidad y falla en el tamaño de control (casilla de 13×13, búsqueda de 19.5px de alto — F-02). |
| **RISA** | Resultados como panel invocable, no permanentemente residente. | Results reserva 320px de alto siempre, analizado o no (§2). |
| **SkyCiv** | Web-first, responsive real, sin modo «móvil degradado». | StructureCo **cumple esto mejor que la media**: no amputa funciones en Compact (F-06). Es una fortaleza que conviene defender. |

El patrón común de los seis: **el área de modelo es el recurso escaso y todo lo demás negocia contra ella**. StructureCo aplica ese principio en móvil e invierte la relación en escritorio.

---

## 10. Hipótesis para fases siguientes

**No son propuestas de diseño ni decisiones.** Son hipótesis separadas del diagnóstico, cada una con lo que habría que medir para confirmarla o descartarla. Ninguna debe implementarse a partir de este informe.

| # | Hipótesis | Cómo se comprobaría | Riesgo a vigilar |
|---|---|---|---|
| H-1 | Resolver la contradicción de cascada de F-01 devuelve el canvas-budget de Expanded a un rango comparable al de Compact. | Repetir la medición de §2 tras unificar la declaración; objetivo declarado explícito (p. ej. ≥55% del viewport en 1024×768). | Que el rail de sólo iconos perjudique la descubribilidad de herramientas; medir con tarea cronometrada, no por opinión. |
| H-2 | Un gate que afirme «el tier compacto se activa en el rango X» habría detectado F-01 antes de llegar a `main`. | Extender `qa-topbar.mjs` para aserciones sobre valores computados, no sólo sobre solapes y desbordamiento. | Fijar en una prueba valores que aún son decisión abierta. |
| H-3 | El panel Results como superficie invocable (no residente) recupera ~22 puntos de viewport sin pérdida de flujo. | Medir el número de aperturas por sesión y el tiempo hasta el primer resultado en ambas variantes. | Aula depende de ver resultados de inmediato; cualquier prueba debe cubrir las dos audiencias por separado. |
| H-4 | Subir el suelo tipográfico a 11–12px es absorbible sin reflow destructivo. | Aplicar el suelo sólo a datos numéricos y avisos legales, y volver a correr los 11 viewports buscando desbordamiento. | El Inspector y el Datasheet son densos; el suelo podría forzar scroll nuevo. Medir, no suponer. |
| H-5 | Los márgenes de encuadre derivados del chrome medido eliminan el desajuste de F-07 sin coste perceptible. | Sustituir las constantes por medición y comparar encuadres antes/después en los 11 viewports. | Medir en cada frame es caro; hay que acotar a cambios de tamaño. |
| H-6 | Conectar el botón de rail al `sc-tool-button` existente cierra F-04 sin tocar el design system. | Cambio de una clase en `ToolBar.tsx` + captura comparada. | La regla legacy `.tool-button.active` la usan otros botones; hay que auditar quién más depende de ella. |
| H-7 | La deriva de radios/iconos/breakpoints se detiene con gates de token, no con una limpieza puntual. | Regla de lint que prohíba literales nuevos de `border-radius`, `font-size` y `@media (width)` fuera de tokens. | Una limpieza masiva de 1.099 instancias es un diff enorme y arriesgado; conviene congelar primero y migrar por área. |
| H-8 | Reconciliar la paleta técnica de tema oscuro (F-12) con la paleta única que fija el Brandbook §04 es viable manteniendo el contraste actual. | Recalcular contraste de los cuatro roles técnicos sobre `#0d151c`/`#0a1116` usando el matiz único de tema claro, recalibrado sólo en luminosidad; comparar contra los mínimos AA que cita el propio brandbook (§04). | Si el matiz único no alcanza AA sobre fondo oscuro sin subir luminosidad más allá de lo que el brandbook anticipa, hay que decidir el ajuste exacto antes de tocar tokens — no es una limpieza mecánica. |
| **Decisión que no es hipótesis** | **F-11** (cuál de los tres verdes es la fuente única de marca). Es el único caso de este informe donde el propio Brandbook §03 nombra los valores en pugna y pide explícitamente que se elija uno. **Requiere decisión del propietario, no investigación.** F-12 no entra aquí: el brandbook ya fija su objetivo, así que su resolución es H-8, una hipótesis de reconciliación como cualquier otra. | | |

---

## Archivos añadidos por esta rama

```
reports/2026-08-14-2330-cri-7-auditoria-ux-integral.md      (este informe)
reports/evidence/2026-08-14-cri-7-ux-audit/audit-ux.mjs     (script reproducible)
reports/evidence/2026-08-14-cri-7-ux-audit/audit-data.json  (métricas crudas)
reports/evidence/2026-08-14-cri-7-ux-audit/shots/*.png      (85 capturas)
```

Ningún archivo de producción fue modificado. Sin cambios en `src/**`, `package.json`, gates ni documentación canónica. No se ha hecho merge ni publicación en Pages.

## Cómo verificar

```bash
git log -1 --format=%H                    # b121c03… como base
git diff --stat origin/main -- .          # sólo reports/** (la ref local `main` está desactualizada)
npm run build && node reports/evidence/2026-08-14-cri-7-ux-audit/audit-ux.mjs
```

El script vuelve a generar `audit-data.json` y las capturas. `CRI7_ONLY_EXTRA=1` reejecuta sólo Aula y Space 3D fusionando sobre la evidencia previa.

## Pendientes declarados

- Contraste medido por píxel en ambos temas (no cubierto aquí; §04 del brandbook publica ratios, no se recalcularon).
- Prueba con lectores de pantalla reales.
- Barrido continuo de anchuras entre 320 y 1920 buscando más reglas contradictorias del tipo F-01; esta pasada usó 11 viewports representativos, no un barrido.
- F-11 espera decisión del propietario del repositorio (único caso donde el propio Brandbook deja abierta la elección). F-12 no espera decisión: el brandbook ya fija su objetivo; queda pendiente de reconciliación en fase posterior (H-8).
