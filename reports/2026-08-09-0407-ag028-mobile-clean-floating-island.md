# AG-028 · Reporte de Limpieza Visual (Píldora Flotante Compacta & Despeje del Lienzo Móvil)
**Fecha:** 2026-08-09 04:07  
**Agente:** Antigravity (Gemini)  
**Alcance:** Eliminación de textos amontonados en la barra de herramientas móvil y resolución de todas las colisiones entre controles de cámara, minimapa, coordenadas y capas.

---

## ¿Qué se corrigió?

1. **✨ Píldora Flotante Compacta y Limpia (Estilo Navegador / Figma)**:
   - Se eliminaron las etiquetas de texto cortadas (`Selec...`, `Mie...`, etc.) debajo de los iconos.
   - La píldora inferior ahora es un dock flotante esbelto (`height: 44px`), centrado, con esquinas redondeadas (`999px`), efecto glassmorphic y botones circulares limpios de 38px con solo su icono.

2. **🚫 Eliminación de Colisiones en el Lienzo**:
   - **Esquina Superior Derecha**: Se ocultó el minimapa y los chips de SNAP/GRID en teléfono para que no tapen el botón de Capas (`.canvas-layers-trigger`), dejándolo libre y accesible en `top: 56px; right: 12px;`.
   - **Esquina Superior Izquierda**: La píldora de coordenadas se movió a `top: 56px; left: 12px;` y los controles de zoom se agruparon en una mini-pastilla vertical elegante (`left: 12px; top: 88px;`), eliminando la barra horizontal gigante que cruzaba la pantalla.
   - **Despeje Inferior**: La barra de herramientas ya no se solapa con las coordenadas ni con el botón del Inspector (FAB circular ubicado en la esquina derecha a 44px).

---

## Verificación
- `npm.cmd test -- --run src/design-system/tokens.test.ts` (22/22 pasados).
- `npm.cmd run build` (Compilación limpia en 2.06s).
- `node scripts/check-protected-baseline.mjs` (29/29 intactos).
