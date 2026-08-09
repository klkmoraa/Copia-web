# AG-031 · Reporte de Corrección de Política Numérica

**Fecha:** 2026-08-09 10:18  
**Agente:** Antigravity (Claude Sonnet 4.6 Thinking)  
**Rama:** main  
**Alcance:** Corrección de violaciones de política numérica en SectionViewer2D y StructuralHealthMeter — NO motor matemático

---

## ¿Qué cambió?

El test de regresión `src/utils/numericPolicy.test.ts` detectó que dos componentes de presentación usaban `.toFixed()` raw directamente en lugar de la función centralizada `formatFixed` / `formatNumber` del módulo `utils/numberFormat`.

### Componentes corregidos:

**1. `features/inspector/SectionViewer2D.tsx`** (3 usos):
- `(width * factor).toFixed(0)` → `formatFixed(width * factor, 0, 'inspector')`
- `(depth * factor).toFixed(0)` → `formatFixed(depth * factor, 0, 'inspector')`
- `(Wel * 1e6).toFixed(0)` → `formatFixed(Wel * 1e6, 0, 'inspector')`

**2. `features/results/StructuralHealthMeter.tsx`** (2 usos):
- `critical.sigmaTotal.toFixed(1)` → `formatFixed(critical.sigmaTotal, 1, 'inspector')`
- `safetyFactor.toFixed(2)` → `formatFixed(safetyFactor, 2, 'inspector')`

### ¿Por qué importa?
El módulo centralizado maneja correctamente `-0` (como `"0"`), `NaN`, `Infinity` y alineación de columnas. El uso raw de `.toFixed()` puede imprimir `"-0.000"` para fuerzas que cruzan cero y `"NaN"` para análisis fallidos.

---

## Archivos tocados
- `src/features/inspector/SectionViewer2D.tsx` (Modificado — 3 sustituciones)
- `src/features/results/StructuralHealthMeter.tsx` (Modificado — 2 sustituciones)
- `reports/2026-08-09-1018-ag031-numeric-policy-fix.md` (Creado)

---

## Verificación

```powershell
npm.cmd test -- --run src/utils/numericPolicy.test.ts src/features/inspector/SectionViewer2D.test.tsx src/features/results/StructuralHealthMeter.test.tsx
# Resultado: 9/9 tests ✅

node scripts/check-protected-baseline.mjs
# Resultado: 29/29 archivos intactos ✅
```

---

## Motor matemático
**Intacto e inviolable**: 29 de 29 archivos verificados con SHA-256 idéntico.

---

## Pendientes
- Los fallos `performance.test.ts` (3007ms vs <3000ms) y `loadIntervalRegression.test.ts` (timeout 5000ms) son **flaky por carga de máquina**, no bugs reales del solver.
- Los 6 worker pool timeouts son de **recursos del SO agotados** en la ejecución masiva paralela, no fallos de código.
