# Evidencia CRI-96 · selección precisa y Candidate Picker

**Clasificación:** `AUDIT/TEMPORARY`

## Entorno observado

- Build local Vite de CRI-96.
- Chromium y WebKit mediante `scripts/qa-structural-edits.mjs`.
- Proyecto de ejemplo sembrado con un punto de tres candidatos explícitos:
  `node:N3`, `member:M1` y `nodalLoad:NL1`.

## Evidencia funcional

- El browser QA contó **3** opciones explícitas en el picker.
- `ArrowDown` cambió el candidato activo de `candidate-option-node-N3` a
  `candidate-option-member-M1`; el preview cambió sin escribir la selección.
- `Escape` ocultó sólo el picker y conservó la selección previa (`node:N1`).
- `Enter` confirmó únicamente el activo (`member:M1`).
- Chromium confirmó long-press touch a 480 ms, marquee de fondo y que un
  desplazamiento lento de 4 px no abrió picker ni marquee.
- La comprobación de geometría técnica registró el radio del nodo como
  `7 -> 7`; los 44 px pertenecen a las zonas de interacción, no al dibujo.
- La tabla del broker confirmó `candidatePicker` como `floating` en X2/M1 y
  `sheet` en K0; su estado local no confirma al recomponer.

## Artefactos locales generados

- `qa-artifacts/structural-edits-chromium.json`
- `qa-artifacts/structural-edits-webkit.json`
- `qa-artifacts/cri-96-candidate-picker-grayscale-chromium.png`
- `qa-artifacts/cri-96-candidate-picker-grayscale-webkit.png`

Las capturas en escala de grises muestran el candidato activo con un halo y
trazo discontinuo distinto de la selección confirmada, por lo que la lectura
no depende sólo del color.
