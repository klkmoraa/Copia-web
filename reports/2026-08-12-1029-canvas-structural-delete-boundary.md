# Frontera estructural para delete desde Canvas

**Fecha:** 2026-08-12 10:29
**Agente:** Codex
**Rama:** main

## Qué cambió

La cascada de eliminación estructural salió de `StructuralCanvas` y quedó en `deleteStructuralSelection`, una operación de dominio reutilizada por los commands explícitos `member.delete`, `node.delete` y `selection.delete`.
El Canvas conserva el target, ejecuta la ruta correspondiente y limpia la selección. Los deletes individuales de `nodalLoad` y `memberLoad` siguen usando `updateProject` según la política de mutaciones vigente.

## Por qué

Eliminar un nodo o una multiselección afecta miembros incidentes y sus dependencias. Centralizar esa decisión evita que el Canvas mantenga un segundo sistema de cascadas, garantiza una única intención reversible y preserva la UX existente.

## Archivos tocados

- `src/data/modelOperations.ts` — añade la operación única de borrado estructural y sus dependencias.
- `src/data/modelOperations.test.ts` — caracteriza cascadas de nodo y multiselección, incluidas entidades no relacionadas.
- `src/commands/projectCommand.ts` — añade `node.delete` y `selection.delete`, reutiliza la operación para `member.delete` y corrige la inversa de patches múltiples para conservar orden exacto.
- `src/commands/projectCommand.test.ts` — prueba cascadas, referencias, inversas exactas y precondiciones stale atómicas.
- `src/features/canvas/StructuralCanvas.tsx` — elimina cálculos y filtros de cascada locales.
- `src/store/ProjectContext.test.tsx` — prueba una única entrada de historial, invalidación, undo y redo de la cascada.
- `scripts/protected-baseline.sha256` — actualiza, mediante el mecanismo existente, sólo el hash autorizado de `modelOperations.ts`.

## Cómo verificar

```powershell
npx.cmd vitest run src/data/modelOperations.test.ts src/commands/projectCommand.test.ts src/store/ProjectContext.test.tsx src/features/canvas src/import/dxf/dxfParser.test.ts --maxWorkers=1
npx.cmd vitest run src/commands/projectCommand.test.ts --maxWorkers=1
npm.cmd test -- --maxWorkers=1
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run verify:protected
git diff --check
```

Resultados focales: 20 archivos y 126 tests de delete/cascadas pasan. `src/commands/projectCommand.test.ts` pasa 16/16 e incluye una cascada con múltiples eliminaciones de miembros que comprueba orden exacto, `forward → inverse` e `inverse → forward`.

Validación completa final: `npm.cmd test -- --maxWorkers=1` termina con 143 archivos que pasan, 1 que falla; 1111 tests pasan, 8 skipped y 1 falla. El único fallo es `src/design-system/tokens.test.ts`, que espera una regla Clay para `.repeat-preview button` contradictoria con la regla presente en `src/features/workspace/phase1.css`. Ambos archivos están intactos respecto a `HEAD` y fuera del diff de este cambio; no se modificaron para acomodar la suite.

`typecheck`, `verify:protected` (29 archivos) y `diff --check` pasan. `lint` pasa y conserva dos warnings preexistentes en `prototypes/ios-app`, fuera del alcance. Brooks Test Quality Review y Brooks PR Review no encontraron hallazgos.

## Pendiente / siguiente paso

No se modificaron creación/split, Inspector, Results, CSS/Repeat, Mobile, solver, workers, unidades, tolerancias, migraciones, persistencia, formatos, `repairProjectTopology` ni casos/combinaciones de carga. No se realizó commit ni push.
