// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { emitWorkspaceCommand, onWorkspaceCommand } from '../workspace/workspaceCommands';
import { ShellCompositionContext } from '../workspace/useShellComposition';
import type { ShellClass } from '../workspace/shellComposition';
import { ToolRail } from './ToolRail';

const ActiveToolStatus = () => {
  const { activeTool } = useProject();
  return <output aria-label="herramienta activa">{activeTool}</output>;
};

/** Hace de barra inferior: la hoja de herramientas se pide por comando y
 *  devuelve el foco a quien la abrió, sea cual sea el componente. */
const PaletteOpener = () => (
  <button type="button" onClick={() => emitWorkspaceCommand('open-tool-palette')}>abrir herramientas</button>
);

const SelectionSetter = () => {
  const { setSelection } = useProject();
  return <button type="button" onClick={() => setSelection({ kind: 'node', id: 'N1' })}>seleccionar nodo</button>;
};

/** La forma del riel la decide `shellClass` (CRI-98): se fija explícito por
 * prueba en vez de depender del viewport por defecto de jsdom. */
const renderToolRail = (shellClass: ShellClass = 'X2') => render(
  <ShellCompositionContext.Provider value={{ shellClass, phone: shellClass === 'K0' }}>
    <ProjectProvider>
      <ToolRail />
      <PaletteOpener />
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
    // Trece herramientas del registro más «Generar estructura», que no es una
    // herramienta de lienzo pero sí una acción de creación con su mismo botón.
    expect(container.querySelectorAll('.desktop-tool-list .sc-tool-button.is-compact')).toHaveLength(14);
    expect(container.querySelector('[data-tool-id="pointLoad"]')?.getAttribute('aria-keyshortcuts')).toBe('P');
    expect(container.querySelector('[data-tool-id="delete"]')?.getAttribute('aria-keyshortcuts')).toBe('Delete Backspace');
  });

  it('groups every desktop tool by intention without losing actions', () => {
    renderToolRail();

    expect(within(screen.getByRole('group', { name: /navegar/i })).getAllByRole('button')).toHaveLength(3);
    // Nudo, barra y apoyo, más el generador de estructuras.
    expect(within(screen.getByRole('group', { name: /^crear$/i })).getAllByRole('button')).toHaveLength(4);
    expect(within(screen.getByRole('group', { name: /^cargas$/i })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('group', { name: /anotar e inspeccionar/i })).getAllByRole('button')).toHaveLength(2);
    expect(within(screen.getByRole('group', { name: /^editar$/i })).getAllByRole('button')).toHaveLength(2);
    // Las doce del registro, UNA vez. Antes eran dieciséis: las cuatro
    // herramientas `primary` se renderizaban dos veces —en la lista de
    // escritorio y en el dock de seis ranuras de Compact— y ese dock ya no
    // existe: en teléfono la barra inferior enseña la herramienta activa en una
    // sola ranura y el catálogo vive en la hoja.
    expect(document.querySelectorAll('[data-tool-id]')).toHaveLength(12);
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

  it('offers the contextual structural editor from Edit only with a selection', async () => {
    const user = userEvent.setup();
    const openEditor = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-structural-edit', openEditor);
    render(
      <ShellCompositionContext.Provider value={{ shellClass: 'X2', phone: false }}>
        <ProjectProvider>
          <ToolRail />
          <SelectionSetter />
        </ProjectProvider>
      </ShellCompositionContext.Provider>,
    );

    expect(screen.queryByRole('button', { name: /editar selección/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
    await user.click(screen.getByRole('button', { name: /editar selección/i }));

    expect(openEditor).toHaveBeenCalledOnce();
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

  it('reaches the structure generator from the compact tool sheet', async () => {
    const user = userEvent.setup();
    const openGenerator = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-structure-generator', openGenerator);
    render(
      <ShellCompositionContext.Provider value={{ shellClass: 'X2', phone: false }}>
        <ProjectProvider>
          <div className="app-shell"><ToolRail /><PaletteOpener /></div>
        </ProjectProvider>
      </ShellCompositionContext.Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'abrir herramientas' }));

    const command = document.querySelector<HTMLButtonElement>('.mobile-tool-palette [data-structure-generator-command]');
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

  /* Una sola hoja de herramientas. Antes eran dos —«Cargas» y «Más»— y las
     cuatro herramientas `primary` no estaban en ninguna: sólo existían como
     botones del dock de seis ranuras. Al pasar ese dock a UNA ranura que enseña
     la herramienta activa, la hoja tiene que ser el catálogo entero o habría
     herramientas inalcanzables en teléfono. */
  it('lists the whole catalogue in one sheet and selects a point load', async () => {
    const user = userEvent.setup();
    const { container } = renderToolRail();
    const opener = screen.getByRole('button', { name: 'abrir herramientas' });

    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: /herramientas de modelado/i });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const menu = screen.getByRole('menu', { name: /herramientas de modelado/i });
    expect(container.contains(menu)).toBe(false);
    // Las trece del registro: ninguna se queda fuera de la única hoja.
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(12);
    expect(within(menu).getByRole('menuitemradio', { name: /^seleccionar\./i })).toBeTruthy();
    expect(within(menu).getByRole('menuitemradio', { name: /^nodo\./i })).toBeTruthy();

    await user.click(within(menu).getByRole('menuitemradio', { name: /carga puntual/i }));

    expect(screen.getByLabelText('herramienta activa').textContent).toBe('pointLoad');
    expect(screen.queryByRole('menu', { name: /herramientas de modelado/i })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('returns focus when the touch sheet closes through its backdrop', async () => {
    const user = userEvent.setup();
    renderToolRail();
    const opener = screen.getByRole('button', { name: 'abrir herramientas' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: /herramientas/i })).toBeTruthy();

    const backdrop = document.querySelector<HTMLElement>('.mobile-tool-sheet-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.pointerDown(backdrop as HTMLElement);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /herramientas/i })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('groups every tool of the catalogue and returns focus to its opener after Escape', async () => {
    const user = userEvent.setup();
    renderToolRail();
    const opener = screen.getByRole('button', { name: 'abrir herramientas' });

    await user.click(opener);

    const toolMenu = screen.getByRole('menu', { name: /herramientas de modelado/i });
    const menu = within(toolMenu);
    expect(within(menu.getByRole('group', { name: /navegar/i })).getAllByRole('menuitemradio')).toHaveLength(2);
    expect(within(menu.getByRole('group', { name: /^crear$/i })).getAllByRole('menuitemradio')).toHaveLength(3);
    expect(within(menu.getByRole('group', { name: /^cargas$/i })).getAllByRole('menuitemradio')).toHaveLength(3);
    expect(within(menu.getByRole('group', { name: /anotar e inspeccionar/i })).getAllByRole('menuitemradio')).toHaveLength(2);
    expect(within(menu.getByRole('group', { name: /^editar$/i })).getAllByRole('menuitemradio')).toHaveLength(2);
    const first = menu.getByRole('menuitemradio', { name: /^seleccionar\./i });
    expect(menu.getByRole('menuitemradio', { name: /^cota\./i })).toBeTruthy();
    expect(menu.getByRole('menuitemradio', { name: /^dividir miembro\./i })).toBeTruthy();
    expect(menu.getByRole('menuitemradio', { name: /^corte\./i })).toBeTruthy();
    expect(menu.getByRole('menuitemradio', { name: /^eliminar\./i })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(first));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: /herramientas de modelado/i })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('opens Buscar comandos from Navegar on mobile without leaving the tool sheet behind', async () => {
    const user = userEvent.setup();
    const openPalette = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-command-palette', openPalette);
    renderToolRail();
    const opener = screen.getByRole('button', { name: 'abrir herramientas' });
    await user.click(opener);

    const navigate = within(screen.getByRole('menu', { name: /herramientas de modelado/i }))
      .getByRole('group', { name: /navegar/i });
    await user.click(within(navigate).getByRole('menuitem', { name: /abrir la paleta de comandos/i }));

    expect(openPalette).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: /herramientas de modelado/i })).toBeNull();
    unsubscribe();
  });

  it('closes the tool sheet before opening Edit and restores the canvas app from inert state', async () => {
    const user = userEvent.setup();
    const openEditor = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-structural-edit', openEditor);
    render(
      <ShellCompositionContext.Provider value={{ shellClass: 'X2', phone: false }}>
        <ProjectProvider>
          <div className="app-shell"><ToolRail /><PaletteOpener /><SelectionSetter /></div>
        </ProjectProvider>
      </ShellCompositionContext.Provider>,
    );
    await user.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
    await user.click(screen.getByRole('button', { name: 'abrir herramientas' }));
    expect(document.querySelector<HTMLElement>('.app-shell')?.inert).toBe(true);

    const sheet = document.querySelector<HTMLElement>('.mobile-tool-palette');
    expect(sheet).toBeTruthy();
    const editSelection = sheet?.querySelector<HTMLButtonElement>('[data-structural-edit-command]');
    expect(editSelection).toBeTruthy();
    await user.click(editSelection!);
    await waitFor(() => expect(document.querySelector('.mobile-tool-palette')).toBeNull());
    await waitFor(() => expect(document.querySelector<HTMLElement>('.app-shell')?.inert).toBe(false));
    await waitFor(() => expect(openEditor).toHaveBeenCalledOnce());
    unsubscribe();
  });
});
