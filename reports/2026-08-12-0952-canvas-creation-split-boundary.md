# Frontera estructural para creación y split desde Canvas

**Fecha:** 2026-08-12 09:52
**Agente:** Codex
**Rama:** main

## Qué cambió

La creación de miembros con endpoints nuevos o topológicos y el split de miembros pasan por operaciones de dominio y `ProjectCommand` específicos, reversibles y con resultado tipado. `StructuralCanvas` conserva la interacción, el template/repeat y la selección final, sin comparar snapshots ni decidir si una mutación topológica debe usar command o `updateProject`.

## Por qué

La política de mutaciones vigente reserva `executeProjectCommand` para operaciones estructurales tipadas con precondiciones y patches. Este cambio aplica esa frontera a creación/split sin convertir `ProjectCommand` en un bus universal, sin reimplementar `ensureNodeAtPoint` y sin alterar algoritmos, tolerancias o UX.

## Archivos tocados

- `src/data/modelOperations.ts` — añade `createMemberAtPoint`, que encapsula creación de endpoint, reutilización de conexión y topología existente.
- `src/data/modelOperations.test.ts` — caracteriza cruces, referencias, cargas, efectos iniciales, releases, springs y rigid offsets.
- `src/commands/projectCommand.ts` — añade los commands específicos `member.createAtPoint` y `member.split`, y resultados tipados para selección posterior.
- `src/commands/projectCommand.test.ts` — prueba forward/inverse exactos, creación simple/topológica, split, remapeos y fallos atómicos.
- `src/features/canvas/StructuralCanvas.tsx` — reemplaza decisiones topológicas ad hoc por `member.create`, `member.createAtPoint` y `member.split`.
- `src/store/ProjectContext.tsx` — devuelve el resultado tipado del command sin cambiar su única entrada de historial ni su invalidación.
- `src/store/ProjectModelContext.tsx` — refleja el resultado tipado en el contrato de contexto.
- `src/store/ProjectContext.test.tsx` — demuestra invalidación y un solo paso de undo/redo para un command topológico.
- `scripts/protected-baseline.sha256` — actualiza mediante el mecanismo existente únicamente los hashes autorizados de `modelOperations.ts` y `ProjectContext.tsx`.
- `.brooks-lint-history.json` — registra las revisiones Brooks de calidad de pruebas y del diff final.

## Cómo verificar

```powershell
npx.cmd vitest run src/data/modelOperations.test.ts src/commands/projectCommand.test.ts src/store/ProjectContext.test.tsx src/features/canvas src/import/dxf/dxfParser.test.ts src/features/inspector/Inspector.test.tsx --maxWorkers=1
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run verify:protected
git diff --check
```

El ciclo TDD obtuvo RED antes de producción para las nuevas fronteras y después GREEN. La corrida focal ampliada cubre 21 archivos y 151 tests. Brooks Test Quality Review y Brooks PR Review resultan 100/100, sin hallazgos. `lint` conserva dos warnings preexistentes en `prototypes/ios-app`, fuera del alcance.

## Pendiente / siguiente paso

Las cascadas/delete quedan deliberadamente fuera para el siguiente cambio. No se hizo una partición general de `StructuralCanvas`, no se modificaron tolerancias ni algoritmos topológicos, y no se tocaron solver, workers, Inspector, Results, CSS/Repeat, Mobile, esquemas, persistencia ni formatos. No se realizó commit ni push.
