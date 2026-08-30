# Fundamentos de edición múltiple (CRI-37)

**Fecha:** 2026-08-12 23:00
**Agente:** Claude Code
**Rama:** `claude/cri-37-foundations` (worktree aislado `../Structure-cri37`, creado desde `origin/main` = `638601cf5a669b4cc225826e7c2c1b730c4a2e2d`)

## Qué cambió

Se añade la **primera mitad segura** de la edición múltiple, completamente aislada: un núcleo puro que agrega una selección múltiple, un modelo explícito de intención (`untouched` / `set` / `clear`), compatibilidad por entidad con motivo, y un panel de UI que se renderiza y se prueba con fixtures.

Nada de esto está conectado al Inspector ni al `ProjectModel`. `BulkEditPanel` sólo **emite** un `BulkEditIntent` por callback; no muta el modelo, no toca historial, persistencia ni análisis. `InspectorProperties` sigue mostrando la selección múltiple como sólo lectura, exactamente como antes.

Para la vista previa de sección se extrajo la geometría y el contorno del visor existente a dos módulos nuevos, y `SectionViewer2D` pasó a consumirlos. El comportamiento del visor no cambia: sus pruebas de regresión siguen pasando sin tocarlas.

## Por qué

Preparar la edición múltiple sin arriesgar el modelo. El riesgo real de esta funcionalidad es escribir propiedades que el usuario nunca tocó: con 10 miembros de material y sección mezclados, un formulario ingenuo sobrescribe las 15 propiedades al aplicar una. Por eso el borrador guarda **sólo** lo que el usuario editó y la ausencia de una entrada significa `untouched`, no «vacío».

El segundo riesgo es inventar identidad: dos secciones distintas pueden compartir A e I, así que un perfil comercial sólo se dibuja cuando hay un id explícito con origen `catalog`. Sin identidad se dibuja la rectangular equivalente y se rotula como tal.

## Archivos tocados

Núcleo puro (sin React):

- `src/features/bulk-edit/bulkEditTypes.ts` — contratos: `AggregatedValue` (`same` / `mixed` / `incompatible`), `BulkStagedChange` (`set` / `clear`), borrador parcial, intención y filas de resumen.
- `src/features/bulk-edit/bulkEditProperties.ts` — registro de propiedades de miembro y nudo con su elegibilidad explícita y su motivo de rechazo.
- `src/features/bulk-edit/bulkEditAggregation.ts` — agregación determinista de la selección.
- `src/features/bulk-edit/bulkEditIntent.ts` — preparación, retirada y validación de cambios; construcción de la intención y del resumen.
- `src/features/bulk-edit/bulkSectionPreviewModel.ts` — procedencia de la sección: `catalog` / `equivalent` / `mixed` / `none`.
- `src/features/bulk-edit/bulkEditPresentation.ts` — formato de valores agregados y opciones de catálogo.
- `src/features/bulk-edit/bulkEditCopy.ts` — copia es/en local a la funcionalidad, como `modelDoctorCopy`.
- `src/features/bulk-edit/bulkEditFixtures.ts` — fixtures compartidas por pruebas y UI aislada.

UI aislada:

- `src/features/bulk-edit/BulkEditPanel.tsx` — panel; `onApply` entrega la intención preparada y nada más.
- `src/features/bulk-edit/BulkSelectionSummary.tsx`, `BulkPropertyField.tsx`, `BulkSectionPreview.tsx`, `BulkChangeSummary.tsx`.
- `src/features/bulk-edit/bulkEdit.css` — sólo tokens Clay; adaptación por `@container`, sin `@media`.

Reutilización del visor de sección:

- `src/features/inspector/sectionGeometry.ts` (nuevo) — resolución de geometría y encaje en el lienzo.
- `src/features/inspector/SectionShape.tsx` (nuevo) — contorno SVG (I, HSS_RECT, HSS_ROUND, C, L, RECT) y máscara.
- `src/features/inspector/SectionViewer2D.tsx` (**modificado**) — pasa a consumir los dos módulos anteriores, para no duplicar la geometría en la vista previa de la edición múltiple. Sin cambio de comportamiento: sus pruebas de regresión pasan sin tocarlas.

Otro archivo existente modificado:

- `src/design-system/components/controls.tsx` (**modificado**) — `SegmentedControl` acepta `describedBy` opcional y lo pasa al `role="radiogroup"`. Es aditivo y no cambia nada cuando no se usa; sin él, el control tri-estado no puede exponer «Varios» ni la compatibilidad a un lector de pantalla (hallazgo MAJOR de la revisión de accesibilidad).

Pruebas nuevas: `bulkEditAggregation.test.ts`, `bulkEditIntent.test.ts`, `bulkSectionPreviewModel.test.ts`, `bulkEditCopy.test.ts`, `bulkEditStyles.test.ts`, `BulkEditPanel.test.tsx`, `BulkSectionPreview.test.tsx`.

## Revisión

Cuatro revisiones de sólo lectura (dominio, UX, accesibilidad, calidad de código). Se corrigieron los BLOCKER y MAJOR reales:

- **Un `clear` preparado se perdía al pasar por el campo.** Vaciar un número retiraba cualquier cambio, incluido un borrado explícito, que volvía a `untouched` sin avisar. Ahora vaciar sólo retira un `set`, y `clear` tiene representación propia en cada control (segmento propio en los booleanos, marcador en los numéricos).
- **La intención podía fijar una identidad de catálogo inaplicable.** `set` sobre `materialId`/`sectionId` exige ahora un id que exista en el catálogo, así que quien la aplique resuelve origen y números leyéndolos del catálogo en vez de inventarlos.
- **Una identidad y unos números que la contradicen podían prepararse a la vez.** Preparar `sectionId` retira `A`/`I`; preparar `materialId` retira `E`/`G`/densidad, y al revés.
- **El borrador sobrevivía a un cambio de selección**, de modo que un cambio preparado sobre unos objetos podía aplicarse a otros que el usuario nunca editó. Ahora se descarta cuando cambia la identidad de la selección.
- **Accesibilidad**: el grupo tri-estado no recibía descripción (ni «Varios» ni la compatibilidad llegaban al lector de pantalla); el foco se perdía al descartar un cambio, porque el botón provocaba su propio desmontaje; el nombre accesible del botón no contenía su texto visible (WCAG 2.5.3); la dirección del cambio vivía sólo en un icono oculto; `Escape` se consumía siempre, impidiendo cerrar una hoja contenedora.
- **UX/responsive**: un `select` sin `min-width: 0` desbordaba el panel a 320 px; la vista previa no se apilaba en estrecho; el resumen mostraba quince filas de «Sin cambios» que escondían el único cambio real, y ahora las pliega; el pie de acciones queda fijo; el vocabulario español se alineó con el del Inspector.
- **Calidad**: se eliminaron tres exportaciones muertas, se simplificó el reparto de compatibilidad, las opciones de `enum` se declaran contra las uniones de `types.ts` (añadir un tipo de apoyo rompe el build en vez de ofrecer una lista incompleta) y la vista previa discrimina la procedencia con un `switch` exhaustivo, de modo que la futura sección paramétrica no compilará en silencio.

Quedan anotados como límites conocidos, no corregidos: el recuento «N compatibles» de la cabecera es hoy siempre igual al total, porque toda entidad admite al menos una propiedad editable; la agregación compara valores almacenados y no efectivos, así que dos rodillos equivalentes (uno con `angleDeg` implícito) se leen como «Varios»; y no es posible habilitar y configurar en una sola pasada (marcar `custom` y ajustar sus restricciones), porque la agregación deriva de la selección y no del borrador.

## Cómo verificar

```bash
npx vitest run src/features/bulk-edit src/features/inspector
```

Gates ejecutados en el worktree: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:protected`, `npm run verify:docs`, `npm run verify:perf` y `npm run verify:space3d` — todos en verde. Las pruebas focales (`src/features/bulk-edit`, `src/features/inspector`, `src/design-system`) pasan: 212 pruebas en 23 archivos.

`npm test` completo es inestable **en esta máquina**: agota los 5 s de tiempo límite en `App.test.tsx`, `Space3DWorkspace.test.tsx`, `Inspector.test.tsx`, `ProjectContext.test.tsx` y `engine/performance.test.ts` por contención de trabajadores. Se comprobó contra un worktree limpio de `origin/main`, que falla los mismos archivos en la misma máquina; el conjunto que falla cambia entre ejecuciones; y todos esos archivos pasan al ejecutarse por separado o bajo su propio gate. No es una regresión de esta rama.

## Pendiente / siguiente paso

Deliberadamente **fuera** de esta entrega:

- conectar `BulkEditPanel` a `InspectorProperties` y a la navegación del Workspace;
- la mutación real, el comando de proyecto, el historial y el undo/redo;
- persistencia, análisis y cualquier cambio de esquema;
- el Section Builder paramétrico. La unión `BulkSectionSource` deja el hueco para una tercera procedencia, pero esta fase no añade geometría ni fórmulas paramétricas.

Sin push. Un solo commit local en la rama.
