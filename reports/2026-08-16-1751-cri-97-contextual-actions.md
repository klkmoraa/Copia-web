# CRI-97 · Superficie contextual-actions y paridad táctil D-07

**Fecha:** 2026-08-16 17:51
**Agente:** Codex
**Rama:** crisdlm302/cri-97-contextual-actions-touch-parity

## Qué cambió

Se incorporó la superficie propia `contextual-actions`, derivada de la selección vigente y presentada exclusivamente por el broker de superficies. En X2, M1 y K0 su presentación declarativa es `inset`; en Compact expone exactamente verbo primario, Borrar y desbordamiento.

Las acciones reutilizan los comandos y rutas existentes: Copiar, Pegar, Duplicar, Repetir, Datasheet y edición estructural. El portapapeles verifica que `navigator.clipboard.readText` sea una función utilizable y usa la copia interna existente como degradación después de Copiar. Un miembro pegado conserva explícitamente `materialId`, `sectionId` y procedencia de catálogo; no hay matching por floats.

## Por qué

CRI-97 requiere paridad táctil sin redefinir mutaciones, una única capa contextual Compact junto con Candidate Picker, y una ruta de Pegar honesta frente a permisos de Clipboard/WebKit. El zócalo pasa a ser la única entrada visible de edición estructural mientras hay selección, evitando duplicar ese verbo con el lanzador heredado.

## Archivos tocados

- `src/features/canvas/ContextualActions.tsx` — modelo declarativo y zócalo accesible con overflow, atajos, Escape y restitución de foco.
- `src/features/canvas/structuralClipboard.ts` — detección real de `readText`, envolvente estructural explícita y lectura segura.
- `src/features/canvas/StructuralCanvas.tsx` — owner derivado de selección, broker, rutas touch existentes y fallback de copia interna.
- `src/features/canvas/phase2.css` — geometría inset, targets de 44 px, overflow y Compact landscape sin scroll horizontal.
- `src/features/workspace/surfacePresentation.ts` y su test — owner `contextualActions` y tabla X2/M1/K0 `inset`.
- `src/i18n/catalogs.ts` — strings ES/EN de la superficie y de feedback Clipboard.
- `src/features/canvas/ContextualActions.test.tsx`, `StructuralCanvas.contextualActions.test.tsx`, `structuralClipboard.test.ts`, `duplicatePreview.test.ts` y `StructuralCanvas.structuralEditing.test.tsx` — regresiones focales de derivación, touch, foco, fallback e identidad.
- `scripts/qa-structural-edits.mjs` — evidencia Chromium/WebKit: zócalo, overflow, touch, identidad, broker, Picker y landscape ES; espera de stylesheet lazy y commit observable de shell para WebKit.

## Cómo verificar

- `npx.cmd vitest run src/features/canvas src/features/datasheet --maxWorkers=1` — 38 archivos, 329 pruebas PASS.
- `npm.cmd run typecheck` — PASS.
- `npm.cmd run verify:protected` — PASS, 38 archivos protegidos intactos.
- `npm.cmd run qa:structural-edits` — Chromium PASS.
- `npm.cmd run qa:structural-edits:webkit` — WebKit PASS.
- `npm.cmd run build` — PASS.
- `npm.cmd run lint` se ejecutó literalmente; agotó 184 s sin diagnóstico, con árboles locales no versionados presentes. El suplemento `npx.cmd oxlint src scripts qa.mjs qa-webkit.mjs` no reportó errores nuevos; emitió dos advertencias no bloqueantes de Fast Refresh por exports compartidos de `ContextualActions.tsx`.

Los artefactos reproducibles no versionados están en `qa-artifacts/structural-edits-{chromium,webkit}.json` y `qa-artifacts/cri-97-*.png`. Ambos navegadores reportaron `readText` presente pero bloqueado con `NotAllowedError`; Pegar usó la copia interna y mantuvo `materialId: steel-a36` y `sectionId: w310x39`. El paisaje ES Compact registró `scrollWidth: 844` para viewport 844.

## Pendiente / siguiente paso

CRI-97 queda cerrado. ABIERTA-4 continúa explícitamente provisional: no se midió ni se resolvió el número de verbos para 7 tipos por 2 idiomas. No se inició CRI-98, CRI-99, CRI-100, CRI-102 ni CRI-103; la posible consolidación futura de definiciones de comandos queda diferida a CRI-103.
