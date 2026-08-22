# CRI-94 · evidencia de continuidad

Clasificación: `AUDIT/TEMPORARY`

Este directorio contiene las capturas y el registro causal del broker de presentación. El reporte final de CRI-94 enlaza cada archivo con los contratos T-INV-1…8.

## Secuencia causal observada en navegador

La secuencia se ejecutó contra `npm run preview` del build local, en una pestaña nueva y con el proyecto de ejemplo abierto. Los cambios de tamaño se realizaron mediante emulación de métricas del navegador; no se modificó el estado de la aplicación para obtener las aserciones.

| Paso | Viewport / clase | Estado observado |
| --- | --- | --- |
| 1 | 1280×720 / X2 | Inspector `dock/active`; Results `dock/active`. |
| 2 | 390×844 / K0 | Inspector `sheet/active`; Results `sheet/suspended` y retenido. |
| 3 | 1280×720 / X2 | Inspector `dock/active`; Results `dock/active`; ninguno se cerró. |
| 4 | 390×844 / K0 | Datasheet `fullscreen`; `.app-shell` tiene `inert` y `aria-hidden="true"`; Inspector y Results quedan suspendidos. |
| 5 | Escape | Datasheet se cierra; `inert` y `aria-hidden` desaparecen; foco vuelve a `Abrir hoja de datos`. |
| 6 | Ctrl+K en K0 | Palette `sheet/active`; Inspector y Results siguen retenidos como `suspended`; foco en `command-query`. |

## Capturas

- `01-x2-inspector-dock.png` — estado inicial X2.
- `02-k0-inspector-sheet.png` — la misma intención de Inspector migrada a K0.
- `03-x2-inspector-return.png` — retorno a X2 sin cierre.
- `04-k0-datasheet-fullscreen-inert.png` — Datasheet fullscreen con fondo inerte.
- `05-k0-palette-exclusive.png` — Palette como única capa contextual activa en Compact.

## Evidencia determinista complementaria

- `surfacePresentation.test.ts`: tabla completa, migración X2↔M1↔K0, exclusión Compact, exclusión modal, suspensión/reanudación y `peek` como estado.
- `SurfacePresentationProvider.test.tsx`: intención lazy, draft retenido al suspender, retorno de foco, `inert`/`aria-hidden` y foco semántico tras migrar.
- `shellRecomposition.test.tsx`: selección, `resultTab` de evidence, draft, foco y superficie conservados; teclado virtual no recompone.
- `DatasheetPanel.test.tsx`: draft real de Datasheet conservado durante suspensión/reanudación.
- `canvasInteraction.test.ts`: cámara conservada por el punto de modelo anclado al centro tras resize.

Las capturas son evidencia visual; las aserciones de estado anteriores proceden del DOM real de la misma sesión y los tests son los oráculos deterministas del contrato.
