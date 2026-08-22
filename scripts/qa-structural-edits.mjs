import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearProjectLibraryOnBoot, continueStoredProject, openExamplePortal, openResultsSurface } from './qa-welcome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const port = engine === 'webkit' ? 4182 : 4181;
const baseURL = `http://127.0.0.1:${port}/`;
const artifactsDir = path.join(root, 'qa-artifacts');
const QA_BOOT_QUERY = '__structurecoQaProject';
const QA_CLEAR_STORAGE = '__clear__';
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
const results = { engine, url: baseURL, checks: {}, clipboardReadText: null, console: [], pageErrors: [] };

const check = (name, condition, detail = '') => {
  results.checks[name] = { pass: Boolean(condition), detail };
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
};

const sleep = (page, milliseconds = 320) => page.waitForTimeout(milliseconds);

const storedProject = (page) => page.evaluate(() => {
  const value = localStorage.getItem('structureCo.project');
  if (!value) throw new Error('No persisted project was found.');
  return JSON.parse(value);
});

const waitForStored = async (page, predicate, argument) => {
  await page.waitForFunction(({ test, argument: serializedArgument }) => {
    const value = localStorage.getItem('structureCo.project');
    const evaluate = Function(`return (${test})`)();
    return Boolean(value && evaluate(JSON.parse(value), serializedArgument));
  }, { test: predicate.toString(), argument });
  return storedProject(page);
};

const bootWithStoredProject = async (page, serializedProject = QA_CLEAR_STORAGE) => {
  // Seed storage before the application entry point runs. WebKit treats a
  // reload that interrupts a Vite CSS preload as a rejected dynamic import;
  // a one-pass boot avoids that navigation race while keeping each scenario
  // completely isolated.
  const url = new URL(baseURL);
  url.searchParams.set(QA_BOOT_QUERY, serializedProject);
  await page.goto(url.toString(), { waitUntil: 'networkidle' });
  // Sin esperar aquí la bienvenida: con un proyecto real sembrado el producto
  // puede entrar solo a la Mesa (CRI-104). Cada llamador espera lo que necesita
  // —`openExamplePortal` la bienvenida, `continueStoredProject` cualquiera de las
  // dos—, que es lo único que se puede afirmar en los dos casos.
};

const resetToExample = async (page) => {
  await bootWithStoredProject(page);
  // Project-hub actions use the same project name. Scope this to the welcome
  // template card so the smoke path always opens the structural example.
  // CRI-116 · el pórtico de ejemplo vive en el tercer paso desde CRI-112.
  await openExamplePortal(page, page.locator('.welcome-template-card').filter({ hasText: /P.rtico de ejemplo/i }));
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  await page.locator('[data-structure-kind="node"][data-structure-id="N1"]').waitFor({ state: 'visible' });
  // Vite loads the workspace CSS after the shell's lazy chunk. Do not navigate
  // to the next isolated scenario until that stylesheet is committed: WebKit
  // otherwise reports a real rejected CSS preload while the old document dies.
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => Array.from(document.styleSheets)
    .some((sheet) => sheet.href.includes('WorkspaceShell')));
  await sleep(page);
};

const seedExample = async (page, mutate) => {
  await resetToExample(page);
  const project = await storedProject(page);
  mutate(project);
  await bootWithStoredProject(page, JSON.stringify(project));
  // CRI-116 · con proyecto guardado el producto entra solo (CRI-104).
  await continueStoredProject(page);
  await sleep(page);
};

const target = (page, kind, id) => page.locator(`[data-structure-kind="${kind}"][data-structure-id="${id}"]`);

const nodeCenter = async (page, id) => {
  const box = await target(page, 'node', id).boundingBox();
  if (!box) throw new Error(`Node ${id} does not have a measurable screen position.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const oneGridMove = async (page) => {
  const [n1, n2, n3] = await Promise.all(['N1', 'N2', 'N3'].map((id) => nodeCenter(page, id)));
  return {
    start: n1,
    end: {
      x: n1.x + (n2.x - n1.x) / 6,
      y: n1.y + (n3.y - n1.y) / 4,
    },
  };
};

const availableCanvasTouchPoint = (page) => page.evaluate(() => {
  const canvas = document.querySelector('.structural-canvas');
  if (!canvas) throw new Error('The structural canvas is not available for touch QA.');
  const rect = canvas.getBoundingClientRect();
  const xs = [0.25, 0.5, 0.7];
  const ys = [0.16, 0.28, 0.4];
  for (const yRatio of ys) {
    for (const xRatio of xs) {
      const x = rect.left + rect.width * xRatio;
      const y = rect.top + rect.height * yRatio;
      const target = document.elementFromPoint(x, y);
      if (!target?.closest('.structural-canvas')) continue;
      if (target.closest('[data-canvas-chrome], [data-structural-edit-surface]')) continue;
      return { x, y };
    }
  }
  throw new Error('No unobscured touch point was found inside the structural canvas.');
});

const closeCompactSurfaceStack = async (page) => {
  const closeInspector = page.getByRole('button', { name: /cerrar inspector/i });
  if (await closeInspector.isVisible().catch(() => false)) await closeInspector.click();
  /*
   * La variante `surface="detail"` que monta WorkspaceShell NO lleva botón de
   * cierre propio —sólo lo monta la variante con pestañas—, así que el clic de
   * arriba no la alcanza nunca. Se cierra por su contrato de hoja: Escape, que
   * `Inspector.tsx` escucha para cualquier presentación.
   */
  const compactInspector = page.locator('.inspector-panel.mobile-open');
  if (await compactInspector.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await compactInspector.waitFor({ state: 'hidden' });
  }
  const results = page.getByRole('dialog', { name: /resultados/i });
  if (await results.isVisible().catch(() => false)) {
    await results.focus();
    await page.keyboard.press('Escape');
    await results.waitFor({ state: 'hidden' });
  }
};

const selectSingle = async (page, kind, id) => {
  const item = target(page, kind, id);
  await item.focus();
  await page.keyboard.press('Enter');
  // CRI-96 keeps ambiguous hits read-only until an explicit confirmation. The
  // structural-edit oracle asks for one exact ID, so it now selects that
  // option and confirms it instead of assuming the click-through path.
  const picker = page.locator('[data-candidate-picker]');
  if (await picker.isVisible().catch(() => false)) {
    await picker.locator(`#candidate-option-${kind}-${id}`).click();
    await picker.getByRole('listbox').press('Enter');
    await picker.waitFor({ state: 'hidden' });
  }
  await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('aria-pressed') === 'true', `[data-structure-kind="${kind}"][data-structure-id="${id}"]`);
};

const openCandidatePickerFromKeyboard = async (page, kind, id) => {
  const item = target(page, kind, id);
  await item.focus();
  await page.keyboard.press('Enter');
  const picker = page.locator('[data-candidate-picker]');
  await picker.waitFor({ state: 'visible' });
  return picker;
};

const contextualActions = (page) => page.locator('[data-contextual-actions]');

const openContextualOverflow = async (page) => {
  const toolbar = contextualActions(page);
  await toolbar.waitFor({ state: 'visible' });
  await touchActivate(page, toolbar.getByRole('button', { name: /más acciones/i }));
  const menu = toolbar.getByRole('menu', { name: /más acciones/i });
  await menu.waitFor({ state: 'visible' });
  return menu;
};

const clipboardReadTextStatus = (page) => page.evaluate(async () => {
  const clipboard = navigator.clipboard;
  if (!clipboard || typeof clipboard.readText !== 'function') return { state: 'unavailable' };
  try {
    await clipboard.readText();
    return { state: 'available' };
  } catch (error) {
    return { state: 'blocked', name: error instanceof DOMException ? error.name : String(error) };
  }
});

const touchActivate = async (page, locator) => {
  await locator.tap();
};

const setViewportAndWaitForShell = async (page, width, height, expectedShell) => {
  await page.setViewportSize({ width, height });
  // Headless WebKit can update innerWidth before it delivers the matching
  // resize notification. Frame-align the application input, then wait for
  // the broker's observed commit instead of guessing at a delay.
  await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('orientationchange'));
  });
  await page.waitForFunction((expected) => (
    document.querySelector('[data-contextual-actions]')?.getAttribute('data-shell-class') === expected
  ), expectedShell, { timeout: 2_000 });
};

const selectNodes = async (page, ids) => {
  for (const [index, id] of ids.entries()) {
    await target(page, 'node', id).click(index === 0 ? {} : { modifiers: ['Shift'] });
    await page.waitForTimeout(24);
  }
};

const openEdit = async (page, activation = 'pointer') => {
  const primaryAction = contextualActions(page)
    .getByRole('button', { name: /abrir editor estructural/i });
  await primaryAction.waitFor({ state: 'visible' });
  if (activation === 'keyboard') {
    // The broker owns this inset presentation; use its reachable contextual
    // primary action instead of bypassing the Compact interaction floor.
    await primaryAction.focus();
    await page.keyboard.press('Enter');
  } else {
    await primaryAction.click();
  }
  const surface = page.locator('[data-structural-edit-surface]');
  await surface.waitFor({ state: 'visible' });
  return surface;
};

const chooseOperation = async (surface, name) => {
  await surface.getByRole('radio', { name }).click();
};

const fillField = async (surface, label, value) => {
  const field = surface.getByLabel(label);
  await field.fill(String(value));
  await field.press('Tab');
};

const apply = async (surface) => {
  const button = surface.getByRole('button', { name: /^aplicar$/i });
  await button.waitFor({ state: 'visible' });
  await button.click();
  await surface.waitFor({ state: 'hidden' });
};

const runMovePointerAndCancel = async (page) => {
  await resetToExample(page);
  const baseline = JSON.stringify(await storedProject(page));
  await selectSingle(page, 'node', 'N1');
  const surface = await openEdit(page);
  const canvas = page.getByRole('application', { name: /área de trabajo estructural/i });
  await surface.getByRole('button', { name: /usar puntero/i }).click();
  const { start, end } = await oneGridMove(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.locator('[data-structural-edit-preview-mode="gesture"]').waitFor({ state: 'visible' });
  await page.mouse.up();
  await page.locator('[data-structural-edit-preview-mode="prepared"]').waitFor({ state: 'visible' });
  check('movePointerPreviewDoesNotPersist', JSON.stringify(await storedProject(page)) === baseline);
  await apply(surface);
  const moved = await waitForStored(page, (project) => project.nodes.find((node) => node.id === 'N1')?.x === 1 && project.nodes.find((node) => node.id === 'N1')?.y === 1);
  check('movePointerAppliesToProjectModel', moved.nodes.find((node) => node.id === 'N1')?.x === 1);

  const beforeCancel = JSON.stringify(moved);
  await selectSingle(page, 'node', 'N1');
  const cancelSurface = await openEdit(page);
  await fillField(cancelSurface, 'ΔX', 5);
  await cancelSurface.getByLabel('ΔX').press('Escape');
  await cancelSurface.waitFor({ state: 'hidden' });
  await sleep(page);
  check('escapeCancelLeavesProjectAndPersistenceUntouched', JSON.stringify(await storedProject(page)) === beforeCancel);
  const focusCanvas = await canvas.evaluate((element) => document.activeElement === element);
  check('escapeReturnsFocusToCanvas', focusCanvas);
};

const runMoveNumericAndAnalysisInvalidation = async (page) => {
  await resetToExample(page);
  await page.getByRole('button', { name: /^analizar$/i }).click();
  // CRI-116 · analizar ya no abre las salidas por su cuenta; hay que pedirlas.
  await openResultsSurface(page);
  await page.getByTestId('diagram-chart').waitFor({ state: 'visible' });
  await selectSingle(page, 'node', 'N1');
  const surface = await openEdit(page);
  await fillField(surface, 'ΔX', 2);
  await fillField(surface, 'ΔY', -1);
  check('moveNumericHasPreparedPreview', await page.locator('[data-structural-edit-preview="move"]').count() === 1);
  await apply(surface);
  const changed = await waitForStored(page, (project) => project.nodes.find((node) => node.id === 'N1')?.x === 2 && project.nodes.find((node) => node.id === 'N1')?.y === -1);
  check('moveNumericAppliesToProjectModel', changed.nodes.find((node) => node.id === 'N1')?.y === -1);
  await page.getByTestId('diagram-chart').waitFor({ state: 'hidden' });
  check('confirmedEditInvalidatesPriorResultsWithoutRerun', await page.getByTestId('diagram-chart').count() === 0);
};

const runRotateMirrorAndArray = async (page) => {
  await resetToExample(page);
  await selectSingle(page, 'node', 'N3');
  let surface = await openEdit(page);
  await chooseOperation(surface, /rotar/i);
  await fillField(surface, /centro x/i, 0);
  await fillField(surface, /centro y/i, 0);
  await fillField(surface, /ángulo/i, 90);
  await apply(surface);
  const rotated = await waitForStored(page, (project) => project.nodes.find((node) => node.id === 'N3')?.x === -4 && project.nodes.find((node) => node.id === 'N3')?.y === 0);
  check('rotateNumericAroundExplicitCenter', rotated.nodes.find((node) => node.id === 'N3')?.x === -4);

  await resetToExample(page);
  const original = await storedProject(page);
  await selectSingle(page, 'member', 'M1');
  surface = await openEdit(page);
  await chooseOperation(surface, /reflejar/i);
  await apply(surface);
  const mirrored = await waitForStored(page, (project) => project.nodes.find((node) => node.id === 'N1')?.y === 4 && project.nodes.find((node) => node.id === 'N3')?.y === 0);
  check('mirrorTransformPreservesEntityCounts', mirrored.nodes.length === original.nodes.length && mirrored.members.length === original.members.length);

  await resetToExample(page);
  const source = await storedProject(page);
  // M2 carries a member load in the built-in frame, so this verifies remapping
  // of a structural reference rather than only entity counts.
  await selectSingle(page, 'member', 'M2');
  surface = await openEdit(page);
  await chooseOperation(surface, /reflejar/i);
  await surface.getByRole('radio', { name: /crear copia/i }).click();
  await fillField(surface, /coordenada.*eje/i, 0);
  await apply(surface);
  const copied = await waitForStored(page, (project, memberCount) => project.members.length === memberCount + 1, source.members.length);
  check('mirrorCopyCreatesFreshEntitiesAndRemapsLoads', copied.nodes.length === source.nodes.length + 2 && copied.memberLoads.length === source.memberLoads.length + 1);

  await resetToExample(page);
  const arraySource = await storedProject(page);
  await selectSingle(page, 'member', 'M1');
  surface = await openEdit(page);
  await chooseOperation(surface, /matriz lineal/i);
  await fillField(surface, /dirección x/i, 1);
  await fillField(surface, /dirección y/i, 0);
  await fillField(surface, /espaciamiento/i, 2);
  await fillField(surface, /instancias totales/i, 3);
  await apply(surface);
  const array = await waitForStored(page, (project, memberCount) => project.members.length === memberCount + 2, arraySource.members.length);
  check('linearArrayHasOnePublishedBatch', array.nodes.length === arraySource.nodes.length + 4);
  await page.locator('.history-controls').getByLabel(/^deshacer$/i).click();
  await waitForStored(page, (project, memberCount) => project.members.length === memberCount, arraySource.members.length);
  await page.locator('.history-controls').getByLabel(/^rehacer$/i).click();
  await waitForStored(page, (project, memberCount) => project.members.length === memberCount + 2, arraySource.members.length);
  check('linearArrayUndoRedoIsExact', (await storedProject(page)).members.length === arraySource.members.length + 2);
};

const runAlignAndDistribute = async (page) => {
  await seedExample(page, (project) => {
    project.nodes.push(
      { id: 'QA-A', x: 1, y: 1, support: { type: 'none' } },
      { id: 'QA-B', x: 3, y: 1, support: { type: 'none' } },
      { id: 'QA-C', x: 5, y: 1, support: { type: 'none' } },
    );
  });
  await selectNodes(page, ['QA-A', 'QA-B', 'QA-C']);
  let surface = await openEdit(page);
  await chooseOperation(surface, /alinear/i);
  await apply(surface);
  const aligned = await waitForStored(page, (project) => ['QA-A', 'QA-B', 'QA-C'].every((id) => project.nodes.find((node) => node.id === id)?.x === 1));
  check('alignUsesModelCoordinates', ['QA-A', 'QA-B', 'QA-C'].every((id) => aligned.nodes.find((node) => node.id === id)?.x === 1));

  await seedExample(page, (project) => {
    project.nodes.push(
      { id: 'QA-A', x: 1, y: 1, support: { type: 'none' } },
      { id: 'QA-B', x: 2, y: 1, support: { type: 'none' } },
      { id: 'QA-C', x: 5, y: 1, support: { type: 'none' } },
    );
  });
  await selectNodes(page, ['QA-C', 'QA-A', 'QA-B']);
  surface = await openEdit(page);
  await chooseOperation(surface, /distribuir/i);
  await apply(surface);
  const distributed = await waitForStored(page, (project) => project.nodes.find((node) => node.id === 'QA-B')?.x === 3);
  check('distributeIsDeterministicAndPreservesExtremes', distributed.nodes.find((node) => node.id === 'QA-A')?.x === 1 && distributed.nodes.find((node) => node.id === 'QA-C')?.x === 5);
};

const runContextualToolbarAndResponsive = async (page) => {
  await page.setViewportSize({ width: 1536, height: 960 });
  await resetToExample(page);
  await selectSingle(page, 'node', 'N1');
  const toolbarAction = page.locator('.desktop-tool-list [data-structural-edit-command]');
  await toolbarAction.waitFor({ state: 'visible' });
  await toolbarAction.click();
  const desktopSurface = page.locator('[data-structural-edit-surface]');
  await desktopSurface.waitFor({ state: 'visible' });
  check('desktopEditFamilyEntryOpensContextualSurface', await desktopSurface.isVisible());
  await desktopSurface.getByRole('button', { name: /^cancelar$/i }).last().click();

  await page.setViewportSize({ width: 1024, height: 768 });
  await selectSingle(page, 'node', 'N1');
  const tabletSurface = await openEdit(page, 'keyboard');
  const tabletGeometry = await tabletSurface.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewport: window.innerWidth, scroll: document.documentElement.scrollWidth };
  });
  check('tabletSurfaceFitsWithoutHorizontalOverflow', tabletGeometry.left >= 0 && tabletGeometry.right <= tabletGeometry.viewport + 1 && tabletGeometry.scroll <= tabletGeometry.viewport + 1, JSON.stringify(tabletGeometry));
  const tabletCancel = tabletSurface.getByRole('button', { name: /^cancelar$/i }).last();
  await tabletCancel.press('Enter');
  await tabletSurface.waitFor({ state: 'hidden' });

  await page.setViewportSize({ width: 390, height: 844 });
  await resetToExample(page);
  // Compact permits one contextual layer. Clear the initial Inspector/Results
  // stack through its own controls before reaching the canvas tool tray.
  await closeCompactSurfaceStack(page);
  await selectSingle(page, 'node', 'N1');
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
  await more.locator('[data-structural-edit-command]').click();
  const mobileSurface = page.locator('[data-structural-edit-surface]');
  await mobileSurface.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const firstInput = document.querySelector('[data-structural-edit-surface] input');
    return firstInput instanceof HTMLInputElement && document.activeElement === firstInput;
  });
  check('mobileMoreRestoresCanvasAndFocusesFirstNumericField', true);
  const undersized = await mobileSurface.locator('button:visible, input:visible').evaluateAll((elements) => elements
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { name: element.getAttribute('aria-label') ?? element.textContent ?? '', width: rect.width, height: rect.height };
    })
    .filter((target) => target.width < 43.5 || target.height < 43.5));
  check('mobileEditSurfaceHas44pxTouchTargets', undersized.length === 0, JSON.stringify(undersized));
  const mobileGeometry = await mobileSurface.evaluate((element) => ({
    rect: element.getBoundingClientRect().toJSON(),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  check('mobileCanvasFirstTrayHasNoHorizontalOverflow', mobileGeometry.scrollWidth <= mobileGeometry.clientWidth + 1, JSON.stringify(mobileGeometry));
  await mobileSurface.getByRole('button', { name: /^cancelar$/i }).last().click();
};

const runChromiumTouch = async (page) => {
  if (engine !== 'chromium') return;
  await page.setViewportSize({ width: 390, height: 844 });
  await resetToExample(page);
  await closeCompactSurfaceStack(page);
  await selectSingle(page, 'node', 'N1');
  /*
   * Seleccionar en el lienzo PIDE el Inspector (`onRequestInspector`), y en
   * Compact su hoja ocupa la única ranura contextual: mientras esté abierta el
   * zócalo derivado queda suspendido (`resolveSurfaceActivity`), que es
   * justamente el contrato. Para alcanzar el zócalo hay que devolver la hoja,
   * igual que haría una persona — y por eso se despeja DESPUÉS de seleccionar,
   * no antes.
   */
  await closeCompactSurfaceStack(page);
  const surface = await openEdit(page);
  const start = await availableCanvasTouchPoint(page);
  const end = { x: start.x + 32, y: start.y };
  const cdp = await page.context().newCDPSession(page);
  const touchStart = { ...start, id: 17 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchStart] });
  // A normal one-finger contact starts as pending selection; crossing the
  // touch threshold must resolve it to pan while edit mode is not armed.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...start, x: start.x + 18, id: 17 }] });
  await page.waitForFunction(() => document.querySelector('.structural-canvas')?.getAttribute('data-interaction') === 'pan');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await surface.getByRole('button', { name: /usar puntero/i }).click();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchStart] });
  await page.waitForFunction(() => document.querySelector('.structural-canvas')?.getAttribute('data-interaction') === 'structural-edit');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 17 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-structural-edit-surface] input');
    return input instanceof HTMLInputElement && input.value !== '0';
  });
  check('touchMoveRequiresAndHonorsExplicitActivation', true);
  await surface.getByRole('button', { name: /^cancelar$/i }).last().click();
};

const runCandidatePicker = async (page) => {
  await page.setViewportSize({ width: 1536, height: 960 });
  await seedExample(page, (project) => {
    // N3 then has exactly node N3 + member M1 + nodal load NL1 at one point.
    project.members = project.members.filter((member) => member.id !== 'M2');
    project.memberLoads = project.memberLoads.filter((load) => load.memberId !== 'M2');
    project.nodalLoads = project.nodalLoads.filter((load) => load.id === 'NL1');
  });
  await selectSingle(page, 'node', 'N1');
  const dotRadiusBefore = await target(page, 'node', 'N3').locator('.node-dot').getAttribute('r');
  const picker = await openCandidatePickerFromKeyboard(page, 'node', 'N3');
  const options = picker.getByRole('option');
  check('candidatePickerShowsThreeExplicitCandidates', await options.count() === 3, String(await options.count()));
  check('candidatePickerPreservesPriorSelectionUntilConfirmation', await target(page, 'node', 'N1').getAttribute('aria-pressed') === 'true');
  const initialActive = await picker.locator('[data-candidate-active="true"]').getAttribute('id');
  check('candidatePickerPreviewsActiveExplicitId', Boolean(initialActive));
  await picker.getByRole('listbox').press('ArrowDown');
  const cycledActive = await picker.locator('[data-candidate-active="true"]').getAttribute('id');
  check('candidatePickerKeyboardCyclesPreview', Boolean(cycledActive && cycledActive !== initialActive), `${initialActive} -> ${cycledActive}`);

  await page.evaluate(() => document.documentElement.style.filter = 'grayscale(1)');
  await page.screenshot({ path: path.join(artifactsDir, `cri-96-candidate-picker-grayscale-${engine}.png`), fullPage: true });
  await page.evaluate(() => document.documentElement.style.removeProperty('filter'));

  await picker.getByRole('listbox').press('Escape');
  await picker.waitFor({ state: 'hidden' });
  check('candidatePickerEscapePreservesPriorSelection', await target(page, 'node', 'N1').getAttribute('aria-pressed') === 'true');

  const confirmPicker = await openCandidatePickerFromKeyboard(page, 'node', 'N3');
  await confirmPicker.locator('#candidate-option-member-M1').click();
  await confirmPicker.getByRole('listbox').press('Enter');
  await confirmPicker.waitFor({ state: 'hidden' });
  check('candidatePickerEnterConfirmsOnlyActiveCandidate', await target(page, 'member', 'M1').getAttribute('aria-pressed') === 'true');
  const dotRadiusAfter = await target(page, 'node', 'N3').locator('.node-dot').getAttribute('r');
  check('candidatePickerDoesNotChangeTechnicalNodeGeometry', dotRadiusBefore === '7' && dotRadiusAfter === '7', `${dotRadiusBefore} -> ${dotRadiusAfter}`);

  if (engine !== 'chromium') return;
  const cdp = await page.context().newCDPSession(page);
  const point = await nodeCenter(page, 'N3');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 96 }] });
  await page.waitForTimeout(480);
  await page.locator('[data-candidate-picker]').waitFor({ state: 'visible' });
  check('candidatePickerTouchLongPressUses480msContract', true);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.keyboard.press('Escape');

  const background = await availableCanvasTouchPoint(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...background, id: 97 }] });
  await page.waitForTimeout(160);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...background, x: background.x + 4, id: 97 }] });
  await page.waitForTimeout(360);
  check('candidatePickerSlowPanDoesNotArmPickerOrMarquee',
    await page.locator('[data-candidate-picker]').count() === 0
      && await page.locator('.structural-canvas').getAttribute('data-interaction') !== 'selection-box');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => document.querySelector('.structural-canvas')?.getAttribute('data-interaction') === 'idle');

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...background, id: 98 }] });
  await page.waitForTimeout(480);
  check('candidatePickerTouchLongPressArmsBackgroundMarquee', await page.locator('.structural-canvas').getAttribute('data-interaction') === 'selection-box');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const runCri97ContextualActions = async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedExample(page, (project) => {
    const member = project.members.find((candidate) => candidate.id === 'M1');
    if (!member) throw new Error('Expected member M1 in the example project.');
    Object.assign(member, {
      materialId: 'steel-a36', materialOrigin: 'catalog',
      sectionId: 'w310x39', sectionOrigin: 'catalog',
    });
  });
  await closeCompactSurfaceStack(page);
  await selectSingle(page, 'member', 'M1');
  // Seleccionar PIDE el Inspector, y su hoja ocupa la única ranura contextual
  // de Compact: mientras esté abierta el zócalo derivado queda suspendido
  // (`resolveSurfaceActivity`). Se devuelve la hoja DESPUÉS de seleccionar.
  await closeCompactSurfaceStack(page);
  const toolbar = contextualActions(page);
  await toolbar.waitFor({ state: 'visible' });
  const visibleButtons = await toolbar.getByRole('button').allTextContents();
  check('cri97CompactFloorIsPrimaryDeleteAndOverflowOnly', visibleButtons.length === 3
    && visibleButtons[0].includes('Editar selección')
    && visibleButtons[1].includes('Borrar')
    && visibleButtons[2].includes('⋯'), JSON.stringify(visibleButtons));
  await page.screenshot({ path: path.join(artifactsDir, `cri-97-compact-floor-${engine}.png`), fullPage: true });

  let menu = await openContextualOverflow(page);
  const overflowText = await menu.innerText();
  check('cri97OverflowShowsNamesAndShortcuts', ['Copiar', 'Pegar', 'Duplicar', 'Repetir', 'Abrir hoja de datos']
    .every((label) => overflowText.includes(label))
    && ['Ctrl/Cmd+C', 'Ctrl/Cmd+V', 'Ctrl/Cmd+D', 'R'].every((shortcut) => overflowText.includes(shortcut)), overflowText);
  await page.screenshot({ path: path.join(artifactsDir, `cri-97-overflow-${engine}.png`), fullPage: true });
  await touchActivate(page, menu.getByRole('menuitem', { name: /copiar/i }));
  await page.locator('.canvas-feedback').waitFor({ state: 'visible' });
  check('cri97CopyRunsByTouch', (await page.locator('.canvas-feedback').innerText()).includes('Copia estructural lista'));

  results.clipboardReadText = await clipboardReadTextStatus(page);
  const membersBeforePaste = (await storedProject(page)).members.length;
  menu = await openContextualOverflow(page);
  await touchActivate(page, menu.getByRole('menuitem', { name: /pegar/i }));
  const pastedProject = await waitForStored(page, (project, count) => project.members.length === count + 1, membersBeforePaste);
  const pastedMember = pastedProject.members.at(-1);
  check('cri97PasteRunsByTouchAndKeepsCatalogIdentity', pastedMember?.materialId === 'steel-a36'
    && pastedMember?.sectionId === 'w310x39'
    && pastedMember?.materialOrigin === 'catalog'
    && pastedMember?.sectionOrigin === 'catalog', JSON.stringify(pastedMember));
  await page.screenshot({ path: path.join(artifactsDir, `cri-97-paste-identity-${engine}.png`), fullPage: true });

  const membersBeforeDuplicate = pastedProject.members.length;
  await selectSingle(page, 'member', 'M1');
  menu = await openContextualOverflow(page);
  await touchActivate(page, menu.getByRole('menuitem', { name: /duplicar/i }));
  await touchActivate(page, page.getByRole('button', { name: /confirmar duplicado/i }));
  await waitForStored(page, (project, count) => project.members.length === count + 1, membersBeforeDuplicate);
  check('cri97DuplicateRunsByTouch', true);

  await selectSingle(page, 'member', 'M1');
  menu = await openContextualOverflow(page);
  await touchActivate(page, menu.getByRole('menuitem', { name: /repetir/i }));
  await page.locator('.repeat-preview[data-repeat-affordance="active"]').waitFor({ state: 'visible' });
  check('cri97RepeatRunsByTouch', true);
  await touchActivate(page, page.getByRole('button', { name: /cancelar colocación/i }));

  menu = await openContextualOverflow(page);
  await touchActivate(page, menu.getByRole('menuitem', { name: /abrir hoja de datos/i }));
  const datasheet = page.locator('[data-workspace-surface="datasheet"]');
  await datasheet.waitFor({ state: 'visible' });
  check('cri97DatasheetRunsByTouch', await datasheet.isVisible());
  await touchActivate(page, page.getByRole('button', { name: /cerrar hoja de datos/i }));
  await datasheet.waitFor({ state: 'hidden' });

  await contextualActions(page).waitFor({ state: 'visible' });
  const picker = await openCandidatePickerFromKeyboard(page, 'node', 'N3');
  check('cri97PickerAndContextualActionsDoNotCoexistInCompact', await picker.isVisible()
    && await contextualActions(page).count() === 0);
  await picker.getByRole('listbox').press('Escape');
  await picker.waitFor({ state: 'hidden' });
  await contextualActions(page).waitFor({ state: 'visible' });
  check('cri97ContextualActionsResumeAfterPickerWithoutChangingSelection',
    await target(page, 'member', 'M1').getAttribute('aria-pressed') === 'true');

  for (const [width, expectedShell] of [[1536, 'X2'], [1024, 'M1'], [390, 'K0']]) {
    await setViewportAndWaitForShell(page, width, 844, expectedShell);
    await contextualActions(page).waitFor({ state: 'visible' });
    const brokerGeometry = await contextualActions(page).evaluate((element) => ({
      shellClass: element.getAttribute('data-shell-class'),
      presentation: element.getAttribute('data-presentation'),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    }));
    check(`cri97BrokerPresentation${expectedShell}`,
      brokerGeometry.shellClass === expectedShell && brokerGeometry.presentation === 'inset', JSON.stringify(brokerGeometry));
  }

  await setViewportAndWaitForShell(page, 844, 390, 'K0');
  await contextualActions(page).waitFor({ state: 'visible' });
  const landscape = await toolbar.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.innerWidth;
    return {
      text: element.textContent,
      left: rect.left,
      right: rect.right,
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  check('cri97CompactLandscapeEsHasNoHorizontalOverflow', landscape.text?.includes('Editar selección')
    && landscape.left >= 0 && landscape.right <= landscape.viewport + 1
    && landscape.scrollWidth <= landscape.viewport + 1, JSON.stringify(landscape));
  await page.screenshot({ path: path.join(artifactsDir, `cri-97-compact-landscape-es-${engine}.png`), fullPage: true });
};

const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, locale: 'es-MX', hasTouch: true });
await context.addInitScript(({ marker, clearStorage }) => {
  const serialized = new URL(window.location.href).searchParams.get(marker);
  if (serialized === null) return;
  if (serialized === clearStorage) window.localStorage.clear();
  else window.localStorage.setItem('structureCo.project', serialized);
}, { marker: QA_BOOT_QUERY, clearStorage: QA_CLEAR_STORAGE });
// CRI-116 · el init de arriba sólo limpiaba `localStorage`. La biblioteca vive en
// IndexedDB y sobrevivía a la siembra, así que el producto saltaba solo a la Mesa
// (CRI-104) y no quedaba bienvenida que recorrer.
await clearProjectLibraryOnBoot(context);
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') results.console.push(message.text());
});
page.on('pageerror', (error) => results.pageErrors.push(String(error)));

try {
  const runStep = async (label, action) => {
    console.log(`[structural-edits:${engine}] ${label}`);
    await action();
  };
  await runStep('Move pointer and cancel', () => runMovePointerAndCancel(page));
  await runStep('Move numeric and analysis invalidation', () => runMoveNumericAndAnalysisInvalidation(page));
  await runStep('Rotate, Mirror and Linear Array', () => runRotateMirrorAndArray(page));
  await runStep('Align and Distribute', () => runAlignAndDistribute(page));
  await runStep('Desktop, tablet and mobile responsive UI', () => runContextualToolbarAndResponsive(page));
  await runStep('Chromium touch', () => runChromiumTouch(page));
  await runStep('CRI-96 Candidate Picker', () => runCandidatePicker(page));
  await runStep('CRI-97 contextual actions and touch parity', () => runCri97ContextualActions(page));
  await page.screenshot({ path: path.join(artifactsDir, `structural-edits-${engine}.png`), fullPage: true });
  check('noConsoleErrors', results.console.length === 0, JSON.stringify(results.console));
  check('noPageErrors', results.pageErrors.length === 0, JSON.stringify(results.pageErrors));
  console.log(engine === 'chromium'
    ? 'Structural editing browser QA passed in chromium: Move pointer/numeric/cancel, Rotate, Mirror, Linear Array, Align, Distribute, undo/redo, invalidation, responsive and touch.'
    : 'Structural editing browser QA passed in webkit: Move pointer/numeric/cancel, Rotate, Mirror, Linear Array, Align, Distribute, undo/redo, invalidation, responsive UI and CRI-97 contextual touch routes. Canvas gesture movement is covered by Chromium CDP.');
} finally {
  fs.writeFileSync(path.join(artifactsDir, `structural-edits-${engine}.json`), JSON.stringify(results, null, 2));
  await context.close();
  await browser.close();
  await previewServer.close();
}
