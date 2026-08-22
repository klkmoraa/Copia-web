// CRI-115 · Remedición de los tres targets táctiles que estaban bajo el piso
// LEDGER-06 (44px) en K0 retrato, sobre el producto CONSTRUIDO y con Chromium
// real (`hasTouch:true`, `isMobile:true`) — mismo arnés que la sección
// "touch-targets" de `reports/evidence/2026-08-21-cri-106-accessibility/run-suite.mjs`,
// que es donde se midieron los FAIL originales.
//
// Los tres hallazgos de CRI-106 eran:
//   stepper nodo 2 ("Cómo trabajas")  40x44  FAIL
//   stepper nodo 3 ("Por dónde")      40x44  FAIL
//   .model-doctor-launcher            36x36  FAIL
import { chromium } from 'playwright';
import { preview } from 'vite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '../../../');
const FLOOR = 44;

const previewServer = await preview({ root: repoRoot, preview: { host: '127.0.0.1', port: 4193, strictPort: true }, logLevel: 'error' });
const baseURL = 'http://127.0.0.1:4193/';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium' });

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.addInitScript(() => { try { indexedDB.deleteDatabase('structureCo.projects'); } catch { /* noop */ } });
// El SW de actualización recarga el documento en `controllerchange`; en QA se
// anula igual que en `qa.mjs` para que la página no navegue a mitad de medición.
await page.addInitScript(() => {
  const registration = { installing: null, waiting: null, addEventListener: () => undefined };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller: null, register: async () => registration, addEventListener: () => undefined },
  });
});
await page.addInitScript(() => { try { localStorage.setItem('structureCo.theme', 'light'); } catch { /* noop */ } });
await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.waitForSelector('.welcome-steps', { timeout: 15000 });

const measure = async (selector, label) => page.evaluate(({ selector, label }) => {
  const els = [...document.querySelectorAll(selector)].filter((el) => el.offsetParent !== null);
  return els.map((el, i) => {
    const r = el.getBoundingClientRect();
    return { label: `${label}[${i}]`, text: (el.textContent ?? '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), min: Math.round(Math.min(r.width, r.height)) };
  });
}, { selector, label });

const rows = [];
rows.push(...await measure('.welcome-steps button', 'stepper'));

// Entrar a la Mesa por el pórtico de ejemplo (paso 3) para medir la Cinta.
// `getByRole` no resuelve en headless con isMobile+hasTouch (limitación del
// entorno documentada en CRI-106), así que se usa localizador CSS + texto.
await page.locator('.welcome-steps button', { hasText: 'Por dónde' }).first().click({ timeout: 10000 });
await page.locator('.welcome-screen[data-welcome-step="where"]').waitFor({ state: 'visible', timeout: 15000 });
const example = page.locator('button', { hasText: /pórtico de ejemplo/i }).first();
await example.click({ timeout: 10000 });
await page.waitForSelector('.tool-rail, .mobile-tool-palette-toggle', { timeout: 20000 });
await page.waitForTimeout(400);
rows.push(...await measure('.model-doctor-launcher', 'model-doctor-launcher'));
rows.push(...await measure('.topbar-command-button', 'topbar-command-button'));

await page.close();
await browser.close();
await previewServer.close();

const verdict = rows.map((r) => ({ ...r, floor: FLOOR, pass: r.w >= FLOOR && r.h >= FLOOR }));
writeFileSync(path.join(root, 'touch-targets.json'), JSON.stringify(verdict, null, 2));

let md = '| Elemento | Texto | w x h | Piso LEDGER-06 | Veredicto |\n|---|---|---|---|---|\n';
for (const r of verdict) md += `| ${r.label} | ${r.text || '—'} | ${r.w}x${r.h} | ${FLOOR}px | ${r.pass ? 'PASS' : 'FAIL'} |\n`;
writeFileSync(path.join(root, 'touch-targets.md'), md);
console.log(md);

const fails = verdict.filter((r) => !r.pass);
console.log(`${verdict.length} targets medidos en K0 retrato · ${fails.length} FAIL`);
for (const f of fails) console.log(`FAIL: ${f.label} → ${f.w}x${f.h}`);
process.exit(fails.length === 0 ? 0 : 1);
