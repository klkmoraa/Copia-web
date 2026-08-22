// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';
import { ShellCompositionContext } from '../workspace/useShellComposition';
import type { ShellClass } from '../workspace/shellComposition';
import { ToolRail } from './ToolRail';

const ActiveToolStatus = () => {
  const { activeTool } = useProject();
  return <output aria-label="herramienta activa">{activeTool}</output>;
};

/** La forma del riel la decide `shellClass` (CRI-98): se fija explícito por
 * prueba en vez de depender del viewport por defecto de jsdom. */
const renderToolRail = (shellClass: ShellClass = 'X2') => render(
  <ShellCompositionContext.Provider value={{ shellClass, phone: shellClass === 'K0' }}>
    <ProjectProvider>
      <ToolRail />
      <ActiveToolStatus />
    </ProjectProvider>
  </ShellCompositionContext.Provider>,
);

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ToolRail mobile action sheets', () => {
  it('offers an explicit compact desktop rail without changing tool identity', () => {
    const { container } = renderToolRail('M1');
    expect(container.querySelector('[data-tool-rail="compact"]')).toBeTruthy();
    // Diez herramientas del registro, más «Buscar comandos» y «Generar
    // estructura», que no son herramientas de lienzo pero comparten el
    // mismo botón. `pan` y `delete` ya no tienen botón propio.
    expect(container.querySelectorAll('.desktop-tool-list .sc-tool-button.is-compact')).toHaveLength(12);
    expect(container.querySelector('[data-tool-id="pointLoad"]')?.getAttribute('aria-keyshortcuts')).toBe('P');
    expect(container.querySelector('[data-tool-id="split"]')?.getAttribute('aria-keyshortcuts')).toBe('B');
  });

  it('groups every desktop tool by intention without losing actions', () => {
    renderToolRail();

    expect(within(screen.getByRole('group', { name: /navegar/i })).getAllByRole('button')).toHaveLength(2);
    // Nudo, barra, apoyo y dividir miembro, más el generador de estructuras.
    expect(within(screen.getByRole('group', { name: /^crear$/i })).getAllByRole('button')).toHaveLength(5);
    expect(within(screen.getByRole('group', { name: /^cargas$/i })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('group', { name: /^medir$/i })).getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: /^editar$/i })).toBeNull();
    expect(document.querySelectorAll('[data-tool-id]')).toHaveLength(14);
  });

  it('opens Buscar comandos from the Navegar group in the ToolRail', async () => {
    const user = userEvent.setup();
    const openPalette = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-command-palette', openPalette);
    renderToolRail();

    const navigate = screen.getByRole('group', { name: /navegar/i });
    const commandSearch = within(navigate).getByRole('button', { name: /abrir la paleta de comandos/i });
    expect(commandSearch.getAttribute('aria-keyshortcuts')).toContain('Control+K');
    await user.click(commandSearch);

    expect(openPalette).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('offers the structure generator from Create without needing a selection', async () => {
    const user = userEvent.setup();
    const openGenerator = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-structure-generator', openGenerator);
    renderToolRail();

    // Generar crea geometría en vez de transformar la que hay: no puede
    // depender de que algo esté seleccionado.
    const create = screen.getByRole('group', { name: /^crear$/i });
    await user.click(within(create).getByRole('button', { name: /generar estructura/i }));

    expect(openGenerator).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('reaches the structure generator from the compact Más sheet', async () => {
    const user = userEvent.setup();
    const openGenerator = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-structure-generator', openGenerator);
    render(
      <ShellCompositionContext.Provider value={{ shellClass: 'X2', phone: false }}>
        <ProjectProvider>
          <div className="app-shell"><ToolRail /></div>
        </ProjectProvider>
      </ShellCompositionContext.Provider>,
    );
    const moreButton = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-group')].at(-1);
    await user.click(moreButton!);

    const command = document.querySelector<HTMLButtonElement>('.mobile-tool-palette-more [data-structure-generator-command]');
    expect(command).toBeTruthy();
    await user.click(command!);

    // La hoja móvil difiere el comando un frame a propósito (`ToolRail.tsx`:
    // `openStructureGeneratorFromMobile`), para cerrarse y devolver la
    // inertness antes de que el generador tome el foco. Sin esperar ese frame
    // la aserción gana o pierde según lo cargado que venga el entorno.
    await waitFor(() => expect(openGenerator).toHaveBeenCalledOnce());
    // La inertness sí se restituye de forma síncrona al cerrar.
    expect(document.querySelector<HTMLElement>('.app-shell')?.inert).toBe(false);
    unsubscribe();
  });

  it('opens the portaled load sheet and selects a point load', async () => {
    const user = userEvent.setup();
    const { container } = renderToolRail();
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
    renderToolRail();
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
    renderToolRail();
    const moreButton = screen.getByRole('button', { name: /más herramientas/i });

    await user.click(moreButton);

    const moreMenu = screen.getByRole('menu', { name: /más herramientas/i });
    const menu = within(moreMenu);
    // «Navegar» sólo aporta «Buscar comandos» a esta hoja: `pan` ya no tiene
    // botón (el gesto y el atajo de teclado lo cubren).
    expect(within(menu.getByRole('group', { name: /navegar/i })).getAllByRole('menuitem')).toHaveLength(1);
    expect(within(menu.getByRole('group', { name: /^crear$/i })).getAllByRole('menuitemradio')).toHaveLength(1);
    expect(within(menu.getByRole('group', { name: /^medir$/i })).getAllByRole('menuitemradio')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: /^editar$/i })).toBeNull();
    const openPalette = menu.getByRole('menuitem', { name: /abrir la paleta de comandos/i });
    expect(menu.getByRole('menuitemradio', { name: /^dividir miembro\./i })).toBeTruthy();
    expect(menu.getByRole('menuitem', { name: /^generar estructura$/i })).toBeTruthy();
    expect(menu.getByRole('menuitemradio', { name: /^cota\./i })).toBeTruthy();
    const cut = menu.getByRole('menuitemradio', { name: /^corte\./i });
    await waitFor(() => expect(document.activeElement).toBe(openPalette));

    const dialog = screen.getByRole('dialog', { name: /herramientas/i });
    const close = within(dialog).getByRole('button', { name: 'Cerrar' });
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(close);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(cut);
    await user.tab();
    expect(document.activeElement).toBe(close);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: /más herramientas/i })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(moreButton));
  });

  it('opens Buscar comandos from Navegar on mobile without leaving the tool sheet behind', async () => {
    const user = userEvent.setup();
    const openPalette = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-command-palette', openPalette);
    renderToolRail();
    const moreButton = screen.getByRole('button', { name: /más herramientas/i });
    await user.click(moreButton);

    const navigate = within(screen.getByRole('menu', { name: /más herramientas/i }))
      .getByRole('group', { name: /navegar/i });
    await user.click(within(navigate).getByRole('menuitem', { name: /abrir la paleta de comandos/i }));

    expect(openPalette).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: /más herramientas/i })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(moreButton));
    unsubscribe();
  });

  it('closes Más before opening Generar and restores the canvas app from inert state', async () => {
    const user = userEvent.setup();
    const openGenerator = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-structure-generator', openGenerator);
    render(
      <ShellCompositionContext.Provider value={{ shellClass: 'X2', phone: false }}>
        <ProjectProvider>
          <div className="app-shell"><ToolRail /></div>
        </ProjectProvider>
      </ShellCompositionContext.Provider>,
    );
    const moreButton = [...document.querySelectorAll<HTMLButtonElement>('.mobile-tool-group')].at(-1);
    expect(moreButton).toBeTruthy();
    await user.click(moreButton!);
    expect(document.querySelector<HTMLElement>('.app-shell')?.inert).toBe(true);

    const moreSheet = document.querySelector<HTMLElement>('.mobile-tool-palette-more');
    expect(moreSheet).toBeTruthy();
    const generate = moreSheet?.querySelector<HTMLButtonElement>('[data-structure-generator-command]');
    expect(generate).toBeTruthy();
    await user.click(generate!);
    await waitFor(() => expect(document.querySelector('.mobile-tool-palette-more')).toBeNull());
    await waitFor(() => expect(document.querySelector<HTMLElement>('.app-shell')?.inert).toBe(false));
    await waitFor(() => expect(openGenerator).toHaveBeenCalledOnce());
    unsubscribe();
  });
});
