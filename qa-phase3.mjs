import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.join(root, 'docs', 'ux-redesign', 'evidence', 'phase-03', 'after');
fs.mkdirSync(evidenceDir, { recursive: true });

const baseURL = 'http://127.0.0.1:4179/';
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 834, height: 1194 },
  { width: 1024, height: 768 },
  { width: 1194, height: 834 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 960 },
];

const results = {
  generatedAt: new Date().toISOString(),
  scope: 'Phase 3 canvas, tools, labels, layers, selection, input and accessibility QA',
  checks: {},
  matrix: [],
  labels: {},
  layers: {},
  selections: {},
  input: {},
  modes: {},
  zoom200: {},
  webkit: {},
  console: [],
  pageErrors: [],
  screenshots: [],
};

const record = (name, value) => { results.checks[name] = Boolean(value); };
const attachDiagnostics = (page, prefix) => {
  page.on('console', (message) => {
    if (!['warning', 'error'].includes(message.type())) return;
    if (message.text().includes('preloaded using link preload')) return;
    results.console.push(`${prefix} ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => results.pageErrors.push(`${prefix}: ${String(error)}`));
};

const loadExample = async (page) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Pórtico de ejemplo Pórtico de 6/i }).click();
  await page.locator('.topbar').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Ajustar modelo a la vista' }).click();
  await page.waitForTimeout(120);
};

const openMore = async (page, language = 'es') => {
  await page.getByRole('button', { name: language === 'es' ? 'Más acciones' : 'More actions', exact: true }).click();
  const menu = page.locator('.utility-actions-menu');
  await menu.waitFor({ state: 'visible' });
  return menu;
};

const setTheme = async (page, theme, language = 'es') => {
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  if (current === theme) return;
  const menu = await openMore(page, language);
  await menu.getByRole('button', { name: theme === 'dark' ? (language === 'es' ? 'Tema oscuro' : 'Dark theme') : (language === 'es' ? 'Tema claro' : 'Light theme'), exact: true }).click();
  await page.waitForTimeout(80);
};

const setLanguage = async (page, language) => {
  const current = await page.evaluate(() => document.documentElement.lang);
  if (current === language) return;
  const menu = await openMore(page, current === 'en' ? 'en' : 'es');
  await menu.getByLabel(current === 'en' ? 'Language' : 'Idioma').selectOption(language);
  await page.keyboard.press('Escape');
};

const setMode = async (page, mode, language = 'es') => {
  const desktop = page.locator('.mode-select:visible');
  if (await desktop.count()) {
    await desktop.selectOption(mode);
    return;
  }
  const menu = await openMore(page, language);
  await menu.locator('.overflow-mode select').selectOption(mode);
  await page.keyboard.press('Escape');
};

const capture = async (page, name, state) => {
  const file = path.join(evidenceDir, name);
  const buffer = await page.screenshot({ path: file, fullPage: false });
  const viewport = page.viewportSize();
  results.screenshots.push({
    file: name,
    viewport,
    state,
    bytes: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  });
};

const measureCanvas = async (page) => page.evaluate(() => {
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const canvas = document.querySelector('.structural-canvas');
  const canvasRect = canvas.getBoundingClientRect();
  const insets = canvasRect.width <= 480
    ? { top: 104, right: 58, bottom: 58, left: 58 }
    : canvasRect.width <= 1023
      ? { top: 116, right: 64, bottom: 62, left: 64 }
      : { top: 116, right: 68, bottom: 62, left: 68 };
  const safe = {
    left: canvasRect.left + insets.left,
    top: canvasRect.top + insets.top,
    right: canvasRect.right - insets.right,
    bottom: canvasRect.bottom - insets.bottom,
  };
  const labels = [...document.querySelectorAll('[data-smart-label]')].filter(visible).map((label) => {
    const rect = label.querySelector(':scope > rect').getBoundingClientRect();
    return {
      id: label.getAttribute('data-smart-label'),
      priority: Number(label.getAttribute('data-label-priority')),
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      leader: Boolean(label.querySelector('.smart-label-leader')),
      fontSize: Number.parseFloat(getComputedStyle(label.querySelector('text')).fontSize),
    };
  });
  const essential = labels.filter((label) => label.priority <= 1);
  const collisions = [];
  for (let left = 0; left < essential.length; left += 1) {
    for (let right = left + 1; right < essential.length; right += 1) {
      const a = essential[left];
      const b = essential[right];
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) collisions.push([a.id, b.id]);
    }
  }
  const chrome = [...document.querySelectorAll('.canvas-mode-badge,.canvas-view-chips,.canvas-layer-trigger,.canvas-controls,.canvas-status')]
    .filter(visible)
    .map((element) => ({ className: element.className, rect: element.getBoundingClientRect() }));
  const chromeIntersections = [];
  for (let left = 0; left < chrome.length; left += 1) {
    for (let right = left + 1; right < chrome.length; right += 1) {
      const a = chrome[left].rect;
      const b = chrome[right].rect;
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) chromeIntersections.push([chrome[left].className, chrome[right].className]);
    }
  }
  const toolIds = new Set([...document.querySelectorAll('[data-tool-id]')].map((element) => element.getAttribute('data-tool-id')));
  const desktopTools = [...document.querySelectorAll('.desktop-tool-list .tool-button')].filter(visible);
  const dockTools = [...document.querySelectorAll('.mobile-tool-dock .tool-button')].filter(visible);
  const touchTargets = [...document.querySelectorAll('.topbar button,.topbar input,.toolbar button,.canvas-controls button,.canvas-layer-trigger')]
    .filter(visible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { name: element.getAttribute('aria-label') || element.textContent.trim(), width: rect.width, height: rect.height };
    });
  return {
    viewport: { width: innerWidth, height: innerHeight },
    canvas: { width: canvasRect.width, height: canvasRect.height },
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    toolIds: [...toolIds].filter(Boolean),
    desktopToolCount: desktopTools.length,
    dockToolCount: dockTools.length,
    groupCount: [...document.querySelectorAll('.tool-group')].filter(visible).length,
    labels: { count: labels.length, essential: essential.length, collisions, outsideSafe: labels.filter((label) => label.left < safe.left - 1 || label.top < safe.top - 1 || label.right > safe.right + 1 || label.bottom > safe.bottom + 1).map((label) => label.id), leaders: labels.filter((label) => label.leader).length, minimumFontSize: Math.min(...labels.map((label) => label.fontSize)) },
    chromeIntersections,
    touchTargets,
    pointerSupport: canvas.getAttribute('data-pointer-support'),
    canvasShortcuts: canvas.getAttribute('aria-keyshortcuts'),
    objectCount: document.querySelectorAll('[data-structure-object]').length,
  };
});

const assertMatrixRow = (row) => {
  const key = `${row.viewport.width}x${row.viewport.height}`;
  record(`${key}NoOverflow`, row.horizontalOverflow === 0);
  record(`${key}AllToolsRegistered`, row.toolIds.length === 12);
  record(`${key}ExpectedRailOrDock`, row.viewport.width >= 1024 ? row.desktopToolCount >= 12 && row.dockToolCount === 0 : row.desktopToolCount === 0 && row.dockToolCount === 6);
  record(`${key}LabelsInsideSafeRect`, row.labels.outsideSafe.length === 0);
  record(`${key}EssentialLabelsNoCollision`, row.labels.collisions.length === 0);
  record(`${key}ChromeNoCollision`, row.chromeIntersections.length === 0);
  record(`${key}CanvasObjectsPresent`, row.objectCount === 10);
  record(`${key}PointerContract`, row.pointerSupport === 'mouse touch pen');
  record(`${key}CanvasShortcuts`, row.canvasShortcuts?.includes('Delete') && row.canvasShortcuts?.includes('Escape'));
  record(`${key}SmartLabelText12`, row.labels.minimumFontSize >= 11.95);
  if (row.viewport.width <= 834) record(`${key}TouchTargets44`, row.touchTargets.every((target) => target.width >= 43.5 && target.height >= 43.5));
};

const runViewportMatrix = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, locale: 'es-MX' });
  attachDiagnostics(page, 'matrix');
  await loadExample(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Ajustar modelo a la vista' }).click();
    await page.waitForTimeout(80);
    const row = await measureCanvas(page);
    results.matrix.push(row);
    assertMatrixRow(row);
    await capture(page, `phase3_after_${viewport.width}x${viewport.height}_light_complete_ready.png`, { theme: 'light', mode: 'complete', analysis: 'ready', selection: 'none' });
  }
  await page.close();
};

const selectionAndLayerFlow = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'es-MX' });
  attachDiagnostics(page, 'selection-layers');
  await loadExample(page);
  const member1 = page.locator('[data-structure-kind="member"][data-structure-id="M1"]');
  const member3 = page.locator('[data-structure-kind="member"][data-structure-id="M3"]');
  const node1 = page.locator('[data-structure-kind="node"][data-structure-id="N1"]');
  const load = page.locator('[data-structure-kind="memberLoad"][data-structure-id="ML1"]');

  await member1.focus();
  await page.keyboard.press('Enter');
  results.selections.member = await page.evaluate(() => ({ pressed: document.querySelector('[data-structure-id="M1"]')?.getAttribute('aria-pressed'), halo: document.querySelectorAll('[data-structure-id="M1"] .member-selection-halo').length, label: document.querySelector('[data-smart-label="member:M1"]')?.textContent }));
  record('memberSelectionGeometry', results.selections.member.pressed === 'true' && results.selections.member.halo === 1 && results.selections.member.label === 'M1');
  await capture(page, 'phase3_after_1440x900_light_complete_member-selected.png', { theme: 'light', mode: 'complete', analysis: 'ready', selection: 'member' });

  await page.keyboard.press('Escape');
  await node1.focus();
  await page.keyboard.press('Enter');
  results.selections.node = await page.evaluate(() => ({ halo: document.querySelectorAll('[data-structure-id="N1"] .node-selection-halo').length, support: document.querySelectorAll('.support-symbol.selected .support-selection-frame').length }));
  record('nodeSupportSelectionGeometry', results.selections.node.halo === 1 && results.selections.node.support === 1);
  await page.setViewportSize({ width: 430, height: 932 });
  await page.getByRole('button', { name: 'Ajustar modelo a la vista' }).click();
  await capture(page, 'phase3_after_430x932_light_complete_node-support-selected.png', { theme: 'light', mode: 'complete', analysis: 'ready', selection: 'node-support' });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'Ajustar modelo a la vista' }).click();
  await page.keyboard.press('Escape');
  await load.focus();
  await page.keyboard.press('Enter');
  await setTheme(page, 'dark');
  results.selections.load = await page.evaluate(() => ({ halo: document.querySelectorAll('[data-structure-id="ML1"] .load-selection-halo').length, technicalStroke: getComputedStyle(document.querySelector('[data-structure-id="ML1"]')).stroke, selection: getComputedStyle(document.documentElement).getPropertyValue('--selection').trim() }));
  record('loadSelectionPreservesTechnicalColor', results.selections.load.halo === 1 && results.selections.load.technicalStroke !== results.selections.load.selection);
  await capture(page, 'phase3_after_1366x768_dark_complete_load-selected.png', { theme: 'dark', mode: 'complete', analysis: 'ready', selection: 'load' });

  await setTheme(page, 'light');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: 'Ajustar modelo a la vista' }).click();
  await page.keyboard.press('Escape');
  const firstBox = await member1.boundingBox();
  const thirdBox = await member3.boundingBox();
  await page.mouse.click(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.click(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2);
  await page.keyboard.up('Shift');
  results.selections.multi = await page.evaluate(() => ({ selected: document.querySelectorAll('.member-object.selected').length, envelope: document.querySelectorAll('[data-multi-selection-envelope]').length, handles: document.querySelectorAll('.multi-selection-handle').length, count: document.querySelector('[data-multi-selection-envelope]')?.getAttribute('data-selection-count') }));
  record('multiSelectionEnvelope', results.selections.multi.selected === 2 && results.selections.multi.envelope === 1 && results.selections.multi.handles === 4 && results.selections.multi.count === '2');
  await capture(page, 'phase3_after_1024x768_light_complete_multi-selected.png', { theme: 'light', mode: 'complete', analysis: 'ready', selection: 'multi' });

  await page.getByRole('button', { name: 'Capas de información' }).click();
  const panel = page.getByRole('region', { name: 'Capas de información' });
  const switches = panel.getByRole('switch');
  const modelSwitch = panel.getByRole('switch', { name: /Modelo/ });
  const labelsSwitch = panel.getByRole('switch', { name: /Etiquetas/ });
  const idsSwitch = panel.getByRole('switch', { name: /Identificadores/ });
  const loadsSwitch = panel.getByRole('switch', { name: /^Cargas/ });
  results.layers.initial = { count: await switches.count(), modelDisabled: await modelSwitch.isDisabled() };
  await labelsSwitch.click();
  await idsSwitch.click();
  results.layers.selectedLabelsWhenHidden = await page.locator('[data-smart-label="member:M1"],[data-smart-label="member:M3"]').count();
  await loadsSwitch.click();
  results.layers.hidden = await page.evaluate(() => ({ loads: document.querySelectorAll('[data-structure-kind="nodalLoad"],[data-structure-kind="memberLoad"]').length, members: document.querySelectorAll('[data-structure-kind="member"]').length, nodes: document.querySelectorAll('[data-structure-kind="node"]').length }));
  record('layerPanelEightSwitches', results.layers.initial.count === 8 && results.layers.initial.modelDisabled);
  record('selectedLabelsSurviveLayerHide', results.layers.selectedLabelsWhenHidden === 2);
  record('modelSurvivesLoadHide', results.layers.hidden.loads === 0 && results.layers.hidden.members === 3 && results.layers.hidden.nodes === 4);
  await panel.getByRole('button', { name: 'Restablecer capas' }).click();
  await page.keyboard.press('Escape');
  record('layerPanelEscapeRestoresTrigger', await page.getByRole('button', { name: 'Capas de información' }).evaluate((element) => document.activeElement === element));
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.getByRole('button', { name: 'Ajustar modelo a la vista' }).click();
  await page.getByRole('button', { name: 'Capas de información' }).click();
  await capture(page, 'phase3_after_834x1194_light_complete_layers-open.png', { theme: 'light', mode: 'complete', analysis: 'ready', selection: 'multi', panel: 'layers' });
  await page.keyboard.press('Escape');
  await page.close();
};

const resultLanguageAndModeFlow = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'es-MX' });
  attachDiagnostics(page, 'results-language-mode');
  await loadExample(page);
  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-analysis-status]')?.getAttribute('data-analysis-status') === 'resolved');
  await page.getByRole('tab', { name: 'Momento', exact: true }).click();
  await page.waitForTimeout(100);
  results.labels.moment = await measureCanvas(page);
  record('momentSmartLabelsPresent', await page.locator('[data-smart-label^="result:"]').count() > 0);
  record('momentEssentialLabelsNoCollision', results.labels.moment.labels.collisions.length === 0);
  record('momentLabelsInsideSafeRect', results.labels.moment.labels.outsideSafe.length === 0);
  await capture(page, 'phase3_after_1440x900_light_complete_analyzed-moment.png', { theme: 'light', mode: 'complete', analysis: 'resolved', result: 'moment' });

  await setLanguage(page, 'en');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Fit model to view' }).click();
  record('englishCanvasChrome', await page.getByRole('button', { name: 'Information layers' }).isVisible() && await page.getByRole('button', { name: 'Analyze', exact: true }).isVisible());
  await capture(page, 'phase3_after_1280x800_light_complete_english-analyzed.png', { theme: 'light', language: 'en', mode: 'complete', analysis: 'resolved' });

  await setLanguage(page, 'es');
  await page.setViewportSize({ width: 1366, height: 768 });
  await setMode(page, 'classroom');
  results.modes.classroom = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return { mode: document.querySelector('.mode-select')?.value, advancedToggle: document.querySelectorAll('.desktop-advanced-toggle').length, visibleTools: [...document.querySelectorAll('.desktop-tool-list [data-tool-id]')].filter(visible).length };
  });
  record('classroomModeApplied', results.modes.classroom.mode === 'classroom' && results.modes.classroom.advancedToggle === 1 && results.modes.classroom.visibleTools < 12);
  await page.locator('.desktop-advanced-toggle').click();
  record('classroomAdvancedRestoresTools', await page.locator('.desktop-tool-list [data-tool-id]:visible').count() === 12);
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, 'dark');
  await page.getByRole('button', { name: 'Ajustar modelo a la vista' }).click();
  await capture(page, 'phase3_after_390x844_dark_aula_analyzed.png', { theme: 'dark', language: 'es', mode: 'classroom', analysis: 'resolved' });
  await page.close();
};

const inputFlow = async (browser) => {
  const reducedContext = await browser.newContext({ viewport: { width: 834, height: 1194 }, reducedMotion: 'reduce', locale: 'es-MX' });
  const reducedPage = await reducedContext.newPage();
  attachDiagnostics(reducedPage, 'reduced-motion');
  await loadExample(reducedPage);
  results.input.reducedMotion = await reducedPage.evaluate(() => ({ matches: matchMedia('(prefers-reduced-motion: reduce)').matches, transition: getComputedStyle(document.querySelector('.member-line')).transitionDuration }));
  record('reducedMotionApplied', results.input.reducedMotion.matches && Number.parseFloat(results.input.reducedMotion.transition) <= 0.0000011);
  await reducedContext.close();

  const touchContext = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
  const touchPage = await touchContext.newPage();
  attachDiagnostics(touchPage, 'touch');
  await loadExample(touchPage);
  const cdp = await touchContext.newCDPSession(touchPage);
  results.input.touchTargets = await touchPage.evaluate(() => ({ member: Number.parseFloat(getComputedStyle(document.querySelector('.member-hit')).strokeWidth), load: Number.parseFloat(getComputedStyle(document.querySelector('.load-hit')).strokeWidth), node: Number.parseFloat(getComputedStyle(document.querySelector('.node-hit')).r) * 2 }));
  record('coarseCanvasTargets44', results.input.touchTargets.member >= 43.5 && results.input.touchTargets.load >= 43.5 && results.input.touchTargets.node >= 43.5);
  const canvasBox = await touchPage.locator('.structural-canvas').boundingBox();
  const gridBefore = await touchPage.locator('.grid-lines line').first().getAttribute('x1');
  const start = { x: canvasBox.x + canvasBox.width * 0.5, y: canvasBox.y + 135 };
  const end = { x: start.x + 42, y: start.y + 28 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 31 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 31 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touchPage.waitForTimeout(100);
  const gridAfter = await touchPage.locator('.grid-lines line').first().getAttribute('x1');
  results.input.touchPan = gridBefore !== gridAfter;
  record('touchOneFingerPan', results.input.touchPan);
  await touchContext.close();

  const penPage = await browser.newPage({ viewport: { width: 1024, height: 768 }, locale: 'es-MX' });
  attachDiagnostics(penPage, 'pen');
  await loadExample(penPage);
  const penCdp = await penPage.context().newCDPSession(penPage);
  const nodeDot = page => page.locator('[data-structure-id="N1"] .node-dot');
  const before = await nodeDot(penPage).boundingBox();
  const cx = before.x + before.width / 2;
  const cy = before.y + before.height / 2;
  await penCdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy, pointerType: 'pen' });
  await penCdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  await penCdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + 28, y: cy - 18, button: 'left', buttons: 1, pointerType: 'pen' });
  await penCdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 28, y: cy - 18, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
  await penPage.waitForTimeout(120);
  const after = await nodeDot(penPage).boundingBox();
  results.input.pen = { movement: Math.hypot(after.x - before.x, after.y - before.y), coordinates: await penPage.locator('.canvas-coordinate-output').textContent() };
  record('penDragParity', results.input.pen.movement >= 20);
  record('penCoordinateReadout', !results.input.pen.coordinates.includes('—'));
  await penPage.keyboard.press('H');
  record('keyboardShortcutH', await penPage.locator('[data-tool-id="pan"]:visible').getAttribute('aria-pressed') === 'true');
  await penPage.close();
};

const zoomFlow = async (browser) => {
  for (const [name, viewport] of Object.entries({ desktop: { width: 683, height: 384 }, tablet: { width: 417, height: 597 } })) {
    const page = await browser.newPage({ viewport, locale: 'es-MX' });
    attachDiagnostics(page, `zoom-${name}`);
    await loadExample(page);
    const metrics = await measureCanvas(page);
    results.zoom200[name] = { physical: name === 'desktop' ? '1366x768 at 200%' : '834x1194 at 200%', metrics };
    record(`zoom200${name}NoOverflow`, metrics.horizontalOverflow === 0);
    record(`zoom200${name}LabelsInside`, metrics.labels.outsideSafe.length === 0);
    record(`zoom200${name}ChromeNoCollision`, metrics.chromeIntersections.length === 0);
    await page.close();
  }
};

const webkitFlow = async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    for (const viewport of [{ width: 430, height: 932 }, { width: 834, height: 1194 }]) {
      const context = await browser.newContext({ viewport, hasTouch: true, locale: 'es-MX' });
      const page = await context.newPage();
      attachDiagnostics(page, `webkit-${viewport.width}`);
      await loadExample(page);
      const member = page.locator('[data-structure-id="M1"]');
      await member.focus();
      await page.keyboard.press('Enter');
      const metrics = await measureCanvas(page);
      const row = { metrics, selected: await member.getAttribute('aria-pressed'), halo: await member.locator('.member-selection-halo').count() };
      results.webkit[`${viewport.width}x${viewport.height}`] = row;
      record(`webkit${viewport.width}NoOverflow`, metrics.horizontalOverflow === 0);
      record(`webkit${viewport.width}LabelsInside`, metrics.labels.outsideSafe.length === 0 && metrics.labels.collisions.length === 0);
      record(`webkit${viewport.width}KeyboardSelection`, row.selected === 'true' && row.halo === 1);
      await capture(page, `phase3_after_webkit_${viewport.width}x${viewport.height}_light_member-selected.png`, { engine: 'webkit', theme: 'light', mode: 'complete', selection: 'member' });
      await context.close();
    }
  } finally {
    await browser.close();
  }
};

let server;
let chrome;
let fatalError;
try {
  server = await preview({ root, preview: { host: '127.0.0.1', port: 4179, strictPort: true }, logLevel: 'error' });
  try {
    chrome = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  } catch {
    chrome = await chromium.launch({ headless: true });
  }
  await runViewportMatrix(chrome);
  await selectionAndLayerFlow(chrome);
  await resultLanguageAndModeFlow(chrome);
  await inputFlow(chrome);
  await zoomFlow(chrome);
  await webkitFlow();
} catch (error) {
  fatalError = error;
  results.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  await chrome?.close();
  await server?.close();
  results.failedChecks = Object.entries(results.checks).filter(([, value]) => !value).map(([name]) => name);
  const manifest = results.screenshots.map((entry) => ({ ...entry, path: `docs/ux-redesign/evidence/phase-03/after/${entry.file}` }));
  fs.writeFileSync(path.join(evidenceDir, 'phase3-after-manifest.json'), JSON.stringify({ generatedAt: results.generatedAt, screenshots: manifest }, null, 2));
  fs.writeFileSync(path.join(evidenceDir, 'phase3-metrics.json'), JSON.stringify(results, null, 2));
}

if (fatalError) throw fatalError;
if (results.failedChecks.length || results.console.length || results.pageErrors.length) {
  throw new Error(`QA Fase 3 fallida: ${[...results.failedChecks, ...results.console, ...results.pageErrors].join('; ')}`);
}

console.log(JSON.stringify({
  checks: Object.keys(results.checks).length,
  matrixRows: results.matrix.length,
  screenshots: results.screenshots.length,
  failedChecks: results.failedChecks,
  console: results.console,
  pageErrors: results.pageErrors,
  output: path.relative(root, path.join(evidenceDir, 'phase3-metrics.json')),
}, null, 2));
