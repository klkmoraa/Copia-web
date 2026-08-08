import { devices, webkit } from 'playwright';
import { preview } from 'vite';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(root, 'qa-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const previewServer = process.env.QA_URL ? null : await preview({
  root,
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  logLevel: 'error',
});
const baseURL = process.env.QA_URL ?? 'http://127.0.0.1:4174/';
const browser = await webkit.launch({ headless: true });
const results = { engine: 'Playwright WebKit', url: baseURL, devices: {}, errors: [] };

const fixture = {
  schemaVersion: 5,
  id: 'webkit-import',
  name: 'Proyecto importado en WebKit',
  nodes: [],
  members: [],
  loadCases: [{ id: 'LC1', name: 'Caso 1', category: 'other', active: true, selfWeightFactor: 0 }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true,
    snapTargets: { grid: true, nodes: true, midpoints: true, intersections: true, perpendicular: true },
    selectionFilter: { nodes: true, members: true, loads: true },
    showGrid: true, showNodeLabels: true, showMemberLabels: false, showLocalAxes: false,
    showLoads: true, showDimensions: true, showResultValues: true, diagramScale: 1,
    diagramScaleMode: 'common', showResultOverlay: true, deformedScale: 80,
    diagramSide: 'positive', calculationMode: 'complete',
  },
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry ?? null));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalize(entry)]));
};
const nativeAnalysis = {
  success: true,
  issues: [], nodeResults: [], memberResults: [], displacements: [], residualNorm: 0,
  conditionEstimate: 1, equilibrium: { sumFx: 0, sumFy: 0, sumM: 0 }, explanation: [],
};
const nativePayloadData = {
  format: 'structureco-portable',
  formatVersion: 1,
  metadata: {
    projectName: fixture.name, units: fixture.settings.units, nodeCount: 0, memberCount: 0,
    loadCount: 0, analysisSuccess: true,
  },
  provenance: {
    generatedBy: 'structureCo', source: 'native-export', generatedAt: '2026-07-12T18:00:00.000Z',
    appVersion: '0.7.0', projectSchemaVersion: 5, analysisIncluded: true,
  },
  project: fixture,
  analysis: nativeAnalysis,
};
const nativePayload = {
  ...nativePayloadData,
  checksum: {
    algorithm: 'SHA-256',
    value: createHash('sha256').update(JSON.stringify(canonicalize(nativePayloadData))).digest('hex'),
  },
};
const nativePdf = await PDFDocument.create();
const nativePage = nativePdf.addPage();
const nativeFont = await nativePdf.embedFont(StandardFonts.Helvetica);
nativePage.drawText('structureCo portable calculation report - N V M - procedures', { x: 40, y: 700, size: 14, font: nativeFont });
await nativePdf.attach(Buffer.from(JSON.stringify(nativePayload)), 'structureco-payload.json', {
  mimeType: 'application/vnd.structureco.project+json',
  description: 'structureCo portable payload',
});
const nativePdfBuffer = Buffer.from(await nativePdf.save());

const verifyWelcomeScroll = async (page) => {
  const welcome = page.locator('.welcome-screen');
  await welcome.waitFor({ state: 'visible' });
  const before = await welcome.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  await welcome.evaluate((element) => element.scrollBy({ top: 320, behavior: 'instant' }));
  await page.waitForTimeout(60);
  const scrollTop = await welcome.evaluate((element) => element.scrollTop);
  const reachability = await welcome.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    const footer = element.querySelector('.welcome-footer')?.getBoundingClientRect();
    const steps = element.querySelector('.welcome-workflow')?.getBoundingClientRect();
    const fullyVisible = (rect) => Boolean(rect && rect.top >= -1 && rect.bottom <= window.innerHeight + 1);
    return {
      footerReachable: fullyVisible(footer),
      stepsReachable: fullyVisible(steps),
    };
  });
  return {
    hasScrollableOverflow: before.clientHeight < before.scrollHeight,
    scrollIncreased: scrollTop > before.scrollTop,
    ...reachability,
  };
};

for (const deviceName of ['iPhone 13', 'iPad Pro 11']) {
  const context = await browser.newContext({ ...devices[deviceName], locale: 'es-MX' });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('preloaded using link preload')) return;
    if (message.type() === 'error' || message.type() === 'warning') results.errors.push(`${deviceName} console ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => results.errors.push(`${deviceName} page: ${String(error)}`));
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  const title = await page.title();
  const welcomeScroll = deviceName === 'iPhone 13' ? await verifyWelcomeScroll(page) : null;
  if (welcomeScroll) await page.locator('.welcome-screen').evaluate((element) => { element.scrollTop = 0; });
  await page.getByRole('button', { name: /Importar archivo/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trae un proyecto con contexto/i });
  await dialog.waitFor({ state: 'visible' });
  const before = await page.evaluate(() => {
    const box = document.querySelector('.import-center-dialog')?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      dialogLeft: box?.left ?? -1,
      dialogRight: box?.right ?? -1,
      viewportWidth: window.innerWidth,
    };
  });
  await page.locator('input.import-file-input').setInputFiles({
    name: 'proyecto-webkit.structureco.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole('heading', { name: 'Contenido encontrado' }).waitFor({ state: 'visible' });
  const portableCopy = await page.getByText(/Proyecto “Proyecto importado en WebKit” validado/i).isVisible();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('heading', { name: /Dónde quieres abrirlo/i }).waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: /Revisar importación/i }).click();
  await dialog.getByRole('button', { name: /Importar ahora/i }).click();
  await page.getByRole('heading', { name: /Proyecto importado/i }).waitFor({ state: 'visible' });
  const controls = await page.locator('.import-center-footer button').evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  await dialog.getByRole('button', { name: /Abrir proyecto/i }).click();
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  const importedName = await page.getByLabel('Nombre del proyecto').inputValue();
  // AG-014: the 44px floor used to be measured on the import footer alone, so a control
  // anywhere else could shrink unnoticed — the source link of an academic exercise sat at
  // 296x33 because the coarse-pointer rule covered buttons, inputs and selects but not
  // anchors. This sweeps every interactive element the workspace actually renders.
  const undersizedTargets = await page.evaluate(() => {
    const selector = 'button, a[href], input:not([type=hidden]), select, textarea, [role=tab], summary';
    return [...document.querySelectorAll(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        if (element.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        const name = (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 40);
        return { name, width: Math.round(box.width), height: Math.round(box.height) };
      })
      // Half a pixel of slack: sub-pixel layout can land a 44px control on 43.99.
      .filter((entry) => entry.width < 43.5 || entry.height < 43.5);
  });
  if (undersizedTargets.length) {
    console.log(`  targets tactiles por debajo de 44px en ${deviceName}:`, JSON.stringify(undersizedTargets));
  }
  await page.getByLabel('Ir al inicio').click();
  await page.getByRole('button', { name: /Importar archivo/i }).click();
  const nativeDialog = page.getByRole('dialog', { name: /Trae un proyecto con contexto/i });
  await nativeDialog.locator('input.import-file-input').setInputFiles({
    name: 'memoria-webkit.structureco.pdf',
    mimeType: 'application/pdf',
    buffer: nativePdfBuffer,
  });
  await nativeDialog.getByRole('heading', { name: 'Contenido encontrado' }).waitFor({ state: 'visible' });
  const nativePdfRecognized = await nativeDialog.getByText(/PDF inteligente de structureCo/i).isVisible()
    && await nativeDialog.getByText(/resultados, diagramas y procedimientos pueden restaurarse/i).isVisible();
  await page.screenshot({ path: path.join(artifactsDir, `webkit-${deviceName.replaceAll(' ', '-').toLowerCase()}.png`), fullPage: false });
  results.devices[deviceName] = {
    title,
    noHorizontalOverflow: before.scrollWidth <= before.clientWidth + 1,
    dialogWithinViewport: before.dialogLeft >= 0 && before.dialogRight <= before.viewportWidth + 1,
    portableCopy,
    nativePdfRecognized,
    importedName,
    touchTargetsAtLeast44: controls.every((control) => control.width >= 44 && control.height >= 44),
    workspaceTouchTargetsAtLeast44: undersizedTargets.length === 0,
    ...(welcomeScroll ? {
      welcomeHasScrollableOverflow: welcomeScroll.hasScrollableOverflow,
      welcomeScrollIncreased: welcomeScroll.scrollIncreased,
      welcomeFooterReachable: welcomeScroll.footerReachable,
      welcomeStepsReachable: welcomeScroll.stepsReachable,
    } : {}),
  };
  await context.close();
}

await browser.close();
await previewServer?.close();
const failed = Object.entries(results.devices).flatMap(([device, checks]) => Object.entries(checks)
  .filter(([key, value]) => key !== 'title' && key !== 'importedName' && value !== true)
  .map(([key]) => `${device}: ${key}`));
if (results.errors.length || failed.length || Object.values(results.devices).some((checks) => checks.importedName !== fixture.name)) {
  throw new Error(`QA WebKit fallida: ${[...failed, ...results.errors].join('; ')}`);
}
fs.writeFileSync(path.join(artifactsDir, 'webkit-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
