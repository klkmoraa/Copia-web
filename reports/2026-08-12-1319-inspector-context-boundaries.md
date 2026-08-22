# Fronteras de contexto enfocadas en Inspector

**Clasificación:** `AUDIT/TEMPORARY`
**Fecha:** 2026-08-12 13:19
**Agente:** Codex
**Rama:** main

## Qué cambió

El feature Inspector deja de consumir la fachada `useProject()`. Cada zona usa los contexts ya existentes que expresan sus dependencias reales, sin crear contexts, selectors ni memoización nueva.

| Componente | Antes | Después |
| --- | --- | --- |
| `Inspector` (shell) | `useProject()` (modelo, análisis y UI implícitos) | `useWorkspaceUI()` para selección/herramienta activa y `useProjectAnalysis()` para combinación activa |
| `LoadsPanel` | `useProject()` | `useProjectModel()` para casos, combinaciones y `updateProject`; recibe las dependencias UI/análisis del shell por props explícitas |
| `DisplayPanel` | `useProject()` | `useProjectModel()` para preferencias visuales persistidas y `updateProjectView` |
| `InspectorProperties` | `useProject()` | `useProjectModel()` para entidades/mutaciones, `useProjectAnalysis()` para resultados/issues y `useWorkspaceUI()` para selección/remapeo |
| Harness de `Inspector.test.tsx` | `useProject()` | Los tres hooks enfocados, para conservar la caracterización desde las fronteras reales |

Se añadió una caracterización observable de la edición de coordenadas que repara topología coincidente, remapea la selección al nodo conservado y deja historial reversible.

## Por qué

`useProject()` se mantiene como fachada de compatibilidad, pero se suscribe a los tres providers. El Inspector ya tiene fronteras separadas en `ProjectModelContext`, `ProjectAnalysisContext` y `WorkspaceUIContext`; consumirlas directamente evita suscripciones innecesarias y hace visibles sus dependencias sin alterar UX ni contratos.

## Mutaciones revisadas

- `LoadsPanel`: casos y combinaciones permanecen con `updateProject`; son ediciones locales discretas ya cubiertas por la política vigente.
- `DisplayPanel`: preferencias de display permanecen con `updateProjectView`; no deben crear historial ni invalidar resultados.
- `InspectorProperties`: cargas nodales/de miembro, prescribed displacements y member initial effects permanecen con `updateProject`; no se promovieron mecánicamente a `ProjectCommand`.
- `updateMember`, `applyMaterialPreset` y `applySectionPreset` conservan sus `ProjectCommand` existentes por identidad, precondiciones e inversos ya definidos.
- `updateNode` permanece con `updateProject` y `repairProjectTopology`. La nueva prueba confirma el remapeo de selección tras un merge compatible; no hizo falta una frontera de dominio ni un comando nuevo. Cambiar esta ruta habría ampliado el contrato de topología sin evidencia para ello.

## Archivos tocados

- `src/features/inspector/Inspector.tsx` — sustituye la fachada por los hooks enfocados del shell, LoadsPanel y DisplayPanel.
- `src/features/inspector/InspectorProperties.tsx` — declara explícitamente sus dependencias de modelo, análisis y UI.
- `src/features/inspector/Inspector.test.tsx` — usa los hooks reales en el harness y caracteriza el remapeo de selección tras reparación topológica.
- `reports/2026-08-12-1319-inspector-context-boundaries.md` — este handoff.

## Cómo verificar

```powershell
npm.cmd test -- src/features/inspector/Inspector.test.tsx src/features/inspector/InspectorNumericField.test.tsx src/features/inspector/InspectorSelectionPreview.test.tsx --maxWorkers=1
npm.cmd test -- --maxWorkers=1
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run verify:protected
npm.cmd run build
git diff --check
```

Evidencia local de esta sesión: caracterización focal inicial 44/44 y final 45/45; `Inspector.test.tsx` final 31/31; suite completa 144 archivos aprobados, 1113 pruebas aprobadas y 8 omitidas; `typecheck`, `verify:protected` (29 rutas) y build correctos. `lint` no tuvo errores y conserva dos warnings preexistentes bajo `prototypes/ios-app`.

## Revisión Brooks

- `brooks-audit`: 100/100, sin hallazgos en las fronteras Inspector → contexts; no hay importación store → feature ni ciclo introducido.
- `brooks-test`: 100/100, sin hallazgos en las 3 pruebas focales/45 casos; la nueva caracterización verifica estado observable y no detalles de importación.
- `brooks-review`: 100/100, sin hallazgos en el diff; no introduce abstracciones, mutaciones, dependencias ni comportamiento nuevos.

## Pendiente / siguiente paso

Nada pendiente para este alcance. No se modificaron Canvas, Results, CSS/Repeat, TopBar, mobile, solver/engine/workers, matemática/unidades, schema/persistencia, i18n, PDF ni Space 3D. Por instrucción explícita, no se hizo commit ni push.
