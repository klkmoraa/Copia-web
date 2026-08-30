# Fase 4: presupuesto de rendimiento sin límite duro

**Fecha:** 2026-08-09 15:25
**Agente:** Codex
**Rama:** `main`
**Base:** `4f12d10` (`feat: add experimental 3D viewer and phase 4 pre-RFCs`)

## Qué cambió

Se eliminó el techo bloqueante de carga inicial que comparaba el bundle contra 722 000 bytes / 192 000 gzip. `verify:perf` conserva la medición de bytes y gzip, pero ahora usa límites explícitos `Infinity` y sólo falla si no puede medir el bundle.

La matriz de gates y el diseño de Fase 4 fueron actualizados para describir este estado como `PASA INFORMATIVO`: la métrica queda visible para detectar deriva, pero no limita el presupuesto de implementación.

## Por qué

El usuario pidió un límite indefinido porque el techo estaba restringiendo el presupuesto disponible para implementar. Se mantiene la observabilidad para que eliminar el bloqueo no oculte el costo real del bundle.

## Archivos tocados

- `scripts/check-performance-budget.mjs` — elimina los techos finitos y conserva el cálculo/reporte de la carga inicial.
- `docs/architecture/structureco-fase-4-gates.md` — añade el estado `PASA INFORMATIVO` y actualiza el gate de bundle.
- `docs/superpowers/specs/2026-08-09-fase-4-3d-experimental-design.md` — cambia el criterio de aceptación a medición sin techo bloqueante.
- `reports/2026-08-09-1525-fase-4-presupuesto-sin-limite.md` — este reporte.

No se incluyeron ni modificaron como parte de este cambio `src/data/modelOperations.ts`, `.worktrees/`, los dos reportes sin seguimiento existentes ni ninguna ruta protegida (`src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts`).

## Cómo verificar

```powershell
npm.cmd run lint
npm.cmd run verify:protected
npm.cmd run verify:perf
npm.cmd run verify
git diff --check
```

Resultados observados:

- `npm.cmd run lint`: aprobado.
- `npm.cmd run verify:protected`: frontera protegida intacta, 29/29 archivos.
- `npm.cmd run verify:perf`: aprobado; 711 442 bytes / 188 963 gzip; salida `límite sin límite / sin límite; sin techo bloqueante`.
- `npm.cmd run verify`: aprobado; 119 archivos de prueba, 811 pruebas aprobadas y 3 omitidas; build y medición final aprobados.
- `git diff --check`: sin errores de whitespace.

## Qué sigue sin implementarse

Esto no amplía el alcance de Fase 4. Siguen deliberadamente fuera de producto:

- análisis estructural 3D, coordenadas `z` persistidas, `AnalysisSpace`, 6 GDL, torsión, elementos espaciales, solver/resultados 3D, exportación 3D y migraciones;
- workers o contratos de datos 3D;
- producto de IA, broker DeepSeek, SDK/API, secretos, backend, ejecución de `CommandProposal`, evals adversariales, kill switch y telemetría;
- publicación remota o `push`.

El visor 3D continúa siendo `IMPLEMENTADO EXPERIMENTAL / NO AUTORITATIVO` y la IA `PRE-RFC COMPLETO / PRODUCTO NO IMPLEMENTADO`.

## Pendientes conocidos

- El chunk diferido del visor sigue generando el aviso de Vite por superar 500 kB sin minificar; al quitar el techo inicial, la optimización queda como observabilidad y no como bloqueo.
- No se afirma compatibilidad con lectores de pantalla porque no se probó directamente.
- `npm audit --omit=dev` conserva la vulnerabilidad alta preexistente de `pdfjs-dist@6.1.200`; no se actualizó ninguna dependencia.
- El cambio se deja en un commit local; no se hará `push` sin autorización explícita.
