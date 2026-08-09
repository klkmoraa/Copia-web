# AG-029 · Reporte de Restauración de Barra de Herramientas Móvil Acoplada
**Fecha:** 2026-08-09 04:11  
**Agente:** Antigravity (Gemini)  
**Alcance:** Restauración de la barra de herramientas inferior acoplada a todo el ancho (`.toolbar`) con una cuadrícula de 6 botones perfectamente distribuidos y legibles.

---

## ¿Qué se implementó?
1. **Restauración de la Barra Inferior Completa (`Docked Toolbar`)**:
   - Se eliminó la píldora flotante reducida para volver a la barra acoplada inferior a todo el ancho (`bottom: 0; left: 0; right: 0`).
   - Radio superior ergonómico (`border-radius: 16px 16px 0 0`) con sombra suave y altura adaptada a `safe-area-inset-bottom`.

2. **Distribución Equitativa de las 6 Herramientas (`.mobile-tool-dock`)**:
   - `grid-template-columns: repeat(6, 1fr)` con espaciado uniforme.
   - Cada botón (`.tool-button`):
     - Icono centrado arriba (`20px`).
     - Texto de herramienta legible y sin cortes (`Seleccionar`, `Nodo`, `Miembro`, `Apoyo`, `Carga`, `Más`) con micro-tipografía táctil de `9px`.
     - Indicador de selección activa integrado (`active`).

3. **Despeje Total del Lienzo**:
   - Coordenadas y controles de cámara reubicados en la esquina superior izquierda.
   - Botón de capas en la esquina superior derecha.
   - Botón de inspector flotante ubicado por encima del dock a la derecha (`bottom: 68px`).

---

## Verificación
- `npm.cmd test -- --run src/design-system/tokens.test.ts` (22/22 pasados).
- `npm.cmd run build` (Compilado en 2.83s).
- `node scripts/check-protected-baseline.mjs` (29/29 intactos).
