/**
 * AUDIT/TEMPORARY — CRI-91 visual QA and screenshot evidence.
 *
 * Uses the repository's existing Vite + Playwright toolchain. It adds no
 * runtime dependency and never enters the structural workspace.
 *
 * Run from the repository root:
 *   node validation/cri-91/cri91-visual-qa.mjs
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDirectory = path.join(root, 'validation', 'cri-91', 'evidence');
const brandbookUrl = 'http://127.0.0.1:4190/brandbook-clay.html';
mkdirSync(evidenceDirectory, { recursive: true });

const staticServer = createHttpServer((request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  const asset = request.url === '/logo.svg'
    ? { path: path.join(root, 'brand', 'logo.svg'), type: 'image/svg+xml' }
    : request.url === '/brandbook-clay.html'
      ? { path: path.join(root, 'brand', 'brandbook-clay.html'), type: 'text/html; charset=utf-8' }
      : null;
  if (!asset) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': asset.type });
  response.end(readFileSync(asset.path));
});
await new Promise((resolve, reject) => {
  staticServer.once('error', reject);
  staticServer.listen(4190, '127.0.0.1', resolve);
});

const vite = await createViteServer({
  root,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 4189, strictPort: true },
});
await vite.listen();

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const browserErrors = [];
const checked = [];

const attachDiagnostics = (page, surface) => {
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${surface} console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`${surface} page: ${error.message}`));
};

const assertNoOverflow = async (page, label) => {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  assert.ok(
    geometry.scrollWidth <= geometry.clientWidth + 1 && geometry.bodyScrollWidth <= geometry.clientWidth + 1,
    `${label} horizontal overflow: ${JSON.stringify(geometry)}`,
  );
};

const focusByKeyboard = async (page, selector, label) => {
  await page.evaluate(() => document.activeElement?.blur());
  for (let index = 0; index < 160; index += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((candidate) => document.activeElement?.matches(candidate) ?? false, selector)) return;
  }
  throw new Error(`${label} was not reachable with Tab`);
};

const setBrandbookTheme = async (page, theme) => {
  const selector = `[data-theme-choice="${theme}"]`;
  await page.locator(selector).evaluate((button) => button.click());
  await page.waitForFunction((expectedTheme) => document.documentElement.dataset.theme === expectedTheme, theme);
  assert.equal(await page.locator(selector).getAttribute('aria-pressed'), 'true', `Brandbook ${theme} control did not expose its pressed state`);
};

const assertGraphiteNight = async (page, label, propertyNames) => {
  const colors = await page.evaluate((names) => {
    const styles = getComputedStyle(document.documentElement);
    return names.map((name) => styles.getPropertyValue(name).trim().toLowerCase());
  }, propertyNames);
  assert.equal(new Set(colors).size, colors.length, `${label} night levels are not all distinct: ${colors.join(', ')}`);
  assert.ok(colors.every((color) => !['#000', '#000000', 'rgb(0, 0, 0)'].includes(color)), `${label} uses pure black`);
  checked.push(`${label}: four distinct cold-graphite levels ${colors.join(' / ')}`);
};

try {
const brandbook = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
attachDiagnostics(brandbook, 'Brandbook');
const brandbookResponse = await brandbook.goto(brandbookUrl, { waitUntil: 'load', timeout: 120_000 });
assert.equal(brandbookResponse?.status(), 200, `Brandbook server returned ${brandbookResponse?.status() ?? 'no response'}`);
await brandbook.locator('[data-theme-choice="light"]').waitFor({ state: 'visible', timeout: 120_000 });

for (const width of [1440, 900, 390]) {
  await brandbook.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  for (const theme of ['light', 'dark']) {
    await setBrandbookTheme(brandbook, theme);
    await assertNoOverflow(brandbook, `Brandbook ${theme} ${width}px`);
  }
}

await brandbook.setViewportSize({ width: 1440, height: 1000 });
await setBrandbookTheme(brandbook, 'light');
await brandbook.screenshot({ path: path.join(evidenceDirectory, 'brandbook-day-expanded.png'), fullPage: true });
await brandbook.locator('#separacion').screenshot({ path: path.join(evidenceDirectory, 'cvd-evidence-day.png') });
await setBrandbookTheme(brandbook, 'dark');
await brandbook.screenshot({ path: path.join(evidenceDirectory, 'brandbook-night-expanded.png'), fullPage: true });
await assertGraphiteNight(brandbook, 'Brandbook', ['--app', '--canvas', '--surface', '--raised']);
assert.equal(await brandbook.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ambient').trim()), 'transparent', 'Brandbook Night has a green ambient halo');

const brandInfluence = await brandbook.locator('.qa-influence').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).strokeDasharray));
assert.ok(brandInfluence.length > 0 && brandInfluence.every((value) => value !== 'none' && value !== '0px'), `Brandbook influence is not always dashed: ${brandInfluence.join(', ')}`);
const brandDeformed = await brandbook.locator('.qa-deformed').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).strokeDasharray));
assert.ok(brandDeformed.length > 0 && brandDeformed.every((value) => value === 'none' || value === '0px'), `Brandbook deformed is not continuous: ${brandDeformed.join(', ')}`);

const brandFocus = brandbook.getByRole('button', { name: 'Noche' });
await focusByKeyboard(brandbook, '[data-theme-choice="dark"]', 'Brandbook Night theme button');
const brandFocusStyle = await brandFocus.evaluate((element) => {
  const style = getComputedStyle(element);
  return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
});
assert.equal(brandFocusStyle.outlineStyle, 'solid', 'Brandbook focus-visible outline is missing');
assert.notEqual(brandFocusStyle.outlineWidth, '0px', 'Brandbook focus-visible width is zero');

await brandbook.setViewportSize({ width: 390, height: 844 });
await brandbook.evaluate(() => window.scrollTo(0, 0));
await brandbook.screenshot({ path: path.join(evidenceDirectory, 'brandbook-compact-color.png'), fullPage: true });

const lab = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
attachDiagnostics(lab, 'Component Lab');
await lab.goto('http://127.0.0.1:4189/__components', { waitUntil: 'networkidle' });
await lab.locator('.component-lab').waitFor({ state: 'visible', timeout: 120_000 });

for (const width of [1440, 900, 390]) {
  await lab.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  for (const theme of ['Claro', 'Oscuro']) {
    await lab.getByRole('radio', { name: theme, exact: true }).click();
    await assertNoOverflow(lab, `Component Lab ${theme} ${width}px`);
  }
}

await lab.setViewportSize({ width: 1440, height: 1000 });
await lab.getByRole('radio', { name: 'Claro', exact: true }).click();
await lab.evaluate(() => window.scrollTo(0, 0));
await lab.screenshot({ path: path.join(evidenceDirectory, 'component-lab-day-expanded.png'), fullPage: true });
await lab.setViewportSize({ width: 1440, height: 1600 });
await lab.locator('.component-lab__authority-card--engineering').screenshot({ path: path.join(evidenceDirectory, 'engineering-day.png') });
await lab.getByRole('radio', { name: 'Oscuro', exact: true }).click();
await lab.evaluate(() => window.scrollTo(0, 0));
await lab.screenshot({ path: path.join(evidenceDirectory, 'component-lab-night-expanded.png'), fullPage: true });
await lab.locator('.component-lab__authority-card--engineering').screenshot({ path: path.join(evidenceDirectory, 'engineering-night.png') });

await assertGraphiteNight(lab, 'Component Lab', [
  '--sc-color-bg-app',
  '--sc-color-bg-canvas',
  '--sc-color-surface-1',
  '--sc-color-surface-elevated',
]);
const labHeroBackground = await lab.locator('.component-lab__hero').evaluate((element) => getComputedStyle(element).backgroundImage);
assert.ok(!labHeroBackground.includes('26, 165, 122'), 'Component Lab Night has a green ambient halo');

const labInfluence = await lab.locator('.component-lab__influence-area').evaluate((element) => getComputedStyle(element).strokeDasharray);
assert.ok(labInfluence !== 'none' && labInfluence !== '0px', `Component Lab influence is not dashed: ${labInfluence}`);
const labDeformed = await lab.locator('.component-lab__deformed-line').evaluate((element) => getComputedStyle(element).strokeDasharray);
assert.ok(labDeformed === 'none' || labDeformed === '0px', `Component Lab deformed is not continuous: ${labDeformed}`);

const labFocus = lab.locator('.component-lab__focus-evidence');
await focusByKeyboard(lab, '.component-lab__focus-evidence', 'Component Lab focus evidence');
const labFocusStyle = await labFocus.evaluate((element) => {
  const style = getComputedStyle(element);
  return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
});
assert.equal(labFocusStyle.outlineStyle, 'solid', 'Component Lab focus-visible outline is missing');
assert.notEqual(labFocusStyle.outlineWidth, '0px', 'Component Lab focus-visible width is zero');
assert.equal(labFocusStyle.boxShadow, 'none', 'Component Lab focus uses glow/elevation');

const selectionStyle = await lab.locator('.component-lab__selection-evidence').evaluate((element) => {
  const style = getComputedStyle(element);
  return { borderStyle: style.borderStyle, borderWidth: style.borderWidth, backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
});
assert.equal(selectionStyle.borderStyle, 'solid', 'Selection stroke is missing');
assert.notEqual(selectionStyle.borderWidth, '0px', 'Selection stroke width is zero');
assert.notEqual(selectionStyle.backgroundColor, 'rgba(0, 0, 0, 0)', 'Selection soft fill is missing');
assert.equal(selectionStyle.boxShadow, 'none', 'Selection uses glow');

await lab.setViewportSize({ width: 390, height: 844 });
await lab.evaluate(() => window.scrollTo(0, 0));
await lab.screenshot({ path: path.join(evidenceDirectory, 'component-lab-compact.png'), fullPage: true });

const reducedContext = await browser.newContext({ viewport: { width: 900, height: 900 }, reducedMotion: 'reduce' });
const reduced = await reducedContext.newPage();
await reduced.goto(brandbookUrl, { waitUntil: 'load', timeout: 120_000 });
const reducedStyle = await reduced.locator('.motion-demo').evaluate((element) => {
  const style = getComputedStyle(element);
  return { duration: style.transitionDuration, transform: style.transform };
});
assert.ok(['1e-06s', '0.000001s', '0s'].some((value) => reducedStyle.duration.includes(value)), `Reduced motion duration remains active: ${reducedStyle.duration}`);
assert.equal(reducedStyle.transform, 'none', 'Reduced motion leaves a transform active');
await reducedContext.close();

assert.deepEqual(browserErrors, [], `Browser errors:\n${browserErrors.join('\n')}`);
checked.push('Expanded / Medium / Compact: zero horizontal overflow in Day and Night');
checked.push('focus-visible: outline, separated edge, no Lab glow/elevation');
checked.push('selection: stroke + soft fill, no glow');
checked.push('influence: dashed; deformed: continuous');
checked.push('prefers-reduced-motion: motion collapsed');

console.log(JSON.stringify({
  issue: 'CRI-91',
  verdict: 'PASS',
  checked,
  screenshots: [
    'brandbook-day-expanded.png',
    'brandbook-night-expanded.png',
    'brandbook-compact-color.png',
    'cvd-evidence-day.png',
    'component-lab-day-expanded.png',
    'component-lab-night-expanded.png',
    'component-lab-compact.png',
    'engineering-day.png',
    'engineering-night.png',
  ],
}, null, 2));
} finally {
  await browser.close();
  await vite.close();
  await new Promise((resolve) => staticServer.close(resolve));
}
