# CRI-82 — El datasheet estructural se vuelve editor visual

**Fecha:** 2026-08-14 01:45
**Agente:** Claude Code
**Rama:** `feature/cri-41-structural-datasheet`

## Qué cambió

La hoja de datos de CRI-81, que sólo se leía, ahora se edita. Se editan nudos,
barras y una tercera entidad nueva —Cargas— desde la propia celda o desde
editores visuales que enseñan el material, la sección, el apoyo, el nudo o la
carga resultante **antes** de aplicarlos. Un cambio simple entra al historial
normal del proyecto; un pegado o un cambio múltiple pasan por una revisión y
entran enteros o no entran.

## Por qué

CRI-81 dejó una tabla que sirve para diagnosticar y no para arreglar: para
cambiar una coordenada había que volver al Inspector, objeto a objeto, perdiendo
de vista la tabla que había dado el diagnóstico. Y cuando por fin se escribía, no
se veía el resultado hasta después de haberlo creado.

### Tres decisiones que conviene conocer antes de tocar este código

**1. Las ediciones son por celda, nunca «aplica este valor a la selección».** Un
editor tabular no necesita el modelo «una intención, muchos destinos» de la
edición múltiple, porque cada fila lleva su propio valor. La consecuencia es que
la selección del workspace sigue siendo exactamente la de CRI-81: el datasheet no
inventa ningún formato propio y `Selection` no se amplía.

**2. Todo se escribe por `updateProject`, no por `ProjectCommand`.** Está
verificado en el código, no supuesto: `NodeBulkChanges` no declara `x` ni `y`, y
`bulkPropertyDescriptors` tampoco. La coordenada de un nudo **no es expresable**
como comando. Repartir la escritura entre `selection.bulk.apply` y
`updateProject` produciría dos entradas de historial para un pegado que mezclara
coordenadas con E, A o I — que es exactamente la escritura parcial que había que
impedir. `updateProject` es la misma ruta reversible que el Inspector ya usa para
las coordenadas de un nudo. `ProjectCommand` y `ProjectEntityCollection` quedan
intactos.

**3. La hoja avisa de nudos coincidentes pero no los fusiona.** Es una diferencia
deliberada con el Inspector, que sí ejecuta `repairProjectTopology` al mover un
nudo: un pegado de cincuenta coordenadas podría borrar filas en silencio. La
revisión avisa y remite al Model Doctor, que es la ruta explícita y reversible
para repararlo. El aviso no bloquea.

## Arquitectura

```
   celda inline ─┐
   editor panel ─┼─► borrador (rowId+fieldId → texto crudo)
   pegado       ─┘         │ interpretar · unidades · validar
                           ▼
                  DatasheetEditPlan (unidades base, before→after, errores)
                     │                          │
          applyDatasheetPlan(clon)        previews y revisión
                     ▼
          updateProject(updater) → una entrada de historial
```

Los previews y la escritura comparten `applyDatasheetPlan`. Es lo que garantiza
que lo que se ve es lo que se escribe: no hay dos caminos que puedan divergir.

## Archivos tocados

**Módulos puros nuevos**

- `src/features/datasheet/datasheetEditModel.ts` — registro de campos editables;
  lee de `bulkEditProperties` en vez de repetirlo, y sólo añade `node.x`/`node.y`.
- `src/features/datasheet/datasheetEditDraft.ts` — borrador, interpretación,
  conversión de unidades, validación y aviso de coincidencia.
- `src/features/datasheet/datasheetEditApply.ts` — `applyDatasheetPlan`, la única
  escritura; devuelve el proyecto por identidad si el plan no es aplicable.
- `src/features/datasheet/datasheetPaste.ts` — portapapeles a entradas del
  borrador, contando qué se descarta y por qué.

**Componentes nuevos**

- `src/features/datasheet/DatasheetCellEditor.tsx` — editor dentro de la celda.
- `src/features/datasheet/DatasheetEditorPanel.tsx` — editores visuales con
  Antes → Después; sustituye a `DatasheetContextPanel.tsx`, que se borra.
- `src/features/datasheet/DatasheetReviewPanel.tsx` — revisión del plan.

**Modificados**

- `src/features/datasheet/datasheetModel.ts` — entidad `loads` con sus columnas,
  valor `ref` para lo que nombra el usuario, y `editability` pasa de
  `identity | derived | pending` a `identity | derived | inline | panel`.
- `src/features/datasheet/datasheetPresentation.ts` — texto de apertura del
  editor, opciones de campo y formato de un valor del plan.
- `src/features/datasheet/DatasheetGrid.tsx` — apertura del editor, pegado,
  indicador de pendiente, `aria-readonly` según el contrato y devolución del foco.
- `src/features/datasheet/DatasheetPanel.tsx` — borrador, plan, preview,
  aplicación y pestaña de Cargas.
- `src/features/datasheet/datasheet.css` — editores, revisión, previews y las
  tres señales distintas de selección, foco y pendiente.
- `src/features/bulk-edit/bulkEditPresentation.ts` — el catálogo se extrae a
  `bulkCatalogOptions`, que no depende de ninguna agregación. Es el mismo
  catálogo para la edición múltiple y para el datasheet.
- `src/i18n/catalogs.ts` — claves nuevas en `es` y `en`.
- `docs/architecture/structureco-datasheet-cri-81.md` → **renombrado** a
  `structureco-datasheet.md` y reescrito con el contrato vigente. Los tres
  índices que lo enlazaban se actualizaron.

**Documentación de la fase**

- `docs/superpowers/specs/2026-08-14-datasheet-editor-cri-82-design.md`
- `docs/superpowers/plans/2026-08-14-datasheet-editor-cri-82.md`

## Cómo verificar

```bash
npx vitest run src/features/datasheet src/features/bulk-edit src/features/inspector --maxWorkers=1
```

431 pruebas en verde, 174 de ellas del datasheet. Las tres suites juntas porque
el datasheet reutiliza `bulkEditProperties` y `sectionGeometry`, y hay que
comprobar que reutilizarlos no rompió a sus dueños.

```bash
npx tsc --noEmit -p tsconfig.app.json
npx oxlint
```

Sin errores de tipo. `oxlint` sólo deja los dos avisos preexistentes de
`prototypes/ios-app`.

**Humo de navegador** (`npm run dev`, abrir la hoja de datos):

1. Escribir una coordenada en el panel → aparece el fantasma de la posición
   anterior, la barra dice «1 cambio pendiente» y la celda queda marcada.
2. Pegar un bloque 2×2 sobre X e Y → la revisión enseña las cuatro transiciones;
   `Cancelar` no escribe nada.
3. Volver a pegar y `Aplicar todo` → las cuatro celdas entran, y **una sola
   deshecha las revierte todas**. Ésa es la prueba de la atomicidad.
4. Elegir otro perfil en Sección → dos visores, Antes y Después.
5. Pestaña Cargas → las celdas fuera de la familia de cada fila salen como `—` y
   no se editan; ID, Objeto y Familia son `aria-readonly`.

Consola del navegador y del servidor sin errores.

## Pendiente / siguiente paso

- **Sin instantánea de obsolescencia.** `updateProject` no rechaza un plan
  preparado sobre un modelo que cambió mientras se revisaba, como sí hace
  `sourceSnapshot` en los comandos. La hoja es modal y bloquea el lienzo, así que
  la ventana es estrecha; si alguna vez deja de ser modal, esto pasa a ser un
  requisito.
- **Si se quisiera la semántica completa de comando** para las coordenadas
  —parche, inverso y precondiciones—, lo correcto es ampliar `NodeBulkChanges`
  con `x` e `y`, no abrir una ruta paralela. Es un ticket propio.
- No se hizo merge a `main` ni se actualizó GitHub Pages, como se pidió.
