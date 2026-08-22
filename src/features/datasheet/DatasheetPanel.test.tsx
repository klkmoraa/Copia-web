// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type { Selection } from '../../types';
import { workspaceCommandEventName } from '../workspace/workspaceCommands';
import { DatasheetPanel } from './DatasheetPanel';
import { createDatasheetProject } from './datasheetFixtures';
import { useState } from 'react';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const setup = () => userEvent.setup({ delay: null });

/**
 * Estable a propósito: un `onOpenChange` en línea cambia de identidad en cada
 * render y el efecto de foco del Drawer volvería a llevarse el foco a su botón
 * de cerrar. `WorkspaceShell` pasa el `setDatasheetOpen` del estado.
 */
const keepOpen = () => {};

/**
 * Siembra el proyecto de la fixture y expone la selección viva del workspace.
 *
 * La prueba lee la selección del **store**, no de la tabla: eso es exactamente
 * lo que hay que demostrar, que el datasheet no lleva selección propia.
 */
const Harness = ({ onSelection }: { onSelection: (selection: Selection) => void }) => {
  const { project, replaceProject } = useProjectModel();
  const { selection } = useWorkspaceUI();
  onSelection(selection);
  if (project.id !== 'datasheet-fixture') {
    return <button type="button" onClick={() => replaceProject(createDatasheetProject())}>sembrar</button>;
  }
  return <DatasheetPanel open onOpenChange={keepOpen} />;
};

const renderDatasheet = async () => {
  const user = setup();
  const selectionRef = { current: null as Selection };
  render(
    <ProjectProvider>
      <Harness onSelection={(selection) => { selectionRef.current = selection; }} />
    </ProjectProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'sembrar' }));
  await screen.findByRole('grid');
  return { user, selectionRef };
};

const rowFor = (id: string) => screen.getByRole('rowheader', { name: id }).closest('tr') as HTMLElement;

describe('datasheet panel', () => {
  it('retains a real unapplied draft while the broker suspends and resumes the surface', async () => {
    const user = setup();
    const ContinuityHarness = () => {
      const { project, replaceProject } = useProjectModel();
      const [open, setOpen] = useState(true);
      if (project.id !== 'datasheet-fixture') {
        return <button type="button" onClick={() => replaceProject(createDatasheetProject())}>sembrar</button>;
      }
      return <>
        <button type="button" onClick={() => setOpen(false)}>suspender</button>
        <button type="button" onClick={() => setOpen(true)}>reanudar</button>
        <output aria-label="X N1 almacenada">{project.nodes.find((node) => node.id === 'N1')?.x}</output>
        <DatasheetPanel open={open} onOpenChange={setOpen} presentation="drawer" />
      </>;
    };
    render(<ProjectProvider><ContinuityHarness /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: 'sembrar' }));
    const xField = await screen.findByLabelText(/^X \(m\)/);
    await user.clear(xField);
    await user.type(xField, '12.75');
    expect(screen.getByLabelText('X N1 almacenada').textContent).toBe('0');

    await user.click(screen.getByRole('button', { name: 'suspender' }));
    expect(screen.queryByRole('dialog', { name: /Hoja de datos/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'reanudar' }));

    expect((await screen.findByLabelText(/^X \(m\)/) as HTMLInputElement).value).toBe('12.75');
    expect(screen.getByLabelText('X N1 almacenada').textContent).toBe('0');
  });

  it('projects the model without holding a copy of it', async () => {
    await renderDatasheet();
    const grid = screen.getByRole('grid');
    // Cabecera + tres nudos.
    expect(within(grid).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('rowheader', { name: 'N1' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'N3' })).toBeTruthy();
  });

  it('shows units in the column header and values converted to them', async () => {
    await renderDatasheet();
    expect(screen.getByRole('columnheader', { name: /^X \(m\)/ })).toBeTruthy();
    expect(within(rowFor('N3')).getByText('6')).toBeTruthy();
  });

  it('switches to members and shows their own columns', async () => {
    const { user } = await renderDatasheet();
    await user.click(screen.getByRole('button', { name: /Barras/ }));
    expect(screen.getByRole('columnheader', { name: /^Nudo i/ })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'M2' })).toBeTruthy();
  });

  it('narrows the table with the search box', async () => {
    const { user } = await renderDatasheet();
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en la tabla' }), 'N3');
    await waitFor(() => expect(within(screen.getByRole('grid')).getAllByRole('row')).toHaveLength(2));
    expect(screen.getByText('1 de 3')).toBeTruthy();
  });

  it('narrows the table with a facet filter', async () => {
    const { user } = await renderDatasheet();
    await user.click(screen.getByRole('button', { name: /Empotrado/ }));
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'N2' })).toBeNull());
    expect(screen.getByRole('rowheader', { name: 'N1' })).toBeTruthy();
  });

  it('sorts a numeric column as numbers and returns to model order on the third click', async () => {
    const { user } = await renderDatasheet();
    const header = screen.getByRole('button', { name: /^X \(m\)/ });
    await user.click(header);
    await waitFor(() => expect(screen.getByRole('columnheader', { name: /^X \(m\)/ }).getAttribute('aria-sort')).toBe('ascending'));
    await user.click(header);
    expect(screen.getByRole('columnheader', { name: /^X \(m\)/ }).getAttribute('aria-sort')).toBe('descending');
    await user.click(header);
    expect(screen.getByRole('columnheader', { name: /^X \(m\)/ }).getAttribute('aria-sort')).toBe('none');
  });

  it('writes the row selection into the shared workspace selection', async () => {
    const { user, selectionRef } = await renderDatasheet();
    await user.click(within(rowFor('N2')).getByRole('rowheader'));
    await waitFor(() => expect(selectionRef.current).toEqual({ kind: 'node', id: 'N2' }));
  });

  it('builds a multi selection that the existing bulk edit can consume', async () => {
    const { user, selectionRef } = await renderDatasheet();
    await user.click(within(rowFor('N1')).getByRole('rowheader'));
    await user.keyboard('{Control>}');
    await user.click(within(rowFor('N3')).getByRole('rowheader'));
    await user.keyboard('{/Control}');
    await waitFor(() => expect(selectionRef.current).toEqual({
      kind: 'multi', nodeIds: ['N1', 'N3'], memberIds: [],
    }));
  });

  it('marks the selected row without marking it as focused', async () => {
    const { user } = await renderDatasheet();
    await user.click(within(rowFor('N2')).getByRole('rowheader'));
    await waitFor(() => expect(rowFor('N2').getAttribute('aria-selected')).toBe('true'));
    expect(rowFor('N1').getAttribute('aria-selected')).toBe('false');
  });

  it('focuses the object on the canvas and degrades to peek instead of closing (CRI-102)', async () => {
    const user = setup();
    const onOpenChange = vi.fn();
    const onPeek = vi.fn();
    const focused = vi.fn();
    window.addEventListener(workspaceCommandEventName('focus-object'), focused);
    const Seeded = () => {
      const { project, replaceProject } = useProjectModel();
      if (project.id !== 'datasheet-fixture') {
        return <button type="button" onClick={() => replaceProject(createDatasheetProject())}>sembrar</button>;
      }
      return <DatasheetPanel open onOpenChange={onOpenChange} onPeek={onPeek} />;
    };
    render(<ProjectProvider><Seeded /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: 'sembrar' }));
    await screen.findByRole('grid');

    await user.click(screen.getByRole('button', { name: 'Enfocar' }));

    await waitFor(() => expect(focused).toHaveBeenCalled());
    const detail = (focused.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ kind: 'node', id: 'N1' });
    // Localizar degrada a peek: nunca cierra la hoja (D-11).
    expect(onPeek).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    window.removeEventListener(workspaceCommandEventName('focus-object'), focused);
  });

  it('survives peek and restore with an unapplied cell draft neither committed nor discarded (CRI-102 / T-INV-8)', async () => {
    const user = setup();
    const PeekHarness = () => {
      const { project, replaceProject } = useProjectModel();
      const [extent, setExtent] = useState<'default' | 'peek'>('default');
      if (project.id !== 'datasheet-fixture') {
        return <button type="button" onClick={() => replaceProject(createDatasheetProject())}>sembrar</button>;
      }
      return <>
        <output aria-label="X N1 almacenada">{project.nodes.find((node) => node.id === 'N1')?.x}</output>
        <DatasheetPanel
          open
          onOpenChange={keepOpen}
          extent={extent}
          onPeek={() => setExtent('peek')}
          onRestore={() => setExtent('default')}
        />
      </>;
    };
    render(<ProjectProvider><PeekHarness /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: 'sembrar' }));
    const xField = await screen.findByLabelText(/^X \(m\)/);
    await user.clear(xField);
    await user.type(xField, '12.75');
    expect(screen.getByLabelText('X N1 almacenada').textContent).toBe('0');

    await user.click(screen.getByRole('button', { name: 'Enfocar' }));
    // Degradado a peek: el campo con el borrador sigue montado, sólo inerte.
    // El Drawer se porta a `document.body`, no al `container` de la prueba.
    await waitFor(() => expect(document.body.querySelector('[data-surface-extent="peek"]')).toBeTruthy());
    const peekedField = document.body.querySelector<HTMLInputElement>('input[value="12.75"]');
    expect(peekedField).toBeTruthy();
    expect(peekedField?.closest('[inert]')).toBeTruthy();
    // Ni se aplicó ni se descartó: el modelo real no cambió.
    expect(screen.getByLabelText('X N1 almacenada').textContent).toBe('0');

    // El asa de peek es el único control de restaurar y es operable por teclado.
    await user.click(screen.getByRole('button', { name: /Restaurar hoja de datos/i }));
    expect((await screen.findByLabelText(/^X \(m\)/) as HTMLInputElement).value).toBe('12.75');
    expect(screen.getByLabelText('X N1 almacenada').textContent).toBe('0');
  });

  it('filters to the "selection only" facet without touching the canonical entity pipeline (D-11)', async () => {
    const { user } = await renderDatasheet();
    await user.click(within(rowFor('N2')).getByRole('rowheader'));
    await waitFor(() => expect(rowFor('N2').getAttribute('aria-selected')).toBe('true'));

    await user.click(screen.getByRole('button', { name: 'Sólo la selección' }));

    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'N1' })).toBeNull());
    expect(screen.getByRole('rowheader', { name: 'N2' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Sólo la selección' }));
    expect(screen.getByRole('rowheader', { name: 'N1' })).toBeTruthy();
  });

  it('offers a visual editor for the focused object', async () => {
    const { user } = await renderDatasheet();
    const context = screen.getByRole('complementary', { name: 'Detalle del objeto enfocado' });
    expect(within(context).getByRole('region', { name: 'Nodo' })).toBeTruthy();
    const supportCard = within(context).getByRole('region', { name: 'Apoyo' });
    // Las cargas del nudo siguen a la vista, pero se editan en su pestaña.
    expect(within(context).getByRole('region', { name: 'Carga' })).toBeTruthy();
    expect(within(context).getByLabelText(/^X \(m\)/)).toBeTruthy();
    // El rótulo «Apoyo» está en el título de la tarjeta y en su desplegable:
    // se busca el control dentro de la tarjeta, no en el panel entero.
    expect(within(supportCard).getByRole('combobox', { name: 'Apoyo' })).toBeTruthy();

    await user.click(within(screen.getByRole('group', { name: 'Tipo de objeto' })).getByRole('button', { name: /^Barras/ }));
    const memberContext = screen.getByRole('complementary', { name: 'Detalle del objeto enfocado' });
    expect(within(memberContext).getByRole('region', { name: 'Material' })).toBeTruthy();
    expect(within(memberContext).getByRole('region', { name: 'Sección' })).toBeTruthy();
    expect(within(memberContext).getByRole('region', { name: 'Liberaciones' })).toBeTruthy();
  });

  it('names the catalog section of a member and the equivalent one otherwise', async () => {
    const { user } = await renderDatasheet();
    await user.click(within(screen.getByRole('group', { name: 'Tipo de objeto' })).getByRole('button', { name: /^Barras/ }));
    const sectionCard = () => screen.getByRole('region', { name: 'Sección' });
    // El visor rotula el perfil; el desplegable lo ofrece como opción, así que
    // se afirma sobre el visor y no sobre cualquier aparición del nombre.
    expect(within(sectionCard()).getByTestId('section-viewer-2d').textContent).toContain('W12x26');

    await user.click(within(rowFor('M2')).getByRole('rowheader'));
    await waitFor(() => expect(within(sectionCard()).getByTestId('section-viewer-2d').textContent)
      .toContain('Rectangular equivalente'));
  });

  it('keeps the grid usable when nothing matches', async () => {
    const { user } = await renderDatasheet();
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en la tabla' }), 'zzzz');
    await waitFor(() => expect(screen.queryByRole('grid')).toBeNull());
    expect(screen.getByText('Ninguna fila coincide con la búsqueda y los filtros actuales.')).toBeTruthy();
  });
});
