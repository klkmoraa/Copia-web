# AG-030 · Reporte de Redistribución Espacial Anti-Colisiones (PC y Móvil)
**Fecha:** 2026-08-09 05:33  
**Agente:** Antigravity (Gemini)  
**Alcance:** Eliminación total de solapamientos y colisiones entre componentes flotantes en PC (Escritorio) y Móvil (Teléfonos).

---

## ¿Qué colisiones se eliminaron?

### 1. 🖥️ En PC (Escritorio):
- **Esquina Superior Derecha Despejada**:
  - Antes: El Minimapa Radar, el botón de Capas (`Layers`) y los chips SNAP/GRID estaban colocados en `top: 14px; right: 14px;`, montándose unos sobre otros.
  - Ahora:
    - **Botón de Capas**: Ubicado en `top: 14px; right: 14px;` (botón circular limpio de 38px).
    - **Minimapa Radar**: Reubicado en la esquina inferior derecha (`bottom: 58px; right: 14px;`), justo encima de los controles de zoom como en las mejores herramientas CAD/GIS.
    - **Chips SNAP/GRID**: Reubicados en la esquina inferior izquierda (`bottom: 12px; left: 12px;`) con fondo glassmorphic suave.
- **Esquina Superior Izquierda y Leyendas**:
  - El badge de modo se mantiene en `top: 14px; left: 14px;`, y las leyendas de resultados de cortante/momento se apilan debajo en `top: 56px; left: 14px;` sin solapamiento.
- **Centro Inferior**:
  - La pastilla de coordenadas X/Y y escala se centra matemáticamente en `bottom: 12px; left: 50%; transform: translateX(-50%);`.

### 2. 📱 En Móvil (Teléfono):
- **Barra de Herramientas Acoplada Limpia**: Dock inferior a todo el ancho con 6 botones en cuadrícula equitativa y etiquetas completas.
- **Lienzo Táctil 100% Despejado**: Minimapa y chips ocultos en pantallas estrechas para dar máxima visibilidad.
- **Controles de Cámara y FAB del Inspector**:
  - Zoom vertical a la izquierda (`bottom: 68px; left: 12px;`).
  - FAB del Inspector a la derecha (`bottom: 68px; right: 12px;`).

---

## Verificación
- `npm.cmd test -- --run src/design-system/tokens.test.ts` (22/22 pasados).
- `npm.cmd run build` (Compilado en 5.65s).
- `node scripts/check-protected-baseline.mjs` (29/29 intactos).
