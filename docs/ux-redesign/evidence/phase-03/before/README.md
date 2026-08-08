# Evidencia before - Fase 3

Capturas obtenidas en el navegador integrado sobre `http://127.0.0.1:4173/`, con viewport CSS exacto y DPR 1.3. Se verificaron el modelo Pórtico de ejemplo, estado listo, análisis actualizado, selección de M2, Light y Dark.

## Archivos

| Archivo | Viewport objetivo | Raster PNG | Estado |
| --- | ---: | ---: | --- |
| `phase3_30_1536x960_light_complete_ready_baseline.png` | 1536x960 | 960x960 | Light, Completo, listo |
| `phase3_30_1440x900_light_complete_ready_baseline.png` | 1440x900 | 960x900 | Light, Completo, listo |
| `phase3_30_1440x900_light_complete_analyzed_member-selected.png` | 1440x900 | 960x900 | Light, analizado, M2 seleccionado |
| `phase3_30_1366x768_light_complete_analyzed_baseline.png` | 1366x768 | 960x768 | Light, analizado |
| `phase3_30_1280x800_light_complete_analyzed_baseline.png` | 1280x800 | 960x800 | Light, analizado |
| `phase3_30_1194x834_light_complete_ready_baseline.png` | 1194x834 | 960x834 | Light, listo |
| `phase3_30_1024x768_light_complete_ready_baseline.png` | 1024x768 | 960x768 | Light, listo |
| `phase3_30_1024x768_dark_complete_analyzed_baseline.png` | 1024x768 | 960x768 | Dark, analizado |
| `phase3_30_834x1194_light_complete_ready_baseline.png` | 834x1194 | 834x1032 | Light, listo |
| `phase3_30_430x932_light_complete_ready_baseline.png` | 430x932 | 430x932 | Light, listo |
| `phase3_30_390x844_light_complete_ready_baseline.png` | 390x844 | 390x844 | Light, listo |
| `phase3_30_390x844_dark_complete_analyzed_baseline.png` | 390x844 | 390x844 | Dark, analizado |

El raster exportado por el navegador se normaliza a un máximo de 960 px en vistas anchas y puede limitar el alto visible. Las métricas de layout se tomaron antes de exportar, en el viewport CSS nativo. No se reescaló la página para maquillar la composición.

El manifiesto reproducible con tamaño, SHA-256, viewport y estado está en `phase3-before-manifest.json`.

