# Claymorphism ciclo 2 — tarea 5: tool rail y dock móvil de vidrio a arcilla

**Fecha:** 2026-08-07 13:05
**Agente:** Codex
**Rama:** main
**Base:** `9a69466`

## Qué cambió

La `.toolbar` se incorporó al grupo semántico `raised` de `material.css`, por lo que escritorio, compacto y dock móvil consumen el gradiente, canto y sombra clay compartidos desde la carga eager del workspace.

Se retiró de `styles.css` únicamente la materia duplicada del rail: fondo y borde lateral locales en escritorio; fondo, borde y sombra planos y blur en la regla móvil temprana; fondo, sombra y blur en Mobile v2; y las dos excepciones de transparencia reducida. Se conservaron `height:52px`, la geometría Mobile v2 (`height`, `min-height`, `padding`, grid y safe areas), el halo activo y todos los usos de `--tool-color`.

`qa.mjs` ahora mide `.toolbar` con Chromium real en desktop y mobile y expone cuatro keys distintas para evitar que un viewport sobrescriba al otro.

## Por qué

El rail de herramientas era el siguiente consumidor del workspace que debía abandonar materia de vidrio local y consumir el contrato clay `raised`, sin alterar geometría responsive, estados por herramienta ni comportamiento del producto.

## Archivos tocados

- `qa.mjs` — añade `verifyToolRailClayMaterial` y lo conecta con keys distintas en desktop/mobile.
- `src/design-system/material.css` — incorpora `.toolbar` al grupo `raised`.
- `src/styles.css` — retira solo materia/blur duplicados y conserva geometría/estados.
- `reports/2026-08-07-1305-claymorphism-ciclo2-task5.md` — este reporte rastreado.
- `.superpowers/sdd/2026-08-07-claymorphism-ciclo2/task-5-report.md` — ledger SDD ignorado para el controlador.

## Cómo verificar

- Guardián previo: `main` en `9a6946615130`, `structureco@0.8.2`, respaldo local con hashes y `npm.cmd run verify:protected` verde (29 archivos).
- RED check-only con CSS intacto: build verde; la repetición permitida de `node qa.mjs` salió 1 únicamente por `toolRailDesktopHasClayShadow`, `toolRailMobileHasNoBackdropFilter` y `toolRailMobileHasClayShadow`. La key desktop no-backdrop ya era verdadera en el CSS anterior.
- GREEN: build verde. Las corridas de `node qa.mjs` no incluyeron ninguna de las cuatro keys nuevas entre los falsos; el arnés global quedó rojo únicamente por el check welcome intermitente, que no se modificó.
- Mutación: una regla temporal `.toolbar { backdrop-filter: blur(4px); }` hizo fallar nominalmente `toolRailDesktopHasNoBackdropFilter` y `toolRailMobileHasNoBackdropFilter`.
- Restauración: `material.css` recuperó byte por byte el SHA-256 previo `DD3F86FF5A94BBD1BB4F342D01913B432E6FFB26DA3DB7698674099268D40738`; el escaneo de residuo no encontró `backdrop-filter` en ese archivo.
- Build final restaurado: PASS. El QA restaurado no reportó ninguna key de Tarea 5 como falsa; solo flaquearon los checks welcome `launcher`/`import` ya conocidos.
- Revisión de diff previa al checkpoint: `height:52px`, `height/min-height/padding/grid` de Mobile v2, halo activo y `--tool-color` permanecieron presentes; no apareció `border-right` local ni blur de `.toolbar`.

## Pendiente / siguiente paso

Por instrucción del checkpoint, después de completar mutación/restauración no se lanzaron más comandos de gate. El controlador queda a cargo de la revisión visual desktop/compact/mobile Light/Dark, los full gates frescos y la comprobación post-cambio de diff/frontera. No se lanzó dev server manual, navegador interactivo, WebKit, suite completa ni push.

Concern no bloqueante: los checks preexistentes de `:active` en welcome flaquearon durante varias corridas. Se hizo únicamente la repetición permitida en cada gate previo al checkpoint, se documentó la deuda y no se cambió el arnés.

## Cierre del controlador (2026-08-07 13:18)

- Revisión independiente: APPROVED, sin Critical, Important ni Minor.
- Playwright Day/Night PASS en 1536×960, 1200×800 y 390×844. Geometría observada: rail 164 px, compacto 76 px y dock móvil 390×58 px; todos dentro del viewport, con gradiente clay, canto, al menos tres capas/dos `inset`, sin backdrop y con halo activo visible. Consola y errores de página vacíos.
- Pipeline completo con timeout diagnóstico ya documentado: lint, frontera 29/29, Vitest 97 archivos/738 pruebas, build y presupuesto 664811/670000 bytes y 178313/179500 gzip.
- QA fresco: una primera ejecución falló solo el muestreo `welcomeimportCardActiveTransformIsPressedTranslate`; la repetición inmediata pasó toda la matriz, incluidas las cuatro keys de tool rail, con consola/página limpias. La estabilización del arnés permanece en Tarea 10.

La tarea queda cerrada; no se hizo push.

## Fix round 1 — canto responsive real bajo la cascada eager (2026-08-07 13:36)

Una revisión independiente tardía detectó que el shorthand `border: var(--sc-clay-edge)` de `material.css`, importado después de `styles.css`, anulaba en estilo computado los `border-width` responsive que el reporte original daba por preservados. El código conservaba esas declaraciones, pero no su efecto: el dock móvil terminaba con canto de cuatro lados.

Se corrigió con un puente de propiedad custom: el material eager consume `--sc-toolbar-clay-border-width` con fallback de 1 px en los cuatro lados, mientras `styles.css` conserva la geometría por breakpoint (portrait top-only, landscape rail right-only y small-landscape dock top-only). `qa.mjs` ahora mide los cuatro anchos mediante `getComputedStyle` y certifica por claves distintas desktop y mobile portrait.

Evidencia TDD/QA:

- RED con CSS sin corregir: build PASS; QA falló únicamente `toolRailMobilePortraitHasTopOnlyClayEdge`; desktop four-sided pasó.
- GREEN: build PASS; QA PASS con `toolRailDesktopHasFourSidedClayEdge` y `toolRailMobilePortraitHasTopOnlyClayEdge` verdaderos, consola y errores de página vacíos.
- Mutación: retirar temporalmente la asignación portrait produjo exactamente el fallo nominal mobile; se restauró.
- Estado restaurado certificado por el controlador: build PASS y QA PASS completo con ambas claves verdaderas.
- La restauración lógica quedó limpia en el diff de Git (10 inserciones en `qa.mjs`, 1 en `material.css`, 3 sustituciones en `styles.css`). El SHA físico cambió por normalización CRLF→LF durante la mutación; `git diff --check` no reporta errores y no existe cambio adicional de contenido.

La afirmación anterior “Mobile v2 mantiene border-width” se entiende ahora como contrato computado, no mera presencia textual. No se tocó `capturas.mjs`, el motor ni comportamiento del producto; no se hizo push.
