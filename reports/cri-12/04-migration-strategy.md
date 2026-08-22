# CRI-12D · Estrategia de migración

**Clasificación:** `AUDIT/TEMPORARY`
**Complementa:** `04-implementation-roadmap.md`, `04-dependency-map.md`

Cómo se lleva la dirección aprobada al StructureCo real **sin big-bang**, sin romper contratos estructurales, y dejando el producto utilizable al cerrar cada slice.

---

## 1. Principio rector: sustituir, no coexistir

La tentación por defecto en un rediseño es levantar la interfaz nueva al lado de la vieja tras un flag y conmutar al final. **Aquí se rechaza como estrategia general**, por una razón concreta: el problema que este backlog viene a resolver **es** la existencia de varias fuentes de verdad simultáneas — cinco `matchMedia` de ancho, cuatro booleanos de superficie, breakpoints repartidos entre CSS y TSX. Un shell doble multiplicaría exactamente eso, y con él el riesgo de que Compact y Expanded diverjan, que es la divergencia que CRI-86 §E manda evitar.

La estrategia es **sustitución incremental por slice**: cada slice reemplaza el mecanismo viejo por el nuevo **en el mismo commit**, y cierra dejando el producto entero y coherente.

Esto es posible porque la partición está hecha para que lo sea: ningún slice deja a medias un mecanismo compartido.

---

## 2. Qué puede entrar de forma incremental

Casi todo. La partición del roadmap está construida sobre esta propiedad:

| Slice | Entra solo porque… |
|---|---|
| CRI-89 resolutor | Sustituye cinco `matchMedia` por uno. Al cerrar, la app responde igual o mejor a cada tamaño. |
| CRI-90 materia | Es CSS más una ampliación de tipo. Aditivo puro. |
| CRI-91 Brandbook | Ficheros disjuntos del producto funcional. |
| CRI-92 / CRI-93 spikes | No tocan producto. |
| CRI-95 chrome | La TopBar queda más limpia; nada se pierde, lo que sale migra a su dueño **en el mismo commit**. |
| CRI-96 selección | Con **un** candidato el comportamiento es idéntico al de hoy. El cambio sólo aparece donde hoy había ambigüedad. |
| CRI-97 `contextual-actions` | Superficie **nueva y aditiva**; las rutas previas siguen funcionando. |
| CRI-98 ToolRail · CRI-104 Welcome · CRI-105 Clay | Vestido y forma; sin cambio funcional. |
| CRI-102 `peek` | Estado **nuevo**: abrir y cerrar siguen funcionando como hoy. |
| CRI-103 registro de comandos | Migración por categorías dentro del slice; el bus `workspaceCommands` **no** se sustituye. |
| CRI-106 gate | Mide; no cambia producto. |

---

## 3. Qué tiene que migrarse junto — y por qué

Cuatro conjuntos **no** admiten partición. Partirlos deja el producto incoherente entre commits:

1. **El resolutor y los cinco `matchMedia` (CRI-89).** Mientras quede uno suelto, dos componentes pueden discrepar de clase. El slice no cierra hasta que los cinco están migrados.
2. **El broker y los cuatro booleanos de superficie (CRI-94).** Mantener ambos reintroduce la exclusión mutua manual. Además el `inert` del fondo pasa de gestionarse a mano sólo para el Doctor a ser una regla general — un estado intermedio dejaría superficies modales sin fondo inerte, que es un fallo de accesibilidad, no un detalle.
3. **Brandbook + `tokens.css` + Component Lab (CRI-91), en ese orden.** Un HEX en `tokens.css` ausente del Brandbook es una regresión del mecanismo de autoridad única (`03-color-decision.md` §4.4). Dos paletas conviviendo es la deriva exacta que hay que evitar.
4. **Lo que sale de la TopBar y adónde va (CRI-95).** Si un control se retira en un commit y reaparece en su nuevo dueño en otro, entre ambos hay una capacidad huérfana — y eso viola "no ocultar capacidades reales por limpieza".

---

## 4. Coexistencia temporal de UI vieja y nueva

**Regla general: no la hay.** La sustitución es por slice.

**Tres excepciones acotadas, todas dentro de un mismo slice:**

- **CRI-103**, registro de comandos: se migra **por categorías**. Durante el slice conviven comandos ya proyectados desde el registro y comandos aún construidos en línea. Es coexistencia *interna*, invisible para el usuario, y termina dentro del propio slice.
- **CRI-105**, reconciliación Clay: se avanza **por familias de superficie** (paneles, controles, tarjetas, hojas, modales, tablas), con captura antes/después de cada familia. Durante el slice conviven familias reconciliadas y sin reconciliar. Termina dentro del slice.
- **CRI-90**, selectores de `BASE`: se añaden **en lotes revisables**, cada uno verificado en Día y Noche antes de quedarse.

**Feature flags temporales permitidos:** ninguno se considera necesario con esta partición. Si un slice descubre que lo necesita, la condición es que el flag **muera dentro del mismo slice** — no se acepta un flag que sobreviva al commit de cierre, porque un flag persistente es una divergencia Compact/Expanded esperando a ocurrir.

**Cuándo se retira el código viejo:** en el mismo commit que introduce el nuevo. No hay periodo de gracia. Excepción documentada: el alias `ToolRail.tsx` (5 líneas) se retira en CRI-98, no antes, porque hasta entonces sigue siendo el punto de importación.

---

## 5. Estado persistido — el inventario completo y qué pasa con cada clave

Verificado por lectura en `main` `7fb927fb`. **Ninguna clave se borra en ningún slice.**

| Clave | Dueño | Qué le pasa | Slice |
|---|---|---|---|
| `structureCo.project` | `projectStorage.ts` | **Intacta.** Ningún slice cambia `ProjectModel`… salvo que CRI-92 recomiende migrar `settings.show*` **y** el propietario autorice el refresco de baseline. Por defecto **no ocurre en este backlog**. | CRI-92 → futura |
| `structureco:workspace-layout:v1` | `useWorkspaceLayoutPreferences.ts` | `toolRailCompact` deja de ser preferencia y pasa a derivarse de la clase. Se **ignora sin borrar**, sin invalidar el resto (`inspectorWidth`, `inspectorDetent`, `inspectorCollapsed`, `fullCanvas` se siguen honrando). **No se sube versión**: el lector ya descarta campos desconocidos. | CRI-89 |
| `structureCo.results.mode.v1` | `ResultsPanel.tsx` | Su significado cambia al desaparecer el panel único. Se **lee con tolerancia**; si ya no aplica, se ignora sin borrar y se documenta. | CRI-100 |
| `structureco:editor-layers:v1` | `editorLayers.ts` | **Se amplía**: recibe la elección de evidencia como capa. Ya es tolerante a campos desconocidos. | CRI-100 |
| `structureCo.inspector.expanded.v1` | `InspectorProperties.tsx` | Se **reparte** entre `detail` / `analysis-setup` / `view`, honrando lo guardado. Si alguna sección no se puede preservar, se documenta cuál y por qué. | CRI-99 |
| `structureCo.theme` | `ProjectContext.tsx` | **Intacta**, en forma y valores. Los tres estados de tema (claro / oscuro / según el sistema) se conservan. | — |
| `structureco:space3d:v1` (+`:backup`) | `space3d/data/storage.ts` | **Intacta.** Space3D fuera de alcance. | — |
| Prefijo de sesión de Aula | `ClassroomSessionContext.tsx` | **Intacta.** Aula fuera de alcance. | — |
| IndexedDB de proyectos + `RecoveryRecord` | `projectRepository.ts` | **Intacta.** CRI-104 lee el repositorio para decidir el salto directo a la Mesa; **no escribe nada nuevo**. | CRI-104 |

**Regla transversal de preferencias**, aplicable a todo slice: *leer con tolerancia, ignorar sin borrar, no subir versión de clave salvo necesidad demostrada.* Un usuario que vuelve a una versión anterior tras un rollback debe recuperar sus preferencias intactas.

---

## 6. Continuidad de undo/redo, selección, borradores y contexto

**Undo/redo.** No hay historial global implementado hoy; G-01 (`Ctrl+Z`/`Ctrl+Y`) es trabajo pendiente y entra en **CRI-103**, ya acotado: **no** se dispara con el foco en un campo de texto, en la rejilla del Datasheet, ni en una superficie modal con historial propio. El riesgo real a proteger es que el atajo global deshaga una operación de modelo mientras el usuario creía estar deshaciendo una celda — **pérdida de trabajo real**, y por eso es criterio de aceptación explícito con caso de prueba propio. El contrato canónico del Datasheet (rejilla sin historial propio, escritura vía `updateProject` una vez por aplicar) **no se toca**.

**Selección.** Vive en `WorkspaceUIContext`. Ningún slice la mueve al modelo ni la duplica. T-INV-1 la protege ante cualquier cambio de viewport; CRI-96 añade que **cancelar nunca altera la selección previa** y que `Escape` con el picker abierto tiene alcance acotado. Las superficies que dependen de la selección la **derivan**, no la copian — es criterio de aceptación en CRI-97 y CRI-99.

**Borradores (T-INV-8).** Hoy **no existe** la noción de "borrador que bloquea la sustitución de su superficie". La introduce **CRI-94**, que debe primero **detectar dónde hay borradores reales** — campo numérico del Inspector, celda del Datasheet, edición estructural — antes de prometer el invariante. A partir de ahí: un borrador sin aplicar bloquea la sustitución; si el destino es exclusivo, el origen se **suspende con su estado**, no se destruye. CRI-99 y CRI-102 lo verifican en sus propios casos.

**Contexto de evidencia y cámara.** La capa de evidencia elegida y el encuadre sobreviven a recomposición y rotación (T-INV-1, T-INV-6: desplazamiento **por ancla**, nunca por offset en píxeles). Verificado como criterio en CRI-94 y CRI-100.

**Foco.** Es el riesgo de continuidad más caro. Hoy existe lógica cuidada de retorno de foco (`inspectorReturnFocusRef`, `doctorReturnFocusRef`, `datasheetReturnFocusRef`). CRI-94 debe **absorberla, no perderla**, y generalizarla — es criterio de aceptación explícito.

**URLs / restore state.** StructureCo no tiene hoy estado en la URL: `App.tsx` navega con `useState` sobre `screen`. Ningún slice lo introduce. **Queda explícitamente fuera de alcance**; si en el futuro se quisiera, sería una decisión de producto nueva, no una consecuencia de este backlog.

---

## 7. Cómo se evita que Compact y Expanded diverjan

Es un requisito explícito de CRI-86 §E, y la respuesta es estructural, no de disciplina:

1. **Una sola función de resolución de clase** (CRI-89). Si la clase se decide en un sitio, no hay dos productos.
2. **Una sola tabla clase × superficie → presentación** (CRI-94), leída **sólo** por el broker. Es criterio de aceptación que ninguna superficie decida la suya (R-3).
3. **Misma materia en todas las clases** (CRI-90). Lo que cambia entre clases es la presentación, no de qué está hecha la superficie.
4. **Esencial/Completa sigue rechazada.** El piso conservador de Compact (CRI-95, CRI-97) es un **piso de plegado**, no una segunda aplicación: pliega a overflow, nunca retira una capacidad.
5. **QA en las tres clases en cada slice**, con Compact en portrait **y** landscape — landscape es el peor caso de anchura y es donde 12B marcó brecha.
6. **`success ≠ reliable ≠ safe` y stale fail-closed no degradan en ninguna clase.** Estado del análisis y Model Doctor están explícitamente excluidos del plegado.

---

## 8. Rollback

**Modelo general:** cada slice es un commit revertible. Como ningún slice escribe una clave nueva ni destruye una existente, revertir devuelve el comportamiento anterior **sin pérdida de datos** y sin dejar preferencias corruptas.

| Slice | Rollback | Riesgo residual |
|---|---|---|
| CRI-89 | Revertir. `toolRailCompact` almacenado nunca se borró: vuelve a honrarse. | Ninguno |
| CRI-90, CRI-105 | Revertir. Sólo CSS y tipos. | Ninguno |
| CRI-91 | Revertir devuelve Brandbook + tokens + Lab de forma atómica. **Nunca** `git revert` sobre los commits cromáticos históricos (`74dfc76`/`f60eae5`/`7fb927f`). | Ninguno; los tokens no se persisten |
| CRI-92, CRI-93, CRI-106 | Revertir el informe. | Ninguno |
| CRI-94 | Revertir. **Vigilar el caso `inert` pegado**: si en producción quedara un fondo inerte, el rollback es inmediato y sin pérdida de datos. | Bajo, detectable |
| CRI-95, CRI-98, CRI-100, CRI-101, CRI-103 | Revertir. Sin estado persistido nuevo. | Ninguno |
| CRI-96, CRI-97 | Revertir. Las rutas previas siguen intactas porque el slice no las elimina. | Ninguno |
| CRI-99 | Revertir. **Mientras no se toque el schema**, un proyecto guardado abre idéntico. | Ninguno con el alcance por defecto |
| CRI-102 | Revertir devuelve el comportamiento de cierre actual. | Ninguno |
| CRI-104 | Revertir. No se escribe nada nuevo en IndexedDB ni en `localStorage`. | Ninguno |

**El único rollback que dejaría de ser trivial** es una eventual migración de `settings.show*` fuera del schema — porque tocaría `ProjectModel`, `schemaVersion` y proyectos ya guardados. Por eso **no está en este backlog**: CRI-92 sólo evalúa y recomienda, y la migración sería una issue posterior con su propio plan de reversión y autorización explícita del propietario para refrescar `protected-baseline.sha256`.

---

## 9. Gates: focales, no masivos

CRI-86 lo pide explícitamente y cada issue lo declara. La regla:

- **Siempre**: `npm run lint`, `npm run typecheck`, `npm run build`.
- **`npm run verify:protected`**: obligatorio en todo slice que se acerque a `src/store/`, `src/types.ts`, `src/data/`, `src/engine/` o `src/workers/`. **Debe pasar sin `--update`.**
- **`vitest` acotado a los directorios del slice**, nunca `npm test` completo por defecto.
- **QA de feature sólo el que corresponde**: `qa:topbar` para chrome/Results 1; `qa:model-doctor` para broker y `peek`; `qa:structural-edits` (+`:webkit`) para selección y acciones contextuales; `qa:bulk-edit` para Inspector.
- **`verify:perf`**: en Welcome (bundle de entrada) y en la medición de rendimiento.
- **WebKit**: obligatorio en CRI-96, CRI-97 y CRI-106 — son los tres slices donde el comportamiento de puntero y portapapeles diverge de verdad entre navegadores.

**Nunca**: relajar un umbral para que un gate pase. Si un gate nuevo resulta inestable, se retira el gate; no se baja el listón.

---

## 10. Publicación

**Ningún slice publica en GitHub Pages por defecto.** Sólo lo hace la issue que lo requiera explícitamente, y ninguna de las 18 lo requiere hoy. La publicación es competencia del cierre del programa (CRI-87 / CRI-12·E), no de los slices.
