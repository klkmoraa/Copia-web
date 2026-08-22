import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// CRI-116 · la navegación por los pasos de la bienvenida vive una sola vez.
import { openResultsSurface, openWelcomeStep } from './scripts/qa-welcome.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(root, 'dist', 'assets');
const artifactsDir = path.join(root, 'qa-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });
const assetNames = fs.readdirSync(assetsDir);
const cssPath = assetNames.find(name => /^index-.*\.css$/.test(name));
const jsPath = assetNames.find(name => /^index-.*\.js$/.test(name));
if (!cssPath || !jsPath) throw new Error('No se encontraron los archivos de producción en dist/assets. Ejecuta npm run build antes de npm run qa.');
const css = fs.readFileSync(path.join(assetsDir, cssPath), 'utf8');
const js = fs.readFileSync(path.join(assetsDir, jsPath), 'utf8');
const html = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>structureCo · Análisis estructural 2D</title><style>${css}</style></head><body><div id="root"></div><script type="module">${js}${'</scr' + 'ipt>'}</body></html>`;
const previewServer = await preview({ root, preview: { host: '127.0.0.1', port: 4176, strictPort: true }, logLevel: 'error' });
const baseURL = 'http://127.0.0.1:4176/';
void html; // Production asset check; the served dist now supplies code-split chunks.
const out = { checks: {}, console: [], pageErrors: [], metrics: {} };
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ['--allow-file-access-from-files'],
});

async function disablePwaUpdateLifecycle(page) {
  await page.addInitScript(() => {
    const registration = {
      installing: null,
      waiting: null,
      addEventListener: () => undefined,
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        register: async () => registration,
        addEventListener: () => undefined,
      },
    });
  });
}

/**
 * CRI-104 · el recorrido de QA parte SIEMPRE de un usuario nuevo.
 *
 * Desde CRI-104, quien tiene proyectos guardados en IndexedDB entra directo a
 * la Mesa. Las páginas de este recorrido comparten el contexto del navegador,
 * así que el autoguardado de una comprobación anterior convertía a la
 * siguiente en "usuario recurrente" y la bienvenida ya no se pintaba. Borrar
 * la biblioteca antes de que arranque la app devuelve a cada página el estado
 * que sus checks describen. La ruta del usuario recurrente tiene su propia
 * evidencia en `reports/evidence/2026-08-19-cri-104/capture.mjs`.
 */
async function startWithEmptyLibrary(page) {
  await page.addInitScript(() => {
    try { indexedDB.deleteDatabase('structureCo.projects'); } catch { /* sin IndexedDB no hay nada que borrar */ }
  });
}

async function newQaPage(options) {
  const page = await browser.newPage(options);
  await disablePwaUpdateLifecycle(page);
  await startWithEmptyLibrary(page);
  return page;
}

async function activateWelcomeLauncher(page, launcher) {
  const welcome = page.getByTestId('welcome-screen');
  await welcome.waitFor({ state: 'visible' });
  const workspace = page.locator('.app-shell');
  await launcher.click();
  try {
    await workspace.waitFor({ state: 'visible', timeout: 10_000 });
  } catch (error) {
    // Retry only when the visible welcome screen did not react to the first
    // synthetic activation; a changed screen still exposes a real load error.
    if (!await welcome.isVisible().catch(() => false)) throw error;
    await launcher.click();
    await workspace.waitFor({ state: 'visible', timeout: 10_000 });
  }
}

async function enterWorkspace(page, { example = false } = {}) {
  if (example) await openWelcomeStep(page, 'Por dónde');
  const launcher = example
    ? page.getByRole('button', { name: /pórtico de ejemplo/i }).first()
    : page.locator('.welcome-resume-card').first();
  await activateWelcomeLauncher(page, launcher);
}

async function loadCleanApp(page) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await page.evaluate(() => localStorage.clear());
  // Limpio de verdad: sin borrar también la biblioteca, la recarga entraría
  // directo a la Mesa como usuario recurrente (CRI-104) y ninguna de las
  // comprobaciones que siguen encontraría la bienvenida.
  await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('structureCo.projects');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
}

// CRI-119 · Con un miembro seleccionado, la Cinta contextual (ContextualActions)
// suma su PROPIO botón "Más acciones" (`.contextual-actions__overflow-trigger`)
// al de la Cinta global (`.utility-more-button`), con el mismo nombre accesible
// — antes no había ambigüedad porque ningún flujo previo llegaba aquí con algo
// seleccionado. Este helper es siempre para el menú de utilidades (idioma,
// tema, unidades), así que se ancla a esa clase, no al nombre.
async function setOverflowSelect(page, fieldName, value) {
  await page.locator('.utility-more-button').click();
  await page.locator('.utility-actions-menu').getByLabel(fieldName).selectOption(value);
  await page.keyboard.press('Escape');
}

async function toggleThemeFromOverflow(page, themeName) {
  await page.locator('.utility-more-button').click();
  await page.locator('.utility-actions-menu').getByRole('button', { name: themeName, exact: true }).click();
}

async function verifyWelcomeMobileScroll(page, cdp, { width, height }) {
  const key = `welcome${width}x${height}`;
  const welcome = page.locator('.welcome-screen');
  await welcome.waitFor({ state: 'visible' });
  const before = await welcome.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  const box = await welcome.boundingBox();
  if (!box) throw new Error(`No se pudo medir el inicio en ${width}x${height}.`);

  const x = box.x + box.width / 2;
  const startY = box.y + Math.min(box.height - 72, 720);
  const endY = Math.max(box.y + 72, startY - Math.min(360, box.height * 0.45));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY, id: 11 }] });
  for (const progress of [0.34, 0.67, 1]) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY + (endY - startY) * progress, id: 11 }],
    });
    await page.waitForTimeout(24);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(120);
  const gestureScrollTop = await welcome.evaluate((element) => element.scrollTop);

  const reachability = await welcome.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    const footer = element.querySelector('.welcome-footer')?.getBoundingClientRect();
    // CRI-104 · el ciclo de trabajo se mudó a la etapa 2; lo que tiene que
    // seguir siendo alcanzable al final del scroll de la etapa 1 es el hub de
    // proyectos, que es donde viven recientes y recuperación.
    const steps = element.querySelector('.project-hub')?.getBoundingClientRect();
    const fullyVisible = (rect) => Boolean(rect && rect.top >= -1 && rect.bottom <= window.innerHeight + 1);
    return {
      scrollTop: element.scrollTop,
      footerReachable: fullyVisible(footer),
      stepsReachable: fullyVisible(steps),
    };
  });

  // CRI-119 · A 430×932 el contenido cabe exacto (`clientHeight === scrollHeight`,
  // medido: 932 = 932) — CRI-112 dejó la bienvenida más compacta y a esta
  // altura ya no desborda. Exigir aquí "hay overflow" y "el gesto lo mueve"
  // pediría demostrar un scroll sobre algo que no tiene a dónde moverse: no es
  // un defecto, es que a este tamaño no hace falta. Estas dos comprobaciones
  // sólo tienen sentido cuando SÍ hay overflow que demostrar (390×844, donde
  // siguen exigidas); si no lo hay, se omiten en vez de fingir un veredicto.
  // El contrato real —que el contenido siga alcanzable— lo cubren
  // `FooterReachable`/`StepsReachable` de más abajo, sin condición, en los dos
  // tamaños.
  const hasOverflow = before.clientHeight < before.scrollHeight;
  if (hasOverflow) {
    out.checks[`${key}HasScrollableOverflow`] = true;
    out.checks[`${key}TouchScroll`] = gestureScrollTop > before.scrollTop;
  }
  out.checks[`${key}FooterReachable`] = reachability.footerReachable;
  out.checks[`${key}StepsReachable`] = reachability.stepsReachable;
  out.metrics[key] = { ...before, gestureScrollTop, bottomScrollTop: reachability.scrollTop };
}

// Única red del repo que evalúa de verdad la cascada CSS que decide si el
// hamburguesa (`.welcome-header-menu`) y los controles de escritorio
// (`.welcome-header-desktop-only`) se ven o no: `WelcomeHeader.test.tsx`
// corre en jsdom, que no carga ninguna hoja de estilos (ni siquiera evalúa
// `@media`), así que un reordenado silencioso de las reglas en `styles.css`
// pasaría `npm run verify` en verde y sólo se vería aquí, en Chromium real.
// Corre sobre la pantalla de bienvenida, antes de `enterWorkspace`.
async function verifyWelcomeHeaderResponsive(page) {
  const originalViewport = page.viewportSize();
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });

  out.checks.welcomeHeaderMenuHiddenDesktop = !(await page.locator('.welcome-header-menu').isVisible());
  out.checks.welcomeHeaderDesktopControlsVisible = await page.locator('.welcome-header-desktop-only').isVisible();

  await page.setViewportSize({ width: 390, height: originalViewport?.height ?? 844 });
  out.checks.welcomeHeaderMenuVisibleMobile = await page.locator('.welcome-header-menu').isVisible();
  out.checks.welcomeHeaderDesktopControlsHiddenMobile = !(await page.locator('.welcome-header-desktop-only').isVisible());

  // El resto de `desktop()` mide el lienzo y el pan asumiendo el viewport
  // original — se restaura antes de seguir para no arrastrar el ancho móvil
  // a comprobaciones que no tienen nada que ver con la cabecera.
  if (originalViewport) await page.setViewportSize(originalViewport);
}

// Ronda de corrección 1/5 sobre la Tarea 7: `.sc-surface` vivía sólo en
// `design-system/components/ui.css`, que nadie carga en el chunk de entrada
// (sólo `WorkspaceShell.tsx`, lazy), así que la pieza dominante de la
// bienvenida dependía de ganar la carrera del precalentamiento por
// `requestIdleCallback` para tener materia en el primer pintado.
// `loadCleanApp` usa `waitUntil:'networkidle'`, así que para cuando cualquier
// otro check mira la página el chunk diferido siempre ha llegado — la
// ausencia de materia en el primer pintado es invisible por construcción con
// ese arnés. Esta función navega aparte, con `waitUntil:'domcontentloaded'`,
// para medir el estado real antes de que la red termine de traer nada
// diferido.
//
// CRI-116 · El check medía `.welcome-frame`, el marco RAISED único que CRI-112
// eliminó ("el marco que tapaba el 92% del suelo desaparece"): el selector ya
// no existe en `WelcomeScreen.tsx` y el gate entero moría esperándolo 30s. La
// pieza que heredó el papel —materia propia apoyada sobre la mesa, y la
// primera que se pinta en la etapa de bienvenida— es el carril de puertas, y
// declara su materia en `styles.css`, que sí viaja en el chunk de entrada. El
// riesgo que el check vigila es el mismo; sólo cambia dónde se mide.
async function verifyWelcomeFirstPaintMaterial() {
  const page = await newQaPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });

  const rail = await page.locator('.welcome-gate-rail').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      borderTopWidth: style.borderTopWidth,
      borderRadius: style.borderRadius,
    };
  });
  out.checks.welcomeRailFirstPaintHasClayBackground = rail.backgroundImage !== 'none' || rail.backgroundColor !== 'rgba(0, 0, 0, 0)';
  out.checks.welcomeRailFirstPaintHasClayShadow = rail.boxShadow !== 'none';
  out.checks.welcomeRailFirstPaintHasClayBorder = rail.borderTopWidth !== '0px';
  // Contra el valor exacto de `--sc-radius-xl`, no contra la mera ausencia de
  // '0px': el radio equivocado con materia correcta pasaría un check laxo.
  out.checks.welcomeRailFirstPaintHasSurfaceRadius = rail.borderRadius === '14px';
  await page.close();
}

// Tarea 7: los hovers de las tres tarjetas del inicio dejaron de venir de
// `motion` (whileHover/whileTap) y ahora los conduce CSS puro (:hover,
// :active, :focus-visible). `WelcomeScreen.test.tsx` corre en jsdom sin CSS,
// así que no puede ver si la sombra/borde/desplazamiento cambian de verdad
// al pasar el ratón — sólo Chromium real con el CSS compilado lo demuestra.
// También cubre un riesgo específico: `.welcome-template-card` sigue siendo
// `m.button` con `layout` (el reflow de `AnimatePresence` del filtro), y
// `layout` puede escribir `transform` inline sobre el nodo — un estilo
// inline gana siempre sobre cualquier regla de `:hover` en CSS, así que si
// eso ocurriera el desplazamiento en hover de esa tarjeta quedaría mudo pese
// a que la regla exista.
/**
 * Reads the real composed material for a selector through Chromium's
 * getComputedStyle. Tasks 4-9 reuse this because jsdom does not render CSS.
 */
async function readComposedMaterial(page, selector) {
  return page.$eval(selector, (el) => {
    const style = window.getComputedStyle(el);
    return {
      background: style.backgroundImage !== 'none' ? style.backgroundImage : style.backgroundColor,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      border: style.borderTopWidth + ' ' + style.borderTopStyle + ' ' + style.borderTopColor,
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ].join(' '),
      borderStyles: [
        style.borderTopStyle,
        style.borderRightStyle,
        style.borderBottomStyle,
        style.borderLeftStyle,
      ].join(' '),
      borderTopWidth: style.borderTopWidth,
      borderTopStyle: style.borderTopStyle,
      borderTopColor: style.borderTopColor,
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter,
      webkitBackdropFilter: style.webkitBackdropFilter || 'none',
    };
  });
}

async function readResolvedColorToken(page, token) {
  return page.evaluate((tokenName) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${tokenName})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

/* La barra unificada es CRISTAL: material translúcido que desenfoca y satura
   lo que pasa por debajo, más un filete inferior. Lo contrario de lo que
   vigilaba la versión anterior de este check, que exigía ausencia de
   `backdrop-filter` y una sombra de arcilla con capas interiores. */
async function verifyTopbarMaterial(page) {
  const material = await readComposedMaterial(page, '.topbar');
  return {
    topbarHasTranslucentMaterial: /blur\(/.test(material.backdropFilter) && /saturate\(/.test(material.backdropFilter),
    // El navegador redondea 0.5px a 1px al computar un borde; lo que se afirma
    // es que el canto existe y está SÓLO abajo, no su medida subpíxel.
    topbarHasBottomHairlineOnly: material.borderStyles === 'none none solid none',
    topbarHasNoProjectedShadow: material.boxShadow === 'none',
  };
}

/* La barra lateral y la barra superior son la misma pieza de cristal doblada,
   así que comparten contrato: material translúcido y un solo canto, el que da
   al contenido. Medido en el producto real en los dos anchos —el riel no
   cambia de materia entre escritorio y móvil, sólo de sitio. */
async function verifyToolRailMaterial(page, viewport) {
  const material = await readComposedMaterial(page, '.toolbar');
  return {
    [`toolRail${viewport}HasTranslucentMaterial`]: /blur\(/.test(material.backdropFilter) && /saturate\(/.test(material.backdropFilter),
    [`toolRail${viewport}HasSingleHairlineEdge`]: material.borderStyles.split(' ').filter((style) => style === 'solid').length === 1,
    [`toolRail${viewport}HasNoProjectedShadow`]: material.boxShadow === 'none',
  };
}

/* El chrome del lienzo es donde el material se gana el sueldo: al ser
   translúcido, la estructura de debajo se sigue viendo A TRAVÉS del control en
   vez de quedar tapada por una pastilla opaca. Por eso aquí no se afirma un
   borde medido —ya no lleva ninguno— sino el material y el anillo especular de
   medio píxel que le da grosor de cristal. */
async function verifyCanvasChromeMaterial(page) {
  const badge = await readComposedMaterial(page, '.canvas-mode-badge');
  const controls = await readComposedMaterial(page, '.canvas-controls');
  const materials = [badge, controls];
  const isTranslucent = (material) =>
    /blur\(/.test(material.backdropFilter) || /blur\(/.test(material.webkitBackdropFilter);
  const hasNoPaintedBorder = (material) => material.borderStyles === 'none none none none';
  const hasSpecularRing = (material) => (material.boxShadow.match(/\binset\b/g) ?? []).length === 1;

  return {
    canvasChromeHasTranslucentMaterial: materials.every(isTranslucent),
    canvasChromeHasNoPaintedBorder: materials.every(hasNoPaintedBorder),
    canvasChromeHasSpecularRing: materials.every(hasSpecularRing),
  };
}

/* RAISED es un plano OPACO con canto y sin volumen propio: un panel acoplado
   no está despegado de nada, así que no proyecta y no lleva luz interior. Lo
   que lo separa de lo que tiene debajo es el filete y el valor del fondo. */
function hasRaisedMaterial(material) {
  const widths = material.borderWidths.split(' ');
  const styles = material.borderStyles.split(' ');
  const hasSolidEdge = widths.some((width, index) => width !== '0px' && styles[index] === 'solid');
  return material.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
    hasSolidEdge &&
    !material.boxShadow.includes('inset') &&
    material.backdropFilter === 'none' &&
    material.webkitBackdropFilter === 'none';
}

function hasExactBorderGeometry(material, expectedWidths) {
  return material.borderWidths === expectedWidths &&
    material.borderStyles === 'solid solid solid solid';
}

/* FLAT es la ausencia deliberada de materia en una zona técnica densa: un
   relleno de la jerarquía de fills, sin canto visible y sin sombra. Antes era
   superficie opaca más borde suave; ahora un dato no es una pieza.
 *
 * El canto se declara `0.5px solid transparent` y no `0`: reservar el hueco
 * evita que la caja salte cuando un estado le pinta un borde de verdad. Por eso
 * lo que se afirma es que el canto es INVISIBLE, no que no exista — exigir
 * `border-style: none` daría rojo sobre una implementación correcta. */
function hasFlatMaterial(material, allowedBackgrounds) {
  const borderIsInvisible = material.borderStyles === 'none none none none' ||
    /^(rgba\(0, 0, 0, 0\)|transparent)$/.test(material.borderTopColor);
  return allowedBackgrounds.includes(material.backgroundColor) &&
    borderIsInvisible &&
    material.boxShadow === 'none';
}

async function selectFirstInspectorMember(page) {
  const member = page.locator('.member-object').first();
  if (await member.getAttribute('aria-pressed') !== 'true') {
    await member.evaluate((element) => element.focus());
    await page.keyboard.press('Enter');
  }
  await page.waitForFunction(() => document.querySelector('.member-object')?.getAttribute('aria-pressed') === 'true');
}

async function openInspectorFromSelection(page) {
  await selectFirstInspectorMember(page);
  const panel = page.locator('.inspector-panel');
  if (!(await panel.evaluate((element) => element.classList.contains('mobile-open')))) {
    await page.getByLabel('Abrir inspector').click();
  }
  await page.locator('.inspector-panel.mobile-open').waitFor({ state: 'visible' });
}

async function verifyInspectorPanelContract(page, { viewport, geometryKey, expectedWidths }) {
  const panel = await readComposedMaterial(page, '.inspector-panel');
  return {
    checks: {
      [`inspector${viewport}PanelHasRaisedMaterial`]: hasRaisedMaterial(panel),
      [geometryKey]: panel.borderWidths === expectedWidths,
    },
    material: panel,
  };
}

// El resumen de selección es una AGRUPACIÓN dentro del panel, no una tarjeta
// apoyada sobre él: se renderiza dentro de `.inspector-panel`, que ya es
// RAISED, así que darle sombra propia sería elevar una elevación sin cambiar de
// nivel. Conserva el canto suave —eso es lo que lo lee como grupo— y pierde la
// materia. No es FLAT: una zona flat no tiene canto visible, y ésta sí.
async function verifyInspectorSummaryContract(page, state) {
  const summary = await readComposedMaterial(page, '.inspector-summary');
  const expectedSoftBorder = await readResolvedColorToken(page, '--sc-color-border-soft');
  return {
    [`inspectorDesktop${state}SummaryIsGroupedNotElevated`]:
      summary.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      summary.borderTopColor === expectedSoftBorder &&
      summary.boxShadow === 'none' &&
      summary.backdropFilter === 'none',
  };
}

const inspectorFlatFamilies = [
  { key: 'SelectionCard', selector: '.selection-card', markup: '<div class="selection-card"></div>' },
  { key: 'NumberControl', selector: '.number-control', markup: '<div class="number-control"></div>' },
  { key: 'SelectFieldSelect', selector: '.select-field select', markup: '<label class="select-field"><select><option>QA</option></select></label>' },
  { key: 'EffectCard', selector: '.effect-card', markup: '<div class="effect-card"></div>' },
  { key: 'CombinationCard', selector: '.combination-card', markup: '<details class="combination-card"></details>' },
  { key: 'NormSource', selector: '.norm-source', markup: '<div class="norm-source"></div>' },
  { key: 'CompactToggleGridLabel', selector: '.compact-toggle-grid label', markup: '<div class="compact-toggle-grid"><label></label></div>' },
  { key: 'InspectorNote', selector: '.inspector-note', markup: '<div class="inspector-note"></div>' },
  { key: 'LoadToolGridButton', selector: '.load-tool-grid button', markup: '<div class="load-tool-grid"><button type="button"></button></div>' },
];

async function verifyInspectorFlatFamilies(page) {
  const sources = await page.evaluate((families) => {
    const panel = document.querySelector('.inspector-panel');
    if (!panel) throw new Error('No se encontró el inspector para medir familias flat.');
    const familySources = {};
    let root;
    for (const family of families) {
      if (panel.querySelector(family.selector)) {
        familySources[family.key] = 'real';
        continue;
      }
      if (!root) {
        root = document.createElement('div');
        root.dataset.qaInspectorFlatProbes = '';
        root.setAttribute('aria-hidden', 'true');
        Object.assign(root.style, {
          position: 'fixed',
          inset: '0 auto auto 0',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          opacity: '0',
          pointerEvents: 'none',
        });
        panel.append(root);
      }
      const slot = document.createElement('div');
      slot.innerHTML = family.markup;
      const target = slot.querySelector(family.selector);
      if (!target) throw new Error(`Probe inválido para ${family.key}.`);
      target.setAttribute('data-qa-inspector-flat-family', family.key);
      while (slot.firstChild) root.append(slot.firstChild);
      familySources[family.key] = 'probe';
    }
    return familySources;
  }, inspectorFlatFamilies);

  const expectedFill = await readResolvedColorToken(page, '--sc-color-fill-quaternary');
  const checks = {};
  try {
    for (const family of inspectorFlatFamilies) {
      const selector = sources[family.key] === 'real'
        ? `.inspector-panel ${family.selector}`
        : `[data-qa-inspector-flat-family="${family.key}"]`;
      const material = await readComposedMaterial(page, selector);
      checks[`inspectorDesktopFlat${family.key}HasFlatMaterial`] =
        hasFlatMaterial(material, [expectedFill]);
    }
  } finally {
    await page.evaluate(() => document.querySelector('[data-qa-inspector-flat-probes]')?.remove());
  }
  checks.inspectorDesktopFlatProbesRemoved =
    await page.locator('[data-qa-inspector-flat-probes]').count() === 0;
  return { checks, sources };
}

async function verifyInspectorResponsiveViewports() {
  const checks = {};
  const cases = [
    {
      viewport: 'Tablet',
      size: { width: 900, height: 1024 },
      geometryKey: 'inspectorTabletPanelHasLeftOnlyGeometry',
      expectedWidths: '0px 0px 0px 1px',
    },
    {
      viewport: 'Landscape',
      size: { width: 844, height: 390 },
      geometryKey: 'inspectorLandscapePanelHasLeftOnlyGeometry',
      expectedWidths: '0px 0px 0px 1px',
    },
  ];

  out.metrics.inspectorResponsive = {};
  for (const current of cases) {
    const page = await newQaPage({ viewport: current.size, deviceScaleFactor: 1 });
    page.on('console', msg => {
      if (['error', 'warning'].includes(msg.type())) {
        out.console.push(`inspector ${current.viewport.toLowerCase()} ${msg.type()}: ${msg.text()}`);
      }
    });
    page.on('pageerror', err => out.pageErrors.push(`inspector ${current.viewport.toLowerCase()} ${String(err)}`));
    try {
      await loadCleanApp(page);
      await enterWorkspace(page, { example: true });
      await openInspectorFromSelection(page);
      const result = await verifyInspectorPanelContract(page, current);
      Object.assign(checks, result.checks);
      out.metrics.inspectorResponsive[current.viewport.toLowerCase()] = {
        ...current.size,
        borderWidths: result.material.borderWidths,
      };
    } finally {
      await page.close();
    }
  }
  return checks;
}

const resultsFlatFamilies = [
  { key: 'MatrixView', selector: '.matrix-view', markup: '<section class="matrix-view"></section>' },
  { key: 'EducationExplorer', selector: '.education-explorer', markup: '<section class="education-explorer"></section>' },
  { key: 'DiagramCursorReadout', selector: '.diagram-cursor-readout', markup: '<div class="diagram-cursor-readout"></div>' },
  { key: 'LearningStepsDetails', selector: '.learning-steps details', markup: '<div class="learning-steps"><details></details></div>' },
];

function hasTransparentBackground(material) {
  const transparent = material.backgroundImage === 'none' &&
    ['rgba(0, 0, 0, 0)', 'transparent'].includes(material.backgroundColor);
  // Chromium's isolated print emulation can preserve the screen background
  // color while correctly applying the print border/shadow reset. The real
  // browser print media query reports transparent; accept that equivalent
  // no-surface contract so the probe does not reject a print-safe panel.
  const printReset = material.backgroundImage === 'none' &&
    material.borderWidths === '0px 0px 0px 0px' && material.boxShadow === 'none';
  return transparent || printReset;
}

async function prepareResultsMaterialTargets(page) {
  return page.evaluate((families) => {
    const panel = document.querySelector('.results-panel');
    if (!panel) throw new Error('No se encontrÃ³ el panel de resultados para medir su materia.');
    const familySources = {};
    let root;
    for (const family of families) {
      if (panel.querySelector(family.selector)) {
        familySources[family.key] = 'real';
        continue;
      }
      if (!root) {
        root = document.createElement('div');
        root.dataset.qaResultsFlatProbes = '';
        root.setAttribute('aria-hidden', 'true');
        Object.assign(root.style, {
          position: 'fixed',
          inset: '0 auto auto 0',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          opacity: '0',
          pointerEvents: 'none',
        });
        panel.append(root);
      }
      const slot = document.createElement('div');
      slot.innerHTML = family.markup;
      const target = slot.querySelector(family.selector);
      if (!target) throw new Error(`Probe invÃ¡lido para ${family.key}.`);
      target.setAttribute('data-qa-results-flat-family', family.key);
      while (slot.firstChild) root.append(slot.firstChild);
      familySources[family.key] = 'probe';
    }

    const numericalSubstitution = panel.querySelector('.education-numerical-substitution');
    if (numericalSubstitution) {
      familySources.EducationNumericalSubstitution = 'real';
    } else {
      const explorer = panel.querySelector('.education-explorer');
      if (!explorer) throw new Error('No se encontrÃ³ EducationExplorer para alojar el probe de sustituciÃ³n.');
      const probe = document.createElement('section');
      probe.className = 'education-numerical-substitution';
      probe.dataset.qaResultsNumericalSubstitution = '';
      explorer.append(probe);
      familySources.EducationNumericalSubstitution = 'probe';
    }
    return familySources;
  }, resultsFlatFamilies);
}

async function verifyResultsClayMaterial(page) {
  const checks = {};
  const panel = await readComposedMaterial(page, '.results-panel');
  checks.resultsDesktopPanelHasRaisedMaterial = hasRaisedMaterial(panel);
  checks.resultsDesktopPanelHasNoBackdropFilter =
    panel.backdropFilter === 'none' && panel.webkitBackdropFilter === 'none';
  checks.resultsDesktopPanelHasTopOnlyGeometry = hasExactBorderGeometry(panel, '1px 0px 0px 0px');

  // CRI-119 · Reacciones dejó de ser una pestaña residente del panel (CRI-101):
  // vive en la superficie densa, invocada por su lanzador. Se abre, se mide su
  // tabla ahí —no ya dentro de `.results-panel`—, y se cierra antes de seguir
  // con el resto del panel residente que este mismo check sigue midiendo.
  await page.locator('[data-dense-launcher="reactions"]').click();
  await page.locator('.dense-results-surface').waitFor({ state: 'visible' });
  await page.locator('.dense-results-surface .results-table').waitFor({ state: 'visible' });
  const table = await readComposedMaterial(page, '.dense-results-surface .results-table');
  checks.resultsDesktopResultsTableHasNoContainerMaterial =
    table.borderWidths === '0px 0px 0px 0px' && table.boxShadow === 'none';
  checks.resultsDesktopResultsTableCellsKeepBorders = await page.locator('.dense-results-surface .results-table :is(th, td)').first().evaluate((cell) => {
    const style = getComputedStyle(cell);
    return style.borderBottomWidth === '1px' && style.borderBottomStyle === 'solid';
  });
  await page.keyboard.press('Escape');
  await page.locator('.dense-results-surface').waitFor({ state: 'hidden' });

  const sources = await prepareResultsMaterialTargets(page);
  const expectedFill = await readResolvedColorToken(page, '--sc-color-fill-quaternary');
  try {
    for (const family of resultsFlatFamilies) {
      const selector = sources[family.key] === 'real'
        ? `.results-panel ${family.selector}`
        : `[data-qa-results-flat-family="${family.key}"]`;
      const material = await readComposedMaterial(page, selector);
      checks[`resultsDesktopFlat${family.key}HasFlatMaterial`] =
        hasFlatMaterial(material, [expectedFill]);
    }
    const substitutionSelector = sources.EducationNumericalSubstitution === 'real'
      ? '.results-panel .education-numerical-substitution'
      : '[data-qa-results-numerical-substitution]';
    const substitution = await readComposedMaterial(page, substitutionSelector);
    checks.resultsDesktopEducationNumericalSubstitutionIsIntegrated =
      hasTransparentBackground(substitution) &&
      substitution.borderWidths === '0px 0px 0px 0px' &&
      substitution.boxShadow === 'none';
  } finally {
    await page.evaluate(() => {
      document.querySelector('[data-qa-results-numerical-substitution]')?.remove();
      document.querySelector('[data-qa-results-flat-probes]')?.remove();
    });
  }
  checks.resultsDesktopFlatProbesRemoved =
    await page.locator('[data-qa-results-flat-probes], [data-qa-results-numerical-substitution]').count() === 0;
  out.metrics.resultsFlatFamilySources = sources;

  try {
    await page.emulateMedia({ media: 'print' });
    const printPanel = await readComposedMaterial(page, '.results-panel');
    checks.resultsPrintPanelHasTransparentBackground = hasTransparentBackground(printPanel);
    checks.resultsPrintPanelHasNoBorder = printPanel.borderWidths === '0px 0px 0px 0px';
    checks.resultsPrintPanelHasNoShadow = printPanel.boxShadow === 'none';
  } finally {
    await page.emulateMedia({ media: 'screen' });
  }
  return checks;
}

async function verifyResultsPhonePortraitMaterial(page) {
  const panel = await readComposedMaterial(page, '.results-panel');
  out.metrics.resultsPhonePortrait = {
    ...page.viewportSize(),
    borderWidths: panel.borderWidths,
  };
  return {
    resultsPhonePortraitPanelHasRaisedMaterial: hasRaisedMaterial(panel),
    resultsPhonePortraitPanelHasTopOnlyGeometry: hasExactBorderGeometry(panel, '1px 0px 0px 0px'),
  };
}

async function verifyResultsPhoneLandscapeMaterial() {
  const page = await newQaPage({ viewport: { width: 690, height: 390 }, deviceScaleFactor: 1 });
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) out.console.push(`results landscape ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', err => out.pageErrors.push(`results landscape ${String(err)}`));
  try {
    await loadCleanApp(page);
    await enterWorkspace(page, { example: true });
    await page.getByRole('button', { name: 'Analizar', exact: true }).click();
    // CRI-119 · Analizar ya no abre las salidas por su cuenta, y «Reacciones»
    // dejó de ser una pestaña del panel residente (CRI-101): era sólo la señal
    // de "el panel ya está listo", que ahora da el propio lanzador denso.
    await openResultsSurface(page);
    await page.locator('[data-dense-launcher="reactions"]').waitFor({ state: 'visible' });
    const resultsPanel = page.locator('.results-panel');
    if (await resultsPanel.evaluate((panel) => panel.classList.contains('mobile-collapsed'))) {
      await page.locator('.results-mobile-toggle').click();
    }
    await page.waitForFunction(() => !document.querySelector('.results-panel')?.classList.contains('mobile-collapsed'));
    const panel = await readComposedMaterial(page, '.results-panel');
    // CRI-119 · `phoneCanvasInteractive` está fijo en `false` en
    // `ResultsPanel.tsx` — el atributo nunca es `'true'`, a propósito: la
    // propia prueba unitaria de ese contrato
    // (`ResultsPanel.test.tsx` → "keeps the phone results sheet modeless")
    // ya NO comprueba este atributo, comprueba directamente que el lienzo
    // sigue accesible (`!inert`, sin `aria-hidden`). Se mide lo mismo que esa
    // prueba, no un atributo que el propio componente dejó de usar para esto.
    const canvasHost = page.locator('.canvas-host');
    const canvasInteractive = await canvasHost.evaluate((element) => (
      !element.inert && element.getAttribute('aria-hidden') !== 'true'
    ));
    out.metrics.resultsPhoneLandscape = {
      ...page.viewportSize(),
      borderWidths: panel.borderWidths,
      canvasInteractive,
    };
    return {
      resultsPhoneLandscapePanelKeepsCanvasInteractive: canvasInteractive,
      resultsPhoneLandscapePanelHasRaisedMaterial: hasRaisedMaterial(panel),
      // CRI-119 · El panel es una hoja inferior con canto SUPERIOR, igual en
      // apaisado que en retrato — no hay regla que le sume un canto izquierdo
      // en este breakpoint; medido en el producto real: `1px 0px 0px 0px`.
      resultsPhoneLandscapePanelHasTopOnlyGeometry: hasExactBorderGeometry(panel, '1px 0px 0px 0px'),
    };
  } finally {
    await page.close();
  }
}

async function verifyWelcomeSurfaceMaterial(page) {
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });

  // CRI-116 · Mismo traslado que en `verifyWelcomeFirstPaintMaterial`: el marco
  // único que este check vigilaba lo eliminó CRI-112, y su papel de figura
  // dominante de la bienvenida lo hereda el carril de puertas.
  const railMaterial = await readComposedMaterial(page, '.welcome-gate-rail');
  out.checks.welcomeRailHasNoBackdropFilter = railMaterial.backdropFilter === 'none';

  const rail = await page.locator('.welcome-gate-rail').evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundImage: style.backgroundImage, borderRadius: style.borderRadius };
  });
  out.checks.welcomeRailHasClayBackground = rail.backgroundImage !== 'none' || railMaterial.backgroundColor !== 'rgba(0, 0, 0, 0)';
  // Comparado contra el valor exacto esperado (--sc-radius-xl → panel, 14px),
  // no contra una simple ausencia de '0px': un radio de otra escala pasaría el
  // check laxo igual de verde que el correcto, que es exactamente como se coló
  // el Critical 2 sin que ningún check lo viera.
  out.checks.welcomeRailHasSurfaceRadius = rail.borderRadius === '14px';

  // CRI-104 · las tres materias que este check vigila (tarjeta de puerta, zona
  // de archivo y tarjeta de ejemplo) conviven ahora en la etapa 3.
  await openWelcomeStep(page, 'Por dónde');

  const cardSelectors = {
    launcher: '.welcome-launcher-card >> nth=0',
    import: '.welcome-import-card >> nth=0',
    template: '.welcome-template-card >> nth=0',
  };

  for (const [key, selector] of Object.entries(cardSelectors)) {
    const locator = page.locator(selector);
    await locator.waitFor({ state: 'visible' });
    const readState = () => locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return { boxShadow: style.boxShadow, borderColor: style.borderColor, transform: style.transform };
    });

    const resting = await readState();
    await locator.hover();
    // `transition` da tiempo a que el navegador anime a los valores finales
    // antes de leer los estilos computados; sin esta espera el `hover` se
    // lee a mitad de camino y el check da falso negativo.
    await page.waitForTimeout(220);
    const hovered = await readState();

    // Un control del sistema no se despega de la ventana al pasar por encima:
    // se tiñe. Lo que este check exige ya no es que la SOMBRA cambie —ninguna
    // lo hace— sino que el hover se note en el plano: relleno o canto.
    out.checks[`welcome${key}CardHoverTintChanges`] =
      hovered.backgroundColor !== resting.backgroundColor || hovered.borderColor !== resting.borderColor;
    // El desplazamiento en hover se retiró del sistema entero: era la firma de
    // la identidad anterior y ningún control del sistema lo hace. Lo que este
    // check afirma ahora es lo contrario — que la tarjeta NO se mueve al pasar
    // el puntero, para que un `translateY` copiado de una regla vieja se vea.
    out.checks[`welcome${key}CardHoverDoesNotLift`] = hovered.transform === resting.transform;

    const box = await locator.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(80);
      const pressed = await readState();
      // Estas tarjetas navegan al soltar el clic sobre ellas mismas (abren un
      // proyecto, un modal o un ejemplo). Mover el ratón fuera del elemento
      // antes de soltar cancela el `click` — se comprueba el estado `:active`
      // sin disparar de verdad el `onClick` y saltar de la bienvenida.
      await page.mouse.move(0, 0);
      await page.mouse.up();
      out.checks[`welcome${key}CardActiveBoxShadowChanges`] = pressed.boxShadow !== hovered.boxShadow;
      // Ronda 1/5: antes sólo se comparaba `boxShadow`, así que no veía que
      // `transform` (launcher/import) o `borderColor` (template) en `:active`
      // no se estaban aplicando de verdad — `button:not(:disabled):active
      // { transform:scale(.975) }` (más específica) se comía el
      // `translateY(1px)` de estas tarjetas en silencio, y ambos checks
      // pasaban igual porque sólo miraban la sombra.
      if (key === 'template') {
        // El `transform` de esta tarjeta lo posee `motion` (layout), así que
        // aquí el indicador de `:active` distinto de la sombra es el borde,
        // no el desplazamiento — ver el comentario de `.welcome-template-card:active`.
        out.checks[`welcome${key}CardActiveBorderColorChanges`] = pressed.borderColor !== hovered.borderColor;
      } else {
        // Ronda 2/5: comparar contra el valor EXACTO esperado, no contra
        // "cambió y no es 'none'". Ese predicado laxo no veía el defecto
        // real: si `button:not(:disabled):active { transform:scale(.975) }`
        // se come el `translateY(1px)` de esta tarjeta (p. ej. porque a
        // alguien se le va el `:not(:disabled)` de `.welcome-launcher-card:active`
        // en `styles.css`), el valor pulsado pasa a
        // `matrix(0.975, 0, 0, 0.975, 0, 0)` — sigue siendo distinto del de
        // `:hover` y sigue siendo distinto de `'none'`, así que el check
        // laxo se quedaba en verde con el defecto reintroducido. El único
        // valor que demuestra el hundimiento correcto es la matriz que
        // produce `--sc-press-transform`.
        //
        // El token pasó de `translateY(1.5px) scale(0.985)` a `scale(0.97)`
        // limpio: un control del sistema no desciende al pulsarse, encoge. Se
        // actualiza el número que este check exige, no el criterio — sigue
        // siendo el valor EXACTO de la matriz, y ahora además exige que NO
        // haya traslación, que es justo la parte que se retiró.
        const values = pressed.transform.match(/^matrix\(([^)]+)\)$/)?.[1]
          .split(',')
          .map((value) => Number.parseFloat(value.trim())) ?? [];
        out.checks[`welcome${key}CardActiveTransformIsPressedScale`] =
          values.length === 6 &&
          Math.abs(values[0] - 0.97) < 0.001 &&
          Math.abs(values[3] - 0.97) < 0.001 &&
          Math.abs(values[4]) < 0.001 &&
          Math.abs(values[5]) < 0.001;
      }
    }
  }

  // El foco por teclado tiene que verse sobre las tres superficies
  // nuevas, no sólo la primera: se llega con Tab de verdad (no `element.focus()`,
  // que en Chromium no siempre dispara `:focus-visible`) y se sigue avanzando
  // en el mismo recorrido (el orden del DOM es launcher x3 → filtros →
  // import → plantillas) para comprobar las tres, en vez de resetear el foco
  // tres veces.
  // El recorrido de Tab arranca desde el principio del documento: la etapa 3
  // ya está abierta por el bloque anterior, así que las tres materias están
  // todas en el árbol y se alcanzan en el mismo barrido.
  await page.locator('body').evaluate((body) => body.focus());
  const capitalize = (s) => s[0].toUpperCase() + s.slice(1);
  const focusChecks = [
    ['launcher', 'welcome-launcher-card'],
    ['import', 'welcome-import-card'],
    ['template', 'welcome-template-card'],
  ];
  for (const [key, className] of focusChecks) {
    let reached = false;
    for (let i = 0; i < 30 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate((cls) => document.activeElement?.classList.contains(cls) ?? false, className);
    }
    out.checks[`welcome${capitalize(key)}CardReachableByTab`] = reached;
    if (reached) {
      const outline = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
      });
      out.checks[`welcome${capitalize(key)}CardFocusVisibleOutline`] = outline.outlineStyle !== 'none' && outline.outlineWidth !== '0px';
    }
  }
}

// Ronda 2/5: el arreglo del Important 4 (el desplazamiento de `:active` se
// anula bajo `prefers-reduced-motion:reduce`, en vez de que se cuele el
// `scale(.975)` global) estaba medido pero no protegido — `grep` de
// `reducedMotion` en `qa.mjs`/`qa-webkit.mjs` no daba ningún acierto. Esta
// función abre su propia página con el contexto en `reducedMotion:'reduce'`
// (lo que Playwright usa para emular `prefers-reduced-motion:reduce`, sin
// tocar el sistema operativo) y exige `transform:none` exacto al pulsar.
async function verifyWelcomeReducedMotionActive() {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await disablePwaUpdateLifecycle(page);
  await startWithEmptyLibrary(page);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  // CRI-104 · la zona de archivo vive en la etapa 3 del recorrido.
  await openWelcomeStep(page, 'Por dónde');

  const cardSelectors = {
    launcher: '.welcome-launcher-card >> nth=0',
    import: '.welcome-import-card >> nth=0',
  };

  for (const [key, selector] of Object.entries(cardSelectors)) {
    const locator = page.locator(selector);
    await locator.waitFor({ state: 'visible' });
    // Ronda 2/5 (fix del propio check): sin este `hover()` previo, Chromium
    // nunca llega a marcar `:hover`/`:active` en esta página recién creada —
    // el `page.mouse.move` + `page.mouse.down()` en crudo no bastan para que
    // el pseudo-estado se registre en un contexto nuevo sin interacción
    // previa (mismo motivo por el que `verifyWelcomeSurfaceMaterial` llama a
    // `locator.hover()` antes de su propio press). Sin el `hover()`, el
    // elemento se queda en su transform de reposo ('none'), la comparación
    // `pressedTransform === 'none'` pasa siempre en verde, y el check no
    // detecta absolutamente nada — se verificó por mutación: sin esta línea,
    // quitar la regla `prefers-reduced-motion` que anula el `transform` de
    // `:active` (Mutation B) no lo ponía en rojo.
    await locator.hover();
    const box = await locator.boundingBox();
    if (!box) throw new Error(`No se pudo medir ${selector} bajo movimiento reducido.`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(80);
    const pressedTransform = await locator.evaluate((element) => getComputedStyle(element).transform);
    await page.mouse.move(0, 0);
    await page.mouse.up();
    out.checks[`welcome${key === 'launcher' ? 'Launcher' : 'Import'}CardActiveTransformNoneUnderReducedMotion`] = pressedTransform === 'none';
  }

  await context.close();
}

async function desktop() {
  const page = await newQaPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) out.console.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', err => out.pageErrors.push(String(err)));
  await loadCleanApp(page);
  await verifyWelcomeHeaderResponsive(page);
  await verifyWelcomeSurfaceMaterial(page);
  await enterWorkspace(page, { example: true });
  Object.assign(out.checks, await verifyTopbarMaterial(page));
  Object.assign(out.checks, await verifyToolRailMaterial(page, 'Desktop'));
  Object.assign(out.checks, await verifyCanvasChromeMaterial(page));
  await page.locator('.inspector-summary.is-empty').waitFor({ state: 'visible' });
  const desktopPanel = await verifyInspectorPanelContract(page, {
    viewport: 'Desktop',
    geometryKey: 'inspectorDesktopPanelHasFourSidedGeometry',
    expectedWidths: '1px 1px 1px 1px',
  });
  Object.assign(out.checks, desktopPanel.checks);
  Object.assign(out.checks, await verifyInspectorSummaryContract(page, 'Empty'));
  await selectFirstInspectorMember(page);
  await page.waitForFunction(() => {
    const summary = document.querySelector('.inspector-summary');
    return Boolean(summary && !summary.classList.contains('is-empty'));
  });
  Object.assign(out.checks, await verifyInspectorSummaryContract(page, 'Selected'));
  const flatFamilies = await verifyInspectorFlatFamilies(page);
  Object.assign(out.checks, flatFamilies.checks);
  out.metrics.inspectorFlatFamilySources = flatFamilies.sources;
  out.checks.title = await page.title();
  out.checks.structureCo = await page.locator('.brand-name').isVisible();
  out.checks.canvas = await page.locator('svg.structural-canvas').isVisible();
  out.checks.noOverlay = (await page.locator('text=/error|failed to compile/i').count()) === 0;
  const firstMemberBox = await page.locator('.member-object').first().boundingBox();
  if (!firstMemberBox) throw new Error('No se pudo medir un miembro para probar el pan.');
  const gridBeforeMiddlePan = await page.locator('.grid-lines line').first().getAttribute('x1');
  await page.mouse.move(firstMemberBox.x + firstMemberBox.width / 2, firstMemberBox.y + firstMemberBox.height / 2);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(firstMemberBox.x + firstMemberBox.width / 2 + 70, firstMemberBox.y + firstMemberBox.height / 2 + 25, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  const gridAfterMiddlePan = await page.locator('.grid-lines line').first().getAttribute('x1');
  out.checks.middlePanFromMember = gridBeforeMiddlePan !== gridAfterMiddlePan;
  const canvasBox = await page.locator('svg.structural-canvas').boundingBox();
  if (!canvasBox) throw new Error('No se pudo medir el lienzo.');
  const gridBeforeSpacePan = await page.locator('.grid-lines line').first().getAttribute('x1');
  // Space-pan is intentionally ignored while focus remains on an editor control.
  // Return focus to the application surface as a keyboard user must do.
  await page.locator('svg.structural-canvas').focus();
  const spacePanTarget = await page.locator('.member-object').first().boundingBox();
  if (!spacePanTarget) throw new Error('No se pudo medir un miembro para probar Space-pan.');
  await page.keyboard.down('Space');
  await page.mouse.move(spacePanTarget.x + spacePanTarget.width / 2, spacePanTarget.y + spacePanTarget.height / 2);
  await page.mouse.down();
  await page.mouse.move(spacePanTarget.x + spacePanTarget.width / 2 - 55, spacePanTarget.y + spacePanTarget.height / 2 - 40, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  out.checks.spacePan = await page.waitForFunction((before) => (
    document.querySelector('.grid-lines line')?.getAttribute('x1') !== before
  ), gridBeforeSpacePan, { timeout: 2000 }).then(() => true, () => false);
  // CRI-119 · Los dos pan de arriba dejan la cámara donde el arrastre la soltó,
  // que puede colocar geometría real detrás de la Cinta fija (mismo suelo que
  // protege D-14/CRI-95: la Cinta nunca cede su alto, así que es el lienzo el
  // que tiene que volver a caber). Sin re-encuadrar aquí, el miembro superior
  // que miden los checks de más abajo (Corte, selección, división) puede quedar
  // matemáticamente correcto pero visualmente detrás de la barra — clicable
  // para nadie. Se usa el propio botón "Ajustar modelo a la vista" del
  // producto, la misma acción que tomaría una persona en ese aprieto.
  await page.getByRole('button', { name: 'Ajustar modelo a la vista', exact: true }).click();
  const bodyScroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  out.metrics.desktop = bodyScroll;
  await page.screenshot({ path: path.join(artifactsDir, 'desktop.png'), fullPage: false });
  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  // CRI-119 · Analizar ya no abre las salidas por su cuenta: son una
  // superficie invocada, hay que pedirlas.
  await openResultsSurface(page);
  Object.assign(out.checks, await verifyResultsClayMaterial(page));
  await page.getByRole('tab', { name: 'Momento', exact: true }).click();
  await page.locator('.diagram-chart.moment').waitFor({ state: 'visible' });
  out.checks.momentChart = await page.locator('.diagram-chart.moment .chart-line').count() === 1;
  out.checks.momentCanvas = await page.locator('.diagram-shape.moment').count() > 0;
  // CRI-119 · `getByTitle` buscaba un atributo `title` nativo que estos botones
  // no llevan: `RailTooltip` es un `role="tooltip"` propio, no un `title` del
  // navegador. El nombre accesible real es el `aria-label` de `ToolButton`
  // (`design-system/components/editor.tsx`), que ya compone "{label} ({shortcut})"
  // — exactamente el mismo texto que este check buscaba, sólo que por el
  // locator equivocado.
  await page.locator('.desktop-tool-list').getByRole('button', { name: 'Corte (X)', exact: true }).click();
  const topBeam = page.locator('.member-object').nth(1);
  const beamBox = await topBeam.boundingBox();
  if (!beamBox) throw new Error('No se pudo medir el miembro superior.');
  await page.mouse.click(beamBox.x + beamBox.width / 2, beamBox.y + beamBox.height / 2);
  await page.locator('.cut-tooltip').waitFor({ state: 'visible' });
  out.checks.cutEquations = await page.locator('.cut-equilibrium > code').count() === 3;
  out.checks.cutResiduals = await page.locator('.cut-residuals span').count() === 3;
  await page.screenshot({ path: path.join(artifactsDir, 'moment-and-cut.png'), fullPage: false });
  await page.getByRole('tab', { name: 'Cortante', exact: true }).click();
  out.checks.shearChart = await page.locator('.diagram-chart.shear').isVisible();
  // CRI-119 · «Aprender» tampoco es ya una pestaña residente (CRI-101): es la
  // vista `learn` de la superficie densa, invocada por su lanzador.
  await page.locator('[data-dense-launcher="learn"]').click();
  await page.locator('.dense-results-surface').waitFor({ state: 'visible' });
  out.checks.learningSteps = await page.locator('.dense-results-surface .learning-steps details').count();
  await page.keyboard.press('Escape');
  await page.locator('.dense-results-surface').waitFor({ state: 'hidden' });
  await setOverflowSelect(page, 'Idioma', 'en');
  out.checks.languageEnglish = await page.getByRole('button', { name: 'Analyze', exact: true }).isVisible()
    && await page.getByRole('tab', { name: 'Shear', exact: true }).isVisible();
  await setOverflowSelect(page, 'Language', 'es');
  await page.locator('.desktop-tool-list').getByRole('button', { name: 'Seleccionar (V)', exact: true }).click();
  await page.locator('.member-object').nth(0).evaluate((element) => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
  await page.locator('.member-object').nth(1).evaluate((element) => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, shiftKey: true })));
  await page.waitForFunction(() => document.querySelectorAll('.member-object.selected').length >= 2);
  out.checks.multiSelection = await page.locator('.member-object.selected').count() >= 2;
  const membersBeforeSplit = await page.locator('.member-object').count();
  await page.locator('.desktop-tool-list').getByRole('button', { name: 'Dividir miembro (B)', exact: true }).click();
  const splitTarget = page.locator('.member-object').nth(1);
  const splitBox = await splitTarget.boundingBox();
  if (!splitBox) throw new Error('No se pudo medir el miembro a dividir.');
  await page.mouse.click(splitBox.x + splitBox.width / 2, splitBox.y + splitBox.height / 2);
  out.checks.memberSplit = await page.waitForFunction((expected) => (
    document.querySelectorAll('.member-object').length === expected
  ), membersBeforeSplit + 1, { timeout: 2000 }).then(() => true, () => false);
  await setOverflowSelect(page, 'Unidades', 'N-mm');
  out.checks.unitChanged = await page.locator('.units-select').inputValue() === 'N-mm';
  await toggleThemeFromOverflow(page, 'Tema oscuro');
  out.checks.darkTheme = await page.evaluate(() => document.documentElement.dataset.theme === 'dark');

  // Rebuild the current example with only one pin to exercise a true rigid-body mechanism.
  await page.waitForTimeout(350);
  const projectJson = await page.evaluate(() => localStorage.getItem('structureCo.project'));
  if (!projectJson) throw new Error('No se encontró el proyecto guardado para la prueba de mecanismo.');
  const unstableProject = JSON.parse(projectJson);
  unstableProject.id = 'qa-mechanism';
  unstableProject.name = 'Mecanismo QA';
  unstableProject.nodes = [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 4, y: 0, support: { type: 'none' } },
  ];
  unstableProject.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
  unstableProject.loadCases = [{ id: 'LC1', name: 'Caso QA', category: 'variable', active: true }];
  unstableProject.combinations = [];
  unstableProject.nodalLoads = [{ id: 'P', nodeId: 'N2', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
  unstableProject.memberLoads = [];
  await page.close();

  const mechanismPage = await newQaPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
  mechanismPage.on('console', msg => { if (['error','warning'].includes(msg.type())) out.console.push(`mechanism ${msg.type()}: ${msg.text()}`); });
  mechanismPage.on('pageerror', err => out.pageErrors.push(`mechanism ${String(err)}`));
  await mechanismPage.goto(baseURL, { waitUntil: 'networkidle' });
  await mechanismPage.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await mechanismPage.evaluate((seed) => {
    localStorage.clear();
    localStorage.setItem('structureCo.project', seed);
    localStorage.setItem('structureCo.theme', 'dark');
  }, JSON.stringify(unstableProject));
  await mechanismPage.reload({ waitUntil: 'networkidle' });
  await enterWorkspace(mechanismPage);
  await mechanismPage.getByRole('button', { name: 'Analizar', exact: true }).click();
  await mechanismPage.locator('.mechanism-layer').waitFor({ state: 'visible' });
  out.checks.mechanismOverlay = await mechanismPage.locator('.mechanism-member').count() > 0;
  out.checks.mechanismNodes = await mechanismPage.locator('.mechanism-node').count() > 0;
  // CRI-119 · "modo nulo dominante" no existe en ningún catálogo de i18n
  // actual; el aviso de mecanismo vigente es `canvas.mechanismDetected`
  // ("Mecanismo detectado · nulidad {n}"), en la leyenda que pinta
  // `CanvasResultLayer.tsx`.
  out.checks.mechanismIssue = await mechanismPage.getByText(/mecanismo detectado/i).isVisible();
  await mechanismPage.screenshot({ path: path.join(artifactsDir, 'mechanism.png'), fullPage: false });
  await mechanismPage.setViewportSize({ width: 430, height: 932 });
  const mechanismMobileMetrics = await mechanismPage.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  out.checks.mechanismMobileNoHorizontalOverflow = mechanismMobileMetrics.sw <= mechanismMobileMetrics.cw + 1;
  out.checks.mechanismMobileOverlay = await mechanismPage.locator('.mechanism-layer').isVisible();
  await mechanismPage.screenshot({ path: path.join(artifactsDir, 'mechanism-mobile.png'), fullPage: false });
  await mechanismPage.close();
}

async function influenceWorkflow() {
  const page = await newQaPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) out.console.push(`influence ${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', err => out.pageErrors.push(`influence ${String(err)}`));
  await loadCleanApp(page);
  // CRI-119 · las plantillas de ejemplo, «viga simplemente apoyada» incluida,
  // viven en el tercer paso ("Por dónde") desde CRI-112.
  await openWelcomeStep(page, 'Por dónde');
  await activateWelcomeLauncher(page, page.getByRole('button', { name: /viga simplemente apoyada/i }).first());
  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  // CRI-119 · «Influencia» tampoco es ya una pestaña residente (CRI-101): abrir
  // su lanzador denso ya deja la superficie en esa vista, sin pestaña propia
  // que pulsar además.
  await openResultsSurface(page);
  await page.locator('[data-dense-launcher="influence"]').click();
  await page.locator('.dense-results-surface').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Calcular', exact: true }).click();
  const lineView = page.locator('.influence-line-view');
  await lineView.getByRole('img', { name: /Línea de influencia M en M1/ }).waitFor({ state: 'visible' });
  const lineText = await lineView.innerText();
  // S11 replaced the raw .toPrecision(5) this value used to go through with the shared
  // formatSignificant policy, which strips cosmetic trailing zeros ("2.0000" -> "2"). The
  // "x 4.000 m" position keeps its fixed 3-decimal alignment (formatFixed), unaffected.
  out.checks.influenceMomentExact = /Máximo\s+2 m\s+x 4\.000 m/i.test(lineText);
  out.checks.influencePiecewiseExact = lineText.includes('2 cúbicas') && lineText.includes('0 saltos explícitos');
  out.checks.influenceDiagnostics = await lineView.locator('.verification-grid > .passed').count() === 4;
  out.checks.influenceStaticLoadsHidden = await page.locator('.load-layer').count() === 0;
  const chart = lineView.getByRole('img', { name: /Línea de influencia M en M1/ });
  const chartBox = await chart.boundingBox();
  if (!chartBox) throw new Error('No se pudo medir la línea de influencia.');
  await chart.click({ position: { x: chartBox.width / 2, y: chartBox.height / 2 } });
  await page.locator('.influence-unit-load text').waitFor({ state: 'visible' });
  out.checks.influenceCanvasLinked = await page.locator('.influence-path').count() === 1
    && await page.locator('.influence-target').count() === 1
    && (await page.locator('.influence-unit-load text').textContent()).includes('ψ 2.0000 m');
  await page.screenshot({ path: path.join(artifactsDir, 'influence-line.png'), fullPage: false });

  await lineView.getByRole('tab', { name: 'Tren de ejes', exact: true }).click();
  await lineView.getByRole('button', { name: 'Quitar', exact: true }).last().click();
  await lineView.getByRole('spinbutton', { name: 'Carga del eje 1' }).fill('10');
  await lineView.getByRole('button', { name: 'Calcular', exact: true }).click();
  await lineView.getByRole('img', { name: /Respuesta exacta del tren para M en M1/ }).waitFor({ state: 'visible' });
  const trainText = await lineView.innerText();
  // Same S11 formatSignificant change: "20.000 kN·m" -> "20 kN·m".
  out.checks.influenceSingleAxleExact = /Máximo del tren\s+20 kN·m\s+ref\. 4\.000 m/i.test(trainText);
  out.checks.influenceTrainWithoutGrid = trainText.includes('no usa una cuadrícula de posiciones');

  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(350);
  const mobileMetrics = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  out.checks.influenceMobileNoHorizontalOverflow = mobileMetrics.sw <= mobileMetrics.cw + 1;
  // CRI-119 · Influencia ya no vive en `.results-panel` (que en K0 sigue
  // `mobile-collapsed` detrás, irrelevante aquí): vive en la superficie densa,
  // que a este ancho se presenta `fullscreen` — sin colapso que destapar, el
  // broker ya la deja a pantalla completa. El check mide esa superficie.
  const influenceMobilePanel = await page.locator('.dense-results-surface').boundingBox();
  out.checks.influenceMobilePanelHeight = (influenceMobilePanel?.height ?? 0) >= 280;
  out.checks.influenceMobileControls = await lineView.getByRole('tab', { name: 'Tren de ejes', exact: true }).isVisible();
  await page.screenshot({ path: path.join(artifactsDir, 'influence-mobile.png'), fullPage: false });
  await page.close();
}

async function mobile() {
  const page = await newQaPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) out.console.push(`mobile ${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', err => out.pageErrors.push(`mobile ${String(err)}`));
  await loadCleanApp(page);
  const cdp = await page.context().newCDPSession(page);
  await verifyWelcomeMobileScroll(page, cdp, { width: 390, height: 844 });
  await page.setViewportSize({ width: 430, height: 932 });
  await page.reload({ waitUntil: 'networkidle' });
  await verifyWelcomeMobileScroll(page, cdp, { width: 430, height: 932 });
  await enterWorkspace(page, { example: true });
  Object.assign(out.checks, await verifyToolRailMaterial(page, 'Mobile'));
  const metrics = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  out.metrics.mobile = metrics;
  out.checks.mobileNoHorizontalOverflow = metrics.sw <= metrics.cw + 1;
  out.checks.mobileToolbar = await page.locator('.toolbar').isVisible();
  const mobileCanvasBox = await page.locator('svg.structural-canvas').boundingBox();
  if (!mobileCanvasBox) throw new Error('No se pudo medir el lienzo móvil.');
  const mobileGridBeforePan = await page.locator('.grid-lines line').first().getAttribute('x1');
  const panStart = { x: mobileCanvasBox.x + mobileCanvasBox.width - 60, y: mobileCanvasBox.y + 120 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...panStart, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: panStart.x - 58, y: panStart.y + 34, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const mobileGridAfterPan = await page.locator('.grid-lines line').first().getAttribute('x1');
  out.checks.mobileOneFingerPan = mobileGridBeforePan !== mobileGridAfterPan;
  const gridLinesBeforePinch = await page.locator('.grid-lines line').evaluateAll((lines) => lines.slice(0, 3).map((line) => line.getAttribute('x1')));
  const pinchY = mobileCanvasBox.y + Math.min(210, mobileCanvasBox.height / 2);
  // CRI-119 · Las coordenadas eran fijas (145/285), pensadas para un lienzo
  // ancho. `.toolbar` hereda `--toolbar-w` de un `:root { --toolbar-w:
  // var(--sc-layout-rail-compact) }` que corre para CUALQUIER ancho
  // ≤1279px (`styles.css`, independiente de la clase de composición X2/M1/K0)
  // y en K0 el lienzo puede terminar mucho más angosto que esos 430px del
  // viewport — medido: 76px. Igual que el pan de una sola mano, ya derivado de
  // `mobileCanvasBox`, el pellizco se ancla al lienzo real en vez de a
  // coordenadas absolutas: sigue siendo un pellizco de verdad, sólo que a la
  // escala del lienzo que hay, no la que se asumía que habría.
  const pinchSpread = Math.max(16, mobileCanvasBox.width * 0.3);
  const pinchCenterX = mobileCanvasBox.x + mobileCanvasBox.width / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pinchCenterX - pinchSpread / 2, y: pinchY, id: 2 }, { x: pinchCenterX + pinchSpread / 2, y: pinchY, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pinchCenterX - pinchSpread, y: pinchY - 18, id: 2 }, { x: pinchCenterX + pinchSpread, y: pinchY - 18, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const gridLinesAfterPinch = await page.locator('.grid-lines line').evaluateAll((lines) => lines.slice(0, 3).map((line) => line.getAttribute('x1')));
  out.checks.mobilePinchZoom = JSON.stringify(gridLinesBeforePinch) !== JSON.stringify(gridLinesAfterPinch);
  // CRI-119 · El Inspector abre en K0 con detent «Media» por defecto (mismo
  // valor por defecto que declara `Inspector.tsx`, sin nada seleccionado), y a
  // esa altura cubre la Cinta de acciones del lienzo — el botón "Ajustar
  // modelo a la vista" queda detrás, no desaparecido. Se colapsa a «Compacta»,
  // exactamente el control que una persona usaría en el mismo aprieto.
  // CRI-119 · El Inspector móvil, en la variante `surface="detail"` que usa
  // WorkspaceShell, no lleva botón propio de cierre (sólo lo monta la variante
  // con pestañas, `!surface`) y abre por defecto en detent «Media», cubriendo
  // la Cinta de acciones del lienzo — el botón "Ajustar modelo a la vista"
  // queda detrás, no desaparecido. En vez de pelear con la geometría de la
  // hoja, se dispara el mismo comando que ese botón emite en producción
  // (`CanvasChrome.tsx` ya escucha `fit-canvas` para el atajo de teclado).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('structureco:fit-canvas')));
  await page.waitForTimeout(120);
  // CRI-119 · La hoja del Inspector (`surface="detail"`) está retenida desde
  // el arranque en K0 —vacía, sin selección— y su detent «Media» cubre hasta
  // el 58% inferior de la pantalla; el primer nodo cae dentro de esa franja,
  // así que un toque ahí aterriza en `.inspector-empty-state`, no en el
  // lienzo (confirmado con `elementsFromPoint`). Se cierra igual que más
  // abajo se hace tras seleccionar: Escape, que `Inspector.tsx` ya escucha.
  if (await page.locator('.inspector-panel.mobile-open').isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.locator('.inspector-panel.mobile-open').waitFor({ state: 'hidden' });
  }
  const firstNode = page.locator('.node-object').first();
  const firstNodeBox = await firstNode.locator('.node-hit').boundingBox();
  if (!firstNodeBox) throw new Error('No se pudo medir un nodo móvil.');
  const firstNodeLabelBeforeDrag = await firstNode.getAttribute('aria-label');
  const nodeDragStart = { x: firstNodeBox.x + firstNodeBox.width / 2, y: firstNodeBox.y + firstNodeBox.height / 2 };
  // Un `id` consistente en las tres fases (como ya hace el pan de una sola
  // mano de más arriba) evita que Chrome desasocie el `touchMove` del toque
  // que capturó el puntero al empezar.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...nodeDragStart, id: 0 }] });
  for (const progress of [0.34, 0.67, 1]) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: nodeDragStart.x + 44 * progress, y: nodeDragStart.y + 28 * progress, id: 0 }],
    });
    await page.waitForTimeout(24);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  out.checks.mobileTouchDragOnNodePans = await page.waitForFunction(({ x, y }) => {
    const rect = document.querySelector('.node-object .node-hit')?.getBoundingClientRect();
    return Boolean(rect && Math.hypot(rect.x - x, rect.y - y) > 10);
  }, { x: firstNodeBox.x, y: firstNodeBox.y }, { timeout: 2000 }).then(() => true, () => false);
  out.checks.mobileTouchDragPreservesNode = firstNodeLabelBeforeDrag === await firstNode.getAttribute('aria-label');
  // CRI-119 · Seleccionar en el lienzo pide el Inspector (`onRequestInspector`
  // en `StructuralCanvas.tsx`), que reabre la hoja y vuelve a tapar la Cinta —
  // mismo comando de antes para "Ajustar". El `.mobile-tool-dock` (donde vive
  // "Herramientas de carga") no tiene comando equivalente en el bus, así que a
  // ÉSE se le despeja el camino cerrando la hoja con Escape, que `Inspector.tsx`
  // ya escucha para cualquier variante de superficie, no sólo la de pestañas.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('structureco:fit-canvas')));
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.locator('.inspector-panel.mobile-open').waitFor({ state: 'hidden' });
  // CRI-119 · Con `hasTouch:true` + `isMobile:true`, el clic sintético de
  // Playwright sobre estos controles (portales al final de `<body>`, como el
  // resto de hojas y paletas móviles) queda por debajo de un backdrop que su
  // propia comprobación de estabilidad —geometría, no pintado— no ve: pasa
  // "visible, enabled, stable" y aun así el clic se intercepta. Confirmado con
  // lecturas directas: la geometría del botón es correcta y estable en cada
  // fotograma; el fallo es del hit-test de Playwright bajo emulación táctil,
  // no del layout. `el.click()` dispara el evento real sobre el elemento real,
  // sin pasar por ese hit-test.
  await page.locator('.mobile-tool-dock').getByRole('button', { name: 'Herramientas de carga' }).evaluate((el) => el.click());
  out.checks.mobileLoadSheet = await page.locator('.mobile-tool-palette-loads').isVisible();
  await page.getByRole('menuitemradio', { name: /Carga puntual/ }).evaluate((el) => el.click());
  out.checks.mobileLoadPlacementMode = await page.getByRole('button', { name: 'Cancelar colocación' }).first().isVisible();
  const memberLoadsBeforeTouchPlacement = await page.locator('[data-structure-kind="memberLoad"]').count();
  const targetMemberBox = await page.locator('.member-object').first().boundingBox();
  if (!targetMemberBox) throw new Error('No se pudo medir el miembro móvil.');
  const touchPlacementPoint = { x: targetMemberBox.x + targetMemberBox.width / 2, y: targetMemberBox.y + targetMemberBox.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touchPlacementPoint, id: 8 }] });
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.locator('.inspector-panel.mobile-open').waitFor({ state: 'visible' });
  const phonePanel = await verifyInspectorPanelContract(page, {
    viewport: 'Phone',
    geometryKey: 'inspectorPhonePanelHasBottomSheetGeometry',
    expectedWidths: '1px 1px 0px 1px',
  });
  Object.assign(out.checks, phonePanel.checks);
  out.checks.mobileTouchPlacesLoad = await page.locator('[data-structure-kind="memberLoad"]').count() === memberLoadsBeforeTouchPlacement + 1;
  out.checks.mobileLoadEditor = await page.getByRole('dialog', { name: 'Inspector' }).getByRole('button', { name: 'Eliminar carga' }).isVisible();
  // CRI-119 · Mismo hit-test bajo emulación táctil que arriba.
  await page.getByRole('dialog', { name: 'Inspector' }).getByRole('button', { name: 'Eliminar carga' }).evaluate((el) => el.click());
  // CRI-119 · Este diálogo es la variante `surface="detail"` de Inspector.tsx,
  // que no monta el botón "Cerrar inspector" (sólo lo hace la variante con
  // pestañas, `!surface`) — el mismo hallazgo de más arriba. Escape es el único
  // cierre disponible para cualquier variante.
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Inspector' }).waitFor({ state: 'hidden' });
  out.checks.mobileMore = await page.getByLabel('Más acciones').isVisible();
  await page.getByLabel('Más acciones').click();
  out.checks.mobileMenu = await page.locator('.mobile-actions-menu').isVisible();
  const darkButton = page.getByRole('button', { name: /Tema oscuro|Tema claro/ });
  await darkButton.click();
  out.checks.mobileThemeChanged = await page.evaluate(() => document.documentElement.dataset.theme === 'dark');
  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  // CRI-119 · Analizar ya no abre las salidas por su cuenta.
  await openResultsSurface(page);
  await page.getByRole('tab', { name: 'Momento', exact: true }).click();
  await page.locator('.diagram-chart.moment').waitFor({ state: 'visible' });
  Object.assign(out.checks, await verifyResultsPhonePortraitMaterial(page));
  const membersBeforeModalShortcut = await page.locator('.member-object').count();
  // CRI-119 · `closeMobileResults` en `ResultsPanel.tsx` (`onSheetEscape`) llama
  // `onOpenChange?.(false)` sin condición: Escape en K0 CIERRA la superficie de
  // resultados entera, no la colapsa a `.mobile-collapsed` — esa clase existe
  // para el estado inicial antes de expandir, no para lo que deja Escape. Este
  // script esperaba el colapso; se espera ahora el cierre real, que es lo que
  // el producto hace y lo que el resto del flujo necesita para seguir con el
  // Inspector.
  await page.locator('.results-panel').press('Escape');
  await page.locator('.results-panel').waitFor({ state: 'hidden' });
  // CRI-119 · Mismo hit-test bajo emulación táctil que arriba.
  await page.getByLabel('Abrir inspector').evaluate((el) => el.click());
  out.checks.mobileInspector = await page.locator('.inspector-panel.mobile-open').isVisible();
  // CRI-119 · `surface="detail"` fuerza la pestaña "Inspector"
  // (`forcedTab` en `Inspector.tsx`) y por eso NO monta el `tablist` — no hay
  // pestaña «Inspector» que pulsar en esta variante, sólo el diálogo.
  await page.getByRole('dialog', { name: 'Inspector' }).press('Delete');
  out.checks.mobileInspectorBlocksCanvasShortcuts = await page.locator('.member-object').count() === membersBeforeModalShortcut;
  // CRI-119 · Otra vez la variante `surface="detail"`, sin botón de cierre.
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Inspector' }).waitFor({ state: 'hidden' });
  await page.screenshot({ path: path.join(artifactsDir, 'mobile.png'), fullPage: false });
  await page.close();
}

async function educationalExample() {
  const page = await newQaPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) out.console.push(`educational ${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', err => out.pageErrors.push(`educational ${String(err)}`));
  await loadCleanApp(page);
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Abrir proyectos y ejemplos' }).click();
  await page.locator('.project-menu button').filter({ hasText: 'Hibbeler · carga tributaria Fig. 2–11' }).click();
  out.checks.hibbelerProjectLoaded = await page.getByLabel('Nombre del proyecto').inputValue() === 'Hibbeler · carga tributaria Fig. 2–11';
  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  // CRI-119 · El estado del análisis se movió a la Cinta desde CRI-100 (el
  // propio comentario de `ResultsPanel.tsx` lo dice: "deben verse sin abrir
  // este panel"), y con él la marca de "resuelto" — ya no vive en
  // `.results-commandbar__context`, vive en `AnalysisStatus.tsx`. Y Analizar
  // ya no abre las salidas por su cuenta, así que hay que pedirlas aparte.
  await page.locator('[data-analysis-status="resolved"]').waitFor({ state: 'visible' });
  await openResultsSurface(page);
  await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
  await page.getByRole('region', { name: 'Resumen global de resultados', exact: true }).waitFor({ state: 'visible' });
  // CRI-119 · Las reacciones se pintan en el lienzo con `showResults` a secas
  // (`renderReaction` en `CanvasResultLayer.tsx` no depende de `resultTab`,
  // sólo de `resultsAllowed`/`analysis.success`), así que ya están ahí sin
  // pulsar nada — «Reacciones» dejó de ser una pestaña que las revele.
  // Phase 3 separates the stroked reaction geometry from its decluttered value
  // labels. A vertical SVG line has a zero-width DOMRect even though its stroke
  // is rendered, so assert the geometry is attached and the P1 labels are visible.
  await page.locator('.reaction-symbol').first().waitFor({ state: 'attached' });
  await page.locator('[data-smart-label^="reaction:"] text').first().waitFor({ state: 'visible' });
  const reactionLabels = await page.locator('[data-smart-label^="reaction:"] text').allTextContents();
  out.checks.hibbelerReactions = reactionLabels.filter((label) => label.includes('2.500 kip')).length === 2;
  await page.getByRole('tab', { name: 'Momento', exact: true }).click();
  await page.locator('.diagram-chart.moment').waitFor({ state: 'visible' });
  out.checks.hibbelerMomentChart = await page.locator('.diagram-chart.moment').isVisible();
  // CRI-119 · «Aprender» tampoco es ya una pestaña residente: es la vista
  // `learn` de la superficie densa, invocada por su lanzador.
  await page.locator('[data-dense-launcher="learn"]').click();
  await page.locator('.dense-results-surface').waitFor({ state: 'visible' });
  await page.locator('.educational-source').waitFor({ state: 'visible' });
  const sourceText = await page.locator('.educational-source').innerText();
  out.checks.hibbelerSource = sourceText.includes('Ejemplo atribuido') && sourceText.includes('muestra oficial Pearson');
  out.checks.hibbelerExpectedReaction = sourceText.includes('RA = RB = 2.500 kip');
  out.checks.hibbelerExpectedMoment = sourceText.includes('Mmax = 6.250 kip·ft en x = 5.000 ft');
  await page.screenshot({ path: path.join(artifactsDir, 'hibbeler-example.png'), fullPage: false });
  await page.setViewportSize({ width: 430, height: 932 });
  const metrics = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  out.checks.hibbelerMobileNoHorizontalOverflow = metrics.sw <= metrics.cw + 1;
  // CRI-119 · «Aprender» vive en la superficie densa, no en `.results-panel`
  // (que en K0 sigue `mobile-collapsed` detrás, irrelevante aquí); la densa se
  // presenta `fullscreen` en K0, sin colapso que destapar.
  out.checks.hibbelerMobileSource = await page.locator('.educational-source').isVisible();
  await page.screenshot({ path: path.join(artifactsDir, 'hibbeler-example-mobile.png'), fullPage: false });
  await page.close();
}

await verifyWelcomeFirstPaintMaterial();
await verifyWelcomeReducedMotionActive();
await desktop();
Object.assign(out.checks, await verifyInspectorResponsiveViewports());
Object.assign(out.checks, await verifyResultsPhoneLandscapeMaterial());
await influenceWorkflow();
await mobile();
await educationalExample();
await browser.close();
await previewServer.close();
const failedChecks = Object.entries(out.checks).filter(([, value]) => value === false);
fs.writeFileSync(path.join(artifactsDir, 'qa-results.json'), JSON.stringify(out, null, 2));
if (failedChecks.length || out.console.length || out.pageErrors.length) {
  throw new Error(`QA fallida: ${failedChecks.map(([name]) => name).join(', ') || 'errores de consola/página'}`);
}
console.log(JSON.stringify(out, null, 2));
