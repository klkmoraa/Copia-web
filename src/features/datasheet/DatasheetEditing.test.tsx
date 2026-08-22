// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cellAt, focusedCell, pasteInto, renderDatasheet } from './datasheetTestHarness';

/**
 * Contrato de escritura del datasheet.
 *
 * Lo que se demuestra aquí es lo único que hace segura una hoja editable:
 *
 * 1. Un cambio simple se aplica al historial normal del proyecto, y una sola
 *    deshecha lo revierte.
 * 2. Un cambio múltiple o un pegado no escriben nada hasta que se aplican, y
 *    entonces entran **enteros** como una única entrada de historial.
 * 3. Un solo valor inválido bloquea el plan completo. No existe la escritura
 *    parcial.
 */

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const review = () => screen.getByRole('region', { name: 'Revisión de cambios' });
const queryReview = () => screen.queryByRole('region', { name: 'Revisión de cambios' });

describe('edición en la celda', () => {
  it('abre el editor con Intro sobre una celda que se edita en su sitio', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(await screen.findByRole('textbox', { name: 'X de N1' })).toBeTruthy();
  });

  it('un solo cambio se aplica al confirmar, sin pedir revisión', async () => {
    const { user, currentProject } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowRight}{F2}');
    const input = await screen.findByRole('textbox', { name: 'X de N1' });
    await user.clear(input);
    await user.type(input, '3{Enter}');
    await waitFor(() => expect(currentProject().nodes[0].x).toBe(3));
    expect(queryReview()).toBeNull();
  });

  it('una sola deshecha revierte el cambio simple', async () => {
    const { user, currentProject, undo } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowRight}{F2}');
    const input = await screen.findByRole('textbox', { name: 'X de N1' });
    await user.clear(input);
    await user.type(input, '3{Enter}');
    await waitFor(() => expect(currentProject().nodes[0].x).toBe(3));
    undo();
    await waitFor(() => expect(currentProject().nodes[0].x).toBe(0));
  });

  it('Escape cancela la celda sin tocar el modelo', async () => {
    const { user, currentProject } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowRight}{F2}');
    const input = await screen.findByRole('textbox', { name: 'X de N1' });
    await user.clear(input);
    await user.type(input, '3{Escape}');
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'X de N1' })).toBeNull());
    expect(currentProject().nodes[0].x).toBe(0);
    expect(queryReview()).toBeNull();
  });

  it('devuelve el foco a la celda al cerrar el editor', async () => {
    const { user } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowRight}');
    const cell = focusedCell();
    await user.keyboard('{F2}');
    await screen.findByRole('textbox', { name: 'X de N1' });
    await user.keyboard('{Escape}');
    // Sin esto la rejilla se queda sin su única parada de tabulación.
    await waitFor(() => expect(document.activeElement).toBe(cell));
  });

  it('un valor inválido no escribe y pide revisión con su motivo', async () => {
    const { user, currentProject } = await renderDatasheet();
    focusedCell().focus();
    await user.keyboard('{ArrowRight}{F2}');
    const input = await screen.findByRole('textbox', { name: 'X de N1' });
    await user.clear(input);
    await user.type(input, 'dos{Enter}');
    expect(within(await screen.findByRole('region', { name: 'Revisión de cambios' }))
      .getByText('N1: «dos» no es un número.')).toBeTruthy();
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('edita un enumerado con un desplegable y aplica al elegir', async () => {
    const { user, currentProject } = await renderDatasheet();
    // Columna 4 de nudos: Apoyo. Se pulsa para mover el foco de la rejilla,
    // que es lo que F2 consulta.
    await user.click(cellAt('N2', 3));
    await user.keyboard('{F2}');
    const select = await screen.findByRole('combobox', { name: 'Apoyo de N2' });
    await user.selectOptions(select, 'pin');
    await waitFor(() => expect(currentProject().nodes[1].support.type).toBe('pin'));
  });

  it('marca la celda pendiente sin escribirla', async () => {
    const { user, currentProject } = await renderDatasheet();
    focusedCell().focus();
    // Dos celdas seguidas: la segunda ya no puede aplicarse sola.
    await user.keyboard('{ArrowRight}{F2}');
    await user.clear(await screen.findByRole('textbox', { name: 'X de N1' }));
    await user.type(screen.getByRole('textbox', { name: 'X de N1' }), 'dos{Enter}');
    await screen.findByRole('region', { name: 'Revisión de cambios' });
    expect(cellAt('N1', 1).getAttribute('data-pending')).toBe('true');
    expect(currentProject().nodes[0].x).toBe(0);
  });
});

describe('revisión de un cambio múltiple', () => {
  it('un pegado no escribe hasta que se aplica', async () => {
    const { user, currentProject } = await renderDatasheet();
    await pasteInto(user, cellAt('N1', 1), '1\t2\n3\t4');
    await screen.findByRole('region', { name: 'Revisión de cambios' });
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('enseña qué fila cambia y en qué campo', async () => {
    const { user } = await renderDatasheet();
    await pasteInto(user, cellAt('N1', 1), '1\t2');
    const panel = await screen.findByRole('region', { name: 'Revisión de cambios' });
    // Dos celdas de la misma fila: N1 aparece una vez por cambio.
    expect(within(panel).getAllByText('N1')).toHaveLength(2);
    expect(within(panel).getByText('X')).toBeTruthy();
    expect(within(panel).getByText('Y')).toBeTruthy();
  });

  it('aplica el bloque entero y una sola deshecha lo revierte', async () => {
    const { user, currentProject, undo } = await renderDatasheet();
    await pasteInto(user, cellAt('N1', 1), '1\t2\n3\t4');
    await screen.findByRole('region', { name: 'Revisión de cambios' });
    await user.click(within(review()).getByRole('button', { name: 'Aplicar todo' }));
    await waitFor(() => expect(currentProject().nodes[0]).toMatchObject({ x: 1, y: 2 }));
    expect(currentProject().nodes[1]).toMatchObject({ x: 3, y: 4 });

    // Cuatro celdas, una entrada de historial: la operación es atómica.
    undo();
    await waitFor(() => expect(currentProject().nodes[0]).toMatchObject({ x: 0, y: 0 }));
    expect(currentProject().nodes[1]).toMatchObject({ x: 0, y: 4 });
  });

  it('cancelar no escribe nada y cierra la revisión', async () => {
    const { user, currentProject } = await renderDatasheet();
    await pasteInto(user, cellAt('N1', 1), '1\t2\n3\t4');
    await screen.findByRole('region', { name: 'Revisión de cambios' });
    await user.click(within(review()).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(queryReview()).toBeNull());
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('un solo valor inválido bloquea el bloque entero', async () => {
    const { user, currentProject } = await renderDatasheet();
    await pasteInto(user, cellAt('N1', 1), '1\t2\ntres\t4');
    const panel = await screen.findByRole('region', { name: 'Revisión de cambios' });
    expect(within(panel).getByRole('button', { name: 'Aplicar todo' }).hasAttribute('disabled')).toBe(true);
    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('cuenta lo que el pegado descartó en vez de callarlo', async () => {
    const { user } = await renderDatasheet();
    // Cinco líneas sobre una tabla de tres nudos: dos caen fuera.
    await pasteInto(user, cellAt('N1', 1), '1\n2\n3\n4\n5');
    const panel = await screen.findByRole('region', { name: 'Revisión de cambios' });
    expect(within(panel).getByText(/2 celdas caen fuera de la tabla/)).toBeTruthy();
  });

  it('cuenta lo que cae sobre una columna que no se edita', async () => {
    const { user } = await renderDatasheet();
    // Ancla en el id, que es identidad.
    await pasteInto(user, cellAt('N1', 0), 'X1\t9');
    const panel = await screen.findByRole('region', { name: 'Revisión de cambios' });
    expect(within(panel).getByText(/1 sobre columnas que no se editan/)).toBeTruthy();
  });

  it('avisa de los nudos coincidentes sin fusionarlos', async () => {
    const { user, currentProject } = await renderDatasheet();
    // N1 a (0, 4), donde ya está N2.
    await pasteInto(user, cellAt('N1', 1), '0\t4');
    const panel = await screen.findByRole('region', { name: 'Revisión de cambios' });
    expect(within(panel).getByText(/N1, N2/)).toBeTruthy();
    await user.click(within(panel).getByRole('button', { name: 'Aplicar todo' }));
    // Avisar no es fusionar: la hoja no repara topología.
    await waitFor(() => expect(currentProject().nodes[0].y).toBe(4));
    expect(currentProject().nodes).toHaveLength(3);
  });

  it('pega sobre la tabla de cargas resolviendo la familia de cada fila', async () => {
    const { user, currentProject } = await renderDatasheet({ entity: 'loads' });
    // Columna 5 de cargas: Fx, que sólo existe en la nodal.
    await pasteInto(user, cellAt('NL1', 4), '7\n8');
    const panel = await screen.findByRole('region', { name: 'Revisión de cambios' });
    expect(within(panel).getByText(/1 sobre columnas que no se editan/)).toBeTruthy();
    await user.click(within(panel).getByRole('button', { name: 'Aplicar todo' }));
    await waitFor(() => expect(currentProject().nodalLoads[0].fx).toBe(7));
  });
});
