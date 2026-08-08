# Phase 11 Viewport QA Matrix

## Matriz ejecutable

| ID | CSS viewport | Entrada | Tema de evidencia | Composición esperada | Flujo mínimo |
| --- | ---: | --- | --- | --- | --- |
| desktop-large | 1536x960 | mouse/keyboard | Light | Rail e Inspector persistentes | resize Inspector, canvas y Resultados |
| laptop | 1366x768 | mouse/keyboard | Dark | Rail compacto e Inspector persistente | resize por teclado y persistencia visual |
| tablet-landscape | 1194x834 | touch emulado | Light | Desktop compacto por contenido | canvas, targets coarse y cero overflow |
| tablet-portrait | 834x1194 | touch emulado | Dark | Dock + drawers | Inspector modal, Resultados drawer, Escape y retorno |
| mobile | 430x932 | touch emulado | Light | Header mínimo + dock | Inspector bottom sheet y Resultados full-screen |
| mobile-compact | 390x844 | touch emulado | Dark | Canvas-first compacto | targets 44 px, foco, safe area y cero overflow |
| zoom-200-equivalent | 683x384 | keyboard | Light | Altura corta equivalente | rutas accesibles sin scroll trap |
| WebKit tablet | 834x1194 | touch emulado | Dark | Dock + drawers | mismas comprobaciones geométricas y modales |
| WebKit mobile | 430x932 | touch emulado | Light | Resultados dedicados | full-screen, foco y safe areas |

## Comprobaciones automáticas

Cada fila aplicable exige:

- canvas y superficie primaria de herramientas visibles;
- `scrollWidth <= clientWidth + 1` y sin scroll de página atrapado;
- Inspector persistente/redimensionable en desktop;
- Inspector dialog dentro del viewport en tablet/móvil;
- Resultados drawer en tablet y full-screen en móvil;
- controles frecuentes táctiles de al menos 44 x 44 px;
- Escape y retorno de foco;
- reglas de safe area presentes;
- consola y `pageerror` vacíos.

La salida reproducible es `qa-artifacts/phase11/phase11-results.json`. Las capturas usan el patrón `{browser}-{viewport}-{theme}.png`.

## Cobertura heredada que debe seguir aprobada

| Comando | Cobertura conservada |
| --- | --- |
| `npm.cmd run qa` | modelado, pan, pinch/touch, selección, análisis, Resultados, Aula, unidades, temas, mecanismo y errores reales en Chromium |
| `npm.cmd run qa:webkit` | iPhone/iPad, importación, scroll, overflow y targets en WebKit |
| `npm.cmd run verify` | lint, todas las pruebas Vitest y build de producción |

## Revisión manual requerida

- Comparar screenshots con los conceptos originales de desktop/tablet/móvil y con `FIDELITY_LEDGER.md`.
- Recorrer `Tab`, `Shift+Tab`, Escape y foco de retorno en Inspector, Resultados y paletas.
- Comprobar Light/Dark y ES/EN sin truncar magnitudes, IDs o unidades.
- Reducir la altura con un campo del Inspector enfocado para confirmar scroll y acción de cierre accesibles.
- Confirmar que rotar/reducir viewport conserva selección, cámara, resultados e historial.

## Resultado de cierre

La matriz se marca PASS sólo si `verify`, `qa:phase11`, `qa` y `qa:webkit` terminan sin errores, el diff protegido permanece vacío y la revisión renderizada no detecta overlays, clipping ni funciones inaccesibles.
