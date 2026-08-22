// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidatePicker } from './CanvasCandidatePicker';
import { createCandidatePickerState } from './candidatePicker';

afterEach(cleanup);

const picker = createCandidatePickerState([
  { kind: 'node', id: 'N1' },
  { kind: 'member', id: 'M1' },
  { kind: 'nodalLoad', id: 'NL1' },
], { kind: 'member', id: 'M0' }, { x: 100, y: 120 })!;

const renderPicker = (overrides: Partial<Parameters<typeof CandidatePicker>[0]> = {}) => {
  const onCycle = vi.fn();
  const onSetActive = vi.fn();
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<CandidatePicker
    state={picker}
    presentation="floating"
    onCycle={onCycle}
    onSetActive={onSetActive}
    onConfirm={onConfirm}
    onCancel={onCancel}
    {...overrides}
  />);
  return { onCycle, onSetActive, onConfirm, onCancel };
};

describe('CandidatePicker', () => {
  it('renders the active explicit ID and focuses the keyboard listbox', () => {
    renderPicker();

    const listbox = screen.getByRole('listbox', { name: /candidatos de selección/i });
    expect(document.activeElement).toBe(listbox);
    expect(screen.getByRole('option', { name: /nodo n1/i }).getAttribute('aria-selected')).toBe('true');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('candidate-option-node-N1');
  });

  it('cycles with arrows and Home/End but confirms only Enter', () => {
    const { onCycle, onConfirm } = renderPicker();
    const listbox = screen.getByRole('listbox');

    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    fireEvent.keyDown(listbox, { key: 'Home' });
    fireEvent.keyDown(listbox, { key: 'End' });
    expect(onCycle.mock.calls).toEqual([['next'], ['previous'], ['first'], ['last']]);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels Escape inside picker scope without propagating to a containing surface', () => {
    const parentEscape = vi.fn();
    const onCancel = vi.fn();
    render(<div onKeyDown={parentEscape}><CandidatePicker
      state={picker}
      presentation="sheet"
      onCycle={vi.fn()}
      onSetActive={vi.fn()}
      onConfirm={vi.fn()}
      onCancel={onCancel}
    /></div>);

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(parentEscape).not.toHaveBeenCalled();
  });

  it('uses 44 px controls without changing canvas geometry', () => {
    renderPicker();
    const option = screen.getByRole('option', { name: /miembro m1/i });
    expect(option.getAttribute('data-minimum-target')).toBe('44');
    fireEvent.click(option);
  });
});
