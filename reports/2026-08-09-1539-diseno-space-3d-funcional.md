# Diseño de Space 3D funcional

**Fecha:** 2026-08-09 15:39
**Agente:** Codex
**Rama:** `main`

## Qué cambió

Se escribió la especificación de arquitectura para evolucionar el visor experimental hacia una capacidad estructural 3D real. El diseño separa completamente el nuevo dominio `space-3d` del producto 2D y define el primer corte funcional: modelo XYZ, seis GDL, marco elástico Euler–Bernoulli, cargas nodales, apoyos, solver, worker, persistencia, editor y resultados.

También descompone la paridad avanzada en capacidades posteriores para que cargas de miembro, releases, offsets, P-Delta y dinámica no entren sin derivaciones y oráculos propios.

## Por qué

El usuario pidió continuar implementando lo que falta del 3D y que el resultado sea funcional. La orden original de Fase 4 prohibía modificar producción; la instrucción actual amplía expresamente el objetivo. Antes de cambiar tipos, solver, workers o persistencia se necesita un contrato revisable que preserve el modo 2D y fije qué evidencia demuestra resultados espaciales correctos.

## Archivos tocados

- `docs/superpowers/specs/2026-08-09-space-3d-functional-design.md` — arquitectura, contratos, alcance, UI, persistencia, oráculos y gates S3D-1.
- `reports/2026-08-09-1539-diseno-space-3d-funcional.md` — este reporte.

No se modificaron `src/**`, dependencias, versión, baseline, solver, workers ni persistencia. Los cambios ajenos de `src/data/modelOperations.ts`, `.worktrees/` y los dos reportes previos sin seguimiento permanecen fuera del cambio.

## Preflight y respaldo

- HEAD inicial: `fcbca272c1e01d8cf2c00f8aaaa6943d8d78e618`, rama `main`.
- Versión confirmada: `0.8.2`.
- Respaldo externo: `C:\Users\crisd\.codex\backups\structureco-space3d-design-20260809-153823`.
- SHA-256 `AGENTS.md`: `0FAE0FBC3B59A00057147F61429544A76ECA6BFC76A71C42BE1F8ABFE89617B6`.
- SHA-256 `package.json`: `7F7B0A26E8E1D3D4544C1A90A3D02C1CC21AFA8C40408701E8ECF1F83D076AB6`.
- SHA-256 pre-RFC 3D: `F1A2F9BBA7917BA42350D833E4E7616C46506F53F723797C2220C26FC2D4B87E`.
- SHA-256 gates F4: `E288867BCA10257F710681660338EBCEE469F183F8A154E2EF4BD5E1C3A20E69`.
- SHA-256 baseline protegida: `B9E53E6E4A7AEB1ADB79BAA93D1082071EEEA3D983104030AE83D97F4FB9E6D5`.

## Cómo verificar

```powershell
git diff --check
rg -n "TBD|TODO|implement later|AnalysisSpace|Space3DProjectV1|S3D-G" docs/superpowers/specs/2026-08-09-space-3d-functional-design.md
git diff --name-only
```

Revisar que la especificación:

- no agregue `z` opcional al modelo 2D;
- mantenga separadas unidades, resultados, storage, portable, worker y undo/redo;
- defina un flujo end-to-end verificable;
- no presente OpenSees o Frame3DD como implementación de structureCo;
- deje explícitos S3D-2–S3D-4 como trabajo posterior.

## Pendiente / siguiente paso

El usuario debe revisar la especificación escrita. Tras su aprobación se generará el plan TDD detallado de S3D-1. No se ha iniciado código de producción y no se hizo `push`.
