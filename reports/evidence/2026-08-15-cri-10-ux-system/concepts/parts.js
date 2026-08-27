/* CRI-10 · piezas compartidas de los conceptos.
 *
 * Los conceptos se generan desde datos y no se escriben a mano frame por frame.
 * Eso no es una comodidad: es lo que hace que el zócalo de un miembro y el de
 * una carga salgan del MISMO generador con distinta entrada, que es exactamente
 * lo que la especificación afirma que debe pasar en el producto. Si dos
 * conceptos discrepan, discrepan porque los datos discrepan.
 */

export const ICON = {
  // Trazo 1.8 en todos — Brandbook §11. Hoy conviven 1.8 y 2.0 (F-10).
  _: (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`,
  get select() { return this._('<path d="M4 3l7 17 2.5-7L20 10.5z"/>'); },
  get pan() { return this._('<path d="M9 11V5a1.7 1.7 0 013.4 0v6M12.4 11V4.2a1.7 1.7 0 013.4 0V11M15.8 11.4V6.6a1.7 1.7 0 013.4 0V14a7 7 0 01-7 7h-1a7 7 0 01-6-3.4L4 14.6a1.7 1.7 0 012.6-2.1L9 15"/>'); },
  get node() { return this._('<circle cx="12" cy="12" r="4.2"/><path d="M12 3v3.4M12 17.6V21M3 12h3.4M17.6 12H21"/>'); },
  get member() { return this._('<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M7.9 16.1l8.2-8.2"/>'); },
  get support() { return this._('<path d="M12 4v7M5.5 18.5L12 11l6.5 7.5zM3.5 18.5h17M6 22l1.8-3.5M11 22l1.8-3.5M16 22l1.8-3.5"/>'); },
  get load() { return this._('<path d="M12 3v13"/><path d="M7.5 11.5L12 16.5l4.5-5"/><path d="M4 20.5h16"/>'); },
  get dist() { return this._('<path d="M4 3.5h16M7 6v6M12 6v6M17 6v6"/><path d="M5.4 10.2L7 12.6l1.6-2.4M10.4 10.2L12 12.6l1.6-2.4M15.4 10.2L17 12.6l1.6-2.4"/><path d="M4 16.5h16"/>'); },
  get moment() { return this._('<path d="M20 12a8 8 0 10-3 6.2"/><path d="M20.5 7.5V12H16"/>'); },
  get dim() { return this._('<path d="M4 7v10M20 7v10M4 12h16"/><path d="M7 9.2L4.2 12 7 14.8M17 9.2L19.8 12 17 14.8"/>'); },
  get cut() { return this._('<path d="M12 3v18"/><circle cx="6.5" cy="17.5" r="2.6"/><circle cx="17.5" cy="17.5" r="2.6"/><path d="M8.6 15.9L15.5 5M15.4 15.9L8.5 5"/>'); },
  get gen() { return this._('<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17"/>'); },
  get undo() { return this._('<path d="M3.5 9.5h10a5.5 5.5 0 010 11H8"/><path d="M7 5.5l-3.5 4 3.5 4"/>'); },
  get redo() { return this._('<path d="M20.5 9.5h-10a5.5 5.5 0 000 11H16"/><path d="M17 5.5l3.5 4-3.5 4"/>'); },
  get play() { return this._('<path d="M6.5 4.5l13 7.5-13 7.5z" fill="currentColor" stroke-linejoin="round"/>'); },
  get caret() { return this._('<path d="M6 9l6 6 6-6"/>'); },
  get chev() { return this._('<path d="M9 6l6 6-6 6"/>'); },
  get search() { return this._('<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5l-4.5-4.5"/>'); },
  get layers() { return this._('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>'); },
  get plus() { return this._('<path d="M12 5v14M5 12h14"/>'); },
  get minus() { return this._('<path d="M5 12h14"/>'); },
  get fit() { return this._('<path d="M4 9V4.5h4.5M15.5 4.5H20V9M20 15v4.5h-4.5M8.5 19.5H4V15"/><circle cx="12" cy="12" r="2.4"/>'); },
  get info() { return this._('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.6"/>'); },
  get check() { return this._('<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.6 2.6 5-5.4"/>'); },
  get half() { return this._('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 000 17z" fill="currentColor" stroke="none"/>'); },
  get bang() { return this._('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.2M12 16.1v.5"/>'); },
  get slash() { return this._('<circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/>'); },
  get cross() { return this._('<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>'); },
  get ring() { return this._('<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/>'); },
  get doctor() { return this._('<path d="M12 3l7.5 3v6c0 4.4-3 8.1-7.5 9.4C7.5 20.1 4.5 16.4 4.5 12V6z"/><path d="M12 9v5M9.5 11.5h5"/>'); },
  get table() { return this._('<rect x="3.5" y="4.5" width="17" height="15" rx="1.6"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>'); },
  get target() { return this._('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.6"/><path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22"/>'); },
  get back() { return this._('<path d="M20 12H4.5"/><path d="M10 5.5L3.5 12l6.5 6.5"/>'); },
  get trash() { return this._('<path d="M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 011.3-1.3h2.4a1.3 1.3 0 011.3 1.3v1.7"/><path d="M6.5 6.5l1 13a1.4 1.4 0 001.4 1.3h6.2a1.4 1.4 0 001.4-1.3l1-13"/>'); },
  get copy() { return this._('<rect x="8.5" y="8.5" width="12" height="12" rx="1.8"/><path d="M15.5 5.5H5.2A1.7 1.7 0 003.5 7.2v10.3"/>'); },
  get repeat() { return this._('<path d="M3.5 8.5h13a4 4 0 010 8h-3"/><path d="M6.5 5l-3 3.5 3 3.5"/><path d="M20.5 16.5h-4"/>'); },
  get split() { return this._('<path d="M3.5 12h17"/><path d="M12 5.5v13"/><circle cx="3.8" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="20.2" cy="12" r="1.8" fill="currentColor" stroke="none"/>'); },
  get more() { return this._('<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>'); },
  get grad() { return this._('<path d="M12 3.5L22 8.5 12 13.5 2 8.5z"/><path d="M6 10.8V16c0 1.9 2.7 3.4 6 3.4s6-1.5 6-3.4v-5.2"/>'); },
  get canvasIcon() { return this._('<rect x="3.5" y="4.5" width="17" height="15" rx="1.8"/><path d="M3.5 15l4.5-4.5 3.5 3.5 3-3 6 6"/>'); },
  get sliders() { return this._('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>'); },
  get cloud() { return this._('<path d="M7 18.5a4.3 4.3 0 01-.6-8.56 5.5 5.5 0 0110.6-1.8A4.2 4.2 0 0117.5 18.5z"/>'); },
  get cloudCheck() { return this._('<path d="M7 17.5a4.3 4.3 0 01-.6-8.56 5.5 5.5 0 0110.6-1.8A4.2 4.2 0 0117.5 17.5z"/>', '<path d="M9.3 13.3l1.9 1.9 3.5-3.9"/>'); },

  /* Welcome — trazados con la geometría real de lucide-react (única fuente
     de iconos del proyecto, ya en package.json), redibujados a mano a
     stroke-width 1.8 para casar con el resto de esta hoja (Brandbook §11).
     Origen exacto de cada `d`, coordenada por coordenada:
     node_modules/lucide-react/dist/esm/icons/{compass,folder-open,upload,
     cpu,move-3d,rotate-ccw,pencil,folder-clock,triangle,
     git-commit-horizontal,sparkles}.mjs — MIT License, Lucide contributors. */
  get compass() { return this._('<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>'); },
  get folderOpen() { return this._('<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'); },
  get upload() { return this._('<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'); },
  get cpu() { return this._('<path d="M12 20v2M12 2v2M17 20v2M17 2v2M2 12h2M2 17h2M2 7h2M20 12h2M20 17h2M20 7h2M7 20v2M7 2v2"/><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>'); },
  get cube3d() { return this._('<path d="M5 3v16h16"/><path d="m5 19 6-6"/><path d="m2 6 3-3 3 3"/><path d="m18 16 3 3-3 3"/>'); },
  get restore() { return this._('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'); },
  get pencil() { return this._('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>'); },
  get folderClock() { return this._('<path d="M16 14v2.2l1.6 1"/><path d="M7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2"/><circle cx="16" cy="16" r="6"/>'); },
  get triangleShape() { return this._('<path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>'); },
  get commitH() { return this._('<circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/>'); },
  get sparkles() { return this._('<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4M22 4h-4"/><circle cx="4" cy="20" r="2"/>'); },
  get sun() { return this._('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'); },
  get moon() { return this._('<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401Z"/>'); },
  get menu() { return this._('<path d="M4 5h16M4 12h16M4 19h16"/>'); },
};

/**
 * Cinta. Tres naturalezas y sólo tres — pero cada naturaleza tiene más de un
 * control, y CADA UNO necesita una puerta visible propia. La corrección de
 * discoverability de esta pasada toca esta función porque las 22 láminas la
 * comparten: arreglarla aquí las corrige a todas a la vez.
 *
 * Cuatro cambios sobre la versión anterior, cada uno cierra un hallazgo de la
 * revisión (ver `reports/2026-08-15-XXXX-cri-10-correccion-discoverability.md`):
 *
 *  1. `persist` — la sesión ya no tiene dónde vivir. PER-01/02/03 (guardado,
 *     sin conexión, conflicto) no tenían ningún control en la Cinta anterior.
 *  2. Model Doctor **ya no depende de `doctor > 0`**. Antes el lanzador sólo
 *     se pintaba con hallazgos — con 0 hallazgos (el caso más común al
 *     empezar a modelar) la herramienta de diagnóstico completa desaparecía
 *     de la interfaz. Ahora es permanente y el recuento es un badge que se
 *     superpone, nunca una condición de existencia.
 *  3. El caret suelto junto a «Resolver» se sustituye por un control
 *     ETIQUETADO con el nombre de la combinación activa. Es la puerta a
 *     `analysis-setup` (SHL-07/08/09/10) y antes era indistinguible de
 *     cualquier otro icono de la Cinta.
 *  4. El menú de documento (`doc__menu`) se declara explícito: antes era un
 *     caret sin más contenido que un rótulo genérico.
 *  5. **El lanzador de la Hoja de datos (Datasheet) vuelve a ser permanente.**
 *     La primera pasada no le dio ningún lugar en la Cinta — sólo quedaba
 *     alcanzable por `Ctrl+K` o por el verbo «Fila en tabla» del zócalo, que
 *     exige selección. Hoy el icono de Datasheet **no se oculta ni en
 *     Compact** (a diferencia de Model Doctor, que sí lo hacía — F-06). Se
 *     restaura al mismo nivel que Doctor. Su coste de ancho en Compact se
 *     verifica en `render-concepts.mjs` (paso 3, comprobación de
 *     desbordamiento): si no cupiera en 320-360px, el orden de degradación
 *     es compartir un solo disparador «Diagnóstico y datos» que despliega
 *     los dos — pero **no se asume sin medir**.
 */
export const cinta = ({ estado, compact = false, doctor = 0, persist = 'guardado', context = 'Servicio 1', name = 'Pórtico de ejemplo' } = {}) => `
<header class="cinta">
  <div class="mark">S</div>
  <div class="doc">
    <span class="doc__name">${name}</span>
    <button class="ib ib--ghost doc__menu" aria-haspopup="menu" aria-label="Menú del documento">${ICON.caret}</button>
  </div>
  ${persistChip(persist, compact)}
  ${compact ? '' : `<button class="ib">${ICON.undo}</button><button class="ib" data-state="disabled">${ICON.redo}</button>`}
  <div class="cinta__spacer"></div>
  ${compact ? '' : `<span class="aviso">${ICON.info} Herramienta de apoyo</span>`}
  <button class="ib" aria-label="Hoja de datos">${ICON.table}</button>
  <button class="ib doctor-launcher" aria-label="Model Doctor${doctor > 0 ? ` · ${doctor} hallazgos` : ''}">
    ${ICON.doctor}${doctor > 0 ? `<i class="badge-count">${doctor}</i>` : ''}
  </button>
  ${estado ? estadoChip(estado, compact) : ''}
  <div class="resolver">
    <button class="resolver__go">${ICON.play}${compact ? '' : ' Resolver'}</button>
    ${compact ? '' : `<button class="resolver__ctx" aria-haspopup="dialog" aria-label="Contexto de análisis — combinación activa ${context}">${context} ${ICON.caret}</button>`}
  </div>
</header>`;

/** Chip de estado: forma + color + palabra. Nunca sólo color, nunca sólo title. */
export const ESTADOS = {
  sin:      { cls: 'sin',      icon: 'ring',  t: 'Sin analizar',  s: 'El modelo no se ha resuelto' },
  calc:     { cls: 'calc',     icon: 'ring',  t: 'Resolviendo…',  s: 'Iteración 2 de 3' },
  resuelto: { cls: 'resuelto', icon: 'check', t: 'Resuelto',      s: 'Convergió en 3 iteraciones' },
  limitado: { cls: 'limitado', icon: 'half',  t: 'Lectura limitada', s: 'Cortante sin deformación por corte' },
  nofiable: { cls: 'nofiable', icon: 'bang',  t: 'No fiable',     s: 'Rigidez casi singular en N3' },
  obsoleto: { cls: 'obsoleto', icon: 'slash', t: 'Modelo cambiado', s: 'No hay resultado vigente' },
  fallido:  { cls: 'fallido',  icon: 'cross', t: 'No se pudo resolver', s: 'Mecanismo: faltan apoyos' },
};
export const estadoChip = (key, compact = false) => {
  const e = ESTADOS[key];
  return `<button class="estado estado--${e.cls}">
    <span class="estado__glyph">${ICON[e.icon]}</span>
    ${compact ? '' : `<span class="estado__copy">${e.t}<small>${e.s}</small></span>`}
  </button>`;
};

/**
 * Chip de persistencia — PER-01/02/03. No existía ningún control equivalente
 * en la primera pasada de esta especificación: el guardado automático, el
 * trabajo sin conexión y el conflicto de revisión no tenían dónde vivir en la
 * Cinta. Vive junto a la identidad del documento porque es un hecho sobre
 * ESTE documento, no sobre el análisis — por eso está a la izquierda y el
 * chip de estado del análisis está a la derecha.
 */
export const PERSIST = {
  guardado:  { cls: 'ok',   icon: 'cloudCheck', t: 'Guardado' },
  guardando: { cls: 'busy', icon: 'cloud',      t: 'Guardando…' },
  sinred:    { cls: 'busy', icon: 'cloud',      t: 'Sin conexión · guardado local' },
  conflicto: { cls: 'bad',  icon: 'bang',       t: 'Conflicto de revisión' },
};
export const persistChip = (key, compact = false) => {
  const p = PERSIST[key];
  return `<button class="persist persist--${p.cls}" aria-label="${p.t}" aria-haspopup="${key === 'conflicto' ? 'dialog' : 'false'}">
    <span class="persist__glyph">${ICON[p.icon]}</span>
    ${compact ? '' : `<span class="persist__copy">${p.t}</span>`}
  </button>`;
};

const TOOLS = [
  { g: 'Navegar', items: [
    { id: 'select', n: 'Seleccionar', k: 'V', c: '' },
    { id: 'pan', n: 'Desplazar', k: 'H', c: '' },
  ] },
  { g: 'Crear', items: [
    { id: 'node', n: 'Nudo', k: 'N', c: 'structure' },
    { id: 'member', n: 'Miembro', k: 'M', c: 'structure' },
    { id: 'support', n: 'Apoyo', k: 'S', c: 'structure' },
    { id: 'gen', n: 'Generar', k: 'G', c: 'structure' },
  ] },
  { g: 'Cargar', items: [
    { id: 'load', n: 'Puntual', k: 'P', c: 'load' },
    { id: 'dist', n: 'Distribuida', k: 'D', c: 'dist' },
    { id: 'moment', n: 'Momento', k: 'O', c: 'moment' },
  ] },
  { g: 'Anotar', items: [
    { id: 'dim', n: 'Cota', k: 'C', c: 'dim' },
    { id: 'cut', n: 'Corte', k: 'X', c: 'cut' },
  ] },
];

/**
 * Riel. Sólo herramientas — la paleta, el generador y «editar selección» salen
 * de aquí (van a `Ctrl+K`, a Crear y al zócalo respectivamente).
 * Los rótulos caben: «Distribuida», no «Carga distribui…».
 */
export const riel = (active = 'select') => `
<nav class="riel">
  ${TOOLS.map((group) => `
    <div class="riel__group">
      <h4>${group.g}</h4>
      ${group.items.map((tool) => `
        <button class="tool tool--${tool.c || 'nav'} ${tool.id === active ? 'is-active' : ''}" aria-label="${tool.n}">
          <span class="tool__icon">${ICON[tool.id]}</span>
          <span class="tool__name">${tool.n}</span>
          <kbd>${tool.k}</kbd>
        </button>`).join('')}
    </div>`).join('')}
</nav>`;

/**
 * Los tres grupos flotantes. Nada flotante fuera de estos tres.
 *
 * `compact` NO es una variante estética: es la degradación declarada de CB-3
 * ejecutándose. Cuando el lienzo se estrecha, los chips accionables se pliegan
 * dentro del disparador de capas y la lectura de coordenadas desaparece — en
 * ese orden, y antes de tocar los controles de cámara o el estado, que no se
 * degradan nunca. Sin esta regla los grupos se solapan, que es exactamente lo
 * que CRI-7 midió (17.5% de chrome flotante en 1024×768).
 *
 * Dos correcciones de discoverability sobre la versión anterior:
 *
 *  1. **El disparador de capas lleva un badge cuando algo se ha plegado
 *     dentro de él.** Antes SNAP/Rejilla desaparecían sin más en Compact: el
 *     usuario no tenía ninguna señal de que seguían existiendo un nivel más
 *     abajo. Un badge sin número («•») basta — no es un recuento, es «hay
 *     más aquí».
 *  2. **`globalScope` añade «Vista global»** al chip de modo cuando hay un
 *     resultado vigente y NO hay selección. Es el equivalente visible de lo
 *     que hoy dice `results.contextGlobal` en el «Centro analítico» del
 *     panel de Results — un concepto real que la descomposición de Results
 *     (D-03) no puede permitirse perder sólo por dejar de tener panel.
 */
export const flotantes = ({ modo = 'Seleccionar', hint = 'toca un objeto', capa = null, compact = false, globalScope = false } = {}) => `
<div class="flot flot--modo">
  <span class="chip">${ICON.select} ${modo} <small>· ${hint}</small></span>
  ${capa ? `<span class="chip chip--on"><i class="chip__dot" style="--cc:${capa.c}"></i> ${capa.t}${globalScope ? ' <small>· vista global</small>' : ''}</span>` : ''}
</div>
<div class="flot flot--vista">
  ${compact ? '' : '<span class="chip chip--on">SNAP</span><span class="chip">Rejilla</span>'}
  <button class="ib" style="position:relative">${ICON.layers}${compact ? '<i class="badge-dot"></i>' : ''}</button>
</div>
<div class="flot flot--camara">
  ${compact ? '' : '<span class="chip lectura">X 4.00 · Y 2.60 m</span>'}
  <span class="camara">
    <button>${ICON.plus}</button><button>${ICON.minus}</button><button>${ICON.fit}</button>
  </span>
</div>`;

/**
 * El pórtico de ejemplo. `box` es el viewBox en unidades de lienzo.
 * Todo trazo lleva 1.8–2.2; ninguna sombra. Plano, como pide el Brandbook §02.
 */
export const portico = ({ w, h, sel = null, layer = null, labels = 'auto' } = {}) => {
  const L = 6, H = 4;                              // metros
  const pad = { l: 0.18, r: 0.18, t: 0.30, b: 0.22 };
  const sx = w * (1 - pad.l - pad.r) / L;
  const sy = h * (1 - pad.t - pad.b) / H;
  const s = Math.min(sx, sy);
  const ox = (w - L * s) / 2;
  const oy = h - h * pad.b;
  const X = (m) => ox + m * s;
  const Y = (m) => oy - m * s;

  const N = { N1: [0, 0], N2: [L, 0], N3: [0, H], N4: [L, H] };
  const memberStroke = (id) => (sel === id ? 'var(--sc-color-selection-stroke)' : 'var(--sc-color-canvas-member)');
  const memberWidth = (id) => (sel === id ? 3.4 : 2.2);

  // Diagrama de momento: parábola sobre el dintel + tramos rectos en pilares.
  const momentPath = () => {
    const pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24;
      const x = t * L;
      const m = -31.15 + (36.35 + 31.15) * (4 * t * (1 - t));   // forma, no cálculo
      pts.push(`${X(x)},${Y(H) - m * 1.05}`);
    }
    return `M${X(0)},${Y(H)} L${pts.join(' L')} L${X(L)},${Y(H)} Z`;
  };
  const shearPath = () => {
    const pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24;
      const v = 45 * (1 - 2 * t);
      pts.push(`${X(t * L)},${Y(H) - v * 0.8}`);
    }
    return `M${X(0)},${Y(H)} L${pts.join(' L')} L${X(L)},${Y(H)} Z`;
  };
  const axialPath = () => `M${X(0)},${Y(0)} L${X(0) - 26},${Y(0)} L${X(0) - 26},${Y(H)} L${X(0)},${Y(H)} Z
                            M${X(L)},${Y(0)} L${X(L) + 26},${Y(0)} L${X(L) + 26},${Y(H)} L${X(L)},${Y(H)} Z`;
  const deformedPath = () => {
    const pts = [];
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      pts.push(`${X(t * L)},${Y(H) + 26 * Math.sin(Math.PI * t)}`);
    }
    return `M${X(0) - 9},${Y(0)} Q${X(0) - 13},${Y(H / 2)} ${X(0) - 2},${Y(H)} L${pts.join(' L')} Q${X(L) + 13},${Y(H / 2)} ${X(L) + 9},${Y(0)}`;
  };

  const LAYER = {
    M: `<path d="${momentPath()}" fill="color-mix(in srgb, var(--sc-color-technical-moment) 13%, transparent)" stroke="var(--sc-color-technical-moment)" stroke-width="1.8" stroke-linejoin="round"/>`,
    V: `<path d="${shearPath()}" fill="color-mix(in srgb, var(--sc-color-technical-shear) 13%, transparent)" stroke="var(--sc-color-technical-shear)" stroke-width="1.8" stroke-linejoin="round"/>`,
    N: `<path d="${axialPath()}" fill="color-mix(in srgb, var(--sc-color-technical-axial) 13%, transparent)" stroke="var(--sc-color-technical-axial)" stroke-width="1.8" stroke-linejoin="round"/>`,
    d: `<path d="${deformedPath()}" fill="none" stroke="var(--sc-color-technical-deformed)" stroke-width="2.2" stroke-dasharray="6 4" stroke-linecap="round"/>`,
  };

  const showLoads = labels !== 'none' && !layer;
  // Dimensiones EXPLÍCITAS y sin `preserveAspectRatio="none"`.
  // Estirar el viewBox al contenedor convertía los nudos en elipses y los
  // apoyos en triángulos escalenos: un dibujo estructural deformado no es un
  // concepto, es un error de lectura. El SVG mide lo que dice medir y se ancla
  // arriba-izquierda del lienzo.
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--sc-color-technical-load)"/>
    </marker>
    <marker id="ad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--sc-color-technical-shear)"/>
    </marker>
    <marker id="are" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--sc-color-technical-reaction)"/>
    </marker>
  </defs>

  ${layer ? LAYER[layer] ?? '' : ''}

  <!-- Halo de selección: va DEBAJO del trazo técnico y aparte de él, nunca
       engordándolo. Es la misma disciplina que el producto ya aplica con
       «member-hit» — el área y la señal viven alrededor del dibujo, no dentro. -->
  ${sel === 'B3' ? `<path d="M${X(0)},${Y(H)} L${X(L)},${Y(H)}" stroke="var(--sc-color-selection-stroke)" stroke-width="11" stroke-linecap="round" opacity="0.22"/>` : ''}

  <!-- Barras. B3 es el dintel. -->
  <path d="M${X(0)},${Y(0)} L${X(0)},${Y(H)}" stroke="${memberStroke('B1')}" stroke-width="${memberWidth('B1')}" stroke-linecap="round"/>
  <path d="M${X(L)},${Y(0)} L${X(L)},${Y(H)}" stroke="${memberStroke('B2')}" stroke-width="${memberWidth('B2')}" stroke-linecap="round"/>
  <path d="M${X(0)},${Y(H)} L${X(L)},${Y(H)}" stroke="${memberStroke('B3')}" stroke-width="${memberWidth('B3')}" stroke-linecap="round"/>

  ${showLoads ? `
  <!-- Repartida sobre el dintel -->
  <path d="M${X(0)},${Y(H) - 34} L${X(L)},${Y(H) - 34}" stroke="var(--sc-color-technical-shear)" stroke-width="1.8"/>
  ${[0.1, 0.26, 0.42, 0.58, 0.74, 0.9].map((t) => `<path d="M${X(t * L)},${Y(H) - 33} L${X(t * L)},${Y(H) - 7}" stroke="var(--sc-color-technical-shear)" stroke-width="1.6" marker-end="url(#ad)"/>`).join('')}
  <!-- Puntuales en las esquinas -->
  <path d="M${X(0)},${Y(H) - 62} L${X(0)},${Y(H) - 9}" stroke="var(--sc-color-technical-load)" stroke-width="2.2" marker-end="url(#ar)"/>
  <path d="M${X(L)},${Y(H) - 62} L${X(L)},${Y(H) - 9}" stroke="var(--sc-color-technical-load)" stroke-width="2.2" marker-end="url(#ar)"/>` : ''}

  ${layer ? `
  <path d="M${X(0)},${Y(0) + 9} L${X(0)},${Y(0) + 52}" stroke="var(--sc-color-technical-reaction)" stroke-width="2" marker-start="url(#are)"/>
  <path d="M${X(L)},${Y(0) + 9} L${X(L)},${Y(0) + 52}" stroke="var(--sc-color-technical-reaction)" stroke-width="2" marker-start="url(#are)"/>` : ''}

  <!-- Apoyos -->
  <g transform="translate(${X(0) - 16},${Y(0)})"><use href="#sup-pin" width="32" height="22"/></g>
  <g transform="translate(${X(L) - 16},${Y(0)})"><use href="#sup-pin" width="32" height="22"/></g>

  <!-- Nudos. El halo de selección es un anillo aparte: no engorda el trazo. -->
  ${Object.entries(N).map(([id, [mx, my]]) => `
    ${sel === id ? `<circle cx="${X(mx)}" cy="${Y(my)}" r="11" fill="none" stroke="var(--sc-color-selection-stroke)" stroke-width="2.4"/>` : ''}
    <circle cx="${X(mx)}" cy="${Y(my)}" r="5" fill="var(--sc-color-canvas-node-fill)" stroke="${sel === id ? 'var(--sc-color-selection-stroke)' : 'var(--sc-color-canvas-member)'}" stroke-width="1.8"/>`).join('')}

</svg>`;
};

/** Miniatura: el objeto y su entorno inmediato. Pulsarla encuadra. */
export const mini = (sel) => `<div class="mini">${portico({ w: 272, h: 92, sel, labels: 'none' })}</div>`;

/**
 * Zócalo de selección: los verbos vienen al objeto.
 *
 * `overflow` abre el panel del `⋯` con los verbos secundarios visibles. La
 * primera pasada de esta especificación nunca mostraba este estado en
 * ninguna lámina: Copiar, Pegar, Duplicar y Repetir existían en el texto
 * (§6.4) pero no en una sola imagen, que es exactamente el motivo por el que
 * una revisión visual los siente «desaparecidos» aunque estén especificados.
 */
export const zocalo = ({ x, y, id, glyph, verbs, danger = true, overflow = null }) => `
<div class="zocalo" style="left:${x}px; top:${y}px">
  <span class="zocalo__id">${ICON[glyph]} ${id}</span>
  ${verbs.map((v) => `<button class="zac">${v.i ? ICON[v.i] : ''} ${v.t}</button>`).join('')}
  <span class="zocalo__sep"></span>
  ${danger ? `<button class="zac zac--danger">${ICON.trash}</button>` : ''}
  <button class="zac ${overflow ? 'is-open' : ''}" aria-expanded="${overflow ? 'true' : 'false'}" aria-haspopup="menu">${ICON.more}</button>
  ${overflow ? `<div class="zocalo-overflow" role="menu">
    ${overflow.map((v) => `<button class="zoc-item" role="menuitem">${ICON[v.i]}<span>${v.t}</span>${v.k ? `<kbd>${v.k}</kbd>` : ''}</button>`).join('')}
  </div>` : ''}
</div>`;

/**
 * Contenido del menú de documento — antes un caret sin inventario declarado.
 * Ocho entradas, cada una trazable a una tarea de CRI-8: cierra los huecos
 * de acceso #2 (cambiar de proyecto) y #3 (importar DXF) que CRI-8 §9.2
 * marcó como graves, y da a la paleta de comandos la puerta táctil que el
 * texto de §12 ya prometía pero el menú no tenía escrita.
 */
export const docMenu = () => `
<div class="docmenu" role="menu">
  <button class="docmenu__i" role="menuitem">${ICON.member}<span>Renombrar proyecto</span></button>
  <button class="docmenu__i" role="menuitem">${ICON.table}<span>Cambiar de proyecto…</span><small>Project Hub</small></button>
  <button class="docmenu__i" role="menuitem">${ICON.copy}<span>Duplicar proyecto</span></button>
  <div class="docmenu__sep"></div>
  <button class="docmenu__i" role="menuitem">${ICON.canvasIcon}<span>Importar…</span><small>DXF · JSON · PDF</small></button>
  <button class="docmenu__i" role="menuitem">${ICON.table}<span>Exportar…</span><small>PDF · imagen · impresión</small></button>
  <div class="docmenu__sep"></div>
  <button class="docmenu__i" role="menuitem">${ICON.search}<span>Buscar comandos…</span><kbd>Ctrl K</kbd></button>
  <button class="docmenu__i" role="menuitem">${ICON.sliders}<span>Preferencias</span><small>Unidades · idioma · tema · modo</small></button>
  <div class="docmenu__sep"></div>
  <button class="docmenu__i" role="menuitem">${ICON.grad}<span>Space 3D</span><small>Experimental</small></button>
  <button class="docmenu__i" role="menuitem">${ICON.back}<span>Volver a Inicio</span></button>
</div>`;

/**
 * Enlaces a `dense` desde el pie de los resultados del Detalle. Es la
 * corrección directa de un hueco real: en la primera pasada, `dense`
 * (reacciones, influencia, aprender) no tenía NINGÚN lanzador visible — sólo
 * existía como destino conceptual en el texto de §9.2. Sin selección, además,
 * no había ninguna ruta a él en absoluto (ver `estadoQuickLinks`).
 */
export const denseLinks = () => `
<div class="dense-links">
  <button class="dl-item">${ICON.table} Reacciones</button>
  <button class="dl-item">${ICON.split} Influencia</button>
  <button class="dl-item">${ICON.grad} Aprender</button>
</div>`;

/**
 * Panel de enlaces rápidos del chip de estado, EXPANDIDO. Además de la causa
 * (D-14, ya cubierta), el chip de estado es la única superficie PERMANENTE
 * que sigue viva cuando no hay selección — así que es también donde vive el
 * equivalente de «Centro analítico · Vista global» de hoy: sin él, un
 * resultado resuelto sin selección no tenía ninguna puerta a Reacciones,
 * Índice elástico o Aprender.
 */
export const estadoQuickLinks = () => `
<div class="estado-panel">
  <div class="estado-panel__h">${ICON.check} Resuelto · Vista global <small>· sin selección, se muestra el modelo completo</small></div>
  <div class="estado-panel__links">
    <button class="dl-item">${ICON.table} Reacciones</button>
    <button class="dl-item">${ICON.sliders} Índice elástico</button>
    <button class="dl-item">${ICON.grad} Aprender</button>
  </div>
</div>`;

/**
 * Contenido de la superficie `view` invocada — antes descrita sólo como
 * «dueño único de la visibilidad», sin estructura. Se itemiza aquí: capas del
 * lienzo, snap, y el filtro de selección (SEL-06), que CRI-8 §9.1 nombró
 * como la tercera función más escondida del producto actual.
 */
export const viewPanel = () => `
<div class="view-panel">
  <div class="view-panel__sect">
    <h5>Capas del lienzo</h5>
    <div class="view-rows">
      ${[['node', 'Nudos', true], ['member', 'Miembros', true], ['load', 'Cargas', true], ['dim', 'Cotas', false], ['grad', 'Ejes', false]]
        .map(([i, t, on]) => `<label class="view-row"><span>${ICON[i]} ${t}</span><span class="mini-switch ${on ? 'is-on' : ''}"><i></i></span></label>`).join('')}
    </div>
  </div>
  <div class="view-panel__sect">
    <h5>Snap</h5>
    <div class="view-rows">
      ${[['Rejilla', true], ['Nudos', true], ['Puntos medios', true], ['Intersecciones', false], ['Perpendicular', false]]
        .map(([t, on]) => `<label class="view-row"><span>${t}</span><span class="mini-switch ${on ? 'is-on' : ''}"><i></i></span></label>`).join('')}
    </div>
  </div>
  <div class="view-panel__sect">
    <h5>Precisión CAD</h5>
    <div class="view-rows">
      <label class="view-row"><span>Filtro de selección — sólo miembros</span><span class="mini-switch is-on"><i></i></span></label>
    </div>
    <p class="view-panel__hint">Un objeto no seleccionable se atenúa en el lienzo; no desaparece.</p>
  </div>
</div>`;

export const prow = (k, sub, control) => `
<div class="prow">
  <span class="prow__k"><strong>${k}</strong>${sub ? `<small>${sub}</small>` : ''}</span>
  ${control}
</div>`;
export const fieldNum = (v, u) => `<span class="field"><span class="val">${v}</span><span class="unit">${u}</span></span>`;
export const fieldSel = (v) => `<span class="field field--select"><span class="val">${v}</span></span>`;
export const fieldMix = () => `<span class="field field--mixed"><span class="val">mixto</span></span>`;
export const metric = (cls, label, value, unit, detail = '') => `
<div class="metric metric--${cls}">
  <span>${label}</span>
  <strong>${value}<small>${unit}</small></strong>
  ${detail ? `<span style="color:var(--sc-color-text-muted);font-size:11px">${detail}</span>` : ''}
</div>`;

/* ===================================================================== */
/* EVOLUCIÓN CRI-10 — piezas nuevas de esta pasada                        */
/*                                                                         */
/* Recuperan el patrón de tabs agrupados por familia + tarjetas técnicas   */
/* del `ResultsPanel` real (verificado en `src/features/results/`), pero   */
/* como contenido de la superficie `dense` INVOCADA — nunca como panel     */
/* residente. Las familias y sus tabs son las cinco reales de              */
/* `resultFamilies` en `ResultsPanel.tsx:43-48`, no inventadas:            */
/*   Estado (Resumen · Reacciones) · Fuerzas (Axial · Cortante · Momento)  */
/*   Forma (Deformada) · Avanzado (Influencia) · Entender (Aprender)       */
/* ===================================================================== */

/** Línea de contexto — el contrato de §6 del informe de evolución: objeto
 *  (o alcance) · evidencia · caso, siempre en ese orden, siempre compacta. */
export const contextLine = (parts) => `<div class="ctxline">${parts.map((p, i) => `<span class="ctxline__seg ${i === 0 ? 'is-primary' : ''}">${p}</span>`).join('<span class="ctxline__sep">·</span>')}</div>`;

/**
 * Nav de tabs agrupados por familia. `active` es el id del tab activo.
 * Estructura y colores verificados contra `ResultsPanel.tsx:29-48`: sólo
 * Fuerzas y Avanzado llevan color técnico en el tab; Forma (Deformada) se
 * lee por el color de sus tarjetas y de la capa, no por el tab.
 */
const RESULT_FAMILIES = [
  { id: 'state', label: 'Estado', tabs: [{ id: 'summary', label: 'Resumen' }, { id: 'reactions', label: 'Reacciones' }] },
  { id: 'forces', label: 'Fuerzas', tabs: [
    { id: 'axial', label: 'Axial', color: 'var(--sc-color-technical-axial)' },
    { id: 'shear', label: 'Cortante', color: 'var(--sc-color-technical-shear)' },
    { id: 'moment', label: 'Momento', color: 'var(--sc-color-technical-moment)' },
  ] },
  { id: 'shape', label: 'Forma', tabs: [{ id: 'deformed', label: 'Deformada', color: 'var(--sc-color-technical-deformed)' }] },
  { id: 'advanced', label: 'Avanzado', tabs: [{ id: 'influence', label: 'Influencia', color: 'var(--sc-color-technical-shear)' }] },
  { id: 'understand', label: 'Entender', tabs: [{ id: 'learn', label: 'Aprender' }] },
];
export const resultTabs = (active, { compact: _compact = false } = {}) => `
<nav class="rtabs" role="tablist" aria-label="Resultados">
  ${RESULT_FAMILIES.map((fam) => `
    <div class="rtabs__fam" role="presentation">
      <span class="rtabs__famlabel">${fam.label}</span>
      <div class="rtabs__group" role="presentation">
        ${fam.tabs.map((tab) => `<button class="rtabs__tab ${tab.id === active ? 'is-active' : ''}" role="tab" aria-selected="${tab.id === active}" style="--tabc:${tab.color ?? 'var(--sc-color-text-primary)'}">${tab.label}</button>`).join('')}
      </div>
    </div>`).join('')}
</nav>`;

/**
 * Curva de diagrama simplificada + cursor — representa la forma, no el
 * cálculo. `shape` es 'sag' (parábola, para M/δ) o 'step' (escalón, para V).
 */
export const diagramCurve = (color, shape = 'sag', w = 560, h = 140) => {
  const path = shape === 'sag'
    ? `M8,${h - 20} Q${w / 2},20 ${w - 8},${h - 20}`
    : `M8,${h - 20} L${w * 0.42},${h - 20} L${w * 0.42},28 L${w * 0.58},28 L${w * 0.58},${h - 40} L${w - 8},${h - 40}`;
  return `<svg class="dcurve" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <line x1="8" y1="${h - 20}" x2="${w - 8}" y2="${h - 20}" stroke="var(--sc-color-border)" stroke-width="1"/>
    <path d="${path} L${w - 8},${h - 20} L8,${h - 20} Z" fill="color-mix(in srgb, ${color} 12%, transparent)" stroke="none"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
    <circle cx="${w * 0.5}" cy="${shape === 'sag' ? 20 : 28}" r="4" fill="${color}"/>
  </svg>`;
};

/** Tarjeta de máximo/mínimo — objeto, posición y unidad, siempre juntos.
 *  Verificado contra `memberResult.maxMoment/minMoment` + `criticalPoints`
 *  (`ResultsPanel.tsx:635-698`): la posición y el objeto ya viajan con el
 *  valor en el modelo de datos real; la tarjeta no inventa ese vínculo. */
export const maxMinCard = (color, label, obj, maxV, minV, unit, maxX, minX) => `
<div class="mmcard" style="--mmc:${color}">
  <div class="mmcard__h">${label} <span class="mmcard__obj">${obj}</span></div>
  <div class="mmcard__row">
    <div class="mmcard__v"><span>Máx.</span><strong>${maxV}<small>${unit}</small></strong><small>x = ${maxX}</small></div>
    <div class="mmcard__v"><span>Mín.</span><strong>${minV}<small>${unit}</small></strong><small>x = ${minX}</small></div>
  </div>
</div>`;

/** Segmentado Esencial/Completa — la hipótesis de §5, nunca una app distinta. */
export const densityToggle = (active) => `
<div class="denstoggle" role="radiogroup" aria-label="Densidad de la interfaz">
  ${['Esencial', 'Completa'].map((t) => `<button class="denstoggle__i ${t === active ? 'is-active' : ''}" role="radio" aria-checked="${t === active}">${t}</button>`).join('')}
</div>`;

/** Anillo de atención — se aplica a un control ya existente cuando pasa de
 *  silencioso a requerir atención. No es un componente nuevo: es un estado
 *  de los que ya existen (`.persist`, `.estado`, `.doctor-launcher`). */
export const ATTENTION_RING = 'attn-ring';
