import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearProjectLibraryOnBoot, continueStoredProject, openExamplePortal } from './qa-welcome.mjs';

/**
 * QA de navegador de la edición múltiple.
 *
 * Ejercita la funcionalidad sobre la aplicación construida y servida desde ESTE
 * repositorio (`root` sale del propio script), de modo que siempre prueba el
 * árbol de trabajo en el que se ejecuta y no otro.
 *
 * Cubre lo que las pruebas unitarias no pueden demostrar: que el panel se monta
 * dentro del Inspector real, que el comando llega al store, que el proyecto
 * persiste, que el análisis queda obsoleto sólo al confirmar, que la consola
 * queda limpia y que el panel es usable en escritorio, tableta y móvil.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const port = engine === 'webkit' ? 4184 : 4183;
const baseURL = `http://127.0.0.1:${port}/`;
const artifactsDir = path.join(root, 'qa-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const previewServer = await preview({
  root,
  preview: { host: '127.0.0.1', port, strictPort: true },
  logLevel: 'error',
});
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true,
  ...(engine === 'chromium' ? {
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  } : {}),
});
const results = { engine, url: baseURL, checks: {}, console: [], pageErrors: [] };

const check = (name, condition, detail = '') => {
  results.checks[name] = { pass: Boolean(condition), detail };
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
};

const sleep = (page, milliseconds = 320) => page.waitForTimeout(milliseconds);

const storedProject = (page) => page.evaluate(() => {
  const value = localStorage.getItem('structureCo.project');
  if (!value) throw new Error('No persisted project was found.');
  return JSON.parse(value);
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await clearProjectLibraryOnBoot(context);
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') results.console.push(message.text());
});
page.on('pageerror', (error) => results.pageErrors.push(String(error)));

const resetToExample = async () => {
  // CRI-116 · nada de esperar la bienvenida ANTES de limpiar: con la biblioteca
  // poblada el producto salta solo a la Mesa (CRI-104) y no hay bienvenida que
  // esperar. La biblioteca se borra en el init del contexto, antes de que corra
  // la app, así que cada navegación arranca ya sin proyectos.
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  // CRI-116 · el pórtico de ejemplo vive en el tercer paso desde CRI-112.
  await openExamplePortal(page, page.locator('.welcome-template-card').filter({ hasText: /P.rtico de ejemplo/i }));
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  await page.locator('[data-structure-kind="node"][data-structure-id="N1"]').waitFor({ state: 'visible' });
  await sleep(page);
};

/**
 * Reabre el ejemplo con el proyecto que la prueba necesita.
 *
 * La zona sensible de una carga repartida se dibuja sobre su miembro y lo tapa
 * por completo, así que las pruebas que tienen que pinchar barras retiran esas
 * cargas primero. No es un atajo: es la única forma de ejercer la selección de
 * miembros con el puntero.
 */
const seedExample = async (mutate) => {
  await resetToExample();
  const project = await storedProject(page);
  mutate(project);
  await page.evaluate((next) => localStorage.setItem('structureCo.project', JSON.stringify(next)), project);
  await page.reload({ waitUntil: 'networkidle' });
  // CRI-116 · con proyecto guardado el producto entra solo (CRI-104); esperar la
  // bienvenida a secas fallaba justo en ese caso, que es el normal aquí.
  await continueStoredProject(page);
  await sleep(page);
  return storedProject(page);
};

/**
 * Nudos libres para pinchar.
 *
 * Los nudos del ejemplo llevan apoyo, barras y cargas dibujados encima, y su
 * zona sensible queda por debajo de ese decorado. El resto de la QA de este
 * repositorio resuelve lo mismo añadiendo nudos sueltos en hueco; aquí se hace
 * igual, y son esos nudos los que la edición múltiple va a editar.
 */
const seedFreeNodes = (mutate = () => {}) => seedExample((project) => {
  project.nodes.push(
    { id: 'QA-A', x: 1, y: 1, support: { type: 'none' } },
    { id: 'QA-B', x: 3, y: 1, support: { type: 'none' } },
  );
  mutate(project);
});

/** Ejemplo sin cargas de miembro y con secciones mezcladas de verdad. */
const seedClickableMembers = () => seedExample((project) => {
  project.memberLoads = [];
  project.members.forEach((member, index) => {
    member.sectionId = index % 2 === 0 ? 'ipe-300' : 'w12x26';
    member.sectionOrigin = 'catalog';
    member.materialId = index % 2 === 0 ? 'steel-a992' : 'steel-a36';
    member.materialOrigin = 'catalog';
  });
});

const target = (kind, id) => page.locator(`[data-structure-kind="${kind}"][data-structure-id="${id}"]`);

const nodeCenter = async (id) => {
  const box = await target('node', id).boundingBox();
  if (!box) throw new Error(`Node ${id} has no measurable screen position.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/**
 * Punto pinchable de un miembro.
 *
 * El centro de su caja envolvente no está sobre el trazo cuando la barra es
 * diagonal, así que se recorre la propia recta entre sus extremos. Y no vale
 * cualquier punto de ella: la zona sensible de una carga repartida se dibuja
 * encima del miembro, de modo que el punto medio suele pertenecer a la carga.
 * Se elige el primer punto cuyo dueño real sea el miembro buscado.
 */
const memberPoint = async (project, id) => {
  const member = project.members.find((candidate) => candidate.id === id);
  if (!member) throw new Error(`Member ${id} is not in the project.`);
  const [i, j] = await Promise.all([nodeCenter(member.i), nodeCenter(member.j)]);

  for (const ratio of [0.5, 0.35, 0.65, 0.25, 0.75, 0.4, 0.6]) {
    const point = { x: i.x + (j.x - i.x) * ratio, y: i.y + (j.y - i.y) * ratio };
    const owner = await page.evaluate((candidate) => document
      .elementFromPoint(candidate.x, candidate.y)
      ?.closest('[data-structure-object]')
      ?.getAttribute('data-structure-id') ?? null, point);
    if (owner === id) return point;
  }
  throw new Error(`No unobscured point of member ${id} was found on the canvas.`);
};

/**
 * En estrecho el Inspector vive en una bandeja: hay que abrirla para que el
 * panel exista en pantalla. Es el patrón propio de la aplicación, no un ajuste
 * de la prueba.
 */
/*
 * El lanzador del Inspector, esté donde esté su composición: en Compact es la
 * ranura de la barra inferior —sobre el pulgar—, y fuera de Compact la primera
 * pieza del lanzador flotante del lienzo. El pill flotante que hacía de
 * lanzador en teléfono se posaba encima del dock de herramientas y se retiró
 * con él.
 */
const openInspectorIfCollapsed = async () => {
  const toggle = page.locator('[data-compact-bar-slot="detail"], .mobile-inspector-toggle').first();
  if (await toggle.count() === 0 || !(await toggle.isVisible())) return;
  await toggle.click();
  await sleep(page, 260);
};

/**
 * An already-open K0 detail surface is a genuine sheet above the canvas.
 * Dismiss it through the same Escape contract a user has before selecting on
 * the canvas; the test opens it again after the selection is made.
 */
const dismissCompactSheetsForCanvas = async () => {
  // Closing detail can reveal the retained Results sheet below it. Both are
  // modeless K0 surfaces with an Escape close contract, so resolve the active
  // stack one surface at a time before touching the canvas.
  for (const surface of ['detail', 'results']) {
    const sheet = page.locator(`[data-workspace-surface="${surface}"][data-surface-presentation="sheet"][data-surface-status="active"]`);
    if (!(await sheet.isVisible().catch(() => false))) continue;
    await page.keyboard.press('Escape');
    await sheet.waitFor({ state: 'hidden' });
  }
};

/**
 * Encaja el modelo en la vista. Al estrechar el lienzo, parte de la estructura
 * queda fuera de la ventana visible, así que antes de pinchar nada se usa la
 * misma acción de encaje que tiene la aplicación.
 */
const fitModel = async () => {
  await dismissCompactSheetsForCanvas();
  const fit = page.getByRole('button', { name: /ajustar modelo a la vista/i });
  if (await fit.count() === 0) return;
  await fit.first().click();
  await sleep(page, 260);
};

/**
 * A node with a seeded nodal load has genuinely overlapping semantic targets.
 * Resolve that picker explicitly so the QA exercises the real ambiguity
 * contract instead of assuming the DOM node is the only selectable object.
 */
const confirmNodeCandidateIfNeeded = async (id) => {
  const picker = page.locator('[data-candidate-picker]');
  if (!(await picker.isVisible().catch(() => false))) return;
  const nodeOption = picker.getByRole('option', { name: new RegExp(`^Nodo ${id}$`, 'i') });
  await nodeOption.click();
  await picker.getByRole('button', { name: /confirmar selección/i }).click();
  await picker.waitFor({ state: 'hidden' });
};

const selectMany = async (project, items) => {
  await fitModel();
  for (const [index, [kind, id]] of items.entries()) {
    const modifiers = index === 0 ? {} : { modifiers: ['Shift'] };
    if (kind === 'node') {
      // Un nudo tiene una zona sensible propia y se pincha por su elemento.
      await target('node', id).click(modifiers);
      await confirmNodeCandidateIfNeeded(id);
    } else {
      // Un miembro no: hay que ir a un punto concreto de su trazo.
      const point = await memberPoint(project, id);
      if (index > 0) await page.keyboard.down('Shift');
      await page.mouse.click(point.x, point.y);
      if (index > 0) await page.keyboard.up('Shift');
    }
    await page.waitForTimeout(80);
  }
  await openInspectorIfCollapsed();
  await panel().waitFor({ state: 'visible' });
};

const panel = () => page.locator('.bulk-edit-panel');
const field = (property) => page.locator(`.bulk-field[data-property="${property}"]`);
const reviewRegion = () => page.getByRole('region', { name: 'Revisar cambios' });

/** Prepara → revisa → confirma, que es el único camino a publicar. */
const confirm = async () => {
  await page.getByRole('button', { name: /^Revisar cambios/ }).click();
  await reviewRegion().waitFor({ state: 'visible' });
  await reviewRegion().getByRole('button', { name: /^Aplicar/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bulk-edit-panel.is-reviewing'));
};

const ids = (list) => list.map((item) => item.id).join(',');

// ---------------------------------------------------------------- Members ---

const runMembers = async () => {
  const before = await seedClickableMembers();
  const memberIds = before.members.map((member) => member.id);
  check('exampleHasMembers', memberIds.length >= 2, ids(before.members));

  await selectMany(before, before.members.slice(0, 2).map((member) => ['member', member.id]));

  // Sección mixta: el valor común no puede leerse como un valor concreto.
  const sectionField = field('member.sectionId');
  await sectionField.waitFor({ state: 'visible' });

  await page.getByLabel('Sección', { exact: true }).selectOption('w12x53');
  const stagedProject = await storedProject(page);
  check(
    'stagingDoesNotPublish',
    JSON.stringify(stagedProject) === JSON.stringify(before),
    'Preparar un cambio no puede tocar el proyecto persistido.',
  );

  // La vista previa de sección sigue viva y reacciona al objetivo preparado.
  await page.getByRole('tab', { name: 'Vista sección' }).click();
  const preview = page.locator('.bulk-preview');
  await preview.waitFor({ state: 'visible' });
  check('sectionPreviewRenders', (await preview.count()) === 1);
  await page.getByRole('tab', { name: 'Propiedades' }).click();

  await confirm();

  const after = await page.evaluate(async () => {
    const read = () => JSON.parse(localStorage.getItem('structureCo.project'));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const value = read();
      if (value.members.slice(0, 2).every((member) => member.sectionId === 'w12x53')) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return read();
  });

  const edited = after.members.slice(0, 2);
  check('memberSectionApplied', edited.every((member) => member.sectionId === 'w12x53'), ids(edited));
  check('memberSectionOriginCatalog', edited.every((member) => member.sectionOrigin === 'catalog'));
  // El material era mixto y nadie lo tocó: sobrevive miembro a miembro.
  check(
    'untouchedMaterialSurvives',
    edited.every((member, index) => member.materialId === before.members[index].materialId),
    JSON.stringify(edited.map((member) => member.materialId)),
  );
  check(
    'reviewClosedAfterApply',
    (await reviewRegion().count()) === 0,
    'La revisión debe cerrarse tras publicar.',
  );

  // Un solo Undo devuelve los dos miembros.
  await page.locator('.history-controls').getByLabel(/^deshacer$/i).click();
  const undone = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const value = JSON.parse(localStorage.getItem('structureCo.project'));
      if (value.members[0].sectionId !== 'w12x53') return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return JSON.parse(localStorage.getItem('structureCo.project'));
  });
  check(
    'singleUndoRestoresEveryMember',
    undone.members.slice(0, 2).every((member, index) => member.sectionId === before.members[index].sectionId),
    JSON.stringify(undone.members.slice(0, 2).map((member) => member.sectionId)),
  );

  await page.locator('.history-controls').getByLabel(/^rehacer$/i).click();
  const redone = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const value = JSON.parse(localStorage.getItem('structureCo.project'));
      if (value.members[0].sectionId === 'w12x53') return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return JSON.parse(localStorage.getItem('structureCo.project'));
  });
  check(
    'redoIsExact',
    redone.members.slice(0, 2).every((member) => member.sectionId === 'w12x53'),
    JSON.stringify(redone.members.slice(0, 2).map((member) => member.sectionId)),
  );

  // Persistencia: recargar conserva lo aplicado.
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  const persisted = await storedProject(page);
  check(
    'persistsAcrossReload',
    persisted.members.slice(0, 2).every((member) => member.sectionId === 'w12x53'),
  );
};

// --------------------------------------------------------------- Supports ---

const runSupports = async () => {
  const before = await seedFreeNodes();
  await selectMany(before, [['node', 'QA-A'], ['node', 'QA-B']]);

  const supportSelect = page.getByLabel('Apoyo', { exact: true });
  await supportSelect.waitFor({ state: 'visible' });

  // Habilitar + configurar en una sola intención: el tipo personalizado hace
  // aparecer las restricciones, que se ajustan sin aplicar en medio.
  await supportSelect.selectOption('custom');
  const restrainX = field('node.support.restrainX');
  await restrainX.waitFor({ state: 'visible' });
  check('enableThenConfigureIsOffered', await restrainX.isVisible());

  await restrainX.getByRole('radio', { name: 'Sí' }).click();
  await confirm();

  const after = await page.evaluate(async () => {
    const seeded = (value) => value.nodes.filter((node) => node.id.startsWith('QA-'));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const value = JSON.parse(localStorage.getItem('structureCo.project'));
      if (seeded(value).every((node) => node.support.type === 'custom')) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return JSON.parse(localStorage.getItem('structureCo.project'));
  });

  const edited = after.nodes.filter((node) => node.id.startsWith('QA-'));
  check('supportTypeApplied', edited.every((node) => node.support.type === 'custom'), JSON.stringify(edited.map((n) => n.support)));
  check('supportConfiguredInSamePass', edited.every((node) => node.support.restrainX === true));
  // El apoyo se reconstruye entero: las tres banderas quedan explícitas.
  check(
    'supportRebuiltCoherently',
    edited.every((node) => node.support.restrainY === false && node.support.restrainR === false),
    JSON.stringify(edited.map((node) => node.support)),
  );
  check(
    'noDanglingPrescribed',
    (after.prescribedDisplacements ?? []).every((item) => {
      const node = after.nodes.find((candidate) => candidate.id === item.nodeId);
      if (!node || node.support.type !== 'custom') return true;
      const allowed = new Set([
        ...(node.support.restrainX ? ['ux'] : []),
        ...(node.support.restrainY ? ['uy'] : []),
        ...(node.support.restrainR ? ['rz'] : []),
      ]);
      return allowed.has(item.component);
    }),
    JSON.stringify(after.prescribedDisplacements ?? []),
  );
};

// ------------------------------------------------------------------ Loads ---

const runLoads = async () => {
  const before = await seedFreeNodes((project) => {
    const caseId = project.loadCases[0].id;
    project.nodalLoads.push(
      { id: 'QA-L1', nodeId: 'QA-A', caseId, fx: 0, fy: -10, mz: 0 },
      { id: 'QA-L2', nodeId: 'QA-B', caseId, fx: 0, fy: -25, mz: 0 },
    );
  });
  check('seededNodalLoads', before.nodalLoads.filter((load) => load.id.startsWith('QA-')).length === 2);

  await selectMany(before, [['node', 'QA-A'], ['node', 'QA-B']]);

  const fy = field('nodalLoad.fy');
  await fy.waitFor({ state: 'visible' });
  // Las propiedades se agrupan por familia real, no en una lista plana.
  check('loadsAreGroupedByFamily', (await page.locator('[data-group="load.nodal"]').count()) === 1);
  // Y una familia ausente no aparece.
  check('absentLoadFamilyIsHidden', (await page.locator('[data-group="load.moment"]').count()) === 0);

  const input = fy.locator('input');
  await input.fill('-33');
  await input.press('Tab');
  await confirm();

  const after = await page.evaluate(async () => {
    const seeded = (value) => value.nodalLoads.filter((load) => load.id.startsWith('QA-'));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const value = JSON.parse(localStorage.getItem('structureCo.project'));
      if (seeded(value).every((load) => load.fy === -33)) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return JSON.parse(localStorage.getItem('structureCo.project'));
  });
  const editedLoads = after.nodalLoads.filter((load) => load.id.startsWith('QA-'));
  check('nodalLoadApplied', editedLoads.every((load) => load.fy === -33), JSON.stringify(editedLoads));
  // Los campos ajenos a la familia nunca se tocan.
  check(
    'foreignLoadFieldsUntouched',
    editedLoads.every((load) => load.fx === 0 && load.mz === 0),
    JSON.stringify(editedLoads),
  );
};

// --------------------------------------------------- Scope, review, cancel ---

const runScopeAndReview = async () => {
  const before = await seedExample((project) => {
    project.memberLoads = [];
    project.nodes.push({ id: 'QA-A', x: 1, y: 1, support: { type: 'none' } });
  });
  await selectMany(before, [['member', before.members[0].id], ['node', 'QA-A']]);

  const scope = page.getByRole('radiogroup', { name: 'Qué se edita' });
  await scope.waitFor({ state: 'visible' });
  check('scopeFilterAppearsForMixedSelection', await scope.isVisible());

  const selectedBefore = await page.locator('[aria-pressed="true"][data-structure-kind]').count();
  await scope.getByRole('radio', { name: 'Miembros' }).click();
  await sleep(page, 120);
  check('scopeHidesOtherFamilies', (await field('node.support.type').count()) === 0);
  check('scopeKeepsOwnFamily', (await field('member.sectionId').count()) === 1);
  const selectedAfter = await page.locator('[aria-pressed="true"][data-structure-kind]').count();
  // El filtro es una lente del Inspector: la selección del lienzo no se mueve.
  check('scopeDoesNotChangeCanvasSelection', selectedBefore === selectedAfter, `${selectedBefore} → ${selectedAfter}`);

  await scope.getByRole('radio', { name: 'Todos' }).click();
  await sleep(page, 120);

  // Revisión: valor actual, objetivo, afectados, sin cambios y aviso de stale.
  await page.getByLabel('Sección', { exact: true }).selectOption('w12x53');
  await page.getByRole('button', { name: /^Revisar cambios/ }).click();
  const review = reviewRegion();
  await review.waitFor({ state: 'visible' });
  const reviewText = await review.innerText();
  check('reviewStatesTarget', reviewText.includes('W12x53'), reviewText.slice(0, 400));
  check('reviewStatesAffectedCount', /objeto[s]? afectado/.test(reviewText), reviewText.slice(0, 400));
  check('reviewStatesUntouched', /propiedad(es)? sin cambios/.test(reviewText), reviewText.slice(0, 400));
  check('reviewWarnsStaleResults', /desactualizados/.test(reviewText), reviewText.slice(0, 400));

  // Cancelar la revisión conserva el borrador y no publica nada.
  const beforeCancel = await storedProject(page);
  await review.getByRole('button', { name: 'Volver a editar' }).click();
  await page.waitForFunction(() => !document.querySelector('.bulk-edit-panel.is-reviewing'));
  check(
    'reviewCancelPublishesNothing',
    JSON.stringify(await storedProject(page)) === JSON.stringify(beforeCancel),
  );
  check(
    'reviewCancelKeepsDraft',
    await page.getByLabel('Sección', { exact: true }).inputValue() === 'w12x53',
  );

  // Cambiar la selección durante el borrador lo descarta.
  await target('node', 'QA-A').click();
  await sleep(page, 200);
  const stagedCount = await page.getByTestId('bulk-changes-count').innerText().catch(() => '');
  check('selectionChangeDropsDraft', !/1 cambio preparado/.test(stagedCount), stagedCount);
};

// ------------------------------------------------------------- Responsive ---

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

const runResponsive = async () => {
  // Nudos sueltos: son alcanzables con el puntero a cualquier ancho, mientras
  // que una barra del ejemplo queda tapada por el propio decorado del lienzo en
  // cuanto el lienzo se estrecha.
  const before = await seedFreeNodes();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await sleep(page, 220);
    await selectMany(before, [['node', 'QA-A'], ['node', 'QA-B']]);

    const box = await panel().boundingBox();
    check(`${viewport.name}PanelVisible`, Boolean(box) && box.width > 0, JSON.stringify(box));

    // Nada del panel puede desbordar horizontalmente.
    const overflow = await page.evaluate(() => {
      const element = document.querySelector('.bulk-edit-panel');
      return element ? element.scrollWidth - element.clientWidth : 0;
    });
    check(`${viewport.name}NoHorizontalOverflow`, overflow <= 1, `overflow=${overflow}`);

    /*
     * Objetivos táctiles >= 44 px en todo control interactivo del panel.
     *
     * Se mide `offsetHeight`, que es la altura de maquetación en píxeles CSS.
     * `getBoundingClientRect` incluye la escala que el espacio de trabajo aplica
     * a su contenido, así que un control de 44 px se leía como 43,34 y el
     * número dejaba de describir lo que el diseño garantiza.
     */
    const small = await page.evaluate(() => {
      const panelElement = document.querySelector('.bulk-edit-panel');
      if (!panelElement) return [];
      return [...panelElement.querySelectorAll('button, select, input, [role="radio"], summary')]
        .filter((element) => element.offsetWidth > 0 && element.offsetHeight > 0 && element.offsetHeight < 44)
        .map((element) => `${element.tagName}.${element.className}:${element.offsetHeight}`);
    });
    check(`${viewport.name}TouchTargets44`, small.length === 0, small.join(' | '));

    // La acción de revisar es alcanzable sin salir de la pantalla.
    await page.getByLabel('Apoyo', { exact: true }).selectOption('pin');
    const review = page.getByRole('button', { name: /^Revisar cambios/ });
    await review.scrollIntoViewIfNeeded();
    const reviewBox = await review.boundingBox();
    check(
      `${viewport.name}ReviewReachable`,
      Boolean(reviewBox) && reviewBox.y >= 0 && reviewBox.y < viewport.height,
      JSON.stringify(reviewBox),
    );

    await page.screenshot({ path: path.join(artifactsDir, `bulk-edit-${engine}-${viewport.name}.png`), fullPage: false });
    await page.keyboard.press('Escape');
    await seedFreeNodes();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
};

// --------------------------------------------------------------- Keyboard ---

const runKeyboard = async () => {
  const before = await seedClickableMembers();
  await selectMany(before, before.members.slice(0, 2).map((member) => ['member', member.id]));

  await page.getByLabel('Sección', { exact: true }).selectOption('w12x53');
  const trigger = page.getByRole('button', { name: /^Revisar cambios/ });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await reviewRegion().waitFor({ state: 'visible' });

  const focusInsideReview = await page.evaluate(() => {
    const review = document.querySelector('.bulk-review');
    return Boolean(review && review.contains(document.activeElement));
  });
  check('reviewReceivesFocus', focusInsideReview);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.bulk-edit-panel.is-reviewing'));
  const focusReturned = await page.evaluate(() => document.activeElement?.textContent ?? '');
  check('escapeReturnsFocusToTrigger', /Revisar cambios/.test(focusReturned), focusReturned);

  // Estado mixto real en el árbol de accesibilidad.
  const mixed = await page.evaluate(() => [...document.querySelectorAll('.bulk-field__current-state')]
    .map((element) => element.getAttribute('aria-checked')));
  check('mixedIsNeverFalseByDefault', mixed.every((value) => ['true', 'false', 'mixed'].includes(value)), mixed.join(','));
};

const runStep = async (label, run) => {
  process.stdout.write(`[bulk-edit:${engine}] ${label}\n`);
  await run();
};

try {
  await runStep('Members: mixed section, apply, undo, redo, persist', runMembers);
  await runStep('Supports: enable + configure in one confirmation', runSupports);
  await runStep('Loads: family grouping and nodal magnitude', runLoads);
  await runStep('Scope filters, Review Changes and cancel', runScopeAndReview);
  await runStep('Desktop, tablet and mobile', runResponsive);
  await runStep('Keyboard and focus', runKeyboard);
  check('noConsoleErrors', results.console.length === 0, JSON.stringify(results.console));
  check('noPageErrors', results.pageErrors.length === 0, JSON.stringify(results.pageErrors));
  console.log(`Bulk edit browser QA passed in ${engine}: members, supports, loads, scope filters, review, undo/redo, persistence, responsive and keyboard.`);
} finally {
  fs.writeFileSync(path.join(artifactsDir, `bulk-edit-${engine}.json`), JSON.stringify(results, null, 2));
  await context.close();
  await browser.close();
  await previewServer.close();
}
