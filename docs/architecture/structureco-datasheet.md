# Datasheet estructural — contrato vigente

**Clasificación:** `CANONICAL`

Contrato del datasheet estructural (`src/features/datasheet/**`) tras CRI-81, la
fase de auditoría, y CRI-82, la de edición. Recoge las decisiones que una fase
siguiente no debe volver a tomar por su cuenta: **con qué se construye la
rejilla**, **por dónde se escribe**, y **qué no hace la hoja aunque parezca que
debería**.

## Qué es el datasheet

Una proyección tabular del `ProjectModel` para auditar y editar el modelo entero:
buscar, ordenar, filtrar, ver el detalle visual del objeto enfocado y escribirlo.

**No es un modelo paralelo.** No tiene store, ni historial, ni undo propios:

| Qué | Dónde vive |
|---|---|
| Filas | `projectDatasheetRows(project, entity)`, función pura, sin caché |
| Selección | `useWorkspaceUI().selection`, la misma que el lienzo y el Inspector |
| Escritura | `updateProject` de `useProjectModel`, una sola vez por aplicación |
| Borrador | Estado local del panel; muere al aplicar, al cancelar o al cerrar |
| Vista (entidad, búsqueda, filtros, orden, foco) | Estado local del panel; muere al cerrar |

Una selección de varias filas produce `{ kind: 'multi', nodeIds, memberIds }`,
que es exactamente lo que ya consumen el lienzo, el Inspector y la edición
múltiple. El datasheet no inventa un formato de selección propio.

## Entidades

Tres pestañas: **Nudos**, **Barras** y **Cargas**.

La tabla de cargas es la **unión** de las familias `nodalLoads` y `memberLoads`.
Una celda que no pertenece a la familia de su fila se proyecta como ausencia
(`value: null`) y no se edita, con el motivo `load-family` — el mismo vocabulario
que usa la edición múltiple. Una repartida no tiene un `Fx` que valga cero: tiene
un `Fx` que no existe.

**`Selection.multi` no se amplía.** Transporta sólo nudos y miembros, así que la
tabla de cargas sincroniza como mucho la fila enfocada
(`{ kind: 'nodalLoad' | 'memberLoad', id }`, que el lienzo y el Inspector ya
consumen). Editar varias cargas no lo necesita, porque las ediciones son por
celda.

## Modelo de interacción

**Las ediciones son por celda, nunca «aplica este valor a la selección».** Un
editor tabular no necesita el modelo «una intención, muchos destinos» de la
edición múltiple, porque cada fila lleva su propio valor.

| Entrada | Camino |
|---|---|
| Celda inline, `Enter`, borrador vacío | Aplica ya: un `updateProject`, historial normal |
| Editor visual del panel | Borrador con preview vivo → `Aplicar` / `Cancelar` |
| Pegado, o varias celdas ya pendientes desde la rejilla | Revisión → `Aplicar todo` / `Cancelar` |

La regla es única: **si el borrador está vacío y la celda es válida, se aplica; si
no, la celda se suma al borrador.** Pedir «Aplicar» por cada celda haría
inservible una hoja de datos; aplicar en silencio un bloque de cincuenta celdas
sería peor.

Los editores del panel son de borrador aunque el usuario toque un solo campo,
porque ninguno toca un solo campo del modelo: el material escribe identidad, E, G
y densidad; el apoyo escribe tipo, ángulo y tres restricciones.

**La revisión no sustituye al panel mientras se edita en él.** El panel ya enseña
el preview, el error junto a su campo y su propia barra de `Aplicar`; cambiárselo
al usuario le quitaría justo lo que estaba mirando. Sólo un borrador venido de la
rejilla —que no tiene dónde explicar un cambio pendiente— o de un pegado abre la
revisión.

### Atomicidad

Todo lo que se aplica pasa por **un solo** `updateProject(updater)`. `updater`
recibe un clon, escribe el plan entero y devuelve el resultado; `ProjectContext`
registra una entrada de historial e invalida el análisis. Una sola entrada
inválida deshabilita `Aplicar`, y `applyDatasheetPlan` devuelve el proyecto **por
identidad** cuando el plan no es aplicable: no existe camino por el que se
escriba una parte.

## Ruta de escritura: por qué `updateProject`

Verificado en el código, no supuesto:

- `NodeBulkChanges` (`src/commands/projectCommand.ts`) declara `supportType`,
  `angleDeg`, `restrainX/Y/R` e `internalHinge`. **No tiene `x` ni `y`.**
- `bulkPropertyDescriptors` (`src/features/bulk-edit/bulkEditProperties.ts`)
  tampoco declara `node.x` ni `node.y`.

La coordenada de un nudo **no es expresable como `ProjectCommand`**. Repartir la
escritura entre `selection.bulk.apply` y `updateProject` produciría dos entradas
de historial para un pegado que mezclara coordenadas con E, A o I, que es
exactamente la escritura parcial que hay que impedir. Por eso el datasheet
escribe siempre por `updateProject`, la misma ruta reversible que el Inspector ya
usa para las coordenadas de un nudo, para los casos de carga y para los factores
de las combinaciones.

**Qué reutiliza de `src/features/bulk-edit/`:** los descriptores de propiedad
(`bulkEditProperties.ts`), que ya declaran qué admite cada entidad y por qué la
rechaza; el catálogo agrupado (`bulkCatalogOptions`); y el vocabulario de
incompatibilidad (`member-type`, `support-type`, `load-family`). Lo que **no**
reutiliza es el comando, porque el comando no puede expresar la mitad del
alcance.

**Si alguna vez se quisiera la semántica completa de comando** —parche, inverso,
precondiciones e instantánea de obsolescencia—, lo correcto es ampliar
`NodeBulkChanges` con `x` e `y`, no abrir una ruta paralela. Eso es un ticket
propio.

## Contrato: casos de carga y combinaciones

`ProjectCommand` sólo puede describir las colecciones declaradas en
`ProjectEntityCollection`:

```text
nodes · members · nodalLoads · memberLoads · prescribedDisplacements · memberInitialEffects
```

`loadCases` y `combinations` **no están en esa lista**, así que
`executeProjectCommand` no puede expresar un cambio sobre ellos: `diffProjects`
produciría un parche vacío. La ruta canónica es `updateProject`, la misma que usa
todo lo demás en esta hoja.

En el datasheet, casos y combinaciones son referencia de lectura y **destino** de
una carga: la columna `case` de la tabla de cargas mueve la carga de caso, que es
un cambio sobre `nodalLoads` o `memberLoads`, no sobre `loadCases`.

## Contrato de editabilidad

Cada columna declara **por qué** no se edita, o **dónde** se edita, y `Enter`/`F2`
lo anuncia en una región viva en vez de callarse:

| `editability` | Significado | Ejemplos |
|---|---|---|
| `identity` | Nunca editable. Identidad y referencias estructurales. | `id` de nudo, barra y carga; `i`, `j`; objeto y familia de una carga |
| `derived` | Nunca editable. Se calcula del modelo. | longitud, restricciones, origen, nº de cargas |
| `inline` | Editable en la propia celda. | `x`, `y`, apoyo, rótula, tipo, `E`, `A`, `I`, material, sección, magnitudes y caso de una carga |
| `panel` | Editable sólo en el editor visual, porque escribe varios campos a la vez. | liberaciones |

`aria-readonly` sigue exactamente a este contrato: es `true` en `identity` y
`derived`, y `false` en `inline` y `panel`. Anunciarlo en una celda que sí se
edita mandaría al lector de pantalla al sitio equivocado.

Cambiar una celda `identity` a editable es un cambio de contrato, no un detalle
de interfaz. Convertir una repartida en puntual tampoco es editar un campo: es
sustituir la carga por otra con otros campos obligatorios.

## Unidades

Las filas llevan magnitudes en **unidades base internas** (kN, m, m², m⁴). La
conversión al sistema del proyecto ocurre al presentar
(`datasheetPresentation.ts`) y al interpretar (`datasheetEditDraft.ts`), en
ningún otro sitio. Si el orden dependiera de las unidades mostradas, la misma
columna ordenaría distinto en `kN-m` y en `kip-ft`.

El borrador guarda **la cadena tal como se teclea**, sin interpretar: hacerlo en
cada pulsación convertiría un `1.` a medio escribir en `NaN`. Un pegado se
interpreta con las mismas reglas, porque los números pegados están en las
unidades **mostradas**, que es lo que el usuario copió de esta misma tabla.

## Validación

El plan se valida entero antes de ofrecerse. Un error deja el plan completo sin
aplicar: no hay «aplica lo que sea válido».

| Regla | Motivo |
|---|---|
| Número interpretable | Una celda que no es número no se escribe como `NaN` |
| `E`, `A`, `I` > 0 | Un valor no positivo hace singular la matriz de rigidez |
| Enumerados dentro de su unión | `optionsOf` ya fija el dominio en bulk-edit |
| Identidad presente en el catálogo | Un id que el catálogo no reconoce no respalda ni origen ni números |
| `0 ≤ start ≤ end ≤ 1`, `0 ≤ position ≤ 1` | Posiciones normalizadas del modelo |
| Campo de la familia de la fila | Un momento no tiene `qyStart` donde escribirlo |

## La hoja no repara topología

El Inspector ejecuta `repairProjectTopology` al mover un nudo, de modo que dos
nudos que quedan en el mismo punto se fusionan. **El datasheet no lo hace**, y es
una diferencia deliberada: un pegado de cincuenta coordenadas podría borrar filas
en silencio, y borrar entidades no es lo que el usuario pidió al escribir un
número.

En su lugar, la revisión avisa de qué nudos quedarían coincidentes y remite al
Model Doctor, que es la ruta explícita y reversible para repararlo
(`topology.repair`). El aviso **no bloquea**: el modelo queda tal como se tecleó.

## Decisión: rejilla propia, sin TanStack Table

**Estado:** vigente desde CRI-81, confirmada en CRI-82.
**Decisión:** `<table role="grid">` propia sobre módulos puros
(`datasheetModel.ts` + `datasheetGridNavigation.ts`). **`@tanstack/react-table`
no se instala.**

**Por qué:**

1. `AGENTS.md` prohíbe añadir dependencias sin autorización explícita.
2. Ordenar, filtrar y definir columnas son aquí funciones puras del mismo tipo
   que `bulkEditProjection.ts`, y se prueban sin montar React.
3. Lo caro de esta rejilla no es la tabla sino el teclado y la accesibilidad:
   foco itinerante en `role="grid"`, selección distinta del foco, y la costura
   `Enter`/`F2` de la edición. TanStack es *headless* y no resuelve nada de eso.
4. Su edición de celdas es «trae la tuya». CRI-82 lo confirmó: el editor, el
   anclaje del pegado y la devolución del foco se escribieron enteros aquí, y
   TanStack no habría ahorrado ninguno.

**Cuándo reabrirla:** cuando se pidan a la vez columnas
redimensionables/reordenables/fijadas, agrupación con subtotales, o
virtualización por encima de ~10 000 filas. La frontera para adoptarlo ya está
aislada en `datasheetModel.ts`, que no depende de React.

## Superficie

Se abre como Drawer modal desde el comando de workspace `open-datasheet` (barra
superior y paleta de comandos). Con el lienzo inerte, la acción **Enfocar** emite
`focus-object` **y cierra la hoja**, para que el objeto quede centrado y visible
en el mismo gesto.

**La revisión no es un `Dialog`.** `ModalSurface` registra su `keydown` de
`Escape` en `document` y no detiene la propagación, así que un diálogo anidado
dentro de este Drawer cerraría los dos con una sola pulsación. La revisión vive
dentro del Drawer, en el carril del panel contextual, y hereda su foco atrapado.

## Teclado

`role="grid"` con `aria-rowcount`/`aria-colcount` y foco itinerante: la rejilla
entera es una sola parada de tabulación.

| Tecla | Efecto |
|---|---|
| Flechas | Mueven el foco una celda; topan en los bordes, no envuelven |
| `Inicio` / `Fin` | Primera / última columna de la fila |
| `Ctrl`+`Inicio` / `Ctrl`+`Fin` | Primera / última celda de la tabla |
| `RePág` / `AvPág` | Diez filas |
| `Intro` | Selecciona la fila y abre el editor, o anuncia por qué no |
| `F2` | Abre el editor sin tocar la selección, o anuncia por qué no |
| `Esc` | Dentro del editor, cancela la celda; fuera, limpia la selección y después cierra |
| `Ctrl`+`Espacio` | Alterna la fila dentro de la selección múltiple |
| `Ctrl`+`V` | Pega el bloque anclado en la celda enfocada |

**El foco no es la selección.** El foco se dibuja como anillo, la selección como
fondo con `aria-selected`, y un cambio pendiente como marca en el borde de
inicio: tres señales distintas porque las tres pueden coincidir en la misma
celda. Al cerrarse, el editor devuelve el foco a su celda.

## Verificación

```bash
npx vitest run src/features/datasheet --maxWorkers=1
npx tsc --noEmit -p tsconfig.app.json
```

| Archivo | Qué fija |
|---|---|
| `datasheetModel.test.ts` | Proyección, unidades base, búsqueda, facetas, orden y editabilidad |
| `datasheetEditModel.test.ts` | Cobertura de columnas, herencia de bulk-edit y elegibilidad |
| `datasheetEditDraft.test.ts` | Interpretación, unidades, cada regla de validación y el aviso de coincidencia |
| `datasheetEditApply.test.ts` | Escritura exacta, degradación de origen y plan inválido sin efecto |
| `datasheetPaste.test.ts` | Anclaje, recorte contado y familias de carga |
| `datasheetGridNavigation.test.ts` | Topes, extremos y reencaje del foco |
| `DatasheetPanel.test.tsx` | Proyección viva, sincronización de selección y previews |
| `DatasheetEditing.test.tsx` | Cambio simple, pegado atómico y bloqueo por error |
| `DatasheetEditorPanel.test.tsx` | Previews vivos y borrador del panel |
| `DatasheetAccessibility.test.tsx` | Rejilla, foco itinerante, anuncios y rótulos del editor |
| `datasheetStyles.test.ts` | Tokens Clay, tabla plana y tres señales distintas |

## Historia

- [Diseño de CRI-81](../superpowers/specs/2026-08-13-structural-datasheet-cri-81-design.md) — fase de auditoría; no prueba el estado actual.
- [Diseño de CRI-82](../superpowers/specs/2026-08-14-datasheet-editor-cri-82-design.md) — fase de edición; no prueba el estado actual.
