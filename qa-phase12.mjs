import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.join(root, 'docs', 'ux-redesign', 'evidence', 'phase-12', 'after');
fs.mkdirSync(evidenceDir, { recursive: true });

const output = {
  phase: 12,
  generatedAt: new Date().toISOString(),
  preview: 'http://127.0.0.1:4182/',
  contrast: {},
  reducedMotion: {},
  i18n: {},
  offlineLocalFirst: {},
  keyboardFocus: {},
  responsive: {},
  console: [],
  pageErrors: [],
  failures: [],
  runtimeErrors: [],
};

const requireCheck = (name, condition, detail = '') => {
  if (!condition) output.failures.push(detail ? `${name}: ${detail}` : name);
  return condition;
};

const previewServer = await preview({
  root,
  preview: { host: '127.0.0.1', port: 4182, strictPort: true },
  logLevel: 'error',
});

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});

const attachDiagnostics = (page, scope) => {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      output.console.push(`${scope} ${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => output.pageErrors.push(`${scope}: ${String(error)}`));
};

const waitForAnimations = (locator) => locator.evaluate(async (element) => {
  await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
});

const openWorkspace = async ({
  id,
  width,
  height,
  theme = 'light',
  reducedMotion = 'no-preference',
  touch = width < 1024,
}) => {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: touch,
    isMobile: width <= 700,
    locale: 'es-MX',
    colorScheme: theme,
    reducedMotion,
  });
  const page = await context.newPage();
  attachDiagnostics(page, id);
  await page.goto(output.preview, { waitUntil: 'networkidle' });
  await page.evaluate((nextTheme) => {
    localStorage.clear();
    localStorage.setItem('structureCo.theme', nextTheme);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await page.locator('.full-project-button').click();
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  return { context, page };
};

const describedBySnapshot = (locator) => locator.evaluate((element) => {
  const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  return {
    ids,
    text: ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? '').filter(Boolean),
  };
});

const elementHasFocus = (locator) => locator.evaluate((element) => document.activeElement === element);

const focusIsInside = (locator) => locator.evaluate((element) => element.contains(document.activeElement));

const activateStructureObjectByKeyboard = async (page, kind, id) => {
  const selector = `[data-structure-kind="${kind}"][data-structure-id="${id}"]`;
  const target = page.locator(selector);
  await target.waitFor({ state: 'attached' });
  const semantics = await target.evaluate((element) => ({
    role: element.getAttribute('role'),
    tabIndex: element.tabIndex,
    ariaKeyShortcuts: element.getAttribute('aria-keyshortcuts'),
  }));
  await target.evaluate((element) => element.focus());
  const focused = await elementHasFocus(target);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ targetKind, targetId }) => (
      document.querySelector(
        `[data-structure-kind="${targetKind}"][data-structure-id="${targetId}"]`,
      )?.getAttribute('aria-pressed') === 'true'
    ),
    { targetKind: kind, targetId: id },
  );
  return {
    ...semantics,
    focused,
    selected: await target.getAttribute('aria-pressed') === 'true',
  };
};

const setWorkspaceLanguage = async (page, language) => {
  const current = await page.locator('html').getAttribute('lang');
  if (current === language) return;
  const moreActions = current === 'en' ? 'More actions' : 'Más acciones';
  const languageLabel = current === 'en' ? 'Language' : 'Idioma';
  await page.getByRole('button', { name: moreActions, exact: true }).click();
  await page.locator('.utility-actions-menu').getByLabel(languageLabel).selectOption(language);
  await page.waitForFunction((expected) => document.documentElement.lang === expected, language);
  await page.keyboard.press('Escape');
};

const technicalProjectFingerprint = (project) => ({
  name: project.name,
  schemaVersion: project.schemaVersion,
  units: project.settings?.units,
  nodes: (project.nodes ?? []).map(({ id, x, y, support }) => ({
    id,
    x,
    y,
    support: {
      type: support?.type,
      angleDeg: support?.angleDeg,
    },
  })),
  members: (project.members ?? []).map(({ id, i, j, type, E, A, I, releases }) => ({
    id,
    i,
    j,
    type,
    E,
    A,
    I,
    releases,
  })),
  nodalLoads: (project.nodalLoads ?? []).map(({ id, nodeId, caseId, fx, fy, mz }) => ({
    id,
    nodeId,
    caseId,
    fx,
    fy,
    mz,
  })),
  memberLoads: (project.memberLoads ?? []).map(({
    id,
    memberId,
    caseId,
    type,
    coordinateSystem,
    lengthBasis,
    start,
    end,
    px,
    py,
    position,
  }) => ({
    id,
    memberId,
    caseId,
    type,
    coordinateSystem,
    lengthBasis,
    start,
    end,
    px,
    py,
    position,
  })),
  loadCaseIds: (project.loadCases ?? []).map(({ id }) => id),
});

const readStoredProject = (page) => page.evaluate(() => {
  const stored = localStorage.getItem('structureCo.project');
  return stored ? JSON.parse(stored) : null;
});

const captureFocusedOutline = (page, selector) => page.evaluate((expectedSelector) => {
  const element = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const style = element ? getComputedStyle(element) : null;
  let backgroundElement = element?.parentElement ?? null;
  let background = 'rgba(0, 0, 0, 0)';
  while (backgroundElement) {
    const candidate = getComputedStyle(backgroundElement).backgroundColor;
    const rgba = candidate.match(/^rgba?\([^)]*?(?:[,/]\s*([\d.]+))?\)$/i);
    const alpha = rgba?.[1] === undefined ? 1 : Number(rgba[1]);
    const srgbAlpha = candidate.match(/\/\s*([\d.]+)\s*\)$/)?.[1];
    if (candidate !== 'transparent' && (srgbAlpha === undefined ? alpha : Number(srgbAlpha)) > 0) {
      background = candidate;
      break;
    }
    backgroundElement = backgroundElement.parentElement;
  }
  return {
    selector: expectedSelector,
    focused: element?.matches(expectedSelector) ?? false,
    focusVisible: element?.matches(':focus-visible') ?? false,
    outlineColor: style?.outlineColor ?? null,
    outlineStyle: style?.outlineStyle ?? null,
    outlineWidth: style?.outlineWidth ?? null,
    background,
  };
}, selector);

const measureContrast = async (page) => {
  await page.locator('.analyze-button').focus();
  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(() => document.activeElement?.classList.contains('utility-more-button'));
  const focusedControlSample = await captureFocusedOutline(page, '.utility-more-button');

  await page.locator('#inspector-tab-loads').click();
  const firstLoadCase = page.locator('.load-case-row').first();
  await firstLoadCase.locator('input[type="checkbox"]').focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.activeElement?.matches('.load-case-row div input'));
  const loadCaseInputSample = await captureFocusedOutline(page, '.load-case-row div input');

  return page.evaluate(({ focusedControlSample, loadCaseInputSample }) => {
  const parseColor = (text) => {
    const rgb = text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
    const srgb = text.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i);
    if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
    throw new Error(`Color no interpretable: ${text}`);
  };
  const resolveToken = (token) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    probe.style.position = 'fixed';
    probe.style.visibility = 'hidden';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  };
  const blend = (foreground, background) => {
    const [fr, fg, fb, alpha] = foreground;
    const [br, bg, bb] = background;
    return [
      fr * alpha + br * (1 - alpha),
      fg * alpha + bg * (1 - alpha),
      fb * alpha + bb * (1 - alpha),
      1,
    ];
  };
  const luminance = ([red, green, blue]) => {
    const linear = [red, green, blue].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const ratio = (foregroundText, backgroundText) => {
    const background = parseColor(backgroundText);
    const foreground = blend(parseColor(foregroundText), background);
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  const tokenPairs = [
    ['primaryText', '--text', '--surface', 4.5],
    ['secondaryText', '--muted', '--surface', 4.5],
    ['primaryAction', '--accent-foreground', '--accent', 4.5],
    ['warningText', '--sc-color-state-warning-foreground', '--surface', 4.5],
    ['errorText', '--sc-color-state-error-foreground', '--surface', 4.5],
    ['focusToken', '--focus', '--surface', 3],
  ];
  const pairs = Object.fromEntries(tokenPairs.map(([name, foregroundToken, backgroundToken, minimum]) => {
    const foreground = resolveToken(foregroundToken);
    const background = resolveToken(backgroundToken);
    const measured = ratio(foreground, background);
    return [name, {
      foreground,
      background,
      ratio: Number(measured.toFixed(2)),
      minimum,
      pass: measured >= minimum,
    }];
  }));
  const surface = resolveToken('--surface');
  const elements = Object.fromEntries([
    ['analyzeButton', '.analyze-button', 4.5],
    ['brandName', '.brand-name', 4.5],
    ['activeInspectorTab', '.inspector-tabs button.active', 4.5],
  ].map(([name, selector, minimum]) => {
    const element = document.querySelector(selector);
    if (!element) return [name, { selector, minimum, pass: false, reason: 'missing' }];
    const style = getComputedStyle(element);
    const background = style.backgroundColor === 'rgba(0, 0, 0, 0)' ? surface : style.backgroundColor;
    const measured = ratio(style.color, background);
    return [name, {
      selector,
      foreground: style.color,
      background,
      ratio: Number(measured.toFixed(2)),
      minimum,
      pass: measured >= minimum,
    }];
  }));
  const focusedResult = (sample) => {
    const measured = sample.outlineColor ? ratio(sample.outlineColor, sample.background) : 0;
    return {
      ...sample,
      ratio: Number(measured.toFixed(2)),
      minimum: 3,
      pass: Boolean(
        sample.focused
        && sample.focusVisible
        && sample.outlineStyle !== 'none'
        && Number.parseFloat(sample.outlineWidth ?? '0') >= 2
        && measured >= 3
      ),
    };
  };
  elements.focusedControl = focusedResult(focusedControlSample);
  elements.loadCaseInputFocus = focusedResult(loadCaseInputSample);
  return { theme: document.documentElement.dataset.theme, pairs, elements };
  }, { focusedControlSample, loadCaseInputSample });
};

const runContrast = async () => {
  for (const theme of ['light', 'dark']) {
    const { context, page } = await openWorkspace({ id: `contrast-${theme}`, width: 1366, height: 768, theme });
    const metrics = await measureContrast(page);
    output.contrast[theme] = metrics;
    for (const [name, result] of Object.entries({ ...metrics.pairs, ...metrics.elements })) {
      const detail = 'focusVisible' in result
        ? JSON.stringify({
          focusVisible: result.focusVisible,
          outlineColor: result.outlineColor,
          outlineStyle: result.outlineStyle,
          outlineWidth: result.outlineWidth,
          ratio: result.ratio,
          minimum: result.minimum,
        })
        : `ratio ${result.ratio ?? 'n/a'} < ${result.minimum}`;
      requireCheck(`contrast.${theme}.${name}`, result.pass === true, detail);
    }
    requireCheck(`contrast.${theme}.themeApplied`, metrics.theme === theme, `theme=${metrics.theme}`);
    await page.screenshot({ path: path.join(evidenceDir, `phase12-contrast-${theme}-1366x768.png`) });
    await context.close();
  }
};

const durationToMilliseconds = (value) => {
  const trimmed = value.trim();
  if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed);
  if (trimmed.endsWith('s')) return Number.parseFloat(trimmed) * 1000;
  return Number.POSITIVE_INFINITY;
};

const runReducedMotion = async () => {
  const { context, page } = await openWorkspace({
    id: 'reduced-motion',
    width: 1366,
    height: 768,
    reducedMotion: 'reduce',
  });
  const metrics = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.className = 'spin';
    probe.hidden = false;
    document.body.append(probe);
    const selectors = ['.workspace-screen', '.results-panel', '.inspector-panel', '.spin'];
    const styles = Object.fromEntries(selectors.map((selector) => {
      const element = selector === '.spin' ? probe : document.querySelector(selector);
      if (!element) return [selector, null];
      const style = getComputedStyle(element);
      return [selector, {
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      }];
    }));
    probe.remove();
    return {
      mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      styles,
    };
  });
  const motionDurations = Object.values(metrics.styles).flatMap((style) => style
    ? [...style.animationDuration.split(','), ...style.transitionDuration.split(',')].map(durationToMilliseconds)
    : []);
  metrics.maximumDurationMs = Math.max(0, ...motionDurations.filter(Number.isFinite));
  metrics.spinnerStopped = metrics.styles['.spin']?.animationName === 'none';
  metrics.pass = metrics.mediaMatches && metrics.maximumDurationMs <= 1 && metrics.spinnerStopped;
  output.reducedMotion = metrics;
  requireCheck('reducedMotion.mediaMatches', metrics.mediaMatches);
  requireCheck('reducedMotion.duration', metrics.maximumDurationMs <= 1, `maximum ${metrics.maximumDurationMs}ms`);
  requireCheck('reducedMotion.spinnerStopped', metrics.spinnerStopped);
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-reduced-motion-1366x768.png') });
  await context.close();
};

const catalogParity = () => {
  const source = fs.readFileSync(path.join(root, 'src', 'i18n', 'catalogs.ts'), 'utf8');
  const esBody = source.match(/export const es = \{([\s\S]*?)\n\} as const;/)?.[1] ?? '';
  const enBody = source.match(/const en: Catalog = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  const keys = (body) => [...body.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]);
  const esKeys = keys(esBody);
  const enKeys = keys(enBody);
  return {
    esCount: esKeys.length,
    enCount: enKeys.length,
    missingInEnglish: esKeys.filter((key) => !enKeys.includes(key)),
    extraInEnglish: enKeys.filter((key) => !esKeys.includes(key)),
    pass: esKeys.length > 0 && esKeys.length === enKeys.length
      && esKeys.every((key) => enKeys.includes(key)),
  };
};

const runI18n = async () => {
  const { context, page } = await openWorkspace({ id: 'i18n', width: 1366, height: 768 });
  const spanish = {
    lang: await page.locator('html').getAttribute('lang'),
    analyze: (await page.locator('.analyze-button').innerText()).trim(),
    loadsTab: (await page.locator('#inspector-tab-loads').innerText()).trim(),
    viewTab: (await page.locator('#inspector-tab-display').innerText()).trim(),
    storage: (await page.locator('.autosave-state').innerText()).trim(),
  };
  await page.getByRole('button', { name: 'Más acciones', exact: true }).click();
  await page.locator('.utility-actions-menu').getByLabel('Idioma').selectOption('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  const english = {
    lang: await page.locator('html').getAttribute('lang'),
    analyze: (await page.locator('.analyze-button').innerText()).trim(),
    loadsTab: (await page.locator('#inspector-tab-loads').innerText()).trim(),
    viewTab: (await page.locator('#inspector-tab-display').innerText()).trim(),
    storage: (await page.locator('.autosave-state').innerText()).trim(),
    moreActionsLabel: await page.locator('.utility-more-button').getAttribute('aria-label'),
  };
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  const longCopyMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    topbarScrollWidth: document.querySelector('.topbar')?.scrollWidth ?? 0,
    topbarClientWidth: document.querySelector('.topbar')?.clientWidth ?? 0,
  }));
  output.i18n = {
    catalogs: catalogParity(),
    spanish,
    english,
    english390: longCopyMetrics,
  };
  requireCheck('i18n.catalogParity', output.i18n.catalogs.pass);
  requireCheck('i18n.spanishLang', spanish.lang === 'es', `lang=${spanish.lang}`);
  requireCheck('i18n.spanishCriticalCopy', spanish.analyze === 'Analizar' && spanish.loadsTab === 'Cargas' && spanish.viewTab === 'Vista');
  requireCheck('i18n.englishLang', english.lang === 'en', `lang=${english.lang}`);
  requireCheck('i18n.englishCriticalCopy', english.analyze === 'Analyze' && english.loadsTab === 'Loads' && english.viewTab === 'View', JSON.stringify(english));
  requireCheck('i18n.englishMoreActions', english.moreActionsLabel === 'More actions', `label=${english.moreActionsLabel}`);
  requireCheck('i18n.english390Overflow', longCopyMetrics.scrollWidth <= longCopyMetrics.clientWidth + 1, JSON.stringify(longCopyMetrics));
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-i18n-en-390x844.png') });
  await context.close();
};

const runEnglishRuntimeFlows = async () => {
  const { context, page } = await openWorkspace({ id: 'i18n-runtime-en', width: 1366, height: 768 });
  await setWorkspaceLanguage(page, 'en');

  await page.locator('.brand-home-button').click();
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  const newExerciseLauncher = page.getByRole('button', { name: 'New exercise', exact: true });
  await newExerciseLauncher.click();

  const exerciseDialog = page.getByRole('dialog', { name: 'New exercise', exact: true });
  await exerciseDialog.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.new-exercise-dialog')?.contains(document.activeElement));
  const exerciseDescription = await describedBySnapshot(exerciseDialog);
  const exerciseInitialFocusInside = await focusIsInside(exerciseDialog);
  const exerciseClose = exerciseDialog.getByRole('button', { name: 'Close', exact: true });
  const exerciseInitialFocus = await exerciseClose.evaluate((element) => (
    document.activeElement === element ? element.getAttribute('aria-label') : document.activeElement?.textContent?.trim() ?? ''
  ));

  const blankTemplate = exerciseDialog.locator('[data-template-id="blank"]');
  const simpleBeamTemplate = exerciseDialog.locator('[data-template-id="simple-beam"]');
  await blankTemplate.focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (
    document.querySelector('[data-template-id="simple-beam"]')?.getAttribute('aria-checked') === 'true'
    && document.activeElement?.getAttribute('data-template-id') === 'simple-beam'
  ));
  const exerciseKeyboard = {
    selectedSimpleBeam: await simpleBeamTemplate.getAttribute('aria-checked') === 'true',
    focusMovedToSimpleBeam: await elementHasFocus(simpleBeamTemplate),
  };
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-i18n-en-new-exercise-1366x768.png') });
  await page.keyboard.press('Escape');
  await exerciseDialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement?.classList.contains('classroom-primary'));
  const exerciseFocusReturns = await elementHasFocus(newExerciseLauncher);

  await newExerciseLauncher.click();
  const reopenedExercise = page.getByRole('dialog', { name: 'New exercise', exact: true });
  await reopenedExercise.waitFor({ state: 'visible' });
  await reopenedExercise.locator('[data-template-id="simple-beam"]').click();
  const lengthInput = reopenedExercise.getByRole('spinbutton', { name: 'Length or span', exact: true });
  const loadInput = reopenedExercise.getByRole('spinbutton', { name: 'Downward load', exact: true });
  const positionInput = reopenedExercise.getByRole('spinbutton', { name: 'Load position', exact: true });
  await lengthInput.fill('12');
  await loadInput.fill('55');
  await positionInput.fill('0.25');
  const exerciseInputs = {
    length: Number(await lengthInput.inputValue()),
    load: Number(await loadInput.inputValue()),
    position: Number(await positionInput.inputValue()),
  };
  await reopenedExercise.getByRole('button', { name: 'Create exercise', exact: true }).click();
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const stored = localStorage.getItem('structureCo.project');
    if (!stored) return false;
    const project = JSON.parse(stored);
    return project.name === 'Viga simplemente apoyada'
      && project.nodes?.find((node) => node.id === 'N2')?.x === 12;
  });
  const languageAfterExercise = await page.locator('html').getAttribute('lang');
  if (languageAfterExercise !== 'en') await setWorkspaceLanguage(page, 'en');
  const exerciseProject = await readStoredProject(page);
  const exerciseFingerprint = technicalProjectFingerprint(exerciseProject);
  const exerciseTechnicalDataPass = exerciseFingerprint.name === 'Viga simplemente apoyada'
    && JSON.stringify(exerciseFingerprint.nodes.map(({ id }) => id)) === JSON.stringify(['N1', 'N2'])
    && JSON.stringify(exerciseFingerprint.members.map(({ id }) => id)) === JSON.stringify(['M1'])
    && JSON.stringify(exerciseFingerprint.memberLoads.map(({ id }) => id)) === JSON.stringify(['ML1'])
    && exerciseFingerprint.nodes.find(({ id }) => id === 'N2')?.x === 12
    && exerciseFingerprint.members.find(({ id }) => id === 'M1')?.A === 0.01
    && exerciseFingerprint.memberLoads.find(({ id }) => id === 'ML1')?.py === -55
    && exerciseFingerprint.memberLoads.find(({ id }) => id === 'ML1')?.position === 0.25;

  const projectMenuTrigger = page.getByRole('button', { name: 'Open projects and examples', exact: true });
  await projectMenuTrigger.click();
  await page.getByRole('menuitem', { name: 'Import JSON', exact: true }).click();
  const importDialog = page.getByRole('dialog', { name: 'Import a project with context', exact: true });
  await importDialog.waitFor({ state: 'visible' });
  const importDescription = await describedBySnapshot(importDialog);
  const chooseFile = importDialog.getByRole('button', { name: 'Choose file', exact: true });
  try {
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('data-import-stage-focus') === 'select',
      null,
      { timeout: 2_000 },
    );
  } catch {
    // Keep the actual focus snapshot below so this integration failure remains actionable.
  }
  const importInitialFocus = await elementHasFocus(chooseFile);
  const importInitialFocusDetails = await page.evaluate(() => {
    const element = document.activeElement;
    return {
      tag: element?.tagName ?? null,
      className: element instanceof HTMLElement ? element.className : null,
      label: element?.getAttribute('aria-label') ?? null,
      text: element?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120) ?? null,
    };
  });
  output.i18n.runtimeEnglish = {
    partial: true,
    importCenter: {
      initialFocus: importInitialFocus,
      initialFocusDetails: importInitialFocusDetails,
    },
  };
  const importProgress = (await importDialog.getByRole('navigation', { name: 'Import progress', exact: true }).innerText())
    .split(/\s+/)
    .filter(Boolean);

  const projectJson = await page.evaluate(() => localStorage.getItem('structureCo.project'));
  if (!projectJson) throw new Error('No stored project was available for the English import runtime.');
  const beforeImportFingerprint = technicalProjectFingerprint(JSON.parse(projectJson));
  await importDialog.getByLabel('Select file to import', { exact: true }).setInputFiles({
    name: 'phase12-M1-N1-N2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(projectJson),
  });

  const contentHeading = importDialog.locator('[data-import-stage-focus="content"]');
  await contentHeading.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-import-stage-focus') === 'content');
  const contentFocus = await elementHasFocus(contentHeading);
  const contentText = (await importDialog.innerText()).replace(/\s+/g, ' ');
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-i18n-en-import-content-1366x768.png') });

  await importDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  const destinationHeading = importDialog.locator('[data-import-stage-focus="conflicts"]');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-import-stage-focus') === 'conflicts');
  const destinationFocus = await elementHasFocus(destinationHeading);
  const mergeRadio = importDialog.getByRole('radio', { name: /Merge with the current project/ });
  const mergeDescription = await describedBySnapshot(mergeRadio);

  await importDialog.getByRole('button', { name: 'Review import', exact: true }).click();
  const confirmHeading = importDialog.locator('[data-import-stage-focus="confirm"]');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-import-stage-focus') === 'confirm');
  const confirmFocus = await elementHasFocus(confirmHeading);
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-i18n-en-import-confirm-1366x768.png') });

  await importDialog.getByRole('button', { name: 'Import now', exact: true }).click();
  const resultHeading = importDialog.locator('[data-import-stage-focus="result"]');
  await resultHeading.waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-import-stage-focus') === 'result');
  const resultFocus = await elementHasFocus(resultHeading);
  const resultTitle = (await resultHeading.innerText()).trim();
  await importDialog.getByRole('button', { name: 'Open project', exact: true }).click();
  await importDialog.waitFor({ state: 'hidden' });
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  const afterImportProject = await readStoredProject(page);
  const afterImportFingerprint = technicalProjectFingerprint(afterImportProject);
  const importPreservedTechnicalData = JSON.stringify(beforeImportFingerprint) === JSON.stringify(afterImportFingerprint);
  const languageAfterImport = await page.locator('html').getAttribute('lang');
  if (languageAfterImport !== 'en') await setWorkspaceLanguage(page, 'en');

  await page.getByLabel('Calculation mode', { exact: true }).selectOption('complete');
  await page.waitForFunction(() => {
    const stored = localStorage.getItem('structureCo.project');
    return stored ? JSON.parse(stored).settings?.calculationMode === 'complete' : false;
  });
  await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
  const memberLoadSelection = await activateStructureObjectByKeyboard(page, 'memberLoad', 'ML1');
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-analysis-status]')?.getAttribute('data-analysis-status') === 'resolved', null, { timeout: 20_000 });
  const memberLoadSelectionAfterAnalysis = await activateStructureObjectByKeyboard(page, 'memberLoad', 'ML1');

  const positionField = page.locator('#workspace-inspector').getByRole('textbox', { name: 'Position', exact: true });
  await positionField.waitFor({ state: 'visible', timeout: 5_000 });
  const projectJsonBeforeValidation = await page.evaluate(() => localStorage.getItem('structureCo.project'));
  const storedPositionBefore = (await readStoredProject(page)).memberLoads.find(({ id }) => id === 'ML1')?.position;
  const analysisStatusBefore = await page.locator('[data-analysis-status]').getAttribute('data-analysis-status');
  await positionField.focus();
  await positionField.fill('1.2');
  await positionField.press('Enter');
  await page.waitForFunction(() => document.querySelector('.inspector-numeric-field input[aria-invalid="true"]') !== null);
  const validationDescription = await describedBySnapshot(positionField);
  const validationError = (await page.locator('.inspector-numeric-field__error').innerText()).trim();
  const validationErrorId = await positionField.getAttribute('aria-errormessage');
  const storedPositionAfter = (await readStoredProject(page)).memberLoads.find(({ id }) => id === 'ML1')?.position;
  const projectJsonAfterValidation = await page.evaluate(() => localStorage.getItem('structureCo.project'));
  const analysisStatusAfter = await page.locator('[data-analysis-status]').getAttribute('data-analysis-status');
  const numericValidation = {
    label: await positionField.evaluate((element) => element.labels?.[0]?.textContent?.trim() ?? ''),
    draft: await positionField.inputValue(),
    ariaInvalid: await positionField.getAttribute('aria-invalid'),
    ariaErrorMessage: validationErrorId,
    describedBy: validationDescription,
    error: validationError,
    storedPositionBefore,
    storedPositionAfter,
    preservedStoredValue: storedPositionBefore === storedPositionAfter,
    projectJsonUnchanged: projectJsonBeforeValidation === projectJsonAfterValidation,
    analysisStatusBefore,
    analysisStatusAfter,
  };
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-i18n-en-numeric-validation-1366x768.png') });
  await positionField.focus();
  await positionField.press('Escape');
  await page.waitForFunction(() => document.querySelector('.inspector-numeric-field input[aria-invalid="true"]') === null);

  const memberSelection = await activateStructureObjectByKeyboard(page, 'member', 'M1');
  const momentTab = page.getByRole('tab', { name: 'Moment', exact: true });
  await momentTab.click();
  const momentChart = page.locator('.diagram-chart.moment');
  await momentChart.waitFor({ state: 'visible' });
  const momentGraph = momentChart.getByRole('img');
  const momentGraphLabel = await momentGraph.getAttribute('aria-label');
  const momentMember = await momentChart.getByRole('combobox', { name: 'Member for diagram', exact: true }).inputValue();

  await page.getByRole('tab', { name: 'Deformed', exact: true }).click();
  const deformationChart = page.getByTestId('deformation-chart');
  await deformationChart.waitFor({ state: 'visible' });
  const deformationGraphLabel = await deformationChart.getByRole('img').getAttribute('aria-label');
  const deformationMember = await deformationChart.getByRole('combobox', { name: 'Member for deformation', exact: true }).inputValue();

  const learnTab = page.getByRole('tab', { name: 'Learn', exact: true });
  const learnFamily = await describedBySnapshot(learnTab);
  await learnTab.click();
  const explorer = page.getByRole('region', { name: 'Stiffness-method explorer', exact: true });
  await explorer.waitFor({ state: 'visible' });
  const methodStages = explorer.getByRole('tablist', { name: 'Method stages', exact: true });
  const modelStage = explorer.getByRole('tab', { name: 'Model', exact: true });
  const results = {
    analysisStatus: await page.locator('[data-analysis-status]').getAttribute('data-analysis-status'),
    selectionSemantics: memberSelection,
    moment: {
      tabDescribedBy: await describedBySnapshot(momentTab),
      graphLabel: momentGraphLabel,
      member: momentMember,
    },
    deformed: {
      graphLabel: deformationGraphLabel,
      member: deformationMember,
    },
    understand: {
      tabDescribedBy: learnFamily,
      explorerVisible: await explorer.isVisible(),
      stageTablistVisible: await methodStages.isVisible(),
      modelStageSelected: await modelStage.getAttribute('aria-selected') === 'true',
    },
  };
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-i18n-en-results-understand-1366x768.png') });

  await page.getByRole('tab', { name: 'Influence', exact: true }).click();
  const influenceRegion = page.getByRole('region', { name: 'Influence line and axle train', exact: true });
  await influenceRegion.waitFor({ state: 'visible' });
  const influenceMemberBefore = await influenceRegion.getByRole('combobox', { name: 'Target member', exact: true }).inputValue();
  await influenceRegion.getByRole('button', { name: 'Calculate', exact: true }).click();
  const influenceGraph = influenceRegion.getByRole('img', { name: /Influence line M at M1/ });
  await influenceGraph.waitFor({ state: 'visible', timeout: 20_000 });
  const influence = {
    targetMember: influenceMemberBefore,
    graphLabel: await influenceGraph.getAttribute('aria-label'),
    technicalSelection: (await influenceRegion.innerText()).includes('1 member · M1'),
    calculateLabel: 'Calculate',
  };
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-i18n-en-influence-1366x768.png') });

  const afterRuntimeFingerprint = technicalProjectFingerprint(await readStoredProject(page));
  const runtimePreservedTechnicalData = JSON.stringify(afterImportFingerprint) === JSON.stringify(afterRuntimeFingerprint);
  output.i18n.runtimeEnglish = {
    newExercise: {
      description: exerciseDescription,
      initialFocusInside: exerciseInitialFocusInside,
      initialFocus: exerciseInitialFocus,
      keyboard: exerciseKeyboard,
      focusReturns: exerciseFocusReturns,
      inputs: exerciseInputs,
      languageAfterCreate: languageAfterExercise,
      effectiveLanguage: await page.locator('html').getAttribute('lang'),
      technicalFingerprint: exerciseFingerprint,
      technicalDataPass: exerciseTechnicalDataPass,
    },
    importCenter: {
      description: importDescription,
      progress: importProgress,
      initialFocus: importInitialFocus,
      initialFocusDetails: importInitialFocusDetails,
      contentFocus,
      contentPreservesProjectName: contentText.includes(exerciseFingerprint.name),
      contentPreservesFilename: contentText.includes('phase12-M1-N1-N2.json'),
      destinationFocus,
      mergeDescription,
      confirmFocus,
      resultFocus,
      resultTitle,
      beforeFingerprint: beforeImportFingerprint,
      afterFingerprint: afterImportFingerprint,
      preservedTechnicalData: importPreservedTechnicalData,
      languageAfterOpen: languageAfterImport,
    },
    numericValidation: {
      ...numericValidation,
      selectionSemantics: memberLoadSelection,
      selectionSemanticsAfterAnalysis: memberLoadSelectionAfterAnalysis,
    },
    results,
    influence,
    technicalDataPreservedThroughRuntime: runtimePreservedTechnicalData,
  };

  requireCheck(
    'i18n.runtime.newExercise.description',
    exerciseDescription.text.includes('Start from scratch or generate a model with editable geometry, supports, and load.'),
    JSON.stringify(exerciseDescription),
  );
  requireCheck('i18n.runtime.newExercise.initialFocus', exerciseInitialFocusInside && exerciseInitialFocus === 'Close', `focus=${exerciseInitialFocus}`);
  requireCheck('i18n.runtime.newExercise.arrowNavigation', Object.values(exerciseKeyboard).every(Boolean), JSON.stringify(exerciseKeyboard));
  requireCheck('i18n.runtime.newExercise.focusReturns', exerciseFocusReturns);
  requireCheck(
    'i18n.runtime.newExercise.inputs',
    exerciseInputs.length === 12 && exerciseInputs.load === 55 && exerciseInputs.position === 0.25,
    JSON.stringify(exerciseInputs),
  );
  requireCheck('i18n.runtime.newExercise.technicalData', exerciseTechnicalDataPass, JSON.stringify(exerciseFingerprint));
  requireCheck(
    'i18n.runtime.import.description',
    importDescription.text.includes('Review the file before opening it and decide exactly what to keep.'),
    JSON.stringify(importDescription),
  );
  requireCheck('i18n.runtime.import.initialFocus', importInitialFocus, JSON.stringify(importInitialFocusDetails));
  requireCheck(
    'i18n.runtime.import.stageFocus',
    contentFocus && destinationFocus && confirmFocus && resultFocus,
    JSON.stringify({ contentFocus, destinationFocus, confirmFocus, resultFocus }),
  );
  requireCheck(
    'i18n.runtime.import.mergeDescription',
    mergeDescription.text.some((text) => text.includes('Merge is unavailable until identifiers, units, and duplicate cases can be resolved safely.')),
    JSON.stringify(mergeDescription),
  );
  requireCheck('i18n.runtime.import.projectName', contentText.includes(exerciseFingerprint.name));
  requireCheck('i18n.runtime.import.filename', contentText.includes('phase12-M1-N1-N2.json'));
  requireCheck('i18n.runtime.import.technicalData', importPreservedTechnicalData);
  requireCheck(
    'i18n.runtime.numericValidation',
    memberLoadSelection.role === 'button'
      && memberLoadSelection.tabIndex === 0
      && memberLoadSelection.ariaKeyShortcuts?.includes('Enter')
      && memberLoadSelection.focused
      && memberLoadSelection.selected
      && memberLoadSelectionAfterAnalysis.focused
      && memberLoadSelectionAfterAnalysis.selected
      && numericValidation.ariaInvalid === 'true'
      && numericValidation.error === 'Use a value between 0 and 1.'
      && numericValidation.ariaErrorMessage !== null
      && numericValidation.describedBy.ids.includes(numericValidation.ariaErrorMessage)
      && numericValidation.preservedStoredValue
      && numericValidation.projectJsonUnchanged
      && numericValidation.analysisStatusBefore === 'resolved'
      && numericValidation.analysisStatusAfter === 'resolved',
    JSON.stringify(numericValidation),
  );
  requireCheck(
    'i18n.runtime.results.moment',
    memberSelection.role === 'button'
      && memberSelection.tabIndex === 0
      && memberSelection.ariaKeyShortcuts?.includes('Enter')
      && memberSelection.focused
      && memberSelection.selected
      && results.analysisStatus === 'resolved'
      && results.moment.graphLabel?.includes('Bending moment diagram')
      && results.moment.graphLabel?.includes('M1')
      && results.moment.member === 'M1',
    JSON.stringify(results.moment),
  );
  requireCheck(
    'i18n.runtime.results.deformed',
    results.deformed.graphLabel?.includes('M1') && results.deformed.member === 'M1',
    JSON.stringify(results.deformed),
  );
  requireCheck(
    'i18n.runtime.results.understand',
    results.understand.tabDescribedBy.text.includes('Understand')
      && results.understand.explorerVisible
      && results.understand.stageTablistVisible
      && results.understand.modelStageSelected,
    JSON.stringify(results.understand),
  );
  requireCheck(
    'i18n.runtime.results.influence',
    influence.targetMember === 'M1'
      && influence.graphLabel?.includes('Influence line M at M1')
      && influence.technicalSelection,
    JSON.stringify(influence),
  );
  requireCheck('i18n.runtime.technicalDataPreserved', runtimePreservedTechnicalData);
  await context.close();
};

const runOfflineLocalFirst = async () => {
  const { context, page } = await openWorkspace({ id: 'offline-local-first', width: 1366, height: 768 });
  await context.setOffline(true);
  const storage = page.locator('.autosave-state');
  await storage.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.autosave-state')?.getAttribute('data-storage-state') === 'offline');
  const offlineState = {
    state: await storage.getAttribute('data-storage-state'),
    label: (await storage.innerText()).trim(),
    description: await storage.getAttribute('title'),
  };
  const offlineName = 'Proyecto local sin conexión QA';
  const projectName = page.getByLabel('Nombre del proyecto');
  await projectName.fill(offlineName);
  await projectName.press('Enter');
  await page.waitForFunction((expected) => {
    const stored = localStorage.getItem('structureCo.project');
    return stored ? JSON.parse(stored).name === expected : false;
  }, offlineName);
  const persistedName = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.project') ?? '{}').name);
  output.offlineLocalFirst = {
    ...offlineState,
    editedWhileOffline: (await projectName.inputValue()) === offlineName,
    persistedLocally: persistedName === offlineName,
    persistedName,
    scope: 'Current session and local browser persistence; no offline reload/PWA guarantee.',
  };
  requireCheck('offline.state', offlineState.state === 'offline', JSON.stringify(offlineState));
  requireCheck('offline.actionableCopy', offlineState.label.includes('Sin conexión') && offlineState.description?.includes('seguir trabajando'), JSON.stringify(offlineState));
  requireCheck('offline.edit', output.offlineLocalFirst.editedWhileOffline);
  requireCheck('offline.persistence', output.offlineLocalFirst.persistedLocally, `persisted=${persistedName}`);
  await page.screenshot({ path: path.join(evidenceDir, 'phase12-offline-local-first-1366x768.png') });
  await context.setOffline(false);
  await context.close();
};

const runKeyboardFocus = async () => {
  const desktop = await openWorkspace({ id: 'keyboard-desktop', width: 1366, height: 768 });
  const inspectorTab = desktop.page.locator('#inspector-tab-inspector');
  await inspectorTab.focus();
  await desktop.page.keyboard.press('ArrowRight');
  const loadsTab = desktop.page.locator('#inspector-tab-loads');
  const desktopChecks = {
    arrowSelectsNextTab: await loadsTab.getAttribute('aria-selected') === 'true',
    arrowMovesFocus: await loadsTab.evaluate((element) => document.activeElement === element),
  };
  await desktop.page.keyboard.press('Home');
  desktopChecks.homeReturnsFirstTab = await inspectorTab.getAttribute('aria-selected') === 'true'
    && await inspectorTab.evaluate((element) => document.activeElement === element);
  output.keyboardFocus.desktopTabs = desktopChecks;
  Object.entries(desktopChecks).forEach(([name, pass]) => requireCheck(`keyboard.desktop.${name}`, pass));
  await desktop.context.close();

  const mobile = await openWorkspace({ id: 'keyboard-mobile', width: 390, height: 844 });
  const launcher = mobile.page.locator('.mobile-inspector-toggle');
  await launcher.focus();
  await mobile.page.keyboard.press('Enter');
  const dialog = mobile.page.locator('.inspector-panel.mobile-open');
  await dialog.waitFor({ state: 'visible' });
  await mobile.page.waitForFunction(() => document.querySelector('.inspector-panel.mobile-open')?.contains(document.activeElement));
  const mobileChecks = {
    dialogSemantics: await dialog.getAttribute('role') === 'dialog' && await dialog.getAttribute('aria-modal') === 'true',
    initialFocusInside: await dialog.evaluate((element) => element.contains(document.activeElement)),
  };
  await mobile.page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await mobile.page.waitForFunction(() => document.activeElement?.classList.contains('mobile-inspector-toggle'));
  mobileChecks.escapeCloses = await dialog.isHidden();
  mobileChecks.focusReturns = await launcher.evaluate((element) => document.activeElement === element);
  output.keyboardFocus.mobileInspector = mobileChecks;
  Object.entries(mobileChecks).forEach(([name, pass]) => requireCheck(`keyboard.mobile.${name}`, pass));
  await mobile.context.close();
};

const runResponsive = async () => {
  for (const spec of [
    { id: 'mobile', width: 390, height: 844 },
    { id: 'tablet', width: 834, height: 1194 },
    { id: 'desktop', width: 1366, height: 768 },
  ]) {
    const { context, page } = await openWorkspace({ id: `responsive-${spec.id}`, ...spec });
    const before = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    const checks = {
      noHorizontalOverflow: before.scrollWidth <= before.clientWidth + 1,
      canvasVisible: await page.locator('svg.structural-canvas').isVisible(),
    };
    let inspectorBox = null;
    if (spec.width < 1024) {
      await page.locator('.mobile-inspector-toggle').click();
      const inspector = page.locator('.inspector-panel.mobile-open');
      await inspector.waitFor({ state: 'visible' });
      await waitForAnimations(inspector);
      inspectorBox = await inspector.boundingBox();
      const after = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      checks.inspectorWithinViewport = Boolean(inspectorBox
        && inspectorBox.x >= -1
        && inspectorBox.y >= -1
        && inspectorBox.x + inspectorBox.width <= spec.width + 1
        && inspectorBox.y + inspectorBox.height <= spec.height + 1);
      checks.noOverlayHorizontalOverflow = after.scrollWidth <= after.clientWidth + 1;
    } else {
      checks.persistentInspector = await page.locator('.inspector-panel').isVisible();
    }
    output.responsive[spec.id] = { viewport: `${spec.width}x${spec.height}`, before, inspectorBox, checks };
    Object.entries(checks).forEach(([name, pass]) => requireCheck(`responsive.${spec.id}.${name}`, pass, JSON.stringify({ before, inspectorBox })));
    await page.screenshot({ path: path.join(evidenceDir, `phase12-overflow-${spec.width}x${spec.height}.png`) });
    await context.close();
  }
};

const runGroup = async (name, callback) => {
  try {
    await callback();
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    output.runtimeErrors.push(`${name}: ${message}`);
    output.failures.push(`${name}: runtime error`);
  }
};

await runGroup('contrast', runContrast);
await runGroup('reducedMotion', runReducedMotion);
await runGroup('i18n', runI18n);
await runGroup('i18nRuntime', runEnglishRuntimeFlows);
await runGroup('offlineLocalFirst', runOfflineLocalFirst);
await runGroup('keyboardFocus', runKeyboardFocus);
await runGroup('responsive', runResponsive);

await browser.close();
await previewServer.close();

if (output.console.length || output.pageErrors.length) {
  output.failures.push('console/page errors');
}

const metricsPath = path.join(evidenceDir, 'phase12-metrics.json');
fs.writeFileSync(metricsPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));

if (output.failures.length) {
  throw new Error(`QA Fase 12 fallida: ${output.failures.join('; ')}`);
}
