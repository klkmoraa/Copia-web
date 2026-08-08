// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { createDefaultProject } from './data/defaultProject';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  if (!globalThis.crypto.randomUUID) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: () => '00000000-0000-4000-8000-000000000000' });
  }
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => cleanup());

const openWorkspace = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /continuar proyecto/i }));
  await screen.findByRole('button', { name: /^analizar$/i }, { timeout: 5000 });
};

const renderExampleApp = async (user: ReturnType<typeof userEvent.setup>) => {
  localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
  const result = render(<App />);
  await openWorkspace(user);
  return result;
};

const openUtilityMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /más acciones/i }));
  return screen.findByRole('dialog', { name: /más acciones/i });
};

describe('structureCo app shell', () => {
  it('shows a start screen and opens a blank project on demand', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /analiza estructuras con claridad/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /nuevo ejercicio/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /proyecto completo/i })).toBeTruthy();
    expect(screen.getByText(/importar archivo/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /proyecto completo/i }));

    expect(await screen.findByDisplayValue('Proyecto sin título', {}, { timeout: 5000 })).toBeTruthy();
    expect(container.querySelectorAll('.node-object')).toHaveLength(0);
    expect(container.querySelectorAll('.member-object')).toHaveLength(0);
  }, 10_000);

  it('localizes built-in example cards and preserves English when an example opens', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    localStorage.setItem('structureCo.project', JSON.stringify(project));
    const { container } = render(<App />);

    const exampleFrame = screen.getByRole('button', { name: /Example frame.*6 × 4 m frame/ });
    expect(exampleFrame).toBeTruthy();
    expect(screen.getByRole('button', { name: /Simply supported beam.*8 m beam/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Triangular truss.*statically determinate truss/i })).toBeTruthy();
    const cards = [...container.querySelectorAll('.welcome-template-card')].map((card) => card.textContent).join(' ');
    expect(cards).not.toMatch(/Pórtico de ejemplo|Viga simplemente apoyada|Armadura triangular/);

    await user.click(exampleFrame);
    expect(await screen.findByRole('button', { name: /^analyze$/i }, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^analizar$/i })).toBeNull();
  }, 10_000);

  it('preserves English when creating a guided exercise', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    localStorage.setItem('structureCo.project', JSON.stringify(project));
    render(<App />);

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

    await waitFor(() => {
      expect(screen.getAllByText(/Diagrama de momento flector/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    expect(screen.queryByText(/No se generaron resultados/i)).toBeNull();
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
    localStorage.setItem('structureCo.project', JSON.stringify(project));

    const { container } = render(<App />);
    await openWorkspace(user);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await user.click(await screen.findByRole('tab', { name: /^reacciones$/i }));

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
  });

  it('creates a guided classroom exercise and keeps the solution hidden until reveal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /nuevo ejercicio/i }));
    await user.click(screen.getByRole('radio', { name: /viga simplemente apoyada/i }));
    await user.click(screen.getByRole('button', { name: /crear ejercicio/i }));

    expect(await screen.findByDisplayValue('Viga simplemente apoyada')).toBeTruthy();
    expect(screen.getAllByText(/modo aula/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    expect(await screen.findByRole('heading', { name: /tu hipótesis antes del cálculo/i })).toBeTruthy();
    expect(screen.queryByText(/decide cuándo ver la solución/i)).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: /signo esperado/i }), 'negative');
    await user.type(screen.getByRole('spinbutton', { name: /magnitud estimada/i }), '20');
    await user.click(screen.getByRole('button', { name: /continuar al análisis/i }));
    await waitFor(() => expect(screen.getByText(/decide cuándo ver la solución/i)).toBeTruthy(), { timeout: 2500 });
    expect(screen.queryByText(/resumen global/i)).toBeNull();

    await user.click(screen.getAllByRole('button', { name: /revelar y comparar/i }).at(-1)!);
    await waitFor(() => expect(screen.getByText(/resumen global/i)).toBeTruthy());
    expect(screen.getByText(/tu predicción frente al resultado/i)).toBeTruthy();
  }, 10_000);

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
      const saved = JSON.parse(localStorage.getItem('structureCo.project') ?? '{}');
      expect(saved.settings?.language).toBe('en');
    });
  });

  it('highlights the objects related to an open learning step', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /aprender/i })).toBeTruthy());
    await user.click(screen.getByRole('tab', { name: /aprender/i }));
    let firstStep: Element | null = null;
    await waitFor(() => {
      firstStep = container.querySelector('.learning-steps summary');
      expect(firstStep).toBeTruthy();
    });
    await user.click(firstStep!);
    await waitFor(() => expect(container.querySelectorAll('.learning-highlight').length).toBeGreaterThan(0));
  });

  it('shows the N–V–M cursor and learning levels', async () => {
    const user = userEvent.setup();
    await renderExampleApp(user);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
    await waitFor(() => expect(screen.getByTestId('diagram-chart')).toBeTruthy());
    expect(screen.getByText(/Cursor exacto N–V–M/i)).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /aprender/i }));
    const detailGroup = await screen.findByRole('group', { name: /nivel de detalle/i });
    expect(detailGroup).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Completo' }));
    expect(screen.getByRole('button', { name: 'Completo' }).classList.contains('active')).toBe(true);
  });

  it('duplicates and copy-pastes members with fresh identifiers', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const initial = container.querySelectorAll('.member-object').length;
    const firstMember = container.querySelector('.member-object');
    expect(firstMember).toBeTruthy();
    await user.click(firstMember!);
    await user.keyboard('{Control>}d{/Control}');
    await waitFor(() => expect(container.querySelectorAll('.member-object').length).toBe(initial + 1));
    await user.keyboard('{Control>}c{/Control}');
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(container.querySelectorAll('.member-object').length).toBe(initial + 2));
  });

  it('exposes canvas shortcuts and selects structural objects from the keyboard', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const canvas = screen.getByRole('application', { name: /área de trabajo estructural/i });
    const member = screen.getByRole('button', { name: /miembro M1, de N1 a N3/i });

    expect(canvas.getAttribute('data-pointer-support')).toBe('mouse touch pen');
    expect(canvas.getAttribute('aria-keyshortcuts')).toContain('Delete');
    expect(member.getAttribute('aria-keyshortcuts')).toBe('Enter Space');

    fireEvent.keyDown(member, { key: 'Enter', code: 'Enter' });
    expect(member.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-structure-id="M1"] .member-selection-halo')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(member.getAttribute('aria-pressed')).toBe('false');

    fireEvent.keyDown(canvas, { key: 'h', code: 'KeyH' });
    expect(screen.getByRole('button', { name: /desplazar \(H\)/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('localizes canvas object names, CAD entry, feedback, and result legend in English', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    localStorage.setItem('structureCo.project', JSON.stringify(project));
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: /continue project/i }));
    await screen.findByRole('button', { name: /^analyze$/i }, { timeout: 5000 });
    const canvas = screen.getByRole('application', { name: /structural workspace/i });

    expect(screen.getByRole('button', { name: /Member M1, from N1 to N3/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Node N1, X 0\.000, Y 0\.000/ })).toBeTruthy();
    expect(container.querySelector('.load-symbol, .distributed-symbol')?.getAttribute('aria-label')).not.toMatch(/Carga|Momento/);

    fireEvent.keyDown(canvas, { key: 'n', code: 'KeyN' });
    const cad = screen.getByRole('form', { name: 'CAD numeric entry' });
    expect(within(cad).getByText('Node by coordinates')).toBeTruthy();
    await user.click(within(cad).getByRole('button', { name: 'Create node' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter two valid numeric values.');

    await user.click(screen.getByRole('button', { name: /^analyze$/i }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    expect(container.querySelector('.canvas-result-legend')?.getAttribute('aria-label')).toBe('Diagram convention');
    expect(container.querySelector('.canvas-result-legend')?.textContent).toContain('Exact curve');
    expect(container.querySelector('.canvas-result-legend')?.textContent).not.toMatch(/Curva exacta|por miembro|común/);
  }, 10_000);

  it('renames a project without invalidating completed analysis', async () => {
    const user = userEvent.setup();
    await renderExampleApp(user);
    await user.click(screen.getByRole('button', { name: /^analizar$/i }));
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

  it('does not run canvas shortcuts while the mobile inspector is modal', async () => {
    const user = userEvent.setup();
    const { container } = await renderExampleApp(user);
    const member = container.querySelector('.member-object');
    expect(member).toBeTruthy();
    await user.click(member!);
    const before = container.querySelectorAll('.member-object').length;
    fireEvent.click(container.querySelector('.mobile-inspector-toggle')!);
    await screen.findByRole('dialog', { name: /inspector/i });
    await user.keyboard('{Delete}');
    expect(container.querySelectorAll('.member-object')).toHaveLength(before);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /inspector/i })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.mobile-inspector-toggle')));
  });
});
