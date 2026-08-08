# Línea base de release 0.8.0

## Identidad

- Producto: structureCo `0.8.0`.
- Rama de preparación: `phase/15-launch-documentation`.
- Candidato funcional: `858c601` (`test(phase14): certify release candidate`).
- Tag objetivo: `v0.8.0`.
- Sitio vinculado: `structureco-analisis`.
- URL de producción: `https://structureco-analisis.netlify.app`.
- Deploy de producción: `6a68469008f16649235e8075`, estado `ready`.
- Preview aprobado: `https://phase15-080--structureco-analisis.netlify.app`
  (`6a684573c2f1c94256c4a140`).
- Backup previo: `6a59ba4ad8be3703730d69d8`.
- Build reproducible: Node 24, `npm ci`, `npm run build`, salida `dist/`.

## Frontera protegida

La referencia matemática es idéntica al candidato de Fase 14. No forman parte de
la release cambios en `src/engine/**`, `src/workers/**`, `src/data/**`,
`src/store/ProjectContext.tsx` o `src/types.ts`.

## Gates de referencia

| Gate | Línea base aceptada |
| --- | --- |
| Lint, pruebas y build | 66 archivos, 384/384 pruebas, build PASS |
| Chromium general | PASS, consola y `pageErrors` vacíos |
| WebKit iPhone/iPad | PASS |
| Responsive/touch | 10 composiciones de Fase 11 PASS |
| A11y/i18n/offline | 972/972 catálogos y gates de Fase 12 PASS |
| Bundle/lazy loading | Fase 13 PASS |
| Release QA | 6/6 viewports, 8 capturas, 0 fallos |

## Índice de evidencia

- QA final: `RELEASE_QA_REPORT.md`.
- Rendimiento: `PERFORMANCE_REPORT.md` y `BUNDLE_REPORT.md`.
- Accesibilidad: `A11Y_REPORT.md`, `COLOR_ACCESSIBILITY.md` e
  `I18N_PARITY.md`.
- Responsive: `RESPONSIVE_SPEC.md` y `VIEWPORT_QA_MATRIX.md`.
- Diseño: `DESIGN_TOKENS.md`, `COMPONENTS.md`, `FIDELITY_LEDGER.md`.
- Inspector: `NUMERIC_FORMATTING.md` y `PROPERTY_INVENTORY.md`.
- Resultados/Aula: `RESULTS_INFO_ARCH.md`, `RESULTS_VISUALIZATION_SPEC.md`,
  `LESSON_SCHEMA.md` y `EDUCATIONAL_CONTENT_GUIDE.md`.
- Evidencia renderizada: `evidence/phase-14/after/`.

## Baseline operativo

El smoke test de producción abrió el Pórtico de ejemplo, ejercitó selección,
Inspector, análisis y diagrama de momento. La vista desktop cerró con
`scrollWidth = clientWidth = 1280`, sin warnings ni errores de consola. El
preview también fue comprobado a 390 × 844 sin overflow.
