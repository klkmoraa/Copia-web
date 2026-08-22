# CRI-94 · Broker de presentación y continuidad

**Fecha:** 2026-08-16 12:49
**Agente:** Codex
**Rama:** `crisdlm302/cri-94-broker-de-presentacion-y-continuidad-t-inv-18-y-el`

## Qué cambió

Se sustituyeron las fuentes independientes de apertura/presentación de WorkspaceShell por un broker declarativo y un contexto estrecho. El broker conserva la intención lógica de cada superficie al migrar entre X2, M1 y K0, resuelve exclusión por suspensión sin desmontaje y centraliza foco, readiness lazy e inertización modal.

La tabla única usa sólo el vocabulario cerrado acordado:

| shellClass | Inspector | Results | Datasheet | Doctor | Palette |
| --- | --- | --- | --- | --- | --- |
| X2 | dock | dock | drawer | drawer | overlay |
| M1 | inset | inset | drawer | drawer | overlay |
| K0 | sheet | sheet | fullscreen | fullscreen | sheet |

## Por qué

CRI-94 exige que recomponer, rotar o cambiar viewport altere únicamente la presentación. La selección, evidence/result layer, cámara, drafts, foco e intención de apertura deben sobrevivir, sin duplicar la histéresis de CRI-89 ni introducir decisiones locales de `drawer`, `sheet` o `fullscreen`.

## Archivos tocados

- `src/features/workspace/surfacePresentation.ts` — tabla, vocabulario, estado lógico y resolutores puros de actividad/exclusión.
- `src/features/workspace/SurfacePresentationProvider.tsx` y contexto/hooks — autoridad React estrecha, retención, readiness lazy, foco semántico e inertización.
- `src/features/workspace/WorkspaceShell.tsx` — conexión del broker y eliminación de booleanos sueltos/sincronización manual.
- `src/features/workspace/workspaceCommands.ts` — el bus conserva intenciones; Results usa `open-results`.
- `src/features/inspector/Inspector.tsx`, `src/features/results/ResultsPanel.tsx`, `src/features/datasheet/DatasheetPanel.tsx`, `src/features/model-doctor/ModelDoctor.tsx` y `src/features/workspace/CommandPalette.tsx` — consumen presentación/estado asignados sin decidirlos localmente.
- `src/design-system/components/overlays.tsx` y `modalFocus.ts` — patrón modal único con trap y limpieza simétrica para drawer/fullscreen.
- `src/features/workspace/phase1.css` y `src/design-system/components/ui.css` — geometría por atributos del broker y fullscreen.
- Tests focales de broker, proveedor, recomposición, Inspector, Results, Datasheet, comandos y harness de Model Doctor.
- `scripts/qa-model-doctor.mjs` — adaptación del mismo contrato QA a la nueva autoridad modal, sin rebajar aserciones.
- `docs/superpowers/specs/2026-08-16-cri-94-surface-presentation-broker-design.md` y `docs/superpowers/plans/2026-08-16-cri-94-surface-presentation-broker.md` — diseño y plan ejecutado, indexados en `docs/README.md`.
- `reports/evidence/2026-08-16-cri-94/` — secuencia causal, estados DOM y capturas reales.

## Cómo verificar

```powershell
npm.cmd run lint
npx.cmd vitest run src/features/workspace src/design-system/components
npx.cmd vitest run src/features/workspace/SurfacePresentationProvider.test.tsx src/features/workspace/shellRecomposition.test.tsx src/features/datasheet/DatasheetPanel.test.tsx src/features/canvas/canvasInteraction.test.ts
npm.cmd run typecheck
npm.cmd run verify:protected
npm.cmd run qa:model-doctor
npm.cmd run build
```

Oráculos principales:

- Inspector X2→K0→X2 conserva `open` y migra dock→sheet→dock.
- Compact mantiene sólo la superficie más reciente activa y suspende las anteriores sin destruir estado/draft.
- Drawer/fullscreen nunca tienen dos instancias activas.
- Datasheet fullscreen aplica `inert` + `aria-hidden`; cerrar los limpia y devuelve foco al launcher.
- El resize conserva selección, evidence, draft y cámara mediante el ancla de modelo existente.
- Reducir el visual viewport por teclado virtual no cambia shell class ni superficies.

Resultado focal final antes de integrar:

- `npm run lint -- src scripts/qa-model-doctor.mjs`: PASS sin warnings.
- `npx vitest run src/features/workspace src/design-system/components`: 19 archivos, 111/111 PASS.
- Tests adicionales directamente modificados: 6 archivos, 78 PASS y 3 skipped preexistentes.
- `npm run typecheck`: PASS.
- `npm run verify:protected`: PASS, 38 archivos intactos.
- `npm run qa:model-doctor`: PASS en toda su matriz browser.
- `npm run build`: PASS; sólo conserva el warning preexistente de tamaño de chunks.

## T-INV-1…8

| Contrato | Estado | Evidencia |
| --- | --- | --- |
| T-INV-1 | PASS | `shellRecomposition.test.tsx` conserva ProjectModel, selección y evidence; no se emiten commits/cancelaciones al recomponer. |
| T-INV-2 | PASS | Tabla/proveedor y secuencia X2→K0→X2 conservan la intención abierta. |
| T-INV-3 | PASS | Proveedor conserva foco por `data-surface-focus-key`; cierre retorna al launcher y usa equivalente semántico si éste ya no existe. |
| T-INV-4 | PASS | El visual viewport del teclado no cambia K0 ni estado. |
| T-INV-5 | PASS | No se modificó ni duplicó ShellCompositionProvider, histéresis o debounce de CRI-89. |
| T-INV-6 | PASS | StructuralCanvas conserva su cámara única; `cameraForViewportResize` mantiene el punto de modelo centrado. |
| T-INV-7 | PASS | El broker sólo recibe `shellClass`; no consume pointer type ni affordances. |
| T-INV-8 | PASS | Draft real de Datasheet y drafts locales de Inspector/edición estructural permanecen en componentes retenidos; el test verifica valor no aplicado tras suspend/resume. |

## Pendiente / siguiente paso

Nada pendiente dentro de CRI-94. CRI-90 se mantuvo como dependencia soft sin implementación. `peek` sólo cuenta con la validación mecánica requerida; el comportamiento específico de Datasheet/Doctor queda diferido a CRI-102. No se iniciaron CRI-95/96/97/99/100/102.

Riesgo documental: los tres informes CRI-12 solicitados no existen en el árbol vigente; se leyó su snapshot final histórico en `3d5c807` para respetar la matriz cerrada, sin restaurar documentación eliminada ni crear una fuente paralela.
