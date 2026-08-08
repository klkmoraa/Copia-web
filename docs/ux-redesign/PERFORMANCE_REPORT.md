# Informe de rendimiento del candidato

Fase 14 · base comparativa `49090f5` · candidato `7faf52b`.

## Método reproducible

- Build productivo con Node `24.18.0`, npm `11.16.0` y Vite `8.1.4`.
- Bytes raw y gzip nivel 9 medidos sobre los assets realmente precargados por `dist/index.html`.
- Recorrido local en cinco contextos nuevos de Chromium, sin throttling: Welcome, apertura del workspace, análisis, activación de Influencia y cálculo de la línea.
- Se registraron solicitudes de chunks/workers, `console`, `pageErrors` y long tasks. Los tiempos locales son comparativos; no se presentan como SLA de campo.
- La medición de bundle permanece automatizada por `npm.cmd run qa:phase13`.

## Bundle

| Grupo | Baseline raw | Candidato raw | Delta | Baseline gzip | Candidato gzip | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Entrada síncrona | 535,518 B | 536,233 B | +715 B (+0.13 %) | 141,782 B | 143,669 B | +1,887 B (+1.33 %) |
| Workspace temprano incremental | 402,008 B | 370,096 B | -31,912 B (-7.94 %) | 107,661 B | 99,025 B | -8,636 B (-8.02 %) |
| Costo temprano combinado | 937,526 B | 906,329 B | -31,197 B (-3.33 %) | 249,443 B | 242,694 B | -6,749 B (-2.71 %) |

El chunk UI de `InfluenceLineView` permanece diferido: 32,850 B raw / 10,096 B gzip. La entrada síncrona respeta el presupuesto de regresión de 2 % y el costo temprano combinado disminuye.

## Tiempos locales

Medianas de cinco recorridos, sin caché compartida entre contextos y sin throttling:

| Hito | Mediana |
| --- | ---: |
| Welcome listo | 338.8 ms |
| Workspace visible | 961.8 ms |
| Análisis resuelto | 594.5 ms |
| UI de Influencia visible | 436.9 ms |
| Línea de influencia calculada | 478.3 ms |

No se observaron errores de consola o de página. Se registraron tres long tasks por recorrido; la mediana de la mayor fue 191 ms. Al no existir una línea base equivalente ni throttling, se conserva como señal diagnóstica y no como regresión demostrada.

## Fronteras bajo demanda

- `analysis.worker` se solicita únicamente al ejecutar **Analizar**.
- `scenarios.worker` se solicita únicamente al ejecutar **Comparar casos**; el smoke local mostró la comparación visible en 541.9 ms.
- El chunk de `InfluenceLineView` no se solicita en Welcome ni antes de activar su pestaña.
- `influence.worker` se solicita únicamente al calcular la línea de influencia.
- PDF.js, su worker, generación PDF e importación portable permanecen fuera del arranque.
- No se cambió comportamiento, protocolo ni código de workers.

| Frontera bajo demanda | Raw | Gzip |
| --- | ---: | ---: |
| `analysis.worker` | 81,588 B | 26,295 B |
| `scenarios.worker` | 81,760 B | 26,393 B |
| `influence.worker` | 90,909 B | 29,437 B |
| PDF worker | 2,366,081 B | 500,805 B |
| PDF.js | 479,842 B | 143,495 B |
| Locale asociado a PDF | 428,290 B | 177,541 B |

El preload oportunista de `WorkspaceShell` ya se había solicitado al hito Welcome en cuatro de cinco muestras. Es comportamiento intencional y está contabilizado dentro de “workspace temprano”, aunque podría competir con Welcome en equipos lentos.

## Veredicto

**Sin bloqueo de release.** Los presupuestos reproducibles de carga pasan; el workspace temprano y el costo combinado mejoran, las fronteras lazy se conservan y no hay evidencia de jank nuevo atribuible al candidato. No existe todavía un SLA temporal ni telemetría de campo, y tampoco se garantiza recuperación offline ante el fallo de un chunk diferido; esos límites quedan registrados en `KNOWN_ISSUES.md`.

## Evidencia

- `docs/ux-redesign/BUNDLE_REPORT.md`
- `docs/ux-redesign/evidence/phase-13/after/phase13-metrics.json`
- `docs/ux-redesign/evidence/phase-14/after/`
