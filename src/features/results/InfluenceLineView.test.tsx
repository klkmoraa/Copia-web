// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { InfluenceLineView } from './InfluenceLineView';

const InfluenceHarness = () => {
  const { project } = useProject();
  return <InfluenceLineView project={project} selection={{ kind: 'member', id: 'M2' }} />;
};

const renderInfluence = () => {
  const project = createDefaultProject();
  project.settings.language = 'en';
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  return render(<ProjectProvider><InfluenceHarness /></ProjectProvider>);
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Influence line presentation', () => {
  it('presents the complete influence and axle-train workflow in English', async () => {
    const user = userEvent.setup();
    renderInfluence();

    const region = screen.getByRole('region', { name: 'Influence line and axle train' });
    expect(within(region).getAllByText('Influence line').length).toBeGreaterThan(0);
    expect(within(region).getByText('Vertical unit load · validated cubic reconstruction · extrema without sweeping')).toBeTruthy();
    expect(within(region).getByRole('group', { name: 'Influence-line response' })).toBeTruthy();
    expect(within(region).getByText('Target response')).toBeTruthy();
    expect(within(region).getByText('Target member')).toBeTruthy();
    expect(within(region).getByText('Cut limit')).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Use selection (1)' })).toBeTruthy();
    expect(within(region).getByRole('spinbutton', { name: 'Cut coordinate' })).toBeTruthy();
    expect(within(region).getByText('1 member · M2')).toBeTruthy();
    expect(within(region).getByRole('tablist', { name: 'Influence view' })).toBeTruthy();
    expect(within(region).getByText('Define the section and path, then select Calculate.')).toBeTruthy();

    await user.click(within(region).getByRole('button', { name: 'Calculate' }));

    const lineChart = await within(region).findByRole(
      'img',
      { name: /Influence line M at M2, x =/ },
      { timeout: 10_000 },
    );
    expect(lineChart.getAttribute('aria-label')).toContain('Influence line M at M2');
    expect(within(region).getByText('Polynomial closure')).toBeTruthy();
    expect(within(region).getByText('Estimated precision')).toBeTruthy();
    expect(within(region).getByText('Exact roots')).toBeTruthy();
    expect(within(region).getByText('Numeric fit and solver details')).toBeTruthy();
    expect(within(region).getByText('Move the pointer · tap to pin')).toBeTruthy();
    expect(within(region).getByText('Exact polynomial cursor · jumps preserve their one-sided limits')).toBeTruthy();

    await user.click(within(region).getByRole('tab', { name: 'Axle train' }));

    expect(within(region).getByText('Local editor · 2/4 axles')).toBeTruthy();
    expect(within(region).getByRole('spinbutton', { name: 'Impact factor' })).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Add axle' })).toBeTruthy();
    expect(within(region).getByRole('columnheader', { name: 'Action' })).toBeTruthy();
    expect(within(region).getByRole('spinbutton', { name: 'Axle load 1' })).toBeTruthy();
    expect(within(region).getByRole('spinbutton', { name: 'Axle offset 1' })).toBeTruthy();
    expect(within(region).getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
    expect(within(region).getByRole('img', { name: 'Exact axle-train response for M at M2' })).toBeTruthy();
    expect(within(region).getByText('Exact axle positions at the extrema')).toBeTruthy();
    expect(region.textContent).not.toMatch(
      /Esfuerzo objetivo|Miembro objetivo|Límite en el corte|Usar selección|Coordenada del corte|Calcular|Tren de ejes|Quitar|Cierre polinómico|Precisión estimada/,
    );
  }, 15_000);

  it('announces local validation errors in English without changing domain validation', async () => {
    const user = userEvent.setup();
    renderInfluence();
    const region = screen.getByRole('region', { name: 'Influence line and axle train' });

    await user.click(within(region).getByRole('tab', { name: 'Axle train' }));
    const impact = within(region).getByRole('spinbutton', { name: 'Impact factor' });
    fireEvent.change(impact, { target: { value: '0.9' } });
    expect((impact as HTMLInputElement).valueAsNumber).toBe(0.9);
    await user.click(within(region).getByRole('button', { name: 'Calculate' }));

    const alert = within(region).getByRole('alert');
    await waitFor(() => expect(alert.textContent).toContain('The impact factor must be greater than or equal to 1.'));
    expect(within(alert).getByText('The calculation could not be completed')).toBeTruthy();
  });
});
