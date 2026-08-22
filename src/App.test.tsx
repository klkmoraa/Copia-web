// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { createDefaultProject } from './data/defaultProject';
import { PROJECT_STORAGE_KEY } from './data/projectStorage';
import { InMemoryProjectRepository } from './storage/projectRepository';
import { readWelcomeEntry, shouldResumeDirectly } from './features/welcome/welcomeEntry';

// El visor real necesita WebGL, que jsdom no ofrece. Se sustituye el viewport
// por un doble inerte para poder ejercitar la navegación y la superficie.
vi.mock('./space3d/view/threeViewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./space3d/view/threeViewport')>()),
  createSpace3DViewport: () => ({
    scene: {} as never,
    camera: {} as never,
    controlsTarget: {} as never,
    setModel: vi.fn(),
    setLayers: vi.fn(),
    setView: vi.fn(),
    zoomBy: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(),
    requestRender: vi.fn(),
    pickAt: () => null,
    dispose: vi.fn(),
  }),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!globalThis.crypto.randomUUID) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: () => '00000000-0000-4000-8000-000000000000' });
  }
});

/**
 * CRI-89 · La clase de composición del shell (`X2` | `M1` | `K0`) sale ÚNICA Y
 * EXCLUSIVAMENTE de `window.innerWidth`/`innerHeight`. Ningún componente
 * consulta ya `matchMedia` para decidir layout, así que fijar el viewport es la
 * única forma —y la misma que usa producción— de elegir composición desde una
 * prueba. Es el mismo helper que `ResultsPanel.test.tsx`.
 *
 * El defecto de jsdom (1024×768) cae por debajo de la frontera X2 calculada por
 * el presupuesto de lienzo (1117 px a 768 de alto), así que sin fijarlo la app
 * se monta en `M1` y las superficies auxiliares no se acoplan: ése era el
 * origen silencioso de buena parte de los fallos de este archivo.
 */
const setViewport = (viewport: 'desktop' | 'phone' = 'desktop') => {
  const [width, height] = viewport === 'phone' ? [390, 844] : [1440, 900];
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
};

/**
 * Aislamiento entre pruebas. La persistencia real del producto son DOS medios y
 * los dos se limpian aquí, sin inventar un tercero:
 *
 * - `localStorage` — el proyecto activo (`PROJECT_STORAGE_KEY`), el modelo de
 *   Space 3D y las preferencias del panel de resultados.
 * - **IndexedDB** — la biblioteca de proyectos y las copias `RecoveryRecord`
 *   que `ProjectHub` y `welcomeEntry` leen. jsdom NO implementa IndexedDB, así
 *   que hoy no hay base que borrar; el borrado se hace igualmente y de verdad
 *   si algún día la hubiera, para que este archivo no pueda empezar a depender
 *   en silencio de una base heredada de la prueba anterior.
 */
const clearPersistence = async () => {
  localStorage.clear();
  sessionStorage.clear();
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('structureCo.projects');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

beforeEach(async () => {
  setViewport('desktop');
  await clearPersistence();
  document.documentElement.dataset.theme = 'light';
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  // Sigue haciendo falta para lo que jsdom no implementa y que NO es layout:
  // `prefers-color-scheme`, `prefers-reduced-motion` y `(hover: hover)`.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await clearPersistence();
});

/**
 * La Bienvenida es un LANZADOR: una sola pantalla con las seis puertas en una
 * lista y la biblioteca al lado. El recorrido de cuatro pasos que había aquí
 * (Bienvenida → Cómo trabajas → Por dónde → Mesa) se retiró, y con él el
 * helper que navegaba por su carril: ya no hay adónde navegar, las puertas
 * están todas en la primera pantalla.
 *
 * La vitrina de plantillas sí cambió de forma —de etapa a diálogo—, y eso es
 * lo único que sigue necesitando un paso previo.
 */
const openTemplates = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /desde plantilla|from a template/i }));
  return screen.findByRole('dialog', { name: /plantillas|templates/i });
};

const openWorkspace = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /continuar proyecto/i }));
  await screen.findByRole('button', { name: /^analizar$/i }, { timeout: 5000 });
};

const renderExampleApp = async (user: ReturnType<typeof userEvent.setup>) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  const result = render(<App />);
  await openWorkspace(user);
  return result;
};

/**
 * El menú de utilidades es el de la TopBar. Se acota al chrome global porque
 * las acciones contextuales del lienzo publican su propio desbordamiento con el
 * mismo rótulo (CRI-95/CRI-108): son dos dueños distintos y la prueba dice de
 * cuál habla, en vez de exigir que uno se renombre.
 */
const openUtilityMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const topbar = within(document.querySelector('.topbar') as HTMLElement);
  await user.click(topbar.getByRole('button', { name: /más acciones/i }));
  return screen.findByRole('dialog', { name: /más acciones/i });
};

/**
 * CRI-94 / CRI-101 · Resultados es una superficie INVOCADA, no residente:
 * analizar ya no la monta sola, el broker sólo la retiene mientras está pedida.
 * Pedirla es parte del contrato, no un rodeo de la prueba.
 */
const openResults = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Resultados' }));
  await waitFor(() => expect(document.querySelector('.results-panel')).toBeTruthy());
};

/**
 * CRI-101 · Reacciones, Influencia y «Aprender» dejaron de ser pestañas del
 * panel: son la superficie `dense`, que se pide desde sus lanzadores.
 */
const openDenseResults = async (user: ReturnType<typeof userEvent.setup>, view: 'reactions' | 'influence' | 'learn') => {
  await user.click(document.querySelector(`[data-dense-launcher="${view}"]`) as HTMLElement);
  await waitFor(() => expect(document.querySelector('.dense-results-surface')).toBeTruthy(), { timeout: 5000 });
};

/**
 * CRI-103 · Los atajos de una sola letra sólo disparan con el foco DENTRO del
 * lienzo: en cualquier otro sitio secuestrarían la navegación rápida de un
 * lector de pantalla. Enfocar es ahora parte del contrato que se prueba.
 */
const focusCanvas = (canvas: HTMLElement) => {
  canvas.focus();
  expect(canvas.contains(document.activeElement)).toBe(true);
};

describe('structureCo app shell', () => {
  it('reaches Space 3D from the workspace top bar and keeps no other 3D surface', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /continuar proyecto/i }));
    await screen.findByRole('button', { name: /^analizar$/i }, { timeout: 10_000 });
    expect(screen.queryByRole('button', { name: /experimental 3d/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /abrir space 3d/i }));
    expect(await screen.findByRole('button', { name: 'Editor 2D' }, { timeout: 10_000 })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Editor 2D' }));
    expect(await screen.findByRole('button', { name: /^analizar$/i }, { timeout: 10_000 })).toBeTruthy();
  }, 40_000);

  it('opens Space 3D lazily from start and returns to both destinations', async () => {
    const user = userEvent.setup();
    render(<App />);

    // El grafo de Space 3D no debe estar evaluado antes del clic.
    expect(document.querySelector('.space3d-screen')).toBeNull();

    // Su puerta vive en la lista del lanzador, marcada como experimental.
    await user.click(screen.getByRole('button', { name: /space 3d/i }));
    expect(await screen.findByRole('button', { name: /^analizar$/i }, { timeout: 10_000 })).toBeTruthy();
    expect(document.querySelector('.space3d-screen')).not.toBeNull();

    await user.click(screen.getAllByRole('button', { name: 'Editor 2D' })[0]);
    expect(await screen.findByRole('button', { name: /^analizar$/i }, { timeout: 10_000 })).toBeTruthy();
    expect(document.querySelector('.space3d-screen')).toBeNull();

    await user.click(screen.getByRole('button', { name: /ir al inicio/i }));
    // Volver a Inicio lleva de verdad a Inicio: el salto directo a la Mesa se
    // ofrece UNA vez por sesión, así que el lanzador vuelve entero.
    await screen.findByTestId('welcome-screen');
    await user.click(await screen.findByRole('button', { name: /space 3d/i }));
    await user.click(await screen.findByRole('button', { name: 'Inicio' }));
    expect(await screen.findByTestId('welcome-screen')).toBeTruthy();
  }, 40_000);

  it('keeps the 2D project untouched while Space 3D stores its own model', async () => {
    const user = userEvent.setup();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
    render(<App />);
    const before = localStorage.getItem(PROJECT_STORAGE_KEY);

    await user.click(screen.getByRole('button', { name: /space 3d/i }));
    await screen.findByRole('button', { name: /^analizar$/i }, { timeout: 10_000 });
    await waitFor(() => expect(localStorage.getItem('structureco:space3d:v1')).toBeTruthy(), { timeout: 10_000 });

    expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(before);
  }, 40_000);

  /**
   * La Bienvenida abre como un lanzador de documento: marca a una línea, lo que
   * se puede crear en una columna y lo que ya existe en la otra. Ni titular
   * editorial (se retiró en CRI-104 y no debe volver) ni carril de etapas (se
   * retiró después, y tampoco).
   */
  it('opens as a document launcher: brand, actions and library, no wizard', async () => {
    render(<App />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();

    // Marca: wordmark y UNA línea. Nada de titular editorial a dos líneas.
    expect(screen.getByRole('heading', { name: /structureCo/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /analiza estructuras con claridad/i })).toBeNull();

    // Sin recorrido: ni carril de pasos, ni etapa publicada en el DOM.
    expect(document.querySelector('.welcome-steps')).toBeNull();
    expect(document.querySelector('.welcome-screen')?.hasAttribute('data-welcome-step')).toBe(false);

    // Las dos columnas: crear a la izquierda, continuar y biblioteca a la derecha.
    expect(document.querySelector('.welcome-action-list')).not.toBeNull();
    expect(document.querySelector('.welcome-resume-card')).not.toBeNull();
    expect(screen.getByRole('button', { name: /nuevo proyecto/i })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: /tus proyectos en este dispositivo/i })).toBeTruthy();
  }, 10_000);

  it('opens a blank project from the work step and reaches the workspace', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole('button', { name: /nuevo proyecto/i }));

    expect(await screen.findByDisplayValue('Proyecto sin título', {}, { timeout: 5000 })).toBeTruthy();
    expect(container.querySelectorAll('.node-object')).toHaveLength(0);
    expect(container.querySelectorAll('.member-object')).toHaveLength(0);
  }, 10_000);

  /**
   * Ninguna puerta se perdió al retirar el recorrido: las que vivían repartidas
   * entre las etapas 2 y 3 están ahora todas en la lista del lanzador, y la
   * vitrina de ejemplos a una pulsación de ella.
   */
  it('keeps every existing gate reachable from the launcher', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('button', { name: /nuevo proyecto/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /nuevo ejercicio/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /importar archivo/i })).toBeTruthy();
    // Space 3D sigue presente y sigue marcado como experimental, no como una
    // superficie más del producto.
    expect(screen.getByRole('button', { name: /space 3d/i }).textContent).toMatch(/experimental/i);
    // El DXF llega en su propio chunk perezoso.
    await waitFor(() => expect(screen.getByRole('button', { name: /DXF/ })).toBeTruthy());

    await openTemplates(user);
    expect(document.querySelectorAll('.welcome-template-card').length).toBeGreaterThan(0);
  }, 15_000);

  it('localizes built-in example cards and preserves English when an example opens', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    render(<App />);

    // Los ejemplos viven en la vitrina, que es un diálogo. El rótulo que la
    // abre también está traducido: la puerta no desapareció, cambió de forma.
    await openTemplates(user);
    const exampleFrame = screen.getByRole('button', { name: /Example frame.*6 × 4 m frame/ });
    expect(exampleFrame).toBeTruthy();
    expect(screen.getByRole('button', { name: /Simply supported beam.*8 m beam/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Triangular truss.*statically determinate truss/i })).toBeTruthy();
    const cards = [...document.querySelectorAll('.welcome-template-card')].map((card) => card.textContent).join(' ');
    expect(cards).not.toMatch(/Pórtico de ejemplo|Viga simplemente apoyada|Armadura triangular/);

    await user.click(exampleFrame);
    expect(await screen.findByRole('button', { name: /^analyze$/i }, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^analizar$/i })).toBeNull();
  }, 10_000);

  it('preserves English when creating a guided exercise', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    render(<App />);

    // El ejercicio guiado es una fila del lanzador y abre su diálogo directamente.
    await user.click(screen.getByRole('button', { name: /new exercise/i }));
    await user.click(screen.getByRole('radio', { name: /simply supported beam/i }));
    await user.click(screen.getByRole('button', { name: /create exercise/i }));

    expect(await screen.findByRole('button', { name: /^analyze$/i }, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^analizar$/i })).toBeNull();
  }, 10_000);

  it('renders the editor and runs analysis for an existing model', async () => {
    const user = userEvent.setup();
    await renderExampleApp(user);

    expect(screen.getByText('structureCo')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^analizar$/i })).toBeTruthy();
    expect(screen.getByDisplayValue('Pórtico de ejemplo')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^analizar$/i }));

    // CRI-94 · analizar NO monta Resultados: la superficie se pide. Que no esté
    // antes de pedirla es parte del contrato, no un descuido.
    expect(document.querySelector('.results-panel')).toBeNull();
    await openResults(user);

    await waitFor(() => {
      expect(screen.getAllByText(/Diagrama de momento flector/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    expect(screen.queryByText(/No se generaron resultados/i)).toBeNull();
  }, 15_000);

  it('opens Model Doctor before analysis, isolates the workspace, and returns focus on Escape', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const doctorButton = screen.getByRole('button', { name: 'Model Doctor' });

    await user.click(doctorButton);

    expect(await screen.findByRole('dialog', { name: 'Model Doctor' }, { timeout: 5000 })).toBeTruthy();
    const shell = container.querySelector<HTMLElement>('.app-shell')!;
    expect(shell.inert).toBe(true);
    expect(shell.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByTestId('diagram-chart')).toBeNull();

    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog', { name: /paleta de comandos/i })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Model Doctor' })).toBeTruthy();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Model Doctor' })).toBeNull());
    // jsdom no implementa `inert` (`'inert' in HTMLElement.prototype === false`),
    // así que React lo escribe como propiedad expando y al desactivarlo la
    // BORRA: «no inerte» se lee aquí como `undefined`, no como `false`. Lo que
    // el producto debe garantizar —y lo que se afirma— es que el shell deja de
    // estar aislado; `aria-hidden` sí es un atributo real y se comprueba entero.
    expect(shell.inert).toBeFalsy();
    expect(shell.hasAttribute('aria-hidden')).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(doctorButton));
  });

  it('keeps a completed analysis while Model Doctor is opened and closed', async () => {
    const user = userEvent.setup();
    await renderExampleApp(user);

    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await openResults(user);
    await waitFor(() => {
      expect(screen.getAllByText(/Diagrama de momento flector/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    const diagramsBefore = screen.getAllByText(/Diagrama de momento flector/i).length;

    await user.click(screen.getByRole('button', { name: 'Model Doctor' }));
    await screen.findByRole('dialog', { name: 'Model Doctor' }, { timeout: 5000 });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Model Doctor' })).toBeNull());
    expect(screen.getAllByText(/Diagrama de momento flector/i)).toHaveLength(diagramsBefore);
  }, 15_000);

  it('returns focus through the complete keyboard launcher path', async () => {
    const user = userEvent.setup();
    await renderExampleApp(user);
    const analyzeButton = screen.getByRole('button', { name: /^analizar$/i });
    analyzeButton.focus();

    await user.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByRole('dialog', { name: /paleta de comandos/i }, { timeout: 5000 })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /paleta de comandos/i })).toBeNull());
    analyzeButton.focus();

    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: /paleta de comandos/i }, { timeout: 5000 });
    await user.click(within(palette).getByRole('option', { name: /Model Doctor/i }));
    await screen.findByRole('dialog', { name: 'Model Doctor' }, { timeout: 5000 });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Model Doctor' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(analyzeButton));
  });

  it('keeps acknowledgement across a real unmount but resets it for a replacement project', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.nodalLoads = [];
    project.memberLoads = [];
    project.loadCases = project.loadCases.map((loadCase) => ({ ...loadCase, selfWeightFactor: 0 }));
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    render(<App />);
    await openWorkspace(user);

    await user.click(screen.getByRole('button', { name: 'Model Doctor' }));
    let doctor = await screen.findByRole('dialog', { name: 'Model Doctor' }, { timeout: 5000 });
    let noLoads = within(doctor).getByRole('article', { name: /sin cargas/i });
    await user.click(within(noLoads).getByRole('button', { name: /reconocer/i }));
    expect(within(noLoads).getByText(/reconocido para esta sesi/i)).toBeTruthy();
    await user.click(within(doctor).getByRole('button', { name: /cerrar model doctor/i }));

    await user.click(screen.getByRole('button', { name: 'Model Doctor' }));
    doctor = await screen.findByRole('dialog', { name: 'Model Doctor' }, { timeout: 5000 });
    expect(within(doctor).getByText(/reconocido para esta sesi/i)).toBeTruthy();
    await user.click(within(doctor).getByRole('button', { name: /cerrar model doctor/i }));

    await user.click(screen.getByRole('button', { name: /abrir proyectos y ejemplos/i }));
    await user.click(within(screen.getByRole('menu', { name: /abrir proyectos y ejemplos/i }))
      .getByRole('menuitem', { name: /proyecto nuevo/i }));
    await user.click(screen.getByRole('button', { name: 'Model Doctor' }));
    doctor = await screen.findByRole('dialog', { name: 'Model Doctor' }, { timeout: 5000 });
    noLoads = within(doctor).getByRole('article', { name: /sin cargas/i });
    expect(within(noLoads).queryByText(/reconocido para esta sesi/i)).toBeNull();
  });

  /**
   * CRI-89 · La composición Compact ya NO se simula con `matchMedia`: la clase
   * del shell sale del viewport de layout. Fingir la media query dejaba la app
   * montada en `M1` mientras la prueba creía estar en `K0`.
   */
  it('collapses expanded mobile Results before opening Model Doctor', async () => {
    setViewport('phone');
    const user = userEvent.setup();
    await renderExampleApp(user);
    expect(document.querySelector('.app-shell')?.getAttribute('data-shell-class')).toBe('K0');
    await openResults(user);
    const results = document.querySelector<HTMLElement>('.results-panel')!;
    expect(results.classList.contains('mobile-collapsed')).toBe(false);

    const menu = await openUtilityMenu(user);
    await user.click(within(menu).getByRole('button', { name: 'Model Doctor' }));

    await screen.findByRole('dialog', { name: 'Model Doctor' }, { timeout: 5000 });
    await waitFor(() => expect(results.classList.contains('mobile-collapsed')).toBe(true));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement)
      .toBe(within(document.querySelector('.topbar') as HTMLElement).getByRole('button', { name: /más acciones/i })));
  });

  it('shows one Model Doctor toast for a new diagnosis and does not repeat it while unchanged', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.nodalLoads = [];
    project.memberLoads = [];
    project.loadCases = project.loadCases.map((loadCase) => ({ ...loadCase, selfWeightFactor: 0 }));
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    render(<App />);
    await openWorkspace(user);

    expect(await screen.findByText('Model Doctor encontró problemas')).toBeTruthy();
    expect(screen.getByText(/Abre Model Doctor para revisarlos/i)).toBeTruthy();

    // Un cambio cualquiera que fuerce un re-render del shell. Las unidades ya no
    // son un `<select>` suelto en la barra: viven con las otras tres decisiones
    // de análisis, dentro del ítem que las abre.
    await user.click(screen.getByRole('button', { name: 'Análisis' }));
    fireEvent.change(
      within(await screen.findByRole('dialog', { name: 'Análisis' })).getByRole('combobox', { name: 'Unidades' }),
      { target: { value: 'N-mm' } },
    );

    await waitFor(() => expect(screen.getAllByText('Model Doctor encontró problemas')).toHaveLength(1));
  });

  it('draws mixed reactions as separate horizontal Rx and vertical Ry arrows', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.name = 'Viga con reacciones mixtas';
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{
      id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5,
      releases: { iMoment: true, jMoment: true },
    }];
    project.loadCases = [{ id: 'LC1', name: 'Caso mixto', category: 'variable', active: true, selfWeightFactor: 0 }];
    project.combinations = [];
    project.nodalLoads = [];
    project.memberLoads = [{
      id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real',
      start: 0, end: 1, position: 0.25, px: 20, py: -40,
    }];
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));

    const { container } = render(<App />);
    await openWorkspace(user);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    // CRI-101 · «Reacciones» dejó de ser una pestaña del panel y pasó a ser la
    // superficie `dense`. La capa de reacciones del lienzo, que es lo que esta
    // prueba mide, se dibuja con el resultado resuelto y sigue siendo la misma.
    await openResults(user);
    expect(document.querySelector('[data-dense-launcher="reactions"]')).toBeTruthy();

    await waitFor(() => expect(container.querySelector('.reaction-symbol[data-node-id="A"]')).toBeTruthy());
    const reaction = container.querySelector('.reaction-symbol[data-node-id="A"]')!;
    const rx = reaction.querySelector('line[data-reaction-component="rx"]')!;
    const ry = reaction.querySelector('line[data-reaction-component="ry"]')!;

    expect(rx.getAttribute('y1')).toBe(rx.getAttribute('y2'));
    expect(rx.getAttribute('x1')).not.toBe(rx.getAttribute('x2'));
    expect(ry.getAttribute('x1')).toBe(ry.getAttribute('x2'));
    expect(ry.getAttribute('y1')).not.toBe(ry.getAttribute('y2'));
    expect(reaction.textContent).toContain('Rx = -20.000 kN');
    expect(reaction.textContent).toContain('Ry = 30.000 kN');
    expect(reaction.textContent).not.toContain('R = 36.056 kN');

    const reactionB = container.querySelector('.reaction-symbol[data-node-id="B"]')!;
    expect(reactionB.querySelector('line[data-reaction-component="rx"]')).toBeNull();
    expect(reactionB.querySelector('line[data-reaction-component="ry"]')).toBeTruthy();
  }, 15_000);

  it('creates a guided classroom exercise and analyzes it without prediction gates', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /nuevo ejercicio/i }));
    await user.click(screen.getByRole('radio', { name: /viga simplemente apoyada/i }));
    await user.click(screen.getByRole('button', { name: /crear ejercicio/i }));

    expect(await screen.findByDisplayValue('Viga simplemente apoyada')).toBeTruthy();
    expect(screen.getAllByText(/modo aula/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    // CRI-95 · el estado del análisis vive ahora en la TopBar y su afirmación
    // es «Análisis actualizado»: `success` sin prometer `reliable` ni `safe`.
    // «Resultados resueltos» era la copia del panel anterior y ya no la escribe
    // nadie.
    await waitFor(() => expect(screen.getAllByText(/análisis actualizado/i).length).toBeGreaterThan(0), { timeout: 2500 });
    expect(screen.queryByRole('heading', { name: /tu hipótesis antes del cálculo/i })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /signo esperado/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /revelar y comparar/i })).toBeNull();

    // CRI-101 · «Aprender» ya no es una pestaña residente: es la vista `learn`
    // de la superficie densa, que se invoca desde su lanzador.
    await openResults(user);
    await openDenseResults(user, 'learn');
    expect(await screen.findByRole('button', { name: 'Fundamentos' }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Procedimiento' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verificación' })).toBeTruthy();
  }, 20_000);

  it('changes between light and dark themes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openWorkspace(user);
    const menu = await openUtilityMenu(user);
    const button = within(menu).getByRole('button', { name: /tema oscuro/i });
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('changes the primary controls language and saves it in the project', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openWorkspace(user);
    const menu = await openUtilityMenu(user);
    await user.selectOptions(within(menu).getByRole('combobox', { name: /idioma/i }), 'en');

    expect(screen.getByRole('button', { name: /^analyze$/i })).toBeTruthy();
    expect(screen.getAllByRole('combobox', { name: /load case or combination/i }).length).toBeGreaterThan(0);
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(PROJECT_STORAGE_KEY) ?? '{}');
      expect(saved.settings?.language).toBe('en');
    });
  });

  it('highlights the objects related to an open learning step', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await openResults(user);
    await openDenseResults(user, 'learn');
    // La superficie densa se monta en un portal, fuera del contenedor de
    // render; el resaltado que se mide sigue estando en el lienzo, dentro.
    let firstStep: Element | null = null;
    await waitFor(() => {
      firstStep = document.querySelector('.learning-steps summary');
      expect(firstStep).toBeTruthy();
    }, { timeout: 5000 });
    await user.click(firstStep!);
    await waitFor(() => expect(container.querySelectorAll('.learning-highlight').length).toBeGreaterThan(0));
  }, 20_000);

  it('shows the N–V–M cursor and learning levels', async () => {
    const user = userEvent.setup();
    await renderExampleApp(user);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await openResults(user);
    await waitFor(() => expect(screen.getByTestId('diagram-chart')).toBeTruthy());
    expect(screen.getByText(/Cursor exacto N–V–M/i)).toBeTruthy();

    await openDenseResults(user, 'learn');
    const detailGroup = await screen.findByRole('group', { name: /nivel de detalle/i }, { timeout: 5000 });
    expect(detailGroup).toBeTruthy();
    await user.click(within(detailGroup).getByRole('button', { name: 'Completo' }));
    expect(within(detailGroup).getByRole('button', { name: 'Completo' }).classList.contains('active')).toBe(true);
  }, 20_000);

  it('duplicates and copy-pastes members with fresh identifiers', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const initial = container.querySelectorAll('.member-object').length;
    const firstMember = container.querySelector('.member-object');
    expect(firstMember).toBeTruthy();
    await user.click(firstMember!);
    await user.keyboard('{Control>}d{/Control}');
    expect(screen.getByLabelText(/duplicar selección/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /confirmar duplicado/i }));
    await waitFor(() => expect(container.querySelectorAll('.member-object').length).toBe(initial + 1));
    await user.keyboard('{Control>}c{/Control}');
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(container.querySelectorAll('.member-object').length).toBe(initial + 2));
  });

  it('presents repeat as an accessible contextual canvas action', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const member = container.querySelector('.member-object');
    expect(member).toBeTruthy();

    await user.click(member!);
    const repeat = screen.getByRole('button', { name: /repetir/i });
    expect(repeat.getAttribute('data-repeat-affordance')).toBe('available');
    expect(repeat.getAttribute('aria-keyshortcuts')).toBe('R');

    await user.click(repeat);
    const preview = screen.getByRole('status', { name: /repetición preparada/i });
    expect(preview.getAttribute('data-repeat-affordance')).toBe('active');
    expect(within(preview).getByRole('button', { name: /cancelar colocación/i })).toBeTruthy();
  });

  it('exposes canvas shortcuts and selects structural objects from the keyboard', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const canvas = screen.getByRole('application', { name: /área de trabajo estructural/i });
    const member = screen.getByRole('button', { name: /miembro M1, de N1 a N3/i });

    expect(canvas.getAttribute('data-pointer-support')).toBe('mouse touch pen');
    expect(canvas.getAttribute('aria-keyshortcuts')).toContain('Delete');
    expect(member.getAttribute('aria-keyshortcuts')).toBe('Enter Space');

    // CRI-103 · un atajo de UNA letra sólo dispara con el foco dentro del
    // lienzo; con el foco en el `body` debe quedarse quieto para no secuestrar
    // la navegación rápida de un lector de pantalla. Se afirman las dos mitades.
    fireEvent.keyDown(canvas, { key: 'h', code: 'KeyH' });
    expect(screen.getByRole('button', { name: /desplazar \(H\)/i }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.keyDown(member, { key: 'Enter', code: 'Enter' });
    expect(member.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-structure-id="M1"] .member-selection-halo')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(member.getAttribute('aria-pressed')).toBe('false');

    focusCanvas(canvas);
    fireEvent.keyDown(canvas, { key: 'h', code: 'KeyH' });
    expect(screen.getByRole('button', { name: /desplazar \(H\)/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps touch pan intent ahead of the overlap picker on a structural node', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const canvas = screen.getByRole('application', { name: /área de trabajo estructural/i });
    const node = screen.getByRole('button', { name: /nodo N1, X 0\.000, Y 0\.000/i });
    const member = screen.getByRole('button', { name: /miembro M1, de N1 a N3/i });
    const originalElementsFromPoint = document.elementsFromPoint;
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [node, member],
    });

    try {
      fireEvent.pointerDown(node, {
        pointerId: 2,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: 120,
        clientY: 160,
      });

      expect(canvas.getAttribute('data-interaction')).toBe('pending');
      expect(container.querySelector('.selection-overlap-picker')).toBeNull();
    } finally {
      Object.defineProperty(document, 'elementsFromPoint', {
        configurable: true,
        value: originalElementsFromPoint,
      });
    }
  });

  it('keeps touch selection disabled for object kinds excluded by the selection filter', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = {
      ...project.settings,
      selectionFilter: { nodes: false, members: true, loads: true },
    };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    const { container } = render(<App />);
    await openWorkspace(user);
    const canvas = screen.getByRole('application', { name: /área de trabajo estructural/i });
    const node = screen.getByRole('button', { name: /nodo N1, X 0\.000, Y 0\.000/i });

    fireEvent.pointerDown(node, {
      pointerId: 3,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: 120,
      clientY: 160,
    });
    fireEvent.pointerUp(node, {
      pointerId: 3,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      buttons: 0,
      clientX: 120,
      clientY: 160,
    });

    expect(canvas.getAttribute('data-interaction')).toBe('idle');
    expect(node.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-structure-id="N1"] .node-selection-halo')).toBeNull();
  });

  it('localizes canvas object names, CAD entry, feedback, and result legend in English', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: /continue project/i }));
    await screen.findByRole('button', { name: /^analyze$/i }, { timeout: 5000 });
    const canvas = screen.getByRole('application', { name: /structural workspace/i });

    expect(screen.getByRole('button', { name: /Member M1, from N1 to N3/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Node N1, X 0\.000, Y 0\.000/ })).toBeTruthy();
    expect(container.querySelector('.load-symbol, .distributed-symbol')?.getAttribute('aria-label')).not.toMatch(/Carga|Momento/);

    focusCanvas(canvas);
    fireEvent.keyDown(canvas, { key: 'n', code: 'KeyN' });
    const cad = await screen.findByRole('form', { name: 'CAD numeric entry' }, { timeout: 5000 });
    expect(within(cad).getByText('Node by coordinates')).toBeTruthy();
    await user.click(within(cad).getByRole('button', { name: 'Create node' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter two valid numeric values.');

    await user.click(screen.getByRole('button', { name: /^analyze$/i }));
    await user.click(screen.getByRole('button', { name: 'Results' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    expect(container.querySelector('.canvas-result-legend')?.getAttribute('aria-label')).toBe('Diagram convention');
    expect(container.querySelector('.canvas-result-legend')?.textContent).toContain('Exact curve');
    expect(container.querySelector('.canvas-result-legend')?.textContent).not.toMatch(/Curva exacta|por miembro|común/);
  }, 20_000);

  it('renames a project without invalidating completed analysis', async () => {
    const user = userEvent.setup();
    await renderExampleApp(user);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await openResults(user);
    await screen.findByTestId('diagram-chart');
    const name = screen.getByRole('textbox', { name: /nombre del proyecto/i });
    await user.clear(name);
    await user.type(name, 'Marco principal');
    await user.tab();
    expect(screen.getByTestId('diagram-chart')).toBeTruthy();
    const menu = await openUtilityMenu(user);
    await user.selectOptions(within(menu).getByRole('combobox', { name: /idioma/i }), 'en');
    expect(screen.getByTestId('diagram-chart')).toBeTruthy();
    // Misma holgura que el resto de recorridos que montan la app, analizan y
    // luego teclean: es el test más pesado del archivo y con el timeout por
    // defecto de 5 s vivía al borde bajo carga de suite completa.
  }, 10_000);

  /**
   * CRI-104 · Quién está entrando se deriva del REPOSITORIO, no de una
   * preferencia inventada: `listProjects()` y `listRecoveries()`, las dos
   * lecturas que `ProjectHub` ya hacía. Escribir `localStorage` no convierte a
   * nadie en usuario recurrente, y esta prueba lo fija para que ninguna prueba
   * futura vuelva a fingirlo por ahí.
   *
   * La derivación se ejercita con `InMemoryProjectRepository`, que es la
   * implementación de `ProjectRepository` que el propio producto expone para
   * esto (la misma que usan `ProjectHub.test.tsx` y `welcomeFlow.test.tsx`):
   * no hay mock, ni parche de `listProjects`, ni bypass del repositorio.
   */
  describe('returning user', () => {
    it('derives a returning user from saved projects, and resumes directly', async () => {
      const repository = new InMemoryProjectRepository();
      await repository.saveProject({ ...createDefaultProject(), name: 'Trabajo de ayer' });

      const entry = await readWelcomeEntry(repository);
      expect(entry.status).toBe('returning');
      expect(entry.projects).toBe(1);
      expect(shouldResumeDirectly(entry)).toBe(true);
    });

    it('never auto-skips while a recovery copy is pending', async () => {
      const repository = new InMemoryProjectRepository();
      const project = { ...createDefaultProject(), name: 'Trabajo protegido' };
      await repository.saveProject(project);
      await repository.createRecovery(project, 'conflict');

      const entry = await readWelcomeEntry(repository);
      expect(entry.status).toBe('returning');
      expect(entry.recoveries).toBe(1);
      // La recuperación vive en la Bienvenida: saltársela escondería trabajo
      // protegido, que es el riesgo que CRI-104 marca como inaceptable.
      expect(shouldResumeDirectly(entry)).toBe(false);
    });

    it('treats a stored project in localStorage as a new user, and keeps the welcome', async () => {
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
      render(<App />);

      // El proyecto activo de `localStorage` NO es una biblioteca: sin
      // repositorio (jsdom no implementa IndexedDB) el usuario es nuevo y el
      // lanzador se queda entero, con sus puertas y su biblioteca.
      expect(await readWelcomeEntry()).toEqual({ status: 'new', projects: 0, recoveries: 0 });
      expect(await screen.findByTestId('welcome-screen')).toBeTruthy();
      expect(document.querySelector('.welcome-action-list')).not.toBeNull();
      expect(document.querySelector('.welcome-resume-card')).not.toBeNull();
    });

    it('keeps Home reachable from the workspace', async () => {
      const user = userEvent.setup();
      await renderExampleApp(user);

      await user.click(screen.getByRole('button', { name: /ir al inicio/i }));

      const welcome = await screen.findByTestId('welcome-screen');
      expect(welcome).toBeTruthy();
      // Inicio es Inicio de verdad: el lanzador vuelve con sus puertas.
      expect(document.querySelector('.welcome-resume-card')).not.toBeNull();
      expect(screen.getByRole('button', { name: /nuevo proyecto/i })).toBeTruthy();
    }, 15_000);
  });

  /**
   * CRI-94 sustituyó «el inspector móvil es modal» por un vocabulario explícito:
   * sólo `drawer` y `fullscreen` son modales; una `sheet` CONVIVE con el
   * trabajo. En `K0` el Inspector es `sheet`, así que no aísla el shell y el
   * lienzo —donde sigue el foco— conserva sus atajos. Lo que esta prueba
   * afirmaba de verdad (un atajo del lienzo no dispara bajo una superficie que
   * aísla) se comprueba contra la superficie que HOY sí es modal en `K0`:
   * Model Doctor, presentado a pantalla completa.
   */
  it('keeps the Compact inspector sheet coexisting, and blocks canvas shortcuts only under a modal surface', async () => {
    setViewport('phone');
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const shell = container.querySelector<HTMLElement>('.app-shell')!;
    const member = container.querySelector('.member-object');
    expect(member).toBeTruthy();
    await user.click(member!);
    const before = container.querySelectorAll('.member-object').length;

    // 1 · La hoja del Inspector convive: no aísla el fondo.
    fireEvent.click(container.querySelector('.mobile-inspector-toggle')!);
    await screen.findByRole('dialog', { name: /inspector/i });
    expect(shell.inert).toBeFalsy();
    expect(shell.hasAttribute('aria-hidden')).toBe(false);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /inspector/i })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.mobile-inspector-toggle')));
    expect(container.querySelectorAll('.member-object')).toHaveLength(before);

    // 2 · Bajo una superficie MODAL el fondo sí queda aislado y el atajo del
    // lienzo no llega: ni borra ni abre la paleta.
    await user.click(member!);
    await user.click(screen.getByRole('button', { name: 'Model Doctor' }));
    await screen.findByRole('dialog', { name: 'Model Doctor' }, { timeout: 5000 });
    expect(shell.inert).toBe(true);
    expect(shell.getAttribute('aria-hidden')).toBe('true');

    await user.keyboard('{Delete}');
    expect(container.querySelectorAll('.member-object')).toHaveLength(before);
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog', { name: /paleta de comandos/i })).toBeNull();
  }, 20_000);
});
