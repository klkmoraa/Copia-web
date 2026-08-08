import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(root, 'qa-artifacts', 'phase11');
fs.mkdirSync(artifactsDir, { recursive: true });

const previewServer = await preview({
  root,
  preview: { host: '127.0.0.1', port: 4181, strictPort: true },
  logLevel: 'error',
});
const baseURL = 'http://127.0.0.1:4181/';

const matrix = [
  { id: 'desktop-large', width: 1536, height: 960, touch: false, theme: 'light' },
  { id: 'laptop', width: 1366, height: 768, touch: false, theme: 'dark' },
  { id: 'tablet-landscape', width: 1194, height: 834, touch: true, theme: 'light' },
  { id: 'tablet-portrait', width: 834, height: 1194, touch: true, theme: 'dark' },
  { id: 'mobile', width: 430, height: 932, touch: true, theme: 'light' },
  { id: 'mobile-compact', width: 390, height: 844, touch: true, theme: 'dark' },
  { id: 'zoom-200-equivalent', width: 683, height: 384, touch: false, theme: 'light' },
];

const output = { generatedAt: new Date().toISOString(), browsers: {}, errors: [] };

const isInside = (box, viewport, tolerance = 1) => Boolean(box)
  && box.x >= -tolerance
  && box.y >= -tolerance
  && box.x + box.width <= viewport.width + tolerance
  && box.y + box.height <= viewport.height + tolerance;

const runViewport = async (browserName, browser, spec) => {
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    hasTouch: spec.touch,
    isMobile: spec.width <= 700,
    locale: 'es-MX',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(`console ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${String(error)}`));

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.welcome-example-card').first().click();
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, spec.theme);

  const shellMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  const checks = {
    noHorizontalOverflow: shellMetrics.scrollWidth <= shellMetrics.clientWidth + 1,
    noPageScrollTrap: shellMetrics.scrollHeight <= shellMetrics.clientHeight + 1,
    canvasVisible: await page.locator('svg.structural-canvas').isVisible(),
    primaryToolSurfaceVisible: spec.width >= 1024
      ? await page.locator('.desktop-tool-list').isVisible()
      : await page.locator('.mobile-tool-dock').isVisible(),
  };

  if (spec.width <= 700) {
    const mobileShellDensity = await page.evaluate(() => {
      const topbar = document.querySelector('.topbar')?.getBoundingClientRect();
      const toolbar = document.querySelector('.toolbar')?.getBoundingClientRect();
      const dockButtons = [...document.querySelectorAll('.mobile-tool-dock button')]
        .map((element) => element.getBoundingClientRect());
      return {
        topbarHeight: topbar?.height ?? Infinity,
        toolbarHeight: toolbar?.height ?? Infinity,
        dockCount: dockButtons.length,
        dockRoutesVisible: dockButtons.every(({ left, top, right, bottom }) => (
          left >= 0 && top >= 0 && right <= innerWidth && bottom <= innerHeight
        )),
        touchSafe: dockButtons.every(({ width, height }) => width >= 44 && height >= 44),
      };
    });
    checks.compactMobileTopbar = mobileShellDensity.topbarHeight <= 50;
    checks.compactMobileDock = mobileShellDensity.toolbarHeight <= 60
      && mobileShellDensity.dockCount === 6
      && mobileShellDensity.dockRoutesVisible
      && mobileShellDensity.touchSafe;

    await page.getByRole('button', { name: 'Herramientas de carga', exact: true }).click();
    await page.getByRole('menuitemradio', { name: /^Carga puntual\./ }).click();
    const placementCancel = page.getByRole('button', { name: 'Cancelar colocación', exact: true });
    await placementCancel.waitFor({ state: 'visible' });
    const placementMetrics = await page.evaluate(() => {
      const badge = document.querySelector('.canvas-mode-badge.placing-load');
      const instruction = badge?.querySelector('.canvas-action-instruction');
      const cancel = badge?.querySelector('button[aria-label="Cancelar colocación"]');
      const cancelRect = cancel?.getBoundingClientRect();
      const instructionRect = instruction?.getBoundingClientRect();
      return {
        cancelWidth: cancelRect?.width ?? 0,
        cancelHeight: cancelRect?.height ?? 0,
        instructionVisible: Boolean(instructionRect
          && instructionRect.width > 1
          && instructionRect.height > 1
          && getComputedStyle(instruction).visibility !== 'hidden'),
      };
    });
    checks.placementCancelTouchTarget = placementMetrics.cancelWidth >= 44
      && placementMetrics.cancelHeight >= 44;
    checks.placementInstructionVisible = placementMetrics.instructionVisible;
    await placementCancel.click();
  }

  if (spec.width >= 1024) {
    const resize = page.locator('.inspector-resize-handle');
    checks.persistentInspector = await page.locator('.inspector-panel').isVisible();
    checks.inspectorResizeVisible = await resize.isVisible();
    const before = await page.locator('.app-shell').evaluate((element) => getComputedStyle(element).getPropertyValue('--inspector-w').trim());
    await resize.focus();
    await page.keyboard.press('ArrowLeft');
    const after = await page.locator('.app-shell').evaluate((element) => getComputedStyle(element).getPropertyValue('--inspector-w').trim());
    checks.inspectorKeyboardResize = before !== after;
    checks.inspectorWidthPersisted = await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('structureco:workspace-layout:v1') ?? '{}');
      return typeof stored.inspectorWidth === 'number' && stored.inspectorWidth >= 280 && stored.inspectorWidth <= 480;
    });
  } else {
    const inspectorLauncher = page.locator('.mobile-inspector-toggle');
    await inspectorLauncher.click();
    const inspector = page.locator('.inspector-panel.mobile-open');
    await inspector.waitFor({ state: 'visible' });
    checks.inspectorDialog = await inspector.getAttribute('role') === 'dialog';
    checks.inspectorWithinViewport = isInside(await inspector.boundingBox(), spec);
    const frequentTargets = await page.locator('.inspector-tabs button:visible, .mobile-tool-dock button:visible, .mobile-inspector-close:visible').evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    checks.touchTargetsAtLeast44 = frequentTargets.length > 0
      && frequentTargets.every(({ width, height }) => width >= 44 && height >= 44);
    await page.keyboard.press('Escape');
    checks.inspectorEscapeCloses = await inspector.isHidden();
    await page.waitForFunction(() => document.activeElement?.classList.contains('mobile-inspector-toggle'));
    checks.inspectorFocusReturns = await inspectorLauncher.evaluate((element) => element === document.activeElement);

    const resultLauncher = page.locator('.results-mobile-toggle');
    await resultLauncher.click();
    const phoneResults = spec.width <= 700;
    const results = page.locator('.results-panel:not(.mobile-collapsed)');
    await results.waitFor({ state: 'visible' });
    await page.waitForTimeout(420);
    const resultBox = await results.boundingBox();
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
      const visibleModelObjectCount = [...document.querySelectorAll('.member-object, .node-object')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0
            && rect.height > 0
            && rect.right > canvas.left
            && rect.left < canvas.right
            && rect.bottom > exposedTop
            && rect.top < exposedBottom;
        }).length;
      return {
        exposedCanvasHeight: Math.max(0, exposedBottom - exposedTop),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        panelWidth: panel.width,
        panelHeight: panel.height,
        visibleModelObjectCount,
        reservedCanvasSpace: separated && (
          Math.abs(canvas.bottom - panel.top) <= 2
          || Math.abs(canvas.right - panel.left) <= 2
        ),
      };
    });
    if (phoneResults) {
      checks.resultsModeless = await results.getAttribute('role') !== 'dialog'
        && await results.getAttribute('aria-modal') === null;
      checks.resultsCanvasInteractive = await results.getAttribute('data-canvas-interactive') === 'true';
      checks.resultsDoNotBlockCanvas = await page.evaluate(() => {
        const canvas = document.querySelector('.canvas-host');
        return canvas?.inert !== true
          && !canvas?.hasAttribute('aria-hidden')
          && !document.querySelector('.results-sheet-backdrop');
      });
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
      checks.compactModeBadge = compactDensity.modeHeight <= 40 && !compactDensity.gestureVisible;
      checks.compactResultContext = compactDensity.contextWidth <= 2;
      checks.compactResultTabs = compactDensity.tabsHeight <= 48;
      checks.compactResultPanel = spec.width > spec.height
        ? compactDensity.panelWidth <= spec.width * 0.44 + 1
        : compactDensity.panelHeight <= spec.height * 0.43;
      checks.compactResultLegend = compactDensity.legendHeight === 0 || compactDensity.legendHeight <= 44;
      const commandbar = page.locator('.results-commandbar');
      const commandbarDisplayNone = await commandbar.evaluate((element) => getComputedStyle(element).display === 'none');
      await resultLauncher.focus();
      await page.keyboard.press('Tab');
      const commandbarSkipsFocus = await page.evaluate(() => {
        const context = document.querySelector('.results-commandbar');
        return Boolean(context && !context.contains(document.activeElement));
      });
      checks.compactResultContextUntabbable = commandbarDisplayNone && commandbarSkipsFocus;
      checks.resultsReserveCanvasSpace = Boolean(resultLayout?.reservedCanvasSpace);
      const cameraControls = [
        ['canvasZoomInReachable', page.getByRole('button', { name: 'Acercar' })],
        ['canvasZoomOutReachable', page.getByRole('button', { name: 'Alejar' })],
        ['canvasFitControlClickable', page.getByRole('button', { name: 'Ajustar modelo a la vista' })],
      ];
      const cameraBoxes = await Promise.all(cameraControls.map(([, control]) => control.boundingBox()));
      const layerBox = await page.getByRole('button', { name: 'Capas de información' }).boundingBox();
      const boxesIntersect = (left, right) => Boolean(left && right
        && left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y);
      checks.canvasCameraLayerDoNotOverlap = Boolean(layerBox)
        && cameraBoxes.every((box) => Boolean(box) && !boxesIntersect(box, layerBox));
      const fitBox = cameraBoxes[2];
      checks.canvasFitControlReachable = Boolean(fitBox && resultBox && (
        fitBox.y + fitBox.height <= resultBox.y + 1
        || fitBox.x + fitBox.width <= resultBox.x + 1
      ));
      for (const [check, control] of cameraControls) {
        try {
          await control.click({ timeout: 1500 });
          checks[check] = true;
        } catch {
          checks[check] = false;
        }
      }
      await page.waitForTimeout(120);
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
      checks.canvasPansWithResultsOpen = panDistance >= 20;
    } else {
      checks.resultsDialog = await results.getAttribute('role') === 'dialog'
        && await results.getAttribute('aria-modal') === 'true';
    }
    checks.resultsWithinViewport = isInside(resultBox, spec);
    checks.resultsPresentation = phoneResults
      ? Boolean(resultBox && resultLayout && (
        (resultLayout.panelWidth >= resultLayout.canvasWidth - 1
          && resultBox.height >= Math.min(150, spec.height * 0.42)
          && resultBox.height < spec.height * 0.75)
        || (spec.width > spec.height
          && resultLayout.panelWidth <= spec.width * 0.44 + 1
          && resultLayout.panelHeight >= resultLayout.canvasHeight - 1)
      ))
      : Boolean(resultBox && resultBox.height < spec.height * 0.8 && resultBox.height >= 220);
    checks.resultsLeaveModelVisible = Boolean(
      resultLayout && resultLayout.exposedCanvasHeight >= Math.min(180, spec.height * 0.24),
    );
    checks.resultsShowModelGeometry = Boolean(resultLayout && resultLayout.visibleModelObjectCount > 0);
    if (phoneResults) await page.locator('svg.structural-canvas').focus();
    await page.keyboard.press('Escape');
    checks.resultsEscapeCloses = await results.isHidden();
    await page.waitForFunction(() => document.activeElement?.classList.contains('results-mobile-toggle'));
    checks.resultsFocusReturns = await resultLauncher.evaluate((element) => element === document.activeElement);
  }

  checks.safeAreaRules = await page.evaluate(() => {
    const css = [...document.styleSheets].flatMap((sheet) => {
      try { return [...sheet.cssRules].map((rule) => rule.cssText); } catch { return []; }
    }).join('\n');
    return css.includes('safe-area-inset-top') && css.includes('safe-area-inset-bottom');
  });

  await page.screenshot({
    path: path.join(artifactsDir, `${browserName}-${spec.id}-${spec.theme}.png`),
    fullPage: false,
  });
  await context.close();
  return { viewport: `${spec.width}x${spec.height}`, touch: spec.touch, theme: spec.theme, checks, errors };
};

for (const [browserName, browserType, specs, launchOptions] of [
  ['chromium', chromium, matrix, {
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  }],
  ['webkit', webkit, matrix.filter(({ id }) => ['tablet-portrait', 'mobile', 'zoom-200-equivalent'].includes(id)), { headless: true }],
]) {
  const browser = await browserType.launch(launchOptions);
  output.browsers[browserName] = {};
  for (const spec of specs) {
    output.browsers[browserName][spec.id] = await runViewport(browserName, browser, spec);
  }
  await browser.close();
}

await previewServer.close();
const failures = [];
for (const [browserName, rows] of Object.entries(output.browsers)) {
  for (const [viewportName, row] of Object.entries(rows)) {
    for (const [check, value] of Object.entries(row.checks)) {
      if (value !== true) failures.push(`${browserName}/${viewportName}: ${check}`);
    }
    failures.push(...row.errors.map((error) => `${browserName}/${viewportName}: ${error}`));
  }
}
fs.writeFileSync(path.join(artifactsDir, 'phase11-results.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
if (failures.length) throw new Error(`QA Fase 11 fallida: ${failures.join('; ')}`);
