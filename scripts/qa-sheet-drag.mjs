import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearProjectLibraryOnBoot, openExamplePortal } from './qa-welcome.mjs';

/**
 * QA de navegador del arrastre nativo de hojas móviles (fase 4 · motion y
 * experiencia móvil): el detent-resize del Inspector en K0 y el
 * swipe-to-dismiss de la paleta móvil de herramientas. Ninguna de las dos
 * físicas de gesto (rubber-band, velocidad, snap) es demostrable en jsdom —
 * necesitan un `pointermove` real con posición y `timeStamp`.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 4185;
const baseURL = `http://127.0.0.1:${port}/`;
const artifactsDir = path.join(root, 'qa-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const previewServer = await preview({ root, preview: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});
const results = { url: baseURL, checks: {}, console: [], pageErrors: [] };

const check = (name, condition, detail = '') => {
  results.checks[name] = { pass: Boolean(condition), detail };
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
};

const sleep = (page, milliseconds = 260) => page.waitForTimeout(milliseconds);

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await clearProjectLibraryOnBoot(context);
const page = await context.newPage();
page.on('console', (message) => { if (message.type() === 'error') results.console.push(message.text()); });
page.on('pageerror', (error) => results.pageErrors.push(String(error)));

/** Arrastre punto a punto: varios `mouse.move` intermedios, como un dedo real,
 * para que `useSheetResizeDrag`/`useSheetDismissDrag` calculen velocidad entre
 * muestras en vez de un único salto. */
const dragVertical = async (page, x, fromY, toY, { steps = 8, pauseMs = 16 } = {}) => {
  await page.mouse.move(x, fromY);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    const y = fromY + ((toY - fromY) * i) / steps;
    await page.mouse.move(x, y);
    await page.waitForTimeout(pauseMs);
  }
  await page.mouse.up();
};

const enterWorkspaceExample = async () => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await openExamplePortal(page, page.locator('.welcome-template-card').filter({ hasText: /P.rtico de ejemplo/i }));
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  await sleep(page, 300);
};

// -------------------------------------------------------------- Inspector ---

const runInspectorDetentDrag = async () => {
  const sheet = page.locator('.inspector-panel[data-workspace-surface="detail"]');
  await page.locator('.inspector-panel.mobile-open').waitFor({ state: 'visible' });
  check('inspectorOpensAtMediumByDefault', await sheet.getAttribute('data-mobile-detent') === 'medium');

  const handle = page.locator('[data-workspace-surface="detail"] .inspector-grab-handle');
  await handle.waitFor({ state: 'visible' });
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('El tirador del Inspector no es medible.');
  const heightBefore = (await sheet.boundingBox())?.height ?? 0;

  // Arrastre lento hacia arriba: por distancia, no por velocidad, debe aterrizar en «large».
  const x = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await dragVertical(page, x, startY, startY - 260, { steps: 10, pauseMs: 30 });
  await sleep(page, 420); // deja terminar la transición de asentamiento
  check('dragUpSnapsToLarge', await sheet.getAttribute('data-mobile-detent') === 'large');
  const heightAfterExpand = (await sheet.boundingBox())?.height ?? 0;
  check('heightGrewAfterDragUp', heightAfterExpand > heightBefore, `${heightBefore} → ${heightAfterExpand}`);
  check('dragCleansUpDraggingState', await sheet.getAttribute('data-sheet-dragging') === null);

  // Flick rápido hacia abajo: debe CERRAR la hoja, no sólo bajar a «compact».
  const handleAfterExpand = await handle.boundingBox();
  if (!handleAfterExpand) throw new Error('El tirador no es medible tras expandir.');
  const flickX = handleAfterExpand.x + handleAfterExpand.width / 2;
  const flickY = handleAfterExpand.y + handleAfterExpand.height / 2;
  await dragVertical(page, flickX, flickY, flickY + 260, { steps: 4, pauseMs: 8 });
  // Cerrar «detail» sin nada seleccionado retira su intención del broker por
  // completo (CRI-94: cerrar no es suspender) — el panel se DESMONTA, no sólo
  // se oculta. `waitFor('hidden')` acepta las dos formas de "ya no está".
  await sheet.waitFor({ state: 'hidden', timeout: 5000 });
  check('fastFlickDownDismisses', true);
};

// ------------------------------------------------------------- Tool rail -----

const runPaletteDismissDrag = async () => {
  await page.getByRole('button', { name: /más herramientas|more tools/i }).first().click();
  const palette = page.locator('.mobile-tool-palette');
  await palette.waitFor({ state: 'visible' });
  const paletteBoxBefore = await palette.boundingBox();
  if (!paletteBoxBefore) throw new Error('La paleta móvil no es medible.');

  const handle = page.locator('.mobile-tool-palette-handle');
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('El tirador de la paleta no es medible.');
  const x = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  // Arrastre corto: no cruza el umbral, la hoja tiene que seguir abierta.
  await dragVertical(page, x, startY, startY + 30, { steps: 4, pauseMs: 20 });
  await sleep(page, 380);
  check('shortDragKeepsPaletteOpen', await palette.isVisible());

  // Arrastre largo: cruza el umbral de distancia, la hoja tiene que cerrarse.
  const handleBox2 = await handle.boundingBox();
  if (!handleBox2) throw new Error('El tirador de la paleta no es medible tras el primer arrastre.');
  await dragVertical(page, handleBox2.x + handleBox2.width / 2, handleBox2.y + handleBox2.height / 2, handleBox2.y + 160, { steps: 6, pauseMs: 20 });
  await sleep(page, 380);
  check('longDragDismissesPalette', await palette.count() === 0 || !(await palette.isVisible().catch(() => false)));
};

const runStep = async (label, run) => {
  process.stdout.write(`[sheet-drag] ${label}\n`);
  await run();
};

try {
  await enterWorkspaceExample();
  await runStep('Inspector sheet: drag-to-detent, velocity dismiss, cleanup', runInspectorDetentDrag);
  await runStep('Mobile tool palette: short drag springs back, long drag dismisses', runPaletteDismissDrag);
  check('noConsoleErrors', results.console.length === 0, JSON.stringify(results.console));
  check('noPageErrors', results.pageErrors.length === 0, JSON.stringify(results.pageErrors));
  console.log('Sheet drag browser QA passed: Inspector detent drag + tool palette dismiss drag.');
} finally {
  fs.writeFileSync(path.join(artifactsDir, 'sheet-drag.json'), JSON.stringify(results, null, 2));
  await context.close();
  await browser.close();
  await previewServer.close();
}
