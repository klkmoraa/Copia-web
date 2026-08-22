// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { createDefaultProject } from '../../data/defaultProject';
import { prepareStructuralEdit } from '../../data/structuralEditing';
import { ProjectProvider } from '../../store/ProjectContext';
import { StructuralEditOverlay } from './StructuralEditOverlay';
import { createStructuralEditDraft, type StructuralEditDraft } from './structuralEditUi';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const renderOverlay = ({
  draft = null,
  error = '',
  pointerArmed = false,
  repeatAvailable = false,
}: {
  draft?: StructuralEditDraft | null;
  error?: string;
  pointerArmed?: boolean;
  repeatAvailable?: boolean;
} = {}) => {
  const project = createDefaultProject();
  const selection = { kind: 'node' as const, id: project.nodes[0].id };
  const prepared = draft ? (() => {
    try {
      return prepareStructuralEdit(project, draft.kind === 'move'
        ? { kind: 'move', selection, delta: { x: Number(draft.fields.deltaX), y: Number(draft.fields.deltaY) } }
        : { kind: 'move', selection, delta: { x: 1, y: 0 } });
    } catch {
      return null;
    }
  })() : null;
  const callbacks = {
    onStart: vi.fn(), onKindChange: vi.fn(), onDraftChange: vi.fn(),
    onTogglePointer: vi.fn(), onApply: vi.fn(), onCancel: vi.fn(),
  };
  const Harness = () => {
    const [current, setCurrent] = useState(draft);
    return <StructuralEditOverlay
      available
      repeatAvailable={repeatAvailable}
      draft={current}
      capabilities={{ structural: true, align: true, distribute: true }}
      prepared={prepared}
      error={error}
      pointerArmed={pointerArmed}
      lengthUnit="m"
      {...callbacks}
      onDraftChange={(next) => { callbacks.onDraftChange(next); setCurrent(next); }}
    />;
  };
  render(<ProjectProvider><Harness /></ProjectProvider>);
  return { project, selection, callbacks };
};

describe('StructuralEditOverlay', () => {
  it('uses one contextual launcher instead of permanent toolbar tools', async () => {
    const user = userEvent.setup();
    const { callbacks } = renderOverlay();
    const launcher = screen.getByRole('button', { name: /editar selección/i });
    expect(document.querySelectorAll('[data-structural-edit-launcher]')).toHaveLength(1);
    await user.click(launcher);
    expect(callbacks.onStart).toHaveBeenCalledWith('move');
  });

  it('keeps the launcher clear of Repeat when both contextual actions apply', () => {
    renderOverlay({ repeatAvailable: true });
    expect(document.querySelector('[data-structural-edit-launcher]')?.classList.contains('structural-edit-offset-for-repeat')).toBe(true);
  });

  it('offers all operations in one surface and keeps Mirror transform/copy explicit', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    const selection = { kind: 'node' as const, id: project.nodes[0].id };
    const draft = createStructuralEditDraft(project, selection, 'mirror');
    const { callbacks } = renderOverlay({ draft });
    const operation = screen.getByRole('radiogroup', { name: /operación/i });
    expect(within(operation).getAllByRole('radio')).toHaveLength(6);
    expect(within(operation).getByRole('radio', { name: /mover/i })).toBeTruthy();
    expect(within(operation).getByRole('radio', { name: /matriz lineal/i })).toBeTruthy();

    const semantics = screen.getByRole('radiogroup', { name: /resultado del reflejo/i });
    await user.click(within(semantics).getByRole('radio', { name: /crear copia/i }));
    expect(callbacks.onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.objectContaining({ mirrorMode: 'copy' }),
    }));
  });

  it('publishes numeric changes, explicit pointer mode and accessible invalid feedback', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    const draft = createStructuralEditDraft(project, { kind: 'node', id: project.nodes[0].id }, 'move');
    const { callbacks } = renderOverlay({ draft, error: 'ΔX debe ser finito.' });
    const deltaX = screen.getByLabelText('ΔX');
    await user.clear(deltaX);
    await user.type(deltaX, '2.5');
    expect(callbacks.onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      fields: expect.objectContaining({ deltaX: '2.5' }),
    }));
    expect(screen.getByRole('alert').textContent).toMatch(/finito/i);
    expect((screen.getByRole('button', { name: /aplicar/i }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: /usar puntero/i }));
    expect(callbacks.onTogglePointer).toHaveBeenCalledOnce();
  });

  it('cancels from Escape inside an input without clearing the selection contract', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    const draft = createStructuralEditDraft(project, { kind: 'node', id: project.nodes[0].id }, 'rotate');
    const { callbacks } = renderOverlay({ draft });
    const angle = screen.getByLabelText(/ángulo/i);
    angle.focus();
    await user.keyboard('{Escape}');
    expect(callbacks.onCancel).toHaveBeenCalledOnce();
  });

  it('meets the touch-control contract through Clay touch-sized actions', () => {
    const project = createDefaultProject();
    const draft = createStructuralEditDraft(project, { kind: 'node', id: project.nodes[0].id }, 'move');
    renderOverlay({ draft });
    expect(screen.getByRole('button', { name: /aplicar/i }).className).toContain('sc-button--touch');
    expect(screen.getAllByRole('button', { name: /cancelar/i }).at(-1)?.className).toContain('sc-button--touch');
  });
});
