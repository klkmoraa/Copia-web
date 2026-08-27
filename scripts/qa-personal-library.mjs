/**
 * QA de navegador de la Biblioteca personal (favoritos + Section Builder).
 *
 * Portado desde `structureco/scripts/qa-personal-library.mjs`. La integración
 * real en este repo NO es la de structureco: aquí la Biblioteca personal es
 * una tarjeta lanzadora en la Bienvenida (`.welcome-library-launcher`) que
 * abre un `Drawer` (`PersonalLibraryView`), no una etapa de un recorrido con
 * un sidebar `.sc-home-nav`. Lo que se sigue comprobando es lo mismo que
 * probaba structureco: crear un favorito de miembro (par material+sección),
 * crear una vista favorita, crear/editar una sección paramétrica personal,
 * exportar e importar el expediente de secciones, y aplicar un favorito a un
 * miembro real y a la vista desde el Inspector — con la navegación y los
 * selectores reales de esta app (`openExamplePortal`, pestañas del Inspector
 * `detail`/`view`, `focus-object`/Enter sobre el lienzo SVG).
 *
 * Tres escenarios de viewport (X2 escritorio, M1 tableta, K0 móvil táctil),
 * cada uno en su propio contexto de navegador con almacenamiento limpio.
 *
 * Uso: npm run qa:personal-library
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { clearProjectLibraryOnBoot, openExamplePortal } from './qa-welcome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'qa-artifacts', 'personal-library');
fs.mkdirSync(outDir, { recursive: true });
const port = 4220;
const baseURL = `http://127.0.0.1:${port}/`;

const scenarios = [
  { id: 'X2', viewport: { width: 1440, height: 900 }, touch: false },
  // 1050×768 y no 1100×768: la frontera calculada X2↔M1 a 768 de alto está en
  // 1073px (`expandedBoundaryWidth(768)` en `shellComposition.ts`, recalculada
  // contra las constantes CHROME vigentes — el comentario del propio módulo
  // que dice «1117 a 768» quedó desactualizado desde que `footerWide` bajó a
  // 0). A 1100px la app entra en X2, no en M1.
  { id: 'M1', viewport: { width: 1050, height: 768 }, touch: false },
  { id: 'K0', viewport: { width: 390, height: 844 }, touch: true },
];

const report = { phase: 'personal-library', generatedAt: new Date().toISOString(), scenarios: [], failures: [] };

/**
 * El service worker de la PWA reintenta actualizaciones en segundo plano
 * durante `preview`; sin desactivarlo, un QA que corre varios escenarios
 * seguidos puede quedar compitiendo con un `waiting` worker a mitad de
 * prueba. Mismo parche que usan `qa.mjs` y `qa-datasheet-k0.mjs`.
 */
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
  const ok = Boolean(condition);
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${scenario} · ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
  if (!ok) throw new Error(`${scenario} · ${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
};

/**
 * En X2/M1, con almacenamiento limpio, el Inspector nace abierto
 * (`inspectorCollapsed` por defecto es `false`). En K0 nace siempre cerrado
 * —nunca tapa el lienzo entero al llegar— y sólo se pide, igual que
 * «Datos»: desde «Más acciones» → «Mostrar inspector», el mismo mecanismo en
 * las tres clases (`layoutActions.onToggleInspector` en `TopBar.tsx`).
 */
const ensureInspectorOpen = async (page) => {
  const inspector = page.locator('.inspector-panel');
  if (await inspector.isVisible().catch(() => false)) return inspector;
  // En K0, con un miembro seleccionado, la barra de acciones contextuales
  // flotante también tiene SU PROPIO botón «Más acciones» (para operaciones
  // del objeto, no del taller) — hay que apuntar al del topbar, no al primero
  // que aparezca.
  await page.locator('.utility-more-button').click();
  const menu = page.getByRole('dialog', { name: /más acciones/i });
  await menu.waitFor({ state: 'visible' });
  await menu.getByRole('button', { name: /mostrar inspector/i }).click();
  await inspector.waitFor({ state: 'visible', timeout: 10_000 });
  return inspector;
};

const smallTargets = (scope) => scope.evaluateAll((elements) => elements
  .filter((element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; })
  .map((element) => { const box = element.getBoundingClientRect(); return { label: element.getAttribute('aria-label') || element.textContent?.trim(), width: Math.round(box.width), height: Math.round(box.height) }; })
  .filter(({ width, height }) => width < 43.5 || height < 43.5));

try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario.viewport, hasTouch: scenario.touch, colorScheme: 'light', acceptDownloads: true });
    await clearProjectLibraryOnBoot(context);
    await disablePwaUpdateLifecycle(context);
    await context.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('structureCo.theme', 'light'); });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    const failures = [];
    const record = (name, ok, detail) => {
      if (!ok) failures.push(`${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
      check(scenario.id, name, ok, detail);
    };

    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 20_000 });

    const projectBefore = await page.evaluate(() => localStorage.getItem('structureCo.project'));

    // --- Abrir la Biblioteca personal desde su tarjeta lanzadora real -------
    const libraryLauncher = page.getByRole('button', { name: 'Biblioteca personal' });
    await libraryLauncher.waitFor({ state: 'visible' });
    await libraryLauncher.click();
    const drawer = page.locator('.welcome-library-drawer');
    await drawer.waitFor({ state: 'visible' });
    // Hay DOS encabezados «Biblioteca personal»: el cromo del Drawer y el
    // propio `<h2 id="personal-library-title">` de `PersonalLibraryView`.
    // Se apunta al segundo por id para no violar el modo estricto de Playwright.
    await page.locator('#personal-library-title').waitFor({ state: 'visible', timeout: 10_000 });

    // --- Crear un favorito de par material + sección ------------------------
    await page.getByRole('button', { name: 'Crear favorito' }).click();
    await page.getByLabel('Tipo de favorito').selectOption('pair');
    await page.getByLabel('Nombre del favorito').fill('Par QA A992 + IPE');
    await page.getByLabel('Material', { exact: true }).selectOption('steel-a992');
    await page.getByLabel('Sección', { exact: true }).selectOption('ipe-300');
    await page.getByRole('button', { name: 'Guardar favorito' }).click();
    await page.getByRole('listitem', { name: /Par QA A992 \+ IPE/ }).waitFor({ state: 'visible' });

    // --- Crear una vista favorita --------------------------------------------
    await page.getByRole('button', { name: 'Crear favorito' }).click();
    await page.getByLabel('Tipo de favorito').selectOption('view');
    await page.getByLabel('Nombre del favorito').fill('Vista QA');
    await page.getByRole('button', { name: 'Guardar favorito' }).click();
    await page.getByRole('listitem', { name: /Vista QA/ }).waitFor({ state: 'visible' });

    const libraryAfterFavorites = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.personal-library.v1') ?? '{}'));
    record('los dos favoritos quedaron guardados', libraryAfterFavorites?.favorites?.length === 2, libraryAfterFavorites?.favorites?.length);

    // --- Crear una sección paramétrica personal ------------------------------
    await page.getByRole('button', { name: 'Nueva sección' }).click();
    const editor = page.locator('.section-builder__editor');
    await editor.waitFor({ state: 'visible' });
    await page.getByLabel('Nombre de la sección').fill('Rectangular QA 30 × 50');
    await page.getByLabel(/^Ancho b/).fill('0.3');
    await page.getByLabel(/^Peralte h/).fill('0.5');
    await page.locator('[data-testid="section-builder-preview"][data-family="rectangle"]').waitFor({ state: 'visible' });

    const editorMetrics = await page.evaluate(() => ({
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    }));
    record('el editor de secciones no desborda la página', editorMetrics.overflow <= 1, editorMetrics.overflow);
    if (scenario.touch) {
      const targets = await smallTargets(editor.locator('button, input, select'));
      record('los controles del editor cumplen el mínimo táctil de 44px', targets.length === 0, targets);
    }
    await page.screenshot({ path: path.join(outDir, `${scenario.id}-section-editor.png`), fullPage: true });

    await page.getByRole('button', { name: 'Guardar sección' }).click();
    const sectionItem = page.locator('.section-builder__list li').filter({ hasText: 'Rectangular QA 30 × 50' });
    await sectionItem.waitFor({ state: 'visible' });

    const sectionsAfterSave = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.personal-sections.v1') ?? '{}'));
    record('la sección personal quedó guardada', sectionsAfterSave?.sections?.length === 1, sectionsAfterSave?.sections?.length);

    const projectAfterLibraryEdits = await page.evaluate(() => localStorage.getItem('structureCo.project'));
    record('guardar favoritos y secciones no mutó el proyecto', projectAfterLibraryEdits === projectBefore);

    // --- Exportar / borrar / importar el expediente de secciones ------------
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar secciones' }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    record('el archivo exportado existe y tiene contenido', Boolean(downloadedPath) && fs.statSync(downloadedPath).size > 0, downloadedPath);
    const exported = JSON.parse(fs.readFileSync(downloadedPath, 'utf8'));
    record('el expediente exportado trae exactamente la sección creada', exported?.sections?.length === 1 && exported.sections[0].name === 'Rectangular QA 30 × 50', exported);

    await sectionItem.getByRole('button', { name: /^Borrar/ }).click();
    await sectionItem.waitFor({ state: 'hidden' });
    const sectionsAfterDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.personal-sections.v1') ?? '{}'));
    record('borrar la sección la retira del almacenamiento', (sectionsAfterDelete?.sections?.length ?? 0) === 0, sectionsAfterDelete?.sections?.length);

    await page.locator('input[type="file"][aria-label="Importar secciones"]').setInputFiles(downloadedPath);
    await page.getByText('Se importó 1 sección.').waitFor({ state: 'visible', timeout: 10_000 });
    await sectionItem.waitFor({ state: 'visible' });
    const sectionsAfterImport = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.personal-sections.v1') ?? '{}'));
    record('importar el expediente exportado restaura la sección', sectionsAfterImport?.sections?.length === 1, sectionsAfterImport?.sections?.length);

    const homeMetrics = await page.evaluate(() => ({
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    }));
    record('la Biblioteca no desborda la página', homeMetrics.overflow <= 1, homeMetrics.overflow);
    if (scenario.touch) {
      const targets = await smallTargets(page.locator('.personal-library-shell').locator('button, input:not([type="file"]), select'));
      record('los controles de la Biblioteca cumplen el mínimo táctil de 44px', targets.length === 0, targets);
    }
    await page.screenshot({ path: path.join(outDir, `${scenario.id}-library.png`), fullPage: true });

    // --- Cerrar la Biblioteca y comprobar que el foco vuelve al lanzador ----
    await drawer.getByRole('button', { name: 'Cerrar' }).click();
    await drawer.waitFor({ state: 'hidden' });
    const focusReturned = await libraryLauncher.evaluate((node) => document.activeElement === node);
    record('cerrar la Biblioteca devuelve el foco a su tarjeta lanzadora', focusReturned);

    // --- Entrar al pórtico de ejemplo y aplicar el favorito a un miembro ----
    await openExamplePortal(page);
    const shell = page.locator('.app-shell');
    await shell.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForTimeout(300);

    // Los miembros del pórtico de ejemplo son ortogonales (columnas y vigas
    // perfectamente verticales u horizontales), así que su `<g>` en el SVG
    // tiene ancho o alto CERO en `getBoundingClientRect()` — un miembro real,
    // visible y clicable, pero que la heurística de "visible" de Playwright
    // rechaza por caja vacía. `qa-bulk-edit.mjs` resuelve exactamente esto
    // pinchando un punto real del trazo con el puntero en vez de enfocar el
    // elemento SVG; se reutiliza el mismo patrón aquí.
    const seedProject = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.project') ?? '{}'));
    const member = seedProject.members?.[0];
    if (!member) throw new Error('El pórtico de ejemplo no tiene miembros.');
    const memberId = member.id;
    const nodeCenter = async (nodeId) => {
      const box = await page.locator(`[data-structure-kind="node"][data-structure-id="${nodeId}"]`).boundingBox();
      if (!box) throw new Error(`El nudo ${nodeId} no tiene una posición medible en pantalla.`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const i = await nodeCenter(member.i);
    const j = await nodeCenter(member.j);
    let clicked = false;
    for (const ratio of [0.5, 0.35, 0.65, 0.25, 0.75]) {
      const point = { x: i.x + (j.x - i.x) * ratio, y: i.y + (j.y - i.y) * ratio };
      const owner = await page.evaluate((candidate) => document
        .elementFromPoint(candidate.x, candidate.y)
        ?.closest('[data-structure-object]')
        ?.getAttribute('data-structure-id') ?? null, point);
      if (owner === memberId) { await page.mouse.click(point.x, point.y); clicked = true; break; }
    }
    if (!clicked) throw new Error(`No se encontró un punto del trazo de ${memberId} libre de obstrucciones.`);
    const memberTarget = page.locator(`[data-structure-kind="member"][data-structure-id="${memberId}"]`);
    check(scenario.id, 'seleccionar el miembro lo marca aria-pressed', await memberTarget.getAttribute('aria-pressed') === 'true');

    const inspector = await ensureInspectorOpen(page);
    const detailTab = inspector.locator('#inspector-tab-detail');
    await check(scenario.id, 'la pestaña Inspector queda activa al seleccionar un miembro', await detailTab.getAttribute('aria-selected') === 'true');

    const favoritesPanel = inspector.locator('.member-favorites').first();
    await favoritesPanel.waitFor({ state: 'visible' });
    // El único favorito estructural guardado en la Biblioteca ("Par QA A992 +
    // IPE") es el que el panel preselecciona por defecto — no hace falta
    // tocar el `<select>` para probar que llega hasta aquí.
    const favoriteSelect = favoritesPanel.getByLabel('Favorito estructural');
    await check(scenario.id, 'el favorito de par creado en la Biblioteca aparece preseleccionado',
      /Par QA A992 \+ IPE/.test(await favoriteSelect.locator('option:checked').textContent() ?? ''));
    const applyButton = favoritesPanel.getByRole('button', { name: 'Aplicar favorito' });
    record('el botón Aplicar favorito está habilitado con un par de catálogo', await applyButton.isEnabled());
    await applyButton.click();
    await page.waitForFunction(({ id }) => {
      const project = JSON.parse(localStorage.getItem('structureCo.project') ?? '{}');
      const member = project.members?.find((item) => item.id === id);
      return member?.materialId === 'steel-a992' && member?.sectionId === 'ipe-300';
    }, { id: memberId }, { timeout: 10_000 });
    record('el favorito aplicado escribió material y sección de catálogo en el miembro seleccionado', true);

    // --- Pestaña Vista del Inspector: aplicar la vista favorita -------------
    const viewTab = inspector.locator('#inspector-tab-view');
    await viewTab.click();
    await check(scenario.id, 'la pestaña Vista queda activa', await viewTab.getAttribute('aria-selected') === 'true');
    const viewFavorites = inspector.locator('.view-favorites');
    await viewFavorites.waitFor({ state: 'visible' });
    const viewSelect = viewFavorites.getByLabel('Vista favorita');
    await check(scenario.id, 'la vista favorita creada en la Biblioteca aparece preseleccionada',
      /Vista QA/.test(await viewSelect.locator('option:checked').textContent() ?? ''));
    await viewFavorites.getByRole('button', { name: 'Aplicar vista' }).click();
    await viewFavorites.getByText('Vista aplicada. El análisis y el historial estructural se conservaron.').waitFor({ state: 'visible', timeout: 10_000 });

    const workspaceMetrics = await page.evaluate(() => ({
      shellClass: document.querySelector('.app-shell')?.getAttribute('data-shell-class'),
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    }));
    record('la clase de composición corresponde al escenario', workspaceMetrics.shellClass === scenario.id, workspaceMetrics.shellClass);
    record('el espacio de trabajo no desborda la página', workspaceMetrics.overflow <= 1, workspaceMetrics.overflow);
    if (scenario.touch) {
      // Alcance a lo portado (favoritos estructurales y de vista), no a todo
      // el Inspector: el resto de secciones («Precisión CAD», leyenda…) es
      // mobiliario preexistente ajeno a esta Biblioteca personal.
      const targets = await smallTargets(inspector.locator('.member-favorites, .view-favorites').locator('button, input, select'));
      record('los controles de favoritos en el Inspector cumplen el mínimo táctil de 44px', targets.length === 0, targets);
    }
    await page.screenshot({ path: path.join(outDir, `${scenario.id}-workspace.png`), fullPage: true });

    record('la consola del navegador quedó limpia', consoleErrors.length === 0, consoleErrors);

    report.scenarios.push({ id: scenario.id, failures, consoleErrors });
    report.failures.push(...failures.map((failure) => `${scenario.id}: ${failure}`));
    await context.close();
  }
} finally {
  await browser.close();
  await previewServer.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`Personal library QA PASS · ${report.scenarios.length} escenarios · qa-artifacts/personal-library`);
