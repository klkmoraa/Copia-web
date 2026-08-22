# CRI-12C · Gramática de superficies

**Clasificación:** `AUDIT/TEMPORARY`
**Complementa:** `03-visual-direction-record.md` (V-02, V-03, V-04, V-05, V-13)

Este documento fija de qué está hecha cada superficie de structureCo. **No fija dónde aparece ni quién la asigna** — eso es el vocabulario de presentación cerrado en CRI-9 §11 y confirmado en CRI-12B §6.10, que esta fase no reabre.

---

## 1. Los dos ejes, y por qué no son el mismo

structureCo tiene dos vocabularios distintos que se cruzan en cada superficie:

| Eje | Pregunta que responde | Quién decide | Dónde se cerró |
|---|---|---|---|
| **Presentación** (`band`, `dock`, `inset`, `sheet`, `drawer`, `fullscreen`, `overlay`, `floating`) | ¿Dónde aparece, coexiste con el lienzo, atrapa foco, qué hace `Escape`? | **El resolutor, siempre** (R-3) | CRI-9 §11 → CRI-12B §6.10 |
| **Materia** (`BASE`, `INSET`, `RAISED`, `FLOATING`, `SHEET`, `MODAL`) | ¿De qué está hecha, cuánto volumen tiene, cómo responde al tacto? | Esta fase (CRI-12C) | Aquí |

**Tres nombres colisionan** — `inset`, `sheet`, `floating` — con significados distintos en cada eje. Convención obligatoria, sin excepción:

- **Materia → MAYÚSCULAS**: `INSET`, `SHEET`, `FLOATING`.
- **Presentación → `minúsculas de código`**: `inset`, `sheet`, `floating`.

Un `inset` (presentación: superficie que el presupuesto paga pero cuyo reflow no) normalmente es materia `RAISED`, no `INSET`. No son sinónimos y confundirlos produce paneles hundidos que deberían estar elevados.

## 2. Los seis niveles de materia

Un elemento tiene **exactamente un** nivel a la vez. El estado pulsado es lo único que coexiste con un nivel.

### `BASE` — sin volumen

**Qué es:** la superficie de trabajo. Sin sombra, sin canto de volumen, sin gradiente. Su jerarquía la llevan el trazo, el espaciado y la tipografía.

**Quién lo usa:** el lienzo; la rejilla del Datasheet; las tablas densas por posición; las filas del inspector; los campos numéricos en reposo; cualquier dato comparable.

**Regla:** `BASE` es el nivel **por defecto** en zonas técnicas densas, no una excepción que haya que justificar. Si una zona muestra datos comparables y no está en `BASE`, el error está en la zona, no en la regla.

**Ya implementado** como `data-level="flat"` en `src/design-system/material.css`.

### `INSET` — la luz invertida hacia dentro

**Qué es:** la misma fuente de luz, hacia adentro. **No es la sombra elevada con menos opacidad: es la sombra al revés.** Sin sombra exterior de ningún tipo.

**Quién lo usa:** campos de entrada; tabs y segmentos; el segmento seleccionado de un control; toggles activos; bandejas que contienen herramientas; controles de zoom.

**Reglas:**
- **Un control activo baja, no sube.** Es la regla Clay que más se olvida y la que más rápido infla una interfaz.
- **Una bandeja `INSET` puede contener piezas `RAISED`.** Es la combinación que produce la sensación física de herramientas apoyadas sobre una mesa — y es el único caso donde dos niveles se anidan legítimamente.
- La cavidad es **arcilla neutra**: el color de marca queda para rellenos de acción y selección, y no tiñe campos, tarjetas ni capas.

**Ya implementado** como `data-pressed="true"`.

### `RAISED` — la superficie normal

**Qué es:** volumen medido, canto de 1px visible, sombra doble (oscura abajo-derecha, luz arriba-izquierda). Es el nivel de casi todo el cascarón.

**Quién lo usa:** paneles; barras; tarjetas; el botón primario; el riel de herramientas; las tarjetas de resultado de V-10.

**Reglas:**
- **El canto es obligatorio.** Sin canto no es Clay, es neumorfismo.
- **`RAISED` significa "esto es una pieza y se puede tocar" o "esto es un grupo".** Nunca significa "esto es correcto".
- El botón primario es la única pieza rellena con el acento en vez de con la superficie, y su volumen se mide **sobre el acento**, no sobre el marfil.

**Ya implementado** como `data-level="raised"`.

### `FLOATING` — despegado del plano

**Qué es:** un escalón más de sombra que `RAISED`, mismo canto. Se lee como "esto está por encima y es temporal".

**Quién lo usa:** popovers; menús; toasts; el chrome que flota sobre el lienzo (badge de modo, chips de vista, controles de zoom, leyenda, quick-entry, tooltip de corte, panel de capas).

**Reglas:**
- El chrome sobre lienzo usa **relleno opaco y canto medido**, nunca vidrio ni `backdrop-filter`. El desenfoque es caro y en listas largas es inaceptable; queda reservado, si acaso, a barra superior y overlays — **nunca por fila**.
- `FLOATING` **no oscurece el fondo**. Si necesita oscurecerlo, es `MODAL`.

**Ya implementado** como `data-level="floating"`.

### `SHEET` — la luz cae desde arriba, así que la sombra sube

**Qué es:** materia de panel deslizante. Su particularidad no es la cantidad de sombra sino **la dirección**: como la fuente de luz está arriba, una hoja que entra desde abajo proyecta su sombra **hacia arriba**. Invertir esto es el error que hace que una hoja parezca pegada con cinta.

**Quién lo usa:** hojas inferiores en Compact; paneles deslizantes laterales; la superficie de Results cuando el resolutor la presenta como `sheet`.

**Reglas:**
- Canto en el borde de entrada, siempre.
- Radio del escalón alto **sólo en las esquinas de entrada**; los bordes que tocan el viewport no se redondean.
- Una hoja **no atrapa foco mientras haya lienzo visible** (R-5, ya cerrado). La materia no cambia esa regla.

### `MODAL` — sustituye la atención

**Qué es:** el escalón más alto de sombra, más un velo sobre el fondo. Es el único nivel que **oscurece lo que hay detrás**.

**Quién lo usa:** diálogos; el Datasheet cuando el resolutor lo presenta como `drawer`/`fullscreen`; confirmaciones destructivas.

**Reglas:**
- El velo es un rol de token medido por tema, **no** un negro con opacidad puesto a ojo.
- `MODAL` atrapa foco y marca el fondo inerte (R-5, ya cerrado).
- **`MODAL` y `FLOATING` no se anidan.** Un popover dentro de un modal sube a `MODAL` o baja a `RAISED`; no hay tres capas de sombra.

## 3. Correspondencia materia × presentación

Ninguna celda de esta tabla decide presentación: **describe qué materia le corresponde a cada presentación que el resolutor ya puede asignar**.

| Presentación (cerrada en CRI-9/12B) | Materia | Nota |
|---|---|---|
| `band` (sólo TopBar) | `RAISED` | Chrome permanente; canto inferior, no sombra grande |
| `dock` | `RAISED` | Coexiste con el lienzo, con reflow |
| `inset` | `RAISED` | Ojo: presentación `inset` ≠ materia `INSET` |
| `sheet` | `SHEET` | La dirección de la sombra es lo que la define |
| `drawer` | `MODAL` | Es modal por definición: atrapa foco |
| `fullscreen` | `BASE` o `MODAL` | `BASE` si sustituye la mesa y muestra datos densos (Datasheet); `MODAL` si es una decisión |
| `overlay` | `FLOATING` | Efímero, ligado a un gesto |
| `floating` | `FLOATING` | Chrome sobre el lienzo |
| `peek` (estado, no presentación — R-4) | Hereda la materia de su `drawer`/`fullscreen` | `peek` **no** es un nivel de materia nuevo |

**`peek` no baja de nivel.** Degradar a `peek` cambia cuánto se ve, no de qué está hecho. Un Datasheet en `peek` sigue siendo la misma materia con la misma rejilla plana dentro.

## 4. Reglas transversales

1. **Un nivel a la vez.** `data-level` es excluyente. Sólo el estado pulsado coexiste.
2. **Nunca dos elevaciones anidadas sin cambio de nivel entre ellas.** Una tarjeta `RAISED` dentro de un panel `RAISED` produce una pieza que flota sobre nada. El contenido de un `RAISED` es `BASE` o `INSET`.
3. **El contenedor tiene materia; el contenido técnico no.** Dentro de un panel Clay, una tabla es `BASE`. Es la aplicación literal de "Clay para el cascarón, plano y exacto para la ingeniería".
4. **La materia no señala verdad.** Ninguna superficie sube de nivel porque un resultado sea bueno, converja o cumpla algo. La elevación indica **agrupación e interacción**, siempre.
5. **La materia no es la presentación.** Una superficie no puede pedir su propia materia por conveniencia de layout más de lo que puede pedir su propia presentación.
6. **Cambiar la materia es editar un bloque**, no perseguir reglas repartidas. `material.css` ya está declarado una vez por rol de elevación y por lista de selectores; los cuatro niveles que faltan por formalizar (`BASE` explícito para más zonas, `SHEET`, `MODAL`) siguen ese mismo patrón.

## 5. Radios por nivel

Reparto derivado en V-05. La escala numérica la fija el Brandbook; aquí sólo el reparto.

| Nivel | Radio | Por qué |
|---|---|---|
| `BASE` (datos) | El escalón más cerrado | Redondear una rejilla de datos la vuelve más difícil de escanear |
| `INSET` (controles) | Escalón de control | Por debajo de él la sombra no tiene curva que envolver y el volumen deja de leerse |
| `RAISED` | Escalón de tarjeta/panel | |
| `FLOATING` | Escalón de tarjeta/panel | Mismo que `RAISED`: la diferencia la hace la sombra, no la curva |
| `SHEET` | Escalón alto, **sólo en las esquinas de entrada** | |
| `MODAL` | Escalón alto | |

## 5b. Espaciado y bordes

Derivados. No abren dirección de producto; se fijan aquí para que CRI-12D no tenga que inferirlos.

**Espaciado — base 4px.** Es la escala vigente del Brandbook §06 y de `tokens.css`. Board 09 la confirma; Board 08 propone base 8px y **pierde**: una base de 8 no puede expresar los ajustes finos que una rejilla de datos necesita, y la de 4 sí contiene a la de 8.

Reparto de ritmo, que es la parte visual:

- **El aire va entre grupos, no entre filas.** Espaciado generoso alrededor de los bloques, apretado dentro de ellos. Es lo que hace que una vista densa se lea como densa y no como saturada.
- **Tres densidades de fila**, ya presentes en `tokens.css` como tokens por tier: compacta (profesional), cómoda y táctil. La compacta es el defecto en zonas técnicas; la táctil se activa por puntero grueso, nunca por gusto.
- **La interfaz de trabajo no crece con la ventana.** Sólo la escala de display de superficies editoriales — Welcome, estados vacíos grandes — es fluida.
- Si una vista compacta cabe holgada, el resultado correcto es **más aire, no más contenido**.

**Bordes.**

- **1px es el grosor por defecto** de todo canto de materia. El canto de una pieza `RAISED`/`FLOATING`/`SHEET`/`MODAL` es obligatorio y siempre visible (V-04): sin él la pieza emerge del fondo en vez de apoyarse sobre él.
- **2px queda reservado a énfasis estructural** — el separador redimensionable, el borde de un campo en error — nunca a decoración.
- **En Noche el canto sube de importancia**, no de grosor: la sombra pierde trabajo y el borde lo gana por contraste, no por engordar.
- **Un borde nunca sustituye al anillo de foco.** El foco es un anillo separado del canto, con su propio grosor y su propio desplazamiento (V-14).
- **Divisores dentro de zonas `BASE`**: trazo fino neutro, nunca sombra. Una tabla separa filas con línea, no con elevación.

## 6. Motion por nivel

El contrato de comportamiento ya está cerrado e implementado (CRI-12B §6.12). Reparto de escalones por nivel de materia:

| Transición | Escalón | Qué se mueve |
|---|---|---|
| Pulsar cualquier nivel | `press` | La arcilla se aplana: sombra exterior → cavidad interior, más el hundimiento de un solo token |
| Hover en `RAISED` / `FLOATING` | `fast` | Sube medio escalón de sombra. **Nunca cambia de color de fondo para señalar hover** |
| Entrada/salida de `RAISED`, `INSET` | `standard` | |
| Entrada/salida de `SHEET`, `MODAL`, segmentado, cambio de tema | `slow` | |
| Capas de evidencia | `fast` | Entran y salen sin desplazamiento |
| Geometría del modelo | **ninguna** | No se interpola nunca. Se anima la cámara, no el dibujo |

Sólo se animan `transform`, `opacity` y `box-shadow`. Nada que provoque recálculo de layout.

Con `prefers-reduced-motion`: las duraciones colapsan y el hundimiento se anula por token, de una sola vez para todos los niveles. **El relieve permanece.** El encuadre de cámara sigue ocurriendo, instantáneo — se retira el movimiento, nunca la función.

## 7. Estado de implementación

Lectura directa de `src/design-system/material.css`, sin ejecutar nada:

| Nivel | Estado hoy |
|---|---|
| `BASE` | Implementado como `data-level="flat"`, con lista de selectores para zonas técnicas densas |
| `INSET` | Implementado como `data-pressed="true"` |
| `RAISED` | Implementado como `data-level="raised"` |
| `FLOATING` | Implementado como `data-level="floating"`, incluido el grupo de chrome sobre lienzo con relleno opaco |
| `SHEET` | Token de sombra existe (`--sc-shadow-sheet`, con la sombra hacia arriba); **no hay nivel declarado** en `material.css` |
| `MODAL` | Token de sombra y roles de velo existen; **no hay nivel declarado** en `material.css` |

**Dos huecos para CRI-12D**, ambos de formalización y no de decisión: declarar `SHEET` y `MODAL` como niveles del mismo patrón `data-level`, y ampliar la lista de selectores de `BASE` a las zonas técnicas densas que hoy no la declaran.
