/**
 * CRI-9 · Registro de decisiones D-01…D-15 + disposiciones G-01, G-02, F-11.
 *
 * `status` ∈ DECIDED | DEFERRED | UNKNOWN. Ninguna puede desaparecer.
 * `evidence` cita archivo:línea o informe. Lo que no se puede probar se declara.
 */

export const DECISIONS = [
  {
    id: 'D-01',
    title: 'Contrato real de Medium',
    status: 'DECIDED',
    decision:
      'Las tres clases dejan de ser umbrales de ancho y pasan a ser la SALIDA de una regla de presupuesto. '
      + 'El resolutor elige la composición más rica que cumple CB-1..CB-6: X2 (dos docks laterales), '
      + 'M1 (un dock lateral de iconos + detalle superpuesto sin reflow) o K0 (cero docks, una capa contextual). '
      + 'Medium = M1: ToolRail a 76px permanente, detalle contextual superpuesto que NO recompone el lienzo, '
      + 'y cero superficies de resultados residentes.',
    why:
      'Un umbral declarado es exactamente lo que produjo F-01: tres reglas contradictorias sobre --toolbar-w y un '
      + 'inline en AppShellLayout.tsx:48 que gana a :root. Si la clase se calcula, no hay umbral que contradecir. '
      + 'El modelo calibrado devuelve 1024×768 a 81.7% de lienzo en reposo (hoy 24.6%) y mantiene 768×1024 en Compact, '
      + 'que es donde ya estaba bien.',
    evidence:
      'canvas-budget-model.mjs (calibrado a ±0.24 pp contra CRI-7 §2); CRI-7 F-01; CRI-8 §7 (103/122 tareas repiten Expanded).',
    impact: 'La frontera Expanded↔Medium queda entre 1042 y 1130 px según la altura, y nadie la escribe.',
    cri10: 'CRI-10 diseña tres composiciones, no tres hojas de estilo. El inset de Medium es un patrón visual nuevo que el Brandbook debe vestir.',
  },
  {
    id: 'D-02',
    title: 'Presencia del Inspector',
    status: 'DECIDED',
    decision:
      'La presencia del detalle es contextual a la selección en las TRES clases. Y el Inspector actual se parte por dueño: '
      + '`detail` (selección), `analysis-setup` (casos, combinaciones, orden, P-Delta) y `view` (capas, snap, filtro de selección). '
      + 'Las rutas de edición individual y múltiple se conservan íntegras: `detail` tiene dos cardinalidades, no dos superficies.',
    why:
      'Dos de las tres pestañas del panel de la selección no dependen de la selección (CRI-8 §5.3), y el panel cuesta 27.6% del '
      + 'viewport en 1024×768 — más que el propio lienzo. La decisión no depende de U-02 (tiempo de sesión sin selección): '
      + 'un panel contextual es estrictamente mejor que un panel vacío permanente en todos los viewports medidos, '
      + 'y cuando hay selección el panel está.',
    evidence: 'Inspector.tsx:86-95; CRI-8 §5.3 y §12.1; CRI-7 §2.',
    impact: 'Elimina la superficie que más lienzo consume y menos contenido global aloja.',
    cri10: 'Patrón de aparición/desaparición del dock sin salto perceptivo, y estado vacío que ya no existe en Expanded.',
  },
  {
    id: 'D-03',
    title: 'Descomposición de Results',
    status: 'DECIDED',
    decision:
      'ResultsPanel deja de existir como panel. Sus once responsabilidades se reparten por dueño: '
      + '(1) estado del análisis → TopBar, global persistente; '
      + '(2) fiabilidad → chip en TopBar + superficie de causa invocable (D-14); '
      + '(3) elección de evidencia N/V/M/deformada/heatmap → superficie `view`, porque elegir evidencia es elegir capa; '
      + '(4) overlay sobre el lienzo → lienzo, gobernado por `view` y por el estado de análisis; '
      + '(5) detalle del objeto y procedencia → superficie `detail`, junto a sus propiedades; '
      + '(6) datos densos (reacciones, influencia, aprender) → superficie `dense`, invocada, nunca residente.',
    why:
      'El panel reserva 320px de alto ANTES de que exista un resultado (22–25% del viewport). El propio panel ya sabe que es '
      + 'varias cosas: tiene tres modos y agrupa ocho pestañas en cinco familias. RFEM documenta que su navegador de resultados '
      + 'aparece tras un cálculo correcto; ETABS desacopla disponibilidad de visibilidad permanente. '
      + 'El modelo confirma que un dock de datos densos sólo es asumible por encima de ~1700px, y aun así como pin explícito.',
    evidence: 'ResultsPanel.tsx:40,339,514-520; CRI-8 §5.4; CRI-7 §2; RFEM 6 Navigator; ETABS Table Options.',
    impact: 'Devuelve 22–25 puntos de viewport en Expanded y 6.4 en Compact, y hace que el estado y la fiabilidad ganen permanencia real.',
    cri10: 'P-03 (fiabilidad con forma además de color), P-15 (tarjeta de procedencia legible), estado vacío con siguiente paso.',
    risk:
      'U-14 (unknown de compatibilidad, no de implementación): la arquitectura debe preservar una vía para que Aula recupere una presentación '
      + 'más inmediata de resultados si su dirección de producto lo exige más adelante. Aula sigue fuera de alcance de CRI-9 y su validación '
      + 'específica queda diferida hasta que se reabra esa dirección; no se asigna a CRI-11.',
  },
  {
    id: 'D-04',
    title: 'Reparto de espacio por defecto y qué puede sobreescribir el usuario',
    status: 'DECIDED',
    decision:
      'El defecto lo calcula el resolutor desde CB. Las preferencias del usuario dejan de ser estado de layout y pasan a ser '
      + 'INTENCIONES (`dockIntent: auto | pinned | hidden` por dock, ancho preferido, detent preferido, `focusCanvas`). '
      + 'El resolutor las honra cuando CB lo permite y las DEGRADA — nunca las viola — cuando no. Toda degradación se anuncia '
      + 'por el canal de estado; ninguna se aplica en silencio. Los tres conmutadores solapados actuales '
      + '(inspectorCollapsed / fullCanvas / toolRailCompact) colapsan a `dockIntent` por dock + un único `focusCanvas`.',
    why:
      'La palanca ya está construida y es sólida (clamp 280-480, detents normalizados, persistencia tolerante a fallos). '
      + 'Lo que falla es el defecto y una cascada de tres capas. Además `onToggleInspector` desactiva `fullCanvas` como efecto '
      + 'lateral, un modelo mental que nadie declaró.',
    evidence: 'useWorkspaceLayoutPreferences.ts:19-85; WorkspaceShell.tsx:246-259; AppShellLayout.tsx:48; CRI-8 §8.4.',
    impact: 'El ancho del Inspector deja de escribirse como inline incondicional; pasa a ser una intención acotada por el resolutor.',
    cri10: 'Cómo se ve una intención degradada sin que parezca un fallo.',
  },
  {
    id: 'D-05',
    title: 'Qué decide el viewport, el contenedor, el input y el contexto',
    status: 'DECIDED',
    decision:
      'Regla única y excluyente: ESPACIO (viewport + visualViewport + safe-area) decide composición y presentación; '
      + 'CONTENEDOR decide el layout interno de cada superficie, siempre con container queries y nunca con @media; '
      + 'INPUT decide afordancias (tamaños de objetivo, gestos, lupa, picker, dependencia de hover) y NUNCA presencia; '
      + 'SELECCIÓN decide presencia y contenido del detalle y de las acciones contextuales; '
      + 'WORKFLOW decide superficies temporales; ANÁLISIS decide disponibilidad de evidencia y datos densos. '
      + 'Regla de implementación: exactamente UN módulo puede leer `matchMedia` — el sensor de entorno. '
      + 'Ningún componente vuelve a preguntarle al navegador por su ancho.',
    why:
      'Hoy hay 31 umbrales de ancho distintos en 96 bloques condicionados por ancho, y al menos cuatro dueños distintos de la decisión responsive '
      + '(styles.css, ResultsPanel con su propio matchMedia, ModelDoctor con su umbral de 700px en JS, WorkspaceShell con el suyo de 1024). '
      + 'Con esa dispersión, tres reglas contradictorias sobre la misma variable pasan desapercibidas — que es literalmente F-01.',
    evidence: 'ResultsPanel.tsx:83-86,292-305; ModelDoctor.tsx:44-48; WorkspaceShell.tsx:66,126,266; recuento de umbrales verificado en main.',
    impact: 'Los 31 umbrales dejan de ser arquitectura: los del shell desaparecen (los calcula CB) y los internos pasan a container queries.',
    cri10: 'P-23 (tokens de breakpoint) queda reducido a los pocos umbrales de contenedor que sobrevivan.',
  },
  {
    id: 'D-06',
    title: 'Selección precisa y objetos solapados en táctil',
    status: 'DECIDED',
    decision:
      'Un solo contrato de cinco fases, idéntico en los cuatro inputs: candidatos → previsualización → elección/ciclado → compromiso → cancelación. '
      + 'La lupa es la FASE DE PREVISUALIZACIÓN y el picker de solapados es la FASE DE ELECCIÓN: son dos fases de un contrato, no dos mecanismos. '
      + 'No se añade un cuarto gesto táctil: el long-press que hoy selecciona a ciegas pasa a ARMAR el picker cuando hay más de un candidato, '
      + 'y se comporta exactamente como hoy cuando hay uno solo. Cancelar nunca altera la selección previa, y `Escape` con el picker abierto '
      + 'cierra sólo el picker (alcance acotado), no los siete estados.',
    why:
      'El mejor mecanismo de precisión del producto está apagado justo en el input que más lo necesita: la rama táctil sale antes de llegar '
      + 'al picker para resolver la intención pan/long-press. Y la lupa no se arma durante un tap simple de selección. '
      + 'Onshape documenta el mismo problema («el dedo tapa el objetivo») y lo resuelve con mantener-arrastrar-soltar; '
      + 'no se copia su retícula, se adopta el principio de separar ver de elegir.',
    evidence: 'StructuralCanvas.tsx:1238-1244 (salida táctil previa al picker), :1245-1283 (picker + ciclado), :1395-1399 (armado de la lupa), :954-978 (long-press 480ms); CRI-8 §10.3.',
    impact: 'Cierra los casos 1–3 de CRI-8 §10.2 sin geometría técnica más gruesa: las áreas de acierto ya están separadas del trazo.',
    cri10: 'P-16 (picker que no tapa el punto), P-17 (lente bajo Brandbook).',
  },
  {
    id: 'D-07',
    title: 'Paridad funcional entre métodos de entrada',
    status: 'DECIDED',
    decision:
      'Contrato de paridad: toda tarea debe tener al menos una ruta para {puntero+teclado} y una para {táctil}, salvo que sea intrínsecamente '
      + 'específica de un input. Las cinco brechas verificadas se cierran así: copiar/pegar/duplicar (MOD-13), borrar (MOD-09), repetir (MOD-12) '
      + 'y transformar (MOD-10) → superficie `contextual-actions`, que existe mientras hay selección; '
      + 'marco de selección (SEL-03) → submodo explícito de la herramienta `select`, armado desde `view`/acciones contextuales y desarmado al completar '
      + 'el marco (no un gesto nuevo: dos dedos ya es pinch); '
      + 'pegado de bloque en el datasheet (DAT-06) → afordancia propia en la barra de la tabla que lee el portapapeles asíncrono.',
    why:
      'Es un hueco de paridad entre inputs, no evidencia de una segunda arquitectura. La restricción «no crear versión funcional separada por '
      + 'dispositivo» está incumplida hoy en cuatro puntos verificados y en Repeat.',
    evidence: 'StructuralCanvas.tsx:1241-1244, :1307-1311, :1669-1692; DatasheetPanel.tsx:285-296; CRI-8 §6.3.',
    impact: 'Descarga además ToolRail y el menú «Más», que hoy alojan acciones que sólo son válidas con selección.',
    cri10: 'La barra de acciones contextuales es un patrón nuevo bajo Brandbook. P-20 (destructiva con deshacer inmediato).',
    open: 'La disponibilidad real de `navigator.clipboard.readText()` bajo la matriz de navegadores del producto no se verificó aquí (U-11).',
  },
  {
    id: 'D-08',
    title: 'Conflicto y recuperación sin salir de la mesa',
    status: 'DECIDED',
    decision:
      'Nueva superficie `recovery`, invocada desde el chip de persistencia de la TopBar, que lista `listRecoveries(projectId)` con fecha, '
      + 'motivo y checksum, y ofrece restaurar (`restoreRecovery`) o seguir en la revisión viva. Precedencia declarada, no inventada: '
      + 'localStorage es la autoridad de la SESIÓN VIVA (es de donde arranca el proyecto); IndexedDB es la autoridad de la BIBLIOTECA; '
      + 'un conflicto nunca se resuelve solo. No se toca la persistencia ni la política local-first.',
    why:
      'El estado `conflict` se anuncia en la mesa y la restauración vive en el Project Hub, dentro de la Welcome: no hay ruta desde el workspace. '
      + 'Es el hueco de acceso más grave del mapa y es pérdida potencial de trabajo.',
    evidence:
      'ProjectContext.tsx:38 (arranque desde localStorage), :87-111 y :161-200 (espejo y bloqueo por conflicto), '
      + 'projectRepository.ts:195-208 (la recuperación se escribe en la MISMA transacción, antes de lanzar el conflicto), :277-297 (migración legacy). Resuelve U-10.',
    impact: 'Cierra CRI-8 §9.2 hueco 1 y añade de paso la ruta para abrir otro proyecto desde la mesa (hueco 2).',
    cri10: 'Cómo se ve un chip de estado que además es la puerta a un workflow de recuperación sin alarmar de más.',
  },
  {
    id: 'D-09',
    title: 'Responsabilidad del menú «Más»',
    status: 'DECIDED',
    decision:
      '«Más» deja de ser un menú y pasa a ser una REGLA: es el desbordamiento de UNA zona concreta, filtrado por el contexto de esa zona, '
      + 'y nada más. Sus 19 entradas actuales se reparten: historial → permanente en TopBar (nunca en desbordamiento); '
      + 'contexto de análisis → `analysis-setup`; preferencias → `preferences`; exportación → `output`; layout → intenciones del resolutor; '
      + 'diagnóstico → lanzador propio con recuento en las tres clases. '
      + 'Invariante: un elemento sólo puede aparecer en un desbordamiento si además tiene una casa NO-desbordamiento en alguna clase.',
    why:
      'Hoy mezcla siete naturalezas en un popover plano, con Deshacer junto a idioma. Shapr3D documenta lo contrario: su `More` sigue '
      + 'filtrado por la selección en lugar de ser un cajón.',
    evidence: 'TopBar.tsx:473-520; CRI-8 §5.1; CRI-7 F-06; Shapr3D «Accessing tools».',
    impact: 'Ningún cajón puede volver a ser el sitio donde cabe lo que no cabe.',
    cri10: 'Patrón de desbordamiento contextual, distinto visualmente de un menú de utilidades.',
  },
  {
    id: 'D-10',
    title: 'Un solo modelo de visibilidad del lienzo',
    status: 'DECIDED',
    decision:
      'Dueño único: el estado de vista del lienzo, en la superficie `view`, FUERA de ProjectModel. Las capas/presets y los `show*` del '
      + 'Inspector se fusionan en un solo control. `settings.show*` sale de `ProjectSettings` en la fase de implementación, con migración. '
      + 'Si el coste de esa migración se juzga inasumible, el repliegue declarado es: los `show*` permanecen en el modelo pero la superficie '
      + '`view` es la ÚNICA ruta de escritura, de modo que el número de dueños en la interfaz siga siendo uno.',
    why:
      'La pregunta de U-05 («qué gana si se contradicen») tiene respuesta verificada y no es la que se suponía: NO se contradicen, '
      + 'se componen con AND. `layers.results && layers.labels && resultsAllowed && project.settings.showResultValues && analysis?.success`. '
      + 'Hay dos dueños y ninguno gana; el usuario puede apagar el dibujo desde dos sitios y encenderlo desde uno sin efecto. '
      + 'Además `settings.show*` es estado de PRESENTACIÓN dentro del modelo persistido: abrir el proyecto de otra persona cambia tus preferencias de vista.',
    evidence: 'StructuralCanvas.tsx:1962, :2403; CanvasResultLayer.tsx:103,223,417-427; editorLayers.ts:39-70; types.ts:184-193. Resuelve U-05.',
    impact: 'Quita una contaminación de dominio y unifica tres mecanismos de «enséñame menos» (capas, `show*`, filtro de selección).',
    cri10: 'P-10 (capas + ajustes de vista como un solo patrón), P-11 (chip informativo vs accionable).',
    risk: 'Sacar `show*` del esquema es el mayor riesgo adyacente a schema de todo CRI-9: exige `migrate.ts` y pasar `verify:protected`.',
  },
  {
    id: 'D-11',
    title: 'Datasheet: destino modal o vista coordinada',
    status: 'DECIDED',
    decision:
      'Las dos cosas, resueltas por la misma regla de presentación que el resto: `dense` es una superficie con tres presentaciones '
      + '(dock fijable en Expanded muy ancho, drawer en Medium, fullscreen en Compact). El cambio de contrato que importa no es el acoplamiento: '
      + 'es que LOCALIZAR YA NO CIERRA la superficie, la degrada a `peek` y la recuerda, con vuelta explícita. '
      + 'Se añade el modo «sólo la selección» como faceta más del filtrado existente.',
    why:
      'Hoy enfocar exige cerrar la tabla, porque el drawer taparía el objeto centrado — una consecuencia honesta de la superficie, no un descuido. '
      + '`peek` resuelve la causa sin acoplar ventanas. El dock fijable sólo es asumible por encima de ~1700px según el modelo, así que el '
      + 'acoplamiento de RFEM no se importa: se ofrece donde el presupuesto lo paga. «Show Selection Only» de ETABS es barato aquí porque '
      + 'la sincronía selección↔fila ya existe en ambos sentidos.',
    evidence: 'DatasheetPanel.tsx:359-361 (cierra antes de emitir focus-object), :182-197; canvas-budget-model.mjs (dock denso); ETABS Table Options form; RFEM Tables.',
    impact: 'Cierra CRI-8 §9.2 hueco 6 para Datasheet y Model Doctor con una sola regla.',
    cri10: 'El estado `peek` es un patrón visual nuevo: una superficie viva y reducida, no una cerrada.',
  },
  {
    id: 'D-12',
    title: 'Una ficha de propiedades o tres',
    status: 'DECIDED',
    decision:
      'Un solo view-model de objeto (lectura) y un solo tipo de intención de edición (escritura), con TRES presentaciones y DOS cardinalidades. '
      + '`DatasheetEditorPanel` deja de reimplementar la ficha y pasa a alojar la superficie `detail`; Bulk Edit deja de ser una superficie '
      + 'aparte y pasa a ser `detail` cuando `selection.kind === "multi"` — que es donde ya vive físicamente. '
      + 'La duplicación por TAREA (agregación de valores mixtos, recuento de afectados) se conserva; la duplicación por PRESENTACIÓN se retira.',
    why:
      'Las tres escriben ya el mismo modelo con `materialId`/`sectionId` explícitos, que es lo difícil y está bien resuelto. Lo que sobra son '
      + 'tres implementaciones de la misma lectura.',
    evidence: 'CRI-8 §8.3 y §8.2 (INS-03 con cuatro puertas legítimas); BulkEditInspectorPanel.tsx:32-81; identityMetadata.test.ts.',
    impact: 'Retira una de las tres implementaciones sin forzar una UI única para tareas distintas.',
    cri10: 'PropertyRow y ResultMetric del Brandbook §09 como base común de la ficha.',
  },
  {
    id: 'D-13',
    title: 'Contrato borrador → preview → aplicar',
    status: 'DECIDED',
    decision:
      'Hay UN contrato arquitectónico y ya existe en el código, con dos niveles de conformidad. Los cuatro invariantes son obligatorios: '
      + '(1) `prepare` es puro y ENUMERA lo que hará y lo que no puede hacer; (2) el preview sale de la MISMA función que la escritura; '
      + '(3) `execute` revalida contra un snapshot del modelo del que se preparó y se niega si el modelo se movió debajo; '
      + '(4) una sola entrada de historial y una sola invalidación de análisis. '
      + 'Nivel A (objeto `Prepared*` cruzando la frontera de UI): reparación de topología, edición estructural, generación. '
      + 'Nivel B (intención compilada a un único `ProjectCommand`): bulk edit, plan del datasheet. NO se fuerza una implementación común. '
      + 'Lo que SÍ se unifica es el ciclo de vida de UI: todo borrador se registra en `DraftLifecycle` '
      + '(abierto / sucio / previsualizado / aplicado / cancelado / interrumpido), porque es lo que la matriz de transiciones necesita para garantizar '
      + 'que un resize nunca hace commit ni cancel en silencio.',
    why:
      'Las cinco implementaciones son correctas y sus garantías transaccionales difieren; abstraerlas por simetría sería estética. '
      + 'Pero la seguridad ante transiciones sí necesita una respuesta uniforme a «¿hay un borrador sin aplicar y puede migrar?».',
    evidence: 'ProjectModelContext.tsx:19-70; ProjectContext.tsx:402-436; DatasheetPanel.tsx:238-251; BulkEditInspectorPanel.tsx:66-81; ProjectContext.modelDoctor.test.tsx:104-117.',
    impact: 'Abstracción exactamente donde paga (transiciones) y ninguna donde no (internals transaccionales).',
    cri10: 'Un solo lenguaje visual de «hay algo sin aplicar» en las cinco superficies.',
  },
  {
    id: 'D-14',
    title: 'Explicación accesible de estados críticos y deshabilitados',
    status: 'DECIDED',
    decision:
      'Contrato «qué / por qué / qué hacer»: todo estado critical, limited, unreliable, stale o disabled expone su causa y su siguiente acción '
      + 'a través de un elemento ENFOCABLE, nunca sólo por `title` ni por hover. Un control que está deshabilitado y tiene causa que comunicar '
      + 'usa `aria-disabled` y sigue siendo enfocable; `disabled` queda sólo para controles sin causa. Los cambios de estado se anuncian por '
      + '`role="status"`/`aria-live`; la causa se enlaza con `aria-describedby` sobre el propio control. En táctil, tocar el chip abre la superficie de causa.',
    why:
      'La causa gobernante de una fiabilidad limitada vive hoy en un `title` de ResultsPanel: no existe en táctil ni por teclado. Es la afirmación '
      + 'más crítica del producto por la ruta más débil. El modelo de tres campos de Model Doctor (qué / por qué / qué hacer) ya existe y funciona: '
      + 'se generaliza en vez de inventarse.',
    evidence: 'ResultsPanel.tsx:183; CRI-8 §9.2 hueco 5, DOC-03, STA-05; StatusStrip (Brandbook §09).',
    impact: 'Convierte `success ≠ reliable ≠ safe` en una afirmación alcanzable por los cuatro inputs, no sólo por el ratón.',
    cri10: 'P-02 (escala de estados unificada), P-03, P-14 (tarjeta qué/por qué/qué hacer).',
  },
  {
    id: 'D-15',
    title: 'Space 3D',
    status: 'DEFERRED',
    decision:
      'Space 3D NO adopta el sistema de composición de CRI-9 y sigue separado y experimental. No se exige paridad 2D↔3D ni superficies ni '
      + 'selección compartidas. Sí adopta DOS contratos neutrales que hoy incumple o duplica: (1) resolución de tema única, en vez de su propio '
      + '`matchMedia`, porque eso es duplicación de LÓGICA y está explícitamente prohibida; (2) capacidad de input y mínimos de objetivo del proyecto, '
      + 'que hoy viola con controles de 24×44 y 26×36.',
    why:
      'Es un dominio, un store y un motor distintos. Importar el sistema de composición exigiría suposiciones espaciales que no existen. '
      + 'Pero un segundo resolutor de tema contradice una restricción protegida, y unos mínimos táctiles propios contradicen los del propio proyecto.',
    evidence: 'Space3DWorkspace.tsx:50 frente a ProjectContext.tsx:45-49; App.tsx:61-74; CRI-7 §8.',
    impact: 'Ninguno sobre 2D. Dos deudas acotadas y verificables en 3D.',
    cri10: 'P-22 (marcado de experimental). Nada más de 3D entra en CRI-10.',
    open: 'Al entrar en Space 3D, `WorkspaceShell` se DESMONTA: el dominio 2D sobrevive porque `ProjectProvider` está por encima, la presentación 2D se pierde, y 3D nunca escribe en el proyecto 2D (`sourceProject` es de sólo lectura y la divergencia se detecta, no se propaga). Resuelve U-09.',
  },
];

export const DISPOSITIONS = [
  {
    id: 'G-01',
    title: 'Ctrl+Z / Ctrl+Y anunciados sin manejador',
    status: 'DECIDED — implementar en la fase de implementación, no aquí',
    decision:
      'Se implementan los atajos, no se retira la promesa. Deshacer y rehacer son globales persistentes y el contrato de paridad (D-07) exige '
      + 'ruta de teclado para una acción global. Regla de alcance obligatoria: el atajo NO dispara cuando el foco está en un campo de texto, '
      + 'en la rejilla del datasheet o dentro de una superficie modal con su propio historial de edición.',
    evidence: 'CommandPalette.tsx:150,154; sin manejador en src/**; StructuralCanvas.tsx:1642-1734 atiende Ctrl+C/V/D, R, Escape y Delete, no Ctrl+Z.',
  },
  {
    id: 'G-02',
    title: '`resultTab: "issues"` sin pestaña que lo represente',
    status: 'DECIDED — sale del tipo',
    decision:
      '`issues` se retira de `ResultTab`. Bajo D-03 un análisis fallido no es una pestaña de resultados: es un estado de análisis (TopBar) más una '
      + 'ruta a Model Doctor. El cuerpo ya renderiza `FailedResults` desde `analysis.success === false`, así que no se pierde nada funcional y se gana '
      + 'que `aria-selected` deje de marcar una pestaña que no refleja el estado.',
    evidence: 'WorkspaceUIContext.tsx:4; ProjectContext.tsx:239; ResultsPanel.tsx:179,545.',
  },
  {
    id: 'F-11',
    title: 'Cuál de los tres verdes es la fuente única de marca',
    status: 'OWNER DECISION — CRI-9 no elige',
    decision:
      'Sigue esperando decisión del propietario. Es el único caso donde el propio Brandbook §03 nombra los valores en pugna (#159a72, #00795f, #157A55) '
      + 'y pide elegir uno — y hoy manda un cuarto (#087e5c). CRI-9 no lo toca y CRI-10 no puede empezar la identidad sin él.',
    evidence: 'brand/brandbook-clay.html §03; tokens.css:61-62,130; public/favicon.svg:2; public/site.webmanifest:11.',
  },
];
