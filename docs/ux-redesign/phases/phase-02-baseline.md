# Baseline - Fase 2, Slice 2.0

Fecha: 2026-07-17  
Aplicación: structureCo 0.7.0  
Entorno: Windows, Node.js 24.18.0, npm 11.16.0, Vite 8.1.4.

## Comandos

| Comando | Resultado |
| --- | --- |
| `npm.cmd run verify` | PASS - lint, 40 archivos, 229 pruebas y build. |
| `npm.cmd run qa` | PASS - todos los checks Chromium, sin errores de consola/página. |
| `npm.cmd run qa:webkit` | PASS - iPhone 13 e iPad Pro 11 emulados, sin errores. |

## Flujo de captura

Bienvenida -> Pórtico de ejemplo -> Analizar -> Momento M2 -> cambiar viewport. Se mantuvo el mismo modelo y análisis para todas las vistas analizadas. La captura 1536 registra el estado listo previo al análisis; la captura 390 usa tema oscuro y un nombre largo para estresar el header.

## Resultados geométricos iniciales

| Viewport | Overflow horizontal | Intersecciones TopBar medidas |
| --- | ---: | --- |
| 1536x960 | 0 px | Colisión visual incipiente; captura de referencia amplia. |
| 1440x900 | 0 px | Deshacer y Rehacer con Caso/Combinación; Local con Caso/Combinación. |
| 1366x768 | 0 px | Deshacer/Rehacer con Caso; Local con Caso y Modo. |
| 1194x834 | 0 px | Nombre/menú/historial con Caso; Rehacer/Local con Modo. |
| 834x1194 | 0 px | 0 intersecciones en header compacto. |
| 430x932 | 0 px | 0 intersecciones en header móvil. |
| 390x844 | 0 px | 0 intersecciones; nombre largo truncado; tema oscuro. |

Las mediciones completas están en `evidence/phase-02/before/baseline-metrics.json`.

## Salud del navegador

- URL: `http://127.0.0.1:4173/`.
- Título: `structureCo · Análisis estructural 2D`.
- Página no vacía y sin overlay de Vite.
- Consola sin errores o warnings relevantes.
- Interacción comprobada: abrir ejemplo y ejecutar Analizar actualizó canvas, inspector y resultados.

## Desviación de infraestructura

No existe un repositorio Git válido. La raíz `structureCo` no tiene `.git`; el directorio padre `Structure/.git` existe pero está vacío. No se creó rama, worktree o commit. Esta decisión queda bloqueada en [`phase-02-plan.md`](phase-02-plan.md).

## Frontera

El Slice 2.0 no modificó ningún archivo bajo `src/`. Los únicos cambios son documentación, capturas y salidas generadas por build/QA.

