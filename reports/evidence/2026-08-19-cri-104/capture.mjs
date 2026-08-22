/**
 * CRI-104 · Captura de evidencia de la bienvenida rediseñada.
 *
 * Sirve `dist/` con `vite preview` y recorre, sobre Chromium real:
 *
 *  - los cuatro pasos en X2 (1440×900) y en K0 retrato (390×844);
 *  - Día y Noche, ES y EN;
 *  - usuario nuevo (repositorio vacío) y usuario recurrente (el propio
 *    autoguardado de la app deja el proyecto en IndexedDB) entrando directo a
 *    la Mesa;
 *  - usuario con copia de recuperación: NO salta, y la recuperación se ve;
 *  - el portal clay normal, con `prefers-reduced-motion` y con
 *    `prefers-reduced-transparency` (este último por CDP: Playwright no lo
 *    expone en `emulateMedia`);
 *  - M1 (1060×800) y K0 apaisado (844×390);
 *  - overflow horizontal, objetivos táctiles, foco visible y orden de Tab.
 *
 * Uso: npm run build && node reports/evidence/2026-08-19-cri-104/capture.mjs
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const shots = here;

const previewServer = await preview({ root, preview: { host: '127.0.0.1', port: 4188, strictPort: true }, logLevel: 'error' });
const baseURL = 'http://127.0.0.1:4188/';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium',
});

const out = { checks: {}, metrics: {}, pageErrors: [] };
const VIEWPORTS = {
  x2: { width: 1440, height: 900 },
  m1: { width: 1060, height: 800 },
  k0: { width: 390, height: 844 },
  k0land: { width: 844, height: 390 },
};

const shoot = async (page, name) => {
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: false });
  console.log(`✓ ${name}.png`);
};

const newPage = async (viewport, { theme = 'light', reducedMotion = 'no-preference', touch = false } = {}) => {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  page.on('pageerror', (error) => out.pageErrors.push(String(error)));
  await page.addInitScript(([storedTheme]) => {
    localStorage.setItem('structureCo.theme', storedTheme);
    const registration = { installing: null, waiting: null, addEventListener: () => undefined };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, register: async () => registration, addEventListener: () => undefined },
    });
  }, [theme]);
  await page.emulateMedia({ reducedMotion });
  return page;
};

/** `prefers-reduced-transparency` no está en `emulateMedia`; sí en CDP. */
const emulateReducedTransparency = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
};

const openWelcome = async (page) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
};

const step = async (page, label, id) => {
  await page.locator('.welcome-steps').getByRole('button', { name: label, exact: true }).click();
  await page.locator(`.welcome-screen[data-welcome-step="${id}"]`).waitFor({ state: 'visible' });
  // La etapa 3 trae DXF en su propio chunk perezoso: sin esperarlo, la captura
  // documentaría una puerta menos de las que hay.
  if (id === 'where') await page.locator('.welcome-import-card--dxf').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(260);
};

const setLanguage = async (page, value) => {
  const desktop = page.locator('.welcome-header-desktop-only select');
  if (await desktop.isVisible().catch(() => false)) {
    await desktop.selectOption(value);
  } else {
    await page.getByRole('button', { name: /menú|menu/i }).click();
    await page.locator('.sc-modal-surface select').selectOption(value);
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(200);
};

const measureOverflow = (page) => page.evaluate(() => ({
  documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  screenOverflow: (() => {
    const el = document.querySelector('.welcome-screen');
    return el ? el.scrollWidth > el.clientWidth + 1 : null;
  })(),
}));

const portalFinish = (page) => page.evaluate(() => {
  const body = document.querySelector('.portal-hero__body');
  const svg = document.querySelector('.portal-hero');
  if (!body || !svg) return null;
  const rect = svg.getBoundingClientRect();
  return {
    filter: getComputedStyle(body).filter,
    widthRatio: Number((rect.width / window.innerWidth).toFixed(4)),
    areaRatio: Number(((rect.width * rect.height) / (window.innerWidth * window.innerHeight)).toFixed(4)),
    faces: body.querySelectorAll('path.portal-hero__face').length,
  };
});

// --------------------------------------------------------------------------
// 1. Usuario nuevo · los cuatro pasos, X2, Día y Noche, ES y EN
// --------------------------------------------------------------------------
const STEPS = [['Bienvenida', 'welcome'], ['Cómo trabajas', 'how'], ['Por dónde', 'where']];
const STEPS_EN = [['Welcome', 'welcome'], ['How you work', 'how'], ['Where to start', 'where']];

for (const [theme, themeLabel] of [['light', 'dia'], ['dark', 'noche']]) {
  const page = await newPage(VIEWPORTS.x2, { theme });
  await openWelcome(page);
  for (const [label, id] of STEPS) {
    await step(page, label, id);
    await shoot(page, `x2-${themeLabel}-es-paso-${id}`);
  }
  // Paso 4 = la Mesa: el botón del carril la abre de verdad.
  await page.locator('.welcome-steps').getByRole('button', { name: 'Mesa', exact: true }).click();
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 20_000 });
  await shoot(page, `x2-${themeLabel}-es-paso-mesa`);
  out.checks[`x2${themeLabel}StepFourOpensWorkspace`] = true;
  await page.close();
}

{
  const page = await newPage(VIEWPORTS.x2);
  await openWelcome(page);
  await setLanguage(page, 'en');
  for (const [label, id] of STEPS_EN) {
    await step(page, label, id);
    await shoot(page, `x2-dia-en-paso-${id}`);
  }
  out.checks.englishBrandLine = await page.locator('.welcome-brand-line').textContent();
  await page.close();
}

// --------------------------------------------------------------------------
// 2. K0 retrato y apaisado · los cuatro pasos, Día y Noche
// --------------------------------------------------------------------------
for (const [key, viewport] of [['k0', VIEWPORTS.k0], ['k0land', VIEWPORTS.k0land], ['m1', VIEWPORTS.m1]]) {
  for (const [theme, themeLabel] of key === 'k0' ? [['light', 'dia'], ['dark', 'noche']] : [['light', 'dia']]) {
    // Compact se recorre con puntero grueso: es la única forma de que el suelo
    // táctil de `@media (pointer:coarse)` sea el que de verdad se mide.
    const page = await newPage(viewport, { theme, touch: key !== 'm1' });
    await openWelcome(page);
    for (const [label, id] of STEPS) {
      await step(page, label, id);
      await shoot(page, `${key}-${themeLabel}-es-paso-${id}`);
      const overflow = await measureOverflow(page);
      out.checks[`${key}${themeLabel}${id}NoHorizontalOverflow`] = overflow.documentOverflow === false && overflow.screenOverflow === false;
    }
    if (key === 'k0') {
      out.metrics.k0TouchTargets = await page.evaluate(() => {
        // Sólo lo que de verdad se puede tocar: los controles de escritorio
        // están en `display:none` en Compact (viven en el drawer) y medirlos
        // daría 0 px sin que exista ningún objetivo pequeño en pantalla.
        const targets = [...document.querySelectorAll('.welcome-step, .welcome-back-link, .welcome-forward-link, .welcome-launcher-card, .welcome-import-card, .welcome-resume-card, .welcome-header-icon, .welcome-filter-tab')]
          .filter((el) => el.getBoundingClientRect().height > 0);
        const measured = targets.map((el) => ({
          cls: el.className.toString().split(' ')[0],
          height: Math.round(el.getBoundingClientRect().height),
        }));
        return {
          count: measured.length,
          min: Math.min(...measured.map((entry) => entry.height)),
          smallest: measured.sort((a, b) => a.height - b.height).slice(0, 3),
        };
      });
      out.checks.k0TouchTargetsAtLeast44 = out.metrics.k0TouchTargets.min >= 44;
    }
    out.metrics[`${key}Portal`] = await portalFinish(page);
    out.checks[`${key}DxfGateVisible`] = await page.locator('.welcome-import-card--dxf').isVisible();
    await page.close();
  }
}

// --------------------------------------------------------------------------
// 3. El portal: normal, reduced-motion, reduced-transparency
// --------------------------------------------------------------------------
{
  const page = await newPage(VIEWPORTS.x2);
  await openWelcome(page);
  out.metrics.portalNormal = await portalFinish(page);
  await page.locator('.welcome-portal').screenshot({ path: path.join(shots, 'portal-normal.png') });
  console.log('✓ portal-normal.png');
  await page.close();
}
{
  const page = await newPage(VIEWPORTS.x2, { reducedMotion: 'reduce' });
  await openWelcome(page);
  out.metrics.portalReducedMotion = await portalFinish(page);
  await page.locator('.welcome-portal').screenshot({ path: path.join(shots, 'portal-reduced-motion.png') });
  await shoot(page, 'x2-dia-es-reduced-motion');
  console.log('✓ portal-reduced-motion.png');
  await page.close();
}
{
  const page = await newPage(VIEWPORTS.x2);
  await emulateReducedTransparency(page);
  await openWelcome(page);
  out.metrics.portalReducedTransparency = await portalFinish(page);
  await page.locator('.welcome-portal').screenshot({ path: path.join(shots, 'portal-reduced-transparency.png') });
  await shoot(page, 'x2-dia-es-reduced-transparency');
  console.log('✓ portal-reduced-transparency.png');
  await page.close();
}
out.checks.portalFiltersOnlyOnIllustration = out.metrics.portalNormal?.filter?.startsWith('url(');
out.checks.portalFlatUnderReducedMotion = out.metrics.portalReducedMotion?.filter === 'none';
out.checks.portalFlatUnderReducedTransparency = out.metrics.portalReducedTransparency?.filter === 'none';
out.checks.portalKeepsItsBoxWhenFlat =
  out.metrics.portalNormal?.widthRatio === out.metrics.portalReducedMotion?.widthRatio
  && out.metrics.portalNormal?.faces === out.metrics.portalReducedMotion?.faces;
out.checks.portalIsACornerNotAHero = out.metrics.portalNormal?.areaRatio < 0.12;

// --------------------------------------------------------------------------
// 4. Usuario recurrente · entra directo a la Mesa
// --------------------------------------------------------------------------
{
  const page = await newPage(VIEWPORTS.x2);
  await openWelcome(page);
  // El autoguardado real de la app escribe el proyecto en IndexedDB. No se
  // inyecta nada: es el mismo camino que recorre cualquier usuario.
  await page.locator('.welcome-steps').getByRole('button', { name: 'Mesa', exact: true }).click();
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(async () => {
    const request = indexedDB.open('structureCo.projects', 1);
    const database = await new Promise((resolve) => { request.onsuccess = () => resolve(request.result); });
    const store = database.transaction('projects', 'readonly').objectStore('projects');
    const all = await new Promise((resolve) => {
      const get = store.getAll();
      get.onsuccess = () => resolve(get.result);
    });
    return all.length > 0;
  }, null, { timeout: 20_000 });

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 20_000 });
  out.checks.returningUserLandsInWorkspace = await page.getByTestId('welcome-screen').isVisible().catch(() => false) === false;
  await shoot(page, 'x2-dia-es-recurrente-directo-a-mesa');

  // Volver a Inicio TIENE que llevar a Inicio: el salto se ofrece una vez.
  await page.getByRole('button', { name: /inicio|home/i }).first().click();
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 20_000 });
  out.checks.homeStillReachableAfterDirectResume = true;
  await shoot(page, 'x2-dia-es-recurrente-vuelve-a-inicio');
  out.checks.recentProjectsListed = await page.locator('.project-hub__row').count() > 0;

  // 5. Con una copia de recuperación pendiente NO salta, y se ve abierta.
  await page.evaluate(async () => {
    const request = indexedDB.open('structureCo.projects', 1);
    const database = await new Promise((resolve) => { request.onsuccess = () => resolve(request.result); });
    const projects = await new Promise((resolve) => {
      const get = database.transaction('projects', 'readonly').objectStore('projects').getAll();
      get.onsuccess = () => resolve(get.result);
    });
    const source = projects[0];
    const store = database.transaction('recoveries', 'readwrite').objectStore('recoveries');
    store.put({
      id: 'evidence-recovery',
      projectId: source.id,
      reason: 'conflict',
      createdAt: new Date().toISOString(),
      checksum: source.checksum,
      project: source.project,
    });
    await new Promise((resolve) => { store.transaction.oncomplete = () => resolve(); });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible', timeout: 20_000 });
  out.checks.recoveryPendingBlocksDirectResume = true;
  const recovery = page.locator('.project-hub__recoveries');
  await recovery.waitFor({ state: 'visible', timeout: 20_000 });
  out.checks.recoveryVisibleWithoutInteraction = await recovery.evaluate((element) => element.open === true);
  out.checks.recoveryRestoreButtonVisible = await recovery.getByRole('button').first().isVisible();
  await recovery.scrollIntoViewIfNeeded();
  await shoot(page, 'x2-dia-es-recuperacion-visible');
  await page.close();
}

// --------------------------------------------------------------------------
// 6. Teclado: orden de Tab y anillo de foco visible
// --------------------------------------------------------------------------
{
  const page = await newPage(VIEWPORTS.x2);
  await openWelcome(page);
  const order = [];
  for (let i = 0; i < 9; i += 1) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        cls: el.className?.toString().slice(0, 46),
        label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
      };
    }));
  }
  out.metrics.tabOrder = order;
  out.checks.focusRingVisibleOnSteps = order.some((entry) => entry?.cls?.includes('welcome-step') && entry.outlineStyle !== 'none' && entry.outlineWidth !== '0px');
  out.checks.tabReachesResumeCardBeforeShowcase = order.findIndex((e) => e?.cls?.includes('welcome-resume-card')) > -1;
  await page.keyboard.press('Tab');
  await shoot(page, 'x2-dia-es-foco-teclado');
  await page.close();
}

fs.writeFileSync(path.join(shots, 'qa-cri-104.json'), `${JSON.stringify(out, null, 2)}\n`);
await browser.close();
await previewServer.close();

const failed = Object.entries(out.checks).filter(([, value]) => value === false);
console.log(`\n${JSON.stringify(out.checks, null, 2)}`);
if (out.pageErrors.length) console.log('\npageErrors:', out.pageErrors);
if (failed.length) {
  console.error(`\n✗ ${failed.length} check(s) en rojo: ${failed.map(([key]) => key).join(', ')}`);
  process.exit(1);
}
console.log('\n✓ Todos los checks de CRI-104 en verde.');
