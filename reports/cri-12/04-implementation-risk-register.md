# CRI-12D · Registro de riesgos de implementación

**Clasificación:** `AUDIT/TEMPORARY`
**Complementa:** `04-implementation-roadmap.md`, `04-dependency-map.md`, `04-migration-strategy.md`

Formato por riesgo: **probabilidad cualitativa | impacto | detección | mitigación | issue dueña**.

"Detección" es la parte que suele faltar en un registro de riesgos: si un riesgo no tiene forma conocida de aparecer, no está gestionado, está anotado.

---

## 1. Riesgos que rompen un invariante protegido

Los más caros. Un fallo aquí no es un bug: es una afirmación falsa sobre una estructura.

### R-01 · La fiabilidad pierde su matiz al mudarse al chrome

**Probabilidad**: media-alta · **Impacto**: **crítico** — `success ≠ reliable ≠ safe` es el invariante central del producto.
**Detección**: comparar, en las tres clases, un análisis exitoso-pero-poco-fiable contra uno exitoso-y-fiable: si se leen igual, el matiz se perdió. QA en ES y EN con nombre de proyecto largo.
**Mitigación**: la fiabilidad es **línea propia**, nunca color sobre el valor (V-10.3). `Estado` y `Doctor` **nunca degradan** en el piso de Cinta Compact. CRI-95 sanea el chrome **antes** de que CRI-100 le mude la afirmación — es un bloqueo duro, no una recomendación.
**Dueña**: CRI-95, luego CRI-100.

### R-02 · Evidencia caducada que deja de verse caducada

**Probabilidad**: media · **Impacto**: **crítico** — stale fail-closed.
**Detección**: forzar un modelo modificado tras analizar, y recorrer las tres clases + una recomposición + una rotación comprobando que la marca de caducidad sobrevive.
**Mitigación**: criterio de aceptación explícito en CRI-94 (tras migrar), CRI-95 (en el chrome), CRI-100 (en Compact) y CRI-102 (en `peek`).
**Dueñas**: CRI-94, CRI-95, CRI-100, CRI-102.

### R-03 · Una tarjeta de resultado que dice "aprobado" sin decirlo

**Probabilidad**: **alta** — el riesgo **aumenta** con la marca en menta, porque un verde profundo lee más "correcto" que una lima.
**Impacto**: crítico.
**Detección**: capturas comparadas de un resultado favorable y uno desfavorable — **misma materia, mismo nivel, mismo color** o está mal. Búsqueda de los seis textos prohibidos (`Análisis OK`, `Controlado`, `Cumple con los criterios de diseño`, `Verificación global`, `No conforme`, porcentaje+`OK`).
**Mitigación**: las cinco guardas de V-10 como criterios de aceptación; prohibición explícita del check verde por fila.
**Dueña**: CRI-101 (y CRI-91 lo recoge en el Brandbook).

### R-04 · Reintroducir inferencia de material/sección por floats

**Probabilidad**: media · **Impacto**: **crítico** — es P0 (CRI-34), y **ya ocurrió una vez** como regresión (CRI-15).
**Detección**: inspeccionar el objeto resultante tras elegir un preset y tras pegar: `materialId`/`sectionId` explícitos o fallo. `qa:bulk-edit` ejercita presets.
**Mitigación**: criterio de aceptación con evidencia obligatoria en las dos issues que tocan esa ruta. CRI-97 lo marca además como "riesgo alto y silencioso": una ruta de pegado que reconstruye por valores rompe el invariante sin error visible.
**Dueñas**: CRI-99 (presets), CRI-97 (pegar/duplicar).

### R-05 · Romper el baseline protegido

**Probabilidad**: media · **Impacto**: alto — bloquea la integración y puede tocar el solver.
**Detección**: `npm run verify:protected` **sin `--update`**. Es determinista.
**Mitigación**: `src/engine`, `src/workers`, `src/data`, `src/store/ProjectContext.tsx` y `src/types.ts` están cubiertos. Ningún slice del backlog necesita modificarlos por defecto. Un refresco de baseline exige **autorización explícita del propietario** y no se ejecuta dentro de un slice de UI.
**Dueñas**: transversal; crítica en CRI-99 y CRI-92.

---

## 2. Riesgos de schema y persistencia

### R-06 · Migración de `settings.show*` (ABIERTA-8 / U-12)

**Probabilidad**: media · **Impacto**: **alto** — CRI-9 lo llamó *"el mayor riesgo adyacente a schema de todo CRI-9"*. Los ocho campos viven en `ProjectModel`, que se persiste con `schemaVersion`, y `src/types.ts` + `migrate.ts` están bajo baseline protegido.
**Detección**: `verify:protected`; y abrir un proyecto guardado antes del cambio para comprobar que conserva sus capas.
**Mitigación**: **no se migra en este backlog.** CRI-92 evalúa y recomienda; la migración, si procede, es una issue posterior con plan de reversión propio. Mientras tanto, CRI-99 obliga a que **todo** acceso a visibilidad pase por un **accesor único**, de modo que una migración futura sea un cambio de un archivo.
**Dueña**: CRI-92; consumidora CRI-99.

### R-07 · Preferencias persistidas que se pierden o se corrompen

**Probabilidad**: media · **Impacto**: medio — pérdida de configuración del usuario, no de datos.
**Detección**: arrancar con cada clave poblada por una versión anterior y verificar que se honra o se ignora limpiamente; y arrancar tras un rollback.
**Mitigación**: regla transversal — **leer con tolerancia, ignorar sin borrar, no subir versión de clave salvo necesidad demostrada**. Ninguna de las siete claves se borra en ningún slice. El reparto de `structureCo.inspector.expanded.v1` entre tres superficies es el caso más delicado y exige documentar qué se preservó.
**Dueñas**: CRI-89, CRI-99, CRI-100.

### R-08 · Pérdida de trabajo por `Ctrl+Z` fuera de ámbito

**Probabilidad**: media · **Impacto**: **alto** — pérdida de trabajo real.
**Detección**: caso de prueba explícito — foco en la rejilla del Datasheet, `Ctrl+Z`, comprobar que **no** deshace la operación de modelo.
**Mitigación**: G-01 nace acotado: no dispara con foco en campo de texto, rejilla del Datasheet, ni modal con historial propio. El contrato canónico del Datasheet (sin historial propio) no se toca.
**Dueña**: CRI-103.

### R-09 · Recuperación de proyectos menos visible tras el rediseño de Welcome

**Probabilidad**: baja-media · **Impacto**: alto — `RecoveryRecord` es un mecanismo de seguridad de datos.
**Detección**: comparar la alcanzabilidad de la recuperación antes y después, con captura.
**Mitigación**: criterio de aceptación explícito: *"la recuperación es al menos tan alcanzable como hoy"*. El repositorio IndexedDB **no se toca**.
**Dueña**: CRI-104.

---

## 3. Riesgos de arquitectura de estado y rendimiento de render

### R-10 · Rerenders globales por estado mal ubicado

**Probabilidad**: **alta** · **Impacto**: medio-alto — degrada el producto entero de forma difusa y difícil de atribuir.
**Detección**: perfilar con un modelo grande mientras se mueve el puntero sobre un diagrama y mientras se redimensiona la ventana. Si la Cinta o el Inspector re-renderizan a 60 Hz, el estado está mal ubicado.
**Mitigación**: contextos **separados y estrechos**. La clase de composición vive en un contexto propio, **no** junto a selección/tema. El estado de superficies **no** comparte contexto con `resultCursor`, que cambia con cada movimiento de puntero. La clase emite **sólo cuando cambia**, no en cada resize. Las superficies **derivan** de la selección; **no la copian**.
**Dueñas**: CRI-89, CRI-94, CRI-99, CRI-100, CRI-101.

### R-11 · Datasheet grande y virtualización no decidida

**Probabilidad**: media · **Impacto**: medio-alto.
**Detección**: medición en **dispositivo real** con ~2000 entidades, en Expanded y Compact. Único dato existente hoy es `EXPERIMENTAL`: 1,16 s a primera fila, sin virtualizar, sobre 1292 filas, en el harness aislado de CRI-11 — **no sirve como justificación**.
**Mitigación**: se mide **antes** de decidir. Principio: *performance hardening sólo donde la medición demuestre necesidad*. Si se decidiera virtualizar, quedan anotadas las restricciones de accesibilidad (recorrido de lector de pantalla, `aria-rowcount`) y de contrato del Datasheet. **"Mostrar menos filas" no es virtualización: es pérdida de capacidad, y no es una opción.**
**Dueña**: CRI-93; consumidora CRI-102.

### R-12 · `StructuralCanvas.tsx` (2499 líneas) y `styles.css` (4895 líneas)

**Probabilidad**: media · **Impacto**: medio.
**Detección**: revisión del diff — si un slice de interacción trae un refactor estructural, se salió de alcance.
**Mitigación**: prohibición explícita de refactor oportunista. CRI-96 añade el mecanismo de selección **sin** arrastrar refactor; CRI-105 toca `styles.css` **sólo** por materia, y arregla la duplicación conocida de `.canvas-layer-switch` (`:2161` vs `:3677`) porque es mecánica — sin salir a cazar todas las demás.
**Dueñas**: CRI-96, CRI-105.

---

## 4. Riesgos de interacción y dispositivo

### R-13 · Conflicto de gestos pan ↔ marquee en touch

**Probabilidad**: **alta** · **Impacto**: alto — hace el lienzo frustrante en el dispositivo donde más importa.
**Detección**: pan lento deliberado que **no** debe armar marquee; long-press estático que **sí** debe.
**Mitigación**: distinguir por **tiempo Y desplazamiento**, no por uno solo. Las dos piezas ya existen en `canvasInteraction.ts`: umbral de 480 ms y `dragThreshold: 9` para touch. Pasada WebKit obligatoria.
**Dueña**: CRI-96.

### R-14 · `navigator.clipboard.readText()` sin evidencia de disponibilidad (U-11)

**Probabilidad**: media-alta · **Impacto**: medio — una afordancia de pegar rota es peor que ninguna.
**Detección**: probar en Safari/iOS explícitamente, que es donde más restringido está. **Verificado**: hoy no hay ninguna llamada en `src/**`.
**Mitigación**: la afordancia **detecta, no asume**, y degrada con ruta alternativa declarada. CRI-106 cierra el unknown formalmente por navegador.
**Dueñas**: CRI-97, CRI-106.

### R-15 · Firefox y WebKit sin evidencia (herencia de CRI-11)

**Probabilidad**: media · **Impacto**: medio-alto.
**Detección**: correr la matriz. **Corrección de un supuesto**: el repo **sí** tiene vehículo WebKit (`qa:webkit` y variantes `--webkit` de `qa:bulk-edit`, `qa:structural-edits`, `qa:structure-generator`). **Firefox no tiene vehículo** — hay que añadirlo o declarar su ausencia.
**Mitigación**: WebKit obligatorio en CRI-96, CRI-97 y CRI-106. CRI-106 documenta lo probado **y lo no probado**, explícitamente. El "sólo Chromium" de CRI-11 se refiere a su harness aislado, no a la capacidad del repositorio.
**Dueña**: CRI-106.

### R-16 · Compact landscape

**Probabilidad**: media · **Impacto**: medio.
**Detección**: es el peor caso de anchura; QA obligatorio en ES (más largo que EN) con el nombre de proyecto más largo y el tipo de selección de etiqueta más larga.
**Mitigación**: 12B lo marcó como brecha; entra como caso obligatorio en CRI-89, CRI-95, CRI-97 y CRI-102. `styles.css` ya tiene reglas `orientation:landscape` con `max-height:600px` que hay que **reconciliar, no duplicar**.
**Dueñas**: CRI-89, CRI-95, CRI-97.

### R-17 · Histéresis del resolver sin conclusión fuerte (ABIERTA-2 / U-13)

**Probabilidad**: baja · **Impacto**: medio.
**Detección**: barrido continuo 900↔1300px buscando oscilación dentro de la banda.
**Mitigación**: `bandPx = 24` fijado por CRI-12B #6 sobre evidencia `PROTOTYPE_VALIDATED`. CRI-11 fase C fue explícita: *"la medición está hecha, la interpretación fuerte no"* — no discrimina si el valor importa a otras alturas o con banda >400px. Se implementa como **parámetro**, no como constante enterrada, para que una medición futura pueda cambiarlo sin rediseño.
**Dueña**: CRI-89.

---

## 5. Riesgos de accesibilidad

### R-18 · Regresión de foco al migrar superficies

**Probabilidad**: **alta** · **Impacto**: alto.
**Detección**: recorrido con `Tab` tras cada migración; el foco debe estar en el elemento **equivalente**, no en `body`.
**Mitigación**: hoy existe lógica cuidada de retorno de foco (`inspectorReturnFocusRef`, `doctorReturnFocusRef`, `datasheetReturnFocusRef`). CRI-94 debe **absorberla, no perderla** — criterio de aceptación explícito.
**Dueña**: CRI-94.

### R-19 · `inert` pegado tras cerrar una superficie modal

**Probabilidad**: media · **Impacto**: **alto** — bloquea la aplicación entera al usuario de teclado.
**Detección**: abrir y cerrar cada superficie modal comprobando que el fondo deja de ser inerte. Caso de prueba obligatorio en `peek`, donde la superficie deja de atrapar foco sin cerrarse.
**Mitigación**: generalizar el patrón del Doctor con ciclo de vida **simétrico**. Rollback inmediato y sin pérdida de datos si aparece en producción.
**Dueñas**: CRI-94, CRI-102.

### R-20 · Atajos de una letra que secuestran la navegación rápida de lectores de pantalla

**Probabilidad**: media-alta · **Impacto**: alto.
**Detección**: pasada **real** con lector de pantalla en modo navegación rápida. Es un fallo ya diagnosticado por CRI-11 y corregido **sólo en el prototipo**.
**Mitigación**: acotar los atajos de una letra **al elemento del lienzo**, no a `window`. Verificar que no se pierde ninguna ruta al acotar.
**Dueñas**: CRI-103, CRI-106.

### R-21 · Locución duplicada por exceso de `aria-live`

**Probabilidad**: media · **Impacto**: medio.
**Detección**: pasada real con lector de pantalla. Hay **66 regiones `aria-live`** en el producto hoy.
**Mitigación**: al añadir la causa enfocable (D-14) hay que **retirar** el anuncio duplicado, no sumarlo.
**Dueñas**: CRI-95, CRI-106.

### R-22 · Contraste sin medir a nivel de píxel (ABIERTA-6) y LEDGER-05

**Probabilidad**: media · **Impacto**: alto.
**Detección**: medición sobre el **producto real**, no sobre la tabla del Brandbook, en los cuatro fondos.
**Mitigación**: CRI-91 mide la paleta; CRI-106 mide el producto y ejecuta **LEDGER-05** (pórtico en Noche) **después** de fijar los HEX, porque la menta cambia el fondo contra el que se mide. Orden ya establecido en `03-color-decision.md` §5.
**Dueñas**: CRI-91, CRI-106.

### R-23 · Discoverability sin dato (ABIERTA-1, ABIERTA-4, 8 escenarios)

**Probabilidad**: media · **Impacto**: medio.
**Detección**: no hay — ése es precisamente el riesgo.
**Mitigación**: los valores provisionales entran **marcados como provisionales** en la propia issue (riel icon-only en Medium; zócalo de 1 verbo + `Borrar`). Evidencia de cierre obligatoria: **nota explícita de que siguen sin medir**. No se presentan como validados.
**Dueñas**: CRI-98, CRI-97.

---

## 6. Riesgos de migración visual y de token

### R-24 · El gate cromático falla y obliga a mover éxito o Aula

**Probabilidad**: **media-alta** · **Impacto**: medio.
**Detección**: verificación de separación en color, escala de grises y deuteranopia/protanopia de los tres tríos de `03-color-decision.md` §4.2.
**Mitigación**: la decisión ya está tomada — **éxito se mueve** (el técnico tiene prioridad sobre el estado del cascarón); **Aula se mueve** (está fuera de alcance y parada). Encadena una remedición completa de ese rol sobre los cuatro fondos, que hay que presupuestar. **La salida nunca es "aceptarlo porque el patrón discontinuo lo salva".**
**Dueña**: CRI-91.

### R-25 · La menta no cabe en la franja de luminancia única

**Probabilidad**: media · **Impacto**: medio.
**Detección**: medición sobre los cuatro fondos con un solo HEX en ambos temas.
**Mitigación**: **se ajusta la menta, no se relaja la franja.** El error sería mover el listón para salvar un tono elegido.
**Dueña**: CRI-91.

### R-26 · Deriva Brandbook ↔ `tokens.css`

**Probabilidad**: media · **Impacto**: alto — rompe el mecanismo de autoridad única.
**Detección**: comprobar que ningún HEX de `tokens.css` está ausente del Brandbook.
**Mitigación**: orden estricto Brandbook → `tokens.css` → Component Lab, en un solo commit coordinado. Sin feature flag: dos paletas conviviendo es la deriva exacta a evitar.
**Dueña**: CRI-91.

### R-27 · Regresión de invariancia de tema

**Probabilidad**: baja-media · **Impacto**: alto.
**Detección**: `tokens.test.ts` falla si un rol semántico reaparece en el bloque `[data-theme='dark']`. Es determinista.
**Mitigación**: **el test no se relaja.** La única excepción vigente sigue siendo la rampa del índice elástico; no se añade ninguna nueva. Evidencia de cierre: confirmación de que `tokens.test.ts` no se modificó.
**Dueña**: CRI-91.

### R-28 · Regresión visual amplia y silenciosa en la reconciliación Clay

**Probabilidad**: **alta** · **Impacto**: medio.
**Detección**: capturas antes/después **por familia de superficie**, en Día y Noche. Sin ellas no hay forma de saber qué se rompió.
**Mitigación**: criterio de corte estricto — **sólo materia** (radio, canto, sombra, ritmo). No es un slice de limpieza de CSS. Avanzar por familias dentro del mismo slice.
**Dueña**: CRI-105.

### R-29 · Aplanar por error algo que dependía de la sombra para leerse

**Probabilidad**: media · **Impacto**: bajo-medio.
**Detección**: revisar **cada** selector añadido al grupo `BASE` en Día y Noche antes de incluirlo.
**Mitigación**: los selectores se añaden en lotes revisables; evidencia de cierre incluye la lista con la nota de revisión en ambos temas.
**Dueña**: CRI-90.

---

## 7. Riesgos de proceso

### R-30 · Tomar un informe o una issue como prueba de implementación

**Probabilidad**: **alta** — ya ocurrió: `02-ux-direction-record.md` §6.9 marcaba `VERIFIED` que la paleta usaba un `CommandRegistry` compartido. **No existe tal registro en `src/**`.**
**Impacto**: medio-alto — se planifica sobre una capacidad inexistente.
**Detección**: buscar el símbolo en el código antes de dar por hecha una dependencia.
**Mitigación**: **toda issue revalida `origin/main` al empezar** y trata sus archivos como *orientativos*. CRI-103 lleva el hallazgo escrito en su descripción para que nadie lo herede.
**Dueña**: transversal; registrada en CRI-103.

### R-31 · Slices que se desbordan

**Probabilidad**: media-alta · **Impacto**: medio.
**Detección**: tamaño del diff frente al alcance declarado.
**Mitigación**: cada issue lleva "No entra" explícito. Los tres candidatos a desbordarse están marcados en su propia descripción: CRI-103 (migrar todos los llamantes de golpe), CRI-105 (convertirse en refactor de CSS) y CRI-106 (intentar arreglar los hallazgos en lugar de registrarlos).
**Dueñas**: CRI-103, CRI-105, CRI-106.

### R-32 · Contención sobre `WorkspaceShell.tsx`

**Probabilidad**: media · **Impacto**: bajo-medio — conflictos de merge, no de corrección.
**Detección**: seis slices lo tocan (CRI-89, 94, 95, 99, 101, 102).
**Mitigación**: no ejecutar dos slices que lo modifiquen a la vez, aunque no exista bloqueo formal entre ellos. Mismo criterio para `ResultsPanel.tsx`, donde además el orden **sí** es estricto y está en el grafo.
**Dueña**: transversal.

---

## 8. Resumen por impacto

| Impacto | Riesgos |
|---|---|
| **Crítico** | R-01 fiabilidad · R-02 stale · R-03 tarjeta que aprueba · R-04 identidad por floats |
| **Alto** | R-05 baseline · R-06 schema · R-08 undo · R-09 recuperación · R-13 gestos · R-15 multi-navegador · R-18 foco · R-19 `inert` · R-20 atajos+lector · R-22 contraste · R-26 deriva Brandbook · R-27 invariancia |
| **Medio** | R-07 · R-10 · R-11 · R-12 · R-14 · R-16 · R-17 · R-21 · R-23 · R-24 · R-25 · R-28 · R-29 · R-30 · R-31 · R-32 |

Los cuatro críticos comparten una propiedad: **fallan en silencio**. Ninguno rompe el build ni un test existente; todos producen una interfaz que funciona y afirma algo falso. Por eso su detección es siempre **comparativa** (favorable vs desfavorable, antes vs después, con color vs en gris) y su evidencia de cierre es siempre una captura, nunca un gate verde.
