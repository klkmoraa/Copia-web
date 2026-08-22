# CRI-93 — Medición de rendimiento del Datasheet y la Command Palette con modelo grande

**Fecha:** 2026-08-19 23:00
**Agente:** Claude Code
**Rama:** `claude/cri-93-performance-measurement-2a5ewq`
**Baseline:** `origin/main` = `6efe1b57dfa9fb1deaec41846d9830316a2d0f15`
**Evidencia:** `reports/evidence/2026-08-19-cri-93-performance/`

> ## RESULTADO: `BLOCKED — falta dispositivo físico`
>
> CRI-93 exige medir en un **dispositivo real**. Este entorno de ejecución es un
> contenedor de desarrollo sin acceso a ningún dispositivo físico y sin un
> segundo navegador real instalable. La issue **queda abierta**. Lo que sí se
> entrega: el harness reproducible que faltaba, la medición completa de las seis
> métricas en el entorno que sí existe (declarada como `container-headless`, no
> como cumplimiento), el presupuesto justificado, y una decisión **provisional**
> sobre virtualización con el dato que la sostiene y lo que le falta para ser
> definitiva.

## 1. Baseline verificado

`origin/main` real al ejecutar: `6efe1b57dfa9fb1deaec41846d9830316a2d0f15`
(coincide con el esperado por el encargo). El cuerpo de CRI-93 declara como
baseline `7fb927fb…`, anterior; se releyeron sus seis afirmaciones sobre este
`main` y este es su estado real hoy:

| Afirmación de CRI-93 | Estado sobre `6efe1b57` |
| --- | --- |
| `src/features/datasheet/**` completa, `DatasheetPanel` con `lazy` | Cierto. 26 archivos; `WorkspaceShell.tsx` la monta con `Suspense`/`lazy`. |
| `DatasheetGrid.tsx` **no virtualiza** | Cierto. Renderiza `rows.map(...)` completo; `aria-rowcount = rows.length + 1`. |
| `CommandPalette.tsx`, 411 líneas, construye la lista en cada render | **Desactualizado.** Hoy son 223 líneas: CRI-103 movió la construcción a `commandRegistry.ts` (`buildCommands`). La lista se memoiza (`useMemo` sobre el contexto), pero **sigue proyectando un comando por nudo y por barra** y **sigue renderizando todas las coincidencias** sin ventana. El riesgo que CRI-93 señala sigue existiendo. |
| Infraestructura de medición reutilizable | Parcialmente. `scripts/measure-performance.mjs` mide **sólo bytes del bundle**; `check-performance-budget.mjs` no impone techo (`Infinity`). No había nada que midiera interacción. |
| Fixtures grandes `grande.structureco` / `enorme.structureco` | **No existen.** No hay ningún fixture de modelo grande versionado; `datasheetFixtures.ts` es un pórtico de 3 nudos. Por eso esta issue tuvo que generar el escenario (§3). |
| Dato previo `EXPERIMENTAL` de CRI-11: 1,16 s hasta la primera fila con 1292 filas | Se compara en §7. |

## 2. Dispositivo real: por qué esto está `BLOCKED`

Se comprobó, no se supuso:

| Comprobación | Resultado |
| --- | --- |
| `adb` / dispositivo Android | `adb: command not found` |
| Bus USB (`/dev/bus/usb`, `lsusb`) | No existe |
| Herramientas iOS (`xcrun`, `ideviceinfo`) | No existen |
| Host | `Linux 6.18.5-fc-v20 x86_64`, 4 hilos, 16 GB — contenedor efímero |
| WebKit de Playwright | `npx playwright install webkit` → **403 del proxy**: `no rule or allowlist entry allows host "cdn.playwright.dev"` |
| Firefox / Chrome / Epiphany del sistema | No instalados |
| Navegadores disponibles | **Sólo** Chromium 141.0.7390.37 (build 1194 preinstalada) |

Consecuencias, sin rodeos:

1. **No hay dispositivo físico.** Ninguna cifra de este informe puede
   presentarse como la medición que CRI-93 pide. El propio JSON de evidencia la
   marca `measurementKind: "container-headless"` y lleva un `warning` explícito.
2. **No hay segundo navegador.** El requisito multi-navegador (Chromium + otro
   real, preferentemente WebKit) **no se cumple**: sólo se ejecutó Chromium. No
   se declara probado nada que no se haya ejecutado. El harness admite
   `--webkit` y `--firefox` y está listo para cuando haya binarios.
3. Por (1) y (2), **CRI-93 no se cierra**.

## 3. Qué se midió y sobre qué modelo

No existía fixture grande, así que se generó por función pura y determinista en
`scripts/fixtures/large-model.mjs` (fuera de `src/**`, sin tocar producto). Es
sólo el **dato de entrada**: todo lo demás que se mide es la aplicación
construida de este repositorio, servida con `vite preview` desde `dist/`.

| Concepto | Valor |
| --- | --- |
| Malla | Pórticos 23 × 29, barras horizontales y verticales |
| Nudos | 667 (los 23 de la fila base con apoyo) |
| Barras | 1282 (`frame` y `truss` mezcladas) |
| Cargas nodales / de barra | 40 / 20 |
| Casos / combinaciones | 2 / 1 |
| **Entidades totales** | **2012** |
| Filas por pestaña del Datasheet | Nudos 667 · **Barras 1282** · Cargas 60 |
| `aria-rowcount` observado | 668 y **1283** (cabecera incluida) |

Las 1282 filas de barras se eligieron a propósito para quedar al lado de las
**1292 filas** del dato `EXPERIMENTAL` de CRI-11 y que la comparación sea
directa.

El modelo se valida en dos sitios: `node --test scripts/fixtures/large-model.test.mjs`
comprueba integridad referencial y unicidad de ids contra las reglas de
`src/data/migrate.ts`, y el propio harness aborta si el Datasheet no está
enseñando exactamente 667 / 1282 / 60 (así una carga silenciosa del proyecto en
blanco no puede pasar por una medición buena — de hecho ocurrió durante el
desarrollo y el guardia lo detuvo).

## 4. Procedimiento de medición

`scripts/measure-datasheet-performance.mjs` (nuevo). Ruta completa por
ejecución y clase de composición:

1. `vite preview` sobre `dist/` construido con `npm run build`.
2. El modelo se siembra en `localStorage` con `addInitScript`, **antes** de que
   arranque la aplicación (sembrarlo con la página viva es una carrera que se
   pierde: el guardado del producto sobrescribe la clave).
3. Se entra a la Mesa por la pantalla de bienvenida real — el salto directo de
   CRI-104 o el botón «Continuar proyecto», lo que ocurra.
4. Se abre el Datasheet desde el botón real de la TopBar (en Compact, desde el
   menú de desbordamiento, abierto **antes** de arrancar el cronómetro para no
   cargarle a la apertura un coste que no es suyo).
5. Entrada real de usuario: ratón, rueda y teclado de Playwright. Nada se
   simula por JavaScript.

**Reloj.** Cada métrica arranca en el `timeStamp` del evento de entrada
confiable y para en el `requestAnimationFrame` posterior a que el DOM ya cumpla
la condición. Es una aproximación de «hasta que se ve», con un sesgo conocido de
**como mucho un fotograma (~17 ms)**. Las tres cifras de apertura (primera fila,
tabla entera, interactivo) salen de un **único bucle de fotogramas y un único
gesto**, para que no puedan contradecirse entre sí.

**Definiciones exactas.**

- *Primera fila*: del gesto al primer fotograma con `≥1 <tr>` en el `tbody`.
- *Interactivo*: del gesto al primer fotograma en que la tabla ya está completa
  **y** el hilo principal ha servido tres fotogramas seguidos por debajo de
  50 ms — es decir, ya puede atender al usuario.
- *Coste de scroll*: 12 pasos de rueda de 900 px sobre la superficie que de
  verdad se desplaza, midiendo el intervalo entre fotogramas durante todo el
  gesto (mediana, p95 y peor fotograma). Si la rueda no mueve nada se repite con
  desplazamiento programado y se anota el cambio de método.
- *Edición de celda por teclado*: se llega a la celda **con el teclado** (la
  rejilla es una única parada de tabulación; dentro se navega con flechas), se
  abre con `F2`, se teclea con retardo humano y se confirma con `Enter`. Se
  miden por separado: apertura del editor, latencia por pulsación (estilo INP) y
  **escritura**, del `Enter` a que la celda muestre el valor nuevo. Una edición
  válida y única sobre un borrador vacío el producto la escribe ya en el modelo
  (`onCommitEdit` → un solo `updateProject`), así que esa cifra **es** el coste
  real de escribir una celda.
- *Edición por ratón*: doble pulsación, **sólo si la celda es pinchable de
  verdad** (misma prueba de impacto que usa el puntero: centro del rectángulo).
- *Palette*: `Ctrl+K` hasta la primera opción pintada; después se teclea el id
  completo de un nudo existente con la navegación por ID activa, midiendo cada
  pulsación.
- Cada métrica: **5 repeticiones en caliente por clase y entidad**, más la
  apertura **en frío** (trozo diferido sin descargar) medida aparte. Se reporta
  mediana y p95, nunca una muestra suelta.

## 5. Presupuesto, y de dónde sale cada número

Regla general: **el presupuesto se compara contra el p95, no contra la
mediana.** Lo que rompe el flujo de trabajo no es el caso típico, es el lento.

| Interacción | Presupuesto (p95) | Derivación desde la tarea del usuario |
| --- | --- | --- |
| Pulsación dentro del editor de celda (eco) | **≤ 100 ms** | Editar en masa es teclear cifras a ~5 pulsaciones/s (≈60 ppm). El intervalo entre teclas es 200 ms; el eco tiene que caber en **la mitad** del intervalo o el texto se descuelga de los dedos → 100 ms. Coincide con el límite perceptivo de 0,1 s (Miller 1968; Card 1991; Nielsen 1993): dos derivaciones independientes dan el mismo número, que es justo lo que le da crédito. |
| Flecha en la rejilla (mover el foco) | **≤ 125 ms** | Auditar recorriendo celdas va a ~4 pulsaciones/s → cadencia 250 ms; mitad del intervalo. |
| Escritura de celda (`Enter` → valor visible) | **≤ 250 ms** | El ciclo real de una celda —leer el valor, teclear el nuevo, confirmar— es de unos 2 s. Para que la escritura no sea el cuello de botella se le concede como mucho **1/8** del ciclo: 250 ms. |
| Datasheet, primera fila **en caliente** | **≤ 500 ms** | El bucle de auditoría es abrir → mirar → cerrar → corregir en el lienzo → reabrir, decenas de veces por sesión, con ~5 s de trabajo entre reaperturas. Un **10 %** de ese bucle son 500 ms; por encima, la herramienta cobra peaje cada vez que se consulta. |
| Datasheet, primera fila **en frío** | **≤ 1000 ms** | Ocurre una vez por sesión e incluye descargar el trozo diferido. El límite es el de «flujo de pensamiento» (1 s): por encima, la acción deja de sentirse propia. |
| Tiempo hasta interactivo | **≤ primera fila + 100 ms** | Lo siguiente que hace el usuario es teclear o navegar; el margen que se concede es exactamente una reacción. |
| Fotograma durante el desplazamiento | **p95 ≤ 33,4 ms · peor ≤ 100 ms** | El scroll es manipulación continua: el contenido sigue a la mano. Se tolera caer a 2 fotogramas a 60 Hz (33,4 ms) de forma puntual; un fotograma por encima de 100 ms ya es un tirón visible. |
| Command Palette, apertura | **≤ 300 ms** | La palette se invoca a media idea y se teclea de inmediato: entre soltar `Ctrl+K` y pulsar la primera letra pasan unos 400 ms. Si la lista no está montada antes de eso, las primeras pulsaciones llegan tarde o se pierden. 300 ms deja margen. |
| Command Palette, pulsación al filtrar | **≤ 100 ms** | Mismo argumento que el eco de celda. |

Ninguno de estos números se ha subido después de medir, y ninguno se ha
integrado como techo de CI (§10).

## 6. Resultado medido

**Entorno de las dos ejecuciones** (A y B, independientes, navegador nuevo en
cada una):

| Campo | Valor |
| --- | --- |
| Dispositivo | **Ninguno físico** — contenedor de desarrollo `linux x64`, 4 hilos, 16 GB |
| Navegador | Chromium **141.0.7390.37**, headless (`HeadlessChrome/141`) |
| Segundo navegador | **No ejecutado** — sin binario disponible (§2) |
| Expanded | viewport 1440×900 → el producto resuelve `data-shell-class="X2"` |
| Compact | viewport 390×844 → el producto resuelve `data-shell-class="K0"` |
| Modelo | 2012 entidades · 667 nudos · 1282 barras · 60 cargas |
| Repeticiones | 5 en caliente por celda de la tabla, en cada ejecución |
| Errores de página / consola | 0 / 0 en las cuatro combinaciones |

Cada celda es **`ejecución A / ejecución B`**. Sirve para ver la dispersión
entre ejecuciones, que es la que dice si un número es real o casualidad.


### Nudos (667 filas)

| Métrica (ms) | Expanded `X2` (A / B) | Compact `K0` (A / B) |
| --- | --- | --- |
| 1 · Primera fila — mediana | 222.9 / 218.5 | 217.5 / 195 |
| 1 · Primera fila — p95 | 309.1 / 310.7 | 321.8 / 304.5 |
| 1 · Primera fila — en frío | 327.7 / 331.4 | 328.8 / 327.8 |
| 2 · Interactivo — mediana | 265.2 / 253 | 328.8 / 244 |
| 2 · Interactivo — p95 | 322.8 / 320 | 334 / 312.8 |
| 2 · Interactivo — en frío | 327.7 / 331.4 | 328.8 / 327.8 |
| 3 · Scroll — fotograma p95 (mediana de las series) | 24.2 / 33.3 | 16.8 / 16.8 |
| 3 · Scroll — peor fotograma | 66.6 / 66.6 | 50 / 16.8 |
| 3 · Scroll — desplazable por el usuario | sí / sí | NO / NO |
| 4 · Editor por teclado (F2) — mediana | 74.8 / 68 | 25.8 / 28 |
| 4 · Pulsación en la celda — mediana | 20.6 / 22 | 16 / 16.3 |
| 4 · Pulsación en la celda — p95 | 57.2 / 39.9 | 29.7 / 29 |
| 4 · Escritura (Enter → valor) — mediana | 120 / 126 | 75 / 75 |
| 4 · Escritura (Enter → valor) — p95 | 139.5 / 146.1 | 84.1 / 85.9 |
| 4 · Flecha en la rejilla — p95 | 36.1 / 31.5 | 26.5 / 28.4 |
| 4 · Editor por ratón (doble pulsación) — mediana | 152.5 / 159.3 | no disponible / no disponible |

### Barras (1282 filas)

| Métrica (ms) | Expanded `X2` (A / B) | Compact `K0` (A / B) |
| --- | --- | --- |
| 1 · Primera fila — mediana | 503.7 / 594.8 | 537.3 / 530.2 |
| 1 · Primera fila — p95 | 1293.5 / 676.5 | 630.2 / 549.9 |
| 1 · Primera fila — en frío | 503.7 / 594.8 | 537.3 / 514 |
| 2 · Interactivo — mediana | 545.1 / 626.3 | 563.1 / 549.6 |
| 2 · Interactivo — p95 | 1325.7 / 704.7 | 647.7 / 566 |
| 2 · Interactivo — en frío | 525.2 / 626.3 | 563.1 / 533.7 |
| 3 · Scroll — fotograma p95 (mediana de las series) | 16.7 / 16.7 | 16.7 / 16.7 |
| 3 · Scroll — peor fotograma | 16.8 / 33.4 | 16.8 / 33.5 |
| 3 · Scroll — desplazable por el usuario | sí / sí | NO / NO |
| 4 · Editor por teclado (F2) — mediana | 63 / 72.7 | 78 / 74.2 |
| 4 · Pulsación en la celda — mediana | 37.1 / 40.1 | 27.4 / 25.8 |
| 4 · Pulsación en la celda — p95 | 64.3 / 47 | 37.7 / 33.3 |
| 4 · Escritura (Enter → valor) — mediana | 97.4 / 110.4 | 102.5 / 104.7 |
| 4 · Escritura (Enter → valor) — p95 | 101.5 / 119.2 | 121.3 / 121.6 |
| 4 · Flecha en la rejilla — p95 | 60 / 82.9 | 58.7 / 50.5 |
| 4 · Editor por ratón (doble pulsación) — mediana | 238.9 / 245.4 | no disponible / no disponible |

### Command Palette

| Métrica (ms) | Expanded `X2` (A / B) | Compact `K0` (A / B) |
| --- | --- | --- |
| 5 · Apertura — mediana | 339.5 / 342.1 | 339.9 / 374.4 |
| 5 · Apertura — p95 | 481 / 489.3 | 501.9 / 540.2 |
| 5 · Apertura — peor | 514.7 / 522.4 | 538.3 / 542.3 |
| 5 · Apertura hasta interactivo — p95 | 532.8 / 536.5 | 549.1 / 586.2 |
| 6 · Pulsación al filtrar — mediana | 36.9 / 33 | 32.5 / 34.8 |
| 6 · Pulsación al filtrar — p95 | 103 / 89.6 | 81.8 / 93 |
| 6 · Pulsación al filtrar — peor | 149.8 / 101.5 | 82.4 / 96.9 |
| Opciones renderizadas al abrir | 1989 / 1989 | 1989 / 1989 |
| Opciones tras teclear el id | 5 / 5 | 5 / 5 |

**Capturas** (`reports/evidence/2026-08-19-cri-93-performance/`):
`X2-nodes.png`, `X2-members.png`, `K0-nodes.png`, `K0-members.png`. La de
`X2-members` enseña la hoja con «1282 de 1282» y las barras reales; las de `K0`
enseñan el problema de §6.1.

### 6.1 Hallazgo que condiciona todo lo de Compact

**En `K0` la rejilla del Datasheet no es visible ni desplazable ni pinchable.**
No es una limitación del harness: es lo que hace el producto hoy.

- `.datasheet-grid-scroll` queda con **`clientHeight = 0`** frente a un
  `scrollHeight` de 23 390 px (nudos) y 44 915 px (barras).
- El panel de contexto (`.datasheet-context`, 716 px de alto) cubre la rejilla:
  `document.elementFromPoint` sobre el centro de cualquier celda devuelve una
  tarjeta del panel, no la celda. Por eso la fila «editor por ratón» dice **no
  disponible** en Compact, y por eso la pestaña «Barras» hubo que conmutarla con
  el teclado.
- Causa aparente: en `datasheet.css`, la media query de 1023 px pasa
  `.datasheet-layout` a `grid-template-rows: minmax(0, 1fr) auto`; el `auto` del
  panel de contexto se lo come todo y la fila del `1fr` colapsa a 0.

Consecuencias para esta medición, dichas sin adornos:

1. Las 1282 filas **se construyen igualmente** y bloquean el hilo principal: el
   coste de las métricas 1, 2 y 4 en `K0` es real y comparable.
2. La métrica 3 (scroll) en `K0` **no es una medición de usuario**: se ejecutó
   con desplazamiento programado sobre un contenedor de altura 0, y así queda
   marcado (`userScrollable: false`). No se usa para ninguna conclusión.
3. La ruta de ratón en `K0` **no existe**; se reporta ausente, no se sustituye
   por un número de otra ruta.
4. Arreglar esa presentación **no es de esta issue** (CRI-93 excluye
   explícitamente tocar la presentación del Datasheet). Queda anotado para quien
   la coja.

## 7. Comparación con el dato experimental anterior (CRI-11)

| | CRI-11 (`EXPERIMENTAL`) | CRI-93 (esta medición) |
| --- | --- | --- |
| Qué era | Prototipo aislado, fuera del producto | **Producto real** construido de este repo |
| Filas | 1292 | 1282 |
| Tiempo hasta la primera fila | **1,16 s** | **0,50–0,68 s** (mediana 0,50–0,59; p95 0,55–0,68) |
| Dónde | Harness aislado | Contenedor headless, Chromium 141 |
| Dispositivo físico | No | **Tampoco** |

El dato de CRI-11 **queda reemplazado como referencia de trabajo**: sobre el
producto real y con el mismo orden de filas, el coste es aproximadamente **la
mitad**. Lo que **no** queda reemplazado es su defecto principal —seguir sin
medir en un aparato de verdad—, y por eso esta medición hereda la misma etiqueta
de provisionalidad. Cambia el número; no cambia el estatus.

## 8. Decisión sobre virtualización

### 8.1 Medición contra presupuesto

| Interacción | Presupuesto (p95) | Medido (peor de las 4 combinaciones) | Veredicto |
| --- | --- | --- | --- |
| Pulsación en celda | ≤ 100 ms | 64,3 ms | **cabe** |
| Flecha en la rejilla | ≤ 125 ms | 82,9 ms | **cabe** |
| Escritura de celda | ≤ 250 ms | 146,1 ms | **cabe** |
| Scroll, fotograma p95 | ≤ 33,4 ms | 33,3 ms (`X2`, nudos) | **cabe, al límite** |
| Scroll, peor fotograma | ≤ 100 ms | 66,6 ms | **cabe** |
| Datasheet 667 filas, primera fila (caliente) | ≤ 500 ms | 321,8 ms | **cabe** |
| Datasheet 667 filas, interactivo | ≤ 600 ms | 334,0 ms | **cabe** |
| **Datasheet 1282 filas, primera fila (caliente)** | **≤ 500 ms** | **549,9 – 676,5 ms** (y un caso de 1293,5) | **NO cabe** (+10 % a +35 %; el atípico, +159 %) |
| **Datasheet 1282 filas, interactivo** | **≤ 600 ms** | **566,0 – 704,7 ms** (atípico 1325,7) | **NO cabe en `X2`**; al borde en `K0` |
| **Command Palette, apertura** | **≤ 300 ms** | **481 – 540 ms** (mediana ya 339–374) | **NO cabe** (+60 % a +80 %) |
| Command Palette, tecleo | ≤ 100 ms | 103,0 ms (`X2`) | **al límite, lo roza** |

### 8.2 Decisión

> **`virtualización necesaria`** — en dos sitios y por una sola métrica cada
> uno.

**Y el argumento por qué esta conclusión se sostiene pese a no haber
dispositivo:** el contenedor es un x86 de 4 hilos sin límite térmico; un
teléfono real es 3–5× más lento en hilo principal. Es decir, esta medición es
una **cota inferior optimista**. Lo que aquí ya se sale del presupuesto, allí se
sale más. La implicación sólo funciona en un sentido, y es el que ha salido: si
hubiera cabido, no se podría concluir nada; como **no** cabe, la necesidad está
establecida. Lo que sigue faltando es el número exacto del aparato, y por eso la
issue no se cierra (§12).

**Dónde, y por qué métrica**

1. **`DatasheetGrid.tsx` — el cuerpo de la tabla.** Métrica que lo decide:
   *tiempo hasta la primera fila / hasta interactivo* con la tabla de **1282
   barras**, 550–677 ms p95 contra un presupuesto de 500/600 ms. **No** lo
   deciden el scroll (16,7 ms p95, holgadísimo) ni la edición (146 ms p95 contra
   250). Alcance mínimo: **ventana de renderizado sobre las filas del `<tbody>`
   y nada más**. No se toca `datasheetModel.ts`, ni el borrador, ni
   `datasheetEditApply`, ni la presentación visual, ni el conjunto de filas.
2. **`CommandPalette.tsx` — el renderizado de la lista.** Métrica que lo decide:
   *latencia de apertura*, 481–540 ms p95 contra 300 ms, con **1989 opciones
   montadas de golpe** (un comando por nudo y por barra: es exactamente lo que
   escala con el modelo). Alcance mínimo: **ventana de renderizado sobre
   `matches`**; `buildCommands` y el conjunto de coincidencias se quedan
   enteros. La construcción de la lista ya está memoizada desde CRI-103 y no es
   lo que hay que arreglar.

Ninguna de las dos es esta issue. CRI-93 mide y decide; implementar es una issue
posterior, y le aplican las restricciones de §8.3.

### 8.3 Restricciones que la issue futura tiene que respetar

Aplican tanto si se virtualiza la rejilla como la lista de la Palette. No son
recomendaciones: son el contrato que hoy se cumple y que una ventana de
renderizado rompe con una facilidad enorme.

**Nunca, bajo ninguna métrica**

- No recortar el conjunto de filas ni el de comandos. Enseñar menos no es
  virtualizar: es perder capacidad, y CRI-93 lo prohíbe explícitamente.
- No convertir la rejilla en una lista sin semántica de tabla para que pinte
  más rápido.

**`aria-rowcount` y el recorrido de lector de pantalla (`DatasheetGrid.tsx`)**

- `aria-rowcount` debe seguir declarando el **total** (`rows.length + 1`),
  no el tamaño de la ventana. Hoy vale 668 y 1283; con ventana debe seguir
  valiendo eso.
- Cada `<tr>` conserva su `aria-rowindex` **real** (índice en la lista completa,
  base 2 por la cabecera), y cada celda su `aria-colindex`. Un índice relativo a
  la ventana rompe el anuncio de posición.
- `aria-colcount` y `aria-sort` no cambian.

**Foco itinerante y teclado**

- La rejilla es **una sola parada de tabulación**: exactamente una celda con
  `tabIndex=0`. La ventana **siempre tiene que contener la celda enfocada**, o
  la rejilla se queda sin parada de tabulación y el teclado se pierde.
- Mover el foco con flechas fuera de la ventana debe desplazar la ventana y
  **mantener el foco del DOM** (hoy el efecto vuelve a enfocar
  `[data-datasheet-focused="true"]` tras cada render; con desmontaje de filas
  ese efecto tiene que seguir encontrando la celda).
- `Ctrl/Cmd + flecha` (`extendToEdge`) salta a la primera/última fila **real**,
  no a la de la ventana.
- `Enter`/`F2` abren el editor de la celda enfocada aunque haya llegado ahí tras
  desplazar la ventana; `Escape` sigue limpiando selección antes que cerrar.
- La selección por rango (`shift`) tiene que abarcar filas que no estén
  montadas.

**Escritura y pegado**

- `onPasteBlock` ancla en `safeFocus` y mapea el bloque contra la lista
  **completa** de filas y columnas: la ventana no puede cambiar ese mapeo.
- El contrato canónico se mantiene: la rejilla no tiene historial propio, la
  escritura va por `updateProject` **una vez por aplicar**, y no repara
  topología (eso es Model Doctor).

**Desplazamiento**

- La barra de desplazamiento debe seguir representando el total de filas
  (altura equivalente), o el usuario pierde la noción de cuánto modelo hay.
- Ordenar o filtrar cambia el conjunto: la ventana vuelve arriba y el foco se
  recoloca dentro del conjunto nuevo.

**Command Palette**

- La ventana es **sólo de renderizado**: `matches` sigue conteniendo todas las
  coincidencias, y la navegación con flechas recorre el conjunto completo.
- `role="listbox"` / `role="option"`, `aria-activedescendant` y el
  `scrollIntoView` del elemento activo deben seguir funcionando con opciones no
  montadas.
- El recuento de resultados que se anuncia es el total real, no el de la
  ventana.
## 9. Limitaciones de esta medición

Ordenadas por lo que más invalida la conclusión.

1. **No es un dispositivo físico.** Es la limitación que deja la issue abierta.
   Todo lo demás de esta lista es secundario frente a esto.
2. **Un solo navegador.** Chromium 141. Ni WebKit ni Firefox: sus binarios no se
   pueden descargar desde este entorno (403 del proxy). El requisito
   multi-navegador de CRI-93 no está cumplido y no se declara cumplido.
3. **Headless y sobre x86 de 4 hilos.** No hay compositor de pantalla real, ni
   GPU de teléfono, ni límite térmico, ni presión de memoria. Un teléfono real
   es típicamente **3–5× más lento** en trabajo de hilo principal. Es decir:
   **estas cifras son una cota inferior optimista**, no una estimación centrada.
   Lo que aquí ya no cabe en presupuesto, en el dispositivo cabrá aún menos.
4. **Compact es un viewport, no un teléfono.** `K0` se resuelve reduciendo la
   ventana a 390×844; no hay entrada táctil real, ni DPI de teléfono, ni teclado
   virtual encogiendo `visualViewport`.
5. **Sesgo del reloj:** del `timeStamp` del evento al `requestAnimationFrame`
   posterior al repintado. Sobreestima como mucho un fotograma (~17 ms) en todas
   las métricas por igual.
6. **«Interactivo» es una heurística**, no el TTI estándar de Lighthouse: tabla
   completa más tres fotogramas seguidos por debajo de 50 ms. Está definida en
   §4 y aplicada igual en todas las combinaciones, así que compara bien consigo
   misma; no es comparable con un TTI de otra herramienta.
7. **El observador de `longtask` devolvió entradas implausibles** (tareas de
   ~29 s que coinciden con los huecos de espera del guion) en headless. Quedan
   en el JSON crudo pero **no se usan** para ninguna conclusión.
8. **El tecleo en la Palette se mide con la Palette ya abierta.** El riesgo real
   —teclear mientras todavía se está montando y perder pulsaciones— no está
   medido; es un caso que la medición física debería cubrir a mano.
9. **El desplazamiento es rueda a pasos fijos**, no un dedo: no hay inercia ni
   `momentum scrolling`, que es justo lo que más castiga a una lista larga en
   iOS.
10. **El modelo es sintético y regular.** Nombres y secciones reales, más
    variados, pueden costar más de formatear por celda.
11. **No se midió el pegado por bloque** (`onPasteBlock`), que es la escritura
    más pesada del Datasheet. CRI-93 no lo pide; queda anotado porque cualquier
    optimización futura tendrá que respetarlo.
12. Día/Noche, ES/EN y `reduced-motion` quedan **fuera de alcance**, como
    declara CRI-93.

## 10. Gates ejecutados

Los tres de CRI-93, más `node --test` sobre lo que se añadió. Nada más: no se
corrió la suite completa, como pide la issue.

```
$ npm run perf
  ... Carga inicial: 852136 bytes (221510 gzip)
      Total en dist: 6206880 bytes

$ npm run verify:perf
  Métrica de rendimiento registrada: 852136 bytes / 221510 gzip
  (límite sin límite / sin límite; sin techo bloqueante).

$ npm run verify:protected
  Frontera protegida intacta: 38 archivos verificados.

$ node --test scripts/fixtures/large-model.test.mjs
  # pass 8   # fail 0
```

**`scripts/check-performance-budget.mjs` NO se ha tocado.** CRI-93 permite
integrar el escenario «si y sólo si el presupuesto queda fijado». No lo está: el
presupuesto de §5 está fijado como criterio de decisión, pero **la medición que
lo respalda no es la que la issue exige** (falta el dispositivo), y además el
escenario necesita construir la aplicación y lanzar un navegador, que es un
orden de magnitud más caro que el gate actual. Convertirlo hoy en gate sería
fijar en CI un umbral derivado de una medición que la propia issue considera
insuficiente. Se integrará cuando exista la medición física. **Ningún umbral
existente se ha subido.**

**Superficie tocada.** El diff añade cuatro archivos y **no modifica ninguno
existente** (`git diff --name-only HEAD` → vacío):

```
scripts/fixtures/large-model.mjs            (generador del modelo, función pura)
scripts/fixtures/large-model.test.mjs       (node --test)
scripts/measure-datasheet-performance.mjs   (harness de medición)
reports/2026-08-19-2300-cri-93-medicion-rendimiento.md
reports/evidence/2026-08-19-cri-93-performance/**
```

`src/features/**`, solver, modelo, esquema y rutas protegidas: **intactos**, y
`verify:protected` lo confirma sin `--update`. La regla del encargo decía
«`reports/` y, si hace falta, los scripts de rendimiento existentes»; se
interpretó que un script de medición **nuevo** es menos invasivo que meter un
navegador dentro de `measure-performance.mjs`, que es el que consume el gate
`verify:perf`. Queda declarado por si se prefiere lo contrario.

`success ≠ reliable ≠ safe`: nada de este informe dice nada sobre la fiabilidad
de ningún resultado estructural. Mide cuánto tarda la interfaz, y sólo eso.

## 11. Cómo repetir esta medición en un dispositivo físico

El harness ya soporta las dos rutas; lo único que falta es el aparato.

**Ruta A — el guion completo contra el navegador del dispositivo (recomendada).**
Mide igual que aquí, sin intervención manual, sobre Chrome de un Android real:

```sh
npm run build
adb reverse tcp:4190 tcp:4190                 # el móvil ve el servidor del portátil
adb forward tcp:9222 localabstract:chrome_devtools_remote
node scripts/measure-datasheet-performance.mjs \
  --cdp=http://127.0.0.1:9222 \
  --device="Pixel 7a · Android 15 · Chrome 141" \
  --repeats=5 --verbose \
  --out=reports/evidence/<fecha>-cri-93/android.json
```

Con `--cdp` el harness **no fuerza el viewport**: lee la clase de composición
del propio DOM (`data-shell-class`) y la reporta tal cual. `--device` es lo que
cambia `measurementKind` de `container-headless` a `declared-physical`; sin esa
etiqueta el informe se marca solo como no válido para CRI-93.

**Ruta B — servir y medir a mano** (iPhone/iPad, donde no hay CDP):

```sh
npm run build
node scripts/measure-datasheet-performance.mjs --serve-only --host=0.0.0.0
```

Imprime la URL de red y el tamaño del modelo; se abre desde el dispositivo y se
cronometra con las herramientas de desarrollo remotas de Safari.

**Para WebKit en escritorio**, cuando haya red hacia `cdn.playwright.dev`:

```sh
npx playwright install webkit
node scripts/measure-datasheet-performance.mjs --webkit --repeats=5
```

## 12. Qué falta para cerrar CRI-93

1. Ejecutar la ruta A (o B) en al menos un dispositivo físico —el teléfono es el
   caso duro: es donde la clase resuelta es `K0` y donde el hilo principal es
   más lento.
2. Ejecutar un segundo navegador real (WebKit preferentemente).
3. Volver a comparar contra el presupuesto de §5 —sin tocarlo— y elevar la
   decisión de §8 a definitiva (o revertirla, si el aparato dijera lo
   contrario, que es improbable por el argumento de la cota inferior).
4. Sólo entonces, integrar el escenario en `scripts/check-performance-budget.mjs`
   (§10) y cerrar la issue.

CRI-105 **no se ha empezado**: ni se ha leído para ejecutar, ni se ha tocado
nada suyo. Tampoco CRI-106 ni ninguna otra issue.
