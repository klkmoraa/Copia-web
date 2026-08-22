# Evidencia · fase 3 (defectos y escalas)

Mismo encuadre que `2026-08-22-lanzador-y-barra-unificada/` para poder comparar
una contra otra.

| Archivo | Qué enseña |
|---|---|
| `1-etiquetas-light.png` · `1-etiquetas-dark.png` | Mesa a 1600 px con el pórtico de ejemplo analizado en momento. **Los extremos del diagrama ya no se pintan dos veces**: `Mmax 36.35 kN·m / x 3.00 m` es un solo chip de dos líneas con su línea guía. Contra `3-resultados-dark.png` de la fase 2, donde el sello y el chip se pisaban entre sí y encima de `P = 20.00 kN`. |
| `2-hoja-telefono.png` | 390×844. **La hoja del Inspector tiene asa y cierre**; antes sólo se cerraba con `Escape`, que en un teléfono no existe. Y el lanzador de superficies ya no le tapa el contenido: dejó de estar por encima de ella en la pila. |
| `3-barra-1280-light.png` | 1280 px con resultados en pantalla, que es donde «Analizar» se solapaba 69 px con «Model Doctor». Sin solape, sin desborde y sin zonas desnutridas. |

Medido en Chromium real, no leído del CSS:

```
etiquetas   1280/1440/1600 → {"labels":22,"overlappingPairs":0,"freestandingStamps":0}
barra       390            → {"overlaps":0,"starvedZones":0,"barOverflow":false}
            768            → {"overlaps":0,"starvedZones":0,"barOverflow":false}
            1280           → {"overlaps":0,"starvedZones":0,"barOverflow":false}
hoja        390×844        → {"hojaAbierta":true,"cierreVisible":true,"asa":true}
```
