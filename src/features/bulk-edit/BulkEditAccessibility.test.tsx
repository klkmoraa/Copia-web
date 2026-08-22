// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkEditPanel } from './BulkEditPanel';
import { createBulkMember, createBulkNode } from './bulkEditFixtures';
import type { BulkSelectionInput } from './bulkEditTypes';

afterEach(cleanup);

const setup = () => userEvent.setup({ delay: null });

const renderPanel = (selection: BulkSelectionInput) => {
  const onApply = vi.fn();
  render(<BulkEditPanel selection={selection} units="kN-m" language="es" onApply={onApply} />);
  return onApply;
};

const fieldRow = (property: string) =>
  document.querySelector(`.bulk-field[data-property="${property}"]`) as HTMLElement;

/** Dos nudos cuya articulación interna difiere: el estado indeterminado real. */
const mixedHinges: BulkSelectionInput = {
  members: [],
  nodes: [
    createBulkNode({ id: 'N1', internalHinge: true }),
    createBulkNode({ id: 'N2', internalHinge: false }),
  ],
};

describe('BulkEditPanel accessibility · real mixed state', () => {
  it('exposes a mixed boolean as `mixed`, never as unchecked', () => {
    renderPanel(mixedHinges);

    const current = within(fieldRow('node.internalHinge')).getByRole('checkbox');
    expect(current.getAttribute('aria-checked')).toBe('mixed');
    // «Mixto» jamás puede leerse como «false»: ese es el fallo que este estado existe para impedir.
    expect(current.getAttribute('aria-checked')).not.toBe('false');
  });

  it('exposes a shared `false` as unchecked and a shared `true` as checked', () => {
    renderPanel({
      members: [],
      nodes: [createBulkNode({ id: 'N1', internalHinge: false }), createBulkNode({ id: 'N2' })],
    });
    expect(within(fieldRow('node.internalHinge')).getByRole('checkbox').getAttribute('aria-checked')).toBe('false');

    cleanup();
    renderPanel({
      members: [],
      nodes: [createBulkNode({ id: 'N3', internalHinge: true }), createBulkNode({ id: 'N4', internalHinge: true })],
    });
    expect(within(fieldRow('node.internalHinge')).getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });

  it('names the current-value indicator and marks it read-only', () => {
    renderPanel(mixedHinges);

    const current = within(fieldRow('node.internalHinge')).getByRole('checkbox');
    expect(current.getAttribute('aria-readonly')).toBe('true');
    expect(current.getAttribute('aria-label')).toContain('Articulación interna');
  });

  it('keeps the staged intent separate from the current value', async () => {
    const user = setup();
    renderPanel(mixedHinges);
    const row = fieldRow('node.internalHinge');

    // Con el valor actual mixto, el control de intención sigue en «Sin cambios»:
    // un valor mixto que nadie tocó no puede convertirse en una escritura.
    expect(within(row).getByRole('radio', { name: 'Sin cambios' }).getAttribute('aria-checked')).toBe('true');

    await user.click(within(row).getByRole('radio', { name: 'Sí' }));
    // El valor actual no se mueve al preparar: sigue siendo mixto.
    expect(within(row).getByRole('checkbox').getAttribute('aria-checked')).toBe('mixed');
  });
});

describe('BulkEditPanel accessibility · review', () => {
  const staged = async (user: ReturnType<typeof setup>) => {
    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));
  };

  const members: BulkSelectionInput = {
    members: [createBulkMember({ id: 'M1' }), createBulkMember({ id: 'M2' })],
    nodes: [],
  };

  it('moves focus into the review instead of leaving it on a button that vanished', async () => {
    const user = setup();
    renderPanel(members);
    await staged(user);

    const review = screen.getByRole('region', { name: 'Revisar cambios' });
    // Sin esto el foco cae en `<body>` y el siguiente Tab reempieza desde el
    // principio del documento, justo en el paso previo a publicar.
    expect(review.contains(document.activeElement)).toBe(true);
  });

  it('returns to editing on Escape without applying anything', async () => {
    const user = setup();
    const onApply = renderPanel(members);
    await staged(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('region', { name: 'Revisar cambios' })).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('reaches the confirmation with the keyboard alone', async () => {
    const user = setup();
    const onApply = renderPanel(members);
    await staged(user);

    const confirm = within(screen.getByRole('region', { name: 'Revisar cambios' }))
      .getByRole('button', { name: /^Aplicar/ });
    confirm.focus();
    await user.keyboard('{Enter}');

    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

describe('BulkEditPanel accessibility · scope filter', () => {
  const mixed: BulkSelectionInput = {
    members: [createBulkMember({ id: 'M1' })],
    nodes: [createBulkNode({ id: 'N1' })],
  };

  it('names the scope filter and describes what it does and does not change', () => {
    renderPanel(mixed);

    const group = screen.getByRole('radiogroup', { name: 'Qué se edita' });
    expect(group).toBeTruthy();
    expect(screen.getByText(/la selección del lienzo no se toca/)).toBeTruthy();
  });

  it('drives the scope filter from the keyboard', async () => {
    const user = setup();
    renderPanel(mixed);

    const group = screen.getByRole('radiogroup', { name: 'Qué se edita' });
    within(group).getByRole('radio', { name: 'Todos' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(within(group).getByRole('radio', { name: 'Miembros' }).getAttribute('aria-checked')).toBe('true');
    // Filtrar es una lente: las propiedades de nudo dejan de mostrarse.
    expect(fieldRow('node.support.type')).toBeNull();
    expect(fieldRow('member.sectionId')).toBeTruthy();
  });
});
