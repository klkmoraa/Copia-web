# Evidencia after - Fase 2

Esta carpeta contiene el estado final renderizado y la salida reproducible de `npm.cmd run qa:phase2`.

## Capturas

- Desktop ready/resolved: 1536, 1440, 1366 y 1194 px.
- Desktop Dark/stale: 1280 px.
- Dark/Aula: 1024 px.
- Tablet: 834 x 1194.
- Móvil: 430 x 932 error y 390 x 844 Dark/Aula.
- Overflow/foco: 1194 x 834.
- Loading real: 1366 x 768.
- Zoom 200 %: viewports CSS efectivos de 683 x 384 y 417 x 597, etiquetados por su tamaño físico objetivo.

Las capturas `.jpg` provienen del Browser in-app; la captura loading `.png` se genera en Playwright con el mensaje del worker demorado sólo en QA. `phase2-metrics.json` registra checks, medidas, contrastes, estados y ausencia de errores.
