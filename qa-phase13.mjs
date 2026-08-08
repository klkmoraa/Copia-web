import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(root, 'dist', 'assets');
const evidenceDir = path.join(root, 'docs', 'ux-redesign', 'evidence', 'phase-13', 'after');
fs.mkdirSync(evidenceDir, { recursive: true });

const baseline = {
  commit: '49090f5',
  synchronous: { raw: 535_518, gzip: 141_782 },
  earlyWorkspace: { raw: 402_008, gzip: 107_661 },
};

const assetRows = fs.readdirSync(assetsDir)
  .filter((file) => fs.statSync(path.join(assetsDir, file)).isFile())
  .map((file) => {
    const contents = fs.readFileSync(path.join(assetsDir, file));
    return {
      file,
      raw: contents.length,
      gzip: zlib.gzipSync(contents, { level: 9 }).length,
    };
  });

const findAsset = (pattern) => assetRows.find(({ file }) => pattern.test(file));
const sumAssets = (rows) => rows.reduce(
  (total, row) => ({ raw: total.raw + (row?.raw ?? 0), gzip: total.gzip + (row?.gzip ?? 0) }),
  { raw: 0, gzip: 0 },
);

const indexHtml = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const modulePreloads = [...indexHtml.matchAll(/rel="modulepreload"[^>]+href="\.\/assets\/([^"]+)"/g)]
  .map((match) => match[1]);
const entryNames = new Set([
  findAsset(/^index-.*\.js$/)?.file,
  findAsset(/^index-.*\.css$/)?.file,
  ...modulePreloads,
].filter(Boolean));
const entryRows = assetRows.filter(({ file }) => entryNames.has(file));
const workspaceRows = [
  findAsset(/^WorkspaceShell-.*\.js$/),
  findAsset(/^WorkspaceShell-.*\.css$/),
  findAsset(/^solver-.*\.js$/),
  findAsset(/^units-.*\.js$/),
].filter(Boolean);
const influenceRow = findAsset(/^InfluenceLineView-.*\.js$/);
const exerciseRow = findAsset(/^NewExerciseDialog-.*\.js$/);
const synchronous = sumAssets(entryRows);
const earlyWorkspace = sumAssets(workspaceRows);

const output = {
  phase: 13,
  generatedAt: new Date().toISOString(),
  baseline,
  bundle: {
    synchronous,
    earlyWorkspace,
    deltas: {
      synchronousRaw: synchronous.raw - baseline.synchronous.raw,
      synchronousGzip: synchronous.gzip - baseline.synchronous.gzip,
      earlyWorkspaceRaw: earlyWorkspace.raw - baseline.earlyWorkspace.raw,
      earlyWorkspaceGzip: earlyWorkspace.gzip - baseline.earlyWorkspace.gzip,
    },
    lazy: {
      influence: influenceRow ?? null,
      newExercise: exerciseRow ?? null,
    },
    assets: assetRows.sort((left, right) => right.raw - left.raw),
  },
  removal: {},
  runtime: {
    requestedAssets: [],
    checks: {},
  },
  console: [],
  pageErrors: [],
  failures: [],
};

const requireCheck = (name, condition, detail = '') => {
  output.runtime.checks[name] = Boolean(condition);
  if (!condition) output.failures.push(detail ? `${name}: ${detail}` : name);
};

const waitForFiniteAnimations = (page) => page.evaluate(async () => {
  const animations = document.getAnimations().filter((animation) => {
    const iterations = animation.effect?.getTiming().iterations;
    return iterations !== Number.POSITIVE_INFINITY;
  });
  await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
});

for (const relativePath of [
  'src/App.css',
  'src/index.css',
  'src/assets/hero.png',
  'src/assets/react.svg',
  'src/assets/vite.svg',
]) {
  output.removal[relativePath] = !fs.existsSync(path.join(root, relativePath));
}

requireCheck(
  'synchronousBundleDidNotRegress',
  synchronous.gzip <= baseline.synchronous.gzip * 1.02,
  `${synchronous.gzip} gzip bytes vs ${baseline.synchronous.gzip}`,
);
requireCheck(
  'earlyWorkspaceBundleDidNotRegress',
  earlyWorkspace.gzip <= baseline.earlyWorkspace.gzip + 1_024,
  `${earlyWorkspace.gzip} gzip bytes vs ${baseline.earlyWorkspace.gzip}`,
);
requireCheck('influenceHasDedicatedChunk', Boolean(influenceRow));
requireCheck('confirmedOrphansRemoved', Object.values(output.removal).every(Boolean));

const previewServer = await preview({
  root,
  preview: { host: '127.0.0.1', port: 4183, strictPort: true },
  logLevel: 'error',
});

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-MX' });
  const page = await context.newPage();
  const requestedAssets = new Set();
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes('/assets/')) requestedAssets.add(path.basename(url.pathname));
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      output.console.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => output.pageErrors.push(String(error)));

  await page.goto('http://127.0.0.1:4183/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });

  requireCheck(
    'influenceNotLoadedOnWelcome',
    ![...requestedAssets].some((file) => /^InfluenceLineView-.*\.js$/.test(file)),
  );

  await page.locator('.welcome-example-card').first().click();
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /^Analizar$/i }).click();
  await page.getByTestId('diagram-chart').waitFor({ state: 'visible', timeout: 10_000 });

  requireCheck(
    'influenceNotLoadedBeforeActivation',
    ![...requestedAssets].some((file) => /^InfluenceLineView-.*\.js$/.test(file)),
  );

  await page.getByRole('tab', { name: /^Influencia$/i }).click();
  await page.getByRole('region', { name: /Línea de influencia y tren de ejes/i }).waitFor({ state: 'visible', timeout: 10_000 });
  await waitForFiniteAnimations(page);
  requireCheck(
    'influenceLoadedOnActivation',
    [...requestedAssets].some((file) => /^InfluenceLineView-.*\.js$/.test(file)),
  );
  await page.screenshot({
    path: path.join(evidenceDir, 'phase13-lazy-influence-1366x768.png'),
    fullPage: false,
  });

  await page.getByRole('button', { name: /Ir al inicio/i }).click();
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /Nuevo ejercicio/i }).click();
  await page.getByRole('dialog', { name: /Nuevo ejercicio/i }).waitFor({ state: 'visible' });
  await waitForFiniteAnimations(page);
  if (exerciseRow) {
    requireCheck(
      'newExerciseLoadedOnActivation',
      [...requestedAssets].some((file) => /^NewExerciseDialog-.*\.js$/.test(file)),
    );
  }
  await page.screenshot({
    path: path.join(evidenceDir, 'phase13-shared-modal-focus-1366x768.png'),
    fullPage: false,
  });

  output.runtime.requestedAssets = [...requestedAssets].sort();
  await context.close();
} finally {
  await browser.close();
  await previewServer.close();
}

requireCheck('consoleClean', output.console.length === 0, output.console.join(' | '));
requireCheck('pageErrorsClean', output.pageErrors.length === 0, output.pageErrors.join(' | '));

fs.writeFileSync(
  path.join(evidenceDir, 'phase13-metrics.json'),
  JSON.stringify(output, null, 2),
);
console.log(JSON.stringify(output, null, 2));
if (output.failures.length) {
  throw new Error(`QA Fase 13 fallida: ${output.failures.join('; ')}`);
}
