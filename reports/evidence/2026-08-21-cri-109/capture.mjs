/**
 * CRI-109 · verificación visual del índice del paso activo.
 * Mide el color resuelto (no el token) del índice en los cuatro estados y
 * captura Día/Noche en X2 y K0 retrato.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outDir = path.dirname(fileURLToPath(import.meta.url));
const server = await preview({ root, preview: { host: '127.0.0.1', port: 4188, strictPort: true }, logLevel: 'error' });
const baseURL = 'http://127.0.0.1:4188/';
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const parse = (s) => {
  const n = s.match(/[\d.]+/g).slice(0, 3).map(Number);
  // `color(srgb r g b)` entrega fracciones 0..1; `rgb()` entrega 0..255.
  return s.startsWith('color(') ? n.map((v) => v * 255) : n;
};
const ratio = (a, b) => { const [x, y] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const viewports = { X2: { width: 1440, height: 900 }, 'K0-portrait': { width: 390, height: 844 } };
const results = [];

for (const theme of ['light', 'dark']) {
  for (const [vpName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.addInitScript(() => { try { indexedDB.deleteDatabase('structureCo.projects'); } catch { /* nada que borrar */ } });
    await page.addInitScript((t) => { try { localStorage.setItem('structureCo.theme', t); } catch { /* sin storage */ } }, theme);
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.welcome-steps .welcome-step', { timeout: 20000 });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);

    const probe = await page.evaluate(() => {
      const rail = document.querySelector('.welcome-steps');
      const steps = [...rail.querySelectorAll('.welcome-step')];
      const read = (el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, color: s.color, border: s.borderTopColor, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }; };
      const active = steps.find((s) => s.classList.contains('active'));
      const inactive = steps.find((s) => !s.classList.contains('active') && !s.classList.contains('welcome-step--table'));
      const table = steps.find((s) => s.classList.contains('welcome-step--table'));
      return {
        active: read(active.querySelector('.welcome-step-index')),
        activePill: getComputedStyle(active).backgroundColor,
        inactive: read(inactive.querySelector('.welcome-step-index')),
        table: read(table.querySelector('.welcome-step-index')),
        railOverflow: rail.scrollWidth > rail.clientWidth + 1,
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });

    // Foco: anillo visible y separado del canto.
    await page.evaluate(() => document.querySelector('.welcome-steps .welcome-step.active').focus());
    const focus = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.welcome-steps .welcome-step.active'));
      return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset };
    });

    results.push({
      theme, viewport: vpName,
      activeIndex: { background: probe.active.bg, foreground: probe.active.color, ratio: +ratio(probe.active.color, probe.active.bg).toFixed(2), size: `${probe.active.w}x${probe.active.h}` },
      silhouette: { badge: probe.active.bg, surround: probe.activePill, ratio: +ratio(probe.active.bg, probe.activePill).toFixed(2) },
      inactiveIndex: { background: probe.inactive.bg, foreground: probe.inactive.color, ratio: +ratio(probe.inactive.color, probe.inactive.bg).toFixed(2) },
      tableIndex: { background: probe.table.bg, foreground: probe.table.color, ratio: +ratio(probe.table.color, probe.table.bg).toFixed(2) },
      focus, overflow: { rail: probe.railOverflow, document: probe.docOverflow },
    });

    await page.locator('.welcome-steps').screenshot({ path: path.join(outDir, `rail-${theme}-${vpName}.png`) });
    await page.screenshot({ path: path.join(outDir, `welcome-${theme}-${vpName}.png`) });
    await context.close();
  }
}

fs.writeFileSync(path.join(outDir, 'measurements.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
await server.close();
