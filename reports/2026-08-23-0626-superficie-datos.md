# Fase 3 del rediseño total · superficie «Datos» unificada

**Fecha:** 2026-08-23 06:26
**Agente:** Claude Code
**Rama:** `claude/redeseno-total-mejoras-gimaf7`

## Qué cambió

Las **cuatro superficies densas** del producto —el dock inferior de Resultados, la
superficie invocada `dense`, la Hoja de datos y el Model Doctor— se funden en **una**
con tres pestañas: **Resultados · Tabla · Revisión**.

El broker ya las obligaba a excluirse entre sí: `validateSurfaceCombination` dice
literalmente «drawer y fullscreen son mutuamente exclusivos», así que en pantalla nunca
hubo más de una a la vez. Unificarlas no cambia lo que el usuario puede tener abierto;
le da a esa restricción, que ya existía, un solo cromo, un solo título, un solo botón de
cerrar y un solo `peek`.

**El caso más claro era Resultados.** Vivía partido en dos componentes: `ResultsPanel`
(Resumen · N·V·M · Deformada) y `DenseResultsSurface` (Reacciones · Influencia ·
Aprender). Los dos leían **el mismo campo**, `resultTab`, cuyo tipo `ResultTab` contenía
las nueve lecturas desde el principio. El corte no estaba en el dominio: estaba en dos
componentes que decidieron cada uno cuáles de esos valores eran suyos. Ahora son una
sola tira de ocho pestañas en cuatro familias — Estado · Esfuerzos · Forma · Estudio.

**Y con el dock se va su maquinaria.** `ResultsPanel` era un carril inferior
redimensionable con tres modos (compacto · expandido · enfoque), tirador de arrastre,
altura persistida en `localStorage`, conmutador móvil y su propia trampa de `Escape`.
Todo eso existía para negociar alto con el lienzo. Dentro de una superficie modal no hay
nada que negociar: **el lienzo recupera ese alto entero en X2/M1**.

## Por qué

Tercera fase del plan, con la decisión del usuario de que la superficie densa lo
absorbiera todo. De diez superficies del broker a **cinco**: `detail`, `data`, `palette`,
`candidatePicker`, `contextualActions`.

## Archivos tocados

**El contrato**
- `src/features/data/dataSurface.ts` — **nuevo**, puro. Las tres pestañas, las cuatro
  familias de resultado, el orden de lectura, los rótulos y `resolveResultTab`, que hace
  caer a Resumen cualquier valor que no esté en la tira (`issues` lo escribe `analyze()`,
  no el usuario).
- `src/features/data/DataSurface.tsx` — **nuevo**. El cromo compartido; cada cuerpo sigue
  siendo `lazy`, así que abrir en Resultados no descarga la Tabla ni la Revisión.
- `src/features/data/retainedState.tsx` — **nuevo**. Ver «defectos destapados».

**Los cuerpos, sin cromo**
- `ResultsPanel.tsx` → `ResultsContent.tsx`. Pierde dock, modos, arrastre, altura
  persistida, conmutador móvil y trampa de `Escape`; absorbe las tres lecturas de
  `DenseResultsSurface`.
- `DatasheetPanel.tsx` → `DatasheetContent.tsx`; `ModelDoctor.tsx` → `ModelDoctorContent.tsx`.
  Los dos pierden su `Drawer`. El Doctor gana `onClose` explícito: «Usar herramienta» es
  su única acción que cierra, y ahora lo pide en vez de inventarlo.
- **Borrados:** `DenseResultsSurface.tsx`, `denseResults.ts` y sus pruebas.

**El broker y el bus**
- `surfacePresentation.ts` — `results`, `dense`, `datasheet` y `doctor` → `data`.
- `workspaceCommands.ts` — `open-results`, `open-dense-results`, `open-datasheet` y
  `open-model-doctor` → **`open-data`** con `{ tab?, resultTab?, trigger? }`.
- `WorkspaceShell.tsx`, `commandRegistry.ts`, `TopBar.tsx`, `StructuralCanvas.tsx`,
  `ClassroomGuide.tsx`, `InspectorNarrativeCard.tsx`, `ElasticDemandCard.tsx`,
  `ModelOverview.tsx` — todos los emisores reapuntados.

**Los tres lanzadores NO se colapsan en uno**, y es deliberado: Resultados, Tabla y
Revisión son tres destinos que comparten superficie. Además el botón de Model Doctor es
contrato protegido (D-14 · CRI-95: «nunca desaparece ni pierde su etiqueta accesible»).
Llevar los tres al mismo sitio y obligar a buscar la pestaña sería cambiar tres puertas
correctas por una puerta y un paso de más.

**CSS**
- `styles.css` — **106 reglas retiradas** con `postcss` (una regla que exige una clase
  que ya no existe no puede casar nunca), más la materia nueva de la superficie.
- La cabecera de diagrama y el reparto en dos columnas se adaptan por **`@container`**,
  no por `@media`.

## Cómo verificar

```bash
npm run verify
PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run qa
```

Los dos ejecutados en esta sesión y leídos:

- `npm run verify` — **231 archivos / 2259 pruebas** (8 saltadas), lint limpio,
  `verify:docs` conforme, `verify:protected` = «Frontera protegida intacta: 38 archivos»
  **sin refrescar la línea base**. Carga inicial **877 566 → 868 282 bytes**.
- `npm run qa` — **148 checks**, `exit=0`, ninguno en `false`, cero consola, cero errores.

**El gate puede ponerse rojo:** reintroducida una segunda superficie modal (`doctor`)
en el broker, `surfacePresentation.test.ts` cae en tres pruebas con
`expected [ 'data', 'doctor' ] to deeply equal [ 'data' ]`.

Evidencia visual en `reports/evidence/2026-08-23-superficie-datos/`, con su README.

## Dos defectos que la fusión destapó, y quedaron corregidos

1. **Un borrador sin aplicar se habría perdido en silencio.** `ModalSurface` desmonta a
   sus hijos al cerrarse. Mientras cada superficie montaba su propio cajón, sus
   borradores vivían en el componente que lo envolvía y sobrevivían a una suspensión
   **por accidente de dónde estaba declarado el `useState`**. Al meter los cuerpos dentro
   del cajón compartido, esa propiedad se habría perdido sin que nada fallara.
   `retainedState.tsx` la vuelve explícita, y de paso salió un segundo defecto latente:
   el efecto que invalida el borrador al cambiar de entidad era un efecto de **cambio**
   que también corría al **montar**, así que borraba el borrador recién restaurado.
2. **El diagrama no cabía en el cajón.** 420 px partían la lectura en tres líneas.
   «Datos» toma ancho propio y el contenido se adapta por `@container`: en X2 el viewport
   es ancho y el contenedor no, y una `@media` no puede ver esa diferencia.

## Pendiente / siguiente paso

Cuatro pruebas de `App.test.tsx` describían coreografías del dock inferior (colapso
móvil, `Escape` sobre la hoja, modo enfoque). Se reescribieron contra lo que el producto
hace ahora; ocho pruebas de `ResultsContent.test.tsx` que sólo medían ese cromo se
retiraron, porque describían algo que ya no existe.

Sigue abierto, y es preexistente, el solape de la barra superior a 390 px anotado en el
reporte de la Fase 1.

Siguiente fase: **seleccionar por propiedad**.

`npm run qa:webkit` no se ejecutó: WebKit no está instalado en este entorno.
