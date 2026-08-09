# AG-023 · Reporte de Cambios (Capas de Información 2.0 & Suite Multi-Dispositivo)
**Fecha:** 2026-08-09 03:30  
**Agente:** Antigravity (Gemini)  
**Rama:** main  
**Alcance:** Capas de Información 2.0 / Presets de Visualización / Hotkeys 1-8 / Suite PC y Tablet — NO motor matemático

---

## ¿Qué cambió?

Se desarrolló e integró la **Suite de Capas de Información 2.0** (`CanvasLayers.tsx`) y optimizaciones multi-dispositivo para PC, Tablet y Móvil:

1. **🗂️ Presets de Visualización Instantáneos**:
   - Barra superior de accesos rápidos para conmutar el modelo según la tarea:
     - `Todas`: Restablece la visibilidad de todas las capas.
     - `Modelo`: Muestra únicamente Geometría + IDs (modo modelado puro).
     - `Cargas`: Geometría + Cargas aplicadas + Cotas técnicas.
     - `Resultados`: Geometría + Diagramas N/V/M + Diagnóstico.
     - `Limpio`: Geometría + Cotas, sin etiquetas ni ayudas visuales (ideal para capturas).

2. **⌨️ Atajos Numéricos de Teclado (1–8)**:
   - Presionar teclas del `1` al `8` conmuta directamente la capa correspondiente (`1`: Modelo, `2`: Cargas, `3`: Cotas, `4`: IDs, `5`: Resultados, `6`: Etiquetas, `7`: Ayudas, `8`: Diagnósticos).
   - Keycaps visuales estilizados con biselado Clay 3D.

3. **🎨 Código Cromático de Identidad Brandbook**:
   - Iconografía diferenciada por color de marca: Azul Cyan (Modelo), Naranja (Cargas), Púrpura (Cotas), Verde Esmeralda (Resultados), Rojo/Coral (Diagnóstico).

4. **📱/🖥️ Ergonomía Multi-Dispositivo (PC & Tablet)**:
   - Panel de capas con ancho adaptativo `min(380px, calc(100vw - 28px))`, desenfoque de cristal `backdrop-filter: blur(16px)` y sombras Clay flotantes.
   - Ancho del inspector optimizado a `320px` en tablets en orientación horizontal (Landscape).

5. **🧪 Suite de Pruebas**:
   - `CanvasLayers.test.tsx` (4 tests pasando al 100%, incluyendo presets y hotkeys).
   - `CanvasChrome.test.tsx` (100% pasando).

---

## Archivos tocados
- `src/features/canvas/CanvasLayers.tsx` (Modificado)
- `src/features/canvas/CanvasLayers.test.tsx` (Modificado)
- `src/styles.css` (Modificado)
- `reports/2026-08-09-0330-ag023-canvas-layers-2-multi-device-suite.md` (Creado)
- `reports/ui-improvements/2026-08-09-0330-ag023-canvas-layers-2-multi-device-suite.md` (Creado)

---

## Verificación
```powershell
npm.cmd test -- --run src/features/canvas/CanvasLayers.test.tsx src/features/canvas/CanvasChrome.test.tsx
node scripts/check-protected-baseline.mjs
```
- **Línea base matemática**: 29 de 29 archivos verificados intactos con SHA-256.
