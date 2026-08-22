# CRI-96 · selección precisa y Candidate Picker

**Fecha:** 2026-08-16 14:45
**Agente:** Codex
**Rama:** `crisdlm302/cri-96-seleccion-precisa-candidate-picker`

## Qué cambió

Se sustituyó el picker de solapes de clic inmediato por una interacción local
en cinco fases: detectar candidatos explícitos, previsualizar, ciclar/elegir,
confirmar y cancelar sin tocar la selección previa. Un único candidato conserva
la acción inmediata; dos o más abren Candidate Picker.

Mouse, touch, stylus y teclado convergen en el mismo contrato. Touch usa
long-press de 480 ms; el fondo puede armar marquee (SEL-02) y cualquier
desplazamiento mayor que 3 px cancela esa vía antes de abrir picker/marquee.

## Por qué

CRI-96 exigía selección inequívoca para objetos superpuestos sin mutar
`ProjectModel`, solver, schema ni el estado global de UI durante el preview.
También requería integrar la capa con el broker de CRI-94 y verificarla en
Chromium y WebKit.

## Archivos tocados

- `src/features/canvas/candidatePicker.ts` — estado efímero e IDs explícitos.
- `src/features/canvas/CanvasCandidatePicker.tsx` — listbox accesible,
  ciclo/confirmación/cancelación y controles de 44 px.
- `src/features/canvas/StructuralCanvas.tsx` — colección por hit-test y
  topología explícita, preview local, confirmación transaccional y SEL-02.
- `src/features/canvas/CanvasGeometryLayer.tsx` y `src/styles.css` — preview
  discontinuo distinguible en escala de grises, sin alterar geometría técnica.
- `src/features/canvas/canvasInteraction.ts` — contrato de 480 ms y jitter.
- `src/features/workspace/surfacePresentation.ts` — broker `candidatePicker`:
  floating en X2/M1 y sheet en K0.
- `scripts/qa-structural-edits.mjs` — selección explícita en QA, evidencia
  CRI-96, coordinación de capas Compact y sincronización WebKit estable.
- `src/features/canvas/*.candidatePicker.test.tsx`,
  `src/features/canvas/CandidatePicker.test.tsx` y pruebas de broker —
  regresiones focales.
- `reports/evidence/2026-08-16-cri-96-selection-candidate-picker.md` —
  resultados y artefactos observados.

## Cómo verificar

```powershell
npm.cmd run lint -- --ignore-pattern "structureco-sites-test/**" --ignore-pattern "structureco-sites-test-publish/**" --ignore-pattern "validation/**"
npx.cmd vitest run src/features/canvas src/utils --maxWorkers=1
npm.cmd run typecheck
npm.cmd run verify:protected
npm.cmd run qa:structural-edits
npm.cmd run qa:structural-edits:webkit
npm.cmd run build
```

Resultado observado: Vitest 39 archivos / 279 pruebas PASS; typecheck PASS;
protected baseline PASS (38 archivos); QA Chromium PASS; QA WebKit PASS;
build PASS. El comando `npm run lint` sin exclusiones recorre directorios
externos no versionados ya presentes (`structureco-sites-test*`) y falla por
sus dependencias; el mismo gate, excluyendo sólo esos directorios y
`validation/`, termina con salida 0 y dos advertencias preexistentes del
prototipo iOS.

## Pendiente / siguiente paso

Nada pendiente para CRI-96. CRI-97 no se inició. Riesgo operativo conocido:
mantener los directorios externos fuera de la raíz de lint o configurar sus
exclusiones de forma independiente de este ticket.
