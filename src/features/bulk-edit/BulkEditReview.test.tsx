// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkEditPanel } from './BulkEditPanel';
import { createBulkMember, createBulkNode } from './bulkEditFixtures';
import type { BulkSelectionInput } from './bulkEditTypes';

afterEach(cleanup);

const setup = () => userEvent.setup({ delay: null });

const renderPanel = (selection: BulkSelectionInput, onApply = vi.fn()) => {
  render(<BulkEditPanel
    selection={selection}
    units="kN-m"
    language="es"
    note="Al aplicar, los resultados actuales quedarán desactualizados."
    onApply={onApply}
  />);
  return onApply;
};

const mixedFrames: BulkSelectionInput = {
  members: [
    createBulkMember({ id: 'M1', type: 'frame', sectionId: 'ipe-300' }),
    createBulkMember({ id: 'M2', type: 'frame', sectionId: 'w12x26' }),
    createBulkMember({ id: 'M3', type: 'truss', sectionId: 'w12x26' }),
  ],
  nodes: [],
};

const review = () => screen.getByRole('region', { name: 'Revisar cambios' });

/**
 * Revisión antes de confirmar.
 *
 * Aplicar es irreversible en la práctica —invalida resultados y ocupa el
 * historial—, así que entre preparar y publicar hay una pantalla que dice
 * exactamente qué va a pasar. Nada se publica hasta la confirmación.
 */
describe('BulkEditPanel · review before applying', () => {
  it('does not apply straight from the editing footer', async () => {
    const user = setup();
    const onApply = renderPanel(mixedFrames);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));

    expect(onApply).not.toHaveBeenCalled();
    expect(review()).toBeTruthy();
  });

  it('states the current value, the target value and how many objects are affected', async () => {
    const user = setup();
    renderPanel(mixedFrames);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));

    const row = review().querySelector('[data-property="member.sectionId"]') as HTMLElement;
    expect(row.textContent).toContain('Varios');
    expect(row.textContent).toContain('W12x53');
    expect(row.textContent).toContain('3 objetos afectados');
  });

  it('states which properties stay untouched', async () => {
    const user = setup();
    renderPanel(mixedFrames);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));

    const untouched = within(review()).getByTestId('bulk-changes-untouched');
    expect(untouched.textContent).toMatch(/propiedades sin cambios/);
    expect(untouched.textContent).toContain('Material');
  });

  it('states the incompatible count with its reason', async () => {
    const user = setup();
    renderPanel(mixedFrames);

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const releases = document.querySelector('.bulk-field[data-property="member.releases.iMoment"]') as HTMLElement;
    await user.click(within(releases).getByRole('radio', { name: 'Sí' }));
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));

    const row = review().querySelector('[data-property="member.releases.iMoment"]') as HTMLElement;
    expect(row.textContent).toContain('1 objeto incompatible queda fuera');
    expect(row.textContent).toContain('No aplica a este tipo de miembro');
  });

  it('warns that the current results will be left out of date', async () => {
    const user = setup();
    renderPanel(mixedFrames);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));

    expect(within(review()).getByText(/quedarán desactualizados/)).toBeTruthy();
  });

  it('offers exactly a back-out and «Aplicar a N», and applies only on confirmation', async () => {
    const user = setup();
    const onApply = renderPanel(mixedFrames);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));

    const confirm = within(review()).getByRole('button', { name: 'Aplicar a 3' });
    expect(within(review()).getByRole('button', { name: 'Volver a editar' })).toBeTruthy();

    await user.click(confirm);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('returns to editing without losing the prepared draft when the review is cancelled', async () => {
    const user = setup();
    const onApply = renderPanel(mixedFrames);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));
    await user.click(within(review()).getByRole('button', { name: 'Volver a editar' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Revisar cambios' })).toBeNull();
    // El borrador sobrevive: cancelar la confirmación no descarta el trabajo.
    expect((screen.getByLabelText('Sección') as HTMLSelectElement).value).toBe('w12x53');
  });

  it('leaves the review when the selection changes underneath it', async () => {
    const user = setup();
    const { rerender } = render(<BulkEditPanel
      selection={mixedFrames}
      units="kN-m"
      language="es"
      onApply={vi.fn()}
    />);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));
    expect(review()).toBeTruthy();

    rerender(<BulkEditPanel
      selection={{ members: [], nodes: [createBulkNode({ id: 'N9' })] }}
      units="kN-m"
      language="es"
      onApply={vi.fn()}
    />);

    // Revisar unos objetos y confirmar sobre otros sería exactamente el fallo
    // que la firma de selección existe para impedir.
    expect(screen.queryByRole('region', { name: 'Revisar cambios' })).toBeNull();
  });
});
