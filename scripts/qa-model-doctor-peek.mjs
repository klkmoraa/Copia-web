/**
 * Smoke del ciclo D-11 del Model Doctor bajo la política de actividad de
 * CRI-108: Doctor → Localizar → peek → lienzo → restaurar, en X2 y en K0.
 *
 * Existe porque `qa:model-doctor` no llega hoy a la Mesa: su `enterWorkspace`
 * espera un botón "Pórtico de ejemplo" que la Bienvenida de CRI-104 ya no
 * ofrece. Ese fallo es previo y ajeno a este cambio —reproducido idéntico
 * sobre `origin/main` limpio— y ese QA no se toca aquí.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, 'reports', 'evidence', '2026-08-20-datasheet-contextual-actions-k0', 'doctor');
fs.mkdirSync(outDir, { recursive: true });
const previewServer = await preview({ root: repoRoot, preview: { host: '127.0.0.1', port: 4199, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });

const report = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  if (!ok) report.failures.push({ name, detail });
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
};

/** Modelo con un hallazgo seguro: un nudo suelto, sin tocar reglas ni solver. */
const seed = (project) => ({
  ...project,
  nodes: [...project.nodes, { id: 'ORPHAN_1', x: 12, y: 9, support: { type: 'none' } }],
});

const CLASSES = { x2: { width: 1440, height: 900 }, 'k0-portrait': { width: 390, height: 844 }, 'k0-landscape': { width: 844, height: 390 } };

for (const [label, viewport] of Object.entries(CLASSES)) {
  const page = await browser.newPage({ viewport, locale: 'es-ES', hasTouch: true, colorScheme: 'light' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: null, register: async () => ({ installing: null, waiting: null, addEventListener: () => undefined }), addEventListener: () => undefined } });
  });
  const enterShell = async () => {
    const shell = page.locator('.app-shell');
    if (await shell.isVisible().catch(() => false)) return;
    for (const name of [/^nuevo proyecto/i, /ver otras formas de empezar/i, /ir a la mesa/i, /continuar proyecto/i]) {
      const button = page.getByRole('button', { name }).first();
      if (!await button.count()) continue;
      await button.click().catch(() => undefined);
      await page.waitForTimeout(600);
      if (await shell.isVisible().catch(() => false)) return;
    }
    await shell.waitFor({ state: 'visible', timeout: 15_000 });
  };
  await page.goto('http://127.0.0.1:4199/', { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 20_000 });
  await enterShell();
  await page.waitForTimeout(700);
  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.project')));
  await page.evaluate((next) => localStorage.setItem('structureCo.project', JSON.stringify(next)), seed(project));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await enterShell();
  await page.waitForTimeout(700);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('structureco:open-model-doctor')));
  await page.locator('.model-doctor-surface').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(600);

  const state = () => page.evaluate(() => {
    const surface = document.querySelector('.model-doctor-surface');
    const active = document.activeElement;
    return {
      mounted: Boolean(surface),
      extent: surface?.getAttribute('data-surface-extent') ?? null,
      peekHandle: Boolean(document.querySelector('.sc-modal-surface__peek-handle')),
      findings: document.querySelectorAll('.model-doctor-finding').length,
      inert: Boolean(document.querySelector('.app-shell')?.hasAttribute('inert')),
      focusOnBody: active === document.body,
      focusInInert: Boolean(active?.closest?.('[inert]')),
    };
  });

  const opened = await state();
  check(`${label} · doctor abierto con hallazgos`, opened.mounted && opened.extent === 'default' && opened.findings > 0, opened);

  const locate = page.getByRole('button', { name: /^Localizar:/i }).first();
  check(`${label} · doctor · hay un hallazgo localizable`, await locate.count() > 0);
  await locate.click();
  await page.waitForTimeout(700);
  const peeked = await state();
  check(`${label} · doctor · Localizar degrada a peek y no cierra`,
    peeked.mounted && peeked.extent === 'peek' && peeked.peekHandle, peeked);
  check(`${label} · doctor · peek conserva la lista de hallazgos`, peeked.findings === opened.findings,
    { before: opened.findings, after: peeked.findings });
  check(`${label} · doctor · en peek el fondo no queda inert y el foco no queda huérfano`,
    peeked.inert === false && !peeked.focusOnBody && !peeked.focusInInert, peeked);
  await page.screenshot({ path: path.join(outDir, `${label}-doctor-peek.png`) });

  await page.locator('.sc-modal-surface__peek-handle').first().click();
  await page.waitForTimeout(700);
  const restored = await state();
  check(`${label} · doctor · restaurar devuelve la superficie y su lista`,
    restored.mounted && restored.extent === 'default' && restored.peekHandle === false
    && restored.findings === opened.findings, restored);
  check(`${label} · doctor · restaurar devuelve el comportamiento modal`, restored.inert === true, { inert: restored.inert });
  await page.screenshot({ path: path.join(outDir, `${label}-doctor-restored.png`) });
  await page.close();
}

fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
await previewServer.close();
console.log(`\n${report.checks.length - report.failures.length}/${report.checks.length} comprobaciones en verde`);
if (report.failures.length) { for (const f of report.failures) console.error(` - ${f.name}: ${JSON.stringify(f.detail)}`); process.exitCode = 1; }
