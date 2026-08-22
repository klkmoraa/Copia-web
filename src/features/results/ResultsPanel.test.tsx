// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject, createHibbelerStyleDiagramPractice } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { createSimpleBeamExercise } from '../../education/exerciseTemplates';
import { ClassroomSessionProvider, useClassroomSession } from '../../store/ClassroomSessionContext';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { ProjectModel } from '../../types';
import { workspaceCommandEventName } from '../workspace/workspaceCommands';
import { ResultsPanel } from './ResultsPanel';
import { useState } from 'react';

const RESULTS_MODE_STORAGE_KEY = 'structureCo.results.mode.v1';

/**
 * Results ya no consulta `matchMedia`: su modo lo decide la clase que resuelve
 * el shell a partir del viewport (CRI-89). Fijar el viewport es ahora la única
 * forma de elegir composición desde una prueba — y la misma que usa producción.
 */
const setViewport = (viewport: 'desktop' | 'tablet' | 'phone' = 'desktop') => {
  const [width, height] = viewport === 'phone' ? [390, 844] : viewport === 'tablet' ? [900, 1000] : [1440, 900];
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
};

/** Sigue haciendo falta para `prefers-color-scheme`, que jsdom no implementa. */
const stubMatchMedia = () => vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const ResultsHarness = () => {
  const { project, analysis, resultTab, selection, resultCursor } = useProject();
  const [open, setOpen] = useState(true);
  const presentation = window.innerWidth < 1024 ? 'sheet' : 'dock';
  const selectionLabel = selection?.kind === 'member' || selection?.kind === 'node'
    ? `${selection.kind}:${selection.id}`
    : selection?.kind ?? 'none';
  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    <output aria-label="Pestaña activa">{resultTab}</output>
    <output aria-label="Selección actual">{selectionLabel}</output>
    <output aria-label="Cursor de resultados">{resultCursor ? `${resultCursor.memberId}:${resultCursor.x}:${resultCursor.pinned}` : 'none'}</output>
    <ClassroomDiagnostics />
    <ResultsPanel presentation={presentation} status={open ? 'active' : 'closed'} onOpenChange={setOpen} />
  </ClassroomSessionProvider>;
};

const ClassroomDiagnostics = () => {
  const session = useClassroomSession();
  const { project, analysis, updateProjectView } = useProject();
  return <div data-testid="classroom-diagnostics">
    <output aria-label="Predicciones base">{JSON.stringify(session.predictions)}</output>
    <output aria-label="Estado del modelo">{`${project.nodes.length}:${project.members.length}:${project.memberLoads.length + project.nodalLoads.length}:${analysis?.success === true}`}</output>
    <button onClick={() => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, units: 'N-mm' } }))}>Unidades N-mm</button>
    <button onClick={() => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, calculationMode: 'complete' } }))}>Modo completo test</button>
    <button onClick={() => updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, calculationMode: 'classroom' } }))}>Modo aula test</button>
  </div>;
};

const renderResults = (project: ProjectModel = createHibbelerStyleDiagramPractice()) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  return render(<ProjectProvider><ResultsHarness /></ProjectProvider>);
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: stubMatchMedia(),
  });
  window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
});

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = stubMatchMedia();
  setViewport('desktop');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Results analytical center', () => {
  it('localizes the empty classroom next step in English', () => {
    const project = createBlankProject();
    project.settings = { ...project.settings, calculationMode: 'classroom', language: 'en' };
    renderResults(project);

    expect(screen.getByText('Next: Build')).toBeTruthy();
    expect(screen.getByText('Create connected nodes and members; this geometry remains the real model.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue building' })).toBeTruthy();
    expect(screen.queryByText(/Siguiente|Construye|Continuar construcción/)).toBeNull();
  });

  it('invokes the dense surface instead of keeping reactions, influence and learn resident', async () => {
    const user = userEvent.setup();
    const invocations: Array<{ view: string; trigger: string | null }> = [];
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ view: string; trigger?: HTMLElement | null }>).detail;
      invocations.push({ view: detail.view, trigger: detail.trigger?.textContent ?? null });
    };
    window.addEventListener(workspaceCommandEventName('open-dense-results'), listener);
    renderResults();
    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });

    // Ninguna de las tres sigue siendo pestaña residente del panel.
    for (const name of ['Reacciones', 'Influencia', 'Aprender']) {
      expect(screen.queryByRole('tab', { name })).toBeNull();
    }
    const launchers = screen.getByRole('group', { name: 'Datos densos' });
    await user.click(within(launchers).getByRole('button', { name: 'Reacciones' }));
    await user.click(within(launchers).getByRole('button', { name: 'Influencia' }));

    // El lanzador viaja en el comando: es a donde el broker devuelve el foco.
    expect(invocations).toEqual([
      { view: 'reactions', trigger: 'Reacciones' },
      { view: 'influence', trigger: 'Influencia' },
    ]);
    window.removeEventListener(workspaceCommandEventName('open-dense-results'), listener);
  }, 10_000);

  it('organizes tabs by purpose and supports keyboard plus persistent panel modes', async () => {
    const user = userEvent.setup();
    renderResults();

    const panel = screen.getByRole('region', { name: 'Resultados del análisis' });
    expect(screen.getByText('Centro analítico')).toBeTruthy();
    for (const family of ['Estado', 'Esfuerzos', 'Forma']) {
      expect(screen.getAllByText(family).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole('tab', { name: 'Avisos' })).toBeNull();
    const moment = screen.getByRole('tab', { name: 'Momento' });
    expect(moment.getAttribute('aria-selected')).toBe('true');
    expect(moment.getAttribute('aria-describedby')).toBe('result-family-forces');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('result-tab-moment');

    moment.focus();
    await user.keyboard('{ArrowRight}');
    const deformed = screen.getByRole('tab', { name: 'Deformada' });
    await waitFor(() => expect(document.activeElement).toBe(deformed));
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Resumen' }).getAttribute('aria-selected')).toBe('true');

    const focusButton = screen.getByRole('button', { name: 'Enfocar' });
    await user.click(focusButton);
    await waitFor(() => expect(panel.getAttribute('data-results-mode')).toBe('focused'));
    expect(document.activeElement).toBe(panel);
    expect(localStorage.getItem(RESULTS_MODE_STORAGE_KEY)).toBe('expanded');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(panel.getAttribute('data-results-mode')).toBe('expanded'));
    expect(document.activeElement).toBe(focusButton);
  });

  it('moves from an empty state to exact summary traceability without recalculating in the UI', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    await user.click(screen.getByRole('tab', { name: 'Resumen' }));
    const summary = await screen.findByRole('region', { name: 'Resumen global de resultados' });
    expect(summary).toBeTruthy();
    const quality = screen.getByRole('region', { name: 'Calidad numérica' });
    expect(quality.textContent).toMatch(/Resultado numéricamente estable/);
    expect(quality.textContent).toMatch(/Condición κ₁/);
    expect(quality.textContent).toMatch(/no evalúa la seguridad estructural/i);

    // La tarjeta de extremo conserva los cinco a la vez.
    const momentCard = screen.getByRole('article', { name: /M máx\. absoluto/i });
    expect(within(momentCard).getByText('kN·m')).toBeTruthy();
    expect(momentCard.textContent).toMatch(/Posición/);
    expect(momentCard.textContent).toMatch(/AB · x/);
    expect(momentCard.textContent).toMatch(/Fiabilidad/);
    expect(within(momentCard).getByText('Explicar este valor')).toBeTruthy();
    expect(momentCard.getAttribute('data-level')).toBe('raised');

    await user.click(within(momentCard).getByRole('button', { name: 'Localizar en el modelo' }));
    expect(screen.getByLabelText('Selección actual').textContent).toBe('member:AB');
    expect(screen.getByLabelText('Pestaña activa').textContent).toBe('moment');
    expect(screen.getByLabelText('Cursor de resultados').textContent).toBe('AB:3:true');
    expect(screen.getByText('Miembro AB')).toBeTruthy();
  }, 10_000);

  it('announces keyboard chart readings and keeps the cursor out of the extreme cards', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    const chart = await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    const graph = within(chart).getByRole('img', { name: /diagrama .* del miembro/i });
    expect(graph.getAttribute('aria-describedby')).toBeTruthy();
    expect(graph.getAttribute('aria-keyshortcuts')).toContain('ArrowRight');

    graph.focus();
    await user.keyboard('{ArrowRight}');
    const reading = within(chart).getByRole('status');
    expect(reading.getAttribute('aria-live')).toBe('polite');
    expect(reading.textContent).toContain('x');
    expect(screen.getByLabelText('Cursor de resultados').textContent).not.toBe('none');
    await user.keyboard('{Escape}');
    expect(screen.getByLabelText('Cursor de resultados').textContent).toBe('none');

    // Los extremos del diagrama son tarjetas y no dependen del cursor: la
    // lectura del puntero vive junto al gráfico, no dentro de ellas.
    const maximum = screen.getByRole('article', { name: /momento flector · Máx\./i });
    expect(maximum.getAttribute('data-level')).toBe('raised');
    expect(maximum.textContent).toMatch(/Fiabilidad/);
    expect(maximum.textContent).not.toMatch(/Valor en el cursor/);
  }, 10_000);

  it('lets an unpinned chart Escape close the mobile results sheet', async () => {
    const user = userEvent.setup();
    setViewport('tablet');
    renderResults();

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    const chart = await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    const graph = within(chart).getByRole('img', { name: /diagrama .* del miembro/i });
    expect(screen.getByRole('dialog', { name: /Resultados del an/ }).getAttribute('aria-modal')).toBeNull();
    expect(screen.getByLabelText('Cursor de resultados').textContent).toBe('none');

    graph.focus();
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Resultados del an/ })).toBeNull());
  }, 10_000);

  it('keeps the solved envelope when only a presentation setting changes', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    const chart = await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    await user.click(within(chart).getByRole('button', { name: 'Env.' }));
    const scenarios = await within(chart).findByText(/\d+ escenarios/, {}, { timeout: 5000 });
    expect(scenarios.textContent).not.toBe('0 escenarios');
    const solved = scenarios.textContent;

    // Units are a display concern: the solver never reads them, so switching
    // them must not throw away every scenario that was just solved.
    await user.click(screen.getByRole('button', { name: 'Unidades N-mm' }));
    const afterUnits = screen.getByTestId('diagram-chart');
    expect(within(afterUnits).getByRole('button', { name: 'Env.' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(afterUnits).getByText(/escenarios/).textContent).toBe(solved);
  }, 15_000);

  it('presents the analytical architecture in English without mixed Phase 9 labels', async () => {
    const user = userEvent.setup();
    const project = createHibbelerStyleDiagramPractice();
    project.settings.language = 'en';
    renderResults(project);

    expect(screen.getByText('Analysis center')).toBeTruthy();
    for (const family of ['State', 'Forces', 'Shape']) {
      expect(screen.getAllByText(family).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole('tab', { name: 'Issues' })).toBeNull();
    const denseLaunchers = screen.getByRole('group', { name: 'Dense data' });
    for (const view of ['Reactions', 'Influence', 'Learn']) {
      expect(within(denseLaunchers).getByRole('button', { name: view })).toBeTruthy();
    }
    expect(screen.getByRole('group', { name: 'Results panel size' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compact' })).toBeTruthy();
    // State and reliability moved to the TopBar's AnalysisStatus in CRI-100;
    // this panel no longer renders its own "Ready to analyze" status text.
    await user.click(screen.getByRole('button', { name: 'Analyze structure' }));
    const chart = await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    const graph = within(chart).getByRole('img', { name: /bending moment diagram/i });
    const help = document.getElementById(graph.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toContain('Use the Left and Right Arrow keys');
    expect(within(chart).getByText('Member')).toBeTruthy();
    expect(within(chart).getByRole('combobox', { name: 'Member for diagram' })).toBeTruthy();
    expect(within(chart).getByRole('button', { name: 'Env.' }).getAttribute('title')).toBe('Compare all cases and combinations');
    expect(within(chart).getByText('Move the pointer · tap to pin')).toBeTruthy();
    expect(within(chart).getByText('Exact N–V–M cursor · enable Env. to compare cases and combinations')).toBeTruthy();
    expect(chart.textContent).not.toMatch(/Miembro|Comparar todos|Mueve el cursor|Discontinuidad/);

    await user.click(screen.getByRole('tab', { name: 'Deformed' }));
    const deformation = await screen.findByTestId('deformation-chart');
    expect(within(deformation).getByRole('combobox', { name: 'Member for deformation' })).toBeTruthy();
    expect(within(deformation).getByRole('group', { name: 'Member response' })).toBeTruthy();
    expect(screen.getByText('Exact member response')).toBeTruthy();
    expect(screen.getByText('Interior maximum')).toBeTruthy();
    expect(within(deformation).getByText('Exact u–v–θ cursor · interior maxima are calculated from the polynomial roots')).toBeTruthy();
    const deformationGraph = within(deformation).getByRole('img', { name: /v response for member/i });
    deformationGraph.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(deformation).getByText('Pinned reading · tap to release')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(deformation.textContent).not.toMatch(/Miembro|Mueve el cursor|Lectura fijada|máximos interiores/);

    await user.click(screen.getByRole('tab', { name: 'Summary' }));
    expect(await screen.findByRole('region', { name: 'Global results summary' })).toBeTruthy();
  }, 10_000);

  it('uses a non-modal tablet sheet and normalizes the stored focused content mode', async () => {
    const user = userEvent.setup();
    setViewport('tablet');
    localStorage.setItem(RESULTS_MODE_STORAGE_KEY, 'focused');
    renderResults();

    const panel = document.querySelector<HTMLElement>('.results-panel') as HTMLElement;
    expect(panel).toBeTruthy();
    await waitFor(() => expect(panel.getAttribute('data-results-mode')).toBe('expanded'));
    const sheet = await screen.findByRole('dialog', { name: 'Resultados del análisis' });
    expect(sheet.getAttribute('aria-modal')).toBeNull();
    expect(document.querySelector('.results-sheet-backdrop')).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Resultados del análisis' })).toBeNull());
  });

  it('keeps the phone results sheet modeless so the canvas remains reachable', async () => {
    const user = userEvent.setup();
    setViewport('phone');
    const { container } = renderResults();
    const canvasHost = document.createElement('div');
    canvasHost.className = 'canvas-host';
    canvasHost.tabIndex = 0;
    container.prepend(canvasHost);

    const sheet = await screen.findByRole('dialog', { name: /Resultados del an/ });
    expect(sheet.getAttribute('aria-modal')).toBeNull();
    expect(sheet.getAttribute('data-canvas-interactive')).toBeNull();
    expect(canvasHost.inert).not.toBe(true);
    expect(canvasHost.getAttribute('aria-hidden')).toBeNull();
    expect(document.querySelector('.results-sheet-backdrop')).toBeNull();

    canvasHost.focus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Resultados del an/ })).toBeNull());
  });

  it('uses phone focus mode temporarily and reopens as the canvas-preserving panel', async () => {
    const user = userEvent.setup();
    setViewport('phone');
    renderResults();

    const panel = screen.getByRole('dialog', { name: /Resultados del an/ });
    await user.click(screen.getByRole('button', { name: 'Enfocar resultados en pantalla completa' }));

    expect(panel.getAttribute('data-results-mode')).toBe('focused');
    expect(localStorage.getItem(RESULTS_MODE_STORAGE_KEY)).toBe('expanded');
    await user.keyboard('{Escape}');
    expect(panel.getAttribute('data-results-mode')).toBe('expanded');

    expect(panel.getAttribute('data-results-mode')).toBe('expanded');
    expect(panel.getAttribute('aria-modal')).toBeNull();
  });

  it('leaves Escape to a visible modal above the modeless phone results', async () => {
    const user = userEvent.setup();
    setViewport('phone');
    renderResults();
    const sheet = await screen.findByRole('dialog', { name: /Resultados del an/ });
    const modalEscape = vi.fn();
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.tabIndex = -1;
    modal.addEventListener('keydown', modalEscape);
    document.body.append(modal);

    try {
      modal.focus();
      await user.keyboard('{Escape}');
      expect(modalEscape).toHaveBeenCalledOnce();
      expect(sheet.classList.contains('mobile-collapsed')).toBe(false);
    } finally {
      modal.remove();
    }
  });

  it('does not alter the camera by fitting the canvas when analysis updates a sheet', async () => {
    const user = userEvent.setup();
    setViewport('phone');
    const onFitCanvas = vi.fn();
    window.addEventListener('structureco:fit-canvas', onFitCanvas);

    try {
      renderResults();
      await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
      await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
      await waitFor(() => expect(screen.getByTestId('diagram-chart')).toBeTruthy());
      expect(onFitCanvas).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('structureco:fit-canvas', onFitCanvas);
    }
  }, 10_000);

  it('keeps native learning summaries inside the mobile focus loop', async () => {
    const user = userEvent.setup();
    setViewport('tablet');
    renderResults();

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    await user.click(screen.getByRole('tab', { name: 'Resumen' }));
    const sheet = screen.getByRole('dialog', { name: 'Resultados del análisis' });
    // La procedencia de cada tarjeta sigue siendo un `summary` nativo dentro
    // de la hoja: cardificar no la sacó del recorrido de foco.
    const summaries = [...sheet.querySelectorAll<HTMLElement>('summary')];
    expect(summaries.length).toBeGreaterThan(0);
    summaries[summaries.length - 1].focus();
    await user.tab();
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: /Resumen ·/ }));
  }, 10_000);

  it.skip('legacy prediction gate retired by Aula vNext', async () => {
    const user = userEvent.setup();
    const project = createSimpleBeamExercise();
    renderResults(project);

    expect(screen.getByRole('heading', { name: 'Tu hipótesis antes del cálculo' })).toBeTruthy();
    const momentTab = screen.getByRole('tab', { name: 'M' });
    momentTab.focus();
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'N' }));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(momentTab);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Signo esperado' }), 'negative');
    const magnitude = screen.getByRole('spinbutton', { name: 'Magnitud estimada' });
    expect(document.getElementById(magnitude.getAttribute('aria-describedby') ?? '')?.textContent).toBe('kN·m');
    await user.type(magnitude, '12.5');
    expect(screen.getByLabelText('Predicciones base').textContent).toBe('{"M1":{"moment":12.5}}');

    await user.click(screen.getByRole('button', { name: 'Unidades N-mm' }));
    expect((screen.getByRole('spinbutton', { name: 'Magnitud estimada' }) as HTMLInputElement).value).toBe('12500000');
    expect(screen.getByLabelText('Predicciones base').textContent).toBe('{"M1":{"moment":12.5}}');

    await user.click(screen.getByRole('button', { name: /continuar al análisis/i }));
    const firstGateHeading = await screen.findByRole('heading', { name: /el análisis terminó/i }, { timeout: 5000 });
    await waitFor(() => expect(document.activeElement).toBe(firstGateHeading));
    await user.click(screen.getByRole('button', { name: 'Editar predicción' }));
    expect(await screen.findByRole('heading', { name: 'Tu hipótesis antes del cálculo' })).toBeTruthy();
    expect((screen.getByRole('spinbutton', { name: 'Magnitud estimada' }) as HTMLInputElement).value).toBe('12500000');
    await user.click(screen.getByRole('button', { name: /continuar al análisis/i }));
    expect(await screen.findByRole('heading', { name: /el análisis terminó/i }, { timeout: 5000 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Revelar y comparar' }));
    const summary = await screen.findByRole('region', { name: 'Resumen global de resultados' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(screen.getByText('Tu predicción frente al resultado')).toBeTruthy();
    expect(screen.getByText(/Signo esperado: Negativo/)).toBeTruthy();
    expect(screen.getByLabelText('Estado del modelo').textContent).toBe('2:1:1:true');

    await user.click(screen.getByRole('button', { name: 'Modo completo test' }));
    await user.click(screen.getByRole('button', { name: 'Modo aula test' }));
    expect(screen.getByLabelText('Estado del modelo').textContent).toBe('2:1:1:true');
    expect(screen.getByLabelText('Predicciones base').textContent).toBe('{"M1":{"moment":12.5}}');
    expect(screen.getByText('Tu predicción frente al resultado')).toBeTruthy();
  }, 10_000);

  it.skip('legacy English prediction gate retired by Aula vNext', async () => {
    const user = userEvent.setup();
    const project = createSimpleBeamExercise();
    project.settings.language = 'en';
    renderResults(project);

    expect(screen.getByRole('heading', { name: 'Your hypothesis before solving' })).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Expected sign' }), 'positive');
    await user.click(screen.getByRole('button', { name: 'Continue to analysis' }));
    expect(await screen.findByRole('heading', { name: 'Analysis is complete. Decide when to view the solution.' }, { timeout: 5000 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reveal and compare' }));
    expect(await screen.findByText('Your prediction compared with the result')).toBeTruthy();
    expect(screen.getByText('Global summary')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compare cases' })).toBeTruthy();
    expect(screen.queryByText('Resumen global')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hide results' })).toBeTruthy();
  }, 10_000);

  it.skip('legacy failed-analysis prediction gate retired by Aula vNext', async () => {
    const user = userEvent.setup();
    const project = createSimpleBeamExercise();
    project.settings.calculationMode = 'complete';
    project.nodes.push(
      { id: 'N3', x: 0, y: 3, support: { type: 'none' } },
      { id: 'N4', x: 3, y: 3, support: { type: 'none' } },
    );
    project.members.push({ ...project.members[0], id: 'M2', i: 'N3', j: 'N4' });
    renderResults(project);

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    expect(await screen.findByText('Estructura inestable o mecanismo', {}, { timeout: 5000 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Modo aula test' }));
    expect(await screen.findByRole('heading', { name: 'Tu hipótesis antes del cálculo' })).toBeTruthy();
    expect(screen.queryByText('Estructura inestable o mecanismo')).toBeNull();
  }, 10_000);

  it('shows analysis and the same result families in Aula without using legacy predictions', async () => {
    const user = userEvent.setup();
    const project = createSimpleBeamExercise();
    renderResults(project);

    expect(screen.queryByText(/hipótesis antes del cálculo/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    expect(screen.getByRole('tab', { name: 'Deformada' })).toBeTruthy();
    // Aula ve exactamente las mismas familias residentes y los mismos
    // lanzadores densos que el modo completo: mismo análisis, misma
    // arquitectura, ninguna vista propia.
    const launchers = screen.getByRole('group', { name: 'Datos densos' });
    for (const view of ['Reacciones', 'Influencia', 'Aprender']) {
      expect(within(launchers).getByRole('button', { name: view })).toBeTruthy();
    }
    expect(screen.getByLabelText('Predicciones base').textContent).toBe('{}');

    const modelState = screen.getByLabelText('Estado del modelo').textContent;
    await user.click(screen.getByRole('button', { name: 'Modo completo test' }));
    await user.click(screen.getByRole('button', { name: 'Modo aula test' }));
    expect(screen.getByLabelText('Estado del modelo').textContent).toBe(modelState);
    expect(within(screen.getByRole('group', { name: 'Datos densos' })).getByRole('button', { name: 'Aprender' })).toBeTruthy();
  }, 10_000);

  it('keeps a failed analysis visible when switching into Aula', async () => {
    const user = userEvent.setup();
    const project = createSimpleBeamExercise();
    project.settings.calculationMode = 'complete';
    project.nodes.push(
      { id: 'N3', x: 0, y: 3, support: { type: 'none' } },
      { id: 'N4', x: 3, y: 3, support: { type: 'none' } },
    );
    project.members.push({ ...project.members[0], id: 'M2', i: 'N3', j: 'N4' });
    renderResults(project);

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    expect(await screen.findByText(/Estructura inestable o mecanismo/, {}, { timeout: 5000 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Modo aula test' }));
    expect(screen.getByText(/Estructura inestable o mecanismo/)).toBeTruthy();
    expect(screen.queryByText(/hipótesis antes del cálculo/i)).toBeNull();
  }, 10_000);

});

// The governing reliability cause (D-14 · CRI-95) moved to the TopBar's
// `AnalysisStatus` in CRI-100 — state and reliability are chrome-owned now, not
// a Results surface. See `src/features/topbar/AnalysisStatus.test.tsx`.
