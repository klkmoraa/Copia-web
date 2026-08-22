# Evidencia cromática y visual CRI-91

**Clasificación:** AUDIT/TEMPORARY

**Autoridad:** evidencia derivada; el Brandbook canónico y `src/design-system/tokens.css` conservan la autoridad visual.

**Fecha:** 2026-08-16

## Método reproducible

- `node validation/cri-91/cri91-color-gate.mjs` lee los cuatro fondos directamente de `tokens.css`, comprueba que cada rol final coincide con el HEX documentado en el Brandbook, calcula luminancia relativa y contraste WCAG, valida los pares relleno/tinta y emite las transformaciones perceptuales.
- Las aproximaciones de deuteranopia y protanopia usan matrices Machado 2009, severidad 100. Son QA visual de separación, no una medición clínica.
- El veredicto combina evidencia numérica con canales independientes del color: etiqueta, forma, icono, área y patrón discontinuo/continuo.
- `node validation/cri-91/cri91-visual-qa.mjs` sirve el Brandbook y Component Lab localmente y los prueba con Playwright en Día/Noche y anchos Expanded/Medium/Compact.

Fondos leídos: canvas Día `#FFFDF9`, surface Día `#FFFCF7`, canvas Noche `#0D161B`, surface Noche `#15232B`.

## Gate completo de trazo/UI

| Rol | HEX | Canvas Día | Surface Día | Canvas Noche | Surface Noche | Peor | Veredicto |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Brand fill / action | `#1AA57A` | 3.08 | 3.06 | 5.84 | 5.13 | 3.06 | PASS |
| Brand hover | `#159A72` | 3.51 | 3.48 | 5.14 | 4.51 | 3.48 | PASS |
| Brand pressed | `#148F69` | 4.00 | 3.97 | 4.50 | 3.95 | 3.95 | PASS |
| Brand stroke / snap / hover técnico | `#087E5C` | 4.98 | 4.95 | 3.62 | 3.17 | 3.17 | PASS |
| Brand ink | `#02140F` | 18.63 | 18.49 | 1.03 | 1.18 | N/A | PASS como tinta de par |
| Cortante V / carga distribuida · canto | `#468C09` | 4.12 | 4.09 | 4.37 | 3.84 | 3.84 | PASS |
| Cortante V / carga distribuida · área | `#DAEFC8` | 1.20 | 1.20 | 14.95 | 13.13 | N/A | PASS por canto medido |
| Influencia · canto | `#D85AC9` | 3.32 | 3.30 | 5.42 | 4.76 | 3.30 | PASS |
| Influencia · área | `#F2C2E6` | 1.52 | 1.50 | 11.88 | 10.43 | N/A | PASS por canto medido |
| Success | `#2D7C36` | 5.11 | 5.07 | 3.53 | 3.10 | 3.10 | PASS |
| Aula | `#C94A8F` | 4.25 | 4.22 | 4.23 | 3.72 | 3.72 | PASS |
| Momento M | `#ED4B46` | 3.63 | 3.60 | 4.96 | 4.36 | 3.60 | PASS |
| Error | `#D92E28` | 4.73 | 4.69 | 3.81 | 3.34 | 3.34 | PASS |
| Focus / selection | `#6A5DF2` | 4.63 | 4.60 | 3.89 | 3.41 | 3.41 | PASS |

## Pares relleno/tinta

| Relleno | Tinta | Ratio | Veredicto |
| --- | --- | ---: | --- |
| Brand fill `#1AA57A` | Brand ink `#02140F` | 6.04 | PASS |
| Brand hover `#159A72` | Brand ink `#02140F` | 5.31 | PASS |
| Brand pressed `#148F69` | Brand ink `#02140F` | 4.65 | PASS |
| Success `#2D7C36` | `#FFFFFF` | 5.19 | PASS |

## Separación perceptual

| Grupo | Color | Grayscale | Deuteranopia | Protanopia | Canal independiente | Veredicto |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| A · brand / cortante / success | ΔE min 23.54 | ΔE min 5.98 | ΔE min 22.14 | ΔE min 21.95 | control relleno / canto+área / icono+label | PASS |
| B · influencia / Aula | ΔE 24.41 | ΔE 7.03 | ΔE 24.72 | ΔE 23.10 | dashed+área / badge sólido+label | PASS |
| C · influencia / momento / error | IL/M ΔE 72.98 | IL/M ΔE 2.71 + patrón | IL/M ΔE 74.00 | IL/M ΔE 70.33 | dashed / continuous+label / icono+texto | PASS |

Transformaciones de referencia:

- Grupo A grayscale: `#929292 / #7C7C7C / #6D6D6D`; deuteranopia: `#918D7D / #887A1E / #746A3B`; protanopia: `#A19978 / #917F00 / #7E7130`.
- Grupo B grayscale: `#8C8C8C / #7A7A7A`; deuteranopia: `#7E92C6 / #7F828C`; protanopia: `#5680CC / #5B6B91`.
- Grupo C grayscale: `#8C8C8C / #858585 / #727272`; deuteranopia: `#7E92C6 / #A19241 / #8F7F1F`; protanopia: `#5680CC / #796F44 / #655A25`.

Veredictos: **success MOVED** de `#2F9A2A` a `#2D7C36` para conservar separación en el grupo A y cumplir el suelo común; **Aula UNCHANGED** en `#C94A8F` porque el grupo B conserva separación numérica y anatómica.

## Evidencia visual

Las capturas reproducibles están en `validation/cri-91/evidence/`:

- `brandbook-day-expanded.png` y `brandbook-night-expanded.png` — Brandbook legible en ambos temas.
- `brandbook-compact-color.png` — composición Compact sin overflow.
- `cvd-evidence-day.png` — grupos A/B/C y cuatro modos perceptuales.
- `component-lab-day-expanded.png`, `component-lab-night-expanded.png` y `component-lab-compact.png` — autoridad real del sistema en tres composiciones.
- `engineering-day.png` y `engineering-night.png` — cortante V con canto+área lima, influencia con canto medido+área fucsia y patrón discontinuo, momento y deformada continuos.

Resultado Playwright: **PASS** — cero overflow horizontal; focus-visible separado del canto y sin glow/elevación; selection con trazo+relleno suave; cuatro niveles de grafito distinguibles; sin negro puro ni halo verde ambiental; reduced-motion colapsado; influencia dashed y deformada continuous.

## Riesgos diferidos

- La aplicación de esta autoridad a superficies de producto pertenece a slices posteriores; CRI-91 no modifica `src/features/**`.
- La prueba literal de lint puede atravesar directorios locales no versionados ajenos al slice. El resultado suplementario sobre fuente versionada se registra en el reporte de cambio sin modificar la configuración.
