# CRI-10 — Evolución: tarjetas de Results, velocidades de uso y gobernanza

**Fecha:** 2026-08-15 12:30
**Agente:** Claude Code
**Rama:** `research/cri-10-ux-system`, misma rama que las dos correcciones anteriores
**Evoluciona:** `f54cd67` (corrección de precisión)
**Clasificación:** `SPEC/DESIGN` — evolución de la especificación de diseño. No es implementación, no toca `src/**`, no cambia solver/modelo/schema.

> **Qué es esta pasada.** No es una corrección de un error: es una ampliación deliberada. Las dos pasadas anteriores arreglaron discoverability y precisión sobre la dirección ya elegida. Ésta **añade potencia y matiz** a esa misma dirección — recupera el patrón visual de tarjetas técnicas que el producto ya tenía, formaliza cómo conviven una experiencia sencilla y una completa, y cierra huecos de gobernanza para que StructureCo no vuelva a acumular funciones escondidas. **«La mesa y el instrumento» no se abandona**: sigue habiendo un solo `Selection`, un solo comando, un solo análisis, tres composiciones y una superficie de resultados invocada, no residente.

---

## 0. Resumen ejecutivo

Doce puntos, cada uno con una decisión concreta:

1. **Results/`dense` recupera el patrón de tabs por familia + tarjetas técnicas** del producto real — verificado línea a línea contra `ResultsPanel.tsx`, no inventado. Sigue invocado, nunca residente; el overlay del lienzo sigue siendo la evidencia principal.
2. **Esencial/Completa** se declara **hipótesis a validar en CRI-11**, no decisión — misma capacidad, mismo comando, dos presentaciones.
3. **Tres velocidades de acceso** se formalizan como regla: visible → contextual → rápida, y ninguna capacidad esencial depende sólo de la más rápida.
4. **El Riel es memoria muscular**: su contenido no cambia con la selección en ninguna clase. El zócalo es lo único contextual.
5. **Atención por excepción**: la Cinta tiene un modo silencioso por defecto y gana presencia sólo en la señal concreta que lo necesita — con un presupuesto de chrome permanente que toda función futura debe justificar.
6. **Contexto nunca perdido**: una línea compacta — objeto/alcance · evidencia · caso — vive en cada superficie profunda.
7. **Command Palette** se ordena de forma determinista por selección activa, nunca por IA ni historial de uso.
8. **Results supera el patrón tradicional**: capas técnicas, fiabilidad separada, procedencia y fail-closed se protegen explícitamente; ningún rojo/verde de aprobado-reprobado.
9. **Datasheet** recibe un checklist de evaluación de nueve puntos para CRI-11 — sin decidir virtualización sin medir.
10. **Ocho escenarios de discoverability sin instrucciones**, con protocolo de medición, para que «122/122 con puerta declarada» deje de confundirse con «122/122 fácil de encontrar».
11. **Gobernanza futura**: toda función nueva declara `capability → owner → puerta visible → puerta contextual → puerta de experto → Expanded → Medium → Compact`.
12. **Cuatro ideas quedan aparcadas** para investigación futura, explícitamente fuera de las 122 capacidades y explícitamente no implementadas.

**8 láminas nuevas**, verificadas contra el DOM (gate de desbordamiento) y contra el código real del producto donde recuperan un patrón existente.

---

## 1. Results/`dense` — las tarjetas recuperadas

### 1.1 Qué se verificó antes de diseñar nada

Todo lo que sigue se contrastó contra `src/features/results/` en este árbol, no contra la memoria de las capturas:

| Afirmación de diseño | Evidencia en el código |
|---|---|
| Los tabs se agrupan en cinco familias: Estado, Fuerzas, Forma, Avanzado, Entender | `ResultsPanel.tsx:43-48` — array `resultFamilies`, literal |
| Estado = Resumen + Reacciones · Fuerzas = Axial + Cortante + Momento · Forma = Deformada · Avanzado = Influencia · Entender = Aprender | Mismo array, campo `tabs` de cada familia |
| Axial, Cortante y Momento llevan color técnico en el propio tab; Deformada se lee por el color de sus tarjetas | `ResultsPanel.tsx:29-37` — sólo `axial`/`shear`/`moment`/`influence` declaran `color:`; `deformed` no |
| Cada diagrama tiene máximo, mínimo, posición y objeto ya vinculados en el modelo de datos | `ResultsPanel.tsx:635-698` — `memberResult.maxMoment/minMoment`, `criticalPoints` con `kind: 'maximum'/'minimum'` y `x` |
| La procedencia (caso, convención de signos, posición) es un componente propio | `ProvenanceCard.tsx` |
| La fiabilidad numérica es un componente separado del valor | `NumericQualityCard.tsx` |
| El índice elástico es una tarjeta propia, no un tab | `ElasticDemandCard.tsx` — no existe ningún id `'elastic'`/`'demand'` en el array de tabs |

**Consecuencia de la última fila:** el índice elástico (RES-05) **no se diseña como un sexto tab**. Eso inventaría una estructura que el código no tiene. Vive como tarjeta dentro de la familia **Estado**, junto a Resumen y Reacciones — el mismo sitio donde CRI-9 ya lo situó («tarjeta dentro de Results»).

### 1.2 La arquitectura de CRI-10 no se reabre

```
canvas / evidencia  →  detalle contextual  →  Results / dense INVOCADA
   (overlay N/V/M/δ)      (Detail, con selección)    (tabs por familia + tarjetas)
```

- El overlay sobre el lienzo (capa de evidencia, §9.2 del documento base) **sigue siendo la lectura a primer golpe de vista, global o de la selección**. No se toca.
- El Detalle (contextual, aparece con selección) **sigue siendo el resumen condensado**: dos o tres métricas, no la ficha completa.
- **Lo que cambia:** cuando el usuario entra a `dense`, el contenido ya no es sólo Reacciones/Influencia/Aprender (como quedó tras la corrección de discoverability) — recupera **también** Axial/Cortante/Momento/Deformada como familias con su curva y su tarjeta de máximo/mínimo. Esto no contradice D-03 (Results deja de ser panel residente): `dense` sigue siendo invocada, nunca reserva espacio, y su existencia sigue condicionada a un resultado **vigente**.

**Por qué esto no es «restaurar el panel»:** un panel residente roba lienzo permanentemente, exista o no un resultado, haya o no selección. `dense` con las cinco familias sigue apareciendo **sólo cuando se invoca**, sigue **desapareciendo del todo** cuando no hay análisis vigente (§9.1 del documento base, fail-closed), y su contenido rico no cuesta nada mientras está cerrada. Lo que se recupera es la **profundidad de contenido**, no la residencia.

### 1.3 Anatomía de `dense` con tarjetas

```
┌─────────────────────────────────────────────────────────┐
│ [glifo] Resultados        B-03 · Momento · Servicio 1   [Lectura limitada] [Salir] │
├─────────────────────────────────────────────────────────┤
│ ESTADO          FUERZAS              FORMA    AVANZADO  ENTENDER │
│ Resumen         Axial Cortante Momento Deformada Influencia Aprender │
│ Reacciones                                                │
├─────────────────────────────────────────────────────────┤
│                     [curva del diagrama]                 │
│  ┌───────────────────────────────────────────────────┐   │
│  │ M · Momento                                  B-03  │   │
│  │  Máx.  36.35 kN·m         Mín.  −31.15 kN·m        │   │
│  │  x = 3.000 m               x = 0.000 m             │   │
│  └───────────────────────────────────────────────────┘   │
│  [Procedencia]  [Causa de fiabilidad si aplica]           │
│  [Fila en la hoja de datos]  [Localizar en el modelo]     │
└─────────────────────────────────────────────────────────┘
```

**Regla dura, y es la que el enunciado pide explícitamente:** *«los datos técnicos deben seguir planos, legibles y comparables. No conviertas cada número en una card decorativa.»* Aplicada así:

- La tarjeta de máximo/mínimo (`.mmcard`) es **una sola por tab**, con dos columnas (Máx./Mín.) — no una tarjeta por número. Comparar el máximo contra el mínimo es la tarea; una tarjeta por valor rompería esa comparación.
- Los números van en `--sc-font-mono`, `tabular-nums`, 17px — el mismo suelo tipográfico de §14.1 del documento base, no una talla especial «de tarjeta».
- El fondo de la tarjeta es un tinte del 8% del color técnico, no un color pleno — es Brandbook Clay (relleno suave, nunca saturado sobre datos), no decoración nueva.
- La curva del diagrama es una forma, no una ilustración: una sola línea + relleno suave del color técnico, sin sombra clay (el Brandbook §02 prohíbe clay sobre el dibujo técnico, y esto es una extensión de esa prohibición al espacio de datos).

### 1.4 Expanded / Medium / Compact portrait / Compact landscape

| Clase | Presentación de `dense` | Qué cambia realmente |
|---|---|---|
| **Expanded** | `drawer` ancho (860px), tabs en una fila por familia, tarjeta de máx/mín a dos columnas | Ninguna adaptación especial — hay espacio de sobra |
| **Medium** | `drawer` ancho, igual que Expanded | `dense` ya era invocada y de ancho fijo; Medium no lo estrecha porque el `inset` del Detalle es lo único que responde a la clase |
| **Compact portrait** | `fullscreen`, familias se envuelven a varias filas (verificado en la lámina 22b: Estado en una fila, Fuerzas+Forma en la siguiente, Avanzado+Entender en la última), tarjeta de máx/mín se mantiene a dos columnas — **no se apila a una columna con etiquetas repetidas** | El envoltorio de filas es automático (flexbox), no una regla nueva que decidir |
| **Compact landscape** | `fullscreen`, mismo contenido; con más ancho que alto las familias caben en menos filas | **No cambia materialmente** frente a portrait — a diferencia de Datasheet o del Inspector, `dense` no tiene una hoja con detent que dependa de la dimensión mayor. No se generó una lámina dedicada para esto porque no hay una decisión distinta que tomar; si CRI-11 mide lo contrario, es una corrección, no una decisión pendiente hoy |

### 1.5 El vínculo completo, verificado en las láminas

> modelo → resultado → procedencia → datos densos → volver/localizar en modelo

| Paso | Dónde vive | Lámina |
|---|---|---|
| Modelo → resultado | Selección + capa de evidencia sobre el lienzo | `23-nvm-deformada-continuidad` |
| Resultado → procedencia | Tarjeta de procedencia dentro de `dense` | `22-results-dense-expanded` |
| Procedencia → datos densos | Ya está en la misma superficie (no hace falta un salto más) | `22`, `22b` |
| Datos densos → volver/localizar | `peek` — `dense` se pliega, no se cierra | `27-dense-peek-continuidad` |

**`dense` gana `peek`, y es una extensión real del contrato de CRI-9 (T-INV-2), no una invención de esta pasada.** Datasheet y Model Doctor ya lo tenían desde la corrección de discoverability; `dense` no lo tenía. Localizar desde una tarjeta de resultado cerraba la superficie — el mismo defecto que ya se corrigió en las otras dos. Se corrige aquí por la misma razón.

### 1.6 Preparado para Aula, sin diseñar Aula

Aula comparte el mismo análisis y el mismo `ProjectModel` (restricción protegida desde CRI-7). Esta pasada no diseña una superficie de resultados para Aula, pero dos decisiones ya tomadas la dejan **alcanzable sin reabrir arquitectura**, exactamente como U-14 de CRI-9 exigía:

1. Las familias son datos (`RESULT_FAMILIES` en el concepto, `resultFamilies` en el código real), no una vista escrita a mano por audiencia — un futuro modo Aula podría mostrar un subconjunto de familias (p. ej. sólo Estado y Fuerzas) sin duplicar el componente.
2. `dense` se invoca desde el Detalle y desde el chip de estado — las mismas dos puertas servirían a Aula sin una tercera superficie.

**No se decide nada de esto para Aula ahora.** Es la vía de repliegue conceptual que U-14 pedía preservar, documentada, no activada.

📐 `shots/22-results-dense-expanded.png` · `22b-results-dense-compact.png` · `23-nvm-deformada-continuidad.png` · `27-dense-peek-continuidad.png`

---

## 2. Dos velocidades de uso — hipótesis, no decisión

### 2.1 Qué se propone

**Una preferencia de presentación** (`densidad: 'esencial' | 'completa'`), nunca una segunda aplicación:

| | Esencial | Completa |
|---|---|---|
| Zócalo | 1 verbo primario + Borrar; el resto en un `disclosure-more` visible pero plegado | Todos los verbos primarios que quepan + `⋯` |
| Riel | Igual contenido; el mismo Riel en las dos — esto no varía por densidad | Igual |
| Cinta | Igual — la Cinta no tiene variante por densidad, ya está minimizada por atención-por-excepción (§5) | Igual |
| Command Palette | Disponible, no promovida visualmente | Disponible, con atajos siempre a la vista |
| `dense` | Mismas familias; Avanzado/Entender pueden empezar plegadas | Todas visibles por defecto |

### 2.2 Por qué es UNA aplicación

- **Mismo `Selection`, mismo comando, mismo estado, mismo análisis** en los dos modos — verificable porque el zócalo de las dos versiones (lámina 25) invoca exactamente el mismo generador (`zocalo()`) con la misma selección `B-03`, sólo con distinta lista de verbos primarios.
- **Ninguna capacidad esencial puede desaparecer** al pasar a «Esencial» — sólo se pliega detrás de un disclosure visible (`.disclosure-more`, con las herramientas nombradas: «Dividir · Cota · Corte · Invertir»), nunca se retira del todo. Esto es lo mismo que ya rige para el Riel-en-iconos de Medium (§5.2 del documento base): comprimir no es amputar.
- El interruptor vive en Preferencias (menú de documento), como una preferencia más — no como una pantalla de bienvenida ni una elección de producto separada.

### 2.3 Protocolo de validación para CRI-11

**Esto es una hipótesis explícita. No se decide aquí si debe existir en producción, ni su nombre final.**

| Qué medir | Cómo |
|---|---|
| Comodidad percibida | Tarea idéntica (cambiar sección de B-03) resuelta por la misma persona en los dos modos, orden aleatorizado; entrevista corta post-tarea |
| Discoverability de lo avanzado | ¿La persona en modo Esencial encuentra el disclosure sin ayuda? Tiempo hasta el primer intento correcto |
| Coste de cambio de modo | ¿Alguien que empieza en Esencial necesita pasar a Completa a mitad de sesión, y cuánto le cuesta encontrarlo? |
| Sesgo de "modo por defecto" | Repetir con Completa como default y Esencial como opt-in, para separar el efecto del modo del efecto del orden |

**Si CRI-11 mide que Esencial no mejora nada frente a Completa con buen disclosure, la hipótesis se descarta** — no es una promesa de que dos modos sean mejor que uno.

📐 `shots/25-esencial-vs-completa.png`

---

## 3. Tres velocidades de acceso — formalizado como regla

Ya era una práctica dispersa en el documento base (paleta con atajos visibles, zócalo con verbos, Detalle con controles). Se formaliza aquí como **contrato explícito**, con la regla dura que el enunciado pide:

> **Ninguna capacidad esencial puede depender únicamente de un atajo, de la Command Palette o de un menú contextual.** Toda capacidad esencial (criticidad "esencial" en el inventario de CRI-8) necesita al menos una ruta **visible** o **contextual** — la ruta rápida es un acelerador, nunca la única puerta.

| Capacidad | Visible (aprender) | Contextual (trabajar) | Rápida (experto) |
|---|---|---|---|
| Cambiar sección | Detalle → Propiedades → campo Sección | Zócalo → «Sección» | Paleta → «Sección» / `Ctrl K` |
| Aplicar carga | Riel → grupo Cargar | Zócalo → «Carga» | Tecla `P`/`D`/`O` |
| Resolver | Cinta → «Resolver», siempre visible | — (ya es global) | `Ctrl ⏎` (G-01, pendiente de implementar) |
| Cambiar de evidencia (capa) | Chips flotantes del lienzo, siempre visibles | — (ya es global sobre el lienzo) | Paleta → «Capa · M» |
| Localizar un objeto | Botón «Localizar» en Detalle/`dense`/Doctor/Datasheet | Mismo botón, es la ruta contextual | Paleta → buscar por ID |
| Copiar/Duplicar/Repetir | — (MOD-12/13 nunca tuvieron ruta visible, F-corrección anterior) | Zócalo → `⋯` | `Ctrl C`/`Ctrl D`/`R` |

La última fila es el caso límite que prueba la regla: Copiar/Duplicar/Repetir **no tienen ruta «visible» de primer nivel** (no están en el Riel ni en la Cinta) — pero **sí tienen ruta contextual** (el desbordamiento del zócalo, con el atajo mostrado al lado), así que la regla se cumple: nunca dependen *sólo* del atajo. Antes de la corrección de discoverability, dependían únicamente de la tecla — eso es exactamente lo que la regla prohíbe, y por eso se corrigió.

---

## 4. Riel estable + zócalo contextual

### 4.1 El contrato

> **El contenido del Riel — qué grupos, qué herramientas, en qué orden — es idéntico sea cual sea la selección, en las tres clases.** Lo único que cambia con la selección es el zócalo, anclado al objeto.

Esto **ya era cierto** en la especificación base (el Riel nunca fue descrito como reactivo a la selección), pero no estaba dicho como regla explícita ni demostrado con dos selecciones distintas una junto a la otra. La lámina 26 lo hace: el mismo Riel (Navegar · Crear · Cargar), letra por letra, con un nudo seleccionado a la izquierda y una carga distribuida a la derecha — sólo el zócalo cambia.

### 4.2 Por clase

| Clase | Presentación del Riel | Semántica |
|---|---|---|
| **Expanded** | Icono + rótulo, agrupado con encabezado | La misma que Medium/Compact — mismas herramientas, mismo orden |
| **Medium** | Icono + rótulo bajo el icono, más compacto (76px), sin encabezado de grupo, filete en su lugar | Idéntica |
| **Compact** | Dock táctil flotante, iconos con rótulo bajo | Idéntica — es el mismo registro de herramientas (`MOD-01`, «registro único de herramientas»), nunca un subconjunto |

**«Icono + rótulo donde ayude» no es una regla nueva** — ya era la especificación de Expanded (168px, rótulos que caben) frente a Medium (76px, sólo iconos + letra). Lo que esta pasada añade es la explicitación: **la decisión de icono-vs-rótulo es por clase, no por selección**, y sigue siendo la hipótesis ABIERTA-1 del documento base — nadie la ha medido, y esta pasada no la decide.

📐 `shots/26-riel-estable-zocalo.png`

---

## 5. Atención por excepción

### 5.1 El contrato

> **La Cinta tiene un modo silencioso por defecto. Cada control gana presencia sólo cuando su propia condición lo exige — nunca todos a la vez, nunca por asociación.**

| Control | Modo silencioso | Dispara atención |
|---|---|---|
| Persistencia | Icono + «Guardado», sin color de énfasis | `conflicto` |
| Model Doctor | Icono, sin badge | `hallazgos > 0` |
| Estado del análisis | Chip compacto, color de estado normal | `stale` / `limited` / `unreliable` / `failed` |
| Deshacer/rehacer, aviso, Resolver | **Nunca cambian** — no son señales de estado, son acción e identidad | — |

**Cómo se ve «gana presencia»:** un anillo de color (2px, sobre el color del propio estado — ámbar para advertencia, carmín para error) alrededor del control específico, y el badge de recuento cuando aplica. **No es un cambio de tamaño, ni un desplazamiento, ni una animación de llamada de atención** — el Brandbook §12 ya limita el motion a `transform`/`opacity`/`box-shadow`, y esto usa exactamente `box-shadow`.

La lámina 24 demuestra el par completo: normal (guardado, resuelto, 0 hallazgos, sin ningún control marcado) contra excepción (conflicto + no fiable + 2 hallazgos, con exactamente esos tres controles marcados y el resto —Deshacer, el aviso, Resolver— sin cambiar un píxel).

### 5.2 Presupuesto de chrome permanente — gobernanza, no una lista cerrada

**Regla:** ninguna función futura obtiene un control permanente en la Cinta o el Riel sólo porque exista. Debe justificar al menos una de estas tres cosas:

1. **Criticidad** — si falla en silencio, el usuario pierde trabajo o confía en un número equivocado (es el criterio que justificó el chip de persistencia y el de estado).
2. **Frecuencia** — se usa en la inmensa mayoría de sesiones (justificó Resolver, Deshacer/rehacer).
3. **Recuperación** — es la única puerta a salir de un estado roto (justificó el chip de persistencia en conflicto, el lanzador de Doctor).

**El presupuesto actual —después de las dos correcciones anteriores— son exactamente seis controles**: identidad, persistencia, deshacer/rehacer (cuenta como uno), Hoja de datos, Model Doctor, estado del análisis, Resolver+contexto. **Está cerrado por defecto.** Cualquier séptimo control debe pasar la prueba de arriba y, si la pasa, algo debe salir o degradarse primero — el gate de desbordamiento de `render-concepts.mjs` es la comprobación mecánica de que este presupuesto se respeta en Compact.

📐 `shots/24-atencion-normal-vs-excepcion.png`

---

## 6. Contexto nunca perdido

### 6.1 El formato

Ya existía de forma implícita (el «Centro analítico» recuperado en la corrección de discoverability). Se formaliza aquí con el helper `contextLine()`, usado ya en las láminas 22/22b/27:

> **{Objeto o alcance} · {Evidencia} · {Caso/combinación}**, con la vigencia comunicada por el chip de estado que siempre acompaña, y una acción de volver/localizar siempre presente.

| Ejemplo | Dónde aparece |
|---|---|
| `B-03 · Momento · Servicio 1` | Cabecera de `dense`, cuando hay selección — lámina 22 |
| `Vista global · Reacciones · Servicio 1` | Chip de estado expandido, sin selección — ya en la lámina `02b` |
| `Miembros · B-03 seleccionado` | Cabecera del Datasheet, cuando la fila viene de una selección del lienzo (patrón a aplicar en CRI-11, no se generó lámina nueva porque el patrón de Datasheet no cambió esta pasada — ver §9) |

**Regla de no repetición:** si el objeto ya aparece en el título de la superficie (p. ej. el glifo + ID del Detalle), la línea de contexto no lo repite dos veces con las mismas palabras — añade lo que falta (evidencia, caso), no reafirma lo que ya se ve.

---

## 7. Command Palette — contextual pero determinista

### 7.1 La regla de orden

**Ningún ranking por IA, ningún historial opaco de uso.** El orden es una función pura de la selección activa:

1. **Comandos válidos para la selección actual**, en el mismo orden en que aparecerían en el zócalo de esa selección (misma fuente de datos — no una segunda lista que mantener). Ejemplo con B-03 seleccionado: Sección, Material, Dividir, Carga, Corte, Localizar fila — en ese orden, porque es el orden del zócalo de Miembro.
2. **Comandos globales frecuentes** (Resolver, Deshacer, abrir Datasheet/Doctor).
3. **El resto**, agrupado por categoría (Herramientas, Evidencia, Acciones, Ajustes), alfabético dentro de cada grupo.

**El camino lento enseña el rápido:** cada fila muestra su atajo si existe (`kbd`), exactamente como ya especificaba §12 del documento base. Esto no cambia; se refuerza con la regla de orden explícita, que antes no estaba escrita como algoritmo determinista.

**Qué NO se hace:** no se reordena por frecuencia de uso de la persona (eso es exactamente el historial opaco que el enunciado prohíbe, y que además rompería el aprendizaje: un comando que hoy está arriba porque se usó mucho ayer confunde más de lo que ayuda). El orden es el mismo para todo el mundo con la misma selección.

---

## 8. Results supera el patrón tradicional — protecciones reafirmadas

Nada de esto es nuevo respecto al documento base; se reafirma explícitamente porque §1 de esta pasada toca la superficie más de cerca que ninguna otra corrección:

| Protección | Cómo se mantiene con las tarjetas recuperadas |
|---|---|
| N/V/M/deformada como **capas del modelo** | El overlay del lienzo sigue siendo independiente de `dense` — `dense` no lo sustituye, lo detalla (§1.2) |
| Color técnico semántico | Los mismos tokens (`--sc-color-technical-*`) gobiernan el tab, la curva y el borde de la tarjeta — un solo HEX por significado, sin excepciones nuevas |
| Fiabilidad separada del valor | `NumericQualityCard` sigue siendo un componente aparte del valor numérico — la tarjeta de máx/mín nunca incluye un juicio de fiabilidad dentro de su propio recuadro; la causa vive en su propia `.causa` |
| Procedencia | Tarjeta propia, sin fusionarse con la tarjeta de máx/mín |
| Fail-closed de `stale` | `dense` sigue condicionada a análisis vigente; nada de esta pasada le da una vía para mostrarse con `analysis === null` |
| `success ≠ reliable ≠ safe` | Ninguna tarjeta nueva usa la palabra «seguro», «aprobado» ni «cumple» — verificado al redactar cada caption |
| Sin rojo/verde de aprobado/reprobado | La curva usa el color técnico del rol (rojo para Momento, verde-azulado para Cortante, azul-cian para Axial, violeta para Deformada) — son roles, no un semáforo de dos colores |

---

## 9. Datasheet profesional — checklist de evaluación para CRI-11

**Esta pasada no rediseña el Datasheet.** Su especificación (documento base §10) ya lo trata como superficie seria y densa, con alcance visible y `peek`. Lo que se añade aquí es el checklist explícito que CRI-11 debe evaluar contra el prototipo, en el orden del enunciado:

| # | Punto a evaluar | Ya especificado en | Qué falta medir |
|---|---|---|---|
| 1 | Search/filter/sort | §10.3 del documento base | Que el rendimiento no degrade con facetas combinadas |
| 2 | Columnas importantes persistentes | No especificado antes de esta pasada | **Nuevo requisito de evaluación**: que la elección de columnas visibles sobreviva a cerrar y volver a abrir la hoja, por proyecto |
| 3 | Paste/review | DAT-06/DAT-07, sin cambios | Que el flujo revisar→aplicar siga siendo una sola transacción |
| 4 | Bulk edit | D-12, Detalle con cardinalidad múltiple | Que «mixto» siga siendo inequívoco a densidad alta |
| 5 | Selección fila ↔ objeto | DAT-04, bidireccional ya especificado | Latencia percibida con selecciones grandes |
| 6 | Mantener contexto al hacer `peek` | §10.2, ya especificado | Que el filtro y el desplazamiento sobrevivan de verdad, no sólo en la lámina |
| 7 | Teclado | Navegación de rejilla ya documentada como fortaleza (§18 #21) | Cobertura completa en el prototipo real, no sólo en el concepto |
| 8 | Compact sin convertir la tabla en cards simplificadas | §10.4, densidad de datos ≠ densidad de controles | Verificar que la implementación no ceda a la tentación de "una card por fila" en pantallas estrechas — el contrato lo prohíbe, la implementación debe cumplirlo |
| 9 | Virtualización/rendimiento | **No se decide aquí** | ABIERTA-7 del documento base ya lo declara como medición pendiente con 2.000 entidades — esta pasada no añade una solución de rendimiento sin medir, por instrucción explícita |

No se generó una lámina nueva de Datasheet porque su composición visual no cambió esta pasada — el cambio es el checklist de evaluación, que es prosa, no pixel.

---

## 10. Pruebas de discoverability para CRI-11

**«122/122 con puerta declarada» no equivale a «122/122 fácil de encontrar».** Esta frase, ya usada en la corrección de discoverability, se convierte aquí en protocolo. Ocho escenarios, cada uno sin instrucciones — a la persona se le da la tarea en lenguaje natural, nunca el camino:

| # | Escenario (instrucción dada a la persona) | Qué mide |
|---|---|---|
| 1 | «Cambia el sistema de unidades a metros e imperiales» | ¿Encuentra el menú de documento? ¿Primer control intentado? |
| 2 | «Abre un proyecto distinto al que tienes ahora» | ¿Encuentra «Cambiar de proyecto» o intenta volver a Inicio? |
| 3 | «Aplica una carga distribuida sobre la barra superior» | ¿Usa el Riel o busca en un menú? |
| 4 | «Cambia la sección de la barra B-03 a otra del catálogo» | ¿Usa el zócalo, el Detalle, o busca un menú contextual con clic derecho que no existe? |
| 5 | «Abre la hoja de datos del proyecto» | ¿Encuentra el icono de la Cinta o intenta la paleta primero? |
| 6 | «Encuentra la reacción máxima del modelo» | ¿Llega a `dense` desde el chip de estado o se pierde buscando un panel que ya no existe? |
| 7 | «¿Por qué este resultado dice "no fiable"?» | ¿Encuentra la causa enfocable, o intenta pasar el ratón sobre algo esperando un tooltip? |
| 8 | «Encuentra este objeto en el modelo desde la lista de resultados» | ¿Usa «Localizar», y vuelve a `dense` después con `peek`, o pierde el hilo? |

### 10.1 Protocolo de medición

- **Tiempo hasta el primer éxito**, medido desde que se lee la instrucción.
- **Primer control intentado** — nombre y superficie, para saber qué es lo primero que la mente de un usuario nuevo prueba.
- **Rutas equivocadas** — cuántas superficies distintas visita antes de acertar.
- **Abandono** — si la persona declara que no lo encuentra antes de un tope de tiempo (recomendado: 90 segundos por escenario).

**Muestra mínima recomendada:** suficiente para separar señal de ruido por escenario — no se prescribe un número aquí porque depende del método que CRI-11 elija (moderado vs. no moderado), y prescribirlo sin ese contexto sería una decisión de investigación que no le corresponde a esta especificación de diseño.

---

## 11. Gobernanza futura — el contrato de declaración

Toda función nueva, a partir de ahora, se declara con esta forma antes de poder entrar en el producto:

```
capability          → qué hace, en una frase
owner                → qué superficie es dueña del estado que toca
primary visible door → puerta de nivel 1 (Cinta, Riel o tarjeta Welcome) — o "ninguna" si no aplica
contextual door       → puerta que aparece con la selección/contexto relevante
power-user door       → paleta, atajo, o "ninguna" si no hace falta
Expanded              → cómo se presenta
Medium                → cómo se presenta
Compact                → cómo se presenta
```

**Regla dura:** si `primary visible door` y `contextual door` son ambas "ninguna", la función no puede entrar — sería depender sólo de la ruta rápida, que §3 prohíbe.

### 11.1 Dos ejemplos trabajados, con capacidades ya reales

**Ejemplo A — Model Doctor** (ya existe, se declara en retrospectiva para probar que el formato funciona):

```
capability          → diagnosticar el modelo antes de depender del análisis
owner                → superficie `doctor`, invocada
primary visible door → icono permanente en la Cinta, con badge de recuento
contextual door       → ninguna que le sea propia (el chip de estado señala hallazgos indirectamente)
power-user door       → Command Palette, comando "Abrir Model Doctor"
Expanded              → drawer lateral
Medium                → drawer lateral con `peek`
Compact                → hoja/fullscreen con `peek`
```

**Ejemplo B — Chip de persistencia** (añadido en la corrección de discoverability):

```
capability          → saber si el trabajo está guardado, y resolver un conflicto
owner                → Cinta (identidad del documento) + superficie `recovery` invocada
primary visible door → chip permanente en la Cinta
contextual door       → ninguna — es un hecho global sobre el documento, no depende de selección
power-user door       → ninguna — no tiene sentido un atajo para "ver si está guardado"
Expanded              → icono + copia de texto
Medium                → icono + copia de texto
Compact                → icono solo, copia sólo al expandir
```

**Lectura del segundo ejemplo:** `power-user door: ninguna` es una respuesta válida. La regla de §3 exige que la capacidad no dependa *sólo* de la ruta rápida — no exige que toda capacidad tenga las tres puertas. Persistencia no necesita un atajo de teclado; sí necesita las otras dos.

---

## 12. Ideas futuras — candidatos de investigación, no funcionalidad

Documentadas explícitamente como **fuera de las 122 capacidades de CRI-8** y **no implementadas de ninguna forma** en esta especificación. Ninguna aparece en un zócalo, una Cinta ni una lámina.

| Idea | Por qué se aparca | Qué necesitaría antes de proponerse |
|---|---|---|
| **Model Navigator** para modelos grandes | Ningún equivalente hoy en `src/**`; StructureCo con pórticos 2D pequeños/medianos no tiene evidencia de necesitarlo | Medición de tamaño real de proyectos en uso; CRI-8 §15.4 ya advirtió no copiar árboles densos de RFEM/ETABS sin esa evidencia |
| **Favoritos limitados de herramientas** | Cambiaría el Riel de estable a personalizable, en tensión directa con §4 de esta pasada | Evidencia de que el Riel fijo es realmente un cuello de botella, no una opinión de diseño |
| **Shortcuts personalizables** | Ningún mecanismo de remapeo de teclado existe hoy; coste de implementación no trivial (colisiones, i18n de teclado) | Decisión de producto explícita, fuera del alcance de una especificación de UX |
| **Preferencias de densidad** (fina, por superficie — distinta de la hipótesis Esencial/Completa de §2, que es un interruptor único de dos niveles) | Multiplicaría estados de presentación sin validar primero si dos niveles ya bastan | Resultado de la validación de §2 — si Esencial/Completa no basta, esto sería el siguiente experimento, no el primero |

**Ninguna de las cuatro se cuenta en el recuento de 122/122 capacidades con puerta declarada.** Si CRI-11 decide investigar alguna, empieza como una brainstorming nueva, no como una extensión silenciosa de esta especificación.

---

## Iconografía

Reafirmado, sin cambios de librería:

- **`lucide-react`** sigue siendo la única librería de iconos de interfaz — ya es dependencia del producto (`ToolBar.tsx` y el resto de `src/features/**` la usan). Esta pasada no añade ninguna.
- **Los glifos estructurales existentes** (`src/design-system/icons/structural.tsx` — `NodeGlyph`, `MemberGlyph`, `SupportGlyph`, `SplitMemberGlyph`, `SectionCutGlyph`, `DimensionGlyph`, `PointLoadGlyph`, `DistributedLoadGlyph`, `MomentLoadGlyph`, trazo 1.8 verificado) se reutilizan primero para cualquier símbolo de dominio. Ninguno de los conceptos de esta pasada necesitó un glifo nuevo — la curva de diagrama (`diagramCurve()`) es geometría generada, no un icono.
- **Ningún emoji** se usó en ninguna lámina ni en este documento como iconografía — los símbolos `✓`/`⚠` de la lámina 24 son texto tipográfico dentro de una etiqueta, al mismo nivel que las flechas `→` que ya usa el documento base en diagramas de flujo; no sustituyen a ningún icono de interfaz.
- El generador de conceptos (`ICON` en `parts.js`) sigue construyendo cada glifo con `stroke-width: 1.8`, coherente con `structural.tsx` — verificado de nuevo en esta pasada, sin cambios.

---

## Láminas nuevas

**8 láminas** (día), verificadas contra el gate de desbordamiento y contra dos bugs reales encontrados y corregidos durante esta pasada (ver «Qué se corrigió sobre la marcha» abajo).

| Lámina | Viewport | Demuestra |
|---|---|---|
| `22-results-dense-expanded` | 1440×900 | Tabs por familia + curva + tarjeta de máx/mín + procedencia + causa, Expanded |
| `22b-results-dense-compact` | 390×844 | Lo mismo, Compact fullscreen — familias envueltas, datos planos, sin cards decorativas |
| `23-nvm-deformada-continuidad` | 1440×900 | Overlay de Deformada sobre el lienzo (evidencia principal) + Detalle condensado + puerta a `dense` |
| `24-atencion-normal-vs-excepcion` | 1440×300 | Cinta silenciosa vs. Cinta en excepción — mismos controles, presencia distinta |
| `25-esencial-vs-completa` | 1440×340 | Misma tarea (B-03, cambiar sección), misma capacidad, dos presentaciones |
| `26-riel-estable-zocalo` | 1440×580 | Riel idéntico con dos selecciones distintas; sólo el zócalo cambia |
| `27-dense-peek-continuidad` | 1440×900 | `dense` → localizar → `peek` → volver, cerrando el bucle canvas↔tarjeta↔procedencia↔dense↔canvas |

**Total acumulado: 35 láminas** (31 día + 4 noche) en `reports/evidence/2026-08-15-cri-10-ux-system/shots/`.

### Qué se corrigió sobre la marcha, durante esta misma pasada

Dos errores reales, encontrados al revisar las láminas recién generadas, no dejados para una futura corrección:

1. **`.disclosure-more` no limitaba el tamaño de su icono** — el glifo de despliegue se renderizaba a tamaño nativo del `viewBox` (24×24 sin escalar), produciendo una flecha gigante que tapaba el texto en la lámina 25. Corregido con `svg { width:14px; height:14px }`, coherente con cómo se limita el tamaño de icono en cualquier otro botón del sistema.
2. **La lámina 23 no pasaba `layer: 'd'` al lienzo** — el chip de modo decía «δ · Deformada» pero el overlay deformado no se dibujaba, así que la lámina no demostraba lo que su caption afirmaba. Corregido pasando el parámetro que ya existía en `portico()`.

Ninguno de los dos afectaba a las 28 láminas anteriores — ambos eran código nuevo de esta pasada, encontrados por inspección visual antes de darlas por buenas.

---

## Archivos modificados por esta evolución

```
reports/2026-08-15-1230-cri-10-evolucion-tarjetas-velocidades.md   (este informe)
reports/evidence/2026-08-15-cri-10-ux-system/
  concepts/parts.js       +contextLine, +resultTabs, +diagramCurve, +maxMinCard,
                           +densityToggle, +ATTENTION_RING (familias/tabs verificados
                           contra ResultsPanel.tsx:29-48)
  concepts/concepts.css   +.ctxline, +.rtabs*, +.dcurve, +.mmcard*, +.denstoggle*,
                           +.attn-ring, +.compare*, +.rielmini*, +.disclosure-more
  concepts/frames.js      +8 láminas nuevas (22, 22b, 23, 24, 25, 26, 27)
  shots/*.png             35 láminas (31 día + 4 noche)
```

**Ningún archivo de producción tocado.** Sin cambios en `src/**` — sólo se leyó para verificar (`ResultsPanel.tsx`, `ElasticDemandCard.tsx`, `NumericQualityCard.tsx`, `ProvenanceCard.tsx`, `structural.tsx`). Sin merge, sin publicación en Pages.

## Cómo verificar

```bash
git diff --stat origin/main -- . | grep -v '^ reports/'
```

```bash
node reports/evidence/2026-08-15-cri-10-ux-system/canvas-budget-cri10.mjs
```

```bash
node reports/evidence/2026-08-15-cri-10-ux-system/render-concepts.mjs
```

El primero debe salir vacío. El segundo no se toca en esta pasada y sigue en verde (ninguna constante de Cinta/Riel/detalle cambió). El tercero sale con código 1 si la página lanza un error, si falta una lámina declarada, o si la Cinta desborda en Compact — verificado en verde con las 35 láminas y con el nuevo control de persistencia contando dentro del presupuesto de seis.

---

## Qué sigue siendo hipótesis para CRI-11

Nada de esta pasada se da por probado sólo por existir en una lámina — mismo estándar que las dos correcciones anteriores:

1. **Esencial vs. Completa** (§2) — hipótesis completa, protocolo de validación definido, nombre no decidido, no obligatoria en producción.
2. **Riel rotulado vs. iconos** (ABIERTA-1, heredada) — sigue sin medir; esta pasada sólo confirma que el contenido no depende de la selección, que es una afirmación distinta.
3. **Compact landscape de `dense`** — se argumentó por qué no cambia materialmente, pero no se midió contra el prototipo real.
4. **El presupuesto de chrome de seis controles en Compact con contenido real** (nombres largos, combinaciones largas, en los dos idiomas) — GAP-1 de la corrección de discoverability sigue abierto y ahora aplica también al chip de persistencia, que es parte del mismo presupuesto.
5. **Los ocho escenarios de discoverability de §10** — diseñados, no ejecutados. Ningún tiempo, ninguna tasa de abandono existe todavía.
6. **Overflow del zócalo en Compact apaisado con el desbordamiento (`⋯`) abierto** (ABIERTA-4/GAP-3, heredada) — sin cambios en esta pasada.

## Capacidades que se tuvieron que rechazar por no existir realmente

**Ninguna.** A diferencia de la corrección anterior (que retiró «Mover a otro objeto» y «Exportar selección» del contrato del zócalo por no existir en el código), esta pasada verificó cada afirmación de diseño contra `src/features/results/` **antes** de proponerla, así que no llegó a proponerse nada que luego hubiera que retirar. La única decisión de encaje —dónde vive el índice elástico— se resolvió leyendo el código (tarjeta dentro de Estado, no un tab) en vez de inventar una estructura y corregirla después.
