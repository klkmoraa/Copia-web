#!/usr/bin/env node
/**
 * CRI-93 · Medición de rendimiento del Datasheet y de la Command Palette con un
 * modelo grande (~2000 entidades), sobre la aplicación REAL construida en este
 * repositorio.
 *
 * QUÉ MIDE (las seis métricas de CRI-93), por clase de composición y navegador:
 *   Datasheet   1. tiempo hasta la primera fila
 *               2. tiempo hasta interactivo
 *               3. coste de desplazamiento
 *               4. latencia de edición/escritura de celda (ratón y TECLADO)
 *   Palette     5. latencia de apertura
 *               6. latencia de tecleo con navegación por ID activa
 *
 * CÓMO MIDE: sirve `dist/` con `vite preview`, siembra el modelo grande en
 * `localStorage` (la misma puerta que usa el resto de la QA de este repo),
 * entra al workspace por la pantalla de bienvenida real y ejerce el producto
 * con entrada de usuario real (ratón, rueda y teclado de Playwright). El reloj
 * de cada métrica arranca en el `timeStamp` del evento de entrada confiable y
 * para en el primer `requestAnimationFrame` posterior a que el DOM ya cumpla la
 * condición: es una aproximación de "hasta que se ve", con un sesgo conocido de
 * como mucho un fotograma. No se simula nada del producto.
 *
 * DISPOSITIVO REAL: este script no puede inventar uno. Sin `--device` la
 * ejecución queda etiquetada `container-headless` y NO satisface el requisito
 * de CRI-93. Para medir en un teléfono o tableta física hay dos rutas, ambas
 * soportadas aquí:
 *   a) `--serve-only --host=0.0.0.0` sirve la build en la red local, imprime la
 *      URL y siembra el modelo desde el propio navegador del dispositivo.
 *   b) `--cdp=<url> --device="<etiqueta>"` se ata a un navegador que YA corre en
 *      el dispositivo físico (p. ej. Chrome en Android vía `adb forward
 *      tcp:9222 localabstract:chrome_devtools_remote`) y ejecuta el guion
 *      completo allí. La clase de composición se lee del DOM, no se fuerza.
 *
 * Uso:
 *   npm run build
 *   node scripts/measure-datasheet-performance.mjs [opciones]
 *
 * Opciones:
 *   --chromium | --webkit | --firefox   motor local (por defecto: chromium)
 *   --cdp=<url>                         atarse a un navegador ya abierto (dispositivo real)
 *   --device="Pixel 7 · Android 14"     etiqueta del dispositivo FÍSICO medido
 *   --shell=X2|K0|both                  clases a medir con motor local (por defecto: both)
 *   --repeats=N                         repeticiones en caliente (por defecto: 5)
 *   --serve-only                        sólo servir la build y esperar (medición manual)
 *   --host=<host> --port=<n>            servidor de vista previa
 *   --out=<archivo.json>                escribe el JSON crudo
 *   --json                              imprime el JSON por stdout en vez de la tabla
 *   --headed                            navegador visible (motor local)
 *   --entities=nodes,members            pestañas del Datasheet a medir
 *   --screenshots=<dir>                 guarda una captura por clase y pestaña
 *   --verbose                           traza de progreso por stderr
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium, firefox, webkit } from 'playwright';
import { countEntities, createLargeProject, datasheetRowCounts } from './fixtures/large-model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Opciones
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const found = argv.find((entry) => entry.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};

const options = {
  engine: flag('webkit') ? 'webkit' : flag('firefox') ? 'firefox' : 'chromium',
  cdp: option('cdp', ''),
  device: option('device', ''),
  shell: option('shell', 'both'),
  repeats: Number(option('repeats', '5')),
  serveOnly: flag('serve-only'),
  host: option('host', '127.0.0.1'),
  port: Number(option('port', '4190')),
  out: option('out', ''),
  json: flag('json'),
  headed: flag('headed'),
  verbose: flag('verbose'),
  entities: option('entities', 'nodes,members').split(',').map((entry) => entry.trim()).filter(Boolean),
  screenshots: option('screenshots', ''),
};

/** Traza de progreso por stderr: una medición que se cuelga tiene que decir dónde. */
const trace = (message) => {
  if (options.verbose) console.error(`· ${new Date().toISOString().slice(11, 19)} ${message}`);
};

// Una promesa suelta que rechaza al cerrar el contexto no puede tumbar el
// proceso sin decir en qué fase estaba.
process.on('unhandledRejection', (error) => {
  // No mata el proceso: al cerrar el contexto tras un fallo real, las esperas
  // que quedaron vivas rechazan, y ese ruido no puede tapar la causa.
  console.error(`(aviso) promesa rechazada sin manejar: ${error instanceof Error ? error.message : error}`);
});

if (!Number.isInteger(options.repeats) || options.repeats < 1) {
  throw new Error('--repeats debe ser un entero >= 1');
}
if (!['X2', 'K0', 'both'].includes(options.shell)) {
  throw new Error('--shell debe ser X2, K0 o both');
}

/**
 * Viewports de referencia. Salen del resolutor real (`shellComposition.ts`), no
 * de un número redondo: X2 exige holgura de ancho para dos docks laterales y
 * K0 es el teléfono. El script COMPRUEBA después qué clase resolvió el producto
 * leyendo `data-shell-class`, y si no coincide lo dice en vez de mentir.
 */
const SHELL_VIEWPORTS = {
  X2: { width: 1440, height: 900 },
  K0: { width: 390, height: 844 },
};

// ---------------------------------------------------------------------------
// Estadística
// ---------------------------------------------------------------------------

const quantile = (sorted, q) => {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
};

const round = (value) => (value === null || value === undefined ? null : Math.round(value * 10) / 10);

/** Resumen de una muestra: nunca se reporta un único valor accidental. */
const summarize = (samples) => {
  const clean = samples.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
  return {
    n: clean.length,
    min: round(clean[0] ?? null),
    median: round(quantile(clean, 0.5)),
    p95: round(quantile(clean, 0.95)),
    max: round(clean[clean.length - 1] ?? null),
    samples: clean.map(round),
  };
};

// ---------------------------------------------------------------------------
// Instrumentación dentro de la página
// ---------------------------------------------------------------------------

/**
 * Se inyecta con `addInitScript`, así que existe desde antes del primer script
 * de la aplicación. No toca el producto: sólo observa eventos y fotogramas.
 */
const INSTRUMENTATION = `(() => {
  const grid = () => document.querySelector('.datasheet-grid');
  const rows = () => document.querySelectorAll('.datasheet-grid tbody tr').length;
  const paletteOptions = () => document.querySelectorAll('.command-palette-list [role="option"]').length;

  const conditions = {
    datasheetRows: (arg) => rows() >= (arg || 1),
    datasheetRowsExactly: (arg) => rows() === arg,
    datasheetGone: () => !grid(),
    cellEditor: () => !!document.querySelector('.datasheet-cell-editor'),
    cellEditorGone: () => !document.querySelector('.datasheet-cell-editor'),
    pendingCells: (arg) => document.querySelectorAll('.datasheet-grid [data-pending="true"]').length >= (arg || 1),
    draftBar: () => !!document.querySelector('.datasheet-draft-bar'),
    draftBarGone: () => !document.querySelector('.datasheet-draft-bar'),
    paletteOptions: (arg) => paletteOptions() >= (arg || 1),
    paletteAtMost: (arg) => !!document.querySelector('.command-palette-list') && paletteOptions() <= arg,
    paletteGone: () => !document.querySelector('.command-palette'),
    focusedCellChanged: (arg) => {
      const cell = document.querySelector('.datasheet-grid [data-datasheet-focused="true"]');
      return !!cell && !cell.querySelector('.datasheet-cell-editor') && cell.textContent !== arg;
    },
    focusMoved: (arg) => {
      const cell = document.querySelector('.datasheet-grid [data-datasheet-focused="true"]');
      const row = cell && cell.closest('tr');
      return !!row && Number(row.getAttribute('aria-rowindex')) === arg;
    },
  };

  const state = { gesture: null, inputs: [], frames: null, longTasks: [] };

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(performance.now())));

  // Latencia de entrada estilo INP: del \`timeStamp\` del evento confiable al
  // primer fotograma posterior al repintado (dos rAF). Sobreestima como mucho
  // un fotograma; se declara como limitación en el informe.
  const recordInput = (event) => {
    const start = event.timeStamp;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      state.inputs.push({ type: event.type, key: event.key || null, ms: performance.now() - start });
    }));
  };
  window.addEventListener('keydown', recordInput, true);
  window.addEventListener('pointerdown', recordInput, true);

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.longTasks.push({ start: entry.startTime, ms: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* WebKit y Firefox no exponen longtask; no es obligatorio. */ }

  window.__cri93 = {
    armGesture(kind) {
      state.gesture = null;
      const handler = (event) => {
        if (state.gesture === null) state.gesture = event.timeStamp;
        window.removeEventListener(kind, handler, true);
      };
      window.addEventListener(kind, handler, true);
    },
    armInputs() { state.inputs = []; },
    takeInputs() { const taken = state.inputs.slice(); state.inputs = []; return taken; },
    takeLongTasks() { const taken = state.longTasks.slice(); state.longTasks = []; return taken; },

    /* Espera sin cronómetro: sólo para dejar la interfaz en el estado de
       partida antes de medir. */
    async awaitSettled(name, arg, timeoutMs) {
      const check = conditions[name];
      if (!check) throw new Error('condición desconocida: ' + name);
      const deadline = performance.now() + (timeoutMs || 30000);
      while (!check(arg)) {
        if (performance.now() > deadline) throw new Error('timeout esperando ' + name);
        await nextFrame();
      }
      await nextFrame();
      return true;
    },

    /** Espera a que se cumpla \`name\` y devuelve el tiempo desde el gesto real. */
    async awaitCondition(name, arg, timeoutMs) {
      const check = conditions[name];
      if (!check) throw new Error('condición desconocida: ' + name);
      const deadline = performance.now() + (timeoutMs || 30000);
      while (state.gesture === null) {
        if (performance.now() > deadline) throw new Error('sin gesto para ' + name);
        await nextFrame();
      }
      while (!check(arg)) {
        if (performance.now() > deadline) throw new Error('timeout en ' + name);
        await nextFrame();
      }
      // Un fotograma más: al observarlo en rAF el pintado puede estar en curso.
      const painted = await nextFrame();
      return painted - state.gesture;
    },

    /**
     * Apertura completa medida en UN SOLO bucle de fotogramas: primera fila,
     * tabla entera e interactivo salen del mismo reloj y del mismo gesto, así
     * que no pueden contradecirse entre sí. «Interactivo» = la condición ya se
     * cumple Y el hilo principal ha servido tres fotogramas seguidos por debajo
     * de 50 ms, es decir, ya puede atender al usuario.
     */
    async awaitOpen(name, expected, timeoutMs) {
      const check = conditions[name];
      if (!check) throw new Error('condición desconocida: ' + name);
      const deadline = performance.now() + (timeoutMs || 60000);
      while (state.gesture === null) {
        if (performance.now() > deadline) throw new Error('sin gesto para ' + name);
        await nextFrame();
      }
      let previous = await nextFrame();
      let quiet = 0;
      let firstHit = null;
      let fullHit = null;
      for (;;) {
        const now = await nextFrame();
        const gap = now - previous;
        previous = now;
        if (firstHit === null && check(1)) firstHit = now - state.gesture;
        if (fullHit === null && check(expected)) fullHit = now - state.gesture;
        quiet = gap <= 50 ? quiet + 1 : 0;
        if (fullHit !== null && quiet >= 3) {
          return { first: firstHit, full: fullHit, interactive: now - state.gesture };
        }
        if (now > deadline) throw new Error('timeout de apertura en ' + name);
      }
    },

    startFrames() {
      state.frames = { gaps: [], running: true, startedAt: performance.now() };
      let previous = performance.now();
      const tick = (now) => {
        if (!state.frames || !state.frames.running) return;
        state.frames.gaps.push(now - previous);
        previous = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame((now) => { previous = now; requestAnimationFrame(tick); });
    },
    stopFrames() {
      if (!state.frames) return { gaps: [], durationMs: 0 };
      state.frames.running = false;
      const result = { gaps: state.frames.gaps.slice(), durationMs: performance.now() - state.frames.startedAt };
      state.frames = null;
      return result;
    },

    /**
     * Que superficie desplaza el usuario. En Expanded es el propio contenedor
     * de la rejilla; en Compact la rejilla queda con altura ~0 dentro de un
     * .datasheet-layout que es el que scrollea (ver datasheet.css, media query
     * de 1023 px). Se elige la que de verdad se puede desplazar, en vez de
     * inventar un desplazamiento que el usuario no puede hacer.
     */
    scrollTarget() {
      const scrollable = (element) => !!element
        && element.clientHeight >= 80
        && element.scrollHeight > element.clientHeight + 40;
      const grid = document.querySelector('.datasheet-grid-scroll');
      if (scrollable(grid)) return { selector: '.datasheet-grid-scroll', userScrollable: true };
      const layout = document.querySelector('.datasheet-layout');
      if (scrollable(layout)) return { selector: '.datasheet-layout', userScrollable: true };
      /* Ninguna superficie de la hoja se puede desplazar con la mano. Se sigue
         midiendo el coste de mover el contenido, pero queda marcado: presentar
         ese número como "coste de scroll del usuario" sería mentir. */
      return grid ? { selector: '.datasheet-grid-scroll', userScrollable: false } : null;
    },
    scrollGeometry(selector) {
      const scroller = document.querySelector(selector);
      if (!scroller) return null;
      return {
        selector,
        scrollTop: scroller.scrollTop,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
      };
    },
    scrollBy(selector, delta) {
      const scroller = document.querySelector(selector);
      if (!scroller) return false;
      scroller.scrollTop += delta;
      return true;
    },
    /* Se puede pinchar esta celda de verdad, o hay algo encima? */
    cellHitTestable(rowIndex, columnIndex) {
      const cell = document.querySelector('.datasheet-grid tbody tr:nth-child(' + rowIndex + ') > *:nth-child(' + columnIndex + ')');
      if (!cell) return false;
      const rect = cell.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return false;
      /* Mismo punto que usaría el puntero de Playwright y el dedo del usuario:
         el centro del rectángulo. Comprobarlo en otro sitio daría un permiso
         que la pulsación real no tiene. */
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === cell || cell.contains(hit));
    },
    activeEntityTabIndex() {
      const tabs = Array.prototype.slice.call(document.querySelectorAll('.datasheet-entity button'));
      return tabs.findIndex(function (tab) { return tab.getAttribute('aria-pressed') === 'true'; });
    },
    entityTabHitTestable(index) {
      const tab = document.querySelectorAll('.datasheet-entity button')[index];
      if (!tab) return false;
      const rect = tab.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return false;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === tab || tab.contains(hit));
    },
    focusedEntityTabIndex() {
      const tabs = Array.prototype.slice.call(document.querySelectorAll('.datasheet-entity button'));
      return tabs.indexOf(document.activeElement);
    },
    focusedCell() {
      const cell = document.querySelector('.datasheet-grid [data-datasheet-focused="true"]');
      if (!cell) return null;
      const row = cell.closest('tr');
      return {
        text: cell.textContent,
        columnIndex: Number(cell.getAttribute('aria-colindex')),
        rowIndex: row ? Number(row.getAttribute('aria-rowindex')) : null,
        editability: cell.getAttribute('data-editability'),
        domFocused: document.activeElement === cell,
      };
    },
    /* El foco tiene que estar en la CELDA itinerante: la cabecera de la rejilla
       también es tabulable y desde un botón de ordenar las flechas no navegan. */
    gridCellHasDomFocus() {
      const cell = document.querySelector('.datasheet-grid tbody [data-datasheet-focused="true"]');
      return !!cell && document.activeElement === cell;
    },
    counts() {
      return {
        rows: rows(),
        paletteOptions: paletteOptions(),
        ariaRowCount: grid() ? Number(grid().getAttribute('aria-rowcount')) : null,
      };
    },
    environment() {
      const shell = document.querySelector('.app-shell');
      return {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        deviceMemoryGb: navigator.deviceMemory || null,
        devicePixelRatio: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screen: { width: screen.width, height: screen.height },
        maxTouchPoints: navigator.maxTouchPoints,
        shellClass: shell ? shell.getAttribute('data-shell-class') : null,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      };
    },
  };
})();`;

// ---------------------------------------------------------------------------
// Guion de medición
// ---------------------------------------------------------------------------

const PROJECT = createLargeProject();
const ENTITY_COUNTS = countEntities(PROJECT);
const ROW_COUNTS = datasheetRowCounts(PROJECT);
const ENTITY_TAB_INDEX = { nodes: 0, members: 1, loads: 2 };
/** Columna numérica editable en línea de cada pestaña (ver `datasheetModel.ts`). */
const EDIT_COLUMN = { nodes: 1, members: 7 };

const _armed = async (page, kind, name, arg, timeout = 30000) => {
  await page.evaluate((k) => window.__cri93.armGesture(k), kind);
  return page.evaluate(
    ([conditionName, conditionArg, timeoutMs]) => window.__cri93.awaitCondition(conditionName, conditionArg, timeoutMs),
    [name, arg, timeout],
  );
};

/**
 * Siembra el modelo en `localStorage` ANTES de que arranque la aplicación, en
 * cada navegación. Sembrarlo desde fuera con la página ya viva es una carrera
 * perdida: el guardado del propio producto puede sobrescribir la clave entre el
 * `evaluate` y la navegación, y entonces se mediría el proyecto en blanco.
 */
const seedScript = ({ project, key }) => {
  try {
    localStorage.setItem(key, JSON.stringify(project));
  } catch {
    // Sin almacenamiento el harness fallará después, al verificar el modelo.
  }
};

const enterWorkspace = async (page, baseURL) => {
  await page.goto(baseURL, { waitUntil: 'load' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 60000 });
  const shell = page.locator('.app-shell');
  const resume = page.locator('.welcome-resume-card');
  // CRI-104 dejó el salto directo a la Mesa cuando el repositorio ya tiene
  // proyectos guardados: unas veces el producto entra solo y otras hay que
  // pulsar «Continuar proyecto». Las dos son la ruta real del usuario, así que
  // se acepta la que ocurra; lo que no se acepta es entrar por otro sitio.
  let clicked = false;
  const deadline = Date.now() + 120000;
  for (;;) {
    if (await shell.count() > 0) break;
    if (!clicked && await resume.count() > 0) {
      await resume.click().catch(() => {});
      clicked = true;
    }
    if (Date.now() > deadline) throw new Error('no se llegó a la Mesa de trabajo');
    await page.waitForTimeout(200);
  }
  await shell.waitFor({ state: 'visible', timeout: 120000 });
  // El producto tiene que haber cargado EL modelo grande: si cargó otro, medir
  // no significa nada. Se comprueba contra el propio store persistido.
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('structureCo.project');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { nodes: parsed.nodes.length, members: parsed.members.length };
  });
  if (!stored || stored.nodes !== ROW_COUNTS.nodes || stored.members !== ROW_COUNTS.members) {
    throw new Error(`El proyecto cargado no es el modelo grande: ${JSON.stringify(stored)}`);
  }
};

const closeDatasheet = async (page) => {
  const grid = page.locator('.datasheet-grid');
  if (await grid.count() === 0) return;
  // Con el foco dentro de la rejilla, la primera pulsación de Escape limpia la
  // selección y no cierra (es el contrato del Datasheet). Se cierra por el
  // botón de la superficie, que es lo que el usuario tiene siempre a mano.
  const close = page.locator('[data-workspace-surface="datasheet"] .sc-modal-surface__close');
  if (await close.count() > 0) await close.first().click().catch(() => {});
  for (let attempt = 0; attempt < 4 && await grid.count() > 0; attempt += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await grid.waitFor({ state: 'detached', timeout: 20000 });
};

/** Abre el Datasheet desde el botón real de la TopBar y cronometra la apertura. */
const assertLiveModel = async (page) => {
  const counts = await page.locator('.datasheet-entity__count').allInnerTexts();
  const live = counts.map((text) => Number(text.trim()));
  const expected = [ROW_COUNTS.nodes, ROW_COUNTS.members, ROW_COUNTS.loads];
  if (live.length !== 3 || live.some((value, index) => value !== expected[index])) {
    throw new Error(`El Datasheet no está enseñando el modelo grande: ${JSON.stringify(live)} != ${JSON.stringify(expected)}`);
  }
};

/**
 * Devuelve el disparador visible del Datasheet. En Compact la TopBar recoge el
 * botón dentro del menú de desbordamiento; el menú se abre ANTES de armar el
 * cronómetro para no cargarle a la apertura del Datasheet un coste que no es
 * suyo, pero la ruta sigue siendo la del usuario real.
 */
const datasheetTrigger = async (page) => {
  const direct = page.locator('.datasheet-launcher');
  if (await direct.isVisible().catch(() => false)) return direct;
  const more = page.locator('.mobile-more-button');
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    const overflow = page.locator('.overflow-datasheet');
    await overflow.waitFor({ state: 'visible', timeout: 20000 });
    return overflow;
  }
  throw new Error('no hay forma visible de abrir el Datasheet en esta composición');
};

const reachEntityTabWithKeyboard = async (page, index) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (await page.evaluate((i) => window.__cri93.focusedEntityTabIndex() === i, index)) return;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(30);
  }
  throw new Error('no se alcanzó la pestaña de entidad con el teclado');
};

/** Selecciona una pestaña sin cronometrar, por la ruta que la composición permita. */
const selectEntityTab = async (page, index) => {
  if (await page.evaluate((i) => window.__cri93.entityTabHitTestable(i), index)) {
    await page.locator('.datasheet-entity button').nth(index).click();
    return;
  }
  await reachEntityTabWithKeyboard(page, index);
  await page.keyboard.press('Enter');
};

const openDatasheet = async (page, entity) => {
  const expected = ROW_COUNTS[entity];
  const trigger = await datasheetTrigger(page);
  await page.evaluate((k) => window.__cri93.armGesture(k), 'pointerdown');
  const opening = page.evaluate(([n]) => window.__cri93.awaitOpen('datasheetRows', n, 90000), [ROW_COUNTS.nodes]);
  await trigger.click();
  const launcher = await opening;
  const opened = { firstRow: launcher.first, allRows: launcher.full, interactive: launcher.interactive };

  if (entity === 'nodes') return opened;

  // La pestaña mayor se mide como su propio gesto: es la ruta real por la que
  // el usuario llega a la tabla grande, y es donde el coste se ve. En Compact
  // el panel de contexto se superpone a la barra de pestañas y el puntero no
  // llega: entonces se conmuta por teclado, que sí es una ruta real, y se
  // anota cuál se usó en vez de fingir que fue la misma.
  const index = ENTITY_TAB_INDEX[entity];
  // La superficie retenida conserva la pestaña entre aperturas (X2). Si ya
  // estuviera en Barras, "cambiar a Barras" no repintaría nada y la medición
  // saldría instantánea y falsa. Se vuelve a Nudos primero, sin cronómetro.
  if (await page.evaluate(() => window.__cri93.activeEntityTabIndex()) !== ENTITY_TAB_INDEX.nodes) {
    await selectEntityTab(page, ENTITY_TAB_INDEX.nodes);
    await page.evaluate(([n]) => window.__cri93.awaitSettled('datasheetRowsExactly', n, 60000), [ROW_COUNTS.nodes]);
  }
  const clickable = await page.evaluate((i) => window.__cri93.entityTabHitTestable(i), index);
  const route = clickable ? 'pointer' : 'keyboard';
  if (!clickable) await reachEntityTabWithKeyboard(page, index);
  await page.evaluate((k) => window.__cri93.armGesture(k), clickable ? 'pointerdown' : 'keydown');
  const switching = page.evaluate(([n]) => window.__cri93.awaitOpen('datasheetRows', n, 90000), [expected]);
  if (clickable) await page.locator('.datasheet-entity button').nth(index).click();
  else await page.keyboard.press('Enter');
  const switched = await switching;
  return {
    firstRow: switched.first,
    allRows: switched.full,
    interactive: switched.interactive,
    entitySwitchRoute: route,
    openedFromLauncher: opened,
  };
};

/** Coste de desplazamiento: rueda real si el motor la soporta, scroll programado si no. */
const measureScroll = async (page) => {
  const target = await page.evaluate(() => window.__cri93.scrollTarget());
  if (!target) throw new Error('no hay superficie de desplazamiento en el datasheet');
  const { selector, userScrollable } = target;
  const box = await page.locator(selector).boundingBox();
  const before = await page.evaluate((target) => window.__cri93.scrollGeometry(target), selector);
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 300));

  const steps = 12;
  const delta = 900;
  const wheelRun = async () => {
    await page.evaluate(() => window.__cri93.startFrames());
    for (let step = 0; step < steps; step += 1) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(60);
    }
    return page.evaluate(() => window.__cri93.stopFrames());
  };
  const programmaticRun = async () => {
    await page.evaluate(() => window.__cri93.startFrames());
    for (let step = 0; step < steps; step += 1) {
      await page.evaluate(([target, amount]) => window.__cri93.scrollBy(target, amount), [selector, delta]);
      await page.waitForTimeout(60);
    }
    return page.evaluate(() => window.__cri93.stopFrames());
  };

  let driver = 'wheel';
  let frames;
  try {
    frames = await wheelRun();
  } catch {
    driver = 'programmatic';
    frames = await programmaticRun();
  }
  let after = await page.evaluate((target) => window.__cri93.scrollGeometry(target), selector);
  if (driver === 'wheel' && before && after && after.scrollTop === before.scrollTop) {
    // La rueda no movió nada (ocurre en WebKit según plataforma): se repite con
    // scroll programado antes que reportar un coste de desplazamiento falso.
    driver = 'programmatic';
    frames = await programmaticRun();
    after = await page.evaluate((target) => window.__cri93.scrollGeometry(target), selector);
  }
  return { driver, selector, userScrollable, frames, before, after, steps, delta };
};

const frameStats = (frames) => {
  const gaps = frames.gaps.filter((gap) => Number.isFinite(gap) && gap > 0);
  const sorted = gaps.slice().sort((a, b) => a - b);
  const budget = 1000 / 60;
  return {
    frames: gaps.length,
    durationMs: round(frames.durationMs),
    meanMs: round(gaps.reduce((sum, gap) => sum + gap, 0) / (gaps.length || 1)),
    medianMs: round(quantile(sorted, 0.5)),
    p95Ms: round(quantile(sorted, 0.95)),
    worstMs: round(sorted[sorted.length - 1] ?? null),
    longFrames: gaps.filter((gap) => gap > budget * 1.5).length,
  };
};

/**
 * Lleva el foco DENTRO de la rejilla con el teclado, como haría quien navega
 * sin ratón: la rejilla es una única parada de tabulación (patrón `grid`).
 * No se usa `.focus()` programático porque el foco itinerante de la rejilla es
 * estado de React y sólo se mueve con eventos reales.
 */
const focusGridByKeyboard = async (page) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (await page.evaluate(() => window.__cri93.gridCellHasDomFocus())) return attempt;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(30);
  }
  throw new Error('el teclado no alcanzó la rejilla del datasheet');
};

/** Navegación por teclado dentro de la rejilla: la ruta de edición masiva. */
const measureGridKeyboard = async (page, downSteps = 6) => {
  await focusGridByKeyboard(page);
  await page.evaluate(() => window.__cri93.armInputs());
  for (let step = 0; step < downSteps; step += 1) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(220);
  return (await page.evaluate(() => window.__cri93.takeInputs()))
    .filter((sample) => sample.type === 'keydown')
    .map((sample) => sample.ms);
};

/**
 * Edición de celda por las dos rutas reales.
 *
 * Teclado: se llega a la celda con flechas, se abre con F2, se teclea y se
 * confirma con Enter. Ratón: doble pulsación, sólo si la celda es pinchable de
 * verdad — en Compact el panel de contexto tapa la rejilla y esa ruta no
 * existe; se reporta como no disponible en vez de forzar un número.
 */
const measureCellEdit = async (page, entity, value) => {
  const column = EDIT_COLUMN[entity];
  await focusGridByKeyboard(page);
  for (let step = 0; step < column; step += 1) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(60);
  }
  const focused = await page.evaluate(() => window.__cri93.focusedCell());
  if (!focused || focused.columnIndex !== column + 1) {
    throw new Error(`el foco no llegó a la columna editable: ${JSON.stringify(focused)}`);
  }

  // Ratón, cuando la composición lo permite.
  let editorOpenMouse = null;
  let mouseUnavailable = null;
  const hitTestable = await page.evaluate(
    ([rowIndex, columnIndex]) => window.__cri93.cellHitTestable(rowIndex, columnIndex),
    [focused.rowIndex - 1, column + 1],
  );
  if (hitTestable) {
    const cell = page.locator(`.datasheet-grid tbody tr:nth-child(${focused.rowIndex - 1}) > *:nth-child(${column + 1})`);
    await page.evaluate(() => window.__cri93.armGesture('pointerdown'));
    const mouseEditor = page.evaluate(() => window.__cri93.awaitCondition('cellEditor', 1, 30000));
    await cell.dblclick();
    editorOpenMouse = await mouseEditor;
    await page.keyboard.press('Escape');
    await page.locator('.datasheet-cell-editor').waitFor({ state: 'detached', timeout: 20000 });
  } else {
    mouseUnavailable = 'la rejilla no es pinchable en esta composición (el panel de contexto la cubre)';
  }

  // Teclado: F2 abre el editor sobre la celda enfocada.
  await page.evaluate(() => window.__cri93.armGesture('keydown'));
  const keyboardEditor = page.evaluate(() => window.__cri93.awaitCondition('cellEditor', 1, 30000));
  await page.keyboard.press('F2');
  const editorOpenKeyboard = await keyboardEditor;

  // Tecleo dentro del editor: una muestra de latencia por pulsación.
  await page.evaluate(() => window.__cri93.armInputs());
  await page.keyboard.type(value, { delay: 90 });
  await page.waitForTimeout(260);
  const typing = (await page.evaluate(() => window.__cri93.takeInputs()))
    .filter((sample) => sample.type === 'keydown')
    .map((sample) => sample.ms);

  // Enter. En el producto, una edición válida y única sobre un borrador vacío
  // se escribe YA en el modelo (`onCommitEdit`), con un solo `updateProject`:
  // esto es, literalmente, la escritura de celda. Se espera a que la celda
  // enfocada muestre otro valor, no un texto concreto, para no depender del
  // formato de unidades.
  const before = (await page.evaluate(() => window.__cri93.focusedCell()))?.text ?? null;
  await page.evaluate(() => window.__cri93.armGesture('keydown'));
  const written = page.evaluate(([previous]) => window.__cri93.awaitCondition('focusedCellChanged', previous, 60000), [before]);
  await page.keyboard.press('Enter');
  const writeToModel = await written;

  return { editorOpenMouse, mouseUnavailable, editorOpenKeyboard, typing, writeToModel };
};

/** Palette: apertura y tecleo con la navegación por ID activa. */
const measurePalette = async (page, needle) => {
  await closeDatasheet(page);
  await page.locator('.app-shell').click({ position: { x: 5, y: 5 } }).catch(() => {});

  await page.evaluate(() => window.__cri93.armGesture('keydown'));
  const opening = page.evaluate(() => window.__cri93.awaitOpen('paletteOptions', 1, 60000));
  await page.keyboard.press('Control+k');
  const opened = await opening;
  const open = opened.first;
  const interactive = opened.interactive;
  const rendered = (await page.evaluate(() => window.__cri93.counts())).paletteOptions;

  await page.evaluate(() => window.__cri93.armInputs());
  await page.keyboard.type(needle, { delay: 110 });
  await page.waitForTimeout(320);
  const typing = (await page.evaluate(() => window.__cri93.takeInputs()))
    .filter((sample) => sample.type === 'keydown')
    .map((sample) => sample.ms);
  const filtered = (await page.evaluate(() => window.__cri93.counts())).paletteOptions;

  await page.keyboard.press('Escape');
  await page.locator('.command-palette').waitFor({ state: 'detached', timeout: 20000 });
  return { open, interactive, typing, renderedOptions: rendered, filteredOptions: filtered };
};

const runScenario = async (page, baseURL, label) => {
  const result = {
    label,
    entities: {},
    palette: null,
    environment: null,
    errors: [],
    console: [],
  };
  page.on('console', (message) => { if (message.type() === 'error') result.console.push(message.text()); });
  page.on('pageerror', (error) => result.errors.push(String(error)));
  page.on('crash', () => {
    result.errors.push('la pestaña se cayó (crash del renderizador)');
    trace('  ¡CRASH del renderizador!');
  });

  for (const entity of options.entities) {
    trace(`escenario ${label} · entidad ${entity}`);
    const samples = {
      firstRowCold: null,
      allRowsCold: null,
      interactiveCold: null,
      firstRow: [],
      allRows: [],
      interactive: [],
      scroll: [],
      editorOpenMouse: [],
      editorOpenKeyboard: [],
      typing: [],
      writeToModel: [],
      gridKeyboard: [],
      longTasks: [],
    };

    // Frío: página recién cargada, el trozo diferido del Datasheet sin descargar.
    await enterWorkspace(page, baseURL);
    trace('  en la Mesa de trabajo');
    const cold = await openDatasheet(page, entity);
    trace(`  apertura en frío: ${round(cold.firstRow)} ms`);
    await assertLiveModel(page);
    samples.firstRowCold = round(cold.firstRow);
    samples.allRowsCold = round(cold.allRows);
    samples.interactiveCold = round(cold.interactive);
    if (cold.openedFromLauncher) {
      samples.launcherCold = {
        firstRow: round(cold.openedFromLauncher.firstRow),
        allRows: round(cold.openedFromLauncher.allRows),
        interactive: round(cold.openedFromLauncher.interactive),
      };
    }
    samples.ariaRowCount = (await page.evaluate(() => window.__cri93.counts())).ariaRowCount;
    samples.entitySwitchRoute = cold.entitySwitchRoute ?? 'launcher';
    if (options.screenshots) {
      const directory = path.resolve(ROOT, options.screenshots);
      fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, `${label}-${entity}.png`);
      await page.screenshot({ path: file });
      trace(`  captura: ${path.relative(ROOT, file)}`);
    }
    result.environment ??= await page.evaluate(() => window.__cri93.environment());

    for (let repetition = 0; repetition < options.repeats; repetition += 1) {
      if (repetition > 0) {
        await closeDatasheet(page);
        const warm = await openDatasheet(page, entity);
        samples.firstRow.push(warm.firstRow);
        samples.allRows.push(warm.allRows);
        samples.interactive.push(warm.interactive);
      } else {
        samples.firstRow.push(cold.firstRow);
        samples.allRows.push(cold.allRows);
        samples.interactive.push(cold.interactive);
      }

      trace(`  repetición ${repetition + 1}/${options.repeats}: scroll`);
      samples.scroll.push(await measureScroll(page));
      trace('  teclado en la rejilla');
      // Cada repetición baja unas filas más, para no medir siempre la misma celda.
      samples.gridKeyboard.push(...await measureGridKeyboard(page, 4 + repetition));
      trace('  edición de celda');
      const edit = await measureCellEdit(page, entity, `${12 + repetition}.5`);
      if (edit.editorOpenMouse !== null) samples.editorOpenMouse.push(edit.editorOpenMouse);
      else samples.mouseUnavailable = edit.mouseUnavailable;
      samples.editorOpenKeyboard.push(edit.editorOpenKeyboard);
      samples.typing.push(...edit.typing);
      samples.writeToModel.push(edit.writeToModel);
      samples.longTasks.push(...(await page.evaluate(() => window.__cri93.takeLongTasks())).map((task) => task.ms));
    }

    result.entities[entity] = {
      rows: ROW_COUNTS[entity],
      ariaRowCount: samples.ariaRowCount,
      route: samples.entitySwitchRoute,
      cold: {
        firstRowMs: samples.firstRowCold,
        allRowsMs: samples.allRowsCold,
        interactiveMs: samples.interactiveCold,
        launcher: samples.launcherCold ?? null,
      },
      timeToFirstRowMs: summarize(samples.firstRow),
      timeToAllRowsMs: summarize(samples.allRows),
      timeToInteractiveMs: summarize(samples.interactive),
      scroll: {
        driver: samples.scroll[0]?.driver ?? null,
        surface: samples.scroll[0]?.selector ?? null,
        userScrollable: samples.scroll[0]?.userScrollable ?? null,
        geometry: samples.scroll[0]?.before ?? null,
        moved: samples.scroll.map((entry) => round((entry.after?.scrollTop ?? 0) - (entry.before?.scrollTop ?? 0))),
        perRun: samples.scroll.map((entry) => frameStats(entry.frames)),
        frameP95Ms: summarize(samples.scroll.map((entry) => frameStats(entry.frames).p95Ms)),
        frameWorstMs: summarize(samples.scroll.map((entry) => frameStats(entry.frames).worstMs)),
        longFrames: samples.scroll.map((entry) => frameStats(entry.frames).longFrames),
      },
      edit: {
        editorOpenMouseMs: summarize(samples.editorOpenMouse),
        mouseUnavailable: samples.mouseUnavailable ?? null,
        editorOpenKeyboardMs: summarize(samples.editorOpenKeyboard),
        keystrokeMs: summarize(samples.typing),
        writeToModelMs: summarize(samples.writeToModel),
        gridArrowKeyMs: summarize(samples.gridKeyboard),
      },
      longTaskMs: summarize(samples.longTasks),
    };
  }

  // Palette: se mide sobre el mismo modelo, con la navegación por ID activa.
  const needle = PROJECT.nodes[Math.floor(PROJECT.nodes.length / 2)].id;
  const paletteRuns = [];
  for (let repetition = 0; repetition < options.repeats; repetition += 1) {
    trace(`palette ${repetition + 1}/${options.repeats}`);
    paletteRuns.push(await measurePalette(page, needle));
  }
  result.palette = {
    needle,
    renderedOptions: paletteRuns[0].renderedOptions,
    filteredOptions: paletteRuns[0].filteredOptions,
    openMs: summarize(paletteRuns.map((run) => run.open)),
    interactiveMs: summarize(paletteRuns.map((run) => run.interactive)),
    keystrokeMs: summarize(paletteRuns.flatMap((run) => run.typing)),
  };
  result.environment = await page.evaluate(() => window.__cri93.environment());
  return result;
};

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('dist/ no existe; ejecuta `npm run build` antes de medir.');
  process.exit(1);
}

const previewServer = await preview({
  root: ROOT,
  preview: { host: options.host, port: options.port, strictPort: true },
  logLevel: 'error',
});
const baseURL = `http://${options.host === '0.0.0.0' ? '127.0.0.1' : options.host}:${options.port}/`;

if (options.serveOnly) {
  const urls = previewServer.resolvedUrls;
  console.log('Build servida para medición en dispositivo físico.\n');
  console.log(`  local:  ${urls?.local?.join(' ') ?? baseURL}`);
  console.log(`  red:    ${urls?.network?.join(' ') ?? '(usa --host=0.0.0.0 para exponerla en la red local)'}`);
  console.log('\nEn el dispositivo: abre la URL de red, y pega en la consola del navegador remoto');
  console.log('el modelo grande (o usa --cdp para que este script lo siembre y mida solo).');
  console.log(`\nModelo: ${ENTITY_COUNTS.total} entidades · filas por pestaña ${JSON.stringify(ROW_COUNTS)}`);
  console.log('\nCtrl+C para parar.');
  await new Promise(() => {});
}

const launchers = { chromium, webkit, firefox };
let browser;
let attached = false;
if (options.cdp) {
  browser = await chromium.connectOverCDP(options.cdp);
  attached = true;
} else {
  browser = await launchers[options.engine].launch({
    headless: !options.headed,
    ...(options.engine === 'chromium'
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
  });
}

const shellTargets = attached
  ? ['device']
  : options.shell === 'both' ? ['X2', 'K0'] : [options.shell];

const runs = [];
try {
  for (const target of shellTargets) {
    const context = attached
      ? (browser.contexts()[0] ?? await browser.newContext())
      : await browser.newContext({ viewport: SHELL_VIEWPORTS[target], deviceScaleFactor: 1 });
    await context.addInitScript(INSTRUMENTATION);
    await context.addInitScript(seedScript, { project: PROJECT, key: 'structureCo.project' });
    const page = attached && context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    if (attached) {
      await page.evaluate(INSTRUMENTATION).catch(() => {});
      await page.evaluate(seedScript, { project: PROJECT, key: 'structureCo.project' }).catch(() => {});
    }
    const scenario = await runScenario(page, baseURL, target);
    runs.push({
      requestedShell: target,
      resolvedShellClass: scenario.environment?.shellClass ?? null,
      engine: attached ? 'cdp-attached' : options.engine,
      engineVersion: browser.version(),
      deviceKind: options.device ? 'declared-physical' : 'container-headless',
      deviceLabel: options.device || `${process.platform} ${process.arch} · contenedor de desarrollo`,
      headless: !options.headed && !attached,
      ...scenario,
    });
    if (!attached) await context.close();
  }
} finally {
  if (!attached) await browser.close();
  else await browser.close().catch(() => {});
  await previewServer.close();
}

const report = {
  issue: 'CRI-93',
  generatedAt: new Date().toISOString(),
  measurementKind: options.device ? 'declared-physical' : 'container-headless',
  warning: options.device
    ? null
    : 'MEDICIÓN NO FÍSICA: ejecutada en el contenedor de desarrollo sin dispositivo real. No satisface el requisito de CRI-93.',
  model: { entities: ENTITY_COUNTS, datasheetRows: ROW_COUNTS, grid: '23x29' },
  repeats: options.repeats,
  runs,
};

if (options.out) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, options.out)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, options.out), `${JSON.stringify(report, null, 2)}\n`);
}

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const cell = (value) => (value === null || value === undefined ? '—' : String(value));
  console.log(`\nCRI-93 · modelo de ${ENTITY_COUNTS.total} entidades (${ROW_COUNTS.nodes} nudos · ${ROW_COUNTS.members} barras)`);
  if (report.warning) console.log(`\n⚠ ${report.warning}`);
  for (const run of runs) {
    console.log(`\n[${run.engine} ${run.engineVersion}] clase ${run.resolvedShellClass} (pedida ${run.requestedShell}) · ${run.deviceLabel}`);
    console.log(`  ${run.environment?.innerWidth}x${run.environment?.innerHeight} · dpr ${run.environment?.devicePixelRatio} · ${run.environment?.hardwareConcurrency} hilos`);
    for (const [entity, data] of Object.entries(run.entities)) {
      console.log(`  ${entity} (${data.rows} filas, aria-rowcount ${data.ariaRowCount})`);
      console.log(`    primera fila   frío ${cell(data.cold.firstRowMs)} ms · mediana ${cell(data.timeToFirstRowMs.median)} · p95 ${cell(data.timeToFirstRowMs.p95)}`);
      console.log(`    interactivo    frío ${cell(data.cold.interactiveMs)} ms · mediana ${cell(data.timeToInteractiveMs.median)} · p95 ${cell(data.timeToInteractiveMs.p95)}`);
      console.log(`    scroll         p95/fotograma ${cell(data.scroll.frameP95Ms.median)} ms · peor ${cell(data.scroll.frameWorstMs.max)} ms · ${data.scroll.driver} sobre ${data.scroll.surface}${data.scroll.userScrollable === false ? ' (NO desplazable por el usuario)' : ''} · recorrido ${data.scroll.moved.join('/')} px`);
      console.log(`    celda teclado  editor ${cell(data.edit.editorOpenKeyboardMs.median)} · tecla ${cell(data.edit.keystrokeMs.median)} · escritura ${cell(data.edit.writeToModelMs.median)} ms (p95 ${cell(data.edit.writeToModelMs.p95)})`);
      console.log(`    celda ratón    editor ${data.edit.mouseUnavailable ? 'no disponible' : `${cell(data.edit.editorOpenMouseMs.median)} ms`} · flecha rejilla ${cell(data.edit.gridArrowKeyMs.median)} ms`);
    }
    console.log(`  palette: apertura mediana ${cell(run.palette.openMs.median)} ms · p95 ${cell(run.palette.openMs.p95)} · tecla mediana ${cell(run.palette.keystrokeMs.median)} ms · p95 ${cell(run.palette.keystrokeMs.p95)}`);
    console.log(`           ${run.palette.renderedOptions} opciones al abrir → ${run.palette.filteredOptions} tras teclear "${run.palette.needle}"`);
    if (run.errors.length) console.log(`  errores de página: ${run.errors.length}`);
  }
}
