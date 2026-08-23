# Evidencia · El pie legal fuera del shell

**Ejecutado:** 2026-08-23 · Chromium real sobre el `dist/` de producción.
**Clasificación:** `AUDIT/TEMPORARY` — ver [reports/README.md](../../README.md).

| Captura | Qué enseña |
|---|---|
| `1-mesa-sin-pie.png` | La Mesa sin la banda del aviso. El lienzo llega al borde inferior de la ventana. |
| `2-aviso-en-utilidades.png` | El aviso, entero, al pie del menú de utilidades: alcanzable en un gesto y sin cobrarle alto al lienzo. |

## La medición

Mismo encuadre (1600×950) y mismo modelo antes y después:

| | Alto de `.canvas-host` |
|---|---|
| Antes | 876 px |
| Después | **898 px** |

Los 22 px que la banda cobraba en **cada pantalla y en las tres composiciones**
vuelven al dibujo.

## Lo que esto mueve, y que no es cosmético

`CHROME.footerWide` pasa de 22 a 0, y `wideStageHeight` lo resta del escenario: **la
frontera calculada X2↔M1 se mueve**. A 768 px de alto baja de 1117 a 1073 px, así que un
portátil de 1100 px de ancho que antes se quedaba en Medium ahora entra en Expanded, con
su riel etiquetado y su panel acoplado. La tabla de `expandedBoundaryWidth` está
recalculada contra el modelo, no ajustada a mano.

## Dónde sigue el aviso

Entrada del producto (`welcome.footer`), memoria de cálculo PDF, y el menú de utilidades
de la captura `2`. `app.professionalNote` no se borra de ningún idioma.
