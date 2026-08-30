# Datasheet estructural — CRI-81 (fase 1 de CRI-41)

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Este documento describe el diseño con el que se ejecutó
> CRI-81 y no prueba el estado actual del producto. El contrato vigente es
> [Datasheet estructural](../../architecture/structureco-datasheet.md),
> el código y sus pruebas.

## Problema

El modelo sólo se puede auditar objeto a objeto: el Inspector muestra una entidad
a la vez y el lienzo no sirve para comparar cien nudos. Falta una hoja de datos
que permita leer el modelo entero, buscarlo, ordenarlo y filtrarlo, sin convertir
la tabla en una segunda fuente de verdad.

## Objetivo de esta fase

Una primera versión **usable y de sólo lectura** del datasheet de Nodos y
Miembros, proyectada del mismo `ProjectModel`, sincronizada con la selección del
lienzo, con previews visuales contextuales y con la arquitectura de teclado y de
edición ya definida para que CRI-82 sólo añada la escritura.

## No objetivos

- Editar celdas. Ninguna escritura entra en esta fase.
- Store, historial o undo propios del datasheet.
- Tocar el solver, la teoría estructural o las dependencias.
- Pestañas de casos de carga y combinaciones (fuera del alcance declarado).

## Arquitectura

### Sin estado duplicado

Las filas son una **proyección pura** de `ProjectModel`. No hay `useState` con
copias de entidades, ni normalización, ni caché entre renders más allá de
`useMemo` sobre el propio `project`.

```
ProjectModel ──projectDatasheetRows()──> DatasheetRow[] ──pipeline──> filas visibles
     ▲                                                                    │
     └────────── useWorkspaceUI().selection ◄── setSelection ◄────────────┘
```

La selección es la del workspace (`useWorkspaceUI`), la misma que consume el
lienzo, el Inspector y la edición múltiple. Seleccionar varias filas produce
`{ kind: 'multi', nodeIds, memberIds }`, que es exactamente lo que el panel de
edición múltiple ya sabe consumir.

### Módulos

| Archivo | Responsabilidad | Puro |
|---|---|---|
| `datasheetModel.ts` | Columnas, proyección de filas, búsqueda, facetas y orden. | sí |
| `datasheetGridNavigation.ts` | Movimiento del foco de celda por teclado. | sí |
| `DatasheetGrid.tsx` | Rejilla semántica plana (`role="grid"`). | no |
| `DatasheetContextPanel.tsx` | Previews de Nodo, Apoyo, Material, Sección y Carga. | no |
| `DatasheetPanel.tsx` | Superficie, pestañas de entidad, búsqueda, filtros y acciones. | no |

### Decisión técnica de la rejilla: implementación propia, sin TanStack Table

**Decisión:** rejilla semántica propia sobre `<table role="grid">` con un módulo
puro de búsqueda/orden/filtro. **No se instala `@tanstack/react-table`.**

Razones:

1. No se instalan dependencias sin autorización explícita (`AGENTS.md`).
2. Lo que TanStack aporta en esta fase —ordenar, filtrar, definir columnas— son
   funciones puras de unas 150 líneas, del mismo tipo que `bulkEditProjection.ts`,
   y se prueban directamente sin montar React.
3. Lo caro de este datasheet no es la tabla sino el **teclado y la
   accesibilidad**: foco itinerante en `role="grid"`, selección distinta del
   foco, y la costura `Enter`/`F2` que CRI-82 necesita. TanStack es *headless* y
   no resuelve nada de eso.
4. La edición de celdas de TanStack es «trae la tuya»: no ahorraría trabajo en
   CRI-82.

**Cuándo reabrir la decisión:** cuando se pidan a la vez columnas
redimensionables/reordenables/fijadas, agrupación con subtotales, o
virtualización por encima de ~10 000 filas. Entonces `@tanstack/react-table` +
`@tanstack/react-virtual` sí ahorran más de lo que cuestan, y la frontera para
adoptarlos ya está aislada en `datasheetModel.ts`.

### Ruta canónica de `loadCases` y `combinations`

Verificado en el código, no inventado:

- `ProjectCommand` sólo puede describir las colecciones de
  `ProjectEntityCollection` (`projectCommand.ts`): `nodes`, `members`,
  `nodalLoads`, `memberLoads`, `prescribedDisplacements` y
  `memberInitialEffects`. **`loadCases` y `combinations` no están ahí**, así que
  `executeProjectCommand` no puede expresar un cambio sobre ellos: `diffProjects`
  produciría un parche vacío.
- La única ruta existente es `updateProject(updater)` de `useProjectModel`, que
  es la que ya usa el Inspector para crear casos, activarlos, renombrarlos y
  escribir los factores de las combinaciones. Esa ruta **sí** es reversible:
  pasa por `commitReversibleProjectChange`, registra historial e invalida el
  análisis.

**Contrato para CRI-82:** casos y combinaciones se editan por `updateProject`.
Si se quisiera la misma semántica de comando (parche, inverso, precondiciones),
lo correcto es **ampliar `ProjectEntityCollection`**, no crear una ruta paralela
desde el datasheet. Eso es un ticket propio y queda fuera de CRI-81 y CRI-82.

En esta fase, casos y combinaciones aparecen sólo como referencia de lectura: el
nombre del caso de cada carga en las tarjetas de preview.

## Modelo de columnas y editabilidad

Cada columna declara desde ahora **por qué** una celda no se edita:

| `editability` | Significado | Ejemplos |
|---|---|---|
| `identity` | Nunca editable. Identidad y referencias estructurales. | `id` de nudo y miembro, `i`, `j` |
| `derived` | Nunca editable. Se calcula del modelo. | longitud, número de cargas, restricciones |
| `pending` | Editable, pero no en esta fase. La abre CRI-82. | `x`, `y`, apoyo, tipo, `E`, `A`, `I` |

`Enter`/`F2` sobre una celda anuncia el motivo exacto en una región viva. Ni se
ofrece una edición que no existe ni se ignora la pulsación en silencio.

## Teclado y accesibilidad

- `role="grid"` con `aria-rowcount`/`aria-colcount`, foco itinerante
  (`tabIndex` 0 sólo en la celda enfocada) y anillo de foco visible.
- Flechas: mueven el foco una celda, con tope en los bordes.
- `Home`/`End`: primera/última columna de la fila. `Ctrl` las lleva a la primera
  y última celda de la rejilla. `AvPág`/`RePág`: diez filas.
- `Enter`: selecciona la fila (sustituye la selección) y anuncia la editabilidad
  de la celda enfocada. `F2`: sólo el anuncio.
- `Ctrl`+`Espacio`: alterna la fila dentro de una selección múltiple.
- `Esc`: si hay selección, la limpia y detiene la propagación; si no la hay, deja
  que el Drawer se cierre.
- **La selección no es el foco.** Se dibujan distintas: el foco es un anillo, la
  selección es un fondo y `aria-selected`.

## Lenguaje visual

- **Tabla plana**, sin relieve por fila: el nivel `flat` de `Surface` existe
  exactamente para las zonas técnicas densas.
- **Clay** para lo demás: cabecera, controles, chips de filtro y las tarjetas del
  panel contextual (`raised`).
- Se respetan los tokens y el brandbook existentes; no se introduce color nuevo.

## Panel contextual

Cinco tarjetas de sólo lectura, alimentadas por la fila enfocada:

| Tarjeta | Contenido | Reutiliza |
|---|---|---|
| Nodo | Posición en el modelo y encuadre local | encuadre de `InspectorSelectionPreview` |
| Apoyo | Símbolo del apoyo y restricciones activas | glifos de `InspectorSelectionPreview` |
| Material | Catálogo o personalizado, con `E`, `G` y densidad | `standardMaterials` |
| Sección | Forma a escala, o rectangular equivalente | `sectionGeometry` + `SectionShape` |
| Carga | Cargas del objeto con su caso y magnitudes | — |

Un miembro muestra Material, Sección y Carga; un nudo muestra Nodo, Apoyo y
Carga. Ninguna escribe.

## Superficie

El datasheet se abre como **Drawer modal a pantalla completa**, igual que Model
Doctor, mandado por el comando de workspace `open-datasheet` desde la paleta y
desde la barra superior.

Consecuencia asumida: con el lienzo inerte, la sincronización sólo es visible al
cerrar. Por eso la acción **Enfocar** emite `focus-object` **y cierra el
datasheet**, para que el objeto quede centrado y a la vista en el mismo gesto.

## Verificación

- Pruebas unitarias del modelo puro y de la navegación.
- Pruebas de componente de la rejilla, la sincronización y la accesibilidad.
- `npm run typecheck` y las pruebas de los archivos tocados.
- Smoke de navegador del flujo principal.
