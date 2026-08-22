import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openExamplePortal } from './qa-welcome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env.STRUCTURECO_PHASE2_URL ?? 'http://127.0.0.1:4182/';
const fixture = path.join(root, 'scripts', 'fixtures', 'phase2-line.dxf');
const checks = {};
const details = {};

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});

const readIndexedDb = (page) => page.evaluate(async () => {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('structureCo.projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const readAll = (storeName) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const [projects, recoveries] = await Promise.all([readAll('projects'), readAll('recoveries')]);
  database.close();
  return { projects, recoveries, legacy: localStorage.getItem('structureCo.project') };
});

const waitForRepository = async (page) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const state = await readIndexedDb(page);
      if (state.projects.length) return state;
    } catch { /* IndexedDB can still be upgrading. */ }
    await page.waitForTimeout(100);
  }
  return readIndexedDb(page);
};

const waitForAnalysisCompletion = async (page) => {
  const success = page.getByText('Análisis actualizado', { exact: true });
  const failure = page.getByRole('button', { name: /No se pudo analizar/ });
  await success.or(failure).waitFor({ state: 'visible', timeout: 20_000 });
  return await failure.count() ? 'diagnostic' : 'success';
};

try {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const workerUrls = [];
  const runtimeErrors = [];
  page.on('worker', (worker) => workerUrls.push(worker.url()));
  page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('requestfailed', (request) => runtimeErrors.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  // CRI-116 · el pórtico de ejemplo vive en el tercer paso desde CRI-112.
  await openExamplePortal(page, page.getByRole('button', { name: /Pórtico de ejemplo Pórtico/i }));
  await page.locator('.app-shell').waitFor({ state: 'visible' });

  const member = page.locator('.member-object').first();
  await member.focus();
  await page.keyboard.press('Enter');
  const initialMembers = await page.locator('.member-object').count();
  await page.keyboard.press('Control+d');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).waitFor({ state: 'visible' });
  checks.duplicatePreview = await page.locator('.duplicate-preview-member').count() === 1;
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  checks.duplicateCancel = await page.locator('.member-object').count() === initialMembers;

  await member.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+d');
  await page.getByLabel('Desplazamiento X').fill('2');
  await page.getByLabel('Desplazamiento Y').fill('1');
  await page.getByRole('button', { name: 'Confirmar duplicado' }).click();
  await page.locator('.member-object').nth(initialMembers).waitFor({ state: 'attached' });
  checks.duplicateConfirm = await page.locator('.member-object').count() === initialMembers + 1;
  await page.getByRole('button', { name: 'Deshacer' }).click();
  checks.duplicateUndo = await page.locator('.member-object').count() === initialMembers;
  await page.getByRole('button', { name: 'Rehacer' }).click();
  checks.duplicateRedo = await page.locator('.member-object').count() === initialMembers + 1;

  await member.focus();
  await page.keyboard.press('Enter');
  const area = page.getByLabel('A', { exact: true });
  await area.fill('0.006');
  await area.press('Enter');
  checks.memberEdit = await area.inputValue() === '0.006';
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await member.focus();
  await page.keyboard.press('Enter');
  checks.memberEditUndo = await page.getByLabel('A', { exact: true }).inputValue() === '0.005';
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await member.focus();
  await page.keyboard.press('Enter');
  checks.memberEditRedo = await page.getByLabel('A', { exact: true }).inputValue() === '0.006';

  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  details.workerOutcome = await waitForAnalysisCompletion(page);
  checks.workerAnalysis = workerUrls.some((url) => url.includes('analysis.worker'));
  details.workerUrls = workerUrls;

  await page.waitForTimeout(500);
  const portableSeed = await page.evaluate(() => localStorage.getItem('structureCo.project'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /Continuar proyecto/ }).click();
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  checks.projectRecovery = await page.locator('.member-object').count() === initialMembers + 1;

  const serviceWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    const names = await caches.keys();
    const cache = await caches.open(names.at(-1));
    return {
      active: Boolean(registration.active), scope: registration.scope, controlled: Boolean(navigator.serviceWorker.controller), caches: names,
      indexCached: Boolean(await cache.match('./index.html')), keys: (await cache.keys()).map((request) => request.url),
    };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  serviceWorker.controlledAfterReload = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  try {
    await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 8_000 });
    checks.offlineShell = true;
  } catch {
    checks.offlineShell = false;
    details.offlineBody = (await page.locator('body').innerText()).slice(0, 1000);
    details.offlineUrl = page.url();
    details.runtimeErrors = runtimeErrors.slice(-20);
  }
  details.serviceWorker = serviceWorker;
  checks.serviceWorkerUpdateCheck = serviceWorker.active && serviceWorker.scope.startsWith(baseURL);
  await context.setOffline(false);
  await context.close();

  const migrationContext = await browser.newContext({ serviceWorkers: 'allow' });
  await migrationContext.addInitScript((seed) => {
    localStorage.clear();
    localStorage.setItem('structureCo.project', seed);
  }, portableSeed);
  const migrationPage = await migrationContext.newPage();
  await migrationPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await migrationPage.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  const migrationState = await waitForRepository(migrationPage);
  checks.legacySourcePreserved = migrationState.legacy === portableSeed;
  checks.indexedDbMigration = migrationState.projects.some((record) => JSON.stringify(record.project) === portableSeed);

  await migrationPage.getByRole('button', { name: /Importar geometría DXF/ }).click();
  await migrationPage.getByLabel('Archivo DXF ASCII').setInputFiles(fixture);
  await migrationPage.getByText('1 entidad aceptada · 0 rechazadas').waitFor({ state: 'visible' });
  checks.dxfPreview = await migrationPage.getByText(/Capas detectadas: PHASE2_QA/).isVisible();
  const importDxf = migrationPage.getByRole('button', { name: 'Crear copia e importar' });
  await importDxf.focus();
  await importDxf.press('Enter');
  await migrationPage.locator('.app-shell').waitFor({ state: 'visible' });
  checks.dxfImportAppend = await migrationPage.locator('.member-object').count() === initialMembers + 2;
  await migrationPage.waitForTimeout(350);
  const importedState = await readIndexedDb(migrationPage);
  checks.dxfRecovery = importedState.recoveries.some((record) => record.reason === 'dxf-import');
  await migrationContext.close();

  const fallbackContext = await browser.newContext({ serviceWorkers: 'block' });
  await fallbackContext.addInitScript((seed) => {
    localStorage.clear();
    localStorage.setItem('structureCo.project', seed);
    Object.defineProperty(window, 'Worker', { value: undefined, configurable: true });
  }, portableSeed);
  const fallbackPage = await fallbackContext.newPage();
  let fallbackWorkers = 0;
  fallbackPage.on('worker', () => { fallbackWorkers += 1; });
  await fallbackPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await fallbackPage.getByRole('button', { name: /Continuar proyecto/ }).click();
  await fallbackPage.locator('.app-shell').waitFor({ state: 'visible' });
  await fallbackPage.getByRole('button', { name: 'Analizar', exact: true }).click();
  details.fallbackOutcome = await waitForAnalysisCompletion(fallbackPage);
  checks.fallbackAnalysis = fallbackWorkers === 0;
  checks.workerFallbackParity = details.fallbackOutcome === details.workerOutcome;
  await fallbackContext.close();
} finally {
  await browser.close();
}

const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
console.log(JSON.stringify({ checks, details, failures }, null, 2));
if (failures.length) process.exitCode = 1;
