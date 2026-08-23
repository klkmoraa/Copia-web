# Evidencia · La Cinta deja de pintarse encima de sí misma

**Ejecutado:** 2026-08-23 · Chromium real (`/opt/pw-browsers/chromium`) sobre el
`dist/` de producción servido por `vite preview`, `deviceScaleFactor: 2`.
**Clasificación:** `AUDIT/TEMPORARY` — ver [reports/README.md](../../README.md).

Recorte de la barra superior a todo el ancho del viewport. Modelo: `Pórtico de
ejemplo`. Las capturas `0-antes-*` se tomaron con el mismo script sobre el CSS
publicado (`3ac3885`), sin ningún otro cambio en el árbol.

| Captura | Qué enseña |
|---|---|
| `0-antes-390.png` | El defecto. «P.» con la flecha de deshacer pintada encima y el galón encima de rehacer. |
| `1-cinta-390.png` | Después. El historial se fue a «Más acciones», el grupo vacío y su filete huérfano también, y el nombre pasa de 32 px superpuestos a 53 px limpios: «Pórti…». |
| `2-cinta-390-dark.png` | Lo mismo en Noche. |
| `3-cinta-430.png` | 430 px: el nombre gana hasta 93 px. |
| `0-antes-900-menu-historial-duplicado.png` | El otro defecto de la misma causa: a 900 px deshacer y rehacer estaban **a la vez** en la Cinta y en «Más acciones». |
| `6-menu-900-sin-historial.png` | Después: a 900 px el historial vive sólo en la Cinta, y el menú ya no lo repite. |
| `4-cinta-900.png` | La Cinta a 900 px conserva sus cuatro grupos y sus separadores: nada cambia por encima de 700 px salvo el duplicado que se va. |
| `5-cinta-1536.png` | Escritorio, sin cambios. |

## Lo que dicen los números

Barrido de 18 anchos entre 1536 y 360 px (`out.metrics.topbarSweep` en
`qa-artifacts/qa-results.json`): **0 colisiones**. Antes del arreglo, colisiones
reales a 500, 460, 430, 390, 375 y 360 px.

---

## Segunda ronda · lo que quedaba medido y sin arreglar

Las dos condiciones que la primera ronda dejó anotadas ya no están.

| Captura | Qué enseña |
|---|---|
| `a-cinta-320.png` | 320 px, el último piso. La marca cede su sitio —es identidad, no capacidad— y las tres zonas caben sin tocarse. |
| `b-menu-320-ir-al-inicio.png` | Su capacidad no se pierde: «Ir al inicio» encabeza el menú del proyecto, que cuelga del galón que sustituye a la marca. Por encima de 360 px esta entrada no existe. |
| `c-cinta-1024.png` | 1024 px. «Analizar» ya no se sale de su celda: cede el nombre del proyecto, que es el orden que CRI-95 declara. |
| `d-cinta-1300.png` | 1300 px, el otro tramo donde desbordaba. |

Barrido ampliado a **22 anchos** entre 1536 y 320 px, con 361 y 360 a los dos
lados del umbral: **0 colisiones y 0 desbordes de celda**.
