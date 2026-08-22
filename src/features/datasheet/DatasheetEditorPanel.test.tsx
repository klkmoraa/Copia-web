// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderDatasheet } from './datasheetTestHarness';

/**
 * Contrato de los editores visuales.
 *
 * Lo que se demuestra: cada preview dibuja el **modelo resultante**, no los
 * campos del formulario. Por eso el glifo del apoyo, la posición del nudo, la
 * forma de la sección y la flecha de la carga cambian mientras se edita, y
 * siguen coincidiendo con lo que se escribirá al aplicar.
 */

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const panel = () => screen.getByRole('complementary', { name: 'Detalle del objeto enfocado' });

describe('editores visuales', () => {
  it('mueve el nudo del preview al escribir X, sin tocar el modelo', async () => {
    const { user, currentProject } = await renderDatasheet();
    const x = within(panel()).getByLabelText(/^X \(m\)/);
    await user.clear(x);
    await user.type(x, '3');

    // El fantasma es la posición anterior; el nudo lleno, la del borrador.
    await waitFor(() => expect(screen.getByTestId('datasheet-node-preview-ghost')).toBeTruthy());
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('no dibuja fantasma mientras el nudo no se ha movido', async () => {
    await renderDatasheet();
    expect(screen.queryByTestId('datasheet-node-preview-ghost')).toBeNull();
  });

  it('cambia el glifo del apoyo conforme se edita', async () => {
    const { user } = await renderDatasheet();
    expect(screen.getByTestId('datasheet-support-preview').getAttribute('data-support')).toBe('fixed');
    await user.selectOptions(within(panel()).getByRole('combobox', { name: 'Apoyo' }), 'roller');
    await waitFor(() => expect(screen.getByTestId('datasheet-support-preview').getAttribute('data-support'))
      .toBe('roller'));
  });

  it('ofrece las restricciones sólo cuando el apoyo resultante las sostiene', async () => {
    const { user } = await renderDatasheet();
    expect(within(panel()).queryByRole('checkbox', { name: 'Rz' })).toBeNull();
    await user.selectOptions(within(panel()).getByRole('combobox', { name: 'Apoyo' }), 'custom');
    await waitFor(() => expect(within(panel()).getByRole('checkbox', { name: 'Rz' })).toBeTruthy());
  });

  it('dibuja la sección antes y después al elegir otro perfil', async () => {
    const { user } = await renderDatasheet({ entity: 'members' });
    expect(screen.getAllByTestId('section-viewer-2d')).toHaveLength(1);
    const select = within(screen.getByRole('region', { name: 'Sección' })).getByRole('combobox');
    await user.selectOptions(select, 'w10x33');
    await waitFor(() => expect(screen.getAllByTestId('section-viewer-2d')).toHaveLength(2));
  });

  it('el material personalizado abre E, G y densidad', async () => {
    const { user } = await renderDatasheet({ entity: 'members' });
    const card = () => screen.getByRole('region', { name: 'Material' });
    await user.click(within(card()).getByRole('radio', { name: 'Personalizado' }));
    expect(within(card()).getByLabelText(/^E \(/)).toBeTruthy();
    expect(within(card()).getByLabelText(/^G \(/)).toBeTruthy();
    expect(within(card()).getByLabelText(/^ρ \(/)).toBeTruthy();
  });

  it('enseña el material antes y después al elegir del catálogo', async () => {
    const { user } = await renderDatasheet({ entity: 'members' });
    const card = () => screen.getByRole('region', { name: 'Material' });
    await user.selectOptions(within(card()).getByRole('combobox'), 'concrete-28mpa');
    await waitFor(() => expect(within(card()).getByText('Antes')).toBeTruthy());
    expect(within(card()).getByText('Después')).toBeTruthy();
  });

  it('gira la flecha de la carga al cambiar su signo', async () => {
    const { user } = await renderDatasheet({ entity: 'loads' });
    expect(screen.getByTestId('datasheet-load-preview').getAttribute('data-direction')).toBe('down');
    const fy = within(panel()).getByLabelText(/^Fy \(/);
    await user.clear(fy);
    await user.type(fy, '8');
    await waitFor(() => expect(screen.getByTestId('datasheet-load-preview').getAttribute('data-direction'))
      .toBe('up'));
  });

  it('no ofrece liberaciones en una armadura', async () => {
    const { user } = await renderDatasheet({ entity: 'members' });
    const card = () => screen.getByRole('region', { name: 'Liberaciones' });
    expect(within(card()).getByRole('checkbox', { name: 'Momento en i' })).toBeTruthy();

    await user.click(screen.getByRole('rowheader', { name: 'M2' }));
    await waitFor(() => expect(within(card()).queryByRole('checkbox', { name: 'Momento en i' })).toBeNull());
    expect(within(card()).getByText(/pórtico/)).toBeTruthy();
  });

  it('aplica el borrador del panel como una sola entrada de historial', async () => {
    const { user, currentProject, undo } = await renderDatasheet();
    const x = within(panel()).getByLabelText(/^X \(m\)/);
    await user.clear(x);
    await user.type(x, '3');
    const y = within(panel()).getByLabelText(/^Y \(m\)/);
    await user.clear(y);
    await user.type(y, '2');

    await user.click(within(panel()).getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(currentProject().nodes[0]).toMatchObject({ x: 3, y: 2 }));

    // Dos campos, una entrada: la barra del borrador aplica el plan entero.
    undo();
    await waitFor(() => expect(currentProject().nodes[0]).toMatchObject({ x: 0, y: 0 }));
  });

  it('cancelar devuelve el preview al modelo', async () => {
    const { user, currentProject } = await renderDatasheet();
    const x = within(panel()).getByLabelText(/^X \(m\)/);
    await user.clear(x);
    await user.type(x, '3');
    await waitFor(() => expect(screen.getByTestId('datasheet-node-preview-ghost')).toBeTruthy());

    await user.click(within(panel()).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByTestId('datasheet-node-preview-ghost')).toBeNull());
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('no sustituye el editor por la revisión mientras se edita en el panel', async () => {
    const { user } = await renderDatasheet();
    const x = within(panel()).getByLabelText(/^X \(m\)/);
    await user.clear(x);
    await user.type(x, '3');
    const y = within(panel()).getByLabelText(/^Y \(m\)/);
    await user.clear(y);
    await user.type(y, '2');
    // Quitarle al usuario el preview que estaba mirando sería lo peor que puede
    // hacer una superficie de edición visual.
    expect(screen.queryByRole('region', { name: 'Revisión de cambios' })).toBeNull();
    expect(within(panel()).getByText('2 cambios pendientes')).toBeTruthy();
  });

  it('explica el error junto a su campo sin abrir la revisión', async () => {
    const { user, currentProject } = await renderDatasheet();
    const x = within(panel()).getByLabelText(/^X \(m\)/);
    await user.clear(x);
    await user.type(x, 'dos');
    await waitFor(() => expect(within(panel()).getByRole('alert').textContent)
      .toContain('no es un número'));
    expect(within(panel()).getByRole('button', { name: 'Aplicar' }).hasAttribute('disabled')).toBe(true);
    expect(currentProject().nodes[0].x).toBe(0);
  });
});
