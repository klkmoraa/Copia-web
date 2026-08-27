/**
 * Gate de navegador para la bandeja de herramientas (`.mobile-tool-dock`) y la
 * columna del riel.
 *
 * POR QUÉ EN NAVEGADOR: todo lo que vigila es cascada y geometría. En jsdom no
 * hay ni una hoja cargada, así que `getComputedStyle` diría que todo está bien
 * mientras el usuario ve lo contrario. Los cuatro defectos que cierra se
 * midieron aquí, sobre `dist`, a 390×844:
 *
 *   1. `.desktop-tool-list` revivida en K0 por `.tool-rail.is-compact`
 *      (0,3,0 gana a `@media(max-width:1023px)`, 0,1,0): doce botones reales
 *      fuera de pantalla y 45 px robados a la bandeja.
 *   2. Teclas de 48 px dentro de una bandeja de 42, con relieve de escritorio.
 *   3. Etiquetas de la bandeja recortadas a 1×1 px.
 *   4. El icono de la herramienta ELEGIDA en blanco sobre la cavidad casi
 *      blanca de la bandeja: 1.05:1.
 *
 * Y, en la banda donde `M1` vive de verdad (1024 px arriba, nunca 1440), que la
 * columna del riel sea la compacta y no la ancha de 200 px.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previewServer = await preview({ root, preview: { host: '127.0.0.1', port: 4178, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch(process.env.QA_LOCAL_CHROMIUM_PATH
  ? { headless: true, executablePath: process.env.QA_LOCAL_CHROMIUM_PATH }
  : { headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });

/** Suelo táctil de WCAG 2.5.8, el mismo que usa `qa-topbar.mjs`. */
const TOUCH_FLOOR_PX = 44;
/**
 * Suelo de contraste para gráficos y componentes de interfaz (WCAG 1.4.11). El
 * glifo de una tecla ES la información: si no llega a 3:1 sobre su propio
 * fondo, no se ve cuál está elegida.
 */
const NON_TEXT_CONTRAST_FLOOR = 3;

const portraitSizes = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
];
const landscapeSizes = [
  { width: 740, height: 360 },
  { width: 844, height: 390 },
];
/** Dentro de `M1`: por encima de `COMPACT_CEILING_PX` y por debajo de la frontera con `X2`. */
const compactRailSizes = [
  { width: 1024, height: 600 },
  { width: 1024, height: 768 },
  { width: 1060, height: 820 },
];

const channel = (value) => {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (first, second) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};
const parseRgb = (value) => {
  const parts = value.match(/-?[\d.]+/g)?.map(Number) ?? [];
  return parts.length >= 3 ? parts.slice(0, 3) : null;
};

const readDock = (page) => page.evaluate(() => {
  const box = (element) => {
    const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
    return { left, right, top, bottom, width, height };
  };
  const rail = document.querySelector('.toolbar');
  const list = document.querySelector('.desktop-tool-list');
  const dock = document.querySelector('.mobile-tool-dock');
  const listDisplayed = Boolean(list) && getComputedStyle(list).display !== 'none';
  const keys = dock ? [...dock.querySelectorAll('button')].map((key) => {
    const copy = key.querySelector('.sc-tool-button__copy');
    const label = key.querySelector('.sc-tool-button__copy strong');
    const icon = key.querySelector('.sc-tool-button__icon svg') ?? key.querySelector('.sc-tool-button__icon');
    // El fondo pintado es el primero que no sea transparente subiendo por los
    // ancestros: la tecla en reposo no tiene pieza propia.
    let painted = 'rgba(0, 0, 0, 0)';
    for (let node = key; node; node = node.parentElement) {
      const value = getComputedStyle(node).backgroundColor;
      if (value && !/rgba\(0, 0, 0, 0\)|transparent/.test(value)) { painted = value; break; }
    }
    return {
      name: (key.getAttribute('aria-label') ?? '').trim(),
      active: key.classList.contains('active') || key.classList.contains('is-active'),
      box: box(key),
      labelBox: label ? box(label) : null,
      // El recorte que hay que cazar no vive en el `strong`, sino en el envoltorio
      // que un `clip:rect(0,0,0,0)` de 1×1 px deja «visible» y vacío.
      copyBox: copy ? box(copy) : null,
      copyDisplayed: Boolean(copy) && getComputedStyle(copy).display !== 'none',
      labelDisplayed: Boolean(label) && getComputedStyle(label).display !== 'none',
      iconColor: icon ? getComputedStyle(icon).color : null,
      background: painted,
    };
  }) : [];
  return {
    railBox: rail ? box(rail) : null,
    railColumnWidth: rail ? box(rail).width : 0,
    listDisplayed,
    listButtons: listDisplayed ? list.querySelectorAll('button').length : 0,
    dockDisplayed: Boolean(dock) && getComputedStyle(dock).display !== 'none',
    keys,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
  };
});

const enterWorkspace = async (page) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /continuar proyecto/i }).click();
  await page.locator('.app-shell').waitFor({ state: 'visible' });
};

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

try {
  for (const theme of ['light', 'dark']) {
    for (const size of [...portraitSizes, ...landscapeSizes]) {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: true, isMobile: true, colorScheme: theme });
      const page = await context.newPage();
      await enterWorkspace(page);
      await page.waitForTimeout(120);
      const state = await readDock(page);
      const where = `${theme} ${size.width}×${size.height}`;
      const portrait = size.width < size.height;

      check(state.dockDisplayed, `${where}: the tool dock is not displayed`);
      // 1 · la lista de escritorio no existe en K0: ni un píxel, ni una parada
      // de tabulación fuera de pantalla.
      check(!state.listDisplayed, `${where}: the desktop tool list is displayed in K0 (${state.listButtons} focusable buttons off-screen)`);
      check(state.documentScrollWidth <= state.documentClientWidth, `${where}: the document scrolls horizontally (${state.documentScrollWidth} > ${state.documentClientWidth})`);
      check(state.keys.length === 6, `${where}: the dock has ${state.keys.length} keys, expected 6`);

      for (const key of state.keys) {
        // 2 · cada tecla cabe entera dentro del riel que la aloja.
        check(
          key.box.top >= state.railBox.top - 0.5 && key.box.bottom <= state.railBox.bottom + 0.5
          && key.box.left >= state.railBox.left - 0.5 && key.box.right <= state.railBox.right + 0.5,
          `${where}: dock key «${key.name}» overflows the rail (key ${key.box.top.toFixed(1)}–${key.box.bottom.toFixed(1)}, rail ${state.railBox.top.toFixed(1)}–${state.railBox.bottom.toFixed(1)})`,
        );
        check(
          key.box.width >= TOUCH_FLOOR_PX - 0.5 && key.box.height >= TOUCH_FLOOR_PX - 0.5,
          `${where}: dock key «${key.name}» is ${key.box.width.toFixed(1)}×${key.box.height.toFixed(1)}, below the ${TOUCH_FLOOR_PX}px touch floor`,
        );
        // 3 · en retrato la etiqueta se lee; en apaisado el diseño la apaga a
        // propósito (`display:none`), y apagada no es lo mismo que recortada.
        if (portrait) {
          check(key.labelDisplayed && key.copyDisplayed, `${where}: dock key «${key.name}» lost its label`);
          for (const [what, rect] of [['label', key.labelBox], ['label wrapper', key.copyBox]]) {
            check(
              rect !== null && rect.width > 8 && rect.height > 8,
              `${where}: dock key «${key.name}» renders its ${what} at ${rect?.width.toFixed(1)}×${rect?.height.toFixed(1)} — clipped, not hidden`,
            );
          }
        }
        // 4 · el glifo de la elegida se ve sobre el fondo que realmente tiene.
        const ink = parseRgb(key.iconColor ?? '');
        const background = parseRgb(key.background ?? '');
        if (key.active && ink && background) {
          const ratio = contrast(ink, background);
          check(
            ratio >= NON_TEXT_CONTRAST_FLOOR,
            `${where}: the selected dock key «${key.name}» draws its glyph at ${ratio.toFixed(2)}:1 (${key.iconColor} on ${key.background}), below ${NON_TEXT_CONTRAST_FLOOR}:1`,
          );
        }
      }
      await context.close();
    }
  }

  // 5 · la columna del riel en `M1`: compacta donde `M1` ocurre.
  for (const size of compactRailSizes) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await enterWorkspace(page);
    await page.waitForTimeout(120);
    const state = await page.evaluate(() => {
      const rail = document.querySelector('.toolbar');
      const key = rail?.querySelector('.desktop-tool-list .tool-button');
      return {
        compact: rail?.classList.contains('is-compact') ?? false,
        railWidth: rail?.getBoundingClientRect().width ?? 0,
        keyWidth: key?.getBoundingClientRect().width ?? 0,
        canvasWidth: document.querySelector('.center-stage')?.getBoundingClientRect().width ?? 0,
      };
    });
    const where = `${size.width}×${size.height}`;
    check(state.compact, `${where}: expected the compact rail (M1) and got the expanded one`);
    if (state.compact) {
      // El modelo de presupuesto declara 76 px para este tramo
      // (`CHROME.railIcons`). Una columna más ancha que eso es riel vacío
      // cobrado al lienzo: se midieron 200 px para teclas de 48.
      check(
        state.railWidth <= 76,
        `${where}: the compact rail column is ${state.railWidth.toFixed(0)}px wide for ${state.keyWidth.toFixed(0)}px keys — the budget model declares 76px`,
      );
    }
    await context.close();
  }

  if (failures.length) {
    console.error(`Dock browser gate failed:\n  · ${failures.join('\n  · ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Dock browser gate passed: portrait ${portraitSizes.map((s) => `${s.width}×${s.height}`).join(', ')}; landscape ${landscapeSizes.map((s) => `${s.width}×${s.height}`).join(', ')}; light+dark; compact rail column at ${compactRailSizes.map((s) => `${s.width}×${s.height}`).join(', ')}.`);
  }
} finally {
  await browser.close();
  await previewServer.close();
}
