# AG-038 · Reestructuración Integral de UX Móvil: Hojas Táctiles, Tool Dock y Resultados

**Fecha:** 2026-08-09 13:05  
**Agente:** Antigravity (Gemini 3.6 Flash / Pair Programming)  
**Rama:** main  
**Alcance:** Experiencia móvil integral (Mobile UX), maquetación del Tool Dock inferior, hojas modales de herramientas (Cargas y Más), panel de resultados móvil (Results Bottom Sheet) e Inspector táctil — NO motor matemático

---

## ¿Qué cambió?

### 1. Hojas Modales Táctiles para Herramientas Móviles (`.mobile-tool-palette`, `.mobile-tool-sheet-backdrop`)
- **Diagnóstico:** Los botones de "Cargas" y "Más" en el dock inferior abrían un portal a `document.body` que carecía por completo de reglas CSS de hoja modal, provocando que los botones y menús no se vieran, se cortaran o aparecieran rotos.
- **Implementación:**
  - Se implementó la hoja modal inferior `.mobile-tool-palette` con elevación `var(--sc-shadow-clay-floating)`, esquinas redondeadas tipo hoja (`var(--sc-radius-sheet)`), tirador superior de arrastre (`.mobile-tool-palette-handle`), cabecera con botón cerrar y lista de tarjetas táctiles `.mobile-palette-tool`.
  - Backdrop con desenfoque (`backdrop-filter: blur(6px)`) y animación fluida `sc-sheet-slide-up`.

### 2. Dock de Herramientas Inferior Fijo y Seguro (`.toolbar`, `.mobile-tool-dock`)
- **Diagnóstico:** La barra de herramientas tenía reglas contradictorias (`position: absolute; bottom: 30px` vs `bottom: 0 !important`), colisionando directamente con la barra de resultados y tapando los controles.
- **Implementación:**
  - Se fijó la barra inferior en `position: fixed; z-index: 30; bottom: 0; left: 0; right: 0; height: calc(56px + env(safe-area-inset-bottom));` con soporte para safe area de iOS/Android.
  - Los 6 botones de herramientas (`Seleccionar`, `Nodo`, `Barra`, `Apoyo`, `Cargas`, `Más`) cuentan con altura uniforme de $48\text{px}$, iconos centrados, micro-etiquetas y área táctil accesible $\ge 44\text{px}$.

### 3. Panel de Resultados Móvil como Hoja Flotante Limpia (`.results-panel`, `.results-mobile-toggle`)
- **Diagnóstico:** El botón toggle móvil y el backdrop del panel de resultados no tenían estilos dedicados, superponiéndose o empujando el canvas.
- **Implementación:**
  - Se implementó `.results-mobile-toggle` como barra táctil integrada de $46\text{px}$ con punto temático de esfuerzo (axial, cortante, momento, deformada), label legible y chevron animado.
  - Al expandirse, se eleva suavemente sobre el dock (`bottom: calc(56px + env(safe-area-inset-bottom)); z-index: 32;`) con backdrop interactivo `.results-sheet-backdrop` (`z-index: 31`).
  - Al colapsar (`.mobile-collapsed`), se ocultan los subcomponentes internos para evitar saltos o parpadeos.

### 4. Pestañas e Inspector Móvil sin Recortes (`.inspector-panel.mobile-open`, `.inspector-tabs`)
- **Diagnóstico:** En móvil, `.inspector-tabs` utilizaba una grilla rígida de 3 columnas que comprimía las pestañas y el botón cerrar.
- **Implementación:**
  - Se maquetó como `display: flex; gap: 4px;` con botones elásticos de $36\text{px}$ y botón de cierre táctil de $38\times 38\text{px}$.
  - Jerarquía de `z-index: 48` para garantizar que quede siempre por encima de cualquier otro elemento interactivo.

---

## Archivos tocados
- `src/styles.css` (Modificado — Rediseño completo de layout móvil, hojas de herramientas y panel de resultados)
- `reports/2026-08-09-1305-ag038-mobile-sheets-tool-dock-layout-overhaul.md` (Creado)

---

## Verificación

```powershell
npm.cmd test -- --run src/features/canvas/ToolBar.test.tsx src/features/results/ResultsPanel.test.tsx src/features/inspector/Inspector.test.tsx src/features/workspace/AppShellLayout.test.tsx src/design-system/tokens.test.ts
# Resultado: 75/75 tests pasaron ✅

npm.cmd run build
# Resultado: ✓ built in 2.13s (TypeScript & Vite limpios)

node scripts/check-protected-baseline.mjs
# Resultado: Frontera protegida intacta: 29 archivos verificados ✅
```

---

## Motor matemático
**Intacto e inviolable**: 29 de 29 archivos verificados con SHA-256 idéntico.
