// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHibbelerStyleDiagramPractice } from '../../data/defaultProject';
import { createSimpleBeamExercise } from '../../education/exerciseTemplates';
import { formatSignificant } from '../../utils/numberFormat';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { ProjectModel } from '../../types';
import { DenseResultsSurface } from './DenseResultsSurface';
import type { DenseResultView } from './denseResults';

/**
 * La superficie `dense` de Results (CRI-101).
 *
 * Lo que estas pruebas fijan es lo que hace que `dense` sea `dense`: se
 * **invoca** (no vive en el árbol hasta que alguien la pide), contiene las tres
 * vistas densas que salieron del panel, devuelve el foco al cerrarse, y dentro
 * de ella una tabla sigue siendo una tabla plana dentro de una tarjeta.
 */
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

const DenseHarness = ({
  initialView = 'reactions',
  presentation = 'drawer',
}: {
  initialView?: DenseResultView;
  presentation?: 'drawer' | 'fullscreen';
}) => {
  const { project, analysis, analyze, selection } = useProject();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DenseResultView>(initialView);
  const selectionLabel = selection?.kind === 'node' || selection?.kind === 'member'
    ? `${selection.kind}:${selection.id}`
    : selection?.kind ?? 'none';
  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    <output aria-label="Selección actual">{selectionLabel}</output>
    <output aria-label="Análisis">{analysis?.success === true ? 'ok' : 'none'}</output>
    <button type="button" onClick={() => analyze()}>Analizar</button>
    <button type="button" onClick={() => setOpen(true)}>Abrir datos densos</button>
    {/* Invocada: sin `open` no existe superficie en el documento. */}
    {open ? <DenseResultsSurface
      open
      view={view}
      onViewChange={setView}
      onOpenChange={setOpen}
      presentation={presentation}
    /> : null}
  </ClassroomSessionProvider>;
};

const renderDense = (
  project: ProjectModel = createHibbelerStyleDiagramPractice(),
  props: { initialView?: DenseResultView; presentation?: 'drawer' | 'fullscreen' } = {},
) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  return render(<ProjectProvider><DenseHarness {...props} /></ProjectProvider>);
};

const analyzeAndOpen = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Analizar' }));
  await waitFor(
    () => expect(screen.getByLabelText('Análisis').textContent).toBe('ok'),
    { timeout: 5_000 },
  );
  const launcher = screen.getByRole('button', { name: 'Abrir datos densos' });
  await user.click(launcher);
  return launcher;
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: stubMatchMedia() });
  window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
});

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = stubMatchMedia();
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 900 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Dense results surface', () => {
  it('is invoked rather than resident, and returns focus to its launcher when closed', async () => {
    const user = userEvent.setup();
    renderDense();

    expect(screen.queryByRole('dialog', { name: 'Datos densos' })).toBeNull();
    const launcher = await analyzeAndOpen(user);
    const surface = await screen.findByRole('dialog', { name: 'Datos densos' });
    expect(surface.getAttribute('aria-modal')).toBe('true');

    await user.click(within(surface).getByRole('button', { name: 'Cerrar datos densos' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Datos densos' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(launcher));
  }, 15_000);

  it('closes with Escape from the keyboard and gives the focus back', async () => {
    const user = userEvent.setup();
    renderDense();
    const launcher = await analyzeAndOpen(user);
    await screen.findByRole('dialog', { name: 'Datos densos' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Datos densos' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(launcher));
  }, 15_000);

  it('presents reactions as extreme cards over a flat table framed by a raised card', async () => {
    const user = userEvent.setup();
    renderDense();
    await analyzeAndOpen(user);
    const surface = await screen.findByRole('dialog', { name: 'Datos densos' });

    const cards = within(surface).getAllByRole('article');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      // Los cinco a la vez, y la materia siempre la misma.
      expect(card.getAttribute('data-level')).toBe('raised');
      expect(card.textContent).toMatch(/Posición/);
      expect(card.textContent).toMatch(/Fiabilidad/);
      expect(within(card).getByText('Explicar este valor')).toBeTruthy();
    }

    const table = within(surface).getByRole('table', { name: /Reacciones y desplazamientos nodales/i });
    const frame = table.closest('[data-level]');
    expect(frame?.getAttribute('data-level')).toBe('raised');
    // La tabla es el contenido plano de la tarjeta, nunca otra tarjeta.
    expect(table.closest('[data-level="raised"] [data-level="raised"]')).toBeNull();
    // Y ninguna fila dictamina: no hay check por fila.
    expect(table.querySelector('tbody svg')).toBeNull();

    const node = table.querySelector<HTMLButtonElement>('tbody button') as HTMLButtonElement;
    await user.click(node);
    expect(screen.getByLabelText('Selección actual').textContent).toBe(`node:${node.textContent?.split('·')[0]?.trim()}`);
  }, 15_000);

  it('keeps the influence workspace lazy and announces its loading fallback', async () => {
    const user = userEvent.setup();
    renderDense(createHibbelerStyleDiagramPractice(), { initialView: 'influence' });
    await analyzeAndOpen(user);

    expect(screen.getByRole('status', { name: 'Cargando línea de influencia' })).toBeTruthy();
    expect(await screen.findByRole(
      'region',
      { name: 'Línea de influencia y tren de ejes' },
      { timeout: 5_000 },
    )).toBeTruthy();
  }, 15_000);

  it('moves between dense views with the arrow keys', async () => {
    const user = userEvent.setup();
    renderDense();
    await analyzeAndOpen(user);
    const surface = await screen.findByRole('dialog', { name: 'Datos densos' });
    const tabs = within(surface).getByRole('tablist', { name: 'Vistas densas' });

    const reactions = within(tabs).getByRole('tab', { name: 'Reacciones' });
    reactions.focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(within(tabs).getByRole('tab', { name: 'Influencia' }).getAttribute('aria-selected')).toBe('true'));
    await user.keyboard('{End}');
    await waitFor(() => expect(within(tabs).getByRole('tab', { name: 'Aprender' }).getAttribute('aria-selected')).toBe('true'));
  }, 15_000);

  it('serves Aula the same analysis and the same understanding views', async () => {
    const user = userEvent.setup();
    renderDense(createSimpleBeamExercise(), { initialView: 'learn' });
    await analyzeAndOpen(user);
    const surface = await screen.findByRole('dialog', { name: 'Datos densos' });

    const levels = within(surface).getByRole('group', { name: 'Niveles pedagógicos' });
    expect(within(levels).getByRole('button', { name: 'Fundamentos' })).toBeTruthy();
    expect(within(levels).getByRole('button', { name: 'Procedimiento' })).toBeTruthy();
    await user.click(within(levels).getByRole('button', { name: 'Verificación' }));
    expect(within(surface).getByText(/Evidencia runtime:/)).toBeTruthy();
  }, 15_000);

  it('substitutes the real member properties into the element stiffness terms', async () => {
    const user = userEvent.setup();
    renderDense(createHibbelerStyleDiagramPractice(), { initialView: 'learn' });
    await analyzeAndOpen(user);
    const surface = await screen.findByRole('dialog', { name: 'Datos densos' });

    await user.click(await within(surface).findByRole('tab', { name: 'Elemento' }, { timeout: 5_000 }));
    const panel = await within(surface).findByRole('tabpanel', { name: 'Elemento' }, { timeout: 5_000 });
    const block = panel.querySelector<HTMLElement>('.education-numerical-substitution');
    expect(block).toBeTruthy();
    const member = createHibbelerStyleDiagramPractice().members[0];
    const rows = [...block!.querySelectorAll('tbody tr')].filter((row) => !row.classList.contains('substitution-group'));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const axialRow = rows[0];
    expect(axialRow.querySelector('code')?.textContent).toBe('k₁₁');
    const axialSubstitution = axialRow.querySelector('.substitution-values')?.textContent ?? '';
    expect(axialSubstitution).toContain(formatSignificant(member.E, 4, 'inspector'));
    expect(axialSubstitution).toContain(formatSignificant(member.A, 4, 'inspector'));
    expect(axialRow.querySelector('.substitution-result')?.textContent).toMatch(/kN\/m$/);
    expect(within(block!).getByText('Rigidez axial')).toBeTruthy();
    expect(within(block!).getByText('Rigidez a flexión')).toBeTruthy();
  }, 15_000);

  it('reads in English without leaving mixed labels behind', async () => {
    const user = userEvent.setup();
    const project = createHibbelerStyleDiagramPractice();
    project.settings.language = 'en';
    renderDense(project, { initialView: 'learn' });
    await analyzeAndOpen(user);
    const surface = await screen.findByRole('dialog', { name: 'Dense data' });

    const explorer = within(surface).getByRole('region', { name: 'Stiffness-method explorer' });
    expect(within(explorer).getByRole('tablist', { name: 'Method stages' })).toBeTruthy();
    expect(within(explorer).getByText('Nodes')).toBeTruthy();
    expect(within(explorer).getByText('Members')).toBeTruthy();
    expect(explorer.textContent).not.toMatch(/Explorador|Etapas del método|Nodos|Miembros|Restricciones/);
    expect(within(surface).getByText('Procedure linked to analysis')).toBeTruthy();
  }, 15_000);
});
