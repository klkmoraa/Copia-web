# Claymorphism ciclo 1 — cierre (Tarea 8: verificación, presupuesto y reporte)

**Fecha:** 2026-08-07 01:30
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Cierre del ciclo 1 del rediseño claymorphism (17 commits, `5be1bc5..HEAD`): paleta clay con neutros cálidos, materia de cuatro capas con luz única a 145°, primitiva `Surface`, geometría isométrica parametrizada y un pórtico clay generado por código en la pantalla de bienvenida, con tema/idioma/drawer accesibles desde la cabecera. Esta tarea (la octava y última del ciclo) no añade funcionalidad: retoma trabajo pendiente sin commitear de un agente anterior (que arregló el defecto de retardo en la inclinación del hero, predicho por la revisión de la Tarea 5), corre el gate completo, hace la comprobación visual en navegador que ninguna tarea anterior había conseguido cerrar, completa `docs/design-system/PALETTE.md` y documenta el ciclo entero.

## Por qué

`npm run verify` cubre lint/tipos/tests/build/presupuesto pero **no evalúa CSS** (`vite.config.ts` no declara `test.css`), y `npm run qa` — el único gate que sí renderiza CSS real en Chromium — no es parte de `verify`. En un ciclo que reescribió toda la capa visual de la bienvenida, esa asimetría es donde vive el riesgo real: los dos defectos más serios del ciclo (la cascada CSS de la Tarea 6 y la fuga de `.sc-surface` fuera del chunk de entrada en la Tarea 7) sólo los cazó `npm run qa`, nunca la suite unitaria. Esta tarea existe para cerrar esa brecha con una comprobación humana antes de dar el ciclo por terminado.

## Archivos tocados en esta sesión

- `src/features/welcome/StructuralPortalHero.tsx` — trabajo del agente anterior, verificado y conservado sin cambios: quita la `transition` de la regla base de `transform` (se reescribía en cada `pointermove`, causando persecución con retardo) y añade la clase `portal-hero--returning` sólo en `pointerleave` para suavizar el regreso a cero.
- `src/styles.css` — trabajo del agente anterior, verificado y conservado: mueve la `transition: transform` de la regla base de `.portal-hero` a `.portal-hero.portal-hero--returning`.
- `docs/design-system/PALETTE.md` — trabajo del agente anterior, verificado y conservado: documenta la paleta v4 "clay", por qué `--sc-color-action-primary` es `#08795e` y no el `#0b9270` de la referencia (3,92:1 vs el suelo de 4,5:1 de `tokens.test.ts`), y por qué `--sc-sky-500` no sirve como color de foco (2,32:1 vs el suelo de 3:1 de WCAG 1.4.11).
- `.superpowers/sdd/2026-08-06-claymorphism-ciclo1/task-8-report.md` — informe detallado de esta tarea (nuevo).
- Este fichero — reporte de cierre del ciclo completo.

`capturas.mjs` (raíz, sin trackear) se dejó fuera del commit a propósito, tal como pedía la instrucción de esta ronda.

## Ficheros creados/modificados en los 17 commits del ciclo completo

```
 docs/design-system/PALETTE.md                       |  62 +++-
 .../plans/2026-08-06-claymorphism-ciclo1.md         |  18 ++
 index.html                                          |   4 +-
 qa.mjs                                              | 238 ++++++++++++
 .../2026-08-07-0130-claymorphism-ciclo1-cierre.md   | 129 ++++++++
 .../components/dependencyBoundary.test.ts           |  19 +-
 src/design-system/components/surface.test.tsx       |  44 +++
 src/design-system/components/surface.tsx            |  42 +++
 src/design-system/components/ui.css                 |   6 +
 src/design-system/tokens.css                        | 222 +++++++----
 src/design-system/tokens.test.ts                    |  43 +++
 src/features/welcome/StructuralPortalHero.test.tsx  |  41 +++
 src/features/welcome/StructuralPortalHero.tsx       | 220 +++++++++++
 src/features/welcome/WelcomeHeader.test.tsx         |  85 +++++
 src/features/welcome/WelcomeScreen.tsx              | 352 +++++++++++---------
 src/features/welcome/WelcomeStructureArt.tsx        |  84 -----
 src/graphics/isometricPortal.test.ts                | 169 ++++++++++
 src/graphics/isometricPortal.ts                     | 196 ++++++++++++
 src/i18n/catalogs.ts                                |   2 +
 src/styles.css                                      | 356 ++++++++++++++++++---
 20 files changed, 1978 insertions(+), 354 deletions(-)
```

Nota de conteo: el brief original hablaba de "ocho commits"; el rango real `5be1bc5..HEAD` son **diecisiete** (siete `feat` de implementación y diez de verificación/corrección posterior — `fix`/`test`/`docs` — repartidas en varias rondas por tarea), sobre **veinte** ficheros. La tabla anterior de esta sección omitía `docs/design-system/PALETTE.md`, el plan bajo `docs/superpowers/plans/` y este mismo reporte; queda corregida arriba con la salida real de `git diff --stat 5be1bc5..HEAD`.

## Por qué no se añadieron `three` / `@react-three/fiber` / `@react-three/drei`

La escena de referencia es estática — cámara ortográfica isométrica fija, sin órbita, materiales mate sin reflejos ni sombra dinámica más allá del sombreado por cara. Un motor WebGL real habría costado ~200-250 KB gzip de runtime más una segunda implementación del mismo dibujo (geometría, cámara, materiales) para producir exactamente el mismo fotograma estático que ya es calculable en TypeScript puro, además de mocks de WebGL/canvas en cada test que tocara el hero. En su lugar, `src/graphics/isometricPortal.ts` deriva la geometría isométrica con aritmética pura — sin React, sin DOM, testeable con asserts numéricos (`isometricPortal.test.ts`) — y `StructuralPortalHero.tsx` la pinta como SVG: ~4 KB, cero dependencias nuevas, sin WebGL en ningún test.

## Las dos correcciones de contraste medidas

1. **Acción primaria.** `#0b9270` (el verde de la imagen de referencia) con blanco encima mide 3,92:1; `src/design-system/tokens.test.ts` exige 4,5:1 para el par `('--sc-color-action-foreground', '--sc-color-action-primary')`. `--sc-green-600` (`#08795e`) sí cumple: 5,37:1. `#0b9270` y `#27ad83` (`--sc-green-400`) no se descartan — quedan como decorativos (pórtico, halos, superficies suaves) donde ningún texto se apoya encima.
2. **Acento de foco.** `--sc-sky-500` (`#5caee9`), tomado de la referencia para el contenedor de icono de "Continuar proyecto", mide 2,32:1 contra superficie — por debajo del suelo de 3:1 de WCAG 1.4.11 para un elemento de foco/UI esencial. `--sc-color-focus` se mantiene en el azul de interacción existente (`--sc-blue-500`); `--sc-sky-*`/`--sc-lilac-*` quedan limitados a contenedores de icono y fondos suaves de tarjeta.

Ambas están documentadas en `docs/design-system/PALETTE.md` con el dato numérico exacto, precisamente para que nadie las "corrija" de vuelta al verde/azul de la referencia dentro de unos meses sin volver a medir.

## Bundle: antes/después del ciclo

| | bytes | gzip |
| --- | --- | --- |
| Línea base real antes del ciclo (`git stash` sobre `main`, confirmada en `task-6-report.md`) | 663 916 | 178 161 |
| Medición final de esta sesión (`npm run verify:perf`) | 665 338 | 178 354 |
| Diferencia | +1 422 | +193 |
| Techo actual (`BUDGET`, sin tocar en esta ronda) | 670 000 | 179 500 |

**Por qué el ciclo sube el bundle en vez de bajarlo**, pese a que la Tarea 7 portó los hovers de dos de las tres tarjetas del launcher de `motion` a CSS puro: `src/main.tsx` y `src/design-system/components/overlays.tsx` (el `Drawer` de cabecera, en uso desde la Tarea 6) importan `motion/react` de forma **incondicional**. El núcleo de animación (`m`, `AnimatePresence`, `LazyMotion`) vive en el chunk de entrada por esa raíz de imports, con independencia de qué hover concreto use o no `whileHover`/`whileTap`. Retirar los hovers de las tarjetas quita JSX y props, pero no saca `motion` del grafo de módulos del chunk de entrada.

**El comentario de `scripts/check-performance-budget.mjs` (líneas ~42-48) afirma lo contrario y está equivocado.** Dice que bajar el techo requiere "portar los hovers de las tarjetas y el reflow de `AnimatePresence` del filtro a CSS también" — la Tarea 7 hizo exactamente eso para los hovers y el bundle no bajó, subió 721 B / 73 gzip. Queda señalado aquí; no se corrigió porque `scripts/check-performance-budget.mjs` está fuera del alcance de esta ronda (instrucción explícita de no tocarlo).

## Tres hallazgos estructurales del ciclo (más relevantes que el propio rediseño)

**a) La suite de Vitest corre sin CSS.** `vite.config.ts` no declara `test.css`, así que jsdom nunca evalúa cascada, especificidad ni visibilidad. `npm run qa` es el único arnés que sí lo hace, y **no forma parte de `npm run verify`**: es un gate manual que hay que acordarse de correr. El defecto de la Tarea 6 (hamburguesa visible en escritorio por una colisión de especificidad CSS) pasó los 732 tests unitarios sin que ninguno lo detectara.

**b) `ui.css` sólo lo importaba `WorkspaceShell` (lazy).** El CSS del design-system (incluida `.sc-surface`) nunca vivió en el chunk de entrada mientras `Surface` sólo se usaba dentro del workspace. Se destapó en la Tarea 7 al envolver la bienvenida en `<Surface>`: el marco clay se pintaba sin fondo/borde/sombra hasta ganar la carrera del precalentamiento. Se resolvió subiendo `.sc-surface` a `styles.css` (eager). Si aparecen más componentes `sc-*` fuera del workspace, conviene una hoja de design-system eager dedicada en vez de migrar uno a uno.

**c) Cuatro redes de test escritas durante el ciclo no protegían nada hasta que se las vio fallar por mutación.** La más clara: `verifyWelcomeReducedMotionActive` en `qa.mjs` comparaba `transform` en `:active` contra `'none'` sin haber llamado a `hover()` antes de `mouse.down()` — `:active` nunca se activaba y el check comparaba `'none'` contra `'none'`, en verde permanente sin comprobar nada. Se cazó introduciendo deliberadamente la mutación que debía fallar (ronda 2/5 de la Tarea 7). Lección: un test que nunca se ha visto fallar es una suposición con sintaxis de test, no una protección.

## Cómo verificar

```bash
npm run verify   # lint + verify:protected + test + build + verify:perf — todo PASS
npm run qa       # recorrido Playwright desktop+móvil — todo PASS, sin reintento necesario
npm run dev       # comprobación manual: bienvenida, tema/idioma, drawer <768px, tab+foco, zoom
```

### Resultado literal de `npm run verify`

```
lint: oxlint — limpio, sin salida
verify:protected: Frontera protegida intacta: 29 archivos verificados.
test: Test Files 97 passed (97) · Tests 732 passed (732) · Duration 69.80s
build: tsc -b && vite build → ✓ built in 2.17s
verify:perf: Presupuesto de rendimiento respetado: 665338 bytes / 178354 gzip (techo 670000 / 179500).
```

### Resultado literal de `npm run qa`

Los 79 checks del objeto `checks` resolvieron `true` (incluidos `welcomelauncherCardActiveTransformIsPressedTranslate` y `welcomeimportCardActiveTransformIsPressedTranslate`, los sensibles al temporizado, en verde a la primera). `"console": []`, `"pageErrors": []`.

## Lo que se observó en el navegador

`npm run dev` sobre el puerto 5173 (ya arrancado). El panel embebido del entorno no renderizó correctamente los cambios de viewport (contenido confinado a una caja fija en la esquina superior izquierda pese a que `window.innerWidth`/`document.body` sí reportaban el tamaño correcto por JS) — mismo problema que reportan otros agentes de este ciclo. Se recurrió a Playwright directo contra el dev server, como indicaba la instrucción de esta ronda como alternativa.

Confirmado por observación directa (capturas + estado del DOM leído por JS, no por lectura de código):

- **Consola limpia** en los cinco contextos abiertos (desktop claro/oscuro/inglés, móvil 390×844, viewport 720×450 para el zoom). Cero errores, cero warnings, cero `pageerror`.
- **Inclinación con el puntero — el fix de esta sesión — confirmado programáticamente.** El `transform` del pórtico responde de inmediato al `pointermove` con el signo correcto (esquina superior-izquierda vs inferior-derecha dan matrices `rotateX`/`rotateY` de signo opuesto), sin transición durante el seguimiento; al `pointerleave` se activa `portal-hero--returning`, `transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)`, y a los 300 ms el `transform` ya es la matriz identidad. El retardo que la Tarea 5 había predicho como riesgo ya no existe.
- **Pórtico**: encuadre, volumen y sombras de contacto correctos en ambos temas; rejilla del suelo legible (usa `border-strong`, no un gris fijo).
- **Tarjetas**: `box-shadow`/`border-color` cambian en hover en las tres; `transform` cambia en hover/activo en `launcher`/`import` y deliberadamente no en `template` (sigue bajo `motion` por el reflow del filtro). Confirmado por los valores exactos que compara `qa.mjs`, no sólo por inspección visual — a 470×212 px un desplazamiento de 1-2 px es difícil de apreciar a simple vista en una captura estática.
- **Tema claro/oscuro**: alternado con clic real. Contraste correcto en ambos; el oscuro usa un verde/grafito profundo, nunca negro puro.
- **Idioma ES/EN**: cambiado con `select` real, sin desbordamiento de texto ni layout roto.
- **Drawer móvil (390×844)**: abre como hoja inferior, cierra con Escape, el foco vuelve visiblemente al botón de menú (anillo azul).
- **Tab + foco**: 14 tabs consecutivos, todos los controles alcanzables muestran `outline: solid rgb(52, 95, 214) 3px` de forma consistente sobre cada superficie clay.
- **Zoom al 200%**: la primera aproximación (CSS `body.style.zoom`) dio un falso positivo de texto truncado — investigado y descartado: `body.style.zoom` no reduce el layout viewport que ven las media queries, a diferencia del zoom real de Chrome. Repetido con el viewport real equivalente (720×450 sobre 1440×900) y confirmado que la cabecera pasa a hamburguesa y las tarjetas se apilan en una columna con el texto completo, sin truncar ni solapar. No hay defecto de zoom.

No se verificó explícitamente `prefers-reduced-motion: reduce` con el fix de esta sesión (queda como pendiente, ver abajo), ni 1366×768 de forma manual (sí lo cubre `qa.mjs` a 1536×960).

## Pendiente / siguiente paso

- **Riesgo de flakiness conocido**: los checks `welcome*CardActiveTransformIsPressedTranslate` de `qa.mjs` dependen de una espera fija de 80 ms tras `mouse.down()`. Documentado desde la Tarea 7; pasaron a la primera en esta sesión, pero el riesgo sigue latente. Mitigación sugerida si empieza a fallar en CI: subir la espera o sondear `element.matches(':active')`.
- `prefers-reduced-motion: reduce` no se re-verificó de forma explícita con el fix del tilt de esta sesión — por análisis de código no debería interactuar. Ojo: la rama `@media (hover: hover) and (pointer: fine)` de `styles.css` (donde vive `.portal-hero--returning`) **no** excluye reduced-motion por sí sola — un ratón con `prefers-reduced-motion: reduce` activo sigue cumpliendo `hover: hover and pointer: fine`. Lo que neutraliza el tilt en ese caso son dos guardas independientes: `@media (prefers-reduced-motion: reduce) { .welcome-hero-figure .portal-hero { transform: none; } }` (`styles.css:288-290`) y el guard `canTilt()` en JS (`StructuralPortalHero.tsx`), que no registra el listener de `pointermove` si `matchMedia('(prefers-reduced-motion: reduce)').matches`. El comportamiento es correcto; esta nota corrige la explicación, no confirmada por observación.
- El comentario de `scripts/check-performance-budget.mjs` sigue prometiendo una bajada de presupuesto por portar hovers a CSS que la arquitectura actual de imports (`main.tsx`/`overlays.tsx` importando `motion/react` sin condición) hace estructuralmente imposible. Queda señalado, no corregido — fuera del alcance de esta ronda.
- El panel de navegador embebido de esta sesión no renderizó correctamente los cambios de viewport. Si ciclos futuros van a depender de ese panel para comprobación visual, vale la pena que alguien lo investigue.

Nada de esto bloquea el cierre del ciclo: todos son pendientes de bajo riesgo, documentados para que el ciclo 2 los tenga a la vista.
