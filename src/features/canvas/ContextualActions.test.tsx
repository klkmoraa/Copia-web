// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Selection } from '../../types';
import {
  ContextualActions,
  resolveContextualActionModel,
  type ContextualActionAvailability,
  type ContextualActionId,
} from './ContextualActions';

afterEach(cleanup);

const labels: Record<ContextualActionId, string> = {
  copy: 'Copiar',
  paste: 'Pegar',
  duplicate: 'Duplicar',
  repeat: 'Repetir',
  delete: 'Borrar',
  datasheet: 'Abrir hoja de datos',
  structuralEdit: 'Editar selección',
  selectSimilar: 'Seleccionar similares',
};

const available: ContextualActionAvailability = {
  copy: true,
  paste: true,
  duplicate: true,
  repeat: true,
  datasheet: true,
  structuralEdit: true,
  selectSimilar: true,
};

const renderSurface = (
  selection: Selection,
  availability: ContextualActionAvailability = available,
  onInvoke = vi.fn(),
) => render(<ContextualActions
  selection={selection}
  availability={availability}
  active
  presentation="inset"
  shellClass="K0"
  ariaLabel="Acciones de la selección"
  labelForAction={(id) => labels[id]}
  overflowLabel="Más acciones"
  onInvoke={onInvoke}
/>);

describe('contextual action model', () => {
  it('does not exist without a selection', () => {
    expect(resolveContextualActionModel(null, available)).toBeNull();
  });

  it.each([
    [{ kind: 'node', id: 'N1' } as Selection, 'structuralEdit'],
    [{ kind: 'member', id: 'M1' } as Selection, 'structuralEdit'],
    [{ kind: 'multi', nodeIds: ['N1'], memberIds: ['M1'] } as Selection, 'structuralEdit'],
    [{ kind: 'nodalLoad', id: 'NL1' } as Selection, 'repeat'],
    [{ kind: 'memberLoad', id: 'ML1' } as Selection, 'repeat'],
  ])('derives %s primary action from the real selection type', (selection, primary) => {
    expect(resolveContextualActionModel(selection, available)?.primary.id).toBe(primary);
  });

  it('changes actions with selection capabilities rather than retaining a copied selection kind', () => {
    const member = resolveContextualActionModel({ kind: 'member', id: 'M1' }, available);
    const load = resolveContextualActionModel({ kind: 'memberLoad', id: 'ML1' }, {
      ...available,
      copy: false,
      duplicate: false,
      structuralEdit: false,
    });

    expect(member?.visible.map((action) => action.id)).toContain('structuralEdit');
    expect(load?.primary.id).toBe('repeat');
    expect(load?.overflow.map((action) => action.id)).not.toContain('structuralEdit');
  });
});

describe('ContextualActions Compact floor', () => {
  it('does not render without an active selection', () => {
    renderSurface(null);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('keeps exactly the primary verb, Borrar and overflow visible in Compact', () => {
    renderSurface({ kind: 'member', id: 'M1' });

    expect(screen.getByRole('button', { name: 'Editar selección' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Más acciones' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull();
  });

  it('reveals all remaining touch routes with shortcuts in overflow and invokes them', async () => {
    const user = userEvent.setup();
    const onInvoke = vi.fn();
    renderSurface({ kind: 'member', id: 'M1' }, available, onInvoke);

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(screen.getByRole('menuitem', { name: /Copiar/i }).textContent).toContain('Ctrl/Cmd+C');
    expect(screen.getByRole('menuitem', { name: /Pegar/i }).textContent).toContain('Ctrl/Cmd+V');
    expect(screen.getByRole('menuitem', { name: /Duplicar/i }).textContent).toContain('Ctrl/Cmd+D');
    expect(screen.getByRole('menuitem', { name: /Repetir/i }).textContent).toContain('R');
    expect(screen.getByRole('menuitem', { name: /Abrir hoja de datos/i })).toBeTruthy();

    await user.click(screen.getByRole('menuitem', { name: /Copiar/i }));
    expect(onInvoke).toHaveBeenCalledWith('copy');
  });

  it('keeps a logical Tab order and opens overflow by keyboard', async () => {
    const user = userEvent.setup();
    renderSurface({ kind: 'member', id: 'M1' });

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar selección' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Borrar' }));
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Más acciones' });
    expect(document.activeElement).toBe(trigger);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'Más acciones' })).toBeTruthy();
  });

  it('recomposes presentation while consuming the same live selection value', () => {
    const view = renderSurface({ kind: 'member', id: 'M1' });
    expect(screen.getByRole('toolbar').getAttribute('data-presentation')).toBe('inset');

    view.rerender(<ContextualActions
      selection={{ kind: 'member', id: 'M1' }}
      availability={available}
      active
      presentation="inset"
      shellClass="M1"
      ariaLabel="Acciones de la selección"
      labelForAction={(id) => labels[id]}
      overflowLabel="Más acciones"
      onInvoke={vi.fn()}
    />);

    expect(screen.getByRole('toolbar').getAttribute('data-shell-class')).toBe('M1');
    expect(screen.getByRole('button', { name: 'Editar selección' })).toBeTruthy();
  });

  it('closes only its overflow with Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderSurface({ kind: 'member', id: 'M1' });
    const trigger = screen.getByRole('button', { name: 'Más acciones' });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
