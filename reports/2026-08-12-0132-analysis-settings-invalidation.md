# Invalidación de resultados al cambiar configuración analítica

**Fecha:** 2026-08-12 01:32
**Agente:** Codex
**Rama:** main

## Qué cambió

Se añadió `updateProjectAnalysisSettings` al contexto del proyecto, limitada a `analysisMode` y `pDeltaConfig`. Esta ruta invalida el resultado actual, cancela o deja obsoletas las ejecuciones en curso mediante la revisión existente y no inicia un análisis nuevo.

TopBar y su configuración avanzada P-Delta usan la nueva ruta. Las preferencias visuales permanecen en `updateProjectView`; `calculationMode` se conserva allí porque sólo afecta la experiencia pedagógica y diagnósticos, no el cálculo numérico.

## Por qué

Antes, los selectores de orden de análisis y los parámetros P-Delta usaban la ruta visual. Podían dejar visibles resultados calculados con una configuración analítica anterior o permitir que una ejecución anterior publicara después del cambio.

## Archivos tocados

- `src/store/ProjectModelContext.tsx` — declara la API acotada de configuración analítica.
- `src/store/ProjectContext.tsx` — implementa actualización, invalidación y protección de revisión sin historial ni relanzamiento automático.
- `src/store/ProjectContext.test.tsx` — cubre invalidación por modo/parámetros, resultado tardío, preferencia visual e historial.
- `src/features/topbar/TopBar.tsx` — migra `analysisMode` y la configuración avanzada P-Delta a la nueva API.
- `scripts/protected-baseline.sha256` — registra el hash autorizado de `ProjectContext.tsx`; no cambia engine, tipos, datos ni workers.

## Cómo verificar

```text
npm.cmd test -- src/store/ProjectContext.test.tsx -t "analysis settings lifecycle" --maxWorkers=1
npm.cmd test -- src/features/topbar/TopBar.test.tsx --maxWorkers=1
npm.cmd run typecheck
npm.cmd run lint
node scripts/check-protected-baseline.mjs
```

## Pendiente / siguiente paso

No se hizo commit ni push por instrucción explícita. El test preexistente de comandos `records one reversible history entry for one command intention` es intermitente porque no espera el comando cargado dinámicamente; no se modificó por estar fuera de alcance.
