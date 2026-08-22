// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkEditPanel } from './BulkEditPanel';
import { BULK_UNTOUCHED_OPTION } from './BulkPropertyField';
import { createBulkMember } from './bulkEditFixtures';
import type { BulkSelectionInput } from './bulkEditTypes';

afterEach(cleanup);

const setup = () => userEvent.setup({ delay: null });

const members: BulkSelectionInput = {
  members: [createBulkMember({ id: 'M1' }), createBulkMember({ id: 'M2' })],
  nodes: [],
};

const renderPanel = (onApply: (...args: never[]) => unknown = vi.fn()) => {
  render(<BulkEditPanel
    selection={members}
    units="kN-m"
    language="es"
    onApply={onApply as never}
  />);
};

const stage = async (user: ReturnType<typeof setup>) => {
  await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
  await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));
};

const reviewRegion = () => screen.queryByRole('region', { name: 'Revisar cambios' });

/**
 * Qué ocurre **después** de confirmar, y al volver de la revisión.
 *
 * Aplicar no cambia qué objetos están seleccionados, así que el efecto que
 * descarta el borrador al cambiar la selección nunca se dispara: sin un cierre
 * explícito el panel se queda en la pantalla de revisión, con las filas de un
 * cambio que ya ocurrió y el botón de confirmar todavía activo.
 */
describe('BulkEditPanel · after confirming', () => {
  it('returns to editing with a clean draft once the edit was applied', async () => {
    const user = setup();
    renderPanel(vi.fn());
    await stage(user);

    await user.click(within(reviewRegion()!).getByRole('button', { name: /^Aplicar/ }));

    await waitFor(() => expect(reviewRegion()).toBeNull());
    expect((screen.getByLabelText('Sección') as HTMLSelectElement).value).toBe(BULK_UNTOUCHED_OPTION);
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('Ningún cambio preparado');
  });

  it('stays on the review with the draft intact when applying failed', async () => {
    const user = setup();
    renderPanel(vi.fn().mockResolvedValue(false));
    await stage(user);

    await user.click(within(reviewRegion()!).getByRole('button', { name: /^Aplicar/ }));

    // Si el commit se rechazó —por ejemplo por una intención obsoleta— perder el
    // borrador obligaría a rehacer el trabajo entero.
    await waitFor(() => expect(reviewRegion()).not.toBeNull());
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('1 cambio preparado');
  });

  it('waits for an asynchronous apply before clearing anything', async () => {
    const user = setup();
    let resolve!: (value: boolean) => void;
    renderPanel(vi.fn().mockReturnValue(new Promise<boolean>((r) => { resolve = r; })));
    await stage(user);

    await user.click(within(reviewRegion()!).getByRole('button', { name: /^Aplicar/ }));
    expect(reviewRegion()).not.toBeNull();

    resolve(true);
    await waitFor(() => expect(reviewRegion()).toBeNull());
  });
});

describe('BulkEditPanel · leaving the review', () => {
  it('returns focus to the control that opened the review', async () => {
    const user = setup();
    renderPanel();
    await stage(user);

    await user.click(within(reviewRegion()!).getByRole('button', { name: 'Volver a editar' }));

    // Sin esto el foco cae en `<body>` y el siguiente Tab reempieza desde el
    // principio del documento.
    await waitFor(() => expect(document.activeElement)
      .toBe(screen.getByRole('button', { name: /^Revisar cambios/ })));
  });

  it('returns focus after leaving the review with Escape', async () => {
    const user = setup();
    renderPanel();
    await stage(user);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.activeElement)
      .toBe(screen.getByRole('button', { name: /^Revisar cambios/ })));
  });
});

describe('BulkEditPanel · unambiguous back-out', () => {
  it('does not give the destructive cancel and the review back-out the same label', async () => {
    const user = setup();
    renderPanel();

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    // El pie de edición descarta TODO el borrador; el de la revisión sólo
    // abandona la confirmación y lo conserva. Compartir etiqueta convertía lo
    // primero en una trampa para quien había aprendido lo segundo.
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Volver a editar' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));
    expect(within(reviewRegion()!).getByRole('button', { name: 'Volver a editar' })).toBeTruthy();
    expect(within(reviewRegion()!).queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });
});
