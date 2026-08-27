/**
 * QA de navegador del BOM estructural, como cuarta pestaña de la superficie
 * unificada «Datos».
 *
 * Portado desde `structureco/scripts/qa-structural-bom.mjs`. La integración
 * real en este repo NO es la de structureco: allí el BOM abre su propio
 * `Drawer` (`.structural-bom-surface`, con su propio título y su propio botón
 * de cerrar). Aquí NO existe una superficie propia — es la pestaña `bom` de
 * `DataSurface` (`src/features/data/DataSurface.tsx`), la misma superficie
 * que Resultados, Tabla y Revisión comparten, con un solo cromo, un solo
 * título («Datos») y un solo botón de cerrar. Se abre con el helper real
 * `openDataSurface` de `qa-welcome.mjs` (ya escrito para esta superficie de
 * cuatro pestañas), no con un lanzador propio.
 *
 * Lo que se sigue comprobando es lo mismo que probaba structureco: miembros
 * duplicados/discontinuos producen filas trazables agrupadas por
 * material+sección+familia, los filtros de familia e identidad recomponen la
 * proyección, exportar CSV produce un archivo real con BOM UTF-8 y
 * procedencia por barra, y «Localizar» selecciona el miembro exacto en el
 * lienzo degradando la superficie a `peek` (nunca la cierra) — con los
 * selectores reales de esta app: `.data-surface`, `[data-data-tab="bom"]`,
 * `[data-testid="structural-bom"]`.
 *
 * Tres escenarios (X2 escritorio es, M1 tableta es, K0 móvil táctil en),
 * cada uno en su propio contexto de navegador.
 *
 * Uso: npm run qa:structural-bom
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { clearProjectLibraryOnBoot, openDataSurface, openExamplePortal } from './qa-welcome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'qa-artifacts', 'structural-bom');
fs.mkdirSync(outDir, { recursive: true });
const port = 4221;
const baseURL = `http://127.0.0.1:${port}/`;

const scenarios = [
  { id: 'X2', viewport: { width: 1440, height: 900 }, language: 'es', touch: false, presentation: 'drawer' },
  // 1050×768 y no 1100×768: a 768 de alto la frontera calculada X2↔M1 está en
  // 1073px (`expandedBoundaryWidth(768)` en `shellComposition.ts` contra las
  // constantes CHROME vigentes — el comentario del propio módulo, «1117 a
  // 768», quedó desactualizado desde que `footerWide` bajó a 0). A 1100px la
  // app resuelve X2, no M1.
  { id: 'M1', viewport: { width: 1050, height: 768 }, language: 'es', touch: false, presentation: 'drawer' },
  { id: 'K0', viewport: { width: 390, height: 844 }, language: 'en', touch: true, presentation: 'fullscreen' },
];

const report = { phase: 'structural-bom', generatedAt: new Date().toISOString(), checks: [], failures: [] };

const disablePwaUpdateLifecycle = (target) => target.addInitScript(() => {
  const registration = { installing: null, waiting: null, addEventListener: () => undefined };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller: null, register: async () => registration, addEventListener: () => undefined },
  });
});

const previewServer = await preview({ root, preview: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' }),
});

const check = (scenario, name, condition, detail = undefined) => {
  const entry = { scenario, name, pass: Boolean(condition), detail };
  report.checks.push(entry);
  console.log(`${entry.pass ? 'OK  ' : 'FAIL'}  ${scenario} · ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
  if (!entry.pass) throw new Error(`${scenario} · ${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
};

/** Copiado casi literal del modelo de structureco: mismos ids de catálogo
 * (`steel-a992`, `w6x9`), mismas unidades base (kN·m). Dos frames duplicados
 * discontinuos, una armadura, un frame con identidad de catálogo sin
 * resolver, y un rígido — que el BOM excluye por completo. */
const seedBomProject = (project, language) => ({
  ...project,
  name: language === 'es' ? 'Pórtico BOM QA' : 'BOM QA frame',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 3, y: 4, support: { type: 'none' } },
    { id: 'N3', x: 6, y: 4, support: { type: 'none' } },
    { id: 'N4', x: 9, y: 4, support: { type: 'roller' } },
  ],
  members: [
    {
      id: 'F1', i: 'N1', j: 'N2', type: 'frame', E: 200000000,
      A: 0.0017290288, I: 0.00000682619537984, density: 7850,
      materialId: 'steel-a992', materialOrigin: 'catalog', sectionId: 'w6x9', sectionOrigin: 'catalog',
    },
    {
      id: 'F2', i: 'N1', j: 'N2', type: 'frame', E: 200000000,
      A: 0.0017290288, I: 0.00000682619537984, density: 7850,
      materialId: 'steel-a992', materialOrigin: 'catalog', sectionId: 'w6x9', sectionOrigin: 'catalog',
    },
    {
      id: 'T1', i: 'N2', j: 'N3', type: 'truss', E: 200000000,
      A: 0.0017290288, I: 0, density: 7850,
      materialId: 'steel-a992', materialOrigin: 'catalog', sectionId: 'w6x9', sectionOrigin: 'catalog',
    },
    {
      id: 'U1', i: 'N3', j: 'N4', type: 'frame', E: 25000000,
      A: 0.01, I: 0.00008, density: 2400, materialOrigin: 'custom', sectionOrigin: 'custom',
    },
    {
      id: 'R1', i: 'N1', j: 'N2', type: 'rigid', E: 1, A: 1, I: 1, density: 1,
      materialOrigin: 'custom', sectionOrigin: 'custom',
    },
  ],
  loadCases: [],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  memberInitialEffects: [],
  settings: { ...project.settings, language },
});

/**
 * `continueStoredProject` (qa-welcome.mjs) sólo reconoce el botón «Continuar
 * proyecto» en español — el escenario K0 de este script siembra el proyecto
 * en inglés («Continue project») para cubrir el idioma en la exportación CSV
 * y las etiquetas del BOM, así que aquí hace falta la variante bilingüe. No
 * se toca `qa-welcome.mjs`: es un límite real de ese helper compartido, no
 * algo que corresponda arreglar dentro del alcance de este script.
 */
const continueStoredProjectBilingual = async (page, { timeout = 20_000 } = {}) => {
  const shell = page.locator('.app-shell');
  if (await shell.waitFor({ state: 'visible', timeout }).then(() => true, () => false)) return;
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /continuar proyecto|continue project/i }).click();
  await shell.waitFor({ state: 'visible' });
};

const enterSeededWorkspace = async (page, language) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 20_000 });
  await openExamplePortal(page);
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 20_000 });
  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.project')));
  await page.evaluate((next) => localStorage.setItem('structureCo.project', JSON.stringify(next)), seedBomProject(project, language));
  await page.reload({ waitUntil: 'networkidle' });
  await continueStoredProjectBilingual(page);
  await page.locator('[data-structure-kind="member"][data-structure-id="F1"]').waitFor({ state: 'visible', timeout: 15_000 });
};

const COPY = {
  es: {
    geometricTitle: 'Cuantificación geométrica',
    purchaseBoundary: /No es una estimación de compra/,
    truss: 'Armaduras', frame: 'Pórticos', identity: 'Identidad',
    exportCsv: 'Exportar CSV', locateF1: /Localizar barra F1/i,
    closeData: 'Cerrar Datos', restoreData: 'Volver a Datos', tabBom: 'BOM',
  },
  en: {
    geometricTitle: 'Geometric quantity takeoff',
    purchaseBoundary: /not a purchase estimate/,
    truss: 'Trusses', frame: 'Frames', identity: 'Identity',
    exportCsv: 'Export CSV', locateF1: /Locate member F1/i,
    closeData: 'Close Data', restoreData: 'Back to Data', tabBom: 'BOM',
  },
};

try {
  for (const scenario of scenarios) {
    const copy = COPY[scenario.language];
    const context = await browser.newContext({
      // Se entra SIEMPRE por un viewport de escritorio, sea cual sea el
      // escenario: `enterSeededWorkspace` recarga la página con el proyecto
      // sembrado en `localStorage` a medio camino, y ese recorrido de la
      // Bienvenida («Continuar proyecto» tras el recargo) es justo el que
      // `qa-structural-edits.mjs`/`qa-bulk-edit.mjs` —los scripts reales que
      // ya usan `continueStoredProject`— resuelven a 1440×900 y sólo LUEGO
      // cambian de tamaño con `setViewportSize`. Repetir esa entrada ya en
      // 390×844 (K0) es la ruta que no ejercitan y que aquí se colgaba.
      viewport: { width: 1440, height: 900 },
      hasTouch: scenario.touch,
      locale: scenario.language === 'es' ? 'es-MX' : 'en-US',
      colorScheme: 'light',
      acceptDownloads: true,
    });
    await clearProjectLibraryOnBoot(context);
    await disablePwaUpdateLifecycle(context);
    await context.addInitScript(() => localStorage.setItem('structureCo.theme', 'light'));
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    try {
      await enterSeededWorkspace(page, scenario.language);
      await page.setViewportSize(scenario.viewport);
      await page.waitForTimeout(300);

      // El lanzador «Resultados» del topbar degrada a «Más acciones» por
      // debajo de 700px (CRI-95); ahí `openDataSurface` cae a su respaldo por
      // evento y no hay un elemento concreto que recupere el foco al cerrar,
      // así que sólo se afirma el retorno de foco donde el lanzador es un
      // botón real y visible.
      const resultsLauncher = page.getByRole('button', { name: /^resultados$/i }).first();
      const launcherVisible = await resultsLauncher.isVisible().catch(() => false);

      const surface = await openDataSurface(page, { tab: 'bom' });
      await check(scenario.id, 'la superficie «Datos» abre en la pestaña BOM',
        await page.locator('[data-data-tab="bom"][role="tab"]').getAttribute('aria-selected') === 'true');

      const panel = surface.locator('[data-testid="structural-bom"]');
      await panel.waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(250);

      check(scenario.id, 'el título y el límite comercial explícito son visibles',
        await surface.getByRole('heading', { name: copy.geometricTitle }).isVisible()
        && await surface.getByText(copy.purchaseBoundary).isVisible());

      const composition = await page.evaluate(() => ({
        shellClass: document.querySelector('.app-shell')?.getAttribute('data-shell-class'),
        presentation: document.querySelector('.data-surface')?.classList.contains('sc-modal-surface--fullscreen') ? 'fullscreen' : 'drawer',
        extent: document.querySelector('.data-surface')?.getAttribute('data-surface-extent'),
        rows: document.querySelector('[data-testid="structural-bom"]')?.getAttribute('data-row-count'),
        body: document.querySelector('.data-surface')?.textContent ?? '',
      }));
      check(scenario.id, 'la superficie «Datos» toma la presentación responsive esperada',
        composition.shellClass === scenario.id && composition.presentation === scenario.presentation && composition.extent === 'default', composition);
      check(scenario.id, 'miembros duplicados y discontinuos producen tres filas trazables',
        composition.rows === '3' && /F1/.test(composition.body) && /F2/.test(composition.body) && /T1/.test(composition.body) && /U1/.test(composition.body), composition.rows);

      const overflow = await page.evaluate(() => ({
        document: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        surface: (() => {
          const node = document.querySelector('.data-surface');
          if (!node) return null;
          const box = node.getBoundingClientRect();
          return { left: Math.round(box.left), right: Math.round(box.right), viewport: window.innerWidth };
        })(),
      }));
      check(scenario.id, 'la superficie se mantiene dentro del viewport sin desbordar la página',
        overflow.document <= 1 && overflow.surface && overflow.surface.left >= -1 && overflow.surface.right <= overflow.surface.viewport + 1, overflow);

      if (scenario.touch) {
        const smallTargets = await surface.locator('button, select').evaluateAll((elements) => elements
          .filter((element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; })
          .map((element) => { const box = element.getBoundingClientRect(); return { name: element.getAttribute('aria-label') || element.textContent?.trim(), width: Math.round(box.width), height: Math.round(box.height) }; })
          .filter(({ width, height }) => width < 43.5 || height < 43.5));
        check(scenario.id, 'todos los controles visibles cumplen el mínimo táctil de 44px', smallTargets.length === 0, smallTargets);
      }

      await surface.getByRole('button', { name: copy.truss }).click();
      check(scenario.id, 'el filtro de familia reconstruye la proyección vigente', await panel.getAttribute('data-row-count') === '2');
      await surface.getByLabel(copy.identity).selectOption('unresolved');
      check(scenario.id, 'el filtro de identidad aísla el miembro sin resolver',
        await panel.getAttribute('data-row-count') === '1' && await surface.getByRole('button', { name: /U1/ }).isVisible());
      await surface.getByLabel(copy.identity).selectOption('all');
      await surface.getByRole('button', { name: copy.truss }).click();
      check(scenario.id, 'restaurar los filtros restaura el conjunto de filas estable', await panel.getAttribute('data-row-count') === '3');

      const downloadPromise = page.waitForEvent('download');
      await surface.getByRole('button', { name: copy.exportCsv }).click();
      const download = await downloadPromise;
      const downloadedPath = await download.path();
      const bytes = fs.readFileSync(downloadedPath);
      const csv = bytes.toString('utf8');
      const expectedFilename = scenario.language === 'es' ? 'portico-bom-qa-bom-estructural.csv' : 'bom-qa-frame-bom-estructural.csv';
      check(scenario.id, 'la descarga real del CSV es estable en bytes y trazable',
        download.suggestedFilename() === expectedFilename
        && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
        && csv.includes('schema_version,row_id,identity_status')
        && csv.includes('F1:N1-N2:5|F2:N1-N2:5')
        && !/cost|price|waste|allowance/i.test(csv),
        { filename: download.suggestedFilename(), bytes: bytes.length });

      await page.screenshot({ path: path.join(outDir, `${scenario.id}-bom.png`), fullPage: true });

      await surface.getByRole('button', { name: copy.locateF1 }).click();
      await surface.waitFor({ state: 'visible' });
      await page.waitForTimeout(250);
      const localized = await page.evaluate(() => ({
        extent: document.querySelector('.data-surface')?.getAttribute('data-surface-extent'),
        selected: document.querySelector('[data-structure-kind="member"][data-structure-id="F1"]')?.getAttribute('aria-pressed'),
        backgroundInert: document.querySelector('.app-shell')?.hasAttribute('inert'),
      }));
      check(scenario.id, 'la procedencia localiza el miembro exacto y degrada a peek',
        localized.extent === 'peek' && localized.selected === 'true' && localized.backgroundInert === false, localized);

      const peekHandle = surface.locator('.sc-modal-surface__peek-handle');
      await peekHandle.waitFor({ state: 'visible' });
      await check(scenario.id, 'la manija de restaurar anuncia la superficie que reabre',
        (await peekHandle.getAttribute('aria-label') ?? '').includes(copy.restoreData));
      await peekHandle.click();
      await page.waitForTimeout(200);
      check(scenario.id, 'restaurar conserva la superficie filtrada',
        await surface.getAttribute('data-surface-extent') === 'default'
        && await panel.getAttribute('data-row-count') === '3');

      await surface.getByRole('button', { name: copy.closeData }).click();
      await surface.waitFor({ state: 'hidden' });
      await page.waitForTimeout(100);
      if (launcherVisible) {
        check(scenario.id, 'cerrar devuelve el foco al lanzador persistente de Resultados',
          await resultsLauncher.evaluate((node) => document.activeElement === node));
      } else {
        console.log(`INFO  ${scenario.id} · el lanzador «Resultados» está en «Más acciones» a este ancho; no hay un elemento concreto cuyo retorno de foco afirmar (documentado, no se inventa un selector).`);
      }
      check(scenario.id, 'la consola del navegador quedó limpia', runtimeErrors.length === 0, runtimeErrors);
    } catch (error) {
      report.failures.push({ scenario: scenario.id, error: error instanceof Error ? error.stack ?? error.message : String(error) });
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await previewServer.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`Structural BOM QA PASS · ${report.checks.length} comprobaciones · ${scenarios.map((item) => item.id).join('/')}`);
