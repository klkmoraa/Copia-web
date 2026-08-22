import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

await page.goto('http://127.0.0.1:4173/__components', { waitUntil: 'networkidle', timeout: 30_000 });
await page.locator('[id="00"]').waitFor({ state: 'visible' });
await page.evaluate(() => document.fonts.ready);

const sample = page.locator('[id="00"] .component-lab__demo').filter({ hasText: 'Autoridad CRI-12C' });

for (const theme of ['light', 'dark']) {
  await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
  await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme);
  await sample.scrollIntoViewIfNeeded();
  await sample.screenshot({ path: `${output}influence-rose-${theme}.png` });
}

await browser.close();
