/* CRI-10 · los conceptos. Cada lámina representa una tarea REAL del producto,
 * verificada contra la evidencia de CRI-7 y contra el árbol actual. Ninguna
 * pantalla existe para enseñar estilo.
 */
import { ICON, cinta, estadoChip, riel, flotantes, portico, mini, zocalo, prow, fieldNum, fieldSel, metric, docMenu, denseLinks, estadoQuickLinks, viewPanel, contextLine, resultTabs, diagramCurve, maxMinCard, densityToggle, persistChip, ATTENTION_RING } from './parts.js';
import { porticoHero } from './portico3d.js';

const F = [];
/** @param spec {name,w,h,caption,theme,cls,rail,input,body} */
const frame = (spec) => F.push(spec);

const CAPA = {
  M: { c: 'var(--sc-color-technical-moment)', t: 'M · Momento' },
  V: { c: 'var(--sc-color-technical-shear)', t: 'V · Cortante' },
  N: { c: 'var(--sc-color-technical-axial)', t: 'N · Axial' },
  d: { c: 'var(--sc-color-technical-deformed)', t: 'δ · Deformada' },
};

/* ------------------------------------------------------------------ */
/* 01 · ENTRADA — tercera pasada: rediseño total.                       */
/*                                                                      */
/* La entrada deja de ser UNA pantalla larga y pasa a ser un FLUJO de    */
/* hojas, como una app nativa. Tres pasos cortos para quien llega por    */
/* primera vez, y acceso directo a la Mesa para quien ya tiene trabajo   */
/* — nadie repite el onboarding.                                        */
/*                                                                      */
/*   Paso 1 · Bienvenida    → identidad + pórtico clay material          */
/*   Paso 2 · Cómo trabajas → aterriza Esencial/Completa como ELECCIÓN   */
/*   Paso 3 · Por dónde     → lista agrupada con los cinco arranques     */
/*   Mesa                   → el destino, y la entrada de quien vuelve   */
/*                                                                      */
/* El titular anterior («Analiza estructuras con claridad») se retira:   */
/* describía la categoría, no el producto, y podía firmarlo cualquier    */
/* competidor. El nuevo — «Tu mesa de cálculo» — nombra la dirección de  */
/* producto ya cerrada («la mesa y el instrumento») y habla de posesión, */
/* no de promesa genérica.                                              */
/* ------------------------------------------------------------------ */

const RECENT_PROJECT = { t: 'Nave industrial · pórtico tipo', nudos: '18 nudos', barras: '22 barras', when: 'editado ayer' };

const RECIENTES = [
  { t: 'Viga continua 3 vanos', rev: 'rev. 6', s: 'hace 3 días · 4 nudos' },
  { t: 'Celosía Pratt L=12 m', rev: 'rev. 2', s: 'hace 6 días · 21 nudos' },
];

const PLANTILLAS = [
  { n: 'Pórtico de ejemplo', d: 'Dos crujías, apoyos fijos — el modelo de referencia de todas las láminas.', cat: 'Pórticos', badge: 'frame', icon: 'layers' },
  { n: 'Viga simplemente apoyada', d: 'Carga puntual centrada — diagramas N/V/M en su forma más simple.', cat: 'Vigas 2D', badge: 'beam', icon: 'commitH' },
  { n: 'Armadura triangular', d: 'Barras biarticuladas, sólo axial — compresión y tracción por barra.', cat: 'Armaduras', badge: 'truss', icon: 'triangleShape' },
  { n: 'Hibbeler · carga tributaria Fig. 2–11', d: 'Práctica guiada, verificada contra la solución del libro.', cat: 'Académico', badge: 'academic', icon: 'commitH' },
  { n: 'Práctica tipo Hibbeler · diagramas', d: 'Trazado de N/V/M paso a paso, con comprobación instantánea.', cat: 'Académico', badge: 'academic', icon: 'commitH' },
  { n: 'Práctica tipo Hibbeler · armadura', d: 'Método de nudos guiado sobre una armadura triangular.', cat: 'Académico', badge: 'academic', icon: 'triangleShape' },
];

/** Vitrina del pórtico: marcas de esquina de plano + placa de especificación.
 *  El 3D deja de ser adorno junto al texto y pasa a ser una pieza expuesta. */
const stage3d = () => `
<div class="sheet2__stage">
  <i class="stage__tick stage__tick--tl"></i><i class="stage__tick stage__tick--tr"></i>
  <i class="stage__tick stage__tick--bl"></i><i class="stage__tick stage__tick--br"></i>
  ${porticoHero()}
  <span class="stage__cap">Pórtico · 2 crujías · <b>IPE-240 · A992</b></span>
</div>`;

const dots = (active) => `<div class="dots">${[1, 2, 3].map((i) => `<i class="${i === active ? 'is-on' : ''}"></i>`).join('')}</div>`;

/** Cabecera de hoja: volver · paso · saltar. El patrón de navegación de una
 *  hoja modal nativa — nunca deja al usuario sin salida ni sin contexto. */
const sheetNav = (step, { back = true, skip = 'Saltar' } = {}) => `
<div class="sheet2__nav">
  ${back ? `<button class="sheet2__back" aria-label="Volver">${ICON.back}</button>` : '<span style="width:34px"></span>'}
  <span class="sheet2__step">Paso ${step} de 3</span>
  ${skip ? `<button class="sheet2__skip">${skip}</button>` : '<span style="width:44px"></span>'}
</div>`;

/* ---------- Paso 1 · Bienvenida ---------- */
const paso1 = () => `
<div class="flow"><div class="flow__stack">
  <div class="flow__ghost flow__ghost--2"></div>
  <div class="flow__ghost flow__ghost--1"></div>
  <section class="sheet2">
    <div class="sheet2__grab"></div>
    ${sheetNav(1, { back: false, skip: 'Saltar' })}
    ${stage3d()}
    <div class="sheet2__head">
      <h1>Tu mesa de <em>cálculo</em></h1>
      <p>Modela, resuelve y comprueba de dónde sale cada número. Todo ocurre en tu equipo — sin cuenta y sin subir nada.</p>
    </div>
    ${dots(1)}
    <div class="sheet2__foot">
      <button class="cta">${ICON.play} Comenzar</button>
      <button class="sheet2__link">Ya tengo proyectos aquí</button>
    </div>
  </section>
</div></div>`;

/* ---------- Paso 2 · Cómo trabajas ---------- */
const paso2 = () => `
<div class="flow"><div class="flow__stack">
  <div class="flow__ghost flow__ghost--2"></div>
  <div class="flow__ghost flow__ghost--1"></div>
  <section class="sheet2">
    <div class="sheet2__grab"></div>
    ${sheetNav(2)}
    <div class="sheet2__head">
      <h1>¿Cómo trabajas hoy?</h1>
      <p>Es la misma aplicación y el mismo motor de cálculo. Sólo cambia cuánto se muestra a la vez — y puedes cambiarlo cuando quieras.</p>
    </div>
    <div class="pick">
      <button class="pick__i is-on">
        <span class="pick__ico">${ICON.compass}</span>
        <span class="pick__txt"><strong>Profesional</strong><span>Todo a la vista: hipótesis, combinaciones, procedencia y expediente.</span></span>
        <span class="pick__check">${ICON.check}</span>
      </button>
      <button class="pick__i pick__i--aula">
        <span class="pick__ico">${ICON.grad}</span>
        <span class="pick__txt"><strong>Aula</strong><span>Guiado paso a paso, con corrección instantánea de reacciones y diagramas.</span></span>
        <span class="pick__check">${ICON.check}</span>
      </button>
    </div>
    ${dots(2)}
    <div class="sheet2__foot"><button class="cta">Continuar ${ICON.chev}</button></div>
  </section>
</div></div>`;

/* ---------- Paso 3 · Por dónde empiezas ---------- */
const paso3 = () => `
<div class="flow"><div class="flow__stack">
  <div class="flow__ghost flow__ghost--2"></div>
  <div class="flow__ghost flow__ghost--1"></div>
  <section class="sheet2">
    <div class="sheet2__grab"></div>
    ${sheetNav(3, { skip: '' })}
    <div class="sheet2__head">
      <h1>¿Por dónde empiezas?</h1>
      <p>Nada de esto se cierra: todo sigue disponible después, desde tu mesa.</p>
    </div>
    <div class="rows">
      <button class="rows__i">
        <span class="rows__ico">${ICON.folderOpen}</span>
        <span class="rows__t"><strong>Retomar «${RECENT_PROJECT.t}»</strong><span>${RECENT_PROJECT.nudos} · ${RECENT_PROJECT.when}</span></span>
        ${ICON.chev}
      </button>
      <button class="rows__i">
        <span class="rows__ico">${ICON.compass}</span>
        <span class="rows__t"><strong>Proyecto nuevo</strong><span>Lienzo libre — pórticos, vigas o armaduras</span></span>
        ${ICON.chev}
      </button>
      <button class="rows__i">
        <span class="rows__ico">${ICON.layers}</span>
        <span class="rows__t"><strong>Desde una plantilla</strong><span>Seis modelos verificados, listos para tocar</span></span>
        ${ICON.chev}
      </button>
      <button class="rows__i">
        <span class="rows__ico">${ICON.upload}</span>
        <span class="rows__t"><strong>Importar un archivo</strong><span>JSON, PDF, expediente .structureco o DXF</span></span>
        ${ICON.chev}
      </button>
      <button class="rows__i rows__i--3d">
        <span class="rows__ico">${ICON.cube3d}</span>
        <span class="rows__t"><strong>Explorar en 3D</strong><span>Marco espacial, seis grados de libertad por nudo</span></span>
        <span class="rows__tag">Experimental</span>
      </button>
    </div>
    ${dots(3)}
    <div class="sheet2__foot"><button class="cta cta--ghost">Entrar a mi mesa ${ICON.chev}</button></div>
  </section>
</div></div>`;

/* ---------- La Mesa ---------- */
/**
 * @param speed 'completa' añade recientes + recuperación + plantillas;
 *   'esencial' se detiene tras el trío. Misma app, mismos componentes.
 */
const mesa = ({ speed = 'completa', compact = false, theme = 'light' } = {}) => `
<div class="ws"><div class="ws__pad">
  <header class="wh">
    <div class="wh__brand"><span class="wh__mark">S</span><strong>structureCo</strong></div>
    <div class="wh__spacer"></div>
    <div class="ws__speed">${densityToggle(speed === 'completa' ? 'Completa' : 'Esencial')}</div>
    <div class="wh__actions">
      <button class="ib" aria-label="Cambiar tema">${theme === 'dark' ? ICON.sun : ICON.moon}</button>
      ${compact ? `<button class="ib" aria-label="Menú">${ICON.menu}</button>` : ''}
    </div>
  </header>

  <div class="ws__frame">
    <div class="mesa__hi">
      <h1>Tu mesa</h1>
      <p>Tres proyectos guardados — uno quedó sin cerrar.</p>
    </div>

    <div class="resume">
      <div class="resume__l">
        <span class="resume__eyebrow">Sigue donde lo dejaste</span>
        <h2>${RECENT_PROJECT.t}</h2>
        <div class="resume__meta">
          <span>${RECENT_PROJECT.nudos}</span><span>${RECENT_PROJECT.barras}</span><span>${RECENT_PROJECT.when}</span>
        </div>
        <button class="cta resume__go">${ICON.play} Continuar</button>
      </div>
      <div class="resume__r">${portico({ w: 300, h: 180, labels: 'none' })}</div>
    </div>

    <div class="trio">
      <button class="tile"><span class="tile__ico">${ICON.compass}</span>
        <span class="tile__h"><strong>Proyecto nuevo</strong><span class="tile__tag">Lienzo libre</span></span>
        <span>Pórticos, vigas o armaduras — sin límites de apoyos ni cargas.</span></button>
      <button class="tile tile--aula"><span class="tile__ico">${ICON.grad}</span>
        <span class="tile__h"><strong>Modo Aula</strong><span class="tile__tag">Guiado</span></span>
        <span>Ejercicios con corrección instantánea de reacciones y diagramas.</span></button>
      <button class="tile tile--3d"><span class="tile__ico">${ICON.cube3d}</span>
        <span class="tile__h"><strong>Explorar en 3D</strong><span class="tile__tag">Experimental</span></span>
        <span>Marco espacial completo — seis grados de libertad por nudo.</span></button>
    </div>

    ${speed === 'completa' ? `
    <div class="recientes">
      <div class="recientes__head"><h2>${ICON.folderClock} Más proyectos</h2><span>Local-first</span></div>
      <div class="hub__rows">
        ${RECIENTES.map((r) => `
        <div class="hrow">
          <div class="hrow__id"><strong>${r.t}</strong><small>${r.rev} · ${r.s}</small></div>
          <div class="hrow__actions">
            <button class="ib" aria-label="Abrir ${r.t}">${ICON.folderOpen}</button>
            <button class="ib" aria-label="Renombrar ${r.t}">${ICON.pencil}</button>
            <button class="ib" aria-label="Duplicar ${r.t}">${ICON.copy}</button>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <div class="recovery">${ICON.bang}
      <div class="recovery__body"><strong>Quedó trabajo sin guardar</strong><span>«Celosía Pratt L=12 m» — copia automática de hace 2 minutos, la sesión se cerró antes de guardar</span></div>
      <button>${ICON.restore} Restaurar</button>
    </div>

    <section class="showcase2">
      <div class="showcase2__head">
        <div><h2>Plantillas y ejemplos</h2><p>Parte de una base verificada — cero configuración.</p></div>
        <div class="ftabs" role="tablist"><button class="is-active">Todos</button><button>Académicos</button><button>Modelos</button></div>
      </div>
      <button class="importcard"><span class="importcard__i">${ICON.upload}</span>
        <span><strong>Importar archivo</strong><small>JSON, PDF o expediente .structureco · geometría DXF experimental</small></span>${ICON.chev}</button>
      <div class="tplgrid">
        ${PLANTILLAS.map((p) => `
        <button class="tplcard">
          <div class="tplcard__top"><span class="tplcard__badge tplcard__badge--${p.badge}">${p.cat}</span>${ICON[p.icon]}</div>
          <div><strong>${p.n}</strong><span>${p.d}</span></div>
          <div class="tplcard__foot"><span>Cargar modelo</span>${ICON.chev}</div>
        </button>`).join('')}
      </div>
    </section>` : ''}

    <div class="ws__foot">${ICON.play} Herramienta educativa — verifica datos, unidades y resultados antes de decidir.</div>
  </div>
</div></div>`;

frame({ name: '01a-entrada-paso1', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Entrada · paso 1 de 3. El pórtico ya no es una ilustración plana: grano de superficie (feTurbulence), relieve difuso mate (feDiffuseLighting), canto redondeado, oclusión ambiental en las juntas y luz de canto en el dintel. Las hojas de detrás asoman: el flujo se ve antes de leerse.',
  body: paso1() });

frame({ name: '01b-entrada-paso2', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Entrada · paso 2 de 3. Aquí aterriza la hipótesis Esencial/Completa como una elección explícita del usuario en vez de un conmutador escondido. Seleccionado = HUNDIDO (Brandbook §08), nunca más elevado.',
  body: paso2() });

frame({ name: '01c-entrada-paso3', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Entrada · paso 3 de 3. Lista agrupada con inserción, el patrón de ajustes de iOS traducido a arcilla: el grupo es una cavidad y cada fila una superficie dentro de ella. Los cinco arranques del producto, sin jerarquía falsa.',
  body: paso3() });

frame({ name: '01-mesa', w: 1440, h: 1510, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'La Mesa, Completa · el destino del flujo y la entrada directa de quien ya trabajó aquí (no repite onboarding). Saludo de app, continuación con vista previa del modelo real, trío de accesos, más proyectos, recuperación y plantillas.',
  body: mesa({ speed: 'completa' }) });

frame({ name: '01e-mesa-esencial', w: 1440, h: 725, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'La Mesa, Esencial · mismos componentes y mismos tokens, sólo se pliega lo que hay debajo del trío. Quien vuelve a trabajar tiene su proyecto y tres puertas, nada más.',
  body: mesa({ speed: 'esencial' }) });

frame({ name: '01f-entrada-paso1-compact', w: 390, h: 844, cls: 'K0', rail: 'none', theme: 'light', input: 'touch',
  caption: 'Entrada · paso 1 en Compact. La hoja se ancla abajo y pierde el radio inferior, como una hoja modal nativa; el pórtico y el CTA de ancho completo caben sin scroll en un 390×844 real.',
  body: paso1() });

frame({ name: '01g-entrada-paso3-compact', w: 390, h: 844, cls: 'K0', rail: 'none', theme: 'light', input: 'touch',
  caption: 'Entrada · paso 3 en Compact. La lista agrupada es exactamente el mismo componente que en Expanded — en móvil no hay una versión recortada, hay el mismo contenido en una columna.',
  body: paso3() });

frame({ name: '01h-mesa-compact', w: 390, h: 2200, cls: 'K0', rail: 'none', theme: 'light', input: 'touch',
  caption: 'La Mesa en Compact, Completa · vista previa del modelo primero, continuación a ancho completo con su CTA propio, trío apilado. Altura medida contra el DOM antes de fijarse: nada queda cortado.',
  body: mesa({ speed: 'completa', compact: true }) });

/* ------------------------------------------------------------------ */
/* 02 · WORKSPACE SIN SELECCIÓN — no hay Inspector porque no hay nada   */
/* ------------------------------------------------------------------ */
frame({ name: '02-workspace-sin-seleccion', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Workspace sin selección · sin Inspector, sin banda de resultados, sin nota legal como banda. Lienzo 82.4% del viewport (hoy: 36.1%).',
  body: `
${cinta({ estado: 'sin' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840 })}
    <div class="rot rot--id" style="left:236px;top:212px">N3</div>
    <div class="rot rot--id" style="left:1036px;top:212px">N4</div>
    <div class="rot rot--id" style="left:236px;top:676px">N1</div>
    <div class="rot rot--id" style="left:1036px;top:676px">N2</div>
    <div class="rot rot--carga" style="left:236px;top:150px">P = 20.00 kN</div>
    <div class="rot rot--dist" style="left:636px;top:172px">w = 15.00 kN/m</div>
    <div class="rot rot--cota" style="left:636px;top:724px">6.000 m</div>
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto' })}
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 03 · MIEMBRO SELECCIONADO — zócalo + Inspector contextual            */
/* ------------------------------------------------------------------ */
const inspectorMiembro = ({ conResultados = false } = {}) => `
<aside class="detalle">
  <div class="det__head">
    <span class="det__glyph">${ICON.member}</span>
    <span class="det__title"><strong>B-03</strong><span>Miembro · N3 → N4 · 6.000 m</span></span>
    <button class="ib ib--ghost">${ICON.target}</button>
  </div>
  <div class="det__body">
    ${mini('B3')}
    <div class="det__sect">
      <h5>Propiedades</h5>
      ${prow('Sección', 'catálogo', fieldSel('IPE-240'))}
      ${prow('Material', 'catálogo', fieldSel('Acero A992'))}
      ${prow('Longitud', 'derivada', fieldNum('6.000', 'm'))}
      ${prow('Releases', 'inicio · fin', fieldSel('Rígido · Rígido'))}
    </div>
    ${conResultados ? `
    <div class="det__sect">
      <h5>Resultados de este objeto</h5>
      <div class="metrics">
        ${metric('N', 'Axial N', '−7.79', 'kN')}
        ${metric('V', 'Cortante V máx.', '45.00', 'kN')}
        ${metric('M', 'Momento M máx.', '36.35', 'kN·m', 'x = 3.000 m')}
        ${metric('d', 'Flecha δ máx.', '11.4', 'mm', 'x = 3.000 m')}
      </div>
    </div>
    <div class="proc">
      <div class="proc__h">${ICON.info} Procedencia de M máx.</div>
      <div class="proc__r"><span>Magnitud</span><b class="mono">36.35 kN·m</b></div>
      <div class="proc__r"><span>Objeto</span><b class="mono">B-03</b></div>
      <div class="proc__r"><span>Posición</span><b class="mono">x = 3.000 m (0.50 L)</b></div>
      <div class="proc__r"><span>Caso</span><b>Combinación «Servicio 1»</b></div>
      <div class="proc__r"><span>Convención</span><b>Tracción en fibra inferior positiva</b></div>
      <div class="proc__r"><span>Confianza</span><b>Lectura limitada — ver causa</b></div>
    </div>
    ${denseLinks()}` : `
    <div class="det__sect">
      <h5>Resultados de este objeto</h5>
      <div class="causa">
        <div class="causa__q">${ICON.ring} Sin resultado vigente</div>
        <div class="causa__w">Este miembro no tiene resultados porque el modelo no se ha resuelto. Las propiedades de arriba sí son editables ahora.</div>
        <div class="causa__do"><button class="btn btn--primary">${ICON.play} Resolver</button></div>
      </div>
    </div>`}
  </div>
</aside>`;

frame({ name: '03-miembro-seleccionado', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Miembro seleccionado · el zócalo trae los verbos al objeto (Sección · Dividir · Carga · Borrar · ⋯ filtrado por la selección) y el Inspector aparece porque hay algo que inspeccionar.',
  body: `
${cinta({ estado: 'sin' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 952, h: 840, sel: 'B3' })}
    <div class="rot rot--sel" style="left:476px;top:264px">B-03 · IPE-240</div>
    <div class="zocalo__fiel" style="left:476px;top:212px;height:40px"></div>
    ${zocalo({ x: 476, y: 152, id: 'B-03', glyph: 'member', verbs: [
      { i: 'gen', t: 'Sección' }, { i: 'split', t: 'Dividir' }, { i: 'dist', t: 'Carga' },
    ] })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro' })}
  </div>
  ${inspectorMiembro()}
</div>` });

/* ------------------------------------------------------------------ */
/* 04 · CARGA SELECCIONADA — mismo patrón, otros verbos                 */
/* ------------------------------------------------------------------ */
frame({ name: '04-carga-seleccionada', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Carga seleccionada · el zócalo sale del mismo generador con otra entrada: Valor · Caso · Convertir. El Inspector muestra la carga, no su miembro.',
  body: `
${cinta({ estado: 'sin' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 952, h: 840 })}
    <div class="rot rot--sel" style="left:476px;top:176px">w = 15.00 kN/m</div>
    ${zocalo({ x: 476, y: 96, id: 'q-02', glyph: 'dist', verbs: [
      { i: 'sliders', t: 'Valor' }, { i: 'layers', t: 'Caso' }, { i: 'repeat', t: 'Convertir' },
    ] })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 carga' })}
  </div>
  <aside class="detalle">
    <div class="det__head">
      <span class="det__glyph">${ICON.dist}</span>
      <span class="det__title"><strong>q-02</strong><span>Carga repartida · sobre B-03</span></span>
      <button class="ib ib--ghost">${ICON.target}</button>
    </div>
    <div class="det__body">
      ${mini('B3')}
      <div class="det__sect">
        <h5>Propiedades</h5>
        ${prow('Magnitud', 'w', fieldNum('15.000', 'kN/m'))}
        ${prow('Dirección', 'global', fieldSel('−Y (gravedad)'))}
        ${prow('Aplicada a', 'miembro', fieldSel('B-03 · N3 → N4'))}
        ${prow('Extensión', 'inicio → fin', fieldSel('0.000 → 6.000 m'))}
        ${prow('Caso', 'hipótesis', fieldSel('Sobrecarga de uso'))}
      </div>
      <div class="det__sect">
        <h5>Resultante</h5>
        <div class="metrics">
          ${metric('R', 'Resultante', '90.00', 'kN')}
          ${metric('R', 'Punto de paso', '3.000', 'm')}
        </div>
      </div>
    </div>
  </aside>
</div>` });

/* ------------------------------------------------------------------ */
/* 05 · ANÁLISIS + EVIDENCIA — elegir evidencia es elegir CAPA          */
/* ------------------------------------------------------------------ */
const selectorCapa = (activa) => `
<div class="flot" style="bottom:12px;left:12px;z-index:4">
  <span class="chip" style="padding-inline:8px;gap:2px">
    ${[['none', 'Ninguna', ''], ['N', 'N', 'var(--sc-color-technical-axial)'], ['V', 'V', 'var(--sc-color-technical-shear)'],
       ['M', 'M', 'var(--sc-color-technical-moment)'], ['d', 'δ', 'var(--sc-color-technical-deformed)'], ['h', 'η', 'var(--sc-color-demand-peak)']]
      .map(([k, t, c]) => `<span style="display:inline-grid;place-items:center;min-width:30px;height:24px;padding:0 6px;border-radius:999px;font-weight:800;
        ${k === activa ? `background:var(--sc-color-surface-inset);box-shadow:var(--sc-shadow-clay-pressed);color:${c || 'var(--sc-color-text-primary)'}` : `color:var(--sc-color-text-secondary)`}">${t}</span>`).join('')}
  </span>
</div>`;

frame({ name: '05-analisis-evidencia', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Análisis resuelto · elegir evidencia es elegir capa, no abrir una pestaña. Sólo se rotulan los extremos gobernantes de la capa activa: nunca todos los valores a la vez.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840, layer: 'M' })}
    <div class="rot rot--mom" style="left:636px;top:196px">M máx. 36.35 kN·m · x 3.000 m</div>
    <div class="rot rot--mom rot--fold" style="left:280px;top:262px">M</div>
    <div class="rot rot--mom rot--fold" style="left:992px;top:262px">M</div>
    <div class="rot rot--reac" style="left:236px;top:748px">Ry = 65.00 kN</div>
    <div class="rot rot--reac" style="left:1036px;top:748px">Ry = 65.00 kN</div>
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto', capa: CAPA.M })}
    ${selectorCapa('M')}
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 06 · RESULTS ENFOCADO — la evidencia vive sobre el modelo            */
/* ------------------------------------------------------------------ */
frame({ name: '06-results-enfocado', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Results enfocado · no hay dashboard de tarjetas. El resultado es la capa sobre el modelo, el número lleva su procedencia colgada, y la causa de «lectura limitada» es un elemento enfocable, no un title.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 952, h: 840, sel: 'B3', layer: 'M' })}
    <div class="rot rot--mom" style="left:476px;top:196px">M máx. 36.35 kN·m</div>
    ${zocalo({ x: 476, y: 120, id: 'B-03', glyph: 'member', verbs: [
      { i: 'info', t: 'Procedencia' }, { i: 'table', t: 'Fila en tabla' }, { i: 'cut', t: 'Corte aquí' },
    ], danger: false })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro', capa: CAPA.M })}
    ${selectorCapa('M')}
  </div>
  ${inspectorMiembro({ conResultados: true })}
</div>` });

/* ------------------------------------------------------------------ */
/* 07 · DATASHEET — entorno con salida explícita, y `peek` al localizar */
/* ------------------------------------------------------------------ */
const filas = [
  ['B-01', 'N1 → N3', 'IPE-240', 'A992', '4.000', '−65.00', '20.00', '31.15', false],
  ['B-02', 'N2 → N4', 'IPE-240', 'A992', '4.000', '−65.00', '20.00', '31.15', false],
  ['B-03', 'N3 → N4', 'IPE-240', 'A992', '6.000', '−7.79', '45.00', '36.35', true],
];
const tablaDatasheet = () => `
<table class="tabla">
  <thead><tr>
    <th style="width:44px"></th><th>ID</th><th>Nudos</th><th>Sección</th><th>Material</th>
    <th class="n">L (m)</th><th class="n">N (kN)</th><th class="n">V máx (kN)</th><th class="n">M máx (kN·m)</th><th style="width:60px">Rótula</th>
  </tr></thead>
  <tbody>
    ${filas.map(([id, n, s, m, l, N, V, M, sel]) => `
      <tr class="${sel ? 'is-sel' : ''}">
        <td><span class="cbx ${sel ? 'is-on' : ''}"><i></i></span></td>
        <td style="font-family:var(--sc-font-mono);font-weight:700">${id}</td>
        <td style="font-family:var(--sc-font-mono)">${n}</td>
        <td>${s}</td><td>${m}</td>
        <td class="n">${l}</td><td class="n">${N}</td><td class="n">${V}</td><td class="n">${M}</td>
        <td><span class="cbx"><i></i></span></td>
      </tr>`).join('')}
  </tbody>
</table>`;

frame({ name: '07-datasheet', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Datasheet · entorno declarado con salida explícita. Filtro visible con recuento («3 de 3 · sólo la selección»), casillas de 36 px de acierto con glifo de 16, y la fila seleccionada es la misma selección del lienzo.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840, sel: 'B3' })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro' })}
  </div>
</div>
<div class="scrim"></div>
<div class="drawer drawer--wide">
  <div class="drawer__h">
    <span class="det__glyph">${ICON.table}</span>
    <div style="flex:1">
      <h3>Hoja de datos</h3>
      <p>Auditar y editar nudos, barras y cargas. La selección es la misma que la del lienzo.</p>
    </div>
    <button class="btn">${ICON.back} Salir de la hoja</button>
  </div>
  <div class="drawer__b">
    <div class="facets">
      <span class="facet is-on">Barras <b>3</b></span>
      <span class="facet">Nudos <b>4</b></span>
      <span class="facet">Cargas <b>3</b></span>
      <span style="width:1px;height:24px;background:var(--sc-color-border)"></span>
      <span class="facet is-on">${ICON.select} Sólo la selección <b>1</b></span>
      <span class="facet">IPE-240 <b>3</b></span>
      <span style="flex:1"></span>
      <span style="color:var(--sc-color-text-secondary);font-size:12px">Mostrando <b style="font-family:var(--sc-font-mono)">3 de 3</b></span>
      <button class="btn">Quitar filtros</button>
    </div>
    <div style="border:1px solid var(--sc-color-border-soft);border-radius:13px;overflow:hidden;background:var(--sc-color-surface-1)">
      ${tablaDatasheet()}
    </div>
    <div class="causa" style="--st:var(--sc-color-state-info)">
      <div class="causa__q">${ICON.info} Un filtro activo nunca es invisible</div>
      <div class="causa__w">El recuento «3 de 3» y el botón de quitar filtros están siempre presentes. En un sistema fail-closed, «no aparece» jamás puede confundirse con «no existe».</div>
    </div>
    <div style="display:flex;gap:8px;color:var(--sc-color-text-secondary);font-size:12px;font-family:var(--sc-font-mono)">
      <span>↑↓←→ moverse</span><span>· Intro selecciona</span><span>· F2 edita</span><span>· Ctrl+Espacio añade</span><span>· Esc limpia</span>
    </div>
  </div>
</div>` });

frame({ name: '07b-datasheet-peek', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Datasheet en `peek` · localizar NO cierra la tabla: la pliega a una banda viva que conserva su desplazamiento, su filtro y su borrador. Volver es un solo toque.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 784, sel: 'B3' })}
    <div class="rot rot--sel" style="left:636px;top:246px">B-03 · IPE-240</div>
    ${zocalo({ x: 636, y: 140, id: 'B-03', glyph: 'member', verbs: [
      { i: 'gen', t: 'Sección' }, { i: 'split', t: 'Dividir' }, { i: 'dist', t: 'Carga' },
    ] })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro' })}
  </div>
</div>
<div class="peek">
  <span class="det__glyph" style="width:30px;height:30px;background:var(--sc-color-surface-2);color:var(--sc-color-text-secondary)">${ICON.table}</span>
  <div class="peek__l"><strong>Hoja de datos · fila 3 de 3 — B-03</strong><small>Filtro «sólo la selección» activo · sin cambios sin aplicar</small></div>
  <span class="peek__n"><button class="ib">${ICON.undo}</button><button class="ib">${ICON.redo}</button></span>
  <button class="btn btn--primary">${ICON.back} Volver a la hoja</button>
</div>` });

/* ------------------------------------------------------------------ */
/* 08 · MODEL DOCTOR — hallazgo → localizar → entender → actuar → volver*/
/* ------------------------------------------------------------------ */
const hallazgos = [
  ['crit', 'bang', 'Crítico', 'Nudo sin restricción en Y', 'N3 sostiene el dintel pero no tiene apoyo ni conexión que impida su desplazamiento vertical. El sistema puede resultar en mecanismo.', ['N3'], true],
  ['', 'half', 'Advertencia', 'Dos nudos a 3 mm de distancia', 'N2 y N5 no coinciden pero están más cerca que la tolerancia de fusión declarada (5 mm). Si deben ser el mismo nudo, la unión no existe hoy.', ['N2', 'N5'], true],
  ['sug', 'info', 'Sugerencia', 'Barra sin sección asignada', 'B-07 usa la sección por defecto del proyecto. El cálculo la acepta; la memoria la marcará como no declarada.', ['B-07'], false],
];
const listaDoctor = (activo = 0) => hallazgos.map(([cls, ic, sev, q, w, obs, rep], i) => `
  <div class="find find--${cls} ${i === activo ? 'is-on' : ''}">
    <div class="find__q">${ICON[ic]}<strong>${q}</strong><span class="find__sev">${sev}</span></div>
    <div class="find__w">${w}</div>
    <div class="find__do">
      <span class="find__ob">${obs.map((o) => `<span class="oid">${o}</span>`).join('')}</span>
      <span style="flex:1"></span>
      <button class="btn">${ICON.target} Localizar</button>
      ${rep ? `<button class="btn">${ICON.sliders} Ver corrección</button>` : `<button class="btn" style="opacity:.62">Corrección ambigua</button>`}
    </div>
  </div>`).join('');

frame({ name: '08-model-doctor', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Model Doctor · cada hallazgo son tres campos separados (qué / por qué / qué hacer), nunca un párrafo. «Corrección ambigua» sustituye a un botón desactivado sin explicación, y en ningún sitio se dice «reparado».',
  body: `
${cinta({ estado: 'fallido', doctor: 3 })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840 })}
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto' })}
  </div>
</div>
<div class="scrim"></div>
<div class="drawer">
  <div class="drawer__h">
    <span class="det__glyph" style="background:color-mix(in srgb,var(--sc-color-state-error) 12%,var(--sc-color-surface-1));color:var(--sc-color-state-error)">${ICON.doctor}</span>
    <div style="flex:1">
      <h3>Model Doctor</h3>
      <p>Revisa la salud del modelo antes de depender del análisis.</p>
    </div>
    <button class="btn">${ICON.back} Salir</button>
  </div>
  <div class="drawer__b">
    <div class="facets">
      <span class="facet is-on">Críticos <b>1</b></span>
      <span class="facet is-on">Advertencias <b>1</b></span>
      <span class="facet is-on">Sugerencias <b>1</b></span>
      <span style="flex:1"></span>
      <span style="color:var(--sc-color-text-secondary);font-size:12px">Hallazgo <b style="font-family:var(--sc-font-mono)">1 de 3</b></span>
    </div>
    ${listaDoctor(0)}
    <div class="causa causa--error">
      <div class="causa__q">${ICON.cross} Lo que esta comprobación NO resuelve</div>
      <div class="causa__w">Se enumeran las tolerancias usadas (fusión 5 mm, esbeltez 300) y los casos que la herramienta deja al criterio de quien modela. Nada se corrige al resolver: el modelo analizado es siempre el modelo dibujado.</div>
    </div>
  </div>
</div>` });

frame({ name: '08b-model-doctor-peek', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Model Doctor en `peek` · el bucle completo. Localizar encuadra y selecciona el objeto, el «por qué» viaja con la banda, y volver restaura la lista con su filtro y su desplazamiento.',
  body: `
${cinta({ estado: 'fallido', doctor: 3 })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 784, sel: 'N3' })}
    <div class="rot rot--sel" style="left:236px;top:176px">N3</div>
    ${zocalo({ x: 300, y: 100, id: 'N3', glyph: 'node', verbs: [
      { i: 'support', t: 'Añadir apoyo' }, { i: 'load', t: 'Carga' },
    ] })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 nudo' })}
  </div>
</div>
<div class="peek" style="height:76px">
  <span class="det__glyph" style="width:30px;height:30px;background:color-mix(in srgb,var(--sc-color-state-error) 12%,var(--sc-color-surface-1));color:var(--sc-color-state-error)">${ICON.bang}</span>
  <div class="peek__l">
    <strong>Hallazgo 1 de 3 · Nudo sin restricción en Y — N3</strong>
    <small>N3 sostiene el dintel pero no impide su desplazamiento vertical. El sistema puede resultar en mecanismo.</small>
  </div>
  <button class="btn">${ICON.chev} Siguiente</button>
  <button class="btn btn--primary">${ICON.back} Volver a la lista</button>
</div>` });

/* ------------------------------------------------------------------ */
/* 09 · SELECCIÓN AMBIGUA — precisión táctil                            */
/* ------------------------------------------------------------------ */
frame({ name: '09-precision-tactil', w: 390, h: 844, cls: 'K0', rail: 'none', theme: 'light', input: 'touch',
  caption: 'Selección ambigua en táctil · la lupa VE bajo el dedo, el selector ELIGE al lado. Se abre por la regla computable de WCAG 2.2 SC 2.5.8: dos objetivos cuyos círculos de 24 px se cortan son ambiguos por definición.',
  body: `
${cinta({ estado: 'sin', compact: true })}
<div class="body">
  <div class="lienzo">
    ${portico({ w: 390, h: 728, sel: 'B3' })}
    <div class="dedo" style="left:70px;top:401px"></div>
    <div class="lupa" style="left:70px;top:271px;--px:70px;--py:401px">
      ${portico({ w: 390, h: 728, sel: 'B3' })}
      <div class="lupa__x"></div>
    </div>
    <div class="cand" style="left:104px;top:424px">
      <div class="cand__h"><span>4 candidatos</span><b>2 de 4</b></div>
      <div class="cand__i"><span style="--cg:var(--sc-color-canvas-member)">${ICON.node}</span><span class="cand__t"><strong>N3</strong><small>0.000 · 4.000 m</small></span></div>
      <div class="cand__i is-on"><span style="--cg:var(--sc-color-canvas-member)">${ICON.member}</span><span class="cand__t"><strong>B-03</strong><small>IPE-240 · N3 → N4</small></span></div>
      <div class="cand__i"><span style="--cg:var(--sc-color-canvas-member)">${ICON.member}</span><span class="cand__t"><strong>B-01</strong><small>IPE-240 · N1 → N3</small></span></div>
      <div class="cand__i"><span style="--cg:var(--sc-color-technical-load)">${ICON.load}</span><span class="cand__t"><strong>P-01</strong><small>20.00 kN · −Y</small></span></div>
    </div>
    <div class="flot flot--modo"><span class="chip">${ICON.select} Elige cuál <small>· suelta para confirmar</small></span></div>
    <div class="flot flot--camara"><span class="camara"><button>${ICON.plus}</button><button>${ICON.minus}</button><button>${ICON.fit}</button></span></div>
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 10-13 · LAS TRES COMPOSICIONES                                       */
/* ------------------------------------------------------------------ */
frame({ name: '10-expanded-1440', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Expanded (X2) · 1440×900 — riel rotulado 168 px + detalle acoplado 320 px con reflow. Lienzo 61.7% con detalle, 82.4% en reposo.',
  body: `
${cinta({ estado: 'resuelto' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 952, h: 840, sel: 'B3', layer: 'V' })}
    ${zocalo({ x: 476, y: 120, id: 'B-03', glyph: 'member', verbs: [{ i: 'info', t: 'Procedencia' }, { i: 'table', t: 'Fila' }], danger: false })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro', capa: CAPA.V })}
    ${selectorCapa('V')}
  </div>
  ${inspectorMiembro({ conResultados: true })}
</div>` });

frame({ name: '11-medium-1024', w: 1024, h: 768, cls: 'M1', rail: 'icons', theme: 'light',
  caption: 'Medium (M1) · 1024×768 — riel de iconos 76 px y detalle SUPERPUESTO sin reflow: la cámara no se mueve al seleccionar. Lienzo 56.5% con detalle (hoy en este mismo viewport: 24.6%).',
  body: `
${cinta({ estado: 'resuelto' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 948, h: 708, sel: 'B3', layer: 'M' })}
    <div class="rot rot--mom" style="left:300px;top:180px">M máx. 36.35 kN·m</div>
    ${zocalo({ x: 300, y: 108, id: 'B-03', glyph: 'member', verbs: [{ i: 'gen', t: 'Sección' }, { i: 'split', t: 'Dividir' }] })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro', capa: CAPA.M })}
    ${selectorCapa('M')}
    <aside class="detalle detalle--inset">
      <div class="det__head">
        <span class="det__glyph">${ICON.member}</span>
        <span class="det__title"><strong>B-03</strong><span>Miembro · N3 → N4</span></span>
        <button class="ib ib--ghost">${ICON.cross}</button>
      </div>
      <div class="det__body">
        ${mini('B3')}
        <div class="det__sect">
          <h5>Propiedades</h5>
          ${prow('Sección', '', fieldSel('IPE-240'))}
          ${prow('Material', '', fieldSel('Acero A992'))}
        </div>
        <div class="det__sect">
          <h5>Resultados</h5>
          <div class="metrics">
            ${metric('M', 'M máx.', '36.35', 'kN·m')}
            ${metric('V', 'V máx.', '45.00', 'kN')}
          </div>
        </div>
      </div>
    </aside>
  </div>
</div>` });

frame({ name: '12-compact-retrato', w: 390, h: 844, cls: 'K0', rail: 'none', theme: 'light', input: 'touch',
  caption: 'Compact retrato · dock flotante de cinco destinos, hoja al 56% del escenario (44% de lienzo vivo, por encima del suelo CB-6 del 40%) y el zócalo por encima de la hoja, anclado al objeto.',
  body: `
${cinta({ estado: 'resuelto', compact: true })}
<div class="body">
  <div class="lienzo">
    ${portico({ w: 390, h: 330, sel: 'B3', layer: 'M' })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro', capa: CAPA.M, compact: true })}
  </div>
</div>
<div class="hoja" style="height:398px;bottom:var(--sc10-dock-compact)">
  <div class="hoja__grip"><i></i></div>
  <div class="det__head" style="padding-top:0">
    <span class="det__glyph">${ICON.member}</span>
    <span class="det__title"><strong>B-03</strong><span>Miembro · N3 → N4 · 6.000 m</span></span>
    <button class="ib ib--ghost">${ICON.target}</button>
  </div>
  <div class="det__body" style="gap:12px">
    <div class="zocalo" style="position:static;transform:none;box-shadow:none;border-color:var(--sc-color-border-soft);justify-content:space-between">
      <button class="zac">${ICON.gen} Sección</button>
      <button class="zac">${ICON.split} Dividir</button>
      <button class="zac">${ICON.dist} Carga</button>
      <button class="zac zac--danger">${ICON.trash}</button>
      <button class="zac">${ICON.more}</button>
    </div>
    <div class="det__sect">
      <h5>Resultados de este objeto</h5>
      <div class="metrics">
        ${metric('M', 'M máx.', '36.35', 'kN·m', 'x = 3.000 m')}
        ${metric('V', 'V máx.', '45.00', 'kN')}
      </div>
    </div>
    ${prow('Sección', '', fieldSel('IPE-240'))}
  </div>
</div>
<div class="dock">
  ${[['select', 'Seleccionar', true], ['node', 'Nudo', false], ['member', 'Miembro', false], ['load', 'Carga', false], ['more', 'Más', false]]
    .map(([i, t, on]) => `<button class="dk ${on ? 'is-active' : ''}">${ICON[i]}<span>${t}</span></button>`).join('')}
</div>` });

frame({ name: '13-compact-apaisado', w: 844, h: 390, cls: 'K0', rail: 'none', theme: 'light', input: 'touch',
  caption: 'Compact apaisado · cambia materialmente: la hoja llega por el LADO y el dock se vuelve lateral, porque una hoja inferior sobre 390 px de alto deja el lienzo inservible (CB-6). Lienzo 53.8%.',
  body: `
${cinta({ estado: 'resuelto', compact: true })}
<div class="body">
  <div class="lienzo">
    ${portico({ w: 524, h: 338, sel: 'B3', layer: 'M' })}
    <div class="flot flot--modo"><span class="chip">${ICON.select} Seleccionar <small>· 1 miembro</small></span></div>
    <div class="flot flot--vista" style="right:12px"><button class="ib">${ICON.layers}</button></div>
    <div class="flot flot--camara" style="right:auto;left:12px"><span class="camara"><button>${ICON.plus}</button><button>${ICON.minus}</button><button>${ICON.fit}</button></span></div>
  </div>
</div>
<div class="hoja hoja--lateral" style="right:64px">
  <div class="det__head" style="padding:12px">
    <span class="det__glyph">${ICON.member}</span>
    <span class="det__title"><strong>B-03</strong><span>N3 → N4</span></span>
  </div>
  <div class="det__body" style="padding:12px;gap:10px">
    <div class="metrics" style="grid-template-columns:1fr">
      ${metric('M', 'M máx.', '36.35', 'kN·m')}
      ${metric('V', 'V máx.', '45.00', 'kN')}
    </div>
    ${prow('Sección', '', fieldSel('IPE-240'))}
  </div>
</div>
<div class="dock dock--lateral">
  ${[['select', true], ['node', false], ['member', false], ['load', false], ['more', false]]
    .map(([i, on]) => `<button class="dk ${on ? 'is-active' : ''}" style="width:52px;min-height:44px">${ICON[i]}</button>`).join('')}
</div>` });

/* ------------------------------------------------------------------ */
/* 14 · COMMAND PALETTE                                                 */
/* ------------------------------------------------------------------ */
frame({ name: '14-command-palette', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Command Palette · agrupada por naturaleza y con el atajo a la vista, para que el camino lento enseñe el rápido. Nada vive SÓLO aquí: es una segunda puerta, nunca la única.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840 })}
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto' })}
  </div>
</div>
<div class="scrim" style="background:var(--sc-color-overlay-soft)"></div>
<div class="pal">
  <div class="pal__q">${ICON.search}<input value="mom" readonly><kbd style="font-family:var(--sc-font-mono);font-size:11px;color:var(--sc-color-text-muted)">Esc</kbd></div>
  <div class="pal__g">Objetos</div>
  <div class="pal__i is-on">${ICON.member}<span><b>B-03</b> — M máx. 36.35 kN·m</span><kbd>Intro</kbd></div>
  <div class="pal__g">Herramientas</div>
  <div class="pal__i">${ICON.moment}<span>Momento aplicado</span><kbd>O</kbd></div>
  <div class="pal__g">Evidencia</div>
  <div class="pal__i">${ICON.layers}<span>Capa · M · Momento</span><kbd>3</kbd></div>
  <div class="pal__g">Acciones</div>
  <div class="pal__i">${ICON.play}<span>Resolver el modelo</span><kbd>Ctrl ⏎</kbd></div>
  <div class="pal__i">${ICON.undo}<span>Deshacer — mover N3</span><kbd>Ctrl Z</kbd></div>
</div>` });

/* ------------------------------------------------------------------ */
/* 15 · ESTADOS — success ≠ reliable ≠ safe                             */
/* ------------------------------------------------------------------ */
const estadoSpec = (key, forma, dice, noDice) => {
  const _e = { sin: 'Sin analizar', calc: 'Resolviendo', resuelto: 'Resuelto', limitado: 'Limitado', nofiable: 'No fiable', obsoleto: 'Obsoleto', fallido: 'Fallido' };
  return `<div style="display:grid;grid-template-columns:230px 92px 1fr 1fr;gap:16px;align-items:center;padding:10px 0;border-bottom:1px solid var(--sc-color-border-soft)">
    ${estadoChip(key)}
    <small style="color:var(--sc-color-text-muted);font-family:var(--sc-font-mono);font-size:11px">${forma}</small>
    <span style="font-size:12px">${dice}</span>
    <span style="font-size:12px;color:var(--sc-color-state-error-foreground)">${noDice}</span>
  </div>`;
};

frame({ name: '15-estados', w: 1440, h: 1010, cls: 'X2', rail: 'none', theme: 'light',
  caption: 'Estados · siete, con forma propia además de color, y cada uno con lo que afirma y lo que NO afirma. `resuelto` jamás significa «seguro»: este producto no hace comprobación normativa.',
  body: `
${cinta({ estado: 'resuelto' })}
<div class="sheetpad">
  <div class="sysrow">
    <h4>Escala de estado del análisis — forma + color + palabra</h4>
    <div style="display:grid;grid-template-columns:230px 92px 1fr 1fr;gap:16px;padding-bottom:6px;border-bottom:1px solid var(--sc-color-border)">
      <small style="color:var(--sc-color-text-muted);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Chip</small>
      <small style="color:var(--sc-color-text-muted);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Forma</small>
      <small style="color:var(--sc-color-text-muted);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Qué afirma</small>
      <small style="color:var(--sc-color-text-muted);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Qué NO afirma</small>
    </div>
    ${estadoSpec('sin', 'anillo punteado', 'No hay resultado y no lo ha habido.', 'Que el modelo esté bien o mal.')}
    ${estadoSpec('resuelto', 'círculo + check', 'El solver convergió y existe un resultado vigente.', 'Que la estructura sea segura, que cumpla norma, ni que el número esté aprobado para usarse sin criterio profesional.')}
    ${estadoSpec('limitado', 'círculo + media luna', 'Convergió, pero hay una condición declarada que acota la lectura.', 'Que el número esté mal. Está acotado, no invalidado.')}
    ${estadoSpec('nofiable', 'círculo + exclamación', 'Convergió, pero una condición invalida la confianza en el número.', 'Que no haya número. Lo hay, y no debe usarse.')}
    ${estadoSpec('obsoleto', 'círculo + barra', 'El modelo cambió: NO hay resultado vigente.', 'Nada sobre el resultado anterior — se destruyó, no se marcó.')}
    ${estadoSpec('fallido', 'círculo + aspa', 'No hay resultado y hay una causa nombrada.', 'Que el modelo sea irreparable.')}
  </div>
  <div class="sysrow">
    <h4>La causa siempre es un elemento enfocable — nunca un <code>title</code>, nunca sólo hover</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="causa">
        <div class="causa__q">${ICON.half} Lectura limitada — cortante sin deformación por corte</div>
        <div class="causa__w">La teoría activa es Euler–Bernoulli, que desprecia la deformación por cortante. En B-03 el canto es 1/25 del vano, donde esa hipótesis es razonable; la flecha puede quedar del lado bajo.</div>
        <div class="causa__do">
          <button class="btn">${ICON.target} Ir a B-03</button>
          <button class="btn">${ICON.sliders} Cambiar a Timoshenko</button>
        </div>
      </div>
      <div class="causa causa--error">
        <div class="causa__q">${ICON.cross} No se pudo resolver — mecanismo</div>
        <div class="causa__w">La matriz de rigidez es singular: el sistema tiene un modo de movimiento libre. N3 no tiene restricción vertical y sostiene el dintel.</div>
        <div class="causa__do">
          <button class="btn">${ICON.target} Ir a N3</button>
          <button class="btn btn--primary">${ICON.doctor} Abrir Model Doctor</button>
        </div>
      </div>
    </div>
  </div>
  <div class="sysrow">
    <h4>Deshabilitado con causa · <code>aria-disabled</code> + enfocable, jamás <code>disabled</code> mudo</h4>
    <div class="sysgrid">
      <div class="spec">
        <button class="btn" style="opacity:.62">${ICON.cut} Corte</button>
        <small>aria-disabled="true" · sigue en el orden de tabulación</small>
      </div>
      <div class="causa" style="--st:var(--sc-color-state-info);max-width:520px">
        <div class="causa__q">${ICON.info} El corte lee un resultado</div>
        <div class="causa__w">Esta herramienta muestra N, V y M en una posición concreta, así que necesita un resultado vigente. Resuelve el modelo y vuelve.</div>
        <div class="causa__do"><button class="btn btn--primary">${ICON.play} Resolver</button></div>
      </div>
    </div>
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 16 · MICRO-UX                                                        */
/* ------------------------------------------------------------------ */
frame({ name: '16-micro-ux', w: 1440, h: 1010, cls: 'X2', rail: 'none', theme: 'light',
  caption: 'Micro-UX · estados de control, objetivos, escala de radios reconciliada con el Brandbook §06 y suelo tipográfico. Todo con los tokens reales.',
  body: `
${cinta({ estado: 'resuelto' })}
<div class="sheetpad">
  <div class="sysrow">
    <h4>Los cinco estados, visibles a la vez — «salido o hundido, nunca las dos cosas»</h4>
    <div class="sysgrid">
      <div class="spec"><button class="btn btn--primary">${ICON.play} Resolver</button><small>reposo</small></div>
      <div class="spec"><button class="btn btn--primary" style="box-shadow:var(--sc-shadow-clay-action-hover);transform:translateY(-1px)">${ICON.play} Resolver</button><small>hover · +1 elevación</small></div>
      <div class="spec"><button class="btn btn--primary" style="box-shadow:var(--sc-shadow-clay-action-pressed);transform:var(--sc-clay-press-transform)">${ICON.play} Resolver</button><small>pulsado · cavidad</small></div>
      <div class="spec"><button class="btn btn--primary focusring">${ICON.play} Resolver</button><small>foco · anillo 2px, offset 2px</small></div>
      <div class="spec"><button class="btn btn--primary" style="opacity:.62">${ICON.play} Resolver</button><small>deshabilitado + causa</small></div>
    </div>
    <div class="sysgrid">
      <div class="spec"><button class="tool" style="width:168px">${'<span class="tool__icon">' + ICON.member + '</span>'}<span class="tool__name">Miembro</span><kbd>M</kbd></button><small>herramienta · reposo</small></div>
      <div class="spec"><button class="tool tool--structure is-active" style="width:168px">${'<span class="tool__icon">' + ICON.member + '</span>'}<span class="tool__name">Miembro</span><kbd>M</kbd></button><small>elegida · HUNDIDA, nunca rellena</small></div>
      <div class="spec"><span class="field" style="width:168px"><span class="val">6.000</span><span class="unit">m</span></span><small>campo · cavidad en reposo</small></div>
      <div class="spec"><span class="field focusring" style="width:168px;border-color:var(--sc-color-action-primary)"><span class="val">6.000</span><span class="unit">m</span></span><small>campo · foco = cambia el canto</small></div>
    </div>
  </div>
  <div class="sysrow">
    <h4>Escala de radios reconciliada con el Brandbook §06 — hoy faltan el 8, el 13 y el 18</h4>
    <div class="sysgrid">
      ${[['xs', 6, 'nada'], ['sm', 8, 'chips, casillas'], ['md', 13, 'controles, campos'], ['lg', 18, 'tarjetas, popovers'], ['xl', 26, 'paneles, hojas']]
        .map(([n, v, u]) => `<div class="spec"><div style="width:96px;height:60px;border:1px solid var(--sc-color-border);border-radius:${v}px;background:var(--sc-color-surface-1);box-shadow:var(--sc-shadow-clay-xs)"></div><small>${n} · ${v}px — ${u}</small></div>`).join('')}
    </div>
  </div>
  <div class="sysrow">
    <h4>Suelo tipográfico · 12px absoluto, 14px para todo número de ingeniería y para el aviso legal</h4>
    <div class="sysgrid" style="align-items:baseline;gap:28px">
      <div class="spec"><span style="font-size:12px">Etiqueta de propiedad</span><small>12px — suelo absoluto</small></div>
      <div class="spec"><span style="font-family:var(--sc-font-mono);font-size:14px;font-variant-numeric:tabular-nums">−7.7879 kN</span><small>14px mono — valor del solver</small></div>
      <div class="spec"><span style="font-family:var(--sc-font-mono);font-size:14px;font-variant-numeric:tabular-nums">36.35 kN·m</span><small>14px mono — rótulo de diagrama</small></div>
      <div class="spec"><span style="font-size:12px;color:var(--sc-color-text-muted)">Herramienta de apoyo · no sustituye la revisión de un profesional</span><small>12px — aviso legal (hoy 10px)</small></div>
    </div>
  </div>
  <div class="sysrow">
    <h4>Densidad de datos ≠ densidad de controles — la casilla de 13×13 px de hoy es una edición estructural real</h4>
    <div class="sysgrid" style="align-items:center">
      <div class="spec"><span style="display:inline-grid;place-items:center;width:13px;height:13px;border:1px solid var(--sc-color-border-strong);border-radius:2px"></span><small style="color:var(--sc-color-state-error-foreground)">hoy · 13×13 (F-02)</small></div>
      <div class="spec"><span class="cbx"><i></i></span><small>puntero · 36×36 de acierto, glifo de 16</small></div>
      <div class="spec"><span class="cbx" style="width:44px;height:44px"><i></i></span><small>táctil · 44×44 de acierto, glifo de 16</small></div>
      <div class="spec"><span style="display:inline-block;width:110px;height:30px;border-radius:6px;background:repeating-linear-gradient(180deg,var(--sc-color-surface-2) 0 15px,var(--sc-color-surface-1) 15px 30px)"></span><small>fila de tabla · 30px, y el control sigue siendo 36/44</small></div>
    </div>
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 17-21 · CORRECCIÓN DE DISCOVERABILITY — capacidades que no tenían        */
/* puerta visible en la primera pasada, ahora demostradas abiertas.        */
/* ------------------------------------------------------------------ */

frame({ name: '17-menu-documento', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Menú de documento, abierto · antes era un caret sin inventario. Cierra dos huecos que CRI-8 §9.2 marcó como graves: cambiar de proyecto (#2) e importar DXF (#3) sólo eran alcanzables desde la Welcome.',
  body: `
${cinta({ estado: 'sin' })}
${docMenu()}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840 })}
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto' })}
  </div>
</div>` });

frame({ name: '18-zocalo-desbordamiento', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Zócalo · desbordamiento abierto · Copiar, Pegar, Duplicar y Repetir — hoy sin ninguna afordancia visible (CRI-8 §6.3, §9.1 #4-5) — demostrados por primera vez en una lámina, no sólo descritos en prosa.',
  body: `
${cinta({ estado: 'sin' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840, sel: 'B3' })}
    <div class="rot rot--sel" style="left:636px;top:264px">B-03 · IPE-240</div>
    <div class="zocalo__fiel" style="left:636px;top:212px;height:40px"></div>
    ${zocalo({ x: 636, y: 152, id: 'B-03', glyph: 'member', verbs: [
      { i: 'gen', t: 'Sección' }, { i: 'split', t: 'Dividir' }, { i: 'dist', t: 'Carga' },
    ], overflow: [
      { i: 'copy', t: 'Copiar', k: 'Ctrl C' },
      { i: 'canvasIcon', t: 'Pegar', k: 'Ctrl V' },
      { i: 'copy', t: 'Duplicar', k: 'Ctrl D' },
      { i: 'repeat', t: 'Repetir', k: 'R' },
      { i: 'dim', t: 'Cota' },
      { i: 'cut', t: 'Corte aquí' },
    ] })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro' })}
  </div>
</div>` });

frame({ name: '19-vista-invocada', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Superficie `view`, invocada y abierta · antes descrita sólo como «dueño único de la visibilidad», sin contenido declarado. Itemiza capas, snap y el filtro de selección — la tercera función más escondida del producto actual (CRI-8 §9.1 #3).',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840 })}
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto' })}
    <div class="scrim" style="background:transparent"></div>
    <div class="sc-popover-anchor" style="position:absolute;top:56px;right:56px;z-index:11;border:1px solid var(--sc-color-border);border-radius:var(--sc10-radius-xl);background:var(--sc-color-surface-elevated);box-shadow:var(--sc-shadow-clay-lg);overflow:hidden">
      ${viewPanel()}
    </div>
  </div>
</div>` });

frame({ name: '20-dense-reacciones', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Reacciones (`dense`), invocada desde el Detalle · antes `dense` no tenía NINGÚN lanzador visible en ninguna lámina — sólo un destino conceptual en el texto. Ahora tiene puerta explícita y demostrada.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840 })}
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto' })}
  </div>
</div>
<div class="scrim"></div>
<div class="drawer">
  <div class="drawer__h">
    <span class="det__glyph">${ICON.table}</span>
    <div style="flex:1">
      <h3>Reacciones</h3>
      <p>Combinación activa: Servicio 1 · abierto desde el Detalle de un objeto</p>
    </div>
    <button class="btn">${ICON.back} Salir</button>
  </div>
  <div class="drawer__b">
    <table class="tabla">
      <thead><tr><th>Nudo</th><th class="n">Rx (kN)</th><th class="n">Ry (kN)</th><th class="n">M (kN·m)</th><th style="width:80px"></th></tr></thead>
      <tbody>
        <tr><td style="font-family:var(--sc-font-mono);font-weight:700">N1</td><td class="n">7.79</td><td class="n">65.00</td><td class="n">0.00</td><td><button class="btn" style="height:30px">${ICON.target}</button></td></tr>
        <tr class="is-sel"><td style="font-family:var(--sc-font-mono);font-weight:700">N2</td><td class="n">−7.79</td><td class="n">65.00</td><td class="n">0.00</td><td><button class="btn" style="height:30px">${ICON.target}</button></td></tr>
      </tbody>
    </table>
    <div class="causa" style="--st:var(--sc-color-state-info)">
      <div class="causa__q">${ICON.info} Suma de reacciones</div>
      <div class="causa__w">ΣRy = 130.00 kN, igual a la carga vertical total aplicada (equilibrio verificado).</div>
    </div>
  </div>
</div>` });

frame({ name: '02b-vista-global', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Vista global · resuelto, sin selección, chip de estado expandido · el equivalente visible del «Centro analítico» de hoy. Sin esto, un resultado resuelto sin selección no tenía ninguna puerta a Reacciones, Índice elástico ni Aprender.',
  body: `
${cinta({ estado: 'resuelto' })}
${estadoQuickLinks()}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840, layer: 'M' })}
    <div class="rot rot--mom" style="left:636px;top:196px">M máx. 36.35 kN·m · x 3.000 m</div>
    <div class="rot rot--mom rot--fold" style="left:280px;top:262px">M</div>
    <div class="rot rot--mom rot--fold" style="left:992px;top:262px">M</div>
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto', capa: CAPA.M, globalScope: true })}
  </div>
</div>` });

frame({ name: '21-recuperacion-conflicto', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Persistencia en conflicto (PER-03), resuelto desde la mesa · el hueco de acceso más grave de CRI-8 §9.2 #1 — la restauración vivía sólo en el Project Hub, en otra pantalla. El chip de persistencia es ahora la puerta directa a `recovery`.',
  body: `
${cinta({ estado: 'limitado', persist: 'conflicto' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840 })}
    ${flotantes({ modo: 'Seleccionar', hint: 'toca un objeto' })}
  </div>
</div>
<div class="scrim"></div>
<div class="drawer">
  <div class="drawer__h">
    <span class="det__glyph" style="background:color-mix(in srgb,var(--sc-color-state-error) 12%,var(--sc-color-surface-1));color:var(--sc-color-state-error)">${ICON.bang}</span>
    <div style="flex:1">
      <h3>Conflicto de revisión</h3>
      <p>Este proyecto cambió en otra pestaña o dispositivo mientras trabajabas aquí.</p>
    </div>
    <button class="btn">${ICON.back} Salir</button>
  </div>
  <div class="drawer__b">
    <div class="causa causa--error">
      <div class="causa__q">${ICON.cross} Dos versiones no reconciliadas</div>
      <div class="causa__w">La sesión local (esta mesa) y la copia guardada difieren. Ninguna se descarta en silencio: la copia en conflicto se guardó aparte en la misma transacción antes de mostrarte esto.</div>
    </div>
    <div class="rec" style="grid-template-columns:44px 1fr auto">
      <div class="rec__t">${portico({ w: 44, h: 34, labels: 'none' })}</div>
      <div class="rec__c"><strong>Sesión local · esta mesa</strong><small>Editado hace 40 s · 4 nudos · 3 barras</small></div>
      <button class="btn btn--primary">Conservar ésta</button>
    </div>
    <div class="rec" style="grid-template-columns:44px 1fr auto">
      <div class="rec__t">${portico({ w: 44, h: 34, sel: 'B3', labels: 'none' })}</div>
      <div class="rec__c"><strong>Copia guardada · otra sesión</strong><small>Guardado hace 2 min · 4 nudos · 3 barras</small></div>
      <button class="btn">Conservar ésta</button>
    </div>
    <button class="btn" style="width:max-content">Comparar antes de decidir</button>
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 22 · RESULTS/DENSE CON TARJETAS RECUPERADAS — Expanded y Compact         */
/* Familias y tabs verificados contra `ResultsPanel.tsx:29-48`.            */
/* ------------------------------------------------------------------ */

frame({ name: '22-results-dense-expanded', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Results/`dense` con tarjetas recuperadas · Expanded. Tabs agrupados por familia (Estado · Fuerzas · Forma · Avanzado · Entender), curva + tarjeta de máximo/mínimo con objeto, posición y unidad — el patrón de las capturas actuales, invocado, no residente.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 840, sel: 'B3', layer: 'M' })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro', capa: CAPA.M })}
  </div>
</div>
<div class="scrim"></div>
<div class="drawer drawer--wide">
  <div class="drawer__h">
    <span class="det__glyph">${ICON.member}</span>
    <div style="flex:1">
      <h3>Resultados</h3>
      ${contextLine(['B-03', 'Momento', 'Servicio 1'])}
    </div>
    ${estadoChip('limitado')}
    <button class="btn">${ICON.back} Salir</button>
  </div>
  <div class="drawer__b">
    ${resultTabs('moment')}
    <div class="det__sect">
      ${diagramCurve('var(--sc-color-technical-moment)', 'sag')}
    </div>
    ${maxMinCard('var(--sc-color-technical-moment)', 'M · Momento', 'B-03', '36.35', '−31.15', 'kN·m', '3.000 m', '0.000 m')}
    <div class="proc">
      <div class="proc__h">${ICON.info} Procedencia de M máx.</div>
      <div class="proc__r"><span>Caso</span><b>Combinación «Servicio 1»</b></div>
      <div class="proc__r"><span>Convención</span><b>Tracción en fibra inferior positiva</b></div>
      <div class="proc__r"><span>Confianza</span><b>Lectura limitada — ver causa</b></div>
    </div>
    <div class="causa">
      <div class="causa__q">${ICON.half} Lectura limitada — cortante sin deformación por corte</div>
      <div class="causa__w">La teoría activa es Euler–Bernoulli. En B-03 el canto es 1/25 del vano, donde esa hipótesis es razonable; la flecha puede quedar del lado bajo.</div>
    </div>
    <div class="dense-links">
      <button class="dl-item">${ICON.table} Fila en la hoja de datos</button>
      <button class="dl-item">${ICON.target} Localizar en el modelo</button>
    </div>
  </div>
</div>` });

frame({ name: '22b-results-dense-compact', w: 390, h: 844, cls: 'K0', rail: 'none', theme: 'light', input: 'touch',
  caption: 'Results/`dense` · Compact, pantalla completa. Los mismos tabs por familia, la misma tarjeta — los datos siguen planos y comparables, NO se simplifican a cards decorativas. El overlay de momento sigue en el lienzo detrás.',
  body: `
${cinta({ estado: 'limitado', compact: true })}
<div class="body">
  <div class="lienzo">
    ${portico({ w: 390, h: 200, sel: 'B3', layer: 'M' })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro', capa: CAPA.M, compact: true })}
  </div>
</div>
<div class="hoja" style="height:610px">
  <div class="hoja__grip"><i></i></div>
  <div class="det__head" style="padding-top:0">
    <span class="det__glyph">${ICON.member}</span>
    <div style="flex:1">
      <strong style="display:block;font-size:15px">Resultados</strong>
      ${contextLine(['B-03', 'Momento', 'Servicio 1'])}
    </div>
  </div>
  <div class="det__body" style="gap:14px">
    ${resultTabs('moment', { compact: true })}
    ${diagramCurve('var(--sc-color-technical-moment)', 'sag', 340, 120)}
    ${maxMinCard('var(--sc-color-technical-moment)', 'M · Momento', 'B-03', '36.35', '−31.15', 'kN·m', '3.000 m', '0.000 m')}
    <div class="dense-links">
      <button class="dl-item">${ICON.table} Fila en la hoja</button>
      <button class="dl-item">${ICON.target} Localizar</button>
    </div>
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 23 · CANVAS ↔ DETALLE ↔ DENSE — el overlay sigue siendo la evidencia    */
/* principal; Forma (Deformada) también recuperada como familia.          */
/* ------------------------------------------------------------------ */

frame({ name: '23-nvm-deformada-continuidad', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Deformada (familia Forma) · el overlay sobre el lienzo sigue siendo la evidencia principal — la tarjeta del Detalle es la lectura condensada, y «Ver detalle completo» es la puerta a `dense` con la curva y la tarjeta de máximo. Ninguna sustituye a la otra.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 952, h: 840, sel: 'B3', layer: 'd' })}
    ${zocalo({ x: 476, y: 120, id: 'B-03', glyph: 'member', verbs: [{ i: 'info', t: 'Procedencia' }, { i: 'table', t: 'Fila' }], danger: false })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro', capa: CAPA.d })}
  </div>
  <aside class="detalle">
    <div class="det__head">
      <span class="det__glyph">${ICON.member}</span>
      <span class="det__title"><strong>B-03</strong><span>Miembro · N3 → N4 · 6.000 m</span></span>
    </div>
    <div class="det__body">
      ${mini('B3')}
      <div class="det__sect">
        <h5>Resultados de este objeto</h5>
        <div class="metrics">
          ${metric('d', 'Flecha δ máx.', '11.4', 'mm', 'x = 3.000 m')}
          ${metric('M', 'M máx.', '36.35', 'kN·m')}
        </div>
      </div>
      <button class="btn btn--full">${ICON.chev} Ver detalle completo</button>
    </div>
  </aside>
</div>` });

/* ------------------------------------------------------------------ */
/* 24 · ATENCIÓN POR EXCEPCIÓN — normalidad silenciosa vs. señal viva      */
/* ------------------------------------------------------------------ */

const cintaAttnDemo = (mode) => {
  const normal = mode === 'normal';
  return `<header class="cinta" style="border-radius:14px">
    <div class="mark">S</div>
    <div class="doc"><span class="doc__name">Pórtico de ejemplo</span><button class="ib ib--ghost">${ICON.caret}</button></div>
    ${persistChip(normal ? 'guardado' : 'conflicto', false).replace('class="persist', `class="${normal ? '' : ATTENTION_RING} persist`)}
    <button class="ib">${ICON.undo}</button><button class="ib" data-state="disabled">${ICON.redo}</button>
    <div class="cinta__spacer"></div>
    <span class="aviso">${ICON.info} Herramienta de apoyo</span>
    <button class="ib ${normal ? '' : ATTENTION_RING} doctor-launcher" aria-label="Model Doctor${normal ? '' : ' · 2 hallazgos'}">${ICON.doctor}${normal ? '' : '<i class="badge-count">2</i>'}</button>
    ${estadoChip(normal ? 'resuelto' : 'nofiable', false).replace('class="estado', `class="${normal ? '' : ATTENTION_RING} estado`)}
    <div class="resolver"><button class="resolver__go">${ICON.play} Resolver</button><button class="resolver__ctx">Servicio 1 ${ICON.caret}</button></div>
  </header>`;
};

frame({ name: '24-atencion-normal-vs-excepcion', w: 1440, h: 300, cls: 'X2', rail: 'none', theme: 'light',
  caption: 'Atención por excepción · misma Cinta, dos estados del mundo. Normal: persistencia discreta, Doctor sin badge, estado compacto sin ganar peso. Excepción (conflicto + no fiable + 2 hallazgos): esas tres señales concretas ganan presencia — el resto de la Cinta no cambia.',
  body: `
<div style="padding:24px;display:grid;gap:28px">
  <div style="display:grid;gap:8px">
    <div class="compare__label">✓ <b>Normal</b> — silenciosa. Guardado, 0 hallazgos, resuelto: ningún control compite por atención, el chrome vuelve a su presupuesto mínimo.</div>
    <div class="compare__frame">${cintaAttnDemo('normal')}</div>
  </div>
  <div style="display:grid;gap:8px">
    <div class="compare__label">⚠ <b>Excepción</b> — señal viva. Conflicto + 2 hallazgos + no fiable: sólo esas tres señales ganan anillo y peso — Deshacer, el aviso y Resolver siguen exactamente igual.</div>
    <div class="compare__frame">${cintaAttnDemo('atencion')}</div>
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 25 · HIPÓTESIS ESENCIAL vs. COMPLETA — misma tarea, misma capacidad,    */
/* distinta presentación. A validar en CRI-11, no una decisión tomada.     */
/* ------------------------------------------------------------------ */

frame({ name: '25-esencial-vs-completa', w: 1440, h: 340, cls: 'X2', rail: 'none', theme: 'light',
  caption: 'Hipótesis Esencial/Completa · misma tarea (B-03 seleccionado, cambiar sección), mismo `Selection`, mismo comando — sólo cambia cuánto se muestra a la vez. Dos aplicaciones NO: es `densityToggle`, una preferencia sobre la misma capa de presentación.',
  body: `
<div class="compare">
  <div class="compare__col">
    <div class="compare__label">${densityToggle('Esencial')} <b>menos chrome, rutas claras</b></div>
    <div class="compare__frame">
      <div style="padding:16px;background:var(--sc-color-bg-app)">
        <div class="zocalo" style="position:static;transform:none;box-shadow:var(--sc-shadow-clay-md);width:max-content">
          <span class="zocalo__id">${ICON.member} B-03</span>
          <button class="zac">${ICON.gen} Sección</button>
          <span class="zocalo__sep"></span>
          <button class="zac zac--danger">${ICON.trash}</button>
          <button class="zac">${ICON.more}</button>
        </div>
        <div style="height:12px"></div>
        <div class="disclosure-more">${ICON.chev} Más herramientas (Dividir · Cota · Corte · Invertir)</div>
      </div>
    </div>
    <p style="font-size:12px;color:var(--sc-color-text-secondary);line-height:1.5;margin:0">Un verbo primario. Todo lo demás está a un toque de disclosure, no borrado — ideal para aprender o trabajar sin ruido.</p>
  </div>
  <div class="compare__col">
    <div class="compare__label">${densityToggle('Completa')} <b>todo accesible, rutas de experto</b></div>
    <div class="compare__frame">
      <div style="padding:16px;background:var(--sc-color-bg-app)">
        <div class="zocalo" style="position:static;transform:none;box-shadow:var(--sc-shadow-clay-md);width:max-content">
          <span class="zocalo__id">${ICON.member} B-03</span>
          <button class="zac">${ICON.gen} Sección</button>
          <button class="zac">${ICON.split} Dividir</button>
          <button class="zac">${ICON.dist} Carga</button>
          <span class="zocalo__sep"></span>
          <button class="zac zac--danger">${ICON.trash}</button>
          <button class="zac">${ICON.more}</button>
        </div>
        <div style="height:12px"></div>
        <div style="display:flex;gap:8px;align-items:center;color:var(--sc-color-text-muted);font-size:11px;font-family:var(--sc-font-mono)">
          <kbd style="border:1px solid var(--sc-color-border);border-radius:4px;padding:2px 6px">Ctrl K</kbd> paleta siempre visible como ruta rápida
        </div>
      </div>
    </div>
    <p style="font-size:12px;color:var(--sc-color-text-secondary);line-height:1.5;margin:0">Tres verbos primarios, atajos a la vista, densidad alta donde aporta — para quien ya conoce la mesa.</p>
  </div>
</div>` });

/* ------------------------------------------------------------------ */
/* 26 · RIEL ESTABLE + ZÓCALO CONTEXTUAL — memoria muscular real           */
/* ------------------------------------------------------------------ */

const rielMini = (activeId) => `
<div class="rielmini">
  <div class="rielmini__g"><small>Navegar</small>
    <span class="rielmini__i ${activeId === 'select' ? 'is-active' : ''}">${ICON.select} Seleccionar</span>
    <span class="rielmini__i">${ICON.pan} Desplazar</span>
  </div>
  <div class="rielmini__g"><small>Crear</small>
    <span class="rielmini__i ${activeId === 'node' ? 'is-active' : ''}">${ICON.node} Nudo</span>
    <span class="rielmini__i">${ICON.member} Miembro</span>
    <span class="rielmini__i">${ICON.support} Apoyo</span>
  </div>
  <div class="rielmini__g"><small>Cargar</small>
    <span class="rielmini__i">${ICON.load} Puntual</span>
    <span class="rielmini__i">${ICON.dist} Distribuida</span>
  </div>
</div>`;

frame({ name: '26-riel-estable-zocalo', w: 1440, h: 580, cls: 'X2', rail: 'none', theme: 'light',
  caption: 'Riel estable + zócalo contextual · el mismo riel, letra por letra, con dos selecciones muy distintas. Lo único que cambia es el zócalo bajo el objeto — el riel es memoria muscular, no un panel que se reordena con la selección.',
  body: `
<div class="compare">
  <div class="compare__col">
    <div class="compare__label">Selección: <b>nudo N3</b></div>
    <div class="compare__frame" style="display:flex;height:280px">
      ${rielMini('select')}
      <div class="lienzo" style="flex:1;position:relative">
        ${portico({ w: 500, h: 280, sel: 'B3', labels: 'none' })}
        ${zocalo({ x: 250, y: 60, id: 'N3', glyph: 'node', verbs: [{ i: 'support', t: 'Apoyo' }, { i: 'load', t: 'Carga' }] })}
      </div>
    </div>
  </div>
  <div class="compare__col">
    <div class="compare__label">Selección: <b>carga distribuida</b></div>
    <div class="compare__frame" style="display:flex;height:280px">
      ${rielMini('select')}
      <div class="lienzo" style="flex:1;position:relative">
        ${portico({ w: 500, h: 280, labels: 'none' })}
        ${zocalo({ x: 250, y: 60, id: 'q-02', glyph: 'dist', verbs: [{ i: 'sliders', t: 'Valor' }, { i: 'layers', t: 'Caso' }, { i: 'repeat', t: 'Convertir' }] })}
      </div>
    </div>
  </div>
</div>
<p style="padding:0 24px 20px;font-size:12px;color:var(--sc-color-text-secondary)">El riel rotulado vs. iconos (Expanded vs. Medium) sigue siendo hipótesis de CRI-9/CRI-10 §5.2 — aquí sólo se demuestra que su CONTENIDO no cambia con la selección, que es una afirmación distinta.</p>` });

/* ------------------------------------------------------------------ */
/* 27 · CONTINUIDAD canvas ↔ dense ↔ canvas — dense también hace `peek`    */
/* ------------------------------------------------------------------ */

frame({ name: '27-dense-peek-continuidad', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'light',
  caption: 'Continuidad canvas → dense → canvas · localizar desde `dense` NO cierra la superficie: se pliega a `peek`, igual que ya hace Datasheet y Model Doctor. El bucle completo: canvas ↔ tarjeta ↔ procedencia ↔ dense ↔ canvas.',
  body: `
${cinta({ estado: 'limitado' })}
<div class="body">
  ${riel('select')}
  <div class="lienzo">
    ${portico({ w: 1272, h: 784, sel: 'B3', layer: 'M' })}
    <div class="rot rot--sel" style="left:636px;top:246px">B-03 · IPE-240</div>
    ${zocalo({ x: 636, y: 140, id: 'B-03', glyph: 'member', verbs: [{ i: 'info', t: 'Procedencia' }, { i: 'table', t: 'Fila' }], danger: false })}
    ${flotantes({ modo: 'Seleccionar', hint: '1 miembro', capa: CAPA.M })}
  </div>
</div>
<div class="peek">
  <span class="det__glyph" style="width:30px;height:30px;background:var(--sc-color-surface-2);color:var(--sc-color-text-secondary)">${ICON.table}</span>
  <div class="peek__l"><strong>Resultados · Fuerzas · Momento — B-03</strong><small>Servicio 1 · lectura limitada · sin cambios sin aplicar</small></div>
  <button class="btn btn--primary">${ICON.back} Volver a Resultados</button>
</div>` });

/* ------------------------------------------------------------------ */
/* NOCHE · muestra representativa                                       */
/* ------------------------------------------------------------------ */
const nightOf = (name, caption) => {
  const src = F.find((f) => f.name === name);
  F.push({ ...src, name: `${src.name}--noche`, theme: 'dark', caption });
};
nightOf('02-workspace-sin-seleccion', 'Noche · workspace sin selección. Los roles técnicos y de marca son el MISMO HEX en los dos temas; sólo cambian fondo, superficies, bordes y tintas de texto.');
nightOf('06-results-enfocado', 'Noche · Results enfocado. La rampa de demanda es la única excepción técnica que cambia por tema, y a propósito: es una escala secuencial y tiene que crecer alejándose del fondo.');
nightOf('12-compact-retrato', 'Noche · Compact retrato. En Noche la sombra pierde trabajo y el canto lo gana: sin borde visible los paneles se funden con el fondo.');
nightOf('15-estados', 'Noche · estados. La forma del glifo es lo que sobrevive intacto entre temas; el color acompaña, no carga solo el significado.');
/* Registradas a mano, no con `nightOf()`: la Mesa lee `theme` para mostrar el
   icono de sol (volver a Día), no el de luna, cuando ya está en Noche —
   clonar el HTML de la lámina clara habría dejado el icono al revés. */
frame({ name: '01a-entrada-paso1--noche', w: 1440, h: 900, cls: 'X2', rail: 'labels', theme: 'dark',
  caption: 'Noche · entrada paso 1. El pórtico usa el mismo `--sc-color-clay-lime` que en Día — es relleno de marca, no trazo — y sólo cambian el marfil y su sombreado. En Noche la oclusión de junta y la sombra de contacto suben (0.30 / 0.34) y la luz de canto baja a 0.20: el blanco puro sobre grafito se lee como arañazo.',
  body: paso1() });

frame({ name: '01-mesa--noche', w: 1440, h: 1510, cls: 'X2', rail: 'labels', theme: 'dark',
  caption: 'Noche · la Mesa, Completa. Cada superficie interactiva vive en `--sc-color-surface-elevated` con canto `border-strong` EN REPOSO — sin eso, una tarjeta comparte fondo con la hoja que la contiene (`#15232b` sobre `#15232b`) y desaparece.',
  body: mesa({ speed: 'completa', theme: 'dark' }) });

/* ------------------------------------------------------------------ */
/* Montaje                                                              */
/* ------------------------------------------------------------------ */
const root = document.body;
for (const f of F) {
  const plate = document.createElement('div');
  plate.className = 'plate';
  plate.innerHTML = `
    <div class="plate__caption"><b>${f.name}</b> · ${f.w}×${f.h} · ${f.theme === 'dark' ? 'Noche' : 'Día'} — ${f.caption}</div>
    <div class="frame" id="${f.name}" data-name="${f.name}" data-class="${f.cls}" data-rail="${f.rail}" ${f.input ? `data-input="${f.input}"` : ''}
         style="width:${f.w}px;height:${f.h}px">${f.body}</div>`;
  // El tema se resuelve por atributo explícito en el propio marco, que es como
  // lo hace el producto (`ProjectContext` siempre escribe `data-theme`).
  root.appendChild(plate);
  plate.querySelector('.frame').setAttribute('data-theme-scope', f.theme);
}
document.documentElement.dataset.ready = 'true';
