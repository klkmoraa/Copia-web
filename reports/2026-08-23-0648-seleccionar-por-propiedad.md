# Fase 4 del rediseño total · seleccionar por propiedad

**Fecha:** 2026-08-23 06:48
**Agente:** Claude Code
**Rama:** `claude/redeseno-total-mejoras-gimaf7`

## Qué cambió

Doce consultas que seleccionan por propiedad —«todas las barras con liberación de
momento», «todos los apoyos articulados», «barras sin carga», «similares a la
selección»— accesibles desde la paleta (`Ctrl+K`) y, la de similares, también desde el
zócalo contextual del lienzo.

## Por qué

El producto ya tenía una **edición masiva completa**: `bulkEditScope.ts` agrupa por
familia, calcula compatibilidades y prepara intenciones reversibles. Y la única forma de
llegar a ella era señalar los objetos **uno a uno** en el lienzo. En el pórtico de ejemplo
eso es un clic; en una malla del generador son cincuenta, y el error de haberse dejado
uno no se ve hasta después de aplicar.

## Qué **no** hace, y por qué importa

No toca el motor, no inventa un modo de selección nuevo y no añade estado. Produce una
selección múltiple —`Selection` ya admitía `{ kind: 'multi'; nodeIds; memberIds }` desde
antes de este cambio— y ahí acaba su trabajo: el bulk-edit la consume tal cual, **sin una
línea de pegamento**, porque es exactamente la misma selección que produce arrastrar un
rectángulo sobre el lienzo. La captura `2` lo enseña: la consulta deja `N1, N2` y el panel
de edición masiva se abre solo con «Apoyo · 2 de 2 compatibles».

## Archivos tocados

- `src/features/canvas/selectByProperty.ts` — **nuevo**, puro. Las doce consultas,
  `toSelection` y `availableSelectionQueries`.
  - **Similares** compara por identidad de catálogo cuando la hay (`sectionId`,
    `materialId`) y por los números del solver cuando no (`E`, `A`, `I`). Es la misma
    distinción que ya hace el Inspector: dos barras con la misma E y la misma I son la
    misma sección aunque nadie les haya puesto nombre.
  - Seleccionar una **carga en barra** cuenta como señalar su barra.
  - `toSelection` devuelve siempre `multi`, incluso con un solo objeto: quien pide «todos
    los apoyos empotrados» y encuentra uno está seleccionando un conjunto de uno, y
    colapsar a selección simple cambiaría el panel bajo los pies según cuántos hubiera.
    Cero resultados devuelve `null` —deseleccionar—, no una selección múltiple vacía.
- `src/features/workspace/commandRegistry.ts` — categoría `select`; `CommandContext` gana
  `selection` (sólo la lee «similares», que se define contra ella). **Sólo se ofrecen las
  consultas que hoy encuentran algo**, con el recuento en la etiqueta: una consulta que
  devuelve cero no es una opción, es ruido. La única excepción es «similares» sin
  selección, que aparece desactivada a propósito: no es una consulta vacía, es una que no
  se puede formular, y verla apagada explica el mecanismo.
- `src/features/workspace/CommandPalette.tsx` — el grupo nuevo, tras Herramientas.
- `src/features/canvas/ContextualActions.tsx` y `StructuralCanvas.tsx` — acción
  `selectSimilar`, disponible **sólo cuando de verdad hay más de lo ya seleccionado**:
  ofrecerla sobre la única barra de su clase sería ofrecer algo que no cambia nada.
- `src/i18n/catalogs.ts` — 16 claves nuevas en los dos idiomas.

## Cómo verificar

```bash
npm run verify
PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run qa
```

Los dos ejecutados y leídos:

- `npm run verify` — **232 archivos / 2278 pruebas** (8 saltadas), lint limpio,
  `verify:protected` = «Frontera protegida intacta: 38 archivos» **sin refrescar la línea
  base**. Carga inicial 868 282 → 869 727 bytes (+1 445).
- `npm run qa` — **148 checks**, `exit=0`, ninguno en `false`, cero consola.

**Gates nuevos:**
- `selectByProperty.test.ts` — 17 casos: apoyos y libres como **partición** del modelo
  (ni un nudo en los dos, ni uno fuera), cargadas y sin carga igual, liberación en
  cualquiera de los dos extremos, similares por catálogo y por números, similares desde
  selección múltiple y desde una carga en barra, y el caso vacío.
- `CommandPalette.test.tsx` — dos pruebas de integración: la consulta deja una selección
  múltiple real en el store, y las consultas que hoy no encuentran nada **no se ofrecen**.

Evidencia visual en `reports/evidence/2026-08-23-seleccionar-por-propiedad/`.

## Pendiente / siguiente paso

Siguiente fase: **el pie legal fuera del shell**, que mueve `CHROME.footerWide` de 22 a 0
y recalcula la frontera X2↔M1.

Sigue abierto, preexistente, el solape de la barra superior a 390 px de la Fase 1.
`npm run qa:webkit` no se ejecutó: WebKit no está instalado en este entorno.
