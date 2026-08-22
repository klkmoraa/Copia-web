// CRI-106 · Recorrido de tabulación real (Tab/Shift+Tab/Escape) sobre Chromium,
// Welcome → Mesa → Results → Model Doctor → Command Palette.
import { chromium } from 'playwright';
import { preview } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evidenceDir, '../../../../');
const previewServer = await preview({ root: repoRoot, preview: { host: '127.0.0.1', port: 4196, strictPort: true }, logLevel: 'error' });
const baseURL = 'http://127.0.0.1:4196/';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { indexedDB.deleteDatabase('structureCo.projects'); } catch { /* noop */ } });
await page.addInitScript(() => {
  const registration = { installing: null, waiting: null, addEventListener: () => undefined };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: null, register: async () => registration, addEventListener: () => undefined } });
});

const log = [];
const snapshot = async (label) => {
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'BODY (foco perdido)' };
    const style = getComputedStyle(el);
    return {
      tag: el.tagName,
      role: el.getAttribute('role'),
      label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40),
      hasOutline: style.outlineStyle !== 'none' && style.outlineWidth !== '0px',
      inert: el.closest('[inert]') !== null,
    };
  });
  log.push({ step: label, ...info });
};

await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.locator('.welcome-steps').waitFor({ state: 'visible' });

// 12 Tabs desde el inicio de Welcome.
for (let i = 0; i < 12; i += 1) {
  await page.keyboard.press('Tab');
  await snapshot(`Welcome Tab#${i + 1}`);
}

// Entrar a la Mesa (Continuar / ejemplo).
await page.locator('.welcome-steps button', { hasText: 'Por dónde' }).first().click();
await page.locator('.welcome-screen[data-welcome-step="where"]').waitFor({ state: 'visible' });
const example = page.locator('button', { hasText: /pórtico de ejemplo/i }).first();
await example.click();
await page.waitForSelector('.tool-rail, .canvas-svg, svg.canvas', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(300);

for (let i = 0; i < 8; i += 1) {
  await page.keyboard.press('Tab');
  await snapshot(`Workspace Tab#${i + 1}`);
}

// Model Doctor: abrir con teclado si es alcanzable, comprobar Escape restaura foco.
const doctorButton = page.locator('.model-doctor-launcher, [aria-label*="Model Doctor" i], [aria-label*="Doctor" i]').first();
if (await doctorButton.isVisible().catch(() => false)) {
  await doctorButton.focus();
  await snapshot('Model Doctor launcher (focus)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await snapshot('Tras abrir Model Doctor');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await snapshot('Tras Escape (¿vuelve el foco al lanzador?)');
}

// Command Palette: Ctrl/Cmd+K si existe atajo.
await page.keyboard.press('Control+k');
await page.waitForTimeout(300);
await snapshot('Tras Ctrl+K (Command Palette)');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await snapshot('Tras Escape en Command Palette');

await browser.close();
await previewServer.httpServer.close();

writeFileSync(path.join(evidenceDir, 'focus-walkthrough.json'), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
