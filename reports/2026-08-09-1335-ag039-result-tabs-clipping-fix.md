# AG-039 · Eliminación Definitiva de Recortes Verticales en Pestañas del Panel de Resultados

**Fecha:** 2026-08-09 13:35  
**Agente:** Antigravity (Gemini 3.6 Flash / Pair Programming)  
**Rama:** main  
**Alcance:** Corrección de la maquetación de familias y pestañas de resultados (Result Tabs / Families), eliminación de cortes verticales y garantía de visibilidad al 100% sin scrolls anidados — NO motor matemático

---

## ¿Qué cambió?

### 1. Eliminación de Reglas CSS Heredadas que Forzaban Grid de 2 Filas
- **Diagnóstico:** En `styles.css` (antigua línea 4552), existía una regla heredada `.result-tab-family { display: grid; grid-template-rows: 17px minmax(0, 1fr); }` que sobreescribía la maquetación flex e intentaba apilar la etiqueta de familia sobre los botones dentro de una barra de altura fija ($52\text{px}$ / $60\text{px}$). Esto provocaba que los botones quedaran cortados por la mitad en vertical (solo visibles los primeros $3\text{px}$ superiores).
- **Implementación:**
  - Se eliminaron las reglas conflictivas heredadas en cascada.
  - Se unificó `.result-tab-family` como píldora horizontal cohesiva (`display: inline-flex; align-items: center; gap: 4px; padding: 3px 5px; height: 38px; border-radius: var(--sc-radius-md); background: var(--sc-color-surface-inset);`).
  - Botones de subpestaña `.result-tabs button` calibrados a `height: 32px;` con centrado vertical perfecto y visibilidad íntegra de texto, borde y estado activo.

---

## Archivos tocados
- `src/styles.css` (Modificado — Eliminadas reglas conflictivas heredadas de `.result-tab-family`)
- `reports/2026-08-09-1335-ag039-result-tabs-clipping-fix.md` (Creado)

---

## Verificación

```powershell
npm.cmd test -- --run src/features/results/ResultsPanel.test.tsx src/features/workspace/AppShellLayout.test.tsx src/design-system/tokens.test.ts
# Resultado: 43/43 tests pasaron ✅

npm.cmd run build
# Resultado: ✓ built in 2.13s (TypeScript & Vite limpios)

node scripts/check-protected-baseline.mjs
# Resultado: Frontera protegida intacta: 29 archivos verificados ✅
```

---

## Motor matemático
**Intacto e inviolable**: 29 de 29 archivos verificados con SHA-256 idéntico.
