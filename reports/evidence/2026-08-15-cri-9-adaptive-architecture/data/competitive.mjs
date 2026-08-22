/**
 * CRI-9 · Matriz competitiva.
 *
 * MÉTODO Y SU LÍMITE HONESTO. El proxy de red de este entorno bloquea el acceso
 * directo por `WebFetch` a los dominios de fabricante (verificado de nuevo en
 * esta ejecución: `cad.onshape.com` devuelve EGRESS_BLOCKED). El contenido se
 * recuperó con la herramienta de búsqueda web, que sí alcanza y resume esas
 * mismas páginas oficiales. Las cinco fuentes de las que dependen decisiones
 * concretas se RE-VERIFICARON en esta ejecución, de forma independiente de
 * CRI-8; las demás se citan como las dejó CRI-8.
 *
 * Consecuencia: las citas son fieles al contenido recuperado de páginas
 * oficiales, pero no se han cotejado carácter a carácter contra el HTML
 * original. Ninguna decisión de este informe depende de un matiz literal.
 */

export const COMPETITIVE = [
  {
    product: 'Shapr3D',
    pattern:
      'La interfaz adaptativa recomienda herramientas a partir de lo preseleccionado; si la herramienta buscada no aparece, '
      + '`More` da acceso a las demás funciones VÁLIDAS PARA ESA SELECCIÓN.',
    reverified: true,
    problem:
      'ToolRail y TopBar alojan acciones que sólo son válidas con selección, y el menú «Más» mezcla 19 entradas que no dependen de nada.',
    application:
      'Superficie `contextual-actions`: las acciones de selección salen del rail y del cajón y aparecen junto a la selección. '
      + 'El desbordamiento pasa a estar filtrado por contexto (D-09).',
    strength:
      'La selección ya es única y compartida por cinco superficies, y `MOD-10` ya condiciona su lanzador a `canEditSelection`. '
      + 'El precedente interno existe.',
    risk:
      'Creación y navegación NO pueden ser contextuales: cuando se crea, no hay selección. El propio código ya razona esto para el '
      + 'generador. Un producto que sólo muestra lo válido-para-la-selección deja al usuario sin punto de partida en un lienzo vacío.',
    decisions: 'D-07, D-09',
    source: 'https://support.shapr3d.com/hc/en-us/articles/7873882619548-Adaptive-user-interface · https://support.shapr3d.com/hc/en-us/articles/7378907587484-Accessing-tools',
  },
  {
    product: 'Onshape',
    pattern:
      'Precision Selector: mantener pulsado con un dedo en el área gráfica hace aparecer un selector que se arrastra como cursor y se '
      + 'suelta sobre la entidad deseada; el motivo documentado es que el dedo tapa el objetivo. `Select Other` recorre las entidades '
      + 'bajo el puntero, incluidas las ocultas, con la tecla ` para bajar por la lista y Shift+` para subir.',
    reverified: true,
    problem:
      'El picker de solapados está apagado en táctil y la lupa no se arma durante un tap simple de selección.',
    application:
      'Contrato de precisión de cinco fases (D-06): la lupa es la previsualización, el picker es la elección. El long-press que hoy '
      + 'selecciona a ciegas pasa a armar el picker cuando hay más de un candidato.',
    strength:
      'La lupa clona el render real con `<use>` en vez de redibujarlo, así que no puede desincronizarse. Y el picker de StructureCo es '
      + 'lista Y ciclado con contador «i de n», donde `Select Other` es lista con ciclado por teclado.',
    risk:
      'Copiar la retícula añadiría un cuarto gesto táctil a un lienzo que ya distingue tap, long-press, arrastre-pan y pinza. '
      + 'La lección no es la retícula: es aceptar que la misma función necesita distinta interacción por método de entrada.',
    decisions: 'D-06, D-07',
    source: 'https://cad.onshape.com/help/Content/Home/selection.htm · https://cad.onshape.com/help/Content/Home/select_other.htm',
  },
  {
    product: 'Autodesk Fusion',
    pattern:
      'Las pestañas contextuales sólo se activan al invocar su comando y no son visibles hasta entonces. Los entornos contextuales van '
      + 'un paso más allá: SUSTITUYEN las pestañas por defecto del workspace hasta que se sale del entorno.',
    reverified: true,
    problem:
      'TopBar y ToolRail exponen a la vez funciones de modelar, revisar resultados, diagnosticar y configurar.',
    application:
      'Dos grados formalizados en el catálogo de presentaciones: aparecer JUNTO a lo existente (`inset` de acciones contextuales) o '
      + 'SUSTITUIRLO (estado que ya usan el preview de reparación y la revisión del datasheet).',
    strength:
      'StructureCo no separa el modelo por fases: se puede analizar mientras se modela y volver sin cambiar de workspace. Esa continuidad '
      + 'es una ventaja real para el usuario y especialmente para Aula.',
    risk:
      'Crear workspaces por fase fragmentaría un flujo hoy continuo y multiplicaría el coste de ir y volver entre modelar y leer resultados '
      + '— justo lo contrario de lo que necesita el bucle de aprendizaje. Se adopta el grado contextual; se rechaza el workspace por fase.',
    decisions: 'D-03, D-09, §11',
    source: 'https://help.autodesk.com/view/fusion360/ENU/?guid=GD-EXPLORE-WS-UI · https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GS-WORKSPACES.htm',
  },
  {
    product: 'Dlubal RFEM 6',
    pattern:
      'El Navigator tiene tres pestañas — Data, Display, Views — y una CUARTA, Results, que aparece tras un cálculo correcto. '
      + 'Las tablas se acoplan y desacoplan del marco de la ventana como el propio Navigator.',
    reverified: true,
    problem:
      'Results es un panel único que reserva 320px de alto ANTES de que exista un resultado, y hay dos sistemas de visibilidad sin relación.',
    application:
      'Separar Datos / Visualización / Resultados como responsabilidades con dueño distinto (D-03) y que las superficies de resultados '
      + 'aparezcan tras calcular en vez de reservar espacio antes.',
    strength:
      'La procedencia por número (magnitud, objeto, caso, convención de signos y posición): no se documenta nada equivalente en RFEM. '
      + 'Y la tabla de StructureCo usa la selección del workspace, no una propia.',
    risk:
      'El árbol del Navigator y el modelo de ventanas acoplables son de escritorio dedicado. Copiarlos rompería Compact, que es donde '
      + 'StructureCo hoy es mejor. El modelo de presupuesto confirma que un dock de datos densos sólo se paga por encima de ~1700px.',
    decisions: 'D-03, D-10, D-11',
    source: 'https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/000016 · .../000009 · .../000364',
  },
  {
    product: 'RISA-3D',
    pattern:
      'Las toolbars disponibles dependen de la ventana activa; el Explorer lista las hojas de datos y, con solución presente, añade las de '
      + 'resultados. Varias puertas documentadas para la misma función.',
    reverified: false,
    problem:
      'Validar que varias puertas al mismo estado son fortaleza, y distinguirlas de las ocho duplicaciones innecesarias del mapa.',
    application:
      'Disponibilidad de controles dependiente del contexto activo como patrón maduro, no excentricidad. Refuerza que las superficies de '
      + 'resultados aparezcan sólo cuando hay solución.',
    strength:
      'Un solo `Selection` compartido y un comando `focus-object` tipado que hace imposible pedir un foco inválido. RISA tiene muchas '
      + 'puertas; StructureCo tiene muchas puertas AL MISMO ESTADO, que es más difícil y más valioso.',
    risk:
      'RISA multiplica puertas sin criterio publicado de cuándo sobra una. Imitar «más puertas» empeoraría exactamente las ocho '
      + 'duplicaciones que D-09 y D-12 vienen a retirar.',
    decisions: 'D-09, D-12',
    source: 'https://help.risa.com/risahelp/risa3d/Content/MainUI/Explorer-Panel.htm · .../Windows-Behavior.htm',
  },
  {
    product: 'SkyCiv Structural 3D',
    pattern:
      'Los datos se introducen por formularios, Datasheet y herramientas gráficas; el Datasheet se abre desde el icono del propio '
      + 'formulario. `Repair Model` categoriza los problemas y ofrece RESALTAR los componentes problemáticos antes de actuar.',
    reverified: false,
    problem:
      'Localizar un objeto exige cerrar el Model Doctor o la tabla, porque taparían el objeto centrado.',
    application:
      'El estado `peek`: el diagnóstico resalta y se reduce, no se cierra (D-11). Y abrir la tabla desde la ficha del objeto, no sólo '
      + 'desde el chrome global.',
    strength:
      '`prepareTopologyRepair` enumera lo que NO puede resolver y lo que omite, detecta si el modelo cambió bajo el preview y bloquea el '
      + 'aplicar; `finding.repair.available === false` produce «reparación ambigua», no una corrección silenciosa.',
    risk:
      'EL MAYOR RIESGO DE TODA LA MATRIZ. Una reparación automática que no declara sus límites contradice la política fail-closed. '
      + 'Se adopta el resaltado; NO la disposición a arreglar sin enumerar lo dudoso.',
    decisions: 'D-11, §10',
    source: 'https://skyciv.com/docs/structural-3d/modelling/datasheets/ · https://skyciv.com/docs/structural-3d/solving/repair-model/',
  },
  {
    product: 'ETABS (CSI)',
    pattern:
      'En el formulario Table Options, «Show Selection Only» muestra los datos de los objetos seleccionados ANTES de invocar el comando, '
      + 'y «Show Only if Used in Model» evita que se incluyan columnas de datos irrelevantes. Las tablas se despliegan en la banda inferior '
      + 'desde Display › Show Tables o desde el Model Explorer. La base admite cientos de tipos de tabla sin mostrarlos permanentemente.',
    reverified: true,
    problem:
      'La tabla muestra siempre el modelo entero, y conviven tres mecanismos distintos de «enséñame menos».',
    application:
      'Modo «sólo la selección» como una faceta más del filtrado existente (D-11), barato porque la sincronía selección↔fila ya es '
      + 'bidireccional. Y el principio general: capacidad disponible no implica control siempre visible.',
    strength:
      'El desacoplamiento ya está hecho en parte: el datasheet es un drawer bajo demanda, no un panel residente, y sus facetas se calculan '
      + 'del contenido real con recuento.',
    risk:
      'ETABS acepta cientos de tablas y un explorador denso como precio de la potencia. StructureCo no debe adoptar esa complejidad como '
      + 'objetivo: lo único que se estudia es cómo desacopla lo disponible de lo permanentemente visible.',
    decisions: 'D-03, D-11',
    source: 'https://docs.csiamerica.com/help-files/etabs/Keyboard_Commands_and_Special_Features/Table_Options_form.htm · .../Model_Explorer.htm · .../Menus/Display/Show_Tables.htm',
  },
];

/** Lo que NO se copia, con su razón. */
export const NOT_COPIED = [
  'Reparación automática sin enumerar lo dudoso (SkyCiv). Contradice fail-closed; StructureCo ya lo hace mejor.',
  'Árbol de navegación denso tipo RFEM/ETABS. Rompería Compact, que es donde StructureCo es más fuerte.',
  'Workspaces por fase (Fusion). Fragmentaría el bucle continuo modelar↔analizar y perjudicaría a Aula.',
  'Ventanas acoplables/flotantes (RFEM). Introduce un modelo de ventanas sin equivalente táctil.',
  'Multiplicar puertas sin criterio (RISA). StructureCo ya tiene ocho duplicaciones innecesarias.',
  'La retícula de precisión de Onshape como gesto literal. Se adopta el principio (ver ≠ elegir), no el cuarto gesto.',
  'Estética, color, radios, sombras, motion, spacing e iconografía de cualquiera de los siete. El Brandbook Clay manda.',
];
