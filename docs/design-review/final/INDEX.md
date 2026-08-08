# Evidencia visual · Rediseño integral 2026-08-02

Capturas individuales del build de producción final (Playwright/Chromium salvo
donde se indica WebKit). Estructura por superficie; cada tabla documenta
nombre, superficie, tema, viewport y estado.

## 00-baseline/ — Estado ANTES del rediseño (0.8.0)

Capturas de `qa-phase14.mjs` contra el build previo + logs de lint/test/build.
Ver `BASELINE.md` en esa carpeta para el detalle completo (67 archivos /
388 pruebas, fallo preexistente de `qa.mjs:340` documentado).

## 02-home/

| Archivo | Superficie | Tema | Viewport | Estado |
|---|---|---|---|---|
| `01-welcome-1440-light.png` | Bienvenida | Día | 1440×900 | Inicio con ejemplos y acciones |
| `01-welcome-1440-dark.png` | Bienvenida | Noche | 1440×900 | Ídem |
| `02-new-exercise-dialog-1440-light.png` | Diálogo Nuevo ejercicio | Día | 1440×900 | Plantillas Aula + parámetros |
| `02-new-exercise-dialog-1440-dark.png` | Diálogo Nuevo ejercicio | Noche | 1440×900 | Ídem |

## 04-canvas/

| Archivo | Superficie | Tema | Viewport | Estado |
|---|---|---|---|---|
| `03-workspace-1440-light.png` | Workspace + Canvas | Día | 1440×900 | Pórtico de ejemplo, sin analizar |
| `03-workspace-1440-dark.png` | Workspace + Canvas | Noche | 1440×900 | Ídem |
| `03-workspace-1366-light.png` | Workspace laptop | Día | 1366×768 | Ídem |

## 06-results/

| Archivo | Superficie | Tema | Viewport | Estado |
|---|---|---|---|---|
| `04-results-1440-light.png` | Resultados (Momento) | Día | 1440×900 | Análisis resuelto, diagrama M |
| `04-results-1440-dark.png` | Resultados (Momento) | Noche | 1440×900 | Ídem |
| `04-results-1366-light.png` | Resultados laptop | Día | 1366×768 | Ídem |

## 07-classroom/

| Archivo | Superficie | Tema | Viewport | Estado |
|---|---|---|---|---|
| `05-classroom-1440-dark.png` | Modo Aula · Recorrido + predicción | Noche | 1440×900 | Paso 3/6 "Predice", viga simplemente apoyada |
| `05-classroom-1440-light.png` | Modo Aula | Día | 1440×900 | Ídem |

## 08-import-export/

| Archivo | Superficie | Tema | Viewport | Estado |
|---|---|---|---|---|
| `06-import-center-1440-light.png` | Centro de importación (paso 1/6) | Día | 1440×900 | Selector JSON/PDF/.structureco |

## 10-responsive/

| Archivo | Superficie | Tema | Viewport | Estado |
|---|---|---|---|---|
| `03-workspace-tablet-834-dark.png` | Workspace tablet vertical | Noche | 834×1194 | Táctil |
| `04-results-tablet-834-dark.png` | Resultados tablet | Noche | 834×1194 | Analizado |
| `03-workspace-mobile-390-light.png` | Workspace móvil | Día | 390×844 | Dock inferior de herramientas |
| `03-workspace-mobile-390-dark.png` | Workspace móvil | Noche | 390×844 | Ídem |
| `04-results-mobile-390-light.png` | Resultados móvil (hoja) | Día | 390×844 | Diagrama M en hoja inferior |
| `04-results-mobile-390-dark.png` | Resultados móvil (hoja) | Noche | 390×844 | Ídem |
| `03-workspace-mobile-land-844-dark.png` | Workspace móvil horizontal | Noche | 844×390 | Ídem |
| `04-results-mobile-land-844-dark.png` | Resultados móvil horizontal | Noche | 844×390 | Ídem |

## 11-accessibility/

`console-errors.json` — registro de errores de consola durante toda la sesión
de capturas: **vacío (0 errores)**.

## 13-before-after/

Capturas `phase14-*.png` generadas por `qa-phase14.mjs` contra el build FINAL
(después del rediseño), comparables 1:1 con las homónimas de `00-baseline/`
(mismo script, mismas matrices Chromium/WebKit, mismos flujos):

| Par comparable | Matriz |
|---|---|
| `00-baseline/phase14-chromium-desktop-1536x960-light.png` ↔ `13-before-after/phase14-chromium-desktop-1536x960-light.png` | Chromium desktop Día |
| `00-baseline/phase14-webkit-desktop-1366x768-dark.png` ↔ `13-before-after/phase14-webkit-desktop-1366x768-dark.png` | WebKit desktop Noche |
| `00-baseline/phase14-chromium-tablet-834x1194-dark.png` ↔ ídem | Chromium tablet Noche |
| `00-baseline/phase14-chromium-mobile-390x844-light.png` ↔ ídem | Chromium móvil Día |
| `00-baseline/phase14-webkit-mobile-390x844-dark.png` ↔ ídem | WebKit móvil Noche |
| `00-baseline/phase14-webkit-classroom-1366x768-dark.png` ↔ ídem | Aula WebKit Noche |
| (resto de matrices homónimas) | — |
