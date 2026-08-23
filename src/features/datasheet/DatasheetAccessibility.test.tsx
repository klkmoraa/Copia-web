// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type { Selection } from '../../types';
import { DatasheetContent } from './DatasheetContent';
import { createDatasheetProject } from './datasheetFixtures';

/**
 * Contrato de teclado y accesibilidad del datasheet.
 *
 * Dos cosas se comprueban aquí que ninguna otra prueba puede comprobar:
 *
 * 1. **El foco no es la selección.** Recorrer la tabla con las flechas no puede
 *    ir cambiando el objeto seleccionado en el lienzo.
 * 2. **Intentar editar abre el editor o dice por qué no.** Ni se ofrece una
 *    edición que no existe ni se ignora la pulsación en silencio: una celda
 *    `inline` abre su editor, y una `identity`, `derived` o `panel` explica en
 *    la región viva por qué no se escribe ahí.
 */

afterEach(cleanup);
beforeEach(() => localStorage.clear());


const Harness = ({ onSelection }: { onSelection: (selection: Selection) => void }) => {
  const { project, replaceProject } = useProjectModel();
  const { selection } = useWorkspaceUI();
  onSelection(selection);
  if (project.id !== 'datasheet-fixture') {
    return <button type="button" onClick={() => replaceProject(createDatasheetProject())}>sembrar</button>;
  }
  return <DatasheetContent />;
};

const renderDatasheet = async () => {
  const user = userEvent.setup({ delay: null });
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

const focusedCell = () => document.querySelector('[data-datasheet-focused="true"]') as HTMLElement;
/** La región viva del datasheet es la única que declara `aria-live` explícito. */
const liveMessage = () => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

describe('datasheet accessibility', () => {
  it('exposes the grid with its real dimensions', async () => {
    await renderDatasheet();
    const grid = screen.getByRole('grid');
    // Tres nudos más la fila de cabecera; siete columnas de nudo.
    expect(grid.getAttribute('aria-rowcount')).toBe('4');
    expect(grid.getAttribute('aria-colcount')).toBe('7');
  });

  it('is a single tab stop with a roving focus inside', async () => {
    await renderDatasheet();
    const cells = screen.getByRole('grid').querySelectorAll('tbody [tabindex="0"]');
    expect(cells).toHaveLength(1);
  });

  it('moves the focus with the arrows without touching the selection', async () => {
    const { user, selectionRef } = await renderDatasheet();
    focusedCell().focus();
    expect(focusedCell().textContent).toBe('N1');

    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(focusedCell().textContent).toBe('N2'));
    // Lo esencial: recorrer no selecciona.
    expect(selectionRef.current).toBeNull();

    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(focusedCell().getAttribute('aria-colindex')).toBe('2'));
    expect(selectionRef.current).toBeNull();
  });

  it('stops at the edges instead of wrapping', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowUp}{ArrowLeft}');
    await waitFor(() => expect(focusedCell().textContent).toBe('N1'));
    expect(focusedCell().getAttribute('aria-colindex')).toBe('1');
  });

  it('takes Home and End to the row edges, and Ctrl to the table edges', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{End}');
    await waitFor(() => expect(focusedCell().getAttribute('aria-colindex')).toBe('7'));
    await user.keyboard('{Home}');
    await waitFor(() => expect(focusedCell().getAttribute('aria-colindex')).toBe('1'));

    await user.keyboard('{Control>}{End}{/Control}');
    await waitFor(() => {
      const row = focusedCell().closest('tr');
      expect(row?.getAttribute('aria-rowindex')).toBe('4');
    });
    await user.keyboard('{Control>}{Home}{/Control}');
    await waitFor(() => expect(focusedCell().textContent).toBe('N1'));
  });

  it('selects with Enter and adds to the selection with Ctrl+Space', async () => {
    const { user, selectionRef } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(selectionRef.current).toEqual({ kind: 'node', id: 'N1' }));

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Control>}[Space]{/Control}');
    await waitFor(() => expect(selectionRef.current).toEqual({
      kind: 'multi', nodeIds: ['N1', 'N2'], memberIds: [],
    }));
  });

  it('clears the selection with Escape', async () => {
    const { user, selectionRef } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(selectionRef.current).not.toBeNull());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(selectionRef.current).toBeNull());
  });

  it('explains why an identity cell will never be editable', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{F2}');
    await waitFor(() => expect(liveMessage()).toBe('ID es una identidad estructural y no se edita.'));
  });

  it('explains that a derived cell is changed at its source', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    // Columna 5 de nudos: Restricciones.
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{F2}');
    await waitFor(() => expect(liveMessage()).toBe('Restricciones se calcula del modelo; cambia el dato de origen.'));
  });

  it('opens the editor with F2 on a cell that is edited in place', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    // Columna 2 de nudos: X, que se edita en la propia celda.
    await user.keyboard('{ArrowRight}{F2}');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'X de N1' })).toBeTruthy());
  });

  it('tells a panel-only cell where it is edited instead of staying silent', async () => {
    const { user } = await renderDatasheet();
    await user.click(screen.getByRole('button', { name: /Barras/ }));
    focusedCell().focus();
    // Columna 12 de barras: Liberaciones, que escribe dos campos a la vez.
    await user.keyboard('{Control>}{End}{/Control}{ArrowLeft}{F2}');
    await waitFor(() => expect(liveMessage()).toBe('Liberaciones se edita en el panel de la derecha.'));
  });

  it('marks read-only exactly the cells that will never be editable', async () => {
    await renderDatasheet();
    const body = screen.getByRole('grid').querySelector('tbody') as HTMLElement;
    const cells = [...body.querySelectorAll('th, td')];
    expect(cells.length).toBeGreaterThan(0);
    // `aria-readonly` sigue exactamente al contrato de editabilidad: anunciarlo
    // en una celda que sí se edita mandaría al lector de pantalla al sitio
    // equivocado, y callarlo en una identidad prometería una edición imposible.
    for (const cell of cells) {
      const editability = cell.getAttribute('data-editability');
      const closed = editability === 'identity' || editability === 'derived';
      expect(cell.getAttribute('aria-readonly'), editability ?? '').toBe(closed ? 'true' : 'false');
    }
  });

  it('announces the pending count in a live region', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowRight}{F2}');
    const input = await screen.findByRole('textbox', { name: 'X de N1' });
    await user.clear(input);
    await user.type(input, 'dos{Enter}');
    // El recuento no puede vivir sólo en un color de celda.
    const statuses = [...document.querySelectorAll('[role="status"]')].map((node) => node.textContent);
    await waitFor(() => expect(statuses.join(' ')).toBeTruthy());
    expect(screen.getByRole('region', { name: 'Revisión de cambios' })).toBeTruthy();
  });

  it('labels the cell editor with its column and its row', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowRight}{F2}');
    // Un editor rotulado sólo «X» no dice de qué nudo es.
    expect(await screen.findByRole('textbox', { name: 'X de N1' })).toBeTruthy();
  });

  it('reports the sort state of every column', async () => {
    await renderDatasheet();
    const headers = within(screen.getByRole('grid')).getAllByRole('columnheader');
    expect(headers.every((header) => header.hasAttribute('aria-sort'))).toBe(true);
  });
});
