# Migration ledger

Fase 13 - corte de consolidación del 27 de julio de 2026.

Base aceptada: `49090f5` (`phase/12-a11y-feedback-i18n`).

## Criterio

Cada retiro o migración debe tener consumidor identificado, prueba de compatibilidad y reversión clara. El ledger no autoriza cambios en schema, IDs, persistencia, unidades, signos, geometría, solver, workers ni handlers matemáticos.

## Migrado o retirado

| Antes | Ahora | Estado | Evidencia | Owner |
| --- | --- | --- | --- | --- |
| Focus trap, Escape, bloqueo de scroll y foco de retorno duplicados en `ImportCenterDialog` y `NewExerciseDialog`. | Hook UI `src/ui/modalFocus.ts`; cada diálogo conserva su selector de foco inicial y sus transiciones propias. | Migrado | `modalFocus.test.tsx`, `ImportCenterDialog.test.tsx`, `NewExerciseDialog.test.tsx`; 15/15 focales del slice. | UI primitives |
| `InfluenceLineView` importado de forma estática por `ResultsPanel`. | Chunk diferido con `lazy`/`Suspense`, fallback localizado y precarga por foco o hover de la pestaña. | Migrado | `ResultsPanel.test.tsx`; `qa:phase13` confirma que el chunk no se solicita antes de activar Influencia y sí al abrirla. | Results |
| `src/App.css` e `src/index.css`, sin imports. | Eliminados. | Retirado | Búsqueda de consumidores vacía; build, suite y QA visual verdes. Reversión: restaurar desde `49090f5`. | App shell |
| `src/assets/hero.png`, `react.svg` y `vite.svg`, sin consumidores. | Eliminados. | Retirado | Búsqueda de consumidores vacía; `qa:phase13` valida su ausencia. No contribuían al bundle. | App shell |

## Conservado deliberadamente

| Elemento | Decisión | Motivo y cobertura |
| --- | --- | --- |
| `PortableImportCenter` y factories de adapters | Mantener | Frontera UI lazy vigente para JSON, PDF y `.structureco`; import/export está protegido y sus pruebas siguen verdes. |
| `ComponentLab`, primitives y `componentLab.css` | Mantener | Herramienta de desarrollo aislada por `import.meta.env.DEV`; no forma parte del bundle productivo. |
| `styles.css`, tokens y `ui.css` | Mantener | Cascade acumulativa con variantes desktop/tablet/móvil y Light/Dark. Una poda global tendría riesgo visual mayor que su beneficio medido. |
| Assets públicos, favicon, manifest e iconos | Mantener | Tienen consumidores en `index.html` o el manifest. |
| Claves de preferencias UI | Mantener exactas | `structureco:workspace-layout:v1`, `structureco:editor-layers:v1`, `structureCo.results.mode.v1`, `structureCo.inspector.expanded.v1` y `structureCo.classroom.session.v1:<projectId>`. |

## Postergado

| Deuda | Razón para postergar | Próxima condición |
| --- | --- | --- |
| Invertir ownership `ToolRail`/`ToolBar` | El wrapper es pequeño y estable; ampliar el slice no produce mejora observable de runtime. | Hacer sólo si se elimina o renombra un consumidor, conservando el export compatible. |
| Lazy-load de `NewExerciseDialog` | Puede diferir aproximadamente 26 KB de fuente, pero no era necesario para cerrar la regresión medida de este slice. | Añadir preload del launcher, fallback accesible y pruebas de foco antes de migrar. |
| Instancias exportadas `jsonImportCenterAdapter` y `portableImportCenterAdapter` | Sin consumidores internos, pero el ahorro productivo es mínimo por tree-shaking y pueden funcionar como compatibilidad externa. | Retirar únicamente con prueba explícita de API pública. |
| Separar CSS exclusivo de ComponentLab | Ahorro máximo bajo: `ui.css` completo pesa 4,842 bytes gzip. | Considerar si ComponentLab se convierte en paquete independiente. |
| Dividir catálogos i18n | Haría asíncrono el idioma persistido y el primer render. | Requiere diseño de bootstrap sin flash ni cambio de idioma. |
| Desacoplar `portableFile` de generación PDF | Cruza import/export y persistencia protegidos. | Sólo con autorización funcional separada y fixtures portables versionados. |
| Memoizar o dividir `StructuralCanvas`/Results | No existe perfil que justifique cambiar sus límites. | Perfilar una interacción reproducible antes de tocar ownership o render. |

## Compatibilidad verificada

- Schema `v5`, formato portable `v1`, IDs, defaults y claves de storage: sin cambios.
- Fingerprints de dominio, portable, unidades y solver/workers: idénticos a `49090f5`.
- Import Center y Nuevo ejercicio conservan foco, Escape, Tab/Shift+Tab y retorno al launcher.
- Influencia conserva el mismo proyecto, selección, unidades, resultados y worker; sólo cambia cuándo se descarga su UI.
- El diff de `src/engine`, `src/workers`, `src/data`, `src/store/ProjectContext.tsx` y `src/types.ts` es vacío.

## Rollback

El commit de Fase 13 es autocontenido. Si una integración externa depende de un archivo retirado o de la carga estática de Influencia, revertir ese commit restaura el estado exacto de `49090f5` sin migración de datos.
