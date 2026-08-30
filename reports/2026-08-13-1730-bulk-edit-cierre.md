# Cierre de la edición múltiple estructural (CRI-37, fase 5)

**Fecha:** 2026-08-13 17:30
**Agente:** Claude Code
**Rama:** `claude/cri-37-foundations` sobre `origin/main` = `dc7a597`

## Qué cambió

Se cierran los pendientes que quedaban de las fases 1–4: valores efectivos,
habilitar + configurar, compatibilidad exacta, filtros de alcance, pantalla de
revisión, agrupación de cargas por familia, responsive/accesibilidad y
rendimiento. También se corrigen dos defectos reales que ninguna prueba cubría.

### Defectos corregidos

- **Una edición que sólo tocaba cargas se descartaba en silencio.** El guardia de
  `BulkEditInspectorPanel` sólo miraba miembros y nudos, así que el panel
  aceptaba la confirmación y no ocurría nada. Ahora se comprueban las cuatro
  familias.
- **El recuento de la cabecera podía ser negativo.** Restaba un conjunto que
  incluía las cargas de un total que no las contaba. Sustituido por un reparto
  exacto por familia (`bulkScopeBreakdown`), donde `compatible + incompatible`
  siempre es `selected`.
- **La revisión no se cerraba al aplicar.** Confirmar no cambia qué objetos están
  seleccionados, así que el efecto que descarta el borrador nunca se disparaba:
  el panel se quedaba en la pantalla de revisión de un cambio ya ocurrido, con el
  botón activo y sin ningún acuse. Lo encontraron a la vez el revisor de UX y el
  adversario de pruebas.
- **El Inspector afirmaba que la selección múltiple era de sólo lectura** justo
  encima del editor de selección múltiple. Copia corregida.

### 1. Valores almacenados frente a efectivos

`bulkEditEffective.ts` sustituye la ausencia por **la misma constante que usa el
solver**, y cada entrada cita la línea de `src/engine/solver.ts` que lo demuestra:
normal del rodillo → 90 (`solver.ts:518,1428,1667`), liberaciones → `false`
(`:111-114`), restricciones de apoyo personalizado → `false` (`:452,547`),
articulación interna → `false` (`:675,699`), teoría de viga →
`'euler-bernoulli'` (`:151,228,580`), densidad → 0 (`:745,1021`) y zonas rígidas
→ 0 (`:136-137,594-595`).

Quedan **fuera a propósito** `rotationalSpringI/J` —el solver documenta que
ausente es rígido y `0` es liberación— y `G`/`shearArea`, cuya equivalencia
depende de `beamTheory` y por tanto no es canónica. No hay heurísticas ni
comparación de flotantes con tolerancia. Normalizar sólo afecta a la lectura:
decide `same` frente a `mixed`; nunca produce una escritura.

### 2. Habilitar + configurar

`bulkEditProjection.ts` proyecta la selección con las dos propiedades que
gobiernan la existencia de otras —`member.type` y `node.support.type`— ya
decididas, reutilizando `rebuildSupport`, **la misma función con la que el
comando escribe**, de modo que previsión y escritura no pueden divergir. Sólo se
proyectan esas dos: ambas son `clearable: false` y su resultado es determinista.

Las propiedades que el tipo de apoyo desbloquea pasaron a ser primarias: nacer
plegadas dentro de «Más propiedades» dejaba la mejora sin efecto práctico, porque
el usuario no veía lo que acababa de habilitar (lo detectó la QA de navegador).

Se conservan atomicidad, `untouched`, rechazo por obsolescencia y undo único.

### 3. Compatibilidad real

El denominador de una propiedad es **su propia familia**. Un nudo no es
«incompatible con la sección»: no es un miembro, y contarlo inflaba el
denominador hasta que «2 de 7 compatibles» dejaba de significar nada. El motivo
`entity-kind` desaparece porque ya no se produce. El alcance completo viaja en
`aggregate.targets`, así que saber si una entidad está seleccionada ya no depende
de que exista una propiedad que la rechace.

### 4. UX

- **Filtros de alcance** (`Todos / Miembros / Nudos / Cargas`), sólo con las
  familias presentes y sólo si hay más de una. Es una lente del Inspector: no
  toca la selección del lienzo, y la QA lo comprueba contando los objetos
  marcados antes y después de filtrar.
- **Revisar cambios**: pantalla previa con valor actual, valor objetivo, qué
  cambia, qué queda sin tocar, cantidad afectada, incompatibles con su motivo y
  el aviso de que los resultados quedarán desactualizados. Nada se publica hasta
  confirmar. La confirmación se llama `Aplicar a N`; la salida se llama
  **`Volver a editar`** y no «Cancelar», porque el pie de edición ya tiene un
  «Cancelar» que descarta el borrador entero: compartir palabra convertía a ese
  otro en una trampa. Es la única desviación respecto del enunciado literal.
- **Cargas agrupadas por familia real** (nodal, repartida, puntual, momento y las
  combinaciones exactas de familias que comparten una propiedad). Cada propiedad
  declara su grupo; no se deduce del nombre. Los grupos de carga se muestran
  enteros: son pocos campos y son justo lo que se venía a cambiar.
- **Vista previa de sección** conservada, con su procedencia y sin inventar
  geometría.

### 5. Responsive y accesibilidad

- `aria-checked="mixed"` real en el valor actual de un booleano, como indicador
  de sólo lectura separado del control de intención (un `radiogroup` no admite
  `mixed`). Mixto nunca es `false`.
- Foco: entra en la revisión al abrirla y **vuelve al control que la abrió** al
  cerrarla, por botón o por `Escape`.
- `Escape` abandona la confirmación; en la edición no se captura, para que una
  hoja móvil contenedora pueda cerrarse.
- Nombre accesible propio para el borrado de un numérico, conteniendo su texto
  visible (WCAG 2.5.3 — lo hizo cumplir una prueba que ya existía).
- **Desbordamiento horizontal corregido**: las rejillas del panel se dimensionaban
  al `min-content` de sus hijos y desbordaban 33 px en un Inspector acoplado de
  284 px; el control segmentado desbordaba otros 47 px porque su única regla de
  encogido depende del ancho de ventana, no del contenedor. Ambos resueltos
  dentro de `bulkEdit.css`, sin tocar el design system y sin `@media`.
- Objetivos táctiles ≥ 44 px verificados en escritorio, tableta y móvil.

### 6. Rendimiento

Medido sobre esta misma rama antes de optimizar: preparar una edición pasaba de
62 ms con 600 objetos a **473 ms con 2400** —casi ocho veces por cuadruplicar la
selección—, porque cada entidad volvía a buscar su propiedad y comprobaba su
compatibilidad recorriendo listas. Con el reparto indexado una sola vez por
preparación: **84 ms con 2400** (5,6× más rápido) y crecimiento lineal. La
agregación ya era lineal y se dejó como estaba.

También: `Set` en lugar de `includes` al resolver la selección a entidades
(`BulkEditInspectorPanel`), y la firma de selección memoizada, que recorría la
selección entera en cada render.

## Revisores

Cinco revisiones de sólo lectura. **Dominio** y **transacción/historial** no
encontraron defectos: el primero verificó línea por línea contra `solver.ts` cada
equivalencia canónica y confirmó que la proyección no puede ofrecer nada que el
aplicador descarte; el segundo confirmó atomicidad, undo único, rechazo por
obsolescencia sobre la nueva pantalla de revisión y aislamiento del store durante
el borrador. **UX/accesibilidad**, **adversario de pruebas** y **React/rendimiento**
encontraron lo corregido arriba.

No corregido, con motivo: `rebuildSupport` descarta el `support.prescribed` en
línea al cambiar de tipo aunque alguna componente siguiera siendo válida. Es
comportamiento **previo** y copiado literalmente del editor de un solo nudo
(`InspectorProperties.tsx`); cambiarlo aquí haría que la edición múltiple
divergiera de la individual. El array `prescribedDisplacements` por caso sí se
poda componente a componente.

## Archivos tocados

Nuevos: `bulkEditEffective.ts`, `bulkEditProjection.ts`, `bulkEditScope.ts`,
`scripts/qa-bulk-edit.mjs`, y las pruebas `bulkEditEffective`,
`bulkEditCompatibility`, `bulkEditEnableConfigure`, `bulkEditScope`,
`BulkEditReview`, `BulkEditReviewLifecycle`, `BulkEditAccessibility`,
`BulkEditInspectorLoads`.

Modificados: `bulkEditTypes.ts`, `bulkEditAggregation.ts`, `bulkEditProperties.ts`,
`bulkEditIntent.ts`, `bulkEditCommand.ts`, `bulkEditPresentation.ts`,
`BulkEditPanel.tsx`, `BulkEditInspectorPanel.tsx`, `BulkPropertyField.tsx`,
`BulkSelectionSummary.tsx`, `BulkChangeSummary.tsx`, `bulkEdit.css`,
`src/commands/projectCommand.ts` (exporta `rebuildSupport`; guardia de objetivo
duplicado también para cargas), `src/i18n/catalogs.ts`, `package.json`.

## Cómo verificar

```bash
npm run qa:bulk-edit
```

## Gates

Verde: `typecheck`, `lint`, `test` (175 archivos, 1455 pruebas, 8 omitidas
preexistentes), `build`, `verify:protected` (30 archivos, frontera intacta),
`verify:docs`, `verify:perf`, `verify:space3d`, `validate:ci`, `qa`,
`qa:structural-edits`, `qa:model-doctor`, `qa:bulk-edit` y
`qa:bulk-edit:webkit` (48 comprobaciones, consola y errores de página vacíos).

**`qa:webkit` es intermitente y no lo causa esta rama.** Evidencia: seis
ejecuciones en la rama fallaron tres veces; seis ejecuciones sobre el árbol de
`origin/main` (`dc7a597`, que **no contiene** la edición múltiple) fallaron
también tres veces. El fallo es siempre la misma comprobación
—`workspaceTouchTargetsAtLeast44`— y cambia de dispositivo entre ejecuciones
(`iPad Pro 11` en la rama, `iPhone 13` y `iPad Pro 11` en `main`). No se declara
verde.

Nota de método: `npm test` fija `--maxWorkers=1` a propósito. Lanzar `npx vitest
run` a mano sobre varias carpetas usa el paralelismo por defecto y en esta
máquina agota los tiempos de espera de algunas pruebas de jsdom por contención
—el mismo efecto que documentó el reporte de la fase 1—. Cada prueba que falló
así pasa aislada y bajo el gate. La cifra que se declara es la del gate.

No se aumentaron tiempos límite, no se añadieron omisiones, no se usó `.only`, no
se debilitó ninguna aserción y no se cambió ninguna tolerancia.

## Pendiente / límites conocidos

- Un cambio dependiente cuya puerta se retira sobrevive inerte en el borrador: no
  puede escribirse —lo rechazan la intención, el resumen y el comando— y vuelve a
  estar disponible si la puerta se repone. Está probado, no podado.
- El reparto por objeto de la cabecera declara `compatible + incompatible =
  selected`, pero hoy todo objeto admite al menos una propiedad editable, así que
  el aviso de incompatibles a nivel de objeto no llega a mostrarse. La
  información que decide sí se muestra: es por propiedad.
- `qa:webkit`, arriba.

Sin merge a `main`. Sin push.
