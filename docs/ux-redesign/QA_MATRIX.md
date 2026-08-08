# Matriz de QA — línea base de Fase 1

## Entrada de Fase 3 - Slice 3.0, 2026-07-17

| Capa | Cobertura | Resultado |
| --- | --- | --- |
| `npm.cmd run verify` | lint, 41 archivos, 233 pruebas y build | **PASS** |
| `npm.cmd run qa:phase2` | 117 checks y 14 filas ES/EN | **PASS**, 0 fallos, consola limpia |
| `npm.cmd run qa` | Chromium heredado funcional | **PASS**, consola y page errors vacíos |
| `npm.cmd run qa:webkit` | iPhone 13 e iPad Pro 11 | **PASS** |
| Browser integrado | nueve viewports, Light/Dark, listo/analizado, selección M2 | **PASS funcional / baseline visual abierto** |
| Frontera protegida | engine, workers, data, portable, types | Baseline SHA registrado; diff final exigido en cero |

Hallazgos visuales de entrada: ToolRail plano, agrupación dependiente de separadores, chrome sin zonas seguras explícitas, capas mezcladas con settings persistentes, labels sin prioridad/LOD/colisión y selección verde confundible con acción de producto. Todos son alcance de Fase 3; no se detectó falla matemática.

### Gate 3.1 - registro y ToolRail/ToolDock

| Control | Resultado |
| --- | --- |
| Registro | 12 ids únicos, 11 teclas únicas y Delete contextual; tests puros PASS. |
| Agrupación | 2 Navegar, 3 Crear, 3 Cargas, 2 Inspeccionar y 2 Editar. |
| Responsive | 1536 expandido, 1366 compacto y 390 dock + sheet; inspección Browser PASS. |
| Accesibilidad | grupos nombrados, `aria-pressed`, `menuitemradio`, Escape y retorno de foco conservados. |
| Regresión | `npm.cmd run verify`: 42 archivos, 238 pruebas, build PASS. |

### Gate 3.2 - chrome y zonas seguras

| Control | Resultado |
| --- | --- |
| Safe rect | Insets deterministas para <=480, <=1023 y desktop; tests PASS. |
| Fit visual | Modelo centrado dentro del área sin chrome; cargas completas en 430 px. |
| HUD | Modo, cámara, escala, coordenadas y status con nombres accesibles. |
| Móvil | Corrección iterada de overlap coordenadas/cámara; inspección 390 y 430 PASS. |
| Regresión | `npm.cmd run verify`: 43 archivos, 242 pruebas, build PASS. |

### Gate 3.3 - capas UI-only

| Control | Resultado |
| --- | --- |
| Estado | Reducer local con ocho capas; reset por proyecto; tests PASS. |
| Invariante | Modelo no se puede apagar y los tres miembros permanecen visibles. |
| Cargas | Browser: 5 botones coincidentes antes, 2 del chrome al ocultar, 5 al restablecer. |
| Responsive | Panel completo y scrolleable en 1024 y 430 sin invadir dock/resultados. |
| Regresión | `npm.cmd run verify`: 45 archivos, 247 pruebas, build PASS. |

### Gate 3.4 - etiquetas y decluttering

| Control | Resultado |
| --- | --- |
| Prioridad/LOD | P0-P3 y umbrales essential/standard/detailed cubiertos por pruebas puras. |
| Determinismo | El resultado no depende del orden de entrada; ocho P0/P1 coincidentes se colocan sin solaparse. |
| Zona segura | Labels limitados por `canvasSafeRect`; Browser 1440 y 430 sin overflow. |
| Semántica | Cargas, diagramas, reacciones, cotas y selección conservan roles de color independientes. |
| Accesibilidad | Los objetos mantienen `aria-label`; reacciones conservan descripción SVG no visual. |
| Regresión | `npm.cmd run verify`: 46 archivos, 252 pruebas, build PASS. |

### Gate 3.5 - feedback de selección

| Control | Resultado |
| --- | --- |
| Semántica | Selección azul separada de acción verde y de colores técnicos. |
| Miembro | Halo azul de 10 px + geometría base visible; label P0 azul. |
| Nodo/apoyo | Anillo, cruceta y marco discontinuo; no depende sólo de color. |
| Carga | Halo azul superpuesto; flechas distribuidas mantienen verde técnico. |
| Multi | Envolvente, cuatro handles y contador ES/EN; clipping al viewport probado. |
| Temas | Browser 430 Light/Dark inspeccionado; token #2867e8 / #78a8ff. |
| Regresión | `npm.cmd run verify`: 47 archivos, 256 pruebas, build PASS. |

### Gate 3.6 - gestos, responsive y accesibilidad

| Control | Resultado |
| --- | --- |
| Mouse | Pan, rueda anclada, drag de nodo y selección por caja conservados. |
| Touch | Pan de un dedo, pinch, long-press y hit areas de 44 px preservados. |
| Pen | Perfil Pointer Events: drag preciso, coordenadas, umbral 5 px; sin afirmación de hardware. |
| Teclado | Enter/Espacio, Escape y shortcut H cubiertos por test; H ejercitado en Browser. |
| ARIA/foco | Descripción y shortcuts expuestos; foco azul con redundancia geométrica. |
| Preferencias | Browser reportó reduced motion activo y transición efectiva de 0.001 ms. |
| Responsive | 834×1194 sin overflow; dock visible con targets de 135×54 px en el entorno inspeccionado. |
| Regresión | `npm.cmd run verify`: 47 archivos, 258 pruebas, build PASS. |

### Gate 3.7 - QA integral y evidencia final

| Control | Resultado |
| --- | --- |
| Fase 3 | `qa:phase3`: **125/125**, nueve viewports, 19 capturas, cero consola/page errors. |
| Geometría | Cero overflow horizontal, colisiones P0/P1, intersecciones de chrome y targets touch inferiores a 44 px. |
| Variantes | Light/Dark, Completo/Aula, ES/EN, listo/analizado, capas y nodo/apoyo/miembro/carga/multi. |
| Entrada | Mouse, teclado, touch, pen emulado, reduced motion y zoom 200 % aprobados. |
| Regresión | `verify`: 258/258; Fase 2: 117/117; Chromium: 63/63; WebKit iPhone/iPad: PASS. |
| Contrato visual | QA heredado actualizado para consultar labels P1 separados de la geometría SVG; valores 2.500 kip confirmados. |
| Frontera | Cero diferencias en engine, workers, data, portable y `types.ts` contra el baseline. |

Evidencia reproducible: `evidence/phase-03/after/phase3-metrics.json` y `phase3-after-manifest.json`.

### Gate 3.8 - informe y cierre

| Control | Resultado |
| --- | --- |
| Contenido | 58 páginas; 10 referencias, 12 capturas before y 19 after embebidas. |
| Integridad | Extracción de texto confirma 12/12 y 19/19 nombres de capturas y frase de cierre. |
| Render | 58/58 páginas rasterizadas; dos contact sheets y vistas representativas inspeccionadas. |
| Correcciones | Altura de anexos verticales ajustada; cero páginas de spill, vacías, recortadas o deformadas. |
| PDF | 9,908,217 bytes; SHA-256 `9fa863032d95bd1498e7558ca4da97c4b5902fa9469086c60f4935f9dfd42bb9`. |
| Compuerta | **Fase 3 completada y lista para revisión. Fase 4 no iniciada.** |

## Cierre de Fase 2 - 2026-07-17

| Capa | Cobertura | Resultado final |
| --- | --- | --- |
| `npm.cmd run verify` | lint, 41 archivos de prueba, 233 pruebas y build | **PASS** |
| `npm.cmd run qa:phase2` | 117 checks, 14 filas ES/EN, nueve viewports, estados, contraste, foco, reduced motion y zoom 200 % | **PASS**, 0 fallos, 0 console errors, 0 page errors |
| `npm.cmd run qa` | 63 checks Chromium: canvas, resultados, gestos, mecanismo, influencia, móvil y ejemplo educativo | **PASS**, consola limpia |
| `npm.cmd run qa:webkit` | iPhone 13 e iPad Pro 11: importación, viewport, scroll y targets | **PASS**, 0 errores |
| Browser in-app | estados reales, overflow/foco y 13 capturas finales | **PASS** |

Resultados cuantitativos:

- Intersecciones visibles en la TopBar: 0 en 390, 430, 834, 1024, 1194, 1280, 1366, 1440 y 1536 px.
- Controles fuera del header: 0; overflow horizontal: 0 px.
- Targets frecuentes en 390/430/834: al menos 44 x 44 px.
- Texto crítico renderizado: mínimo 12 px.
- Contraste Light del indicador: listo 4.77:1, warning 5.84:1 y error 5.90:1.
- Loading: botón Analizar 148 px antes/durante en wide; estado `calculating` capturado realmente.
- Zoom 200 %: equivalentes CSS 683 x 384 y 417 x 597 sin colisión, salida del header u overflow.

Evidencia reproducible: `evidence/phase-02/after/phase2-metrics.json`.

## Revalidación de entrada - Fase 2, Slice 2.0

| Capa | Resultado 2026-07-17 | Evidencia |
| --- | --- | --- |
| `verify` | PASS - 40 archivos, 229 pruebas, build | `phases/phase-02-baseline.md` |
| QA Chromium | PASS - todos los checks, consola/página limpias | `qa-artifacts/qa-results.json` |
| QA WebKit | PASS - iPhone 13 e iPad Pro 11 emulados | salida `qa:webkit` y capturas QA |
| Geometría P0 | FAIL esperado antes del rediseño en 1440, 1366 y 1194 | `evidence/phase-02/before/baseline-metrics.json` |
| Overflow horizontal | PASS en siete viewports before | `evidence/phase-02/before/` |
| Interacción | PASS - ejemplo -> Analizar -> canvas/inspector/resultados | Browser in-app, consola limpia |

La función está estable, pero los tres P0 visuales siguen abiertos como condición de entrada. Este estado es intencional: el Slice 2.0 mide el antes y todavía no autoriza cambios productivos.

## Resultado actual

| Capa | Entorno | Cobertura | Resultado | Observación visual |
| --- | --- | --- | --- | --- |
| Verificación de código | Node 24.18.0 / npm 11.16.0 | lint, unitarias, integración y build | **PASS** — 40 archivos, 229 pruebas | No evalúa composición visual. |
| Recorrido automatizado | Chromium | desktop/mobile, pan, zoom, touch, abrir, menús, tema, inspector, influencia, mecanismo, Hibbeler, overflow | **PASS** | Las capturas revelan microtexto y densidad que los checks booleanos no detectan. |
| Compatibilidad | WebKit emulado iPhone 13 | importación y ajuste al viewport | **PASS** | Centro de importación es una fortaleza. |
| Compatibilidad | WebKit emulado iPad Pro 11 | importación, targets y viewport | **PASS** | No cubre el workspace de 1194 px auditado manualmente. |
| Recorrido manual | Chromium 1440×900 | Completo, claro, analizado, selección, resultados | **PASS funcional / FAIL visual** | TopBar se cruza; resultados pequeños. |
| Recorrido manual | Chromium 1366×768 | Completo, claro, analizado | **PASS funcional / FAIL visual** | Historial/guardado invaden el selector. |
| Recorrido manual | Chromium 1194×834 | tableta horizontal | **PASS funcional / FAIL visual** | Breakpoint tardío y colisiones severas. |
| Recorrido manual | Chromium 834×1194 | tableta vertical | **PASS funcional / FAIL táctil** | Composición útil; controles frecuentes <44 px. |
| Recorrido manual | Chromium 390×844 | móvil, resultados e inspector | **PASS funcional / FAIL visual** | Tabs parciales, microtexto y targets pequeños. |
| Recorrido manual | Chromium 1440×900 | oscuro, Aula y predicción | **PASS funcional / FAIL de dirección** | Aula no tiene stepper persistente ni acento secundario propio. |
| Estado de error | Chromium desktop/mobile | mecanismo y diagnóstico | **PASS funcional** | Mensaje claro; detalle demasiado pequeño. |
| Consola | Chromium durante el recorrido | errores, warnings y page errors | **PASS** | Sin incidencias observadas. |

## Matriz mínima para una implementación futura

Cada cambio visual deberá probar como mínimo:

| Eje | Valores obligatorios |
| --- | --- |
| Viewport | 390×844, 430×932, 834×1194, 1024×768, 1194×834, 1280×800, 1366×768, 1440×900, 1536×960 |
| Tema | claro, oscuro |
| Modo | Completo, Aula |
| Proyecto | nuevo, ejemplo, importado |
| Análisis | listo, calculando, resuelto, desactualizado, mecanismo/error |
| Selección | ninguna, nodo, miembro, carga, múltiple |
| Paneles | cerrados, compactos, expandidos, modal/pantalla completa |
| Entrada | mouse, teclado, touch; stylus cuando exista hardware disponible |
| Idioma | ES, EN |
| Preferencias | movimiento reducido, transparencia reducida, zoom navegador 200 % |

## Gates cuantitativos

- Cero colisiones geométricas o overflow horizontal de página.
- Cero texto crítico por debajo de 12 px.
- Cuerpo de lectura de 14 px o más salvo excepción documentada.
- Targets frecuentes de 44×44 px como mínimo.
- Contraste WCAG AA para texto, controles y estados relevantes.
- Foco visible, orden lógico, modal con fondo inerte y restauración de foco.
- Tab activo y estado de análisis identificables sin depender sólo del color.
- Mismos resultados, precisión, signos y unidades antes/después.
- `npm.cmd run verify`, `npm.cmd run qa` y `npm.cmd run qa:webkit` aprobados.
- Comparación visual contra [`evidence/baseline/`](evidence/baseline/README.md) con diferencias intencionales documentadas.

## Riesgos no cerrados en esta fase

- Hardware iOS/iPadOS/Android real y stylus.
- Auditoría completa con lector de pantalla.
- Recorrido completo sólo con teclado en todas las herramientas del canvas.
- Zoom de navegador al 200 % y escalado del sistema operativo.
- Pruebas perceptuales de daltonismo sobre todos los diagramas.

Estos riesgos deben incorporarse antes de declarar terminado el rediseño, pero no impiden cerrar la auditoría de Fase 1.
