// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { ToolBar } from './ToolBar';

const ActiveToolStatus = () => {
  const { activeTool } = useProject();
  return <output aria-label="herramienta activa">{activeTool}</output>;
};

const renderToolBar = () => render(
  <ProjectProvider>
    <ToolBar />
    <ActiveToolStatus />
  </ProjectProvider>,
);

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ToolBar mobile action sheets', () => {
  it('offers an explicit compact desktop rail without changing tool identity', () => {
    const { container } = render(
      <ProjectProvider>
        <ToolBar compact />
        <ActiveToolStatus />
      </ProjectProvider>,
    );
    expect(container.querySelector('[data-tool-rail="compact"]')).toBeTruthy();
    expect(container.querySelectorAll('.desktop-tool-list .sc-tool-button.is-compact')).toHaveLength(12);
    expect(container.querySelector('[data-tool-id="pointLoad"]')?.getAttribute('aria-keyshortcuts')).toBe('P');
    expect(container.querySelector('[data-tool-id="delete"]')?.getAttribute('aria-keyshortcuts')).toBe('Delete Backspace');
  });

  it('groups every desktop tool by intention without losing actions', () => {
    renderToolBar();

    expect(within(screen.getByRole('group', { name: /navegar/i })).getAllByRole('button')).toHaveLength(2);
    expect(within(screen.getByRole('group', { name: /^crear$/i })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('group', { name: /^cargas$/i })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('group', { name: /anotar e inspeccionar/i })).getAllByRole('button')).toHaveLength(2);
    expect(within(screen.getByRole('group', { name: /^editar$/i })).getAllByRole('button')).toHaveLength(2);
    expect(document.querySelectorAll('[data-tool-id]')).toHaveLength(16);
  });

  it('opens the portaled load sheet and selects a point load', async () => {
    const user = userEvent.setup();
    const { container } = renderToolBar();
    const loadButton = screen.getByRole('button', { name: /herramientas de carga/i });

    await user.click(loadButton);

    const dialog = screen.getByRole('dialog', { name: /carga/i });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const loadMenu = screen.getByRole('menu', { name: /añadir carga/i });
    expect(container.contains(loadMenu)).toBe(false);
    expect(loadButton.getAttribute('aria-expanded')).toBe('true');

    await user.click(within(loadMenu).getByRole('menuitemradio', { name: /carga puntual/i }));

    expect(screen.getByLabelText('herramienta activa').textContent).toBe('pointLoad');
    expect(screen.queryByRole('menu', { name: /añadir carga/i })).toBeNull();
    expect(loadButton.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(loadButton));
  });

  it('returns focus when the touch sheet closes through its backdrop', async () => {
    const user = userEvent.setup();
    renderToolBar();
    const moreButton = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-group')].at(-1) as HTMLButtonElement;
    await user.click(moreButton);
    expect(screen.getByRole('dialog', { name: /herramientas/i })).toBeTruthy();

    const backdrop = document.querySelector<HTMLElement>('.mobile-tool-sheet-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.pointerDown(backdrop as HTMLElement);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /herramientas/i })).toBeNull());
    expect(document.activeElement).toBe(moreButton);
  });

  it('shows every additional tool and returns focus to Más after Escape', async () => {
    const user = userEvent.setup();
    renderToolBar();
    const moreButton = screen.getByRole('button', { name: /más herramientas/i });

    await user.click(moreButton);

    const moreMenu = screen.getByRole('menu', { name: /más herramientas/i });
    const menu = within(moreMenu);
    expect(within(menu.getByRole('group', { name: /navegar/i })).getAllByRole('menuitemradio')).toHaveLength(1);
    expect(within(menu.getByRole('group', { name: /anotar e inspeccionar/i })).getAllByRole('menuitemradio')).toHaveLength(2);
    expect(within(menu.getByRole('group', { name: /^editar$/i })).getAllByRole('menuitemradio')).toHaveLength(2);
    const pan = menu.getByRole('menuitemradio', { name: /^desplazar\./i });
    expect(menu.getByRole('menuitemradio', { name: /^cota\./i })).toBeTruthy();
    expect(menu.getByRole('menuitemradio', { name: /^dividir miembro\./i })).toBeTruthy();
    expect(menu.getByRole('menuitemradio', { name: /^corte\./i })).toBeTruthy();
    expect(menu.getByRole('menuitemradio', { name: /^eliminar\./i })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(pan));

    const dialog = screen.getByRole('dialog', { name: /herramientas/i });
    const close = within(dialog).getByRole('button', { name: 'Cerrar' });
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(close);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(menu.getByRole('menuitemradio', { name: /^eliminar\./i }));
    await user.tab();
    expect(document.activeElement).toBe(close);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: /más herramientas/i })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(moreButton));
  });
});
