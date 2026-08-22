import { chromium } from 'playwright';
import { preview } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWelcomeStep } from './qa-welcome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previewServer = await preview({ root, preview: { host: '127.0.0.1', port: 4183, strictPort: true }, logLevel: 'error' });
// `PLAYWRIGHT_EXECUTABLE_PATH` lets a sandboxed runner point at a pre-installed
// Chromium build when the system `chrome` channel isn't present; unset, this
// launches exactly as before (system Chrome via the `chrome` channel).
const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : { headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' };
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const url = 'http://127.0.0.1:4183/';
let baselineProject;
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

const contrastRatio = (locator, backgroundSelector) => locator.evaluate((element, selector) => {
  const parse = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const luminance = (value) => {
    const [red, green, blue] = parse(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const foreground = getComputedStyle(element).color;
  const backgroundElement = element.closest(selector);
  if (!backgroundElement) throw new Error(`Missing contrast background ${selector}`);
  const background = getComputedStyle(backgroundElement).backgroundColor;
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}, backgroundSelector);

/**
 * CRI-116 · La bienvenida es un recorrido de cuatro pasos desde CRI-104, y
 * CRI-112 terminó de mover los lanzadores de ejemplo a la tercera etapa
 * ("Por dónde"). Este helper seguía asumiendo que el pórtico de ejemplo era
 * visible al cargar y que continuar vivía en `.welcome-launcher-card--recent`
 * —selector que ya no existe—, así que el gate entero moría esperando 30s. Ahora
 * navega igual que lo haría una persona: pulsando el paso en el carril. Mismo
 * recorrido que `enterWorkspace` en `qa.mjs`.
 */
const enterWorkspace = async (example = false, reload = true) => {
  if (reload) await page.reload({ waitUntil: 'networkidle' });
  const shell = page.locator('.app-shell');
  // CRI-104 · con proyectos ya guardados el producto entra SOLO a la Mesa: pinta
  // la bienvenida y ~1,5s después, cuando IndexedDB resuelve, salta y desmonta el
  // carril. Las dos son la ruta real del usuario. No se puede correr una carrera
  // entre ambas —la bienvenida siempre gana y luego se desvanece bajo el clic—,
  // así que primero se le da su plazo al salto directo y sólo si no ocurre se
  // recorre la bienvenida a mano. Este script no limpia IndexedDB, así que aquí
  // el salto directo es el caso normal, no el raro.
  const autoEntered = await shell.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false);
  if (!autoEntered) {
    if (example) {
      // CRI-116 · el pórtico de ejemplo vive en el tercer paso desde CRI-112.
      await openWelcomeStep(page, 'Por dónde');
      const exampleCard = page.getByRole('button', { name: /P.rtico de ejemplo/i }).first();
      await exampleCard.waitFor({ state: 'visible' });
      await exampleCard.click();
    } else {
      const continueCard = page.locator('.welcome-resume-card').first();
      await continueCard.waitFor({ state: 'visible' });
      await continueCard.click({ force: true });
    }
  }
  try {
    await shell.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    const text = (await page.locator('body').innerText()).slice(0, 1200);
    const stored = await page.evaluate(() => ({
      local: localStorage.getItem('structureCo.project'),
      loading: document.querySelector('.workspace-loading')?.getAttribute('aria-label'),
    }));
    throw new Error(`Workspace did not open. pageErrors=${JSON.stringify(pageErrors)} stored=${JSON.stringify(stored)} body=${JSON.stringify(text)}`);
  }
  await page.getByRole('button', { name: /^analizar$/i }).waitFor({ state: 'visible' });
};

const waitForSurfaceSettled = async (doctor) => {
  let previous = null;
  let stableSamples = 0;
  let current = null;
  for (let sample = 0; sample < 100; sample += 1) {
    current = await doctor.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        fullscreen: element.parentElement?.dataset.surfacePresentation === 'fullscreen',
        viewportWidth: window.innerWidth,
      };
    });
    const aligned = Math.abs(current.right - current.viewportWidth) <= 1
      && (!current.fullscreen || (
        Math.abs(current.left) <= 1
        && Math.abs(current.top) <= 1
        && Math.abs(current.width - current.viewportWidth) <= 1
      ));
    const stable = previous !== null
      && Math.max(
        Math.abs(current.left - previous.left),
        Math.abs(current.right - previous.right),
        Math.abs(current.top - previous.top),
        Math.abs(current.width - previous.width),
      ) <= 0.25;
    stableSamples = aligned && stable ? stableSamples + 1 : 0;
    if (stableSamples >= 3) return current;
    previous = current;
    await page.waitForTimeout(50);
  }
  throw new Error(`Model Doctor surface did not settle: ${JSON.stringify(current)}`);
};

const openDoctor = async () => {
  const desktopLauncher = page.locator('.model-doctor-launcher');
  if (await desktopLauncher.isVisible()) {
    await desktopLauncher.click();
  } else {
    await page.getByRole('button', { name: /más acciones/i }).click();
    const menu = page.getByRole('dialog', { name: /más acciones/i });
    await menu.getByRole('button', { name: 'Model Doctor' }).click();
  }
  const doctor = page.getByRole('dialog', { name: 'Model Doctor' });
  await doctor.waitFor({ state: 'visible' });
  await waitForSurfaceSettled(doctor);
  return doctor;
};

const loadProject = async (mutate) => {
  const project = structuredClone(baselineProject);
  mutate?.(project);
  await page.evaluate((next) => {
    localStorage.setItem('structureCo.project', JSON.stringify(next));
  }, project);
  await enterWorkspace();
};

const assertGeometry = async (viewport, expectedSide) => {
  await page.setViewportSize(viewport);
  await loadProject((project) => { project.members[0].E = 0; });
  const doctor = await openDoctor();
  // `visible` is reached at the start of the spring. Require three stable
  // aligned samples so an overshoot crossing the viewport edge cannot pass.
  await waitForSurfaceSettled(doctor);
  const geometry = await doctor.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const body = element.querySelector('.sc-modal-surface__body');
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      width: rect.width, height: rect.height,
      bodyOverflowY: body ? getComputedStyle(body).overflowY : '',
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      windowInnerWidth: window.innerWidth,
      visualViewportWidth: window.visualViewport?.width ?? null,
    };
  });
  if (Math.abs(geometry.right - viewport.width) > 1) throw new Error(`Model Doctor is not aligned to the viewport at ${viewport.width}px: ${JSON.stringify(geometry)}`);
  if (geometry.documentScrollWidth > geometry.documentClientWidth + 1) throw new Error(`Horizontal overflow at ${viewport.width}px`);
  if (geometry.bodyOverflowY !== 'auto') throw new Error(`Drawer body is not internally scrollable at ${viewport.width}px`);
  if (expectedSide === 'right' && (geometry.top > 1 || geometry.bottom < viewport.height - 1 || geometry.width > 641)) {
    throw new Error(`Expected right drawer geometry at ${viewport.width}px: ${JSON.stringify(geometry)}`);
  }
  if (expectedSide === 'fullscreen' && (geometry.left > 1 || geometry.top > 1 || geometry.bottom < viewport.height - 1 || geometry.width < viewport.width - 1)) {
    throw new Error(`Expected fullscreen geometry at ${viewport.width}px: ${JSON.stringify(geometry)}`);
  }
  await page.keyboard.press('Escape');
  await doctor.waitFor({ state: 'hidden' });
};

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  // CRI-119 · Este runner heredaba almacenamiento ajeno (IndexedDB
  // `structureCo.projects` con un proyecto vacío de una corrida anterior). La
  // bienvenida sí pinta primero, pero el arranque "con proyecto guardado"
  // (CRI-104) le gana la carrera y entra solo a un modelo vacío antes de que
  // el clic al pórtico de ejemplo llegue a registrarse. `qa.mjs` ya resuelve
  // esto mismo en `loadCleanApp`: limpiar de verdad antes de entrar.
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('structureCo.projects');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await enterWorkspace(true, false);
  baselineProject = await page.evaluate(() => JSON.parse(localStorage.getItem('structureCo.project')));

  // First lazy load on Compact suspends (but retains) Results and returns to its launcher.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('structureco:open-results')));
  const retainedResults = page.locator('.results-panel');
  await retainedResults.waitFor({ state: 'visible' });
  // CRI-119 · Doctor y Estado "nunca desaparecen ni pierden su etiqueta
  // accesible, sea cual sea la clase de composición" (CRI-95, comentario en
  // `TopBar.tsx`): `.model-doctor-launcher` sigue visible en Compacto, así
  // que `openDoctor()` siempre toma esa rama, nunca la de "Más acciones" —
  // el foco vuelve ahí, no al overflow.
  const firstLauncher = page.locator('.model-doctor-launcher');
  const firstPhoneDoctor = await openDoctor();
  const suspendedResults = await retainedResults.evaluate((panel) => ({
    status: panel.getAttribute('data-surface-status'),
    hidden: panel.hidden,
    connected: panel.isConnected,
  }));
  if (suspendedResults.status !== 'suspended' || !suspendedResults.hidden || !suspendedResults.connected) {
    throw new Error(`Compact Results was not retained and suspended before first Doctor load: ${JSON.stringify(suspendedResults)}`);
  }
  await page.keyboard.press('Escape');
  await firstPhoneDoctor.waitFor({ state: 'hidden' });
  await page.waitForFunction((element) => document.activeElement === element, await firstLauncher.elementHandle());
  await page.setViewportSize({ width: 1440, height: 900 });

  // HEALTHY: all clear, modal isolation and return to the persistent launcher.
  const doctorLauncher = page.locator('.model-doctor-launcher');
  const healthy = await openDoctor();
  await healthy.getByRole('heading', { name: /modelo listo para revisar/i }).waitFor();
  const isolated = await page.locator('.app-shell').evaluate((shell) => ({ inert: shell.inert, hidden: shell.getAttribute('aria-hidden') }));
  if (!isolated.inert || isolated.hidden !== 'true') throw new Error('Workspace background was not isolated while Model Doctor was open');
  await page.keyboard.press('Control+K');
  if (await page.getByRole('dialog', { name: /paleta de comandos/i }).count()) throw new Error('Command Palette opened over Model Doctor');
  await page.keyboard.press('Escape');
  await healthy.waitFor({ state: 'hidden' });
  await page.waitForFunction((element) => document.activeElement === element, await doctorLauncher.elementHandle());

  // INVALID PROPERTY: critical, explanation and no invalid auto-repair action.
  await loadProject((project) => { project.members[0].E = 0; });
  const invalid = await openDoctor();
  await invalid.getByText(/1 crítico/).waitFor();
  const critical = invalid.locator('.model-doctor-finding--critical').first();
  await critical.getByRole('button', { name: /explicar/i }).click();
  if (!/rigidez/i.test(await critical.innerText())) throw new Error('Invalid property does not explain its structural impact');
  if (await critical.getByRole('button', { name: /previsualizar|corregir/i }).count()) throw new Error('Invalid property offered topology auto-repair');
  await page.keyboard.press('Escape');

  // EVIDENT NO GROUNDING: shared static solver diagnosis is available pre-analysis and is never auto-repaired.
  await loadProject((project) => {
    project.nodes = project.nodes.map((node) => ({ ...node, support: { type: 'none' } }));
  });
  const ungrounded = await openDoctor();
  const groundingFinding = ungrounded.locator('.model-doctor-finding--critical').filter({ hasText: /sin restricciones/i }).first();
  await groundingFinding.waitFor();
  if (await groundingFinding.getByRole('button', { name: /previsualizar|corregir/i }).count()) throw new Error('Evident no-grounding diagnosis offered auto-repair');
  await page.keyboard.press('Escape');

  // DISCONNECTED TOPOLOGY: locate, inspect a non-mutating preview, apply, undo and redo.
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadProject((project) => {
    project.nodes.push({ id: 'QA-SPLIT', x: 3, y: 4, support: { type: 'fixed' } });
    project.memberLoads.push({
      id: 'QA-LOAD', memberId: 'M2', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real',
      start: 0, end: 1, px: 0, py: -5, position: 0.75,
    });
  });
  let topologyDoctor = await openDoctor();
  let topologyFinding = topologyDoctor.locator('.model-doctor-finding').filter({ hasText: 'QA-SPLIT' }).first();
  await topologyFinding.waitFor();
  await topologyFinding.getByRole('button', { name: /localizar/i }).click();
  // CRI-119 · «Localizar degrada a peek, nunca cierra» (CRI-102 / D-11,
  // comentario en `ModelDoctor.tsx`): la lista de hallazgos sigue montada, sólo
  // se encoge a la manija de restaurar.
  const peekHandle = topologyDoctor.locator('.sc-modal-surface__peek-handle');
  await peekHandle.waitFor({ state: 'visible' });
  await page.locator('.node-object.selected').waitFor();

  await peekHandle.click();
  topologyFinding = topologyDoctor.locator('.model-doctor-finding').filter({ hasText: 'QA-SPLIT' }).first();
  const sourceBeforePreview = await page.evaluate(() => localStorage.getItem('structureCo.project'));
  const membersBeforeRepair = await page.locator('.member-object').count();
  await topologyFinding.getByRole('button', { name: /previsualizar reparaci/i }).click();
  await topologyDoctor.getByRole('heading', { name: /revisi.n de la reparaci.n segura/i }).waitFor();
  await topologyDoctor.getByText(/M2 se dividir/i).waitFor();
  if (await page.evaluate(() => localStorage.getItem('structureCo.project')) !== sourceBeforePreview) throw new Error('Repair preview mutated or persisted the visible project');
  await topologyDoctor.getByRole('button', { name: /aplicar reparaci/i }).click();
  await topologyDoctor.getByText(/una sola intenci.n reversible/i).waitFor();
  if (await topologyDoctor.locator('.model-doctor-finding').filter({ hasText: 'QA-SPLIT' }).count()) throw new Error('Repaired topology finding remained visible after apply');
  if (await page.locator('.member-object').count() !== membersBeforeRepair + 1) throw new Error('Topology repair did not publish the previewed split');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^deshacer$/i }).click();
  if (await page.locator('.member-object').count() !== membersBeforeRepair) throw new Error('One undo did not restore the original topology');
  topologyDoctor = await openDoctor();
  await topologyDoctor.locator('.model-doctor-finding').filter({ hasText: 'QA-SPLIT' }).first().waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^rehacer$/i }).click();
  if (await page.locator('.member-object').count() !== membersBeforeRepair + 1) throw new Error('One redo did not restore the repaired topology');
  topologyDoctor = await openDoctor();
  if (await topologyDoctor.locator('.model-doctor-finding').filter({ hasText: 'QA-SPLIT' }).count()) throw new Error('Repaired finding returned after redo');
  await page.keyboard.press('Escape');

  // STALE PREVIEW: simulate a concurrent metadata edit through the real React input contract.
  await loadProject((project) => {
    project.nodes.push({ id: 'QA-STALE', x: 3, y: 4, support: { type: 'fixed' } });
  });
  const projectNameInput = page.locator('.project-name input');
  topologyDoctor = await openDoctor();
  topologyFinding = topologyDoctor.locator('.model-doctor-finding').filter({ hasText: 'QA-STALE' }).first();
  await topologyFinding.getByRole('button', { name: /previsualizar reparaci/i }).click();
  await projectNameInput.evaluate((input) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, `${input.value} · cambio concurrente`);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' · cambio concurrente' }));
  });
  await page.waitForTimeout(0);
  await projectNameInput.evaluate((input) => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
  });
  await topologyDoctor.getByRole('alert').filter({ hasText: /preview qued. obsoleto/i }).waitFor();
  if (!(await topologyDoctor.getByRole('button', { name: /aplicar reparaci/i }).isDisabled())) throw new Error('A stale preview remained applicable');
  await topologyDoctor.getByRole('button', { name: /regenerar preview/i }).click();
  if (await topologyDoctor.getByRole('button', { name: /aplicar reparaci/i }).isDisabled()) throw new Error('Regenerated preview did not become applicable');
  await page.keyboard.press('Escape');

  // Responsive geometry at desktop, tablet and phone, including the 700px boundary.
  await assertGeometry({ width: 1440, height: 900 }, 'right');
  await assertGeometry({ width: 900, height: 800 }, 'fullscreen');
  await assertGeometry({ width: 701, height: 760 }, 'fullscreen');
  await assertGeometry({ width: 700, height: 760 }, 'fullscreen');
  await assertGeometry({ width: 390, height: 844 }, 'fullscreen');
  // Equivalent CSS viewport at 200% browser zoom on an 800x600 display.
  await assertGeometry({ width: 400, height: 300 }, 'fullscreen');

  // Long content scrolls inside the phone sheet and every interactive target is touch-sized.
  await page.setViewportSize({ width: 390, height: 844 });
  await loadProject((project) => {
    for (let index = 0; index < 18; index += 1) project.nodes.push({ id: `ISO-${index}`, x: 20 + index, y: 20 + index, support: { type: 'none' } });
  });
  const longDoctor = await openDoctor();
  const scroll = await longDoctor.locator('.sc-modal-surface__body').evaluate((body) => ({ client: body.clientHeight, scroll: body.scrollHeight }));
  if (scroll.scroll <= scroll.client) throw new Error('Long findings do not create internal scrolling');
  const undersized = await longDoctor.locator('button').evaluateAll((buttons) => buttons
    .filter((button) => {
      const style = getComputedStyle(button);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map((button) => ({ name: button.getAttribute('aria-label') ?? button.textContent, rect: button.getBoundingClientRect().toJSON() }))
    .filter(({ rect }) => rect.width < 43.5 || rect.height < 43.5));
  if (undersized.length) throw new Error(`Undersized touch targets: ${JSON.stringify(undersized)}`);
  await page.keyboard.press('Escape');

  // Phone bottom sheet consumes the device safe area in both body and sticky preview actions.
  await loadProject((project) => {
    project.nodes.push({ id: 'QA-SAFE-AREA', x: 3, y: 4, support: { type: 'fixed' } });
  });
  const safeAreaDoctor = await openDoctor();
  await safeAreaDoctor.evaluate((element) => {
    element.style.setProperty('--model-doctor-safe-area-bottom', '24px');
    element.style.setProperty('--model-doctor-safe-area-left', '44px');
    element.style.setProperty('--model-doctor-safe-area-right', '44px');
  });
  const safeAreaFinding = safeAreaDoctor.locator('.model-doctor-finding').filter({ hasText: 'QA-SAFE-AREA' }).first();
  await safeAreaFinding.getByRole('button', { name: /previsualizar reparaci/i }).click();
  const safeAreaPadding = await safeAreaDoctor.evaluate((element) => {
    const body = getComputedStyle(element.querySelector('.sc-modal-surface__body'));
    const header = getComputedStyle(element.querySelector('.sc-modal-surface__header'));
    const actions = getComputedStyle(element.querySelector('.model-doctor-preview__actions'));
    return {
      bodyBottom: Number.parseFloat(body.paddingBottom),
      bodyLeft: Number.parseFloat(body.paddingLeft),
      bodyRight: Number.parseFloat(body.paddingRight),
      headerLeft: Number.parseFloat(header.paddingLeft),
      headerRight: Number.parseFloat(header.paddingRight),
      actionsBottom: Number.parseFloat(actions.paddingBottom),
    };
  });
  if (safeAreaPadding.bodyBottom < 39 || safeAreaPadding.actionsBottom < 35
    || safeAreaPadding.bodyLeft < 44 || safeAreaPadding.bodyRight < 44
    || safeAreaPadding.headerLeft < 44 || safeAreaPadding.headerRight < 44) {
    throw new Error(`Phone safe area was not consumed on every exposed edge: ${JSON.stringify(safeAreaPadding)}`);
  }
  await safeAreaDoctor.locator('.model-doctor-preview__back').click();
  await page.keyboard.press('Escape');

  // Day/Night use different resolved surfaces and severity/acknowledged text remains AA.
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadProject((project) => {
    project.nodes.push({ id: 'QA-CONTRAST', x: 20, y: 20, support: { type: 'none' } });
  });
  const dayDoctor = await openDoctor();
  const dayColors = await dayDoctor.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
  const dayWarning = dayDoctor.locator('.model-doctor-finding--warning').first();
  const dayWarningContrast = await contrastRatio(dayWarning.locator('.model-doctor-finding__eyebrow'), '.model-doctor-finding');
  if (dayWarningContrast < 4.5) throw new Error(`Day warning severity contrast is ${dayWarningContrast.toFixed(2)}:1`);
  await dayWarning.getByRole('button', { name: /reconocer/i }).click();
  const dayAcknowledgedContrast = await contrastRatio(dayWarning.locator('p').first(), '.model-doctor-finding');
  if (dayAcknowledgedContrast < 4.5) throw new Error(`Day acknowledged text contrast is ${dayAcknowledgedContrast.toFixed(2)}:1`);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /más acciones/i }).click();
  await page.getByRole('dialog', { name: /más acciones/i }).getByRole('button', { name: /tema oscuro/i }).click();
  const nightDoctor = await openDoctor();
  const nightColors = await nightDoctor.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
  const nightWarningContrast = await contrastRatio(nightDoctor.locator('.model-doctor-finding--warning .model-doctor-finding__eyebrow').first(), '.model-doctor-finding');
  if (nightWarningContrast < 4.5) throw new Error(`Night warning severity contrast is ${nightWarningContrast.toFixed(2)}:1`);
  if (dayColors.background === nightColors.background || dayColors.color === 'rgba(0, 0, 0, 0)' || nightColors.color === 'rgba(0, 0, 0, 0)') {
    throw new Error(`Day/Night surfaces did not resolve correctly: ${JSON.stringify({ dayColors, nightColors })}`);
  }
  await page.keyboard.press('Escape');

  // Full keyboard path: Ctrl+K -> Doctor -> Tab -> Escape -> original launcher.
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadProject((project) => {
    project.members[0].E = 0;
    project.nodes.push({ id: 'QA-KEYBOARD', x: 3, y: 4, support: { type: 'fixed' } });
  });
  const analyze = page.getByRole('button', { name: /^analizar$/i });
  await analyze.focus();
  await page.keyboard.press('Control+K');
  const palette = page.getByRole('dialog', { name: /paleta de comandos/i });
  await palette.waitFor();
  const paletteInput = palette.getByRole('combobox');
  await paletteInput.waitFor();
  await page.keyboard.type('Model Doctor');
  await palette.getByRole('option', { name: /Model Doctor/i }).waitFor();
  await page.keyboard.press('Enter');
  const keyboardDoctor = page.getByRole('dialog', { name: 'Model Doctor' });
  await keyboardDoctor.waitFor();
  await page.waitForFunction((element) => element.contains(document.activeElement), await keyboardDoctor.elementHandle());
  const tabUntil = async (target, reverse = false) => {
    for (let index = 0; index < 40; index += 1) {
      if (await target.evaluate((element) => element === document.activeElement)) return;
      await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
    }
    throw new Error(`Keyboard traversal did not reach ${await target.getAttribute('aria-label') ?? await target.textContent()}`);
  };
  const criticalFilter = keyboardDoctor.getByRole('button', { name: /cr.ticos/i });
  await tabUntil(criticalFilter);
  await page.keyboard.press('Space');
  if (await criticalFilter.getAttribute('aria-pressed') !== 'true') throw new Error('Severity filter was not keyboard operable');
  const explain = keyboardDoctor.locator('.model-doctor-explain').first();
  await tabUntil(explain);
  await page.keyboard.press('Enter');
  if (await explain.getAttribute('aria-expanded') !== 'true') throw new Error('Finding explanation was not keyboard operable');
  const previewAction = keyboardDoctor.getByRole('button', { name: /previsualizar reparaci/i }).first();
  await tabUntil(previewAction);
  await page.keyboard.press('Enter');
  await keyboardDoctor.getByRole('heading', { name: /revisi.n de la reparaci.n segura/i }).waitFor();
  const cancelPreview = keyboardDoctor.locator('.model-doctor-preview__back');
  await tabUntil(cancelPreview);
  await page.keyboard.press('Enter');
  await keyboardDoctor.getByRole('heading', { name: /revisi.n de la reparaci.n segura/i }).waitFor({ state: 'hidden' });
  const returnedPreviewAction = keyboardDoctor.getByRole('button', { name: /previsualizar reparaci/i }).first();
  await page.waitForFunction((element) => document.activeElement === element, await returnedPreviewAction.elementHandle());
  const focusable = keyboardDoctor.locator('button:visible, [href]:visible, input:visible, select:visible, textarea:visible, [tabindex]:not([tabindex="-1"]):visible');
  const firstFocusable = focusable.first();
  const lastFocusable = focusable.last();
  await firstFocusable.focus();
  await page.keyboard.press('Shift+Tab');
  if (!(await lastFocusable.evaluate((element) => element === document.activeElement))) throw new Error('Shift+Tab did not wrap to the last modal control');
  await page.keyboard.press('Tab');
  if (!(await firstFocusable.evaluate((element) => element === document.activeElement))) throw new Error('Tab did not wrap to the first modal control');
  await page.keyboard.press('Escape');
  await keyboardDoctor.waitFor({ state: 'hidden' });
  if (!(await analyze.evaluate((element) => element === document.activeElement))) throw new Error('Focus did not return through the keyboard launcher path');

  // Reduced-motion media is accepted and the feature-specific transitions collapse.
  await loadProject((project) => { project.members[0].E = 0; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await openDoctor();
  const duration = await reduced.locator('.model-doctor-filters button').first().evaluate((element) => getComputedStyle(element).transitionDuration);
  const longestTransitionSeconds = Math.max(...duration.split(',').map((value) => Number.parseFloat(value)));
  if (longestTransitionSeconds > 0.001) throw new Error(`Reduced motion transition remained active: ${duration}`);

  if (pageErrors.length) throw new Error(`Runtime page errors: ${JSON.stringify(pageErrors)}`);

  console.log('Model Doctor browser QA passed: healthy, invalid property, topology preview/apply/undo/redo, stale preview, 6 responsive/zoom viewports, safe area, long-content scroll, touch targets, Day/Night AA contrast, keyboard preview/focus, reduced motion.');
} finally {
  await browser.close();
  await previewServer.close();
}
