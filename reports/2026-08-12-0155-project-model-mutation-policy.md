# Política explícita de mutaciones de ProjectModel

**Fecha:** 2026-08-12 01:55
**Agente:** Codex
**Rama:** main

## Qué cambió

Se hizo explícita la semántica de las rutas de mutación de `ProjectModelContext` y se eliminó duplicación interna al publicar cambios, invalidar análisis y registrar historial.
Se añadieron pruebas de caracterización para edición discreta, comandos, preferencias visuales, ajustes de análisis, transacciones transitorias, renombrado y reemplazo/carga.

## Por qué

El refactor deja claro qué ruta debe elegir un caller futuro sin convertir `ProjectCommand` en un bus universal ni alterar el comportamiento observable vigente.

## Archivos tocados

- `src/store/ProjectContext.tsx` — centraliza primitivas privadas de publicación, invalidación, historial y edición reversible sin modificar las rutas públicas.
- `src/store/ProjectModelContext.tsx` — documenta el contrato y los límites de cada ruta de mutación.
- `src/store/ProjectContext.test.tsx` — caracteriza historia, invalidación y fronteras especiales; espera la publicación asíncrona real de comandos.
- `scripts/protected-baseline.sha256` — actualiza el hash autorizado de `ProjectContext.tsx` mediante el verificador existente.

## Cómo verificar

```powershell
npx.cmd vitest run src/store/ProjectContext.test.tsx --maxWorkers=1
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run verify:protected
git diff --check
```

Resultados locales al generar el reporte: 17 pruebas focales pasan; `typecheck`, `lint`, `verify:protected` y `diff --check` terminan correctamente. `lint` conserva dos warnings preexistentes bajo `prototypes/ios-app`.

## Pendiente / siguiente paso

No se migraron operaciones existentes a `ProjectCommand` y no se modificaron canvas, solver, workers, persistencia, esquemas, topología ni el contrato existente de `analysisMode`/`pDeltaConfig`. No se realizó commit ni push.
