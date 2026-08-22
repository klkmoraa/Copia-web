/**
 * QA de navegador de la reconciliación Clay (CRI-105).
 *
 * Captura la MISMA batería antes y después del cambio, y con ella prueba lo que
 * un test estático no puede: la materia compuesta por el navegador. Sobre
 * `getComputedStyle` afirma canto de 1px, ausencia de sombra exterior en
 * pulsado, hundimiento por token y su anulación bajo `prefers-reduced-motion`.
 *
 * El Component Lab sólo existe en DEV (`/__components`), así que el servidor es
 * el de desarrollo y no el de `preview`.
 *
 * Uso: node scripts/qa-clay-reconciliation.mjs <before|after>
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const phase = process.argv[2];
if (phase !== 'before' && phase !== 'after') throw new Error('Uso: node scripts/qa-clay-reconciliation.mjs <before|after>');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(repoRoot, 'reports', 'evidence', '2026-08-20-cri-105-clay');
const outDir = path.join(evidenceRoot, phase);
fs.mkdirSync(outDir, { recursive: true });

const server = await createServer({ root: repoRoot, server: { host: '127.0.0.1', port: 4199, strictPort: true }, logLevel: 'error' });
await server.listen();
const baseURL = 'http://127.0.0.1:4199/';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium',
});

const report = { phase, shots: [], computed: {}, notes: [] };
const shoot = async (target, name) => {
  const file = path.join(outDir, `${name}.png`);
  await target.screenshot({ path: file }).catch((error) => { report.notes.push(`sin captura ${name}: ${error.message}`); });
  if (fs.existsSync(file)) report.shots.push(`${phase}/${name}.png`);
};

const newPage = async (options) => {
  const page = await browser.newPage({ locale: 'es-ES', ...options });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, register: async () => ({ installing: null, waiting: null, addEventListener: () => undefined }), addEventListener: () => undefined },
    });
  });
  return page;
};

/** Lee la materia compuesta de un selector: canto, sombra, radio y transform. */
const materialOf = (page, selector) => page.evaluate((target) => {
  const element = document.querySelector(target);
  if (!element) return null;
  const style = getComputedStyle(element);
  return {
    borderTopWidth: style.borderTopWidth,
    borderBottomWidth: style.borderBottomWidth,
    borderTopColor: style.borderTopColor,
    borderRadius: style.borderRadius,
    boxShadow: style.boxShadow,
    transform: style.transform,
    outlineWidth: style.outlineWidth,
    outlineColor: style.outlineColor,
    backgroundImage: style.backgroundImage,
  };
}, selector);

/**
 * Toda capa de `box-shadow` sin la palabra `inset` es sombra exterior.
 * `getComputedStyle` serializa `<color> <offsets> inset`, así que la palabra va
 * al final y no al principio como en el CSS que se escribe.
 */
const outerLayers = (boxShadow) => (boxShadow ?? '')
  .replace(/(rgba?|color)\([^)]*\)/g, 'C')
  .split(',')
  .map((layer) => layer.trim())
  .filter((layer) => layer && layer !== 'none' && !layer.includes('inset'));

// ---------------------------------------------------------------------------
// 1 · Component Lab — seis niveles, radios por rol, estados y tamaños
// ---------------------------------------------------------------------------
for (const theme of ['light', 'dark']) {
  const page = await newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: theme });
  await page.goto(`${baseURL}__components`, { waitUntil: 'networkidle' });
  await page.locator('.component-lab').waitFor({ state: 'visible', timeout: 30_000 });
  await page.evaluate((next) => document.documentElement.setAttribute('data-theme', next), theme);
  await page.waitForTimeout(400);

  // La barra flotante de "última interacción" del Lab tapa las vitrinas al
  // recortarlas; se oculta sólo mientras se fotografían.
  await page.addStyleTag({ content: '.component-lab__event { display: none !important; }' });

  const levels = page.locator('.component-lab__material-levels');
  if (await levels.count()) await shoot(levels.first(), `lab-material-levels-${theme}`);

  for (const [name, selector] of [
    ['lab-radius-roles', '.component-lab__radius-roles'],
    ['lab-depth-sizes', '.component-lab__depth-sizes'],
    ['lab-technical-flatness', '.component-lab__flatness'],
  ]) {
    const block = page.locator(selector);
    if (await block.count()) await shoot(block.first(), `${name}-${theme}`);
    else report.notes.push(`${selector} aún no existe (${phase}/${theme})`);
  }

  // Controles: reposo, hover, foco, pulsado, deshabilitado.
  const buttons = page.locator('.component-lab__row').first();
  await shoot(buttons, `controls-rest-${theme}`);
  const primary = page.locator('.sc-button--primary').first();
  await primary.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  report.computed[`button-primary-rest-${theme}`] = await materialOf(page, '.sc-button--primary');
  await primary.hover();
  await page.waitForTimeout(200);
  await shoot(buttons, `controls-hover-${theme}`);
  await primary.focus();
  await page.waitForTimeout(200);
  await shoot(buttons, `controls-focus-${theme}`);
  report.computed[`button-primary-focus-${theme}`] = await materialOf(page, '.sc-button--primary');
  const box = await primary.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await shoot(buttons, `controls-pressed-${theme}`);
  report.computed[`button-primary-pressed-${theme}`] = await materialOf(page, '.sc-button--primary');
  await page.mouse.up();

  // Un icon button y un tool button pulsados, por si su materia diverge.
  for (const [name, selector] of [['icon-button', '.sc-icon-button'], ['tool-button', '.sc-tool-button'], ['segmented', '.sc-segmented button']]) {
    const control = page.locator(selector).first();
    if (!await control.count()) continue;
    await control.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(160);
    report.computed[`${name}-rest-${theme}`] = await materialOf(page, selector);
    const rect = await control.boundingBox();
    if (!rect) continue;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(160);
    report.computed[`${name}-pressed-${theme}`] = await materialOf(page, selector);
    await shoot(control, `${name}-pressed-${theme}`);
    await page.mouse.up();
  }

  // Campos, tabla y dato técnico: planitud.
  for (const [name, selector] of [['field', '.sc-field__control'], ['unit-field', '.sc-unit-field__control'], ['property-row', '.sc-property-row']]) {
    report.computed[`${name}-${theme}`] = await materialOf(page, selector);
  }

  await shoot(page, `lab-full-${theme}`);
  await page.close();
}

// ---------------------------------------------------------------------------
// 2 · Reduced motion — el relieve permanece, el hundimiento se retira
// ---------------------------------------------------------------------------
for (const motion of ['no-preference', 'reduce']) {
  const page = await newPage({ viewport: { width: 1200, height: 900 }, colorScheme: 'light', reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' });
  await page.goto(`${baseURL}__components`, { waitUntil: 'networkidle' });
  await page.locator('.component-lab').waitFor({ state: 'visible', timeout: 30_000 });
  const secondary = page.locator('.sc-button--secondary').first();
  await secondary.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  report.computed[`reduced-motion-${motion}-rest`] = await materialOf(page, '.sc-button--secondary');
  const rect = await secondary.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(220);
  const material = await materialOf(page, '.sc-button--secondary');
  report.computed[`reduced-motion-${motion}-pressed`] = material;
  report.computed[`reduced-motion-${motion}-pressed-outer-layers`] = outerLayers(material?.boxShadow);
  await shoot(secondary, `reduced-motion-${motion}-pressed`);
  await page.mouse.up();
  await page.close();
}

// ---------------------------------------------------------------------------
// 3 · Producto — TopBar, ToolRail, Inspector, Results, canvas chrome, Welcome
// ---------------------------------------------------------------------------
const CLASSES = {
  x2: { width: 1440, height: 900 },
  m1: { width: 1100, height: 768 },
  'k0-portrait': { width: 390, height: 844 },
  'k0-landscape': { width: 844, height: 390 },
};

/**
 * Entra a la Mesa cargando el pórtico de ejemplo.
 *
 * La bienvenida de CRI-104 tiene cuatro pasos y el proyecto en blanco es el
 * camino corto: sin modelo no hay rejilla que fotografiar ni resultados que
 * comprobar planos, así que hay que recorrer los pasos hasta la plantilla.
 */
const enterShell = async (page) => {
  const shell = page.locator('.app-shell');
  if (await shell.isVisible().catch(() => false)) return;
  const step = async (pattern) => {
    const button = page.getByRole('button', { name: pattern }).first();
    if (!await button.count()) return false;
    await button.click().catch(() => undefined);
    await page.waitForTimeout(900);
    return true;
  };
  await step(/ver otras formas de empezar|other ways to start/i);
  await step(/proyecto completo|full project/i);
  await step(/pórtico de ejemplo|example portal/i);
  if (await shell.isVisible().catch(() => false)) return;
  for (const pattern of [/ir a la mesa|go to the table/i, /^nuevo proyecto/i, /continuar proyecto/i]) {
    if (await step(pattern) && await shell.isVisible().catch(() => false)) return;
  }
  await shell.waitFor({ state: 'visible', timeout: 25_000 });
};

for (const theme of ['light', 'dark']) {
  const page = await newPage({ viewport: CLASSES.x2, colorScheme: theme, hasTouch: false });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(700);
  await shoot(page, `welcome-x2-${theme}`);
  await enterShell(page);
  await page.waitForTimeout(1500);
  await shoot(page, `workspace-x2-${theme}`);

  for (const [name, selector] of [
    ['topbar', '.topbar'],
    ['toolrail', '.toolbar'],
    ['inspector', '.inspector-panel'],
    ['inspector-summary', '.inspector-summary'],
    ['canvas-controls', '.canvas-controls'],
    ['canvas-mode-badge', '.canvas-mode-badge'],
  ]) {
    const element = page.locator(selector).first();
    report.computed[`${name}-${theme}`] = await materialOf(page, selector);
    if (await element.count() && await element.isVisible().catch(() => false)) await shoot(element, `${name}-${theme}`);
  }

  // Results: tarjetas permitidas, tabla técnica plana. Requiere un análisis.
  await page.getByRole('button', { name: /analizar|analyze/i }).first().click({ timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  const opener = page.getByRole('button', { name: /^(Resultados|Results)$/ }).first();
  if (await opener.count()) { await opener.focus(); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(600);
  const summaryTab = page.getByRole('tab', { name: /^(Resumen|Summary)$/ }).first();
  if (await summaryTab.count()) await summaryTab.click({ timeout: 8_000 }).catch(() => undefined);
  await page.locator('.result-extreme-card').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  for (const [name, selector] of [['results', '.results-panel'], ['results-card', '.result-extreme-card'], ['results-table', '.results-table']]) {
    const element = page.locator(selector).first();
    report.computed[`${name}-${theme}`] = await materialOf(page, selector);
    if (await element.count() && await element.isVisible().catch(() => false)) await shoot(element, `${name}-${theme}`);
    else report.notes.push(`${selector} no visible en ${theme}`);
  }

  // Datasheet: rejilla plana.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('structureco:open-datasheet')));
  const surface = page.locator('.datasheet-surface').first();
  if (await surface.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
    await page.waitForTimeout(600);
    await shoot(page.locator('.datasheet-surface').first(), `datasheet-${theme}`);
    report.computed[`datasheet-cell-${theme}`] = await materialOf(page, '.datasheet-grid tbody td');
    report.computed[`datasheet-scroll-${theme}`] = await materialOf(page, '.datasheet-grid-scroll');
    report.computed[`datasheet-surface-${theme}`] = await materialOf(page, '.datasheet-surface');
  } else {
    report.notes.push(`Datasheet no abrió en ${theme}`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.close();
}

// K0: portrait y landscape, sin overflow horizontal.
for (const label of ['k0-portrait', 'k0-landscape']) {
  const page = await newPage({ viewport: CLASSES[label], colorScheme: 'light', hasTouch: true, isMobile: true });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 30_000 });
  await enterShell(page);
  await page.waitForTimeout(1200);
  await shoot(page, `workspace-${label}`);
  report.computed[`overflow-${label}`] = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  await page.close();
}

// M1 en inglés: el ritmo no debe producir overflow al alargar etiquetas.
{
  const page = await browser.newPage({ viewport: CLASSES.m1, locale: 'en-US', colorScheme: 'light' });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 30_000 });
  await enterShell(page);
  await page.waitForTimeout(1200);
  await shoot(page, 'workspace-m1-en');
  report.computed['overflow-m1-en'] = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  await page.close();
}

await browser.close();
await server.close();

fs.writeFileSync(path.join(evidenceRoot, `computed-styles.${phase}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(`${phase}: ${report.shots.length} capturas · ${Object.keys(report.computed).length} lecturas`);
for (const note of report.notes) console.log(`  nota: ${note}`);
