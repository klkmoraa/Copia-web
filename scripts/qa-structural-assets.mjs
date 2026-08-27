/** Three.js structural illustration atlas visual oracle · 40 assets · Day/Night. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'reports', 'evidence', '2026-08-22-three-structural-assets');
fs.mkdirSync(outputDir, { recursive: true });

const server = await createServer({ root, server: { host: '127.0.0.1', port: 4210, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const report = { phase: 'structural-assets', generatedAt: new Date().toISOString(), captures: [], failures: [] };

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4210/__assets', { waitUntil: 'networkidle' });
  await page.getByTestId('structural-asset-studio').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);

  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Ver modo Noche' }).click();
    const renderTheme = theme === 'light' ? 'day' : 'night';
    for (const section of await page.locator('[data-asset-family]').all()) {
      const family = await section.getAttribute('data-asset-family');
      await section.scrollIntoViewIfNeeded();
      await section.locator('img[data-structural-render="three-prerender"]').first().waitFor({ state: 'visible' });
      await page.waitForFunction(({ family, renderTheme }) => [...document.querySelectorAll(`[data-asset-family="${family}"] img[data-structural-render="three-prerender"]`)].every((image) => (
        image.complete && image.naturalWidth === 900 && image.naturalHeight === 600 && image.getAttribute('data-render-theme') === renderTheme
      )), { family, renderTheme });
      await section.screenshot({ path: path.join(outputDir, `family-${family}-${theme}.png`) });
    }

    const metrics = await page.evaluate(() => {
      const studio = document.querySelector('[data-testid="structural-asset-studio"]');
      const images = [...document.querySelectorAll('img[data-structural-render="three-prerender"]')];
      return {
        theme: studio?.getAttribute('data-theme'),
        cards: document.querySelectorAll('[data-asset-card]').length,
        families: document.querySelectorAll('.asset-studio__family').length,
        threeImages: images.length,
        uniqueAssets: new Set(images.map((image) => image.getAttribute('data-structural-asset-id'))).size,
        correctThemeImages: images.filter((image) => image.getAttribute('data-render-theme') === (studio?.getAttribute('data-theme') === 'dark' ? 'night' : 'day')).length,
        svgFallbacks: document.querySelectorAll('svg[data-structural-asset-id]').length,
        canvasNodes: document.querySelectorAll('.asset-studio__canvas canvas, .asset-studio__canvas foreignObject').length,
        filters: document.querySelectorAll('.asset-studio__canvas filter, .asset-studio__canvas linearGradient, .asset-studio__canvas radialGradient').length,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      };
    });
    const failures = [];
    if (metrics.theme !== theme) failures.push(`theme=${metrics.theme}`);
    if (metrics.cards !== 40 || metrics.threeImages !== 40 || metrics.uniqueAssets !== 40) failures.push(`assets=${metrics.cards}/${metrics.threeImages}/${metrics.uniqueAssets}`);
    if (metrics.families !== 10) failures.push(`families=${metrics.families}`);
    if (metrics.correctThemeImages !== 40) failures.push(`themeImages=${metrics.correctThemeImages}`);
    if (metrics.svgFallbacks || metrics.canvasNodes || metrics.filters) failures.push(`fallbackOrEffects=${metrics.svgFallbacks}/${metrics.canvasNodes}/${metrics.filters}`);
    if (metrics.horizontalOverflow > 1) failures.push(`horizontalOverflow=${metrics.horizontalOverflow}`);
    const screenshot = `atlas-${theme}.png`;
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
    report.captures.push({ theme, screenshot, metrics, failures });
    report.failures.push(...failures.map((failure) => `${theme}: ${failure}`));
  }
  report.failures.push(...errors.map((error) => `console=${error}`));
} finally {
  await browser.close();
  await server.close();
}

fs.writeFileSync(path.join(outputDir, 'qa-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
if (report.failures.length) throw new Error(`Structural assets QA failed:\n${report.failures.join('\n')}`);
console.log(`Structural assets QA PASS · 40 Three.js scenes × 2 themes · ${path.relative(root, outputDir)}`);
