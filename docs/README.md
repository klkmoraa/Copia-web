# Documentación de StructureCo

**Clasificación:** `CANONICAL`

Este archivo es el índice documental del repositorio. Define la jerarquía de autoridad y los contratos vigentes del producto.

## Jerarquía de autoridad

```text
código + pruebas + gates ejecutables
  ↳ documentación CANONICAL
  ↳ documentación REFERENCE
  ↳ documentación HISTORICAL / AUDIT/TEMPORARY
```

- `CANONICAL`: describe contratos o navegación vigentes y debe mantenerse junto con el producto.
- `REFERENCE`: aporta identidad, criterios o propuestas útiles, pero no prueba implementación.
- `HISTORICAL`: conserva decisiones o estados superados.
- `AUDIT/TEMPORARY`: evidencia temporal o de auditoría.

## Documentos canónicos

| Documento | Autoridad |
|---|---|
| [README principal](../README.md) | Entrada general y estado actual del producto. |
| [Este índice](README.md) | Clasificación, jerarquía y rutas de autoridad. |
| [Mapa de arquitectura](architecture/README.md) | Subsistemas vigentes, fronteras y navegación técnica. |
| [Space 3D — S3D-1](architecture/structureco-space-3d-s3d1.md) | Contrato, evidencia y límites del dominio 3D. |
| [Datasheet estructural](architecture/structureco-datasheet.md) | Contrato del datasheet: rejilla, editabilidad y ruta de escritura. |
| [Índice elástico estimado](architecture/structureco-elastic-index.md) | Contrato de cálculo elástico. |
| [Identidad v6](architecture/structureco-member-identity-v6.md) | Identidad de materiales y secciones en Model v6. |

## Documentos de referencia

| Documento | Uso correcto |
|---|---|
| [Pre-RFC de IA y `CommandProposal`](architecture/structureco-fase-4-ai-command-proposal-pre-rfc.md) | Propuesta de integración de IA con seguridad local. |
| [Sistema de diseño](../src/design-system/README.md) | Tokens visuales, tipografía, materia y componentes. |
| [Identidad visual oficial](../brand/README.md) | Assets protegidos y reglas de marca. |
| [Validación de Space 3D](../validation/space3d/README.md) | Procedimiento y artefactos de oráculos. |

## Documentos históricos

| Documento | Tema |
|---|---|
| [Camino pre-RFC hacia 3D](architecture/structureco-fase-4-3d-pre-rfc.md) | Pre-RFC conceptual hacia 3D. |
| [Gates de Fase 4](architecture/structureco-fase-4-gates.md) | Criterios y gates de fase 4. |

## Dónde vive cada autoridad

| Tema | Fuente de autoridad |
|---|---|
| Arquitectura | [Mapa de arquitectura](architecture/README.md), código y pruebas unitarias. |
| Contratos de ingeniería 2D | `src/types.ts`, `src/engine/**`, `src/workers/**`, pruebas asociadas y `npm run verify:protected`. |
| Contratos de ingeniería 3D | [Space 3D — S3D-1](architecture/structureco-space-3d-s3d1.md), `src/space3d/**` y `npm run verify:space3d`. |
| UX y design system | `src/design-system/**`, `src/features/**` y pruebas de componentes. |
| Validación | `validation/**`, pruebas numéricas y scripts ejecutables. |
| Identidad visual | [brand/README.md](../brand/README.md), `brand/manifest.json` y los assets protegidos de `brand/**`. |
