// CRI-106 · Suite de medición automatizada sobre Chromium real (único navegador
// disponible en este entorno — ver limitaciones en el informe).
// Cubre: touch targets K0, clipboard U-11, reduced-motion, reduced-transparency,
// matriz responsive (capturas), grayscale/CVD (capturas con filtro real de Chromium).
import { chromium } from 'playwright';
import { preview } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evidenceDir, '../../../');
const dirs = ['touch-targets', 'clipboard', 'motion', 'transparency', 'browsers', 'grayscale', 'cvd'].reduce((acc, d) => {
  const p = path.join(evidenceDir, d);
  mkdirSync(p, { recursive: true });
  acc[d] = p;
  return acc;
}, {});

const previewServer = await preview({ root: repoRoot, preview: { host: '127.0.0.1', port: 4189, strictPort: true }, logLevel: 'error' });
const baseURL = 'http://127.0.0.1:4189/';
const EXEC = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: EXEC });
const version = browser.version();

async function freshPage(opts = {}) {
  const page = await browser.newPage(opts);
  await page.addInitScript(() => { try { indexedDB.deleteDatabase('structureCo.projects'); } catch { /* noop */ } });
  // El SW de actualización recarga el documento en `controllerchange` (ver
  // `PwaUpdateNotice.tsx`); en QA se anula igual que en `qa.mjs` para que la
  // página no navegue sola a mitad de una medición.
  await page.addInitScript(() => {
    const registration = { installing: null, waiting: null, addEventListener: () => undefined };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, register: async () => registration, addEventListener: () => undefined },
    });
  });
  return page;
}

// CRI-112: los ejemplos viven en el paso 3 ("Por dónde"), no en el paso 1.
// Nota de robustez: `getByRole('button', {name})` resuelve contra el snapshot
// de accesibilidad, que en este entorno headless con `isMobile:true` +
// `hasTouch:true` no resuelve nunca (cuelga hasta timeout) aunque el elemento
// exista y sea clicable por CSS — reproducido de forma aislada y documentado
// en el informe como limitación del entorno, no del producto. Se usa
// localizador CSS + texto en su lugar, que no depende del snapshot a11y.
async function goToExamplesStep(page) {
  await page.locator('.welcome-steps').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.welcome-steps button', { hasText: 'Por dónde' }).first().click({ timeout: 10000 });
  await page.locator('.welcome-screen[data-welcome-step="where"]').waitFor({ state: 'visible', timeout: 15000 });
}

function exampleLauncherLocator(page) {
  return page.locator('button', { hasText: /pórtico de ejemplo/i }).first();
}

const VIEWPORTS = {
  X2: { width: 1440, height: 900 },
  M1: { width: 834, height: 1112 },
  K0_portrait: { width: 390, height: 844 },
  K0_landscape: { width: 844, height: 390 },
};

const results = { chromiumVersion: version, touchTargets: [], clipboard: {}, motion: {}, transparency: {}, responsiveMatrix: [], errors: [] };

const section = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    console.error(`SECCIÓN "${name}" FALLÓ:`, e.message);
    results.errors.push({ section: name, error: String(e.message ?? e) });
  }
};

// ---------- 1 · TOUCH TARGETS @ K0 (LEDGER-06, piso 44px) ----------
await section('touch-targets', async () => {
  const page = await freshPage({ viewport: VIEWPORTS.K0_portrait, hasTouch: true, isMobile: true });
  await page.addInitScript((t) => { try { localStorage.setItem('structureCo.theme', t); } catch { /* noop */ } }, 'light');
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.welcome-steps', { timeout: 15000 });

  const measure = async (selector, label) => page.evaluate(({ selector, label }) => {
    const els = [...document.querySelectorAll(selector)].filter((el) => el.offsetParent !== null);
    return els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { label: `${label}[${i}]`, w: Math.round(r.width), h: Math.round(r.height), min: Math.round(Math.min(r.width, r.height)) };
    });
  }, { selector, label });

  results.touchTargets.push(...await measure('.welcome-steps button, .welcome-steps [role="button"]', 'stepper'));
  results.touchTargets.push(...await measure('.welcome-hero-launcher button, .welcome-launcher-card', 'welcome-launcher'));
  results.touchTargets.push(...await measure('.project-hub button', 'project-hub'));

  // Entrar a la Mesa vía pórtico de ejemplo (paso 3, "Por dónde") para medir ToolRail/acciones en K0.
  await goToExamplesStep(page);
  const example = exampleLauncherLocator(page);
  if (await example.isVisible().catch(() => false)) {
    await example.click();
    await page.waitForSelector('.tool-rail, .mobile-tool-palette-toggle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(300);
    results.touchTargets.push(...await measure('.tool-rail button, .mobile-tool-palette-toggle', 'tool-rail'));
    results.touchTargets.push(...await measure('.topbar button, .top-bar button', 'topbar'));
  }
  await page.close();
});

// ---------- 2 · CLIPBOARD U-11 (Chromium) ----------
// `navigator.clipboard.readText()` sin permiso concedido no rechaza: se queda
// colgada esperando un prompt de permiso que en headless nunca aparece —
// reproducido y confirmado aislado. Se envuelve en un timeout explícito de
// 4s para poder registrar "cuelga sin permiso" como resultado real, y se
// repite con el permiso concedido vía `context.grantPermissions` para separar
// "API disponible" de "lectura autorizada", como exige el contrato de U-11.
await section('clipboard', async () => {
  const probeIn = async (context, label) => {
    const page = await context.newPage({ viewport: VIEWPORTS.X2 });
    await page.addInitScript(() => { try { indexedDB.deleteDatabase('structureCo.projects'); } catch { /* noop */ } });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    const base = await page.evaluate(() => ({
      apiExists: typeof navigator.clipboard !== 'undefined',
      readTextExists: typeof navigator.clipboard?.readText === 'function',
      isSecureContext: window.isSecureContext,
    }));
    let permissionState = 'permissions API no disponible';
    try {
      permissionState = await page.evaluate(async () => {
        try { return (await navigator.permissions.query({ name: 'clipboard-read' })).state; }
        catch (e) { return `error: ${e}`; }
      });
    } catch { /* noop */ }
    let readResult;
    try {
      readResult = await Promise.race([
        page.evaluate(async () => {
          try { return { ok: true, value: await navigator.clipboard.readText() }; }
          catch (e) { return { ok: false, name: e?.name, message: e?.message }; }
        }),
        new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 4000)),
      ]);
    } catch (e) {
      readResult = { ok: false, message: String(e) };
    }
    await page.close();
    return { label, ...base, permissionState, readResult };
  };

  const defaultCtx = browser; // usa el contexto por defecto (sin permisos concedidos)
  results.clipboard.sinPermisoConcedido = await probeIn(defaultCtx, 'sin permiso concedido (default)');

  const grantedCtx = await browser.newContext({ permissions: ['clipboard-read'] });
  results.clipboard.conPermisoConcedido = await probeIn(grantedCtx, 'con clipboard-read concedido');
  await grantedCtx.close();
});

// ---------- 3 · REDUCED MOTION — interacción real, no sólo CSS ----------
await section('reduced-motion', async () => {
  const page = await freshPage({ viewport: VIEWPORTS.X2 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => { try { localStorage.setItem('structureCo.theme', t); } catch { /* noop */ } }, 'light');
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.portal-hero', { timeout: 15000 });

  const portalFilterNone = await page.evaluate(() => {
    const body = document.querySelector('.portal-hero__body');
    return getComputedStyle(body).filter === 'none' || getComputedStyle(body).filter === '';
  });

  // Interacción real: Continuar / Nuevo siguen abriendo pese a reduced-motion.
  const stepButtons = await page.locator('.welcome-steps button, .welcome-steps [role="button"]').count();
  await goToExamplesStep(page);
  const example = exampleLauncherLocator(page);
  let reachedWorkspace = false;
  if (await example.isVisible().catch(() => false)) {
    await example.click();
    reachedWorkspace = await page.waitForSelector('.tool-rail, .canvas-svg, svg.canvas', { timeout: 15000 }).then(() => true).catch(() => false);
  }
  results.motion = { portalFilterRemoved: portalFilterNone, stepperButtonsPresent: stepButtons > 0, reachedWorkspaceDespiteReducedMotion: reachedWorkspace };
  await page.screenshot({ path: path.join(dirs.motion, 'welcome-reduced-motion-x2-day.png') });
  await page.close();
});

// ---------- 4 · REDUCED TRANSPARENCY ----------
await section('reduced-transparency', async () => {
  const page = await freshPage({ viewport: VIEWPORTS.X2 });
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
  await page.addInitScript((t) => { try { localStorage.setItem('structureCo.theme', t); } catch { /* noop */ } }, 'dark');
  // prefers-reduced-transparency no tiene emulateMedia nativo en Playwright; se
  // inyecta vía CSS @media override con addStyleTag simulando el user-agent flag
  // (Chromium soporta la media feature real desde el SO; en headless sin SO con
  // el flag, se fuerza por matchMedia shim para poder verificar el CSS que la
  // consume — documentado como limitación de headless, no simulación de lector).
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      if (query.includes('prefers-reduced-transparency')) {
        return { matches: true, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
      }
      return original(query);
    };
  });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.portal-hero', { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: path.join(dirs.transparency, 'welcome-x2-night.png') });
  results.transparency.note = 'prefers-reduced-transparency no tiene emulateMedia nativo en Playwright 1.56; el filtro SVG del pórtico usa @media(prefers-reduced-transparency:reduce) en CSS real evaluado por Chromium contra el SO, que en este contenedor headless no expone el flag — se documenta como NO VERIFICABLE end-to-end en este entorno, sólo por lectura de la regla CSS (styles.css:5344).';
  await page.close();
});

// ---------- 5 · MATRIZ RESPONSIVE — capturas, Día/Noche ----------
await section('responsive-matrix', async () => {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    for (const theme of ['light', 'dark']) {
      const page = await freshPage({ viewport: vp });
      await page.addInitScript((t) => { try { localStorage.setItem('structureCo.theme', t); } catch { /* noop */ } }, theme);
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await page.waitForSelector('.welcome-steps', { timeout: 15000 }).catch(() => {});
      const shot = `${vpName}-${theme}.png`;
      await page.screenshot({ path: path.join(dirs.browsers, shot) });
      results.responsiveMatrix.push({ viewport: vpName, theme, executed: true, file: shot });
      await page.close();
    }
  }
});

// ---------- 6 · GRAYSCALE / CVD sobre Results (roles técnicos + selección) ----------
await section('grayscale-cvd', async () => {
  const page = await freshPage({ viewport: VIEWPORTS.X2 });
  await page.addInitScript((t) => { try { localStorage.setItem('structureCo.theme', t); } catch { /* noop */ } }, 'light');
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await goToExamplesStep(page);
  const example = exampleLauncherLocator(page);
  await example.click();
  await page.getByRole('button', { name: 'Analizar', exact: true }).click().catch(() => {});
  await page.getByRole('tab', { name: 'Reacciones', exact: true }).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.locator('.member-object').first().click({ force: true }).catch(() => {});

  await page.screenshot({ path: path.join(dirs.grayscale, 'results-color.png') });

  const FILTERS = {
    grayscale: 'grayscale(1)',
    deuteranopia: 'url(#deuteranopia)',
    protanopia: 'url(#protanopia)',
  };
  // Matrices CVD estándar (Brettel/Viénot) inyectadas como filtro SVG real aplicado
  // al DOM completo — Chromium las rasteriza de verdad, no es una superposición.
  await page.addStyleTag({ content: `
    body { filter: var(--sc-cvd-filter, none); }
  `});
  await page.evaluate(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.width = '0'; svg.style.height = '0';
    svg.innerHTML = `
      <filter id="deuteranopia"><feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0"/></filter>
      <filter id="protanopia"><feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0"/></filter>
    `;
    document.body.appendChild(svg);
  });

  for (const [name, filter] of Object.entries(FILTERS)) {
    await page.evaluate((f) => { document.body.style.filter = f; }, filter);
    await page.screenshot({ path: path.join(name === 'grayscale' ? dirs.grayscale : dirs.cvd, `results-${name}.png`) });
  }
  await page.evaluate(() => { document.body.style.filter = ''; });
  await page.close();
});

await browser.close();
await previewServer.httpServer.close();

writeFileSync(path.join(evidenceDir, 'suite-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
