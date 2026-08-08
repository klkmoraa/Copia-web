# Claymorphism ciclo 2 — tarea 6: chrome del lienzo opaco con borde medido

**Fecha:** 2026-08-07 13:58
**Agente:** Codex
**Rama:** main
**Base:** `60f60d7`

## Qué cambió

Los doce elementos de chrome que flotan sobre el lienzo consumen ahora un único grupo eager en `material.css`: relleno opaco `--sc-color-surface-2`, borde de 1 px con `--sc-color-border-canvas-chrome` y sombra `--sc-shadow-clay-floating`. `styles.css` conserva geometría, tipografía e interacción, pero ya no repite fondo, borde estructural, sombra ni blur para esos contenedores.

Se preservaron los tratamientos semánticos: `placing-load` conserva su borde de fuerza y usa sombra clay; el feedback mantiene el borde warning con especificidad contextual; y los estados hover/active de capas siguen intactos. No se cambió ningún valor `--canvas-safe-*`.

`qa.mjs` mide Chromium real sobre `.canvas-mode-badge` y `.canvas-controls`: ausencia de backdrop estándar/WebKit, borde exacto de 1 px solid cuyo color coincide con el token resuelto, y al menos dos capas `inset` en la sombra.

## Por qué

Al retirar el vidrio, el chrome técnico ya no podía depender del desenfoque del dibujo para separarse del lienzo. El borde específico del ciclo alcanza el contraste no textual medido en ambos temas, mientras el material eager evita repetir la receta en múltiples reglas lazy de `styles.css`.

## Archivos tocados

- `qa.mjs` — añade propiedades computadas, resolución real del token y `verifyCanvasChromeClayMaterial` conectado a desktop.
- `src/design-system/material.css` — añade el grupo único de chrome y renombra a `--toolbar-clay-border-width` el hook local heredado del rail.
- `src/styles.css` — retira materia/blur duplicados, limpia excepciones de transparencia, conserva estados y renombra el mismo hook local sin cambiar valores.
- `reports/2026-08-07-1326-claymorphism-ciclo2-task6.md` — reporte rastreado.
- `.superpowers/sdd/2026-08-07-claymorphism-ciclo2/task-6-report.md` — ledger SDD ignorado.

## Cómo verificar

- Guardián: `main@60f60d7b40fe`, `structureco@0.8.2`, respaldo externo en `%TEMP%/structureco-task6-60f60d7-20260807-134602`, 63 archivos de rutas protegidas inventariados y `capturas.mjs` registrado sin editar.
- RED check-only: con `material.css` y `styles.css` todavía en sus SHA-256 iniciales, `npm.cmd run build` pasó y `node qa.mjs` falló exactamente `canvasChromeHasNoBackdropFilter`, `canvasChromeHasMeasuredBorder` y `canvasChromeHasFloatingClayShadow`.
- GREEN: tras la implementación mínima, `npm.cmd run build` pasó y `node qa.mjs` terminó con los tres checks T6 en `true`, consola vacía y `pageErrors` vacío.
- Mutación: cambiar temporalmente el borde del grupo a `1px solid currentColor` hizo fallar `canvasChromeHasMeasuredBorder`. La primera corrida incluyó además la carrera conocida de welcome; la única repetición permitida falló exclusivamente el check de borde.
- Restauración: `material.css` recuperó byte por byte el SHA-256 pre-mutación `96F204C4B71BB490771CF34FB9D02595165D22046061B87FE6BF341FAF5EFC04`.
- Tokens focused: la primera corrida detectó una deuda heredada de `60f60d7` (`--sc-toolbar-clay-border-width` era un hook local con namespace de design token). Se renombró en sus cuatro usos, sin cambiar valores; `npx.cmd vitest run src/design-system/tokens.test.ts` terminó con 1 archivo y 22/22 pruebas verdes.

## Pendiente / siguiente paso

Por instrucción del checkpoint, una vez terminados RED/GREEN/mutación/restauración no se lanzaron gates largos adicionales. El QA GREEN ocurrió antes del renombre semánticamente neutro del hook local; el controlador debe ejecutar el QA/full gate fresco y la revisión visual sobre modelo denso en Day/Night y 390×844.

No se abrió dev server ni navegador visual, no se ejecutó WebKit ni suite completa, no se tocaron safe areas, rutas protegidas o `capturas.mjs`, y no se hizo push.

## Cierre del controlador y fix visual — geometría densa (2026-08-07 14:19)

La primera matriz Chromium sobre el modelo de ejemplo analizado con diagrama de momento confirmó el riesgo principal del spec: en desktop 1536×960 el badge heredado medía 387 px y la leyenda 260×93.6 px; al ser ahora opacos, cubrían la curva, etiquetas y parte del miembro izquierdo. El detector geométrico registró 11 intersecciones de bounding boxes persistentes. En 390×844 no hubo ninguna intersección y la composición móvil ya era correcta.

Se aplicó el ajuste mínimo únicamente para `min-width:1024px`: badge normal y leyenda quedan en 156 px; la instrucción del badge conserva texto completo en el DOM y se trunca visualmente con elipsis; la leyenda compacta visualmente su explicación secundaria mediante el patrón sr-only, conservando la convención completa en el DOM y el árbol accesible. `.placing-load` queda fuera del selector y mantiene 371 px con “Toca un nodo o miembro para colocarla”. Móvil no cambió.

No se modificaron `--canvas-safe-*`: la inspección del código confirmó que esas variables posicionan feedback/leyenda/quick-entry, pero no reservan espacio para el dibujo. Aumentarlas habría movido el chrome sobre más geometría, no protegido el modelo. La solución efectiva fue reducir los dos overlays persistentes del margen izquierdo.

Evidencia visual final:

- Day/Night 1536×960: badge y leyenda 156 px, borde exacto de tema (`rgb(132, 129, 122)` / `rgb(95, 109, 104)`), cuatro/tres capas de sombra según tema, dos `inset`, sin backdrop; consola y errores de página vacíos.
- 1366×768 Day: modelo, reacciones y diagrama siguen legibles; status y controles no tapan valores visibles.
- 390×844 Day/Night: cero intersecciones, material completo y geometría móvil sin cambios.
- Panel de capas Day/Night: 292×424 px, relleno opaco, borde medido, dos `inset`, sin blur; apertura/cierre funcional.
- Tooltip de corte: contenido, DCL, ecuaciones y residuos visibles; su oclusión es contextual y temporal, no chrome persistente.
- Capturas y mediciones quedan en `.superpowers/sdd/2026-08-07-claymorphism-ciclo2/task-6-*.png`.

Gates posteriores al fix visual:

- `npx.cmd vitest run src/design-system/tokens.test.ts`: 22/22 PASS.
- `npm.cmd run build`: PASS.
- `node qa.mjs`: PASS completo; checks T6 verdaderos, consola y `pageErrors` vacíos.
- `npm.cmd run verify:perf`: 662960/670000 bytes y 178286/179500 gzip.
- `npm.cmd run verify:protected`: frontera 29/29 intacta.

La revisión independiente del commit de implementación `701cceb` fue APPROVED sin hallazgos. La primera re-revisión pidió conservar accesible la convención de signo: se sustituyó `display:none` por ocultación visual sr-only y se vuelve a revisar. No se hizo push.

### Fix de re-revisión — convención accesible

El revisor detectó que `display:none` retiraba del árbol accesible la única explicación de la convención “+y local”. Se cambió a ocultación visual sr-only. Chromium confirmó `display:block`, `position:absolute`, caja 1×1, `clip:rect(0,0,0,0)`, sin `aria-hidden`, y el snapshot ARIA conserva: “Se dibuja hacia +y local · valores positivos mantienen el color y el trazo”. La leyenda visual permanece en 156×34 px y la geometría no cambió.

Tras este fix: tokens 22/22 y build PASS; presupuesto 663071/670000 bytes y 178290/179500 gzip; frontera 29/29. Dos corridas de `node qa.mjs` fallaron únicamente la carrera heredada `welcomeimportCardActiveTransformIsPressedTranslate`; ninguna tocó código welcome y la estabilización sigue asignada a T10. Los checks/material T6 ya habían pasado en el gate anterior y la matriz directa posterior quedó sin consola ni `pageErrors`.
