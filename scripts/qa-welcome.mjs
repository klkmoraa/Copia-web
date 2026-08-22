/**
 * Navegación compartida por la bienvenida para los QA de Playwright.
 *
 * CRI-104 convirtió la bienvenida en un recorrido de cuatro pasos y CRI-112
 * terminó de mover los lanzadores de ejemplo del primer paso al tercero
 * ("Por dónde"). Cada script de QA llevaba su propia copia de la entrada a la
 * Mesa y todas asumían la pantalla anterior: el pórtico de ejemplo visible al
 * cargar. El síntoma era siempre el mismo —30s esperando un botón que existe
 * pero está en otro paso— y la causa una sola, así que la navegación vive aquí
 * una vez (CRI-116).
 */

const STEP_ID = { 'Por dónde': 'where', 'Cómo trabajas': 'how' };

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
 * Pulsa un paso del carril igual que lo haría una persona, y espera al panel.
 *
 * El reintento no es decorativo: la biblioteca de proyectos (`.project-hub`) se
 * resuelve por IndexedDB DESPUÉS del primer pintado y remonta el árbol de la
 * bienvenida, así que el botón del carril puede quedar desprendido justo entre
 * que Playwright lo resuelve y lo pulsa. El auto-wait de Playwright reintenta
 * sobre el mismo handle y se rinde a los 30s; aquí se vuelve a resolver el
 * localizador en cada vuelta y se comprueba el EFECTO —que el panel cambió de
 * paso— en vez de dar por bueno el clic.
 */
export const openWelcomeStep = async (page, name, { attempts = 5 } = {}) => {
  const step = STEP_ID[name];
  if (!step) throw new Error(`Paso de bienvenida desconocido: ${name}`);
  await page.getByTestId('welcome-screen').waitFor({ state: 'visible' });
  const panel = page.locator(`.welcome-screen[data-welcome-step="${step}"]`);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await panel.isVisible().catch(() => false)) return;
    const button = page.locator('.welcome-steps').getByRole('button', { name, exact: true });
    try {
      await button.click({ timeout: 5_000 });
      await panel.waitFor({ state: 'visible', timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      // Deja que el remonte pendiente termine antes de volver a resolver.
      await page.waitForTimeout(400);
    }
  }
};

/**
 * Abre el pórtico de ejemplo desde donde vive hoy. Devuelve el localizador ya
 * pulsado para que cada script siga esperando lo que le importe de la Mesa.
 */
export const openExamplePortal = async (page, locator) => {
  await openWelcomeStep(page, 'Por dónde');
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
export const openResultsSurface = async (page, { timeout = 15_000 } = {}) => {
  const panel = page.locator('.results-panel');
  if (await panel.isVisible().catch(() => false)) return panel;

  const launcher = page.getByRole('button', { name: /^resultados$/i }).first();
  if (await launcher.count()) {
    await launcher.click().catch(() => undefined);
    if (await panel.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false)) return panel;
  }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('structureco:open-results')));
  await panel.waitFor({ state: 'visible', timeout });
  return panel;
};
