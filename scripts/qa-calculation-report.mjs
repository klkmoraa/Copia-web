/**
 * QA de navegador de la memoria de cálculo: que el PDF se genere de verdad desde la app.
 *
 * Desde 0.8.4 el informe lo dibuja ReportLab sobre un intérprete de Python compilado a
 * WebAssembly, cargado desde los activos de la propia aplicación. Eso mueve el fallo posible
 * fuera del alcance de las pruebas unitarias: en Vitest el intérprete se arranca desde
 * `node_modules`, así que una prueba verde no dice nada sobre si el navegador encuentra
 * `assets/pyodide/*`, si la rueda de ReportLab se sirve con el tipo correcto, o si el `fetch`
 * del `.wasm` sobrevive a la ruta con la que el sitio está desplegado. Esta es exactamente la
 * clase de defecto que sólo ve un gate sobre el artefacto construido — la misma razón por la
 * que existe `check-browser-bundle.mjs`.
 *
 * Así que esto abre la aplicación construida, pide el informe por donde lo pide un lector —el
 * menú de exportación—, y comprueba lo que sale: que la vista previa pinta páginas, que el
 * contador declara un documento con varias, que cada archivo del intérprete se sirvió desde el
 * propio origen, y que lo descargado es un PDF de verdad con el expediente adjunto dentro.
 *
 * Uso: npm run qa:calculation-report
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'qa-artifacts');
fs.mkdirSync(outDir, { recursive: true });

const previewServer = await preview({
  root: repoRoot,
  preview: { host: '127.0.0.1', port: 4197, strictPort: true },
  logLevel: 'error',
});
const baseURL = 'http://127.0.0.1:4197/';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium',
});

const report = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  if (!ok) report.failures.push({ name, detail });
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  /** Every request the runtime makes for its own files, so a 404 cannot pass as a slow boot. */
  const runtimeRequests = [];
  page.on('response', (response) => {
    if (response.url().includes('/pyodide/')) {
      runtimeRequests.push({ url: response.url().split('/').pop(), status: response.status() });
    }
  });

  await page.goto(baseURL, { waitUntil: 'networkidle' });

  // The welcome screen stands between a cold start and the workspace; take the first model it
  // offers, which is enough of a structure to exercise every part of the document.
  const welcome = page.locator('.welcome-screen');
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.locator('button').first().click();
  }
  await page.locator('.export-wrap').waitFor({ state: 'visible', timeout: 30_000 });

  await page.locator('.export-wrap .icon-button').click();
  await page.locator('.export-menu').waitFor({ state: 'visible' });
  await page.locator('.export-menu button', { hasText: /PDF completo reimportable/i }).click();

  // Booting the interpreter and rendering are real work the first time; the dialog says so
  // while it happens, and this is the one place in the product where that wait exists.
  const dialog = page.locator('.pdf-preview-dialog');
  await dialog.waitFor({ state: 'visible', timeout: 60_000 });
  const started = Date.now();
  await dialog.locator('.pdf-preview-page').first().waitFor({ state: 'visible', timeout: 180_000 });
  const renderMs = Date.now() - started;

  const pages = await dialog.locator('.pdf-preview-page').count();
  check('la vista previa pinta páginas del documento', pages > 1, { pages, renderMs });

  const counter = (await dialog.locator('.pdf-preview-counter').textContent())?.trim() ?? '';
  check('el contador declara un documento de varias páginas', /\d+\s*\/\s*[2-9]|\d+\s+de\s+[2-9]|[2-9]\d*/.test(counter), { counter });

  check('el intérprete y la rueda se sirvieron desde el propio origen', runtimeRequests.length > 0
    && runtimeRequests.every((request) => request.status === 200), runtimeRequests);
  check('la rueda de ReportLab se descargó', runtimeRequests.some((request) => request.url === 'reportlab.whl'));

  await dialog.screenshot({ path: path.join(outDir, 'calculation-report-preview.png') });

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Descargar' }).click();
  const download = await downloadPromise;
  const saved = path.join(outDir, 'calculation-report.pdf');
  await download.saveAs(saved);
  const bytes = fs.readFileSync(saved);
  check('descarga un PDF con nombre de memoria', /memoria-calculo\.pdf$/.test(download.suggestedFilename()), {
    filename: download.suggestedFilename(),
  });
  const raw = bytes.toString('latin1');
  check('el archivo descargado es un PDF real', raw.startsWith('%PDF-') && bytes.length > 10_000, {
    bytes: bytes.length,
  });
  // Lo que hace reimportable la memoria: el proyecto y los resultados viajan adjuntos dentro
  // del propio PDF. Un documento bonito sin la carga útil es una regresión silenciosa.
  check('lleva el expediente adjunto para reimportarse', raw.includes('structureco-payload.json'));

  check('la consola no registró errores durante la generación', consoleErrors.length === 0, consoleErrors.slice(0, 3));
} finally {
  await browser.close();
  await previewServer.close();
}

fs.writeFileSync(path.join(outDir, 'calculation-report-qa.json'), JSON.stringify(report, null, 2));
if (report.failures.length) {
  console.error(`\n${report.failures.length} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log(`\n${report.checks.length} comprobaciones en verde.`);
