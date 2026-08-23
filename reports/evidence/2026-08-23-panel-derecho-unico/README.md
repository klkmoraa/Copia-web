# Evidencia · Un solo panel derecho (Detalle · Cargas · Vista)

**Ejecutado:** 2026-08-23 · Chromium real (`/opt/pw-browsers/chromium`) sobre el
`dist/` de producción servido por `vite preview`.
**Clasificación:** `AUDIT/TEMPORARY` — ver [reports/README.md](../../README.md).

Encuadre 1600×950 en escritorio, igual que las tres fases anteriores, para poder
comparar una contra otra. Modelo: `Pórtico de ejemplo`.

| Captura | Qué enseña |
|---|---|
| `1-panel-detalle-light.png` | El panel derecho con sus tres segmentos en una sola cabecera. El pie del riel de herramientas ya no lleva los tres lanzadores; el icono de Resultados entra en la barra superior. |
| `1-panel-detalle-dark.png` | Lo mismo en Noche. |
| `2-panel-cargas.png` | Segmento Cargas. Era la superficie `analysisSetup` del broker; ahora se conmuta dentro del panel sin competir por sitio. |
| `3-panel-vista.png` | Segmento Vista. Era la superficie `view`. |
| `4-panel-con-seleccion.png` | Seleccionar en el lienzo trae el panel al segmento de detalle, que es lo que el tablist llevaba escrito y nadie ejecutaba. |
| `5-lanzador-unico-resultados.png` | Resultados abierto desde su único lanzador, el de la barra superior. |
| `6-k0-hoja-con-segmentos.png` | K0 táctil, 390×844: la hoja inferior con los tres segmentos y **un** botón flotante. |

## Antes / después de la duplicación

La línea base (`ea1f548`, capturada con el mismo script antes de empezar) enseña
en K0 la pastilla flotante con **tres** botones —Cargas · Vista · Resultados—
solapando el aviso del Model Doctor. Esos tres botones duplicaban el pie del riel
en X2/M1 y los propios segmentos del panel. En `6-k0-hoja-con-segmentos.png`
queda uno.

## Un defecto preexistente que estas capturas dejan a la vista

En K0 a 390 px la barra superior se superpone consigo misma: «P…» encima de
deshacer y el galón encima de rehacer. **No lo introduce este cambio** — se
capturó idéntico sobre la línea base antes de tocar nada. Sus tres zonas suman
~405 px de contenido mínimo en 374 px útiles, y `topbar-status-zone` tiene
`min-width:max-content` por contrato (CRI-95, «nunca cede su ancho»), así que lo
que desborda es la marca. Arreglarlo exige decidir quién cede a ese ancho, no una
línea de CSS; queda anotado como trabajo propio.

Lo que sí introdujo este cambio y quedó corregido antes de cerrar: el icono nuevo
de Resultados no estaba en la lista de los que ceden sitio bajo 700 px, y a 390 px
no se recortaba, se pintaba **encima de la marca**. Ahora degrada con sus
hermanos y sigue entero en «Más acciones».
