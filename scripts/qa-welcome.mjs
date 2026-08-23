/**
 * Navegación compartida por la bienvenida para los QA de Playwright.
 *
 * Cada script de QA llevaba su propia copia de la entrada a la Mesa y todas
 * asumían una pantalla distinta. El síntoma era siempre el mismo —30 s
 * esperando un botón que existe pero está en otro sitio— y la causa una sola,
 * así que la navegación vive aquí una vez (CRI-116).
 *
 * La bienvenida dejó de ser un recorrido de cuatro pasos y pasó a ser un
 * lanzador de documento: las puertas están todas en la primera pantalla y la
 * vitrina de ejemplos es un diálogo. `openWelcomeStep` no tiene ya ningún paso
 * al que ir; lo que necesitan los scripts es abrir esa vitrina, y eso es lo que
 * hace `openTemplateGallery`.
 */

/**
 * Borra la biblioteca ANTES de que arranque el código de la aplicación.
 *
 * CRI-104 · con la biblioteca poblada el producto salta directo a la Mesa ~1,5s
 * después del primer pintado, desmontando la bienvenida bajo el clic del QA.
 * Limpiar `localStorage` no lo evita: la biblioteca vive en IndexedDB. Y borrarla
 * desde la página ya cargada tampoco es fiable — un `deleteDatabase` lanzado
 * cuando la app ya abrió la base queda `blocked` y no borra nada. Como
 * `addInitScript`, esto corre en cada documento antes que la app, así que nunca
 * compite con ella.
 */
export const clearProjectLibraryOnBoot = (target) => target.addInitScript(() => {
  try { indexedDB.deleteDatabase('structureCo.projects'); } catch { /* noop */ }
});

/**
 * Abre la vitrina de plantillas igual que lo haría una persona, y espera al
 * diálogo.
 *
 * El reintento no es decorativo: la biblioteca de proyectos (`.project-hub`) se
 * resuelve por IndexedDB DESPUÉS del primer pintado y remonta el árbol de la
 * bienvenida, así que el botón puede quedar desprendido justo entre que
 * Playwright lo resuelve y lo pulsa. El auto-wait de Playwright reintenta sobre
 * el mismo handle y se rinde a los 30 s; aquí se vuelve a resolver el
 * localizador en cada vuelta y se comprueba el EFECTO —que el diálogo está en
 * pantalla— en vez de dar por bueno el clic.
 */
export const openTemplateGallery = async (page, { attempts = 5 } = {}) => {
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  const gallery = page.locator('.welcome-templates-dialog');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await gallery.isVisible().catch(() => false)) return gallery;
    const button = page.getByRole('button', { name: /desde plantilla|from a template/i }).first();
    try {
      await button.click({ timeout: 5_000 });
      await gallery.waitFor({ state: 'visible', timeout: 5_000 });
      return gallery;
    } catch (error) {
      if (attempt === attempts) throw error;
      // Deja que el remonte pendiente termine antes de volver a resolver.
      await page.waitForTimeout(400);
    }
  }
  return gallery;
};

/**
 * Abre el pórtico de ejemplo desde donde vive hoy. Devuelve el localizador ya
 * pulsado para que cada script siga esperando lo que le importe de la Mesa.
 */
export const openExamplePortal = async (page, locator) => {
  await openTemplateGallery(page);
  const card = locator ?? page.getByRole('button', { name: /p.rtico de ejemplo/i }).first();
  await card.waitFor({ state: 'visible' });
  await card.click();
  return card;
};

/**
 * Llega a la Mesa con el proyecto que ya está en almacenamiento.
 *
 * CRI-104 · con un proyecto guardado el producto a veces entra SOLO y a veces
 * pinta la bienvenida con «Continuar proyecto». Las dos son la ruta real del
 * usuario, así que se acepta la que ocurra; lo que no se acepta es entrar por
 * otro sitio. Esperar la bienvenida a secas —lo que hacían estos QA— falla
 * justo en el caso normal, que es el salto directo.
 */
export const continueStoredProject = async (page, { timeout = 20_000 } = {}) => {
  const shell = page.locator('.app-shell');
  if (await shell.waitFor({ state: 'visible', timeout }).then(() => true, () => false)) return;
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /continuar proyecto/i }).click();
  await shell.waitFor({ state: 'visible' });
};

/**
 * Abre la superficie de Resultados igual que lo haría una persona.
 *
 * Analizar YA NO abre el panel por su cuenta: desde que las salidas son una
 * superficie invocada (`broker.isRetained('results')` en `WorkspaceShell`), el
 * análisis pinta el lienzo y deja el panel cerrado hasta que alguien lo pide.
 * Los QA que daban por hecho «pulsar Analizar ⇒ ver el diagrama» esperaban un
 * panel que nadie había abierto. Se pulsa el lanzador real; el evento de
 * comando queda de reserva para los viewports donde el lanzador se repliega.
 */
/**
 * Abre «Datos» en una pestaña. Resultados, Tabla y Revisión son pestañas de la
 * MISMA superficie: no hay cuatro cromos que abrir, hay uno y una pestaña que
 * apuntar.
 */
export const openDataSurface = async (page, { tab = 'results', timeout = 15_000 } = {}) => {
  const surface = page.locator('.data-surface');
  if (!await surface.isVisible().catch(() => false)) {
    const launcher = page.getByRole('button', { name: /^resultados$/i }).first();
    if (await launcher.count()) {
      await launcher.click().catch(() => undefined);
    }
    if (!await surface.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false)) {
      await page.evaluate((requested) => window.dispatchEvent(
        new CustomEvent('structureco:open-data', { detail: { tab: requested } }),
      ), tab);
      await surface.waitFor({ state: 'visible', timeout });
    }
  }
  const target = page.locator(`[data-data-tab="${tab}"][role="tab"]`);
  if (await target.count() && await target.getAttribute('aria-selected') !== 'true') {
    await target.click();
  }
  await page.locator(`.data-surface-panel[data-data-tab="${tab}"]`).waitFor({ state: 'visible', timeout });
  return surface;
};

/** Compatibilidad con los llamantes que sólo quieren Resultados. */
export const openResultsSurface = async (page, options = {}) => openDataSurface(page, { ...options, tab: 'results' });
