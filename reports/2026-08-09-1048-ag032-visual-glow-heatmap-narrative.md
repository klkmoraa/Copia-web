# AG-032 · Mejoras Visuales y UX: Glow Selection, Heatmap Mode e Inspector Narrativo

**Fecha:** 2026-08-09 10:48  
**Agente:** Antigravity (Gemini 3.6 Flash / Pair Programming)  
**Rama:** main  
**Alcance:** UI/UX & Presentación visual (P3 Glow Selection, P6 Heatmap Mode, P5 Inspector Narrativo) — NO motor matemático

---

## ¿Qué cambió?

Implementación de las 3 mejoras clave de alta prioridad aprobadas en el plan de diseño:

### 1. P3 · Glow Selection (Aura Pulsante y Enfoque Visual)
- **Animaciones CSS:** Keyframes `@keyframes glow-pulse-member` y `@keyframes glow-pulse-node` que aplican un resplandor pulsante suave con `drop-shadow` sobre los elementos seleccionados (`.member-object.selected .member-line` y `.node-object.selected .node-dot`).
- **Enfoque cinematográfico:** Al seleccionar un elemento en el lienzo, los demás elementos no seleccionados reducen su opacidad a 0.42 con una transición suave (`.member-layer:has(...)`, `.node-layer:has(...)`), permitiendo centrar la atención en el objeto activo.
- **Entrada del Inspector:** Micro-animación fluida de deslizamiento `inspector-slide-in` al abrir o cambiar la selección.
- **Accesibilidad:** Respeta `@media (prefers-reduced-motion: reduce)`.

### 2. P6 · Heatmap Mode (Mapa de Calor de Demanda Estructural $\eta$)
- **Nueva capa de editor:** Se incorporó `'heatmap'` en `editorLayers.ts` (desactivada por defecto).
- **Cálculo de demanda en presentación:** `StructuralCanvas.tsx` deriva en tiempo de renderizado un mapa `heatmapRatios` con el ratio de demanda $\eta = (\sigma_{axial} + \sigma_{flector}) / f_y$ para cada miembro estructural a partir de los resultados de análisis disponibles (sin mutar el modelo ni tocar el solver).
- **Renderizado cromático en geometría:** `CanvasGeometryLayer.tsx` tiñe las barras con una escala térmica continua:
  - $\eta < 0.30$: Verde seguro (`#22c55e`)
  - $0.30 \le \eta < 0.60$: Lima bajo (`#84cc16`)
  - $0.60 \le \eta < 0.85$: Ámbar moderado (`#f59e0b`)
  - $0.85 \le \eta < 1.00$: Naranja advertencia (`#f97316`)
  - $\eta \ge 1.00$: Rojo crítico (`#ef4444`)
- **Toggle en CanvasChrome:** Botón interactivo `Heatmap` con icono de llama (`Flame`) en la barra de estado del lienzo, visible únicamente cuando existen resultados de análisis disponibles.

### 3. P5 · Inspector Narrativo (`MemberNarrativeCard`)
- **Diagnóstico en lenguaje natural:** Al seleccionar una barra con análisis resuelto, el Inspector muestra una tarjeta interactiva que describe en lenguaje claro y accesible:
  - Modo de trabajo dominante (Flexión / Axial / Combinado) con desglose porcentual.
  - Valores máximos formateados con la estricta política numérica centralizada (`formatFixed`).
  - Utilización elástica estimada frente a la capacidad elástica.
  - Juicio cualitativo de régimen (Seguro / Carga elevada / Sobre-esforzado).
- **Barra de utilización visual:** Barra de progreso estilizada con indicador del umbral del 85% y paleta semántica.
- **Bilingüe:** Soporte completo en Español e Inglés.

---

## Archivos tocados
- `src/features/canvas/editorLayers.ts` (Modificado — añadida capa `heatmap`)
- `src/features/canvas/CanvasGeometryLayer.tsx` (Modificado — soporte de gradiente térmico de barras)
- `src/features/canvas/CanvasChrome.tsx` (Modificado — toggle de Heatmap con icono `Flame`)
- `src/features/canvas/CanvasChrome.test.tsx` (Modificado — actualizado con prop `hasAnalysis`)
- `src/features/canvas/StructuralCanvas.tsx` (Modificado — computación reactiva de `heatmapRatios` y paso de props)
- `src/features/inspector/InspectorProperties.tsx` (Modificado — componente `MemberNarrativeCard`)
- `src/styles.css` (Modificado — estilos y keyframes para Glow Selection, Heatmap toggle y Narrative Card)
- `reports/2026-08-09-1048-ag032-visual-glow-heatmap-narrative.md` (Creado)

---

## Verificación

```powershell
npm.cmd run build
# Resultado: ✓ built in 5.80s (TypeScript y Vite production bundle limpios)

npm.cmd test -- --run src/features/canvas/CanvasChrome.test.tsx src/features/inspector/Inspector.test.tsx src/utils/numericPolicy.test.ts
# Resultado: 32/32 tests ✅

node scripts/check-protected-baseline.mjs
# Resultado: Frontera protegida intacta: 29 archivos verificados ✅
```

---

## Motor matemático
**Intacto e inviolable**: 29 de 29 archivos del núcleo matemático verificados con SHA-256 idénticos.
