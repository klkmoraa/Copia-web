// Captura individual de cada elemento/componente de la UI de structureCo, en tema
// claro y oscuro, y empaqueta el resultado en capturas.zip.
//
// Uso:
//   npm run dev            (en otra terminal, deja el servidor corriendo en :5173)
//   node capturas.mjs
//
// Variables opcionales:
//   BASE_URL   URL del servidor local (por defecto http://localhost:5173)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openExamplePortal } from './scripts/qa-welcome.mjs';
import { execFileSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';
const outDir = path.join(root, 'capturas');
const zipPath = path.join(root, 'capturas.zip');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let shotIndex = 0;
const taken = new Set();

function slug(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function shoot(page, theme, group, name) {
  const base = `${String(++shotIndex).padStart(3, '0')}_${theme}_${slug(group)}_${slug(name)}`;
  let fileName = `${base}.png`;
  let n = 2;
  while (taken.has(fileName)) fileName = `${base}-${n++}.png`;
  taken.add(fileName);
  const target = path.join(outDir, fileName);
  try {
    await page.screenshot({ path: target });
    console.log(`✓ ${fileName}`);
  } catch (err) {
    console.warn(`✗ omitida ${fileName}: ${err.message.split('\n')[0]}`);
  }
}

async function shootLocator(page, theme, group, name, locator) {
  const base = `${String(++shotIndex).padStart(3, '0')}_${theme}_${slug(group)}_${slug(name)}`;
  let fileName = `${base}.png`;
  let n = 2;
  while (taken.has(fileName)) fileName = `${base}-${n++}.png`;
  taken.add(fileName);
  const target = path.join(outDir, fileName);
  try {
    if (!(await locator.first().isVisible())) return;
    await locator.first().screenshot({ path: target });
    console.log(`✓ ${fileName}`);
  } catch (err) {
    console.warn(`✗ omitida ${fileName}: ${err.message.split('\n')[0]}`);
  }
}

/** Captura cada elemento visible que matchee un selector CSS, uno por uno. */
async function shootEach(page, theme, group, selector, labelAttr = null) {
  const handles = await page.locator(selector).all();
  let i = 0;
  for (const handle of handles) {
    i += 1;
    let label = `${i}`;
    if (labelAttr) {
      const attrValue = await handle.getAttribute(labelAttr).catch(() => null);
      if (attrValue) label = attrValue;
    } else {
      const text = (await handle.innerText().catch(() => '')) || '';
      if (text.trim()) label = text.trim().slice(0, 40);
    }
    await shootLocator(page, theme, group, label, handle);
  }
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('structureCo.theme', t);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
}

async function captureWelcome(page, theme) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await setTheme(page, theme);
  await page.locator('.welcome-screen').waitFor({ state: 'visible' });

  await shoot(page, theme, 'welcome', 'pantalla-completa');
  await shootLocator(page, theme, 'welcome', 'header', page.locator('.welcome-screen header, .welcome-hero, .welcome-screen .brand-name').first());
  await shootEach(page, theme, 'welcome-boton', '.welcome-screen button');
  await shootEach(page, theme, 'welcome-tarjeta', '.welcome-screen [class*="card"]');
  await shootLocator(page, theme, 'welcome', 'workflow-pasos', page.locator('.welcome-workflow'));
  await shootLocator(page, theme, 'welcome', 'footer', page.locator('.welcome-footer'));
}

async function enterWorkspace(page) {
  // CRI-116 · el pórtico de ejemplo vive en el tercer paso desde CRI-112.
  await openExamplePortal(page);
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
}

async function captureWorkspace(page, theme) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await setTheme(page, theme);
  await page.locator('.welcome-screen').waitFor({ state: 'visible' });
  await enterWorkspace(page);

  await shoot(page, theme, 'workspace', 'vista-completa');

  // Barra superior
  await shootLocator(page, theme, 'topbar', 'barra-completa', page.locator('.top-bar, header.top-bar, [class*="topbar" i], [class*="top-bar" i]').first());
  await shootEach(page, theme, 'topbar-boton', '.top-bar button, header button');

  // Rail / paleta de herramientas
  await shootLocator(page, theme, 'toolrail', 'rail-completo', page.locator('.desktop-tool-list, .tool-rail, [class*="tool-rail" i]').first());
  await shootEach(page, theme, 'herramienta', '.desktop-tool-list button, .tool-rail button', 'title');

  // Lienzo
  await shootLocator(page, theme, 'canvas', 'lienzo', page.locator('svg.structural-canvas'));

  // Panel de resultados y sus tabs
  await shootLocator(page, theme, 'resultados', 'panel-completo', page.locator('.results-panel'));
  await shootEach(page, theme, 'resultados-tab', '.results-panel [role="tab"]');

  for (const tabName of ['Reacciones', 'Momento', 'Cortante', 'Axial', 'Deformada', 'Aprender']) {
    const tab = page.getByRole('tab', { name: tabName, exact: true });
    if (await tab.count()) {
      await tab.click().catch(() => {});
      await page.waitForTimeout(200);
      await shootLocator(page, theme, 'resultados-vista', tabName, page.locator('.results-panel'));
    }
  }

  // Analizar y ver reacciones
  const analizar = page.getByRole('button', { name: 'Analizar', exact: true });
  if (await analizar.count()) {
    await analizar.click().catch(() => {});
    await page.waitForTimeout(300);
    await shoot(page, theme, 'workspace', 'tras-analizar');
  }

  // Selección + inspector
  const firstMember = page.locator('.member-object').first();
  if (await firstMember.count()) {
    await firstMember.click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
    await shootLocator(page, theme, 'inspector', 'panel-con-seleccion', page.locator('.inspector-panel'));
    await shootEach(page, theme, 'inspector-campo', '.inspector-panel input, .inspector-panel select, .inspector-panel button');
  }

  // Menú "Más acciones" (overflow) — selects, botones de tema/idioma
  const moreButton = page.getByRole('button', { name: /Más acciones|More actions/, exact: true });
  if (await moreButton.count()) {
    await moreButton.click().catch(() => {});
    await page.waitForTimeout(200);
    const menu = page.locator('.utility-actions-menu, .mobile-actions-menu').first();
    await shootLocator(page, theme, 'menu', 'mas-acciones', menu);
    await shootEach(page, theme, 'menu-item', '.utility-actions-menu button, .utility-actions-menu select, .mobile-actions-menu button');
    await page.keyboard.press('Escape').catch(() => {});
  }

  // Modal / menú de proyectos y ejemplos
  const projectsButton = page.getByRole('button', { name: 'Abrir proyectos y ejemplos' });
  if (await projectsButton.count()) {
    await projectsButton.click().catch(() => {});
    await page.waitForTimeout(200);
    const projectMenu = page.locator('.project-menu');
    await shootLocator(page, theme, 'modal', 'proyectos-y-ejemplos', projectMenu);
    await page.keyboard.press('Escape').catch(() => {});
  }

  // Barra de herramientas de carga (móvil) / genérica si existe en desktop
  const toolbar = page.locator('.toolbar');
  if (await toolbar.count()) {
    await shootLocator(page, theme, 'toolbar', 'completa', toolbar);
  }

  // Footer
  await shootLocator(page, theme, 'footer', 'pie-de-pagina', page.locator('footer, .app-footer, [class*="footer" i]').first());
}

async function captureMobile(browser, theme) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await setTheme(page, theme);
  await page.locator('.welcome-screen').waitFor({ state: 'visible' });
  await shoot(page, theme, 'movil', 'bienvenida');

  await enterWorkspace(page);
  await shoot(page, theme, 'movil', 'espacio-de-trabajo');
  await shootLocator(page, theme, 'movil', 'barra-de-herramientas', page.locator('.toolbar'));

  const loadTools = page.getByRole('button', { name: 'Herramientas de carga' });
  if (await loadTools.count()) {
    await loadTools.click().catch(() => {});
    await page.waitForTimeout(200);
    await shootLocator(page, theme, 'movil', 'paleta-de-cargas', page.locator('.mobile-tool-palette-loads'));
    await page.keyboard.press('Escape').catch(() => {});
  }

  await page.close();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  });

  try {
    await fetch(baseURL).catch(() => {
      throw new Error(`No se pudo conectar a ${baseURL}. Arranca "npm run dev" en otra terminal primero.`);
    });

    for (const theme of ['light', 'dark']) {
      console.log(`\n== Tema: ${theme} ==`);
      const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
      await captureWelcome(page, theme);
      await captureWorkspace(page, theme);
      await page.close();
      await captureMobile(browser, theme);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${taken.size} capturas guardadas en ${outDir}`);

  fs.rmSync(zipPath, { force: true });
  try {
    execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force`,
    ], { stdio: 'inherit' });
  } catch (err) {
    console.error('No se pudo comprimir con PowerShell Compress-Archive:', err.message);
    throw err;
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(`\ncapturas.zip listo en ${zipPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
