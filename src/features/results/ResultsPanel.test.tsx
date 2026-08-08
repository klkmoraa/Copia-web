// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject, createHibbelerStyleDiagramPractice } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { createSimpleBeamExercise } from '../../education/exerciseTemplates';
import { ClassroomSessionProvider, useClassroomSession } from '../../store/ClassroomSessionContext';
import { formatSignificant } from '../../utils/numberFormat';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { ProjectModel } from '../../types';
import { ResultsPanel } from './ResultsPanel';

const RESULTS_MODE_STORAGE_KEY = 'structureCo.results.mode.v1';

const mockMatchMedia = (viewport: boolean | 'phone' = false) => vi.fn().mockImplementation((query: string) => ({
  matches: query === '(max-width: 1023px)'
    ? viewport === true || viewport === 'phone'
    : query === '(max-width: 700px)' && viewport === 'phone',
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
  const selectionLabel = selection?.kind === 'member' || selection?.kind === 'node'
    ? `${selection.kind}:${selection.id}`
    : selection?.kind ?? 'none';
  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    <output aria-label="Pestaña activa">{resultTab}</output>
    <output aria-label="Selección actual">{selectionLabel}</output>
    <output aria-label="Cursor de resultados">{resultCursor ? `${resultCursor.memberId}:${resultCursor.x}:${resultCursor.pinned}` : 'none'}</output>
    <ClassroomDiagnostics />
    <ResultsPanel />
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
    value: mockMatchMedia(),
  });
  window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
});

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = mockMatchMedia();
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

  it('announces the accessible fallback while the influence workspace loads on demand', async () => {
    const user = userEvent.setup();
    renderResults();
    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });

    fireEvent.click(screen.getByRole('tab', { name: 'Influencia' }));

    expect(screen.getByRole('status', { name: 'Cargando línea de influencia' })).toBeTruthy();
    expect(await screen.findByRole(
      'region',
      { name: 'Línea de influencia y tren de ejes' },
      { timeout: 5_000 },
    )).toBeTruthy();
  }, 10_000);

  it('organizes tabs by purpose and supports keyboard plus persistent panel modes', async () => {
    const user = userEvent.setup();
    renderResults();

    const panel = screen.getByRole('region', { name: 'Resultados del análisis' });
    expect(screen.getByText('Centro analítico')).toBeTruthy();
    for (const family of ['Estado', 'Esfuerzos', 'Forma', 'Avanzado', 'Comprender', 'Avisos']) {
      expect(screen.getAllByText(family).length).toBeGreaterThan(0);
    }
    const moment = screen.getByRole('tab', { name: 'Momento' });
    expect(moment.getAttribute('aria-selected')).toBe('true');
    expect(moment.getAttribute('aria-describedby')).toBe('result-family-forces');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('result-tab-moment');

    moment.focus();
    await user.keyboard('{ArrowRight}');
    const influence = screen.getByRole('tab', { name: 'Influencia' });
    await waitFor(() => expect(document.activeElement).toBe(influence));
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Resumen' }).getAttribute('aria-selected')).toBe('true');

    const focusButton = screen.getByRole('button', { name: 'Enfocar' });
    await user.click(focusButton);
    await waitFor(() => expect(panel.getAttribute('data-results-mode')).toBe('focused'));
    expect(document.activeElement).toBe(panel);
    expect(localStorage.getItem(RESULTS_MODE_STORAGE_KEY)).toBe('focused');
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

    await user.click(screen.getByRole('button', { name: /M máx\. absoluto/i }));
    expect(screen.getByLabelText('Selección actual').textContent).toBe('member:AB');
    expect(screen.getByLabelText('Pestaña activa').textContent).toBe('moment');
    expect(screen.getByLabelText('Cursor de resultados').textContent).toBe('AB:3:true');
    expect(screen.getByText('Miembro AB')).toBeTruthy();
  }, 10_000);

  it('announces keyboard chart readings and exposes complete advanced tab semantics', async () => {
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

    await user.click(screen.getByRole('tab', { name: 'Aprender' }));
    const modelTab = screen.getByRole('tab', { name: 'Modelo' });
    const dofTab = screen.getByRole('tab', { name: 'GDL' });
    modelTab.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(document.activeElement).toBe(dofTab));
    expect(dofTab.getAttribute('tabindex')).toBe('0');
    expect(dofTab.getAttribute('aria-controls')).toBe('education-stage-panel-dofs');
    const dofPanel = screen.getByRole('tabpanel', { name: 'GDL' });
    expect(dofPanel.getAttribute('aria-labelledby')).toBe('education-stage-tab-dofs');

    const locateNode = within(dofPanel).getAllByRole('button', { name: /Mostrar nodo/i })[0];
    locateNode.focus();
    await user.keyboard('[Space]');
    expect(screen.getByLabelText('Selección actual').textContent).toMatch(/^node:/);
  }, 10_000);

  it('lets an unpinned chart Escape close the mobile results sheet', async () => {
    const user = userEvent.setup();
    window.matchMedia = mockMatchMedia(true);
    renderResults();

    const toggle = screen.getByRole('button', { name: 'Resultados' });
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    const chart = await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    const graph = within(chart).getByRole('img', { name: /diagrama .* del miembro/i });
    expect(screen.getByRole('dialog', { name: /Resultados del an/ })).toBeTruthy();
    expect(screen.getByLabelText('Cursor de resultados').textContent).toBe('none');

    graph.focus();
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Resultados del an/ })).toBeNull());
    expect(document.activeElement).toBe(toggle);
  }, 10_000);

  it('links reaction rows back to the selected model node', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    await user.click(screen.getByRole('tab', { name: 'Reacciones' }));
    const table = screen.getByRole('table', { name: /Reacciones y desplazamientos nodales/i });
    const node = table.querySelector<HTMLButtonElement>('button');
    expect(node).toBeTruthy();
    await user.click(node as HTMLButtonElement);

    const nodeId = node?.textContent?.split('·')[0]?.trim();
    expect(screen.getByLabelText('Selección actual').textContent).toBe(`node:${nodeId}`);
    expect(node?.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(`Nodo ${nodeId}`)).toBeTruthy();
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
    for (const family of ['State', 'Forces', 'Shape', 'Advanced', 'Understand', 'Issues']) {
      expect(screen.getAllByText(family).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('group', { name: 'Results panel size' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compact' })).toBeTruthy();
    expect(screen.getByText('Ready to analyze').getAttribute('role')).toBe('status');
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

    await user.click(screen.getByRole('tab', { name: 'Learn' }));
    const explorer = screen.getByRole('region', { name: 'Stiffness-method explorer' });
    expect(within(explorer).getByText('Real data from the current analysis · not a parallel calculation')).toBeTruthy();
    expect(within(explorer).getByRole('tablist', { name: 'Method stages' })).toBeTruthy();
    expect(within(explorer).getByText('Nodes')).toBeTruthy();
    expect(within(explorer).getByText('Members')).toBeTruthy();
    expect(within(explorer).getByText('Constraints')).toBeTruthy();
    expect(within(explorer).getByText(/The method assembles each local matrix into K/)).toBeTruthy();
    expect(explorer.textContent).not.toMatch(/Explorador|Datos reales|Etapas del método|Nodos|Miembros|Restricciones/);
    await user.click(screen.getByRole('tab', { name: 'DOFs' }));
    expect(screen.getAllByRole('button', { name: /Show node/i }).length).toBeGreaterThan(0);
    expect(explorer.textContent).not.toMatch(/Estado|Residuo|Prescrito|Restringido|Libre/);

    await user.click(within(explorer).getByRole('tab', { name: 'Element' }));
    expect(within(explorer).getByRole('combobox', { name: 'Member' })).toBeTruthy();
    expect(within(explorer).getByRole('combobox', { name: 'Matrix' })).toBeTruthy();
    expect(within(explorer).getByText('Flexible length')).toBeTruthy();
    expect(within(explorer).getByText('Released DOFs')).toBeTruthy();
    expect(within(explorer).getByText('Local stiffness kˡ')).toBeTruthy();
    expect(explorer.textContent).not.toMatch(/Matriz|con liberaciones|Transformación|Aporte global|L flexible|GDL liberados|Rigidez/);

    await user.click(within(explorer).getByRole('tab', { name: 'Assembly' }));
    expect(within(explorer).getByText('Detail')).toBeTruthy();
    expect(within(explorer).getByText('Strain energy')).toBeTruthy();
    expect(within(explorer).getByText('Global stiffness matrix K')).toBeTruthy();
    expect(within(explorer).getByText('Constraint matrix C')).toBeTruthy();
    expect(explorer.textContent).not.toMatch(/Detalle|Energía|Matriz global|Restricciones C|Vista parcial/);

    await user.click(within(explorer).getByRole('tab', { name: 'Verification' }));
    expect(within(explorer).getByText('Algebraic equilibrium')).toBeTruthy();
    expect(within(explorer).getByText('Compatibility')).toBeTruthy();
    expect(within(explorer).getByText('Linear solver')).toBeTruthy();
    expect(within(explorer).getByText('Error bound')).toBeTruthy();
    expect(explorer.textContent).not.toMatch(/Equilibrio algebraico|Compatibilidad|Solver lineal|refinamientos|Cota de error|dígitos confiables/);

    expect(screen.getByText('Procedure linked to analysis')).toBeTruthy();
    const detailLevel = screen.getByRole('group', { name: 'Detail level' });
    expect(within(detailLevel).getByRole('button', { name: 'Summary' })).toBeTruthy();
    expect(within(detailLevel).getByRole('button', { name: 'Step by step' })).toBeTruthy();
    expect(within(detailLevel).getByRole('button', { name: 'Full' })).toBeTruthy();
    expect(screen.getAllByText(/\d+ equations/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: 'Summary' }));
    expect(await screen.findByRole('region', { name: 'Global results summary' })).toBeTruthy();
  }, 10_000);

  it('uses a modal tablet sheet with focus trap, Escape return, and safe focused-mode normalization', async () => {
    const user = userEvent.setup();
    window.matchMedia = mockMatchMedia(true);
    localStorage.setItem(RESULTS_MODE_STORAGE_KEY, 'focused');
    renderResults();

    const toggle = screen.getByRole('button', { name: 'Resultados' });
    const panel = document.querySelector<HTMLElement>('.results-panel') as HTMLElement;
    expect(panel).toBeTruthy();
    await waitFor(() => expect(panel.getAttribute('data-results-mode')).toBe('expanded'));
    await user.click(toggle);
    const sheet = await screen.findByRole('dialog', { name: 'Resultados del análisis' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(toggle));

    sheet.focus();
    await user.tab();
    expect(document.activeElement).toBe(toggle);
    sheet.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Analizar estructura' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Resultados del análisis' })).toBeNull());
    expect(document.activeElement).toBe(toggle);
  });

  it('keeps the phone results sheet modeless so the canvas remains reachable', async () => {
    const user = userEvent.setup();
    window.matchMedia = mockMatchMedia('phone');
    const { container } = renderResults();
    const canvasHost = document.createElement('div');
    canvasHost.className = 'canvas-host';
    canvasHost.tabIndex = 0;
    container.prepend(canvasHost);

    const toggle = screen.getByRole('button', { name: 'Resultados' });
    await user.click(toggle);

    const sheet = await screen.findByRole('region', { name: /Resultados del an/ });
    expect(screen.queryByRole('dialog', { name: /Resultados del an/ })).toBeNull();
    expect(sheet.getAttribute('aria-modal')).toBeNull();
    expect(sheet.getAttribute('data-canvas-interactive')).toBe('true');
    expect(canvasHost.inert).not.toBe(true);
    expect(canvasHost.getAttribute('aria-hidden')).toBeNull();
    expect(document.querySelector('.results-sheet-backdrop')).toBeNull();

    canvasHost.focus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(sheet.classList.contains('mobile-collapsed')).toBe(true));
    expect(document.activeElement).toBe(toggle);
  });

  it('leaves Escape to a visible modal above the modeless phone results', async () => {
    const user = userEvent.setup();
    window.matchMedia = mockMatchMedia('phone');
    renderResults();
    await user.click(screen.getByRole('button', { name: 'Resultados' }));
    const sheet = await screen.findByRole('region', { name: /Resultados del an/ });
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

  it('requests a fresh phone canvas fit when a new analysis expands the results', async () => {
    const user = userEvent.setup();
    window.matchMedia = mockMatchMedia('phone');
    const onFitCanvas = vi.fn();
    window.addEventListener('structureco:fit-canvas', onFitCanvas);

    try {
      renderResults();
      await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
      await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
      await waitFor(() => expect(onFitCanvas).toHaveBeenCalledOnce());
    } finally {
      window.removeEventListener('structureco:fit-canvas', onFitCanvas);
    }
  }, 10_000);

  it('keeps native learning summaries inside the mobile focus loop', async () => {
    const user = userEvent.setup();
    window.matchMedia = mockMatchMedia(true);
    renderResults();

    await user.click(screen.getByRole('button', { name: 'Resultados' }));
    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    await user.click(screen.getByRole('tab', { name: 'Aprender' }));
    const sheet = screen.getByRole('dialog', { name: 'Resultados del análisis' });
    const summaries = [...sheet.querySelectorAll<HTMLElement>('summary')];
    expect(summaries.length).toBeGreaterThan(0);
    summaries[summaries.length - 1].focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Aprender ·/ }));
  }, 10_000);

  it('falls back to the results launcher when the remembered Inspector control becomes hidden', async () => {
    const user = userEvent.setup();
    window.matchMedia = mockMatchMedia(true);
    renderResults();
    const hiddenInspector = document.createElement('aside');
    hiddenInspector.className = 'inspector-panel mobile-open';
    const inspectorControl = document.createElement('button');
    inspectorControl.textContent = 'Control del Inspector';
    hiddenInspector.append(inspectorControl);
    document.body.append(hiddenInspector);
    inspectorControl.focus();

    window.dispatchEvent(new CustomEvent('structureco:expand-mobile-results'));
    await screen.findByRole('dialog', { name: /Resultados del an/ });
    hiddenInspector.classList.remove('mobile-open');
    await user.keyboard('{Escape}');

    const launcher = screen.getByRole('button', { name: 'Resultados' });
    await waitFor(() => expect(document.activeElement).toBe(launcher));
    hiddenInspector.remove();
  });

  it('requires a base-unit prediction, compares real results, and preserves the attempt across units and modes', async () => {
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

  it('keeps the complete classroom prediction and reveal flow in English', async () => {
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

  it('opens prediction instead of blocking on a failed analysis inherited from Complete mode', async () => {
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

  it('substitutes the real member properties into the element stiffness terms', async () => {
    const user = userEvent.setup();
    const project = createHibbelerStyleDiagramPractice();
    renderResults(project);

    await user.click(screen.getByRole('button', { name: 'Analizar estructura' }));
    await screen.findByTestId('diagram-chart', {}, { timeout: 5000 });
    await user.click(screen.getByRole('tab', { name: 'Aprender' }));
    await user.click(screen.getByRole('tab', { name: 'Elemento' }));

    const panel = await screen.findByRole('tabpanel', { name: 'Elemento' }, { timeout: 5000 });
    const block = panel.querySelector<HTMLElement>('.education-numerical-substitution');
    expect(block).toBeTruthy();

    // The substitution is only worth showing if it is the member's own data: the E, A and I
    // on screen must be the ones stored in the model, not a template's placeholder.
    const member = project.members[0];
    const inputs = [...block!.querySelectorAll('.education-substitution-inputs > div')]
      .map((entry) => entry.textContent ?? '');
    expect(inputs.some((text) => text.startsWith('E'))).toBe(true);
    expect(inputs.some((text) => text.startsWith('A'))).toBe(true);
    expect(inputs.some((text) => text.startsWith('I'))).toBe(true);

    // The substituted expression must carry the member's stored values verbatim — that is the
    // difference between explaining the matrix and printing a second, unrelated calculation.
    const rows = [...block!.querySelectorAll('tbody tr')].filter((row) => !row.classList.contains('substitution-group'));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const axialRow = rows[0];
    expect(axialRow.querySelector('code')?.textContent).toBe('k₁₁');
    const axialSubstitution = axialRow.querySelector('.substitution-values')?.textContent ?? '';
    expect(axialSubstitution).toContain(formatSignificant(member.E, 4, 'inspector'));
    expect(axialSubstitution).toContain(formatSignificant(member.A, 4, 'inspector'));
    expect(axialRow.querySelector('.substitution-result')?.textContent).toMatch(/kN\/m$/);

    // Both group labels from the proposal must be present, so the reader can tell which
    // terms belong to axial behaviour and which to bending.
    expect(within(block!).getByText('Rigidez axial')).toBeTruthy();
    expect(within(block!).getByText('Rigidez a flexión')).toBeTruthy();
  }, 15_000);
});
