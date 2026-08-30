# CRI-99: Inspector dividido en superficies

**Fecha:** 2026-08-16 23:50
**Agente:** Codex
**Rama:** crisdlm302/cri-99-inspector-split

## Qué cambió

El Inspector ahora se presenta como detail, analysis-setup y view mediante el broker de superficies. Detail sigue la selección y conserva borradores numéricos durante dock/inset/sheet; analysis-setup no se suscribe a selección; View conserva el contrato centralizado de ajustes del canvas.

La preferencia legacy `structureCo.inspector.expanded.v1` se enruta por owner sin eliminar IDs desconocidos. La QA de edición múltiple resuelve de forma explícita candidatos realmente superpuestos y respeta selección aditiva al confirmar con Shift.

## Por qué

CRI-99 exige separar los owners del Inspector, conservar continuidad de borradores y compatibilidad de preferencias, sin migrar el schema. El flujo de QA encontraba correctamente el Candidate Picker en nodos con cargas nodales; la prueba ahora elige el candidato semántico explícito y conserva la interacción real.

## Archivos tocados

- `src/features/inspector/Inspector.tsx` — owners independientes y suscripción selectiva.
- `src/features/inspector/inspectorPreferences.*` — compatibilidad tolerante de acordeones legacy.
- `src/features/workspace/*` — tabla broker y montaje de las tres superficies.
- `src/features/view/canvasViewSettings.ts` y consumidores Canvas/PDF — accessor único de vista.
- `src/features/canvas/candidatePicker.ts`, `StructuralCanvas.tsx` y pruebas — confirmación aditiva de candidatos.
- `scripts/qa-bulk-edit.mjs` — selección determinista sin atravesar sheets K0.

## Cómo verificar

- `npx vitest run src/features/inspector src/features/workspace`
- `npm run typecheck`
- `npm run verify:protected`
- `npm run qa:bulk-edit`
- `npm run build`
- `npm run lint` (en este árbol expira por directorios locales no versionados; `npx oxlint src/features/inspector src/features/workspace src/features/canvas src/features/view src/utils/pdf scripts/qa-bulk-edit.mjs` termina sin errores).

## Pendiente / siguiente paso

Nada pendiente en CRI-99. No se ejecutó ninguna migración de schema.
