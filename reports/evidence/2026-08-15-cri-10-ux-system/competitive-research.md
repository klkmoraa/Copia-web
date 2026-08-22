# Investigación UX competitiva — StructureCo (canvas 2D + Inspector + Results + Datasheet + Model Doctor)

**Fecha:** 2026-08-15
**Alcance:** documentación oficial vigente de Shapr3D, Onshape, Autodesk Fusion, Dlubal RFEM 6, RISA-3D y SkyCiv Structural 3D, más referencias primarias (W3C, Apple, literatura HCI) para los cuatro problemas transversales.
**Naturaleza:** investigación. No se modificó ningún archivo del repositorio.

---

## 0. Método y honestidad sobre las fuentes

Dos caminos de recuperación, marcados en cada ficha y en la sección **Fuentes**:

- **[FETCH]** — descarga directa de la página del proveedor y lectura del contenido. Es la evidencia fuerte; las citas entrecomilladas provienen de aquí.
- **[SEARCH]** — el dominio bloqueó la descarga directa (403) y solo se pudo obtener el resumen del buscador sobre esa misma página oficial. Es evidencia débil: la URL canónica es correcta y el contenido es coherente, pero **no verifiqué el texto literal**.

Resumen del estado por proveedor:

| Proveedor | Dominio de ayuda | Descarga directa |
|---|---|---|
| Onshape | `cad.onshape.com/help` | **Sí** [FETCH] |
| Autodesk Fusion | `help.autodesk.com/cloudhelp` | **Sí** [FETCH] |
| Dlubal RFEM 6 | `dlubal.com/.../online-manuals/rfem-6` | **Sí** [FETCH] |
| RISA-3D | `help.risa.com/risahelp/risa3d` (redirige desde `risa.com`) | **Sí** [FETCH] — excepto `Application Interface (.NET).htm` que devolvió 403 |
| SkyCiv | `skyciv.com/docs` | **Sí** [FETCH] |
| Shapr3D | `support.shapr3d.com` | **No — 403 Forbidden** [SEARCH] en todo |
| Apple HIG | `developer.apple.com/design` | **Parcial** — la página se sirve como SPA y no entregó cuerpo de texto [SEARCH] |
| W3C WCAG 2.2 | `w3.org/WAI` | **Sí** [FETCH] |

**Lo que no pude verificar y no debe darse por cierto:**
- Ninguna cita literal de Shapr3D. Todo lo de Shapr3D es reconstrucción del buscador sobre páginas oficiales.
- Umbrales numéricos de Shapr3D (cuántas herramientas caben antes de `More`, cuántos niveles de recomendación) — **no documentados públicamente que yo haya podido ver**.
- Autodesk **no documenta un "Quick Access Toolbar" para el usuario final de Fusion**. La página oficial de interfaz llama a esa zona **Application Bar**. El término "QAT" aparece en la *API* de Fusion como el id de una barra con "todos los comandos relacionados con archivos". Los artículos de personalización de QAT que devuelve el buscador son de **Revit / Inventor / AutoCAD**, no de Fusion. No importar ese modelo como si fuera de Fusion.
- La página de *Selection* de Onshape **no describe explícitamente el ciclado bajo el cursor**; eso vive en la página separada *Select Other*.
- La página de *Tables* de RFEM 6 **no distingue explícitamente tablas de entrada vs. de resultados** ni dice cuándo aparecen las de resultados; esa señal viene del Navigator y del Control Panel.
- No encontré ninguna declaración de proveedor que diga *por qué* eligieron un panel reservado permanente vs. uno diferido. La evidencia sobre "aparece cuando hay resultados" es conductual y está documentada, pero la motivación no está escrita.

---

## 1. Shapr3D — interfaz adaptativa y acceso a herramientas

### Mecánica documentada (todo [SEARCH])

- Existe una funcionalidad de **interfaz de usuario adaptativa** que **recomienda herramientas a medida que se hacen selecciones**. Los menús resultantes están descritos como "menús a medida" que dan acceso a lo necesario **sin navegar por los menús por defecto**.
- El patrón de uso documentado es **preselección → herramienta**: se preselecciona geometría y luego se elige la herramienta entre las recomendadas. **La recomendación se refina con cada selección adicional** (no es un único salto; es incremental).
- Ejemplos concretos que da la documentación:
  - Seleccionar **dos caras de cuerpos distintos** → el menú adaptativo ofrece **Align** y **Replace Face**.
  - Seleccionar **un cuerpo** → **Move/Rotate** queda activo en el menú adaptativo, y el cuerpo puede moverse **con el gizmo sin tocar los menús**.
- **`More`**: desde el menú adaptativo, `More` da acceso a las **herramientas adicionales** — es decir, el catálogo completo detrás de la recomendación. No sustituye al menú adaptativo: es su desbordamiento.
- **Motivo declarado por el proveedor:** el argumento es de *velocidad de flujo*, no de estética — la documentación afirma que aprovechar la interfaz adaptativa puede acelerar el flujo de trabajo "dos o tres veces" y que permite **completar tareas sin interactuar con los menús**. No hay un argumento declarado de "reducir carga cognitiva" ni de presupuesto de canvas.
- Ortogonal pero relevante: en Preferencias se puede **cambiar la colocación de menús y herramientas a izquierda o derecha** de la pantalla, y hay una página separada de **Context menus**.

> Advertencia: ninguna de estas frases está verificada literalmente. Trátese como "lo que la documentación oficial parece decir", no como cita.

---

### Ficha S-1 — La selección es la consulta; el menú es la respuesta

- **principio** — El conjunto de acciones disponibles debe derivarse de lo que está seleccionado, y **refinarse incrementalmente** conforme la selección se vuelve más específica. La selección no es un estado pasivo: es la consulta que determina qué es ejecutable.
- **problema de StructureCo** — *Inspector no contextual*; *ToolRail/TopBar con mala jerarquía*; *acciones lejos del objeto*.
- **cómo podría aplicarse** — El Inspector deja de ser un formulario fijo por tipo y pasa a tener una **cabecera de acciones derivada de la selección actual**: nada seleccionado → herramientas de creación y de vista; un nodo → apoyo, carga puntual, fusionar/eliminar; dos nodos → crear barra entre ellos, medir distancia; una barra → sección, material, releases, carga distribuida; dos barras que comparten nodo → acciones sobre la conexión. Con selección múltiple heterogénea, solo la intersección de acciones válidas. El ToolRail deja de intentar ser el catálogo total y se queda con lo que es válido **sin** selección.
- **qué NO debemos copiar** — No copiar la promesa de "2–3× más rápido" ni convertirlo en objetivo de producto: es marketing del proveedor, no un resultado medido que StructureCo pueda reclamar. Tampoco copiar la *ocultación* del menú por defecto: en Shapr3D el usuario ya sabe que existe el catálogo; en StructureCo, si una acción desaparece porque la selección cambió, hay que dejar visible por qué no aplica. Y no adaptar el Inspector según *resultados* (p. ej. mostrar acciones distintas si un elemento "salió mal"): eso reintroduce semántica de veredicto por la puerta de atrás.

### Ficha S-2 — `More` como desbordamiento del contexto, no como cajón general

- **principio** — Un `More` legítimo es el **complemento exacto de lo que se está mostrando ahora**: contiene el resto de las herramientas de la misma familia y del mismo momento. Un `More` que mezcla familias distintas deja de ser desbordamiento y se convierte en un cajón de sastre, y entonces su coste de búsqueda es el de un menú principal mal hecho.
- **problema de StructureCo** — *El "More" de 19 entradas mezcla trabajo, análisis, preferencias, exportación y power-user*; *Model Doctor pierde su lanzador directo por debajo de 1024px*.
- **cómo podría aplicarse** — Partir las 19 entradas por **naturaleza de la acción**, no por frecuencia:
  1. **Actúan sobre el modelo** (crear, editar, limpiar, Model Doctor) → desbordamiento del ToolRail/Inspector, contextual a la selección.
  2. **Actúan sobre el análisis** (resolver, hipótesis, opciones de cálculo) → junto al disparador de análisis.
  3. **Actúan sobre el documento** (importar, exportar, guardar, compartir) → zona de documento, invariante.
  4. **Actúan sobre la aplicación** (preferencias, unidades, tema, atajos) → zona de aplicación, invariante.
  5. **Power-user / diagnóstico** (consola, dumps, flags) → sección explícitamente etiquetada como avanzada, al final, nunca mezclada.
  Model Doctor pertenece a (1) y por tanto **no debe caer nunca dentro del cajón por presión de ancho**: es una acción sobre el modelo y debe conservar lanzador propio en cualquier breakpoint, aunque sea reducido a icono.
- **qué NO debemos copiar** — No copiar un `More` cuyo contenido cambia por completo con la selección **sin dejar rastro**: en una herramienta de ingeniería, que una entrada de menú desaparezca sin explicación es indistinguible de que la función no exista. Y no copiar la preferencia "menús a izquierda o derecha" como si fuera accesibilidad: es una preferencia estética que multiplica estados a testear y no resuelve ninguno de los diez problemas listados.

---

## 2. Onshape — Precision Selector, Select Other, selección táctil

### Mecánica documentada

**Precision Selector** (móvil/táctil) [FETCH parcial + SEARCH]:
- Gesto: **tocar y mantener con un dedo en el área gráfica**. Aparece el selector de precisión. **Arrastrar** el dedo mueve el selector; **la cruz (crosshair) actúa como cursor**. Cuando la cruz coincide con la entidad deseada y esta se resalta, **levantar el dedo** confirma la selección.
- El objetivo se dibuja **desplazado respecto de la punta del dedo** ("displays a target selector offset from your finger tip").
- **Motivo declarado, textual en la doc de Selection:** *"Using a finger as a cursor often obstructs one's view and makes it difficult to make precise selections."* Y en la página de móvil: existe "para permitirte seleccionar cuidadosamente una entidad sin que tu dedo obstruya la vista". Los casos de uso citados son exactamente los de StructureCo: **una entidad de boceto pequeña, una arista para un fillet, una pieza para rotar**.
- **Stylus:** los gestos con lápiz son idénticos, **salvo el Precision Selector**: al usarlo con lápiz, **presionar más fuerte hace zoom temporal**. Force touch con dedo también hace zoom al aplicar presión.
- Existe patente de Onshape sobre "Touchscreen Precise Pointing Gesture" (US 2017/0336966) — es decir, el proveedor lo considera invención propia, no un patrón de dominio público.

**Select Other** (escritorio) [FETCH, con cita]:
- Propósito textual: *"Use Select other to select entities (sketch curves, part faces, etc) that you might not be able to see in the graphics area because they are obscured by other entities."*
- Invocación: clic derecho sobre la entidad → **Select Other**, o la tecla **acento grave (`)**. El atajo varía por distribución de teclado (`'` en UK, `@` en francés).
- Orden de la lista, textual: *"The Select other value list is populated with all faces and edges, working from the one already highlighted and into the part (farther away from your perspective)."* Es decir: **la lista está ordenada por profundidad desde el punto de vista actual, empezando por lo que ya está resaltado**.
- Ciclado: `` ` `` avanza, `Shift+``` retrocede, `Enter` confirma.
- **Motivo declarado:** evitar tener que **rotar el modelo** para alcanzar geometría oculta desde el ángulo actual.

**Selección general** [FETCH]:
- Modelo *toggle*: "Click to select, click again to deselect"; selección aditiva con contador en el cursor hasta "5+".
- **Box selection con semántica direccional:** de **izquierda a derecha** (contorno sólido) selecciona solo lo **contenido íntegramente**; de **derecha a izquierda** (contorno punteado) selecciona todo lo **tocado**.
- Limpiar selección: clic en vacío, **barra espaciadora**, o "Clear selections" en el menú contextual.
- El hover revela **puntos medios** de entidades de boceto y aristas, habilitando medir, crear plano o usar la geometría.

---

### Ficha O-1 — Desacoplar el punto de contacto del punto de selección

- **principio** — En entrada táctil o con lápiz, el punto que el usuario toca y el punto que el sistema selecciona **no tienen por qué coincidir**. Separarlos —con una cruz desplazada, visible y arrastrable— resuelve simultáneamente los dos fallos del dedo: **oclusión** (no ves lo que apuntas) y **ambigüedad** (no sabes qué parte del dedo cuenta). El compromiso se hace **al levantar**, no al tocar, lo que convierte todo el gesto en una fase de ajuste reversible.
- **problema de StructureCo** — *Objetivos pequeños/solapados en táctil*; secundariamente *acciones lejos del objeto* (porque un menú que aparece bajo el dedo también ocluye).
- **cómo podría aplicarse** — En el canvas 2D, `pointerdown` sostenido (~300–500 ms) sobre zona densa activa un **selector de precisión**: una cruz desplazada unos 40–60 px por encima del contacto, con *live highlight* del nodo/barra bajo la cruz y una etiqueta con su identificador (`N12`, `B7`). Mientras el gesto está activo, el resto del canvas se atenúa ligeramente y no se dispara pan. Al soltar, se confirma. Si se arrastra fuera del canvas o se cancela, no pasa nada. Esto es especialmente valioso en StructureCo porque la geometría 2D **concentra nodos coincidentes** (apoyos sobre nodos, cargas sobre nodos, extremos de barra sobre nodos) en el mismo píxel.
- **qué NO debemos copiar** — No copiar la dependencia de **presión** (force touch / "press harder to zoom"): la web no la expone de forma fiable ni portable, y hacer que una función dependa de hardware específico produce una función que existe solo para algunos usuarios — inaceptable en una herramienta *fail-closed*, donde "no pude seleccionarlo" no debe ser un estado silencioso. Tampoco copiar la idea de que esto es **exclusivo de móvil**: la oclusión con lápiz existe también en tablets grandes y en portátiles táctiles, que es justamente donde StructureCo se usará.

### Ficha O-2 — La profundidad bajo el cursor es una lista enumerable y ciclable

- **principio** — Cuando varias entidades comparten el mismo punto de pantalla, la respuesta correcta no es adivinar la de arriba ni obligar a mover la cámara: es **enumerar todo lo que está bajo el puntero en un orden determinista** (empezando por lo ya resaltado y alejándose del observador) y permitir **recorrer esa lista con un solo control**, con previsualización en el canvas de cada candidato.
- **problema de StructureCo** — *Objetivos pequeños/solapados en táctil* (y también con ratón); *Inspector no contextual* (porque hoy el Inspector recibe lo que el canvas adivinó, sin oportunidad de corregir).
- **cómo podría aplicarse** — Al hacer clic donde hay ≥2 candidatos (nodo + extremo de barra + apoyo + carga en el mismo punto), no elegir por z-order silenciosamente. Mostrar un **desambiguador**: lista corta, ordenada por un criterio explícito y estable (p. ej. nodo → apoyo → carga → barra, o por distancia real al punto de clic), con hover que resalta el candidato en el canvas, ciclable con una tecla (Tab o `) y con equivalente táctil (repetir tap en el mismo punto avanza al siguiente candidato). Clave: **el orden debe ser documentado y reproducible**, no dependiente del orden de creación.
- **qué NO debemos copiar** — No copiar el atajo `` ` ``: Onshape mismo documenta que se rompe en teclados UK y francés, y StructureCo se usa en teclados latinoamericanos y españoles donde esa tecla es aún peor. Elegir un atajo verificado en los layouts reales del usuario. Tampoco copiar la lista sin previsualización: una lista de identificadores sin resaltado en el canvas traslada el trabajo de desambiguación al usuario en lugar de resolverlo.

### Ficha O-3 — La dirección del gesto puede llevar semántica, si es la única semántica

- **principio** — Un mismo gesto puede codificar dos intenciones distintas mediante su **dirección**, siempre que la diferencia sea **visible durante el gesto** (contorno sólido vs. punteado) y no requiera memoria previa. Es una forma de duplicar el vocabulario sin añadir chrome.
- **problema de StructureCo** — *Presupuesto de canvas invertido en escritorio*; *chrome permanente demasiado pesado* (cada modificador que se codifica en el gesto es un botón que no hace falta).
- **cómo podría aplicarse** — Selección por caja en el canvas: izquierda→derecha selecciona solo elementos **completamente contenidos** (barras enteras); derecha→izquierda selecciona todo lo **tocado** (barras que cruzan la caja). Retroalimentación durante el arrastre: borde sólido vs. punteado y un contador vivo ("12 barras / 3 nodos"). Esto elimina la necesidad de un conmutador permanente "modo selección" en el TopBar.
- **qué NO debemos copiar** — No apilar más significados sobre la dirección (velocidad, número de dedos, duración) hasta que este esté asentado; los gestos que codifican tres o más intenciones se vuelven no descubribles y no enseñables, y en una herramienta de ingeniería una selección incorrecta silenciosa es un error de datos, no un inconveniente.

---

## 3. Autodesk Fusion — entornos contextuales, marking menu, barras invariantes

### Mecánica documentada [FETCH — citas verificadas]

La distinción central, textual en la página oficial de interfaz:

- **Contextual tab:** *"Some commands activate a contextual tab, like **Sketch**. The contextual tab displays on the **Toolbar** alongside the other tabs within the workspace, while the contextual tools are active."*
  → **Añade** a la UI existente. Lo demás sigue accesible.
- **Contextual environment:** *"Some commands activate a contextual environment, like **Form**. The contextual environment displays on the **Toolbar**, and its tabs **replace the default tabs** in the current workspace until you exit the contextual environment."*
  → **Reemplaza**. Y la doc especifica la condición de salida: *"until you exit"* — hay una frontera explícita de entrada y salida.

Esto responde exactamente a la pregunta planteada: **la regla documentada es "añade cuando la tarea es un episodio dentro del trabajo normal (Sketch); reemplaza cuando la tarea tiene su propio conjunto de herramientas incompatible con el resto (Form)"**, y en el caso de reemplazo hay un modo del que **hay que salir explícitamente**.

Otros componentes documentados:
- **Toolbar / Workspaces:** *"Each workspace is organized into tabs that contain logical groupings of related tools"*; *"The tools on the Toolbar differ in each workspace."*
- **Browser:** lista los objetos del ensamblaje y **controla su visibilidad**.
- **Marking menu:** *"Right-click the canvas to access the Marking Menu, which contains frequently used commands in the wheel and additional commands in the overflow menu."*
- **Navigation bar:** zoom, pan, orbit y ajustes de visualización.
- **Application bar:** Home, Data Panel, File, Save, Undo/Redo, pestañas de diseño, New Design, Assistant, Extensions, Job Status, Notification Center, Help, Profile. **La ayuda de usuario de Fusion no menciona un "Quick Access Toolbar"** (ver sección 0).

**Marking menu — referencia oficial** [FETCH]:
- Activación: clic derecho en cualquier punto del canvas; radial **alrededor del cursor**.
- Ejecución: *arrastrar el cursor en la dirección del comando y hacer clic en la cuña resaltada*. Cierre: clic en el centro, clic fuera, o Esc.
- **Primer nivel:** 8 comandos en el workspace Design (Repeat last command, PressPull, Redo, Hole, Sketch, Move/Copy, Undo, Delete).
- **Segundo nivel:** al pasar por el comando inferior, 8 comandos de boceto (Line, 2-Point Rectangle, Offset, Fit Point Spline, Project, Center Diameter Circle, Sketch Dimension, Finish Sketch).
- **Overflow (menú contextual debajo del radial):** controles de navegación (Pan, Zoom, Orbit), Isolate/Unisolate, conmutador de workspace y atajos guardados. Es decir: **el radial lleva los verbos frecuentes, el overflow lleva vista, aislamiento y navegación** — separación por naturaleza, no por frecuencia.
- **El contenido varía por:** workspace, pestaña de la Toolbar, entorno contextual, y **comando activo** (aparecen OK/Cancel cuando corresponde).
- **Gestos:** una vez memorizada la dirección, se puede ejecutar el comando **sin desplegar el menú** (arrastrar abajo-izquierda = Offset, abajo = Line).

---

### Ficha F-1 — Distinguir "añadir contexto" de "entrar en un modo"

- **principio** — Hay dos formas legítimas de UI contextual y **confundirlas es el error**. Si la tarea es un episodio dentro del trabajo normal, el contexto **se añade** y todo lo demás sigue disponible. Si la tarea tiene un vocabulario incompatible con el resto, el contexto **reemplaza** — pero entonces debe tener **entrada y salida explícitas y visibles**, porque el usuario ha entrado en un modo.
- **problema de StructureCo** — *Inspector no contextual*; *chrome permanente demasiado pesado*; *Datasheet obliga a cerrarse para enfocar un objeto*.
- **cómo podría aplicarse** — Clasificar cada actividad de StructureCo en uno de los dos:
  - **Añaden** (contextual tab): seleccionar un nodo, editar propiedades de barra, aplicar carga, inspeccionar un resultado. El canvas sigue vivo, el Inspector se especializa, nada se cierra.
  - **Reemplazan** (contextual environment): **Model Doctor** y **Datasheet**. Ambas tienen vocabulario propio (hallazgos y reparaciones; filas y columnas) y ambas merecen una frontera declarada — con un botón de salida siempre visible, tipo "Salir del Datasheet", y un estado que el usuario pueda nombrar. Hoy el Datasheet ya se comporta como entorno de reemplazo pero **sin admitirlo**: por eso "hay que cerrarlo para enfocar un objeto" se percibe como fallo en vez de como frontera. Dos salidas posibles: (a) declararlo entorno con salida explícita y con **retorno al objeto que estabas mirando**; o (b) degradarlo a "tab contextual" haciéndolo coexistir con el canvas (ver ficha R-2).
  - **Model Doctor**, por la misma lógica, es un entorno — y un entorno **no puede depender de un lanzador que desaparece a <1024px**. Un modo al que no puedes entrar en cierto ancho es un modo que no existe en ese ancho.
- **qué NO debemos copiar** — No copiar los **workspaces por fase** de Fusion (Design / Render / Simulation / Manufacture). Están descartados por restricción y además son el patrón equivocado aquí: StructureCo tiene *un* modelo y *un* análisis, y partirlo en fases obligaría al usuario a elegir un modo antes de saber qué necesita. La distinción útil de Fusion es la de *tab vs. environment*, no la de *workspace*.

### Ficha F-2 — Un mismo menú, dos velocidades: autorrevelador para el novato, gestual para el experto

- **principio** — Una superficie de comandos puede servir al novato y al experto **con la misma geometría**: el novato despliega y lee, el experto ejecuta la dirección de memoria sin desplegar. Lo que hace esto posible es que la **posición sea estable** y que el camino del novato *sea* el entrenamiento del experto (rehearsal). Corolario: el contenido puede variar con el contexto, pero **las posiciones dentro de cada contexto no**.
- **problema de StructureCo** — *Acciones lejos del objeto*; *presupuesto de canvas invertido en escritorio*; *chrome permanente demasiado pesado*.
- **cómo podría aplicarse** — Un menú contextual **en el punto de la selección** dentro del canvas, con un número pequeño y fijo de verbos por tipo de objeto (nodo: apoyo, carga, fusionar, eliminar; barra: sección, material, releases, carga, dividir, eliminar), y **posiciones fijas por tipo**. Táctil: pulsación larga sobre el objeto ya seleccionado. Esto ataca directamente "acciones lejos del objeto" y devuelve espacio al canvas, porque los verbos que hoy viven en chrome permanente pasan a invocarse donde está el trabajo.
- **qué NO debemos copiar** — No copiar el **radial de 8 sectores con jerarquía de segundo nivel** ni los gestos direccionales sin despliegue: son excelentes con ratón sobre pantalla grande y frágiles en táctil, y Autodesk mismo publica un artículo de soporte sobre el marking menu volviéndose **inusable en monitores de alta definición**. Empezar por un menú contextual **lineal, anclado al objeto, con posiciones estables**, y solo considerar geometría radial si hay evidencia. Tampoco copiar la mezcla del overflow de Fusion tal cual: la lección es *"radial = verbos, overflow = vista/navegación"*, no la lista concreta.

### Ficha F-3 — Lo invariante vive aparte de lo contextual

- **principio** — Los comandos que existen **siempre** (documento, deshacer, guardar, ayuda, estado del trabajo) deben ocupar una franja propia que **no cambia nunca**, precisamente para que todo lo demás pueda cambiar sin desorientar. La estabilidad de una zona es lo que financia la volatilidad de la otra. Fusion lo formaliza: Application bar (invariante) / Toolbar con tabs (por workspace) / contextual tab o environment (por comando) / marking menu (por todo lo anterior + comando activo).
- **problema de StructureCo** — *ToolRail/TopBar con mala jerarquía*; *cajón "More" de 19 entradas mezcladas*; *chrome permanente demasiado pesado*.
- **cómo podría aplicarse** — Definir explícitamente **cuatro niveles de volatilidad** y asignar cada control a exactamente uno:
  1. **Invariante de aplicación** — documento, guardar, deshacer/rehacer, unidades, preferencias, ayuda. Nunca cambia, nunca contextual, nunca dentro de `More`.
  2. **Por actividad** — modelar / analizar / documentar. Cambia poco.
  3. **Por selección** — Inspector y sus acciones. Cambia constantemente.
  4. **Por punto** — menú contextual en el canvas. Cambia con cada objeto.
  El síntoma actual (19 entradas mezcladas en un `More`) es exactamente lo que ocurre cuando estos cuatro niveles no están separados: el cajón se vuelve el vertedero de todo lo que no encontró nivel.
- **qué NO debemos copiar** — No copiar el **Quick Access Toolbar personalizable** de Revit/Inventor/AutoCAD (que además **no está documentado para el usuario final de Fusion**). Una barra que cada usuario reconfigura destruye la enseñabilidad, hace imposible el soporte ("dale al botón de arriba a la derecha" deja de significar algo) y desplaza el trabajo de diseño de jerarquía al usuario — que es precisamente el trabajo que StructureCo tiene pendiente.

---

## 4. Dlubal RFEM 6 — Navigator, tablas acoplables, Control Panel, Result Table Manager

### Mecánica documentada [FETCH — citas verificadas]

**Navigator:**
- Textual: *"At the bottom edge of the navigator, you will find **three tabs (four after calculation)**. Use the tabs to switch between the 'Data', 'Display', 'Views', and 'Results' navigators."*
  → **El navegador de Resultados no existe hasta que hay cálculo.** El coste estructural de la pestaña de resultados es **cero** antes de resolver.
- **Navigator – Data:** *"manages the model, load, and design data as well as the calculated results."*
- **Navigator – Display:** *"controls the graphical display of objects in the work window."*
- **Navigator – Views:** *"manages user-defined views as well as user-defined and automatically created visibilities of objects (partial views, groups)."*
- **Navigator – Results:** *"controls the results that are displayed in the graphic."* Sus entradas dependen de si se muestran resultados de análisis estructural o de diseño.
- Acoplamiento: se agarra por la barra de título para llevarlo al espacio de trabajo; *"To dock it, double-click the title bar or move the navigator to the window frame."*

Obsérvese la separación conceptual, que es lo transferible: **qué existe (Data) / cómo se dibuja (Display) / qué se ve (Views) / qué resultado se pinta encima (Results)**. Son cuatro preguntas distintas y RFEM se niega a mezclarlas en un solo panel.

**Tablas:**
- Navegación jerárquica: primero **categoría** en la barra de herramientas de la tabla, después **subcategoría** en la lista de la derecha, y entre tablas individuales **con pestañas**.
- **Sincronización tabla → gráfico, textual:** *"An object whose row is selected in the table is also selected in the work window."* Y esa sincronización es **conmutable** mediante botones dedicados.
- Acoplamiento igual que el navigator: arrastrar por la barra de título; doble clic o llevarlo al borde para volver a acoplar.
- **Código de color como semántica de estado del dato:** negro normal, **rojo** para errores o celdas referenciadas vacías, **azul** para objetos no usados, **morado** para objetos generados no editables, **gris** para objetos en capa bloqueada.
- La doc de Tables **no** distingue explícitamente tablas de entrada vs. resultados (limitación, ver sección 0).

**Control Panel (evaluación de resultados):**
- **Aparece automáticamente "cuando hay resultados disponibles en la ventana de trabajo"**; se conmuta desde el menú View o un botón.
- Tres pestañas:
  - **Colors** — escala de color con rangos de valor; por defecto **once colores** cubriendo los extremos a intervalos iguales; colores editables y valores asignables manualmente.
  - **Factors** — factores de escala de la representación gráfica, en un árbol por categoría de resultado; un **triángulo rojo** marca el campo del gráfico actual.
  - **Objects** — **qué objetos muestran resultados**: todos, la selección actual, selección por número, selecciones de objeto predefinidas, o ninguno. Incluye botón **"Select in Graphics"** para elegir directamente en la ventana de trabajo.
- **Coordinación clave documentada:** el filtro de objetos del panel **afecta a las tablas de resultados asociadas** — restringir la visualización a ciertas barras **filtra automáticamente las tablas correspondientes**.

**Result Table Manager:** se abre desde el menú Results; permite **definir qué filas y qué columnas de resultado se muestran**, y guardar esa configuración como un *"Current Table Set"* reutilizable en el modelo.

---

### Ficha D-1 — Las superficies de resultado no deben existir antes de que existan resultados

- **principio** — Un contenedor de resultados que ocupa espacio antes de que haya resultados es una promesa vacía: consume presupuesto de pantalla permanentemente para no informar de nada, y además **enseña al usuario a ignorarlo**. La regla transferible es que la superficie de resultados **aparece con el primer resultado y desaparece con su invalidación**, y que su aparición es en sí misma la señal de que hay algo que leer. RFEM lo hace explícito hasta en la aritmética de la documentación: *tres pestañas, cuatro tras el cálculo*.
- **problema de StructureCo** — *Results como panel reservado de 285px que existe antes de cualquier resultado*; *presupuesto de canvas invertido en escritorio*.
- **cómo podría aplicarse** — Eliminar la reserva fija. El panel de Resultados **no ocupa layout hasta que hay una corrida con salida**. Antes de resolver, esos 285px son canvas. Al resolver, el panel entra (con transición, no con salto) y el canvas se re-encuadra. **Y al invalidarse el modelo, el panel debe irse o marcarse como obsoleto de forma inequívoca**, no quedarse mostrando números de una geometría que ya no existe: eso es exactamente el modo de fallo que la semántica *fail-closed* de StructureCo debe prevenir. Aquí StructureCo puede ser **más estricto que RFEM**: RFEM condiciona la aparición al cálculo; StructureCo debe condicionarla al cálculo **vigente**.
- **qué NO debemos copiar** — No copiar el **gestor de ventanas acoplables/flotantes** (restricción explícita). Y no copiar la escala de once colores por defecto como si fuera neutral: un degradado rojo-verde sobre un modelo estructural **se lee como aprobado/reprobado** aunque solo represente magnitud. StructureCo, que no hace verificación normativa, debe usar rampas **secuenciales monocromáticas o divergentes por signo** (tracción/compresión), nunca semáforo, y etiquetar siempre la magnitud con unidades.

### Ficha D-2 — Separar "qué existe" de "cómo se dibuja" de "qué se ve" de "qué resultado se superpone"

- **principio** — Son cuatro preguntas ortogonales y un solo panel que las mezcla obliga al usuario a razonar sobre las cuatro cada vez que quiere responder una. Separarlas permite que **el estado de visualización sobreviva a los cambios de datos** y viceversa: apagar la visibilidad de un grupo no borra nada, y cambiar el resultado mostrado no toca la visibilidad.
- **problema de StructureCo** — *Inspector no contextual*; *chrome permanente demasiado pesado*; *cajón "More" mezclado*.
- **cómo podría aplicarse** — Auditar el Inspector y el `More` con estas cuatro preguntas como rejilla y reubicar cada control:
  - *¿existe?* → estructura del modelo (nodos, barras, apoyos, cargas) → Inspector / Datasheet.
  - *¿cómo se dibuja?* → etiquetas, numeración, grosor, escala de diagramas → controles de visualización, agrupados, **no** en `More`.
  - *¿qué se ve?* → visibilidad, aislamiento, vistas parciales guardadas → filtro de vista.
  - *¿qué resultado se superpone?* → tipo de esfuerzo, hipótesis, deformada → panel de Resultados, y **solo cuando existe**.
  Con esto, "escala de diagramas" deja de compartir cajón con "exportar" y "preferencias".
- **qué NO debemos copiar** — No copiar el **árbol de cuatro navegadores** como estructura de UI: RFEM tiene decenas de tipos de objeto y familias de diseño; StructureCo con pórticos 2D no los necesita y cuatro árboles serían más chrome, justo lo contrario del objetivo. Copiar la **taxonomía**, no los cuatro paneles.

### Ficha D-3 — El filtro es uno solo y gobierna a la vez el gráfico y la tabla

- **principio** — Cuando el usuario acota su atención ("solo estas barras"), esa acotación debe propagarse a **todas** las representaciones simultáneamente. Si el gráfico muestra tres barras y la tabla sigue mostrando doscientas filas, el usuario tiene dos verdades y debe conciliarlas a mano — y en ingeniería, conciliar a mano es donde aparecen los errores. RFEM documenta exactamente esto: restringir los objetos en el Control Panel **filtra automáticamente las tablas de resultados asociadas**.
- **problema de StructureCo** — *Datasheet obliga a cerrarse para enfocar un objeto*; *Results como panel reservado*; *acciones lejos del objeto*.
- **cómo podría aplicarse** — Un **único estado de selección/alcance** compartido por canvas, Inspector, Datasheet y Resultados. Seleccionar tres barras en el canvas filtra el Datasheet a esas tres filas y los resultados a esos tres elementos; seleccionar tres filas en el Datasheet las resalta y encuadra en el canvas. Con un **botón explícito de "quitar filtro"** siempre visible y un contador ("mostrando 3 de 214") — porque un filtro invisible es peor que ningún filtro, sobre todo en un sistema *fail-closed* donde "no aparece" nunca debe poder confundirse con "no existe".
- **qué NO debemos copiar** — No copiar que la sincronización sea **conmutable con botones dedicados** sin más. Un interruptor global de "sincronizar sí/no" crea un estado oculto que explica errores difíciles de diagnosticar ("¿por qué la tabla no se mueve?"). Si hace falta desacoplar, que sea una acción explícita y visible sobre una vista concreta ("fijar esta tabla"), con indicador permanente de que está fijada.

### Ficha D-4 — Que el usuario defina qué columnas son su evidencia

- **principio** — En trabajo técnico, **qué columnas mira cada persona es parte de su método**, no una preferencia cosmética. Permitir definir y guardar conjuntos de filas/columnas convierte la tabla en el instrumento de esa persona. La forma correcta es un **conjunto nombrado y reutilizable**, no un estado invisible que se olvida.
- **problema de StructureCo** — *Datasheet obliga a cerrarse para enfocar un objeto*; *cajón "More" mezclado* (los controles de tabla suelen acabar ahí).
- **cómo podría aplicarse** — El Datasheet y la tabla de Resultados aceptan **conjuntos de columnas guardados y nombrados** ("revisión de secciones", "chequeo de cargas", "reacciones"), conmutables desde la propia tabla — nunca desde `More`. Por defecto, un conjunto mínimo honesto; el resto disponible pero no impuesto.
- **qué NO debemos copiar** — No copiar la existencia de columnas de **diseño/verificación normativa** ni ratios de aprovechamiento: RFEM las tiene porque hace diseño normativo y **StructureCo no lo hace**. Ninguna columna del Datasheet puede llamarse "ratio", "utilización", "check" ni nada que un lector interprete como veredicto. Las columnas de StructureCo son magnitudes con unidades y, cuando corresponda, **estado de confiabilidad del cálculo** — que es una afirmación sobre el cálculo, no sobre la estructura.

---

## 5. RISA-3D — vista de modelo ↔ hojas de cálculo

### Mecánica documentada [FETCH — citas verificadas, salvo `Application Interface (.NET).htm` que dio 403]

- **Sincronización bidireccional, textual:** *"The spreadsheets and model views are synchronized. As you edit a model graphically the spreadsheets are automatically updated. As you make changes in the spreadsheets the model views reflect these changes immediately."*
  → Nótese: **inmediata en ambas direcciones**, sin paso de confirmación.
- **Explorer panel:** *"an affixed panel on the right side of the program interface"* que contiene *"a list of all the **Data Entry** spreadsheets"*. Y — clave — **las hojas de Resultados se muestran "when a solution is present"**. Es decir, el panel es el mismo, pero **crece una sección nueva solo cuando existe una solución**. Con soluciones "Batch with Envelope" puede haber dos conjuntos de resultados, conmutables con el selector Env/Batch. El panel se ensancha arrastrando su borde izquierdo y las secciones colapsan con carets.
- **Acceso a resultados:** desde el Explorer o desde los iconos de resultado (Envelope, LC, Dynamic) del ribbon **Results** — que también solo tiene sentido tras resolver.
- **Enlace tabla → canvas, con acción explícita:** se resaltan filas en una hoja de resultados y con el icono **Select** *"only those elements highlighted will be selected graphically"*. Existe la inversa (Unselect).
- **Justificación documentada del ordenamiento:** las hojas de resultados permiten *"sort the results in order to find maximums and exclude data that is not important"* — es decir, **la tabla es el instrumento para localizar extremos**, y el canvas es donde se mira lo localizado.
- **Barras dependientes de la ventana activa** [SEARCH, la página dio 403]: la **Window Toolbar** es la segunda barra horizontal bajo el menú principal y *"gets its name because the buttons change as you move from window to window"*. La ventana activa se identifica visualmente (barra de título coloreada / barra morada resaltada).

---

### Ficha R-1 — La superficie de resultados nace de la existencia de una solución, no del layout

- **principio** — El mismo contenedor puede servir a entrada y a resultados si la sección de resultados **solo aparece cuando hay solución**. Esto evita duplicar chrome y hace que la aparición de la sección sea, en sí misma, la notificación de que hay algo nuevo. La segunda confirmación independiente de la ficha D-1 — dos proveedores distintos, la misma regla.
- **problema de StructureCo** — *Results como panel reservado de 285px que existe antes de cualquier resultado*; *presupuesto de canvas invertido*.
- **cómo podría aplicarse** — En vez de un panel de Resultados separado y permanente, considerar que el **Inspector/Datasheet gane una sección "Resultados" cuando exista una corrida vigente**, con el mismo tratamiento visual que las secciones de entrada. Ventajas para StructureCo: elimina la reserva de 285px, elimina la competencia entre dos paneles por el mismo borde, y da un lugar natural para el **estado de confiabilidad** del cálculo junto a los números — no como badge suelto, sino como encabezado de la sección que contiene la evidencia.
- **qué NO debemos copiar** — No copiar la idea de **múltiples conjuntos de resultados simultáneos** conmutables (Env/Batch): multiplica los estados en que el usuario puede estar mirando números que no corresponden a lo que cree. Si StructureCo llega a tener varias hipótesis, la identidad de la hipótesis mostrada debe ser **permanentemente visible en el canvas**, no un selector escondido en una barra.

### Ficha R-2 — Tabla y canvas son dos vistas del mismo objeto, no dos aplicaciones

- **principio** — Editar en la tabla y editar en el lienzo deben ser **la misma operación sobre el mismo dato**, con el resultado visible inmediatamente en la otra vista. Cuando una vista tiene que cerrarse para usar la otra, deja de ser una vista y se convierte en un modo — y el usuario paga el coste de reconstruir mentalmente dónde estaba.
- **problema de StructureCo** — *El Datasheet debe cerrarse para enfocar un objeto* (mapeo directo y principal); *acciones lejos del objeto*.
- **cómo podría aplicarse** — El Datasheet deja de ser pantalla completa excluyente y pasa a **coexistir** con el canvas: hoja abajo o al lado, redimensionable y colapsable, con **enfoque compartido**. Seleccionar una fila resalta y encuadra el objeto en el canvas; seleccionar en el canvas desplaza la tabla a esa fila. Si por presupuesto de ancho el Datasheet debe seguir siendo excluyente en pantallas pequeñas, entonces debe **conservar el objeto enfocado al cerrarse y devolver al usuario exactamente ahí** — el coste no es tener un modo, es perder el sitio.
- **qué NO debemos copiar** — No copiar la propagación **inmediata sin confirmación en la dirección tabla → modelo**. RISA aplica los cambios de la hoja al modelo al instante; en un editor web con pegado masivo desde Excel, eso es una vía rápida a corrupción silenciosa. SkyCiv toma la decisión contraria (ver S-2) y para StructureCo es la correcta: **la selección y el enfoque se sincronizan al instante; las ediciones masivas pasan por un `Apply` con previsualización de cuántas filas cambian y qué se invalida**. Esto es coherente con *fail-closed*: si una edición invalida la corrida vigente, hay que decirlo **antes** de aplicarla.

### Ficha R-3 — Localizar en la tabla, mirar en el canvas: un puente explícito

- **principio** — Las dos vistas tienen fuerzas distintas y complementarias: la tabla **ordena y encuentra extremos**; el canvas **muestra dónde está** y qué tiene alrededor. El puente entre ambas debe ser **una acción nombrada y explícita** ("seleccionar en el modelo lo que está resaltado aquí"), no un efecto lateral difuso, porque el usuario debe poder decidir cuándo transferir el foco.
- **problema de StructureCo** — *Results como panel reservado*; *el Datasheet debe cerrarse para enfocar*; *acciones lejos del objeto*.
- **cómo podría aplicarse** — En la tabla de resultados: ordenar por magnitud, seleccionar las N filas superiores, y una acción **"Ver en el modelo"** que las selecciona, las encuadra y atenúa el resto. Y la inversa desde el canvas: **"Ver en la tabla"**. Esto convierte los resultados en **evidencia navegable ligada a la geometría** en lugar de un tablero de tarjetas — que es exactamente el objetivo declarado.
- **qué NO debemos copiar** — No copiar el vocabulario de RISA para lo encontrado. "Encontrar máximos" es legítimo y transferible; cualquier etiqueta que sugiera que el máximo **es un problema** no lo es. StructureCo muestra "momento máximo: 42.3 kN·m en B7", nunca "elemento crítico" ni "peor caso" — el juicio lo hace el ingeniero, no la interfaz.

### Ficha R-4 — Las barras siguen a la ventana activa

- **principio** — Cuando existen superficies de trabajo distintas, los controles deben seguir a **la que tiene el foco**, y **cuál tiene el foco debe ser visualmente evidente** (RISA lo marca con la barra de título coloreada). Sin ese indicador, una barra que cambia sola se percibe como inestabilidad, no como contexto.
- **problema de StructureCo** — *ToolRail/TopBar con mala jerarquía*; *chrome permanente demasiado pesado*.
- **cómo podría aplicarse** — Si Datasheet y canvas coexisten (ficha R-2), los controles secundarios de la TopBar deben reflejar cuál tiene el foco (herramientas de dibujo/selección con el canvas enfocado; ordenar/filtrar/columnas/pegar con el Datasheet enfocado), **con un indicador de foco inequívoco** en el borde de la superficie activa. El nivel invariante (ficha F-3) no cambia nunca.
- **qué NO debemos copiar** — No copiar el modelo MDI de ventanas embaldosadas ni el menú de *tilings*: es gestión de ventanas acoplables, explícitamente descartada, y en web produce un modelo de foco que el usuario no puede predecir.

---

## 6. SkyCiv Structural 3D — tres puertas al mismo modelo, Repair Model, resultados sobre el modelo

### Mecánica documentada [FETCH — citas verificadas]

**Datasheets:**
- Dos vías de apertura: `Edit > Datasheet Entry` en la barra de navegación, **o el icono de datasheet en la esquina superior derecha del propio formulario de entrada**. Esta segunda es la interesante: **el formulario ofrece la puerta a la tabla desde dentro de sí mismo** — no son dos rutas paralelas en un menú, sino una escalera desde "un objeto" hacia "muchos objetos".
- Descripción funcional: *"provide an alternative way to enter information from the forms"*; una fila por entrada, una columna por campo; permite ver y editar muchos componentes a la vez.
- Se comporta "como una hoja de Excel": copiar/pegar desde Excel u otras hojas, arrastrar la esquina inferior derecha de una celda para replicar.
- **Confirmación explícita, textual:** *"Changes will not be submitted until the user hits 'Apply'."* → **no hay sincronización en vivo desde la tabla.**
- Límite documentado: *"A blank or incomplete row will be ignored by the program."*
- Disponible para la mayoría de menús de S3D.

**Repair Model** (el análogo directo del Model Doctor):
- Invocación manual en cualquier momento vía `Tools → Repair Model`. **Además, algunas correcciones críticas y comprobaciones de advertencia se ejecutan automáticamente al pulsar Solve** — pero la ejecución manual es la que **da visibilidad de los cambios**.
- **Severidad en tres niveles declarados:** *Critical* (debe corregirse antes de resolver), *Warning* (puede producir resultados inesperados), *Suggested* (limpieza opcional).
- **Al ejecutarlo manualmente aparece una consola a la izquierda** con los problemas encontrados. El usuario **controla con casillas qué correcciones se aplican**; las críticas **no pueden desmarcarse**.
- **Botón Preview que resalta en el canvas los componentes problemáticos.** Este es el detalle más valioso del proveedor: el hallazgo no es texto, es **geometría señalada**.
- **Enumeración completa de comprobaciones** (esto importa: el proveedor publica la lista, no dice "repara tu modelo"):
  - *Critical*: nodos sin uso eliminados; barras duplicadas; placas duplicadas; apoyos duplicados; barras de longitud cero; placas de área cero; liberación de torsión aplicada.
  - *Warning*: asignaciones de sección faltantes; placas sin mallar; elevaciones de carga de viento en columnas reordenadas; valores de entrada inusuales; nodos cercanos fusionados; nodos intersecantes que dividen barras; barras solapadas fusionadas.
  - *Suggested*: secciones sin uso eliminadas; materiales sin uso eliminados.
  - Otras fuentes oficiales (API) mencionan además: detección de nodos flotantes/desconectados, detección de barras extremadamente esbeltas *"used to detect unit issues"*, fusión de nodos cercanos **con tolerancia dependiente del sistema de unidades**, y barras con mismo nodo inicial y final.
- **Límite honesto:** la documentación **no enumera tolerancias numéricas concretas**. Sabe decir *qué* comprueba, no *con qué umbral*.

**Resultados sobre el modelo:**
- Los diagramas de esfuerzos internos se **superponen directamente sobre el modelo estructural**; el tipo se elige en el menú de navegación izquierdo con desplegables por dirección ("Shear Force in Local Y direction").
- **Aislamiento por clic:** al hacer clic en una barra individual, **se muestra su diagrama y se ocultan los demás**. Se restauran reseleccionando el tipo de resultado en el menú. Con Ctrl + clic-arrastrar se muestra un grupo de barras.
- **Hover sobre el diagrama resalta los puntos de evaluación** a lo largo de la barra.
- Las **etiquetas de fuerza se pueden arrastrar y reposicionar** para que no se estorben.
- La escala del diagrama se ajusta con `S` + scroll.
- Todo en **sistema de coordenadas local** de la barra, declarado explícitamente.

---

### Ficha S-1 — La escalera formulario → tabla, ofrecida desde el propio formulario

- **principio** — La entrada individual y la entrada masiva son **el mismo modelo a dos escalas**, y la transición debe ofrecerse **desde donde el usuario está**, no desde un menú lejano. Cuando el usuario está editando el tercer nodo a mano, ese es el momento exacto en que necesita saber que existe la tabla — y el sitio correcto para decírselo es el formulario que tiene delante.
- **problema de StructureCo** — *El Datasheet debe cerrarse para enfocar un objeto*; *acciones lejos del objeto*; *cajón "More" mezclado* (si la puerta al Datasheet vive ahí, está mal ubicada).
- **cómo podría aplicarse** — Cada sección del Inspector lleva una affordance discreta **"ver como tabla"** que abre el Datasheet **filtrado a ese tipo y con la fila del objeto actual enfocada**. Y el camino inverso: en el Datasheet, cada fila ofrece "abrir en el Inspector". Con esto las tres puertas (canvas, Inspector, Datasheet) dejan de ser tres aplicaciones y pasan a ser tres zooms sobre lo mismo, cada una con una salida hacia las otras dos que preserva el objeto enfocado.
- **qué NO debemos copiar** — No copiar la disponibilidad de datasheet **"para la mayoría de los menús"** de forma indiscriminada: una tabla para cada cosa produce N tablas inconsistentes. StructureCo debería tener **un Datasheet con pestañas por tipo**, con comportamiento idéntico en todas. Tampoco copiar el pegado desde Excel sin validación por celda: pegar una columna con separador decimal distinto o unidades implícitas es un mecanismo de corrupción masiva y silenciosa.

### Ficha S-2 — La tabla propone; `Apply` dispone

- **principio** — Sincronizar la **selección/enfoque** al instante y **diferir la escritura masiva** tras una confirmación explícita. Son dos cosas distintas que suelen confundirse bajo la palabra "sincronización": mirar lo mismo debe ser inmediato; cambiar muchas cosas a la vez no. RISA elige inmediato para ambas, SkyCiv elige diferido para la escritura; para un editor web con pegado desde Excel, la segunda es defendible.
- **problema de StructureCo** — *El Datasheet debe cerrarse para enfocar un objeto*; *Results como panel reservado* (porque una edición aplicada debe poder invalidar resultados de forma visible).
- **cómo podría aplicarse** — El Datasheet marca las celdas modificadas y mantiene un `Apply` con un resumen honesto antes de escribir: *"38 filas modificadas · 2 filas incompletas se ignorarán · esto invalida la corrida vigente"*. Ese último punto es el que StructureCo debe añadir por encima de SkyCiv: la relación entre editar y **perder la vigencia del resultado** debe ser explícita en el momento de aplicar, no descubrirse después. Y las filas incompletas deben **listarse**, no ignorarse en silencio.
- **qué NO debemos copiar** — No copiar *"A blank or incomplete row will be ignored by the program"* como comportamiento silencioso. Ignorar en silencio es lo contrario de *fail-closed*: el usuario cree que introdujo 40 barras y tiene 38, sin ninguna señal. StructureCo debe **enumerar lo ignorado y por qué**, y dejarlo visible hasta que se resuelva o se descarte explícitamente.

### Ficha S-3 — Un diagnóstico que enumera lo que comprueba, gradúa severidad y señala en la geometría

- **principio** — Un diagnóstico de modelo es creíble en la medida en que (a) **publica la lista de lo que comprueba** — y por tanto delimita lo que **no** comprueba; (b) **gradúa la severidad** en niveles con consecuencias distintas; (c) **señala el hallazgo en la geometría**, no solo en texto; y (d) **deja al usuario decidir** qué se aplica, salvo lo que impide continuar. Es el patrón correcto para el Model Doctor de StructureCo.
- **problema de StructureCo** — *Model Doctor pierde su lanzador directo por debajo de 1024px* (mapeo directo); *Inspector no contextual*; *acciones lejos del objeto*.
- **cómo podría aplicarse** — Model Doctor como **entorno contextual declarado** (ficha F-1) con **lanzador propio en todos los breakpoints** — a <1024px puede reducirse a icono, pero **nunca caer dentro del cajón `More`**, porque un diagnóstico al que hay que llegar por un menú de 19 entradas no se ejecuta. Dentro: lista de hallazgos con severidad, cada hallazgo con **botón de localizar que resalta y encuadra la geometría implicada**, casillas por corrección, y — la parte que StructureCo debe añadir sobre SkyCiv — un **manifiesto visible de qué se comprobó y qué no**, con los umbrales numéricos y su dependencia de unidades. StructureCo puede ser aquí estrictamente mejor: SkyCiv enumera las comprobaciones pero **no publica las tolerancias**.
- **qué NO debemos copiar** — Tres cosas. (1) **La reparación automática silenciosa al pulsar Solve**: que "algunas correcciones críticas y advertencias se ejecuten automáticamente" significa que el modelo que se analizó **no es el que el usuario dibujó**, y él no lo sabe. Si StructureCo repara algo, debe declararlo, ser reversible y quedar registrado — y la restricción del proyecto lo confirma: nada de auto-reparación que no enumere sus límites. (2) **Casillas que no se pueden desmarcar sin explicar la consecuencia**: si algo es obligatorio, debe decir *por qué el solver no puede continuar*, no solo estar deshabilitado. (3) El nombre. "Repair"/"Reparar" promete que el modelo queda **bien**; un modelo sin nodos flotantes sigue pudiendo estar mal planteado. Vocabulario de *hallazgo*, *revisión* y *limpieza* — nunca de reparación completada ni de aptitud.

### Ficha S-4 — El resultado se dibuja sobre la geometría que lo produjo, y se aísla por clic

- **principio** — La forma más fuerte de ligar resultado y modelo es **dibujar el resultado sobre el objeto**: el diagrama vive en la barra, en su sistema local, y **al hacer clic en una barra solo queda su diagrama**. El aislamiento por clic convierte el canvas saturado en una lectura de un solo elemento **sin cambiar de panel ni de modo**, y el hover que marca los puntos de evaluación hace visible **de dónde salen los números** — es decir, el resultado se presenta como evidencia trazable y no como un dato dado.
- **problema de StructureCo** — *Results como panel reservado de 285px que existe antes de cualquier resultado* (mapeo directo); *acciones lejos del objeto*; *presupuesto de canvas invertido*.
- **cómo podría aplicarse** — Sustituir la lógica de "panel de resultados" por **resultado sobre el objeto**: los diagramas se dibujan sobre las barras; clic en una barra aísla su diagrama y **el Inspector muestra los valores de esa barra** (V, M, N, deformada, con unidades y sistema local declarado); hover a lo largo de la barra muestra la ordenada en esa abscisa. El panel de Resultados, si sobrevive, se reduce a **selector de qué magnitud se superpone y de la escala**, y aparece solo con corrida vigente (fichas D-1 / R-1). Añadir lo que SkyCiv no tiene: junto a los números, el **estado de confiabilidad de esa corrida** — `success ≠ reliable ≠ safe` — y su causa localizada. El estado se refiere al cálculo, nunca a la estructura.
- **qué NO debemos copiar** — No copiar el **atajo oculto de escala** (`S` + scroll) como única vía: un control esencial que solo existe como atajo no documentado en la UI es un control que la mayoría no tiene. Que exista el atajo, pero con control visible. Y no copiar la **navegación de resultados por menú lateral con desplegables por dirección**: eso es precisamente el "panel que existe antes que el resultado". La elección de magnitud debe estar donde está el resultado, no en un árbol permanente.

---

## 7. Mejores referencias para los cuatro problemas transversales

Para tres de los cuatro problemas encontré referencias **más fuertes** que las de los proveedores CAD, porque son normativas o son la investigación original que los proveedores implementan.

### Ficha X-1 — Callout de oclusión con compromiso al soltar (Vogel & Baudisch, *Shift*, CHI 2007) [SEARCH]

- **principio** — El problema del dedo tiene **dos causas separables**: la **oclusión** (el dedo tapa el objetivo) y la **ambigüedad del punto de selección** (qué parte del dedo cuenta). *Shift* las resuelve juntas: al tocar, se crea un **callout con una copia de la zona ocluida**, colocado en una zona no ocluida, con un **puntero que representa el punto de selección real**; el usuario guía el puntero moviendo el dedo sobre la superficie y **confirma al levantar**. Esto es la fuente académica de la que desciende el Precision Selector de Onshape, y es más general: **el callout se invoca solo cuando hace falta**.
- **problema de StructureCo** — *Objetivos pequeños/solapados en táctil*.
- **cómo podría aplicarse** — Es la referencia canónica para diseñar el selector de precisión de la ficha O-1, con dos mejoras sobre la versión de Onshape: (a) **escalado del contenido** dentro del callout, no solo copia 1:1 — en un pórtico con nodos a 3 px, copiar sin ampliar no resuelve nada; (b) **invocación condicional** — mostrar el callout solo cuando hay ambigüedad real bajo el contacto (≥2 candidatos dentro del radio del dedo), de modo que el 90 % de los toques sigan siendo instantáneos y el mecanismo aparezca exactamente cuando el usuario lo necesita.
- **qué NO debemos copiar** — No copiar la geometría fija del callout (posición y offset constantes): cerca de los bordes del canvas tapa lo que quiere mostrar. La posición debe calcularse contra los límites del viewport y contra la densidad local de geometría.

### Ficha X-2 — WCAG 2.2 SC 2.5.8 *Target Size (Minimum)* — tamaño **o** separación [FETCH, normativo]

- **principio** — El requisito normativo es **24 × 24 píxeles CSS** para objetivos de entrada por puntero, con una alternativa explícita: si el objetivo es menor, cumple igualmente cuando *"un círculo de 24 px CSS de diámetro centrado en el bounding box de cada uno no interseca con otro objetivo"*. La lección de diseño es que **hay dos palancas, no una**: agrandar el objetivo, **o** garantizar separación. Motivación documentada: usuarios con limitaciones de destreza, temblor o espasticidad *"find it difficult to accurately activate small targets when there are other targets that are too close"* — nótese que el problema declarado no es el tamaño solo, sino el tamaño **en presencia de vecinos próximos**.
- **problema de StructureCo** — *Objetivos pequeños/solapados en táctil*; *ToolRail/TopBar con mala jerarquía* (los iconos apretados de una barra densa incumplen esto tanto como los nodos del canvas).
- **cómo podría aplicarse** — Como **piso**, en dos sitios. (1) **Chrome** (ToolRail, TopBar, `More`, controles del Inspector): es donde SC 2.5.8 aplica literalmente y **debe cumplirse** — 24 px CSS mínimo o separación equivalente; StructureCo ya lo supera con su propio contrato ergonómico (36 px puntero / 44 px táctil), así que esto confirma un suelo ya cumplido, no lo define. (2) **Canvas**: aunque los objetos dibujados quedan fuera del alcance estricto de la SC, el **hit region** de un nodo o barra debe ser mayor que su representación visual, y cuando las hit regions de dos objetos se solapan, el sistema **no debe elegir en silencio** — debe desambiguar (ficha O-2) o abrir el selector de precisión (X-1). **Corrección:** una versión anterior de este análisis proponía el criterio «los círculos de 24 px no se intersecan» como *el* disparador computable de esa desambiguación. No lo es — es un mínimo de tamaño/espaciado, no una regla de cuándo abrir un selector. El disparador real que adopta la especificación (§7.1 de CRI-10) es propio: dos o más candidatos dentro de la región de captura del gesto, o hit-regions solapadas en el punto del gesto.
- **qué NO debemos copiar** — No tratar 24 px como objetivo de diseño: es un **mínimo legal**, y para uso táctil real con la mano en movimiento es insuficiente (ver X-3). No usar las excepciones de la SC (*inline*, *user agent control*, *essential*) como puerta trasera para dejar el ToolRail apretado. Y no presentar el test geométrico de la SC como si fuera el criterio de activación de la desambiguación de StructureCo — es un piso normativo, no una regla de interacción.

### Ficha X-3 — Apple HIG: 44 × 44 pt y no agrupar controles [SEARCH — la página HIG no entregó cuerpo]

- **principio** — La cifra de plataforma para uso táctil cómodo es **44 × 44 puntos**, derivada del ancho real de la yema (≈10 mm, que se ensancha a 11–13 mm al presionar contra el cristal). Y el segundo consejo, tan importante como el primero: **no agrupar controles muy juntos**, porque personas con temblor tocarán el equivocado.
- **problema de StructureCo** — *Objetivos pequeños/solapados en táctil*; *ToolRail/TopBar con mala jerarquía*; *chrome permanente demasiado pesado*.
- **cómo podría aplicarse** — Fijar 44 px CSS como objetivo (no mínimo) para cualquier control táctil de StructureCo, y usar esa cifra como **restricción de diseño que fuerza la jerarquía**: si el ToolRail no cabe con 44 px por control, la conclusión correcta no es encoger los controles sino que **hay demasiados controles permanentes** — que es exactamente el diagnóstico de "chrome permanente demasiado pesado". Es un argumento verificable para mover cosas a contextual (fichas S-1 y F-2) en vez de una preferencia de gusto.
- **qué NO debemos copiar** — No copiar 44 pt como número mágico universal ni mezclar unidades: 44 **pt de iOS** no es 44 **px CSS**, y aplicar el número sin convertir produce controles mal dimensionados en web. Verificar la conversión en los breakpoints reales (incluido el crítico de 1024px). Y honestidad: **no pude verificar el texto de la HIG directamente**; la cifra 44×44 es consistente en toda la literatura secundaria pero está marcada [SEARCH].

### Ficha X-4 — Menús de marca: autorrevelación y transición novato→experto (Kurtenbach & Buxton) [SEARCH]

- **principio** — Un menú puede ser **autorrevelador y a la vez ejecutable de memoria** si la selección se hace por **dirección**: el novato despliega y elige, el experto traza la marca sin esperar al despliegue, y — dato relevante — **al perder práctica el usuario vuelve al despliegue para reaprender**, sin quedar bloqueado. Los datos empíricos mostraron que marcar era sustancialmente más rápido que usar el menú y que los usuarios lo percibían como libre de errores. La conclusión general que los autores extraen va más allá del widget: **soportar el cambio entre modo novato y experto en el propio nivel de interacción es una característica importante y utilizada**.
- **problema de StructureCo** — *Acciones lejos del objeto*; *chrome permanente demasiado pesado*; *ToolRail/TopBar con mala jerarquía*.
- **cómo podría aplicarse** — Adoptar el **principio de rehearsal** sin adoptar el radial: cualquier acción contextual del canvas debe ser alcanzable por (a) menú visible tras clic derecho / pulsación larga, y (b) atajo de teclado, **y el menú debe mostrar el atajo junto a cada entrada**, de modo que usar el camino lento enseñe el rápido. Aplicado también al `More`: cada entrada que se quede ahí debe exhibir su atajo. Es la forma barata de reducir chrome sin castigar al usuario ocasional.
- **qué NO debemos copiar** — No copiar el **radial jerárquico** en táctil ni en pantallas de alta densidad: el propio Autodesk publica un artículo de soporte sobre el marking menu volviéndose inusable en monitores HiDPI, y un radial de dos niveles con el dedo es peor que una lista. El principio transferible es *rehearsal*, no *radial*.

### Ficha X-5 — "Overview first, zoom and filter, details-on-demand" — y sobre todo **relate** (Shneiderman, *The Eyes Have It*, 1996) [SEARCH, PDF oficial UMD localizado]

- **principio** — La taxonomía original enumera **siete tareas**: overview, zoom, filter, **details-on-demand**, **relate**, history, extract. Dos son las decisivas aquí. **Details-on-demand** dice que el detalle se pide, no se preasigna: el espacio del detalle **no se reserva de antemano**. **Relate** dice que ver relaciones entre elementos es una tarea de primera clase — que es precisamente lo que distingue "resultados como evidencia ligada al modelo" de "tablero de tarjetas": una tarjeta que dice "Momento máx. 42 kN·m" no soporta *relate*; un diagrama sobre la barra B7 con sus vecinas visibles sí.
- **problema de StructureCo** — *Results como panel reservado de 285px que existe antes de cualquier resultado* (mapeo directo); *presupuesto de canvas invertido*.
- **cómo podría aplicarse** — Reordenar la presentación de resultados según la secuencia: **overview** = diagramas sobre todo el modelo con escala común; **zoom/filter** = aislar barras o rango de magnitud; **details-on-demand** = clic en una barra abre sus valores **en ese momento**, no en un panel preexistente; **relate** = poder comparar dos barras o ver un esfuerzo en el contexto de sus vecinas. Y el detalle solicitado puede aparecer **anclado al objeto** (popover junto a la barra) en vez de en un panel lateral — lo que resuelve simultáneamente "resultados reservados" y "acciones lejos del objeto".
- **qué NO debemos copiar** — No copiar la mantra como si "overview" significara **un dashboard de agregados**. El overview de StructureCo es **el modelo entero con el resultado dibujado encima**, no una fila de KPIs. Un dashboard de tarjetas es la lectura equivocada de "overview first" y es exactamente lo que hay que evitar.

### Ficha X-6 — Vistas coordinadas y *brushing & linking* (Roberts, CMV 2007) [SEARCH]

- **principio** — Cuando el mismo dato se muestra en varias representaciones, la respuesta estándar en visualización exploratoria es **coordinarlas mediante una selección compartida**: resaltar (*brush*) en una vista resalta lo mismo en todas (*linking*). Lo que hace que funcione no es la sincronización en sí, sino que **hay un único estado de selección** como fuente de verdad, y que **cada vista es una proyección de él**. Es el marco teórico que RFEM y RISA implementan parcialmente y ad hoc.
- **problema de StructureCo** — *El Datasheet debe cerrarse para enfocar un objeto*; *Results como panel reservado*; *Inspector no contextual*.
- **cómo podría aplicarse** — Formalizar en la arquitectura de StructureCo un **estado de selección único** (conjunto de ids + tipo + alcance) del que **canvas, Inspector, Datasheet, Resultados y Model Doctor sean todos suscriptores**, ninguno propietario. Consecuencias concretas: seleccionar en cualquiera resalta en todas; un hallazgo del Model Doctor **es** una selección (y por eso "localizar" funciona sin código especial); "3 de 214" es un dato del estado, no de un panel; y el Inspector se vuelve contextual **por construcción**, no por casos especiales. Esta es la ficha con mayor apalancamiento técnico: resuelve cuatro problemas de la lista con una sola decisión de arquitectura.
- **qué NO debemos copiar** — No copiar la proliferación de vistas del paradigma CMV (n vistas coordinadas configurables por el usuario): eso deriva en gestores de ventanas acoplables, explícitamente descartados. StructureCo tiene un número **fijo y pequeño** de vistas; el valor está en la coordinación, no en la multiplicidad.

### Ficha X-7 — Divulgación progresiva (Nielsen 1995 / NN-g) [SEARCH]

- **principio** — Diferir las funciones avanzadas o poco usadas a una superficie secundaria hace la aplicación **más fácil de aprender y menos propensa a errores**, concentrando la atención en las opciones primarias, que son las únicas mostradas por defecto. La condición para que funcione — y donde casi siempre se falla — es que el **criterio de partición sea comprensible**: el usuario debe poder predecir qué hay detrás del segundo nivel. Un cajón cuyo criterio de admisión es "no cupo arriba" no es divulgación progresiva.
- **problema de StructureCo** — *Cajón "More" de 19 entradas que mezcla trabajo, análisis, preferencias, exportación y power-user* (mapeo directo); *chrome permanente demasiado pesado*.
- **cómo podría aplicarse** — Es el marco que valida la partición de la ficha S-2 y da el test de aceptación: para cada una de las 19 entradas, **una persona que no la ha usado nunca debe poder predecir dónde está** a partir de su naturaleza (modelo / análisis / documento / aplicación / avanzado). Si no puede, la partición está mal. Segundo test: **ninguna acción destructiva ni ningún diagnóstico** deben vivir tras la divulgación progresiva — Model Doctor no es "avanzado", es parte del trabajo normal.
- **qué NO debemos copiar** — No copiar la divulgación progresiva **basada en frecuencia** (mostrar lo más usado, esconder lo demás), y menos aún de forma adaptativa por usuario. Los menús que se reordenan solos destruyen la memoria espacial y son un fallo documentado desde los "menús personalizados" de Office. El criterio debe ser **naturaleza de la acción**, estable para todos los usuarios.

---

## 8. Los 6 principios más fuertes, en orden de apalancamiento

1. **Un único estado de selección del que todas las vistas son proyecciones** (X-6, con confirmación práctica en D-3, R-2, R-3). Una decisión de arquitectura que resuelve de golpe: Inspector no contextual, Datasheet que debe cerrarse, resultados desligados del modelo y acciones lejos del objeto. Es lo primero que haría.
2. **La superficie de resultados no existe hasta que existen resultados vigentes** (D-1 y R-1: dos proveedores independientes documentan exactamente esta regla — RFEM, *"three tabs, four after calculation"*; RISA, resultados en el Explorer *"when a solution is present"*). Elimina la reserva de 285px, devuelve canvas y convierte la aparición del panel en la señal de que hay algo que leer. StructureCo debe ir más lejos que ambos: condicionar a corrida **vigente**, no solo a corrida existente.
3. **Distinguir "añadir contexto" de "entrar en un modo", con fronteras explícitas** (F-1, cita literal verificada de Autodesk sobre contextual tab vs. contextual environment). Da el criterio para decidir qué hace el Datasheet, qué hace el Model Doctor, y por qué un entorno **no puede perder su lanzador a <1024px**.
4. **La selección es la consulta que determina las acciones, y esas acciones viven junto al objeto** (S-1 de Shapr3D + F-2 marking menu + X-4 rehearsal). Convierte el Inspector en contextual, acerca las acciones al objeto y permite adelgazar el chrome permanente sin perder alcance.
5. **En táctil, desacoplar el punto de contacto del punto de selección y enumerar la profundidad en vez de adivinarla** (O-1 + O-2 + X-1). Onshape documenta el motivo textualmente — *"using a finger as a cursor often obstructs one's view"*. WCAG 2.2 SC 2.5.8 (X-2) aporta un piso de tamaño/espaciado que confirma que el contrato ergonómico de StructureCo (36/44 px) ya lo supera — **no** define cuándo abrir el selector de candidatos; ese disparador es una regla propia de StructureCo (dos o más candidatos en la región de captura, o hit-regions solapadas), no una lectura de esta norma.
6. **Un diagnóstico creíble enumera lo que comprueba, gradúa severidad, señala en la geometría y no repara en silencio** (S-3, con SkyCiv como referencia parcial). El Preview que resalta el componente problemático en el canvas es el detalle a adoptar; la auto-reparación silenciosa al pulsar Solve es exactamente lo que hay que rechazar. StructureCo puede ser estrictamente mejor publicando también las tolerancias, que SkyCiv no publica.

**Corolario transversal, y la línea que no se cruza:** ninguna de estas fichas importa semántica de verificación normativa. Los competidores estudiados (RFEM, RISA, SkyCiv) hacen diseño según código y por eso tienen ratios, chequeos y veredictos; **StructureCo no**. Lo transferible de ellos es **la mecánica de coordinación entre vistas**, no su vocabulario de juicio. Concretamente: nada de rampas de color rojo-verde tipo semáforo (usar secuenciales o divergentes por signo), nada de columnas llamadas "ratio" o "check", nada de "elemento crítico" o "peor caso", y el estado `success ≠ reliable ≠ safe` debe presentarse siempre como afirmación **sobre el cálculo**, nunca sobre la estructura.

---

## Fuentes

Método: **[FETCH]** = descarga directa verificada · **[SEARCH]** = solo resumen del buscador sobre la página oficial (dominio bloqueó la descarga).

### Shapr3D — todo [SEARCH], `support.shapr3d.com` devolvió HTTP 403
- Adaptive user interface — https://support.shapr3d.com/hc/en-us/articles/7873882619548-Adaptive-user-interface
- Accessing tools — https://support.shapr3d.com/hc/en-us/articles/7378907587484-Accessing-tools
- Shapr3D modeling space — https://support.shapr3d.com/hc/en-us/articles/7873880676508-Shapr3D-modeling-space
- Selecting geometry — https://support.shapr3d.com/hc/en-us/articles/7770768736924-Selecting-geometry
- Context menus — https://support.shapr3d.com/hc/en-us/articles/7873942151068-Context-menus
- Settings or Preferences — https://support.shapr3d.com/hc/en-us/articles/7873943982620-Settings-or-Preferences
- Extrude with Adaptive User Interface — https://support.shapr3d.com/hc/en-us/articles/13079186051996-Extrude-with-Adaptive-User-Interface

### Onshape
- Selection — https://cad.onshape.com/help/Content/Home/selection.htm — **[FETCH]** (cita de oclusión verificada)
- Select Other — https://cad.onshape.com/help/Content/Home/select_other.htm — **[FETCH]** (citas de propósito y orden de lista verificadas)
- Mobile Touch Interface Navigation — https://cad.onshape.com/help/Content/Mobile/mobile_touch_interface_videos.htm — **[SEARCH]**
- Onshape Primer — https://cad.onshape.com/help/Content/Primer/onshape_primer.htm — **[SEARCH]**
- Tech Tip: Mastering Gestures Mobile — https://www.onshape.com/en/resource-center/tech-tips/tech-tip-mastering-gestures-mobile — **[SEARCH]**
- Tech Tip: Using Select Other — https://www.onshape.com/en/resource-center/tech-tips/tech-tip-using-select-other — **[SEARCH]**
- Patente "Touchscreen Precise Pointing Gesture", Onshape Inc., US 2017/0336966 — https://www.freepatentsonline.com/y2017/0336966.html — **[SEARCH]**

### Autodesk Fusion
- Fusion interface (desktop) — https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GS-THE-FUSION-INTERFACE.htm — **[FETCH]** (citas de contextual tab vs. contextual environment verificadas literalmente)
- Marking menu reference — https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GUID-6514ABC1-CB75-4F0B-AB0E-316FAD36BA93.htm — **[FETCH]**
- Workspaces — https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GS-WORKSPACES.htm — **[SEARCH]**
- Fusion API — User-Interface Customization (referencia al id de toolbar "QAT") — https://help.autodesk.com/cloudhelp/ENU/Fusion-360-API/files/UserInterface_UM.htm — **[SEARCH]**
- Artículo de soporte: marking menu inusable en monitores HD — https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Right-click-marking-menu-is-unusable-on-high-definition-monitors-in-Fusion-360.html — **[SEARCH]**
- *(Nota: los artículos de personalización del Quick Access Toolbar recuperados corresponden a Revit / Inventor / AutoCAD, no a Fusion.)*

### Dlubal RFEM 6
- Navigator (User Interface and Settings) — https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/000016 — **[FETCH]** (cita "three tabs (four after calculation)" verificada)
- Tables (User Interface and Settings) — https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/000009 — **[FETCH]** (cita de sincronización fila↔ventana de trabajo verificada)
- Control Panel (Result Evaluation) — https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/001106 — **[FETCH]** (aparición con resultados, tres pestañas, propagación del filtro a tablas)
- Results — https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/000364 — **[SEARCH]**
- Filtering Result Tables — https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/004065 — **[SEARCH]**
- Views and Visibilities — https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/000073 — **[SEARCH]**
- Result Table Manager (vía tutorial de Concrete Design) — https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6-tutorial-concrete-design-us/003081 — **[SEARCH]**
- Project Navigator (wiki Dlubal) — https://www.dlubal.com/en/solutions/online-services/structural-analysis-wiki/000015 — **[SEARCH]**

### RISA-3D
- Explorer Panel — https://help.risa.com/risahelp/risa3d/Content/MainUI/Explorer-Panel.htm — **[FETCH]** (cita "when a solution is present" verificada; `risa.com` redirige 301 a `help.risa.com`)
- Spreadsheet Operations — https://help.risa.com/risahelp/risa3d/Content/SpreadsheetOper/Spreadsheet%20Operations.htm — **[FETCH]** (cita de sincronización bidireccional verificada)
- Application Interface (.NET) — https://help.risa.com/risahelp/risa3d/Content/Common_Topics/Application%20Interface%20(.NET).htm — **[SEARCH]**, HTTP 403 en descarga directa
- Windows Behavior — https://help.risa.com/risahelp/risa3d/Content/MainUI/Windows-Behavior.htm — **[SEARCH]**
- Graphic Display — https://help.risa.com/risahelp/risa3d/Content/Common_Topics/Graphic%20Display%20(.NET).htm — **[SEARCH]**

### SkyCiv Structural 3D
- Repair Model — https://skyciv.com/docs/structural-3d/solving/repair-model/ — **[FETCH]** (severidades, casillas, Preview y lista completa de comprobaciones verificadas)
- Datasheets — https://skyciv.com/docs/structural-3d/modelling/datasheets/ — **[FETCH]** (citas de `Apply` y de filas incompletas verificadas)
- Shear, Moment, Torsion and Axial (post-procesado) — https://skyciv.com/docs/structural-3d/post-processing/shear-moment-axial-torsion/ — **[FETCH]** (aislamiento por clic, hover en puntos de evaluación, escala `S`+scroll)
- Introduction to Structural 3D — https://skyciv.com/docs/structural-3d/getting-started/introduction/ — **[FETCH]** (poco detalle de UI; describe el flujo, no los paneles)
- Docs: Structural 3D (índice) — https://skyciv.com/docs/structural-3d/ — **[SEARCH]**
- API v3 — `S3D.model.repair` — https://skyciv.com/api/v3/docs/S3D.model/ — **[SEARCH]** (comprobaciones adicionales: nodos flotantes, barras esbeltas para detectar errores de unidades, tolerancia de fusión dependiente del sistema de unidades)

### Referencias transversales
- W3C, *Understanding SC 2.5.8: Target Size (Minimum)* (WCAG 2.2) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — **[FETCH]** (umbral de 24×24 px CSS, excepción de separación y motivación verificados)
- Apple, *Human Interface Guidelines — Layout* — https://developer.apple.com/design/human-interface-guidelines/layout — **[SEARCH]**, la página se sirve como SPA y no entregó cuerpo de texto; la cifra 44×44 pt procede de literatura secundaria consistente
- Apple, *Design Tips* — https://developer.apple.com/design/tips — **[SEARCH]**
- Vogel & Baudisch, *Shift: A Technique for Operating Pen-Based Interfaces Using Touch*, CHI 2007 — https://www.patrickbaudisch.com/publications/2007-Vogel-CHI07-Shift.pdf — **[SEARCH]**
- Kurtenbach & Buxton, *User Learning and Performance with Marking Menus*, CHI 1994 — https://dl.acm.org/doi/10.1145/191666.191759 · resumen del autor: https://www.billbuxton.com/MMUserLearn.html — **[SEARCH]**
- Kurtenbach, *The Design and Evaluation of Marking Menus* (tesis) — https://www.research.autodesk.com/app/uploads/2023/03/the-design-and-evaluation.pdf_recHpUp1v9dc1n2CJ.pdf — **[SEARCH]**
- Shneiderman, *The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations*, 1996 — https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf — **[SEARCH]**
- Roberts, *State of the Art: Coordinated & Multiple Views in Exploratory Visualization*, CMV 2007 — https://www.cs.kent.ac.uk/pubs/2007/2559/content.pdf · https://dl.acm.org/doi/10.1109/CMV.2007.20 — **[SEARCH]**
- Nielsen Norman Group, *Progressive Disclosure* — https://www.nngroup.com/videos/progressive-disclosure/ — **[SEARCH]**
- Nielsen Norman Group, *3 Strategies for Managing Visual Complexity in Applications and Websites* — https://www.nngroup.com/videos/managing-visual-complexity/ — **[SEARCH]**
