/**
 * QA de navegador del presupuesto vertical del Datasheet en K0.
 *
 * Mide LAYOUT REAL sobre la aplicación construida, que es la única forma de
 * demostrar este fallo: en jsdom no hay motor de composición y `clientHeight`
 * siempre vale 0, así que una prueba unitaria no puede distinguir una rejilla
 * colapsada de una sana. Aquí se afirma sobre `clientHeight`, `scrollHeight`,
 * `getComputedStyle().gridTemplateRows` y `elementFromPoint`.
 *
 * Regresión que cubre: apiladas, la rejilla y el panel contextual comparten
 * altura; con la fila del panel en `auto` el panel se servía su alto de
 * contenido entero y la fila de la rejilla se resolvía a `0px`, dejando la
 * tabla invisible, sin desplazamiento y fuera del hit-test.
 *
 * Uso: npm run qa:datasheet-k0
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'reports', 'evidence', '2026-08-20-datasheet-k0-grid-height');
fs.mkdirSync(outDir, { recursive: true });

const previewServer = await preview({
  root: repoRoot,
  preview: { host: '127.0.0.1', port: 4196, strictPort: true },
  logLevel: 'error',
});
const baseURL = 'http://127.0.0.1:4196/';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium',
});

const report = { checks: [], failures: [], measurements: {}, shots: [] };
const check = (name, ok, detail) => {
  if (!ok) report.failures.push({ name, detail });
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
};
const shoot = async (target, name) => {
  const file = path.join(outDir, `${name}.png`);
  await target.screenshot({ path: file });
  report.shots.push(path.relative(repoRoot, file));
};

const CLASSES = {
  'k0-portrait': { width: 390, height: 844 },
  'k0-landscape': { width: 844, height: 390 },
  m1: { width: 1100, height: 768 },
  x2: { width: 1440, height: 900 },
};

/**
 * Modelo con filas de sobra.
 *
 * El fallo se ve igual con pocas filas, pero "hay desplazamiento útil" sólo se
 * puede afirmar si el contenido excede de verdad el carril.
 */
const seedProject = (project) => {
  const nodes = [];
  const members = [];
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      nodes.push({ id: `N${row}_${column}`, x: column * 4, y: row * 3, support: row === 0 ? { type: 'pin' } : { type: 'none' } });
    }
  }
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      members.push({
        id: `M${row}_${column}`, i: `N${row}_${column}`, j: `N${row + 1}_${column}`, type: 'frame',
        E: 2.1e8, A: 0.01, I: 8.3e-5, materialId: 'steel-a36', sectionId: 'ipe-200',
      });
    }
  }
  return { ...project, nodes, members };
};

const newPage = async (viewport) => {
  const page = await browser.newPage({ viewport, locale: 'es-ES', hasTouch: true, colorScheme: 'light' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, register: async () => ({ installing: null, waiting: null, addEventListener: () => undefined }), addEventListener: () => undefined },
    });
  });
  return page;
};

/** Entra a la Mesa por el camino que ofrezca la Bienvenida en esta clase. */
const enterShell = async (page) => {
  const shell = page.locator('.app-shell');
  if (await shell.isVisible().catch(() => false)) return;
  for (const name of [/^nuevo proyecto/i, /ver otras formas de empezar/i, /ir a la mesa/i, /continuar proyecto/i]) {
    const button = page.getByRole('button', { name }).first();
    if (!await button.count()) continue;
    await button.click().catch(() => undefined);
    await page.waitForTimeout(600);
    if (await shell.isVisible().catch(() => false)) return;
  }
  await shell.waitFor({ state: 'visible', timeout: 15_000 });
};

/** Deja el Datasheet abierto sobre un modelo con filas de sobra. */
const openDatasheet = async (page) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 20_000 });
  await enterShell(page);
  await page.waitForTimeout(700);
  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.project')));
  await page.evaluate((next) => localStorage.setItem('structureCo.project', JSON.stringify(next)), seedProject(project));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await enterShell(page);
  await page.waitForTimeout(700);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('structureco:open-datasheet')));
  await page.locator('.datasheet-grid').first().waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(600);
};

/**
 * Marca la celda que cae DENTRO del carril visible de la rejilla y la devuelve
 * como localizador, para poder pincharla con un puntero de verdad.
 *
 * Pinchar una celda que está fuera del viewport no demostraría nada: es
 * justamente lo que seguía "funcionando" con la rejilla colapsada, porque el
 * nodo seguía en el DOM aunque no hubiera dónde verlo ni por dónde tocarlo.
 * Se exige además que el hit-test devuelva esa misma celda: si el panel
 * contextual la tapa, el puntero no llega y la comprobación falla.
 */
const visibleCell = async (page, editability) => {
  const marked = await page.evaluate((wanted) => {
    const scroll = document.querySelector('.datasheet-grid-scroll');
    const viewport = scroll.getBoundingClientRect();
    const selector = wanted
      ? `.datasheet-grid tbody td[data-editability="${wanted}"]`
      : '.datasheet-grid tbody td, .datasheet-grid tbody th';
    document.querySelectorAll('[data-qa-cell]').forEach((node) => node.removeAttribute('data-qa-cell'));
    for (const cell of document.querySelectorAll(selector)) {
      const box = cell.getBoundingClientRect();
      if (box.height <= 0 || box.top < viewport.top || box.bottom > viewport.bottom) continue;
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (document.elementFromPoint(centre.x, centre.y)?.closest('td, th') !== cell) continue;
      cell.setAttribute('data-qa-cell', 'true');
      return true;
    }
    return false;
  }, editability);
  return marked ? page.locator('[data-qa-cell="true"]').first() : null;
};

/** Composición medida: pistas de fila, cajas y hit-test sobre el centro visible. */
const measureLayout = (page) => page.evaluate(() => {
  const box = (element) => (element ? {
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    height: Math.round(element.getBoundingClientRect().height),
  } : null);
  const layout = document.querySelector('.datasheet-layout');
  const scroll = document.querySelector('.datasheet-grid-scroll');
  const rect = scroll.getBoundingClientRect();
  const centre = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
  const atCentre = document.elementFromPoint(centre.x, centre.y);
  return {
    shellClass: document.querySelector('[data-shell-class]')?.getAttribute('data-shell-class') ?? null,
    presentation: document.querySelector('.datasheet-surface')?.classList.contains('sc-modal-surface--fullscreen') ? 'fullscreen' : 'drawer',
    gridTemplateRows: layout ? getComputedStyle(layout).gridTemplateRows : null,
    layout: box(layout),
    main: box(document.querySelector('.datasheet-main')),
    gridScroll: box(scroll),
    context: box(document.querySelector('.datasheet-context')),
    bodyRows: document.querySelectorAll('.datasheet-grid tbody tr').length,
    centre,
    hit: {
      tag: atCentre?.tagName ?? null,
      insideGrid: Boolean(atCentre?.closest?.('.datasheet-grid-scroll')),
      insideContext: Boolean(atCentre?.closest?.('.datasheet-context')),
    },
    documentScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
});

// ---------------------------------------------------------------------------
// 1 · K0 — la rejilla tiene presupuesto propio, se desplaza y recibe entrada
// ---------------------------------------------------------------------------
for (const label of ['k0-portrait', 'k0-landscape']) {
  const page = await newPage(CLASSES[label]);
  await openDatasheet(page);

  const layout = await measureLayout(page);
  report.measurements[label] = layout;

  check(`${label} · K0 en fullscreen`, layout.shellClass === 'K0' && layout.presentation === 'fullscreen',
    { shellClass: layout.shellClass, presentation: layout.presentation });

  // (1) Altura útil > 0. Antes del arreglo la pista valía `0px` y `clientHeight` 0.
  const [gridTrack] = (layout.gridTemplateRows ?? '').split(' ');
  check(`${label} · la fila de la rejilla no colapsa`, Number.parseFloat(gridTrack) > 0,
    { gridTemplateRows: layout.gridTemplateRows });
  check(`${label} · la rejilla tiene viewport con altura positiva`,
    layout.gridScroll.clientHeight > 0 && layout.main.clientHeight > 0,
    { gridScroll: layout.gridScroll, main: layout.main });

  // (2) Desplazamiento útil de verdad: contenido por encima del carril.
  check(`${label} · hay desbordamiento desplazable`,
    layout.gridScroll.scrollHeight > layout.gridScroll.clientHeight && layout.bodyRows > 20,
    { scrollHeight: layout.gridScroll.scrollHeight, clientHeight: layout.gridScroll.clientHeight, bodyRows: layout.bodyRows });

  const scrolled = await page.evaluate(() => {
    const scroll = document.querySelector('.datasheet-grid-scroll');
    const before = scroll.scrollTop;
    scroll.scrollTop = scroll.scrollHeight;
    return { before, after: scroll.scrollTop, max: scroll.scrollHeight - scroll.clientHeight };
  });
  check(`${label} · el desplazamiento avanza`, scrolled.after > scrolled.before && scrolled.after > 0, scrolled);
  await page.evaluate(() => { document.querySelector('.datasheet-grid-scroll').scrollTop = 0; });

  // (3) El centro visible recibe entrada y NO lo tapa el panel contextual.
  check(`${label} · el centro de la rejilla no está tapado por .datasheet-context`,
    layout.hit.insideGrid && !layout.hit.insideContext, layout.hit);

  // (4) El teclado: la rejilla arranca con una celda enfocable, las flechas la
  // recorren y `F2` abre el editor.
  const keyboard = await page.evaluate(() => {
    const cell = document.querySelector("[data-datasheet-focused='true']");
    cell?.focus();
    return {
      marked: document.querySelectorAll("[data-datasheet-focused='true']").length,
      focused: document.activeElement === cell,
      visible: cell ? cell.getBoundingClientRect().height > 0 : false,
    };
  });
  check(`${label} · una celda recibe foco por teclado`,
    keyboard.marked === 1 && keyboard.focused && keyboard.visible, keyboard);

  const columnBefore = await page.evaluate(() => document.querySelector("[data-datasheet-focused='true']")?.getAttribute('aria-colindex') ?? null);
  await page.locator("[data-datasheet-focused='true']").press('ArrowRight');
  await page.waitForTimeout(300);
  const moved = await page.evaluate(() => ({
    inGrid: Boolean(document.activeElement?.closest?.('.datasheet-grid tbody')),
    column: document.querySelector("[data-datasheet-focused='true']")?.getAttribute('aria-colindex') ?? null,
    editability: document.querySelector("[data-datasheet-focused='true']")?.getAttribute('data-editability') ?? null,
  }));
  check(`${label} · el teclado recorre la rejilla`,
    moved.inGrid && moved.column !== null && moved.column !== columnBefore,
    { before: columnBefore, after: moved });

  await page.locator("[data-datasheet-focused='true']").press('F2');
  await page.waitForTimeout(400);
  const editorOpen = await page.evaluate(() => {
    const editor = document.querySelector('.datasheet-cell-editor');
    return {
      editors: document.querySelectorAll('.datasheet-cell-editor').length,
      insideGrid: Boolean(editor?.closest('.datasheet-grid-scroll')),
      height: editor ? Math.round(editor.getBoundingClientRect().height) : 0,
    };
  });
  check(`${label} · se puede abrir una celda editable`,
    editorOpen.editors === 1 && editorOpen.insideGrid && editorOpen.height > 0, editorOpen);
  await page.locator('.datasheet-cell-editor').first().press('Escape');
  await page.waitForTimeout(250);

  await shoot(page, `${label}-grid-visible`);

  // (3b) Puntero real de Playwright, con su propio hit-test: si el panel
  // contextual tapara la rejilla, este clic no llegaría a la celda.
  const centreCell = await visibleCell(page);
  if (!centreCell) {
    check(`${label} · un puntero real alcanza la celda del centro de la rejilla`, false,
      'ninguna celda queda visible y alcanzable dentro del carril de la rejilla');
  } else {
    const cellRow = await page.evaluate(() => document.querySelector('[data-qa-cell="true"]')?.closest('tr')?.getAttribute('aria-rowindex') ?? null);
    await centreCell.click();
    await page.waitForTimeout(300);
    const tapped = await page.evaluate((wanted) => {
      const row = [...document.querySelectorAll('.datasheet-grid tbody tr')].find((node) => node.getAttribute('aria-rowindex') === wanted);
      return { selected: row?.getAttribute('data-selected') === 'true', wanted };
    }, cellRow);
    check(`${label} · un puntero real alcanza la celda del centro de la rejilla`, tapped.selected, tapped);
  }

  // La rejilla se queda con la mayoría del presupuesto, no con el resto.
  check(`${label} · la rejilla conserva la mayoría del presupuesto vertical`,
    layout.main.clientHeight > layout.context.clientHeight,
    { main: layout.main.clientHeight, context: layout.context.clientHeight, layout: layout.layout.clientHeight });

  check(`${label} · sin overflow horizontal`,
    layout.documentScrollWidth <= layout.innerWidth,
    { scrollWidth: layout.documentScrollWidth, innerWidth: layout.innerWidth });

  await page.close();
}

// ---------------------------------------------------------------------------
// 2 · CRI-102 — Localizar degrada a `peek` y restaurar conserva el borrador
//
// En X2, donde el ciclo ya era ejercitable. El mismo ciclo en K0 —donde estuvo
// roto hasta CRI-108 porque `contextual-actions` ganaba la exclusividad Compact
// por ser la última activación y suspendía la superficie en vez de degradarla—
// va en la sección 3.
// ---------------------------------------------------------------------------
{
  const page = await newPage(CLASSES.x2);
  await openDatasheet(page);

  /*
    Borrador SIN aplicar. En la rejilla no sirve: una edición única y válida
    sobre un borrador vacío se aplica sola a propósito —pedir "Aplicar" por
    cada celda haría inservible una hoja de datos—, así que se teclea en el
    carril contextual, que es la ruta que sí acumula borrador (`draftSource`
    `panel`) y la que deja el panel a la vista con su botón de Localizar.
  */
  const field = page.locator('.datasheet-context input[type="text"], .datasheet-context input:not([type="checkbox"])').first();
  await field.fill('7.5');
  await page.waitForTimeout(500);

  const draftBefore = await page.evaluate(() => ({
    pending: document.querySelectorAll("[data-pending='true']").length,
    text: [...document.querySelectorAll("[data-pending='true']")].map((cell) => cell.textContent).join('|'),
  }));
  check('peek · hay un borrador sin aplicar antes de localizar', draftBefore.pending > 0, draftBefore);

  await page.evaluate(() => { document.querySelector('.datasheet-grid-scroll').scrollTop = 240; });
  await page.waitForTimeout(200);
  const scrollBefore = await page.evaluate(() => document.querySelector('.datasheet-grid-scroll').scrollTop);

  await page.locator('.datasheet-focus-action').first().click();
  await page.waitForTimeout(600);
  const peeked = await page.evaluate(() => ({
    peek: Boolean(document.querySelector('.sc-modal-surface--peek')),
    surfaceStillMounted: Boolean(document.querySelector('.datasheet-surface')),
    handle: Boolean(document.querySelector('.sc-modal-surface__peek-handle')),
    backgroundInert: Boolean(document.querySelector('.app-shell')?.hasAttribute('inert')),
  }));
  check('peek · Localizar degrada a peek y no cierra',
    peeked.peek && peeked.surfaceStillMounted && peeked.handle, peeked);
  check('peek · el fondo no queda inert', peeked.backgroundInert === false, peeked);
  await shoot(page, 'x2-peek');

  await page.locator('.sc-modal-surface__peek-handle').first().click();
  await page.waitForTimeout(700);
  const restored = await page.evaluate(() => ({
    peek: Boolean(document.querySelector('.sc-modal-surface--peek')),
    pending: document.querySelectorAll("[data-pending='true']").length,
    text: [...document.querySelectorAll("[data-pending='true']")].map((cell) => cell.textContent).join('|'),
    scrollTop: document.querySelector('.datasheet-grid-scroll').scrollTop,
    gridClientHeight: document.querySelector('.datasheet-grid-scroll').clientHeight,
  }));
  check('peek · restaurar conserva el borrador sin aplicar',
    restored.peek === false && restored.pending === draftBefore.pending && restored.text === draftBefore.text,
    { before: draftBefore, after: restored });
  check('peek · restaurar conserva el desplazamiento', restored.scrollTop === scrollBefore,
    { before: scrollBefore, after: restored.scrollTop });
  check('peek · la rejilla sigue con altura tras restaurar', restored.gridClientHeight > 0, restored);
  await page.close();
}

// ---------------------------------------------------------------------------
// 3 · CRI-108 — el ciclo completo de D-11 en K0, con la selección puesta
//
// Es la regresión de este arreglo. En K0 la hoja es `fullscreen` y hasta ahora
// seleccionar una fila la hacía DESAPARECER: la apertura derivada de
// `contextual-actions` ganaba la ranura contextual de Compact por ser la última
// activación, la hoja pasaba a `suspended` y `ModalSurface`, que renderiza
// `{open ? … : null}`, desmontaba su DOM. Sin superficie no había carril
// contextual, ni `Localizar`, ni asa de `peek`: el ciclo entero era inalcanzable.
//
// Se mide sobre el DOM real —montaje, `data-surface-extent`, `inert` del fondo,
// dónde cae el foco y qué devuelve el hit-test del lienzo—, no sobre el estado
// de React.
// ---------------------------------------------------------------------------
for (const label of ['k0-portrait', 'k0-landscape']) {
  const page = await newPage(CLASSES[label]);
  await openDatasheet(page);

  /** Lo observable del ciclo: quién está montado, con qué extent, y dónde caen foco y puntero. */
  const cycleState = () => page.evaluate(() => {
    const surface = document.querySelector('.datasheet-surface');
    const scroll = document.querySelector('.datasheet-grid-scroll');
    const active = document.activeElement;
    const canvas = document.querySelector('.canvas-host');
    const hit = canvas ? (() => {
      const box = canvas.getBoundingClientRect();
      return document.elementFromPoint(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
    })() : null;
    return {
      mounted: Boolean(surface),
      visible: surface ? surface.getBoundingClientRect().height > 0 : false,
      extent: surface?.getAttribute('data-surface-extent') ?? null,
      peekHandle: Boolean(document.querySelector('.sc-modal-surface__peek-handle')),
      scrollTop: scroll?.scrollTop ?? null,
      selectedRows: document.querySelectorAll('.datasheet-grid tbody tr[data-selected="true"]').length,
      pending: document.querySelectorAll("[data-pending='true']").length,
      pendingText: [...document.querySelectorAll("[data-pending='true']")].map((cell) => cell.textContent).join('|'),
      backgroundInert: Boolean(document.querySelector('.app-shell')?.hasAttribute('inert')),
      zocalo: Boolean(document.querySelector('[data-workspace-surface="contextualActions"]')),
      focus: {
        insideDatasheet: Boolean(active?.closest?.('.datasheet-surface')),
        insideInert: Boolean(active?.closest?.('[inert]')),
        onBody: active === document.body,
        hidden: active ? active.getBoundingClientRect().height === 0 : null,
      },
      canvasHit: { insideDatasheet: Boolean(hit?.closest?.('.datasheet-surface')), insideInert: Boolean(hit?.closest?.('[inert]')) },
    };
  });

  // (1) Seleccionar una fila con un puntero real NO puede llevarse la hoja.
  //
  // Se pincha la celda que la propia rejilla marca como enfocada: es la que el
  // usuario tiene delante, y así la comprobación no depende de que quepa una
  // fila entera dentro del carril —en landscape el carril mide 57 px y no
  // cabe—. El clic sigue siendo un puntero real con su hit-test; que la celda
  // del centro sea alcanzable ya lo demuestra la sección 1 en las dos
  // orientaciones.
  const cell = page.locator("[data-datasheet-focused='true']").first();
  check(`${label} · ciclo · hay una celda alcanzable para seleccionar`, await cell.count() > 0);
  await cell.click();
  await page.waitForTimeout(400);
  const selected = await cycleState();
  check(`${label} · ciclo · seleccionar una fila no suspende el Datasheet`,
    selected.mounted && selected.visible && selected.extent === 'default' && selected.selectedRows > 0,
    selected);
  check(`${label} · ciclo · sigue siendo modal: fondo inert y foco dentro de la hoja`,
    selected.backgroundInert && selected.focus.insideDatasheet && !selected.focus.onBody,
    { inert: selected.backgroundInert, focus: selected.focus });
  await shoot(page, `${label}-cycle-1-row-selected`);

  // (2) Borrador sin aplicar por el carril contextual, y desplazamiento propio.
  const field = page.locator('.datasheet-context input[type="text"], .datasheet-context input:not([type="checkbox"])').first();
  check(`${label} · ciclo · el carril contextual es alcanzable con la fila puesta`, await field.count() > 0);
  await field.fill('7.5');
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelector('.datasheet-grid-scroll').scrollTop = 240; });
  await page.waitForTimeout(250);
  const before = await cycleState();
  check(`${label} · ciclo · hay borrador sin aplicar y desplazamiento antes de localizar`,
    before.pending > 0 && before.scrollTop > 0, { pending: before.pending, text: before.pendingText, scrollTop: before.scrollTop });

  // (3) Localizar → `peek`: misma superficie, activa, con el lienzo devuelto.
  await page.locator('.datasheet-focus-action').first().click();
  await page.waitForTimeout(700);
  const peeked = await cycleState();
  check(`${label} · ciclo · Localizar degrada a peek y no cierra`,
    peeked.mounted && peeked.extent === 'peek' && peeked.peekHandle, peeked);
  check(`${label} · ciclo · en peek el fondo deja de ser inert y el lienzo recibe puntero`,
    peeked.backgroundInert === false && !peeked.canvasHit.insideDatasheet && !peeked.canvasHit.insideInert,
    { inert: peeked.backgroundInert, canvasHit: peeked.canvasHit });
  check(`${label} · ciclo · en peek el foco no queda huérfano ni en un elemento oculto o inerte`,
    !peeked.focus.onBody && !peeked.focus.insideInert && peeked.focus.hidden === false, peeked.focus);
  check(`${label} · ciclo · en peek vuelve el zócalo de acciones contextuales`, peeked.zocalo, { zocalo: peeked.zocalo });
  check(`${label} · ciclo · peek conserva fila, selección y borrador`,
    peeked.selectedRows > 0 && peeked.pending === before.pending && peeked.pendingText === before.pendingText,
    { before: { rows: before.selectedRows, text: before.pendingText }, after: { rows: peeked.selectedRows, text: peeked.pendingText } });
  await shoot(page, `${label}-cycle-2-peek`);

  // (4) Restaurar: misma superficie, mismo sitio, mismo borrador, modal de nuevo.
  await page.locator('.sc-modal-surface__peek-handle').first().click();
  await page.waitForTimeout(700);
  const restored = await cycleState();
  check(`${label} · ciclo · restaurar devuelve la hoja a default`,
    restored.mounted && restored.visible && restored.extent === 'default' && restored.peekHandle === false, restored);
  check(`${label} · ciclo · restaurar conserva desplazamiento, fila y borrador`,
    restored.scrollTop === before.scrollTop && restored.selectedRows === before.selectedRows
    && restored.pending === before.pending && restored.pendingText === before.pendingText,
    { before: { scrollTop: before.scrollTop, rows: before.selectedRows, text: before.pendingText },
      after: { scrollTop: restored.scrollTop, rows: restored.selectedRows, text: restored.pendingText } });
  check(`${label} · ciclo · restaurar devuelve el comportamiento modal`,
    restored.backgroundInert && restored.focus.insideDatasheet, { inert: restored.backgroundInert, focus: restored.focus });
  check(`${label} · ciclo · el zócalo se retira mientras la hoja vuelve a ocupar el lienzo`,
    restored.zocalo === false, { zocalo: restored.zocalo });
  await shoot(page, `${label}-cycle-3-restored`);

  // (5) Y el lienzo está vivo de verdad en `peek`: se vuelve a degradar y se
  // toca. Con este modelo el punto central es ambiguo y abre el Candidate
  // Picker, que es una capa contextual con dueño y SÍ tiene derecho a la
  // ranura de Compact (R-1) — a diferencia del zócalo derivado. Lo que no
  // puede es destruir a quien sustituye: al cancelarlo, la hoja vuelve a su
  // `peek` con su fila y su borrador intactos (CRI-94, T-INV-8).
  await page.locator('.datasheet-focus-action').first().click();
  await page.waitForTimeout(700);
  const canvasBox = await page.locator('.canvas-host').first().boundingBox();
  await page.mouse.click(Math.round(canvasBox.x + canvasBox.width / 2), Math.round(canvasBox.y + canvasBox.height / 2));
  await page.waitForTimeout(700);
  const picking = await page.evaluate(() => ({
    picker: Boolean(document.querySelector('[data-workspace-surface="candidatePicker"]')),
    zocalo: Boolean(document.querySelector('[data-workspace-surface="contextualActions"]')),
    datasheet: Boolean(document.querySelector('.datasheet-surface')),
  }));
  check(`${label} · picker · el lienzo recibe el toque en peek y el Picker toma la ranura contextual`,
    picking.picker, picking);
  check(`${label} · picker · el zócalo derivado no se cuela encima del Picker`, picking.zocalo === false, picking);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const afterPicker = await cycleState();
  check(`${label} · picker · cancelar el Picker devuelve la hoja a su peek sin reconstruirla`,
    afterPicker.mounted && afterPicker.extent === 'peek' && afterPicker.peekHandle, afterPicker);
  check(`${label} · picker · la sustitución no destruyó fila ni borrador`,
    afterPicker.selectedRows === before.selectedRows && afterPicker.pending === before.pending
    && afterPicker.pendingText === before.pendingText,
    { before: { rows: before.selectedRows, text: before.pendingText },
      after: { rows: afterPicker.selectedRows, text: afterPicker.pendingText } });
  check(`${label} · picker · con la hoja en peek el fondo sigue sin ser inert`,
    afterPicker.backgroundInert === false, { inert: afterPicker.backgroundInert });
  await shoot(page, `${label}-cycle-4-picker-cancelled`);

  await page.close();
}

// ---------------------------------------------------------------------------
// 4 · M1 y X2 — smoke: ni la composición ni la política de actividad los tocan
// ---------------------------------------------------------------------------
for (const label of ['m1', 'x2']) {
  const page = await newPage(CLASSES[label]);
  await openDatasheet(page);
  const layout = await measureLayout(page);
  report.measurements[label] = layout;

  check(`${label} · sigue en drawer de dos columnas`,
    layout.presentation === 'drawer' && (layout.gridTemplateRows ?? '').trim().split(' ').length === 1,
    { presentation: layout.presentation, gridTemplateRows: layout.gridTemplateRows });
  check(`${label} · la rejilla mantiene su carril`,
    layout.gridScroll.clientHeight > 0 && layout.gridScroll.scrollHeight > layout.gridScroll.clientHeight,
    layout.gridScroll);
  check(`${label} · el centro de la rejilla recibe entrada`, layout.hit.insideGrid && !layout.hit.insideContext, layout.hit);
  check(`${label} · sin overflow horizontal`,
    layout.documentScrollWidth <= layout.innerWidth,
    { scrollWidth: layout.documentScrollWidth, innerWidth: layout.innerWidth });
  await shoot(page, `${label}-grid-visible`);
  await page.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
await previewServer.close();

console.log(`\n${report.checks.length - report.failures.length}/${report.checks.length} comprobaciones en verde`);
console.log(`Evidencia: ${path.relative(repoRoot, outDir)}`);
if (report.failures.length) {
  console.error(`\n${report.failures.length} fallo(s):`);
  for (const failure of report.failures) console.error(` - ${failure.name}: ${JSON.stringify(failure.detail)}`);
  process.exitCode = 1;
}
