# Fase 12 — Informe de accesibilidad

Fecha del corte: 2026-07-26 (America/Mexico_City)  
Evidencia automatizada: 2026-07-27T05:55:12.496Z  
Rama: `phase/12-a11y-feedback-i18n`  
Predecesor auditado: `86fcae1`

## Resultado

**PASS para el gate técnico acotado de Fase 12.** El árbol verificado aprueba lint, 65 archivos de prueba con 382 pruebas, build, recorridos de teclado y foco, contraste representativo, `prefers-reduced-motion`, overflow responsive, estado local-first offline y paridad estructural ES/EN.

Este resultado no equivale a una certificación WCAG completa ni a una aprobación general de release. La cobertura y sus límites se detallan abajo.

## Verificación reproducible

| Comando | Resultado |
| --- | --- |
| `npm.cmd run verify` | PASS: oxlint limpio, 65 archivos de prueba, 382 pruebas, TypeScript y build Vite de producción. |
| `npm.cmd run qa:phase12` | PASS: build y recorrido Chromium; `failures`, `runtimeErrors`, `console` y `pageErrors` vacíos. |
| `git diff --name-only 86fcae1 -- src/engine src/workers src/data src/store src/types.ts` | PASS: salida vacía. |

La fuente legible por máquina es [phase12-metrics.json](evidence/phase-12/after/phase12-metrics.json).

## Matriz cubierta

| Área | Evidencia | Resultado |
| --- | --- | --- |
| Semántica de feedback | Pruebas de `Banner`, `StatusStrip`, controles, Inspector, Resultados y TopBar | Roles, regiones live, estado busy, icono y texto; PASS. |
| Tabs por teclado | Chromium: `ArrowRight` selecciona y mueve foco; `Home` vuelve al primer tab | PASS. |
| Inspector modal | Chromium móvil: semántica de diálogo, foco inicial, Escape y retorno al lanzador | PASS. |
| Nuevo ejercicio | Chromium EN: diálogo enlazado a su descripción, foco inicial dentro del modal, navegación de plantillas con flechas, Escape y retorno al lanzador | PASS. |
| Centro de importación | Chromium EN: foco inicial en `Choose file` y foco programático confirmado en `Content`, `Destination`, `Confirm` y `Result`; ayuda de merge enlazada por `aria-describedby` | PASS. |
| Validación numérica | Chromium EN: `Position = 1.2` produce `aria-invalid`, `aria-errormessage` y descripción enlazada; Escape restaura el borrador sin alterar el dato persistido | PASS. |
| Resultados | Chromium EN: diagrama de momento, deformada, familia `Understand` y línea de influencia con nombres accesibles y miembro `M1` | PASS. |
| Focus trap y orden | Pruebas de Inspector, Resultados y overlays: `Tab`, `Shift+Tab`, Escape, `<details>` abierto/cerrado y retorno | PASS. |
| Contraste Light/Dark | Colores computados sobre superficies renderizadas y controles enfocados reales | Todas las muestras superan su umbral. |
| Movimiento reducido | Emulación de `prefers-reduced-motion: reduce` | Media query activa, duración máxima 0.001 ms y spinner detenido. |
| Responsive | 390×844, 834×1194 y 1366×768 | Sin overflow horizontal; canvas visible; overlays dentro del viewport o Inspector persistente. |
| ES/EN | Catálogos y recorridos runtime críticos | Paridad estructural 971/971; ver [I18N_PARITY.md](I18N_PARITY.md). |
| Offline local-first | Chromium offline durante la sesión | Edición habilitada y nombre persistido en `localStorage`; PASS dentro del alcance declarado. |

## Contraste observado

Texto normal usa un mínimo de 4.5:1; indicadores gráficos de foco usan un mínimo de 3:1.

| Tema | Texto primario | Texto secundario | Acción primaria | Warning | Error | Tab activo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Light | 16.67 | 5.49 | 5.32 | 6.56 | 6.70 | 5.32 |
| Dark | 16.15 | 8.34 | 7.54 | 8.82 | 5.94 | 7.10 |

Los indicadores se midieron después de obtener foco real por teclado:

| Control enfocado | Light | Dark | Estilo observado |
| --- | ---: | ---: | --- |
| Más acciones | 5.01 | 6.82 | `solid`, 3 px, `:focus-visible` activo |
| Nombre del caso de carga | 4.39 | 6.21 | `solid`, 3 px, `:focus-visible` activo |

## Evidencia runtime EN

El recorrido crea una viga de 12 m con carga puntual de 55 kN en `x/L = 0.25`, la exporta al flujo de importación y compara la huella técnica antes y después. Se conservaron `N1`, `N2`, `M1`, `ML1`, `LC1`, `E = 200000000`, `A = 0.01`, `I = 0.00008`, apoyos, liberaciones y carga `py = -55`.

Después del análisis:

- la posición inválida `1.2` mantuvo el valor almacenado `0.25`, dejó el JSON intacto y conservó el estado `resolved`;
- el diagrama anunció `Bending moment diagram for member M1`;
- la deformada anunció `v response for member M1`;
- `Learn` quedó descrito por la familia `Understand` y abrió el explorador del método de rigidez;
- la línea de influencia anunció `Influence line M at M1, x = 6.000 m`.

## Evidencia visual

- [Contraste y foco Light, 1366×768](evidence/phase-12/after/phase12-contrast-light-1366x768.png)
- [Contraste y foco Dark, 1366×768](evidence/phase-12/after/phase12-contrast-dark-1366x768.png)
- [Reduced motion, 1366×768](evidence/phase-12/after/phase12-reduced-motion-1366x768.png)
- [Inglés representativo, 390×844](evidence/phase-12/after/phase12-i18n-en-390x844.png)
- [Nuevo ejercicio EN, 1366×768](evidence/phase-12/after/phase12-i18n-en-new-exercise-1366x768.png)
- [Importación EN — contenido, 1366×768](evidence/phase-12/after/phase12-i18n-en-import-content-1366x768.png)
- [Importación EN — confirmación, 1366×768](evidence/phase-12/after/phase12-i18n-en-import-confirm-1366x768.png)
- [Validación numérica EN, 1366×768](evidence/phase-12/after/phase12-i18n-en-numeric-validation-1366x768.png)
- [Resultados EN — Understand, 1366×768](evidence/phase-12/after/phase12-i18n-en-results-understand-1366x768.png)
- [Resultados EN — influencia, 1366×768](evidence/phase-12/after/phase12-i18n-en-influence-1366x768.png)
- [Offline local-first, 1366×768](evidence/phase-12/after/phase12-offline-local-first-1366x768.png)
- [Responsive, 390×844](evidence/phase-12/after/phase12-overflow-390x844.png)
- [Responsive, 834×1194](evidence/phase-12/after/phase12-overflow-834x1194.png)
- [Responsive, 1366×768](evidence/phase-12/after/phase12-overflow-1366x768.png)

Las seis capturas runtime EN nuevas se inspeccionaron visualmente. Nuevo ejercicio, validación, Understand e influencia quedan legibles y sin clipping horizontal. En las capturas del Centro de importación, el modal supera la altura del viewport de 768 px y la imagen conserva la porción visible de la etapa; la progresión completa y el foco de cada etapa se verifican en la métrica automatizada.

## Frontera protegida

El diff desde `86fcae1` permanece vacío para:

- `src/engine/**`
- `src/workers/**`
- `src/data/**`
- `src/store/**`
- `src/types.ts`

La Fase 12 no cambia solver, workers, valores físicos por defecto, unidades internas, signos, topología, persistencia de dominio ni validación matemática. La QA sólo observa contratos ya expuestos y compara la huella técnica del proyecto.

## Límites y trabajo no certificado

- El recorrido de Fase 12 usa Chromium; no acredita paridad WebKit o Firefox.
- No se realizó una sesión manual con lector de pantalla, Voice Control, Switch Control u otra tecnología asistiva física.
- No se auditó `forced-colors` ni el modo de alto contraste del sistema.
- El contraste es una muestra dirigida de tokens y controles críticos, no un barrido exhaustivo de cada píxel o estado.
- Este script no acredita zoom al 200 %.
- La prueba offline cubre la sesión actual y persistencia en el navegador local; no promete recarga offline, Service Worker ni PWA.
- La paridad i18n aprobada es estructural y de recorridos críticos, no una certificación lingüística integral.
- El flujo de importación usa un proyecto JSON structureCo representativo; no certifica todos los formatos externos ni todas las combinaciones de conflicto.

## Decisión de gate

La Fase 12 queda técnicamente apta para integración dentro de este alcance. Una aprobación de release debe añadir pruebas con tecnologías asistivas, navegadores objetivo, alto contraste, zoom y auditoría lingüística end-to-end.
