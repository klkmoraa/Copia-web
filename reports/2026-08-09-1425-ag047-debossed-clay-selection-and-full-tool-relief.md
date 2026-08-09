# AG-047 · Selección Rehundida Clay (Cavidad Táctil) y Homogeneización de Relieve en Todas las Herramientas

**Fecha:** 2026-08-09 14:25  
**Agente:** Antigravity (Gemini 3.6 Flash / Pair Programming)  
**Rama:** main  
**Alcance:** Efecto de tecla de arcilla rehundida/hundida (`--sc-shadow-clay-pressed` y `--sc-color-surface-inset`) al seleccionar herramienta, eliminación de cualquier rastro residual de vidrio en `ui.css`, y relieve homogéneo en el 100% de los botones del carril — NO motor matemático

---

## ¿Qué cambió?

### 1. 🕳️ Selección de Herramienta: Efecto Rehundido en Cavidad de Arcilla
- **Diagnóstico:** El usuario solicitó que al seleccionar una herramienta, la tecla se hunda físicamente en la superficie de arcilla siguiendo las cavidades del Brandbook, eliminando cualquier aspecto flotante o de vidrio.
- **Implementación:**
  - Se configuró `.tool-button.active`, `.tool-button.is-active` y `.sc-tool-button.is-active`:
    - **Fondo rehundido:** `background: var(--sc-color-surface-inset);` (cavidad física más profunda).
    - **Sombra interior de ranura:** `box-shadow: var(--sc-shadow-clay-pressed);` (`inset 3px 4px 8px rgba(0, 0, 0, 0.46), inset -2px -2px 6px rgba(77, 108, 118, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.04)`).
    - **Desplazamiento háptico:** `transform: translateY(1.5px) scale(0.985);`.
    - **Grabado de color:** Icono, texto y badge `kbd` se iluminan en el verde esmeralda canónico de marca (`var(--sc-color-action-primary)`).
    - **Cero resplandor exterior:** Sin halos cian ni bordes translúcidos.

### 2. 🧱 Homogeneización del Relieve Táctil en Toda la Lista de Herramientas
- Se sincronizó `src/design-system/components/ui.css` y `src/styles.css` para que absolutamente todos los botones (`Seleccionar`, `Desplazar`, `Nodo`, `Miembro`, `Apoyo`, `Cargas`, `Cotas`, `Corte`, `Dividir`, `Eliminar`) compartan:
  - Tarjeta de arcilla en reposo con relieve volumétrico de 4 capas.
  - Elevación en hover (`translateY(-1.5px)` y `var(--sc-shadow-clay-sm)`).
  - Hundimiento en selección activa (`translateY(1.5px)` y `var(--sc-shadow-clay-pressed)`).

---

## Archivos tocados
- `src/design-system/components/ui.css` (Modificado — Botones de herramienta con estados clay y rehundido activo)
- `src/styles.css` (Modificado — Estilos consolidados de cavidad rehundida y espaciado de grupos)
- `reports/2026-08-09-1425-ag047-debossed-clay-selection-and-full-tool-relief.md` (Creado)

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
