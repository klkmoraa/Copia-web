/**
 * CRI-9 · Ubicación de las 122 tareas de CRI-8 en el catálogo de superficies.
 *
 * El criterio de cierre de CRI-9 exige que CUALQUIERA de las 122 tareas pueda
 * ubicarse sin ambigüedad. Esto se resuelve con una REGLA determinista sobre la
 * clasificación UX primaria de CRI-8, más un conjunto de EXCEPCIONES declaradas
 * que son, literalmente, las decisiones de CRI-9.
 *
 * Se hace así, y no con heurística sobre texto libre, para que el resultado sea
 * auditable: la regla es una tabla de 10 entradas y cada excepción cita su
 * decisión. Una regla que acertara «casi siempre» sin poder explicarse sería
 * precisión falsa.
 */

/** Clase UX primaria de CRI-8 → superficie por defecto. */
export const CLASS_TO_SURFACE = {
  '1': { surface: 'topbar', why: 'Global persistente: sólo lo global y frecuente tiene permanencia.' },
  '2': { surface: 'analysis-setup', why: 'Contextual a proyecto/análisis: viaja junto a la acción de analizar.' },
  '3': { surface: 'detail', why: 'Contextual a selección: presencia gobernada por la selección.' },
  '4': { surface: 'canvas', why: 'Canvas-local: vive en el lienzo o en su superficie de vista.' },
  '5': { surface: 'detail', why: 'Inspector/detail: ficha del objeto, una sola implementación.' },
  '6': { surface: 'transient', why: 'Workflow temporal: superficie efímera con ciclo de vida registrado.' },
  '7': { surface: 'palette', why: 'Power-user: aceleración, nunca puerta única.' },
  '8': { surface: 'preferences', why: 'Configuración: superficie invocada, fuera del chrome permanente.' },
  '9': { surface: 'dense', why: 'Datos densos / fullscreen: invocada, nunca residente.' },
  T: { surface: 'status', why: 'Transversal: canal de estado y anuncios.' },
};

/**
 * Excepciones. Cada una ES una decisión de CRI-9, no un ajuste.
 * `surface` es el destino; `why` cita la decisión que lo justifica.
 */
export const OVERRIDES = {
  // — Entrada: se conserva como pantalla propia; dos funciones ganan además ruta desde la mesa
  'ENT-01': { surface: 'welcome', why: 'Pantalla de entrada; fuera del shell de la mesa.' },
  'ENT-02': { surface: 'welcome', why: 'Pantalla de entrada.' },
  'ENT-03': { surface: 'welcome', why: 'Pantalla de entrada + menú de documento en TopBar.' },
  'ENT-04': { surface: 'welcome', why: 'Pantalla de entrada.' },
  'ENT-05': { surface: 'welcome', why: 'Auxiliar de la lista de plantillas.' },
  'ENT-06': { surface: 'recovery', why: 'D-08: abrir otro proyecto gana ruta desde la mesa, además de la Welcome. Cierra el hueco 2 de CRI-8 §9.2.' },
  'ENT-07': { surface: 'welcome', why: 'Gestión de biblioteca; no compite con el lienzo.' },
  'ENT-08': { surface: 'welcome', why: 'Gestión de biblioteca.' },
  'ENT-09': { surface: 'recovery', why: 'D-08: la restauración deja de vivir sólo en el hub.' },
  'ENT-10': { surface: 'transient', why: 'Import Center es workflow temporal; se invoca desde el menú de documento.' },
  'ENT-11': { surface: 'transient', why: 'D-07/D-08: importar DXF deja de exigir volver a Inicio. Cierra el hueco 3 de CRI-8 §9.2.' },
  'ENT-12': { surface: 'welcome', why: 'Aula no se rediseña aquí; su puerta sigue en la Welcome.' },
  'ENT-13': { surface: 'topbar', why: 'Identidad del documento: una de las tres naturalezas que la TopBar conserva.' },
  'ENT-14': { surface: 'topbar', why: 'Identidad del documento.' },
  'ENT-15': { surface: 'space3d', why: 'D-15: dominio separado.' },

  // — Shell: la TopBar se queda con tres naturalezas de las siete actuales
  'SHL-01': { surface: 'topbar', why: 'Analizar es la acción global por excelencia.' },
  'SHL-02': { surface: 'topbar', why: 'D-03: el estado del análisis sube a chip permanente.' },
  'SHL-03': { surface: 'topbar', why: 'D-09: deshacer nunca vive en un desbordamiento. + G-01 (atajo).' },
  'SHL-04': { surface: 'topbar', why: 'D-09 + G-01.' },
  'SHL-05': { surface: 'palette', why: 'Aceleración; su lanzador se conserva en el rail.' },
  'SHL-06': { surface: 'palette', why: 'Navegación por identificador: ruta de precisión no espacial.' },
  'SHL-07': { surface: 'analysis-setup', why: 'D-09: la combinación viaja junto a los resultados que gobierna, no fija en la TopBar.' },
  'SHL-08': { surface: 'preferences', why: 'D-09: preferencia de sesión; pierde tres de sus cuatro puertas.' },
  'SHL-09': { surface: 'analysis-setup', why: 'D-09: cambia la física del resultado; baja frecuencia no puede significar escondido.' },
  'SHL-10': { surface: 'analysis-setup', why: 'D-09: sale de la triple disclosure del cajón.' },
  'SHL-11': { surface: 'preferences', why: 'D-09.' },
  'SHL-12': { surface: 'preferences', why: 'D-09.' },
  'SHL-13': { surface: 'preferences', why: 'D-09 + D-15: una sola resolución de tema en todo el producto.' },
  'SHL-14': { surface: 'doctor', why: 'D-09: lanzador propio con recuento en las TRES clases; hoy desaparece bajo 1024px (F-06).' },
  'SHL-15': { surface: 'dense', why: 'D-11.' },
  'SHL-16': { surface: 'layout-intent', why: 'D-04: deja de ser una entrada de menú y pasa a ser `dockIntent` del dock de detalle.' },
  'SHL-17': { surface: 'layout-intent', why: 'D-04: `focusCanvas`, único conmutador de enfoque.' },
  'SHL-18': { surface: 'layout-intent', why: 'D-04: `dockIntent` del rail; en Medium ya es el defecto calculado.' },
  'SHL-19': { surface: 'layout-intent', why: 'D-04: el ancho es una intención acotada por el resolutor, no un inline incondicional.' },
  'SHL-20': { surface: 'layout-intent', why: 'D-04: el detent preferido es una intención; su normalización por viewport se conserva.' },
  'SHL-21': { surface: 'topbar', why: 'D-08: además es la puerta a la superficie de recuperación.' },
  'SHL-22': { surface: 'output', why: 'D-09: las 21 afordancias colapsan a una entrada + paleta.' },
  'SHL-23': { surface: 'status', why: 'Canal de estado.' },
  'SHL-24': { surface: 'status', why: 'Aviso de actualización de la PWA.' },

  // — Modelado
  'MOD-01': { surface: 'toolrail', why: 'Crear no puede ser contextual a la selección: es el límite duro del principio Shapr3D.' },
  'MOD-09': { surface: 'contextual-actions', why: 'D-07: borrar deja de costar 3 pasos en táctil.' },
  'MOD-10': { surface: 'contextual-actions', why: 'D-07: ya es el precedente interno (`canEditSelection`).' },
  'MOD-12': { surface: 'contextual-actions', why: 'D-07: Repeat deja de existir sólo bajo la tecla R (U-03).' },
  'MOD-13': { surface: 'contextual-actions', why: 'D-07: copiar/pegar/duplicar gana su primera afordancia visible y su primera ruta táctil.' },
  'MOD-14': { surface: 'toolrail', why: 'Generar crea geometría: no depende de la selección. El código ya lo razona.' },
  'MOD-16': { surface: 'canvas', why: 'El corte vive sobre el lienzo; su precondición (análisis correcto) debe comunicarse por D-14.' },

  // — Selección
  'SEL-06': { surface: 'view', why: 'D-10: el filtro de selección es visibilidad del lienzo, no una preferencia.' },

  // — Lienzo
  'CNV-03': { surface: 'view', why: 'D-10: dueño único de la visibilidad.' },
  'CNV-04': { surface: 'view', why: 'D-10 + P-11: los chips informativos pasan a accionables.' },
  'CNV-09': { surface: 'output', why: 'D-09.' },
  'CNV-10': { surface: 'output', why: 'D-09.' },

  // — Inspector: se parte por dueño
  'INS-05': { surface: 'analysis-setup', why: 'D-02: casos y combinaciones no dependen de la selección; salen del panel de la selección.' },
  'INS-06': { surface: 'view', why: 'D-02 + D-10: los ~20 ajustes de visualización son estado de vista del lienzo.' },
  'INS-07': { surface: 'toolrail', why: 'D-09: cinco lanzadores para tres herramientas; sobrevive el del rail y el dock táctil.' },

  // — Resultados: la descomposición de D-03
  'RES-01': { surface: 'dense', why: 'D-03: el resumen es dato denso invocado.' },
  'RES-02': { surface: 'dense', why: 'D-03: tabla de reacciones.' },
  'RES-03': { surface: 'view', why: 'D-03: elegir N/V/M es elegir capa; el detalle del miembro va a `detail`.' },
  'RES-04': { surface: 'view', why: 'D-03: la deformada es una capa.' },
  'RES-05': { surface: 'view', why: 'D-03: el mapa de demanda es una capa; su valor por objeto va a `detail`.' },
  'RES-06': { surface: 'topbar', why: 'D-03 + D-14: la fiabilidad es la afirmación más crítica; chip permanente + causa invocable enfocable.' },
  'RES-07': { surface: 'dense', why: 'D-03: líneas de influencia piden superficie propia.' },
  'RES-08': { surface: 'dense', why: 'D-03: «Entender» es la vista más larga del panel.' },
  'RES-09': { surface: 'layout-intent', why: 'D-04: el modo y la altura del panel desaparecen con el panel; queda el pin del dock denso.' },
  'RES-10': { surface: 'detail', why: 'D-03: la procedencia se lee junto al objeto y su cursor, no al pie de un panel.' },
  'RES-11': { surface: 'canvas', why: 'Destino del contrato de navegación profunda; `focus-object` se conserva tipado.' },

  // — Datasheet
  'DAT-08': { surface: 'detail', why: 'D-12: el panel editor deja de reimplementar la ficha y aloja la superficie `detail`.' },
  'DAT-10': { surface: 'canvas', why: 'D-11: localizar degrada la tabla a `peek`, no la cierra.' },

  // — Model Doctor
  'DOC-01': { surface: 'doctor', why: 'Superficie propia bien resuelta; sólo cambia su acceso y su umbral.' },
  'DOC-02': { surface: 'doctor', why: 'Filtro dentro de su superficie.' },
  'DOC-03': { surface: 'doctor', why: 'El modelo qué/por qué/qué hacer se generaliza en D-14.' },
  'DOC-04': { surface: 'canvas', why: 'D-11: localizar degrada el Doctor a `peek`.' },
  'DOC-05': { surface: 'transient', why: 'D-13: reparación preparada, nivel A del contrato.' },
  'DOC-06': { surface: 'doctor', why: 'Reconocer un hallazgo.' },
  'DOC-07': { surface: 'contextual-actions', why: 'Saltar del hallazgo a la herramienta que lo arregla.' },

  // — Persistencia
  'PER-03': { surface: 'recovery', why: 'D-08: el hueco de acceso más grave del mapa.' },

  // — Aula y 3D
  'AUL-01': { surface: 'classroom', why: 'Aula no se rediseña; sólo se declara su presentación.' },
  'AUL-02': { surface: 'dense', why: 'Niveles pedagógicos del resultado: dato denso.' },
  'AUL-03': { surface: 'classroom', why: 'Sesión de aula.' },
  'S3D-01': { surface: 'space3d', why: 'D-15.' },
  'S3D-02': { surface: 'space3d', why: 'D-15.' },
};

/** Superficies válidas que no están en el catálogo de composición (son intenciones o pantallas). */
export const PSEUDO_SURFACES = {
  'layout-intent': 'Intención de layout, no superficie: lo consume el resolutor (D-04).',
};

/** Extrae la clase primaria de la cadena `cls` de CRI-8. */
export const primaryClass = (cls) => {
  const trimmed = String(cls).trim();
  if (trimmed.startsWith('Transversal')) return 'T';
  const match = /^([1-9])/.exec(trimmed);
  return match ? match[1] : 'T';
};

/** Ubica una fila de CRI-8. Devuelve superficie, origen de la decisión y motivo. */
export const placeTask = (row) => {
  const override = OVERRIDES[row.id];
  if (override) return { surface: override.surface, source: 'decisión CRI-9', why: override.why };
  const key = primaryClass(row.cls);
  const fallback = CLASS_TO_SURFACE[key];
  return { surface: fallback.surface, source: `regla (clase ${key})`, why: fallback.why };
};
