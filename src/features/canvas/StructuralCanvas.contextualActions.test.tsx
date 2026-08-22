// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { Selection } from '../../types';
import { createEditorLayerState } from './editorLayers';
import { StructuralCanvas } from './StructuralCanvas';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  if (!document.elementsFromPoint) Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [] });
});

beforeEach(() => {
  localStorage.clear();
  const project = createDefaultProject();
  const member = project.members.find((candidate) => candidate.id === 'M1');
  if (!member) throw new Error('The default fixture must contain M1.');
  member.materialId = 'steel-a36';
  member.materialOrigin = 'catalog';
  member.sectionId = 'w310x39';
  member.sectionOrigin = 'catalog';
  localStorage.setItem('structureCo.project', JSON.stringify(project));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const Harness = () => {
  const { project, setSelection } = useProject();
  const select = (selection: Selection) => setSelection(selection);
  return <>
    <output aria-label="project-model">{JSON.stringify(project)}</output>
    <button onClick={() => select({ kind: 'member', id: 'M1' })}>select-M1</button>
    <button onClick={() => select(null)}>clear-selection</button>
    <StructuralCanvas layers={createEditorLayerState()} dispatchLayers={() => undefined} />
  </>;
};

const renderCanvas = () => render(<ProjectProvider><Harness /></ProjectProvider>);
const model = () => JSON.parse(screen.getByLabelText('project-model').textContent ?? '{}') as ReturnType<typeof createDefaultProject>;
const contextualToolbar = () => screen.getByRole('toolbar', { name: 'Acciones de la selección' });

const touchTap = async (user: ReturnType<typeof userEvent.setup>, target: HTMLElement) => {
  fireEvent.pointerDown(target, { pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 });
  fireEvent.pointerUp(target, { pointerType: 'touch', isPrimary: true, button: 0, buttons: 0 });
  await user.click(target);
};

const openOverflow = async (user: ReturnType<typeof userEvent.setup>) => {
  await touchTap(user, within(contextualToolbar()).getByRole('button', { name: 'Más acciones' }));
  return screen.getByRole('menu', { name: 'Más acciones' });
};

describe('StructuralCanvas contextual-actions touch routes', () => {
  it('appears only from the live selection and opens structural editing through the existing command route', async () => {
    const user = userEvent.setup();
    renderCanvas();
    expect(screen.queryByRole('toolbar', { name: 'Acciones de la selección' })).toBeNull();

    await touchTap(user, screen.getByRole('button', { name: 'select-M1' }));
    expect(document.querySelector('[data-structural-edit-launcher]')).toBeNull();
    await touchTap(user, within(contextualToolbar()).getByRole('button', { name: 'Abrir editor estructural' }));
    expect(screen.getByRole('region', { name: /edición estructural/i })).toBeTruthy();

    await touchTap(user, screen.getByRole('button', { name: 'clear-selection' }));
    expect(screen.queryByRole('toolbar', { name: 'Acciones de la selección' })).toBeNull();
  });

  it('runs Copy, fallback Paste, Duplicate and Repeat by touch without using a keyboard', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) },
    });
    renderCanvas();
    await touchTap(user, screen.getByRole('button', { name: 'select-M1' }));

    let menu = await openOverflow(user);
    await touchTap(user, within(menu).getByRole('menuitem', { name: /Copiar/i }));
    expect(screen.getByRole('alert').textContent).toContain('Copia estructural lista');

    menu = await openOverflow(user);
    await touchTap(user, within(menu).getByRole('menuitem', { name: /Pegar/i }));
    await waitFor(() => expect(model().members).toHaveLength(4));
    const pasted = model().members.at(-1)!;
    expect(pasted).toMatchObject({
      materialId: 'steel-a36', materialOrigin: 'catalog', sectionId: 'w310x39', sectionOrigin: 'catalog',
    });
    expect(screen.getByRole('alert').textContent).toContain('copia interna');

    menu = await openOverflow(user);
    await touchTap(user, within(menu).getByRole('menuitem', { name: /Duplicar/i }));
    await touchTap(user, screen.getByRole('button', { name: /confirmar duplicado/i }));
    await waitFor(() => expect(model().members).toHaveLength(5));

    await touchTap(user, screen.getByRole('button', { name: 'select-M1' }));
    menu = await openOverflow(user);
    await touchTap(user, within(menu).getByRole('menuitem', { name: /Repetir/i }));
    expect(document.querySelector('[data-repeat-affordance="active"]')).toBeTruthy();
  });

  it('makes the existing in-app Paste fallback touch-reachable after Copy when readText is unavailable', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {} });
    renderCanvas();
    await touchTap(user, screen.getByRole('button', { name: 'select-M1' }));

    let menu = await openOverflow(user);
    expect(within(menu).queryByRole('menuitem', { name: /Pegar/i })).toBeNull();
    await touchTap(user, within(menu).getByRole('menuitem', { name: /Copiar/i }));

    menu = await openOverflow(user);
    await touchTap(user, within(menu).getByRole('menuitem', { name: /Pegar/i }));
    await waitFor(() => expect(model().members).toHaveLength(4));
    expect(model().members.at(-1)).toMatchObject({ materialId: 'steel-a36', sectionId: 'w310x39' });
  });

  it('opens the existing Datasheet command route from a touch action', async () => {
    const user = userEvent.setup();
    const opened = vi.fn();
    window.addEventListener('structureco:open-datasheet', opened);
    try {
      renderCanvas();
      await touchTap(user, screen.getByRole('button', { name: 'select-M1' }));
      const menu = await openOverflow(user);
      await touchTap(user, within(menu).getByRole('menuitem', { name: /Abrir hoja de datos/i }));
      expect(opened).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('structureco:open-datasheet', opened);
    }
  });
});
