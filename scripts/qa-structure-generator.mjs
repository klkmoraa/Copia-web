/**
 * QA de navegador de «Generar estructura» (CRI-38, fase 3).
 *
 * Ejercita el recorrido real en Chromium y WebKit: abrir desde el Workspace y
 * desde la paleta de comandos, ajustar parámetros por familia, ver la vista
 * previa dibujada sobre el lienzo sin que el modelo cambie, elegir el origen
 * con el puntero, revisar el resumen exacto, confirmar como un solo paso
 * reversible y comprobar que los resultados vigentes se invalidan una vez.
 *
 * Lo que no se puede afirmar desde Vitest es justamente lo que se comprueba
 * aquí: que el ghost está en el SVG y no en el modelo, que el objetivo táctil
 * mide lo que dice medir y que la bandeja compacta no desborda.
 */
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearProjectLibraryOnBoot, openExamplePortal, openResultsSurface } from './qa-welcome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const port = engine === 'webkit' ? 4186 : 4185;
const baseURL = `http://127.0.0.1:${port}/`;
const artifactsDir = path.join(root, 'qa-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const previewServer = await preview({
  root,
  preview: { host: '127.0.0.1', port, strictPort: true },
  logLevel: 'error',
});
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true,
  ...(engine === 'chromium' ? {
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  } : {}),
});
const results = { engine, url: baseURL, checks: {}, console: [], pageErrors: [] };

const check = (name, condition, detail = '') => {
  results.checks[name] = { pass: Boolean(condition), detail };
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
};

const sleep = (page, milliseconds = 260) => page.waitForTimeout(milliseconds);

const storedProject = (page) => page.evaluate(() => {
  const value = localStorage.getItem('structureCo.project');
  if (!value) throw new Error('No persisted project was found.');
  return JSON.parse(value);
});

const resetToExample = async (page) => {
  // CRI-116 · nada de esperar la bienvenida ANTES de limpiar: con la biblioteca
  // poblada el producto salta solo a la Mesa (CRI-104) y no hay bienvenida que
  // esperar. La biblioteca se borra en el init del contexto, antes de que corra
  // la app, así que cada navegación arranca ya sin proyectos.
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  // CRI-116 · el pórtico de ejemplo vive en el tercer paso desde CRI-112.
  await openExamplePortal(page, page.locator('.welcome-template-card').filter({ hasText: /P.rtico de ejemplo/i }));
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  await page.locator('[data-structure-kind="node"][data-structure-id="N1"]').waitFor({ state: 'visible' });
  await sleep(page);
};

const surface = (page) => page.locator('[data-structure-generator-surface]');
const ghost = (page) => page.locator('[data-structure-generation-ghost]');

const openFromToolRail = async (page) => {
  await page.locator('.desktop-tool-list [data-structure-generator-command]').click();
  await surface(page).waitFor({ state: 'visible' });
  await ghost(page).waitFor({ state: 'visible' });
  return surface(page);
};

const closeSurface = async (page) => {
  await surface(page).getByRole('button', { name: /^cerrar generador$/i }).click();
  await surface(page).waitFor({ state: 'hidden' });
};

const chooseFamily = async (panel, name) => {
  await panel.getByRole('radio', { name }).click();
  await panel.page().waitForTimeout(80);
};

const spacingGroup = (panel, field) => panel.locator(`[data-spacing-field="${field}"]`);

const fillField = async (scope, label, value) => {
  const field = scope.getByLabel(label);
  await field.fill(String(value));
  await field.press('Tab');
};

const summaryValue = (page, id) => page.locator(`[data-summary-row="${id}"] strong`).textContent();

const ghostCounts = (page) => page.evaluate(() => {
  const layer = document.querySelector('[data-structure-generation-ghost]');
  if (!layer) return null;
  return {
    declaredNodes: Number(layer.getAttribute('data-ghost-nodes')),
    declaredMembers: Number(layer.getAttribute('data-ghost-members')),
    drawnNodes: layer.querySelectorAll('.structure-generation-ghost__nodes circle').length,
    drawnMembers: layer.querySelectorAll('.structure-generation-ghost__members line').length,
    insideCanvasScene: Boolean(layer.closest('#canvas-scene') || layer.closest('svg')),
  };
});

const reviewAndGenerate = async (page) => {
  const panel = surface(page);
  await panel.getByRole('button', { name: /^revisar$/i }).click();
  await page.locator('[data-structure-generator-view="review"]').waitFor({ state: 'visible' });
  const promised = {
    nodes: Number(await summaryValue(page, 'nodes')),
    members: Number(await summaryValue(page, 'members')),
  };
  await panel.getByRole('button', { name: /^generar$/i }).click();
  await panel.waitFor({ state: 'hidden' });
  return promised;
};

const runPreviewDoesNotTouchTheModel = async (page) => {
  await resetToExample(page);
  const baseline = JSON.stringify(await storedProject(page));
  const panel = await openFromToolRail(page);

  const counts = await ghostCounts(page);
  check('ghostIsDrawnInTheCanvasNotTheModel', counts.insideCanvasScene && counts.drawnNodes > 0, JSON.stringify(counts));
  check('ghostDrawsExactlyWhatItDeclares',
    counts.drawnNodes === counts.declaredNodes && counts.drawnMembers === counts.declaredMembers,
    JSON.stringify(counts));
  check('livePreviewDoesNotPersistAnything', JSON.stringify(await storedProject(page)) === baseline);

  // Ajustar parámetros redibuja la vista previa y sigue sin escribir nada.
  await fillField(spacingGroup(panel, 'spans'), 'Claros: cantidad', 6);
  await page.waitForFunction(() =>
    Number(document.querySelector('[data-structure-generation-ghost]')?.getAttribute('data-ghost-nodes')) === 7);
  check('previewFollowsParametersLive', Number(await summaryValue(page, 'nodes')) === 7);
  check('adjustingParametersStillDoesNotPersist', JSON.stringify(await storedProject(page)) === baseline);

  await closeSurface(page);
  await sleep(page);
  check('closingRemovesTheGhostAndLeavesNoTrace',
    await ghost(page).count() === 0 && JSON.stringify(await storedProject(page)) === baseline);
};

const runEveryFamilyPreviews = async (page) => {
  await resetToExample(page);
  const panel = await openFromToolRail(page);
  const seen = {};
  for (const family of ['Viga continua', 'Pórtico', 'Marco multinivel', 'Cercha', 'Retícula']) {
    await chooseFamily(panel, family);
    await ghost(page).waitFor({ state: 'visible' });
    const counts = await ghostCounts(page);
    seen[family] = counts;
    check(`family:${family}`, counts.drawnNodes > 0 && counts.drawnMembers > 0, JSON.stringify(counts));
  }
  // Cada familia produce una geometría distinta; si dos coincidieran, el panel
  // estaría mostrando la anterior.
  const signatures = new Set(Object.values(seen).map((counts) => `${counts.drawnNodes}/${counts.drawnMembers}`));
  check('everyFamilyProducesItsOwnGeometry', signatures.size >= 4, JSON.stringify(seen));

  // Cerchas: las tres topologías se dibujan y difieren entre sí.
  await chooseFamily(panel, 'Cercha');
  const topologies = {};
  for (const topology of ['Pratt', 'Warren', 'Howe']) {
    await panel.getByRole('radio', { name: topology }).click();
    await sleep(page, 120);
    topologies[topology] = await page.evaluate(() => [...document.querySelectorAll('[data-ghost-member-role="diagonal"]')]
      .map((line) => `${line.getAttribute('x1')},${line.getAttribute('y1')}-${line.getAttribute('x2')},${line.getAttribute('y2')}`)
      .join('|'));
  }
  check('trussTopologiesAreDistinctGeometries',
    new Set(Object.values(topologies)).size === 3,
    JSON.stringify(Object.fromEntries(Object.entries(topologies).map(([key, value]) => [key, value.slice(0, 60)]))));
  await closeSurface(page);
};

const runCustomSpacingAndOrigin = async (page) => {
  await resetToExample(page);
  const panel = await openFromToolRail(page);

  const spans = spacingGroup(panel, 'spans');
  await spans.getByRole('radio', { name: /^personalizada$/i }).click();
  await fillField(spans, 'Claros: separaciones', '4, 6, 4');
  await page.waitForFunction(() =>
    Number(document.querySelector('[data-structure-generation-ghost]')?.getAttribute('data-ghost-nodes')) === 4);
  check('customSpacingProducesIrregularGeometry', Number(await summaryValue(page, 'nodes')) === 4);
  check('customSpacingCountsItsDivisions', await spans.getByText('3 divisiones').isVisible());

  // Un valor imposible retira la vista previa en vez de dibujar algo aproximado.
  await fillField(spans, 'Claros: separaciones', '4, 0');
  await page.waitForFunction(() => document.querySelector('[data-structure-generation-ghost]') === null);
  check('invalidSpacingWithdrawsThePreview', await ghost(page).count() === 0);
  check('invalidSpacingBlocksReview', await panel.getByRole('button', { name: /^revisar$/i }).isDisabled());
  await fillField(spans, 'Claros: separaciones', '4, 6, 4');
  await ghost(page).waitFor({ state: 'visible' });

  // Origen elegido con el puntero sobre el lienzo.
  await panel.getByRole('button', { name: /origen de inserción/i }).click();
  await panel.getByRole('button', { name: /elegir en el lienzo/i }).click();
  const before = JSON.stringify(await storedProject(page));
  const box = await page.locator('.structural-canvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.62);
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-structure-generator-surface] input');
    return Boolean(input);
  });
  const origin = await panel.getByLabel('Origen X').inputValue();
  check('pickingOriginOnCanvasFillsTheField', origin !== '' && origin !== '0', origin);
  check('pickingOriginDoesNotModifyTheModel', JSON.stringify(await storedProject(page)) === before);
  check('pickingDisarmsItselfAfterOnePoint',
    await panel.getByRole('button', { name: /^elegir en el lienzo$/i }).isVisible());
  await closeSurface(page);
};

const runReviewGenerateUndoRedo = async (page) => {
  await resetToExample(page);
  // Resultados vigentes: confirmar debe invalidarlos una sola vez.
  await page.getByRole('button', { name: /^analizar$/i }).click();
  // CRI-116 · analizar ya no abre las salidas por su cuenta; hay que pedirlas.
  await openResultsSurface(page);
  await page.getByTestId('diagram-chart').waitFor({ state: 'visible' });

  const source = await storedProject(page);
  const panel = await openFromToolRail(page);
  await chooseFamily(panel, 'Marco multinivel');

  // El resumen previo tiene que decir exactamente lo que se va a crear.
  const promisedBefore = {
    nodes: Number(await summaryValue(page, 'nodes')),
    members: Number(await summaryValue(page, 'members')),
  };
  const promised = await reviewAndGenerate(page);
  check('reviewShowsTheSameSummaryAsTheParameters',
    promised.nodes === promisedBefore.nodes && promised.members === promisedBefore.members,
    JSON.stringify({ promised, promisedBefore }));

  const created = await page.evaluate(async ({ nodes, members }) => {
    const read = () => JSON.parse(localStorage.getItem('structureCo.project'));
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const project = read();
      if (project.nodes.length === nodes && project.members.length === members) return project;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return read();
  }, { nodes: source.nodes.length + promised.nodes, members: source.members.length + promised.members });

  check('generatedExactlyWhatTheSummaryPromised',
    created.nodes.length === source.nodes.length + promised.nodes
      && created.members.length === source.members.length + promised.members,
    JSON.stringify({ promised, before: source.nodes.length, after: created.nodes.length }));
  check('generationCreatesNoLoads',
    created.nodalLoads.length === source.nodalLoads.length
      && created.memberLoads.length === source.memberLoads.length);
  check('generationCreatesNoUnrequestedSupports',
    created.nodes.filter((node) => node.support?.type && node.support.type !== 'none').length
      === source.nodes.filter((node) => node.support?.type && node.support.type !== 'none').length);

  await page.getByTestId('diagram-chart').waitFor({ state: 'hidden' });
  check('confirmingInvalidatesPriorResults', await page.getByTestId('diagram-chart').count() === 0);

  // Un solo deshacer retira la geometría entera, no una entidad por vez.
  await page.locator('.history-controls').getByLabel(/^deshacer$/i).click();
  await page.waitForFunction((count) =>
    JSON.parse(localStorage.getItem('structureCo.project')).nodes.length === count, source.nodes.length);
  check('oneUndoRemovesTheWholeBatch',
    (await storedProject(page)).members.length === source.members.length);

  await page.locator('.history-controls').getByLabel(/^rehacer$/i).click();
  await page.waitForFunction((count) =>
    JSON.parse(localStorage.getItem('structureCo.project')).nodes.length === count,
  source.nodes.length + promised.nodes);
  const redone = await storedProject(page);
  check('redoRestoresTheExactSameGeometry',
    JSON.stringify(redone.nodes) === JSON.stringify(created.nodes)
      && JSON.stringify(redone.members) === JSON.stringify(created.members));
};

const runCancelAndCommandPalette = async (page) => {
  await resetToExample(page);
  const baseline = JSON.stringify(await storedProject(page));

  // Abrir desde la paleta de comandos.
  await page.keyboard.press('Control+k');
  await page.locator('.command-palette').waitFor({ state: 'visible' });
  await page.locator('.command-palette-item').filter({ hasText: /generar estructura/i }).first().click();
  await surface(page).waitFor({ state: 'visible' });
  check('commandPaletteOpensTheGenerator', await surface(page).isVisible());

  // Revisar y arrepentirse no escribe nada.
  await surface(page).getByRole('button', { name: /^revisar$/i }).click();
  await page.locator('[data-structure-generator-view="review"]').waitFor({ state: 'visible' });
  await surface(page).getByRole('button', { name: /volver a los parámetros/i }).click();
  await page.locator('[data-structure-generator-view="parameters"]').waitFor({ state: 'visible' });
  await surface(page).getByRole('button', { name: /^cancelar$/i }).click();
  await surface(page).waitFor({ state: 'hidden' });
  await sleep(page);
  check('cancellingAfterReviewLeavesNoTrace', JSON.stringify(await storedProject(page)) === baseline);

  // Escape cierra sin generar.
  await openFromToolRail(page);
  await page.keyboard.press('Escape');
  await surface(page).waitFor({ state: 'hidden' });
  check('escapeClosesWithoutGenerating', JSON.stringify(await storedProject(page)) === baseline);
};

const runAccessibility = async (page) => {
  await resetToExample(page);
  const panel = await openFromToolRail(page);

  const semantics = await page.evaluate(() => {
    const element = document.querySelector('[data-structure-generator-surface]');
    return {
      label: element.getAttribute('aria-label'),
      modal: element.getAttribute('aria-modal'),
      radiogroups: [...element.querySelectorAll('[role="radiogroup"]')].map((group) => group.getAttribute('aria-label')),
      unnamedControls: [...element.querySelectorAll('input, select')].filter((control) => {
        const labelled = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby');
        return !labelled;
      }).length,
    };
  });
  check('surfaceIsANamedNonModalRegion', semantics.label === 'Generar estructura' && semantics.modal === null, JSON.stringify(semantics));
  check('everyOptionGroupIsANamedRadiogroup', semantics.radiogroups.length > 0 && semantics.radiogroups.every(Boolean), JSON.stringify(semantics.radiogroups));
  check('everyControlHasAnAccessibleName', semantics.unnamedControls === 0, String(semantics.unnamedControls));

  // El recorrido de teclado llega a Revisar sin salir de la superficie.
  await panel.getByRole('radio', { name: 'Viga continua' }).focus();
  const reachable = await page.evaluate(async () => {
    const element = document.querySelector('[data-structure-generator-surface]');
    const focusable = [...element.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')]
      .filter((control) => control.offsetParent !== null);
    return focusable.length;
  });
  check('theWholeSurfaceIsKeyboardReachable', reachable > 8, String(reachable));

  // Abrir la revisión mueve el foco a su encabezado.
  await panel.getByRole('button', { name: /^revisar$/i }).click();
  await page.locator('[data-structure-generator-view="review"]').waitFor({ state: 'visible' });
  const focused = await page.evaluate(() => document.activeElement?.textContent ?? '');
  check('openingTheReviewMovesFocusToItsHeading', focused.includes('Revisa antes de generar'), focused);

  await panel.getByRole('button', { name: /volver a los parámetros/i }).click();
  const returned = await page.evaluate(() => document.activeElement?.textContent ?? '');
  check('leavingTheReviewReturnsFocusToItsTrigger', returned.includes('Revisar'), returned);
  await closeSurface(page);
};

const runResponsive = async (page) => {
  // Escritorio: la superficie flota sobre el lienzo sin taparlo entero.
  await page.setViewportSize({ width: 1536, height: 960 });
  await resetToExample(page);
  await openFromToolRail(page);
  const desktop = await page.evaluate(() => {
    const element = document.querySelector('[data-structure-generator-surface]');
    const rect = element.getBoundingClientRect();
    const canvas = document.querySelector('.structural-canvas').getBoundingClientRect();
    return {
      fitsHorizontally: rect.left >= 0 && rect.right <= window.innerWidth + 1,
      fitsVertically: rect.top >= 0 && rect.bottom <= window.innerHeight + 1,
      coverage: (rect.width * rect.height) / (canvas.width * canvas.height),
      noPageOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    };
  });
  check('desktopSurfaceFitsTheViewport', desktop.fitsHorizontally && desktop.fitsVertically && desktop.noPageOverflow, JSON.stringify(desktop));
  check('desktopSurfaceLeavesTheCanvasVisible', desktop.coverage < 0.5, JSON.stringify(desktop));
  await closeSurface(page);

  // Compacto: bandeja inferior, sin desbordes y con objetivos táctiles reales.
  await page.setViewportSize({ width: 390, height: 844 });
  await resetToExample(page);
  /*
   * Compact admite UNA capa contextual (R-1) y la hoja del Inspector está
   * retenida desde el arranque: hay que devolverla antes de pedir el generador,
   * o su hoja queda debajo. Es el mismo despeje que hace `qa-structural-edits`
   * con su `closeCompactSurfaceStack`.
   */
  const compactInspector = page.locator('.inspector-panel.mobile-open');
  if (await compactInspector.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await compactInspector.waitFor({ state: 'hidden' });
  }
  /*
   * Una sola hoja de herramientas en Compact. Antes eran dos —«Cargas» y «Más»—
   * colgando de un dock de seis ranuras; ese dock se retiró (dejaba fuera de toda
   * hoja a las cuatro herramientas `primary`, que sólo existían como botones
   * suyos) y ahora la barra inferior enseña la herramienta ACTIVA en una ranura y
   * la hoja lleva el catálogo entero.
   */
  await page.locator('.compact-bar__tool').click();
  const more = page.getByRole('dialog', { name: /herramientas de modelado/i });
  await more.waitFor({ state: 'visible' });
  await more.locator('[data-structure-generator-command]').click();
  await surface(page).waitFor({ state: 'visible' });
  await ghost(page).waitFor({ state: 'visible' });
  check('compactMoreSheetOpensTheGenerator', await surface(page).isVisible());

  const compact = await page.evaluate(() => {
    const element = document.querySelector('[data-structure-generator-surface]');
    const rect = element.getBoundingClientRect();
    return {
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      noPageOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      // Un cuarto largo de la pantalla para el lienzo: por debajo de eso la
      // bandeja tapa justamente la vista previa que se está ajustando.
      canvasHeightAbove: rect.top,
    };
  });
  check('compactTrayHasNoHorizontalOverflow',
    compact.noPageOverflow && compact.rect.left >= -1 && compact.rect.right <= compact.viewport.width + 1,
    JSON.stringify(compact));
  check('compactTrayLeavesThePreviewVisibleAbove',
    compact.canvasHeightAbove >= compact.viewport.height * 0.28,
    JSON.stringify(compact));

  const undersized = await surface(page).locator('button:visible, input:visible, select:visible').evaluateAll((elements) => elements
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30) ?? '', width: rect.width, height: rect.height };
    })
    .filter((target) => target.width < 43.5 || target.height < 43.5));
  check('compactSurfaceHas44pxTouchTargets', undersized.length === 0, JSON.stringify(undersized));

  // Y sigue generando desde compacto.
  const source = await storedProject(page);
  const promised = await reviewAndGenerate(page);
  await page.waitForFunction((count) =>
    JSON.parse(localStorage.getItem('structureCo.project')).nodes.length === count,
  source.nodes.length + promised.nodes);
  check('compactSurfaceGenerates',
    (await storedProject(page)).nodes.length === source.nodes.length + promised.nodes);
  await page.setViewportSize({ width: 1536, height: 960 });
};

const runPreviewPerformance = async (page) => {
  await resetToExample(page);
  const panel = await openFromToolRail(page);
  await chooseFamily(panel, 'Retícula');

  // Una retícula densa: la vista previa tiene que seguir al teclado sin que el
  // hilo principal se quede colgado entre pulsaciones.
  const columns = spacingGroup(panel, 'columns');
  const rows = spacingGroup(panel, 'rows');
  const started = Date.now();
  await fillField(columns, 'Columnas: cantidad', 12);
  await fillField(rows, 'Filas: cantidad', 12);
  await page.waitForFunction(() =>
    Number(document.querySelector('[data-structure-generation-ghost]')?.getAttribute('data-ghost-nodes')) === 169);
  const elapsed = Date.now() - started;
  const counts = await ghostCounts(page);
  check('densePreviewStaysResponsive', elapsed < 6000, `${elapsed} ms`);
  check('densePreviewDrawsEveryEntity',
    counts.drawnNodes === 169 && counts.drawnMembers === counts.declaredMembers,
    JSON.stringify(counts));

  // Un modelo grande avisa antes de confirmarse.
  const warning = await panel.getByText(/Modelo grande/i).count();
  check('largeModelIsFlaggedBeforeConfirming', warning === 1, String(warning));
  await closeSurface(page);
};

const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, locale: 'es-MX' });
await clearProjectLibraryOnBoot(context);
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') results.console.push(message.text());
});
page.on('pageerror', (error) => results.pageErrors.push(String(error)));

try {
  const runStep = async (label, action) => {
    console.log(`[structure-generator:${engine}] ${label}`);
    await action();
  };
  await runStep('Live preview does not touch the model', () => runPreviewDoesNotTouchTheModel(page));
  await runStep('Every family and truss topology previews', () => runEveryFamilyPreviews(page));
  await runStep('Custom spacing and canvas origin', () => runCustomSpacingAndOrigin(page));
  await runStep('Review, generate, undo and redo', () => runReviewGenerateUndoRedo(page));
  await runStep('Cancel paths and command palette', () => runCancelAndCommandPalette(page));
  await runStep('Accessibility', () => runAccessibility(page));
  await runStep('Desktop and compact responsive', () => runResponsive(page));
  await runStep('Preview performance', () => runPreviewPerformance(page));
  await page.screenshot({ path: path.join(artifactsDir, `structure-generator-${engine}.png`), fullPage: true });
  check('noConsoleErrors', results.console.length === 0, JSON.stringify(results.console));
  check('noPageErrors', results.pageErrors.length === 0, JSON.stringify(results.pageErrors));
  console.log(`Structure generator browser QA passed in ${engine}: live preview without mutation, five families, three truss topologies, custom spacing, canvas origin, exact review, atomic generate, single undo/redo, result invalidation, cancel paths, command palette, accessibility, desktop and compact layouts, and dense-preview performance.`);
} finally {
  fs.writeFileSync(path.join(artifactsDir, `structure-generator-${engine}.json`), JSON.stringify(results, null, 2));
  await context.close();
  await browser.close();
  await previewServer.close();
}
