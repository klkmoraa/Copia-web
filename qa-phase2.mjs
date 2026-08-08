import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.join(root, 'docs', 'ux-redesign', 'evidence', 'phase-02', 'after');
fs.mkdirSync(evidenceDir, { recursive: true });

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
const longProjectName = 'Pórtico de ejemplo - combinación sísmica extraordinaria 2026';
const results = {
  generatedAt: new Date().toISOString(),
  scope: 'Phase 2 UI-only geometric and accessibility verification',
  checks: {},
  matrix: { es: [], en: [] },
  themes: {},
  zoom200: {},
  states: {},
  accessibility: {},
  console: [],
  pageErrors: [],
};

const record = (name, value) => {
  results.checks[name] = Boolean(value);
};

const attachDiagnostics = (page, prefix = 'main') => {
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      results.console.push(`${prefix} ${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => results.pageErrors.push(`${prefix}: ${String(error)}`));
};

const loadExample = async (page) => {
  await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Pórtico de ejemplo Pórtico de 6/i }).click();
  await page.locator('.topbar').waitFor({ state: 'visible' });
  await page.waitForTimeout(450);
};

const measureTopbar = async (page) => page.evaluate(() => {
  const header = document.querySelector('.topbar');
  const headerRect = header.getBoundingClientRect();
  const controls = [...header.querySelectorAll('button,input,select,.analysis-status:not(button)')]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent.trim(),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });
  const intersections = [];
  for (let leftIndex = 0; leftIndex < controls.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < controls.length; rightIndex += 1) {
      const left = controls[leftIndex];
      const right = controls[rightIndex];
      if (
        left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y
      ) intersections.push([left.label, right.label]);
    }
  }
  const outside = controls.filter((control) => (
    control.x < headerRect.x - 0.5
    || control.y < headerRect.y - 0.5
    || control.x + control.width > headerRect.right + 0.5
    || control.y + control.height > headerRect.bottom + 0.5
  )).map((control) => control.label);
  const touchTargets = [...document.querySelectorAll([
    '.topbar button',
    '.topbar input',
    '.topbar select',
    '.canvas-controls button',
    '.mobile-inspector-toggle',
  ].join(','))].filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }).map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      label: element.getAttribute('aria-label') || element.textContent.trim(),
      width: rect.width,
      height: rect.height,
    };
  });
  return {
    viewport: { width: innerWidth, height: innerHeight },
    intersections,
    outside,
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    analyzeVisible: controls.some((control) => /^(Analizar|Analyze)$/.test(control.label)),
    moreVisible: controls.some((control) => /^(Más acciones|More actions)$/.test(control.label)),
    status: document.querySelector('[data-analysis-status]')?.getAttribute('data-analysis-status'),
    touchTargets,
  };
});

const assertMatrixRow = (row, key) => {
  record(`${key}NoIntersections`, row.intersections.length === 0);
  record(`${key}ControlsInsideHeader`, row.outside.length === 0);
  record(`${key}NoHorizontalOverflow`, row.horizontalOverflow === 0);
  record(`${key}AnalyzeVisible`, row.analyzeVisible);
  record(`${key}MoreVisible`, row.moreVisible);
  if (row.viewport.width <= 834) {
    record(`${key}TouchTargets44`, row.touchTargets.every((target) => target.width >= 43.5 && target.height >= 43.5));
  }
};

const runMatrix = async (page, language) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(180);
    const row = await measureTopbar(page);
    results.matrix[language].push(row);
    assertMatrixRow(row, `${language}${viewport.width}x${viewport.height}`);
  }
};

const testOverflow = async (page, viewport, language) => {
  await page.setViewportSize(viewport);
  const moreName = language === 'es' ? 'Más acciones' : 'More actions';
  const more = page.getByRole('button', { name: moreName });
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.locator('.utility-actions-menu');
  await menu.waitFor({ state: 'visible' });
  await page.waitForTimeout(60);
  const metrics = await page.evaluate(() => {
    const rect = document.querySelector('.utility-actions-menu').getBoundingClientRect();
    const active = document.activeElement;
    const style = getComputedStyle(active);
    return {
      inside: rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= innerWidth + 0.5 && rect.bottom <= innerHeight + 0.5,
      activeTag: active.tagName,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
    };
  });
  await page.keyboard.press('Escape');
  const focusReturned = await more.evaluate((element) => document.activeElement === element);
  record(`${language}Overflow${viewport.width}InsideViewport`, metrics.inside);
  record(`${language}Overflow${viewport.width}FocusVisible`, metrics.outlineWidth >= 2.9 && metrics.outlineStyle !== 'none');
  record(`${language}Overflow${viewport.width}EscapeReturnsFocus`, focusReturned);
  return metrics;
};

const parseColor = (value) => {
  const numbers = value.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  if (value.startsWith('#')) {
    const source = value.slice(1);
    const hex = source.length === 3 ? [...source].map((character) => character.repeat(2)).join('') : source;
    return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  }
  if (value.startsWith('color(')) return numbers.slice(-3);
  return numbers.slice(0, 3).map((channel) => channel / 255);
};

const luminance = (color) => parseColor(color)
  .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrast = (foreground, background) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const measureTheme = async (page) => page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const status = getComputedStyle(document.querySelector('.analysis-status'));
  const analyze = getComputedStyle(document.querySelector('.analyze-button'));
  const sample = (state) => {
    const element = document.createElement('div');
    element.className = `analysis-status is-${state}`;
    element.textContent = state;
    element.style.position = 'fixed';
    element.style.left = '-10000px';
    document.body.append(element);
    const style = getComputedStyle(element);
    const output = { color: style.color, background: style.backgroundColor };
    element.remove();
    return output;
  };
  return {
    theme: document.documentElement.dataset.theme,
    app: root.getPropertyValue('--sc-color-bg-app').trim(),
    surface: root.getPropertyValue('--sc-color-surface-1').trim(),
    text: root.getPropertyValue('--sc-color-text-primary').trim(),
    secondary: root.getPropertyValue('--sc-color-text-secondary').trim(),
    status: { color: status.color, background: status.backgroundColor },
    analyze: { color: analyze.color, background: analyze.backgroundColor },
    warning: sample('warning'),
    error: sample('error'),
  };
});

const addContrastChecks = (theme) => {
  const metrics = results.themes[theme];
  metrics.contrast = {
    primaryOnSurface: contrast(metrics.text, metrics.surface),
    secondaryOnSurface: contrast(metrics.secondary, metrics.surface),
    status: contrast(metrics.status.color, metrics.status.background),
    analyze: contrast(metrics.analyze.color, metrics.analyze.background),
    warning: contrast(metrics.warning.color, metrics.warning.background),
    error: contrast(metrics.error.color, metrics.error.background),
  };
  for (const [name, ratio] of Object.entries(metrics.contrast)) record(`${theme}Contrast${name}`, ratio >= 4.5);
};

const mainFlow = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, locale: 'es-MX' });
  attachDiagnostics(page);
  await loadExample(page);

  const projectName = page.getByRole('textbox', { name: 'Nombre del proyecto' });
  await projectName.fill(longProjectName);
  await projectName.press('Enter');
  record('longProjectNameCommitted', await projectName.inputValue() === longProjectName);

  results.themes.light = await measureTheme(page);
  addContrastChecks('light');
  await page.getByRole('button', { name: 'Más acciones' }).click();
  await page.getByRole('button', { name: 'Tema oscuro' }).click();
  await page.waitForTimeout(280);
  results.themes.dark = await measureTheme(page);
  addContrastChecks('dark');
  await page.getByRole('button', { name: 'Más acciones' }).click();
  await page.getByRole('button', { name: 'Tema claro' }).click();
  await page.waitForTimeout(280);

  await runMatrix(page, 'es');
  await testOverflow(page, { width: 1194, height: 834 }, 'es');
  await testOverflow(page, { width: 390, height: 844 }, 'es');

  await page.setViewportSize({ width: 1536, height: 960 });
  await page.getByRole('button', { name: 'Más acciones' }).click();
  await page.getByLabel('Idioma').selectOption('en');
  await page.keyboard.press('Escape');
  record('languageEnglishApplied', await page.getByRole('button', { name: 'Analyze', exact: true }).isVisible());
  for (const viewport of viewports.filter(({ width }) => [390, 1194, 1280, 1366, 1536].includes(width))) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(180);
    const row = await measureTopbar(page);
    results.matrix.en.push(row);
    assertMatrixRow(row, `en${viewport.width}x${viewport.height}`);
  }
  await testOverflow(page, { width: 390, height: 844 }, 'en');

  await page.setViewportSize({ width: 1536, height: 960 });
  results.states.initial = await page.locator('[data-analysis-status]').getAttribute('data-analysis-status');
  const loading = await page.evaluate(() => new Promise((resolve, reject) => {
    const button = document.querySelector('.analyze-button');
    const initialWidth = button.getBoundingClientRect().width;
    const timeout = window.setTimeout(() => reject(new Error('No se observó aria-busy=true.')), 2500);
    const observer = new MutationObserver(() => {
      if (button.getAttribute('aria-busy') !== 'true') return;
      window.clearTimeout(timeout);
      observer.disconnect();
      resolve({
        initialWidth,
        loadingWidth: button.getBoundingClientRect().width,
        status: document.querySelector('[data-analysis-status]').getAttribute('data-analysis-status'),
      });
    });
    observer.observe(button, { attributes: true, attributeFilter: ['aria-busy'] });
    button.click();
  }));
  results.states.loading = loading;
  await page.waitForFunction(() => document.querySelector('.analyze-button')?.getAttribute('aria-busy') === 'false');
  await page.waitForFunction(() => document.querySelector('[data-analysis-status]')?.getAttribute('data-analysis-status') === 'resolved');
  results.states.resolved = await page.locator('[data-analysis-status]').getAttribute('data-analysis-status');
  record('statusReady', results.states.initial === 'ready');
  record('statusCalculating', loading.status === 'calculating');
  record('analyzeWidthStableDuringLoading', Math.abs(loading.initialWidth - loading.loadingWidth) < 0.6);
  record('statusResolved', results.states.resolved === 'resolved');

  await page.getByRole('combobox', { name: 'Load case or combination', exact: true }).selectOption({ label: 'Servicio' });
  results.states.stale = await page.locator('[data-analysis-status]').getAttribute('data-analysis-status');
  record('statusStale', results.states.stale === 'stale');

  results.accessibility.minimumCriticalText = await page.evaluate(() => {
    const selectors = [
      '.topbar', '.canvas-status', '.canvas-mode-badge', '.results-panel', '.inspector-panel',
      '.quick-entry-bar', '.import-center-dialog', '.structural-canvas text',
    ];
    const nodes = [...document.querySelectorAll(selectors.join(','))]
      .flatMap((root) => [root, ...root.querySelectorAll('*')])
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
          && element.childElementCount === 0 && element.textContent.trim().length > 0;
      })
      .map((element) => ({ text: element.textContent.trim().slice(0, 60), size: Number.parseFloat(getComputedStyle(element).fontSize) }));
    return {
      minimum: Math.min(...nodes.map((node) => node.size)),
      below12: nodes.filter((node) => node.size < 11.95),
    };
  });
  record('criticalTextAtLeast12', results.accessibility.minimumCriticalText.below12.length === 0);

  await page.setViewportSize({ width: 430, height: 932 });
  await page.getByRole('button', { name: 'Open projects and examples' }).click();
  await page.getByRole('menuitem', { name: 'New project' }).click();
  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-analysis-status]')?.getAttribute('data-analysis-status') === 'error');
  results.states.error = await page.locator('[data-analysis-status]').getAttribute('data-analysis-status');
  const mobileToggle = page.locator('.results-mobile-toggle');
  if (await mobileToggle.getAttribute('aria-expanded') === 'true') await mobileToggle.click();
  const collapsedBefore = await page.locator('.results-panel').evaluate((panel) => panel.classList.contains('mobile-collapsed'));
  await page.locator('[data-analysis-status] button').click();
  const errorNavigation = await page.evaluate(() => ({
    expanded: !document.querySelector('.results-panel').classList.contains('mobile-collapsed'),
    selected: document.querySelector('.result-tabs [aria-selected="true"]')?.getAttribute('data-result-tab'),
  }));
  results.states.errorNavigation = { collapsedBefore, ...errorNavigation };
  record('statusError', results.states.error === 'error');
  record('errorStatusExpandsResults', collapsedBefore && errorNavigation.expanded);
  record('errorStatusOpensIssues', errorNavigation.selected === 'issues');
  await page.close();
};

const testReducedMotion = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce', locale: 'es-MX' });
  const page = await context.newPage();
  attachDiagnostics(page, 'reduced-motion');
  await loadExample(page);
  const metric = await page.evaluate(() => {
    const spinner = document.createElement('span');
    spinner.className = 'spin';
    document.body.append(spinner);
    const style = getComputedStyle(spinner);
    const output = { mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches, animationName: style.animationName };
    spinner.remove();
    return output;
  });
  results.accessibility.reducedMotion = metric;
  record('reducedMotionMediaApplied', metric.mediaMatches);
  record('reducedMotionDisablesSpinner', metric.animationName === 'none');
  await context.close();
};

const captureLoadingEvidence = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, locale: 'es-MX' });
  attachDiagnostics(page, 'loading-evidence');
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class DelayedResultWorker {
      constructor(...args) {
        this.nativeWorker = new NativeWorker(...args);
        this.messageHandler = null;
        this.errorHandler = null;
        this.nativeWorker.onmessage = (event) => {
          window.setTimeout(() => this.messageHandler?.call(this, event), 1200);
        };
        this.nativeWorker.onerror = (event) => this.errorHandler?.call(this, event);
      }
      set onmessage(handler) { this.messageHandler = handler; }
      get onmessage() { return this.messageHandler; }
      set onerror(handler) { this.errorHandler = handler; }
      get onerror() { return this.errorHandler; }
      postMessage(...args) { return this.nativeWorker.postMessage(...args); }
      terminate() { return this.nativeWorker.terminate(); }
    };
  });
  await loadExample(page);
  const observed = await page.evaluate(() => new Promise((resolve, reject) => {
    const button = document.querySelector('.analyze-button');
    const timeout = window.setTimeout(() => reject(new Error('No se observó el estado loading para la captura.')), 2500);
    const observer = new MutationObserver(() => {
      if (button.getAttribute('aria-busy') !== 'true') return;
      window.clearTimeout(timeout);
      observer.disconnect();
      resolve({
        status: document.querySelector('[data-analysis-status]').getAttribute('data-analysis-status'),
        width: button.getBoundingClientRect().width,
      });
    });
    observer.observe(button, { attributes: true, attributeFilter: ['aria-busy'] });
    button.click();
  }));
  await page.screenshot({ path: path.join(evidenceDir, 'after-loading-analysis-1366x768.png'), fullPage: false });
  const afterScreenshot = await page.evaluate(() => ({
    status: document.querySelector('[data-analysis-status]').getAttribute('data-analysis-status'),
    busy: document.querySelector('.analyze-button').getAttribute('aria-busy'),
  }));
  results.states.loadingEvidence = { observed, afterScreenshot, delayMs: 1200 };
  record('loadingEvidenceCapturedWhileBusy', observed.status === 'calculating' && afterScreenshot.status === 'calculating' && afterScreenshot.busy === 'true');
  await page.waitForFunction(() => document.querySelector('.analyze-button')?.getAttribute('aria-busy') === 'false');
  await page.close();
};

const testZoom200 = async (browser) => {
  const effectiveViewports = {
    desktop1366x768: { width: 683, height: 384, physical: '1366x768 at 200%' },
    tablet834x1194: { width: 417, height: 597, physical: '834x1194 at 200%' },
  };
  for (const [name, viewport] of Object.entries(effectiveViewports)) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, locale: 'es-MX' });
    attachDiagnostics(page, `zoom-${name}`);
    await loadExample(page);
    const metric = await measureTopbar(page);
    results.zoom200[name] = { ...metric, physical: viewport.physical, method: 'effective CSS viewport' };
    record(`zoom200${name}NoIntersections`, metric.intersections.length === 0);
    record(`zoom200${name}InsideHeader`, metric.outside.length === 0);
    record(`zoom200${name}NoHorizontalOverflow`, metric.horizontalOverflow === 0);
    record(`zoom200${name}PrimaryActionsVisible`, metric.analyzeVisible && metric.moreVisible);
    await page.close();
  }
};

let server;
let browser;
let fatalError;
try {
  server = await preview({ root, preview: { host: '127.0.0.1', port: 4178, strictPort: true }, logLevel: 'error' });
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  await mainFlow(browser);
  await captureLoadingEvidence(browser);
  await testReducedMotion(browser);
  await testZoom200(browser);
} catch (error) {
  fatalError = error;
  results.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  await browser?.close();
  await server?.close();
  results.failedChecks = Object.entries(results.checks).filter(([, passed]) => !passed).map(([name]) => name);
  fs.writeFileSync(path.join(evidenceDir, 'phase2-metrics.json'), JSON.stringify(results, null, 2));
}

if (fatalError) throw fatalError;
if (results.failedChecks.length || results.console.length || results.pageErrors.length) {
  throw new Error(`QA Fase 2 fallida: ${[
    ...results.failedChecks,
    ...results.console,
    ...results.pageErrors,
  ].join(', ')}`);
}

console.log(JSON.stringify({
  checks: Object.keys(results.checks).length,
  matrixRows: results.matrix.es.length + results.matrix.en.length,
  failedChecks: results.failedChecks,
  console: results.console,
  pageErrors: results.pageErrors,
  output: path.relative(root, path.join(evidenceDir, 'phase2-metrics.json')),
}, null, 2));
