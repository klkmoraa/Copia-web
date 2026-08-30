# Datasheet como editor estructural — CRI-82 (fase 2 de CRI-41)

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Describe el diseño con el que se ejecutó CRI-82 y no prueba el
> estado actual del producto. El contrato vigente es
> [Datasheet estructural](../../architecture/structureco-datasheet.md),
> el código y sus pruebas.

## Problema

CRI-81 dejó una hoja de datos que se lee bien y no se puede tocar. Para cambiar
la coordenada de un nudo, el material de veinte barras o el caso de una carga hay
que volver al Inspector, objeto a objeto, y perder de vista la tabla que dio el
diagnóstico. Además, cuando por fin se escribe, no se ve qué se está creando
hasta después de haberlo creado.

## Objetivo de esta fase

Convertir el datasheet en un **editor estructural visual y seguro**: editar las
propiedades que CRI-81 declaró `pending`, ver en vivo el material, la sección, el
apoyo, la carga o el nudo resultante **antes** de aplicarlo, y garantizar que un
cambio múltiple o un pegado entra entero o no entra.

## No objetivos

- Store, historial o undo propios del datasheet. Sigue prohibido.
- Tocar el solver, la teoría estructural o las dependencias.
- Ampliar `ProjectCommand` ni `ProjectEntityCollection`.
- Ampliar `Selection` con una familia nueva.
- Pestañas de casos de carga y combinaciones.
- Reparar la topología desde la hoja (ver «Coincidencia de nudos»).

## Modelo de interacción

La decisión que ordena todo lo demás: **las ediciones son por celda, nunca
«aplica este valor a la selección»**. Un editor tabular no necesita el modelo
«una intención, muchos destinos» de la edición múltiple, porque cada fila lleva
su propio valor. La consecuencia es que la selección del workspace sigue siendo
exactamente la de CRI-81 y el datasheet no inventa ningún formato propio.

| Entrada | Camino |
|---|---|
| Celda inline, `Enter`, borrador vacío | Aplica ya: un `updateProject`, historial normal |
| Editor visual del panel (multi-campo) | Borrador con preview vivo → `Aplicar` / `Cancelar` |
| Pegado, o varias celdas ya pendientes | Diálogo de revisión → `Aplicar todo` / `Cancelar` |

La regla es única y explicable: **si el borrador está vacío y la celda es válida,
se aplica; si no, la celda se suma al borrador.** No hay dos modos que el usuario
tenga que elegir, y en todo momento la barra del borrador dice cuántos cambios
hay pendientes.

Los editores del panel son de borrador aunque toquen un solo campo porque ninguno
de ellos toca un solo campo: el material escribe identidad, E, G y densidad; el
apoyo escribe tipo, ángulo y tres restricciones; la carga escribe magnitud,
dirección y caso. Aplicarlos a mitad de camino escribiría estados que el usuario
no pidió.

### Atomicidad

Todo lo que se aplica pasa por **un solo** `updateProject(updater)`. `updater`
recibe un clon del proyecto, escribe el plan entero y devuelve el resultado;
`ProjectContext` registra una entrada de historial e invalida el análisis. Una
sola entrada inválida deshabilita `Aplicar`, así que no existe camino por el que
se escriba una parte del plan.

### Ruta de escritura: por qué `updateProject` y no `selection.bulk.apply`

Verificado en el código, no supuesto:

- `NodeBulkChanges` (`src/commands/projectCommand.ts`) declara `supportType`,
  `angleDeg`, `restrainX/Y/R` e `internalHinge`. **No tiene `x` ni `y`.**
- `bulkPropertyDescriptors` (`src/features/bulk-edit/bulkEditProperties.ts`)
  tampoco declara `node.x` ni `node.y`.

Es decir: la coordenada de un nudo no es expresable como `ProjectCommand`. Las
tres salidas posibles y por qué se elige la primera:

1. **Un solo `updateProject` por aplicación.** Atómico por construcción, una
   entrada de historial, no toca `ProjectCommand`. Es la ruta elegida.
2. `selection.bulk.apply` donde alcanza + `updateProject` para X/Y. Rechazada:
   un pegado que mezcle coordenadas con E, A o I produciría **dos** entradas de
   historial, que es exactamente la escritura parcial que hay que impedir.
3. Ampliar `NodeBulkChanges` con `x` e `y`. Rechazada en esta fase: amplía el
   contrato de comandos para un caso que la ruta reversible ya cubre.

`updateProject` es la misma ruta que el Inspector usa hoy para las coordenadas de
un nudo (`InspectorProperties.tsx`), para los casos de carga y para los factores
de las combinaciones. No es una ruta paralela: es la documentada en CRI-81.

**Qué reutiliza entonces de `src/features/bulk-edit/`:** los descriptores de
propiedad (`bulkEditProperties.ts`), que ya declaran qué admite cada entidad y
por qué la rechaza; la presentación (`bulkEditPresentation.ts`), con sus catálogos
de material y sección ya agrupados; y el vocabulario de incompatibilidad
(`member-type`, `support-type`, `load-family`). Lo que no reutiliza es el
*comando*, porque el comando no puede expresar la mitad del alcance.

## Arquitectura

```
                     ┌──────────────────────────────────────────┐
   celda inline ────►│                                          │
   editor panel ────►│  DatasheetEditDraft   (rowId+fieldId→str)│
   pegado       ────►│                                          │
                     └───────────────────┬──────────────────────┘
                                         │ interpretar · unidades · validar
                                         ▼
                              DatasheetEditPlan  (base, before→after, errores)
                                    │                     │
                    applyDatasheetPlan(clon)         revisión / previews
                                    │                     │
                                    ▼                     ▼
                        updateProject(updater)      proyecto de preview
                          → historial normal        → SVG, SectionViewer2D…
```

Los previews y la escritura comparten `applyDatasheetPlan`. Es lo que garantiza
que lo que se ve es lo que se escribe: no hay dos caminos que puedan divergir.

### Módulos

| Archivo | Responsabilidad | Puro |
|---|---|---|
| `datasheetEditModel.ts` | Registro de campos editables por entidad y columna. | sí |
| `datasheetEditDraft.ts` | Borrador, interpretación, conversión de unidades y validación. | sí |
| `datasheetEditApply.ts` | `applyDatasheetPlan(project, plan)`, la única escritura. | sí |
| `datasheetPaste.ts` | TSV/CSV a entradas del borrador, con reporte de recorte. | sí |
| `datasheetModel.ts` | Extendido: entidad `loads` y nueva unión de editabilidad. | sí |
| `DatasheetCellEditor.tsx` | Editor dentro de la celda enfocada. | no |
| `DatasheetEditorPanel.tsx` | Editores visuales con Antes → Después. | no |
| `DatasheetReviewDialog.tsx` | Revisión del plan; `Aplicar todo` / `Cancelar`. | no |

### Campos editables

`datasheetEditModel.ts` mapea cada columna `pending` de CRI-81 a un campo del
modelo. Todos los que bulk-edit ya declara se leen de `bulkPropertyDescriptors`
en vez de volver a describirlos; `node.x` y `node.y` son las dos únicas entradas
nuevas, porque son las dos que ningún registro previo tiene.

## Contrato de editabilidad

`DatasheetEditability` deja de tener `pending`, que era una promesa, y pasa a
decir **dónde** se edita cada celda:

| Valor | Significado | Ejemplos |
|---|---|---|
| `identity` | Nunca editable. Identidad y referencias estructurales. | `id`, `i`, `j`, nudo o barra de una carga |
| `derived` | Nunca editable. Se calcula del modelo. | longitud, restricciones, origen, nº de cargas |
| `inline` | Editable en la celda. | `x`, `y`, apoyo, rótula, tipo, `E`, `A`, `I`, magnitudes de carga |
| `panel` | Editable sólo en el editor visual, porque escribe varios campos a la vez. | liberaciones, material personalizado |

Las referencias sensibles siguen siendo `identity`: cambiar el `i` de una barra o
el nudo de una carga no es editar una propiedad, es reconectar la topología, y
eso tiene sus propias operaciones.

## Pestaña de Cargas

La tabla gana una tercera entidad. Sus columnas son la **unión** de las familias
`nodalLoad` y `memberLoad`; una celda que no pertenece a la familia de su fila se
muestra como `—` y no se edita, con el motivo `load-family`, que es el vocabulario
que la edición múltiple ya usa para exactamente este caso.

**Selección.** Una fila seleccionada produce `{ kind: 'nodalLoad' | 'memberLoad',
id }`, que el lienzo y el Inspector ya consumen. `Selection.multi` transporta
sólo `nodeIds` y `memberIds`, y **no se amplía**: como las ediciones son por
celda, editar varias cargas nunca necesita una selección múltiple de cargas.

**Familia y destino son `identity`.** Cambiar una repartida a puntual no es
editar un campo: es sustituir una carga por otra de otra familia, con otros
campos obligatorios. Se crea y se borra, no se transmuta.

## Unidades

- La celda **muestra** en las unidades del proyecto (`datasheetPresentation.ts`).
- El borrador guarda **la cadena tal como se teclea**, sin interpretar. Interpretar
  en cada pulsación convertiría `1.` o `-` en `NaN` mientras el usuario escribe.
- La interpretación hace `fromDisplay(valor, units, quantity)` y deja el plan en
  **unidades base**.
- `datasheetModel.ts` sigue ordenando y filtrando en unidades base. El invariante
  de CRI-81 no se toca.

Un pegado se interpreta con las mismas reglas: los números pegados están en las
unidades **mostradas**, que es lo que el usuario copió de esta misma tabla.

## Validación

El plan se valida entero antes de ofrecerse. Reglas, todas del dominio que ya
existe:

| Regla | Motivo |
|---|---|
| Número interpretable | Una celda que no es número no se escribe como `NaN` |
| `E`, `A`, `I` > 0 | Un valor no positivo hace singular la matriz de rigidez |
| Enumerados dentro de su unión | `optionsOf` ya fija el dominio en bulk-edit |
| `0 ≤ start ≤ end ≤ 1`, `0 ≤ position ≤ 1` | Posiciones normalizadas del modelo |
| Campo de la familia de la fila | Un momento no tiene `qyStart` donde escribirlo |

Un error deja el plan completo sin aplicar. No hay «aplica lo que sea válido».

### Coincidencia de nudos

El Inspector ejecuta `repairProjectTopology` al mover un nudo, de modo que dos
nudos que quedan en el mismo punto se fusionan. **El datasheet no lo hace**, y es
una diferencia deliberada: un pegado de cincuenta coordenadas podría borrar filas
en silencio, y borrar entidades no es lo que el usuario pidió al escribir un
número.

En su lugar, la revisión avisa de cuántos nudos quedarían coincidentes y remite
al Model Doctor, que es la ruta explícita y reversible para repararlo
(`topology.repair`). El aviso no bloquea: el modelo queda tal como se tecleó.

## Pegado

`interpretar → convertir unidades → validar → previsualizar → Aplicar todo /
Cancelar`, sin ningún atajo.

1. **Interpretar.** El portapapeles se parte por tabulador y salto de línea. El
   bloque se ancla en la celda enfocada y se extiende hacia abajo y a la derecha.
2. **Recortar.** Lo que cae fuera de la tabla o sobre una columna no editable no
   se escribe y **se cuenta**: la revisión dice cuántas celdas se descartaron y
   por qué. Un recorte silencioso haría creer que se pegó todo.
3. **Convertir y validar** con las reglas de arriba.
4. **Previsualizar** con el proyecto de preview.
5. **Aplicar todo o cancelar.** Nunca una parte.

## Previews visuales

Todos se dibujan del **proyecto de preview**, no de campos sueltos del
formulario. Reutilizan la geometría que ya existe:

| Tarjeta | Qué reutiliza | Qué cambia en vivo |
|---|---|---|
| Nodo | `NodeNeighborhood` de CRI-81 | Posición nueva, con fantasma de la anterior |
| Apoyo | `SupportGlyph` de CRI-81 | El símbolo, conforme se editan tipo y restricciones |
| Sección | `SectionViewer2D` del Inspector, dos veces | Forma, dimensiones y propiedades, Antes → Después |
| Material | `bulkPropertyOptionGroups` del catálogo | Catálogo ↔ Personalizado, E, G y ρ |
| Carga | Flecha propia de la tarjeta | Dirección, magnitud y caso |

El material es el único editor con dos modos explícitos. **Catálogo** fija la
identidad y sus números juntos, como hacen `member.material.apply` y la edición
múltiple. **Personalizado** edita E, G y ρ directamente, lo que degrada el origen
a `custom`: es la regla que el modelo ya tiene, y el editor la hace visible en vez
de dejar que ocurra de lado.

## Accesibilidad y teclado

Lo de CRI-81 se conserva, y la edición se cose encima del patrón `grid`:

| Tecla | Efecto |
|---|---|
| `Intro` | Sobre celda `inline`, abre el editor; dentro del editor, confirma |
| `F2` | Abre el editor sin seleccionar la fila |
| `Esc` | Dentro del editor, cancela la celda sin tocar el borrador |
| `Ctrl`+`V` | Pega el bloque anclado en la celda enfocada |

- Una celda `identity`, `derived` o `panel` sigue **anunciando su motivo** en la
  región viva en vez de callarse. `panel` añade dónde se edita.
- El editor abierto devuelve el foco a su celda al cerrarse, para que la rejilla
  no pierda su única parada de tabulación.
- La barra del borrador y el diálogo de revisión anuncian el recuento con
  `role="status"`.
- El diálogo es modal con foco atrapado, como el resto de superficies Clay.

## Estilo

Tabla plana, sin relieve por fila: `datasheetStyles.test.ts` lo fija y sigue
valiendo. Los editores, controles, estados y previews usan Clay
(`design-system/components`) y tokens semánticos `--sc-*`. Una celda con cambio
pendiente se marca con un indicador propio, distinto del foco (anillo) y de la
selección (fondo), porque son tres estados que pueden coincidir en la misma celda.

## Verificación

```bash
npx vitest run src/features/datasheet --maxWorkers=1
npx tsc --noEmit -p tsconfig.app.json
```

Pruebas nuevas:

- `datasheetEditModel.test.ts`: cada columna `inline` tiene campo, y ninguna
  `identity` o `derived` lo tiene.
- `datasheetEditDraft.test.ts`: interpretación, conversión de unidades, y cada
  regla de validación con su caso que falla.
- `datasheetEditApply.test.ts`: el plan escribe exactamente lo declarado; un plan
  con error no escribe nada.
- `datasheetPaste.test.ts`: anclaje, recorte contado y columnas no editables.
- `DatasheetEditing.test.tsx`: celda simple aplica al historial; dos celdas piden
  revisión; cancelar no escribe.
- `DatasheetEditorPanel.test.tsx`: los previews cambian con el borrador.
- `DatasheetLoads.test.tsx`: familia, celdas fuera de familia y selección.
- Accesibilidad: anuncios de `panel`, retorno de foco y recuentos vivos.

Y un humo de navegador sobre los flujos principales: editar una coordenada,
cambiar un material desde el editor visual, pegar un bloque y cancelarlo, pegar
un bloque y aplicarlo.

## Riesgos aceptados

- **La hoja no repara topología.** Documentado arriba; el aviso remite al Model
  Doctor.
- **Sin instantánea de obsolescencia.** `updateProject` no rechaza un plan
  preparado sobre un modelo que cambió mientras se revisaba, como sí hace
  `sourceSnapshot` en los comandos. El datasheet es modal y bloquea el lienzo, así
  que la ventana es estrecha; si alguna vez deja de ser modal, esto se convierte
  en un requisito.
- **Sin virtualización.** Igual que en CRI-81: la frontera para adoptarla sigue
  aislada en `datasheetModel.ts`.
