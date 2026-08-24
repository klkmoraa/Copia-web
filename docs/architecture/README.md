# Mapa de arquitectura vigente

**Clasificación:** `CANONICAL`

Este mapa orienta hacia las implementaciones y contratos actuales. No duplica el inventario de capacidades del [README principal](../../README.md) ni convierte decisiones históricas en arquitectura vigente.

## Mapa de subsistemas

```text
App / navegación
├─ Workspace 2D
│  ├─ features + design-system
│  ├─ ProjectCommand + historial
│  ├─ Project Hub + persistencia
│  └─ workers → engine 2D → resultados
├─ Aula sobre el proyecto 2D
└─ Space 3D experimental
   ├─ modelo, validación y comandos propios
   ├─ worker y solver espacial propios
   └─ persistencia, resultados y renderer propios
```

| Subsistema | Implementación principal | Contrato observable |
|---|---|---|
| Shell y navegación | `src/App.tsx`, `src/features/workspace/**` | Inicio, mesa 2D y Space 3D se cargan como superficies explícitas. |
| Dominio 2D | `src/types.ts`, `src/data/**`, `src/store/**` | Modelo versionado, unidades, topología, persistencia e historial. |
| Análisis 2D | `src/engine/**`, `src/workers/**` | Solver, auditorías, resultados y protocolos asíncronos protegidos. |
| Comandos e historial | `src/commands/**`, `src/store/ProjectContext.tsx` | `ProjectCommand`, patches reversibles y undo/redo. |
| Proyectos | `src/storage/projectRepository.ts`, `src/features/project-hub/**` | IndexedDB, migración y recuperaciones. |
| Import/export y PDF | `src/utils/**`, `src/features/import-export/**`, `src/import/dxf/**` | Formatos validados, expediente portable y DXF ASCII experimental. |
| Datasheet | `src/features/datasheet/**` | Proyección tabular del modelo, sin store propio; consulta su [contrato canónico](structureco-datasheet.md). |
| Aula | `src/education/**`, `src/features/classroom/**`, `src/store/ClassroomSessionContext.tsx` | Recorrido, predicciones, niveles y progreso local. |
| Space 3D | `src/space3d/**`, `src/features/space3d/**` | Dominio separado S3D-1; consulta su [contrato canónico](structureco-space-3d-s3d1.md). |
| Design system | `src/design-system/**` | Tokens, tipografía, componentes, iconografía y movimiento. `tokens.css` es la fuente única de color, forma, materia y tipografía; `material.css` reparte la materia por `data-level`, y el resto del CSS del repositorio consume roles, nunca literales. |

## Identidad visual

La dirección es la de una aplicación de escritorio del sistema, y se apoya en cuatro
decisiones que cierran todas las demás: neutro absoluto en los grises, un solo acento,
profundidad por material translúcido en vez de sombra, y rellenos en vez de cavidades. El
color se decide **por apariencia** —un mismo hue vale un grado en claro y otro en oscuro—
y el contrato que lo gobierna es de contraste, no de identidad: 3:1 no textual y 4,5:1
textual contra los dos fondos de cada apariencia.

`brand/brandbook.html` documenta el sistema sin transcribirlo: importa `tokens.css` y pinta
cada muestra con `var(--sc-…)`, así que no puede discrepar del producto. Cuatro pruebas lo
vigilan en cada ejecución de la suite —`tokens.test.ts`, `surfaceGeometry.test.ts`,
`material.test.ts` y `typography.test.ts`—, y entre las tres primeras cubren el contraste
por apariencia, la escala de radios, la elevación monótona y la ausencia de materia de
arcilla. La identidad anterior (arcilla marfil/menta) queda archivada en
`brand/brandbook-clay.html` como evidencia histórica y no es autoridad de nada.

## Fronteras protegidas

`src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx` y `src/types.ts` contienen contratos estructurales y persistentes del dominio 2D. `scripts/protected-baseline.sha256` registra su huella y `npm run verify:protected` comprueba que una tarea fuera de ese alcance no los alteró.

Space 3D permanece aislado bajo `src/space3d/**` y `src/features/space3d/**`. El adaptador 2D → 3D es de una sola dirección y publica diagnósticos cuando no puede traducir una capacidad sin inventar datos.

## Documentos de arquitectura

- `CANONICAL`: [Space 3D · S3D-1](structureco-space-3d-s3d1.md), [identidad de materiales y secciones en Model v6](structureco-member-identity-v6.md) y [verificación AISC 360 (LRFD)](structureco-aisc360-design-check.md).
- `REFERENCE`: [pre-RFC de IA mediante `CommandProposal`](structureco-fase-4-ai-command-proposal-pre-rfc.md).
- `HISTORICAL`: [pre-RFC original hacia 3D](structureco-fase-4-3d-pre-rfc.md) y [gates de Fase 4](structureco-fase-4-gates.md).

Para clasificación completa, validación, identidad visual y política de reportes, vuelve al [índice documental](../README.md).
