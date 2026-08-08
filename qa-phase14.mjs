import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(root, 'dist', 'assets');
const evidenceDir = path.join(root, 'docs', 'ux-redesign', 'evidence', 'phase-14', 'after');
fs.mkdirSync(evidenceDir, { recursive: true });

if (!fs.existsSync(assetsDir)) {
  throw new Error('No se encontró dist/assets. Ejecuta npm run build antes de node qa-phase14.mjs.');
}

const output = {
  phase: 14,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    headless: true,
    previewPort: 4184,
  },
  browsers: {},
  criticalFlows: {},
  runtime: {
    samples: [],
    summary: {},
  },
  screenshots: [],
  console: [],
  pageErrors: [],
  failures: [],
};

const baseURL = 'http://127.0.0.1:4184/';
const smokeMode = process.env.PHASE14_SMOKE === '1';
const browserFilter = process.env.PHASE14_BROWSER ?? '';
const viewportFilter = process.env.PHASE14_VIEWPORT ?? '';
const flowFilter = process.env.PHASE14_FLOW ?? '';
const progress = (scope, step) => {
  console.log(`[phase14][${new Date().toISOString()}][${scope}] ${step}`);
};
const matrix = {
  chromium: [
    { id: 'desktop', width: 1536, height: 960, touch: false, theme: 'light', extended: true },
    { id: 'tablet', width: 834, height: 1194, touch: true, theme: 'dark' },
    { id: 'mobile', width: 390, height: 844, touch: true, theme: 'light' },
    { id: 'mobile-landscape', width: 683, height: 384, touch: true, theme: 'light' },
  ],
  webkit: [
    { id: 'desktop', width: 1366, height: 768, touch: false, theme: 'dark' },
    { id: 'tablet', width: 834, height: 1194, touch: true, theme: 'light' },
    { id: 'mobile', width: 390, height: 844, touch: true, theme: 'dark' },
    { id: 'mobile-landscape', width: 683, height: 384, touch: true, theme: 'dark' },
  ],
};

const technicalFingerprint = (project) => JSON.stringify({
  schemaVersion: project.schemaVersion,
  nodes: project.nodes,
  members: project.members,
  loadCases: project.loadCases,
  combinations: project.combinations,
  nodalLoads: project.nodalLoads,
  memberLoads: project.memberLoads,
});

const fail = (scope, name, detail = '') => {
  const message = detail ? `${scope}.${name}: ${detail}` : `${scope}.${name}`;
  output.failures.push(message);
};

const check = (row, scope, name, condition, detail = '') => {
  row.checks[name] = Boolean(condition);
  if (!condition) fail(scope, name, detail);
};

const isInsideViewport = (box, spec, tolerance = 1) => Boolean(box)
  && box.x >= -tolerance
  && box.y >= -tolerance
  && box.x + box.width <= spec.width + tolerance
  && box.y + box.height <= spec.height + tolerance;

const waitForResolvedAnalysis = (page) => page.waitForFunction(
  () => document.querySelector('[data-analysis-status]')?.getAttribute('data-analysis-status') === 'resolved',
  null,
  { timeout: 20_000 },
);

const readStoredProject = async (page) => {
  const stored = await page.evaluate(() => localStorage.getItem('structureCo.project'));
  if (!stored) throw new Error('No se encontró el proyecto persistido.');
  return JSON.parse(stored);
};

const collectRuntimeMetrics = (page) => page.evaluate(() => {
  const resources = performance.getEntriesByType('resource');
  const perf = globalThis.__structureCoPhase14Performance ?? {
    longTaskSupported: false,
    longTasks: [],
  };
  return {
    navigation: performance.getEntriesByType('navigation').map((entry) => ({
      duration: Math.round(entry.duration * 100) / 100,
      domContentLoaded: Math.round(entry.domContentLoadedEventEnd * 100) / 100,
      loadEvent: Math.round(entry.loadEventEnd * 100) / 100,
      transferSize: entry.transferSize,
      decodedBodySize: entry.decodedBodySize,
    })),
    resourceCount: resources.length,
    transferSize: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    decodedBodySize: resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
    longTaskSupported: perf.longTaskSupported,
    longTaskCount: perf.longTasks.length,
    longTaskTotalMs: Math.round(perf.longTasks.reduce((sum, duration) => sum + duration, 0) * 100) / 100,
    longestTaskMs: Math.round(Math.max(0, ...perf.longTasks) * 100) / 100,
  };
});

const markFocusBoundaries = async (surface) => surface.evaluate((element) => {
  const selector = [
    'button:not(:disabled)',
    '[href]',
    'input:not(:disabled)',
    'select:not(:disabled)',
    'textarea:not(:disabled)',
    'summary',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const candidates = [...element.querySelectorAll(selector)].filter((candidate) => {
    if (!(candidate instanceof HTMLElement)) return false;
    if (candidate.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
    const closedDetails = candidate.closest('details:not([open])');
    if (closedDetails && candidate.tagName !== 'SUMMARY') return false;
    const style = getComputedStyle(candidate);
    const rect = candidate.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && rect.width > 0
      && rect.height > 0;
  });
  candidates.forEach((candidate) => candidate.removeAttribute('data-phase14-focus-boundary'));
  candidates[0]?.setAttribute('data-phase14-focus-boundary', 'first');
  candidates.at(-1)?.setAttribute('data-phase14-focus-boundary', 'last');
  return candidates.length;
});

const verifyFocusTrap = async (page, surface) => {
  const count = await markFocusBoundaries(surface);
  if (count < 1) return { count, backwardWrap: false, forwardWrap: false };
  const first = surface.locator('[data-phase14-focus-boundary="first"]');
  const last = surface.locator('[data-phase14-focus-boundary="last"]');
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  const backwardWrap = await surface.evaluate((element) => element.contains(document.activeElement));
  await last.focus();
  await page.keyboard.press('Tab');
  const forwardWrap = await surface.evaluate((element) => element.contains(document.activeElement));
  await surface.evaluate((element) => {
    element.querySelectorAll('[data-phase14-focus-boundary]').forEach((candidate) => {
      candidate.removeAttribute('data-phase14-focus-boundary');
    });
  });
  return { count, backwardWrap, forwardWrap };
};

const attachDiagnostics = (page, scope, row) => {
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return;
    const value = `${scope}: ${message.type()}: ${message.text()}`;
    row.console.push(value);
    output.console.push(value);
  });
  page.on('pageerror', (error) => {
    const value = `${scope}: ${String(error)}`;
    row.pageErrors.push(value);
    output.pageErrors.push(value);
  });
};

const addPerformanceObserver = (page) => page.addInitScript(() => {
  const state = {
    longTaskSupported: false,
    longTasks: [],
  };
  globalThis.__structureCoPhase14Performance = state;
  try {
    const observer = new PerformanceObserver((list) => {
      state.longTasks.push(...list.getEntries().map((entry) => entry.duration));
    });
    observer.observe({ type: 'longtask', buffered: true });
    state.longTaskSupported = true;
  } catch {
    state.longTaskSupported = false;
  }
});

const openExampleWorkspace = async (browser, browserName, spec, scope) => {
  progress(scope, 'creating context');
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    hasTouch: spec.touch,
    isMobile: spec.width <= 700,
    colorScheme: spec.theme,
    locale: 'es-MX',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(15_000);
  const row = {
    viewport: `${spec.width}x${spec.height}`,
    touch: spec.touch,
    theme: spec.theme,
    checks: {},
    timings: {},
    resources: {},
    requestedAssets: [],
    console: [],
    pageErrors: [],
  };
  attachDiagnostics(page, scope, row);
  await addPerformanceObserver(page);
  const requestedAssets = new Set();
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes('/assets/')) requestedAssets.add(path.basename(pathname));
  });

  const navigationStarted = performance.now();
  progress(scope, 'opening clean welcome');
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate((theme) => {
    localStorage.clear();
    localStorage.setItem('structureCo.theme', theme);
  }, spec.theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  row.timings.cleanStartupMs = Math.round((performance.now() - navigationStarted) * 100) / 100;

  const workspaceStarted = performance.now();
  progress(scope, 'activating example workspace');
  await page.locator('.welcome-example-card').first().click();
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 10_000 });
  row.timings.workspaceActivationMs = Math.round((performance.now() - workspaceStarted) * 100) / 100;
  row.requestedAssets = [...requestedAssets].sort();
  check(row, scope, 'themeApplied', await page.locator('html').getAttribute('data-theme') === spec.theme);
  check(row, scope, 'canvasVisible', await page.locator('svg.structural-canvas').isVisible());
  check(
    row,
    scope,
    'workspaceActivatedWithin10s',
    row.timings.workspaceActivationMs < 10_000,
    `${row.timings.workspaceActivationMs}ms`,
  );
  progress(scope, 'workspace ready');

  return {
    context,
    page,
    row,
    requestedAssets,
  };
};

const selectMember = async (page, { multi = false } = {}) => {
  const members = page.locator('.member-object');
  const first = members.first();
  await first.waitFor({ state: 'attached' });
  await first.evaluate((element) => element.focus());
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('.member-object')?.getAttribute('aria-pressed') === 'true',
  );
  if (multi && await members.count() > 1) {
    await members.nth(1).evaluate((element) => {
      element.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        shiftKey: true,
      }));
    });
    await page.waitForFunction(() => document.querySelectorAll('.member-object.selected').length >= 2);
  }
  return page.locator('.member-object.selected').count();
};

const exerciseResults = async (page, row, scope, spec, browserName, requestedAssets) => {
  progress(scope, 'checking selection');
  const selectedCount = await selectMember(page, { multi: spec.width >= 1024 });
  check(row, scope, 'selectionWorks', selectedCount >= 1);
  if (spec.width >= 1024) {
    check(row, scope, 'multiSelectionWorks', selectedCount >= 2, `selected=${selectedCount}`);
    await page.locator('.member-object').first().evaluate((element) => {
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    });
  }

  const analysisStarted = performance.now();
  const analyzeButton = page.getByRole('button', { name: 'Analizar', exact: true });
  progress(scope, 'running analysis');
  await analyzeButton.click();
  await waitForResolvedAnalysis(page);
  row.timings.analysisMs = Math.round((performance.now() - analysisStarted) * 100) / 100;
  check(row, scope, 'analysisResolved', true);
  check(row, scope, 'analysisWorkerRequested', [...requestedAssets].some((file) => /^analysis\.worker-.*\.js$/.test(file)));
  check(row, scope, 'analysisCompletedWithin20s', row.timings.analysisMs < 20_000, `${row.timings.analysisMs}ms`);
  progress(scope, `analysis resolved in ${row.timings.analysisMs}ms`);

  const resultPanel = page.locator('.results-panel');
  if (spec.width < 1024) {
    const phoneResults = spec.width <= 700;
    const resultToggle = page.locator('.results-mobile-toggle');
    if (await resultPanel.evaluate((element) => element.classList.contains('mobile-collapsed'))) {
      await resultToggle.focus();
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('structureco:expand-mobile-results'));
      });
    }
    const expandedResults = page.locator('.results-panel:not(.mobile-collapsed)');
    await expandedResults.waitFor({ state: 'visible' });
    if (phoneResults) {
      check(
        row,
        scope,
        'resultsModelessSemantics',
        await expandedResults.getAttribute('role') !== 'dialog'
          && await expandedResults.getAttribute('aria-modal') === null,
      );
      check(row, scope, 'resultsCanvasInteractive', await expandedResults.getAttribute('data-canvas-interactive') === 'true');
      check(row, scope, 'resultsDoNotBlockCanvas', await page.evaluate(() => {
        const canvas = document.querySelector('.canvas-host');
        return canvas?.inert !== true
          && !canvas?.hasAttribute('aria-hidden')
          && !document.querySelector('.results-sheet-backdrop');
      }));
      await page.waitForFunction(
        () => document.querySelector('.results-panel[data-canvas-fit-settled="true"]'),
        null,
        { timeout: 2_000 },
      );
      const compactDensity = await page.evaluate(() => {
        const mode = document.querySelector('.canvas-mode-badge');
        const gesture = document.querySelector('.touch-gesture-hint');
        const context = document.querySelector('.results-commandbar');
        const tabs = document.querySelector('.result-tabs');
        const panel = document.querySelector('.results-panel:not(.mobile-collapsed)');
        const legend = document.querySelector('.canvas-result-legend');
        const rect = (element) => element?.getBoundingClientRect();
        return {
          modeHeight: rect(mode)?.height ?? Infinity,
          gestureVisible: Boolean(gesture
            && (rect(gesture)?.width ?? 0) > 2
            && (rect(gesture)?.height ?? 0) > 2
            && getComputedStyle(gesture).visibility !== 'hidden'),
          contextWidth: rect(context)?.width ?? Infinity,
          tabsHeight: rect(tabs)?.height ?? Infinity,
          panelHeight: rect(panel)?.height ?? Infinity,
          panelWidth: rect(panel)?.width ?? Infinity,
          legendHeight: rect(legend)?.height ?? 0,
        };
      });
      check(row, scope, 'compactModeBadge', compactDensity.modeHeight <= 40 && !compactDensity.gestureVisible, JSON.stringify(compactDensity));
      check(row, scope, 'compactResultContext', compactDensity.contextWidth <= 2, JSON.stringify(compactDensity));
      check(row, scope, 'compactResultTabs', compactDensity.tabsHeight <= 48, JSON.stringify(compactDensity));
      check(
        row,
        scope,
        'compactResultPanel',
        spec.width > spec.height
          ? compactDensity.panelWidth <= spec.width * 0.44 + 1
          : compactDensity.panelHeight <= spec.height * 0.43,
        JSON.stringify(compactDensity),
      );
      check(row, scope, 'compactResultLegend', compactDensity.legendHeight === 0 || compactDensity.legendHeight <= 44, JSON.stringify(compactDensity));
      const commandbar = page.locator('.results-commandbar');
      const commandbarDisplayNone = await commandbar.evaluate((element) => getComputedStyle(element).display === 'none');
      await resultToggle.focus();
      await page.keyboard.press('Tab');
      const commandbarSkipsFocus = await page.evaluate(() => {
        const context = document.querySelector('.results-commandbar');
        return Boolean(context && !context.contains(document.activeElement));
      });
      check(
        row,
        scope,
        'compactResultContextUntabbable',
        commandbarDisplayNone && commandbarSkipsFocus,
        JSON.stringify({ commandbarDisplayNone, commandbarSkipsFocus }),
      );
    } else {
      await page.waitForFunction(() => document.querySelector('.results-panel[role="dialog"]')?.contains(document.activeElement));
      const resultTrap = await verifyFocusTrap(page, expandedResults);
      check(row, scope, 'resultsDialogSemantics', await expandedResults.getAttribute('aria-modal') === 'true');
      check(row, scope, 'resultsFocusTrapBackward', resultTrap.backwardWrap, `focusables=${resultTrap.count}`);
      check(row, scope, 'resultsFocusTrapForward', resultTrap.forwardWrap, `focusables=${resultTrap.count}`);
    }
    const resultBox = await expandedResults.boundingBox();
    check(row, scope, 'resultsWithinViewport', isInsideViewport(resultBox, spec));
    const resultLayout = await page.evaluate(() => {
      const panel = document.querySelector('.results-panel:not(.mobile-collapsed)')?.getBoundingClientRect();
      const canvas = document.querySelector('.canvas-host')?.getBoundingClientRect();
      if (!panel || !canvas) return null;
      const exposedTop = Math.max(0, canvas.top);
      const exposedBottom = Math.min(innerHeight, canvas.bottom);
      const separated = panel.right <= canvas.left + 1
        || panel.left >= canvas.right - 1
        || panel.bottom <= canvas.top + 1
        || panel.top >= canvas.bottom - 1;
      return {
        panelHeight: panel.height,
        exposedCanvasHeight: Math.max(0, exposedBottom - exposedTop),
        canvasWidth: canvas.width,
        panelWidth: panel.width,
        reservedCanvasSpace: separated && (
          Math.abs(canvas.bottom - panel.top) <= 2
          || Math.abs(canvas.right - panel.left) <= 2
        ),
        nodeCount: document.querySelectorAll('.node-object').length,
        fullyVisibleNodeCount: [...document.querySelectorAll('.node-object')]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left >= canvas.left
              && rect.right <= canvas.right
              && rect.top >= exposedTop
              && rect.bottom <= exposedBottom;
          }).length,
        visibleModelObjectCount: [...document.querySelectorAll('.member-object, .node-object')]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0
              && rect.height > 0
              && rect.right > canvas.left
              && rect.left < canvas.right
              && rect.bottom > exposedTop
              && rect.top < exposedBottom;
          }).length,
      };
    });
    row.mobileCanvasMetrics = resultLayout;
    check(
      row,
      scope,
      'resultsLeaveModelVisible',
      Boolean(resultLayout && resultLayout.exposedCanvasHeight >= Math.min(180, spec.height * 0.24)),
      JSON.stringify(resultLayout),
    );
    check(
      row,
      scope,
      'resultsShowModelGeometry',
      Boolean(resultLayout && resultLayout.visibleModelObjectCount > 0),
      JSON.stringify(resultLayout),
    );
    if (spec.width <= 700) {
      check(
        row,
        scope,
        'resultsUsePartialMobileSheet',
        Boolean(resultLayout && resultLayout.panelHeight < spec.height * 0.75),
        JSON.stringify(resultLayout),
      );
      check(row, scope, 'resultsReserveCanvasSpace', Boolean(resultLayout?.reservedCanvasSpace), JSON.stringify(resultLayout));
      check(
        row,
        scope,
        'resultsAutoFitShowsEveryNode',
        Boolean(resultLayout
          && resultLayout.nodeCount > 0
          && resultLayout.fullyVisibleNodeCount === resultLayout.nodeCount),
        JSON.stringify(resultLayout),
      );
      const fitControl = page.getByRole('button', { name: 'Ajustar modelo a la vista' });
      const fitBox = await fitControl.boundingBox();
      check(
        row,
        scope,
        'canvasFitControlReachable',
        Boolean(fitBox && resultBox && (
          fitBox.y + fitBox.height <= resultBox.y + 1
          || fitBox.x + fitBox.width <= resultBox.x + 1
        )),
      );
      await fitControl.click();
      await page.waitForTimeout(120);
      const pinchMetrics = await page.evaluate(async () => {
        const svg = document.querySelector('svg.structural-canvas');
        const nodes = [...document.querySelectorAll('.node-object')];
        if (!svg || nodes.length < 2) return null;
        const centerOf = (element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        };
        const distanceBetweenNodes = () => {
          const first = centerOf(nodes[0]);
          const second = centerOf(nodes[1]);
          return Math.hypot(second.x - first.x, second.y - first.y);
        };
        const selectedIds = () => [...document.querySelectorAll('.member-object.selected, .node-object.selected')]
          .map((element) => element.getAttribute('data-structure-id'))
          .filter(Boolean)
          .sort()
          .join(',');
        const canvas = svg.getBoundingClientRect();
        const midpoint = {
          x: canvas.left + canvas.width * 0.5,
          y: canvas.top + canvas.height * 0.52,
        };
        const emit = (type, pointerId, isPrimary, x, y, buttons) => svg.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'touch',
          isPrimary,
          button: 0,
          buttons,
          clientX: x,
          clientY: y,
        }));
        const beforeDistance = distanceBetweenNodes();
        const selectionBefore = selectedIds();
        emit('pointerdown', 51, true, midpoint.x - 42, midpoint.y, 1);
        emit('pointerdown', 52, false, midpoint.x + 42, midpoint.y, 1);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        emit('pointermove', 51, true, midpoint.x - 82, midpoint.y, 1);
        emit('pointermove', 52, false, midpoint.x + 82, midpoint.y, 1);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        emit('pointerup', 52, false, midpoint.x + 82, midpoint.y, 0);
        emit('pointerup', 51, true, midpoint.x - 82, midpoint.y, 0);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          beforeDistance,
          afterDistance: distanceBetweenNodes(),
          selectionBefore,
          selectionAfter: selectedIds(),
        };
      });
      row.pinchMetrics = pinchMetrics;
      check(
        row,
        scope,
        'canvasPinchChangesScale',
        Boolean(pinchMetrics
          && pinchMetrics.beforeDistance > 0
          && pinchMetrics.afterDistance >= pinchMetrics.beforeDistance * 1.25),
        JSON.stringify(pinchMetrics),
      );
      check(
        row,
        scope,
        'canvasPinchPreservesSelection',
        Boolean(pinchMetrics
          && pinchMetrics.selectionBefore
          && pinchMetrics.selectionAfter === pinchMetrics.selectionBefore),
        JSON.stringify(pinchMetrics),
      );
      const panDistance = await page.evaluate(async () => {
        const canvas = document.querySelector('.canvas-host');
        const svg = document.querySelector('svg.structural-canvas');
        const member = document.querySelector('.member-object');
        if (!canvas || !svg || !member) return 0;
        const canvasBox = canvas.getBoundingClientRect();
        const memberBox = member.getBoundingClientRect();
        const before = { x: memberBox.x + memberBox.width / 2, y: memberBox.y + memberBox.height / 2 };
        const start = {
          x: canvasBox.left + canvasBox.width * 0.25,
          y: canvasBox.top + canvasBox.height * 0.62,
        };
        const emit = (type, x, y, buttons) => svg.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 41,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons,
          clientX: x,
          clientY: y,
        }));
        emit('pointerdown', start.x, start.y, 1);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        emit('pointermove', start.x + 46, start.y + 18, 1);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        emit('pointerup', start.x + 46, start.y + 18, 0);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const after = member.getBoundingClientRect();
        return Math.hypot(
          after.x + after.width / 2 - before.x,
          after.y + after.height / 2 - before.y,
        );
      });
      check(row, scope, 'canvasPansWithResultsOpen', panDistance >= 20, `${panDistance}px`);
      check(
        row,
        scope,
        'canvasInteractiveAfterPinch',
        Boolean(pinchMetrics && panDistance >= 20),
        JSON.stringify({ pinchMetrics, panDistance }),
      );
    }
    if (phoneResults) await page.locator('svg.structural-canvas').focus();
    await page.keyboard.press('Escape');
    await expandedResults.waitFor({ state: 'hidden' });
    check(row, scope, 'resultsEscapeCloses', await expandedResults.isHidden());
    if (phoneResults) {
      check(
        row,
        scope,
        'resultsEscapePreservesSelection',
        await page.locator('.member-object.selected').count() === selectedCount,
      );
    }
    await page.waitForFunction(() => document.activeElement?.classList.contains('results-mobile-toggle'));
    check(row, scope, 'resultsFocusReturns', await resultToggle.evaluate((element) => element === document.activeElement));
    await resultToggle.focus();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('structureco:expand-mobile-results'));
    });
    await expandedResults.waitFor({ state: 'visible' });
  } else {
    check(row, scope, 'persistentInspector', await page.locator('.inspector-panel').isVisible());
    check(row, scope, 'resultsPanelVisible', await resultPanel.isVisible());
  }

  await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
  await page.locator('.result-summary-workspace').waitFor({ state: 'visible' });
  check(row, scope, 'summaryVisible', await page.locator('.result-summary-workspace').isVisible());

  const diagramSelection = await page.locator('.member-object.selected').evaluateAll((elements) => elements
    .map((element) => element.getAttribute('data-structure-id'))
    .filter(Boolean)
    .sort()
    .join(','));
  for (const diagram of [
    { tab: 'Axial', key: 'axial' },
    { tab: 'Cortante', key: 'shear' },
    { tab: 'Momento', key: 'moment' },
  ]) {
    const tabStarted = performance.now();
    progress(scope, `checking ${diagram.key} result`);
    await page.getByRole('tab', { name: diagram.tab, exact: true }).click();
    const chart = page.locator(`.diagram-chart.${diagram.key}`);
    await chart.waitFor({ state: 'visible' });
    if (diagram.key === 'moment') {
      row.timings.momentTabMs = Math.round((performance.now() - tabStarted) * 100) / 100;
    }
    check(row, scope, `${diagram.key}DiagramVisible`, await chart.locator('svg[role="img"]').isVisible());
    const canvasOverlayVisible = await page.evaluate((key) => {
      const canvas = document.querySelector('.canvas-host')?.getBoundingClientRect();
      if (!canvas) return false;
      return [...document.querySelectorAll(`.diagram-shape.${key}`)].some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0
          && rect.height > 0
          && rect.right > canvas.left
          && rect.left < canvas.right
          && rect.bottom > canvas.top
          && rect.top < canvas.bottom;
      });
    }, diagram.key);
    check(row, scope, `${diagram.key}CanvasOverlayVisible`, canvasOverlayVisible);
    const currentSelection = await page.locator('.member-object.selected').evaluateAll((elements) => elements
      .map((element) => element.getAttribute('data-structure-id'))
      .filter(Boolean)
      .sort()
      .join(','));
    check(row, scope, `${diagram.key}SelectionStable`, currentSelection === diagramSelection, `${diagramSelection} -> ${currentSelection}`);
  }

  const momentChart = page.locator('.diagram-chart.moment');
  const momentGraph = momentChart.locator('svg[role="img"]');
  await momentGraph.focus();
  await page.keyboard.press('ArrowRight');
  await momentChart.locator('.diagram-cursor-readout[role="status"]').waitFor({ state: 'visible' });
  check(row, scope, 'momentKeyboardCursor', await momentChart.locator('.diagram-cursor-readout[role="status"]').isVisible());

  if (spec.width >= 1024) {
    progress(scope, 'checking deformation and learning views');
    await page.getByRole('tab', { name: 'Deformada', exact: true }).click();
    await page.getByTestId('deformation-chart').waitFor({ state: 'visible' });
    check(row, scope, 'deformationVisible', await page.getByTestId('deformation-chart').isVisible());
    await page.getByRole('tab', { name: 'Aprender', exact: true }).click();
    await page.locator('.learning-steps').waitFor({ state: 'visible' });
    check(row, scope, 'learningStepsVisible', await page.locator('.learning-steps details').count() > 0);

    if (spec.extended) {
      progress(scope, 'checking lazy influence workflow');
      const influenceStarted = performance.now();
      await page.getByRole('tab', { name: 'Influencia', exact: true }).click();
      const influence = page.getByRole('region', { name: /Línea de influencia y tren de ejes/i });
      await influence.waitFor({ state: 'visible', timeout: 10_000 });
      row.timings.influenceActivationMs = Math.round((performance.now() - influenceStarted) * 100) / 100;
      check(row, scope, 'influenceLazyViewVisible', await influence.isVisible());
      check(row, scope, 'influenceChunkRequested', [...requestedAssets].some((file) => /^InfluenceLineView-.*\.js$/.test(file)));
      await influence.getByRole('button', { name: 'Calcular', exact: true }).click();
      const influenceSummary = influence.locator('.education-kpis').first();
      await influenceSummary.waitFor({ state: 'visible', timeout: 20_000 });
      check(row, scope, 'influenceCalculated', await influenceSummary.isVisible());
      check(row, scope, 'influenceWorkerRequested', [...requestedAssets].some((file) => /^influence\.worker-.*\.js$/.test(file)));
      progress(scope, 'influence workflow ready');
    }

    await page.getByRole('tab', { name: 'Momento', exact: true }).click();
    await momentChart.waitFor({ state: 'visible' });
  }

  const shellMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  row.shellMetrics = shellMetrics;
  check(row, scope, 'noHorizontalOverflow', shellMetrics.scrollWidth <= shellMetrics.clientWidth + 1, JSON.stringify(shellMetrics));

  if (spec.width < 1024) {
    const resultToggle = page.locator('.results-mobile-toggle');
    await resultToggle.click();
    await page.waitForFunction(() => {
      const panel = document.querySelector('.results-panel');
      return panel?.classList.contains('mobile-collapsed') && panel.getAttribute('role') !== 'dialog';
    });
    const inspectorLauncher = page.locator('.mobile-inspector-toggle');
    await inspectorLauncher.waitFor({ state: 'visible' });
    await inspectorLauncher.focus();
    await inspectorLauncher.click();
    const inspector = page.locator('.inspector-panel.mobile-open');
    await inspector.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.inspector-panel.mobile-open')?.contains(document.activeElement));
    const inspectorTrap = await verifyFocusTrap(page, inspector);
    check(row, scope, 'inspectorDialogSemantics', await inspector.getAttribute('aria-modal') === 'true');
    check(row, scope, 'inspectorFocusTrapBackward', inspectorTrap.backwardWrap, `focusables=${inspectorTrap.count}`);
    check(row, scope, 'inspectorFocusTrapForward', inspectorTrap.forwardWrap, `focusables=${inspectorTrap.count}`);
    check(row, scope, 'inspectorWithinViewport', isInsideViewport(await inspector.boundingBox(), spec));
    await page.keyboard.press('Escape');
    await inspector.waitFor({ state: 'hidden' });
    check(row, scope, 'inspectorEscapeCloses', await inspector.isHidden());
    await page.waitForFunction(() => document.activeElement?.classList.contains('mobile-inspector-toggle'));
    check(row, scope, 'inspectorFocusReturns', await inspectorLauncher.evaluate((element) => element === document.activeElement));
    await resultToggle.focus();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('structureco:expand-mobile-results'));
    });
    await page.locator('.results-panel:not(.mobile-collapsed)').waitFor({ state: 'visible' });
    await page.getByRole('tab', { name: 'Momento', exact: true }).click();
    await momentChart.waitFor({ state: 'visible' });
  }

  const screenshot = `phase14-${browserName}-${spec.id}-${spec.width}x${spec.height}-${spec.theme}.png`;
  progress(scope, `capturing ${screenshot}`);
  await page.screenshot({
    path: path.join(evidenceDir, screenshot),
    fullPage: false,
  });
  output.screenshots.push(screenshot);

  row.resources = await collectRuntimeMetrics(page);
  row.requestedAssets = [...requestedAssets].sort();
  output.runtime.samples.push({
    browser: browserName,
    viewport: spec.id,
    ...row.timings,
    ...row.resources,
  });
  progress(scope, 'viewport checks complete');
};

const exerciseHistoryAndUnits = async (page, row, scope) => {
  progress(scope, 'checking undo, redo, and presentation units');
  const beforeProject = await readStoredProject(page);
  const targetNode = beforeProject.nodes[0];
  if (!targetNode) throw new Error('El fixture no contiene un nodo editable.');
  const changedX = targetNode.x + 0.125;
  const nodeObject = page.locator(`[data-structure-kind="node"][data-structure-id="${targetNode.id}"]`);
  await nodeObject.waitFor({ state: 'attached' });
  await nodeObject.evaluate((element) => element.focus());
  await page.keyboard.press('Enter');
  const xInput = page.getByRole('textbox', { name: 'X', exact: true });
  await xInput.fill(String(changedX));
  await xInput.press('Enter');
  await page.waitForFunction(({ nodeId, expected }) => {
    const stored = localStorage.getItem('structureCo.project');
    return stored
      ? JSON.parse(stored).nodes.find((node) => node.id === nodeId)?.x === expected
      : false;
  }, { nodeId: targetNode.id, expected: changedX });
  const undo = page.getByRole('button', { name: 'Deshacer', exact: true });
  const redo = page.getByRole('button', { name: 'Rehacer', exact: true });
  check(row, scope, 'undoEnabledAfterEdit', await undo.isEnabled());
  await undo.click();
  await page.waitForFunction(({ nodeId, expected }) => {
    const stored = localStorage.getItem('structureCo.project');
    return stored
      ? JSON.parse(stored).nodes.find((node) => node.id === nodeId)?.x === expected
      : false;
  }, { nodeId: targetNode.id, expected: targetNode.x });
  check(row, scope, 'undoRestoresEdit', true);
  await redo.click();
  await page.waitForFunction(({ nodeId, expected }) => {
    const stored = localStorage.getItem('structureCo.project');
    return stored
      ? JSON.parse(stored).nodes.find((node) => node.id === nodeId)?.x === expected
      : false;
  }, { nodeId: targetNode.id, expected: changedX });
  check(row, scope, 'redoRestoresEdit', true);

  const beforeUnitFingerprint = technicalFingerprint(await readStoredProject(page));
  const units = page.getByLabel('Unidades', { exact: true });
  await units.selectOption('kip-ft');
  await page.waitForFunction(() => {
    const stored = localStorage.getItem('structureCo.project');
    return stored ? JSON.parse(stored).settings?.units === 'kip-ft' : false;
  });
  const afterUnitChange = await readStoredProject(page);
  check(row, scope, 'unitSelectionVisible', await units.inputValue() === 'kip-ft');
  check(
    row,
    scope,
    'unitSwitchPreservesTechnicalValues',
    technicalFingerprint(afterUnitChange) === beforeUnitFingerprint,
  );
  progress(scope, 'history and units checks complete');
};

const runViewport = async (browser, browserName, spec) => {
  const scope = `matrix.${browserName}.${spec.id}`;
  progress(scope, 'viewport start');
  let harness;
  try {
    harness = await openExampleWorkspace(browser, browserName, spec, scope);
    const {
      page,
      row,
      requestedAssets,
    } = harness;
    output.browsers[browserName][spec.id] = row;
    await exerciseResults(page, row, scope, spec, browserName, requestedAssets);
    if (browserName === 'chromium' && spec.id === 'desktop') {
      await exerciseHistoryAndUnits(page, row, scope);
    }
    check(row, scope, 'consoleClean', row.console.length === 0, row.console.join(' | '));
    check(row, scope, 'pageErrorsClean', row.pageErrors.length === 0, row.pageErrors.join(' | '));
  } catch (error) {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    fail(scope, 'runtime', detail);
    if (!output.browsers[browserName][spec.id]) {
      output.browsers[browserName][spec.id] = {
        viewport: `${spec.width}x${spec.height}`,
        theme: spec.theme,
        checks: {},
        console: [],
        pageErrors: [],
        runtimeError: detail,
      };
    } else {
      output.browsers[browserName][spec.id].runtimeError = detail;
    }
    progress(scope, `viewport failed: ${detail.split('\n')[0]}`);
  } finally {
    await harness?.context.close();
    progress(scope, 'viewport closed');
  }
};

const runImportExportRoundTrip = async (browser) => {
  const scope = 'criticalFlows.chromium.importExport';
  progress(scope, 'round-trip start');
  const spec = { id: 'import-export', width: 1536, height: 960, touch: false, theme: 'light' };
  let harness;
  const row = { checks: {}, console: [], pageErrors: [] };
  output.criticalFlows.importExport = row;
  try {
    harness = await openExampleWorkspace(browser, 'chromium', spec, scope);
    const { page } = harness;
    row.console = harness.row.console;
    row.pageErrors = harness.row.pageErrors;
    const beforeProject = await readStoredProject(page);
    const beforeFingerprint = technicalFingerprint(beforeProject);

    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Proyecto JSON', exact: true }).click(),
    ]);
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error('La descarga JSON no produjo una ruta temporal.');
    const bytes = fs.readFileSync(downloadPath);
    const exportedProject = JSON.parse(bytes.toString('utf8'));
    check(row, scope, 'jsonDownloaded', download.suggestedFilename().endsWith('.structureco.json'));
    check(row, scope, 'exportPreservesTechnicalValues', technicalFingerprint(exportedProject) === beforeFingerprint);

    const importTrigger = page.getByRole('button', { name: 'Abrir proyectos y ejemplos', exact: true });
    await importTrigger.click();
    await page.getByRole('menuitem', { name: 'Importar JSON', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Trae un proyecto con contexto', exact: true });
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
    check(row, scope, 'dialogModal', await dialog.getAttribute('aria-modal') === 'true');
    check(row, scope, 'initialFocusInside', await dialog.evaluate((element) => element.contains(document.activeElement)));

    await dialog.getByLabel('Seleccionar archivo para importar', { exact: true }).setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/json',
      buffer: bytes,
    });
    await dialog.locator('[data-import-stage-focus="content"]').waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
    await dialog.locator('[data-import-stage-focus="conflicts"]').waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: 'Revisar importación', exact: true }).click();
    await dialog.locator('[data-import-stage-focus="confirm"]').waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: 'Importar ahora', exact: true }).click();
    const result = dialog.locator('[data-import-stage-focus="result"]');
    await result.waitFor({ state: 'visible', timeout: 20_000 });
    check(row, scope, 'resultFocused', await result.evaluate((element) => element === document.activeElement));
    const screenshot = 'phase14-chromium-import-roundtrip-1536x960.png';
    await page.screenshot({ path: path.join(evidenceDir, screenshot), fullPage: false });
    output.screenshots.push(screenshot);
    await dialog.getByRole('button', { name: 'Abrir proyecto', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const importedProject = await readStoredProject(page);
    check(row, scope, 'roundTripPreservesTechnicalValues', technicalFingerprint(importedProject) === beforeFingerprint);
    check(row, scope, 'workspaceRestored', await page.locator('.app-shell').isVisible());
    check(row, scope, 'consoleClean', row.console.length === 0, row.console.join(' | '));
    check(row, scope, 'pageErrorsClean', row.pageErrors.length === 0, row.pageErrors.join(' | '));
    progress(scope, 'round-trip complete');
  } catch (error) {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    row.runtimeError = detail;
    fail(scope, 'runtime', detail);
  } finally {
    await harness?.context.close();
    progress(scope, 'round-trip context closed');
  }
};

const runClassroomJourney = async (browser) => {
  const scope = 'criticalFlows.webkit.classroom';
  progress(scope, 'classroom journey start');
  const spec = { id: 'classroom', width: 1366, height: 768, touch: false, theme: 'dark' };
  let harness;
  const row = { checks: {}, console: [], pageErrors: [] };
  output.criticalFlows.classroom = row;
  try {
    harness = await openExampleWorkspace(browser, 'webkit', spec, scope);
    const { page } = harness;
    row.console = harness.row.console;
    row.pageErrors = harness.row.pageErrors;
    const mode = page.getByLabel('Modo de cálculo', { exact: true });
    await mode.selectOption('classroom');
    await page.locator('.classroom-workspace-journey').waitFor({ state: 'visible' });
    check(row, scope, 'journeyVisible', await page.locator('.classroom-workspace-journey').isVisible());

    await page.getByRole('button', { name: 'Analizar', exact: true }).click();
    const prediction = page.locator('.classroom-prediction');
    await prediction.waitFor({ state: 'visible' });
    check(row, scope, 'predictionRequiredBeforeResults', await prediction.isVisible());
    const momentTab = prediction.getByRole('tab', { name: 'M', exact: true });
    await momentTab.focus();
    await page.keyboard.press('ArrowLeft');
    const shearTab = prediction.getByRole('tab', { name: 'V', exact: true });
    check(row, scope, 'predictionTabsKeyboardAccessible', await shearTab.getAttribute('aria-selected') === 'true'
      && await shearTab.evaluate((element) => element === document.activeElement));
    await prediction.getByRole('spinbutton', { name: 'Magnitud estimada', exact: true }).fill('1');
    await prediction.getByRole('button', { name: 'Continuar al análisis', exact: true }).click();
    const gate = page.locator('.classroom-result-gate');
    await gate.waitFor({ state: 'visible', timeout: 20_000 });
    check(row, scope, 'resultsRemainLocked', await gate.isVisible());
    await gate.getByRole('button', { name: 'Revelar y comparar', exact: true }).click();
    await page.locator('.result-summary-workspace').waitFor({ state: 'visible' });
    check(row, scope, 'resultsRevealAfterPrediction', await page.locator('.result-summary-workspace').isVisible());
    check(row, scope, 'classroomModeRetained', await mode.inputValue() === 'classroom');
    const screenshot = 'phase14-webkit-classroom-1366x768-dark.png';
    await page.screenshot({ path: path.join(evidenceDir, screenshot), fullPage: false });
    output.screenshots.push(screenshot);
    check(row, scope, 'consoleClean', row.console.length === 0, row.console.join(' | '));
    check(row, scope, 'pageErrorsClean', row.pageErrors.length === 0, row.pageErrors.join(' | '));
    progress(scope, 'classroom journey complete');
  } catch (error) {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    row.runtimeError = detail;
    fail(scope, 'runtime', detail);
  } finally {
    await harness?.context.close();
    progress(scope, 'classroom context closed');
  }
};

const summarizeRuntime = () => {
  const samples = output.runtime.samples;
  const summarize = (field) => {
    const values = samples.map((sample) => sample[field]).filter(Number.isFinite);
    if (!values.length) return null;
    return {
      samples: values.length,
      minimum: Math.min(...values),
      median: [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)],
      maximum: Math.max(...values),
    };
  };
  output.runtime.summary = {
    cleanStartupMs: summarize('cleanStartupMs'),
    workspaceActivationMs: summarize('workspaceActivationMs'),
    analysisMs: summarize('analysisMs'),
    momentTabMs: summarize('momentTabMs'),
    longTaskTotalMs: summarize('longTaskTotalMs'),
    longestTaskMs: summarize('longestTaskMs'),
    note: 'Tiempos locales headless; sirven como línea base reproducible y no como SLA de hardware real.',
  };
};

const previewServer = await preview({
  root,
  preview: { host: '127.0.0.1', port: 4184, strictPort: true },
  logLevel: 'error',
});

let chromiumBrowser;
let webkitBrowser;
try {
  output.browsers.chromium = {};
  output.browsers.webkit = {};

  const chromiumSpecs = matrix.chromium.filter((spec) => (
    !flowFilter
    && (!browserFilter || browserFilter === 'chromium')
    && (!viewportFilter || viewportFilter === spec.id)
    && (!smokeMode || spec.id === 'desktop')
  ));
  const webkitSpecs = matrix.webkit.filter((spec) => (
    !flowFilter
    && (!browserFilter || browserFilter === 'webkit')
    && (!viewportFilter || viewportFilter === spec.id)
    && !smokeMode
  ));

  const runImportExport = !smokeMode
    && !viewportFilter
    && (!browserFilter || browserFilter === 'chromium')
    && (!flowFilter || flowFilter === 'importExport');
  if (chromiumSpecs.length || runImportExport) {
    progress('browser.chromium', 'launching');
    chromiumBrowser = await chromium.launch({
      headless: true,
      channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    for (const spec of chromiumSpecs) await runViewport(chromiumBrowser, 'chromium', spec);
    if (runImportExport) await runImportExportRoundTrip(chromiumBrowser);
    await chromiumBrowser.close();
    chromiumBrowser = undefined;
    progress('browser.chromium', 'closed');
  }

  const runClassroom = !smokeMode
    && !viewportFilter
    && (!browserFilter || browserFilter === 'webkit')
    && (!flowFilter || flowFilter === 'classroom');
  if (webkitSpecs.length || runClassroom) {
    progress('browser.webkit', 'launching');
    webkitBrowser = await webkit.launch({ headless: true });
    for (const spec of webkitSpecs) await runViewport(webkitBrowser, 'webkit', spec);
    if (runClassroom) await runClassroomJourney(webkitBrowser);
    await webkitBrowser.close();
    webkitBrowser = undefined;
    progress('browser.webkit', 'closed');
  }
} finally {
  await chromiumBrowser?.close();
  await webkitBrowser?.close();
  await previewServer.close();
}

if (output.console.length) fail('global', 'consoleClean', output.console.join(' | '));
if (output.pageErrors.length) fail('global', 'pageErrorsClean', output.pageErrors.join(' | '));
summarizeRuntime();

const metricsPath = path.join(evidenceDir, 'phase14-metrics.json');
fs.writeFileSync(metricsPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));

if (output.failures.length) {
  throw new Error(`QA Fase 14 fallida: ${output.failures.join('; ')}`);
}
