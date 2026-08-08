# Informe QA del candidato de release

Fase 14 · branch `phase/14-release-qa` · base `7faf52b` · producto `0.7.0`.

## Decisión

`CANDIDATO APROBADO PARA FASE 15`

Lint, suite completa, build, regresión estructural, matriz Chromium/WebKit y revisión visual terminaron sin bloqueos. No se detectaron cambios en la frontera matemática protegida.

## Frontera protegida

El gate no autoriza cambios en solver, engine, workers, datos, unidades físicas, signos, topología, geometría, persistencia, defaults ni handlers matemáticos.

- 45 archivos protegidos comparados contra `7faf52b`.
- Huella SHA-256 base: `bb6fd8de4d1cc1054754db5460647ec4c6c2715499a45ea7eff7df87514d2f65`.
- Huella SHA-256 del worktree: idéntica.
- Diferencias o desajustes: 0.

## Gates automatizados

| Gate | Resultado final |
| --- | --- |
| `npm.cmd run lint` | PASS, sin errores |
| `npm.cmd test` | PASS, 66 archivos y 384/384 pruebas |
| `npm.cmd run build` | PASS |
| `npm.cmd run qa` | PASS, todos los checks Chromium |
| `npm.cmd run qa:webkit` | PASS, iPhone 13 e iPad Pro 11 |
| `npm.cmd run qa:phase11` | PASS, 10 composiciones Chromium/WebKit |
| `npm.cmd run qa:phase12` | PASS, catálogos 972/972 y gates a11y/i18n/offline |
| `npm.cmd run qa:phase13` | PASS, presupuestos, lazy loading y consola limpia |
| `npm.cmd run qa:phase14` | PASS, 6/6 viewports, 8 capturas y 0 fallos |

## Regresión estructural

| Alcance | Resultado |
| --- | --- |
| `src/engine` | 19 archivos, 134/134 pruebas |
| `src/engine src/data` | 23 archivos, 155/155 pruebas |
| Suite ampliada de motor, datos, Aula, resultados, exportación, unidades y edición numérica | 29 archivos, 183/183 pruebas |
| Resultados UI después del ajuste de estabilidad del test lazy | 14/14 pruebas |

La cobertura incluye equilibrio, reacciones, unidades y signos, extremos y diagramas, releases, offsets rígidos, cargas parciales, líneas de influencia, trenes de ejes, protocolo del worker, validación, migración, persistencia y exportación portable. No se relajó ninguna tolerancia.

## Recorridos críticos

| Recorrido | Cobertura exigida |
| --- | --- |
| Proyecto de ejemplo | Welcome, apertura, selección simple/múltiple y canvas visible |
| Edición | Nombre, undo/redo y persistencia del historial |
| Unidades | Cambio de presentación sin mutar valores técnicos |
| Análisis | Worker bajo demanda, resolución y estados actualizados |
| Resultados | Resumen, momento, cursor por teclado, deformada, aprendizaje e influencia |
| Inspector/resultados responsive | Panel, drawer/bottom sheet, focus trap, Escape y retorno |
| Importación/exportación | Descarga JSON, preview, confirmación y round-trip técnico |
| Aula | Predicción previa, navegación por tabs, gate y revelado |

Resultado renderizado: `APROBADO`. Las ocho capturas finales se revisaron directamente en Light/Dark para desktop, tablet y móvil; no se observaron colisiones, recortes, pérdida de contenido crítico ni overflow horizontal.

## Matriz visual y responsive

| Motor | Viewport | Tema | Composición |
| --- | ---: | --- | --- |
| Chromium | 1536×960 | Light | desktop, recorrido extendido |
| Chromium | 834×1194 | Dark | tablet touch |
| Chromium | 390×844 | Light | móvil touch |
| WebKit | 1366×768 | Dark | desktop |
| WebKit | 834×1194 | Light | tablet touch |
| WebKit | 390×844 | Dark | móvil touch |

Cada fila debe cerrar sin overflow horizontal, errores de consola o `pageErrors`; los overlays deben permanecer dentro del viewport y los flujos críticos deben ser operables con teclado.

## Accesibilidad

Se verifican semántica modal, focus trap hacia delante y atrás, Escape, retorno al trigger, tabs de resultados, cursor de diagrama por teclado, targets touch, contraste Light/Dark, reduced motion y mensajes accesibles de carga/error. La cobertura y los límites de AT están detallados en `A11Y_REPORT.md` y `KNOWN_ISSUES.md`.

## Rendimiento

El costo temprano combinado pasa de 249,443 B a 242,694 B gzip (-2.71 %); `InfluenceLineView`, análisis, escenarios e influencia conservan fronteras bajo demanda. Las medianas locales y riesgos aceptados están en `PERFORMANCE_REPORT.md`.

## Evidencia

- `docs/ux-redesign/evidence/phase-14/after/phase14-metrics.json`
- Capturas finales dentro de `docs/ux-redesign/evidence/phase-14/after/`
- `docs/ux-redesign/PERFORMANCE_REPORT.md`
- `docs/ux-redesign/KNOWN_ISSUES.md`
- `docs/ux-redesign/FIDELITY_LEDGER.md`
