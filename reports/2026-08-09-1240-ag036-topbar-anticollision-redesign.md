# AG-036 · Rediseño Integral Anti-Colisión y Estabilidad de TopBar

**Fecha:** 2026-08-09 12:40  
**Agente:** Antigravity (Gemini 3.6 Flash / Pair Programming)  
**Rama:** main  
**Alcance:** UI/UX de TopBar, eliminación de problemas de superposición / colisión entre zonas, diseño del botón de comandos, menús popovers táctiles y media queries progresivas — NO motor matemático

---

## ¿Qué cambió?

### 1. Sistema de Grid Flexible y Zonas sin Desbordamiento
- **Grid proporcional anti-colisión:** Se reconfiguró el layout de `.topbar` en `styles.css` con `grid-template-columns: minmax(0, 1.2fr) auto minmax(0, 1.5fr); gap: var(--sc-space-3);`, garantizando que ninguna zona colisione ni se monte sobre otra independientemente del ancho de ventana.
- **Truncado de nombre de proyecto:** Se limitó el ancho del `input` de nombre a `min(180px, 16vw)` con `text-overflow: ellipsis`, protegiendo la identidad de marca (`.brand-name`, `.brand-mark`) y el badge de autosave (`.autosave-state`).

### 2. Estilo Brandbook del Botón de Búsqueda de Comandos (`.topbar-search-btn`)
- Se implementó el componente visual `.topbar-search-btn` con relieve claymorphic suave (`var(--sc-color-surface-1)`, `var(--sc-color-border-soft)`, `box-shadow: var(--sc-shadow-clay-xs)`), micro-keycap para `Ctrl K` y transición elástica en hover.
- **Colapso inteligente:** En pantallas menores a $1536\text{px}$, el botón se contrae a un botón de icono compacto de $36\text{px}$ sin texto ni kbd, ahorrando más de $80\text{px}$ de ancho en la barra superior.

### 3. Popovers Flotantes Anclados con Backdrop y Z-Index Canónico
- **Anclaje seguro:** Se asignó `position: relative` a `.mobile-actions-wrap` y `.export-wrap`, permitiendo que `.mobile-actions-menu` y `.export-menu` se anclen exactamente con `right: 0; left: auto; top: calc(100% + 6px);` sin salirse de pantalla ni superponerse sobre la barra de herramientas.
- **Secciones de menú limpias:** Se estilaron `.menu-section`, `.menu-section-title` y `.mobile-menu-field` para los controles desbordados (casos de carga, modo de cálculo, unidades, tema, exportación y vistas).

### 4. Breakpoints Progresivos sin Solapamientos
- **$\le 1536\text{px}$:** Botón de comandos se compacta a icono; `.units-select` se oculta de la zona central (disponible en menú Más).
- **$\le 1360\text{px}$:** `.analysis-order-select` se oculta de la zona central; `.autosave-state` colapsa a modo solo icono; `.analyze-button` se ajusta a $108\text{px}$.
- **$\le 1200\text{px}$:** `.combination-select`, controles de historial (Deshacer/Rehacer) y botón Exportar se trasladan fluidamente al menú Más.
- **$\le 1023\text{px}$ (Tablet/Móvil):** Modo móvil simplificado a 2 columnas con botón Más de $44\times 44\text{px}$ y botón Analizar de icono táctil.

---

## Archivos tocados
- `src/styles.css` (Modificado — rediseño completo de layout de TopBar, popovers y media queries anti-colisión)
- `reports/2026-08-09-1240-ag036-topbar-anticollision-redesign.md` (Creado)

---

## Verificación

```powershell
npm.cmd test -- --run src/design-system/tokens.test.ts src/features/topbar/TopBar.test.tsx src/App.test.tsx
# Resultado: 38/38 tests de topbar & tokens pasaron, 15/15 tests de App shell pasaron ✅

npm.cmd run build
# Resultado: ✓ built in 2.11s (TypeScript & Vite limpios)

node scripts/check-protected-baseline.mjs
# Resultado: Frontera protegida intacta: 29 archivos verificados ✅
```

---

## Motor matemático
**Intacto e inviolable**: 29 de 29 archivos verificados con SHA-256 idéntico.
