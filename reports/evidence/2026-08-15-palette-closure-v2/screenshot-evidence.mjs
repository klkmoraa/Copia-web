// Visual evidence for the second pass of the chromatic closure (see ../../
// 2026-08-15-XXXX-cierre-cromatico-correccion-vivida.md). Screenshots the
// Component Lab (http://localhost:5183/__components, `npm run dev` running)
// with the "Dirección cromática" foundation override disabled, so every
// swatch/badge/banner/card reads straight from `src/design-system/tokens.css`
// — the lab's dropdown only offers three superseded exploratory directions
// (continuity/mineral/analytical) from before the lime decision, none of
// which are the live palette.
import { chromium } from 'playwright';

const OUT = new URL('.', import.meta.url).pathname;
const BASE = 'http://localhost:5183/__components';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1300 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForSelector('.component-lab__swatches', { timeout: 15000 });
await page.evaluate(() => {
  document.querySelector('.component-lab')?.setAttribute('data-foundation', 'live-tokens');
});

const shots = [
  { name: 'live', selector: '.component-lab__swatches', full: false },
  { name: 'badges', selector: '[id="03"]', full: true },
  { name: 'editor', selector: '[id="04"]', full: true },
  { name: 'buttons', selector: '[id="01"]', full: true },
];

for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(200);
  for (const shot of shots) {
    const el = await page.$(shot.selector);
    if (!el) continue;
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const path = `${OUT}lab-${shot.name}-${theme}.png`;
    if (shot.full) await page.screenshot({ path });
    else await el.screenshot({ path });
  }
}
await browser.close();
console.log('done');
