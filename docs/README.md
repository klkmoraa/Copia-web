# Documentación de StructureCo

**Clasificación:** `CANONICAL`

Este archivo es el índice documental único del repositorio. Una especificación, un plan, un reporte o una captura sólo demuestra el contexto o la ejecución de su fecha; no demuestra el producto actual.

## Jerarquía de autoridad

```text
código + pruebas + gates ejecutables
→ documentación CANONICAL
→ documentación REFERENCE
→ documentación HISTORICAL / AUDIT/TEMPORARY
```

- `CANONICAL`: describe contratos o navegación vigentes y debe mantenerse junto con el producto.
- `REFERENCE`: aporta identidad, criterios o propuestas útiles, pero no prueba implementación.
- `HISTORICAL`: conserva decisiones, planes o estados superados; nunca se reinterpreta como estado actual.
- `AUDIT/TEMPORARY`: evidencia de una ejecución, revisión, handoff o medición en un momento concreto.

## Documentos canónicos

| Documento | Autoridad |
|---|---|
| [README principal](../README.md) | Entrada breve y estado actual del producto. |
| [Este índice](README.md) | Clasificación, jerarquía y rutas de autoridad. |
| [Mapa de arquitectura](architecture/README.md) | Subsistemas vigentes, fronteras y navegación técnica. |
| [Space 3D · S3D-1](architecture/structureco-space-3d-s3d1.md) | Contrato, evidencia y límites actuales del dominio 3D experimental. |
| [Datasheet estructural](architecture/structureco-datasheet.md) | Contrato del datasheet: rejilla propia, editabilidad, ruta de escritura y qué no repara. |
| [Índice elástico estimado](architecture/structureco-elastic-index.md) | Contrato de η: qué significa, cuándo se publica, por qué no es una verificación normativa. |

## Documentos de referencia

| Documento | Uso correcto |
|---|---|
| [Pre-RFC de IA y `CommandProposal`](architecture/structureco-fase-4-ai-command-proposal-pre-rfc.md) | Propuesta de seguridad. Su mitad local está implementada en `src/ai/**`; proveedor y transporte siguen siendo propuesta. |
| [Sistema de diseño](../src/design-system/README.md) | Las cuatro decisiones del sistema visual, las nueve capas de tokens, la materia y los gates que lo sostienen. |
| [Identidad visual oficial](../brand/README.md) | Assets protegidos, manifiesto y reglas de marca. |
| [Validación de Space 3D](../validation/space3d/README.md) | Procedimiento y artefactos de oráculos; sus resultados deben revalidarse con los gates actuales. |

## Documentos históricos

| Documento | Sustitución vigente |
|---|---|
| [Camino pre-RFC hacia 3D](architecture/structureco-fase-4-3d-pre-rfc.md) | [Space 3D · S3D-1](architecture/structureco-space-3d-s3d1.md) |
| [Gates de Fase 4](architecture/structureco-fase-4-gates.md) | [Mapa de arquitectura](architecture/README.md) y gates ejecutables |
| [Diseño de activos de marca](superpowers/specs/2026-08-08-brand-assets-design.md) | [Identidad visual oficial](../brand/README.md) |
| [Plan de activos de marca](superpowers/plans/2026-08-08-protected-brand-assets.md) | [Identidad visual oficial](../brand/README.md) |
| [Diseño del visor 3D experimental](superpowers/specs/2026-08-09-fase-4-3d-experimental-design.md) | [Space 3D · S3D-1](architecture/structureco-space-3d-s3d1.md) |
| [Diseño de Space 3D funcional](superpowers/specs/2026-08-09-space-3d-functional-design.md) | [Space 3D · S3D-1](architecture/structureco-space-3d-s3d1.md) |
| [Plan de Space 3D funcional](superpowers/plans/2026-08-09-space-3d-functional.md) | [Space 3D · S3D-1](architecture/structureco-space-3d-s3d1.md) |
| [Plan de Fase 2](superpowers/plans/structureco-fase-2-plan.md) | [README principal](../README.md) y código actual |
| [Plan de Fase 3](superpowers/plans/structureco-fase-3-plan.md) | [README principal](../README.md) y gates actuales |
| [Plan de Fase 4](superpowers/plans/structureco-fase-4-plan.md) | [Space 3D · S3D-1](architecture/structureco-space-3d-s3d1.md) |
| [Diseño de edición estructural avanzada 2D](superpowers/specs/2026-08-12-advanced-2d-structural-editing-design.md) | Código, pruebas y gates actuales |
| [Diseño del datasheet estructural · CRI-81](superpowers/specs/2026-08-13-structural-datasheet-cri-81-design.md) | [Datasheet estructural](architecture/structureco-datasheet.md) |
| [Diseño del datasheet como editor · CRI-82](superpowers/specs/2026-08-14-datasheet-editor-cri-82-design.md) | [Datasheet estructural](architecture/structureco-datasheet.md) |
| [Plan del datasheet como editor · CRI-82](superpowers/plans/2026-08-14-datasheet-editor-cri-82.md) | [Datasheet estructural](architecture/structureco-datasheet.md) |
| [Plan de edición estructural avanzada 2D](superpowers/plans/2026-08-12-advanced-2d-structural-editing.md) | Código, pruebas y gates actuales |
| [Diseño del broker de presentación · CRI-94](superpowers/specs/2026-08-16-cri-94-surface-presentation-broker-design.md) | Código, pruebas y gates actuales |
| [Plan del broker de presentación · CRI-94](superpowers/plans/2026-08-16-cri-94-surface-presentation-broker.md) | Código, pruebas y gates actuales |
| [Plan de selección precisa · CRI-96](superpowers/plans/2026-08-16-cri-96-selection-candidate-picker.md) | Código, pruebas y gates actuales |

## Evidencia de auditoría y handoff

Todo `reports/**`, salvo su archivo de política, se clasifica como `AUDIT/TEMPORARY`. Consulta [reports/README.md](../reports/README.md) antes de usar un reporte. No es necesario añadir avisos a cada reporte existente.

## Dónde vive cada autoridad

| Tema | Fuente de autoridad |
|---|---|
| Arquitectura | [Mapa de arquitectura](architecture/README.md), código y pruebas cercanas. |
| Contratos de ingeniería 2D | `src/types.ts`, `src/engine/**`, `src/workers/**`, pruebas asociadas y `npm run verify:protected`. |
| Contratos de ingeniería 3D | [Space 3D · S3D-1](architecture/structureco-space-3d-s3d1.md), `src/space3d/**` y `npm run verify:space3d`. |
| UX y design system | `src/design-system/**`, `src/features/**` y gates de QA renderizada. |
| Validación | `validation/**`, pruebas numéricas y scripts ejecutables; un resultado antiguo no sustituye una ejecución fresca. |
| Identidad visual | [brand/README.md](../brand/README.md), `brand/manifest.json` y los assets protegidos de `brand/**`. |
| Roadmap y backlog | Fuera de la documentación canónica del repositorio; no se duplica en `docs/**` ni `reports/**`. |

Los nuevos documentos bajo `docs/**` deben declarar exactamente una clasificación válida y enlazarse desde este índice cuando corresponda.
