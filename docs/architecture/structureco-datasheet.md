# Datasheet estructural â€” contrato vigente

**Clasificación:** `CANONICAL`

Contrato del datasheet estructural (`src/features/datasheet/**`) tras CRI-81, la
fase de auditorÃ­a, y CRI-82, la de ediciÃ³n. Recoge las decisiones que una fase
siguiente no debe volver a tomar por su cuenta: **con quÃ© se construye la
rejilla**, **por dÃ³nde se escribe**, y **quÃ© no hace la hoja aunque parezca que
deberÃ­a**.

## QuÃ© es el datasheet

Una proyecciÃ³n tabular del `ProjectModel` para auditar y editar el modelo entero:
buscar, ordenar, filtrar, ver el detalle visual del objeto enfocado y escribirlo.

**No es un modelo paralelo.** No tiene store, ni historial, ni undo propios:

| QuÃ© | DÃ³nde vive |
|---|---|
| Filas | `projectDatasheetRows(project, entity)`, funciÃ³n pura, sin cachÃ© |
| SelecciÃ³n | `useWorkspaceUI().selection`, la misma que el lienzo y el Inspector |
| Escritura | `updateProject` de `useProjectModel`, una sola vez por aplicaciÃ³n |
| Borrador | Estado local del panel; muere al aplicar, al cancelar o al cerrar |
| Vista (entidad, bÃºsqueda, filtros, orden, foco) | Estado local del panel; muere al cerrar |

Una selecciÃ³n de varias filas produce `{ kind: 'multi', nodeIds, memberIds }`,
que es exactamente lo que ya consumen el lienzo, el Inspector y la ediciÃ³n
mÃºltiple. El datasheet no inventa un formato de selecciÃ³n propio.

## Entidades

Tres pestaÃ±as: **Nudos**, **Barras** y **Cargas**.

La tabla de cargas es la **uniÃ³n** de las familias `nodalLoads` y `memberLoads`.
Una celda que no pertenece a la familia de su fila se proyecta como ausencia
(`value: null`) y no se edita, con el motivo `load-family` â€” el mismo vocabulario
que usa la ediciÃ³n mÃºltiple. Una repartida no tiene un `Fx` que valga cero: tiene
un `Fx` que no existe.

**`Selection.multi` no se amplÃ­a.** Transporta sÃ³lo nudos y miembros, asÃ­ que la
tabla de cargas sincroniza como mucho la fila enfocada
(`{ kind: 'nodalLoad' | 'memberLoad', id }`, que el lienzo y el Inspector ya
consumen). Editar varias cargas no lo necesita, porque las ediciones son por
celda.

## Modelo de interacciÃ³n

**Las ediciones son por celda, nunca Â«aplica este valor a la selecciÃ³nÂ».** Un
editor tabular no necesita el modelo Â«una intenciÃ³n, muchos destinosÂ» de la
ediciÃ³n mÃºltiple, porque cada fila lleva su propio valor.

| Entrada | Camino |
|---|---|
| Celda inline, `Enter`, borrador vacÃ­o | Aplica ya: un `updateProject`, historial normal |
| Editor visual del panel | Borrador con preview vivo â†’ `Aplicar` / `Cancelar` |
| Pegado, o varias celdas ya pendientes desde la rejilla | RevisiÃ³n â†’ `Aplicar todo` / `Cancelar` |

La regla es Ãºnica: **si el borrador estÃ¡ vacÃ­o y la celda es vÃ¡lida, se aplica; si
no, la celda se suma al borrador.** Pedir Â«AplicarÂ» por cada celda harÃ­a
inservible una hoja de datos; aplicar en silencio un bloque de cincuenta celdas
serÃ­a peor.

Los editores del panel son de borrador aunque el usuario toque un solo campo,
porque ninguno toca un solo campo del modelo: el material escribe identidad, E, G
y densidad; el apoyo escribe tipo, Ã¡ngulo y tres restricciones.

**La revisiÃ³n no sustituye al panel mientras se edita en Ã©l.** El panel ya enseÃ±a
el preview, el error junto a su campo y su propia barra de `Aplicar`; cambiÃ¡rselo
al usuario le quitarÃ­a justo lo que estaba mirando. SÃ³lo un borrador venido de la
rejilla â€”que no tiene dÃ³nde explicar un cambio pendienteâ€” o de un pegado abre la
revisiÃ³n.

### Atomicidad

Todo lo que se aplica pasa por **un solo** `updateProject(updater)`. `updater`
recibe un clon, escribe el plan entero y devuelve el resultado; `ProjectContext`
registra una entrada de historial e invalida el anÃ¡lisis. Una sola entrada
invÃ¡lida deshabilita `Aplicar`, y `applyDatasheetPlan` devuelve el proyecto **por
identidad** cuando el plan no es aplicable: no existe camino por el que se
escriba una parte.

## Ruta de escritura: por quÃ© `updateProject`

Verificado en el cÃ³digo, no supuesto:

- `NodeBulkChanges` (`src/commands/projectCommand.ts`) declara `supportType`,
  `angleDeg`, `restrainX/Y/R` e `internalHinge`. **No tiene `x` ni `y`.**
- `bulkPropertyDescriptors` (`src/features/bulk-edit/bulkEditProperties.ts`)
  tampoco declara `node.x` ni `node.y`.

La coordenada de un nudo **no es expresable como `ProjectCommand`**. Repartir la
escritura entre `selection.bulk.apply` y `updateProject` producirÃ­a dos entradas
de historial para un pegado que mezclara coordenadas con E, A o I, que es
exactamente la escritura parcial que hay que impedir. Por eso el datasheet
escribe siempre por `updateProject`, la misma ruta reversible que el Inspector ya
usa para las coordenadas de un nudo, para los casos de carga y para los factores
de las combinaciones.

**QuÃ© reutiliza de `src/features/bulk-edit/`:** los descriptores de propiedad
(`bulkEditProperties.ts`), que ya declaran quÃ© admite cada entidad y por quÃ© la
rechaza; el catÃ¡logo agrupado (`bulkCatalogOptions`); y el vocabulario de
incompatibilidad (`member-type`, `support-type`, `load-family`). Lo que **no**
reutiliza es el comando, porque el comando no puede expresar la mitad del
alcance.

**Si alguna vez se quisiera la semÃ¡ntica completa de comando** â€”parche, inverso,
precondiciones e instantÃ¡nea de obsolescenciaâ€”, lo correcto es ampliar
`NodeBulkChanges` con `x` e `y`, no abrir una ruta paralela. Eso es un ticket
propio.

## Contrato: casos de carga y combinaciones

`ProjectCommand` sÃ³lo puede describir las colecciones declaradas en
`ProjectEntityCollection`:

```text
nodes Â· members Â· nodalLoads Â· memberLoads Â· prescribedDisplacements Â· memberInitialEffects
```

`loadCases` y `combinations` **no estÃ¡n en esa lista**, asÃ­ que
`executeProjectCommand` no puede expresar un cambio sobre ellos: `diffProjects`
producirÃ­a un parche vacÃ­o. La ruta canÃ³nica es `updateProject`, la misma que usa
todo lo demÃ¡s en esta hoja.

En el datasheet, casos y combinaciones son referencia de lectura y **destino** de
una carga: la columna `case` de la tabla de cargas mueve la carga de caso, que es
un cambio sobre `nodalLoads` o `memberLoads`, no sobre `loadCases`.

## Contrato de editabilidad

Cada columna declara **por quÃ©** no se edita, o **dÃ³nde** se edita, y `Enter`/`F2`
lo anuncia en una regiÃ³n viva en vez de callarse:

| `editability` | Significado | Ejemplos |
|---|---|---|
| `identity` | Nunca editable. Identidad y referencias estructurales. | `id` de nudo, barra y carga; `i`, `j`; objeto y familia de una carga |
| `derived` | Nunca editable. Se calcula del modelo. | longitud, restricciones, origen, nÂº de cargas |
| `inline` | Editable en la propia celda. | `x`, `y`, apoyo, rÃ³tula, tipo, `E`, `A`, `I`, material, secciÃ³n, magnitudes y caso de una carga |
| `panel` | Editable sÃ³lo en el editor visual, porque escribe varios campos a la vez. | liberaciones |

`aria-readonly` sigue exactamente a este contrato: es `true` en `identity` y
`derived`, y `false` en `inline` y `panel`. Anunciarlo en una celda que sÃ­ se
edita mandarÃ­a al lector de pantalla al sitio equivocado.

Cambiar una celda `identity` a editable es un cambio de contrato, no un detalle
de interfaz. Convertir una repartida en puntual tampoco es editar un campo: es
sustituir la carga por otra con otros campos obligatorios.

## Unidades

Las filas llevan magnitudes en **unidades base internas** (kN, m, mÂ², mâ´). La
conversiÃ³n al sistema del proyecto ocurre al presentar
(`datasheetPresentation.ts`) y al interpretar (`datasheetEditDraft.ts`), en
ningÃºn otro sitio. Si el orden dependiera de las unidades mostradas, la misma
columna ordenarÃ­a distinto en `kN-m` y en `kip-ft`.

El borrador guarda **la cadena tal como se teclea**, sin interpretar: hacerlo en
cada pulsaciÃ³n convertirÃ­a un `1.` a medio escribir en `NaN`. Un pegado se
interpreta con las mismas reglas, porque los nÃºmeros pegados estÃ¡n en las
unidades **mostradas**, que es lo que el usuario copiÃ³ de esta misma tabla.

## ValidaciÃ³n

El plan se valida entero antes de ofrecerse. Un error deja el plan completo sin
aplicar: no hay Â«aplica lo que sea vÃ¡lidoÂ».

| Regla | Motivo |
|---|---|
| NÃºmero interpretable | Una celda que no es nÃºmero no se escribe como `NaN` |
| `E`, `A`, `I` > 0 | Un valor no positivo hace singular la matriz de rigidez |
| Enumerados dentro de su uniÃ³n | `optionsOf` ya fija el dominio en bulk-edit |
| Identidad presente en el catÃ¡logo | Un id que el catÃ¡logo no reconoce no respalda ni origen ni nÃºmeros |
| `0 â‰¤ start â‰¤ end â‰¤ 1`, `0 â‰¤ position â‰¤ 1` | Posiciones normalizadas del modelo |
| Campo de la familia de la fila | Un momento no tiene `qyStart` donde escribirlo |

## La hoja no repara topologÃ­a

El Inspector ejecuta `repairProjectTopology` al mover un nudo, de modo que dos
nudos que quedan en el mismo punto se fusionan. **El datasheet no lo hace**, y es
una diferencia deliberada: un pegado de cincuenta coordenadas podrÃ­a borrar filas
en silencio, y borrar entidades no es lo que el usuario pidiÃ³ al escribir un
nÃºmero.

En su lugar, la revisiÃ³n avisa de quÃ© nudos quedarÃ­an coincidentes y remite al
Model Doctor, que es la ruta explÃ­cita y reversible para repararlo
(`topology.repair`). El aviso **no bloquea**: el modelo queda tal como se tecleÃ³.

## DecisiÃ³n: rejilla propia, sin TanStack Table

**Estado:** vigente desde CRI-81, confirmada en CRI-82.
**DecisiÃ³n:** `<table role="grid">` propia sobre mÃ³dulos puros
(`datasheetModel.ts` + `datasheetGridNavigation.ts`). **`@tanstack/react-table`
no se instala.**

**Por quÃ©:**

1. `AGENTS.md` prohÃ­be aÃ±adir dependencias sin autorizaciÃ³n explÃ­cita.
2. Ordenar, filtrar y definir columnas son aquÃ­ funciones puras del mismo tipo
   que `bulkEditProjection.ts`, y se prueban sin montar React.
3. Lo caro de esta rejilla no es la tabla sino el teclado y la accesibilidad:
   foco itinerante en `role="grid"`, selecciÃ³n distinta del foco, y la costura
   `Enter`/`F2` de la ediciÃ³n. TanStack es *headless* y no resuelve nada de eso.
4. Su ediciÃ³n de celdas es Â«trae la tuyaÂ». CRI-82 lo confirmÃ³: el editor, el
   anclaje del pegado y la devoluciÃ³n del foco se escribieron enteros aquÃ­, y
   TanStack no habrÃ­a ahorrado ninguno.

**CuÃ¡ndo reabrirla:** cuando se pidan a la vez columnas
redimensionables/reordenables/fijadas, agrupaciÃ³n con subtotales, o
virtualizaciÃ³n por encima de ~10 000 filas. La frontera para adoptarlo ya estÃ¡
aislada en `datasheetModel.ts`, que no depende de React.

## Superficie

Se abre como Drawer modal desde el comando de workspace `open-datasheet` (barra
superior y paleta de comandos). Con el lienzo inerte, la acciÃ³n **Enfocar** emite
`focus-object` **y cierra la hoja**, para que el objeto quede centrado y visible
en el mismo gesto.

**La revisiÃ³n no es un `Dialog`.** `ModalSurface` registra su `keydown` de
`Escape` en `document` y no detiene la propagaciÃ³n, asÃ­ que un diÃ¡logo anidado
dentro de este Drawer cerrarÃ­a los dos con una sola pulsaciÃ³n. La revisiÃ³n vive
dentro del Drawer, en el carril del panel contextual, y hereda su foco atrapado.

## Teclado

`role="grid"` con `aria-rowcount`/`aria-colcount` y foco itinerante: la rejilla
entera es una sola parada de tabulaciÃ³n.

| Tecla | Efecto |
|---|---|
| Flechas | Mueven el foco una celda; topan en los bordes, no envuelven |
| `Inicio` / `Fin` | Primera / Ãºltima columna de la fila |
| `Ctrl`+`Inicio` / `Ctrl`+`Fin` | Primera / Ãºltima celda de la tabla |
| `RePÃ¡g` / `AvPÃ¡g` | Diez filas |
| `Intro` | Selecciona la fila y abre el editor, o anuncia por quÃ© no |
| `F2` | Abre el editor sin tocar la selecciÃ³n, o anuncia por quÃ© no |
| `Esc` | Dentro del editor, cancela la celda; fuera, limpia la selecciÃ³n y despuÃ©s cierra |
| `Ctrl`+`Espacio` | Alterna la fila dentro de la selecciÃ³n mÃºltiple |
| `Ctrl`+`V` | Pega el bloque anclado en la celda enfocada |

**El foco no es la selecciÃ³n.** El foco se dibuja como anillo, la selecciÃ³n como
fondo con `aria-selected`, y un cambio pendiente como marca en el borde de
inicio: tres seÃ±ales distintas porque las tres pueden coincidir en la misma
celda. Al cerrarse, el editor devuelve el foco a su celda.

## VerificaciÃ³n

```bash
npx vitest run src/features/datasheet --maxWorkers=1
npx tsc --noEmit -p tsconfig.app.json
```

| Archivo | QuÃ© fija |
|---|---|
| `datasheetModel.test.ts` | ProyecciÃ³n, unidades base, bÃºsqueda, facetas, orden y editabilidad |
| `datasheetEditModel.test.ts` | Cobertura de columnas, herencia de bulk-edit y elegibilidad |
| `datasheetEditDraft.test.ts` | InterpretaciÃ³n, unidades, cada regla de validaciÃ³n y el aviso de coincidencia |
| `datasheetEditApply.test.ts` | Escritura exacta, degradaciÃ³n de origen y plan invÃ¡lido sin efecto |
| `datasheetPaste.test.ts` | Anclaje, recorte contado y familias de carga |
| `datasheetGridNavigation.test.ts` | Topes, extremos y reencaje del foco |
| `DatasheetPanel.test.tsx` | ProyecciÃ³n viva, sincronizaciÃ³n de selecciÃ³n y previews |
| `DatasheetEditing.test.tsx` | Cambio simple, pegado atÃ³mico y bloqueo por error |
| `DatasheetEditorPanel.test.tsx` | Previews vivos y borrador del panel |
| `DatasheetAccessibility.test.tsx` | Rejilla, foco itinerante, anuncios y rÃ³tulos del editor |
| `datasheetStyles.test.ts` | Tokens Clay, tabla plana y tres seÃ±ales distintas |

## Historia

- CRI-81 — fase inicial de auditoría del datasheet.
- CRI-82 — fase de edición tabular y operaciones de pegado en masa.
