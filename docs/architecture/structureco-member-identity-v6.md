# Identidad de materiales y secciones en Model v6

**Clasificación:** `CANONICAL`

Model v6 añade identidad explícita y procedencia a cada `MemberModel` 2D sin cambiar las propiedades numéricas que consume el motor.

## Contrato del miembro

- `materialId?: string` identifica una entrada seleccionada explícitamente de `standardMaterials`.
- `sectionId?: string` identifica una entrada seleccionada explícitamente de `standardSections`.
- `materialOrigin` y `sectionOrigin` usan `catalog`, `custom`, `imported` o `legacy`.
- E, G, densidad, A e I siguen almacenados en el miembro y siguen siendo las entradas del solver. El análisis no consulta catálogos.
- `catalog` exige el ID correspondiente. Los demás orígenes pueden no tener ID.

No se añadió versión de catálogo: los catálogos actuales publican IDs estables, pero no exponen una versión canónica ni una migración entre ediciones. Guardar una versión inventada no aportaría trazabilidad verificable.

## Transiciones

Seleccionar un preset ejecuta un comando atómico que copia sus propiedades numéricas y asigna su ID con origen `catalog`. Una edición manual de E, G o densidad elimina `materialId` y cambia el origen material a `custom`; una edición manual de A o I hace lo equivalente con la sección. Reescribir después los mismos números no recupera el ID: el usuario debe volver a seleccionar el preset.

Los patches de proyecto guardan el miembro completo antes y después, por lo que undo/redo restaura propiedades e identidad juntas. Copiar, duplicar, repetir y dividir miembros conservan el metadato por clonación explícita del miembro.

## Compatibilidad

La normalización de proyectos v1-v5 conserva las propiedades numéricas y asigna origen `legacy` cuando faltan los nuevos campos. No compara floats ni intenta identificar presets. Los importadores externos que sólo aportan geometría y propiedades numéricas usan origen `imported` sin heredar IDs del miembro usado como plantilla.

La persistencia local, IndexedDB, JSON y paquetes `.structureco` pasan por la misma normalización v6, de modo que IDs y orígenes sobreviven al ciclo guardar/cerrar/abrir y al intercambio interno.
