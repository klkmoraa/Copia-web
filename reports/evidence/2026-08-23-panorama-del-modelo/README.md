# Evidencia · Panorama del modelo

**Ejecutado:** 2026-08-23 · Chromium real (`/opt/pw-browsers/chromium`) sobre el
`dist/` de producción servido por `vite preview`.
**Clasificación:** `AUDIT/TEMPORARY` — ver [reports/README.md](../../README.md).

| Captura | Qué enseña |
|---|---|
| `1-panorama-light.png` | El panel derecho sin selección: censo (4 nudos · 3 barras · 2 apoyos · 3 cargas), extensión 6 × 4 m, casos de carga, combinación y el veredicto del Model Doctor. Antes este sitio tenía dos tarjetas que decían lo mismo y no informaban de nada. |
| `1-panorama-dark.png` | Lo mismo en Noche. |
| `2-panorama-modelo-vacio.png` | Modelo sin un solo nudo: el panorama no enseña un censo en ceros, enseña un primer paso. |
| `3-panorama-k0.png` | K0 táctil, 390×844, con el panorama dentro de la hoja inferior. |

## Lo que deliberadamente NO está en estas capturas

El **estado del análisis** («Listo para analizar») y la **fiabilidad** siguen sólo en la
barra superior. Repetirlos en el hueco recién liberado sería cometer, otra vez, el
defecto que este rediseño está retirando. Hay un gate que lo fija
(`ModelOverview.test.tsx`, «no repite el estado del análisis ni la fiabilidad»).

## Un dato que sí es nuevo

El **recuento de hallazgos del Model Doctor**. Hasta aquí sólo existía como un aviso
pasajero que se va solo: un modelo con hallazgos y el aviso ya cerrado no tenía forma de
decirlo en ninguna parte del producto. En `1-panorama-light.png` el pórtico de ejemplo
está limpio y el panorama lo dice explícitamente, que también es información.
