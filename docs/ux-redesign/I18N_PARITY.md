# Fase 12 — Paridad ES/EN

## Resultado

**PASS estructural y de recorridos runtime críticos.** Los catálogos declarados contienen 971 claves en español y 971 en inglés, sin claves faltantes ni extras. Las pruebas también exigen valores no vacíos y placeholders de interpolación idénticos.

Este resultado no debe leerse como paridad lingüística total de cada superficie, archivo importado o texto generado.

## Evidencia automática

| Comprobación | Resultado |
| --- | --- |
| Claves ES | 971 |
| Claves EN | 971 |
| Faltantes en EN | 0 |
| Extras en EN | 0 |
| Valores resueltos no vacíos | PASS en ambos idiomas |
| Placeholders nombrados | PASS; mismo conjunto en ES y EN |
| Identificadores y magnitudes interpoladas | PASS; conserva IDs y valores técnicos |

La prueba de catálogos vive en `src/i18n/catalogs.test.ts` y forma parte de las 382 pruebas aprobadas por `npm.cmd run verify`. La medición runtime está en [phase12-metrics.json](evidence/phase-12/after/phase12-metrics.json), generada el 2026-07-27T05:55:12.496Z.

## Muestra base en Chromium

| Idioma | `html[lang]` | Controles observados |
| --- | --- | --- |
| ES | `es` | `Analizar`, `Cargas`, `Vista`, `Local` |
| EN | `en` | `Analyze`, `Loads`, `View`, `Local`, `More actions` |

En 390×844, la muestra inglesa registró:

- documento: `scrollWidth = clientWidth = 390`;
- TopBar: `scrollWidth = clientWidth = 390`;
- navegación y herramientas visibles en inglés sin overflow horizontal;
- foco visible en `More actions`.

La captura es [phase12-i18n-en-390x844.png](evidence/phase-12/after/phase12-i18n-en-390x844.png).

## Recorrido runtime EN

| Superficie | Comprobaciones | Resultado |
| --- | --- | --- |
| Nuevo ejercicio | Título, descripción enlazada, foco inicial dentro del diálogo, flechas entre plantillas, Escape y retorno de foco | PASS |
| Creación | `Length or span = 12`, `Downward load = 55`, `Load position = 0.25`; `html[lang]` permanece `en` después de crear | PASS |
| Centro de importación | Progreso `File → Inspection → Content → Destination → Confirm → Result`; foco inicial en `Choose file`; foco en cada etapa | PASS |
| Ayuda de merge | El radio conserva `aria-describedby` hacia la explicación de por qué merge está deshabilitado | PASS |
| Resultado de importación | `Project imported`, nombre y archivo preservados, apertura en inglés | PASS |
| Validación numérica | `Position = 1.2` anuncia `Use a value between 0 and 1.` mediante `aria-invalid`, `aria-errormessage` y `aria-describedby` | PASS |
| Resultados | Momento, deformada, `Understand`/`Learn` y línea de influencia con copy y nombres accesibles EN | PASS |

El flujo anterior elimina la antigua brecha de cobertura del adaptador/Centro de importación: la ruta real de TopBar, el archivo JSON, las seis etapas, el foco y el resultado final ya forman parte de `qa:phase12`.

## Conservación de datos técnicos

La traducción y la importación no convierten datos de dominio en copy. La huella antes y después conservó:

- nombre de dato `Viga simplemente apoyada`;
- IDs `N1`, `N2`, `M1`, `ML1`, `LC1`;
- unidades `kN-m` y `schemaVersion = 5`;
- geometría `N1 = (0, 0)` y `N2 = (12, 0)`;
- apoyos `pin` y `roller` a 90°;
- miembro `M1`, `E = 200000000`, `A = 0.01`, `I = 0.00008` y liberaciones de momento;
- carga puntual global `py = -55` en `x/L = 0.25`.

La validación inglesa de `1.2` dejó `ML1.position = 0.25`, el JSON sin cambios y el análisis en `resolved`.

## Qué no se traduce automáticamente

- nombres de proyecto, nodos, miembros, casos y demás contenido creado o importado por la persona;
- identificadores, símbolos, unidades y magnitudes de ingeniería;
- nombres propios o contenido incluido dentro de archivos externos.

Por eso el recorrido inglés conserva `Viga simplemente apoyada`: es dato del modelo, no una mezcla de idioma en el chrome.

## Límites

- La igualdad de claves no acredita calidad terminológica, gramática o adecuación regional.
- No se renderizaron visualmente las 971 claves ni todas sus combinaciones de estado.
- La muestra de 390 px usa copy inglés natural; no es una prueba sistemática con pseudo-localización o expansión extrema.
- No se auditó RTL.
- PDFs, exports, mensajes nativos del navegador y contenido de archivos importados no se auditaron de forma exhaustiva.
- El recorrido del Centro de importación usa un JSON structureCo representativo y destino de proyecto nuevo; no cubre todos los formatos ni todas las resoluciones de conflicto.

## Decisión

La paridad estructural de catálogos y los recorridos críticos de Nuevo ejercicio, Centro de importación, validación y Resultados aprueban el gate técnico de Fase 12. La paridad lingüística integral permanece fuera de esta certificación acotada.
