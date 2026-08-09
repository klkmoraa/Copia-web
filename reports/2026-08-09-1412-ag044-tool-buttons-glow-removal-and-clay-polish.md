# AG-044 · Eliminación de Haz de Luz / Halos de Vidrio en Botones de Herramienta

**Fecha:** 2026-08-09 14:12  
**Agente:** Antigravity (Gemini 3.6 Flash / Pair Programming)  
**Rama:** main  
**Alcance:** Eliminación del haz de luz/glow cian tipo vidrio en los botones de herramienta activos (`.tool-button.active`), sustitución por botones táctiles sobrios de arcilla/claymorphism y prevención de cortes de texto — NO motor matemático

---

## ¿Qué cambió?

### 1. Eliminación del Haz de Luz ("Glow / Glass Ring")
- **Diagnóstico:** Existía una regla heredada `.tool-button.active { box-shadow: ..., 0 4px 10px color-mix(in srgb, var(--tool-color) 28%, transparent), inset 0 1.5px 0 rgba(255,255,255,.38); border-color: color-mix(in srgb, var(--tool-color) 40%, white); }` que generaba un resplandor cian brillante y un filete de luz blanca interior similar a un vidrio iluminado por LED.
- **Implementación:**
  - Se eliminó el resplandor y halo de luz en cascada.
  - Se implementó el estado activo de herramienta como una tecla táctil de arcilla elevada sobre superficie sólida (`background: var(--sc-color-surface-elevated); color: var(--sc-color-action-primary); border-color: var(--sc-color-border-soft); box-shadow: var(--sc-shadow-clay-xs); font-weight: 750;`).
  - La etiqueta de teclado (kbd) se integró limpiamente con tinte de marca suave sin deslumbrar.

### 2. Formato y Legibilidad de Texto
- Alineación interna optimizada de iconos ($17\times 17\text{px}$) y etiquetas de herramienta con `text-overflow: ellipsis`, eliminando cortes toscos y asegurando una presentación limpia y legible.

---

## Archivos tocados
- `src/styles.css` (Modificado — Eliminado haz de luz y refinada la tecla táctil clay)
- `reports/2026-08-09-1412-ag044-tool-buttons-glow-removal-and-clay-polish.md` (Creado)

---

## Verificación

```powershell
npm.cmd test -- --run src/design-system/tokens.test.ts src/features/topbar/TopBar.test.tsx src/features/results/ResultsPanel.test.tsx src/features/inspector/Inspector.test.tsx src/features/canvas/ToolBar.test.tsx src/features/workspace/AppShellLayout.test.tsx
# Resultado: 88/88 tests pasaron ✅

npm.cmd run build
# Resultado: ✓ built in 2.14s (TypeScript & Vite limpios)

node scripts/check-protected-baseline.mjs
# Resultado: Frontera protegida intacta: 29 archivos verificados ✅
```

---

## Motor matemático
**Intacto e inviolable**: 29 de 29 archivos verificados con SHA-256 idéntico.
